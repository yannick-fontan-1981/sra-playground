from __future__ import annotations

import json
import math
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

FRAME = 64
HUD_Y = 52
MAX_ACTIONS = 30

WHITE, LIGHT, GRAY, DARK, BG = 0, 1, 3, 4, 5
MAGENTA, RED, BLUE, CYAN, YELLOW, ORANGE, BROWN, GREEN = 6, 8, 9, 10, 11, 12, 13, 14
PALETTE = [
    "#FFFFFF", "#CCCCCC", "#999999", "#666666", "#333333", "#000000",
    "#E53AA3", "#FF7BCC", "#F93C31", "#1E93FF", "#88D8F1", "#FFDC00",
    "#FF851B", "#895D3B", "#4FCC30", "#A356D6",
]

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_RESET = 7
DIR_BY_ACTION = {ACTION_UP: "U", ACTION_DOWN: "D", ACTION_LEFT: "L", ACTION_RIGHT: "R"}
DELTA = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0)}

SHAPES = {
    CYAN: [".##....", "#####..", ".######", "#####..", ".##...."],
    MAGENTA: ["###....", "#.#####", "#######", "#.#####", "###...."],
    ORANGE: ["..###..", "#######", "..#####", "#######", "..###.."],
}
KEY_ROOM_PATTERNS = {
    CYAN: [".##.....", "#####...", ".#######", "#####.#.", ".##....."],
    MAGENTA: ["###.....", "#.#####.", "#######.", "#.####.#", "###....."],
    ORANGE: ["..###...", "#######.", "..######", "#######.", "..###.#."],
}

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "graved_map" / "levels"
Frame = list[list[int]]
Level = dict[str, Any]
State = dict[str, Any]


def _is_int(v: Any) -> bool:
    return type(v) is int


def _js_round(v: float) -> int:
    return math.floor(v + 0.5) if v >= 0 else math.ceil(v - 0.5)


