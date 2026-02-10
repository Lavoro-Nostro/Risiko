using System.Collections.Concurrent;
using Risk.Engine.Domain.State;
using Risk.Engine.Packs;

namespace Risk.Host.Gameplay;

public sealed class InMemoryRoomSessionService : IRoomSessionService
{
    private readonly ConcurrentDictionary<string, RoomSession> _rooms = new(StringComparer.Ordinal);
    private readonly IMatchSessionService _matchSessionService;
    private readonly MapPackLoader _mapPackLoader;
    private readonly IWebHostEnvironment _environment;

    public InMemoryRoomSessionService(
        IMatchSessionService matchSessionService,
        MapPackLoader mapPackLoader,
        IWebHostEnvironment environment)
    {
        _matchSessionService = matchSessionService;
        _mapPackLoader = mapPackLoader;
        _environment = environment;
    }

    public CreateRoomResponse CreateRoom(CreateRoomRequest request)
    {
        var roomId = $"room-{Guid.NewGuid():N}"[..13];
        var host = new RoomParticipant(
            request.HostPeerId,
            request.HostDisplayName,
            DateTimeOffset.UtcNow);

        var room = new RoomSession(
            roomId,
            request.HostPeerId,
            request.MapId,
            [host]);

        _rooms[roomId] = room;
        return new CreateRoomResponse(
            roomId,
            request.HostPeerId,
            request.MapId,
            room.Status.ToString().ToLowerInvariant(),
            room.Participants.ToList());
    }

    public JoinRoomResponse JoinRoom(string roomId, JoinRoomRequest request)
    {
        if (!_rooms.TryGetValue(roomId, out var room))
        {
            throw new InvalidOperationException("Room not found.");
        }

        lock (room.Sync)
        {
            if (room.Status != RoomStatus.Open)
            {
                throw new InvalidOperationException("Room is not open.");
            }

            if (room.Participants.Any(p => p.PeerId == request.PeerId))
            {
                return new JoinRoomResponse(roomId, room.MapId, room.Status.ToString().ToLowerInvariant(), room.Participants.ToList());
            }

            if (room.Participants.Count >= 6)
            {
                throw new InvalidOperationException("Room is full (max 6 players).");
            }

            room.Participants.Add(new RoomParticipant(request.PeerId, request.DisplayName, DateTimeOffset.UtcNow));
            return new JoinRoomResponse(roomId, room.MapId, room.Status.ToString().ToLowerInvariant(), room.Participants.ToList());
        }
    }

    public LeaveRoomResponse LeaveRoom(string roomId, LeaveRoomRequest request)
    {
        if (!_rooms.TryGetValue(roomId, out var room))
        {
            throw new InvalidOperationException("Room not found.");
        }

        lock (room.Sync)
        {
            var removed = room.Participants.RemoveAll(p => p.PeerId == request.PeerId);
            if (removed == 0)
            {
                throw new InvalidOperationException("Peer is not in room.");
            }

            if (request.PeerId == room.HostPeerId && room.Participants.Count > 0)
            {
                room.HostPeerId = room.Participants[0].PeerId;
            }

            if (room.Participants.Count == 0)
            {
                room.Status = RoomStatus.Closed;
                _rooms.TryRemove(roomId, out _);
                return new LeaveRoomResponse(roomId, "closed", []);
            }

            return new LeaveRoomResponse(roomId, room.Status.ToString().ToLowerInvariant(), room.Participants.ToList());
        }
    }

