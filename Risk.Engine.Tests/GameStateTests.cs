using Risk.Engine.Contracts;
using Risk.Engine.Domain.State;

namespace Risk.Engine.Tests;

public class GameStateTests
{
    [Fact]
    public void CreateInitial_SetsCoreFields()
    {
        var players = new List<PlayerState>
        {
            new("p1", "Player 1"),
            new("p2", "Player 2")
        };

        var territories = new Dictionary<string, TerritoryState>
        {
            ["alaska"] = new("alaska", "p1", 3),
            ["alberta"] = new("alberta", "p2", 2)
        };

        var state = GameState.CreateInitial(
            "match-1",
            players,
            territories,
            activePlayerId: "p1",
            reinforcementPool: 5,
            rngSeed: 12345);

        Assert.Equal("match-1", state.MatchId);
        Assert.Equal(TurnPhase.Reinforcement, state.Phase);
        Assert.Equal(0, state.TurnIndex);
        Assert.Equal(1, state.RoundIndex);
        Assert.Equal("p1", state.ActivePlayerId);
        Assert.Equal(5, state.ReinforcementsAvailable);
        Assert.False(state.TerritoryCapturedThisTurn);
        Assert.Equal(12345, state.RngSeed);
    }

    [Fact]
    public void WithReinforcements_ReturnsNewState_WithoutMutatingOriginal()
    {
        var original = BuildState();
        var updated = original.WithReinforcements(9);

        Assert.Equal(4, original.ReinforcementsAvailable);
        Assert.Equal(9, updated.ReinforcementsAvailable);
    }

    [Fact]
    public void AdvanceTurn_ResetsPhaseAndCaptureFlag_AndIncrementsIndices()
    {
        var original = BuildState()
            .WithPhase(TurnPhase.Attack)
            .MarkTerritoryCaptured(true);

        var updated = original.AdvanceTurn(
            nextActivePlayerId: "p2",
            nextReinforcementPool: 6,
            incrementRound: true);

        Assert.Equal(0, original.TurnIndex);
        Assert.Equal(1, original.RoundIndex);
        Assert.Equal(TurnPhase.Attack, original.Phase);
        Assert.True(original.TerritoryCapturedThisTurn);

        Assert.Equal(1, updated.TurnIndex);
        Assert.Equal(2, updated.RoundIndex);
        Assert.Equal("p2", updated.ActivePlayerId);
        Assert.Equal(TurnPhase.Reinforcement, updated.Phase);
        Assert.Equal(6, updated.ReinforcementsAvailable);
        Assert.False(updated.TerritoryCapturedThisTurn);
    }

    [Fact]
    public void SetTerritoryState_UpdatesTerritoryOnNewStateOnly()
    {
        var original = BuildState();
        var updated = original.SetTerritoryState(new TerritoryState("alaska", "p2", 1));

        Assert.Equal("p1", original.Territories["alaska"].OwnerPlayerId);
        Assert.Equal(3, original.Territories["alaska"].Armies);

        Assert.Equal("p2", updated.Territories["alaska"].OwnerPlayerId);
        Assert.Equal(1, updated.Territories["alaska"].Armies);
    }

    [Fact]
    public void TryGetTerritory_ReturnsExpectedResult()
    {
        var state = BuildState();

        var found = state.TryGetTerritory("alaska", out var alaska);
        var missing = state.TryGetTerritory("kamchatka", out var kamchatka);

        Assert.True(found);
        Assert.NotNull(alaska);
        Assert.Equal("alaska", alaska!.TerritoryId);

        Assert.False(missing);
        Assert.Null(kamchatka);
    }

    private static GameState BuildState()
    {
        var players = new List<PlayerState>
        {
            new("p1", "Player 1"),
            new("p2", "Player 2")
        };

        var territories = new Dictionary<string, TerritoryState>
        {
            ["alaska"] = new("alaska", "p1", 3),
            ["alberta"] = new("alberta", "p2", 2)
        };

        return GameState.CreateInitial(
            "match-1",
            players,
            territories,
            activePlayerId: "p1",
            reinforcementPool: 4,
            rngSeed: 7);
    }
}
