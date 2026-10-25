"""ONDE — Ondes web v4, port for the ARC-3 custom_3 backend.

ACTION3 / ACTION4 move ONLY the selected full wave by -1 / +1 pixel.
ACTION6 selects a wave or clicks the top film arrows: every wave moves together
by its colour's displacement (blue 1, violet 2, red 3). ACTION5 is inactive.
ACTION7 resets this level; reset()/0/"RESET" reset the whole campaign.

The six original JSON files must be installed beside the custom engine tree,
at custom_games/games/wave_alignment/levels. Python 3.10+, standard library
only: no JS engine, network, wall clock, random generation or solver at runtime.

All rasters, including three separated green victory blinks, match web v4.
frame is 2D; frames is 3D. public_state() consumes a pending animation once.
For exact web timing, honour frame_durations_ms; the fallback default_fps is
10 for victory sequences (five green + three normal frames per blink).
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
BASE = 59
MAX_HEIGHT = 5
LEVEL_COUNT = 6
GAME_ID = "onde-c3000001"
FAMILY = "wave_alignment"
WAVE = "custom_3"
WEB_VERSION = "4.0"
ANIM_FPS = 16
WIN_FPS = 10
WIN_BLINKS = 3
WIN_ON_FRAMES = 5
WIN_OFF_FRAMES = 3
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / FAMILY / "levels"
ACTION_LEFT, ACTION_RIGHT, ACTION_CLICK, ACTION_RESET = 3, 4, 6, 7
PALETTE = (
    "#F3F2EB", "#CBD2D5", "#37424E", "#697586", "#1C2530", "#10161F",
    "#B659AD", "#E8B8A6", "#F07578", "#6BAAFF", "#6EDDD3", "#F2CF71",
    "#EDA568", "#87614A", "#83D6A6", "#B59AFF",
)
SPEEDS = {9: 1, 15: 2, 8: 3}
BUTTONS = {"film_left": {"x": 44, "y": 1, "w": 8, "h": 5},
           "film_right": {"x": 55, "y": 1, "w": 7, "h": 5}}
FILM = {"x": 24, "y": 0, "w": 19, "h": 7}
Raster = list[list[int]]
Level = dict[str, Any]


def _integer(value: Any, label: str, lo: int, hi: int) -> int:
    """Reject booleans, strings and floats; coordinates must be native integers."""
    if type(value) is not int or not lo <= value <= hi:
        raise ValueError(f"{label}: expected an integer in {lo}..{hi}, got {value!r}")
    return value


def _inside(x: int, y: int, rect: Mapping[str, int]) -> bool:
    return (rect["x"] <= x < rect["x"] + rect["w"]
            and rect["y"] <= y < rect["y"] + rect["h"])


def _fill(buf: bytearray, x: int, y: int, w: int, h: int, color: int) -> None:
    left, right = max(0, x), min(SIZE, x + w)
    if right <= left:
        return
    line = bytes([color]) * (right - left)
    for yy in range(max(0, y), min(SIZE, y + h)):
        buf[yy * SIZE + left:yy * SIZE + right] = line


def _outline(buf: bytearray, r: Mapping[str, int], color: int) -> None:
    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    _fill(buf, x, y, w, 1, color)
    _fill(buf, x, y + h - 1, w, 1, color)
    _fill(buf, x, y, 1, h, color)
    _fill(buf, x + w - 1, y, 1, h, color)


def _corners(buf: bytearray, r: Mapping[str, int], color: int) -> None:
    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    for xx, yy, dx, dy in ((x, y, 1, 1), (x + w - 1, y, -1, 1),
                            (x, y + h - 1, 1, -1),
                            (x + w - 1, y + h - 1, -1, -1)):
        _fill(buf, xx, yy, 1, 1, color)
        _fill(buf, xx + dx, yy, 1, 1, color)
        _fill(buf, xx, yy + dy, 1, 1, color)


def wave_height(wave: Mapping[str, Any], offset: int, x: int) -> int:
    pattern = wave["pattern"]
    return pattern[(x - offset) % len(pattern)]


def sample(level: Level, offsets: Sequence[int]) -> list[dict[str, Any]]:
    """Current instantaneous readings, never a cumulative time integral."""
    readings = []
    for detector in level["detectors"]:
        parts = [wave_height(w, offsets[i], detector["x"])
                 for i, w in enumerate(level["waves"])]
        total = sum(parts)
        readings.append({"x": detector["x"], "target": detector["target"],
                         "parts": parts, "sum": total,
                         "error": total - detector["target"],
                         "match": total == detector["target"]})
    return readings


def film_period(level: Level) -> int:
    """A period restoring all effective wave phases, not the five film icons."""
    period = 1
    for wave in level["waves"]:
        size = len(wave["pattern"])
        period = math.lcm(period, size // math.gcd(size, SPEEDS[wave["color"]]))
    return period


def validate(level_data: list[Level]) -> list[Level]:
    """Copy and validate the six-level web-v4 schema without changing its data."""
    if not isinstance(level_data, list) or len(level_data) != LEVEL_COUNT:
        raise ValueError("Exactly six level objects are required")
    levels = copy.deepcopy(level_data)
    for i, level in enumerate(levels):
        label = f"L{i + 1:02d}"
        if not isinstance(level, dict):
            raise ValueError(f"{label}: expected a level object")
        _integer(level.get("number"), label + ".number", i + 1, i + 1)
        if (not isinstance(level.get("title"), str)
                or level.get("mode") != "manual_film"):
            raise ValueError(f"{label}: title and mode='manual_film' are required")
        _integer(level.get("max_height"), label + ".max_height", 5, 5)
        waves = level.get("waves")
        if not isinstance(waves, list) or not 1 <= len(waves) <= 3:
            raise ValueError(f"{label}: use one to three waves")
        for j, wave in enumerate(waves):
            name = f"{label}.waves[{j}]"
            if not isinstance(wave, dict):
                raise ValueError(f"{name}: expected an object")
            _integer(wave.get("id"), name + ".id", j, j)
            color = _integer(wave.get("color"), name + ".color", 0, 15)
            if color not in SPEEDS:
                raise ValueError(f"{name}: color must be 9, 15 or 8")
            pattern = wave.get("pattern")
            if not isinstance(pattern, list) or not 4 <= len(pattern) <= 30:
                raise ValueError(f"{name}: period must contain 4..30 samples")
            for k, height in enumerate(pattern):
                _integer(height, f"{name}.pattern[{k}]", 0, MAX_HEIGHT)
            if not any(pattern):
                raise ValueError(f"{name}: the pattern must have a nonzero sample")
            _integer(wave.get("offset"), name + ".offset", 0, len(pattern) - 1)
        detectors = level.get("detectors")
        if not isinstance(detectors, list) or not 1 <= len(detectors) <= 3:
            raise ValueError(f"{label}: use one to three detectors")
        maximum = sum(max(w["pattern"]) for w in waves)
        xs: list[int] = []
        for j, detector in enumerate(detectors):
            name = f"{label}.detectors[{j}]"
            if not isinstance(detector, dict):
                raise ValueError(f"{name}: expected an object")
            x = _integer(detector.get("x"), name + ".x", 4, 59)
            _integer(detector.get("target"), name + ".target", 0, maximum)
            if any(abs(x - other) < 8 for other in xs):
                raise ValueError(f"{name}: detectors must be at least 8 pixels apart")
            xs.append(x)
        if all(r["match"] for r in sample(level, [w["offset"] for w in waves])):
            raise ValueError(f"{label}: initial configuration must be unsolved")
    return levels


def _load_levels(directory: Path) -> list[Level]:
    levels = []
    for number in range(1, LEVEL_COUNT + 1):
        path = directory / f"L{number:02d}.json"
        try:
            levels.append(json.loads(path.read_text(encoding="utf-8")))
        except FileNotFoundError as exc:
            raise FileNotFoundError(
                f"Missing {path}. Install the six JSON files alongside the engine; "
                "the .py file alone is not a complete game."
            ) from exc
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ValueError(f"Invalid level file {path}: {exc}") from exc
    return validate(levels)


class WaveAlignmentEngine:
    """CustomGameInfo-compatible engine preserving the accepted Ondes v4 rules.

    info provides game_id, title, family, levels and default_fps. Normally levels
    is 6; a shorter campaign prefix can be requested without modifying JSON.
    levels_dir and level_data are optional author/testing overrides, never
    runtime inputs used by the player to change a rule or reveal a solution.
    """

    def __init__(self, info: CustomGameInfo, *, levels_dir: str | Path | None = None,
                 level_data: list[Level] | None = None) -> None:
        if levels_dir is not None and level_data is not None:
            raise ValueError("Use either levels_dir or level_data, not both")
        self.info = info
        self.levels_dir = Path(levels_dir).resolve() if levels_dir is not None else LEVELS_DIR
        self._templates = (_load_levels(self.levels_dir) if level_data is None
                           else validate(level_data))
        self.win_levels = _integer(info.levels, "info.levels", 1, LEVEL_COUNT)
        self._fps = _integer(info.default_fps, "info.default_fps", 1, 240)
        self._completed = [False] * LEVEL_COUNT
        self._index = 0
        self.selected_wave = 0
        self._individual: list[int] = []
        self._shifts: list[int] = []
        self.film_position = 0
        self.film_moves = 0
        self.translations = 0
        self.step_index = 0
        self.test_mode = False
        self.state = "NOT_FINISHED"
        self.last_action = "RESET"
        self._event = "reset"
        self._pending_frames: list[Raster] | None = None
        self._pending_extra: dict[str, Any] = {}
        self._setup(0)

    @property
    def levels_completed(self) -> int:
        return sum(self._completed)

    @property
    def _level(self) -> Level:
        return self._templates[self._index]

    def _setup(self, index: int) -> None:
        self._index = index
        self.selected_wave = 0
        self._individual = [w["offset"] for w in self._level["waves"]]
        self._shifts = [0] * len(self._individual)
        self.film_position = self.film_moves = self.translations = 0
        self.state = "NOT_FINISHED"

    def _effective(self) -> list[int]:
        k = self.film_position % film_period(self._level)
        return [(self._individual[i] + SPEEDS[w["color"]] * k) % len(w["pattern"])
                for i, w in enumerate(self._level["waves"])]

    def _readings(self) -> list[dict[str, Any]]:
        return sample(self._level, self._effective())

    def _lane_rect(self, index: int) -> dict[str, int]:
        pitch = 30 // len(self._level["waves"])
        y = 8 + index * pitch
        return {"x": 0, "y": y, "w": 64, "h": pitch,
                "baseline": y + (pitch + MAX_HEIGHT) // 2}

    @staticmethod
    def _selector_rect(index: int) -> dict[str, int]:
        return {"x": 2 + index * 7, "y": 1, "w": 5, "h": 4}

    @staticmethod
    def _draw_arrow(buf: bytearray, rect: Mapping[str, int], direction: int) -> None:
        _fill(buf, rect["x"], rect["y"], rect["w"], rect["h"], 4)
        _outline(buf, rect, 3)
        cx, cy = rect["x"] + rect["w"] // 2, rect["y"] + 2
        _fill(buf, cx - 1, cy, 3, 1, 0)
        _fill(buf, cx, cy - 1, 1, 1, 0)
        _fill(buf, cx, cy + 1, 1, 1, 0)
        _fill(buf, cx + 1 if direction < 0 else cx - 2, cy, 2, 1, 0)

    def _render_frame(self, *, border: int | None = None) -> Raster:
        """Draw exactly the integer raster and layer order of the web v4."""
        buf = bytearray([5]) * (SIZE * SIZE)
        level, offsets = self._level, self._effective()
        readings = sample(level, offsets)
        for detector in level["detectors"]:
            for y in range(8, 40, 3):
                _fill(buf, detector["x"], y, 1, 1, 2)
        for i, wave in enumerate(level["waves"]):
            lane = self._lane_rect(i)
            for x in range(0, 64, 4):
                _fill(buf, x, lane["baseline"], 2, 1, 2)
            for x in range(64):
                height = wave_height(wave, offsets[i], x)
                if height:
                    _fill(buf, x, lane["baseline"] - height, 1, height, wave["color"])
            for detector in level["detectors"]:
                x = detector["x"]
                _fill(buf, x, lane["baseline"] - wave_height(wave, offsets[i], x), 1, 1, 0)
            if i == self.selected_wave:
                _corners(buf, lane, 0)
        _fill(buf, 0, 40, 64, 21, 4)
        _fill(buf, 0, 40, 64, 1, 2)
        _fill(buf, 0, 60, 64, 1, 2)
        maximum = sum(max(w["pattern"]) for w in level["waves"])
        for detector, reading in zip(level["detectors"], readings):
            x, target_y = detector["x"], BASE - detector["target"]
            color = 14 if reading["match"] else 11
            _fill(buf, x - 2, BASE - maximum, 1, maximum + 1, 2)
            _fill(buf, x + 2, BASE - maximum, 1, maximum + 1, 2)
            _fill(buf, x - 2, BASE, 5, 1, 3)
            y = BASE
            for i, part in enumerate(reading["parts"]):
                for _ in range(part):
                    y -= 1
                    _fill(buf, x - 1, y, 3, 1, level["waves"][i]["color"])
            _fill(buf, x - 2, BASE - reading["sum"], 1, 1, 14 if reading["match"] else 0)
            _fill(buf, x + 2, BASE - reading["sum"], 1, 1, 14 if reading["match"] else 0)
            # One 2px-by-1px target mark OUTSIDE each side of the gauge.
            _fill(buf, x - 4, target_y, 2, 1, color)
            _fill(buf, x + 3, target_y, 2, 1, color)
        for i, wave in enumerate(level["waves"]):
            rect = self._selector_rect(i)
            _fill(buf, rect["x"] + 1, rect["y"] + 1, rect["w"] - 2, rect["h"] - 2, wave["color"])
            if i == self.selected_wave:
                _outline(buf, rect, 0)
        _fill(buf, FILM["x"], 1, FILM["w"], 5, 13)
        for i in range(5):
            x = FILM["x"] + 4 * i
            _fill(buf, x, 2, 3, 3, 9 if i == self.film_position % 5 else 5)
            _fill(buf, x + 1, 0, 1, 1, 1)
            _fill(buf, x + 1, 6, 1, 1, 1)
        self._draw_arrow(buf, BUTTONS["film_left"], -1)
        self._draw_arrow(buf, BUTTONS["film_right"], 1)
        for i in range(LEVEL_COUNT):
            _fill(buf, 2 + i * 5, 62, 4, 1, 14 if self._completed[i] else 2)
        for i, reading in enumerate(readings):
            _fill(buf, 46 + i * 3, 62, 2, 1, 14 if reading["match"] else 11)
        if border is not None:
            _outline(buf, {"x": 0, "y": 0, "w": 64, "h": 64}, border)
        return [list(buf[y * SIZE:(y + 1) * SIZE]) for y in range(SIZE)]

    def _response(self, event: str, frames: list[Raster] | None = None,
                  **extra: Any) -> dict[str, Any]:
        self._event = event
        self._pending_frames = frames
        self._pending_extra = extra
        return self.public_state()

    def _finish_change(self, kind: str) -> dict[str, Any]:
        played = self._index + 1
        frames: list[Raster] = []
        timeline: list[dict[str, Any]] = []
        readings = self._readings()

        def add(name: str, border: int | None = None) -> None:
            frames.append(self._render_frame(border=border))
            timeline.append({"level": self._index + 1, "kind": name,
                             "film_position": self.film_position, "readings": self._readings()})

        # Feedback frames repeat a SINGLE completed action; no hidden ticks.
        for _ in range(3):
            add(kind)
        if not all(r["match"] for r in readings):
            return self._response("film_moved" if kind == "film" else "moved",
                                  frames, timeline=timeline)
        result = {"level": played, "success": True, "offsets": self._effective(),
                  "individual_offsets": self._individual[:],
                  "film_position": self.film_position, "moves": self.translations,
                  "film_moves": self.film_moves, "readings": copy.deepcopy(readings)}
        self._completed[self._index] = True
        for blink in range(WIN_BLINKS):
            for _ in range(WIN_ON_FRAMES):
                add("success", border=14)
            for _ in range(WIN_OFF_FRAMES):
                add("success_end" if blink == WIN_BLINKS - 1 else "success_pause")
        if self.test_mode or self._index + 1 >= self.win_levels:
            self.state = "WIN"
        else:
            self._setup(self._index + 1)
        add("ready")
        return self._response("win" if self.state == "WIN" else "success", frames,
                              timeline=timeline, result=result, played_level=played)

    def _move(self, dx: int) -> dict[str, Any]:
        wave = self._level["waves"][self.selected_wave]
        self._individual[self.selected_wave] = (self._individual[self.selected_wave] + dx) % len(wave["pattern"])
        self._shifts[self.selected_wave] += dx
        self.translations += 1
        return self._finish_change("shift")

    def _step_film(self, dx: int) -> dict[str, Any]:
        # One signed film update shifts every colour atomically, then validates.
        self.film_position += dx
        self.film_moves += 1
        return self._finish_change("film")

    def _click(self, x: Any, y: Any) -> dict[str, Any]:
        if type(x) is not int or type(y) is not int or not (0 <= x < 64 and 0 <= y < 64):
            return self._response("ignored")
        if _inside(x, y, BUTTONS["film_left"]):
            return self._step_film(-1)
        if _inside(x, y, BUTTONS["film_right"]):
            return self._step_film(1)
        for i in range(len(self._level["waves"])):
            if _inside(x, y, self._selector_rect(i)) or _inside(x, y, self._lane_rect(i)):
                self.selected_wave = i
                return self._response("selected")
        return self._response("ignored")

    def action(self, action_id: int | str | Mapping[str, Any],
               data: dict[str, Any] | None = None) -> dict[str, Any]:
        if isinstance(action_id, Mapping):
            packet = action_id
            data = packet.get("data")
            action_id = packet["id"] if "id" in packet else packet.get("action")
        if (type(action_id) is int and action_id == 0) or action_id == "RESET":
            return self.reset()
        if isinstance(action_id, str) and action_id in {"ACTION3", "ACTION4", "ACTION6", "ACTION7"}:
            action_id = int(action_id[6:])
        if type(action_id) is int and action_id == ACTION_RESET:
            self.step_index += 1
            return self.level_reset()
        if self.state == "WIN":
            return self._response("finished")
        if type(action_id) is not int or action_id not in (3, 4, 6):
            return self._response("ignored")
        self.step_index += 1
        self.last_action = f"ACTION{action_id}"
        if action_id == ACTION_LEFT:
            return self._move(-1)
        if action_id == ACTION_RIGHT:
            return self._move(1)
        payload = data if isinstance(data, Mapping) else {}
        return self._click(payload.get("x"), payload.get("y"))

    def reset(self) -> dict[str, Any]:
        self._completed = [False] * LEVEL_COUNT
        self.test_mode = False
        self.step_index = 0
        self.last_action = "RESET"
        self._setup(0)
        return self._response("reset")

    def level_reset(self) -> dict[str, Any]:
        """Direct method: no command count increment; action(7) increments it."""
        self._completed[self._index] = False
        self.last_action = "ACTION7"
        self._setup(self._index)
        return self._response("restart")

    def public_state(self) -> dict[str, Any]:
        """Custom backend envelope: 2D frame, 3D frames, animation delivered once.

        The optional per-frame durations reproduce the web UI at normal speed.
        A victory falls back to 10 fps when the viewer only understands fps,
        so its 5+3 repeated images retain the requested 0.5s/0.3s blink timing.
        No sleep occurs here. Subsequent observations never replay a success.
        """
        frames = self._pending_frames or [self._render_frame()]
        extra = self._pending_extra
        self._pending_frames, self._pending_extra = None, {}
        timeline = extra.get("timeline", [])
        has_blinks = any(q["kind"].startswith("success") for q in timeline)
        fps = (WIN_FPS if has_blinks else max(self._fps, ANIM_FPS)) if len(frames) > 1 else self._fps
        ids = [7] if self.state == "WIN" else [3, 4, 6, 7]
        count = self.levels_completed
        response = {
            "backend": "custom", "selected": True,
            "game_id": self.info.game_id, "title": self.info.title,
            "custom_family": self.info.family, "family": FAMILY, "wave": WAVE,
            "version": WEB_VERSION, "mode": "manual_film",
            "frame": frames[-1], "frames": frames, "frame_count": len(frames),
            "default_fps": fps, "state": self.state, "level": self._index + 1,
            "score": count, "levels_completed": count,
            "win_levels": 1 if self.test_mode else self.win_levels,
            "win_score": 1 if self.test_mode else self.win_levels,
            "available_actions": [f"ACTION{i}" for i in ids], "available_action_ids": ids,
            "selected_wave": self.selected_wave, "step_index": self.step_index,
            "translations": self.translations, "film_moves": self.film_moves,
            "film_position": self.film_position, "readings": self._readings(),
            "test_mode": self.test_mode, "event": self._event,
            "last_action": self.last_action, "full_reset": False,
            "source_path": str(self.levels_dir), "level_name": self._level["title"],
            **extra,
        }
        if timeline:
            response["frame_durations_ms"] = [100 if q["kind"].startswith("success") else 55
                                              for q in timeline]
        return response

    def jump_to_level(self, number: int) -> dict[str, Any]:
        """Author/UI preview only; not an available action for the evaluated agent."""
        _integer(number, "level", 1, LEVEL_COUNT)
        self.test_mode = True
        self._completed = [False] * LEVEL_COUNT
        self.step_index = 0
        self.last_action = "PREVIEW"
        self._setup(number - 1)
        return self._response("preview")

    def selection_point(self, index: int) -> dict[str, int]:
        _integer(index, "wave index", 0, len(self._level["waves"]) - 1)
        r = self._selector_rect(index)
        return {"x": r["x"] + 2, "y": r["y"] + 2}

    def metadata(self) -> list[dict[str, Any]]:
        return [{"number": l["number"], "title": l["title"],
                 "waves": len(l["waves"]), "detectors": len(l["detectors"]),
                 "mode": "manual_film"} for l in self._templates]

    def view(self) -> dict[str, Any]:
        """Optional human-viewer information; never contains a witness or solver."""
        level, offsets = self._level, self._effective()
        return {
            "level": self._index + 1, "title": level["title"],
            "subtitle": level.get("subtitle", ""), "mode": "manual_film", "max_height": 5,
            "selected": self.selected_wave, "offsets": offsets,
            "individual_offsets": self._individual[:], "shifts": self._shifts[:],
            "film_position": self.film_position, "film_period": film_period(level),
            "film_moves": self.film_moves, "moves": self.translations,
            "state": self.state, "test_mode": self.test_mode,
            "completed": self._completed[:], "readings": sample(level, offsets),
            "waves": [{**copy.deepcopy(w), "offset": offsets[i],
                       "individual_offset": self._individual[i], "shift": self._shifts[i],
                       "speed": SPEEDS[w["color"]], "period": len(w["pattern"]),
                       "lane": self._lane_rect(i), "selector": self._selector_rect(i)}
                      for i, w in enumerate(level["waves"])],
            "detectors": copy.deepcopy(level["detectors"]), "buttons": copy.deepcopy(BUTTONS),
        }

    # Aliases for existing custom runners and web authoring helpers.
    step = action
    observe = public_state
    levelReset = level_reset
    jumpToLevel = jump_to_level
    selectionPoint = selection_point


__all__ = ["WaveAlignmentEngine", "GAME_ID", "FAMILY", "WAVE", "WEB_VERSION", "SIZE",
           "FRAME", "BASE", "MAX_HEIGHT", "LEVEL_COUNT", "LEVELS_DIR", "PALETTE", "SPEEDS",
           "BUTTONS", "FILM", "WIN_BLINKS", "WIN_ON_FRAMES", "WIN_OFF_FRAMES", "WIN_FPS",
           "ACTION_LEFT", "ACTION_RIGHT", "ACTION_CLICK", "ACTION_RESET", "ANIM_FPS",
           "wave_height", "sample", "film_period", "validate"]
