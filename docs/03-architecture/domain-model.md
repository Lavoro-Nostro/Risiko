# Domain Model

## Core Entities
- Match
- Player
- Territory
- Continent
- Turn

## Value Objects
- IDs (MatchId, PlayerId, TerritoryId)
- ArmyCount
- Phase

## Invariants
- Territory has exactly one owner
- Army count is always >= 1 on occupied territory
- Active player is unique
