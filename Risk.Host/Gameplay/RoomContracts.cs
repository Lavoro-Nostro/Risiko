namespace Risk.Host.Gameplay;

public sealed record RoomParticipant(
    string PeerId,
    string DisplayName,
    DateTimeOffset JoinedAtUtc
);

public sealed record CreateRoomRequest(
    string HostPeerId,
    string HostDisplayName,
    string MapId,
    string? RoomName = null
);

public sealed record CreateRoomResponse(
    string RoomId,
    string RoomName,
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
    string RoomName,
    string MapId,
    string HostPeerId,
    string Status,
    string? ActiveMatchId,
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
    string RoomName,
    string MatchId,
    string MapId,
    string HostPeerId,
    string Status,
    IReadOnlyList<RoomParticipant> Participants,
    IReadOnlyList<PlayerReconnectToken> ReconnectTokens
);

public sealed record PlayerReconnectToken(
    string PeerId,
    string PlayerToken
);

public sealed record RoomLobbySummary(
    string RoomId,
    string RoomName,
    string HostPeerId,
    string MapId,
    string Status,
    int PlayerCount,
    int MaxPlayers
);

public sealed record RoomSnapshotResponse(
    string RoomId,
    string RoomName,
    string HostPeerId,
    string MapId,
    string Status,
    string? ActiveMatchId,
    IReadOnlyList<RoomParticipant> Participants
);
