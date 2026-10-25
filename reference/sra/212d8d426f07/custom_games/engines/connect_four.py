"""CONN — Connect Four (puissance 4) vs scripted adversary.

Controls:
  ACTION6 click — drop in the column under the click
  ACTION7       — soft reset current level

L01: four didactic mini-boards (V / H / diag-up / diag-down); one click each.
L02–L06: one 7×6 board, player first, AI difficulty scales by level JSON.
"""

from __future__ import annotations

import json
import random
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from custom_games.registry import CustomGameInfo

# ARC palette
C_WHITE = 0
C_LGREY = 1
C_MGREY = 2
C_DGREY = 3
C_VDGREY = 4
C_BLACK = 5
C_MAGENTA = 6
C_PINK = 7
C_RED = 8
C_BLUE = 9
C_CYAN = 10
C_YELLOW = 11
C_ORANGE = 12
C_GREEN = 14

C_BG = C_BLACK
C_GRID = C_DGREY
C_HUD = C_VDGREY
C_HUD_DONE = C_GREEN
C_HUD_SLOT = C_DGREY
C_HUD_CUR = C_YELLOW
C_FLASH = C_RED
C_PLAYER = C_YELLOW
C_ENEMY = C_RED

ACTION_CLICK, ACTION_RESET = 6, 7
FRAME = 64
HUD_H = 5
PLAY_H = FRAME - HUD_H
COLS, ROWS = 7, 6
WIN_N = 4
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "connect_four" / "levels"

Cell = Literal[0, 1, 2]  # empty, player, enemy
Board = list[list[int]]  # board[row][col], row 0 = bottom


@dataclass
class DidacticPuzzle:
    kind: str
    board: Board
    win_col: int
    solved: bool = False


@dataclass
class LevelConfig:
    name: str
    mode: Literal["didactic", "versus"]
    ai_level: int
    puzzles: list[dict[str, Any]]
    seed: int


@dataclass
class LevelState:
    cfg: LevelConfig
    # versus
    board: Board = field(default_factory=list)
    turn: Literal["player", "ai", "over"] = "player"
    winner: Literal["none", "player", "ai", "draw"] = "none"
    # didactic
    puzzles: list[DidacticPuzzle] = field(default_factory=list)
    rng: random.Random = field(default_factory=random.Random)


def _empty_board() -> Board:
    return [[0 for _ in range(COLS)] for _ in range(ROWS)]


def _parse_board(rows_top_down: list[str]) -> Board:
    """Parse 6 strings of length 7, top→bottom display, into bottom-up board."""
    if len(rows_top_down) != ROWS:
        raise ValueError(f"need {ROWS} rows, got {len(rows_top_down)}")
    grid = _empty_board()
    for r_top, line in enumerate(rows_top_down):
        if len(line) != COLS:
            raise ValueError(f"row width {len(line)} != {COLS}")
        r = ROWS - 1 - r_top
        for c, ch in enumerate(line):
            if ch in (".", " ", "0"):
                grid[r][c] = 0
            elif ch in ("Y", "y", "P", "p", "1"):
                grid[r][c] = 1
            elif ch in ("R", "r", "E", "e", "2"):
                grid[r][c] = 2
            else:
                raise ValueError(f"bad cell {ch!r}")
    return grid


def _load_level(path: Path) -> LevelConfig:
    data = json.loads(path.read_text(encoding="utf-8"))
    mode = str(data.get("mode", "versus"))
    if mode not in ("didactic", "versus"):
        raise ValueError(f"bad mode {mode}")
    return LevelConfig(
        name=str(data.get("name") or path.stem),
        mode=mode,  # type: ignore[arg-type]
        ai_level=int(data.get("ai_level", 1)),
        puzzles=list(data.get("puzzles", [])),
        seed=int(data.get("seed", 1)),
    )


def _load_all_levels() -> list[LevelConfig]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


def _clone_board(board: Board) -> Board:
    return [row[:] for row in board]


def _drop_row(board: Board, col: int) -> int | None:
    if col < 0 or col >= COLS:
        return None
    for r in range(ROWS):
        if board[r][col] == 0:
            return r
    return None


