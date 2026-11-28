"""Verify CGWL exploration, local displacement and the scoped attachment hypothesis."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "beb11112bc53afdb80d46b843f42d01474254126" and r["prefixes"] == 7
native = r["native"]
nominal = native["nominal"]["steps"]
assert len(nominal) == 16 and native["nominal"]["stop"] == "session_action_budget"
t1, t2, t3 = nominal[:3]
assert t1["after"]["record"]["state"]["core"]["evidence"] == [t1["pre"]["ref"], t1["after"]["ref"]]
assert t2["pre"]["command"] == ["ACTION2", {}] and t2["pre"]["plan"]["expected"] is None
move = t2["after"]["record"]["state"]["moves"]["ACTION2"]
assert move == {"delta": [0, 4], "evidence": [t2["pre"]["ref"], t2["after"]["ref"]], "status": "observed_local_displacement"}
assert t2["after"]["record"]["state"]["held"] is None
assert t3["pre"]["cut"]["pre"]["measured"]["tracker"]["moves"]["ACTION2"] == move
assert t3["pre"]["plan"]["expected"]["body_center"] == [20, 24]
assert native["sans-deplacement"]["steps"][2]["pre"]["command"] == ["ACTION3", {}]
stationary = native["stationnaire"]["steps"][1]
assert stationary["pre"] == t2["pre"] and stationary["after"]["packet"] == t2["after"]["packet"]
assert "ACTION2" not in stationary["after"]["record"]["state"]["moves"]

t12, t13, t14, t15 = nominal[11:15]
assert t12["pre"]["command"] == ["ACTION5", {}]
attachment = t12["after"]["record"]["result"]
identity = attachment["identity_binding"]
assert attachment["status"] == "local_attachment_hypothesis"
assert identity["status"] == "visible_shape_compatible_under_bounded_translation"
assert identity["scope"] == "visible_part_only_occluded_part_unknown"
assert [option["translation"] for option in identity["alternatives"]] == [[-1, -6]]
assert t12["after"]["ref"] in t13["pre"]["refs"] and t13["pre"]["command"] == ["ACTION4", {}]
assert t13["pre"]["plan"]["offer"]["target"]["ref"] == t12["after"]["record"]["state"]["held"]["ref"]
denied = native["sans-attache"]["steps"][12]
assert denied["pre"]["command"] == ["ACTION5", {}]
assert denied["pre"]["plan"]["offer"]["kind"] == "probe_observed_binding"
assert t14["after"]["matched"] is False and t14["after"]["seal"]
assert t14["after"]["record"]["state"]["held"]["status"] == "joint_transport_observed"
assert t15["pre"]["plan"]["offer"]["kind"] == "approach_reception"

print(json.dumps({
    "versions": r["versions"], "prefixes": r["prefixes"], "firstMeasuredMove": move,
    "attachment": {"status": attachment["status"], "scope": identity["scope"], "visibleTranslations": [-1, -6]},
    "T13": [t13["pre"]["command"], denied["pre"]["command"]], "T14": t14["after"]["record"]["state"]["held"]["status"],
}, indent=2))
