import type { TerritoryDefinition } from "./worldClassic";

export type VisualPhase = "reinforcement" | "attack" | "fortify";

export type TerritoryVisualContext = {
  territoryId: string;
  selectedTerritoryId: string | null;
  hoveredTerritoryId: string | null;
  currentPlayerId: string;
  ownerByTerritoryId: Record<string, string>;
  selectableTerritoryIds: Set<string>;
  neighborTerritoryIds: Set<string>;
  underAttackTerritoryId: string | null;
  capturedTerritoryId: string | null;
};

export function computeSelectableTerritoryIds(
  territories: TerritoryDefinition[],
  ownerByTerritoryId: Record<string, string>,
  currentPlayerId: string,
  phase: VisualPhase,
  selectedTerritoryId: string | null
): Set<string> {
  const territoryById = new Map(territories.map(territory => [territory.id, territory]));
  const selectable = new Set<string>();

  if (phase === "reinforcement") {
    for (const territory of territories) {
      if (ownerByTerritoryId[territory.id] === currentPlayerId) {
        selectable.add(territory.id);
      }
    }

    return selectable;
  }

  if (!selectedTerritoryId) {
    for (const territory of territories) {
      if (ownerByTerritoryId[territory.id] === currentPlayerId) {
        selectable.add(territory.id);
      }
    }

    return selectable;
  }

  const selected = territoryById.get(selectedTerritoryId);
  if (!selected) {
    return selectable;
  }

  if (phase === "attack") {
    for (const neighborId of selected.neighbors) {
      const owner = ownerByTerritoryId[neighborId];
      if (owner && owner !== "neutral" && owner !== currentPlayerId) {
        selectable.add(neighborId);
      }
    }

    return selectable;
  }

  if (phase === "fortify") {
    for (const neighborId of selected.neighbors) {
      if (ownerByTerritoryId[neighborId] === currentPlayerId) {
        selectable.add(neighborId);
      }
    }
  }

  return selectable;
}

export function classListForTerritory(context: TerritoryVisualContext): string[] {
  const ownerId = context.ownerByTerritoryId[context.territoryId] ?? "neutral";
  const ownerClass = ownerId.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  const classes = ["territory-node", `owner-${ownerClass}`];

  if (ownerId === "neutral") {
    classes.push("is-neutral");
  } else {
    classes.push("is-owned");
  }

  if (context.selectedTerritoryId === context.territoryId) {
    classes.push("is-selected");
  }

  if (context.hoveredTerritoryId === context.territoryId) {
    classes.push("is-hovered");
  }

  if (context.selectableTerritoryIds.has(context.territoryId)) {
    classes.push("is-selectable");
  }

  if (context.neighborTerritoryIds.has(context.territoryId)) {
    classes.push("is-neighbor");
  }

  if (context.underAttackTerritoryId === context.territoryId) {
    classes.push("is-under-attack");
  }

  if (context.capturedTerritoryId === context.territoryId) {
    classes.push("is-captured");
  }

  return classes;
}
