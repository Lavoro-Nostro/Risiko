# Work Tracking

Use `RISIKO_MASTER_PLAN.md` as the master plan and map work items to RIS IDs.

Recommended status board columns:
- TODO
- IN_PROGRESS
- BLOCKED
- DONE

## Current Sprint Snapshot

- RIS-STEP-001: DONE
- RIS-STEP-002: DONE
- RIS-STEP-003: DONE
- RIS-STEP-004: DONE
- RIS-STEP-005: DONE
- RIS-STEP-006: DONE
- RIS-STEP-007: DONE
- RIS-STEP-008: DONE
- RIS-STEP-009: DONE
- RIS-STEP-010: DONE
- RIS-STEP-011: DONE
- RIS-STEP-012: DONE
- RIS-STEP-013: DONE
- RIS-STEP-014: DONE
- RIS-STEP-015: DONE
- RIS-STEP-016: DONE
- RIS-STEP-017: DONE
- RIS-STEP-018: DONE
- RIS-STEP-019: DONE
- RIS-STEP-020: IN_PROGRESS

## Next Work Package: Dice Combat

- RSK-DICE-EPIC-001: IN_PROGRESS
- RSK-DICE-STEP-001: DONE
- RSK-DICE-STEP-002: DONE
- RSK-DICE-STEP-003: DONE
- RSK-DICE-STEP-004: DONE
- RSK-DICE-STEP-005: DONE
- RSK-DICE-STEP-006: TODO
- RSK-DICE-STEP-007: DONE
- RSK-DICE-STEP-008: DONE
- RSK-DICE-STEP-009: DONE
- RSK-DICE-STEP-010: DONE
- RSK-DICE-STEP-011: IN_PROGRESS
- RSK-DICE-STEP-012: IN_PROGRESS
- RSK-DICE-STEP-013: TODO
- RSK-DICE-STEP-014: TODO
- RSK-DICE-STEP-015: TODO

## Branch

- Active implementation branch for current work:
- `feature/ris-step-020-mvp-release-gate`

## Match QA Action Plan (2026-02-17)

Legend:
- Priority: `P0` critical, `P1` high, `P2` medium
- Status: `TODO | IN_PROGRESS | BLOCKED | DONE`

| ID | Priority | Status | Area | Action Item | Done Criteria |
|---|---|---|---|---|---|
| RSK-QA-001 | P0 | DONE | Map/UX | Fix sea connection lines (wrong positions/routes) using only curated official links. | No misplaced sea links in full world view. |
| RSK-QA-002 | P0 | DONE | Map/UX | Remove visual Alaska-Kamchatka sea line while keeping gameplay adjacency active. | Move/attack still works; no visible line between Alaska-Kamchatka. |
| RSK-QA-003 | P0 | DONE | Map/UX | Draw sea links from territory edge anchors (not random mid-map points), keep lines behind map overlay. | Each sea link starts/ends near correct territory edge; lines stay visually unobtrusive. |
| RSK-QA-004 | P0 | IN_PROGRESS | Map/Zoom | Fix zoom scaling behavior for territory labels and army chips. | Labels/chips remain readable and scale predictably across min/max zoom. |
| RSK-QA-005 | P0 | DONE | Turn Rules/UI | Hide attack controls panel when it is not player turn. | Non-active players never see active attack controls. |
| RSK-QA-006 | P0 | DONE | Multiplayer Events | Broadcast attack/move context to all players (source, target, state). | All players see who attacks what in real time. |
| RSK-QA-007 | P0 | DONE | Multiplayer Events | Broadcast dice/combat overlays to all players, not only attacker. | Every player sees same combat animation/outcome. |
| RSK-QA-008 | P0 | DONE | Rules/Cards | Fix card trade-in logic: valid 3-of-a-kind set must work. | `XXX`, `YYY`, `ZZZ` style sets validate and redeem correctly. |
| RSK-QA-009 | P0 | DONE | Session/Auth | Prevent duplicate join from same client via back/rejoin name flow. | Single active seat per client identity/lobby slot. |
| RSK-QA-010 | P1 | IN_PROGRESS | Feedback | Add clear action feedback for reinforce/attack/fortify (actor + target + result). | Users can always tell what action just happened. |
| RSK-QA-011 | P1 | DONE | Labels/Layout | Resolve territory-name overlap with army tank/chip. | No label-chip overlap in default zoom on all territories. |
| RSK-QA-012 | P1 | DONE | Animation | Add clear army change animation (+reinforce, -loss, capture transfer). | Army delta is visually obvious on every update. |
| RSK-QA-013 | P1 | DONE | Lobby UX | Redesign entry flow: simple `Host` / `Join` with name and lobby code. | User can host/join in <= 2 steps with minimal confusion. |
| RSK-QA-014 | P1 | DONE | Dock UX | Redesign bottom dock to reduce height (peek/hover-expand card hand). | Dock uses significantly less vertical space when idle. |
| RSK-QA-015 | P1 | DONE | Overlay UX | Redesign attack overlays for clarity (source/target emphasis, cleaner style). | Attack intent and selected targets are instantly clear. |
| RSK-QA-016 | P1 | TODO | Sync/Netcode | Add loading/sync gate to avoid early-match desync during player load. | Match start waits until all clients confirm ready state. |
| RSK-QA-017 | P2 | DONE | Objective UI | Make objective card zoomable/readable from bottom hand panel. | Objective card can be enlarged and read without opening dev tools. |
| RSK-QA-018 | P2 | DONE | Network UX | Auto-resolve host URL for local clients where possible. | Host/join flow defaults to reachable URL when environment allows. |
| RSK-QA-019 | P2 | DONE | Combat UX | Prototype cleaner temporary attack dice selector UI (pre-final design). | Dice selection interaction is simpler and visually coherent. |
| RSK-QA-020 | P0 | DONE | Rules/Cards | Implement Joker card behavior exactly per `docs/02-game-design/final-ruleset-objective.md` (trade-in validity + bonus). | Joker sets and bonus values match documented rules in engine + UI validation. |

