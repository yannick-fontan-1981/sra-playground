"""Substitute the first-step reference for the crossing-pair reference before T7."""
import argparse
import json
from pathlib import Path
import runpy
import subprocess

common = runpy.run_path(str(Path(__file__).with_name("test-sic-coexistence.py")))
git, copy_git = (common[k] for k in ("git", "copy_git"))
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("engine", type=Path)
parser.add_argument("native_receipt", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--node", default="node")
args = parser.parse_args()

engine, out = args.engine.resolve(), args.output.resolve()
revision = git("-C", str(engine), "rev-parse", "HEAD").decode().strip()
git("-C", str(engine), "diff", "--exit-code", revision, "--", "src", "public/python", "reference")
proof = "fab19fba7cc5e5ac5cd79da53c81fb3ab23b492a"
native = json.loads(args.native_receipt.read_bytes())
assert native["versions"]["qualification"] == proof
nominal = native["native"]["nominal"]["steps"]
pair = nominal[4]["after"]["record"]["events"][1]
first_step = nominal[1]["after"]["ref"]
assert pair["kind"] == "crossed_prefix_pair" and first_step not in pair["evidence"]

root = "experiments/sic-agenda-offres/"
files = [root + name for name in ("weav-43/operateur.mjs", "moteur-reference.mjs", "evaluateur-jeu.mjs", "frontiere-22-23/game.mjs")]
out.mkdir(parents=True)
copy_git(proof, files, out)
worker = out / files[0]
source = worker.read_text(encoding="utf8")
changes = [
    ("'sans-paire'];", "'sans-paire','substitution-paire'];"),
    ("noPair=turn===selectedTurn&&variant==='sans-paire';",
     "noPair=turn===selectedTurn&&variant==='sans-paire',stale=turn===selectedTurn&&variant==='substitution-paire';"),
    ("if(noPair){assert.equal(pairs.length,1);this.pairs=[];}",
     "if(noPair){assert.equal(pairs.length,1);this.pairs=[];}\n"
     "    if(stale){\n"
     "      const [candidate]=pairs;\n"
     "      assert.equal(pairs.length,1);\n"
     "      assert.deepEqual(candidate, "+json.dumps(pair, separators=(",", ":"))+");\n"
     "      this.pairs=[{...candidate,evidence:["+json.dumps(first_step)+",candidate.evidence[1]]}];\n"
     "    }"),
    ("if(noPair)this.pairs=pairs;", "if(noPair||stale)this.pairs=pairs;"),
    ("variant==='nominal'?16:variant==='stationnaire'?selectedTurn:selectedTurn-1;",
     "variant==='nominal'?16:variant==='stationnaire'||variant==='substitution-paire'?selectedTurn:selectedTurn-1;"),
]
for old, new in changes:
    assert source.count(old) == 1, old
    source = source.replace(old, new)
worker.write_text(source, encoding="utf8", newline="\n")
receipt = out / "qualification.json"
with (out / "qualification.log").open("wb") as log:
    subprocess.run([args.node, str(worker), "--source", engine.as_uri() + "/", "--pyodide",
                    str(engine / "public/vendor/pyodide"), "--variante", "substitution-paire", "--tour", "7",
                    "--recu", str(receipt)], cwd=engine, stdout=log, stderr=subprocess.STDOUT, check=True)
changed = json.loads(receipt.read_bytes())["steps"]
assert changed[:6] == nominal[:6]
old, new = nominal[6], changed[6]
before, after = old["pre"]["cut"]["pre"], new["pre"]["cut"]["pre"]
assert before["pairs"] == [pair]
wrong = {**pair, "evidence": [first_step, pair["evidence"][1]]}
assert after == {**before, "pairs": [wrong]}
assert after["incomingPairs"] == before["incomingPairs"] == [pair]
assert new["pre"]["plan"]["intent"]["predicted_pair"] == wrong
assert first_step in new["pre"]["refs"]
assert old["pre"]["command"] == new["pre"]["command"] == ["ACTION1", {}]
assert old["pre"]["guard"] == new["pre"]["guard"] and new["pre"]["guard"]["admitted"]
assert old["after"]["packet"] == new["after"]["packet"]
summary = {
    "source": revision, "game": "WEAV", "level": 1, "turn": 7, "sameObservation": old["pre"]["ref"],
    "before": pair["evidence"], "after": wrong["evidence"],
    "consumedPair": new["pre"]["plan"]["intent"]["predicted_pair"], "command": new["pre"]["command"],
    "guard": new["pre"]["guard"], "samePhysicalReturn": True, "strict": False,
}
(out / "resultats.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf8", newline="\n")
print(json.dumps({key: summary[key] for key in ("game", "turn", "guard", "strict")}))
