"""Join the AS66 operator receipts to the independently captured historical prefixes."""
import argparse
import json
import subprocess
from pathlib import Path
from zipfile import ZipFile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
parser.add_argument("reference", type=Path)
args = parser.parse_args()
load = lambda name: json.loads((args.receipts / (name + ".json")).read_bytes())
summary = load("qualification")
pinned = "484f3f0d066b7c00a3e2ad68c983ad556be3a3ac"
reported = summary["versions"]["candidat"]
if reported != pinned:
    delta = subprocess.check_output(["git", "diff", "--name-status", pinned, reported], text=True).splitlines()
    assert delta == ["A\texperiments/sic-agenda-offres/as66-84-97/VERDICT.md"], delta
assert summary["parcours"] == 12
with ZipFile(args.reference) as archive:
    catalogue, coverage = [load(mode)["steps"] for mode in ("catalogue", "couverture")]
    for mode, steps in (("catalogue", catalogue), ("couverture", coverage)):
        historical = json.loads(archive.read("d0e7527c-" + mode + ".json"))["games"][0]
        assert len(historical["trace"]) == len(steps)
        for index, (old, new) in enumerate(zip(historical["trace"], steps), 1):
            assert (old["action"]["id"], old["packet"], old["levelsCompleted"]) == (
                int(new["before"]["commande"][6:]), new["after"]["paquetJeu"], new["after"]["niveaux"]
            ), (mode, index)
        for old in historical["rows"]:
            new = steps[old["sequence"] - 1]
            assert (old["family"], old["proposal"], old["result"]) == (
                new["before"]["famille"], new["before"]["type"], new["after"]["accord"]
            ), (mode, old["sequence"])

t5, t8, t14 = catalogue[4], catalogue[7], coverage[13]
line84, line97 = (summary[k] for k in ("ligne84", "ligne97"))
assert t5["before"]["appel"] == line84["acquis"] and t8["before"]["appel"] == line84["acquisL2"]
assert t14["before"]["appel"] == line97["acquis"]
assert line84["retraitGel"]["commande"] == "ACTION2"
assert [x["commande"] for x in line84["retraitCandidat"]] == ["ACTION3", "ACTION2"]
assert line84["retraitCandidat"][0]["famille"] == "observed_frontier"
assert line84["retraitCandidat"][1]["type"] == "sliding_cavity_access"
assert t14["before"]["ref"] == catalogue[13]["before"]["ref"]
assert line97["retrait"][0]["commande"] == "ACTION2"
assert line97["retrait"][1]["indice"] == 0
altered = line97["retourModifie"][0]["retour"]
assert altered["paquetJeu"] == t14["after"]["paquetJeu"] and altered["physique"] != altered["presente"]
assert altered["accord"] is False and altered["scelle"] and altered["branches"] == []
assert line97["retourModifie"][1]["indice"] == 0
print(json.dumps({
    "versions": summary["versions"],
    "pinnedCandidate": pinned,
    "matchedToIndependentReference": {"catalogue": len(catalogue), "couverture": len(coverage)},
    "line84CatalogueTurns": [s["geste"] for s in catalogue if s["before"]["type"] == "sliding_cavity_access"],
    "line97CoverageTurns": [s["geste"] for s in coverage if s["before"]["type"] == "clocked_cavity_access"],
    "line97Agreement": [s["after"]["accord"] for s in coverage[13:]],
    "line97Completion": coverage[-1]["after"]["niveaux"],
    "parity": summary["parite"],
}, indent=2))
