"""Independently audit complete REGN/22 returns, route withdrawal and the alternative acquisition target."""
import argparse
import hashlib
import json
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("directory", type=Path)
args = p.parse_args()
source = {"gel": "d0e7527ca8033bd805a6d7a8bb021eff62e87021", "candidat": "be816a3f09e7b36d9393aaead8d835d9dc3850c5"}
runs = {}
for condition in ("nominal", "sans-trajet", "sans-question"):
    for label, revision in source.items():
        data = json.loads((args.directory / (label + "-" + condition + ".json")).read_bytes())
        assert data.pop("source") == revision and data["condition"] == condition
        if label == "gel":
            runs[condition] = data
        else:
            assert data == runs[condition], condition

normal, withdrawn, alternative = (runs[c] for c in ("nominal", "sans-trajet", "sans-question"))
prefix = normal["game"]["steps"][:15]
assert all(r["game"]["steps"][:15] == prefix for r in runs.values())
assert all(r["boundaries"][0] == {"call": "advance", "sequence": 15, "kind": "boundary", "reason": None} for r in runs.values())
assert all(r["boundaries"][1]["call"] == "resume" for r in runs.values())
assert all(len(r["interventions"]) == 1 for r in runs.values())
first, removed, other = (r["interventions"][0] for r in (normal, withdrawn, alternative))
assert first["observation"] == removed["observation"] == other["observation"]
assert first["routes"] == removed["routes"] and first["questions"] == removed["questions"]
assert removed["offered"]["status"] == "frontier_exhausted" and withdrawn["game"]["steps"] == prefix
assert withdrawn["boundaries"][1]["kind"] == "stopped" and "ticket" not in withdrawn["boundaries"][1]
access, probe = normal["game"]["steps"][15:]
goal = access["pre"]["question"]
assert access["after"]["matched"] is True and probe["pre"]["index"] == 1
assert [r["pre"]["cmd"] for r in (access, probe)] == ["ACTION4", "ACTION3"]
assert probe["after"]["outcome"] == {"objective": goal, "need": access["pre"]["need"], "status": "observed"}
assert probe["after"]["matched"] is None and probe["after"]["seal"]
assert removed["offered"]["refusal"]["need"]["id"] == access["pre"]["accessNeed"]
assert removed["offered"]["refusal"]["need"]["status"] == "open"
assert [q for q in other["questions"] if q["offered"] != q["available"]] == [
    {**first["questions"][-1], "offered": []}]
old_route, new_route = first["routes"][0], other["routes"][0]
assert new_route["path"][:1] == old_route["path"] and len(new_route["path"]) == 2
assert new_route["question"] != goal and new_route["question"] == "Q_af0257e2c8ca6ad0386a"
rr = alternative["game"]["steps"][15:]
assert len(rr) == 2 and all(r["pre"]["cmd"] == "ACTION4" and r["after"]["matched"] is True for r in rr)
assert rr[0]["pre"]["need"] != access["pre"]["need"] and rr[0]["pre"]["accessNeed"] == access["pre"]["accessNeed"]
assert all(r["pre"]["question"] == new_route["question"] and not r["after"].get("outcome") for r in rr)
summary = {"versions": source, "equalPrefix": len(prefix), "observation": first["observation"],
           "accessNeed": access["pre"]["accessNeed"], "nominal": old_route, "alternative": new_route,
           "initialNeed": access["pre"]["need"], "alternateNeed": rr[0]["pre"]["need"],
           "withdrawal": withdrawn["game"]["stop"], "sha256": {
               path.name: hashlib.sha256(path.read_bytes()).hexdigest()
               for path in sorted(args.directory.glob("*.json")) if path.name != "banc.json"}}
print(json.dumps(summary, ensure_ascii=False, indent=2))
