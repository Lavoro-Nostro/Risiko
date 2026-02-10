namespace Risk.Engine.Contracts.Commands;

public interface IGameCommand
{
    string MatchId { get; }
    string PlayerId { get; }
    string CommandId { get; }
}
