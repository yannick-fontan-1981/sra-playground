"""RSWP — Role Swap, native Python port of web v6 (custom_3).

ACTION6 configures the three workers; ACTION5 executes one complete shared work
turn; ACTION7 resets the level; RESET resets the campaign. Rendering is 64x64,
indices 0..15. Install all six JSON levels alongside the engine (see README).

Python 3.10+, standard library only. No JavaScript, network, clock, randomness,
solver or stored solution is used at runtime. The functions plan/opportunities
arbitrate only the current turn, never a future sequence of actions.
"""
from __future__ import annotations

import copy
import json
import math
from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path
from types import SimpleNamespace
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

SIZE = FRAME = 64
CELL = 3
OX, OY = 1, 8
LEVEL_COUNT = 6
VERSION = WEB_VERSION = "6.0"
GAME_ID = "rswp-c3000001"
TITLE = "Role Swap — Trois ouvriers, un atelier"
FAMILY = "role_swap"
WAVE = "custom_3"
DEFAULT_FPS = 20
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / FAMILY / "levels"
PALETTE = (
    "#FFFFFF", "#CCCCCC", "#999999", "#666666", "#333333", "#000000",
    "#E53AA3", "#FF7BCC", "#F93C31", "#1E93FF", "#88D8F1", "#FFDC00",
    "#FF851B", "#921231", "#4FCC30", "#A356D6",
)
WORKER_COLORS = [9, 8, 14]
MATERIALS = [15, 12, 13]
ZONES = [10, 11, 6]
NAMES = {9: "bleu", 8: "rouge", 14: "vert", 15: "violet", 12: "orange",
         13: "bordeaux", 10: "cyan", 11: "jaune", 6: "magenta"}
ACTIVITIES = ["burn", "transform", "move"]
PARAMETER = {"burn": "furnace", "transform": "output", "move": "destination"}
GLYPHS = {"move": ["010", "111", "010"], "transform": ["100", "011", "100"],
          "burn": ["010", "110", "111"]}
FURNACE_GLYPHS = [["111", "000", "000"], ["000", "111", "000"], ["000", "000", "111"]]
ZONE_ROWS = [[1, 4], [6, 10], [12, 15]]
SLOTS = [
    [[2, 3], [4, 3], [6, 3], [2, 4], [4, 4], [6, 4]],
    [[2, 8], [4, 8], [6, 8], [2, 9], [4, 9], [6, 9]],
    [[2, 14], [4, 14], [6, 14], [2, 15], [4, 15], [6, 15]],
]
OVENS = [[9, 3], [9, 8], [9, 14]]
SPAWNS = [[8, 2], [8, 7], [8, 13]]
DIRS = [(1, 0), (0, 1), (-1, 0), (0, -1)]
SEPARATION_DIRS = [(0, 1), (1, 0), (-1, 0), (0, -1)]
GRID = ["".join("#" if (x in (0, 10) or y in (0, 16) or (y in (5, 11) and x != 5))
                else "." for x in range(11)) for y in range(17)]
Raster = list[list[int]]
Level = dict[str, Any]
Snapshot = dict[str, Any]
Point = list[int]
_SLOT_SET = frozenset(tuple(p) for zone in SLOTS for p in zone)
_OVEN_SET = frozenset(map(tuple, OVENS))


def _is_integer(value: Any) -> bool:
    """Match JSON/JS integer semantics, excluding booleans."""
    return type(value) is int or (type(value) is float and math.isfinite(value) and value.is_integer())


def _int(value: Any, name: str, lo: int, hi: int) -> int:
    if not _is_integer(value) or not lo <= value <= hi:
        raise ValueError(f"{name}: expected integer {lo}..{hi}, got {value!r}")
    return int(value)


def _round(value: float) -> int:
    return math.floor(value + 0.5)  # Math.round, not Python's ties-to-even.


def _fill(f: Raster, x: float, y: float, w: int, h: int, color: int) -> None:
    x, y = _round(x), _round(y)
    for yy in range(max(0, y), min(SIZE, y + h)):
        for xx in range(max(0, x), min(SIZE, x + w)):
            f[yy][xx] = color


def _outline(f: Raster, x: float, y: float, w: int, h: int, color: int) -> None:
    _fill(f, x, y, w, 1, color)
    _fill(f, x, y + h - 1, w, 1, color)
    _fill(f, x, y, 1, h, color)
    _fill(f, x + w - 1, y, 1, h, color)


def _stamp(f: Raster, x: float, y: float, glyph: list[str], color: int = 0, bg: int = 4) -> None:
    _fill(f, x, y, 3, 3, bg)
    for j in range(3):
        for i in range(3):
            if glyph[j][i] == "1":
                _fill(f, x + i, y + j, 1, 1, color)


def px(p: Point | tuple[int, int]) -> Point:
    return [OX + p[0] * CELL, OY + p[1] * CELL]


def free(p: Point | tuple[int, int]) -> bool:
    x, y = p
    return 0 <= x < 11 and 0 <= y < 17 and GRID[y][x] == "." and (x, y) not in _OVEN_SET


@lru_cache(maxsize=8192)
def _bfs_cached(start: tuple[int, int], goals: tuple[tuple[int, int], ...]) -> tuple[tuple[int, int], ...] | None:
    queue = [start]
    parents: dict[tuple[int, int], tuple[int, int] | None] = {start: None}
    goal_set = set(goals)
    for p in queue:
        if p in goal_set:
            route = []
            cur: tuple[int, int] | None = p
            while cur is not None:
                route.append(cur)
                cur = parents[cur]
            return tuple(reversed(route))
        for dx, dy in DIRS:
            q = (p[0] + dx, p[1] + dy)
            if free(q) and q not in parents:
                parents[q] = p
                queue.append(q)
    return None


def bfs(start: Point, goals: list[Point]) -> list[Point] | None:
    """Static cardinal routes; cache only geometry, never gameplay decisions."""
    result = _bfs_cached(tuple(start), tuple(map(tuple, goals)))
    return None if result is None else [list(p) for p in result]


