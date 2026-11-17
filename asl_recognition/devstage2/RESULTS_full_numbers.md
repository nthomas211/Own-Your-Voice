# Overnight run 2026-11-13: 32-sign vocabulary, isolated vs sentence model

_Generated 2026-11-13 08:43 by `summarize_results.py`._

## 1. Extraction (full ASL Citizen, new parallel extractor)

| Split | Clips processed | Failed | Glosses | Signers | Frames | QA good / warn / bad |
|---|---:|---:|---:|---:|---:|---|
| train | 40,154 | 0 | 2,731 | 35 | 3,462,848 | 93.1% / 6.8% / 0.1% |
| validation | 10,304 | 0 | 2,731 | 6 | 897,608 | 93.8% / 6.1% / 0.1% |
| test | 32,940 | 1 | 2,731 | 11 | 2,541,259 | 94.6% / 5.3% / 0.1% |

| Extraction | Old pilot (2026-10, serial) | New (2026-11-13, parallel) |
|---|---|---|
| Throughput | ~0.11 clips/s (1 process, 48-thread node) | ~3.8 clips/s (48 workers, 96-thread node) |
| Full-dataset time | ~8.8 days (estimated, never run) | ~6 h train+val, ~2.4 h test (measured) |
| Clips extracted | 980 (pilot subset) | full official splits (table above) |
| Reproducibility | pose smoothing leaked across clips | fresh landmarkers per clip, bit-identical reruns |

## 2. Isolated (one-sign) model: new 32-gloss vocabulary

| Seed | Train clips | Val clips | Best epoch | Val top-1 | Val top-5 | Val macro top-1 |
|---|---:|---:|---:|---:|---:|---:|
| 2026 | 481 | 119 | 20 | 76.47% | 96.64% | 77.08% |
| 42 | 481 | 119 | 21 | 81.51% | 98.32% | 82.19% |
| 7 | 481 | 119 | 14 | 74.79% | 94.12% | 76.20% |
| **mean ± sd** | | | | **77.59 ± 3.50** | 96.36 ± 2.11 | 78.49 ± 3.23 |

Trained on `cuda` (lab PC RTX 2070 SUPER).

### Old pilot vs new run (same architecture and hyper-parameters)

| Metric | Old pilot (Oct 2026, CPU) | New run (Nov 13, GPU) |
|---|---|---|
| Vocabulary | 32 "familiar" glosses (list lost) | 32 glosses chosen from 10 test sentences |
| Train / val clips | 473 / 119 | 481 / 119 |
| Val top-1, 3 seeds | 85.71% ± 1.68 | 77.59% ± 3.50 |
| Val top-5, 3 seeds | 99.44% ± 0.49 | 96.36% ± 2.11 |
| Signer-grouped 5-fold CV top-1 (seed 42) | 80.55% | 71.31% |
| Official test (one-time, frozen) | 75.00% top-1 / 94.85% top-5 (388 clips) | not run: test is sealed until a model is frozen |
| Hardware | CPU (no CUDA on that lease) | RTX 2070 SUPER |

The two vocabularies differ, so this compares the pipeline and the order of magnitude, not identical tasks.

## 3. Continuous (sentence) model: CTC on synthetic sentences

Training sentences are stitched from **train** clips (half random 2–5 sign sequences, half the 10 test sentences); validation sentences come from **validation** clips (unseen signers).

| Run | Init | Best val WER | Epochs run | Train sentences/epoch |
|---|---|---:|---:|---:|
| ctc_scratch | random | 46.55% | 25 | 2000 |
| ctc_init | isolated seed-42 encoder | 35.51% | 23 | 2000 |

### The 10 test sentences (20 stitched versions each, validation signers)

| Model | WER | Whole sentence exactly right |
|---|---:|---:|
| scratch | 35.97% | 20.50% |
| init_from_isolated | 30.97% | 18.50% |
| isolated model on each sign's own clip (perfect segmentation, upper bound) | 16.67% (= 1 − top-1) | — |

