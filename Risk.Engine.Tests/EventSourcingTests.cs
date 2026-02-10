using Risk.Engine.Application;
using Risk.Engine.Application.EventSourcing;
using Risk.Engine.Contracts;
using Risk.Engine.Contracts.Commands;
using Risk.Engine.Contracts.Events;
using Risk.Engine.Domain.State;

namespace Risk.Engine.Tests;

public class EventSourcingTests
{
    [Fact]
    public void InMemoryEventStore_AppendsAndReadsInSequenceOrder()
    {
        var store = new InMemoryGameEventStore();

        var e2 = new TurnEndedEvent("match-1", 2, DateTimeOffset.UtcNow, "p1", 1);
        var e1 = new TurnStartedEvent("match-1", 1, DateTimeOffset.UtcNow, "p1", 0, TurnPhase.Reinforcement.ToString());

        store.Append("match-1", [e2, e1]);
        var events = store.Read("match-1");

        Assert.Equal(2, events.Count);
        Assert.Equal(1, events[0].Sequence);
        Assert.Equal(2, events[1].Sequence);
    }

    [Fact]
    public void GameStateProjector_ReplayRebuildsStateFromEvents()
    {
        var initial = BuildState();
        var now = DateTimeOffset.UtcNow;

        var events = new IGameEvent[]
        {
            new ReinforcementsPlacedEvent("match-1", 1, now, "p1", "alaska", 3, 2),
            new TurnEndedEvent("match-1", 2, now, "p1", 1),
            new TurnStartedEvent("match-1", 3, now, "p2", 1, TurnPhase.Reinforcement.ToString())
        };

        var projected = GameStateProjector.Replay(initial, events);

        Assert.Equal(9, projected.Territories["alaska"].Armies);
        Assert.Equal(2, projected.ReinforcementsAvailable);
        Assert.Equal(1, projected.TurnIndex);
        Assert.Equal("p2", projected.ActivePlayerId);
        Assert.Equal(TurnPhase.Reinforcement, projected.Phase);
    }

    [Fact]
    public void CommandHandler_EmitsEvents_ForAcceptedCommands()
    {
        var handler = new GameCommandHandler();
        var state = BuildState();

        var reinforce = handler.Handle(
            state,
            new PlaceReinforcementsCommand("match-1", "p1", "cmd-reinforce", "alaska", 2));

        Assert.True(reinforce.Validation.IsValid);
        Assert.Single(reinforce.EventEnvelopes);
        Assert.IsType<ReinforcementsPlacedEvent>(reinforce.EventEnvelopes[0].Event);

        var end = handler.Handle(
            reinforce.State.WithReinforcements(0).WithPhase(TurnPhase.Fortify),
            new EndTurnCommand("match-1", "p1", "cmd-end"));

        Assert.True(end.Validation.IsValid);
        Assert.Equal(2, end.EventEnvelopes.Count);
        Assert.IsType<TurnEndedEvent>(end.EventEnvelopes[0].Event);
        Assert.IsType<TurnStartedEvent>(end.EventEnvelopes[1].Event);
    }

    [Fact]
    public void CommandHandler_InitializesSequence_FromHistory()
    {
        var handler = new GameCommandHandler();
        handler.InitializeSequenceFromHistory(
            [
                new TurnStartedEvent("match-1", 41, DateTimeOffset.UtcNow, "p1", 10, TurnPhase.Reinforcement.ToString())
            ]);

        var state = BuildState();
        var result = handler.Handle(
            state,
            new PlaceReinforcementsCommand("match-1", "p1", "cmd-seq", "alaska", 1));

        Assert.True(result.Validation.IsValid);
        Assert.Single(result.EventEnvelopes);
        Assert.NotNull(result.EventEnvelopes[0].Event);
        Assert.Equal(42, result.EventEnvelopes[0].Event!.Sequence);
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
            ["alaska"] = new("alaska", "p1", 6, ["alberta"]),
            ["alberta"] = new("alberta", "p2", 2, ["alaska"])
        };

        return GameState.CreateInitial(
            "match-1",
            players,
            territories,
            activePlayerId: "p1",
            reinforcementPool: 5,
            rngSeed: 99);
    }
}
