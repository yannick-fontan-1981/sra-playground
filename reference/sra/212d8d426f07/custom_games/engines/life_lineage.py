"""LIFE: follow identity through birth, merge, split, and changed appearance.

ACTION6 is the only action.  Click two compatible parents to merge them, click
the resulting compound to split it, then click a child and its destination.
A white/black core pair is the stable lineage signature; shells and goal
phenotypes are episode-dependent surface properties.
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

C_WHITE, C_LGREY, C_MGREY, C_DGREY, C_VDGREY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_PINK, C_RED, C_BLUE, C_CYAN = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_GREEN, C_PURPLE = 11, 12, 14, 15
FRAME, PLAY_HEIGHT, ACTION_CLICK = 64, 57, 6
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "life_lineage" / "levels"

SHELL_COLORS = (C_CYAN, C_ORANGE, C_MAGENTA, C_GREEN, C_BLUE, C_YELLOW)
FAMILY_COLORS = (C_PURPLE, C_CYAN, C_ORANGE)
SKIN_COLORS = (
    (C_CYAN, C_ORANGE, C_MAGENTA, C_GREEN, C_BLUE, C_YELLOW),
    (C_PINK, C_BLUE, C_YELLOW, C_PURPLE, C_GREEN, C_ORANGE),
    (C_ORANGE, C_PURPLE, C_CYAN, C_PINK, C_YELLOW, C_BLUE),
)
PHENOTYPE_SHAPES = ("diamond", "square", "tee", "corner", "bar", "cup")
PROFILE_MAPS = (
    (0, 1, 2, 3, 4, 5),
    (2, 0, 3, 1, 5, 4),
)
SIGNATURES = (
    ((0, 0), (2, 2)), ((0, 2), (2, 0)), ((0, 1), (2, 1)),
    ((1, 0), (1, 2)), ((0, 0), (0, 2)), ((2, 0), (2, 2)),
)
SHAPES: dict[str, tuple[tuple[int, int], ...]] = {
    "diamond": ((0, 1), (1, 0), (1, 1), (1, 2), (2, 1)),
    "square": ((0, 0), (0, 1), (0, 2), (1, 0), (1, 2), (2, 0), (2, 1), (2, 2)),
    "tee": ((0, 0), (0, 1), (0, 2), (1, 1), (2, 1)),
    "corner": ((0, 0), (1, 0), (2, 0), (2, 1), (2, 2)),
    "bar": ((0, 1), (1, 1), (2, 1)),
    "cup": ((0, 0), (1, 0), (2, 0), (2, 1), (2, 2), (1, 2)),
}


def _rotated_signature(identity: int, turns: int) -> tuple[tuple[int, int], ...]:
    signature = SIGNATURES[identity % len(SIGNATURES)]
    for _ in range(turns % 4):
        signature = tuple((dx, 2 - dy) for dy, dx in signature)
    return signature


def _load_levels() -> list[dict[str, Any]]:
    levels = [json.loads(path.read_text(encoding="utf-8")) for path in sorted(LEVELS_DIR.glob("L*.json"))]
    if len(levels) != 6:
        raise ValueError("LIFE requires exactly six levels")
    for level in levels:
        pairs = int(level.get("pair_count", 0))
        order = [int(value) for value in level.get("parent_order", [])]
        goals = [int(value) for value in level.get("goal_order", [])]
        if not 1 <= pairs <= 3:
            raise ValueError("LIFE pair_count must be between one and three")
        expected = set(range(pairs * 2))
        if set(order) != expected or set(goals) != expected:
            raise ValueError("LIFE orders must contain every lineage identity exactly once")
        cyclones = int(level.get("cyclones", 0))
        starts = [int(value) for value in level.get("start_rotations", [0] * (pairs * 2))]
        if cyclones not in (0, 1) or len(starts) != pairs * 2:
            raise ValueError("LIFE cyclone levels require one rotation per identity")
        if any(turn not in range(4) for turn in starts):
            raise ValueError("LIFE rotations must be quarter turns")
    return levels


class LifeLineageEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_levels()
        self.win_levels = int(info.levels)
        self._episode_profile = 0
        self._episode_memory_ready = False
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._begin_level(0)

    def reset(self) -> dict[str, Any]:
        self._episode_profile = (self._episode_profile + 1) % len(PROFILE_MAPS)
        self._episode_memory_ready = False
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
        self._level = self._templates[index]
        self.level_steps = 0
        self._selected: tuple[str, int] | None = None
        self._parents: dict[int, tuple[int, int]] = {}
        self._seeds: dict[int, tuple[int, int]] = {}
        self._compounds: dict[int, tuple[int, int]] = {}
        self._children: dict[int, tuple[int, int]] = {}
        self._placed: dict[int, int] = {}
        cyclone_count = int(self._level.get("cyclones", 0))
        cyclone_positions = self._spread(cyclone_count, 32, 32) if cyclone_count else []
        self._cyclones: dict[int, tuple[int, int]] = {
            index_: (40, x)
            for index_, x in enumerate(cyclone_positions)
        }
        pairs = int(self._level["pair_count"])
        starts = self._level.get("start_rotations", [0] * (pairs * 2))
        self._rotations = {identity: int(starts[identity]) for identity in range(pairs * 2)}
        if self._level.get("spawn"):
            for family, x in enumerate(self._spread(pairs, 12, 52)):
                self._seeds[family] = (48, x)
        else:
            order = [int(value) for value in self._level["parent_order"]]
            for identity, x in zip(order, self._spread(len(order), 6, 58)):
                self._parents[identity] = (48, x)

    @staticmethod
    def _spread(count: int, low: int, high: int) -> list[int]:
        if count <= 1:
            return [(low + high) // 2]
        return [low + round(index * (high - low) / (count - 1)) for index in range(count)]

    def _phenotype(self, identity: int) -> int:
        return PROFILE_MAPS[self._episode_profile][identity]

    def _goal_positions(self) -> dict[int, tuple[int, int]]:
        order = [int(value) for value in self._level["goal_order"]]
        return {identity: (7, x) for identity, x in zip(order, self._spread(len(order), 7, 57))}

    def _family_x(self, family: int) -> int:
        return self._spread(int(self._level["pair_count"]), 16, 48)[family]

    def _hit(self, data: dict[str, Any]) -> tuple[str, int] | None:
        x, y = int(data.get("x", -99)), int(data.get("y", -99))
        pools = (
            ("seed", self._seeds), ("parent", self._parents), ("cyclone", self._cyclones),
            ("compound", self._compounds), ("child", self._children), ("goal", self._goal_positions()),
        )
        for kind, pool in pools:
            for identity, (cy, cx) in pool.items():
                radius = 4 if kind in {"compound", "goal"} else 3
                if abs(x - cx) <= radius and abs(y - cy) <= radius:
                    return kind, identity
        return None

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        if self.state == "WIN" or int(action_id) != ACTION_CLICK:
            return self.public_state()
        hit = self._hit(data or {})
        if hit is None:
            return self.public_state()
        self.last_action = f"ACTION{ACTION_CLICK}"
        self.step_index += 1
        self.level_steps += 1
        before = self._render_frame()
        kind, identity = hit
        if kind == "seed":
            self._spawn(identity)
            self._pending_frames = self._pulse(before, self._render_frame(), C_GREEN, 6)
        elif kind == "parent":
            self._touch_parent(identity, before)
        elif kind == "cyclone":
            self._rotate_selected(before)
        elif kind == "compound":
            self._split(identity)
            self._pending_frames = self._pulse(before, self._render_frame(), C_CYAN, 7)
        elif kind == "child":
            self._selected = None if self._selected == hit else hit
            self._pending_frames = [before, self._render_frame()]
        elif kind == "goal":
            self._touch_goal(identity, before)
        return self.public_state()

    def _spawn(self, family: int) -> None:
        _, x = self._seeds.pop(family)
        self._parents[family * 2] = (48, x - 4)
        self._parents[family * 2 + 1] = (48, x + 4)
        self._selected = None

    def _touch_parent(self, identity: int, before: list[list[int]]) -> None:
        hit = ("parent", identity)
        if self._selected is None or self._selected[0] != "parent":
            self._selected = hit
            self._pending_frames = [before, self._render_frame()]
            return
        if self._selected == hit:
            self._selected = None
            self._pending_frames = [before, self._render_frame()]
            return
        _, first = self._selected
        compatible = first // 2 == identity // 2 and first != identity
        if not compatible:
            self._selected = hit
            self._pending_frames = self._pulse(before, self._render_frame(), C_RED, 5)
            return
        family = identity // 2
        self._parents.pop(first)
        self._parents.pop(identity)
        self._compounds[family] = (34, self._family_x(family))
        self._selected = None
        self._pending_frames = self._pulse(before, self._render_frame(), C_MAGENTA, 7)

    def _rotate_selected(self, before: list[list[int]]) -> None:
        if self._selected is None or self._selected[0] not in {"parent", "child"}:
            self._pending_frames = self._pulse(before, before, C_RED, 5)
            return
        identity = self._selected[1]
        self._rotations[identity] = (self._rotations[identity] + 1) % 4
        self._pending_frames = [before]
        for phase in (1, 2, 3, 0, 1, 2, 3, 0):
            self._pending_frames.append(self._render_frame(cyclone_phase=phase))

    def _split(self, family: int) -> None:
        self._compounds.pop(family)
        x = self._family_x(family)
        self._children[family * 2] = (21, x - 4)
        self._children[family * 2 + 1] = (21, x + 4)
        self._selected = None

    def _touch_goal(self, goal_identity: int, before: list[list[int]]) -> None:
        if self._selected is None or self._selected[0] != "child":
            self._pending_frames = self._pulse(before, before, C_RED, 4)
            return
        child = self._selected[1]
        current_signature = _rotated_signature(child, self._rotations[child])
        if current_signature != SIGNATURES[goal_identity]:
            self._pending_frames = self._pulse(before, self._render_frame(), C_RED, 5)
            return
        self._children.pop(child)
        self._placed[goal_identity] = child
        self._selected = None
        placed = self._render_frame()
        if len(self._placed) == int(self._level["pair_count"]) * 2:
            self._pending_frames = self._complete_level(before, placed)
        else:
            self._pending_frames = self._pulse(before, placed, C_GREEN, 4)

    def _complete_level(self, before: list[list[int]], solved: list[list[int]]) -> list[list[list[int]]]:
        pulse = deepcopy(solved)
        for _, (y, x) in self._goal_positions().items():
            self._border(pulse, y - 4, x - 4, 9, 9, C_WHITE)
        frames = [before, solved, pulse, solved, pulse, solved, pulse, solved, pulse, solved]
        if self.levels_completed == 0:
            self._episode_memory_ready = True
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            return frames
        self._begin_level(self.levels_completed)
        frames.append(self._render_frame())
        return frames

    def _pulse(self, before: list[list[int]], after: list[list[int]], color: int, count: int) -> list[list[list[int]]]:
        flash = deepcopy(after)
        for y in range(2, PLAY_HEIGHT - 2):
            for x in range(2, FRAME - 2):
                if flash[y][x] == C_LGREY:
                    flash[y][x] = color
        frames = [before]
        for index in range(max(1, count - 2)):
            frames.append(flash if index % 2 == 0 else after)
        frames.append(after)
        return frames

    def public_state(self) -> dict[str, Any]:
        frames = self._pending_frames or [self._render_frame()]
        self._pending_frames = None
        available = ["ACTION6"] if self.state != "WIN" else []
        return {
            "backend": "custom", "selected": True, "game_id": self.info.game_id,
            "title": self.info.title, "frame": frames[-1], "frames": frames,
            "frame_count": len(frames), "default_fps": max(self.info.default_fps, 8 if len(frames) > 1 else self.info.default_fps),
            "state": self.state, "level": min(self.levels_completed + 1, self.win_levels),
            "levels_completed": self.levels_completed, "win_levels": self.win_levels,
            "step_index": self.step_index, "available_actions": available,
            "available_action_ids": [6] if available else [], "last_action": self.last_action,
            "score": self.levels_completed, "full_reset": False, "source_path": str(LEVELS_DIR),
            "custom_family": self.info.family, "level_name": self._level["name"], "stage": "lineage",
            "level_steps": self.level_steps, "max_steps": None, "actions_remaining": None,
            "episode_memory_ready": self._episode_memory_ready,
        }

    def _render_frame(self, *, cyclone_phase: int = 0) -> list[list[int]]:
        frame = [[C_BLACK for _ in range(FRAME)] for _ in range(FRAME)]
        self._rect(frame, 1, 1, PLAY_HEIGHT - 2, FRAME - 2, C_VDGREY)
        # Lifecycle lanes: goals, descendants, compound, parents/birth.
        for y, color in ((14, C_DGREY), (28, C_DGREY), (41, C_DGREY)):
            for x in range(3, 61):
                frame[y][x] = color
        self._draw_flow_arrows(frame)
        for identity, (y, x) in self._goal_positions().items():
            self._draw_goal(frame, y, x, identity, identity in self._placed)
        for family, (y, x) in self._seeds.items():
            self._draw_seed(frame, y, x, family)
        for identity, (y, x) in self._parents.items():
            self._draw_parent(frame, y, x, identity)
        for cyclone, (y, x) in self._cyclones.items():
            self._draw_cyclone(frame, y, x, cyclone, phase=cyclone_phase)
        for family, (y, x) in self._compounds.items():
            self._draw_compound(frame, y, x, family)
        for identity, (y, x) in self._children.items():
            self._draw_child(frame, y, x, identity)
        if self._selected:
            pool = {"parent": self._parents, "child": self._children}.get(self._selected[0], {})
            cell = pool.get(self._selected[1])
            if cell:
                self._border(frame, cell[0] - 4, cell[1] - 4, 9, 9, C_WHITE)
        self._draw_level_counter(frame)
        return frame

    def _draw_level_counter(self, frame: list[list[int]]) -> None:
        for index in range(self.win_levels):
            x0, y0 = 2 + index * 10, 58
            fill = C_GREEN if index < self.levels_completed or self.state == "WIN" else C_DGREY
            if index == self.levels_completed and self.state != "WIN":
                fill = C_CYAN
            for yy in range(y0, y0 + 5):
                for xx in range(x0, x0 + 7):
                    border = yy in (y0, y0 + 4) or xx in (x0, x0 + 6)
                    frame[yy][xx] = C_MGREY if border else fill

    def _draw_flow_arrows(self, frame: list[list[int]]) -> None:
        for y in (16, 30, 43):
            frame[y][31] = frame[y - 1][31] = C_LGREY
            frame[y - 1][30] = frame[y - 1][32] = C_LGREY

    def _draw_parent(self, frame: list[list[int]], y: int, x: int, identity: int) -> None:
        color = SKIN_COLORS[int(self._level.get("skin", 0)) % len(SKIN_COLORS)][identity]
        self._rect(frame, y - 3, x - 3, 7, 7, color)
        self._border(frame, y - 3, x - 3, 7, 7, FAMILY_COLORS[identity // 2])
        if identity % 2 == 0:
            self._rect(frame, y - 1, x + 3, 3, 2, C_WHITE)
        else:
            self._rect(frame, y - 1, x - 4, 3, 2, C_WHITE)
        self._draw_signature(frame, y, x, identity, C_WHITE)

    def _draw_cyclone(
        self, frame: list[list[int]], y: int, x: int, cyclone: int, *, phase: int = 0,
    ) -> None:
        pattern = (
            "  999  ",
            " 9AAA9 ",
            "9AA9AA9",
            "9AAA999",
            "999A999",
            " 99999 ",
            "  999  ",
        )
        colors = {"9": C_BLUE, "A": C_CYAN}
        for dy, row in enumerate(pattern, start=-3):
            for dx, symbol in enumerate(row, start=-3):
                if symbol != " ":
                    rotated_y, rotated_x = dy, dx
                    for _ in range(phase % 4):
                        rotated_y, rotated_x = rotated_x, -rotated_y
                    frame[y + rotated_y][x + rotated_x] = colors[symbol]

    def _draw_seed(self, frame: list[list[int]], y: int, x: int, family: int) -> None:
        self._shape(frame, y - 2, x - 1, "diamond", SHELL_COLORS[family])
        self._border(frame, y - 4, x - 4, 9, 9, C_GREEN)
        frame[y][x] = C_WHITE

    def _draw_compound(self, frame: list[list[int]], y: int, x: int, family: int) -> None:
        self._rect(frame, y - 4, x - 5, 9, 11, C_PURPLE)
        self._border(frame, y - 4, x - 5, 9, 11, C_MAGENTA)
        self._draw_signature(frame, y, x - 2, family * 2, C_WHITE)
        self._draw_signature(frame, y, x + 2, family * 2 + 1, C_WHITE)

    def _draw_child(self, frame: list[list[int]], y: int, x: int, identity: int) -> None:
        phenotype = self._phenotype(identity)
        visible_identities = {int(value) for value in self._level.get("visible_identities", [])}
        hidden = bool(self._level.get("hidden_children")) and identity not in visible_identities
        shape = "square" if hidden else PHENOTYPE_SHAPES[phenotype]
        color = C_MGREY if hidden else SHELL_COLORS[phenotype]
        self._shape(frame, y - 1, x - 1, shape, color)
        self._draw_signature(frame, y, x, identity, C_WHITE)

    def _draw_goal(self, frame: list[list[int]], y: int, x: int, identity: int, filled: bool) -> None:
        phenotype = self._phenotype(identity)
        self._border(frame, y - 4, x - 4, 9, 9, C_BLUE if not filled else C_WHITE)
        self._shape(frame, y - 1, x - 1, PHENOTYPE_SHAPES[phenotype], SHELL_COLORS[phenotype])
        if filled:
            child = self._placed[identity]
            self._draw_signature(frame, y, x, child, C_WHITE)

    def _draw_signature(
        self, frame: list[list[int]], y: int, x: int, identity: int, color: int, *, turns: int | None = None,
    ) -> None:
        rotated = _rotated_signature(identity, self._rotations.get(identity, 0) if turns is None else turns)
        for index, (dy, dx) in enumerate(rotated):
            yy, xx = y - 1 + dy, x - 1 + dx
            if 0 <= yy < PLAY_HEIGHT and 0 <= xx < FRAME:
                frame[yy][xx] = color if index == 0 else C_BLACK

    @staticmethod
    def _shape(frame: list[list[int]], y: int, x: int, shape: str, color: int) -> None:
        for dy, dx in SHAPES[shape]:
            if 0 <= y + dy < PLAY_HEIGHT and 0 <= x + dx < FRAME:
                frame[y + dy][x + dx] = color

    @staticmethod
    def _rect(frame: list[list[int]], y: int, x: int, h: int, w: int, color: int) -> None:
        for yy in range(max(0, y), min(PLAY_HEIGHT, y + h)):
            for xx in range(max(0, x), min(FRAME, x + w)):
                frame[yy][xx] = color

    @staticmethod
    def _border(frame: list[list[int]], y: int, x: int, h: int, w: int, color: int) -> None:
        for xx in range(x, x + w):
            if 0 <= y < PLAY_HEIGHT and 0 <= xx < FRAME: frame[y][xx] = color
            if 0 <= y + h - 1 < PLAY_HEIGHT and 0 <= xx < FRAME: frame[y + h - 1][xx] = color
        for yy in range(y, y + h):
            if 0 <= yy < PLAY_HEIGHT and 0 <= x < FRAME: frame[yy][x] = color
            if 0 <= yy < PLAY_HEIGHT and 0 <= x + w - 1 < FRAME: frame[yy][x + w - 1] = color
