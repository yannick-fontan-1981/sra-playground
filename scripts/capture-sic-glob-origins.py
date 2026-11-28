"""Capture GLOB decision evidence on a pinned source. Use a separate output directory per revision."""
import argparse
import json
from pathlib import Path
import subprocess

proof = "48aae7fc05ed8d8409b1aa3a05efa4fa9c65c06d"
versions = {"candidat": proof, "historique": "8ce7ee3563fa1d5eca1639c6ad03975cfc962460",
            "gel": "d0e7527ca8033bd805a6d7a8bb021eff62e87021"}
p = argparse.ArgumentParser(description=__doc__)
p.add_argument("checkout", type=Path)
p.add_argument("revision", choices=versions)
p.add_argument("output", type=Path)
p.add_argument("--node", default="node")
p.add_argument("--pyodide", required=True, type=Path)
args = p.parse_args()
root, out, vendor = args.checkout.resolve(), args.output.resolve(), args.pyodide.resolve()
def git(*parts):
    return subprocess.check_output(["git", "-C", str(root), *parts]).decode().strip()
def checked_head():
    head = git("rev-parse", "HEAD")
    if head != proof:
        assert head == "787fee9746815121a133704e2c1554f096e09834"
        assert git("diff", "--name-only", proof, head).splitlines() == [
            "experiments/sic-agenda-offres/glob-13-14/verifier.mjs"]
    git("diff", "--exit-code", "HEAD", "--", "src", "experiments", "public/python", "reference")
    return head

initial_head = checked_head()
lab = root / "experiments/sic-agenda-offres/glob-13-14"
out.mkdir(parents=True)
catalogue = out / "catalogue.fiche.json"
catalogue.write_text(json.dumps({"version": "sic.glob/1", "dy": 0, "gestes": 16}) + "\n", encoding="utf8")
cards = ([] if args.revision == "historique" else sorted((lab / "public").glob("*.json"))) + [catalogue]
summary = {}
for card in cards:
    name = card.name.split(".")[0]
    dest = out / (name + ".json")
    with (out / (name + ".log")).open("wb") as log:
        subprocess.run([args.node, str(lab / "operateur.mjs"), "--moteur", args.revision, "--fiche", str(card),
                        "--pyodide", str(vendor), "--recu", str(dest)], cwd=root, stdout=log,
                       stderr=subprocess.STDOUT, check=True)
    data = json.loads(dest.read_bytes())
    summary[name] = {"input": json.loads(card.read_bytes()), "turns": len(data["steps"]), "stop": data["stop"]}
final_head = checked_head()
(out / "index.json").write_text(json.dumps({"engine": versions[args.revision], "operator": proof, "checkoutStart": initial_head, "checkoutEnd": final_head,
                                           "engineTree": git("rev-parse", versions[args.revision] + ":src"),
                                           "operatorBlob": git("rev-parse", proof + ":experiments/sic-agenda-offres/glob-13-14/operateur.mjs"),
                                           "cases": summary},
                                           indent=2) + "\n", encoding="utf8", newline="\n")
