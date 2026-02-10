# Risiko

Browser-based, turn-based strategy game inspired by classic Risk.

This repository is currently in documentation-first setup.
No gameplay code is included yet; this stage defines structure, scope, architecture, and execution plan.

## Repository Structure

- `RISIKO_MASTER_PLAN.md` -> Master execution plan with IDs (`RIS-*`)
- `docs/` -> Product, design, architecture, QA, planning, and governance docs
- `Risk.Engine/` -> Planned C# game engine module (structure-only for now)
- `Risk.Host/` -> Planned host-authority runtime + signaling gateway module (structure-only for now)
- `Risk.Web/` -> Planned React + TypeScript module (structure-only for now)
- `packs/` -> Planned map/rules packs and localization assets
- `assets/` -> Non-code assets and references

## Current Stage

- Stage: Discovery + technical planning
- Deliverable: Approved docs baseline
- Next step: Initialize projects without implementing gameplay logic
- Multiplayer model: Host-authoritative P2P (one player hosts the match; no dedicated game server)

## Branch Model

- `stable`: production-ready branch
- `main`: release-candidate integration
- `dev`: active development integration
- `feature/*`, `fix/*`, `hotfix/*`: short-lived working branches

Detailed workflow: `docs/08-governance/contributing.md`

## Language

Primary language target for game content and UX: Italian (it-IT).
English docs are kept for engineering clarity.
