#!/usr/bin/env python3
"""Fresh unchanged-Python oracle over independently constructed geometric inputs.

No game raster, retained game trace, game host, solution or learned-state seed
is read. This executes the pinned component's real public acquisition chain.
The native grounded-inquiry hook has no original counterpart and is excluded
from source-parity claims; the original proposals, guards and state are exact.
"""
from __future__ import annotations

from collections import Counter
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import platform
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = ROOT / "reference/v6" / COMMIT / "source"
MANIFEST_PATH = SOURCE.parent / "manifest.json"
MANIFEST = json.loads(MANIFEST_PATH.read_text())["files"]
sys.dont_write_bytecode = True


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_sources():
    for name, record in MANIFEST.items():
        assert sha(SOURCE / name) == record["sha256"], name


verify_sources()
sys.path[:0] = [str(SOURCE), str(SOURCE / "agents/yf_arc3_v6/laya_proto")]
from neutral_observer import measure
from agents.yf_arc3_v6.morphology_policy.ranked_workshop.family import RankedWorkshop


def plain(value):
    if hasattr(value, "model_dump"):
        return plain(value.model_dump())
    if hasattr(value, "items"):
        return {str(key): plain(child) for key, child in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)):
        return [plain(child) for child in sorted(value)]
    if isinstance(value, SimpleNamespace):
        return plain(vars(value))
    return value


def synthetic_rows(held):
    """Two three-rank profiles, two cut receivers and one corner quartet.

    These literal dimensions and placements are constructed here from the
    geometric contracts, independently of the TypeScript helper and any game.
    """
    rows = [[0 for _ in range(44)] for _ in range(40)]
    for stem in (10, 27):
        for column in range(5, 12):
            rows[stem][column] = 4
        for index, height in enumerate((1, 3, 2)):
            for offset in range(1, height + 1):
                rows[stem - offset][5 + 3 * index] = 4
    for top, left, side in ((5, 3, "tl"), (5, 12, "tr"), (11, 3, "bl"), (11, 12, "br")):
        row = 0 if side[0] == "t" else 1
        column = 0 if side[1] == "l" else 1
        for offset in range(2):
            rows[top + row][left + offset] = 2
            rows[top + offset][left + column] = 2
    if held:
        rows[8][6] = 2
    for top in (4, 21):
        bottom, left, right, reference = top + 10, 30, 38, top + 3
        for column in range(left, right + 1):
            rows[top][column] = rows[bottom][column] = 7
        for row in range(top, bottom + 1):
            rows[row][left] = rows[row][right] = 7
        for index, offset in enumerate((1, 3, 2)):
            column, seam = 31 + 3 * index, reference + offset
            for row in range(top + 1, bottom):
                rows[row][column] = 8 if row < seam else 6 if row == seam else 9
        for column in (29, 32, 35, 39):
            rows[reference][column] = 5
    return rows


EXECUTED = Counter()
SOURCE_PREFIX = str(SOURCE) + "/"


def source_profile(frame, event, _argument):
    if event == "call" and frame.f_code.co_filename.startswith(SOURCE_PREFIX):
        EXECUTED[(frame.f_code.co_filename[len(SOURCE_PREFIX):], frame.f_code.co_firstlineno, frame.f_code.co_qualname)] += 1


sys.setprofile(source_profile)
FRAMES = {}
for name, held, revision, epoch in (
    ("free", False, 1, 1), ("held", True, 2, 1),
    ("held_no_effect", True, 3, 1), ("returned", False, 3, 1),
    ("next_epoch", False, 4, 2), ("failed_revalidation", False, 5, 2),
):
    rows = synthetic_rows(held)
    packet = {
        "frame_rows": rows, "frame_packet": [rows],
        "frame_hash": hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16],
        "level": epoch, "levels_completed": epoch - 1, "state": "NOT_FINISHED", "step_index": revision - 1,
        "available_action_refs": ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5"],
    }
    FRAMES[name] = {"held": held, "revision": revision, "epoch": epoch, "public": packet,
                    "observation": plain(measure(SimpleNamespace(**packet), revision, "workshop:independent-contract")[0])}

BLUEPRINTS = [
    {"id": "cold_current_continuation", "steps": [
        {"operation": "propose", "frame": "free"},
        {"operation": "record", "before": "free", "after": "held", "command": {"action_ref": "ACTION5"}, "selected": False},
        {"operation": "propose", "frame": "held"},
        {"operation": "bind"},
        {"operation": "before", "frame": "held"},
        {"operation": "before", "frame": "held", "available": []},
        {"operation": "after", "before": "held", "after": "held_no_effect"},
        {"operation": "restore"},
        {"operation": "propose", "frame": "held"},
        {"operation": "record", "before": "held", "after": "held_no_effect", "selected": True},
        {"operation": "restore"},
        {"operation": "propose", "frame": "held_no_effect"},
    ]},
    {"id": "portable_both_contrasts_and_new_scope_refutation", "steps": [
        {"operation": "record", "before": "free", "after": "held", "command": {"action_ref": "ACTION5"}, "selected": False},
        {"operation": "record", "before": "held", "after": "returned", "command": {"action_ref": "ACTION5"}, "selected": False},
        {"operation": "record", "before": "returned", "after": "next_epoch", "command": {"action_ref": "ACTION5"}, "selected": False},
        {"operation": "restore"},
        {"operation": "propose", "frame": "next_epoch"},
        {"operation": "bind"},
        {"operation": "before", "frame": "next_epoch"},
        {"operation": "before", "frame": "failed_revalidation"},
        {"operation": "after", "before": "next_epoch", "after": "failed_revalidation"},
        {"operation": "record", "before": "next_epoch", "after": "failed_revalidation", "selected": True},
        {"operation": "restore"},
        {"operation": "propose", "frame": "failed_revalidation"},
    ]},
]

