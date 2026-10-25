"""AS66 — Always Sliding: wrap-slide cursors into U-slots (custom wave 2)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

C_WHITE, C_LGREY, C_MGREY, C_DGREY, C_VDGREY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_PINK, C_RED, C_BLUE, C_CYAN = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_BROWN, C_GREEN, C_PURPLE = 11, 12, 13, 14, 15

FRAME, PLAY_H = 64, 56
# Usable map rect: below level pips, above bottom HUD, with 1px wrap-border.
PIP_H = 4
BORDER = 1

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_RESET = 7

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "always_sliding" / "levels"

COLOR_NAME = {
    "magenta": C_MAGENTA,
    "pink": C_PINK,
    "red": C_RED,
    "cyan": C_CYAN,
    "blue": C_BLUE,
    "yellow": C_YELLOW,
    "green": C_GREEN,
    "white": C_WHITE,
    "any": C_GREEN,
}
# ASCII glyph on a U arm → paint colour (W stays white).
ARM_GLYPH_COLOR = {
    "W": "white",
    "Y": "yellow",
    "C": "cyan",
    "B": "blue",
    "P": "magenta",
    "O": "red",
    "R": "red",
}
DIR_DELTA = {
    ACTION_UP: (-1, 0),
    ACTION_DOWN: (1, 0),
    ACTION_LEFT: (0, -1),
    ACTION_RIGHT: (0, 1),
}
DIR_NAME = {ACTION_UP: "up", ACTION_DOWN: "down", ACTION_LEFT: "left", ACTION_RIGHT: "right"}


def _fit_cell(height: int, width: int) -> tuple[int, int, int]:
    """Largest CELL that fits the FULL grid (no crop), then center it."""
    # Interior for cells only (wrap border drawn around it).
    max_h = PLAY_H - PIP_H - 2 * BORDER - 1  # ~49
    max_w = FRAME - 2 * BORDER - 2  # ~60
    if height < 1 or width < 1:
        return 1, PIP_H + BORDER, BORDER + 1
    cell = min(max_h // height, max_w // width, 4)
    cell = max(1, int(cell))
    map_h, map_w = height * cell, width * cell
    # Assert no crop.
    assert map_h <= max_h and map_w <= max_w, f"grid {width}x{height} cell={cell} overflows"
    y_avail0 = PIP_H + BORDER
    y_avail1 = PLAY_H - BORDER - 1
    x_avail0 = BORDER + 1
    x_avail1 = FRAME - BORDER - 2
    y0 = y_avail0 + max(0, (y_avail1 - y_avail0 + 1 - map_h) // 2)
    x0 = x_avail0 + max(0, (x_avail1 - x_avail0 + 1 - map_w) // 2)
    return cell, y0, x0


def _fill(frame: list[list[int]], y: int, x: int, h: int, w: int, color: int) -> None:
    for yy in range(max(0, y), min(FRAME, y + h)):
        row = frame[yy]
        for xx in range(max(0, x), min(FRAME, x + w)):
            row[xx] = color


def _border(frame: list[list[int]], y: int, x: int, h: int, w: int, color: int) -> None:
    for xx in range(x, x + w):
        if 0 <= y < FRAME and 0 <= xx < FRAME:
            frame[y][xx] = color
        if 0 <= y + h - 1 < FRAME and 0 <= xx < FRAME:
            frame[y + h - 1][xx] = color
    for yy in range(y, y + h):
        if 0 <= yy < FRAME and 0 <= x < FRAME:
            frame[yy][x] = color
        if 0 <= yy < FRAME and 0 <= x + w - 1 < FRAME:
            frame[yy][x + w - 1] = color


def _slot_arm_cells(pos: tuple[int, int], opening: str) -> list[tuple[int, int]]:
    """U-slot arms around open cell `pos`. Opening is the mouth direction."""
    r, c = pos
    if opening == "up":
        return [(r, c - 1), (r, c + 1), (r + 1, c - 1), (r + 1, c), (r + 1, c + 1)]
    if opening == "down":
        return [(r, c - 1), (r, c + 1), (r - 1, c - 1), (r - 1, c), (r - 1, c + 1)]
    if opening == "left":
        return [(r - 1, c), (r + 1, c), (r - 1, c + 1), (r, c + 1), (r + 1, c + 1)]
    if opening == "right":
        return [(r - 1, c), (r + 1, c), (r - 1, c - 1), (r, c - 1), (r + 1, c - 1)]
    return [(r, c - 1), (r, c + 1), (r + 1, c - 1), (r + 1, c), (r + 1, c + 1)]


def _load_levels() -> list[dict[str, Any]]:
    levels = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(LEVELS_DIR.glob("L*.json"))]
    if len(levels) != 9:
        raise ValueError(f"AS66 requires exactly nine levels, found {len(levels)}")
    for i, level in enumerate(levels):
        for key in ("cursors", "slots", "width", "height"):
            if key not in level:
                raise ValueError(f"AS66 L{i+1} missing {key}")
        if not level["cursors"] or not level["slots"]:
            raise ValueError(f"AS66 L{i+1} needs cursors and slots")
    return levels


class AlwaysSlidingEngine:
    """Slide all cursors until blocked; wrap at edges; seat them in U-slots."""

    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_levels()
        self.win_levels = int(info.levels)
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._edge_flash: str | None = None  # up/down/left/right
        self._begin_level(0)

    def reset(self) -> dict[str, Any]:
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._pending_frames = None
        self._begin_level(0)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self._begin_level(min(self.levels_completed, self.win_levels - 1))
        self.last_action, self._pending_frames = "ACTION7", None
        return self.public_state()

    def _begin_level(self, index: int) -> None:
        raw = self._templates[index]
        self._level = raw
        self.level_steps = 0
        self._height = int(raw["height"])
        self._width = int(raw["width"])
        self._cell, self._map_y0, self._map_x0 = _fit_cell(self._height, self._width)
        self._color_match = bool(raw.get("color_match", False))
        self._walls = {tuple(map(int, c)) for c in raw.get("walls", [])}
        # ASCII: # black, O orange block, R red block (non-enemy remnants).
        self._orange_walls = {tuple(map(int, c)) for c in raw.get("orange_walls", [])}
        self._red_walls = {tuple(map(int, c)) for c in raw.get("red_walls", [])}
        self._ascii = [str(row) for row in raw.get("ascii", [])]
        self._paints = {
            tuple(map(int, p["pos"])): str(p["color"]) for p in raw.get("paints", [])
        }
        self._slots: list[dict[str, Any]] = []
        # arm cell → visual colour from ASCII (W white, C/P/B/Y keep their colour).
        self._slot_walls: dict[tuple[int, int], str] = {}
        for s in raw["slots"]:
            pos = tuple(map(int, s["pos"]))
            color = str(s.get("color", "any"))
            opening = str(s.get("opening", "up"))
            self._slots.append({"pos": pos, "color": color, "opening": opening})
            for arm in _slot_arm_cells(pos, opening):
                if not self._in_bounds(*arm) or arm in self._walls:
                    continue
                glyph = self._ascii_glyph(*arm)
                arm_col = ARM_GLYPH_COLOR.get(glyph, color if color != "any" else "white")
                self._slot_walls[arm] = arm_col
        # Coloured U-arm glyphs are part of the receptacle, not walkable paints.
        for arm in list(self._slot_walls):
            self._paints.pop(arm, None)
        self._cursors = [
            {
                "pos": tuple(map(int, c["pos"])),
                "color": str(c.get("color", "magenta")),
            }
            for c in raw["cursors"]
        ]
        # Paint under spawn recolours immediately (WBW clusters).
        for cur in self._cursors:
            if cur["pos"] in self._paints:
                cur["color"] = self._paints[cur["pos"]]
        self._enemies: list[dict[str, Any]] = []
        for e in raw.get("enemies", []):
            d = e.get("dir", [0, 0])
            cells = e.get("cells")
            if cells:
                body = {tuple(map(int, p)) for p in cells}
            else:
                body = {tuple(map(int, e["pos"]))}
            self._enemies.append(
                {
                    "pos": tuple(map(int, e["pos"])),
                    "dir": (int(d[0]), int(d[1])),
                    "moving": bool(e.get("moving", False)),
                    "cells": body,
                }
            )
        self._edge_flash = None

    def _in_bounds(self, r: int, c: int) -> bool:
        return 0 <= r < self._height and 0 <= c < self._width

    def _wrap(self, r: int, c: int) -> tuple[int, int]:
        return r % self._height, c % self._width

    def _enemy_cells(self) -> set[tuple[int, int]]:
        cells: set[tuple[int, int]] = set()
        for e in self._enemies:
            body = e.get("cells")
            if body:
                cells |= set(body)
            else:
                cells.add(e["pos"])
        return cells

    def _cursor_cells(self) -> set[tuple[int, int]]:
        return {c["pos"] for c in self._cursors}

    def _blocked_for_cursor(self, cell: tuple[int, int], moving: dict[str, Any]) -> bool:
        # Enemies are NOT solid walls: sliding past/onto them is allowed;
        # same-cell contact after the move triggers blink+reset separately.
        if cell in self._walls or cell in self._slot_walls:
            return True
        for other in self._cursors:
            if other is not moving and other["pos"] == cell:
                return True
        return False

    def _blocked_for_enemy(self, cell: tuple[int, int], moving: dict[str, Any]) -> bool:
        # Cursors are not solid to enemies — stepping onto a cursor is a collision.
        if not self._in_bounds(*cell):
            return True
        if cell in self._walls or cell in self._slot_walls:
            return True
        for other in self._enemies:
            if other is moving:
                continue
            body = other.get("cells") or {other["pos"]}
            if cell in body:
                return True
        return False

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        if self.state == "WIN":
            return self.public_state()
        if aid in DIR_DELTA:
            return self._act_slide(aid)
        return self.public_state()

    def _act_slide(self, aid: int) -> dict[str, Any]:
        self.last_action = f"ACTION{aid}"
        self.step_index += 1
        self.level_steps += 1
        self._edge_flash = DIR_NAME[aid]
        dr, dc = DIR_DELTA[aid]
        frames = [self._render_frame()]

        # Monsters move first (one cell), then cursors slide — required for L6.
        self._step_enemies()
        frames.append(self._render_frame())
        if self._enemy_cells() & self._cursor_cells():
            self._flash_bad(frames)
            self._begin_level(self.levels_completed)
            frames.append(self._render_frame())
            self._pending_frames = frames
            return self.public_state()

        # Per-cursor trail: stop a cursor that would loop forever via wrap.
        trails: list[set[tuple[int, int]]] = [{c["pos"]} for c in self._cursors]
        # Slide cell-by-cell until every cursor is blocked.
        for _ in range(self._height * self._width + 2):
            moved_any = False
            for i, cur in enumerate(self._cursors):
                r, c = cur["pos"]
                nr, nc = r + dr, c + dc
                if not self._in_bounds(nr, nc):
                    nr, nc = self._wrap(nr, nc)
                if self._blocked_for_cursor((nr, nc), cur):
                    continue
                if (nr, nc) in trails[i]:
                    continue  # wrap cycle — treat as settled
                cur["pos"] = (nr, nc)
                trails[i].add((nr, nc))
                if cur["pos"] in self._paints:
                    cur["color"] = self._paints[cur["pos"]]
                moved_any = True
            if not moved_any:
                break
            frames.append(self._render_frame())
            # Contact mid-slide (cursor ran into enemy) → soft reset.
            if self._enemy_cells() & self._cursor_cells():
                self._flash_bad(frames)
                self._begin_level(self.levels_completed)
                frames.append(self._render_frame())
                self._pending_frames = frames
                return self.public_state()

        # Settled frame keeps edge flash.
        frames.append(self._render_frame())

        if self._is_solved():
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
                frames.append(self._render_frame(win=True))
            else:
                self._begin_level(self.levels_completed)
                frames.append(self._render_frame())
        self._pending_frames = frames
        return self.public_state()

    def _brown_on_facing_edge(
        self, body: set[tuple[int, int]], direction: tuple[int, int]
    ) -> tuple[int, int]:
        """Place the brown marker on the body edge/corner facing `direction`."""
        dr, dc = direction
        rs = [r for r, _ in body]
        cs = [c for _, c in body]
        target_r = max(rs) if dr > 0 else (min(rs) if dr < 0 else None)
        target_c = max(cs) if dc > 0 else (min(cs) if dc < 0 else None)
        if target_r is not None and target_c is not None:
            corner = (target_r, target_c)
            if corner in body:
                return corner
            return min(body, key=lambda p: abs(p[0] - target_r) + abs(p[1] - target_c))
        if target_r is not None:
            edge = sorted(c for r, c in body if r == target_r)
            return (target_r, edge[len(edge) // 2])
        if target_c is not None:
            edge = sorted(r for r, c in body if c == target_c)
            return (edge[len(edge) // 2], target_c)
        return next(iter(body))

    def _step_enemies(self) -> None:
        for e in self._enemies:
            if not e["moving"]:
                continue
            dr, dc = e["dir"]
            if dr == 0 and dc == 0:
                continue

            def try_shift(ddr: int, ddc: int) -> bool:
                body = set(e.get("cells") or {e["pos"]})
                shifted = {(r + ddr, c + ddc) for r, c in body}
                for cell in shifted:
                    if cell in body:
                        continue
                    if self._blocked_for_enemy(cell, e):
                        return False
                e["cells"] = shifted
                e["pos"] = (e["pos"][0] + ddr, e["pos"][1] + ddc)
                return True

            if not try_shift(dr, dc):
                # Reverse patrol direction and flip brown marker to the opposite side.
                e["dir"] = (-dr, -dc)
                body = set(e.get("cells") or {e["pos"]})
                e["pos"] = self._brown_on_facing_edge(body, e["dir"])
                try_shift(e["dir"][0], e["dir"][1])

    def _is_solved(self) -> bool:
        used: set[int] = set()
        for cur in self._cursors:
            matched = False
            for i, slot in enumerate(self._slots):
                if i in used:
                    continue
                if cur["pos"] != slot["pos"]:
                    continue
                if self._color_match:
                    sc = slot["color"]
                    # white/green/any = untyped seat; otherwise require paint match.
                    if sc not in ("any", "white", "green") and sc != cur["color"]:
                        continue
                used.add(i)
                matched = True
                break
            if not matched:
                return False
        return True

    def _flash_bad(self, frames: list[list[list[int]]]) -> None:
        """Red blink on contact with a monster, then caller resets the level."""
        self._edge_flash = None
        cell = self._cell
        for _ in range(2):
            bad = self._render_frame()
            _border(
                bad,
                self._map_y0 - 1,
                self._map_x0 - 1,
                self._height * cell + 2,
                self._width * cell + 2,
                C_RED,
            )
            frames.append(bad)
            frames.append(self._render_frame())

    def _cell_origin(self, r: int, c: int) -> tuple[int, int]:
        return self._map_y0 + r * self._cell, self._map_x0 + c * self._cell

    def _draw_cursor(self, frame: list[list[int]], cur: dict[str, Any]) -> None:
        """Solid filled cell — never a C/U outline (receptacle owns the U shape)."""
        y, x = self._cell_origin(*cur["pos"])
        cell = self._cell
        col = COLOR_NAME.get(cur["color"], C_MAGENTA)
        if cur["color"] == "red":
            col = C_RED
        _fill(frame, y, x, cell, cell, col)
        seated = any(cur["pos"] == s["pos"] for s in self._slots)
        if seated and cell >= 3:
            frame[y + 1][x + 1] = C_WHITE

    def _ascii_glyph(self, r: int, c: int) -> str:
        if 0 <= r < len(self._ascii) and 0 <= c < len(self._ascii[r]):
            return self._ascii[r][c]
        return "."

    def _draw_slot(self, frame: list[list[int]], slot: dict[str, Any]) -> None:
        """Draw U arms from ASCII: W → white, C/P/B/Y on the U keep their colour."""
        cell = self._cell
        for arm in _slot_arm_cells(slot["pos"], slot["opening"]):
            if not self._in_bounds(*arm) or arm in self._walls:
                continue
            arm_col = self._slot_walls.get(arm, "white")
            col = COLOR_NAME.get(arm_col, C_WHITE)
            y, x = self._cell_origin(*arm)
            _fill(frame, y, x, cell, cell, col)

    def _draw_paint(self, frame: list[list[int]], pos: tuple[int, int], color: str) -> None:
        # Full solid cell so adjacent paints (e.g. L6 BBB) form one continuous bar.
        y, x = self._cell_origin(*pos)
        col = COLOR_NAME.get(color, C_CYAN)
        _fill(frame, y, x, self._cell, self._cell, col)

    def _draw_enemy(self, frame: list[list[int]], e: dict[str, Any]) -> None:
        cell = self._cell
        body = e.get("cells") or {e["pos"]}
        # Orange body; brown marker at `pos` (ASCII R). Middle brown = immobile.
        for r, c in body:
            y, x = self._cell_origin(r, c)
            col = C_BROWN if (r, c) == e["pos"] else C_ORANGE
            _fill(frame, y, x, cell, cell, col)

    def _render_frame(self, *, win: bool = False) -> list[list[int]]:
        frame = [[C_BLACK for _ in range(FRAME)] for _ in range(FRAME)]
        _border(frame, 0, 0, PLAY_H, FRAME, C_CYAN)

        # Level pips (9) — top strip, never overlaps the map.
        for i in range(self.win_levels):
            if i < self.levels_completed:
                color = C_GREEN
            elif i == self.levels_completed and self.state != "WIN":
                color = C_CYAN
            else:
                color = C_DGREY
            _fill(frame, 1, 3 + i * 3, 2, 2, color)

        cell, y0, x0 = self._cell, self._map_y0, self._map_x0
        map_h, map_w = self._height * cell, self._width * cell
        # Full purple floor — every ASCII cell is inside this rect (no crop).
        _fill(frame, y0, x0, map_h, map_w, C_PURPLE)

        # Wrap border around the FULL map.
        top = bottom = left = right = C_LGREY
        if self._edge_flash == "up":
            top = C_GREEN
        elif self._edge_flash == "down":
            bottom = C_GREEN
        elif self._edge_flash == "left":
            left = C_GREEN
        elif self._edge_flash == "right":
            right = C_GREEN
        for xx in range(x0 - 1, x0 + map_w + 1):
            if 0 <= y0 - 1 < FRAME and 0 <= xx < FRAME:
                frame[y0 - 1][xx] = top
            if 0 <= y0 + map_h < FRAME and 0 <= xx < FRAME:
                frame[y0 + map_h][xx] = bottom
        for yy in range(y0 - 1, y0 + map_h + 1):
            if 0 <= yy < FRAME and 0 <= x0 - 1 < FRAME:
                frame[yy][x0 - 1] = left
            if 0 <= yy < FRAME and 0 <= x0 + map_w < FRAME:
                frame[yy][x0 + map_w] = right

        # ASCII walls: # black, O orange, R red.
        for r, c in self._walls:
            y, x = self._cell_origin(r, c)
            if (r, c) in self._red_walls:
                col = C_RED
            elif (r, c) in self._orange_walls:
                col = C_ORANGE
            else:
                col = C_BLACK
            _fill(frame, y, x, cell, cell, col)

        for slot in self._slots:
            self._draw_slot(frame, slot)

        for pos, color in self._paints.items():
            self._draw_paint(frame, pos, color)

        for e in self._enemies:
            self._draw_enemy(frame, e)

        for cur in self._cursors:
            self._draw_cursor(frame, cur)

        if win:
            _border(frame, 0, 0, FRAME, FRAME, C_GREEN)

        _fill(frame, PLAY_H, 0, FRAME - PLAY_H, FRAME, C_BLACK)
        for i in range(self.win_levels):
            color = C_GREEN if i < self.levels_completed else (
                C_CYAN if i == self.levels_completed and self.state != "WIN" else C_DGREY
            )
            _fill(frame, 58, 3 + i * 3, 2, 2, color)
        return frame

    def public_state(self) -> dict[str, Any]:
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
        else:
            frames = [self._render_frame()]
        available = ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION7"]
        if self.state == "WIN":
            available = ["ACTION7"]
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frames[-1],
            "frames": frames,
            "frame_count": len(frames),
            "default_fps": max(int(self.info.default_fps), 12 if len(frames) > 2 else int(self.info.default_fps)),
            "state": self.state,
            "available_actions": available,
            "available_action_ids": [int(a.removeprefix("ACTION")) for a in available],
            "levels_completed": self.levels_completed,
            "win_levels": self.win_levels,
            "level_index": min(self.levels_completed, self.win_levels - 1),
            "level_name": str(self._level.get("name", "")),
            "step_index": self.step_index,
            "level_steps": self.level_steps,
            "last_action": self.last_action,
            "actions_remaining": None,
            "guid": f"{self.info.game_id}:L{self.levels_completed + 1}:{self.step_index}",
            "cursors": [{"pos": list(c["pos"]), "color": c["color"]} for c in self._cursors],
            "slots": [{"pos": list(s["pos"]), "color": s["color"]} for s in self._slots],
            "enemies": [{"pos": list(e["pos"]), "moving": e["moving"]} for e in self._enemies],
            "edge_flash": self._edge_flash,
        }
