"""ZIPP — Zip (custom_3), a deterministic 64 × 64 path-covering puzzle.

Starting at the blue square, visit every cell once and reach the green exit
last. Move orthogonally and never cross a wall. Walls block shared edges;
all cells remain part of the puzzle. There are no numbered checkpoints,
time limits, action limits, random choices, or hidden-answer comparisons.

ACTION1/2/3/4 move up/down/left/right. ACTION5 (Space or undo) removes the
last step. ACTION6 clicks native x/y coordinates in 0..63: click a legal
neighbor to extend the path, or click any earlier path cell to rewind to it.
Directional actions check walls before rewinding, while clicking an earlier
cell is an explicit undo command. ACTION7 restarts the current level;
RESET or action(0) restarts the campaign. Numeric action IDs and coordinates
must have integer values; booleans, fractions, and nonfinite values are ignored.

The interface follows the supplied EvasionEngine CustomGameInfo contract.
Frames are 64 rows of 64 palette indices (0..15). Accepted actions return
their full animation immediately: a rejected move flashes red, and each
success has one green border pulse. Six separate completion bars and the
current grid's completion gauge are drawn into the native frame. Repeated
observations are read-only and do not replay the preceding animation.

All six levels are embedded, so this file works alone with Python 3.10+ and
the standard library. An explicit levels_dir must contain L01.json through
L06.json; malformed overrides raise an error. Only visible geometry enters
the runtime: authoring-only fields such as solution are discarded.
"""

from __future__ import annotations

import json
import math
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

FRAME = SIZE = 64
LEVEL_COUNT = 6
GAME_ID = "zipp-c3000001"
FAMILY = "zip"
WAVE = "custom_3"
ANIM_FPS = 10
ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_UNDO = ACTION_SPACE = 5
ACTION_CLICK, ACTION_RESET = 6, 7
GAUGE = {"x": 34, "y": 59, "w": 28, "h": 5}

C_WHITE, C_WALL, C_GRID, C_OUTLINE, C_BACKGROUND, C_BOARD = 0, 1, 2, 3, 4, 5
C_VISITED, C_RED, C_START, C_CYAN, C_PATH, C_GREEN = 6, 8, 9, 10, 12, 14
PALETTE = (
    "#F3F2EB", "#C9CDC8", "#37404B", "#66707B", "#1B2028", "#11161C",
    "#614439", "#E7B9A3", "#F06B65", "#679DEB", "#63D5D6", "#F1CE62",
    "#EBA258", "#86513A", "#77CB93", "#BB94EB",
)
Raster = list[list[int]]
Cell = tuple[int, int]
Wall = tuple[Cell, Cell]

