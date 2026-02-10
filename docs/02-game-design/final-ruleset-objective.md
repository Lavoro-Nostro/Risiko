# Final Ruleset: Objective Mode (Italian Classic Profile)

Ruleset ID: `RisiKo!_OBJECTIVE_CLASSICO_IT_V1`
Status: Final baseline for full-match implementation

## 1. Scope

This ruleset defines the complete match flow from lobby/setup to victory for:
- secret objective gameplay
- Joker cards enabled
- host-authoritative execution

Player count:
- 3 to 6 players

## 2. Victory Condition

Primary win condition:
- a player wins immediately when their secret objective is fulfilled.

Objective visibility:
- each player sees only their own objective.
- host stores all objectives and performs authoritative checks.

Fallback rule (destroy-color objective):
- if a destroy-color objective is impossible at setup (target color not present), assign a territory-control fallback objective.

## 3. Match Setup

## 3.1 Starting Armies

Per player:
- 3 players: 35
- 4 players: 30
- 5 players: 25
- 6 players: 20

## 3.2 Objective Distribution

- shuffle objective deck.
- deal one objective card to each player.

## 3.3 Territory Assignment (Card-Based)

- remove Jokers from territory deck for initial territory assignment.
- deal territory cards to players until all territories are assigned.
- each player places 1 army on each owned territory.

## 3.4 Pre-Match Reinforcement Rounds

- before turn 1, run setup rounds.
- turn order is fixed for setup (same as match order).
- on each setup turn, player places exactly 3 armies on owned territories.
- repeat rounds until all players place all remaining starting armies.

When setup ends:
- collect all territory cards, add Jokers back, shuffle to create draw deck.

## 4. Turn Flow

Each active player executes:
1. Reinforcement
2. Attack (optional, repeat)
3. Fortify (optional, once)
4. End Turn

## 4.1 Reinforcement Phase

Reinforcements for turn:
- base = `max(3, floor(owned_territories / 3))`
- plus continent bonuses
- plus card trade bonus (if traded this turn)

Constraints:
- only active player may place.
- can place only on owned territories.
- cannot exceed available reinforcement pool.

## 4.2 Attack Phase

Attack legality:
- source and target must be adjacent.
- source owned by attacker, target owned by another player.
- source must keep at least 1 army after attack.

Dice:
- attacker chooses 1 to 3 dice, limited by armies in source.
- defender rolls up to max allowed by profile.

Profile default:
- defender max dice = 3.

Resolution:
- sort attacker and defender dice descending.
- compare highest pairs.
- each pair: lower die loses 1 army.
- ties favor defender.

Capture:
- if defender territory armies reach 0, territory is captured.
- attacker must move armies into captured territory (minimum according to attack move rule).

## 4.3 Fortify Phase

- optional once per turn.
- move armies between owned territories.
- leave at least 1 army in source.

Profile default:
- connectivity by owned path is required.

## 4.4 End Turn

Card draw:
- if player captured at least one territory this turn, draw exactly one territory card.

Then:
- clear turn-scoped flags
- rotate active player
- start next turn

## 5. Card Rules (Jokers Enabled)

Deck:
- territory cards + Joker cards.

Draw:
- max 1 card at end of turn if at least one capture occurred.

Trade-in (`tris`) timing:
- at reinforcement phase before placing armies.

Valid sets:
- three of same symbol
- one of each symbol
- sets using Joker as wildcard

Forced trade:
- if hand size is at or above configured max, player must trade until below threshold.

Trade bonus progression:
- configured sequence in rules profile (data-driven, not hardcoded in UI).

## 6. Elimination

- player is eliminated at 0 owned territories.
- eliminator receives eliminated player's cards.
- elimination and card transfer occur atomically.
- if resulting hand breaches forced-trade threshold, forced trades apply immediately.

## 7. Authoritative Validation Rules

Host must reject any command that violates:
- wrong active player
- wrong phase
- ownership constraints
- adjacency/path constraints
- invalid army amounts
- invalid card set trades
- malformed command payload

Rejected commands:
- do not mutate state
- return deterministic error code + message

## 8. Mandatory Game Events

- `MatchStarted`
- `ObjectivesAssigned`
- `SetupArmyPlaced`
- `ReinforcementsCalculated`
- `ReinforcementsPlaced`
- `AttackResolved`
- `TerritoryCaptured`
- `Fortified`
- `CardsTraded`
- `CardDrawn`
- `PlayerEliminated`
- `ObjectiveCompleted`
- `TurnEnded`
- `TurnStarted`
- `GameEnded`

## 9. Objective Check Timing

Host evaluates objective completion:
- after every state-changing accepted command
- after elimination events
- after card/territory transfers

If objective completed:
- emit `ObjectiveCompleted`
- emit `GameEnded`
- lock match against further gameplay commands

## 10. Implementation Notes

This is the canonical profile for implementation in engine/host.
If other editions are added later, create new profile IDs instead of mutating this one.

