"""GIGO — Gigognes v3 / custom_3, deterministic Python port of the web game.

ACTION1–4: translate the selected room and ALL its descendants by one cell.
ACTION5: display the region reachable from the cyan source (no movement).
ACTION6: select a room at native coordinates, or click the diagnostic button.
ACTION7: restart the current level; reset()/ACTION0 restart the campaign.

Rooms may touch the parent, partitions and siblings. There is no minimum or
maximum clearance, no fixed sibling ordering and no pushing or overlap. The
victory condition is solely a cardinal path from the source to the outer exit.
The obligatory sibling traversals in L3/L6 arise from geometry, not secret flags.

Python 3.10+, standard library only. Install the SIX level JSON files in
custom_games/games/nested_rooms/levels. No JS runtime, network, random generator,
wall clock, solver or witness file is used at runtime. All animation frames use
integer palette indices 0..15; public_state() consumes an animation only once.
"""
from __future__ import annotations

import copy
import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

SIZE = FRAME = 64
LEVEL_COUNT = 6
ANIM_FPS = 30
GAME_ID, FAMILY, WAVE = "gigo-c3000001", "nested_rooms", "custom_3"
WEB_VERSION = "v3"
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / FAMILY / "levels"
ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_TEST, ACTION_CLICK, ACTION_RESET = 5, 6, 7
DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))  # Also the exact BFS tie order.
TEST_BUTTON = {"x": 53, "y": 60, "w": 9, "h": 4}
PALETTE = (
    "#F3F2EB", "#C9CDC8", "#37404B", "#66707B", "#1B2028", "#11161C",
    "#B555B5", "#E7B9A3", "#F06B65", "#679DEB", "#63D5D6", "#F1CE62",
    "#EBA258", "#86513A", "#77CB93", "#BB94EB",
)
Raster = list[list[int]]
Room = dict[str, Any]
Level = dict[str, Any]
Point = dict[str, int]


def _integer(value: Any, label: str, lo: int, hi: int) -> int:
    # bool is deliberately not a coordinate or a level number.
    if type(value) is not int or not lo <= value <= hi:
        raise ValueError(f"{label}: expected an integer in {lo}..{hi}, got {value!r}")
    return value


def _inside(x: int, y: int, r: Mapping[str, int]) -> bool:
    return r["x"] <= x < r["x"] + r["w"] and r["y"] <= y < r["y"] + r["h"]


def _fill(buf: bytearray, x: int, y: int, w: int, h: int, color: int) -> None:
    left, right = max(0, x), min(SIZE, x + w)
    if right <= left:
        return
    stripe = bytes([color]) * (right - left)
    for yy in range(max(0, y), min(SIZE, y + h)):
        buf[yy * SIZE + left:yy * SIZE + right] = stripe


def _outline(buf: bytearray, x: int, y: int, w: int, h: int, color: int) -> None:
    _fill(buf, x, y, w, 1, color)
    _fill(buf, x, y + h - 1, w, 1, color)
    _fill(buf, x, y, 1, h, color)
    _fill(buf, x + w - 1, y, 1, h, color)


def door_xy(room: Room, door: dict[str, Any]) -> tuple[int, int]:
    side, at = door["side"], door["at"]
    if side == "N":
        return at, 0
    if side == "S":
        return at, room["h"] - 1
    if side == "W":
        return 0, at
    return room["w"] - 1, at


def wall_cells(room: Room) -> list[tuple[int, int]]:
    """Rim minus door apertures, then attached blocks, in web insertion order."""
    holes = {door_xy(room, d) for d in room["doors"]}
    cells = [(x, y) for y in range(room["h"]) for x in range(room["w"])
             if (x in (0, room["w"] - 1) or y in (0, room["h"] - 1))
             and (x, y) not in holes]
    seen = set(cells)
    for x, y in room.get("blocks", []):
        if (x, y) not in seen:
            cells.append((x, y))
            seen.add((x, y))
    return cells


def child_rooms(rooms: Sequence[Room], parent: int) -> list[Room]:
    return [r for r in rooms if r["parent"] == parent]


def descendants(rooms: Sequence[Room], room_id: int) -> set[int]:
    """Include the room itself. Valid level JSON orders parents before children."""
    ids = {room_id}
    for r in rooms:
        if r["parent"] in ids:
            ids.add(r["id"])
    return ids


