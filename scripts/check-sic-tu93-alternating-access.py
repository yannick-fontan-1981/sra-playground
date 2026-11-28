"""Check the native TU93 graph prefix, relevant measure, rejection and scope."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "49a971c37982154ea175294afffdf83469c1c302"
assert r["prefixes"] == 6
t15, t16 = r["nominal"]
assert [row["pre"]["command"] for row in (t15, t16)] == ["ACTION4", "ACTION2"]
assert t15["pre"]["cut"]["fact"]["remaining"] == 2
assert all(row["after"]["matched"] is True and row["after"]["levels"] == 0 for row in (t15, t16))
measure, = r["acquisition"]
assert measure["action"] == "ACTION4" and measure["delta"] == [0, 6]
removed, withdrawn = r["suppression"], r["retrait"]
assert removed[0]["pre"]["cut"]["removed"] == [measure]
assert removed[0]["pre"]["cut"]["authored"]["reason"] == "graph_access_absent_or_ambiguous"
assert withdrawn[0]["pre"]["cut"]["fact"] == t15["pre"]["cut"]["fact"]
assert [row["pre"]["command"] for row in removed] == [row["pre"]["command"] for row in withdrawn] == ["ACTION3", "ACTION4"]
assert [row["after"]["packet"] for row in removed] == [row["after"]["packet"] for row in withdrawn]
assert r["etranger"]["signature"] != measure["signature"] and r["etranger"]["delta"] == [0, -6]
stationary, next_ticket = [r["stationnaire"][key] for key in ("t15", "next")]
assert stationary["pre"] == t15["pre"] and stationary["after"]["packet"] == t15["after"]["packet"]
assert stationary["after"]["shown"] != stationary["after"]["physical"]
assert stationary["after"]["seal"] is True and stationary["after"]["matched"] is False
assert stationary["after"]["reason"] == "graph_displacement_or_extra_effect_diverged"
assert stationary["after"]["record"]["refused"] == next_ticket["cut"]["fact"]["refused"]
assert next_ticket["family"] == "observed_frontier" and next_ticket["command"] == "ACTION3"
assert t16["after"]["record"]["last"]["evidence"] == [t15["after"]["ref"], t16["after"]["ref"]]

print(json.dumps({
    "versions": r["versions"], "prefixes": r["prefixes"], "measure": measure,
    "moves": [t15["pre"]["command"], t16["pre"]["command"]],
    "measuredSecondMove": t16["after"]["record"]["last"], "levelsCompleted": 0,
    "withdrawal": removed[0]["pre"]["cut"]["authored"]["reason"],
    "stationary": stationary["after"]["reason"], "next": next_ticket["command"],
}, indent=2))
