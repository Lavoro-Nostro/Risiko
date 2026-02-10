# Contributing

## Branching
- Long-lived branches:
- `stable`: production-ready, tagged releases only.
- `main`: release-candidate integration branch.
- `dev`: day-to-day integration branch for completed features.
- Short-lived branches:
- `feature/<ris-id>-<short-name>` from `dev` for new work.
- `fix/<ris-id>-<short-name>` from `dev` for non-production fixes.
- `hotfix/<short-name>` from `stable` for urgent production fixes.
- PR required for every merge (no direct pushes to `dev`, `main`, `stable`).

## Merge Flow
- `feature/*` and `fix/*` -> `dev`
- `dev` -> `main` when sprint/release candidate is ready
- `main` -> `stable` when validated for production
- `hotfix/*` -> `stable`, then back-merge into `main` and `dev`

## Naming
- Use lowercase branch names.
- Prefix technical work with RIS IDs when available.
- Examples:
- `feature/ris-step-009-webrtc-signaling`
- `fix/ris-qa-003-reconnect-sequence`
- `hotfix/host-timeout-crash`

## Protection Rules (GitHub)
- `stable`: require PR, at least 1 approval, status checks, no force push.
- `main`: require PR, status checks, no force push.
- `dev`: require PR, optional squash merge, no force push.

## Commit style
- Conventional commit style preferred

## Review focus
- Correctness
- Regression risk
- Tests and traceability to RIS IDs
