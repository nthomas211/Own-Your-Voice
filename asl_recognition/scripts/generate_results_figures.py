from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


# Values transcribed from BENCHMARK_RESULTS.md / MODEL_FREEZE.md.
DATA = {
    "splits": {"train": 40154, "validation": 10304, "test": 32941},
    "participants": {"train": 35, "validation": 6, "test": 11},
    "unit_tests": {
        "Sampling": 3,
        "Preprocessing": 5,
        "Feature shards": 4,
        "Pilot model": 8,
        "Handoff bundle": 2,
    },
    "benchmark": {
        "clips": 96,
        "frames": 8328,
        "seconds": 14 * 60 + 32.96,
        "raw_mib": 44.61,
        "features_mib": 11.40,
        "projection_days": 8.8,
    },
    "pilot": {
        "train_clips": 473,
        "val_clips": 119,
        "train_frames": 39463,
        "val_frames": 9920,
        "total_frames": 49383,
        "classes": 32,
    },
    "val_compare": [
        ("CNN/Transformer\n+ augmentation", 84.03, 2.22),
        ("CNN/Transformer\nno augmentation", 81.23, 1.75),
        ("Temporal-mean\nlinear baseline", 29.69, 3.40),
    ],
    "expanded": {"top1": 85.71, "top1_sd": 1.68, "top5": 99.44, "top5_sd": 0.49, "macro": 85.90, "macro_sd": 1.49},
    "signer_cv": {"top1": 80.55, "macro": 80.54},
    "frozen_val": {"top1": 84.03, "top5": 99.16, "macro": 84.32},
    "test": {"samples": 388, "top1": 75.00, "top5": 94.85, "macro": 75.18, "correct1": 291, "correct5": 368},
}


def savefig(fig: plt.Figure, path: Path) -> None:
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def figure_split_integrity(out: Path) -> None:
    fig, ax = plt.subplots(figsize=(13.33, 7.5))
    labels = ["Train", "Validation", "Test"]
    rows = [DATA["splits"][k] for k in ("train", "validation", "test")]
    bars = ax.bar(labels, rows)
    ax.set_title("Official split coverage", fontsize=24, weight="bold", loc="left")
    ax.set_ylabel("Rows in official CSV")
    ax.set_ylim(0, max(rows) * 1.18)
    ax.grid(axis="y", alpha=0.2)
    ax.set_axisbelow(True)
    for b, v in zip(bars, rows):
        ax.text(b.get_x() + b.get_width() / 2, v + max(rows) * 0.025, f"{v:,}", ha="center", va="bottom", fontsize=14, weight="bold")
    ax.text(0.02, 0.92, "Signer split audit: 35 / 6 / 11 participants, with zero overlap", transform=ax.transAxes, fontsize=14)
    fig.text(0.02, 0.02, "Integrity checks passed; train/validation/test boundaries preserved.", fontsize=11)
    savefig(fig, out / "02_split_integrity.png")


def figure_engineering_tests(out: Path) -> None:
    fig, ax = plt.subplots(figsize=(13.33, 7.5))
    names = list(DATA["unit_tests"].keys())
    vals = list(DATA["unit_tests"].values())
    bars = ax.barh(names, vals)
    ax.invert_yaxis()
    ax.set_title("Automated engineering test coverage", fontsize=24, weight="bold", loc="left")
    ax.set_xlabel("Tests passed")
    ax.set_xlim(0, 9.5)
    ax.grid(axis="x", alpha=0.2)
    ax.set_axisbelow(True)
    for b, v in zip(bars, vals):
        ax.text(v + 0.15, b.get_y() + b.get_height() / 2, str(v), va="center", fontsize=14, weight="bold")
    total = sum(vals)
    ax.text(0.98, 0.05, f"{total}/{total} passed", transform=ax.transAxes, ha="right", fontsize=19, weight="bold")
    fig.text(0.02, 0.02, "Includes sampling, preprocessing, shard round-trips, model behavior, and handoff safety.", fontsize=11)
    savefig(fig, out / "03_engineering_tests.png")


