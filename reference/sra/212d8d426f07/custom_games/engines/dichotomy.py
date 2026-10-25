"""DICO — Dichotomie, lampes en série (custom_3, web revision v2).

Deterministic Python port of the accepted web engine. The custom-backend
interface follows the supplied FITE example and the Grillage Python port.

ACTION6: click a lamp or a native toolbar button (integer pixels 0..63).
ACTION7 / level_reset(): restart the current level, preserving earlier wins.
reset() / action(0): restart the complete campaign.

A normal pushbutton bypasses its lamp; the faulty bypass opens the circuit.
Testing costs one attempt. Subdivision, parent and root navigation are free.
A positive test wins ONLY if the pressed set contains exactly one lamp,
including a singleton zone or a completely isolated leaf. Animation frames
show the test and release. No randomness, real-time simulation or auto-solver.

The engine returns palette indices, not RGB: frame is [64][64], frames is
[images][64][64]. The position of the fault is never in the public state.
"""

from __future__ import annotations

import copy
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

FRAME = 64
LEVEL_COUNT = 6
GAME_ID = "dico-c3000001"
WAVE = "custom_3"
WEB_REVISION = "v2"
ANIM_FPS = 16
ACTION_CLICK, ACTION_RESET = 6, 7
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "dichotomy" / "levels"

C_WHITE, C_LGREY, C_MGREY, C_DGREY = 0, 1, 2, 3
C_HUD, C_BLACK, C_RED = 4, 5, 8
C_CYAN, C_YELLOW, C_ORANGE, C_GREEN, C_VIOLET = 10, 11, 12, 14, 15

# Reference web colours for a standalone viewer. The host may use its palette.
PALETTE = (
    "#F3F2EB", "#C9CDC8", "#37404B", "#66707B", "#1B2028", "#11161C",
    "#614439", "#E7B9A3", "#F06B65", "#679DEB", "#63D5D6", "#F1CE62",
    "#EBA258", "#86513A", "#77CB93", "#BB94EB",
)
Raster = list[list[int]]


@dataclass(frozen=True)
class Rect:
    x: int
    y: int
    w: int
    h: int

    def contains(self, x: int, y: int) -> bool:
        return self.x <= x < self.x + self.w and self.y <= y < self.y + self.h


# Technical names retained for parity with the web source; no A/B glyph is drawn.
BUTTONS = {
    "probeA": Rect(1, 1, 12, 5),
    "focusA": Rect(14, 1, 6, 5),
    "probeB": Rect(22, 1, 12, 5),
    "focusB": Rect(35, 1, 6, 5),
    "parent": Rect(43, 1, 8, 5),
    "root": Rect(53, 1, 10, 5),
}


@dataclass(frozen=True)
class Region:
    col: int
    row: int
    cols: int
    rows: int

    @property
    def size(self) -> int:
        return self.cols * self.rows

    def members(self, board_cols: int) -> list[int]:
        return [row * board_cols + col
                for row in range(self.row, self.row + self.rows)
                for col in range(self.col, self.col + self.cols)]


def split(region: Region, tie_axis: str = "vertical") -> tuple[Region, ...]:
    """Split the longest dimension; an odd size gives the second zone the extra."""
    if region.size < 2:
        return ()
    vertical = region.rows == 1 or (
        region.cols > 1 and (
            region.cols > region.rows or
            (region.cols == region.rows and tie_axis == "vertical")
        )
    )
    if vertical:
        n = region.cols // 2
        return (Region(region.col, region.row, n, region.rows),
                Region(region.col + n, region.row, region.cols - n, region.rows))
    n = region.rows // 2
    return (Region(region.col, region.row, region.cols, n),
            Region(region.col, region.row + n, region.cols, region.rows - n))


@dataclass(frozen=True)
class LevelConfig:
    number: int
    name: str
    cols: int
    rows: int
    fault: int = field(repr=False)
    budget: int = 5
    tie_axis: str = "vertical"

    @property
    def lamp_count(self) -> int:
        return self.cols * self.rows


@dataclass(frozen=True)
class Geometry:
    pitch: int
    bulb: int
    x: int
    y: int
    inset: int


