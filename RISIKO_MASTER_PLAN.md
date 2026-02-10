Risiko Master Plan - Product and Execution

Version: 1.0
Status: Draft for implementation
Scope: MVP first, expansion-ready architecture

==================================================
0) ID SYSTEM AND TRACKING MODEL
==================================================

ID format:
- Vision/requirements: RIS-REQ-###
- Architecture/technical decisions: RIS-ARC-###
- Build steps/tasks: RIS-STEP-###
- Milestones: RIS-MS-###
- Risks: RIS-RISK-###
- Tests/quality gates: RIS-QA-###

Task status values:
- TODO
- IN_PROGRESS
- BLOCKED
- DONE

Priority values:
- P0 (must-have for MVP)
- P1 (important post-MVP)
- P2 (future enhancement)

==================================================
1) PRODUCT DEFINITION
==================================================

RIS-REQ-001 [P0]
Goal:
- Deliver a browser-based, turn-based strategy game inspired by classic Risk.
Outcome:
- Players can complete full matches using Reinforce, Attack, Fortify, End Turn.

RIS-REQ-002 [P0]
Core experience pillars:
- Clear map readability.
- Deterministic and fair rule resolution.
- Responsive turn-based UX.
- Stable online multiplayer.

RIS-REQ-003 [P0]
MVP game modes:
- Local hotseat.
- Online real-time multiplayer.

RIS-REQ-004 [P1]
Post-MVP game modes:
- Async turn-based multiplayer.
- AI opponents.
- Custom scenarios and fog-of-war variants.

RIS-REQ-005 [P0]
MVP rules:
- Territory ownership and army counts.
- Reinforcement from territory count and continent bonus.
- Dice-based attacks.
- One fortification move per turn.

RIS-REQ-006 [P1]
Cards:
- Optional at MVP boundary.
- Full trade-in system in post-MVP phase.

RIS-REQ-007 [P0]
Custom content:
- Data-driven map packs with SVG + JSON metadata.

==================================================
2) TECHNICAL TARGET STATE
==================================================

RIS-ARC-001 [P0]
Repository modules:
- /Risk.Engine (C# core rules and state transitions).
- /Risk.Host (host-authority runtime + WebRTC signaling).
- /Risk.Web (React + TypeScript client).
- /packs (maps, localization, future rulesets).

RIS-ARC-002 [P0]
Authority model:
- Host-authoritative P2P simulation.
- Non-host peers submit commands to host only.
- Host validates commands and emits events.

RIS-ARC-003 [P0]
State model:
- Event-sourced match history.
- Rebuild state by replaying events.
- Deterministic RNG seed per match.

RIS-ARC-004 [P0]
Persistence:
- No dedicated match server for gameplay state.
- Optional lightweight signaling/presence service for room discovery and ICE exchange.
- Host peer stores live match state and ordered event log during the session.

RIS-ARC-005 [P0]
Map model:
- SVG for render geometry.
- map.json for adjacency, continents, bonuses.

==================================================
3) MVP IMPLEMENTATION PLAN (ORDERED STEPS)
==================================================

RIS-MS-001
Milestone: Foundation complete
Exit criteria:
- Engine compiles.
- Core entities and command/event contracts defined.
- Baseline tests running in CI/local.

RIS-STEP-001 [P0] (depends: none)
Create solution and projects:
- Risk.Engine class library.
- Risk.Host module.
- Risk.Web React+TypeScript app.
Deliverables:
- Buildable multi-project solution.

RIS-STEP-002 [P0] (depends: RIS-STEP-001)
Define shared domain contracts:
- PlayerId, TerritoryId, ContinentId value objects.
- Command DTOs and event DTOs.
- Phase enum and validation result model.
Deliverables:
- Versioned contracts with serialization-safe structures.

RIS-STEP-003 [P0] (depends: RIS-STEP-002)
Implement GameState model in Risk.Engine:
- Players, territories, armies, turn index, phase.
- Reinforcement pool and capture flag for turn.
- RNG seed and current round metadata.
Deliverables:
- Immutable or controlled-mutation state container.

