"""Replay a catalogue witness with its sealed controls and the real game on a given revision."""
import argparse
import io
import os
from pathlib import Path
import runpy
import subprocess
from zipfile import ZipFile

common = runpy.run_path(str(Path(__file__).with_name("test-sic-coexistence.py")))
bench, git, mount = (common[k] for k in ("BENCH", "git", "mount"))
cases = {
    "GARE": ("c3f24fb80a39604bf99686f7c0725b175c2628dd", "gare-framed-lines", "sic-observe-gare-framed",
             "native-campaigns-v52/final/gare-public-trace"),
    "LIFE": ("f005be662b0e4b556a0cea3d246381cd98eec7ae", "life-three-lines", "sic-observe-life-material",
             "native-campaigns-v50/life-public-trace-final"),
}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("revision")
parser.add_argument("--game", choices=cases, default="GARE")
parser.add_argument("output", type=Path)
parser.add_argument("--game-root", required=True, type=Path)
parser.add_argument("--node", default="node")
args = parser.parse_args()
proof, suite, observer, packets = cases[args.game]
test = "tests/sic-" + suite + ".test.ts"
name = "SIC_" + args.game + "_"
revision = git("rev-parse", "--verify", args.revision + "^{commit}").decode().strip()
git("-C", str(args.game_root.resolve()), "diff", "--exit-code", revision, "--", "public/python")
out = args.output.resolve()
engine = out / revision[:8]
engine.mkdir(parents=True)
for rev, paths in [(revision, ["src", "package.json", "reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto",
                               "reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy"]),
                   (proof, ["scripts/sic-study-source-games.mjs", test, "tests/fixtures/sic-" + args.game.lower() + "-alternate-returns.json.gz",
                            "docs/migration/" + packets + ".json.gz"])]:
    with ZipFile(io.BytesIO(git("archive", "--format=zip", rev, *paths))) as archive:
        archive.extractall(engine)
mount(args.game_root.resolve() / "public", engine / "public")
env = {**os.environ, name + "GAME_ROOT": str(engine), name + "ENGINE_ROOT": str(engine),
       name + "RECEIPT": str(out / (revision[:8] + ".json"))}
options = []
if args.game == "LIFE" and revision != proof:
    options = ["--test-name-pattern=^(LIFE|2 |68 |69 )"]
with (out / (revision[:8] + ".log")).open("wb") as log:
    subprocess.run([args.node, "--import", (bench / "scripts" / (observer + ".mjs")).as_uri(), "--test", *options, test],
                   cwd=engine, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