    public async Task<StartMatchResponse> StartMatchAsync(string roomId, StartMatchRequest request, CancellationToken cancellationToken = default)
    {
        if (!_rooms.TryGetValue(roomId, out var room))
        {
            throw new InvalidOperationException("Room not found.");
        }

        IReadOnlyList<RoomParticipant> participants;
        string hostPeerId;
        string mapId;

        lock (room.Sync)
        {
            if (room.Status != RoomStatus.Open)
            {
                throw new InvalidOperationException("Room is not open.");
            }

            if (!string.Equals(room.HostPeerId, request.HostPeerId, StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Only room host can start the match.");
            }

            if (room.Participants.Count < 2)
            {
                throw new InvalidOperationException("At least 2 players are required.");
            }

            mapId = string.IsNullOrWhiteSpace(request.MapId) ? room.MapId : request.MapId;
            hostPeerId = room.HostPeerId;
            participants = room.Participants.ToList();
        }

        var mapDirectory = ResolveMapDirectory(mapId);
        var pack = await _mapPackLoader.LoadAsync(mapDirectory, cancellationToken);
        var validation = _mapPackLoader.Validate(pack);
        if (!validation.IsValid)
        {
            throw new InvalidOperationException($"Invalid map pack '{mapId}': {string.Join("; ", validation.Errors)}");
        }

        var matchId = $"match-{Guid.NewGuid():N}";
        var rngSeed = request.RngSeed ?? 12345;
        var shuffledTerritories = Shuffle(pack.Territories.Select(t => t.Id).ToList(), rngSeed);

        var playerStates = participants
            .Select(p => new PlayerState(p.PeerId, p.DisplayName))
            .ToList();

        var territoryStates = new List<TerritoryState>(shuffledTerritories.Count);
        for (var i = 0; i < shuffledTerritories.Count; i++)
        {
            var territoryId = shuffledTerritories[i];
            var owner = playerStates[i % playerStates.Count];
            var mapTerritory = pack.Territories.First(t => t.Id == territoryId);
            territoryStates.Add(new TerritoryState(territoryId, owner.PlayerId, 1, mapTerritory.Neighbors));
        }

        var continentStates = pack.Continents
            .Select(continent => new ContinentState(continent.Id, continent.Bonus, continent.Territories))
            .ToList();

        var activePlayerId = playerStates[0].PlayerId;
        var activeOwnedCount = territoryStates.Count(t => t.OwnerPlayerId == activePlayerId);
        var reinforcementPool = Math.Max(3, activeOwnedCount / 3);
        var playerTokens = participants.ToDictionary(
            participant => participant.PeerId,
            _ => Guid.NewGuid().ToString("N"),
            StringComparer.Ordinal);

        _matchSessionService.InitializeMatch(
            matchId,
            new InitializeMatchRequest(
                roomId,
                hostPeerId,
                playerStates,
                playerTokens,
                continentStates,
                territoryStates,
                activePlayerId,
                reinforcementPool,
                rngSeed));

        lock (room.Sync)
        {
            room.Status = RoomStatus.InMatch;
            room.ActiveMatchId = matchId;
            room.MapId = mapId;
            room.PlayerTokens = new Dictionary<string, string>(playerTokens, StringComparer.Ordinal);
            return new StartMatchResponse(
                roomId,
                matchId,
                mapId,
                room.Status.ToString().ToLowerInvariant(),
                room.Participants.ToList(),
                playerTokens
                    .OrderBy(x => x.Key, StringComparer.Ordinal)
                    .Select(x => new PlayerReconnectToken(x.Key, x.Value))
                    .ToList());
        }
    }

    private string ResolveMapDirectory(string mapId)
    {
        var absolute = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, "..", "packs", "maps", mapId));
        if (!Directory.Exists(absolute))
        {
            throw new InvalidOperationException($"Map pack directory not found for mapId '{mapId}'.");
        }

        return absolute;
    }

    private static List<string> Shuffle(List<string> values, int seed)
    {
        var random = new Random(seed);
        for (var i = values.Count - 1; i > 0; i--)
        {
            var j = random.Next(i + 1);
            (values[i], values[j]) = (values[j], values[i]);
        }

        return values;
    }

    private sealed class RoomSession
    {
        public RoomSession(
            string roomId,
            string hostPeerId,
            string mapId,
            List<RoomParticipant> participants)
        {
            RoomId = roomId;
            HostPeerId = hostPeerId;
            MapId = mapId;
            Participants = participants;
        }

        public object Sync { get; } = new();
        public string RoomId { get; }
        public string HostPeerId { get; set; }
        public string MapId { get; set; }
        public List<RoomParticipant> Participants { get; }
        public RoomStatus Status { get; set; } = RoomStatus.Open;
        public string? ActiveMatchId { get; set; }
        public IReadOnlyDictionary<string, string>? PlayerTokens { get; set; }
    }

    private enum RoomStatus
    {
        Open = 0,
        InMatch = 1,
        Closed = 2
    }
}
