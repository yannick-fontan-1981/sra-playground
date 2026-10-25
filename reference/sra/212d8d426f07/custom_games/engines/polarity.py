"""POLARITY: a faithful Python port of the approved ARC3 web puzzle.

The core is deterministic, uses only Python's standard library, and never runs
JavaScript. The pure functions mirror tests/reference/engine.js. This is puzzle
magnetism, not a physical-material simulation. See PHYSICS.md for tie-breaking.

ARC actions: 3 = quarter-turn left; 4 = quarter-turn right; 5 = next magnet;
6 = click in the 64x64 frame; 7 = restart level. Actions 1/2 do not move magnets.
"""
from __future__ import annotations

import json
import math
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Protocol, Sequence

FRAME = 64
EPS = 1e-10
DIRS = ({"r": -1, "c": 0}, {"r": 0, "c": 1},
        {"r": 1, "c": 0}, {"r": 0, "c": -1})
DIR_NAMES = ("up", "right", "down", "left")
PALETTE = ("#FFFFFF", "#CCCCCC", "#999999", "#666666", "#333333", "#000000",
           "#E53AA3", "#FF7BCC", "#F93C31", "#1E93FF", "#88D8F1", "#FFDC00",
           "#FF851B", "#921231", "#4FCC30", "#A356D6")
CONTROLS = {"left": {"x": 6, "y": 54, "w": 12, "h": 8},
            "next": {"x": 26, "y": 54, "w": 12, "h": 8},
            "right": {"x": 46, "y": 54, "w": 12, "h": 8}}
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "polarity" / "levels"
Level = dict[str, Any]
State = dict[str, Any]


def _is_int(value: Any) -> bool:
    """Match Number.isInteger for JSON values, without accepting booleans."""
    return (not isinstance(value, bool) and isinstance(value, (int, float))
            and math.isfinite(value) and int(value) == value)


def _positive_int(value: Any, name: str, *, zero: bool = False) -> int:
    if not _is_int(value) or value < (0 if zero else 1):
        raise ValueError(f"{name} must be {'nonnegative' if zero else 'positive'} integer.")
    return int(value)


def _text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if value is True:
        return "true"
    if value is False:
        return "false"
    if value is None:
        return "null"
    return str(value)


def validate_level(raw: Any) -> Level:
    """Validate a web-editor level and return an independent normalized copy."""
    if not isinstance(raw, Mapping):
        raise ValueError("A level must be an object.")
    rows = raw.get("rows")
    if not isinstance(rows, list) or not 3 <= len(rows) <= 9:
        raise ValueError("Use 3–9 rows.")
    w = len(rows[0]) if isinstance(rows[0], str) else 0
    h = len(rows)
    if not 3 <= w <= 11 or any(not isinstance(row, str) or len(row) != w
                                or set(row) - {".", "#"} for row in rows):
        raise ValueError("Rows must be equal-width strings of . (floor) and # (wall), 3–11 columns wide.")
    magnets = raw.get("magnets")
    if not isinstance(magnets, list) or not 1 <= len(magnets) <= 8:
        raise ValueError("Use 1–8 magnets.")

    def valid_cell(r: Any, c: Any) -> bool:
        return (_is_int(r) and _is_int(c) and 0 <= r < h and 0 <= c < w
                and rows[int(r)][int(c)] == ".")

    ids: set[str] = set()
    occupied: set[tuple[int, int]] = set()
    out: list[dict[str, Any]] = []
    for i, m in enumerate(magnets):
        if not isinstance(m, Mapping) or not valid_cell(m.get("r"), m.get("c")):
            raise ValueError(f"Magnet {i + 1} must occupy a floor cell.")
        mid = m.get("id", chr(65 + i))
        if not isinstance(mid, str) or not 1 <= len(mid) <= 24 or mid in ids:
            raise ValueError("Magnet IDs must be unique strings (1–24 characters).")
        d = m.get("dir")
        if not _is_int(d) or not 0 <= d <= 3:
            raise ValueError("dir must be 0, 1, 2 or 3 (red pole: up, right, down, left).")
        cell = int(m["r"]), int(m["c"])
        if cell in occupied:
            raise ValueError("Two magnets cannot occupy the same cell.")
        ids.add(mid)
        occupied.add(cell)
        out.append({"id": mid, "r": cell[0], "c": cell[1], "dir": int(d)})
    goal = raw.get("goal")
    if not isinstance(goal, Mapping) or not valid_cell(goal.get("r"), goal.get("c")):
        raise ValueError("The goal must occupy a floor cell.")
    return {"version": 1, "id": _text(raw.get("id") or "custom")[:48],
            "name": _text(raw.get("name") or "Untitled experiment")[:100],
            "description": _text(raw.get("description") or "")[:600],
            "concept": _text(raw.get("concept") or "Custom")[:100],
            "rows": rows[:], "magnets": out,
            "goal": {"r": int(goal["r"]), "c": int(goal["c"])}}


