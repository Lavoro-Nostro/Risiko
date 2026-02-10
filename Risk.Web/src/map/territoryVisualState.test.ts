import { describe, expect, it } from "vitest";
import {
  classListForTerritory,
  computeSelectableTerritoryIds
} from "./territoryVisualState";
import type { TerritoryDefinition } from "./worldClassic";

const territories: TerritoryDefinition[] = [
  { id: "alaska", continent: "north_america", neighbors: ["alberta", "kamchatka"] },
  { id: "alberta", continent: "north_america", neighbors: ["alaska", "ontario"] },
  { id: "kamchatka", continent: "asia", neighbors: ["alaska"] },
  { id: "ontario", continent: "north_america", neighbors: ["alberta"] }
];

const ownerByTerritoryId: Record<string, string> = {
  alaska: "player-1",
  alberta: "player-1",
  kamchatka: "player-2",
  ontario: "neutral"
};

describe("territory visual state", () => {
  it("computes attack-selectable enemy neighbors from selected territory", () => {
    const selectable = computeSelectableTerritoryIds(
      territories,
      ownerByTerritoryId,
      "player-1",
      "attack",
      "alaska"
    );

    expect([...selectable]).toEqual(["kamchatka"]);
  });

  it("includes expected class markers for selected hovered combat states", () => {
    const classes = classListForTerritory({
      territoryId: "kamchatka",
      selectedTerritoryId: "kamchatka",
      hoveredTerritoryId: "kamchatka",
      currentPlayerId: "player-1",
      ownerByTerritoryId,
      selectableTerritoryIds: new Set(["kamchatka"]),
      underAttackTerritoryId: "kamchatka",
      capturedTerritoryId: "kamchatka"
    });

    expect(classes).toContain("territory-node");
    expect(classes).toContain("is-owned");
    expect(classes).toContain("is-selected");
    expect(classes).toContain("is-hovered");
    expect(classes).toContain("is-selectable");
    expect(classes).toContain("is-under-attack");
    expect(classes).toContain("is-captured");
  });
});
