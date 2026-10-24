"""Browser-local game host for the 100 genuine, source-pinned ARC3 engines.

The Web Worker extracts both source bundles beside this module. This adapter
owns manual sessions and Undo; it does not implement rules, solve games, or
send any request to an API. Only public observations cross the worker boundary.
"""
from __future__ import annotations

from collections import OrderedDict, deque
from dataclasses import dataclass, field
import importlib
import json
import pickle
import random
import re
from typing import Any
import zlib

from custom_games.registry import CUSTOM_GAMES, build_seeded_engine
from custom_level_navigation import can_select_level as can_select_custom_level
from custom_level_navigation import select_level as select_custom_level
from official_adapter import OFFICIAL_GAMES, create_official


DEFAULT_PALETTE = [
    "#FFFFFF", "#CCCCCC", "#999999", "#666666", "#333333", "#000000",
    "#E53AA3", "#FF7BCC", "#F93C31", "#1E93FF", "#88D8F1", "#FFDC00",
    "#FF851B", "#921231", "#4FCC30", "#A356D6",
]
CUSTOM_BY_CODE = {item.game_id.split("-", 1)[0].upper(): item for item in CUSTOM_GAMES}
MAX_SESSIONS = 8
MAX_UNDO_STEPS = 64
MAX_UNDO_BYTES = 8 * 1024 * 1024


@dataclass
class Session:
    code: str
    engine: Any
    game_id: str
    level_count: int
    palette: list[str]
    current: dict[str, Any] = field(default_factory=dict)
    history: deque[bytes] = field(default_factory=deque)
    history_bytes: int = 0


_sessions: OrderedDict[str, Session] = OrderedDict()
_active: str | None = None


def _frame(value: Any) -> list[list[int]]:
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, (list, tuple)) or len(value) != 64:
        raise ValueError("The game returned a frame with an invalid height")
    result = []
    for row in value:
        if not isinstance(row, (list, tuple)) or len(row) != 64:
            raise ValueError("The game returned a frame with an invalid width")
        pixels = [int(pixel) for pixel in row]
        if any(pixel < 0 or pixel > 15 for pixel in pixels):
            raise ValueError("The game returned an invalid palette index")
        result.append(pixels)
    return result


