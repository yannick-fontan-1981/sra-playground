"""PRTL — Portails web v5 / custom_3, native deterministic Python engine.

ACTION1 jump, ACTION2 advance physics, ACTION3/4 walk left/right (six ticks).
ACTION5: drop if carrying, otherwise pick up a reachable crate, otherwise swap
portal colour. ACTION6: click a white panel, a colour button or the crate icon.
ACTION7: restart this chamber. reset()/RESET/0: restart the whole campaign.

Includes bidirectional portals, redirected momentum, automatic crate steps,
underfoot/airborne releases and autonomous loose-crate transfers. Crates do not
obstruct portal shots. Only walls/gates and the panel's exposed side do.

Python 3.10+, standard library only. Install the SIX original JSON files under
custom_games/games/portal_chambers/levels. No JavaScript, network, wall clock,
random generator, planner or creator witness is used by the runtime. Bodies use
fixed-point coordinates (256 units/pixel); observations use 64x64 palette grids.
"""
from __future__ import annotations

import copy
import json
import math
from collections.abc import Mapping
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

SIZE = FRAME = 64
LEVEL_COUNT = 6
Q = 256
DT = 6
G = 36
WALK = 180
JUMP = -660
MAX_FALL = 1100
ANIM_FPS = 24
GAME_ID = "prtl-c3000001"
FAMILY = "portal_chambers"
WAVE = "custom_3"
WEB_VERSION = "v5"
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / FAMILY / "levels"
ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE, ACTION_CLICK, ACTION_RESET = 5, 6, 7
PALETTE = (
    "#F3F2EB", "#C9CDC8", "#37404B", "#66707B", "#1B2028", "#11161C",
    "#B555B5", "#E7B9A3", "#F06B65", "#679DEB", "#63D5D6", "#F1CE62",
    "#EBA258", "#86513A", "#77CB93", "#BB94EB",
)
BUTTONS = {
    "blue": {"x": 3, "y": 1, "w": 10, "h": 5},
    "orange": {"x": 16, "y": 1, "w": 10, "h": 5},
    "use": {"x": 52, "y": 1, "w": 9, "h": 5},
}
Raster = list[list[int]]
Body = dict[str, Any]
Level = dict[str, Any]
Rect = Mapping[str, int | float]


def _integer(value: Any, name: str, lo: int, hi: int) -> int:
    if type(value) is not int or not lo <= value <= hi:
        raise ValueError(f"{name}: expected an integer in {lo}..{hi}, got {value!r}")
    return value


def _number(value: Any, name: str) -> int | float:
    if type(value) not in (int, float) or not math.isfinite(value):
        raise ValueError(f"{name}: expected a finite number, got {value!r}")
    return value


def _round(value: int | float) -> int:
    """Match JavaScript Math.round, including negative half-integers.

    Python round uses ties-to-even, which would change collision boundaries,
    momentum and individual pixels when porting the fixed-point simulation.
    """
    return math.floor(value + 0.5)


def _sign(value: int | float) -> int:
    return (value > 0) - (value < 0)


def _inside(x: int | float, y: int | float, r: Rect) -> bool:
    return r["x"] <= x < r["x"] + r["w"] and r["y"] <= y < r["y"] + r["h"]


def _intersects(a: Rect, b: Rect) -> bool:
    return (a["x"] < b["x"] + b["w"] and a["x"] + a["w"] > b["x"]
            and a["y"] < b["y"] + b["h"] and a["y"] + a["h"] > b["y"])


def _fill(buf: bytearray, x: int | float, y: int | float,
          w: int, h: int, color: int) -> None:
    x, y = _round(x), _round(y)
    left, right = max(0, x), min(SIZE, x + w)
    if right <= left:
        return
    stripe = bytes([color]) * (right - left)
    for yy in range(max(0, y), min(SIZE, y + h)):
        buf[yy * SIZE + left:yy * SIZE + right] = stripe


def _outline(buf: bytearray, x: int | float, y: int | float,
             w: int, h: int, color: int) -> None:
    _fill(buf, x, y, w, 1, color)
    _fill(buf, x, y + h - 1, w, 1, color)
    _fill(buf, x, y, 1, h, color)
    _fill(buf, x + w - 1, y, 1, h, color)


def _line(x0: float, y0: float, x1: float, y1: float) -> list[list[int]]:
    """Source's bounded integer line, shared by shot animation and pickup LOS."""
    x0, y0, x1, y1 = map(math.floor, (x0, y0, x1, y1))
    out = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    for _ in range(160):
        out.append([x0, y0])
        if x0 == x1 and y0 == y1:
            break
        e = 2 * err
        if e >= dy:
            err += dy
            x0 += sx
        if e <= dx:
            err += dx
            y0 += sy
    return out


def _body(body_id: str, x: float, y: float, w: int, h: int) -> Body:
    return {"id": body_id, "x": _round(x * Q), "y": _round(y * Q),
            "w": w, "h": h, "vx": 0, "vy": 0, "ground": False,
            "lock": None, "lockStep": -1, "carried": False}


def _box(body: Body) -> dict[str, int | float]:
    return {"x": body["x"] / Q - body["w"] / 2,
            "y": body["y"] / Q - body["h"] / 2,
            "w": body["w"], "h": body["h"]}


