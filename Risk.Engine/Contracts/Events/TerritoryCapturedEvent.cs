namespace Risk.Engine.Contracts.Events;

public sealed record TerritoryCapturedEvent(
    string MatchId,
    long Sequence,
    DateTimeOffset OccurredAtUtc,
    string TerritoryId,
    string PreviousOwnerPlayerId,
    string NewOwnerPlayerId,
    int ArmiesMovedIn
) : IGameEvent;
