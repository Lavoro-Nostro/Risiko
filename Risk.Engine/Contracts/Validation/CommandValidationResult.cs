namespace Risk.Engine.Contracts.Validation;

public sealed record CommandValidationResult(
    bool IsValid,
    CommandErrorCode ErrorCode,
    string? ErrorMessage
)
{
    public static CommandValidationResult Success() => new(true, CommandErrorCode.None, null);

    public static CommandValidationResult Failure(CommandErrorCode errorCode, string errorMessage) =>
        new(false, errorCode, errorMessage);
}
