using Risk.Engine.Application;
using Risk.Engine.Contracts;
using Risk.Engine.Contracts.Commands;
using Risk.Engine.Contracts.Events;
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
    public void SetupPlaceReinforcements_UsingFullPool_AutoPassesTurn()
    {
        var state = BuildState(phase: TurnPhase.Setup, activePlayerId: "p1", reinforcementPool: 3) with
        {
            Territories = new Dictionary<string, TerritoryState>(StringComparer.Ordinal)
            {
                ["alaska"] = new("alaska", "p1", 20, ["kamchatka", "alberta"]),
                ["kamchatka"] = new("kamchatka", "p1", 9, ["alaska"]),
                ["greenland"] = new("greenland", "p1", 8, []),
                ["alberta"] = new("alberta", "p2", 14, ["alaska"]),
                ["siberia"] = new("siberia", "p2", 14, []),
                ["iceland"] = new("iceland", "p2", 8, ["great_britain"]),
                ["great_britain"] = new("great_britain", "p2", 0, ["iceland"])
            }
        };

        var result = _handler.Handle(
            state,
            new PlaceReinforcementsCommand("match-1", "p1", "cmd-setup-pass", "alaska", 3));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(23, result.State.Territories["alaska"].Armies);
        Assert.Equal(TurnPhase.Setup, result.State.Phase);
        Assert.Equal("p2", result.State.ActivePlayerId);
        Assert.Equal(3, result.State.ReinforcementsAvailable);
        Assert.Contains(result.EventEnvelopes, envelope => envelope.Event is TurnEndedEvent);
        Assert.Contains(result.EventEnvelopes, envelope => envelope.Event is TurnStartedEvent started && started.Phase == TurnPhase.Setup.ToString());
    }

    [Fact]
    public void SetupPlaceReinforcements_PartialPlacement_IsAccepted_AndKeepsTurn()
    {
        var state = BuildState(phase: TurnPhase.Setup, activePlayerId: "p1", reinforcementPool: 3);

        var result = _handler.Handle(
            state,
            new PlaceReinforcementsCommand("match-1", "p1", "cmd-setup-partial", "alaska", 1));

        Assert.True(result.Validation.IsValid);
        Assert.Equal("p1", result.State.ActivePlayerId);
        Assert.Equal(TurnPhase.Setup, result.State.Phase);
        Assert.Equal(2, result.State.ReinforcementsAvailable);
        Assert.Single(result.EventEnvelopes);
        Assert.IsType<ReinforcementsPlacedEvent>(result.EventEnvelopes[0].Event);
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
        Assert.Equal(CommandErrorCode.NotAdjacent, result.Validation.ErrorCode);
    }

    [Fact]
    public void Fortify_SecondMoveInSameTurn_IsRejected()
    {
        var state = BuildState(phase: TurnPhase.Fortify, activePlayerId: "p1", reinforcementPool: 0);

        var first = _handler.Handle(state, new FortifyCommand("match-1", "p1", "cmd-fortify-r1", "alaska", "kamchatka", 2));
        Assert.True(first.Validation.IsValid);
        Assert.Equal(TurnPhase.Fortify, first.State.Phase);
        Assert.Equal("p1", first.State.ActivePlayerId);
        Assert.True(first.State.FortifyUsedThisTurn);

        var second = _handler.Handle(first.State, new FortifyCommand("match-1", "p1", "cmd-fortify-r2", "kamchatka", "alaska", 1));
        Assert.False(second.Validation.IsValid);
        Assert.Equal(CommandErrorCode.InvalidPhase, second.Validation.ErrorCode);
        Assert.Equal(TurnPhase.Fortify, second.State.Phase);
        Assert.Equal("p1", second.State.ActivePlayerId);
        Assert.Equal(4, second.State.Territories["kamchatka"].Armies);
        Assert.Equal(4, second.State.Territories["alaska"].Armies);
    }

    [Fact]
    public void Fortify_CannotMoveAllArmies_OneMustRemain()
    {
        var state = BuildState(phase: TurnPhase.Fortify, activePlayerId: "p1", reinforcementPool: 0);

        var result = _handler.Handle(
            state,
            new FortifyCommand("match-1", "p1", "cmd-fortify-all", "kamchatka", "greenland", 2));

        Assert.False(result.Validation.IsValid);
        Assert.Equal(CommandErrorCode.InvalidArmyAmount, result.Validation.ErrorCode);
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

    [Fact]
    public void EndTurn_InSetup_IsRejected()
    {
        var state = BuildState(phase: TurnPhase.Setup, activePlayerId: "p1", reinforcementPool: 3);
        var command = new EndTurnCommand("match-1", "p1", "cmd-end-setup");

        var result = _handler.Handle(state, command);

        Assert.False(result.Validation.IsValid);
        Assert.Equal(CommandErrorCode.InvalidPhase, result.Validation.ErrorCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(4)]
    public void Attack_InvalidDiceBounds_IsRejected(int dice)
    {
        var state = BuildState(phase: TurnPhase.Attack, activePlayerId: "p1", reinforcementPool: 0);
        var command = new AttackCommand("match-1", "p1", "cmd-dice", "alaska", "alberta", dice);

        var result = _handler.Handle(state, command);

        Assert.False(result.Validation.IsValid);
        Assert.Equal(CommandErrorCode.InvalidArmyAmount, result.Validation.ErrorCode);
    }

    [Fact]
    public void EndTurn_AppliesContinentBonusToNextPlayerReinforcements()
    {
        var state = BuildState(phase: TurnPhase.Fortify, activePlayerId: "p1", reinforcementPool: 0);
        var command = new EndTurnCommand("match-1", "p1", "cmd-end-bonus");

        var result = _handler.Handle(state, command);

        Assert.True(result.Validation.IsValid);
        // p2 owns both europe territories in this test fixture:
        // base = max(3, 2/3) = 3, bonus = 5, total = 8
        Assert.Equal("p2", result.State.ActivePlayerId);
        Assert.Equal(8, result.State.ReinforcementsAvailable);
    }

    [Fact]
    public void PlaceReinforcements_WithForcedTradeHand_IsRejected()
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["p1"] = ["c1", "c2", "c3", "c4", "c5", "c6"],
            ["p2"] = []
        };

        var cardSymbols = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["c1"] = "infantry",
            ["c2"] = "cavalry",
            ["c3"] = "artillery",
            ["c4"] = "infantry",
            ["c5"] = "cavalry",
            ["c6"] = "artillery"
        };

        var state = BuildState(
            phase: TurnPhase.Reinforcement,
            activePlayerId: "p1",
            reinforcementPool: 5,
            cardIdsByPlayerId: cardHands,
            cardSymbolById: cardSymbols);

        var result = _handler.Handle(
            state,
            new PlaceReinforcementsCommand("match-1", "p1", "cmd-forced-trade", "alaska", 1));

        Assert.False(result.Validation.IsValid);
        Assert.Equal(CommandErrorCode.InvalidCards, result.Validation.ErrorCode);
    }

    [Fact]
    public void PlayCards_ValidSet_AddsBonusAndRemovesCards()
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["p1"] = ["c1", "c2", "c3"],
            ["p2"] = []
        };

        var cardSymbols = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["c1"] = "infantry",
            ["c2"] = "cavalry",
            ["c3"] = "artillery"
        };

        var state = BuildState(
            phase: TurnPhase.Reinforcement,
            activePlayerId: "p1",
            reinforcementPool: 5,
            cardIdsByPlayerId: cardHands,
            cardSymbolById: cardSymbols);

        var result = _handler.Handle(
            state,
            new PlayCardsCommand("match-1", "p1", "cmd-play-cards", ["c1", "c2", "c3"]));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(15, result.State.ReinforcementsAvailable);
        Assert.Empty(result.State.GetPlayerCardIds("p1"));
        Assert.Contains(result.EventEnvelopes, envelope => envelope.Event is CardsTradedEvent);
    }

    [Fact]
    public void PlayCards_ThreeArtillery_GivesFourBonus()
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["p1"] = ["a1", "a2", "a3"],
            ["p2"] = []
        };
        var cardSymbols = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["a1"] = "artillery",
            ["a2"] = "artillery",
            ["a3"] = "artillery"
        };
        var state = BuildState(TurnPhase.Reinforcement, "p1", 5, cardHands, cardSymbols);

        var result = _handler.Handle(state, new PlayCardsCommand("match-1", "p1", "cmd-play-art", ["a1", "a2", "a3"]));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(9, result.State.ReinforcementsAvailable);
    }

    [Fact]
    public void PlayCards_ThreeInfantry_GivesSixBonus()
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["p1"] = ["i1", "i2", "i3"],
            ["p2"] = []
        };
        var cardSymbols = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["i1"] = "infantry",
            ["i2"] = "infantry",
            ["i3"] = "infantry"
        };
        var state = BuildState(TurnPhase.Reinforcement, "p1", 5, cardHands, cardSymbols);

        var result = _handler.Handle(state, new PlayCardsCommand("match-1", "p1", "cmd-play-inf", ["i1", "i2", "i3"]));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(11, result.State.ReinforcementsAvailable);
    }

    [Fact]
    public void PlayCards_ThreeCavalry_GivesEightBonus()
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["p1"] = ["c1", "c2", "c3"],
            ["p2"] = []
        };
        var cardSymbols = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["c1"] = "cavalry",
            ["c2"] = "cavalry",
            ["c3"] = "cavalry"
        };
        var state = BuildState(TurnPhase.Reinforcement, "p1", 5, cardHands, cardSymbols);

        var result = _handler.Handle(state, new PlayCardsCommand("match-1", "p1", "cmd-play-cav", ["c1", "c2", "c3"]));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(13, result.State.ReinforcementsAvailable);
    }

    [Fact]
    public void PlayCards_JokerWithTwoSame_GivesTwelveBonus()
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["p1"] = ["i1", "i2", "j1"],
            ["p2"] = []
        };
        var cardSymbols = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["i1"] = "infantry",
            ["i2"] = "infantry",
            ["j1"] = "joker"
        };
        var state = BuildState(TurnPhase.Reinforcement, "p1", 5, cardHands, cardSymbols);

        var result = _handler.Handle(state, new PlayCardsCommand("match-1", "p1", "cmd-play-joker", ["i1", "i2", "j1"]));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(17, result.State.ReinforcementsAvailable);
    }

    [Fact]
    public void PlayCards_JokerWithTwoDifferent_IsRejected()
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["p1"] = ["i1", "c1", "j1"],
            ["p2"] = []
        };
        var cardSymbols = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["i1"] = "infantry",
            ["c1"] = "cavalry",
            ["j1"] = "joker"
        };
        var state = BuildState(TurnPhase.Reinforcement, "p1", 5, cardHands, cardSymbols);

        var result = _handler.Handle(state, new PlayCardsCommand("match-1", "p1", "cmd-play-invalid-joker", ["i1", "c1", "j1"]));

        Assert.False(result.Validation.IsValid);
        Assert.Equal(CommandErrorCode.InvalidCards, result.Validation.ErrorCode);
    }

    [Fact]
    public void PlayCards_TwoJokers_IsRejected()
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["p1"] = ["i1", "j1", "j2"],
            ["p2"] = []
        };
        var cardSymbols = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["i1"] = "infantry",
            ["j1"] = "joker",
            ["j2"] = "joker"
        };
        var state = BuildState(TurnPhase.Reinforcement, "p1", 5, cardHands, cardSymbols);

        var result = _handler.Handle(state, new PlayCardsCommand("match-1", "p1", "cmd-play-double-joker", ["i1", "j1", "j2"]));

        Assert.False(result.Validation.IsValid);
        Assert.Equal(CommandErrorCode.InvalidCards, result.Validation.ErrorCode);
    }

    [Fact]
    public void PlayCards_UnknownSymbol_IsRejected()
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["p1"] = ["x1", "x2", "x3"],
            ["p2"] = []
        };
        var cardSymbols = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["x1"] = "foo",
            ["x2"] = "bar",
            ["x3"] = "baz"
        };
        var state = BuildState(TurnPhase.Reinforcement, "p1", 5, cardHands, cardSymbols);

        var result = _handler.Handle(state, new PlayCardsCommand("match-1", "p1", "cmd-play-unknown", ["x1", "x2", "x3"]));

        Assert.False(result.Validation.IsValid);
        Assert.Equal(CommandErrorCode.InvalidCards, result.Validation.ErrorCode);
    }

    [Fact]
    public void PlayCards_ItalianSymbolAliases_AreAccepted()
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["p1"] = ["i1", "i2", "j1"],
            ["p2"] = []
        };
        var cardSymbols = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["i1"] = "fanteria",
            ["i2"] = "fante",
            ["j1"] = "jolly"
        };
        var state = BuildState(TurnPhase.Reinforcement, "p1", 5, cardHands, cardSymbols);

        var result = _handler.Handle(state, new PlayCardsCommand("match-1", "p1", "cmd-play-it-jolly", ["i1", "i2", "j1"]));

        Assert.True(result.Validation.IsValid);
        Assert.Equal(17, result.State.ReinforcementsAvailable);
    }

    [Fact]
    public void PlayCards_AddsOwnedTerritoryBonus()
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["p1"] = ["territory:alaska", "territory:kamchatka", "territory:greenland"],
            ["p2"] = []
        };
        var cardSymbols = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["territory:alaska"] = "infantry",
            ["territory:kamchatka"] = "cavalry",
            ["territory:greenland"] = "artillery"
        };
        var state = BuildState(TurnPhase.Reinforcement, "p1", 5, cardHands, cardSymbols);

        var result = _handler.Handle(
            state,
            new PlayCardsCommand("match-1", "p1", "cmd-play-owned-territory", ["territory:alaska", "territory:kamchatka", "territory:greenland"]));

        Assert.True(result.Validation.IsValid);
        // mixed set = 10, plus 3 owned territories * 2 = 6
        Assert.Equal(21, result.State.ReinforcementsAvailable);
    }

    [Fact]
    public void Attack_CaptureLastTerritory_EliminatesDefenderAndTransfersCards()
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["p1"] = [],
            ["p2"] = ["c1", "c2", "c3"]
        };

        var cardSymbols = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["c1"] = "infantry",
            ["c2"] = "cavalry",
            ["c3"] = "artillery"
        };

        var state = BuildState(
            phase: TurnPhase.Attack,
            activePlayerId: "p1",
            reinforcementPool: 0,
            cardIdsByPlayerId: cardHands,
            cardSymbolById: cardSymbols) with
        {
            Territories = new Dictionary<string, TerritoryState>(StringComparer.Ordinal)
            {
                ["alaska"] = new("alaska", "p1", 10, ["alberta"]),
                ["alberta"] = new("alberta", "p2", 1, ["alaska"]),
                ["kamchatka"] = new("kamchatka", "p1", 2, ["alaska"]),
                ["greenland"] = new("greenland", "p1", 2, []),
                ["siberia"] = new("siberia", "p1", 3, []),
                ["iceland"] = new("iceland", "p1", 2, ["great_britain"]),
                ["great_britain"] = new("great_britain", "p1", 2, ["iceland"])
            }
        };

        CommandExecutionResult? capture = null;
        for (var i = 0; i < 250; i++)
        {
            var result = _handler.Handle(
                state,
                new AttackCommand("match-1", "p1", $"cmd-capture-{i}", "alaska", "alberta", 3));
            if (!result.Validation.IsValid)
            {
                continue;
            }

            if (result.State.Territories["alberta"].OwnerPlayerId == "p1")
            {
                capture = result;
                break;
            }
        }

        Assert.NotNull(capture);
        Assert.True(capture!.State.Players.Single(x => x.PlayerId == "p2").IsEliminated);
        Assert.Equal(3, capture.State.GetPlayerCardIds("p1").Count);
        Assert.Empty(capture.State.GetPlayerCardIds("p2"));
        Assert.Contains(capture.EventEnvelopes, envelope => envelope.Event is PlayerEliminatedEvent);
    }

    private static GameState BuildState(
        TurnPhase phase,
        string activePlayerId,
        int reinforcementPool,
        IReadOnlyDictionary<string, IReadOnlyList<string>>? cardIdsByPlayerId = null,
        IReadOnlyDictionary<string, string>? cardSymbolById = null)
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
            ["siberia"] = new("siberia", "p2", 3, []),
            ["iceland"] = new("iceland", "p2", 2, ["great_britain"]),
            ["great_britain"] = new("great_britain", "p2", 2, ["iceland"])
        };

        var continents = new List<ContinentState>
        {
            new("north_america", 5, ["alaska", "kamchatka", "alberta", "greenland", "siberia"]),
            new("europe", 5, ["iceland", "great_britain"])
        };

        return GameState.CreateInitial(
            matchId: "match-1",
            players: players,
            continents: continents,
            territories: territories,
            activePlayerId: activePlayerId,
            reinforcementPool: reinforcementPool,
            rngSeed: 1234,
            cardIdsByPlayerId: cardIdsByPlayerId,
            cardSymbolById: cardSymbolById
        ).WithPhase(phase);
    }
}
