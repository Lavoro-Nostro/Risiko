namespace Risk.Engine.Contracts.Commands;

public sealed record EndTurnCommand(
    string MatchId,
    string PlayerId,
    string CommandId
) : IGameCommand;
