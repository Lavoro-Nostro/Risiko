using Risk.Engine.Application;
using Risk.Engine.Contracts;
using Risk.Engine.Contracts.Commands;
using Risk.Engine.Contracts.Validation;
using Risk.Engine.Domain.State;

namespace Risk.Engine.Tests;

public class GameCommandHandlerTests
{
    private readonly GameCommandHandler _handler = new();

    [Fact]
    public void PlaceReinforcements_ValidCommand_UpdatesArmiesAndPool()
    {
        var state = BuildState(phase: TurnPhase.Reinforcement, activePlayerId: "p1", reinforcementPool: 5);
        var command = new PlaceReinforcementsCommand("match-1", "p1", "cmd-1", "alaska", 3);

        var result = _handler.Handle(state, command);

        Assert.True(result.Validation.IsValid);
        Assert.Equal(9, result.State.Territories["alaska"].Armies);
        Assert.Equal(2, result.State.ReinforcementsAvailable);
    }

    [Fact]
    public void PlaceReinforcements_InvalidPhase_IsRejected()
    {
        var state = BuildState(phase: TurnPhase.Attack, activePlayerId: "p1", reinforcementPool: 5);
        var command = new PlaceReinforcementsCommand("match-1", "p1", "cmd-1", "alaska", 1);

        var result = _handler.Handle(state, command);

        Assert.False(result.Validation.IsValid);
        Assert.Equal(CommandErrorCode.InvalidPhase, result.Validation.ErrorCode);
    }

    [Fact]
    public void Attack_NonAdjacent_IsRejected()
    {
        var state = BuildState(phase: TurnPhase.Attack, activePlayerId: "p1", reinforcementPool: 0);
        var command = new AttackCommand("match-1", "p1", "cmd-attack", "alaska", "siberia", 1);

        var result = _handler.Handle(state, command);

        Assert.False(result.Validation.IsValid);
        Assert.Equal(CommandErrorCode.NotAdjacent, result.Validation.ErrorCode);
    }

    [Fact]
    public void Attack_ValidCommand_ChangesArmiesOrCaptures()
    {
        var state = BuildState(phase: TurnPhase.Attack, activePlayerId: "p1", reinforcementPool: 0);
        var command = new AttackCommand("match-1", "p1", "cmd-attack-2", "alaska", "alberta", 3);

        var result = _handler.Handle(state, command);

        Assert.True(result.Validation.IsValid);
        Assert.NotEqual(
            (state.Territories["alaska"].Armies, state.Territories["alberta"].Armies, state.Territories["alberta"].OwnerPlayerId),
            (result.State.Territories["alaska"].Armies, result.State.Territories["alberta"].Armies, result.State.Territories["alberta"].OwnerPlayerId));
    }

    [Fact]
    public void Fortify_WithOwnedPath_TransfersArmies()
    {
        var state = BuildState(phase: TurnPhase.Fortify, activePlayerId: "p1", reinforcementPool: 0);
        var command = new FortifyCommand("match-1", "p1", "cmd-fortify", "alaska", "kamchatka", 2);

        var result = _handler.Handle(state, command);

        Assert.True(result.Validation.IsValid);
        Assert.Equal(4, result.State.Territories["alaska"].Armies);
        Assert.Equal(4, result.State.Territories["kamchatka"].Armies);
    }

    [Fact]
    public void Fortify_WithoutOwnedPath_IsRejected()
    {
        var state = BuildState(phase: TurnPhase.Fortify, activePlayerId: "p1", reinforcementPool: 0);
        var command = new FortifyCommand("match-1", "p1", "cmd-fortify-2", "alaska", "greenland", 1);

        var result = _handler.Handle(state, command);

        Assert.False(result.Validation.IsValid);
        Assert.Equal(CommandErrorCode.InvalidPath, result.Validation.ErrorCode);
    }

    [Fact]
    public void EndTurn_AdvancesToNextPlayer_AndResetsPhase()
    {
        var state = BuildState(phase: TurnPhase.Fortify, activePlayerId: "p1", reinforcementPool: 0)
            .MarkTerritoryCaptured(true);
        var command = new EndTurnCommand("match-1", "p1", "cmd-end");

        var result = _handler.Handle(state, command);

        Assert.True(result.Validation.IsValid);
        Assert.Equal("p2", result.State.ActivePlayerId);
        Assert.Equal(TurnPhase.Reinforcement, result.State.Phase);
        Assert.False(result.State.TerritoryCapturedThisTurn);
    }

    [Fact]
    public void EndTurn_WithPendingReinforcements_IsRejected()
    {
        var state = BuildState(phase: TurnPhase.Reinforcement, activePlayerId: "p1", reinforcementPool: 2);
        var command = new EndTurnCommand("match-1", "p1", "cmd-end-2");

        var result = _handler.Handle(state, command);

        Assert.False(result.Validation.IsValid);
        Assert.Equal(CommandErrorCode.InvalidPhase, result.Validation.ErrorCode);
    }

    private static GameState BuildState(TurnPhase phase, string activePlayerId, int reinforcementPool)
    {
        var players = new List<PlayerState>
        {
            new("p1", "Player 1"),
            new("p2", "Player 2")
        };

        var territories = new Dictionary<string, TerritoryState>
        {
            ["alaska"] = new("alaska", "p1", 6, ["kamchatka", "alberta"]),
            ["kamchatka"] = new("kamchatka", "p1", 2, ["alaska"]),
            ["alberta"] = new("alberta", "p2", 2, ["alaska"]),
            ["greenland"] = new("greenland", "p1", 2, []),
            ["siberia"] = new("siberia", "p2", 3, [])
        };

        return GameState.CreateInitial(
            matchId: "match-1",
            players: players,
            territories: territories,
            activePlayerId: activePlayerId,
            reinforcementPool: reinforcementPool,
            rngSeed: 1234
        ).WithPhase(phase);
    }
}
