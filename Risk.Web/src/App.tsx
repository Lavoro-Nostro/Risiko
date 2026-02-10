import { useEffect, useMemo, useRef, useState } from "react";
import {
  labelForTerritory,
  territoryIdsFromSvg,
  validateWorldClassicBinding,
  worldClassic
} from "./map/worldClassic";

function App() {
  const mapRootRef = useRef<HTMLDivElement>(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);
  const validationErrors = useMemo(() => validateWorldClassicBinding(), []);
  const territoryCount = worldClassic.map.territories.length;

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
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelectedTerritoryId(territoryId);
        }
      };

      territoryNode.addEventListener("click", onClick);
      territoryNode.addEventListener("keydown", onKeyDown);
      cleanupActions.push(() => {
        territoryNode.removeEventListener("click", onClick);
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

    const selectedNodes = root.querySelectorAll<SVGGElement>("g.territory-node.is-selected");
    selectedNodes.forEach(node => node.classList.remove("is-selected"));

    if (!selectedTerritoryId) {
      return;
    }

    const selected = root.querySelector<SVGGElement>(`g#${selectedTerritoryId}.territory-node`);
    selected?.classList.add("is-selected");
  }, [selectedTerritoryId]);

  const selected = selectedTerritoryId
    ? worldClassic.map.territories.find(territory => territory.id === selectedTerritoryId) ?? null
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
          <h2>Territorio selezionato</h2>
          {selected ? (
            <>
              <strong>{labelForTerritory(selected.id)}</strong>
              <p>ID: {selected.id}</p>
              <p>Continente: {selected.continent}</p>
              <p>Confinanti: {selected.neighbors.length}</p>
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
