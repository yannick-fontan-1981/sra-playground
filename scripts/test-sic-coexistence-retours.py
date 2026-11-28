"""Replay REGN and GLOB interventions on a combined engine and reconcile the complete native returns."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
from zipfile import ZipFile

bench = Path(__file__).resolve().parents[1]
inputs = {
    "REGN80": ("6bfb8ccf", "sic-regn-6bfb8ccf", "regn-80"),
    "REGN22": ("be816a3f", "sic-regn-be816a3f", "regn-22"),
    "GLOB": ("48aae7fc", "sic-glob-48aae7fc", "glob-13-14"),
}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("game", choices=inputs)
parser.add_argument("proof", type=Path)
parser.add_argument("engine", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--node", default="node")
parser.add_argument("--pyodide", type=Path, default=bench / "public/vendor/pyodide")
args = parser.parse_args()
proof, engine, out = args.proof.resolve(), args.engine.resolve(), args.output.resolve()
revision, folder, lab = inputs[args.game]
def git(root, *parts):
    return subprocess.check_output(["git", "-C", str(root), *parts]).decode().strip()
proof_sha = git(bench, "rev-parse", revision)
head = git(proof, "rev-parse", "HEAD")
if head != proof_sha:
    assert args.game == "GLOB" and head == "787fee9746815121a133704e2c1554f096e09834"
    assert git(proof, "diff", "--name-only", proof_sha, head).splitlines() == [
        "experiments/sic-agenda-offres/glob-13-14/verifier.mjs"]
git(proof, "diff", "--exit-code", "HEAD", "--", "experiments", "src")
source = git(engine, "rev-parse", "HEAD")
git(engine, "diff", "--exit-code", "HEAD", "--", "src", "public/python", "reference")
out.mkdir(parents=True)
archive = bench / "docs/diagnostics" / folder / "recus.zip"
oracle = json.loads((archive.parent / "banc.json").read_bytes())
assert hashlib.sha256(archive.read_bytes()).hexdigest() == oracle["archiveSHA256"]
operator = proof / "experiments/sic-agenda-offres" / lab
vendor = str(args.pyodide.resolve())
driver = """import { writeFile } from 'node:fs/promises';
const [operator, engine, card, vendor, output] = process.argv.slice(1);
const { play, readCard } = await import(operator);
await writeFile(output, JSON.stringify(await play(engine, await readCard(card), vendor)) + '\\n');"""
with ZipFile(archive) as z:
    if args.game == "REGN80":
        cases = ["budget16", "lecture16", "sans-retour", "sans-questions"]
    elif args.game == "REGN22":
        cases = ["nominal", "sans-trajet", "sans-question"]
    else:
        cases = list(json.loads(z.read("candidat/index.json"))["cases"])
    for case in cases:
        result = out / (case + ".json")
        reference = ("candidat/" if args.game == "GLOB" else "candidat-") + case + ".json"
        expected = json.loads(z.read(reference))
        env = os.environ.copy()
        if args.game == "REGN22":
            env["SIC_REGN_ENGINE_ROOT"] = str(engine)
            command = [args.node, str(bench / "scripts/sic-observe-regn-access.mjs"), str(proof), "candidat",
                       case, vendor, str(result)]
            expected["source"] = source
        else:
            card = operator / "public" / (case + ".json")
            if args.game == "GLOB" and case == "catalogue" or args.game == "REGN80" and case in ["lecture16", "budget16"]:
                card = out / (case + ".fiche.json")
                card.write_bytes(z.read("candidat/catalogue.fiche.json" if args.game == "GLOB" else card.name))
            command = [args.node, "--input-type=module", "-e", driver, (operator / "operateur.mjs").as_uri(),
                       engine.as_uri() + "/", str(card), vendor, str(result)]
        with (out / (case + ".log")).open("wb") as log:
            subprocess.run(command, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
        assert json.loads(result.read_bytes()) == expected, args.game + " " + case
git(engine, "diff", "--exit-code", "HEAD", "--", "src", "public/python", "reference")
assert source == git(engine, "rev-parse", "HEAD")
(out / "resultats.json").write_text(json.dumps({"source": source, "reference": proof_sha, "cases": cases,
                                                "archiveSHA256": oracle["archiveSHA256"]}, indent=2) + "\n",
                                    encoding="utf8", newline="\n")
