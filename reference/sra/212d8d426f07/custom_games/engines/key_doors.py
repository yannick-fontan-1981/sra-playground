"""KEYD: explicit key handling, doors, and inter-level recall.

ACTION1-4 move, ACTION5 picks up/drops, ACTION7 restores level entry.
The same canonical 5x5 bitmap draws a key on the map and in the inventory.
"""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

C_WHITE, C_LGREY, C_MGREY, C_DGREY, C_VDGREY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_RED, C_BLUE, C_CYAN = 6, 8, 9, 10
C_YELLOW, C_ORANGE, C_GREEN, C_PURPLE = 11, 12, 14, 15
ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_INTERACT, ACTION_RESET = 5, 7
FRAME, PLAY_HEIGHT = 64, 57
MEMORY_KEY_TYPES = ("fork", "ring", "zig")
# Creator-side manual oracles and all reproducible runs use this fixed episode
# variant.  KEYD is intentionally deterministic; no process entropy or
# instance seed may alter the visible key identity.
DETERMINISTIC_EPISODE_VARIANT = "zig"
KEY_TYPES = (*MEMORY_KEY_TYPES, "blue")
TYPE_COLORS = {"fork": C_CYAN, "ring": C_YELLOW, "zig": C_ORANGE, "blue": C_BLUE}
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "key_doors" / "levels"

# Single visual authority for map keys, lock cut-outs, and visible HUD keys.
KEY_MASKS: dict[str, tuple[str, ...]] = {
    "fork": ("11000", "10111", "11010", "00010", "00000"),
    "ring": ("11000", "10111", "11001", "00001", "00000"),
    "zig": ("11000", "10111", "11101", "00101", "00000"),
    "blue": ("01100", "11000", "01111", "00001", "00001"),
}


@dataclass(frozen=True)
class HeldKey:
    type_id: str
    reusable: bool = False


@dataclass
class LevelState:
    name: str
    rows: tuple[str, ...]
    width: int
    height: int
    max_steps: int
    refill_amount: int
    capacity: int
    inventory_display: str
    carry_inventory_to_next: bool
    exit_requires_inventory: bool
    topology_only: bool
    player: tuple[int, int]
    exits: set[tuple[int, int]]
    walls: set[tuple[int, int]]
    floor: set[tuple[int, int]]
    refills: set[tuple[int, int]]
    keys: dict[tuple[int, int], HeldKey]
    doors: dict[tuple[int, int], str]


def _load_level(path: Path) -> LevelState:
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = tuple(map(str, data.get("grid", ())))
    if not rows or len({len(row) for row in rows}) != 1:
        raise ValueError(f"level grid must be non-empty and rectangular: {path}")
    height, width = len(rows), len(rows[0])
    if height > 11 or width > 12:
        raise ValueError(f"level grid does not fit five-pixel cells: {path}")
    key_specs: dict[str, HeldKey] = {}
    for glyph, raw in dict(data.get("keys", {})).items():
        kind = str(raw.get("type", ""))
        if kind not in (*KEY_TYPES, "episode"):
            raise ValueError(f"unknown key type {kind!r}: {path}")
        key_specs[str(glyph)] = HeldKey(kind, bool(raw.get("reusable", False)))
    door_specs = {str(glyph): str(kind) for glyph, kind in dict(data.get("doors", {})).items()}
    if any(kind not in KEY_TYPES for kind in door_specs.values()):
        raise ValueError(f"unknown door type: {path}")
    players: list[tuple[int, int]] = []
    exits: set[tuple[int, int]] = set()
    walls: set[tuple[int, int]] = set()
    floor: set[tuple[int, int]] = set()
    refills: set[tuple[int, int]] = set()
    keys: dict[tuple[int, int], HeldKey] = {}
    doors: dict[tuple[int, int], str] = {}
    for row, text in enumerate(rows):
        for col, glyph in enumerate(text):
            pos = (row, col)
            if glyph == "#":
                walls.add(pos)
                continue
            floor.add(pos)
            if glyph == "@": players.append(pos)
            elif glyph == "X": exits.add(pos)
            elif glyph == ".": pass
            elif glyph == "+": refills.add(pos)
            elif glyph in key_specs: keys[pos] = key_specs[glyph]
            elif glyph in door_specs: doors[pos] = door_specs[glyph]
            else: raise ValueError(f"unknown glyph {glyph!r}: {path}")
    if len(players) != 1 or not exits:
        raise ValueError(f"level needs one player and an exit: {path}")
    display = str(data.get("inventory_display", "visible"))
    capacity, max_steps = int(data.get("capacity", 1)), int(data.get("max_steps", 1))
    refill_amount = int(data.get("refill_amount", 0))
    if display not in ("visible", "masked") or capacity <= 0 or max_steps <= 0 or refill_amount < 0:
        raise ValueError(f"invalid level settings: {path}")
    return LevelState(
        str(data.get("name") or path.stem), rows, width, height, max_steps, refill_amount, capacity,
        display, bool(data.get("carry_inventory_to_next", False)),
        bool(data.get("exit_requires_inventory", False)),
        bool(data.get("topology_only", False)), players[0], exits, walls, floor, refills, keys, doors,
    )


