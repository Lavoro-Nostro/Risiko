namespace Risk.Engine.Domain.State;

public sealed record PlayerState(
    string PlayerId,
    string DisplayName,
    bool IsEliminated = false
);
