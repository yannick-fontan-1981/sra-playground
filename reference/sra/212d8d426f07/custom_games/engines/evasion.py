"""EVAS — Évasion, rondes de nuit (custom_3).

Faithful Python port of the accepted Evasion_custom_3.html game, using the
custom backend interface of FITE, Grillage and Dichotomy. Standard library only.

ACTION5: wait 20 simulation ticks, unless detected first.
ACTION6: BFS to a clicked floor cell (integer raster coordinates 0..63).
ACTION7 / level_reset(): reset the current level, preserving earlier wins.
reset() / action(0): reset the campaign, counters and patrol phases.

Each pixel of travel advances one tick. All guards advance on the same clock.
The BFS uses static walls ONLY; it is not a stealth solver. Detection is checked
at EVERY intermediate tick, before victory. One illuminated pixel (including a
black stripe) or guard-body contact stops the action and resets the level.

frame is [64][64]; frames is [images][64][64]. Consume the whole sequence and its
timeline: the final image after a failure already shows the restored start.
There is no random behaviour, external dependency, sleep, or real-time clock.
"""
from __future__ import annotations

import copy
import json
import math
from collections import deque
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

FRAME = SIZE = 64
CELL = 4
WAIT_TICKS = WAIT = 20
ANIM_FPS = FPS = 24
LEVEL_COUNT = 6
GAME_ID = "evas-c3000001"
FAMILY = "evasion"
WAVE = "custom_3"
ACTION_SPACE, ACTION_CLICK, ACTION_RESET = 5, 6, 7
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / FAMILY / "levels"
TAN_HALF = math.sqrt(2.0) - 1.0  # 45 degrees total aperture: +/-22.5 degrees.
DIRS = ((1, 0), (0, 1), (-1, 0), (0, -1))  # Match web BFS tie order exactly.
PALETTE = (
    "#FFFFFF", "#BFC3C7", "#2C333B", "#4A4E54", "#181E26", "#000000",
    "#A73B83", "#E5B7A5", "#ED5555", "#6996C9", "#68C6CE", "#F1CF71",
    "#DD9259", "#765440", "#79CC99", "#AB8BD1",
)
C_WHITE, C_LIGHT, C_EDGE, C_FLOOR, C_WALL, C_BLACK = 0, 1, 2, 3, 4, 5
C_RED, C_TORCH, C_GUARD, C_BACK, C_GREEN = 8, 11, 12, 13, 14
Raster = list[list[int]]
Point = tuple[int, int]


def _integer(value: Any, label: str, low: int, high: int) -> int:
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"{label}: expected an integer in {low}..{high}, got {value!r}")
    return value


def _point(value: Any, label: str) -> Point:
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        raise ValueError(f"{label}: expected [column, row]")
    return (_integer(value[0], label + '.column', 0, 14),
            _integer(value[1], label + '.row', 0, 13))


@dataclass(frozen=True)
class GuardConfig:
    route: tuple[Point, ...]
    mode: str = "loop"
    ticks_per_pixel: int = 2
    phase: int = 0
    range: int = 20
    color: int = C_GUARD
    period: int | None = None


