"""Check the measured arrival evidence, configuration choices and official boundaries."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
def load(name):
    return json.loads((args.receipts / (name + ".json")).read_bytes())
gel, source = load("d0e7527c"), load("1e11472a")
assert gel == source and len(gel) == 3
nominal, final_only, no_order = gel

def at(rows, n):
    i = 2 * (n - 1)
    return rows[i], rows[i+1] if i+1 < len(rows) else None

def event(row, kind):
    match, = [item for item in row["events"] if item["kind"] == kind]
    return match

t1, r1 = at(nominal,1)
t2, r2 = at(nominal,2)
t3, r3 = at(nominal,3)
assert t1["owner"] == "observed_frontier" and t1["action"] == "ACTION5"
assert r1["frames"] == 75
acq = event(r1, "public_configured_arrival_packet")
assert acq["after"] == r1["ref"] == t2["latestFit"] == t3["latestFit"]
assert {actor: v["tick"] for actor,v in acq["measured"].items()} == {"9":52,"12":68}
assert acq["compatible"] == 24 and acq["samples"] == 4
assert t2["point"] == {"x":32,"y":26} and t2["proof"] is None and t2["owner"] == "configured_arrivals"
change = event(r2, "configured_local_rewrite")
assert change["point"] == [32,26] and (change["before"],change["after"]) == (r1["ref"],r2["ref"])
assert t3["ref"] == r2["ref"] and t3["proof"]["question"] == "coincident_first_arrivals"
assert t3["proof"]["intervals"] == [[17,17]] and t3["proof"]["policies"] == 24
assert r3["levels"] == 1 and r3["reason"] == "official_score_boundary" and r3["matched"] is None

ft1, fr1 = at(final_only,1)
ft2, fr2 = at(final_only,2)
assert ft1 == t1 and fr1["frame"] == r1["frame"] and fr1["frames"] == 1 and not fr1["events"]
assert ft2["owner"] == "observed_frontier" and ft2["point"] == {"x":10,"y":32}
assert fr2["frame"] == fr1["frame"]

t10,r10 = at(nominal,10)
t11,r11 = at(nominal,11)
t12,r12 = at(nominal,12)
assert t10["proof"]["question"] == "route_order_discrimination" and t10["proof"]["policies"] == 6
assert len(t10["proof"]["intervals"]) > 1 and all(s == "COMPLETE" for s in t10["proof"]["routeDomains"])
assert t11["action"] == "ACTION5" and t11["proof"] == t10["proof"]
measured = event(r11, "public_configured_arrival_packet")
assert measured["compatible"] == 3 and t12["proof"]["policies"] == 3
assert t12["proof"]["question"] == "coincident_first_arrivals" and t12["proof"]["intervals"] == [[18,18,18]]
assert t12["latestFit"] == measured["after"]
cohort, = t12["proof"]["cohorts"]
assert cohort["tick"] == 18 and sorted(cohort["actor_refs"]) == ["12","15","9"]
assert at(nominal,15)[1]["levels"] == 3 and at(nominal,15)[1]["matched"] is None
assert no_order[:18] == nominal[:18] and at(no_order,10)[0]["ref"] == t10["ref"]
fallback, returned = at(no_order,10)
assert fallback["owner"] == "observed_frontier" and fallback["point"] == {"x":10,"y":18}
assert returned["frame"] == at(nominal,9)[1]["frame"]
resume = at(no_order,11)[0]
assert resume["point"] == t10["point"] and resume["proof"] == t10["proof"]
assert at(no_order,13)[0]["proof"] == t12["proof"]
assert sum(row.get("owner")=="configured_arrivals" for row in nominal if row["kind"]=="ticket") == 13
print(json.dumps({"identicalSessions":len(gel),"catalogueOccurrences":13,"N1":{"measurement":acq,"edit":[t2,change],
    "launch":[t3,r3],"endpointOnly":[fr1,ft2]},"N3":{"discrimination":t10,"nextMeasurement":measured,
    "coincidence":t12,"fallback":[fallback,returned,resume]}},indent=2))
