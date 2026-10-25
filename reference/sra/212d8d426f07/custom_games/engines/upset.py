"""UPST — Upset v9, custom_3. Deterministic Python port of the accepted web game.

ACTION6 toggles one door and resolves one complete turn. ACTION7 resets the
current level. reset()/ACTION0 reset the campaign. ACTION5 does nothing.

Turn order reproduces web v9. Full frames remain available for reference;
the host may request fewer presentation frames without skipping simulation.
One blue refuge journey and at most one red room crossing per PAID door turn;
purple chains all reachable smaller meals. Frustration uses connected rooms
for influence, but an actual BFS path for food availability.

Runtime: Python 3.10+, standard library only. Install the six JSON files in
custom_games/games/upset/levels alongside this engine's package structure.
No JavaScript runtime, network, random generator, sleep or wall clock is used.

The optional level_data argument and debug_* methods are author/test facilities,
not agent actions. Solutions and tutorial prose are never in public_state().
"""
from __future__ import annotations

import copy
import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

SIZE = FRAME = 64
CELL, COLS, ROWS, OX, OY = 7, 9, 8, 0, 3
LEVEL_COUNT = 6
ANIM_FPS = 60
GAME_ID, FAMILY, WAVE = "upst-c3000001", "upset", "custom_3"
WEB_VERSION = "v9"
ACTION_CLICK, ACTION_RESET = 6, 7
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / FAMILY / "levels"
AREAS = (1, 4, 5, 9, 13, 21)
MASKS = (
    ((0, 0),),
    ((0, 0), (1, 0), (0, 1), (1, 1)),
    ((0, -1), (-1, 0), (0, 0), (1, 0), (0, 1)),
    ((-1, -1), (0, -1), (1, -1), (-1, 0), (0, 0), (1, 0),
     (-1, 1), (0, 1), (1, 1)),
    ((0, -2), (-1, -1), (0, -1), (1, -1), (-2, 0), (-1, 0),
     (0, 0), (1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2)),
    ((-1, -2), (0, -2), (1, -2), (-2, -1), (-1, -1), (0, -1),
     (1, -1), (2, -1), (-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0),
     (-2, 1), (-1, 1), (0, 1), (1, 1), (2, 1), (-1, 2), (0, 2), (1, 2)),
)
PALETTE = (
    "#F3F2EB", "#C9CDC8", "#37404B", "#66707B", "#1B2028", "#11161C",
    "#B555B5", "#E7B9A3", "#F06B65", "#679DEB", "#63D5D6", "#F1CE62",
    "#EBA258", "#86513A", "#77CB93", "#BB94EB",
)
COLORS = {"blue": 9, "green": 14, "yellow": 11, "orange": 12, "red": 8, "purple": 15}
DIRS = ((1, 0), (0, 1), (-1, 0), (0, -1))  # Same BFS tie order as web v9.
Raster = list[list[int]]
Entity = dict[str, Any]
Door = dict[str, Any]
Event = dict[str, Any]
Point = tuple[int, int]


def _integer(value: Any, label: str, lo: int, hi: int) -> int:
    if type(value) is not int or not lo <= value <= hi:
        raise ValueError(f"{label}: expected an integer in {lo}..{hi}, got {value!r}")
    return value


def _point(value: Any, label: str) -> Point:
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        raise ValueError(f"{label}: expected [column, row]")
    return (_integer(value[0], label + ".x", 0, COLS - 1),
            _integer(value[1], label + ".y", 0, ROWS - 1))


def _idxy(x: int, y: int) -> int:
    return y * COLS + x


def _xy(n: int) -> Point:
    return n % COLS, n // COLS


def center(x: int, y: int) -> dict[str, int]:
    """Logical cell -> native raster centre (not a click on a door)."""
    return {"x": OX + x * CELL + 3, "y": OY + y * CELL + 3}


def _fill(buf: bytearray, x: int, y: int, w: int, h: int, color: int) -> None:
    left, right = max(0, x), min(SIZE, x + w)
    if right <= left:
        return
    stripe = bytes([color]) * (right - left)
    for yy in range(max(0, y), min(SIZE, y + h)):
        buf[yy * SIZE + left: yy * SIZE + right] = stripe


def _outline(buf: bytearray, x: int, y: int, w: int, h: int, color: int) -> None:
    _fill(buf, x, y, w, 1, color)
    _fill(buf, x, y + h - 1, w, 1, color)
    _fill(buf, x, y, 1, h, color)
    _fill(buf, x + w - 1, y, 1, h, color)


def _inside(x: int, y: int, rect: dict[str, int]) -> bool:
    return (rect["x"] <= x < rect["x"] + rect["w"]
            and rect["y"] <= y < rect["y"] + rect["h"])


def predation_allowed(a: Entity, b: Entity, blue_is_enclosed: bool) -> bool:
    """Sizes are indices into AREAS; purple requires STRICT inequality."""
    if not a["alive"] or not b["alive"] or a["id"] == b["id"] or a["size"] < b["size"]:
        return False
    if b["color"] == "blue" and not blue_is_enclosed:
        return False
    if a["color"] in ("yellow", "orange"):
        return b["color"] == "green"
    if a["color"] == "red":
        return b["color"] in COLORS
    if a["color"] == "purple":
        return a["size"] > b["size"]
    return False


