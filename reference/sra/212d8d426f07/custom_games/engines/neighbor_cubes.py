"""Voisinage / Neighbor Cubes — port of the approved JavaScript prototype.

Python >= 3.10, standard library only. No browser/Node/GUI at runtime.
The pure core uses JSON-compatible dictionaries and retains the web state's
camelCase field names to support direct cross-language regression testing.
NeighborCubesEngine is a custom-backend adapter, not an official ARC SDK class.

Actions: 1 up, 2 down, 3 left, 4 right, 5 next cube, 6 click, 7 level reset.
Frame: 64x64 indices. Logical grid: 11 rows x 15 columns. Palette index 13 is
intentionally overridden to chocolate brown #8B5A2B; see INTEGRATION.md.
"""
from __future__ import annotations

import json
import math
import re
from collections import deque
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Protocol, Sequence

ROWS, COLS, FRAME = 11, 15, 64
DIRS = {"U": (-1, 0), "D": (1, 0), "L": (0, -1), "R": (0, 1)}
ORDER = ("U", "R", "D", "L")
SINGLE = {"U": "B", "R": "R", "D": "Y", "L": "G"}
COLORS = ("M", "R", "Y", "G", "B", "O", "P", "C")
NAMES = {"M": "Marron", "R": "Rouge", "Y": "Jaune", "G": "Vert",
         "B": "Bleu", "O": "Orange", "P": "Violet", "C": "Cyan"}
HEX = {"M": "#8B5A2B", "R": "#F93C31", "Y": "#FFDC00", "G": "#4FCC30",
       "B": "#1E93FF", "O": "#FF851B", "P": "#A356D6", "C": "#88D8F1", ".": "#000000"}
INDEX = {"M": 13, "R": 8, "Y": 11, "G": 14, "B": 9, "O": 12, "P": 15, "C": 10, ".": 5}
PALETTE = ("#FFFFFF", "#CCCCCC", "#999999", "#666666", "#333333", "#000000",
           "#E53AA3", "#FF7BCC", "#F93C31", "#1E93FF", "#88D8F1", "#FFDC00",
           "#FF851B", "#8B5A2B", "#4FCC30", "#A356D6")
PALETTE_OVERRIDES = {13: "#8B5A2B"}
CELL, OX, OY = 4, 2, 2
ACTION_DIRECTIONS = {1: "U", 2: "D", 3: "L", 4: "R"}
DIRECTION_ACTIONS = {v: k for k, v in ACTION_DIRECTIONS.items()}
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "neighbor_cubes" / "levels"
BUTTONS = (
    {"x": 8, "y": 50, "w": 5, "h": 5, "action": {"type": "move", "direction": "U"},
     "glyph": ("..#..", ".###.", "#####", "..#..", "..#..")},
    {"x": 8, "y": 56, "w": 5, "h": 5, "action": {"type": "move", "direction": "D"},
     "glyph": ("..#..", "..#..", "#####", ".###.", "..#..")},
    {"x": 2, "y": 55, "w": 5, "h": 5, "action": {"type": "move", "direction": "L"},
     "glyph": ("..#..", ".##..", "#####", ".##..", "..#..")},
    {"x": 14, "y": 55, "w": 5, "h": 5, "action": {"type": "move", "direction": "R"},
     "glyph": ("..#..", "..##.", "#####", "..##.", "..#..")},
    {"x": 23, "y": 53, "w": 5, "h": 5, "action": {"type": "cycle"},
     "glyph": (".###.", ".#.#.", ".#.#.", ".###.", ".....")},
    {"x": 31, "y": 53, "w": 5, "h": 5, "action": {"type": "reset"},
     "glyph": (".###.", "#...#", "###.#", "#...#", ".###.")},
)


def _is_int(value: Any) -> bool:
    return (type(value) is int or
            (type(value) is float and math.isfinite(value) and value.is_integer()))


def _finite(value: Any) -> bool:
    return type(value) is int or (type(value) is float and math.isfinite(value))


def _text(value: Any) -> str:
    if value is True:
        return "true"
    if value is False:
        return "false"
    if value is None:
        return "null"
    return str(value)


def inside(row: Any, col: Any) -> bool:
    return _is_int(row) and _is_int(col) and 0 <= row < ROWS and 0 <= col < COLS


def bounds(cells: Sequence[Sequence[int]]) -> dict[str, int] | None:
    if not cells:
        return None
    return {"r0": min(p[0] for p in cells), "r1": max(p[0] for p in cells),
            "c0": min(p[1] for p in cells), "c1": max(p[1] for p in cells)}


