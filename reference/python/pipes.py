"""PIPE — Pipes (custom_3), a deterministic 64 × 64 rotation puzzle.

Rotate the pipes until every cell belongs to one network supplied by the
blue source, with no unmatched opening and no cycle. Water only crosses
reciprocal openings. The source can rotate like any other pipe. Success is
derived from the current visible graph, never from a stored solution.

ACTION1/2/3/4 move the selection up/down/left/right. With no selection, the
first arrow selects the upper-left cell without moving or rotating it.
ACTION5 (Space or rotate) rotates the selected pipe clockwise by 90 degrees;
with no selection it selects and rotates the upper-left pipe. ACTION6 clicks
native x/y coordinates in 0..63, selecting and rotating that pipe. ACTION7
restarts the current level. RESET or action(0) restarts the whole campaign.
Numeric actions and coordinates must have integer values; booleans,
fractions, and nonfinite values are ignored.

The interface follows the supplied CustomGameInfo engine contract. Frames
are 64 rows of 64 palette indices (0..15). Each success returns one green
border pulse and, during a campaign, the next board as its final frame.
Six separate completion bars have exactly one native pixel between them.
Observations are read-only and never replay an earlier animation. There is
no action limit, time limit, randomness, sleeping, or third-party dependency.

All six levels are embedded, so this file works alone with Python 3.10+.
An explicit levels_dir must contain L01.json through L06.json. Overrides
are validated, and authoring-only fields such as solution are discarded.
"""

from __future__ import annotations

import json
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

FRAME = SIZE = 64
LEVEL_COUNT = 6
GAME_ID = "pipe-c3000001"
FAMILY = "pipes"
WAVE = "custom_3"
ANIM_FPS = 10
ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_ROTATE = ACTION_SPACE = 5
ACTION_CLICK, ACTION_RESET = 6, 7

C_WHITE, C_GRID, C_OUTLINE, C_BACKGROUND, C_BOARD = 0, 2, 3, 4, 5
C_BLUE, C_CYAN, C_GREEN = 9, 10, 14
PALETTE = (
    "#F3F2EB", "#C9CDC8", "#37404B", "#66707B", "#1B2028", "#11161C",
    "#614439", "#E7B9A3", "#F06B65", "#679DEB", "#63D5D6", "#F1CE62",
    "#EBA258", "#86513A", "#77CB93", "#BB94EB",
)
# Row offset, column offset, opening bit, reciprocal opening bit.
# Iteration order is north, east, south, west, including in the leak list.
DIRECTIONS = ((-1, 0, 1, 4), (0, 1, 2, 8), (1, 0, 4, 1), (0, -1, 8, 2))
Raster = list[list[int]]
Cell = tuple[int, int]

_BUILTIN_LEVELS = [
    {
        "number": 1, "title": "Premier raccord",
        "note": "Tourne les tuyaux pour prolonger le réseau bleu.",
        "size": 3, "source": [0, 0],
        "pipes": [[2, 10, 12], [3, 10, 12], [9, 10, 4]],
    },
    {
        "number": 2, "title": "Une bifurcation",
        "note": "Un raccord en T alimente trois directions.",
        "size": 3, "source": [1, 1],
        "pipes": [[2, 3, 2], [3, 13, 10], [8, 3, 6]],
    },
    {
        "number": 3, "title": "Les bords d’abord",
        "note": "Aucune ouverture ne doit pointer hors de la grille.",
        "size": 4, "source": [1, 1],
        "pipes": [[2, 14, 10, 2], [3, 11, 10, 8], [5, 8, 5, 6], [12, 5, 5, 9]],
    },
    {
        "number": 4, "title": "Un seul réseau",
        "note": "Raccorde aussi les petits groupes isolés.",
        "size": 4, "source": [2, 1],
        "pipes": [[3, 11, 5, 8], [10, 7, 10, 6], [10, 7, 2, 10], [1, 1, 8, 6]],
    },
    {
        "number": 5, "title": "De proche en proche",
        "note": "Pars du bleu et construis chaque branche.",
        "size": 5, "source": [2, 2],
        "pipes": [
            [2, 7, 6, 4, 4], [6, 12, 9, 14, 6], [5, 6, 14, 7, 3],
            [5, 10, 5, 4, 10], [12, 9, 1, 8, 9],
        ],
    },
    {
        "number": 6, "title": "Toutes les branches",
        "note": "Relie toute la grille sans fuite ni boucle.",
        "size": 5, "source": [2, 2],
        "pipes": [
            [6, 11, 5, 5, 2], [4, 9, 12, 6, 12], [8, 10, 11, 9, 10],
            [3, 11, 7, 5, 14], [4, 4, 1, 8, 9],
        ],
    },
]


