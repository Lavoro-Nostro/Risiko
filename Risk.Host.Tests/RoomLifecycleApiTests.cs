using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Risk.Engine.Contracts.Validation;
using Risk.Host.Gameplay;

namespace Risk.Host.Tests;

public class RoomLifecycleApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public RoomLifecycleApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateJoinLeaveRoom_WorksEndToEnd()
    {
        var createResponse = await _client.PostAsJsonAsync(
            "/api/rooms",
            new CreateRoomRequest("host-1", "Host", "world-classic"));
        createResponse.EnsureSuccessStatusCode();

        var createPayload = await createResponse.Content.ReadFromJsonAsync<CreateRoomResponse>();
        Assert.NotNull(createPayload);
        Assert.False(string.IsNullOrWhiteSpace(createPayload!.RoomId));
        Assert.Equal("host-1", createPayload.HostPeerId);
        Assert.Single(createPayload.Participants);

        var joinResponse = await _client.PostAsJsonAsync(
            $"/api/rooms/{createPayload.RoomId}/join",
            new JoinRoomRequest("peer-2", "Peer Two"));
        joinResponse.EnsureSuccessStatusCode();
        var joinPayload = await joinResponse.Content.ReadFromJsonAsync<JoinRoomResponse>();

        Assert.NotNull(joinPayload);
        Assert.Equal(2, joinPayload!.Participants.Count);

        var leaveResponse = await _client.PostAsJsonAsync(
            $"/api/rooms/{createPayload.RoomId}/leave",
            new LeaveRoomRequest("peer-2"));
        leaveResponse.EnsureSuccessStatusCode();
        var leavePayload = await leaveResponse.Content.ReadFromJsonAsync<LeaveRoomResponse>();

        Assert.NotNull(leavePayload);
        Assert.Single(leavePayload!.Participants);
        Assert.Equal("host-1", leavePayload.Participants[0].PeerId);
    }

    [Fact]
    public async Task StartMatch_TransitionsRoomToActiveMatch_AndBindsMatchId()
    {
        var createResponse = await _client.PostAsJsonAsync(
            "/api/rooms",
            new CreateRoomRequest("host-11", "Host 11", "world-classic"));
        createResponse.EnsureSuccessStatusCode();
        var room = await createResponse.Content.ReadFromJsonAsync<CreateRoomResponse>();
        Assert.NotNull(room);

        var joinResponse = await _client.PostAsJsonAsync(
            $"/api/rooms/{room!.RoomId}/join",
            new JoinRoomRequest("peer-11", "Peer 11"));
        joinResponse.EnsureSuccessStatusCode();

        var startResponse = await _client.PostAsJsonAsync(
            $"/api/rooms/{room.RoomId}/start",
            new StartMatchRequest("host-11", "world-classic", 42));
        startResponse.EnsureSuccessStatusCode();
        var startPayload = await startResponse.Content.ReadFromJsonAsync<StartMatchResponse>();

        Assert.NotNull(startPayload);
        Assert.Equal(room.RoomId, startPayload!.RoomId);
        Assert.Equal("inmatch", startPayload.Status);
        Assert.False(string.IsNullOrWhiteSpace(startPayload.MatchId));

        var commandResponse = await _client.PostAsJsonAsync(
            $"/api/matches/{startPayload.MatchId}/commands",
            new SubmitCommandRequest(
                "host-11",
                "EndTurn",
                JsonSerializer.SerializeToElement(new
                {
                    playerId = "host-11",
                    commandId = "room-flow-cmd-1"
                })));

        Assert.Equal(HttpStatusCode.Conflict, commandResponse.StatusCode);
        var commandPayload = await commandResponse.Content.ReadFromJsonAsync<SubmitCommandResponse>();
        Assert.NotNull(commandPayload);
        Assert.False(commandPayload!.Accepted);
        Assert.Equal(CommandErrorCode.InvalidPhase, commandPayload.ErrorCode);
    }

    [Fact]
    public async Task StartMatch_WithInvalidMapId_ReturnsConflict()
    {
        var createResponse = await _client.PostAsJsonAsync(
            "/api/rooms",
            new CreateRoomRequest("host-22", "Host 22", "world-classic"));
        createResponse.EnsureSuccessStatusCode();
        var room = await createResponse.Content.ReadFromJsonAsync<CreateRoomResponse>();
        Assert.NotNull(room);

        await _client.PostAsJsonAsync(
            $"/api/rooms/{room!.RoomId}/join",
            new JoinRoomRequest("peer-22", "Peer 22"));

        var startResponse = await _client.PostAsJsonAsync(
            $"/api/rooms/{room.RoomId}/start",
            new StartMatchRequest("host-22", "invalid-map", 7));

        Assert.Equal(HttpStatusCode.Conflict, startResponse.StatusCode);
    }

    [Fact]
    public async Task JoinRoom_SameClientId_ResumesSeatInsteadOfAddingDuplicateParticipant()
    {
        var createResponse = await _client.PostAsJsonAsync(
            "/api/rooms",
            new CreateRoomRequest("host-31", "Host 31", "world-classic", null, "client-host-31"));
        createResponse.EnsureSuccessStatusCode();
        var room = await createResponse.Content.ReadFromJsonAsync<CreateRoomResponse>();
        Assert.NotNull(room);

        var firstJoin = await _client.PostAsJsonAsync(
            $"/api/rooms/{room!.RoomId}/join",
            new JoinRoomRequest("peer-31-a", "Peer 31A", "client-31"));
        firstJoin.EnsureSuccessStatusCode();
        var firstPayload = await firstJoin.Content.ReadFromJsonAsync<JoinRoomResponse>();
        Assert.NotNull(firstPayload);
        Assert.Equal(2, firstPayload!.Participants.Count);

        var resumedJoin = await _client.PostAsJsonAsync(
            $"/api/rooms/{room.RoomId}/join",
            new JoinRoomRequest("peer-31-b", "Peer 31B", "client-31"));
        resumedJoin.EnsureSuccessStatusCode();
        var resumedPayload = await resumedJoin.Content.ReadFromJsonAsync<JoinRoomResponse>();

        Assert.NotNull(resumedPayload);
        Assert.Equal(2, resumedPayload!.Participants.Count);
        Assert.DoesNotContain(resumedPayload.Participants, participant => participant.PeerId == "peer-31-a");
        Assert.Contains(resumedPayload.Participants, participant => participant.PeerId == "peer-31-b");
        Assert.Equal(1, resumedPayload.Participants.Count(participant => participant.ClientId == "client-31"));
    }

    [Fact]
    public async Task JoinRoom_SameClientIdAsHost_DoesNotReplaceHostSeat()
    {
        var createResponse = await _client.PostAsJsonAsync(
            "/api/rooms",
            new CreateRoomRequest("host-41", "Host 41", "world-classic", null, "client-shared"));
        createResponse.EnsureSuccessStatusCode();
        var room = await createResponse.Content.ReadFromJsonAsync<CreateRoomResponse>();
        Assert.NotNull(room);

        var joinResponse = await _client.PostAsJsonAsync(
            $"/api/rooms/{room!.RoomId}/join",
            new JoinRoomRequest("peer-41", "Peer 41", "client-shared"));

        Assert.Equal(HttpStatusCode.Conflict, joinResponse.StatusCode);

        var snapshotResponse = await _client.GetAsync($"/api/rooms/{room.RoomId}");
        snapshotResponse.EnsureSuccessStatusCode();
        var snapshot = await snapshotResponse.Content.ReadFromJsonAsync<RoomSnapshotResponse>();

        Assert.NotNull(snapshot);
        Assert.Equal("host-41", snapshot!.HostPeerId);
        Assert.Single(snapshot.Participants);
        Assert.Equal("host-41", snapshot.Participants[0].PeerId);
    }
}
