"""COLM — Columns-like falling triple gems with match-3 clears.

Controls:
  ACTION1 ↑ / ACTION5 SPACE — cycle the three gems (bottom → top)
  ACTION2 ↓                 — hard-drop (fall to lock in one action)
  ACTION3 ← / ACTION4 →     — move active column
  ACTION7                   — soft reset level

Board is 6×7. A finite upcoming queue is fully visible on the right; exhausting
it without reaching the clear target soft-resets the level.
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

C_WHITE, C_LGREY, C_MGREY, C_DGREY, C_VDGREY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_PINK, C_RED, C_BLUE, C_CYAN = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_BROWN, C_GREEN, C_PURPLE = 11, 12, 13, 14, 15

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE, ACTION_RESET = 5, 7

FRAME = 64
HUD_H = 6
PLAY_H = FRAME - HUD_H
COLS, ROWS = 6, 7
CELL = 5
BOARD_W = COLS * CELL
BOARD_H = ROWS * CELL
BOARD_X0 = 2
BOARD_Y0 = 2
QUEUE_X0 = BOARD_X0 + BOARD_W + 2
QUEUE_CELL = 2
QUEUE_GAP = 1

JEWEL_COLOR = {
    1: C_RED,
    2: C_YELLOW,
    3: C_GREEN,
    4: C_CYAN,
    5: C_PURPLE,
}

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "columns_match" / "levels"


@dataclass
class Piece:
    col: int
    row: int  # top gem row (occupies row, row+1, row+2)
    gems: list[int]


@dataclass
class LevelState:
    name: str
    n_colors: int
    target_clears: int
    seed: int
    board: list[list[int]] = field(default_factory=list)
    piece: Piece | None = None
    queue: list[list[int]] = field(default_factory=list)  # upcoming triples
    clears: int = 0
    pieces_spawned: int = 0
    failed: bool = False
    rng: random.Random = field(default_factory=random.Random)


def _load_levels() -> list[dict[str, Any]]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [json.loads(p.read_text(encoding="utf-8")) for p in paths]


def _empty_board() -> list[list[int]]:
    return [[0 for _ in range(COLS)] for _ in range(ROWS)]


def _parse_initial(rows: list[str] | None) -> list[list[int]]:
    board = _empty_board()
    if not rows:
        return board
    if len(rows) != ROWS:
        raise ValueError(f"initial board needs {ROWS} rows, got {len(rows)}")
    for r, line in enumerate(rows):
        if len(line) != COLS:
            raise ValueError(f"row {r} length {len(line)} != {COLS}")
        for c, ch in enumerate(line):
            if ch in ".0 ":
                board[r][c] = 0
            else:
                board[r][c] = int(ch)
    return board


class ColumnsMatchEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_levels()
        if len(self._templates) < info.levels:
            raise ValueError(f"expected {info.levels} levels, found {len(self._templates)}")
        self.win_levels = int(info.levels)
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._level: LevelState | None = None
        self._begin_level(0)

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames = None
        self._begin_level(0)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self.last_action = "ACTION7"
        self._pending_frames = None
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        self._begin_level(min(self.levels_completed, self.win_levels - 1))
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        _ = data
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        self.last_action = f"ACTION{aid}"
        if self._level is None or self._level.failed or self._level.piece is None:
            return self.public_state()

        self.step_index += 1
        frames: list[list[list[int]]] = []
        lv = self._level

        if aid in (ACTION_UP, ACTION_SPACE):
            a, b, c = lv.piece.gems
            lv.piece.gems = [c, a, b]
            frames.append(self._render_frame())
        elif aid == ACTION_LEFT:
            if self._can_place(lv.piece.col - 1, lv.piece.row, lv.piece.gems):
                lv.piece.col -= 1
            frames.append(self._render_frame())
        elif aid == ACTION_RIGHT:
            if self._can_place(lv.piece.col + 1, lv.piece.row, lv.piece.gems):
                lv.piece.col += 1
            frames.append(self._render_frame())
        elif aid == ACTION_DOWN:
            # Hard-drop: fall until blocked, then lock.
            while self._can_place(lv.piece.col, lv.piece.row + 1, lv.piece.gems):
                lv.piece.row += 1
            frames.append(self._render_frame())
            frames.extend(self._lock_and_resolve())
        else:
            return self.public_state()

        if frames:
            self._pending_frames = frames
        return self.public_state()

    def _begin_level(self, index: int) -> None:
        raw = self._templates[index]
        seed = int(raw.get("seed", 1000 + index))
        rng = random.Random(seed)
        n_colors = int(raw.get("n_colors", 3))
        queue_len = int(raw.get("queue_len", 8))
        if queue_len < 1:
            raise ValueError("queue_len must be >= 1")

        if raw.get("queue"):
            queue = [list(map(int, trip)) for trip in raw["queue"]]
            for trip in queue:
                if len(trip) != 3:
                    raise ValueError("each queue entry must be 3 gems")
        else:
            queue = [[rng.randint(1, n_colors) for _ in range(3)] for _ in range(queue_len)]

        board = _parse_initial(raw.get("initial"))
        # Resolve any latent matches on seeded boards so the start state is stable.
        while True:
            matched = self._matches_on(board)
            if not matched:
                break
            for r, c in matched:
                board[r][c] = 0
            self._gravity_on(board)

        lv = LevelState(
            name=str(raw.get("name", f"L{index+1:02d}")),
            n_colors=n_colors,
            target_clears=int(raw.get("target_clears", 6)),
            seed=seed,
            board=board,
            queue=queue,
            rng=rng,
        )
        self._level = lv
        if not self._spawn_piece():
            lv.failed = True

    @staticmethod
    def _matches_on(board: list[list[int]]) -> set[tuple[int, int]]:
        hit: set[tuple[int, int]] = set()
        dirs = [(0, 1), (1, 0), (1, 1), (1, -1)]
        for r in range(ROWS):
            for c in range(COLS):
                v = board[r][c]
                if v == 0:
                    continue
                for dr, dc in dirs:
                    run = [(r, c)]
                    rr, cc = r + dr, c + dc
                    while 0 <= rr < ROWS and 0 <= cc < COLS and board[rr][cc] == v:
                        run.append((rr, cc))
                        rr += dr
                        cc += dc
                    if len(run) >= 3:
                        hit.update(run)
        return hit

    @staticmethod
    def _gravity_on(board: list[list[int]]) -> None:
        for c in range(COLS):
            stack = [board[r][c] for r in range(ROWS) if board[r][c] != 0]
            pad = ROWS - len(stack)
            for r in range(ROWS):
                board[r][c] = 0 if r < pad else stack[r - pad]

    def _spawn_piece(self) -> bool:
        """Pop the next queued triple onto the board. False if queue empty or blocked."""
        assert self._level is not None
        lv = self._level
        if not lv.queue:
            lv.piece = None
            return False
        gems = lv.queue.pop(0)
        col = COLS // 2
        row = 0
        if not self._can_place(col, row, gems):
            lv.piece = None
            # Put it back so the visible queue stays consistent on fail frame
            lv.queue.insert(0, gems)
            return False
        lv.piece = Piece(col=col, row=row, gems=list(gems))
        lv.pieces_spawned += 1
        return True

    def _can_place(self, col: int, row: int, gems: list[int]) -> bool:
        assert self._level is not None
        if col < 0 or col >= COLS:
            return False
        for i in range(3):
            r = row + i
            if r < 0:
                continue
            if r >= ROWS:
                return False
            if self._level.board[r][col] != 0:
                return False
        return True

    def _soft_fail(self, frames: list[list[list[int]]]) -> list[list[list[int]]]:
        assert self._level is not None
        self._level.failed = True
        frames.append(self._flash_border(C_RED))
        idx = min(self.levels_completed, self.win_levels - 1)
        self._begin_level(idx)
        frames.append(self._render_frame())
        return frames

    def _lock_and_resolve(self) -> list[list[list[int]]]:
        assert self._level is not None and self._level.piece is not None
        lv = self._level
        frames: list[list[list[int]]] = []
        p = lv.piece
        for i, g in enumerate(p.gems):
            r = p.row + i
            if 0 <= r < ROWS:
                lv.board[r][p.col] = g
        lv.piece = None
        frames.append(self._render_frame())

        while True:
            matched = self._find_matches()
            if not matched:
                break
            for r, c in matched:
                if lv.board[r][c] != 0:
                    lv.clears += 1
                    lv.board[r][c] = 0
            frames.append(self._render_flash(matched))
            self._apply_gravity()
            frames.append(self._render_frame())

        if lv.clears >= lv.target_clears:
            frames.append(self._flash_border(C_GREEN))
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
                frames.append(self._render_frame())
            else:
                self._begin_level(self.levels_completed)
                frames.append(self._render_frame())
            return frames

        # Queue exhausted → reset level (as requested).
        if not lv.queue:
            return self._soft_fail(frames)

        if not self._spawn_piece():
            return self._soft_fail(frames)

        frames.append(self._render_frame())
        return frames

    def _find_matches(self) -> set[tuple[int, int]]:
        assert self._level is not None
        board = self._level.board
        hit: set[tuple[int, int]] = set()
        dirs = [(0, 1), (1, 0), (1, 1), (1, -1)]
        for r in range(ROWS):
            for c in range(COLS):
                v = board[r][c]
                if v == 0:
                    continue
                for dr, dc in dirs:
                    run = [(r, c)]
                    rr, cc = r + dr, c + dc
                    while 0 <= rr < ROWS and 0 <= cc < COLS and board[rr][cc] == v:
                        run.append((rr, cc))
                        rr += dr
                        cc += dc
                    if len(run) >= 3:
                        hit.update(run)
        return hit

    def _apply_gravity(self) -> None:
        assert self._level is not None
        for c in range(COLS):
            stack = [self._level.board[r][c] for r in range(ROWS) if self._level.board[r][c] != 0]
            pad = ROWS - len(stack)
            for r in range(ROWS):
                self._level.board[r][c] = 0 if r < pad else stack[r - pad]

    # --- render ---------------------------------------------------------------

    def _paint_board(self, frame: list[list[int]], *, ghost: bool = True) -> None:
        assert self._level is not None
        lv = self._level
        for r in range(ROWS):
            for c in range(COLS):
                self._blit_cell(frame, r, c, lv.board[r][c])
        if ghost and lv.piece is not None:
            for i, g in enumerate(lv.piece.gems):
                self._blit_cell(frame, lv.piece.row + i, lv.piece.col, g, outline=True)

    def _blit_cell(
        self,
        frame: list[list[int]],
        row: int,
        col: int,
        jewel: int,
        *,
        outline: bool = False,
    ) -> None:
        if row < 0 or row >= ROWS or col < 0 or col >= COLS:
            return
        y0 = BOARD_Y0 + row * CELL
        x0 = BOARD_X0 + col * CELL
        fill = JEWEL_COLOR.get(jewel, C_DGREY) if jewel else C_VDGREY
        for dy in range(CELL):
            for dx in range(CELL):
                yy, xx = y0 + dy, x0 + dx
                if not (0 <= yy < PLAY_H and 0 <= xx < FRAME):
                    continue
                edge = dy in (0, CELL - 1) or dx in (0, CELL - 1)
                if jewel == 0:
                    frame[yy][xx] = C_BLACK if not edge else C_DGREY
                elif edge and outline:
                    frame[yy][xx] = C_WHITE
                elif edge:
                    frame[yy][xx] = C_MGREY
                else:
                    frame[yy][xx] = fill

    def _draw_queue(self, frame: list[list[int]]) -> None:
        """Draw every upcoming column to the right of the board."""
        assert self._level is not None
        x = QUEUE_X0
        y0 = BOARD_Y0
        for trip in self._level.queue:
            if x + QUEUE_CELL > FRAME - 1:
                break
            for i, g in enumerate(trip):
                yy0 = y0 + i * (QUEUE_CELL + 1)
                fill = JEWEL_COLOR.get(g, C_WHITE)
                for dy in range(QUEUE_CELL):
                    for dx in range(QUEUE_CELL):
                        yy, xx = yy0 + dy, x + dx
                        if 0 <= yy < PLAY_H and 0 <= xx < FRAME:
                            frame[yy][xx] = fill
            x += QUEUE_CELL + QUEUE_GAP

    def _render_frame(self) -> list[list[int]]:
        frame = [[C_BLACK for _ in range(FRAME)] for _ in range(FRAME)]
        self._paint_board(frame)
        self._draw_queue(frame)
        self._draw_hud(frame)
        return frame

    def _render_flash(self, cells: set[tuple[int, int]]) -> list[list[int]]:
        frame = self._render_frame()
        for r, c in cells:
            y0 = BOARD_Y0 + r * CELL
            x0 = BOARD_X0 + c * CELL
            for dy in range(CELL):
                for dx in range(CELL):
                    yy, xx = y0 + dy, x0 + dx
                    if 0 <= yy < PLAY_H and 0 <= xx < FRAME:
                        frame[yy][xx] = C_WHITE
        return frame

    def _flash_border(self, color: int) -> list[list[int]]:
        frame = self._render_frame()
        for y in range(BOARD_Y0, min(BOARD_Y0 + BOARD_H, PLAY_H)):
            for x in (BOARD_X0, BOARD_X0 + BOARD_W - 1):
                if 0 <= x < FRAME:
                    frame[y][x] = color
        for x in range(BOARD_X0, BOARD_X0 + BOARD_W):
            for y in (BOARD_Y0, min(BOARD_Y0 + BOARD_H - 1, PLAY_H - 1)):
                frame[y][x] = color
        return frame

    def _draw_hud(self, frame: list[list[int]]) -> None:
        assert self._level is not None
        for y in range(PLAY_H, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_VDGREY
        lv = self._level
        target = max(1, lv.target_clears)
        filled = min(FRAME - 4, int((FRAME - 4) * min(lv.clears, target) / target))
        bar_y = FRAME - 5
        for x in range(2, FRAME - 2):
            frame[bar_y][x] = C_GREEN if x - 2 < filled else C_DGREY
            frame[bar_y + 1][x] = frame[bar_y][x]
        pip_y = FRAME - 2
        total = self.win_levels
        width = total * 2 + (total - 1)
        x0 = max(1, (FRAME - width) // 2)
        for i in range(total):
            fill = C_DGREY
            if i < self.levels_completed or self.state == "WIN":
                fill = C_GREEN
            elif i == self.levels_completed:
                fill = C_CYAN
            xx = x0 + i * 3
            if 0 <= xx < FRAME:
                frame[pip_y][xx] = fill
                if xx + 1 < FRAME:
                    frame[pip_y][xx + 1] = fill

    def public_state(self) -> dict[str, Any]:
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
        else:
            frames = [self._render_frame()]
        level_num = min(self.levels_completed + 1, self.win_levels)
        available = (
            ["ACTION7"]
            if self.state == "WIN"
            else ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "ACTION7"]
        )
        multi = len(frames) > 1
        lv = self._level
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frames[-1],
            "frames": frames,
            "frame_count": len(frames),
            "transition_frame_interval_ms": 70 if multi else None,
            "default_fps": max(self.info.default_fps, 12 if multi else self.info.default_fps),
            "state": self.state,
            "level": level_num,
            "levels_completed": self.levels_completed,
            "win_levels": self.win_levels,
            "step_index": self.step_index,
            "available_actions": available,
            "available_action_ids": [int(a.removeprefix("ACTION")) for a in available],
            "last_action": self.last_action,
            "score": self.levels_completed,
            "full_reset": False,
            "source_path": str(LEVELS_DIR),
            "custom_family": self.info.family,
            "level_name": lv.name if lv else "",
            "clears": lv.clears if lv else 0,
            "target_clears": lv.target_clears if lv else 0,
            "queue_remaining": len(lv.queue) if lv else 0,
            "cols": COLS,
            "rows": ROWS,
        }

    def cycle(self) -> dict[str, Any]:
        return self.action(ACTION_SPACE)

    def move_left(self) -> dict[str, Any]:
        return self.action(ACTION_LEFT)

    def move_right(self) -> dict[str, Any]:
        return self.action(ACTION_RIGHT)

    def soft_drop(self) -> dict[str, Any]:
        return self.action(ACTION_DOWN)
