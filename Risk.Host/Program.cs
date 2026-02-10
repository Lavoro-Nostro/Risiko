using Risk.Host.Networking;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<ISignalingService, InMemorySignalingService>();

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

app.Run();

public partial class Program;
