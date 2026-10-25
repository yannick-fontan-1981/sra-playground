"""Additive RGB glass panes: R+G=Y, G+B=C, B+R=M, R+G+B=W on black.

Controls:
  ACTION6 click  — select piece under cursor (white center dot)
  ACTION1..4     — move selection
  ACTION5 SPACE  — rotate selection 90° CW around its center
  ACTION7        — reset current level

Layout on 64×64 (ARC-AGI-3 UI palette indices):
  large irregular RGB panes (well beyond the center square; ~1/6 screen each)
  center 10×10 scoring canvas with 1px outline (legend match only here)
  panes intentionally overflow the outline; only the interior is scored
  bottom-right 10×10 legend to reproduce
"""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

# ARC-AGI-3 UI palette (client ARC_COLORS)
# 0 white · 1 light-grey · 4 very-dark-grey · 5 black
# 6 magenta · 8 red · 9 blue · 10 cyan · 11 yellow · 12 orange · 14 green
C_BG = 5
C_OUTLINE = 1
C_WHITE = 0
C_SELECT_DOT = C_WHITE
C_HUD = 4
C_HUD_DONE = 14
C_HUD_SLOT = 3

BIT_R, BIT_G, BIT_B = 1, 2, 4
COLOR_BITS = {"R": BIT_R, "G": BIT_G, "B": BIT_B}
# composite bits → palette index
COMPOSITE_PALETTE = {
    0: 5,  # black
    BIT_R: 8,  # red
    BIT_G: 14,  # green
    BIT_B: 9,  # blue
    BIT_R | BIT_G: 11,  # yellow
    BIT_G | BIT_B: 10,  # cyan
    BIT_B | BIT_R: 6,  # magenta
    BIT_R | BIT_G | BIT_B: 0,  # white
}
LEGEND_CHAR = {
    ".": 0,
    "R": BIT_R,
    "G": BIT_G,
    "B": BIT_B,
    "Y": BIT_R | BIT_G,
    "C": BIT_G | BIT_B,
    "M": BIT_B | BIT_R,
    "W": BIT_R | BIT_G | BIT_B,
}

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE, ACTION_CLICK, ACTION_RESET = 5, 6, 7

FRAME = 64
CANVAS = 10
# Discrete move quantum (pixels / cells per arrow press).
MOVE_STEP = 5
# Play canvas centered horizontally, slightly above vertical center
PLAY_R0, PLAY_C0 = 18, 27
# Legend bottom-right
LEG_R0, LEG_C0 = 50, 50

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "color_glass" / "levels"


@dataclass
class Piece:
    piece_id: str
    color: str  # R|G|B
    cells: list[tuple[int, int]]  # relative to anchor
    row: int
    col: int

    def absolute_cells(self) -> list[tuple[int, int]]:
        return [(self.row + dr, self.col + dc) for dr, dc in self.cells]

    def center(self) -> tuple[float, float]:
        cells = self.absolute_cells()
        if not cells:
            return float(self.row), float(self.col)
        rs = [r for r, _ in cells]
        cs = [c for _, c in cells]
        return (min(rs) + max(rs)) / 2.0, (min(cs) + max(cs)) / 2.0

    def rotate_cw(self) -> None:
        """Rotate relative cells 90° CW; keep world min-corner (row, col) fixed.

        Invertible: four CW turns restore the exact same relative cells.
        """
        if not self.cells:
            return
        max_r = max(r for r, _ in self.cells)
        # (r, c) -> (c, max_r - r), then re-normalize relative min to (0, 0).
        rotated = [(c, max_r - r) for r, c in self.cells]
        min_rr = min(r for r, _ in rotated)
        min_rc = min(c for _, c in rotated)
        self.cells = [(r - min_rr, c - min_rc) for r, c in rotated]
        # self.row / self.col stay as the world min-corner anchor.


@dataclass
class LevelState:
    name: str
    legend: list[list[int]]  # 10x10 bitflags
    pieces: list[Piece]
    max_steps: int
    selected_id: str | None = None


def _parse_legend(rows: list[str]) -> list[list[int]]:
    if len(rows) != CANVAS or any(len(r) != CANVAS for r in rows):
        raise ValueError(f"legend must be {CANVAS}x{CANVAS}")
    out: list[list[int]] = []
    for row in rows:
        line: list[int] = []
        for ch in row:
            if ch not in LEGEND_CHAR:
                raise ValueError(f"bad legend char {ch!r}")
            line.append(LEGEND_CHAR[ch])
        out.append(line)
    return out


