"""HOLE — interactive e3721c99-style recoloring for ARC3 custom backend.

Center playfield is fully paintable by flood-fill (forms, holes, background).
Left legend is decorative. Six bottom color buttons (no mixing).
"""

from __future__ import annotations

import json
from collections import Counter, deque
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

FRAME = 64
PLAY_ROWS = 55
LEGEND_COLS = 6

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_CYCLE, ACTION_CLICK, ACTION_RESET = 5, 6, 7

# Char → ARC3 palette index
PALETTE = {
    "0": 0,
    "1": 1,
    "2": 2,
    ".": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "C": 10,
    "Y": 11,
    "O": 12,
    "M": 13,
    "G": 14,
    "P": 6,
}
INV_PALETTE = {
    0: "0",
    1: "1",
    2: "2",
    3: ".",
    4: "4",
    5: "5",
    6: "P",
    7: "7",
    8: "8",
    9: "9",
    10: "C",
    11: "Y",
    12: "O",
    13: "M",
    14: "G",
}

# Selectable colors (no mixing). Orange (12) is required by authored L06.
COLOR_ORDER = (8, 14, 9, 11, 10, 6, 12)
COLOR_NAME = {8: "R", 14: "G", 9: "B", 11: "Y", 10: "C", 6: "P", 12: "O"}
GREY = 1
BLACK = 5

# Seven compact bottom buttons: R G B Y C P O
# (color, row0, row1_excl, col0, col1_excl)
BUTTON_SPECS = (
    (8, 57, 63, 1, 8),
    (14, 57, 63, 10, 17),
    (9, 57, 63, 19, 26),
    (11, 57, 63, 28, 35),
    (10, 57, 63, 37, 44),
    (6, 57, 63, 46, 53),
    (12, 57, 63, 55, 62),
)

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "hole_palette" / "levels"


def _char_to_color(ch: str) -> int:
    return PALETTE.get(ch, GREY)


def _flood(grid: list[list[int]], r: int, c: int) -> list[tuple[int, int]]:
    """4-connected component of the same color inside the center playfield."""
    if not (0 <= r < PLAY_ROWS and LEGEND_COLS <= c < FRAME):
        return []
    color = grid[r][c]
    out: list[tuple[int, int]] = []
    q = deque([(r, c)])
    seen = {(r, c)}
    while q:
        rr, cc = q.popleft()
        out.append((rr, cc))
        for nr, nc in ((rr - 1, cc), (rr + 1, cc), (rr, cc - 1), (rr, cc + 1)):
            if (
                0 <= nr < PLAY_ROWS
                and LEGEND_COLS <= nc < FRAME
                and (nr, nc) not in seen
                and grid[nr][nc] == color
            ):
                seen.add((nr, nc))
                q.append((nr, nc))
    return out


@dataclass
class LevelState:
    name: str
    # Full 64x64 artwork template (legend + solved/target center + HUD art).
    target: list[list[int]]
    # Mutable current grid (same size); center is edited by flood-fill.
    grid: list[list[int]]
    max_steps: int
    selected_color: int = 8
    cursor: tuple[int, int] = (10, 20)


def _majority_center_color(target: list[list[int]]) -> int:
    counts: Counter[int] = Counter()
    for r in range(PLAY_ROWS):
        for c in range(LEGEND_COLS, FRAME):
            counts[target[r][c]] += 1
    return counts.most_common(1)[0][0]


def _mono_components(
    grid: list[list[int]],
    *,
    skip_color: int | None = None,
) -> list[list[tuple[int, int]]]:
    """4-connected same-color components in the center playfield."""
    seen: set[tuple[int, int]] = set()
    comps: list[list[tuple[int, int]]] = []
    for r in range(PLAY_ROWS):
        for c in range(LEGEND_COLS, FRAME):
            if (r, c) in seen:
                continue
            if skip_color is not None and grid[r][c] == skip_color:
                continue
            cells = _flood(grid, r, c)
            seen.update(cells)
            comps.append(cells)
    return comps


def _count_holes_in_target(
    target: list[list[int]], form: list[tuple[int, int]], bg: int
) -> int:
    """Count enclosed pockets touching the form (field-bg or special fills like black)."""
    form_set = set(form)
    form_col = target[form[0][0]][form[0][1]]
    seen: set[tuple[int, int]] = set(form_set)
    comps: list[list[tuple[int, int]]] = []
    for r in range(PLAY_ROWS):
        for c in range(LEGEND_COLS, FRAME):
            if (r, c) in seen or target[r][c] == form_col:
                continue
            cells = _flood(target, r, c)
            seen.update(cells)
            comps.append(cells)
    bg_comps = [c for c in comps if target[c[0][0]][c[0][1]] == bg]
    exterior = max(bg_comps, key=len) if bg_comps else []
    n = 0
    for comp in comps:
        if comp is exterior or comp == exterior:
            continue
        if any(
            any(
                (nr, nc) in form_set
                for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1))
            )
            for r, c in comp
        ):
            n += 1
    return n


