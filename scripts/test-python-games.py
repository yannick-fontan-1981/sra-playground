#!/usr/bin/env python3
"""Smoke genuine bundled engines through the browser's JSON boundary.

Run with Python 3.12+ and numpy/pydantic/typing_extensions installed. These checks
use the source ZIPs shipped to the browser. They validate advertised actions,
exact Undo/redo, animations, Reset and source integrity. They do not solve every
puzzle or verify SRA reasoning. test-python-games.mjs reuses them in Pyodide.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import time
import zipfile


def signature(observation: dict) -> str:
    fields = ("code", "gameId", "frame", "palette", "state", "level",
              "levelCount", "levelsCompleted", "availableActionIds")
    value = {key: observation[key] for key in fields}
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def run_checks() -> dict:
    import game_bridge as bridge

    bridge._sessions.clear()
    bridge._active = None
    started = time.monotonic()
    failures = []
    passed = []
    records = []
    levels_checked = 0
    actions_checked = 0

    def record(label: str, observation: dict) -> None:
        # Every transport field participates: animation frames, durations,
        # palette, state, available actions and Undo availability.
        value = json.dumps(observation, sort_keys=True, separators=(",", ":"))
        records.append({"label": label, "sha256": hashlib.sha256(value.encode()).hexdigest()})

    def send(kind: str, **payload) -> dict:
        response = json.loads(bridge.dispatch(json.dumps({"type": kind, **payload})))
        if "error" in response:
            raise AssertionError(response["error"])
        return response

    catalog = send("catalog")["codes"]
    assert len(catalog) == 100 and len(set(catalog)) == 100
    for code in catalog:
        try:
            initial = send("load", code=code)
            assert initial["code"] == code and not initial["canUndo"]
            assert len(initial["frame"]) == 64
            record(code + ":load", initial)
            for action_id in initial["availableActionIds"]:
                data = {"x": 32, "y": 32} if action_id == 6 else None
                changed = send("action", actionId=action_id, data=data)
                assert changed["canUndo"]
                record(f"{code}:action:{action_id}", changed)
                restored = send("undo")
                assert signature(restored) == signature(initial), (code, action_id, "Undo")
                record(f"{code}:undo:{action_id}", restored)
                repeated = send("action", actionId=action_id, data=data)
                assert signature(repeated) == signature(changed), (code, action_id, "redo")
                assert repeated["frames"] == changed["frames"], (code, action_id, "animation redo")
                record(f"{code}:redo:{action_id}", repeated)
                send("undo")
                actions_checked += 1

            # Other engines retain their authored campaign progression.
            selected_levels = range(1, initial["levelCount"] + 1) if initial["canSelectLevel"] else [1]
            for level in selected_levels:
                current = send("selectLevel", level=level) if initial["canSelectLevel"] else send("observe")
                assert current["level"] == level, (code, level, "selection")
                record(f"{code}:level:{level}", current)
                reset = send("reset")
                assert reset["level"] == level, (code, level, "Reset changed level")
                assert reset["state"] == "NOT_FINISHED", (code, level, "Reset state")
                assert not reset["canUndo"]
                record(f"{code}:reset:{level}", reset)
                levels_checked += 1
            passed.append(code)
        except Exception as error:
            failures.append({"code": code, "error": str(error)})

    # Invalid input must be a JSON error and leave the active game unchanged.
    send("load", code="PIPE")
    stable = signature(send("observe"))
    for payload in ({"type": "action", "actionId": 99},
                    {"type": "action", "actionId": 6, "data": {"x": -1, "y": 32}},
                    {"type": "selectLevel", "level": 0}):
        response = json.loads(bridge.dispatch(json.dumps(payload)))
        assert "error" in response
        assert signature(send("observe")) == stable
    for _ in range(70):
        send("action", actionId=1)
    assert len(bridge._session().history) <= bridge.MAX_UNDO_STEPS
    assert len(bridge._sessions) <= bridge.MAX_SESSIONS

    return {
        "gamesPassed": len(passed), "gamesExpected": 100,
        "actionsChecked": actions_checked, "levelsChecked": levels_checked,
        "seconds": round(time.monotonic() - started, 2), "failures": failures,
        "observationsChecked": len(records), "records": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Write complete signatures for the WebAssembly comparison")
    args = parser.parse_args()
    assets = Path(__file__).resolve().parents[1] / "public" / "python"
    manifest = json.loads((assets / "custom-manifest.json").read_text())
    with zipfile.ZipFile(assets / "custom-games.zip") as archive:
        for item in manifest["files"]:
            data = archive.read(item.get("archive_path", item["path"]))
            assert hashlib.sha256(data).hexdigest() == item["sha256"], item["path"]
            assert hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest() == item["git_blob_sha"], item["path"]

    with tempfile.TemporaryDirectory(prefix="sra-engine-test-") as directory:
        root = Path(directory)
        for bundle in ("custom-games.zip", "official-games.zip"):
            with zipfile.ZipFile(assets / bundle) as archive:
                archive.extractall(root)
        for adapter in ("game_bridge.py", "official_adapter.py"):
            shutil.copy(assets / adapter, root / adapter)
        sys.path.insert(0, str(root))
        report = run_checks()
        report["sourceFilesVerified"] = len(manifest["files"])
    if args.output:
        args.output.write_text(json.dumps(report, indent=2))
    print(json.dumps({key: value for key, value in report.items() if key != "records"}, indent=2))
    if report["failures"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