def _is_integer(value: Any) -> bool:
    """Match Number.isInteger for ordinary Python/JSON numbers, excluding bool."""
    return type(value) is int or (
        type(value) is float and math.isfinite(value) and value.is_integer()
    )


def _integer(value: Any, label: str, low: int, high: int) -> int:
    if not _is_integer(value) or not low <= value <= high:
        raise ValueError(f"{label} must be an integer from {low} to {high}")
    return int(value)


def rotate(mask: int) -> int:
    """Rotate NESW opening bits (1, 2, 4, 8) clockwise by one quarter turn."""
    return ((mask << 1) & 15) | (mask >> 3)


def analyze(pipes: Sequence[Sequence[int]], source: Sequence[int]) -> dict[str, Any]:
    """Describe the reciprocal-opening graph without changing either argument.

    The playable-level loader validates shapes and masks. This standalone
    graph helper expects a square integer grid and an in-bounds source.
    Cycles counts independent cycles across all connected components;
    a fully supplied graph still fails if it leaks or contains a cycle.
    """
    size = len(pipes)
    total = size * size
    adjacency: list[list[int]] = [[] for _ in range(total)]
    leaks: list[dict[str, Any]] = []
    edges = 0
    for row in range(size):
        for col in range(size):
            for dr, dc, bit, opposite in DIRECTIONS:
                if not pipes[row][col] & bit:
                    continue
                rr, cc = row + dr, col + dc
                if not (0 <= rr < size and 0 <= cc < size) or not pipes[rr][cc] & opposite:
                    leaks.append({"cell": [row, col], "direction": bit})
                else:
                    adjacency[row * size + col].append(rr * size + cc)
                    if bit in (2, 4):
                        edges += 1

    def reach(start: int) -> set[int]:
        seen = {start}
        todo = [start]
        for node in todo:
            for neighbor in adjacency[node]:
                if neighbor not in seen:
                    seen.add(neighbor)
                    todo.append(neighbor)
        return seen

    supplied = reach(source[0] * size + source[1])
    wet = [[row * size + col in supplied for col in range(size)] for row in range(size)]
    visited: set[int] = set()
    components = 0
    for node in range(total):
        if node not in visited:
            components += 1
            visited.update(reach(node))
    cycles = edges - total + components
    connected = len(supplied)
    return {
        "wet": wet, "connected": connected, "total": total, "leaks": leaks,
        "leakCount": len(leaks), "edges": edges, "components": components,
        "cycles": cycles, "solved": connected == total and not leaks and cycles == 0,
    }


@dataclass(frozen=True)
class _StandaloneInfo:
    game_id: str = GAME_ID
    title: str = "Pipes"
    family: str = FAMILY
    levels: int = LEVEL_COUNT
    default_fps: int = ANIM_FPS