def _initial_grid_from_target(
    target: list[list[int]],
    *,
    grey_forms: bool,
    wrong_start: bool,
    paint_background: bool = False,
    start_background: int | None = None,
    start_form_by_holes: dict[int, int] | None = None,
    start_form_by_color: dict[int, int] | None = None,
    form_colors: set[int] | None = None,
) -> list[list[int]]:
    """Build the playable start grid from the authored target artwork."""
    grid = deepcopy(target)
    bg = _majority_center_color(target)
    raw_comps = _mono_components(target, skip_color=bg)
    # Ignore non-form colors (e.g. black hole fills) so they are not recolored
    # as if they were shapes.
    if form_colors:
        form_comps = [
            comp
            for comp in raw_comps
            if target[comp[0][0]][comp[0][1]] in form_colors
        ]
    else:
        form_comps = raw_comps
    if grey_forms and not wrong_start:
        # Grey each form component. Safe when forms are separated by background.
        for cells in form_comps:
            for r, c in cells:
                grid[r][c] = GREY
    if wrong_start:
        # Per-component wrong color, graph-colored so adjacent forms stay
        # flood-fill separable (global palette swaps can merge neighbors).
        palette = list(COLOR_ORDER) + [GREY, 2, 7, 3, 4, 12, 13, 0]
        cell_owner = {
            cell: idx for idx, cells in enumerate(form_comps) for cell in cells
        }
        neighbors: list[set[int]] = [set() for _ in form_comps]
        for idx, cells in enumerate(form_comps):
            for r, c in cells:
                for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                    other = cell_owner.get((nr, nc))
                    if other is not None and other != idx:
                        neighbors[idx].add(other)
        assigned = [-1] * len(form_comps)
        target_of = [target[cells[0][0]][cells[0][1]] for cells in form_comps]
        wrong_bg_preview = (
            start_background
            if start_background is not None
            else next((c for c in (5, 2, 3, 4, 7) if c != bg), 5)
        )
        for idx, cells in enumerate(form_comps):
            # Avoid background (target + start), own target, neighbors' starts/targets.
            forbidden = {bg, target_of[idx], wrong_bg_preview}
            for j in neighbors[idx]:
                forbidden.add(target_of[j])
                if assigned[j] >= 0:
                    forbidden.add(assigned[j])
            pick = next((col for col in palette if col not in forbidden), GREY)
            if pick == bg:
                pick = GREY
            assigned[idx] = pick
            for r, c in cells:
                grid[r][c] = pick
    # Optional explicit start colors by hole-count (overrides wrong_start picks).
    if start_form_by_holes:
        for cells in form_comps:
            hc = _count_holes_in_target(target, cells, bg)
            if hc in start_form_by_holes:
                col = start_form_by_holes[hc]
                for r, c in cells:
                    grid[r][c] = col
    if start_form_by_color:
        for cells in form_comps:
            tgt_col = target[cells[0][0]][cells[0][1]]
            if tgt_col in start_form_by_color:
                col = start_form_by_color[tgt_col]
                for r, c in cells:
                    grid[r][c] = col
    if paint_background:
        # L5/L6: field + holes share the hole/field color in the target, and both
        # start wrong so the player must paint them (never same as a form color).
        wrong_bg = (
            start_background
            if start_background is not None
            else next((c for c in (5, 2, 3, 4, 7) if c != bg), 5)
        )
        for r in range(PLAY_ROWS):
            for c in range(LEGEND_COLS, FRAME):
                if target[r][c] == bg:
                    grid[r][c] = wrong_bg
    return grid


