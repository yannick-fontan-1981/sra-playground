"""Play the alternate HOLE T8 ticket on the unchanged official board and retain its physical return."""

import argparse
import io
from pathlib import Path
import subprocess
from zipfile import ZipFile


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("engine", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--node", default="node")
args = parser.parse_args()
bench = Path(__file__).resolve().parent.parent
engine, out = args.engine.resolve(), args.output.resolve()
proof = "4f39c40869cdb3c2881d4fef01d3a7eafaf196dd"
base = "experiments/sic-agenda-offres/"
operator = base + "hole-74/operateur.mjs"
assets = [operator, *(base + path for path in ("moteur-reference.mjs", "rejouer-service.mjs", "evaluateur-jeu.mjs",
                                                "frontiere-22-23/game.mjs"))]
raw = subprocess.check_output(["git", "archive", "--format=zip", proof, *assets], cwd=bench)
out.mkdir(parents=True)
with ZipFile(io.BytesIO(raw)) as z:
    z.extractall(out)

tool = out / operator
script = tool.read_text("utf8")
limit = "limit:variant==='nominal'?16:variant==='poche-ouverte'?7:6"
capture = "    const result=await rejouerService("
present = "      present({board,actual,i}){"
summary = "    return {...result,change,cuts:[...cuts.values()]};"
assert all(script.count(x) == 1 for x in (limit, capture, present, summary))
script = script.replace(limit, limit.replace("?7:6", "?8:6"))
script = script.replace(capture, "    let before, physicalT8;\n" + capture)
script = script.replace(present, present + """
        if(i===7) before=structuredClone(actual.frame);
        if(i===8) {
          const changes=actual.frame.flatMap((row,y)=>row.flatMap((value,x)=>value===before[y][x]?[]:[[x,y,value]]));
          const [l,t,r,b]=change.region;
          const region=changes.filter(([x,y])=>l<=x&&x<=r&&t<=y&&y<=b);
          physicalT8={pixels:changes.length,regionPixels:region.length,regionPainted9:region.filter(p=>p[2]===9).length,
            edgeActualBefore:before[change.point[1]][change.point[0]],edgeActualAfter:actual.frame[change.point[1]][change.point[0]],
            levels:actual.levelsCompleted,state:actual.state};
        }
""")
script = script.replace(summary, summary.replace("change,cuts", "change,physicalT8,cuts"))
tool.write_text(script, "utf8", newline="\n")
receipt = out / "qualification.json"
with (out / "qualification.log").open("xb") as log:
    subprocess.run([args.node, str(tool), "--source", engine.as_uri() + "/", "--pyodide", str(engine / "public/vendor/pyodide"),
                    "--variante", "poche-ouverte", "--recu", str(receipt)], cwd=engine, stdout=log,
                   stderr=subprocess.STDOUT, check=True)
