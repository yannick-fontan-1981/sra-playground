"""Gravity Box: Python port of the approved gravity-box-v1 web prototype.

The pure rules and 64x64 renderer mirror src/core.js. GravityBoxEngine adapts
those functions to the supplied custom ARC3 backend (not the official SDK).
Runtime: Python >= 3.10, standard library only; no Node, numpy or GUI required.

ACTION1=N, ACTION2=S, ACTION3=W, ACTION4=E, ACTION5=toggle glue,
ACTION6=click (64x64 frame x/y), ACTION7=restart the current level.
"""
from __future__ import annotations

import json
import math
import re
import time
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Protocol

FRAME = 64
DIRS = {"N": (0, -1), "E": (1, 0), "S": (0, 1), "W": (-1, 0)}
ORDER = ("N", "E", "S", "W")
COLORS = {"R": 8, "B": 9, "Y": 11, "G": 14}
PALETTE = (
    "#FFFFFF", "#CCCCCC", "#999999", "#666666", "#333333", "#000000",
    "#E53AA3", "#FF7BCC", "#F93C31", "#1E93FF", "#88D8F1", "#FFDC00",
    "#FF851B", "#921231", "#4FCC30", "#A356D6",
)
BUTTONS = {
    "N": (28, 0, 36, 6), "E": (58, 28, 64, 36),
    "S": (28, 58, 36, 64), "W": (0, 28, 6, 36),
    "G": (58, 58, 64, 64),
}
BUTTON_CENTERS = {"N": (31, 2), "E": (61, 31), "S": (31, 61),
                  "W": (2, 31), "G": (61, 61)}
ACTION_TO_COMMAND = {1: "N", 2: "S", 3: "W", 4: "E", 5: "G"}
COMMAND_TO_ACTION = {v: k for k, v in ACTION_TO_COMMAND.items()}
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "gravity_box" / "levels"
# Verified minima and +50% action budgets (L06 capped at 15).
LEVEL_ACTION_MINIMUM = (2, 4, 6, 8, 9, 10)
LEVEL_ACTION_BUDGET = (3, 6, 9, 12, 14, 15)
C_MAGENTA = 6  # ARC palette #E53AA3 — action-budget bar
C_RED = 8  # ARC palette #F93C31 — GAME_OVER full-screen blink
Level = dict[str, Any]
State = dict[str, Any]
Pixels = list[list[int]]


def _integer(value: Any, low: int, high: int) -> bool:
    # Match JS Number.isInteger, but never treat True/False as integers.
    return (type(value) in (int, float) and math.isfinite(value)
            and value == int(value) and low <= value <= high)


