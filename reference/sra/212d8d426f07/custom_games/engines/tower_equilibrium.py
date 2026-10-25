from __future__ import annotations

import json
import math
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

# TOWER EQUILIBRIUM v5.5 — Python port of the approved web prototype.
# Runtime: standard library only.

FRAME = 64
CELL = 4
GRID_W = 16
GRID_H = 15
HUD_Y = 60
BEAM_H = 2
WIDTHS = (3, 5, 7)

BG = 5
WHITE = 0
LIGHT = 1
MID = 3
DARK = 4
MAGENTA = 6
RED = 8
BLUE = 9
CYAN = 10
YELLOW = 11
ORANGE = 12
BROWN = 13
GREEN = 14
PURPLE = 15

PALETTE = [
    "#FFFFFF", "#CCCCCC", "#999999", "#666666",
    "#333333", "#000000", "#E53AA3", "#FF7BCC",
    "#F93C31", "#1E93FF", "#88D8F1", "#FFDC00",
    "#FF851B", "#895D3B", "#4FCC30", "#A356D6",
]

MASS_PER_CELL = 1.0
MOMENT_CAP = 5.0
BEAM_BEARING_CAP = 5.0
BASE_BEARING_CAP = 6.0
PAD_BEARING_CAP = 20.0
EPS = 1e-9

ACTION_LONGER = 1
ACTION_SHORTER = 2
ACTION_LEFT = 3
ACTION_RIGHT = 4
ACTION_PLACE = 5
ACTION_CLICK = 6
ACTION_RESET = 7

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "tower_equilibrium" / "levels"

Level = dict[str, Any]
State = dict[str, Any]
Frame = list[list[int]]


def _is_int(value: Any) -> bool:
    return type(value) is int


def _js_round(value: float) -> int:
    # JavaScript Math.round(x) for finite values used by this game.
    return math.floor(value + 0.5)


def rect(raw: list[Any] | tuple[Any, ...], kind: str, fid: str | None = None) -> dict[str, Any]:
    out = {"x": int(raw[0]), "y": int(raw[1]), "w": int(raw[2]), "h": int(raw[3]), "kind": kind}
    if fid is not None:
        out["fid"] = fid
    if kind == "base":
        out["slotW"] = int(raw[5]) if len(raw) > 5 else int(raw[2])
    return out


