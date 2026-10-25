"""LOGI: one visual language for increasingly dense abstract electronics.

Switches feed coloured, non-standard components. ACTION6 directly clicks a
switch. The level completes automatically when every lamp is lit.
"""

from __future__ import annotations

import json
from collections import deque
from copy import deepcopy
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

C_WHITE, C_LGREY, C_MGREY, C_DGREY, C_VDGREY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_RED, C_BLUE, C_CYAN = 6, 8, 9, 10
C_PINK, C_YELLOW, C_ORANGE, C_GREEN, C_PURPLE = 7, 11, 12, 14, 15
ACTION_CLICK = 6
FRAME, PLAY_HEIGHT = 64, 57
LAMP_TOP, LAMP_PORT_Y = 3, 8
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "logic_circuit" / "levels"

# Deliberately not conventional logic symbols: meaning comes from stable shape,
# colour, port count, and action-conditioned propagation.
GATE_MASKS: dict[str, tuple[str, ...]] = {
    "AND": ("11111", "10001", "10001", "11111"),
    "OR": ("11111", "11001", "10001", "11111"),
    "XOR": ("11111", "10101", "10001", "11111"),
    "NAND": ("11111", "10001", "11001", "11111"),
    "NOR": ("11111", "10001", "10101", "11111"),
    "XNOR": ("11111", "10101", "11001", "11111"),
    "MAJ": ("11111", "11001", "10101", "11111"),
    "ODD": ("11111", "10101", "10101", "11111"),
    "ONE": ("11111", "11001", "11001", "11111"),
    "ALL": ("11111", "11111", "10001", "11111"),
}
GATE_COLORS = {
    "AND": C_CYAN, "OR": C_ORANGE, "XOR": C_MAGENTA,
    "NAND": C_BLUE, "NOR": C_YELLOW, "XNOR": C_GREEN,
    "MAJ": C_RED, "ODD": C_PURPLE, "ONE": C_WHITE, "ALL": C_LGREY,
}
WIRE_PAIRS = (
    (C_RED, C_ORANGE),
    (C_BLUE, C_CYAN),
    (C_GREEN, C_YELLOW),
    (C_MAGENTA, C_PINK),
)
TERNARY_OPS = {"MAJ", "ODD", "ONE", "ALL"}


def _load_levels() -> list[dict[str, Any]]:
    levels = [json.loads(path.read_text(encoding="utf-8")) for path in sorted(LEVELS_DIR.glob("L*.json"))]
    if not levels:
        raise FileNotFoundError(f"no LOGI levels in {LEVELS_DIR}")
    for level in levels:
        count = int(level.get("switch_count", 0))
        if not 3 <= count <= 8:
            raise ValueError("LOGI switch_count must be between 3 and 8")
        known = {f"i{index}" for index in range(count)}
        for gate in level.get("gates", []):
            op = str(gate["op"])
            keys = ("a", "b", "c") if op in TERNARY_OPS else ("a", "b")
            refs = [str(gate[key]) for key in keys]
            if op not in GATE_MASKS or any(ref not in known for ref in refs):
                raise ValueError(f"invalid LOGI gate {gate!r}")
            known.add(str(gate["id"]))
        if not level.get("outputs") or any(str(ref) not in known for ref in level["outputs"]):
            raise ValueError("LOGI outputs must reference known nodes")
    return levels


def _gate_value(op: str, args: tuple[int, ...]) -> int:
    if op == "AND": return args[0] & args[1]
    if op == "OR": return args[0] | args[1]
    if op == "XOR": return args[0] ^ args[1]
    if op == "NAND": return 1 - (args[0] & args[1])
    if op == "NOR": return 1 - (args[0] | args[1])
    if op == "XNOR": return 1 - (args[0] ^ args[1])
    if op == "MAJ": return int(sum(args) >= 2)
    if op == "ODD": return sum(args) % 2
    if op == "ONE": return int(sum(args) == 1)
    if op == "ALL": return int(all(args))
    raise ValueError(f"unknown LOGI operation {op!r}")


