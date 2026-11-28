"""Check COLM preparation, receipt acquisition, and locally refuted translation."""

import argparse
import json
from pathlib import Path


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "b8902646b6c968f78e5512f62d1d641b0bd20dd0"
assert r["prefixes"] == 6
g = r["native"]
steps = g["nominal"]["steps"]
assert len(steps) == 16 and all(s["pre"]["slot"] == "queued_field_composition" for s in steps)

first, repeat, reception = steps[:3]
preparation = first["after"]["record"]["event"]
assert preparation["last"] == "single_public_preparation"
assert preparation["controls"]["ACTION1"]["permutations"] == [[0, 2, 1], [2, 0, 1]]
assert repeat["after"]["record"]["event"]["controls"]["ACTION1"]["permutations"] == [[2, 0, 1]]
for name in ("stationnaire", "dupliquee"):
    arm = g[name]["steps"][0]
    assert arm["after"]["packet"] == first["after"]["packet"]
    assert arm["after"]["record"]["event"]["controls"] == {}

ablated = g["sans-reception"]["steps"][2]
assert ablated["pre"] == reception["pre"]
assert ablated["after"]["packet"] == reception["after"]["packet"]
full, reduced = (s["after"]["record"] for s in (reception, ablated))
assert full["final"] == reduced["final"] and [full["frames"], reduced["frames"]] == [9, 8]
assert [(e["index"], e["gravity"]) for e in full["placement"]] == [(1, 1)] and not reduced["placement"]
assert full["event"]["controls"]["ACTION2"]["phase_index"] == 1
assert full["event"]["status"] == "compatible_public_closure_models" and len(full["event"]["closure"]) == 2
assert reduced["event"]["last"] == "unexplained_or_boundary"
assert "ACTION2" not in reduced["event"]["controls"] and reduced["event"]["gravity"] is None
assert steps[3]["pre"]["command"] == ["ACTION3", {}] and g["sans-reception"]["next"]["command"] == ["ACTION2", {}]

normal6, adverse6 = steps[5]["after"], g["translation-refutee"]["steps"][5]["after"]
assert normal6["packet"] == adverse6["packet"]
assert (normal6["matched"], normal6["seal"], adverse6["matched"], adverse6["seal"]) == (True, False, False, True)
assert len(adverse6["record"]["event"]["refuted"]) == 1
assert normal6["record"] is None
assert adverse6["record"]["event"]["controls"]["ACTION3"] == steps[3]["after"]["record"]["event"]["controls"]["ACTION3"]
assert steps[15]["after"]["record"]["event"]["controls"]["ACTION2"]["revalidated_epoch"] == 2

print(json.dumps({
    "versions": r["versions"], "nativePrefixes": r["prefixes"], "nominalTickets": len(steps),
    "t3Reception": {"frameIndex": 1, "displacement": 1, "closureModels": 2, "status": full["event"]["status"]},
    "t3Reduced": {"status": reduced["event"]["last"], "frames": reduced["frames"], "next": g["sans-reception"]["next"]["command"]},
    "t3OfficialLevels": [s["after"]["levels"] for s in (reception, ablated)],
    "t3Matched": [s["after"]["matched"] for s in (reception, ablated)],
    "t6OnlyPremiseRefuted": True, "t16RevalidatedEpoch": 2,
}, indent=2))
