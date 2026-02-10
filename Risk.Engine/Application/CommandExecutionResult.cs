using Risk.Engine.Contracts.Validation;
using Risk.Engine.Domain.State;
using Risk.Engine.Application.EventSourcing;

namespace Risk.Engine.Application;

public sealed record CommandExecutionResult(
    GameState State,
    CommandValidationResult Validation,
    IReadOnlyList<GameEventEnvelope> EventEnvelopes
)
{
    public static CommandExecutionResult Rejected(GameState state, CommandErrorCode errorCode, string message) =>
        new(
            state,
            CommandValidationResult.Failure(errorCode, message),
            [new GameEventEnvelope(false, null, "n/a", message)]);

    public static CommandExecutionResult Accepted(GameState state) =>
        new(state, CommandValidationResult.Success(), []);

    public static CommandExecutionResult Accepted(GameState state, IReadOnlyList<GameEventEnvelope> eventEnvelopes) =>
        new(state, CommandValidationResult.Success(), eventEnvelopes);
}
