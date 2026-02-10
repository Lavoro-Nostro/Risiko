# Host Module

Current state:
- ASP.NET Core host scaffold created
- In-memory signaling/event endpoints implemented for host-authoritative room networking
- Host-authoritative command flow implemented with in-memory match sessions
- Match initialize and command submit endpoints wired to `Risk.Engine`
- Rejected commands return explicit `CommandErrorCode` reason codes
- Room lifecycle endpoints implemented (create/join/leave/start match)
- Room start supports `mapId` selection and starts an active authoritative match session
- Reconnect endpoint implemented with `matchId + peerId + playerToken` handshake
- Missing host events replayed from `lastKnownSequence` during reconnect
- Buildable with integration tests (`Risk.Host.Tests`)

Planned contents:
- Host-authoritative match runtime
- WebRTC signaling endpoints
- Match orchestration and event sequencing
- Optional relay/TURN integration
- Session/auth handling