def _room_partition(level: dict[str, Any]) -> tuple[list[int], list[dict[str, Any]]]:
    """Support both rectangular cuts and connected, irregular room maps."""
    grid = [-1] * (COLS * ROWS)
    rooms: list[dict[str, Any]] = []
    if "room_map" in level:
        raw = level["room_map"]
        if (not isinstance(raw, list) or len(raw) != ROWS
                or any(not isinstance(row, list) or len(row) != COLS for row in raw)):
            raise ValueError("room_map must have 8 rows and 9 columns")
        grid = [r for row in raw for r in row]
        for r in grid:
            _integer(r, "room_map label", 0, COLS * ROWS - 1)
        labels = sorted(set(grid))
        if labels != list(range(len(labels))):
            raise ValueError("Room IDs must be consecutive nonnegative integers")
        for rid in labels:
            cells = [n for n, v in enumerate(grid) if v == rid]
            seen, queue = {cells[0]}, [cells[0]]
            for current in queue:
                x, y = _xy(current)
                for dx, dy in DIRS:
                    nx, ny = x + dx, y + dy
                    n = _idxy(nx, ny)
                    if (0 <= nx < COLS and 0 <= ny < ROWS
                            and grid[n] == rid and n not in seen):
                        seen.add(n)
                        queue.append(n)
            if len(seen) != len(cells):
                raise ValueError(f"Room {rid} is not connected")
            xs, ys = [n % COLS for n in cells], [n // COLS for n in cells]
            rooms.append({"id": rid, "x": min(xs), "y": min(ys),
                          "w": max(xs) - min(xs) + 1, "h": max(ys) - min(ys) + 1,
                          "cells": [list(_xy(n)) for n in cells]})
    else:
        for name, maximum in (("xcuts", COLS), ("ycuts", ROWS)):
            cuts = level.get(name)
            if not isinstance(cuts, list) or len(cuts) < 2:
                raise ValueError(f"{name}: missing room cuts")
            for c in cuts:
                _integer(c, name, 0, maximum)
            if cuts[0] != 0 or cuts[-1] != maximum or any(a >= b for a, b in zip(cuts, cuts[1:])):
                raise ValueError(f"{name}: cuts must increase from 0 to {maximum}")
        xs, ys = level["xcuts"], level["ycuts"]
        for ry in range(len(ys) - 1):
            for rx in range(len(xs) - 1):
                room = {"id": len(rooms), "x": xs[rx], "y": ys[ry],
                        "w": xs[rx + 1] - xs[rx], "h": ys[ry + 1] - ys[ry]}
                rooms.append(room)
                for y in range(room["y"], room["y"] + room["h"]):
                    for x in range(room["x"], room["x"] + room["w"]):
                        grid[_idxy(x, y)] = room["id"]
    return grid, rooms


def _validate_level(level: dict[str, Any], label: str) -> None:
    if not isinstance(level, dict):
        raise ValueError(f"{label}: level must be an object")
    _integer(level.get("budget"), label + ".budget", 1, 24)
    grid, _ = _room_partition(level)
    if not isinstance(level.get("entities"), list) or not isinstance(level.get("doors"), list):
        raise ValueError(f"{label}: entities and doors must be lists")
    blocked = {_point(p, label + ".blocks") for p in level.get("blocks", [])}
    used, ids = set(), set()
    for i, e in enumerate(level["entities"]):
        if not isinstance(e, dict) or e.get("color") not in COLORS:
            raise ValueError(f"{label}: invalid entity {i}")
        eid = _integer(e.get("id", i), label + ".entity.id", 0, 2**31 - 1)
        _integer(e.get("size"), label + ".entity.size", 0, len(AREAS) - 1)
        p = _point([e.get("x"), e.get("y")], label + ".entity.position")
        if p in used or eid in ids or p in blocked:
            raise ValueError(f"{label}: overlapping/duplicate entity or entity in a wall")
        used.add(p)
        ids.add(eid)
    if sum(e["color"] == "purple" for e in level["entities"]) != 1:
        raise ValueError(f"{label}: exactly one purple boss is required")
    door_edges: set[tuple[Point, Point]] = set()
    for i, d in enumerate(level["doors"]):
        if not isinstance(d, dict):
            raise ValueError(f"{label}: invalid door {i}")
        a, b = _point(d.get("a"), label + ".door.a"), _point(d.get("b"), label + ".door.b")
        edge = tuple(sorted((a, b)))
        if (abs(a[0] - b[0]) + abs(a[1] - b[1]) != 1
                or grid[_idxy(*a)] == grid[_idxy(*b)] or a in blocked or b in blocked):
            raise ValueError(f"{label}: door {i} must join adjacent rooms without a wall")
        if edge in door_edges:
            raise ValueError(f"{label}: duplicate door edge")
        if "open" in d and type(d["open"]) is not bool:
            raise ValueError(f"{label}: door.open must be boolean")
        door_edges.add(edge)


def _load_levels(directory: Path) -> list[dict[str, Any]]:
    paths = [directory / f"L{i:02d}.json" for i in range(1, LEVEL_COUNT + 1)]
    missing = [str(p) for p in paths if not p.is_file()]
    if missing:
        raise FileNotFoundError("Upset needs its six level JSON files. Missing: " + ", ".join(missing))
    result = []
    for path in paths:
        try:
            level = json.loads(path.read_text(encoding="utf-8"))
            _validate_level(level, path.name)
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"Invalid Upset level {path}: {exc}") from exc
        result.append(level)
    return result


@dataclass
class _PathMap:
    dist: list[int]
    prev: list[int]
    start: int


def _full_path(pathmap: _PathMap, goal: int) -> list[Point]:
    if goal == pathmap.start or pathmap.dist[goal] < 0:
        return []
    route, current = [], goal
    while current != pathmap.start:
        route.append(_xy(current))
        current = pathmap.prev[current]
        if current < 0:
            raise RuntimeError("Broken BFS predecessor")
    route.reverse()
    return route


def _idle() -> dict[str, Any]:
    return {"path": [], "target": None, "purpose": "idle"}


