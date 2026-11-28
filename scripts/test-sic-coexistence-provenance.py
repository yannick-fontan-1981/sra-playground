"""Replay the KEYD or KLOT provenance controls on a shared engine."""

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
from zipfile import ZipFile


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("game", choices=("KEYD", "KLOT", "SC25", "SERI"))
parser.add_argument("engine", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--node", default="node")
args = parser.parse_args()
bench = Path(__file__).resolve().parent.parent
engine, out = args.engine.resolve(), args.output.resolve()


def git(*command):
    return subprocess.check_output(["git", "-C", str(engine), *command]).decode().strip()


def run(*command):
    subprocess.run(command, cwd=bench, check=True)


revision = git("rev-parse", "HEAD")
assert not git("diff", "--name-only", revision, "--", "src", "public/python", "reference")
out.mkdir(parents=True)
proof = {"KEYD": ("keyd-provenance", "51d983a7"), "KLOT": ("klot-provenance", "37983796"),
         "SC25": ("sc25", "88e8abe8"), "SERI": ("seri-provenance", "eb5611b3")}[args.game]
directory = bench / "docs/diagnostics" / f"sic-{proof[0]}-{proof[1]}"
archive = directory / "recus.zip"
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
assert digest == json.loads((directory / "banc.json").read_bytes())["archiveSHA256"]


def catalogue(game, target, *options):
    run(sys.executable, "scripts/test-sic-catalogue-lines.py", revision, str(out / target), "--game", game,
        "--game-root", str(engine), "--node", args.node, *options)


with ZipFile(archive) as oracle:
    if args.game == "KEYD":
        live = out / (revision[:8] + ".json")
        run(args.node, "scripts/sic-qualify-keyd-inventory.mjs", str(engine), str(live), "--both-pairs")
        expected = json.loads(oracle.read("51d983a7.json"))
        actual = json.loads(live.read_bytes())
        assert actual.pop("revision") == revision and expected.pop("revision").startswith(proof[1])
        assert actual == expected, "KEYD's nominal or controlled decisions changed"
        catalogue("SKBN", "SKBN")
        assert json.loads((out / "SKBN" / (revision[:8] + ".json")).read_bytes()) == json.loads(oracle.read("SKBN/51d983a7.json"))
        sessions = 4 + 2
    elif args.game == "KLOT":
        catalogue("KLOT", "nominal")
        catalogue("KLOT", "attribution", "--wrong-receiver", "--corrected-receiver")
        for kind in ("nominal", "attribution"):
            actual = json.loads((out / kind / (revision[:8] + ".json")).read_bytes())
            assert actual == json.loads(oracle.read(kind + "/37983796.json")), "KLOT's physical or provenance receipt changed"
        sessions = 2 + 2
    elif args.game == "SERI":
        catalogue("SERI", "nominal")
        catalogue("SERI", "duplicate", "--duplicate-completion", "--corrected-duplicates")
        sessions = 0
        for kind in ("nominal", "duplicate"):
            actual = json.loads((out / kind / (revision[:8] + ".json")).read_bytes())
            assert actual == json.loads(oracle.read(kind + "/eb5611b3.json")), "SERI's physical or provenance receipt changed"
            sessions += len(actual)
    else:
        start = "reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/"
        test = "tests/sic-sc25-motif-transfer.test.ts"
        fixture = "tests/fixtures/v6-motif-access-reference.json"
        material = subprocess.check_output(["git", "archive", "--format=zip", proof[1], "package.json", test, fixture,
                                            start + "laya_proto", start + "morphology_policy"], cwd=bench)
        with ZipFile(io.BytesIO(material)) as sources:
            sources.extractall(out)
        env = {**os.environ, "SIC_SC25_TRANSFER_ENGINE_ROOT": str(engine)}
        with (out / "qualification.log").open("xb") as log:
            subprocess.run([args.node, "--test", test], cwd=out, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
        sessions = 2

assert git("rev-parse", "HEAD") == revision
assert not git("diff", "--name-only", revision, "--", "src", "public/python", "reference")
receipt = {"source": revision, "reference": proof[1], "sessions": sessions, "archiveSHA256": digest}
(out / "resultats.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf8", newline="\n")
