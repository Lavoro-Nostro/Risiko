using Risk.Engine.Contracts.Events;

namespace Risk.Engine.Application.EventSourcing;

public interface IGameEventStore
{
    void Append(string matchId, IReadOnlyList<IGameEvent> events);
    IReadOnlyList<IGameEvent> Read(string matchId);
}