def _palette(value: Any, fallback: list[str]) -> list[str]:
    if isinstance(value, (list, tuple)) and len(value) == 16 and all(
        isinstance(color, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", color)
        for color in value
    ):
        return list(value)
    return list(fallback)


def _normalize(session: Session, raw: dict[str, Any]) -> dict[str, Any]:
    frames_raw = raw.get("frames")
    if frames_raw is None or len(frames_raw) == 0:
        frames_raw = [raw["frame"]]
    frames = [_frame(frame) for frame in frames_raw]
    final_frame = _frame(raw.get("frame", frames[-1]))
    # The final public frame is authoritative even if an engine's animation
    # packet omits a separate still frame at the end.
    if frames[-1] != final_frame:
        frames.append(final_frame)
    fps = max(1, min(240, int(raw.get("default_fps") or 10)))
    durations_raw = raw.get("frame_durations_ms")
    durations = []
    for index in range(len(frames)):
        value = durations_raw[index] if isinstance(durations_raw, (list, tuple)) and index < len(durations_raw) else 1000 / fps
        durations.append(max(0, min(10000, float(value or 0))))
    ids = raw.get("available_action_ids")
    if ids is None:
        ids = [int(str(action).removeprefix("ACTION")) for action in raw.get("available_actions", [])]
    available = sorted({int(action) for action in ids if 1 <= int(action) <= 7})
    state = str(raw.get("state") or "NOT_FINISHED")
    if state == "LOSE":
        state = "GAME_OVER"
    if state not in ("NOT_FINISHED", "WIN", "GAME_OVER", "LEVEL_COMPLETE"):
        raise ValueError(f"Unsupported game state: {state}")
    completed = int(raw.get("levels_completed", 0))
    level = max(1, min(session.level_count, int(raw.get("level", completed + 1))))
    return {
        "code": session.code,
        "gameId": session.game_id,
        "frame": final_frame,
        "frames": frames,
        "frameDurationsMs": durations,
        "defaultFps": fps,
        "palette": _palette(raw.get("palette"), session.palette),
        "state": state,
        "level": level,
        "levelCount": session.level_count,
        "levelsCompleted": completed,
        "availableActionIds": available,
        "canUndo": bool(session.history),
        "canSelectLevel": (can_select_custom_level(session.engine) if session.code in CUSTOM_BY_CODE
                           else callable(getattr(session.engine, "jump_to_level", None))),
        "backend": "python-wasm",
    }


def _stable(current: dict[str, Any]) -> dict[str, Any]:
    return dict(current, frames=[current["frame"]], frameDurationsMs=[0])


def _response(session: Session, *, animate: bool = False) -> dict[str, Any]:
    result = dict(session.current) if animate else _stable(session.current)
    result["canUndo"] = bool(session.history)
    return result


def _session() -> Session:
    if _active is None or _active not in _sessions:
        raise ValueError("Choose a game before using its controls")
    _sessions.move_to_end(_active)
    return _sessions[_active]


def _snapshot(session: Session) -> bytes:
    # Native custom state is pickled exactly (including each random.Random).
    # OfficialAdapter supplies a deterministic command-recipe __reduce__ to
    # rebind native animation closures to the restored engine correctly.
    value = (session.engine, random.getstate(), _stable(session.current))
    return zlib.compress(pickle.dumps(value, protocol=5), level=1)


def _restore(session: Session, snapshot: bytes) -> None:
    engine, random_state, current = pickle.loads(zlib.decompress(snapshot))
    session.engine = engine
    random.setstate(random_state)
    session.current = current


def _remember(session: Session, snapshot: bytes) -> None:
    session.history.append(snapshot)
    session.history_bytes += len(snapshot)
    # Keep at least the most recent undo even for an unusually large engine.
    while len(session.history) > 1 and (
        len(session.history) > MAX_UNDO_STEPS or session.history_bytes > MAX_UNDO_BYTES
    ):
        session.history_bytes -= len(session.history.popleft())


def _new_session(code: str, level: int = 1) -> Session:
    """Prepare a fresh practice session before replacing any playable state."""
    if code in CUSTOM_BY_CODE:
        info = CUSTOM_BY_CODE[code]
        engine = build_seeded_engine(info.game_id, instance_seed=0)
        module = importlib.import_module(engine.__class__.__module__)
        session = Session(code, engine, info.game_id, info.levels,
                          _palette(getattr(module, "PALETTE", None), DEFAULT_PALETTE))
    elif code in OFFICIAL_GAMES:
        engine = create_official(code, seed=0)
        session = Session(code, engine, engine.game_id, engine.level_count, DEFAULT_PALETTE.copy())
    else:
        raise ValueError(f"Unknown game code: {code}")
    if type(level) is not int or not 1 <= level <= session.level_count:
        raise ValueError(f"Level must be between 1 and {session.level_count}")
    if level == 1:
        raw = session.engine.public_state()
    elif code in CUSTOM_BY_CODE:
        raw = select_custom_level(session.engine, level)
    else:
        raw = session.engine.jump_to_level(level)
    session.current = _normalize(session, raw)
    if session.current["level"] != level or session.current["state"] != "NOT_FINISHED":
        raise ValueError(f"{code} could not start level {level}")
    # Prove Undo support before presenting a game as ready. This never replays
    # a move and does not alter the live engine.
    _snapshot(session)
    return session


def load_game(code: str, level: int | None = None) -> dict[str, Any]:
    global _active
    code = str(code).strip().upper()
    if code in _sessions and level is None:
        _active = code
        return _response(_session())
    # An explicit game + level is one atomic worker operation. Separate load
    # and select requests could select a level in the wrong game if a second
    # game selection is queued between them.
    previous_random = random.getstate()
    try:
        session = _new_session(code, 1 if level is None else level)
    except Exception:
        random.setstate(previous_random)
        raise
    _sessions[code] = session
    _sessions.move_to_end(code)
    _active = code
    while len(_sessions) > MAX_SESSIONS:
        _sessions.popitem(last=False)
    return _response(session)


def perform_action(action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
    session = _session()
    if type(action_id) is not int or action_id not in session.current["availableActionIds"]:
        raise ValueError("This action is not available in the current game state")
    if action_id == 6:
        if not isinstance(data, dict) or any(
            type(data.get(key)) is not int or not 0 <= data[key] <= 63 for key in ("x", "y")
        ):
            raise ValueError("A click requires integer x and y coordinates from 0 to 63")
        data = {"x": data["x"], "y": data["y"]}
    else:
        data = None
    before = _snapshot(session)
    try:
        session.current = _normalize(session, session.engine.action(action_id, data))
    except Exception:
        _restore(session, before)
        raise
    _remember(session, before)
    return _response(session, animate=True)


def undo() -> dict[str, Any]:
    session = _session()
    if not session.history:
        return _response(session)
    before = session.history[-1]
    # Keep the history entry if reconstruction fails, so it can be diagnosed
    # without consuming the user's previous state.
    _restore(session, before)
    session.history.pop()
    session.history_bytes -= len(before)
    return _response(session)


def reset() -> dict[str, Any]:
    session = _session()
    before = _snapshot(session)
    try:
        # Some older custom engines deliberately ignore resets after WIN.
        # Their exact pre-winning state is retained in Undo history: restoring
        # it first lets the native level reset restart that same authored level
        # without inventing a game-specific state mutation or resetting L1.
        if session.current["state"] == "WIN" and session.code in CUSTOM_BY_CODE and session.history:
            _restore(session, session.history[-1])
        if callable(getattr(session.engine, "level_reset", None)):
            result = session.engine.level_reset()
        else:
            result = session.engine.action(7)
        session.current = _normalize(session, result)
    except Exception:
        _restore(session, before)
        raise
    session.history.clear()
    session.history_bytes = 0
    return _response(session, animate=True)


def _restart_at_level(level: int) -> dict[str, Any]:
    session = _session()
    if type(level) is not int or not 1 <= level <= session.level_count:
        raise ValueError(f"Level must be between 1 and {session.level_count}")
    # Build separately: a failed level entry must leave the previous engine,
    # current frame, and Undo history intact. A successful jump starts fresh.
    previous_random = random.getstate()
    try:
        replacement = _new_session(session.code, level)
    except Exception:
        random.setstate(previous_random)
        raise
    _sessions[session.code] = replacement
    return _response(replacement)


def restart() -> dict[str, Any]:
    """Start the active game again from level one, clearing its campaign state."""
    return _restart_at_level(1)


def select_level(level: int) -> dict[str, Any]:
    """Start an authored level for manual practice, without replaying earlier ones."""
    return _restart_at_level(level)


def dispatch(request_json: str) -> str:
    """The single JSON boundary used by the TypeScript Web Worker."""
    try:
        request = json.loads(request_json)
        if not isinstance(request, dict):
            raise ValueError("The game command must be an object")
        kind = request.get("type")
        if kind == "load":
            result = load_game(request.get("code", ""), request.get("level"))
        elif kind == "action":
            result = perform_action(request.get("actionId"), request.get("data"))
        elif kind == "undo":
            result = undo()
        elif kind == "reset":
            result = reset()
        elif kind == "restart":
            result = restart()
        elif kind == "selectLevel":
            result = select_level(request.get("level"))
        elif kind == "observe":
            result = _response(_session())
        elif kind == "catalog":
            result = {"codes": sorted(set(CUSTOM_BY_CODE) | set(OFFICIAL_GAMES))}
        else:
            raise ValueError(f"Unknown game command: {kind}")
        return json.dumps(result, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    except Exception as error:
        return json.dumps({"error": f"{type(error).__name__}: {error}"}, ensure_ascii=False)
