# Dataset Usage Policy

Own Your Voice uses publicly available research datasets and related resources to study American Sign Language recognition.

This document describes how datasets should be accessed, stored, used, and documented within the project.

## 1. Current Dataset Use

### ASL Citizen

ASL Citizen is the primary dataset currently used for the project's isolated-sign recognition and Dev Stage 2 experiments.

The dataset contains approximately 84,000 videos representing approximately 2,700 isolated ASL signs and includes recordings from Deaf and hard-of-hearing contributors.

Within Own Your Voice, ASL Citizen has been used for:

- MediaPipe landmark extraction
- isolated-sign recognition experiments
- train, validation, and test split evaluation
- synthetic sentence construction
- CTC sentence-model research

Raw ASL Citizen videos are not stored in this public GitHub repository.

### Other Research Sources

The following datasets or resources have also been investigated as possible research sources:

- WLASL
- Google Isolated Sign Language Recognition competition data
- Boston University ASLLRP Sign Bank

Listing a dataset in this repository does not necessarily mean it has been used to train the current model.

The team should document when a dataset moves from a research candidate to an actively used training or evaluation source.

## 2. Repository Storage Policy

The public GitHub repository may contain:

- source code
- scripts
- aggregate model metrics
- experiment results
- charts and figures
- documentation
- small metadata files when permitted

The repository should not contain:

- raw participant videos
- complete copies of restricted datasets
- model-training datasets that cannot legally be redistributed
- personally identifying participant information
- API credentials or access tokens

Large datasets should remain in approved research or project storage rather than GitHub.

## 3. Dataset Licensing

Every dataset must be used according to its original license, terms of use, and participant-consent requirements.

Before adding a new dataset, the team should verify:

1. whether academic or research use is permitted;
2. whether commercial use is permitted;
3. whether the dataset may be redistributed;
4. whether modified or derived versions may be distributed;
5. whether attribution or citation is required;
6. whether there are restrictions involving participant identity;
7. whether there are retention or deletion requirements.

If the terms are unclear, the dataset should not be redistributed through this repository until the team confirms the applicable requirements.

## 4. ASL Citizen Privacy and Ethical Use

ASL Citizen should be used only for purposes consistent with its research goals and participant-consent framework.

The project will not use ASL Citizen to:

- identify or re-identify dataset participants;
- perform facial recognition;
- infer sensitive characteristics about participants;
- create deepfakes or impersonations;
- develop surveillance or identity-tracking systems.

Own Your Voice is intended as a communication-support research project.

The project should not represent ASL-recognition technology as a replacement for qualified interpreters, Deaf educators, or other accessibility accommodations.

## 5. WLASL

WLASL is intended for academic and computational research use and is governed by its Computational Use of Data Agreement.

If WLASL is used in future experiments:

- its original terms must be reviewed before downloading or processing the videos;
- the dataset should not be used commercially unless its terms explicitly allow it;
- videos should not be redistributed through the Own Your Voice repository;
- publications or presentations using WLASL should cite the original WLASL research.

## 6. Google ASL Signs Competition Data

Google's Isolated Sign Language Recognition competition provides MediaPipe landmark data rather than the original participant video.

If this dataset is used, the team must follow the applicable Kaggle competition and data-access rules.

Landmark data should not be used to identify or re-identify participants.

Because the competition rules contain additional data-access and redistribution requirements, the dataset should not be copied into the Own Your Voice public repository without first confirming that redistribution is allowed.

## 7. Boston University ASLLRP Sign Bank

The ASLLRP Sign Bank provides ASL video resources for research.

If Sign Bank data is used:

- the original video data should not be redistributed;
- commercial use requires appropriate permission;
- required attribution should be provided;
- users who need access should obtain the data through the original source rather than through this repository.

## 8. Participant Privacy

Video-based sign-language datasets may contain identifiable human participants.

The project should therefore minimize unnecessary exposure of raw video.

Where practical, model development should use derived representations such as:

- hand landmarks
- pose landmarks
- facial landmarks
- numerical feature tensors

Derived representations should still be treated responsibly because they originate from human-participant data.

## 9. Train, Validation, and Test Integrity

Dataset partitions should remain reproducible and isolated.

The team should document:

- dataset version;
- vocabulary used;
- number of participants;
- train/validation/test splits;
- whether signers overlap between splits;
- whether evaluation samples were used during model development.

A sealed test set should not be repeatedly used for model tuning.

For the current ASL Citizen work, the official test split is intentionally kept separate until the final model is frozen.

## 10. Derived Data and Model Outputs

Derived files such as landmarks, feature tensors, embeddings, or model checkpoints should not automatically be assumed safe to publish.

Before releasing derived data, the team should confirm:

- that the original dataset license permits the release;
- that the derived representation does not violate participant-use restrictions;
- that the files do not enable reconstruction or identification beyond what the original license allows.

Aggregate metrics, charts, and research findings may be published when permitted without redistributing restricted underlying data.

## 11. External AI Services

When model outputs are sent to external AI services, the minimum information necessary should be transmitted.

For the current Dev Stage 2 contextual-language experiment, the language-model stage receives predicted ASL glosses, candidate probabilities, and contextual information rather than raw signing video.

Raw research videos should not be transmitted to external AI services unless the dataset terms clearly permit that use.

## 12. Attribution

Research datasets should be cited according to their official documentation.

Attribution should be included in presentations, reports, publications, and repository documentation when required.

## 13. Dataset Review Checklist

Before the team adopts a new dataset, verify:

- [ ] Source is legitimate and documented
- [ ] License or terms of use have been reviewed
- [ ] Academic/research use is permitted
- [ ] Redistribution rules are understood
- [ ] Commercial-use restrictions are understood
- [ ] Participant privacy restrictions are understood
- [ ] Required citations have been recorded
- [ ] Dataset will not be committed to GitHub unless permitted
- [ ] Train/validation/test methodology is documented
- [ ] Any external AI-service use is compatible with the dataset terms

## 14. Current Project Principle

Own Your Voice follows a data-minimization approach:

**Use the minimum amount of participant data necessary for the research task, keep restricted source data out of the public repository, document where data came from, and respect the license and consent requirements attached to every dataset.**
