using Risk.Engine.Contracts;
using Risk.Engine.Contracts.Commands;
using Risk.Engine.Contracts.Events;
using Risk.Engine.Contracts.Validation;
using Risk.Engine.Domain.Ids;

namespace Risk.Engine.Tests;

public class ContractsTests
{
    [Fact]
    public void PlayerId_ToString_ReturnsValue()
    {
        var id = new PlayerId("player-1");
        Assert.Equal("player-1", id.ToString());
    }

    [Fact]
    public void TerritoryAndContinentIds_AreValueComparable()
    {
        var territoryA = new TerritoryId("alaska");
        var territoryB = new TerritoryId("alaska");
        var continentA = new ContinentId("na");
        var continentB = new ContinentId("na");

        Assert.Equal(territoryA, territoryB);
        Assert.Equal(continentA, continentB);
    }

    [Fact]
    public void TurnPhase_HasExpectedOrdering()
    {
        Assert.Equal(1, (int)TurnPhase.Reinforcement);
        Assert.Equal(2, (int)TurnPhase.Attack);
        Assert.Equal(3, (int)TurnPhase.Fortify);
    }

    [Fact]
    public void PlaceReinforcementsCommand_StoresPayload()
    {
        var command = new PlaceReinforcementsCommand(
            "match-1",
            "player-1",
            "cmd-1",
            "alaska",
            3);

        Assert.Equal("match-1", command.MatchId);
        Assert.Equal("player-1", command.PlayerId);
        Assert.Equal("cmd-1", command.CommandId);
        Assert.Equal("alaska", command.TerritoryId);
        Assert.Equal(3, command.ArmiesToPlace);
    }

    [Fact]
    public void TurnStartedEvent_StoresPayload()
    {
        var now = DateTimeOffset.UtcNow;
        var evt = new TurnStartedEvent(
            "match-1",
            10,
            now,
            "player-2",
            5,
            TurnPhase.Reinforcement.ToString());

        Assert.Equal("match-1", evt.MatchId);
        Assert.Equal(10, evt.Sequence);
        Assert.Equal(now, evt.OccurredAtUtc);
        Assert.Equal("player-2", evt.ActivePlayerId);
        Assert.Equal(5, evt.TurnIndex);
        Assert.Equal("Reinforcement", evt.Phase);
    }

    [Fact]
    public void CommandValidationResult_SuccessAndFailureFactories_Work()
    {
        var ok = CommandValidationResult.Success();
        var failed = CommandValidationResult.Failure(
            CommandErrorCode.InvalidPhase,
            "Invalid phase for command.");

        Assert.True(ok.IsValid);
        Assert.Equal(CommandErrorCode.None, ok.ErrorCode);
        Assert.Null(ok.ErrorMessage);

        Assert.False(failed.IsValid);
        Assert.Equal(CommandErrorCode.InvalidPhase, failed.ErrorCode);
        Assert.Equal("Invalid phase for command.", failed.ErrorMessage);
    }
}