@dataclass(frozen=True)
class LevelConfig:
    number: int
    title: str
    note: str
    size: int
    source: Cell
    pipes: tuple[tuple[int, ...], ...]

    @classmethod
    def from_mapping(cls, data: Mapping[str, Any], number: int) -> LevelConfig:
        if not isinstance(data, Mapping):
            raise ValueError(f"Level {number} must be an object")
        if "number" in data:
            actual = _integer(data["number"], "number", 1, LEVEL_COUNT)
            if actual != number:
                raise ValueError(f"Expected level number {number}, got {actual}")
        size = _integer(data.get("size"), "size", 2, 6)
        title = data.get("title", "Pipes")
        note = data.get("note", "")
        if not isinstance(title, str) or not isinstance(note, str):
            raise ValueError(f"Level {number}: title and note must be text")
        title = title or "Pipes"
        raw_source = data.get("source")
        if not isinstance(raw_source, (list, tuple)) or len(raw_source) != 2:
            raise ValueError(f"Level {number}: source must contain row and column")
        source = (
            _integer(raw_source[0], "source row", 0, size - 1),
            _integer(raw_source[1], "source column", 0, size - 1),
        )
        raw_pipes = data.get("pipes")
        if not isinstance(raw_pipes, (list, tuple)) or len(raw_pipes) != size:
            raise ValueError(f"Level {number}: pipes must have {size} rows")
        pipes: list[tuple[int, ...]] = []
        for row, raw_row in enumerate(raw_pipes):
            if not isinstance(raw_row, (list, tuple)) or len(raw_row) != size:
                raise ValueError(f"Level {number}: pipe row {row} must have {size} masks")
            pipes.append(tuple(_integer(mask, f"pipe ({row}, {col})", 1, 15)
                               for col, mask in enumerate(raw_row)))
        # Deliberately retain no author solution or unrecognized input fields.
        return cls(number, title, note, size, source, tuple(pipes))


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
            except (OSError, UnicodeError, json.JSONDecodeError) as exc:
                raise ValueError(f"Cannot read level file {path}: {exc}") from exc
    if not isinstance(data, list) or len(data) != LEVEL_COUNT:
        raise ValueError("Exactly six levels are required")
    return tuple(LevelConfig.from_mapping(raw, i + 1) for i, raw in enumerate(data))


