"""CWSE — Catching without seeing, native Python port of web v4.

Arrow actions move one cell without rotating the 45-degree lamp. ACTION6 selects
one of eight compass positions; ACTION5 waits. Each blue push broadcasts to the
other blues, but a blocked remote chain never vetoes a legal local push. Violet
attachments remain rigid; illuminated photo crates turn green and repel once.
L1 and L2 each contain two independent examples before one level is awarded.

Python 3.10+, standard library only. No JavaScript, network, random generator or
solution lookup at runtime. Keep the six JSON files next to the custom backend
layout. Animation timing is returned in frame_durations_ms, never slept here.
"""
from __future__ import annotations

import copy
import json
import math
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from custom_games.registry import CustomGameInfo

SIZE = FRAME = 64
LEVEL_COUNT = 6
GAME_ID = "cwse-c3000001"
FAMILY = "catching_without_seeing"
WAVE = "custom_3"
WEB_VERSION = "4.0"
ANIM_FPS = 12
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / FAMILY / "levels"
PALETTE = (
    "#F3F2EB", "#B9C1C8", "#606974", "#858C94", "#343941", "#14181D",
    "#BD5298", "#E8B8A2", "#ED655C", "#559DE7", "#71D8D4", "#F0CA6A",
    "#E89B55", "#83543F", "#74C994", "#B48ADD",
)
C = {"red": 8, "blue": 9, "green": 14, "purple": 15}
DIRS = ((0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1))
DIR_NAMES = ("Nord", "Nord-est", "Est", "Sud-est", "Sud", "Sud-ouest", "Ouest", "Nord-ouest")
MOVE = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}
DIAL_POINTS = ((55, 49), (59, 51), (61, 55), (59, 59), (55, 61), (51, 59), (49, 55), (51, 51))
Raster = list[list[int]]
Level = dict[str, Any]
World = dict[str, Any]


def _is_integer(value: Any) -> bool:
    """JSON integer semantics, excluding bool but accepting 4.0 as JavaScript does."""
    return type(value) is int or (type(value) is float and math.isfinite(value) and value.is_integer())


def _integer(value: Any, name: str, low: int, high: int) -> int:
    if not _is_integer(value) or not low <= value <= high:
        raise ValueError(f"{name}: expected an integer in {low}..{high}, got {value!r}")
    return int(value)


def _round(value: float) -> int:
    """Math.round, not Python's ties-to-even rounding."""
    return math.floor(value + 0.5)


def _sign(value: float) -> int:
    return (value > 0) - (value < 0)


def _man(a: Mapping[str, Any], b: Mapping[str, Any]) -> float:
    return abs(a["x"] - b["x"]) + abs(a["y"] - b["y"])


