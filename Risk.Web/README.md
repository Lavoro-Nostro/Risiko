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

Planned next milestones:
- RIS-STEP-018 baseline combat/map animations
