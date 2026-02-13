import { describe, expect, it } from "vitest";
import {
  validateWorldClassicBinding,
  worldClassic
} from "./worldClassic";

describe("world-classic pack binding", () => {
  it("has all territory IDs bound in map.json", () => {
    const mapIds = worldClassic.map.territories.map(territory => territory.id);
    expect(mapIds.length).toBe(42);
    expect(new Set(mapIds).size).toBe(42);
  });

  it("has no binding errors across map/i18n", () => {
    expect(validateWorldClassicBinding()).toEqual([]);
  });
});
