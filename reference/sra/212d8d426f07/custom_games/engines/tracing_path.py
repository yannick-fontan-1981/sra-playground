"""TRCP — Tracing Path web v2, Python port for the ARC-3 custom_3 backend.

ACTION6 excavates exactly one tile at native (x, y) coordinates. ACTION7 resets
this level; reset()/0/"RESET" restart the campaign. ACTION1–5 have no effect.
Every newly opened soft-rock tile costs one excavation, including every tile
of a human drag. Hard rock is permanent. Tunnels cannot be filled back in.

Pigments flood all four-connected open cells without gravity. Mixing uses the
DISTINCT ORIGINAL source colours, not the current mixed colours or their order.
The six difficult web-v2 JSON maps and their budgets are loaded unchanged.

Python 3.10+, standard library only. No JS, browser, RNG, network or route solver
at runtime. See README for installation and frame_durations_ms playback.
"""
from __future__ import annotations

import copy
import json
import math
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

FRAME = SIZE = 64
LEVEL_COUNT = 6
GAME_ID = "trcp-c3000001"
FAMILY = "tracing_path"
WAVE = "custom_3"
WEB_VERSION = "2.0"
ANIM_FPS = 16
ACTION_CLICK, ACTION_RESET = 6, 7
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / FAMILY / "levels"
PALETTE = (
    "#F3F2EB", "#C8D7D5", "#8A949B", "#546169", "#29343A", "#000000",
    "#C84C9E", "#E7A9BA", "#EC7066", "#68ACEB", "#76DBD8", "#EFCA72",
    "#E8A364", "#8B5B41", "#88CEA3", "#BC9BEA",
)
NAMES = ("blanc", "gris clair", "gris moyen", "gris", "gris foncé", "noir",
         "magenta", "rose", "rouge", "bleu", "cyan", "jaune", "orange",
         "marron", "vert", "violet")
# Puzzle conventions; this is not an official ARC colour-mixing standard.
RECIPES = (
    (8, 11, 12), (8, 9, 15), (9, 11, 14), (9, 14, 10), (8, 15, 6), (0, 8, 7),
    (0, 5, 2), (0, 2, 1), (2, 5, 3), (3, 5, 4), (0, 6, 7), (9, 10, 10),
    (11, 12, 12), (6, 9, 15),
)
_table = [[a if a == b else 13 for b in range(16)] for a in range(16)]
for _a, _b, _c in RECIPES:
    _table[_a][_b] = _table[_b][_a] = _c
MIX = tuple(tuple(row) for row in _table)
del _table, _a, _b, _c
DIRS = ((1, 0), (0, 1), (-1, 0), (0, -1))
Raster = list[list[int]]
Level = dict[str, Any]


def _is_integer(value: Any) -> bool:
    """Like JS Number.isInteger on JSON numbers, excluding Python booleans."""
    return (type(value) is int or
            (type(value) is float and math.isfinite(value) and value.is_integer()))


def _integer(value: Any, name: str, lo: int, hi: int) -> int:
    if not _is_integer(value) or not lo <= value <= hi:
        raise ValueError(f"{name}: expected an integer in {lo}..{hi}, got {value!r}")
    return int(value)


def mix_colors(colors: Iterable[int]) -> int | None:
    """None means no pigment. A genuine black source has colour 5, not None."""
    values = [_integer(c, "palette index", 0, 15) for c in colors]
    pigments = sorted(set(values))
    if not pigments:
        return None
    if len(pigments) == 1:
        return pigments[0]
    if len(pigments) == 2:
        return MIX[pigments[0]][pigments[1]]
    return 13


