"""Shared CPython/Pyodide checks for the exact official browser game engines.

The JavaScript runner installs this beside the same adapter and source archive
in both interpreters, then compares every frame digest and public state.
"""
from copy import deepcopy
import hashlib
import json
import pickle
import random
import sys

import numpy as np


def _observation_record(label, state):
    frames = np.asarray(state["frames"], dtype=np.int8)
    assert frames.ndim == 3 and tuple(frames.shape[1:]) == (64, 64), (label, frames.shape)
    assert int(frames.min()) >= 0 and int(frames.max()) <= 15, label
    assert state["frame"] == state["frames"][-1], label
    assert state["state"] in ("NOT_FINISHED", "GAME_OVER", "WIN"), label
    return {
        "label": label,
        "game_id": state["game_id"],
        "frame_sha256": hashlib.sha256(np.asarray(state["frame"], dtype=np.int8).tobytes()).hexdigest(),
        "animation_sha256": hashlib.sha256(frames.tobytes()).hexdigest(),
        "frame_count": int(frames.shape[0]),
        "state": state["state"],
        "level": state["level"],
        "levels_completed": state["levels_completed"],
        "step_index": state["step_index"],
        "available_action_ids": state["available_action_ids"],
        "default_fps": state["default_fps"],
    }


def run_official_checks():
    from official_adapter import OFFICIAL_GAMES, create_official

    records = []
    level_count = 0
    action_count = 0
    for code in OFFICIAL_GAMES:
        random_before = random.getstate()
        numpy_before = pickle.dumps(np.random.get_state())
        engine = create_official(code, seed=42)
        initial = engine.public_state()
        initial_record = _observation_record(code + ":initial", initial)
        records.append(initial_record)
        # Observing cannot advance native rendering or consume queued frames.
        assert engine.public_state() == initial, code
        assert engine.public_state() == initial, code
        assert random.getstate() == random_before, code
        assert pickle.dumps(np.random.get_state()) == numpy_before, code

        snapshot = pickle.dumps(engine, protocol=5)
        for aid in initial["available_action_ids"]:
            action_count += 1
            engine = pickle.loads(snapshot)
            data = {"x": 32, "y": 32} if aid == 6 else {}
            label = f"{code}:action{aid}"
            observed = engine.action(aid, data)
            records.append(_observation_record(label, observed))
            restored = pickle.loads(pickle.dumps(engine, protocol=5))
            cloned = deepcopy(engine)
            assert _observation_record(label, restored.public_state()) == records[-1], label
            assert _observation_record(label, cloned.public_state()) == records[-1], label
            second = _observation_record(label + ":continuation", engine.action(aid, data))
            records.append(second)
            assert _observation_record(label + ":continuation", restored.action(aid, data)) == second, label
            assert _observation_record(label + ":continuation", cloned.action(aid, data)) == second, label
            reset_state = engine.reset_level()
            assert reset_state["level"] == initial["level"], label
            records.append(_observation_record(label + ":reset", reset_state))
            assert _observation_record(code + ":initial", engine.reset()) == initial_record, label

        for level in range(1, engine.level_count + 1):
            level_count += 1
            label = f"{code}:level{level}"
            state = engine.select_level(level)
            assert state["level"] == level, label
            records.append(_observation_record(label, state))
            state = engine.reset_level()
            assert state["level"] == level, label
            records.append(_observation_record(label + ":reset", state))
            aid = state["available_action_ids"][0]
            data = {"x": 32, "y": 32} if aid == 6 else {}
            state = engine.action(aid, data)
            records.append(_observation_record(label + ":action", state))
            restored = pickle.loads(pickle.dumps(engine, protocol=5))
            assert _observation_record(label + ":action", restored.public_state()) == records[-1], label
        print(f"{code}: {engine.level_count} levels, actions, resets and Undo passed", file=sys.stderr, flush=True)

    return {
        "games_checked": len(OFFICIAL_GAMES),
        "levels_checked": level_count,
        "action_ids_checked": action_count,
        "observations_checked": len(records),
        "records": records,
    }


if __name__ == "__main__":
    import argparse
    from pathlib import Path
    import shutil
    import tempfile
    import zipfile

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Write the native parity report to this JSON path")
    options = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    with tempfile.TemporaryDirectory(prefix="sra-official-native-") as directory:
        runtime = Path(directory)
        with zipfile.ZipFile(root / "public/python/official-games.zip") as archive:
            archive.extractall(runtime)
        shutil.copy2(root / "public/python/official_adapter.py", runtime / "official_adapter.py")
        sys.path.insert(0, str(runtime))
        serialized = json.dumps(run_official_checks())
        if options.output:
            options.output.write_text(serialized + "\n")
        else:
            print(serialized)
