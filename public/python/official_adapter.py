"""Local browser adapter for the 25 pinned, unmodified ARC Prize game engines.

No SDK, API key, network client, or scoring service is needed at runtime. The
matching source bundle is extracted next to this module by the Web Worker.

Undo snapshots use a deterministic command log. Some native engines contain
closures that Python's default deepcopy cannot rebind correctly; replaying a
snapshot also keeps those callbacks attached to their own restored engine.
"""
from __future__ import annotations

from copy import deepcopy
from importlib.util import module_from_spec, spec_from_file_location
import json
from pathlib import Path
import random
import sys
from typing import Any, Callable

import numpy as np
from arcengine import ActionInput, ARCBaseGame, GameAction, GameState


_ROOT = Path(__file__).resolve().parent / "official_games"
_MANIFEST = json.loads((_ROOT / "manifest.json").read_text())
OFFICIAL_GAMES = {item["code"]: item for item in _MANIFEST["games"]}

PALETTE = [
    "#FFFFFF", "#CCCCCC", "#999999", "#666666", "#333333", "#000000",
    "#E53AA3", "#FF7BCC", "#F93C31", "#1E93FF", "#88D8F1", "#FFDC00",
    "#FF851B", "#921231", "#4FCC30", "#A356D6",
]


def _game_class(code: str) -> type[ARCBaseGame]:
    entry = OFFICIAL_GAMES[code]
    module_name = "sra_official_" + entry["game_id"].replace("-", "_")
    module = sys.modules.get(module_name)
    if module is None:
        spec = spec_from_file_location(module_name, _ROOT / entry["source_file"])
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load the bundled engine for {code}")
        module = module_from_spec(spec)
        sys.modules[module_name] = module
        try:
            spec.loader.exec_module(module)
        except Exception:
            sys.modules.pop(module_name, None)
            raise
    game_class = getattr(module, entry["class_name"])
    if not issubclass(game_class, ARCBaseGame):
        raise TypeError(f"Invalid ARC engine class for {code}")
    return game_class


def _restore_official(code: str, seed: int, commands: list[tuple]) -> OfficialAdapter:
    restored = OfficialAdapter(code, seed=seed)
    for command in commands:
        if command[0] == "action":
            restored.action(command[1], command[2])
        elif command[0] == "reset_level":
            restored.reset_level()
        elif command[0] == "select_level":
            restored.select_level(command[1])
        else:
            raise ValueError(f"Unknown official snapshot command: {command[0]}")
    return restored


