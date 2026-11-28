"""Check the retained-example evidence in MEMO alongside SPOR's current enclosure."""
import argparse
import json
from pathlib import Path
from zipfile import ZipFile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("memo", type=Path)
parser.add_argument("spor", type=Path)
args = parser.parse_args()
memo = json.loads(args.memo.read_bytes())
with ZipFile(args.spor) as archive:
    spor = json.loads(archive.read("qualification.json"))

assert memo["versions"]["qualification"] == "4d9f1a397bd3706469f419739d077d366eb1b13c" and memo["prefixes"] == 4
t6, nominal, nxt, removed, neutral = (memo[k] for k in ("avantReprise","rappel","suite","retrait","controle"))
cut = nominal["issued"]["cut"]
offer, prior = cut["authorizes"], cut["pre"]["prior"]
assert nominal["i"] == 7 and nominal["issued"]["command"] == ["ACTION6",{"x":15,"y":35}]
assert offer["reason"] == "test_retained_occurrence_correspondence" and len(offer["support"]) == 4
assert all(not occurrence["marked"] for occurrence in cut["pre"]["current"]["occurrences"])
assert t6["after"]["ref"] == nominal["issued"]["ref"] and prior["example"] == t6["ref"]
assert offer["refs"] == [nominal["issued"]["ref"],t6["ref"]]
assert nominal["after"]["memory"][0]["mode"] == "forward"
assert nxt["issued"]["command"] == ["ACTION6",{"x":14,"y":28}]
assert nxt["issued"]["cut"]["pre"]["prior"]["example"] == nominal["issued"]["ref"]
loss = removed["issued"]["cut"]
assert loss["pre"] == cut["pre"] and loss["removed"]["point"] == [46,41] and loss["authorizes"] is None
assert removed["issued"]["family"] == "animated_contact" and memo["arret"] == "frontier_unknown"
neutral_cut = neutral["issued"]["cut"]
assert neutral_cut["removed"]["point"] == [14,37]
assert {**neutral_cut, "removed":None} == cut and neutral["after"] == nominal["after"]
assert neutral["issued"]["command"] == nominal["issued"]["command"]
witness = spor["ligne56"]["temoin"]["pre"]
assert witness["recall"]["reason"] == "test_observed_enclosing_emphasis"
assert witness["cut56"]["pre"]["fact"]["prior"] is None and witness["refs"] == [witness["ref"]]
print(json.dumps({"versions":memo["versions"],"borrowedExample":{"point":[46,41],"ref":t6["ref"]},
    "positiveTicket":nominal["issued"]["ticket"],"reason":offer["reason"],
    "withdrawal":{"owner":removed["issued"]["family"],"stop":memo["arret"]},
    "neutralControl":{"point":[14,37],"sameDecision":True},"spor":witness["recall"]["reason"]},indent=2))
