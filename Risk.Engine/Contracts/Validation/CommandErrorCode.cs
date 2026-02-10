namespace Risk.Engine.Contracts.Validation;

public enum CommandErrorCode
{
    None = 0,
    InvalidPhase = 1,
    NotActivePlayer = 2,
    InvalidOwnership = 3,
    NotAdjacent = 4,
    InvalidArmyAmount = 5,
    InvalidPath = 6,
    Unknown = 999
}
