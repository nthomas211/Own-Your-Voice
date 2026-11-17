# Privacy, Security, and Responsible AI

Own Your Voice may process signing video, landmark coordinates, predicted ASL glosses, spoken language, and generated text.

The project follows a data-minimization approach designed to reduce unnecessary collection and exposure of sensitive information.

## Local Video Processing

The SignBridge browser prototype processes webcam video locally using MediaPipe.

Raw webcam video is not intentionally uploaded by the prototype.

MediaPipe must process the video to extract hand and pose landmarks, but the recognition system operates on the resulting numerical features rather than storing the original video.

## Research Data

Large ASL datasets and raw participant recordings are not stored directly in this public GitHub repository.

The repository contains:

- source code
- research documentation
- aggregate results
- model metrics
- figures

Raw research datasets should remain in approved storage and be handled according to their individual licenses and consent requirements.

## Language Model Processing

In the current Dev Stage 2 evaluation pipeline, the contextual language-model step receives model outputs such as:

- predicted glosses
- alternative candidate glosses
- probabilities
- sentence context

It does not require raw signing video for contextual correction.

Conversation content may still be sensitive, so only the minimum necessary information should be transmitted to external services.

## Credential Protection

Credentials must never be committed to the repository.

The project `.gitignore` excludes items such as:

- `.env`
- `.pem`
- `.key`
- model checkpoints
- raw datasets

API keys should be supplied using environment variables or another secure secret-management mechanism.

## Model Transparency

Machine-learning predictions are probabilistic and may be incorrect.

The application should avoid presenting uncertain predictions as guaranteed translations.

Future versions should provide:

- confidence or match scores
- alternative predictions
- user correction controls
- clear indication when the model is uncertain

## User Control

The AI should assist communication rather than determine what the user intends to say.

Users should be able to:

- correct a predicted sign
- reject an incorrect translation
- clear stored data
- control when the camera is active
- control what information is transmitted to external services

## Current Security Review

The browser prototype supports importing vocabulary JSON files.

Imported data must be treated as untrusted input.

User-controlled values should not be inserted directly into HTML without validation or escaping.
