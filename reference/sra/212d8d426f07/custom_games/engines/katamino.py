"""Six introductory Katamino-style levels for the supplied ARC3 custom backend.

Same engine boundary as ColorGlassEngine: reset(), level_reset(), action(id, data),
public_state(); 64x64 integer-palette frames. No arcengine / network dependency.

ACTION1..4 move the held piece by one cell; ACTION5 rotates it clockwise.
ACTION6 picks up / switches / drops a movable piece, or hits a bottom icon.
ACTION7 restarts the current level. Bottom icons: rotate, mirror, U/D/L/R.
A level completes as soon as the board is a valid full tiling (held piece OK).
Budget exhaustion plays a short fail flash then soft-resets the current level.

White (0) = held cells. Light grey (1) = held cells blocked by another piece or
crossing the board boundary. Piece colours are always chromatic; 0..5 forbidden.
"""
from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Protocol


class GameInfoLike(Protocol):
    """The same info fields used by the supplied custom_games.registry object."""
    game_id: str
    title: str
    family: str
    levels: int
    default_fps: int


@dataclass(frozen=True)
class StandaloneGameInfo:
    game_id: str = "kata-c0000001"
    title: str = "KATA"
    family: str = "pentomino_packing"
    levels: int = 6
    default_fps: int = 8


FRAME = 64
CELL = 5
WORLD_ROWS, WORLD_COLS = 10, 12
ORIGIN_Y, ORIGIN_X = 2, 2
HUD_Y = 60
# Keep the exact palette convention in the supplied color_glass.py.
C_WHITE, C_CONFLICT = 0, 1
C_OUTLINE, C_GRID, C_BOARD, C_BG = 2, 3, 4, 5
C_HUD, C_DONE, C_BUDGET = 4, 14, 11
C_FAIL = 8  # red flash on budget exhaustion
CHROMATIC_COLORS = frozenset({6, 8, 9, 10, 11, 12, 14})
NAMED_COLORS = {"M": 6, "R": 8, "B": 9, "C": 10, "Y": 11, "O": 12, "G": 14}

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_ROTATE, ACTION_CLICK, ACTION_RESET = 5, 6, 7
DELTAS = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1)}
# Rectangles are (left, top, right_exclusive, bottom_exclusive), in frame pixels.
# Compact row: rotate | flip | up | down | left | right (no green return arrow).
BUTTON_ROTATE = (1, 53, 10, 60)
BUTTON_FLIP = (11, 53, 20, 60)
BUTTON_UP = (22, 53, 31, 60)
BUTTON_DOWN = (32, 53, 41, 60)
BUTTON_LEFT = (42, 53, 51, 60)
BUTTON_RIGHT = (52, 53, 61, 60)
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "katamino" / "levels"
Cell = tuple[int, int]
Cells = tuple[Cell, ...]


def normalize(cells: Iterable[Cell]) -> Cells:
    cells = tuple(cells)
    if not cells:
        raise ValueError("a piece cannot be empty")
    r0 = min(r for r, _ in cells)
    c0 = min(c for _, c in cells)
    return tuple(sorted((r - r0, c - c0) for r, c in cells))


def rotate_cw(cells: Iterable[Cell]) -> Cells:
    """Rotate about the bounding box, then normalize; keep its world corner."""
    return normalize((c, -r) for r, c in cells)


def mirror(cells: Iterable[Cell]) -> Cells:
    """Reflect horizontally in the current bounding box."""
    return normalize((r, -c) for r, c in cells)


def cell_center(row: int, col: int) -> tuple[int, int]:
    """Return ACTION6 (x, y), not (row, col)."""
    return ORIGIN_X + col * CELL + CELL // 2, ORIGIN_Y + row * CELL + CELL // 2


