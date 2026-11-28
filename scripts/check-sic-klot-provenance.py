"""Verify that KLOT changes only the attributed role on two alternate physical returns."""

import argparse
import json
from pathlib import Path


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("directory", type=Path)
parser.add_argument("frozen_nominal", type=Path)
args = parser.parse_args()


def read(relative):
    return json.loads((args.directory / relative).read_bytes())


parent, corrected = (read("attribution/" + sha + ".json") for sha in ("03fba8c8", "37983796"))
assert len(parent) == len(corrected) == 2
changes = []
for turn, left, right in zip((7, 9), parent, corrected):
    assert len(left) == len(right)
    for a, b in zip(left, right):
        if a == b:
            continue
        assert a["kind"] == b["kind"] == "return" and a["turn"] == b["turn"] == turn
        old, new = a["recorded"][0], b["recorded"][0]
        assert old["role"] == "observed_exclusive_receiver" and new["role"] == "blocked_or_unselected_remains_conditional"
        assert old["moved"] and new["moved"] and old["models"] == new["models"] == 0
        assert a["matched"] is b["matched"] is False
        old["role"] = new["role"]
        assert a == b
        changes.append(turn)
assert changes == [7, 9]


def summaries(sha):
    path = args.directory / "attribution" / (sha + ".log")
    return [json.loads(line) for line in path.read_text(encoding="utf8").splitlines() if line.startswith('{"turn"')]


old, new = (summaries(sha) for sha in ("03fba8c8", "37983796"))
assert [(r["turn"], r["selected"], r["moved"]) for r in new] == [(7, "6", "11"), (9, "12", "6")]
for a, b in zip(old, new):
    assert a["next"] == b["next"] == {"kind": "stopped", "family": "selected_rigid", "next": None,
                                   "reason": "rigid_control_or_collision_model_refuted"}
    assert a["sealed"] is b["sealed"] is True
    assert a["attributed"] == "observed_exclusive_receiver" and b["attributed"] == "blocked_or_unselected_remains_conditional"

nominal = read("nominal/37983796.json")
assert nominal == json.loads(args.frozen_nominal.read_bytes())
print(json.dumps({"parent": "03fba8c8", "correction": "37983796259ab45f3366364896a72c55752e332d",
                  "firstRecordedDifferences": changes, "counterexamples": new,
                  "nominalSessionsIdentical": len(nominal)}, indent=2))
