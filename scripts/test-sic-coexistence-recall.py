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
    "FT09": ("d0348ec1", "ft09-94", ("gel",)),
    "POLA": ("dfc144ce", "pola-33", ("gel",)),
    "GMAP": ("9c71cd82", "gmap-34", ("gel",)),
    "CGWL": ("beb11112", "cgwl-37", ("gel",)),
    "CATL": ("fad120b5", "catl-50", ("gel",)),
    "WEAV-PROVENANCE": ("b01ca9bf", "weav-provenance-43", ()),
    "COMB-CONTRE-EXEMPLE": ("24e97436", "comb-contre-exemple-46", ()),
    "SELE": ("77df94e3", "sele-51", ("gel",)),
    "RSWP": ("f3051af8", "rswp-55", ("gel",)),
    "COLM": ("b8902646", "colm-59", ("gel",)),
    "PIPE": ("aa75791a", "pipe-60", ("gel",)),
    "VOIS": ("1391bd74", "vois-62", ("gel",)),
    "THER": ("dc9314cc", "ther-65", ("gel",)),
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
contrast_fixtures = {"POLA": "tests/fixtures/v6-axial-question-reference.json.gz",
                     "GMAP": "docs/migration/lot9a-evidence/reference-01/reference.json.gz"}
if args.game in contrast_fixtures:
    assets += [lab + "contraste.mjs", contrast_fixtures[args.game]]
if args.game in {"CATL", "WEAV-PROVENANCE", "COMB-CONTRE-EXEMPLE", "SELE", "RSWP", "COLM", "PIPE", "VOIS", "THER"}:
    assets.append(frontier + "rejouer-service.mjs")
if args.game == "THER":
    assets += [lab + "archive.mjs", "docs/migration/native-campaigns-v42/ther-four-level-public-trace.json.gz",
               "docs/migration/native-campaigns-v42/ther-four-levels.json", "tests/fixtures/v6-rooted-quota-reference.json.gz"]
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

if args.game in {"MEMO", "SK48", "CATR", "CWSE", "HPDL", "FT09"}:
    verifier = out / entry
    source = verifier.read_text(encoding="utf8")
    expected_tree = "assert.equal(git('rev-parse','HEAD:src'),git('rev-parse','d0e7527c:src'));"
    assert source.count(expected_tree) == 1
    # Confirm the tested HEAD in place of the proof checkout's frozen-tree assertion.
    verifier.write_text(source.replace(expected_tree, "assert.equal(git('rev-parse','HEAD')," + json.dumps(revision) + ");"),
                        encoding="utf8", newline="\n")
contract_commits = {
    "POLA": "0e24fac7", "GMAP": "d9097a5b", "CGWL": "36d4c259", "CATL": "4ab9c99b",
    "WEAV-PROVENANCE": "fd53da26", "COMB-CONTRE-EXEMPLE": "81f2d53d", "SELE": "421e12dc", "RSWP": "47ef461c",
    "COLM": "6c0c3e90", "PIPE": "85d1288b", "VOIS": "90e41585", "THER": "d40aa32d",
}
if args.game in contract_commits:
    verifier = out / entry
    source = verifier.read_text(encoding="utf8")
    # The copied verifier sits outside the proof checkout. Resolve the sealed contract directly.
    lookup = "git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))"
    assert source.count(lookup) == 1
    contract = contract_commits[args.game]
    verifier.write_text(source.replace(lookup, f"git('rev-parse','{contract}')"), encoding="utf8", newline="\n")

receipt = out / "qualification.json"
extra_args = []
if args.game in {"CWSE", "FT09"}:
    flag, prior = {"CWSE": ("catr", "sic-catr-9186a49e"), "FT09": ("hpdl", "sic-hpdl-66ce0494")}[args.game]
    prior_archive = bench / "docs/diagnostics" / prior / "recus.zip"
    prior_receipt = out / (flag + "-reference.json")
    with ZipFile(prior_archive) as z:
        prior_receipt.write_bytes(z.read("qualification.json"))
    extra_args = ["--" + flag, str(prior_receipt)]
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
actual = json.loads(receipt.read_bytes())
assert actual["versions"].pop("qualification") == revision
if "nativeReceiptWithoutQualificationSHA256" in index:
    canonical = json.dumps(actual, sort_keys=True, separators=(",", ":")).encode()
    assert hashlib.sha256(canonical).hexdigest() == index["nativeReceiptWithoutQualificationSHA256"], args.game + " measured receipt changed"
else:
    with ZipFile(archive) as zipped:
        expected = json.loads(zipped.read("qualification.json"))
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
