#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

from PIL import Image

Point = Tuple[int, int]
Edge = Tuple[Point, Point]

ROOT = Path(__file__).resolve().parents[1]
MAP_JSON = ROOT / "packs" / "maps" / "world-classic" / "map.json"
SVG_OUT = ROOT / "packs" / "maps" / "world-classic" / "map.svg"
UPSCALED_DIR = ROOT / "packs" / "territories-png-upscaled"
BASE_DIR = ROOT / "packs" / "territories-png"
ALPHA_THRESHOLD = 20


def normalize_name(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")


def canonical_edge(a: Point, b: Point) -> Edge:
    return (a, b) if a <= b else (b, a)


def point_line_distance(point: Point, start: Point, end: Point) -> float:
    x, y = point
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    t = ((x - x1) * dx + (y - y1) * dy) / float(dx * dx + dy * dy)
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return ((x - proj_x) ** 2 + (y - proj_y) ** 2) ** 0.5


def rdp(points: Sequence[Point], epsilon: float) -> List[Point]:
    if len(points) <= 2:
        return list(points)
    start = points[0]
    end = points[-1]
    max_dist = -1.0
    max_index = -1
    for i in range(1, len(points) - 1):
        dist = point_line_distance(points[i], start, end)
        if dist > max_dist:
            max_dist = dist
            max_index = i
    if max_dist > epsilon:
        left = rdp(points[: max_index + 1], epsilon)
        right = rdp(points[max_index:], epsilon)
        return left[:-1] + right
    return [start, end]


def simplify_closed_loop(points: List[Point], epsilon: float = 0.8) -> List[Point]:
    if len(points) < 4:
        return points

    # remove exact duplicates and collinear cardinal steps
    filtered: List[Point] = []
    for i in range(len(points)):
        prev = points[(i - 1) % len(points)]
        cur = points[i]
        nxt = points[(i + 1) % len(points)]
        if cur == prev:
            continue
        if (prev[0] == cur[0] == nxt[0]) or (prev[1] == cur[1] == nxt[1]):
            continue
        filtered.append(cur)
    if len(filtered) < 4:
        filtered = points

    open_chain = filtered + [filtered[0]]
    simplified_open = rdp(open_chain, epsilon)
    if len(simplified_open) > 1 and simplified_open[0] == simplified_open[-1]:
        simplified = simplified_open[:-1]
    else:
        simplified = simplified_open
    if len(simplified) < 3:
        return filtered
    return simplified


def trace_loops_from_binary(binary: Image.Image) -> List[List[Point]]:
    width, height = binary.size
    pix = binary.load()
    edges: set[Edge] = set()
    adjacency: Dict[Point, set[Point]] = defaultdict(set)

    def is_inside(x: int, y: int) -> bool:
        if x < 0 or y < 0 or x >= width or y >= height:
            return False
        return pix[x, y] > 0

    def add_edge(a: Point, b: Point) -> None:
        edge = canonical_edge(a, b)
        if edge in edges:
            return
        edges.add(edge)
        adjacency[a].add(b)
        adjacency[b].add(a)

    for y in range(height):
        for x in range(width):
            if not is_inside(x, y):
                continue
            if not is_inside(x - 1, y):
                add_edge((x, y), (x, y + 1))
            if not is_inside(x + 1, y):
                add_edge((x + 1, y), (x + 1, y + 1))
            if not is_inside(x, y - 1):
                add_edge((x, y), (x + 1, y))
            if not is_inside(x, y + 1):
                add_edge((x, y + 1), (x + 1, y + 1))

    loops: List[List[Point]] = []
    remaining = set(edges)
    while remaining:
        start_edge = next(iter(remaining))
        a, b = start_edge
        remaining.remove(start_edge)
        path: List[Point] = [a, b]
        prev = a
        cur = b
        max_steps = len(edges) * 2 + 64

        for _ in range(max_steps):
            if cur == a:
                break
            candidates = []
            for n in adjacency[cur]:
                e = canonical_edge(cur, n)
                if e in remaining:
                    candidates.append(n)
            if not candidates:
                break
            next_point = candidates[0]
            if len(candidates) > 1:
                non_prev = [n for n in candidates if n != prev]
                if non_prev:
                    next_point = non_prev[0]
            edge = canonical_edge(cur, next_point)
            remaining.remove(edge)
            path.append(next_point)
            prev, cur = cur, next_point

        if len(path) >= 4 and path[0] == path[-1]:
            loops.append(path[:-1])

    return loops


def loops_to_svg_path(loops: Iterable[List[Point]]) -> str:
    commands: List[str] = []
    for loop in loops:
        if len(loop) < 3:
            continue
        commands.append(f"M {loop[0][0]} {loop[0][1]}")
        for x, y in loop[1:]:
            commands.append(f"L {x} {y}")
        commands.append("Z")
    return " ".join(commands)


def main() -> None:
    with MAP_JSON.open("r", encoding="utf-8") as f:
        map_def = json.load(f)
    territory_ids: List[str] = [t["id"] for t in map_def["territories"]]

    source_dir = UPSCALED_DIR if UPSCALED_DIR.exists() else BASE_DIR
    if not source_dir.exists():
        raise RuntimeError("No territory PNG directory found.")

    png_by_id: Dict[str, Path] = {}
    for png in source_dir.glob("*.png"):
        stem = normalize_name(png.stem)
        if stem == "world_map":
            continue
        png_by_id[stem] = png

    missing = [territory_id for territory_id in territory_ids if territory_id not in png_by_id]
    if missing:
        raise RuntimeError(f"Missing PNG files for territories: {', '.join(missing)}")

    first_image = Image.open(png_by_id[territory_ids[0]]).convert("RGBA")
    map_width, map_height = first_image.size

    path_by_id: Dict[str, str] = {}
    for territory_id in territory_ids:
        image = Image.open(png_by_id[territory_id]).convert("RGBA")
        if image.size != (map_width, map_height):
            raise RuntimeError(
                f"Size mismatch for {territory_id}: {image.size}, expected {(map_width, map_height)}"
            )
        alpha = image.split()[3]
        binary = alpha.point(lambda a: 255 if a > ALPHA_THRESHOLD else 0)
        loops = trace_loops_from_binary(binary)
        simplified = [simplify_closed_loop(loop) for loop in loops if len(loop) >= 3]
        path_data = loops_to_svg_path(simplified)
        if not path_data:
            raise RuntimeError(f"No vector path generated for territory: {territory_id}")
        path_by_id[territory_id] = path_data

    lines: List[str] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{map_width}" height="{map_height}" viewBox="0 0 {map_width} {map_height}">',
        '  <defs>',
        '    <style>',
        '      .territory-path { fill: none; stroke: #ffffff; stroke-width: 1; vector-effect: non-scaling-stroke; }',
        '    </style>',
        '  </defs>',
    ]
    for territory_id in territory_ids:
        lines.append(f'  <g id="{territory_id}">')
        lines.append(f'    <path class="territory-path" d="{path_by_id[territory_id]}"/>')
        lines.append("  </g>")
    lines.append("</svg>")
    SVG_OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Generated {SVG_OUT} with {len(territory_ids)} territories.")


if __name__ == "__main__":
    main()
