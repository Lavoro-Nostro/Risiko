namespace Risk.Host.Gameplay;

public interface IRoomSessionService
{
    IReadOnlyList<RoomLobbySummary> ListRooms();
    RoomSnapshotResponse? GetRoom(string roomId);
    CreateRoomResponse CreateRoom(CreateRoomRequest request);
    JoinRoomResponse JoinRoom(string roomId, JoinRoomRequest request);
    LeaveRoomResponse LeaveRoom(string roomId, LeaveRoomRequest request);
    Task<StartMatchResponse> StartMatchAsync(string roomId, StartMatchRequest request, CancellationToken cancellationToken = default);
}
