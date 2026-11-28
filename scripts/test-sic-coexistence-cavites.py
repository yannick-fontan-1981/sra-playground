"""Run the original cavity qualification on a pinned assembly and compare its detailed receipts."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
from zipfile import ZipFile

common = runpy.run_path(str(Path(__file__).with_name("test-sic-coexistence.py")))
bench, git, copy_git = (common[k] for k in ("BENCH", "git", "copy_git"))
proofs = {"AS66": ("484f3f0d", "as66-84-97"), "AR25": ("f6ff40f5", "ar25-8-77")}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("game", choices=proofs)
parser.add_argument("engine", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--node", default="node")
args = parser.parse_args()
engine, out = args.engine.resolve(), args.output.resolve()
revision = git("-C", str(engine), "rev-parse", "HEAD").decode().strip()
scope = ["src", "public/python", "reference"]
git("-C", str(engine), "diff", "--exit-code", revision, "--", *scope)
proof, lab = proofs[args.game]
frontier = "experiments/sic-agenda-offres/"
lab = frontier + lab + "/"
root = "moteur-reference.mjs"
assets = [lab + "operateur.mjs", lab + "verifier.mjs", frontier + root,
          frontier + "evaluateur-jeu.mjs", frontier + "frontiere-22-23/game.mjs"]
assets += git("ls-tree", "-r", "--name-only", proof, lab + "public").decode().splitlines()
out.mkdir(parents=True)
copy_git(proof, assets, out)
entry = out / frontier / root
text = entry.read_text(encoding="utf8")
anchor = "const root = new URL('../../', import.meta.url);"
assert text.count(anchor) == 1
entry.write_text(text.replace(anchor, "const root = new URL(" + json.dumps(engine.as_uri() + "/") + ");"),
                 encoding="utf8", newline="\n")
receipt = out / "qualification.json"
with (out / "qualification.log").open("wb") as log:
    subprocess.run([args.node, str(out / (lab + "verifier.mjs")), "--pyodide", str(engine / "public/vendor/pyodide"),
                    "--recu", str(receipt)], cwd=engine, stdout=log, stderr=subprocess.STDOUT, check=True)
archive = bench / "docs/diagnostics" / ("sic-" + args.game.lower() + "-" + proof) / "recus.zip"
index = json.loads((archive.parent / "banc.json").read_bytes())
assert hashlib.sha256(archive.read_bytes()).hexdigest() == index["archiveSHA256"]
with ZipFile(archive) as zip_:
    expected = json.loads(zip_.read("qualification.json"))
actual = json.loads(receipt.read_bytes())
assert actual["versions"].pop("candidat") == revision
expected["versions"].pop("candidat")
assert actual == expected, args.game + " qualified receipt changed"
assert revision == git("-C", str(engine), "rev-parse", "HEAD").decode().strip()
git("-C", str(engine), "diff", "--exit-code", revision, "--", *scope)
(out / "resultats.json").write_text(json.dumps({"source": revision, "reference": proof, "archiveSHA256": index["archiveSHA256"],
    "nativeRuns": actual["parcours"] if args.game == "AS66" else actual["services"]}, indent=2) + "\n", encoding="utf8", newline="\n")
