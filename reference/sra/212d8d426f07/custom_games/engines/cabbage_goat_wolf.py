from __future__ import annotations

import json
import math
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

FRAME = 64
HUD_Y = 60

WHITE, LIGHT, GRAY, DARK, BG = 0, 1, 3, 4, 5
RED, BLUE, CYAN, YELLOW, BROWN, GREEN, PURPLE = 8, 9, 10, 11, 13, 14, 15
PALETTE = [
    "#FFFFFF", "#CCCCCC", "#999999", "#666666", "#333333", "#000000",
    "#E53AA3", "#FF7BCC", "#F93C31", "#1E93FF", "#88D8F1", "#FFDC00",
    "#FF851B", "#895D3B", "#4FCC30", "#A356D6",
]

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE, ACTION_RESET = 5, 7
ACTION_NAMES = {ACTION_UP: "U", ACTION_DOWN: "D", ACTION_LEFT: "L", ACTION_RIGHT: "R", ACTION_SPACE: "S"}
TYPE_Y = {"wolf": 12, "goat": 28, "cabbage": 44}
TYPE_COLOR = {"wolf": DARK, "goat": LIGHT, "cabbage": GREEN}
# The shepherd moves 4 raster pixels per grid case; 5 cases reach this aura.
SOOTHE = 20
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "cabbage_goat_wolf" / "levels"

Frame = list[list[int]]
Level = dict[str, Any]
State = dict[str, Any]


def _is_int(v: Any) -> bool:
    return type(v) is int


