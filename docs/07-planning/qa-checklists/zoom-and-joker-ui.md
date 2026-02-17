# Zoom and Joker UI Checklist

Date: 2026-02-17
Scope:
- `RSK-QA-004-B` visual zoom/readability regression pass
- `RSK-QA-020-D` Joker trade UI parity checklist

## A) Zoom Readability (`RSK-QA-004-B`)

Environment:
- Desktop 1920x1080 and 1366x768
- Browser zoom 100%
- Hard refresh before each run (`Ctrl+F5`)

Checks:
- At minimum map zoom, territory labels remain readable (no tiny unreadable text).
- At minimum map zoom, army chips and army counters remain distinguishable.
- At medium zoom (~1.0), labels do not overlap chips in most territories.
- At high zoom (>2x), labels/chips do not become disproportionately large.
- Panning at each zoom level keeps overlays aligned with territories.
- Sea links stay behind land textures and do not dominate the map.

Pass criteria:
- No illegible labels/chips at min zoom.
- No exaggerated oversized chips/labels at high zoom.
- Overlay alignment remains stable during zoom/pan.

## B) Joker UI Parity (`RSK-QA-020-D`)

Reference:
- `docs/02-game-design/final-ruleset-objective.md`

Checks:
- UI accepts valid sets:
  - 3 infantry
  - 3 cavalry
  - 3 artillery
  - 1 infantry + 1 cavalry + 1 artillery
  - 1 Joker + 2 same symbol
- UI rejects invalid sets:
  - 2 Joker in one tris
  - 1 Joker + 2 different symbols
  - unknown/unsupported symbols
- UI bonus preview matches engine result for accepted sets.
- Territory ownership bonus (+2 each traded owned territory card) is included in UI total and final engine result.

Pass criteria:
- No mismatch between UI "valid/invalid + bonus" and engine command acceptance/result.
