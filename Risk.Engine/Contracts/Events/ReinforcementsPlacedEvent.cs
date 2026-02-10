namespace Risk.Engine.Contracts.Events;

public sealed record ReinforcementsPlacedEvent(
    string MatchId,
    long Sequence,
    DateTimeOffset OccurredAtUtc,
    string PlayerId,
    string TerritoryId,
    int ArmiesPlaced,
    int RemainingReinforcements
) : IGameEvent;
