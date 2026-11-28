"""Reconcile GLOB's emitted dependency, measured execution, placement and continuation."""
import argparse
import json
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("directory", type=Path)
args = p.parse_args()
root = args.directory
sources = {"historique": "8ce7ee3563fa1d5eca1639c6ad03975cfc962460",
           "gel": "d0e7527ca8033bd805a6d7a8bb021eff62e87021",
           "candidat": "48aae7fc05ed8d8409b1aa3a05efa4fa9c65c06d"}
runs = {}
for label, sha in sources.items():
    index = json.loads((root / label / "index.json").read_bytes())
    assert index["engine"] == sha and index["operator"] == sources["candidat"]
    runs[label] = {name: json.loads((root / label / (name + ".json")).read_bytes())["steps"]
                   for name in index["cases"]}
gel, child = runs["gel"], runs["candidat"]
assert len(gel) == len(child) == 11
for case in gel:
    if case != "dependance":
        assert gel[case] == child[case], case
catalogue = child["catalogue"]
assert catalogue == runs["historique"]["catalogue"] and len(catalogue) == 16
assert catalogue[:6] == child["nominal"]
first, placed, dependency, access, launch = catalogue[:5]
assert first["pre"]["cmd"] == "ACTION5" and first["pre"]["ref"].split(":")[-1] == first["after"]["ref"].split(":")[-1]
assert placed["pre"]["data"] == {"x": 10, "y": 16} and placed["after"]["record"]["events"][0]["kind"] == "placement_changed_with_unchanged_word"
assert dependency["pre"]["selected"]["pre"]["pending"]["ref"] == placed["after"]["ref"]
assert dependency["pre"]["refs"] == [placed["pre"]["ref"], placed["after"]["ref"]]
assert dependency["pre"]["kind"] == "fixed_origin_dependency" and dependency["pre"]["guard"]
assert dependency["after"]["matched"] is None and dependency["after"]["seal"]
def samples(row):
    return row["after"]["record"]["events"][0]["samples"]
assert dependency["after"]["shownFrames"] == 66 and sum(map(len, samples(dependency).values())) == 12
assert access["pre"]["origin"] == 10 and access["pre"]["target"] == 23 and access["pre"]["models"] == 8
assert len(access["pre"]["selected"]["origins"]["eligible"]) == 1 and access["pre"]["data"] == {"x": 31, "y": 12}
assert access["after"]["matched"] is True and not access["after"]["seal"]
assert launch["pre"]["index"] == 1 and launch["pre"]["cmd"] == "ACTION5" and launch["after"]["completed"] == 1
assert gel["dependance"] == catalogue[:4] and child["dependance"][:2] == catalogue[:2]
for case in ["dependance", "reference", "inertie"]:
    probe = child[case][2]
    assert probe["pre"]["ref"] == dependency["pre"]["ref"] and probe["pre"]["selected"]["offer"] is None
    assert probe["pre"]["data"] == {"x": 10, "y": 17} and probe["pre"]["family"] == "observed_frontier"
thin = child["image-finale"]
assert thin[2]["after"]["ref"] == dependency["after"]["ref"] and thin[2]["after"]["shownFrames"] == 1
assert sum(map(len, samples(thin[2]).values())) == 1 and thin[3]["pre"]["family"] == "observed_frontier"
changed = child["cible"]
assert samples(changed[2]) == samples(dependency) and changed[3]["pre"]["origin"] == 11 and changed[3]["pre"]["target"] == 24
assert changed[3]["pre"]["data"] == {"x": 37, "y": 12}
assert len(changed[3]["pre"]["selected"]["origins"]["eligible"]) == 1
assert child["commande"][2]["pre"]["cmd"] == "ACTION4" and child["commande"][4]["after"]["completed"] == 1
assert child["deplace"][3]["pre"]["data"] == {"x": 31, "y": 13} and child["deplace"][4]["after"]["completed"] == 1
without = child["acces"]
assert without[:3] == catalogue[:3] and without[3]["pre"]["family"] == "observed_frontier"
assert without[4]["pre"]["kind"] == "fixed_program_origin_access"
stale = child["placement"]
assert stale[3]["pre"] == access["pre"] and stale[3]["after"]["matched"] is False and stale[3]["after"]["seal"]
assert stale[4]["pre"]["index"] == 0 and stale[4]["pre"]["cmd"] == "ACTION6"
print(json.dumps({"sources": sources, "prefixes": sum(map(len, runs.values())),
                  "identicalPairedCases": [c for c in gel if c != "dependance"],
                  "nominalTurns13": [r["i"] for r in catalogue if r["pre"]["kind"] == "fixed_origin_dependency"],
                  "nominalTurns14": [r["i"] for r in catalogue if r["pre"]["kind"] == "fixed_program_origin_access"],
                  "withdrawal13": {s: runs[s]["dependance"][2]["pre"]["kind"] for s in ["gel", "candidat"]},
                  "normalOrigin": access["pre"]["origin"], "alternativeOrigin": changed[3]["pre"]["origin"],
                  "fullSamples": 12, "lastFrameSamples": 1}, indent=2))
