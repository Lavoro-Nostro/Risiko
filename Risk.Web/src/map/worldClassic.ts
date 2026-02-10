import mapDefinition from "@packs/maps/world-classic/map.json";
import italianLabels from "@packs/maps/world-classic/i18n/it.json";
import worldClassicSvg from "@packs/maps/world-classic/map.svg?raw";

export type TerritoryDefinition = {
  id: string;
  continent: string;
  neighbors: string[];
};

export type ContinentDefinition = {
  id: string;
  bonus: number;
  territories: string[];
};

export type MapDefinition = {
  id: string;
  name: string;
  territories: TerritoryDefinition[];
  continents: ContinentDefinition[];
};

const pack = mapDefinition as MapDefinition;
const labels = italianLabels as Record<string, string>;

export const worldClassic = {
  map: pack,
  labels,
  svg: worldClassicSvg
};

export function territoryIdsFromSvg(svg: string): string[] {
  const matches = [...svg.matchAll(/<g\s+id="([^"]+)"\s+class="territory">/g)];
  return matches.map(match => match[1]);
}

export function labelForTerritory(territoryId: string): string {
  return labels[`territories.${territoryId}`] ?? territoryId;
}

export function validateWorldClassicBinding(): string[] {
  const errors: string[] = [];
  const svgIds = new Set(territoryIdsFromSvg(worldClassic.svg));
  const mapIds = worldClassic.map.territories.map(territory => territory.id);

  for (const mapId of mapIds) {
    if (!svgIds.has(mapId)) {
      errors.push(`Missing SVG territory id: ${mapId}`);
    }

    if (!labels[`territories.${mapId}`]) {
      errors.push(`Missing Italian label for territory: ${mapId}`);
    }
  }

  for (const svgId of svgIds) {
    if (!mapIds.includes(svgId)) {
      errors.push(`Unknown SVG territory id not present in map.json: ${svgId}`);
    }
  }

  return errors;
}