def depth_of(rooms: Sequence[Room], room_id: int) -> int:
    depth, r = 0, rooms[room_id]
    while r["parent"] is not None:
        depth += 1
        r = rooms[r["parent"]]
    return depth


def group_gaps(rooms: Sequence[Room], parent: int) -> dict[str, int] | None:
    """Descriptive envelope gaps only; never a movement constraint."""
    p, children = rooms[parent], child_rooms(rooms, parent)
    if not children:
        return None
    return {"left": min(r["x"] for r in children) - 1,
            "top": min(r["y"] for r in children) - 1,
            "right": p["w"] - max(r["x"] + r["w"] for r in children) - 1,
            "bottom": p["h"] - max(r["y"] + r["h"] for r in children) - 1}


def own_gaps(rooms: Sequence[Room], room_id: int) -> dict[str, int] | None:
    if type(room_id) is not int or not 0 <= room_id < len(rooms):
        return None
    r = rooms[room_id]
    if r["parent"] is None:
        return None
    p = rooms[r["parent"]]
    return {"left": r["x"] - 1, "top": r["y"] - 1,
            "right": p["w"] - 1 - r["x"] - r["w"],
            "bottom": p["h"] - 1 - r["y"] - r["h"]}


def collision_reason(rooms: Sequence[Room], room_id: int, x: int, y: int) -> str | None:
    if (type(room_id) is not int or not 0 < room_id < len(rooms)
            or type(x) is not int or type(y) is not int):
        return "invalid_position"
    r = rooms[room_id]
    p = rooms[r["parent"]]
    # Walls remain adjacent, never merged into the same cell.
    if x < 1 or y < 1 or x + r["w"] > p["w"] - 1 or y + r["h"] > p["h"] - 1:
        return "parent_wall"
    if any(x <= bx < x + r["w"] and y <= by < y + r["h"]
           for bx, by in p.get("blocks", [])):
        return "partition"
    for sibling in child_rooms(rooms, r["parent"]):
        if sibling["id"] == room_id:
            continue
        # Half-open rectangles: equality is contact, not collision.
        if (x < sibling["x"] + sibling["w"] and x + r["w"] > sibling["x"]
                and y < sibling["y"] + sibling["h"] and y + r["h"] > sibling["y"]):
            return "sibling"
    return None


def relative_legal(rooms: Sequence[Room], room_id: int, x: int, y: int) -> bool:
    return collision_reason(rooms, room_id, x, y) is None


def world_rooms(rooms: Sequence[Room]) -> list[Room]:
    """Absolute logical positions, relative to the fixed outer frame's origin."""
    out: list[Room] = []
    for room in rooms:
        parent = None if room["parent"] is None else out[room["parent"]]
        out.append({**room,
                    "gx": 0 if parent is None else parent["gx"] + room["x"],
                    "gy": 0 if parent is None else parent["gy"] + room["y"]})
    return out


