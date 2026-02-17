# RISIKO Master Plan

Version: 2.0  
Status: Active  
Last updated: 2026-02-17

This file is the program-level source of truth for execution structure and IDs.  
Detailed status lives in `WORK_TRACKING.md`.

## 1) Purpose

- Deliver a stable, host-authoritative, browser-based Risiko experience.
- Keep rules deterministic and synchronized across all clients.
- Ship MVP with one polished classic map, then expand safely.

## 2) Canonical Document Map

- Program direction: `RISIKO_MASTER_PLAN.md` (this file)
- Active implementation board: `WORK_TRACKING.md`
- Rules and gameplay behavior: `docs/02-game-design/final-ruleset-objective.md`
- Architecture and contracts: `docs/03-architecture/*`, `docs/04-networking/*`
- QA planning and known issues: `docs/07-planning/*`
- Full docs index: `docs/README.md`

## 3) ID Model

- `RIS-REQ-###` product requirements
- `RIS-ARC-###` architecture decisions
- `RIS-MS-###` milestones
- `RIS-STEP-###` implementation steps
- `RIS-RISK-###` risks
- `RIS-QA-###` quality gates
- `RSK-*` operational execution items (used in `WORK_TRACKING.md`)
- `KI-*` known-issues register items (used in `docs/07-planning/known-issues.md`)

## 4) Status and Priority Model

Status values:
- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

Priority values:
- `P0` critical for MVP stability
- `P1` high value, post-stability
- `P2` medium value, polish/expansion

## 5) Current Program Milestones

- `RIS-MS-001` Foundation
  - Engine contracts/state/command flow established.
- `RIS-MS-002` Core gameplay
  - Reinforce/attack/fortify/end-turn cycle integrated.
- `RIS-MS-003` Content pipeline
  - Classic map pack and card pack loading operational.
- `RIS-MS-004` Multiplayer reliability (active)
  - Visibility parity, turn-gated UI, sync correctness.
- `RIS-MS-005` UX stabilization (active)
  - Map readability, overlays, dock, feedback clarity.
- `RIS-MS-006` MVP release gate (pending)
  - Release criteria in `docs/06-quality/release-gates.md`.

## 6) MVP Critical Streams (Now)

- Multiplayer correctness
  - All players must see attack intent, dice, and outcomes.
- Turn authority UX
  - Action controls only for active player.
- Card rules correctness
  - Tris and joker behavior must match rules document.
- Session integrity
  - Duplicate join/backflow must not create phantom seats.
- Map/zoom coherence
  - Sea links deterministic; labels/chips readable and non-overlapping.

Operational IDs for these streams are tracked in `WORK_TRACKING.md` (`RSK-QA-*`).

## 7) Governance Rules

- If behavior changes, update docs in this order:
  1. rules/contracts docs,
  2. implementation tracking (`WORK_TRACKING.md`),
  3. release notes/changelog.
- Avoid duplicate status boards across files.
- Use IDs in commits/PRs when possible for traceability.
