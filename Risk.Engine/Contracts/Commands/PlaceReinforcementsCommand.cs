namespace Risk.Engine.Contracts.Commands;

public sealed record PlaceReinforcementsCommand(
    string MatchId,
    string PlayerId,
    string CommandId,
    string TerritoryId,
    int ArmiesToPlace
) : IGameCommand;
