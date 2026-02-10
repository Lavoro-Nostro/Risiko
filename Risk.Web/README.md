# Web Module

Vite + React + TypeScript scaffold for Risiko frontend.

Current scope:
- World-classic SVG map rendered from shared `packs/` assets
- Territory IDs bound between `map.json` and SVG groups
- Territory selection UI from interactive SVG nodes
- Pack binding tests with Vitest
- Territory visual states with class-driven styling:
- `neutral`, `owned`, `hover`, `selectable`, `selected`, `under-attack`, `captured`
- Host-authoritative state binding for map owner colors and army overlays
- Polling sync from `Risk.Host` match snapshot endpoint
- Turn phase action panel implemented:
- Reinforce controls with remaining-armies counter
- Attack controls with source/target/dice selector
- Fortify controls with source/target/army selector
- End-turn action command
- Tactical info panels implemented:
- Top panel with player order and active player highlight
- Current phase/turn/round summary
- Territory detail panel
- Combat preview panel
- Baseline event-driven animations implemented:
- Dice-roll animation triggered by ordered host attack events
- Attack flash state from host event stream
- Army badge pulse on territory army updates
- Capture sweep animation on territory capture events
- UX hardening implemented:
- Clear validation/error feedback with command status levels
- Disabled actions with explicit blocked-state hints
- Loading/reconnect overlays for state/event sync failures

Planned next milestones:
- RIS-STEP-020 MVP release gate and integration validation
