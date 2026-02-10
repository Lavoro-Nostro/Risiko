# MVP Candidate Release Notes (Draft)

Release line:
- `0.4.0-mvp-candidate`

Scope:
- Host-authoritative turn flow is available end-to-end.
- Web map supports ownership, armies, turn actions, tactical panels, and event-driven animations.
- UX hardening added for blocked actions, validation feedback, and sync-state overlays.

## Included RIS Steps
- RIS-STEP-016: Turn phase controls.
- RIS-STEP-017: Tactical context panels.
- RIS-STEP-018: Baseline event animations.
- RIS-STEP-019: UX hardening and clearer invalid-action messaging.
- RIS-STEP-020: MVP release gate artifacts and integration validation.

## Quality Summary
- Automated tests:
  - `Risk.Engine.Tests`: deterministic rules and replay.
  - `Risk.Host.Tests`: room lifecycle, command flow, reconnect, event ordering.
  - `Risk.Web`: map binding and visual-state tests.
- Manual tests:
  - See `docs/06-quality/manual-multiplayer-test-pass.md`.

## Known Issues
- See `docs/07-planning/known-issues.md`.

## Rollout Decision
- Final decision pending completion of 2/4/6 player manual pass.
