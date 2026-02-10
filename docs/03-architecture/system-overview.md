# System Overview

## Modules
- Risk.Engine: deterministic game logic
- Risk.Host: host-authoritative runtime and signaling
- Risk.Web: UI and interaction
- packs: data-driven map/rules content

## Principles
- Host-authoritative game state (match host acts as authority)
- Event-driven updates
- Deterministic replayable matches
