# Changelog

All notable changes to this project will be documented here.

## [Unreleased]
- Initial docs-first repository structure created.
- RIS-STEP-001 scaffold completed:
- Added `Risiko.slnx`
- Added `Risk.Engine` class library project
- Added `Risk.Host` ASP.NET minimal host project
- Added `Risk.Web` Vite + React + TypeScript scaffold
- RIS-STEP-002 shared contracts completed:
- Added ID value objects (`PlayerId`, `TerritoryId`, `ContinentId`)
- Added turn phase enum
- Added command and event contract DTOs
- Added command validation result model and error codes
- Added `Risk.Web/package-lock.json` for deterministic npm installs
- Added `Risk.Engine.Tests` xUnit suite for contract-level validation
- RIS-STEP-003 GameState model completed:
- Added `GameState` with phase/turn/round, active player, reinforcements, capture flag, and RNG seed
- Added `PlayerState` and `TerritoryState`
- Added GameState transition helpers (`WithPhase`, `WithReinforcements`, `MarkTerritoryCaptured`, `AdvanceTurn`, `SetTerritoryState`)
- Added `Risk.Engine.Tests/GameStateTests.cs` for GameState transitions and non-mutation behavior
- RIS-STEP-004 command handlers completed:
- Added `GameCommandHandler` for `PlaceReinforcements`, `Attack`, `Fortify`, and `EndTurn`
- Added deterministic attack resolution seeded from state RNG + command ID
- Added adjacency/path-based validation for attack and fortify
- Added `CommandExecutionResult` for accepted/rejected command outcomes
- Added `Risk.Engine.Tests/GameCommandHandlerTests.cs` to validate command transitions and phase rules
- Added complete world-classic map metadata (42 territories, continents, adjacency, en/it labels)
- RIS-STEP-005 event emission and replay completed:
- Added event store abstraction (`IGameEventStore`) and in-memory implementation
- Added `GameStateProjector` to rebuild state by replaying events
- Added event envelope model for accepted/rejected command outcomes
- Updated command handler to emit domain events for accepted commands with sequence IDs
- Added `Risk.Engine.Tests/EventSourcingTests.cs` for event store ordering, replay, and sequence continuation
