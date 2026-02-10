# Release Gates

## RIS-MS-001 Gate A: Engine Ready
- `dotnet test Risiko.slnx -c Release` passes.
- Replay consistency is covered by engine event-sourcing tests.
- No known P0 defects in command validation or phase progression.

## RIS-MS-004 Gate B: Online Ready
- Host command pipeline integration tests pass.
- Event ordering and cursor-based fetch behavior are verified.
- Reconnect token flow is verified in host integration tests.
- Room lifecycle (`create`, `join`, `leave`, `start`) tests pass.

## RIS-STEP-020 Gate C: MVP Candidate
- Manual multiplayer test pass completed for 2, 4, and 6 players.
- Known issues register updated and triaged (`docs/07-planning/known-issues.md`).
- Candidate release notes prepared (`docs/06-quality/mvp-candidate-release-notes.md`).
- No unresolved P0 security or gameplay integrity issues.

## Required Evidence
- Automated test output attached in PR checks.
- Manual test checklist with date and tester initials.
- Changelog and release notes updated for candidate scope.
