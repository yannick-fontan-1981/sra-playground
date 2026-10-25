"""GRIL — identify movable monochrome silhouettes behind an irregular grille.

Faithful Python port of Grillage_custom_3_v3.html; no random generation.
The engine interface follows the supplied FiteArenaEngine custom backend.

Controls:
    ACTION3  move the selected colour left (one shared-budget move)
    ACTION4  move the selected colour right (one shared-budget move)
    ACTION6  click a colour, a candidate, or an in-frame movement arrow
    ACTION7  restart the current level, preserving earlier completed levels
    reset()  restart the whole campaign

One choice per colour validates the complete combination automatically.
Failure returns an opaque red frame followed by the identical level reset.
Success returns a green border frame followed by the next level, or WIN.

Frames are 64 x 64 lists of integer palette indices (0..15). Shapes in the
field are x2 the displayed candidates. Selection never changes depth order.
Levels, targets, candidates, grille and budgets are copied from web v3.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

# The host type is only needed for annotations. This avoids introducing a
# fake registry or a fallback CustomGameInfo into the user's repository.
if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

FRAME = 64
GAME_ID = "gril-c3000001"
WAVE = "custom_3"
WEB_REVISION = "v3"
LEVEL_COUNT = 6
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "grillage" / "levels"
ANIM_FPS = 16
ACTION_LEFT, ACTION_RIGHT, ACTION_CLICK, ACTION_RESET = 3, 4, 6, 7

C_WHITE, C_LGREY, C_MGREY, C_DGREY = 0, 1, 2, 3
C_BACKGROUND, C_FIELD, C_RED, C_ORANGE, C_BROWN, C_GREEN = 4, 5, 8, 12, 13, 14

# Reference web colours for standalone viewers; the engine returns indices.
PALETTE = (
    "#F3F2EB", "#C9CDC8", "#37404B", "#66707B", "#1B2028", "#11161C",
    "#614439", "#E7B9A3", "#F06B65", "#679DEB", "#63D5D6", "#F1CE62",
    "#EBA258", "#86513A", "#77CB93", "#BB94EB",
)

Raster = list[list[int]]
Mask = tuple[str, ...]


@dataclass(frozen=True)
class Rect:
    x: int
    y: int
    w: int
    h: int

    def contains(self, x: int, y: int) -> bool:
        return self.x <= x < self.x + self.w and self.y <= y < self.y + self.h


FIELD = Rect(3, 11, 58, 30)
LEFT_ARROW = Rect(2, 42, 7, 5)
RIGHT_ARROW = Rect(55, 42, 7, 5)


def palette_slots(count: int) -> tuple[Rect, ...]:
    """Hitboxes exactly matching the web colour toolbar."""
    start = (FRAME - count * 10) // 2
    return tuple(Rect(start + i * 10, 1, 9, 7) for i in range(count))


def candidate_slots(count: int) -> tuple[Rect, ...]:
    """Hitboxes exactly matching the web alternatives strip."""
    span = 60 // count
    start = (FRAME - count * span) // 2
    return tuple(Rect(start + i * span, 48, span, 12) for i in range(count))


@dataclass(frozen=True)
class ObjectConfig:
    color: int
    name: str
    x: int
    y: int
    z: int
    candidates: tuple[Mask, ...] = field(repr=False)
    answer: int = field(repr=False)

    @property
    def field_width(self) -> int:
        # Derive the boundary from ALL visible alternatives, never from the
        # chosen hidden target. A boundary must not disclose the answer.
        return 2 * max(len(row) for mask in self.candidates for row in mask)


@dataclass(frozen=True)
class LevelConfig:
    number: int
    name: str
    budget: int
    step: int
    fence: Mask = field(repr=False)
    objects: tuple[ObjectConfig, ...] = field(repr=False)


@dataclass
class LevelState:
    cfg: LevelConfig
    level_index: int
    selected: int
    positions: list[int]  # integer x positions, including a shorter edge step
    choices: list[int | None]  # player submissions, not the hidden answer key
    moves_left: int


def _integer(value: Any, label: str, low: int, high: int | None = None) -> int:
    if type(value) is not int or value < low or (high is not None and value > high):
        suffix = f"..{high}" if high is not None else " or greater"
        raise ValueError(f"{label}: expected an integer {low}{suffix}, got {value!r}")
    return value


def _mask(value: Any, width: int, height: int, label: str) -> Mask:
    if not isinstance(value, list) or len(value) != height:
        raise ValueError(f"{label}: expected {height} binary strings")
    if any(not isinstance(row, str) or len(row) != width or set(row) - {"0", "1"}
           for row in value):
        raise ValueError(f"{label}: expected rows of {width} binary characters")
    return tuple(value)


def _load_level(path: Path) -> LevelConfig:
    """Validate author data once, not on every action. Never generate a target."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Cannot read level {path}: {exc}") from exc
    try:
        if not isinstance(data, dict):
            raise ValueError("the level must be a JSON object")
        number = _integer(data["number"], "number", 1, LEVEL_COUNT)
        name = data["title"]
        if not isinstance(name, str) or not name.strip():
            raise ValueError("title: expected a non-empty string")
        budget = _integer(data["budget"], "budget", 1)
        step = _integer(data["step"], "step", 1, FIELD.w)
        fence = _mask(data["fence"], FIELD.w, FIELD.h, "fence")
        raw_objects = data["objects"]
        if not isinstance(raw_objects, list) or not 1 <= len(raw_objects) <= 5:
            raise ValueError("objects: expected 1..5 colour objects")
        objects: list[ObjectConfig] = []
        used_colors: set[int] = set()
        for index, raw in enumerate(raw_objects):
            if not isinstance(raw, dict):
                raise ValueError(f"objects[{index}]: expected an object")
            color = _integer(raw["color"], "color", 0, 15)
            if color in used_colors:
                raise ValueError("objects must use distinct colours")
            used_colors.add(color)
            obj_name = raw["name"]
            if not isinstance(obj_name, str) or not obj_name.strip():
                raise ValueError("object name: expected a non-empty string")
            candidates = raw["candidates"]
            if not isinstance(candidates, list) or not 2 <= len(candidates) <= 6:
                raise ValueError("candidates: expected 2..6 alternatives")
            masks = tuple(_mask(m, 8, 8, f"candidate[{k}]") for k, m in enumerate(candidates))
            if len(set(masks)) != len(masks) or any(not any("1" in row for row in m) for m in masks):
                raise ValueError("candidates must be non-empty and distinct")
            x = _integer(raw["x"], "x", FIELD.x, FIELD.x + FIELD.w - 16)
            y = _integer(raw["y"], "y", FIELD.y, FIELD.y + FIELD.h - 16)
            z = _integer(raw["z"], "z", 0)
            if z != index:
                raise ValueError("z must agree with the fixed back-to-front object order")
            answer = _integer(raw["answer"], "answer", 0, len(masks) - 1)
            objects.append(ObjectConfig(color, obj_name, x, y, z, masks, answer))
        return LevelConfig(number, name, budget, step, fence, tuple(objects))
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Invalid level {path}: {exc}") from exc


