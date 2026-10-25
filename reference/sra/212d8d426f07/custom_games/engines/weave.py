from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

FRAME = 64
HUD_Y = 60
BX = 18
BY = 18
CELL = 5
GAP = 1
PITCH = 6
LEG_CELL = 2

WHITE, LIGHT, GRAY, DARK, BG = 0, 1, 3, 4, 5
MAGENTA, RED, CYAN, YELLOW, ORANGE, BROWN, GREEN = 6, 8, 10, 11, 12, 13, 14

PALETTE = [
    "#FFFFFF", "#CCCCCC", "#999999", "#666666", "#333333", "#000000",
    "#E53AA3", "#FF7BCC", "#F93C31", "#1E93FF", "#88D8F1", "#FFDC00",
    "#FF851B", "#895D3B", "#4FCC30", "#A356D6",
]

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_CLICK, ACTION_RESET = 6, 7
DIR_BY_ACTION = {
    ACTION_UP: "U",
    ACTION_DOWN: "D",
    ACTION_LEFT: "L",
    ACTION_RIGHT: "R",
}

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "weave" / "levels"

Frame = list[list[int]]
Level = dict[str, Any]
State = dict[str, Any]


def _is_int(v: Any) -> bool:
    return type(v) is int


def load_levels(path: str | Path = LEVELS_DIR) -> list[Level]:
    paths = sorted(Path(path).glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no WEAVE levels in {path}")
    return [validate_level(json.loads(p.read_text(encoding="utf-8"))) for p in paths]


def validate_level(raw: Level) -> Level:
    level = deepcopy(raw)
    if not isinstance(level, dict) or not isinstance(level.get("id"), str):
        raise ValueError("invalid level")
    n_h, n_v = level.get("nH"), level.get("nV")
    if not (_is_int(n_h) and _is_int(n_v) and 1 <= n_h <= 4 and 1 <= n_v <= 4):
        raise ValueError("nH/nV must be integers in 1..4")
    choices = level.get("choices")
    if not isinstance(choices, list) or len(choices) < 2 or any(not _is_int(c) or not 0 <= c < 16 for c in choices):
        raise ValueError("bad color choices")
    for key, size in (("hColors", n_h), ("vColors", n_v)):
        vals = level.get(key)
        if not isinstance(vals, list) or len(vals) != size or any(c not in choices for c in vals):
            raise ValueError(f"bad {key}")
    h_steps, v_steps = level.get("hSteps"), level.get("vSteps")
    if not isinstance(h_steps, list) or len(h_steps) != n_h or any(len(row) != n_v for row in h_steps):
        raise ValueError("hSteps must be nH × nV")
    if not isinstance(v_steps, list) or len(v_steps) != n_v or any(len(col) != n_h for col in v_steps):
        raise ValueError("vSteps must be nV × nH")
    if any(v not in (0, 1) for row in h_steps for v in row) or any(v not in (0, 1) for col in v_steps for v in col):
        raise ValueError("steps must contain only 0/1")
    if level.get("hLen") != [n_v] * n_h or level.get("vLen") != [n_h] * n_v:
        raise ValueError("WEAVE v1.9 uses only full-length threads")
    initial = level.get("initialSelected")
    if initial is not None:
        if not (isinstance(initial, list) and len(initial) == 2 and initial[0] in {"H", "V"} and _is_int(initial[1])):
            raise ValueError("bad initialSelected")
        limit = n_h if initial[0] == "H" else n_v
        if not 0 <= initial[1] < limit:
            raise ValueError("initialSelected out of range")
    return level


def initial_order(level: Level) -> list[int]:
    a = list(level["choices"])
    return a[1:] + a[:1]


def order_for_color(level: Level, color: int) -> list[int]:
    return [c for c in level["choices"] if c != color] + [color]


def create_state(level: Level) -> State:
    preset = bool(level.get("presetColors"))
    return {
        "hOrders": [
            order_for_color(level, level["hColors"][i]) if preset else initial_order(level)
            for i in range(level["nH"])
        ],
        "vOrders": [
            order_for_color(level, level["vColors"][i]) if preset else initial_order(level)
            for i in range(level["nV"])
        ],
        "hColors": list(level["hColors"]) if preset else [level["choices"][0]] * level["nH"],
        "vColors": list(level["vColors"]) if preset else [level["choices"][0]] * level["nV"],
        "hSteps": [[] for _ in range(level["nH"])],
        "vSteps": [[] for _ in range(level["nV"])],
        "selected": list(level["initialSelected"]) if level.get("initialSelected") else None,
        "status": "PLAYING",
        "lastEvent": "READY",
    }


def choose_color(level: Level, state: State, kind: str, index: int, color: int) -> State:
    if kind not in {"H", "V"}:
        return state
    limit = level["nH"] if kind == "H" else level["nV"]
    if not (_is_int(index) and 0 <= index < limit and color in level["choices"]):
        return state
    nxt = deepcopy(state)
    orders = nxt["hOrders"] if kind == "H" else nxt["vOrders"]
    colors = nxt["hColors"] if kind == "H" else nxt["vColors"]
    order = orders[index]
    if color not in order:
        return state
    order.remove(color)
    order.append(color)
    colors[index] = color
    nxt["selected"] = [kind, index]
    nxt["lastEvent"] = "COLOR"
    return nxt


def all_placed(level: Level, state: State) -> bool:
    return (
        all(len(row) == level["hLen"][i] for i, row in enumerate(state["hSteps"]))
        and all(len(col) == level["vLen"][i] for i, col in enumerate(state["vSteps"]))
    )


def visible_color_at(level: Level, state: State, r: int, c: int, *, target: bool = False) -> int:
    h_steps = level["hSteps"] if target else state["hSteps"]
    v_steps = level["vSteps"] if target else state["vSteps"]
    h_colors = level["hColors"] if target else state["hColors"]
    v_colors = level["vColors"] if target else state["vColors"]
    hs = h_steps[r][c] if c < len(h_steps[r]) else None
    vs = v_steps[c][r] if r < len(v_steps[c]) else None
    hc, vc = h_colors[r], v_colors[c]
    if hs is None and vs is None:
        return BG
    if hs is not None and vs is not None:
        # Same-color crossings intentionally ignore over/under order.
        if hc == vc:
            return hc
        return hc if hs == 1 else vc
    return hc if hs is not None else vc


def pattern_matches(level: Level, state: State) -> bool:
    if not all_placed(level, state):
        return False
    return all(
        visible_color_at(level, state, r, c) == visible_color_at(level, state, r, c, target=True)
        for r in range(level["nH"])
        for c in range(level["nV"])
    )


def advance(level: Level, state: State, direction: str) -> dict[str, Any]:
    if state["status"] != "PLAYING":
        return {"state": state, "event": "IGNORED"}
    if not state["selected"]:
        return {"state": state, "event": "NO_SELECTION"}
    kind, i = state["selected"]
    nxt = deepcopy(state)
    if kind == "H":
        if direction not in {"U", "D"}:
            return {"state": state, "event": "WRONG_AXIS"}
        layer = 1 if direction == "U" else 0
        c = len(nxt["hSteps"][i])
        if c >= level["hLen"][i]:
            return {"state": state, "event": "END"}
        if len(nxt["vSteps"][c]) > i and nxt["vSteps"][c][i] == layer:
            return {"state": state, "event": "CONFLICT"}
        nxt["hSteps"][i].append(layer)
    else:
        if direction not in {"L", "R"}:
            return {"state": state, "event": "WRONG_AXIS"}
        layer = 1 if direction == "R" else 0
        r = len(nxt["vSteps"][i])
        if r >= level["vLen"][i]:
            return {"state": state, "event": "END"}
        if len(nxt["hSteps"][r]) > i and nxt["hSteps"][r][i] == layer:
            return {"state": state, "event": "CONFLICT"}
        nxt["vSteps"][i].append(layer)
    nxt["lastEvent"] = "STEP"
    return {"state": nxt, "event": "CHECK" if all_placed(level, nxt) else "STEP"}


def button_pos(level: Level, kind: str, index: int, j: int) -> tuple[int, int]:
    n = len(level["choices"])
    if kind == "H":
        return BX - 4 * (n - j), BY + index * PITCH + 1
    return BX + index * PITCH + 1, BY - 4 * (n - j)


def hit_button(level: Level, state: State, x: int, y: int) -> tuple[str, int, int] | None:
    for r in range(level["nH"]):
        for j in range(len(level["choices"])):
            px, py = button_pos(level, "H", r, j)
            if px <= x < px + 3 and py <= y < py + 3:
                return "H", r, state["hOrders"][r][j]
    for c in range(level["nV"]):
        for j in range(len(level["choices"])):
            px, py = button_pos(level, "V", c, j)
            if px <= x < px + 3 and py <= y < py + 3:
                return "V", c, state["vOrders"][c][j]
    return None


def click(level: Level, state: State, x: int, y: int) -> dict[str, Any]:
    if state["status"] != "PLAYING":
        return {"state": state, "event": "IGNORED"}
    if not (_is_int(x) and _is_int(y) and 0 <= x < FRAME and 0 <= y < FRAME):
        return {"state": state, "event": "IGNORED"}
    hit = hit_button(level, state, x, y)
    if hit is None:
        return {"state": state, "event": "IGNORED"}
    kind, index, color = hit
    nxt = choose_color(level, state, kind, index, color)
    return {"state": nxt, "event": "CHECK" if all_placed(level, nxt) else "COLOR"}


def apply_reference_op(level: Level, state: State, op: dict[str, Any]) -> dict[str, Any]:
    if op.get("op") == "color":
        nxt = choose_color(level, state, op["kind"], int(op["index"]), int(op["color"]))
        return {"state": nxt, "event": "COLOR"}
    if op.get("op") == "step":
        # The web demo selects the operated thread again before each step.
        colors = state["hColors"] if op["kind"] == "H" else state["vColors"]
        selected = choose_color(level, state, op["kind"], int(op["index"]), int(colors[int(op["index"])]))
        return advance(level, selected, op["dir"])
    return {"state": state, "event": "IGNORED"}


# ----------------------------- raster -----------------------------

def _blank() -> Frame:
    return [[BG] * FRAME for _ in range(FRAME)]


def _put(f: Frame, x: int, y: int, color: int) -> None:
    if 0 <= x < FRAME and 0 <= y < FRAME:
        f[y][x] = color


def _fill(f: Frame, x: int, y: int, w: int, h: int, color: int) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            _put(f, xx, yy, color)


def _rect(f: Frame, x: int, y: int, w: int, h: int, color: int) -> None:
    _fill(f, x, y, w, 1, color)
    _fill(f, x, y + h - 1, w, 1, color)
    _fill(f, x, y, 1, h, color)
    _fill(f, x + w - 1, y, 1, h, color)


def _draw_buttons(f: Frame, level: Level, state: State) -> None:
    for r in range(level["nH"]):
        for j in range(len(level["choices"])):
            x, y = button_pos(level, "H", r, j)
            _fill(f, x, y, 3, 3, state["hOrders"][r][j])
        x, y = button_pos(level, "H", r, len(level["choices"]) - 1)
        if state["selected"] == ["H", r]:
            _rect(f, x - 1, y - 1, 5, 5, WHITE)
        # centered incoming horizontal stub (+1px down)
        _fill(f, BX - 2, BY + r * PITCH + 1, 2, 3, state["hColors"][r])

    for c in range(level["nV"]):
        for j in range(len(level["choices"])):
            x, y = button_pos(level, "V", c, j)
            _fill(f, x, y, 3, 3, state["vOrders"][c][j])
        x, y = button_pos(level, "V", c, len(level["choices"]) - 1)
        if state["selected"] == ["V", c]:
            _rect(f, x - 1, y - 1, 5, 5, WHITE)
        # centered incoming vertical stub (+1px right)
        _fill(f, BX + c * PITCH + 1, BY - 2, 3, 2, state["vColors"][c])


def _draw_loom(f: Frame, level: Level) -> None:
    w = level["nV"] * CELL + (level["nV"] - 1) * GAP
    h = level["nH"] * CELL + (level["nH"] - 1) * GAP
    _rect(f, BX - 1, BY - 1, w + 2, h + 2, BROWN)
    for r in range(level["nH"]):
        for c in range(level["nV"]):
            _fill(f, BX + c * PITCH, BY + r * PITCH, CELL, CELL, DARK)


def _draw_end_lights(f: Frame, level: Level, state: State) -> None:
    w = level["nV"] * CELL + (level["nV"] - 1) * GAP
    h = level["nH"] * CELL + (level["nH"] - 1) * GAP
    for r in range(level["nH"]):
        x, y = BX + w + 1, BY + r * PITCH + 1
        on = len(state["hSteps"][r]) == level["nV"]
        _fill(f, x, y, 3, 3, state["hColors"][r] if on else GRAY)
        if on:
            _put(f, x + 1, y + 1, WHITE)
    for c in range(level["nV"]):
        x, y = BX + c * PITCH + 1, BY + h + 1
        on = len(state["vSteps"][c]) == level["nH"]
        _fill(f, x, y, 3, 3, state["vColors"][c] if on else GRAY)
        if on:
            _put(f, x + 1, y + 1, WHITE)


def _draw_current_cell(f: Frame, level: Level, state: State, r: int, c: int) -> None:
    hs = state["hSteps"][r][c] if c < len(state["hSteps"][r]) else None
    vs = state["vSteps"][c][r] if r < len(state["vSteps"][c]) else None
    x, y = BX + c * PITCH, BY + r * PITCH
    h_done = len(state["hSteps"][r]) == level["nV"]
    v_done = len(state["vSteps"][c]) == level["nH"]

    def h_draw() -> None:
        if hs is not None:
            _fill(f, x, y + (0 if hs else 1), 5, 4, state["hColors"][r])

    def v_draw() -> None:
        if vs is not None:
            _fill(f, x + (1 if vs else 0), y, 4, 5, state["vColors"][c])

    if hs is not None and vs is not None:
        if hs == 1:
            v_draw()
            if h_done:
                _fill(f, x, y, CELL, CELL, state["hColors"][r])
            else:
                h_draw()
        else:
            h_draw()
            if v_done:
                _fill(f, x, y, CELL, CELL, state["vColors"][c])
            else:
                v_draw()
    else:
        if hs is not None:
            if h_done and hs == 1:
                _fill(f, x, y, CELL, CELL, state["hColors"][r])
            else:
                h_draw()
        if vs is not None:
            if v_done and vs == 1:
                _fill(f, x, y, CELL, CELL, state["vColors"][c])
            else:
                v_draw()


def _draw_weave(f: Frame, level: Level, state: State) -> None:
    for r in range(level["nH"]):
        for c in range(level["nV"]):
            _draw_current_cell(f, level, state, r, c)


def _draw_advance_cursor(f: Frame, level: Level, state: State) -> None:
    if not state["selected"] or state["status"] != "PLAYING":
        return
    kind, i = state["selected"]
    if kind == "H":
        r, c = i, len(state["hSteps"][i])
        if c >= level["nV"]:
            return
    else:
        c, r = i, len(state["vSteps"][i])
        if r >= level["nH"]:
            return
    x, y = BX + c * PITCH, BY + r * PITCH
    _put(f, x + 2, y + 2, WHITE)


def _draw_final_read(f: Frame, level: Level, state: State) -> None:
    for r in range(level["nH"]):
        for c in range(level["nV"]):
            color = visible_color_at(level, state, r, c)
            if color != BG:
                _fill(f, BX + c * PITCH, BY + r * PITCH, CELL, CELL, color)


def _legend_origin(level: Level) -> tuple[int, int]:
    return 63 - level["nV"] * LEG_CELL, 59 - level["nH"] * LEG_CELL


def _draw_legend(f: Frame, level: Level) -> None:
    ox, oy = _legend_origin(level)
    for r in range(level["nH"]):
        for c in range(level["nV"]):
            hs = level["hSteps"][r][c]
            vs = level["vSteps"][c][r]
            x, y = ox + c * LEG_CELL, oy + r * LEG_CELL
            if hs is not None and vs is not None:
                color = level["hColors"][r] if hs == 1 else level["vColors"][c]
            elif hs is not None:
                color = level["hColors"][r]
            elif vs is not None:
                color = level["vColors"][c]
            else:
                continue
            _fill(f, x, y, LEG_CELL, LEG_CELL, color)


def render(
    level: Level,
    state: State,
    progress: Any = (),
    options: dict[str, Any] | None = None,
) -> Frame:
    options = options or {}
    f = _blank()
    _draw_loom(f, level)
    _draw_buttons(f, level, state)
    if options.get("finalRead"):
        _draw_final_read(f, level, state)
    else:
        _draw_weave(f, level, state)
        _draw_advance_cursor(f, level, state)
    _draw_end_lights(f, level, state)
    _draw_legend(f, level)
    _fill(f, 0, HUD_Y, 64, 4, DARK)
    done = set(progress)
    for i in range(6):
        _fill(f, 2 + i * 6, 61, 5, 2, GREEN if i in done else GRAY)
    outline = options.get("outline")
    if outline is not None:
        _rect(f, 0, 0, 64, 60, int(outline))
    return f


# ----------------------------- animations -----------------------------

def _blink_frames(level: Level, state: State, progress: set[int], color: int) -> tuple[list[Frame], list[int]]:
    frames: list[Frame] = []
    durations: list[int] = []
    for i in range(5):
        frames.append(render(level, state, progress, {"outline": color if i % 2 == 0 else None}))
        durations.append(75)
    frames.append(render(level, state, progress))
    durations.append(0)
    return frames, durations


def _final_check_frames(level: Level, state: State, progress: set[int], ok: bool) -> tuple[list[Frame], list[int]]:
    color = WHITE if ok else RED
    frames: list[Frame] = []
    durations: list[int] = []
    for i in range(6):
        frames.append(
            render(
                level,
                state,
                progress,
                {"finalRead": True, "outline": color if i % 2 == 0 else None},
            )
        )
        durations.append(110)
    return frames, durations


def replay_solution(level: Level) -> dict[str, Any]:
    state = create_state(level)
    events: list[str] = []
    for op in level["solutionOps"]:
        result = apply_reference_op(level, state, op)
        state = result["state"]
        events.append(result["event"])
        if result["event"] == "CONFLICT":
            break
    return {
        "state": state,
        "events": events,
        "allPlaced": all_placed(level, state),
        "match": pattern_matches(level, state),
    }


class GameInfoLike(Protocol):
    game_id: str
    title: str
    family: str
    levels: int
    default_fps: float


@dataclass(frozen=True)
class WeaveInfo:
    game_id: str = "weave"
    title: str = "WEAVE"
    family: str = "weave"
    levels: int = 6
    default_fps: float = 12.0


class WeaveEngine:
    """ARC3 custom-backend port of WEAVE web v1.9.

    ACTION1 = up
    ACTION2 = down
    ACTION3 = left
    ACTION4 = right
    ACTION6 = click native 64×64 coordinates (color buttons)
    ACTION7 = reset current level
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
        bank = [validate_level(x) for x in levels] if levels is not None else load_levels(levels_dir or LEVELS_DIR)
        self.info = info if info is not None else WeaveInfo(levels=len(bank))
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
        self.last_action = "RESET"
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        if self.state == "WIN":
            self._index = self.win_levels - 1
            self.levels_completed = self.win_levels - 1
            self.state = "NOT_FINISHED"
            self.level = deepcopy(self._templates[self._index])
        self.local = create_state(self.level)
        self.step_index += 1
        self.last_action = "LEVEL_RESET"
        return self.public_state()

    def _finish_check(
        self,
        progress: set[int],
        *,
        base_frames: list[Frame] | None = None,
        base_durations: list[int] | None = None,
    ) -> dict[str, Any]:
        ok = pattern_matches(self.level, self.local)
        frames = list(base_frames or [])
        durations = list(base_durations or [])
        if self.animate:
            f, d = _final_check_frames(self.level, self.local, progress, ok)
            frames += f
            durations += d
        self.last_action = "WIN" if ok else "MISMATCH"

        if not ok:
            out = self.public_state()
            if frames:
                frames.append(out["frame"])
                durations.append(0)
                out.update(frames=frames, frame_count=len(frames), frame_durations_ms=durations)
            return out

        self.local["status"] = "WIN"
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            out = self.public_state(final_read=True)
            if self.animate:
                frames.append(out["frame"])
                durations.append(0)
                out.update(frames=frames, frame_count=len(frames), frame_durations_ms=durations)
            return out

        self._index = self.levels_completed
        self.level = deepcopy(self._templates[self._index])
        self.local = create_state(self.level)
        out = self.public_state()
        if self.animate:
            frames.append(out["frame"])
            durations.append(0)
            out.update(frames=frames, frame_count=len(frames), frame_durations_ms=durations)
        return out

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
        if self.state == "WIN":
            return self.public_state(final_read=True)
        if aid not in {ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT, ACTION_CLICK}:
            return self.public_state()

        progress = set(range(self.levels_completed))
        if aid == ACTION_CLICK:
            if not isinstance(data, dict):
                return self.public_state()
            result = click(self.level, self.local, data.get("x"), data.get("y"))
        else:
            result = advance(self.level, self.local, DIR_BY_ACTION[aid])

        self.step_index += 1
        self.last_action = result["event"]
        self.local = result["state"]
        event = result["event"]

        if event in {"CONFLICT", "NO_SELECTION"}:
            frames: list[Frame] = []
            durations: list[int] = []
            if self.animate:
                color = MAGENTA if event == "CONFLICT" else LIGHT
                frames, durations = _blink_frames(self.level, self.local, progress, color)
            out = self.public_state()
            if frames:
                out.update(frames=frames, frame_count=len(frames), frame_durations_ms=durations)
            return out

        if event == "CHECK":
            return self._finish_check(progress)

        out = self.public_state()
        return out

    step = action

    def public_state(self, *, final_read: bool = False) -> dict[str, Any]:
        frame = render(
            self.level,
            self.local,
            range(self.levels_completed),
            {"finalRead": True} if final_read else None,
        )
        return {
            "backend": "custom",
            "selected": True,
            "game_id": getattr(self.info, "game_id", "weave"),
            "title": getattr(self.info, "title", "WEAVE"),
            "frame": frame,
            "frames": [frame],
            "frame_count": 1,
            "frame_durations_ms": [0],
            "state": self.state,
            "level": min(self._index + 1, self.win_levels),
            "levels_completed": self.levels_completed,
            "win_levels": self.win_levels,
            "step_index": self.step_index,
            "available_action_ids": [1, 2, 3, 4, 6, 7] if self.state != "WIN" else [7],
            "last_action": self.last_action,
            "score": self.levels_completed,
            "level_name": self.level["id"],
            "palette": list(PALETTE),
            "local_state": deepcopy(self.local),
            "all_placed": all_placed(self.level, self.local),
            "pattern_match": pattern_matches(self.level, self.local) if all_placed(self.level, self.local) else None,
        }


__all__ = [
    "WeaveEngine", "WeaveInfo", "load_levels", "validate_level", "create_state",
    "choose_color", "advance", "click", "apply_reference_op", "button_pos",
    "hit_button", "all_placed", "visible_color_at", "pattern_matches",
    "render", "replay_solution", "PALETTE", "FRAME", "HUD_Y", "BX", "BY",
    "CELL", "GAP", "PITCH", "LEG_CELL", "ACTION_UP", "ACTION_DOWN",
    "ACTION_LEFT", "ACTION_RIGHT", "ACTION_CLICK", "ACTION_RESET", "WHITE",
    "LIGHT", "GRAY", "DARK", "BG", "MAGENTA", "RED", "CYAN", "YELLOW",
    "ORANGE", "BROWN", "GREEN",
]
