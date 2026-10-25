"""SMLP — Same Length Path, native Python port of web 1.0 (custom_3).

ACTION6 toggles a gate / complementary gate pair. ACTION5 runs the entire race.
All runners must reach the common exit on exactly the same logical tick. Paths
minimise cell count, not time: delay pads and periodic gates affect travel time
only after routing. Runners never obstruct each other. Failed runs preserve gates.

Backend interface: SameLengthPathEngine(info), action(), reset(), level_reset(),
public_state(). Python 3.10+; standard library only. Frames, timing and event order
follow the supplied JavaScript engine. No browser, randomness, network, solver or
stored winning route is used at runtime. Keep the six level JSONs in the package.
"""
from __future__ import annotations

import copy
import json
import math
from collections import deque
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

SIZE = FRAME = 64
LEVEL_COUNT = 6
GAME_ID = "smlp-c3000001"
FAMILY = "same_length_path"
WAVE = "custom_3"
WEB_VERSION = "1.0"
DEFAULT_FPS = 40
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / FAMILY / "levels"
DIRS = ((0, -1), (1, 0), (0, 1), (-1, 0))  # shortest-path ties: N, E, S, W
PALETTE = (
    "#F3F2EB", "#C8D3CE", "#38474D", "#71828A", "#18272F", "#0A141B",
    "#CC75AF", "#E8B4A1", "#ED776B", "#72ADEF", "#79D8D1", "#EDCF77",
    "#E8A467", "#815D47", "#8CCDAB", "#BAA0E8",
)
Raster = list[list[int]]
Level = dict[str, Any]


def _is_integer(value: Any) -> bool:
    """JSON integer semantics (bool excluded, integral floats accepted as in JS)."""
    return type(value) is int or (type(value) is float and math.isfinite(value) and value.is_integer())


def _integer(value: Any, name: str, low: int, high: int) -> int:
    if not _is_integer(value) or not low <= value <= high:
        raise ValueError(f"{name}: expected an integer in {low}..{high}; got {value!r}")
    return int(value)


def _round(value: float) -> int:
    """Match Math.round including negative half-integers, not ties-to-even."""
    return math.floor(value + 0.5)


