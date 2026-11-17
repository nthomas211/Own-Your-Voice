// Sign recognizer: nearest-neighbour matching of landmark sequences using
// Dynamic Time Warping (DTW), so the same sign signed faster/slower still matches.
// Works with just a few examples per word, entirely in the browser.

import { FEAT_DIM } from "./features.js";

export const SEQ_LEN = 24;

/** Linearly resample a sequence of Float32Arrays to a fixed length. */
export function resample(seq, T = SEQ_LEN) {
  const out = [];
  if (seq.length === 0) return out;
  if (seq.length === 1) {
    for (let t = 0; t < T; t++) out.push(Float32Array.from(seq[0]));
    return out;
  }
  for (let t = 0; t < T; t++) {
    const pos = (t * (seq.length - 1)) / (T - 1);
    const i = Math.floor(pos);
    const f = pos - i;
    const a = seq[i], b = seq[Math.min(i + 1, seq.length - 1)];
    const v = new Float32Array(a.length);
    for (let j = 0; j < a.length; j++) v[j] = a[j] + (b[j] - a[j]) * f;
    out.push(v);
  }
  return out;
}

function frameDist(a, b) {
  let s = 0;
  for (let j = 0; j < FEAT_DIM; j++) {
    const d = a[j] - b[j];
    s += d * d;
  }
  return Math.sqrt(s);
}

/** Banded DTW, normalised by path length -> average per-frame distance. */
export function dtw(a, b, band = 6) {
  const n = a.length, m = b.length;
  const INF = 1e18;
  let prev = new Float64Array(m + 1).fill(INF);
  let prevLen = new Float64Array(m + 1);
  let cur = new Float64Array(m + 1);
  let curLen = new Float64Array(m + 1);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(INF);
    cur[0] = INF;
    const lo = Math.max(1, i - band), hi = Math.min(m, i + band);
    for (let j = lo; j <= hi; j++) {
      const c = frameDist(a[i - 1], b[j - 1]);
      let best = prev[j - 1], len = prevLen[j - 1]; // diagonal
      if (prev[j] < best) { best = prev[j]; len = prevLen[j]; }
      if (cur[j - 1] < best) { best = cur[j - 1]; len = curLen[j - 1]; }
      cur[j] = best + c;
      curLen[j] = len + 1;
    }
    [prev, cur] = [cur, prev];
    [prevLen, curLen] = [curLen, prevLen];
  }
  return prev[m] / (prevLen[m] || 1);
}

export class SignClassifier {
  constructor() {
    this.samples = []; // { id, label, seq: Float32Array[] (resampled) }
    this.threshold = null;
  }

  setSamples(samples) {
    this.samples = samples;
    this.calibrate();
  }

  labels() {
    return [...new Set(this.samples.map((s) => s.label))];
  }

  /** Rank labels for a raw (un-resampled) sequence. */
  rank(rawSeq, excludeId = null) {
    const q = rawSeq.length === SEQ_LEN ? rawSeq : resample(rawSeq);
    const best = new Map();
    for (const s of this.samples) {
      if (s.id === excludeId) continue;
      const d = dtw(q, s.seq);
      const arr = best.get(s.label) || [];
      arr.push(d);
      best.set(s.label, arr);
    }
    const ranked = [];
    for (const [label, ds] of best) {
      ds.sort((x, y) => x - y);
      // Average of the two closest examples is more robust than the single closest.
      const k = Math.min(2, ds.length);
      const score = ds.slice(0, k).reduce((a, b) => a + b, 0) / k;
      ranked.push({ label, dist: score, nearest: ds[0] });
    }
    ranked.sort((a, b) => a.dist - b.dist);
    return ranked;
  }

  /**
   * Classify a sequence. Returns { label|null, confidence, candidates }.
   * label is null when nothing is close enough ("unknown sign").
   */
  classify(rawSeq, strictness = 1) {
    const ranked = this.rank(rawSeq);
    if (!ranked.length) return { label: null, confidence: 0, candidates: [] };
    const thr = (this.threshold ?? 2.2) / strictness;
    const top = ranked[0];
    const second = ranked[1];
    // Confidence blends "how close" with "how much better than the runner-up".
    const closeness = Math.max(0, 1 - top.nearest / (thr * 1.5));
    const margin = second ? Math.min(1, (second.dist - top.dist) / (top.dist + 1e-6)) : 1;
    const confidence = Math.max(0, Math.min(1, 0.6 * closeness + 0.4 * margin));
    const candidates = ranked.slice(0, 3).map((r) => ({
      label: r.label,
      dist: r.dist,
      score: Math.max(0, 1 - r.dist / (thr * 1.5)),
    }));
    // Accept when close enough, or when clearly closer to one word than to any other.
    const decisive = !second || second.dist / (top.dist + 1e-6) > 1.3;
    const accepted = top.nearest <= thr || (decisive && top.nearest <= thr * 1.5);
    return { label: accepted ? top.label : null, confidence, candidates };
  }

  /**
   * Derive the "unknown sign" threshold from the training data:
   * how far apart are examples of the SAME sign, and how close are DIFFERENT signs?
   */
  calibrate() {
    const intra = [], inter = [];
    // With a big vocabulary, a random subset of queries is plenty (keeps this fast).
    const queries = this.samples.length > 60
      ? [...this.samples].sort(() => Math.random() - 0.5).slice(0, 60)
      : this.samples;
    for (const s of queries) {
      let sameMin = Infinity, otherMin = Infinity;
      for (const t of this.samples) {
        if (t === s) continue;
        const d = dtw(s.seq, t.seq);
        if (t.label === s.label) sameMin = Math.min(sameMin, d);
        else otherMin = Math.min(otherMin, d);
      }
      if (isFinite(sameMin)) intra.push(sameMin);
      if (isFinite(otherMin)) inter.push(otherMin);
    }
    if (!intra.length) {
      this.threshold = null;
      return;
    }
    intra.sort((a, b) => a - b);
    const p90 = intra[Math.floor(intra.length * 0.9)] ?? intra[intra.length - 1];
    let thr = p90 * 1.6;
    if (inter.length) {
      inter.sort((a, b) => a - b);
      const interMed = inter[Math.floor(inter.length / 2)];
      thr = Math.max(p90 * 1.15, interMed * 0.7, Math.min(thr, interMed * 1.1));
    }
    this.threshold = thr;
  }

  /** Leave-one-out accuracy, so users can see which signs get confused. */
  evaluate() {
    const perLabel = new Map();
    let correct = 0, total = 0;
    const confusions = [];
    const counts = new Map();
    for (const s of this.samples) counts.set(s.label, (counts.get(s.label) || 0) + 1);
    for (const s of this.samples) {
      if (counts.get(s.label) < 2) continue;
      const r = this.rank(s.seq, s.id);
      const guess = r[0] ? r[0].label : null;
      const ok = guess === s.label;
      total++;
      if (ok) correct++;
      else confusions.push({ actual: s.label, guessed: guess });
      const pl = perLabel.get(s.label) || { correct: 0, total: 0 };
      pl.total++;
      if (ok) pl.correct++;
      perLabel.set(s.label, pl);
    }
    return { accuracy: total ? correct / total : null, total, perLabel, confusions };
  }
}
