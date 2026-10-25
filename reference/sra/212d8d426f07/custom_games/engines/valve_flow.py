"""VALV: finite water routing through reversible valves and activating tanks."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

C_WHITE, C_LGREY, C_MGREY, C_DGREY, C_VDGREY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_PINK, C_RED, C_BLUE, C_CYAN = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_GREEN, C_PURPLE = 11, 12, 14, 15
FRAME, PLAY_HEIGHT, ACTION_CLICK = 64, 57, 6
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "valve_flow" / "levels"


def _clone(frame: list[list[int]]) -> list[list[int]]:
    return [row[:] for row in frame]


def _route_cells(points: list[list[int]]) -> tuple[tuple[int, int], ...]:
    cells: list[tuple[int, int]] = []
    for (y0, x0), (y1, x1) in zip(points, points[1:]):
        if y0 == y1:
            cells.extend((y0, x) for x in range(min(x0, x1), max(x0, x1) + 1))
        elif x0 == x1:
            cells.extend((y, x0) for y in range(min(y0, y1), max(y0, y1) + 1))
        else:
            raise ValueError("VALV routes must be orthogonal")
    return tuple(dict.fromkeys(cells))


def _load_levels() -> list[dict[str, Any]]:
    levels = [json.loads(path.read_text(encoding="utf-8")) for path in sorted(LEVELS_DIR.glob("L*.json"))]
    if len(levels) != 6:
        raise ValueError("VALV requires exactly six levels")
    allowed = {"source", "reverse", "junction", "buffer", "profile_buffer", "tower", "target", "drain"}
    for level in levels:
        if int(level.get("water", 0)) < 0:
            raise ValueError("VALV source water cannot be negative")
        nodes = {str(node["id"]): node for node in level["nodes"]}
        if any(str(node["kind"]) not in allowed for node in nodes.values()):
            raise ValueError("VALV contains an unknown node kind")
        if sum(node["kind"] == "source" for node in nodes.values()) != 1:
            raise ValueError("VALV levels require exactly one pump")
        if not any(node["kind"] == "target" for node in nodes.values()):
            raise ValueError("VALV levels require target containers")
        for node in nodes.values():
            if node["kind"] in {"target", "buffer", "profile_buffer", "tower"} and int(node.get("goal", 0)) <= 0:
                raise ValueError("VALV gauges require positive goals")
        valves: set[str] = set()
        for edge in level["edges"]:
            a, b = str(edge["a"]), str(edge["b"])
            if a not in nodes or b not in nodes:
                raise ValueError("VALV edge references an unknown node")
            points = [[int(value) for value in point] for point in edge["route"]]
            endpoints = ((int(nodes[a]["y"]), int(nodes[a]["x"])), (int(nodes[b]["y"]), int(nodes[b]["x"])))
            if tuple(points[0]) != endpoints[0] or tuple(points[-1]) != endpoints[1]:
                raise ValueError("VALV route endpoints must match their nodes")
            cells = _route_cells(points)
            valve = edge.get("valve")
            if valve:
                valve_id = str(valve["id"])
                cell = (int(valve["y"]), int(valve["x"]))
                if valve_id in valves or cell not in cells:
                    raise ValueError("VALV valves must be unique and lie on their edge")
                valves.add(valve_id)
        if not set(level.get("initial_closed", [])).issubset(valves):
            raise ValueError("VALV initial_closed references an unknown valve")
        initial_fills = {str(key): int(value) for key, value in level.get("initial_fills", {}).items()}
        if int(level.get("water", 0)) + sum(initial_fills.values()) <= 0:
            raise ValueError("VALV levels require a finite positive water stock")
        for node_id, value in initial_fills.items():
            node = nodes.get(node_id)
            if node is None or node["kind"] not in {"target", "buffer", "profile_buffer", "tower"}:
                raise ValueError("VALV initial_fills references a non-container node")
            if value < 0 or value > int(node.get("goal", 0)):
                raise ValueError("VALV initial_fills must fit inside its container")
        profiles = level.get("profile_buffers")
        if profiles and (len(profiles) != 2 or any(nodes.get(str(item), {}).get("kind") != "profile_buffer" for item in profiles)):
            raise ValueError("VALV profile_buffers requires two potential reservoirs")
    return levels


class ValveFlowEngine:
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
        self._episode_profile = (self._episode_profile + 1) % 2
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
        self._nodes = {
            str(node["id"]): {
                "cell": (int(node["y"]), int(node["x"])), "kind": str(node["kind"]),
                "goal": int(node.get("goal", 0)), "required": bool(node.get("required", False)),
            }
            for node in self._level["nodes"]
        }
        self._edges: list[dict[str, Any]] = []
        self._valves: dict[str, tuple[int, int]] = {}
        for raw in self._level["edges"]:
            edge = {"a": str(raw["a"]), "b": str(raw["b"]), "cells": _route_cells(raw["route"]), "valve": None}
            if raw.get("valve"):
                valve = raw["valve"]
                edge["valve"] = str(valve["id"])
                self._valves[str(valve["id"])] = (int(valve["y"]), int(valve["x"]))
            self._edges.append(edge)
        self._closed = {str(value) for value in self._level.get("initial_closed", [])}
        initial_fills = {str(key): int(value) for key, value in self._level.get("initial_fills", {}).items()}
        self._fills = {
            node_id: initial_fills.get(node_id, 0) for node_id, node in self._nodes.items()
            if node["kind"] in {"target", "buffer", "profile_buffer", "tower"}
        }
        self._water_remaining = int(self._level["water"])
        self._water_capacity = self._water_remaining + sum(initial_fills.values())
        self._overflow = 0

    def _profile_buffer(self) -> str | None:
        profiles = self._level.get("profile_buffers")
        if not profiles:
            return None
        profile_index = (self._episode_profile + int(self._level.get("profile_offset", 0))) % len(profiles)
        return str(profiles[profile_index])

    def _actual_kind(self, node_id: str) -> str:
        kind = str(self._nodes[node_id]["kind"])
        if kind == "profile_buffer":
            return "buffer"
        return kind

    def _buffer_active(self, node_id: str) -> bool:
        return self._actual_kind(node_id) == "buffer" and self._fills[node_id] >= self._nodes[node_id]["goal"]

    def _container_can_overflow(self, node_id: str) -> bool:
        kind = str(self._nodes[node_id]["kind"])
        if kind in {"target", "tower"}:
            return True
        if kind == "profile_buffer":
            return node_id != self._profile_buffer()
        return False

    def _node_passes_flow(self, node_id: str) -> bool:
        kind = self._actual_kind(node_id)
        if kind == "buffer":
            if self._nodes[node_id]["kind"] == "profile_buffer" and node_id != self._profile_buffer():
                return False
            return self._buffer_active(node_id)
        return kind not in {"target", "drain", "tower"}

    def _flow(self) -> tuple[set[str], list[int], set[str], dict[str, int]]:
        sources = {node_id for node_id, node in self._nodes.items() if node["kind"] == "source"}
        reached, depths, traversed, sinks = set(sources), {node_id: 0 for node_id in sources}, [], set()
        frontier = list(sources)
        while frontier:
            node_id = frontier.pop(0)
            if not self._node_passes_flow(node_id):
                sinks.add(node_id)
                continue
            for index, edge in enumerate(self._edges):
                if edge["a"] != node_id or edge["valve"] in self._closed:
                    continue
                traversed.append(index)
                other = str(edge["b"])
                if other not in reached:
                    reached.add(other)
                    depths[other] = depths[node_id] + 1
                    frontier.append(other)
        return reached, list(dict.fromkeys(traversed)), sinks, depths

    def _terminal_sinks_from(self, start: str) -> tuple[set[str], list[int]]:
        reached, sinks, traversed, frontier = {start}, set(), [], [start]
        while frontier:
            node_id = frontier.pop(0)
            if node_id != start and not self._node_passes_flow(node_id):
                sinks.add(node_id)
                continue
            for index, edge in enumerate(self._edges):
                if edge["a"] != node_id or edge["valve"] in self._closed:
                    continue
                traversed.append(index)
                other = str(edge["b"])
                if other not in reached:
                    reached.add(other)
                    frontier.append(other)
        return sinks, list(dict.fromkeys(traversed))

    def _recoverable_nodes(self) -> set[str]:
        sources = {node_id for node_id, node in self._nodes.items() if node["kind"] == "source"}
        reached, frontier = set(sources), list(sources)
        while frontier:
            node_id = frontier.pop(0)
            for edge in self._edges:
                if edge["a"] != node_id or edge["valve"] in self._closed:
                    continue
                other = str(edge["b"])
                if other not in reached:
                    reached.add(other)
                    frontier.append(other)
        return {node_id for node_id in reached if self._fills.get(node_id, 0) > 0}

    def _deliver_unit(self, node_id: str, waste_nodes: set[str]) -> None:
        kind = self._actual_kind(node_id)
        if kind in {"buffer", "tower", "target"} and self._fills[node_id] < self._nodes[node_id]["goal"]:
            self._fills[node_id] += 1
            return
        self._overflow += 1
        waste_nodes.add(node_id)

    def _release_towers(self) -> tuple[set[str], set[str]]:
        waste_nodes: set[str] = set()
        burst_nodes: set[str] = set()
        configured = [str(node_id) for node_id in self._level.get("burst_order", [])]
        for _ in range(max(1, len(self._nodes) * 2)):
            released = False
            for tower_id, node in self._nodes.items():
                if node["kind"] != "tower" or self._fills[tower_id] < node["goal"]:
                    continue
                sinks, _ = self._terminal_sinks_from(tower_id)
                if not sinks:
                    continue
                volume = self._fills[tower_id]
                self._fills[tower_id] = 0
                burst_nodes.add(tower_id)
                order = [item for item in configured if item in sinks]
                order.extend(sorted(sinks - set(order)))
                cursor = 0
                for _unit in range(volume):
                    capable = [
                        item for item in order
                        if self._actual_kind(item) == "drain"
                        or (
                            self._actual_kind(item) in {"buffer", "tower", "target"}
                            and self._fills[item] < self._nodes[item]["goal"]
                        )
                    ]
                    if capable:
                        node_id = capable[cursor % len(capable)]
                        cursor += 1
                    else:
                        node_id = order[cursor % len(order)]
                        cursor += 1
                    self._deliver_unit(node_id, waste_nodes)
                released = True
            if not released:
                break
        return waste_nodes, burst_nodes

    def _targets_complete(self) -> bool:
        return all(
            self._fills[node_id] >= node["goal"]
            for node_id, node in self._nodes.items() if node["kind"] == "target"
        )

    def _minimum_required(self) -> int:
        required = sum(
            max(0, node["goal"] - self._fills[node_id])
            for node_id, node in self._nodes.items() if node["kind"] == "target"
        )
        for node_id, node in self._nodes.items():
            if self._actual_kind(node_id) == "buffer" and node["required"]:
                if node["kind"] == "profile_buffer" and node_id != self._profile_buffer():
                    continue
                required += max(0, node["goal"] - self._fills[node_id])
        return required

    def _valve_at(self, data: dict[str, Any]) -> str | None:
        x, y = int(data.get("x", -99)), int(data.get("y", -99))
        return next((valve for valve, (vy, vx) in self._valves.items() if abs(x - vx) <= 3 and abs(y - vy) <= 3), None)

    def _pump_at(self, data: dict[str, Any]) -> bool:
        x, y = int(data.get("x", -99)), int(data.get("y", -99))
        return any(
            node["kind"] == "source" and abs(x - node["cell"][1]) <= 5 and abs(y - node["cell"][0]) <= 4
            for node in self._nodes.values()
        )

    def _reverse_at(self, data: dict[str, Any]) -> bool:
        x, y = int(data.get("x", -99)), int(data.get("y", -99))
        return any(
            node["kind"] == "reverse" and abs(x - node["cell"][1]) <= 5 and abs(y - node["cell"][0]) <= 4
            for node in self._nodes.values()
        )

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        if int(action_id) == 7:
            return self.level_reset()
        if self.state == "WIN" or int(action_id) != ACTION_CLICK:
            return self.public_state()
        payload = data or {}
        valve = self._valve_at(payload)
        if valve is not None:
            return self._turn_valve(valve)
        if self._pump_at(payload):
            return self._pump()
        if self._reverse_at(payload):
            return self._reverse_pump()
        return self.public_state()

    def _turn_valve(self, valve: str) -> dict[str, Any]:
        before = self._render_frame()
        self.last_action = f"ACTION{ACTION_CLICK}"
        self.step_index += 1
        self.level_steps += 1
        if valve in self._closed:
            self._closed.remove(valve)
        else:
            self._closed.add(valve)
        fills_before_release = dict(self._fills)
        waste_nodes, burst_nodes = self._release_towers()
        after = self._render_frame(flash_valve=valve, burst_nodes=burst_nodes)
        tower_heights, target_heights = self._pre_release_fill_heights(fills_before_release, burst_nodes)
        held = self._render_frame(
            flash_valve=valve, burst_nodes=burst_nodes,
            tower_fill_heights=tower_heights, target_fill_heights=target_heights,
        )
        frames = [before, held]
        frames.extend(self._tower_drain_frames(fills_before_release, burst_nodes, flash_valve=valve))
        frames.extend([after, self._render_frame()])
        if waste_nodes:
            frames.extend(self._spill_frames(waste_nodes))
            self._begin_level(self.levels_completed)
            frames.append(self._render_frame())
            self._pending_frames = frames
        else:
            self._pending_frames = self._complete_level(frames) if self._targets_complete() else frames
        return self.public_state()

    def _pump(self) -> dict[str, Any]:
        before = self._render_frame()
        _, _, sinks, depths = self._flow()
        self.last_action = f"ACTION{ACTION_CLICK}"
        self.step_index += 1
        self.level_steps += 1
        if not sinks or self._water_remaining == 0:
            self._pending_frames = self._pulse(before, C_ORANGE, 6)
            return self.public_state()
        ordered_sinks = sorted(sinks)
        waste_nodes: set[str] = set()
        for node_id in ordered_sinks:
            if self._water_remaining == 0:
                break
            self._water_remaining -= 1
            self._deliver_unit(node_id, waste_nodes)
        fills_before_release = dict(self._fills)
        tower_waste, burst_nodes = self._release_towers()
        waste_nodes.update(tower_waste)
        phases = max(3, min(7, max(depths.values(), default=0) + 2))
        tower_heights, target_heights = self._pre_release_fill_heights(fills_before_release, burst_nodes)
        if burst_nodes:
            frames = [self._render_frame(
                flash_pump=True, burst_nodes=burst_nodes,
                tower_fill_heights=tower_heights, target_fill_heights=target_heights,
            )]
            frames.extend(self._render_frame(
                flow_phase=phase, burst_nodes=burst_nodes,
                tower_fill_heights=tower_heights, target_fill_heights=target_heights,
            ) for phase in range(phases))
        else:
            frames = [before, self._render_frame(flash_pump=True)]
            frames.extend(self._render_frame(flow_phase=phase) for phase in range(phases))
        frames.extend(self._tower_drain_frames(fills_before_release, burst_nodes))
        frames.append(self._render_frame(waste_nodes=waste_nodes, burst_nodes=burst_nodes))
        if waste_nodes:
            frames.extend(self._spill_frames(waste_nodes))
            self._begin_level(self.levels_completed)
            frames.append(self._render_frame())
            self._pending_frames = frames
        elif self._targets_complete():
            self._pending_frames = self._complete_level(frames)
        elif self._water_remaining == 0 and not self._recoverable_nodes():
            dead = self._render_frame(deadlock=True, waste_nodes=waste_nodes)
            for index in range(10):
                frames.append(self._red_tint(dead) if index % 2 == 0 else dead)
            self._begin_level(self.levels_completed)
            frames.append(self._render_frame())
            self._pending_frames = frames
        else:
            self._pending_frames = frames
        return self.public_state()

    def _reverse_pump(self) -> dict[str, Any]:
        before = self._render_frame()
        recoverable = sorted(self._recoverable_nodes())
        self.last_action = f"ACTION{ACTION_CLICK}"
        self.step_index += 1
        self.level_steps += 1
        if not recoverable:
            self._pending_frames = self._pulse(before, C_PURPLE, 6)
            return self.public_state()
        for node_id in recoverable:
            self._fills[node_id] -= 1
            self._water_remaining += 1
        frames = [before, self._render_frame(flash_reverse=True)]
        frames.extend(self._render_frame(reverse_phase=phase) for phase in range(6))
        frames.append(self._render_frame())
        self._pending_frames = frames
        return self.public_state()

    def _complete_level(self, frames: list[list[list[int]]]) -> list[list[list[int]]]:
        solved = self._render_frame()
        pulse = _clone(solved)
        for node in self._nodes.values():
            if node["kind"] == "target":
                y, x = node["cell"]
                self._hud_border(pulse, y - 5, x - 5, 11, 11, C_WHITE, limit=PLAY_HEIGHT)
        frames.extend([pulse, solved] * 5)
        if self.levels_completed == 0:
            self._episode_memory_ready = True
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            return frames
        self._begin_level(self.levels_completed)
        frames.append(self._render_frame())
        return frames

    def public_state(self) -> dict[str, Any]:
        frames = self._pending_frames or [self._render_frame()]
        self._pending_frames = None
        available = ["ACTION6", "ACTION7"] if self.state != "WIN" else ["ACTION7"]
        return {
            "backend": "custom", "selected": True, "game_id": self.info.game_id, "title": self.info.title,
            "frame": frames[-1], "frames": frames, "frame_count": len(frames),
            "default_fps": max(self.info.default_fps, 9 if len(frames) > 1 else self.info.default_fps),
            "state": self.state, "level": min(self.levels_completed + 1, self.win_levels),
            "levels_completed": self.levels_completed, "win_levels": self.win_levels,
            "step_index": self.step_index, "available_actions": available,
            "available_action_ids": [int(item.removeprefix("ACTION")) for item in available], "last_action": self.last_action,
            "score": self.levels_completed, "full_reset": False, "source_path": str(LEVELS_DIR),
            "custom_family": self.info.family, "level_name": self._level["name"], "stage": "finite_distribution",
            "level_steps": self.level_steps, "max_steps": None, "actions_remaining": None,
            "water_remaining": self._water_remaining, "water_initial": self._water_capacity,
            "stored_water": sum(self._fills.values()), "recoverable_water": sum(self._fills[node] for node in self._recoverable_nodes()),
            "overflow": self._overflow, "episode_memory_ready": self._episode_memory_ready,
        }

    def _render_frame(
        self, *, flow_phase: int | None = None, flash_valve: str | None = None,
        flash_pump: bool = False, flash_reverse: bool = False, reverse_phase: int | None = None,
        waste_nodes: set[str] | None = None, burst_nodes: set[str] | None = None,
        tower_fill_heights: dict[str, int] | None = None,
        target_fill_heights: dict[str, int] | None = None, deadlock: bool = False,
    ) -> list[list[int]]:
        frame = [[C_BLACK for _ in range(FRAME)] for _ in range(FRAME)]
        self._rect(frame, 1, 1, PLAY_HEIGHT - 2, FRAME - 2, C_VDGREY)
        _, traversed, _, depths = self._flow()
        flow_color = C_MAGENTA if int(self._level.get("palette", 0)) else C_CYAN
        for edge in self._edges:
            for y, x in edge["cells"]:
                if 0 <= y < PLAY_HEIGHT and 0 <= x < FRAME:
                    frame[y][x] = C_MGREY
        for index in traversed:
            edge = self._edges[index]
            depth = depths.get(str(edge["b"]), 99)
            if flow_phase is None or depth <= flow_phase:
                for y, x in edge["cells"]:
                    frame[y][x] = flow_color
        if reverse_phase is not None:
            for edge in self._edges:
                if edge["valve"] in self._closed:
                    continue
                for position, (y, x) in enumerate(edge["cells"]):
                    if (position + reverse_phase) % 3 != 0:
                        frame[y][x] = C_PURPLE
        waste_nodes = waste_nodes or set()
        burst_nodes = burst_nodes or set()
        for node_id, node in self._nodes.items():
            y, x = node["cell"]
            kind = str(node["kind"])
            if kind == "source":
                self._draw_pump(frame, y, x, C_WHITE if flash_pump else flow_color)
            elif kind == "reverse":
                self._draw_reverse_pump(frame, y, x, C_WHITE if flash_reverse else C_PURPLE)
            elif kind == "target":
                self._draw_gauge(
                    frame, y, x, self._fills[node_id], node["goal"], C_BLUE,
                    node_id in waste_nodes, (target_fill_heights or {}).get(node_id),
                )
            elif kind in {"buffer", "profile_buffer"}:
                active = self._buffer_active(node_id) and self._node_passes_flow(node_id)
                self._draw_buffer(
                    frame, y, x, self._fills[node_id], node["goal"], active,
                    node_id in waste_nodes, self._container_can_overflow(node_id),
                )
                if kind == "profile_buffer" and bool(self._level.get("reveal_profile")) and node_id != self._profile_buffer():
                    self._open_border(frame, y - 5, x - 5, 11, 11, C_ORANGE)
            elif kind == "tower":
                self._draw_tower(
                    frame, y, x, self._fills[node_id], node["goal"], node_id in burst_nodes,
                    node_id in waste_nodes, (tower_fill_heights or {}).get(node_id),
                )
            elif kind == "drain":
                self._draw_drain(frame, y, x, node_id in waste_nodes)
            else:
                self._rect(frame, y - 1, x - 1, 3, 3, flow_color)
        for valve, cell in self._valves.items():
            self._draw_valve(frame, cell[0], cell[1], valve in self._closed, flash=valve == flash_valve)
        if deadlock:
            self._hud_border(frame, 1, 1, PLAY_HEIGHT - 2, FRAME - 2, C_RED, limit=PLAY_HEIGHT)
        self._draw_hud(frame)
        return frame

    def _draw_pump(self, frame: list[list[int]], y: int, x: int, color: int) -> None:
        for dy, width in ((-4, 3), (-3, 7), (-2, 9), (-1, 9), (0, 11), (1, 9), (2, 9), (3, 7), (4, 3)):
            self._rect(frame, y + dy, x - width // 2, 1, width, color)
        self._rect(frame, y - 2, x - 2, 5, 5, C_BLACK)
        self._rect(frame, y - 1, x - 1, 3, 3, C_WHITE)

    def _draw_reverse_pump(self, frame: list[list[int]], y: int, x: int, color: int) -> None:
        for dy, width in ((-4, 3), (-3, 7), (-2, 9), (-1, 9), (0, 11), (1, 9), (2, 9), (3, 7), (4, 3)):
            self._rect(frame, y + dy, x - width // 2, 1, width, color)
        self._rect(frame, y - 2, x - 2, 5, 5, C_BLACK)
        for dy, dx in ((-1, -1), (0, 0), (1, 1), (-1, 1), (1, -1)):
            frame[y + dy][x + dx] = C_WHITE

    def _draw_gauge(
        self, frame: list[list[int]], y: int, x: int, fill: int, goal: int,
        color: int, waste: bool, fill_height: int | None = None,
    ) -> None:
        border = C_RED if waste else color
        self._rect(frame, y - 4, x - 4, 9, 9, C_DGREY)
        self._open_border(frame, y - 5, x - 5, 11, 11, border)
        height = round(9 * min(fill, goal) / goal) if fill_height is None else max(0, min(9, fill_height))
        if height:
            self._rect(frame, y + 5 - height, x - 4, height, 9, C_GREEN if fill >= goal else color)
        frame[y + 5][x] = C_WHITE

    def _draw_buffer(
        self, frame: list[list[int]], y: int, x: int, fill: int, goal: int,
        active: bool, waste: bool, can_overflow: bool,
    ) -> None:
        color = C_RED if waste else (C_CYAN if active else C_WHITE)
        for dy, width in ((-4, 5), (-3, 9), (-2, 11), (-1, 11), (0, 11), (1, 11), (2, 11), (3, 9), (4, 5)):
            self._rect(frame, y + dy, x - width // 2, 1, width, C_DGREY)
        if can_overflow:
            self._open_border(frame, y - 4, x - 4, 9, 9, color)
        else:
            self._hud_border(frame, y - 4, x - 4, 9, 9, color, limit=PLAY_HEIGHT)
        height = round(7 * min(fill, goal) / goal)
        if height:
            self._rect(frame, y + 4 - height, x - 3, height, 7, C_CYAN if active else C_YELLOW)
        if active:
            self._rect(frame, y - 1, x - 1, 3, 3, C_WHITE)

    def _draw_tower(
        self, frame: list[list[int]], y: int, x: int, fill: int, goal: int,
        burst: bool, waste: bool, fill_height: int | None = None,
    ) -> None:
        color = C_RED if waste else (C_WHITE if burst else C_ORANGE)
        self._rect(frame, y - 6, x - 5, 8, 11, C_DGREY)
        self._open_border(frame, y - 6, x - 5, 8, 11, color)
        height = round(6 * min(fill, goal) / goal) if fill_height is None else max(0, min(6, fill_height))
        if height:
            self._rect(frame, y + 1 - height, x - 4, height, 9, C_CYAN)
        for dy in range(2, 7):
            frame[y + dy][x - 3] = color
            frame[y + dy][x + 3] = color
        self._rect(frame, y + 6, x - 5, 1, 11, color)

    def _tower_drain_frames(
        self, fills_before_release: dict[str, int], burst_nodes: set[str], *, flash_valve: str | None = None,
    ) -> list[list[list[int]]]:
        draining = set(fills_before_release).intersection(burst_nodes)
        if not draining:
            return []
        frames: list[list[list[int]]] = []
        for phase in range(7):
            target_heights: dict[str, int] = {}
            for node_id, node in self._nodes.items():
                if node["kind"] != "target" or self._fills[node_id] == fills_before_release.get(node_id, 0):
                    continue
                before_height = round(9 * min(fills_before_release.get(node_id, 0), node["goal"]) / node["goal"])
                after_height = round(9 * min(self._fills[node_id], node["goal"]) / node["goal"])
                target_heights[node_id] = round(before_height + (after_height - before_height) * phase / 6)
            frames.append(self._render_frame(
                flash_valve=flash_valve if phase == 0 else None,
                burst_nodes=draining,
                tower_fill_heights={node_id: 6 - phase for node_id in draining},
                target_fill_heights=target_heights,
            ))
        return frames

    def _pre_release_fill_heights(
        self, fills_before_release: dict[str, int], burst_nodes: set[str],
    ) -> tuple[dict[str, int], dict[str, int]]:
        tower_heights = {node_id: 6 for node_id in burst_nodes}
        target_heights = {
            node_id: round(9 * min(fills_before_release.get(node_id, 0), node["goal"]) / node["goal"])
            for node_id, node in self._nodes.items()
            if node["kind"] == "target" and self._fills[node_id] != fills_before_release.get(node_id, 0)
        }
        return tower_heights, target_heights

    def _draw_drain(self, frame: list[list[int]], y: int, x: int, waste: bool) -> None:
        color = C_WHITE if waste else C_RED
        for offset in range(-4, 5, 2):
            self._rect(frame, y - 4, x + offset, 9, 1, color)
        self._hud_border(frame, y - 4, x - 5, 9, 11, color, limit=PLAY_HEIGHT)

    def _draw_valve(self, frame: list[list[int]], y: int, x: int, closed: bool, *, flash: bool) -> None:
        color = C_WHITE if flash else (C_RED if closed else C_GREEN)
        for dy, dx in ((-2, 0), (-1, -1), (-1, 1), (0, -2), (0, 2), (1, -1), (1, 1), (2, 0)):
            frame[y + dy][x + dx] = color
        if closed:
            for dx in range(-2, 3):
                frame[y][x + dx] = color
        else:
            for dy in range(-2, 3):
                frame[y + dy][x] = color
        frame[y][x] = C_BLACK

    def _draw_hud(self, frame: list[list[int]]) -> None:
        for index in range(self.win_levels):
            x0 = 1 + index * 6
            fill = C_GREEN if index < self.levels_completed or self.state == "WIN" else C_DGREY
            if index == self.levels_completed and self.state != "WIN":
                fill = C_CYAN
            self._hud_border(frame, 59, x0, 4, 5, C_MGREY)
            self._hud_rect(frame, 60, x0 + 1, 2, 3, fill)
        x0, width = 39, 23
        self._hud_border(frame, 59, x0, 4, width, C_WHITE)
        usable = width - 2
        filled = round(usable * self._water_remaining / self._water_capacity)
        self._hud_rect(frame, 60, x0 + 1, 2, filled, C_BLUE)

    def _open_border(self, frame: list[list[int]], y: int, x: int, height: int, width: int, color: int) -> None:
        self._rect(frame, y + 1, x, height - 1, 1, color)
        self._rect(frame, y + 1, x + width - 1, height - 1, 1, color)
        self._rect(frame, y + height - 1, x, 1, width, color)

    def _spill_frames(self, waste_nodes: set[str]) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        color = C_MAGENTA if int(self._level.get("palette", 0)) else C_CYAN
        for phase in range(14):
            frame = self._render_frame(waste_nodes=waste_nodes)
            for node_id in waste_nodes:
                if node_id not in self._nodes:
                    continue
                y, x = self._nodes[node_id]["cell"]
                top = max(1, y - 8)
                end = min(PLAY_HEIGHT - 1, top + round((PLAY_HEIGHT - top) * (phase + 1) / 14))
                self._rect(frame, top, x - 6, max(1, end - top + 1), 2, color)
                self._rect(frame, top, x + 5, max(1, end - top + 1), 2, color)
                self._rect(frame, top, x - 4, 2, 9, color)
                if phase > 2:
                    spread = min(12, phase)
                    self._rect(frame, min(end, PLAY_HEIGHT - 2), x - spread, 2, spread * 2 + 1, color)
                if end >= PLAY_HEIGHT - 2:
                    self._rect(frame, PLAY_HEIGHT - 2, max(1, x - phase * 2), 2, min(FRAME - 2, phase * 4 + 1), color)
            self._draw_hud(frame)
            frames.append(frame)
        return frames

    def _pulse(self, base: list[list[int]], color: int, count: int) -> list[list[list[int]]]:
        tinted = _clone(base)
        for y in range(PLAY_HEIGHT):
            for x in range(FRAME):
                if tinted[y][x] not in (C_BLACK, C_VDGREY):
                    tinted[y][x] = color
        frames = [base if index % 2 == 0 else tinted for index in range(count)]
        if not frames or frames[-1] is not base:
            frames.append(base)
        return frames

    @staticmethod
    def _red_tint(base: list[list[int]]) -> list[list[int]]:
        tinted = _clone(base)
        for y in range(PLAY_HEIGHT):
            for x in range(FRAME):
                if tinted[y][x] not in (C_BLACK, C_VDGREY):
                    tinted[y][x] = C_RED
        return tinted

    @staticmethod
    def _rect(frame: list[list[int]], y: int, x: int, h: int, w: int, color: int) -> None:
        for yy in range(max(0, y), min(PLAY_HEIGHT, y + h)):
            for xx in range(max(0, x), min(FRAME, x + w)):
                frame[yy][xx] = color

    @staticmethod
    def _hud_rect(frame: list[list[int]], y: int, x: int, h: int, w: int, color: int) -> None:
        for yy in range(max(0, y), min(FRAME, y + h)):
            for xx in range(max(0, x), min(FRAME, x + w)):
                frame[yy][xx] = color

    @staticmethod
    def _hud_border(frame: list[list[int]], y: int, x: int, h: int, w: int, color: int, *, limit: int = FRAME) -> None:
        for xx in range(x, x + w):
            if 0 <= y < limit and 0 <= xx < FRAME:
                frame[y][xx] = color
            if 0 <= y + h - 1 < limit and 0 <= xx < FRAME:
                frame[y + h - 1][xx] = color
        for yy in range(y, y + h):
            if 0 <= yy < limit and 0 <= x < FRAME:
                frame[yy][x] = color
            if 0 <= yy < limit and 0 <= x + w - 1 < FRAME:
                frame[yy][x + w - 1] = color