@dataclass(frozen=True)
class LevelConfig:
    number: int
    title: str
    note: str
    map: tuple[str, ...]
    start: Point
    exit: Point
    guards: tuple[GuardConfig, ...]

    @property
    def name(self) -> str:
        return self.title

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> LevelConfig:
        if not isinstance(data, Mapping):
            raise ValueError("Level must be a JSON object")
        raw_map = data.get("map")
        if (not isinstance(raw_map, (list, tuple)) or not 3 <= len(raw_map) <= 14
                or not isinstance(raw_map[0], str) or not 3 <= len(raw_map[0]) <= 15):
            raise ValueError("Map must have 3..14 rows and 3..15 columns")
        cols = len(raw_map[0])
        if any(not isinstance(row, str) or len(row) != cols or set(row) - {"#", "."}
               for row in raw_map):
            raise ValueError("Map must be rectangular and use only # and .")
        start, end = _point(data.get("start"), "start"), _point(data.get("exit"), "exit")
        for label, (c, r) in (("start", start), ("exit", end)):
            if r >= len(raw_map) or c >= cols or raw_map[r][c] == '#':
                raise ValueError(f"{label} must be on walkable floor")
        raw_guards = data.get("guards", [])
        if not isinstance(raw_guards, (list, tuple)):
            raise ValueError("guards must be a list")
        guards = []
        for i, g in enumerate(raw_guards):
            if not isinstance(g, Mapping):
                raise ValueError(f"Guard {i} must be an object")
            route = g.get("route")
            if not isinstance(route, (list, tuple)) or len(route) < 2:
                raise ValueError(f"Guard {i} needs at least two waypoints")
            mode = g.get("mode", "loop")
            if mode not in ("loop", "pingpong"):
                raise ValueError(f"Guard {i}: mode must be loop or pingpong")
            period = g.get("period")
            if period is not None:
                period = _integer(period, f"guard {i}.period", 1, 1_000_000)
            guards.append(GuardConfig(
                route=tuple(_point(p, f"guard {i}.route") for p in route), mode=mode,
                ticks_per_pixel=_integer(g.get("ticks_per_pixel", 2), f"guard {i}.pace", 1, 8),
                phase=_integer(g.get("phase", 0), f"guard {i}.phase", -1_000_000, 1_000_000),
                range=_integer(g.get("range", 20), f"guard {i}.range", 4, 60),
                color=_integer(g.get("color", 12), f"guard {i}.color", 0, 15), period=period,
            ))
        return cls(_integer(data.get("number"), "number", 1, LEVEL_COUNT),
                   str(data.get("title", "Évasion")), str(data.get("note", "")),
                   tuple(raw_map), start, end, tuple(guards))


def _load_all_levels(directory: Path) -> tuple[LevelConfig, ...]:
    configs = []
    for i in range(1, LEVEL_COUNT + 1):
        path = directory / f"L{i:02d}.json"
        if not path.is_file():
            raise FileNotFoundError(f"Missing level file: {path}. Copy all six JSON files.")
        try:
            cfg = LevelConfig.from_dict(json.loads(path.read_text(encoding="utf-8")))
            if cfg.number != i:
                raise ValueError(f"Expected number={i}, got {cfg.number}")
            configs.append(cfg)
        except (ValueError, TypeError, KeyError) as exc:
            raise ValueError(f"Invalid level {path}: {exc}") from exc
    return tuple(configs)


@dataclass(frozen=True)
class Pose:
    x: int
    y: int
    dx: int
    dy: int


@dataclass
class Guard:
    poses: tuple[Pose, ...]
    phase: int
    range: int
    colour: int
    index: int
    light_cache: dict[int, tuple[int, ...]] = field(default_factory=dict, repr=False)

    @property
    def period(self) -> int:
        return len(self.poses)


@dataclass(frozen=True)
class Scene:
    lit: bytes
    guards: tuple[Pose, ...]


@dataclass
class World:
    cfg: LevelConfig
    cols: int
    rows: int
    ox: int
    oy: int
    wall: bytearray
    base: bytearray
    start: Point
    exit: Point
    guards: tuple[Guard, ...] = ()
    period: int = 1
    scene_cache: dict[int, Scene] = field(default_factory=dict, repr=False)


def fill(frame: bytearray, x: int, y: int, w: int, h: int, colour: int) -> None:
    lo, hi = max(0, x), min(FRAME, x + w)
    if hi <= lo:
        return
    row = bytes([colour]) * (hi - lo)
    for yy in range(max(0, y), min(FRAME, y + h)):
        frame[yy * FRAME + lo:yy * FRAME + hi] = row


def outline(frame: bytearray, x: int, y: int, w: int, h: int, colour: int) -> None:
    fill(frame, x, y, w, 1, colour)
    fill(frame, x, y + h - 1, w, 1, colour)
    fill(frame, x, y, 1, h, colour)
    fill(frame, x + w - 1, y, 1, h, colour)