def near_route(start: Point, target: Point) -> list[Point] | None:
    goals = [[target[0] + dx, target[1] + dy] for dx, dy in DIRS]
    return bfs(start, [p for p in goals if free(p) and tuple(p) not in _SLOT_SET])


def separate_workers(snapshot: Snapshot) -> list[dict[str, Any]]:
    """Separate final endpoints physically, down first, without another turn."""
    occupied: set[tuple[int, int]] = set()
    moves = []
    workers = sorted(snapshot["workers"], key=lambda w: w["id"])
    original = {w["id"]: w["pos"][:] for w in workers}
    stock = {tuple(SLOTS[a["zone"]][a["slot"]]) for a in snapshot["items"] if a["alive"]}
    for w in workers:
        if tuple(w["pos"]) not in occupied:
            occupied.add(tuple(w["pos"]))
            continue
        start = w["pos"][:]
        bounds = ZONE_ROWS[w["zone"]]
        queue, seen = [start], {tuple(start)}
        chosen = None
        for n, p in enumerate(queue):
            later = any(o["id"] > w["id"] and original[o["id"]] == p for o in workers)
            if n > 0 and tuple(p) not in occupied and not later and tuple(p) not in stock:
                chosen = p
                break
            for dx, dy in SEPARATION_DIRS:
                q = [p[0] + dx, p[1] + dy]
                if not bounds[0] <= q[1] <= bounds[1] or not free(q) or tuple(q) in seen:
                    continue
                seen.add(tuple(q))
                queue.append(q)
        if chosen is None:
            raise RuntimeError("No free cell to separate workers in this workshop")
        w["pos"] = chosen[:]
        occupied.add(tuple(chosen))
        moves.append({"worker": w["id"], "from": start, "to": chosen[:]})
    return moves


