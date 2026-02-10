using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Risk.Engine.Contracts.Validation;
using Risk.Engine.Domain.State;
using Risk.Host.Gameplay;
using Risk.Host.Networking;

namespace Risk.Host.Tests;

public class CommandFlowApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public CommandFlowApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task SubmitCommand_AppliesEngineTransition_AndBroadcastsEvents()
    {
        var matchId = "match-10";
        var roomId = "room-10";

        var initResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{matchId}/initialize",
            BuildInitializeRequest(roomId));
        initResponse.EnsureSuccessStatusCode();

        var submitResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{matchId}/commands",
            new SubmitCommandRequest(
                "peer-2",
                "PlaceReinforcements",
                JsonSerializer.SerializeToElement(new
                {
                    playerId = "p1",
                    commandId = "cmd-001",
                    territoryId = "alaska",
                    armiesToPlace = 2
                })));

        submitResponse.EnsureSuccessStatusCode();
        var submitPayload = await submitResponse.Content.ReadFromJsonAsync<SubmitCommandResponse>();
        Assert.NotNull(submitPayload);
        Assert.True(submitPayload!.Accepted);
        Assert.Equal(CommandErrorCode.None, submitPayload.ErrorCode);
        Assert.Equal(1, submitPayload.AppliedEventCount);

        var eventsResponse = await _client.GetAsync($"/api/rooms/{roomId}/peers/peer-2/events?after=0");
        eventsResponse.EnsureSuccessStatusCode();
        var events = await eventsResponse.Content.ReadFromJsonAsync<List<HostEventMessage>>();

        Assert.NotNull(events);
        Assert.Single(events!);
        Assert.Equal("host-peer", events[0].HostPeerId);
        Assert.Equal("ReinforcementsPlacedEvent", events[0].Type);
    }

    [Fact]
    public async Task SubmitCommand_Rejected_ReturnsReasonCode_AndNoBroadcast()
    {
        var matchId = "match-11";
        var roomId = "room-11";

        var initResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{matchId}/initialize",
            BuildInitializeRequest(roomId));
        initResponse.EnsureSuccessStatusCode();

        var submitResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{matchId}/commands",
            new SubmitCommandRequest(
                "peer-2",
                "EndTurn",
                JsonSerializer.SerializeToElement(new
                {
                    playerId = "p1",
                    commandId = "cmd-002"
                })));

        Assert.Equal(HttpStatusCode.Conflict, submitResponse.StatusCode);
        var submitPayload = await submitResponse.Content.ReadFromJsonAsync<SubmitCommandResponse>();
        Assert.NotNull(submitPayload);
        Assert.False(submitPayload!.Accepted);
        Assert.Equal(CommandErrorCode.InvalidPhase, submitPayload.ErrorCode);
        Assert.Equal(0, submitPayload.AppliedEventCount);

        var eventsResponse = await _client.GetAsync($"/api/rooms/{roomId}/peers/peer-2/events?after=0");
        eventsResponse.EnsureSuccessStatusCode();
        var events = await eventsResponse.Content.ReadFromJsonAsync<List<HostEventMessage>>();
        Assert.NotNull(events);
        Assert.Empty(events!);
    }

    private static InitializeMatchRequest BuildInitializeRequest(string roomId) =>
        new(
            roomId,
            "host-peer",
            [
                new PlayerState("p1", "Player 1"),
                new PlayerState("p2", "Player 2")
            ],
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["p1"] = "token-p1",
                ["p2"] = "token-p2"
            },
            [
                new ContinentState("north_america", 5, ["alaska", "alberta"])
            ],
            [
                new TerritoryState("alaska", "p1", 5, ["alberta"]),
                new TerritoryState("alberta", "p2", 3, ["alaska"])
            ],
            "p1",
            5,
            123);
}