def _js_string(value: Any) -> str:
    """Scalar label normalization, matching JSON scalar strings in the editor."""
    if value is True:
        return "true"
    if value is False:
        return "false"
    if value is None:
        return "null"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def validate_level(raw: Mapping[str, Any]) -> Level:
    """Validate/copy a web-editor definition. Keep its camelCase JSON fields.

    Object coordinates are logical cells, NOT image pixels. Unknown metadata is
    retained. All shipped files are used unchanged. Initial gravity is null.
    """
    if not isinstance(raw, Mapping):
        raise ValueError("A level must be a JSON object.")
    level = deepcopy(dict(raw))
    for field in ("cols", "rows"):
        if not _integer(level.get(field), 6, 12):
            raise ValueError("Board dimensions must be integers between 6 and 12.")
        level[field] = int(level[field])
    walls = level.get("walls")
    if not isinstance(walls, dict) or any(walls.get(d) not in COLORS for d in ORDER):
        raise ValueError("Each wall must have a colour R, B, Y or G.")
    if len({walls[d] for d in ORDER}) != 4:
        raise ValueError("The four walls must have different colours.")
    if not isinstance(level.get("crates"), list) or not 1 <= len(level["crates"]) <= 16:
        raise ValueError("A level must contain 1 to 16 crates.")
    level.setdefault("obstacles", [])
    if not isinstance(level["obstacles"], list):
        raise ValueError("obstacles must be a list of [x, y] cells.")
    for field, default in (("allowGlueToggle", False), ("glueEnabled", True)):
        if field in level and type(level[field]) is not bool:
            raise ValueError(f"{field} must be a boolean.")
        level.setdefault(field, default)
    if not level["allowGlueToggle"] and not level["glueEnabled"]:
        raise ValueError("Glue must start enabled when no glue switch is available.")
    if level.get("gravity") is not None:
        raise ValueError("Levels start suspended: gravity must be null.")
    level["gravity"] = None
    occupied: set[tuple[int, int]] = set()

    def claim(x: Any, y: Any) -> tuple[int, int]:
        if not _integer(x, 0, level["cols"] - 1) or not _integer(y, 0, level["rows"] - 1):
            raise ValueError("Objects must use integer coordinates inside the board.")
        cell = int(x), int(y)
        if cell in occupied:
            raise ValueError("Two objects occupy the same cell.")
        occupied.add(cell)
        return cell

    for cell in level["obstacles"]:
        if not isinstance(cell, list) or len(cell) != 2:
            raise ValueError("An obstacle must be a cell [x, y].")
        cell[:] = claim(*cell)
    ids: set[str] = set()
    for i, crate in enumerate(level["crates"]):
        if not isinstance(crate, dict) or crate.get("color") not in COLORS:
            raise ValueError("Invalid crate colour.")
        crate["x"], crate["y"] = claim(crate.get("x"), crate.get("y"))
        crate["id"] = _js_string(crate.get("id") or f"c{i + 1}")
        if crate["id"] in ids:
            raise ValueError("Duplicate crate ids.")
        ids.add(crate["id"])
        if "stuck" in crate and type(crate["stuck"]) is not bool:
            raise ValueError("stuck must be a boolean.")
        crate.setdefault("stuck", False)
        if crate["stuck"] and (not level["glueEnabled"] or not touches_target(level, crate)):
            raise ValueError("A pre-glued crate must touch its matching wall with glue on.")
    level["id"] = _js_string(level.get("id") or "custom")
    level["name"] = _js_string(level.get("name") or "Niveau personnalisé")[:100]
    level["description"] = _js_string(level.get("description") or "")[:500]
    level.setdefault("background", 4)
    if not _integer(level["background"], 3, 5):
        raise ValueError("background must be 3, 4 or 5.")
    level["background"] = int(level["background"])
    if "targetMoves" in level and not _integer(level["targetMoves"], 1, 999):
        raise ValueError("targetMoves must be an integer from 1 to 999.")
    return level


def load_levels(source: str | Path = LEVELS_DIR) -> list[Level]:
    """Load L*.json from a directory, a web pack, a JSON array or one level."""
    path = Path(source)
    try:
        if path.is_dir():
            paths = sorted(path.glob("L*.json"))
            if not paths:
                raise FileNotFoundError(f"No L*.json levels in {path}")
            return [validate_level(json.loads(p.read_text(encoding="utf-8-sig"))) for p in paths]
        raw = json.loads(path.read_text(encoding="utf-8-sig"))
        if isinstance(raw, dict) and "levels" in raw:
            if raw.get("schema", "gravity-box-v1") != "gravity-box-v1":
                raise ValueError("Unsupported level pack schema.")
            raw = raw["levels"]
        items = raw if isinstance(raw, list) else [raw]
        if not items:
            raise ValueError("The level pack is empty.")
        return [validate_level(level) for level in items]
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid Gravity Box level source {path}: {exc}") from exc


def touches_target(level: Level, crate: dict[str, Any]) -> bool:
    x, y, colour = crate["x"], crate["y"], crate["color"]
    return ((y == 0 and level["walls"]["N"] == colour)
            or (x == level["cols"] - 1 and level["walls"]["E"] == colour)
            or (y == level["rows"] - 1 and level["walls"]["S"] == colour)
            or (x == 0 and level["walls"]["W"] == colour))


def copy_state(state: State) -> State:
    return {"crates": [dict(c) for c in state["crates"]],
            "gravity": state["gravity"], "glue": state["glue"], "won": state["won"]}


def attach(level: Level, state: State) -> int:
    """Fix matching DIRECT wall contacts, regardless of gravity direction."""
    if not state["glue"]:
        return 0
    count = 0
    for crate in state["crates"]:
        if not crate["stuck"] and touches_target(level, crate):
            crate["stuck"] = True
            count += 1
    return count


def is_won(level: Level, state: State) -> bool:
    return bool(state["glue"] and state["crates"]
                and all(c["stuck"] and touches_target(level, c) for c in state["crates"]))


