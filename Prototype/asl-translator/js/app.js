import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  DrawingUtils,
} from "../vendor/tasks-vision/vision_bundle.mjs";
import { extractFrame, frameMotion, smoothBody } from "./features.js";
import { Segmenter } from "./segmenter.js";
import { SignClassifier, resample } from "./classifier.js";
import * as store from "./store.js";
import { toEnglish } from "./english.js";
import { STARTER_WORDS } from "./vocab.js";

const $ = (id) => document.getElementById(id);
const el = {
  video: $("video"), overlay: $("overlay"), pill: $("statusPill"), countdown: $("countdown"),
  flash: $("flash"), startOverlay: $("startOverlay"), startBtn: $("startBtn"), loadMsg: $("loadMsg"),
  motionBar: $("motionBar"), english: $("english"), gloss: $("gloss"), candidatesBox: $("candidatesBox"),
  candidates: $("candidates"), log: $("log"), emptyHint: $("emptyHint"), vocab: $("vocab"),
  vocabCount: $("vocabCount"), wordInput: $("wordInput"), wordList: $("wordList"), repeatInput: $("repeatInput"),
  recordBtn: $("recordBtn"), howTo: $("howTo"), evalResult: $("evalResult"), starterList: $("starterList"),
  toast: $("toast"), cameraSelect: $("cameraSelect"),
};

// ---------------------------------------------------------------- settings
const SETTINGS_KEY = "asl-translator-settings-v2";
const settings = Object.assign(
  { sensitivity: 0.06, holdMs: 350, strictness: 1, autoSpeak: false, showSkeleton: true, useTwoHands: true, camera: "" },
  JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"),
);
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

// ---------------------------------------------------------------- state
const classifier = new SignClassifier();
let samples = [];
let sentences = [[]]; // list of sentences; each is a list of { label, seq, candidates }
let recording = null; // { label, remaining, total, armed }
let handLandmarker, poseLandmarker, drawer;
let running = false;
let lastVideoTime = -1;
let lastPose = null;
let prevFrame = null;
let body = null;
let frameNo = 0;
let noHandsSince = performance.now();

const segmenter = new Segmenter({
  motionThresh: settings.sensitivity,
  holdMs: settings.holdMs,
  onSegment: handleSegment,
  onState: updatePill,
});

// ---------------------------------------------------------------- helpers
function toast(msg, ms = 2200) {
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.toast.classList.add("hidden"), ms);
}
function flash(color = "#34a853") {
  el.flash.style.borderColor = color;
  el.flash.classList.remove("hidden");
  setTimeout(() => el.flash.classList.add("hidden"), 250);
}
function speak(text) {
  if (!text || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  speechSynthesis.speak(u);
}
const normLabel = (s) => s.trim().toUpperCase().replace(/\s+/g, "-");

function updatePill(state) {
  if (recording && recording.armed) {
    el.pill.className = "pill rec";
    el.pill.textContent = `Recording "${recording.label}" ${recording.total - recording.remaining + 1}/${recording.total}`;
    return;
  }
  if (!running) return;
  const text = { idle: "Show your hands", signing: "Signing…", holding: "Got it, keep going" }[state] || state;
  el.pill.className = "pill " + state;
  el.pill.textContent = text;
}

// ---------------------------------------------------------------- camera + models
async function loadModels() {
  el.loadMsg.textContent = "Loading hand-tracking models…";
  const base = new URL("../", import.meta.url);
  const fileset = await FilesetResolver.forVisionTasks(new URL("vendor/tasks-vision/wasm", base).href);
  const make = async (Cls, model, opts, delegate) =>
    Cls.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: new URL(model, base).href, delegate },
      runningMode: "VIDEO",
      ...opts,
    });
  const create = async (delegate) => {
    handLandmarker = await make(HandLandmarker, "models/hand_landmarker.task", {
      numHands: settings.useTwoHands ? 2 : 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }, delegate);
    poseLandmarker = await make(PoseLandmarker, "models/pose_landmarker_lite.task", { numPoses: 1 }, delegate);
  };
  try {
    await create("GPU");
  } catch (e) {
    console.warn("GPU delegate failed, falling back to CPU", e);
    await create("CPU");
  }
}

