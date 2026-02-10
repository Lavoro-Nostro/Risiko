namespace Risk.Engine.Domain.State;

public sealed record ContinentState(
    string ContinentId,
    int Bonus,
    IReadOnlyList<string> TerritoryIds
);
