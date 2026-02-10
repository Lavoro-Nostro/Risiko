using Risk.Engine.Contracts;

namespace Risk.Engine.Domain.State;

public sealed record GameState
{
    public required string MatchId { get; init; }
    public required IReadOnlyList<PlayerState> Players { get; init; }
    public required IReadOnlyList<ContinentState> Continents { get; init; }
    public required IReadOnlyDictionary<string, TerritoryState> Territories { get; init; }
    public required TurnPhase Phase { get; init; }
    public required int TurnIndex { get; init; }
    public required int RoundIndex { get; init; }
    public required string ActivePlayerId { get; init; }
    public required int ReinforcementsAvailable { get; init; }
    public required bool TerritoryCapturedThisTurn { get; init; }
    public required int RngSeed { get; init; }

    public static GameState CreateInitial(
        string matchId,
        IReadOnlyList<PlayerState> players,
        IReadOnlyList<ContinentState> continents,
        IReadOnlyDictionary<string, TerritoryState> territories,
        string activePlayerId,
        int reinforcementPool,
        int rngSeed) =>
        new()
        {
            MatchId = matchId,
            Players = players,
            Continents = continents,
            Territories = territories,
            Phase = TurnPhase.Reinforcement,
            TurnIndex = 0,
            RoundIndex = 1,
            ActivePlayerId = activePlayerId,
            ReinforcementsAvailable = reinforcementPool,
            TerritoryCapturedThisTurn = false,
            RngSeed = rngSeed
        };

    public GameState WithPhase(TurnPhase phase) => this with { Phase = phase };

    public GameState WithReinforcements(int reinforcementPool) =>
        this with { ReinforcementsAvailable = reinforcementPool };

    public GameState MarkTerritoryCaptured(bool captured = true) =>
        this with { TerritoryCapturedThisTurn = captured };

    public GameState AdvanceTurn(
        string nextActivePlayerId,
        int nextReinforcementPool,
        bool incrementRound = false) =>
        this with
        {
            TurnIndex = TurnIndex + 1,
            RoundIndex = incrementRound ? RoundIndex + 1 : RoundIndex,
            ActivePlayerId = nextActivePlayerId,
            Phase = TurnPhase.Reinforcement,
            ReinforcementsAvailable = nextReinforcementPool,
            TerritoryCapturedThisTurn = false
        };

    public GameState SetTerritoryState(TerritoryState territoryState)
    {
        var updated = new Dictionary<string, TerritoryState>(Territories)
        {
            [territoryState.TerritoryId] = territoryState
        };

        return this with { Territories = updated };
    }

    public bool TryGetTerritory(string territoryId, out TerritoryState? territoryState) =>
        Territories.TryGetValue(territoryId, out territoryState);
}
