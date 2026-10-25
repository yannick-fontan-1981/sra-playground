"""PORT: visible portal topology, graph rewrites, and scoped inter-level recall.

ACTION1-4 move on a compact maze. Entering a portal immediately exits from its
paired endpoint in the endpoint's displayed orientation. Switches rewrite pairs.
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
FRAME, PLAY_HEIGHT, CELL, BOARD_TOP, BOARD_LEFT = 64, 55, 4, 2, 6
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "portal_topology" / "levels"

ACTION_DELTAS = {1: (-1, 0, "U"), 2: (1, 0, "D"), 3: (0, -1, "L"), 4: (0, 1, "R")}
ORIENTATION_DELTAS = {name: (dy, dx) for dy, dx, name in ACTION_DELTAS.values()}
PAIR_COLORS = (C_RED, C_BLUE, C_GREEN, C_MAGENTA)
IDENTITY_MASKS = {
    "A": "1001", "B": "1100", "C": "1010", "D": "0110",
    "E": "0101", "F": "1110", "G": "0011", "H": "1111",
}
PAIR_MASKS = ("1001", "1100", "1010", "0110")
EPISODE_PAIR_VARIANTS = (
    (("A", "B"), ("C", "D")),
    (("A", "D"), ("B", "C")),
)


def _load_levels() -> list[dict[str, Any]]:
    levels = [json.loads(path.read_text(encoding="utf-8")) for path in sorted(LEVELS_DIR.glob("L*.json"))]
    if len(levels) != 6:
        raise ValueError("PORT requires exactly six levels")
    for level in levels:
        rows = [str(row) for row in level.get("rows", [])]
        if not rows or len(rows) > 13 or len({len(row) for row in rows}) != 1 or len(rows[0]) > 13:
            raise ValueError(f"invalid PORT grid in {level.get('name')!r}")
        flat = "".join(rows)
        if flat.count("@") != 1 or flat.count("X") != 1:
            raise ValueError("PORT levels require one player and one exit")
        portal_ids = {cell for cell in flat if cell in IDENTITY_MASKS}
        if set(level.get("orientations", {})) != portal_ids:
            raise ValueError("every PORT endpoint requires one orientation")
        for orientation in level["orientations"].values():
            if orientation not in ORIENTATION_DELTAS:
                raise ValueError(f"invalid PORT orientation {orientation!r}")
    return levels


class PortalTopologyEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_levels()
        self.win_levels = int(info.levels)
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._episode_variant = 0
        self._learned_pairs: set[frozenset[str]] = set()
        self._seen_portals: set[str] = set()
        self._episode_memory_ready = False
        self._pending_frames: list[list[list[int]]] | None = None
        self._begin_level(0)

    def _begin_level(self, index: int) -> None:
        self._level = deepcopy(self._templates[index])
        self._seen_portals.clear()
        rows = [str(row) for row in self._level["rows"]]
        self._height, self._width = len(rows), len(rows[0])
        self._walls: set[tuple[int, int]] = set()
        self._portals: dict[str, tuple[int, int]] = {}
        self._switches: set[tuple[int, int]] = set()
        self._exit = (-1, -1)
        for y, row in enumerate(rows):
            for x, cell in enumerate(row):
                if cell == "#": self._walls.add((y, x))
                elif cell == "@": self._player = (y, x)
                elif cell == "X": self._exit = (y, x)
                elif cell == "!": self._switches.add((y, x))
                elif cell in IDENTITY_MASKS: self._portals[cell] = (y, x)
        self._facing = "U"
        self._switch_state = 0
        self.level_steps = 0
        self.state = "NOT_FINISHED"

    def reset(self) -> dict[str, Any]:
        self._episode_variant = (self._episode_variant + 1) % len(EPISODE_PAIR_VARIANTS)
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._learned_pairs.clear()
        self._seen_portals.clear()
        self._episode_memory_ready = False
        self._pending_frames = None
        self._begin_level(0)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self._begin_level(min(self.levels_completed, self.win_levels - 1))
        self.last_action, self._pending_frames = "ACTION7", None
        return self.public_state()

    def _pairs(self, switch_state: int | None = None) -> tuple[tuple[str, str], ...]:
        state = self._switch_state if switch_state is None else switch_state
        pairs: list[tuple[str, str]] = []
        if self._level.get("episode_pairs"):
            episode_variant = self._episode_variant
            if self._level.get("rewrite_episode_on_switch"):
                episode_variant = (episode_variant + state) % len(EPISODE_PAIR_VARIANTS)
            pairs.extend(pair for pair in EPISODE_PAIR_VARIANTS[episode_variant] if set(pair) <= set(self._portals))
        if self._level.get("switch_pairs"):
            variants = self._level["switch_pairs"]
            pairs.extend(tuple(pair) for pair in variants[state % len(variants)])
        else:
            pairs.extend(tuple(pair) for pair in self._level.get("pairs", []))
        if self._level.get("switch_extra_pairs"):
            variants = self._level["switch_extra_pairs"]
            pairs.extend(tuple(pair) for pair in variants[state % len(variants)])
        return tuple(pairs)

    def _pair_map(self, switch_state: int | None = None) -> dict[str, str]:
        result: dict[str, str] = {}
        for first, second in self._pairs(switch_state):
            result[first], result[second] = second, first
        return result

    def _portal_mask(self, identity: str, switch_state: int | None = None) -> str:
        for pair_index, pair in enumerate(self._pairs(switch_state)):
            if identity in pair:
                return PAIR_MASKS[pair_index % len(PAIR_MASKS)]
        return IDENTITY_MASKS[identity]

    def _advance_switch_state(self, switch_state: int) -> int:
        variants = self._level.get("switch_pairs") or self._level.get("switch_extra_pairs") or [(), ()]
        return (switch_state + 1) % len(variants)

    def _exit_unlocked(self, seen: set[str] | None = None, switch_state: int | None = None) -> bool:
        observed = self._seen_portals if seen is None else seen
        state = self._switch_state if switch_state is None else switch_state
        required = set(self._level.get("required_seen", []))
        if required and not required <= observed:
            return False
        if self._level.get("requires_episode_memory") and not self._episode_memory_ready:
            return False
        if self._level.get("requires_switch") and state == 0:
            return False
        return True

    def _transition(
        self,
        position: tuple[int, int],
        facing: str,
        switch_state: int,
        seen: set[str],
        action_id: int,
    ) -> tuple[tuple[int, int], str, int, set[str], str, tuple[str, str] | None]:
        dy, dx, direction = ACTION_DELTAS[action_id]
        target = (position[0] + dy, position[1] + dx)
        if target in self._walls or not (0 <= target[0] < self._height and 0 <= target[1] < self._width):
            return position, facing, switch_state, set(seen), "blocked", None
        if target == self._exit and not self._exit_unlocked(seen, switch_state):
            return position, facing, switch_state, set(seen), "locked", None
        portal_id = next((identity for identity, cell in self._portals.items() if cell == target), None)
        if portal_id is not None:
            partner = self._pair_map(switch_state).get(portal_id)
            if partner is None:
                return position, facing, switch_state, set(seen), "unpaired", (portal_id, portal_id)
            exit_orientation = str(self._level["orientations"][partner])
            out_y, out_x = ORIENTATION_DELTAS[exit_orientation]
            exit_cell = self._portals[partner]
            landing = (exit_cell[0] + out_y, exit_cell[1] + out_x)
            if landing in self._walls:
                return position, facing, switch_state, set(seen), "blocked", (portal_id, partner)
            observed = set(seen) | {portal_id, partner}
            if landing in self._switches:
                return landing, exit_orientation, self._advance_switch_state(switch_state), observed, "portal_rewrite", (portal_id, partner)
            return landing, exit_orientation, switch_state, observed, "portal", (portal_id, partner)
        if target in self._switches:
            next_state = self._advance_switch_state(switch_state)
            return target, direction, next_state, set(seen), "rewrite", None
        return target, direction, switch_state, set(seen), "move", None

    def _flash(self, color: int) -> list[list[list[int]]]:
        before = self._render_frame()
        flash = deepcopy(before)
        for y in range(PLAY_HEIGHT):
            for x in range(FRAME):
                if flash[y][x] not in (C_BLACK, C_VDGREY): flash[y][x] = color
        return [before, flash, before]

    def _complete_level(self, before: list[list[int]], solved: list[list[int]]) -> list[list[list[int]]]:
        pulse = self._render_frame(exit_pulse=True)
        frames = [before, solved, pulse, solved, pulse, solved, pulse, solved, pulse, solved]
        if self.levels_completed == 0:
            expected = {frozenset(pair) for pair in EPISODE_PAIR_VARIANTS[self._episode_variant]}
            self._episode_memory_ready = expected <= self._learned_pairs
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            return frames
        self._begin_level(self.levels_completed)
        frames.append(self._render_frame())
        return frames

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        if self.state == "WIN" or int(action_id) not in ACTION_DELTAS:
            return self.public_state()
        aid = int(action_id)
        before = self._render_frame()
        position, facing, switch_state, seen, event, traversal = self._transition(
            self._player, self._facing, self._switch_state, self._seen_portals, aid
        )
        self.last_action = f"ACTION{aid}"
        self.step_index += 1
        self.level_steps += 1
        if event in {"blocked", "locked", "unpaired"}:
            frames = self._flash(C_RED)
        else:
            self._player, self._facing, self._switch_state, self._seen_portals = position, facing, switch_state, seen
            if event in {"portal", "portal_rewrite"} and traversal is not None:
                first, second = traversal
                self._learned_pairs.add(frozenset((first, second)))
                entry = self._render_frame(
                    player=self._portals[first],
                    player_facing=ACTION_DELTAS[aid][2],
                    portal_pulse={first: C_WHITE},
                )
                transit = self._render_frame(player=None, portal_pulse={first: C_WHITE, second: C_WHITE})
                emerge = self._render_frame(portal_pulse={second: C_WHITE})
                frames = [before, entry, transit, emerge, self._render_frame()]
            elif event == "rewrite":
                frames = [before, self._render_frame(switch_pulse=True), self._render_frame()]
            else:
                frames = [before, self._render_frame()]
            if self._player == self._exit and self._exit_unlocked():
                frames = self._complete_level(before, self._render_frame())
        self._pending_frames = frames
        return self.public_state()

    def public_state(self) -> dict[str, Any]:
        frames = self._pending_frames or [self._render_frame()]
        self._pending_frames = None
        available = [f"ACTION{action}" for action in ACTION_DELTAS] if self.state != "WIN" else []
        return {
            "backend": "custom", "selected": True, "game_id": self.info.game_id,
            "title": self.info.title, "frame": frames[-1], "frames": frames,
            "frame_count": len(frames), "default_fps": max(self.info.default_fps, 10 if len(frames) > 1 else self.info.default_fps),
            "state": self.state, "level": min(self.levels_completed + 1, self.win_levels),
            "levels_completed": self.levels_completed, "win_levels": self.win_levels,
            "step_index": self.step_index, "available_actions": available,
            "available_action_ids": list(ACTION_DELTAS) if available else [],
            "last_action": self.last_action, "score": self.levels_completed,
            "full_reset": False, "source_path": str(LEVELS_DIR), "custom_family": self.info.family,
            "level_name": self._level["name"], "stage": "portal_topology",
            "level_steps": self.level_steps, "max_steps": None, "actions_remaining": None,
            "episode_memory_ready": self._episode_memory_ready,
            "observed_portal_count": len(self._seen_portals),
        }

    @staticmethod
    def _rect(frame: list[list[int]], y0: int, x0: int, h: int, w: int, color: int) -> None:
        for y in range(max(0, y0), min(FRAME, y0 + h)):
            for x in range(max(0, x0), min(FRAME, x0 + w)): frame[y][x] = color

    def _pixel_origin(self, cell: tuple[int, int]) -> tuple[int, int]:
        return BOARD_TOP + cell[0] * CELL, BOARD_LEFT + cell[1] * CELL

    def _portal_color(self, identity: str) -> int:
        pair_index = next((index for index, pair in enumerate(self._pairs()) if identity in pair), None)
        if pair_index is None:
            return C_DGREY
        if self._level.get("reveal_pairs"):
            return PAIR_COLORS[pair_index % len(PAIR_COLORS)]
        if self._level.get("reveal_extra_after_switch") and identity in {"E", "F", "G", "H"} and self._switch_state:
            return C_GREEN
        return C_MGREY

    def _draw_portal(self, frame: list[list[int]], identity: str, pulse: int | None = None) -> None:
        y, x = self._pixel_origin(self._portals[identity])
        color = self._portal_color(identity) if pulse is None else pulse
        self._rect(frame, y, x, CELL, CELL, color)
        mask = self._portal_mask(identity)
        for index, bit in enumerate(mask):
            frame[y + 1 + index // 2][x + 1 + index % 2] = C_WHITE if bit == "1" else C_BLACK
        orientation = str(self._level["orientations"][identity])
        notch = {"U": (y, x + 2), "D": (y + 3, x + 2), "L": (y + 2, x), "R": (y + 2, x + 3)}[orientation]
        frame[notch[0]][notch[1]] = C_CYAN

    def _draw_player(self, frame: list[list[int]], position: tuple[int, int], facing: str | None = None) -> None:
        y, x = self._pixel_origin(position)
        self._rect(frame, y + 1, x + 1, 2, 2, C_WHITE)
        nose = {"U": (y, x + 2), "D": (y + 3, x + 2), "L": (y + 2, x), "R": (y + 2, x + 3)}[facing or self._facing]
        frame[nose[0]][nose[1]] = C_CYAN

    def _draw_hud(self, frame: list[list[int]]) -> None:
        self._rect(frame, PLAY_HEIGHT, 0, FRAME - PLAY_HEIGHT, FRAME, C_VDGREY)
        for index in range(self.win_levels):
            color = C_GREEN if index < self.levels_completed else C_MGREY
            self._rect(frame, 61, 2 + index * 3, 2, 2, color)
        identities = sorted(self._portals)
        identity_left = 27 if len(identities) <= 4 else (20 if len(identities) <= 6 else 10)
        for index, identity in enumerate(identities):
            color = C_GREEN if identity in self._seen_portals else C_DGREY
            identity_x = identity_left + index * (6 if len(identities) <= 4 else 5)
            self._rect(frame, 56, identity_x, 4, 4, color)
            mask = self._portal_mask(identity)
            for bit_index, bit in enumerate(mask):
                frame[57 + bit_index // 2][identity_x + 1 + bit_index % 2] = C_WHITE if bit == "1" else C_BLACK
        if self._switches:
            self._rect(frame, 57, 52, 3, 7, C_GREEN if self._switch_state else C_MAGENTA)

    def _render_frame(
        self,
        player: tuple[int, int] | None | object = ...,
        player_facing: str | None = None,
        portal_pulse: dict[str, int] | None = None,
        exit_pulse: bool = False,
        switch_pulse: bool = False,
    ) -> list[list[int]]:
        frame = [[C_BLACK] * FRAME for _ in range(FRAME)]
        for y in range(self._height):
            for x in range(self._width):
                py, px = self._pixel_origin((y, x))
                if (y, x) in self._walls:
                    self._rect(frame, py, px, CELL, CELL, C_MGREY)
                    self._rect(frame, py + 1, px + 1, 2, 2, C_DGREY)
                else:
                    self._rect(frame, py, px, CELL, CELL, C_VDGREY)
                    self._rect(frame, py + 1, px + 1, 3, 3, C_BLACK)
        unlocked = self._exit_unlocked()
        ey, ex = self._pixel_origin(self._exit)
        self._rect(frame, ey, ex, CELL, CELL, C_WHITE if unlocked or exit_pulse else C_DGREY)
        self._rect(frame, ey + 1, ex + 1, 2, 2, C_YELLOW if unlocked else C_BLACK)
        for switch in self._switches:
            sy, sx = self._pixel_origin(switch)
            switch_color = C_WHITE if switch_pulse else (C_GREEN if self._switch_state else C_MAGENTA)
            self._rect(frame, sy, sx, CELL, CELL, switch_color)
            frame[sy + 1][sx + 1] = frame[sy + 2][sx + 2] = C_CYAN
            frame[sy + 1][sx + 2] = frame[sy + 2][sx + 1] = C_BLACK
        pulse = portal_pulse or {}
        for identity in sorted(self._portals):
            self._draw_portal(frame, identity, pulse.get(identity))
        visible_player = self._player if player is ... else player
        if visible_player is not None:
            self._draw_player(frame, visible_player, player_facing)
        self._draw_hud(frame)
        return frame
