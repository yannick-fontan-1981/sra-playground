"""Replay DICO line 86 on the same pinned engine prepared for lines 87 and 98."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
from zipfile import ZipFile

common = runpy.run_path(str(Path(__file__).with_name("test-sic-coexistence.py")))
bench, git, copy_git = (common[k] for k in ("BENCH", "git", "copy_git"))
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("engine", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--node", default="node")
args = parser.parse_args()
engine, out = args.engine.resolve(), args.output.resolve()
source = git("-C", str(engine), "rev-parse", "HEAD").decode().strip()
paths = ["src", "public/python", "reference"]
git("-C", str(engine), "diff", "--exit-code", source, "--", *paths)

proof = "d84d0b938904a9e10a1ab82f8b8f92a0cfec5cdc"
lab = "experiments/sic-agenda-offres/"
operator = lab + "dico-86/operateur.mjs"
out.mkdir(parents=True)
copy_git(proof, [operator, *(lab + name for name in ["evaluateur-jeu.mjs", "moteur-reference.mjs", "frontiere-22-23/game.mjs"])], out)
revision_path = bench / "docs/diagnostics/sic-dico-d84d0b93"
index = json.loads((revision_path / "banc.json").read_bytes())
archive_path = revision_path / "recus.zip"
assert hashlib.sha256(archive_path.read_bytes()).hexdigest() == index["archiveSHA256"]
with ZipFile(archive_path) as archive:
    expected = json.loads(archive.read("qualification.json"))
assert expected["versions"]["candidat"] == proof
variants = {"nominal":"nominal", "autre-commande":"alternatif", "stationnaire":"stationnaire",
            "retrait":"retrait", "permutation":"nominal"}
for condition, key in variants.items():
    receipt = out / (condition + ".json")
    with (out / (condition + ".log")).open("wb") as log:
        subprocess.run([args.node, str(out / operator), "--source", engine.as_uri() + "/", "--variante", condition,
                        "--pyodide", str(engine / "public/vendor/pyodide"), "--recu", str(receipt)],
                       stdout=log, stderr=subprocess.STDOUT, check=True)
    actual = json.loads(receipt.read_bytes())
    reference = expected["verdict"][key]
    if condition == "permutation":
        assert actual["steps"] == reference["steps"], condition
    else:
        assert actual == reference, condition
git("-C", str(engine), "diff", "--exit-code", source, "--", *paths)
assert git("-C", str(engine), "rev-parse", "HEAD").decode().strip() == source
(out / "resultats.json").write_text(json.dumps({"source": source, "proof": proof, "conditions": list(variants),
    "referenceArchiveSHA256": index["archiveSHA256"]}, indent=2) + "\n", encoding="utf8", newline="\n")