def initial_state(level: Level) -> State:
    state = {"crates": [dict(c, stuck=bool(c.get("stuck"))) for c in level["crates"]],
             "gravity": None, "glue": level.get("glueEnabled", True), "won": False}
    attach(level, state)
    state["won"] = is_won(level, state)
    return state


def make_context(level: Level) -> dict[str, Any]:
    return {"blocked": frozenset(y * level["cols"] + x for x, y in level["obstacles"])}


def tick(level: Level, state: State, context: dict[str, Any] | None = None) -> bool:
    """Mutate one simultaneous cell step; no pushing or array-order effects.

    Dependencies always advance along gravity, so the dependency graph cannot
    contain a cycle. A following crate moves only if its leading crate moves.
    """
    newly_stuck = attach(level, state)
    if state["gravity"] is None:
        return newly_stuck > 0
    if context is None:
        context = make_context(level)
    dx, dy = DIRS[state["gravity"]]
    cols, rows = level["cols"], level["rows"]
    crates = state["crates"]
    occupied = {c["y"] * cols + c["x"]: i for i, c in enumerate(crates)}
    movable: dict[int, bool] = {}

    def can_move(i: int) -> bool:
        if i in movable:
            return movable[i]
        c = crates[i]
        x, y = c["x"] + dx, c["y"] + dy
        key = y * cols + x
        if c["stuck"] or not (0 <= x < cols and 0 <= y < rows) or key in context["blocked"]:
            movable[i] = False
        else:
            ahead = occupied.get(key)
            movable[i] = ahead is None or can_move(ahead)
        return movable[i]

    for i in range(len(crates)):
        can_move(i)
    count = 0
    for i, c in enumerate(crates):
        if movable[i]:
            c["x"] += dx
            c["y"] += dy
            count += 1
    attached = attach(level, state)
    state["won"] = is_won(level, state)
    return count > 0 or attached > 0 or newly_stuck > 0


def state_key(state: State) -> str:
    """Web-identical canonical search key; same-colour crates interchange."""
    cells = sorted(f"{c['color']}:{c['x']},{c['y']},{int(c['stuck'])}" for c in state["crates"])
    return f"{int(state['glue'])}{state['gravity'] or '-'}|" + ";".join(cells)


