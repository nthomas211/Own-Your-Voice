# ASL Recognition Research

This module contains exploratory computer-vision work for a possible future ASL-accessibility feature in **Own Your Voice**.

## Current scope

- Isolated-sign recognition experiments
- ASL Citizen pilot evaluation
- Signer-independent evaluation
- Feature-extraction and model-results visualization
- Research into public ASL datasets

## Current pilot result scope

The included results package reports a selected **32-class ASL Citizen pilot**. The frozen official-test subset contains 388 clips. This is not a full-dataset evaluation and does not demonstrate continuous sentence-level ASL translation.

## Files

- `scripts/generate_results_figures.py` — regenerates result charts from the embedded pilot summary values.
- `results/asl_citizen_results.pptx` — results presentation.
- `results/RESULTS_PRESENTATION_README.md` — source notes and reported metrics.
- `results/figures/` — regenerated charts.

## Run the figure generator

```bash
python -m pip install -r asl_recognition/requirements.txt
python asl_recognition/scripts/generate_results_figures.py --out asl_recognition/results/figures
```

## Project integration

Treat ASL recognition as a separate experimental module. The first Own Your Voice prototype can remain focused on:

**Interviewer speech → speech-to-text → applicant reads → applicant types → text-to-speech → interviewer hears**

ASL recognition can be evaluated later as an additional input mode once its accuracy, latency, and user experience are sufficiently validated.
