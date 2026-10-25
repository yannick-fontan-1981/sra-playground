"""THER — Thermomètres (custom_3), a deterministic 64 × 64 ARC puzzle.

Fill each thermometer in one continuous prefix starting at its round bulb.
The pips outside the board state the required filled-cell totals for each
row and column. A clue is cyan below its target, green at its target, and
red above it. Overshooting is legal and reversible; there is no loss state,
time limit, automatic solver, hidden-answer comparison, or random behavior.

ACTION1/2/3/4: select up/down/left/right, clamped to the board. The first
arrow only selects the top-left cell. ACTION5 (Space): toggle the selection,
selecting the top-left cell first if needed. ACTION6: select and toggle the
cell under integer native coordinates x/y in 0..63. Clicking an empty cell
fills through that cell; clicking a filled cell empties it and the rest of
its tube. ACTION7 restarts the level; RESET/action(0) restarts the campaign.

The public interface follows the supplied EvasionEngine CustomGameInfo
contract. All frames contain palette indices 0..15, in 64 rows of 64 values.
Actions return complete animation frame sequences immediately. Observations
never change the game or replay a prior animation. Rendering uses integers
only and exactly matches the companion browser engine.

The six levels are embedded, so this file works by itself. To override them,
pass levels_dir containing L01.json through L06.json; invalid explicit
overrides raise an error. Level input may contain authoring-only fields,
including solution; the engine discards them. Only visible puzzle geometry
and clues enter the runtime state. Standard library only.
"""

from __future__ import annotations

import copy
import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

FRAME = SIZE = 64
LEVEL_COUNT = 6
GAME_ID = "ther-c3000001"
FAMILY = "thermometers"
WAVE = "custom_3"
ANIM_FPS = 8
ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE, ACTION_CLICK, ACTION_RESET = 5, 6, 7
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / FAMILY / "levels"

C_WHITE, C_LIGHT, C_GRID, C_TUBE, C_BACKGROUND, C_BOARD = 0, 1, 2, 3, 4, 5
C_RED, C_CYAN, C_LIQUID, C_GREEN = 8, 10, 12, 14
PALETTE = (
    "#F3F2EB", "#C9CDC8", "#37404B", "#66707B", "#1B2028", "#11161C",
    "#614439", "#E7B9A3", "#F06B65", "#679DEB", "#63D5D6", "#F1CE62",
    "#EBA258", "#86513A", "#77CB93", "#BB94EB",
)
Raster = list[list[int]]
Cell = tuple[int, int]

_BUILTIN_LEVELS = json.loads('[{"number":1,"title":"Premières gouttes","note":"Remplis les tubes à partir du rond. Les indices indiquent le nombre de cases à remplir.","size":3,"thermometers":[[[2,0],[1,0],[0,0]],[[2,1],[1,1],[0,1]],[[2,2],[1,2],[0,2]]],"rows":[0,1,3],"cols":[1,2,1]},{"number":2,"title":"Premier virage","note":"Le liquide suit le tube, même lorsqu’il tourne. Il ne peut pas sauter une case.","size":3,"thermometers":[[[0,0],[1,0],[2,0],[2,1]],[[2,2],[1,2],[0,2]],[[1,1],[0,1]]],"rows":[1,2,3],"cols":[3,2,1]},{"number":3,"title":"Croiser les indices","note":"Combine les indices des lignes et des colonnes pour trouver où chaque tube doit s’arrêter.","size":4,"thermometers":[[[0,0],[0,1],[0,2],[1,2]],[[0,3],[1,3],[2,3],[3,3]],[[1,1],[1,0],[2,0],[3,0]],[[2,1],[2,2],[3,2],[3,1]]],"rows":[2,3,3,2],"cols":[3,3,2,2]},{"number":4,"title":"Garder un tube vide","note":"Un thermomètre peut rester entièrement vide. Tous les indices doivent être satisfaits ensemble.","size":4,"thermometers":[[[0,0],[1,0],[1,1],[0,1]],[[0,2],[0,3],[1,3]],[[1,2],[2,2],[2,1]],[[2,0],[3,0],[3,1]],[[3,2],[3,3],[2,3]]],"rows":[3,2,2,2],"cols":[3,1,2,3]},{"number":5,"title":"De proche en proche","note":"Chaque remplissage réduit les possibilités des tubes voisins. Fais suivre les déductions.","size":5,"thermometers":[[[0,0],[0,1],[1,1],[1,0]],[[0,2],[0,3],[0,4],[1,4],[1,3]],[[1,2],[2,2],[2,1],[2,0]],[[2,3],[2,4],[3,4],[4,4]],[[3,0],[4,0],[4,1],[3,1]],[[3,2],[3,3],[4,3],[4,2]]],"rows":[3,3,4,3,1],"cols":[2,3,4,3,2]},{"number":6,"title":"Derniers degrés","note":"Observe les départs et les virages, puis croise les comptes pour compléter la grille.","size":5,"thermometers":[[[1,0],[0,0],[0,1]],[[0,2],[1,2],[1,1],[2,1]],[[0,3],[0,4],[1,4]],[[1,3],[2,3],[3,3],[3,4],[2,4]],[[2,0],[3,0],[4,0],[4,1]],[[3,1],[3,2],[2,2]],[[4,2],[4,3],[4,4]]],"rows":[3,4,2,4,1],"cols":[2,2,3,4,3]}]')