def cell_pixel(world: World, col: int, row: int) -> Point:
    return world.ox + col * CELL, world.oy + row * CELL


def cell_at(world: World, x: int, y: int) -> Point:
    return (x - world.ox) // CELL, (y - world.oy) // CELL


def walkable(world: World, col: int, row: int) -> bool:
    return 0 <= row < world.rows and 0 <= col < world.cols and world.cfg.map[row][col] != '#'


def _sign(value: int) -> int:
    return (value > 0) - (value < 0)


def compile_guard(world: World, cfg: GuardConfig, index: int) -> Guard:
    for c, r in cfg.route:
        if not walkable(world, c, r):
            raise ValueError(f"Guard {index}: waypoint in a wall ({c}, {r})")
    points = cfg.route + cfg.route[1:-1][::-1] if cfg.mode == "pingpong" else cfg.route
    poses = []
    for k, point in enumerate(points):
        x, y = cell_pixel(world, *point)
        bx, by = cell_pixel(world, *points[(k + 1) % len(points)])
        if (x != bx and y != by) or (x == bx and y == by):
            raise ValueError("Patrol segments must be nonempty and cardinal")
        dx, dy = _sign(bx - x), _sign(by - y)
        while x != bx or y != by:
            if not walkable(world, *cell_at(world, x, y)):
                raise ValueError(f"Guard {index}: patrol crosses a wall")
            poses.extend([Pose(x, y, dx, dy)] * cfg.ticks_per_pixel)
            x += dx
            y += dy
    if cfg.period is not None:
        if cfg.period < len(poses):
            raise ValueError(f"Guard {index}: period shorter than its route")
        poses.extend([poses[0]] * (cfg.period - len(poses)))
    return Guard(tuple(poses), cfg.phase, cfg.range, cfg.color, index)


def build_world(config: LevelConfig | Mapping[str, Any]) -> World:
    cfg = config if isinstance(config, LevelConfig) else LevelConfig.from_dict(config)
    cols, rows = len(cfg.map[0]), len(cfg.map)
    ox, oy = (FRAME - cols * CELL) // 2, (60 - rows * CELL) // 2
    world = World(cfg, cols, rows, ox, oy, bytearray([1]) * 4096,
                  bytearray([C_WALL]) * 4096,
                  (ox + cfg.start[0] * CELL, oy + cfg.start[1] * CELL),
                  (ox + cfg.exit[0] * CELL, oy + cfg.exit[1] * CELL))
    for r in range(rows):
        for c in range(cols):
            x, y = cell_pixel(world, c, r)
            solid = cfg.map[r][c] == '#'
            fill(world.base, x, y, CELL, CELL, C_WALL if solid else C_FLOOR)
            if not solid:
                fill(world.wall, x, y, CELL, CELL, 0)
            elif r > 0 and cfg.map[r - 1][c] != '#':
                fill(world.base, x, y, CELL, 1, C_EDGE)
    world.guards = tuple(compile_guard(world, g, i) for i, g in enumerate(cfg.guards))
    for g in world.guards:
        world.period = math.lcm(world.period, g.period)
        if world.period > 1_000_000:
            raise ValueError("Joint patrol cycle exceeds one million ticks")
    return world


def guard_at(guard: Guard, tick: int) -> Pose:
    return guard.poses[(tick + guard.phase) % guard.period]


def clear_ray(world: World, x0: int, y0: int, x1: int, y1: int) -> bool:
    """Integer supercover line: both neighbouring pixels at a corner must be open."""
    x, y, ix, iy = x0, y0, 0, 0
    nx, ny, sx, sy = abs(x1 - x0), abs(y1 - y0), _sign(x1 - x0), _sign(y1 - y0)
    while ix < nx or iy < ny:
        d = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx
        if d == 0:
            if (nx and world.wall[y * FRAME + x + sx]) or (ny and world.wall[(y + sy) * FRAME + x]):
                return False
            x += sx
            y += sy
            ix += 1
            iy += 1
        elif d < 0:
            x += sx
            ix += 1
        else:
            y += sy
            iy += 1
        if x < 0 or x >= FRAME or y < 0 or y >= 60 or world.wall[y * FRAME + x]:
            return False
    return True


