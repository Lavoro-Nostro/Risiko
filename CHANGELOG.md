# Changelog

This project follows Keep a Changelog style and Semantic Versioning (pre-1.0).
Dates are in ISO format (`YYYY-MM-DD`).

## [Unreleased]
### Added
- RIS-STEP-016 turn phase control panel in `Risk.Web`:
- Reinforce controls with territory + armies selector.
- Attack controls with source/target territory and attacker dice selector.
- Fortify controls with source/target territory and army amount selector.
- End turn action wired to host command endpoint.
- Command feedback/status panel for accepted/rejected actions.
- RIS-STEP-017 tactical context panels in `Risk.Web`:
- Top player-order panel with active player highlight and per-player territory/army summary.
- Current phase/turn/round summary panel.
- Expanded territory detail panel.
- Combat preview panel linked to selected attack source/target and dice settings.
- RIS-STEP-018 baseline event animations in `Risk.Web`:
- Ordered host-event polling and processing keyed by event sequence.
- Dice-roll animation triggered from `AttackResolvedEvent`.
- Attack flash state (`under-attack`) tied to attack events.
- Army badge pulse transitions on event-driven army changes.
- Capture sweep animation triggered by `TerritoryCapturedEvent`.
- RIS-STEP-019 UX hardening in `Risk.Web`:
- Added stronger disabled-action guards for disconnected/loading/submitting states.
- Added clearer rejection feedback with mapped validation reason labels.
- Added state/event sync status indicators and sync-latency display.
- Added loading overlay and reconnect warning overlay for sync disruptions.
- Added structured command feedback severity styling (`success/error/info`).

### Changed
- `Risk.Web` now submits turn commands directly to `Risk.Host` via `POST /api/matches/{matchId}/commands`.
- Control enablement is now phase-aware from authoritative host state.

### Code Traceability
- RIS-STEP-016:
- `Risk.Web/src/App.tsx`
- `Risk.Web/src/styles.css`
- RIS-STEP-017:
- `Risk.Web/src/App.tsx`
- `Risk.Web/src/styles.css`
- RIS-STEP-018:
- `Risk.Web/src/App.tsx`
- `Risk.Web/src/styles.css`
- RIS-STEP-019:
- `Risk.Web/src/App.tsx`
- `Risk.Web/src/styles.css`

## [0.3.0] - 2026-02-10
### Added
- RIS-STEP-013 web map rendering from shared pack assets.
- RIS-STEP-014 territory visual-state system (`neutral`, `owned`, `hover`, `selectable`, `selected`, `under-attack`, `captured`).
- RIS-STEP-015 host-authoritative map state binding with army overlays and neighbor highlighting.
- Host authoritative snapshot API: `GET /api/matches/{matchId}/state`.
- Frontend unit tests via Vitest for pack-binding and visual-state logic.

### Changed
- `Risk.Web` now renders map ownership and armies from host state (authoritative source), not local demo ownership.
- `Risk.Web` map interaction now supports selected-neighbor highlighting based on map adjacency.

### Tests
- `Risk.Web`: 4 passing tests (`worldClassic.test.ts`, `territoryVisualState.test.ts`).
- `Risk.Host.Tests`: snapshot endpoint coverage added in `CommandFlowApiTests.cs`.

### Code Traceability
- RIS-STEP-013:
- `Risk.Web/src/App.tsx`
- `Risk.Web/src/map/worldClassic.ts`
- `Risk.Web/src/map/worldClassic.test.ts`
- `Risk.Web/src/styles.css`
- RIS-STEP-014:
- `Risk.Web/src/map/territoryVisualState.ts`
- `Risk.Web/src/map/territoryVisualState.test.ts`
- `Risk.Web/src/styles.css`
- RIS-STEP-015:
- `Risk.Host/Program.cs`
- `Risk.Host/Gameplay/IMatchSessionService.cs`
- `Risk.Host/Gameplay/InMemoryMatchSessionService.cs`
- `Risk.Host/Gameplay/MatchSessionContracts.cs`
- `Risk.Host.Tests/CommandFlowApiTests.cs`
- `Risk.Web/src/App.tsx`

## [0.2.0] - 2026-02-10
### Added
- RIS-STEP-009 in-memory signaling/event API for room networking.
- RIS-STEP-010 host-authoritative command pipeline (`peer command -> validation -> apply -> append -> broadcast`).
- RIS-STEP-011 room lifecycle (`create`, `join`, `leave`, `start`) with map-aware match initialization.
- RIS-STEP-012 reconnect handshake with token auth and missing-event replay.

