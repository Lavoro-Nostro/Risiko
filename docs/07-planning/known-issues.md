# Known Issues Register

Status date: 2026-02-12

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
- `Status`: In Progress

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
- `Status`: In Progress

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
- `Status`: In Progress

- `KI-2026-02-12-006`
- `Severity`: P1
- `Area`: Engine/Web (Setup turn limits)
- `Summary`: Setup reinforcement must be capped at max 3 armies per setup turn for each player, with strict turn handoff.
- `Impact`: Initial game flow/rules compliance can break if players place beyond profile setup cap.
- `Repro steps`:
  1. Start a new objective-mode match.
  2. Enter setup phase and place reinforcements across turns.
  3. Verify each setup turn allows at most 3 total armies and then hands off.
- `Mitigation/Workaround`: Manual moderation by host.
- `Target fix milestone`: MVP stabilization.
- `Status`: In Progress

- `KI-2026-02-12-007`
- `Severity`: P1
- `Area`: Web (Attack guidance)
- `Summary`: Attack preview lines do not consistently show all legal attack paths, and selected attack source lacks a clear dedicated indicator.
- `Impact`: Players cannot reliably understand legal attack options.
- `Repro steps`:
  1. Enter attack phase with multiple possible attack sources.
  2. Inspect dotted lines before and after selecting source/target.
  3. Observe missing paths and weak selected-source feedback.
- `Mitigation/Workaround`: Use side-panel source/target selectors as fallback.
- `Target fix milestone`: MVP stabilization.
- `Status`: In Progress (preview lines now bound to selected source; needs multiplayer regression pass)

- `KI-2026-02-12-008`
- `Severity`: P2
- `Area`: Web (Map rendering/performance)
- `Summary`: Map and top UI can appear blurred while panning/zooming; interaction still feels rough.
- `Impact`: Reduced readability and lower UX quality during gameplay.
- `Repro steps`:
  1. Pan and zoom map repeatedly.
  2. Observe sharpness of map and overlays.
  3. Note blur and rough movement.
- `Mitigation/Workaround`: Lower zoom level and pause movement before actions.
- `Target fix milestone`: MVP stabilization.
- `Status`: In Progress (panning/rendering sharpened; final visual tuning still open)

- `KI-2026-02-12-009`
- `Severity`: P1
- `Area`: Web (Post-capture movement popup)
- `Summary`: After conquest, movement popup can fail to show/select movement amount and +/- controls may be non-responsive.
- `Impact`: Attack flow can block after a capture.
- `Repro steps`:
  1. Capture a territory.
  2. Wait for post-capture movement popup.
  3. Verify amount display and +/- click response.
- `Mitigation/Workaround`: Retry sequence with fresh turn if blocked.
- `Target fix milestone`: MVP stabilization.
- `Status`: In Progress (popup now delayed after dice resolution; needs full UX pass)

## Resolved Issues
- `KI-2026-02-10-004`
- `Severity`: P1
- `Area`: Web (Card animation)
- `Summary`: Card reveal/flip animation not reliably showing back-to-front sequence.
- `Status`: Resolved (2026-02-12)

- `KI-2026-02-10-005`
- `Severity`: P1
- `Area`: Web (Objective card presentation)
- `Summary`: Objective text overlap and compressed framing.
- `Status`: Resolved (2026-02-12)

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