def make_geometry(cfg: LevelConfig) -> Geometry:
    pitch = min(12, 60 // cfg.cols, 54 // cfg.rows)
    if pitch < 3:
        raise ValueError("The lamp pitch must be at least 3 pixels in a 64x64 frame")
    bulb = 7 if pitch >= 10 else 3 if pitch >= 6 else 2
    return Geometry(pitch, bulb, (FRAME - cfg.cols * pitch) // 2,
                    7 + (54 - cfg.rows * pitch) // 2, (pitch - bulb) // 2)


@dataclass
class LevelState:
    cfg: LevelConfig
    level_index: int
    focus: Region
    tests_left: int
    geometry: Geometry
    tests_used: int = 0
    parents: list[Region] = field(default_factory=list)
    path: list[str] = field(default_factory=list)
    selected: dict[str, Any] | None = None
    last_result: dict[str, Any] | None = None
    history: list[dict[str, Any]] = field(default_factory=list)


def _integer(value: Any, label: str, low: int, high: int) -> int:
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"{label}: expected an integer from {low} to {high}, got {value!r}")
    return value


def _load_level(path: Path) -> LevelConfig:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("expected a JSON object")
        number = _integer(data["number"], "number", 1, LEVEL_COUNT)
        cols = _integer(data["cols"], "cols", 2, 20)
        rows = _integer(data["rows"], "rows", 1, 18)
        fault = _integer(data["fault"], "fault", 0, cols * rows - 1)
        budget = _integer(data["budget"], "budget", 1, 11)
        name = data["title"]
        if not isinstance(name, str) or not name.strip():
            raise ValueError("title must be a non-empty string")
        tie_axis = data.get("tie_axis") or "vertical"
        if tie_axis not in ("vertical", "horizontal"):
            raise ValueError("tie_axis must be vertical or horizontal")
        cfg = LevelConfig(number, name, cols, rows, fault, budget, tie_axis)
        make_geometry(cfg)
        return cfg
    except (OSError, UnicodeError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Invalid level file {path}: {exc}") from exc


def _load_all_levels(directory: Path) -> tuple[LevelConfig, ...]:
    paths = sorted(directory.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"No level files in {directory}; copy L01.json to L06.json too")
    levels = tuple(_load_level(path) for path in paths)
    if len(levels) != LEVEL_COUNT or [cfg.number for cfg in levels] != list(range(1, 7)):
        raise ValueError("Expected exactly six level files numbered 1 through 6")
    return levels


def _fill(frame: Raster, x: int, y: int, w: int, h: int, color: int) -> None:
    left, right = max(0, x), min(FRAME, x + w)
    if right <= left:
        return
    for yy in range(max(0, y), min(FRAME, y + h)):
        frame[yy][left:right] = [color] * (right - left)


def _outline(frame: Raster, rect: Rect, color: int) -> None:
    _fill(frame, rect.x, rect.y, rect.w, 1, color)
    _fill(frame, rect.x, rect.y + rect.h - 1, rect.w, 1, color)
    _fill(frame, rect.x, rect.y, 1, rect.h, color)
    _fill(frame, rect.x + rect.w - 1, rect.y, 1, rect.h, color)


def dotted_pixels(rect: Rect, phase: int = 0) -> tuple[tuple[int, int], ...]:
    """Absolute checker parity separates cyan/violet, including shared corners."""
    points: dict[tuple[int, int], None] = {}

    def add(x: int, y: int) -> None:
        if 0 <= x < FRAME and 0 <= y < FRAME and ((x + y) & 1) == phase:
            points[(x, y)] = None

    for x in range(rect.x, rect.x + rect.w):
        add(x, rect.y)
        add(x, rect.y + rect.h - 1)
    for y in range(rect.y, rect.y + rect.h):
        add(rect.x, y)
        add(rect.x + rect.w - 1, y)
    return tuple(points)


def _dotted(frame: Raster, rect: Rect, color: int, phase: int = 0) -> None:
    for x, y in dotted_pixels(rect, phase):
        frame[y][x] = color


def _pushbutton(frame: Raster, rect: Rect, color: int,
                selected: bool = False, pressed: bool = False) -> None:
    # One-pixel cut corners, black rim, no font or anti-aliasing.
    _fill(frame, rect.x + 1, rect.y, rect.w - 2, rect.h, C_BLACK)
    _fill(frame, rect.x, rect.y + 1, rect.w, rect.h - 2, C_BLACK)
    _fill(frame, rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, color)
    if pressed:
        _fill(frame, rect.x + 1, rect.y + 1, rect.w - 2, 1, C_MGREY)
    if selected:
        _fill(frame, rect.x + rect.w // 2 - 1, rect.y + rect.h - 2, 2, 1, C_WHITE)


class DichotomyEngine:
    """Engine for the host's CustomGameInfo, without replacing its registry.

    ``info`` provides levels, game_id, title, family and default_fps.
    ``levels_dir`` is an optional author/test override. A normal campaign
    has six levels; info.levels may select a shorter leading prefix.
    """

    def __init__(self, info: CustomGameInfo, *, levels_dir: str | Path | None = None) -> None:
        self.info = info
        self.levels_dir = Path(levels_dir).resolve() if levels_dir is not None else LEVELS_DIR
        self._templates = _load_all_levels(self.levels_dir)
        self.win_levels = _integer(info.levels, "info.levels", 1, LEVEL_COUNT)
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._attempts = 0
        self._event = "reset"
        self._extra: dict[str, Any] = {}
        self._pending_frames: list[Raster] | None = None
        self._level = self._new_level_state(0)

    def _new_level_state(self, index: int) -> LevelState:
        cfg = self._templates[index]
        return LevelState(cfg, index, Region(0, 0, cfg.cols, cfg.rows),
                          cfg.budget, make_geometry(cfg))

    def reset(self) -> dict[str, Any]:
        """Reset the campaign, counters and focus without changing any target."""
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._attempts = 0
        self._event = "reset"
        self._extra = {}
        self._pending_frames = None
        self._level = self._new_level_state(0)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        """Restart the current level; ACTION7 also works after final WIN.

        Like web v2, a level reset counts as one command (not a paid test).
        A restart after WIN removes only the last level's completion.
        """
        index = self._level.level_index
        self.levels_completed = index
        self.step_index += 1
        self.last_action = "ACTION7"
        self.state = "NOT_FINISHED"
        self._attempts += 1
        self._event = "restart"
        self._extra = {}
        self._pending_frames = None
        self._level = self._new_level_state(index)
        return self.public_state()

    def _regions(self) -> tuple[Region, ...]:
        return split(self._level.focus, self._level.cfg.tie_axis)

    def _probe_region(self, branch: int) -> Region | None:
        regions = self._regions()
        if regions:
            return regions[branch] if 0 <= branch < len(regions) else None
        lv = self._level
        owner = 1 if lv.path and lv.path[-1] == "B" else 0
        return lv.focus if lv.focus.size == 1 and branch == owner else None

    def _contours(self) -> tuple[tuple[Region, int], ...]:
        regions = self._regions()
        if regions:
            return tuple((region, i) for i, region in enumerate(regions))
        lv = self._level
        return ((lv.focus, 1 if lv.path and lv.path[-1] == "B" else 0),)

    def _lamp_rect(self, lamp_id: int) -> Rect:
        cfg, g = self._level.cfg, self._level.geometry
        return Rect(g.x + (lamp_id % cfg.cols) * g.pitch + g.inset,
                    g.y + (lamp_id // cfg.cols) * g.pitch + g.inset, g.bulb, g.bulb)

    def _region_rect(self, region: Region) -> Rect:
        cols = self._level.cfg.cols
        first = self._lamp_rect(region.row * cols + region.col)
        last = self._lamp_rect((region.row + region.rows - 1) * cols + region.col + region.cols - 1)
        return Rect(first.x - 1, first.y - 1,
                    last.x + last.w - first.x + 2, last.y + last.h - first.y + 2)

    def _draw_lamp(self, frame: Raster, lamp_id: int, is_off: bool) -> None:
        r = self._lamp_rect(lamp_id)
        n = r.w
        if n == 2:
            _fill(frame, r.x, r.y, 2, 2, C_MGREY if is_off else C_YELLOW)
            _fill(frame, r.x, r.y + 1, 1, 1, C_DGREY if is_off else C_ORANGE)
        elif n == 3:
            _fill(frame, r.x + 1, r.y, 1, 1, C_MGREY if is_off else C_YELLOW)
            _fill(frame, r.x, r.y + 1, 3, 1, C_MGREY if is_off else C_YELLOW)
            _fill(frame, r.x + 1, r.y + 2, 1, 1, C_DGREY if is_off else C_ORANGE)
        else:
            _fill(frame, r.x + 1, r.y, n - 2, n - 2, C_MGREY if is_off else C_ORANGE)
            _fill(frame, r.x, r.y + 1, n, n - 4, C_MGREY if is_off else C_ORANGE)
            _fill(frame, r.x + 2, r.y + 1, n - 4, n - 4, C_DGREY if is_off else C_YELLOW)
            _fill(frame, r.x + 2, r.y + n - 2, n - 4, 2, C_MGREY if is_off else C_DGREY)

    def _render_frame(self, *, off: list[int] | set[int] | None = None,
                      border: int | None = None, red: bool = False) -> Raster:
        """Pixel-exact v2 render, independent of the target except during tests."""
        if red:
            return [[C_RED] * FRAME for _ in range(FRAME)]
        lv, cfg = self._level, self._level.cfg
        g = lv.geometry
        regions = self._regions()
        dark = set(off or ())
        frame = [[C_BLACK] * FRAME for _ in range(FRAME)]
        _fill(frame, 0, 0, 64, 7, C_HUD)
        # Identical neutral wiring for every possible position of the fault.
        for row in range(cfg.rows):
            first = self._lamp_rect(row * cfg.cols)
            last = self._lamp_rect(row * cfg.cols + cfg.cols - 1)
            yy = first.y + g.bulb // 2
            _fill(frame, first.x, yy, last.x - first.x + last.w, 1, C_MGREY)
            if row < cfg.rows - 1:
                xx = (last if row % 2 == 0 else first).x + g.bulb // 2
                _fill(frame, xx, yy, 1, g.pitch + 1, C_MGREY)
        for lamp_id in range(cfg.lamp_count):
            self._draw_lamp(frame, lamp_id, lamp_id in dark)
        if lv.parents:
            _dotted(frame, self._region_rect(lv.focus), C_DGREY)
        for region, branch in self._contours():
            _dotted(frame, self._region_rect(region),
                    C_CYAN if branch == 0 else C_VIOLET, 1 if branch == 0 else 0)
        selected = lv.selected
        if selected and selected["kind"] == "lamp":
            r = self._lamp_rect(selected["id"])
            _outline(frame, Rect(r.x - 1, r.y - 1, r.w + 2, r.h + 2), C_WHITE)
        # Zone selection is marked on its button, never over the coloured dashes.
        for branch, key in enumerate(("A", "B")):
            color = C_CYAN if branch == 0 else C_VIOLET
            marked = bool(selected and selected["kind"] == "zone" and selected["branch"] == branch)
            _pushbutton(frame, BUTTONS["probe" + key],
                        color if self._probe_region(branch) is not None else C_MGREY,
                        marked, bool(dark) and marked)
            r = BUTTONS["focus" + key]
            glyph_color = color if branch < len(regions) else C_MGREY
            _outline(frame, r, glyph_color)
            _fill(frame, r.x, r.y + r.h // 2, r.w, 1, glyph_color)
        back, home = BUTTONS["parent"], BUTTONS["root"]
        color = C_LGREY if lv.parents else C_MGREY
        _fill(frame, back.x + 3, back.y, 1, 1, color)
        _fill(frame, back.x + 2, back.y + 1, 3, 1, color)
        _fill(frame, back.x + 1, back.y + 2, 5, 1, color)
        _fill(frame, back.x + 3, back.y + 3, 1, 2, color)
        _outline(frame, home, color)
        _outline(frame, Rect(home.x + 3, home.y + 1, 4, 3), color)
        for i in range(LEVEL_COUNT):
            _fill(frame, 2 + i * 5, 62, 4, 1, C_GREEN if i < self.levels_completed else C_MGREY)
        for i in range(cfg.budget):
            _fill(frame, 40 + 2 * i, 61, 1, 2, C_YELLOW if i < lv.tests_left else C_MGREY)
        if border is not None:
            _outline(frame, Rect(0, 0, FRAME, FRAME), border)
        return frame

    def _focus_on(self, branch: int) -> None:
        regions = self._regions()
        if branch < 0 or branch >= len(regions):
            return
        lv = self._level
        lv.parents.append(lv.focus)
        lv.path.append("A" if branch == 0 else "B")
        lv.focus = regions[branch]
        lv.selected = None
        self._event = "focus"

    def _inspect(self, ids: list[int], selection: dict[str, Any]) -> None:
        lv = self._level
        if lv.tests_left < 1 or self.state == "WIN":
            return
        lv.tests_left -= 1
        lv.tests_used += 1
        lv.selected = selection
        cfg = lv.cfg
        global_outage = cfg.fault in ids
        result = {
            "kind": selection["kind"], "branch": selection.get("branch"),
            "tested": len(ids), "region": copy.deepcopy(selection.get("region")),
            "lamp": selection["id"] if selection["kind"] == "lamp" else None,
            "global": global_outage,
            "extinguished": cfg.lamp_count if global_outage else len(ids),
            "number": lv.tests_used, "remaining": lv.tests_left,
        }
        lv.last_result = result
        lv.history.append(copy.deepcopy(result))
        self._extra = {"played_level": lv.level_index + 1, "test_result": copy.deepcopy(result)}
        off = list(ids)
        frames = [self._render_frame(), self._render_frame(off=off)]
        if global_outage:
            initial = set(ids)
            remainder = [i for i in range(cfg.lamp_count) if i not in initial]
            batch = max(1, (len(remainder) + 5) // 6)
            # Fixed spatial order: never start the sweep at the hidden fault.
            for p in range(0, len(remainder), batch):
                off.extend(remainder[p:p + batch])
                frames.append(self._render_frame(off=off))
        for _ in range(5):
            frames.append(self._render_frame(off=off))
        if global_outage and len(ids) == 1:
            # Success on the last available attempt takes precedence over failure.
            self.levels_completed += 1
            for _ in range(3):
                frames.append(self._render_frame(off=off, border=C_GREEN))
            frames.append(self._render_frame(off=off))
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
                self._event = "win"
            else:
                self._level = self._new_level_state(lv.level_index + 1)
                self._event = "success"
            frames.append(self._render_frame())
            self._pending_frames = frames
            return
        # Release the pushbuttons, relighting in a fixed order.
        batch = max(1, (len(off) + 2) // 3)
        for p in range(batch, len(off), batch):
            frames.append(self._render_frame(off=off[p:]))
        frames.append(self._render_frame())
        if lv.tests_left == 0:
            for _ in range(3):
                frames.append(self._render_frame(red=True))
            self._attempts += 1
            self._level = self._new_level_state(lv.level_index)
            frames.append(self._render_frame())
            self._event = "failure"
            self._extra["reason"] = "test_budget_exhausted"
        else:
            self._event = "probe"
        self._pending_frames = frames

    def _click(self, data: dict[str, Any] | None) -> None:
        if not isinstance(data, dict):
            return
        x, y = data.get("x"), data.get("y")
        # Bool and floats are not accepted as native integer coordinates.
        if type(x) is not int or type(y) is not int or not (0 <= x < FRAME and 0 <= y < FRAME):
            return
        lv = self._level
        for name, box in BUTTONS.items():
            if not box.contains(x, y):
                continue
            if name in ("probeA", "probeB"):
                branch = 0 if name == "probeA" else 1
                region = self._probe_region(branch)
                if region is not None:
                    self._inspect(region.members(lv.cfg.cols),
                                  {"kind": "zone", "branch": branch, "region": asdict(region)})
            elif name in ("focusA", "focusB"):
                self._focus_on(0 if name == "focusA" else 1)
            elif name == "parent":
                if lv.parents:
                    lv.focus = lv.parents.pop()
                    lv.path.pop()
                    lv.selected = None
                    self._event = "focus"
            else:  # root, including a harmless repeated press at the root
                lv.focus = Region(0, 0, lv.cfg.cols, lv.cfg.rows)
                lv.parents.clear()
                lv.path.clear()
                lv.selected = None
                self._event = "focus"
            return
        # Lamps outside the current focus remain clickable, just as on the web.
        for lamp_id in range(lv.cfg.lamp_count):
            if self._lamp_rect(lamp_id).contains(x, y):
                self._inspect([lamp_id], {"kind": "lamp", "id": lamp_id})
                return

    def action(self, action_id: int | str, data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Apply one backend command; animations are returned immediately as data.

        As in web v2, step_index counts ACTION6 calls (even a missed click) and
        ACTION7. Only an actual lamp/zone test spends the test budget. Unsupported
        actions and post-WIN clicks do not advance step_index.
        """
        self._pending_frames = None
        self._extra = {}
        self._event = "ignored"
        if type(action_id) is int:
            aid = action_id
        elif isinstance(action_id, str):
            aid = {"RESET": 0, "ACTION6": 6, "click": 6, "ACTION7": 7}.get(action_id, -1)
        else:
            aid = -1
        if aid == 0:
            return self.reset()
        if aid == ACTION_RESET:
            return self.level_reset()
        if self.state == "WIN":
            self._event = "finished"
            return self.public_state()
        if aid == ACTION_CLICK:
            self.step_index += 1
            self.last_action = "ACTION6"
            self._click(data)
        return self.public_state()

    def public_state(self) -> dict[str, Any]:
        """FITE-compatible envelope. Consume each animation sequence only once.

        last_result/test_result contain only a test already performed, never the
        exact fault location of a group. No inferred candidate set is supplied.
        Returned nested state is detached from the engine's mutable state.
        """
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
        else:
            frames = [self._render_frame()]
        lv = self._level
        available = [ACTION_RESET] if self.state == "WIN" else [ACTION_CLICK, ACTION_RESET]
        fps = max(1, int(self.info.default_fps))
        if len(frames) > 1:
            fps = max(fps, ANIM_FPS)
        out = {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "frame": frames[-1], "frames": frames, "frame_count": len(frames),
            "default_fps": fps, "state": self.state,
            "level": lv.level_index + 1, "levels_completed": self.levels_completed,
            "win_levels": self.win_levels, "win_score": self.win_levels,
            "step_index": self.step_index,
            "available_actions": [f"ACTION{i}" for i in available],
            "available_action_ids": available, "last_action": self.last_action,
            "score": self.levels_completed, "full_reset": False,
            "source_path": str(self.levels_dir), "custom_family": self.info.family,
            "level_name": lv.cfg.name, "wave": WAVE,
            "tests_left": lv.tests_left, "tests_used": lv.tests_used,
            "test_budget": lv.cfg.budget, "lamp_count": lv.cfg.lamp_count,
            "last_result": copy.deepcopy(lv.last_result), "focus": asdict(lv.focus),
            "event": self._event,
        }
        out.update(copy.deepcopy(self._extra))
        self._extra = {}
        return out

    def view(self) -> dict[str, Any]:
        """Optional human-viewer data, matching web v2; no hidden answer or solver.

        Not needed by the agent/runner. Only geometry, player choices and results
        of past tests are described. It does not consume pending animation data.
        """
        lv, cfg = self._level, self._level.cfg
        regions = self._regions()
        probe_regions = []
        for i in range(2):
            r = self._probe_region(i)
            probe_regions.append(None if r is None else {
                **asdict(r), "color": C_CYAN if i == 0 else C_VIOLET,
                "size": r.size, "rect": asdict(self._region_rect(r)),
            })
        contours = []
        for r, branch in self._contours():
            box = self._region_rect(r)
            phase = 1 if branch == 0 else 0
            contours.append({"branch": branch, "color": C_CYAN if branch == 0 else C_VIOLET,
                             "phase": phase, "rect": asdict(box),
                             "pixels": [{"x": x, "y": y} for x, y in dotted_pixels(box, phase)]})
        return {
            "level": lv.level_index + 1, "title": cfg.name,
            "cols": cfg.cols, "rows": cfg.rows, "lamps": cfg.lamp_count,
            "budget": cfg.budget, "testsLeft": lv.tests_left, "testsUsed": lv.tests_used,
            "testMode": False, "completed": [i < self.levels_completed for i in range(6)],
            "state": self.state, "focus": asdict(lv.focus), "path": list(lv.path),
            "depth": len(lv.path),
            "regions": [{**asdict(r), "label": "A" if i == 0 else "B",
                         "color": C_CYAN if i == 0 else C_VIOLET,
                         "size": r.size, "rect": asdict(self._region_rect(r))}
                        for i, r in enumerate(regions)],
            "probeRegions": probe_regions, "zoneContours": contours,
            "lampsGeometry": [{"id": i, "row": i // cfg.cols + 1, "col": i % cfg.cols + 1,
                               **asdict(self._lamp_rect(i))} for i in range(cfg.lamp_count)],
            "buttons": {name: asdict(box) for name, box in BUTTONS.items()},
            "lastResult": copy.deepcopy(lv.last_result), "history": copy.deepcopy(lv.history),
            "attempts": self._attempts, "stepIndex": self.step_index,
        }

    def metadata(self) -> list[dict[str, Any]]:
        """Public level catalogue with no target positions."""
        return [{"number": i + 1, "title": cfg.name, "cols": cfg.cols, "rows": cfg.rows,
                 "lamps": cfg.lamp_count, "budget": cfg.budget}
                for i, cfg in enumerate(self._templates[:self.win_levels])]


__all__ = ["DichotomyEngine"]
