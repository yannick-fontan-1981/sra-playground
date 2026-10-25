"""ETAG — Labyrinthe à étages (12×12, cell 4px, gap/bordure orange).

Controls:
  ACTION1-4 — move; enter/leave stairs only via the grey (3) side
  ACTION7   — soft reset

Ascend/descend changes floor at the same (row, col). Reach E to win.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from custom_games.registry import CustomGameInfo

C_WHITE, C_LGREY, C_MGREY, C_DGREY, C_VDGREY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_PINK, C_RED, C_BLUE, C_CYAN = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_BROWN, C_GREEN, C_PURPLE = 11, 12, 13, 14, 15

# Motif codes → ARC colors
_MOTIF = {
    ".": C_BROWN,
    "o": C_ORANGE,
    "1": C_WHITE,
    "2": C_LGREY,
    "3": C_MGREY,
    "4": C_DGREY,
    "5": C_BLACK,
}

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_RESET = 7

FRAME = 64
GRID = 12
CELL = 4
GAP = 1
BORDER = 1  # orange frame around the whole grid
INNER = GRID * CELL + (GRID - 1) * GAP  # 59 = 12*4 + 11*1
MAP = INNER + 2 * BORDER  # 61
# Shifted vs previous center (1,1): 1px up, and flush-left so the right
# strip is exactly 3px for the floor rail (x = 61..63).
MAP_X0 = 0
MAP_Y0 = 0
FLOOR_RAIL_X0 = MAP_X0 + MAP  # 61
FLOOR_RAIL_W = FRAME - FLOOR_RAIL_X0  # 3
# Stair motifs are 6×6 = cell 4 + 1px gap overhang on each side.

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "etag_floors" / "levels"

Cell = tuple[int, int]
Orient = Literal["N", "E", "S", "W"]
StairKind = Literal["up", "down"]

# Ascending base = entry face on East (grey on east edge), 6×6
_ASC_E = [
    "111111",
    "11223o",
    "11223o",
    "11223o",
    "11223o",
    "111111",
]
# Descending base = entry face on West, 6×6
_DESC_W = [
    "111111",
    "o34551",
    "o34551",
    "o34551",
    "o34551",
    "111111",
]

_UP_GLYPH = {"A": "N", "B": "E", "C": "S", "D": "W"}
_DOWN_GLYPH = {"a": "N", "b": "E", "c": "S", "d": "W"}
_OPP_ORIENT: dict[Orient, Orient] = {"N": "S", "S": "N", "E": "W", "W": "E"}


def _rot90(pat: list[str]) -> list[str]:
    n = len(pat)
    return ["".join(pat[n - 1 - r][c] for r in range(n)) for c in range(n)]


def _orient_pattern(base: list[str], base_orient: Orient, want: Orient) -> list[str]:
    order: list[Orient] = ["N", "E", "S", "W"]
    # Rotate base so its entry face matches want.
    # base_orient is current entry face of `base`.
    steps = (order.index(want) - order.index(base_orient)) % 4
    pat = base
    for _ in range(steps):
        pat = _rot90(pat)
    return pat


def _load_levels() -> list[dict[str, Any]]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [json.loads(p.read_text(encoding="utf-8")) for p in paths]


@dataclass
class Stair:
    kind: StairKind
    orient: Orient


@dataclass
class Floor:
    walls: set[Cell] = field(default_factory=set)
    exit_cell: Cell | None = None
    stairs: dict[Cell, Stair] = field(default_factory=dict)


@dataclass
class LevelState:
    name: str
    floors: list[Floor]
    player: Cell = (0, 0)
    floor_z: int = 0
    start: Cell = (0, 0)
    max_actions: int = 99


def _parse_level(raw: dict[str, Any]) -> LevelState:
    floors_raw = raw["floors"]
    floors: list[Floor] = []
    start: Cell | None = None
    start_z = 0
    for z, rows in enumerate(floors_raw):
        if len(rows) != GRID:
            raise ValueError(f"floor {z}: expected {GRID} rows")
        fl = Floor()
        for r, line in enumerate(rows):
            if len(line) != GRID:
                raise ValueError(f"floor {z} row {r}: len {len(line)}")
            for c, ch in enumerate(line):
                pos = (r, c)
                if ch == "#":
                    fl.walls.add(pos)
                elif ch == "E":
                    fl.exit_cell = pos
                elif ch == "@":
                    start = pos
                    start_z = z
                elif ch in _UP_GLYPH:
                    fl.stairs[pos] = Stair("up", _UP_GLYPH[ch])  # type: ignore[arg-type]
                elif ch in _DOWN_GLYPH:
                    fl.stairs[pos] = Stair("down", _DOWN_GLYPH[ch])  # type: ignore[arg-type]
                elif ch in ". ":
                    pass
                else:
                    raise ValueError(f"unknown glyph {ch!r} at floor {z} {pos}")
        floors.append(fl)
    if start is None:
        raise ValueError("missing @ start")
    max_actions = int(raw.get("max_actions", 99))
    if max_actions <= 0:
        raise ValueError(f"{raw.get('name')}: max_actions must be positive")
    # Paired shaft: landing exit face must be opposite the entry face.
    for z, fl in enumerate(floors):
        for (r, c), st in fl.stairs.items():
            if st.kind != "up":
                continue
            if z + 1 >= len(floors):
                raise ValueError(f"up stair at top floor {z} {(r, c)}")
            peer = floors[z + 1].stairs.get((r, c))
            if peer is None or peer.kind != "down":
                raise ValueError(f"missing down pair for up {(z, r, c)}")
            # Opposite orientation: enter with key K, inverse of K returns to the
            # previous floor; leave forward via the arrival grey face (empty cell).
            if peer.orient != _OPP_ORIENT[st.orient]:
                raise ValueError(
                    f"shaft {(r, c)}: pair orient {peer.orient} must be opposite of {st.orient}"
                )
    return LevelState(
        name=str(raw.get("name", "level")),
        floors=floors,
        player=start,
        floor_z=start_z,
        start=start,
        max_actions=max_actions,
    )


class EtagFloorsEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_levels()
        if len(self._templates) < info.levels:
            raise ValueError(f"expected {info.levels} levels, found {len(self._templates)}")
        self.win_levels = int(info.levels)
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._budget_flash = False
        self._begin_level(0)

    def _begin_level(self, index: int) -> None:
        self._level = _parse_level(self._templates[index])
        self.level_steps = 0
        self._budget_flash = False
        # After a shaft transit: same key as entry returns; inverse key leaves.
        self._stair_entry_delta: tuple[int, int] | None = None

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
        if aid not in (ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT):
            return self.public_state()

        self.last_action = f"ACTION{aid}"
        self.step_index += 1
        self.level_steps += 1
        delta = {
            ACTION_UP: (-1, 0),
            ACTION_DOWN: (1, 0),
            ACTION_LEFT: (0, -1),
            ACTION_RIGHT: (0, 1),
        }[aid]
        self._try_move(*delta)
        frames = [self._render_frame()]
        if self._level_complete():
            frames.append(self._flash(C_GREEN))
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
                frames.append(self._render_frame())
            else:
                self._begin_level(self.levels_completed)
                frames.append(self._render_frame())
            self._pending_frames = frames
            return self.public_state()

        # Action budget exhausted → soft reset level (jauge à zéro).
        if self.level_steps >= self._level.max_actions:
            self._budget_flash = True
            frames.append(self._render_frame())
            self._budget_flash = False
            self._begin_level(self.levels_completed)
            frames.append(self._render_frame())
        self._pending_frames = frames
        return self.public_state()

    def _floor(self) -> Floor:
        return self._level.floors[self._level.floor_z]

    def _in_bounds(self, cell: Cell) -> bool:
        r, c = cell
        return 0 <= r < GRID and 0 <= c < GRID

    def _entry_neighbor(self, stair_cell: Cell, orient: Orient) -> Cell:
        r, c = stair_cell
        if orient == "N":
            return (r - 1, c)
        if orient == "E":
            return (r, c + 1)
        if orient == "S":
            return (r + 1, c)
        return (r, c - 1)

    def _try_move(self, dr: int, dc: int) -> bool:
        lv = self._level
        fl = self._floor()
        pr, pc = lv.player
        dest = (pr + dr, pc + dc)

        here = fl.stairs.get((pr, pc))
        # On shaft after transit: INVERSE of the entry key → previous floor.
        # (Enter ↓ → press ↑ to go back; enter → → press ← to go back.)
        if here is not None and self._stair_entry_delta is not None:
            rev = (-self._stair_entry_delta[0], -self._stair_entry_delta[1])
            if (dr, dc) == rev:
                nz = lv.floor_z - 1 if here.kind == "down" else lv.floor_z + 1
                if not (0 <= nz < len(lv.floors)):
                    return False
                if (pr, pc) in lv.floors[nz].walls or (pr, pc) not in lv.floors[nz].stairs:
                    return False
                lv.floor_z = nz
                lv.player = (pr, pc)
                self._stair_entry_delta = (dr, dc)
                return True

        if not self._in_bounds(dest) or dest in fl.walls:
            return False

        # Standing on a stair: leave forward only via grey face onto an empty cell.
        if here is not None:
            leave_cell = self._entry_neighbor((pr, pc), here.orient)
            if dest != leave_cell:
                return False
            if dest in fl.stairs:
                return False
            self._stair_entry_delta = None
            lv.player = dest
            return True

        stair = fl.stairs.get(dest)
        if stair is not None:
            # Enter only from the grey (3) face; other approaches are walls.
            required_from = self._entry_neighbor(dest, stair.orient)
            if (pr, pc) != required_from:
                return False
            nz = lv.floor_z + (1 if stair.kind == "up" else -1)
            if not (0 <= nz < len(lv.floors)):
                return False
            dest_floor = lv.floors[nz]
            if dest in dest_floor.walls:
                return False
            # Prefer a free grey exit on arrival; if blocked, still allow transit so
            # the inverse key can return to the previous floor (never hard-softlock).
            peer = dest_floor.stairs.get(dest)
            leave_orient = peer.orient if peer is not None else stair.orient
            leave = self._entry_neighbor(dest, leave_orient)
            if self._in_bounds(leave) and leave in dest_floor.walls:
                dest_floor.walls.discard(leave)
            lv.player = dest
            lv.floor_z = nz
            self._stair_entry_delta = (dr, dc)
            return True

        self._stair_entry_delta = None
        lv.player = dest
        return True

    def _level_complete(self) -> bool:
        return lv_player_on_exit(self._level)

    # --- render ---------------------------------------------------------------

    def _cell_origin(self, r: int, c: int) -> tuple[int, int]:
        y = MAP_Y0 + BORDER + r * (CELL + GAP)
        x = MAP_X0 + BORDER + c * (CELL + GAP)
        return y, x

    def _put(self, frame: list[list[int]], y: int, x: int, color: int) -> None:
        if 0 <= y < FRAME and 0 <= x < FRAME:
            frame[y][x] = color

    def _fill_rect(
        self, frame: list[list[int]], y0: int, x0: int, h: int, w: int, color: int
    ) -> None:
        for dy in range(h):
            for dx in range(w):
                self._put(frame, y0 + dy, x0 + dx, color)

    def _blit_pattern(self, frame: list[list[int]], r: int, c: int, pat: list[str]) -> None:
        """Blit 6×6 stair motif: covers the 4×4 cell plus the 1px gaps around it."""
        y0, x0 = self._cell_origin(r, c)
        # Pattern origin = one pixel before the cell (into the surrounding gap/border).
        oy, ox = -1, -1
        for pr, row in enumerate(pat):
            for pc, ch in enumerate(row):
                color = _MOTIF.get(ch)
                if color is None:
                    continue
                self._put(frame, y0 + oy + pr, x0 + ox + pc, color)

    def _render_frame(self) -> list[list[int]]:
        frame = [[C_BLACK for _ in range(FRAME)] for _ in range(FRAME)]
        lv = self._level
        fl = self._floor()

        # Orange border around the whole grid
        self._fill_rect(frame, MAP_Y0, MAP_X0, MAP, MAP, C_ORANGE)

        # Orange gap lattice + brown cells (inside the border)
        for r in range(GRID):
            for c in range(GRID):
                y0, x0 = self._cell_origin(r, c)
                self._fill_rect(frame, y0, x0, CELL, CELL, C_BROWN)
                if c < GRID - 1:
                    self._fill_rect(frame, y0, x0 + CELL, CELL, GAP, C_ORANGE)
                if r < GRID - 1:
                    self._fill_rect(frame, y0 + CELL, x0, GAP, CELL, C_ORANGE)
                if r < GRID - 1 and c < GRID - 1:
                    self._fill_rect(frame, y0 + CELL, x0 + CELL, GAP, GAP, C_ORANGE)

        # Walls
        for r, c in fl.walls:
            y0, x0 = self._cell_origin(r, c)
            self._fill_rect(frame, y0, x0, CELL, CELL, C_DGREY)

        # Stairs
        for (r, c), stair in fl.stairs.items():
            if stair.kind == "up":
                pat = _orient_pattern(_ASC_E, "E", stair.orient)
            else:
                pat = _orient_pattern(_DESC_W, "W", stair.orient)
            self._blit_pattern(frame, r, c, pat)

        # Exit (2×2 inset in 4×4 cell)
        if fl.exit_cell is not None:
            er, ec = fl.exit_cell
            y0, x0 = self._cell_origin(er, ec)
            self._fill_rect(frame, y0 + 1, x0 + 1, CELL - 2, CELL - 2, C_GREEN)

        # Player
        pr, pc = lv.player
        y0, x0 = self._cell_origin(pr, pc)
        self._fill_rect(frame, y0 + 1, x0 + 1, CELL - 2, CELL - 2, C_CYAN)

        self._draw_floor_indicator(frame)
        self._draw_hud(frame)
        return frame

    def _draw_floor_indicator(self, frame: list[list[int]]) -> None:
        """3px right rail: grey vertical tick per floor, white block on current.

        Floor 0 is at the bottom; higher floors stack upward (building metaphor).
        """
        lv = self._level
        n = max(1, len(lv.floors))
        x0 = FLOOR_RAIL_X0
        # Align the rail with the map height.
        y0 = MAP_Y0
        usable = MAP
        slot = max(1, usable // n)
        # Prefer small gaps between ticks when space allows.
        gap = 1 if slot >= 3 and n * (slot - 1) + (n - 1) <= usable else 0
        tick_h = slot - gap if gap else slot
        total = n * tick_h + (n - 1) * gap
        y_base = y0 + max(0, usable - total)
        cx = x0 + FLOOR_RAIL_W // 2  # center column of the 3px strip
        for z in range(n):
            # z=0 at bottom
            y = y_base + (n - 1 - z) * (tick_h + gap)
            # Grey vertical trait for every floor (1px wide, centered).
            self._fill_rect(frame, y, cx, tick_h, 1, C_MGREY)
            if z == lv.floor_z:
                # White block spanning the 3px margin at the current floor.
                self._fill_rect(frame, y, x0, tick_h, FLOOR_RAIL_W, C_WHITE)

    def _draw_hud(self, frame: list[list[int]]) -> None:
        for y in range(FRAME - 3, FRAME):
            for x in range(FRAME):
                if frame[y][x] == C_BLACK:
                    frame[y][x] = C_VDGREY
        # Action-resource gauge (tightens on later levels via max_actions).
        max_a = max(1, self._level.max_actions)
        rem = max(0, max_a - self.level_steps)
        gx, gy, gw, gh = 2, FRAME - 3, FRAME - 4, 1
        border = C_RED if self._budget_flash else C_LGREY
        self._fill_rect(frame, gy, gx, gh, gw, border)
        inner = gw
        filled = (rem * inner + max_a - 1) // max_a if rem else 0
        # Background empty = dark grey; remaining = cyan (yellow when low).
        self._fill_rect(frame, gy, gx, gh, inner, C_DGREY)
        if filled:
            fill_c = C_YELLOW if rem * 4 <= max_a else C_CYAN
            if self._budget_flash:
                fill_c = C_RED
            self._fill_rect(frame, gy, gx, gh, filled, fill_c)
        # Level completion pips
        pip_y = FRAME - 1
        total = self.win_levels
        width = total * 2 + (total - 1)
        x0 = max(1, (FRAME - width) // 2)
        for i in range(total):
            fill = C_DGREY
            if i < self.levels_completed or self.state == "WIN":
                fill = C_GREEN
            elif i == self.levels_completed:
                fill = C_CYAN
            x = x0 + i * 3
            for dx in range(2):
                self._put(frame, pip_y, x + dx, fill)

    def _flash(self, color: int) -> list[list[int]]:
        frame = self._render_frame()
        for y in range(FRAME):
            for x in range(FRAME):
                if frame[y][x] == C_BLACK:
                    frame[y][x] = color
        return frame

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
            else ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION7"]
        )
        lv = self._level
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frames[-1],
            "frames": frames,
            "frame_count": len(frames),
            "transition_frame_interval_ms": 80 if len(frames) > 1 else None,
            "default_fps": max(self.info.default_fps, 8),
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
            "floor": lv.floor_z,
            "floors": len(lv.floors),
            "player": list(lv.player),
            "grid": GRID,
            "cell": CELL,
            "gap": GAP,
            "border": BORDER,
            "max_actions": lv.max_actions,
            "level_steps": self.level_steps,
            "actions_remaining": max(0, lv.max_actions - self.level_steps),
        }

    def move(self, action_id: int) -> dict[str, Any]:
        return self.action(action_id)


def lv_player_on_exit(level: LevelState) -> bool:
    fl = level.floors[level.floor_z]
    return fl.exit_cell is not None and level.player == fl.exit_cell