def initial_state(level: Mapping[str, Any]) -> State:
    return {"magnets": deepcopy(level["magnets"]), "selected": None, "turns": 0}


def _copy_state(state: Mapping[str, Any]) -> State:
    # Known scalar metadata plus independent magnet dictionaries.
    return {**state, "magnets": [m.copy() for m in state["magnets"]]}


def state_key(state: Mapping[str, Any]) -> str:
    return "|".join(f"{m['r']},{m['c']},{m['dir']}" for m in state["magnets"])


def is_goal(level: Mapping[str, Any], state: Mapping[str, Any]) -> bool:
    """Position predicate only. A win ALSO requires a stable magnetic field."""
    return any(m["r"] == level["goal"]["r"] and m["c"] == level["goal"]["c"]
               for m in state["magnets"])


def cell_free(level: Mapping[str, Any], r: int, c: int) -> bool:
    return (0 <= r < len(level["rows"]) and 0 <= c < len(level["rows"][0])
            and level["rows"][r][c] == ".")


def pair_info(a: Mapping[str, Any], b: Mapping[str, Any]) -> dict[str, Any] | None:
    axis = None
    if a["r"] == b["r"] and a["c"] != b["c"] and a["dir"] % 2 == b["dir"] % 2 == 1:
        axis = "c"
    if a["c"] == b["c"] and a["r"] != b["r"] and a["dir"] % 2 == b["dir"] % 2 == 0:
        axis = "r"
    if axis is None:
        return None
    difference = b[axis] - a[axis]
    attraction = a["dir"] == b["dir"]
    return {"axis": axis, "sign": 1 if difference > 0 else -1,
            "distance": abs(difference), "attraction": attraction,
            "coefficient": -1 if attraction else 1}


def interactions(state: Mapping[str, Any]) -> list[dict[str, Any]]:
    out = []
    ms = state["magnets"]
    for i in range(len(ms)):
        for j in range(i + 1, len(ms)):
            p = pair_info(ms[i], ms[j])
            if p is not None:
                out.append({"i": i, "j": j, "a": ms[i]["id"], "b": ms[j]["id"], **p})
    return out


def forces(state: Mapping[str, Any]) -> list[dict[str, float]]:
    out = [{"r": 0.0, "c": 0.0} for _ in state["magnets"]]
    for p in interactions(state):
        f = (1 if p["attraction"] else -1) * p["sign"] / (p["distance"] * p["distance"])
        out[p["i"]][p["axis"]] += f
        out[p["j"]][p["axis"]] -= f
    return out


def energy(state: Mapping[str, Any]) -> float:
    total = 0.0
    # Explicit ordered additions preserve the JavaScript floating-point order.
    # Do NOT substitute Python's compensated sum or change pair iteration order.
    for p in interactions(state):
        total += p["coefficient"] / p["distance"]
    return total


