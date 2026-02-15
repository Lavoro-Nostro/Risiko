import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { labelForTerritory, worldClassic } from "./map/worldClassic";
import mapVectorSvgRaw from "@packs/maps/world-classic/map.svg?raw";
import objectiveCardTemplateRaw from "@packs/maps/world-classic/cards/objective/objective_card_blank.svg?raw";
import jokerCardRaw from "@packs/maps/world-classic/cards/joker/joker_card.svg?raw";
import objectiveCardBackRaw from "@packs/assets/card-backs/objective_card_back.svg?raw";
import territoryCardBackRaw from "@packs/assets/card-backs/territory_card_back.svg?raw";
import playerCardRed from "@packs/maps/world-classic/cards/player/player_card_red.svg";
import playerCardPurple from "@packs/maps/world-classic/cards/player/player_card_purple.svg";
import playerCardYellow from "@packs/maps/world-classic/cards/player/player_card_yellow.svg";
import playerCardGreen from "@packs/maps/world-classic/cards/player/player_card_green.svg";
import playerCardBlue from "@packs/maps/world-classic/cards/player/player_card_blue.svg";
import playerCardBlack from "@packs/maps/world-classic/cards/player/player_card_black.svg";
import tankRed from "@packs/CarrarRo.png";
import tankPurple from "@packs/CarrarVi.png";
import tankYellow from "@packs/CarrarGi.png";
import tankGreen from "@packs/CarrarVe.png";
import tankBlue from "@packs/CarrarBl.png";
import tankBlack from "@packs/CarrarNe.png";

type Screen = "splash" | "portal" | "hostLobby" | "joinLobby" | "game";

type TerritoryOverlay = {
  id: string;
  text: string;
  textLines: string[];
  centerX: number;
  centerY: number;
  chipY: number;
  chipRadius: number;
  labelX: number;
  labelY: number;
  labelFontSize: number;
  labelWidth: number;
  labelHeight: number;
  labelRotation: number;
  labelCurvePath?: string;
  labelCurveText?: string;
  labelFontScale: number;
};

type OverlayTuning = {
  labelDx?: number;
  labelDy?: number;
  chipDx?: number;
  chipDy?: number;
  fontScale?: number;
};

type LabelCurveTuning = {
  span?: number;
  arch?: number;
  offsetY?: number;
};

type LabelStyleTuning = {
  rotation?: number;
  fontScale?: number;
  curve?: LabelCurveTuning;
};

type TerritoryMask = {
  minX: number;
  minY: number;
  width: number;
  height: number;
  alpha: Uint8Array;
  borderPoints: Uint32Array;
  outlineLoops: Array<Array<{ x: number; y: number }>>;
  centerX: number;
  centerY: number;
  area: number;
};

type VectorTerritoryMap = {
  width: number;
  height: number;
  pathsById: Record<string, string[]>;
};

type OwnershipGrid = {
  width: number;
  height: number;
  ownerByPixel: Int16Array;
  territoryIds: string[];
};

const MAP_ALPHA_SOLID_THRESHOLD = 28;
const MAP_OWNER_ASSIGNMENT_THRESHOLD = 64;
const MAP_BORDER_BASE_WIDTH = 3.25;
const MAP_BORDER_MID_WIDTH = 2.05;
const MAP_BORDER_TOP_WIDTH = 1.15;

type SeaConnectionSpec = {
  a: string;
  b: string;
  wrapAcrossMap?: boolean;
  bendSign?: 1 | -1;
  bendFactor?: number;
};

const OFFICIAL_SEA_CONNECTIONS: SeaConnectionSpec[] = [
  { a: "alaska", b: "kamchatka", wrapAcrossMap: true },
  { a: "greenland", b: "iceland", bendSign: 1, bendFactor: 0.12 },
  { a: "iceland", b: "scandinavia", bendSign: -1, bendFactor: 0.14 },
  { a: "iceland", b: "great_britain", bendSign: 1, bendFactor: 0.12 },
  { a: "great_britain", b: "scandinavia", bendSign: 1, bendFactor: 0.1 },
  { a: "great_britain", b: "western_europe", bendSign: -1, bendFactor: 0.1 },
  { a: "brazil", b: "north_africa", bendSign: -1, bendFactor: 0.08 },
  { a: "western_europe", b: "north_africa", bendSign: 1, bendFactor: 0.1 },
  { a: "southern_europe", b: "north_africa", bendSign: -1, bendFactor: 0.11 },
  { a: "southern_europe", b: "egypt", bendSign: 1, bendFactor: 0.09 },
  { a: "east_africa", b: "madagascar", bendSign: -1, bendFactor: 0.12 },
  { a: "kamchatka", b: "japan", bendSign: -1, bendFactor: 0.12 },
  { a: "japan", b: "mongolia", bendSign: 1, bendFactor: 0.1 },
  { a: "siam", b: "indonesia", bendSign: -1, bendFactor: 0.12 },
  { a: "indonesia", b: "new_guinea", bendSign: 1, bendFactor: 0.12 },
  { a: "indonesia", b: "western_australia", bendSign: -1, bendFactor: 0.13 },
  { a: "new_guinea", b: "western_australia", bendSign: 1, bendFactor: 0.11 },
  { a: "new_guinea", b: "eastern_australia", bendSign: -1, bendFactor: 0.11 }
];

function simplifyClosedLoop(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length < 4) {
    return points;
  }
  const simplified: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const collinearX = prev.x === curr.x && curr.x === next.x;
    const collinearY = prev.y === curr.y && curr.y === next.y;
    if (collinearX || collinearY) {
      continue;
    }
    simplified.push(curr);
  }
  return simplified.length >= 3 ? simplified : points;
}

function smoothClosedLoop(points: Array<{ x: number; y: number }>, passes: number): Array<{ x: number; y: number }> {
  let current = points;
  for (let pass = 0; pass < passes; pass += 1) {
    if (current.length < 3) {
      break;
    }
    const next: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < current.length; i += 1) {
      const p0 = current[i];
      const p1 = current[(i + 1) % current.length];
      next.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 });
      next.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 });
    }
    current = next;
  }
  return current;
}

function buildOutlineLoopsFromAlpha(
  alpha: Uint8Array,
  width: number,
  height: number,
  minX: number,
  minY: number,
  threshold = 10
): Array<Array<{ x: number; y: number }>> {
  type Edge = { a: number; b: number };
  const vertices: Array<{ x: number; y: number }> = [];
  const vertexIndexByKey = new Map<string, number>();
  const edges: Edge[] = [];
  const adjacency = new Map<number, number[]>();

  const getVertexIndex = (x: number, y: number) => {
    const key = `${x},${y}`;
    const existing = vertexIndexByKey.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const idx = vertices.length;
    vertices.push({ x, y });
    vertexIndexByKey.set(key, idx);
    return idx;
  };

  const addEdge = (ax: number, ay: number, bx: number, by: number) => {
    const a = getVertexIndex(ax, ay);
    const b = getVertexIndex(bx, by);
    const edgeIndex = edges.length;
    edges.push({ a, b });
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a)!.push(edgeIndex);
    adjacency.get(b)!.push(edgeIndex);
  };

  const alphaAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return 0;
    }
    return alpha[y * width + x];
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) <= threshold) {
        continue;
      }
      if (alphaAt(x - 1, y) <= threshold) addEdge(x, y, x, y + 1);
      if (alphaAt(x + 1, y) <= threshold) addEdge(x + 1, y, x + 1, y + 1);
      if (alphaAt(x, y - 1) <= threshold) addEdge(x, y, x + 1, y);
      if (alphaAt(x, y + 1) <= threshold) addEdge(x, y + 1, x + 1, y + 1);
    }
  }

  const used = new Uint8Array(edges.length);
  const loops: Array<Array<{ x: number; y: number }>> = [];

  for (let startEdge = 0; startEdge < edges.length; startEdge += 1) {
    if (used[startEdge]) {
      continue;
    }
    used[startEdge] = 1;
    const first = edges[startEdge];
    const chain: number[] = [first.a, first.b];
    let prev = first.a;
    let current = first.b;
    const start = first.a;
    const maxSteps = Math.max(32, edges.length * 2);

    for (let step = 0; step < maxSteps; step += 1) {
      const edgeList = adjacency.get(current) ?? [];
      let nextEdgeIndex = -1;
      let nextVertex = -1;
      for (const edgeIndex of edgeList) {
        if (used[edgeIndex]) {
          continue;
        }
        const edge = edges[edgeIndex];
        const candidate = edge.a === current ? edge.b : edge.a;
        if (candidate === prev && edgeList.length > 1) {
          continue;
        }
        nextEdgeIndex = edgeIndex;
        nextVertex = candidate;
        break;
      }
      if (nextEdgeIndex < 0 || nextVertex < 0) {
        break;
      }
      used[nextEdgeIndex] = 1;
      chain.push(nextVertex);
      prev = current;
      current = nextVertex;
      if (current === start) {
        break;
      }
    }

    if (chain.length < 4 || chain[chain.length - 1] !== start) {
      continue;
    }

    const rawLoop = chain
      .slice(0, -1)
      .map(vertexIndex => {
        const point = vertices[vertexIndex];
        return { x: minX + point.x, y: minY + point.y };
      });
    if (rawLoop.length < 3) {
      continue;
    }
    const simplified = simplifyClosedLoop(rawLoop);
    const smoothed = smoothClosedLoop(simplified, 1);
    loops.push(smoothed);
  }

  return loops;
}

function masksShareBoundary(a: TerritoryMask, b: TerritoryMask, threshold = 10): boolean {
  const aMinX = a.minX;
  const aMinY = a.minY;
  const aMaxX = a.minX + a.width - 1;
  const aMaxY = a.minY + a.height - 1;
  const bMinX = b.minX;
  const bMinY = b.minY;
  const bMaxX = b.minX + b.width - 1;
  const bMaxY = b.minY + b.height - 1;

  if (aMaxX < bMinX - 1 || bMaxX < aMinX - 1 || aMaxY < bMinY - 1 || bMaxY < aMinY - 1) {
    return false;
  }

  const overlapMinX = Math.max(aMinX, bMinX) - 1;
  const overlapMinY = Math.max(aMinY, bMinY) - 1;
  const overlapMaxX = Math.min(aMaxX, bMaxX) + 1;
  const overlapMaxY = Math.min(aMaxY, bMaxY) + 1;

  const alphaAt = (mask: TerritoryMask, x: number, y: number) => {
    if (x < mask.minX || y < mask.minY || x >= mask.minX + mask.width || y >= mask.minY + mask.height) {
      return 0;
    }
    return mask.alpha[(y - mask.minY) * mask.width + (x - mask.minX)];
  };

  for (let y = overlapMinY; y <= overlapMaxY; y += 1) {
    for (let x = overlapMinX; x <= overlapMaxX; x += 1) {
      if (alphaAt(a, x, y) <= threshold) {
        continue;
      }
      if (
        alphaAt(b, x - 1, y) > threshold ||
        alphaAt(b, x + 1, y) > threshold ||
        alphaAt(b, x, y - 1) > threshold ||
        alphaAt(b, x, y + 1) > threshold
      ) {
        return true;
      }
    }
  }

  return false;
}

function findMaskEdgeAnchor(mask: TerritoryMask, towardX: number, towardY: number): { x: number; y: number } {
  const fromX = mask.centerX;
  const fromY = mask.centerY;
  const dirX = towardX - fromX;
  const dirY = towardY - fromY;
  const dirLen = Math.hypot(dirX, dirY);
  if (!Number.isFinite(dirLen) || dirLen < 0.001 || mask.borderPoints.length === 0) {
    return { x: fromX, y: fromY };
  }
  const unitX = dirX / dirLen;
  const unitY = dirY / dirLen;
  let bestX = fromX;
  let bestY = fromY;
  let bestProjection = -Infinity;
  let bestLateral = Infinity;

  for (let i = 0; i < mask.borderPoints.length; i += 1) {
    const packed = mask.borderPoints[i];
    const localX = packed & 0xffff;
    const localY = (packed >>> 16) & 0xffff;
    const x = mask.minX + localX;
    const y = mask.minY + localY;
    const vx = x - fromX;
    const vy = y - fromY;
    const projection = vx * unitX + vy * unitY;
    if (projection < bestProjection - 0.01) {
      continue;
    }
    const lateral = Math.abs(vx * unitY - vy * unitX);
    if (projection > bestProjection + 0.01 || lateral < bestLateral) {
      bestProjection = projection;
      bestLateral = lateral;
      bestX = x;
      bestY = y;
    }
  }

  return { x: bestX, y: bestY };
}

function buildOutlineLoopsFromOwnershipGrid(
  ownerByPixel: Int16Array,
  width: number,
  height: number
): Array<Array<{ x: number; y: number }>> {
  type Edge = { a: number; b: number };
  const vertices: Array<{ x: number; y: number }> = [];
  const vertexIndexByKey = new Map<string, number>();
  const edges: Edge[] = [];
  const adjacency = new Map<number, number[]>();

  const getVertexIndex = (x: number, y: number) => {
    const key = `${x},${y}`;
    const existing = vertexIndexByKey.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const idx = vertices.length;
    vertices.push({ x, y });
    vertexIndexByKey.set(key, idx);
    return idx;
  };

  const addEdge = (ax: number, ay: number, bx: number, by: number) => {
    const a = getVertexIndex(ax, ay);
    const b = getVertexIndex(bx, by);
    const edgeIndex = edges.length;
    edges.push({ a, b });
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a)!.push(edgeIndex);
    adjacency.get(b)!.push(edgeIndex);
  };

  const ownerAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return -1;
    }
    return ownerByPixel[y * width + x];
  };

  for (let x = 0; x <= width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const left = ownerAt(x - 1, y);
      const right = ownerAt(x, y);
      if (left !== right && (left >= 0 || right >= 0)) {
        addEdge(x, y, x, y + 1);
      }
    }
  }

  for (let y = 0; y <= height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const up = ownerAt(x, y - 1);
      const down = ownerAt(x, y);
      if (up !== down && (up >= 0 || down >= 0)) {
        addEdge(x, y, x + 1, y);
      }
    }
  }

  const used = new Uint8Array(edges.length);
  const loops: Array<Array<{ x: number; y: number }>> = [];

  for (let startEdge = 0; startEdge < edges.length; startEdge += 1) {
    if (used[startEdge]) {
      continue;
    }
    used[startEdge] = 1;
    const first = edges[startEdge];
    const chain: number[] = [first.a, first.b];
    let prev = first.a;
    let current = first.b;
    const start = first.a;
    const maxSteps = Math.max(32, edges.length * 2);

    for (let step = 0; step < maxSteps; step += 1) {
      const edgeList = adjacency.get(current) ?? [];
      let nextEdgeIndex = -1;
      let nextVertex = -1;
      for (const edgeIndex of edgeList) {
        if (used[edgeIndex]) {
          continue;
        }
        const edge = edges[edgeIndex];
        const candidate = edge.a === current ? edge.b : edge.a;
        if (candidate === prev && edgeList.length > 1) {
          continue;
        }
        nextEdgeIndex = edgeIndex;
        nextVertex = candidate;
        break;
      }
      if (nextEdgeIndex < 0 || nextVertex < 0) {
        break;
      }
      used[nextEdgeIndex] = 1;
      chain.push(nextVertex);
      prev = current;
      current = nextVertex;
      if (current === start) {
        break;
      }
    }

    if (chain.length < 4 || chain[chain.length - 1] !== start) {
      continue;
    }

    const rawLoop = chain
      .slice(0, -1)
      .map(vertexIndex => vertices[vertexIndex]);
    if (rawLoop.length < 3) {
      continue;
    }
    const simplified = simplifyClosedLoop(rawLoop);
    const smoothed = smoothClosedLoop(simplified, 2);
    loops.push(smoothed);
  }

  return loops;
}