def guard_light(world: World, guard: Guard, pose: Pose) -> tuple[int, ...]:
    direction = 0 if pose.dx == 1 else 1 if pose.dy == 1 else 2 if pose.dx == -1 else 3
    key = (pose.y * FRAME + pose.x) * 4 + direction
    cached = guard.light_cache.get(key)
    if cached is not None:
        return cached
    cx, cy, radius = pose.x + 2, pose.y + 2, guard.range
    pixels = []
    for y in range(max(world.oy, cy - radius), min(world.oy + world.rows * CELL, cy + radius + 1)):
        for x in range(max(world.ox, cx - radius), min(world.ox + world.cols * CELL, cx + radius + 1)):
            if world.wall[y * FRAME + x]:
                continue
            vx, vy = x - cx, y - cy
            forward = vx * pose.dx + vy * pose.dy
            side = vx * pose.dy - vy * pose.dx
            if forward <= 0 or abs(side) > forward * TAN_HALF + 1e-10 or vx * vx + vy * vy > radius * radius:
                continue
            if clear_ray(world, cx, cy, x, y):
                pixels.append(y * FRAME + x)
    result = tuple(pixels)
    guard.light_cache[key] = result
    return result


def lighting(world: World, tick: int) -> Scene:
    phase = tick % world.period
    if phase in world.scene_cache:
        return world.scene_cache[phase]
    lit = bytearray(4096)
    poses = tuple(guard_at(g, tick) for g in world.guards)
    for guard, pose in zip(world.guards, poses):
        for idx in guard_light(world, guard, pose):
            lit[idx] = 1
    result = Scene(bytes(lit), poses)
    if len(world.scene_cache) >= 1024:
        del world.scene_cache[next(iter(world.scene_cache))]
    world.scene_cache[phase] = result
    return result


def detection(world: World, x: int, y: int, tick: int) -> str | None:
    scene = lighting(world, tick)
    for yy in range(y, y + CELL):
        for xx in range(x, x + CELL):
            if 0 <= xx < FRAME and 0 <= yy < 60 and scene.lit[yy * FRAME + xx]:
                return "light"
    for g in scene.guards:
        if x < g.x + 4 and x + 4 > g.x + 1 and y < g.y + 4 and y + 4 > g.y + 1:
            return "contact"
    return None


