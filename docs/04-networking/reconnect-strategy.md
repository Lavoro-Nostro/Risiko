# Reconnect Strategy

## Client
- Store last applied event sequence
- Rejoin with match token, peer ID, and sequence cursor

## Host
- Validate membership
- Return missing events from cursor
- Force full snapshot if cursor too old

## Host Disconnect
- Match pauses when host disconnects
- Host migration is post-MVP (fallback is match termination in MVP)