def _integer(value: Any, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{label} must be an integer")
    return value


def _inside_world(cells: Iterable[Cell]) -> bool:
    return all(0 <= r < WORLD_ROWS and 0 <= c < WORLD_COLS for r, c in cells)


def _connected(cells: Cells) -> bool:
    remaining = set(cells)
    pending = [remaining.pop()]
    while pending:
        r, c = pending.pop()
        for dr, dc in DELTAS.values():
            neighbor = (r + dr, c + dc)
            if neighbor in remaining:
                remaining.remove(neighbor)
                pending.append(neighbor)
    return not remaining


@dataclass
class Piece:
    piece_id: str
    color: int
    cells: Cells
    row: int
    col: int
    fixed: bool = False
    kind: str = ""

    def absolute_cells(self) -> Cells:
        return tuple((self.row + r, self.col + c) for r, c in self.cells)


@dataclass(frozen=True)
class PickupPose:
    cells: Cells
    row: int
    col: int


@dataclass
class LevelState:
    name: str
    rows: int
    cols: int
    pieces: list[Piece]
    max_steps: int
    selected_id: str | None = None
    pickup_pose: PickupPose | None = None

    def board_cells(self) -> set[Cell]:
        return {(r, c) for r in range(self.rows) for c in range(self.cols)}


def _load_level(path: Path) -> LevelState:
    """Reject bad dimensions, non-pentominoes, grey colours and invalid spawns.

    A solution witness is deliberately NOT read by the engine. Winning means
    exact geometric coverage, not matching a pre-recorded arrangement.
    """
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        rows = _integer(raw["board"]["rows"], "board.rows")
        cols = _integer(raw["board"]["cols"], "board.cols")
        if not (1 <= rows <= WORLD_ROWS and 1 <= cols <= WORLD_COLS):
            raise ValueError("board exceeds the work area")
        max_steps = _integer(raw.get("max_steps", 240), "max_steps")
        if max_steps <= 0:
            raise ValueError("max_steps must be positive")
        pieces: list[Piece] = []
        seen_ids: set[str] = set()
        seen_colors: set[int] = set()
        occupied: set[Cell] = set()
        board = {(r, c) for r in range(rows) for c in range(cols)}
        for p in raw["pieces"]:
            pid = p["id"]
            if not isinstance(pid, str) or not pid or pid in seen_ids:
                raise ValueError("piece IDs must be unique nonempty strings")
            color = p["color"]
            if isinstance(color, str):
                color = NAMED_COLORS.get(color.upper(), -1)
            color = _integer(color, f"{pid}.color")
            if color not in CHROMATIC_COLORS:
                raise ValueError(f"{pid}: no white, grey or black pieces; use {sorted(CHROMATIC_COLORS)}")
            if color in seen_colors:
                raise ValueError("each piece must have its own colour within a level")
            values = p["cells"]
            if not isinstance(values, list) or len(values) != 5:
                raise ValueError(f"{pid}: a pentomino has exactly five cells")
            cells_list = []
            for pair in values:
                if not isinstance(pair, list) or len(pair) != 2:
                    raise ValueError(f"{pid}.cells must contain [row, col] pairs")
                cells_list.append((_integer(pair[0], "cell row"), _integer(pair[1], "cell col")))
            cells = tuple(sorted(cells_list))
            if len(set(cells)) != 5 or not _connected(cells):
                raise ValueError(f"{pid}: cells must be distinct and edge-connected")
            if cells != normalize(cells):
                raise ValueError(f"{pid}: relative cells must be normalized to min row=col=0")
            fixed = p.get("fixed", False)
            if not isinstance(fixed, bool):
                raise ValueError(f"{pid}.fixed must be boolean")
            piece = Piece(pid, color, cells, _integer(p["row"], "row"),
                          _integer(p["col"], "col"), fixed, str(p.get("kind", pid)))
            world = set(piece.absolute_cells())
            if not _inside_world(world):
                raise ValueError(f"{pid}: spawn leaves the visible work area")
            if occupied & world:
                raise ValueError(f"{pid}: spawn overlaps another piece")
            inside = world & board
            if inside and inside != world:
                raise ValueError(f"{pid}: spawn crosses the board boundary")
            if fixed and inside != world:
                raise ValueError(f"{pid}: a fixed hint must be on the board")
            occupied |= world
            seen_ids.add(pid)
            seen_colors.add(color)
            pieces.append(piece)
        if len(pieces) * 5 != rows * cols:
            raise ValueError("piece area must exactly equal board area")
        if not any(not p.fixed for p in pieces):
            raise ValueError("at least one piece must remain movable")
        if occupied == board:
            raise ValueError("level must not start already solved")
        return LevelState(str(raw.get("name", path.stem)), rows, cols, pieces, max_steps)
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Invalid Katamino level {path.name}: {exc}") from exc


class KataminoEngine:
    def __init__(self, info: GameInfoLike | None = None, *,
                 levels_dir: str | Path | None = None, animate: bool = True) -> None:
        self.info = info if info is not None else StandaloneGameInfo()
        self.win_levels = _integer(self.info.levels, "info.levels")
        if not 1 <= self.win_levels <= 6:
            raise ValueError("this release supports 1..6 levels")
        if self.info.default_fps <= 0:
            raise ValueError("info.default_fps must be positive")
        self.levels_dir = Path(levels_dir) if levels_dir is not None else LEVELS_DIR
        paths = [self.levels_dir / f"L{i:02d}.json" for i in range(1, self.win_levels + 1)]
        self._templates = [_load_level(p) for p in paths]
        self.animate = animate
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.last_action = "RESET"
        self.last_event = "RESET"
        self.state = "NOT_FINISHED"
        self._level = deepcopy(self._templates[0])

    def reset(self) -> dict[str, Any]:
        """Full game reset, exactly as in the supplied engine interface."""
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.last_action = self.last_event = "RESET"
        self.state = "NOT_FINISHED"
        self._level = deepcopy(self._templates[0])
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        """Restart the current level. After WIN, replay level 6, not level 1."""
        self.levels_completed = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[self.levels_completed])
        self.level_steps = 0
        self.step_index += 1
        self.last_action = "ACTION7"
        self.last_event = "LEVEL_RESET"
        self.state = "NOT_FINISHED"
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Exactly one discrete state update; malformed inputs cannot move pieces."""
        if isinstance(action_id, bool):
            return self.public_state()
        try:
            aid = int(action_id)
        except (TypeError, ValueError, OverflowError):
            return self.public_state()
        # Reject fractional IDs rather than silently truncating them.
        if isinstance(action_id, float) and action_id != aid:
            return self.public_state()
        if aid == ACTION_RESET:
            return self.level_reset()
        if aid not in range(1, 7) or self.state != "NOT_FINISHED":
            return self.public_state()
        if aid == ACTION_CLICK:
            if not isinstance(data, dict):
                return self.public_state()
            x, y = data.get("x"), data.get("y")
            if (isinstance(x, bool) or isinstance(y, bool) or not isinstance(x, int)
                    or not isinstance(y, int) or not (0 <= x < FRAME and 0 <= y < FRAME)):
                return self.public_state()
        self.last_action = f"ACTION{aid}"
        self.step_index += 1
        self.level_steps += 1
        self.last_event = "NO_SELECTION"
        if aid in DELTAS:
            self._move_selected(*DELTAS[aid])
        elif aid == ACTION_ROTATE:
            self._transform_selected(reflect=False)
        else:
            self._click(x, y)
        # A valid full tiling wins immediately, even while the last piece is held.
        if self._is_solved():
            return self._complete_level()
        if self.level_steps >= self._level.max_steps:
            return self._budget_exhausted()
        return self.public_state()

    def _selected(self) -> Piece | None:
        return next((p for p in self._level.pieces if p.piece_id == self._level.selected_id), None)

    def _other_occupied(self, selected: Piece) -> set[Cell]:
        return {cell for p in self._level.pieces if p is not selected for cell in p.absolute_cells()}

    def _invalid_cells(self, selected: Piece) -> set[Cell]:
        """The single collision/boundary predicate shared by painting and dropping."""
        cells = set(selected.absolute_cells())
        blocked = cells & self._other_occupied(selected)
        blocked |= {(r, c) for r, c in cells if not _inside_world(((r, c),))}
        board = self._level.board_cells()
        if cells & board and not cells <= board:
            # A piece may be entirely in the reserve, but cannot straddle the rim.
            blocked |= cells - board
        return blocked

    def _can_drop(self) -> bool:
        selected = self._selected()
        return selected is not None and not self._invalid_cells(selected)

    @staticmethod
    def _in_rect(x: int, y: int, rect: tuple[int, int, int, int]) -> bool:
        left, top, right, bottom = rect
        return left <= x < right and top <= y < bottom

    def _click(self, x: int, y: int) -> None:
        if self._in_rect(x, y, BUTTON_ROTATE):
            self._transform_selected(reflect=False)
            return
        if self._in_rect(x, y, BUTTON_FLIP):
            self._transform_selected(reflect=True)
            return
        if self._in_rect(x, y, BUTTON_UP):
            self._move_selected(-1, 0)
            return
        if self._in_rect(x, y, BUTTON_DOWN):
            self._move_selected(1, 0)
            return
        if self._in_rect(x, y, BUTTON_LEFT):
            self._move_selected(0, -1)
            return
        if self._in_rect(x, y, BUTTON_RIGHT):
            self._move_selected(0, 1)
            return
        if not (ORIGIN_X <= x < ORIGIN_X + WORLD_COLS * CELL
                and ORIGIN_Y <= y < ORIGIN_Y + WORLD_ROWS * CELL):
            self.last_event = "IGNORED_CLICK"
            return
        cell = ((y - ORIGIN_Y) // CELL, (x - ORIGIN_X) // CELL)
        hit = next(
            (p for p in reversed(self._level.pieces) if cell in p.absolute_cells()),
            None,
        )
        selected = self._selected()
        if selected is not None:
            # Switch only when the click is on another movable and not on the
            # held piece itself (overlap cells still attempt drop / stay held).
            switch_to = (
                hit if (
                    hit is not None
                    and hit is not selected
                    and not hit.fixed
                    and cell not in selected.absolute_cells()
                ) else None
            )
            if switch_to is not None:
                if self._can_drop():
                    self._drop_selected()
                else:
                    self._return_selected()
                self._level.selected_id = switch_to.piece_id
                self._level.pickup_pose = PickupPose(
                    switch_to.cells, switch_to.row, switch_to.col
                )
                self.last_event = "SWITCHED"
                return
            # Same piece, empty cell, fixed hint, or overlap cell: release only.
            self._drop_selected()
            return
        if hit is not None:
            if hit.fixed:
                self.last_event = "FIXED_PIECE"
                return
            self._level.selected_id = hit.piece_id
            self._level.pickup_pose = PickupPose(hit.cells, hit.row, hit.col)
            self.last_event = "PICKED_UP"
            return
        self.last_event = "EMPTY_CLICK"

    def _drop_selected(self) -> None:
        selected = self._selected()
        if selected is None:
            return
        if self._invalid_cells(selected):
            if set(selected.absolute_cells()) & self._other_occupied(selected):
                self.last_event = "DROP_BLOCKED_OVERLAP"
            else:
                self.last_event = "DROP_BLOCKED_BOUNDARY"
            return  # Do not clear selected_id or pickup_pose on failure.
        self._level.selected_id = None
        self._level.pickup_pose = None
        self.last_event = "DROPPED"

    def _move_selected(self, dr: int, dc: int) -> None:
        selected = self._selected()
        if selected is None:
            return
        cells = [(r + dr, c + dc) for r, c in selected.absolute_cells()]
        if not _inside_world(cells):
            self.last_event = "WORKSPACE_EDGE"
            return
        # Overlap is allowed while held, so its invalid cells can be previewed.
        selected.row += dr
        selected.col += dc
        self.last_event = "MOVED"

    def _transform_selected(self, *, reflect: bool) -> None:
        selected = self._selected()
        if selected is None:
            return
        cells = mirror(selected.cells) if reflect else rotate_cw(selected.cells)
        if not _inside_world((selected.row + r, selected.col + c) for r, c in cells):
            self.last_event = "WORKSPACE_EDGE"
            return
        selected.cells = cells
        self.last_event = "MIRRORED" if reflect else "ROTATED"

    def _return_selected(self) -> None:
        selected, pose = self._selected(), self._level.pickup_pose
        if selected is None or pose is None:
            return
        # Safe: no other piece can move during this single held-piece session.
        selected.cells, selected.row, selected.col = pose.cells, pose.row, pose.col
        self._level.selected_id = None
        self._level.pickup_pose = None
        self.last_event = "RETURNED"

    def _is_solved(self) -> bool:
        """True when every board cell is covered exactly once (held piece counts)."""
        board = self._level.board_cells()
        occupied: set[Cell] = set()
        for piece in self._level.pieces:
            cells = set(piece.absolute_cells())
            if not cells <= board or occupied & cells:
                return False
            occupied |= cells
        return occupied == board

    def _anim_hold(self) -> int:
        return max(1, round(self.info.default_fps / 4))

    def _with_settled_transition(
        self,
        result: dict[str, Any],
        prefix: list[list[list[int]]],
    ) -> dict[str, Any]:
        """Play prefix frames, then hold the settled frame so the UI shows it."""
        if not self.animate:
            return result
        settled = result["frame"]
        hold = self._anim_hold()
        # Several copies of the settled frame: UI transition playback ends here
        # without requiring an extra click to reveal the next/reset board.
        frames = list(prefix)
        frames.extend(deepcopy(settled) for _ in range(max(3, hold * 2)))
        out = dict(result)
        out["frames"] = frames
        out["frame_count"] = len(frames)
        out["frame"] = frames[-1]
        out["transition_frame_interval_ms"] = 1000 / max(1, self.info.default_fps)
        return out

    def _complete_level(self) -> dict[str, Any]:
        solved = self._render_frame()
        rows, cols = self._level.rows, self._level.cols
        # Clear hold so WIN / next-level state never keeps a ghost selection.
        self._level.selected_id = None
        self._level.pickup_pose = None
        self.levels_completed += 1
        if self.levels_completed == self.win_levels:
            self.state = "WIN"
        else:
            self._level = deepcopy(self._templates[self.levels_completed])
            self.level_steps = 0
        self.last_event = "GAME_WON" if self.state == "WIN" else "LEVEL_COMPLETE"
        result = self.public_state()
        highlighted = deepcopy(solved)
        self._outline(
            highlighted,
            ORIGIN_Y - 1,
            ORIGIN_X - 1,
            rows * CELL + 2,
            cols * CELL + 2,
            C_DONE,
        )
        hold = self._anim_hold()
        prefix: list[list[list[int]]] = [deepcopy(solved) for _ in range(hold * 2)]
        for _ in range(2):
            prefix.extend(deepcopy(highlighted) for _ in range(hold))
            prefix.extend(deepcopy(solved) for _ in range(hold))
        return self._with_settled_transition(result, prefix)

    def _budget_exhausted(self) -> dict[str, Any]:
        """Flash the failed board, then soft-reset the current level in-place."""
        failed = self._render_frame()
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[idx])
        self.level_steps = 0
        self.state = "NOT_FINISHED"
        self.last_event = "BUDGET_EXHAUSTED"
        result = self.public_state()
        flash = deepcopy(failed)
        for y in range(HUD_Y):
            for x in range(FRAME):
                if flash[y][x] != C_BG:
                    flash[y][x] = C_FAIL
        hold = self._anim_hold()
        prefix: list[list[list[int]]] = []
        for _ in range(3):
            prefix.extend(deepcopy(flash) for _ in range(hold))
            prefix.extend(deepcopy(failed) for _ in range(hold))
        return self._with_settled_transition(result, prefix)

    def public_state(self) -> dict[str, Any]:
        frame = self._render_frame()
        ids = list(range(1, 8)) if self.state == "NOT_FINISHED" else [7]
        return {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "frame": frame, "frames": [frame], "frame_count": 1,
            "default_fps": self.info.default_fps, "state": self.state,
            "level": min(self.levels_completed + 1, self.win_levels),
            "levels_completed": self.levels_completed, "win_levels": self.win_levels,
            "step_index": self.step_index,
            "available_actions": [f"ACTION{i}" for i in ids],
            "available_action_ids": ids, "last_action": self.last_action,
            "score": self.levels_completed, "full_reset": False,
            "source_path": str(self.levels_dir), "custom_family": self.info.family,
            "level_name": self._level.name, "level_steps": self.level_steps,
            "max_steps": self._level.max_steps,
            "selected_piece": self._level.selected_id,
            "can_drop": self._can_drop(), "last_event": self.last_event,
        }

    def _render_frame(self) -> list[list[int]]:
        frame = [[C_BG] * FRAME for _ in range(FRAME)]
        # An empty grey cavity, not a coloured solution or target-piece legend.
        for r, c in self._level.board_cells():
            self._paint_cell(frame, r, c, C_BOARD)
            y, x = ORIGIN_Y + r * CELL, ORIGIN_X + c * CELL
            for k in range(CELL):
                frame[y][x + k] = C_GRID
                frame[y + k][x] = C_GRID
        self._outline(frame, ORIGIN_Y - 1, ORIGIN_X - 1,
                      self._level.rows * CELL + 2, self._level.cols * CELL + 2, C_OUTLINE)
        selected = self._selected()
        for p in self._level.pieces:
            if p is selected:
                continue
            for r, c in p.absolute_cells():
                self._paint_cell(frame, r, c, p.color)
            # One small black pin identifies a fixed hint, without greying it.
            if p.fixed:
                x, y = cell_center(*p.absolute_cells()[0])
                frame[y][x] = C_BG
        if selected is not None:
            blocked = self._invalid_cells(selected)
            for cell in selected.absolute_cells():
                self._paint_cell(frame, *cell, C_CONFLICT if cell in blocked else C_WHITE)
        # Clickable icons; they do not need new ARC action IDs.
        self._button(frame, BUTTON_ROTATE, (".XXX.", "X...X", "X.XXX", "X....", ".XXX."), 10)
        self._button(frame, BUTTON_FLIP, (".X.X.", "XX.XX", "XXXXX", "XX.XX", ".X.X."), 12)
        self._button(frame, BUTTON_UP, ("..X..", ".XXX.", "X.X.X", "..X..", "..X.."), 9)
        self._button(frame, BUTTON_DOWN, ("..X..", "..X..", "X.X.X", ".XXX.", "..X.."), 9)
        self._button(frame, BUTTON_LEFT, ("..X..", ".X...", "XXXXX", ".X...", "..X.."), 9)
        self._button(frame, BUTTON_RIGHT, ("..X..", "...X.", "XXXXX", "...X.", "..X.."), 9)
        for y in range(HUD_Y, FRAME):
            frame[y] = [C_HUD] * FRAME
        remaining = max(0, self._level.max_steps - self.level_steps)
        budget_width = (remaining * FRAME + self._level.max_steps - 1) // self._level.max_steps
        for x in range(budget_width):
            frame[HUD_Y][x] = C_BUDGET
        slot_width = 56 // self.win_levels
        for i in range(self.win_levels):
            color = C_DONE if i < self.levels_completed else C_GRID
            for x in range(4 + i * slot_width, 4 + (i + 1) * slot_width - 2):
                frame[62][x] = color
        return frame

    @staticmethod
    def _paint_cell(frame: list[list[int]], r: int, c: int, color: int) -> None:
        y0, x0 = ORIGIN_Y + r * CELL, ORIGIN_X + c * CELL
        for y in range(y0, y0 + CELL):
            for x in range(x0, x0 + CELL):
                if 0 <= y < HUD_Y and 0 <= x < FRAME:
                    frame[y][x] = color

    @staticmethod
    def _outline(frame: list[list[int]], r0: int, c0: int, h: int, w: int, color: int) -> None:
        for r in range(r0, r0 + h):
            for c in range(c0, c0 + w):
                if (r in (r0, r0 + h - 1) or c in (c0, c0 + w - 1)) and 0 <= r < FRAME and 0 <= c < FRAME:
                    frame[r][c] = color

    @classmethod
    def _button(cls, frame: list[list[int]], rect: tuple[int, int, int, int],
                pattern: tuple[str, ...], color: int) -> None:
        left, top, right, bottom = rect
        cls._outline(frame, top, left, bottom - top, right - left, C_GRID)
        x0 = (left + right - len(pattern[0])) // 2
        for dy, row in enumerate(pattern):
            for dx, bit in enumerate(row):
                if bit == "X":
                    frame[top + 1 + dy][x0 + dx] = color