def load_levels(path: str | Path = LEVELS_DIR) -> list[Level]:
    paths = sorted(Path(path).glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no GRAVED-MAP levels in {path}")
    return [validate_level(json.loads(p.read_text(encoding="utf-8"))) for p in paths]


def validate_level(raw: Level) -> Level:
    level = deepcopy(raw)
    if not isinstance(level, dict):
        raise ValueError("level must be an object")
    if not isinstance(level.get("id"), str):
        raise ValueError("level id missing")
    if not (isinstance(level.get("start"), list) and len(level["start"]) == 2 and all(_is_int(v) for v in level["start"])):
        raise ValueError("start must be [x,y]")
    rooms = level.get("rooms")
    if not isinstance(rooms, list) or not rooms:
        raise ValueError("rooms missing")
    coords: set[tuple[int, int]] = set()
    for r in rooms:
        if not isinstance(r, dict) or not all(_is_int(r.get(k)) for k in ("x", "y")):
            raise ValueError("invalid room")
        pos = (r["x"], r["y"])
        if pos in coords:
            raise ValueError(f"duplicate room {pos}")
        coords.add(pos)
        if r.get("type") not in {"empty", "map", "key", "hazard", "goal"}:
            raise ValueError(f"bad room type {r.get('type')}")
        if r.get("type") == "key" and r.get("color") not in {CYAN, MAGENTA, ORANGE}:
            raise ValueError("keys must be cyan, magenta or orange")
        if r.get("type") == "map":
            reveal = r.get("reveal")
            if not isinstance(reveal, list) or not reveal:
                raise ValueError("map room needs reveal list")
    if tuple(level["start"]) not in coords:
        raise ValueError("start room missing")
    for d in level.get("doors", []):
        if not isinstance(d, dict) or d.get("color") not in {CYAN, MAGENTA, ORANGE}:
            raise ValueError("bad door")
        a, b = d.get("a"), d.get("b")
        if not (isinstance(a, list) and isinstance(b, list) and len(a) == len(b) == 2):
            raise ValueError("door endpoints missing")
        if tuple(a) not in coords or tuple(b) not in coords:
            raise ValueError("door endpoint is not a room")
        if abs(a[0] - b[0]) + abs(a[1] - b[1]) != 1:
            raise ValueError("door endpoints must be adjacent")
    if level.get("maxActions") != MAX_ACTIONS:
        raise ValueError("this release requires exactly 30 actions")
    sol = level.get("solution")
    if not isinstance(sol, list) or any(x not in DELTA for x in sol):
        raise ValueError("bad solution witness")
    return level


def create_state(level: Level) -> State:
    return {
        "room": list(level["start"]),
        "keys": {},
        "collected": [],
        "opened": [],
        "actionsLeft": MAX_ACTIONS,
        "status": "PLAYING",
        "lastEvent": "READY",
        "eventData": None,
    }


def _coord_key(p: list[int] | tuple[int, int]) -> tuple[int, int]:
    return int(p[0]), int(p[1])


def room_at(level: Level, x: int, y: int) -> dict[str, Any] | None:
    return next((r for r in level["rooms"] if r["x"] == x and r["y"] == y), None)


def edge_key(a: list[int] | tuple[int, int], b: list[int] | tuple[int, int]) -> tuple[tuple[int, int], tuple[int, int]]:
    aa, bb = _coord_key(a), _coord_key(b)
    return tuple(sorted((aa, bb)))  # type: ignore[return-value]


def door_at(level: Level, a: list[int] | tuple[int, int], b: list[int] | tuple[int, int]) -> dict[str, Any] | None:
    ek = edge_key(a, b)
    for i, d in enumerate(level.get("doors", [])):
        if edge_key(d["a"], d["b"]) == ek:
            return {**d, "id": i}
    return None


def has_coord(items: list[list[int]], p: list[int] | tuple[int, int]) -> bool:
    target = _coord_key(p)
    return any(_coord_key(x) == target for x in items)


def held(state: State, color: int) -> int:
    return int(state["keys"].get(color, state["keys"].get(str(color), 0)))


def same_pos(a: list[int] | tuple[int, int], b: list[int] | tuple[int, int]) -> bool:
    return _coord_key(a) == _coord_key(b)


def side_between(a: list[int], b: list[int]) -> str:
    dx, dy = b[0] - a[0], b[1] - a[1]
    if dx == 1 and dy == 0:
        return "R"
    if dx == -1 and dy == 0:
        return "L"
    if dx == 0 and dy == 1:
        return "D"
    return "U"


def auto_door_at_room(level: Level, state: State) -> dict[str, Any] | None:
    for i, d in enumerate(level.get("doors", [])):
        if i in state["opened"] or not same_pos(d["a"], state["room"]) or held(state, d["color"]) <= 0:
            continue
        return {**d, "id": i, "side": side_between(d["a"], d["b"])}
    return None


def inv_x(color: int) -> int:
    return {CYAN: 18, MAGENTA: 26, ORANGE: 34}[color]


def inv_y() -> int:
    return 54


def door_hole_origin(side: str) -> tuple[int, int]:
    return {"U": (28, 1), "D": (28, 47), "L": (0, 27), "R": (57, 27)}[side]


def enter_room(level: Level, state: State, np: tuple[int, int]) -> State:
    nxt = deepcopy(state)
    nxt["room"] = [np[0], np[1]]
    nxt["eventData"] = None
    room = room_at(level, np[0], np[1])
    assert room is not None
    if room["type"] == "key" and not has_coord(nxt["collected"], np):
        color = int(room["color"])
        nxt["keys"][color] = held(nxt, color) + 1
        nxt["collected"].append([np[0], np[1]])
        nxt["lastEvent"] = "KEY"
        nxt["eventData"] = {"color": color}
    else:
        nxt["lastEvent"] = "MOVE"
    if room["type"] == "hazard":
        nxt["status"] = "DEAD"
        nxt["lastEvent"] = "DEAD"
        return nxt
    if room["type"] == "goal":
        nxt["status"] = "WIN"
        nxt["lastEvent"] = "WIN"
        return nxt
    if nxt["actionsLeft"] <= 0:
        nxt["status"] = "OUT"
        nxt["lastEvent"] = "OUT"
    return nxt


def maybe_open_door_on_entry(level: Level, state: State) -> dict[str, Any]:
    if state["status"] != "PLAYING":
        return {"state": state, "event": state["lastEvent"], "data": state.get("eventData")}
    door = auto_door_at_room(level, state)
    if door is None:
        return {"state": state, "event": state["lastEvent"], "data": state.get("eventData")}
    nxt = deepcopy(state)
    color = int(door["color"])
    prev_count = held(nxt, color)
    nxt["keys"][color] = prev_count - 1
    nxt["opened"].append(door["id"])
    nxt["lastEvent"] = "OPENED"
    nxt["eventData"] = {
        "color": color,
        "side": door["side"],
        "fromCount": prev_count,
        "doorId": door["id"],
    }
    return {"state": nxt, "event": "OPENED", "data": nxt["eventData"]}


def move_detailed(level: Level, state: State, direction: str) -> dict[str, Any]:
    if state["status"] != "PLAYING":
        return {"state": state, "event": "IGNORED", "data": None}
    nxt = deepcopy(state)
    nxt["lastEvent"] = "MOVE"
    nxt["eventData"] = None
    nxt["actionsLeft"] = max(0, int(nxt["actionsLeft"]) - 1)
    dx, dy = DELTA[direction]
    np = (state["room"][0] + dx, state["room"][1] + dy)
    dest = room_at(level, *np)
    if dest is None:
        nxt["lastEvent"] = "WALL"
        if nxt["actionsLeft"] <= 0:
            nxt["status"] = "OUT"
            nxt["lastEvent"] = "OUT"
        return {"state": nxt, "event": "WALL", "data": None}
    door = door_at(level, state["room"], np)
    if door is not None and door["id"] not in nxt["opened"]:
        nxt["lastEvent"] = "LOCKED"
        if nxt["actionsLeft"] <= 0:
            nxt["status"] = "OUT"
            nxt["lastEvent"] = "OUT"
        return {"state": nxt, "event": "LOCKED", "data": None}
    after = enter_room(level, nxt, np)
    if after["lastEvent"] == "KEY":
        return {"state": after, "event": "KEY", "data": after.get("eventData")}
    return maybe_open_door_on_entry(level, after)


# ----------------------------- 64x64 renderer -----------------------------

def _blank() -> Frame:
    return [[BG] * FRAME for _ in range(FRAME)]


def _put(f: Frame, x: int, y: int, c: int) -> None:
    if 0 <= x < FRAME and 0 <= y < FRAME:
        f[y][x] = c


def _fill(f: Frame, x: int, y: int, w: int, h: int, c: int) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            _put(f, xx, yy, c)


def _outline(f: Frame, x: int, y: int, w: int, h: int, c: int) -> None:
    _fill(f, x, y, w, 1, c)
    _fill(f, x, y + h - 1, w, 1, c)
    _fill(f, x, y, 1, h, c)
    _fill(f, x + w - 1, y, 1, h, c)


def _blob(f: Frame, cx: int, cy: int, r: int, color: int) -> None:
    for y in range(-r, r + 1):
        for x in range(-r, r + 1):
            if x * x + y * y <= r * r + 1:
                _put(f, cx + x, cy + y, color)


def _draw_shape(f: Frame, x: int, y: int, color: int, kind: int, *, hole: bool = False, source: list[str] | None = None) -> None:
    pattern = source or SHAPES.get(kind, SHAPES[CYAN])
    for j, row in enumerate(pattern):
        for i, ch in enumerate(row):
            if ch != ".":
                _put(f, x + i, y + j, BG if hole else color)


def _terrain_blob(f: Frame, cx: int, cy: int, color: int) -> None:
    r = 5 if color == GREEN else 3
    _blob(f, cx, cy, r, color)
    if color == GREEN:
        _blob(f, cx - 3, cy + 1, 3, GREEN)
        _blob(f, cx + 3, cy + 1, 3, GREEN)
        _blob(f, cx, cy - 2, 3, GREEN)
        _put(f, cx, cy + 3, BROWN)
        _put(f, cx, cy + 4, BROWN)
    elif color == GRAY:
        _blob(f, cx - 1, cy - 1, 2, LIGHT)
        _put(f, cx + 2, cy + 1, DARK)
    else:
        _blob(f, cx - 1, cy - 1, 2, BROWN)
        _put(f, cx + 2, cy + 1, DARK)


def _draw_blocked_side(f: Frame, side: str) -> None:
    if side == "U":
        _fill(f, 0, 0, 64, 7, BROWN)
        colors = [GREEN, GRAY, BROWN, GREEN]
        for i, x in enumerate(range(3, 64, 10)):
            _terrain_blob(f, x, 3, colors[i % 4])
    if side == "D":
        _fill(f, 0, 45, 64, 7, BROWN)
        colors = [BROWN, GREEN, GRAY, GREEN]
        for i, x in enumerate(range(4, 64, 10)):
            _terrain_blob(f, x, 49, colors[i % 4])
    if side == "L":
        _fill(f, 0, 0, 7, 52, BROWN)
        colors = [GREEN, BROWN, GRAY, GREEN]
        for i, y in enumerate(range(3, 52, 10)):
            _terrain_blob(f, 3, y, colors[i % 4])
    if side == "R":
        _fill(f, 57, 0, 7, 52, BROWN)
        colors = [GRAY, GREEN, BROWN, GREEN]
        for i, y in enumerate(range(4, 52, 10)):
            _terrain_blob(f, 60, y, colors[i % 4])


def _draw_door(f: Frame, side: str, color: int) -> None:
    pattern = SHAPES.get(color, SHAPES[CYAN])
    if side == "U":
        _fill(f, 24, 0, 16, 6, DARK); _fill(f, 25, 0, 14, 6, color); _draw_shape(f, 28, 1, color, color, hole=True, source=pattern)
    if side == "D":
        _fill(f, 24, 46, 16, 6, DARK); _fill(f, 25, 46, 14, 6, color); _draw_shape(f, 28, 47, color, color, hole=True, source=pattern)
    if side == "L":
        _fill(f, 0, 22, 6, 16, DARK); _fill(f, 0, 23, 6, 14, color); _draw_shape(f, 0, 27, color, color, hole=True, source=pattern)
    if side == "R":
        _fill(f, 58, 22, 6, 16, DARK); _fill(f, 58, 23, 6, 14, color); _draw_shape(f, 57, 27, color, color, hole=True, source=pattern)


def _draw_key_room_icon(f: Frame, color: int) -> None:
    _outline(f, 24, 21, 16, 14, DARK)
    _fill(f, 25, 22, 14, 12, GRAY)
    _draw_shape(f, 27, 25, color, color, source=KEY_ROOM_PATTERNS.get(color, KEY_ROOM_PATTERNS[CYAN]))


def _draw_hazard(f: Frame) -> None:
    _fill(f, 28, 23, 9, 2, RED); _fill(f, 26, 25, 13, 8, RED); _fill(f, 28, 33, 9, 4, RED)
    _fill(f, 29, 26, 2, 2, BG); _fill(f, 34, 26, 2, 2, BG); _put(f, 32, 30, BG)
    _fill(f, 30, 35, 1, 3, BG); _fill(f, 34, 35, 1, 3, BG)


def _draw_goal(f: Frame) -> None:
    for x, y in [(32,22),(30,24),(34,24),(28,26),(36,26),(30,28),(34,28),(32,30),(32,32)]:
        _fill(f, x, y, 2, 2, YELLOW)
    _fill(f, 32, 26, 2, 2, WHITE)
    _outline(f, 27, 21, 12, 14, LIGHT)


def _draw_inventory(f: Frame, state: State) -> None:
    _fill(f, 14, 52, 26, 9, DARK)
    for color in (CYAN, MAGENTA, ORANGE):
        x = inv_x(color)
        _outline(f, x, 53, 7, 7, GRAY)
        if held(state, color) > 0:
            _draw_shape(f, x, 54, color, color, source=KEY_ROOM_PATTERNS.get(color, KEY_ROOM_PATTERNS[CYAN]))


def _draw_map(f: Frame, level: Level, room: dict[str, Any], state: State) -> None:
    reveal = [list(p) for p in (room.get("reveal") or [[q["x"], q["y"]] for q in level["rooms"]])]
    visible = {_coord_key(p) for p in reveal}
    xs, ys = [p[0] for p in reveal], [p[1] for p in reveal]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    w, h = maxx - minx, maxy - miny
    pitch = max(4, min(6, math.floor(42 / max(1, w)), math.floor(34 / max(1, h))))
    ox = _js_round(32 - ((minx + maxx) / 2) * pitch)
    oy = _js_round(25 - ((miny + maxy) / 2) * pitch)
    for p in reveal:
        for dx, dy in ((1, 0), (0, 1)):
            q = [p[0] + dx, p[1] + dy]
            if _coord_key(q) not in visible:
                continue
            x1, y1 = ox + p[0] * pitch, oy + p[1] * pitch
            x2, y2 = ox + q[0] * pitch, oy + q[1] * pitch
            if y1 == y2:
                _fill(f, min(x1, x2), y1, abs(x2 - x1) + 1, 1, BROWN)
            else:
                _fill(f, x1, min(y1, y2), 1, abs(y2 - y1) + 1, BROWN)
            door = door_at(level, p, q)
            if door is not None:
                mx, my = _js_round((x1 + x2) / 2), _js_round((y1 + y2) / 2)
                _fill(f, mx - 1, my - 1, 3, 3, int(door["color"]))
    for p in reveal:
        rr = room_at(level, p[0], p[1]); assert rr is not None
        cx, cy = ox + p[0] * pitch, oy + p[1] * pitch
        _outline(f, cx - 2, cy - 2, 5, 5, GRAY)
        color = None
        if rr["type"] == "map": color = YELLOW
        if rr["type"] == "key": color = int(rr["color"])
        if rr["type"] == "hazard": color = RED
        if rr["type"] == "goal": color = YELLOW
        if p[0] == room["x"] and p[1] == room["y"]: color = YELLOW
        if color is not None:
            _fill(f, cx - 1, cy - 1, 3, 3, color)
        if p[0] == level["start"][0] and p[1] == level["start"][1]:
            _put(f, cx, cy, WHITE)
        if p[0] == state["room"][0] and p[1] == state["room"][1]:
            _put(f, cx - 2, cy - 2, WHITE); _put(f, cx + 2, cy - 2, WHITE)
            _put(f, cx - 2, cy + 2, WHITE); _put(f, cx + 2, cy + 2, WHITE)


def _draw_overlay(f: Frame, overlay: dict[str, Any] | None) -> None:
    if not overlay:
        return
    color = int(overlay["color"])
    travel_pattern = KEY_ROOM_PATTERNS.get(color, KEY_ROOM_PATTERNS[CYAN])
    slot_pattern = SHAPES.get(color, SHAPES[CYAN])
    if overlay["kind"] == "keyMove":
        x = _js_round(overlay["sx"] + (overlay["tx"] - overlay["sx"]) * overlay["t"])
        y = _js_round(overlay["sy"] + (overlay["ty"] - overlay["sy"]) * overlay["t"])
        _draw_shape(f, x, y, color, color, source=travel_pattern)
    elif overlay["kind"] == "doorFill":
        if overlay.get("phase") == "travel":
            x = _js_round(overlay["sx"] + (overlay["tx"] - overlay["sx"]) * overlay["t"])
            y = _js_round(overlay["sy"] + (overlay["ty"] - overlay["sy"]) * overlay["t"])
            _draw_shape(f, x, y, color, color, source=travel_pattern)
        else:
            _draw_shape(f, int(overlay["tx"]), int(overlay["ty"]), WHITE if overlay.get("white") else color, color, source=slot_pattern)


def render(level: Level, state: State, progress: Any = (), options: dict[str, Any] | None = None) -> Frame:
    options = options or {}
    f = _blank()
    room = room_at(level, state["room"][0], state["room"][1]); assert room is not None
    for side, (dx, dy) in DELTA.items():
        np = [state["room"][0] + dx, state["room"][1] + dy]
        dest = room_at(level, np[0], np[1])
        if dest is None:
            _draw_blocked_side(f, side)
        else:
            door = door_at(level, state["room"], np)
            if door is not None and door["id"] not in state["opened"] and same_pos(door["a"], state["room"]):
                _draw_door(f, side, int(door["color"]))
    if room["type"] == "map":
        _draw_map(f, level, room, state)
    elif room["type"] == "key" and not has_coord(state["collected"], state["room"]):
        _draw_key_room_icon(f, int(room["color"]))
    elif room["type"] == "hazard":
        _draw_hazard(f)
    elif room["type"] == "goal":
        _draw_goal(f)
    else:
        _fill(f, 31, 24, 3, 7, DARK); _put(f, 32, 25, GRAY); _fill(f, 29, 31, 7, 1, DARK)
    _fill(f, 0, HUD_Y, 64, 12, DARK)
    _draw_inventory(f, state)
    done = set(progress)
    for i in range(6):
        _fill(f, 2 + i * 5, 61, 4, 2, GREEN if i in done else GRAY)
    for n in range(30):
        x, y = 44 + 2 * (n % 10), 53 + (n // 10) * 3
        _put(f, x, y, YELLOW if n < state["actionsLeft"] else GRAY)
    outline_color = options.get("outline")
    if outline_color is not None:
        _outline(f, 0, 0, 64, 52, int(outline_color))
    _draw_overlay(f, options.get("overlay"))
    return f


# ----------------------------- animations -----------------------------

def _key_animation(level: Level, final_state: State, color: int, progress: set[int]) -> tuple[list[Frame], list[int]]:
    anim = deepcopy(final_state)
    anim["keys"][color] = max(0, held(anim, color) - 1)
    frames, durations = [], []
    for step in range(12):
        overlay = {"kind": "keyMove", "color": color, "sx": 28, "sy": 25, "tx": inv_x(color), "ty": 54, "t": step / 11}
        frames.append(render(level, anim, progress, {"overlay": overlay})); durations.append(48)
    frames.append(render(level, final_state, progress)); durations.append(0)
    return frames, durations


def _door_animation(level: Level, final_state: State, data: dict[str, Any], progress: set[int]) -> tuple[list[Frame], list[int]]:
    color, door_id, side = int(data["color"]), int(data["doorId"]), str(data["side"])
    anim = deepcopy(final_state)
    anim["opened"] = [v for v in anim["opened"] if v != door_id]
    anim["keys"][color] = held(anim, color) + 1
    tx, ty = door_hole_origin(side)
    frames, durations = [], []
    # Slow travel while the door remains fully present.
    for step in range(16):
        overlay = {"kind": "doorFill", "phase": "travel", "color": color, "sx": inv_x(color), "sy": 54, "tx": tx, "ty": ty, "t": step / 15}
        frames.append(render(level, anim, progress, {"overlay": overlay})); durations.append(55)
    # Seated, aligned, colored hold.
    overlay = {"kind": "doorFill", "phase": "seated", "color": color, "tx": tx, "ty": ty, "white": False}
    frames.append(render(level, anim, progress, {"overlay": overlay})); durations.append(180)
    # Exactly two white blinks: white -> color -> white -> color.
    for white in (True, False, True, False):
        overlay = {"kind": "doorFill", "phase": "seated", "color": color, "tx": tx, "ty": ty, "white": white}
        frames.append(render(level, anim, progress, {"overlay": overlay})); durations.append(150)
    # Final colored hold, still with the door visible.
    overlay = {"kind": "doorFill", "phase": "seated", "color": color, "tx": tx, "ty": ty, "white": False}
    frames.append(render(level, anim, progress, {"overlay": overlay})); durations.append(150)
    # Only now does the opened-door final state appear.
    frames.append(render(level, final_state, progress)); durations.append(0)
    return frames, durations


def _blink_frames(level: Level, state: State, progress: set[int], color: int) -> tuple[list[Frame], list[int]]:
    frames, durations = [], []
    for outline_color in (color, None, color, None):
        frames.append(render(level, state, progress, {"outline": outline_color})); durations.append(70)
    frames.append(render(level, state, progress)); durations.append(0)
    return frames, durations


def _failure_reset_frames(level: Level, state: State, progress: set[int], color: int) -> tuple[list[Frame], list[int], State]:
    frames, durations = [], []
    for i in range(6):
        frames.append(render(level, state, progress, {"outline": color if i % 2 == 0 else None}))
        durations.append(90 if i < 5 else 270)  # 90ms phase + final 180ms pause before reset
    reset = create_state(level)
    frames.append(render(level, reset, progress)); durations.append(0)
    return frames, durations, reset


def _win_frames(level: Level, state: State, progress: set[int]) -> tuple[list[Frame], list[int]]:
    win_progress = set(progress); win_progress.add(len(progress))
    frames, durations = [], []
    for i in range(7):
        frames.append(render(level, state, win_progress, {"outline": GREEN if i % 2 == 0 else None})); durations.append(90)
    frames.append(render(level, state, win_progress)); durations.append(0)
    return frames, durations


class GameInfoLike(Protocol):
    game_id: str
    title: str
    family: str
    levels: int
    default_fps: float


@dataclass(frozen=True)
class GravedMapInfo:
    game_id: str = "graved_map"
    title: str = "GRAVED-MAP"
    family: str = "graved_map"
    levels: int = 6
    default_fps: float = 12.0


class GravedMapEngine:
    """ARC3 custom-backend port of GRAVED-MAP web v3.2.

    ACTION1/2/3/4 = up/down/left/right. ACTION7 resets the current level.
    There are no manual key/door actions: pickup and door opening are automatic.
    Every directional action costs one of the level's 30 actions, including a
    blocked edge or a closed door.
    """

    def __init__(self, info: GameInfoLike | None = None, *, levels_dir: str | Path | None = None,
                 levels: list[Level] | None = None, animate: bool = True) -> None:
        if levels is not None and levels_dir is not None:
            raise ValueError("Use levels OR levels_dir, not both")
        bank = [validate_level(x) for x in levels] if levels is not None else load_levels(levels_dir or LEVELS_DIR)
        self.info = info if info is not None else GravedMapInfo(levels=len(bank))
        self.win_levels = int(getattr(self.info, "levels", len(bank)))
        if not 1 <= self.win_levels <= len(bank):
            raise ValueError(f"info.levels must be between 1 and {len(bank)}")
        self._templates = deepcopy(bank[:self.win_levels])
        self.animate = bool(animate)
        self.reset()

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.state = "NOT_FINISHED"
        self._index = 0
        self.level = deepcopy(self._templates[0])
        self.local = create_state(self.level)
        self.last_action = "RESET"
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        if self.state == "WIN":
            self._index = self.win_levels - 1
            self.levels_completed = self.win_levels - 1
            self.state = "NOT_FINISHED"
            self.level = deepcopy(self._templates[self._index])
        self.local = create_state(self.level)
        self.step_index += 1
        self.last_action = "LEVEL_RESET"
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        if isinstance(action_id, bool):
            return self.public_state()
        try:
            aid = int(action_id)
        except (TypeError, ValueError, OverflowError):
            return self.public_state()
        if isinstance(action_id, float) and action_id != aid:
            return self.public_state()
        if aid == ACTION_RESET:
            return self.level_reset()
        if aid not in DIR_BY_ACTION or self.state == "WIN":
            return self.public_state()

        progress = set(range(self.levels_completed))
        result = move_detailed(self.level, self.local, DIR_BY_ACTION[aid])
        event, final_state = result["event"], result["state"]
        self.step_index += 1
        self.last_action = event

        frames: list[Frame] = []
        durations: list[int] = []
        if self.animate:
            if event == "KEY":
                frames, durations = _key_animation(self.level, final_state, int(result["data"]["color"]), progress)
            elif event == "OPENED":
                frames, durations = _door_animation(self.level, final_state, dict(result["data"]), progress)
            elif event == "WALL":
                frames, durations = _blink_frames(self.level, final_state, progress, LIGHT)
            elif event == "LOCKED":
                frames, durations = _blink_frames(self.level, final_state, progress, RED)

        # Web v3.2 checks WALL/LOCKED before OUT, so an exhausted blocked action
        # remains OUT after its blink rather than auto-resetting. Preserve that.
        if event not in {"WALL", "LOCKED"} and final_state["status"] in {"DEAD", "OUT"}:
            if self.animate:
                frames, durations, final_state = _failure_reset_frames(self.level, final_state, progress, RED)
            else:
                final_state = create_state(self.level)
            self.local = final_state
            out = self.public_state()
            if frames:
                out.update(frames=frames, frame_count=len(frames), frame_durations_ms=durations)
            return out

        self.local = final_state
        if final_state["status"] == "WIN":
            if self.animate:
                frames, durations = _win_frames(self.level, final_state, progress)
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
                out = self.public_state()
                if self.animate:
                    out.update(frames=frames, frame_count=len(frames), frame_durations_ms=durations)
                return out
            self._index = self.levels_completed
            self.level = deepcopy(self._templates[self._index])
            self.local = create_state(self.level)
            out = self.public_state()
            if self.animate:
                out_frames = frames + [out["frame"]]
                out_durations = durations + [0]
                out.update(frames=out_frames, frame_count=len(out_frames), frame_durations_ms=out_durations)
            return out

        out = self.public_state()
        if frames:
            out.update(frames=frames, frame_count=len(frames), frame_durations_ms=durations)
        return out

    step = action

    def public_state(self) -> dict[str, Any]:
        frame = render(self.level, self.local, range(self.levels_completed))
        return {
            "backend": "custom",
            "selected": True,
            "game_id": getattr(self.info, "game_id", "graved_map"),
            "title": getattr(self.info, "title", "GRAVED-MAP"),
            "frame": frame,
            "frames": [frame],
            "frame_count": 1,
            "frame_durations_ms": [0],
            "state": self.state,
            "level": min(self._index + 1, self.win_levels),
            "levels_completed": self.levels_completed,
            "win_levels": self.win_levels,
            "step_index": self.step_index,
            "available_action_ids": [1, 2, 3, 4, 7] if self.state != "WIN" else [7],
            "last_action": self.last_action,
            "score": self.levels_completed,
            "level_name": self.level["id"],
            "palette": list(PALETTE),
            "local_state": deepcopy(self.local),
            "max_actions": MAX_ACTIONS,
            "actions_left": self.local["actionsLeft"],
        }


__all__ = [
    "GravedMapEngine", "GravedMapInfo", "load_levels", "validate_level", "create_state",
    "move_detailed", "render", "room_at", "door_at", "PALETTE", "MAX_ACTIONS",
    "ACTION_UP", "ACTION_DOWN", "ACTION_LEFT", "ACTION_RIGHT", "ACTION_RESET",
    "WHITE", "LIGHT", "GRAY", "DARK", "BG", "MAGENTA", "RED", "BLUE", "CYAN",
    "YELLOW", "ORANGE", "BROWN", "GREEN", "held", "inv_x", "door_hole_origin",
]