_BUILTIN_LEVELS = [
    {
        "number": 1, "title": "Premier détour",
        "note": "Contourne le premier mur et rejoins la sortie après avoir couvert toute la grille.",
        "size": 3, "start": [0, 0], "end": [2, 2],
        "walls": [[[0, 1], [1, 1]]],
    },
    {
        "number": 2, "title": "Retour par le bord",
        "note": "Partir du bas et revenir vers la sortie du même côté ; contourner les deux murs en conservant une route vers le bord supérieur.",
        "size": 4, "start": [3, 0], "end": [0, 0],
        "walls": [[[0, 1], [1, 1]], [[1, 1], [1, 2]]],
    },
    {
        "number": 3, "title": "Arrivée intérieure",
        "note": "Réserver la dernière entrée vers la sortie intérieure. Les trois segments de mur imposent un détour entre les deux moitiés de la grille.",
        "size": 4, "start": [0, 0], "end": [1, 2],
        "walls": [[[1, 1], [1, 2]], [[1, 2], [2, 2]], [[1, 1], [2, 1]]],
    },
    {
        "number": 4, "title": "Départ au centre",
        "note": "Choisis l’ordre de visite depuis le centre et évite de laisser une poche inaccessible.",
        "size": 4, "start": [1, 1], "end": [0, 3],
        "walls": [
            [[0, 1], [1, 1]], [[2, 0], [2, 1]],
            [[1, 1], [1, 2]], [[2, 2], [2, 3]],
        ],
    },
    {
        "number": 5, "title": "Garder un passage",
        "note": "Sur une grille plus grande, franchir les passages autour de la petite barrière centrale au bon moment et garder un accès à la zone restante.",
        "size": 5, "start": [0, 2], "end": [4, 0],
        "walls": [
            [[2, 2], [2, 3]], [[2, 2], [3, 2]],
            [[2, 3], [3, 3]], [[3, 1], [3, 2]],
        ],
    },
    {
        "number": 6, "title": "L’ordre des zones",
        "note": "Combiner un départ central, des barrières décalées et une sortie en coin ; terminer les zones intérieures avant de refermer le parcours par le bord.",
        "size": 5, "start": [2, 2], "end": [4, 4],
        "walls": [
            [[1, 2], [2, 2]], [[2, 2], [2, 3]],
            [[3, 3], [4, 3]], [[3, 1], [4, 1]],
            [[2, 0], [2, 1]], [[1, 2], [1, 3]],
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


def _distance(a: Cell, b: Cell) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def _edge_key(a: Cell, b: Cell, size: int) -> tuple[int, int]:
    first, second = a[0] * size + a[1], b[0] * size + b[1]
    return (first, second) if first <= second else (second, first)


@dataclass(frozen=True)
class _StandaloneInfo:
    game_id: str = GAME_ID
    title: str = "Zip"
    family: str = FAMILY
    levels: int = LEVEL_COUNT
    default_fps: int = ANIM_FPS


@dataclass(frozen=True)
class LevelConfig:
    number: int
    title: str
    note: str
    size: int
    start: Cell
    end: Cell
    walls: tuple[Wall, ...]

    @classmethod
    def from_mapping(cls, data: Mapping[str, Any], number: int) -> LevelConfig:
        if not isinstance(data, Mapping):
            raise ValueError(f"Level {number} must be an object")
        if "number" in data:
            actual = _integer(data["number"], "number", 1, LEVEL_COUNT)
            if actual != number:
                raise ValueError(f"Expected level number {number}, got {actual}")
        size = _integer(data.get("size"), "size", 2, 6)
        title = data.get("title", "Zip")
        note = data.get("note", "")
        if not isinstance(title, str) or not isinstance(note, str):
            raise ValueError(f"Level {number}: title and note must be text")
        title = title or "Zip"

        def cell(raw: Any, label: str) -> Cell:
            if not isinstance(raw, (list, tuple)) or len(raw) != 2:
                raise ValueError(f"Level {number}: {label} must contain row and column")
            return (
                _integer(raw[0], f"{label} row", 0, size - 1),
                _integer(raw[1], f"{label} column", 0, size - 1),
            )

        start, end = cell(data.get("start"), "start"), cell(data.get("end"), "end")
        if start == end:
            raise ValueError(f"Level {number}: start and end must differ")
        raw_walls = data.get("walls")
        if not isinstance(raw_walls, (list, tuple)):
            raise ValueError(f"Level {number}: walls must be an array")
        walls: list[Wall] = []
        seen: set[tuple[int, int]] = set()
        for i, raw in enumerate(raw_walls):
            if not isinstance(raw, (list, tuple)) or len(raw) != 2:
                raise ValueError(f"Level {number}: wall {i} must contain two cells")
            a, b = cell(raw[0], f"wall {i}"), cell(raw[1], f"wall {i}")
            if _distance(a, b) != 1:
                raise ValueError(f"Level {number}: wall {i} must join orthogonal neighbors")
            key = _edge_key(a, b, size)
            if key in seen:
                raise ValueError(f"Level {number}: duplicate wall {i}")
            seen.add(key)
            walls.append((a, b))
        # Deliberately retain no author solution or unrecognized input fields.
        return cls(number, title, note, size, start, end, tuple(walls))


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


def _segment(frame: Raster, start: tuple[int, int], end: tuple[int, int],
             width: int, color: int) -> None:
    x0, y0 = start
    x1, y1 = end
    _fill(frame, min(x0, x1) - width // 2, min(y0, y1) - width // 2,
          abs(x1 - x0) + width, abs(y1 - y0) + width, color)


class ZipEngine:
    """CustomGameInfo-compatible engine, usable without an external registry.

    info.levels selects the leading campaign prefix (1..6). jump_to_level
    opens an isolated preview and is never an available player action.
    Accepted path mutations increment moves and step_index. Level restarts
    increment step_index and reset moves; ignored or blocked commands do
    neither. Completion is the fraction of grid cells in the current path.
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
        self._path: list[Cell] = [self._config.start]
        self._wall_set = {_edge_key(a, b, self._config.size) for a, b in self._config.walls}
        self.moves = 0
        self.state = "NOT_FINISHED"

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    def _inside(self, position: Cell) -> bool:
        return all(_is_integer(v) and 0 <= v < self._config.size for v in position)

    def _blocked(self, first: Cell, second: Cell) -> bool:
        return _edge_key(first, second, self._config.size) in self._wall_set

    def _available_forward(self) -> list[list[int]]:
        row, col = self._path[-1]
        result = []
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            target = (row + dr, col + dc)
            if (self._inside(target) and not self._blocked(self._path[-1], target)
                    and target not in self._path
                    and (target != self._config.end or len(self._path) + 1 == self._config.size ** 2)):
                result.append(list(target))
        return result

    def _render_frame(self, *, border: bool = False, invalid_cell: Cell | None = None) -> Raster:
        cfg, g = self._config, self._geometry
        frame = [[C_BACKGROUND] * SIZE for _ in range(SIZE)]
        _fill(frame, g.ox, g.oy, g.span + 1, g.span + 1, C_GRID)
        for row in range(cfg.size):
            for col in range(cfg.size):
                _fill(frame, g.ox + col * g.cell + 1, g.oy + row * g.cell + 1,
                      g.cell - 1, g.cell - 1, C_BOARD)
        for row, col in self._path:
            _fill(frame, g.ox + col * g.cell + 2, g.oy + row * g.cell + 2,
                  g.cell - 3, g.cell - 3, C_VISITED)
        thickness = 5 if g.cell >= 12 else 3
        for i, position in enumerate(self._path):
            _square(frame, g.center(position), thickness, C_PATH)
            if i:
                _segment(frame, g.center(self._path[i - 1]), g.center(position), thickness, C_PATH)
        for a, b in cfg.walls:
            if a[0] == b[0]:
                _fill(frame, g.ox + max(a[1], b[1]) * g.cell - 1, g.oy + a[0] * g.cell,
                      3, g.cell + 1, C_WALL)
            else:
                _fill(frame, g.ox + a[1] * g.cell, g.oy + max(a[0], b[0]) * g.cell - 1,
                      g.cell + 1, 3, C_WALL)
        _outline(frame, g.ox, g.oy, g.span + 1, g.span + 1, C_OUTLINE)
        _square(frame, g.center(cfg.start), 5, C_START)
        ex, ey = g.center(cfg.end)
        _outline(frame, ex - 3, ey - 3, 7, 7, C_GREEN)
        full = len(self._path) == cfg.size ** 2
        if full:
            _square(frame, (ex, ey), 3, C_GREEN)
        hx, hy = g.center(self._path[-1])
        _outline(frame, hx - 3, hy - 3, 7, 7, C_WHITE)
        if invalid_cell is not None:
            row, col = invalid_cell if self._inside(invalid_cell) else self._path[-1]
            _outline(frame, g.ox + col * g.cell + 1, g.oy + row * g.cell + 1,
                     g.cell - 1, g.cell - 1, C_RED)
        for i, completed in enumerate(self._completed):
            _fill(frame, 3 + i * 5, 62, 4, 1, C_GREEN if completed else C_GRID)
        _fill(frame, GAUGE["x"], GAUGE["y"], GAUGE["w"], GAUGE["h"], C_BOARD)
        _outline(frame, GAUGE["x"], GAUGE["y"], GAUGE["w"], GAUGE["h"], C_OUTLINE)
        filled = (GAUGE["w"] - 2) * len(self._path) // (cfg.size ** 2)
        _fill(frame, GAUGE["x"] + 1, GAUGE["y"] + 1, filled, GAUGE["h"] - 2,
              C_GREEN if full else C_CYAN)
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
        total = self._config.size ** 2
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
            "moves": self.moves, "path": [list(p) for p in self._path],
            "head": list(self._path[-1]), "visited": len(self._path), "total": total,
            "completion": len(self._path) / total, "completed": self._completed.copy(),
            "event": event, **extra,
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

    def _reject(self, reason: str, position: Cell) -> dict[str, Any]:
        return self._response("blocked", [self._render_frame(invalid_cell=position), self._render_frame()],
                              reason=reason)

    def _rewind(self, position: int, action_id: int) -> dict[str, Any]:
        if position == len(self._path) - 1:
            return self._response("ignored")
        self._path = self._path[:position + 1]
        self.moves += 1
        self.step_index += 1
        self.last_action = f"ACTION{action_id}"
        return self._response("undo")

    def _step_to(self, position: Cell, action_id: int) -> dict[str, Any]:
        head = self._path[-1]
        if not self._inside(position):
            return self._reject("boundary", head)
        if _distance(head, position) != 1:
            return self._response("ignored", reason="not_adjacent")
        if self._blocked(head, position):
            return self._reject("wall", position)
        if position in self._path:
            return self._rewind(self._path.index(position), action_id)
        if position == self._config.end and len(self._path) + 1 != self._config.size ** 2:
            return self._reject("early_exit", position)
        self._path.append(position)
        self.moves += 1
        self.step_index += 1
        self.last_action = f"ACTION{action_id}"
        if len(self._path) != self._config.size ** 2 or self._path[-1] != self._config.end:
            return self._response("move")
        played_level, played_moves = self._index + 1, self.moves
        self._completed[self._index] = True
        frames = [self._render_frame(), self._render_frame(border=True), self._render_frame()]
        if self.test_mode or self.levels_completed >= self.win_levels:
            self.state = "WIN"
            return self._response("win", frames, played_level=played_level, played_moves=played_moves)
        self._setup(self._index + 1)
        frames.append(self._render_frame())
        return self._response("success", frames, played_level=played_level, played_moves=played_moves)

    def _tap(self, position: Cell) -> dict[str, Any]:
        if position in self._path:
            return self._rewind(self._path.index(position), ACTION_CLICK)
        return self._step_to(position, ACTION_CLICK)

    def action(self, action_id: int | float | str | dict[str, Any],
               data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Apply an ARC action, alias, or {id/action, data} packet."""
        if isinstance(action_id, Mapping):
            packet = action_id
            data = packet.get("data")
            # An explicit null id is invalid; only an absent id uses action.
            action_id = packet.get("id") if "id" in packet else packet.get("action")
        if isinstance(action_id, str):
            aliases = {"RESET": 0, "click": 6, "undo": 5, "space": 5}
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
        if action_id == ACTION_UNDO:
            return self._rewind(len(self._path) - 2, action_id) if len(self._path) > 1 else self._response("ignored")
        if action_id <= ACTION_RIGHT:
            dr, dc = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1)}[action_id]
            row, col = self._path[-1]
            return self._step_to((row + dr, col + dc), action_id)
        if not isinstance(data, Mapping):
            return self._response("ignored")
        x, y = data.get("x"), data.get("y")
        g = self._geometry
        if (not _is_integer(x) or not _is_integer(y)
                or not g.ox <= x < g.ox + g.span or not g.oy <= y < g.oy + g.span):
            return self._response("ignored")
        return self._tap(((int(y) - g.oy) // g.cell, (int(x) - g.ox) // g.cell))

    def step(self, action: int | float | str | dict[str, Any],
             data: dict[str, Any] | None = None) -> dict[str, Any]:
        return self.action(action, data)

    def view(self) -> dict[str, Any]:
        """Return visible board geometry and the player's current path."""
        cfg = self._config
        total = cfg.size ** 2
        return {
            "level": self._index + 1, "title": cfg.title, "note": cfg.note, "size": cfg.size,
            "start": list(cfg.start), "end": list(cfg.end),
            "walls": [[list(a), list(b)] for a, b in cfg.walls],
            "path": [list(p) for p in self._path], "head": list(self._path[-1]),
            "visited": len(self._path), "total": total, "completion": len(self._path) / total,
            "completed": self._completed.copy(), "testMode": self.test_mode,
            "state": self.state, "stepIndex": self.step_index, "moves": self.moves,
            "geometry": self._geometry.as_dict(), "canForward": self._available_forward(),
        }

    def metadata(self) -> list[dict[str, Any]]:
        return [{"number": cfg.number, "title": cfg.title, "note": cfg.note,
                 "size": cfg.size, "walls": len(cfg.walls)} for cfg in self._templates]

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


__all__ = ["ZipEngine", "PALETTE", "SIZE", "GAUGE"]


if __name__ == "__main__":
    game = ZipEngine()
    print(json.dumps(game.view(), ensure_ascii=False, indent=2))
