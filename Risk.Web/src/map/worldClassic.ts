import mapDefinition from "@packs/maps/world-classic/map.json";
import italianLabels from "@packs/maps/world-classic/i18n/it.json";
import worldClassicSvgRaw from "@packs/maps/world-classic/Risk_board.svg?raw";

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

const svgIdAliases: Record<string, string> = {
  yakursk: "yakutsk"
};

function normalizeTerritoryId(id: string): string {
  return svgIdAliases[id] ?? id;
}

const worldClassicSvg = worldClassicSvgRaw.replace(/id="yakursk"/g, 'id="yakutsk"');

export const worldClassic = {
  map: pack,
  labels,
  svg: worldClassicSvg
};

export function territoryIdsFromSvg(svg: string): string[] {
  const mapIds = new Set(worldClassic.map.territories.map(territory => territory.id));
  const matches = [...svg.matchAll(/\sid="([^"]+)"/g)];
  const result = new Set<string>();

  for (const match of matches) {
    const rawId = match[1];
    const normalizedId = normalizeTerritoryId(rawId);
    if (mapIds.has(normalizedId)) {
      result.add(normalizedId);
    }
  }

  return [...result];
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
      errors.push(`ID territorio SVG mancante: ${mapId}`);
    }

    if (!labels[`territories.${mapId}`]) {
      errors.push(`Etichetta italiana mancante per territorio: ${mapId}`);
    }
  }

  for (const svgId of svgIds) {
    if (!mapIds.includes(svgId)) {
      errors.push(`ID territorio SVG sconosciuto non presente in map.json: ${svgId}`);
    }
  }

  return errors;
}