class UpsetEngine:
    """Custom backend interface compatible with the supplied FITE-style engines.

    info supplies game_id, title, family, levels and default_fps. The normal
    campaign uses all six JSON files. level_data is an explicit author-only
    injection point for isolated rule tests; it never reads solution traces.
    """

    def __init__(self, info: CustomGameInfo, *, levels_dir: str | Path | None = None,
                 level_data: list[dict[str, Any]] | None = None,
                 animation_frame_reduction: int = 1) -> None:
        if levels_dir is not None and level_data is not None:
            raise ValueError("Use either levels_dir or level_data, not both")
        self.info = info
        self.levels_dir = Path(levels_dir).resolve() if levels_dir is not None else LEVELS_DIR
        self._templates = _load_levels(self.levels_dir) if level_data is None else copy.deepcopy(level_data)
        if not isinstance(self._templates, list) or not 1 <= len(self._templates) <= LEVEL_COUNT:
            raise ValueError("Expected 1 to 6 levels; normal installation requires six JSON files")
        if level_data is not None:
            for i, level in enumerate(self._templates):
                _validate_level(level, f"level_data[{i}]")
        self.win_levels = _integer(info.levels, "info.levels", 1, len(self._templates))
        self._fps = _integer(info.default_fps, "info.default_fps", 1, 240)
        self._animation_frame_reduction = _integer(
            animation_frame_reduction, "animation_frame_reduction", 1, 64
        )
        self._partitions = [_room_partition(l) for l in self._templates]
        self._completed = [False] * len(self._templates)
        self.test_mode = False
        self.state = "NOT_FINISHED"
        self.step_index = self.attempts = 0
        self.last_action = "RESET"
        self._index = self.tick = self.actions_left = 0
        self._selected_door: int | None = None
        self._entities: list[Entity] = []
        self._doors: list[Door] = []
        self._last_events: list[Event] = []
        self._log: list[Event] = []
        self._room_grid: list[int] = []
        self._room_rects: list[dict[str, Any]] = []
        self._path_cache: dict[tuple[Any, ...], _PathMap] = {}
        self._room_groups: list[int] | None = None
        self._rooms_with_open_door: set[int] = set()
        self._walk_key: tuple[bool, ...] | None = None
        self._walk_edges: list[list[int]] | None = None
        self._frozen_pixels: dict[int, dict[str, int]] = {}
        self._escaped_this_turn: set[int] = set()
        self._red_room_changes: dict[int, int] = {}
        self._event = "ready"
        self._pending_frames: list[Raster] | None = None
        self._pending_timeline: list[Event] = []
        self._pending_extra: dict[str, Any] = {}
        self._static_frame = bytearray()
        self._setup(0)

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    @property
    def _level(self) -> dict[str, Any]:
        return self._templates[self._index]

    def _alive(self) -> list[Entity]:
        return [e for e in self._entities if e["alive"]]

    def _mobile(self) -> list[Entity]:
        return [e for e in self._entities if e["alive"] and e["color"] != "green"]

    def _entity(self, eid: int) -> Entity | None:
        return next((e for e in self._entities if e["id"] == eid), None)

    def _room_at(self, x: int, y: int) -> int:
        return self._room_grid[_idxy(x, y)]

    def _invalidate_paths(self) -> None:
        self._path_cache.clear()

    def _invalidate_topology(self) -> None:
        self._room_groups = None
        self._rooms_with_open_door.clear()
        self._walk_key = None
        self._invalidate_paths()

    def _reset_turn_limits(self) -> None:
        self._escaped_this_turn.clear()
        self._red_room_changes.clear()

    def _setup(self, index: int) -> None:
        self._index = index
        level = self._level
        self._room_grid, self._room_rects = copy.deepcopy(self._partitions[index])
        self._entities = [{**copy.deepcopy(e), "alive": True, "waypoint": 0, "id": e.get("id", i)}
                          for i, e in enumerate(level["entities"])]
        self._doors = [{**copy.deepcopy(d), "id": i, "open": bool(d.get("open", False))}
                       for i, d in enumerate(level["doors"])]
        self._blocked = {tuple(p) for p in level.get("blocks", [])}
        self._walk_key = self._walk_edges = None
        self._invalidate_topology()
        self._reset_turn_limits()
        self._frozen_pixels = {}
        self.tick, self.actions_left = 0, level["budget"]
        self._last_events, self._log, self._selected_door = [], [], None
        self.state = "NOT_FINISHED"
        self._static_frame = self._build_static_frame()

    # --- Room graph, physical reachability and food opportunity -----------------

    @staticmethod
    def door_rect(door: Door) -> dict[str, int]:
        a, b = center(*door["a"]), center(*door["b"])
        if a["x"] != b["x"]:
            return {"x": max(door["a"][0], door["b"][0]) * CELL, "y": a["y"] - 2, "w": 1, "h": 5}
        return {"x": a["x"] - 2, "y": OY + max(door["a"][1], door["b"][1]) * CELL, "w": 5, "h": 1}

    @classmethod
    def door_hit(cls, door: Door) -> dict[str, int]:
        r = cls.door_rect(door)
        return {"x": r["x"] - 2, "y": r["y"] - 2, "w": r["w"] + 4, "h": r["h"] + 4}

    def _linked_rooms(self) -> list[int]:
        if self._room_groups is not None:
            return self._room_groups
        parents = [r["id"] for r in self._room_rects]

        def find(i: int) -> int:
            while parents[i] != i:
                i = parents[i]
            return i

        for d in self._doors:
            if d["open"]:
                ra, rb = self._room_at(*d["a"]), self._room_at(*d["b"])
                self._rooms_with_open_door.update((ra, rb))
                a, b = find(ra), find(rb)
                parents[b] = a
        self._room_groups = [find(i) for i in range(len(parents))]
        return self._room_groups

    def _same_neighborhood(self, a: Entity, b: Entity, groups: list[int] | None = None) -> bool:
        if groups is None:
            groups = self._linked_rooms()
        return groups[self._room_at(a["x"], a["y"])] == groups[self._room_at(b["x"], b["y"])]

    def _enclosed(self, entity: Entity) -> bool:
        rid = self._room_at(entity["x"], entity["y"])
        self._linked_rooms()
        return rid not in self._rooms_with_open_door

    def _adjacent_cells(self, a: Point, b: Point) -> bool:
        if abs(a[0] - b[0]) + abs(a[1] - b[1]) != 1:
            return False
        if not (0 <= b[0] < COLS and 0 <= b[1] < ROWS) or tuple(b) in self._blocked:
            return False
        if self._room_at(*a) == self._room_at(*b):
            return True
        return any(d["open"] and ((tuple(d["a"]) == tuple(a) and tuple(d["b"]) == tuple(b))
                                  or (tuple(d["b"]) == tuple(a) and tuple(d["a"]) == tuple(b)))
                   for d in self._doors)

    def _can_eat(self, a: Entity, b: Entity) -> bool:
        return predation_allowed(a, b, self._enclosed(b))

    def _open_edges(self) -> list[list[int]]:
        key = tuple(d["open"] for d in self._doors)
        if key != self._walk_key or self._walk_edges is None:
            self._walk_key = key
            graph: list[list[int]] = [[] for _ in range(COLS * ROWS)]
            for y in range(ROWS):
                for x in range(COLS):
                    for dx, dy in DIRS:
                        if self._adjacent_cells((x, y), (x + dx, y + dy)):
                            graph[_idxy(x, y)].append(_idxy(x + dx, y + dy))
            self._walk_edges = graph
        return self._walk_edges

    def _path_map(self, e: Entity, ignore_bodies: bool = False, empty_only: bool = False) -> _PathMap:
        key = (e["id"], e["x"], e["y"], e["color"], e["size"], ignore_bodies, empty_only)
        if key in self._path_cache:
            return self._path_cache[key]
        graph = self._open_edges()
        dist, prev = [-1] * (COLS * ROWS), [-1] * (COLS * ROWS)
        start = _idxy(e["x"], e["y"])
        queue, dist[start] = [start], 0
        occupied = {_idxy(o["x"], o["y"]): o for o in self._alive() if o["id"] != e["id"]}
        for current in queue:
            for n in graph[current]:
                if dist[n] >= 0:
                    continue
                other = occupied.get(n)
                if other is not None and (empty_only or (not ignore_bodies and not self._can_eat(e, other))):
                    continue
                dist[n], prev[n] = dist[current] + 1, current
                queue.append(n)
        value = _PathMap(dist, prev, start)
        self._path_cache[key] = value
        return value

    def _reachable_targets(self, e: Entity, green_only: bool = False) -> list[Entity]:
        m = self._path_map(e)
        return [o for o in self._alive()
                if self._can_eat(e, o) and (not green_only or o["color"] == "green")
                and (e["color"] != "red" or o["color"] != "green")
                and m.dist[_idxy(o["x"], o["y"])] >= 0]

    def _has_reachable_green(self, e: Entity) -> bool:
        return bool(self._reachable_targets(e, True))

    # --- Simultaneous mood decisions and competition for actual meals -----------

    def _mood_phase(self, events: list[Event]) -> None:
        snapshot, groups, changes = copy.deepcopy(self._alive()), self._linked_rooms(), {}
        for e in snapshot:
            if e["color"] in ("green", "purple"):
                continue
            companions = [o for o in snapshot if o["id"] != e["id"] and o["color"] != "green"
                          and self._same_neighborhood(e, o, groups)]
            color, reason = e["color"], ""
            if color == "blue" and not any(o["color"] in ("orange", "red", "purple") for o in companions):
                color, reason = "yellow", "safe"
            elif not companions and color == "red":
                color, reason = "orange", "isolated"
            elif not companions and color == "orange":
                color, reason = "yellow", "isolated"
            elif color in ("yellow", "orange"):
                own = self._has_reachable_green(e)
                other_can = any(self._reachable_targets(o) for o in companions)
                # No comparison between the observer's size and the neighbour's.
                if not own and other_can:
                    color, reason = ("orange" if color == "yellow" else "red"), "envy"
            if color != e["color"]:
                changes[e["id"]] = (color, reason)
        for e in self._entities:
            if e["id"] in changes:
                color, reason = changes[e["id"]]
                events.append({"type": "mood", "id": e["id"], "from": e["color"], "to": color, "reason": reason})
                e["color"] = color
        self._invalidate_paths()

    @staticmethod
    def _green_meals(events: list[Event]) -> list[Event]:
        return [v for v in events if v["type"] == "eat" and v["preyColor"] == "green"]

    def _scarcity_phase(self, events: list[Event], changed: set[int]) -> None:
        groups = self._linked_rooms()
        fed = {v["eater"] for v in events if v["type"] == "eat"}
        food, changes = self._green_meals(events), []
        for e in self._alive():
            if e["color"] not in ("yellow", "orange") or e["id"] in fed or e["id"] in changed:
                continue
            witness = next((v for v in food if v["eater"] != e["id"]
                            and groups[self._room_at(e["x"], e["y"])] == groups[v["mealRoom"]]), None)
            if not self._has_reachable_green(e) and witness is not None:
                changes.append({"id": e["id"], "from": e["color"],
                                "to": "orange" if e["color"] == "yellow" else "red", "witness": witness["eater"]})
        for v in changes:
            e = self._entity(v["id"])
            assert e is not None
            e["color"] = v["to"]
            changed.add(v["id"])
            self._invalidate_paths()
            events.append({"type": "mood", **v, "reason": "food_competition"})

    def _approach_missed_meal(self, e: Entity, events: list[Event], frames: list[Raster],
                              timeline: list[Event], draw: bool) -> int:
        if not e["alive"] or e["color"] not in ("yellow", "orange"):
            return 0
        if any(v["type"] == "eat" and v["eater"] == e["id"] for v in events) or self._has_reachable_green(e):
            return 0
        groups, home, m = self._linked_rooms(), self._room_at(e["x"], e["y"]), self._path_map(e, False, True)
        food = [v for v in self._green_meals(events) if v["eater"] != e["id"]
                and v["preySize"] <= AREAS[e["size"]] and v["mealRoom"] != home
                and groups[v["mealRoom"]] == groups[home]]
        if not food:
            return 0
        occupied = {_idxy(o["x"], o["y"]) for o in self._alive()}
        thresholds = {_idxy(*p) for d in self._doors for p in (d["a"], d["b"])}
        options = []
        for meal in food:
            for n, distance in enumerate(m.dist):
                if distance < 0 or n in occupied or self._room_grid[n] != meal["mealRoom"]:
                    continue
                x, y = _xy(n)
                options.append((int(n in thresholds), distance, x, y, meal["prey"], n, meal))
        if not options:
            return 0
        best = min(options, key=lambda o: o[:5])
        return self._travel_and_eat(e, {"path": _full_path(m, best[5]), "target": None,
                                        "purpose": "missed_meal", "meal": best[6]["prey"]},
                                    events, frames, timeline, draw)["traversed"]

    # --- Blue refuges and red pursuits -----------------------------------------

    def _refuge_journey(self, e: Entity, incoming: Entity | None = None) -> dict[str, Any]:
        if e["id"] in self._escaped_this_turn:
            return _idle()
        home, groups = self._room_at(e["x"], e["y"]), self._linked_rooms()
        threats = [o for o in self._mobile() if o["id"] != e["id"]
                   and o["color"] in ("orange", "red", "purple") and self._same_neighborhood(e, o, groups)]
        if incoming is None and not any(self._room_at(o["x"], o["y"]) == home for o in threats):
            return _idle()
        m = self._path_map(e, False, True)
        occupied = {_idxy(o["x"], o["y"]) for o in self._alive() if o["id"] != e["id"]}
        unsafe = {self._room_at(o["x"], o["y"]) for o in threats}
        thresholds = {_idxy(*p) for d in self._doors for p in (d["a"], d["b"])}
        room_dist, queue = [-1] * len(self._room_rects), [home]
        room_dist[home] = 0
        for current in queue:
            for d in self._doors:
                if not d["open"]:
                    continue
                a, b = self._room_at(*d["a"]), self._room_at(*d["b"])
                rid = b if a == current else a if b == current else -1
                if rid >= 0 and room_dist[rid] < 0:
                    room_dist[rid] = room_dist[current] + 1
                    queue.append(rid)
        maps = [self._path_map(o, True) for o in threats]
        options = []
        for n, distance in enumerate(m.dist):
            rid = self._room_grid[n]
            if distance > 0 and n not in occupied and rid != home and rid not in unsafe:
                safety = min((10000 if t.dist[n] < 0 else t.dist[n] for t in maps), default=float("inf"))
                options.append((room_dist[rid], int(n in thresholds), -safety, distance, n))
        if options:
            goal = min(options)[4]
            return {"path": _full_path(m, goal), "target": None, "purpose": "refuge",
                    "fromRoom": home, "toRoom": self._room_grid[goal]}
        return _idle()

    def _chase_blue(self, e: Entity, m: _PathMap) -> dict[str, Any]:
        choices = []
        for blue in self._alive():
            if blue["color"] != "blue" or blue["size"] > e["size"] or self._enclosed(blue):
                continue
            for dx, dy in DIRS:
                x, y = blue["x"] + dx, blue["y"] + dy
                if not (0 <= x < COLS and 0 <= y < ROWS) or not self._adjacent_cells((blue["x"], blue["y"]), (x, y)):
                    continue
                n = _idxy(x, y)
                if m.dist[n] < 0 or any(o["id"] != e["id"] and o["x"] == x and o["y"] == y for o in self._alive()):
                    continue
                path = _full_path(m, n)
                if self._room_at(x, y) != self._room_at(blue["x"], blue["y"]):
                    path.append((blue["x"], blue["y"]))
                choices.append((len(path), blue["id"], n, path))
        if not choices:
            return _idle()
        choice = min(choices, key=lambda o: o[:3])
        return {"path": choice[3], "target": choice[1], "purpose": "chase_blue"}

    def _choose_journey(self, e: Entity) -> dict[str, Any]:
        if e["color"] == "green":
            return _idle()
        if e["color"] == "blue":
            return self._refuge_journey(e)
        m = self._path_map(e)
        targets = [o for o in self._alive() if self._can_eat(e, o)
                   and (e["color"] != "red" or o["color"] != "green")
                   and m.dist[_idxy(o["x"], o["y"])] >= 0]
        targets.sort(key=lambda o: (m.dist[_idxy(o["x"], o["y"])], o["id"]))
        if targets:
            target = targets[0]
            return {"path": _full_path(m, _idxy(target["x"], target["y"])), "target": target["id"], "purpose": "hunt"}
        return self._chase_blue(e, m) if e["color"] == "red" else _idle()

    def _reactive_refuges(self, red: Entity, events: list[Event], frames: list[Raster],
                          timeline: list[Event], draw: bool, entering: int | None = None) -> bool:
        if not red["alive"] or red["color"] != "red":
            return False
        room = self._room_at(red["x"], red["y"]) if entering is None else entering
        blues = sorted((b for b in self._alive() if b["color"] == "blue"
                        and self._room_at(b["x"], b["y"]) == room), key=lambda b: b["id"])
        moved = False
        for blue in blues:
            j = self._refuge_journey(blue, None if entering is None else red)
            if not j["path"]:
                continue
            events.append({"type": "escape", "id": blue["id"], "trigger": red["id"],
                           "fromRoom": room, "toRoom": j["toRoom"], "reason": "red_in_room"})
            if draw:
                self._stamp_frame(frames, timeline, "reaction", actor=blue["id"], trigger=red["id"],
                                  fromRoom=room, toRoom=j["toRoom"])
            self._travel_and_eat(blue, j, events, frames, timeline, draw)
            moved = True
        return moved

    # --- Native 64x64 renderer and exact presentation timeline ------------------

    def _build_static_frame(self) -> bytearray:
        f = bytearray([5]) * (SIZE * SIZE)
        _fill(f, 1, OY + 1, 62, 55, 4)
        _outline(f, 0, OY, 64, 57, 2)
        for y in range(ROWS):
            for x in range(COLS):
                if x < COLS - 1 and self._room_at(x, y) != self._room_at(x + 1, y):
                    _fill(f, (x + 1) * CELL, OY + y * CELL, 1, CELL + 1, 2)
                if y < ROWS - 1 and self._room_at(x, y) != self._room_at(x, y + 1):
                    _fill(f, x * CELL, OY + (y + 1) * CELL, CELL + 1, 1, 2)
        for p in self._level.get("blocks", []):
            c = center(*p)
            _fill(f, c["x"] - 3, c["y"] - 3, 7, 7, 2)
        return f

    def _render_frame(self, *, positions: dict[int, dict[str, int]] | None = None,
                      bite: dict[str, int] | None = None, border: int | None = None,
                      red: bool = False) -> Raster:
        f = bytearray(self._static_frame)
        for d in self._doors:
            r = self.door_rect(d)
            x, y, w, h = r["x"], r["y"], r["w"], r["h"]
            _fill(f, x, y, w, h, 4 if d["open"] else 13)
            if w == 1:
                _fill(f, x, y - 1, 1, 1, 1)
                _fill(f, x, y + h, 1, 1, 1)
                if not d["open"]:
                    _fill(f, x, y + 2, 1, 1, 7)
            else:
                _fill(f, x - 1, y, 1, 1, 1)
                _fill(f, x + w, y, 1, 1, 1)
                if not d["open"]:
                    _fill(f, x + 2, y, 1, 1, 7)
            if self._selected_door == d["id"]:
                if w == 1:
                    _fill(f, x - 1, y - 1, 3, 1, 0)
                    _fill(f, x - 1, y + h, 3, 1, 0)
                else:
                    _fill(f, x - 1, y - 1, 1, 3, 0)
                    _fill(f, x + w, y - 1, 1, 3, 0)
        for e in self._alive():
            p = (positions or {}).get(e["id"]) or self._frozen_pixels.get(e["id"]) or center(e["x"], e["y"])
            for dx, dy in MASKS[e["size"]]:
                _fill(f, p["x"] + dx, p["y"] + dy, 1, 1, COLORS[e["color"]])
        if bite is not None:
            c = center(bite["x"], bite["y"])
            _outline(f, c["x"] - 3, c["y"] - 3, 7, 7, 0)
        for i in range(self._level["budget"]):
            _fill(f, 2 + i * 2, 1, 1, 1, 1 if i < self.actions_left else 2)
        for i in range(LEVEL_COUNT):
            _fill(f, 2 + i * 5, 62, 4, 1, 14 if i < len(self._completed) and self._completed[i] else 2)
        if border is not None:
            _outline(f, 0, 0, SIZE, SIZE, border)
        if red:
            f[:] = bytes([8]) * (SIZE * SIZE)
        return [list(f[y * SIZE:(y + 1) * SIZE]) for y in range(SIZE)]

    def _stamp_frame(self, frames: list[Raster], timeline: list[Event], kind: str = "tick",
                      options: dict[str, Any] | None = None, **extra: Any) -> None:
        frames.append(self._render_frame(**(options or {})))
        timeline.append({"level": self._index + 1, "tick": self.tick, "kind": kind, **extra})

    # --- Meals, complete journeys, interruption and turn scheduling -------------

    def _consume(self, e: Entity, victim: Entity, events: list[Event]) -> bool:
        was, groups = e["color"], self._linked_rooms()
        witnesses = [o for o in self._mobile() if o["id"] not in (e["id"], victim["id"])
                     and o["color"] == "yellow" and self._same_neighborhood(o, victim, groups)]
        prey = {k: victim[k] for k in ("id", "color", "size", "x", "y")}
        victim["alive"] = False
        old = e["size"]
        if was == "red":
            e["size"] = min(5, old + 1)
        if victim["color"] == "green" and was in ("red", "orange"):
            e["color"] = "orange" if was == "red" else "yellow"
        events.append({"type": "eat", "eater": e["id"], "eaterColor": was,
                       "prey": prey["id"], "preyColor": prey["color"], "preySize": AREAS[prey["size"]],
                       "preyPosition": [prey["x"], prey["y"]], "mealRoom": self._room_at(prey["x"], prey["y"]),
                       "sizeBefore": AREAS[old], "sizeAfter": AREAS[e["size"]]})
        if prey["color"] != "green":
            for w in witnesses:
                w["color"] = "blue"
                events.append({"type": "mood", "id": w["id"], "from": "yellow", "to": "blue", "reason": "fear"})
        self._invalidate_paths()
        return prey["color"] == "purple" and was == "red"

    def _travel_and_eat(self, e: Entity, journey: dict[str, Any], events: list[Event],
                        frames: list[Raster], timeline: list[Event], draw: bool) -> dict[str, Any]:
        origin, color = [e["x"], e["y"]], e["color"]
        traversed = 0
        ate = won = reacted = room_limited = False
        refuge = journey["purpose"] == "refuge"
        if refuge and e["id"] in self._escaped_this_turn:
            return {"ate": ate, "won": won, "traversed": traversed, "reacted": reacted, "roomLimited": room_limited}
        for p in journey["path"]:
            if not self._adjacent_cells((e["x"], e["y"]), p):
                break
            victim = next((o for o in self._alive() if o["id"] != e["id"] and (o["x"], o["y"]) == tuple(p)), None)
            entry_announced, shown = False, 0
            old_room, new_room = self._room_at(e["x"], e["y"]), self._room_at(*p)
            a, b = center(e["x"], e["y"]), center(*p)
            if e["color"] == "red" and old_room != new_room and self._red_room_changes.get(e["id"], 0) >= 1:
                events.append({"type": "red_room_limit", "id": e["id"], "room": old_room, "nextRoom": new_room})
                room_limited = True
                break
            dx, dy = (b["x"] > a["x"]) - (b["x"] < a["x"]), (b["y"] > a["y"]) - (b["y"] < a["y"])

            def frame_at(k: int) -> None:
                self._stamp_frame(frames, timeline, "move",
                                  {"positions": {e["id"]: {"x": a["x"] + dx * k, "y": a["y"] + dy * k}}},
                                  actor=e["id"], target=journey["target"], purpose=journey["purpose"])

            if (victim is not None and victim["color"] == "blue" and e["color"] == "red"
                    and e["size"] >= victim["size"] and not self._enclosed(victim) and old_room != new_room):
                if not self._refuge_journey(victim, e)["path"]:
                    break
                radius = max(abs(v) for point in MASKS[e["size"]] for v in point)
                blue_radius = max(abs(v) for point in MASKS[victim["size"]] for v in point)
                shown = max(1, CELL - radius - blue_radius - 1)
                if draw:
                    for k in range(1, shown + 1):
                        frame_at(k)
                self._frozen_pixels[e["id"]] = {"x": a["x"] + dx * shown, "y": a["y"] + dy * shown}
                events.append({"type": "entry", "id": e["id"], "color": "red", "fromRoom": old_room,
                               "toRoom": new_room, "threshold": True})
                entry_announced = True
                # Always evaluate the reaction first, even when reacted is already true.
                reacted = self._reactive_refuges(e, events, frames, timeline, draw, new_room) or reacted
                del self._frozen_pixels[e["id"]]
                victim = next((o for o in self._alive() if o["id"] != e["id"] and (o["x"], o["y"]) == tuple(p)), None)
            if victim is not None and (journey["purpose"] in ("missed_meal", "refuge") or not self._can_eat(e, victim)):
                break
            if draw:
                for k in range(shown + 1, CELL):
                    frame_at(k)
            if e["color"] == "red" and old_room != new_room:
                self._red_room_changes[e["id"]] = self._red_room_changes.get(e["id"], 0) + 1
            if refuge:
                self._escaped_this_turn.add(e["id"])
            e["x"], e["y"] = p
            traversed += 1
            self._invalidate_paths()
            if victim is not None:
                events.append({"type": "move", "id": e["id"], "color": color, "cells": traversed,
                               "from": origin.copy(), "to": [e["x"], e["y"]], "target": victim["id"], "purpose": journey["purpose"]})
                won = self._consume(e, victim, events)
                ate = True
                if draw:
                    for _ in range(3):
                        self._stamp_frame(frames, timeline, "eat", {"bite": {"x": e["x"], "y": e["y"]}},
                                          actor=e["id"], prey=victim["id"])
            if draw:
                self._stamp_frame(frames, timeline, "move", actor=e["id"], target=journey["target"], purpose=journey["purpose"])
            if e["color"] == "red" and (old_room != self._room_at(e["x"], e["y"]) or ate):
                if not entry_announced and old_room != self._room_at(e["x"], e["y"]):
                    events.append({"type": "entry", "id": e["id"], "color": "red", "fromRoom": old_room,
                                   "toRoom": self._room_at(e["x"], e["y"])})
                if not won:
                    reacted = self._reactive_refuges(e, events, frames, timeline, draw) or reacted
            if ate or reacted:
                break
        if traversed and not ate:
            events.append({"type": "move", "id": e["id"], "color": color, "cells": traversed,
                           "from": origin, "to": [e["x"], e["y"]], "target": journey["target"], "purpose": journey["purpose"]})
        return {"ate": ate, "won": won, "traversed": traversed, "reacted": reacted, "roomLimited": room_limited}

    def _turn(self, frames: list[Raster], timeline: list[Event], draw: bool = True) -> dict[str, Any]:
        self.tick += 1
        self._reset_turn_limits()
        events: list[Event] = []
        self._mood_phase(events)
        changed = {e["id"] for e in events if e["type"] == "mood"}
        if draw and events:
            self._stamp_frame(frames, timeline, "mood")
        acted: set[int] = set()

        def act(eid: int) -> bool:
            e = self._entity(eid)
            if e is None or not e["alive"] or eid in acted:
                return False
            acted.add(eid)
            sweep, hunter, seen = e["color"] == "purple", e["color"] == "red", set()
            while e["alive"]:
                if hunter:
                    self._reactive_refuges(e, events, frames, timeline, draw)
                signature = tuple((o["id"], o["color"], o["size"], o["x"], o["y"]) for o in self._alive())
                if signature in seen:
                    events.append({"type": "chase_cycle", "id": e["id"], "color": e["color"]})
                    break
                seen.add(signature)
                journey = self._choose_journey(e)
                if not journey["path"]:
                    break
                if journey["purpose"] == "chase_blue":
                    events.append({"type": "pursuit", "id": e["id"], "target": journey["target"]})
                result = self._travel_and_eat(e, journey, events, frames, timeline, draw)
                if result["won"]:
                    return True
                if result["roomLimited"]:
                    break
                if result["ate"]:
                    if sweep and e["color"] == "purple":
                        continue
                    break
                if hunter and e["color"] == "red" and (result["traversed"] or result["reacted"]):
                    continue
                break
            return False

        def commit() -> None:
            self._last_events = events
            self._log.extend({**v, "tick": self.tick} for v in events)
            self._log = self._log[-100:]

        non_reds = [e["id"] for e in sorted(self._mobile(), key=lambda e: e["id"]) if e["color"] != "red"]
        for eid in non_reds:
            if act(eid):
                commit()
                return {"won": True, "events": events}
        pending = set(non_reds)
        for _ in range(len(non_reds)):
            moved = False
            for eid in non_reds:
                if eid not in pending:
                    continue
                e = self._entity(eid)
                if e is not None and self._approach_missed_meal(e, events, frames, timeline, draw):
                    pending.remove(eid)
                    moved = True
            if not moved:
                break
        before = len(events)
        self._scarcity_phase(events, changed)
        if draw and len(events) > before:
            self._stamp_frame(frames, timeline, "mood")
        reds = [e["id"] for e in sorted(self._mobile(), key=lambda e: e["id"]) if e["color"] == "red"]
        for eid in reds:
            if eid in acted and any(v["type"] == "mood" and v["id"] == eid and v["to"] == "red"
                                    and v["reason"] == "food_competition" for v in events):
                acted.remove(eid)
            if act(eid):
                commit()
                return {"won": True, "events": events}
        commit()
        if draw:
            self._stamp_frame(frames, timeline, "tick")
        if not any(e["color"] != "purple" for e in self._mobile()):
            return {"failure": "no_survivor", "events": events}
        if self.actions_left == 0:
            return {"failure": "budget_exhausted", "events": events}
        return {"events": events}

    def _finish(self, frames: list[Raster], timeline: list[Event]) -> int:
        played = self._index + 1
        self._completed[self._index] = True
        for _ in range(3):
            self._stamp_frame(frames, timeline, "success", {"border": 14})
        self._stamp_frame(frames, timeline, "success")
        if self.test_mode or self._index == self.win_levels - 1:
            self.state = "WIN"
        else:
            self._setup(self._index + 1)
        self._stamp_frame(frames, timeline, "level")
        return played

    def _fail(self, frames: list[Raster], timeline: list[Event], reason: str) -> dict[str, Any]:
        played = self._index + 1
        for _ in range(3):
            self._stamp_frame(frames, timeline, "failure", {"red": True})
        self.attempts += 1
        self._setup(self._index)
        self._stamp_frame(frames, timeline, "reset")
        return {"reason": reason, "played_level": played}

    # --- Public custom-game adapter --------------------------------------------

    def _response(self, event: str, frames: list[Raster] | None = None,
                  timeline: list[Event] | None = None, **extra: Any) -> dict[str, Any]:
        self._event = event
        self._pending_frames = frames
        self._pending_timeline = timeline or []
        self._pending_extra = extra
        return self.public_state()

    def action(self, action_id: int | str | dict[str, Any],
               data: dict[str, Any] | None = None) -> dict[str, Any]:
        if isinstance(action_id, Mapping):
            packet = action_id
            data = packet.get("data") or {}
            action_id = packet.get("id") if packet.get("id") is not None else packet.get("action")
        if (type(action_id) is int and action_id == 0) or action_id == "RESET":
            return self.reset()
        if (type(action_id) is int and action_id == ACTION_RESET) or action_id == "ACTION7":
            return self.level_reset()
        if self.state == "WIN":
            return self._response("finished")
        if not ((type(action_id) is int and action_id == ACTION_CLICK) or action_id == "ACTION6"):
            return self._response("ignored")
        if (not isinstance(data, Mapping) or type(data.get("x")) is not int or type(data.get("y")) is not int
                or not 0 <= data["x"] < SIZE or not 0 <= data["y"] < SIZE):
            return self._response("ignored")
        x, y = data["x"], data["y"]
        door = next((d for d in self._doors if _inside(x, y, self.door_rect(d))), None)
        if door is None:
            candidates = [d for d in self._doors if _inside(x, y, self.door_hit(d))]

            def rank(d: Door) -> tuple[float, int]:
                r = self.door_rect(d)
                distance = abs(x - (r["x"] + (r["w"] - 1) / 2)) + abs(y - (r["y"] + (r["h"] - 1) / 2))
                return distance, d["id"]

            door = min(candidates, key=rank) if candidates else None
        if door is None:
            return self._response("ignored")
        if self.actions_left == 0:
            return self._response("budget")
        door["open"] = not door["open"]
        self._invalidate_topology()
        self._selected_door = door["id"]
        self.actions_left -= 1
        self.step_index += 1
        self.last_action = "ACTION6"
        frames: list[Raster] = []
        timeline: list[Event] = []
        self._stamp_frame(frames, timeline, "door")
        result = self._turn(frames, timeline)
        events = [{"type": "door", "id": door["id"], "open": door["open"]}, *copy.deepcopy(result["events"])]
        if result.get("won"):
            played = self._finish(frames, timeline)
            return self._response("win" if self.state == "WIN" else "success", frames, timeline,
                                  played_level=played, events=events)
        if result.get("failure"):
            failed = self._fail(frames, timeline, result["failure"])
            return self._response("failure", frames, timeline, events=events, **failed)
        return self._response("door", frames, timeline, events=events)

    def step(self, action: int | str | dict[str, Any], data: dict[str, Any] | None = None) -> dict[str, Any]:
        return self.action(action, data)

    def reset(self) -> dict[str, Any]:
        self._completed = [False] * len(self._templates)
        self.test_mode = False
        self.step_index = self.attempts = 0
        self.last_action = "RESET"
        self._setup(0)
        return self._response("reset")

    def level_reset(self) -> dict[str, Any]:
        self._completed[self._index] = False
        self.attempts += 1
        self.last_action = "ACTION7"
        self._setup(self._index)
        return self._response("restart")

    def public_state(self) -> dict[str, Any]:
        """Return an animation once; subsequent reads neither advance nor replay it.

        Events are observed consequences, not predictions. For a strictly visual
        agent, forward frames plus legal actions/state/score, not debug metadata.
        """
        frames = self._pending_frames or [self._render_frame()]
        timeline, extra = self._pending_timeline, self._pending_extra
        self._pending_frames, self._pending_timeline, self._pending_extra = None, [], {}
        original_frame_count = len(frames)
        if self._animation_frame_reduction > 1 and original_frame_count > 2:
            count = max(2, (original_frame_count + self._animation_frame_reduction - 1)
                        // self._animation_frame_reduction)
            indices = tuple(i * (original_frame_count - 1) // (count - 1)
                            for i in range(count))
            frames = [frames[i] for i in indices]
            if len(timeline) == original_frame_count:
                timeline = [timeline[i] for i in indices]
        available = ["ACTION7"] if self.state == "WIN" else ["ACTION6", "ACTION7"]
        return {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "custom_family": self.info.family, "wave": WAVE,
            "frame": frames[-1], "frames": frames, "frame_count": len(frames), "timeline": timeline,
            "animation_frame_reduction": self._animation_frame_reduction,
            "animation_original_frame_count": original_frame_count,
            "default_fps": max(self._fps, ANIM_FPS) if len(frames) > 1 else self._fps,
            "state": self.state, "level": self._index + 1,
            "score": self.levels_completed, "levels_completed": self.levels_completed,
            "win_levels": 1 if self.test_mode else self.win_levels,
            "win_score": 1 if self.test_mode else self.win_levels, "test_mode": self.test_mode,
            "available_actions": available, "available_action_ids": [int(a[6:]) for a in available],
            "tick": self.tick, "step_index": self.step_index, "last_action": self.last_action,
            "door_actions_left": self.actions_left, "door_action_budget": self._level["budget"],
            "attempts": self.attempts, "last_events": copy.deepcopy(self._last_events),
            "full_reset": False, "source_path": str(self.levels_dir), "level_name": self._level["title"],
            "event": self._event, **extra,
        }

    def observe(self) -> dict[str, Any]:
        return self.public_state()

    def view(self) -> dict[str, Any]:
        """Human/debug visualizer metadata; do NOT use as a raster-only agent input."""
        level = self._level
        result = {
            "title": level["title"], "subtitle": level.get("subtitle"),
            "scenario": level.get("scenario", ""), "tutorial": copy.deepcopy(level.get("tutorial")),
            "level": self._index + 1, "tick": self.tick, "budget": level["budget"], "actionsLeft": self.actions_left,
            "rooms": copy.deepcopy(self._room_rects),
            "doors": [{**copy.deepcopy(d), "rect": self.door_rect(d), "hit": self.door_hit(d)} for d in self._doors],
            "entities": [{**copy.deepcopy(e), "area": AREAS[e["size"]], "room": self._room_at(e["x"], e["y"]),
                          "enclosed": self._enclosed(e)} for e in self._alive()],
            "groups": self._linked_rooms().copy(), "completed": self._completed.copy(), "preview": self.test_mode,
            "state": self.state, "attempts": self.attempts, "log": copy.deepcopy(self._log),
        }
        if "subtitle" not in level:
            result.pop("subtitle")
        for source, target in (("minimum_clicks", "minimumClicks"), ("solution_clicks", "solutionClicks")):
            if source in level:
                result[target] = level[source]
        return result

    def metadata(self) -> list[dict[str, Any]]:
        result = []
        for i, l in enumerate(self._templates):
            row = {"number": i + 1, "title": l["title"], "rooms": len(self._partitions[i][1]),
                   "doors": len(l["doors"]), "entities": len(l["entities"]), "budget": l["budget"],
                   "boss": AREAS[next(e["size"] for e in l["entities"] if e["color"] == "purple")]}
            if "minimum_clicks" in l:
                row["minimumClicks"] = l["minimum_clicks"]
            result.append(row)
        return result

    def jump_to_level(self, number: int) -> dict[str, Any]:
        """Author-only preview. Does not grant earlier levels or count as an action."""
        number = _integer(number, "level", 1, len(self._templates))
        self.test_mode = True
        self._completed = [False] * len(self._templates)
        self.attempts = self.step_index = 0
        self.last_action = "PREVIEW"
        self._setup(number - 1)
        return self._response("preview")

    # Kept explicitly separate from public actions for cross-language tests.
    def inspect(self) -> dict[str, Any]:
        return {"entities": copy.deepcopy(self._entities), "doors": copy.deepcopy(self._doors), "tick": self.tick,
                "actionsLeft": self.actions_left, "index": self._index, "state": self.state}

    def debug_load(self, snapshot: dict[str, Any]) -> None:
        """Author-only restoration of a snapshot from this level, not a game action."""
        self._reset_turn_limits()
        self._frozen_pixels = {}
        self._entities, self._doors = copy.deepcopy(snapshot["entities"]), copy.deepcopy(snapshot["doors"])
        self._invalidate_topology()
        self.tick = snapshot.get("tick", 0)
        self.actions_left = snapshot["actionsLeft"]
        self.state = snapshot.get("state", "NOT_FINISHED")
        self._last_events, self._log = [], []

    def debug_click(self, door_id: int) -> dict[str, Any]:
        """Author-only unrendered transition, deliberately no campaign advancement."""
        if (type(door_id) is not int or not 0 <= door_id < len(self._doors)
                or self.actions_left <= 0 or self.state == "WIN"):
            return {"ignored": True}
        d = self._doors[door_id]
        d["open"] = not d["open"]
        self._invalidate_topology()
        self.actions_left -= 1
        self._selected_door = door_id
        result = self._turn([], [], False)
        if result.get("won"):
            self.state = "WIN"
        return result

    def debug_journey(self, entity_id: int) -> dict[str, Any] | None:
        entity = next((e for e in self._alive() if e["id"] == entity_id), None)
        result = copy.deepcopy(self._choose_journey(entity)) if entity is not None else None
        if result is not None:
            result["path"] = [list(p) for p in result["path"]]
        return result

    levelReset = level_reset
    jumpToLevel = jump_to_level
    debugLoad = debug_load
    debugClick = debug_click
    debugJourney = debug_journey


__all__ = ["UpsetEngine", "LEVELS_DIR", "GAME_ID", "FAMILY", "WAVE", "WEB_VERSION", "PALETTE",
           "COLORS", "AREAS", "MASKS", "FRAME", "SIZE", "CELL", "COLS", "ROWS", "ANIM_FPS",
           "ACTION_CLICK", "ACTION_RESET", "center", "predation_allowed"]