class OfficialAdapter:
    """An exact official engine, with JSON observations and safe Undo snapshots.

    Levels are one-based in this public adapter. Native action IDs are unchanged:
    1..4 directions, 5 primary action, 6 pixel click, and 7 where the game provides
    it. The browser's Undo command uses a snapshot and does not send action 7.
    """

    def __init__(self, code: str, seed: int = 0):
        self.code = str(code).split("-", 1)[0].upper()
        if self.code not in OFFICIAL_GAMES:
            raise ValueError(f"Unknown official game: {code}")
        self.seed = int(seed) % (2**32)
        self.game_id = OFFICIAL_GAMES[self.code]["game_id"]
        self.level_count = int(OFFICIAL_GAMES[self.code]["level_count"])
        self.default_fps = int(OFFICIAL_GAMES[self.code]["default_fps"])
        self._initialize()

    def _with_rng(self, operation: Callable[[], Any]) -> Any:
        # LF52 uses NumPy's legacy global RNG; prevent game switches, observations,
        # and Undo from changing another engine's random sequence.
        previous_random = random.getstate()
        previous_numpy = np.random.get_state()
        random.setstate(self._random_state)
        np.random.set_state(self._numpy_state)
        try:
            return operation()
        finally:
            self._random_state = random.getstate()
            self._numpy_state = np.random.get_state()
            random.setstate(previous_random)
            np.random.set_state(previous_numpy)

    def _initialize(self) -> None:
        self._random_state = random.Random(self.seed).getstate()
        self._numpy_state = np.random.RandomState(self.seed).get_state()
        self._commands: list[tuple] = []
        self._last_state: dict[str, Any] = {}

        def initialize():
            self._game = _game_class(self.code)()
            self._game._seed = self.seed
            if len(self._game._levels) != self.level_count:
                raise ValueError(f"Level count disagrees with the source manifest for {self.code}")
            return self._game.perform_action(ActionInput(id=GameAction.RESET), raw=True)

        self._capture(self._with_rng(initialize))

    def _capture(self, observation: Any) -> dict[str, Any]:
        frames = [np.asarray(frame, dtype=np.int8).tolist() for frame in observation.frame]
        if not frames:
            # Native terminal actions may return no frame. Keep the last public
            # image; a new camera.render() can consume an animation frame.
            frames = [self._last_state["frame"]]
        frame = frames[-1]
        if len(frame) != 64 or any(len(row) != 64 for row in frame):
            raise ValueError(f"{self.code} returned an invalid public frame size")
        game = self._game
        self._last_state = {
            "game_id": self.game_id,
            "frame": frame,
            "frames": frames,
            "frame_count": len(frames),
            "default_fps": self.default_fps,
            "state": game._state.value,
            "level": game.level_index + 1,
            "levels": self.level_count,
            "levels_completed": int(game._score),
            "win_levels": self.level_count,
            "step_index": int(game._action_count),
            "available_action_ids": [int(a) for a in game._available_actions],
            "palette": PALETTE.copy(),
            "full_reset": bool(getattr(observation, "full_reset", False)),
        }
        return self.public_state()

    def public_state(self) -> dict[str, Any]:
        """Return the last completed observation without advancing native rendering."""
        return deepcopy(self._last_state)

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        action_id = int(action_id)
        if action_id == 0:
            return self.reset_level()
        if action_id not in self._game._available_actions:
            raise ValueError(f"Action {action_id} is unavailable for {self.code}")
        action = GameAction.from_id(action_id)
        payload = dict(data or {})
        if action_id == 6:
            if any(isinstance(payload.get(k), bool) or not isinstance(payload.get(k), int)
                   or not 0 <= payload[k] <= 63 for k in ("x", "y")):
                raise ValueError("A click needs integer x and y coordinates from 0 to 63")
            payload = {"x": payload["x"], "y": payload["y"]}
        else:
            payload = {}
        observation = self._with_rng(
            lambda: self._game.perform_action(ActionInput(id=action, data=payload), raw=True)
        )
        self._commands.append(("action", action_id, payload))
        return self._capture(observation)

    def reset_level(self) -> dict[str, Any]:
        """Run the engine's native RESET branch on the current level, even at move 0."""
        game = self._game
        # ARCEngine normally interprets a second RESET at move zero as a full
        # game reset. This dedicated UI command explicitly means current level.
        game._action_count = 1
        game._state = GameState.NOT_FINISHED
        game._score = game.level_index
        game._next_level = False
        observation = self._with_rng(
            lambda: game.perform_action(ActionInput(id=GameAction.RESET), raw=True)
        )
        self._commands.append(("reset_level",))
        return self._capture(observation)

    def level_reset(self) -> dict[str, Any]:
        return self.reset_level()

    def reset(self) -> dict[str, Any]:
        """Start this game again from level one with the same seed."""
        self._initialize()
        return self.public_state()

    def select_level(self, level: int) -> dict[str, Any]:
        """Start an authored level for manual play (one-based, not benchmark scoring)."""
        level = int(level)
        if not 1 <= level <= self.level_count:
            raise ValueError(f"Level must be between 1 and {self.level_count}")
        self._initialize()
        if level == 1:
            return self.public_state()

        def select():
            self._game.set_level(level - 1)
            self._game._score = level - 1
            self._game._state = GameState.NOT_FINISHED
            self._game._action_count = 1
            self._game._next_level = False
            return self._game.perform_action(ActionInput(id=GameAction.RESET), raw=True)

        observation = self._with_rng(select)
        self._commands = [("select_level", level)]
        return self._capture(observation)

    def jump_to_level(self, level: int) -> dict[str, Any]:
        return self.select_level(level)

    def __reduce__(self):
        # Serializing only the recipe makes each history entry small and avoids
        # broken closure references or duplicated static sprite/level templates.
        return (_restore_official, (self.code, self.seed, self._commands))


OfficialEngine = OfficialAdapter


def create_official(code: str, seed: int = 0) -> OfficialAdapter:
    return OfficialAdapter(code, seed=seed)