def validate_level(level: Level, label: str = "level") -> bool:
    """Validate geometry before accepting level data; do not alter the data."""
    if not isinstance(level, dict):
        raise ValueError(f"{label}: expected a JSON object")
    _integer(level.get("number"), label + ".number", 1, LEVEL_COUNT)
    _integer(level.get("cell_px"), label + ".cell_px", 1, 2)
    rooms = level.get("rooms")
    if not isinstance(rooms, list) or len(rooms) < 2:
        raise ValueError(f"{label}.rooms: expected the root and at least one child")
    # First validate all records, then cross-record geometry and topology.
    for i, room in enumerate(rooms):
        key = f"{label}.rooms[{i}]"
        if not isinstance(room, dict):
            raise ValueError(f"{key}: expected an object")
        _integer(room.get("id"), key + ".id", i, i)
        if i == 0:
            if room.get("parent", -1) is not None:
                raise ValueError(f"{key}.parent must be null")
        else:
            _integer(room.get("parent"), key + ".parent", 0, i - 1)
        _integer(room.get("x"), key + ".x", 0, 63)
        _integer(room.get("y"), key + ".y", 0, 63)
        _integer(room.get("w"), key + ".w", 5, 64)
        _integer(room.get("h"), key + ".h", 5, 64)
        _integer(room.get("color"), key + ".color", 0, 15)
        doors = room.get("doors")
        if not isinstance(doors, list) or not doors:
            raise ValueError(f"{key}: every room needs a door")
        seen: set[tuple[int, int]] = set()
        for door in doors:
            if not isinstance(door, dict) or door.get("side") not in ("N", "E", "S", "W"):
                raise ValueError(f"{key}: invalid door side")
            end = room["w"] if door["side"] in ("N", "S") else room["h"]
            _integer(door.get("at"), key + ".door.at", 1, end - 2)
            point = door_xy(room, door)
            if point in seen:
                raise ValueError(f"{key}: duplicate door {point}")
            seen.add(point)
        blocks = room.get("blocks", [])
        if not isinstance(blocks, list):
            raise ValueError(f"{key}.blocks: expected a list")
        for point in blocks:
            if not isinstance(point, (list, tuple)) or len(point) != 2:
                raise ValueError(f"{key}: expected block [x, y]")
            _integer(point[0], key + ".block.x", 1, room["w"] - 2)
            _integer(point[1], key + ".block.y", 1, room["h"] - 2)
    for r in rooms:
        if r["id"] and not relative_legal(rooms, r["id"], r["x"], r["y"]):
            reason = collision_reason(rooms, r["id"], r["x"], r["y"])
            raise ValueError(f"{label}: initial collision of room {r['id']}: {reason}")
        if len(child_rooms(rooms, r["id"])) > 2:
            raise ValueError(f"{label}: at most two direct children per room")
    root = rooms[0]
    if (len(root["doors"]) != 1 or root["doors"][0]["side"] == "S"
            or root["x"] + root["w"] * level["cell_px"] > SIZE
            or root["y"] + root["h"] * level["cell_px"] > 59):
        raise ValueError(f"{label}: invalid outer enclosure")
    source = level.get("source")
    if not isinstance(source, dict):
        raise ValueError(f"{label}: missing source")
    rid = _integer(source.get("room"), label + ".source.room", 1, len(rooms) - 1)
    room = rooms[rid]
    _integer(source.get("x"), label + ".source.x", 1, room["w"] - 2)
    _integer(source.get("y"), label + ".source.y", 1, room["h"] - 2)
    if child_rooms(rooms, rid) or (source["x"], source["y"]) in wall_cells(room):
        raise ValueError(f"{label}: source must occupy free floor in a leaf room")
    if "selected_start" in level:
        _integer(level["selected_start"], label + ".selected_start", 1, len(rooms) - 1)
    return True


def _load_levels(directory: Path) -> list[Level]:
    levels: list[Level] = []
    for number in range(1, LEVEL_COUNT + 1):
        path = directory / f"L{number:02d}.json"
        if not path.is_file():
            raise FileNotFoundError(f"Missing level: {path}. Install the six JSON files with the engine.")
        try:
            level = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON in {path}: {exc}") from exc
        validate_level(level, str(path))
        if level["number"] != number:
            raise ValueError(f"{path}: expected level number {number}")
        levels.append(level)
    return levels


def configuration(level: Level, rooms: Sequence[Room]) -> dict[str, Any]:
    """Current geometry only: no solution search over room translations."""
    world = world_rooms(rooms)
    width, height = rooms[0]["w"], rooms[0]["h"]
    blocked = bytearray(width * height)
    owner = [-1] * (width * height)
    for room in world:
        for y in range(room["gy"], room["gy"] + room["h"]):
            start = y * width + room["gx"]
            owner[start:start + room["w"]] = [room["id"]] * room["w"]
        for x, y in wall_cells(room):
            blocked[(room["gy"] + y) * width + room["gx"] + x] = 1
    source_room = world[level["source"]["room"]]
    ex, ey = door_xy(rooms[0], rooms[0]["doors"][0])
    return {"wr": world, "w": width, "h": height, "blocked": blocked, "owner": owner,
            "source": {"x": source_room["gx"] + level["source"]["x"],
                       "y": source_room["gy"] + level["source"]["y"]},
            "exit": {"x": ex, "y": ey}}


