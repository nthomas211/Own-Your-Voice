# ASL Citizen results presentation package

Generated from the project backup dated 2026-10-04.

## Files

- `asl_citizen_results.pptx` — 9-slide presentation-ready deck.
- `generate_results_figures.py` — regenerates all PNG figures from the embedded summary values.
- `asl_citizen_figures/*.png` — seven 16:9 figures suitable for dropping into an existing presentation.

## Main results shown

- 22/22 focused automated tests passed.
- Official train/validation/test rows: 40,154 / 10,304 / 32,941; signer groups are disjoint.
- 96-clip CPU extraction benchmark: 14m 32.96s, 8,328 frames, 44.61 MiB raw landmarks, 11.40 MiB feature shards.
- Expanded pilot: 473 train + 119 validation clips across 32 classes.
- Three-seed validation: 84.03% top-1 with augmentation vs 81.23% without; temporal-mean baseline 29.69%.
- Expanded-training mean: 85.71% top-1, 99.44% top-5, 85.90% macro top-1.
- Signer-grouped five-fold CV: 80.55% top-1.
- Frozen official test subset: 388 clips, 75.00% top-1, 94.85% top-5, 75.18% macro top-1.

## Important scope note

The test result is a one-time evaluation of a selected 32-class pilot subset, not a full ASL Citizen dataset evaluation. The project report also notes that full-dataset extraction has not been completed.