def _integer(value: Any, label: str, low: int, high: int) -> int:
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"{label} must be an integer from {low} to {high}")
    return value


@dataclass(frozen=True)
class _StandaloneInfo:
    game_id: str = GAME_ID
    title: str = "Thermomètres"
    family: str = FAMILY
    levels: int = LEVEL_COUNT
    default_fps: int = ANIM_FPS


@dataclass(frozen=True)
class LevelConfig:
    number: int
    title: str
    note: str
    size: int
    thermometers: tuple[tuple[Cell, ...], ...]
    rows: tuple[int, ...]
    cols: tuple[int, ...]

    @classmethod
    def from_mapping(cls, data: Mapping[str, Any], number: int) -> LevelConfig:
        if not isinstance(data, Mapping):
            raise ValueError(f"Level {number} must be an object")
        actual = _integer(data.get("number"), "number", 1, LEVEL_COUNT)
        if actual != number:
            raise ValueError(f"Expected level number {number}, got {actual}")
        size = _integer(data.get("size"), "size", 2, 6)
        title = data.get("title")
        note = data.get("note", "")
        if not isinstance(title, str) or not title.strip():
            raise ValueError(f"Level {number}: title must be nonempty text")
        if not isinstance(note, str):
            raise ValueError(f"Level {number}: note must be text")

        def clue_values(key: str) -> tuple[int, ...]:
            values = data.get(key)
            if not isinstance(values, (list, tuple)) or len(values) != size:
                raise ValueError(f"Level {number}: {key} must contain {size} totals")
            return tuple(_integer(v, f"{key}[{i}]", 0, size)
                         for i, v in enumerate(values))

        rows, cols = clue_values("rows"), clue_values("cols")
        if sum(rows) != sum(cols):
            raise ValueError(f"Level {number}: row and column totals disagree")
        if not sum(rows):
            raise ValueError(f"Level {number}: an initially empty puzzle is already solved")
        raw_tubes = data.get("thermometers")
        if not isinstance(raw_tubes, (list, tuple)) or not raw_tubes:
            raise ValueError(f"Level {number}: thermometers must be a nonempty array")
        tubes: list[tuple[Cell, ...]] = []
        used: set[Cell] = set()
        for tube_index, raw_path in enumerate(raw_tubes):
            if not isinstance(raw_path, (list, tuple)) or len(raw_path) < 2:
                raise ValueError(f"Level {number}: tube {tube_index} must contain at least two cells")
            path: list[Cell] = []
            for cell_index, raw_cell in enumerate(raw_path):
                if not isinstance(raw_cell, (list, tuple)) or len(raw_cell) != 2:
                    raise ValueError(f"Level {number}: invalid cell in tube {tube_index}")
                cell = (
                    _integer(raw_cell[0], "row", 0, size - 1),
                    _integer(raw_cell[1], "col", 0, size - 1),
                )
                if cell in used:
                    raise ValueError(f"Level {number}: cell {cell} belongs to multiple tube positions")
                if cell_index and sum(abs(a - b) for a, b in zip(cell, path[-1])) != 1:
                    raise ValueError(f"Level {number}: tube {tube_index} is not an orthogonal path")
                used.add(cell)
                path.append(cell)
            tubes.append(tuple(path))
        if len(used) != size * size:
            raise ValueError(f"Level {number}: every board cell must belong to exactly one tube")
        # Author solutions and any other unrecognized fields never enter runtime.
        return cls(number, title, note, size, tuple(tubes), rows, cols)


