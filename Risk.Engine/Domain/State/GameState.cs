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
    public required bool FortifyUsedThisTurn { get; init; }
    public required int RngSeed { get; init; }
    public required IReadOnlyDictionary<string, PlayerObjectiveState> ObjectivesByPlayerId { get; init; }
    public required string? WinnerPlayerId { get; init; }
    public required IReadOnlyDictionary<string, IReadOnlyList<string>> CardIdsByPlayerId { get; init; }
    public required IReadOnlyDictionary<string, string> CardSymbolById { get; init; }
    public required IReadOnlyList<string> DrawPileCardIds { get; init; }
    public required int TradeBonusStep { get; init; }
    public required string? PendingCaptureFromTerritoryId { get; init; }
    public required string? PendingCaptureToTerritoryId { get; init; }
    public required int PendingCaptureMinArmies { get; init; }
    public required int PendingCaptureMaxArmies { get; init; }

    public static GameState CreateInitial(
        string matchId,
        IReadOnlyList<PlayerState> players,
        IReadOnlyList<ContinentState> continents,
        IReadOnlyDictionary<string, TerritoryState> territories,
        string activePlayerId,
        int reinforcementPool,
        int rngSeed,
        IReadOnlyDictionary<string, PlayerObjectiveState>? objectivesByPlayerId = null,
        IReadOnlyDictionary<string, IReadOnlyList<string>>? cardIdsByPlayerId = null,
        IReadOnlyDictionary<string, string>? cardSymbolById = null,
        IReadOnlyList<string>? drawPileCardIds = null,
        int tradeBonusStep = 0) =>
        new()
        {
            MatchId = matchId,
            Players = players,
            Continents = continents,
            Territories = territories,
            Phase = TurnPhase.Setup,
            TurnIndex = 0,
            RoundIndex = 1,
            ActivePlayerId = activePlayerId,
            ReinforcementsAvailable = reinforcementPool,
            TerritoryCapturedThisTurn = false,
            FortifyUsedThisTurn = false,
            RngSeed = rngSeed,
            ObjectivesByPlayerId = objectivesByPlayerId ?? new Dictionary<string, PlayerObjectiveState>(StringComparer.Ordinal),
            WinnerPlayerId = null,
            CardIdsByPlayerId = cardIdsByPlayerId ?? BuildEmptyCardHands(players),
            CardSymbolById = cardSymbolById ?? new Dictionary<string, string>(StringComparer.Ordinal),
            DrawPileCardIds = drawPileCardIds ?? [],
            TradeBonusStep = tradeBonusStep,
            PendingCaptureFromTerritoryId = null,
            PendingCaptureToTerritoryId = null,
            PendingCaptureMinArmies = 0,
            PendingCaptureMaxArmies = 0
        };

    public GameState WithPhase(TurnPhase phase) => this with { Phase = phase };

    public GameState WithReinforcements(int reinforcementPool) =>
        this with { ReinforcementsAvailable = reinforcementPool };

    public GameState MarkTerritoryCaptured(bool captured = true) =>
        this with { TerritoryCapturedThisTurn = captured };

    public GameState MarkFortifyUsed(bool used = true) =>
        this with { FortifyUsedThisTurn = used };

    public GameState SetWinner(string winnerPlayerId) =>
        this with { WinnerPlayerId = winnerPlayerId };

    public GameState SetPlayerEliminated(string playerId, bool isEliminated = true)
    {
        var players = Players.Select(player =>
            string.Equals(player.PlayerId, playerId, StringComparison.Ordinal)
                ? player with { IsEliminated = isEliminated }
                : player).ToList();

        return this with { Players = players };
    }

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
            TerritoryCapturedThisTurn = false,
            FortifyUsedThisTurn = false
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

    public bool TryGetObjective(string playerId, out PlayerObjectiveState? objective) =>
        ObjectivesByPlayerId.TryGetValue(playerId, out objective);

    public IReadOnlyList<string> GetPlayerCardIds(string playerId) =>
        CardIdsByPlayerId.TryGetValue(playerId, out var cards) ? cards : [];

    public bool TryGetCardSymbol(string cardId, out string symbol) =>
        CardSymbolById.TryGetValue(cardId, out symbol!);

    public GameState AddCardToPlayer(string playerId, string cardId)
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(CardIdsByPlayerId, StringComparer.Ordinal);
        var current = cardHands.TryGetValue(playerId, out var existing) ? existing.ToList() : [];
        current.Add(cardId);
        cardHands[playerId] = current;

        var nextDrawPile = DrawPileCardIds.ToList();
        var removed = nextDrawPile.Remove(cardId);
        if (!removed && nextDrawPile.Count > 0)
        {
            nextDrawPile.RemoveAt(0);
        }

        return this with { CardIdsByPlayerId = cardHands, DrawPileCardIds = nextDrawPile };
    }

    public GameState RemovePlayerCards(string playerId, IReadOnlyCollection<string> cardIds)
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(CardIdsByPlayerId, StringComparer.Ordinal);
        var current = cardHands.TryGetValue(playerId, out var existing) ? existing.ToList() : [];
        current.RemoveAll(id => cardIds.Contains(id));
        cardHands[playerId] = current;
        return this with { CardIdsByPlayerId = cardHands };
    }

    public GameState AddCardsToDrawPile(IEnumerable<string> cardIds)
    {
        var pile = DrawPileCardIds.ToList();
        pile.AddRange(cardIds);
        return this with { DrawPileCardIds = pile };
    }

    public GameState TransferAllCards(string fromPlayerId, string toPlayerId)
    {
        var cardHands = new Dictionary<string, IReadOnlyList<string>>(CardIdsByPlayerId, StringComparer.Ordinal);
        var fromCards = cardHands.TryGetValue(fromPlayerId, out var fromExisting)
            ? fromExisting.ToList()
            : [];
        var toCards = cardHands.TryGetValue(toPlayerId, out var toExisting)
            ? toExisting.ToList()
            : [];

        toCards.AddRange(fromCards);
        cardHands[fromPlayerId] = [];
        cardHands[toPlayerId] = toCards;

        return this with { CardIdsByPlayerId = cardHands };
    }

    public bool TryPeekTopDrawCard(out string cardId)
    {
        if (DrawPileCardIds.Count == 0)
        {
            cardId = string.Empty;
            return false;
        }

        cardId = DrawPileCardIds[0];
        return true;
    }

    public GameState RemoveTopDrawCard()
    {
        if (DrawPileCardIds.Count == 0)
        {
            return this;
        }

        return this with { DrawPileCardIds = DrawPileCardIds.Skip(1).ToList() };
    }

    public GameState WithTradeStep(int tradeBonusStep) => this with { TradeBonusStep = tradeBonusStep };

    public GameState WithPendingCaptureMove(string fromTerritoryId, string toTerritoryId, int minArmies, int maxArmies) =>
        this with
        {
            PendingCaptureFromTerritoryId = fromTerritoryId,
            PendingCaptureToTerritoryId = toTerritoryId,
            PendingCaptureMinArmies = minArmies,
            PendingCaptureMaxArmies = maxArmies
        };

    public GameState ClearPendingCaptureMove() =>
        this with
        {
            PendingCaptureFromTerritoryId = null,
            PendingCaptureToTerritoryId = null,
            PendingCaptureMinArmies = 0,
            PendingCaptureMaxArmies = 0
        };

    private static IReadOnlyDictionary<string, IReadOnlyList<string>> BuildEmptyCardHands(
        IReadOnlyList<PlayerState> players)
    {
        var result = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
        foreach (var player in players)
        {
            result[player.PlayerId] = [];
        }

        return result;
    }
}
