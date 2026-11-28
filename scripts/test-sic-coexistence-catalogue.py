"""Compare all eligible GARE, LIFE or SP80 sessions to their independent receipts on a combined engine."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from zipfile import ZipFile

bench = Path(__file__).resolve().parents[1]
references = {"GARE": "c3f24fb8", "LIFE": "f005be66", "SP80": "bb4a99b5"}
p = argparse.ArgumentParser(description=__doc__)
p.add_argument("game", choices=references)
p.add_argument("engine", type=Path)
p.add_argument("output", type=Path)
p.add_argument("--node", default="node")
args = p.parse_args()
engine, out = args.engine.resolve(), args.output.resolve()
revision = subprocess.check_output(["git", "-C", str(engine), "rev-parse", "HEAD"]).decode().strip()
subprocess.run([sys.executable, str(bench / "scripts/test-sic-catalogue-lines.py"), revision, str(out),
                "--game", args.game, "--game-root", str(engine), "--node", args.node], check=True)
ref = references[args.game]
archive = bench / "docs/diagnostics" / ("sic-" + args.game.lower() + "-" + ref) / "recus.zip"
oracle = json.loads((archive.parent / "banc.json").read_bytes())
assert hashlib.sha256(archive.read_bytes()).hexdigest() == oracle["archiveSHA256"]
with ZipFile(archive) as z:
    expected = json.loads(z.read(ref + ".json"))
# The partial cell-placement selector is outside the engine when only SP80/4 is assembled.
if args.game == "SP80":
    path = "src/logos-engine/v6-cell-placement.ts"
    subprocess.run(["git", "-C", str(engine), "diff", "--exit-code", "d0e7527c", revision, "--", path], check=True)
    expected = expected[:5]
observed = json.loads((out / (revision[:8] + ".json")).read_bytes())
assert observed == expected, args.game + " native sessions changed"
log = (out / (revision[:8] + ".log")).read_text(encoding="utf8")
passed, skipped = (int(re.search(r"(?m)^. " + n + r" (\d+)\s*$", log)[1]) for n in ("pass", "skipped"))
assert (passed, skipped) == {"GARE": (8, 0), "LIFE": (10, 0), "SP80": (6, 2)}[args.game]
(out / "resultats.json").write_text(json.dumps({"source": revision, "individualProof": ref, "sessions": len(observed),
    "passed": passed, "skipped": skipped, "individualArchiveSHA256": oracle["archiveSHA256"]}, indent=2) + "\n",
    encoding="utf8", newline="\n")
