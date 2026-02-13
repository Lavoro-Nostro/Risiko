import mapDefinition from "@packs/maps/world-classic/map.json";
import italianLabels from "@packs/maps/world-classic/i18n/it.json";

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
  labels
};

export function labelForTerritory(territoryId: string): string {
  return labels[`territories.${territoryId}`] ?? territoryId;
}

export function validateWorldClassicBinding(): string[] {
  const errors: string[] = [];
  const mapIds = worldClassic.map.territories.map(territory => territory.id);
  for (const mapId of mapIds) {
    if (!labels[`territories.${mapId}`]) {
      errors.push(`Etichetta italiana mancante per territorio: ${mapId}`);
    }
  }
  return errors;
}