def panel_rect(panel: Mapping[str, Any]) -> dict[str, int]:
    if panel["nx"]:
        return {"x": panel["x"] + (-1 if panel["nx"] > 0 else 0),
                "y": panel["y"] - panel["length"] // 2, "w": 1, "h": panel["length"]}
    return {"x": panel["x"] - panel["length"] // 2,
            "y": panel["y"] + (-1 if panel["ny"] > 0 else 0),
            "w": panel["length"], "h": 1}


def validate_level(level: Level, label: str = "level") -> None:
    """Validate file schema without solving the map or changing its contents."""
    if not isinstance(level, dict):
        raise ValueError(f"{label}: expected a JSON object")
    if not isinstance(level.get("walls"), list) or not isinstance(level.get("panels"), list):
        raise ValueError(f"{label}: walls and panels lists are required")
    if len(level["panels"]) < 2:
        raise ValueError(f"{label}: at least two portal panels are required")
    seen: set[str] = set()
    for i, p in enumerate(level["panels"]):
        name = f"{label}.panels[{i}]"
        if not isinstance(p, dict) or not isinstance(p.get("id"), str) or not p["id"]:
            raise ValueError(f"{name}: expected a nonempty string id")
        if p["id"] in seen:
            raise ValueError(f"{name}: duplicate panel id {p['id']!r}")
        seen.add(p["id"])
        _integer(p.get("x"), name + ".x", 0, 64)
        _integer(p.get("y"), name + ".y", 7, 60)
        nx = _integer(p.get("nx"), name + ".nx", -1, 1)
        ny = _integer(p.get("ny"), name + ".ny", -1, 1)
        if abs(nx) + abs(ny) != 1:
            raise ValueError(f"{name}: normal must be cardinal and of unit length")
        _integer(p.get("length"), name + ".length", 6, 64)
        r = panel_rect(p)
        if r["x"] < 0 or r["y"] < 7 or r["x"] + r["w"] > 64 or r["y"] + r["h"] > 60:
            raise ValueError(f"{name}: panel is outside the play area")
    for group in ("walls", "glass", "gates", "hazards"):
        if not isinstance(level.get(group, []), list):
            raise ValueError(f"{label}.{group}: expected a list")
        for i, r in enumerate(level.get(group, [])):
            name = f"{label}.{group}[{i}]"
            if not isinstance(r, dict):
                raise ValueError(f"{name}: expected a rectangle")
            x = _integer(r.get("x"), name + ".x", 0, 63)
            y = _integer(r.get("y"), name + ".y", 7, 59)
            w = _integer(r.get("w"), name + ".w", 1, 64)
            h = _integer(r.get("h"), name + ".h", 1, 53)
            if x + w > 64 or y + h > 60:
                raise ValueError(f"{name}: rectangle exceeds the play area")
    start = level.get("player")
    if not isinstance(start, list) or len(start) != 2:
        raise ValueError(f"{label}.player: expected [x, y]")
    _number(start[0], label + ".player.x")
    _number(start[1], label + ".player.y")
    if not (1.5 <= start[0] <= 62.5 and 9 <= start[1] <= 58):
        raise ValueError(f"{label}.player: body exceeds the play area")
    exit_rect = level.get("exit")
    if not isinstance(exit_rect, dict):
        raise ValueError(f"{label}.exit: expected a rectangle")
    for key in ("x", "y", "w", "h"):
        _integer(exit_rect.get(key), f"{label}.exit.{key}", 1 if key in ("w", "h") else 0, 64)
    if exit_rect["x"] + exit_rect["w"] > 64 or exit_rect["y"] + exit_rect["h"] > 60:
        raise ValueError(f"{label}.exit: outside the play area")
    if not isinstance(level.get("cubes", []), list) or not isinstance(level.get("plates", []), list):
        raise ValueError(f"{label}: cubes and plates must be lists")
    for i, c in enumerate(level.get("cubes", [])):
        if not isinstance(c, list) or len(c) != 2:
            raise ValueError(f"{label}.cubes[{i}]: expected [x, y]")
        x, y = (_number(c[0], label + ".cube.x"), _number(c[1], label + ".cube.y"))
        if not (1.5 <= x <= 62.5 and 8.5 <= y <= 58.5):
            raise ValueError(f"{label}.cubes[{i}]: body exceeds play area")
    for i, p in enumerate(level.get("plates", [])):
        for k in ("x", "y", "w"):
            _integer(p.get(k), f"{label}.plates[{i}].{k}", 1 if k == "w" else 0, 64)
        if p["x"] + p["w"] > 64 or not 8 <= p["y"] <= 59:
            raise ValueError(f"{label}.plates[{i}]: outside play area")
    count = len(level.get("plates", []))
    for i, g in enumerate(level.get("gates", [])):
        if not isinstance(g.get("plates", []), list):
            raise ValueError(f"{label}.gates[{i}].plates: expected a list")
        for j in g.get("plates", []):
            _integer(j, f"{label}.gates[{i}].plate reference", 0, count - 1)


def _load_levels(directory: Path) -> list[Level]:
    result = []
    for number in range(1, LEVEL_COUNT + 1):
        path = directory / f"L{number:02d}.json"
        if not path.is_file():
            raise FileNotFoundError(f"Missing portal level {path}; install all six JSON files with the engine")
        try:
            level = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError(f"Cannot read level {path}: {exc}") from exc
        validate_level(level, str(path))
        result.append(level)
    return result


class PortalChambersEngine:
    """Custom-backend interface, following the FITE and other custom_3 engines.

    `info` provides game_id, title, family, levels and default_fps. JSON paths
    are resolved relative to this module, never to the working directory.
    `level_data` and `levels_dir` are optional author/testing overrides.
    """

    def __init__(self, info: CustomGameInfo, *, levels_dir: str | Path | None = None,
                 level_data: list[Level] | None = None) -> None:
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
        self._index = 0
        self.test_mode = False
        self._completed = [False] * LEVEL_COUNT
        self.state = "NOT_FINISHED"
        self.selected_portal = 0
        self.moves = self.shots = self.step_index = self.tick = self.attempts = 0
        self.last_action = "RESET"
        self._player: Body = {}
        self._cubes: list[Body] = []
        self._portals: list[str | None] = [None, None]
        self._gate_open: list[bool] = []
        self._plate_active: list[bool] = []
        self._events: list[dict[str, Any]] = []
        self._event = "ready"
        self._pending_frames: list[Raster] = []
        self._timeline: list[dict[str, Any]] = []
        self._setup(0)

    @property
    def _level(self) -> Level:
        return self._templates[self._index]

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    def _panel(self, panel_id: str | None) -> dict[str, Any] | None:
        return next((p for p in self._level["panels"] if p["id"] == panel_id), None)

    def _setup(self, index: int) -> None:
        self._index = index
        self.tick = self.moves = self.shots = 0
        self.selected_portal = 0
        self.state = "NOT_FINISHED"
        self._player = _body("player", *self._level["player"], 3, 4)
        self._player.update(facing=1, holding=None)
        self._cubes = [_body(f"cube{i}", c[0], c[1], 3, 3)
                       for i, c in enumerate(self._level.get("cubes", []))]
        self._portals = [None, None]
        self._plate_active = [False for _ in self._level.get("plates", [])]
        self._gate_open = [False for _ in self._level.get("gates", [])]
        self._refresh_gates()

    def _terrain(self) -> bytearray:
        mask = bytearray(SIZE * SIZE)
        rectangles = (self._level["walls"] + self._level.get("glass", [])
                      + [g for i, g in enumerate(self._level.get("gates", [])) if not self._gate_open[i]])
        for r in rectangles:
            _fill(mask, r["x"], r["y"], r["w"], r["h"], 1)
        return mask

    def _collide(self, body: Body, x: int, y: int, mask: bytearray,
                 ignore_bodies: bool = False) -> bool:
        r = {"x": x / Q - body["w"] / 2, "y": y / Q - body["h"] / 2,
             "w": body["w"], "h": body["h"]}
        if r["x"] < 0 or r["x"] + r["w"] > 64 or r["y"] < 7 or r["y"] + r["h"] > 60:
            return True
        for yy in range(math.floor(r["y"] + 0.0001), math.floor(r["y"] + r["h"] - 0.0001) + 1):
            for xx in range(math.floor(r["x"] + 0.0001), math.floor(r["x"] + r["w"] - 0.0001) + 1):
                if mask[yy * SIZE + xx]:
                    return True
        if not ignore_bodies:
            for c in [self._player, *self._cubes]:
                if c["id"] != body["id"] and not c["carried"] and _intersects(r, _box(c)):
                    return True
        return False

    def _refresh_gates(self) -> None:
        bodies = [self._player, *self._cubes]
        self._plate_active = [any(not b["carried"] and p["x"] <= b["x"] / Q <= p["x"] + p["w"]
                                  and abs(b["y"] / Q + b["h"] / 2 - p["y"]) <= 0.8 and b["vy"] >= 0
                                  for b in bodies) for p in self._level.get("plates", [])]
        old = self._gate_open
        self._gate_open = [all(self._plate_active[j] for j in g.get("plates", []))
                           or bool(old[i] and any(not b["carried"] and _intersects(_box(b), g) for b in bodies))
                           for i, g in enumerate(self._level.get("gates", []))]

    def _render_frame(self, *, ray: list[list[int]] | None = None, hide_player: bool = False,
                      flash: int | None = None, red: bool = False) -> Raster:
        f = bytearray([5]) * (SIZE * SIZE)
        _fill(f, 0, 7, 64, 53, 4)
        for r in self._level["walls"]:
            _fill(f, r["x"], r["y"], r["w"], r["h"], 2)
            if r["h"] >= 3:
                _fill(f, r["x"], r["y"], r["w"], 1, 3)
        for r in self._level.get("glass", []):
            _fill(f, r["x"], r["y"], r["w"], r["h"], 3)
            for y in range(r["y"], r["y"] + r["h"]):
                for x in range(r["x"], r["x"] + r["w"]):
                    if (x + y) % 3 == 0:
                        f[y * SIZE + x] = 10
        for r in self._level.get("hazards", []):
            _fill(f, r["x"], r["y"], r["w"], r["h"], 6)
            for x in range(r["x"], r["x"] + r["w"]):
                if (x + self.tick) % 3 == 0:
                    _fill(f, x, r["y"], 1, 1, 8)
        for i, p in enumerate(self._level.get("plates", [])):
            _fill(f, p["x"], p["y"] - 1, p["w"], 1, 14 if self._plate_active[i] else 11)
            _fill(f, p["x"], p["y"], p["w"], 1, 3)
        for i, g in enumerate(self._level.get("gates", [])):
            if self._gate_open[i]:
                _fill(f, g["x"], g["y"], 1, 1, 14)
                _fill(f, g["x"] + g["w"] - 1, g["y"] + g["h"] - 1, 1, 1, 14)
            else:
                _fill(f, g["x"], g["y"], g["w"], g["h"], 11)
                for y in range(g["y"], g["y"] + g["h"]):
                    for x in range(g["x"], g["x"] + g["w"]):
                        if (x + y) % 3 == 0:
                            f[y * SIZE + x] = 2
        for p in self._level["panels"]:
            r = panel_rect(p)
            _fill(f, r["x"], r["y"], r["w"], r["h"], 0)
        ex = self._level["exit"]
        _outline(f, ex["x"], ex["y"], ex["w"], ex["h"], 14)
        _fill(f, ex["x"] + 1, ex["y"] + 2, max(1, ex["w"] - 2), 1, 14)
        _fill(f, ex["x"] + 2, ex["y"] + 1, 1, 3, 14)
        for i, panel_id in enumerate(self._portals):
            p = self._panel(panel_id)
            if p is None:
                continue
            r, c = panel_rect(p), 9 if i == 0 else 12
            _fill(f, r["x"], r["y"], r["w"], r["h"], c)
            if p["nx"]:
                _fill(f, r["x"] + p["nx"], r["y"] + 1, 1, r["h"] - 2, c)
                _fill(f, r["x"] + p["nx"], r["y"] + 2, 1, r["h"] - 4, 5)
            else:
                _fill(f, r["x"] + 1, r["y"] + p["ny"], r["w"] - 2, 1, c)
                _fill(f, r["x"] + 2, r["y"] + p["ny"], r["w"] - 4, 1, 5)
        if ray is not None:
            for x, y in ray:
                _fill(f, x, y, 1, 1, 9 if self.selected_portal == 0 else 12)
        for c in self._cubes:
            if not c["carried"]:
                r = _box(c)
                x, y = _round(r["x"]), _round(r["y"])
                _fill(f, x, y, 3, 3, 1)
                _fill(f, x + 1, y + 1, 1, 1, 10)
        if not hide_player:
            r = _box(self._player)
            x, y = _round(r["x"]), _round(r["y"])
            _fill(f, x, y, 3, 1, 0)
            _fill(f, x, y + 1, 3, 2, 1)
            _fill(f, x, y + 3, 1, 1, 0)
            _fill(f, x + 2, y + 3, 1, 1, 0)
            _fill(f, x + (2 if self._player["facing"] > 0 else 0), y + 1, 1, 1,
                  9 if self.selected_portal == 0 else 12)
            if self._player["holding"] is not None:
                _fill(f, x + 1, y + 2, 1, 1, 10)
        _fill(f, 0, 0, 64, 7, 5)
        for i, key in enumerate(("blue", "orange")):
            r = BUTTONS[key]
            _fill(f, r["x"] + 1, r["y"] + 1, r["w"] - 2, r["h"] - 2, 9 if i == 0 else 12)
            if self.selected_portal == i:
                _outline(f, r["x"], r["y"], r["w"], r["h"], 0)
            _fill(f, r["x"] + 4, r["y"] + 2, 2, 1, 0 if self._portals[i] is not None else 5)
        u = BUTTONS["use"]
        _outline(f, u["x"], u["y"], u["w"], u["h"], 10 if self._player["holding"] is not None else 3)
        _fill(f, u["x"] + 3, u["y"] + 1, 3, 3, 1)
        _fill(f, u["x"] + 4, u["y"] + 2, 1, 1, 10)
        for i in range(LEVEL_COUNT):
            _fill(f, 2 + i * 5, 62, 4, 1, 14 if self._completed[i] else 2)
        for i, active in enumerate(self._plate_active):
            _fill(f, 57 - i * 3, 62, 2, 1, 14 if active else 11)
        if flash is not None:
            _outline(f, 0, 0, 64, 64, flash)
        if red:
            f[:] = bytes([8]) * (SIZE * SIZE)
        return [list(f[y * SIZE:(y + 1) * SIZE]) for y in range(SIZE)]

    def _push_frame(self, kind: str = "tick", **options: Any) -> None:
        self._pending_frames.append(self._render_frame(**options))
        self._timeline.append({"tick": self.tick, "level": self._index + 1, "kind": kind})

    def _succeed(self) -> None:
        self._completed[self._index] = True
        self._events.append({"type": "success", "level": self._index + 1, "tick": self.tick})
        for _ in range(3):
            self._push_frame("success", flash=14)
        self._push_frame("success")
        if self.test_mode or self._index == self.win_levels - 1:
            self.state = "WIN"
        else:
            self._setup(self._index + 1)
        self._push_frame("ready")
        self._event = "win" if self.state == "WIN" else "success"

    def _fail(self, reason: str) -> None:
        self._events.append({"type": "failure", "reason": reason, "level": self._index + 1, "tick": self.tick})
        self._push_frame("detected")
        for _ in range(3):
            self._push_frame("failure", red=True)
        self.attempts += 1
        self._setup(self._index)
        self._push_frame("reset")
        self._event = "failure"

    def _visible(self, p: Mapping[str, Any]) -> bool:
        sx, sy = self._player["x"] / Q, self._player["y"] / Q
        ex, ey = p["x"] + p["nx"] * 0.2, p["y"] + p["ny"] * 0.2
        if (sx - p["x"]) * p["nx"] + (sy - p["y"]) * p["ny"] <= 0:
            return False
        n = math.ceil(math.hypot(ex - sx, ey - sy) * 8)
        solids = self._level["walls"] + [g for i, g in enumerate(self._level.get("gates", []))
                                        if not self._gate_open[i]]
        for i in range(1, n + 1):
            t = i / n
            x, y = sx + (ex - sx) * t, sy + (ey - sy) * t
            if any(_inside(x, y, r) for r in solids):
                return False
        # v5: loose crates and cyan grilles are transparent to portal shots.
        return True

    def _release_lock(self, b: Body) -> None:
        if b["lock"] is None:
            return
        p = self._panel(b["lock"])
        if p is None:
            b["lock"] = None
            return
        d = (b["x"] / Q - p["x"]) * p["nx"] + (b["y"] / Q - p["y"]) * p["ny"]
        t = (b["x"] / Q - p["x"]) * -p["ny"] + (b["y"] / Q - p["y"]) * p["nx"]
        h = b["w"] / 2 if p["nx"] else b["h"] / 2
        inward = (b["vx"] * p["nx"] + b["vy"] * p["ny"] < 0
                  and b.get("lockStep") != self.step_index)
        if inward or d > h + 2 or abs(t) > p["length"] / 2 + 2:
            b["lock"] = None

    def _teleport(self, b: Body, nx: int, ny: int, mask: bytearray) -> bool:
        if b["carried"] or any(p is None for p in self._portals):
            return False
        for i in range(2):
            a, z = self._panel(self._portals[i]), self._panel(self._portals[1 - i])
            if a is None or z is None or b["lock"] == a["id"]:
                continue
            d0 = (b["x"] / Q - a["x"]) * a["nx"] + (b["y"] / Q - a["y"]) * a["ny"]
            d1 = (nx / Q - a["x"]) * a["nx"] + (ny / Q - a["y"]) * a["ny"]
            h = b["w"] / 2 if a["nx"] else b["h"] / 2
            off = (nx / Q - a["x"]) * -a["ny"] + (ny / Q - a["y"]) * a["nx"]
            ht = b["h"] / 2 if a["nx"] else b["w"] / 2
            if not (d0 >= h - 0.004 and d1 < h + 0.004 and d1 < d0
                    and abs(off) + ht <= a["length"] / 2 + 0.004):
                continue
            normal = b["vx"] * a["nx"] + b["vy"] * a["ny"]
            if normal >= 0:
                continue
            tangent = b["vx"] * -a["ny"] + b["vy"] * a["nx"]
            ho = b["w"] / 2 if z["nx"] else b["h"] / 2
            ht_out = b["h"] / 2 if z["nx"] else b["w"] / 2
            if abs(off) + ht_out > z["length"] / 2 + 0.004:
                continue
            xx = _round((z["x"] + z["nx"] * (ho + 0.06) + off * z["ny"]) * Q)
            yy = _round((z["y"] + z["ny"] * (ho + 0.06) - off * z["nx"]) * Q)
            if self._collide(b, xx, yy, mask):
                continue
            origin = {"x": b["x"] / Q, "y": b["y"] / Q}
            b["x"], b["y"] = xx, yy
            b["vx"] = _round(-normal * z["nx"] + tangent * z["ny"])
            b["vy"] = _round(-normal * z["ny"] - tangent * z["nx"])
            b["ground"], b["lock"], b["lockStep"] = False, z["id"], self.step_index
            if b["id"] == "player" and b["vx"]:
                self._player["facing"] = _sign(b["vx"])
            self._events.append({"type": "teleport", "entity": b["id"], "from": origin,
                                 "to": {"x": xx / Q, "y": yy / Q}, "entry": a["id"], "exit": z["id"],
                                 "vx": b["vx"] / Q, "vy": b["vy"] / Q, "tick": self.tick})
            self._push_frame("teleport")
            return True
        return False

    def _crate_supported(self, c: Body, mask: bytearray, seen: set[str] | None = None) -> bool:
        seen = seen or set()
        if c["carried"] or c["id"] in seen or c["vy"] != 0:
            return False
        next_seen = seen | {c["id"]}
        if self._collide(c, c["x"], c["y"] + 2, mask, True):
            return True
        rect = _box(c)
        probe = {**rect, "y": rect["y"] + 2 / Q}
        return any(other["id"] != c["id"] and not other["carried"]
                   and _box(other)["y"] >= rect["y"] + c["h"] - 2 / Q
                   and _intersects(probe, _box(other))
                   and self._crate_supported(other, mask, next_seen) for other in self._cubes)

    def _step_onto_crate(self, b: Body, nx: int, mask: bytearray) -> bool:
        """Treat stable crates as stairs, but never clip a ceiling or push weights."""
        if b["id"] != "player" or b["vy"] < 0:
            return False

        def at(x: int, y: int) -> dict[str, int | float]:
            return {"x": x / Q - b["w"] / 2, "y": y / Q - b["h"] / 2, "w": b["w"], "h": b["h"]}

        hit = [c for c in self._cubes if not c["carried"] and _intersects(at(nx, b["y"]), _box(c))]
        if not hit or any(not self._crate_supported(c, mask) for c in hit):
            return False
        top_y, highest = b["y"], None
        for _ in range(len(self._cubes) + 1):
            if not hit:
                break
            if any(not self._crate_supported(c, mask) for c in hit):
                return False
            for c in hit:
                y = c["y"] - (c["h"] + b["h"]) * Q // 2
                if y < top_y:
                    top_y, highest = y, c
            hit = [c for c in self._cubes if not c["carried"] and _intersects(at(nx, top_y), _box(c))]
        if hit or top_y >= b["y"] or highest is None:
            return False
        old_y = b["y"]
        for y in range(old_y, top_y, -64):
            if self._collide(b, b["x"], y, mask):
                return False
        if self._collide(b, b["x"], top_y, mask) or self._collide(b, nx, top_y, mask):
            return False
        origin = {"x": b["x"] / Q, "y": old_y / Q}
        b["vy"] = 0
        for y in range(old_y - Q, top_y, -Q):
            b["y"] = y
            self._push_frame("auto_step")
        b["y"] = top_y
        self._push_frame("auto_step")
        b["x"], b["ground"] = nx, True
        self._events.append({"type": "auto_step", "entity": "player", "cube": highest["id"],
                             "from": origin, "to": {"x": b["x"] / Q, "y": b["y"] / Q}, "tick": self.tick})
        self._push_frame("auto_step")
        return True

    def _axis(self, b: Body, dx: int, dy: int, mask: bytearray) -> bool:
        if not dx and not dy:
            return False
        xx, yy = b["x"] + dx, b["y"] + dy
        if self._teleport(b, xx, yy, mask):
            return True
        if not self._collide(b, xx, yy, mask):
            b["x"], b["y"] = xx, yy
            return False
        if dx and self._step_onto_crate(b, xx, mask):
            return False
        # Integer bisection to the last admissible point, as in web v5.
        low, high = 0, max(abs(dx), abs(dy))
        sx, sy = _sign(dx), _sign(dy)
        while low < high:
            middle = (low + high + 1) // 2
            if self._collide(b, b["x"] + sx * middle, b["y"] + sy * middle, mask):
                high = middle - 1
            else:
                low = middle
        b["x"] += sx * low
        b["y"] += sy * low
        if dx:
            b["vx"] = 0
        if dy:
            if dy > 0:
                b["ground"] = True
            b["vy"] = 0
        return False

    def _integrate(self, b: Body, mask: bytearray) -> None:
        b["ground"] = False
        b["vy"] = min(MAX_FALL, b["vy"] + G)
        self._release_lock(b)
        n = max(1, math.ceil(max(abs(b["vx"]), abs(b["vy"])) / 80))
        for j in range(n):
            # Velocities may change after a collision; recompute for each substep.
            dx = _round((j + 1) * b["vx"] / n) - _round(j * b["vx"] / n)
            dy = _round((j + 1) * b["vy"] / n) - _round(j * b["vy"] / n)
            if self._axis(b, dx, 0, mask) or self._axis(b, 0, dy, mask):
                break
        if b["id"] != "player" and b["ground"]:
            b["vx"] = 0

    def _check_outcome(self) -> bool:
        """Detection precedes success. Return True if this action must stop."""
        hazards = self._level.get("hazards", [])
        if (any(_intersects(_box(self._player), r) for r in hazards)
                or self._player["y"] / Q + self._player["h"] / 2 >= 59.99):
            self._fail("hazard")
            return True
        if any(not c["carried"] and any(_intersects(_box(c), r) for r in hazards) for c in self._cubes):
            self._fail("cube_lost")
            return True
        if self._player["ground"] and _intersects(_box(self._player), self._level["exit"]):
            self._succeed()
            return True
        return False

    def _advance(self, direction: int = 0, jump: bool = False) -> None:
        self.moves += 1
        start_level = self._index
        mask0 = self._terrain()
        p = self._player
        p["ground"] = self._collide(p, p["x"], p["y"] + 2, mask0)
        if jump and p["ground"]:
            p["vy"], p["ground"] = JUMP, False
            self._events.append({"type": "jump", "tick": self.tick})
        for _ in range(DT):
            self.tick += 1
            self._refresh_gates()
            mask = self._terrain()
            if direction:
                p["facing"] = direction
                if p["ground"] or abs(p["vx"]) <= WALK:
                    p["vx"] = direction * WALK
                elif _sign(p["vx"]) != direction:
                    p["vx"] += direction * 12
            elif p["ground"]:
                p["vx"] = 0
            # Ordinary commands: player first, then free crates in their fixed order.
            self._integrate(p, mask)
            for c in self._cubes:
                if not c["carried"]:
                    self._integrate(c, mask)
            self._refresh_gates()
            self._push_frame()
            if self._check_outcome() or self.state == "WIN" or self._index != start_level:
                return
        self._event = "move"

    def _release_position(self, c: Body, mask: bytearray) -> dict[str, Any] | None:
        """Release below the feet, raising only as required by real geometry.

        No cached ground flag is required. A reachable side placement is the
        fallback under a low ceiling, never an escape through a sealed wall.
        """
        p = self._player
        old_y, feet = p["y"], p["y"] + p["h"] * Q // 2

        def crate_free(x: int, y: int) -> bool:
            r = {"x": x / Q - c["w"] / 2, "y": y / Q - c["h"] / 2, "w": c["w"], "h": c["h"]}
            return (not self._collide(c, x, y, mask, True)
                    and not any(o["id"] != c["id"] and not o["carried"] and _intersects(r, _box(o))
                                for o in self._cubes))

        for rise in range(c["h"] * Q + 1):
            y = feet + c["h"] * Q // 2 - rise
            if not crate_free(p["x"], y):
                continue
            py = min(old_y, y - (c["h"] + p["h"]) * Q // 2)
            clear = True
            for yy in range(old_y, py, -64):
                if self._collide(p, p["x"], yy, mask):
                    clear = False
                    break
            if clear and not self._collide(p, p["x"], py, mask):
                return {"x": p["x"], "y": y, "playerY": py,
                        "placement": "underfoot" if py < old_y else "released_below"}
            break
        for distance in range((c["w"] + p["w"]) * Q // 2, 6 * Q + 1, Q // 2):
            for sign in (p["facing"], -p["facing"]):
                x, y = p["x"] + sign * distance, feet - c["h"] * Q // 2
                if not crate_free(x, y):
                    continue
                clear = True
                for t in range(0, distance + 1, 64):
                    xx = p["x"] + sign * t
                    yy = p["y"] + _round((y - p["y"]) * t / distance)
                    if not crate_free(xx, yy):
                        clear = False
                        break
                if clear:
                    return {"x": x, "y": y, "playerY": old_y, "placement": "beside"}
        return None

    def _on_floor_portal(self, c: Body) -> bool:
        if c["carried"] or any(p is None for p in self._portals):
            return False
        for panel_id in self._portals:
            p = self._panel(panel_id)
            if p is None or p["ny"] != -1:
                continue
            if c["lock"] == panel_id and c.get("lockStep") == self.step_index:
                continue
            feet = c["y"] / Q + c["h"] / 2
            off = abs(c["x"] / Q - p["x"])
            if abs(feet - p["y"]) <= 2 / Q and off + c["w"] / 2 <= p["length"] / 2 + 0.004:
                return True
        return False

    def _settle_cubes(self, targets: list[Body], kind: str) -> None:
        starting_level = self._index
        for _ in range(128):
            self.tick += 1
            self._refresh_gates()
            mask = self._terrain()
            # Preserve JS identity semantics, not Python dict-value equality.
            order = targets + [c for c in self._cubes if not any(c is t for t in targets)]
            for c in order:
                if not c["carried"]:
                    self._integrate(c, mask)
            p = self._player
            p["ground"] = self._collide(p, p["x"], p["y"] + 2, mask)
            if p["ground"]:
                p["vx"] = 0
            self._integrate(p, mask)
            self._refresh_gates()
            self._push_frame(kind)
            if self._check_outcome() or self.state == "WIN" or self._index != starting_level:
                return
            if all(c["ground"] for c in targets):
                for c in targets:
                    self._events.append({"type": "cube_landed", "entity": c["id"],
                                         "x": c["x"] / Q, "y": c["y"] / Q, "tick": self.tick})
                return
        # Bound only the automatic reaction, not future commanded physics.

    def _settle_released(self, c: Body) -> None:
        if c["ground"] and not self._on_floor_portal(c):
            return
        self._settle_cubes([c], "drop_fall")

    def _settle_portal_weights(self) -> None:
        targets = [c for c in self._cubes if self._on_floor_portal(c)]
        if targets:
            self._settle_cubes(targets, "portal_weight")

    def _nearest_pickable(self) -> tuple[int, Body] | None:
        mask, p = self._terrain(), self._player
        near = [(math.hypot((c["x"] - p["x"]) / Q, (c["y"] - p["y"]) / Q), i, c)
                for i, c in enumerate(self._cubes) if not c["carried"]]
        near = sorted((d, i, c) for d, i, c in near if d <= 6)
        for _, i, c in near:
            cells = _line(p["x"] / Q, p["y"] / Q, c["x"] / Q, c["y"] / Q)[1:-1]
            if not any(0 <= x < SIZE and 0 <= y < SIZE and mask[y * SIZE + x] for x, y in cells):
                return i, c
        return None

    def _space_action(self) -> str:
        if self._player["holding"] is not None:
            return "drop"
        return "pickup" if self._nearest_pickable() is not None else "select"

    def _interact(self) -> None:
        p = self._player
        if p["holding"] is not None:
            c, mask = self._cubes[p["holding"]], self._terrain()
            spot = self._release_position(c, mask)
            if spot is None:
                self._event = "blocked_drop"
                self._push_frame("blocked", flash=6)
                return
            old_y = p["y"]
            if spot["playerY"] < old_y:
                p["vx"] = p["vy"] = 0
                for y in range(old_y - Q, spot["playerY"], -Q):
                    p["y"] = y
                    self._push_frame("step_up")
                p["y"] = spot["playerY"]
                self._push_frame("step_up")
            c.update(x=spot["x"], y=spot["y"], vx=0, vy=0, lock=None, lockStep=-1, carried=False)
            p["holding"] = None
            c["ground"] = self._collide(c, c["x"], c["y"] + 2, mask)
            p["ground"] = self._collide(p, p["x"], p["y"] + 2, mask)
            self._events.append({"type": "drop", "entity": c["id"], "placement": spot["placement"],
                                 "x": c["x"] / Q, "y": c["y"] / Q, "player_y": p["y"] / Q, "tick": self.tick})
            self._event = "drop"
            self._refresh_gates()
            self._push_frame("placed_cube")
            self._settle_released(c)
            return
        nearest = self._nearest_pickable()
        if nearest is not None:
            i, c = nearest
            p["holding"], c["carried"] = i, True
            self._events.append({"type": "pickup", "entity": c["id"]})
            self._event = "pickup"
            self._refresh_gates()
            self._push_frame()
            return
        self._event = "nothing_to_pick"

    def _contextual_action(self) -> None:
        if self._space_action() == "select":
            self.selected_portal = 1 - self.selected_portal
            self._event = "select"
        else:
            self._interact()

    def _click(self, x: Any, y: Any) -> None:
        if type(x) is not int or type(y) is not int or not 0 <= x < SIZE or not 0 <= y < SIZE:
            self._event = "ignored"
            return
        for i, key in enumerate(("blue", "orange")):
            if _inside(x, y, BUTTONS[key]):
                self.selected_portal = i
                self._event = "select"
                return
        if _inside(x, y, BUTTONS["use"]):
            self._interact()
            return
        candidates = []
        for p in self._level["panels"]:
            r = panel_rect(p)
            target = {"x": r["x"] - 1, "y": r["y"] - 1, "w": r["w"] + 2, "h": r["h"] + 2}
            if _inside(x, y, target):
                candidates.append(p)
        # Python's sort is stable, like the source: input order breaks exact ties.
        candidates.sort(key=lambda p: math.hypot(p["x"] - x, p["y"] - y))
        if not candidates:
            self._event = "invalid_surface"
            self._push_frame("blocked", flash=6)
            return
        p = candidates[0]
        if not self._visible(p):
            self._event = "occluded"
            self._push_frame("blocked", flash=6)
            return
        if self._portals[1 - self.selected_portal] == p["id"]:
            self._event = "portal_overlap"
            return
        ray = _line(self._player["x"] / Q, self._player["y"] / Q,
                    p["x"] + p["nx"] * 0.2, p["y"] + p["ny"] * 0.2)
        for k in range(1, 5):
            self._push_frame("shot", ray=ray[:math.ceil(len(ray) * k / 4)])
        self._portals[self.selected_portal] = p["id"]
        self.shots += 1
        self._events.append({"type": "place", "color": "blue" if self.selected_portal == 0 else "orange",
                             "panel": p["id"], "tick": self.tick})
        self._event = "place"
        self._push_frame("placed")
        self._settle_portal_weights()

    def _start_action(self) -> None:
        self._events = []
        self._pending_frames = []
        self._timeline = []
        self._event = "ignored"

    def action(self, action_id: int | str | Mapping[str, Any],
               data: Mapping[str, Any] | None = None) -> dict[str, Any]:
        """Execute one native input and return all resulting animation frames."""
        if isinstance(action_id, Mapping):
            packet = action_id
            data = packet.get("data")
            action_id = packet.get("id") if packet.get("id") is not None else packet.get("action")
        if action_id == "RESET" or (type(action_id) is int and action_id == 0):
            return self.reset()
        if isinstance(action_id, str) and action_id in {f"ACTION{i}" for i in range(1, 8)}:
            action_id = int(action_id[6:])
        if type(action_id) is int and action_id == ACTION_RESET:
            self.step_index += 1
            return self.level_reset()
        self._start_action()
        if self.state == "WIN":
            self._event = "finished"
            return self.public_state()
        if type(action_id) is not int or not 1 <= action_id <= 6:
            return self.public_state()
        self.step_index += 1
        self.last_action = f"ACTION{action_id}"
        if action_id == ACTION_CLICK:
            payload = data if isinstance(data, Mapping) else {}
            self._click(payload.get("x"), payload.get("y"))
        elif action_id == ACTION_SPACE:
            self._contextual_action()
        else:
            self._advance(-1 if action_id == ACTION_LEFT else 1 if action_id == ACTION_RIGHT else 0,
                          action_id == ACTION_UP)
        return self.public_state()

    def reset(self) -> dict[str, Any]:
        self._start_action()
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = False
        self.attempts = self.step_index = 0
        self.last_action = "RESET"
        self._setup(0)
        self._event = "reset"
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        """Soft reset. Direct method calls do not add an input to step_index."""
        self._start_action()
        self.attempts += 1
        self._completed[self._index] = False
        self.last_action = "ACTION7"
        self._setup(self._index)
        self._event = "restart"
        return self.public_state()

    def public_state(self) -> dict[str, Any]:
        """Consume pending animation once; subsequent reads do not advance time.

        This is the custom backend envelope: frame is 2D and frames is 3D.
        For transports expecting a 3D 'frame', forward 'frames' as that field.
        Source levels, solution routes and human lesson text are not included.
        """
        frames = self._pending_frames or [self._render_frame()]
        timeline = self._timeline or [{"tick": self.tick, "level": self._index + 1, "kind": self._event}]
        events = copy.deepcopy(self._events)
        self._pending_frames, self._timeline, self._events = [], [], []
        ids = [7] if self.state == "WIN" else list(range(1, 8))
        score = self.levels_completed
        return {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "custom_family": self.info.family, "wave": WAVE,
            "frame": frames[-1], "frames": frames, "frame_count": len(frames),
            "default_fps": max(self._fps, ANIM_FPS) if len(frames) > 1 else self._fps,
            "state": self.state, "level": self._index + 1,
            "score": score, "levels_completed": score,
            "win_levels": 1 if self.test_mode else self.win_levels,
            "win_score": 1 if self.test_mode else self.win_levels,
            "test_mode": self.test_mode, "step_index": self.step_index, "last_action": self.last_action,
            "tick": self.tick, "selected_portal": self.selected_portal,
            "moves": self.moves, "shots": self.shots,
            "carrying": self._player["holding"] is not None,
            "available_actions": [f"ACTION{i}" for i in ids], "available_action_ids": ids,
            "full_reset": False, "source_path": str(self.levels_dir),
            "level_name": self._level.get("title", f"L{self._index + 1:02d}"),
            "timeline": timeline, "events": events, "event": self._event,
        }

    def jump_to_level(self, number: int) -> dict[str, Any]:
        """Author/human preview only, not an available action for an evaluated agent."""
        _integer(number, "level", 1, len(self._templates))
        self._start_action()
        self.test_mode = True
        self._completed = [False] * LEVEL_COUNT
        self.step_index = self.attempts = 0
        self.last_action = "PREVIEW"
        self._setup(number - 1)
        self._event = "preview"
        return self.public_state()

    def view(self) -> dict[str, Any]:
        """Optional human viewer state, including source's human-only lesson text."""
        v = {"level": self._index + 1, "title": self._level.get("title", "Portails"),
             "space_action": self._space_action(), "selected": self.selected_portal,
             "portals": [copy.deepcopy(self._panel(p)) for p in self._portals],
             "carrying": self._player["holding"] is not None,
             "plates": self._plate_active[:], "gates": self._gate_open[:],
             "moves": self.moves, "shots": self.shots, "tick": self.tick,
             "state": self.state, "testMode": self.test_mode, "attempts": self.attempts,
             "completed": self._completed[:],
             "player": {"x": self._player["x"] / Q, "y": self._player["y"] / Q},
             "panels": [{**copy.deepcopy(p), "rect": panel_rect(p)} for p in self._level["panels"]]}
        for key in ("note", "lesson"):
            if key in self._level:
                v[key] = self._level[key]
        return v

    def metadata(self) -> list[dict[str, Any]]:
        return [{"number": i + 1, "title": l.get("title", "Portails")} for i, l in enumerate(self._templates)]

    def inspect(self) -> dict[str, Any]:
        """Creator/debug state. Do not add this to an agent's observations."""
        return {"level": self._index + 1, "player": copy.deepcopy(self._player),
                "cubes": copy.deepcopy(self._cubes), "portals": self._portals[:],
                "plates": self._plate_active[:], "gates": self._gate_open[:],
                "tick": self.tick, "state": self.state}

    def debug_load(self, patch: Mapping[str, Any]) -> dict[str, Any]:
        """Creator test fixture loader; absent from available_actions."""
        if patch.get("player") is not None:
            self._player.update(copy.deepcopy(patch["player"]))
        if patch.get("portals") is not None:
            self._portals = copy.deepcopy(patch["portals"])
        if patch.get("cubes") is not None:
            self._cubes = copy.deepcopy(patch["cubes"])
        self._refresh_gates()
        return self.public_state()

    step = action
    observe = public_state
    levelReset = level_reset
    jumpToLevel = jump_to_level
    debugLoad = debug_load


# French-facing alias, same class and same implementation (not a second engine).
PortailsEngine = PortalChambersEngine

__all__ = [
    "PortalChambersEngine", "PortailsEngine", "GAME_ID", "FAMILY", "WAVE", "WEB_VERSION",
    "SIZE", "FRAME", "LEVEL_COUNT", "LEVELS_DIR", "ANIM_FPS", "PALETTE", "BUTTONS",
    "Q", "DT", "G", "WALK", "JUMP", "MAX_FALL", "ACTION_UP", "ACTION_DOWN",
    "ACTION_LEFT", "ACTION_RIGHT", "ACTION_SPACE", "ACTION_CLICK", "ACTION_RESET",
    "panel_rect", "validate_level",
]
