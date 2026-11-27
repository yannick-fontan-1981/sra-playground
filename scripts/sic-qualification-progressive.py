"""Prepare SIC-107, compare archived shards, or capture one local wave when its slot opens."""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile

from sic_qualification_reference import (
    ARCHIVE, AUDIT, DIRECTORY, FROZEN, REFERENCES, ROOT, RUN, SOURCE, STRICT_SHA, WORKFLOW,
    check, frozen_campaign, git, inventory, sha, strict_witnesses, tree, verified_campaign,
)

DEFAULT_A = ROOT / "artifacts/sic-comparison/run-VVq4CG"
CAPTURE = ROOT / "scripts/check-sic-chronological.mjs"
COMPARATOR = ROOT / "scripts/compare-sic-decisions.mjs"
CONDITIONS = ["public/python", "reference", "src/games", "src/runtime/native-game-dispatcher.ts",
              "scripts/python-runtime-assets.json", "scripts/prepare-python.mjs", "scripts/sic-replay-watchdog.mjs",
              "scripts/sic-replay-budgets.mjs", REFERENCES, "docs/architecture/sic-v8-level6-campaign-7bb9f152.json",
              AUDIT["BASELINE"]]


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


def file_sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def pick(catalog, selection):
    if selection == "all":
        return [r["game"] for r in catalog]
    if selection in {"initial", "appelants", "temoins", "reste"}:
        return [r["game"] for r in catalog if r["wave"] == selection]
    games = selection.upper().split(",")
    check(len(games) == len(set(games)) and set(games) <= {r["game"] for r in catalog}, "Invalid or duplicate games")
    return games


def receipt_difference(a, b):
    # An effect only reports the fields exported by the historical runner. A
    # prefix hash can detect a hidden board difference at the end of a level.
    names = ("action", "coordinates", "changedPixels", "bounds", "frameCount", "levelsCompleted",
             "strategy", "family", "situation", "evidenceCount")
    if "effects" not in a or "effects" not in b:
        # A victory-only archive can attest just its recorded outcome(s). Never
        # interpret an unavailable action stream as an empty one.
        for left in a.get("levelStats", []):
            level = left["level"]
            right = next((r for r in b.get("levelStats", []) if r["level"] == level), {})
            for k in ("won", "actions", "budget", "prefixHash"):
                if k in left and (k != "prefixHash" or k in right) and left[k] != right.get(k):
                    return {"level": level, "field": k, "before": left[k], "after": right.get(k)}
        for k in ("levels", "target", "status", "reason", "actions", "trace"):
            if k in a and a[k] != b.get(k):
                return {"field": k, "before": a[k], "after": b.get(k)}
        return None
    ai = bi = 0
    for level, left in enumerate(a["levelStats"], 1):
        right = next((r for r in b.get("levelStats", []) if r["level"] == level), None)
        if right is None:
            return {"level": level, "field": "levelStats", "after": "missing"}
        le = a["effects"][ai:ai + left["actions"]]
        re = b.get("effects", [])[bi:bi + right["actions"]]
        for turn, (x, y) in enumerate(zip(le, re), 1):
            if x != y:
                for i, name in enumerate(names):
                    if x[i:i+1] != y[i:i+1]:
                        return {"level": level, "turn": turn, "field": name,
                                "before": x[i] if i < len(x) else {"missing": True},
                                "after": y[i] if i < len(y) else {"missing": True}}
                return {"level": level, "turn": turn, "field": "effect", "before": x, "after": y}
        if len(le) != len(re):
            return {"level": level, "turn": min(len(le), len(re)) + 1, "field": "recordedEffects",
                    "before": len(le), "after": len(re)}
        for k in ("won", "actions", "budget", "prefixHash"):
            if left.get(k) != right.get(k):
                return {"level": level, "field": k, "before": left.get(k), "after": right.get(k)}
        ai += len(le)
        bi += len(re)
    for k in ("target", "levels", "authority", "actions", "status", "reason", "recoveries", "trace",
              "usage", "decisions", "resumes", "series", "pathKinds"):
        if a.get(k) != b.get(k):
            return {"field": k, "before": a.get(k), "after": b.get(k)}
    return None


