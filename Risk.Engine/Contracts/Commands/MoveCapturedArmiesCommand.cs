namespace Risk.Engine.Contracts.Commands;

public sealed record MoveCapturedArmiesCommand(
    string MatchId,
    string PlayerId,
    string CommandId,
    string FromTerritoryId,
    string ToTerritoryId,
    int ArmiesToMoveTotal
) : IGameCommand;

