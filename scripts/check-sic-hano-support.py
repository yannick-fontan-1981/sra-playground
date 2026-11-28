"""Relate the selected member, its deposit and the distinct replan on four supports."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
def load(name):
    return json.loads((args.receipts / (name + ".json")).read_bytes())
gel, source = load("d0e7527c"), load("f768bac6")
assert gel == source and len(gel) == 3
nominal, unmarked, removed = gel

def at(rows, n):
    i = 2*(n-1)
    return rows[i], rows[i+1] if i+1 < len(rows) else None
t1, r1 = at(nominal,1)
t2, r2 = at(nominal,2)
t3, r3 = at(nominal,3)
t7, r7 = at(nominal,7)
assert t1["configuration"] == [[11,7],[],[]] and t1["extent"] == 7 and t1["point"] == {"x":13,"y":51}
assert (t1["source"],t1["destination"],t1["index"],t2["index"]) == (0,1,0,1)
assert t2["point"] == {"x":31,"y":51} and t2["context"] == t1["context"] and t2["member"] == t1["member"]
s, d = r2["acquired"]
assert (s["selection"],s["transfer"],s["progress"]) == (True,False,False)
assert (d["selection"],d["transfer"],d["progress"]) == (False,True,False) and r2["matched"] is True
assert (s["before"],s["after"],d["before"],d["after"]) == (t1["ref"],r1["ref"],t2["ref"],r2["ref"])
assert s["parent"] == d["parent"] == "G_official_completion"
assert t3["point"] == t1["point"] and t3["extent"] == 11 and t3["configuration"] == [[11],[7],[]]
assert r2["ref"] in t3["refs"] and t3["context"] != t1["context"]
assert t7["level"] == 2 and t7["configuration"] == [[15,11,7],[],[],[]] and t7["extent"] == 7
assert (t7["source"],t7["destination"]) == (0,1)
assert unmarked[0] == t1 and unmarked[1]["matched"] is False and unmarked[1]["seal"]
failure, = unmarked[1]["acquired"]
assert not failure["selection"] and not failure["transfer"] and failure["closed"] == [t1["context"]]
assert unmarked[2]["owner"] != t1["owner"] and unmarked[2]["point"] != t2["point"]
assert removed[0]["ref"] == t1["ref"] and removed[0]["owner"] == removed[2]["owner"] == "public_framed_transfer"
assert [removed[i]["point"] for i in (0,2)] == [{"x":13,"y":50},{"x":13,"y":48}]
assert removed[4]["owner"] == t1["owner"] and removed[4]["configuration"] == t1["configuration"]
assert removed[6]["point"] == t2["point"] and removed[7]["matched"] is True
assert sum(row.get("owner")=="ordered_support_transfer" for row in nominal[:32] if row["kind"]=="ticket") == 16
assert at(nominal,17)[0]["owner"] == "public_framed_transfer"
print(json.dumps({"equalScenarios":len(gel),"cataloguePrefixTickets":16,"selection":[t1,s],"deposit":[t2,d],
    "newMember":[t3,r3],"secondLevel":[t7,r7],"unmarked":unmarked[1:],"withdrawal":removed},indent=2))
