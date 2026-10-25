"""HPDL — Homogeneous Pair Deletion, native Python port of web v3 (custom_3).

Configure receivers with ACTION1–4 or native clicks (ACTION6). ACTION5 plays
one whole train, including animation and verdict. Receivers act once, on an
exact homogeneous window. Linked receivers need their parents' pulses on the
same tick. Capture leaves gaps; paint changes colors without changing speed.

Backend: HomogeneousPairDeletionEngine(info), action(), reset(), level_reset(),
public_state(). Python 3.10+, standard library only. No JavaScript interpreter,
network, randomness, solver or stored solution is used at runtime. Install the
six level JSONs as well as this module; see README.md for layout and timing.
"""
from __future__ import annotations

import copy
import json
import math
from collections.abc import Mapping, Sequence
from pathlib import Path
from types import SimpleNamespace
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

SIZE = FRAME = 64
PITCH = 4
LEVEL_COUNT = 6
VERSION = WEB_VERSION = "3.0"
GAME_ID = "hpdl-c3000001"
TITLE = "Homogeneous Pair Deletion — Le train des prises"
FAMILY = "homogeneous_pair_deletion"
WAVE = "custom_3"
DEFAULT_FPS = 20
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / FAMILY / "levels"
PALETTE = (
    "#F3F2EB", "#C8D0CF", "#36434B", "#63747B", "#19272E", "#0D171E",
    "#B555B5", "#E7B9A3", "#EC7066", "#68ACEB", "#76DBD8", "#EFCA72",
    "#E8A364", "#80604B", "#88CEA3", "#BC9BEA",
)
COLOR_NAMES = (
    "Blanc", "Gris clair", "Gris moyen", "Gris", "Gris foncé", "Noir",
    "Magenta", "Rose", "Rouge", "Bleu", "Cyan", "Jaune", "Orange", "Marron", "Vert", "Violet",
)
Raster = list[list[int]]
Level = dict[str, Any]
Settings = list[dict[str, Any]]


def _is_integer(value: Any) -> bool:
    """JSON/JS integer semantics: booleans are not numbers here."""
    return type(value) is int or (type(value) is float and math.isfinite(value) and value.is_integer())


def _integer(value: Any, name: str, minimum: int, maximum: int) -> int:
    if not _is_integer(value) or not minimum <= value <= maximum:
        raise ValueError(f"{name}: expected integer {minimum}..{maximum}, got {value!r}")
    return int(value)


def _same(a: Any, b: Any) -> bool:
    """Strict JSON scalar equality, avoiding Python True == 1 / False == 0."""
    if a is None or b is None:
        return a is b
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    return a == b


def _choice_index(choices: Sequence[Any], value: Any) -> int:
    return next((i for i, item in enumerate(choices) if _same(item, value)), -1)


def _round(value: float) -> int:
    # Match Math.round rather than Python's ties-to-even rounding.
    return math.floor(value + 0.5)


def _inside(x: int, y: int, rect: Mapping[str, int]) -> bool:
    return rect["x"] <= x < rect["x"] + rect["w"] and rect["y"] <= y < rect["y"] + rect["h"]


def _fill(frame: Raster, x: float, y: float, w: int, h: int, color: int) -> None:
    xx, yy = _round(x), _round(y)
    for j in range(max(0, yy), min(SIZE, yy + h)):
        for i in range(max(0, xx), min(SIZE, xx + w)):
            frame[j][i] = color


def _outline(frame: Raster, x: float, y: float, w: int, h: int, color: int) -> None:
    _fill(frame, x, y, w, 1, color)
    _fill(frame, x, y + h - 1, w, 1, color)
    _fill(frame, x, y, 1, h, color)
    _fill(frame, x + w - 1, y, 1, h, color)


def _line(frame: Raster, x0: float, y0: float, x1: float, y1: float, color: int) -> None:
    x0, y0, x1, y1 = map(_round, (x0, y0, x1, y1))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    error = dx + dy
    for _ in range(160):
        _fill(frame, x0, y0, 1, 1, color)
        if x0 == x1 and y0 == y1:
            break
        twice = 2 * error
        if twice >= dy:
            error += dy
            x0 += sx
        if twice <= dx:
            error += dx
            y0 += sy