def validate_level(raw: Any) -> dict[str, Any]:
    """Validate the web JSON schema without modifying the caller's document."""
    if not isinstance(raw, Mapping):
        raise ValueError("Un niveau doit être un objet JSON.")
    level = deepcopy(dict(raw))
    level.update(version=1, id=_text(raw.get("id") or "custom")[:80],
                 name=_text(raw.get("name") or "Niveau personnalisé")[:120],
                 description=_text(raw.get("description") or "")[:600],
                 hint=_text(raw.get("hint") or "")[:1000], board={"rows": ROWS, "cols": COLS})
    if raw.get("board") is not None:
        b = raw["board"]
        if not isinstance(b, Mapping) or b.get("rows") != ROWS or b.get("cols") != COLS:
            raise ValueError(f"La grille doit mesurer {COLS} × {ROWS}.")
    cubes = raw.get("cubes")
    if not isinstance(cubes, list) or not 1 <= len(cubes) <= 24:
        raise ValueError("Prévoir entre 1 et 24 cubes.")
    occupied: set[tuple[int, int]] = set()
    ids: set[str] = set()
    normalized = []
    for i, cube in enumerate(cubes):
        if not isinstance(cube, Mapping) or not inside(cube.get("row"), cube.get("col")):
            raise ValueError(f"Cube {i + 1} hors de la grille.")
        pid = _text(cube["id"] if cube.get("id") is not None else f"c{i + 1}")[:80]
        pos = (int(cube["row"]), int(cube["col"]))
        if pos in occupied:
            raise ValueError("Deux cubes ne peuvent pas occuper la même case.")
        if pid in ids:
            raise ValueError("Les identifiants de cubes doivent être uniques.")
        occupied.add(pos)
        ids.add(pid)
        normalized.append({"id": pid, "row": pos[0], "col": pos[1]})
    level["cubes"] = normalized
    zones = raw.get("zones")
    if not isinstance(zones, list) or not 1 <= len(zones) <= 4:
        raise ValueError("Prévoir entre 1 et 4 zones.")
    used: set[tuple[int, int]] = set()
    zone_ids: set[str] = set()
    normalized_zones = []
    for i, zone in enumerate(zones):
        if not isinstance(zone, Mapping) or not isinstance(zone.get("cells"), list) or not 1 <= len(zone["cells"]) <= ROWS * COLS:
            raise ValueError(f"La zone {i + 1} est vide ou trop grande.")
        zid = _text(zone["id"] if zone.get("id") is not None else chr(65 + i))[:40]
        if zid in zone_ids:
            raise ValueError("Identifiants de zones en double.")
        zone_ids.add(zid)
        own: set[tuple[int, int]] = set()
        for p in zone["cells"]:
            if not isinstance(p, (list, tuple)) or len(p) != 2 or not inside(*p):
                raise ValueError(f"Une case de la zone {zid} est invalide.")
            point = (int(p[0]), int(p[1]))
            if point in own:
                raise ValueError(f"Une case de la zone {zid} apparaît deux fois.")
            if point in used:
                raise ValueError("Les zones ne doivent pas se chevaucher.")
            own.add(point)
            used.add(point)
        start = next(iter(own))
        todo, reached = deque([start]), {start}
        while todo:
            r, c = todo.popleft()
            for dr, dc in DIRS.values():
                p = (r + dr, c + dc)
                if p in own and p not in reached:
                    reached.add(p)
                    todo.append(p)
        if reached != own:
            raise ValueError(f"La zone {zid} doit être reliée par ses côtés.")
        if zone.get("compare") not in ("fixed", "crop"):
            raise ValueError(f"La comparaison de la zone {zid} doit être « fixed » ou « crop ».")
        normalized_zones.append({"id": zid, "compare": zone["compare"], "cells": [list(p) for p in sorted(own)]})
    level["zones"] = normalized_zones
    legend = raw.get("legend")
    if (not isinstance(legend, list) or not 1 <= len(legend) <= 4 or
            not isinstance(legend[0], str) or not 1 <= len(legend[0]) <= 4):
        raise ValueError("La légende doit mesurer de 1 × 1 à 4 × 4.")
    if any(not isinstance(row, str) or len(row) != len(legend[0]) or any(ch not in INDEX for ch in row) for row in legend):
        raise ValueError("Légende invalide : utiliser M R Y G B O P C ou .")
    count = sum(ch != "." for row in legend for ch in row)
    if count == 0:
        raise ValueError("La légende doit contenir au moins un cube.")
    if count > len(cubes):
        raise ValueError("Pas assez de cubes pour la légende.")
    if any(z["compare"] == "crop" for z in level["zones"]) and crop_matrix(legend) != legend:
        raise ValueError("Avec le recadrage, retirer les marges entièrement vides de la légende.")
    return level


def occupancy(cubes: Sequence[Mapping[str, Any]]) -> set[tuple[int, int]]:
    return {(p["row"], p["col"]) for p in cubes}


def neighbor_directions(cube: Mapping[str, Any], occupied: set[tuple[int, int]]) -> list[str]:
    return [d for d in ORDER if (cube["row"] + DIRS[d][0], cube["col"] + DIRS[d][1]) in occupied]


def color_for_directions(directions: Sequence[str]) -> str:
    n = len(directions)
    return "M" if n == 0 else SINGLE[directions[0]] if n == 1 else "O" if n == 2 else "P" if n == 3 else "C"