def geom(level: Mapping[str, Any]) -> dict[str, int]:
    p, width, height = int(level["cell_px"]), len(level["grid"][0]), len(level["grid"])
    return {"p": p, "w": width, "h": height, "x": (64 - width * p) // 2,
            "y": 8 + (52 - height * p) // 2}


def center(level: Mapping[str, Any], point: Sequence[int]) -> list[int]:
    g = geom(level)
    return [g["x"] + point[0] * g["p"] + g["p"] // 2,
            g["y"] + point[1] * g["p"] + g["p"] // 2]


def gate_open(gate: Mapping[str, Any], values: Sequence[bool]) -> bool:
    return bool(values[int(gate["control"])]) != bool(gate["invert"])


def clock_open(clock: Mapping[str, Any], tick: int) -> bool:
    return (tick + clock["phase"]) % clock["period"] < clock["open_ticks"]


def validate(raw: list[Level]) -> list[Level]:
    """Validate and copy the six templates. Validation never alters caller data."""
    if not isinstance(raw, list) or len(raw) != LEVEL_COUNT:
        raise ValueError("Exactly six levels are required")
    levels = copy.deepcopy(raw)
    for number, level in enumerate(levels, 1):
        if not isinstance(level, dict):
            raise TypeError(f"Level {number} must be an object")
        grid = level.get("grid")
        if (not isinstance(grid, list) or len(grid) < 3 or not isinstance(grid[0], str)
                or len(grid[0]) < 1 or any(not isinstance(row, str) or len(row) != len(grid[0])
                                         or set(row) - {".", "#"} for row in grid)):
            raise ValueError(f"Level {number}: invalid rectangular map")
        level["cell_px"] = _integer(level.get("cell_px"), "cell_px", 3, 4)
        g = geom(level)
        if g["w"] * g["p"] > 60 or g["h"] * g["p"] > 52:
            raise ValueError("Map exceeds 64x64 raster")

        def floor_point(point: Any) -> bool:
            return (isinstance(point, list) and len(point) == 2 and all(_is_integer(v) for v in point)
                    and 0 <= point[0] < g["w"] and 0 <= point[1] < g["h"]
                    and grid[int(point[1])][int(point[0])] == ".")

        if not floor_point(level.get("exit")):
            raise ValueError("Invalid exit")
        level["exit"] = list(map(int, level["exit"]))
        runners = level.get("runners")
        if not isinstance(runners, list) or not 2 <= len(runners) <= 5:
            raise ValueError("Use 2..5 runners")
        starts: set[tuple[int, int]] = set()
        colors: set[int] = set()
        used = {tuple(level["exit"])}
        for runner in runners:
            if not isinstance(runner, dict) or not floor_point(runner.get("start")):
                raise ValueError("Invalid runner start")
            runner["start"] = list(map(int, runner["start"]))
            runner["color"] = _integer(runner.get("color"), "runner.color", 0, 15)
            location = tuple(runner["start"])
            if location in used or runner["color"] in colors:
                raise ValueError("Runner starts / colors must be distinct, and not on the exit")
            starts.add(location)
            used.add(location)
            colors.add(runner["color"])
        controls = level.get("controls")
        if (not isinstance(controls, list) or not 1 <= len(controls) <= 14
                or any(not isinstance(c, dict) or type(c.get("initial")) is not bool for c in controls)):
            raise ValueError("Invalid controls; boolean initial states required")
        for control in controls:
            if control.get("linked"):
                control["link_color"] = _integer(control.get("link_color"), "link_color", 0, 15)
        for kind in ("gates", "pads", "clocks", "arrows"):
            items = level.get(kind)
            if not isinstance(items, list):
                raise ValueError(f"Missing {kind} array")
            for item in items:
                if not isinstance(item, dict) or not floor_point([item.get("x"), item.get("y")]):
                    raise ValueError(f"Invalid {kind} position")
                item["x"], item["y"] = int(item["x"]), int(item["y"])
                loc = (item["x"], item["y"])
                if loc in used:
                    raise ValueError("Overlapping mechanisms / start / exit")
                used.add(loc)
                if kind == "gates":
                    item["control"] = _integer(item.get("control"), "control", 0, len(controls) - 1)
                    if type(item.get("invert")) is not bool:
                        raise ValueError("Gate invert must be boolean")
                elif kind == "pads":
                    item["wait"] = _integer(item.get("wait"), "wait", 1, 2)
                elif kind == "clocks":
                    item["period"] = _integer(item.get("period"), "period", 2, 8)
                    item["open_ticks"] = _integer(item.get("open_ticks"), "open_ticks", 1, item["period"] - 1)
                    if not _is_integer(item.get("phase")):
                        raise ValueError("Clock phase must be an integer")
                    item["phase"] = int(item["phase"])
                else:
                    item["direction"] = _integer(item.get("direction"), "direction", 0, 3)
        for i in range(len(controls)):
            gates = [gate for gate in level["gates"] if gate["control"] == i]
            if (len(gates) not in (1, 2) or len(gates) == 2 and gates[0]["invert"] == gates[1]["invert"]):
                raise ValueError("Each control needs 1 gate or 2 opposite-polarity gates")
    return levels


@dataclass
class Topology:
    """Directed distances to the exit. No timing or door-configuration search."""
    width: int
    height: int
    distance: list[int]
    neighbours: list[list[int]]

    def route(self, point: Sequence[int]) -> list[list[int]] | None:
        x, y = point
        if not (0 <= x < self.width and 0 <= y < self.height):
            return None
        node = int(y) * self.width + int(x)
        if self.distance[node] < 0:
            return None
        out = [[node % self.width, node // self.width]]
        while self.distance[node] > 0:
            node = next(n for n in self.neighbours[node] if self.distance[n] == self.distance[node] - 1)
            out.append([node % self.width, node // self.width])
        return out


def topology(level: Mapping[str, Any], values: Sequence[bool]) -> Topology:
    """Reverse BFS with N/E/S/W route reconstruction, matching the web engine."""
    width, height = len(level["grid"][0]), len(level["grid"])
    size = width * height
    free = [cell == "." for row in level["grid"] for cell in row]
    distance, arrows = [-1] * size, [-1] * size
    for gate in level["gates"]:
        if not gate_open(gate, values):
            free[gate["y"] * width + gate["x"]] = False
    for arrow in level["arrows"]:
        arrows[arrow["y"] * width + arrow["x"]] = arrow["direction"]
    neighbours: list[list[int]] = [[] for _ in range(size)]
    reverse: list[list[int]] = [[] for _ in range(size)]
    for node in range(size):
        if not free[node]:
            continue
        x, y = node % width, node // width
        for direction, (dx, dy) in enumerate(DIRS):
            xx, yy = x + dx, y + dy
            if (0 <= xx < width and 0 <= yy < height and free[yy * width + xx]
                    and arrows[node] in (-1, direction)):
                dest = yy * width + xx
                neighbours[node].append(dest)
                reverse[dest].append(node)
    exit_id = level["exit"][1] * width + level["exit"][0]
    queue = deque([exit_id])
    distance[exit_id] = 0
    while queue:
        node = queue.popleft()
        for previous in reverse[node]:
            if distance[previous] < 0:
                distance[previous] = distance[node] + 1
                queue.append(previous)
    return Topology(width, height, distance, neighbours)


def simulate(level: Mapping[str, Any], values: Sequence[bool]) -> dict[str, Any]:
    """Resolve a race at logical tick precision; do not execute player edits.

    This function is also useful to author tests. Its paths / future states are
    not added to an agent observation; action(5) only returns the actual race.
    """
    graph = topology(level, values)
    paths = [graph.route(r["start"]) for r in level["runners"]]
    pads = {(p["x"], p["y"]): p["wait"] for p in level["pads"]}
    clocks = {(c["x"], c["y"]): c for c in level["clocks"]}
    runners = [{"id": i, "color": r["color"], "x": r["start"][0], "y": r["start"][1],
                "index": 0, "cooldown": 0, "arrived": None, "blocked": paths[i] is None,
                "distance": 0, "pad_wait": 0, "clock_wait": 0, "waiting": None}
               for i, r in enumerate(level["runners"])]
    states: list[dict[str, Any]] = []
    events: list[dict[str, Any]] = []
    tick, peak, peak_group, peak_tick = 0, 0, [], None

    def snapshot(arrivals: list[int]) -> None:
        states.append({"tick": tick, "runners": [r.copy() for r in runners],
                       "arrivals": arrivals[:], "count": len(arrivals), "peak": peak,
                       "peak_group": peak_group[:], "peak_tick": peak_tick})

    snapshot([])
    max_ticks = len(level["grid"]) * len(level["grid"][0]) * 12 + 16
    while any(not r["blocked"] and r["arrived"] is None for r in runners) and tick < max_ticks:
        tick += 1
        arrivals: list[int] = []
        for runner in runners:
            runner["waiting"] = None
            if runner["arrived"] is not None or runner["blocked"]:
                continue
            if runner["cooldown"] > 0:
                runner["cooldown"] -= 1
                runner["pad_wait"] += 1
                runner["waiting"] = "pad"
                continue
            path = paths[runner["id"]]
            assert path is not None
            next_cell = path[runner["index"] + 1]
            clock = clocks.get(tuple(next_cell))
            if clock is not None and not clock_open(clock, tick):
                runner["clock_wait"] += 1
                runner["waiting"] = "clock"
                continue
            runner["index"] += 1
            runner["x"], runner["y"] = next_cell
            runner["distance"] += 1
            if next_cell == level["exit"]:
                runner["arrived"] = tick
                arrivals.append(runner["id"])
                events.append({"type": "arrival", "runner": runner["id"], "tick": tick,
                               "color": runner["color"]})
            else:
                runner["cooldown"] = pads.get(tuple(next_cell), 0)
        if len(arrivals) > peak:
            peak, peak_group, peak_tick = len(arrivals), arrivals[:], tick
        snapshot(arrivals)
    success = all(r["arrived"] is not None for r in runners) and len({r["arrived"] for r in runners}) == 1
    report = {
        "success": success, "peak": peak, "total": len(runners), "peak_tick": peak_tick,
        "peak_group": peak_group[:], "ticks": tick,
        "arrivals": [{"id": r["id"], "color": r["color"], "time": r["arrived"], "blocked": r["blocked"],
                      "distance": r["distance"], "pad_wait": r["pad_wait"], "clock_wait": r["clock_wait"]}
                     for r in runners],
        "groups": [{"tick": s["tick"], "runners": s["arrivals"][:], "count": s["count"]}
                   for s in states if s["arrivals"]],
        "reason": ("synchronized" if success else "disconnected" if any(r["blocked"] for r in runners)
                   else "timeout" if tick >= max_ticks else "desynchronized"),
    }
    return {"states": states, "events": events, "report": report, "paths": paths}


def _fill(frame: Raster, x: int, y: int, w: int, h: int, color: int) -> None:
    left, right = max(0, x), min(64, x + w)
    if left >= right:
        return
    cells = [color] * (right - left)
    for yy in range(max(0, y), min(64, y + h)):
        frame[yy][left:right] = cells


def _outline(frame: Raster, x: int, y: int, w: int, h: int, color: int) -> None:
    _fill(frame, x, y, w, 1, color)
    _fill(frame, x, y + h - 1, w, 1, color)
    _fill(frame, x, y, 1, h, color)
    _fill(frame, x + w - 1, y, 1, h, color)


def _arrow_glyph(frame: Raster, x: int, y: int, direction: int, color: int) -> None:
    dx, dy = DIRS[direction]
    for xx, yy in ((x, y), (x + dx, y + dy), (x - dy, y + dx), (x + dy, y - dx)):
        _fill(frame, xx, yy, 1, 1, color)


def draw(level: Mapping[str, Any], values: Sequence[bool], completed: Sequence[bool],
         options: Mapping[str, Any] | None = None) -> Raster:
    """Render the same 64x64 indexed raster as web 1.0, with no antialiasing."""
    o = options or {}
    frame = [[5] * SIZE for _ in range(SIZE)]
    g = geom(level)
    p = g["p"]
    for y, row in enumerate(level["grid"]):
        for x, cell in enumerate(row):
            xx, yy = g["x"] + x * p, g["y"] + y * p
            if cell == "#":
                _fill(frame, xx, yy, p, p, 4)
                if (x + y) % 3 == 0:
                    _fill(frame, xx, yy, 1, 1, 2)
            else:
                _fill(frame, xx, yy, p, p, 2)
                _fill(frame, xx + p // 2, yy + p // 2, 1, 1, 3)
    for pad in level["pads"]:
        x, y = center(level, [pad["x"], pad["y"]])
        _fill(frame, x - 1, y - 1, 3, 3, 13)
        if pad["wait"] == 2:
            _fill(frame, x - 1, y, 1, 1, 11)
            _fill(frame, x + 1, y, 1, 1, 11)
        else:
            _fill(frame, x, y, 1, 1, 11)
    for arrow in level["arrows"]:
        x, y = center(level, [arrow["x"], arrow["y"]])
        _arrow_glyph(frame, x, y, arrow["direction"], 0)

    def paint_gate(item: Mapping[str, Any], color: int, is_open: bool) -> None:
        x, y = center(level, [item["x"], item["y"]])
        horizontal = (item["x"] > 0 and item["x"] + 1 < g["w"]
                      and level["grid"][item["y"]][item["x"] - 1] == "."
                      and level["grid"][item["y"]][item["x"] + 1] == ".")
        if is_open:
            if horizontal:
                _fill(frame, x, y - 1, 1, 1, color)
                _fill(frame, x, y + 1, 1, 1, color)
            else:
                _fill(frame, x - 1, y, 1, 1, color)
                _fill(frame, x + 1, y, 1, 1, color)
        else:
            _fill(frame, x - 1, y - 1, 3, 3, color)
            if horizontal:
                _fill(frame, x, y - 1, 1, 3, 5)
            else:
                _fill(frame, x - 1, y, 3, 1, 5)
        if "control" in item and "changed" in o and o["changed"] == item["control"]:
            _fill(frame, x - 1, y - 1, 1, 1, 0)
            _fill(frame, x + 1, y + 1, 1, 1, 0)

    for gate in level["gates"]:
        control = level["controls"][gate["control"]]
        paint_gate(gate, control["link_color"] if control.get("linked") else 12, gate_open(gate, values))
    for clock in level["clocks"]:
        is_open = clock_open(clock, o.get("tick", 0) or 0)
        paint_gate(clock, 10, is_open)
        x, y = center(level, [clock["x"], clock["y"]])
        _fill(frame, x, y, 1, 1, 14 if is_open else 10)
    for runner in level["runners"]:
        x, y = center(level, runner["start"])
        _fill(frame, x, y, 1, 1, runner["color"])
    ex, ey = center(level, level["exit"])
    _outline(frame, ex - 1, ey - 1, 3, 3, 14)
    _fill(frame, ex, ey, 1, 1, 5)
    for i, trail in enumerate(o.get("trails") or []):
        for cell in trail:
            x, y = center(level, cell)
            _fill(frame, x, y, 1, 1, level["runners"][i]["color"])
    runners = o.get("runners")
    if runners is None:
        runners = [{"id": i, "color": r["color"], "x": r["start"][0], "y": r["start"][1],
                    "arrived": None} for i, r in enumerate(level["runners"])]
    groups: dict[tuple[int, int], list[dict[str, Any]]] = {}
    pixels = o.get("pixels") or {}
    for runner in runners:
        if runner.get("arrived") is not None:
            continue
        pixel = pixels.get(runner["id"], pixels.get(str(runner["id"])))
        if pixel is None:
            pixel = center(level, [runner["x"], runner["y"]])
        location = (pixel[0], pixel[1])
        groups.setdefault(location, []).append(runner)
    for (x, y), group in groups.items():
        if len(group) == 1:
            runner = group[0]
            _fill(frame, x - 1, y, 3, 1, runner["color"])
            _fill(frame, x, y - 1, 1, 3, runner["color"])
            _fill(frame, x, y, 1, 1, 11 if runner.get("waiting") else 0)
        else:
            positions = ((-1, -1), (1, -1), (-1, 1), (1, 1), (0, 0))
            _fill(frame, x - 1, y - 1, 3, 3, 0)
            for runner, (dx, dy) in zip(group, positions):
                _fill(frame, x + dx, y + dy, 1, 1, runner["color"])
    # Coincidence gauge: this tick's batch, not all arrivals accumulated so far.
    _fill(frame, 0, 0, 64, 7, 5)
    _outline(frame, 2, 1, 60, 5, 2)
    ids, n = o.get("gauge") or [], len(level["runners"])
    for i in range(n):
        x, end = 4 + i * 56 // n, 4 + (i + 1) * 56 // n
        _fill(frame, x, 2, end - x - 1, 3, level["runners"][ids[i]]["color"] if i < len(ids) else 4)
    if len(ids) == n:
        _outline(frame, 2, 1, 60, 5, 14)
    elif o.get("verdict") == "failure":
        _outline(frame, 2, 1, 60, 5, 8)
    _fill(frame, 0, 60, 64, 4, 5)
    for i in range(LEVEL_COUNT):
        _fill(frame, 2 + i * 5, 62, 4, 1, 14 if completed[i] else 2)
    if o.get("border") is not None:
        _outline(frame, 0, 0, 64, 64, o["border"])
    return frame


def _load_levels(directory: Path) -> list[Level]:
    paths = [directory / f"L{i:02d}.json" for i in range(1, LEVEL_COUNT + 1)]
    absent = [str(path) for path in paths if not path.is_file()]
    if absent:
        raise FileNotFoundError("Copy the six level JSONs alongside the engine. Missing: " + ", ".join(absent))
    return validate([json.loads(path.read_text(encoding="utf-8")) for path in paths])


def _decode_action(action: Any, data: Any) -> tuple[int | None, Mapping[str, Any]]:
    if isinstance(action, Mapping):
        payload = action.get("data")
        # Match JavaScript `action.data || action`: empty objects stay truthy.
        missing = (payload is None or payload is False
                   or (isinstance(payload, (int, float)) and not isinstance(payload, bool) and payload == 0)
                   or (isinstance(payload, str) and payload == ""))
        data = action if missing else payload
        action = action.get("id") if action.get("id") is not None else action.get("action")
    if isinstance(action, str):
        if action == "RESET":
            action = 0
        elif len(action) == 7 and action.startswith("ACTION") and action[-1] in "01234567":
            action = int(action[-1])
        else:
            action = None
    return (int(action) if _is_integer(action) else None,
            data if isinstance(data, Mapping) else {})


class SameLengthPathEngine:
    """Custom-game backend matching the supplied FITE / custom_3 interface.

    `info` supplies game_id, title, family, levels and default_fps. An actual
    CustomGameInfo works; no runtime import of the user's registry is required.
    Optional paths/data are for packaging, author tests and standalone tools.
    """
    def __init__(self, info: CustomGameInfo, *, levels_dir: str | Path | None = None,
                 level_data: list[Level] | None = None) -> None:
        if levels_dir is not None and level_data is not None:
            raise ValueError("Use levels_dir or level_data, not both")
        self.info = info
        self.levels_dir = Path(levels_dir).resolve() if levels_dir is not None else LEVELS_DIR
        self._templates = _load_levels(self.levels_dir) if level_data is None else validate(level_data)
        self.win_levels = _integer(info.levels, "info.levels", 1, LEVEL_COUNT)
        self._fps = _integer(info.default_fps, "info.default_fps", 1, 240)
        self._index = 0
        self._values: list[bool] = []
        self._completed = [False] * LEVEL_COUNT
        self.state = "NOT_FINISHED"
        self.test_mode = False
        self.step_index = 0
        self.last_action = "RESET"
        self.edits = self.attempts = 0
        self._last: dict[str, Any] | None = None
        self._event = "reset"
        self._setup(0)

    @property
    def _level(self) -> Level:
        return self._templates[self._index]

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    def _setup(self, index: int) -> None:
        self._index = index
        self._values = [c["initial"] for c in self._level["controls"]]
        self.edits = self.attempts = 0
        self._last = None
        self.state = "NOT_FINISHED"

    def _render_frame(self) -> Raster:
        won = self.state == "WIN" and self._last is not None and self._last["success"]
        options: dict[str, Any] = {"gauge": self._last["peak_group"] if self._last else [],
                                   "tick": self._last["ticks"] if won else 0}
        if self._last and not self._last["success"]:
            options["verdict"] = "failure"
        if won:
            assert self._last is not None
            options["runners"] = [{"id": i, "color": r["color"], "x": self._level["exit"][0],
                                    "y": self._level["exit"][1], "arrived": self._last["arrivals"][i]["time"]}
                                   for i, r in enumerate(self._level["runners"])]
        return draw(self._level, self._values, self._completed, options)

    def _envelope(self, frames: list[Raster] | None = None, timeline: list[dict[str, Any]] | None = None,
                  durations: list[int] | None = None, **extra: Any) -> dict[str, Any]:
        animated = bool(frames)
        frames = frames if frames else [self._render_frame()]
        ids = [7] if self.state == "WIN" else [5, 6, 7]
        result = {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title, "custom_family": self.info.family,
            "family": FAMILY, "wave": WAVE, "version": WEB_VERSION,
            "frame": frames[-1], "frames": frames, "frame_count": len(frames),
            "frame_durations_ms": durations if animated else [100], "default_fps": self._fps,
            "state": self.state, "level": self._index + 1,
            "score": self.levels_completed, "levels_completed": self.levels_completed,
            "win_levels": 1 if self.test_mode else self.win_levels,
            "win_score": 1 if self.test_mode else self.win_levels,
            "available_actions": [f"ACTION{i}" for i in ids], "available_action_ids": ids,
            "step_index": self.step_index, "attempts": self.attempts, "edits": self.edits,
            "last_result": copy.deepcopy(self._last), "event": self._event,
            "last_action": self.last_action, "full_reset": False, "source_path": str(self.levels_dir),
            "level_name": self._level.get("title", ""), "test_mode": self.test_mode,
        }
        if animated:
            if timeline is None or durations is None or not len(frames) == len(timeline) == len(durations):
                raise RuntimeError("Animation frame/timeline/duration length mismatch")
            result["timeline"] = timeline
        result.update(extra)
        return result

    def public_state(self) -> dict[str, Any]:
        """One fresh image, no simulation step and no replay of the previous race."""
        return self._envelope()

    def reset(self) -> dict[str, Any]:
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = False
        self.step_index = 0
        self.last_action, self._event = "RESET", "reset"
        self._setup(0)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self._completed[self._index] = False
        self._setup(self._index)
        self.last_action, self._event = "ACTION7", "restart"
        return self.public_state()

    def _gate_at(self, x: Any, y: Any) -> int:
        if not (_is_integer(x) and _is_integer(y) and 0 <= x < 64 and 0 <= y < 64):
            return -1
        g = geom(self._level)
        xx, yy = (int(x) - g["x"]) // g["p"], (int(y) - g["y"]) // g["p"]
        return next((i for i, gate in enumerate(self._level["gates"])
                     if gate["x"] == xx and gate["y"] == yy), -1)

    def _click(self, x: Any, y: Any) -> dict[str, Any]:
        gate = self._gate_at(x, y)
        if gate < 0:
            self._event = "ignored"
            return self.public_state()
        control = self._level["gates"][gate]["control"]
        self._values[control] = not self._values[control]
        self.edits += 1
        self._last = None
        frames = [draw(self._level, self._values, self._completed, {"changed": control}), self._render_frame()]
        timeline = [{"level": self._index + 1, "kind": "gate", "control": control},
                    {"level": self._index + 1, "kind": "ready"}]
        self._event = "gate_changed"
        return self._envelope(frames, timeline, [110, 50], changed_control=control)

    def _launch(self) -> dict[str, Any]:
        self.attempts += 1
        played, level = self._index + 1, self._level
        sim = simulate(level, self._values)
        frames: list[Raster] = []
        timeline: list[dict[str, Any]] = []
        durations: list[int] = []

        def add(options: dict[str, Any], meta: dict[str, Any], ms: int) -> None:
            frames.append(draw(level, self._values, self._completed, options))
            timeline.append({"level": played, **meta})
            durations.append(ms)

        for si, snapshot in enumerate(sim["states"]):
            previous = sim["states"][max(0, si - 1)]
            subs = 1 if si == 0 else level["cell_px"]
            for k in range(1, subs + 1):
                pixels: dict[int, list[int]] = {}
                display = [r.copy() for r in snapshot["runners"]]
                for i, runner in enumerate(snapshot["runners"]):
                    old = previous["runners"][i]
                    p0, p1 = center(level, [old["x"], old["y"]]), center(level, [runner["x"], runner["y"]])
                    pixels[i] = [v + _round((p1[j] - v) * k / subs) for j, v in enumerate(p0)]
                    if runner["arrived"] == snapshot["tick"] and k < subs:
                        display[i]["arrived"] = None
                end = k == subs
                arrival_ids = snapshot["arrivals"][:] if end else []
                add({"runners": display, "pixels": pixels, "tick": snapshot["tick"], "gauge": arrival_ids},
                    {"kind": "race", "tick": snapshot["tick"], "subframe": k, "end_tick": end,
                     "arrivals": arrival_ids, "count": snapshot["count"] if end else 0,
                     "peak": snapshot["peak"], "positions": [{key: r[key] for key in
                         ("id", "x", "y", "arrived", "waiting")} for r in display]},
                    180 if si == 0 else 25)
        self._last = copy.deepcopy(sim["report"])
        final = sim["states"][-1]
        group = self._last["peak_group"]
        add({"runners": final["runners"], "tick": final["tick"], "gauge": group,
             "verdict": "success" if self._last["success"] else "failure"},
            {"kind": "result", "tick": final["tick"], "count": self._last["peak"]}, 700)
        finished = copy.deepcopy(self._last)
        if self._last["success"]:
            self._completed[self._index] = True
            for blink in range(3):
                add({"runners": final["runners"], "tick": final["tick"], "gauge": group, "border": 14},
                    {"kind": "success_on", "tick": final["tick"], "blink": blink}, 400)
                add({"runners": final["runners"], "tick": final["tick"], "gauge": group},
                    {"kind": "success_off", "tick": final["tick"], "blink": blink}, 200)
            if self.test_mode or self._index + 1 >= self.win_levels:
                self.state = "WIN"
            else:
                self._setup(self._index + 1)
            self._event = "win" if self.state == "WIN" else "success"
        else:
            for _ in range(2):
                add({"runners": final["runners"], "tick": final["tick"], "gauge": group,
                     "verdict": "failure", "border": 8}, {"kind": "failure_on", "tick": final["tick"]}, 180)
                add({"runners": final["runners"], "tick": final["tick"], "gauge": group, "verdict": "failure"},
                    {"kind": "failure_off", "tick": final["tick"]}, 140)
            self._event = "miss"
        frames.append(self._render_frame())
        timeline.append({"level": self._index + 1, "kind": "ready", "tick": 0})
        durations.append(100)
        return self._envelope(frames, timeline, durations, result=finished, played_level=played,
                              events=sim["events"])

    def action(self, action_id: int | str | Mapping[str, Any],
               data: dict[str, Any] | None = None) -> dict[str, Any]:
        aid, payload = _decode_action(action_id, data)
        if aid is None:
            self._event = "ignored"
            return self.public_state()
        if aid == 0:
            return self.reset()
        # Match web accounting, including ignored numeric submissions and reset.
        self.step_index += 1
        self.last_action = f"ACTION{aid}"
        if aid == 7:
            return self.level_reset()
        if self.state == "WIN":
            self._event = "ignored"
            return self.public_state()
        if aid == 5:
            return self._launch()
        if aid == 6:
            return self._click(payload.get("x"), payload.get("y"))
        self._event = "ignored"
        return self.public_state()

    def jump_to_level(self, number: int, isolated: bool = True) -> dict[str, Any]:
        """Author/viewer preview only. One-based index; never an agent action."""
        index = _integer(number, "level", 1, LEVEL_COUNT) - 1
        if not isolated and index >= self.win_levels:
            raise ValueError("Preview lies outside the configured campaign prefix")
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = bool(isolated)
        self.step_index = 0
        self._setup(index)
        self.last_action, self._event = "PREVIEW", "level_selected"
        return self.public_state()

    def inspect(self) -> dict[str, Any]:
        """Copied author state only; no future routes or winning configurations."""
        return {"level": self._index + 1, "values": self._values[:], "completed": self._completed[:],
                "state": self.state, "testMode": self.test_mode, "steps": self.step_index,
                "edits": self.edits, "attempts": self.attempts, "last": copy.deepcopy(self._last)}

    def view(self) -> dict[str, Any]:
        """Human-viewer metadata; not an extra action or a pre-race time prediction."""
        level = self._level
        gates = []
        for gate in level["gates"]:
            control = level["controls"][gate["control"]]
            value = {**gate, "open": gate_open(gate, self._values), "point": center(level, [gate["x"], gate["y"]]),
                     "color": control["link_color"] if control.get("linked") else 12}
            if "linked" in control:
                value["linked"] = control["linked"]
            gates.append(value)
        result = {"level": self._index + 1, "runner_count": len(level["runners"]),
                  "runners": copy.deepcopy(level["runners"]), "gates": gates,
                  "controls": copy.deepcopy(level["controls"]), "pads": copy.deepcopy(level["pads"]),
                  "clocks": copy.deepcopy(level["clocks"]), "arrows": copy.deepcopy(level["arrows"]),
                  "completed": self._completed[:], "state": self.state, "edits": self.edits,
                  "attempts": self.attempts, "test_mode": self.test_mode, "last_result": copy.deepcopy(self._last)}
        for key in ("title", "subtitle", "lesson", "hint"):
            if key in level:
                result[key] = level[key]
        return result

    def metadata(self) -> list[dict[str, Any]]:
        return [{"number": l["number"], "title": l["title"], **{name: len(l[name]) for name in
                 ("runners", "gates", "controls", "pads", "clocks", "arrows")}} for l in self._templates]

    # Familiar aliases for standalone tooling, not additional native commands.
    observe = public_state
    step = action
    levelReset = level_reset
    jumpToLevel = jump_to_level


__all__ = ["SameLengthPathEngine", "SIZE", "FRAME", "LEVELS_DIR", "GAME_ID", "FAMILY", "WAVE", "WEB_VERSION",
           "PALETTE", "DIRS", "DEFAULT_FPS", "validate", "geom", "center", "gate_open", "clock_open",
           "topology", "simulate", "draw"]
