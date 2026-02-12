using Risk.Engine.Contracts;
using Risk.Engine.Contracts.Events;
using Risk.Engine.Domain.State;

namespace Risk.Engine.Application.EventSourcing;

public static class GameStateProjector
{
    public static GameState Replay(GameState initialState, IEnumerable<IGameEvent> events)
    {
        var state = initialState;
        foreach (var evt in events.OrderBy(e => e.Sequence))
        {
            state = Apply(state, evt);
        }

        return state;
    }

    public static GameState Apply(GameState state, IGameEvent evt) =>
        evt switch
        {
            TurnStartedEvent e => ApplyTurnStarted(state, e),
            ReinforcementsPlacedEvent e => ApplyReinforcementsPlaced(state, e),
            AttackResolvedEvent e => ApplyAttackResolved(state, e),
            TerritoryCapturedEvent e => ApplyTerritoryCaptured(state, e),
            CapturedArmiesMovedEvent e => ApplyCapturedArmiesMoved(state, e),
            PlayerEliminatedEvent e => ApplyPlayerEliminated(state, e),
            TurnEndedEvent e => ApplyTurnEnded(state, e),
            ObjectiveCompletedEvent e => ApplyObjectiveCompleted(state, e),
            GameEndedEvent e => ApplyGameEnded(state, e),
            CardGrantedEvent e => ApplyCardGranted(state, e),
            CardsTradedEvent e => ApplyCardsTraded(state, e),
            _ => state
        };

    private static GameState ApplyTurnStarted(GameState state, TurnStartedEvent evt)
    {
        var parsedPhase = Enum.TryParse<TurnPhase>(evt.Phase, out var phase)
            ? phase
            : TurnPhase.Reinforcement;

        return state with
        {
            ActivePlayerId = evt.ActivePlayerId,
            TurnIndex = evt.TurnIndex,
            Phase = parsedPhase,
            TerritoryCapturedThisTurn = false,
            FortifyUsedThisTurn = false
        };
    }

    private static GameState ApplyReinforcementsPlaced(GameState state, ReinforcementsPlacedEvent evt)
    {
        if (!state.TryGetTerritory(evt.TerritoryId, out var territory) || territory is null)
        {
            return state;
        }

        var updatedTerritory = territory with { Armies = territory.Armies + evt.ArmiesPlaced };
        return state
            .SetTerritoryState(updatedTerritory)
            .WithReinforcements(evt.RemainingReinforcements);
    }

    private static GameState ApplyAttackResolved(GameState state, AttackResolvedEvent evt)
    {
        if (!state.TryGetTerritory(evt.FromTerritoryId, out var fromTerritory) || fromTerritory is null ||
            !state.TryGetTerritory(evt.ToTerritoryId, out var toTerritory) || toTerritory is null)
        {
            return state;
        }

        var updatedFrom = fromTerritory with { Armies = Math.Max(1, fromTerritory.Armies - evt.AttackerLosses) };
        var updatedTo = toTerritory with { Armies = Math.Max(0, toTerritory.Armies - evt.DefenderLosses) };

        return state
            .SetTerritoryState(updatedFrom)
            .SetTerritoryState(updatedTo);
    }

    private static GameState ApplyTerritoryCaptured(GameState state, TerritoryCapturedEvent evt)
    {
        if (!state.TryGetTerritory(evt.TerritoryId, out var captured) || captured is null)
        {
            return state;
        }

        // Move armies in from the first adjacent territory owned by attacker.
        var fromCandidateId = captured.NeighborTerritoryIds.FirstOrDefault(id =>
        {
            if (!state.TryGetTerritory(id, out var t) || t is null)
            {
                return false;
            }

            return t.OwnerPlayerId == evt.NewOwnerPlayerId && t.Armies > evt.ArmiesMovedIn;
        });

        var next = state;
        if (fromCandidateId is not null && state.TryGetTerritory(fromCandidateId, out var fromTerritory) && fromTerritory is not null)
        {
            next = next.SetTerritoryState(fromTerritory with
            {
                Armies = fromTerritory.Armies - evt.ArmiesMovedIn
            });
        }

        var updatedCaptured = captured with
        {
            OwnerPlayerId = evt.NewOwnerPlayerId,
            Armies = evt.ArmiesMovedIn
        };

        return next
            .SetTerritoryState(updatedCaptured)
            .MarkTerritoryCaptured(true);
    }

    private static GameState ApplyCapturedArmiesMoved(GameState state, CapturedArmiesMovedEvent evt)
    {
        if (!state.TryGetTerritory(evt.FromTerritoryId, out var fromTerritory) || fromTerritory is null ||
            !state.TryGetTerritory(evt.ToTerritoryId, out var toTerritory) || toTerritory is null)
        {
            return state;
        }

        var updatedFrom = fromTerritory with { Armies = evt.ArmiesInSourceTerritory };
        var updatedTo = toTerritory with { Armies = evt.ArmiesInCapturedTerritory };

        return state
            .SetTerritoryState(updatedFrom)
            .SetTerritoryState(updatedTo)
            .ClearPendingCaptureMove();
    }

    private static GameState ApplyTurnEnded(GameState state, TurnEndedEvent evt) =>
        state with { TurnIndex = evt.TurnIndex };

    private static GameState ApplyPlayerEliminated(GameState state, PlayerEliminatedEvent evt) =>
        state.SetPlayerEliminated(evt.EliminatedPlayerId);

    private static GameState ApplyObjectiveCompleted(GameState state, ObjectiveCompletedEvent evt) =>
        state.SetWinner(evt.WinnerPlayerId);

    private static GameState ApplyGameEnded(GameState state, GameEndedEvent evt) =>
        state.SetWinner(evt.WinnerPlayerId);

    private static GameState ApplyCardGranted(GameState state, CardGrantedEvent evt) =>
        state.AddCardToPlayer(evt.PlayerId, evt.CardId);

    private static GameState ApplyCardsTraded(GameState state, CardsTradedEvent evt) =>
        state
            .RemovePlayerCards(evt.PlayerId, evt.CardIds)
            .AddCardsToDrawPile(evt.CardIds)
            .WithTradeStep(evt.NextTradeStep)
            .WithReinforcements(state.ReinforcementsAvailable + evt.BonusArmies);
}
