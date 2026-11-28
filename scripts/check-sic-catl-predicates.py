"""Check CATL's classification predicates, retained examples and button binding."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "fad120b559f52767208ba2620dd48b5a5f530dff" and r["prefixes"] == 7
native = r["native"]
steps = native["nominal"]["steps"]
assert len(steps) == 16 and [row["i"] for row in steps if row["after"]["record"]["official_progress"]] == [8, 16]
t1, t2, t9 = (steps[i] for i in (0, 1, 8))


def feature(row, name):
    return dict(row["plan"]["inference"]["query"])[name]


def label(row):
    return row["plan"]["label"]


permuted1, permuted9 = (native[name]["next"] for name in ("permutation-1", "permutation-9"))
assert native["permutation-1"]["steps"] == []
assert native["permutation-9"]["steps"][7]["after"]["packet"] == steps[7]["after"]["packet"]
assert feature(t1["pre"], "COUNT:8") == feature(permuted1, "COUNT:8") == 1
assert label(t1["pre"]) == label(permuted1) == 15
assert t1["pre"]["command"] == permuted1["command"] == ["ACTION6", {"x": 43, "y": 52}]
assert feature(t9["pre"], "ENDPOINT_EQUAL") is False and feature(permuted9, "ENDPOINT_EQUAL") is True
assert feature(t9["pre"], "COUNT:8") == feature(permuted9, "COUNT:8")
assert (label(t9["pre"]), label(permuted9)) == (12, 15)
assert t9["pre"]["command"] == ["ACTION6", {"x": 56, "y": 52}] and permuted9["command"] == t1["pre"]["command"]
assert all(row["guard"]["admitted"] and row["plan"]["step"]["expected_after"] is None
           for row in (t1["pre"], t2["pre"], t9["pre"], permuted1, permuted9))

assert t2["pre"]["cut"]["pre"]["used"] == t1["after"]["record"]["cache"]
assert t2["pre"]["plan"]["inference"]["reused"] is True and t9["pre"]["plan"]["inference"]["reused"] is False
var = native["sans-controles-retenus"]["steps"][1]["pre"]
fresh = native["sans-reutilisation"]["steps"][1]["pre"]
assert var["cut"]["pre"]["used"]["controls"] == [] and var["cut"]["pre"]["examples"] is None
assert var["family"] == "observed_frontier" and var["command"] == ["ACTION6", {"x": 10, "y": 11}]
assert fresh["command"] == t2["pre"]["command"] and not fresh["plan"]["inference"]["reused"]
assert fresh["plan"]["inference"]["training"]["featuresHash"] == t2["pre"]["plan"]["inference"]["training"]["featuresHash"]
still = native["stationnaire"]
assert still["steps"][0]["after"]["packet"] == t1["after"]["packet"]
assert still["steps"][0]["after"]["record"]["physical_receipt_status"] == "unchanged_public_context"
assert still["next"]["cut"]["result"]["reason"] == "identical_labeled_submission_context_already_observed"
assert all(t["after"]["matched"] is None and t["after"]["record"]["law_uniqueness_claimed"] is False for t in steps)

print(json.dumps({
    "versions": r["versions"], "nativePrefixes": r["prefixes"], "officialBoundaries": [8, 16],
    "level1Preserved": {"feature": "COUNT:8", "ticket": permuted1["command"]},
    "level2Permutation": {"feature": "ENDPOINT_EQUAL", "before": t9["pre"]["command"], "after": permuted9["command"]},
    "buttonRevalidation": {"withdrawn": var["command"], "freshInference": fresh["command"]},
}, indent=2))