SCENARIOS = []
for blueprint in BLUEPRINTS:
    owner, proposal = RankedWorkshop(), None
    scenario = {"id": blueprint["id"], "coldState": plain(owner.state()), "steps": []}
    for specification in blueprint["steps"]:
        step = deepcopy(specification)
        operation = step["operation"]
        if operation == "propose":
            frame = FRAMES[step["frame"]]
            result = proposal = owner.propose(deepcopy(frame["observation"]), deepcopy(frame["public"]["frame_rows"]), [], 16)
        elif operation == "record":
            before, after = FRAMES[step["before"]], FRAMES[step["after"]]
            command = deepcopy(proposal["actions"][0] if step["selected"] else step["command"])
            result = owner.record(deepcopy(before["observation"]), deepcopy(after["observation"]), command,
                                  deepcopy(before["public"]["frame_rows"]), deepcopy(after["public"]["frame_rows"]),
                                  deepcopy(proposal) if step["selected"] else None, 0)
        elif operation == "bind":
            result = owner.bind(deepcopy(proposal), None)
        elif operation == "before":
            frame = FRAMES[step["frame"]]
            public = deepcopy(frame["public"])
            if "available" in step:
                public["available_action_refs"] = step["available"]
            result = owner.before(deepcopy(proposal), 0, SimpleNamespace(**public), deepcopy(frame["observation"]))
        elif operation == "after":
            before, after = FRAMES[step["before"]], FRAMES[step["after"]]
            result = owner.after(deepcopy(proposal), 0, deepcopy(before["observation"]), deepcopy(after["observation"]),
                                 deepcopy(before["public"]["frame_rows"]), deepcopy(after["public"]["frame_rows"]))
        elif operation == "restore":
            result = owner.restore(json.loads(json.dumps(owner.state())))
        else:
            raise AssertionError(operation)
        step.update(result=plain(result), afterState=plain(owner.state()))
        scenario["steps"].append(step)
    SCENARIOS.append(scenario)

assert SCENARIOS[0]["steps"][2]["result"]["actions"] == [{"action_ref": "ACTION4"}]
assert SCENARIOS[0]["steps"][-1]["result"] is None
assert SCENARIOS[1]["steps"][4]["result"]["workshop_plan"]["extension"]["kind"] == "revalidate_mode"
assert SCENARIOS[1]["steps"][-1]["result"] is None
sys.setprofile(None)
verify_sources()
paths = {Path(module.__file__).resolve() for module in list(sys.modules.values())
         if getattr(module, "__file__", None) and Path(module.__file__).resolve().is_relative_to(SOURCE)}
paths.update((SOURCE / "agents/yf_arc3_v6/morphology_policy/ranked_workshop").glob("*.drm"))
paths.update((SOURCE / "agents/yf_arc3_v6/morphology_policy/ranked_workshop").glob("*.src"))
payload = {
    "schema": "logos-engine.v6.workshop-followup-synthetic-reference.v1",
    "referenceCommit": COMMIT, "sourceManifestSha256": sha(MANIFEST_PATH), "sourceModified": False,
    "sourceFilesVerifiedBeforeAndAfter": len(MANIFEST),
    "qualification": "Independent synthetic geometry only. No game raster, trace, dispatch, live priming or solved-level claim. Exact original component values; the native coordination extension is outside original caller parity.",
    "inputOrigin": {"kind": "independently_constructed_geometry", "shape": [40, 44], "gameFilesRead": 0, "actionsDispatched": 0},
    "generator": {"path": Path(__file__).relative_to(ROOT).as_posix(), "sha256": sha(Path(__file__)),
                  "command": "python -B scripts/export-v6-workshop-followup-synthetic-reference.py", "pythonVersion": platform.python_version()},
    "sourceHashes": {path.relative_to(SOURCE).as_posix(): sha(path) for path in sorted(paths)},
    "executedSourceFunctions": [{"path": path, "line": line, "function": name, "calls": calls}
                                for (path, line, name), calls in sorted(EXECUTED.items())],
    "frames": FRAMES, "scenarios": SCENARIOS,
}
output = ROOT / "tests/fixtures/v6-workshop-followup-synthetic-reference.json"
output.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n")
print(json.dumps({"path": output.relative_to(ROOT).as_posix(), "referenceCommit": COMMIT,
                  "scenarios": len(SCENARIOS), "steps": sum(len(row["steps"]) for row in SCENARIOS),
                  "sourceFilesVerifiedBeforeAndAfter": len(MANIFEST), "bytes": output.stat().st_size, "sha256": sha(output)}))
