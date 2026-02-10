import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  labelForTerritory,
  territoryIdsFromSvg,
  validateWorldClassicBinding,
  worldClassic
} from "./map/worldClassic";
import {
  classListForTerritory,
  computeSelectableTerritoryIds,
  type VisualPhase
} from "./map/territoryVisualState";

type HostTerritoryState = {
  territoryId: string;
  ownerPlayerId: string;
  armies: number;
  neighborTerritoryIds: string[];
};

type HostPlayerState = {
  playerId: string;
  displayName: string;
  isEliminated: boolean;
};

type HostGameState = {
  matchId: string;
  players: HostPlayerState[];
  phase: string;
  turnIndex: number;
  roundIndex: number;
  activePlayerId: string;
  reinforcementsAvailable: number;
  territories: Record<string, HostTerritoryState>;
};

type MatchStateResponse = {
  matchId: string;
  roomId: string;
  state: HostGameState;
};

type SubmitCommandResponse = {
  accepted: boolean;
  errorCode: number;
  message: string;
  appliedEventCount: number;
};

const OWNER_COLORS = ["#e8a8a8", "#a8c5f5", "#afe1b0", "#f0c286", "#c8b0e7", "#94ddd3"];

function ownerColor(ownerPlayerId: string): string {
  if (ownerPlayerId === "neutral") {
    return "#d2d8de";
  }

  let hash = 0;
  for (let i = 0; i < ownerPlayerId.length; i += 1) {
    hash = (hash * 31 + ownerPlayerId.charCodeAt(i)) | 0;
  }

  return OWNER_COLORS[Math.abs(hash) % OWNER_COLORS.length];
}

function parsePhase(phase: string | undefined): VisualPhase {
  const value = (phase ?? "").toLowerCase();
  if (value === "attack" || value === "fortify") {
    return value;
  }

  return "reinforcement";
}

function upsertArmyOverlay(territoryNode: SVGGElement, armies: number): void {
  const rect = territoryNode.querySelector<SVGRectElement>("rect");
  if (!rect) {
    return;
  }

  const x = Number(rect.getAttribute("x") ?? "0");
  const y = Number(rect.getAttribute("y") ?? "0");
  const width = Number(rect.getAttribute("width") ?? "0");
  const badgeCenterX = x + width - 14;
  const badgeCenterY = y + 14;

  let overlay = territoryNode.querySelector<SVGGElement>("g.army-overlay");
  if (!overlay) {
    overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
    overlay.setAttribute("class", "army-overlay");

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "army-badge-bg");
    circle.setAttribute("r", "10");
    overlay.appendChild(circle);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("class", "army-badge");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    overlay.appendChild(text);

    territoryNode.appendChild(overlay);
  }

  overlay.setAttribute("transform", `translate(${badgeCenterX} ${badgeCenterY})`);
  const text = overlay.querySelector<SVGTextElement>("text.army-badge");
  if (text) {
    text.textContent = String(armies);
  }
}

