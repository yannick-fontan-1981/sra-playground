"""Replay the sealed native operator controls on an exact assembly."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
from zipfile import ZipFile

common = runpy.run_path(str(Path(__file__).with_name("test-sic-coexistence.py")))
bench, git, copy_git = (common[k] for k in ("BENCH", "git", "copy_git"))
proofs = {
    "SPOR": ("19ffd927", "spor-9-56", ("gel",)),
    "MEMO": ("4d9f1a39", "memo-56", ("gel",)),
    "SK48": ("1cf241c7", "sk48-64", ("stations",)),
    "TU93": ("49a971c3", "tu93-39", ("gel",)),
    "CATR": ("9186a49e", "catr-42", ("gel",)),
    "CWSE": ("71e15295", "cwse-45", ("gel",)),
    "HPDL": ("66ce0494", "hpdl-75", ("gel",)),
}
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
proof, lab, redirected = proofs[args.game]
frontier = "experiments/sic-agenda-offres/"
lab = frontier + lab + "/"
reference = frontier + "moteur-reference.mjs"
entry = lab + "verifier.mjs"
assets = [entry, lab + "operateur.mjs", reference, frontier + "evaluateur-jeu.mjs", frontier + "frontiere-22-23/game.mjs"]
out.mkdir(parents=True)
copy_git(proof, assets, out)

# Point only the listed arms at the assembly; the historical comparisons stay pinned.
helper = out / reference
source = helper.read_text(encoding="utf8")
root = "const root = new URL('../../', import.meta.url);"
gate = "if(name==='candidat') return fn(root);"
assert source.count(root) == source.count(gate) == 1
source = source.replace(root, "const root = new URL(" + json.dumps(engine.as_uri() + "/") + ");")
source = source.replace(gate, "if(" + json.dumps(["candidat", *redirected]) + ".includes(name)) return fn(root);")
helper.write_text(source, encoding="utf8", newline="\n")

if args.game in {"MEMO", "SK48", "CATR", "CWSE", "HPDL"}:
    verifier = out / entry
    source = verifier.read_text(encoding="utf8")
    expected_tree = "assert.equal(git('rev-parse','HEAD:src'),git('rev-parse','d0e7527c:src'));"
    assert source.count(expected_tree) == 1
    # Confirm the tested HEAD in place of the proof checkout's frozen-tree assertion.
    verifier.write_text(source.replace(expected_tree, "assert.equal(git('rev-parse','HEAD')," + json.dumps(revision) + ");"),
                        encoding="utf8", newline="\n")

receipt = out / "qualification.json"
extra_args = []
if args.game == "CWSE":
    catr_reference = bench / "docs/diagnostics/sic-catr-9186a49e/recus.zip"
    native_catr = out / "catr-reference.json"
    with ZipFile(catr_reference) as z:
        native_catr.write_bytes(z.read("qualification.json"))
    extra_args = ["--catr", str(native_catr)]
with (out / "qualification.log").open("wb") as log:
    subprocess.run([args.node, str(out / entry), "--pyodide", str(engine / "public/vendor/pyodide"),
                    "--recu", str(receipt), *extra_args], cwd=engine, stdout=log, stderr=subprocess.STDOUT, check=True)
if args.game == "SK48":
    # Apply the independently published alternate palette to the same stations arm.
    source = (out / (lab + "operateur.mjs")).read_text(encoding="utf8")
    swap = {"v===9?14:v===14?9:v": "v===8?13:v===13?8:v",
            "[palette[9],palette[14]]=[palette[14],palette[9]]": "[palette[8],palette[13]]=[palette[13],palette[8]]"}
    for left, right in swap.items():
        assert source.count(left) == 1
        source = source.replace(left, right)
    extra = out / (lab + "palette-8-13.mjs")
    extra.write_text(source, encoding="utf8", newline="\n")
    alternate = out / "palette-8-13.json"
    with (out / "palette-8-13.log").open("wb") as log:
        subprocess.run([args.node, str(extra), "--moteur", "stations", "--pyodide",
                        str(engine / "public/vendor/pyodide"), "--variante", "palette", "--recu", str(alternate)],
                       cwd=engine, stdout=log, stderr=subprocess.STDOUT, check=True)
    steps = json.loads(alternate.read_bytes())["steps"]
    assert len(steps) == 5
    assert steps[4]["issued"]["plan"]["kind"] == "conditional_composition" and steps[4]["after"]["matched"] is True
archive = bench / "docs/diagnostics" / ("sic-" + args.game.lower() + "-" + proof) / "recus.zip"
archive_digest = hashlib.sha256(archive.read_bytes()).hexdigest()
index = json.loads((archive.parent / "banc.json").read_bytes())
assert archive_digest == index["archiveSHA256"]
with ZipFile(archive) as zipped:
    expected = json.loads(zipped.read("qualification.json"))
actual = json.loads(receipt.read_bytes())
assert actual["versions"].pop("qualification") == revision
assert expected["versions"].pop("qualification").startswith(proof)
assert actual == expected, args.game + " measured receipt changed"
assert revision == git("-C", str(engine), "rev-parse", "HEAD").decode().strip()
git("-C", str(engine), "diff", "--exit-code", revision, "--", *scope)
result = {
    "source": revision, "reference": proof, "redirectedArms": redirected,
    "archiveSHA256": archive_digest,
}
if args.game == "SK48":
    result["alternatePalette"] = {"swap": [8, 13], "turn": 5, "matched": True}
(out / "resultats.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf8", newline="\n")
