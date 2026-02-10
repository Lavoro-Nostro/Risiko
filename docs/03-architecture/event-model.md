# Event Model

## Commands (Client -> Server)
- PlaceReinforcements
- Attack
- Fortify
- EndTurn
- PlayCards (optional)

## Events (Server -> Client)
- TurnStarted
- ReinforcementsPlaced
- AttackResolved
- TerritoryCaptured
- CardGranted
- TurnEnded

## Event Sourcing
- Match state is reconstructible from ordered events
- Event sequence IDs are mandatory