def _load_level(path: Path) -> LevelState:
    data = json.loads(path.read_text(encoding="utf-8"))
    legend = _parse_legend(data["legend"])
    pieces: list[Piece] = []
    for raw in data["pieces"]:
        cells = [(int(a), int(b)) for a, b in raw["cells"]]
        color = str(raw["color"]).upper()
        if color not in COLOR_BITS:
            raise ValueError(f"piece color must be R|G|B, got {color}")
        pieces.append(
            Piece(
                piece_id=str(raw["id"]),
                color=color,
                cells=cells,
                row=int(raw["row"]),
                col=int(raw["col"]),
            )
        )
    return LevelState(
        name=str(data.get("name") or path.stem),
        legend=legend,
        pieces=pieces,
        max_steps=int(data.get("max_steps", 120)),
    )


def _load_all_levels() -> list[LevelState]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


class ColorGlassEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_all_levels()
        if len(self._templates) < info.levels:
            raise ValueError(f"expected {info.levels} levels, found {len(self._templates)}")
        self.win_levels = int(info.levels)
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._level = deepcopy(self._templates[0])

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._level = deepcopy(self._templates[0])
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[idx])
        self.level_steps = 0
        self.last_action = "ACTION7"
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
        if aid == ACTION_CLICK:
            self._click(int(data.get("x", -1)), int(data.get("y", -1)))
            self.step_index += 1
            return self.public_state()

        if aid in (ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT, ACTION_SPACE):
            self.step_index += 1
            self.level_steps += 1
            if aid == ACTION_SPACE:
                self._rotate_selected()
            else:
                dr, dc = {
                    ACTION_UP: (-MOVE_STEP, 0),
                    ACTION_DOWN: (MOVE_STEP, 0),
                    ACTION_LEFT: (0, -MOVE_STEP),
                    ACTION_RIGHT: (0, MOVE_STEP),
                }[aid]
                self._move_selected(dr, dc)
            if self._matches_legend():
                completion_frames = self._completion_frames()
                self.levels_completed += 1
                if self.levels_completed >= self.win_levels:
                    self.state = "WIN"
                else:
                    self._level = deepcopy(self._templates[self.levels_completed])
                    self.level_steps = 0
                    self.state = "NOT_FINISHED"
                result = self.public_state()
                result["frames"] = [*completion_frames, result["frame"]]
                result["frame_count"] = len(result["frames"])
                result["transition_frame_interval_ms"] = 1000 / max(1, self.info.default_fps)
                return result
            elif self.level_steps >= self._level.max_steps:
                self.state = "GAME_OVER"
            return self.public_state()

        return self.public_state()

    def _completion_frames(self) -> list[list[list[int]]]:
        """Hold the solved board, pulse its gray outlines, then hold it again."""
        solved = self._render_frame()
        white_outline = [
            [C_WHITE if color == C_OUTLINE else color for color in row]
            for row in solved
        ]
        # At the normal 8 fps: 0.5 s hold + three 0.5 s pulses + 0.5 s hold.
        phase = max(1, round(self.info.default_fps / 4))
        frames = [solved] * (2 * phase)
        for _ in range(3):
            frames.extend([white_outline] * phase)
            frames.extend([solved] * phase)
        frames.extend([solved] * (2 * phase))
        return frames

    def _selected(self) -> Piece | None:
        sid = self._level.selected_id
        if not sid:
            return None
        for p in self._level.pieces:
            if p.piece_id == sid:
                return p
        return None

    def _click(self, x: int, y: int) -> None:
        # Frame pixel -> world cell (origin = top-left of scoring canvas).
        cr = y - PLAY_R0
        cc = x - PLAY_C0
        hit: Piece | None = None
        # Topmost last piece wins (works outside the center square too).
        for p in self._level.pieces:
            if (cr, cc) in p.absolute_cells():
                hit = p
        self._level.selected_id = hit.piece_id if hit else None

    def _move_selected(self, dr: int, dc: int) -> None:
        p = self._selected()
        if p is None:
            return
        p.row += dr
        p.col += dc

    def _rotate_selected(self) -> None:
        p = self._selected()
        if p is None:
            return
        p.rotate_cw()

    def _world_bits_on_frame(self) -> list[list[int]]:
        """Additive RGB bitfield on the full 64×64 frame (panes may overflow canvas)."""
        grid = [[0 for _ in range(FRAME)] for _ in range(FRAME)]
        for p in self._level.pieces:
            bit = COLOR_BITS[p.color]
            for r, c in p.absolute_cells():
                fr = PLAY_R0 + r
                fc = PLAY_C0 + c
                if 0 <= fr < FRAME and 0 <= fc < FRAME:
                    # Keep HUD strip free of glass paint.
                    if fr >= FRAME - 4:
                        continue
                    grid[fr][fc] |= bit
        return grid

    def _composite_bits(self) -> list[list[int]]:
        """Scoring composite: only the center 10×10 world window."""
        grid = [[0 for _ in range(CANVAS)] for _ in range(CANVAS)]
        for p in self._level.pieces:
            bit = COLOR_BITS[p.color]
            for r, c in p.absolute_cells():
                if 0 <= r < CANVAS and 0 <= c < CANVAS:
                    grid[r][c] |= bit
        return grid

    def _matches_legend(self) -> bool:
        comp = self._composite_bits()
        leg = self._level.legend
        for r in range(CANVAS):
            for c in range(CANVAS):
                if comp[r][c] != leg[r][c]:
                    return False
        return True

    def public_state(self) -> dict[str, Any]:
        frame = self._render_frame()
        level_num = min(self.levels_completed + 1, self.win_levels)
        available = [
            "ACTION1",
            "ACTION2",
            "ACTION3",
            "ACTION4",
            "ACTION5",
            "ACTION6",
            "ACTION7",
        ]
        if self.state == "WIN":
            available = ["ACTION7"]
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frame,
            "frames": [frame],
            "frame_count": 1,
            "default_fps": self.info.default_fps,
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
            "level_name": self._level.name,
            "level_steps": self.level_steps,
            "selected_piece": self._level.selected_id,
        }

    def _render_frame(self) -> list[list[int]]:
        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]

        # Full-frame additive glass (pieces intentionally overflow the center outline).
        world = self._world_bits_on_frame()
        for fr in range(FRAME - 4):
            for fc in range(FRAME):
                bits = world[fr][fc]
                if bits:
                    frame[fr][fc] = COMPOSITE_PALETTE[bits]

        # Scoring outline drawn on top so the 10×10 window stays readable.
        self._draw_rect_outline(frame, PLAY_R0 - 1, PLAY_C0 - 1, CANVAS + 2, CANVAS + 2, C_OUTLINE)
        self._draw_rect_outline(frame, LEG_R0 - 1, LEG_C0 - 1, CANVAS + 2, CANVAS + 2, C_OUTLINE)

        # Legend (always pure target; not affected by live panes).
        for r in range(CANVAS):
            for c in range(CANVAS):
                bits = self._level.legend[r][c]
                frame[LEG_R0 + r][LEG_C0 + c] = COMPOSITE_PALETTE[bits]

        # Selection white center dot over the whole piece (incl. overflow).
        sel = self._selected()
        if sel is not None:
            cells = sel.absolute_cells()
            if cells:
                cr = sum(r for r, _ in cells) / len(cells)
                cc = sum(c for _, c in cells) / len(cells)
                pr = PLAY_R0 + int(round(cr))
                pc = PLAY_C0 + int(round(cc))
                if 0 <= pr < FRAME - 4 and 0 <= pc < FRAME:
                    frame[pr][pc] = C_SELECT_DOT

        # HUD level slots
        hud_h = 4
        play_h = FRAME - hud_h
        for i in range(FRAME):
            for h in range(hud_h):
                frame[play_h + h][i] = C_HUD
        slot_w = max(6, (FRAME - 8) // self.win_levels)
        for i in range(self.win_levels):
            x0 = 4 + i * slot_w
            filled = i < self.levels_completed
            for x in range(x0, min(FRAME - 2, x0 + slot_w - 2)):
                for h in range(1, hud_h - 1):
                    frame[play_h + h][x] = C_HUD_DONE if filled else C_HUD_SLOT
        return frame

    @staticmethod
    def _draw_rect_outline(
        frame: list[list[int]], r0: int, c0: int, h: int, w: int, color: int
    ) -> None:
        for c in range(c0, c0 + w):
            if 0 <= r0 < FRAME and 0 <= c < FRAME:
                frame[r0][c] = color
            if 0 <= r0 + h - 1 < FRAME and 0 <= c < FRAME:
                frame[r0 + h - 1][c] = color
        for r in range(r0, r0 + h):
            if 0 <= r < FRAME and 0 <= c0 < FRAME:
                frame[r][c0] = color
            if 0 <= r < FRAME and 0 <= c0 + w - 1 < FRAME:
                frame[r][c0 + w - 1] = color