function App() {
  const mapRootRef = useRef<HTMLDivElement>(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);
  const [hoveredTerritoryId, setHoveredTerritoryId] = useState<string | null>(null);
  const [hostUrl, setHostUrl] = useState("http://localhost:5050");
  const [matchId, setMatchId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>("-");
  const [authoritativeState, setAuthoritativeState] = useState<HostGameState | null>(null);
  const [peerId, setPeerId] = useState("");
  const [commandPlayerId, setCommandPlayerId] = useState("");
  const [reinforceTerritoryId, setReinforceTerritoryId] = useState("");
  const [reinforceArmies, setReinforceArmies] = useState(1);
  const [attackFromId, setAttackFromId] = useState("");
  const [attackToId, setAttackToId] = useState("");
  const [attackDice, setAttackDice] = useState(1);
  const [fortifyFromId, setFortifyFromId] = useState("");
  const [fortifyToId, setFortifyToId] = useState("");
  const [fortifyArmies, setFortifyArmies] = useState(1);
  const [commandStatus, setCommandStatus] = useState<string>("-");
  const validationErrors = useMemo(() => validateWorldClassicBinding(), []);
  const territoryCount = worldClassic.map.territories.length;
  const ownerByTerritoryId = useMemo<Record<string, string>>(() => {
    if (!authoritativeState) {
      return {};
    }

    const result: Record<string, string> = {};
    Object.values(authoritativeState.territories).forEach(territory => {
      result[territory.territoryId] = territory.ownerPlayerId;
    });
    return result;
  }, [authoritativeState]);
  const armyByTerritoryId = useMemo<Record<string, number>>(() => {
    if (!authoritativeState) {
      return {};
    }

    const result: Record<string, number> = {};
    Object.values(authoritativeState.territories).forEach(territory => {
      result[territory.territoryId] = territory.armies;
    });
    return result;
  }, [authoritativeState]);
  const currentPhase = parsePhase(authoritativeState?.phase);
  const currentPlayerId = authoritativeState?.activePlayerId ?? "";
  const reinforcementPool = authoritativeState?.reinforcementsAvailable ?? 0;
  const players = authoritativeState?.players ?? [];
  const selectedTerritory = selectedTerritoryId
    ? worldClassic.map.territories.find(territory => territory.id === selectedTerritoryId) ?? null
    : null;
  const neighborTerritoryIds = useMemo(
    () => new Set(selectedTerritory?.neighbors ?? []),
    [selectedTerritory]
  );
  const ownedTerritories = useMemo(
    () =>
      worldClassic.map.territories
        .filter(territory => ownerByTerritoryId[territory.id] === commandPlayerId)
        .map(territory => territory.id),
    [commandPlayerId, ownerByTerritoryId]
  );
  const attackTargets = useMemo(() => {
    if (!attackFromId) {
      return [];
    }

    const from = worldClassic.map.territories.find(territory => territory.id === attackFromId);
    if (!from) {
      return [];
    }

    return from.neighbors.filter(id => {
      const owner = ownerByTerritoryId[id];
      return owner && owner !== "neutral" && owner !== commandPlayerId;
    });
  }, [attackFromId, commandPlayerId, ownerByTerritoryId]);
  const fortifyTargets = useMemo(() => {
    if (!fortifyFromId) {
      return [];
    }

    const from = worldClassic.map.territories.find(territory => territory.id === fortifyFromId);
    if (!from) {
      return [];
    }

    return from.neighbors.filter(id => ownerByTerritoryId[id] === commandPlayerId);
  }, [fortifyFromId, commandPlayerId, ownerByTerritoryId]);
  const playerSummaries = useMemo(() => {
    if (!players.length) {
      return [];
    }

    return players.map(player => {
      let territoryCount = 0;
      let totalArmies = 0;
      Object.entries(ownerByTerritoryId).forEach(([territoryId, owner]) => {
        if (owner !== player.playerId) {
          return;
        }

        territoryCount += 1;
        totalArmies += armyByTerritoryId[territoryId] ?? 0;
      });

      return {
        ...player,
        territoryCount,
        totalArmies
      };
    });
  }, [armyByTerritoryId, ownerByTerritoryId, players]);
  const activePlayer = useMemo(
    () => players.find(player => player.playerId === currentPlayerId) ?? null,
    [currentPlayerId, players]
  );
  const attackFromArmies = attackFromId ? armyByTerritoryId[attackFromId] ?? 0 : 0;
  const attackToArmies = attackToId ? armyByTerritoryId[attackToId] ?? 0 : 0;
  const maxAttackerDice = Math.min(3, Math.max(0, attackFromArmies - 1));
  const defenderDice = Math.min(2, Math.max(0, attackToArmies));
  const combatComparisons = Math.min(attackDice, defenderDice);

  const fetchAuthoritativeState = useCallback(async () => {
    const response = await fetch(
      `${hostUrl.replace(/\/$/, "")}/api/matches/${encodeURIComponent(matchId.trim())}/state`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as MatchStateResponse;
    setAuthoritativeState(payload.state);
    setLoadError(null);
    setLastSyncTime(new Date().toLocaleTimeString());
  }, [hostUrl, matchId]);

  const selectableTerritoryIds = useMemo(
    () =>
      computeSelectableTerritoryIds(
        worldClassic.map.territories,
        ownerByTerritoryId,
        currentPlayerId,
        currentPhase,
        selectedTerritoryId
      ),
    [currentPhase, currentPlayerId, ownerByTerritoryId, selectedTerritoryId]
  );

  useEffect(() => {
    if (!isConnected || !matchId.trim()) {
      return;
    }

    let cancelled = false;
    const fetchState = async () => {
      try {
        if (cancelled) {
          return;
        }

        await fetchAuthoritativeState();
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadError(`Sync error: ${(error as Error).message}`);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchAuthoritativeState, isConnected, matchId]);

  useEffect(() => {
    if (!currentPlayerId) {
      return;
    }

    setCommandPlayerId(currentPlayerId);
    setPeerId(currentPlayerId);
  }, [currentPlayerId]);

  useEffect(() => {
    if (!ownedTerritories.length) {
      return;
    }

    if (!reinforceTerritoryId || !ownedTerritories.includes(reinforceTerritoryId)) {
      setReinforceTerritoryId(ownedTerritories[0]);
    }

    if (!attackFromId || !ownedTerritories.includes(attackFromId)) {
      setAttackFromId(ownedTerritories[0]);
    }

    if (!fortifyFromId || !ownedTerritories.includes(fortifyFromId)) {
      setFortifyFromId(ownedTerritories[0]);
    }
  }, [attackFromId, fortifyFromId, ownedTerritories, reinforceTerritoryId]);

  useEffect(() => {
    if (!attackTargets.length) {
      setAttackToId("");
      return;
    }

    if (!attackToId || !attackTargets.includes(attackToId)) {
      setAttackToId(attackTargets[0]);
    }
  }, [attackTargets, attackToId]);

  useEffect(() => {
    if (!fortifyTargets.length) {
      setFortifyToId("");
      return;
    }

    if (!fortifyToId || !fortifyTargets.includes(fortifyToId)) {
      setFortifyToId(fortifyTargets[0]);
    }
  }, [fortifyTargets, fortifyToId]);

  useEffect(() => {
    if (maxAttackerDice <= 0) {
      setAttackDice(1);
      return;
    }

    if (attackDice > maxAttackerDice) {
      setAttackDice(maxAttackerDice);
    }
  }, [attackDice, maxAttackerDice]);

  useEffect(() => {
    const root = mapRootRef.current;
    if (!root) {
      return;
    }

    const svgElement = root.querySelector("svg");
    if (!svgElement) {
      return;
    }

    const territoryIds = new Set(territoryIdsFromSvg(worldClassic.svg));

    const cleanupActions: Array<() => void> = [];

    for (const territoryId of territoryIds) {
      const territoryNode = svgElement.querySelector<SVGGElement>(`g#${territoryId}.territory`);
      if (!territoryNode) {
        continue;
      }

      territoryNode.classList.add("territory-node");
      territoryNode.setAttribute("role", "button");
      territoryNode.setAttribute("tabindex", "0");
      territoryNode.setAttribute("aria-label", labelForTerritory(territoryId));

      const onClick = () => setSelectedTerritoryId(territoryId);
      const onMouseEnter = () => setHoveredTerritoryId(territoryId);
      const onMouseLeave = () => setHoveredTerritoryId(current => (current === territoryId ? null : current));
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelectedTerritoryId(territoryId);
        }
      };

      territoryNode.addEventListener("click", onClick);
      territoryNode.addEventListener("mouseenter", onMouseEnter);
      territoryNode.addEventListener("mouseleave", onMouseLeave);
      territoryNode.addEventListener("keydown", onKeyDown);
      cleanupActions.push(() => {
        territoryNode.removeEventListener("click", onClick);
        territoryNode.removeEventListener("mouseenter", onMouseEnter);
        territoryNode.removeEventListener("mouseleave", onMouseLeave);
        territoryNode.removeEventListener("keydown", onKeyDown);
      });
    }

    return () => cleanupActions.forEach(cleanup => cleanup());
  }, []);

  useEffect(() => {
    const root = mapRootRef.current;
    if (!root) {
      return;
    }

    const territoryIds = territoryIdsFromSvg(worldClassic.svg);
    for (const territoryId of territoryIds) {
      const territoryNode = root.querySelector<SVGGElement>(`g#${territoryId}.territory`);
      if (!territoryNode) {
        continue;
      }

      const owner = ownerByTerritoryId[territoryId] ?? "neutral";
      const armies = armyByTerritoryId[territoryId] ?? 0;

      const classes = classListForTerritory({
        territoryId,
        selectedTerritoryId,
        hoveredTerritoryId,
        currentPlayerId,
        ownerByTerritoryId,
        selectableTerritoryIds,
        neighborTerritoryIds,
        underAttackTerritoryId: null,
        capturedTerritoryId: null
      });

      territoryNode.setAttribute("class", classes.join(" "));
      territoryNode.style.setProperty("--owner-color", ownerColor(owner));
      upsertArmyOverlay(territoryNode, armies);
    }
  }, [
    selectedTerritoryId,
    hoveredTerritoryId,
    selectableTerritoryIds,
    neighborTerritoryIds,
    currentPlayerId,
    ownerByTerritoryId,
    armyByTerritoryId
  ]);
  const selectedOwner = selectedTerritoryId
    ? ownerByTerritoryId[selectedTerritoryId] ?? "neutral"
    : null;
  const selectedArmies = selectedTerritoryId ? armyByTerritoryId[selectedTerritoryId] ?? 0 : 0;

  const submitCommand = async (type: string, payload: Record<string, unknown>) => {
    if (!isConnected || !matchId.trim()) {
      setCommandStatus("Host state sync is not active.");
      return;
    }

    if (!peerId.trim() || !commandPlayerId.trim()) {
      setCommandStatus("peerId and playerId are required.");
      return;
    }

    const commandId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const requestBody = {
      peerId: peerId.trim(),
      type,
      payload: {
        playerId: commandPlayerId.trim(),
        commandId,
        ...payload
      }
    };

    try {
      const response = await fetch(
        `${hostUrl.replace(/\/$/, "")}/api/matches/${encodeURIComponent(matchId.trim())}/commands`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        }
      );

      const result = (await response.json()) as SubmitCommandResponse;
      if (!response.ok || !result.accepted) {
        setCommandStatus(`Rejected (${result.errorCode}): ${result.message}`);
        return;
      }

      setCommandStatus(`Accepted: ${type} (${result.appliedEventCount} event(s))`);
      await fetchAuthoritativeState();
    } catch (error) {
      setCommandStatus(`Command error: ${(error as Error).message}`);
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Risiko - Mappa World Classic</h1>
        <p>{territoryCount} territori caricati da pack dati e SVG.</p>
      </header>

      <section className="top-info-grid">
        <article className="top-info-card">
          <h2>Match Snapshot</h2>
          <p>Match: {authoritativeState?.matchId ?? "-"}</p>
          <p>Round: {authoritativeState?.roundIndex ?? "-"}</p>
          <p>Turn: {authoritativeState?.turnIndex ?? "-"}</p>
          <p>Phase: {authoritativeState?.phase ?? "-"}</p>
          <p>Active: {(activePlayer?.displayName ?? currentPlayerId) || "-"}</p>
        </article>

        <article className="top-info-card">
          <h2>Player Order</h2>
          {playerSummaries.length === 0 ? (
            <p>No player data yet.</p>
          ) : (
            <ul className="player-order-list">
              {playerSummaries.map(player => (
                <li
                  key={player.playerId}
                  className={
                    player.playerId === currentPlayerId
                      ? "player-order-item is-active-player"
                      : "player-order-item"
                  }
                >
                  <span className="player-dot" style={{ backgroundColor: ownerColor(player.playerId) }} />
                  <span>{player.displayName}</span>
                  <span className="player-metrics">
                    {player.territoryCount} terr. / {player.totalArmies} armate
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      {validationErrors.length > 0 && (
        <section className="error-panel" aria-live="polite">
          <h2>Errori di binding pack</h2>
          <ul>
            {validationErrors.map(error => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="map-layout">
        <aside className="territory-panel">
          <h2>Connessione Host</h2>
          <label className="field">
            URL Host
            <input
              value={hostUrl}
              onChange={event => setHostUrl(event.target.value)}
              placeholder="http://localhost:5050"
            />
          </label>
          <label className="field">
            Match ID
            <input
              value={matchId}
              onChange={event => setMatchId(event.target.value)}
              placeholder="match-..."
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              onClick={() => setIsConnected(true)}
              disabled={!hostUrl.trim() || !matchId.trim()}
            >
              Avvia Sync Stato
            </button>
            <button
              type="button"
              onClick={() => {
                setIsConnected(false);
                setAuthoritativeState(null);
                setLoadError(null);
              }}
            >
              Disconnetti
            </button>
          </div>

          <p>Sync: {isConnected ? "attivo" : "disattivo"}</p>
          <p>Ultimo aggiornamento: {lastSyncTime}</p>
          <p>Turno: {authoritativeState?.turnIndex ?? "-"}</p>
          <p>Round: {authoritativeState?.roundIndex ?? "-"}</p>
          <p>Fase: {authoritativeState?.phase ?? "-"}</p>
          <p>Giocatore attivo: {currentPlayerId || "-"}</p>
          <p>Rinforzi disponibili: {reinforcementPool}</p>
          {loadError && <p className="sync-error">{loadError}</p>}

          <h2>Identita Comando</h2>
          <label className="field">
            Peer ID
            <input
              value={peerId}
              onChange={event => setPeerId(event.target.value)}
              placeholder="peer-id"
            />
          </label>
          <label className="field">
            Player ID
            <input
              value={commandPlayerId}
              onChange={event => setCommandPlayerId(event.target.value)}
              placeholder="player-id"
            />
          </label>

          <h2>Azioni Turno</h2>
          <div className="action-section">
            <h3>Reinforce</h3>
            <label className="field">
              Territorio
              <select
                value={reinforceTerritoryId}
                onChange={event => setReinforceTerritoryId(event.target.value)}
              >
                {ownedTerritories.map(id => (
                  <option key={id} value={id}>
                    {labelForTerritory(id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Armate
              <input
                type="number"
                min={1}
                value={reinforceArmies}
                onChange={event => setReinforceArmies(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <button
              type="button"
              disabled={currentPhase !== "reinforcement" || !reinforceTerritoryId || reinforceArmies < 1}
              onClick={() =>
                submitCommand("PlaceReinforcements", {
                  territoryId: reinforceTerritoryId,
                  armiesToPlace: reinforceArmies
                })
              }
            >
              Place Reinforcements
            </button>
          </div>

          <div className="action-section">
            <h3>Attack</h3>
            <label className="field">
              Da
              <select value={attackFromId} onChange={event => setAttackFromId(event.target.value)}>
                {ownedTerritories.map(id => (
                  <option key={id} value={id}>
                    {labelForTerritory(id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              A
              <select value={attackToId} onChange={event => setAttackToId(event.target.value)}>
                {attackTargets.map(id => (
                  <option key={id} value={id}>
                    {labelForTerritory(id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Dadi Attaccante
              <input
                type="number"
                min={1}
                max={Math.max(1, maxAttackerDice)}
                value={attackDice}
                onChange={event =>
                  setAttackDice(
                    Math.min(Math.max(1, maxAttackerDice), Math.max(1, Number(event.target.value) || 1))
                  )
                }
              />
            </label>
            <button
              type="button"
              disabled={
                currentPhase !== "attack" ||
                !attackFromId ||
                !attackToId ||
                maxAttackerDice <= 0 ||
                defenderDice <= 0
              }
              onClick={() =>
                submitCommand("Attack", {
                  fromTerritoryId: attackFromId,
                  toTerritoryId: attackToId,
                  attackerDice: attackDice
                })
              }
            >
              Attack
            </button>
          </div>

          <div className="action-section">
            <h3>Fortify</h3>
            <label className="field">
              Da
              <select value={fortifyFromId} onChange={event => setFortifyFromId(event.target.value)}>
                {ownedTerritories.map(id => (
                  <option key={id} value={id}>
                    {labelForTerritory(id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              A
              <select value={fortifyToId} onChange={event => setFortifyToId(event.target.value)}>
                {fortifyTargets.map(id => (
                  <option key={id} value={id}>
                    {labelForTerritory(id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Armate
              <input
                type="number"
                min={1}
                value={fortifyArmies}
                onChange={event => setFortifyArmies(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <button
              type="button"
              disabled={currentPhase !== "fortify" || !fortifyFromId || !fortifyToId}
              onClick={() =>
                submitCommand("Fortify", {
                  fromTerritoryId: fortifyFromId,
                  toTerritoryId: fortifyToId,
                  armiesToMove: fortifyArmies
                })
              }
            >
              Fortify
            </button>
          </div>

          <div className="action-section">
            <h3>Turn</h3>
            <button type="button" onClick={() => submitCommand("EndTurn", {})}>
              End Turn
            </button>
            <p className="command-status">{commandStatus}</p>
          </div>

          <div className="legend">
            <span className="legend-item neutral">Neutrale</span>
            <span className="legend-item owned">Posseduto</span>
            <span className="legend-item selectable">Selezionabile</span>
            <span className="legend-item selected">Selezionato</span>
            <span className="legend-item neighbor">Confinante</span>
          </div>

          <h2>Territorio selezionato</h2>
          {selectedTerritory ? (
            <>
              <strong>{labelForTerritory(selectedTerritory.id)}</strong>
              <p>ID: {selectedTerritory.id}</p>
              <p>Proprietario: {selectedOwner ?? "neutral"}</p>
              <p>Armate: {selectedArmies}</p>
              <p>Continente: {selectedTerritory.continent}</p>
              <p>Confinanti: {selectedTerritory.neighbors.length}</p>
              <p>
                Stato:{" "}
                {selectableTerritoryIds.has(selectedTerritory.id)
                  ? "Selezionabile"
                  : "Non selezionabile"}
              </p>
            </>
          ) : (
            <p>Seleziona un territorio sulla mappa.</p>
          )}
        </aside>

        <div
          ref={mapRootRef}
          className="map-canvas"
          dangerouslySetInnerHTML={{ __html: worldClassic.svg }}
        />

        <aside className="territory-panel tactical-panel">
          <h2>Tactical Context</h2>
          <div className="action-section">
            <h3>Current Phase</h3>
            <p className="phase-pill">{authoritativeState?.phase ?? "-"}</p>
            <p>Active player: {(activePlayer?.displayName ?? currentPlayerId) || "-"}</p>
            <p>Reinforcements: {reinforcementPool}</p>
          </div>

          <div className="action-section">
            <h3>Territory Detail</h3>
            {selectedTerritory ? (
              <>
                <p>Name: {labelForTerritory(selectedTerritory.id)}</p>
                <p>Owner: {selectedOwner ?? "neutral"}</p>
                <p>Armies: {selectedArmies}</p>
                <p>Neighbors: {selectedTerritory.neighbors.length}</p>
              </>
            ) : (
              <p>Select a territory to inspect details.</p>
            )}
          </div>

          <div className="action-section">
            <h3>Combat Preview</h3>
            {attackFromId && attackToId ? (
              <>
                <p>
                  Attacker: {labelForTerritory(attackFromId)} ({attackFromArmies} armies)
                </p>
                <p>
                  Defender: {labelForTerritory(attackToId)} ({attackToArmies} armies)
                </p>
                <p>Attacker dice: {attackDice}</p>
                <p>Defender dice: {defenderDice}</p>
                <p>Dice comparisons: {combatComparisons}</p>
                <p>Max attacker dice allowed: {maxAttackerDice}</p>
              </>
            ) : (
              <p>Pick attack source and target for preview.</p>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

export default App;