def _load_all_levels(directory: Path) -> tuple[LevelConfig, ...]:
    paths = sorted(directory.glob("L[0-9][0-9].json"))
    if not paths:
        raise FileNotFoundError(f"No L01.json..L06.json levels found in {directory}")
    levels = tuple(_load_level(path) for path in paths)
    if [level.number for level in levels] != list(range(1, len(levels) + 1)):
        raise ValueError(f"Level files in {directory} must be numbered consecutively from 1")
    return levels


def _rect(frame: Raster, x: int, y: int, w: int, h: int, color: int) -> None:
    for yy in range(max(0, y), min(FRAME, y + h)):
        for xx in range(max(0, x), min(FRAME, x + w)):
            frame[yy][xx] = color


def _outline(frame: Raster, x: int, y: int, w: int, h: int, color: int) -> None:
    _rect(frame, x, y, w, 1, color)
    _rect(frame, x, y + h - 1, w, 1, color)
    _rect(frame, x, y, 1, h, color)
    _rect(frame, x + w - 1, y, 1, h, color)


def _stamp(frame: Raster, mask: Mask, x: int, y: int, scale: int, color: int) -> None:
    for yy, row in enumerate(mask):
        for xx, bit in enumerate(row):
            if bit == "1":
                _rect(frame, x + xx * scale, y + yy * scale, scale, scale, color)


