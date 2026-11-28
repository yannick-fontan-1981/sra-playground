"""Check GMAP's scoped access evidence and the common step under ambiguity."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "9c71cd820b59ef3456455b637a0a062abe1d03d0" and r["prefixes"] == 6
native = r["native"]
t1, t2, t3, t4, t5 = native["nominal"]["steps"][:5]
assert native["nominal"]["stop"] == "session_action_budget" and len(native["nominal"]["steps"]) == 16
assert t1["pre"]["command"] == ["ACTION4", {}]
first = t1["after"]["record"]["result"]
assert first["position"] == [29, 28] and first["actual_score_delta"] == 0
assert first["position_status"] == "conditional_arrival_scene_changed_not_unique_world_proof"
assert t1["after"]["ref"] in t2["pre"]["refs"]
gained = t2["after"]["record"]["result"]["events"][1]["peripheral_value_gained"]
assert (gained["value"], gained["current_occurrence"]) == (10, [29, 22])
grant = t3["after"]["record"]["result"]["events"][2]["inventory_loss_and_local_boundary_change"]
assert (grant["from"], grant["to"], grant["value"]) == ([29, 28], [35, 28], 10)
assert grant["status"] == "local_permission_hypothesis_not_confirmed_transaction"
assert grant["evidence"] == [t1["after"]["ref"], t3["pre"]["ref"], t3["after"]["ref"]]
assert t4["pre"]["cut"]["pre"]["state"]["grants"] == [grant]
assert t4["after"]["record"]["result"]["location_alternatives"] == [[29, 28], [35, 28]]
assert t4["pre"]["command"] == t5["pre"]["command"] == ["ACTION4", {}]
first_route, second_route = t5["pre"]["plan"]["offer"]["alternatives"]
assert len(first_route) == 2 and second_route == first_route[1:]
assert t5["after"]["levels"] == 1 and t5["after"]["record"]["result"]["new_epoch_pixels_not_old_scope_evidence"]

unknown = native["sans-localisation"]["steps"][1]
assert unknown["pre"]["cut"]["pre"]["state"]["positions"] == [[23, 28], [29, 28]]
assert unknown["pre"]["cut"]["pre"]["offers"] == []
assert unknown["pre"]["family"] == "observed_frontier" and unknown["pre"]["command"] == t2["pre"]["command"]
denied = native["sans-permission"]["steps"][3]
assert denied["pre"]["cut"]["pre"]["state"]["grants"] == []
assert denied["pre"]["cut"]["pre"]["offers"] == []
assert denied["pre"]["family"] == "observed_frontier" and denied["pre"]["command"] == ["ACTION3", {}]
still = native["stationnaire"]["steps"][0]
assert still["pre"] == t1["pre"] and still["after"]["packet"] == t1["after"]["packet"]
assert still["after"]["record"]["result"]["location_alternatives"] == [[23, 28], [29, 28]]
assert r["contraste"]["inventory"]["empty"]["plan"] is None

print(json.dumps({
    "versions": r["versions"], "prefixes": r["prefixes"], "scopedPermission": grant,
    "noLocationOffer": unknown["pre"]["cut"]["pre"]["offers"], "sameFallbackCommand": unknown["pre"]["command"],
    "admissibleLocations": t4["after"]["record"]["result"]["location_alternatives"], "commonAction": t5["pre"]["command"],
    "firstOfficialLevel": t5["after"]["levels"],
}, indent=2))
