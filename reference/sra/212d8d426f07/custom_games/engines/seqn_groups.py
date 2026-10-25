"""SEQN — sequenced symbol groups under a shared action budget.

Controls:
  ACTION1 UP    → triangle
  ACTION2 DOWN  → square
  ACTION3 LEFT  → circle
  ACTION4 RIGHT → star
  ACTION7       → soft reset current level

Rules (see docs/architecture/game_synthesis/custom_seqn_design.md):
  - Several red frames hold ordered symbols (triangle/circle/square/star).
  - Each unfinished group highlights the next expected symbol (white outline).
  - Pressing shape S lights every unfinished group whose focus is S (green fill)
    and advances that focus one step right.
  - Unfinished groups whose focus is not S flash red and reset to the left.
  - Fully green frames lock and never reset.
  - Soft miss: if no unfinished group focuses S, consume one pip, no reset.
  - Win level when every frame is green; campaign win after all levels.
  - Exhausting the pip bar soft-fails the level (red blink + restart level).
"""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

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
C_YELLOW = 11
C_GREEN = 14

C_BG = C_BLACK
C_FRAME_OPEN = C_RED
C_FRAME_DONE = C_GREEN
C_SYM_FILL = C_BLACK
C_SYM_OUTLINE = C_LGREY
C_SYM_FOCUS = C_WHITE
C_SYM_LIT = C_GREEN
C_FLASH = C_RED
C_HUD = C_VDGREY
C_HUD_DONE = C_GREEN
C_HUD_SLOT = C_DGREY
C_HUD_PIPS = C_YELLOW
C_HUD_OVER = C_RED

SHAPES = ("triangle", "square", "circle", "star")
SHAPE_TO_ACTION = {
    "triangle": 1,  # UP
    "square": 2,  # DOWN
    "circle": 3,  # LEFT
    "star": 4,  # RIGHT
}
ACTION_TO_SHAPE = {v: k for k, v in SHAPE_TO_ACTION.items()}

ACTION_RESET = 7
FRAME = 64
HUD_H = 5
PLAY_H = FRAME - HUD_H
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "seqn_groups" / "levels"

# Symbol cell geometry
CELL = 7
CELL_GAP = 1
PAD = 2  # inner pad inside frame


@dataclass
class GroupState:
    group_id: str
    symbols: list[str]
    lit_count: int = 0  # prefix length lit; focus index == lit_count while open

    @property
    def done(self) -> bool:
        return self.lit_count >= len(self.symbols)

    @property
    def focus_index(self) -> int | None:
        if self.done or not self.symbols:
            return None
        return self.lit_count

    @property
    def focus_shape(self) -> str | None:
        idx = self.focus_index
        if idx is None:
            return None
        return self.symbols[idx]

    def reset(self) -> None:
        if not self.done:
            self.lit_count = 0


@dataclass
class LevelState:
    name: str
    pip_budget: int
    groups: list[GroupState] = field(default_factory=list)
    pips_used: int = 0
    flash_groups: set[str] = field(default_factory=set)


def _normalize_shape(raw: str) -> str:
    s = str(raw).strip().lower()
    aliases = {
        "tri": "triangle",
        "t": "triangle",
        "sq": "square",
        "q": "square",
        "box": "square",
        "o": "circle",
        "circ": "circle",
        "c": "circle",
        "r": "star",
        "asterisk": "star",
        "*": "star",
    }
    s = aliases.get(s, s)
    if s not in SHAPES:
        raise ValueError(f"unknown shape: {raw!r}")
    return s


def _load_level(path: Path) -> LevelState:
    data = json.loads(path.read_text(encoding="utf-8"))
    groups_raw = data.get("groups")
    if not isinstance(groups_raw, list) or not groups_raw:
        raise ValueError(f"groups required in {path}")
    groups: list[GroupState] = []
    for i, g in enumerate(groups_raw):
        if not isinstance(g, dict):
            raise ValueError(f"bad group entry in {path}")
        syms = [_normalize_shape(x) for x in g.get("symbols", [])]
        if not syms:
            raise ValueError(f"empty symbols in group {i} of {path}")
        if len(syms) > 8:
            raise ValueError(f"group too long in {path}")
        gid = str(g.get("id") or f"G{i}")
        groups.append(GroupState(group_id=gid, symbols=syms))
    budget = int(data.get("pip_budget", data.get("max_steps", 12)))
    if budget < 1:
        raise ValueError(f"pip_budget must be >= 1 in {path}")
    return LevelState(
        name=str(data.get("name") or path.stem),
        pip_budget=budget,
        groups=groups,
    )