def load_levels(path: str | Path = LEVELS_DIR) -> list[Level]:
    paths = sorted(Path(path).glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no CABBAGE-GOAT-WOLF levels in {path}")
    return [validate_level(json.loads(p.read_text(encoding="utf-8"))) for p in paths]


def validate_level(raw: Level) -> Level:
    level = deepcopy(raw)
    if not isinstance(level, dict) or not isinstance(level.get("id"), str):
        raise ValueError("invalid level")
    pieces = level.get("pieces")
    if not isinstance(pieces, list) or not pieces:
        raise ValueError("pieces must be a non-empty list")
    ids: set[str] = set()
    for p in pieces:
        if not isinstance(p, dict) or p.get("id") not in {"wolf", "goat", "cabbage"}:
            raise ValueError("bad piece")
        if p["id"] in ids or p.get("side") not in {"L", "R"}:
            raise ValueError("duplicate piece or bad side")
        ids.add(p["id"])
    sol = level.get("solution")
    if not isinstance(sol, list) or any(a not in {"U", "D", "L", "R", "S"} for a in sol):
        raise ValueError("bad solution")
    return level


def side_x(side: str) -> int:
    return 12 if side == "L" else 52


def create_state(level: Level) -> State:
    return {
        "side": "L",
        "x": 20,
        "y": 20,
        "held": None,
        "pieces": {p["id"]: p["side"] for p in level["pieces"]},
        "status": "PLAYING",
        "lastEvent": "READY",
    }


def piece_pos(state: State, piece_id: str) -> tuple[int, int] | None:
    side = state["pieces"].get(piece_id)
    if side not in {"L", "R"}:
        return None
    return side_x(side), TYPE_Y[piece_id]


def calm(state: State, piece_id: str) -> bool:
    p = piece_pos(state, piece_id)
    if p is None or state["held"] == piece_id:
        return True
    if state["side"] != state["pieces"].get(piece_id):
        return False
    return abs(state["x"] - p[0]) <= SOOTHE and abs(state["y"] - p[1]) <= SOOTHE


def threat(state: State) -> tuple[str, str] | None:
    pieces = state["pieces"]
    if (
        pieces.get("wolf") in {"L", "R"}
        and pieces.get("wolf") == pieces.get("goat")
        and state["held"] not in {"wolf", "goat"}
        and not calm(state, "wolf")
    ):
        return "wolf", "goat"
    if (
        pieces.get("goat") in {"L", "R"}
        and pieces.get("goat") == pieces.get("cabbage")
        and state["held"] not in {"goat", "cabbage"}
        and not calm(state, "goat")
    ):
        return "goat", "cabbage"
    return None


def nearest_grabbable(state: State) -> str | None:
    best: tuple[float, str] | None = None
    for piece_id, side in state["pieces"].items():
        if side != state["side"]:
            continue
        p = piece_pos(state, piece_id)
        assert p is not None
        dist = math.hypot(state["x"] - p[0], state["y"] - p[1])
        if dist <= 6 and (best is None or dist < best[0]):
            best = dist, piece_id
    return None if best is None else best[1]


def is_win(level: Level, state: State) -> bool:
    return state["side"] == "R" and state["held"] is None and all(v == "R" for v in state["pieces"].values())


def transition(level: Level, state: State, action: str) -> dict[str, Any]:
    if state["status"] != "PLAYING":
        return {"state": state, "event": "IGNORED"}
    nxt = deepcopy(state)
    if action == "S":
        if nxt["held"] is not None:
            nxt["pieces"][nxt["held"]] = nxt["side"]
            nxt["held"] = None
            nxt["lastEvent"] = "RELEASED"
        else:
            piece_id = nearest_grabbable(nxt)
            if piece_id is None:
                return {"state": nxt, "event": "EMPTY"}
            nxt["held"] = piece_id
            nxt["pieces"][piece_id] = "H"
            nxt["lastEvent"] = "GRABBED"
    else:
        dx = dy = 0
        if action == "U": dy = -4
        if action == "D": dy = 4
        if action == "L": dx = -4
        if action == "R": dx = 4
        # Entire riverbank is traversable: pushing toward water at x=20/40 crosses.
        if action == "R" and nxt["side"] == "L" and nxt["x"] == 20:
            nxt["side"] = "R"; nxt["x"] = 40; nxt["lastEvent"] = "CROSS"
        elif action == "L" and nxt["side"] == "R" and nxt["x"] == 40:
            nxt["side"] = "L"; nxt["x"] = 20; nxt["lastEvent"] = "CROSS"
        else:
            nx, ny = nxt["x"] + dx, nxt["y"] + dy
            nx = max(4, min(20, nx)) if nxt["side"] == "L" else max(40, min(56, nx))
            ny = max(8, min(44, ny))
            if nx == nxt["x"] and ny == nxt["y"]:
                return {"state": nxt, "event": "BLOCKED"}
            nxt["x"], nxt["y"], nxt["lastEvent"] = nx, ny, "MOVED"

    # Web order: a completed level wins before any predation check.
    if is_win(level, nxt):
        nxt["status"] = "WIN"; nxt["lastEvent"] = "WIN"
        return {"state": nxt, "event": "WIN"}
    bad = threat(nxt)
    if bad:
        was_cross = nxt["lastEvent"] == "CROSS"
        nxt["status"] = "ATTACK"; nxt["threat"] = list(bad); nxt["lastEvent"] = "ATTACK"
        return {"state": nxt, "event": "ATTACK_AFTER_CROSS" if was_cross else "ATTACK", "threat": bad}
    return {"state": nxt, "event": nxt["lastEvent"]}


# ----------------------------- raster -----------------------------

def _blank() -> Frame:
    return [[BG] * FRAME for _ in range(FRAME)]


def _put(f: Frame, x: int, y: int, c: int) -> None:
    if 0 <= x < FRAME and 0 <= y < FRAME:
        f[y][x] = c


def _fill(f: Frame, x: int, y: int, w: int, h: int, c: int) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            _put(f, xx, yy, c)


def _rect(f: Frame, x: int, y: int, w: int, h: int, c: int) -> None:
    _fill(f, x, y, w, 1, c); _fill(f, x, y + h - 1, w, 1, c)
    _fill(f, x, y, 1, h, c); _fill(f, x + w - 1, y, 1, h, c)


def _circle(f: Frame, cx: int, cy: int, r: int, c: int) -> None:
    for y in range(-r, r + 1):
        for x in range(-r, r + 1):
            if x * x + y * y <= r * r + 1:
                _put(f, cx + x, cy + y, c)


def _line(f: Frame, x0: int, y0: int, x1: int, y1: int, c: int) -> None:
    dx, sx = abs(x1 - x0), 1 if x0 < x1 else -1
    dy, sy = -abs(y1 - y0), 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        _put(f, x0, y0, c)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy; x0 += sx
        if e2 <= dx:
            err += dx; y0 += sy


def _draw_cabbage(f: Frame, x: int, y: int) -> None:
    _circle(f, x, y, 3, GREEN); _put(f, x - 2, y, DARK); _put(f, x + 2, y, DARK); _put(f, x, y - 2, LIGHT)


def _draw_goat(f: Frame, x: int, y: int) -> None:
    _fill(f, x - 3, y - 2, 6, 4, LIGHT); _put(f, x + 3, y - 1, LIGHT); _put(f, x + 4, y - 2, LIGHT)
    _put(f, x + 3, y - 3, DARK); _put(f, x - 2, y + 2, DARK); _put(f, x + 1, y + 2, DARK)


def _draw_wolf(f: Frame, x: int, y: int) -> None:
    _fill(f, x - 3, y - 2, 6, 4, DARK); _put(f, x + 3, y - 1, DARK); _put(f, x + 4, y - 2, DARK)
    _put(f, x + 2, y - 3, GRAY); _put(f, x + 4, y - 3, GRAY); _put(f, x - 2, y + 2, GRAY); _put(f, x + 1, y + 2, GRAY); _put(f, x + 4, y - 1, RED)


def _draw_piece(f: Frame, piece_id: str, x: int, y: int, outline: int | None = None) -> None:
    if outline is not None:
        _rect(f, x - 5, y - 5, 11, 11, outline)
    if piece_id == "cabbage": _draw_cabbage(f, x, y)
    elif piece_id == "goat": _draw_goat(f, x, y)
    else: _draw_wolf(f, x, y)


def _draw_zone(f: Frame, state: State) -> None:
    _rect(f, state["x"] - SOOTHE, state["y"] - SOOTHE, SOOTHE * 2 + 1, SOOTHE * 2 + 1, CYAN)


def _draw_shepherd(f: Frame, x: int, y: int) -> None:
    _fill(f, x - 1, y - 3, 3, 7, PURPLE); _fill(f, x - 3, y - 1, 7, 3, PURPLE); _put(f, x, y, WHITE)


def _draw_water(f: Frame) -> None:
    _fill(f, 24, 0, 16, HUD_Y, BLUE)
    for y in range(4, HUD_Y, 7):
        _fill(f, 26, y, 4, 1, CYAN); _fill(f, 34, y + 3, 4, 1, CYAN)


def _draw_boat(f: Frame, x: int, y: int, held: str | None = None, shepherd: bool = True) -> None:
    _fill(f, x - 6, y + 2, 12, 2, BROWN); _fill(f, x - 4, y + 4, 8, 1, BROWN)
    if shepherd and held:
        _line(f, x - 2, y - 2, x + 3, y - 1, BROWN)
    if shepherd:
        _draw_shepherd(f, x - 2, y - 2)
    if held:
        _draw_piece(f, held, x + 3, y - 1)


def _dock_boat_x(side: str) -> int:
    return 27 if side == "L" else 37


def _draw_banks(f: Frame) -> None:
    _fill(f, 0, 0, 24, HUD_Y, BG); _fill(f, 40, 0, 24, HUD_Y, BG)


def _draw_reception_slots(f: Frame, level: Level) -> None:
    for p in level["pieces"]:
        x, y, c = 52, TYPE_Y[p["id"]], TYPE_COLOR[p["id"]]
        _rect(f, x - 5, y - 5, 11, 11, c)
        for xx, yy in ((x-5,y-5),(x+5,y-5),(x-5,y+5),(x+5,y+5)):
            _put(f, xx, yy, WHITE)


def render(level: Level, state: State, progress: Any = (), options: dict[str, Any] | None = None) -> Frame:
    options = options or {}
    f = _blank(); _draw_water(f); _draw_banks(f); _draw_reception_slots(f, level)
    bad = threat(state)
    hungry = {bad[0]} if bad else set()
    attack = options.get("attack")
    for piece_id in state["pieces"]:
        if state["pieces"][piece_id] not in {"L", "R"}:
            continue
        p = piece_pos(state, piece_id); assert p is not None
        x, y = p
        if attack and attack.get("id") == piece_id:
            x, y = int(attack["x"]), int(attack["y"])
        outline = None
        if piece_id != "cabbage":
            # v3.1 victory fix: never red at win, wolf/goat always blue.
            if state["status"] == "WIN" and piece_id in {"wolf", "goat"}:
                outline = BLUE
            elif piece_id in hungry:
                outline = RED
            elif calm(state, piece_id):
                outline = BLUE
        _draw_piece(f, piece_id, x, y, outline)

    cross = options.get("cross")
    if not cross:
        _draw_boat(f, _dock_boat_x(state["side"]), 28, None, False)
        _draw_zone(f, state)
        if state["held"]:
            hx = state["x"] + (-5 if state["side"] == "L" else 5); hy = state["y"] - 6
            _line(f, state["x"], state["y"], hx, hy, BROWN)
        _draw_shepherd(f, state["x"], state["y"])
        if state["held"]:
            _draw_piece(f, state["held"], state["x"] + (-5 if state["side"] == "L" else 5), state["y"] - 6)
    else:
        _draw_boat(f, int(cross["x"]), 28, state["held"], True)

    _fill(f, 0, HUD_Y, 64, 4, DARK)
    done = set(progress)
    for i in range(6):
        _fill(f, 2 + i * 6, 61, 5, 2, GREEN if i in done else GRAY)
    outline_color = options.get("outline")
    if outline_color is not None:
        _rect(f, 0, 0, 64, 60, int(outline_color))
    return f


# ----------------------------- animations -----------------------------

def _cross_frames(level: Level, before: State, progress: set[int]) -> tuple[list[Frame], list[int]]:
    frames, durations = [], []
    a, b = (27, 37) if before["side"] == "L" else (37, 27)
    for i in range(10):
        x = round(a + (b - a) * i / 9)
        frames.append(render(level, before, progress, {"cross": {"x": x}})); durations.append(55)
    return frames, durations


def _attack_frames(level: Level, state: State, bad: tuple[str, str], progress: set[int]) -> tuple[list[Frame], list[int], State]:
    frames, durations = [], []
    for color in (None, RED, None, RED):
        frames.append(render(level, state, progress, {"outline": color})); durations.append(90)
    predator, prey = bad
    pp, tp = piece_pos(state, predator), piece_pos(state, prey)
    assert pp is not None and tp is not None
    for i in range(7):
        t = i / 6
        x = round(pp[0] + (tp[0] - pp[0]) * t); y = round(pp[1] + (tp[1] - pp[1]) * t)
        frames.append(render(level, state, progress, {"attack": {"id": predator, "x": x, "y": y}})); durations.append(75)
    durations[-1] += 130
    reset = create_state(level)
    frames.append(render(level, reset, progress)); durations.append(0)
    return frames, durations, reset


def _win_frames(level: Level, state: State, progress: set[int]) -> tuple[list[Frame], list[int]]:
    win_progress = set(progress); win_progress.add(len(progress))
    frames, durations = [], []
    for i in range(7):
        frames.append(render(level, state, win_progress, {"outline": GREEN if i % 2 == 0 else None})); durations.append(90)
    frames.append(render(level, state, win_progress)); durations.append(0)
    return frames, durations


class GameInfoLike(Protocol):
    game_id: str
    title: str
    family: str
    levels: int
    default_fps: float


@dataclass(frozen=True)
class CabbageGoatWolfInfo:
    game_id: str = "cabbage_goat_wolf"
    title: str = "CABBAGE · GOAT · WOLF"
    family: str = "cabbage_goat_wolf"
    levels: int = 6
    default_fps: float = 12.0


class CabbageGoatWolfEngine:
    """ARC3 custom-backend port of the approved web v3.1.

    ACTION1/2/3/4 = up/down/left/right
    ACTION5 = Space: grab or release one passenger
    ACTION7 = reset current level
    """

    def __init__(self, info: GameInfoLike | None = None, *, levels_dir: str | Path | None = None,
                 levels: list[Level] | None = None, animate: bool = True) -> None:
        if levels is not None and levels_dir is not None:
            raise ValueError("Use levels OR levels_dir, not both")
        bank = [validate_level(x) for x in levels] if levels is not None else load_levels(levels_dir or LEVELS_DIR)
        self.info = info if info is not None else CabbageGoatWolfInfo(levels=len(bank))
        self.win_levels = int(getattr(self.info, "levels", len(bank)))
        if not 1 <= self.win_levels <= len(bank):
            raise ValueError(f"info.levels must be between 1 and {len(bank)}")
        self._templates = deepcopy(bank[:self.win_levels])
        self.animate = bool(animate)
        self.reset()

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0; self.step_index = 0; self.state = "NOT_FINISHED"; self._index = 0
        self.level = deepcopy(self._templates[0]); self.local = create_state(self.level); self.last_action = "RESET"
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        if self.state == "WIN":
            self._index = self.win_levels - 1; self.levels_completed = self.win_levels - 1; self.state = "NOT_FINISHED"
            self.level = deepcopy(self._templates[self._index])
        self.local = create_state(self.level); self.step_index += 1; self.last_action = "LEVEL_RESET"
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        if isinstance(action_id, bool): return self.public_state()
        try: aid = int(action_id)
        except (TypeError, ValueError, OverflowError): return self.public_state()
        if isinstance(action_id, float) and action_id != aid: return self.public_state()
        if aid == ACTION_RESET: return self.level_reset()
        if aid not in ACTION_NAMES or self.state == "WIN": return self.public_state()

        before = deepcopy(self.local)
        result = transition(self.level, self.local, ACTION_NAMES[aid])
        event, final_state = result["event"], result["state"]
        progress = set(range(self.levels_completed))
        self.step_index += 1; self.last_action = event
        frames: list[Frame] = []; durations: list[int] = []

        if self.animate and event in {"CROSS", "ATTACK_AFTER_CROSS"}:
            cf, cd = _cross_frames(self.level, before, progress); frames.extend(cf); durations.extend(cd)

        if event in {"ATTACK", "ATTACK_AFTER_CROSS"}:
            bad = tuple(result["threat"])
            if self.animate:
                af, ad, reset = _attack_frames(self.level, final_state, bad, progress); frames.extend(af); durations.extend(ad)
            else:
                reset = create_state(self.level)
            self.local = reset
            out = self.public_state()
            if frames: out.update(frames=frames, frame_count=len(frames), frame_durations_ms=durations)
            return out

        self.local = final_state
        if event == "WIN":
            if self.animate:
                wf, wd = _win_frames(self.level, final_state, progress); frames.extend(wf); durations.extend(wd)
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
                out = self.public_state()
                if frames: out.update(frames=frames, frame_count=len(frames), frame_durations_ms=durations)
                return out
            self._index = self.levels_completed; self.level = deepcopy(self._templates[self._index]); self.local = create_state(self.level)
            out = self.public_state()
            if frames:
                frames.append(out["frame"]); durations.append(0)
                out.update(frames=frames, frame_count=len(frames), frame_durations_ms=durations)
            return out

        out = self.public_state()
        if frames:
            # Crossing animation ends on the new static state.
            frames.append(out["frame"]); durations.append(0)
            out.update(frames=frames, frame_count=len(frames), frame_durations_ms=durations)
        return out

    step = action

    def public_state(self) -> dict[str, Any]:
        frame = render(self.level, self.local, range(self.levels_completed))
        return {
            "backend": "custom", "selected": True,
            "game_id": getattr(self.info, "game_id", "cabbage_goat_wolf"),
            "title": getattr(self.info, "title", "CABBAGE · GOAT · WOLF"),
            "frame": frame, "frames": [frame], "frame_count": 1, "frame_durations_ms": [0],
            "state": self.state, "level": min(self._index + 1, self.win_levels),
            "levels_completed": self.levels_completed, "win_levels": self.win_levels,
            "step_index": self.step_index,
            "available_action_ids": [1,2,3,4,5,7] if self.state != "WIN" else [7],
            "last_action": self.last_action, "score": self.levels_completed,
            "level_name": self.level["id"], "palette": list(PALETTE),
            "local_state": deepcopy(self.local),
        }


__all__ = [
    "CabbageGoatWolfEngine", "CabbageGoatWolfInfo", "load_levels", "validate_level",
    "create_state", "transition", "render", "calm", "threat", "piece_pos", "is_win",
    "PALETTE", "ACTION_UP", "ACTION_DOWN", "ACTION_LEFT", "ACTION_RIGHT", "ACTION_SPACE", "ACTION_RESET",
    "TYPE_Y", "TYPE_COLOR", "SOOTHE", "WHITE", "LIGHT", "GRAY", "DARK", "BG", "RED", "BLUE", "CYAN", "YELLOW", "BROWN", "GREEN", "PURPLE",
]
