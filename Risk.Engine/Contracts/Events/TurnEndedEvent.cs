namespace Risk.Engine.Contracts.Events;

public sealed record TurnEndedEvent(
    string MatchId,
    long Sequence,
    DateTimeOffset OccurredAtUtc,
    string PlayerId,
    int TurnIndex
) : IGameEvent;
