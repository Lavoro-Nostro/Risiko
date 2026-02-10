using Risk.Engine.Contracts.Events;

namespace Risk.Engine.Application.EventSourcing;

public sealed class InMemoryGameEventStore : IGameEventStore
{
    private readonly Dictionary<string, List<IGameEvent>> _events = new(StringComparer.Ordinal);

    public void Append(string matchId, IReadOnlyList<IGameEvent> events)
    {
        if (!_events.TryGetValue(matchId, out var existing))
        {
            existing = [];
            _events[matchId] = existing;
        }

        existing.AddRange(events);
    }

    public IReadOnlyList<IGameEvent> Read(string matchId)
    {
        if (!_events.TryGetValue(matchId, out var existing))
        {
            return [];
        }

        return existing.OrderBy(e => e.Sequence).ToList();
    }
}
