#!/usr/bin/env python3
"""Check all authored custom level entries and their native retry boundaries.

Uses the source ZIP shipped to the browser, without changing its engines.
This validates manual navigation, not SRA or puzzle-solving coverage.
"""
from __future__ import annotations

import json
from pathlib import Path
import pickle
import shutil
import sys
import tempfile
import zipfile


def check_observation(raw: dict, level: int) -> None:
    actual = int(raw.get("level", int(raw.get("levels_completed", 0)) + 1))
    assert actual == level, (actual, level)
    assert raw["state"] == "NOT_FINISHED", raw["state"]
    frame = raw["frame"]
    assert len(frame) == 64 and all(len(row) == 64 for row in frame)


def run_checks() -> dict:
    from custom_games.registry import CUSTOM_GAMES, build_seeded_engine
    from custom_level_navigation import can_select_level, select_level

    checked = 0
    failures = []
    for info in CUSTOM_GAMES:
        for level in range(1, info.levels + 1):
            label = f"{info.game_id}:L{level}"
            try:
                engine = build_seeded_engine(info.game_id, instance_seed=0)
                assert can_select_level(engine), "level selection not advertised"
                check_observation(select_level(engine, level), level)
                # Selection must survive exactly the serialization mechanism
                # used by custom-game Undo (including the practice campaign).
                engine = pickle.loads(pickle.dumps(engine, protocol=5))
                check_observation(engine.public_state(), level)
                retry = getattr(engine, "level_reset", None)
                raw = retry() if callable(retry) else engine.action(7)
                check_observation(raw, level)
                checked += 1
            except Exception as error:
                failures.append({"level": label, "error": repr(error)})

    # Authored cross-level physical prerequisites must be present at direct
    # entry and retained by native retry; otherwise these starts are softlocks.
    by_family = {info.engine: info for info in CUSTOM_GAMES}
    for level, expected in ((2, "episode"), (6, "ring")):
        engine = build_seeded_engine(by_family["key_doors"].game_id, instance_seed=0)
        select_level(engine, level)
        assert len(engine._inventory) == 1
        key = engine._inventory[0]
        assert key.type_id == (engine._episode_variant if expected == "episode" else expected)
        assert key.reusable is (level == 6)
        assert engine._level_entry_inventory == engine._inventory
        engine.level_reset()
        assert engine._level_entry_inventory == engine._inventory

    fog = build_seeded_engine(by_family["fog_hidden_motion"].game_id, instance_seed=0)
    select_level(fog, 2)
    assert fog._episode_memory_ready

    for level in (2, 6):
        portal = build_seeded_engine(by_family["portal_topology"].game_id, instance_seed=0)
        select_level(portal, level)
        assert portal._episode_memory_ready and len(portal._learned_pairs) == 2
        assert not portal._seen_portals  # Current-level traversal is still required.
        portal.level_reset()
        assert portal._episode_memory_ready and len(portal._learned_pairs) == 2

    # Complete an actual selected Sequence Lab level with its authored answer
    # fixture through ordinary player actions. Its locked-campaign gate must
    # advance from L2 to L3; direct final-level completion must become WIN.
    for start in (2, by_family["sequence_lab"].levels):
        engine = build_seeded_engine(by_family["sequence_lab"].game_id, instance_seed=0)
        select_level(engine, start)
        engine = pickle.loads(pickle.dumps(engine, protocol=5))
        for _ in range(100):
            raw = engine.public_state()
            if raw["level"] != start or raw["state"] == "WIN":
                break
            campaign = engine.campaign
            row = campaign.current["active"]
            answer = campaign.level["questions"][row]["answer"]
            while campaign.current["focus"] != answer:
                engine.action(4)
            engine.action(5)
        else:
            raise AssertionError("Sequence Lab did not advance after valid answers")
        if start == engine.win_levels:
            assert raw["state"] == "WIN"
        else:
            assert raw["level"] == start + 1 and raw["state"] == "NOT_FINISHED"
        engine.level_reset()
        assert engine.public_state()["level"] == min(start + 1, engine.win_levels)

    return {"customGames": len(CUSTOM_GAMES), "levelEntriesChecked": checked,
            "pickleAndRetryChecks": checked, "prerequisiteChecks": "passed",
            "sequenceNaturalProgression": "passed", "failures": failures}


def main() -> None:
    assets = Path(__file__).resolve().parents[1] / "public" / "python"
    with tempfile.TemporaryDirectory(prefix="sra-level-navigation-") as directory:
        root = Path(directory)
        with zipfile.ZipFile(assets / "custom-games.zip") as archive:
            archive.extractall(root)
        shutil.copy(assets / "custom_level_navigation.py", root)
        sys.path.insert(0, str(root))
        report = run_checks()
        print(json.dumps(report, indent=2))
        if report["failures"]:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
