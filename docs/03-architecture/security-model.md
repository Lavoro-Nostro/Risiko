# Security Model

## Trust Boundaries
- Client is untrusted
- Server validates all state mutations

## Controls
- Authorization per match membership
- Command schema validation
- Phase/ownership/adjacency checks on host authority

## Abuse Cases
- Forged commands
- Replayed stale commands
- Unauthorized room actions
