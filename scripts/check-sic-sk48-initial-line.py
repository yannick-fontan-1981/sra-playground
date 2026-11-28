"""Check the calibration and first SK48 plan before any recovery evidence."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "1cf241c7625a1e76e4aa4828a50e0ec7ee2d099f"
assert r["versions"]["stations"] == "4946cf0297734b9464fc52256af6fb27846f3bad" and r["prefixes"] == 8

t1, t2, plan = (r[key] for key in ("t1", "t2", "premierPlan"))
effect = t1["after"]["record"]["state"]["controls"]["ACTION1"]
assert t1["issued"]["plan"]["expected"] is None and t1["after"]["matched"] is None
assert effect["evidence"] == [t1["issued"]["ref"], t1["after"]["ref"]]
assert effect["translation"] == [-6, 0] and effect["extent"] == 0
assert t2["issued"]["cut"]["pre"]["state"]["controls"]["ACTION1"] == effect
priority = r["priorite"]
assert [row["issued"]["command"] for row in priority[:2]] == ["ACTION4", "ACTION1"]
assert priority[0]["after"]["record"]["detail"]["observed_effect"] == {"root_translation": [0, 0], "extent_delta": 6}
stationary = r["stationnaire"]
same_ticket = stationary["steps"][0]
assert same_ticket["issued"] == t1["issued"] and same_ticket["after"]["packet"] == t1["after"]["packet"]
assert same_ticket["after"]["record"]["state"]["controls"] == {}

pre = plan["issued"]["cut"]["pre"]
assert set(pre["state"]["controls"]) == set(pre["state"]["tried"])
assert pre["state"]["recovery"] is None and pre["state"]["refuted"] == 0
assert plan["issued"]["plan"]["kind"] == "conditional_composition" and plan["after"]["matched"] is True
missing = r["sansEffet"]
assert missing["cut"]["pre"]["state"]["tried"] == pre["state"]["tried"]
assert "ACTION1" not in missing["cut"]["pre"]["state"]["controls"]
assert missing["cut"]["removed"] == effect
assert (missing["stop"], missing["cut"]["offer"]["reason"]) == ("frontier_unknown", "rooted_control_effect_unresolved")

gel, stations = [r["permutation"][key] for key in ("gel", "stations")]
assert gel["pre"] == stations["issued"]["cut"]["pre"]
assert gel["pre"]["declaredLimit"] == 12 and gel["offer"]["search"]["bounds"] == ["bound.max_depth"]
assert gel["offer"]["search"]["nodes"] == 792 and gel["offer"]["blocks"] is True
search = stations["issued"]["plan"]["search"]
assert search["nodes"] == 282 and search["projected_order_trial"]["status"] == "compatible_unordered"
assert stations["issued"]["command"] == "ACTION1" and stations["after"]["matched"] is True

print(json.dumps({
    "versions": r["versions"], "prefixes": r["prefixes"], "calibration": effect,
    "scheduleSubstitution": [row["issued"]["command"] for row in priority[:2]],
    "nominalPlan": {"commands": plan["issued"]["plan"]["commands"], "return": plan["after"]["ref"]},
    "withoutEffect": missing["stop"],
    "palettePermutation": {"gel": gel["offer"]["reason"], "gelNodes": 792,
                           "stationsNodes": 282, "stationsOrder": search["projected_order_trial"]["status"]},
}, indent=2))
