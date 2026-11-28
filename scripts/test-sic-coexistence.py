"""Run separately qualified witnesses against the combined engine without adding them to its source tree."""
import argparse
import json
import os
import re
import shutil
import subprocess
import zipfile
from pathlib import Path

BENCH = Path(__file__).resolve().parents[1]
ASSEMBLY = "1afdede0dcdd4a5bb2c7b284b1ead20e1782fe0d"
TEN_LINES = "8a424aab6ca2e2f6b902cc4b9c89313ed6947b74"
NEXT_ASSEMBLY = "f27eb1c055d44e852fb90a25c542d0a466eb6c16"
TWENTY_FIVE = "278d5b357d3e3328a32697fe402f3fa9d957d547"
FRONTIER = "experiments/sic-agenda-offres"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=BENCH)


def mount(target, at):
    if os.name == "nt":
        subprocess.run(["powershell", "-NoProfile", "-Command",
                        "New-Item -ItemType Junction -Path $env:SIC_MOUNT_AT -Target $env:SIC_MOUNT_FROM | Out-Null"],
                       env={**os.environ, "SIC_MOUNT_AT": str(at), "SIC_MOUNT_FROM": str(target)}, check=True)
    else:
        at.symlink_to(target, target_is_directory=True)


def copy_git(revision, paths, directory):
    for path in paths:
        target = directory / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(git("show", revision + ":" + path))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("engine", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--node", default="node")
    args = p.parse_args()
    engine, out = args.engine.resolve(), args.output.resolve()
    source_sha = git("-C", str(engine), "rev-parse", "HEAD").decode().strip()
    assert source_sha in (ASSEMBLY, TEN_LINES, NEXT_ASSEMBLY, TWENTY_FIVE)
    git("-C", str(engine), "diff", "--exit-code", "HEAD", "--", "src", "scripts", "reference", "public", "tests")
    overlay = out / "overlay"
    overlay.mkdir(parents=True)
    for folder in ("src", "scripts", "public", "reference"):
        mount(engine / folder, overlay / folder)
    shutil.copytree(engine / "tests", overlay / "tests")
    copy_git(ASSEMBLY, ["package.json"], overlay)
    tests = []
    for source in ("a5a90c33", "14db9cd8", "7bf3c85a", "0540f124"):
        paths = git("diff", "--name-only", "d0e7527c", source, "--", "tests").decode().splitlines()
        copy_git(source, paths, overlay)
        tests.extend(path for path in paths if path.endswith(".test.ts"))
    tests.extend("tests/" + name + ".test.ts" for name in
                 ("v6-view-frontier", "v6-caller-integration", "v6-point-display", "v6-goal-attention", "v6-control-attention-reference"))
    if source_sha in (TEN_LINES, NEXT_ASSEMBLY, TWENTY_FIVE):
        for revision in ("16f3c5e8", "1a1cc965", "1aaafe36"):
            paths = git("diff", "--name-only", "d0e7527c", revision, "--", "tests").decode().splitlines()
            for path in paths:
                if path in tests:
                    # Preserve both branches' assertions when their tests share a filename.
                    alias = "tests/" + revision + "-" + Path(path).name
                    (overlay / alias).write_bytes(git("show", revision + ":" + path))
                    tests.append(alias)
                else:
                    copy_git(revision, [path], overlay)
                    if path.endswith(".test.ts"):
                        tests.append(path)
    fogw = "docs/diagnostics/sic-reception-transfer-20261127/fogw-arrival-boundary-a10dde47.json.gz"
    copy_git("a5a90c33", [fogw], overlay)
    for source, folder in [("ba04161f", "frontiere-22-23"), ("ba04161f", "essai-local-23"), ("c0b9f402", "dico-87")]:
        copy_git(source, git("ls-tree", "-r", "--name-only", source, FRONTIER + "/" + folder).decode().splitlines(), overlay)
    env = {**os.environ, **{key: str(engine) for key in ("SIC_LS19_GAME_ROOT", "SIC_INFORMATION_GAME_ROOT", "SIC_POINT_GAME_ROOT",
                                                        "SIC_TARGET_GAME_ROOT", "SIC_LINKED_GAME_ROOT", "SIC_CAVITY_GAME_ROOT")}}
    def run(name, argv):
        with (out / name).open("wb") as log, (out / (name + ".stderr")).open("wb") as errors:
            subprocess.run([args.node, *argv], cwd=overlay, env=env, stdout=log, stderr=errors, check=True)

    run("suites.log", ["--test", "--test-concurrency=1", *sorted(set(tests))])
    suite = (out / "suites.log").read_text(encoding="utf8")
    passes = int(re.search(r"(?m)^. pass (\d+)", suite)[1])
    assert re.search(r"(?m)^. tests " + str(passes) + r"\s*$", suite) and re.search(r"(?m)^. skipped 0\s*$", suite)
    root = engine.as_uri() + "/"
    vendor = str(engine / "public/vendor/pyodide")
    run("ligne23.json", [FRONTIER + "/essai-local-23/mesurer.mjs", root, "dev", vendor])
    with zipfile.ZipFile(BENCH / "docs/diagnostics/sic-g50t-ligne-23/recus.zip") as archive:
        expected = json.loads(archive.read("controle.json"))["nativeSha256"]
    assert json.loads((out / "ligne23.json").read_bytes())["sha256"] == expected
    with zipfile.ZipFile(BENCH / "docs/diagnostics/sic-dico-ligne-87/recus.zip") as archive:
        dico = json.loads(archive.read("controle-c0b9f402.json"))
    for mode in ("catalogue", "curieux", "autre-optimum"):
        alt = mode == "autre-optimum"
        args87 = [FRONTIER + "/dico-87/parcours.mjs", "catalogue" if alt else mode, vendor, root]
        run(mode + ".json", args87 + (["autre-optimum"] if alt else []))
        result = json.loads((out / (mode + ".json")).read_bytes())
        if alt:
            assert result["rows"][3] == dico["alternate"]
        else:
            assert result == dico["candidate"][mode]
    print(json.dumps({"source": source_sha, "suites": sorted(set(tests)), "passed": passes, "line23": expected,
                      "line87": ["catalogue", "curieux", "autre-optimum"]}))


if __name__ == "__main__":
    main()