def _stamp(frame: Raster, x: int, y: int, pixels: Raster) -> None:
    for j, row in enumerate(pixels):
        for i, color in enumerate(row):
            _fill(frame, x + i, y + j, 1, 1, color)


def topological(level: Mapping[str, Any]) -> list[int]:
    """Sources before dependents, retaining the JS DFS's deterministic order."""
    seen: set[int] = set()
    active: set[int] = set()
    order: list[int] = []

    def visit(i: int) -> None:
        if i in active:
            raise ValueError("Receiver dependency cycle")
        if i in seen:
            return
        active.add(i)
        for parent in level["receivers"][i]["requires"]:
            visit(parent)
        active.remove(i)
        seen.add(i)
        order.append(i)

    for i in range(len(level["receivers"])):
        visit(i)
    return order


def fields(level: Mapping[str, Any], receiver: int) -> dict[str, dict[str, int]]:
    r = level["receivers"][receiver]
    p = level["path"][r["position"]]
    q = level["path"][r["position"] + 3]
    x, y = min(p[0], q[0]) - 2, p[1] - 10
    return {
        "body": {"x": x, "y": y, "w": 17, "h": 8},
        "select": {"x": x + 6, "y": y + 1, "w": 5, "h": 3},
        "filter": {"x": x + 1, "y": y + 1, "w": 5, "h": 4},
        "output": {"x": x + 11, "y": y + 1, "w": 5, "h": 4},
        "size": {"x": x + 1, "y": y + 5, "w": 15, "h": 2},
    }


def color_indicator(color: int | None, choices: Sequence[int | None]) -> Raster:
    """5x4 swatch: vertical black 1x2 lock, or one left-edge pixel per choice."""
    pixels = [[4] * 5 for _ in range(4)]
    fixed, limited = len(choices) == 1, 2 <= len(choices) <= 4
    left = 2 if limited else 0
    width = 5 - left
    for y in range(4):
        for x in range(left, 5):
            pixels[y][x] = ([[9, 8], [11, 14]][0 if y < 2 else 1][0 if x - left < math.ceil(width / 2) else 1]
                            if color is None else color)
    if fixed:
        pixels[1][2] = pixels[2][2] = 5
    elif limited:
        top = (4 - len(choices)) // 2
        for i, choice in enumerate(choices):
            pixels[top + i][0] = 0 if choice is None else choice
    return pixels


def capacity_indicator(size: int, choices: Sequence[int], used: bool = False) -> Raster:
    """15x2 capacity row; fixed slots are Ls, with absent surplus slots."""
    pixels = [[4] * 15 for _ in range(2)]
    color = 14 if used else 1
    for k in range(4):
        x = k * 4
        if len(choices) == 1:
            if k < size:
                pixels[0][x] = pixels[1][x] = pixels[1][x + 1] = color
        else:
            c = color if k < size else 2
            pixels[0][x] = pixels[0][x + 1] = pixels[1][x] = pixels[1][x + 1] = c
    return pixels


def defaults(level: Mapping[str, Any]) -> Settings:
    return [{key: r[key] for key in ("size", "color", "output")} for r in level["receivers"]]


def check_settings(level: Mapping[str, Any], settings: Settings) -> Settings:
    if not isinstance(settings, list) or len(settings) != len(level["receivers"]):
        raise ValueError("One configuration per receiver is required")
    for i, (config, r) in enumerate(zip(settings, level["receivers"])):
        if not isinstance(config, Mapping) or any(k not in config for k in ("size", "color", "output")):
            raise ValueError(f"Receiver {i}: missing size, color or output")
        if (_choice_index(r["sizes"], config["size"]) < 0
                or _choice_index(r["filters"], config["color"]) < 0
                or (r["mode"] == "paint" and _choice_index(r["outputs"], config["output"]) < 0)
                or (r["mode"] == "capture" and config["output"] is not None)):
            raise ValueError(f"Receiver {i}: configuration outside visible choices")
    return settings


