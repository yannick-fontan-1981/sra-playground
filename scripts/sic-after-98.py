"""Capture and compare the two protected native SIC courses on the post-98 baseline."""
import argparse
from contextlib import closing
import json
from pathlib import Path
import runpy
import shutil
import sqlite3
import subprocess
import tempfile

from sic_qualification_reference import ROOT, check, git, tree

BASE = "0aef4289e97ce094782dfd03f5a79ace6eae5fd2"
GAMES = ("AS66", "G50T")
progressive = runpy.run_path(str(ROOT / "scripts/sic-qualification-progressive.py"))
atomic_record, capture, checkout, file_sha, protocol, receipt_difference = (
    progressive[name] for name in ("atomic_record", "capture", "checkout", "file_sha", "protocol", "receipt_difference")
)


def capture_once(state, engine, source, game, label, node, capture_protocol):
    marker = state / f"{game}-{label}.json"
    inputs = {"game": game, "label": label, "source": source, "tree": tree(source), "protocol": capture_protocol}
    reused = marker.exists()
    if reused:
        saved = json.loads(marker.read_bytes())
        check(saved["inputs"] == inputs, f"Capture inputs changed for {marker}")
        for file, digest in saved["files"].items():
            check(file_sha(state / file) == digest, f"Capture file changed: {file}")
    else:
        check(engine is not None, f"Missing verified reference capture {marker}")
        attempt = Path(tempfile.mkdtemp(prefix=f"{game}-{label}-", dir=state))
        receipt, trace = capture(engine, source, game, label, attempt, node)
        saved = {"inputs": inputs, "trace": trace.relative_to(state).as_posix(),
                 "receipt": (attempt / f"{label}.receipt").relative_to(state).as_posix(),
                 "levels": receipt["levels"], "target": receipt["target"], "actions": receipt["actions"],
                 "reason": receipt["reason"], "authority": receipt["authority"],
                 "files": {f.relative_to(state).as_posix(): file_sha(f) for f in sorted(attempt.iterdir()) if f.is_file()}}
        atomic_record(marker, saved)
    return saved, reused


def compare(a_state, a, b_state, b, node):
    completed = subprocess.run([node, str(progressive["COMPARATOR"]), str(a_state / a["trace"]), str(b_state / b["trace"])],
                               check=False, capture_output=True, text=True)
    check(completed.returncode in (0, 1) and completed.stdout.strip(), "Trace comparator: " + completed.stderr[:300])
    result = json.loads(completed.stdout)
    check((completed.returncode == 0) == result["equal"], "Unexpected trace comparator status")
    receipts = [json.loads((state / record["receipt"]).read_bytes()) for state, record in ((a_state, a), (b_state, b))]
    history_delta = receipt_difference(*receipts)
    valid = all(r["reason"] == "target_levels_completed" and r["target"] == r["levels"]
                and r["authority"] == r["actions"] for r in receipts)
    return {"trace": result, "historicalReceiptDifference": history_delta,
            "matches": valid and history_delta is None and result["equal"]
            and result["decisions"] == a["actions"] == b["actions"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--node", default="node")
    commands = parser.add_subparsers(dest="command", required=True)
    reference = commands.add_parser("reference", help="Capture and verify A and A′ on the exact common baseline")
    reference.add_argument("--checkout", type=Path, required=True)
    candidate = commands.add_parser("candidate", help="Compare a candidate with the independently verified A")
    candidate.add_argument("--checkout", type=Path, required=True)
    candidate.add_argument("--sha", required=True)
    candidate.add_argument("--reference-state", type=Path, required=True)
    args = parser.parse_args()

    node = shutil.which(args.node)
    check(node is not None, f"Node executable not found: {args.node}")
    version = subprocess.check_output([node, "--version"], text=True).strip()
    check(version == "v24.22.3", f"Expected Node v24.22.3, found {version}")
    engine, state = args.checkout.resolve(), args.state.resolve()
    source = BASE if args.command == "reference" else args.sha
    check(len(source) == 40 and git("rev-parse", source + "^{commit}").decode().strip() == source,
          "Supply the exact engine commit")
    checkout(engine, source)
    git("merge-base", "--is-ancestor", BASE, source)
    git("diff", "--quiet", BASE, source, "--", *progressive["CONDITIONS"])
    capture_protocol = {**protocol(), Path(__file__).name: file_sha(Path(__file__)), "node": version}
    config = {"source": source, "reference": BASE, "command": args.command, "games": list(GAMES),
              "protocol": capture_protocol, "startLevel": 1, "target": "auto", "mode": "sic", "workers": 1, "seed": 0}
    a_state = state if args.command == "reference" else args.reference_state.resolve()
    if args.command == "candidate":
        check(a_state != state, "Use a separate state directory for the candidate")
        ref = json.loads((a_state / "report.json").read_bytes())
        check(ref["config"] == {**config, "source": BASE, "command": "reference"}
              and [row["game"] for row in ref["games"]] == list(GAMES) and all(row["matches"] for row in ref["games"]),
              "Reference lacks a complete, matching A/A′ verdict under this protocol")
        config["referenceReportSHA256"] = file_sha(a_state / "report.json")
    state.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(state / ".session.sqlite", timeout=0)) as lock:
        lock.execute("BEGIN EXCLUSIVE")
        binding = state / "config.json"
        if not binding.exists():
            atomic_record(binding, config)
        check(json.loads(binding.read_bytes()) == config, f"Inputs changed in {state}")
        report = {"config": config, "games": []}
        for game in GAMES:
            self_test = args.command == "reference"
            a, reused_a = capture_once(a_state, engine if self_test else None, BASE, game, "A", node, capture_protocol)
            label = "Aprime" if self_test else "B"
            b, reused_b = capture_once(state, engine, source, game, label, node, capture_protocol)
            comparison = compare(a_state, a, state, b, node)
            row = {"game": game, "A": a, label: b, **comparison}
            report["games"].append(row)
            print(json.dumps({"game": game, "matches": row["matches"], "reused": [reused_a, reused_b]}), flush=True)
        report_file = state / "report.json"
        if report_file.exists():
            check(json.loads(report_file.read_bytes()) == report, f"Report changed in {state}")
        else:
            atomic_record(report_file, report)
        print(report_file)
        return int(not all(row["matches"] for row in report["games"]))


if __name__ == "__main__":
    raise SystemExit(main())
