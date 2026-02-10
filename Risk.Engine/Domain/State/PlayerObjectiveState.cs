namespace Risk.Engine.Domain.State;

public sealed record PlayerObjectiveState(
    string PlayerId,
    string ObjectiveId,
    string Title,
    string Description,
    string Kind,
    int TargetTerritoryCount = 0,
    int RequiredArmiesPerTerritory = 0,
    IReadOnlyList<string>? RequiredContinentIds = null,
    int RequiredAdditionalContinentCount = 0,
    string? EliminateTargetPlayerId = null
);