def _parse_level(path: Path) -> LevelState:
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows = raw["target"]
    if len(rows) != FRAME or any(len(row) != FRAME for row in rows):
        raise ValueError(f"{path.name}: target must be 64x64")
    target = [[_char_to_color(ch) for ch in row] for row in rows]
    grey_forms = bool(raw.get("grey_forms", False))
    wrong_start = bool(raw.get("wrong_start", False))
    paint_background = bool(raw.get("paint_background", False))
    start_background = raw.get("start_background")
    start_bg_id = (
        _char_to_color(str(start_background))
        if start_background is not None
        else None
    )
    start_form_by_holes_raw = raw.get("start_form_by_holes") or {}
    start_form_by_holes = {
        int(k): (_char_to_color(v) if isinstance(v, str) else int(v))
        for k, v in start_form_by_holes_raw.items()
    }
    start_form_by_color_raw = raw.get("start_form_by_color") or {}
    start_form_by_color = {
        (_char_to_color(k) if isinstance(k, str) else int(k)): (
            _char_to_color(v) if isinstance(v, str) else int(v)
        )
        for k, v in start_form_by_color_raw.items()
    }
    form_colors: set[int] | None = None
    hcm = raw.get("hole_color_map") or {}
    if hcm:
        form_colors = {
            _char_to_color(v) if isinstance(v, str) else int(v) for v in hcm.values()
        }
    # Defaults: L01-L03 grey; L04-L06 wrong unless overridden.
    stem = path.stem.upper()
    if "grey_forms" not in raw and "wrong_start" not in raw:
        if stem in {"L01", "L02", "L03"}:
            grey_forms = True
        elif stem in {"L04", "L05", "L06"}:
            wrong_start = True
    # Optional authored start grid (overrides grey/wrong_start derivation).
    if raw.get("initial"):
        init_rows = raw["initial"]
        if len(init_rows) != FRAME or any(len(row) != FRAME for row in init_rows):
            raise ValueError(f"{path.name}: initial must be 64x64")
        grid = [[_char_to_color(ch) for ch in row] for row in init_rows]
    else:
        grid = _initial_grid_from_target(
            target,
            grey_forms=grey_forms,
            wrong_start=wrong_start,
            paint_background=paint_background,
            start_background=start_bg_id,
            start_form_by_holes=start_form_by_holes or None,
            start_form_by_color=start_form_by_color or None,
            form_colors=form_colors,
        )
    selected = {
        "R": 8,
        "G": 14,
        "B": 9,
        "Y": 11,
        "C": 10,
        "P": 6,
        "O": 12,
    }.get(str(raw.get("selected", "R")).upper(), 8)
    cursor = raw.get("cursor", [10, 20])
    return LevelState(
        name=str(raw.get("name") or path.stem),
        target=target,
        grid=grid,
        max_steps=int(raw.get("max_steps", 200)),
        selected_color=selected,
        cursor=(int(cursor[0]), int(cursor[1])),
    )


def _load_all_levels() -> list[LevelState]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_parse_level(p) for p in paths]


