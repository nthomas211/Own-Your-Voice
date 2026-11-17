# ASL Recognition Research

This directory contains the machine-learning and computer-vision research for the ASL recognition component of Own Your Voice.

## Development Stages

### Stage 1
The first pilot evaluated isolated-sign recognition using a selected 32-class ASL Citizen subset.

Research included:

- MediaPipe landmark extraction
- CNN + Transformer classification
- signer-independent evaluation
- feature compression
- automated engineering tests

### Dev Stage 2
Stage 2 expanded the project toward sentence-level recognition.

The team:

- processed the full ASL Citizen official splits into landmarks
- trained a new 32-sign isolated model
- developed a CTC sentence model
- tested synthetic stitched sentences
- evaluated contextual correction using Claude
- tested reconstruction of potentially missed signs

See:

`devstage2/Results Explained - Dev Stage 2.md`

## Important Limitation

Current sentence results use synthetic sentences created from isolated-sign clips.

They do not yet establish accuracy on naturally signed continuous ASL.

Testing with real continuous-ASL video remains an important next step.