def transition(level: Level, state: State, action: str, *, trace: bool = False,
               context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Resolve N/E/S/W/G to rest, without mutating the input level or state.

    Trace snapshots match the web implementation: changed controls first,
    simultaneous microsteps, then the final stable snapshot (including a hold).
    There is no render timer in the physics and no hidden extra player action.
    """
    if action not in (*ORDER, "G"):
        raise ValueError(f"Unknown command {action!r}; expected N/E/S/W/G.")
    s, frames = copy_state(state), []
    before = state_key(s)
    if state["won"]:
        return {"state": s, "frames": frames, "changed": False, "event": "ALREADY_WON"}
    if action == "G":
        if not level["allowGlueToggle"]:
            return {"state": s, "frames": frames, "changed": False, "event": "GLUE_UNAVAILABLE"}
        s["glue"] = not s["glue"]
        if not s["glue"]:
            for c in s["crates"]:
                c["stuck"] = False
    else:
        s["gravity"] = action
    attach(level, s)
    s["won"] = is_won(level, s)
    if trace:
        frames.append(copy_state(s))
    if context is None:
        context = make_context(level)
    for _ in range(level["cols"] + level["rows"] + 2):
        if not tick(level, s, context):
            break
        if trace:
            frames.append(copy_state(s))
    else:
        raise RuntimeError("Physics failed to settle within its monotonic bound.")
    s["won"] = is_won(level, s)
    if trace:
        frames.append(copy_state(s))
    event = ("WIN" if s["won"] else ("GLUE_ON" if s["glue"] else "GLUE_OFF")
             if action == "G" else "SETTLED")
    return {"state": s, "frames": frames, "changed": before != state_key(s), "event": event}


def invariant(level: Level, state: State) -> bool:
    """Check geometry, overlap, valid adhesion and the win flag."""
    occupied = {(x, y) for x, y in level["obstacles"]}
    for c in state["crates"]:
        cell = c["x"], c["y"]
        if (not _integer(c["x"], 0, level["cols"] - 1)
                or not _integer(c["y"], 0, level["rows"] - 1) or cell in occupied):
            return False
        occupied.add(cell)
        if c["stuck"] and (not state["glue"] or not touches_target(level, c)):
            return False
    return state["won"] == is_won(level, state)


def solve(level: Level, start: State | None = None, *, max_states: int = 120_000,
          max_depth: int = 40, max_ms: float | None = 8_000,
          no_toggle: bool = False) -> dict[str, Any]:
    """Breadth-first shortest-path search, kept OUT of the runtime action path.

    'unsolvable' means all reachable states were exhausted. Resource/depth/time
    cutoffs return 'limit', never a claim of impossibility. max_ms=None disables
    the time budget (useful for reproducible offline tests).
    """
    if type(max_states) is not int or max_states < 1:
        raise ValueError("max_states must be a positive integer.")
    if type(max_depth) is not int or max_depth < 0:
        raise ValueError("max_depth must be a nonnegative integer.")
    if max_ms is not None and (isinstance(max_ms, bool) or not math.isfinite(max_ms) or max_ms <= 0):
        raise ValueError("max_ms must be positive or None.")
    started = time.perf_counter()
    start = initial_state(level) if start is None else copy_state(start)
    actions = ORDER + (("G",) if level["allowGlueToggle"] and not no_toggle else ())
    nodes = [(start, -1, None, 0)]
    seen = {state_key(start)}
    ctx = make_context(level)
    head, cutoff = 0, False

    def result(status: str, idx: int | None = None) -> dict[str, Any]:
        path = None
        if idx is not None:
            path = []
            while nodes[idx][1] >= 0:
                path.append(nodes[idx][2])
                idx = nodes[idx][1]
            path.reverse()
        return {"status": status, "actions": path, "visited": len(seen),
                "optimal": status == "solved", "ms": round((time.perf_counter() - started) * 1000)}

    while head < len(nodes):
        idx, (state, _, _, depth) = head, nodes[head]
        head += 1
        if state["won"]:
            return result("solved", idx)
        if depth >= max_depth:
            cutoff = True
            continue
        for action in actions:
            next_result = transition(level, state, action, context=ctx)
            if not next_result["changed"]:
                continue
            next_state = next_result["state"]
            key = state_key(next_state)
            if key in seen:
                continue
            seen.add(key)
            nodes.append((next_state, idx, action, depth + 1))
            if next_state["won"]:
                return result("solved", len(nodes) - 1)
            if len(seen) >= max_states or (max_ms is not None and (time.perf_counter() - started) * 1000 > max_ms):
                return result("limit")
    return result("limit" if cutoff else "unsolvable")


def geometry(level: Level) -> dict[str, int]:
    cell = 48 // max(level["cols"], level["rows"])
    w, h = level["cols"] * cell, level["rows"] * cell
    return {"x": (FRAME - w) // 2, "y": (FRAME - h) // 2,
            "cell": cell, "w": w, "h": h}


def action_at(x: Any, y: Any, level: Level) -> str | None:
    if not _integer(x, 0, FRAME - 1) or not _integer(y, 0, FRAME - 1):
        return None
    for action, (x0, y0, x1, y1) in BUTTONS.items():
        if x0 <= x < x1 and y0 <= y < y1 and (action != "G" or level["allowGlueToggle"]):
            return action
    return None


def level_action_budget(level_index: int) -> int:
    """Max actions for a level (min + 50%, L06 capped at 15)."""
    if not 0 <= level_index < len(LEVEL_ACTION_BUDGET):
        raise ValueError(f"level_index out of range: {level_index}")
    return LEVEL_ACTION_BUDGET[level_index]


def render_frame(
    level: Level,
    state: State,
    *,
    grid: bool = False,
    level_index: int = 0,
    completed: Iterable[int] = (),
    actions_left: int | None = None,
) -> Pixels:
    """Pixel-for-pixel port of the approved web renderer; no antialiasing."""
    pixels = [[5] * FRAME for _ in range(FRAME)]
    g = geometry(level)
    x, y, cell, w, h = (g[k] for k in ("x", "y", "cell", "w", "h"))

    def rect(a: int, b: int, width: int, height: int, color: int) -> None:
        for yy in range(max(0, b), min(FRAME, b + height)):
            for xx in range(max(0, a), min(FRAME, a + width)):
                pixels[yy][xx] = color

    rect(x, y, w, h, level.get("background", 4))
    if grid:
        for yy in range(level["rows"]):
            for xx in range(level["cols"]):
                rect(x + xx * cell, y + yy * cell, 1, 1, 3)
    rect(x, y - 2, w, 2, COLORS[level["walls"]["N"]])
    rect(x + w, y, 2, h, COLORS[level["walls"]["E"]])
    rect(x, y + h, w, 2, COLORS[level["walls"]["S"]])
    rect(x - 2, y, 2, h, COLORS[level["walls"]["W"]])
    for ox, oy in level["obstacles"]:
        rect(x + ox * cell, y + oy * cell, cell, cell, 2)
        rect(x + ox * cell + 1, y + oy * cell + 1, max(1, cell - 2), max(1, cell - 2), 3)
    for c in state["crates"]:
        px, py = x + c["x"] * cell, y + c["y"] * cell
        rect(px, py, cell, cell, COLORS[c["color"]])
        rect(px + 1, py + 1, 1, 1, 0 if c["stuck"] else 5)
    pattern = (".###.", "#...#", "#...#", "#...#", ".###.")
    for direction in ORDER:
        cx, cy = BUTTON_CENTERS[direction]
        for j, row in enumerate(pattern):
            for i, char in enumerate(row):
                if char == "#":
                    rect(cx - 2 + i, cy - 2 + j, 1, 1, COLORS[level["walls"][direction]])
        if state["gravity"] == direction:
            rect(cx, cy, 1, 1, 0)
    if level["allowGlueToggle"]:
        color = 0 if state["glue"] else 2
        rect(59, 59, 1, 4, color)
        rect(63, 59, 1, 4, color)
        rect(59, 62, 5, 1, color)
        if state["glue"]:
            rect(61, 60, 1, 1, 14)
    completed = set(completed)
    for i in range(6):
        rect(i, 0, 1, 2, 0 if i == level_index else 14 if i in completed else 4)
    # Magenta action budget: top-right, 1 px wide per remaining action (2 px tall).
    budget = level_action_budget(level_index) if 0 <= level_index < len(LEVEL_ACTION_BUDGET) else 0
    remaining = budget if actions_left is None else max(0, min(budget, int(actions_left)))
    for i in range(remaining):
        rect(FRAME - 1 - i, 0, 1, 2, C_MAGENTA)
    if state["won"]:
        for a, b in ((0, 60), (1, 61), (2, 60), (3, 59)):
            rect(a, b, 1, 2, 14)
    return pixels


class GameInfo(Protocol):
    """Structural interface: an existing CustomGameInfo already satisfies this."""
    game_id: str
    title: str
    levels: int
    default_fps: float
    family: str


@dataclass(frozen=True)
class GravityBoxInfo:
    game_id: str = "gravity_box"
    title: str = "Gravity Box"
    levels: int = 6
    default_fps: float = 20
    family: str = "gravity_box"


class GravityBoxEngine:
    """Adapter for reset/level_reset/action/public_state in the custom backend.

    By default, winning a level advances immediately; its solved animation frames
    are returned before the next initial frame. The sixth win returns WIN.
    auto_advance=False holds LEVEL_COMPLETE until advance_level() for local play.
    No default action/time limit; max_steps optionally enables a per-level budget.
    Physics never calls the solver. Default public state omits object/debug data.
    """

    def __init__(self, info: GameInfo | None = None, *, levels_dir: str | Path | None = None,
                 levels: list[Level] | None = None, animate: bool = True,
                 auto_advance: bool = True, max_steps: int | None = None,
                 debug: bool = False) -> None:
        if levels is not None and levels_dir is not None:
            raise ValueError("Use levels OR levels_dir, not both.")
        bank = ([validate_level(level) for level in levels] if levels is not None
                else load_levels(LEVELS_DIR if levels_dir is None else levels_dir))
        if not bank or len(bank) > 6:
            raise ValueError("This six-slot game accepts 1 to 6 levels.")
        self.info = info if info is not None else GravityBoxInfo(levels=len(bank))
        if not _integer(self.info.levels, 1, len(bank)):
            raise ValueError(f"info.levels must be between 1 and {len(bank)}.")
        if (isinstance(self.info.default_fps, bool) or not isinstance(self.info.default_fps, (int, float))
                or not math.isfinite(self.info.default_fps) or self.info.default_fps <= 0):
            raise ValueError("info.default_fps must be positive and finite.")
        if max_steps is not None and (type(max_steps) is not int or max_steps < 1):
            raise ValueError("max_steps must be a positive integer or None.")
        self.win_levels = int(self.info.levels)
        self._templates = deepcopy(bank[:self.win_levels])
        self.animate, self.auto_advance, self.debug = animate, auto_advance, debug
        self.max_steps = max_steps
        self.source_path = str(levels_dir or LEVELS_DIR) if levels is None else "<in-memory levels>"
        self.reset()

    @property
    def level(self) -> int:
        return self._index + 1

    @property
    def levels_completed(self) -> int:
        return len(self._completed)

    def _begin_level(self, index: int) -> None:
        self._index = index
        self._level = deepcopy(self._templates[index])
        self._physics = initial_state(self._level)
        self._context = make_context(self._level)
        self.level_steps = 0
        # Per-level action budget (+50% over verified minimum; L06 ≤ 15).
        self.max_steps = level_action_budget(index)
        self.state = "NOT_FINISHED"
        # An editor may export a solved start; show it as complete, not stuck.
        # Do not recursively skip solved starts: advance_level() remains explicit.
        if self._physics["won"]:
            self._completed.add(index)
            self.state = "WIN" if index == self.win_levels - 1 else "LEVEL_COMPLETE"

    def _actions_left(self) -> int:
        budget = int(self.max_steps or level_action_budget(self._index))
        return max(0, budget - self.level_steps)

    def _render(
        self,
        physics: State | None = None,
        *,
        level: Level | None = None,
        level_index: int | None = None,
        completed: set[int] | None = None,
        actions_left: int | None = None,
    ) -> Pixels:
        return render_frame(
            level if level is not None else self._level,
            physics if physics is not None else self._physics,
            level_index=self._index if level_index is None else level_index,
            completed=self._completed if completed is None else completed,
            actions_left=self._actions_left() if actions_left is None else actions_left,
        )

    def reset(self) -> dict[str, Any]:
        """Start a fresh six-level episode, resetting all counters/progress."""
        self._completed: set[int] = set()
        self.step_index = 0
        self.last_action, self.last_event, self.last_command = "RESET", "READY", None
        self._begin_level(0)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        """Restart THIS level, including after WIN; keep earlier completions."""
        self._completed.discard(self._index)
        self._begin_level(self._index)
        self.last_action, self.last_event, self.last_command = "ACTION7", "LEVEL_RESET", None
        return self.public_state()

    def advance_level(self) -> dict[str, Any]:
        """Local-play helper, not an ARC action; requires a solved current level."""
        if not self._physics["won"] or self._index >= self.win_levels - 1:
            return self.public_state()
        self._begin_level(self._index + 1)
        self.last_event = "LEVEL_STARTED"
        return self.public_state()

    def select_level(self, number: int) -> dict[str, Any]:
        """Practice helper (not an ARC action); never credits skipped levels.

        Existing earlier completion marks are kept, and this level is restarted.
        Use reset() to return to the ordinary complete-episode evaluation path.
        """
        if type(number) is not int or not 1 <= number <= self.win_levels:
            raise ValueError(f"Level number must be from 1 to {self.win_levels}.")
        self._completed.discard(number - 1)
        self._begin_level(number - 1)
        self.last_action, self.last_event, self.last_command = "RESET", "LEVEL_SELECTED", None
        return self.public_state()

    @staticmethod
    def _action_id(action_id: int | str) -> int:
        if isinstance(action_id, str):
            match = re.fullmatch(r"(?:ACTION)?([1-7])", action_id)
            if match:
                return int(match[1])
        elif type(action_id) is int and 1 <= action_id <= 7:
            return action_id
        raise ValueError("Expected ACTION1..ACTION7 or an integer from 1 to 7.")

    def action(self, action_id: int | str, data: Mapping[str, Any] | None = None) -> dict[str, Any]:
        aid = self._action_id(action_id)
        if data is not None and not isinstance(data, Mapping):
            raise ValueError("Action data must be an object with optional x/y fields.")
        if aid == 7:
            return self.level_reset()
        if self.state != "NOT_FINISHED":
            return self.public_state()
        command = (action_at((data or {}).get("x"), (data or {}).get("y"), self._level)
                   if aid == 6 else ACTION_TO_COMMAND[aid])
        if command is None:
            self.last_event = "NO_CONTROL"
            return self.public_state()
        result = transition(self._level, self._physics, command,
                            trace=self.animate, context=self._context)
        if result["event"] == "GLUE_UNAVAILABLE":
            self.last_event = "GLUE_UNAVAILABLE"
            return self.public_state()
        self.last_action, self.last_command = f"ACTION{aid}", command
        self.last_event = result["event"]
        # Like the web UI, a valid repeated direction counts even if nothing moves.
        self.step_index += 1
        self.level_steps += 1
        self._physics = result["state"]
        index, level, completed = self._index, self._level, set(self._completed)
        # Intermediate physics frames keep the pre-action remaining count minus
        # this spent action (already reflected in level_steps).
        spent_left = self._actions_left()
        frames = [
            self._render(s, level=level, level_index=index, completed=completed, actions_left=spent_left)
            for s in result["frames"]
        ]
        completed_level = None
        completed_level_steps = None
        if self._physics["won"]:
            completed_level, completed_level_steps = self.level, self.level_steps
            self._completed.add(index)
            if index == self.win_levels - 1:
                self.state, self.last_event = "WIN", "GAME_WON"
            elif self.auto_advance:
                self._begin_level(index + 1)
                self.last_event = "LEVEL_COMPLETE"
            else:
                self.state, self.last_event = "LEVEL_COMPLETE", "LEVEL_COMPLETE"
        elif self.max_steps is not None and self.level_steps >= self.max_steps:
            # Budget exhausted: two full-screen red blinks, then restart level.
            self.state, self.last_event = "GAME_OVER", "STEP_LIMIT"
            base = self._render(actions_left=0)
            red = [[C_RED for _ in range(FRAME)] for _ in range(FRAME)]
            frames.extend([deepcopy(red), deepcopy(base), deepcopy(red), deepcopy(base)])
            self._completed.discard(index)
            self._begin_level(index)
            self.last_event = "BUDGET_RESET"
            self.state = "NOT_FINISHED"
        public = self.public_state()
        if frames:
            if frames[-1] != public["frame"]:
                frames.append(deepcopy(public["frame"]))
            public["frames"] = frames
            public["frame_count"] = len(frames)
            public["transition_frame_interval_ms"] = 1000 / self.info.default_fps
        if completed_level is not None:
            public["completed_level"] = completed_level
            public["completed_level_steps"] = completed_level_steps
        return public

    def render(self) -> Pixels:
        return self._render()

    def snapshot(self) -> dict[str, Any]:
        """Developer-only copy of the current definition and physical state."""
        return {"level": deepcopy(self._level), "physics": deepcopy(self._physics)}

    def public_state(self) -> dict[str, Any]:
        pixels = self.render()
        ids = ([1, 2, 3, 4] + ([5] if self._level["allowGlueToggle"] else []) + [6, 7]
               if self.state == "NOT_FINISHED" else [7])
        output = {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "frame": pixels, "frames": [deepcopy(pixels)], "frame_count": 1,
            "default_fps": self.info.default_fps, "state": self.state,
            "level": self.level, "levels_completed": self.levels_completed,
            "win_levels": self.win_levels, "step_index": self.step_index,
            "available_actions": [f"ACTION{i}" for i in ids], "available_action_ids": ids,
            "last_action": self.last_action, "last_event": self.last_event,
            "score": self.levels_completed, "full_reset": False,
            "source_path": self.source_path, "custom_family": self.info.family,
            "level_name": self._level["name"], "level_steps": self.level_steps,
            "max_steps": self.max_steps,
            "actions_left": self._actions_left(),
            "action_minimum": LEVEL_ACTION_MINIMUM[self._index],
        }
        if self.debug:
            output.update(gravity=self._physics["gravity"], glue_enabled=self._physics["glue"],
                          crates=deepcopy(self._physics["crates"]),
                          allow_glue_toggle=self._level["allowGlueToggle"],
                          last_command=self.last_command)
        return output


# A short alias is convenient in small scripts; the canonical name is render_frame.
frame = render_frame
