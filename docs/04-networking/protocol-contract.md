# Protocol Contract

## Envelope Fields
- messageType
- matchId
- sequence
- timestamp
- payload

## Rules
- Commands must include senderPeerId and client correlation ID
- Events must include hostPeerId and authoritative sequence number
- Unknown messageType is rejected