def figure_benchmark(out: Path) -> None:
    fig = plt.figure(figsize=(13.33, 7.5))
    ax = fig.add_axes([0.08, 0.18, 0.56, 0.68])
    labels = ["Raw landmarks", "Float32 feature shards"]
    sizes = [DATA["benchmark"]["raw_mib"], DATA["benchmark"]["features_mib"]]
    bars = ax.bar(labels, sizes)
    ax.set_title("Feature representation shrinks storage", fontsize=24, weight="bold", loc="left", pad=14)
    ax.set_ylabel("Compressed storage (MiB)\n96 clips / 8,328 frames")
    ax.set_ylim(0, max(sizes) * 1.25)
    ax.grid(axis="y", alpha=0.2)
    ax.set_axisbelow(True)
    for b, v in zip(bars, sizes):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.9, f"{v:.2f} MiB", ha="center", fontsize=15, weight="bold")
    ratio = 100 * DATA["benchmark"]["features_mib"] / DATA["benchmark"]["raw_mib"]
    side = fig.add_axes([0.70, 0.23, 0.25, 0.55])
    side.axis("off")
    side.text(0.0, 0.86, f"{ratio:.1f}%", fontsize=31, weight="bold")
    side.text(0.0, 0.74, "of raw storage retained", fontsize=13)
    side.text(0.0, 0.51, f"{DATA['benchmark']['seconds']/60:.1f} min", fontsize=24, weight="bold")
    side.text(0.0, 0.40, "for 96 clips", fontsize=13)
    side.text(0.0, 0.17, f"~{DATA['benchmark']['seconds']/DATA['benchmark']['clips']:.1f} s/clip", fontsize=21, weight="bold")
    side.text(0.0, 0.06, "CPU benchmark", fontsize=13)
    fig.text(0.08, 0.07, f"Single-worker full-split projection: ~{DATA['benchmark']['projection_days']:.1f} days — a rough planning estimate, not a measured full run.", fontsize=11)
    savefig(fig, out / "04_extraction_storage.png")


def figure_model_comparison(out: Path) -> None:
    fig, ax = plt.subplots(figsize=(13.33, 7.5))
    labels = [x[0] for x in DATA["val_compare"]]
    means = [x[1] for x in DATA["val_compare"]]
    sds = [x[2] for x in DATA["val_compare"]]
    x = np.arange(len(labels))
    bars = ax.bar(x, means, yerr=sds, capsize=6)
    ax.set_xticks(x, labels)
    ax.set_ylabel("Validation top-1 accuracy (%)")
    ax.set_ylim(0, 100)
    ax.set_title("Sequence model learns substantially more signal than the baseline", fontsize=23, weight="bold", loc="left", pad=14)
    ax.grid(axis="y", alpha=0.2)
    ax.set_axisbelow(True)
    for b, m, s in zip(bars, means, sds):
        ax.text(b.get_x() + b.get_width()/2, m + s + 2, f"{m:.1f}%", ha="center", fontsize=15, weight="bold")
    fig.text(0.08, 0.865, f"3 seeds · 320 training clips · 119 validation clips · 32 classes · augmentation gain +{means[0] - means[1]:.1f} pp", fontsize=11)
    fig.text(0.02, 0.02, "Error bars = sample SD across seeds. Validation support is only 3–5 clips per class.", fontsize=11)
    savefig(fig, out / "05_model_validation_comparison.png")


def figure_generalization(out: Path) -> None:
    fig, ax = plt.subplots(figsize=(13.33, 7.5))
    labels = ["Expanded validation", "Signer-grouped CV", "Official test"]
    top1 = [DATA["frozen_val"]["top1"], DATA["signer_cv"]["top1"], DATA["test"]["top1"]]
    top5 = [DATA["frozen_val"]["top5"], np.nan, DATA["test"]["top5"]]
    x = np.arange(len(labels))
    width = 0.34
    b1 = ax.bar(x - width/2, top1, width, label="Top-1")
    mask = ~np.isnan(top5)
    b2 = ax.bar(x[mask] + width/2, np.array(top5)[mask], width, label="Top-5")
    ax.set_xticks(x, labels)
    ax.set_ylim(0, 105)
    ax.set_ylabel("Accuracy (%)")
    ax.set_title("Generalization: performance declines under stricter isolation", fontsize=23, weight="bold", loc="left", pad=14)
    ax.grid(axis="y", alpha=0.2)
    ax.set_axisbelow(True)
    for b, v in zip(b1, top1):
        ax.text(b.get_x()+b.get_width()/2, v+2, f"{v:.1f}%", ha="center", fontsize=14, weight="bold")
    for b, v in zip(b2, np.array(top5)[mask]):
        ax.text(b.get_x()+b.get_width()/2, v+2, f"{v:.1f}%", ha="center", fontsize=14, weight="bold")
    ax.legend(frameon=False, loc="lower left")
    fig.text(0.08, 0.865, "Expanded-training mean top-1 = 85.71% · signer-grouped CV holds out whole signers", fontsize=11)
    fig.text(0.02, 0.02, "The gap is informative, but these are different evaluation protocols—not a statistically matched comparison.", fontsize=11)
    savefig(fig, out / "06_generalization.png")


