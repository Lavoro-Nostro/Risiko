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

const DEMO_PLAYERS = ["player-1", "player-2", "player-3"] as const;
const PLAYER_LABELS: Record<string, string> = {
  "player-1": "Rosso",
  "player-2": "Blu",
  "player-3": "Verde",
  neutral: "Neutrale"
};

function App() {
  const mapRootRef = useRef<HTMLDivElement>(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);
  const [hoveredTerritoryId, setHoveredTerritoryId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<VisualPhase>("reinforcement");
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("player-1");
  const [underAttackTerritoryId, setUnderAttackTerritoryId] = useState<string | null>(null);
  const [capturedTerritoryId, setCapturedTerritoryId] = useState<string | null>(null);
  const validationErrors = useMemo(() => validateWorldClassicBinding(), []);
  const territoryCount = worldClassic.map.territories.length;
  const ownerByTerritoryId = useMemo(() => {
    const result: Record<string, string> = {};
    worldClassic.map.territories.forEach((territory, index) => {
      if (index % 7 === 0) {
        result[territory.id] = "neutral";
        return;
      }

      result[territory.id] = DEMO_PLAYERS[index % DEMO_PLAYERS.length];
    });
    return result;
  }, []);

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

      const classes = classListForTerritory({
        territoryId,
        selectedTerritoryId,
        hoveredTerritoryId,
        currentPlayerId,
        ownerByTerritoryId,
        selectableTerritoryIds,
        underAttackTerritoryId,
        capturedTerritoryId
      });

      territoryNode.setAttribute("class", classes.join(" "));
    }
  }, [
    selectedTerritoryId,
    hoveredTerritoryId,
    selectableTerritoryIds,
    currentPlayerId,
    ownerByTerritoryId,
    underAttackTerritoryId,
    capturedTerritoryId
  ]);

  const selected = selectedTerritoryId
    ? worldClassic.map.territories.find(territory => territory.id === selectedTerritoryId) ?? null
    : null;
  const selectedOwner = selectedTerritoryId
    ? ownerByTerritoryId[selectedTerritoryId] ?? "neutral"
    : null;

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
          <h2>Controlli Demo Stati</h2>
          <label className="field">
            Fase
            <select
              value={currentPhase}
              onChange={event => {
                setCurrentPhase(event.target.value as VisualPhase);
                setUnderAttackTerritoryId(null);
                setCapturedTerritoryId(null);
              }}
            >
              <option value="reinforcement">Reinforcement</option>
              <option value="attack">Attack</option>
              <option value="fortify">Fortify</option>
            </select>
          </label>

          <label className="field">
            Giocatore attivo
            <select
              value={currentPlayerId}
              onChange={event => setCurrentPlayerId(event.target.value)}
            >
              {DEMO_PLAYERS.map(playerId => (
                <option key={playerId} value={playerId}>
                  {PLAYER_LABELS[playerId]}
                </option>
              ))}
            </select>
          </label>

          <div className="button-row">
            <button
              type="button"
              onClick={() => selectedTerritoryId && setUnderAttackTerritoryId(selectedTerritoryId)}
              disabled={!selectedTerritoryId}
            >
              Segna sotto attacco
            </button>
            <button
              type="button"
              onClick={() => selectedTerritoryId && setCapturedTerritoryId(selectedTerritoryId)}
              disabled={!selectedTerritoryId}
            >
              Segna catturato
            </button>
            <button
              type="button"
              onClick={() => {
                setUnderAttackTerritoryId(null);
                setCapturedTerritoryId(null);
              }}
            >
              Pulisci marker
            </button>
          </div>

          <div className="legend">
            <span className="legend-item neutral">Neutrale</span>
            <span className="legend-item owned">Posseduto</span>
            <span className="legend-item selectable">Selezionabile</span>
            <span className="legend-item selected">Selezionato</span>
            <span className="legend-item attack">Sotto attacco</span>
            <span className="legend-item captured">Catturato</span>
          </div>

          <h2>Territorio selezionato</h2>
          {selected ? (
            <>
              <strong>{labelForTerritory(selected.id)}</strong>
              <p>ID: {selected.id}</p>
              <p>Proprietario: {PLAYER_LABELS[selectedOwner ?? "neutral"]}</p>
              <p>Continente: {selected.continent}</p>
              <p>Confinanti: {selected.neighbors.length}</p>
              <p>
                Stato:{" "}
                {selectableTerritoryIds.has(selected.id) ? "Selezionabile" : "Non selezionabile"}
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
