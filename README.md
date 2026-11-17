# Own Your Voice

Own Your Voice is an accessibility-focused computing project exploring real-time communication support between Deaf American Sign Language (ASL) users and hearing individuals.

The project currently includes two experimental approaches:

- **ASL Recognition Research** — MediaPipe landmark extraction with CNN/Transformer and CTC-based sentence recognition experiments.
- **SignBridge Prototype** — a browser-based, few-shot ASL recognizer that learns isolated signs from user-recorded examples and processes video locally.

## Current Development

### Stage 1
A 32-class ASL Citizen pilot was used to evaluate isolated-sign recognition, signer generalization, landmark compression, and model accuracy.

### Dev Stage 2
Development expanded into sentence-level recognition using:

- full ASL Citizen landmark extraction
- isolated-sign CNN/Transformer training
- CTC sentence recognition
- synthetic stitched sentence evaluation
- contextual correction using Claude
- reconstruction experiments for missed signs

Dev Stage 2 results are located in:

`asl_recognition/devstage2/`

## Prototype

The browser prototype is located in:

`Prototype/asl-translator/`

It uses:

- MediaPipe HandLandmarker
- MediaPipe PoseLandmarker
- Dynamic Time Warping (DTW)
- local IndexedDB storage
- rule-based ASL gloss-to-English conversion

This prototype recognizes isolated signs taught by the user. It is not a complete continuous-ASL translator.

## Privacy & Security

The project follows a data-minimization approach:

- raw research datasets are not committed to this repository
- model checkpoints and credentials are excluded from Git
- the browser prototype processes camera video locally
- downstream language-model experiments use predicted glosses and probabilities rather than raw signing video

See:

`docs/privacy_security.md`

## Data

Large ASL datasets are not stored directly in this repository.

Research sources include:

- ASL Citizen
- WLASL
- Google ASL Signs competition resources
- Boston University ASL SignBank resources

Dataset licensing and usage requirements must be reviewed before redistribution.

See:

`docs/dataset_policy.md`

## Current Limitations

The system is still experimental.

Current limitations include:

- limited vocabulary
- difficulty with continuous natural signing
- missed or duplicated signs
- limited signer diversity
- latency
- incomplete facial grammar modeling
- synthetic sentence testing does not fully reproduce natural continuous ASL

Own Your Voice should be considered an accessibility research prototype, not a replacement for a qualified interpreter.
