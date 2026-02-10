namespace Risk.Host.Gameplay;

public interface IRoomSessionService
{
    CreateRoomResponse CreateRoom(CreateRoomRequest request);
    JoinRoomResponse JoinRoom(string roomId, JoinRoomRequest request);
    LeaveRoomResponse LeaveRoom(string roomId, LeaveRoomRequest request);
    Task<StartMatchResponse> StartMatchAsync(string roomId, StartMatchRequest request, CancellationToken cancellationToken = default);
}
