using System.Text.Json;
using Risk.Engine.Contracts.Validation;
using Risk.Engine.Domain.State;
using Risk.Host.Networking;

namespace Risk.Host.Gameplay;

public sealed record InitializeMatchRequest(
    string RoomId,
    string HostPeerId,
    IReadOnlyList<PlayerState> Players,
    IReadOnlyDictionary<string, string> PlayerTokens,
    IReadOnlyList<ContinentState> Continents,
    IReadOnlyList<TerritoryState> Territories,
    string ActivePlayerId,
    int ReinforcementsAvailable,
    int RngSeed,
    IReadOnlyDictionary<string, PlayerObjectiveState>? ObjectivesByPlayerId = null,
    IReadOnlyDictionary<string, IReadOnlyList<string>>? CardIdsByPlayerId = null,
    IReadOnlyDictionary<string, string>? CardSymbolById = null,
    IReadOnlyList<string>? DrawPileCardIds = null,
    int TradeBonusStep = 0
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

public sealed record ReconnectRequest(
    string PeerId,
    string PlayerToken,
    long LastKnownSequence
);

public sealed record ReconnectResponse(
    bool Accepted,
    string Message,
    string MatchId,
    string RoomId,
    IReadOnlyList<HostEventMessage> MissingEvents
);

public sealed record MatchStateResponse(
    string MatchId,
    string RoomId,
    GameState State
);
