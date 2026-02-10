namespace Risk.Engine.Contracts.Events;

public sealed record CardGrantedEvent(
    string MatchId,
    long Sequence,
    DateTimeOffset OccurredAtUtc,
    string PlayerId,
    string CardId
) : IGameEvent;
