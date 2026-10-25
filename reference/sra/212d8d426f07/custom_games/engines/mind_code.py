"""MIND — intuitive Mastermind (ARC outlines, progressive reveal).

Controls:
  ACTION6 click — palette (add colour), current-guess slot (clear from there),
                  or SUBMIT button
  ACTION5 SPACE — submit guess when full
  ACTION7       — soft reset current level

Feedback (on each guess peg, not separate black/white pegs):
  white outline  = right colour in the right place
  grey outline   = right colour in the wrong place
  no outline     = colour not in the secret (for that accounting)

Also:
  - If duplicates are forbidden, a colour already in the current guess
    disappears from the palette until cleared.
  - Exact positions are revealed on the secret row immediately (animated)
    and stay visible.
  - Win plays an explanatory end animation (walk the secret + celebration).
"""

from __future__ import annotations

import json
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
C_HUD = C_VDGREY
C_HUD_DONE = C_GREEN
C_HUD_SLOT = C_DGREY
C_HUD_CUR = C_YELLOW
C_SLOT = C_DGREY
C_SECRET = C_MGREY
C_FLASH = C_RED
C_OUT_EXACT = C_WHITE
C_OUT_PRESENT = C_LGREY  # grey outline = wrong place

COLOR_NAME_TO_IDX = {
    "red": C_RED,
    "green": C_GREEN,
    "blue": C_BLUE,
    "magenta": C_MAGENTA,
    "orange": C_ORANGE,
    "pink": C_PINK,
}

Mark = Literal["exact", "present", "absent"]

ACTION_SPACE, ACTION_CLICK, ACTION_RESET = 5, 6, 7
FRAME = 64
HUD_H = 5
PLAY_H = FRAME - HUD_H
PEG = 5
PEG_GAP = 1
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "mind_code" / "levels"


def _normalize_color(raw: str) -> str:
    key = str(raw).strip().lower()
    if key not in COLOR_NAME_TO_IDX:
        raise ValueError(f"unknown colour {raw!r}")
    return key


def mark_guess(secret: list[str], guess: list[str]) -> list[Mark]:
    """Per-slot marks: exact / present / absent (Mastermind accounting)."""
    if len(secret) != len(guess):
        raise ValueError("secret/guess length mismatch")
    n = len(secret)
    marks: list[Mark] = ["absent"] * n
    used_s = [False] * n
    for i in range(n):
        if guess[i] == secret[i]:
            marks[i] = "exact"
            used_s[i] = True
    for i in range(n):
        if marks[i] == "exact":
            continue
        for j in range(n):
            if not used_s[j] and guess[i] == secret[j]:
                marks[i] = "present"
                used_s[j] = True
                break
    return marks


def score_guess(secret: list[str], guess: list[str]) -> tuple[int, int]:
    marks = mark_guess(secret, guess)
    exact = sum(1 for m in marks if m == "exact")
    present = sum(1 for m in marks if m == "present")
    return exact, present


@dataclass
class AttemptRow:
    guess: list[str]
    marks: list[Mark]
    exact: int
    present: int


@dataclass
class LevelState:
    name: str
    code_length: int
    palette: list[str]
    secret: list[str]
    max_attempts: int
    allow_duplicates: bool
    hint_outline_palette: str | None = None
    hint_outline_submit: bool = False
    current: list[str] = field(default_factory=list)
    history: list[AttemptRow] = field(default_factory=list)
    # Progressive discovery: None = still hidden, else colour name
    revealed: list[str | None] = field(default_factory=list)


def _load_level(path: Path) -> LevelState:
    data = json.loads(path.read_text(encoding="utf-8"))
    code_length = int(data["code_length"])
    palette = [_normalize_color(c) for c in data["palette"]]
    if len(palette) < 2:
        raise ValueError(f"palette too small in {path}")
    secret = [_normalize_color(c) for c in data["secret"]]
    if len(secret) != code_length:
        raise ValueError(f"secret length mismatch in {path}")
    for c in secret:
        if c not in palette:
            raise ValueError(f"secret colour {c} not in palette of {path}")
    allow_dup = bool(data.get("allow_duplicates", False))
    if not allow_dup and len(set(secret)) != len(secret):
        raise ValueError(f"secret has duplicates but allow_duplicates=false in {path}")
    hint_pal = data.get("hint_outline_palette")
    return LevelState(
        name=str(data.get("name") or path.stem),
        code_length=code_length,
        palette=palette,
        secret=secret,
        max_attempts=int(data.get("max_attempts", 8)),
        allow_duplicates=allow_dup,
        hint_outline_palette=_normalize_color(str(hint_pal)) if hint_pal else None,
        hint_outline_submit=bool(data.get("hint_outline_submit", False)),
        revealed=[None] * code_length,
    )


