using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Risk.Host.Gameplay;
using Risk.Host.Networking;

namespace Risk.Host.Tests;

public class ReconnectApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ReconnectApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Reconnect_WithValidToken_ReplaysMissingEventsAfterSequence()
    {
        var createRoomResponse = await _client.PostAsJsonAsync(
            "/api/rooms",
            new CreateRoomRequest("host-r1", "Host", "world-classic"));
        createRoomResponse.EnsureSuccessStatusCode();
        var room = await createRoomResponse.Content.ReadFromJsonAsync<CreateRoomResponse>();
        Assert.NotNull(room);

        var joinResponse = await _client.PostAsJsonAsync(
            $"/api/rooms/{room!.RoomId}/join",
            new JoinRoomRequest("peer-r1", "Peer"));
        joinResponse.EnsureSuccessStatusCode();

        var startResponse = await _client.PostAsJsonAsync(
            $"/api/rooms/{room.RoomId}/start",
            new StartMatchRequest("host-r1", "world-classic", 4242));
        startResponse.EnsureSuccessStatusCode();
        var start = await startResponse.Content.ReadFromJsonAsync<StartMatchResponse>();
        Assert.NotNull(start);
        Assert.NotNull(start!.ReconnectTokens);
        Assert.True(start.ReconnectTokens.Count >= 2);

        var publishResponse = await _client.PostAsJsonAsync(
            $"/api/rooms/{room.RoomId}/host/host-r1/events",
            new HostEventPublishRequest("TurnStarted", "{\"turn\":1}"));
        publishResponse.EnsureSuccessStatusCode();

        var peerToken = start.ReconnectTokens.Single(t => t.PeerId == "peer-r1").PlayerToken;
        var reconnectResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{start.MatchId}/reconnect",
            new ReconnectRequest("peer-r1", peerToken, 0));
        reconnectResponse.EnsureSuccessStatusCode();

        var payload = await reconnectResponse.Content.ReadFromJsonAsync<ReconnectResponse>();
        Assert.NotNull(payload);
        Assert.True(payload!.Accepted);
        Assert.Equal(start.MatchId, payload.MatchId);
        Assert.Equal(room.RoomId, payload.RoomId);
        Assert.Single(payload.MissingEvents);
        Assert.Equal("TurnStarted", payload.MissingEvents[0].Type);
    }

    [Fact]
    public async Task Reconnect_WithInvalidToken_ReturnsUnauthorized()
    {
        var createRoomResponse = await _client.PostAsJsonAsync(
            "/api/rooms",
            new CreateRoomRequest("host-r2", "Host", "world-classic"));
        createRoomResponse.EnsureSuccessStatusCode();
        var room = await createRoomResponse.Content.ReadFromJsonAsync<CreateRoomResponse>();
        Assert.NotNull(room);

        await _client.PostAsJsonAsync(
            $"/api/rooms/{room!.RoomId}/join",
            new JoinRoomRequest("peer-r2", "Peer"));

        var startResponse = await _client.PostAsJsonAsync(
            $"/api/rooms/{room.RoomId}/start",
            new StartMatchRequest("host-r2", "world-classic", 99));
        startResponse.EnsureSuccessStatusCode();
        var start = await startResponse.Content.ReadFromJsonAsync<StartMatchResponse>();
        Assert.NotNull(start);

        var reconnectResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{start!.MatchId}/reconnect",
            new ReconnectRequest("peer-r2", "wrong-token", 0));

        Assert.Equal(HttpStatusCode.Unauthorized, reconnectResponse.StatusCode);
    }
}
