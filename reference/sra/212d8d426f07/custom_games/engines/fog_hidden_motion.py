"""FOGW: infer motion that continues behind an opaque region.

Each arrow moves the receiver and advances time. A target is captured when it
emerges into a blue trap occupied by the receiver, which may arrive early and
wait. Targets remain simulated while hidden by fog.
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, NamedTuple

from custom_games.registry import CustomGameInfo

C_WHITE, C_LGREY, C_MGREY, C_DGREY, C_VDGREY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_PINK, C_RED, C_BLUE, C_CYAN = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_GREEN, C_PURPLE = 11, 12, 14, 15
FRAME, CELL, BOARD_TOP, BOARD_LEFT, PLAY_HEIGHT = 64, 4, 2, 6, 55
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "fog_hidden_motion" / "levels"
ACTION_DELTAS = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1)}
SHAPE_PIXELS = {
    "diamond": ((0, 1), (1, 0), (1, 1), (1, 2), (2, 1)),
    "square": ((0, 0), (0, 1), (1, 0), (1, 1)),
    "bar": ((0, 0), (1, 0), (2, 0)),
    "corner": ((0, 0), (1, 0), (1, 1)),
}
SHAPES = set(SHAPE_PIXELS)


class FogState(NamedTuple):
    player: tuple[int, int]
    tick: int
    route_mode: int
    lever: tuple[int, int] | None
    caught: frozenset[str]
    indices: tuple[int, ...]


def _route(raw: Any) -> tuple[tuple[int, int], ...]:
    return tuple((int(point[0]), int(point[1])) for point in raw)


def _load_levels() -> list[dict[str, Any]]:
    levels = [json.loads(path.read_text(encoding="utf-8")) for path in sorted(LEVELS_DIR.glob("L*.json"))]
    if len(levels) != 6:
        raise ValueError("FOGW requires exactly six levels")
    for level in levels:
        rows = [str(row) for row in level.get("rows", [])]
        if len(rows) != 13 or {len(row) for row in rows} != {13}:
            raise ValueError(f"FOGW level {level.get('name')!r} must be a 13x13 grid")
        flat = "".join(rows)
        if flat.count("@") != 1 or "~" not in flat or "b" not in flat:
            raise ValueError("FOGW levels require one receiver, fog, and capture bays")
        identities: set[str] = set()
        for obj in level.get("objects", []):
            identity = str(obj["id"])
            if identity in identities or str(obj.get("shape")) not in SHAPES:
                raise ValueError("FOGW objects require unique ids and known shapes")
            identities.add(identity)
            if obj.get("hazard") and obj.get("required", True):
                raise ValueError("FOGW hazards cannot be required targets")
            routes = obj.get("routes_by_profile", [])
            if len(routes) != 2 or any(len(route) < 4 for route in routes):
                raise ValueError("FOGW objects require two bounded episode routes")
            alternates = obj.get("alternate_routes_by_profile")
            if alternates and (len(alternates) != 2 or any(len(a) != len(r) for a, r in zip(alternates, routes))):
                raise ValueError("alternate routes must match their base route lengths")
            for route in [*routes, *(alternates or [])]:
                for y, x in _route(route):
                    if not (0 <= y < 13 and 0 <= x < 13):
                        raise ValueError("FOGW route point outside grid")
    return levels


class FogHiddenMotionEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_levels()
        self.win_levels = int(info.levels)
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._episode_profile = 0
        self._episode_memory_ready = False
        self._pending_frames: list[list[list[int]]] | None = None
        self._begin_level(0)

    def reset(self) -> dict[str, Any]:
        self._episode_profile = (self._episode_profile + 1) % 2
        self._episode_memory_ready = False
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._pending_frames = None
        self._begin_level(0)
        return self.public_state()

    def _begin_level(self, index: int) -> None:
        self._level = deepcopy(self._templates[index])
        rows = [str(row) for row in self._level["rows"]]
        self._walls: set[tuple[int, int]] = set()
        self._fog: set[tuple[int, int]] = set()
        self._bays: set[tuple[int, int]] = set()
        self._switches: set[tuple[int, int]] = set()
        for y, row in enumerate(rows):
            for x, cell in enumerate(row):
                if cell == "#": self._walls.add((y, x))
                elif cell == "~": self._fog.add((y, x))
                elif cell == "b": self._bays.add((y, x))
                elif cell == "!": self._switches.add((y, x))
                elif cell == "@": self._player_start = (y, x)
        self._objects = tuple(self._level["objects"])
        starts = tuple(self._profile_value(obj, "start_by_profile", 0) for obj in self._objects)
        self._initial_state = FogState(self._player_start, 0, 0, next(iter(self._switches), None), frozenset(), starts)
        self._game_state = self._initial_state
        self.level_steps = 0
        self.state = "NOT_FINISHED"

    def _profile_value(self, obj: dict[str, Any], field: str, default: Any) -> Any:
        values = obj.get(field)
        return values[self._episode_profile] if isinstance(values, list) else obj.get(field, default)

    def _routes(self, obj: dict[str, Any], route_mode: int) -> tuple[tuple[int, int], ...]:
        field = "alternate_routes_by_profile" if route_mode and obj.get("alternate_routes_by_profile") else "routes_by_profile"
        return _route(obj[field][self._episode_profile])

    def _object_position(self, object_index: int, state: FogState | None = None) -> tuple[int, int]:
        return self._object_positions(object_index, state)[0]

    def _object_positions(self, object_index: int, state: FogState | None = None) -> tuple[tuple[int, int], ...]:
        current = state or self._game_state
        obj = self._objects[object_index]
        route = self._routes(obj, current.route_mode)
        base_index = current.indices[object_index]
        if not obj.get("hazard"):
            return (route[base_index],)
        wagon_count = 3 if len(route) >= 6 else 2
        offsets = tuple(index * len(route) // wagon_count for index in range(wagon_count))
        return tuple(route[(base_index + offset) % len(route)] for offset in offsets)

    def _required(self) -> set[str]:
        return {str(obj["id"]) for obj in self._objects if obj.get("required", True)}

    def _complete(self, state: FogState) -> bool:
        memory_ok = not self._level.get("requires_episode_memory") or self._episode_memory_ready
        return self._required() <= set(state.caught) and memory_ok

    def _capture_arrivals(self, route_mode: int) -> set[tuple[int, int]]:
        return {
            self._routes(obj, route_mode)[-1]
            for obj in self._objects
            if obj.get("required", True)
            and self._routes(obj, route_mode)[-1] in self._bays
        }

    def _dangerous_slots(self, route_mode: int) -> set[tuple[int, int]]:
        capture_arrivals = self._capture_arrivals(route_mode)
        dangerous = set(self._bays) - capture_arrivals
        for obj in self._objects:
            route = self._routes(obj, route_mode)
            start_index = int(self._profile_value(obj, "start_by_profile", 0))
            dangerous.add(route[start_index])
            if route[-1] not in capture_arrivals:
                dangerous.add(route[-1])
        return dangerous

    def _transition(self, state: FogState, action_id: int) -> tuple[FogState, str]:
        dy, dx = ACTION_DELTAS[action_id]
        target = (state.player[0] + dy, state.player[1] + dx)
        moved = target not in self._walls
        player = target if moved else state.player
        tick = state.tick + 1
        mode, lever = state.route_mode, state.lever
        caught = set(state.caught)
        indices = list(state.indices)
        event = "move" if moved else "wait"
        if lever is not None and target == lever and moved:
            flee = (lever[0] + dy, lever[1] + dx)
            if flee not in self._walls and flee not in self._fog and flee not in self._bays:
                player, lever, event = lever, flee, "lever_flee"
            else:
                player, lever, mode, event = lever, None, 1, "rewrite"

        for object_index, obj in enumerate(self._objects):
            identity = str(obj["id"])
            if identity in caught:
                continue
            period = max(1, int(self._profile_value(obj, "period_by_profile", 1)))
            if tick % period:
                continue
            route = self._routes(obj, mode)
            next_index = indices[object_index] + 1
            start_index = int(self._profile_value(obj, "start_by_profile", 0))
            if next_index >= len(route):
                next_index = start_index
            indices[object_index] = next_index
            position = route[next_index]
            if obj.get("hazard"):
                continue
            if position not in self._bays:
                continue
            if player == position:
                if obj.get("required", True):
                    caught.add(identity)
                    event = "capture"
                else:
                    caught.clear()
                    indices = [int(self._profile_value(item, "start_by_profile", 0)) for item in self._objects]
                    event = "wrong_capture"
            else:
                indices[object_index] = start_index
                event = "miss"

        candidate = FogState(player, tick, mode, lever, frozenset(caught), tuple(indices))
        for object_index, obj in enumerate(self._objects):
            if obj.get("hazard") and player in self._object_positions(object_index, candidate):
                return self._initial_state, "hazard"
        if player in self._dangerous_slots(mode):
            return self._initial_state, "hazard"
        return candidate, event

    def _completion_frames(self, before: list[list[int]], solved: list[list[int]]) -> list[list[list[int]]]:
        pulse = self._render_frame(victory_pulse=True)
        frames = [before, solved, pulse, solved, pulse, solved, pulse, solved, pulse, solved]
        if self._level.get("writes_episode_memory"):
            self._episode_memory_ready = True
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
        state_before = self._game_state
        before = self._render_frame()
        dy, dx = ACTION_DELTAS[aid]
        attempted = (self._game_state.player[0] + dy, self._game_state.player[1] + dx)
        impact_cell = self._game_state.player if attempted in self._walls else attempted
        caught_before = set(self._game_state.caught)
        self._game_state, event = self._transition(self._game_state, aid)
        self.last_action = f"ACTION{aid}"
        self.step_index += 1
        self.level_steps += 1
        captured_identity = next(iter(set(self._game_state.caught) - caught_before), None)
        departed_slots: set[tuple[int, int]] = set()
        if event != "hazard":
            for index, obj in enumerate(self._objects):
                start_index = int(self._profile_value(obj, "start_by_profile", 0))
                if state_before.indices[index] == start_index and self._game_state.indices[index] != start_index:
                    departed_slots.add(self._routes(obj, state_before.route_mode)[start_index])
        after = self._render_frame()
        capture_frame = self._render_frame(
            active_bay=self._game_state.player if event == "capture" else None,
            capture_identity=captured_identity,
        )
        if event == "hazard":
            impact_red = self._hazard_impact(before, impact_cell, C_RED, C_WHITE)
            impact_white = self._hazard_impact(before, impact_cell, C_WHITE, C_RED)
            reset_red = self._tint(after, C_RED)
            frames = [
                before, self._tint(before, C_RED), impact_red, impact_white,
                impact_red, impact_white, reset_red, after, reset_red, after,
            ]
        elif event == "miss":
            arrival_pulse = self._render_frame(slot_pulse=self._capture_arrivals(self._game_state.route_mode))
            frames = [before, arrival_pulse, after, arrival_pulse, after]
        elif event == "wrong_capture":
            frames = [before, self._tint(after, C_RED), after]
        elif event == "capture":
            frames = [before, capture_frame, self._tint(capture_frame, C_WHITE), after]
        elif event == "rewrite":
            frames = [before, self._render_frame(lever_pulse=self._game_state.player, slot_pulse=departed_slots), after]
        elif departed_slots:
            departure_pulse = self._render_frame(slot_pulse=departed_slots)
            frames = [before, departure_pulse, after, departure_pulse, after]
        else:
            frames = [before, after]
        if self._complete(self._game_state):
            frames = self._completion_frames(before, capture_frame if captured_identity else after)
        self._pending_frames = frames
        return self.public_state()

    def public_state(self) -> dict[str, Any]:
        frames = self._pending_frames or [self._render_frame()]
        self._pending_frames = None
        available = [f"ACTION{aid}" for aid in ACTION_DELTAS] if self.state != "WIN" else []
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
            "level_name": self._level["name"], "stage": "hidden_motion",
            "level_steps": self.level_steps, "max_steps": None, "actions_remaining": None,
            "episode_memory_ready": self._episode_memory_ready,
            "hidden_object_count": sum(self._object_position(i) in self._fog for i in range(len(self._objects)) if str(self._objects[i]["id"]) not in self._game_state.caught),
            "caught_count": len(self._game_state.caught),
        }

    @staticmethod
    def _rect(frame: list[list[int]], y0: int, x0: int, height: int, width: int, color: int) -> None:
        for y in range(max(0, y0), min(FRAME, y0 + height)):
            for x in range(max(0, x0), min(FRAME, x0 + width)):
                frame[y][x] = color

    def _origin(self, cell: tuple[int, int]) -> tuple[int, int]:
        return BOARD_TOP + cell[0] * CELL, BOARD_LEFT + cell[1] * CELL

    def _draw_shape(self, frame: list[list[int]], cell: tuple[int, int], shape: str, color: int) -> None:
        y, x = self._origin(cell)
        for dy, dx in SHAPE_PIXELS[shape]:
            frame[y + dy][x + dx] = color

    def _object_color(self, obj: dict[str, Any]) -> int:
        return int(self._profile_value(obj, "colors_by_profile", C_YELLOW))

    def _render_frame(
        self,
        *,
        active_bay: tuple[int, int] | None = None,
        capture_identity: str | None = None,
        lever_pulse: tuple[int, int] | None = None,
        slot_pulse: set[tuple[int, int]] | None = None,
        victory_pulse: bool = False,
    ) -> list[list[int]]:
        frame = [[C_BLACK for _ in range(FRAME)] for _ in range(FRAME)]
        self._rect(frame, 0, 0, PLAY_HEIGHT, FRAME, C_VDGREY)
        for y in range(13):
            for x in range(13):
                py, px = self._origin((y, x))
                cell = (y, x)
                if cell in self._walls:
                    self._rect(frame, py, px, CELL, CELL, C_LGREY)
                    self._rect(frame, py + 1, px + 1, 2, 2, C_MGREY)
                elif cell in self._fog:
                    self._rect(frame, py, px, CELL, CELL, C_PURPLE)
                    frame[py + 1][px + (y + x) % 3] = C_MAGENTA
                    frame[py + 2][px + 3 - (y + x) % 3] = C_DGREY
                else:
                    self._rect(frame, py, px, CELL, CELL, C_BLACK)
                    frame[py][px] = C_VDGREY
        capture_arrivals = self._capture_arrivals(self._game_state.route_mode)
        pulsing_slots = slot_pulse or set()
        for bay in self._bays:
            y, x = self._origin(bay)
            color = C_WHITE if bay == active_bay or bay in pulsing_slots else C_BLUE if bay in capture_arrivals else C_RED
            if bay[1] < 6:
                for dy, dx in ((0,0),(1,0),(2,0),(3,0),(0,1),(0,2),(3,1),(3,2)):
                    frame[y + dy][x + dx] = color
            else:
                for dy, dx in ((0,3),(1,3),(2,3),(3,3),(0,1),(0,2),(3,1),(3,2)):
                    frame[y + dy][x + dx] = color
        for obj in self._objects:
            rail_color = C_ORANGE if obj.get("hazard") else C_DGREY
            route = self._routes(obj, self._game_state.route_mode)
            for index, point in enumerate(route):
                if point in self._fog or point in self._walls or point in self._bays:
                    continue
                y, x = self._origin(point)
                neighbours = route[max(0, index - 1):index] + route[index + 1:index + 2]
                vertical = any(other[1] == point[1] and other[0] != point[0] for other in neighbours)
                horizontal = any(other[0] == point[0] and other[1] != point[1] for other in neighbours)
                if vertical:
                    frame[y + 1][x + 1] = frame[y + 2][x + 1] = rail_color
                if horizontal or not vertical:
                    frame[y + 1][x + 1] = frame[y + 1][x + 2] = rail_color
        for endpoint in self._dangerous_slots(self._game_state.route_mode):
            if endpoint in self._walls or endpoint in self._bays:
                continue
            y, x = self._origin(endpoint)
            slot_color = C_WHITE if endpoint in pulsing_slots else C_RED
            for dy, dx in ((0,0),(0,1),(0,2),(0,3),(1,0),(1,3),(2,0),(2,3),(3,0),(3,1),(3,2),(3,3)):
                frame[y + dy][x + dx] = slot_color
        if self._game_state.lever is not None:
            y, x = self._origin(self._game_state.lever)
            self._rect(frame, y, x, CELL, CELL, C_MAGENTA)
            frame[y + 1][x + 1] = frame[y + 2][x + 2] = C_BLACK
        if lever_pulse is not None:
            y, x = self._origin(lever_pulse)
            self._rect(frame, y, x, CELL, CELL, C_WHITE)
            frame[y + 1][x + 1] = frame[y + 2][x + 2] = C_BLACK

        for object_index, obj in enumerate(self._objects):
            identity = str(obj["id"])
            if identity in self._game_state.caught and identity != capture_identity:
                continue
            start_index = int(self._profile_value(obj, "start_by_profile", 0))
            for position in self._object_positions(object_index):
                visible_start = obj.get("required", True) and self._game_state.indices[object_index] == start_index
                if position not in self._fog or visible_start:
                    self._draw_shape(frame, position, str(obj["shape"]), self._object_color(obj))

        if self._game_state.player not in self._fog:
            py, px = self._origin(self._game_state.player)
            object_under_cursor = any(
                str(obj["id"]) not in self._game_state.caught or str(obj["id"]) == capture_identity
                for index, obj in enumerate(self._objects)
                if self._game_state.player in self._object_positions(index)
            )
            player_color = C_WHITE if object_under_cursor or self._game_state.player in self._bays else C_CYAN
            for dy, dx in ((0,0),(0,3),(3,0),(3,3)):
                frame[py + dy][px + dx] = player_color

        self._rect(frame, PLAY_HEIGHT, 0, FRAME - PLAY_HEIGHT, FRAME, C_VDGREY)
        for index in range(self.win_levels):
            self._rect(frame, 61, 2 + index * 3, 2, 2, C_GREEN if index < self.levels_completed else C_MGREY)
        for index, obj in enumerate(obj for obj in self._objects if obj.get("required", True)):
            x = 24 + index * 7
            color = C_GREEN if str(obj["id"]) in self._game_state.caught else C_DGREY
            self._rect(frame, 57, x, 4, 4, color)
            self._draw_hud_shape(frame, 57, x, str(obj["shape"]), C_WHITE if color == C_GREEN else C_BLACK)
        for index in range(5):
            self._rect(frame, 57, 2 + index * 4, 2, 2, C_CYAN if index == self._game_state.tick % 5 else C_DGREY)
        self._rect(frame, 57, 57, 3, 4, C_GREEN if self._episode_memory_ready else C_MGREY)
        if victory_pulse:
            for y in range(PLAY_HEIGHT):
                for x in range(FRAME):
                    if frame[y][x] in {C_CYAN, C_BLUE, C_GREEN, C_YELLOW, C_MAGENTA, C_PURPLE}:
                        frame[y][x] = C_WHITE
        return frame

    @staticmethod
    def _draw_hud_shape(frame: list[list[int]], y: int, x: int, shape: str, color: int) -> None:
        for dy, dx in SHAPE_PIXELS[shape]:
            frame[y + dy][x + dx] = color

    @staticmethod
    def _tint(frame: list[list[int]], color: int) -> list[list[int]]:
        tinted = deepcopy(frame)
        for y in range(PLAY_HEIGHT):
            for x in range(FRAME):
                if tinted[y][x] not in {C_BLACK, C_VDGREY}:
                    tinted[y][x] = color
        return tinted

    def _hazard_impact(
        self,
        frame: list[list[int]],
        cell: tuple[int, int],
        outer: int,
        inner: int,
    ) -> list[list[int]]:
        impact = deepcopy(frame)
        y, x = self._origin(cell)
        self._rect(impact, y, x, CELL, CELL, outer)
        impact[y][x] = impact[y][x + 3] = inner
        impact[y + 3][x] = impact[y + 3][x + 3] = inner
        impact[y + 1][x + 1] = impact[y + 1][x + 2] = inner
        impact[y + 2][x + 1] = impact[y + 2][x + 2] = inner
        return impact
