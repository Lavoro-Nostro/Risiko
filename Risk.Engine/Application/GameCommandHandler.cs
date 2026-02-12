using Risk.Engine.Application.EventSourcing;
using Risk.Engine.Contracts;
using Risk.Engine.Contracts.Commands;
using Risk.Engine.Contracts.Events;
using Risk.Engine.Contracts.Validation;
using Risk.Engine.Domain.State;

namespace Risk.Engine.Application;

public sealed class GameCommandHandler
{
    private const int ForcedTradeThreshold = 6;
    private long _sequence;

    public void InitializeSequenceFromHistory(IEnumerable<IGameEvent> history)
    {
        _sequence = history.Any() ? history.Max(e => e.Sequence) : 0;
    }

    public CommandExecutionResult Handle(GameState state, PlaceReinforcementsCommand command)
    {
        var ended = RejectIfGameEnded(state);
        if (ended is not null)
        {
            return ended;
        }

        if (state.Phase != TurnPhase.Setup && state.Phase != TurnPhase.Reinforcement)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidPhase, "Not in reinforcement phase.");
        }

        if (command.PlayerId != state.ActivePlayerId)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.NotActivePlayer, "Only active player can reinforce.");
        }

        if (IsForcedTradeRequired(state, command.PlayerId))
        {
            return CommandExecutionResult.Rejected(
                state,
                CommandErrorCode.InvalidCards,
                $"Card trade required before reinforcements (hand >= {ForcedTradeThreshold}).");
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

        var evt = new ReinforcementsPlacedEvent(
            state.MatchId,
            NextSequence(),
            DateTimeOffset.UtcNow,
            command.PlayerId,
            command.TerritoryId,
            command.ArmiesToPlace,
            nextState.ReinforcementsAvailable);

        var events = new List<GameEventEnvelope>
        {
            new(true, evt, command.CommandId)
        };

        if (TryResolveObjectiveWinner(nextState, command.PlayerId, out var reinforceWinnerPlayerId))
        {
            nextState = AppendObjectiveVictory(nextState, events, command.CommandId, state.MatchId, reinforceWinnerPlayerId);
            return CommandExecutionResult.Accepted(nextState, events);
        }

        if (nextState.ReinforcementsAvailable == 0)
        {
            if (state.Phase == TurnPhase.Setup)
            {
                nextState = HandleSetupTurnTransition(state, nextState, command, events);
            }
            else
            {
                nextState = nextState.WithPhase(TurnPhase.Attack);
                events.Add(
                    new GameEventEnvelope(
                        true,
                        new TurnStartedEvent(
                            state.MatchId,
                            NextSequence(),
                            DateTimeOffset.UtcNow,
                            state.ActivePlayerId,
                            state.TurnIndex,
                            TurnPhase.Attack.ToString()),
                        command.CommandId));
            }
        }

        return CommandExecutionResult.Accepted(nextState, events);
    }

    public CommandExecutionResult Handle(GameState state, PlayCardsCommand command)
    {
        var ended = RejectIfGameEnded(state);
        if (ended is not null)
        {
            return ended;
        }

        if (state.Phase != TurnPhase.Reinforcement)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidPhase, "Cards can be traded only in reinforcement phase.");
        }

        if (command.PlayerId != state.ActivePlayerId)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.NotActivePlayer, "Only active player can trade cards.");
        }

        if (command.CardIds is null || command.CardIds.Count != 3)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidCards, "Exactly 3 cards are required.");
        }

        var hand = state.GetPlayerCardIds(command.PlayerId);
        if (command.CardIds.Any(cardId => !hand.Contains(cardId, StringComparer.Ordinal)))
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidCards, "One or more cards are not owned by player.");
        }

        var symbols = new List<string>(3);
        foreach (var cardId in command.CardIds)
        {
            if (!state.TryGetCardSymbol(cardId, out var symbol))
            {
                return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidCards, "Unknown card symbol.");
            }

            symbols.Add(symbol);
        }

        if (!TryGetTradeBonus(symbols, out var baseBonus))
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidCards, "Invalid trade set.");
        }

        var territoryOwnerBonus = command.CardIds.Count(cardId =>
            cardId.StartsWith("territory:", StringComparison.Ordinal) &&
            state.TryGetTerritory(cardId["territory:".Length..], out var territory) &&
            territory is not null &&
            string.Equals(territory.OwnerPlayerId, command.PlayerId, StringComparison.Ordinal)) * 2;
        var bonus = baseBonus + territoryOwnerBonus;
        var nextState = state
            .RemovePlayerCards(command.PlayerId, command.CardIds)
            .AddCardsToDrawPile(command.CardIds)
            .WithReinforcements(state.ReinforcementsAvailable + bonus);

        var evt = new CardsTradedEvent(
            state.MatchId,
            NextSequence(),
            DateTimeOffset.UtcNow,
            command.PlayerId,
            command.CardIds,
            bonus,
            state.TradeBonusStep);

        return CommandExecutionResult.Accepted(nextState, [new GameEventEnvelope(true, evt, command.CommandId)]);
    }

    public CommandExecutionResult Handle(GameState state, AttackCommand command)
    {
        var ended = RejectIfGameEnded(state);
        if (ended is not null)
        {
            return ended;
        }

        if (!string.IsNullOrWhiteSpace(state.PendingCaptureFromTerritoryId) &&
            !string.IsNullOrWhiteSpace(state.PendingCaptureToTerritoryId))
        {
            return CommandExecutionResult.Rejected(
                state,
                CommandErrorCode.InvalidPhase,
                "Resolve captured armies movement before attacking again.");
        }

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

        // Italian profile: defender can roll up to 3 dice.
        var defenderDice = Math.Min(3, toTerritory.Armies);
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
            .SetTerritoryState(updatedTo)
            .ClearPendingCaptureMove();

        var wasCaptured = updatedTo.Armies <= 0;
        var eliminatedPlayerId = string.Empty;
        if (wasCaptured)
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

            var maxMoveTotal = capturedTo.Armies + Math.Max(0, capturedFrom.Armies - 1);

            nextState = nextState
                .SetTerritoryState(capturedFrom)
                .SetTerritoryState(capturedTo)
                .MarkTerritoryCaptured(true)
                .WithPendingCaptureMove(
                    command.FromTerritoryId,
                    command.ToTerritoryId,
                    capturedTo.Armies,
                    Math.Max(capturedTo.Armies, maxMoveTotal));

            if (IsEliminated(nextState, toTerritory.OwnerPlayerId))
            {
                eliminatedPlayerId = toTerritory.OwnerPlayerId;
                nextState = nextState
                    .SetPlayerEliminated(eliminatedPlayerId)
                    .TransferAllCards(eliminatedPlayerId, command.PlayerId);
            }
        }

        var events = new List<GameEventEnvelope>();
        var attackEvent = new AttackResolvedEvent(
            state.MatchId,
            NextSequence(),
            DateTimeOffset.UtcNow,
            command.PlayerId,
            toTerritory.OwnerPlayerId,
            command.FromTerritoryId,
            command.ToTerritoryId,
            attackerRolls,
            defenderRolls,
            attackerLosses,
            defenderLosses);

        events.Add(new GameEventEnvelope(true, attackEvent, command.CommandId));

        if (wasCaptured)
        {
            var captureEvent = new TerritoryCapturedEvent(
                state.MatchId,
                NextSequence(),
                DateTimeOffset.UtcNow,
                command.ToTerritoryId,
                toTerritory.OwnerPlayerId,
                command.PlayerId,
                nextState.Territories[command.ToTerritoryId].Armies);

            events.Add(new GameEventEnvelope(true, captureEvent, command.CommandId));

            if (!string.IsNullOrWhiteSpace(eliminatedPlayerId))
            {
                events.Add(
                    new GameEventEnvelope(
                        true,
                        new PlayerEliminatedEvent(
                            state.MatchId,
                            NextSequence(),
                            DateTimeOffset.UtcNow,
                            eliminatedPlayerId,
                            command.PlayerId),
                        command.CommandId));
            }
        }

        if (wasCaptured && TryResolveObjectiveWinner(nextState, command.PlayerId, out var winnerPlayerId))
        {
            nextState = AppendObjectiveVictory(nextState, events, command.CommandId, state.MatchId, winnerPlayerId);
        }

        return CommandExecutionResult.Accepted(nextState, events);
    }

    public CommandExecutionResult Handle(GameState state, MoveCapturedArmiesCommand command)
    {
        var ended = RejectIfGameEnded(state);
        if (ended is not null)
        {
            return ended;
        }

        if (state.Phase != TurnPhase.Attack)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidPhase, "Not in attack phase.");
        }

        if (command.PlayerId != state.ActivePlayerId)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.NotActivePlayer, "Only active player can move captured armies.");
        }

        if (string.IsNullOrWhiteSpace(state.PendingCaptureFromTerritoryId) ||
            string.IsNullOrWhiteSpace(state.PendingCaptureToTerritoryId))
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidPhase, "No pending captured territory movement.");
        }

        if (!string.Equals(state.PendingCaptureFromTerritoryId, command.FromTerritoryId, StringComparison.Ordinal) ||
            !string.Equals(state.PendingCaptureToTerritoryId, command.ToTerritoryId, StringComparison.Ordinal))
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidOwnership, "Capture move territories do not match pending state.");
        }

        if (!state.TryGetTerritory(command.FromTerritoryId, out var fromTerritory) || fromTerritory is null ||
            !state.TryGetTerritory(command.ToTerritoryId, out var toTerritory) || toTerritory is null)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidOwnership, "Territories not found.");
        }

        if (fromTerritory.OwnerPlayerId != command.PlayerId || toTerritory.OwnerPlayerId != command.PlayerId)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidOwnership, "Both territories must be owned by player.");
        }

        if (command.ArmiesToMoveTotal < state.PendingCaptureMinArmies || command.ArmiesToMoveTotal > state.PendingCaptureMaxArmies)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidArmyAmount, "Invalid captured armies movement amount.");
        }

        var currentTotalInCaptured = toTerritory.Armies;
        var additionalToMove = command.ArmiesToMoveTotal - currentTotalInCaptured;
        if (additionalToMove < 0 || additionalToMove >= fromTerritory.Armies)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidArmyAmount, "Invalid captured armies movement delta.");
        }

        var updatedFrom = fromTerritory with { Armies = fromTerritory.Armies - additionalToMove };
        var updatedTo = toTerritory with { Armies = toTerritory.Armies + additionalToMove };

        var nextState = state
            .SetTerritoryState(updatedFrom)
            .SetTerritoryState(updatedTo)
            .ClearPendingCaptureMove();

        var movedEvent = new CapturedArmiesMovedEvent(
            state.MatchId,
            NextSequence(),
            DateTimeOffset.UtcNow,
            command.PlayerId,
            command.FromTerritoryId,
            command.ToTerritoryId,
            updatedFrom.Armies,
            updatedTo.Armies);

        return CommandExecutionResult.Accepted(nextState, [new GameEventEnvelope(true, movedEvent, command.CommandId)]);
    }

    public CommandExecutionResult Handle(GameState state, FortifyCommand command)
    {
        var ended = RejectIfGameEnded(state);
        if (ended is not null)
        {
            return ended;
        }

        if (state.Phase != TurnPhase.Fortify)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidPhase, "Not in fortify phase.");
        }

        if (state.FortifyUsedThisTurn)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidPhase, "Fortify already used this turn.");
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

        if (!fromTerritory.IsAdjacentTo(toTerritory.TerritoryId))
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.NotAdjacent, "Fortify requires adjacent owned territories.");
        }

        var updatedFrom = fromTerritory with { Armies = fromTerritory.Armies - command.ArmiesToMove };
        var updatedTo = toTerritory with { Armies = toTerritory.Armies + command.ArmiesToMove };
        var nextState = state
            .SetTerritoryState(updatedFrom)
            .SetTerritoryState(updatedTo)
            .MarkFortifyUsed(true);

        var events = new List<GameEventEnvelope>();
        if (TryResolveObjectiveWinner(nextState, command.PlayerId, out var fortifyWinnerPlayerId))
        {
            nextState = AppendObjectiveVictory(nextState, events, command.CommandId, state.MatchId, fortifyWinnerPlayerId);
        }

        return CommandExecutionResult.Accepted(nextState, events);
    }

    public CommandExecutionResult Handle(GameState state, EndTurnCommand command)
    {
        var ended = RejectIfGameEnded(state);
        if (ended is not null)
        {
            return ended;
        }

        if (command.PlayerId != state.ActivePlayerId)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.NotActivePlayer, "Only active player can end turn.");
        }

        if (state.Phase == TurnPhase.Setup)
        {
            return CommandExecutionResult.Rejected(
                state,
                CommandErrorCode.InvalidPhase,
                "Setup phase advances automatically after placing armies.");
        }

        if (state.Phase == TurnPhase.Reinforcement && state.ReinforcementsAvailable > 0)
        {
            return CommandExecutionResult.Rejected(state, CommandErrorCode.InvalidPhase, "Place all reinforcements before ending phase.");
        }

        if (state.Phase == TurnPhase.Reinforcement)
        {
            if (IsForcedTradeRequired(state, command.PlayerId))
            {
                return CommandExecutionResult.Rejected(
                    state,
                    CommandErrorCode.InvalidCards,
                    $"Card trade required before leaving reinforcement phase (hand >= {ForcedTradeThreshold}).");
            }

            var toAttack = state.WithPhase(TurnPhase.Attack);
            var startedAttack = new TurnStartedEvent(
                state.MatchId,
                NextSequence(),
                DateTimeOffset.UtcNow,
                state.ActivePlayerId,
                state.TurnIndex,
                TurnPhase.Attack.ToString());

            return CommandExecutionResult.Accepted(
                toAttack,
                [new GameEventEnvelope(true, startedAttack, command.CommandId)]);
        }

        if (state.Phase == TurnPhase.Attack)
        {
            if (!string.IsNullOrWhiteSpace(state.PendingCaptureFromTerritoryId))
            {
                return CommandExecutionResult.Rejected(
                    state,
                    CommandErrorCode.InvalidPhase,
                    "Resolve captured armies movement before ending attack phase.");
            }

            var toFortify = state.WithPhase(TurnPhase.Fortify);
            var startedFortify = new TurnStartedEvent(
                state.MatchId,
                NextSequence(),
                DateTimeOffset.UtcNow,
                state.ActivePlayerId,
                state.TurnIndex,
                TurnPhase.Fortify.ToString());

            return CommandExecutionResult.Accepted(
                toFortify,
                [new GameEventEnvelope(true, startedFortify, command.CommandId)]);
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
        var events = new List<GameEventEnvelope>();

        if (state.TerritoryCapturedThisTurn && nextState.TryPeekTopDrawCard(out var grantedCardId))
        {
            nextState = nextState.AddCardToPlayer(state.ActivePlayerId, grantedCardId);
            events.Add(
                new GameEventEnvelope(
                    true,
                    new CardGrantedEvent(
                        state.MatchId,
                        NextSequence(),
                        DateTimeOffset.UtcNow,
                        state.ActivePlayerId,
                        grantedCardId),
                    command.CommandId));
        }

        var endedEvent = new TurnEndedEvent(
            state.MatchId,
            NextSequence(),
            DateTimeOffset.UtcNow,
            command.PlayerId,
            nextState.TurnIndex);

        var started = new TurnStartedEvent(
            state.MatchId,
            NextSequence(),
            DateTimeOffset.UtcNow,
            nextPlayerId,
            nextState.TurnIndex,
            nextState.Phase.ToString());

        events.Add(new GameEventEnvelope(true, endedEvent, command.CommandId));
        events.Add(new GameEventEnvelope(true, started, command.CommandId));
        return CommandExecutionResult.Accepted(nextState, events);
    }

    private static bool TryResolveObjectiveWinner(GameState state, string playerId, out string winnerPlayerId)
    {
        winnerPlayerId = string.Empty;
        if (!state.TryGetObjective(playerId, out var objective) || objective is null)
        {
            return false;
        }

        var ownedTerritories = state.Territories.Values.Where(territory => territory.OwnerPlayerId == playerId).ToList();
        var ownedCount = ownedTerritories.Count;

        if (string.Equals(objective.Kind, "territory_count", StringComparison.Ordinal))
        {
            if (ownedCount >= objective.TargetTerritoryCount)
            {
                winnerPlayerId = playerId;
                return true;
            }

            return false;
        }

        if (string.Equals(objective.Kind, "territory_with_min_armies", StringComparison.Ordinal))
        {
            var threshold = Math.Max(1, objective.RequiredArmiesPerTerritory);
            var qualified = ownedTerritories.Count(territory => territory.Armies >= threshold);
            if (qualified >= objective.TargetTerritoryCount)
            {
                winnerPlayerId = playerId;
                return true;
            }

            return false;
        }

        if (string.Equals(objective.Kind, "continent_combo", StringComparison.Ordinal))
        {
            var required = objective.RequiredContinentIds ?? [];
            var ownedContinents = state.Continents
                .Where(continent => continent.TerritoryIds.All(id =>
                    state.TryGetTerritory(id, out var territory) &&
                    territory is not null &&
                    territory.OwnerPlayerId == playerId))
                .Select(continent => continent.ContinentId)
                .ToList();

            var hasRequired = required.All(continentId => ownedContinents.Contains(continentId, StringComparer.Ordinal));
            var additionalCount = ownedContinents.Count(continentId => !required.Contains(continentId, StringComparer.Ordinal));
            if (hasRequired && additionalCount >= objective.RequiredAdditionalContinentCount)
            {
                winnerPlayerId = playerId;
                return true;
            }

            return false;
        }

        if (string.Equals(objective.Kind, "eliminate_player", StringComparison.Ordinal))
        {
            if (!string.IsNullOrWhiteSpace(objective.EliminateTargetPlayerId))
            {
                var targetHasTerritories = state.Territories.Values.Any(territory =>
                    string.Equals(territory.OwnerPlayerId, objective.EliminateTargetPlayerId, StringComparison.Ordinal));
                if (!targetHasTerritories)
                {
                    winnerPlayerId = playerId;
                    return true;
                }
            }

            if (objective.TargetTerritoryCount > 0 && ownedCount >= objective.TargetTerritoryCount)
            {
                winnerPlayerId = playerId;
                return true;
            }
        }

        return false;
    }

    private GameState AppendObjectiveVictory(
        GameState state,
        List<GameEventEnvelope> events,
        string commandId,
        string matchId,
        string winnerPlayerId)
    {
        var nextState = state.SetWinner(winnerPlayerId);
        events.Add(
            new GameEventEnvelope(
                true,
                new ObjectiveCompletedEvent(
                    matchId,
                    NextSequence(),
                    DateTimeOffset.UtcNow,
                    winnerPlayerId),
                commandId));
        events.Add(
            new GameEventEnvelope(
                true,
                new GameEndedEvent(
                    matchId,
                    NextSequence(),
                    DateTimeOffset.UtcNow,
                    winnerPlayerId,
                    "objective_completed"),
                commandId));

        return nextState;
    }

    private static bool IsForcedTradeRequired(GameState state, string playerId) =>
        state.GetPlayerCardIds(playerId).Count >= ForcedTradeThreshold;

    private static bool IsEliminated(GameState state, string playerId) =>
        state.Territories.Values.All(territory => !string.Equals(territory.OwnerPlayerId, playerId, StringComparison.Ordinal));

    private static CommandExecutionResult? RejectIfGameEnded(GameState state)
    {
        if (string.IsNullOrWhiteSpace(state.WinnerPlayerId))
        {
            return null;
        }

        return CommandExecutionResult.Rejected(
            state,
            CommandErrorCode.GameEnded,
            $"Game already ended. Winner: {state.WinnerPlayerId}.");
    }

    private static int CalculateReinforcements(GameState state, string playerId)
    {
        var territoryCount = state.Territories.Values.Count(t => t.OwnerPlayerId == playerId);
        var byTerritory = Math.Max(3, territoryCount / 3);
        var continentBonus = 0;

        foreach (var continent in state.Continents)
        {
            var ownsAll = continent.TerritoryIds.All(territoryId =>
                state.TryGetTerritory(territoryId, out var territory) &&
                territory is not null &&
                territory.OwnerPlayerId == playerId);

            if (ownsAll)
            {
                continentBonus += continent.Bonus;
            }
        }

        return byTerritory + continentBonus;
    }

    private GameState HandleSetupTurnTransition(
        GameState previousState,
        GameState stateAfterPlacement,
        PlaceReinforcementsCommand command,
        List<GameEventEnvelope> events)
    {
        if (TryGetNextSetupPlayer(stateAfterPlacement, previousState.ActivePlayerId, out var nextSetupPlayerId, out var nextSetupToPlace))
        {
            var wrapped = IsSetupRoundWrap(stateAfterPlacement, previousState.ActivePlayerId, nextSetupPlayerId);
            var nextSetupState = stateAfterPlacement.AdvanceTurn(nextSetupPlayerId, nextSetupToPlace, wrapped).WithPhase(TurnPhase.Setup);
            events.Add(
                new GameEventEnvelope(
                    true,
                    new TurnEndedEvent(
                        previousState.MatchId,
                        NextSequence(),
                        DateTimeOffset.UtcNow,
                        command.PlayerId,
                        nextSetupState.TurnIndex),
                    command.CommandId));
            events.Add(
                new GameEventEnvelope(
                    true,
                    new TurnStartedEvent(
                        previousState.MatchId,
                        NextSequence(),
                        DateTimeOffset.UtcNow,
                        nextSetupPlayerId,
                        nextSetupState.TurnIndex,
                        TurnPhase.Setup.ToString()),
                    command.CommandId));
            return nextSetupState;
        }

        var firstActivePlayerId = stateAfterPlacement.Players.FirstOrDefault(player => !player.IsEliminated)?.PlayerId
            ?? previousState.ActivePlayerId;
        var normalReinforcements = CalculateReinforcements(stateAfterPlacement, firstActivePlayerId);
        var setupCompletedState = stateAfterPlacement.AdvanceTurn(firstActivePlayerId, normalReinforcements, incrementRound: true);

        events.Add(
            new GameEventEnvelope(
                true,
                new TurnEndedEvent(
                    previousState.MatchId,
                    NextSequence(),
                    DateTimeOffset.UtcNow,
                    command.PlayerId,
                    setupCompletedState.TurnIndex),
                command.CommandId));
        events.Add(
            new GameEventEnvelope(
                true,
                new TurnStartedEvent(
                    previousState.MatchId,
                    NextSequence(),
                    DateTimeOffset.UtcNow,
                    firstActivePlayerId,
                    setupCompletedState.TurnIndex,
                    TurnPhase.Reinforcement.ToString()),
                command.CommandId));

        return setupCompletedState;
    }

    private static bool IsSetupRoundWrap(GameState state, string currentPlayerId, string nextPlayerId)
    {
        var activePlayers = state.Players.Where(player => !player.IsEliminated).Select(player => player.PlayerId).ToList();
        if (activePlayers.Count == 0)
        {
            return false;
        }

        var currentIndex = activePlayers.FindIndex(playerId => string.Equals(playerId, currentPlayerId, StringComparison.Ordinal));
        var nextIndex = activePlayers.FindIndex(playerId => string.Equals(playerId, nextPlayerId, StringComparison.Ordinal));
        return currentIndex >= 0 && nextIndex >= 0 && nextIndex <= currentIndex;
    }

    private static bool TryGetNextSetupPlayer(
        GameState state,
        string currentPlayerId,
        out string nextPlayerId,
        out int armiesToPlace)
    {
        var activePlayers = state.Players.Where(player => !player.IsEliminated).ToList();
        nextPlayerId = string.Empty;
        armiesToPlace = 0;
        if (activePlayers.Count == 0)
        {
            return false;
        }

        var currentIndex = activePlayers.FindIndex(player => string.Equals(player.PlayerId, currentPlayerId, StringComparison.Ordinal));
        if (currentIndex < 0)
        {
            currentIndex = 0;
        }

        for (var step = 1; step <= activePlayers.Count; step++)
        {
            var candidate = activePlayers[(currentIndex + step) % activePlayers.Count];
            var remaining = CalculateSetupRemainingArmies(state, candidate.PlayerId, activePlayers.Count);
            if (remaining <= 0)
            {
                continue;
            }

            nextPlayerId = candidate.PlayerId;
            armiesToPlace = Math.Min(3, remaining);
            return true;
        }

        return false;
    }

    private static int CalculateSetupRemainingArmies(GameState state, string playerId, int activePlayerCount)
    {
        var target = GetStartingArmies(activePlayerCount);
        var totalArmies = state.Territories.Values
            .Where(territory => string.Equals(territory.OwnerPlayerId, playerId, StringComparison.Ordinal))
            .Sum(territory => territory.Armies);
        return Math.Max(0, target - totalArmies);
    }

    private static int GetStartingArmies(int playerCount) =>
        playerCount switch
        {
            2 => 40,
            3 => 35,
            4 => 30,
            5 => 25,
            6 => 20,
            _ => 20
        };

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

    private static bool TryGetTradeBonus(IReadOnlyList<string> symbols, out int bonus)
    {
        bonus = 0;
        if (symbols.Count != 3)
        {
            return false;
        }

        var normalized = symbols.Select(value => value.ToLowerInvariant()).ToList();
        var jokerCount = normalized.Count(symbol => symbol == "joker");
        if (jokerCount > 1)
        {
            return false;
        }

        var nonJoker = normalized.Where(symbol => symbol != "joker").ToList();

        if (nonJoker.Count == 3)
        {
            var distinct = nonJoker.Distinct(StringComparer.Ordinal).Count();
            if (distinct == 1)
            {
                bonus = nonJoker[0] switch
                {
                    "artillery" => 4,
                    "infantry" => 6,
                    "cavalry" => 8,
                    _ => 0
                };
                return bonus > 0;
            }

            if (distinct == 3)
            {
                bonus = 10;
                return true;
            }

            return false;
        }

        if (jokerCount == 1 && nonJoker.Count == 2 && string.Equals(nonJoker[0], nonJoker[1], StringComparison.Ordinal))
        {
            bonus = 12;
            return true;
        }

        return false;
    }

    private long NextSequence()
    {
        _sequence += 1;
        return _sequence;
    }
}