@dataclass(frozen=True)
class Geometry:
    cell: int
    span: int
    ox: int
    oy: int

    @classmethod
    def for_size(cls, size: int) -> Geometry:
        cell = 50 // size
        span = cell * size
        return cls(cell, span, (SIZE - span) // 2, (56 - span) // 2)

    def center(self, position: Cell) -> tuple[int, int]:
        row, col = position
        return self.ox + col * self.cell + self.cell // 2, self.oy + row * self.cell + self.cell // 2

    def as_dict(self) -> dict[str, int]:
        return {"cell": self.cell, "span": self.span, "ox": self.ox, "oy": self.oy}


def _fill(frame: Raster, x: int, y: int, width: int, height: int, color: int) -> None:
    for yy in range(max(0, y), min(SIZE, y + height)):
        for xx in range(max(0, x), min(SIZE, x + width)):
            frame[yy][xx] = color


def _outline(frame: Raster, x: int, y: int, width: int, height: int, color: int) -> None:
    _fill(frame, x, y, width, 1, color)
    _fill(frame, x, y + height - 1, width, 1, color)
    _fill(frame, x, y, 1, height, color)
    _fill(frame, x + width - 1, y, 1, height, color)


def _square(frame: Raster, position: tuple[int, int], width: int, color: int) -> None:
    x, y = position
    _fill(frame, x - width // 2, y - width // 2, width, width, color)


class PipesEngine:
    """CustomGameInfo-compatible engine, usable without an external registry.

    info.levels selects the leading campaign prefix (1..6). jump_to_level
    opens an isolated preview and is not an available player action.
    A changed selection increments step_index but not moves. A rotation
    increments both. Selecting a symmetric cross does not count as a
    rotation. Ignored actions increment neither. A level restart increments
    step_index and clears this level's moves and completion bar.
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
        self._setup(0)

    def _setup(self, index: int) -> None:
        self._index = index
        self._config = self._templates[index]
        self._geometry = Geometry.for_size(self._config.size)
        self._pipes = [list(row) for row in self._config.pipes]
        self._selected: Cell | None = None
        self.moves = 0
        self.state = "NOT_FINISHED"

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    def _network(self) -> dict[str, Any]:
        return analyze(self._pipes, self._config.source)

    def _render_frame(self, *, border: bool = False) -> Raster:
        cfg, g = self._config, self._geometry
        frame = [[C_BACKGROUND] * SIZE for _ in range(SIZE)]
        water = self._network()["wet"]
        outer, inner = (7 if g.cell >= 12 else 5), 3
        _fill(frame, g.ox, g.oy, g.span + 1, g.span + 1, C_GRID)
        for row in range(cfg.size):
            for col in range(cfg.size):
                _fill(frame, g.ox + col * g.cell + 1, g.oy + row * g.cell + 1,
                      g.cell - 1, g.cell - 1, C_BOARD)

        def paint(row: int, col: int, width: int, color: int) -> None:
            left, top = g.ox + col * g.cell, g.oy + row * g.cell
            x, y = left + g.cell // 2, top + g.cell // 2
            half, mask = width // 2, self._pipes[row][col]
            _square(frame, (x, y), width, color)
            if mask & 1:
                _fill(frame, x - half, top, width, y - top + 1, color)
            if mask & 2:
                _fill(frame, x, y - half, left + g.cell - x + 1, width, color)
            if mask & 4:
                _fill(frame, x - half, y, width, top + g.cell - y + 1, color)
            if mask & 8:
                _fill(frame, left, y - half, x - left + 1, width, color)

        # Separate outer/inner passes preserve continuous reciprocal arms.
        for row in range(cfg.size):
            for col in range(cfg.size):
                paint(row, col, outer, C_BLUE if water[row][col] else C_GRID)
        for row in range(cfg.size):
            for col in range(cfg.size):
                paint(row, col, inner, C_CYAN if water[row][col] else C_OUTLINE)
        for row in range(cfg.size):
            for col in range(cfg.size):
                if self._pipes[row][col] in (1, 2, 4, 8):
                    center = g.center((row, col))
                    _square(frame, center, outer, C_BLUE if water[row][col] else C_GRID)
                    _square(frame, center, inner + 2, C_CYAN if water[row][col] else C_OUTLINE)
        _outline(frame, g.ox, g.oy, g.span + 1, g.span + 1, C_OUTLINE)
        source_center = g.center(cfg.source)
        _square(frame, source_center, 7, C_BLUE)
        _square(frame, source_center, 3, C_CYAN)
        _square(frame, source_center, 1, C_WHITE)
        if self._selected is not None:
            row, col = self._selected
            _outline(frame, g.ox + col * g.cell + 1, g.oy + row * g.cell + 1,
                     g.cell - 1, g.cell - 1, C_WHITE)
        for i, completed in enumerate(self._completed):
            _fill(frame, 3 + i * 5, 62, 4, 1, C_GREEN if completed else C_GRID)
        if border:
            _outline(frame, 0, 0, SIZE, SIZE, C_GREEN)
        return frame

    def render(self) -> Raster:
        """Return a fresh native frame without advancing or modifying the game."""
        return self._render_frame()

    def _response(self, event: str = "observation", frames: list[Raster] | None = None,
                  **extra: Any) -> dict[str, Any]:
        images = frames if frames is not None else [self._render_frame()]
        available = [7] if self.state == "WIN" else list(range(1, 8))
        target = 1 if self.test_mode else self.win_levels
        net = self._network()
        return {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "custom_family": self.info.family, "wave": WAVE,
            "frame": images[-1], "frames": images, "frame_count": len(images),
            "default_fps": self._fps, "state": self.state, "level": self._index + 1,
            "levels_completed": self.levels_completed, "score": self.levels_completed,
            "win_levels": target, "win_score": target,
            "step_index": self.step_index, "last_action": self.last_action,
            "available_actions": [f"ACTION{i}" for i in available],
            "available_action_ids": available, "full_reset": False,
            "test_mode": self.test_mode, "level_name": self._config.title,
            "moves": self.moves,
            "selected_cell": list(self._selected) if self._selected is not None else None,
            "connected": net["connected"], "total": net["total"],
            "completion": net["connected"] / net["total"],
            "leak_count": net["leakCount"], "cycle_count": net["cycles"],
            "completed": self._completed.copy(), "event": event, **extra,
        }

    def public_state(self) -> dict[str, Any]:
        """Return detached current state; observations do not replay animations."""
        return self._response()

    def observe(self) -> dict[str, Any]:
        return self.public_state()

    def reset(self) -> dict[str, Any]:
        self.test_mode = False
        self._completed = [False] * LEVEL_COUNT
        self.step_index = 0
        self.last_action = "RESET"
        self._setup(0)
        return self._response("reset", full_reset=True)

    def level_reset(self) -> dict[str, Any]:
        self._completed[self._index] = False
        self.step_index += 1
        self.last_action = "ACTION7"
        self._setup(self._index)
        return self._response("restart")

    def _select(self, action_id: int) -> dict[str, Any]:
        if self._selected is None:
            target = (0, 0)
        else:
            dr, dc = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1)}[action_id]
            row, col = self._selected
            end = self._config.size - 1
            target = (max(0, min(end, row + dr)), max(0, min(end, col + dc)))
        if target == self._selected:
            return self._response("ignored")
        self._selected = target
        self.step_index += 1
        self.last_action = f"ACTION{action_id}"
        return self._response("select")

    def _turn(self, position: Cell, action_id: int) -> dict[str, Any]:
        changed_selection = self._selected != position
        row, col = position
        next_mask = rotate(self._pipes[row][col])
        self._selected = position
        if next_mask == self._pipes[row][col]:
            if not changed_selection:
                return self._response("ignored")
            self.step_index += 1
            self.last_action = f"ACTION{action_id}"
            return self._response("select")
        self._pipes[row][col] = next_mask
        self.moves += 1
        self.step_index += 1
        self.last_action = f"ACTION{action_id}"
        if not self._network()["solved"]:
            return self._response("rotate")
        played_level, played_moves = self._index + 1, self.moves
        self._completed[self._index] = True
        frames = [self._render_frame(), self._render_frame(border=True), self._render_frame()]
        if self.test_mode or self.levels_completed >= self.win_levels:
            self.state = "WIN"
            return self._response("win", frames, played_level=played_level, played_moves=played_moves)
        self._setup(self._index + 1)
        frames.append(self._render_frame())
        return self._response("success", frames, played_level=played_level, played_moves=played_moves)

    def action(self, action_id: int | float | str | dict[str, Any],
               data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Apply an ARC action, alias, or {id/action, data} packet."""
        if isinstance(action_id, Mapping):
            packet = action_id
            data = packet.get("data")
            # An explicit null id is invalid; only an absent id uses action.
            action_id = packet.get("id") if "id" in packet else packet.get("action")
        if isinstance(action_id, str):
            aliases = {"RESET": 0, "click": 6, "rotate": 5, "space": 5}
            aliases.update({f"ACTION{i}": i for i in range(1, 8)})
            action_id = aliases.get(action_id, -1)
        if not _is_integer(action_id) or not 0 <= action_id <= 7:
            return self._response("ignored")
        action_id = int(action_id)
        if action_id == 0:
            return self.reset()
        if action_id == ACTION_RESET:
            return self.level_reset()
        if self.state == "WIN":
            return self._response("finished")
        if action_id <= ACTION_RIGHT:
            return self._select(action_id)
        if action_id == ACTION_ROTATE:
            return self._turn(self._selected if self._selected is not None else (0, 0), action_id)
        if not isinstance(data, Mapping):
            return self._response("ignored")
        x, y = data.get("x"), data.get("y")
        g = self._geometry
        if (not _is_integer(x) or not _is_integer(y)
                or not g.ox <= x < g.ox + g.span or not g.oy <= y < g.oy + g.span):
            return self._response("ignored")
        return self._turn(((int(y) - g.oy) // g.cell, (int(x) - g.ox) // g.cell), action_id)

    def step(self, action: int | float | str | dict[str, Any],
             data: dict[str, Any] | None = None) -> dict[str, Any]:
        return self.action(action, data)

    def view(self) -> dict[str, Any]:
        """Return detached visible geometry, current pipes, and network analysis."""
        cfg = self._config
        return {
            "level": self._index + 1, "title": cfg.title, "note": cfg.note, "size": cfg.size,
            "source": list(cfg.source), "pipes": [row.copy() for row in self._pipes],
            "selected": list(self._selected) if self._selected is not None else None,
            "completed": self._completed.copy(), "testMode": self.test_mode,
            "state": self.state, "stepIndex": self.step_index, "moves": self.moves,
            "geometry": self._geometry.as_dict(), **self._network(),
        }

    def metadata(self) -> list[dict[str, Any]]:
        return [{"number": cfg.number, "title": cfg.title, "note": cfg.note,
                 "size": cfg.size} for cfg in self._templates]

    def jump_to_level(self, number: int) -> dict[str, Any]:
        """Open an isolated author preview; earlier levels receive no credit."""
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


__all__ = ["PipesEngine", "analyze", "rotate", "PALETTE", "SIZE", "DIRECTIONS"]


if __name__ == "__main__":
    game = PipesEngine()
    print(json.dumps(game.view(), ensure_ascii=False, indent=2))