def color_map(cubes: Sequence[Mapping[str, Any]]) -> dict[tuple[int, int], str]:
    occupied = occupancy(cubes)
    return {(p["row"], p["col"]): color_for_directions(neighbor_directions(p, occupied)) for p in cubes}


def crop_matrix(rows: Sequence[str]) -> list[str]:
    """Remove empty outer margins, never internal holes, rows or columns."""
    cells = [[r, c] for r, line in enumerate(rows) for c, ch in enumerate(line) if ch != "."]
    b = bounds(cells)
    return [row[b["c0"]:b["c1"] + 1] for row in rows[b["r0"]:b["r1"] + 1]] if b else []


def extract_zone(zone: Mapping[str, Any], cubes: Sequence[Mapping[str, Any]],
                 colors: Mapping[tuple[int, int], str] | None = None) -> list[str]:
    colors = color_map(cubes) if colors is None else colors
    mask = {tuple(p) for p in zone["cells"]}
    b = bounds(zone["cells"])
    if b is None:
        return []
    raw = ["".join(colors.get((r, c), ".") if (r, c) in mask else "."
                   for c in range(b["c0"], b["c1"] + 1)) for r in range(b["r0"], b["r1"] + 1)]
    return crop_matrix(raw) if zone["compare"] == "crop" else raw


