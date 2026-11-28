"""Reconcile the RE86 control measurements, joint cover and first official boundary."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
def load(name):
    return json.loads((args.receipts / (name + ".json")).read_bytes())
gel, source = load("d0e7527c"), load("8e820aa6")
assert gel == source and len(gel) == 3
nominal, stationary, alternative = gel
catalogue, = load("catalogue")["games"]
assert catalogue["count"] == len(catalogue["rows"]) == 16 and catalogue["levels"] == 0
assert all(row["family"] == "constellation_cover" and row["proposal"] == "controlled_constellation_cover" for row in catalogue["rows"])

def at(rows,n):
    ticket, returned = rows[(n-1)*2:n*2]
    return ticket, returned
def acquired(rows,n):
    ref=at(rows,n)[1]["ref"]
    return [event for row in rows if row["kind"]=="return" for event in row["records"] if event["ref"]==ref][-1]

t1,r1 = at(nominal,1)
assert t1["vectors"] == {} and t1["bodies"] == 0 and t1["mode"] == "acquire" and t1["forecast"] is None
assert [acquired(nominal,n)["vector"] for n in range(1,5)] == [[0,-3],[0,3],[-3,0],[3,0]]
s0, = acquired(nominal,4)["supports"]
s1, = acquired(nominal,8)["supports"]
assert [(s["owner"],s["palette"],s["pixels"]) for s in (s0,s1)] == [(0,9,53),(1,11,45)]
t9,r9 = at(nominal,9)
t9a,r9a = at(alternative,9)
assert at(nominal,8)[1]["ref"] in s1["refs"] and at(nominal,8)[1]["ref"] in t9["refs"]
assert t9["ownership"] and t9a["ownership"] and t9["active"] == t9a["active"] == 0
assert t9["poses"] == [[36,45],[18,24]] and t9a["poses"] == [[36,45],[18,30]]
assert r9["matched"] is r9a["matched"] is True
assert at(nominal,20)[0]["mode"] == "cycle" and acquired(nominal,20)["occlusion"]
assert at(nominal,21)[0]["active"] == 1
assert at(nominal,26)[1]["levels"] == 1 and acquired(nominal,26)["status"] == "official_boundary"
assert at(nominal,27)[0]["bodies"] == 0 and at(nominal,27)[0]["mode"] == "acquire"
assert at(alternative,28)[1]["levels"] == 1 and at(alternative,29)[0]["bodies"] == 0
assert stationary[0] == t1 and stationary[1]["matched"] is None
assert "vector" not in acquired(stationary,1) and stationary[2]["vectors"] == {}
assert stationary[2]["action"] == "ACTION2"
assert alternative[0]["ref"] == t1["ref"] and alternative[0]["action"] == "ACTION2"
assert alternative[2]["action"] == "ACTION1" and alternative[2]["vectors"] == {"ACTION2":[0,3]}
assert [row["command"]["id"] for row in catalogue["rows"]] == [int(at(nominal,n)[0]["action"][6:]) for n in range(1,17)]
print(json.dumps({"equalScenarios":len(gel),"catalogueTickets":catalogue["count"],"owners":[s0,s1],
    "actualCovers":[[t9,r9],[t9a,r9a]],"officialTurns":{"nominal":26,"alternative":28},
    "stationary":[stationary[1],stationary[2]]},indent=2))
