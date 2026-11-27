"""Replay both ZIPP epochs and the three DICO opening orders on a qualified combined engine."""
import argparse
import json
from pathlib import Path
import re
import runpy
import subprocess
from zipfile import ZipFile

common = runpy.run_path(str(Path(__file__).with_name("test-sic-coexistence.py")))
BENCH, git, copy_git = (common[name] for name in ("BENCH", "git", "copy_git"))
LAB = "experiments/sic-agenda-offres"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("engine", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--node", default="node")
    args = parser.parse_args()
    engine, out = args.engine.resolve(), args.output.resolve()
    source = git("-C", str(engine), "rev-parse", "HEAD").decode().strip()
    assert source in (common["TEN_LINES"], common["NEXT_ASSEMBLY"])
    git("-C", str(engine), "diff", "--exit-code", "HEAD", "--", "src", "scripts", "public", "reference")
    out.mkdir(parents=True, exist_ok=False)
    with ZipFile(BENCH / "docs/diagnostics/sic-zipp-ligne-1/recus.zip") as archive:
        for arm in ("native", "previous-epoch"):
            target = out / ("zipp-" + arm + ".json")
            subprocess.run([args.node, str(BENCH / "scripts/sic-capture-zipp-line1.mjs"), str(engine),
                            arm, str(target), "--fixed-clock"], check=True)
            observed = json.loads(target.read_bytes())
            expected = json.loads(archive.read("fixe-" + arm + "-16f3c5e8.json"))
            assert observed.pop("source") == source and expected.pop("source").startswith("16f3c5e8")
            if observed != expected:
                raise ValueError("ZIPP " + arm + " differs in " + str([key for key in observed if observed[key] != expected.get(key)]))
            print("ZIPP", arm, len(observed["commands"]), "tickets conformes", flush=True)

    files = ["evaluateur-jeu.mjs", "frontiere-22-23/game.mjs", "ouverture-98/jeu.mjs", "ouverture-98/sonde.mjs"]
    copy_git("e2178163", [LAB + "/" + f for f in files], out)
    root = engine.as_uri() + "/"
    vendor = str(engine / "public/vendor/pyodide")
    with ZipFile(BENCH / "docs/diagnostics/sic-dico-ligne-98/recus.zip") as archive:
        for mode, expected_name in (("nominal", "e2178163"), ("inverse", "alternatif"), ("permutation", None)):
            if mode == "permutation":
                # Reuse the operator's sealed two-maxima permutation inside the temporary observation harness.
                montage = git("show", "71b861a9:experiments/symbolic-situations/dico-ligne-98/montage.mjs").decode()
                select = re.search(r"const alternate='([^']+)';", montage)[1]
                probe = out / LAB / "ouverture-98/sonde.mjs"
                original = probe.read_text(encoding="utf8")
                reverse = "opening = selectOpeningOffer(offers.slice().reverse());"
                assert original.count(reverse) == 1
                probe.write_text(original.replace(reverse, select), encoding="utf8")
            target = out / ("dico-" + mode + ".json")
            argv = [args.node, str(out / LAB / "ouverture-98/jeu.mjs"), vendor, root, "DICO", "active"]
            with target.open("wb") as report:
                subprocess.run(argv + ([] if mode == "nominal" else ["autre-egalite"]), stdout=report, check=True)
            rows = json.loads(target.read_bytes())
            if expected_name:
                assert rows == json.loads(archive.read("classement-" + expected_name + ".json"))
            if mode == "permutation":
                nominal = json.loads((out / "dico-nominal.json").read_bytes())[0]
                assert rows[0]["slate"] == nominal["slate"] and rows[0]["ticket"]["data"] == {"x": 32, "y": 35}
                assert rows[0]["guard"]["admitted"] and rows[0]["returned"]["completed"] == 0
            print("DICO", mode, rows[0]["ticket"]["data"], rows[0]["returned"]["completed"], flush=True)


if __name__ == "__main__":
    main()