def search_path(config: dict[str, Any]) -> dict[str, Any]:
    """BFS with the exact web ordering, including the full reachable region.

    If disconnected, path ends at the visited cell nearest to the exit in
    Manhattan distance. Only a connected path can trigger success.
    """
    w, h = config["w"], config["h"]
    blocked, source, target = config["blocked"], config["source"], config["exit"]
    start, goal = source["y"] * w + source["x"], target["y"] * w + target["x"]
    previous = [-2] * (w * h)
    previous[start] = -1
    queue, index, last = [start], 0, start
    best_distance = abs(source["x"] - target["x"]) + abs(source["y"] - target["y"])
    while index < len(queue):
        v = queue[index]
        index += 1
        x, y = v % w, v // w
        distance = abs(x - target["x"]) + abs(y - target["y"])
        if distance < best_distance:
            last, best_distance = v, distance
        for dx, dy in DIRS:
            nx, ny = x + dx, y + dy
            nv = ny * w + nx
            if not (0 <= nx < w and 0 <= ny < h) or blocked[nv] or previous[nv] != -2:
                continue
            previous[nv] = v
            queue.append(nv)
    connected = previous[goal] != -2
    path: list[Point] = []
    v = goal if connected else last
    while v >= 0:
        path.append({"x": v % w, "y": v // w})
        v = previous[v]
    path.reverse()
    return {"connected": connected, "path": path,
            "visited": [{"x": v % w, "y": v // w} for v in queue]}


class NestedRoomsEngine:
    """FITE-style custom engine for the accepted Gigognes web v3.

    info supplies game_id, title, family, levels and default_fps. Normally
    info.levels == 6. A smaller campaign prefix is supported like the other
    custom ports. level_data / jump_to_level are author-only test facilities.
    """

    def __init__(self, info: CustomGameInfo, *, levels_dir: str | Path | None = None,
                 level_data: list[Level] | None = None) -> None:
        if levels_dir is not None and level_data is not None:
            raise ValueError("Use either levels_dir or level_data, not both")
        self.info = info
        self.levels_dir = Path(levels_dir).resolve() if levels_dir is not None else LEVELS_DIR
        if level_data is None:
            self._templates = _load_levels(self.levels_dir)
        else:
            if not isinstance(level_data, list) or not 1 <= len(level_data) <= LEVEL_COUNT:
                raise ValueError("level_data must contain 1..6 levels")
            self._templates = copy.deepcopy(level_data)
            for i, level in enumerate(self._templates):
                validate_level(level, f"level_data[{i}]")
        self.win_levels = _integer(info.levels, "info.levels", 1, len(self._templates))
        self._fps = _integer(info.default_fps, "info.default_fps", 1, 240)
        self._completed = [False] * LEVEL_COUNT
        self._rooms: list[Room] = []
        self._index = 0
        self.selected_room = 1
        self.moves = self.checks = self.step_index = self.attempts = 0
        self.test_mode = False
        self.state = "NOT_FINISHED"
        self.last_action = "RESET"
        self._event = "ready"
        self._final_path: list[Point] | None = None
        self._pending_frames: list[Raster] | None = None
        self._pending_extra: dict[str, Any] = {}
        self._setup(0)

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    @property
    def _level(self) -> Level:
        return self._templates[self._index]

    def _setup(self, index: int) -> None:
        self._index = index
        self._rooms = copy.deepcopy(self._level["rooms"])
        self.selected_room = self._level.get("selected_start", 1)
        self.moves = self.checks = 0
        self.state = "NOT_FINISHED"
        self._final_path = None
        # Wall shapes never change during a level; positions are stored apart.
        self._wall_masks = [wall_cells(r) for r in self._rooms]

    def _native(self, point: Point) -> Point:
        unit, root = self._level["cell_px"], self._rooms[0]
        return {"x": root["x"] + point["x"] * unit + unit // 2,
                "y": root["y"] + point["y"] * unit + unit // 2}

    def _full_native_path(self, path: Sequence[Point]) -> list[Point]:
        points: list[Point] = []

        def extend(point: Point) -> None:
            if not points:
                points.append(dict(point))
                return
            x, y = points[-1]["x"], points[-1]["y"]
            while x != point["x"] or y != point["y"]:
                x += (point["x"] > x) - (point["x"] < x)
                y += (point["y"] > y) - (point["y"] < y)
                points.append({"x": x, "y": y})

        for point in path:
            extend(self._native(point))
        side = self._rooms[0]["doors"][0]["side"]
        last = points[-1]
        if side == "E":
            extend({"x": 63, "y": last["y"]})
        elif side == "W":
            extend({"x": 0, "y": last["y"]})
        else:
            extend({"x": last["x"], "y": 0})
        return points

    def _render_frame(self, *, motion: dict[str, int] | None = None, blocked: bool = False,
                      reachable: Sequence[Point] | None = None, path: Sequence[Point] | None = None,
                      runner: Point | None = None, border: int | None = None) -> Raster:
        level, root = self._level, self._rooms[0]
        unit = level["cell_px"]
        world = world_rooms(self._rooms)
        moving = descendants(self._rooms, motion["id"]) if motion is not None else set()
        buf = bytearray([4]) * (SIZE * SIZE)
        _fill(buf, root["x"], root["y"], root["w"] * unit, root["h"] * unit, 5)
        for room in world:
            shifting = motion is not None and room["id"] in moving
            dx = motion["dx"] if shifting else 0
            dy = motion["dy"] if shifting else 0
            color = 0 if room["id"] == self.selected_room else room["color"]
            if room["id"] == self.selected_room and blocked:
                color = 6
            for x, y in self._wall_masks[room["id"]]:
                _fill(buf, root["x"] + (room["gx"] + x) * unit + dx,
                      root["y"] + (room["gy"] + y) * unit + dy, unit, unit, color)
        if reachable is not None:
            for point in reachable:
                _fill(buf, root["x"] + point["x"] * unit,
                      root["y"] + point["y"] * unit, unit, unit, 2)
        ex, ey = door_xy(root, root["doors"][0])
        exit_point = self._native({"x": ex, "y": ey})
        side = root["doors"][0]["side"]
        if side == "E":
            start = root["x"] + root["w"] * unit
            _fill(buf, start, exit_point["y"], SIZE - start, 1, 3)
        elif side == "W":
            _fill(buf, 0, exit_point["y"], root["x"], 1, 3)
        else:
            _fill(buf, exit_point["x"], 0, 1, root["y"], 3)
        gx = 63 if side == "E" else 0 if side == "W" else exit_point["x"]
        gy = 0 if side == "N" else exit_point["y"]
        _fill(buf, max(0, gx - 1), max(0, gy - 1), 3, 3, 14)
        sr = world[level["source"]["room"]]
        sp = self._native({"x": sr["gx"] + level["source"]["x"],
                           "y": sr["gy"] + level["source"]["y"]})
        if motion is not None and sr["id"] in moving:
            sp["x"] += motion["dx"]
            sp["y"] += motion["dy"]
        _fill(buf, sp["x"] - 1, sp["y"], 3, 1, 10)
        _fill(buf, sp["x"], sp["y"] - 1, 1, 3, 10)
        _fill(buf, sp["x"], sp["y"], 1, 1, 0)
        if path is None and self.state == "WIN":
            path = self._final_path
        if path is not None:
            for point in path:
                _fill(buf, point["x"], point["y"], 1, 1, 14)
        if runner is not None:
            _fill(buf, runner["x"], runner["y"], 1, 1, 0)
        for i in range(LEVEL_COUNT):
            _fill(buf, 3 + i * 5, 62, 4, 1, 14 if self._completed[i] else 2)
        _fill(buf, 54, 60, 1, 3, 10)
        _fill(buf, 56, 61, 2, 1, 1)
        _fill(buf, 59, 60, 1, 3, 14)
        _fill(buf, 60, 61, 1, 1, 14)
        if border is not None:
            _outline(buf, 0, 0, SIZE, SIZE, border)
        return [list(buf[y * SIZE:(y + 1) * SIZE]) for y in range(SIZE)]

    def _response(self, event: str, frames: list[Raster] | None = None, **extra: Any) -> dict[str, Any]:
        self._event = event
        self._pending_frames = frames
        self._pending_extra = extra
        return self.public_state()

    def _finish(self, path: Sequence[Point], frames: list[Raster]) -> dict[str, Any]:
        played, used = self._index + 1, self.moves
        native = self._full_native_path(path)
        for i in range(0, len(native), 3):
            frames.append(self._render_frame(path=native[:i + 1], runner=native[i]))
        frames.append(self._render_frame(path=native))
        self._completed[self._index] = True
        for _ in range(4):
            frames.append(self._render_frame(path=native, border=14))
        frames.append(self._render_frame(path=native))
        if self.test_mode or self._index == self.win_levels - 1:
            self.state = "WIN"
            self._final_path = native
        else:
            self._setup(self._index + 1)
        frames.append(self._render_frame())
        return self._response("win" if self.state == "WIN" else "success", frames,
                              played_level=played, used_moves=used, path_length=len(path) - 1)

    def _move(self, action_id: int) -> dict[str, Any]:
        dx, dy = DIRS[action_id - 1]
        room = self._rooms[self.selected_room]
        reason = collision_reason(self._rooms, self.selected_room, room["x"] + dx, room["y"] + dy)
        if reason is not None:
            return self._response("blocked", [self._render_frame(blocked=True), self._render_frame()],
                                  reason=reason)
        frames = [self._render_frame(motion={"id": self.selected_room, "dx": dx * p, "dy": dy * p})
                  for p in range(1, self._level["cell_px"] + 1)]
        room["x"] += dx
        room["y"] += dy
        self.moves += 1
        route = search_path(configuration(self._level, self._rooms))
        if route["connected"]:
            return self._finish(route["path"], frames)
        frames.append(self._render_frame())
        return self._response("move", frames)

    def _test_passage(self) -> dict[str, Any]:
        self.checks += 1
        route = search_path(configuration(self._level, self._rooms))
        if route["connected"]:
            return self._finish(route["path"], [])
        visited, frames = route["visited"], []
        for k in range(1, 7):
            count = (len(visited) * k + 5) // 6  # ceil(n*k/6), integer-exact.
            frames.append(self._render_frame(reachable=visited[:count]))
        for _ in range(7):
            frames.append(self._render_frame(reachable=visited))
        frames.append(self._render_frame())
        return self._response("test", frames, connected=False)

    def _click(self, x: Any, y: Any) -> dict[str, Any]:
        if type(x) is not int or type(y) is not int or not (0 <= x < SIZE and 0 <= y < SIZE):
            return self._response("ignored")
        if _inside(x, y, TEST_BUTTON):
            return self._test_passage()
        root, unit = self._rooms[0], self._level["cell_px"]
        gx, gy = (x - root["x"]) // unit, (y - root["y"]) // unit
        for room in reversed(world_rooms(self._rooms)[1:]):
            if room["gx"] <= gx < room["gx"] + room["w"] and room["gy"] <= gy < room["gy"] + room["h"]:
                self.selected_room = room["id"]
                return self._response("select")
        return self._response("ignored", reason="fixed_or_outside")

    def action(self, action_id: int | str | Mapping[str, Any],
               data: Mapping[str, Any] | None = None) -> dict[str, Any]:
        if isinstance(action_id, Mapping):
            packet = action_id
            data = packet.get("data")
            action_id = packet.get("id") if packet.get("id") is not None else packet.get("action")
        if (type(action_id) is int and action_id == 0) or action_id == "RESET":
            return self.reset()
        if isinstance(action_id, str) and action_id in {f"ACTION{i}" for i in range(1, 8)}:
            action_id = int(action_id[6:])
        if type(action_id) is int and action_id == ACTION_RESET:
            self.step_index += 1
            return self.level_reset()
        if self.state == "WIN":
            return self._response("finished")
        if type(action_id) is not int or not 1 <= action_id <= 6:
            return self._response("ignored")
        # Like web v3: count any recognized command, even a refused move/click.
        self.step_index += 1
        self.last_action = f"ACTION{action_id}"
        if action_id <= 4:
            return self._move(action_id)
        if action_id == ACTION_TEST:
            return self._test_passage()
        payload = data if isinstance(data, Mapping) else {}
        return self._click(payload.get("x"), payload.get("y"))

    def reset(self) -> dict[str, Any]:
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = False
        self.step_index = self.attempts = 0
        self.last_action = "RESET"
        self._setup(0)
        return self._response("reset")

    def level_reset(self) -> dict[str, Any]:
        """Restart current level; a direct method call is not an input command."""
        self.attempts += 1
        self._completed[self._index] = False
        self.last_action = "ACTION7"
        self._setup(self._index)
        return self._response("restart")

    def public_state(self) -> dict[str, Any]:
        """Return the current raster and consume the pending animation once.

        The envelope follows the custom backend, NOT a remote ARC API transport:
        frame is 2D and frames is 3D. Forward frames for an API expecting a 3D
        frame. No solution positions, witness moves or hidden level flags leak.
        """
        frames = self._pending_frames or [self._render_frame()]
        extra = self._pending_extra
        self._pending_frames, self._pending_extra = None, {}
        ids = [7] if self.state == "WIN" else list(range(1, 8))
        count = self.levels_completed
        return {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "custom_family": self.info.family, "wave": WAVE,
            "frame": frames[-1], "frames": frames, "frame_count": len(frames),
            "default_fps": max(self._fps, ANIM_FPS) if len(frames) > 1 else self._fps,
            "state": self.state, "level": self._index + 1,
            "levels_completed": count, "score": count,
            "win_levels": 1 if self.test_mode else self.win_levels,
            "win_score": 1 if self.test_mode else self.win_levels,
            "test_mode": self.test_mode, "step_index": self.step_index,
            "last_action": self.last_action,
            "available_actions": [f"ACTION{i}" for i in ids], "available_action_ids": ids,
            "selected_room": self.selected_room, "moves": self.moves, "checks": self.checks,
            "full_reset": False, "source_path": str(self.levels_dir),
            "level_name": self._level.get("title", f"L{self._index + 1:02d}"),
            "event": self._event, **extra,
        }

    def jump_to_level(self, number: int) -> dict[str, Any]:
        """Author/UI preview, never an available agent action."""
        _integer(number, "level", 1, len(self._templates))
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = True
        self.step_index = self.attempts = 0
        self.last_action = "PREVIEW"
        self._setup(number - 1)
        return self._response("preview")

    def selection_point(self, room_id: int) -> Point | None:
        """A visible wall pixel, for a human room tree; no solver or future clue."""
        if type(room_id) is not int or not 0 < room_id < len(self._rooms):
            return None
        room = world_rooms(self._rooms)[room_id]
        x, y = self._wall_masks[room_id][0]
        return self._native({"x": room["gx"] + x, "y": room["gy"] + y})

    def view(self) -> dict[str, Any]:
        """Optional human viewer data. Deliberately separate from public_state()."""
        unit, root = self._level["cell_px"], self._rooms[0]
        display_rooms = []
        for room in world_rooms(self._rooms):
            rid = room["id"]
            child_ids = descendants(self._rooms, rid)
            display_rooms.append({
                "id": rid, "parent": room["parent"], "depth": depth_of(self._rooms, rid),
                "descendants": len(child_ids) - 1,
                "children": [q["id"] for q in child_rooms(self._rooms, rid)],
                "siblings": [q["id"] for q in child_rooms(self._rooms, room["parent"]) if q["id"] != rid]
                            if room["parent"] is not None else [],
                "has_source": self._level["source"]["room"] in child_ids,
                "name": room.get("name", f"Pièce {rid}"), "w": room["w"], "h": room["h"],
                "color": room["color"], "x": room["x"], "y": room["y"],
                "rect": {"x": root["x"] + room["gx"] * unit, "y": root["y"] + room["gy"] * unit,
                         "w": room["w"] * unit, "h": room["h"] * unit},
                "selection_point": self.selection_point(rid), "gaps": own_gaps(self._rooms, rid),
                "doors": len(room["doors"]),
            })
        return {"level": self._index + 1, "title": self._level.get("title", "Gigognes"),
                "subtitle": self._level.get("subtitle", ""), "rooms": display_rooms,
                "selected": self.selected_room, "moves": self.moves, "checks": self.checks,
                "completed": self._completed[:], "state": self.state,
                "testMode": self.test_mode, "attempts": self.attempts,
                "cell_px": unit, "lastEvent": self._event}

    def metadata(self) -> list[dict[str, Any]]:
        return [{"number": l["number"], "title": l.get("title", "Gigognes"),
                 "movable": len(l["rooms"]) - 1,
                 "pairs": sum(len(child_rooms(l["rooms"], r["id"])) == 2 for r in l["rooms"]),
                 "depth": max(depth_of(l["rooms"], r["id"]) for r in l["rooms"]),
                 "doors": sum(len(r["doors"]) for r in l["rooms"]), "cell_px": l["cell_px"]}
                for l in self._templates]

    # Familiar names retained for the existing custom engines and web tooling.
    step = action
    observe = public_state
    levelReset = level_reset
    jumpToLevel = jump_to_level
    selectionPoint = selection_point


__all__ = ["NestedRoomsEngine", "GAME_ID", "FAMILY", "WAVE", "WEB_VERSION", "LEVELS_DIR",
           "SIZE", "FRAME", "LEVEL_COUNT", "ANIM_FPS", "PALETTE", "DIRS", "TEST_BUTTON",
           "ACTION_UP", "ACTION_DOWN", "ACTION_LEFT", "ACTION_RIGHT", "ACTION_TEST",
           "ACTION_CLICK", "ACTION_RESET", "door_xy", "wall_cells", "child_rooms", "descendants",
           "depth_of", "group_gaps", "own_gaps", "collision_reason", "relative_legal",
           "world_rooms", "validate_level", "configuration", "search_path"]