async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput");
    el.cameraSelect.innerHTML = '<option value="">Default camera</option>' +
      cams.map((c, i) => `<option value="${c.deviceId}">${c.label || "Camera " + (i + 1)}</option>`).join("");
    el.cameraSelect.value = settings.camera;
  } catch { /* ignore */ }
}

async function startCamera() {
  if (el.video.srcObject) el.video.srcObject.getTracks().forEach((t) => t.stop());
  const video = { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: "user" };
  if (settings.camera) video.deviceId = { exact: settings.camera };
  const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
  el.video.srcObject = stream;
  await el.video.play();
  el.overlay.width = el.video.videoWidth;
  el.overlay.height = el.video.videoHeight;
}

async function start() {
  el.startBtn.disabled = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access needs a modern browser and a secure page (https:// or http://localhost).");
    }
    el.loadMsg.textContent = "Requesting camera…";
    await startCamera();
    if (!handLandmarker) await loadModels();
    el.startOverlay.classList.add("hidden");
    drawer = new DrawingUtils(el.overlay.getContext("2d"));
    running = true;
    segmenter.reset();
    listCameras();
    requestAnimationFrame(loop);
  } catch (e) {
    console.error(e);
    el.loadMsg.textContent = "⚠ " + (e.name === "NotAllowedError" ? "Camera permission was denied." : e.message);
    el.startBtn.disabled = false;
  }
}

// ---------------------------------------------------------------- main loop
function loop() {
  if (!running) return;
  const v = el.video;
  if (v.readyState >= 2 && v.currentTime !== lastVideoTime) {
    lastVideoTime = v.currentTime;
    const ts = performance.now();
    const hands = handLandmarker.detectForVideo(v, ts);
    // Pose (shoulders) changes slowly: run it every 3rd frame to save CPU.
    if (frameNo++ % 3 === 0) {
      lastPose = poseLandmarker.detectForVideo(v, ts);
      body = smoothBody(body, lastPose.landmarks);
    }
    const frame = extractFrame(hands, body);
    const motion = frameMotion(prevFrame, frame);
    prevFrame = frame.hasHands ? frame : null;
    el.motionBar.style.width = Math.min(100, (motion / (settings.sensitivity * 4)) * 100) + "%";

    if (!recording || recording.armed) segmenter.push(frame.feat, frame.hasHands, frame.hasHands ? motion : 0, ts);

    // Long pause with no hands -> start a new sentence.
    if (frame.hasHands) noHandsSince = ts;
    else if (ts - noHandsSince > 2500 && sentences[sentences.length - 1].length) newSentence();

    draw(hands, lastPose);
  }
  requestAnimationFrame(loop);
}

function draw(hands, pose) {
  const ctx = el.overlay.getContext("2d");
  ctx.clearRect(0, 0, el.overlay.width, el.overlay.height);
  if (!settings.showSkeleton) return;
  if (pose?.landmarks?.[0]) {
    const p = pose.landmarks[0];
    drawer.drawLandmarks([p[0], p[11], p[12]], { color: "#8ab4f8", radius: 4 });
    drawer.drawConnectors(p, [{ start: 11, end: 12 }], { color: "#8ab4f8", lineWidth: 2 });
  }
  (hands.landmarks || []).forEach((lm, i) => {
    const side = hands.handedness?.[i]?.[0]?.categoryName;
    const color = side === "Right" ? "#34a853" : "#fbbc04";
    drawer.drawConnectors(lm, HandLandmarker.HAND_CONNECTIONS, { color, lineWidth: 3 });
    drawer.drawLandmarks(lm, { color: "#fff", fillColor: color, radius: 3, lineWidth: 1 });
  });
}

// ---------------------------------------------------------------- recognition
function handleSegment(seq) {
  const rs = resample(seq);
  if (recording && recording.armed) return captureExample(rs);
  if (!samples.length) {
    toast("No signs taught yet. Open “Teach signs” first.");
    return;
  }
  const res = classifier.classify(rs, settings.strictness);
  const label = res.label || "?";
  const entry = { label, seq: rs, candidates: res.candidates, confidence: res.confidence };
  sentences[sentences.length - 1].push(entry);
  flash(res.label ? "#34a853" : "#d93025");
  logLine(res);
  renderOutput();
}

