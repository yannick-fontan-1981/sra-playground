"""Replay COMB with a recorded multifactor counterexample in its own scope."""
import argparse
import json
import os
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
proof = "07e70e95d36a9c9543927fda8dc1a9193a011fdd"
frozen = "d0e7527ca8033bd805a6d7a8bb021eff62e87021"
assert git("-C", str(engine), "rev-parse", "HEAD").decode().strip() == frozen
git("-C", str(engine), "diff", "--exit-code", frozen, "--", "src", "public/python", "reference")
source = json.loads(args.native_receipt.read_bytes())
assert source["versions"]["qualification"] == proof
nominal = source["native"]["nominal"]["steps"]
presented = source["native"]["multifactoriel"]["steps"][0]
state = presented["after"]["record"]["state"]
example, = state["counterexamples"]
assert example["changed_factors"] == [0, 1] and state["edges"] == []
assert presented["after"]["packet"] == nominal[0]["after"]["packet"]
assert presented["after"]["presented"] != presented["after"]["physical"]

lab = "experiments/sic-agenda-offres/"
files = [lab + name for name in ("comb-46/operateur.mjs", "rejouer-service.mjs",
         "moteur-reference.mjs", "evaluateur-jeu.mjs", "frontiere-22-23/game.mjs")]
out.mkdir(parents=True)
copy_git(proof, files, out)
instrumented = out / files[0]
worker = instrumented.read_text(encoding="utf8")
changes = [
    ("'multifactoriel','petite-reserve'];", "'multifactoriel','petite-reserve','multifactoriel-suivi','contre-exemple-scelle'];"),
    ("const scoped=['sans-arete','petite-reserve'].includes(variant);",
     "const scoped=['sans-arete','petite-reserve','contre-exemple-scelle'].includes(variant);\n"
     "  const contradiction=variant==='contre-exemple-scelle' ? JSON.parse(process.env.SIC_COMB_COUNTER) : null;"),
    ("if(variant==='nominal'||variant==='multifactoriel')opening??=raw;",
     "if(['nominal','multifactoriel','multifactoriel-suivi'].includes(variant))opening??=raw;\n"
     "    const includeCounter=contradiction&&turn===targetTurn;\n"
     "    if(includeCounter){\n"
     "      assert.equal(old.epoch,contradiction.epoch);\n"
     "      assert.equal(old.geometry_ref,contradiction.geometry);\n"
     "      assert.equal(raw.geometry_ref,contradiction.geometry);\n"
     "      assert.equal(old.counterexamples.length,0);\n"
     "      this.productState={...old,counterexamples:contradiction.counterexamples,\n"
     "        evidence:[...new Set([...old.evidence,...contradiction.counterexamples[0].evidence])]};\n"
     "    }"),
    ("}finally{if(adjusted)this.productState=old;}", "}finally{if(adjusted||includeCounter)this.productState=old;}"),
    ("limit:variant==='nominal'?16:scoped?targetTurn-1:1,",
     "limit:['nominal','multifactoriel-suivi'].includes(variant)?16:variant==='contre-exemple-scelle'?targetTurn:scoped?targetTurn-1:1,"),
    ("present({board,actual,pre})", "present({board,actual,pre,i})"),
    ("if(variant!=='multifactoriel')return actual;",
     "if(!['multifactoriel','multifactoriel-suivi'].includes(variant)||i!==1)return actual;"),
]
for original, edited in changes:
    assert worker.count(original) == 1, original
    worker = worker.replace(original, edited)
instrumented.write_text(worker, encoding="utf8", newline="\n")

results = {}
for variant in ("multifactoriel-suivi", "contre-exemple-scelle"):
    capture = out / (variant + ".json")
    with (out / (variant + ".log")).open("wb") as log:
        subprocess.run([args.node, str(instrumented), "--source", engine.as_uri() + "/", "--pyodide",
                        str(engine / "public/vendor/pyodide"), "--variante", variant, "--tour", "3",
                        "--recu", str(capture)], cwd=engine,
                       env={**os.environ, "SIC_COMB_COUNTER": json.dumps(state)}, stdout=log, stderr=subprocess.STDOUT, check=True)
    results[variant] = json.loads(capture.read_bytes())["steps"]

modified = results["contre-exemple-scelle"]
assert modified[:2] == nominal[:2]
old, new = nominal[2]["pre"], modified[2]["pre"]
assert old["ref"] == new["ref"]
actual = new["cut"]["pre"]["used"]
assert actual["counterexamples"] == [example]
assert actual["edges"] == old["cut"]["pre"]["used"]["edges"]
assert actual["geometry"] == state["geometry"] and actual["epoch"] == state["epoch"]
assert set(example["evidence"]).issubset(actual["evidence"])
continued = results["multifactoriel-suivi"]
assert continued[0] == presented
first = next((row for row in continued[1:] if row["pre"].get("plan") and row["pre"]["plan"].get("estimate")
              and row["pre"]["cut"]["pre"]["used"]["counterexamples"]), None)
summary = {
    "source": frozen, "geometry": state["geometry"], "epoch": state["epoch"],
    "naturalNominalCounterexamples": len(nominal[-1]["after"]["record"]["state"]["counterexamples"]),
    "constructedReturn": example, "target": {"game": "COMB", "level": old["level"], "turn": 3, "sameObservation": old["ref"],
        "before": {key: old[key] for key in ("family", "command", "guard", "plan")},
        "after": {key: new[key] for key in ("family", "command", "guard", "plan")},
        "samePlan": old["plan"] == new["plan"], "addedEvidence": [ref for ref in new["evidence"] if ref not in old["evidence"]],
        "samePhysicalReturn": nominal[2]["after"]["packet"] == modified[2]["after"]["packet"]},
    "continued": None if first is None else {
        "turn": first["i"], "command": first["pre"]["command"], "guard": first["pre"]["guard"],
        "edgeCount": len(first["pre"]["cut"]["pre"]["used"]["edges"])},
}
(out / "resultats.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf8", newline="\n")
print(json.dumps({k: summary[k] for k in ("continued", "naturalNominalCounterexamples")}))
