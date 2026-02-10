namespace Risk.Engine.Domain.State;

public sealed record TerritoryState(
    string TerritoryId,
    string OwnerPlayerId,
    int Armies
);
