"""SNAR — Sonar web v4, Python engine for the ARC-3 custom_3 backend.

ACTION1..4: one cardinal attempt, spending one move and advancing one world turn.
ACTION5: sonar when charged, otherwise a silent wait (no movement cost).
ACTION6: inactive, including the removed bottom-right HUD control.
ACTION7: reset this level; reset()/0/"RESET": reset the whole campaign.

Exact six-level data and integer 64x64 rendering are ported from the accepted
web v4. Fixed walls remain hidden until scanned or touched. Visible sliding
walls, patrols, listeners, ejectors and resonant doors retain their turn order.
Python 3.10+, standard library only. No JS process, network, random generation,
real clock or player-solving code is used at runtime.

Install this file AND custom_games/games/sonar_maze/levels/L01..L06.json.
frame is 2D; frames is the entire animation. Honour frame_durations_ms for the
web timing. public_state() never advances time or replays a consumed animation.
"""
from __future__ import annotations

import copy
import json
import math
from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

SIZE = FRAME = 64
LEVEL_COUNT = 6
GAME_ID = "snar-c3000001"
FAMILY = "sonar_maze"
WAVE = "custom_3"
WEB_VERSION = "4.0"
ANIM_FPS = 20
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / FAMILY / "levels"
ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE, ACTION_CLICK, ACTION_RESET = 5, 6, 7
DIRS = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}
ORDER = (4, 2, 3, 1)
BUTTONS: dict[str, Any] = {}  # No native click target in web v4.
PALETTE = (
    "#F3F2EB", "#C8D7D5", "#354950", "#607F86", "#17272E", "#0B161D",
    "#B555B5", "#E7B9A3", "#EC7066", "#68ACEB", "#76DBD8", "#EFCA72",
    "#E8A364", "#6E5545", "#88CEA3", "#BC9BEA",
)
Raster = list[list[int]]
Level = dict[str, Any]


def _integer(value: Any, label: str, lo: int, hi: int | None = None) -> int:
    if type(value) is not int or value < lo or (hi is not None and value > hi):
        raise ValueError(f"{label}: expected an integer in {lo}..{hi}, got {value!r}")
    return value


def _inside(x: int, y: int, rect: Mapping[str, int]) -> bool:
    return rect["x"] <= x < rect["x"] + rect["w"] and rect["y"] <= y < rect["y"] + rect["h"]


def _fill(buf: bytearray, x: int, y: int, w: int, h: int, color: int) -> None:
    left, right = max(0, x), min(SIZE, x + w)
    if right <= left:
        return
    line = bytes([color]) * (right - left)
    for yy in range(max(0, y), min(SIZE, y + h)):
        buf[yy * SIZE + left:yy * SIZE + right] = line


def _outline(buf: bytearray, x: int, y: int, w: int, h: int, color: int) -> None:
    _fill(buf, x, y, w, 1, color)
    _fill(buf, x, y + h - 1, w, 1, color)
    _fill(buf, x, y, 1, h, color)
    _fill(buf, x + w - 1, y, 1, h, color)


