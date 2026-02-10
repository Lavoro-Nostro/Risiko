namespace Risk.Engine.Contracts.Events;

public sealed record PlayerEliminatedEvent(
    string MatchId,
    long Sequence,
    DateTimeOffset OccurredAtUtc,
    string EliminatedPlayerId,
    string EliminatedByPlayerId
) : IGameEvent;