### Changed
- Match execution model formalized as host-authoritative in `Risk.Host`.
- Room startup now initializes deterministic match state from map pack metadata.

### Tests
- Added host integration tests for signaling, command flow, room lifecycle, and reconnect behavior.
- `Risk.Host.Tests` expanded to 12 tests by end of this release line.

### Code Traceability
- RIS-STEP-009:
- `Risk.Host/Networking/ISignalingService.cs`
- `Risk.Host/Networking/InMemorySignalingService.cs`
- `Risk.Host/Networking/SignalingContracts.cs`
- `Risk.Host.Tests/SignalingApiTests.cs`
- RIS-STEP-010:
- `Risk.Host/Gameplay/InMemoryMatchSessionService.cs`
- `Risk.Host/Gameplay/MatchSessionContracts.cs`
- `Risk.Host/Program.cs`
- `Risk.Host.Tests/CommandFlowApiTests.cs`
- RIS-STEP-011:
- `Risk.Host/Gameplay/IRoomSessionService.cs`
- `Risk.Host/Gameplay/InMemoryRoomSessionService.cs`
- `Risk.Host/Gameplay/RoomContracts.cs`
- `Risk.Host.Tests/RoomLifecycleApiTests.cs`
- RIS-STEP-012:
- `Risk.Host/Gameplay/InMemoryMatchSessionService.cs`
- `Risk.Host/Program.cs`
- `Risk.Host.Tests/ReconnectApiTests.cs`

## [0.1.0] - 2026-02-10
### Added
- RIS-STEP-001 project scaffold (`Risk.Engine`, `Risk.Host`, `Risk.Web`, solution).
- RIS-STEP-002 contracts and validation error model.
- RIS-STEP-003 engine `GameState` core state model and transitions.
- RIS-STEP-004 command handlers (`PlaceReinforcements`, `Attack`, `Fortify`, `EndTurn`).
- RIS-STEP-005 event sourcing primitives (event store + replay projector).
- RIS-STEP-006 deterministic engine test expansion.
- RIS-STEP-007 map pack loader and validator.
- RIS-STEP-008 complete `world-classic` map pack assets and consistency checks.

### Changed
- Engine reinforcement calculation updated to include continent bonuses.
- Command handling made deterministic via seeded RNG for attack resolution.

### Tests
- Engine test suite introduced and expanded across gameplay, replay, and pack validation.
- `Risk.Engine.Tests` reached 31 tests by end of this release line.

### Code Traceability
- RIS-STEP-001:
- `Risiko.slnx`
- `Risk.Engine/Risk.Engine.csproj`
- `Risk.Host/Risk.Host.csproj`
- `Risk.Web/package.json`
- RIS-STEP-002:
- `Risk.Engine/Contracts/`
- `Risk.Engine/Domain/Ids/`
- RIS-STEP-003:
- `Risk.Engine/Domain/State/GameState.cs`
- `Risk.Engine/Domain/State/PlayerState.cs`
- `Risk.Engine/Domain/State/TerritoryState.cs`
- `Risk.Engine.Tests/GameStateTests.cs`
- RIS-STEP-004:
- `Risk.Engine/Application/GameCommandHandler.cs`
- `Risk.Engine/Application/CommandExecutionResult.cs`
- `Risk.Engine.Tests/GameCommandHandlerTests.cs`
- RIS-STEP-005:
- `Risk.Engine/Application/EventSourcing/IGameEventStore.cs`
- `Risk.Engine/Application/EventSourcing/InMemoryGameEventStore.cs`
- `Risk.Engine/Application/EventSourcing/GameStateProjector.cs`
- `Risk.Engine.Tests/EventSourcingTests.cs`
- RIS-STEP-006:
- `Risk.Engine/Domain/State/ContinentState.cs`
- `Risk.Engine.Tests/GameCommandHandlerTests.cs`
- RIS-STEP-007:
- `Risk.Engine/Packs/MapPackLoader.cs`
- `Risk.Engine/Packs/PackModels.cs`
- `Risk.Engine.Tests/MapPackLoaderTests.cs`
- RIS-STEP-008:
- `packs/maps/world-classic/map.json`
- `packs/maps/world-classic/map.svg`
- `packs/maps/world-classic/i18n/en.json`
- `packs/maps/world-classic/i18n/it.json`
- `Risk.Engine.Tests/MapPackAssetConsistencyTests.cs`
