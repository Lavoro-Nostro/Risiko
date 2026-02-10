using Risk.Engine.Contracts.Validation;
using Risk.Engine.Domain.State;

namespace Risk.Engine.Application;

public sealed record CommandExecutionResult(
    GameState State,
    CommandValidationResult Validation
)
{
    public static CommandExecutionResult Rejected(GameState state, CommandErrorCode errorCode, string message) =>
        new(state, CommandValidationResult.Failure(errorCode, message));

    public static CommandExecutionResult Accepted(GameState state) =>
        new(state, CommandValidationResult.Success());
}
