// Turns raw MediaPipe landmarks into a compact, camera-independent feature vector.
//
// Per hand (two slots: "dominant" side A and side B, chosen by MediaPipe's handedness):
//   - 21 landmarks relative to the wrist, scaled by hand size  -> hand SHAPE   (42 values, x/y)
//   - fingertip depth hints (z of 5 tips, scaled)              -> extra shape  (5 values)
//   - wrist position relative to the shoulders/face            -> hand LOCATION (2 values)
//   - presence flag                                            -> 1 value
// Making shape scale/position-invariant and location body-relative means the same sign
// matches whether you stand close, far, or off-center in the frame.

export const SHAPE_DIM = 21 * 2 + 5;
export const SLOT_DIM = SHAPE_DIM + 2 + 1;
export const FEAT_DIM = SLOT_DIM * 2;

// Relative importance of each part when comparing frames.
const W_SHAPE = 1.0;
const W_LOC = 2.5;
const W_PRESENT = 3.0;
const TIP_IDS = [4, 8, 12, 16, 20];

/**
 * Smoothed body reference frame. Pose landmarks jitter frame-to-frame, which would look
 * like hand motion, so blend each new estimate into the previous one.
 */
export function smoothBody(prev, poseLandmarks, alpha = 0.15) {
  const cur = bodyFrame(poseLandmarks);
  if (!prev || prev.fromPose !== cur.fromPose) return cur;
  const mix = (a, b) => a + (b - a) * alpha;
  return { cx: mix(prev.cx, cur.cx), cy: mix(prev.cy, cur.cy), scale: mix(prev.scale, cur.scale),
    noseY: mix(prev.noseY, cur.noseY), fromPose: cur.fromPose };
}

/** Body reference frame from pose landmarks (or a sensible fallback). */
export function bodyFrame(poseLandmarks) {
  const p = poseLandmarks && poseLandmarks[0];
  if (p && p[11] && p[12]) {
    const ls = p[11], rs = p[12], nose = p[0];
    const cx = (ls.x + rs.x) / 2;
    const cy = (ls.y + rs.y) / 2;
    const width = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    if (width > 0.02) {
      return { cx, cy, scale: width, noseY: nose ? nose.y : cy - width * 0.8, fromPose: true };
    }
  }
  return { cx: 0.5, cy: 0.65, scale: 0.3, noseY: 0.35, fromPose: false };
}

function handSlotFeatures(lm, body, out, offset) {
  const wrist = lm[0];
  const mcp = lm[9];
  const size = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y) || 1e-3;
  let k = offset;
  for (let i = 0; i < 21; i++) {
    out[k++] = ((lm[i].x - wrist.x) / size) * W_SHAPE;
    out[k++] = ((lm[i].y - wrist.y) / size) * W_SHAPE;
  }
  for (const t of TIP_IDS) {
    out[k++] = ((lm[t].z - wrist.z) / size) * 0.5 * W_SHAPE;
  }
  // Location: use the palm center rather than the wrist for stability.
  const px = (wrist.x + mcp.x) / 2;
  const py = (wrist.y + mcp.y) / 2;
  out[k++] = ((px - body.cx) / body.scale) * W_LOC;
  out[k++] = ((py - body.cy) / body.scale) * W_LOC;
  out[k++] = W_PRESENT;
}

/**
 * Build a feature frame from HandLandmarker results and a body frame (see smoothBody).
 * Returns { feat: Float32Array, hasHands, nHands, raw: [{x,y,size}|null, ...per slot] }.
 */
export function extractFrame(handResult, body) {
  const feat = new Float32Array(FEAT_DIM); // missing hand -> zeros (presence 0)
  body = body || bodyFrame(null);
  const hands = (handResult && handResult.landmarks) || [];
  const handed = (handResult && (handResult.handedness || handResult.handednesses)) || [];
  const used = [false, false];
  const raw = [null, null];

  // Sort by confidence so a spurious low-score detection can't steal a slot.
  const order = hands.map((_, i) => i).sort((a, b) => {
    const sa = handed[a] && handed[a][0] ? handed[a][0].score : 0;
    const sb = handed[b] && handed[b][0] ? handed[b][0].score : 0;
    return sb - sa;
  });

  for (const i of order) {
    const label = handed[i] && handed[i][0] ? handed[i][0].categoryName : "Right";
    let slot = label === "Right" ? 0 : 1;
    if (used[slot]) slot = 1 - slot;
    if (used[slot]) continue;
    used[slot] = true;
    handSlotFeatures(hands[i], body, feat, slot * SLOT_DIM);
    const lm = hands[i];
    raw[slot] = {
      x: (lm[0].x + lm[9].x) / 2,
      y: (lm[0].y + lm[9].y) / 2,
      size: Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y) || 1e-3,
    };
  }
  return { feat, hasHands: used[0] || used[1], nHands: raw.filter(Boolean).length, raw, body };
}

/**
 * How much the hands moved between two frames, measured in "hand sizes" in the image
 * (independent of pose tracking), plus a little for handshape changes.
 */
export function frameMotion(prev, cur) {
  if (!prev || !cur) return 0;
  let total = 0, n = 0;
  for (let s = 0; s < 2; s++) {
    const a = prev.raw[s], b = cur.raw[s];
    if (!a !== !b) return 1; // a hand appeared/disappeared: definitely motion
    if (!b) continue;
    n++;
    const loc = Math.hypot(b.x - a.x, b.y - a.y) / ((a.size + b.size) / 2);
    const o = s * SLOT_DIM;
    let sd = 0;
    for (let j = 0; j < 42; j++) sd += Math.abs(cur.feat[o + j] - prev.feat[o + j]);
    total += loc + 0.5 * (sd / 42);
  }
  return n ? total / n : 0;
}
