namespace Risk.Engine.Contracts.Commands;

public sealed record PlayCardsCommand(
    string MatchId,
    string PlayerId,
    string CommandId,
    IReadOnlyList<string> CardIds
) : IGameCommand;