def geometry(level: Level) -> dict[str, int]:
    rows, cols, p = len(level["grid"]), len(level["grid"][0]), level["cell_px"]
    return {"rows": rows, "cols": cols, "p": p,
            "x": (64 - cols * p) // 2, "y": 7 + (52 - rows * p) // 2}


def validate(raw: list[Level]) -> list[Level]:
    """Validate and detach the six web-level templates; no rules are generated."""
    if not isinstance(raw, list) or len(raw) != LEVEL_COUNT:
        raise ValueError("Six levels are required")
    levels = copy.deepcopy(raw)
    for index, level in enumerate(levels):
        prefix = f"L{index + 1:02d}"
        if not isinstance(level, dict):
            raise ValueError(f"{prefix}: expected an object")
        grid = level.get("grid")
        if (not isinstance(grid, list) or len(grid) < 3 or not isinstance(grid[0], str)
                or not grid[0] or any(not isinstance(r, str) or len(r) != len(grid[0])
                                     or set(r) - {".", "#"} for r in grid)):
            raise ValueError(f"{prefix}: invalid rectangular map")
        _integer(level.get("cell_px"), prefix + ".cell_px", 4, 6)
        g = geometry(level)
        if g["cols"] * g["p"] > 60 or g["rows"] * g["p"] > 52:
            raise ValueError(f"{prefix}: map exceeds the 64x64 raster")

        def valid(p: Any) -> bool:
            return (isinstance(p, list) and len(p) == 2 and all(type(v) is int for v in p)
                    and 0 <= p[0] < g["cols"] and 0 <= p[1] < g["rows"]
                    and grid[p[1]][p[0]] == ".")

        if not valid(level.get("start")) or not valid(level.get("exit")) or level["start"] == level["exit"]:
            raise ValueError(f"{prefix}: invalid start / exit")
        for key in ("sonar_radius", "sonar_budget", "move_budget", "echo_moves"):
            _integer(level.get(key), prefix + "." + key, 1)
        if level["sonar_budget"] > 5 or level["sonar_radius"] > 12:
            raise ValueError(f"{prefix}: unsupported sonar dimensions")
        for key in ("relays", "gates", "moving_walls", "enemies", "pushers"):
            level.setdefault(key, [])
            if not isinstance(level[key], list) or any(not isinstance(r, dict) for r in level[key]):
                raise ValueError(f"{prefix}: expected objects in {key}")
        cells: set[tuple[int, int]] = set()
        for relay in level["relays"]:
            p = [relay.get("x"), relay.get("y")]
            if not valid(p) or tuple(p) in cells:
                raise ValueError(f"{prefix}: invalid relay")
            _integer(relay.get("radius"), "relay.radius", 1, 12)
            cells.add(tuple(p))
        for door in level["gates"]:
            p = [door.get("x"), door.get("y")]
            if not valid(p) or type(door.get("open")) is not bool or tuple(p) in cells or p == level["start"]:
                raise ValueError(f"{prefix}: invalid gate")
            cells.add(tuple(p))
        for pad in level["pushers"]:
            p = [pad.get("x"), pad.get("y")]
            if not valid(p) or tuple(p) in cells or p in (level["start"], level["exit"]):
                raise ValueError(f"{prefix}: invalid pusher")
            _integer(pad.get("direction"), "pusher.direction", 1, 4)
            _integer(pad.get("force"), "pusher.force", 1, 6)
            cells.add(tuple(p))
        for wall in level["moving_walls"]:
            wall.setdefault("w", 1)
            wall.setdefault("h", 1)
            wall.setdefault("phase", 0)
            _integer(wall["w"], "wall.w", 1, 3)
            _integer(wall["h"], "wall.h", 1, 3)
            _integer(wall.get("period"), "wall.period", 1)
            rail = wall.get("path")
            if not isinstance(rail, list) or len(rail) < 2 or not all(valid(p) for p in rail):
                raise ValueError(f"{prefix}: invalid wall rail")
            _integer(wall["phase"], "wall.phase", 0, len(rail) - 1)
            for i, p in enumerate(rail):
                nxt = rail[(i + 1) % len(rail)]
                if abs(nxt[0] - p[0]) + abs(nxt[1] - p[1]) > 1:
                    raise ValueError(f"{prefix}: wall must not teleport")
                for dy in range(wall["h"]):
                    for dx in range(wall["w"]):
                        q = [p[0] + dx, p[1] + dy]
                        if (not valid(q) or q == level["exit"]
                                or any(q == [d["x"], d["y"]] for d in level["gates"])):
                            raise ValueError(f"{prefix}: wall rail hits static geometry")
            p = rail[wall["phase"]]
            if _inside(*level["start"], {"x": p[0], "y": p[1], "w": wall["w"], "h": wall["h"]}):
                raise ValueError(f"{prefix}: start inside moving wall")
        occupied: set[tuple[int, int]] = set()
        for enemy in level["enemies"]:
            p = [enemy.get("x"), enemy.get("y")]
            if (enemy.get("kind") not in ("patrol", "listener") or not valid(p)
                    or p in (level["start"], level["exit"]) or tuple(p) in occupied):
                raise ValueError(f"{prefix}: invalid enemy")
            _integer(enemy.get("period"), "enemy.period", 1)
            occupied.add(tuple(p))
            if enemy["kind"] == "patrol":
                rail = enemy.get("path")
                if not isinstance(rail, list) or len(rail) < 2 or not all(valid(q) for q in rail):
                    raise ValueError(f"{prefix}: invalid patrol")
                enemy.setdefault("phase", 0)
                _integer(enemy["phase"], "enemy.phase", 0, len(rail) - 1)
                if rail[enemy["phase"]] != p:
                    raise ValueError(f"{prefix}: invalid patrol start")
                for i, q in enumerate(rail):
                    nxt = rail[(i + 1) % len(rail)]
                    if abs(nxt[0] - q[0]) + abs(nxt[1] - q[1]) > 1:
                        raise ValueError(f"{prefix}: invalid patrol edge")
        wall_cells: set[tuple[int, int]] = set()
        for wall in level["moving_walls"]:
            x, y = wall["path"][wall["phase"]]
            for yy in range(y, y + wall["h"]):
                for xx in range(x, x + wall["w"]):
                    if (xx, yy) in occupied or (xx, yy) in wall_cells:
                        raise ValueError(f"{prefix}: overlapping actors")
                    wall_cells.add((xx, yy))
    return levels


def _load_levels(folder: Path) -> list[Level]:
    paths = [folder / f"L{i:02d}.json" for i in range(1, LEVEL_COUNT + 1)]
    missing = [str(p) for p in paths if not p.is_file()]
    if missing:
        raise FileNotFoundError("Install the six Sonar level JSONs. Missing: " + ", ".join(missing))
    try:
        return validate([json.loads(p.read_text(encoding="utf-8")) for p in paths])
    except (json.JSONDecodeError, UnicodeError) as exc:
        raise ValueError(f"Invalid Sonar level file in {folder}: {exc}") from exc


def pulse_plan(level: Level, origin: list[int]) -> dict[str, Any]:
    """Schedule one direct wave and each reached relay once, in pixel frames.

    This observes a disk; walls do not occlude the abstract puzzle sonar.
    This function is used for the simulation, never to select a player action.
    """
    g = geometry(level)
    sources = [{"x": origin[0], "y": origin[1], "radius": level["sonar_radius"],
                "start": 0, "relay": -1}]
    times = [math.inf] * len(level["relays"])
    done: set[int] = set()

    def relax(source: dict[str, int]) -> None:
        for i, relay in enumerate(level["relays"]):
            if i in done:
                continue
            dx, dy = relay["x"] - source["x"], relay["y"] - source["y"]
            if dx * dx + dy * dy <= source["radius"] ** 2:
                t = source["start"] + math.ceil(math.hypot(dx, dy) * g["p"]) + 3
                times[i] = min(times[i], t)

    relax(sources[0])
    while True:
        candidates = [i for i, t in enumerate(times) if i not in done and math.isfinite(t)]
        if not candidates:
            break
        best = min(candidates, key=lambda i: (times[i], i))
        done.add(best)
        relay = level["relays"][best]
        source = {"x": relay["x"], "y": relay["y"], "radius": relay["radius"],
                  "start": int(times[best]), "relay": best}
        sources.append(source)
        relax(source)
    arrivals = [-1] * (g["cols"] * g["rows"])
    end = 0
    for source in sources:
        end = max(end, source["start"] + source["radius"] * g["p"])
        for y in range(g["rows"]):
            for x in range(g["cols"]):
                dx, dy = x - source["x"], y - source["y"]
                if dx * dx + dy * dy > source["radius"] ** 2:
                    continue
                t = source["start"] + math.ceil(math.hypot(dx, dy) * g["p"])
                k = y * g["cols"] + x
                if arrivals[k] < 0 or t < arrivals[k]:
                    arrivals[k] = t
    return {"sources": sources, "arrivals": arrivals, "end": end}


@lru_cache(maxsize=1024)
def _ring_pixels(cols: int, rows: int, cell: int, sx: int, sy: int, radius: int) -> tuple[int, ...]:
    """Cache only a geometric display ring, never a hidden map or a solution."""
    ox, oy = (64 - cols * cell) // 2, 7 + (52 - rows * cell) // 2
    cx, cy = ox + sx * cell + (cell - 1) / 2, oy + sy * cell + (cell - 1) / 2
    lo, hi = (radius - .65) ** 2, (radius + .65) ** 2
    return tuple(y * SIZE + x for y in range(oy, oy + rows * cell)
                 for x in range(ox, ox + cols * cell)
                 if lo <= (x - cx) ** 2 + (y - cy) ** 2 <= hi)


class SonarMazeEngine:
    """CustomGameInfo-compatible engine. Only ordinary actions alter a game.

    info provides game_id, title, family, levels (1..6), default_fps.
    Normally levels=6. levels_dir or level_data are author-only test overrides.
    The runtime never reads validation files or exports the hidden map in an
    observation. inspect/debug_load are explicit author tools, not ARC actions.
    """

    def __init__(self, info: CustomGameInfo, *, levels_dir: str | Path | None = None,
                 level_data: list[Level] | None = None) -> None:
        if levels_dir is not None and level_data is not None:
            raise ValueError("Choose levels_dir or level_data, not both")
        self.info = info
        self.levels_dir = (Path(levels_dir).resolve() if levels_dir is not None else LEVELS_DIR)
        self._templates = _load_levels(self.levels_dir) if level_data is None else validate(level_data)
        self.win_levels = _integer(info.levels, "info.levels", 1, LEVEL_COUNT)
        self._fps = _integer(info.default_fps, "info.default_fps", 1, 240)
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = False
        self.step_index = 0
        self.attempts = 0
        self.last_action = "RESET"
        self._pending_frames: list[Raster] | None = None
        self._pending_extra: dict[str, Any] = {}
        self._setup(0)
        self._event = "ready"
        self._begin()

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    @property
    def _level(self) -> Level:
        return self._templates[self._index]

    def _setup(self, index: int) -> None:
        self._index = index
        level = self._level
        self._geom = geometry(level)
        self._player = level["start"][:]
        self._gate_open = [d["open"] for d in level["gates"]]
        self._pending_close = [False] * len(self._gate_open)
        self._echo_ages = [0] * (self._geom["rows"] * self._geom["cols"])
        # Dict keys reproduce JS Set insertion order for author replay comparisons.
        self._visited = {self._id(*self._player): None}
        self._touched: dict[int, None] = {}
        self.move_left, self.sonar_left = level["move_budget"], level["sonar_budget"]
        self.moves_used = self.sonars_used = self.waits_used = self.bumps = 0
        self.turn = self.forced_steps = 0
        self._last_echo: dict[str, Any] | None = None
        self.state = "NOT_FINISHED"
        self._movers = [{"x": m["path"][m["phase"]][0], "y": m["path"][m["phase"]][1],
                         "phase": m["phase"]} for m in level["moving_walls"]]
        self._enemies = [{"x": e["x"], "y": e["y"], "phase": e.get("phase", 0),
                          "target": None, "alert": 0} for e in level["enemies"]]
        self._fatal: str | None = None
        self._fired_pads: set[int] = set()

    def _id(self, x: int, y: int) -> int:
        return y * self._geom["cols"] + x

    def _point(self, x: int, y: int) -> dict[str, int]:
        g = self._geom
        return {"x": g["x"] + x * g["p"], "y": g["y"] + y * g["p"]}

    def _gate_at(self, x: int, y: int) -> int:
        return next((i for i, d in enumerate(self._level["gates"]) if d["x"] == x and d["y"] == y), -1)

    def _enemy_at(self, x: int, y: int, ignore: int = -1) -> int:
        return next((i for i, e in enumerate(self._enemies)
                     if i != ignore and e["x"] == x and e["y"] == y), -1)

    def _wall_rect(self, index: int) -> dict[str, int]:
        wall, pos = self._level["moving_walls"][index], self._movers[index]
        return {"x": pos["x"], "y": pos["y"], "w": wall["w"], "h": wall["h"]}

    def _moving_at(self, x: int, y: int, ignore: int = -1) -> int:
        return next((i for i in range(len(self._movers))
                     if i != ignore and _inside(x, y, self._wall_rect(i))), -1)

    def _outside(self, x: int, y: int) -> bool:
        return x < 0 or y < 0 or x >= self._geom["cols"] or y >= self._geom["rows"]

    def _is_wall(self, x: int, y: int) -> bool:
        return self._outside(x, y) or self._level["grid"][y][x] == "#"

    def _fixed_blocked(self, x: int, y: int) -> bool:
        if self._is_wall(x, y):
            return True
        door = self._gate_at(x, y)
        return door >= 0 and not self._gate_open[door]

    def _blocked(self, x: int, y: int, ignore: int = -1) -> bool:
        return self._fixed_blocked(x, y) or self._moving_at(x, y, ignore) >= 0

    @staticmethod
    def _arrow(buf: bytearray, cx: int, cy: int, direction: int, color: int) -> None:
        dx, dy = DIRS[direction]
        for x, y in ((cx, cy), (cx + dx, cy + dy), (cx - dy, cy + dx), (cx + dy, cy - dx)):
            _fill(buf, x, y, 1, 1, color)

    def _render_frame(self, **o: Any) -> Raster:
        """Integer raster: same layer order and ring test as the web v4."""
        buf = bytearray([5]) * (SIZE * SIZE)
        g, level = self._geom, self._level
        p = g["p"]
        _fill(buf, g["x"], g["y"], g["cols"] * p, g["rows"] * p, 4)
        _outline(buf, g["x"] - 1, g["y"] - 1, g["cols"] * p + 2, g["rows"] * p + 2, 2)
        for y in range(g["rows"]):
            for x in range(g["cols"]):
                pos, k = self._point(x, y), self._id(x, y)
                xx, yy, age = pos["x"], pos["y"], self._echo_ages[k]
                if age > 0:
                    if level["grid"][y][x] == "#":
                        _fill(buf, xx, yy, p, p, 3 if age == level["echo_moves"] else 2)
                        _outline(buf, xx, yy, p, p, 1 if age == level["echo_moves"] else 3)
                    else:
                        _fill(buf, xx, yy, p, p, 2)
                elif k in self._touched:
                    _fill(buf, xx, yy, p, p, 2)
                    _outline(buf, xx, yy, p, p, 3)
                else:
                    _fill(buf, xx, yy, 1, 1, 2)
                if k in self._visited:
                    _fill(buf, xx + p // 2, yy + p // 2, 1, 1, 3)
        for wall in level["moving_walls"]:
            for q in wall["path"]:
                pos = self._point(*q)
                _fill(buf, pos["x"] + p // 2, pos["y"] + p // 2, 1, 1, 9)
        for pad in level["pushers"]:
            pos = self._point(pad["x"], pad["y"])
            _outline(buf, pos["x"], pos["y"], p, p, 13)
            self._arrow(buf, pos["x"] + (p - 1) // 2, pos["y"] + (p - 1) // 2, pad["direction"], 11)
        if "plan" in o and "t" in o:
            for source in o["plan"]["sources"]:
                radius = o["t"] - source["start"]
                if radius < 0 or radius > source["radius"] * p:
                    continue
                color = 10 if source["relay"] < 0 else 15
                for k in _ring_pixels(g["cols"], g["rows"], p, source["x"], source["y"], radius):
                    buf[k] = color
        for relay in level["relays"]:
            pos = self._point(relay["x"], relay["y"])
            cx, cy = pos["x"] + p // 2, pos["y"] + p // 2
            _fill(buf, cx, cy - 1, 1, 3, 15)
            _fill(buf, cx - 1, cy, 3, 1, 15)
            _fill(buf, cx, cy, 1, 1, 5)
        for i, door in enumerate(level["gates"]):
            pos = self._point(door["x"], door["y"])
            x, y = pos["x"], pos["y"]
            if self._gate_open[i]:
                _fill(buf, x, y + 1, 1, p - 2, 12)
                _fill(buf, x + p - 1, y + 1, 1, p - 2, 12)
            else:
                _fill(buf, x + 1, y + 1, p - 2, p - 2, 12)
                _fill(buf, x + p // 2, y + 1, 1, p - 2, 13)
            if self._pending_close[i]:
                _fill(buf, x + p // 2, y + p // 2, 1, 1, 0)
        for i, mover in enumerate(self._movers):
            wall = level["moving_walls"][i]
            pos = o.get("wallPixel", {}).get(i) or self._point(mover["x"], mover["y"])
            x, y, w, h = pos["x"], pos["y"], wall["w"] * p, wall["h"] * p
            _fill(buf, x, y, w, h, 9)
            _outline(buf, x, y, w, h, 10)
            nxt = wall["path"][(mover["phase"] + 1) % len(wall["path"])]
            dx, dy = nxt[0] - mover["x"], nxt[1] - mover["y"]
            cx, cy = x + w // 2, y + h // 2
            _fill(buf, cx, cy, 1, 1, 5)
            if dx or dy:
                _fill(buf, cx + dx, cy + dy, 1, 1, 5)
        for i, enemy in enumerate(self._enemies):
            pos = o.get("enemyPixel", {}).get(i) or self._point(enemy["x"], enemy["y"])
            color = 6 if level["enemies"][i]["kind"] == "listener" else 8
            _fill(buf, pos["x"] + 1, pos["y"] + 1, p - 2, p - 2, color)
            _fill(buf, pos["x"] + 1, pos["y"] + 1, 1, 1, 0)
            if enemy["alert"]:
                _outline(buf, pos["x"], pos["y"], p, p, color)
        ex = self._point(*level["exit"])
        _outline(buf, ex["x"], ex["y"], p, p, 14)
        _fill(buf, ex["x"] + p // 2, ex["y"] + 1, 1, p - 2, 14)
        pos = o.get("playerPixel") or self._point(*self._player)
        size = 3 if p >= 5 else 2
        offset = (p - size) // 2
        _fill(buf, pos["x"] + offset, pos["y"] + offset, size, size, 0)
        _fill(buf, pos["x"] + offset + size // 2, pos["y"] + offset + size // 2, 1, 1, 10)
        if "bump" in o and not self._outside(*o["bump"]):
            pos = self._point(*o["bump"])
            _outline(buf, pos["x"], pos["y"], p, p, 8)
        _fill(buf, 2, 1, 2, 3, 11)
        _outline(buf, 6, 1, 33, 4, 2)
        _fill(buf, 7, 2, math.ceil(31 * self.move_left / level["move_budget"]), 2, 11)
        for i in range(level["sonar_budget"]):
            _outline(buf, 43 + 4 * i, 1, 3, 4, 10 if i < self.sonar_left else 2)
            if i < self.sonar_left:
                _fill(buf, 44 + 4 * i, 2, 1, 2, 10)
        for i in range(4):
            _fill(buf, 54 + 2 * i, 2, 1, 2, 0 if self.turn % 4 == i else 2)
        for i in range(LEVEL_COUNT):
            _fill(buf, 2 + 5 * i, 62, 4, 1, 14 if self._completed[i] else 2)
        # No bottom-right icon or invisible click target.
        if "border" in o:
            _outline(buf, 0, 0, 64, 64, o["border"])
        if o.get("red"):
            buf[:] = bytes([8]) * (SIZE * SIZE)
        return [list(buf[y * SIZE:(y + 1) * SIZE]) for y in range(SIZE)]

    def _emit(self, kind: str, ms: int = 55, **options: Any) -> None:
        self._frames.append(self._render_frame(**options))
        self._durations.append(ms)
        self._timeline.append({"level": self._index + 1, "turn": self.turn, "kind": kind,
                               "move_left": self.move_left, "sonar_left": self.sonar_left})

    def _begin(self) -> None:
        self._events: list[dict[str, Any]] = []
        self._frames: list[Raster] = []
        self._durations: list[int] = []
        self._timeline: list[dict[str, Any]] = []
        self._fired_pads = set()
        self._fatal = None
        self._pending_frames, self._pending_extra = None, {}

    def _response(self, event: str, **extra: Any) -> dict[str, Any]:
        self._event = event
        self._pending_frames = self._frames or None
        self._pending_extra = {"events": copy.deepcopy(self._events), **extra}
        if self._frames:
            self._pending_extra.update(frame_durations_ms=self._durations[:],
                                       timeline=copy.deepcopy(self._timeline))
        self._frames, self._durations, self._timeline = [], [], []
        return self.public_state()

    def _succeed(self) -> dict[str, Any]:
        result = {"level": self._index + 1, "moves": self.moves_used, "sonars": self.sonars_used,
                  "waits": self.waits_used, "bumps": self.bumps, "forced_steps": self.forced_steps,
                  "move_left": self.move_left, "sonar_left": self.sonar_left}
        self._completed[self._index] = True
        self._events.append({"type": "success", **result})
        for _ in range(3):
            for _ in range(5):
                self._emit("success_on", 80, border=14)
            for _ in range(3):
                self._emit("success_off", 80)
        if self.test_mode or self._index == self.win_levels - 1:
            self.state = "WIN"
        else:
            self._setup(self._index + 1)
        self._emit("ready", 80)
        return self._response("win" if self.state == "WIN" else "success",
                              result=result, played_level=result["level"])

    def _fail(self, reason: str) -> dict[str, Any]:
        result = {"level": self._index + 1, "moves": self.moves_used, "sonars": self.sonars_used,
                  "waits": self.waits_used, "bumps": self.bumps, "turn": self.turn}
        self._events.append({"type": "failure", "reason": reason, **result})
        self._emit("detected", 170)
        for _ in range(3):
            self._emit("failure", 110, red=True)
        self.attempts += 1
        self._setup(self._index)
        self._emit("reset", 120)
        return self._response("failure", result=result, played_level=result["level"], reason=reason)

    def _settle_doors(self) -> None:
        for i, door in enumerate(self._level["gates"]):
            if (self._pending_close[i] and self._player != [door["x"], door["y"]]
                    and self._enemy_at(door["x"], door["y"]) < 0):
                self._pending_close[i] = self._gate_open[i] = False
                self._events.append({"type": "door", "door": i, "open": False, "reason": "cell_freed"})

    def _touch_wall(self, to: list[int]) -> None:
        if not self._outside(*to) and self._is_wall(*to):
            self._touched[self._id(*to)] = None

    def _slide_player(self, to: list[int], kind: str) -> None:
        old = self._player[:]
        pos, p = self._point(*old), self._geom["p"]
        dx, dy = to[0] - old[0], to[1] - old[1]
        for k in range(1, p):
            self._emit(kind, 30, playerPixel={"x": pos["x"] + dx * k, "y": pos["y"] + dy * k})
        self._player = to[:]
        self._visited[self._id(*self._player)] = None
        self._events.append({"type": "move", "from": old, "to": self._player[:], "forced": kind != "move"})
        self._emit(kind, 45)
        self._settle_doors()
        if self._enemy_at(*self._player) >= 0:
            self._fatal = "enemy_contact"

    def _eject(self) -> None:
        while self._fatal is None:
            k = next((i for i, p in enumerate(self._level["pushers"])
                      if self._player == [p["x"], p["y"]]), -1)
            if k < 0 or k in self._fired_pads:
                break
            self._fired_pads.add(k)
            pad = self._level["pushers"][k]
            dx, dy = DIRS[pad["direction"]]
            self._events.append({"type": "eject", "pad": k, "at": self._player[:],
                                 "direction": pad["direction"], "force": pad["force"]})
            self._emit("eject_start", 130)
            hit_another = False
            for _ in range(pad["force"]):
                if self._fatal:
                    break
                to = [self._player[0] + dx, self._player[1] + dy]
                if self._blocked(*to):
                    self._touch_wall(to)
                    self._events.append({"type": "eject_stop", "at": to})
                    self._emit("eject_stop", 100, bump=to)
                    break
                self._slide_player(to, "eject")
                self.forced_steps += 1
                if self._player == self._level["exit"]:
                    return
                nxt = next((i for i, p in enumerate(self._level["pushers"])
                            if self._player == [p["x"], p["y"]]), -1)
                if nxt >= 0 and nxt != k and nxt not in self._fired_pads:
                    hit_another = True
                    break
            if not hit_another:
                break

    def _move_walls(self) -> None:
        for i, mover in enumerate(self._movers):
            if self._fatal:
                break
            wall = self._level["moving_walls"][i]
            if self.turn % wall["period"]:
                continue
            nxt_index = (mover["phase"] + 1) % len(wall["path"])
            to = wall["path"][nxt_index]
            dx, dy = to[0] - mover["x"], to[1] - mover["y"]
            if not dx and not dy:
                mover["phase"] = nxt_index
                continue
            rect = {"x": to[0], "y": to[1], "w": wall["w"], "h": wall["h"]}
            jam = any(self._fixed_blocked(x, y) or self._moving_at(x, y, i) >= 0 or self._enemy_at(x, y) >= 0
                      for y in range(rect["y"], rect["y"] + rect["h"])
                      for x in range(rect["x"], rect["x"] + rect["w"]))
            if jam:
                self._events.append({"type": "wall_wait", "wall": i})
                continue
            old = [mover["x"], mover["y"]]
            push = _inside(*self._player, rect)
            pp, start, p = self._point(*self._player), self._point(*old), self._geom["p"]
            pt = [self._player[0] + dx, self._player[1] + dy]
            if push and (self._blocked(*pt, ignore=i) or _inside(*pt, rect) or self._enemy_at(*pt) >= 0):
                self._fatal = "crushed"
                self._events.append({"type": "crush", "wall": i, "at": self._player[:]})
                break
            for k in range(1, p):
                o = {"wallPixel": {i: {"x": start["x"] + dx * k, "y": start["y"] + dy * k}}}
                if push:
                    o["playerPixel"] = {"x": pp["x"] + dx * k, "y": pp["y"] + dy * k}
                self._emit("wall_slide", 40, **o)
            mover["x"], mover["y"], mover["phase"] = to[0], to[1], nxt_index
            if push:
                previous = self._player[:]
                self._player = pt
                self._visited[self._id(*pt)] = None
                self.forced_steps += 1
                self._events.append({"type": "wall_push", "wall": i, "from": previous, "to": pt[:]})
            self._events.append({"type": "wall", "wall": i, "from": old, "to": to[:]})
            self._emit("wall_slide", 70)
            self._settle_doors()
            if push:
                self._eject()

    def _next_step_to(self, start: list[int], target: list[int], ignore: int) -> list[int] | None:
        """BFS of the listener towards the last sound, never towards future player positions."""
        queue = [start]
        parent: dict[int, list[int] | None] = {self._id(*start): None}
        found = None
        for current in queue:
            if current == target:
                found = current
                break
            for a in ORDER:
                dx, dy = DIRS[a]
                to = [current[0] + dx, current[1] + dy]
                key = self._id(*to)
                if self._blocked(*to) or self._enemy_at(*to, ignore=ignore) >= 0 or key in parent:
                    continue
                parent[key] = current
                queue.append(to)
        if found is None or start == target:
            return None
        current = found
        while parent[self._id(*current)] is not None and parent[self._id(*current)] != start:
            current = parent[self._id(*current)]  # type: ignore[assignment]
        return current

    def _move_enemies(self) -> None:
        for i, enemy in enumerate(self._enemies):
            if self._fatal:
                break
            definition = self._level["enemies"][i]
            if self.turn % definition["period"]:
                continue
            to = None
            next_phase = enemy["phase"]
            if definition["kind"] == "patrol":
                next_phase = (enemy["phase"] + 1) % len(definition["path"])
                to = definition["path"][next_phase]
            elif enemy["target"] is not None and enemy["alert"] > 0:
                to = self._next_step_to([enemy["x"], enemy["y"]], enemy["target"], i)
                enemy["alert"] -= 1
                if [enemy["x"], enemy["y"]] == enemy["target"] or enemy["alert"] == 0:
                    enemy["target"], enemy["alert"] = None, 0
            if to is None or self._blocked(*to) or self._enemy_at(*to, ignore=i) >= 0:
                continue
            old = [enemy["x"], enemy["y"]]
            pos, p = self._point(*old), self._geom["p"]
            for k in range(1, p):
                self._emit("enemy_move", 40, enemyPixel={i: {"x": pos["x"] + (to[0] - enemy["x"]) * k,
                                                              "y": pos["y"] + (to[1] - enemy["y"]) * k}})
            enemy["x"], enemy["y"], enemy["phase"] = to[0], to[1], next_phase
            self._events.append({"type": "enemy", "enemy": i, "from": old, "to": to[:]})
            self._emit("enemy_move", 70)
            self._settle_doors()
            if self._player == to:
                self._fatal = "enemy_contact"

    def _advance_world(self) -> None:
        self._move_walls()
        if not self._fatal:
            self._move_enemies()

    def _finish(self, event: str, **extra: Any) -> dict[str, Any]:
        if self._fatal:
            return self._fail(self._fatal)
        if self._player == self._level["exit"]:
            return self._succeed()
        if self.move_left == 0:
            return self._fail("move_budget_exhausted")
        self._emit("ready", 65)
        return self._response(event, **extra)

    def _move(self, action: int) -> dict[str, Any]:
        if self.move_left <= 0:
            return self._response("ignored")
        self.move_left -= 1
        self.moves_used += 1
        self.turn += 1
        self._echo_ages = [max(0, n - 1) for n in self._echo_ages]
        dx, dy = DIRS[action]
        to = [self._player[0] + dx, self._player[1] + dy]
        bump = self._blocked(*to)
        if bump:
            self.bumps += 1
            self._touch_wall(to)
            self._events.append({"type": "bump", "at": to, "kind": "fixed" if self._is_wall(*to) else "visible"})
            for _ in range(2):
                self._emit("bump", 90, bump=to)
        else:
            self._slide_player(to, "move")
            if not self._fatal:
                self._eject()
        if not self._fatal:
            self._advance_world()
        return self._finish("blocked" if bump else "moved")

    def _wait_turn(self) -> dict[str, Any]:
        self.turn += 1
        self.waits_used += 1
        self._events.append({"type": "wait", "at": self._player[:], "turn": self.turn})
        self._emit("wait", 180)
        self._advance_world()
        return self._finish("waited")

    def _sonar(self) -> dict[str, Any]:
        if self.sonar_left < 1:
            return self._wait_turn()
        self.sonar_left -= 1
        self.sonars_used += 1
        self.turn += 1
        plan, g = pulse_plan(self._level, self._player), self._geom
        affected: set[int] = set()
        fresh = walls = door_changes = 0
        self._events.append({"type": "sonar", "origin": self._player[:], "radius": self._level["sonar_radius"]})
        for t in range(plan["end"] + 1):
            for k, arrival in enumerate(plan["arrivals"]):
                if arrival == t:
                    if self._echo_ages[k] == 0:
                        fresh += 1
                    self._echo_ages[k] = self._level["echo_moves"]
                    if self._level["grid"][k // g["cols"]][k % g["cols"]] == "#":
                        walls += 1
            for source in plan["sources"]:
                if source["relay"] >= 0 and source["start"] == t:
                    self._events.append({"type": "relay", "relay": source["relay"],
                                         "at": [source["x"], source["y"]], "radius": source["radius"]})
            for i, door in enumerate(self._level["gates"]):
                if i in affected or plan["arrivals"][self._id(door["x"], door["y"])] != t:
                    continue
                affected.add(i)
                door_changes += 1
                if self._pending_close[i]:
                    self._pending_close[i], self._gate_open[i] = False, True
                elif self._gate_open[i] and (self._player == [door["x"], door["y"]]
                                            or self._enemy_at(door["x"], door["y"]) >= 0):
                    self._pending_close[i] = True
                else:
                    self._gate_open[i] = not self._gate_open[i]
                self._events.append({"type": "door", "door": i, "open": self._gate_open[i],
                                     "pending": self._pending_close[i], "reason": "sonar"})
            self._emit("sonar_wave", 35, plan=plan, t=t)
        for i, enemy in enumerate(self._enemies):
            if self._level["enemies"][i]["kind"] != "listener":
                continue
            sources = [s for s in plan["sources"]
                       if (s["x"] - enemy["x"]) ** 2 + (s["y"] - enemy["y"]) ** 2 <= s["radius"] ** 2]
            sources.sort(key=lambda s: s["start"] + math.hypot(s["x"] - enemy["x"], s["y"] - enemy["y"]) * g["p"])
            if sources:
                enemy["target"] = [sources[0]["x"], sources[0]["y"]]
                enemy["alert"] = 10
                self._events.append({"type": "heard", "enemy": i, "target": enemy["target"][:]})
        self._last_echo = {"sources": len(plan["sources"]), "relays": len(plan["sources"]) - 1,
                           "cells": sum(t >= 0 for t in plan["arrivals"]), "walls": walls,
                           "newly_visible": fresh, "door_changes": door_changes}
        self._emit("sonar_hold", 320)
        self._advance_world()
        return self._finish("sonar", scan=copy.deepcopy(self._last_echo))

    def action(self, action_id: int | str | Mapping[str, Any],
               data: dict[str, Any] | None = None) -> dict[str, Any]:
        self._begin()
        if isinstance(action_id, Mapping):
            packet = action_id
            data = packet.get("data")
            action_id = packet["id"] if "id" in packet else packet.get("action")
        if isinstance(action_id, str) and action_id in {f"ACTION{i}" for i in range(1, 8)}:
            action_id = int(action_id[6:])
        if (type(action_id) is int and action_id == 0) or action_id == "RESET":
            return self.reset()
        if type(action_id) is int and action_id == ACTION_RESET:
            self.step_index += 1
            return self.level_reset()
        if self.state == "WIN":
            return self._response("finished")
        # All coordinate clicks are intentionally inert, as in the delivered v4.
        if type(action_id) is not int or action_id not in (1, 2, 3, 4, 5):
            return self._response("ignored")
        self.step_index += 1
        self.last_action = f"ACTION{action_id}"
        return self._sonar() if action_id == ACTION_SPACE else self._move(action_id)

    def reset(self) -> dict[str, Any]:
        self._begin()
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = False
        self.step_index = self.attempts = 0
        self.last_action = "RESET"
        self._setup(0)
        self._emit("ready", 80)
        return self._response("reset")

    def level_reset(self) -> dict[str, Any]:
        """No extra command is counted here; action(7) counts its own command."""
        self._begin()
        self._completed[self._index] = False
        self.attempts += 1
        self.last_action = "ACTION7"
        self._setup(self._index)
        self._emit("ready", 80)
        return self._response("restart")

    def public_state(self) -> dict[str, Any]:
        """Return a detached observation; consume a pending animation exactly once.

        No full hidden grid, echo-age array, patrol plan or solution is exported.
        Per-action events report effects which have already happened.
        """
        frames = self._pending_frames or [self._render_frame()]
        extra = self._pending_extra
        self._pending_frames, self._pending_extra = None, {}
        ids = [7] if self.state == "WIN" else [1, 2, 3, 4, 5, 7]
        score = self.levels_completed
        return {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "custom_family": self.info.family, "family": FAMILY, "wave": WAVE,
            "version": WEB_VERSION, "frame": frames[-1], "frames": frames,
            "frame_count": len(frames),
            "default_fps": max(self._fps, ANIM_FPS) if len(frames) > 1 else self._fps,
            "state": self.state, "level": self._index + 1, "score": score,
            "levels_completed": score, "win_levels": 1 if self.test_mode else self.win_levels,
            "win_score": 1 if self.test_mode else self.win_levels, "test_mode": self.test_mode,
            "step_index": self.step_index, "turn": self.turn,
            "move_left": self.move_left, "sonar_left": self.sonar_left,
            "moves_used": self.moves_used, "sonars_used": self.sonars_used,
            "waits_used": self.waits_used, "bumps": self.bumps, "forced_steps": self.forced_steps,
            "event": self._event, "available_actions": [f"ACTION{i}" for i in ids],
            "available_action_ids": ids, "last_action": self.last_action, "full_reset": False,
            "source_path": str(self.levels_dir), "level_name": self._level.get("title", ""),
            **extra,
        }

    def jump_to_level(self, number: int) -> dict[str, Any]:
        """Author/UI isolated preview, not an available action for the agent."""
        _integer(number, "level", 1, LEVEL_COUNT)
        self._begin()
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = True
        self.step_index = self.attempts = 0
        self.last_action = "PREVIEW"
        self._setup(number - 1)
        self._emit("ready", 80)
        return self._response("preview")

    def metadata(self) -> list[dict[str, Any]]:
        return [{"number": i + 1, "title": l.get("title", ""), "chapter": l.get("chapter", ""),
                 "moves": l["move_budget"], "sonars": l["sonar_budget"],
                 "relays": len(l["relays"]), "gates": len(l["gates"]),
                 "moving_walls": len(l["moving_walls"]), "enemies": len(l["enemies"]),
                 "pushers": len(l["pushers"])} for i, l in enumerate(self._templates)]

    def view(self) -> dict[str, Any]:
        """Human-viewer metadata, kept separate from the agent observation."""
        l = self._level
        return {"level": self._index + 1, "title": l.get("title", ""), "subtitle": l.get("subtitle", ""),
                "chapter": l.get("chapter", ""), "hint": l.get("hint", ""),
                "geometry": self._geom.copy(), "player": self._player[:], "exit": l["exit"][:],
                "move_budget": l["move_budget"], "move_left": self.move_left,
                "sonar_budget": l["sonar_budget"], "sonar_left": self.sonar_left,
                "sonar_radius": l["sonar_radius"], "echo_moves": l["echo_moves"],
                "moves_used": self.moves_used, "sonars_used": self.sonars_used, "waits_used": self.waits_used,
                "bumps": self.bumps, "turn": self.turn, "forced_steps": self.forced_steps,
                "touched_walls": len(self._touched), "completed": self._completed[:],
                "state": self.state, "test_mode": self.test_mode, "attempts": self.attempts,
                "last_echo": copy.deepcopy(self._last_echo), "relays": copy.deepcopy(l["relays"]),
                "gates": [{**copy.deepcopy(d), "open": self._gate_open[i], "pending": self._pending_close[i]}
                          for i, d in enumerate(l["gates"])],
                "moving_walls": [{**s, "w": l["moving_walls"][i]["w"], "h": l["moving_walls"][i]["h"],
                                  "period": l["moving_walls"][i]["period"],
                                  "next": l["moving_walls"][i]["path"][(s["phase"] + 1) % len(l["moving_walls"][i]["path"])] [:]}
                                 for i, s in enumerate(self._movers)],
                "enemies": [{"x": e["x"], "y": e["y"], "kind": l["enemies"][i]["kind"],
                             "period": l["enemies"][i]["period"], "alert": e["alert"] > 0}
                            for i, e in enumerate(self._enemies)],
                "pushers": copy.deepcopy(l["pushers"]), "buttons": {}}

    def inspect(self) -> dict[str, Any]:
        """Privileged author state, NEVER inserted into public_state()."""
        return copy.deepcopy({"level": self._index + 1, "player": self._player,
                              "gate_open": self._gate_open, "pending_close": self._pending_close,
                              "echo_ages": self._echo_ages, "visited": list(self._visited),
                              "touched": list(self._touched), "movers": self._movers, "enemies": self._enemies,
                              "turn": self.turn, "forced_steps": self.forced_steps,
                              "move_left": self.move_left, "sonar_left": self.sonar_left,
                              "moves_used": self.moves_used, "sonars_used": self.sonars_used,
                              "waits_used": self.waits_used, "bumps": self.bumps})

    def debug_load(self, state: dict[str, Any]) -> None:
        """Author-only replay of a trusted inspect() snapshot, NOT a game action."""
        s = copy.deepcopy(state)
        _integer(s.get("level"), "debug level", 1, LEVEL_COUNT)
        self._setup(s["level"] - 1)
        self._player = s["player"][:]
        self._gate_open, self._pending_close = s["gate_open"][:], s["pending_close"][:]
        self._echo_ages = s["echo_ages"][:]
        self._visited, self._touched = dict.fromkeys(s["visited"]), dict.fromkeys(s["touched"])
        self._movers, self._enemies = s["movers"], s["enemies"]
        self.turn, self.forced_steps = s["turn"], s["forced_steps"]
        self.move_left, self.sonar_left = s["move_left"], s["sonar_left"]
        self.moves_used, self.sonars_used = s["moves_used"], s["sonars_used"]
        self.waits_used, self.bumps = s.get("waits_used", 0), s["bumps"]
        self._begin()

    # Optional aliases for the existing JavaScript-shaped author tools.
    step = action
    observe = public_state
    levelReset = level_reset
    jumpToLevel = jump_to_level
    debugLoad = debug_load


__all__ = ["SonarMazeEngine", "GAME_ID", "FAMILY", "WAVE", "WEB_VERSION", "SIZE", "FRAME",
           "LEVEL_COUNT", "LEVELS_DIR", "ANIM_FPS", "PALETTE", "DIRS", "ORDER", "BUTTONS",
           "ACTION_UP", "ACTION_DOWN", "ACTION_LEFT", "ACTION_RIGHT", "ACTION_SPACE",
           "ACTION_CLICK", "ACTION_RESET", "geometry", "pulse_plan", "validate"]