def _load_all_levels() -> list[LevelState]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


class MindCodeEngine:
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
        data = dict(data or {})
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        self.last_action = f"ACTION{aid}"
        if aid == ACTION_SPACE:
            self.step_index += 1
            frames = self._submit()
            if frames:
                self._pending_frames = frames
            return self.public_state()
        if aid == ACTION_CLICK:
            self.step_index += 1
            frames = self._click(int(data.get("x", -1)), int(data.get("y", -1)))
            if frames:
                self._pending_frames = frames
            return self.public_state()
        return self.public_state()

    def _secret_row_y(self) -> int:
        return 3

    def _history_origin(self) -> tuple[int, int]:
        return 2, 12

    def _current_row_y(self) -> int:
        return 44

    def _palette_y(self) -> int:
        return 52

    def _submit_box(self) -> tuple[int, int, int, int]:
        return 48, 51, 61, 57

    def _peg_x(self, origin_x: int, i: int) -> int:
        return origin_x + i * (PEG + PEG_GAP)

    def _visible_palette(self) -> list[str]:
        lv = self._level
        if lv.allow_duplicates:
            return list(lv.palette)
        used = set(lv.current)
        return [c for c in lv.palette if c not in used]

    def _hit_palette(self, x: int, y: int) -> str | None:
        py = self._palette_y()
        if y < py or y >= py + PEG:
            return None
        for i, name in enumerate(self._visible_palette()):
            x0 = self._peg_x(2, i)
            if x0 <= x < x0 + PEG:
                return name
        return None

    def _hit_current_slot(self, x: int, y: int) -> int | None:
        cy = self._current_row_y()
        if y < cy or y >= cy + PEG:
            return None
        for i in range(self._level.code_length):
            x0 = self._peg_x(2, i)
            if x0 <= x < x0 + PEG:
                return i
        return None

    def _hit_submit(self, x: int, y: int) -> bool:
        x0, y0, x1, y1 = self._submit_box()
        return x0 <= x <= x1 and y0 <= y <= y1

    def _click(self, x: int, y: int) -> list[list[list[int]]] | None:
        lv = self._level
        pal = self._hit_palette(x, y)
        if pal is not None:
            if lv.hint_outline_palette == pal:
                lv.hint_outline_palette = None
            if len(lv.current) >= lv.code_length:
                return None
            if (not lv.allow_duplicates) and pal in lv.current:
                return None
            lv.current.append(pal)
            return None

        slot = self._hit_current_slot(x, y)
        if slot is not None:
            if slot < len(lv.current):
                lv.current = lv.current[:slot]
            return None

        if self._hit_submit(x, y):
            if lv.hint_outline_submit:
                lv.hint_outline_submit = False
            return self._submit()
        return None

    def _submit(self) -> list[list[list[int]]] | None:
        lv = self._level
        frames: list[list[list[int]]] = []
        if len(lv.current) != lv.code_length:
            frames.append(self._render_frame(flash_current=True))
            frames.append(self._render_frame())
            return frames

        marks = mark_guess(lv.secret, lv.current)
        exact = sum(1 for m in marks if m == "exact")
        present = sum(1 for m in marks if m == "present")
        guess = list(lv.current)
        lv.history.append(
            AttemptRow(guess=guess, marks=marks, exact=exact, present=present)
        )
        lv.current = []

        # Progressive reveal of newly exact secret slots (animated).
        newly = [i for i, m in enumerate(marks) if m == "exact" and lv.revealed[i] is None]
        frames.append(self._render_frame())
        for i in newly:
            frames.extend(self._reveal_slot_frames(i))
            lv.revealed[i] = lv.secret[i]
            frames.append(self._render_frame())

        if exact == lv.code_length:
            # Ensure full reveal before end animation
            for i, col in enumerate(lv.secret):
                lv.revealed[i] = col
            frames.extend(self._win_explain_frames())
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
            else:
                self._level = deepcopy(self._templates[self.levels_completed])
                self.state = "NOT_FINISHED"
                frames.append(self._render_frame())
            return frames

        if len(lv.history) >= lv.max_attempts:
            frames.extend(self._soft_fail_frames(prefix=frames))
            return frames
        return frames

    def _reveal_slot_frames(self, index: int) -> list[list[list[int]]]:
        """3-frame discovery: flash white → show colour with white ring → settle."""
        frames: list[list[list[int]]] = []
        lv = self._level
        color = lv.secret[index]
        # Frame 1: bright focus on hidden slot
        frames.append(self._render_frame(focus_secret_index=index, focus_mode="flash"))
        # Frame 2: temporary reveal with white outline (not yet committed in state)
        frames.append(
            self._render_frame(
                focus_secret_index=index,
                focus_mode="reveal",
                focus_color=color,
            )
        )
        # Frame 3 duplicate for readability (same as settled after caller commits)
        frames.append(
            self._render_frame(
                focus_secret_index=index,
                focus_mode="reveal",
                focus_color=color,
            )
        )
        return frames

    def _win_explain_frames(self) -> list[list[list[int]]]:
        """Explicit end animation: walk each secret peg, then celebrate."""
        frames: list[list[list[int]]] = []
        lv = self._level
        # Hold full reveal
        base = self._render_frame(reveal_secret=True)
        frames.append(base)
        frames.append([row[:] for row in base])
        # Walk each position with white outline (duplicated frames = slower feel)
        for i in range(lv.code_length):
            f = self._render_frame(reveal_secret=True, focus_secret_index=i, focus_mode="win")
            frames.append(f)
            frames.append([row[:] for row in f])
            frames.append([row[:] for row in f])
        # White celebration blinks of the secret row area
        celeb = self._render_frame(reveal_secret=True)
        for _ in range(3):
            frames.append(self._recolor_secret_row(celeb, C_WHITE))
            frames.append([row[:] for row in celeb])
            frames.append([row[:] for row in celeb])
        return frames

    def _soft_fail_frames(
        self, prefix: list[list[list[int]]] | None = None
    ) -> list[list[list[int]]]:
        frames = list(prefix or [])
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
        return frames

    def _recolor_secret_row(
        self, frame: list[list[int]], color: int
    ) -> list[list[int]]:
        out = [row[:] for row in frame]
        sy = self._secret_row_y()
        for y in range(max(0, sy - 1), min(PLAY_H, sy + PEG + 1)):
            for x in range(FRAME):
                if out[y][x] != C_BG:
                    out[y][x] = color
        return out

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
        available = ["ACTION5", "ACTION6", "ACTION7"]
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
            "code_length": lv.code_length,
            "palette": list(lv.palette),
            "visible_palette": self._visible_palette(),
            "current_guess": list(lv.current),
            "attempts_used": len(lv.history),
            "max_attempts": lv.max_attempts,
            "attempts_left": max(0, lv.max_attempts - len(lv.history)),
            "revealed": list(lv.revealed),
            "history": [
                {
                    "guess": list(row.guess),
                    "marks": list(row.marks),
                    "exact": row.exact,
                    "present": row.present,
                }
                for row in lv.history
            ],
            "hint_outline_palette": lv.hint_outline_palette,
            "hint_outline_submit": lv.hint_outline_submit,
        }

    def _render_frame(
        self,
        *,
        reveal_secret: bool = False,
        flash_current: bool = False,
        focus_secret_index: int | None = None,
        focus_mode: str | None = None,
        focus_color: str | None = None,
    ) -> list[list[int]]:
        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]
        lv = self._level

        def set_px(y: int, x: int, c: int) -> None:
            if 0 <= y < FRAME and 0 <= x < FRAME:
                frame[y][x] = c

        def fill_peg(y: int, x: int, color: int) -> None:
            for dy in range(PEG):
                for dx in range(PEG):
                    set_px(y + dy, x + dx, color)

        def stroke_out(y0: int, y1: int, x0: int, x1: int, color: int) -> None:
            for x in range(x0 - 1, x1 + 2):
                set_px(y0 - 1, x, color)
                set_px(y1 + 1, x, color)
            for y in range(y0 - 1, y1 + 2):
                set_px(y, x0 - 1, color)
                set_px(y, x1 + 1, color)

        # Secret row
        sy = self._secret_row_y()
        for i in range(lv.code_length):
            x = self._peg_x(2, i)
            shown: int | None = None
            if reveal_secret:
                shown = COLOR_NAME_TO_IDX[lv.secret[i]]
            elif lv.revealed[i] is not None:
                shown = COLOR_NAME_TO_IDX[lv.revealed[i]]  # type: ignore[index]
            elif focus_secret_index == i and focus_mode == "reveal" and focus_color:
                shown = COLOR_NAME_TO_IDX[focus_color]
            elif focus_secret_index == i and focus_mode == "flash":
                shown = C_WHITE
            else:
                shown = C_SECRET
            fill_peg(sy, x, shown)
            if focus_secret_index == i and focus_mode in ("reveal", "win"):
                stroke_out(sy, sy + PEG - 1, x, x + PEG - 1, C_WHITE)
            elif lv.revealed[i] is not None and not reveal_secret:
                # Keep a thin white reminder on permanently revealed exacts
                stroke_out(sy, sy + PEG - 1, x, x + PEG - 1, C_WHITE)

        # History with per-peg outlines
        hx, hy = self._history_origin()
        row_stride = PEG + 3
        max_rows = min(
            lv.max_attempts, max(1, (self._current_row_y() - hy - 2) // row_stride)
        )
        for ri, row in enumerate(lv.history[-max_rows:]):
            yy = hy + ri * row_stride
            for i, name in enumerate(row.guess):
                x = self._peg_x(hx, i)
                fill_peg(yy, x, COLOR_NAME_TO_IDX[name])
                mark = row.marks[i] if i < len(row.marks) else "absent"
                if mark == "exact":
                    stroke_out(yy, yy + PEG - 1, x, x + PEG - 1, C_OUT_EXACT)
                elif mark == "present":
                    stroke_out(yy, yy + PEG - 1, x, x + PEG - 1, C_OUT_PRESENT)
                # absent: no outline

        # Current guess
        cy = self._current_row_y()
        for i in range(lv.code_length):
            x = self._peg_x(2, i)
            if i < len(lv.current):
                col = COLOR_NAME_TO_IDX[lv.current[i]]
            else:
                col = C_SLOT
            if flash_current:
                col = C_FLASH
            fill_peg(cy, x, col)

        # Palette (hide used colours when no duplicates)
        py = self._palette_y()
        visible = self._visible_palette()
        for i, name in enumerate(visible):
            x = self._peg_x(2, i)
            fill_peg(py, x, COLOR_NAME_TO_IDX[name])
            if lv.hint_outline_palette == name:
                stroke_out(py, py + PEG - 1, x, x + PEG - 1, C_WHITE)

        # SUBMIT
        x0, y0, x1, y1 = self._submit_box()
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                set_px(y, x, C_MGREY)
        ready = len(lv.current) == lv.code_length
        bar = C_WHITE if ready else C_DGREY
        for x in range(x0 + 2, x1 - 1):
            set_px((y0 + y1) // 2, x, bar)
            set_px((y0 + y1) // 2 - 1, x, bar)
        if lv.hint_outline_submit:
            stroke_out(y0, y1, x0, x1, C_WHITE)

        self._draw_hud(frame)
        return frame

    def _draw_hud(self, frame: list[list[int]]) -> None:
        y0 = FRAME - HUD_H
        for y in range(y0, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_HUD
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
                else (C_HUD_CUR if i == done else C_HUD_SLOT)
            )
            xx = x_mid + i * (pip_w + gap)
            for y in range(y0 + 1, FRAME - 1):
                for x in range(xx, min(FRAME, xx + pip_w)):
                    frame[y][x] = col
        lv = self._level
        used = len(lv.history)
        budget = max(1, min(lv.max_attempts, 20))
        for i in range(budget):
            x = 1 + i
            if x >= FRAME:
                break
            if used >= lv.max_attempts and self.state != "WIN":
                col = C_FLASH
            elif i < used:
                col = C_MGREY
            else:
                col = C_LGREY
            for h in range(1, HUD_H - 1):
                frame[y0 + h][x] = col