function logLine(res) {
  const li = document.createElement("li");
  const cands = res.candidates.map((c) => `${c.label} ${(c.score * 100).toFixed(0)}%`).join(" · ");
  li.textContent = `${new Date().toLocaleTimeString()}  ${res.label || "unknown"}  (${cands})`;
  el.log.prepend(li);
  while (el.log.children.length > 30) el.log.lastChild.remove();
}

function newSentence() {
  if (sentences[sentences.length - 1].length) {
    if (settings.autoSpeak) {
      const s = sentences[sentences.length - 1].filter((e) => e.label !== "?").map((e) => e.label);
      speak(toEnglish([s]));
    }
    sentences.push([]);
    renderOutput();
  }
}

function renderOutput() {
  const glossSentences = sentences.map((s) => s.filter((e) => e.label !== "?").map((e) => e.label));
  const text = toEnglish(glossSentences);
  el.english.textContent = text || "Sign to the camera…";
  el.english.classList.toggle("placeholder", !text);

  el.gloss.innerHTML = "";
  sentences.filter((s) => s.length).forEach((s, si) => {
    if (si > 0) {
      const sep = document.createElement("span");
      sep.className = "chip sep";
      sep.textContent = "/";
      el.gloss.append(sep);
    }
    s.forEach((e) => {
      const c = document.createElement("span");
      c.className = "chip" + (e.label === "?" ? " unknown" : "");
      c.textContent = e.label;
      el.gloss.append(c);
    });
  });

  // Alternatives for the most recent sign (like Google Translate's alternate translations).
  const last = sentences.flat().at(-1);
  el.candidates.innerHTML = "";
  if (last && last.candidates.length) {
    last.candidates.forEach((c) => {
      if (c.label === last.label) return;
      const b = document.createElement("button");
      b.className = "cand";
      b.innerHTML = `${c.label} <span class="score">${Math.round(c.score * 100)}%</span>`;
      b.onclick = () => correctLast(c.label);
      el.candidates.append(b);
    });
    const other = document.createElement("button");
    other.textContent = "Other…";
    other.onclick = () => {
      const w = prompt("What was that sign? (English word)");
      if (w) correctLast(normLabel(w));
    };
    el.candidates.append(other);
  }
  el.candidatesBox.classList.toggle("hidden", !last);
  el.emptyHint.classList.toggle("hidden", samples.length > 0);
}

async function correctLast(label) {
  const sentence = [...sentences].reverse().find((s) => s.length);
  if (!sentence) return;
  const entry = sentence[sentence.length - 1];
  entry.label = label;
  entry.candidates = [];
  // Learn from the correction so the same mistake is less likely next time.
  await addSample(label, entry.seq);
  toast(`Fixed. “${label}” learned from this example.`);
  renderOutput();
}

// ---------------------------------------------------------------- teaching
async function addSample(label, seq) {
  const sample = { id: store.newId(), label, seq, created: Date.now() };
  await store.saveSample(sample);
  samples.push(sample);
  classifier.setSamples(samples);
  renderVocab();
}

function startRecording(label, count) {
  label = normLabel(label);
  if (!label) {
    el.wordInput.focus();
    return toast("Type the English word for the sign first.");
  }
  if (!running) return toast("Start the camera first.");
  recording = { label, remaining: count, total: count, armed: false };
  el.recordBtn.textContent = "■ Stop";
  showHowTo(label);
  armNext();
}

function armNext() {
  if (!recording) return;
  recording.armed = false;
  segmenter.reset();
  el.pill.className = "pill rec";
  el.pill.textContent = `Get ready: "${recording.label}"`;
  let n = 3;
  el.countdown.classList.remove("hidden");
  el.countdown.textContent = n;
  const tick = setInterval(() => {
    if (!recording) {
      clearInterval(tick);
      el.countdown.classList.add("hidden");
      return;
    }
    n--;
    if (n > 0) {
      el.countdown.textContent = n;
    } else {
      clearInterval(tick);
      el.countdown.textContent = "Sign!";
      setTimeout(() => el.countdown.classList.add("hidden"), 500);
      segmenter.reset();
      recording.armed = true;
      updatePill();
      // If nothing is captured in 6 s, cut whatever we have.
      clearTimeout(recording.timeout);
      recording.timeout = setTimeout(() => {
        if (!recording?.armed) return;
        segmenter.flush();
        if (recording?.armed) {
          toast("Didn't catch a sign. Make sure your hands are in view, then try again.", 2500);
          armNext();
        }
      }, 6000);
    }
  }, 700);
}

