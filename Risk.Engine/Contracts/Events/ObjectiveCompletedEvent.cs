namespace Risk.Engine.Contracts.Events;

public sealed record ObjectiveCompletedEvent(
    string MatchId,
    long Sequence,
    DateTimeOffset OccurredAtUtc,
    string WinnerPlayerId
) : IGameEvent;
