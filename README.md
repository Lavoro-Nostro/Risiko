# Risiko

Host-authoritative, web-first strategy game inspired by classic Risk.

## Project Status

The repository is currently in a docs-first planning phase.
Core architecture, workflow, and quality gates are defined before gameplay implementation starts.

## Vision

- Play full matches directly in the browser.
- Use a host-hosted multiplayer model (no dedicated gameplay server).
- Keep rules deterministic, auditable, and replay-friendly.
- Support map packs and future ruleset expansion.

## Architecture Direction

- `Risk.Engine` -> deterministic game logic and rule execution
- `Risk.Host` -> host-authority runtime and WebRTC signaling/orchestration
- `Risk.Web` -> client UI/UX and map interaction layer
- `packs` -> data-driven map and localization packs

Detailed plan: `RISIKO_MASTER_PLAN.md`

## Multiplayer Model

- One player acts as match host (authority).
- Peers send commands to host.
- Host validates, applies, and broadcasts ordered events.
- No gameplay resolution runs on non-host peers.

## Repository Layout

- `RISIKO_MASTER_PLAN.md` -> execution plan with `RIS-*` IDs
- `WORK_TRACKING.md` -> operational tracking baseline
- `docs/` -> product, design, architecture, networking, QA, planning, governance
- `.github/` -> workflows, templates, repository automation
- `packs/` -> map/content pack structure
- `assets/` -> non-code resources

## Getting Started

Prerequisites:
- .NET SDK 10+
- Node.js 20+ (for `Risk.Web`)

Quick setup:

```powershell
./scripts/install-deps.ps1
```

Run web app only:

```powershell
./scripts/run-web.ps1
```

Run host + web together (two terminals):

```powershell
./scripts/run-dev.ps1
```

Build backend modules:

```bash
dotnet build Risiko.slnx -c Release
```

Run automated tests:

```bash
dotnet test Risiko.slnx -c Release
```

Run host module:

```bash
dotnet run --project Risk.Host/Risk.Host.csproj
```

Run web module:

```bash
cd Risk.Web
npm install
npm run dev
```

## Branching Strategy

- `dev` -> active integration
- `main` -> release candidate integration
- `stable` -> production-ready branch
- `feature/*`, `fix/*`, `hotfix/*` -> short-lived work branches

Full contribution and merge flow:
`docs/08-governance/contributing.md`

## Documentation Index

- Product vision: `docs/01-product/vision.md`
- Core rules: `docs/02-game-design/rules-core.md`
- System overview: `docs/03-architecture/system-overview.md`
- WebRTC topology: `docs/04-networking/webrtc-topology.md`
- Map pack spec: `docs/05-content-packs/pack-spec.md`
- Test strategy: `docs/06-quality/test-strategy.md`

## Language

- Primary player-facing language: Italian (`it-IT`)
- Technical documentation: English-first for engineering clarity

## Contribution

Before opening PRs:

1. Link work to relevant `RIS-*` IDs.
2. Follow branch flow rules.
3. Update docs if behavior/contracts change.
4. Use provided issue/PR templates.
