"""Check the AR25 movement, reflection evidence and native responses for both lines."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
def load(name):
    return json.loads((args.receipts / (name + ".json")).read_bytes())
report = load("qualification")
assert report["versions"]["candidat"] == "f6ff40f5e6c870ab5f897eaccdd1d43873944c5c" and report["services"] == 10
catalogue = load("catalogue")["steps"]
assert len(catalogue) == 16
eight, cover = report["ligne8"], report["ligne77"]
assert catalogue[:2] == eight["nominal"] and catalogue[3] == cover["entree"]
n1, n2 = eight["nominal"]
a1, a2 = eight["alternative"]
s1 = eight["stationnaire"]["steps"][0]
assert n1["pre"]["containment"] == a1["pre"]["containment"]
assert n1["pre"]["containment"]["fact"]["bodies"][0]["color"] == 4
assert n1["pre"]["kind"] == a1["pre"]["kind"] == "containment_and_contact"
assert n1["pre"]["command"][0] == a2["pre"]["command"][0] == "ACTION1"
assert a1["pre"]["command"][0] == n2["pre"]["command"][0] == "ACTION2"
assert n1["after"]["containment"]["rim"] == a1["after"]["containment"]["rim"] == [
    {"goal":[51,45],"size":35,"before":[9],"after":[9],"unchanged":True}]
assert n1["after"]["containment"]["vectors"] == [["ACTION1",[0,-3]]]
assert a1["after"]["containment"]["vectors"] == [["ACTION2",[0,3]]]
assert s1["pre"] == n1["pre"] and s1["after"]["packet"] == n1["after"]["packet"]
assert not s1["after"]["containment"]["vectors"] and s1["after"]["presented"] != s1["after"]["actual"]

initial=cover["entree"]
fact=initial["pre"]["reflection"]["solved"]["pre"]["fact"]
assert [fact["world"][k] for k in ("direct","image","axis","pitch")] == [5,4,10,3]
assert fact["axes"] == [0,1] and fact["refs"] == [step["after"]["ref"] for step in catalogue[:3]]
assert [vec for _,vec in fact["effects"]] == [[0,-1],[0,1],[-1,0]]
assert all(step["after"]["matched"] is True and step["after"]["levels"] == 0 for step in catalogue[3:])
lost, fallback = cover["preuveRetiree"]
assert lost["after"]["packet"] == catalogue[2]["after"]["packet"]
assert lost["after"]["containment"] == catalogue[2]["after"]["containment"]
assert fallback["pre"]["reflection"]["pre"]["fact"]["axes"] == [1]
assert fallback["pre"]["command"][0] == "ACTION4" and fallback["pre"]["family"] == "containment"
assert cover["offreRetiree"][0]["pre"]["reflection"]["solved"]["solution"] is None
assert cover["offreRetiree"][1]["pre"]["family"] == "reflected_cover"
bad = cover["retourContraire"]
assert bad["pre"] == initial["pre"] and bad["after"]["packet"] == initial["after"]["packet"]
assert bad["after"]["matched"] is False and bad["after"]["seal"] and cover["apresContradiction"]["index"] == 0
reprise = cover["reprise"][1]
assert reprise["pre"]["index"] == 0 and reprise["pre"]["command"][0] == "ACTION2"
assert reprise["pre"]["reflectionPlan"]["coveredBefore"] == [{"direct":[],"reflected":[[17,15]]}]
assert reprise["pre"]["reflectionPlan"]["coveredAfter"] == [{"direct":[],"reflected":[[17,15],[17,16]]}]
assert reprise["after"]["matched"] is True and reprise["after"]["packet"] == catalogue[-1]["after"]["packet"]
digest = hashlib.sha256(json.dumps(catalogue, separators=(",",":"), ensure_ascii=False).encode()).hexdigest()
assert digest == report["parite"]
print(json.dumps({"versions":report["versions"],"nativeRuns":report["services"],"catalogueDigest":digest,
    "confirmedReflections":13,"levelCompletion":catalogue[-1]["after"]["levels"],
    "rim":n1["after"]["containment"]["rim"],"reflectionRoles":{"direct":5,"image":4},
    "retainedCells":[[17,15]],"newCoverage":[[17,16]]},indent=2))
