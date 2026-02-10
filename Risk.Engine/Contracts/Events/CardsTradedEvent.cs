namespace Risk.Engine.Contracts.Events;

public sealed record CardsTradedEvent(
    string MatchId,
    long Sequence,
    DateTimeOffset OccurredAtUtc,
    string PlayerId,
    IReadOnlyList<string> CardIds,
    int BonusArmies,
    int NextTradeStep
) : IGameEvent;