def _apply_drop(board: Board, col: int, who: int) -> int | None:
    r = _drop_row(board, col)
    if r is None:
        return None
    board[r][col] = who
    return r


def _legal_cols(board: Board) -> list[int]:
    return [c for c in range(COLS) if _drop_row(board, c) is not None]


def _winner_at(board: Board, r: int, c: int) -> int:
    who = board[r][c]
    if who == 0:
        return 0
    dirs = ((1, 0), (0, 1), (1, 1), (1, -1))
    for dr, dc in dirs:
        count = 1
        for sign in (-1, 1):
            rr, cc = r + sign * dr, c + sign * dc
            while 0 <= rr < ROWS and 0 <= cc < COLS and board[rr][cc] == who:
                count += 1
                rr += sign * dr
                cc += sign * dc
        if count >= WIN_N:
            return who
    return 0


def _board_winner(board: Board) -> int:
    for r in range(ROWS):
        for c in range(COLS):
            if board[r][c] and _winner_at(board, r, c):
                return board[r][c]
    return 0


def _is_winning_drop(board: Board, col: int, who: int) -> bool:
    b = _clone_board(board)
    r = _apply_drop(b, col, who)
    if r is None:
        return False
    return _winner_at(b, r, c=col) == who


# --- AI ------------------------------------------------------------------------

def _winning_cols(board: Board, who: int) -> list[int]:
    return [c for c in _legal_cols(board) if _is_winning_drop(board, c, who)]


def _ai_random(board: Board, rng: random.Random) -> int:
    cols = _legal_cols(board)
    return rng.choice(cols) if cols else 0


def _ai_block(board: Board, rng: random.Random) -> int:
    threats = _winning_cols(board, 1)
    if threats:
        return threats[0]
    return _ai_random(board, rng)


def _ai_win_or_block(board: Board, rng: random.Random) -> int:
    wins = _winning_cols(board, 2)
    if wins:
        return wins[0]
    threats = _winning_cols(board, 1)
    if threats:
        return threats[0]
    return _ai_random(board, rng)


def _count_dir(board: Board, r: int, c: int, dr: int, dc: int, who: int) -> int:
    n = 0
    rr, cc = r + dr, c + dc
    while 0 <= rr < ROWS and 0 <= cc < COLS and board[rr][cc] == who:
        n += 1
        rr += dr
        cc += dc
    return n


def _score_cell(board: Board, r: int, c: int, who: int) -> int:
    """Explicit threat-oriented score for a hypothetical disc at (r,c)."""
    if board[r][c] != 0:
        return -10**6
    score = 0
    # center preference (especially bottom control)
    score += (3 - abs(c - 3)) * 3
    if r == 0:
        score += 4
    dirs = ((1, 0), (0, 1), (1, 1), (1, -1))
    for dr, dc in dirs:
        a = _count_dir(board, r, c, dr, dc, who)
        b = _count_dir(board, r, c, -dr, -dc, who)
        run = a + b
        if run >= 3:
            score += 100
        elif run == 2:
            score += 14
        elif run == 1:
            score += 4
        for sign, n in ((1, a), (-1, b)):
            rr = r + sign * dr * (n + 1)
            cc = c + sign * dc * (n + 1)
            if 0 <= rr < ROWS and 0 <= cc < COLS and board[rr][cc] == 0:
                score += 2
    return score


def _opponent_can_make_fork(board: Board, who: int = 1) -> bool:
    """True if `who` has a legal drop that leaves them with 2+ immediate wins."""
    for c in _legal_cols(board):
        b = _clone_board(board)
        r = _apply_drop(b, c, who)
        if r is None:
            continue
        if _winner_at(b, r, c) == who:
            continue
        if len(_winning_cols(b, who)) >= 2:
            return True
    return False