def bfs(world: World, source: Point, target: Point) -> list[Point] | None:
    """Shortest cell path, excluding source. Walls only; no guard or light planner."""
    if not walkable(world, *source) or not walkable(world, *target):
        return None
    if source == target:
        return []
    start, end = source[1] * world.cols + source[0], target[1] * world.cols + target[0]
    prev = [-2] * (world.cols * world.rows)
    prev[start] = -1
    queue = deque([start])
    while queue:
        idx = queue.popleft()
        c, r = idx % world.cols, idx // world.cols
        for dx, dy in DIRS:
            nc, nr = c + dx, r + dy
            if not walkable(world, nc, nr):
                continue
            nxt = nr * world.cols + nc
            if prev[nxt] != -2:
                continue
            prev[nxt] = idx
            if nxt == end:
                path = []
                k = end
                while k != start:
                    path.append((k % world.cols, k // world.cols))
                    k = prev[k]
                path.reverse()
                return path
            queue.append(nxt)
    return None


def render(world: World, x: int, y: int, tick: int,
           completed: list[bool] | tuple[bool, ...] = (), *,
           wait_remaining: int | None = None, border: int | None = None,
           red: bool = False) -> Raster:
    frame = world.base.copy()
    scene = lighting(world, tick)
    for idx, lit in enumerate(scene.lit):
        if lit and not world.wall[idx]:
            frame[idx] = C_LIGHT
    for j in range(CELL):
        fill(frame, world.exit[0] + j, world.exit[1], 1, CELL, C_BLACK if j % 2 else C_WHITE)
    for g, cfg in zip(scene.guards, world.guards):
        fill(frame, g.x + 1, g.y + 1, 3, 3, cfg.colour)
        cx, cy = g.x + 2, g.y + 2
        fill(frame, cx + g.dx, cy + g.dy, 1, 1, C_TORCH)
        fill(frame, cx - g.dx, cy - g.dy, 1, 1, C_BACK)
    for j in range(CELL):
        fill(frame, x, y + j, CELL, 1, C_BLACK if j % 2 else C_WHITE)
    fill(frame, 0, 60, FRAME, 4, C_WALL)
    for i in range(LEVEL_COUNT):
        fill(frame, 3 + i * 5, 62, 4, 1, C_GREEN if i < len(completed) and completed[i] else C_EDGE)
    if wait_remaining is not None:
        for i in range(WAIT_TICKS):
            fill(frame, 41 + i, 62, 1, 1, C_LIGHT if i < wait_remaining else C_EDGE)
    if border is not None:
        outline(frame, 0, 0, FRAME, FRAME, border)
    if red:
        frame[:] = bytes([C_RED]) * 4096
    return [list(frame[y * FRAME:(y + 1) * FRAME]) for y in range(FRAME)]


@dataclass
class LevelState:
    cfg: LevelConfig
    level_index: int
    world: World
    x: int
    y: int
    tick: int = 0


class EvasionEngine:
    """CustomGameInfo-compatible engine. Six JSON levels are required on disk.

    info.levels may select a campaign prefix (1..6); the normal EVAS entry is 6.
    jump_to_level() is an author-only isolated preview, never an agent action.
    """
    def __init__(self, info: CustomGameInfo, *, levels_dir: str | Path | None = None) -> None:
        self.info = info
        self.levels_dir = Path(levels_dir).resolve() if levels_dir is not None else LEVELS_DIR
        self._templates = _load_all_levels(self.levels_dir)
        self.win_levels = _integer(info.levels, "info.levels", 1, LEVEL_COUNT)
        self._fps = _integer(info.default_fps, "info.default_fps", 1, 240)
        self._worlds = tuple(build_world(cfg) for cfg in self._templates)
        self._completed = [False] * LEVEL_COUNT
        self.step_index = 0
        self.last_action = "RESET"
        self.total_ticks = 0
        self.attempts = 0
        self.state = "NOT_FINISHED"
        self.test_mode = False
        self._last: dict[str, Any] = {"event": "ready"}
        self._destination: Point | None = None
        self._pending_frames: list[Raster] | None = None
        self._pending_timeline: list[dict[str, Any]] = []
        self._pending_extra: dict[str, Any] = {}
        self._event = "ready"
        self._setup(0)

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    def _setup(self, index: int) -> None:
        w = self._worlds[index]
        self._level = LevelState(self._templates[index], index, w, *w.start)
        self.state = "NOT_FINISHED"
        self._destination = None

    def _response(self, event: str, frames: list[Raster] | None = None,
                  timeline: list[dict[str, Any]] | None = None,
                  **extra: Any) -> dict[str, Any]:
        self._last = {"event": event, **copy.deepcopy(extra)}
        self._event = event
        self._pending_frames = frames
        self._pending_timeline = timeline or []
        self._pending_extra = extra
        return self.public_state()

    def _perform(self, path: list[Point], wait: bool) -> dict[str, Any]:
        frames: list[Raster] = []
        timeline: list[dict[str, Any]] = []
        lv = self._level
        played, origin, started = lv.level_index + 1, [lv.x, lv.y], lv.tick
        planned = WAIT_TICKS if wait else len(path) * CELL
        elapsed = 0

        def add(kind: str, **options: Any) -> None:
            current = self._level  # May have changed after reset or level completion.
            frames.append(render(current.world, current.x, current.y, current.tick,
                                 self._completed, **options))
            timeline.append({"tick": current.tick, "level": current.level_index + 1,
                             "kind": kind, "elapsed": elapsed, "planned": planned,
                             "remaining": max(0, planned - elapsed)})

        add("waiting" if wait else "moving", **({"wait_remaining": WAIT_TICKS} if wait else {}))
        ticks: list[Point] = []
        if wait:
            ticks = [(lv.x, lv.y)] * WAIT_TICKS
        else:
            px, py = lv.x, lv.y
            for c, r in path:
                tx, ty = cell_pixel(lv.world, c, r)
                dx, dy = _sign(tx - px), _sign(ty - py)
                for _ in range(CELL):
                    px += dx
                    py += dy
                    ticks.append((px, py))
        for nx, ny in ticks:
            lv.x, lv.y = nx, ny
            lv.tick += 1
            self.total_ticks += 1
            elapsed += 1
            caught = detection(lv.world, lv.x, lv.y, lv.tick)
            add("caught" if caught else "waiting" if wait else "moving",
                **({"wait_remaining": WAIT_TICKS - elapsed} if wait else {}))
            if caught:
                detected_at, detected_position = lv.tick, {"x": lv.x, "y": lv.y}
                for _ in range(4):
                    add("caught")
                for _ in range(5):
                    add("failure", red=True)
                self.attempts += 1
                self._setup(lv.level_index)
                add("reset")
                return self._response("failure", frames, timeline, reason=caught,
                                      played_level=played, detected_tick=detected_at,
                                      detected_position=detected_position,
                                      executed_ticks=elapsed, planned_ticks=planned)
            # Detection wins a tie with the exit, including an illuminated black stripe.
            if (lv.x, lv.y) == lv.world.exit:
                self._completed[lv.level_index] = True
                for _ in range(6):
                    add("success", border=C_GREEN)
                add("success")
                if self.test_mode or lv.level_index == self.win_levels - 1:
                    self.state = "WIN"
                else:
                    self._setup(lv.level_index + 1)
                add("win" if self.state == "WIN" else "ready")
                return self._response("win" if self.state == "WIN" else "success",
                                      frames, timeline, played_level=played,
                                      executed_ticks=elapsed, planned_ticks=planned)
        if wait:
            add("idle")
        return self._response("wait" if wait else "move", frames, timeline,
                              played_level=played, executed_ticks=elapsed,
                              planned_ticks=planned, start_tick=started, **{"from": origin})

    def reset(self) -> dict[str, Any]:
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = False
        self.attempts = self.step_index = self.total_ticks = 0
        self.last_action = "RESET"
        self._setup(0)
        return self._response("reset")

    def level_reset(self) -> dict[str, Any]:
        index = self._level.level_index
        if self.state == "WIN":
            self._completed[index] = False
        self.last_action = "ACTION7"
        self._setup(index)
        return self._response("restart")

    def action(self, action_id: int | str | dict[str, Any],
               data: dict[str, Any] | None = None) -> dict[str, Any]:
        if isinstance(action_id, dict):
            data = action_id.get("data") or {}
            packet = action_id
            action_id = packet.get("id") if packet.get("id") is not None else packet.get("action")
        if (type(action_id) is int and action_id == 0) or action_id == "RESET":
            return self.reset()
        if (type(action_id) is int and action_id == ACTION_RESET) or action_id == "ACTION7":
            return self.level_reset()
        if self.state == "WIN":
            return self._response("finished")
        if (type(action_id) is int and action_id == ACTION_SPACE) or action_id in ("ACTION5", "wait"):
            self.last_action = "ACTION5"
            self.step_index += 1
            self._destination = None
            return self._perform([], True)
        if not ((type(action_id) is int and action_id == ACTION_CLICK) or action_id in ("ACTION6", "click")):
            return self._response("ignored", reason="unknown_action")
        if (not isinstance(data, Mapping) or type(data.get("x")) is not int
                or type(data.get("y")) is not int or not 0 <= data["x"] < FRAME
                or not 0 <= data["y"] < FRAME):
            return self._response("ignored", reason="invalid_coordinates")
        lv = self._level
        target, source = cell_at(lv.world, data["x"], data["y"]), cell_at(lv.world, lv.x, lv.y)
        path = bfs(lv.world, source, target)
        if path is None:
            return self._response("blocked", reason="unreachable")
        if not path:
            return self._response("idle")
        self.last_action = "ACTION6"
        self.step_index += 1
        self._destination = target
        return self._perform(path, False)

    def step(self, action: int | str | dict[str, Any], data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Optional web-style alias; accepts {id, data} or {action, data}."""
        if isinstance(action, dict):
            data = action.get("data") or {}
            action = action.get("id") if action.get("id") is not None else action.get("action")
        return self.action(action, data)

    def public_state(self) -> dict[str, Any]:
        """Return the queued animation once. Later reads do not tick or replay it."""
        lv = self._level
        frames = self._pending_frames or [render(lv.world, lv.x, lv.y, lv.tick, self._completed)]
        timeline, extra = self._pending_timeline, self._pending_extra
        self._pending_frames = None
        self._pending_timeline = []
        self._pending_extra = {}
        available = ["ACTION7"] if self.state == "WIN" else ["ACTION5", "ACTION6", "ACTION7"]
        return {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "custom_family": self.info.family, "wave": WAVE,
            "frame": frames[-1], "frames": frames, "frame_count": len(frames),
            "timeline": timeline, "default_fps": max(self._fps, ANIM_FPS) if len(frames) > 1 else self._fps,
            "state": self.state, "level": lv.level_index + 1,
            "levels_completed": self.levels_completed, "score": self.levels_completed,
            "win_levels": 1 if self.test_mode else self.win_levels,
            "win_score": 1 if self.test_mode else self.win_levels, "test_mode": self.test_mode,
            "step_index": self.step_index, "last_action": self.last_action,
            "tick": lv.tick, "total_ticks": self.total_ticks, "attempts": self.attempts,
            "available_actions": available, "available_action_ids": [int(a[6:]) for a in available],
            "full_reset": False, "source_path": str(self.levels_dir),
            "level_name": lv.cfg.title, "event": self._event, **extra,
        }

    def observe(self) -> dict[str, Any]:
        return self.public_state()

    def view(self) -> dict[str, Any]:
        """Human-view metadata only: no future guard routes or precomputed solution."""
        lv, w = self._level, self._level.world
        return {"level": lv.level_index + 1, "title": lv.cfg.title, "note": lv.cfg.note,
                "cols": w.cols, "rows": w.rows, "cell": CELL, "ox": w.ox, "oy": w.oy,
                "guardCount": len(w.guards), "player": {"x": lv.x, "y": lv.y},
                "exit": {"x": w.exit[0], "y": w.exit[1]}, "tick": lv.tick,
                "totalTicks": self.total_ticks, "actions": self.step_index, "deaths": self.attempts,
                "completed": self._completed.copy(), "state": self.state,
                "testMode": self.test_mode, "last": copy.deepcopy(self._last),
                "destination": list(self._destination) if self._destination is not None else None}

    def metadata(self) -> list[dict[str, Any]]:
        return [{"number": i + 1, "title": c.title, "guards": len(c.guards), "note": c.note}
                for i, c in enumerate(self._templates)]

    def jump_to_level(self, number: int) -> dict[str, Any]:
        """Author-only isolated preview: no credit for earlier levels. Not an action."""
        number = _integer(number, "number", 1, LEVEL_COUNT)
        self.test_mode = True
        self._completed = [False] * LEVEL_COUNT
        self.attempts = self.step_index = self.total_ticks = 0
        self.last_action = "PREVIEW"
        self._setup(number - 1)
        return self._response("preview")

    levelReset = level_reset
    jumpToLevel = jump_to_level


__all__ = ["EvasionEngine", "LEVELS_DIR", "GAME_ID", "FAMILY", "WAVE", "PALETTE",
           "FRAME", "CELL", "WAIT_TICKS", "ANIM_FPS"]
