"""Trace the WEAV controller selection, first step and exact crossing evidence."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "fab19fba7cc5e5ac5cd79da53c81fb3ab23b492a" and r["prefixes"] == 6
native = r["native"]
nominal = native["nominal"]["steps"]
assert len(nominal) == 16 and native["nominal"]["stop"] == "session_action_budget"
assert all(row["after"]["levels"] == 0 for row in nominal)
t1, t2, t3, t4, t5, t6, t7 = nominal[:7]
assert t1["pre"]["command"] == ["ACTION6", {"x": 15, "y": 20}]
assert t1["after"]["reason"] == "selection_is_hypothesis_until_advance"
assert t1["after"]["record"]["events"] == [] and t1["after"]["matched"] is None
step, = t2["after"]["record"]["events"]
assert step == {"kind": "crossed_prefix_input", "axis": 0, "action": "ACTION1", "evidence": t2["after"]["ref"], "epoch": 1}
assert t2["after"]["matched"] is True and t2["after"]["record"]["slot"]["changed"] is True
assert t4["after"]["matched"] is False and t4["after"]["record"]["state"]["blocked"]
pair = t5["after"]["record"]["events"][1]
assert pair["kind"] == "crossed_prefix_pair" and pair["inputs"] == {"0": "ACTION1", "1": "ACTION3"}
assert pair["evidence"] == [t5["pre"]["ref"], t5["after"]["ref"]]
assert t7["pre"]["plan"]["intent"]["predicted_pair"] == pair
assert set(pair["evidence"]).issubset(t7["pre"]["refs"])
assert t7["after"]["matched"] is True
same = native["sans-paire"]
assert same["steps"] == nominal[:6]
assert same["next"]["cut"]["pre"] == {**t7["pre"]["cut"]["pre"], "pairs": []}
assert same["next"]["family"] == "information_goal" and same["next"]["command"] == ["ACTION6", {"x": 28, "y": 61}]
assert t7["pre"]["scope"]["live"]["admitted"] is True
assert t7["pre"]["scope"]["contraryAtMatchingDigest"] == {"admitted": False, "reason": "crossed_prefix_context_changed"}
assert t7["pre"]["scope"]["contraryReturn"]["reason"] == "reference_changed_unexpectedly"
assert t7["pre"]["scope"]["contraryReturn"]["seal_prefix"] is True

print(json.dumps({
    "versions": r["versions"], "prefixes": r["prefixes"], "firstAcquisition": step, "crossingPair": pair,
    "sameT7Premises": same["next"]["cut"]["pre"]["ref"],
    "T7": [t7["pre"]["command"], same["next"]["command"]],
    "wrongReferenceAtMatchingDigest": t7["pre"]["scope"]["contraryAtMatchingDigest"],
}, indent=2))
