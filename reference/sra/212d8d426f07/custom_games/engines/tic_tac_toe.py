"""TICT — Tic-Tac-Toe vs adversary with rising AI and multi-board late levels.

Controls:
  ACTION6 click — place X on an empty cell
  ACTION7       — soft reset current level

Win animation: pulse / sweep along the three-in-a-row cells.
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
C_RED = 8
C_BLUE = 9
C_CYAN = 10
C_YELLOW = 11
C_ORANGE = 12
C_GREEN = 14

C_BG = C_BLACK
C_GRID = C_DGREY
C_CELL = C_VDGREY
C_PLAYER = C_YELLOW
C_ENEMY = C_RED
C_LOCK = C_MGREY
C_HUD = C_VDGREY
C_HUD_DONE = C_GREEN
C_HUD_SLOT = C_DGREY
C_HUD_CUR = C_YELLOW
C_FLASH = C_RED
C_WIN_A = C_WHITE
C_WIN_B = C_YELLOW
C_WIN_C = C_ORANGE

ACTION_CLICK, ACTION_RESET = 6, 7
FRAME = 64
HUD_H = 5
PLAY_H = FRAME - HUD_H
N = 3
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "tic_tac_toe" / "levels"

Cell = Literal[0, 1, 2]  # empty, player(X), enemy(O)
Board = list[list[int]]  # board[row][col], row 0 = top

AIMode = Literal["saboteur", "random", "block", "medium", "strong", "perfect"]
GridStatus = Literal["active", "won", "lost", "draw"]

LINES: tuple[tuple[tuple[int, int], ...], ...] = (
    ((0, 0), (0, 1), (0, 2)),
    ((1, 0), (1, 1), (1, 2)),
    ((2, 0), (2, 1), (2, 2)),
    ((0, 0), (1, 0), (2, 0)),
    ((0, 1), (1, 1), (2, 1)),
    ((0, 2), (1, 2), (2, 2)),
    ((0, 0), (1, 1), (2, 2)),
    ((0, 2), (1, 1), (2, 0)),
)


@dataclass
class GridSpec:
    board: Board
    to_move: Literal["player", "ai"]


@dataclass
class LevelConfig:
    name: str
    ai: AIMode
    wins_required: int
    grids: list[GridSpec]
    seed: int


@dataclass
class GridState:
    board: Board
    to_move: Literal["player", "ai", "over"]
    status: GridStatus = "active"
    win_line: tuple[tuple[int, int], ...] | None = None


@dataclass
class LevelState:
    cfg: LevelConfig
    grids: list[GridState] = field(default_factory=list)
    rng: random.Random = field(default_factory=random.Random)
    # Only this grid accepts clicks until it finishes (won/lost/draw).
    active_index: int = 0


def _empty() -> Board:
    return [[0, 0, 0] for _ in range(N)]


def _clone(board: Board) -> Board:
    return [row[:] for row in board]


def _parse_board(rows: list[str]) -> Board:
    if len(rows) != N:
        raise ValueError(f"need {N} rows, got {len(rows)}")
    out = _empty()
    for r, line in enumerate(rows):
        if len(line) != N:
            raise ValueError(f"row width {len(line)} != {N}")
        for c, ch in enumerate(line):
            if ch in (".", " ", "0", "_"):
                out[r][c] = 0
            elif ch in ("X", "x", "P", "p", "1", "Y", "y"):
                out[r][c] = 1
            elif ch in ("O", "o", "E", "e", "2", "R", "r"):
                out[r][c] = 2
            else:
                raise ValueError(f"bad cell {ch!r}")
    return out


def _load_level(path: Path) -> LevelConfig:
    data = json.loads(path.read_text(encoding="utf-8"))
    ai = str(data.get("ai", "random"))
    if ai not in ("saboteur", "random", "block", "medium", "strong", "perfect"):
        raise ValueError(f"bad ai {ai}")
    grids: list[GridSpec] = []
    for g in data.get("grids", []):
        to_move = str(g.get("to_move", "player"))
        if to_move not in ("player", "ai"):
            raise ValueError(f"bad to_move {to_move}")
        grids.append(
            GridSpec(
                board=_parse_board(list(g["board"])),
                to_move=to_move,  # type: ignore[arg-type]
            )
        )
    if not grids:
        raise ValueError(f"{path.name}: no grids")
    for i, g in enumerate(grids):
        yellow = sum(1 for row in g.board for c in row if c == 1)
        red = sum(1 for row in g.board for c in row if c == 2)
        if yellow >= 2:
            raise ValueError(
                f"{path.name} grid {i}: preset may not have 2+ yellows "
                f"(got X={yellow} O={red}); use one O, or one X + one O"
            )
        if yellow == 1 and red == 0:
            # single yellow alone is allowed only if intentional — user asked
            # either one red OR yellow+red. Reject lone X.
            raise ValueError(
                f"{path.name} grid {i}: lone yellow preset forbidden; "
                f"use one O, or one X + one O"
            )
        if yellow == 0 and red == 0:
            pass  # empty start OK
        elif yellow == 0 and red == 1:
            pass
        elif yellow == 1 and red == 1:
            pass
        elif red >= 2 and yellow == 0:
            raise ValueError(
                f"{path.name} grid {i}: at most one preset O when no X "
                f"(got O={red})"
            )
        else:
            raise ValueError(
                f"{path.name} grid {i}: invalid preset X={yellow} O={red}"
            )
    return LevelConfig(
        name=str(data.get("name") or path.stem),
        ai=ai,  # type: ignore[arg-type]
        wins_required=int(data.get("wins_required", 1)),
        grids=grids,
        seed=int(data.get("seed", 1)),
    )


def _load_all_levels() -> list[LevelConfig]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


def _empties(board: Board) -> list[tuple[int, int]]:
    return [(r, c) for r in range(N) for c in range(N) if board[r][c] == 0]


def _winner_line(board: Board) -> tuple[int, tuple[tuple[int, int], ...]] | None:
    for line in LINES:
        vals = [board[r][c] for r, c in line]
        if vals[0] != 0 and vals[0] == vals[1] == vals[2]:
            return vals[0], line
    return None


def _winner(board: Board) -> int:
    w = _winner_line(board)
    return w[0] if w else 0


def _is_full(board: Board) -> bool:
    return not _empties(board)


def _winning_moves(board: Board, who: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for r, c in _empties(board):
        b = _clone(board)
        b[r][c] = who
        if _winner(b) == who:
            out.append((r, c))
    return out


# --- AI ------------------------------------------------------------------------

def _ai_saboteur(board: Board, rng: random.Random) -> tuple[int, int]:
    """Help the player win: never block threats and never take a winning move."""
    legal = _empties(board)
    if not legal:
        return 0, 0
    threats = set(_winning_moves(board, 1))
    own_wins = set(_winning_moves(board, 2))
    # Prefer cells that neither block the player nor win for O.
    soft = [p for p in legal if p not in threats and p not in own_wins]
    pool = soft if soft else [p for p in legal if p not in threats] or legal
    edges = [p for p in pool if p in ((0, 1), (1, 0), (1, 2), (2, 1))]
    if edges:
        return rng.choice(edges)
    return rng.choice(pool)


def _ai_random(board: Board, rng: random.Random) -> tuple[int, int]:
    legal = _empties(board)
    return rng.choice(legal) if legal else (0, 0)


def _ai_block(board: Board, rng: random.Random) -> tuple[int, int]:
    own = _winning_moves(board, 2)
    if own:
        return rng.choice(own)
    threats = _winning_moves(board, 1)
    if threats:
        return rng.choice(threats)
    return _ai_random(board, rng)


def _ai_medium(board: Board, rng: random.Random) -> tuple[int, int]:
    own = _winning_moves(board, 2)
    if own:
        return own[0]
    threats = _winning_moves(board, 1)
    if threats:
        return threats[0]
    # Prefer center, then corners.
    for pref in ((1, 1), (0, 0), (0, 2), (2, 0), (2, 2)):
        if board[pref[0]][pref[1]] == 0:
            return pref
    return _ai_random(board, rng)


def _fork_moves(board: Board, who: int) -> list[tuple[int, int]]:
    """Moves that create two distinct immediate winning threats."""
    out: list[tuple[int, int]] = []
    for r, c in _empties(board):
        b = _clone(board)
        b[r][c] = who
        if _winner(b) == who:
            continue
        if len(_winning_moves(b, who)) >= 2:
            out.append((r, c))
    return out


def _ai_strong(board: Board, rng: random.Random) -> tuple[int, int]:
    own = _winning_moves(board, 2)
    if own:
        return rng.choice(own)
    threats = _winning_moves(board, 1)
    if threats:
        return rng.choice(threats)
    forks = _fork_moves(board, 2)
    if forks:
        return rng.choice(forks)
    # Block opponent forks when possible.
    opp_forks = _fork_moves(board, 1)
    if opp_forks:
        return rng.choice(opp_forks)
    return _ai_medium(board, rng)


def _minimax(board: Board, turn: int, alpha: int, beta: int) -> tuple[int, tuple[int, int] | None]:
    """Return (score, best_move) from `turn`'s perspective. +1 win for O(2), -1 for X(1)."""
    w = _winner(board)
    if w == 2:
        return 1, None
    if w == 1:
        return -1, None
    legal = _empties(board)
    if not legal:
        return 0, None

    best_move: tuple[int, int] | None = legal[0]
    if turn == 2:
        best = -2
        for r, c in legal:
            b = _clone(board)
            b[r][c] = 2
            score, _ = _minimax(b, 1, alpha, beta)
            if score > best:
                best = score
                best_move = (r, c)
            alpha = max(alpha, best)
            if beta <= alpha:
                break
        return best, best_move
    best = 2
    for r, c in legal:
        b = _clone(board)
        b[r][c] = 1
        score, _ = _minimax(b, 2, alpha, beta)
        if score < best:
            best = score
            best_move = (r, c)
        beta = min(beta, best)
        if beta <= alpha:
            break
    return best, best_move


