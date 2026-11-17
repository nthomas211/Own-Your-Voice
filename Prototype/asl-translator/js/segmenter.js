// Splits the continuous stream of camera frames into individual signs.
//
// A sign starts when hands appear (or start moving again after a pause) and ends when
//   - the hands leave the frame / drop out of view, or
//   - the hands hold still for a moment (so static signs like letters/numbers work), or
//   - it gets too long (safety cap).
// After a "hold still" ending we wait for new motion before starting the next sign,
// so holding one pose doesn't spam the same word.
//
// All timings are in milliseconds (not frames) so it behaves the same on a slow laptop
// running at 10 fps and a fast one at 30 fps.

export class Segmenter {
  constructor(opts = {}) {
    this.onSegment = opts.onSegment || (() => {});
    this.onState = opts.onState || (() => {});
    this.minFrames = opts.minFrames ?? 4; // at least this many frames...
    this.minMs = opts.minMs ?? 250; // ...spanning at least this long
    this.holdMs = opts.holdMs ?? 350; // stillness that ends a sign
    this.goneMs = opts.goneMs ?? 250; // hands missing this long ends a sign
    this.maxMs = opts.maxMs ?? 4000;
    this.motionThresh = opts.motionThresh ?? 0.06;
    this.reset();
  }

  reset() {
    this.state = "idle";
    this.buf = [];
    this.times = [];
    this.stillSince = null;
    this.goneSince = null;
    this.movingSince = null;
    this.ema = 0;
    this.lastFeat = null;
    this.onState(this.state);
  }

  setState(s) {
    if (s !== this.state) {
      this.state = s;
      this.onState(s);
    }
  }

  begin(t, seed) {
    this.buf = seed.map((s) => s.feat);
    this.times = seed.map((s) => s.t);
    this.stillSince = null;
    this.goneSince = null;
    this.movingSince = null;
    this.setState("signing");
  }

  /** Feed one frame: feat (Float32Array), hasHands (bool), motion (number), t (ms). */
  push(feat, hasHands, motion, t = performance.now()) {
    this.ema = this.ema * 0.5 + motion * 0.5;
    const isStill = this.ema < this.motionThresh;

    if (hasHands) this.goneSince = null;
    else if (this.goneSince == null) this.goneSince = t;
    const goneLong = !hasHands && t - this.goneSince >= this.goneMs;

    switch (this.state) {
      case "idle":
        if (hasHands) this.begin(t, [{ feat, t }]);
        break;

      case "signing": {
        if (!hasHands) {
          if (goneLong) {
            this.finish("hands-left");
            this.setState("idle");
          }
          break;
        }
        this.buf.push(feat);
        this.times.push(t);
        if (isStill) {
          if (this.stillSince == null) this.stillSince = t;
        } else this.stillSince = null;

        const heldFor = this.stillSince == null ? 0 : t - this.stillSince;
        if (heldFor >= this.holdMs) {
          // Keep only a few of the held frames: the pose matters, not how long it was held.
          let firstStill = this.times.findIndex((x) => x >= this.stillSince);
          if (firstStill < 0) firstStill = this.buf.length;
          const keep = Math.min(this.buf.length, firstStill + 3);
          const moved = this.times[Math.min(keep, this.times.length) - 1] - this.times[0];
          if (keep >= this.minFrames && moved >= this.minMs * 0.5) {
            this.buf.length = keep;
            this.times.length = keep;
            this.finish("held");
            this.setState("holding");
          } else if (this.buf.length >= this.minFrames && t - this.times[0] >= this.minMs + this.holdMs) {
            // A static sign shown without any lead-in motion.
            this.finish("held");
            this.setState("holding");
          }
        } else if (t - this.times[0] >= this.maxMs) {
          this.finish("max-length");
          this.setState("holding");
        }
        break;
      }

      case "holding":
        if (!hasHands) {
          if (goneLong) this.setState("idle");
          break;
        }
        if (this.ema > this.motionThresh * 1.6) {
          if (this.movingSince == null) this.movingSince = t;
          if (t - this.movingSince >= 60) {
            this.begin(t, this.lastFeat ? [this.lastFeat, { feat, t }] : [{ feat, t }]);
          }
        } else this.movingSince = null;
        break;
    }
    if (hasHands) this.lastFeat = { feat, t };
  }

  /** Force-end the current sign (used by the "End sign now" button / Space key). */
  flush() {
    if (this.state === "signing") this.finish("manual");
    this.setState("idle");
  }

  finish(reason) {
    const seq = this.buf;
    const span = this.times.length ? this.times[this.times.length - 1] - this.times[0] : 0;
    this.buf = [];
    this.times = [];
    this.stillSince = null;
    if (seq.length >= this.minFrames && (span >= this.minMs || reason === "manual")) {
      this.onSegment(seq, reason);
    }
  }
}
