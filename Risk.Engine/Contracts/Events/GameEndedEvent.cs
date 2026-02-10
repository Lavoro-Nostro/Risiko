namespace Risk.Engine.Contracts.Events;

public sealed record GameEndedEvent(
    string MatchId,
    long Sequence,
    DateTimeOffset OccurredAtUtc,
    string WinnerPlayerId,
    string Reason
) : IGameEvent;
