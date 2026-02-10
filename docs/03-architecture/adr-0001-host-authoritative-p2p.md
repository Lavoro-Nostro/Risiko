# ADR-0001: Host-Authoritative P2P Architecture

## Status
Accepted

## Context
For web-first play without dedicated servers, one player must host the match authority while peers connect directly.

## Decision
All gameplay state transitions execute on the host peer only.
Non-host peers submit commands to host and render resulting events.

## Consequences
- Better integrity and anti-cheat
- Host migration/reconnect complexity
- Deterministic replays and reconnect recovery