def figure_test(out: Path) -> None:
    fig = plt.figure(figsize=(13.33, 7.5))
    ax = fig.add_axes([0.08, 0.18, 0.60, 0.68])
    metrics = ["Top-1", "Top-5", "Macro top-1"]
    vals = [DATA["test"]["top1"], DATA["test"]["top5"], DATA["test"]["macro"]]
    bars = ax.bar(metrics, vals)
    ax.set_ylim(0, 100)
    ax.set_ylabel("Accuracy (%)")
    ax.set_title("Frozen official-test result", fontsize=24, weight="bold", loc="left", pad=14)
    ax.grid(axis="y", alpha=0.2)
    ax.set_axisbelow(True)
    for b, v in zip(bars, vals):
        ax.text(b.get_x()+b.get_width()/2, v+2, f"{v:.2f}%", ha="center", fontsize=16, weight="bold")
    side = fig.add_axes([0.73, 0.24, 0.22, 0.52])
    side.axis("off")
    side.text(0.0, 0.84, f"{DATA['test']['correct1']}/{DATA['test']['samples']}", fontsize=25, weight="bold")
    side.text(0.0, 0.74, "top-1 correct", fontsize=13)
    side.text(0.0, 0.51, f"{DATA['test']['correct5']}/{DATA['test']['samples']}", fontsize=25, weight="bold")
    side.text(0.0, 0.41, "contained in top-5", fontsize=13)
    side.text(0.0, 0.17, "32 classes · seed 42\none-time evaluation", fontsize=13, weight="bold")
    fig.text(0.08, 0.07, "Clean headline result for the pilot; not a full-dataset evaluation. The 388 test examples were consumed for this frozen evaluation.", fontsize=11)
    savefig(fig, out / "07_frozen_test.png")


def figure_scorecard(out: Path) -> None:
    fig = plt.figure(figsize=(13.33, 7.5))
    fig.patch.set_facecolor("white")
    fig.text(0.03, 0.92, "ASL Citizen pilot — results at a glance", fontsize=26, weight="bold")
    cards = [
        ("22 / 22", "automated tests passed"),
        ("592", "train + validation clips processed"),
        ("49,383", "frames in compact feature shards"),
        ("85.71%", "3-seed validation top-1"),
        ("80.55%", "signer-grouped CV top-1"),
        ("75.00%", "frozen official-test top-1"),
    ]
    positions = [(0.03, 0.60), (0.36, 0.60), (0.69, 0.60), (0.03, 0.23), (0.36, 0.23), (0.69, 0.23)]
    for (big, small), (x, y) in zip(cards, positions):
        ax = fig.add_axes([x, y, 0.27, 0.23])
        ax.axis("off")
        for spine in ax.spines.values():
            spine.set_visible(True)
            spine.set_linewidth(1.2)
        ax.text(0.06, 0.58, big, fontsize=25, weight="bold", va="center")
        ax.text(0.06, 0.20, small, fontsize=11, va="center")
    fig.text(0.03, 0.05, "Pilot scope: 32 glosses. Official test subset: 388 clips. Test was run once after freezing the seed-42 checkpoint.", fontsize=11)
    fig.savefig(out / "01_scorecard.png", dpi=220, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate ASL Citizen results figures for presentation.")
    parser.add_argument("--out", type=Path, default=Path("asl_citizen_figures"), help="Output directory")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    figure_scorecard(args.out)
    figure_split_integrity(args.out)
    figure_engineering_tests(args.out)
    figure_benchmark(args.out)
    figure_model_comparison(args.out)
    figure_generalization(args.out)
    figure_test(args.out)
    print(f"Wrote figures to {args.out.resolve()}")


if __name__ == "__main__":
    main()
