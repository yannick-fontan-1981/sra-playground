"""Compare a pinned engine to the independently qualified SK48 and ONDE decisions."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
from zipfile import ZipFile

common = runpy.run_path(str(Path(__file__).with_name("test-sic-coexistence.py")))
BENCH, git, mount, copy_git = (common[k] for k in ("BENCH", "git", "mount", "copy_git"))
LAB = "experiments/sic-agenda-offres/"
SK = "4946cf0297734b9464fc52256af6fb27846f3bad"
ONDE = "75aa3829ddf9d7e4561c6c92297ad1bb8d2ac5ef"


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("game", choices=("SK48", "ONDE"))
    p.add_argument("engine", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--node", default="node")
    p.add_argument("--pyodide", type=Path, default=BENCH / "public/vendor/pyodide")
    args = p.parse_args()
    engine, out = args.engine.resolve(), args.output.resolve()
    sha = git("-C", str(engine), "rev-parse", "HEAD").decode().strip()
    git("-C", str(engine), "diff", "--exit-code", "HEAD", "--", "src", "public", "reference", "scripts")
    sk = args.game == "SK48"
    revision, folder, archive_name = ((SK, "revision-96", "sic-sk48-amont-4946cf02") if sk else
                                      (ONDE, "onde-27-29", "sic-onde-75aa3829"))
    overlay = out / "harness"
    overlay.mkdir(parents=True)
    for name in ("src", "public", "scripts", "reference"):
        mount(engine / name, overlay / name)
    paths = git("ls-tree", "-r", "--name-only", revision, LAB + folder).decode().splitlines()
    copy_git(revision, paths + ["package.json", LAB + "evaluateur-jeu.mjs", LAB + "frontiere-22-23/game.mjs"], overlay)
    vendor = str(args.pyodide.resolve())
    root = BENCH / "docs/diagnostics" / archive_name
    expected_hash = json.loads((root / "banc.json").read_bytes())["archiveSHA256"]
    assert hashlib.sha256((root / "recus.zip").read_bytes()).hexdigest() == expected_hash
    checked = []

    def run(name, argv):
        with (out / (name + ".log")).open("wb") as log:
            subprocess.run([args.node, *argv], cwd=overlay, stdout=log, stderr=subprocess.STDOUT, check=True)

    with ZipFile(root / "recus.zip") as archive:
        if sk:
            tests = ["tests/sic-rooted-station-order.test.ts", "tests/v5-piercing-native.test.ts"]
            copy_git(SK, tests + ["tests/fixtures/v5-piercing-reference.json.gz"], overlay)
            run("projection", ["--test", "--test-concurrency=1", *tests])
            cases = [(name, name.replace(".fiche.json", ".json")) for name in archive.namelist()
                     if "-enfant/" in name and name.endswith(".fiche.json")]
        else:
            cases = [(None if name == "catalogue16" else name, "candidat-" + name + ".json") for name in
                     ("historique", "autre-sonde", "autre-canal", "preimage", "ordre-initial", "palette", "budget", "catalogue16")]
        for card, reference in cases:
            stem = reference.replace("/", "-")[:-5]
            dest = out / (stem + ".json")
            if sk or card is None:
                file = out / (stem + ".fiche.json")
                file.write_bytes(archive.read(card if sk else "catalogue-16.fiche.json"))
            else:
                file = overlay / LAB / folder / "public" / (card + ".json")
            argv = [LAB + folder + "/operateur.mjs", "--pyodide", vendor, "--fiche", str(file), "--recu", str(dest)]
            if sk:
                argv.extend(["--source", engine.as_uri() + "/"])
            run(stem, argv)
            assert json.loads(dest.read_bytes()) == json.loads(archive.read(reference)), stem
            checked.append(reference)
    assert len(checked) == (12 if sk else 8)
    (out / "resultats.json").write_text(json.dumps({"source": sha, "witnessSource": revision, "archiveSHA256": expected_hash,
                                                    "matched": checked}, indent=2) + "\n", encoding="utf8", newline="\n")


if __name__ == "__main__":
    main()
