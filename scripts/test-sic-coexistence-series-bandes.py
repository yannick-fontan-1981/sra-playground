"""Replay a pinned CONN or VC33 suite on another prepared engine and compare every recorded session."""
import argparse
import json
import os
from pathlib import Path
import runpy
import subprocess
from zipfile import ZipFile

common = runpy.run_path(str(Path(__file__).with_name("test-sic-coexistence.py")))
BENCH, git, mount, copy_git = (common[k] for k in ("BENCH", "git", "mount", "copy_git"))
tests = {
    "CONN": ("f8607d2a", "sic-conn-series-lines", "sic-observe-conn-series",
             ["tests/fixtures/sic-conn-alternate-returns.json.gz",
              "docs/migration/lot3i-evidence/final/conn-recurrent-series-session/conn-public-trace.json.gz"]),
    "VC33": ("f489393b", "sic-vc33-line3", "sic-observe-vc33-bands", ["tests/fixtures/sic-vc33-line3.json.gz"]),
}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("game", choices=tests)
    p.add_argument("engine", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--node", default="node")
    args = p.parse_args()
    engine, out = args.engine.resolve(), args.output.resolve()
    source = git("-C", str(engine), "rev-parse", "HEAD").decode().strip()
    git("-C", str(engine), "diff", "--exit-code", "HEAD", "--", "src", "scripts", "public", "reference")
    revision, suite, hook, fixtures = tests[args.game]
    overlay = out / "harness"
    overlay.mkdir(parents=True)
    for folder in ("src", "scripts", "public", "reference"):
        mount(engine / folder, overlay / folder)
    test = "tests/" + suite + ".test.ts"
    copy_git(revision, ["package.json", test, *fixtures], overlay)
    name = "SIC_" + args.game + "_"
    env = {**os.environ, name + "GAME_ROOT": str(engine), name + "RECEIPT": str(out / "sessions.json")}
    env[name + ("SOURCE" if args.game == "CONN" else "ENGINE_ROOT")] = str(engine)
    with (out / "tests.log").open("wb") as log:
        subprocess.run([args.node, "--import", (BENCH / "scripts" / (hook + ".mjs")).as_uri(), test],
                       cwd=overlay, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    archive = BENCH / "docs/diagnostics" / ("sic-" + args.game.lower() + "-" + revision) / "recus.zip"
    with ZipFile(archive) as z:
        sessions = json.loads((out / "sessions.json").read_bytes())
        assert sessions == json.loads(z.read(revision + ".json")), args.game + " sessions changed"
    (out / "resultats.json").write_text(json.dumps({"source": source, "game": args.game, "oracle": revision,
                                                    "sessions": len(sessions)}) + "\n", encoding="utf8", newline="\n")


if __name__ == "__main__":
    main()
