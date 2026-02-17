# Documentation Index

This repository has grown quickly. This file defines the canonical doc structure and where to edit each topic.

## Source Of Truth (Priority Order)

1. Rules and gameplay behavior
   - `docs/02-game-design/final-ruleset-objective.md`
   - `docs/02-game-design/rules-core.md`
2. Contracts and architecture
   - `docs/03-architecture/*`
   - `docs/04-networking/*`
3. Execution planning and delivery tracking
   - `RISIKO_MASTER_PLAN.md` (program-level direction and ID model)
   - `WORK_TRACKING.md` (active implementation board and QA action plan)
   - `docs/07-planning/*` (supporting roadmap/backlog/risks/issues)

If two docs disagree, update the lower-priority doc to match the higher-priority one.

## Quick Navigation

- Product
  - `docs/01-product/vision.md`
  - `docs/01-product/scope-mvp.md`
- Game rules and UX states
  - `docs/02-game-design/final-ruleset-objective.md`
  - `docs/02-game-design/turn-phases.md`
  - `docs/02-game-design/ui-states.md`
- Architecture and engine model
  - `docs/03-architecture/system-overview.md`
  - `docs/03-architecture/domain-model.md`
  - `docs/03-architecture/event-model.md`
- Networking
  - `docs/04-networking/protocol-contract.md`
  - `docs/04-networking/reconnect-strategy.md`
- Content packs
  - `docs/05-content-packs/pack-spec.md`
  - `docs/05-content-packs/map-json-schema.md`
- Quality and release
  - `docs/06-quality/test-strategy.md`
  - `docs/06-quality/release-gates.md`
- Planning and operations
  - `docs/07-planning/README.md`
  - `WORK_TRACKING.md`

## Documentation Hygiene Rules

- Keep docs actionable and implementation-oriented.
- Prefer IDs (`RIS-*`, `RSK-*`, `KI-*`) for traceability.
- Avoid duplicating the same requirement in multiple files.
- When behavior changes:
  1. update rules/contract docs first,
  2. then update planning/tracking docs,
  3. then update changelog/release notes.
