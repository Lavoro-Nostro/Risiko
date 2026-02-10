namespace Risk.Engine.Domain.State;

public sealed record TerritoryState(
    string TerritoryId,
    string OwnerPlayerId,
    int Armies,
    IReadOnlyList<string> NeighborTerritoryIds
)
{
    public bool IsAdjacentTo(string territoryId) =>
        NeighborTerritoryIds.Contains(territoryId, StringComparer.Ordinal);
}
