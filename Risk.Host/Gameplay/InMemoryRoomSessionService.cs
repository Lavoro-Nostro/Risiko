using System.Collections.Concurrent;
using Risk.Engine.Domain.State;
using Risk.Engine.Packs;

namespace Risk.Host.Gameplay;

public sealed class InMemoryRoomSessionService : IRoomSessionService
{
    private static readonly string[] PlayerColorCycle = ["red", "purple", "yellow", "green", "blue", "black"];
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
        var roomName = string.IsNullOrWhiteSpace(request.RoomName)
            ? $"Lobby {roomId}"
            : request.RoomName.Trim();
        var normalizedClientId = NormalizeClientId(request.ClientId, request.HostPeerId);
        var host = new RoomParticipant(
            request.HostPeerId,
            request.HostDisplayName,
            DateTimeOffset.UtcNow,
            normalizedClientId);

        var room = new RoomSession(
            roomId,
            roomName,
            request.HostPeerId,
            request.MapId,
            [host]);

        _rooms[roomId] = room;
        return new CreateRoomResponse(
            roomId,
            room.RoomName,
            request.HostPeerId,
            request.MapId,
            room.Status.ToString().ToLowerInvariant(),
            room.Participants.ToList());
    }

    public IReadOnlyList<RoomLobbySummary> ListRooms()
    {
        return _rooms.Values
            .Select(room =>
            {
                lock (room.Sync)
                {
                    return new RoomLobbySummary(
                        room.RoomId,
                        room.RoomName,
                        room.HostPeerId,
                        room.MapId,
                        room.Status.ToString().ToLowerInvariant(),
                        room.Participants.Count,
                        6);
                }
            })
            .OrderBy(room => room.RoomId, StringComparer.Ordinal)
            .ToList();
    }

    public RoomSnapshotResponse? GetRoom(string roomId)
    {
        if (!_rooms.TryGetValue(roomId, out var room))
        {
            return null;
        }

        lock (room.Sync)
        {
            return new RoomSnapshotResponse(
                room.RoomId,
                room.RoomName,
                room.HostPeerId,
                room.MapId,
                room.Status.ToString().ToLowerInvariant(),
                room.ActiveMatchId,
                room.Participants.ToList());
        }
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
            var normalizedClientId = NormalizeClientId(request.ClientId, request.PeerId);

            if (room.Participants.Any(p => p.PeerId == request.PeerId))
            {
                return new JoinRoomResponse(
                    roomId,
                    room.RoomName,
                    room.MapId,
                    room.HostPeerId,
                    room.Status.ToString().ToLowerInvariant(),
                    room.ActiveMatchId,
                    room.Participants.ToList());
            }

            var existingByClient = room.Participants.FindIndex(participant =>
                string.Equals(NormalizeClientId(participant.ClientId, participant.PeerId), normalizedClientId, StringComparison.Ordinal));
            if (existingByClient >= 0)
            {
                var previous = room.Participants[existingByClient];
                var isExistingHostSeat = string.Equals(room.HostPeerId, previous.PeerId, StringComparison.Ordinal);
                if (isExistingHostSeat && !string.Equals(previous.PeerId, request.PeerId, StringComparison.Ordinal))
                {
                    throw new InvalidOperationException("Host seat cannot be resumed via join with a different peer id.");
                }
                room.Participants[existingByClient] = previous with
                {
                    PeerId = request.PeerId,
                    DisplayName = request.DisplayName,
                    ClientId = normalizedClientId
                };

                if (string.Equals(room.HostPeerId, previous.PeerId, StringComparison.Ordinal))
                {
                    room.HostPeerId = request.PeerId;
                }

                return new JoinRoomResponse(
                    roomId,
                    room.RoomName,
                    room.MapId,
                    room.HostPeerId,
                    room.Status.ToString().ToLowerInvariant(),
                    room.ActiveMatchId,
                    room.Participants.ToList());
            }

            if (room.Participants.Count >= 6)
            {
                throw new InvalidOperationException("Room is full (max 6 players).");
            }

            room.Participants.Add(new RoomParticipant(request.PeerId, request.DisplayName, DateTimeOffset.UtcNow, normalizedClientId));
            return new JoinRoomResponse(
                roomId,
                room.RoomName,
                room.MapId,
                room.HostPeerId,
                room.Status.ToString().ToLowerInvariant(),
                room.ActiveMatchId,
                room.Participants.ToList());
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
        var rngSeed = request.RngSeed ?? Random.Shared.Next(1, int.MaxValue);
        var random = new Random(rngSeed);
        var shuffledTerritories = Shuffle(pack.Territories.Select(t => t.Id).ToList(), random);

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
        var setupRemainingForActive = Math.Max(0, GetStartingArmies(playerStates.Count) - activeOwnedCount);
        var reinforcementPool = Math.Min(3, setupRemainingForActive);
        var objectivesByPlayerId = BuildObjectives(playerStates, random);
        var (cardSymbolById, drawPileCardIds) = BuildShuffledDeck(shuffledTerritories, random);
        var cardIdsByPlayerId = playerStates.ToDictionary(
            player => player.PlayerId,
            _ => (IReadOnlyList<string>)[],
            StringComparer.Ordinal);
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
                rngSeed,
                objectivesByPlayerId,
                cardIdsByPlayerId,
                cardSymbolById,
                drawPileCardIds,
                TradeBonusStep: 0));

        lock (room.Sync)
        {
            room.Status = RoomStatus.InMatch;
            room.ActiveMatchId = matchId;
            room.MapId = mapId;
            room.PlayerTokens = new Dictionary<string, string>(playerTokens, StringComparer.Ordinal);
            return new StartMatchResponse(
                roomId,
                room.RoomName,
                matchId,
                mapId,
                room.HostPeerId,
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

    private static IReadOnlyDictionary<string, PlayerObjectiveState> BuildObjectives(
        IReadOnlyList<PlayerState> players,
        Random random)
    {
        var playerColorById = players
            .Select((player, index) => new { player.PlayerId, Color = PlayerColorCycle[index % PlayerColorCycle.Length] })
            .ToDictionary(x => x.PlayerId, x => x.Color, StringComparer.Ordinal);
        var colorsPresent = new HashSet<string>(playerColorById.Values, StringComparer.Ordinal);
        var deck = BuildOfficialObjectiveDeck().ToList();
        var objectives = new Dictionary<string, PlayerObjectiveState>(StringComparer.Ordinal);

        for (var i = 0; i < players.Count; i++)
        {
            var owner = players[i];
            var compatible = deck
                .Select((template, index) => new { template, index })
                .Where(x => IsObjectiveCompatible(x.template, owner.PlayerId, playerColorById, colorsPresent))
                .ToList();
            ObjectiveTemplate? template = null;
            if (compatible.Count > 0)
            {
                var picked = compatible[random.Next(compatible.Count)];
                template = picked.template;
                deck.RemoveAt(picked.index);
            }

            objectives[owner.PlayerId] = template is null
                ? BuildFallbackTerritoryObjective(owner.PlayerId)
                : MaterializeObjective(template, owner, players, playerColorById);
        }

        return objectives;
    }

    private static bool IsObjectiveCompatible(
        ObjectiveTemplate template,
        string ownerPlayerId,
        IReadOnlyDictionary<string, string> playerColorById,
        IReadOnlySet<string> colorsPresent)
    {
        if (!string.Equals(template.Kind, "eliminate_player", StringComparison.Ordinal))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(template.EliminateColor))
        {
            return false;
        }

        if (!playerColorById.TryGetValue(ownerPlayerId, out var ownerColor))
        {
            return false;
        }

        return colorsPresent.Contains(template.EliminateColor) &&
               !string.Equals(ownerColor, template.EliminateColor, StringComparison.Ordinal);
    }

    private static PlayerObjectiveState MaterializeObjective(
        ObjectiveTemplate template,
        PlayerState owner,
        IReadOnlyList<PlayerState> players,
        IReadOnlyDictionary<string, string> playerColorById)
    {
        if (!string.Equals(template.Kind, "eliminate_player", StringComparison.Ordinal))
        {
            return new PlayerObjectiveState(
                owner.PlayerId,
                template.ObjectiveId,
                template.Title,
                template.Description,
                template.Kind,
                template.TargetTerritoryCount,
                template.RequiredArmiesPerTerritory,
                template.RequiredContinentIds,
                template.RequiredAdditionalContinentCount,
                null);
        }

        if (string.IsNullOrWhiteSpace(template.EliminateColor))
        {
            return BuildFallbackTerritoryObjective(owner.PlayerId);
        }

        var chosen = players.FirstOrDefault(player =>
            !string.Equals(player.PlayerId, owner.PlayerId, StringComparison.Ordinal) &&
            playerColorById.TryGetValue(player.PlayerId, out var color) &&
            string.Equals(color, template.EliminateColor, StringComparison.Ordinal));

        if (chosen is null)
        {
            return BuildFallbackTerritoryObjective(owner.PlayerId);
        }

        var colorName = ToItalianColorName(template.EliminateColor);
        var title = $"Distruggi {colorName}";
        var description = $"Distruggi totalmente l'armata {colorName}. Se impossibile, conquista 24 territori.";
        return new PlayerObjectiveState(
            owner.PlayerId,
            $"{template.ObjectiveId}:{chosen.PlayerId}",
            title,
            description,
            "eliminate_player",
            TargetTerritoryCount: 24,
            EliminateTargetPlayerId: chosen.PlayerId);
    }

    private static PlayerObjectiveState BuildFallbackTerritoryObjective(string playerId) =>
        new(
            playerId,
            "obj-fallback-24",
            "Conquer 24 Territories",
            "Conquer 24 territories.",
            "territory_count",
            TargetTerritoryCount: 24);

    private static IReadOnlyList<ObjectiveTemplate> BuildOfficialObjectiveDeck() =>
    [
        new(
            "obj-24",
            "Conquista 24 Territori",
            "Conquista 24 territori.",
            "territory_count",
            TargetTerritoryCount: 24),
        new(
            "obj-18-2",
            "Conquista 18 con 2 Armate",
            "Conquista 18 territori e occupali con almeno 2 armate ciascuno.",
            "territory_with_min_armies",
            TargetTerritoryCount: 18,
            RequiredArmiesPerTerritory: 2),
        new(
            "obj-eu-au-plus1",
            "Europa + Oceania + 1",
            "Conquista Europa, Oceania e un altro continente a scelta.",
            "continent_combo",
            RequiredContinentIds: ["europe", "australia"],
            RequiredAdditionalContinentCount: 1),
        new(
            "obj-eu-sa-plus1",
            "Europa + Sud America + 1",
            "Conquista Europa, Sud America e un altro continente a scelta.",
            "continent_combo",
            RequiredContinentIds: ["europe", "south_america"],
            RequiredAdditionalContinentCount: 1),
        new(
            "obj-na-af",
            "Nord America + Africa",
            "Conquista Nord America e Africa.",
            "continent_combo",
            RequiredContinentIds: ["north_america", "africa"]),
        new(
            "obj-na-au",
            "Nord America + Oceania",
            "Conquista Nord America e Oceania.",
            "continent_combo",
            RequiredContinentIds: ["north_america", "australia"]),
        new(
            "obj-as-sa",
            "Asia + Sud America",
            "Conquista Asia e Sud America.",
            "continent_combo",
            RequiredContinentIds: ["asia", "south_america"]),
        new(
            "obj-as-af",
            "Asia + Africa",
            "Conquista Asia e Africa.",
            "continent_combo",
            RequiredContinentIds: ["asia", "africa"]),
        new("obj-elim-red", "Distruggi Rosso", "Distruggi totalmente l'armata rossa.", "eliminate_player", EliminateColor: "red"),
        new("obj-elim-blue", "Distruggi Blu", "Distruggi totalmente l'armata blu.", "eliminate_player", EliminateColor: "blue"),
        new("obj-elim-green", "Distruggi Verde", "Distruggi totalmente l'armata verde.", "eliminate_player", EliminateColor: "green"),
        new("obj-elim-yellow", "Distruggi Giallo", "Distruggi totalmente l'armata gialla.", "eliminate_player", EliminateColor: "yellow"),
        new("obj-elim-purple", "Distruggi Viola", "Distruggi totalmente l'armata viola.", "eliminate_player", EliminateColor: "purple"),
        new("obj-elim-black", "Distruggi Nero", "Distruggi totalmente l'armata nera.", "eliminate_player", EliminateColor: "black")
    ];

    private static (IReadOnlyDictionary<string, string> cardSymbolById, IReadOnlyList<string> drawPileCardIds) BuildShuffledDeck(
        IReadOnlyList<string> territoryIds,
        Random random)
    {
        var symbols = new[] { "infantry", "cavalry", "artillery" };
        var cardSymbolById = new Dictionary<string, string>(StringComparer.Ordinal);
        var drawPile = new List<string>(territoryIds.Count + 2);

        for (var i = 0; i < territoryIds.Count; i++)
        {
            var cardId = $"territory:{territoryIds[i]}";
            cardSymbolById[cardId] = symbols[i % symbols.Length];
            drawPile.Add(cardId);
        }

        cardSymbolById["joker:1"] = "joker";
        cardSymbolById["joker:2"] = "joker";
        drawPile.Add("joker:1");
        drawPile.Add("joker:2");

        return (cardSymbolById, Shuffle(drawPile, random));
    }

    private static int GetStartingArmies(int playerCount) =>
        playerCount switch
        {
            2 => 40,
            3 => 35,
            4 => 30,
            5 => 25,
            6 => 20,
            _ => 20
        };

    private static List<T> Shuffle<T>(List<T> values, Random random)
    {
        for (var i = values.Count - 1; i > 0; i--)
        {
            var j = random.Next(i + 1);
            (values[i], values[j]) = (values[j], values[i]);
        }

        return values;
    }

    private static string NormalizeClientId(string? clientId, string fallbackPeerId)
    {
        return string.IsNullOrWhiteSpace(clientId) ? fallbackPeerId : clientId.Trim();
    }

    private sealed record ObjectiveTemplate(
        string ObjectiveId,
        string Title,
        string Description,
        string Kind,
        int TargetTerritoryCount = 0,
        int RequiredArmiesPerTerritory = 0,
        IReadOnlyList<string>? RequiredContinentIds = null,
        int RequiredAdditionalContinentCount = 0,
        string? EliminateColor = null);

    private static string ToItalianColorName(string colorId) =>
        colorId.ToLowerInvariant() switch
        {
            "red" => "Rossa",
            "blue" => "Blu",
            "green" => "Verde",
            "yellow" => "Gialla",
            "purple" => "Viola",
            "black" => "Nera",
            _ => colorId
        };

    private sealed class RoomSession
    {
        public RoomSession(
            string roomId,
            string roomName,
            string hostPeerId,
            string mapId,
            List<RoomParticipant> participants)
        {
            RoomId = roomId;
            RoomName = roomName;
            HostPeerId = hostPeerId;
            MapId = mapId;
            Participants = participants;
        }

        public object Sync { get; } = new();
        public string RoomId { get; }
        public string RoomName { get; }
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