def evaluate(level: Mapping[str, Any], cubes: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    colors = color_map(cubes)
    result = []
    for zone in level["zones"]:
        matrix = extract_zone(zone, cubes, colors)
        same_size = len(matrix) == len(level["legend"]) and all(len(row) == len(level["legend"][0]) for row in matrix)
        result.append({"id": zone["id"], "matrix": matrix, "matches": same_size and matrix == level["legend"],
                       "sameSize": same_size, "compare": zone["compare"]})
    return result


def create_state(level: Mapping[str, Any]) -> dict[str, Any]:
    winning = next((z for z in evaluate(level, level["cubes"]) if z["matches"]), None)
    return {"cubes": deepcopy(level["cubes"]), "selected": None, "moves": 0, "actions": 0,
            "won": winning is not None, "winningZone": winning["id"] if winning else None,
            "lastEvent": "WIN" if winning else "READY"}


def transition(level: Mapping[str, Any], state: dict[str, Any], action: Any) -> dict[str, Any]:
    """Pure step: no in-place changes to the input state, level or action."""
    def unchanged(event: str) -> dict[str, Any]:
        return {"state": state, "changed": False, "event": event}
    if not isinstance(action, Mapping):
        return unchanged("INVALID_ACTION")
    kind = action.get("type")
    if kind == "reset":
        return {"state": create_state(level), "changed": True, "event": "RESET"}
    if state["won"]:
        return unchanged("ALREADY_WON")
    if kind == "select":
        sid = action.get("id")
        selected = sid if any(p["id"] == sid for p in state["cubes"]) else None
        if state["selected"] == selected:
            return unchanged("SELECTED")
        nxt = {**state, "selected": selected, "actions": state["actions"] + 1,
               "lastEvent": "SELECTED" if selected else "DESELECTED"}
        return {"state": nxt, "changed": True, "event": "SELECTED"}
    if kind == "cycle":
        index = next((i for i, p in enumerate(state["cubes"]) if p["id"] == state["selected"]), -1)
        return transition(level, state, {"type": "select", "id": state["cubes"][(index + 1) % len(state["cubes"])]["id"]})
    direction = action.get("direction")
    if kind != "move" or not isinstance(direction, str) or direction not in DIRS:
        return unchanged("INVALID_ACTION")
    p = next((p for p in state["cubes"] if p["id"] == state["selected"]), None)
    if p is None:
        return unchanged("NO_SELECTION")
    dr, dc = DIRS[direction]
    row, col = p["row"] + dr, p["col"] + dc
    if not inside(row, col):
        return unchanged("BOUNDARY")
    if (row, col) in occupancy(state["cubes"]):
        return unchanged("BLOCKED")
    cubes = [{**q, "row": row, "col": col} if q["id"] == p["id"] else q for q in state["cubes"]]
    winning = next((z for z in evaluate(level, cubes) if z["matches"]), None)
    nxt = {**state, "cubes": cubes, "moves": state["moves"] + 1, "actions": state["actions"] + 1,
           "won": winning is not None, "winningZone": winning["id"] if winning else None,
           "lastEvent": "WIN" if winning else "MOVED"}
    return {"state": nxt, "changed": True, "event": nxt["lastEvent"]}


# Exact indexed renderer, ported from src/renderer.js.
def cell_center(row: int, col: int) -> dict[str, int]:
    if not inside(row, col):
        raise ValueError("Case hors du plateau.")
    return {"x": OX + int(col) * CELL + 1, "y": OY + int(row) * CELL + 1}


def pixel_cell(x: Any, y: Any) -> list[int] | None:
    if not _finite(x) or not _finite(y) or not (OX <= x < OX + COLS * CELL and OY <= y < OY + ROWS * CELL):
        return None
    return [math.floor((y - OY) / CELL), math.floor((x - OX) / CELL)]


def legend_geometry(legend: Sequence[str]) -> dict[str, int]:
    width = len(legend[0]) if legend and legend[0] else 1
    size = 3 if max(len(legend), width) > 3 else 4
    return {"size": size, "x": 63 - width * size, "y": 63 - len(legend) * size}


def hit_test(level: Mapping[str, Any], state: Mapping[str, Any], x: Any, y: Any) -> dict[str, Any] | None:
    if not _finite(x) or not _finite(y) or not (0 <= x < FRAME and 0 <= y < FRAME):
        return None
    for b in BUTTONS:
        if b["x"] <= x < b["x"] + b["w"] and b["y"] <= y < b["y"] + b["h"]:
            return deepcopy(b["action"])
    p = pixel_cell(x, y)
    if p is None:
        return None
    cube = next((c for c in state["cubes"] if c["row"] == p[0] and c["col"] == p[1]), None)
    return {"type": "select", "id": cube["id"] if cube else None}


def render_frame(level: Mapping[str, Any], state: Mapping[str, Any],
                 options: Mapping[str, Any] | None = None) -> list[list[int]]:
    options = options or {}
    frame = [[5] * FRAME for _ in range(FRAME)]
    def put(x: int, y: int, color: int) -> None:
        if 0 <= x < FRAME and 0 <= y < FRAME:
            frame[y][x] = color
    def rect(x: int, y: int, width: int, height: int, color: int) -> None:
        for dy in range(height):
            for dx in range(width):
                put(x + dx, y + dy, color)
    if options.get("grid"):
        for r in range(ROWS):
            for c in range(COLS):
                put(OX + c * CELL + 1, OY + r * CELL + 1, 4)
    for z in level["zones"]:
        for r, c in z["cells"]:
            rect(OX + c * CELL, OY + r * CELL, 3, 3, 4)
    colors = color_map(state["cubes"])
    for p in state["cubes"]:
        x, y = OX + p["col"] * CELL, OY + p["row"] * CELL
        rect(x, y, 3, 3, INDEX[colors[(p["row"], p["col"])]])
        if p["id"] == state["selected"]:
            put(x + 1, y + 1, 0)
    for z in level["zones"]:
        mask = {tuple(p) for p in z["cells"]}
        color = 0 if options.get("highlightZone") == z["id"] else 14 if options.get("winPulse") and state["winningZone"] == z["id"] else 2
        for r, c in z["cells"]:
            x, y = OX + c * CELL, OY + r * CELL
            if (r - 1, c) not in mask:
                for i in range(-1, 4):
                    put(x + i, y - 1, color)
            if (r + 1, c) not in mask:
                for i in range(-1, 4):
                    put(x + i, y + 3, color)
            if (r, c - 1) not in mask:
                for i in range(-1, 4):
                    put(x - 1, y + i, color)
            if (r, c + 1) not in mask:
                for i in range(-1, 4):
                    put(x + 3, y + i, color)
    rect(0, 48, 64, 1, 4)
    for b in BUTTONS:
        rect(b["x"], b["y"], b["w"], b["h"], 4)
        for dy in range(b["h"]):
            for dx in range(b["w"]):
                if b["glyph"][dy][dx] == "#":
                    put(b["x"] + dx, b["y"] + dy, 1)
    lg = legend_geometry(level["legend"])
    w, h = len(level["legend"][0]) * lg["size"], len(level["legend"]) * lg["size"]
    rect(lg["x"] - 1, lg["y"] - 1, w + 1, 1, 2)
    rect(lg["x"] - 1, 63, w + 1, 1, 2)
    rect(lg["x"] - 1, lg["y"] - 1, 1, h + 1, 2)
    rect(63, lg["y"] - 1, 1, h + 2, 2)
    for r, line in enumerate(level["legend"]):
        for c, ch in enumerate(line):
            rect(lg["x"] + c * lg["size"], lg["y"] + r * lg["size"], lg["size"] - 1, lg["size"] - 1, INDEX[ch])
    completed = options.get("completed", [])
    for i in range(options.get("totalLevels", 6)):
        rect(2 + i * 6, 63, 4, 1, 14 if i in completed else 13 if i == options.get("levelIndex") else 4)
    return frame


def frame_rgb(frame: Sequence[Sequence[int]], palette: Sequence[str] = PALETTE) -> list[list[list[int]]]:
    """Explicit RGB rendering for clients that cannot use a per-game palette."""
    if len(palette) != 16 or any(not re.fullmatch(r"#[0-9a-fA-F]{6}", x) for x in palette):
        raise ValueError("La palette doit contenir 16 couleurs #RRGGBB.")
    colors = [[int(color[i:i + 2], 16) for i in (1, 3, 5)] for color in palette]
    return [[colors[v][:] for v in row] for row in frame]


# Optional construction solver. Never called by normal engine.step/action.
def _degree(color: str) -> int:
    return 0 if color == "M" else 1 if color in "RYGB" else 2 if color == "O" else 3 if color == "P" else 4


def find_layouts(level: Mapping[str, Any], *, max_nodes: int = 100_000,
                 allow_outside: bool = True, allow_external_influence: bool = True) -> dict[str, Any]:
    """Enumerate final configurations; not shortest movement paths.

    Exhaustive target translations + a boundary occupancy constraint solver.
    'limited' is explicitly distinct from a proof of impossibility.
    """
    if not _is_int(max_nodes) or max_nodes < 0:
        raise ValueError("max_nodes doit être un entier positif ou nul.")
    nodes, limited = 0, False
    result, diagnostics = [], []
    height, width = len(level["legend"]), len(level["legend"][0])
    entries = [(r, c, ch) for r, line in enumerate(level["legend"]) for c, ch in enumerate(line) if ch != "."]
    budget = len(level["cubes"]) - len(entries)
    no_influence = not allow_outside or not allow_external_influence
    for zone in level["zones"]:
        zone_count, zone_limited = 0, False
        mask = {tuple(p) for p in zone["cells"]}
        b = bounds(zone["cells"])
        candidates = []
        if zone["compare"] == "fixed":
            if b["r1"] - b["r0"] + 1 == height and b["c1"] - b["c0"] + 1 == width:
                candidates.append((b["r0"], b["c0"]))
        else:
            candidates = [(r, c) for r in range(b["r0"], b["r1"] - height + 2)
                          for c in range(b["c0"], b["c1"] - width + 2)]
        for r0, c0 in candidates:
            if nodes >= max_nodes:
                limited = zone_limited = True
                break
            target = [{"row": r0 + r, "col": c0 + c, "color": ch} for r, c, ch in entries]
            target_set = occupancy(target)
            if not target_set <= mask:
                continue
            variables: list[tuple[int, int]] = []
            variable_index, equations = {}, []
            forbidden: set[int] = set()
            impossible = False
            for p in target:
                present = neighbor_directions(p, target_set)
                single_dir = next((d for d, ch in SINGLE.items() if ch == p["color"]), None)
                if single_dir and any(d != single_dir for d in present):
                    impossible = True
                    break
                vs = []
                for d in ORDER:
                    dr, dc = DIRS[d]
                    point = (p["row"] + dr, p["col"] + dc)
                    if point in target_set or not inside(*point) or point in mask or no_influence:
                        continue
                    if point not in variable_index:
                        variable_index[point] = len(variables)
                        variables.append(point)
                    v = variable_index[point]
                    vs.append(v)
                    if single_dir and d != single_dir:
                        forbidden.add(v)
                need = _degree(p["color"]) - len(present)
                if need < 0 or need > len(vs):
                    impossible = True
                    break
                equations.append((vs, need))
            if impossible:
                continue
            parking_candidates = [(r, c) for r in range(ROWS) for c in range(COLS)
                                  if (r, c) not in mask and (r, c) not in target_set
                                  and not any((r + DIRS[d][0], c + DIRS[d][1]) in target_set for d in ORDER)]
            seed = [-1] * len(variables)
            for v in forbidden:
                seed[v] = 0
            assignment = None

            def search(a: list[int]) -> bool:
                nonlocal nodes, limited, zone_limited, assignment
                nodes += 1
                if nodes > max_nodes:
                    limited = zone_limited = True
                    return False
                progress = True
                while progress:
                    progress = False
                    if a.count(1) > budget:
                        return False
                    for vs, required in equations:
                        ones = sum(a[i] == 1 for i in vs)
                        unknown = [i for i in vs if a[i] < 0]
                        need = required - ones
                        if need < 0 or need > len(unknown):
                            return False
                        if unknown and need in (0, len(unknown)):
                            value = 0 if need == 0 else 1
                            for i in unknown:
                                a[i] = value
                            progress = True
                nxt = next((i for i, v in enumerate(a) if v < 0), -1)
                if nxt < 0:
                    if budget - a.count(1) > len(parking_candidates):
                        return False
                    assignment = a
                    return True
                for value in (0, 1):
                    copy = a[:]
                    copy[nxt] = value
                    if search(copy):
                        return True
                    if limited:
                        return False
                return False

            if not search(seed):
                continue
            supports = [list(p) for i, p in enumerate(variables) if assignment[i] == 1]
            if not allow_outside and (budget > 0 or supports):
                continue
            spare_count = budget - len(supports)
            parking = [list(p) for p in parking_candidates[:spare_count]]
            if len(parking) != spare_count:
                continue
            scored = [[p["row"], p["col"]] for p in target]
            cells = scored + supports + parking
            test_cubes = [{"id": f"v{i}", "row": p[0], "col": p[1]} for i, p in enumerate(cells)]
            if not any(z["id"] == zone["id"] and z["matches"] for z in evaluate(level, test_cubes)):
                raise RuntimeError("Erreur interne de vérification de configuration.")
            zone_count += 1
            result.append({"zoneId": zone["id"], "anchor": [r0, c0], "cells": cells,
                           "supports": supports, "parking": parking, "scored": scored})
        diagnostics.append({"id": zone["id"], "count": zone_count,
                            "status": "possible" if zone_count else "limit" if zone_limited else "impossible"})
    return {"layouts": result, "diagnostics": diagnostics, "nodes": nodes, "limited": limited}


def shortest_path(start: Sequence[int], finish: Sequence[int], cubes: Sequence[Mapping[str, Any]], moving_id: str) -> list[str] | None:
    blocked = occupancy([p for p in cubes if p["id"] != moving_id])
    start, finish = tuple(start), tuple(finish)
    if finish in blocked:
        return None
    todo = deque([start])
    prev: dict[tuple[int, int], Any] = {start: None}
    while todo:
        point = todo.popleft()
        if point == finish:
            steps = []
            while point != start:
                point, direction = prev[point]
                steps.append(direction)
            return steps[::-1]
        for direction in ORDER:
            dr, dc = DIRS[direction]
            nxt = (point[0] + dr, point[1] + dc)
            if inside(*nxt) and nxt not in blocked and nxt not in prev:
                prev[nxt] = (point, direction)
                todo.append(nxt)
    return None


def plan_to_layout(level: Mapping[str, Any], state: Mapping[str, Any], layout: Mapping[str, Any]) -> dict[str, Any] | None:
    """Construct legal single-cube moves, without teleporting or pushing.

    The web planner's five filling orders are retained. This does NOT promise
    the globally shortest route, or a route for every feasible custom board.
    """
    desired = {tuple(p) for p in layout["cells"]}
    for attempt in range(5):
        s = deepcopy(state)
        s.update(won=False, winningZone=None)
        actions = []
        for _ in range(len(layout["cells"]) + 1):
            occ = occupancy(s["cubes"])
            missing = [p for p in layout["cells"] if tuple(p) not in occ]
            if not missing or s["won"]:
                return {"actions": actions, "final": s,
                        "verified": s["won"] or any(z["matches"] for z in evaluate(level, s["cubes"]))}
            movable = [p for p in s["cubes"] if (p["row"], p["col"]) not in desired]
            choices = []
            for cell in missing:
                tight = sum((cell[0] + DIRS[d][0], cell[1] + DIRS[d][1]) in desired for d in ORDER)
                for p in movable:
                    path = shortest_path([p["row"], p["col"]], cell, s["cubes"], p["id"])
                    if path is None:
                        continue
                    score = (-tight * 1000 + len(path) if attempt == 0 else len(path) if attempt == 1
                             else tight * 1000 + len(path) if attempt == 2
                             else cell[0] * 30 + cell[1] if attempt == 3 else -cell[0] * 30 - cell[1])
                    choices.append((score, p["id"], p, path))
            # Same ordering for the bundled ASCII IDs. Custom Unicode IDs may
            # choose a different equally valid tie-break from localeCompare.
            choices.sort(key=lambda x: (x[0], x[1]))
            if not choices:
                break
            _, _, p, path = choices[0]
            select = {"type": "select", "id": p["id"]}
            s = transition(level, s, select)["state"]
            actions.append(select)
            failed = False
            for direction in path:
                action = {"type": "move", "direction": direction}
                out = transition(level, s, action)
                if not out["changed"]:
                    failed = True
                    break
                s = out["state"]
                actions.append(action)
                if s["won"]:
                    return {"actions": actions, "final": s, "verified": True}
            if failed:
                break
    return None


def solve(level: Mapping[str, Any], state: Mapping[str, Any], **options: Any) -> dict[str, Any]:
    if any(z["matches"] for z in evaluate(level, state["cubes"])):
        return {"status": "solved", "actions": [], "search": None}
    search = find_layouts(level, **options)
    def cost(layout: Mapping[str, Any]) -> int:
        return sum(min(abs(p["row"] - t[0]) + abs(p["col"] - t[1]) for p in state["cubes"]) for t in layout["cells"])
    for layout in sorted(search["layouts"], key=cost)[:32]:
        plan = plan_to_layout(level, state, layout)
        if plan and plan["verified"]:
            return {"status": "found", **plan, "layout": layout, "search": search}
    status = "route_not_found" if search["layouts"] else "limit" if search["limited"] else "impossible"
    return {"status": status, "actions": [], "search": search}


def load_levels(directory: str | Path = LEVELS_DIR) -> list[dict[str, Any]]:
    directory = Path(directory)
    files = sorted(directory.glob("L[0-9][0-9].json"))
    if not files:
        raise FileNotFoundError(f"Aucun niveau Lxx.json dans {directory}")
    levels = []
    for path in files:
        try:
            levels.append(validate_level(json.loads(path.read_text(encoding="utf-8-sig"))))
        except (ValueError, TypeError) as exc:
            raise ValueError(f"{path.name}: {exc}") from exc
    return levels


def load_pack(path: str | Path) -> tuple[list[dict[str, Any]], list[str]]:
    """Read an exported web level, level array or pack including brown override."""
    raw = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    source = raw.get("levels", [raw]) if isinstance(raw, dict) else raw
    if not isinstance(source, list) or not 1 <= len(source) <= 6:
        raise ValueError("Un pack doit contenir de 1 à 6 niveaux.")
    levels = [validate_level(level) for level in source]
    palette = list(PALETTE)
    overrides = raw.get("palette_overrides", {}) if isinstance(raw, dict) else {}
    if not isinstance(overrides, dict):
        raise ValueError("palette_overrides doit être un objet JSON.")
    for index, value in overrides.items():
        if str(index) != "13" or not isinstance(value, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise ValueError("Seule la surcharge du marron (index 13, #RRGGBB) est acceptée.")
        palette[13] = value.upper()
    return levels, palette


class GameInfo(Protocol):
    game_id: str
    title: str
    family: str
    levels: int
    default_fps: float


@dataclass(frozen=True)
class DefaultGameInfo:
    game_id: str = "neighbor_cubes"
    title: str = "Voisinage"
    family: str = "neighbor_cubes"
    levels: int = 6
    default_fps: float = 10


class NeighborCubesEngine:
    """Adapter for the existing custom-game reset/action/public_state boundary.

    By default, solved levels advance automatically and level 6 ends in WIN.
    The native viewer uses auto_advance=False to inspect solved arrangements.
    No action budget is imposed, matching the approved web prototype.
    """
    def __init__(self, info: GameInfo | None = None, *, levels_dir: str | Path | None = None,
                 levels: Sequence[Mapping[str, Any]] | None = None, animate: bool = True,
                 auto_advance: bool = True, start_level: int = 1, debug: bool = False,
                 palette: Sequence[str] | None = None) -> None:
        templates = ([validate_level(x) for x in levels] if levels is not None
                     else load_levels(levels_dir if levels_dir is not None else LEVELS_DIR))
        if not 1 <= len(templates) <= 6:
            raise ValueError("Cette version accepte de 1 à 6 niveaux.")
        self.info = info if info is not None else DefaultGameInfo(levels=len(templates))
        if not _is_int(self.info.levels) or not 1 <= self.info.levels <= len(templates):
            raise ValueError("info.levels dépasse le nombre de niveaux disponibles.")
        if not _finite(self.info.default_fps) or self.info.default_fps <= 0:
            raise ValueError("default_fps doit être strictement positif.")
        self.win_levels = int(self.info.levels)
        self._templates = templates[:self.win_levels]
        self.source_path = str(levels_dir if levels_dir is not None else LEVELS_DIR) if levels is None else "<in-memory>"
        self.animate, self.auto_advance, self.debug = bool(animate), bool(auto_advance), bool(debug)
        self.palette = list(PALETTE if palette is None else palette)
        frame_rgb([[0]], self.palette)  # validate palette before allocating any GUI
        self._history: list[dict[str, Any]] = []
        self._index = 0
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.last_event = "READY"
        self.state = "NOT_FINISHED"
        self._core: dict[str, Any] = {}
        self.reset(start_level=start_level)

    @property
    def level(self) -> int:
        return self._index + 1

    @property
    def level_steps(self) -> int:
        return self._core["actions"]

    @property
    def level_moves(self) -> int:
        return self._core["moves"]

    @property
    def can_undo(self) -> bool:
        return bool(self._history)

    def _render_options(self, **extras: Any) -> dict[str, Any]:
        return {"totalLevels": self.win_levels, "levelIndex": self._index,
                "completed": list(range(self.levels_completed)), **extras}

    def _render_frame(self, **options: Any) -> list[list[int]]:
        return render_frame(self._templates[self._index], self._core, self._render_options(**options))

    def _activate(self, index: int) -> None:
        self._index = index
        self._core = create_state(self._templates[index])
        self._history.clear()
        self.state = "NOT_FINISHED"
        # Custom imports may already be solved. Count them consistently; do not
        # force the user to make a pointless move merely to register victory.
        while self._core["won"]:
            self.levels_completed = self._index + 1
            if self.levels_completed == self.win_levels:
                self.state = "WIN"
                self.last_event = "GAME_WON"
                break
            if not self.auto_advance:
                self.last_event = "LEVEL_COMPLETE"
                break
            self._index += 1
            self._core = create_state(self._templates[self._index])

    def reset(self, *, start_level: int = 1) -> dict[str, Any]:
        if not _is_int(start_level) or not 1 <= start_level <= self.win_levels:
            raise ValueError("Niveau de départ invalide.")
        self.step_index = 0
        self.levels_completed = int(start_level) - 1
        self.last_action, self.last_event = "RESET", "READY"
        self._activate(int(start_level) - 1)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        index = self._index
        self.levels_completed = index
        self.last_action, self.last_event = "ACTION7", "LEVEL_RESET"
        self._activate(index)
        return self.public_state()

    def next_level(self) -> dict[str, Any]:
        """Viewer helper, not an additional ARC action."""
        if not self._core["won"] or self._index + 1 >= self.win_levels:
            return self.public_state()
        self.last_event = "READY"
        self._activate(self._index + 1)
        return self.public_state()

    def undo(self) -> dict[str, Any]:
        """Local debugging helper; undo does not rewind global action attempts."""
        if self._history:
            self._core = self._history.pop()
            self.levels_completed = self._index
            self.state = "NOT_FINISHED"
            self.last_action, self.last_event = "UNDO", "UNDO"
        return self.public_state()

    def snapshot(self) -> dict[str, Any]:
        """Developer-only deep copy; not returned to a frame-only agent."""
        return deepcopy(self._core)

    def level_definition(self) -> dict[str, Any]:
        return deepcopy(self._templates[self._index])

    def export_pack(self) -> dict[str, Any]:
        """Export the six definitions in the original web editor format."""
        return {"game": "neighbor-cubes-v1", "version": 1,
                "palette_overrides": {"13": self.palette[13]},
                "levels": deepcopy(self._templates)}

    def solution(self, **options: Any) -> dict[str, Any]:
        """Explicit developer helper. Never run during normal observation/actions."""
        return solve(self._templates[self._index], self._core, **options)

    def action(self, action_id: int, data: Mapping[str, Any] | None = None) -> dict[str, Any]:
        if not _is_int(action_id) or not 1 <= action_id <= 7:
            self.last_event = "INVALID_ACTION"
            return self.public_state()
        aid = int(action_id)
        if aid == 7:
            return self.level_reset()
        self.last_action = f"ACTION{aid}"
        if aid == 6:
            action = hit_test(self._templates[self._index], self._core, data.get("x"), data.get("y")) if isinstance(data, Mapping) else None
            # The on-frame restart button remains legal after victory.
            if action and action["type"] == "reset":
                return self.level_reset()
        else:
            action = {"type": "move", "direction": ACTION_DIRECTIONS[aid]} if aid in ACTION_DIRECTIONS else {"type": "cycle"}
        if self._core["won"]:
            self.last_event = "ALREADY_WON"
            return self.public_state()
        self.step_index += 1
        if action is None:
            self.last_event = "CLICK_EMPTY"
            return self.public_state()
        out = transition(self._templates[self._index], self._core, action)
        self.last_event = out["event"]
        if out["changed"]:
            if action["type"] == "move":
                self._history.append(deepcopy(self._core))
            self._core = out["state"]
            if self._core["won"]:
                return self._complete_level()
        return self.public_state()

    step = action

    def _complete_level(self) -> dict[str, Any]:
        completed_level = self.level
        self.levels_completed = completed_level
        frames = []
        if self.animate:
            # Three green/grey pulses exactly using the web renderer's winPulse.
            for i in range(6):
                frames.append(self._render_frame(winPulse=(i % 2 == 0)))
        self.last_event = "GAME_WON" if completed_level == self.win_levels else "LEVEL_COMPLETE"
        if completed_level == self.win_levels:
            self.state = "WIN"
        elif self.auto_advance:
            self._activate(self._index + 1)
        result = self.public_state()
        result["completed_level"] = completed_level
        if frames:
            result["frames"] = frames + [result["frame"]]
            result["frame_count"] = len(result["frames"])
            result["transition_frame_interval_ms"] = 110
        return result

    def public_state(self) -> dict[str, Any]:
        frame = self._render_frame()
        ids = [7] if self._core["won"] else list(range(1, 8))
        result = {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "frame": frame, "frames": [frame], "frame_count": 1,
            "default_fps": self.info.default_fps, "state": self.state,
            "level": self.level, "levels_completed": self.levels_completed, "win_levels": self.win_levels,
            "step_index": self.step_index, "available_actions": [f"ACTION{i}" for i in ids],
            "available_action_ids": ids, "last_action": self.last_action,
            "score": self.levels_completed, "full_reset": False,
            "source_path": self.source_path, "custom_family": self.info.family,
            "level_name": self._templates[self._index]["name"], "level_steps": self.level_steps,
            "level_moves": self.level_moves, "max_steps": None,
            "selected_piece": self._core["selected"], "level_complete": self._core["won"],
            "last_event": self.last_event, "palette": self.palette[:],
            "palette_overrides": {"13": self.palette[13]},
        }
        if self.debug:
            result["debug"] = {"core": self.snapshot(), "zones": evaluate(self._templates[self._index], self._core["cubes"])}
        return result


# Convenience alias for a French project name; both names reference one class.
VoisinageEngine = NeighborCubesEngine
