# Known Issues Register

Status date: 2026-02-10

Use this register for MVP-candidate triage and release decisions.

## Open Issues
- `KI-2026-02-10-001`
- `Severity`: P1
- `Area`: Web (Setup phase UX)
- `Summary`: During setup, once a territory is selected for reinforcement it cannot be unselected cleanly; adjacent attack-style visuals can appear instead of pure setup reinforcement guidance.
- `Impact`: Confusing setup flow and incorrect visual cues while placing initial armies.
- `Repro steps`:
  1. Start a new match and enter setup phase.
  2. Select a territory to place setup reinforcements.
  3. Try changing selection or clearing it.
  4. Observe selection lock and attack-like adjacent animation behavior.
- `Mitigation/Workaround`: Keep selecting a different owned territory via controls until placement is accepted.
- `Target fix milestone`: MVP stabilization.
- `Status`: Open

- `KI-2026-02-10-002`
- `Severity`: P2
- `Area`: Web (Map interaction feedback)
- `Summary`: Selected territories are not clearly highlighted.
- `Impact`: Hard to understand current command target on the board.
- `Repro steps`:
  1. Select territory for reinforce/attack/fortify.
  2. Observe map highlight state.
  3. Selection is weak/absent.
- `Mitigation/Workaround`: Use right-side action selectors as source of truth.
- `Target fix milestone`: MVP stabilization.
- `Status`: Open

- `KI-2026-02-10-003`
- `Severity`: P2
- `Area`: Web (Setup readability)
- `Summary`: Setup phase needs persistent owned-territory outline to distinguish player-controlled regions.
- `Impact`: Slower and error-prone setup placement decisions.
- `Repro steps`:
  1. Enter setup phase in a multi-player match.
  2. Inspect board ownership readability for current player.
  3. Owned regions are not outlined strongly enough for setup.
- `Mitigation/Workaround`: Cross-check with side panel and territory ownership chips.
- `Target fix milestone`: MVP stabilization.
- `Status`: Open

- `KI-2026-02-10-004`
- `Severity`: P1
- `Area`: Web (Card animation)
- `Summary`: Card reveal/flip animation is not reliably showing turn from back to front; cards appear without expected flip.
- `Impact`: Deal/reveal UX feels broken and reduces gameplay clarity.
- `Repro steps`:
  1. Start a new match and watch objective/territory reveal sequence.
  2. Observe cards during reveal.
  3. Flip effect is missing or not visible.
- `Mitigation/Workaround`: None.
- `Target fix milestone`: MVP stabilization.
- `Status`: Open

- `KI-2026-02-10-005`
- `Severity`: P1
- `Area`: Web (Objective card presentation)
- `Summary`: Objective text overlaps; objective card should be shown larger and directly, not nested in extra framing that compresses content.
- `Impact`: Objective readability and overall visual quality are degraded.
- `Repro steps`:
  1. Reveal objective card in-game.
  2. Inspect title/description layout.
  3. Observe overlap/compression and extra container reducing clarity.
- `Mitigation/Workaround`: None.
- `Target fix milestone`: MVP stabilization.
- `Status`: Open

## Tracking Template
- `ISSUE-ID`:
- `Severity`: P0/P1/P2
- `Area`: Engine/Host/Web/Packs/Infra
- `Summary`:
- `Impact`:
- `Repro steps`:
- `Mitigation/Workaround`:
- `Target fix milestone`:
- `Status`: Open/In Progress/Blocked/Resolved
