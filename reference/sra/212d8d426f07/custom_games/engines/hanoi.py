"""HANO — Tower of Hanoi.

Controls:
  ACTION6 click — select top disc of a peg, or drop held disc onto a peg
  ACTION7       — soft reset current level

Rules:
  - only the top disc of a peg may be lifted
  - a disc may only be placed on an empty peg or on a strictly larger disc
  - win: complete tower (largest at bottom) on the rightmost peg
  - start: full tower on the leftmost peg
  - selection: top disc keeps its peg seat with a cyan border until placed

Layout 64×64: grey floor; all pegs share shaft+base form (goal = white mid,
grey sides); goal shows empty ghost tower contour; discs L1 Y/G, L2–3 O/Y/G,
L4 R/O/Y/G.
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
C_PINK = 7
C_RED = 8
C_BLUE = 9
C_CYAN = 10
C_YELLOW = 11
C_ORANGE = 12
C_GREEN = 14
C_PURPLE = 15

C_BG = C_BLACK
C_FLOOR = C_DGREY
# Goal peg: same 3-col form as others, but lighter middle (white) + grey sides/base.
C_PEG_GOAL = C_WHITE
C_PEG_GOAL_SIDE = C_LGREY
C_PEG_OTHER = C_LGREY  # start + middle pegs
C_PEG_OTHER_SIDE = C_MGREY
C_GHOST_W = C_LGREY  # user art "w" — grey ring of empty goal tower
C_GHOST_WW = C_WHITE  # user art "W" — white pole through ghost
C_SELECT = C_CYAN  # selected disc: corner ticks only (NOT a full bar)
C_HUD = C_VDGREY
C_HUD_DONE = C_GREEN
C_HUD_SLOT = C_DGREY
# Placement gauge must NOT use yellow (disc colour) — magenta like SWCH action bar.
C_HUD_MOVES = C_MAGENTA
C_HUD_OVER = C_RED

# Size ladder largest→smallest (user art).
# L1: Y/G · L2–L3: O/Y/G · L4: R/O/Y/G · then cyan/blue…
_DISC_LADDER = (
    C_RED,
    C_ORANGE,
    C_YELLOW,
    C_GREEN,
    C_CYAN,
    C_BLUE,
    C_PINK,
    C_PURPLE,
)


def _disc_colors(n: int) -> tuple[int, ...]:
    """Colours for disc sizes 0..n-1 (0 = largest)."""
    if n <= 0:
        return ()
    if n == 2:
        # L1 art: yellow base, green top (no orange/red).
        return (C_YELLOW, C_GREEN)
    if n == 3:
        # L2/L3 art: orange base, yellow, green top.
        return (C_ORANGE, C_YELLOW, C_GREEN)
    # L4+: red largest … green, then cyan…
    return _DISC_LADDER[:n]


ACTION_SPACE, ACTION_CLICK, ACTION_RESET = 5, 6, 7

FRAME = 64
HUD_H = 5
PLAY_H = FRAME - HUD_H
FLOOR_Y = PLAY_H - 2
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "hanoi" / "levels"


@dataclass
class LevelState:
    name: str
    discs: int
    pegs: int
    target_moves: int
    max_steps: int
    start_peg: int  # all discs begin here (bottom=largest)
    goal_peg: int  # complete ordered tower here
    # pegs[i] = stack bottom→top (disc sizes, 0=largest)
    stacks: list[list[int]] = field(default_factory=list)
    held: int | None = None  # disc size in hand, or None
    held_from: int | None = None


def _load_level(path: Path) -> LevelState:
    data = json.loads(path.read_text(encoding="utf-8"))
    discs = int(data["discs"])
    pegs = int(data["pegs"])
    if discs < 1 or discs > len(_DISC_LADDER):
        raise ValueError(f"discs out of range in {path}")
    if pegs < 3:
        raise ValueError(f"need at least 3 pegs in {path}")
    # Default: start left (0), goal rightmost.
    start_peg = int(data.get("start_peg", 0))
    goal_peg = int(data.get("goal_peg", pegs - 1))
    if not (0 <= start_peg < pegs and 0 <= goal_peg < pegs):
        raise ValueError(f"bad start/goal peg in {path}")
    if start_peg == goal_peg:
        raise ValueError(f"start_peg must differ from goal_peg in {path}")

    stacks: list[list[int]] = [[] for _ in range(pegs)]
    # largest (0) at bottom … smallest (discs-1) on top
    stacks[start_peg] = list(range(discs))
    target = int(data.get("target_moves", (1 << discs) - 1))
    return LevelState(
        name=str(data.get("name") or path.stem),
        discs=discs,
        pegs=pegs,
        target_moves=target,
        max_steps=int(data.get("max_steps", max(target * 4, 40))),
        start_peg=start_peg,
        goal_peg=goal_peg,
        stacks=stacks,
    )


def _load_all_levels() -> list[LevelState]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


class HanoiEngine:
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
        # disc_moves: ONLY +1 when a disc is placed on a *different* peg.
        # Never changes on select / cancel / illegal drop. Drives the magenta bar.
        self.disc_moves = 0
        self.level_steps = 0  # alias of disc_moves (kept for public_state)
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._level = deepcopy(self._templates[0])

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.disc_moves = 0
        self.level_steps = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames = None
        self._level = deepcopy(self._templates[0])
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[idx])
        self.disc_moves = 0
        self.level_steps = 0
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

        peg = self._hit_peg(int(data.get("x", -1)), int(data.get("y", -1)))
        if peg is None:
            return self.public_state()

        frames: list[list[list[int]]] = []
        event = self._click_peg(peg, frames)  # "select" | "cancel" | "illegal" | "place"
        if event == "place":
            # Advance counters BEFORE any frame that must show the new bar fill.
            # (Previously the place frame was rendered first → bar only updated on
            # the *next* select, which looked like "bar grows on selection".)
            self.disc_moves += 1
            self.level_steps = self.disc_moves
            self.step_index += 1
            # Replace the place snapshot (rendered pre-increment) with a fresh one.
            if frames:
                frames[-1] = self._render_frame()
            else:
                frames.append(self._render_frame())
            if self._level_complete():
                frames.extend(self._win_flash_frames())
                self.levels_completed += 1
                if self.levels_completed >= self.win_levels:
                    self.state = "WIN"
                else:
                    self._level = deepcopy(self._templates[self.levels_completed])
                    self.disc_moves = 0
                    self.level_steps = 0
                    self.state = "NOT_FINISHED"
                    frames.append(self._render_frame())
            elif self.disc_moves > self._level.target_moves:
                self._pending_frames = self._soft_fail_frames(prefix=frames)
                return self.public_state()
            elif self.disc_moves >= self._level.max_steps:
                self._pending_frames = self._soft_fail_frames(prefix=frames)
                return self.public_state()
        if frames:
            self._pending_frames = frames
        return self.public_state()

    def _level_complete(self) -> bool:
        lv = self._level
        if lv.held is not None:
            return False
        goal = lv.stacks[lv.goal_peg]
        if len(goal) != lv.discs:
            return False
        # bottom→top: 0,1,2,… (largest to smallest)
        return goal == list(range(lv.discs))

    def _click_peg(self, peg: int, frames: list[list[list[int]]]) -> str:
        """Handle pick/place. Returns event name — only \"place\" counts as a move."""
        lv = self._level
        if lv.held is None:
            # SELECT top disc — never counts toward the action bar.
            if not lv.stacks[peg]:
                pre = self._render_frame()
                frames.append(self._recolor_play_non_bg(pre, C_RED))
                frames.append(self._render_frame())
                return "illegal"
            disc = lv.stacks[peg].pop()
            lv.held = disc
            lv.held_from = peg
            frames.append(self._render_frame())
            return "select"

        # Trying to place held disc (size 0 = largest … n-1 = smallest)
        disc = lv.held
        assert disc is not None
        stack = lv.stacks[peg]
        # Legal only on empty peg or on a strictly larger disc (smaller index).
        if stack and disc <= stack[-1]:
            pre = self._render_frame()
            frames.append(self._recolor_play_non_bg(pre, C_RED))
            frames.append(self._render_frame())
            return "illegal"

        from_peg = lv.held_from
        stack.append(disc)
        lv.held = None
        lv.held_from = None
        frames.append(self._render_frame())
        # Same peg = cancel selection, NOT a move.
        if from_peg is None or from_peg == peg:
            return "cancel"
        return "place"

    @staticmethod
    def _recolor_play_non_bg(
        frame: list[list[int]], color: int
    ) -> list[list[int]]:
        """Solid flash: every non-background play pixel becomes color (no leftover white)."""
        out = [row[:] for row in frame]
        for y in range(PLAY_H):
            for x in range(FRAME):
                if out[y][x] != C_BG:
                    out[y][x] = color
        return out

    def _soft_fail_frames(
        self, prefix: list[list[list[int]]] | None = None
    ) -> list[list[list[int]]]:
        frames = list(prefix or [])
        pre = self._render_frame()
        for i in range(4):
            if i % 2 == 0:
                frames.append(self._recolor_play_non_bg(pre, C_RED))
            else:
                frames.append([row[:] for row in pre])
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[idx])
        self.disc_moves = 0
        self.level_steps = 0
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        frames.append(self._render_frame())
        return frames

    def _win_flash_frames(self) -> list[list[list[int]]]:
        """Full green blink of the board (no white peg remnants)."""
        frames: list[list[list[int]]] = []
        pre = self._render_frame()
        for _ in range(3):
            frames.append(self._recolor_play_non_bg(pre, C_GREEN))
            frames.append([row[:] for row in pre])
        return frames

    def _peg_layout(self) -> tuple[list[int], int]:
        """Return (centers_x, disc_unit_half_width_base)."""
        n = self._level.pegs
        # leave margins
        margin = 4
        usable = FRAME - 2 * margin
        if n == 1:
            return [FRAME // 2], 3
        step = usable // n
        centers = [margin + step // 2 + i * step for i in range(n)]
        return centers, max(2, step // 2 - 2)

    def _hit_peg(self, x: int, y: int) -> int | None:
        if y < 0 or y >= PLAY_H or x < 0 or x >= FRAME:
            return None
        centers, half = self._peg_layout()
        best: int | None = None
        best_d = 10**9
        for i, cx in enumerate(centers):
            d = abs(x - cx)
            if d <= half + 2 and d < best_d:
                best_d = d
                best = i
        return best

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
            "default_fps": max(self.info.default_fps, 8 if len(frames) > 1 else self.info.default_fps),
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
            "level_steps": self.disc_moves,
            "moves": self.disc_moves,
            "disc_moves": self.disc_moves,
            "target_moves": lv.target_moves,
            "discs": lv.discs,
            "pegs": lv.pegs,
            "held": lv.held,
            "stacks": [list(s) for s in lv.stacks],
            "goal_peg": lv.goal_peg,
        }

    def _render_frame(
        self,
        *,
        flash_peg: int | None = None,
        flash_color: int = C_RED,
    ) -> list[list[int]]:
        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]
        lv = self._level
        centers, half_base = self._peg_layout()
        # Floor
        for y in range(FLOOR_Y, PLAY_H):
            for x in range(FRAME):
                frame[y][x] = C_FLOOR

        peg_top = 8
        # Real discs stay 2px tall; ghost contour is only raised/widened around them.
        disc_h = 2
        # Goal base foot: one extra hollow under largest, then floor ggg…
        base_h = 1
        max_stack_h = lv.discs * disc_h + base_h + 2
        # Discs / ghost sit above the base; floor starts at FLOOR_Y.
        pole_bottom = FLOOR_Y - 1 - base_h
        pole_top = max(peg_top, pole_bottom - max_stack_h - 2)

        def set_px(y: int, x: int, c: int) -> None:
            if 0 <= y < PLAY_H and 0 <= x < FRAME:
                frame[y][x] = c

        def is_goal(pi: int) -> bool:
            return pi == lv.goal_peg

        def disc_half(disc: int) -> int:
            """Solid disc half-width (unchanged slot size)."""
            return 3 + 2 * (lv.discs - 1 - disc)

        def ghost_half(disc: int) -> int:
            """Contour half-width = disc + 1px wider."""
            return disc_half(disc) + 1

        def draw_pole_shaft(
            cx: int,
            *,
            col: int,
            side: int,
            y0: int,
            y1: int,
        ) -> None:
            """3-col pole (side / mid / side) — same width for every peg."""
            for y in range(y0, y1 + 1):
                set_px(y, cx, col)
                set_px(y, cx - 1, side)
                set_px(y, cx + 1, side)

        def draw_pole_foot(
            cx: int,
            *,
            col: int,
            side: int,
            foot_y: int,
        ) -> None:
            for dx in range(-3, 4):
                set_px(foot_y, cx + dx, col if abs(dx) <= 1 else side)

        def draw_pole(pi: int, cx: int) -> None:
            """All pegs: 3px shaft + base; goal mid is white (lighter)."""
            foot_y = pole_bottom + base_h  # last row above floor
            if flash_peg == pi:
                draw_pole_shaft(
                    cx, col=flash_color, side=C_VDGREY, y0=pole_top, y1=foot_y
                )
                draw_pole_foot(cx, col=flash_color, side=C_VDGREY, foot_y=foot_y)
                return
            if is_goal(pi):
                draw_pole_shaft(
                    cx,
                    col=C_PEG_GOAL,
                    side=C_PEG_GOAL_SIDE,
                    y0=pole_top,
                    y1=foot_y,
                )
                draw_pole_foot(
                    cx,
                    col=C_PEG_GOAL,
                    side=C_PEG_GOAL_SIDE,
                    foot_y=foot_y,
                )
                return
            draw_pole_shaft(
                cx, col=C_PEG_OTHER, side=C_PEG_OTHER_SIDE, y0=pole_top, y1=foot_y
            )
            draw_pole_foot(
                cx, col=C_PEG_OTHER, side=C_PEG_OTHER_SIDE, foot_y=foot_y
            )

        # Peg poles
        for i, cx in enumerate(centers):
            draw_pole(i, cx)

        colors = _disc_colors(lv.discs)

        def disc_color(disc: int) -> int:
            if disc < len(colors):
                return colors[disc]
            return _DISC_LADDER[disc % len(_DISC_LADDER)]

        def ghost_span(cx: int, half: int) -> tuple[int, int]:
            # Single white mid column (3px peg); tips at cx±half
            return cx - half, cx + half

        def draw_ghost_band(cx: int, y: int, half: int) -> None:
            """Grey wings + white mid (contour 1px wider than disc)."""
            left, right = ghost_span(cx, half)
            wing = min(3, max(1, half))
            for x in range(left, left + wing):
                set_px(y, x, C_GHOST_W)
            for x in range(right - wing + 1, right + 1):
                set_px(y, x, C_GHOST_W)
            set_px(y, cx, C_GHOST_WW)

        def draw_ghost_hollow(cx: int, y: int, half: int) -> None:
            """Tips + white mid; interior empty."""
            left, right = ghost_span(cx, half)
            set_px(y, left, C_GHOST_W)
            set_px(y, right, C_GHOST_W)
            set_px(y, cx, C_GHOST_WW)

        def disc_slot_y(height_i: int) -> tuple[int, int]:
            y1 = pole_bottom - height_i * disc_h
            y0 = y1 - disc_h + 1
            return y0, y1

        def draw_ghost_disc(cx: int, height_i: int, disc: int) -> None:
            """Ghost contour around disc slot: +1px wider, raised +1px (discs stay 2px).

            Under-band only for the base (largest, disc 0) — full width.
            """
            y0, y1 = disc_slot_y(height_i)
            half = ghost_half(disc)
            # Raise contour by 1px: top band one row above disc top
            draw_ghost_band(cx, y0 - 1, half)
            draw_ghost_hollow(cx, y0, half)
            draw_ghost_hollow(cx, y1, half)
            # Only the bottom disc gets a full-width under contour
            if disc == 0:
                draw_ghost_band(cx, y1 + 1, half)

        def draw_goal_base(cx: int) -> None:
            """Peg foot under the base disc only (no under-bands on upper discs)."""
            half = ghost_half(0)
            foot_y = pole_bottom + base_h
            # Full-width band under base disc (same width as largest contour)
            draw_ghost_band(cx, pole_bottom + 1, half)
            if foot_y > pole_bottom + 1:
                draw_ghost_hollow(cx, foot_y, half)

        def draw_disc(
            cx: int,
            height_i: int,
            disc: int,
            *,
            selected: bool = False,
            goal: bool = False,
        ) -> None:
            y0, y1 = disc_slot_y(height_i)
            half = disc_half(disc)
            col = disc_color(disc)
            for y in range(y0, y1 + 1):
                for x in range(cx - half, cx + half + 1):
                    set_px(y, x, col)
            if selected:
                # Full cyan contour around the selected top disc (user art: c…c).
                left, right = cx - half - 1, cx + half + 1
                for x in range(left, right + 1):
                    set_px(y0 - 1, x, C_SELECT)
                    set_px(y1 + 1, x, C_SELECT)
                for y in range(y0, y1 + 1):
                    set_px(y, left, C_SELECT)
                    set_px(y, right, C_SELECT)
            else:
                # 3px pole punch-through (same form for goal / others)
                mid = C_PEG_GOAL if goal else C_PEG_OTHER
                side = C_PEG_GOAL_SIDE if goal else C_PEG_OTHER_SIDE
                for y in range(y0, y1 + 1):
                    set_px(y, cx, mid)
                    set_px(y, cx - 1, side)
                    set_px(y, cx + 1, side)

        # Ghost empty tower + base on goal peg; real discs drawn on top.
        goal_cx = centers[lv.goal_peg]
        for height_i, disc in enumerate(range(lv.discs)):
            draw_ghost_disc(goal_cx, height_i, disc)
        draw_goal_base(goal_cx)

        # Discs on pegs
        for pi, stack in enumerate(lv.stacks):
            cx = centers[pi]
            for height_i, disc in enumerate(stack):
                draw_disc(cx, height_i, disc, goal=is_goal(pi))

        # Held disc stays on its source peg with cyan selection border
        # (not lifted into free space). Placement on another peg clears it.
        if lv.held is not None and lv.held_from is not None:
            from_peg = lv.held_from
            cx = centers[from_peg]
            height_i = len(lv.stacks[from_peg])  # on top of remaining stack
            draw_disc(cx, height_i, lv.held, selected=True, goal=is_goal(from_peg))

        self._draw_hud(frame)
        return frame

    def _draw_hud(self, frame: list[list[int]]) -> None:
        y0 = FRAME - HUD_H
        for y in range(y0, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_HUD
        # level pips
        n = self.win_levels
        gap = 2
        pip_w = 3
        total = n * pip_w + (n - 1) * gap
        x0 = max(1, (FRAME - total) // 2)
        done = self.levels_completed
        for i in range(n):
            col = (
                C_HUD_DONE
                if i < done or self.state == "WIN"
                else (C_YELLOW if i == done else C_HUD_SLOT)
            )
            xx = x0 + i * (pip_w + gap)
            for y in range(y0 + 1, FRAME - 1):
                for x in range(xx, min(FRAME, xx + pip_w)):
                    frame[y][x] = col
        # Magenta action bar (left): capacity track dim, fill = disc_moves only.
        # disc_moves increases solely on event=="place" (never on select).
        lv = self._level
        moves = int(self.disc_moves)
        target = max(1, min(int(lv.target_moves), 20))
        bar_x0 = 1
        for i in range(target):
            x = bar_x0 + i
            if not (0 <= x < FRAME):
                continue
            if moves > lv.target_moves:
                col = C_HUD_OVER
            elif i < moves:
                col = C_HUD_MOVES  # magenta fill: one px per placed move
            else:
                col = C_HUD_SLOT  # empty capacity
            for h in range(1, HUD_H - 1):
                frame[y0 + h][x] = col
