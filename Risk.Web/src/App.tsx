import { useEffect, useMemo, useRef, useState } from "react";
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

type HostGameState = {
  matchId: string;
  phase: string;
  turnIndex: number;
  roundIndex: number;
  activePlayerId: string;
  territories: Record<string, HostTerritoryState>;
};

type MatchStateResponse = {
  matchId: string;
  roomId: string;
  state: HostGameState;
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
  const selectedTerritory = selectedTerritoryId
    ? worldClassic.map.territories.find(territory => territory.id === selectedTerritoryId) ?? null
    : null;
  const neighborTerritoryIds = useMemo(
    () => new Set(selectedTerritory?.neighbors ?? []),
    [selectedTerritory]
  );

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
        const response = await fetch(
          `${hostUrl.replace(/\/$/, "")}/api/matches/${encodeURIComponent(matchId.trim())}/state`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as MatchStateResponse;
        if (cancelled) {
          return;
        }

        setAuthoritativeState(payload.state);
        setLoadError(null);
        setLastSyncTime(new Date().toLocaleTimeString());
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
  }, [hostUrl, matchId, isConnected]);

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

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Risiko - Mappa World Classic</h1>
        <p>{territoryCount} territori caricati da pack dati e SVG.</p>
      </header>

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
          {loadError && <p className="sync-error">{loadError}</p>}

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
      </section>
    </main>
  );
}

export default App;