def _ai_perfect(board: Board, rng: random.Random) -> tuple[int, int]:
    _score, move = _minimax(board, 2, -2, 2)
    if move is None:
        return _ai_random(board, rng)
    # If several perfect moves, pick among those with equal score.
    legal = _empties(board)
    perfect: list[tuple[int, int]] = []
    for r, c in legal:
        b = _clone(board)
        b[r][c] = 2
        sc, _ = _minimax(b, 1, -2, 2)
        if sc == _score:
            perfect.append((r, c))
    return rng.choice(perfect) if perfect else move


def _ai_choose(board: Board, mode: AIMode, rng: random.Random) -> tuple[int, int]:
    if mode == "saboteur":
        return _ai_saboteur(board, rng)
    if mode == "random":
        return _ai_random(board, rng)
    if mode == "block":
        return _ai_block(board, rng)
    if mode == "medium":
        return _ai_medium(board, rng)
    if mode == "strong":
        return _ai_strong(board, rng)
    return _ai_perfect(board, rng)


# --- Engine --------------------------------------------------------------------

class TicTacToeEngine:
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
        rng = random.Random(cfg.seed + level_index * 31 + self.levels_completed)
        grids: list[GridState] = []
        for spec in cfg.grids:
            g = GridState(
                board=_clone(spec.board),
                to_move=spec.to_move,
                status="active",
            )
            # If opening position already decided, lock accordingly.
            w = _winner_line(g.board)
            if w:
                who, line = w
                g.status = "won" if who == 1 else "lost"
                g.win_line = line
                g.to_move = "over"
            elif _is_full(g.board):
                g.status = "draw"
                g.to_move = "over"
            grids.append(g)
        active = 0
        for i, g in enumerate(grids):
            if g.status == "active":
                active = i
                break
        return LevelState(cfg=cfg, grids=grids, rng=rng, active_index=active)

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

    # --- layout ----------------------------------------------------------------

    def _layout(self) -> tuple[int, int, list[tuple[int, int]]]:
        """Return cell size, gap, and list of (ox, oy) per grid."""
        n = len(self._level.grids)
        if n == 1:
            cell, gap = 14, 2
            bw = N * cell + (N - 1) * gap
            bh = bw
            ox = (FRAME - bw) // 2
            oy = 4 + (PLAY_H - 8 - bh) // 2
            return cell, gap, [(ox, oy)]
        if n == 2:
            # Keep boards inside each half with a visible mid gutter.
            cell, gap, gutter = 7, 1, 4
            bw = N * cell + (N - 1) * gap
            half = FRAME // 2
            oy = 6 + (PLAY_H - 12 - bw) // 2
            origins = [
                ((half - gutter // 2 - bw) // 2, oy),
                (half + gutter // 2 + (half - gutter // 2 - bw) // 2, oy),
            ]
            return cell, gap, origins
        if n == 3:
            cell, gap, gutter = 6, 1, 4
            bw = N * cell + (N - 1) * gap
            half = FRAME // 2
            top_y = 3
            bot_y = PLAY_H // 2 + 2
            origins = [
                ((FRAME - bw) // 2, top_y),
                ((half - gutter // 2 - bw) // 2, bot_y),
                (half + gutter // 2 + (half - gutter // 2 - bw) // 2, bot_y),
            ]
            return cell, gap, origins
        # 4+ → 2×2 with inset so boards never touch the mid lines
        cell, gap, inset = 6, 1, 3
        bw = N * cell + (N - 1) * gap
        origins = []
        for i in range(n):
            row_i, col_i = divmod(i, 2)
            qw, qh = FRAME // 2, (PLAY_H - 2) // 2
            ox = col_i * qw + inset + (qw - 2 * inset - bw) // 2
            oy = 1 + row_i * qh + inset + (qh - 2 * inset - bw) // 2
            origins.append((ox, oy))
        return cell, gap, origins

    def _hit_test(self, x: int, y: int) -> tuple[int, int, int] | None:
        """Return (grid_index, row, col) or None."""
        cell, gap, origins = self._layout()
        step = cell + gap
        for gi, (ox, oy) in enumerate(origins):
            bw = N * cell + (N - 1) * gap
            if not (ox <= x < ox + bw and oy <= y < oy + bw):
                continue
            col = (x - ox) // step
            row = (y - oy) // step
            if 0 <= row < N and 0 <= col < N:
                # Reject pure gap clicks
                lx = (x - ox) % step
                ly = (y - oy) % step
                if lx >= cell or ly >= cell:
                    return None
                return gi, int(row), int(col)
        return None

    # --- turns -----------------------------------------------------------------

    def _player_wins(self) -> int:
        return sum(1 for g in self._level.grids if g.status == "won")

    def _all_resolved_without_enough_wins(self) -> bool:
        lv = self._level
        if self._player_wins() >= lv.cfg.wins_required:
            return False
        return all(g.status != "active" for g in lv.grids)

    def _advance_active_grid(self) -> None:
        """After the current grid finishes, unlock the next unfinished one."""
        lv = self._level
        for i in range(lv.active_index + 1, len(lv.grids)):
            if lv.grids[i].status == "active":
                lv.active_index = i
                return
        # No later unfinished grid — keep index on last finished.
        for i, g in enumerate(lv.grids):
            if g.status == "active":
                lv.active_index = i
                return

    def _advance_level(self, frames: list[list[list[int]]]) -> None:
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
        else:
            self._level = self._new_level_state(self.levels_completed)
            self.state = "NOT_FINISHED"
            frames.append(self._render_frame())

    def _click(self, x: int, y: int) -> list[list[list[int]]] | None:
        hit = self._hit_test(x, y)
        if hit is None:
            return None
        gi, r, c = hit
        lv = self._level
        # Sequential multi-board: only the active grid is clickable.
        if len(lv.grids) > 1 and gi != lv.active_index:
            return None
        g = lv.grids[gi]
        if g.status != "active" or g.to_move != "player":
            return None
        if g.board[r][c] != 0:
            return None

        frames: list[list[list[int]]] = []
        g.board[r][c] = 1
        frames.append(self._render_frame())
        frames.append(self._render_frame())

        def _finish_player_grid() -> None:
            """After the active grid ends without an AI win."""
            if self._player_wins() >= lv.cfg.wins_required:
                frames.extend(self._level_clear_frames())
                self._advance_level(frames)
                return
            self._advance_active_grid()
            if self._all_resolved_without_enough_wins():
                frames.extend(self._fail_frames())
                return
            frames.append(self._render_frame())

        wl = _winner_line(g.board)
        if wl and wl[0] == 1:
            g.status = "won"
            g.win_line = wl[1]
            g.to_move = "over"
            frames.extend(self._win_line_frames(gi, wl[1]))
            _finish_player_grid()
            return frames

        if _is_full(g.board):
            g.status = "draw"
            g.to_move = "over"
            frames.append(self._render_frame())
            _finish_player_grid()
            return frames

        # AI reply on this grid
        g.to_move = "ai"
        ar, ac = _ai_choose(g.board, lv.cfg.ai, lv.rng)
        if g.board[ar][ac] == 0:
            g.board[ar][ac] = 2
            frames.append(self._render_frame())
            frames.append(self._render_frame())
            wl2 = _winner_line(g.board)
            if wl2 and wl2[0] == 2:
                # Any AI win on a multi-board (or single) level → full level reset.
                g.status = "lost"
                g.win_line = wl2[1]
                g.to_move = "over"
                frames.extend(self._enemy_line_frames(gi, wl2[1]))
                frames.extend(self._fail_frames())
                return frames
            if _is_full(g.board):
                g.status = "draw"
                g.to_move = "over"
                frames.append(self._render_frame())
                _finish_player_grid()
                return frames
        g.to_move = "player"
        frames.append(self._render_frame())
        return frames

    # --- animations ------------------------------------------------------------

    def _win_line_frames(
        self, gi: int, line: tuple[tuple[int, int], ...]
    ) -> list[list[list[int]]]:
        """Nice sweep + pulse along the winning three cells."""
        frames: list[list[list[int]]] = []
        # Sequential light-up
        for k in range(1, 4):
            frames.append(self._render_frame(glow={gi: (line[:k], C_WIN_B)}))
            frames.append(self._render_frame(glow={gi: (line[:k], C_WIN_A)}))
        # Full-line pulse
        for color in (C_WIN_A, C_WIN_B, C_WIN_C, C_WIN_A, C_WIN_B, C_WIN_A):
            frames.append(self._render_frame(glow={gi: (line, color)}))
            frames.append(self._render_frame(glow={gi: (line, color)}))
        # Soft settle
        frames.append(self._render_frame(glow={gi: (line, C_WIN_B)}))
        frames.append(self._render_frame())
        frames.append(self._render_frame())
        return frames

    def _enemy_line_frames(
        self, gi: int, line: tuple[tuple[int, int], ...]
    ) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        for color in (C_FLASH, C_ENEMY, C_FLASH, C_ENEMY):
            frames.append(self._render_frame(glow={gi: (line, color)}))
        frames.append(self._render_frame())
        return frames

    def _level_clear_frames(self) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        base = self._render_frame()
        for _ in range(2):
            frames.append(self._recolor_nonbg(base, C_WHITE))
            frames.append([row[:] for row in base])
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

    @staticmethod
    def _recolor_nonbg(frame: list[list[int]], color: int) -> list[list[int]]:
        out = [row[:] for row in frame]
        for y in range(FRAME):
            for x in range(FRAME):
                if out[y][x] != C_BG:
                    out[y][x] = color
        return out

    # --- public ----------------------------------------------------------------

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
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frame,
            "frames": frames,
            "frame_count": len(frames),
            "transition_frame_interval_ms": 70 if len(frames) > 1 else None,
            "default_fps": max(
                self.info.default_fps, 10 if len(frames) > 1 else self.info.default_fps
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
            "ai": lv.cfg.ai,
            "wins_required": lv.cfg.wins_required,
            "player_wins": self._player_wins(),
            "grid_statuses": [g.status for g in lv.grids],
            "active_grid": lv.active_index,
        }

    # --- render ----------------------------------------------------------------

    def _render_frame(
        self,
        glow: dict[int, tuple[tuple[tuple[int, int], ...], int]] | None = None,
    ) -> list[list[int]]:
        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]
        # HUD
        for y in range(PLAY_H, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_HUD
        for i in range(self.win_levels):
            x0 = 2 + i * 4
            color = C_HUD_DONE if i < self.levels_completed else C_HUD_SLOT
            if i == self.levels_completed and self.state != "WIN":
                color = C_HUD_CUR
            for dy in range(3):
                for dx in range(3):
                    xx, yy = x0 + dx, PLAY_H + 1 + dy
                    if 0 <= xx < FRAME and 0 <= yy < FRAME:
                        frame[yy][xx] = color

        cell, gap, origins = self._layout()
        lv = self._level
        for gi, (ox, oy) in enumerate(origins):
            g = lv.grids[gi]
            disabled = len(lv.grids) > 1 and gi != lv.active_index and g.status == "active"
            self._blit_board(
                frame,
                g,
                ox,
                oy,
                cell,
                gap,
                glow_line=glow.get(gi) if glow else None,
                disabled=disabled,
                is_current=(gi == lv.active_index),
            )
        return frame

    def _blit_board(
        self,
        frame: list[list[int]],
        g: GridState,
        ox: int,
        oy: int,
        cell: int,
        gap: int,
        glow_line: tuple[tuple[tuple[int, int], ...], int] | None = None,
        disabled: bool = False,
        is_current: bool = True,
    ) -> None:
        glow_cells: dict[tuple[int, int], int] = {}
        if glow_line:
            line, color = glow_line
            for p in line:
                glow_cells[p] = color

        # Board backdrop — dimmer when waiting / finished-lost
        bw = N * cell + (N - 1) * gap
        border = C_MGREY if disabled else (C_YELLOW if is_current and len(self._level.grids) > 1 else C_GRID)
        for yy in range(oy - 1, oy + bw + 1):
            for xx in range(ox - 1, ox + bw + 1):
                if 0 <= xx < FRAME and 0 <= yy < PLAY_H:
                    frame[yy][xx] = border

        for r in range(N):
            for c in range(N):
                x0 = ox + c * (cell + gap)
                y0 = oy + r * (cell + gap)
                mark = g.board[r][c]
                if (r, c) in glow_cells:
                    fill = glow_cells[(r, c)]
                    draw_glyph = False
                elif disabled and mark == 0:
                    fill = C_LOCK
                    draw_glyph = False
                elif g.status in ("lost", "draw") and mark == 0:
                    fill = C_LOCK
                    draw_glyph = False
                elif mark in (1, 2):
                    # Neutral pad so the X / O glyph stays readable on small cells
                    fill = C_CELL
                    draw_glyph = True
                else:
                    fill = C_CELL
                    draw_glyph = False
                for dy in range(cell):
                    for dx in range(cell):
                        xx, yy = x0 + dx, y0 + dy
                        if 0 <= xx < FRAME and 0 <= yy < PLAY_H:
                            frame[yy][xx] = fill
                if draw_glyph:
                    self._draw_mark(frame, x0, y0, cell, mark)

        # Status pip under board for multi
        if len(self._level.grids) > 1:
            if disabled:
                pip = C_DGREY
            elif g.status == "active" and is_current:
                pip = C_HUD_CUR
            else:
                pip = {
                    "active": C_DGREY,
                    "won": C_GREEN,
                    "lost": C_FLASH,
                    "draw": C_MGREY,
                }[g.status]
            py = oy + bw + 1
            px = ox + bw // 2
            if 0 <= py < PLAY_H and 0 <= px < FRAME:
                frame[py][px] = pip

    @staticmethod
    def _draw_mark(
        frame: list[list[int]], x0: int, y0: int, cell: int, mark: int
    ) -> None:
        """Draw an X (yellow) or O (red) glyph; works down to ~5–6 px cells."""
        ink = C_PLAYER if mark == 1 else C_ENEMY
        pad = 1 if cell >= 6 else 0
        if mark == 1:
            # X diagonals (1 px thick; + optional neighbor on larger cells)
            thick = 1 if cell >= 8 else 0
            for i in range(pad, cell - pad):
                for t in range(-thick, thick + 1):
                    for a, b in (
                        (x0 + i + t, y0 + i),
                        (x0 + (cell - 1 - i) + t, y0 + i),
                    ):
                        if 0 <= a < FRAME and 0 <= b < PLAY_H:
                            if x0 <= a < x0 + cell and y0 <= b < y0 + cell:
                                frame[b][a] = ink
        else:
            # O ring
            cx = x0 + (cell - 1) / 2.0
            cy = y0 + (cell - 1) / 2.0
            rad = max(1.0, cell / 2.0 - (1.2 if cell >= 7 else 0.8))
            band = 1.15 if cell >= 7 else 0.95
            for yy in range(y0, y0 + cell):
                for xx in range(x0, x0 + cell):
                    d = ((xx - cx) ** 2 + (yy - cy) ** 2) ** 0.5
                    if abs(d - rad) <= band:
                        if 0 <= xx < FRAME and 0 <= yy < PLAY_H:
                            frame[yy][xx] = ink
