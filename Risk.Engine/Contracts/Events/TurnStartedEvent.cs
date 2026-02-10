namespace Risk.Engine.Contracts.Events;

public sealed record TurnStartedEvent(
    string MatchId,
    long Sequence,
    DateTimeOffset OccurredAtUtc,
    string ActivePlayerId,
    int TurnIndex,
    string Phase
) : IGameEvent;
