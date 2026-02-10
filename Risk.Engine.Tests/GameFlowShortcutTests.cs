using Risk.Engine.Application;
using Risk.Engine.Contracts;
using Risk.Engine.Contracts.Commands;
using Risk.Engine.Contracts.Validation;
using Risk.Engine.Domain.State;

namespace Risk.Engine.Tests;

public class GameFlowShortcutTests
{
    private readonly GameCommandHandler _handler = new();

    [Fact]
    public void ReinforcementPoolDepleted_AutoTransitionsToAttack()
    {
        var state = BuildState(phase: TurnPhase.Reinforcement, activePlayerId: "p1", reinforcementPool: 3);
        var result = _handler.Handle(
            state,
            new PlaceReinforcementsCommand("match-flow", "p1", "cmd-r1", "alaska", 3));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(TurnPhase.Attack, result.State.Phase);
    }

    [Fact]
    public void EndTurn_InAttack_TransitionsToFortify_SamePlayer()
    {
        var state = BuildState(phase: TurnPhase.Attack, activePlayerId: "p1", reinforcementPool: 0);
        var result = _handler.Handle(state, new EndTurnCommand("match-flow", "p1", "cmd-next-phase"));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(TurnPhase.Fortify, result.State.Phase);
        Assert.Equal("p1", result.State.ActivePlayerId);
    }

    [Fact]
    public void EndTurn_InFortify_AdvancesPlayer_AndResetsToReinforcement()
    {
        var state = BuildState(phase: TurnPhase.Fortify, activePlayerId: "p1", reinforcementPool: 0)
            .MarkTerritoryCaptured(true);
        var result = _handler.Handle(state, new EndTurnCommand("match-flow", "p1", "cmd-end-turn"));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(TurnPhase.Reinforcement, result.State.Phase);
        Assert.Equal("p2", result.State.ActivePlayerId);
        Assert.False(result.State.TerritoryCapturedThisTurn);
        Assert.Contains(
            result.EventEnvelopes,
            envelope => envelope.Accepted && envelope.Event?.GetType().Name == "CardGrantedEvent");
    }

    [Fact]
    public void ObjectiveReached_CaptureFlowEndsGame_AndFurtherCommandsAreRejected()
    {
        var objectives = new Dictionary<string, PlayerObjectiveState>(StringComparer.Ordinal)
        {
            ["p1"] = new(
                "p1",
                "obj-test-3",
                "Conquer 3 Territories",
                "Conquer 3 territories.",
                "territory_count",
                TargetTerritoryCount: 3)
        };

        var baseState = BuildState(phase: TurnPhase.Attack, activePlayerId: "p1", reinforcementPool: 0, objectives)
            with
            {
                Territories = new Dictionary<string, TerritoryState>(StringComparer.Ordinal)
                {
                    ["alaska"] = new("alaska", "p1", 10, ["alberta"]),
                    ["alberta"] = new("alberta", "p2", 1, ["alaska"]),
                    ["kamchatka"] = new("kamchatka", "p1", 3, ["alaska"])
                }
            };

        CommandExecutionResult? captureResult = null;
        for (var i = 0; i < 200; i++)
        {
            var command = new AttackCommand("match-flow", "p1", $"cmd-capture-{i}", "alaska", "alberta", 3);
            var result = _handler.Handle(baseState, command);
            if (!result.Validation.IsValid)
            {
                continue;
            }

            if (result.State.WinnerPlayerId == "p1")
            {
                captureResult = result;
                break;
            }
        }

        Assert.NotNull(captureResult);
        Assert.Equal("p1", captureResult!.State.WinnerPlayerId);
        Assert.Contains(
            captureResult.EventEnvelopes,
            envelope => envelope.Accepted && envelope.Event?.GetType().Name == "ObjectiveCompletedEvent");
        Assert.Contains(
            captureResult.EventEnvelopes,
            envelope => envelope.Accepted && envelope.Event?.GetType().Name == "GameEndedEvent");

        var rejectedAfterEnd = _handler.Handle(
            captureResult.State,
            new EndTurnCommand("match-flow", "p1", "cmd-after-end"));

        Assert.False(rejectedAfterEnd.Validation.IsValid);
        Assert.Equal(CommandErrorCode.GameEnded, rejectedAfterEnd.Validation.ErrorCode);
    }

    private static GameState BuildState(
        TurnPhase phase,
        string activePlayerId,
        int reinforcementPool,
        IReadOnlyDictionary<string, PlayerObjectiveState>? objectivesByPlayerId = null)
    {
        var players = new List<PlayerState>
        {
            new("p1", "Player 1"),
            new("p2", "Player 2")
        };

        var territories = new Dictionary<string, TerritoryState>(StringComparer.Ordinal)
        {
            ["alaska"] = new("alaska", "p1", 6, ["kamchatka", "alberta"]),
            ["kamchatka"] = new("kamchatka", "p1", 2, ["alaska"]),
            ["alberta"] = new("alberta", "p2", 2, ["alaska"]),
            ["iceland"] = new("iceland", "p2", 2, ["great_britain"]),
            ["great_britain"] = new("great_britain", "p2", 2, ["iceland"])
        };

        var continents = new List<ContinentState>
        {
            new("north_america", 5, ["alaska", "kamchatka", "alberta"]),
            new("europe", 5, ["iceland", "great_britain"])
        };

        return GameState.CreateInitial(
            matchId: "match-flow",
            players: players,
            continents: continents,
            territories: territories,
            activePlayerId: activePlayerId,
            reinforcementPool: reinforcementPool,
            rngSeed: 1234,
            objectivesByPlayerId: objectivesByPlayerId,
            cardSymbolById: new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["c1"] = "infantry"
            },
            drawPileCardIds: ["c1"]).WithPhase(phase);
    }
}
