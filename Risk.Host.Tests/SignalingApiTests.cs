using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Risk.Host.Networking;

namespace Risk.Host.Tests;

public class SignalingApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public SignalingApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task RegisterPeer_ReturnsPeerAndRoomState()
    {
        var response = await _client.PostAsync("/api/rooms/r1/peers/p1/register", null);
        response.EnsureSuccessStatusCode();

        var payload = await response.Content.ReadFromJsonAsync<RegisterPeerResponse>();
        Assert.NotNull(payload);
        Assert.Equal("r1", payload!.RoomId);
        Assert.Equal("p1", payload.PeerId);
        Assert.Contains("p1", payload.ActivePeers);
    }

    [Fact]
    public async Task SendSignal_ThenPollSignals_DeliversToTargetPeer()
    {
        var send = await _client.PostAsJsonAsync(
            "/api/rooms/r2/peers/p1/signal",
            new SignalSendRequest("p2", "offer", "{\"sdp\":\"abc\"}"));
        send.EnsureSuccessStatusCode();

        var poll = await _client.GetAsync("/api/rooms/r2/peers/p2/signals?after=0");
        poll.EnsureSuccessStatusCode();
        var messages = await poll.Content.ReadFromJsonAsync<List<SignalMessage>>();

        Assert.NotNull(messages);
        Assert.Single(messages!);
        Assert.Equal("p1", messages[0].FromPeerId);
        Assert.Equal("p2", messages[0].ToPeerId);
        Assert.Equal("offer", messages[0].Type);
    }

    [Fact]
    public async Task PollSignals_AfterSequence_FiltersOldMessages()
    {
        await _client.PostAsJsonAsync(
            "/api/rooms/r3/peers/host/signal",
            new SignalSendRequest("peer", "offer", "1"));
        await _client.PostAsJsonAsync(
            "/api/rooms/r3/peers/host/signal",
            new SignalSendRequest("peer", "ice", "2"));

        var poll = await _client.GetAsync("/api/rooms/r3/peers/peer/signals?after=1");
        poll.EnsureSuccessStatusCode();
        var messages = await poll.Content.ReadFromJsonAsync<List<SignalMessage>>();

        Assert.NotNull(messages);
        Assert.Single(messages!);
        Assert.Equal(2, messages[0].Sequence);
        Assert.Equal("ice", messages[0].Type);
    }

    [Fact]
    public async Task PublishHostEvent_ThenPeersCanPollEvents()
    {
        var publish = await _client.PostAsJsonAsync(
            "/api/rooms/r4/host/host-peer/events",
            new HostEventPublishRequest("AttackResolved", "{\"from\":\"alaska\"}"));
        publish.EnsureSuccessStatusCode();

        var eventsResponse = await _client.GetAsync("/api/rooms/r4/peers/p2/events?after=0");
        eventsResponse.EnsureSuccessStatusCode();
        var eventsPayload = await eventsResponse.Content.ReadFromJsonAsync<List<HostEventMessage>>();

        Assert.NotNull(eventsPayload);
        Assert.Single(eventsPayload!);
        Assert.Equal("host-peer", eventsPayload[0].HostPeerId);
        Assert.Equal("AttackResolved", eventsPayload[0].Type);
    }

    [Fact]
    public async Task InvalidSignalPayload_ReturnsBadRequest()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/rooms/r5/peers/p1/signal",
            new SignalSendRequest("", "offer", ""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
