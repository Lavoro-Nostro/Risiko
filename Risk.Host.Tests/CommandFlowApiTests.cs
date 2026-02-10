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

    [Fact]
    public async Task MatchStateEndpoint_ReturnsAuthoritativeStateSnapshot()
    {
        var matchId = "match-12";
        var roomId = "room-12";

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
                    commandId = "cmd-003",
                    territoryId = "alaska",
                    armiesToPlace = 1
                })));
        submitResponse.EnsureSuccessStatusCode();

        var stateResponse = await _client.GetAsync($"/api/matches/{matchId}/state");
        stateResponse.EnsureSuccessStatusCode();

        var payload = await stateResponse.Content.ReadFromJsonAsync<MatchStateResponse>();
        Assert.NotNull(payload);
        Assert.Equal(matchId, payload!.MatchId);
        Assert.Equal(roomId, payload.RoomId);
        Assert.True(payload.State.Territories.ContainsKey("alaska"));
        Assert.Equal(6, payload.State.Territories["alaska"].Armies);
        Assert.Equal("p1", payload.State.Territories["alaska"].OwnerPlayerId);
    }

    [Fact]
    public async Task SubmitCommand_MultipleAcceptedCommands_PublishOrderedEvents()
    {
        var matchId = "match-13";
        var roomId = "room-13";

        var initResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{matchId}/initialize",
            BuildInitializeRequest(roomId));
        initResponse.EnsureSuccessStatusCode();

        var firstResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{matchId}/commands",
            new SubmitCommandRequest(
                "peer-2",
                "PlaceReinforcements",
                JsonSerializer.SerializeToElement(new
                {
                    playerId = "p1",
                    commandId = "cmd-101",
                    territoryId = "alaska",
                    armiesToPlace = 1
                })));
        firstResponse.EnsureSuccessStatusCode();

        var secondResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{matchId}/commands",
            new SubmitCommandRequest(
                "peer-2",
                "PlaceReinforcements",
                JsonSerializer.SerializeToElement(new
                {
                    playerId = "p1",
                    commandId = "cmd-102",
                    territoryId = "alaska",
                    armiesToPlace = 1
                })));
        secondResponse.EnsureSuccessStatusCode();

        var eventsResponse = await _client.GetAsync($"/api/rooms/{roomId}/peers/peer-2/events?after=0");
        eventsResponse.EnsureSuccessStatusCode();
        var events = await eventsResponse.Content.ReadFromJsonAsync<List<HostEventMessage>>();

        Assert.NotNull(events);
        Assert.Equal(2, events!.Count);
        Assert.Equal(1, events[0].Sequence);
        Assert.Equal(2, events[1].Sequence);
        Assert.All(events, e => Assert.Equal("ReinforcementsPlacedEvent", e.Type));

        var afterFirstResponse = await _client.GetAsync($"/api/rooms/{roomId}/peers/peer-2/events?after=1");
        afterFirstResponse.EnsureSuccessStatusCode();
        var afterFirstEvents = await afterFirstResponse.Content.ReadFromJsonAsync<List<HostEventMessage>>();
        Assert.NotNull(afterFirstEvents);
        Assert.Single(afterFirstEvents!);
        Assert.Equal(2, afterFirstEvents[0].Sequence);
    }

    [Fact]
    public async Task SubmitCommand_DuplicateCommandId_IsRejected_AndDoesNotAppendEvents()
    {
        var matchId = "match-14";
        var roomId = "room-14";
        const string commandId = "cmd-duplicate";

        var initResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{matchId}/initialize",
            BuildInitializeRequest(roomId));
        initResponse.EnsureSuccessStatusCode();

        var firstSubmitResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{matchId}/commands",
            new SubmitCommandRequest(
                "peer-2",
                "PlaceReinforcements",
                JsonSerializer.SerializeToElement(new
                {
                    playerId = "p1",
                    commandId,
                    territoryId = "alaska",
                    armiesToPlace = 1
                })));
        firstSubmitResponse.EnsureSuccessStatusCode();

        var duplicateSubmitResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{matchId}/commands",
            new SubmitCommandRequest(
                "peer-2",
                "PlaceReinforcements",
                JsonSerializer.SerializeToElement(new
                {
                    playerId = "p1",
                    commandId,
                    territoryId = "alaska",
                    armiesToPlace = 1
                })));

        Assert.Equal(HttpStatusCode.Conflict, duplicateSubmitResponse.StatusCode);
        var duplicatePayload = await duplicateSubmitResponse.Content.ReadFromJsonAsync<SubmitCommandResponse>();
        Assert.NotNull(duplicatePayload);
        Assert.False(duplicatePayload!.Accepted);
        Assert.Equal(CommandErrorCode.Unknown, duplicatePayload.ErrorCode);

        var eventsResponse = await _client.GetAsync($"/api/rooms/{roomId}/peers/peer-2/events?after=0");
        eventsResponse.EnsureSuccessStatusCode();
        var events = await eventsResponse.Content.ReadFromJsonAsync<List<HostEventMessage>>();
        Assert.NotNull(events);
        Assert.Single(events!);
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