def _load_levels(directory: Path | None) -> tuple[LevelConfig, ...]:
    if directory is None:
        data = _BUILTIN_LEVELS
    else:
        data = []
        for number in range(1, LEVEL_COUNT + 1):
            path = directory / f"L{number:02d}.json"
            if not path.is_file():
                raise FileNotFoundError(f"Missing level file: {path}")
            try:
                data.append(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError) as exc:
                raise ValueError(f"Cannot read level file {path}: {exc}") from exc
    if not isinstance(data, list) or len(data) != LEVEL_COUNT:
        raise ValueError("Exactly six levels are required")
    return tuple(LevelConfig.from_mapping(item, i + 1) for i, item in enumerate(data))


@dataclass(frozen=True)
class Geometry:
    cell: int
    span: int
    ox: int
    oy: int = 14

    @classmethod
    def for_size(cls, size: int) -> Geometry:
        cell = 42 // size
        span = size * cell
        return cls(cell, span, (FRAME - span) // 2 + 3)

    def center(self, row: int, col: int) -> tuple[int, int]:
        return self.ox + col * self.cell + self.cell // 2, self.oy + row * self.cell + self.cell // 2

    def as_dict(self) -> dict[str, int]:
        return {"cell": self.cell, "span": self.span, "ox": self.ox, "oy": self.oy}


def _fill(frame: Raster, x: int, y: int, width: int, height: int, color: int) -> None:
    for yy in range(max(0, y), min(FRAME, y + height)):
        for xx in range(max(0, x), min(FRAME, x + width)):
            frame[yy][xx] = color


def _outline(frame: Raster, x: int, y: int, width: int, height: int, color: int) -> None:
    _fill(frame, x, y, width, 1, color)
    _fill(frame, x, y + height - 1, width, 1, color)
    _fill(frame, x, y, 1, height, color)
    _fill(frame, x + width - 1, y, 1, height, color)


def _square(frame: Raster, x: int, y: int, diameter: int, color: int) -> None:
    half = diameter // 2
    _fill(frame, x - half, y - half, diameter, diameter, color)


def _segment(frame: Raster, source: tuple[int, int], target: tuple[int, int],
             thickness: int, color: int) -> None:
    x0, y0 = source
    x1, y1 = target
    half = thickness // 2
    _fill(frame, min(x0, x1) - half, min(y0, y1) - half,
          abs(x1 - x0) + thickness, abs(y1 - y0) + thickness, color)


def _round_pixel_bulb(frame: Raster, x: int, y: int, diameter: int, color: int) -> None:
    half = diameter // 2
    _fill(frame, x - half + 1, y - half, diameter - 2, diameter, color)
    _fill(frame, x - half, y - half + 1, diameter, diameter - 2, color)


class ThermometersEngine:
    """CustomGameInfo-compatible engine, usable without an external registry.

    info.levels selects a leading campaign prefix (1..6). jump_to_level is an
    isolated author preview and never an available agent action. Only valid
    selection, toggle, and current-level reset commands increase step_index.
    moves counts toggles in the current level, including reversible overshoots.
    """

    def __init__(self, info: CustomGameInfo | None = None, *,
                 levels_dir: str | Path | None = None) -> None:
        self.info = info if info is not None else _StandaloneInfo()
        self.levels_dir = Path(levels_dir).resolve() if levels_dir is not None else None
        self._templates = _load_levels(self.levels_dir)
        self.win_levels = _integer(self.info.levels, "info.levels", 1, LEVEL_COUNT)
        self._fps = _integer(self.info.default_fps, "info.default_fps", 1, 240)
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = False
        self.step_index = 0
        self.last_action: str | None = None
        self._event = "ready"
        self._setup(0)

    def _setup(self, index: int) -> None:
        self._index = index
        self._config = self._templates[index]
        self._geometry = Geometry.for_size(self._config.size)
        self._lengths = [0] * len(self._config.thermometers)
        self._selected: Cell | None = None
        self.moves = 0
        self.state = "NOT_FINISHED"
        self._owner = {
            cell: (tube_index, position)
            for tube_index, tube in enumerate(self._config.thermometers)
            for position, cell in enumerate(tube)
        }

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    def _counts(self) -> tuple[list[int], list[int]]:
        rows, cols = [0] * self._config.size, [0] * self._config.size
        for path, length in zip(self._config.thermometers, self._lengths):
            for row, col in path[:length]:
                rows[row] += 1
                cols[col] += 1
        return rows, cols

    def _render_frame(self, *, border: bool = False) -> Raster:
        cfg, g = self._config, self._geometry
        frame = [[C_BACKGROUND] * FRAME for _ in range(FRAME)]
        _fill(frame, g.ox, g.oy, g.span + 1, g.span + 1, C_BOARD)
        for i in range(cfg.size + 1):
            _fill(frame, g.ox + i * g.cell, g.oy, 1, g.span + 1, C_GRID)
            _fill(frame, g.ox, g.oy + i * g.cell, g.span + 1, 1, C_GRID)

        tube_width = 5 if cfg.size <= 4 else 3
        inner_width = tube_width - 2
        bulb_width = 7 if cfg.size <= 4 else 5
        for path, length in zip(cfg.thermometers, self._lengths):
            centers = [g.center(row, col) for row, col in path]
            for a, b in zip(centers, centers[1:]):
                _segment(frame, a, b, tube_width, C_TUBE)
            for x, y in centers:
                _square(frame, x, y, tube_width, C_TUBE)
            for a, b in zip(centers, centers[1:]):
                _segment(frame, a, b, inner_width, C_BACKGROUND)
            for x, y in centers:
                _square(frame, x, y, inner_width, C_BACKGROUND)
            for a, b in zip(centers[:length], centers[1:length]):
                _segment(frame, a, b, inner_width, C_LIQUID)
            for x, y in centers[:length]:
                _square(frame, x, y, inner_width, C_LIQUID)
            x, y = centers[0]
            _round_pixel_bulb(frame, x, y, bulb_width, C_LIGHT)
            bulb_color = C_LIQUID if length else C_BACKGROUND
            if bulb_width - 2 == 3:
                _square(frame, x, y, 3, bulb_color)
            else:
                _round_pixel_bulb(frame, x, y, bulb_width - 2, bulb_color)

        rows, cols = self._counts()
        for row, (count, target) in enumerate(zip(rows, cfg.rows)):
            _, cy = g.center(row, 0)
            color = C_CYAN if count < target else C_GREEN if count == target else C_RED
            if target:
                for i in range(target):
                    _fill(frame, g.ox - 3 - i * 2, cy - 1, 1, 2, color)
            else:
                _outline(frame, g.ox - 5, cy - 1, 3, 3, color)
                _fill(frame, g.ox - 4, cy, 1, 1, C_BACKGROUND)
        for col, (count, target) in enumerate(zip(cols, cfg.cols)):
            cx, _ = g.center(0, col)
            color = C_CYAN if count < target else C_GREEN if count == target else C_RED
            if target:
                for i in range(target):
                    _fill(frame, cx - 1, g.oy - 3 - i * 2, 2, 1, color)
            else:
                _outline(frame, cx - 1, g.oy - 5, 3, 3, color)
                _fill(frame, cx, g.oy - 4, 1, 1, C_BACKGROUND)

        if self._selected is not None:
            row, col = self._selected
            x, y = g.ox + col * g.cell + 1, g.oy + row * g.cell + 1
            width = g.cell - 2
            for xx in (x, x + width - 2):
                for yy in (y, y + width - 1):
                    _fill(frame, xx, yy, 2, 1, C_WHITE)
            for xx in (x, x + width - 1):
                for yy in (y, y + width - 2):
                    _fill(frame, xx, yy, 1, 2, C_WHITE)

        for i, completed in enumerate(self._completed):
            _fill(frame, 3 + i * 5, 62, 4, 1, C_GREEN if completed else C_GRID)
        if border:
            _outline(frame, 0, 0, FRAME, FRAME, C_GREEN)
        return frame

    def render(self) -> Raster:
        """Return a fresh native frame without advancing or modifying the game."""
        return self._render_frame()

    def public_state(self) -> dict[str, Any]:
        """Return detached current state. Observations do not replay animation."""
        return self._snapshot(event="observation")

    def observe(self) -> dict[str, Any]:
        return self.public_state()

    def _snapshot(self, *, frames: list[Raster] | None = None,
                  event: str | None = None, **extra: Any) -> dict[str, Any]:
        images = frames if frames is not None else [self._render_frame()]
        rows, cols = self._counts()
        available = [ACTION_RESET] if self.state == "WIN" else list(range(1, 8))
        target = 1 if self.test_mode else self.win_levels
        result = {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "custom_family": self.info.family, "wave": WAVE,
            "frame": images[-1], "frames": images, "frame_count": len(images),
            "default_fps": max(self._fps, ANIM_FPS) if len(images) > 1 else self._fps,
            "state": self.state, "level": self._index + 1,
            "levels_completed": self.levels_completed, "score": self.levels_completed,
            "win_levels": target, "win_score": target, "test_mode": self.test_mode,
            "step_index": self.step_index, "last_action": self.last_action,
            "available_actions": [f"ACTION{i}" for i in available],
            "available_action_ids": available, "full_reset": False,
            "source_path": str(self.levels_dir or Path(__file__).resolve()),
            "level_name": self._config.title, "event": event if event is not None else self._event,
            "moves": self.moves, "row_clues": list(self._config.rows),
            "col_clues": list(self._config.cols), "row_counts": rows, "col_counts": cols,
            "filled_lengths": self._lengths.copy(),
            "selection": list(self._selected) if self._selected is not None else None,
            "completed": self._completed.copy(),
        }
        result.update(copy.deepcopy(extra))
        return result

    def _response(self, event: str, *, frames: list[Raster] | None = None,
                  **extra: Any) -> dict[str, Any]:
        self._event = event
        return self._snapshot(frames=frames, **extra)

    def reset(self) -> dict[str, Any]:
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = False
        self.step_index = 0
        self.last_action = "RESET"
        self._setup(0)
        return self._response("reset", full_reset=True)

    def level_reset(self) -> dict[str, Any]:
        index = self._index
        self._completed[index] = False
        self.step_index += 1
        self.last_action = "ACTION7"
        self._setup(index)
        return self._response("restart")

    def _select(self, action_id: int) -> dict[str, Any]:
        if self._selected is None:
            self._selected = (0, 0)
        else:
            row, col = self._selected
            dr, dc = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1)}[action_id]
            limit = self._config.size - 1
            self._selected = (max(0, min(limit, row + dr)), max(0, min(limit, col + dc)))
        self.step_index += 1
        self.last_action = f"ACTION{action_id}"
        return self._response("select")

    def _toggle(self, cell: Cell, action_id: int) -> dict[str, Any]:
        tube_index, position = self._owner[cell]
        old_length = self._lengths[tube_index]
        self._lengths[tube_index] = position if position < old_length else position + 1
        self._selected = cell
        self.moves += 1
        self.step_index += 1
        self.last_action = f"ACTION{action_id}"
        rows, cols = self._counts()
        if tuple(rows) != self._config.rows or tuple(cols) != self._config.cols:
            return self._response("fill")
        played_level, played_moves = self._index + 1, self.moves
        self._completed[self._index] = True
        frames = [self._render_frame(), self._render_frame(border=True), self._render_frame()]
        if self.test_mode or self._index == self.win_levels - 1:
            self.state = "WIN"
        else:
            self._setup(self._index + 1)
            frames.append(self._render_frame())
        return self._response("win" if self.state == "WIN" else "success", frames=frames,
                              played_level=played_level, played_moves=played_moves)

    def action(self, action_id: int | str | dict[str, Any],
               data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Apply an ARC action; invalid commands leave counters and board intact."""
        if isinstance(action_id, Mapping):
            packet = action_id
            data = packet.get("data")
            action_id = packet.get("id") if packet.get("id") is not None else packet.get("action")
        if isinstance(action_id, str):
            aliases = {"RESET": 0, "click": 6, "space": 5}
            aliases.update({f"ACTION{i}": i for i in range(1, 8)})
            action_id = aliases.get(action_id, -1)
        if type(action_id) is not int or not 0 <= action_id <= 7:
            return self._snapshot(event="ignored", reason="unknown_action")
        if action_id == 0:
            return self.reset()
        if action_id == ACTION_RESET:
            return self.level_reset()
        if self.state == "WIN":
            return self._snapshot(event="finished")
        if action_id in (ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT):
            return self._select(action_id)
        if action_id == ACTION_SPACE:
            return self._toggle(self._selected if self._selected is not None else (0, 0), action_id)
        if not isinstance(data, Mapping):
            return self._snapshot(event="ignored", reason="invalid_coordinates")
        x, y = data.get("x"), data.get("y")
        if type(x) is not int or type(y) is not int or not 0 <= x < FRAME or not 0 <= y < FRAME:
            return self._snapshot(event="ignored", reason="invalid_coordinates")
        g = self._geometry
        if not (g.ox <= x < g.ox + g.span and g.oy <= y < g.oy + g.span):
            return self._snapshot(event="ignored", reason="outside_board")
        return self._toggle(((y - g.oy) // g.cell, (x - g.ox) // g.cell), action_id)

    def step(self, action: int | str | dict[str, Any],
             data: dict[str, Any] | None = None) -> dict[str, Any]:
        return self.action(action, data)

    def view(self) -> dict[str, Any]:
        """Human-view data: visible geometry, clues, and current player choices."""
        rows, cols = self._counts()
        cfg = self._config
        return {
            "level": self._index + 1, "title": cfg.title, "note": cfg.note,
            "size": cfg.size,
            "thermometers": [[list(cell) for cell in path] for path in cfg.thermometers],
            "rowClues": list(cfg.rows), "colClues": list(cfg.cols),
            "rowCounts": rows, "colCounts": cols, "lengths": self._lengths.copy(),
            "selected": list(self._selected) if self._selected is not None else None,
            "completed": self._completed.copy(), "testMode": self.test_mode,
            "state": self.state, "stepIndex": self.step_index, "moves": self.moves,
            "geometry": self._geometry.as_dict(),
        }

    def metadata(self) -> list[dict[str, Any]]:
        return [{"number": cfg.number, "title": cfg.title, "note": cfg.note,
                 "size": cfg.size, "thermometers": len(cfg.thermometers)}
                for cfg in self._templates]

    def jump_to_level(self, number: int) -> dict[str, Any]:
        """Author-only isolated preview. No credit is awarded for earlier levels."""
        number = _integer(number, "number", 1, LEVEL_COUNT)
        self.test_mode = True
        self._completed = [False] * LEVEL_COUNT
        self.step_index = 0
        self.last_action = None
        self._setup(number - 1)
        return self._response("preview")

    levelReset = level_reset
    restartLevel = level_reset
    jumpToLevel = jump_to_level


__all__ = ["ThermometersEngine"]


if __name__ == "__main__":
    game = ThermometersEngine()
    print(json.dumps(game.view(), ensure_ascii=False, indent=2))
