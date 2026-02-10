using System.Collections.Concurrent;
using System.Text.Json;
using Risk.Engine.Application;
using Risk.Engine.Application.EventSourcing;
using Risk.Engine.Contracts.Commands;
using Risk.Engine.Contracts.Events;
using Risk.Engine.Contracts.Validation;
using Risk.Engine.Domain.State;
using Risk.Host.Networking;

namespace Risk.Host.Gameplay;

public sealed class InMemoryMatchSessionService : IMatchSessionService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly ConcurrentDictionary<string, MatchSession> _matches = new(StringComparer.Ordinal);
    private readonly ISignalingService _signalingService;

    public InMemoryMatchSessionService(ISignalingService signalingService)
    {
        _signalingService = signalingService;
    }

    public InitializeMatchResponse InitializeMatch(string matchId, InitializeMatchRequest request)
    {
        var territories = request.Territories.ToDictionary(
            territory => territory.TerritoryId,
            territory => territory,
            StringComparer.Ordinal);

        var initialState = GameState.CreateInitial(
            matchId,
            request.Players,
            request.Continents,
            territories,
            request.ActivePlayerId,
            request.ReinforcementsAvailable,
            request.RngSeed);

        var session = new MatchSession(
            request.RoomId,
            request.HostPeerId,
            new GameCommandHandler(),
            new InMemoryGameEventStore(),
            initialState);

        _matches[matchId] = session;
        return new InitializeMatchResponse(matchId, request.RoomId, request.HostPeerId, 0);
    }

    public SubmitCommandResponse SubmitCommand(string matchId, SubmitCommandRequest request)
    {
        if (!_matches.TryGetValue(matchId, out var session))
        {
            return new SubmitCommandResponse(false, CommandErrorCode.Unknown, "Match not found.", 0);
        }

        lock (session.Sync)
        {
            if (!TryGetString(request.Payload, "commandId", out var commandId) || string.IsNullOrWhiteSpace(commandId))
            {
                return new SubmitCommandResponse(false, CommandErrorCode.Unknown, "commandId is required in payload.", 0);
            }

            if (session.ProcessedCommandIds.Contains(commandId))
            {
                return new SubmitCommandResponse(false, CommandErrorCode.Unknown, "Duplicate command id.", 0);
            }

            var command = BuildCommand(matchId, request);
            if (command is null)
            {
                return new SubmitCommandResponse(false, CommandErrorCode.Unknown, "Unsupported command payload.", 0);
            }

            var result = HandleCommand(session.Handler, session.State, command);
            if (!result.Validation.IsValid)
            {
                return new SubmitCommandResponse(false, result.Validation.ErrorCode, result.Validation.ErrorMessage ?? "Rejected.", 0);
            }

            var appliedEvents = result.EventEnvelopes
                .Where(envelope => envelope.Accepted && envelope.Event is not null)
                .Select(envelope => envelope.Event!)
                .ToList();

            if (appliedEvents.Count > 0)
            {
                session.EventStore.Append(matchId, appliedEvents);
                foreach (var evt in appliedEvents)
                {
                    var payload = JsonSerializer.Serialize(evt, evt.GetType(), JsonOptions);
                    _signalingService.PublishHostEvent(
                        session.RoomId,
                        session.HostPeerId,
                        new HostEventPublishRequest(evt.GetType().Name, payload));
                }
            }

            session.ProcessedCommandIds.Add(commandId);
            session.State = result.State;
            return new SubmitCommandResponse(true, CommandErrorCode.None, "Accepted.", appliedEvents.Count);
        }
    }

    private static IGameCommand? BuildCommand(string matchId, SubmitCommandRequest request)
    {
        try
        {
            return request.Type.Trim().ToLowerInvariant() switch
            {
                "placereinforcements" => new PlaceReinforcementsCommand(
                    matchId,
                    request.Payload.GetProperty("playerId").GetString() ?? string.Empty,
                    request.Payload.GetProperty("commandId").GetString() ?? string.Empty,
                    request.Payload.GetProperty("territoryId").GetString() ?? string.Empty,
                    request.Payload.GetProperty("armiesToPlace").GetInt32()),
                "attack" => new AttackCommand(
                    matchId,
                    request.Payload.GetProperty("playerId").GetString() ?? string.Empty,
                    request.Payload.GetProperty("commandId").GetString() ?? string.Empty,
                    request.Payload.GetProperty("fromTerritoryId").GetString() ?? string.Empty,
                    request.Payload.GetProperty("toTerritoryId").GetString() ?? string.Empty,
                    request.Payload.GetProperty("attackerDice").GetInt32()),
                "fortify" => new FortifyCommand(
                    matchId,
                    request.Payload.GetProperty("playerId").GetString() ?? string.Empty,
                    request.Payload.GetProperty("commandId").GetString() ?? string.Empty,
                    request.Payload.GetProperty("fromTerritoryId").GetString() ?? string.Empty,
                    request.Payload.GetProperty("toTerritoryId").GetString() ?? string.Empty,
                    request.Payload.GetProperty("armiesToMove").GetInt32()),
                "endturn" => new EndTurnCommand(
                    matchId,
                    request.Payload.GetProperty("playerId").GetString() ?? string.Empty,
                    request.Payload.GetProperty("commandId").GetString() ?? string.Empty),
                _ => null
            };
        }
        catch
        {
            return null;
        }
    }

    private static bool TryGetString(JsonElement payload, string propertyName, out string? value)
    {
        value = null;
        if (!payload.TryGetProperty(propertyName, out var property) || property.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        value = property.GetString();
        return true;
    }

    private static CommandExecutionResult HandleCommand(GameCommandHandler handler, GameState state, IGameCommand command) =>
        command switch
        {
            PlaceReinforcementsCommand c => handler.Handle(state, c),
            AttackCommand c => handler.Handle(state, c),
            FortifyCommand c => handler.Handle(state, c),
            EndTurnCommand c => handler.Handle(state, c),
            _ => CommandExecutionResult.Rejected(state, CommandErrorCode.Unknown, "Unsupported command type.")
        };

    private sealed class MatchSession
    {
        public MatchSession(
            string roomId,
            string hostPeerId,
            GameCommandHandler handler,
            IGameEventStore eventStore,
            GameState state)
        {
            RoomId = roomId;
            HostPeerId = hostPeerId;
            Handler = handler;
            EventStore = eventStore;
            State = state;
        }

        public object Sync { get; } = new();
        public string RoomId { get; }
        public string HostPeerId { get; }
        public GameCommandHandler Handler { get; }
        public IGameEventStore EventStore { get; }
        public HashSet<string> ProcessedCommandIds { get; } = new(StringComparer.Ordinal);
        public GameState State { get; set; }
    }
}
