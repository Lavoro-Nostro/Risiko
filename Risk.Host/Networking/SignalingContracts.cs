namespace Risk.Host.Networking;

public sealed record RegisterPeerResponse(
    string RoomId,
    string PeerId,
    IReadOnlyList<string> ActivePeers
);

public sealed record SignalSendRequest(
    string ToPeerId,
    string Type,
    string Payload
);

public sealed record SignalMessage(
    long Sequence,
    string RoomId,
    string FromPeerId,
    string ToPeerId,
    string Type,
    string Payload,
    DateTimeOffset CreatedAtUtc
);

public sealed record HostEventPublishRequest(
    string Type,
    string Payload
);

public sealed record HostEventMessage(
    long Sequence,
    string RoomId,
    string HostPeerId,
    string Type,
    string Payload,
    DateTimeOffset CreatedAtUtc
);