function buildSharedBorderOverlayDataUrl(
  ownerByPixel: Int16Array,
  width: number,
  height: number,
  renderScale: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width * renderScale;
  canvas.height = height * renderScale;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }

  const ownerAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return -1;
    }
    return ownerByPixel[y * width + x];
  };

  const traceSharedEdges = () => {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 1) {
      for (let y = 0; y < height; y += 1) {
        const left = ownerAt(x - 1, y);
        const right = ownerAt(x, y);
        if (left !== right && (left >= 0 || right >= 0)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 1);
        }
      }
    }
    for (let y = 0; y <= height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const up = ownerAt(x, y - 1);
        const down = ownerAt(x, y);
        if (up !== down && (up >= 0 || down >= 0)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + 1, y);
        }
      }
    }
  };

  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  traceSharedEdges();
  ctx.strokeStyle = "rgba(16, 12, 9, 0.86)";
  ctx.lineWidth = MAP_BORDER_BASE_WIDTH;
  ctx.shadowBlur = 2.2;
  ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
  ctx.stroke();

  traceSharedEdges();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(221, 206, 178, 0.98)";
  ctx.lineWidth = MAP_BORDER_MID_WIDTH;
  ctx.stroke();

  traceSharedEdges();
  ctx.strokeStyle = "rgba(255, 250, 238, 1)";
  ctx.lineWidth = MAP_BORDER_TOP_WIDTH;
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

function parseVectorTerritoryMap(svgRaw: string): VectorTerritoryMap | null {
  const viewBoxMatch = svgRaw.match(/viewBox="([^"]+)"/i);
  if (!viewBoxMatch) {
    return null;
  }
  const viewBoxParts = viewBoxMatch[1].trim().split(/\s+/).map(value => Number(value));
  if (viewBoxParts.length !== 4 || !Number.isFinite(viewBoxParts[2]) || !Number.isFinite(viewBoxParts[3])) {
    return null;
  }
  const width = viewBoxParts[2];
  const height = viewBoxParts[3];
  const pathsById: Record<string, string[]> = {};
  const groupRegex = /<g\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/g>/gi;
  let groupMatch: RegExpExecArray | null = groupRegex.exec(svgRaw);
  while (groupMatch) {
    const territoryId = groupMatch[1];
    const groupBody = groupMatch[2];
    const pathRegex = /<path\b[^>]*\sd="([^"]+)"[^>]*>/gi;
    const paths: string[] = [];
    let pathMatch: RegExpExecArray | null = pathRegex.exec(groupBody);
    while (pathMatch) {
      const d = pathMatch[1].trim();
      if (d) {
        paths.push(d);
      }
      pathMatch = pathRegex.exec(groupBody);
    }
    if (paths.length) {
      pathsById[territoryId] = paths;
    }
    groupMatch = groupRegex.exec(svgRaw);
  }
  if (!Object.keys(pathsById).length) {
    return null;
  }
  return { width, height, pathsById };
}

const TERRITORY_OVERLAY_TUNING: Record<string, OverlayTuning> = {
  north_west_territory: { labelDx: -4, labelDy: -5, fontScale: 0.9 },
  ontario: { labelDx: 5, labelDy: 2, fontScale: 0.86 },
  quebec: { labelDx: 8, labelDy: -2, fontScale: 0.88 },
  western_united_states: { labelDx: -7, labelDy: 3, fontScale: 0.85 },
  eastern_united_states: { labelDx: 8, labelDy: 3, fontScale: 0.85 },
  central_america: { labelDy: 6, fontScale: 0.86 },
  venezuela: { labelDx: -6, labelDy: -2, fontScale: 0.9 },
  peru: { labelDx: -8, labelDy: 3, fontScale: 0.88 },
  brazil: { labelDx: 8, labelDy: 3, fontScale: 0.88 },
  argentina: { labelDy: 8, fontScale: 0.9 },
  iceland: { labelDx: -8, labelDy: -4, fontScale: 0.82, chipDy: -3 },
  great_britain: { labelDx: -12, labelDy: 8, fontScale: 0.82 },
  northern_europe: { labelDx: 10, labelDy: 5, fontScale: 0.82 },
  western_europe: { labelDx: -14, labelDy: 10, fontScale: 0.8 },
  southern_europe: { labelDx: 0, labelDy: 12, fontScale: 0.8 },
  north_africa: { labelDx: -8, labelDy: 4, fontScale: 0.86 },
  east_africa: { labelDx: 10, labelDy: 4, fontScale: 0.86 },
  congo: { labelDx: -8, labelDy: -2, fontScale: 0.86 },
  south_africa: { labelDy: 8, fontScale: 0.86 },
  madagascar: { labelDx: 7, labelDy: 8, fontScale: 0.8, chipDx: 2, chipDy: -2 },
  middle_east: { labelDy: 8, fontScale: 0.86 },
  afghanistan: { labelDx: 8, labelDy: 2, fontScale: 0.84 },
  india: { labelDy: 10, fontScale: 0.86 },
  siam: { labelDx: 8, labelDy: 7, fontScale: 0.82, chipDy: -2 },
  indonesia: { labelDx: 8, labelDy: 10, fontScale: 0.8, chipDy: -2 },
  new_guinea: { labelDx: 10, labelDy: 2, fontScale: 0.78, chipDx: 2, chipDy: -2 },
  japan: { labelDx: 10, labelDy: -2, fontScale: 0.8, chipDx: 2, chipDy: -2 },
  kamchatka: { labelDx: 10, labelDy: -3, fontScale: 0.82, chipDx: 3, chipDy: -2 },
  western_australia: { labelDx: -12, labelDy: 8, fontScale: 0.8 },
  eastern_australia: { labelDx: 12, labelDy: 8, fontScale: 0.8 }
};

const TERRITORY_LABEL_STYLE: Record<string, LabelStyleTuning> = {
  alaska: { rotation: -6 },
  north_west_territory: { rotation: -2 },
  western_united_states: { rotation: -9 },
  eastern_united_states: { rotation: -13 },
  central_america: { rotation: -24, fontScale: 0.94 },
  greenland: { rotation: -8 },
  iceland: { rotation: -18, fontScale: 0.93 },
  great_britain: { rotation: -17, fontScale: 0.95 },
  scandinavia: { rotation: -6 },
  ukraine: { rotation: -8 },
  southern_europe: { rotation: 10, fontScale: 0.94 },
  western_europe: { rotation: 5 },
  north_africa: { rotation: -7, curve: { span: 1.1, arch: 0.18, offsetY: -0.5 } },
  egypt: { rotation: -5, fontScale: 0.95 },
  east_africa: { rotation: 16, fontScale: 0.94 },
  congo: { rotation: 10, fontScale: 0.95 },
  south_africa: { rotation: 2 },
  middle_east: { rotation: 3, curve: { span: 1.06, arch: 0.14 } },
  afghanistan: { rotation: -8, fontScale: 0.95 },
  india: { rotation: 14 },
  china: { rotation: -4 },
  siam: { rotation: 22, fontScale: 0.93 },
  siberia: { rotation: -2, curve: { span: 1.14, arch: 0.12 } },
  yakutsk: { rotation: -11 },
  kamchatka: { rotation: -14, curve: { span: 1.2, arch: 0.2, offsetY: -0.3 } },
  irkutsk: { rotation: -4 },
  mongolia: { rotation: 2 },
  japan: { rotation: -22, fontScale: 0.92 },
  indonesia: { rotation: 15, fontScale: 0.93 },
  new_guinea: { rotation: -10, fontScale: 0.92 },
  western_australia: { rotation: 8 },
  eastern_australia: { rotation: -8 }
};

type HostTerritoryState = {
  territoryId: string;
  ownerPlayerId: string;
  armies: number;
  neighborTerritoryIds: string[];
};

type HostPlayerState = {
  playerId: string;
  displayName: string;
  isEliminated: boolean;
};

type HostObjectiveState = {
  playerId: string;
  objectiveId: string;
  title: string;
  description: string;
  kind: string;
  targetTerritoryCount: number;
  requiredArmiesPerTerritory?: number;
  requiredContinentIds?: string[];
  requiredAdditionalContinentCount?: number;
  eliminateTargetPlayerId?: string | null;
};

type HostGameState = {
  matchId: string;
  players: HostPlayerState[];
  continents?: { id: string; bonus: number; territoryIds: string[] }[];
  phase: string | number;
  turnIndex: number;
  roundIndex: number;
  activePlayerId: string;
  reinforcementsAvailable: number;
  territories: Record<string, HostTerritoryState>;
  objectivesByPlayerId?: Record<string, HostObjectiveState>;
  cardIdsByPlayerId?: Record<string, string[]>;
  cardSymbolById?: Record<string, string>;
  tradeBonusStep?: number;
  winnerPlayerId?: string | null;
  fortifyUsedThisTurn?: boolean;
  pendingCaptureFromTerritoryId?: string | null;
  pendingCaptureToTerritoryId?: string | null;
  pendingCaptureMinArmies?: number;
  pendingCaptureMaxArmies?: number;
};

type MatchStateResponse = {
  matchId: string;
  roomId: string;
  state: HostGameState;
};

type RoomParticipant = {
  peerId: string;
  displayName: string;
  joinedAtUtc: string;
};

type RoomLobbySummary = {
  roomId: string;
  roomName: string;
  hostPeerId: string;
  mapId: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
};

type RoomSnapshotResponse = {
  roomId: string;
  roomName: string;
  hostPeerId: string;
  mapId: string;
  status: string;
  activeMatchId?: string | null;
  participants: RoomParticipant[];
};

type CreateRoomResponse = {
  roomId: string;
  roomName: string;
  hostPeerId: string;
  mapId: string;
  status: string;
  participants: RoomParticipant[];
};

type JoinRoomResponse = {
  roomId: string;
  roomName: string;
  mapId: string;
  hostPeerId: string;
  status: string;
  activeMatchId?: string | null;
  participants: RoomParticipant[];
};

type StartMatchResponse = {
  roomId: string;
  roomName: string;
  matchId: string;
  mapId: string;
  hostPeerId: string;
  status: string;
  participants: RoomParticipant[];
};

type SubmitCommandResponse = {
  accepted: boolean;
  errorCode: number;
  message: string;
  appliedEventCount: number;
  attackResolution?: AttackResolutionPayload | null;
};

type HostEventMessage = {
  sequence: number;
  roomId: string;
  hostPeerId: string;
  type: string;
  payload: string;
  createdAtUtc: string;
};

type ChatEventPayload = {
  authorPeerId: string;
  authorDisplayName: string;
  text: string;
  sentAtUtc: string;
};

type AttackResolutionPayload = {
  attackerPlayerId: string;
  defenderPlayerId: string;
  fromTerritoryId: string;
  toTerritoryId: string;
  attackerRolls: number[];
  defenderRolls: number[];
  attackerLosses: number;
  defenderLosses: number;
};

const PREF_KEY = "RisiKo!.ui.v4";
const PLAYER_COLORS = ["#e43c39", "#7d49dc", "#e6c42b", "#2ecb4f", "#2a6ae0", "#141414"];
const PLAYER_CARD_ASSETS = [playerCardRed, playerCardPurple, playerCardYellow, playerCardGreen, playerCardBlue, playerCardBlack];
const PLAYER_TANK_ASSETS = [tankRed, tankPurple, tankYellow, tankGreen, tankBlue, tankBlack];
const MAX_MAP_DISPLAY_WIDTH = 1480;
const OBJECTIVE_CARD_BASE = objectiveCardTemplateRaw
  .replace("Titolo Missione", "")
  .replace("Testo missione qui", "");
const territoryCardPngBaseModules = import.meta.glob("@packs/territories-png/*.png", {
  eager: true,
  import: "default"
}) as Record<string, string>;
const territoryCardPngUpscaledModules = import.meta.glob("@packs/territories-png-upscaled/*.png", {
  eager: true,
  import: "default"
}) as Record<string, string>;

const territoryCardTemplateModules = import.meta.glob("@packs/maps/world-classic/cards/territory/*.svg", {
  eager: true,
  import: "default"
}) as Record<string, string>;

const territoryCardPngBaseById = Object.entries(territoryCardPngBaseModules).reduce<Record<string, string>>((map, [path, pngUrl]) => {
  const fileName = path.split("/").pop()?.replace(".png", "");
  if (!fileName) {
    return map;
  }
  const territoryId = fileName.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (territoryId === "world_map") {
    return map;
  }
  map[territoryId] = pngUrl;
  return map;
}, {});
const territoryCardPngUpscaledById = Object.entries(territoryCardPngUpscaledModules).reduce<Record<string, string>>((map, [path, pngUrl]) => {
  const fileName = path.split("/").pop()?.replace(".png", "");
  if (!fileName) {
    return map;
  }
  const territoryId = fileName.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (territoryId === "world_map") {
    return map;
  }
  map[territoryId] = pngUrl;
  return map;
}, {});
const territoryCardPngById = { ...territoryCardPngBaseById, ...territoryCardPngUpscaledById };
const territoryMapPngById = { ...territoryCardPngBaseById, ...territoryCardPngUpscaledById };
const worldMapPngUrl =
  Object.entries(territoryCardPngUpscaledModules).find(([path]) => path.endsWith("/world map.png"))?.[1]
  ?? Object.entries(territoryCardPngBaseModules).find(([path]) => path.endsWith("/world map.png"))?.[1]
  ?? "";

const territoryCardTemplateById = Object.entries(territoryCardTemplateModules).reduce<Record<string, string>>((map, [path, svgUrl]) => {
  const fileName = path.split("/").pop()?.replace(".svg", "");
  if (!fileName) {
    return map;
  }
  const territoryId = fileName.trim().toLowerCase().replace(/[\s-]+/g, "_");
  map[territoryId] = svgUrl;
  return map;
}, {});

function commandErrorLabel(errorCode: number): string {
  switch (errorCode) {
    case 0:
      return "nessuno";
    case 1:
      return "fase_non_valida";
    case 2:
      return "giocatore_non_attivo";
    case 3:
      return "proprieta_non_valida";
    case 4:
      return "non_adiacente";
    case 5:
      return "numero_armate_non_valido";
    case 6:
      return "percorso_non_valido";
    case 7:
      return "partita_terminata";
    case 8:
      return "carte_non_valide";
    default:
      return "sconosciuto";
  }
}

function parsePhase(phase: unknown): string {
  const value = String(phase ?? "").toLowerCase();
  if (value === "0") {
    return "setup";
  }
  if (value === "1") {
    return "reinforcement";
  }
  if (value === "2") {
    return "attack";
  }
  if (value === "3") {
    return "fortify";
  }
  return value || "reinforcement";
}

function prettyCardName(cardId: string): string {
  if (cardId.startsWith("territory:")) {
    return cardId.replace("territory:", "").split("_").join(" ");
  }
  if (cardId.startsWith("joker")) {
    return "Joker";
  }
  return cardId;
}

function cardSymbolLabel(symbol: string): string {
  switch (symbol.toLowerCase()) {
    case "infantry":
      return "Fante";
    case "cavalry":
      return "Cavalleria";
    case "artillery":
      return "Artiglieria";
    case "joker":
      return "Jolly";
    default:
      return symbol;
  }
}

function evaluateTrisSelection(symbols: string[]): { valid: boolean; baseBonus: number; reason: string } {
  if (symbols.length !== 3) {
    return { valid: false, baseBonus: 0, reason: "Seleziona 3 carte." };
  }
  const normalized = symbols.map(value => value.toLowerCase());
  const jokerCount = normalized.filter(value => value === "joker").length;
  if (jokerCount > 1) {
    return { valid: false, baseBonus: 0, reason: "Massimo 1 jolly nel tris." };
  }
  const nonJoker = normalized.filter(value => value !== "joker");
  if (nonJoker.length === 3) {
    const distinct = new Set(nonJoker);
    if (distinct.size === 1) {
      const symbol = nonJoker[0];
      if (symbol === "artillery") {
        return { valid: true, baseBonus: 4, reason: "Tris artiglieria" };
      }
      if (symbol === "infantry") {
        return { valid: true, baseBonus: 6, reason: "Tris fanteria" };
      }
      if (symbol === "cavalry") {
        return { valid: true, baseBonus: 8, reason: "Tris cavalleria" };
      }
      return { valid: false, baseBonus: 0, reason: "Simboli non validi." };
    }
    if (distinct.size === 3) {
      return { valid: true, baseBonus: 10, reason: "Tris misto" };
    }
    return { valid: false, baseBonus: 0, reason: "Combinazione non valida." };
  }

  if (jokerCount === 1 && nonJoker.length === 2 && nonJoker[0] === nonJoker[1]) {
    return { valid: true, baseBonus: 12, reason: "Jolly + coppia uguale" };
  }

  return { valid: false, baseBonus: 0, reason: "Combinazione non valida." };
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case "setup":
      return "setup";
    case "reinforcement":
      return "rinforzo";
    case "attack":
      return "attacco";
    case "fortify":
      return "fortifica";
    default:
      return phase;
  }
}