def tick(level: Mapping[str, Any], state: State) -> dict[str, Any]:
    """One collision-safe simultaneous movement tick; input is never mutated."""
    fs = forces(state)
    magnets = state["magnets"]
    n = len(magnets)
    candidates = []
    for i, m in enumerate(magnets):
        axis = "c" if m["dir"] % 2 else "r"
        f = fs[i][axis]
        if abs(f) <= EPS:
            continue
        direction = 1 if f > 0 else -1
        r = m["r"] + (direction if axis == "r" else 0)
        c = m["c"] + (direction if axis == "c" else 0)
        if cell_free(level, r, c):
            candidates.append((i, r, c))
    if not candidates:
        return {"state": state, "moved": [], "forces": fs}
    before = energy(state)
    best = None
    best_count = 0
    best_energy = math.inf
    best_tie = math.inf
    best_moved: list[str] = []
    full = (1 << len(candidates)) - 1
    for mask in range(full, 0, -1):
        count = mask.bit_count()
        if count < best_count:
            continue
        ms = [m.copy() for m in magnets]
        moved = []
        for k, (i, r, c) in enumerate(candidates):
            if mask & (1 << k):
                ms[i]["r"], ms[i]["c"] = r, c
                moved.append(i)
        occupied = set()
        ok = True
        for i in range(n):
            cell = ms[i]["r"], ms[i]["c"]
            if cell in occupied:
                ok = False
                break
            occupied.add(cell)
            for j in range(i):
                if (ms[i]["r"] == magnets[j]["r"] and ms[i]["c"] == magnets[j]["c"]
                        and ms[j]["r"] == magnets[i]["r"] and ms[j]["c"] == magnets[i]["c"]):
                    ok = False
                    break
            if not ok:
                break
        if not ok:
            continue
        next_state = {**state, "magnets": ms}
        e = energy(next_state)
        tie = sum(m["r"] * 16 + m["c"] for m in ms)
        if e >= before - EPS:
            continue
        if (count > best_count or e < best_energy - EPS
                or (abs(e - best_energy) <= EPS and tie < best_tie)):
            best, best_count, best_energy, best_tie = next_state, count, e, tie
            best_moved = [magnets[i]["id"] for i in moved]
        if mask == full and best is not None:
            break
    return {"state": state if best is None else best, "moved": best_moved, "forces": fs}


def settle(level: Mapping[str, Any], state: State, *, trace: bool = False,
           max_ticks: int = 1024) -> dict[str, Any]:
    max_ticks = _positive_int(max_ticks, "max_ticks", zero=True)
    s = _copy_state(state)
    frames = [_copy_state(s)] if trace else []
    for count in range(max_ticks):
        result = tick(level, s)
        if not result["moved"]:
            return {"state": s, "frames": frames, "ticks": count, "stable": True,
                    "solved": is_goal(level, s)}
        s = result["state"]
        if trace:
            frames.append(_copy_state(s))
    # Same guard semantics as web: a limit result is not credited as solved.
    return {"state": s, "frames": frames, "ticks": max_ticks,
            "stable": not tick(level, s)["moved"], "solved": False}


def turn(level: Mapping[str, Any], state: State, magnet_id: str, delta: int,
         *, trace: bool = False, max_ticks: int = 1024) -> dict[str, Any]:
    if not _is_int(delta) or delta not in (-1, 1):
        raise ValueError("Rotation must be -1 or +1 quarter-turn.")
    s = _copy_state(state)
    m = next((m for m in s["magnets"] if m["id"] == magnet_id), None)
    if m is None:
        raise ValueError("Select a magnet before turning.")
    m["dir"] = (m["dir"] + int(delta)) % 4
    s["selected"] = magnet_id
    s["turns"] = (s.get("turns") or 0) + 1
    return settle(level, s, trace=trace, max_ticks=max_ticks)