def geometry(level: Mapping[str, Any]) -> dict[str, int]:
    p = int(level.get("cell_px") or 4)
    w, h = len(level["grid"][0]), len(level["grid"])
    return {"p": p, "w": w, "h": h, "x": (64 - w * p) // 2, "y": 3 + (44 - h * p) // 2}


def wall(level: Mapping[str, Any], x: Any, y: Any) -> bool:
    if not (_is_integer(x) and _is_integer(y)):
        return True
    grid = level["grid"]
    return y < 0 or y >= len(grid) or x < 0 or x >= len(grid[0]) or grid[int(y)][int(x)] == "#"


def at(state: World, x: float, y: float) -> dict[str, Any] | None:
    return next((b for b in state["boxes"] if b["x"] == x and b["y"] == y), None)


def in_cone(state: World, x: float, y: float) -> bool:
    dx, dy = x - state["player"]["x"], y - state["player"]["y"]
    vx, vy = DIRS[state["dir"]]
    dot, cross = dx * vx + dy * vy, abs(dx * vy - dy * vx)
    return dx * dx + dy * dy < 1e-12 or (dot > 0 and cross * 1000000 <= dot * 414214 + 1e-7)


def _opaque_map(state: World) -> dict[tuple[int, int], list[int]]:
    occupied: dict[tuple[int, int], list[int]] = {}
    for box in state["boxes"]:
        occupied.setdefault((_round(box["x"]), _round(box["y"])), []).append(box["id"])
    return occupied


def _ray_clear(level: Mapping[str, Any], state: World, tx: float, ty: float,
               ignore_id: int | None, occupied: dict[tuple[int, int], list[int]]) -> bool:
    sx, sy = state["player"]["x"], state["player"]["y"]
    dx, dy = tx - sx, ty - sy
    x, y, ex, ey = _round(sx), _round(sy), _round(tx), _round(ty)
    stepx, stepy = _sign(dx), _sign(dy)
    dtx, dty = abs(1 / dx) if dx else math.inf, abs(1 / dy) if dy else math.inf
    mx = ((x + (0.5 if stepx > 0 else -0.5)) - sx) / dx if dx else math.inf
    my = ((y + (0.5 if stepy > 0 else -0.5)) - sy) / dy if dy else math.inf
    grid, width, height = level["grid"], len(level["grid"][0]), len(level["grid"])

    def blocked(cx: int, cy: int) -> bool:
        return (cx < 0 or cy < 0 or cx >= width or cy >= height or grid[cy][cx] == "#"
                or any(box_id != ignore_id for box_id in occupied.get((cx, cy), ())))

    # Supercover: corner grazing does not permit light through either side wall.
    for _ in range(128):
        if x == ex and y == ey:
            return True
        if abs(mx - my) < 1e-9:
            if blocked(x + stepx, y) or blocked(x, y + stepy):
                return False
            x, y = x + stepx, y + stepy
            mx, my = mx + dtx, my + dty
        elif mx < my:
            x, mx = x + stepx, mx + dtx
        else:
            y, my = y + stepy, my + dty
        if blocked(x, y):
            return False
    return False


def ray_clear(level: Mapping[str, Any], state: World, tx: float, ty: float,
              ignore_id: int | None = None, boxes_opaque: bool = True) -> bool:
    return _ray_clear(level, state, tx, ty, ignore_id, _opaque_map(state) if boxes_opaque else {})


def lit(level: Mapping[str, Any], state: World, box: Mapping[str, Any]) -> bool:
    return in_cone(state, box["x"], box["y"]) and ray_clear(level, state, box["x"], box["y"], box["id"])


def matches(level: Mapping[str, Any], state: World) -> list[dict[str, Any]]:
    readings = []
    for slot in level["slots"]:
        box = at(state, slot["x"], slot["y"])
        readings.append({"x": slot["x"], "y": slot["y"], "target": slot["color"],
                         "current": box["color"] if box else None,
                         "match": box is not None and box["color"] == slot["color"]})
    return readings


def solved(level: Mapping[str, Any], state: World) -> bool:
    return all(r["match"] for r in matches(level, state))


def signature(state: World) -> str:
    p = state["player"]
    def num(value: Any) -> str:
        return str(int(value)) if _is_integer(value) else str(value)
    return f"{num(p['x'])},{num(p['y'])}/{state['dir']}/" + ";".join(
        f"{num(b['x'])},{num(b['y'])},{b['color']}" for b in state["boxes"])


def validate(raw: Any) -> list[Level]:
    """Copy and validate levels and independent examples without mutating input."""
    if not isinstance(raw, list) or not raw:
        raise ValueError("At least one level is required")
    levels = copy.deepcopy(raw)
    for level in levels:
        if not isinstance(level, dict):
            raise ValueError("Each level must be an object")
        if "extra_examples" in level:
            examples = level["extra_examples"]
            if not isinstance(examples, list) or len(examples) > 3:
                raise ValueError("Invalid examples")
            if any(not isinstance(e, dict) or "extra_examples" in e for e in examples):
                raise ValueError("Nested examples are not supported")
            level["extra_examples"] = validate(examples)  # As in web v4: no empty list.
        grid = level.get("grid")
        if (not isinstance(grid, list) or not grid or not isinstance(grid[0], str) or not grid[0]
                or any(not isinstance(r, str) or len(r) != len(grid[0]) or set(r) - {".", "#"} for r in grid)):
            raise ValueError("Invalid rectangular map")
        p = level.get("cell_px") or 4
        p = _integer(p, "cell_px", 4, 6)
        if "cell_px" in level:
            level["cell_px"] = p
        g = geometry(level)
        if g["w"] * p > 62 or g["h"] * p > 44:
            raise ValueError("Map exceeds the board")
        player = level.get("player")
        if not isinstance(player, (list, tuple)) or len(player) != 2 or wall(level, *player):
            raise ValueError("Invalid player")
        level["player"] = [int(v) for v in player]
        level["direction"] = _integer(level.get("direction"), "direction", 0, 7)
        boxes, slots = level.get("boxes"), level.get("slots")
        if (not isinstance(boxes, list) or not 1 <= len(boxes) <= 8
                or not isinstance(slots, list) or len(slots) != len(boxes)):
            raise ValueError("Use one slot for each box (1..8 boxes)")
        occupied, ids, used_slots = {tuple(level["player"])}, set(), set()
        for i, box in enumerate(boxes):
            if not isinstance(box, dict):
                raise ValueError("Invalid box")
            box.setdefault("id", i)
            if (not _is_integer(box["id"]) or box["id"] in ids
                    or wall(level, box.get("x"), box.get("y"))
                    or (box["x"], box["y"]) in occupied
                    or not _is_integer(box.get("color")) or box["color"] not in C.values()):
                raise ValueError("Invalid box")
            for k in ("id", "x", "y", "color"):
                box[k] = int(box[k])
            occupied.add((box["x"], box["y"]))
            ids.add(box["id"])
        boxes.sort(key=lambda box: box["id"])
        for slot in slots:
            if (not isinstance(slot, dict) or wall(level, slot.get("x"), slot.get("y"))
                    or (slot["x"], slot["y"]) in used_slots
                    or not _is_integer(slot.get("color")) or slot["color"] not in C.values()):
                raise ValueError("Invalid slot")
            for k in ("x", "y", "color"):
                slot[k] = int(slot[k])
            used_slots.add((slot["x"], slot["y"]))
    return levels


def refresh(level: Mapping[str, Any], state: World, events: list[dict[str, Any]],
            contact_protected: set[int]) -> None:
    """Simultaneous illumination, then red contacts. Mutates state/events/set."""
    illumination = {b["id"]: lit(level, state, b) for b in state["boxes"]}
    for box in state["boxes"]:
        old = box["color"]
        if box["kind"] == "photo":
            box["color"] = 14 if illumination[box["id"]] else 15
        elif box["color"] == 9 and illumination[box["id"]] and box["id"] not in contact_protected:
            box["color"] = 8
        if old != box["color"]:
            events.append({"type": "color", "id": box["id"], "from": old, "to": box["color"],
                           "reason": "light_state" if box["kind"] == "photo" else "exposure"})
    reds = [box for box in state["boxes"] if box["color"] == 8]
    touching: set[int] = set()
    for i, a in enumerate(reds):
        for b in reds[i + 1:]:
            if _man(a, b) == 1:
                touching.update((a["id"], b["id"]))
    for box in state["boxes"]:
        if box["id"] in touching:
            box["color"] = 9
            contact_protected.add(box["id"])
            events.append({"type": "color", "id": box["id"], "from": 8, "to": 9, "reason": "red_contact"})


def initial(level: Mapping[str, Any]) -> World:
    state = {"player": {"x": level["player"][0], "y": level["player"][1]},
             "dir": level["direction"],
             "boxes": [{**copy.deepcopy(b), "kind": "linked" if b["color"] in (8, 9) else "photo"}
                       for b in level["boxes"]],
             "turn": 0, "moves": 0, "rotations": 0, "waits": 0}
    refresh(level, state, [], set())
    return state


def attachments(state: World) -> list[int]:
    # Keep BFS insertion order: a Python set alone would not preserve JS Set order.
    ids: set[int] = set()
    ordered: list[int] = []
    queue = [state["player"]]
    for current in queue:
        for box in state["boxes"]:
            if box["color"] == 15 and box["id"] not in ids and _man(current, box) == 1:
                ids.add(box["id"])
                ordered.append(box["id"])
                queue.append(box)
    return ordered


def plan(level: Mapping[str, Any], state: World, seed: Sequence[int], dx: int, dy: int,
         move_player: bool = False) -> dict[str, Any]:
    """Plan a physical push, then independent blue broadcasts on one snapshot.

    The local chain is required. A failed distant chain is omitted, not a veto.
    All accepted boxes translate together, at most once; no crate is pushed
    through a blocked crate, wall, or stationary player.
    """
    boxes_by_id = {box["id"]: box for box in state["boxes"]}

    def physical_closure(roots: Sequence[int]) -> dict[str, Any]:
        queue = list(dict.fromkeys(roots))
        ids = set(queue)
        for box_id in queue:
            box = boxes_by_id.get(box_id)
            if box is None:
                return {"ok": False, "reason": "missing_box", "box": box_id}
            x, y = box["x"] + dx, box["y"] + dy
            if wall(level, x, y):
                return {"ok": False, "reason": "wall", "box": box_id}
            if not move_player and (x, y) == (state["player"]["x"], state["player"]["y"]):
                return {"ok": False, "reason": "player", "box": box_id}
            other = at(state, x, y)
            if other is not None and other["id"] not in ids:
                ids.add(other["id"])
                queue.append(other["id"])
        return {"ok": True, "ids": queue}

    roots = list(dict.fromkeys(seed))
    if move_player:
        x, y = state["player"]["x"] + dx, state["player"]["y"] + dy
        if wall(level, x, y):
            return {"ok": False, "reason": "wall"}
        front = at(state, x, y)
        if front is not None and front["id"] not in roots:
            roots.append(front["id"])
    direct = physical_closure(roots)
    if not direct["ok"]:
        return direct
    ids = set(direct["ids"])
    blocked_blues = []
    if any(boxes_by_id[i]["color"] == 9 for i in direct["ids"]):
        for box in state["boxes"]:
            if box["color"] != 9 or box["id"] in ids:
                continue
            branch = physical_closure([box["id"]])
            if branch["ok"]:
                ids.update(branch["ids"])
            else:
                blocked_blues.append({"id": box["id"], "reason": branch["reason"],
                                      "obstacle_box": branch["box"]})
    return {"ok": True, "ids": sorted(ids), "movePlayer": move_player, "dx": dx, "dy": dy,
            "blocked_blues": sorted((b for b in blocked_blues if b["id"] not in ids), key=lambda b: b["id"])}


def _execute(state: World, push: Mapping[str, Any]) -> None:
    if push["movePlayer"]:
        state["player"]["x"] += push["dx"]
        state["player"]["y"] += push["dy"]
    for box in state["boxes"]:
        if box["id"] in push["ids"]:
            box["x"] += push["dx"]
            box["y"] += push["dy"]


def transition(level: Mapping[str, Any], input_state: World, action: Mapping[str, Any],
               *, capture: bool = False) -> dict[str, Any]:
    """Pure logical transition. Optional keyframes are for rendering, not turns."""
    state = copy.deepcopy(input_state)
    events: list[dict[str, Any]] = []
    phases: list[dict[str, Any]] = []
    contact_protected: set[int] = set()

    def shot(kind: str, before: World | None = None) -> None:
        if capture:
            phases.append({"kind": kind, "state": copy.deepcopy(state),
                           "from": copy.deepcopy(before) if before is not None else None})

    def result(active: bool) -> dict[str, Any]:
        return {"state": state, "events": events, "phases": phases, "active": active, "won": solved(level, state)}

    kind = action.get("type")
    if kind == "aim":
        d = action.get("dir")
        if not _is_integer(d) or not 0 <= d <= 7 or d == state["dir"]:
            return result(False)
        state["dir"] = int(d)
        state["rotations"] += 1
        events.append({"type": "aim", "direction": state["dir"]})
        shot("aim")
    elif kind == "move":
        aid = action.get("id")
        if not _is_integer(aid) or aid not in MOVE:
            return result(False)
        dx, dy = MOVE[aid]
        attached = attachments(state)
        push = plan(level, state, attached, dx, dy, True)
        if push["ok"]:
            before = copy.deepcopy(state)
            _execute(state, push)
            state["moves"] += 1
            events.append({"type": "move", "direction": aid, "boxes": push["ids"], "attached": attached,
                           "synchronized": sum(b["color"] == 9 and b["id"] in push["ids"] for b in before["boxes"]),
                           "blocked_blues": push["blocked_blues"]})
            shot("move", before)
        else:
            events.append({"type": "blocked", "reason": push["reason"], "box": push.get("box")})
            shot("blocked")
    elif kind == "wait":
        state["waits"] += 1
        events.append({"type": "wait"})
        shot("wait")
    else:
        return result(False)
    state["turn"] += 1
    previous_count = len(events)
    refresh(level, state, events, contact_protected)
    if len(events) != previous_count:
        shot("reaction")
    green_ids = [box["id"] for box in state["boxes"] if box["color"] == 14]
    auto_moved: set[int] = set()
    for box_id in green_ids:
        box = next(b for b in state["boxes"] if b["id"] == box_id)
        if box["color"] != 14 or box_id in auto_moved:
            continue
        if box["x"] != state["player"]["x"] and box["y"] != state["player"]["y"]:
            continue
        dx, dy = _sign(box["x"] - state["player"]["x"]), _sign(box["y"] - state["player"]["y"])
        push = plan(level, state, [box_id], dx, dy)
        if not push["ok"]:
            events.append({"type": "repel_blocked", "id": box_id, "reason": push["reason"]})
            continue
        before = copy.deepcopy(state)
        _execute(state, push)
        auto_moved.update(push["ids"])
        events.append({"type": "repel", "id": box_id, "dx": dx, "dy": dy,
                       "boxes": push["ids"], "blocked_blues": push["blocked_blues"]})
        shot("repel", before)
        previous_count = len(events)
        refresh(level, state, events, contact_protected)
        if len(events) != previous_count:
            shot("reaction")
    shot("settled")
    return result(True)


def _fill(buf: bytearray, x: float, y: float, w: float, h: float, color: int) -> None:
    x0, x1 = max(0, _round(x)), min(64, _round(x + w))
    y0, y1 = max(0, _round(y)), min(64, _round(y + h))
    if x0 >= x1 or y0 >= y1:
        return
    row = bytes([color]) * (x1 - x0)
    for yy in range(y0, y1):
        buf[yy * 64 + x0:yy * 64 + x1] = row


def _outline(buf: bytearray, x: float, y: float, w: float, h: float, color: int) -> None:
    _fill(buf, x, y, w, 1, color)
    _fill(buf, x, y + h - 1, w, 1, color)
    _fill(buf, x, y, 1, h, color)
    _fill(buf, x + w - 1, y, 1, h, color)


def _line(buf: bytearray, x0: float, y0: float, x1: float, y1: float, color: int) -> None:
    x0, y0, x1, y1 = map(_round, (x0, y0, x1, y1))
    dx, sx, dy, sy = abs(x1 - x0), 1 if x0 < x1 else -1, -abs(y1 - y0), 1 if y0 < y1 else -1
    error = dx + dy
    for _ in range(128):
        _fill(buf, x0, y0, 1, 1, color)
        if x0 == x1 and y0 == y1:
            break
        e2 = error * 2
        if e2 >= dy:
            error += dy
            x0 += sx
        if e2 <= dx:
            error += dx
            y0 += sy


def render(level: Mapping[str, Any], state: World, options: Mapping[str, Any] | None = None) -> Raster:
    """Reproduce the web v4 raster, including the beam at interpolated positions.

    options is an author-rendering dictionary: completed, border, blocked, tween,
    example (zero-based), exampleCount. It does not change the logical state.
    """
    opts = options or {}
    completed, border = opts.get("completed", []), opts.get("border")
    blocked, tween = opts.get("blocked", False), opts.get("tween")
    example, example_count = opts.get("example", 0), opts.get("exampleCount", 1)
    buf = bytearray([5]) * 4096
    g, readings = geometry(level), matches(level, state)
    gp, ox, oy = g["p"], g["x"], g["y"]
    if tween is not None:
        lighting = {**state, "player": tween.get("p", state["player"]),
                    "boxes": [{**b, **tween.get(b["id"], tween.get(str(b["id"]), {}))} for b in state["boxes"]]}
    else:
        lighting = state
    opaque = _opaque_map(lighting)
    # Build once, but preserve first-box semantics of JS .find during interpolation.
    first_box = {cell: ids[0] for cell, ids in opaque.items()}
    for y in range(g["h"]):
        for x in range(g["w"]):
            px, py = ox + x * gp, oy + y * gp
            if wall(level, x, y):
                _fill(buf, px, py, gp, gp, 2)
                _fill(buf, px, py, gp, 1, 3)
                _fill(buf, px, py + gp - 1, gp, 1, 4)
                continue
            _fill(buf, px, py, gp, gp, 4)
            ignore_id = first_box.get((x, y))
            for yy in range(gp):
                for xx in range(gp):
                    tx = x + (xx - (gp - 1) / 2) / gp
                    ty = y + (yy - (gp - 1) / 2) / gp
                    if in_cone(lighting, tx, ty) and _ray_clear(level, lighting, tx, ty, ignore_id, opaque):
                        buf[(py + yy) * 64 + px + xx] = 1
    for target in level["slots"]:
        x, y = ox + target["x"] * gp, oy + target["y"] * gp
        for dx, dy in ((0, 0), (gp - 1, 0), (0, gp - 1), (gp - 1, gp - 1)):
            _fill(buf, x + dx, y + dy, 1, 1, target["color"])
    attached = set(attachments(state))
    pairs = [("p", state["player"])] + [(b["id"], b) for b in state["boxes"] if b["id"] in attached]
    for i, (_, a) in enumerate(pairs):
        for _, b in pairs[i + 1:]:
            if _man(a, b) == 1:
                _fill(buf, ox + (a["x"] + b["x"] + 1) * gp / 2 - 0.5,
                      oy + (a["y"] + b["y"] + 1) * gp / 2 - 0.5, 1, 1, 15)

    def point(who: Any, body: Mapping[str, Any]) -> Mapping[str, Any]:
        return tween.get(who, tween.get(str(who), body)) if tween is not None else body

    for box in state["boxes"]:
        p = point(box["id"], box)
        x, y, n = ox + p["x"] * gp + 1, oy + p["y"] * gp + 1, gp - 2
        _fill(buf, x, y, n, n, box["color"])
        if n >= 3:
            _fill(buf, x + 1, y + 1, 1, 1, 5)
        if any(t["x"] == box["x"] and t["y"] == box["y"] and t["match"] for t in readings):
            _fill(buf, x + n // 2, y + n // 2, 1, 1, 0)
    player = point("p", state["player"])
    px, py, n = ox + player["x"] * gp + 1, oy + player["y"] * gp + 1, gp - 2
    _outline(buf, px, py, n, n, 6 if blocked else 0)
    if n < 3:
        _fill(buf, px, py, n, n, 0)
    mid, (dx, dy) = (n - 1) / 2, DIRS[state["dir"]]
    _fill(buf, px + mid, py + mid, 1, 1, 5)
    _fill(buf, px + mid + dx * max(1, mid), py + mid + dy * max(1, mid), 1, 1, 11)
    if example_count > 1:
        for i in range(example_count):
            _fill(buf, 3 + i * 6, 1, 4, 1, 14 if i < example else 0 if i == example else 2)
    _fill(buf, 46, 47, 18, 17, 5)
    for y in range(48, 63):
        for x in range(48, 63):
            if 6.5 <= math.hypot(x - 55, y - 55) < 7.5:
                buf[y * 64 + x] = 2
    ex, ey = DIAL_POINTS[state["dir"]]
    _line(buf, 55, 55, ex, ey, 11)
    for i, (x, y) in enumerate(DIAL_POINTS):
        _fill(buf, x - 1, y - 1, 3, 3, 0 if i == state["dir"] else 3)
        _fill(buf, x, y, 1, 1, 11 if i == state["dir"] else 5)
    _fill(buf, 55, 55, 1, 1, 0)
    for i, r in enumerate(readings):
        _outline(buf, 2 + i * 5, 51, 4, 4, r["target"])
        if r["match"]:
            _fill(buf, 3 + i * 5, 52, 2, 2, 0)
    for i in range(6):
        _fill(buf, 2 + i * 5, 62, 4, 1, 14 if i < len(completed) and completed[i] else 2)
    if border is not None:
        _outline(buf, 0, 0, 64, 64, border)
    return [list(buf[y * 64:(y + 1) * 64]) for y in range(64)]


def dial_hit(x: Any, y: Any) -> int | None:
    if not (_is_integer(x) and _is_integer(y) and 47 <= x <= 63 and 47 <= y <= 63):
        return None
    best, distance = -1, math.inf
    for i, (px, py) in enumerate(DIAL_POINTS):
        d = (px - x) ** 2 + (py - y) ** 2
        if d < distance:
            best, distance = i, d
    return best if distance <= 5 else None


def _load_levels(directory: Path) -> list[Level]:
    paths = [directory / f"L{i:02d}.json" for i in range(1, LEVEL_COUNT + 1)]
    missing = [str(p) for p in paths if not p.is_file()]
    if missing:
        raise FileNotFoundError("Missing level data; copy the six JSON files with the engine: " + ", ".join(missing))
    levels = []
    for path in paths:
        try:
            levels.append(json.loads(path.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError(f"Cannot read level {path}: {exc}") from exc
    return validate(levels)


def _decode_action(action: Any, data: Any) -> tuple[int, Mapping[str, Any]]:
    if isinstance(action, Mapping):
        data, action = action.get("data") or {}, action.get("id")
    if isinstance(action, str):
        if action == "RESET":
            action = 0
        elif len(action) == 7 and action.startswith("ACTION") and action[-1] in "1234567":
            action = int(action[-1])
        else:
            action = -1
    aid = int(action) if _is_integer(action) and 0 <= action <= 7 else -1
    return aid, data if isinstance(data, Mapping) else {}


class CatchingWithoutSeeingEngine:
    """CustomGameInfo-compatible engine; the default data paths are file-relative.

    Provide info.game_id, title, family, levels and default_fps as in FITE and the
    previous custom_3 ports. levels_dir and level_data are optional, mutually
    exclusive author overrides. There must be six templates; info.levels can
    select a campaign prefix of 1..6. No configuration hint or solution is sent
    through public_state(). The preview helper uses one-based level numbers.
    """

    def __init__(self, info: CustomGameInfo, *, levels_dir: str | Path | None = None,
                 level_data: list[Level] | None = None) -> None:
        if levels_dir is not None and level_data is not None:
            raise ValueError("Use either levels_dir or level_data, not both")
        self.info = info
        self.levels_dir = Path(levels_dir).resolve() if levels_dir is not None else LEVELS_DIR
        self._templates = _load_levels(self.levels_dir) if level_data is None else validate(level_data)
        if len(self._templates) != LEVEL_COUNT:
            raise ValueError(f"Expected {LEVEL_COUNT} level templates, got {len(self._templates)}")
        self.win_levels = _integer(info.levels, "info.levels", 1, LEVEL_COUNT)
        self._fps = _integer(info.default_fps, "info.default_fps", 1, 240)
        self._examples = [[level, *level.get("extra_examples", [])] for level in self._templates]
        self._index = self._example = 0
        self._completed = [False] * LEVEL_COUNT
        self._world: World = {}
        self.step_index = 0
        self.test_mode = False
        self.state = "NOT_FINISHED"
        self.last_action = "RESET"
        self._event = "reset"
        self._setup(0)

    @property
    def _level(self) -> Level:
        return self._examples[self._index][self._example]

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    def _setup(self, index: int, example: int = 0) -> None:
        self._index, self._example = index, example
        self._world = initial(self._level)
        self.state = "NOT_FINISHED"

    def _visual(self, **options: Any) -> dict[str, Any]:
        return {"completed": self._completed, "example": self._example,
                "exampleCount": len(self._examples[self._index]), **options}

    def _render_frame(self, **options: Any) -> Raster:
        return render(self._level, self._world, self._visual(**options))

    def _envelope(self, *, frames: list[Raster] | None = None,
                  durations: list[int] | None = None, timeline: list[dict[str, Any]] | None = None,
                  events: list[dict[str, Any]] | None = None, **extra: Any) -> dict[str, Any]:
        frames = frames if frames else [self._render_frame()]
        ids = [7] if self.state == "WIN" else [1, 2, 3, 4, 5, 6, 7]
        score = self.levels_completed
        return {"backend": "custom", "selected": True,
                "game_id": self.info.game_id, "title": self.info.title,
                "custom_family": self.info.family, "family": FAMILY, "wave": WAVE, "version": WEB_VERSION,
                "frame": frames[-1], "frames": frames, "frame_count": len(frames),
                "default_fps": self._fps, "frame_durations_ms": durations if durations else [90],
                "timeline": timeline if timeline else [{"level": self._index + 1, "example": self._example + 1,
                                                        "turn": self._world["turn"], "kind": "observe"}],
                "state": self.state, "level": self._index + 1, "example": self._example + 1,
                "example_count": len(self._examples[self._index]), "completed": self._completed[:],
                "score": score, "levels_completed": score,
                "win_levels": 1 if self.test_mode else self.win_levels,
                "win_score": 1 if self.test_mode else self.win_levels,
                "available_actions": [f"ACTION{i}" for i in ids], "available_action_ids": ids,
                "step_index": self.step_index, "turn": self._world["turn"], "orientation": self._world["dir"],
                "readings": matches(self._level, self._world), "event": self._event,
                "events": events if events is not None else [], "test_mode": self.test_mode,
                "last_action": self.last_action, "full_reset": False, "source_path": str(self.levels_dir),
                "level_name": self._templates[self._index].get("title", ""), **extra}

    def public_state(self) -> dict[str, Any]:
        """A fresh single image, without replaying animation or advancing the world."""
        return self._envelope()

    def reset(self) -> dict[str, Any]:
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = False
        self.step_index = 0
        self.last_action, self._event = "RESET", "reset"
        self._setup(0)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self._completed[self._index] = False
        self.last_action, self._event = "ACTION7", "restart"
        self._setup(self._index, 0)
        return self.public_state()

    def action(self, action_id: int | str | Mapping[str, Any],
               data: dict[str, Any] | None = None) -> dict[str, Any]:
        aid, payload = _decode_action(action_id, data)
        if aid == 0:
            return self.reset()
        if aid == 7:
            return self.level_reset()
        if self.state == "WIN":
            return self.public_state()
        act: dict[str, Any] | None = {"type": "move", "id": aid} if aid in MOVE else {"type": "wait"} if aid == 5 else None
        if aid == 6:
            direction = dial_hit(payload.get("x"), payload.get("y"))
            if direction is not None:
                act = {"type": "aim", "dir": direction}
        if act is None:
            self._event = "ignored"
            return self.public_state()
        # Like the web engine, clicking the active dial direction counts as a
        # submitted native command, but not as a turn or a green-repulsion phase.
        self.step_index += 1
        self.last_action = f"ACTION{aid}"
        result = transition(self._level, self._world, act, capture=True)
        self._world = result["state"]
        if not result["active"]:
            self._event = "ignored"
            return self.public_state()
        frames: list[Raster] = []
        durations: list[int] = []
        timeline: list[dict[str, Any]] = []
        played, played_example = self._index + 1, self._example + 1

        def add(frame: Raster, kind: str, ms: int = 75) -> None:
            frames.append(frame)
            durations.append(ms)
            timeline.append({"level": self._index + 1, "example": self._example + 1,
                             "turn": self._world["turn"], "kind": kind})

        for phase in result["phases"]:
            before = phase["from"]
            if before is not None:
                n = geometry(self._level)["p"]
                previous = {box["id"]: box for box in before["boxes"]}
                for i in range(1, n + 1):
                    t = i / n
                    p0, p1 = before["player"], phase["state"]["player"]
                    tween: dict[Any, Any] = {"p": {"x": p0["x"] + (p1["x"] - p0["x"]) * t,
                                                  "y": p0["y"] + (p1["y"] - p0["y"]) * t}}
                    for box in phase["state"]["boxes"]:
                        old = previous[box["id"]]
                        tween[box["id"]] = {"x": old["x"] + (box["x"] - old["x"]) * t,
                                            "y": old["y"] + (box["y"] - old["y"]) * t}
                    add(render(self._level, phase["state"], self._visual(tween=tween)), phase["kind"], 45)
            else:
                add(render(self._level, phase["state"], self._visual(blocked=phase["kind"] == "blocked")),
                    phase["kind"], 180 if phase["kind"] == "reaction" else 90)
        self._event = "blocked" if any(e["type"] == "blocked" for e in result["events"]) else "acted"
        if result["won"]:
            if self._example + 1 < len(self._examples[self._index]):
                result["events"].append({"type": "example_success", "level": played, "example": played_example})
                add(self._render_frame(border=0), "example_success", 450)
                add(self._render_frame(), "example_pause", 350)
                self._setup(self._index, self._example + 1)
                self._event = "example_success"
                add(self._render_frame(), "example_ready", 350)
            else:
                self._completed[self._index] = True
                result["events"].append({"type": "success", "level": played})
                for _ in range(3):
                    add(self._render_frame(border=14), "success_on", 400)
                    add(self._render_frame(), "success_off", 250)
                if self.test_mode or self._index + 1 >= self.win_levels:
                    self.state = "WIN"
                else:
                    self._setup(self._index + 1)
                self._event = "win" if self.state == "WIN" else "success"
                add(self._render_frame(), "ready", 90)
        return self._envelope(frames=frames, durations=durations, timeline=timeline,
                              events=result["events"], played_level=played, played_example=played_example)

    def jump_to_level(self, number: int, isolated: bool = True) -> dict[str, Any]:
        """Author/UI preview only, with ONE-BASED level numbers; not an agent action."""
        index = _integer(number, "level", 1, LEVEL_COUNT) - 1
        if not isolated and index >= self.win_levels:
            raise ValueError("Preview level lies outside the configured campaign prefix")
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = bool(isolated)
        self.step_index = 0
        self.last_action, self._event = "PREVIEW", "level"
        self._setup(index)
        return self.public_state()

    def inspect(self) -> World:
        """Author-only copied state. Never an available action or solver input."""
        return copy.deepcopy(self._world)

    def metadata(self) -> list[dict[str, Any]]:
        return [{"level": i + 1, "title": level.get("title", ""), "boxes": len(level["boxes"]),
                 "examples": len(self._examples[i])} for i, level in enumerate(self._templates)]

    def view(self) -> dict[str, Any]:
        """Human-viewer extras, intentionally separate from public_state()."""
        current, parent = self._level, self._templates[self._index]
        return {**self.public_state(), **self.inspect(), "title": parent.get("title", ""),
                "example_title": current.get("example_title", current.get("title", "")),
                "stage": current.get("stage", parent.get("stage", "")),
                "lesson": current.get("lesson"), "hint": current.get("hint"),
                "geometry": geometry(current), "slots": copy.deepcopy(current["slots"]),
                "attached": attachments(self._world)}

    step = action
    observe = public_state
    levelReset = level_reset
    jumpToLevel = jump_to_level  # ONE-BASED, as in the previous Python deliveries.


# Author helper aliases ease direct comparisons with the web engine's exports.
inCone = in_cone
rayClear = ray_clear
dialHit = dial_hit
CatchingEngine = CatchingWithoutSeeingEngine

__all__ = ["CatchingWithoutSeeingEngine", "CatchingEngine", "SIZE", "FRAME", "LEVEL_COUNT",
           "GAME_ID", "FAMILY", "WAVE", "WEB_VERSION", "ANIM_FPS", "LEVELS_DIR", "PALETTE",
           "C", "DIRS", "DIR_NAMES", "MOVE", "DIAL_POINTS", "geometry", "wall", "at",
           "in_cone", "ray_clear", "lit", "matches", "solved", "signature", "validate",
           "initial", "refresh", "attachments", "plan", "transition", "render", "dial_hit"]