def _ai_strategic(board: Board, rng: random.Random, *, defense: int = 1) -> int:
    """Win/block, then deny forks (e.g. bottom .YYY.), then scored play.

    `defense` raises how hard we penalize giving the opponent a double threat.
    """
    wins = _winning_cols(board, 2)
    if wins:
        return rng.choice(wins)
    blocks = _winning_cols(board, 1)
    if blocks:
        # If already a fork against us, block one (lost unless we can win).
        return rng.choice(blocks)

    candidates: list[tuple[int, int]] = []
    for c in _legal_cols(board):
        b = _clone_board(board)
        r = _apply_drop(b, c, 2)
        if r is None:
            continue
        # Never leave an immediate loss.
        if _winning_cols(b, 1):
            continue
        # Never leave an already-present fork for the opponent.
        if len(_winning_cols(b, 1)) >= 2:
            continue

        s = _score_cell(board, r, c, 2) * 2 - _score_cell(board, r, c, 1)

        # Own threats created now.
        own_threats = len(_winning_cols(b, 2))
        s += own_threats * 50

        # Deny opponent reply that sets up .YYY.-style double threat.
        if _opponent_can_make_fork(b, 1):
            s -= 800 * defense

        # Contest bottom-row builds: sit next to opponent pairs on row 0.
        bottom = board[0]
        if r == 0:
            left = bottom[c - 1] if c > 0 else 0
            right = bottom[c + 1] if c < COLS - 1 else 0
            if left == 1 or right == 1:
                s += 25 * defense
            if left == 1 and right == 1:
                s += 40 * defense  # split a YY gap

        candidates.append((s, c))

    if not candidates:
        # All moves lose immediately somehow — play any legal.
        return _ai_random(board, rng)

    best_s = max(s for s, _c in candidates)
    best = [c for s, c in candidates if s == best_s]
    return rng.choice(best)


def _ai_threat_center(board: Board, rng: random.Random) -> int:
    return _ai_strategic(board, rng, defense=1)


def _ai_strong(board: Board, rng: random.Random) -> int:
    return _ai_strategic(board, rng, defense=2)


def _ai_choose(board: Board, ai_level: int, rng: random.Random) -> int:
    if ai_level <= 1:
        return _ai_random(board, rng)
    if ai_level == 2:
        return _ai_block(board, rng)
    if ai_level == 3:
        return _ai_win_or_block(board, rng)
    if ai_level == 4:
        return _ai_threat_center(board, rng)
    return _ai_strong(board, rng)


class ConnectFourEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_all_levels()
        if len(self._templates) < info.levels:
            raise ValueError(
                f"expected {info.levels} levels, found {len(self._templates)}"
            )
        self.win_levels = int(info.levels)
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._level = self._new_level_state(0)

    def _new_level_state(self, level_index: int) -> LevelState:
        cfg = self._templates[level_index]
        rng = random.Random(cfg.seed + level_index * 17 + self.levels_completed)
        lv = LevelState(cfg=cfg, rng=rng)
        if cfg.mode == "didactic":
            for raw in cfg.puzzles:
                lv.puzzles.append(
                    DidacticPuzzle(
                        kind=str(raw.get("kind", "?")),
                        board=_parse_board(list(raw["board"])),
                        win_col=int(raw["win_col"]),
                    )
                )
        else:
            lv.board = _empty_board()
            lv.turn = "player"
            lv.winner = "none"
        return lv

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames = None
        self._level = self._new_level_state(0)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = self._new_level_state(idx)
        self.last_action = "ACTION7"
        self._pending_frames = None
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        data = dict(data or {})
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        self.last_action = f"ACTION{aid}"
        if aid != ACTION_CLICK:
            return self.public_state()
        self.step_index += 1
        frames = self._click(int(data.get("x", -1)), int(data.get("y", -1)))
        if frames:
            self._pending_frames = frames
        return self.public_state()

    # --- geometry ---------------------------------------------------------------

    def _versus_geom(self) -> tuple[int, int, int, int]:
        """Return cell, ox, oy, gap for the single board."""
        cell, gap = 6, 1
        bw = COLS * cell + (COLS - 1) * gap
        bh = ROWS * cell + (ROWS - 1) * gap
        ox = (FRAME - bw) // 2
        oy = 4 + (PLAY_H - 8 - bh) // 2
        return cell, ox, oy, gap

    def _didactic_geom(self, index: int) -> tuple[int, int, int, int]:
        """2×2 layout of mini boards; cell=2."""
        cell, gap, margin = 2, 1, 2
        bw = COLS * cell + (COLS - 1) * gap
        bh = ROWS * cell + (ROWS - 1) * gap
        # quadrants in play area
        qw, qh = FRAME // 2, (PLAY_H - 2) // 2
        row_i, col_i = divmod(index, 2)
        ox = col_i * qw + (qw - bw) // 2
        oy = 2 + row_i * qh + (qh - bh) // 2
        return cell, ox, oy, gap

    def _col_from_click(
        self, x: int, y: int, ox: int, oy: int, cell: int, gap: int
    ) -> int | None:
        bw = COLS * cell + (COLS - 1) * gap
        bh = ROWS * cell + (ROWS - 1) * gap
        if not (ox <= x < ox + bw and oy - 2 <= y < oy + bh + 2):
            # allow click slightly above board for column select
            if not (ox <= x < ox + bw and oy - 6 <= y < oy + bh + 2):
                return None
        step = cell + gap
        local = x - ox
        col = local // step
        if col < 0 or col >= COLS:
            return None
        # reject clicks in the gap zone only when clearly between cells
        return int(col)

    # --- turns ------------------------------------------------------------------

    def _advance_level(self, frames: list[list[list[int]]]) -> None:
        frames.extend(self._win_frames())
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
        else:
            self._level = self._new_level_state(self.levels_completed)
            self.state = "NOT_FINISHED"
            frames.append(self._render_frame())

    def _click(self, x: int, y: int) -> list[list[list[int]]] | None:
        lv = self._level
        if lv.cfg.mode == "didactic":
            return self._click_didactic(x, y)
        return self._click_versus(x, y)

    def _click_didactic(self, x: int, y: int) -> list[list[list[int]]] | None:
        lv = self._level
        frames: list[list[list[int]]] = []
        for i, pz in enumerate(lv.puzzles):
            if pz.solved:
                continue
            cell, ox, oy, gap = self._didactic_geom(i)
            col = self._col_from_click(x, y, ox, oy, cell, gap)
            if col is None:
                continue
            r = _apply_drop(pz.board, col, 1)
            if r is None:
                return None
            frames.extend(self._drop_frames(pz.board, i, r, col))
            if col != pz.win_col:
                # Show the landing and red error flash before removing the token.
                frames.append(self._render_frame(flash_puzzle=i))
                pz.board[r][col] = 0
                frames.append(self._render_frame())
                return frames
            if _winner_at(pz.board, r, col) != 1:
                # Should not happen if puzzles are well-authored; undo.
                pz.board[r][col] = 0
                frames.append(self._render_frame(flash_puzzle=i))
                return frames
            pz.solved = True
            frames.append(self._render_frame())
            if all(p.solved for p in lv.puzzles):
                self._advance_level(frames)
            return frames
        return None

    def _click_versus(self, x: int, y: int) -> list[list[list[int]]] | None:
        lv = self._level
        if lv.turn != "player":
            return None
        cell, ox, oy, gap = self._versus_geom()
        col = self._col_from_click(x, y, ox, oy, cell, gap)
        if col is None:
            return None
        frames: list[list[list[int]]] = []
        r = _apply_drop(lv.board, col, 1)
        if r is None:
            return None
        frames.extend(self._drop_frames(lv.board, -1, r, col))
        if _winner_at(lv.board, r, col) == 1:
            lv.winner = "player"
            lv.turn = "over"
            self._advance_level(frames)
            return frames
        if not _legal_cols(lv.board):
            lv.winner = "draw"
            lv.turn = "over"
            frames.extend(self._fail_frames())
            return frames

        # AI turn
        lv.turn = "ai"
        ai_col = _ai_choose(lv.board, lv.cfg.ai_level, lv.rng)
        ar = _apply_drop(lv.board, ai_col, 2)
        if ar is not None:
            frames.extend(self._drop_frames(lv.board, -1, ar, ai_col))
            if _winner_at(lv.board, ar, ai_col) == 2:
                lv.winner = "ai"
                lv.turn = "over"
                frames.extend(self._fail_frames())
                return frames
        if not _legal_cols(lv.board):
            lv.winner = "draw"
            lv.turn = "over"
            frames.extend(self._fail_frames())
            return frames
        lv.turn = "player"
        frames.append(self._render_frame())
        return frames

    def _drop_frames(
        self, board: Board, puzzle: int, row: int, col: int,
    ) -> list[list[list[int]]]:
        """Render a committed token falling without changing the logical board."""
        cell, ox, oy, gap = self._didactic_geom(puzzle) if puzzle >= 0 else self._versus_geom()
        base = self._render_frame(hidden_cell=(puzzle, row, col))
        ink = C_PLAYER if board[row][col] == 1 else C_ENEMY
        x0 = ox + col * (cell + gap)
        destination = (ROWS - 1 - row) * (cell + gap)
        stride = max(1, (cell + gap) // 2)
        frames = []
        for offset in range(-cell, destination, stride):
            frame = [line[:] for line in base]
            for dy in range(cell):
                for dx in range(cell):
                    x, y = x0 + dx, oy + offset + dy
                    if 0 <= x < FRAME and 0 <= y < PLAY_H:
                        frame[y][x] = ink
            frames.append(frame)
        landed = self._render_frame()
        frames.extend([landed] * 3)
        return frames

    def _fail_frames(self) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        base = self._render_frame()
        for i in range(4):
            if i % 2 == 0:
                frames.append(self._recolor_nonbg(base, C_FLASH))
            else:
                frames.append([row[:] for row in base])
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = self._new_level_state(idx)
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        frames.append(self._render_frame())
        return frames

    def _win_frames(self) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        base = self._render_frame()
        for _ in range(3):
            frames.append(self._recolor_nonbg(base, C_WHITE))
            frames.append([row[:] for row in base])
            frames.append([row[:] for row in base])
        return frames

    @staticmethod
    def _recolor_nonbg(frame: list[list[int]], color: int) -> list[list[int]]:
        out = [row[:] for row in frame]
        for y in range(FRAME):
            for x in range(FRAME):
                if out[y][x] != C_BG:
                    out[y][x] = color
        return out

    def public_state(self) -> dict[str, Any]:
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
            frame = frames[-1]
        else:
            frame = self._render_frame()
            frames = [frame]
        level_num = min(self.levels_completed + 1, self.win_levels)
        available = ["ACTION6", "ACTION7"]
        if self.state == "WIN":
            available = ["ACTION7"]
        lv = self._level
        solved = sum(1 for p in lv.puzzles if p.solved) if lv.puzzles else None
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frame,
            "frames": frames,
            "frame_count": len(frames),
            "transition_frame_interval_ms": 80 if len(frames) > 1 else None,
            "default_fps": max(
                self.info.default_fps, 8 if len(frames) > 1 else self.info.default_fps
            ),
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
            "level_name": lv.cfg.name,
            "mode": lv.cfg.mode,
            "ai_level": lv.cfg.ai_level,
            "turn": lv.turn,
            "winner": lv.winner,
            "didactic_solved": solved,
            "didactic_total": len(lv.puzzles) if lv.puzzles else 0,
        }

    # --- render -----------------------------------------------------------------

    def _render_frame(
        self,
        *,
        flash_puzzle: int | None = None,
        pulse_cell: tuple[int, int, int] | None = None,
        hidden_cell: tuple[int, int, int] | None = None,
    ) -> list[list[int]]:
        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]
        lv = self._level
        if lv.cfg.mode == "didactic":
            for i, pz in enumerate(lv.puzzles):
                cell, ox, oy, gap = self._didactic_geom(i)
                flash = flash_puzzle == i
                pulse = None
                if pulse_cell and pulse_cell[0] == i:
                    pulse = (pulse_cell[1], pulse_cell[2])
                self._draw_board(
                    frame, pz.board, ox, oy, cell, gap, flash=flash, pulse=pulse,
                    hidden=hidden_cell[1:] if hidden_cell and hidden_cell[0] == i else None,
                )
                # kind label as 1px tick colour in corner
                self._draw_kind_mark(frame, ox - 1, oy - 1, pz.kind, solved=pz.solved)
        else:
            cell, ox, oy, gap = self._versus_geom()
            pulse = None
            if pulse_cell and pulse_cell[0] == -1:
                pulse = (pulse_cell[1], pulse_cell[2])
            self._draw_board(
                frame, lv.board, ox, oy, cell, gap, pulse=pulse,
                hidden=hidden_cell[1:] if hidden_cell and hidden_cell[0] == -1 else None,
            )
        self._draw_hud(frame)
        return frame

    def _draw_kind_mark(
        self, frame: list[list[int]], x: int, y: int, kind: str, *, solved: bool
    ) -> None:
        col = C_GREEN if solved else C_LGREY
        # tiny 2×2 marker
        for dy in range(2):
            for dx in range(2):
                xx, yy = x + dx, y + dy
                if 0 <= xx < FRAME and 0 <= yy < PLAY_H:
                    frame[yy][xx] = col

    def _draw_board(
        self,
        frame: list[list[int]],
        board: Board,
        ox: int,
        oy: int,
        cell: int,
        gap: int,
        *,
        flash: bool = False,
        pulse: tuple[int, int] | None = None,
        hidden: tuple[int, int] | None = None,
    ) -> None:
        bw = COLS * cell + (COLS - 1) * gap
        bh = ROWS * cell + (ROWS - 1) * gap
        # board well
        for yy in range(oy, oy + bh):
            for xx in range(ox, ox + bw):
                if 0 <= yy < PLAY_H and 0 <= xx < FRAME:
                    frame[yy][xx] = C_FLASH if flash else C_VDGREY
        for r in range(ROWS):
            for c in range(COLS):
                # visual row: top is ROWS-1
                vr = ROWS - 1 - r
                x0 = ox + c * (cell + gap)
                y0 = oy + vr * (cell + gap)
                who = board[r][c]
                if hidden == (r, c):
                    ink = C_BG
                elif pulse and pulse == (r, c):
                    ink = C_WHITE
                elif who == 1:
                    ink = C_PLAYER
                elif who == 2:
                    ink = C_ENEMY
                else:
                    ink = C_BG
                for dy in range(cell):
                    for dx in range(cell):
                        xx, yy = x0 + dx, y0 + dy
                        if 0 <= yy < PLAY_H and 0 <= xx < FRAME:
                            frame[yy][xx] = ink
        # column separators faint
        for c in range(1, COLS):
            xx = ox + c * (cell + gap) - gap
            for yy in range(oy, oy + bh):
                if gap > 0 and 0 <= yy < PLAY_H and 0 <= xx < FRAME:
                    frame[yy][xx] = C_GRID

    def _draw_hud(self, frame: list[list[int]]) -> None:
        y0 = FRAME - HUD_H
        for y in range(y0, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_HUD
        n = self.win_levels
        gap, pip_w = 2, 3
        total = n * pip_w + (n - 1) * gap
        x_mid = max(1, (FRAME - total) // 2)
        done = self.levels_completed
        for i in range(n):
            col = (
                C_HUD_DONE
                if i < done or self.state == "WIN"
                else (C_HUD_CUR if i == done else C_HUD_SLOT)
            )
            xx = x_mid + i * (pip_w + gap)
            for y in range(y0 + 1, FRAME - 1):
                for x in range(xx, min(FRAME, xx + pip_w)):
                    frame[y][x] = col
        # didactic progress pips on the left of HUD
        lv = self._level
        if lv.cfg.mode == "didactic" and lv.puzzles:
            for i, pz in enumerate(lv.puzzles):
                col = C_GREEN if pz.solved else C_MGREY
                x = 1 + i * 2
                for y in range(y0 + 1, FRAME - 1):
                    if 0 <= x < FRAME:
                        frame[y][x] = col
