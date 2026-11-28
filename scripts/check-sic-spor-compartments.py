"""Read the two SPOR witnesses and retain the scope of each claim."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
report = json.loads(args.receipt.read_bytes())
assert report["versions"]["qualification"] == "19ffd927b588257ce54cf1a35c166ce41ecebf5b"
nine, fiftysix, catalogue = (report[k] for k in ("ligne9","ligne56","spor"))
opening, resume = nine["temoin"], nine["reprise"]
original, returned = opening["pre"], opening["after"]
assert original["compartment"]["control"]["box"] == [43,44,46,57]
assert original["command"] == ["ACTION6",{"x":44,"y":50}]
assert returned["compartment"]["events"][0]["local_changed"] and returned["compartment"]["events"][0]["after"] == returned["ref"]
assert returned["compartment"]["dependencies"] == [[[43,44,46,57],[]]]
assert resume["pre"]["command"] == ["ACTION6",{"x":53,"y":30}]
assert resume["pre"]["refs"] == [returned["ref"],returned["ref"]]
still = nine["stationnaire"]["steps"][0]
assert still["pre"] == original and still["after"]["packet"] == returned["packet"]
assert still["after"]["physical"] != still["after"]["shown"] and not still["after"]["compartment"]["events"][0]["local_changed"]
assert nine["stationnaire"]["next"]["family"] == nine["retrait"][0]["pre"]["family"] == "observed_frontier"
assert nine["retrait"][1]["pre"]["command"] == original["command"]
assert [r["geste"] for r in nine["receveur"]] == [9,10] and all(r["level"] == 2 for r in nine["receveur"])
assert len(catalogue["tours"]) == 16 and catalogue["compartiment"] == 15 and catalogue["rappel"] == 1
assert catalogue["tours"][-1]["return"]["levels"] == 1
recall = fiftysix["temoin"]
context = recall["pre"]["cut56"]["pre"]["fact"]
assert context["prior"] is None and context["calibration"] is None and not context["seen"] and not context["models"]
assert recall["pre"]["refs"] == [recall["pre"]["ref"]]
assert recall["pre"]["recall"]["reason"] == "test_observed_enclosing_emphasis"
assert fiftysix["sansAcquis"][2]["command"] == recall["pre"]["command"]
removed, replacement, reentered = fiftysix["sansEnclos"]
assert removed["removed"]["point"] == [19,6]
assert replacement["ticket"]["type"] == "contextual_compartment_question"
assert reentered["ticket"]["entry"] == "observed_occurrence_recall"
print(json.dumps({"versions":report["versions"],"nominalCases":{"9":15,"56":1},"qualified":{"9":"frozen"},
    "limitedEvidence":{"56":"current enclosure, without a retained example in SPOR"},
    "key9":{"turn1":original["ref"],"return1":returned["ref"],"turn2":resume["pre"]["ref"]},
    "nominalParityDigest":report["parite"]},indent=2))