| ID | Sentence (gloss order) | English | WER scratch | WER init_from_isolated | Isolated per-sign top-1 | Most common output (init_from_isolated) |
|---|---|---|---:|---:|---:|---|
| S01 | HELLO NICE MEET YOU | Hello, nice to meet you. | 48.75% | 25.00% | 92.50% | HELLO NICE MEET |
| S02 | ME WANT1 DRINK1 WATER | I want to drink water. | 17.50% | 28.75% | 86.25% | ME ME WANT1 DRINK1 WATER |
| S03 | TOMORROW ME GO SCHOOL | Tomorrow I am going to school. | 31.25% | 28.75% | 70.00% | TOMORROW ME ME GO SCHOOL |
| S04 | YOU LIKE COFFEE | Do you like coffee? | 43.33% | 25.00% | 58.33% | YOU COFFEE |
| S05 | MY MOTHER SICK | My mother is sick. | 25.00% | 30.00% | 93.33% | MY MOTHER SICK |
| S06 | ME HUNGRY WANT1 EAT1 PIZZA2 | I'm hungry; I want to eat pizza. | 21.00% | 40.00% | 92.00% | ME WANT1 PIZZA2 |
| S07 | BATHROOM WHERE | Where is the bathroom? | 20.00% | 17.50% | 100.00% | BATHROOM WHERE |
| S08 | YESTERDAY ME WATCH MOVIE1 | Yesterday I watched a movie. | 33.75% | 30.00% | 87.50% | YESTERDAY ME WATCH MOVIE1 MOVIE1 |
| S09 | THANKYOU HELP ME | Thank you for helping me. | 60.00% | 51.67% | 63.33% | THANKYOU HELP ME ME |
| S10 | MY FRIEND LEARN SIGN | My friend is learning sign language. | 60.00% | 27.50% | 87.50% | MY FRIEND SIGN |

## 4. LLM step: Claude chooses among each sign's top-5 guesses

`continuous/eval_llm.py`: `ctc_init` on the 10 test sentences × 5 validation versions (the first 5 of the 20 above, same seeds). Claude (`claude-opus-5-5`, effort low) sees only gloss names and probabilities, may drop a spurious segment, and may only choose from each segment's top-5.

| Version | WER | Whole sentence exactly right | Invalid replies | Cost per sentence | Time per call |
|---|---:|---:|---:|---:|---:|
| Sentence model alone (top guess per sign) | 26.67% | 24.00% | — | — | — |
| + Claude, first prompt | 20.00% | 38.00% | 1 | $0.0053 | 1.9 s |
| + Claude, prompt with duplicate-sign rule | 15.56% | 54.00% | 0 | $0.0057 | 2.2 s |

With the duplicate-sign rule, Claude reduced the errors in 17 of 50 sentences and increased them in 0. It cannot restore a sign the CTC model never detected (e.g. LEARN, THANKYOU), because it only chooses among detected segments.

The duplicate-sign rule was written after looking at these validation outputs, so the second Claude row is tuned on the data it is scored on (the rule is generic, not sentence-specific).

### 4b. Best-guess reconstruction: filling in signs the model missed

`continuous/eval_reconstruct.py`: the same 50 decodes. Timing gaps where a sign was probably missed (`llm_translate.find_gaps`; thresholds measured on sentences stitched from **train** clips) are given to Claude together with the 32-gloss vocabulary, but **not** the list of test sentences. Claude returns the literal English plus a best guess that may insert vocabulary signs into flagged gaps, with inferred words in [brackets]. A separate blind Claude call grades each English version against the correct English (same / partial / different meaning).

| Version | Gloss WER | Same meaning | Partial | Different |
|---|---:|---:|---:|---:|
| Literal (detected signs only) | 15.56% | 33/50 | 13/50 | 4/50 |
| Best guess (fills gaps) | 10.00% | 34/50 | 12/50 | 4/50 |

- Signs were inferred in 17 of 50 decodes; the gloss sequence got better in 13 and worse in 3 (wrong guesses such as an extra DRINK or YOU).
- Gap detector: it flagged 15 of the 23 decodes that were really missing a sign, and also 12 complete ones. Claude mostly held back on those.
- The meaning grade barely moved. Often the right sign was inserted, but the English stayed stiff ("My friend is [learning] sign." was graded partial against "…sign language"), or a second missed sign was not recovered.
- Cost $0.56 for 50 translations plus the judge calls.

## 5. Demo check: MediaPipe on the lab PC vs the lease

The class demo runs MediaPipe live on Windows. Its landmarks are not bit-identical to the lease's Linux extraction (face/hands differ by ≤0.004, the pose nose by ≤0.024), so the same 107 validation videos were re-extracted on the PC and the 10-sentence evaluation (20 versions) repeated:

| Model | Lease landmarks | Lab-PC landmarks |
|---|---:|---:|
| scratch WER | 35.97% | 37.08% |
| init_from_isolated WER | 30.97% | 29.44% |
| isolated per-sign top-1 | 83.33% | 80.28% |

The differences are within the noise of 200 stitched sentences, so the demo shows the evaluated model.

## Caveats

- Synthetic sentences join isolated clips with interpolated transitions; real signing has co-articulation, so real-video WER will be worse than the synthetic numbers.
- Validation has only 3–5 clips per gloss (from 6 signers), so per-gloss and per-sentence numbers are noisy.
- The official test split was extracted but deliberately **not** used. Run a one-time test only after freezing a model (see MODEL_FREEZE.md protocol).
- Vocabulary is 32 glosses; the full ASL Citizen vocabulary is 2,731.
