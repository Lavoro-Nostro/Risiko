import { describe, expect, it } from "vitest";
import {
  territoryIdsFromSvg,
  validateWorldClassicBinding,
  worldClassic
} from "./worldClassic";

describe("world-classic pack binding", () => {
  it("maps all map.json territory IDs to SVG territory groups", () => {
    const svgIds = territoryIdsFromSvg(worldClassic.svg);
    const mapIds = worldClassic.map.territories.map(territory => territory.id);

    expect(svgIds.length).toBe(mapIds.length);
    expect(new Set(svgIds)).toEqual(new Set(mapIds));
  });

  it("has no binding errors across svg/map/i18n", () => {
    expect(validateWorldClassicBinding()).toEqual([]);
  });
});