def checkout(path, source):
    check(git("rev-parse", "HEAD", cwd=path).decode().strip() == source, f"Wrong checkout SHA: {path}")
    check(not git("status", "--porcelain", "--untracked-files=normal", cwd=path), f"Dirty checkout: {path}")


def capture(path, source, code, label, directory, node):
    checkout(path, source)
    subprocess.run([node, "scripts/prepare-python.mjs"], cwd=path, check=True, stdout=subprocess.DEVNULL)
    trace, receipt = directory / f"{label}.jsonl", directory / f"{label}.receipt"
    args = [node, str(CAPTURE), code, "auto", str(receipt), "1", "sic"]
    env = {**os.environ, "SIC_REPLAY_REFERENCES": str(ROOT / REFERENCES), "SIC_DECISION_TRACE": str(trace)}
    write(directory / f"{label}.source.json", {"source": source, "tree": tree(source), "cwd": str(path),
          "argv": args, "references": env["SIC_REPLAY_REFERENCES"], "trace": str(trace), "startLevel": 1, "seed": 0})
    with (directory / f"{label}.log").open("wb") as log:
        subprocess.run(args, cwd=path, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    checkout(path, source)
    row = json.loads(receipt.read_bytes())
    check(row.get("code") == code and row.get("status") != "harness_error",
          f"{code} capture error. Inspect {receipt} and rerun to retry")
    return row, trace


def atomic_record(path, record):
    # A private complete file becomes visible in one operation. An interruption
    # never produces a completion marker. Relinking an existing result is forbidden.
    fd, filename = tempfile.mkstemp(dir=path.parent)
    os.close(fd)
    temp = Path(filename)
    try:
        write(temp, record)
        os.link(temp, path)
    finally:
        temp.unlink()


def protocol():
    files = [CAPTURE, COMPARATOR, Path(__file__), ROOT / "scripts/sic_qualification_reference.py",
             ROOT / "scripts/audit-sic-107-receipts.py", ROOT / "scripts/prepare-sic-107-rerun.py", ROOT / "scripts/sic-decision-trace.mjs",
             ROOT / "scripts/sic-replay-watchdog.mjs", ROOT / "scripts/sic-replay-budgets.mjs", ROOT / REFERENCES]
    return {f.name: file_sha(f) for f in files}


def qualify(opts, catalog, rows, counts, budgets):
    candidate = opts.candidate
    check(len(candidate) == 40 and git("rev-parse", candidate + "^{commit}").decode().strip() == candidate,
          "Supply an exact candidate commit")
    if candidate != SOURCE:
        subprocess.run(["git", "merge-base", "--is-ancestor", FROZEN, candidate], cwd=ROOT, check=True)
    subprocess.run(["git", "diff", "--quiet", FROZEN, candidate, "--", *CONDITIONS], cwd=ROOT, check=True)
    subprocess.run(["git", "diff", "--quiet", FROZEN, "--", REFERENCES, "scripts/sic-replay-budgets.mjs",
                    "scripts/sic-replay-watchdog.mjs"], cwd=ROOT, check=True)
    selected = pick(catalog, opts.games)
    state = opts.state.resolve()
    state.mkdir(parents=True, exist_ok=True)
    config = {"candidate": candidate, "tree": tree(candidate), "frozen": FROZEN, "archive": ARCHIVE,
              "protocol": protocol(), "mode": opts.command, "startLevel": 1, "solver": "sic", "workers": 1, "seed": 0}
    imported = None
    if opts.command == "import-ci":
        prefix = "sic-107-" + candidate[:8] + "-"

        def read(name):
            folder, leaf = name.split("/", 1)
            return AUDIT["load"](opts.download / (prefix + folder) / leaf)

        config.update(runId=opts.run_id, workflow=opts.workflow)
        if opts.download is None:
            check((candidate, opts.run_id, opts.workflow) == (SOURCE, RUN, WORKFLOW),
                  "A candidate import requires its GitHub artifact download")
            imported = rows  # Exercise with the already verified archive. Never substitute it for B.
        else:
            imported = verified_campaign(candidate, opts.run_id, opts.workflow, read, list(rows), counts)
    else:
        check(len(selected) < 107 and opts.games != "reste", "Use the 24-shard GitHub workflow for the full cohort")
        checkout(opts.checkout.resolve(), candidate)
        checkout(opts.frozen_checkout.resolve(), FROZEN)
        node = shutil.which(opts.node)
        check(node is not None, f"Node executable not found: {opts.node}")
        version = subprocess.check_output([node, "--version"], text=True).strip()
        check(version == "v24.22.3", f"Frozen runtime is v24.22.3, found {version}")
        config.update(node=version, exact=opts.exact)
    binding = sha(json.dumps(config, sort_keys=True).encode())
    meta = state / "config.json"
    if not meta.exists():
        atomic_record(meta, config)
    check(json.loads(meta.read_bytes()) == config, f"Different source or parameters in {state}")
    reused, processed, different, pending = [], [], [], []
    for code in selected:
        done = state / (code + ".json")
        original, frozen_binding = rows[code]
        if done.exists():
            prior = json.loads(done.read_bytes())
            check(prior["game"] == code and prior["binding"] == binding and prior["reference"] == frozen_binding,
                  f"Wrong completion marker for {code}")
            if imported:
                check(prior["candidateReceipt"] == imported[code][1], f"Changed imported receipt for {code}")
            for name, digest in prior["files"].items():
                check(file_sha(state / name) == digest, f"Changed local artifact {name}")
            reused.append(code)
            if not prior["matches"]:
                different.append(code)
            continue
        if opts.limit is not None and len(processed) >= opts.limit:
            pending.append(code)
            continue
        details, baseline_trace, candidate_witnesses, files = None, None, None, {}
        if imported:
            observed, candidate_receipt = imported[code]
        else:
            attempt = Path(tempfile.mkdtemp(prefix=code + "-", dir=state))
            observed, b_trace = capture(opts.checkout.resolve(), candidate, code, "B", attempt, node)
            candidate_receipt = {"source": candidate, "rowSHA256": file_sha(attempt / "B.receipt")}
            missing, contact = strict_witnesses(b_trace)
            candidate_witnesses = {"missingControl": missing, "switchContact": contact}
        projection = receipt_difference(original, observed)
        audit = AUDIT["audit_game"](observed, counts[code], budgets[code])
        if not imported:
            trace_a = opts.strict_dir / f"{code}-A.jsonl"
            has_a = code in STRICT_SHA and trace_a.is_file()
            if code in STRICT_SHA or opts.exact or projection or audit["issues"] or audit["category"] != "complete":
                if not has_a:
                    a_row, trace_a = capture(opts.frozen_checkout.resolve(), FROZEN, code, "A", attempt, node)
                    check(receipt_difference(original, a_row) is None,
                          f"Targeted A does not reproduce the archived course: {attempt / 'A.receipt'}")
                if code in STRICT_SHA:
                    check(file_sha(trace_a) == STRICT_SHA[code], "A digest mismatch")
                missing, contact = strict_witnesses(trace_a)
                baseline_trace = {"source": FROZEN, "path": str(trace_a.resolve()), "sha256": file_sha(trace_a),
                                  "missingControlWitnesses": missing, "switchWitnesses": contact}
                cmp = subprocess.run([node, str(COMPARATOR), str(trace_a), str(b_trace)], capture_output=True, text=True)
                check(cmp.returncode in (0, 1) and cmp.stdout.strip(), f"Comparator error: {cmp.stderr[:300]}")
                details = json.loads(cmp.stdout)
                check((cmp.returncode == 0) == details["equal"], "Inconsistent comparison")
            files = {str(f.relative_to(state)): file_sha(f) for f in attempt.iterdir() if f.is_file()}
        matches = projection is None and (details is None or details["equal"]) and audit["category"] == "complete" \
            and not audit["issues"] and not audit["scoreDeadlineOverruns"]
        result = {"game": code, "binding": binding, "reference": frozen_binding, "candidateReceipt": candidate_receipt,
                  "qualified": audit, "historicalDifference": projection, "decisionComparison": details, "baselineTrace": baseline_trace,
                  "candidateWitnesses": candidate_witnesses, "precision": "decisions" if details else "historical-receipt",
                  "matches": bool(matches), "files": files}
        atomic_record(done, result)
        processed.append(code)
        if not matches:
            different.append(code)
    print(json.dumps({"processed": processed, "reused": reused, "pending": pending, "different": different,
                      "state": str(state)}, ensure_ascii=False))
    return 1 if different else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    plan = sub.add_parser("plan")
    plan.add_argument("--output", type=Path)
    run = sub.add_parser("run")
    run.add_argument("--checkout", type=Path, required=True)
    run.add_argument("--frozen-checkout", type=Path, required=True)
    run.add_argument("--node", default="node")
    run.add_argument("--exact", action="store_true", help="Capture targeted A even when the historical receipt matches")
    ci = sub.add_parser("import-ci")
    ci.add_argument("--download", type=Path, help="gh run download directory; omit only for the frozen archive exercise")
    ci.add_argument("--run-id", required=True)
    ci.add_argument("--workflow", required=True, help="Expected immutable workflow commit from GitHub")
    for command in (plan, run, ci):
        command.add_argument("--strict-dir", type=Path, default=DEFAULT_A)
    for command in (run, ci):
        command.add_argument("--candidate", required=True)
        command.add_argument("--state", type=Path, required=True)
        command.add_argument("--games", default="appelants", help="initial, appelants, temoins, reste, all or comma-separated codes")
        command.add_argument("--limit", type=int, help="Maximum new games to process this invocation")
    opts = parser.parse_args()
    os.chdir(ROOT)
    if getattr(opts, "limit", None) is not None:
        check(opts.limit > 0, "Limit must be positive")
    rows, counts, budgets = frozen_campaign()
    catalog = inventory(rows, opts.strict_dir)
    if opts.command == "plan":
        info = {"frozen": FROZEN, "receiptSource": SOURCE, "tree": tree(FROZEN), "archive": ARCHIVE, "directory": DIRECTORY,
                "runId": RUN, "workflow": WORKFLOW, "solver": "sic", "startLevel": 1, "target": "auto", "workers": 1,
                "seed": 0, "referenceFile": REFERENCES, "referenceSHA256": sha(git("show", FROZEN + ":" + REFERENCES))}
        if opts.output:
            # One record per game keeps Git diffs and per-game lookups short.
            header = json.dumps(info, ensure_ascii=False, indent=2).removesuffix("\n}")
            records = [json.dumps(game, ensure_ascii=False, separators=(",", ":")) for game in catalog]
            opts.output.write_text(header + ',\n  "games": [\n    ' + ',\n    '.join(records) + '\n  ]\n}\n',
                                   encoding="utf8", newline="\n")
        print(json.dumps({"games": len(catalog), "levels": sum(counts.values()), "shards": 24,
                          "initial": pick(catalog, "initial"), "next": pick(catalog, "appelants"),
                          "controls": pick(catalog, "temoins"), "rest": len(pick(catalog, "reste"))}))
        return 0
    opts.state.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(opts.state / ".session.sqlite", timeout=0)) as lock:
        # SQLite releases this OS lock even if the process is killed mid-game.
        lock.execute("BEGIN IMMEDIATE")
        return qualify(opts, catalog, rows, counts, budgets)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, sqlite3.Error, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
