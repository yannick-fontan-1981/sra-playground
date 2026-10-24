"""Manual level entry for the pinned custom engines shipped with Playground.

This module is a browser host adapter, not an ARC action or a solver. Call it
on a freshly constructed seeded engine. Each fallback below was matched to the
authored engine's own level initializer; no upstream game source is modified.
Some old engines use their completion counter as the level cursor. Its offset
here is navigation state and must not be treated as earned benchmark progress.
"""
from __future__ import annotations

from copy import deepcopy
import importlib
from typing import Any

from custom_games.engines.sequence_lab import Campaign, is_complete


# These engines explicitly select the current template through
# min(levels_completed, win_levels - 1) in their native level_reset().
_COUNTER_RESET = frozenset({
    "always_sliding", "cascade_quiesce", "color_glass", "columns_match",
    "connect_four", "craft_console", "denoise_trame", "escort_patrol",
    "etag_floors", "fite_arena", "flee_stones", "gare_cadence", "globe_track",
    "gori_ballistics", "hanoi", "hole_palette", "katamino",
    "logic_circuit", "memo_recall", "mind_code",
    "reign_gauges", "seqn_groups", "signal_seal", "sokoban", "stack_iso",
    "switch_rooms", "symmetry_fix", "tic_tac_toe", "transport_gabarit",
})
_LOCAL_TEMPLATE = frozenset({
    "cabbage_goat_wolf", "graved_map", "tower_equilibrium", "weave",
})
_INDEX_RESET = frozenset({"combina", "iso_sketch", "rewind", "selene"})
_NATIVE_LOAD = frozenset({"elastic_grid", "triade"})
_START_LEVEL_RESET = frozenset({"neighbor_cubes", "polarity"})
_NEW_LEVEL_STATE = frozenset({"dichotomy", "grillage"})
_SPECIAL = frozenset({
    "fog_hidden_motion", "gravity_box", "key_doors", "life_lineage", "lock_and_key",
    "ls19_legacy", "portal_topology", "sequence_lab", "valve_flow",
})
_SUPPORTED = (_COUNTER_RESET | _LOCAL_TEMPLATE | _INDEX_RESET | _NATIVE_LOAD
              | _START_LEVEL_RESET | _NEW_LEVEL_STATE | _SPECIAL)


class _PracticeSequenceCampaign(Campaign):
    """Allow the selected suffix of Sequence Lab's campaign to be played.

    The stock campaign rejects any level beyond its first incomplete level.
    Keep its exact states/transitions and introduce only a starting boundary;
    do not manufacture solved states for skipped puzzles. The native engine
    uses completed to recognize its terminal level, so the boundary contributes
    an offset to that counter. The top-level class remains pickle-safe for Undo.
    """

    def __init__(self, levels: list, first_index: int) -> None:
        super().__init__(levels)
        self._practice_first_index = first_index
        self.index = first_index

    @property
    def completed(self) -> int:
        first = self._practice_first_index
        return first + sum(is_complete(state) for state in self.states[first:])

    @property
    def unlocked(self) -> int:
        return next((index for index in range(self._practice_first_index, len(self.states))
                     if not is_complete(self.states[index])), len(self.states) - 1)


def _family(engine: Any) -> str:
    module = engine.__class__.__module__
    prefix = "custom_games.engines."
    return module[len(prefix):] if module.startswith(prefix) else ""


def can_select_level(engine: Any) -> bool:
    return callable(getattr(engine, "jump_to_level", None)) or _family(engine) in _SUPPORTED


def _key_doors_entry(engine: Any, index: int) -> None:
    """Supply the entry inventory that the authored prior level carries over.

    L2 has no keys of its own: L1 requires retaining its episode key on exit.
    L6 receives L5's reusable ring key. All other entry inventories are empty.
    These are physical manual-preview prerequisites, not learned agent facts.
    """
    module = importlib.import_module(engine.__class__.__module__)
    engine.levels_completed = index
    if index == 1:
        engine._inventory = [module.HeldKey(engine._episode_variant, False)]
    elif index == 5:
        engine._inventory = [module.HeldKey("ring", True)]
    else:
        engine._inventory = []
    engine._begin_level(index)  # Also captures the correct native retry inventory.


def select_level(engine: Any, level: int) -> dict[str, Any]:
    """Enter a one-based authored level on a fresh seeded custom engine."""
    count = int(getattr(engine, "win_levels", getattr(getattr(engine, "info", None), "levels", 0)))
    if type(level) is not int or not 1 <= level <= count:
        raise ValueError(f"Level must be between 1 and {count}")
    if not can_select_level(engine):
        raise ValueError("No audited manual level entry exists for this engine")
    if level == 1:
        return engine.public_state()
    native = getattr(engine, "jump_to_level", None)
    if callable(native):
        return native(level)

    family = _family(engine)
    index = level - 1
    if family in _NATIVE_LOAD:
        return engine.load_level(level)
    if family == "gravity_box":
        return engine.select_level(level)
    if family in _START_LEVEL_RESET:
        return engine.reset(start_level=level)
    if family in _COUNTER_RESET:
        engine.levels_completed = index
        engine.level_reset()
    elif family in _NEW_LEVEL_STATE:
        engine.levels_completed = index
        engine._level = engine._new_level_state(index)
    elif family in _LOCAL_TEMPLATE:
        engine._index = index
        engine.levels_completed = index
        engine.level = deepcopy(engine._templates[index])
        engine.level_reset()  # Native create_state and per-game retry resources.
    elif family in _INDEX_RESET:
        engine.level_index = index
        if family != "combina":
            engine.levels_completed = index
        engine.level_reset()
    elif family == "fog_hidden_motion":
        engine.levels_completed = index
        engine._episode_memory_ready = any(
            item.get("writes_episode_memory", False) for item in engine._templates[:index]
        )
        engine._begin_level(index)
    elif family in {"life_lineage", "valve_flow"}:
        engine.levels_completed = index
        engine._episode_memory_ready = index > 0
        engine._begin_level(index)
    elif family == "portal_topology":
        # L1 traverses the episode's two portal pairs before opening L2. L2
        # and L6 require that retained entry flag even after every local goal
        # is satisfied. Restore only this authored cross-level prerequisite;
        # _begin_level still clears the new level's own required_seen set.
        module = importlib.import_module(engine.__class__.__module__)
        engine.levels_completed = index
        engine._learned_pairs = {
            frozenset(pair) for pair in module.EPISODE_PAIR_VARIANTS[engine._episode_variant]
        }
        engine._episode_memory_ready = True
        engine._begin_level(index)
    elif family == "key_doors":
        _key_doors_entry(engine, index)
    elif family == "lock_and_key":
        module = importlib.import_module(engine.__class__.__module__)
        engine.levels_completed = index
        engine.level = deepcopy(engine.levels[index])
        engine.local = module.create_state(engine.level)
    elif family == "ls19_legacy":
        # Legacy's native loader restores every per-level physical resource.
        engine._engine._load_level(index)
        engine._observation = engine._engine.observe()
        engine._full_reset = False
    elif family == "sequence_lab":
        engine.campaign = _PracticeSequenceCampaign(engine._templates, index)
    else:
        raise ValueError(f"Unsupported manual level-entry adapter: {family}")

    # Selecting a level is a host operation, not a player action. Native retry
    # helpers sometimes increment this diagnostic counter; remove only that
    # navigation cost and regenerate the public observation from native state.
    engine.step_index = 0
    return engine.public_state()