function commandLabel(type: string): string {
  switch (type) {
    case "PlaceReinforcements":
      return "piazzamento rinforzi";
    case "Attack":
      return "attacco";
    case "Fortify":
      return "fortificazione";
    case "PlayCards":
      return "cambio tris";
    case "MoveCapturedArmies":
      return "spostamento post conquista";
    case "EndTurn":
      return "fine turno";
    default:
      return type;
  }
}

function continentLabel(continentId: string): string {
  switch (continentId) {
    case "north_america":
      return "Nord America";
    case "south_america":
      return "Sud America";
    case "europe":
      return "Europa";
    case "africa":
      return "Africa";
    case "asia":
      return "Asia";
    case "australia":
      return "Oceania";
    default:
      return continentId;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampInRange(value: number, min: number, max: number): number {
  if (min > max) {
    return (min + max) / 2;
  }
  return clamp(value, min, max);
}

function normalizeLoopedOffsetX(x: number, _mapWorldWidth: number): number {
  return x;
}

function boxesOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number }
): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitTerritoryLabel(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1 || text.length <= 12) {
    return [text];
  }
  const lines: string[] = [];
  let current = "";
  const maxCharsPerLine = 13;
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) {
    lines.push(current);
  }
  return lines.slice(0, 3);
}

function pngForTerritoryCard(territoryId: string): string | null {
  return territoryCardPngById[territoryId] ?? null;
}

function templateForTerritoryCard(territoryId: string): string | null {
  return territoryCardTemplateById[territoryId] ?? null;
}

async function cropTransparentPng(sourceUrl: string): Promise<string> {
  const image = new Image();
  image.decoding = "async";
  image.src = sourceUrl;
  await image.decode();

  const width = Math.max(1, Math.floor(image.naturalWidth || image.width));
  const height = Math.max(1, Math.floor(image.naturalHeight || image.height));

  const scanCanvas = document.createElement("canvas");
  scanCanvas.width = width;
  scanCanvas.height = height;
  const scanContext = scanCanvas.getContext("2d");
  if (!scanContext) {
    return sourceUrl;
  }
  scanContext.drawImage(image, 0, 0, width, height);
  const pixels = scanContext.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  const alphaThreshold = 28;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha <= alphaThreshold) {
        continue;
      }
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return sourceUrl;
  }

  const padding = Math.max(4, Math.round(Math.min(width, height) * 0.008));
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
  const cropHeight = Math.min(height - cropY, maxY - minY + 1 + padding * 2);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = cropWidth;
  outCanvas.height = cropHeight;
  const outContext = outCanvas.getContext("2d");
  if (!outContext) {
    return sourceUrl;
  }
  outContext.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return outCanvas.toDataURL("image/png");
}