async function captureExample(seq) {
  const r = recording;
  clearTimeout(r.timeout);
  r.armed = false;
  flash();
  el.pill.className = "pill holding";
  el.pill.textContent = `Saved ${r.total - r.remaining + 1}/${r.total} ✓`;
  await addSample(r.label, seq);
  r.remaining--;
  if (r.remaining > 0) {
    toast(`Saved ${r.total - r.remaining}/${r.total}. Next one…`, 1200);
    setTimeout(armNext, 900);
  } else {
    toast(`“${r.label}” learned from ${r.total} examples ✓`);
    stopRecording();
  }
}

function stopRecording() {
  if (recording) clearTimeout(recording.timeout);
  recording = null;
  el.countdown.classList.add("hidden");
  el.recordBtn.textContent = "● Record";
  segmenter.reset();
}

function showHowTo(label) {
  const tip = STARTER_WORDS.find(([w]) => w === label);
  el.howTo.classList.toggle("hidden", !tip);
  if (tip) el.howTo.innerHTML = `<b>${tip[0]}</b>: ${tip[1]}`;
}

function renderVocab(evalResult) {
  const counts = new Map();
  samples.forEach((s) => counts.set(s.label, (counts.get(s.label) || 0) + 1));
  el.vocabCount.textContent = counts.size;
  el.vocab.innerHTML = "";
  if (!counts.size) {
    el.vocab.innerHTML = '<div class="empty">No signs yet. Type a word above and press Record, or pick from the starter list below.</div>';
  }
  [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([label, n]) => {
    const d = document.createElement("div");
    d.className = "word";
    const pl = evalResult?.perLabel.get(label);
    const acc = pl ? `<div class="acc" style="color:${pl.correct / pl.total >= 0.8 ? "var(--ok)" : "var(--bad)"}">${Math.round((pl.correct / pl.total) * 100)}% recognized</div>` : "";
    d.innerHTML = `<div><div class="name">${label}</div><div class="count ${n < 3 ? "low" : ""}">${n} example${n > 1 ? "s" : ""}${n < 3 ? " (add more)" : ""}</div>${acc}</div>`;
    const btns = document.createElement("div");
    const add = document.createElement("button");
    add.textContent = "+";
    add.title = "Record more examples";
    add.onclick = () => { el.wordInput.value = label; startRecording(label, +el.repeatInput.value || 5); };
    const del = document.createElement("button");
    del.textContent = "✕";
    del.title = "Delete this word";
    del.onclick = async () => {
      if (!confirm(`Delete all ${n} examples of "${label}"?`)) return;
      for (const s of samples.filter((s) => s.label === label)) await store.deleteSample(s.id);
      samples = samples.filter((s) => s.label !== label);
      classifier.setSamples(samples);
      renderVocab();
    };
    btns.append(add, del);
    d.append(btns);
    el.vocab.append(d);
  });
  el.wordList.innerHTML = [...new Set([...counts.keys(), ...STARTER_WORDS.map(([w]) => w)])]
    .map((w) => `<option value="${w}">`).join("");
  el.emptyHint.classList.toggle("hidden", samples.length > 0);
}