def _load_all_levels() -> list[LevelState]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


def _paint_glyph(buf: list[list[int]], shape: str, color: int) -> None:
    """Draw a 5×5 glyph into a CELL×CELL buffer (centered with 1px margin)."""
    # Patterns in 5x5; drawn at offset (1,1) inside 7x7 cell.
    patterns: dict[str, tuple[str, ...]] = {
        "square": (
            "#####",
            "#...#",
            "#...#",
            "#...#",
            "#####",
        ),
        "circle": (
            ".###.",
            "#...#",
            "#...#",
            "#...#",
            ".###.",
        ),
        "triangle": (
            "..#..",
            ".#.#.",
            "#...#",
            "#...#",
            "#####",
        ),
        "star": (
            "..#..",
            ".###.",
            "#####",
            ".###.",
            "..#..",
        ),
    }
    pat = patterns[shape]
    for dy, row in enumerate(pat):
        for dx, ch in enumerate(row):
            if ch == "#":
                buf[1 + dy][1 + dx] = color


class SeqnGroupsEngine:
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
        self._level = deepcopy(self._templates[0])

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames = None
        self._level = deepcopy(self._templates[0])
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[idx])
        self.last_action = "ACTION7"
        self._pending_frames = None
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        _ = data
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        self.last_action = f"ACTION{aid}"
        shape = ACTION_TO_SHAPE.get(aid)
        if shape is None:
            return self.public_state()

        frames: list[list[list[int]]] = []
        self._apply_press(shape, frames)
        if frames:
            self._pending_frames = frames
        return self.public_state()

    def _apply_press(self, shape: str, frames: list[list[list[int]]]) -> None:
        lv = self._level
        open_groups = [g for g in lv.groups if not g.done]
        matching = [g for g in open_groups if g.focus_shape == shape]
        conflicting = [g for g in open_groups if g.focus_shape != shape]

        # Always consume one pip for a directional press.
        lv.pips_used += 1
        self.step_index += 1

        if not matching:
            # Soft miss: no group expected this shape.
            frames.append(self._render_frame())
            if lv.pips_used >= lv.pip_budget and not self._level_complete():
                self._append_soft_fail(frames)
            return

        # Matching groups light + advance.
        for g in matching:
            g.lit_count += 1

        # Conflicting unfinished groups flash then reset.
        if conflicting:
            lv.flash_groups = {g.group_id for g in conflicting}
            frames.append(self._render_frame(flash=True))
            for g in conflicting:
                g.reset()
            lv.flash_groups = set()
            frames.append(self._render_frame())
        else:
            frames.append(self._render_frame())

        if self._level_complete():
            frames.extend(self._win_flash_frames())
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
            else:
                self._level = deepcopy(self._templates[self.levels_completed])
                self.state = "NOT_FINISHED"
                frames.append(self._render_frame())
            return

        if lv.pips_used >= lv.pip_budget:
            self._append_soft_fail(frames)

    def _append_soft_fail(self, frames: list[list[list[int]]]) -> None:
        """Extend *frames* with a red blink, then restart the current level."""
        pre = self._render_frame()
        for i in range(4):
            if i % 2 == 0:
                frames.append(self._recolor_play_non_bg(pre, C_FLASH))
            else:
                frames.append([row[:] for row in pre])
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[idx])
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        frames.append(self._render_frame())

    def _level_complete(self) -> bool:
        return all(g.done for g in self._level.groups)

    def _win_flash_frames(self) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        pre = self._render_frame()
        for _ in range(3):
            frames.append(self._recolor_play_non_bg(pre, C_GREEN))
            frames.append([row[:] for row in pre])
        return frames

    @staticmethod
    def _recolor_play_non_bg(
        frame: list[list[int]], color: int
    ) -> list[list[int]]:
        out = [row[:] for row in frame]
        for y in range(PLAY_H):
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
        available = ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION7"]
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
            "level_name": lv.name,
            "pip_budget": lv.pip_budget,
            "pips_used": lv.pips_used,
            "pips_left": max(0, lv.pip_budget - lv.pips_used),
            "groups": [
                {
                    "id": g.group_id,
                    "symbols": list(g.symbols),
                    "lit_count": g.lit_count,
                    "done": g.done,
                    "focus_shape": g.focus_shape,
                }
                for g in lv.groups
            ],
        }

    def _group_layout(self) -> list[tuple[int, int, int, int]]:
        """Return (x0, y0, inner_w, inner_h) play boxes for each group."""
        lv = self._level
        n = len(lv.groups)
        max_len = max(len(g.symbols) for g in lv.groups)
        inner_w = max_len * CELL + (max_len - 1) * CELL_GAP
        inner_h = CELL
        box_w = inner_w + 2 * PAD + 2  # +2 frame
        box_h = inner_h + 2 * PAD + 2
        gap_y = 3
        total_h = n * box_h + (n - 1) * gap_y
        y0 = max(2, (PLAY_H - total_h) // 2)
        x0 = max(2, (FRAME - box_w) // 2)
        boxes: list[tuple[int, int, int, int]] = []
        for i in range(n):
            boxes.append((x0, y0 + i * (box_h + gap_y), inner_w, inner_h))
        return boxes

    def _render_frame(self, *, flash: bool = False) -> list[list[int]]:
        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]
        lv = self._level
        boxes = self._group_layout()

        def set_px(y: int, x: int, c: int) -> None:
            if 0 <= y < PLAY_H and 0 <= x < FRAME:
                frame[y][x] = c

        for gi, g in enumerate(lv.groups):
            x0, y0, inner_w, inner_h = boxes[gi]
            # Outer frame rect
            fw = inner_w + 2 * PAD + 2
            fh = inner_h + 2 * PAD + 2
            if flash and g.group_id in lv.flash_groups:
                border = C_FLASH
            elif g.done:
                border = C_FRAME_DONE
            else:
                border = C_FRAME_OPEN
            for x in range(x0, x0 + fw):
                set_px(y0, x, border)
                set_px(y0 + fh - 1, x, border)
            for y in range(y0, y0 + fh):
                set_px(y, x0, border)
                set_px(y, x0 + fw - 1, border)

            # Symbols
            for si, shape in enumerate(g.symbols):
                cx = x0 + 1 + PAD + si * (CELL + CELL_GAP)
                cy = y0 + 1 + PAD
                lit = si < g.lit_count
                focused = (not g.done) and (si == g.lit_count)
                flashing = flash and g.group_id in lv.flash_groups

                cell = [[C_SYM_FILL for _ in range(CELL)] for _ in range(CELL)]
                fill = C_FLASH if flashing else (C_SYM_LIT if lit else C_SYM_FILL)
                for yy in range(CELL):
                    for xx in range(CELL):
                        cell[yy][xx] = fill
                outline = (
                    C_FLASH
                    if flashing
                    else (C_SYM_FOCUS if focused else C_SYM_OUTLINE)
                )
                _paint_glyph(cell, shape, outline if not lit else C_VDGREY)
                # Focus: white outer ring around the cell
                if focused and not flashing:
                    for xx in range(CELL):
                        set_px(cy - 1, cx + xx, C_SYM_FOCUS)
                        set_px(cy + CELL, cx + xx, C_SYM_FOCUS)
                    for yy in range(CELL):
                        set_px(cy + yy, cx - 1, C_SYM_FOCUS)
                        set_px(cy + yy, cx + CELL, C_SYM_FOCUS)
                for yy in range(CELL):
                    for xx in range(CELL):
                        set_px(cy + yy, cx + xx, cell[yy][xx])

        self._draw_hud(frame)
        return frame

    def _draw_hud(self, frame: list[list[int]]) -> None:
        y0 = FRAME - HUD_H
        for y in range(y0, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_HUD
        # Level progress pips (center)
        n = self.win_levels
        gap = 2
        pip_w = 3
        total = n * pip_w + (n - 1) * gap
        x_mid = max(1, (FRAME - total) // 2)
        done = self.levels_completed
        for i in range(n):
            col = (
                C_HUD_DONE
                if i < done or self.state == "WIN"
                else (C_YELLOW if i == done else C_HUD_SLOT)
            )
            xx = x_mid + i * (pip_w + gap)
            for y in range(y0 + 1, FRAME - 1):
                for x in range(xx, min(FRAME, xx + pip_w)):
                    frame[y][x] = col
        # Action budget bar (left): remaining capacity
        lv = self._level
        used = int(lv.pips_used)
        budget = max(1, min(int(lv.pip_budget), 28))
        for i in range(budget):
            x = 1 + i
            if x >= FRAME:
                break
            if used >= lv.pip_budget and not self._level_complete():
                col = C_HUD_OVER
            elif i < used:
                col = C_MGREY  # spent
            else:
                col = C_HUD_PIPS  # remaining
            for h in range(1, HUD_H - 1):
                frame[y0 + h][x] = col
