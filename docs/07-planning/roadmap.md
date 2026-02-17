# Roadmap

Status date: 2026-02-17

## Phase 0 - Foundation (Completed)

- Engine state model, commands/events, deterministic flow.
- Baseline tests and solution scaffolding.

## Phase 1 - Core Playability (Completed)

- Web map rendering and territory interaction.
- Reinforce/attack/fortify/end-turn loop.

## Phase 2 - Multiplayer Correctness (In Progress)

- Host-authoritative flow and reconnect stability.
- Shared visibility for combat intent/dice results across all clients.
- Turn-gated UI visibility (only active player gets action controls).

## Phase 3 - UX Stabilization (In Progress)

- Sea-link rendering cleanup and deterministic routing.
- Zoom/readability consistency for labels/chips.
- Clear action feedback and army-change animations.
- Territory label/chip overlap removal.

## Phase 4 - Lobby and Match Lifecycle (Planned)

- Simplified host/join UX.
- Duplicate join protection and stable seat resume.
- Loading/sync gate to prevent early-match desync.

## Phase 5 - Rules Completeness (Planned)

- Card trade-in hardening, including joker behavior parity.
- Forced trade behavior and edge-case validation.

## Phase 6 - Polish and Expansion (Planned)

- Bottom dock redesign and card interaction polish.
- Optional URL auto-resolve improvements.
- Post-MVP: async turns, AI, scenario variants.