class GrillageEngine:
    """Custom backend engine; public_state follows FiteArenaEngine's envelope.

    ``info`` is the host registry's CustomGameInfo (levels, game_id, title,
    default_fps, family). ``levels_dir`` is an optional author/test override.
    No registry file is replaced and no external package is required here.
    """

    def __init__(self, info: CustomGameInfo, *, levels_dir: str | Path | None = None) -> None:
        self.info = info
        self.levels_dir = Path(levels_dir).resolve() if levels_dir is not None else LEVELS_DIR
        self._templates = _load_all_levels(self.levels_dir)
        self.win_levels = _integer(info.levels, "info.levels", 1, LEVEL_COUNT)
        if len(self._templates) < self.win_levels:
            raise ValueError(f"Expected {self.win_levels} levels, found {len(self._templates)}")
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._event = "reset"
        self._attempts = 0
        self._total_moves = 0
        self._pending_frames: list[Raster] | None = None
        self._level = self._new_level_state(0)

    def _new_level_state(self, level_index: int) -> LevelState:
        cfg = self._templates[level_index]
        return LevelState(cfg, level_index, 0, [obj.x for obj in cfg.objects],
                          [None] * len(cfg.objects), cfg.budget)

    def reset(self) -> dict[str, Any]:
        """Full campaign reset; all targets and candidate order remain identical."""
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._event = "reset"
        self._attempts = 0
        self._total_moves = 0
        self._pending_frames = None
        self._level = self._new_level_state(0)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        """Replay current level, including L6 after WIN; keep earlier progress."""
        index = self._level.level_index
        self.levels_completed = index
        self._level = self._new_level_state(index)
        self.state = "NOT_FINISHED"
        self.last_action = "ACTION7"
        self._event = "restart"
        self._attempts += 1
        self._pending_frames = None
        return self.public_state()

    def _move(self, direction: int) -> None:
        lv = self._level
        if lv.moves_left == 0:
            self._event = "budget"
            return
        obj = lv.cfg.objects[lv.selected]
        current_x = lv.positions[lv.selected]
        right = FIELD.x + FIELD.w - obj.field_width
        next_x = max(FIELD.x, min(right, current_x + direction * lv.cfg.step))
        if next_x == current_x:
            self._event = "boundary"
            return
        # One actual movement costs one. A shorter final edge step is legal.
        lv.positions[lv.selected] = next_x
        lv.moves_left -= 1
        self._total_moves += 1
        self.step_index += 1
        self._event = "move"

    def _choose(self, index: int) -> None:
        lv = self._level
        lv.choices[lv.selected] = index
        self.step_index += 1
        self._event = "choice"
        if any(choice is None for choice in lv.choices):
            return  # No partial correctness signal, score, or early reset.
        correct = all(choice == obj.answer for choice, obj in zip(lv.choices, lv.cfg.objects))
        if not correct:
            self._attempts += 1
            red = [[C_RED] * FRAME for _ in range(FRAME)]
            self._level = self._new_level_state(lv.level_index)
            self._event = "failure"
            self._pending_frames = [red, self._render_frame()]
            return
        self.levels_completed += 1
        flash = self._render_frame()
        _outline(flash, 0, 0, FRAME, FRAME, C_GREEN)
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            self._event = "win"
        else:
            self._level = self._new_level_state(self.levels_completed)
            self._event = "success"
        self._pending_frames = [flash, self._render_frame()]

    def _click(self, data: dict[str, Any] | None) -> None:
        if not isinstance(data, dict):
            return
        x, y = data.get("x"), data.get("y")
        # bool is an int subclass in Python, but not a valid pixel coordinate.
        if type(x) is not int or type(y) is not int or not (0 <= x < FRAME and 0 <= y < FRAME):
            return
        lv = self._level
        for index, box in enumerate(palette_slots(len(lv.cfg.objects))):
            if box.contains(x, y):
                lv.selected = index
                self.step_index += 1
                self._event = "select"
                return
        obj = lv.cfg.objects[lv.selected]
        for index, box in enumerate(candidate_slots(len(obj.candidates))):
            if box.contains(x, y):
                self._choose(index)
                return
        if LEFT_ARROW.contains(x, y):
            self._move(-1)
        elif RIGHT_ARROW.contains(x, y):
            self._move(1)

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Process one host action. ACTION6 takes native integer x/y coordinates."""
        self._pending_frames = None
        self._event = "ignored"
        try:
            if isinstance(action_id, (bool, float)):
                raise ValueError("invalid action id")
            aid = int(action_id)
        except (ValueError, TypeError, OverflowError):
            return self.public_state()
        if aid == 0:
            return self.reset()  # optional numeric full-reset convenience
        if aid == ACTION_RESET:
            return self.level_reset()
        self.last_action = f"ACTION{aid}"
        if self.state == "WIN":
            self._event = "finished"
            return self.public_state()
        if aid == ACTION_LEFT:
            self._move(-1)
        elif aid == ACTION_RIGHT:
            self._move(1)
        elif aid == ACTION_CLICK:
            self._click(data)
        return self.public_state()

    def _render_frame(self) -> Raster:
        """Pixel-for-pixel v3 raster; do not draw hidden bounding boxes or masks."""
        lv = self._level
        cfg = lv.cfg
        frame = [[C_BACKGROUND] * FRAME for _ in range(FRAME)]
        for index, box in enumerate(palette_slots(len(cfg.objects))):
            _rect(frame, box.x + 1, box.y + 1, box.w - 2, box.h - 2, cfg.objects[index].color)
            if index == lv.selected:
                _outline(frame, box.x, box.y, box.w, box.h, C_WHITE)
            if lv.choices[index] is not None:
                _rect(frame, box.x + 3, 9, 3, 1, C_WHITE)
        _outline(frame, 2, 10, 60, 32, C_MGREY)
        _rect(frame, FIELD.x, FIELD.y, FIELD.w, FIELD.h, C_FIELD)
        # Immutable list/z order: back to front, irrespective of selection.
        for index, obj in enumerate(cfg.objects):
            _stamp(frame, obj.candidates[obj.answer], lv.positions[index], obj.y, 2, obj.color)
        for y, row in enumerate(cfg.fence):
            for x, bit in enumerate(row):
                if bit == "1":
                    frame[FIELD.y + y][FIELD.x + x] = C_BROWN
        arrow_color = C_LGREY if lv.moves_left > 0 else C_DGREY
        for y in range(5):
            dx = abs(y - 2)
            _rect(frame, 3 + dx, 42 + y, 1, 1, arrow_color)
            _rect(frame, 60 - dx, 42 + y, 1, 1, arrow_color)
        _rect(frame, 4, 44, 4, 1, arrow_color)
        _rect(frame, 56, 44, 4, 1, arrow_color)
        _outline(frame, 11, 43, 42, 3, C_MGREY)
        fill = (40 * lv.moves_left + cfg.budget - 1) // cfg.budget
        color = C_ORANGE if lv.moves_left <= (cfg.budget + 3) // 4 else C_LGREY
        _rect(frame, 12, 44, fill, 1, color)
        active = cfg.objects[lv.selected]
        for index, box in enumerate(candidate_slots(len(active.candidates))):
            _rect(frame, box.x + 1, box.y, box.w - 2, box.h, C_FIELD)
            _stamp(frame, active.candidates[index], box.x + (box.w - 8) // 2, 50, 1, active.color)
            if lv.choices[lv.selected] == index:
                _outline(frame, box.x, box.y, box.w, box.h, C_WHITE)
        # Always six separate bars, four native pixels wide, one-pixel gaps.
        for i in range(LEVEL_COUNT):
            _rect(frame, 3 + i * 5, 62, 4, 1, C_GREEN if i < self.levels_completed else C_DGREY)
        if self.state == "WIN":
            _outline(frame, 0, 0, FRAME, FRAME, C_GREEN)
        return frame

    def public_state(self) -> dict[str, Any]:
        """Host envelope: 2D ``frame`` and 3D ``frames``, as in the FITE example.

        No hidden target, true mask, per-colour correctness, or unobstructed
        geometry is exported. A returned animation is consumed once.
        """
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
        else:
            frames = [self._render_frame()]
        frame = frames[-1]
        available = [ACTION_LEFT, ACTION_RIGHT, ACTION_CLICK, ACTION_RESET]
        if self.state == "WIN":
            available = [ACTION_RESET]
        fps = max(1, int(self.info.default_fps))
        if len(frames) > 1:
            fps = max(fps, ANIM_FPS)
        lv = self._level
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frame,
            "frames": frames,
            "frame_count": len(frames),
            "default_fps": fps,
            "state": self.state,
            "level": lv.level_index + 1,
            "levels_completed": self.levels_completed,
            "win_levels": self.win_levels,
            "step_index": self.step_index,
            "available_actions": [f"ACTION{i}" for i in available],
            "available_action_ids": available,
            "last_action": self.last_action,
            "score": self.levels_completed,
            "full_reset": False,
            "source_path": str(self.levels_dir),
            "custom_family": self.info.family,
            "level_name": lv.cfg.name,
            "wave": WAVE,
            "moves_left": lv.moves_left,
            "movement_budget": lv.cfg.budget,
            "selected_color": lv.selected,
            "answered_count": sum(choice is not None for choice in lv.choices),
            "event": self._event,
        }


__all__ = ["GrillageEngine"]