def geometry(level: Mapping[str, Any]) -> dict[str, int]:
    p, w, h = level["cell_px"], len(level["grid"][0]), len(level["grid"])
    return {"p": p, "w": w, "h": h, "x": (64 - w * p) // 2,
            "y": 7 + (53 - h * p) // 2}


def neighbors(x: int, y: int, w: int, h: int) -> list[list[int]]:
    """The web engine's deterministic right/down/left/up BFS ordering."""
    return [[x + dx, y + dy] for dx, dy in DIRS
            if 0 <= x + dx < w and 0 <= y + dy < h]


def equilibrium(level: Mapping[str, Any], dug: Iterable[int]) -> dict[str, Any]:
    """Compute the actual tunnel components; never search for player actions.

    Components are visited in row-major order, cells within them in BFS order,
    matching web v2. Source provenance is retained even when colours mix.
    """
    g = geometry(level)
    width, height, grid = g["w"], g["h"], level["grid"]
    dug_set = set(dug)
    opened = {y * width + x for y, row in enumerate(grid)
              for x, tile in enumerate(row) if tile == "_"} | dug_set
    field: list[list[int | None]] = [[None] * width for _ in range(height)]
    seen: set[int] = set()
    components = []
    for y in range(height):
        for x in range(width):
            idx = y * width + x
            if idx not in opened or idx in seen:
                continue
            queue = [[x, y]]
            seen.add(idx)
            cursor = 0
            while cursor < len(queue):
                a, b = queue[cursor]
                cursor += 1
                for nx, ny in neighbors(a, b, width, height):
                    nid = ny * width + nx
                    if nid in opened and nid not in seen:
                        seen.add(nid)
                        queue.append([nx, ny])
            cell_ids = {b * width + a for a, b in queue}
            sources = [s for s in level["sources"] if s["y"] * width + s["x"] in cell_ids]
            pigments = sorted({s["color"] for s in sources})
            color = mix_colors(pigments)
            for a, b in queue:
                field[b][a] = color
            components.append({"cells": queue, "color": color, "pigments": pigments,
                               "source_count": len(sources)})
    readings = []
    for index, pocket in enumerate(level["pockets"]):
        colors = {field[y][x] for x, y in pocket["cells"]}
        actual = next(iter(colors)) if len(colors) == 1 else None
        readings.append({"index": index, "target": pocket["color"], "actual": actual,
                         "filled": actual is not None,
                         "match": actual is not None and actual == pocket["color"]})
    return {"field": field, "components": components, "readings": readings}


def validate(raw: list[Level]) -> list[Level]:
    """Copy and check the six-map schema. Malformed data never fail silently."""
    if not isinstance(raw, list) or len(raw) != LEVEL_COUNT:
        raise ValueError("Exactly six level objects are required")
    levels = copy.deepcopy(raw)
    for li, level in enumerate(levels):
        name = f"L{li + 1:02d}"
        if not isinstance(level, dict):
            raise ValueError(f"{name}: expected an object")
        grid = level.get("grid")
        if (not isinstance(grid, list) or len(grid) < 3 or not isinstance(grid[0], str)
                or not grid[0] or any(not isinstance(row, str) or len(row) != len(grid[0])
                                      or set(row) - set("#._") for row in grid)):
            raise ValueError(f"{name}: invalid rectangular map")
        level["cell_px"] = _integer(level.get("cell_px"), f"{name}.cell_px", 3, 6)
        g = geometry(level)
        if g["w"] * g["p"] > 60 or g["h"] * g["p"] > 53:
            raise ValueError(f"{name}: map does not fit the 64x64 raster")
        level["budget"] = _integer(level.get("budget"), f"{name}.budget", 1, 60)
        if li == 5 and level["budget"] != 60:
            raise ValueError("Level 6 has exactly 60 digs available")
        if (not isinstance(level.get("sources"), list) or not level["sources"] or
                not isinstance(level.get("pockets"), list) or not level["pockets"]):
            raise ValueError(f"{name}: sources and pockets are required")

        def position(point: Any, label: str) -> tuple[int, int]:
            if not isinstance(point, (list, tuple)) or len(point) != 2:
                raise ValueError(f"{name}.{label}: expected [x,y]")
            return (_integer(point[0], f"{name}.{label}.x", 0, g["w"] - 1),
                    _integer(point[1], f"{name}.{label}.y", 0, g["h"] - 1))

        used: set[int] = set()
        for s in level["sources"]:
            if not isinstance(s, dict):
                raise ValueError(f"{name}: invalid source")
            x, y = position([s.get("x"), s.get("y")], "source")
            color = _integer(s.get("color"), f"{name}.source.color", 0, 15)
            idx = y * g["w"] + x
            if grid[y][x] != "_" or idx in used:
                raise ValueError(f"{name}: source must occupy a unique open cell")
            s.update(x=x, y=y, color=color)
            used.add(idx)
        for p in level["pockets"]:
            if not isinstance(p, dict) or not isinstance(p.get("cells"), list) or not p["cells"]:
                raise ValueError(f"{name}: invalid pocket")
            p["color"] = _integer(p.get("color"), f"{name}.pocket.color", 0, 15)
            ids: set[int] = set()
            cells = []
            for point in p["cells"]:
                x, y = position(point, "pocket.cell")
                idx = y * g["w"] + x
                if grid[y][x] != "_" or idx in used:
                    raise ValueError(f"{name}: pocket cells must be unique and open")
                used.add(idx)
                ids.add(idx)
                cells.append([x, y])
            mx, my = position(p.get("marker"), "pocket.marker")
            if my * g["w"] + mx not in ids:
                raise ValueError(f"{name}: pocket marker outside pocket")
            p["cells"], p["marker"] = cells, [mx, my]
            seen = {cells[0][1] * g["w"] + cells[0][0]}
            queue = [cells[0]]
            cursor = 0
            while cursor < len(queue):
                x, y = queue[cursor]
                cursor += 1
                for nx, ny in neighbors(x, y, g["w"], g["h"]):
                    idx = ny * g["w"] + nx
                    if idx in ids and idx not in seen:
                        seen.add(idx)
                        queue.append([nx, ny])
            if seen != ids:
                raise ValueError(f"{name}: disconnected pocket")
        if all(p["match"] for p in equilibrium(level, set())["readings"]):
            raise ValueError(f"{name}: level is already solved")
    return levels


def _load_levels(directory: Path) -> list[Level]:
    levels = []
    for i in range(1, LEVEL_COUNT + 1):
        path = directory / f"L{i:02d}.json"
        try:
            levels.append(json.loads(path.read_text(encoding="utf-8")))
        except FileNotFoundError as exc:
            raise FileNotFoundError(f"Missing level file {path}. Install the six JSON files "
                                    "with tracing_path.py; the .py alone is not a complete game.") from exc
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ValueError(f"Invalid level file {path}: {exc}") from exc
    return validate(levels)


def _fill(buf: bytearray, x: int, y: int, w: int, h: int, color: int) -> None:
    left, right = max(0, x), min(SIZE, x + w)
    if right <= left:
        return
    line = bytes([color]) * (right - left)
    for yy in range(max(0, y), min(SIZE, y + h)):
        buf[yy * SIZE + left: yy * SIZE + right] = line


def _outline(buf: bytearray, x: int, y: int, w: int, h: int, color: int) -> None:
    _fill(buf, x, y, w, 1, color)
    _fill(buf, x, y + h - 1, w, 1, color)
    _fill(buf, x, y, 1, h, color)
    _fill(buf, x + w - 1, y, 1, h, color)


def _decode_action(action: Any, data: Any) -> tuple[int | None, Mapping[str, Any]]:
    if isinstance(action, Mapping):
        packet = action
        data = packet.get("data")
        action = packet.get("id")
        if action is None:
            action = packet.get("action")
    if isinstance(action, str):
        if action.upper() == "RESET":
            action = 0
        else:
            text = action[6:] if action[:6].upper() == "ACTION" else action
            try:
                action = float(text.strip()) if text.strip() else 0
            except ValueError:
                action = None
    aid = int(action) if _is_integer(action) else None
    return aid, data if isinstance(data, Mapping) else {}


class TracingPathEngine:
    """CustomGameInfo-compatible runtime for the six difficult web-v2 maps.

    info supplies game_id, title, family, levels and default_fps. The default
    files resolve relative to this engine, not to the process working directory.
    Optional levels_dir / level_data overrides are for author tests and mutually
    exclusive. The complete data set always has six levels; info.levels may
    request a campaign prefix of 1..6 for evaluation.
    """

    def __init__(self, info: CustomGameInfo, *, levels_dir: str | Path | None = None,
                 level_data: list[Level] | None = None) -> None:
        if levels_dir is not None and level_data is not None:
            raise ValueError("Use either levels_dir or level_data, not both")
        self.info = info
        self.levels_dir = Path(levels_dir).resolve() if levels_dir is not None else LEVELS_DIR
        self._templates = _load_levels(self.levels_dir) if level_data is None else validate(level_data)
        self.win_levels = _integer(info.levels, "info.levels", 1, LEVEL_COUNT)
        self._fps = _integer(info.default_fps, "info.default_fps", 1, 240)
        self._completed = [False] * LEVEL_COUNT
        self._index = 0
        self._dug: set[int] = set()
        self.actions_used = 0
        self.step_index = 0
        self.attempts = 0
        self.test_mode = False
        self.state = "NOT_FINISHED"
        self.last_action = "RESET"
        self._event = "reset"
        self._result: dict[str, Any] | None = None
        self._last_cell: list[int] | None = None
        self._current: dict[str, Any] = {}
        self._pending_frames: list[Raster] | None = None
        self._pending_extra: dict[str, Any] = {}
        self._setup(0)

    @property
    def _level(self) -> Level:
        return self._templates[self._index]

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    def _setup(self, index: int) -> None:
        self._index = index
        self._dug = set()
        self.actions_used = 0
        self.state = "NOT_FINISHED"
        self._result = None
        self._last_cell = None
        self._current = equilibrium(self._level, self._dug)

    def _render_frame(self, *, field: list[list[int | None]] | None = None,
                      impact: list[int] | None = None, border: int | None = None,
                      red: bool = False) -> Raster:
        level, g = self._level, geometry(self._level)
        field = self._current["field"] if field is None else field
        buf = bytearray([5]) * (SIZE * SIZE)
        for i in range(level["budget"]):
            _fill(buf, 2 + i, 2, 1, 2, 1 if i < level["budget"] - self.actions_used else 4)
        for y in range(g["h"]):
            for x in range(g["w"]):
                px, py, p = g["x"] + x * g["p"], g["y"] + y * g["p"], g["p"]
                tile = level["grid"][y][x]
                if tile == "#":
                    _fill(buf, px, py, p, p, 4)
                    _fill(buf, px + 1, py + 1, 1, 1, 3)
                    if p >= 4:
                        _fill(buf, px + p - 2, py + p - 2, 1, 1, 3)
                elif tile == "." and y * g["w"] + x not in self._dug:
                    _fill(buf, px, py, p, p, 2)
                    _fill(buf, px, py, 1, 1, 3)
                else:
                    _fill(buf, px, py, p, p, 5 if field[y][x] is None else field[y][x])
        for source in level["sources"]:
            x = g["x"] + source["x"] * g["p"] + g["p"] // 2
            y = g["y"] + source["y"] * g["p"] + g["p"] // 2
            _fill(buf, x, y, 1, 1, source["color"])
            for dx, dy in DIRS:
                _fill(buf, x + dx, y + dy, 1, 1, 0)
        for pocket in level["pockets"]:
            xs, ys = zip(*pocket["cells"])
            x = g["x"] + (min(xs) + max(xs) + 1) * g["p"] // 2
            y = g["y"] + (min(ys) + max(ys) + 1) * g["p"] // 2
            for dx in (-1, 1):
                for dy in (-1, 1):
                    _fill(buf, x + dx, y + dy, 1, 1, pocket["color"])
            if all(field[b][a] is not None and field[b][a] == pocket["color"]
                   for a, b in pocket["cells"]):
                _fill(buf, x, y, 1, 1, 0)
        if impact is not None:
            x, y = impact
            _outline(buf, g["x"] + x * g["p"], g["y"] + y * g["p"], g["p"], g["p"], 6)
        for i in range(LEVEL_COUNT):
            _fill(buf, 2 + 5 * i, 62, 4, 1, 14 if self._completed[i] else 2)
        if border is not None:
            _outline(buf, 0, 0, 64, 64, border)
        if red:
            buf[:] = bytes([8]) * (SIZE * SIZE)
        return [list(buf[y * SIZE:(y + 1) * SIZE]) for y in range(SIZE)]

    def _respond(self, event: str, frames: list[Raster] | None = None,
                 durations: list[int] | None = None, timeline: list[dict[str, Any]] | None = None,
                 events: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        self._event = event
        self._pending_frames = frames
        self._pending_extra = {"events": copy.deepcopy(events or [])}
        if frames:
            self._pending_extra.update(frame_durations_ms=list(durations or []),
                                       timeline=copy.deepcopy(timeline or []))
        if self._result is not None:
            self._pending_extra["result"] = copy.deepcopy(self._result)
        return self.public_state()

    def _excavate(self, x: int, y: int) -> dict[str, Any]:
        level, g = self._level, geometry(self._level)
        if self.state == "WIN" or not (0 <= x < g["w"] and 0 <= y < g["h"]):
            return self._respond("ignored")
        if level["grid"][y][x] == "#":
            return self._respond("hard_rock", [self._render_frame(impact=[x, y]), self._render_frame()],
                                 [110, 40], [{"level": self._index + 1, "kind": "blocked"},
                                             {"level": self._index + 1, "kind": "ready"}],
                                 [{"type": "blocked", "reason": "hard_rock", "cell": [x, y]}])
        if level["grid"][y][x] == "_" or y * g["w"] + x in self._dug:
            return self._respond("already_open")
        old = copy.deepcopy(self._current["field"])
        frames: list[Raster] = []
        durations: list[int] = []
        timeline: list[dict[str, Any]] = []
        events: list[dict[str, Any]] = [{"type": "dig", "cell": [x, y]}]

        def add(kind: str, ms: int = 36, **opts: Any) -> None:
            frames.append(self._render_frame(**opts))
            durations.append(ms)
            timeline.append({"level": self._index + 1, "kind": kind,
                             "actions_used": self.actions_used})

        self._dug.add(y * g["w"] + x)
        self.actions_used += 1
        self._last_cell = [x, y]
        self._current = equilibrium(level, self._dug)
        add("excavate", 45, field=old)
        # This is display-only propagation from the new junction, not a timed
        # fluid race. The final equilibrium is computed first, as in web v2.
        queue = [[x, y, 0]]
        seen = {y * g["w"] + x}
        cursor = 0
        while cursor < len(queue):
            a, b, distance = queue[cursor]
            cursor += 1
            for nx, ny in neighbors(a, b, g["w"], g["h"]):
                idx = ny * g["w"] + nx
                if idx not in seen and (level["grid"][ny][nx] == "_" or idx in self._dug):
                    seen.add(idx)
                    queue.append([nx, ny, distance + 1])
        changed = [(a, b, d) for a, b, d in queue if old[b][a] != self._current["field"][b][a]]
        if changed:
            max_distance = max(d for _, _, d in changed)
            stride = max(1, (max_distance + 18) // 18)
            for distance in range(0, max_distance + 1, stride):
                for a, b, d in changed:
                    if d <= distance + stride - 1:
                        old[b][a] = self._current["field"][b][a]
                add("flow", 38, field=old)
            events.append({"type": "flow", "cells": len(changed),
                           "color": self._current["field"][y][x]})
        add("settled", 60)
        for pocket in self._current["readings"]:
            if pocket["filled"]:
                events.append({"type": "pocket", **pocket})
        if all(p["match"] for p in self._current["readings"]):
            played = self._index + 1
            won = {"level": played, "success": True, "actions": self.actions_used,
                   "budget": level["budget"], "readings": copy.deepcopy(self._current["readings"])}
            self._completed[self._index] = True
            for _ in range(3):
                add("success", 350, border=14)
                add("success_pause", 220)
            if self.test_mode or self._index + 1 >= self.win_levels:
                self.state = "WIN"
            else:
                self._setup(self._index + 1)
            add("ready", 80)
            self._result = won
            events.append({"type": "success", "level": played})
            return self._respond("win" if self.state == "WIN" else "success",
                                 frames, durations, timeline, events)
        if self.actions_used >= level["budget"]:
            lost = {"level": self._index + 1, "success": False, "reason": "budget",
                    "actions": self.actions_used, "readings": copy.deepcopy(self._current["readings"])}
            add("failure", 250, red=True)
            self.attempts += 1
            self._setup(self._index)
            self._result = lost
            add("reset", 100)
            events.append({"type": "failure", "reason": "budget"})
            return self._respond("failure", frames, durations, timeline, events)
        return self._respond("dug", frames, durations, timeline, events)

    def action(self, action_id: int | str | Mapping[str, Any],
               data: dict[str, Any] | None = None) -> dict[str, Any]:
        self._result = None
        aid, payload = _decode_action(action_id, data)
        if aid == 0:
            return self.reset()
        if aid == ACTION_RESET:
            return self.level_reset()
        if aid != ACTION_CLICK or self.state == "WIN":
            return self._respond("ignored")
        # Match web v2: step_index counts submitted click commands (even no-op
        # clicks), not idle keys or resets. actions_used counts fresh digs only.
        self.step_index += 1
        self.last_action = "ACTION6"
        x, y = payload.get("x"), payload.get("y")
        if not (_is_integer(x) and _is_integer(y) and 0 <= x < 64 and 0 <= y < 64):
            return self._respond("ignored")
        g = geometry(self._level)
        return self._excavate((int(x) - g["x"]) // g["p"], (int(y) - g["y"]) // g["p"])

    def reset(self) -> dict[str, Any]:
        self._completed = [False] * LEVEL_COUNT
        self.step_index = self.attempts = 0
        self.test_mode = False
        self.last_action = "RESET"
        self._setup(0)
        return self._respond("reset")

    def level_reset(self) -> dict[str, Any]:
        self._completed[self._index] = False
        self.last_action = "ACTION7"
        self._setup(self._index)
        return self._respond("restart")

    def public_state(self) -> dict[str, Any]:
        """2D frame + full 3D animation, returned once without sleeping.

        After action() delivers an animation, a new public_state() call renders
        only the current image. Durations preserve the web's three green blinks.
        No route witness, full component membership or hint is exposed here.
        """
        frames = self._pending_frames or [self._render_frame()]
        extra = self._pending_extra
        self._pending_frames, self._pending_extra = None, {}
        ids = [7] if self.state == "WIN" else [6, 7]
        count = self.levels_completed
        return {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "custom_family": self.info.family, "family": FAMILY, "wave": WAVE,
            "version": WEB_VERSION, "state": self.state, "level": self._index + 1,
            "score": count, "levels_completed": count,
            "win_levels": 1 if self.test_mode else self.win_levels,
            "win_score": 1 if self.test_mode else self.win_levels,
            "frame": frames[-1], "frames": frames, "frame_count": len(frames),
            "frame_durations_ms": [60], "default_fps": self._fps,
            "available_actions": [f"ACTION{i}" for i in ids], "available_action_ids": ids,
            "actions_used": self.actions_used,
            "actions_remaining": self._level["budget"] - self.actions_used,
            "action_budget": self._level["budget"], "step_index": self.step_index,
            "attempts": self.attempts, "readings": copy.deepcopy(self._current["readings"]),
            "completed": self._completed[:], "event": self._event,
            "last_action": self.last_action, "full_reset": False,
            "source_path": str(self.levels_dir), "level_name": self._level.get("title", ""),
            "test_mode": self.test_mode, **extra,
        }

    def jump_to_level(self, number: int) -> dict[str, Any]:
        """Author/UI isolated preview, 1-based; never an available agent action."""
        index = _integer(number, "level", 1, LEVEL_COUNT) - 1
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = True
        self.step_index = self.attempts = 0
        self.last_action = "PREVIEW"
        self._setup(index)
        return self._respond("reset")

    def metadata(self) -> list[dict[str, Any]]:
        return [{"number": level.get("number", i + 1), "title": level.get("title", ""),
                 "budget": level["budget"], "sources": len(level["sources"]),
                 "pockets": len(level["pockets"]), "geometry": geometry(level)}
                for i, level in enumerate(self._templates)]

    def view(self) -> dict[str, Any]:
        """Optional human-viewer metadata, separate from agent observations."""
        return {**self.public_state(), "title": self._level.get("title", ""),
                "subtitle": self._level.get("subtitle", ""), "hint": self._level.get("hint", ""),
                "geometry": geometry(self._level), "sources": copy.deepcopy(self._level["sources"]),
                "pockets": copy.deepcopy(self._level["pockets"]), "test_mode": self.test_mode,
                "dug_cells": len(self._dug)}

    def inspect(self) -> dict[str, Any]:
        """Author diagnostics only; do not expose as an evaluated-agent command."""
        return {"level": self._index + 1, "dug": sorted(self._dug), "used": self.actions_used,
                "field": copy.deepcopy(self._current["field"]),
                "components": copy.deepcopy(self._current["components"]),
                "readings": copy.deepcopy(self._current["readings"]), "state": self.state}

    step = action
    observe = public_state
    levelReset = level_reset
    # Like the previous Python deliveries, these two preview names are 1-based.
    jumpToLevel = jump_to_level


mixColors = mix_colors
__all__ = ["TracingPathEngine", "GAME_ID", "FAMILY", "WAVE", "WEB_VERSION", "LEVELS_DIR",
           "FRAME", "SIZE", "LEVEL_COUNT", "ANIM_FPS", "ACTION_CLICK", "ACTION_RESET",
           "PALETTE", "NAMES", "RECIPES", "MIX", "geometry", "neighbors", "equilibrium",
           "mix_colors", "mixColors", "validate"]