class HolePaletteEngine:
    """Flood-fill recolor on the center playfield; six color buttons; legend fixed."""

    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_all_levels()
        self.win_levels = min(int(info.levels), len(self._templates))
        self.levels_completed = 0
        self.level_steps = 0
        self.step_index = 0
        self.state = "NOT_FINISHED"
        self.last_action = "RESET"
        self.last_event = "READY"
        self._level = deepcopy(self._templates[0])

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.level_steps = 0
        self.step_index = 0
        self.state = "NOT_FINISHED"
        self.last_action = "RESET"
        self.last_event = "READY"
        self._level = deepcopy(self._templates[0])
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[idx])
        self.level_steps = 0
        self.last_action = "ACTION7"
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        self.last_event = "LEVEL_RESET"
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        if self.state == "WIN":
            return self.public_state()
        data = dict(data or {})
        try:
            aid = int(action_id)
        except (TypeError, ValueError):
            return self.public_state()
        self.last_action = f"ACTION{aid}"
        if aid == ACTION_RESET:
            return self.level_reset()
        self.step_index += 1
        if aid in (ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT):
            self.level_steps += 1
            dr, dc = {
                ACTION_UP: (-1, 0),
                ACTION_DOWN: (1, 0),
                ACTION_LEFT: (0, -1),
                ACTION_RIGHT: (0, 1),
            }[aid]
            r, c = self._level.cursor
            self._level.cursor = (
                max(0, min(FRAME - 1, r + dr)),
                max(0, min(FRAME - 1, c + dc)),
            )
            self.last_event = "CURSOR_MOVED"
            return self.public_state()
        if aid == ACTION_CYCLE:
            self.level_steps += 1
            idx = COLOR_ORDER.index(self._level.selected_color)
            self._level.selected_color = COLOR_ORDER[(idx + 1) % len(COLOR_ORDER)]
            self.last_event = "COLOR_CYCLED"
            return self.public_state()
        if aid == ACTION_CLICK:
            self.level_steps += 1
            x = int(data.get("x", self._level.cursor[1]))
            y = int(data.get("y", self._level.cursor[0]))
            self._level.cursor = (
                max(0, min(FRAME - 1, y)),
                max(0, min(FRAME - 1, x)),
            )
            return self._click()
        return self.public_state()

    def _click(self) -> dict[str, Any]:
        r, c = self._level.cursor
        for color, r0, r1, c0, c1 in BUTTON_SPECS:
            if r0 <= r < r1 and c0 <= c < c1:
                self._level.selected_color = color
                self.last_event = "BUTTON_SELECTED"
                return self.public_state()
        # Legend / HUD outside center: ignore.
        if c < LEGEND_COLS or r >= PLAY_ROWS:
            self.last_event = "CLICK_EMPTY"
            return self.public_state()
        cells = _flood(self._level.grid, r, c)
        if not cells:
            self.last_event = "CLICK_EMPTY"
            return self.public_state()
        current = self._level.grid[r][c]
        selected = self._level.selected_color
        if current == selected:
            self.last_event = "PAINT_SAME"
            return self.public_state()
        # If adjacent forms merged into one same-color blob, only recolor cells
        # that share the clicked cell's target color (keeps forms separable).
        t0 = self._level.target[r][c]
        cells = [(rr, cc) for rr, cc in cells if self._level.target[rr][cc] == t0]
        if not cells:
            self.last_event = "CLICK_EMPTY"
            return self.public_state()
        for rr, cc in cells:
            self._level.grid[rr][cc] = selected
        self.last_event = "PAINTED"
        if self._is_solved():
            return self._complete_level()
        if self.level_steps >= self._level.max_steps:
            self.state = "GAME_OVER"
        return self.public_state()

    def _is_solved(self) -> bool:
        # Center playfield must match the authored target exactly.
        for r in range(PLAY_ROWS):
            for c in range(LEGEND_COLS, FRAME):
                if self._level.grid[r][c] != self._level.target[r][c]:
                    return False
        return True

    def _anim_hold(self) -> int:
        return max(1, round(self.info.default_fps / 4))

    def _with_settled_transition(
        self,
        result: dict[str, Any],
        prefix: list[list[list[int]]],
    ) -> dict[str, Any]:
        settled = result["frame"]
        hold = max(3, self._anim_hold() * 2)
        frames = list(prefix) + [deepcopy(settled) for _ in range(hold)]
        out = dict(result)
        out["frames"] = frames
        out["frame_count"] = len(frames)
        out["frame"] = frames[-1]
        out["transition_frame_interval_ms"] = 1000 / max(1, self.info.default_fps)
        return out

    def _complete_level(self) -> dict[str, Any]:
        solved = self._render_frame()
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            self.last_event = "GAME_WON"
        else:
            self._level = deepcopy(self._templates[self.levels_completed])
            self.level_steps = 0
            self.state = "NOT_FINISHED"
            self.last_event = "LEVEL_COMPLETE"
        result = self.public_state()
        hold = self._anim_hold()
        # White pulse on the solved board, then settle on the next/win frame.
        white = deepcopy(solved)
        for y in range(PLAY_ROWS):
            for x in range(FRAME):
                if white[y][x] != 5:
                    white[y][x] = 0
        for x in range(FRAME):
            white[55][x] = 0
        prefix: list[list[list[int]]] = []
        for _ in range(2):
            prefix.extend(deepcopy(solved) for _ in range(hold))
            prefix.extend(deepcopy(white) for _ in range(hold))
        prefix.extend(deepcopy(solved) for _ in range(hold * 2))
        return self._with_settled_transition(result, prefix)

    def public_state(self) -> dict[str, Any]:
        frame = self._render_frame()
        ids = list(range(1, 8)) if self.state == "NOT_FINISHED" else [7]
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
            "level": min(self.levels_completed + 1, self.win_levels),
            "levels_completed": self.levels_completed,
            "win_levels": self.win_levels,
            "step_index": self.step_index,
            "available_actions": [f"ACTION{i}" for i in ids],
            "available_action_ids": ids,
            "last_action": self.last_action,
            "score": self.levels_completed,
            "full_reset": False,
            "source_path": str(LEVELS_DIR),
            "custom_family": self.info.family,
            "level_name": self._level.name,
            "level_steps": self.level_steps,
            "max_steps": self._level.max_steps,
            "last_event": self.last_event,
            "selected_color": COLOR_NAME.get(self._level.selected_color, "?"),
            "selected_color_id": self._level.selected_color,
            "cursor": {"row": self._level.cursor[0], "col": self._level.cursor[1]},
        }

    def _render_frame(self) -> list[list[int]]:
        frame = deepcopy(self._level.grid)
        self._draw_buttons(frame)
        return frame

    def _draw_buttons(self, frame: list[list[int]]) -> None:
        # Neutral HUD strip then six color wells.
        for r in range(56, FRAME):
            for c in range(FRAME):
                frame[r][c] = 3
        frame[55] = [4] * FRAME
        for color, r0, r1, c0, c1 in BUTTON_SPECS:
            border = 0 if color == self._level.selected_color else 5
            for r in range(r0, r1):
                for c in range(c0, c1):
                    if r in (r0, r1 - 1) or c in (c0, c1 - 1):
                        frame[r][c] = border
                    else:
                        frame[r][c] = color
