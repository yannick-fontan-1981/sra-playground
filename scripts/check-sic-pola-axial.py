"""Check POLA's portable rotation evidence against the real effect and score."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "dfc144ce46139e887d0f48fff9ae3ac2d42d3c3d" and r["prefixes"] == 6
native = r["native"]
nominal = native["nominal"]["steps"]
first = nominal[3]
assert first["pre"]["command"] == ["ACTION4", {}]
assert (first["after"]["levels"], first["after"]["frames"], first["after"]["matched"], first["after"]["seal"]) == (1, 5, None, True)
source = first["after"]["record"]
method, = source["portable"][0]["methods"]
assert (method["action"], method["turn"], method["source_epoch"], method["frame_ordinal"]) == ("ACTION4", 1, 1, 0)
assert method["evidence"][:2] == [first["pre"]["ref"], first["after"]["ref"]]
assert source["result"]["native_packet_attribution"]["accepted_frame_ordinals"] == [0]

l2 = nominal[7]
without = native["sans-methode"]["steps"]
assert without[:7] == nominal[:7]
removed = without[7]
assert l2["pre"]["cut"]["pre"]["usedGeometry"] == removed["pre"]["cut"]["pre"]["usedGeometry"]
assert l2["pre"]["cut"]["pre"]["selection"] == removed["pre"]["cut"]["pre"]["selection"]
assert l2["pre"]["command"] == ["ACTION4", {}] and removed["pre"]["command"] == ["ACTION3", {}]
assert l2["pre"]["plan"]["offer"]["method"]["method"] == method
assert removed["pre"]["plan"]["offer"]["method"] is None
assert "quarter_rotation_observed" in l2["after"]["record"]["result"]["events"]
assert "quarter_rotation_observed" in removed["after"]["record"]["result"]["events"]
rotations = [row["after"]["record"]["rotations"][-1] for row in (l2, removed)]
assert [(rot["action"], rot["turn"]) for rot in rotations] == [("ACTION4", 1), ("ACTION3", -1)]
assert l2["after"]["levels"] == removed["after"]["levels"] == 1
assert nominal[8]["after"]["levels"] == without[8]["after"]["levels"] == 2

contrast = r["contraste"]
assert contrast["fixture"] == "kernelCold" and contrast["first"]["turn"] == 1
assert contrast["retained"]["method"]["turn"] == -1 and contrast["conditional"]["matched"] is None
assert (contrast["retained"]["action"], contrast["withheld"]["action"]) == ("ACTION4", "ACTION3")
print(json.dumps({
    "versions": r["versions"], "prefixes": r["prefixes"], "authorizingMeasure": method,
    "level2Actions": [l2["pre"]["command"], removed["pre"]["command"]],
    "level2Observed": rotations,
    "scores": [nominal[8]["after"]["levels"], without[8]["after"]["levels"]],
    "coldContrast": [contrast["first"]["turn"], contrast["retained"]["method"]["turn"]],
}, indent=2))
