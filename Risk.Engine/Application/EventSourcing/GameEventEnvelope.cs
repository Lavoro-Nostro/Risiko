using Risk.Engine.Contracts.Events;

namespace Risk.Engine.Application.EventSourcing;

public sealed record GameEventEnvelope(
    bool Accepted,
    IGameEvent? Event,
    string SourceCommandId,
    string? RejectionReason = null
);