def overlap_x(a: dict[str, Any], b: dict[str, Any]) -> float:
    return max(0.0, min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"]))


def overlap_rect(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return (
        a["x"] < b["x"] + b["w"]
        and a["x"] + a["w"] > b["x"]
        and a["y"] < b["y"] + b["h"]
        and a["y"] + a["h"] > b["y"]
    )


def base_slot(base: dict[str, Any]) -> dict[str, Any]:
    w = min(base["slotW"], base["w"])
    x = base["x"] + (base["w"] - w) // 2
    return {"x": x, "y": base["y"], "w": w, "h": 1, "kind": "slot", "fid": base["fid"]}


def statics(level: Level) -> list[dict[str, Any]]:
    return [rect(b, "base", b[4]) for b in level["bases"]] + [rect(p, "pad") for p in level["pads"]]


def blockers(level: Level) -> list[dict[str, Any]]:
    return [rect(b, "block") for b in level["blocks"]]


def support_interval(beam: dict[str, Any], support: dict[str, Any]) -> tuple[float, float] | None:
    effective = base_slot(support) if support["kind"] == "base" else support
    left = max(beam["x"], effective["x"])
    right = min(beam["x"] + beam["w"], effective["x"] + effective["w"])
    return (left, right) if right > left else None


def validate_level(raw: Any) -> Level:
    if not isinstance(raw, dict):
        raise ValueError("Level must be an object.")
    for key in ("target", "bases", "pads", "blocks", "stock", "solution"):
        if not isinstance(raw.get(key), list):
            raise ValueError(f"Missing/invalid level field: {key}")
    if len(raw["bases"]) != 2:
        raise ValueError("Exactly two bases are required.")
    if len(raw["stock"]) != 3 or any(not _is_int(n) or n < 0 for n in raw["stock"]):
        raise ValueError("Invalid stock.")
    all_geometry = [raw["target"], *[b[:4] for b in raw["bases"]], *raw["pads"], *raw["blocks"]]
    for item in all_geometry:
        if len(item) < 4 or any(not _is_int(v) for v in item[:4]):
            raise ValueError("All geometry must use integer grid coordinates.")
    for item in raw["solution"]:
        if not isinstance(item, list) or len(item) != 2 or not _is_int(item[0]) or item[1] not in WIDTHS:
            raise ValueError("Solution must contain [x,width] pairs on the grid.")
    return deepcopy(raw)


def load_levels(path: str | Path = LEVELS_DIR) -> list[Level]:
    files = sorted(Path(path).glob("L*.json"))
    levels = [validate_level(json.loads(p.read_text(encoding="utf-8"))) for p in files]
    if len(levels) != 6:
        raise ValueError(f"Expected 6 levels, found {len(levels)} in {path}")
    return levels


def create_state(level: Level) -> State:
    return {
        "beams": [],
        "ghostX": int(level["startX"]),
        "lengthIndex": 2,
        "used": [0, 0, 0],
        "status": "READY",
        "lastEvent": "READY",
        "actions": 0,
    }


def length_index_for_width(width: int) -> int:
    try:
        return WIDTHS.index(width)
    except ValueError:
        return -1


def remaining(level: Level, state: State, index: int) -> int:
    return int(level["stock"][index] - state["used"][index])


def landing_info(level: Level, state: State, x: int, width: int) -> dict[str, Any]:
    probe = {"x": x, "y": 0, "w": width, "h": BEAM_H}
    hits = [r for r in [*statics(level), *state["beams"]] if overlap_x(probe, r) > 0]
    if not hits:
        return {"valid": False, "reason": "NO_SUPPORT"}
    top = min(r["y"] for r in hits)
    y = top - BEAM_H
    candidate = {"x": x, "y": y, "w": width, "h": BEAM_H, "kind": "beam"}
    if y < 0:
        return {"valid": False, "reason": "NO_HEIGHT"}
    if any(overlap_rect(candidate, r) for r in blockers(level)):
        return {"valid": False, "reason": "BLOCKED"}
    if any(overlap_rect(candidate, r) for r in state["beams"]):
        return {"valid": False, "reason": "OCCUPIED"}
    first = [r for r in hits if r["y"] == top]
    supported = False
    for item in first:
        if item["kind"] == "base":
            if support_interval(candidate, item) is not None:
                supported = True
        else:
            supported = True
    if not supported:
        return {"valid": False, "reason": "BASE_SLOT_MISSED"}
    return {"valid": True, "y": y, "candidate": candidate}


def contacts_for(level: Level, beams: list[dict[str, Any]], index: int) -> list[dict[str, Any]]:
    beam = beams[index]
    out: list[dict[str, Any]] = []
    for support in statics(level):
        if support["y"] == beam["y"] + BEAM_H:
            interval = support_interval(beam, support)
            if interval is not None:
                left, right = interval
                out.append({
                    "l": left, "r": right, "type": "static", "ref": support,
                    "c": (left + right) / 2.0, "hard": True,
                })
    for j, other in enumerate(beams):
        if j == index or other["y"] != beam["y"] + BEAM_H:
            continue
        left = max(beam["x"], other["x"])
        right = min(beam["x"] + beam["w"], other["x"] + other["w"])
        if right > left:
            out.append({
                "l": left, "r": right, "type": "beam", "ref": j,
                "c": (left + right) / 2.0, "hard": False,
            })
    return out


def analyze(level: Level, state: State) -> dict[str, Any]:
    beams = state["beams"]
    n = len(beams)
    applied: list[list[dict[str, float]]] = [[] for _ in range(n)]
    stress = [0.0] * n
    load_stress = [0.0] * n
    components: list[dict[str, float] | None] = [None] * n
    resultant: list[float | None] = [None] * n
    base_loads = {"A": 0.0, "B": 0.0}
    stable = True

    foundations: list[set[str]] = [set() for _ in range(n)]
    for i in sorted(range(n), key=lambda q: beams[q]["y"], reverse=True):
        for contact in contacts_for(level, beams, i):
            if contact["type"] == "static" and contact["ref"]["kind"] == "base":
                foundations[i].add(contact["ref"]["fid"])
            elif contact["type"] == "beam":
                foundations[i].update(foundations[contact["ref"]])

    for i in sorted(range(n), key=lambda q: beams[q]["y"]):
        beam = beams[i]
        incoming = applied[i]
        loads = [
            {"x": beam["x"] + q + 0.5, "force": MASS_PER_CELL}
            for q in range(beam["w"])
        ]
        loads.extend(incoming)
        force = sum(p["force"] for p in loads)
        rx = sum(p["x"] * p["force"] for p in loads) / force
        resultant[i] = rx

        contacts = contacts_for(level, beams, i)
        if not contacts:
            stress[i] = 2.0
            stable = False
            continue

        hard = [c for c in contacts if c["hard"] and c["l"] - EPS <= rx <= c["r"] + EPS]
        active = hard if hard else contacts
        left = min(c["l"] for c in active)
        right = max(c["r"] for c in active)
        center = (left + right) / 2.0
        half = max(0.5, (right - left) / 2.0)
        tip = abs(rx - center) / half
        if rx < left - EPS or rx > right + EPS:
            stable = False

        ordered = sorted(active, key=lambda c: c["c"])
        reactions: list[dict[str, Any]] = []
        if len(ordered) == 1:
            contact = ordered[0]
            qx = max(contact["l"], min(contact["r"], rx))
            reactions = [{"x": qx, "force": force, "contact": contact}]
        else:
            left_c, right_c = ordered[0], ordered[-1]
            x_left, x_right = left_c["c"], right_c["c"]
            if rx < x_left - EPS or rx > x_right + EPS:
                cover = next((c for c in active if c["l"] - EPS <= rx <= c["r"] + EPS), None)
                if cover is not None:
                    reactions = [{"x": rx, "force": force, "contact": cover}]
                else:
                    stable = False
            else:
                f_left = force * (x_right - rx) / (x_right - x_left)
                f_right = force - f_left
                reactions = [
                    {"x": x_left, "force": max(0.0, f_left), "contact": left_c},
                    {"x": x_right, "force": max(0.0, f_right), "contact": right_c},
                ]

        max_moment = 0.0
        for q in range(2 * beam["w"] + 1):
            xx = beam["x"] + q * 0.5
            moment = 0.0
            for p in loads:
                if p["x"] <= xx:
                    moment += p["force"] * (xx - p["x"])
            for reaction in reactions:
                if reaction["x"] <= xx:
                    moment -= reaction["force"] * (xx - reaction["x"])
            max_moment = max(max_moment, abs(moment))

        bend = max_moment / (MOMENT_CAP * beam["w"])
        contact_width = sum(c["r"] - c["l"] for c in active)
        cap = BEAM_BEARING_CAP
        if any(c["type"] == "static" and c["ref"]["kind"] == "pad" for c in active):
            cap = PAD_BEARING_CAP
        elif any(c["type"] == "static" and c["ref"]["kind"] == "base" for c in active):
            cap = BASE_BEARING_CAP
        bearing = force / (max(0.5, contact_width) * cap)
        util = max(tip, bend, bearing)
        external_force = sum(p["force"] for p in incoming)
        load_stress[i] = max(bend, bearing) if external_force > EPS else 0.0
        components[i] = {"tip": tip, "bend": bend, "bearing": bearing, "load": load_stress[i]}
        stress[i] = util
        if util > 1.0 + EPS:
            stable = False

        for reaction in reactions:
            if reaction["force"] <= EPS:
                continue
            contact = reaction["contact"]
            if contact["type"] == "beam":
                applied[contact["ref"]].append({"force": reaction["force"], "x": reaction["x"]})
            elif contact["ref"]["kind"] == "base":
                base_loads[contact["ref"]["fid"]] += reaction["force"]

    return {
        "stable": stable,
        "stress": stress,
        "loadStress": load_stress,
        "components": components,
        "resultant": resultant,
        "baseLoads": base_loads,
        "foundations": [sorted(s) for s in foundations],
    }


def target_signals(level: Level, state: State, analysis: dict[str, Any] | None = None) -> dict[str, bool]:
    analysis = analysis or analyze(level, state)
    target = rect(level["target"], "target")
    signal_a = signal_b = both = False
    for i, beam in enumerate(state["beams"]):
        if overlap_rect(beam, target):
            fs = set(analysis["foundations"][i])
            signal_a = signal_a or "A" in fs
            signal_b = signal_b or "B" in fs
            both = both or ("A" in fs and "B" in fs)
    return {"A": signal_a, "B": signal_b, "both": both}


def target_connection(level: Level, state: State) -> dict[str, Any]:
    analysis = analyze(level, state)
    target = rect(level["target"], "target")
    index = -1
    for i, beam in enumerate(state["beams"]):
        if overlap_rect(beam, target):
            fs = set(analysis["foundations"][i])
            if "A" in fs and "B" in fs:
                index = i
                break
    return {"index": index, "analysis": analysis}


def is_win(level: Level, state: State) -> bool:
    connection = target_connection(level, state)
    return bool(connection["analysis"]["stable"] and connection["index"] >= 0)


def stress_color(value: float) -> int:
    if value <= 0.20:
        return GREEN
    if value <= 0.40:
        return ORANGE
    if value <= 0.60:
        return YELLOW
    if value <= 0.80:
        return BROWN
    return RED


def try_place(level: Level, state: State, x: int | None = None, width: int | None = None) -> dict[str, Any]:
    if state["status"] != "READY":
        return {"state": state, "event": "IGNORED"}
    idx = state["lengthIndex"] if width is None else length_index_for_width(width)
    if idx < 0:
        return {"state": state, "event": "BAD_WIDTH"}
    if remaining(level, state, idx) <= 0:
        return {"state": state, "event": "NO_STOCK"}
    w = WIDTHS[idx]
    px = max(0, min(GRID_W - w, state["ghostX"] if x is None else int(x)))
    land = landing_info(level, state, px, w)
    if not land["valid"]:
        return {"state": state, "event": "INVALID", "reason": land["reason"]}
    nxt = deepcopy(state)
    nxt["beams"].append(land["candidate"])
    nxt["used"][idx] += 1
    nxt["actions"] += 1
    nxt["lastEvent"] = "PLACED"
    analysis = analyze(level, nxt)
    if not analysis["stable"]:
        nxt["status"] = "COLLAPSE"
        nxt["lastEvent"] = "COLLAPSE"
        return {"state": nxt, "event": "COLLAPSE", "analysis": analysis}
    if is_win(level, nxt):
        nxt["status"] = "WIN"
        nxt["lastEvent"] = "WIN"
        return {"state": nxt, "event": "WIN", "analysis": analysis}
    return {"state": nxt, "event": "PLACED", "analysis": analysis}


def move_ghost(level: Level, state: State, delta: int) -> State:
    if state["status"] != "READY":
        return state
    nxt = deepcopy(state)
    w = WIDTHS[nxt["lengthIndex"]]
    nxt["ghostX"] = max(0, min(GRID_W - w, nxt["ghostX"] + delta))
    nxt["lastEvent"] = "MOVED" if nxt["ghostX"] != state["ghostX"] else "EDGE"
    return nxt


def set_length(level: Level, state: State, index: int) -> State:
    if state["status"] != "READY":
        return state
    nxt = deepcopy(state)
    old = nxt["lengthIndex"]
    nxt["lengthIndex"] = max(0, min(2, int(index)))
    w = WIDTHS[nxt["lengthIndex"]]
    nxt["ghostX"] = max(0, min(GRID_W - w, nxt["ghostX"]))
    nxt["lastEvent"] = "LENGTH_CHANGED" if nxt["lengthIndex"] != old else "LENGTH_EDGE"
    return nxt


def beam_has_load_above(state: State, index: int) -> bool:
    beam = state["beams"][index]
    return any(
        j != index and upper["y"] + BEAM_H == beam["y"] and overlap_x(upper, beam) > 0
        for j, upper in enumerate(state["beams"])
    )


def is_beam_removable(level: Level, state: State, index: int) -> bool:
    return (
        state["status"] == "READY"
        and _is_int(index)
        and 0 <= index < len(state["beams"])
        and not beam_has_load_above(state, index)
    )


def beam_at(state: State, cell_x: int, cell_y: int) -> int:
    for i in range(len(state["beams"]) - 1, -1, -1):
        beam = state["beams"][i]
        if beam["x"] <= cell_x < beam["x"] + beam["w"] and beam["y"] <= cell_y < beam["y"] + BEAM_H:
            return i
    return -1


def removable_beam_at(level: Level, state: State, cell_x: int, cell_y: int) -> int:
    if state["status"] != "READY":
        return -1
    index = beam_at(state, cell_x, cell_y)
    return index if is_beam_removable(level, state, index) else -1


def remove_beam(level: Level, state: State, index: int) -> dict[str, Any]:
    if not is_beam_removable(level, state, index):
        return {"state": state, "event": "NOT_REMOVABLE"}
    nxt = deepcopy(state)
    beam = nxt["beams"].pop(index)
    li = length_index_for_width(beam["w"])
    if li >= 0:
        nxt["used"][li] = max(0, nxt["used"][li] - 1)
    nxt["actions"] += 1
    nxt["lastEvent"] = "REMOVED"
    return {"state": nxt, "event": "REMOVED", "analysis": analyze(level, nxt)}


def click(level: Level, state: State, x: int, y: int) -> dict[str, Any]:
    if state["status"] != "READY" or not (_is_int(x) and _is_int(y) and 0 <= x < FRAME and 0 <= y < FRAME):
        return {"state": state, "event": "IGNORED"}
    if y < HUD_Y:
        cell_x, cell_y = x // CELL, y // CELL
        any_beam = beam_at(state, cell_x, cell_y)
        top_beam = removable_beam_at(level, state, cell_x, cell_y)
        if top_beam >= 0:
            return remove_beam(level, state, top_beam)
        if any_beam >= 0:
            nxt = deepcopy(state)
            nxt["lastEvent"] = "NOT_REMOVABLE"
            return {"state": nxt, "event": "NOT_REMOVABLE"}
        nxt = deepcopy(state)
        width = WIDTHS[nxt["lengthIndex"]]
        cell = _js_round((x / CELL) - width / 2.0)
        nxt["ghostX"] = max(0, min(GRID_W - width, cell))
        nxt["lastEvent"] = "MOVED"
        return {"state": nxt, "event": "MOVED"}
    if x >= 40:
        index = max(0, min(2, (x - 40) // 8))
        nxt = set_length(level, state, index)
        return {"state": nxt, "event": nxt["lastEvent"]}
    return {"state": state, "event": "IGNORED"}


def transition(level: Level, state: State, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
    if action_id == ACTION_RESET:
        return {"state": create_state(level), "event": "LEVEL_RESET"}
    if state["status"] != "READY":
        return {"state": state, "event": "IGNORED"}
    if action_id == ACTION_LONGER:
        nxt = set_length(level, state, min(2, state["lengthIndex"] + 1))
        return {"state": nxt, "event": nxt["lastEvent"]}
    if action_id == ACTION_SHORTER:
        nxt = set_length(level, state, max(0, state["lengthIndex"] - 1))
        return {"state": nxt, "event": nxt["lastEvent"]}
    if action_id == ACTION_LEFT:
        nxt = move_ghost(level, state, -1)
        return {"state": nxt, "event": nxt["lastEvent"]}
    if action_id == ACTION_RIGHT:
        nxt = move_ghost(level, state, +1)
        return {"state": nxt, "event": nxt["lastEvent"]}
    if action_id == ACTION_PLACE:
        return try_place(level, state)
    if action_id == ACTION_CLICK:
        data = data or {}
        return click(level, state, data.get("x"), data.get("y"))
    return {"state": state, "event": "IGNORED"}


def _blank() -> Frame:
    return [[BG] * FRAME for _ in range(FRAME)]


def _put(frame: Frame, x: int, y: int, color: int) -> None:
    if 0 <= x < FRAME and 0 <= y < FRAME:
        frame[y][x] = color


def _fill(frame: Frame, x: int, y: int, w: int, h: int, color: int) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            _put(frame, xx, yy, color)


def _outline(frame: Frame, x: int, y: int, w: int, h: int, color: int) -> None:
    _fill(frame, x, y, w, 1, color)
    _fill(frame, x, y + h - 1, w, 1, color)
    _fill(frame, x, y, 1, h, color)
    _fill(frame, x + w - 1, y, 1, h, color)


def _px(item: dict[str, Any]) -> dict[str, int]:
    return {"x": item["x"] * CELL, "y": item["y"] * CELL, "w": item["w"] * CELL, "h": item["h"] * CELL}


def base_active(level: Level, state: State, fid: str, analysis: dict[str, Any] | None = None) -> bool:
    analysis = analysis or analyze(level, state)
    return analysis["baseLoads"][fid] > EPS


def render(
    level: Level,
    state: State,
    progress: Any = (),
    options: dict[str, Any] | None = None,
) -> Frame:
    options = options or {}
    frame = _blank()
    analysis = analyze(level, state)
    signals = target_signals(level, state, analysis)
    fall = int(options.get("fallOffset", 0))

    # Quiet 4×4 construction grid.
    for y in range(0, HUD_Y, CELL):
        for x in range(0, FRAME, CELL):
            _fill(frame, x, y, 1, 1, DARK)

    target = _px(rect(level["target"], "target"))
    _fill(frame, target["x"], target["y"], target["w"], target["h"], DARK)
    _outline(frame, target["x"], target["y"], target["w"], target["h"], GREEN if signals["both"] else CYAN)
    _fill(frame, target["x"] + 2, target["y"] + 1, 3, max(1, target["h"] - 2), GREEN if signals["A"] else CYAN)
    _fill(frame, target["x"] + 3, target["y"] + 1, 1, 1, BLUE)
    _fill(frame, target["x"] + target["w"] - 5, target["y"] + 1, 3, max(1, target["h"] - 2), GREEN if signals["B"] else CYAN)
    _fill(frame, target["x"] + target["w"] - 4, target["y"] + 1, 1, 1, PURPLE)

    for raw in level["bases"]:
        base = rect(raw, "base", raw[4])
        pr = _px(base)
        slot = _px(base_slot(base))
        lamp = BLUE if base["fid"] == "A" else PURPLE
        connected = signals["A"] if base["fid"] == "A" else signals["B"]
        _fill(frame, pr["x"], pr["y"], pr["w"], pr["h"], DARK)
        _fill(frame, pr["x"] + 2, pr["y"] + 3, max(4, pr["w"] - 4), max(3, pr["h"] - 4), lamp)
        if connected:
            _outline(frame, pr["x"], pr["y"], pr["w"], pr["h"], LIGHT)
            _fill(frame, pr["x"] + pr["w"] // 2 - 2, pr["y"] + 4, 4, 2, WHITE)
        else:
            _fill(frame, pr["x"] + pr["w"] // 2 - 1, pr["y"] + 4, 2, 2, WHITE)
        _fill(frame, slot["x"], slot["y"], slot["w"], 2, GREEN if base_active(level, state, base["fid"], analysis) else CYAN)

    for raw in level["pads"]:
        pr = _px(rect(raw, "pad"))
        _fill(frame, pr["x"], pr["y"] + 2, pr["w"], max(1, pr["h"] - 2), DARK)
        _fill(frame, pr["x"], pr["y"], pr["w"], 2, CYAN)
        _fill(frame, pr["x"], pr["y"], 2, pr["h"], LIGHT)

    for raw in level["blocks"]:
        pr = _px(rect(raw, "block"))
        _fill(frame, pr["x"], pr["y"], pr["w"], pr["h"], DARK)
        _outline(frame, pr["x"], pr["y"], pr["w"], pr["h"], RED)
        for x in range(pr["x"] + 2, pr["x"] + pr["w"] - 1, 4):
            _fill(frame, x, pr["y"] + 1, 1, max(1, pr["h"] - 2), RED)

    for i, beam in enumerate(state["beams"]):
        pr = _px(beam)
        yy = pr["y"] + fall
        load_util = analysis["loadStress"][i] if i < len(analysis["loadStress"]) else 0.0
        fs = set(analysis["foundations"][i])
        _fill(frame, pr["x"], yy, pr["w"], pr["h"], stress_color(load_util))
        _fill(frame, pr["x"], yy, pr["w"], 1, LIGHT)
        _fill(frame, pr["x"], yy + pr["h"] - 1, pr["w"], 1, DARK)
        if "A" in fs:
            _fill(frame, pr["x"] + 1, yy + 2, 2, 2, BLUE)
        if "B" in fs:
            _fill(frame, pr["x"] + pr["w"] - 3, yy + 2, 2, 2, PURPLE)
        if not fall and analysis["resultant"][i] is not None:
            cx = max(beam["x"], min(beam["x"] + beam["w"] - EPS, analysis["resultant"][i]))
            xx = min(63, math.floor(cx * CELL))
            tip = (analysis["components"][i] or {}).get("tip", 0.0)
            marker_color = stress_color(tip)
            mx = max(pr["x"], min(pr["x"] + pr["w"] - 3, xx - 1))
            _outline(frame, mx, yy, 3, 5, DARK)
            _fill(frame, mx + 1, yy + 1, 1, 3, marker_color)

    # Redraw target above beams.
    _outline(frame, target["x"], target["y"], target["w"], target["h"], GREEN if signals["both"] else CYAN)
    _fill(frame, target["x"] + 2, target["y"] + 1, 3, max(1, target["h"] - 2), GREEN if signals["A"] else CYAN)
    _fill(frame, target["x"] + 3, target["y"] + 1, 1, 1, BLUE)
    _fill(frame, target["x"] + target["w"] - 5, target["y"] + 1, 3, max(1, target["h"] - 2), GREEN if signals["B"] else CYAN)
    _fill(frame, target["x"] + target["w"] - 4, target["y"] + 1, 1, 1, PURPLE)

    if state["status"] == "READY" and not is_win(level, state):
        width = WIDTHS[state["lengthIndex"]]
        x = max(0, min(GRID_W - width, state["ghostX"]))
        land = landing_info(level, state, x, width)
        stock_ok = remaining(level, state, state["lengthIndex"]) > 0
        ghost_y = max(0, int(land.get("y", 11)) * CELL)
        _outline(frame, x * CELL, ghost_y, width * CELL, BEAM_H * CELL, WHITE if land["valid"] and stock_ok else RED)

    _fill(frame, 0, HUD_Y, 64, 4, DARK)
    done = set(progress)
    for i in range(6):
        _fill(frame, 2 + i * 6, 61, 5, 2, GREEN if i in done else MID)
    for i in range(3):
        x = 40 + i * 8
        _outline(frame, x, 60, 7, 4, WHITE if i == state["lengthIndex"] else MID)
        rem = max(0, remaining(level, state, i))
        for d in range(min(10, rem)):
            _fill(frame, x + 1 + (d % 5), 61 + (d // 5), 1, 1, GREEN)

    outline_color = options.get("outline")
    if outline_color is not None:
        _outline(frame, 0, 0, 64, 60, int(outline_color))
    return frame


def replay_solution(level: Level) -> dict[str, Any]:
    state = create_state(level)
    peak = 0.0
    steps = []
    for x, width in level["solution"]:
        result = try_place(level, state, x, width)
        state = result["state"]
        analysis = analyze(level, state)
        peak = max([peak, *analysis["stress"]]) if analysis["stress"] else peak
        steps.append({"x": x, "w": width, "event": result["event"], "peak": peak})
        if result["event"] in {"COLLAPSE", "INVALID", "NO_STOCK"}:
            break
    return {
        "state": state,
        "win": is_win(level, state),
        "peakStress": peak,
        "steps": steps,
        "analysis": analyze(level, state),
    }


def direct_foundation_bridge_possible(level: Level) -> list[dict[str, int]]:
    state = create_state(level)
    out = []
    for width in WIDTHS:
        idx = length_index_for_width(width)
        if level["stock"][idx] <= 0:
            continue
        for x in range(GRID_W - width + 1):
            result = try_place(level, state, x, width)
            if result["event"] not in {"PLACED", "WIN"}:
                continue
            fs = set(analyze(level, result["state"])["foundations"][-1])
            if {"A", "B"}.issubset(fs):
                out.append({"x": x, "w": width})
    return out


def _animation_frames(
    level: Level,
    before: State,
    result: dict[str, Any],
    progress: set[int],
    animate: bool,
) -> tuple[list[Frame], list[int], State]:
    after = result["state"]
    event = result["event"]
    frames: list[Frame] = []
    durations: list[int] = []

    def push(state: State, ms: int, options: dict[str, Any] | None = None, prog: set[int] | None = None) -> None:
        frames.append(render(level, state, progress if prog is None else prog, options))
        durations.append(ms)

    final_state = after
    if animate:
        if event in {"INVALID", "NO_STOCK", "BAD_WIDTH"}:
            for color in (RED, None, RED, None, RED):
                push(before, 90, {"outline": color})
        elif event == "NOT_REMOVABLE":
            for color in (MAGENTA, None, MAGENTA, None, MAGENTA):
                push(after, 80, {"outline": color})
        elif event == "COLLAPSE":
            for fall in range(0, 44, 4):
                push(after, 55, {"fallOffset": fall})
            final_state = create_state(level)
            push(final_state, 260)
        elif event == "WIN":
            win_progress = set(progress)
            # Current level index equals number of already-completed levels.
            win_progress.add(len(progress))
            for color in (GREEN, None, GREEN, None, GREEN, None, GREEN):
                push(after, 95, {"outline": color}, win_progress)
    if not frames or event not in {"COLLAPSE"}:
        final_progress = set(progress)
        if event == "WIN":
            final_progress.add(len(progress))
        final_frame = render(level, final_state, final_progress)
        if not frames or frames[-1] != final_frame:
            frames.append(final_frame)
            durations.append(0)
        elif durations:
            durations[-1] = 0
    return frames, durations, final_state


class GameInfoLike(Protocol):
    game_id: str
    title: str
    family: str
    levels: int
    default_fps: float


@dataclass(frozen=True)
class TowerEquilibriumInfo:
    game_id: str = "tower_equilibrium"
    title: str = "TOWER EQUILIBRIUM"
    family: str = "tower_equilibrium"
    levels: int = 6
    default_fps: float = 12.0


class TowerEquilibriumEngine:
    """ARC3 custom-backend adapter for TOWER EQUILIBRIUM v5.5.

    Actions:
      ACTION1: longer beam
      ACTION2: shorter beam
      ACTION3: move ghost left by one 4px grid cell
      ACTION4: move ghost right by one 4px grid cell
      ACTION5: place beam
      ACTION6: click native 64×64 coordinates
      ACTION7: reset current level

    Winning auto-advances to the next level. A collapse returns fall-animation
    frames then resets the current level. The runtime never calls a solver.
    """

    def __init__(
        self,
        info: GameInfoLike | None = None,
        *,
        levels_dir: str | Path | None = None,
        levels: list[Level] | None = None,
        animate: bool = True,
    ) -> None:
        if levels is not None and levels_dir is not None:
            raise ValueError("Use levels OR levels_dir, not both.")
        bank = [validate_level(l) for l in levels] if levels is not None else load_levels(levels_dir or LEVELS_DIR)
        self.info = info if info is not None else TowerEquilibriumInfo(levels=len(bank))
        self.win_levels = int(getattr(self.info, "levels", len(bank)))
        if not 1 <= self.win_levels <= len(bank):
            raise ValueError(f"info.levels must be between 1 and {len(bank)}")
        self._templates = deepcopy(bank[: self.win_levels])
        self.animate = bool(animate)
        self.reset()

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.state = "NOT_FINISHED"
        self._index = 0
        self.level = deepcopy(self._templates[0])
        self.local = create_state(self.level)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        if self.state == "WIN":
            self._index = self.win_levels - 1
            self.levels_completed = self.win_levels - 1
            self.state = "NOT_FINISHED"
            self.level = deepcopy(self._templates[self._index])
        self.local = create_state(self.level)
        self.step_index += 1
        self.local["lastEvent"] = "LEVEL_RESET"
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        if isinstance(action_id, bool):
            return self.public_state()
        try:
            aid = int(action_id)
        except (TypeError, ValueError, OverflowError):
            return self.public_state()
        if isinstance(action_id, float) and action_id != aid:
            return self.public_state()
        if aid == ACTION_RESET:
            return self.level_reset()
        if aid not in range(1, 7) or self.state == "WIN":
            return self.public_state()
        if aid == ACTION_CLICK:
            if not isinstance(data, dict):
                return self.public_state()
            x, y = data.get("x"), data.get("y")
            if not (_is_int(x) and _is_int(y) and 0 <= x < FRAME and 0 <= y < FRAME):
                return self.public_state()

        before = deepcopy(self.local)
        result = transition(self.level, self.local, aid, data)
        progress = set(range(self.levels_completed))
        frames, durations, final_state = _animation_frames(self.level, before, result, progress, self.animate)
        self.step_index += 1

        if result["event"] == "COLLAPSE":
            self.local = final_state
            out = self.public_state()
            out["frames"] = frames
            out["frame_count"] = len(frames)
            out["frame_durations_ms"] = durations
            out["last_action"] = "COLLAPSE"
            return out

        self.local = result["state"]
        if result["event"] == "WIN":
            completion_frames = frames
            completion_durations = durations
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
                self._index = self.win_levels - 1
            else:
                self._index = self.levels_completed
                self.level = deepcopy(self._templates[self._index])
                self.local = create_state(self.level)
            out = self.public_state()
            if self.state != "WIN":
                completion_frames = completion_frames + [out["frame"]]
                completion_durations = completion_durations + [0]
            out["frames"] = completion_frames
            out["frame_count"] = len(completion_frames)
            out["frame_durations_ms"] = completion_durations
            return out

        out = self.public_state()
        if self.animate and len(frames) > 1:
            out["frames"] = frames
            out["frame_count"] = len(frames)
            out["frame_durations_ms"] = durations
        return out

    step = action

    def public_state(self) -> dict[str, Any]:
        progress = range(self.levels_completed)
        frame = render(self.level, self.local, progress)
        analysis = analyze(self.level, self.local)
        connection = target_connection(self.level, self.local)
        return {
            "backend": "custom",
            "selected": True,
            "game_id": getattr(self.info, "game_id", "tower_equilibrium"),
            "title": getattr(self.info, "title", "TOWER EQUILIBRIUM"),
            "frame": frame,
            "frames": [frame],
            "frame_count": 1,
            "frame_durations_ms": [0],
            "state": self.state,
            "level": min(self._index + 1, self.win_levels),
            "levels_completed": self.levels_completed,
            "win_levels": self.win_levels,
            "step_index": self.step_index,
            "available_action_ids": [1, 2, 3, 4, 5, 6, 7] if self.state != "WIN" else [7],
            "last_action": self.local.get("lastEvent", "READY"),
            "score": self.levels_completed,
            "level_name": self.level.get("id", f"L{self._index + 1:02d}"),
            "palette": list(PALETTE),
            "local_state": deepcopy(self.local),
            "physics": {
                "stable": analysis["stable"],
                "stress": list(analysis["stress"]),
                "load_stress": list(analysis["loadStress"]),
                "base_loads": dict(analysis["baseLoads"]),
                "target_ab": connection["index"] >= 0,
            },
        }


__all__ = [
    "TowerEquilibriumEngine", "TowerEquilibriumInfo", "load_levels", "validate_level",
    "create_state", "try_place", "remove_beam", "click", "transition", "analyze",
    "render", "replay_solution", "direct_foundation_bridge_possible", "stress_color",
    "PALETTE", "WIDTHS", "CELL", "BEAM_H",
]