def _evaluate(level: dict[str, Any], inputs: list[int] | tuple[int, ...]) -> tuple[dict[str, int], tuple[int, ...]]:
    values = {f"i{index}": int(value) for index, value in enumerate(inputs)}
    for gate in level.get("gates", []):
        op = str(gate["op"])
        keys = ("a", "b", "c") if op in TERNARY_OPS else ("a", "b")
        args = tuple(values[str(gate[key])] for key in keys)
        values[str(gate["id"])] = _gate_value(op, args)
    outputs = tuple(values[str(ref)] for ref in level["outputs"])
    return values, outputs


def _solutions(level: dict[str, Any]) -> list[tuple[int, ...]]:
    count = int(level["switch_count"])
    return [
        tuple((mask >> index) & 1 for index in range(count))
        for mask in range(1 << count)
        if all(_evaluate(level, tuple((mask >> index) & 1 for index in range(count)))[1])
    ]


class LogicCircuitEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_levels()
        self.win_levels = int(info.levels)
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._wrong_submissions = 0
        self._begin_level(0)

    def _begin_level(self, index: int) -> None:
        self._level = deepcopy(self._templates[index])
        self._inputs = [0] * int(self._level["switch_count"])
        self.level_steps = 0
        self._wrong_submissions = 0
        self.state = "NOT_FINISHED"

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

    def _flash(self, color: int) -> list[list[list[int]]]:
        before = self._render_frame()
        flash = deepcopy(before)
        for row in range(PLAY_HEIGHT):
            for col in range(FRAME):
                if flash[row][col] not in (C_BLACK, C_VDGREY): flash[row][col] = color
        return [before, flash, before]

    def _complete_level(self, before: list[list[int]], lit: list[list[int]]) -> list[list[list[int]]]:
        pulse = deepcopy(lit)
        for index in range(len(self._level["outputs"])):
            x = 10 + round(index * 44 / max(1, len(self._level["outputs"]) - 1))
            self._rect(pulse, LAMP_TOP + 1, x - 2, 3, 5, C_WHITE)
        # Ten visible transition frames: the solved circuit alternates with a
        # white lamp pulse, then settles lit before the next level appears.
        frames = [before, lit, pulse, lit, pulse, lit, pulse, lit, pulse, lit]
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            return frames
        self._begin_level(self.levels_completed)
        frames.append(self._render_frame())
        return frames

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        if self.state == "WIN": return self.public_state()
        aid = int(action_id)
        if aid != ACTION_CLICK: return self.public_state()
        payload = data or {}
        click_x, click_y = int(payload.get("x", -1)), int(payload.get("y", -1))
        switch_index = next((
            index
            for index in range(len(self._inputs))
            if abs(click_x - self._positions()[f"i{index}"][1]) <= 2
            and abs(click_y - self._positions()[f"i{index}"][0]) <= 2
        ), None)
        if switch_index is None: return self.public_state()
        self.last_action = f"ACTION{aid}"
        self.step_index += 1
        self.level_steps += 1
        before = self._render_frame()
        self._inputs[switch_index] ^= 1
        lit = self._render_frame()
        frames = self._complete_level(before, lit) if all(_evaluate(self._level, self._inputs)[1]) else [before, lit]
        self._pending_frames = frames
        return self.public_state()

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
            "available_action_ids": [int(action.removeprefix("ACTION")) for action in available],
            "last_action": self.last_action, "score": self.levels_completed,
            "full_reset": False, "source_path": str(LEVELS_DIR), "custom_family": self.info.family,
            "level_name": self._level["name"], "stage": "circuit",
            "level_steps": self.level_steps, "max_steps": None,
            "actions_remaining": None,
        }

    @staticmethod
    def _rect(frame: list[list[int]], y0: int, x0: int, h: int, w: int, color: int) -> None:
        for y in range(max(0, y0), min(PLAY_HEIGHT, y0 + h)):
            for x in range(max(0, x0), min(FRAME, x0 + w)): frame[y][x] = color

    @staticmethod
    def _border(frame: list[list[int]], y: int, x: int, h: int, w: int, color: int) -> None:
        for xx in range(x, x + w):
            if 0 <= y < PLAY_HEIGHT and 0 <= xx < FRAME: frame[y][xx] = color
            if 0 <= y + h - 1 < PLAY_HEIGHT and 0 <= xx < FRAME: frame[y + h - 1][xx] = color
        for yy in range(y, y + h):
            if 0 <= yy < PLAY_HEIGHT and 0 <= x < FRAME: frame[yy][x] = color
            if 0 <= yy < PLAY_HEIGHT and 0 <= x + w - 1 < FRAME: frame[yy][x + w - 1] = color

    @staticmethod
    def _line_cells(points: list[tuple[int, int]]) -> list[tuple[int, int]]:
        cells: list[tuple[int, int]] = []
        for (y0, x0), (y1, x1) in zip(points, points[1:]):
            if y0 == y1: cells.extend((y0, x) for x in range(min(x0, x1), max(x0, x1) + 1))
            elif x0 == x1: cells.extend((y, x0) for y in range(min(y0, y1), max(y0, y1) + 1))
            else: raise ValueError("LOGI routes must be orthogonal")
        return list(dict.fromkeys(cells))

    def _positions(self) -> dict[str, tuple[int, int]]:
        positions: dict[str, tuple[int, int]] = {}
        count = len(self._inputs)
        for index in range(count): positions[f"i{index}"] = (50, 5 + round(index * 44 / max(1, count - 1)))
        layers: dict[int, list[dict[str, Any]]] = {}
        for gate in self._level["gates"]: layers.setdefault(int(gate["layer"]), []).append(gate)
        for layer, gates in layers.items():
            rows = [gates] if len(gates) <= 6 else [gates[: (len(gates) + 1) // 2], gates[(len(gates) + 1) // 2 :]]
            base_y = max(13, 40 - layer * 10)
            for row_index, row_gates in enumerate(rows):
                y = base_y + 3 - row_index * 6 if len(rows) > 1 else base_y
                for index, gate in enumerate(row_gates):
                    positions[str(gate["id"])] = (y, 9 + round(index * 46 / max(1, len(row_gates) - 1)))
        return positions

    def _routing_obstacles(self, positions: dict[str, tuple[int, int]]) -> set[tuple[int, int]]:
        blocked: set[tuple[int, int]] = set()
        for gate in self._level["gates"]:
            y, x = positions[str(gate["id"])]
            blocked.update((yy, xx) for yy in range(y - 3, y + 3) for xx in range(x - 3, x + 4))
        for index in range(len(self._inputs)):
            y, x = positions[f"i{index}"]
            blocked.update((yy, xx) for yy in range(y - 3, y + 4) for xx in range(x - 3, x + 4))
        for index in range(len(self._level["outputs"])):
            x = 10 + round(index * 44 / max(1, len(self._level["outputs"]) - 1))
            blocked.update((yy, xx) for yy in range(LAMP_TOP - 1, LAMP_PORT_Y + 1) for xx in range(x - 4, x + 5))
        return blocked

    def _component_spacing_relief(self, positions: dict[str, tuple[int, int]]) -> set[tuple[int, int]]:
        return {
            (yy, xx)
            for gate in self._level["gates"]
            for y, x in (positions[str(gate["id"])],)
            for yy in range(y + 2, y + 5)
            for xx in range(x - 4, x + 5)
        }

    @staticmethod
    def _recolor_routes(
        routes: list[tuple[list[tuple[int, int]], int, str]],
    ) -> list[tuple[list[tuple[int, int]], int, str]]:
        cell_sets = [set(cells) for cells, _, _ in routes]
        crossings = [set() for _ in routes]
        proximity = [[0] * len(routes) for _ in routes]
        for first in range(len(routes)):
            for second in range(first + 1, len(routes)):
                if cell_sets[first] & cell_sets[second]:
                    crossings[first].add(second)
                    crossings[second].add(first)
                adjacent_pairs = sum(
                    (y + dy, x + dx) in cell_sets[second]
                    for y, x in cell_sets[first]
                    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                )
                proximity[first][second] = proximity[second][first] = adjacent_pairs

        colors: dict[int, int] = {}
        usage = [0] * len(WIRE_PAIRS)
        expansions = 0
        maximum_usage = (len(routes) + len(WIRE_PAIRS) - 1) // len(WIRE_PAIRS)
        best_score = 10**9
        best_colors: dict[int, int] | None = None

        def assign(score: int) -> None:
            nonlocal expansions, best_score, best_colors
            expansions += 1
            if expansions > 20000 or score >= best_score:
                return
            if len(colors) == len(routes):
                if max(usage) - min(usage) <= 1:
                    best_score, best_colors = score, dict(colors)
                return
            uncolored = [index for index in range(len(routes)) if index not in colors]
            vertex = max(
                uncolored,
                key=lambda index: (
                    len({colors[neighbour] for neighbour in crossings[index] if neighbour in colors}),
                    sum(proximity[index]),
                    len(crossings[index]),
                    -index,
                ),
            )
            forbidden = {colors[neighbour] for neighbour in crossings[vertex] if neighbour in colors}
            candidates = sorted(
                (
                    color
                    for color in range(len(WIRE_PAIRS))
                    if color not in forbidden and usage[color] < maximum_usage
                ),
                key=lambda color: (
                    sum(proximity[vertex][neighbour] for neighbour in colors if colors[neighbour] == color),
                    usage[color],
                    color,
                ),
            )
            if not colors:
                candidates = candidates[:1]
            for color in candidates:
                penalty = sum(
                    proximity[vertex][neighbour]
                    for neighbour in colors
                    if colors[neighbour] == color
                )
                colors[vertex] = color
                usage[color] += 1
                assign(score + penalty)
                usage[color] -= 1
                del colors[vertex]

        assign(0)
        if best_colors is None:
            raise ValueError("LOGI could not balance four wire families without identical-colour crossings")
        return [(cells, best_colors[index], ref) for index, (cells, _, ref) in enumerate(routes)]

    @staticmethod
    def _find_route(
        start: tuple[int, int],
        end: tuple[int, int],
        blocked: set[tuple[int, int]],
        placed: list[tuple[list[tuple[int, int]], int, str]],
        family: int,
        ref: str,
        spacing_relief: set[tuple[int, int]],
    ) -> list[tuple[int, int]] | None:
        foreign: dict[tuple[int, int], list[tuple[int, int, set[str]]]] = {}
        same_signal: set[tuple[int, int]] = set()
        forbidden_parallel_edges: set[frozenset[tuple[int, int]]] = set()
        for route_index, (cells, route_family, route_ref) in enumerate(placed):
            if route_ref == ref:
                same_signal.update(cells)
            for first, second in zip(cells, cells[1:]):
                if first[0] == second[0]:
                    for offset in (-1, 1):
                        forbidden_parallel_edges.add(frozenset(((first[0] + offset, first[1]), (second[0] + offset, second[1]))))
                else:
                    for offset in (-1, 1):
                        forbidden_parallel_edges.add(frozenset(((first[0], first[1] + offset), (second[0], second[1] + offset))))
            for index, cell in enumerate(cells):
                directions: set[str] = set()
                for neighbour in cells[max(0, index - 1) : index] + cells[index + 1 : index + 2]:
                    directions.add("h" if neighbour[0] == cell[0] else "v")
                foreign.setdefault(cell, []).append((route_index, route_family, directions))

        def neighbours(cell: tuple[int, int]) -> tuple[tuple[int, int], ...]:
            y, x = cell
            return ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1))

        def free(cell: tuple[int, int]) -> bool:
            return cell not in blocked and cell not in foreign

        start_state = (start, frozenset())
        queue = deque([start_state])
        previous: dict[
            tuple[tuple[int, int], frozenset[int]],
            tuple[tuple[tuple[int, int], frozenset[int]] | None, tuple[int, int] | None],
        ] = {start_state: (None, None)}
        while queue:
            state = queue.popleft()
            current, crossed_routes = state
            if current == end:
                path: list[tuple[int, int]] = []
                cursor: tuple[tuple[int, int], frozenset[int]] | None = state
                while cursor is not None:
                    parent, crossing = previous[cursor]
                    path.append(cursor[0])
                    if crossing is not None: path.append(crossing)
                    cursor = parent
                return path[::-1]
            y, x = current
            candidates = [(y - 1, x), (y, x - 1), (y, x + 1), (y + 1, x)]
            candidates.sort(key=lambda cell: abs(cell[0] - end[0]) + abs(cell[1] - end[1]))
            for nxt in candidates:
                if not (1 <= nxt[0] <= 54 and 2 <= nxt[1] <= 61): continue
                next_state = (nxt, crossed_routes)
                if next_state in previous or (nxt != end and not free(nxt)): continue
                if nxt == end and (nxt in blocked or nxt in foreign): continue
                if frozenset((current, nxt)) in forbidden_parallel_edges and not ({current, nxt} & spacing_relief): continue
                previous[next_state] = (state, None)
                queue.append(next_state)
            for dy, dx, direction in ((-1, 0, "v"), (1, 0, "v"), (0, -1, "h"), (0, 1, "h")):
                middle, landing = (y + dy, x + dx), (y + 2 * dy, x + 2 * dx)
                owners = foreign.get(middle)
                perpendicular = "h" if direction == "v" else "v"
                if not owners or middle in same_signal or any(
                    route_index in crossed_routes or owner_family == family or orientations != {perpendicular}
                    for route_index, owner_family, orientations in owners
                ):
                    continue
                new_crossings = crossed_routes | frozenset(route_index for route_index, _, _ in owners)
                landing_state = (landing, new_crossings)
                if landing_state in previous or landing in blocked or landing in foreign:
                    continue
                if not (1 <= landing[0] <= 54 and 2 <= landing[1] <= 61):
                    continue
                crossing_edges = (frozenset((current, middle)), frozenset((middle, landing)))
                if any(edge in forbidden_parallel_edges and not (set(edge) & spacing_relief) for edge in crossing_edges):
                    continue
                previous[landing_state] = (state, middle)
                queue.append(landing_state)
        return None

    def _routes(self, positions: dict[str, tuple[int, int]]) -> list[tuple[list[tuple[int, int]], int, str]]:
        destinations: list[tuple[tuple[int, int], str]] = []
        for gate in self._level["gates"]:
            op, target = str(gate["op"]), str(gate["id"])
            refs = [str(gate[key]) for key in (("a", "b", "c") if op in TERNARY_OPS else ("a", "b"))]
            ty, tx = positions[target]
            offsets = (-2, 2) if len(refs) == 2 else (-2, 0, 2)
            for port, ref in zip(offsets, refs):
                destinations.append(((ty + 2, tx + port), ref))
        for index, ref in enumerate(self._level["outputs"]):
            lamp_x = 10 + round(index * 44 / max(1, len(self._level["outputs"]) - 1))
            destinations.append(((LAMP_PORT_Y, lamp_x), str(ref)))

        # Fan-out wires leave through visibly separate ports. They never share
        # a coloured trunk that splits farther along the circuit.
        fanout: dict[str, list[int]] = {}
        for index, (_, ref) in enumerate(destinations):
            fanout.setdefault(ref, []).append(index)
        source_offsets: dict[int, int] = {}
        for ref, indices in fanout.items():
            if len(indices) > 3:
                raise ValueError(f"LOGI source {ref} has more than three outgoing wires")
            offsets = {1: (0,), 2: (-2, 2), 3: (-2, 0, 2)}[len(indices)]
            source_offsets.update(zip(indices, offsets))
        requests: list[tuple[tuple[int, int], tuple[int, int], str]] = []
        for index, (end, ref) in enumerate(destinations):
            sy, sx = positions[ref]
            requests.append(((sy - 3, sx + source_offsets[index]), end, ref))
        obstacles = self._routing_obstacles(positions)
        spacing_relief = self._component_spacing_relief(positions)
        ports = [point for start, end, _ in requests for point in (start, end)]
        relaxed = {(y, x) for y in range(1, 55) for x in range(2, 62)}

        def attempt(ordered: list[tuple[tuple[int, int], tuple[int, int], str]]) -> list[tuple[list[tuple[int, int]], int, str]] | None:
            routes: list[tuple[list[tuple[int, int]], int, str]] = []
            for index, (start, end, ref) in enumerate(ordered):
                reserved = {
                    cell
                    for port in ports
                    if port not in (start, end)
                    for cell in (port, (port[0] - 1, port[1]), (port[0] + 1, port[1]), (port[0], port[1] - 1), (port[0], port[1] + 1))
                }
                routed = False
                for allowed_spacing in (spacing_relief, relaxed):
                    for family in [(index + offset) % len(WIRE_PAIRS) for offset in range(len(WIRE_PAIRS))]:
                        path = self._find_route(
                            start, end, (obstacles | reserved) - {start, end}, routes, family, ref, allowed_spacing
                        )
                        if path is None: continue
                        routes.append((path, family, ref))
                        routed = True
                        break
                    if routed:
                        break
                if not routed:
                    return None
            return routes

        distance = lambda request: abs(request[0][0] - request[1][0]) + abs(request[0][1] - request[1][1])
        orders = (
            sorted(requests, key=distance),
            sorted(requests, key=lambda request: (request[1][0] != LAMP_PORT_Y, distance(request))),
            sorted(requests, key=lambda request: (-len(fanout[request[2]]), distance(request))),
        )
        for ordered in orders:
            routes = attempt(ordered)
            if routes is not None:
                return self._recolor_routes(routes)
        raise ValueError("LOGI could not route every wire around objects in three bounded orders")

    def _draw_gate(self, frame: list[list[int]], y: int, x: int, op: str) -> None:
        for dy, row in enumerate(GATE_MASKS[op]):
            for dx, bit in enumerate(row):
                if bit == "1": frame[y - 2 + dy][x - 2 + dx] = GATE_COLORS[op]

    def _draw_hud(self, frame: list[list[int]]) -> None:
        self._rect(frame, PLAY_HEIGHT, 0, FRAME - PLAY_HEIGHT, FRAME, C_VDGREY)
        for index in range(self.win_levels):
            color = C_GREEN if index < self.levels_completed else C_MGREY
            frame[PLAY_HEIGHT + 1][1 + index * 2] = frame[PLAY_HEIGHT + 2][1 + index * 2] = color

    def _render_frame(self) -> list[list[int]]:
        frame = [[C_BLACK] * FRAME for _ in range(FRAME)]
        self._rect(frame, 1, 2, 54, 60, C_VDGREY)
        values, outputs = _evaluate(self._level, self._inputs)
        positions = self._positions()
        for cells, family, ref in self._routes(positions):
            color = WIRE_PAIRS[family][values[ref]]
            for y, x in cells:
                if 0 <= y < PLAY_HEIGHT and 0 <= x < FRAME: frame[y][x] = color
        for gate in self._level["gates"]:
            y, x = positions[str(gate["id"])]
            self._draw_gate(frame, y, x, str(gate["op"]))
            frame[y][x] = C_WHITE if values[str(gate["id"])] else C_BLACK
        for index, value in enumerate(self._inputs):
            y, x = positions[f"i{index}"]
            self._rect(frame, y - 2, x - 2, 5, 5, C_GREEN if value else C_DGREY)
            self._border(frame, y - 2, x - 2, 5, 5, C_WHITE)
        for index, value in enumerate(outputs):
            x = 10 + round(index * 44 / max(1, len(outputs) - 1))
            self._rect(frame, LAMP_TOP, x - 3, 5, 7, C_YELLOW if value else C_DGREY)
            self._border(frame, LAMP_TOP, x - 3, 5, 7, C_WHITE if value else C_MGREY)
        self._draw_hud(frame)
        return frame