RIS-STEP-004 [P0] (depends: RIS-STEP-003)
Implement command handlers:
- PlaceReinforcements.
- Attack.
- Fortify.
- EndTurn.
Deliverables:
- Validation + transition logic for each phase.

RIS-STEP-005 [P0] (depends: RIS-STEP-004)
Implement event emission and replay:
- Emit domain events from accepted commands.
- Rehydrate GameState from event log replay.
Deliverables:
- Event store interface + in-memory implementation.

RIS-STEP-006 [P0] (depends: RIS-STEP-005)
Add engine tests:
- Phase-order enforcement.
- Dice resolution constraints.
- Continent bonus application.
- Fortify connectivity path rule.
Deliverables:
- Deterministic unit test suite.

RIS-MS-002
Milestone: Engine gameplay complete
Exit criteria:
- Full turn loop works in engine tests.
- No invalid command can mutate state.

RIS-STEP-007 [P0] (depends: RIS-STEP-001)
Build map-pack loader:
- Load SVG and map.json from /packs/maps/<map-id>.
- Validate unique IDs and adjacency symmetry.
Deliverables:
- Map validation report with explicit failures.

RIS-STEP-008 [P0] (depends: RIS-STEP-007)
Create world-classic starter pack:
- map.svg with territory path IDs.
- map.json with territories, neighbors, continents, bonuses.
- en.json territory display names.
Deliverables:
- Playable canonical map pack.

RIS-MS-003
Milestone: Content pipeline ready
Exit criteria:
- Host and web client can load map metadata without manual edits.

RIS-STEP-009 [P0] (depends: RIS-STEP-001, RIS-STEP-002)
Create host networking layer and signaling service:
- WebRTC offer/answer and ICE exchange.
- Peer-to-host DataChannel setup per match.
- Host event broadcast pipeline.
Deliverables:
- Connected clients receive turn events in order.

RIS-STEP-010 [P0] (depends: RIS-STEP-009, RIS-STEP-005)
Wire host-authoritative command flow:
- Peer command -> host validation -> engine apply -> event log append -> host broadcast.
Deliverables:
- Rejected commands return reason codes.

RIS-STEP-011 [P0] (depends: RIS-STEP-010)
Implement room and match creation:
- Create room.
- Join/leave room.
- Start match with player list and map ID.
Deliverables:
- End-to-end path from room to active match.

RIS-STEP-012 [P0] (depends: RIS-STEP-010)
Implement reconnect support:
- Client reconnect handshake with match ID, peer ID, and player token.
- Replay missing events from last known sequence.
Deliverables:
- Player can resume match state after peer disconnect/reconnect while host remains online.

RIS-MS-004
Milestone: Online core ready
Exit criteria:
- 2-6 player online match playable without desync.

RIS-STEP-013 [P0] (depends: RIS-STEP-001, RIS-STEP-008)
Implement SVG map rendering in web client:
- Load and render map.svg.
- Bind territory IDs to metadata.
Deliverables:
- Visible interactive map.

RIS-STEP-014 [P0] (depends: RIS-STEP-013)
Add territory state visuals:
- Neutral/owned/hover/selectable/selected/under-attack/captured.
Deliverables:
- Consistent state-driven CSS classes and transitions.

RIS-STEP-015 [P0] (depends: RIS-STEP-013, RIS-STEP-010)
Bind live game state to map:
- Owner color per territory.
- Army count overlays.
- Selected territory and neighbor highlighting.
Deliverables:
- UI reflects authoritative host state only.

RIS-STEP-016 [P0] (depends: RIS-STEP-015)
Build turn phase controls:
- Reinforce controls and remaining-armies counter.
- Attack controls and dice chooser.
- Fortify controls with path/amount selector.
- End turn action.
Deliverables:
- Complete player action panel.

RIS-STEP-017 [P0] (depends: RIS-STEP-015)
Add side/top info panels:
- Player order and active player.
- Current phase indicator.
- Territory detail panel.
- Combat preview panel.
Deliverables:
- Full tactical context on a single screen.

RIS-MS-005
Milestone: MVP UI complete
Exit criteria:
- User can play full match from browser with clear controls.