def solve(level: Mapping[str, Any], state: State, *, max_states: int = 80_000,
          max_depth: int = 24, cancel: Callable[[], bool] | None = None,
          progress: Callable[[int], None] | None = None) -> dict[str, Any]:
    """BFS over complete settled rotations. Selection clicks are free in this metric.

    'limit' never means impossible. Cancellation/progress callbacks are optional
    desktop conveniences and have no effect on the transition graph.
    """
    max_states = _positive_int(max_states, "max_states")
    max_depth = _positive_int(max_depth, "max_depth")
    start = _copy_state(state)
    queue = [(start, -1, None, 0)]
    seen = {state_key(start)}
    if not tick(level, start)["moved"] and is_goal(level, start):
        return {"status": "solved", "path": [], "visited": 1, "minimum": True}
    head, cut_depth = 0, False
    while head < len(queue):
        if cancel is not None and cancel():
            return {"status": "cancelled", "path": None, "visited": len(seen), "reason": "cancelled"}
        s, parent, move, depth = queue[head]
        idx = head
        head += 1
        if progress is not None and head % 256 == 0:
            progress(len(seen))
        if depth >= max_depth:
            cut_depth = True
            continue
        for m in s["magnets"]:
            for delta in (-1, 1):
                result = turn(level, s, m["id"], delta)
                nxt = result["state"]
                if not result["stable"]:
                    continue
                k = state_key(nxt)
                if k in seen:
                    continue
                seen.add(k)
                action = {"id": m["id"], "delta": delta}
                if result["solved"]:
                    path = [action]
                    p = idx
                    while queue[p][2] is not None:
                        path.append(queue[p][2])
                        p = queue[p][1]
                    return {"status": "solved", "path": list(reversed(path)),
                            "visited": len(seen), "minimum": True}
                queue.append((nxt, idx, action, depth + 1))
                if len(seen) >= max_states:
                    return {"status": "limit", "path": None, "visited": len(seen), "reason": "state_limit"}
    return {"status": "limit" if cut_depth else "impossible", "path": None,
            "visited": len(seen), "reason": "depth_limit" if cut_depth else "exhausted"}


