"""Custom-game adapter for the preserved standalone LS20 Legacy engine."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from api.standalone_game_api.engine.LS20_engine import LS20Engine
from custom_games.registry import CustomGameInfo


LEGACY_SOURCE = (
    Path(__file__).resolve().parents[2]
    / "api"
    / "standalone_game_api"
    / "engine"
    / "LS20_engine.py"
)


class LS19LegacyEngine:
    """Expose the old eight-level LS20 engine through the custom-game protocol."""

    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self.win_levels = int(info.levels)
        self.step_index = 0
        self.last_action = "RESET"
        self._full_reset = True
        self._engine = LS20Engine.reset()
        self._observation = self._engine.observe()

    def reset(self) -> dict[str, Any]:
        self.step_index = 0
        self.last_action = "RESET"
        self._full_reset = True
        self._engine = LS20Engine.reset()
        self._observation = self._engine.observe()
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self.last_action = "ACTION7"
        self._full_reset = False
        self._engine.restart_level()
        self._observation = self._engine.observe()
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        del data
        aid = int(action_id)
        if aid == 7:
            return self.level_reset()
        if aid not in self._engine.available_actions:
            return self.public_state()

        self.last_action = f"ACTION{aid}"
        self._full_reset = False
        self._observation, _reward, _done, _info = self._engine.step(aid)
        self.step_index += 1
        return self.public_state()

    def public_state(self) -> dict[str, Any]:
        frames = list(self._observation.get("frame") or [])
        if not frames:
            frames = [self._engine.observe()["frame"][-1]]
        legacy_state = self._engine.state
        raw_state = str(self._observation.get("state") or "NOT_FINISHED")
        state = "GAME_OVER" if raw_state == "LOSE" else raw_state
        level_index = int(legacy_state.get("level", 0))
        completed = sum(bool(value) for value in legacy_state.get("level_completion", []))
        available_ids = [1, 2, 3, 4, 7]
        if state == "WIN":
            available_ids = [7]
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frames[-1],
            "frames": frames,
            "frame_count": len(frames),
            "default_fps": self.info.default_fps,
            "state": state,
            "level": min(level_index + 1, self.win_levels),
            "levels_completed": completed,
            "win_levels": self.win_levels,
            "step_index": self.step_index,
            "available_actions": [f"ACTION{aid}" for aid in available_ids],
            "available_action_ids": available_ids,
            "last_action": self.last_action,
            "score": int(legacy_state.get("score", completed)),
            "full_reset": self._full_reset,
            "source_path": str(LEGACY_SOURCE),
            "custom_family": self.info.family,
            "legacy_engine": "api.standalone_game_api.engine.LS20_engine.LS20Engine",
            "oxygen": int(legacy_state.get("oxygen", 0)),
            "hearts": int(legacy_state.get("hearts", 0)),
            "selected_piece": dict(legacy_state.get("selected") or {}),
        }
