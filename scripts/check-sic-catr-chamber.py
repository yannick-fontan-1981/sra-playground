"""Check the CATR relation from first experiment to reuse and its refusals."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "9186a49ea207caff1fee6a1386b506739b22d4a3" and r["prefixes"] == 5
t1, t2, t3 = r["nominal"]
first = t1["issued"]
edit = first["plan"]["edits"][0]
assert (edit["id"], edit["old"], edit["new"], edit["known"]) == ("relation:9:12", "12", "10", False)
assert first["command"] == ["ACTION6", {"x": 31, "y": 47}]
assert len(first["cut"]["pre"]["domain"]["offers"]) == 1
observed = t1["after"]["record"]["memory"]["edges"][edit["edge"]]
assert observed["evidence"] == [first["ref"], t1["after"]["ref"]]
assert observed["status"] == "observed_edit_under_current_binding"
assert t2["issued"]["cut"]["pre"]["memory"]["edges"][edit["edge"]] == observed
assert first["plan"]["kind"] == "relation_experiment"
assert t2["issued"]["plan"]["kind"] == "conditional_relation_contribution"
assert t2["after"]["matched"] is True and t3["after"]["levels"] == 1 and t3["after"]["matched"] is None

stationary = r["stationnaire"]
halted, = stationary["steps"]
assert halted["issued"] == first and halted["after"]["packet"] == t1["after"]["packet"]
assert halted["after"]["shown"] != halted["after"]["physical"]
assert halted["after"]["record"]["memory"]["edges"] == {} and halted["after"]["seal"] is True
assert stationary["next"]["command"] == t2["issued"]["command"]
assert stationary["next"]["plan"]["kind"] == "relation_experiment"
assert stationary["next"]["plan"]["edits"][0]["known"] is False

fallback, resumed = r["retrait"]
assert fallback["issued"]["cut"] == first["cut"] and fallback["issued"]["family"] == "animated_contact"
assert resumed["issued"]["command"] == first["command"] and resumed["after"]["matched"] is True
conflict = r["contradiction"]
assert not conflict["steps"] and conflict["stop"] == "frontier_unknown"
assert conflict["last"]["rawReason"] == "shared_relation_rows_contradicted" and conflict["last"]["blocked"]
assert r["garde"]["envelope"]["foreign"] == {"admitted": False, "reason": "relation_binding_changed"}

print(json.dumps({
    "versions": r["versions"], "prefixes": r["prefixes"], "firstEdit": edit, "acquisition": observed,
    "sameCommand": t2["issued"]["command"],
    "roles": [t2["issued"]["plan"]["kind"], stationary["next"]["plan"]["kind"]],
    "fallback": fallback["issued"]["command"], "conflict": conflict["last"]["contradictory"],
    "foreignReference": r["garde"]["envelope"]["foreign"], "firstOfficialLevel": t3["after"]["levels"],
}, indent=2))