def validate(raw: list[Level]) -> list[Level]:
    """Copy and validate all six levels; never modify the caller's templates."""
    if not isinstance(raw, list) or len(raw) != LEVEL_COUNT:
        raise ValueError("Exactly six levels are required")
    levels = copy.deepcopy(raw)
    for li, level in enumerate(levels, 1):
        if not isinstance(level, dict):
            raise TypeError(f"Level {li} must be a JSON object")
        train = level.get("train")
        if not isinstance(train, list) or not 2 <= len(train) <= 24:
            raise ValueError(f"Level {li}: train must contain 2..24 cubes")
        level["train"] = [_integer(c, "train color", 0, 15) for c in train]
        path = level.get("path")
        if not isinstance(path, list) or len(path) < 12:
            raise ValueError("Path must contain at least 12 cells")
        points: set[tuple[int, int]] = set()
        for j, p in enumerate(path):
            if not isinstance(p, list) or len(p) != 2:
                raise ValueError("Rail cells must be [x, y]")
            p[:] = [_integer(p[0], "rail x", 2, 61), _integer(p[1], "rail y", 20, 57)]
            if tuple(p) in points:
                raise ValueError("Duplicate rail cell")
            points.add(tuple(p))
            if j and abs(p[0] - path[j - 1][0]) + abs(p[1] - path[j - 1][1]) != PITCH:
                raise ValueError("The rail must be regular with pitch 4")
        receivers = level.get("receivers")
        if not isinstance(receivers, list) or not 1 <= len(receivers) <= 9:
            raise ValueError("Use 1..9 receivers")
        windows: set[int] = set()
        for i, r in enumerate(receivers):
            if not isinstance(r, dict):
                raise TypeError("Receiver must be an object")
            r["id"] = _integer(r.get("id"), "receiver id", i, i)
            r["position"] = _integer(r.get("position"), "receiver position", 0, len(path) - 4)
            if r.get("mode") not in ("capture", "paint"):
                raise ValueError("Receiver mode must be capture or paint")
            sizes = r.get("sizes")
            if not isinstance(sizes, list) or not sizes:
                raise ValueError("Missing size choices")
            r["sizes"] = [_integer(n, "size", 1, 4) for n in sizes]
            if len(set(r["sizes"])) != len(r["sizes"]):
                raise ValueError("Duplicate size choice")
            filters = r.get("filters")
            if not isinstance(filters, list) or not filters:
                raise ValueError("Missing filter choices")
            r["filters"] = [None if c is None else _integer(c, "filter", 0, 15) for c in filters]
            if r["mode"] == "paint":
                if not isinstance(r.get("outputs"), list) or not r["outputs"]:
                    raise ValueError("Painter must have output choices")
                r["outputs"] = [_integer(c, "output color", 0, 15) for c in r["outputs"]]
            requires = r.get("requires")
            if not isinstance(requires, list):
                raise ValueError("requires must be a list")
            r["requires"] = [_integer(p, "dependency", 0, len(receivers) - 1) for p in requires]
            if i in r["requires"] or len(set(r["requires"])) != len(r["requires"]):
                raise ValueError("Self or duplicate dependency")
            if any(path[r["position"] + k][1] != path[r["position"]][1] for k in range(4)):
                raise ValueError("Receiver straddles a bend")
            for k in range(max(r["sizes"])):
                position = r["position"] + k
                if position in windows:
                    raise ValueError("Overlapping receiver windows")
                windows.add(position)
            body = fields(level, i)["body"]
            if body["x"] < 0 or body["x"] + body["w"] > SIZE or body["y"] < 11:
                raise ValueError("Receiver lies outside the board")
        topological(level)
        check_settings(level, defaults(level))
    return levels


def start_snapshot(level: Mapping[str, Any]) -> dict[str, Any]:
    return {"head": -1, "tick": 0, "colors": list(level["train"]),
            "removed": [False] * len(level["train"]), "used": [False] * len(level["receivers"]),
            "captured": 0, "escaped": 0, "events": [], "fired": []}


