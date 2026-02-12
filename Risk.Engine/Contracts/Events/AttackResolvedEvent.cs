namespace Risk.Engine.Contracts.Events;

public sealed record AttackResolvedEvent(
    string MatchId,
    long Sequence,
    DateTimeOffset OccurredAtUtc,
    string AttackerPlayerId,
    string DefenderPlayerId,
    string FromTerritoryId,
    string ToTerritoryId,
    IReadOnlyList<int> AttackerRolls,
    IReadOnlyList<int> DefenderRolls,
    int AttackerLosses,
    int DefenderLosses
) : IGameEvent;
