namespace Risk.Engine.Contracts.Events;

public sealed record CapturedArmiesMovedEvent(
    string MatchId,
    long Sequence,
    DateTimeOffset OccurredAtUtc,
    string PlayerId,
    string FromTerritoryId,
    string ToTerritoryId,
    int ArmiesInSourceTerritory,
    int ArmiesInCapturedTerritory
) : IGameEvent;
