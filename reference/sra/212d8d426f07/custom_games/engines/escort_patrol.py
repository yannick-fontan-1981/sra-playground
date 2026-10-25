"""ESCT: night-watch console — protect escort from free-roaming enemy kinds (RF9)."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

C_WHITE, C_LGREY, C_MGREY, C_DGREY, C_VDGREY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_PINK, C_RED, C_BLUE, C_CYAN = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_BROWN, C_GREEN, C_PURPLE = 11, 12, 13, 14, 15

FRAME, PLAY_H = 64, 57
ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE, ACTION_RESET = 5, 7
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "escort_patrol" / "levels"

MAP_Y0, MAP_X0 = 8, 6
CELL = 4
GAUGE_Y, GAUGE_X, GAUGE_H, GAUGE_W = 58, 29, 5, 34
EVENT_HOLD_FRAMES, RESET_HOLD_FRAMES = 8, 4

ENEMY_COLORS = {
    "slow": C_BROWN,
    "fast": C_RED,
    "follower": C_ORANGE,
    "predictor": C_PINK,
    "waiter": C_YELLOW,
}


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


def _load_levels() -> list[dict[str, Any]]:
    levels = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(LEVELS_DIR.glob("L*.json"))]
    if len(levels) != 6:
        raise ValueError(f"ESCT requires exactly six levels, found {len(levels)}")
    for i, level in enumerate(levels):
        for key in ("player", "escort", "exit", "rail", "enemies", "max_steps"):
            if key not in level:
                raise ValueError(f"ESCT L{i+1} missing {key}")
        if int(level["max_steps"]) <= 0:
            raise ValueError(f"ESCT L{i+1} needs a positive action budget")
        expect = 3 + i
        if len(level["enemies"]) != expect:
            raise ValueError(f"ESCT L{i+1} needs {expect} enemies, got {len(level['enemies'])}")
    return levels


class EscortPatrolEngine:
    """Protect a rail-seeking escort from free enemy hunters using placeable walls."""

    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_levels()
        self.win_levels = int(info.levels)
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._flash: str | None = None
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
        self._level = self._templates[index]
        self.level_steps = 0
        self._max_steps = int(self._level["max_steps"])
        self._height = int(self._level.get("height", 12))
        self._width = int(self._level.get("width", 12))
        # Single wall layer — all walls are removable by the cursor.
        self._walls = {tuple(map(int, c)) for c in self._level.get("walls", [])}
        self._rail = [tuple(map(int, c)) for c in self._level["rail"]]
        self._rail_set = set(self._rail)
        self._exit = tuple(map(int, self._level["exit"]))
        self._player = tuple(map(int, self._level["player"]))
        self._escort = tuple(map(int, self._level["escort"]))
        self._escort_progress = 0
        if self._escort in self._rail_set:
            self._escort_progress = self._rail.index(self._escort)
        self._guide_wall = next(
            (
                cell
                for cell in self._rail[self._escort_progress + 1 :]
                if cell in self._walls and cell != self._exit
            ),
            None,
        )
        self._enemies: list[dict[str, Any]] = []
        for raw in self._level["enemies"]:
            self._enemies.append(
                {
                    "kind": str(raw["kind"]),
                    "pos": tuple(map(int, raw["pos"])),
                    "period": int(raw.get("period", 1)),
                    "phase": int(raw.get("phase", 0)),
                    "aggro": int(raw.get("aggro", 4)),
                    "awake": bool(raw.get("awake", False)),
                    "caged": False,
                    "removed": False,
                }
            )
        morph = self._level.get("morphology") or {}
        self._col_player = int(morph.get("player", C_MAGENTA))
        self._col_escort = int(morph.get("escort", C_GREEN))
        self._flash = None
        self._announced_intentions: dict[str, Any] | None = None
        self._guide = index == 0
        self._tut = 0

    def _in_bounds(self, r: int, c: int) -> bool:
        return 0 <= r < self._height and 0 <= c < self._width

    def _blocked(self, cell: tuple[int, int]) -> bool:
        """Blocked for escort/enemies (not for the cursor)."""
        return (not self._in_bounds(*cell)) or cell in self._walls

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        if self.state == "WIN":
            return self.public_state()
        self._flash = None
        if aid in (ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT, ACTION_SPACE):
            self._announced_intentions = self._predict_autonomous_destinations()
        if aid in (ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT):
            return self._act_move(aid)
        if aid == ACTION_SPACE:
            return self._act_toggle_wall()
        return self.public_state()

    def _snapshot(self) -> dict[str, Any]:
        return {
            "player": self._player,
            "escort": self._escort,
            "enemies": [e["pos"] for e in self._enemies],
        }

    def _act_move(self, aid: int) -> dict[str, Any]:
        start = self._snapshot()
        before = self._render_frame()
        self.last_action = f"ACTION{aid}"
        self.step_index += 1
        self.level_steps += 1
        dr, dc = {
            ACTION_UP: (-1, 0),
            ACTION_DOWN: (1, 0),
            ACTION_LEFT: (0, -1),
            ACTION_RIGHT: (0, 1),
        }[aid]
        dest = (self._player[0] + dr, self._player[1] + dc)
        # Cursor walks through walls; only map bounds stop it.
        if not self._in_bounds(*dest):
            return self._after_tick(before, start)
        # The cursor is nonphysical: it may overlap the escort but never pushes it.
        self._player = dest
        if dest == self._escort and self._guide and self._tut == 0:
            self._tut = 1
        return self._after_tick(before, start)

    def _act_toggle_wall(self) -> dict[str, Any]:
        start = self._snapshot()
        before = self._render_frame()
        self.last_action = "ACTION5"
        self.step_index += 1
        self.level_steps += 1
        cell = self._player
        # Only the exit cell cannot be walled; hovering an enemy + SPACE cages it.
        if cell != self._exit:
            if cell in self._walls:
                self._walls.remove(cell)
                for enemy in self._enemies:
                    if enemy["pos"] == cell and enemy["caged"]:
                        enemy["removed"] = True
            else:
                self._walls.add(cell)
                for enemy in self._enemies:
                    if not enemy["removed"] and enemy["pos"] == cell:
                        enemy["caged"] = True
        if self._guide and self._tut <= 1:
            self._tut = 2
        return self._after_tick(before, start)

    def _enemy_at(self, cell: tuple[int, int]) -> int | None:
        for i, e in enumerate(self._enemies):
            if not e["removed"] and e["pos"] == cell:
                return i
        return None

    def _lerp_anim(self, start: dict[str, Any], end: dict[str, Any], t: float) -> dict[str, Any]:
        def mix(a: tuple[int, int], b: tuple[int, int]) -> tuple[float, float]:
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

        return {
            "player": mix(start["player"], end["player"]),
            "escort": mix(start["escort"], end["escort"]),
            "enemies": [
                mix(start["enemies"][i], end["enemies"][i]) for i in range(len(end["enemies"]))
            ],
        }

    def _reset_if_budget_exhausted(self, frames: list[list[list[int]]]) -> dict[str, Any] | None:
        if self.level_steps < self._max_steps:
            return None
        self._flash = "budget"
        frames.extend(self._render_frame() for _ in range(EVENT_HOLD_FRAMES))
        self._flash = None
        self._begin_level(self.levels_completed)
        frames.extend(self._render_frame() for _ in range(RESET_HOLD_FRAMES))
        self._pending_frames = frames
        return self.public_state()

    def _after_tick(self, before: list[list[int]], start: dict[str, Any]) -> dict[str, Any]:
        frames: list[list[list[int]]] = [before]

        def _fail_contact() -> dict[str, Any]:
            self._flash = "bad"
            frames.extend(self._render_frame() for _ in range(EVENT_HOLD_FRAMES))
            self._flash = None
            self._begin_level(self.levels_completed)
            frames.extend(self._render_frame() for _ in range(RESET_HOLD_FRAMES))
            self._pending_frames = frames
            return self.public_state()

        # Contact already true after the player move (before world step).
        if self._enemy_at(self._escort) is not None:
            return _fail_contact()

        # Autonomous elements execute the intentions announced before player input.
        self._apply_announced_intentions()
        end = self._snapshot()

        # 3 interpolation frames between pre-action and post-tick poses.
        for t in (0.25, 0.5, 0.75):
            frames.append(self._render_frame(anim=self._lerp_anim(start, end, t)))
        frames.append(self._render_frame())

        if self._enemy_at(self._escort) is not None:
            return _fail_contact()

        if self._escort == self._exit:
            frames.extend(self._render_frame(win=True) for _ in range(EVENT_HOLD_FRAMES))
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
            else:
                self._begin_level(self.levels_completed)
                frames.extend(self._render_frame() for _ in range(RESET_HOLD_FRAMES))
            self._pending_frames = frames
            return self.public_state()
        exhausted = self._reset_if_budget_exhausted(frames)
        if exhausted is not None:
            return exhausted
        self._pending_frames = frames
        return self.public_state()

    def _grace_ticks(self) -> int:
        # Enemy-only preparation window; the green escort already moves.
        return int(self._level.get("enemy_grace", 2))

    def _in_grace(self) -> bool:
        return self.level_steps <= self._grace_ticks()

    def _apply_announced_intentions(self) -> None:
        intentions = self._announced_intentions or self._predict_autonomous_destinations()
        escort_destination = intentions["escort"]
        if (
            self._escort not in self._walls
            and intentions["escort_moves"]
            and escort_destination not in self._walls
        ):
            self._escort = intentions["escort"]
        if self._escort in self._rail_set:
            self._escort_progress = max(self._escort_progress, self._rail.index(self._escort))
        for i, e in enumerate(self._enemies):
            if e["removed"] or e["pos"] in self._walls:
                continue
            e["phase"] = intentions["enemy_phases"][i]
            e["awake"] = intentions["enemy_awake"][i]
            enemy_destination = intentions["enemies"][i]
            if enemy_destination in self._walls:
                continue
            e["pos"] = enemy_destination
            if e["pos"] in self._walls:
                e["caged"] = True
        self._announced_intentions = None

    def _next_escort_target(self) -> tuple[int, int] | None:
        """Immediate ordered rail preference; runtime BFS may skip it when unreachable."""
        if self._escort == self._exit:
            return self._exit
        if self._escort in self._rail_set:
            self._escort_progress = max(self._escort_progress, self._rail.index(self._escort))
        nxt_i = self._escort_progress + 1
        if nxt_i < len(self._rail):
            return self._rail[nxt_i]
        return self._exit

    def _greedy_step(
        self,
        start: tuple[int, int],
        goal: tuple[int, int],
        *,
        forbid: set[tuple[int, int]] | None = None,
        enemy: bool = False,
        rail_goal: tuple[int, int] | None = None,
    ) -> tuple[int, int] | None:
        forbid = forbid or set()
        if start == goal:
            return None
        best = None
        # A hunter that has completed a rail interception must be able to leave
        # the lane before aiming at its next tactical point. Otherwise one
        # successful block would become a permanent, unsolvable occupation.
        best_d = (
            self._height + self._width + 1
            if enemy and start in self._rail_set
            else abs(start[0] - goal[0]) + abs(start[1] - goal[1])
        )
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nxt = (start[0] + dr, start[1] + dc)
            if self._blocked(nxt) or nxt in forbid:
                continue
            # Hunters cannot use the rail as a corridor. A hunter whose declared
            # tactic targets one rail cell may enter that exact cell, but never
            # the exit (future tactical targets exclude it).
            if enemy and nxt in self._rail_set:
                allowed_rail = rail_goal if rail_goal is not None else self._escort
                if nxt != allowed_rail:
                    continue
            d = abs(nxt[0] - goal[0]) + abs(nxt[1] - goal[1])
            if d < best_d:
                best_d = d
                best = nxt
        return best

    def _bfs_step(
        self,
        start: tuple[int, int],
        goal: tuple[int, int],
        *,
        forbid: set[tuple[int, int]] | None = None,
    ) -> tuple[int, int] | None:
        """First step of an exact shortest path, or None when no route exists."""
        forbid = forbid or set()
        if start == goal:
            return None
        if self._blocked(goal) or goal in forbid or self._enemy_at(goal) is not None:
            return None
        q: deque[tuple[int, int]] = deque([start])
        prev: dict[tuple[int, int], tuple[int, int] | None] = {start: None}
        found = False
        while q:
            cur = q.popleft()
            if cur == goal:
                found = True
                break
            neighbors = [
                (cur[0] + dr, cur[1] + dc)
                for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1))
            ]
            # Preserve shortest-path semantics while preferring rail cells when
            # several equally short continuations exist.
            neighbors.sort(key=lambda cell: cell not in self._rail_set)
            for nxt in neighbors:
                if nxt in prev or self._blocked(nxt) or nxt in forbid:
                    continue
                if self._enemy_at(nxt) is not None:
                    continue
                prev[nxt] = cur
                q.append(nxt)
        if not found:
            return None
        # Walk back to the step after start.
        cur = goal
        while prev[cur] is not None and prev[cur] != start:
            cur = prev[cur]
        return cur if prev.get(cur) == start else None

    def _escort_bfs_step(self, start: tuple[int, int], progress: int) -> tuple[int, int] | None:
        """Prefer ordered future rail goals, then fall back to the reachable exit."""
        for rail_goal in self._rail[progress + 1 :]:
            if rail_goal == self._exit:
                continue
            step = self._bfs_step(start, rail_goal)
            if step is not None:
                return step
        return self._bfs_step(start, self._exit)

    def _cell_origin(self, r: float, c: float) -> tuple[int, int]:
        return int(MAP_Y0 + r * CELL), int(MAP_X0 + c * CELL)

    def _future_escort_rail_cells(self, limit: int = 6) -> list[tuple[int, tuple[int, int]]]:
        progress = self._escort_progress
        if self._escort in self._rail_set:
            progress = max(progress, self._rail.index(self._escort))
        result: list[tuple[int, tuple[int, int]]] = []
        for offset, cell in enumerate(self._rail[progress + 1 : progress + 1 + limit], start=1):
            if cell != self._exit:
                result.append((offset, cell))
        return result

    def _enemy_shortest_path(
        self,
        start: tuple[int, int],
        goal: tuple[int, int],
        occupied: set[tuple[int, int]],
    ) -> list[tuple[int, int]] | None:
        if start == goal:
            return []
        if goal in self._walls or goal in occupied:
            return None
        queue: deque[tuple[int, int]] = deque([start])
        previous: dict[tuple[int, int], tuple[int, int] | None] = {start: None}
        while queue and goal not in previous:
            row, col = queue.popleft()
            for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nxt = (row + dr, col + dc)
                if nxt in previous or self._blocked(nxt) or nxt in occupied:
                    continue
                if nxt in self._rail_set and nxt != goal:
                    continue
                previous[nxt] = (row, col)
                queue.append(nxt)
        if goal not in previous:
            return None
        path: list[tuple[int, int]] = []
        current = goal
        while current != start:
            path.append(current)
            parent = previous[current]
            if parent is None:
                return None
            current = parent
        path.reverse()
        return path

    def _predict_autonomous_destinations(self) -> dict[str, Any]:
        enemy_positions = [e["pos"] for e in self._enemies]
        escort = self._escort
        progress = self._escort_progress

        if escort in self._rail_set:
            progress = max(progress, self._rail.index(escort))
        step = self._escort_bfs_step(escort, progress)
        if step is not None:
            escort = step
            if escort in self._rail_set:
                progress = max(progress, self._rail.index(escort))

        predicted = list(enemy_positions)
        phases = [e["phase"] for e in self._enemies]
        awake_states = [e["awake"] for e in self._enemies]
        enemy_targets = [self._escort for _ in self._enemies]
        if self.level_steps + 1 <= self._grace_ticks():
            return {
                "escort": escort,
                "escort_moves": escort != self._escort,
                "enemies": enemy_positions,
                "enemy_phases": phases,
                "enemy_awake": awake_states,
                "enemy_targets": enemy_targets,
            }
        future_rail = self._future_escort_rail_cells()
        for i, e in enumerate(self._enemies):
            if e["removed"] or predicted[i] in self._walls:
                continue
            if e["kind"] == "waiter":
                awake_states[i] = True
            phase = (e["phase"] + 1) % max(1, e["period"])
            phases[i] = phase
            if phase != 0:
                continue
            occupied = {
                position
                for j, position in enumerate(predicted)
                if j != i and not self._enemies[j]["removed"]
            }
            enemy_target = self._escort
            if e["kind"] == "slow":
                blockers: list[tuple[int, int, int, tuple[int, int]]] = []
                for eta, cell in future_rail:
                    if cell == predicted[i]:
                        continue
                    path = self._enemy_shortest_path(predicted[i], cell, occupied)
                    estimate = (
                        len(path)
                        if path is not None
                        else abs(predicted[i][0] - cell[0]) + abs(predicted[i][1] - cell[1])
                    )
                    blockers.append((path is None, estimate, eta, cell))
                if blockers:
                    enemy_target = min(blockers)[3]
            elif e["kind"] == "waiter":
                interceptions: list[tuple[int, int, int, tuple[int, int]]] = []
                for eta, cell in future_rail:
                    if cell == predicted[i]:
                        continue
                    path = self._enemy_shortest_path(predicted[i], cell, occupied)
                    distance = (
                        len(path)
                        if path is not None
                        else abs(predicted[i][0] - cell[0]) + abs(predicted[i][1] - cell[1])
                    )
                    arrival = 0 if distance == 0 else 1 + (distance - 1) * e["period"]
                    lateness = max(0, arrival - eta)
                    interceptions.append((lateness, eta, arrival, cell))
                if interceptions:
                    enemy_target = min(interceptions)[3]
            elif e["kind"] == "predictor" and future_rail:
                enemy_target = next(
                    (cell for _, cell in future_rail if cell != predicted[i]),
                    self._escort,
                )
            enemy_targets[i] = enemy_target
            move_count = 2 if e["kind"] == "fast" else 1
            for _ in range(move_count):
                occupied = {
                    position
                    for j, position in enumerate(predicted)
                    if j != i and not self._enemies[j]["removed"]
                }
                step = self._greedy_step(
                    predicted[i],
                    enemy_target,
                    forbid=occupied,
                    enemy=True,
                    rail_goal=enemy_target if enemy_target != self._exit else None,
                )
                if step is None:
                    break
                predicted[i] = step
                if predicted[i] == self._escort:
                    break
        return {
            "escort": escort,
            "escort_moves": escort != self._escort,
            "enemies": predicted,
            "enemy_phases": phases,
            "enemy_awake": awake_states,
            "enemy_targets": enemy_targets,
        }

    def _draw_pre_action_destination_pixels(self, frame: list[list[int]]) -> None:
        destinations = self._predict_autonomous_destinations()
        if destinations["escort"] != self._escort:
            y, x = self._cell_origin(*destinations["escort"])
            frame[y + 1][x + 1] = self._col_escort
        for enemy, destination in zip(self._enemies, destinations["enemies"], strict=True):
            if enemy["removed"] or destination == enemy["pos"]:
                continue
            y, x = self._cell_origin(*destination)
            frame[y + 2][x + 2] = ENEMY_COLORS.get(enemy["kind"], C_ORANGE)

    def _render_frame(
        self,
        *,
        win: bool = False,
        anim: dict[str, Any] | None = None,
    ) -> list[list[int]]:
        frame = [[C_BLACK for _ in range(FRAME)] for _ in range(FRAME)]
        _border(frame, 0, 0, PLAY_H, FRAME, C_CYAN)
        for i in range(self.win_levels):
            color = C_GREEN if i < self.levels_completed else (C_CYAN if i == self.levels_completed else C_DGREY)
            _fill(frame, 2, 3 + i * 4, 2, 2, color)

        for i, e in enumerate(self._enemies[:10]):
            _fill(frame, 2, 32 + i * 3, 2, 2, ENEMY_COLORS.get(e["kind"], C_ORANGE))

        map_h, map_w = self._height * CELL, self._width * CELL
        _fill(frame, MAP_Y0, MAP_X0, map_h, map_w, C_VDGREY)
        _border(frame, MAP_Y0 - 1, MAP_X0 - 1, map_h + 2, map_w + 2, C_MGREY)

        for r, c in self._walls:
            y, x = self._cell_origin(r, c)
            _fill(frame, y, x, CELL, CELL, C_DGREY)

        for r, c in self._rail:
            if (r, c) in self._walls:
                continue
            y, x = self._cell_origin(r, c)
            _fill(frame, y + 1, x + 1, CELL - 2, CELL - 2, C_BLACK)

        ey, ex = self._cell_origin(*self._exit)
        _border(frame, ey, ex, CELL, CELL, C_GREEN)

        player_pos = anim["player"] if anim else self._player
        escort_pos = anim["escort"] if anim else self._escort
        enemy_pos = anim["enemies"] if anim else [e["pos"] for e in self._enemies]

        for i, e in enumerate(self._enemies):
            if e["removed"]:
                continue
            y, x = self._cell_origin(*enemy_pos[i])
            _fill(frame, y + 1, x + 1, 3, 3, ENEMY_COLORS.get(e["kind"], C_ORANGE))

        sy, sx = self._cell_origin(*escort_pos)
        _fill(frame, sy + 1, sx + 1, 3, 3, self._col_escort)

        # Hollow cursor: outer ring only — true hole in the middle.
        py, px = self._cell_origin(*player_pos)
        _border(frame, py, px, CELL, CELL, self._col_player)

        if anim is None and not win and self.state != "WIN":
            self._draw_pre_action_destination_pixels(frame)

        if self._guide and self._guide_wall in self._walls:
            wy, wx = self._cell_origin(*self._guide_wall)
            _border(frame, wy - 1, wx - 1, CELL + 2, CELL + 2, C_WHITE)

        if self._flash == "bad":
            _border(frame, MAP_Y0 - 1, MAP_X0 - 1, map_h + 2, map_w + 2, C_RED)
        if win:
            _border(frame, 0, 0, FRAME, FRAME, C_GREEN)

        _fill(frame, PLAY_H, 0, FRAME - PLAY_H, FRAME, C_BLACK)
        for i in range(self.win_levels):
            color = C_GREEN if i < self.levels_completed else (C_CYAN if i == self.levels_completed else C_DGREY)
            _fill(frame, 59, 3 + i * 4, 2, 2, color)
        remaining = max(0, self._max_steps - self.level_steps)
        inner_width = GAUGE_W - 2
        filled_width = (remaining * inner_width + self._max_steps - 1) // self._max_steps
        gauge_border = C_RED if self._flash == "budget" else C_LGREY
        _border(frame, GAUGE_Y, GAUGE_X, GAUGE_H, GAUGE_W, gauge_border)
        _fill(frame, GAUGE_Y + 1, GAUGE_X + 1, GAUGE_H - 2, inner_width, C_DGREY)
        if filled_width:
            _fill(frame, GAUGE_Y + 1, GAUGE_X + 1, GAUGE_H - 2, filled_width, C_CYAN)
        return frame

    def public_state(self) -> dict[str, Any]:
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
        else:
            frames = [self._render_frame()]
        available = ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "ACTION7"]
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
            "default_fps": max(int(self.info.default_fps), 14 if len(frames) > 2 else int(self.info.default_fps)),
            "state": self.state,
            "available_actions": available,
            "available_action_ids": [int(a.removeprefix("ACTION")) for a in available],
            "levels_completed": self.levels_completed,
            "win_levels": self.win_levels,
            "level_index": min(self.levels_completed, self.win_levels - 1),
            "level_name": str(self._level.get("name", "")),
            "step_index": self.step_index,
            "level_steps": self.level_steps,
            "action_budget": self._max_steps,
            "last_action": self.last_action,
            "actions_remaining": max(0, self._max_steps - self.level_steps),
            "guid": f"{self.info.game_id}:L{self.levels_completed + 1}:{self.step_index}",
            "player": list(self._player),
            "escort": list(self._escort),
            "enemies": [
                {
                    "kind": e["kind"],
                    "pos": list(e["pos"]),
                    "caged": bool(e["caged"] and not e["removed"]),
                    "removed": bool(e["removed"]),
                }
                for e in self._enemies
            ],
            "walls": [list(c) for c in sorted(self._walls)],
        }
