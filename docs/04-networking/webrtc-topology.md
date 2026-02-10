# WebRTC Topology

## Session Model
- One player is elected host (authority for the match)
- Other players are peers connected to host via WebRTC DataChannel

## Connectivity
- Signaling service is used only for SDP/ICE exchange
- STUN for NAT traversal
- TURN/relay optional fallback when direct P2P fails

## Ordering
- Host emits ordered match events with sequence numbers
