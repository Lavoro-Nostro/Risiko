namespace Risk.Engine.Contracts.Commands;

public sealed record AttackCommand(
    string MatchId,
    string PlayerId,
    string CommandId,
    string FromTerritoryId,
    string ToTerritoryId,
    int AttackerDice
) : IGameCommand;