def _advance(level: Mapping[str, Any], settings: Settings, snapshot: dict[str, Any], order: list[int]) -> None:
    """One logical step, in place. Every cube retains its original train index."""
    s = snapshot
    s["tick"] += 1
    s["head"] += 1
    s["events"], s["fired"] = [], []
    fired: set[int] = set()
    for i in order:
        r, cfg = level["receivers"][i], settings[i]
        if s["used"][i] or any(p not in fired for p in r["requires"]):
            continue
        ids = [s["head"] - (r["position"] + k) for k in range(int(cfg["size"]))]
        if any(c < 0 or c >= len(s["colors"]) or s["removed"][c] for c in ids):
            continue
        color = s["colors"][ids[0]]
        if any(s["colors"][c] != color for c in ids) or (cfg["color"] is not None and cfg["color"] != color):
            continue
        s["used"][i] = True
        fired.add(i)
        s["fired"].append(i)
        ids.sort()
        event = {"type": r["mode"], "receiver": i, "tick": s["tick"], "ids": ids,
                 "color": color, "size": cfg["size"], "parents": r["requires"][:]}
        if r["mode"] == "capture":
            for c in ids:
                s["removed"][c] = True
            s["captured"] += len(ids)
        else:
            event["output"] = cfg["output"]
            for c in ids:
                s["colors"][c] = cfg["output"]
        s["events"].append(event)
    s["escaped"] = sum(not removed and s["head"] - i >= len(level["path"])
                       for i, removed in enumerate(s["removed"]))


def tick(level: Mapping[str, Any], settings: Settings, before: dict[str, Any],
         order: list[int] | None = None) -> dict[str, Any]:
    """Pure tick helper for author tests; runtime actions use a complete traversal."""
    snapshot = copy.deepcopy(before)
    _advance(level, settings, snapshot, topological(level) if order is None else order)
    return snapshot


def simulate(level: Mapping[str, Any], settings: Settings, keep: bool = True) -> dict[str, Any]:
    """Simulate the requested settings, without ever searching for better ones."""
    check_settings(level, settings)
    s = start_snapshot(level)
    order = topological(level)
    snapshots = [copy.deepcopy(s)] if keep else None
    events: list[dict[str, Any]] = []
    for _ in range(len(level["path"]) + len(level["train"])):
        _advance(level, settings, s, order)
        events.extend(s["events"])
        if snapshots is not None:
            snapshots.append(copy.deepcopy(s))
        if s["captured"] == len(level["train"]):
            break
    return {"success": s["captured"] == len(level["train"]), "captured": s["captured"],
            "total": len(level["train"]), "missed": len(level["train"]) - s["captured"],
            "ticks": s["tick"], "events": events, "final": s, "snapshots": snapshots}


def path_point(level: Mapping[str, Any], t: float) -> list[float]:
    path, n = level["path"], len(level["path"])
    if t < 0:
        a, b = path[0], path[1]
        return [a[j] + t * (b[j] - a[j]) for j in range(2)]
    if t >= n - 1:
        a, b = path[-1], path[-2]
        return [a[j] + (t - (n - 1)) * (a[j] - b[j]) for j in range(2)]
    j = math.floor(t)
    a, b, fraction = path[j], path[j + 1], t - j
    return [a[k] + fraction * (b[k] - a[k]) for k in range(2)]