def worker_pixels(snapshot: Snapshot, positions: list[Point] | None = None) -> list[dict[str, Any]]:
    """Presentation-only separation during crossings; keep route coordinates."""
    raw = [{"id": w["id"], "color": w["color"],
            "pos": [_round(v) for v in (positions[w["id"]] if positions is not None else px(w["pos"]))]}
           for w in sorted(snapshot["workers"], key=lambda w: w["id"])]
    placed: list[dict[str, Any]] = []

    def overlap(a: Point, b: Point) -> bool:
        return abs(a[0] - b[0]) < CELL and abs(a[1] - b[1]) < CELL

    def walkable(p: Point) -> bool:
        return all(free([(x - OX) // CELL, (y - OY) // CELL])
                   for y in range(p[1], p[1] + CELL) for x in range(p[0], p[0] + CELL))

    for w in raw:
        target = w["pos"][:]
        if any(overlap(target, o["pos"]) for o in placed):
            queue, seen, found = [target], {tuple(target)}, None
            for n, p in enumerate(queue):
                collides = (any(overlap(p, o["pos"]) for o in placed)
                            or any(o["id"] > w["id"] and overlap(p, o["pos"]) for o in raw))
                if n > 0 and not collides:
                    found = p
                    break
                for dx, dy in SEPARATION_DIRS:
                    q = [p[0] + dx * CELL, p[1] + dy * CELL]
                    if (q[0] < OX + CELL or q[0] + CELL > OX + 10 * CELL
                            or q[1] < OY + CELL or q[1] + CELL > OY + 16 * CELL
                            or tuple(q) in seen or not walkable(q)):
                        continue
                    seen.add(tuple(q))
                    queue.append(q)
            if found is None:
                # Pixel-interpolated doorway crossing: retry aligned cells.
                candidates = [px([x, y]) for y in range(1, 16) for x in range(1, 10)]
                candidates = [p for p in candidates if walkable(p)
                              and not any(overlap(p, o["pos"]) for o in placed)
                              and not any(o["id"] > w["id"] and overlap(p, o["pos"]) for o in raw)]
                candidates.sort(key=lambda p: (abs(p[0] - target[0]) + abs(p[1] - target[1]), -p[1], p[0]))
                found = candidates[0] if candidates else None
            if found is None:
                raise RuntimeError("No display room for worker sprite")
            target = found[:]
        placed.append({**w, "pos": target, "route_pos": w["pos"][:]})
    return placed


def control_cells(worker: int) -> list[dict[str, Any]]:
    x, y = 37, 9 + 18 * worker
    cells = []
    for i in range(3):
        yy = y + 2 + 5 * i
        cells.append({"worker": worker, "key": "material", "value": MATERIALS[i], "x": x + 2, "y": yy, "w": 3, "h": 3})
        cells.append({"worker": worker, "key": "activity", "value": ACTIVITIES[i], "x": x + 7, "y": yy, "w": 3, "h": 3})
        for j in range(3):
            cells.append({"worker": worker, "key": PARAMETER[ACTIVITIES[i]], "value": MATERIALS[j] if i == 1 else j,
                          "x": x + 12 + 5 * j, "y": yy, "w": 3, "h": 3})
    return cells


CELLS = [c for w in range(3) for c in control_cells(w)]


def validate(raw: list[Level]) -> list[Level]:
    """Validate data, copy it, and derive the target from the actual stock."""
    if not isinstance(raw, list) or len(raw) != LEVEL_COUNT:
        raise ValueError("Six levels required")
    levels = copy.deepcopy(raw)
    for l in levels:
        if not isinstance(l, dict):
            raise ValueError("Each level must be an object")
        l["budget"] = _int(l.get("budget"), "budget", 1, 60)
        stock = l.get("stock")
        if (not isinstance(stock, list) or len(stock) != 3
                or any(not isinstance(z, list) or any(not _is_integer(c) or c not in MATERIALS for c in z) for z in stock)):
            raise ValueError("Invalid stock")
        l["stock"] = [[int(c) for c in z] for z in stock]
        capacity = l.get("capacity")
        if not isinstance(capacity, list) or len(capacity) != 3:
            raise ValueError("Invalid room capacity")
        l["capacity"] = [_int(n, "capacity", 1, 6) for n in capacity]
        if any(len(l["stock"][z]) > n for z, n in enumerate(l["capacity"])):
            raise ValueError("Stock exceeds capacity")
        furnaces = l.get("furnaces")
        if not isinstance(furnaces, list) or len(furnaces) != 3:
            raise ValueError("Invalid furnaces")
        for f in furnaces:
            if not isinstance(f, dict) or f.get("accepts") not in MATERIALS:
                raise ValueError("Invalid furnace fuel")
            f["accepts"] = _int(f["accepts"], "fuel", 12, 15)
            f["cooldown"] = _int(f.get("cooldown"), "cooldown", 0, 3)
        recipes = l.get("recipes")
        if not isinstance(recipes, list) or len(recipes) != 3:
            raise ValueError("Invalid recipes")
        for rs in recipes:
            if not isinstance(rs, list) or len(rs) != 1:
                raise ValueError("One visible recipe per room")
            r = rs[0]
            if (not isinstance(r, list) or len(r) != 2 or r[0] == r[1]
                    or any(not _is_integer(c) or c not in MATERIALS for c in r)):
                raise ValueError("Invalid recipe")
            rs[0] = [int(c) for c in r]
        l["target"] = sum(map(len, l["stock"]))
        if l["target"] < 1:
            raise ValueError("No fuel")
        initial_worker_config = l.get("initial_worker_config", {})
        if (not isinstance(initial_worker_config, dict)
                or any(worker_id not in {"0", "1", "2"} or not isinstance(config, dict)
                       or set(config) != {"activity"} or config["activity"] not in ACTIVITIES
                       for worker_id, config in initial_worker_config.items())):
            raise ValueError("Invalid initial worker configuration")
    return levels


def load_levels(directory: str | Path = LEVELS_DIR) -> list[Level]:
    directory = Path(directory)
    paths = [directory / f"L{i:02d}.json" for i in range(1, LEVEL_COUNT + 1)]
    missing = [str(p) for p in paths if not p.is_file()]
    if missing:
        raise FileNotFoundError("Install the six Role Swap level JSONs; missing: " + ", ".join(missing))
    try:
        return validate([json.loads(p.read_text(encoding="utf-8-sig")) for p in paths])
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid level JSON: {exc}") from exc


def initial(l: Level) -> Snapshot:
    workers = [{"id": z, "color": WORKER_COLORS[z], "zone": z, "pos": SPAWNS[z][:], "paused": False,
                "config": dict.fromkeys(("material", "activity", "destination", "output", "furnace"))}
               for z in range(3)]
    for worker_id, config in l.get("initial_worker_config", {}).items():
        workers[int(worker_id)]["config"].update(config)
    items = [{"zone": z, "slot": slot, "color": color, "alive": True}
             for z, colors in enumerate(l["stock"]) for slot, color in enumerate(colors)]
    for i, item in enumerate(items):
        item["id"] = i
    return {"workers": workers, "items": items, "cooldown": [0, 0, 0], "burned": 0, "turn": 0, "left": l["budget"]}


def plan(l: Level, s: Snapshot) -> dict[str, Any]:
    """Reserve one job per worker on the shared input state; fixed priority."""
    prerequisites = []
    for w in s["workers"]:
        c, z = w["config"], w["zone"]
        a = c.get("activity")
        reason = None
        if a not in ACTIVITIES or c.get("material") not in MATERIALS or c.get(PARAMETER.get(a, "")) is None:
            reason = "unconfigured"
        elif a == "move" and c["destination"] == z:
            reason = "already_here"
        elif a == "transform" and [c["material"], c["output"]] not in l["recipes"][z]:
            reason = "recipe"
        elif a == "burn":
            if c["furnace"] != z:
                reason = "wrong_room"
            elif l["furnaces"][z]["accepts"] != c["material"]:
                reason = "fuel"
            elif s["cooldown"][z] > 0:
                reason = "cooldown"
        if reason is None and not any(a["alive"] and a["zone"] == z and a["color"] == c["material"] for a in s["items"]):
            reason = "no_material"
        prerequisites.append(reason)

    accepted: list[dict[str, Any]] = []
    # Descending masks prefer blue, then red, then green. A rejected request
    # cannot keep an item reserved against a feasible colleague.
    for mask in range(7, -1, -1):
        taken, ovens = set(), set()
        jobs: list[dict[str, Any]] = []
        valid = True
        for w in s["workers"]:
            if not mask & (4 >> w["id"]):
                continue
            c, z = w["config"], w["zone"]
            if prerequisites[w["id"]] or (c["activity"] == "burn" and z in ovens):
                valid = False
                break
            candidates = []
            for item in s["items"]:
                if item["alive"] and item["zone"] == z and item["color"] == c["material"] and item["id"] not in taken:
                    route = near_route(w["pos"], SLOTS[z][item["slot"]])
                    if route is not None:
                        candidates.append((len(route), item["id"], item, route))
            candidates.sort(key=lambda v: (v[0], v[1]))
            if not candidates:
                valid = False
                break
            _, _, item, route = candidates[0]
            taken.add(item["id"])
            if c["activity"] == "burn":
                ovens.add(z)
            jobs.append({"worker": w["id"], "item": item["id"], "activity": c["activity"], "from": z,
                         "to": c["destination"] if c["activity"] == "move" else z,
                         "material": item["color"], "output": c["output"], "furnace": c["furnace"],
                         "source": SLOTS[z][item["slot"]][:], "approach": route})
        if not valid:
            continue
        leaving = {j["item"] for j in jobs if j["activity"] != "transform"}
        busy = [{a["slot"] for a in s["items"] if a["alive"] and a["zone"] == z and a["id"] not in leaving}
                for z in range(3)]
        for j in jobs:
            if j["activity"] != "move":
                continue
            slot = next((n for n in range(l["capacity"][j["to"]]) if n not in busy[j["to"]]), None)
            if slot is None:
                valid = False
                break
            busy[j["to"]].add(slot)
            j["slot"] = slot
            j["destination"] = SLOTS[j["to"]][slot][:]
        if valid:
            accepted = jobs
            break
    for j in accepted:
        at = j["approach"][-1]
        if j["activity"] == "move":
            j["route"] = near_route(at, j["destination"])
        elif j["activity"] == "burn":
            j["route"] = near_route(at, OVENS[j["furnace"]])
        else:
            j["route"] = [at[:]]
        if j["route"] is None:
            raise RuntimeError("Unreachable task in fixed factory")
    reserved = {j["item"] for j in accepted}
    idle = []
    for w in s["workers"]:
        if any(j["worker"] == w["id"] for j in accepted):
            continue
        reason, c = prerequisites[w["id"]], w["config"]
        if not reason and c["activity"] == "burn" and any(j["activity"] == "burn" and j["furnace"] == c["furnace"] for j in accepted):
            reason = "furnace_reserved"
        if not reason and not any(a["alive"] and a["zone"] == w["zone"] and a["color"] == c["material"] and a["id"] not in reserved for a in s["items"]):
            reason = "no_material"
        idle.append({"worker": w["id"], "reason": reason or "full"})
    return {"jobs": accepted, "idle": idle}


def apply(l: Level, s: Snapshot, p: dict[str, Any]) -> Snapshot:
    n = copy.deepcopy(s)
    n["turn"] += 1
    n["left"] -= 1
    n["cooldown"] = [max(0, x - 1) for x in n["cooldown"]]
    for j in p["jobs"]:
        a, w = n["items"][j["item"]], n["workers"][j["worker"]]
        w["pos"] = j["route"][-1][:]
        if j["activity"] == "move":
            a["zone"], a["slot"], w["zone"] = j["to"], j["slot"], j["to"]
        elif j["activity"] == "transform":
            a["color"] = j["output"]
        else:
            a["alive"] = False
            n["burned"] += 1
            n["cooldown"][j["furnace"]] = l["furnaces"][j["furnace"]]["cooldown"]
    separate_workers(n)
    return n


def opportunities(l: Level, s: Snapshot) -> list[list[dict[str, Any]]]:
    """Present-time feasible jobs, including exchanges between full stocks."""
    counts = [[sum(a["alive"] and a["zone"] == z and a["color"] == c for a in s["items"])
               for c in MATERIALS] for z in range(3)]
    total = list(map(sum, counts))
    candidates: list[list[dict[str, Any] | None]] = []
    for w in s["workers"]:
        z, out = w["zone"], [None]
        for m, material in enumerate(MATERIALS):
            if counts[z][m] <= 0:
                continue
            out.extend({"material": material, "activity": "move", "destination": d} for d in range(3) if d != z)
            out.extend({"material": material, "activity": "transform", "output": output}
                       for input_, output in l["recipes"][z] if input_ == material)
            if s["cooldown"][z] == 0 and l["furnaces"][z]["accepts"] == material:
                out.append({"material": material, "activity": "burn", "furnace": z})
        candidates.append(out)
    seen = [set() for _ in candidates]
    taken, delta, ovens, selected = [[0, 0, 0] for _ in range(3)], [0, 0, 0], set(), [0, 0, 0]

    def visit(i: int) -> None:
        if i == len(s["workers"]):
            if any(n + delta[z] > l["capacity"][z] for z, n in enumerate(total)):
                return
            for w, k in enumerate(selected):
                if k:
                    seen[w].add(k)
            return
        z = s["workers"][i]["zone"]
        for k, job in enumerate(candidates[i]):
            selected[i] = k
            if job is None:
                visit(i + 1)
                continue
            m = MATERIALS.index(job["material"])
            if taken[z][m] >= counts[z][m] or (job["activity"] == "burn" and z in ovens):
                continue
            taken[z][m] += 1
            if job["activity"] == "move":
                delta[z] -= 1
                delta[job["destination"]] += 1
            elif job["activity"] == "burn":
                delta[z] -= 1
                ovens.add(z)
            visit(i + 1)
            if job["activity"] == "move":
                delta[z] += 1
                delta[job["destination"]] -= 1
            elif job["activity"] == "burn":
                delta[z] += 1
                ovens.remove(z)
            taken[z][m] -= 1

    visit(0)
    return [[job for k, job in enumerate(js) if job is not None and k in seen[w]]
            for w, js in enumerate(candidates)]


def option_mask(jobs: list[dict[str, Any]], config: dict[str, Any]) -> dict[str, list[Any]]:
    current = [j for j in jobs if config["material"] is None or j["material"] == config["material"]]
    return {
        "material": [c for c in MATERIALS if any(j["material"] == c for j in jobs)],
        "activity": [a for a in ACTIVITIES if any(j["activity"] == a for j in current)],
        "furnace": [v for v in range(3) if any(j["activity"] == "burn" and j["furnace"] == v for j in current)],
        "output": [v for v in MATERIALS if any(j["activity"] == "transform" and j["output"] == v for j in current)],
        "destination": [v for v in range(3) if any(j["activity"] == "move" and j["destination"] == v for j in current)],
    }


def clean_configs(s: Snapshot, jobs_by_worker: list[list[dict[str, Any]]]) -> None:
    for w in s["workers"]:
        c, jobs = w["config"], jobs_by_worker[w["id"]]
        if c["material"] is not None and not any(j["material"] == c["material"] for j in jobs):
            c.update(dict.fromkeys(("material", "activity", "destination", "output", "furnace")))
        materials = option_mask(jobs, c)["material"]
        if len(materials) == 1:
            c["material"] = materials[0]
        mask = option_mask(jobs, c)
        for key in ("activity", "destination", "output", "furnace"):
            if c[key] not in mask[key]:
                c[key] = None
            if key == "activity" and w.get("paused", False):
                c["activity"] = None
                continue
            if len(mask[key]) == 1:
                c[key] = mask[key][0]


def furnace_pixels(z: int) -> dict[str, Any]:
    x, y = px(OVENS[z])
    return {"x": x, "y": y - 1, "fuel_y": y + 3, "frame": {"x": x - 1, "y": y - 2, "w": 5, "h": 9}}


def workshop_pixels(z: int) -> dict[str, Any]:
    x, y = px([1, ZONE_ROWS[z][0]])
    return {"x": x, "y": y, "input_x": x, "glyph_x": x + 4, "output_x": x + 8,
            "frame": {"x": x - 1, "y": y - 1, "w": 13, "h": 5}, "service": [3, ZONE_ROWS[z][0] + 2]}


class RoleSwapEngine:
    """Custom backend engine, compatible with RoleSwapEngine(info).

    level_data and levels_dir are optional author/test conveniences. They are not
    actions available to an evaluated agent. Pass the existing CustomGameInfo
    object from your registry; it is only type-imported, never required at runtime.
    """

    def __init__(self, info: CustomGameInfo | None = None, *,
                 levels_dir: str | Path | None = None, level_data: list[Level] | None = None) -> None:
        if levels_dir is not None and level_data is not None:
            raise ValueError("Use levels_dir or level_data, not both")
        self.info = info if info is not None else SimpleNamespace(
            game_id=GAME_ID, title=TITLE, family=FAMILY, levels=LEVEL_COUNT, default_fps=DEFAULT_FPS)
        self.levels_dir = Path(levels_dir).resolve() if levels_dir is not None else LEVELS_DIR
        self._templates = load_levels(self.levels_dir) if level_data is None else validate(level_data)
        self.win_levels = _int(self.info.levels, "info.levels", 1, LEVEL_COUNT)
        self._fps = _int(self.info.default_fps, "info.default_fps", 1, 240)
        self._completed = [False] * LEVEL_COUNT
        self.step_index = 0
        self.last_action = "RESET"
        self.test_mode = False
        self._event = "reset"
        self._opportunity_cache: dict[tuple[Any, ...], list[list[dict[str, Any]]]] = {}
        self._load(0)

    @property
    def _level(self) -> Level:
        return self._templates[self._index]

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    def _jobs_available(self, ss: Snapshot | None = None) -> list[list[dict[str, Any]]]:
        ss = self._snapshot if ss is None else ss
        key = (self._index, tuple(w["zone"] for w in ss["workers"]),
               tuple((a["zone"], a["color"]) for a in ss["items"] if a["alive"]), tuple(ss["cooldown"]))
        if key not in self._opportunity_cache:
            if len(self._opportunity_cache) > 12:
                self._opportunity_cache.clear()
            self._opportunity_cache[key] = opportunities(self._level, ss)
        return self._opportunity_cache[key]

    def availability(self, snapshot: Snapshot | None = None) -> list[dict[str, list[Any]]]:
        ss = self._snapshot if snapshot is None else snapshot
        jobs = self._jobs_available(ss)
        return [option_mask(jobs[w["id"]], w["config"]) for w in ss["workers"]]

    def _refresh_options(self) -> None:
        clean_configs(self._snapshot, self._jobs_available())

    def _load(self, index: int) -> None:
        self._index = index
        self._snapshot = initial(self._level)
        self.state = "NOT_FINISHED"
        self._events: list[dict[str, Any]] = []
        self._refresh_options()

    def render(self, options: dict[str, Any] | None = None) -> Raster:
        """Fresh raster. Optional overlays are for author/animation use only."""
        opts = options or {}
        l = self._level
        ss = opts.get("snapshot", self._snapshot)
        allowed = self.availability(ss)
        f = [[5] * SIZE for _ in range(SIZE)]
        _fill(f, 2, 1, 31, 2, 2)
        _fill(f, 2, 1, math.ceil(31 * ss["left"] / l["budget"]), 2, 11)
        _fill(f, 2, 4, 31, 2, 2)
        _fill(f, 2, 4, math.floor(31 * ss["burned"] / l["target"]), 2, 14)
        for lo, hi in ZONE_ROWS:
            for y in range(lo, hi + 1):
                for x in range(1, 10):
                    _fill(f, *px([x, y]), 3, 3, 4)
        for y in range(17):
            for x in range(11):
                if GRID[y][x] != "#":
                    continue
                z = 0 if y <= 5 else 1 if y <= 11 else 2
                xx, yy = px([x, y])
                _fill(f, xx, yy, 3, 3, 2)
                if x in (0, 10):
                    _fill(f, xx + 1, yy, 1, 3, ZONES[z])
                if y in (0, 5, 11, 16):
                    _fill(f, xx, yy + 1, 3, 1, ZONES[z])
        for row in (5, 11):
            _stamp(f, *px([5, row]), GLYPHS["move"], 1, 5)
        for z in range(3):
            recipe = l["recipes"][z][0]
            x, y = px([1, ZONE_ROWS[z][0]])
            _fill(f, x - 1, y - 1, 13, 5, 4)
            _outline(f, x - 1, y - 1, 13, 5, 5)
            _fill(f, x, y, 3, 3, recipe[0])
            _stamp(f, x + 4, y, GLYPHS["transform"], 1)
            _fill(f, x + 8, y, 3, 3, recipe[1])
            fp = furnace_pixels(z)
            rect = fp["frame"]
            _fill(f, rect["x"], rect["y"], rect["w"], rect["h"], 5)
            _stamp(f, fp["x"], fp["y"], GLYPHS["burn"], 3 if ss["cooldown"][z] else 12, 2)
            _fill(f, fp["x"], fp["fuel_y"], 3, 3, l["furnaces"][z]["accepts"])
            if ss["cooldown"][z]:
                _fill(f, fp["x"] + 1, fp["y"] + 1, 1, 1, 5)
            for n in range(l["capacity"][z]):
                x, y = px(SLOTS[z][n])
                _outline(f, x, y, 3, 3, 3)
                _fill(f, x + 1, y + 1, 1, 1, 4)
        hidden = set(opts.get("hidden", []))
        item_colors = opts.get("itemColors", {})
        for a in ss["items"]:
            if a["alive"] and a["id"] not in hidden:
                color = item_colors.get(a["id"], item_colors.get(str(a["id"]), a["color"]))
                _fill(f, *px(SLOTS[a["zone"]][a["slot"]]), 3, 3, color)
        for z in range(3):
            fp, wp = furnace_pixels(z), workshop_pixels(z)
            for rect in (fp["frame"], wp["frame"]):
                _outline(f, rect["x"], rect["y"], rect["w"], rect["h"], 5)
            _fill(f, fp["x"] - 1, fp["fuel_y"] - 1, 5, 1, 5)
        for c in opts.get("processing", []):
            _fill(f, c["x"], c["y"], 3, 3, c["color"])
            _fill(f, c["x"], c["y"], 1, 1, 0)
            _fill(f, c["x"] + 2, c["y"] + 2, 1, 1, 0)
        for w in ss["workers"]:
            y = 9 + w["id"] * 18
            _fill(f, 37, y, 27, 17, 4)
            _outline(f, 37, y, 27, 17, w["color"])
            for c in control_cells(w["id"]):
                key, value = c["key"], c["value"]
                if value not in allowed[w["id"]][key]:
                    continue
                if key in ("material", "output"):
                    _fill(f, c["x"], c["y"], 3, 3, value)
                elif key == "activity":
                    _stamp(f, c["x"], c["y"], GLYPHS[value], 1)
                elif key == "destination":
                    _fill(f, c["x"], c["y"], 3, 3, ZONES[value])
                else:
                    _stamp(f, c["x"], c["y"], FURNACE_GLYPHS[value], 12)
                if w["config"][key] == value:
                    active = key in ("material", "activity") or {"destination": "move", "output": "transform", "furnace": "burn"}[key] == w["config"]["activity"]
                    _outline(f, c["x"] - 1, c["y"] - 1, 5, 5, 0 if active else 3)
            _fill(f, 34, y + 7, 2, 2, ZONES[w["zone"]])
        for i in range(LEVEL_COUNT):
            _fill(f, 2 + 5 * i, 62, 4, 1, 14 if self._completed[i] else 2)
        for z in opts.get("hot", []):
            p = furnace_pixels(z)
            _stamp(f, p["x"], p["y"], GLYPHS["burn"], 11, 8)
        for a in opts.get("changed", []):
            x, y = px(SLOTS[a["zone"]][a["slot"]])
            _outline(f, x - 1, y - 1, 5, 5, 0)
        # Foreground last: nothing in the workshop may cut a worker's silhouette.
        if not opts.get("hideWorkers", False):
            carry = opts.get("carry", {})
            for w in worker_pixels(ss, opts.get("positions")):
                p = w["pos"]
                _stamp(f, *p, ["010", "111", "101"], w["color"], 4)
                _fill(f, p[0] + 1, p[1] + 1, 1, 1, carry.get(w["id"], carry.get(str(w["id"]), 0)))
        if opts.get("red", False):
            f = [[8] * SIZE for _ in range(SIZE)]
        if "border" in opts:
            _outline(f, 0, 0, 64, 64, opts["border"])
        return f

    def view(self) -> dict[str, Any]:
        """Human visualizer data; not extra actions or privileged agent inputs."""
        s, l = self._snapshot, self._level
        return {"level": self._index + 1, "title": l.get("title", ""), "lesson": l.get("lesson", ""),
                "hint": l.get("hint", ""), "state": self.state, "test_mode": self.test_mode,
                "completed": self._completed[:], "turn": s["turn"], "left": s["left"], "budget": l["budget"],
                "burned": s["burned"], "target": l["target"], "workers": copy.deepcopy(s["workers"]),
                "available_options": self.availability(),
                "stock": [[sum(a["alive"] and a["zone"] == z and a["color"] == c for a in s["items"])
                          for c in MATERIALS] for z in range(3)],
                "capacity": l["capacity"][:], "recipes": copy.deepcopy(l["recipes"]),
                "furnaces": [{**f, "remaining": s["cooldown"][z]} for z, f in enumerate(l["furnaces"])],
                "events": copy.deepcopy(self._events)}

    def _envelope(self, frames: list[Raster] | None = None, timeline: list[dict[str, Any]] | None = None,
                  durations: list[int] | None = None, **extra: Any) -> dict[str, Any]:
        if frames is None:
            frames = [self.render()]
            durations = [50]
        if durations is None or len(durations) != len(frames) or (timeline is not None and len(timeline) != len(frames)):
            raise RuntimeError("Frame/duration/timeline length mismatch")
        s = self._snapshot
        actions = [7] if self.state == "WIN" else [5, 6, 7]
        out = {
            "backend": "custom", "selected": True, "game_id": self.info.game_id, "title": self.info.title,
            "custom_family": self.info.family, "family": FAMILY, "wave": WAVE, "version": VERSION,
            "state": self.state, "level": self._index + 1, "score": self.levels_completed,
            "levels_completed": self.levels_completed, "win_levels": 1 if self.test_mode else self.win_levels,
            "win_score": 1 if self.test_mode else self.win_levels,
            "frame": frames[-1], "frames": frames, "frame_count": len(frames),
            "default_fps": self._fps, "frame_durations_ms": durations,
            "available_actions": [f"ACTION{i}" for i in actions], "available_action_ids": actions,
            "step_index": self.step_index, "last_action": self.last_action, "full_reset": False,
            "source_path": str(self.levels_dir), "level_name": self._level.get("title", ""),
            "test_mode": self.test_mode, "work_turns": s["turn"], "actions_left": s["left"],
            "burned": s["burned"], "target": self._level["target"], "event": self._event,
        }
        if timeline is not None:
            out["timeline"] = timeline
        out.update(extra)
        return out

    def public_state(self) -> dict[str, Any]:
        """Return one fresh current frame, with no work or animation replay."""
        return self._envelope()

    def _response(self, event: str, frames: list[Raster] | None = None,
                  timeline: list[dict[str, Any]] | None = None, durations: list[int] | None = None,
                  **extra: Any) -> dict[str, Any]:
        self._event = event
        return self._envelope(frames, timeline, durations, **extra)

    def _run(self) -> dict[str, Any]:
        l, before = self._level, copy.deepcopy(self._snapshot)
        p = plan(l, self._snapshot)
        after = apply(l, self._snapshot, p)
        frames: list[Raster] = []
        timeline: list[dict[str, Any]] = []
        durations: list[int] = []
        played = self._index + 1
        self._events = [{"type": j["activity"], "worker": j["worker"], "item": j["item"],
                         "from": j["from"], "to": j["to"], "material": j["material"],
                         "output": j["output"] if j["activity"] == "transform" else None,
                         "furnace": j["furnace"] if j["activity"] == "burn" else None, "turn": after["turn"]}
                        for j in p["jobs"]]
        self._events.extend({"type": "idle", **i, "turn": after["turn"]} for i in p["idle"])

        def add(kind: str, options: dict[str, Any] | None = None, ms: int = 60) -> None:
            o = options or {}
            ss, carry_ = o.get("snapshot", self._snapshot), o.get("carry", {})
            frames.append(self.render(o))
            entry = {"level": self._index + 1, "turn": ss["turn"], "kind": kind,
                     "burned": ss["burned"], "left": ss["left"],
                     "workers": [{"worker": w["id"], "x": w["pos"][0], "y": w["pos"][1],
                                  "route_x": w["route_pos"][0], "route_y": w["route_pos"][1],
                                  "color": w["color"], "carrying": carry_.get(w["id"])}
                                 for w in worker_pixels(ss, o.get("positions"))]}
            if "processing" in o:
                entry["processing"] = copy.deepcopy(o["processing"])
            timeline.append(entry)
            durations.append(ms)

        # Debit once before animation; rendering never creates another turn.
        self._snapshot["left"], self._snapshot["turn"] = after["left"], after["turn"]
        base = copy.deepcopy(self._snapshot)
        positions = [px(w["pos"]) for w in self._snapshot["workers"]]
        transforms = [j for j in p["jobs"] if j["activity"] == "transform"]
        hidden: set[int] = set()
        carry: dict[int, int] = {}
        item_colors: dict[int, int] = {}

        def animation_options(**extra: Any) -> dict[str, Any]:
            return {"snapshot": base, "positions": positions, "hidden": list(hidden),
                    "carry": carry, "itemColors": item_colors, **extra}

        def animate_paths(paths: list[dict[str, Any]], kind: str) -> None:
            limit = max([0] + [(len(o["path"]) - 1) * CELL for o in paths])
            for t in range(1, limit + 1):
                for o in paths:
                    total = (len(o["path"]) - 1) * CELL
                    v = min(t, total)
                    ix, frac = divmod(v, CELL)
                    a, b = o["path"][ix], o["path"][min(ix + 1, len(o["path"]) - 1)]
                    positions[o["worker"]] = [OX + a[0] * CELL + (b[0] - a[0]) * frac,
                                              OY + a[1] * CELL + (b[1] - a[1]) * frac]
                add(kind, animation_options(), 35)

        add("start", {"snapshot": base}, 140)
        animate_paths([{"worker": j["worker"], "path": j["approach"]} for j in p["jobs"]], "approach")
        for j in p["jobs"]:
            hidden.add(j["item"])
            carry[j["worker"]] = j["material"]
        add("pickup", animation_options(), 180)
        visits = {}
        for j in transforms:
            path = bfs(j["approach"][-1], [workshop_pixels(j["from"])["service"]])
            if path is None:
                raise RuntimeError("Unreachable workshop service point")
            visits[j["worker"]] = path
        animate_paths([{"worker": j["worker"], "path": visits.get(j["worker"], j["route"])} for j in p["jobs"]], "route")
        queues = [[j for j in transforms if j["from"] == z] for z in range(3)]
        for batch in range(max(map(len, queues), default=0)):
            jobs = [q[batch] for q in queues if batch < len(q)]
            for j in jobs:
                carry.pop(j["worker"], None)

            def processing(dx: int) -> list[dict[str, Any]]:
                return [{"worker": j["worker"], "item": j["item"], "zone": j["from"],
                         "x": workshop_pixels(j["from"])["input_x"] + dx,
                         "y": workshop_pixels(j["from"])["y"],
                         "color": j["material"] if dx < 4 else j["output"], "offset": dx} for j in jobs]

            add("workshop_load", animation_options(processing=processing(0)), 250)
            for dx in range(1, 9):
                add("workshop_change" if dx == 4 else "workshop_slide",
                    animation_options(processing=processing(dx)), 250 if dx == 4 else 90)
            add("workshop_unload", animation_options(processing=processing(8)), 250)
            for j in jobs:
                carry[j["worker"]] = j["output"]
            animate_paths([{"worker": j["worker"], "path": list(reversed(visits[j["worker"]]))} for j in jobs], "workshop_return")
            for j in jobs:
                hidden.discard(j["item"])
                carry.pop(j["worker"], None)
                item_colors[j["item"]] = j["output"]
            add("workshop_returned", animation_options(), 140)
        separation_paths = []
        for w in after["workers"]:
            job = next((j for j in p["jobs"] if j["worker"] == w["id"]), None)
            origin = job["route"][-1] if job is not None else before["workers"][w["id"]]["pos"]
            if origin != w["pos"]:
                path = bfs(origin, [w["pos"]])
                if path is None:
                    raise RuntimeError("Unreachable separation cell")
                separation_paths.append({"worker": w["id"], "path": path})
        animate_paths(separation_paths, "worker_separate")
        self._snapshot = after
        self._refresh_options()
        hot = [j["furnace"] for j in p["jobs"] if j["activity"] == "burn"]
        changed = [self._snapshot["items"][j["item"]] for j in transforms]
        for k in range(3):
            add("work", {"hot": hot if k % 2 == 0 else [], "changed": changed if k % 2 == 0 else []}, 110)
        add("settled", {}, 160)
        s = self._snapshot
        result = {"level": played, "turn": s["turn"], "burned": s["burned"], "left": s["left"],
                  "jobs": copy.deepcopy(self._events), "success": s["burned"] >= l["target"]}
        if result["success"]:
            self._completed[self._index] = True
            for _ in range(3):
                add("success", {"border": 14}, 500)
                add("success_pause", {}, 300)
            if self.test_mode or self._index + 1 >= self.win_levels:
                self.state = "WIN"
            else:
                self._load(self._index + 1)
            add("ready", {}, 70)
            return self._response("win" if self.state == "WIN" else "success", frames, timeline, durations,
                                  result=result, events=copy.deepcopy(result["jobs"]))
        if s["left"] <= 0:
            for _ in range(3):
                add("failure", {"red": True}, 100)
            self._load(self._index)
            add("reset", {}, 150)
            return self._response("failure", frames, timeline, durations, result=result, events=copy.deepcopy(result["jobs"]))
        return self._response("worked" if p["jobs"] else "idle", frames, timeline, durations,
                              result=result, events=copy.deepcopy(self._events))

    def action(self, action_id: int | str | Mapping[str, Any], data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Apply one native command and return all of its animation frames."""
        aid: Any = action_id
        if isinstance(aid, Mapping):
            data = aid.get("data") or {}
            aid = aid.get("id")
        if isinstance(aid, str):
            aid = 0 if aid == "RESET" else int(aid[-1]) if aid in {f"ACTION{i}" for i in range(1, 8)} else -1
        if isinstance(aid, bool) or not _is_integer(aid):
            aid = -1
        if aid == 0:
            return self.reset()
        if aid == 7:
            self.step_index += 1
            return self.level_reset()
        if self.state == "WIN":
            return self.public_state()
        self.step_index += 1
        self.last_action = f"ACTION{int(aid)}" if 1 <= aid <= 7 else "INVALID"
        if aid == 5:
            return self._run()
        if aid != 6:
            return self._response("ignored")
        payload = data if isinstance(data, Mapping) else {}
        x, y = payload.get("x"), payload.get("y")
        if not (_is_integer(x) and _is_integer(y) and 0 <= x < SIZE and 0 <= y < SIZE):
            return self._response("ignored")
        c = next((r for r in CELLS if r["x"] <= x < r["x"] + 3 and r["y"] <= y < r["y"] + 3), None)
        if c is None:
            return self._response("ignored")
        w = self._snapshot["workers"][c["worker"]]
        if c["value"] not in self.availability()[c["worker"]][c["key"]]:
            return self._response("unavailable")
        if w["config"][c["key"]] == c["value"]:
            if c["key"] == "activity":
                w["config"]["activity"] = None
                w["paused"] = True
                return self._response("paused")
            return self._response("unchanged")
        w["config"][c["key"]] = c["value"]
        if c["key"] == "activity":
            w["paused"] = False
        self._refresh_options()
        return self._response("configured")

    def reset(self) -> dict[str, Any]:
        self._completed = [False] * LEVEL_COUNT
        self.step_index = 0
        self.last_action = "RESET"
        self.test_mode = False
        self._load(0)
        return self._response("reset")

    def level_reset(self) -> dict[str, Any]:
        self._completed[self._index] = False
        self.last_action = "ACTION7"
        self._load(self._index)
        return self._response("restart")

    def jump_to_level(self, number: int, isolated: bool = True) -> dict[str, Any]:
        """Author preview only; never grant previous levels or expose as an action."""
        number = _int(number, "level", 1, self.win_levels)
        self._completed = [False] * LEVEL_COUNT
        self.step_index = 0
        self.last_action = "RESET"
        self.test_mode = bool(isolated)
        self._load(number - 1)
        return self._response("reset")

    def inspect(self) -> dict[str, Any]:
        """Author validation snapshot, not a privileged observation for SRA."""
        return {"index": self._index, "state": self.state, "completed": self._completed[:],
                "snapshot": copy.deepcopy(self._snapshot), "level": copy.deepcopy(self._level)}

    def debug_load(self, value: dict[str, Any]) -> dict[str, Any]:
        """Trusted author fixtures only. Deliberately not dispatched by action()."""
        if "snapshot" in value:
            self._snapshot = copy.deepcopy(value["snapshot"])
            separate_workers(self._snapshot)
        self._refresh_options()
        return self.public_state()

    def metadata(self) -> list[dict[str, Any]]:
        return [{"level": i + 1, "title": l.get("title", ""), "budget": l["budget"], "target": l["target"]}
                for i, l in enumerate(self._templates[:self.win_levels])]

    # Convenient aliases for the independent visualizer and the JS comparisons.
    step = action
    observe = public_state
    levelReset = level_reset
    jumpToLevel = jump_to_level
    debugLoad = debug_load
    controlCells = staticmethod(control_cells)


def create(level_data: list[Level] | None = None) -> RoleSwapEngine:
    return RoleSwapEngine(level_data=level_data)


__all__ = ["RoleSwapEngine", "create", "load_levels", "validate", "initial", "plan", "apply",
           "opportunities", "option_mask", "clean_configs", "control_cells", "separate_workers",
           "worker_pixels", "furnace_pixels", "workshop_pixels", "bfs", "near_route", "px", "free",
           "GAME_ID", "TITLE", "FAMILY", "WAVE", "VERSION", "PALETTE", "CELLS", "SIZE", "CELL",
           "WORKER_COLORS", "MATERIALS", "ZONES", "ACTIVITIES", "PARAMETER", "GLYPHS", "FURNACE_GLYPHS",
           "OVENS", "SLOTS", "SPAWNS", "ZONE_ROWS", "GRID"]