RIS-STEP-018 [P0] (depends: RIS-STEP-016, RIS-STEP-017)
Implement baseline animations:
- Dice roll.
- Attack flash.
- Army count transitions.
- Capture color sweep.
Deliverables:
- Animation timing tied to event stream sequence.

RIS-STEP-019 [P0] (depends: RIS-STEP-018)
Add UX hardening:
- Disabled controls for invalid phases.
- Clear error and validation messages.
- Loading/reconnect state overlays.
Deliverables:
- Reduced player confusion and safer interaction flow.

RIS-STEP-020 [P0] (depends: RIS-STEP-006, RIS-STEP-012, RIS-STEP-019)
MVP release gate:
- Integration tests for command/event flow.
- Manual multiplayer test pass (2, 4, 6 players).
- Known-issues register and release notes.
Deliverables:
- MVP candidate build.

RIS-MS-006
Milestone: MVP shipped
Exit criteria:
- Stable online classic rules on one map for 2-6 players.

==================================================
4) QUALITY PLAN
==================================================

RIS-QA-001 [P0]
Engine unit tests:
- Reinforcement calculation.
- Attack dice bounds and outcomes.
- Phase transition legality.
- Fortify path connectivity.

RIS-QA-002 [P0]
Protocol tests:
- Command schema compatibility.
- Event ordering guarantees.
- Duplicate command idempotency behavior.

RIS-QA-003 [P0]
E2E tests:
- Room creation to match start.
- Full turn cycle.
- Peer disconnect and reconnect recovery.

RIS-QA-004 [P0]
Performance checks:
- Map render budget on classic map.
- Event burst handling in attack-heavy turns.
- Memory growth over long matches.

RIS-QA-005 [P0]
Security checks:
- Host-side ownership/phase validation.
- Unauthorized match access rejection.
- Input sanitation for map pack metadata.

==================================================
5) RISKS AND MITIGATIONS
==================================================

RIS-RISK-001 [P0]
Risk:
- Multiplayer desync.
Mitigation:
- Host-authoritative state + event sequence numbers + replay support.

RIS-RISK-002 [P0]
Risk:
- Invalid or broken custom map data.
Mitigation:
- Strict map validator with startup and CI checks.

RIS-RISK-003 [P0]
Risk:
- Client-side cheating attempts.
Mitigation:
- No gameplay resolution on non-host peers; host validates all commands.

RIS-RISK-004 [P0]
Risk:
- UI overload during complex turns.
Mitigation:
- Phase-gated panels and contextual controls only.

RIS-RISK-005 [P1]
Risk:
- Large-map rendering cost.
Mitigation:
- SVG optimization, selective re-render, batched updates.

RIS-RISK-006 [P0]
Risk:
- Host peer disconnect terminates active match in MVP.
Mitigation:
- Auto-pause and reconnect grace window; host migration planned post-MVP.

==================================================
6) POST-MVP EXPANSION BACKLOG
==================================================

RIS-STEP-101 [P1]
Cards and trade-ins:
- Full deck lifecycle.
- Turn-in rules and escalating bonus logic.

RIS-STEP-102 [P1]
Async multiplayer:
- Turn notifications.
- Timeboxed turn windows.

RIS-STEP-103 [P1]
AI opponents:
- Rule-based baseline bot.
- Difficulty presets.

RIS-STEP-104 [P1]
Custom scenario mode:
- Objective-based win conditions.
- Preset starting states.

RIS-STEP-105 [P1]
Fog-of-war:
- Per-player visibility filters.
- Hidden army/ownership policies.

RIS-STEP-106 [P2]
Custom rules editor:
- Ruleset schema.
- Validation and room selection.

==================================================
7) IMPLEMENTATION CHECKLIST (FAST START: DAY 1-3)
==================================================

1. RIS-STEP-001: solution scaffolding complete.
2. RIS-STEP-002: contracts defined.
3. RIS-STEP-003: GameState implemented.
4. RIS-STEP-004: turn commands implemented.
5. RIS-STEP-006: engine tests passing.
6. RIS-STEP-013: map visible and interactive in web.
7. RIS-STEP-015: state-bound ownership + armies visible.

If these seven are complete, you already have:
- A visible map.
- Clickable territories.
- Working turn structure in code.
- A valid base to continue into online multiplayer wiring.