function renderStarter() {
  el.starterList.innerHTML = "";
  STARTER_WORDS.forEach(([w, tip]) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<b>${w}</b><span class="muted">${tip}</span>`;
    const b = document.createElement("button");
    b.textContent = "Teach";
    b.onclick = () => {
      el.wordInput.value = w;
      startRecording(w, +el.repeatInput.value || 5);
      el.wordInput.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    row.append(b);
    el.starterList.append(row);
  });
}

// ---------------------------------------------------------------- UI wiring
function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("hidden", v.id !== "view-" + name));
  if (name !== "teach" && recording) stopRecording();
}
document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => showTab(t.dataset.tab)));
document.querySelectorAll("[data-goto]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); showTab(a.dataset.goto); }));

el.startBtn.onclick = start;
$("doneBtn").onclick = () => segmenter.flush();
$("newSentenceBtn").onclick = newSentence;
$("speakBtn").onclick = () => speak(el.english.classList.contains("placeholder") ? "" : el.english.textContent);
$("copyBtn").onclick = async () => {
  if (el.english.classList.contains("placeholder")) return;
  await navigator.clipboard.writeText(el.english.textContent);
  toast("Copied");
};
$("undoBtn").onclick = () => {
  while (sentences.length > 1 && !sentences[sentences.length - 1].length) sentences.pop();
  sentences[sentences.length - 1].pop();
  renderOutput();
};
$("clearBtn").onclick = () => { sentences = [[]]; el.log.innerHTML = ""; renderOutput(); };

el.recordBtn.onclick = () => (recording ? stopRecording() : startRecording(el.wordInput.value, +el.repeatInput.value || 5));
el.wordInput.oninput = () => showHowTo(normLabel(el.wordInput.value));
el.wordInput.onkeydown = (e) => { if (e.key === "Enter") el.recordBtn.click(); };

$("evalBtn").onclick = () => {
  const r = classifier.evaluate();
  el.evalResult.classList.remove("hidden");
  if (r.accuracy == null) {
    el.evalResult.textContent = "Record at least 2 examples of a word to test it.";
    return;
  }
  const conf = r.confusions.slice(0, 5).map((c) => `${c.actual} → ${c.guessed}`).join(", ");
  el.evalResult.innerHTML = `<b>${Math.round(r.accuracy * 100)}%</b> of your ${r.total} examples are recognized correctly when held out.` +
    (conf ? `<br>Most confused: ${conf}. Add more examples of these, or sign them more distinctly.` : " Nice!");
  renderVocab(r);
};
$("exportBtn").onclick = () => {
  if (!samples.length) return toast("Nothing to export yet.");
  const blob = new Blob([store.exportJSON(samples)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `asl-vocabulary-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};
$("importInput").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const imported = store.parseJSON(await file.text());
    for (const s of imported) await store.saveSample(s);
    samples.push(...imported);
    classifier.setSamples(samples);
    renderVocab();
    toast(`Imported ${imported.length} examples.`);
  } catch (err) {
    toast("Import failed: " + err.message, 4000);
  }
  e.target.value = "";
};
$("resetBtn").onclick = async () => {
  if (!samples.length || !confirm("Delete your entire vocabulary? This can't be undone (export first to keep a backup).")) return;
  await store.clearSamples();
  samples = [];
  classifier.setSamples(samples);
  renderVocab();
};

// settings controls
const bindRange = (id, key, apply) => {
  const input = $(id);
  input.value = settings[key];
  const update = () => { settings[key] = +input.value; apply?.(); saveSettings(); };
  input.oninput = update;
  apply?.();
};
const bindCheck = (id, key, apply) => {
  const input = $(id);
  input.checked = settings[key];
  input.onchange = () => { settings[key] = input.checked; apply?.(); saveSettings(); };
};
bindRange("sensitivity", "sensitivity", () => (segmenter.motionThresh = settings.sensitivity));
bindRange("holdMs", "holdMs", () => {
  segmenter.holdMs = settings.holdMs;
  $("holdLabel").textContent = `(${(settings.holdMs / 1000).toFixed(2)} s)`;
});
bindRange("strictness", "strictness");
bindCheck("autoSpeak", "autoSpeak");
bindCheck("showSkeleton", "showSkeleton");
bindCheck("useTwoHands", "useTwoHands", () => handLandmarker?.setOptions({ numHands: settings.useTwoHands ? 2 : 1 }));
el.cameraSelect.onchange = async () => {
  settings.camera = el.cameraSelect.value;
  saveSettings();
  if (running) await startCamera().catch((e) => toast(e.message));
};

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, select, textarea")) return;
  if (e.code === "Space") { e.preventDefault(); segmenter.flush(); }
  else if (e.key === "Enter") newSentence();
  else if (e.key === "Backspace") $("undoBtn").click();
});

// ---------------------------------------------------------------- boot
(async () => {
  try {
    samples = await store.loadSamples();
  } catch (e) {
    console.warn("Could not load saved vocabulary", e);
  }
  classifier.setSamples(samples);
  renderVocab();
  renderStarter();
  renderOutput();
  window.__asl = { classifier, segmenter, get samples() { return samples; }, handleSegment, sentences: () => sentences };
})();
