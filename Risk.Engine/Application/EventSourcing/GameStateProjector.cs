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
            TurnEndedEvent e => ApplyTurnEnded(state, e),
            CardGrantedEvent => state, // card model comes later
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
            TerritoryCapturedThisTurn = false
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

    private static GameState ApplyTurnEnded(GameState state, TurnEndedEvent evt) =>
        state with { TurnIndex = evt.TurnIndex };
}