def layout(level: Mapping[str, Any]) -> dict[str, int]:
    w, h = len(level["rows"][0]), len(level["rows"])
    return {"cell": 5, "x": (64 - w * 5) // 2, "y": (51 - h * 5) // 2, "w": w, "h": h}


def cell_center(level: Mapping[str, Any], r: int, c: int) -> dict[str, int]:
    geometry = layout(level)
    return {"x": geometry["x"] + c * 5 + 2, "y": geometry["y"] + r * 5 + 2}


def point_to_cell(level: Mapping[str, Any], x: int, y: int) -> dict[str, int]:
    geometry = layout(level)
    return {"r": (y - geometry["y"]) // 5, "c": (x - geometry["x"]) // 5}


def render_frame(level: Mapping[str, Any], state: State, *, won: bool = False) -> list[list[int]]:
    """Exact 64x64 indexed web renderer, without desktop inspection overlays."""
    frame = [[5] * FRAME for _ in range(FRAME)]

    def paint(x: int, y: int, w: int, h: int, color: int) -> None:
        for r in range(max(0, y), min(FRAME, y + h)):
            for c in range(max(0, x), min(FRAME, x + w)):
                frame[r][c] = color

    geometry = layout(level)
    for r in range(geometry["h"]):
        for c in range(geometry["w"]):
            x, y = geometry["x"] + c * 5, geometry["y"] + r * 5
            if level["rows"][r][c] == "#":
                paint(x, y, 5, 5, 4)
                paint(x + 1, y + 1, 3, 3, 3)
            else:
                paint(x, y, 5, 5, 1)
                paint(x, y, 1, 1, 2)
    gx = geometry["x"] + level["goal"]["c"] * 5
    gy = geometry["y"] + level["goal"]["r"] * 5
    paint(gx, gy, 5, 5, 14)
    paint(gx + 1, gy + 1, 3, 3, 5)
    paint(gx + 2, gy + 2, 1, 1, 14)
    for m in state["magnets"]:
        x = geometry["x"] + m["c"] * 5
        y = geometry["y"] + m["r"] * 5
        paint(x, y, 5, 5, 4)
        paint(x + 1, y + 1, 3, 3, 3)
        for d, color in ((m["dir"], 8), ((m["dir"] + 2) % 4, 9)):
            if d == 0:
                paint(x, y, 5, 1, color)
            elif d == 1:
                paint(x + 4, y, 1, 5, color)
            elif d == 2:
                paint(x, y + 4, 5, 1, color)
            else:
                paint(x, y, 1, 5, color)
        if state.get("selected") == m["id"]:
            paint(x + 2, y + 2, 1, 1, 0)
        if won and m["r"] == level["goal"]["r"] and m["c"] == level["goal"]["c"]:
            for dx, dy in ((1, 1), (3, 1), (1, 3), (3, 3)):
                paint(x + dx, y + dy, 1, 1, 14)
    paint(2, 51, 60, 1, 4)
    glyphs = {"left": ("..#..", ".##..", "#####", ".##..", "..#.."),
              "right": ("..#..", "..##.", "#####", "..##.", "..#.."),
              "next": (".###.", "#...#", "#.#.#", "#...#", ".###.")}
    for name, b in CONTROLS.items():
        paint(b["x"], b["y"], b["w"], b["h"], 3)
        paint(b["x"] + 1, b["y"] + 1, b["w"] - 2, b["h"] - 2, 4)
        color = 2 if name == "next" else 0
        for i, row in enumerate(glyphs[name]):
            for j, ch in enumerate(row):
                if ch == "#":
                    paint(b["x"] + 3 + j, b["y"] + 1 + i, 1, 1, color)
    return frame


def cycle(state: State) -> State:
    s = _copy_state(state)
    i = next((i for i, m in enumerate(s["magnets"]) if m["id"] == s.get("selected")), -1)
    s["selected"] = s["magnets"][(i + 1) % len(s["magnets"])]["id"]
    return s


def click(level: Mapping[str, Any], state: State, x: Any, y: Any,
          *, trace: bool = True, max_ticks: int = 1024) -> dict[str, Any]:
    s = _copy_state(state)
    if not _is_int(x) or not _is_int(y) or not 0 <= x <= 63 or not 0 <= y <= 63:
        return {"state": s, "event": "ignored"}
    x, y = int(x), int(y)
    for name, b in CONTROLS.items():
        if b["x"] <= x < b["x"] + b["w"] and b["y"] <= y < b["y"] + b["h"]:
            if name == "next":
                return {"state": cycle(s), "event": "selected"}
            if not s.get("selected"):
                return {"state": s, "event": "no_selection"}
            return {**turn(level, s, s["selected"], -1 if name == "left" else 1,
                           trace=trace, max_ticks=max_ticks), "event": "turned"}
    p = point_to_cell(level, x, y)
    hit = next((m for m in s["magnets"] if m["r"] == p["r"] and m["c"] == p["c"]), None)
    s["selected"] = hit["id"] if hit else None
    return {"state": s, "event": "selected" if hit else "deselected"}


def load_levels(directory: str | Path = LEVELS_DIR) -> list[Level]:
    paths = sorted(Path(directory).glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"No L*.json level files in {directory}")
    if len(paths) > 50:
        raise ValueError("Use at most 50 levels per pack.")
    levels = []
    for path in paths:
        try:
            levels.append(validate_level(json.loads(path.read_text(encoding="utf-8-sig"))))
        except (ValueError, TypeError) as exc:
            raise ValueError(f"{path.name}: {exc}") from exc
    return levels


def load_pack(path: str | Path) -> list[Level]:
    """Read a single web-editor level, a list, or a {levels: [...]} pack."""
    p = Path(path)
    if p.stat().st_size > 5_000_000:
        raise ValueError("JSON pack exceeds the 5 MB import limit.")
    raw = json.loads(p.read_text(encoding="utf-8-sig"))
    arr = raw if isinstance(raw, list) else raw.get("levels") if isinstance(raw, dict) else None
    if arr is None:
        arr = [raw]
    if not isinstance(arr, list) or not 1 <= len(arr) <= 50:
        raise ValueError("Import 1–50 levels at a time.")
    levels = [validate_level(item) for item in arr]
    ids = set()
    for i, level in enumerate(levels):
        if level["id"] in ids:
            level["id"] = f"{level['id']}_{i}"
        ids.add(level["id"])
    return levels


class GameInfo(Protocol):
    game_id: str
    title: str
    family: str
    levels: int
    default_fps: float


@dataclass(frozen=True)
class DefaultGameInfo:
    game_id: str = "polarity"
    title: str = "POLARITY"
    family: str = "polarity"
    levels: int = 6
    default_fps: float = 8


class PolarityEngine:
    """Custom-backend adapter, independent of registry imports and GUI libraries.

    Default: advance automatically; last success is WIN. auto_advance=False
    keeps the solved layout visible for the local viewer. Selection, solver,
    undo and rendering never change the magnetic transition rules.
    """
    def __init__(self, info: GameInfo | None = None, *, levels_dir: str | Path | None = None,
                 levels: Sequence[Mapping[str, Any]] | None = None, animate: bool = True,
                 auto_advance: bool = True, start_level: int = 1, debug: bool = False,
                 max_ticks: int = 1024) -> None:
        if levels is not None and levels_dir is not None:
            raise ValueError("Provide levels OR levels_dir, not both.")
        templates = ([validate_level(item) for item in levels] if levels is not None
                     else load_levels(levels_dir if levels_dir is not None else LEVELS_DIR))
        if not 1 <= len(templates) <= 50:
            raise ValueError("Use 1–50 levels.")
        self.info = info if info is not None else DefaultGameInfo(levels=len(templates))
        self.win_levels = _positive_int(self.info.levels, "info.levels")
        if self.win_levels > len(templates):
            raise ValueError("info.levels exceeds the number of supplied levels.")
        fps = self.info.default_fps
        if isinstance(fps, bool) or not isinstance(fps, (int, float)) or not math.isfinite(fps) or fps <= 0:
            raise ValueError("default_fps must be finite and positive.")
        self._templates = templates[:self.win_levels]
        self.source_path = str(levels_dir if levels_dir is not None else LEVELS_DIR) if levels is None else "<in-memory>"
        self.animate, self.auto_advance, self.debug = bool(animate), bool(auto_advance), bool(debug)
        self.max_ticks = _positive_int(max_ticks, "max_ticks")
        self._history: list[tuple[State, bool]] = []
        self._index = 0
        self._core: State = {}
        self._won, self._stable = False, True
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_ticks = 0
        self.last_action, self.last_event = "RESET", "READY"
        self.state = "NOT_FINISHED"
        self.reset(start_level=start_level)

    @property
    def level(self) -> int:
        return self._index + 1

    @property
    def can_undo(self) -> bool:
        return bool(self._history)

    def _activate(self, index: int) -> None:
        self._index = index
        self._history.clear()
        self.level_steps = self.last_ticks = 0
        self.state = "NOT_FINISHED"
        while True:
            level = self._templates[self._index]
            self._core = initial_state(level)
            self._stable = not tick(level, self._core)["moved"]
            self._won = self._stable and is_goal(level, self._core)
            if not self._won:
                break
            self.levels_completed = self.level
            if self.level == self.win_levels:
                self.state, self.last_event = "WIN", "GAME_WON"
                break
            if not self.auto_advance:
                self.last_event = "LEVEL_COMPLETE"
                break
            self._index += 1

    def reset(self, *, start_level: int = 1) -> dict[str, Any]:
        start_level = _positive_int(start_level, "start_level")
        if start_level > self.win_levels:
            raise ValueError("start_level exceeds the number of levels.")
        self.levels_completed = start_level - 1
        self.step_index = 0
        self.last_action, self.last_event = "RESET", "READY"
        self._activate(start_level - 1)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self.levels_completed = self._index
        self.last_action, self.last_event = "ACTION7", "LEVEL_RESET"
        self._activate(self._index)
        return self.public_state()

    def next_level(self) -> dict[str, Any]:
        """Viewer helper, not an extra ARC action."""
        if self._won and self.level < self.win_levels:
            self.last_event = "READY"
            self._activate(self._index + 1)
        return self.public_state()

    def undo(self) -> dict[str, Any]:
        """Undo a whole rotation including its motion; global attempts stay counted."""
        if self._history:
            self._core, self._stable = self._history.pop()
            self._won = self._stable and is_goal(self._templates[self._index], self._core)
            self.levels_completed = self._index + int(self._won)
            self.state = "WIN" if self._won and self.level == self.win_levels else "NOT_FINISHED"
            self.last_action, self.last_event = "UNDO", "UNDO"
            self.last_ticks = 0
        return self.public_state()

    def snapshot(self) -> State:
        return _copy_state(self._core)

    def level_definition(self) -> Level:
        return deepcopy(self._templates[self._index])

    def export_pack(self) -> dict[str, Any]:
        return {"format": "polarity.arc3", "version": 1, "levels": deepcopy(self._templates)}

    def solution(self, **options: Any) -> dict[str, Any]:
        """Opt-in developer tool. Never called by reset, action or observation."""
        return solve(self._templates[self._index], self._core, **options)

    def action(self, action_id: int, data: Mapping[str, Any] | None = None) -> dict[str, Any]:
        if not _is_int(action_id) or not 1 <= action_id <= 7:
            self.last_event = "INVALID_ACTION"
            return self.public_state()
        aid = int(action_id)
        if aid == 7:
            return self.level_reset()
        self.last_action = f"ACTION{aid}"
        if self._won:
            self.last_event = "ALREADY_WON"
            return self.public_state()
        if aid in (1, 2):
            self.last_event = "UNSUPPORTED_ACTION"
            return self.public_state()
        self.step_index += 1
        self.level_steps += 1
        level = self._templates[self._index]
        if aid == 5:
            self._core = cycle(self._core)
            self.last_event = "SELECTED"
            return self.public_state()
        if aid == 6:
            data = data if isinstance(data, Mapping) else {}
            result = click(level, self._core, data.get("x"), data.get("y"),
                           trace=self.animate, max_ticks=self.max_ticks)
            if result["event"] != "turned":
                self._core = result["state"]
                self.last_event = result["event"].upper()
                return self.public_state()
        else:
            if self._core["selected"] is None:
                self.last_event = "NO_SELECTION"
                return self.public_state()
            result = turn(level, self._core, self._core["selected"], -1 if aid == 3 else 1,
                          trace=self.animate, max_ticks=self.max_ticks)
        self._history.append((_copy_state(self._core), self._stable))
        if len(self._history) > 2000:
            del self._history[0]
        self._core = result["state"]
        self._stable = result["stable"]
        self.last_ticks = result["ticks"]
        self._won = bool(result["stable"] and result["solved"])
        self.last_event = "MOTION_LIMIT" if result["ticks"] >= self.max_ticks else "SETTLED" if result["ticks"] else "TURNED"
        frames = [render_frame(level, s) for s in result["frames"]] if self.animate else []
        completed_level = None
        if self._won:
            completed_level = self.level
            self.levels_completed = completed_level
            if self.animate:
                frames.append(render_frame(level, self._core, won=True))
            self.last_event = "GAME_WON" if completed_level == self.win_levels else "LEVEL_COMPLETE"
            if completed_level == self.win_levels:
                self.state = "WIN"
            elif self.auto_advance:
                self._activate(self._index + 1)
        out = self.public_state()
        # Keep motion count from the triggering turn, even across auto-advance.
        out["motion_ticks"] = result["ticks"]
        out["motion_stable"] = result["stable"]
        if completed_level is not None:
            out["completed_level"] = completed_level
        if frames:
            out["frames"] = frames + [out["frame"]]
            out["frame_count"] = len(out["frames"])
            out["transition_frame_interval_ms"] = 1000 / self.info.default_fps
        return out

    step = action

    def public_state(self) -> dict[str, Any]:
        frame = render_frame(self._templates[self._index], self._core, won=self._won)
        ids = [7] if self._won else [3, 4, 5, 6, 7]
        result = {"backend": "custom", "selected": True, "game_id": self.info.game_id,
                  "title": self.info.title, "frame": frame, "frames": [frame], "frame_count": 1,
                  "default_fps": self.info.default_fps, "state": self.state, "level": self.level,
                  "levels_completed": self.levels_completed, "win_levels": self.win_levels,
                  "step_index": self.step_index, "available_actions": [f"ACTION{i}" for i in ids],
                  "available_action_ids": ids, "last_action": self.last_action,
                  "score": self.levels_completed, "full_reset": False, "source_path": self.source_path,
                  "custom_family": self.info.family, "level_name": self._templates[self._index]["name"],
                  "level_steps": self.level_steps, "level_turns": self._core["turns"], "max_steps": None,
                  "selected_piece": self._core["selected"], "selected_magnet": self._core["selected"],
                  "level_complete": self._won, "last_event": self.last_event,
                  "motion_ticks": self.last_ticks, "motion_stable": self._stable,
                  "palette": list(PALETTE)}
        if self.debug:
            result["debug"] = {"core": self.snapshot(), "interactions": interactions(self._core),
                               "forces": forces(self._core), "energy": energy(self._core)}
        return result


# Descriptive aliases for tools that use the core independently of the adapter.
render = render_frame
