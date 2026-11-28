"""Apply the published public STCK and VALV operator challenges to a pinned combined engine."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy
import subprocess

common = runpy.run_path(str(Path(__file__).with_name("test-sic-coexistence.py")))
BENCH, ASSEMBLY, git, copy_git = (common[k] for k in ("BENCH", "NEXT_ASSEMBLY", "git", "copy_git"))
LAB = "experiments/symbolic-situations/"
STCK = "39e32b1f0218d53f41c27b7140c925e8e929e705"
VALV = "495ea14890c1d0cd69de356d40a3b243e0b86f6d"
STCK_TEST = "fc6373a5298f603692c77c8aade2cecf6f807e2e"
VALV_TEST = "7448e989373ef7e02808c5142451b21f61f18570"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--pyodide", type=Path, required=True)
    parser.add_argument("--node", default="node")
    parser.add_argument("--candidate", choices=(ASSEMBLY, common["TWENTY_FIVE"]), default=ASSEMBLY)
    args = parser.parse_args()
    out, vendor = args.output.resolve(), str(args.pyodide.resolve())
    out.mkdir(parents=True)
    summaries = {}
    for name, candidate, test, lab in [
        ("STCK", STCK, STCK_TEST, "stck-lignes-52-57-58"),
        ("VALV", VALV, VALV_TEST, "valv-ligne-48-provenance"),
    ]:
        previous = None
        for revision in (candidate, args.candidate):
            dest = out / (name + "-" + revision[:8])
            scripts = dest / LAB / lab
            paths = git("ls-tree", "-r", "--name-only", test, LAB + lab).decode().splitlines()
            if name == "VALV":
                paths += [LAB + "valv-lignes-44-47-48/" + f for f in ["commun.mjs", "moteur.mjs"]]
            copy_git(test, [p for p in paths if p.endswith(".mjs")] +
                     [LAB + "ls19-ligne-90/montage.mjs", LAB + "ls19-ligne-90/worker.mjs", LAB + "g50t-ligne-23/dialogue.mjs"], dest)
            # Only bind the standalone operator runner to the additional revision; keep the source, boards and checks intact.
            if revision == args.candidate:
                entry = scripts / ("commun.mjs" if name == "STCK" else "qualifier.mjs")
                source = entry.read_text(encoding="utf8")
                assert source.count(candidate) == 1
                entry.write_text(source.replace(candidate, revision), encoding="utf8", newline="\n")

            def run(module, *argv):
                with (dest / (module + ".log")).open("wb") as log:
                    subprocess.run([args.node, str(scripts / (module + ".mjs")), *map(str, argv)], cwd=BENCH,
                                   stdout=log, stderr=subprocess.STDOUT, check=True)

            if name == "STCK":
                run("jeu", vendor, dest / "jeu.json", dest / "observations.gz")
                run("qualifier", revision, "ordre", dest / "ordre.json", dest)
                files = ["jeu.json", "ordre.json"]
            else:
                run("qualifier", revision, vendor, dest / "provenance.json")
                files = ["provenance.json"]
            rows = {}
            for file in files:
                data = json.loads((dest / file).read_bytes())
                assert data.pop("sha") == revision
                rows[file] = data
            if previous is not None:
                assert rows == previous, name + " operator receipts changed"
            previous = rows
            hashes = {f: hashlib.sha256((dest / f).read_bytes()).hexdigest() for f in files}
            summaries[name + "-" + revision[:8]] = {"source": revision, "operator": test, "receipts": hashes}
    (out / "resultats.json").write_text(json.dumps(summaries, indent=2) + "\n", encoding="utf8", newline="\n")


if __name__ == "__main__":
    main()
