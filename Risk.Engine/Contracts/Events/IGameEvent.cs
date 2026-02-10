namespace Risk.Engine.Contracts.Events;

public interface IGameEvent
{
    string MatchId { get; }
    long Sequence { get; }
    DateTimeOffset OccurredAtUtc { get; }
}
