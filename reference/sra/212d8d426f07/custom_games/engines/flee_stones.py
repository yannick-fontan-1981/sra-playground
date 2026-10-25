"""FUIT — Fuite sous pierres (chase + push/pull stones + walls).

Controls:
  ACTION1-4  — move hunter; walk-into pushes a free stone; drag if attached
  ACTION5    — attach adjacent stone / detach
  ACTION7    — soft reset

After each successful hunter action, every remaining fleer takes one flee step.

Fleers:
  F — solid (magenta): hunter stepping on it captures; fleer cannot enter hunter
  G — swap (yellow): hunter stepping on it SWAPS positions, unless the hunter's
      previous cell becomes occupied by a dragged stone — then CAPTURE instead.
      Same swap rule if the yellow fleer steps onto the hunter.
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

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE, ACTION_RESET = 5, 7

FRAME = 64
PLAY_H = FRAME - 4
GRID = 12
CELL = 5
MAP = GRID * CELL
MAP_X0 = (FRAME - MAP) // 2
MAP_Y0 = 1

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "flee_stones" / "levels"

Cell = tuple[int, int]
FleerKind = Literal["solid", "swap"]

_FLEE_DIRS: tuple[Cell, ...] = ((-1, 0), (0, 1), (1, 0), (0, -1))


def _load_levels() -> list[dict[str, Any]]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [json.loads(p.read_text(encoding="utf-8")) for p in paths]


@dataclass
class Fleer:
    cell: Cell
    kind: FleerKind = "solid"


@dataclass
class LevelState:
    name: str
    walls: set[Cell] = field(default_factory=set)
    traps: set[Cell] = field(default_factory=set)
    stones: set[Cell] = field(default_factory=set)
    player: Cell = (1, 1)
    fleers: list[Fleer] = field(default_factory=list)
    attached_offset: Cell | None = None


def _parse_level(raw: dict[str, Any]) -> LevelState:
    rows = list(raw["ascii"])
    if len(rows) != GRID:
        raise ValueError(f"expected {GRID} rows, got {len(rows)}")
    walls: set[Cell] = set()
    traps: set[Cell] = set()
    stones: set[Cell] = set()
    player: Cell | None = None
    fleers: list[Fleer] = []
    for r, line in enumerate(rows):
        if len(line) != GRID:
            raise ValueError(f"row {r} len {len(line)} != {GRID}: {line!r}")
        for c, ch in enumerate(line):
            pos = (r, c)
            if ch == "#":
                walls.add(pos)
            elif ch == "@":
                player = pos
            elif ch == "F":
                fleers.append(Fleer(pos, "solid"))
            elif ch == "G":
                fleers.append(Fleer(pos, "swap"))
            elif ch == "O":
                stones.add(pos)
            elif ch == "X":
                traps.add(pos)
            elif ch in ". ":
                pass
            else:
                raise ValueError(f"unknown glyph {ch!r} at {pos}")
    if player is None or not fleers:
        raise ValueError("missing @ or fleer")
    return LevelState(
        name=str(raw.get("name", "level")),
        walls=walls,
        traps=traps,
        stones=stones,
        player=player,
        fleers=fleers,
        attached_offset=None,
    )


def _manhattan(a: Cell, b: Cell) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


class FleeStonesEngine:
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
        self._level = _parse_level(self._templates[0])

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames = None
        self._level = _parse_level(self._templates[0])
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self.last_action = "ACTION7"
        self._pending_frames = None
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = _parse_level(self._templates[idx])
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        _ = data
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()

        self.last_action = f"ACTION{aid}"
        self.step_index += 1
        frames: list[list[list[int]]] = []
        acted = False

        if aid in (ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT):
            delta = {
                ACTION_UP: (-1, 0),
                ACTION_DOWN: (1, 0),
                ACTION_LEFT: (0, -1),
                ACTION_RIGHT: (0, 1),
            }[aid]
            acted = self._try_move(delta[0], delta[1])
        elif aid == ACTION_SPACE:
            acted = self._try_space()
        else:
            return self.public_state()

        if acted:
            # Hunter + fleers resolve in one step (no 2-frame slide).
            if not self._level_complete():
                self._flee_all()
            frames.append(self._render_frame())
            if self._level_complete():
                frames.extend(self._advance_after_capture())
        else:
            frames.append(self._render_frame())

        self._pending_frames = frames
        return self.public_state()

    def _advance_after_capture(self) -> list[list[list[int]]]:
        frames = [self._flash(C_GREEN)]
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            frames.append(self._render_frame())
        else:
            self._level = _parse_level(self._templates[self.levels_completed])
            frames.append(self._render_frame())
        return frames

    def _in_bounds(self, cell: Cell) -> bool:
        r, c = cell
        return 0 <= r < GRID and 0 <= c < GRID

    def _attached_abs(self) -> Cell | None:
        lv = self._level
        if lv.attached_offset is None:
            return None
        pr, pc = lv.player
        dr, dc = lv.attached_offset
        return (pr + dr, pc + dc)

    def _free_stones(self) -> set[Cell]:
        lv = self._level
        attached = self._attached_abs()
        if attached is None:
            return set(lv.stones)
        return {s for s in lv.stones if s != attached}

    def _fleer_cells(self) -> set[Cell]:
        return {f.cell for f in self._level.fleers}

    def _blocked(
        self,
        cell: Cell,
        *,
        ignore_stones: set[Cell] | None = None,
        ignore_fleers: bool = False,
    ) -> bool:
        if not self._in_bounds(cell) or cell in self._level.walls:
            return True
        ignore_stones = ignore_stones or set()
        if cell in self._free_stones() and cell not in ignore_stones:
            return True
        if not ignore_fleers and cell in self._fleer_cells():
            return True
        return False

    def _fleer_at(self, cell: Cell) -> Fleer | None:
        for f in self._level.fleers:
            if f.cell == cell:
                return f
        return None

    def _remove_fleer(self, fleer: Fleer) -> None:
        self._level.fleers = [f for f in self._level.fleers if f is not fleer]

    def _try_move(self, dr: int, dc: int) -> bool:
        lv = self._level
        pr, pc = lv.player
        dest = (pr + dr, pc + dc)
        if not self._in_bounds(dest) or dest in lv.walls:
            return False

        old_player = lv.player
        fleer_hit = self._fleer_at(dest)

        if lv.attached_offset is not None:
            odr, odc = lv.attached_offset
            old_stone = (pr + odr, pc + odc)
            new_stone = (dest[0] + odr, dest[1] + odc)
            if dest in lv.walls or not self._in_bounds(dest):
                return False
            if dest in self._free_stones() and dest != old_stone:
                return False
            if new_stone in lv.walls or not self._in_bounds(new_stone):
                return False
            if new_stone in self._free_stones() and new_stone != old_stone:
                return False
            if self._fleer_at(new_stone) is not None:
                return False

            if fleer_hit is not None:
                if not self._resolve_hunter_onto_fleer(fleer_hit, old_player, dest, new_stone):
                    return False
                lv.stones.discard(old_stone)
                cur = lv.player
                placed = (cur[0] + odr, cur[1] + odc)
                if (
                    placed in lv.walls
                    or not self._in_bounds(placed)
                    or placed in self._fleer_cells()
                ):
                    lv.attached_offset = None
                    if self._in_bounds(old_stone) and old_stone not in lv.walls:
                        lv.stones.add(old_stone)
                else:
                    lv.stones.add(placed)
                return True

            lv.stones.discard(old_stone)
            lv.stones.add(new_stone)
            lv.player = dest
            return True

        # Not attached: push stone by walking into it
        if dest in lv.stones:
            behind = (dest[0] + dr, dest[1] + dc)
            if self._blocked(behind, ignore_fleers=False):
                return False
            if behind == old_player:
                return False
            lv.stones.remove(dest)
            lv.stones.add(behind)
            lv.player = dest
            return True

        if fleer_hit is not None:
            return self._resolve_hunter_onto_fleer(fleer_hit, old_player, dest, None)

        lv.player = dest
        return True

    def _resolve_hunter_onto_fleer(
        self,
        fleer: Fleer,
        old_player: Cell,
        dest: Cell,
        new_stone: Cell | None,
    ) -> bool:
        """Hunter moves onto fleer cell. Solid→capture. Yellow→swap unless stone takes old_player."""
        lv = self._level
        if fleer.kind == "solid":
            lv.player = dest
            self._remove_fleer(fleer)
            return True

        # Yellow swap fleer
        stone_blocks_swap = new_stone is not None and new_stone == old_player
        if stone_blocks_swap:
            # Old hunter cell becomes the dragged stone → cannot swap → capture
            lv.player = dest
            self._remove_fleer(fleer)
            return True

        # Swap: hunter ← fleer cell, fleer ← hunter old cell
        if old_player in lv.walls:
            return False
        if old_player in self._free_stones():
            return False
        other = self._fleer_at(old_player)
        if other is not None and other is not fleer:
            return False
        lv.player = dest
        fleer.cell = old_player
        return True

    def _try_space(self) -> bool:
        lv = self._level
        pr, pc = lv.player
        if lv.attached_offset is not None:
            abs_stone = self._attached_abs()
            assert abs_stone is not None
            if abs_stone in lv.walls or abs_stone in self._fleer_cells() or abs_stone == lv.player:
                return False
            lv.attached_offset = None
            return True

        adj = ((pr - 1, pc), (pr + 1, pc), (pr, pc - 1), (pr, pc + 1))
        for cell in adj:
            if cell in lv.stones:
                lv.attached_offset = (cell[0] - pr, cell[1] - pc)
                return True
        return False

    def _flee_all(self) -> None:
        # Move each fleer once; order = stable list order
        for fleer in list(self._level.fleers):
            if fleer not in self._level.fleers:
                continue
            self._flee_one(fleer)

    def _flee_one(self, fleer: Fleer) -> None:
        lv = self._level
        fr, fc = fleer.cell
        hunter = lv.player
        best_dist = -1
        ranked: list[Cell] = []
        occupied = self._fleer_cells() - {fleer.cell}
        for dr, dc in _FLEE_DIRS:
            cand = (fr + dr, fc + dc)
            if not self._in_bounds(cand) or cand in lv.walls:
                continue
            if cand in self._free_stones():
                continue
            attached = self._attached_abs()
            if attached is not None and cand == attached:
                continue
            if cand in occupied:
                continue
            if cand == hunter and fleer.kind == "solid":
                continue
            dist = _manhattan(cand, hunter)
            if dist > best_dist:
                best_dist = dist
                ranked = [cand]
            elif dist == best_dist:
                ranked.append(cand)
        # Wait if boxed in, or if every legal step would get closer.
        stay_dist = _manhattan((fr, fc), hunter)
        if not ranked or best_dist < stay_dist:
            return
        non_trap = [c for c in ranked if c not in lv.traps]
        chosen = non_trap[0] if non_trap else ranked[0]

        if chosen == hunter and fleer.kind == "swap":
            # Fleer steps onto hunter → swap, unless dragged stone occupies fleer's old cell
            old_fleer = fleer.cell
            attached = self._attached_abs()
            # After swap hunter goes to old_fleer; stone stays relative to hunter
            if attached is not None:
                # stone would move with hunter to old_fleer+offset — check if old_fleer blocked
                # Exception rule: if old hunter cell... here fleer initiates.
                # User rule is about cursor going toward fleer. For fleer→hunter,
                # swap unless stone ends on fleer's old cell after hunter moves to old_fleer.
                odr = lv.attached_offset
                assert odr is not None
                new_stone = (old_fleer[0] + odr[0], old_fleer[1] + odr[1])
                if new_stone == hunter:
                    # stone would land on current hunter cell (= fleer destination) — capture fleer
                    self._remove_fleer(fleer)
                    return
            fleer.cell, lv.player = hunter, old_fleer
            if lv.attached_offset is not None:
                old_abs = attached
                new_abs = (
                    lv.player[0] + lv.attached_offset[0],
                    lv.player[1] + lv.attached_offset[1],
                )
                if old_abs is not None:
                    lv.stones.discard(old_abs)
                if (
                    self._in_bounds(new_abs)
                    and new_abs not in lv.walls
                    and new_abs not in self._fleer_cells()
                ):
                    lv.stones.add(new_abs)
                else:
                    lv.attached_offset = None
                    if old_abs is not None and self._in_bounds(old_abs) and old_abs not in lv.walls:
                        lv.stones.add(old_abs)
            return

        fleer.cell = chosen

    def _level_complete(self) -> bool:
        return len(self._level.fleers) == 0

    def _check_capture(self) -> bool:
        # Kept for tests; win = no fleers left
        return self._level_complete()

    # --- render ---------------------------------------------------------------

    def _blit(self, frame: list[list[int]], row: int, col: int, color: int, inset: int = 0) -> None:
        y0 = MAP_Y0 + row * CELL + inset
        x0 = MAP_X0 + col * CELL + inset
        size = CELL - 2 * inset
        for dy in range(size):
            for dx in range(size):
                yy, xx = y0 + dy, x0 + dx
                if 0 <= yy < PLAY_H and 0 <= xx < FRAME:
                    frame[yy][xx] = color

    def _render_frame(self) -> list[list[int]]:
        frame = [[C_BLACK for _ in range(FRAME)] for _ in range(FRAME)]
        lv = self._level
        attached = self._attached_abs()
        for r in range(GRID):
            for c in range(GRID):
                pos = (r, c)
                if pos in lv.walls:
                    self._blit(frame, r, c, C_DGREY)
                elif pos in lv.traps:
                    self._blit(frame, r, c, C_PURPLE)
                else:
                    self._blit(frame, r, c, C_VDGREY)
        for pos in lv.stones:
            if pos == attached:
                self._blit(frame, pos[0], pos[1], C_WHITE, inset=0)
                self._blit(frame, pos[0], pos[1], C_LGREY, inset=1)
            else:
                self._blit(frame, pos[0], pos[1], C_MGREY, inset=1)
        for fleer in lv.fleers:
            color = C_YELLOW if fleer.kind == "swap" else C_MAGENTA
            self._blit(frame, fleer.cell[0], fleer.cell[1], color, inset=1)
        pr, pc = lv.player
        self._blit(frame, pr, pc, C_CYAN, inset=1)
        self._draw_hud(frame)
        return frame

    def _flash(self, color: int) -> list[list[int]]:
        frame = self._render_frame()
        for y in range(PLAY_H):
            for x in range(FRAME):
                if frame[y][x] == C_BLACK:
                    frame[y][x] = color
        return frame

    def _draw_hud(self, frame: list[list[int]]) -> None:
        for y in range(PLAY_H, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_VDGREY
        pip_y = FRAME - 3
        total = self.win_levels
        width = total * 3 + (total - 1)
        x0 = max(1, (FRAME - width) // 2)
        for i in range(total):
            fill = C_DGREY
            if i < self.levels_completed or self.state == "WIN":
                fill = C_GREEN
            elif i == self.levels_completed:
                fill = C_CYAN
            x = x0 + i * 4
            for dx in range(3):
                for dy in range(2):
                    yy, xx = pip_y + dy, x + dx
                    if 0 <= yy < FRAME and 0 <= xx < FRAME:
                        frame[yy][xx] = fill

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
        attached = self._attached_abs()
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frames[-1],
            "frames": frames,
            "frame_count": len(frames),
            "transition_frame_interval_ms": 80 if multi else None,
            "default_fps": max(self.info.default_fps, 10),
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
            "attached": lv.attached_offset is not None,
            "attached_stone": list(attached) if attached else None,
            "player": list(lv.player),
            "fleers": [{"cell": list(f.cell), "kind": f.kind} for f in lv.fleers],
            "fleer_count": len(lv.fleers),
            "stone_count": len(lv.stones),
            "grid": GRID,
            "cell": CELL,
        }

    def move(self, action_id: int) -> dict[str, Any]:
        return self.action(action_id)

    def space(self) -> dict[str, Any]:
        return self.action(ACTION_SPACE)
