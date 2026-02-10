namespace Risk.Engine.Contracts.Commands;

public sealed record FortifyCommand(
    string MatchId,
    string PlayerId,
    string CommandId,
    string FromTerritoryId,
    string ToTerritoryId,
    int ArmiesToMove
) : IGameCommand;