def render(level: Mapping[str, Any], settings: Settings, selected: int, completed: Sequence[bool],
           snap: Mapping[str, Any], opts: Mapping[str, Any] | None = None) -> Raster:
    """Exact native raster including v3 locks, shortened arrows and fixed L slots."""
    o = {} if opts is None else opts
    frame = [[5] * SIZE for _ in range(SIZE)]
    head = o.get("head", snap["head"])
    count = o["summary"]["captured"] if o.get("summary") is not None else snap["captured"]
    _fill(frame, 2, 1, 60, 3, 2)
    _fill(frame, 2, 1, math.floor(60 * count / len(level["train"])), 3, 14)
    pitch = min(4, 55 // len(level["train"]))
    cube_width, px = max(1, pitch - 1), 6
    _fill(frame, 2, 7, 2, 1, 0)
    _fill(frame, 3, 6, 1, 3, 0)
    for i, color in enumerate(level["train"]):
        _fill(frame, px, 6, cube_width, cube_width, 2 if snap["removed"][i] else color)
        px += pitch
    rects = [fields(level, i) for i in range(len(level["receivers"]))]
    for i, receiver in enumerate(level["receivers"]):
        body = rects[i]["body"]
        for parent in receiver["requires"]:
            source = rects[parent]["body"]
            ay, by = source["y"] + 8, body["y"] + 8
            channel = max(ay, by) + 6
            color = 10 if parent in snap["fired"] else 15
            ax, bx = source["x"] + 8, body["x"] + 8
            _line(frame, ax, ay, ax, channel, color)
            _line(frame, ax, channel, bx, channel, color)
            _line(frame, bx, channel, bx, by, color)
            _fill(frame, bx - 1, by + 1, 3, 1, color)
            _fill(frame, bx, by, 1, 1, color)
    path = level["path"]
    for i, p in enumerate(path):
        if i:
            _line(frame, *path[i - 1], *p, 3)
        _fill(frame, p[0] - 1, p[1] - 1, 3, 3, 4)
        _fill(frame, p[0], p[1], 1, 1, 2)
    end, previous = path[-1], path[-2]
    ex = end[0] + (2 if end[0] > previous[0] else -2)
    _line(frame, ex, end[1] - 2, ex, end[1] + 2, 8 if snap["escaped"] else 3)
    for i, r in enumerate(level["receivers"]):
        config, q = settings[i], rects[i]
        body, p = q["body"], path[r["position"]]
        last = path[r["position"] + int(config["size"]) - 1]
        used = snap["used"][i]
        base = 2 if used else (15 if r["mode"] == "paint" else 3)
        _fill(frame, body["x"], body["y"], body["w"], body["h"], 4)
        _outline(frame, body["x"], body["y"], body["w"], body["h"], 0 if i == selected else base)
        _stamp(frame, q["filter"]["x"], q["filter"]["y"], color_indicator(config["color"], r["filters"]))
        if r["mode"] == "paint":
            _stamp(frame, q["output"]["x"], q["output"]["y"], color_indicator(config["output"], r["outputs"]))
            _line(frame, body["x"] + 6, body["y"] + 2, body["x"] + 9, body["y"] + 2, 0)
            _fill(frame, body["x"] + 8, body["y"] + 1, 1, 3, 0)
        else:
            ox, oy = q["output"]["x"], q["output"]["y"]
            _line(frame, ox, oy, ox, oy + 2, 1)
            _line(frame, ox + 3, oy, ox + 3, oy + 2, 1)
            _line(frame, ox, oy + 2, ox + 3, oy + 2, 1)
            _fill(frame, body["x"] + 7, body["y"] + 1, 3, 1, 14 if used else 2)
            _fill(frame, body["x"] + 8, body["y"] + 2, 1, 2, 14 if used else 2)
        _stamp(frame, q["size"]["x"], q["size"]["y"], capacity_indicator(config["size"], r["sizes"], used))
        wl, wr = min(p[0], last[0]) - 1, max(p[0], last[0]) + 1
        _line(frame, wl, p[1] + 3, wr, p[1] + 3, 2 if used else (0 if i == selected else 3))
        _fill(frame, wl, p[1] + 2, 1, 2, 3)
        _fill(frame, wr, p[1] + 2, 1, 2, 3)
        if r["requires"]:
            _fill(frame, body["x"] + 7, body["y"] + 7, 3, 1, 10 if i in snap["fired"] else 15)
        if i in snap["fired"]:
            _outline(frame, body["x"], body["y"], body["w"], body["h"], 14)
            for k in range(int(config["size"])):
                p2 = path[r["position"] + k]
                _line(frame, p2[0], p2[1] - 1, p2[0], body["y"] + body["h"], 10)
    for i in range(len(level["train"]) - 1, -1, -1):
        if snap["removed"][i]:
            continue
        t = head - i
        if t < -0.5 or t > len(path) - 0.5:
            continue
        p = path_point(level, t)
        _fill(frame, p[0] - 1, p[1] - 1, 3, 3, snap["colors"][i])
        _fill(frame, p[0] - 1, p[1] - 1, 1, 1, 1)
    for ghost in o.get("ghosts", []):
        position = path_point(level, ghost["at"])
        _fill(frame, position[0] - 1, position[1] - 1 - min(8, ghost["age"] * 2), 2, 2, ghost["color"])
    for i in range(LEVEL_COUNT):
        _fill(frame, 2 + i * 5, 62, 4, 1, 14 if completed[i] else 2)
    if "flash" in o:
        _outline(frame, 0, 0, 64, 64, o["flash"])
    if o.get("red"):
        return [[8] * SIZE for _ in range(SIZE)]
    return frame


def load_levels(directory: str | Path) -> list[Level]:
    root = Path(directory)
    paths = [root / f"L{i:02d}.json" for i in range(1, LEVEL_COUNT + 1)]
    missing = [str(p) for p in paths if not p.is_file()]
    if missing:
        raise FileNotFoundError("Copy the six level JSONs as well as the engine. Missing: " + ", ".join(missing))
    return validate([json.loads(p.read_text(encoding="utf-8")) for p in paths])


def _decode_action(action: Any, data: Any) -> tuple[int | None, Mapping[str, Any]]:
    if isinstance(action, Mapping):
        data = action.get("data", {})
        action = action.get("id") if action.get("id") is not None else action.get("action")
    if isinstance(action, str):
        if action == "RESET":
            action = 0
        elif len(action) == 7 and action[:6] == "ACTION" and action[-1] in "1234567":
            action = int(action[-1])
        else:
            action = None
    return (int(action) if _is_integer(action) else None, data if isinstance(data, Mapping) else {})


class HomogeneousPairDeletionEngine:
    """Custom backend, with optional standalone defaults and author-level loading.

    An existing CustomGameInfo is accepted without importing the user's registry
    at runtime. No changes to that registry are made automatically.
    """
    def __init__(self, info: CustomGameInfo | None = None, *, levels_dir: str | Path | None = None,
                 level_data: list[Level] | None = None) -> None:
        if levels_dir is not None and level_data is not None:
            raise ValueError("Use levels_dir or level_data, not both")
        self.info = info if info is not None else SimpleNamespace(
            game_id=GAME_ID, title=TITLE, family=FAMILY, levels=LEVEL_COUNT, default_fps=DEFAULT_FPS)
        self.levels_dir = Path(levels_dir).resolve() if levels_dir is not None else LEVELS_DIR
        self._templates = load_levels(self.levels_dir) if level_data is None else validate(level_data)
        self.win_levels = _integer(self.info.levels, "info.levels", 1, LEVEL_COUNT)
        self._fps = _integer(self.info.default_fps, "info.default_fps", 1, 240)
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = False
        self.step_index = 0
        self.last_action = "RESET"
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
        self._config = defaults(self._level)
        self.selected_receiver = 0
        self.state = "NOT_FINISHED"
        self._last: dict[str, Any] | None = None
        self._final_snapshot: dict[str, Any] | None = None
        self.trials = self.adjustments = 0

    def _render_frame(self) -> Raster:
        snap = self._final_snapshot if self.state == "WIN" and self._final_snapshot is not None else start_snapshot(self._level)
        return render(self._level, self._config, self.selected_receiver, self._completed, snap, {"summary": self._last})

    def _envelope(self, frames: list[Raster] | None = None, timeline: list[dict[str, Any]] | None = None,
                  durations: list[int] | None = None, **extra: Any) -> dict[str, Any]:
        if frames is None:
            frames, durations = [self._render_frame()], [50]
        if durations is None or len(frames) != len(durations) or (timeline is not None and len(timeline) != len(frames)):
            raise RuntimeError("Frame, duration and timeline length mismatch")
        actions = [7] if self.state == "WIN" else list(range(1, 8))
        out = {
            "backend": "custom", "selected": True, "game_id": self.info.game_id,
            "title": self.info.title, "custom_family": self.info.family, "family": FAMILY,
            "wave": WAVE, "version": VERSION, "frame": frames[-1], "frames": frames,
            "frame_count": len(frames), "frame_durations_ms": durations, "default_fps": self._fps,
            "state": self.state, "level": self._index + 1, "levels_completed": self.levels_completed,
            "score": self.levels_completed, "win_levels": 1 if self.test_mode else self.win_levels,
            "win_score": 1 if self.test_mode else self.win_levels,
            "selected_receiver": self.selected_receiver, "step_index": self.step_index,
            "trials": self.trials, "adjustments": self.adjustments,
            "last_result": copy.deepcopy(self._last), "event": self._event,
            "available_actions": [f"ACTION{i}" for i in actions], "available_action_ids": actions,
            "last_action": self.last_action, "full_reset": False,
            "source_path": str(self.levels_dir), "level_name": self._level.get("title", ""),
            "test_mode": self.test_mode,
        }
        if timeline is not None:
            out["timeline"] = timeline
        out.update(extra)
        return out

    def public_state(self) -> dict[str, Any]:
        """Return one fresh current frame, without advancing or replaying the train."""
        return self._envelope()

    def _response(self, event: str, **kwargs: Any) -> dict[str, Any]:
        self._event = event
        return self._envelope(**kwargs)

    def _cycle(self, field: str, delta: int = 1) -> dict[str, Any]:
        r = self._level["receivers"][self.selected_receiver]
        choices = r[{"size": "sizes", "color": "filters", "output": "outputs"}[field]]
        if len(choices) < 2:
            return self._response("fixed")
        c = self._config[self.selected_receiver]
        c[field] = choices[(_choice_index(choices, c[field]) + delta) % len(choices)]
        self._last = None
        self.adjustments += 1
        return self._response("configured")

    def _click(self, x: Any, y: Any) -> dict[str, Any]:
        if not (_is_integer(x) and _is_integer(y) and 0 <= x < SIZE and 0 <= y < SIZE):
            return self._response("ignored")
        for i in range(len(self._config)):
            q = fields(self._level, i)
            if not _inside(x, y, q["body"]):
                continue
            self.selected_receiver = i
            if _inside(x, y, q["size"]):
                return self._cycle("size")
            if _inside(x, y, q["filter"]):
                return self._cycle("color")
            if _inside(x, y, q["output"]) and self._level["receivers"][i]["mode"] == "paint":
                return self._cycle("output")
            return self._response("selected")
        return self._response("ignored")

    def _launch(self) -> dict[str, Any]:
        self.trials += 1
        played, level = self._index + 1, self._level
        sim = simulate(level, self._config)
        frames: list[Raster] = []
        timeline: list[dict[str, Any]] = []
        durations: list[int] = []
        ghosts: list[dict[str, Any]] = []

        def add(snap: dict[str, Any], kind: str, tick_number: int, ms: int = 45,
                options: dict[str, Any] | None = None, **extra: Any) -> None:
            frames.append(render(level, self._config, self.selected_receiver, self._completed, snap, options))
            durations.append(ms)
            timeline.append({"level": played, "kind": kind, "tick": tick_number, **extra})

        snapshots = sim["snapshots"]
        add(snapshots[0], "depart", 0, 140)
        for j in range(1, len(snapshots)):
            before, after = snapshots[j - 1], snapshots[j]
            for sub in range(1, 5):
                snap = after if sub == 4 else {**before, "fired": []}
                head = before["head"] + sub / 4
                visible_ghosts = [{**g, "age": (head - g["created"]) * 2}
                                  for g in ghosts if head - g["created"] < 2]
                add(snap, "travel", after["tick"], options={"head": head, "ghosts": visible_ghosts},
                    substep=sub, head=head, captured=snap["captured"], escaped=snap["escaped"],
                    events=copy.deepcopy(after["events"]) if sub == 4 else [])
            for event in after["events"]:
                if event["type"] == "capture":
                    ghosts.extend({"at": after["head"] - i, "color": event["color"], "created": after["head"]}
                                  for i in event["ids"])
        self._last = {"level": played, **{k: sim[k] for k in ("success", "captured", "total", "missed", "ticks")},
                      "events": copy.deepcopy(sim["events"]), "used": sim["final"]["used"][:]}
        result = copy.deepcopy(self._last)
        if sim["success"]:
            self._final_snapshot = copy.deepcopy(sim["final"])
            self._completed[self._index] = True
            for blink in range(3):
                for _ in range(5):
                    add(sim["final"], "success_on", sim["ticks"], 100, {"flash": 14}, blink=blink)
                for _ in range(3):
                    add(sim["final"], "success_off", sim["ticks"], 100, blink=blink)
            if self.test_mode or self._index + 1 >= self.win_levels:
                self.state = "WIN"
            else:
                self._setup(self._index + 1)
        else:
            add(sim["final"], "bilan", sim["ticks"], 350)
            for _ in range(3):
                add(sim["final"], "failure", sim["ticks"], 90, {"red": True})
        frames.append(self._render_frame())
        durations.append(75)
        timeline.append({"level": self._index + 1, "kind": "ready", "tick": 0})
        event = ("win" if self.state == "WIN" else "success") if sim["success"] else "failed_trial"
        return self._response(event, frames=frames, timeline=timeline, durations=durations,
                              result=result, played_level=played)

    def reset(self) -> dict[str, Any]:
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = False
        self.step_index = 0
        self.last_action = "RESET"
        self._setup(0)
        return self._response("reset")

    def level_reset(self) -> dict[str, Any]:
        self._completed[self._index] = False
        self._setup(self._index)
        self.last_action = "ACTION7"
        return self._response("restart")

    def action(self, action_id: int | str | Mapping[str, Any],
               data: dict[str, Any] | None = None) -> dict[str, Any]:
        aid, payload = _decode_action(action_id, data)
        if aid is None:
            return self._response("ignored")
        if aid == 0:
            return self.reset()
        if aid == 7:
            self.step_index += 1
            return self.level_reset()
        if self.state == "WIN" or not 1 <= aid <= 6:
            return self._response("ignored")
        self.step_index += 1
        self.last_action = f"ACTION{aid}"
        if aid in (1, 2):
            return self._cycle("color", 1 if aid == 1 else -1)
        if aid in (3, 4):
            return self._cycle("size", -1 if aid == 3 else 1)
        if aid == 5:
            return self._launch()
        return self._click(payload.get("x"), payload.get("y"))

    def jump_to_level(self, number: int, isolated: bool = True) -> dict[str, Any]:
        """Author preview only. Does not grant credit for preceding levels."""
        index = _integer(number, "level", 1, LEVEL_COUNT) - 1
        if not isolated and index >= self.win_levels:
            raise ValueError("Preview outside the configured campaign")
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = bool(isolated)
        self.step_index = 0
        self.last_action = "PREVIEW"
        self._setup(index)
        return self._response("test_level")

    def inspect(self) -> dict[str, Any]:
        """Copied creator state, not a native action or privileged agent input."""
        return {"index": self._index, "config": copy.deepcopy(self._config),
                "completed": self._completed[:], "trials": self.trials, "adjustments": self.adjustments,
                "steps": self.step_index, "state": self.state, "testMode": self.test_mode}

    def view(self) -> dict[str, Any]:
        """Human-viewer metadata; never predicts which configuration will win."""
        level = self._level
        return {"level": self._index + 1,
                **{key: level.get(key, "") for key in ("title", "chapter", "lesson", "hint")},
                "train": level["train"][:],
                "receivers": [{**copy.deepcopy(r), **copy.deepcopy(self._config[i]), "fields": fields(level, i)}
                              for i, r in enumerate(level["receivers"])],
                "selected": self.selected_receiver, "completed": self._completed[:], "state": self.state,
                "test_mode": self.test_mode, "trials": self.trials, "adjustments": self.adjustments,
                "result": copy.deepcopy(self._last)}

    def metadata(self) -> list[dict[str, Any]]:
        return [{"number": level["number"], "title": level["title"], "cubes": len(level["train"]),
                 "receivers": len(level["receivers"])} for level in self._templates]

    step = action
    observe = public_state
    levelReset = level_reset
    jumpToLevel = jump_to_level


# Public helper aliases ease comparisons with the original JavaScript, not agent dispatch.
HomogeneousPairEngine = HomogeneousPairDeletionEngine
colorIndicator = color_indicator
capacityIndicator = capacity_indicator
startSnapshot = start_snapshot
pathPoint = path_point
checkSettings = check_settings

__all__ = ["HomogeneousPairDeletionEngine", "HomogeneousPairEngine", "GAME_ID", "TITLE", "FAMILY", "WAVE",
           "VERSION", "WEB_VERSION", "DEFAULT_FPS", "SIZE", "FRAME", "PITCH", "LEVELS_DIR", "PALETTE",
           "COLOR_NAMES", "load_levels", "validate", "defaults", "check_settings", "topological", "fields",
           "color_indicator", "capacity_indicator", "start_snapshot", "tick", "simulate", "path_point", "render"]
