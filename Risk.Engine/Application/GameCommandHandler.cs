using Risk.Engine.Contracts;
using Risk.Engine.Contracts.Commands;
using Risk.Engine.Contracts.Validation;
using Risk.Engine.Domain.State;

namespace Risk.Engine.Application;

public sealed class GameCommandHandler
{
    public CommandExecutionResult Handle(GameState state, PlaceReinforcementsCommand command)
    {
        if (state.Phase != TurnPhase.Reinforcement)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidPhase, "Not in reinforcement phase.");
        }

        if (command.PlayerId != state.ActivePlayerId)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.NotActivePlayer, "Only active player can reinforce.");
        }

        if (!state.TryGetTerritory(command.TerritoryId, out var territory) || territory is null)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidOwnership, "Territory not found.");
        }

        if (territory.OwnerPlayerId != command.PlayerId)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidOwnership, "Territory is not owned by player.");
        }

        if (command.ArmiesToPlace <= 0 || command.ArmiesToPlace > state.ReinforcementsAvailable)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidArmyAmount, "Invalid reinforcement amount.");
        }

        var updatedTerritory = territory with { Armies = territory.Armies + command.ArmiesToPlace };
        var nextState = state
            .SetTerritoryState(updatedTerritory)
            .WithReinforcements(state.ReinforcementsAvailable - command.ArmiesToPlace);

        return CommandExecutionResult.Accepted(nextState);
    }

    public CommandExecutionResult Handle(GameState state, AttackCommand command)
    {
        if (state.Phase != TurnPhase.Attack)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidPhase, "Not in attack phase.");
        }

        if (command.PlayerId != state.ActivePlayerId)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.NotActivePlayer, "Only active player can attack.");
        }

        if (!state.TryGetTerritory(command.FromTerritoryId, out var fromTerritory) || fromTerritory is null ||
            !state.TryGetTerritory(command.ToTerritoryId, out var toTerritory) || toTerritory is null)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidOwnership, "Attacking or target territory not found.");
        }

        if (fromTerritory.OwnerPlayerId != command.PlayerId || toTerritory.OwnerPlayerId == command.PlayerId)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidOwnership, "Invalid attack ownership.");
        }

        if (!fromTerritory.IsAdjacentTo(toTerritory.TerritoryId))
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.NotAdjacent, "Territories are not adjacent.");
        }

        if (fromTerritory.Armies < 2)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidArmyAmount, "At least two armies are required to attack.");
        }

        var maxAttackerDice = Math.Min(3, fromTerritory.Armies - 1);
        if (command.AttackerDice < 1 || command.AttackerDice > maxAttackerDice)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidArmyAmount, "Invalid attacker dice amount.");
        }

        var defenderDice = Math.Min(2, toTerritory.Armies);
        var rng = BuildDeterministicRng(state, command.CommandId);

        var attackerRolls = RollAndSortDescending(rng, command.AttackerDice);
        var defenderRolls = RollAndSortDescending(rng, defenderDice);

        var compareCount = Math.Min(attackerRolls.Count, defenderRolls.Count);
        var attackerLosses = 0;
        var defenderLosses = 0;

        for (var i = 0; i < compareCount; i++)
        {
            if (attackerRolls[i] > defenderRolls[i])
            {
                defenderLosses++;
            }
            else
            {
                attackerLosses++;
            }
        }

        var updatedFrom = fromTerritory with { Armies = fromTerritory.Armies - attackerLosses };
        var updatedTo = toTerritory with { Armies = toTerritory.Armies - defenderLosses };

        var nextState = state
            .SetTerritoryState(updatedFrom)
            .SetTerritoryState(updatedTo);

        if (updatedTo.Armies <= 0)
        {
            var armiesToMove = Math.Max(1, command.AttackerDice - attackerLosses);
            armiesToMove = Math.Min(armiesToMove, updatedFrom.Armies - 1);
            armiesToMove = Math.Max(1, armiesToMove);

            var capturedFrom = updatedFrom with { Armies = updatedFrom.Armies - armiesToMove };
            var capturedTo = updatedTo with
            {
                OwnerPlayerId = command.PlayerId,
                Armies = armiesToMove
            };

            nextState = nextState
                .SetTerritoryState(capturedFrom)
                .SetTerritoryState(capturedTo)
                .MarkTerritoryCaptured(true);
        }

        return CommandExecutionResult.Accepted(nextState);
    }

    public CommandExecutionResult Handle(GameState state, FortifyCommand command)
    {
        if (state.Phase != TurnPhase.Fortify)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidPhase, "Not in fortify phase.");
        }

        if (command.PlayerId != state.ActivePlayerId)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.NotActivePlayer, "Only active player can fortify.");
        }

        if (!state.TryGetTerritory(command.FromTerritoryId, out var fromTerritory) || fromTerritory is null ||
            !state.TryGetTerritory(command.ToTerritoryId, out var toTerritory) || toTerritory is null)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidOwnership, "Source or destination territory not found.");
        }

        if (fromTerritory.OwnerPlayerId != command.PlayerId || toTerritory.OwnerPlayerId != command.PlayerId)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidOwnership, "Both territories must be owned by player.");
        }

        if (command.ArmiesToMove <= 0 || command.ArmiesToMove >= fromTerritory.Armies)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidArmyAmount, "Invalid fortify amount.");
        }

        if (!HasOwnedPath(state, command.PlayerId, fromTerritory.TerritoryId, toTerritory.TerritoryId))
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidPath, "No connected owned path for fortify.");
        }

        var updatedFrom = fromTerritory with { Armies = fromTerritory.Armies - command.ArmiesToMove };
        var updatedTo = toTerritory with { Armies = toTerritory.Armies + command.ArmiesToMove };

        var nextState = state
            .SetTerritoryState(updatedFrom)
            .SetTerritoryState(updatedTo);

        return CommandExecutionResult.Accepted(nextState);
    }

    public CommandExecutionResult Handle(GameState state, EndTurnCommand command)
    {
        if (command.PlayerId != state.ActivePlayerId)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.NotActivePlayer, "Only active player can end turn.");
        }

        if (state.Phase == TurnPhase.Reinforcement && state.ReinforcementsAvailable > 0)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidPhase, "Place all reinforcements before ending turn.");
        }

        var activePlayers = state.Players.Where(x => !x.IsEliminated).ToList();
        if (activePlayers.Count == 0)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.Unknown, "No active players available.");
        }

        var currentIndex = activePlayers.FindIndex(p => p.PlayerId == state.ActivePlayerId);
        if (currentIndex < 0)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.NotActivePlayer, "Active player not found in player list.");
        }

        var nextIndex = (currentIndex + 1) % activePlayers.Count;
        var nextPlayerId = activePlayers[nextIndex].PlayerId;
        var roundWrap = nextIndex == 0;
        var nextReinforcements = CalculateReinforcements(state, nextPlayerId);

        var nextState = state.AdvanceTurn(nextPlayerId, nextReinforcements, roundWrap);
        return CommandExecutionResult.Accepted(nextState);
    }

    private static int CalculateReinforcements(GameState state, string playerId)
    {
        var territoryCount = state.Territories.Values.Count(t => t.OwnerPlayerId == playerId);
        var byTerritory = Math.Max(3, territoryCount / 3);
        return byTerritory;
    }

    private static bool HasOwnedPath(GameState state, string playerId, string fromTerritoryId, string toTerritoryId)
    {
        if (fromTerritoryId == toTerritoryId)
        {
            return true;
        }

        var visited = new HashSet<string>(StringComparer.Ordinal);
        var queue = new Queue<string>();
        queue.Enqueue(fromTerritoryId);
        visited.Add(fromTerritoryId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (!state.TryGetTerritory(current, out var territory) || territory is null)
            {
                continue;
            }

            foreach (var neighborId in territory.NeighborTerritoryIds)
            {
                if (visited.Contains(neighborId))
                {
                    continue;
                }

                if (!state.TryGetTerritory(neighborId, out var neighbor) || neighbor is null)
                {
                    continue;
                }

                if (neighbor.OwnerPlayerId != playerId)
                {
                    continue;
                }

                if (neighborId == toTerritoryId)
                {
                    return true;
                }

                visited.Add(neighborId);
                queue.Enqueue(neighborId);
            }
        }

        return false;
    }

    private static List<int> RollAndSortDescending(Random random, int count)
    {
        var rolls = new List<int>(count);
        for (var i = 0; i < count; i++)
        {
            rolls.Add(random.Next(1, 7));
        }

        rolls.Sort((a, b) => b.CompareTo(a));
        return rolls;
    }

    private static Random BuildDeterministicRng(GameState state, string commandId)
    {
        var seed = HashCode.Combine(
            state.RngSeed,
            state.TurnIndex,
            state.RoundIndex,
            commandId);

        return new Random(seed);
    }
}