## Suggested Implementation Order

1. `RSK-QA-005` `RSK-QA-006` `RSK-QA-007` `RSK-QA-009` (multiplayer correctness first)
2. `RSK-QA-001` `RSK-QA-002` `RSK-QA-003` `RSK-QA-004` (map/zoom correctness)
3. `RSK-QA-008` `RSK-QA-010` `RSK-QA-011` `RSK-QA-012` (rules + clarity)
4. `RSK-QA-013` `RSK-QA-014` `RSK-QA-015` `RSK-QA-016` `RSK-QA-017` `RSK-QA-018` `RSK-QA-019` (polish)
5. `RSK-QA-020` (joker rules hardening + parity tests)

## Expanded Breakdown (Execution Subtasks)

| Sub-ID | Parent | Status | Task |
|---|---|---|---|
| RSK-QA-005-A | RSK-QA-005 | DONE | Gate attack panel render by `isMyTurn && phase === attack`. |
| RSK-QA-005-B | RSK-QA-005 | DONE | Gate fortify/reinforce controls by active player only. |
| RSK-QA-006-A | RSK-QA-006 | DONE | Emit shared "combat intent" event (from/to/player/phase). |
| RSK-QA-006-B | RSK-QA-006 | DONE | Show non-interactive spectator overlay for all non-acting clients. |
| RSK-QA-007-A | RSK-QA-007 | DONE | Broadcast dice roll animation payload through room session stream. |
| RSK-QA-007-B | RSK-QA-007 | DONE | Synchronize popup open/close timers for all clients. |
| RSK-QA-008-A | RSK-QA-008 | DONE | Fix trade-set validator for 3-of-a-kind + wildcard combinations. |
| RSK-QA-008-B | RSK-QA-008 | DONE | Add tests for all legal/illegal tris combinations. |
| RSK-QA-009-A | RSK-QA-009 | DONE | Introduce client session token and reject duplicate active joins. |
| RSK-QA-009-B | RSK-QA-009 | DONE | Handle back/reload rejoin as seat-resume, not new participant. |
| RSK-QA-001-A | RSK-QA-001 | DONE | Keep only curated official sea-link list (no geometry inference). |
| RSK-QA-001-B | RSK-QA-001 | DONE | Add per-link routing hints (bend, side, wrap) for deterministic rendering. |
| RSK-QA-004-A | RSK-QA-004 | DONE | Calibrate text/chip zoom curve with min/max clamps by viewport width. |
| RSK-QA-004-B | RSK-QA-004 | DONE | Add quick visual regression checklist for min/avg/max zoom. |
| RSK-QA-011-A | RSK-QA-011 | DONE | Add automatic label displacement away from owner chip radius. |
| RSK-QA-011-B | RSK-QA-011 | DONE | Add manual override tuning table for known problematic territories. |
| RSK-QA-012-A | RSK-QA-012 | DONE | Animate reinforce (`+N`) and losses (`-N`) with short timed fade/float. |
| RSK-QA-012-B | RSK-QA-012 | DONE | Animate capture transfer count after successful conquest. |
| RSK-QA-020-A | RSK-QA-020 | DONE | Align engine trade validator to rules doc for Joker permutations and limits. |
| RSK-QA-020-B | RSK-QA-020 | DONE | Align frontend `isValidTradeSet` logic to same Joker rules as engine. |
| RSK-QA-020-C | RSK-QA-020 | DONE | Add engine tests for Joker sets (valid/invalid) and bonus calculation parity. |
| RSK-QA-020-D | RSK-QA-020 | DONE | Add UI tests/checklist to ensure user can select and redeem valid Joker tris. |

Rule reference:
- `docs/02-game-design/final-ruleset-objective.md` (section: trade-in `tris`, valid sets, Joker behavior).

