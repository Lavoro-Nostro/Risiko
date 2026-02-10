namespace Risk.Host.Gameplay;

public sealed record RoomParticipant(
    string PeerId,
    string DisplayName,
    DateTimeOffset JoinedAtUtc
);

public sealed record CreateRoomRequest(
    string HostPeerId,
    string HostDisplayName,
    string MapId
);

public sealed record CreateRoomResponse(
    string RoomId,
    string HostPeerId,
    string MapId,
    string Status,
    IReadOnlyList<RoomParticipant> Participants
);

public sealed record JoinRoomRequest(
    string PeerId,
    string DisplayName
);

public sealed record JoinRoomResponse(
    string RoomId,
    string MapId,
    string Status,
    IReadOnlyList<RoomParticipant> Participants
);

public sealed record LeaveRoomRequest(
    string PeerId
);

public sealed record LeaveRoomResponse(
    string RoomId,
    string Status,
    IReadOnlyList<RoomParticipant> Participants
);

public sealed record StartMatchRequest(
    string HostPeerId,
    string? MapId = null,
    int? RngSeed = null
);

public sealed record StartMatchResponse(
    string RoomId,
    string MatchId,
    string MapId,
    string Status,
    IReadOnlyList<RoomParticipant> Participants
);
