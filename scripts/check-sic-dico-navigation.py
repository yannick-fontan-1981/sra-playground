"""Check the first differing decisions and physical evidence of the DICO navigation variants."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
data = json.loads(args.receipt.read_bytes())
assert data["versions"]["candidat"] == "d84d0b938904a9e10a1ab82f8b8f92a0cfec5cdc"
assert data["versions"]["attendus"].startswith("78a85c23")
variants = data["verdict"]
nominal, other, still, withdrawn = (variants[k] for k in ("nominal","alternatif","stationnaire","retrait"))
assert nominal["steps"][0] == other["steps"][0] == still["steps"][0] == withdrawn["steps"][0]
t2, t3, t4 = nominal["steps"][1:]
replacement, early_query = other["steps"][1:3]
stationary = still["steps"][1]
fallback, reprise = withdrawn["steps"][1:3]
assert len({s["pre"]["ref"] for s in (t2, replacement, stationary, fallback)}) == 1
assert t2["pre"]["offers"] == replacement["pre"]["offers"] == fallback["pre"]["offers"]
scope = [0,1,4,5]
for step, x in ((t2,6),(t3,16),(replacement,16),(reprise,6)):
    assert step["pre"]["kind"] == "subset_scope_navigation" and step["pre"]["guard"]
    assert step["pre"]["command"] == ["ACTION6",{"x":x,"y":3}]
    assert step["pre"]["subset"]["scope"] == scope
select = t2["pre"]["offers"]["pre"]
assert select["queryCount"] == 0 and select["evidence"] == [nominal["steps"][0]["after"]["ref"]]
assert sorted(o["command"]["data"]["x"] for o in select["offers"]) == [6,16]
assert t2["after"]["record"]["kind"] == "public_subset_feedback"
assert t2["after"]["count"] == 14 and t2["after"]["record"]["candidates_after"] == scope
for step in (t3,replacement):
    record = step["after"]["record"]
    assert record["observed_focus"] == [0,1,4,5,6,7] and record["matched"] is False
    assert record["before"] == step["pre"]["ref"] and record["after"] == step["after"]["ref"]
assert t4["pre"]["kind"] == early_query["pre"]["kind"] == "subset_scope_query"
assert t4["pre"]["command"] == early_query["pre"]["command"] == ["ACTION6",{"x":6,"y":3}]
assert early_query["i"] == 3 and t4["i"] == 4
assert stationary["after"]["gamePacket"] == t2["after"]["gamePacket"]
assert stationary["after"]["shownFrame"] != t2["after"]["shownFrame"]
assert stationary["after"]["record"]["observed_focus"] == list(range(8))
assert stationary["after"]["record"]["matched"] is False
assert still["nextStationary"]["command"] == t3["pre"]["command"]
assert still["nextStationary"]["offers"]["pre"]["attempted"] == [t2["pre"]["subset"]["question"]]
assert still["nextStationary"]["offers"]["pre"]["pressShapes"] == select["pressShapes"]
assert fallback["pre"]["family"] == "observed_frontier"
assert fallback["pre"]["command"] == ["ACTION6",{"x":10,"y":23}]
assert nominal["staleChecks"] == [{"admitted":False,"reason":"subset_scope_changed"}]
print(json.dumps({"versions":data["versions"], "nominalQueryTurn":t4["i"], "substitutedQueryTurn":early_query["i"],
    "physicalPacketT2":t2["after"]["gamePacket"], "alteredPresentationT2":stationary["after"]["shownFrame"],
    "firstDivergence":{"game":"DICO","level":1,"turn":2,"before":t2["pre"]["command"],"after":replacement["pre"]["command"]},
    "nominalParityDigest":data["pariteNominale"],"permutationDigest":data["permutation"]},indent=2))
