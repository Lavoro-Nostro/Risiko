using System.Collections.Concurrent;

namespace Risk.Host.Networking;

public sealed class InMemorySignalingService : ISignalingService
{
    private readonly ConcurrentDictionary<string, RoomState> _rooms = new(StringComparer.Ordinal);

    public RegisterPeerResponse RegisterPeer(string roomId, string peerId)
    {
        var room = GetRoom(roomId);
        lock (room.Sync)
        {
            room.Peers.Add(peerId);
            return new RegisterPeerResponse(roomId, peerId, room.Peers.OrderBy(x => x).ToList());
        }
    }

    public SignalMessage SendSignal(string roomId, string fromPeerId, SignalSendRequest request)
    {
        var room = GetRoom(roomId);
        lock (room.Sync)
        {
            var next = ++room.SignalSequence;
            var signal = new SignalMessage(
                next,
                roomId,
                fromPeerId,
                request.ToPeerId,
                request.Type,
                request.Payload,
                DateTimeOffset.UtcNow);

            room.Signals.Add(signal);
            room.Peers.Add(fromPeerId);
            room.Peers.Add(request.ToPeerId);
            return signal;
        }
    }

    public IReadOnlyList<SignalMessage> GetSignals(string roomId, string peerId, long afterSequence)
    {
        var room = GetRoom(roomId);
        lock (room.Sync)
        {
            room.Peers.Add(peerId);
            return room.Signals
                .Where(s => s.ToPeerId == peerId && s.Sequence > afterSequence)
                .OrderBy(s => s.Sequence)
                .ToList();
        }
    }

    public HostEventMessage PublishHostEvent(string roomId, string hostPeerId, HostEventPublishRequest request)
    {
        var room = GetRoom(roomId);
        lock (room.Sync)
        {
            var next = ++room.EventSequence;
            var evt = new HostEventMessage(
                next,
                roomId,
                hostPeerId,
                request.Type,
                request.Payload,
                DateTimeOffset.UtcNow);

            room.Events.Add(evt);
            room.Peers.Add(hostPeerId);
            return evt;
        }
    }

    public IReadOnlyList<HostEventMessage> GetHostEvents(string roomId, long afterSequence)
    {
        var room = GetRoom(roomId);
        lock (room.Sync)
        {
            return room.Events
                .Where(e => e.Sequence > afterSequence)
                .OrderBy(e => e.Sequence)
                .ToList();
        }
    }

    private RoomState GetRoom(string roomId) =>
        _rooms.GetOrAdd(roomId, _ => new RoomState());

    private sealed class RoomState
    {
        public object Sync { get; } = new();
        public long SignalSequence { get; set; }
        public long EventSequence { get; set; }
        public HashSet<string> Peers { get; } = new(StringComparer.Ordinal);
        public List<SignalMessage> Signals { get; } = [];
        public List<HostEventMessage> Events { get; } = [];
    }
}
