using Risk.Host.Gameplay;
using Risk.Host.Networking;
using Risk.Engine.Packs;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<ISignalingService, InMemorySignalingService>();
builder.Services.AddSingleton<IMatchSessionService, InMemoryMatchSessionService>();
builder.Services.AddSingleton<MapPackLoader>();
builder.Services.AddSingleton<IRoomSessionService, InMemoryRoomSessionService>();

var app = builder.Build();

app.MapGet("/", () => Results.Ok(new { service = "Risk.Host", status = "ok" }));
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapPost("/api/rooms/{roomId}/peers/{peerId}/register",
    (string roomId, string peerId, ISignalingService signaling) =>
    {
        var result = signaling.RegisterPeer(roomId, peerId);
        return Results.Ok(result);
    });

app.MapPost("/api/rooms/{roomId}/peers/{peerId}/signal",
    (string roomId, string peerId, SignalSendRequest request, ISignalingService signaling) =>
    {
        if (string.IsNullOrWhiteSpace(request.ToPeerId) ||
            string.IsNullOrWhiteSpace(request.Type) ||
            string.IsNullOrWhiteSpace(request.Payload))
        {
            return Results.BadRequest("toPeerId, type and payload are required.");
        }

        var signal = signaling.SendSignal(roomId, peerId, request);
        return Results.Ok(signal);
    });

app.MapGet("/api/rooms/{roomId}/peers/{peerId}/signals",
    (string roomId, string peerId, long? after, ISignalingService signaling) =>
    {
        var signals = signaling.GetSignals(roomId, peerId, after ?? 0);
        return Results.Ok(signals);
    });

app.MapPost("/api/rooms/{roomId}/host/{hostPeerId}/events",
    (string roomId, string hostPeerId, HostEventPublishRequest request, ISignalingService signaling) =>
    {
        if (string.IsNullOrWhiteSpace(request.Type) ||
            string.IsNullOrWhiteSpace(request.Payload))
        {
            return Results.BadRequest("type and payload are required.");
        }

        var evt = signaling.PublishHostEvent(roomId, hostPeerId, request);
        return Results.Ok(evt);
    });

app.MapGet("/api/rooms/{roomId}/peers/{peerId}/events",
    (string roomId, string peerId, long? after, ISignalingService signaling) =>
    {
        // peerId reserved for future auth checks and filtering; currently host events are room-wide.
        var events = signaling.GetHostEvents(roomId, after ?? 0);
        return Results.Ok(events);
    });

app.MapPost("/api/matches/{matchId}/initialize",
    (string matchId, InitializeMatchRequest request, IMatchSessionService matches) =>
    {
        if (string.IsNullOrWhiteSpace(request.RoomId) ||
            string.IsNullOrWhiteSpace(request.HostPeerId) ||
            string.IsNullOrWhiteSpace(request.ActivePlayerId) ||
            request.Players.Count == 0 ||
            request.Territories.Count == 0)
        {
            return Results.BadRequest("roomId, hostPeerId, activePlayerId, players and territories are required.");
        }

        var response = matches.InitializeMatch(matchId, request);
        return Results.Ok(response);
    });

app.MapPost("/api/matches/{matchId}/commands",
    (string matchId, SubmitCommandRequest request, IMatchSessionService matches) =>
    {
        if (string.IsNullOrWhiteSpace(request.PeerId) || string.IsNullOrWhiteSpace(request.Type))
        {
            return Results.BadRequest("peerId and type are required.");
        }

        var response = matches.SubmitCommand(matchId, request);
        return response.Accepted
            ? Results.Ok(response)
            : Results.Conflict(response);
    });

app.MapPost("/api/rooms",
    (CreateRoomRequest request, IRoomSessionService rooms) =>
    {
        if (string.IsNullOrWhiteSpace(request.HostPeerId) ||
            string.IsNullOrWhiteSpace(request.HostDisplayName) ||
            string.IsNullOrWhiteSpace(request.MapId))
        {
            return Results.BadRequest("hostPeerId, hostDisplayName and mapId are required.");
        }

        var room = rooms.CreateRoom(request);
        return Results.Ok(room);
    });

app.MapPost("/api/rooms/{roomId}/join",
    (string roomId, JoinRoomRequest request, IRoomSessionService rooms) =>
    {
        if (string.IsNullOrWhiteSpace(request.PeerId) || string.IsNullOrWhiteSpace(request.DisplayName))
        {
            return Results.BadRequest("peerId and displayName are required.");
        }

        try
        {
            var room = rooms.JoinRoom(roomId, request);
            return Results.Ok(room);
        }
        catch (InvalidOperationException ex)
        {
            return Results.Conflict(new { message = ex.Message });
        }
    });

app.MapPost("/api/rooms/{roomId}/leave",
    (string roomId, LeaveRoomRequest request, IRoomSessionService rooms) =>
    {
        if (string.IsNullOrWhiteSpace(request.PeerId))
        {
            return Results.BadRequest("peerId is required.");
        }

        try
        {
            var room = rooms.LeaveRoom(roomId, request);
            return Results.Ok(room);
        }
        catch (InvalidOperationException ex)
        {
            return Results.Conflict(new { message = ex.Message });
        }
    });

app.MapPost("/api/rooms/{roomId}/start",
    async (string roomId, StartMatchRequest request, IRoomSessionService rooms, CancellationToken cancellationToken) =>
    {
        if (string.IsNullOrWhiteSpace(request.HostPeerId))
        {
            return Results.BadRequest("hostPeerId is required.");
        }

        try
        {
            var match = await rooms.StartMatchAsync(roomId, request, cancellationToken);
            return Results.Ok(match);
        }
        catch (InvalidOperationException ex)
        {
            return Results.Conflict(new { message = ex.Message });
        }
    });

app.Run();

public partial class Program;