def _load_all_levels() -> list[LevelState]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths: raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(path) for path in paths]


class KeyDoorsEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_all_levels()
        self._episode_variant = DETERMINISTIC_EPISODE_VARIANT
        self.win_levels = int(info.levels)
        self.levels_completed = self.step_index = self.level_steps = 0
        self._energy_remaining = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._inventory: list[HeldKey] = []
        self._level_entry_inventory: list[HeldKey] = []
        self._pending_frames: list[list[list[int]]] | None = None
        self._level_first_door_choice_correct: bool | None = None
        self._level_wrong_door_attempts = 0
        self._level = self._instantiate_level(0)
        self._energy_remaining = self._level.max_steps

    def _instantiate_level(self, index: int) -> LevelState:
        level = deepcopy(self._templates[index])
        level.keys = {p: HeldKey(self._episode_variant if k.type_id == "episode" else k.type_id, k.reusable)
                      for p, k in level.keys.items()}
        return level

    def _begin_level(self, index: int) -> None:
        self._level = self._instantiate_level(index)
        self._level_entry_inventory = list(self._inventory)
        self.level_steps = 0
        self._energy_remaining = self._level.max_steps
        self.state = "NOT_FINISHED"
        self._level_first_door_choice_correct = None
        self._level_wrong_door_attempts = 0

    def reset(self) -> dict[str, Any]:
        self._episode_variant = DETERMINISTIC_EPISODE_VARIANT
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._inventory, self._pending_frames = [], None
        self._begin_level(0)
        return self.public_state()

    def _restore_level_checkpoint(self) -> None:
        self._inventory = list(self._level_entry_inventory)
        self._level = self._instantiate_level(min(self.levels_completed, self.win_levels - 1))
        self.level_steps = 0
        self._energy_remaining = self._level.max_steps
        self._level_first_door_choice_correct = None
        self._level_wrong_door_attempts = 0
        if self.state != "WIN": self.state = "NOT_FINISHED"

    def level_reset(self) -> dict[str, Any]:
        self._restore_level_checkpoint()
        self.last_action, self._pending_frames = "ACTION7", None
        return self.public_state()

    def _matching_key_index(self, kind: str) -> int | None:
        matches = [i for i, key in enumerate(self._inventory) if key.type_id == kind]
        reusable = [i for i in matches if self._inventory[i].reusable]
        return reusable[0] if reusable else (matches[0] if matches else None)

    def _tint(self, base: list[list[int]], old: int, new: int) -> list[list[int]]:
        result = deepcopy(base)
        for row in range(PLAY_HEIGHT):
            for col in range(FRAME):
                if result[row][col] == old: result[row][col] = new
        return result

    def _interaction_frames(self, before: list[list[int]]) -> list[list[list[int]]]:
        after = self._render_frame()
        return [before, self._tint(after, C_BLUE, C_PURPLE), after]

    def _local_door_feedback(self, pos: tuple[int, int]) -> list[list[list[int]]]:
        before = self._render_frame()
        flash = deepcopy(before)
        self._fill_cell(flash, pos, C_RED)
        self._draw_mask_in_cell(flash, pos, self._level.doors[pos], C_BLACK)
        return [before, flash, before]

    def _advance_level(self, frames: list[list[list[int]]]) -> None:
        carry = self._level.carry_inventory_to_next
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            return
        if not carry: self._inventory = []
        self._begin_level(self.levels_completed)
        frames.append(self._render_frame())

    def _interact(self) -> list[list[list[int]]]:
        pos, before = self._level.player, self._render_frame()
        if pos in self._level.keys and len(self._inventory) < self._level.capacity:
            self._inventory.append(self._level.keys.pop(pos))
            return self._interaction_frames(before)
        if (pos not in self._level.keys and pos not in self._level.doors
                and pos not in self._level.exits and self._inventory):
            self._level.keys[pos] = self._inventory.pop()
            return self._interaction_frames(before)
        return [before]

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        _ = data
        if self.state == "WIN": return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET: return self.level_reset()
        if aid not in (1, 2, 3, 4, 5): return self.public_state()
        self.last_action = f"ACTION{aid}"
        self.step_index += 1
        self.level_steps += 1
        self._energy_remaining -= 1
        frames: list[list[list[int]]]
        if aid == ACTION_INTERACT:
            frames = self._interact()
        else:
            dr, dc = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1)}[aid]
            row, col = self._level.player
            nxt, frames, moved = (row + dr, col + dc), [], False
            if nxt in self._level.floor:
                if nxt in self._level.doors:
                    kind = self._level.doors[nxt]
                    index = self._matching_key_index(kind)
                    if self._level_first_door_choice_correct is None:
                        self._level_first_door_choice_correct = index is not None
                    if index is None:
                        self._level_wrong_door_attempts += 1
                        frames = self._local_door_feedback(nxt)
                        if self._energy_remaining <= 0:
                            before = frames[-1]
                            self._restore_level_checkpoint()
                            frames.extend([self._tint(before, C_MGREY, C_RED), self._render_frame()])
                        self._pending_frames = frames
                        return self.public_state()
                    before = self._render_frame()
                    if not self._inventory[index].reusable: self._inventory.pop(index)
                    self._level.doors.pop(nxt)
                    self._level.player, moved = nxt, True
                    frames = self._interaction_frames(before)
                elif nxt in self._level.exits and self._level.exit_requires_inventory and not self._inventory:
                    self._pending_frames = self._local_exit_feedback(nxt)
                    return self.public_state()
                else:
                    self._level.player, moved = nxt, True
                    if nxt in self._level.refills:
                        before = self._render_frame()
                        self._level.refills.remove(nxt)
                        self._energy_remaining += self._level.refill_amount
                        frames = [before, self._tint(self._render_frame(), C_MAGENTA, C_GREEN), self._render_frame()]
            if moved and self._level.player in self._level.exits:
                before = self._render_frame()
                frames.extend([before, self._tint(before, C_WHITE, C_GREEN)])
                self._advance_level(frames)
            elif not frames:
                frames = [self._render_frame()]
        if self._energy_remaining <= 0:
            before = self._render_frame()
            self._restore_level_checkpoint()
            frames = [before, self._tint(before, C_MGREY, C_RED), self._render_frame()]
        self._pending_frames = frames
        return self.public_state()

    def public_state(self) -> dict[str, Any]:
        frames = self._pending_frames or [self._render_frame()]
        self._pending_frames = None
        available = ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "ACTION7"]
        if self.state == "WIN": available = ["ACTION7"]
        visible = self._level.inventory_display == "visible"
        return {
            "backend": "custom", "selected": True, "game_id": self.info.game_id,
            "title": self.info.title, "frame": frames[-1], "frames": frames,
            "frame_count": len(frames), "default_fps": max(self.info.default_fps, 8 if len(frames) > 1 else self.info.default_fps),
            "state": self.state, "level": min(self.levels_completed + 1, self.win_levels),
            "levels_completed": self.levels_completed, "win_levels": self.win_levels,
            "step_index": self.step_index, "available_actions": available,
            "available_action_ids": [int(a.removeprefix("ACTION")) for a in available],
            "last_action": self.last_action, "score": self.levels_completed,
            "full_reset": False, "source_path": str(LEVELS_DIR), "custom_family": self.info.family,
            "level_name": self._level.name, "level_steps": self.level_steps, "max_steps": self._level.max_steps,
            "actions_remaining": self._energy_remaining, "refill_amount": self._level.refill_amount,
            "inventory_capacity": self._level.capacity, "inventory_visible": visible,
            "inventory_masked": not visible, "inventory_count": len(self._inventory),
        }

    def _layout(self) -> tuple[int, int, int]:
        cell = min(5, (PLAY_HEIGHT - 2) // self._level.height, (FRAME - 2) // self._level.width)
        return cell, max(0, (PLAY_HEIGHT - self._level.height * cell) // 2), max(0, (FRAME - self._level.width * cell) // 2)

    def _fill_cell(self, frame: list[list[int]], pos: tuple[int, int], color: int, inset: int = 0) -> None:
        cell, top, left = self._layout()
        y0, x0 = top + pos[0] * cell + inset, left + pos[1] * cell + inset
        for y in range(y0, y0 + cell - 2 * inset):
            for x in range(x0, x0 + cell - 2 * inset): frame[y][x] = color

    @staticmethod
    def _draw_mask(frame: list[list[int]], y0: int, x0: int, kind: str, color: int) -> None:
        for dy, row in enumerate(KEY_MASKS[kind]):
            for dx, bit in enumerate(row):
                if bit == "1": frame[y0 + dy][x0 + dx] = color

    def _draw_mask_in_cell(self, frame: list[list[int]], pos: tuple[int, int], kind: str, color: int) -> None:
        cell, top, left = self._layout()
        if cell != 5: raise ValueError("KEYD requires five-pixel cells")
        self._draw_mask(frame, top + pos[0] * cell, left + pos[1] * cell, kind, color)

    def _draw_border(self, frame: list[list[int]], pos: tuple[int, int], color: int) -> None:
        cell, top, left = self._layout()
        y0, x0 = top + pos[0] * cell, left + pos[1] * cell
        for d in range(cell):
            frame[y0][x0 + d] = frame[y0 + cell - 1][x0 + d] = color
            frame[y0 + d][x0] = frame[y0 + d][x0 + cell - 1] = color

    def _local_exit_feedback(self, pos: tuple[int, int]) -> list[list[list[int]]]:
        before = self._render_frame()
        flash = deepcopy(before)
        self._draw_border(flash, pos, C_RED)
        return [before, flash, before]

    def _draw_hud(self, frame: list[list[int]]) -> None:
        for y in range(PLAY_HEIGHT, FRAME):
            for x in range(FRAME): frame[y][x] = C_VDGREY
        for i in range(self.win_levels):
            color = C_GREEN if i < self.levels_completed else C_MGREY
            frame[PLAY_HEIGHT + 1][1 + i * 2] = frame[PLAY_HEIGHT + 2][1 + i * 2] = color
        for x in range(min(24, max(0, self._energy_remaining))):
            frame[FRAME - 2][16 + x] = C_MAGENTA
        for i in range(self._level.capacity):
            x0, y0 = 43 + i * 7, PLAY_HEIGHT + 1
            if x0 + 4 >= FRAME: break
            for d in range(5):
                frame[y0][x0 + d] = frame[y0 + 4][x0 + d] = C_MGREY
                frame[y0 + d][x0] = frame[y0 + d][x0 + 4] = C_MGREY
            if i >= len(self._inventory): continue
            key = self._inventory[i]
            if key.reusable:
                for y, x in ((y0, x0), (y0, x0 + 4), (y0 + 4, x0), (y0 + 4, x0 + 4)):
                    frame[y][x] = C_CYAN
            if self._level.inventory_display == "visible":
                self._draw_mask(frame, y0, x0, key.type_id, TYPE_COLORS[key.type_id])
            else:
                for y in range(y0 + 1, y0 + 4):
                    for x in range(x0 + 1, x0 + 4): frame[y][x] = C_PURPLE

    def _render_frame(self) -> list[list[int]]:
        frame = [[C_BLACK] * FRAME for _ in range(FRAME)]
        for pos in self._level.floor: self._fill_cell(frame, pos, C_DGREY, inset=1)
        for pos in self._level.walls: self._fill_cell(frame, pos, C_MGREY)
        for pos in self._level.exits:
            self._draw_border(frame, pos, C_GREEN)
            if self._level.exit_requires_inventory:
                cell, top, left = self._layout()
                frame[top + pos[0] * cell + 2][left + pos[1] * cell + 2] = C_PURPLE
        for pos in self._level.refills:
            cell, top, left = self._layout()
            y0, x0 = top + pos[0] * cell, left + pos[1] * cell
            for d in range(5):
                frame[y0 + 2][x0 + d] = C_MAGENTA
                frame[y0 + d][x0 + 2] = C_MAGENTA
        for pos, kind in self._level.doors.items():
            self._fill_cell(frame, pos, C_LGREY if self._level.topology_only else TYPE_COLORS[kind])
            self._draw_mask_in_cell(frame, pos, kind, C_BLACK)
        for pos, key in self._level.keys.items():
            if key.reusable: self._draw_border(frame, pos, C_CYAN)
            self._draw_mask_in_cell(frame, pos, key.type_id, C_WHITE if self._level.topology_only else TYPE_COLORS[key.type_id])
        self._fill_cell(frame, self._level.player, C_WHITE, inset=1)
        cell, top, left = self._layout()
        frame[top + self._level.player[0] * cell + 2][left + self._level.player[1] * cell + 2] = C_BLUE
        self._draw_hud(frame)
        return frame
