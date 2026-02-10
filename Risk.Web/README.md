# Web Module

Vite + React + TypeScript scaffold for Risiko frontend.

Current scope:
- World-classic SVG map rendered from shared `packs/` assets
- Territory IDs bound between `map.json` and SVG groups
- Territory selection UI from interactive SVG nodes
- Pack binding tests with Vitest
- Territory visual states with class-driven styling:
- `neutral`, `owned`, `hover`, `selectable`, `selected`, `under-attack`, `captured`

Planned next milestones:
- RIS-STEP-015 host-authoritative event binding
