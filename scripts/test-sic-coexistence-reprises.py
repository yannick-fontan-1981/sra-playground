"""Exercise the FOGW, LS19, VALV and STCK additions on a prepared combined engine."""
import argparse
import hashlib
import json
import os
import runpy
import subprocess
from pathlib import Path
from zipfile import ZipFile

common = runpy.run_path(str(Path(__file__).with_name("test-sic-coexistence.py")))
BENCH, git, mount, copy_git = (common[k] for k in ("BENCH", "git", "mount", "copy_git"))
DOCS = BENCH / "docs/diagnostics"
LAB = "experiments/sic-agenda-offres"


def archived(folder, filename):
    with ZipFile(DOCS / folder / "recus.zip") as archive:
        return json.loads(archive.read(filename))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("engine", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--node", default="node")
    args = p.parse_args()
    engine, out = args.engine.resolve(), args.output.resolve()
    sha = git("-C", str(engine), "rev-parse", "HEAD").decode().strip()
    assert sha in (common["NEXT_ASSEMBLY"], common["TWENTY_FIVE"], common["THIRTY_FIVE"])
    git("-C", str(engine), "diff", "--exit-code", "HEAD", "--", "src", "public", "scripts", "reference")
    overlay = out / "overlay"
    overlay.mkdir(parents=True)
    for directory in ("src", "scripts", "public", "reference"):
        mount(engine / directory, overlay / directory)
    copy_git(sha, ["package.json"], overlay)
    env = {**os.environ}
    for name in ("RECEIVER", "VALV", "STCK"):
        env["SIC_" + name + "_GAME_ROOT"] = str(engine)

    def run(name, *argv):
        with (out / (name + ".log")).open("wb") as log:
            subprocess.run([args.node, *argv], cwd=overlay, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)

    fogw = "tests/sic-reception-fogw-line61.test.ts"
    stck = "tests/sic-stck-program-lines.test.ts"
    valv = "tests/sic-valv-field-service-lines.test.ts"
    copy_git("21fd159e", [fogw, "tests/fixtures/sic-reception-fogw-public.json.gz"], overlay)
    copy_git("39e32b1f", [stck, "docs/migration/native-campaigns-v39/diagnostics/stck-six-level-attempt-public.json.gz"], overlay)
    copy_git("495ea148", [valv, "docs/migration/native-campaigns-v51/valv-public-trace.json.gz"], overlay)
    results = {}
    for name, test, probe, folder, file in [
        ("RECEIVER", fogw, "sic-observe-fogw-61.mjs", "sic-fogw-ligne-61-correctif", "21fd159e.json"),
        ("STCK", stck, "sic-observe-stck-offers.mjs", "sic-stck-lignes-52-57-58", "39e32b1f.json"),
    ]:
        dest = out / (name + ".json")
        env["SIC_" + name + "_SOURCE"] = str(engine)
        env["SIC_" + name + "_RECEIPT"] = str(dest)
        run(name, "--import", (BENCH / "scripts" / probe).as_uri(), test)
        sessions = json.loads(dest.read_bytes())
        assert sessions == archived(folder, file), name + " changed in the combined engine"
        results[name] = {"sessions": len(sessions), "matched": file}

    run("VALV", valv)
    for flag, arm, directory, file in [
        ("--retraits", "withdrawals", "sic-valv-lignes-44-47-48", "699ac89e.json"),
        ("--frontiere", "boundary", "sic-valv-495ea148", "495ea148.json"),
    ]:
        dest = out / ("valv-" + arm + ".json")
        run("valv-" + arm, str(BENCH / "scripts/sic-capture-valv-offers.mjs"), sha, str(dest), flag)
        observed = json.loads(dest.read_bytes())
        expected = archived(directory, file)
        assert observed["source"] == sha and observed["nominal"] == expected["nominal"]
        assert observed[arm] == expected[arm], arm
        results[arm] = {"matched": file}

    folder = LAB + "/continuite-92"
    paths = git("ls-tree", "-r", "--name-only", "b56ea752", folder).decode().splitlines()
    copy_git("b56ea752", paths + [LAB + "/frontiere-22-23/game.mjs", "tests/fixtures/sic-view-edge-ls19-l1.json.gz"], overlay)
    expected = archived("sic-ls19-ligne-92", "qualification.json")["parite"]["gel"]
    results["LS19"] = {}
    for name, digest in expected.items():
        dest = out / ("ls19-" + name + ".json")
        run("ls19-" + name, folder + "/operateur.mjs", "--source", engine.as_uri() + "/", "--condition", name,
            "--pyodide", str(engine / "public/vendor/pyodide"), "--recu", str(dest))
        # The sealed operator hashes compact JSON, without the producer's final newline.
        measured = hashlib.sha256(dest.read_bytes().rstrip(b"\r\n")).hexdigest()
        assert measured == digest, name
        results["LS19"][name] = measured
    (out / "resultats.json").write_text(json.dumps({"source": sha, "witnesses": results}, indent=2) + "\n",
                                         encoding="utf8", newline="\n")


if __name__ == "__main__":
    main()
