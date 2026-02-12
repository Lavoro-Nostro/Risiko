# Combat Specification

## Preconditions
- Territories are adjacent
- Attacker owns source territory
- Defender owns target territory

## Dice Model
- Dice system follows this project profile (RisiKo! objective mode)
- Attacker rolls `1-3` dice, limited by attacking armies (`sourceArmies - 1`)
- Defender rolls `1-3` dice, limited by defending armies
- Dice are sorted descending on both sides
- Highest attacker die compares with highest defender die
- If both sides rolled at least 2 dice, second-highest pair is also compared
- Ties favor defender

## Outcomes
- Armies reduced according to dice comparison
- Capture occurs when defender armies reach zero
- Capture triggers ownership transfer event

## Dice Combat Rollout Plan

Epic:
- `RSK-DICE-EPIC-001`: full attack/defense dice resolution with animated popup and synchronized multiplayer results.

### Phase 1: Rules and Contracts
- `RSK-DICE-STEP-001`: Lock combat dice rules in this spec and wire to rules profile.
- `RSK-DICE-STEP-002`: Define/confirm host command contract for attack request (`fromTerritoryId`, `toTerritoryId`, `attackerDice`).
- `RSK-DICE-STEP-003`: Define `AttackResolved` payload fields (attacker rolls, defender rolls, losses, post-state summary, capture flag).

### Phase 2: Engine and Host
- `RSK-DICE-STEP-004`: Implement server-authoritative dice generation and validation.
- `RSK-DICE-STEP-005`: Apply losses and territory capture transition atomically.
- `RSK-DICE-STEP-006`: Add engine/host unit tests for legal/illegal and edge cases.

### Phase 3: Web Popup and Animation
- `RSK-DICE-STEP-007`: Build reusable dice popup component (attacker/defender sections, dice count, values).
- `RSK-DICE-STEP-008`: Implement roll animation lifecycle (rolling -> settle -> compare highlight).
- `RSK-DICE-STEP-009`: Connect popup to attack flow (open only on real attack command, resolve with host response, close safely at end of attack sequence).

### Phase 4: Integration and UX
- `RSK-DICE-STEP-010`: Lock conflicting UI actions while combat resolves.
- `RSK-DICE-STEP-011`: Add combat history line in status/chat log.
- `RSK-DICE-STEP-012`: Error/timeouts fallback for popup and sync.

### Phase 5: QA and Release Gate
- `RSK-DICE-STEP-013`: Add frontend tests for popup states and rendering.
- `RSK-DICE-STEP-014`: Add integration tests for host attack response schema.
- `RSK-DICE-STEP-015`: Manual multiplayer verification pass (both clients identical outcomes).

## Definition of Done
- `RSK-DICE-DOD-001`: Dice outcomes are host-authoritative and deterministic for all clients.
- `RSK-DICE-DOD-002`: Popup always shows correct dice count for attacker and defender.
- `RSK-DICE-DOD-003`: Army losses and capture behavior match rules in automated tests.
- `RSK-DICE-DOD-004`: No UI deadlock/desync after repeated attacks.

## UX Decisions (Confirmed)
- Defender max dice: `3`.
- Popup trigger: only when an attack is executed (attacker command / defender resolution event), not on hover or preselection.
- Popup close behavior: auto-close after a short delay (few seconds) when the current attack sequence on the selected target territory is finished (player stops attacking that territory).
- Post-capture movement popup opens with a short delay after dice popup closes, to avoid overlap and improve readability.
- Legal attack preview lines are shown only for the currently selected attack source territory.
