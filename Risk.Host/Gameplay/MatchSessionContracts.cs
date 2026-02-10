using System.Text.Json;
using Risk.Engine.Contracts.Validation;
using Risk.Engine.Domain.State;

namespace Risk.Host.Gameplay;

public sealed record InitializeMatchRequest(
    string RoomId,
    string HostPeerId,
    IReadOnlyList<PlayerState> Players,
    IReadOnlyList<ContinentState> Continents,
    IReadOnlyList<TerritoryState> Territories,
    string ActivePlayerId,
    int ReinforcementsAvailable,
    int RngSeed
);

public sealed record InitializeMatchResponse(
    string MatchId,
    string RoomId,
    string HostPeerId,
    int InitialEventCount
);

public sealed record SubmitCommandRequest(
    string PeerId,
    string Type,
    JsonElement Payload
);

public sealed record SubmitCommandResponse(
    bool Accepted,
    CommandErrorCode ErrorCode,
    string Message,
    int AppliedEventCount
);
