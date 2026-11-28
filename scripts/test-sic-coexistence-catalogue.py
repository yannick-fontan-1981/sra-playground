"""Compare the eligible catalogue sessions to their independent receipts on a combined engine."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from zipfile import ZipFile

bench = Path(__file__).resolve().parents[1]
references = {"GARE": ("c3f24fb8", 8, 0), "LIFE": ("f005be66", 10, 0), "SP80": ("bb4a99b5", 8, 0),
              "TICT": ("e8df1757", 4, 0), "WA30": ("14a185d9", 7, 0), "TN36": ("0da75640", 3, 0),
              "GRIL": ("915e0601", 4, 0), "SEQN": ("b5dda8ec", 5, 0),
              "SMLP": ("1e11472a", 3, 0), "HANO": ("f768bac6", 3, 0), "RE86": ("8e820aa6", 3, 0),
              "MIND": ("860835b1", 2, 0)}
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
ref, expected_passed, expected_skipped = references[args.game]
archive = bench / "docs/diagnostics" / ("sic-" + args.game.lower() + "-" + ref) / "recus.zip"
oracle = json.loads((archive.parent / "banc.json").read_bytes())
assert hashlib.sha256(archive.read_bytes()).hexdigest() == oracle["archiveSHA256"]
with ZipFile(archive) as z:
    expected = json.loads(z.read(("TICT/" if args.game == "TICT" else "") + ref + ".json"))
# The partial cell-placement selector is outside the engine when only SP80/4 is assembled.
if args.game == "SP80":
    path = "src/logos-engine/v6-cell-placement.ts"
    def cell_blob(ref):
        return subprocess.check_output(["git", "-C", str(engine), "rev-parse", ref + ":" + path]).strip()
    if cell_blob(revision) == cell_blob("d0e7527c"):
        expected = expected[:5]
        expected_passed, expected_skipped = 6, 2
    else:
        assert cell_blob(revision) == cell_blob(ref)
observed = json.loads((out / (revision[:8] + ".json")).read_bytes())
assert observed == expected, args.game + " native sessions changed"
log = (out / (revision[:8] + ".log")).read_text(encoding="utf8")
passed, skipped = (int(re.search(r"(?m)^. " + n + r" (\d+)\s*$", log)[1]) for n in ("pass", "skipped"))
assert (passed, skipped) == (expected_passed, expected_skipped)
(out / "resultats.json").write_text(json.dumps({"source": revision, "individualProof": ref, "sessions": len(observed),
    "passed": passed, "skipped": skipped, "individualArchiveSHA256": oracle["archiveSHA256"]}, indent=2) + "\n",
    encoding="utf8", newline="\n")