async function loadImageElement(sourceUrl: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Image load failed: ${sourceUrl}`));
    image.src = sourceUrl;
  });
  try {
    await image.decode();
  } catch {
    // Some browsers can reject decode() even when the image is already loaded.
  }
  return image;
}

function isLikelySetupComplete(state: HostGameState | null, phase: string): boolean {
  if (!state) {
    return false;
  }
  return phase !== "setup";
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return (await response.json()) as T;
}

function canFortifyAdjacent(
  territories: Record<string, HostTerritoryState>,
  playerId: string,
  fromId: string,
  toId: string
): boolean {
  const from = territories[fromId];
  const to = territories[toId];
  if (!from || !to) {
    return false;
  }
  return from.ownerPlayerId === playerId &&
    to.ownerPlayerId === playerId &&
    from.neighborTerritoryIds.includes(toId);
}

function App() {
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const territoryMasksRef = useRef<Record<string, TerritoryMask>>({});
  const ownershipGridRef = useRef<OwnershipGrid | null>(null);
  const chatLastSequenceRef = useRef(0);
  const dealStartedMatchRef = useRef<string | null>(null);
  const dealTimerIdsRef = useRef<number[]>([]);
  const dealCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const handCardsRef = useRef<HTMLDivElement | null>(null);
  const combatRollIntervalRef = useRef<number | null>(null);
  const combatCloseTimerRef = useRef<number | null>(null);
  const panRafRef = useRef<number | null>(null);
  const pendingPanOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const panMovedRef = useRef(false);

  const boot = useMemo(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return null;
    }
  }, []);

  const [screen, setScreen] = useState<Screen>("splash");
  const [hostUrl, setHostUrl] = useState(boot?.hostUrl ?? "http://localhost:5050");

  const [hostDisplayName, setHostDisplayName] = useState(boot?.hostDisplayName ?? "Host");
  const [hostPeerId, setHostPeerId] = useState(boot?.hostPeerId ?? "host-local");
  const [roomName, setRoomName] = useState(boot?.roomName ?? "RisiKo! Lobby");

  const [joinDisplayName, setJoinDisplayName] = useState(boot?.joinDisplayName ?? "Peer");
  const [joinPeerId, setJoinPeerId] = useState(boot?.joinPeerId ?? "peer-local-2");
  const [availableRooms, setAvailableRooms] = useState<RoomLobbySummary[]>([]);

  const [roomId, setRoomId] = useState(boot?.roomId ?? "");
  const [roomSnapshot, setRoomSnapshot] = useState<RoomSnapshotResponse | null>(null);
  const [matchId, setMatchId] = useState(boot?.matchId ?? "");

  const [peerId, setPeerId] = useState(boot?.peerId ?? "");
  const [playerId, setPlayerId] = useState(boot?.playerId ?? "");

  const [state, setState] = useState<HostGameState | null>(null);
  const [syncOn, setSyncOn] = useState(false);
  const [status, setStatus] = useState("Pronto.");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ id: number; author: string; text: string; at: string }[]>([]);
  const [dealStage, setDealStage] = useState<"idle" | "objective" | "territories" | "complete">("idle");
  const [dealMatchId, setDealMatchId] = useState("");
  const [revealedTerritories, setRevealedTerritories] = useState<string[]>([]);
  const [dealtTerritoryOrder, setDealtTerritoryOrder] = useState<string[]>([]);
  const [territoryFlipCount, setTerritoryFlipCount] = useState(0);
  const [dealFlyToHand, setDealFlyToHand] = useState(false);
  const [setupDeckVisible, setSetupDeckVisible] = useState(true);
  const [dealFlyVectors, setDealFlyVectors] = useState<Record<string, { x: number; y: number; rot: number }>>({});
  const [croppedTerritoryCardById, setCroppedTerritoryCardById] = useState<Record<string, string>>({});
  const [mapBoardImageUrl, setMapBoardImageUrl] = useState("");
  const [mapBorderOverlayUrl, setMapBorderOverlayUrl] = useState("");
  const [combatPopup, setCombatPopup] = useState<{
    visible: boolean;
    rolling: boolean;
    attackerPlayerId: string;
    defenderPlayerId: string;
    fromTerritoryId: string;
    toTerritoryId: string;
    attackerLosses: number;
    defenderLosses: number;
    attackerRolls: number[];
    defenderRolls: number[];
  } | null>(null);
  const [captureMoveArmies, setCaptureMoveArmies] = useState(1);

  const territoryCardImageById = useMemo(
    () => ({ ...territoryCardPngById, ...croppedTerritoryCardById }),
    [croppedTerritoryCardById]
  );
  const vectorTerritoryMap = useMemo(() => parseVectorTerritoryMap(mapVectorSvgRaw), []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const entries = Object.entries(territoryCardPngById);
      const croppedEntries = await Promise.all(
        entries.map(async ([id, url]) => {
          try {
            const cropped = await cropTransparentPng(url);
            return [id, cropped] as const;
          } catch {
            return [id, url] as const;
          }
        })
      );
      if (!active) {
        return;
      }
      setCroppedTerritoryCardById(Object.fromEntries(croppedEntries));
    };
    void run();
    return () => {
      active = false;
    };
  }, [vectorTerritoryMap]);

  useEffect(() => {
    let active = true;
    const buildMasks = async () => {
      ownershipGridRef.current = null;
      setMapBorderOverlayUrl("");
      if (worldMapPngUrl) {
        setMapBoardImageUrl(worldMapPngUrl);
      }
      const territorySources = worldClassic.map.territories
        .map(territory => ({ id: territory.id, src: territoryMapPngById[territory.id] }))
        .filter(item => !!item.src) as Array<{ id: string; src: string }>;
      const decodedTerritories = await Promise.all(
        territorySources.map(async item => {
          try {
            const image = await loadImageElement(item.src);
            return {
              id: item.id,
              image,
              width: Math.max(1, image.naturalWidth || image.width || 1),
              height: Math.max(1, image.naturalHeight || image.height || 1)
            };
          } catch {
            return null;
          }
        })
      );
      const decodedById = Object.fromEntries(
        decodedTerritories
          .filter((value): value is { id: string; image: HTMLImageElement; width: number; height: number } => !!value)
          .map(value => [value.id, value])
      );

      let sourceMapWidth = 0;
      let sourceMapHeight = 0;
      for (const value of Object.values(decodedById)) {
        if (value.width > sourceMapWidth) {
          sourceMapWidth = value.width;
        }
        if (value.height > sourceMapHeight) {
          sourceMapHeight = value.height;
        }
      }
      if ((sourceMapWidth <= 0 || sourceMapHeight <= 0) && worldMapPngUrl) {
        try {
          const fallback = await loadImageElement(worldMapPngUrl);
          sourceMapWidth = Math.max(1, fallback.naturalWidth || fallback.width || 1000);
          sourceMapHeight = Math.max(1, fallback.naturalHeight || fallback.height || 700);
        } catch {
          // leave defaults
        }
      }
      if (sourceMapWidth <= 0 || sourceMapHeight <= 0) {
        sourceMapWidth = 1000;
        sourceMapHeight = 700;
      }
      const mapWidth = Math.max(1, Math.round(sourceMapWidth));
      const mapHeight = Math.max(1, Math.round(sourceMapHeight));
      const dprScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const renderScale = Math.max(1, Math.ceil((MAX_MAP_DISPLAY_WIDTH * dprScale) / mapWidth));
      if (!active) {
        return;
      }
      setMapPixelSize({ width: mapWidth, height: mapHeight });
      setMapRenderScale(renderScale);
      setMapViewBox(`0 0 ${mapWidth} ${mapHeight}`);

      const nextMasks: Record<string, TerritoryMask> = {};
      const nextOverlays: TerritoryOverlay[] = [];
      const territoryIds = worldClassic.map.territories.map(territory => territory.id);
      const territoryIndexById = new Map(territoryIds.map((id, index) => [id, index]));
      const ownerByPixel = new Int16Array(mapWidth * mapHeight);
      ownerByPixel.fill(-1);
      const ownerStrengthByPixel = new Uint8Array(mapWidth * mapHeight);
      const boardCanvas = document.createElement("canvas");
      boardCanvas.width = mapWidth * renderScale;
      boardCanvas.height = mapHeight * renderScale;
      const boardContext = boardCanvas.getContext("2d");
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = mapWidth;
      tempCanvas.height = mapHeight;
      const tempContext = tempCanvas.getContext("2d");
      if (!boardContext || !tempContext) {
        return;
      }
      boardContext.setTransform(1, 0, 0, 1, 0, 0);
      boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
      boardContext.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      let drewAnyTerritory = false;

      for (const territory of worldClassic.map.territories) {
        const decoded = decodedById[territory.id];
        if (!decoded) {
          continue;
        }
        try {
          const territoryOwnerIndex = territoryIndexById.get(territory.id) ?? -1;
          tempContext.clearRect(0, 0, mapWidth, mapHeight);
          tempContext.drawImage(decoded.image, 0, 0, mapWidth, mapHeight);
          const territoryImageData = tempContext.getImageData(0, 0, mapWidth, mapHeight);
          const data = territoryImageData.data;

          // Territory masks overlap on anti-aliased edge pixels. Hardening alpha
          // avoids blended double seams when compositing adjacent territories.
          for (let pixelIndex = 0; pixelIndex < data.length; pixelIndex += 4) {
            const alpha = data[pixelIndex + 3];
            const flatPixelIndex = pixelIndex >> 2;
            data[pixelIndex + 3] = alpha <= MAP_ALPHA_SOLID_THRESHOLD ? 0 : 255;
            if (
              territoryOwnerIndex >= 0 &&
              alpha >= MAP_OWNER_ASSIGNMENT_THRESHOLD &&
              alpha > ownerStrengthByPixel[flatPixelIndex]
            ) {
              ownerStrengthByPixel[flatPixelIndex] = alpha;
              ownerByPixel[flatPixelIndex] = territoryOwnerIndex;
            }
          }
          tempContext.putImageData(territoryImageData, 0, 0);
          boardContext.drawImage(tempCanvas, 0, 0);
          drewAnyTerritory = true;

          let minX = mapWidth;
          let minY = mapHeight;
          let maxX = -1;
          let maxY = -1;
          let sumX = 0;
          let sumY = 0;
          let area = 0;
          for (let y = 0; y < mapHeight; y += 1) {
            for (let x = 0; x < mapWidth; x += 1) {
              const alpha = data[(y * mapWidth + x) * 4 + 3];
              if (alpha <= MAP_ALPHA_SOLID_THRESHOLD) {
                continue;
              }
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
              sumX += x;
              sumY += y;
              area += 1;
            }
          }
          if (maxX < minX || maxY < minY || area <= 0) {
            continue;
          }

          const boxWidth = maxX - minX + 1;
          const boxHeight = maxY - minY + 1;
          const alphaMask = new Uint8Array(boxWidth * boxHeight);
          for (let y = minY; y <= maxY; y += 1) {
            for (let x = minX; x <= maxX; x += 1) {
              alphaMask[(y - minY) * boxWidth + (x - minX)] = data[(y * mapWidth + x) * 4 + 3];
            }
          }
          const borderPoints: number[] = [];
          for (let y = 0; y < boxHeight; y += 1) {
            for (let x = 0; x < boxWidth; x += 1) {
              const current = alphaMask[y * boxWidth + x];
              if (current <= 10) {
                continue;
              }
              const left = x > 0 ? alphaMask[y * boxWidth + (x - 1)] : 0;
              const right = x < boxWidth - 1 ? alphaMask[y * boxWidth + (x + 1)] : 0;
              const up = y > 0 ? alphaMask[(y - 1) * boxWidth + x] : 0;
              const down = y < boxHeight - 1 ? alphaMask[(y + 1) * boxWidth + x] : 0;
              if (left <= 10 || right <= 10 || up <= 10 || down <= 10) {
                borderPoints.push((x & 0xffff) | ((y & 0xffff) << 16));
              }
            }
          }

          const centerX = sumX / area;
          const centerY = sumY / area;
          nextMasks[territory.id] = {
            minX,
            minY,
            width: boxWidth,
            height: boxHeight,
            alpha: alphaMask,
            borderPoints: Uint32Array.from(borderPoints),
            outlineLoops: buildOutlineLoopsFromAlpha(alphaMask, boxWidth, boxHeight, minX, minY),
            centerX,
            centerY,
            area
          };

          const text = labelForTerritory(territory.id);
          const textLines = splitTerritoryLabel(text);
          const longestLineLength = Math.max(...textLines.map(line => line.length));
          const tuning = TERRITORY_OVERLAY_TUNING[territory.id] ?? {};
          const territorySpan = Math.max(8, Math.min(boxWidth, boxHeight));
          const territoryScale = clamp(Math.sqrt(area) / 120, 0.9, 1.6);
          const chipRadius = clamp(territorySpan * 0.175 * territoryScale, 8.2, 16.5);
          const widthLimited = (boxWidth * 0.7) / Math.max(4, longestLineLength * 0.6);
          const lineCount = textLines.length;
          const heightLimited = (boxHeight * 0.27) / Math.max(1, lineCount);
          const tunedBase = Math.min(widthLimited, heightLimited) * (tuning.fontScale ?? 1) * territoryScale;
          const labelFontSize = clamp(tunedBase, 6.2, 10.8);
          const labelWidth = Math.max(30, longestLineLength * labelFontSize * 0.56);
          const labelHeight = Math.max(9.2, labelFontSize * 1.12 * lineCount);
          const innerPadX = Math.max(4, boxWidth * 0.11);
          const innerPadY = Math.max(4, boxHeight * 0.11);
          const innerLeft = minX + innerPadX;
          const innerRight = maxX - innerPadX;
          const innerTop = minY + innerPadY;
          const innerBottom = maxY - innerPadY;
          const chipX = clampInRange(centerX + (tuning.chipDx ?? 0), innerLeft + chipRadius, innerRight - chipRadius);
          const baseChipY = centerY + Math.max(chipRadius * 1.2, labelHeight * 0.46 + 4.6) + (tuning.chipDy ?? 0);
          const chipY = clampInRange(baseChipY, innerTop + chipRadius + 2, innerBottom - chipRadius - 2);
          const desiredLabelX = centerX + (tuning.labelDx ?? 0);
          const labelX = clampInRange(desiredLabelX, minX + labelWidth * 0.5 + 2, maxX - labelWidth * 0.5 - 2);
          const labelClearance = Math.max(chipRadius * 1.7, labelHeight * 0.56 + 3.2);
          const labelMinY = innerTop + labelHeight * 0.56;
          const labelMaxY = innerBottom - labelHeight * 0.4;
          const preferredAboveY = chipY - labelClearance + (tuning.labelDy ?? 0);
          const preferredBelowY = chipY + labelClearance + (tuning.labelDy ?? 0);
          const labelY = preferredAboveY < labelMinY
            ? clampInRange(preferredBelowY, labelMinY, labelMaxY)
            : clampInRange(preferredAboveY, labelMinY, labelMaxY);
          const labelStyle = TERRITORY_LABEL_STYLE[territory.id];
          const labelRotation = labelStyle?.rotation ?? 0;
          const labelFontScale = labelStyle?.fontScale ?? 1;
          let labelCurvePath: string | undefined;
          let labelCurveText: string | undefined;
          const autoCurve =
            !labelStyle?.curve &&
            lineCount === 1 &&
            text.length >= 7 &&
            boxWidth > boxHeight * 1.28;
          if (labelStyle?.curve || autoCurve) {
            const curve = labelStyle?.curve ?? { span: 1.03, arch: 0.11, offsetY: 0 };
            const span = Math.max(18, labelWidth * (curve.span ?? 1));
            const arch = labelHeight * (curve.arch ?? 0.14);
            const curveY = labelY + (curve.offsetY ?? 0);
            const startX = labelX - span * 0.5;
            const endX = labelX + span * 0.5;
            labelCurvePath = `M ${startX.toFixed(2)} ${curveY.toFixed(2)} Q ${labelX.toFixed(2)} ${(curveY - arch).toFixed(2)} ${endX.toFixed(2)} ${curveY.toFixed(2)}`;
            labelCurveText = text;
          }

          nextOverlays.push({
            id: territory.id,
            centerX: chipX,
            centerY,
            textLines,
            chipY,
            chipRadius,
            labelX,
            labelY,
            labelFontSize,
            labelWidth,
            labelHeight,
            labelRotation,
            labelCurvePath,
            labelCurveText,
            labelFontScale,
            text
          });
        } catch {
          // ignore malformed asset
        }
      }

      if (!active) {
        return;
      }
      territoryMasksRef.current = nextMasks;
      ownershipGridRef.current = {
        width: mapWidth,
        height: mapHeight,
        ownerByPixel,
        territoryIds
      };
      setRegionOverlays(nextOverlays);
      setMapBorderOverlayUrl(buildSharedBorderOverlayDataUrl(ownerByPixel, mapWidth, mapHeight, renderScale));
      setMapBoardImageUrl(
        drewAnyTerritory
          ? boardCanvas.toDataURL("image/png")
          : (worldMapPngUrl || boardCanvas.toDataURL("image/png"))
      );

    };

    void buildMasks();
    return () => {
      active = false;
    };
  }, []);

  const [captureMoveReady, setCaptureMoveReady] = useState(false);
  const [mapScale, setMapScale] = useState(1);
  const [mapMinScale, setMapMinScale] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [regionOverlays, setRegionOverlays] = useState<TerritoryOverlay[]>([]);
  const [mapViewBox, setMapViewBox] = useState("0 0 1000 700");
  const [mapPixelSize, setMapPixelSize] = useState({ width: 1000, height: 700 });
  const [mapRenderScale, setMapRenderScale] = useState(1);
  const [hoverTerritoryId, setHoverTerritoryId] = useState("");

  const [reinforceTerritoryId, setReinforceTerritoryId] = useState("");
  const [attackFromId, setAttackFromId] = useState("");
  const [attackToId, setAttackToId] = useState("");
  const [attackDice, setAttackDice] = useState(1);
  const [fortifyFromId, setFortifyFromId] = useState("");
  const [fortifyToId, setFortifyToId] = useState("");
  const [fortifyArmies, setFortifyArmies] = useState(1);
  const [selectedTradeCardIds, setSelectedTradeCardIds] = useState<string[]>([]);

  const currentPhase = parsePhase(state?.phase);
  const viewportAdaptiveFactor = clamp(1600 / Math.max(640, viewportWidth), 0.95, 1.85);
  const zoomReadabilityCompensation = clamp(Math.pow(1 / Math.max(0.45, mapScale), 0.66), 0.72, 2.8);
  // Keep overlays naturally tied to map zoom; only apply a light viewport readability adjustment.
  const textReadabilityScale = clamp(viewportAdaptiveFactor * 1.08 * zoomReadabilityCompensation, 0.9, 3.35);
  const chipReadabilityScale = clamp(viewportAdaptiveFactor * 0.94 * Math.pow(zoomReadabilityCompensation, 0.9), 0.82, 2.65);
  const vectorScaleX = vectorTerritoryMap ? (mapPixelSize.width / vectorTerritoryMap.width) : 1;
  const vectorScaleY = vectorTerritoryMap ? (mapPixelSize.height / vectorTerritoryMap.height) : 1;

  const selectionPathSpecs = useMemo(() => {
    const specs: Array<{ territoryId: string; variant: "reinforce" | "attackFrom" | "attackTo" | "fortify" }> = [];
    if (currentPhase === "setup" || currentPhase === "reinforcement") {
      if (reinforceTerritoryId) {
        specs.push({ territoryId: reinforceTerritoryId, variant: "reinforce" });
      }
      return specs;
    }
    if (currentPhase === "attack") {
      if (attackFromId) {
        specs.push({ territoryId: attackFromId, variant: "attackFrom" });
      }
      if (attackToId) {
        specs.push({ territoryId: attackToId, variant: "attackTo" });
      }
      return specs;
    }
    if (currentPhase === "fortify") {
      if (fortifyFromId) {
        specs.push({ territoryId: fortifyFromId, variant: "fortify" });
      }
      if (fortifyToId) {
        specs.push({ territoryId: fortifyToId, variant: "fortify" });
      }
    }
    return specs;
  }, [currentPhase, reinforceTerritoryId, attackFromId, attackToId, fortifyFromId, fortifyToId]);

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const myObjective = state?.objectivesByPlayerId?.[playerId];
  const territoryList = Object.values(state?.territories ?? {});
  const ownedTerritories = territoryList.filter(territory => territory.ownerPlayerId === playerId);
  const handCount = state?.cardIdsByPlayerId?.[playerId]?.length ?? 0;
  const myCards = state?.cardIdsByPlayerId?.[playerId] ?? [];
  const ownedTerritoryIds = ownedTerritories.map(territory => territory.territoryId);
  const ownedTerritoryIdSet = useMemo(() => new Set(ownedTerritoryIds), [ownedTerritoryIds]);
  const setupComplete = isLikelySetupComplete(state, currentPhase);
  const isDealOverlayActive = dealStage !== "idle";
  const hideHandDuringDeal = dealStage === "objective" || dealStage === "territories";
  const isMyTurn = !!state && state.activePlayerId === playerId;
  const isHostInLobby = !!roomSnapshot && roomSnapshot.hostPeerId === peerId;
  const activePlayer = state?.players.find(player => player.playerId === state.activePlayerId);
  const activePlayerLabel = activePlayer
    ? `${activePlayer.displayName} (${activePlayer.playerId})`
    : state?.activePlayerId ?? "-";
  const combatAttackerLabel = combatPopup
    ? (state?.players.find(player => player.playerId === combatPopup.attackerPlayerId)?.displayName ?? combatPopup.attackerPlayerId)
    : "";
  const combatDefenderLabel = combatPopup
    ? (state?.players.find(player => player.playerId === combatPopup.defenderPlayerId)?.displayName ?? combatPopup.defenderPlayerId)
    : "";
  const combatDiceOutcome = useMemo(() => {
    if (!combatPopup || combatPopup.rolling) {
      return { attacker: [] as Array<"win" | "loss" | "none">, defender: [] as Array<"win" | "loss" | "none"> };
    }
    const compareCount = Math.min(combatPopup.attackerRolls.length, combatPopup.defenderRolls.length);
    const attacker: Array<"win" | "loss" | "none"> = combatPopup.attackerRolls.map(() => "none");
    const defender: Array<"win" | "loss" | "none"> = combatPopup.defenderRolls.map(() => "none");

    for (let index = 0; index < compareCount; index++) {
      if (combatPopup.attackerRolls[index] > combatPopup.defenderRolls[index]) {
        attacker[index] = "win";
        defender[index] = "loss";
      } else {
        attacker[index] = "loss";
        defender[index] = "win";
      }
    }

    return { attacker, defender };
  }, [combatPopup]);
  const phaseInstruction =
    currentPhase === "setup"
      ? "Setup iniziale: piazza fino a 3 rinforzi totali sul tuo turno (solo su territori posseduti). Il turno passa quando finisci i rinforzi disponibili."
      : currentPhase === "reinforcement"
      ? "Piazza tutti i rinforzi disponibili, poi premi Fine / Prossimo."
      : currentPhase === "attack"
        ? "Attacca uno o piu territori adiacenti, poi premi Fine Attacchi."
        : "Fase movimento: una sola volta (opzionale), sposta quante armate vuoi tra territori adiacenti lasciandone almeno 1 in origine, poi termina turno.";
  const hasPendingCaptureMove =
    currentPhase === "attack" &&
    !!state?.pendingCaptureFromTerritoryId &&
    !!state?.pendingCaptureToTerritoryId;
  const pendingCaptureFrom = state?.pendingCaptureFromTerritoryId ?? "";
  const pendingCaptureTo = state?.pendingCaptureToTerritoryId ?? "";
  const pendingCaptureMinArmies = Math.max(1, state?.pendingCaptureMinArmies ?? 1);
  const pendingCaptureMaxArmies = Math.max(pendingCaptureMinArmies, state?.pendingCaptureMaxArmies ?? pendingCaptureMinArmies);
  const selectedTradeSymbols = selectedTradeCardIds.map(cardId => state?.cardSymbolById?.[cardId] ?? "");
  const trisEvaluation = evaluateTrisSelection(selectedTradeSymbols);
  const ownedTerritoryTradeBonus = selectedTradeCardIds.filter(cardId =>
    cardId.startsWith("territory:") &&
    ownedTerritoryIdSet.has(cardId.replace("territory:", ""))).length * 2;
  const trisTotalBonus = trisEvaluation.valid ? trisEvaluation.baseBonus + ownedTerritoryTradeBonus : 0;
  const objectiveProgressLabel = useMemo(() => {
    if (!state || !myObjective) {
      return "";
    }

    if (myObjective.kind === "continent_combo") {
      const requiredIds = myObjective.requiredContinentIds ?? [];
      const missingRequired = requiredIds.filter(continentId => {
        const continent = state.continents?.find(value => value.id === continentId);
        if (!continent) {
          return true;
        }
        return !continent.territoryIds.every(id => state.territories[id]?.ownerPlayerId === playerId);
      });

      const requiredSet = new Set(requiredIds);
      const ownedAdditional = (state.continents ?? []).filter(continent => {
        if (requiredSet.has(continent.id)) {
          return false;
        }
        return continent.territoryIds.every(id => state.territories[id]?.ownerPlayerId === playerId);
      }).length;
      const additionalRequired = Math.max(0, myObjective.requiredAdditionalContinentCount ?? 0);
      const additionalMissing = Math.max(0, additionalRequired - ownedAdditional);

      const chunks: string[] = [];
      if (missingRequired.length > 0) {
        chunks.push(`Continenti richiesti mancanti: ${missingRequired.map(continentLabel).join(", ")}`);
      }
      if (additionalRequired > 0) {
        chunks.push(`Continente extra mancante: ${additionalMissing}`);
      }
      if (chunks.length === 0) {
        return "Obiettivo continenti completato";
      }
      return chunks.join(" | ");
    }

    if (myObjective.kind === "territory_with_min_armies") {
      const threshold = Math.max(1, myObjective.requiredArmiesPerTerritory ?? 1);
      const qualified = ownedTerritories.filter(territory => territory.armies >= threshold).length;
      const target = Math.max(0, myObjective.targetTerritoryCount);
      return `Territori ${threshold}+ armate mancanti: ${Math.max(0, target - qualified)}`;
    }

    if (myObjective.kind === "territory_count") {
      const target = Math.max(0, myObjective.targetTerritoryCount);
      return `Territori obiettivo mancanti: ${Math.max(0, target - ownedTerritories.length)}`;
    }

    if (myObjective.kind === "eliminate_player") {
      const targetPlayerId = myObjective.eliminateTargetPlayerId;
      if (!targetPlayerId) {
        return "";
      }
      const stillAlive = Object.values(state.territories).some(territory => territory.ownerPlayerId === targetPlayerId);
      return stillAlive ? "Obiettivo eliminazione: bersaglio ancora in gioco" : "Obiettivo eliminazione completato";
    }

    return "";
  }, [myObjective, ownedTerritories, playerId, state]);

  const clearCombatTimers = useCallback(() => {
    if (combatRollIntervalRef.current !== null) {
      window.clearInterval(combatRollIntervalRef.current);
      combatRollIntervalRef.current = null;
    }
    if (combatCloseTimerRef.current !== null) {
      window.clearTimeout(combatCloseTimerRef.current);
      combatCloseTimerRef.current = null;
    }
  }, []);

  const schedulePanOffset = useCallback((x: number, y: number) => {
    const mapWorldWidth = mapImageRef.current?.clientWidth
      ?? (Math.min((mapViewportRef.current?.clientWidth ?? window.innerWidth) * 0.92, MAX_MAP_DISPLAY_WIDTH) * Math.max(0.1, mapScale));
    pendingPanOffsetRef.current = {
      x: Math.round(normalizeLoopedOffsetX(x, mapWorldWidth)),
      y: Math.round(y)
    };
    if (panRafRef.current !== null) {
      return;
    }
    panRafRef.current = window.requestAnimationFrame(() => {
      panRafRef.current = null;
      const next = pendingPanOffsetRef.current;
      pendingPanOffsetRef.current = null;
      if (!next) {
        return;
      }
      setMapOffset(current => {
        if (current.x === next.x && current.y === next.y) {
          return current;
        }
        return next;
      });
    });
  }, [mapScale]);

  const randomDice = useCallback((count: number) => {
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(1 + Math.floor(Math.random() * 6));
    }
    return rolls;
  }, []);

  const showCombatResolutionPopup = useCallback(
    (resolution: AttackResolutionPayload) => {
      clearCombatTimers();

      const attackerCount = Math.max(1, resolution.attackerRolls.length);
      const defenderCount = Math.max(1, resolution.defenderRolls.length);
      setCombatPopup({
        visible: true,
        rolling: true,
        attackerPlayerId: resolution.attackerPlayerId,
        defenderPlayerId: resolution.defenderPlayerId,
        fromTerritoryId: resolution.fromTerritoryId,
        toTerritoryId: resolution.toTerritoryId,
        attackerLosses: resolution.attackerLosses,
        defenderLosses: resolution.defenderLosses,
        attackerRolls: randomDice(attackerCount),
        defenderRolls: randomDice(defenderCount)
      });

      combatRollIntervalRef.current = window.setInterval(() => {
        setCombatPopup(current => {
          if (!current || !current.visible || !current.rolling) {
            return current;
          }
          return {
            ...current,
            attackerRolls: randomDice(attackerCount),
            defenderRolls: randomDice(defenderCount)
          };
        });
      }, 90);

      window.setTimeout(() => {
        if (combatRollIntervalRef.current !== null) {
          window.clearInterval(combatRollIntervalRef.current);
          combatRollIntervalRef.current = null;
        }
        setCombatPopup(current => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            rolling: false,
            attackerRolls: [...resolution.attackerRolls],
            defenderRolls: [...resolution.defenderRolls]
          };
        });

        combatCloseTimerRef.current = window.setTimeout(() => {
          setCombatPopup(current => (current ? { ...current, visible: false } : current));
          combatCloseTimerRef.current = null;
        }, 2200);
      }, 900);
    },
    [clearCombatTimers, randomDice]
  );

  const playerRows = useMemo(() => {
    if (!state) {
      return [];
    }
    return state.players.map((player, index) => {
      const owned = Object.values(state.territories).filter(territory => territory.ownerPlayerId === player.playerId).length;
      const byTerritory = Math.max(3, Math.floor(owned / 3));
      const continentBonus =
        state.continents?.reduce((total, continent) => {
          const ownsAll = continent.territoryIds.every(id => state.territories[id]?.ownerPlayerId === player.playerId);
          return total + (ownsAll ? continent.bonus : 0);
        }, 0) ?? 0;
      const nextRound = byTerritory + continentBonus;
      return {
        player,
        color: PLAYER_COLORS[index % PLAYER_COLORS.length],
        cardAsset: PLAYER_CARD_ASSETS[index % PLAYER_CARD_ASSETS.length],
        tankAsset: PLAYER_TANK_ASSETS[index % PLAYER_TANK_ASSETS.length],
        owned,
        nextRound,
        cardCount: state.cardIdsByPlayerId?.[player.playerId]?.length ?? 0,
        placeableNow: state.activePlayerId === player.playerId ? state.reinforcementsAvailable : 0
      };
    });
  }, [state]);

  const attackSourceOptions = ownedTerritories.filter(territory => territory.armies > 1);
  const attackSourceIdSet = useMemo(() => new Set(attackSourceOptions.map(territory => territory.territoryId)), [attackSourceOptions]);
  const selectedAttackSource = state?.territories?.[attackFromId];
  const attackDiceMax = Math.max(1, Math.min(3, Math.max(1, (selectedAttackSource?.armies ?? 2) - 1)));
  const attackDiceOptions = [1, 2, 3].filter(value => value <= attackDiceMax);
  const attackTargetOptions =
    selectedAttackSource?.neighborTerritoryIds
      .map(id => state?.territories?.[id])
      .filter((territory): territory is HostTerritoryState => !!territory && territory.ownerPlayerId !== playerId) ?? [];

  const fortifySourceOptions = ownedTerritories.filter(territory => territory.armies > 1);
  const fortifyTargetOptions = ownedTerritories.filter(territory => {
    if (!state || !fortifyFromId || territory.territoryId === fortifyFromId) {
      return false;
    }
    return canFortifyAdjacent(state.territories, playerId, fortifyFromId, territory.territoryId);
  });
  const possibleAttackTargetIds = useMemo(() => {
    if (!state || currentPhase !== "attack" || !isMyTurn) {
      return new Set<string>();
    }

    const result = new Set<string>();
    if (attackFromId && state.territories[attackFromId]) {
      for (const neighborId of state.territories[attackFromId].neighborTerritoryIds) {
        const target = state.territories[neighborId];
        if (target && target.ownerPlayerId !== playerId) {
          result.add(neighborId);
        }
      }
      return result;
    }

    for (const source of attackSourceOptions) {
      for (const neighborId of source.neighborTerritoryIds) {
        const target = state.territories[neighborId];
        if (target && target.ownerPlayerId !== playerId) {
          result.add(neighborId);
        }
      }
    }
    return result;
  }, [attackFromId, attackSourceOptions, currentPhase, isMyTurn, playerId, state]);
  const overlayById = useMemo(() => {
    const map = new Map<string, TerritoryOverlay>();
    for (const overlay of regionOverlays) {
      map.set(overlay.id, overlay);
    }
    return map;
  }, [regionOverlays]);
  const attackPreviewLines = useMemo(() => {
    if (!state || !isMyTurn || currentPhase !== "attack") {
      return [] as Array<{ key: string; fromX: number; fromY: number; toX: number; toY: number; selected: boolean }>;
    }
    if (!attackFromId) {
      return [] as Array<{ key: string; fromX: number; fromY: number; toX: number; toY: number; selected: boolean }>;
    }
    const sourceState = state.territories[attackFromId];
    if (!sourceState) {
      return [] as Array<{ key: string; fromX: number; fromY: number; toX: number; toY: number; selected: boolean }>;
    }
    const lines: Array<{ key: string; fromX: number; fromY: number; toX: number; toY: number; selected: boolean }> = [];
    const pushLine = (fromId: string, toId: string, selected: boolean) => {
      const from = overlayById.get(fromId);
      const to = overlayById.get(toId);
      if (!from || !to) {
        return;
      }
      lines.push({
        key: `${fromId}->${toId}`,
        fromX: from.centerX,
        fromY: from.centerY,
        toX: to.centerX,
        toY: to.centerY,
        selected
      });
    };

    for (const neighborId of sourceState.neighborTerritoryIds) {
      const target = state.territories[neighborId];
      if (target && target.ownerPlayerId !== playerId) {
        const selected = !attackToId || neighborId === attackToId;
        pushLine(attackFromId, neighborId, selected);
      }
    }
    return lines;
  }, [attackFromId, attackToId, currentPhase, isMyTurn, overlayById, playerId, state]);
  const seaConnectionPaths = useMemo(() => {
    if (!regionOverlays.length) {
      return [] as Array<{ key: string; d: string }>;
    }
    const masks = territoryMasksRef.current;
    const overlayMap = new Map(regionOverlays.map(overlay => [overlay.id, overlay]));
    const paths: Array<{ key: string; d: string }> = [];
    const neighborsById = new Map(worldClassic.map.territories.map(territory => [territory.id, new Set(territory.neighbors)]));
    const mapWidth = Math.max(1, mapPixelSize.width);

    for (const spec of OFFICIAL_SEA_CONNECTIONS) {
      const a = spec.a;
      const b = spec.b;
      const key = a < b ? `${a}::${b}` : `${b}::${a}`;
      if (!neighborsById.get(a)?.has(b)) {
        continue;
      }

      const maskA = masks[a];
      const maskB = masks[b];
      const overlayA = overlayMap.get(a);
      const overlayB = overlayMap.get(b);
      if (!maskA || !maskB || !overlayA || !overlayB) {
        continue;
      }

      const anchorA = findMaskEdgeAnchor(maskA, overlayB.centerX, overlayB.centerY);
      const anchorB = findMaskEdgeAnchor(maskB, overlayA.centerX, overlayA.centerY);
      const x1 = anchorA.x;
      const y1 = anchorA.y;
      const x2 = anchorB.x;
      const y2 = anchorB.y;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length < 14) {
        continue;
      }

      if (spec.wrapAcrossMap) {
        const aOnLeft = x1 <= x2;
        const edgePad = 10;
        const offscreenInset = 18;
        const offscreenFromX = aOnLeft ? -offscreenInset : (mapWidth + offscreenInset);
        const offscreenToX = aOnLeft ? (mapWidth + offscreenInset) : -offscreenInset;
        const outCtrlX = aOnLeft ? (x1 - 34) : (x1 + 34);
        const inCtrlX = aOnLeft ? (x2 + 34) : (x2 - 34);
        const outCtrlY = y1 + (aOnLeft ? -8 : 8);
        const inCtrlY = y2 + (aOnLeft ? 8 : -8);
        paths.push({
          key: `${key}::wrapA`,
          d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${outCtrlX.toFixed(2)} ${outCtrlY.toFixed(2)} ${offscreenFromX.toFixed(2)} ${y1.toFixed(2)}`
        });
        paths.push({
          key: `${key}::wrapB`,
          d: `M ${offscreenToX.toFixed(2)} ${y2.toFixed(2)} Q ${inCtrlX.toFixed(2)} ${inCtrlY.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`
        });
        continue;
      }

      const normalX = -dy / length;
      const normalY = dx / length;
      const sign = spec.bendSign ?? ((key.charCodeAt(0) % 2 === 0) ? 1 : -1);
      const bendFactor = spec.bendFactor ?? 0.13;
      const bend = clamp(length * bendFactor, 12, 58);
      const cx = (x1 + x2) * 0.5 + normalX * bend * sign;
      const cy = (y1 + y2) * 0.5 + normalY * bend * sign;
      paths.push({ key, d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}` });
    }

    return paths;
  }, [mapPixelSize.width, regionOverlays]);
  const playerColorById = useMemo(() => {
    if (!state) {
      return {} as Record<string, string>;
    }
    const map: Record<string, string> = {};
    state.players.forEach((player, index) => {
      map[player.playerId] = PLAYER_COLORS[index % PLAYER_COLORS.length];
    });
    return map;
  }, [state]);
  const hoveredTerritoryLabel = hoverTerritoryId ? labelForTerritory(hoverTerritoryId) : "-";
  const canPlaceFromMap = isMyTurn && (currentPhase === "setup" || currentPhase === "reinforcement");
  const placeReinforcementFromMap = useCallback(
    (territoryId: string, delta: number) => {
      if (!canPlaceFromMap || !state) {
        return;
      }
      if (delta < 0) {
        setStatus("I rinforzi già piazzati non possono essere rimossi.");
        return;
      }
      const territory = state.territories[territoryId];
      if (!territory || territory.ownerPlayerId !== playerId || state.reinforcementsAvailable <= 0) {
        return;
      }
      setReinforceTerritoryId(territoryId);
      submitCommand("PlaceReinforcements", { territoryId, armiesToPlace: 1 });
    },
    [canPlaceFromMap, playerId, state, submitCommand]
  );

  const handleTerritoryClick = useCallback(
    (territoryId: string) => {
      if (!state || !isMyTurn) {
        return;
      }
      const territory = state.territories[territoryId];
      if (!territory) {
        return;
      }

      if (currentPhase === "reinforcement" || currentPhase === "setup") {
        if (territory.ownerPlayerId === playerId) {
          setReinforceTerritoryId(current => (current === territoryId ? "" : territoryId));
          setStatus(`Rinforzo selezionato: ${labelForTerritory(territoryId)}`);
        }
        return;
      }

      if (currentPhase === "attack") {
        if (hasPendingCaptureMove) {
          setStatus("Devi prima scegliere quante armate spostare nel territorio conquistato.");
          return;
        }
        if (territory.ownerPlayerId === playerId && territory.armies > 1) {
          if (attackFromId === territoryId) {
            setAttackFromId("");
            setAttackToId("");
            setStatus("Sorgente attacco deselezionata.");
            return;
          }
          setAttackFromId(territoryId);
          setAttackToId("");
          setStatus(`Attacco da: ${labelForTerritory(territoryId)}. Seleziona il bersaglio.`);
          return;
        }
        if (!attackFromId) {
          return;
        }
        const source = state.territories[attackFromId];
        if (!source) {
          return;
        }
        if (source.neighborTerritoryIds.includes(territoryId) && territory.ownerPlayerId !== playerId) {
          setAttackToId(territoryId);
          setStatus(`Bersaglio attacco: ${labelForTerritory(territoryId)}`);
        }
        return;
      }

      if (currentPhase === "fortify" && territory.ownerPlayerId === playerId) {
        if (!fortifyFromId || fortifyFromId === territoryId) {
          setFortifyFromId(territoryId);
          setFortifyToId("");
          setStatus(`Fortifica da: ${labelForTerritory(territoryId)}.`);
          return;
        }
        const canReach = canFortifyAdjacent(state.territories, playerId, fortifyFromId, territoryId);
        if (canReach) {
          setFortifyToId(territoryId);
          setStatus(`Fortifica verso: ${labelForTerritory(territoryId)}.`);
        }
      }
    },
    [attackFromId, currentPhase, fortifyFromId, hasPendingCaptureMove, isMyTurn, playerId, state]
  );

  const clearMapSelections = useCallback(() => {
    if (currentPhase === "setup" || currentPhase === "reinforcement") {
      setReinforceTerritoryId("");
      return;
    }
    if (currentPhase === "attack") {
      setAttackFromId("");
      setAttackToId("");
      return;
    }
    if (currentPhase === "fortify") {
      setFortifyFromId("");
      setFortifyToId("");
    }
  }, [currentPhase]);

  const handleMapSurfaceClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (panMovedRef.current) {
      panMovedRef.current = false;
      return;
    }
    const image = mapImageRef.current;
    if (!image) {
      clearMapSelections();
      return;
    }
    const rect = image.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      clearMapSelections();
      return;
    }
    const localX = ((event.clientX - rect.left) / rect.width) * mapPixelSize.width;
    const localY = ((event.clientY - rect.top) / rect.height) * mapPixelSize.height;
    if (localX < 0 || localY < 0 || localX >= mapPixelSize.width || localY >= mapPixelSize.height) {
      clearMapSelections();
      return;
    }

    let selectedId = "";
    const x = Math.floor(localX);
    const y = Math.floor(localY);
    const ownershipGrid = ownershipGridRef.current;
    if (ownershipGrid && x >= 0 && y >= 0 && x < ownershipGrid.width && y < ownershipGrid.height) {
      const ownerIndex = ownershipGrid.ownerByPixel[y * ownershipGrid.width + x];
      if (ownerIndex >= 0 && ownerIndex < ownershipGrid.territoryIds.length) {
        selectedId = ownershipGrid.territoryIds[ownerIndex];
      }
    }

    if (!selectedId) {
      clearMapSelections();
      return;
    }
    handleTerritoryClick(selectedId);
  }, [clearMapSelections, handleTerritoryClick, mapPixelSize.height, mapPixelSize.width]);

  useEffect(() => {
    const timer = setTimeout(() => setScreen("portal"), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      PREF_KEY,
      JSON.stringify({
        hostUrl,
        hostDisplayName,
        hostPeerId,
        roomName,
        joinDisplayName,
        joinPeerId,
        roomId,
        matchId,
        peerId,
        playerId
      })
    );
  }, [hostDisplayName, hostPeerId, hostUrl, joinDisplayName, joinPeerId, matchId, peerId, playerId, roomId, roomName]);

  useEffect(() => {
    if (screen !== "joinLobby" && screen !== "portal") {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const rooms = await getJson<RoomLobbySummary[]>(`${hostUrl}/api/rooms`);
        if (cancelled) {
          return;
        }
        setAvailableRooms(rooms.filter(room => room.status === "open"));
      } catch (error) {
        if (!cancelled) {
          setStatus(`Errore elenco stanze: ${(error as Error).message}`);
        }
      }
    };
    poll();
    const timer = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hostUrl, screen]);

  useEffect(() => {
    if (!roomId || (screen !== "hostLobby" && screen !== "joinLobby")) {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const room = await getJson<RoomSnapshotResponse>(`${hostUrl}/api/rooms/${encodeURIComponent(roomId)}`);
        if (cancelled) {
          return;
        }
        setRoomSnapshot(room);
        if (room.activeMatchId) {
          setMatchId(room.activeMatchId);
          setSyncOn(true);
          setScreen("game");
          setStatus(`Partita avviata: ${room.activeMatchId}`);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(`Errore sincronizzazione lobby: ${(error as Error).message}`);
        }
      }
    };
    poll();
    const timer = setInterval(poll, 1200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hostUrl, roomId, screen]);

  useEffect(() => {
    if (!syncOn || !matchId) {
      return;
    }
    let cancelled = false;
    const pollState = async () => {
      try {
        const payload = await getJson<MatchStateResponse>(`${hostUrl}/api/matches/${encodeURIComponent(matchId)}/state`);
        if (cancelled) {
          return;
        }
        setState(payload.state);
        if (payload.roomId && payload.roomId !== roomId) {
          setRoomId(payload.roomId);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(`Errore sincronizzazione stato: ${(error as Error).message}`);
        }
      }
    };
    pollState();
    const timer = setInterval(pollState, 1200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hostUrl, matchId, roomId, syncOn]);

  useEffect(() => {
    if (!roomId || !peerId || screen !== "game") {
      return;
    }
    let cancelled = false;
    const pollChat = async () => {
      try {
        const events = await getJson<HostEventMessage[]>(
          `${hostUrl}/api/rooms/${encodeURIComponent(roomId)}/peers/${encodeURIComponent(peerId)}/events?after=${chatLastSequenceRef.current}`
        );
        if (cancelled || events.length === 0) {
          return;
        }

        let maxSequence = chatLastSequenceRef.current;
        const incoming: { id: number; author: string; text: string; at: string }[] = [];
        for (const evt of events) {
          maxSequence = Math.max(maxSequence, evt.sequence);
          if (evt.type !== "chat_message") {
            continue;
          }
          let payload: ChatEventPayload | null = null;
          try {
            payload = JSON.parse(evt.payload) as ChatEventPayload;
          } catch {
            payload = null;
          }
          if (!payload || !payload.text?.trim()) {
            continue;
          }
          incoming.push({
            id: evt.sequence,
            author: payload.authorDisplayName || payload.authorPeerId || evt.hostPeerId,
            text: payload.text,
            at: new Date(payload.sentAtUtc || evt.createdAtUtc).toLocaleTimeString()
          });
        }

        if (incoming.length > 0) {
          setChatMessages(current => {
            const known = new Set(current.map(message => message.id));
            const merged = [...current];
            for (const message of incoming) {
              if (!known.has(message.id)) {
                merged.push(message);
                known.add(message.id);
              }
            }
            return merged.slice(-120);
          });
        }
        chatLastSequenceRef.current = maxSequence;
      } catch {
        // chat poll is best-effort; avoid noisy status overrides.
      }
    };

    pollChat();
    const timer = window.setInterval(pollChat, 900);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hostUrl, peerId, roomId, screen]);

  useEffect(() => {
    setChatMessages([]);
    chatLastSequenceRef.current = 0;
  }, [roomId]);

  useEffect(() => {
    if (!ownedTerritories.length) {
      setReinforceTerritoryId("");
      return;
    }
    if (reinforceTerritoryId && !ownedTerritories.some(territory => territory.territoryId === reinforceTerritoryId)) {
      setReinforceTerritoryId("");
    }
  }, [ownedTerritories, reinforceTerritoryId]);

  useEffect(() => {
    if (!attackSourceOptions.length) {
      setAttackFromId("");
      setAttackToId("");
      return;
    }
    if (attackFromId && !attackSourceOptions.some(territory => territory.territoryId === attackFromId)) {
      setAttackFromId("");
    }
  }, [attackFromId, attackSourceOptions]);

  useEffect(() => {
    if (!attackFromId || !attackTargetOptions.length) {
      setAttackToId("");
      return;
    }
    if (attackToId && !attackTargetOptions.some(territory => territory.territoryId === attackToId)) {
      setAttackToId("");
    }
  }, [attackFromId, attackTargetOptions, attackToId]);

  useEffect(() => {
    if (attackDice > attackDiceMax) {
      setAttackDice(attackDiceMax);
    }
  }, [attackDice, attackDiceMax]);

  useEffect(() => {
    if (currentPhase !== "reinforcement") {
      setSelectedTradeCardIds([]);
      return;
    }
    setSelectedTradeCardIds(current => current.filter(cardId => myCards.includes(cardId)));
  }, [currentPhase, myCards]);

  useEffect(() => {
    if (!hasPendingCaptureMove) {
      setCaptureMoveReady(false);
      return;
    }
    setCaptureMoveArmies(current => clamp(current, pendingCaptureMinArmies, pendingCaptureMaxArmies));
  }, [hasPendingCaptureMove, pendingCaptureMaxArmies, pendingCaptureMinArmies]);

  useEffect(() => {
    if (!hasPendingCaptureMove) {
      setCaptureMoveReady(false);
      return;
    }
    if (combatPopup?.visible) {
      setCaptureMoveReady(false);
      return;
    }
    const timer = window.setTimeout(() => setCaptureMoveReady(true), 650);
    return () => window.clearTimeout(timer);
  }, [combatPopup?.visible, hasPendingCaptureMove]);

  useEffect(() => {
    if (!fortifySourceOptions.length) {
      setFortifyFromId("");
      setFortifyToId("");
      return;
    }
    if (!fortifySourceOptions.some(territory => territory.territoryId === fortifyFromId)) {
      setFortifyFromId(fortifySourceOptions[0].territoryId);
    }
  }, [fortifyFromId, fortifySourceOptions]);

  useEffect(() => {
    if (!fortifyTargetOptions.length) {
      setFortifyToId("");
      return;
    }
    if (!fortifyTargetOptions.some(territory => territory.territoryId === fortifyToId)) {
      setFortifyToId(fortifyTargetOptions[0].territoryId);
    }
  }, [fortifyTargetOptions, fortifyToId]);

  useEffect(() => {
    return () => {
      dealTimerIdsRef.current.forEach(timer => clearTimeout(timer));
      clearCombatTimers();
      if (panRafRef.current !== null) {
        window.cancelAnimationFrame(panRafRef.current);
        panRafRef.current = null;
      }
    };
  }, [clearCombatTimers]);

  useEffect(() => {
    if (screen !== "game" || !state || !matchId || !playerId) {
      return;
    }

    if (dealStartedMatchRef.current === matchId) {
      return;
    }

    dealStartedMatchRef.current = matchId;
    setDealMatchId(matchId);
    setDealStage("objective");
    setDealFlyToHand(false);
    setSetupDeckVisible(true);
    setRevealedTerritories([]);
    setTerritoryFlipCount(0);

    const shuffled = [...ownedTerritoryIds].sort(() => Math.random() - 0.5);
    setDealtTerritoryOrder(shuffled);
    const objectiveRevealMs = 5000;
    const territoryDealStartMs = objectiveRevealMs + 140;
    const territoryFlipStepMs = 220;
    const territoryFlipStartMs = territoryDealStartMs + 120;
    const territoryFlipDurationMs = shuffled.length * territoryFlipStepMs;
    const completeStageMs = territoryFlipStartMs + territoryFlipDurationMs + 460;
    const closeOverlayMs = completeStageMs + 1600;
    dealTimerIdsRef.current.forEach(timer => clearTimeout(timer));
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => {
        setDealStage("territories");
        setRevealedTerritories(shuffled);
        setTerritoryFlipCount(0);
      }, territoryDealStartMs)
    );

    for (let i = 0; i < shuffled.length; i++) {
      timers.push(window.setTimeout(() => setTerritoryFlipCount(i + 1), territoryFlipStartMs + i * territoryFlipStepMs));
    }

    timers.push(
      window.setTimeout(() => {
        setDealStage("complete");
        setDealFlyToHand(true);
        setStatus("Distribuzione completata. Puoi iniziare il piazzamento iniziale.");
      }, completeStageMs)
    );

    timers.push(
      window.setTimeout(() => {
        setDealStage("idle");
        setDealFlyToHand(false);
        setTerritoryFlipCount(0);
      }, closeOverlayMs)
    );
    dealTimerIdsRef.current = timers;
  }, [matchId, playerId, screen, state]);

  useEffect(() => {
    if (!setupDeckVisible || !setupComplete || dealStage !== "idle") {
      return;
    }
    setDealtTerritoryOrder(previous => [...previous].sort(() => Math.random() - 0.5));
    setSetupDeckVisible(false);
    setStatus("Setup completato. Carte territorio rimescolate, partita attiva.");
  }, [dealStage, setupComplete, setupDeckVisible]);

  useEffect(() => {
    if (!dealFlyToHand) {
      setDealFlyVectors({});
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      const handRect = handCardsRef.current?.getBoundingClientRect();
      if (!handRect) {
        return;
      }

      const targetX = handRect.left + handRect.width * 0.5;
      const targetY = handRect.top + Math.max(36, Math.min(96, handRect.height * 0.42));
      const count = Math.max(1, revealedTerritories.length);
      const spread = Math.min(260, count * 9);
      const vectors: Record<string, { x: number; y: number; rot: number }> = {};

      for (let index = 0; index < revealedTerritories.length; index++) {
        const id = revealedTerritories[index];
        const cardEl = dealCardRefs.current[id];
        if (!cardEl) {
          continue;
        }
        const rect = cardEl.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        const slot = count === 1 ? 0 : index / (count - 1) - 0.5;
        const xFan = slot * spread;
        const x = targetX + xFan - cx;
        const y = targetY - cy;
        const rot = slot * 26;
        vectors[id] = { x, y, rot };
      }

      setDealFlyVectors(vectors);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [dealFlyToHand, revealedTerritories]);

  useEffect(() => {
    if (screen !== "game") {
      return;
    }

    const computeMinScale = () => {
      const viewport = mapViewportRef.current;
      const image = mapImageRef.current;
      if (!viewport || !image) {
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      if (viewportRect.width <= 0 || viewportRect.height <= 0 || imageRect.width <= 0 || imageRect.height <= 0) {
        return;
      }

      const safeScale = Math.max(0.001, mapScale);
      const baseWidth = imageRect.width / safeScale;
      const baseHeight = imageRect.height / safeScale;
      if (baseWidth <= 0 || baseHeight <= 0) {
        return;
      }

      const fitScale = Math.max(viewportRect.width / baseWidth, viewportRect.height / baseHeight);
      // Keep map readable but allow more zoom-out than full-fit.
      const strictMinScale = fitScale * 0.74;
      const nextMin = clamp(strictMinScale, 0.35, 2.2);
      setMapMinScale(previous => (Math.abs(previous - nextMin) < 0.005 ? previous : nextMin));
      setMapScale(previous => (previous < nextMin ? nextMin : previous));
    };

    const rafId = window.requestAnimationFrame(computeMinScale);
    const resizeHandler = () => computeMinScale();
    window.addEventListener("resize", resizeHandler);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeHandler);
    };
  }, [mapScale, screen]);

  const createLobby = async () => {
    try {
      const payload = await postJson<CreateRoomResponse>(`${hostUrl}/api/rooms`, {
        hostPeerId: hostPeerId.trim(),
        hostDisplayName: hostDisplayName.trim(),
        mapId: "world-classic",
        roomName: roomName.trim()
      });
      setRoomId(payload.roomId);
      setPeerId(hostPeerId.trim());
      setPlayerId(hostPeerId.trim());
      setRoomSnapshot({
        roomId: payload.roomId,
        roomName: payload.roomName,
        hostPeerId: payload.hostPeerId,
        mapId: payload.mapId,
        status: payload.status,
        activeMatchId: null,
        participants: payload.participants
      });
      setStatus(`Lobby creata: ${payload.roomName} (${payload.roomId})`);
      setScreen("hostLobby");
    } catch (error) {
      setStatus(`Creazione lobby fallita: ${(error as Error).message}`);
    }
  };

  const joinLobby = async (selectedRoomId: string) => {
    try {
      const payload = await postJson<JoinRoomResponse>(`${hostUrl}/api/rooms/${encodeURIComponent(selectedRoomId)}/join`, {
        peerId: joinPeerId.trim(),
        displayName: joinDisplayName.trim()
      });
      setRoomId(payload.roomId);
      setPeerId(joinPeerId.trim());
      setPlayerId(joinPeerId.trim());
      setRoomSnapshot({
        roomId: payload.roomId,
        roomName: payload.roomName,
        hostPeerId: payload.hostPeerId,
        mapId: payload.mapId,
        status: payload.status,
        activeMatchId: payload.activeMatchId ?? null,
        participants: payload.participants
      });
      setStatus(`Entrato nella lobby: ${payload.roomName}`);
      if (payload.activeMatchId) {
        setMatchId(payload.activeMatchId);
        setSyncOn(true);
        setScreen("game");
      } else {
        setScreen("joinLobby");
      }
    } catch (error) {
      setStatus(`Ingresso fallito: ${(error as Error).message}`);
    }
  };

  const startMatch = async () => {
    if (!roomId) {
      setStatus("Nessuna lobby selezionata.");
      return;
    }
    try {
      const payload = await postJson<StartMatchResponse>(`${hostUrl}/api/rooms/${encodeURIComponent(roomId)}/start`, {
        hostPeerId: hostPeerId.trim(),
        mapId: "world-classic",
        rngSeed: 12345
      });
      setMatchId(payload.matchId);
      setSyncOn(true);
      setScreen("game");
      setStatus(`Partita avviata: ${payload.matchId}`);
    } catch (error) {
      setStatus(`Avvio fallito: ${(error as Error).message}`);
    }
  };

  async function submitCommand(type: string, payload: Record<string, unknown>) {
    if (!matchId || !playerId || !peerId) {
      setStatus("ID partita, ID peer e ID giocatore sono obbligatori.");
      return;
    }
    try {
      const response = await fetch(`${hostUrl}/api/matches/${encodeURIComponent(matchId)}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peerId,
          type,
          payload: {
            playerId,
            commandId: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            ...payload
          }
        })
      });
      const text = await response.text();
      let body: SubmitCommandResponse | null = null;
      if (text) {
        body = JSON.parse(text) as SubmitCommandResponse;
      }
      if (!response.ok || !body || !body.accepted) {
        const code = body?.errorCode ?? -1;
        const message = body?.message ?? `HTTP ${response.status}`;
        setStatus(`Comando rifiutato (${code} - ${commandErrorLabel(code)}): ${message}`);
        return;
      }
      setStatus(`Comando accettato (${commandLabel(type)}): ${body.appliedEventCount} eventi.`);
      if (type.toLowerCase() === "attack" && body.attackResolution) {
        showCombatResolutionPopup(body.attackResolution);
      }
    } catch (error) {
      setStatus(`Errore comando: ${(error as Error).message}`);
    }
  }

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text) {
      return;
    }
    if (!roomId || !peerId) {
      setStatus("Chat non disponibile: roomId/peerId mancanti.");
      return;
    }
    try {
      const displayName = state?.players.find(player => player.playerId === playerId)?.displayName
        || roomSnapshot?.participants.find(participant => participant.peerId === peerId)?.displayName
        || playerId
        || peerId;

      await postJson<HostEventMessage>(
        `${hostUrl}/api/rooms/${encodeURIComponent(roomId)}/host/${encodeURIComponent(peerId)}/events`,
        {
          type: "chat_message",
          payload: JSON.stringify({
            authorPeerId: peerId,
            authorDisplayName: displayName,
            text,
            sentAtUtc: new Date().toISOString()
          } satisfies ChatEventPayload)
        }
      );
      setChatInput("");
    } catch (error) {
      setStatus(`Invio chat fallito: ${(error as Error).message}`);
    }
  };

  const zoomBy = (delta: number, clientX?: number, clientY?: number) => {
    const viewport = mapViewportRef.current;
    if (!viewport) {
      setMapScale(current => {
        const next = clamp(current + delta, mapMinScale, 4);
        return Math.round(next * 100) / 100;
      });
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const pointerX = clientX ?? rect.left + rect.width / 2;
    const pointerY = clientY ?? rect.top + rect.height / 2;
    const pointInViewportX = pointerX - rect.left;
    const pointInViewportY = pointerY - rect.top;
    const viewportCenterX = rect.width / 2;
    const viewportCenterY = rect.height / 2;

    setMapScale(currentScale => {
      const nextScale = Math.round(clamp(currentScale + delta, mapMinScale, 4) * 100) / 100;
      if (nextScale === currentScale) {
        return currentScale;
      }

      const currentWorldWidth = mapImageRef.current?.clientWidth ?? (Math.min(rect.width * 0.92, MAX_MAP_DISPLAY_WIDTH) * Math.max(0.1, currentScale));
      const baseMapWidth = currentWorldWidth / Math.max(0.1, currentScale);
      const mapWorldWidth = baseMapWidth * Math.max(0.1, nextScale);

      setMapOffset(currentOffset => {
        const localX = (pointInViewportX - viewportCenterX - currentOffset.x) / currentScale;
        const localY = (pointInViewportY - viewportCenterY - currentOffset.y) / currentScale;
        const nextX = pointInViewportX - viewportCenterX - localX * nextScale;
        const nextY = pointInViewportY - viewportCenterY - localY * nextScale;
        return {
          x: normalizeLoopedOffsetX(nextX, mapWorldWidth),
          y: Math.round(nextY)
        };
      });

      return nextScale;
    });
  };

  useEffect(() => {
    const mapWorldWidth = mapImageRef.current?.clientWidth
      ?? (Math.min((mapViewportRef.current?.clientWidth ?? window.innerWidth) * 0.92, MAX_MAP_DISPLAY_WIDTH) * Math.max(0.1, mapScale));
    setMapOffset(current => ({
      x: normalizeLoopedOffsetX(current.x, mapWorldWidth),
      y: current.y
    }));
  }, [mapScale]);

  const toggleTradeCard = (cardId: string) => {
    setSelectedTradeCardIds(current => {
      if (current.includes(cardId)) {
        return current.filter(id => id !== cardId);
      }
      if (current.length >= 3) {
        setStatus("Puoi selezionare massimo 3 carte per il tris.");
        return current;
      }
      return [...current, cardId];
    });
  };

  const renderObjectiveCard = (compact = false) => (
    <div className={`objective-svg-card ${compact ? "compact" : "reveal"}`}>
      <div className="objective-svg-surface" dangerouslySetInnerHTML={{ __html: OBJECTIVE_CARD_BASE }} />
      <div className="objective-svg-overlay">
        <h4>{myObjective?.title ?? "Carta Obiettivo"}</h4>
        <p>{myObjective?.description ?? "Obiettivo assegnato."}</p>
      </div>
    </div>
  );

  const renderTerritoryCard = (territoryId: string) => {
    const templateUrl = templateForTerritoryCard(territoryId);
    const pngUrl = territoryCardImageById[territoryId] ?? pngForTerritoryCard(territoryId);
    if (!templateUrl && !pngUrl) {
      return (
        <div className="hand-card">
          <span className="hand-card-short">{labelForTerritory(territoryId).slice(0, 3).toUpperCase()}</span>
          <span className="hand-card-full">{labelForTerritory(territoryId)}</span>
        </div>
      );
    }
    if (templateUrl) {
      return (
        <div className="territory-svg-card">
          <img src={templateUrl} alt={labelForTerritory(territoryId)} className="territory-card-template" draggable={false} />
        </div>
      );
    }
    return (
      <div className="territory-svg-card">
        {pngUrl ? (
          <div className="territory-card-territory-window" aria-hidden>
            <img src={pngUrl} alt="" className="territory-card-territory-image" draggable={false} />
          </div>
        ) : null}
      </div>
    );
  };

  const renderFlipCard = (front: JSX.Element, back: JSX.Element, className = "", animationDelayMs = 0) => {
    const style = { ["--flip-delay-ms" as string]: `${animationDelayMs}ms` } as CSSProperties;
    return (
      <div className={`flip-card ${className}`.trim()} style={style}>
        <div className="flip-card-inner">
          <div className="flip-face flip-back">{back}</div>
          <div className="flip-face flip-front">{front}</div>
        </div>
      </div>
    );
  };

  if (screen === "splash") {
    return (
      <main className="splash-shell">
        <div className="splash-card">
          <h1>RisiKo!</h1>
          <p>Partita Obiettivo in rete</p>
          <div className="splash-loader" />
        </div>
      </main>
    );
  }

  if (screen === "portal") {
    return (
      <main className="menu-shell">
        <section className="menu-hero">
          <h1>Lobby RisiKo!</h1>
          <p>L'host crea una lobby. Chi entra vede la lista server e si unisce con un clic.</p>
        </section>
        <section className="menu-grid">
          <article className="menu-card">
            <h2>Crea Lobby</h2>
            <label className="field">
              URL host
              <input value={hostUrl} onChange={event => setHostUrl(event.target.value)} />
            </label>
            <label className="field">
              Nome lobby
              <input value={roomName} onChange={event => setRoomName(event.target.value)} />
            </label>
            <label className="field">
              Nome host
              <input value={hostDisplayName} onChange={event => setHostDisplayName(event.target.value)} />
            </label>
            <label className="field">
              Peer ID host
              <input value={hostPeerId} onChange={event => setHostPeerId(event.target.value)} />
            </label>
            <button type="button" className="btn-primary" onClick={createLobby}>
              Crea lobby
            </button>
          </article>
          <article className="menu-card">
            <h2>Entra</h2>
            <label className="field">
              Nome giocatore
              <input value={joinDisplayName} onChange={event => setJoinDisplayName(event.target.value)} />
            </label>
            <label className="field">
              Peer ID giocatore
              <input value={joinPeerId} onChange={event => setJoinPeerId(event.target.value)} />
            </label>
            <div className="menu-button-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  try {
                    const rooms = await getJson<RoomLobbySummary[]>(`${hostUrl}/api/rooms`);
                    setAvailableRooms(rooms.filter(room => room.status === "open"));
                  } catch (error) {
                    setStatus(`Errore elenco stanze: ${(error as Error).message}`);
                  }
                }}
              >
                Aggiorna stanze
              </button>
            </div>
            <ul className="participants-list">
              {availableRooms.length === 0 ? <li>Nessuna lobby aperta.</li> : null}
              {availableRooms.map(room => (
                <li key={room.roomId}>
                  <strong>{room.roomName}</strong> <code>{room.roomId}</code> ({room.playerCount}/{room.maxPlayers})
                  <div className="button-row">
                    <button type="button" className="btn-secondary" onClick={() => joinLobby(room.roomId)}>
                      Entra
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </section>
        <footer className="menu-status">{status}</footer>
      </main>
    );
  }

  if (screen === "hostLobby" || screen === "joinLobby") {
    return (
      <main className="menu-shell">
        <section className="menu-hero">
          <h1>{roomSnapshot?.roomName ?? "Lobby"}</h1>
          <p>
            Stanza: <code>{roomId}</code> | Host: <code>{roomSnapshot?.hostPeerId ?? "-"}</code>
          </p>
        </section>
        <section className="menu-grid">
          <article className="menu-card">
            <h2>Giocatori</h2>
            <ul className="participants-list">
              {(roomSnapshot?.participants ?? []).map(participant => (
                <li key={participant.peerId}>
                  {participant.displayName} <code>{participant.peerId}</code>
                </li>
              ))}
            </ul>
            <p>Minimo giocatori per iniziare: 2</p>
            <p>Attuali: {roomSnapshot?.participants.length ?? 0}</p>
          </article>
          <article className="menu-card">
            <h2>Controlli lobby</h2>
            <label className="field">
              URL host
              <input value={hostUrl} onChange={event => setHostUrl(event.target.value)} />
            </label>
            <label className="field">
              ID peer
              <input value={peerId} onChange={event => setPeerId(event.target.value)} />
            </label>
            <label className="field">
              ID giocatore
              <input value={playerId} onChange={event => setPlayerId(event.target.value)} />
            </label>
            <div className="menu-button-row">
              <button
                type="button"
                className="btn-primary"
                onClick={startMatch}
                disabled={!isHostInLobby || (roomSnapshot?.participants.length ?? 0) < 2}
              >
                Avvia partita
              </button>
              <button type="button" className="btn-secondary" onClick={() => setScreen("portal")}>
                Indietro
              </button>
            </div>
            {!isHostInLobby ? <p>In attesa che l'host avvii la partita...</p> : null}
          </article>
        </section>
        <footer className="menu-status">{status}</footer>
      </main>
    );
  }

  return (
    <main className="arena-shell">
      <div className="arena-map-layer">
        <div
          ref={mapViewportRef}
          className="arena-map-viewport"
          onWheel={event => {
            event.preventDefault();
            zoomBy(event.deltaY > 0 ? -0.08 : 0.08, event.clientX, event.clientY);
          }}
          onMouseDown={event => {
            setIsPanning(true);
            panMovedRef.current = false;
            setPanStart({ x: event.clientX - mapOffset.x, y: event.clientY - mapOffset.y });
          }}
          onMouseMove={event => {
            if (!isPanning) {
              return;
            }
            if (Math.abs(event.clientX - (panStart.x + mapOffset.x)) > 2 || Math.abs(event.clientY - (panStart.y + mapOffset.y)) > 2) {
              panMovedRef.current = true;
            }
            schedulePanOffset(event.clientX - panStart.x, event.clientY - panStart.y);
          }}
          onMouseUp={() => {
            setIsPanning(false);
            if (pendingPanOffsetRef.current) {
              const next = pendingPanOffsetRef.current;
              pendingPanOffsetRef.current = null;
              setMapOffset(next);
            }
            if (panRafRef.current !== null) {
              window.cancelAnimationFrame(panRafRef.current);
              panRafRef.current = null;
            }
          }}
          onMouseLeave={() => {
            setIsPanning(false);
            if (pendingPanOffsetRef.current) {
              const next = pendingPanOffsetRef.current;
              pendingPanOffsetRef.current = null;
              setMapOffset(next);
            }
            if (panRafRef.current !== null) {
              window.cancelAnimationFrame(panRafRef.current);
              panRafRef.current = null;
            }
          }}
          onClick={handleMapSurfaceClick}
        >
          <div
            className="arena-map-stage"
            style={{
              transform: `translate(calc(-50% + ${mapOffset.x}px), calc(-50% + ${mapOffset.y}px))`,
              ["--map-scale" as string]: mapScale
            }}
          >
            <img ref={mapImageRef} src={mapBoardImageUrl} alt="Mappa Risiko" className="arena-map-board-image" draggable={false} />
            {mapBorderOverlayUrl ? (
              <img src={mapBorderOverlayUrl} alt="" className="arena-map-board-image map-borders-overlay-image" draggable={false} />
            ) : null}
            {seaConnectionPaths.length ? (
              <svg className="map-sea-overlay" viewBox={mapViewBox} preserveAspectRatio="xMidYMid meet">
                {seaConnectionPaths.map(path => (
                  <path key={`sea-base-${path.key}`} d={path.d} className="sea-link sea-link-base" />
                ))}
                {seaConnectionPaths.map(path => (
                  <path key={`sea-top-${path.key}`} d={path.d} className="sea-link sea-link-top" />
                ))}
              </svg>
            ) : null}
            <svg className="map-attack-overlay" viewBox={mapViewBox} preserveAspectRatio="xMidYMid meet">
              {attackPreviewLines.map(line => (
                <line
                  key={line.key}
                  className={`attack-link ${line.selected ? "selected" : ""}`}
                  x1={line.fromX}
                  y1={line.fromY}
                  x2={line.toX}
                  y2={line.toY}
                />
              ))}
            </svg>
            <svg className="map-selection-overlay" viewBox={mapViewBox} preserveAspectRatio="xMidYMid meet">
              {vectorTerritoryMap && selectionPathSpecs.length ? (
                <g transform={`scale(${vectorScaleX} ${vectorScaleY})`}>
                  {selectionPathSpecs.flatMap(spec => (
                    (vectorTerritoryMap.pathsById[spec.territoryId] ?? []).map((d, index) => (
                      <path key={`${spec.variant}-${spec.territoryId}-${index}`} d={d} className={`selection-path ${spec.variant}`} />
                    ))
                  ))}
                </g>
              ) : null}
              {currentPhase === "attack" && attackFromId && overlayById.has(attackFromId) ? (
                <g
                  className="selected-source-marker"
                  transform={`translate(${overlayById.get(attackFromId)!.centerX} ${overlayById.get(attackFromId)!.centerY})`}
                >
                  <circle r={Math.max(18, overlayById.get(attackFromId)!.chipRadius + 7)} />
                  <circle r={Math.max(24, overlayById.get(attackFromId)!.chipRadius + 13)} />
                </g>
              ) : null}
            </svg>
            <svg className="map-owner-overlay" viewBox={mapViewBox} preserveAspectRatio="xMidYMid meet">
          {regionOverlays.map(overlay => {
                const territory = state?.territories?.[overlay.id];
                if (!territory) {
                  return null;
                }
                const ownerColor = playerColorById[territory.ownerPlayerId] ?? "#7f92a5";
                const ownerIndex = state?.players.findIndex(player => player.playerId === territory.ownerPlayerId) ?? -1;
                const tankAsset = ownerIndex >= 0 ? PLAYER_TANK_ASSETS[ownerIndex % PLAYER_TANK_ASSETS.length] : null;
                const chipRenderRadius = overlay.chipRadius * chipReadabilityScale;
                const counterRadius = Math.max(4.2, chipRenderRadius * 0.4);
                return (
                  <g key={`owner-${overlay.id}-${territory.armies}-${territory.ownerPlayerId}`} className="map-owner-chip" transform={`translate(${overlay.centerX} ${overlay.chipY})`}>
                    <circle cx="0" cy="0" r={chipRenderRadius} fill={ownerColor} />
                    {tankAsset ? (
                      <image
                        href={tankAsset}
                        x={-chipRenderRadius * 0.95}
                        y={-chipRenderRadius * 0.92}
                        width={chipRenderRadius * 1.9}
                        height={chipRenderRadius * 1.9}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    ) : null}
                    <g className="map-owner-count" transform={`translate(${chipRenderRadius * 0.56} ${-chipRenderRadius * 0.54})`}>
                      <circle r={counterRadius} />
                      <text y={counterRadius * 0.03} style={{ fontSize: `${Math.max(7.2, chipRenderRadius * 0.76)}px` }}>
                        {territory.armies}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
            <svg className="map-label-overlay" viewBox={mapViewBox} preserveAspectRatio="xMidYMid meet">
              <defs>
                {regionOverlays
                  .filter(overlay => !!overlay.labelCurvePath)
                  .map(overlay => (
                    <path key={`label-curve-${overlay.id}`} id={`label-curve-${overlay.id}`} d={overlay.labelCurvePath} />
                  ))}
              </defs>
              {regionOverlays.map(overlay => {
                const scaledFontSize = Math.max(8.4, overlay.labelFontSize * overlay.labelFontScale * textReadabilityScale);
                const textStrokeWidth = clamp(1.06 * textReadabilityScale, 1.02, 1.85);
                if (overlay.labelCurvePath) {
                  return (
                    <text
                      key={overlay.id}
                      style={{ fontSize: `${scaledFontSize}px`, strokeWidth: `${textStrokeWidth}px` }}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <textPath href={`#label-curve-${overlay.id}`} startOffset="50%">
                        {overlay.labelCurveText ?? overlay.text}
                      </textPath>
                    </text>
                  );
                }
                return (
                  <text
                    key={overlay.id}
                    x={overlay.labelX}
                    y={overlay.labelY}
                    style={{ fontSize: `${scaledFontSize}px`, strokeWidth: `${textStrokeWidth}px` }}
                    transform={overlay.labelRotation ? `rotate(${overlay.labelRotation} ${overlay.labelX} ${overlay.labelY})` : undefined}
                  >
                    {overlay.textLines.map((line, index) => {
                      const lineOffset = (index - (overlay.textLines.length - 1) / 2) * scaledFontSize * 1.12;
                      return (
                        <tspan key={`${overlay.id}-line-${index}`} x={overlay.labelX} dy={index === 0 ? lineOffset : scaledFontSize * 1.12}>
                          {line}
                        </tspan>
                      );
                    })}
                  </text>
                );
              })}
            </svg>
            {canPlaceFromMap ? (
              <svg className="map-reinforce-overlay" viewBox={mapViewBox} preserveAspectRatio="xMidYMid meet">
                {regionOverlays.map(overlay => {
                  const territory = state?.territories?.[overlay.id];
                  if (!territory || territory.ownerPlayerId !== playerId) {
                    return null;
                  }
                  const buttonRadius = Math.max(2.8, overlay.chipRadius * 0.26);
                  const controlOffsetX = overlay.chipRadius + buttonRadius + Math.max(1.2, overlay.chipRadius * 0.1);
                  const controlY = overlay.chipY;
                  const canAdd = canPlaceFromMap && (state?.reinforcementsAvailable ?? 0) > 0;
                  return (
                    <g key={`reinforce-${overlay.id}`} className="reinforce-controls">
                      <g
                        className="reinforce-svg-btn minus is-disabled"
                        transform={`translate(${overlay.centerX - controlOffsetX} ${controlY})`}
                      >
                        <circle r={buttonRadius} />
                        <text y={buttonRadius * 0.08}>-</text>
                      </g>
                      <g
                        className={`reinforce-svg-btn plus ${canAdd ? "" : "is-disabled"}`.trim()}
                        transform={`translate(${overlay.centerX + controlOffsetX} ${controlY})`}
                        onClick={event => {
                          event.stopPropagation();
                          if (!canAdd) {
                            return;
                          }
                          placeReinforcementFromMap(overlay.id, 1);
                        }}
                      >
                        <circle r={buttonRadius} />
                        <text y={buttonRadius * 0.08}>+</text>
                      </g>
                    </g>
                  );
                })}
              </svg>
            ) : null}
          </div>
          <div className="map-zoom-tools">
            <button type="button" className="btn-secondary" onClick={() => zoomBy(0.12)}>
              +
            </button>
            <button type="button" className="btn-secondary" onClick={() => zoomBy(-0.12)}>
              -
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setMapScale(mapMinScale); setMapOffset({ x: 0, y: 0 }); }}>
              Reimposta
            </button>
          </div>
        </div>
      </div>

      <header className="arena-topbar">
        <div className="turn-banner">
          <strong>{state?.turnIndex ?? "-"}</strong> | {isMyTurn ? "Il tuo turno" : `Turno di: ${activePlayerLabel}`} | Fase:{" "}
          {phaseLabel(currentPhase)}
        </div>
        <button type="button" className="btn-secondary" onClick={() => setScreen("portal")}>
          Esci
        </button>
      </header>

      <aside className="arena-left">
        <ul className="player-token-list">
          {playerRows.map(row => (
            <li key={row.player.playerId} className={`player-token ${row.player.playerId === state?.activePlayerId ? "is-active-player" : ""}`}>
              <div className="player-card-tab">
                <img
                  src={row.cardAsset}
                  alt={`Carta giocatore ${row.player.displayName}`}
                  className="player-card-image"
                  draggable={false}
                />
                <span className="player-card-chip" style={{ backgroundColor: row.color }}>
                  <img src={row.tankAsset} alt="" className="player-card-chip-icon" draggable={false} />
                </span>
              </div>
              <div className="player-hover-card">
                <strong>{row.player.displayName}</strong> <code>{row.player.playerId}</code>
                <p>Territori: {row.owned}</p>
                <p>Carte: {row.cardCount}</p>
                <p>Piazzabili ora: {row.placeableNow}</p>
                <p>Prossimo turno: {row.nextRound}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <aside className="arena-chat-dock">
        <div className="chat-log">
          {chatMessages.length === 0 ? <p className="muted">Nessun messaggio.</p> : null}
          {chatMessages.map(message => (
            <p key={message.id}>
              <strong>{message.author}</strong> [{message.at}]<br />
              {message.text}
            </p>
          ))}
        </div>
        <div className="chat-send">
          <input value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder="Scrivi un messaggio..." />
          <button type="button" className="btn-secondary" onClick={sendChatMessage}>
            Invia
          </button>
        </div>
      </aside>

      <section className="arena-command-hud">
        <div className="arena-command-top compact">
          <span>Fase: <strong>{phaseLabel(currentPhase)}</strong></span>
          {currentPhase === "reinforcement" || currentPhase === "setup" ? (
            <span>Rinforzi: <strong>{state?.reinforcementsAvailable ?? 0}</strong></span>
          ) : null}
          {hoverTerritoryId ? (
            <span>Territorio: <strong>{hoveredTerritoryLabel}</strong></span>
          ) : null}
        </div>

        {currentPhase === "reinforcement" ? (
          <section className="trade-panel">
            <h4>Cambia Tris</h4>
            <p className="muted">Selezione: {selectedTradeCardIds.length}/3</p>
            <p className="muted">{trisEvaluation.reason}</p>
            {trisEvaluation.valid ? (
              <p className="muted"><strong>Bonus: {trisTotalBonus}</strong> ({trisEvaluation.baseBonus} base + {ownedTerritoryTradeBonus} territorio)</p>
            ) : null}
            <div className="button-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedTradeCardIds([])}
                disabled={selectedTradeCardIds.length === 0}
              >
                Pulisci
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  submitCommand("PlayCards", { cardIds: selectedTradeCardIds });
                  setSelectedTradeCardIds([]);
                }}
                disabled={!isMyTurn || currentPhase !== "reinforcement" || !trisEvaluation.valid}
              >
                Conferma Tris
              </button>
            </div>
          </section>
        ) : null}

        {(currentPhase === "setup" || currentPhase === "reinforcement") ? (
          <div className="arena-command-row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => submitCommand("EndTurn", {})}
              disabled={
                !isMyTurn ||
                currentPhase === "setup" ||
                hasPendingCaptureMove ||
                (currentPhase === "reinforcement" && (state?.reinforcementsAvailable ?? 0) > 0)
              }
            >
              Fine / Prossimo
            </button>
          </div>
        ) : null}

        {currentPhase === "attack" ? (
          <div className="arena-command-row">
            <select value={attackFromId} onChange={event => setAttackFromId(event.target.value)}>
              <option value="">Sorgente attacco</option>
              {attackSourceOptions.map(territory => (
                <option key={territory.territoryId} value={territory.territoryId}>
                  {labelForTerritory(territory.territoryId)}
                </option>
              ))}
            </select>
            <select value={attackToId} onChange={event => setAttackToId(event.target.value)}>
              <option value="">{attackFromId ? "Bersaglio attacco" : "Scegli prima la sorgente"}</option>
              {attackTargetOptions.map(territory => (
                <option key={territory.territoryId} value={territory.territoryId}>
                  {labelForTerritory(territory.territoryId)}
                </option>
              ))}
            </select>
            <select value={attackDice} onChange={event => setAttackDice(Number(event.target.value))}>
              {attackDiceOptions.map(value => (
                <option key={value} value={value}>
                  Dadi: {value}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => submitCommand("Attack", { fromTerritoryId: attackFromId, toTerritoryId: attackToId, attackerDice: attackDice })}
              disabled={!isMyTurn || currentPhase !== "attack" || hasPendingCaptureMove || !attackFromId || !attackToId}
            >
              Attacca
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => submitCommand("EndTurn", {})}
              disabled={!isMyTurn || hasPendingCaptureMove}
            >
              Fine Attacchi
            </button>
          </div>
        ) : null}

        {currentPhase === "fortify" ? (
          <div className="arena-command-row">
            <select value={fortifyFromId} onChange={event => setFortifyFromId(event.target.value)}>
              <option value="">Da territorio</option>
              {fortifySourceOptions.map(territory => (
                <option key={territory.territoryId} value={territory.territoryId}>
                  {labelForTerritory(territory.territoryId)}
                </option>
              ))}
            </select>
            <select value={fortifyToId} onChange={event => setFortifyToId(event.target.value)}>
              <option value="">A territorio</option>
              {fortifyTargetOptions.map(territory => (
                <option key={territory.territoryId} value={territory.territoryId}>
                  {labelForTerritory(territory.territoryId)}
                </option>
              ))}
            </select>
            <input type="number" min={1} value={fortifyArmies} onChange={event => setFortifyArmies(Math.max(1, Number(event.target.value) || 1))} />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => submitCommand("Fortify", { fromTerritoryId: fortifyFromId, toTerritoryId: fortifyToId, armiesToMove: fortifyArmies })}
              disabled={!isMyTurn || !!state?.fortifyUsedThisTurn || !fortifyFromId || !fortifyToId}
            >
              Conferma Movimento
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => submitCommand("EndTurn", {})}
              disabled={!isMyTurn}
            >
              Termina Turno
            </button>
            {state?.fortifyUsedThisTurn ? <span className="muted">Movimento di fine turno gia usato.</span> : null}
          </div>
        ) : null}
      </section>

      <p className="arena-status-pill">{status}</p>

      <footer className="arena-bottom">
        <div className="hand-strip">
          <div className="hand-title">
            <strong>Le tue carte</strong> ({handCount}) | Obiettivo: {myObjective?.title ?? "-"}{" "}
            {objectiveProgressLabel ? `| ${objectiveProgressLabel}` : ""}
          </div>
          <div className={`hand-cards ${dealStage === "complete" ? "is-receiving" : ""}`} ref={handCardsRef}>
            {!hideHandDuringDeal ? renderObjectiveCard(true) : null}
            {!hideHandDuringDeal && setupDeckVisible && (dealStage === "idle" || dealStage === "complete") && dealtTerritoryOrder.length > 0
              ? dealtTerritoryOrder.map((id, index) => (
                  <div
                    key={`setup-${id}`}
                    className={`hand-card svg-wrap ${dealStage === "complete" ? "is-incoming" : ""}`.trim()}
                    style={{ ["--hand-index" as string]: `${index}` } as CSSProperties}
                  >
                    {renderTerritoryCard(id)}
                  </div>
                ))
              : null}
            {!hideHandDuringDeal && !setupDeckVisible && myCards.length === 0 ? <span className="muted">Nessuna carta.</span> : null}
            {!hideHandDuringDeal && !setupDeckVisible
              ? myCards.map(cardId => {
                  if (cardId.startsWith("territory:")) {
                    const territoryId = cardId.replace("territory:", "");
                    const symbol = state?.cardSymbolById?.[cardId] ?? "";
                    return (
                      <div
                        key={cardId}
                        className={`hand-card svg-wrap ${currentPhase === "reinforcement" && isMyTurn ? "is-selectable" : ""} ${selectedTradeCardIds.includes(cardId) ? "is-selected" : ""}`.trim()}
                        onClick={() => {
                          if (currentPhase === "reinforcement" && isMyTurn) {
                            toggleTradeCard(cardId);
                          }
                        }}
                        title={symbol ? `${labelForTerritory(territoryId)} • ${cardSymbolLabel(symbol)}` : labelForTerritory(territoryId)}
                      >
                        {renderTerritoryCard(territoryId)}
                      </div>
                    );
                  }
                  if (cardId.startsWith("joker")) {
                    return (
                      <div
                        key={cardId}
                        className={`hand-card svg-wrap ${currentPhase === "reinforcement" && isMyTurn ? "is-selectable" : ""} ${selectedTradeCardIds.includes(cardId) ? "is-selected" : ""}`.trim()}
                        onClick={() => {
                          if (currentPhase === "reinforcement" && isMyTurn) {
                            toggleTradeCard(cardId);
                          }
                        }}
                        title="Jolly"
                      >
                        <div className="territory-svg-card" dangerouslySetInnerHTML={{ __html: jokerCardRaw }} />
                      </div>
                    );
                  }
                  const symbol = state?.cardSymbolById?.[cardId] ?? "";
                  return (
                    <div
                      key={cardId}
                      className={`hand-card ${currentPhase === "reinforcement" && isMyTurn ? "is-selectable" : ""} ${selectedTradeCardIds.includes(cardId) ? "is-selected" : ""}`.trim()}
                      onClick={() => {
                        if (currentPhase === "reinforcement" && isMyTurn) {
                          toggleTradeCard(cardId);
                        }
                      }}
                      title={symbol ? `${prettyCardName(cardId)} • ${cardSymbolLabel(symbol)}` : prettyCardName(cardId)}
                    >
                      <span className="hand-card-short">{prettyCardName(cardId).slice(0, 3).toUpperCase()}</span>
                      <span className="hand-card-full">{prettyCardName(cardId)}</span>
                    </div>
                  );
                })
              : null}
          </div>
        </div>
      </footer>

      {combatPopup?.visible ? (
        <div className="combat-overlay">
          <section className={`combat-popup ${combatPopup.rolling ? "rolling" : "resolved"}`}>
            <header className="combat-popup-head">
              <h3>Scontro Dadi</h3>
                <small>
                  {labelForTerritory(combatPopup.fromTerritoryId)} {"->"} {labelForTerritory(combatPopup.toTerritoryId)}
                </small>
            </header>
            <div className="combat-columns">
              <article className="combat-side attacker">
                <h4>Attacco: {combatAttackerLabel}</h4>
                <div className="combat-dice-row">
                  {combatPopup.attackerRolls.map((roll, index) => (
                    <div
                      key={`atk-${index}-${roll}`}
                      className={`dice-face d${roll} ${combatDiceOutcome.attacker[index] === "win" ? "dice-win" : ""} ${combatDiceOutcome.attacker[index] === "loss" ? "dice-loss" : ""}`.trim()}
                    >
                      <span>{roll}</span>
                    </div>
                  ))}
                </div>
                <p className="combat-losses">Perdite: {combatPopup.attackerLosses}</p>
              </article>
              <article className="combat-side defender">
                <h4>Difesa: {combatDefenderLabel}</h4>
                <div className="combat-dice-row">
                  {combatPopup.defenderRolls.map((roll, index) => (
                    <div
                      key={`def-${index}-${roll}`}
                      className={`dice-face d${roll} ${combatDiceOutcome.defender[index] === "win" ? "dice-win" : ""} ${combatDiceOutcome.defender[index] === "loss" ? "dice-loss" : ""}`.trim()}
                    >
                      <span>{roll}</span>
                    </div>
                  ))}
                </div>
                <p className="combat-losses">Perdite: {combatPopup.defenderLosses}</p>
              </article>
            </div>
            <footer className="combat-popup-foot">
              {combatPopup.rolling ? "Lancio in corso..." : "Risoluzione completata"}
            </footer>
          </section>
        </div>
      ) : null}

      {hasPendingCaptureMove && isMyTurn && captureMoveReady ? (
        <div className="capture-move-overlay">
          <section className="capture-move-popup">
            <header>
              <h3>Territorio Conquistato</h3>
              <small>
                {labelForTerritory(pendingCaptureFrom)} {"->"} {labelForTerritory(pendingCaptureTo)}
              </small>
            </header>
            <p>Scegli quante armate spostare nel territorio conquistato.</p>
            <div className="capture-move-stepper">
              <button
                type="button"
                className="btn-secondary stepper-btn"
                onClick={() => setCaptureMoveArmies(current => Math.max(pendingCaptureMinArmies, current - 1))}
                disabled={captureMoveArmies <= pendingCaptureMinArmies}
              >
                -
              </button>
              <span className="stepper-value">{captureMoveArmies}</span>
              <button
                type="button"
                className="btn-secondary stepper-btn"
                onClick={() => setCaptureMoveArmies(current => Math.min(pendingCaptureMaxArmies, current + 1))}
                disabled={captureMoveArmies >= pendingCaptureMaxArmies}
              >
                +
              </button>
            </div>
            <small>
              Min: {pendingCaptureMinArmies} | Max: {pendingCaptureMaxArmies}
            </small>
            <div className="button-row">
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  submitCommand("MoveCapturedArmies", {
                    fromTerritoryId: pendingCaptureFrom,
                    toTerritoryId: pendingCaptureTo,
                    armiesToMoveTotal: captureMoveArmies
                  })
                }
              >
                Conferma Spostamento
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {dealStage !== "idle" ? (
        <div className="deal-overlay global">
          {dealStage === "objective" ? (
            <div className="deal-card objective svg no-frame">
              {renderFlipCard(
                renderObjectiveCard(false),
                <div className="objective-svg-card">
                  <div className="objective-svg-surface" dangerouslySetInnerHTML={{ __html: objectiveCardBackRaw }} />
                </div>,
                "flip-in objective"
              )}
              <small>Obiettivo segreto assegnato</small>
            </div>
          ) : null}
          {dealStage === "territories" || dealStage === "complete" ? (
            <div className={`deal-card territories svg ${dealFlyToHand ? "to-hand" : ""}`}>
              <h3>Distribuzione territori</h3>
              <p>{revealedTerritories.length} assegnati</p>
              <div className="deal-territory-grid-shell">
                <div
                  className={`deal-territory-grid ${
                    revealedTerritories.length > 20 ? "is-ultra-dense" : revealedTerritories.length > 15 ? "is-dense" : ""
                  }`.trim()}
                >
                  {revealedTerritories.map((id, index) => {
                    const isNewestFlipping = index === territoryFlipCount - 1;
                    const hasFlipped = index < territoryFlipCount;
                    const flipClass = isNewestFlipping ? "flip-in" : hasFlipped ? "face-up" : "";
                    return (
                      <div
                        key={`deal-${id}`}
                        className={`deal-territory-cell ${isNewestFlipping ? "is-new" : ""}`.trim()}
                        ref={node => {
                          dealCardRefs.current[id] = node;
                        }}
                        style={
                          {
                            ["--deal-index" as string]: `${index}`,
                            ["--fly-x" as string]: `${(dealFlyVectors[id]?.x ?? 0).toFixed(2)}px`,
                            ["--fly-y" as string]: `${(dealFlyVectors[id]?.y ?? 240).toFixed(2)}px`,
                            ["--fly-rot" as string]: `${(dealFlyVectors[id]?.rot ?? 0).toFixed(2)}deg`
                          } as CSSProperties
                        }
                      >
                        {(templateForTerritoryCard(id) || territoryCardImageById[id] || pngForTerritoryCard(id))
                          ? renderFlipCard(
                              renderTerritoryCard(id),
                              <div className="territory-svg-card" dangerouslySetInnerHTML={{ __html: territoryCardBackRaw }} />,
                              flipClass,
                              isNewestFlipping ? 20 : 0
                            )
                          : renderFlipCard(
                              <div className="deal-territory-fallback">{escapeHtml(labelForTerritory(id))}</div>,
                              <div className="territory-svg-card" dangerouslySetInnerHTML={{ __html: territoryCardBackRaw }} />,
                              flipClass,
                              isNewestFlipping ? 20 : 0
                            )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {dealStage === "complete" ? <small>Le carte scorrono nella tua mano...</small> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

export default App;


