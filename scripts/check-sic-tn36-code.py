"""Check the TN36 code table observed at the production path search and the resulting tickets."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
def load(name):
    return json.loads((args.receipts / (name + ".json")).read_bytes())
gel, candidate = load("d0e7527c"), load("0da75640")
assert gel == candidate and len(gel) == 3
nominal, final_only, other_example = gel

def turn(rows, n):
    ticket, returned = rows[2*(n-1):2*n]
    assert ticket["kind"] == "ticket" and returned["kind"] == "return" and ticket["turn"] == returned["turn"] == n
    return ticket, returned

t1, r1 = turn(nominal, 1)
t2, r2 = turn(nominal, 2)
t8, r8 = turn(nominal, 8)
t9, r9 = turn(nominal, 9)
t10, r10 = turn(nominal, 10)
t18, r18 = turn(nominal, 18)
assert t1["mode"] == "execute" and t1["operators"] == 0 and t1["pathCall"]["effects"] == []
assert t1["code"] == [3,0,3,0,0] and t1["expected"] is None
assert r1["frames"] == 7 and r1["observations"][0]["samples"] == [{"code":3,"displacement":[0,1]}]*2
assert t2["pathCall"]["effects"] == [["3",[0,1]]] and t2["pathCall"]["candidates"] > 0
assert t2["want"] in t2["pathCall"]["firstPaths"] and t2["want"] == [3]*5 and r1["ref"] in t2["refs"]
assert t8["point"] == t1["point"] and t8["code"] == t2["want"] and r8["levels"] == 1
assert t9["mode"] == "demonstrate" and t9["example"] == 0 and t9["pathCall"]["effects"] == []
assert r1["ref"] not in t9["refs"] and r9["observations"][0]["preserved"]
assert r9["observations"][0]["samples"] and all(r["code"]==33 for r in r9["observations"][0]["samples"])
assert t10["pathCall"]["effects"] == [["33",[0,-1]]] and t10["want"] in t10["pathCall"]["firstPaths"]
assert r9["ref"] in t10["refs"] and t18["code"] == t10["want"] == [33]*4 and r18["levels"] == 2

f1, fr1 = turn(final_only, 1)
f2, fr2 = turn(final_only, 2)
f3, fr3 = turn(final_only, 3)
assert f1 == t1 and fr1["frame"] == r1["frame"] and fr1["frames"] == 1
assert fr1["observations"][0]["samples"] == [] and f2["pathCall"]["effects"] == []
assert f2["want"] == [1,0,3,0,0] and f2["point"] != t2["point"] and fr2["matched"] is True
assert f3["mode"] == "execute" and fr3["observations"][0]["samples"] == [
    {"code":1,"displacement":[1,0]},{"code":3,"displacement":[0,1]}]
o9, or9 = turn(other_example, 9)
o10, or10 = turn(other_example, 10)
assert other_example[:16] == nominal[:16] and o9["ref"] == t9["ref"]
assert o9["pathCall"]["tried"] == [0] and o9["mode"] == "demonstrate" and o9["example"] == 1
assert o9["point"] == {"x":8,"y":58} and or9["observations"][0]["preserved"]
assert not or9["observations"][0]["samples"] and not or10["observations"][0]["samples"]
assert o10["mode"] == "execute" and o10["operators"] == 0

catalogue = load("catalogue")
game, = catalogue["games"]
assert catalogue["maxActions"] == len(game["trace"]) == len(game["rows"]) == 16
assert all(row["family"] == "code_program" and row["proposal"] == "learned_code_program" for row in game["rows"])
assert [(t["point"], r["levels"]) for t,r in (turn(nominal,i) for i in range(1,17))] == [
    (row["action"]["data"], row["levelsCompleted"]) for row in game["trace"]]
print(json.dumps({"sameSessions": len(gel), "catalogueOccurrences": len(game["rows"]),
    "N1": {"opening": t1, "acquisition": r1, "pathSearch": t2["pathCall"], "learnedExecution": [t8,r8]},
    "N2": {"demonstration": [t9,r9], "pathSearch": t10["pathCall"], "learnedExecution": [t18,r18]},
    "finalOnly": [fr1,f2,fr3], "alternateExample": [o9,or9,o10,or10]}, indent=2))
