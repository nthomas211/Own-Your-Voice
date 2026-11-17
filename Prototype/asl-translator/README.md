# SignBridge: ASL → English camera translator

A Google-Translate-style web app. Point your webcam at yourself and sign. Each sign you
make shows up as English text on the right, and you can have it read aloud.

Everything runs locally in your browser. Video never leaves your computer.

## Quick start

1. Serve the folder over `http://localhost` (browsers only allow camera access on localhost or https):

   ```bash
   cd asl-translator
   python3 -m http.server 8000
   ```

2. Open <http://localhost:8000> in Chrome, Edge, or Firefox, then click **Start camera**.
3. Open **Teach signs**, type a word (e.g. `HELLO`), and press **Record**. After the 3-2-1
   countdown, sign the word once and then lower your hands or hold still. It records 5 examples
   automatically. Repeat for each word you want. A starter list with signing tips is included.
4. Go back to **Translate** and sign. Words appear as you sign. A pause of about 2.5 s with your
   hands down starts a new sentence.

## Features

| | |
|---|---|
| Live camera translation | Hand and body tracking with MediaPipe; signs are detected automatically when you pause or lower your hands |
| ASL gloss → English | Rule-based grammar smoothing: `ME WANT EAT` → "I want to eat.", `BATHROOM WHERE` → "Where is the bathroom?", `YOUR NAME WHAT` → "What is your name?" |
| "Did you mean" | Shows alternatives for the last sign. Tapping one fixes the word **and teaches the app from that example** |
| Speak / Copy / Undo / Clear | Text-to-speech uses the browser's built-in voices, and can speak automatically at the end of each sentence |
| Teach mode | Records examples with a countdown, flags words with too few examples, and **Test accuracy** shows which signs get confused |
| Export / Import | Save your vocabulary as a JSON file to back it up or share it with someone else |
| Works offline | The MediaPipe library and models are vendored in `vendor/` and `models/`, so no CDN is needed |

Keyboard: **Space** = end the current sign now, **Enter** = new sentence, **Backspace** = undo last word.

## How it works

```
camera ─▶ MediaPipe HandLandmarker (21 pts × 2 hands) ─┐
       └▶ MediaPipe PoseLandmarker (shoulders)  ───────┴▶ features.js
           hand shape (wrist-relative, size-normalized) + hand location relative to the body
                                   │
                         segmenter.js: splits the stream into signs
                         (hands lowered, or held still ~0.35 s)
                                   │
                         classifier.js: Dynamic Time Warping k-NN against your examples
                         (tolerant of signing faster or slower), rejects unknown signs
                                   │
                         english.js: gloss → English sentence
```

* `js/features.js`: landmark → feature vector (scale, position, and distance invariant)
* `js/segmenter.js`: time-based sign boundary detection (same behaviour at 10 or 30 fps)
* `js/classifier.js`: DTW nearest-neighbour matcher, auto-calibrated "unknown" threshold, leave-one-out accuracy test
* `js/english.js`: ASL gloss → English rules (to-be insertion, wh-question reordering, "want to …")
* `js/store.js`: IndexedDB storage plus JSON export/import
* `js/app.js`: UI, camera, and main loop

## Tips for good accuracy

* Record **5–10 examples per word**, varying your speed and position slightly.
* Sign with your upper body in frame, in decent lighting, against a plain background if possible.
* Signs that differ only by facial expression or tiny finger details will be confused. Run
  **Test accuracy** and add more examples for those signs.
* If signs get cut in half, raise **Hold time** in Settings. If two signs merge into one, pause a
  little longer between them or lower **Motion sensitivity**.

## Limitations

This is a few-shot recognizer for **isolated signs that you teach it**, not a full ASL
translator. It doesn't understand facial grammar, classifiers, role-shifting, or continuous
fingerspelling, and the gloss-to-English step is rule-based. Treat it as a communication aid,
not a replacement for a qualified interpreter.

A natural next step is to train a model on a public isolated-sign dataset (e.g. WLASL or
Google's ASL Signs Kaggle dataset, which uses these same MediaPipe landmarks), so the app works
out of the box without teaching.

## Third-party

MediaPipe Tasks Vision 0.10.14 and the hand/pose landmarker models © Google, Apache-2.0.
