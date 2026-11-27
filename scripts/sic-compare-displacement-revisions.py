"""Qualify ordinary traces and independent L1 call witnesses for the displacement change."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import runpy
import subprocess
import zipfile

from sic_qualification_reference import FROZEN, ROOT, REFERENCES, check

PARENT = "3c2d6bcfd4a7d7abf28650e2f8ffed3d3510c3b4"
CHILD = "a5a90c3349ea49bba8e40055444cea2026bee962"
BENCH = runpy.run_path(str(ROOT / "scripts/sic-qualification-progressive.py"))
SITES = {
    "G50T": ("replay-access.ts", 5, [14, 8], [20, 8], 6),
    "FOGW": ("reception-access.ts", 3, [30, 42], [34, 42], 4),
}


def read(path):
    return json.loads(path.read_bytes())


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def git(cwd, *args):
    return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()


def record(opts):
    source = {"A": PARENT, "B": CHILD}[opts.label]
    game, folder = opts.game, opts.folder
    folder.mkdir(parents=True, exist_ok=True)
    check(git(opts.checkout, "rev-parse", "HEAD") == source, "Unexpected engine revision")
    check(not git(opts.checkout, "status", "--porcelain"), "Engine checkout is dirty")
    check(subprocess.check_output([opts.node, "--version"], text=True).strip() == "v24.22.3", "Node version")
    subprocess.run([opts.node, "scripts/prepare-python.mjs"], cwd=opts.checkout, check=True)
    receipt = folder / (opts.label + ".receipt")
    trace = folder / (opts.label + ".jsonl")
    env = dict(os.environ)
    for name in ("NODE_OPTIONS", "NODE_V8_COVERAGE", "SIC_REPLAY_CHILD", "SIC_DECISION_TRACE", "SIC_DISPLACEMENT_WITNESS"):
        env.pop(name, None)
    env["SIC_REPLAY_REFERENCES"] = str(ROOT / REFERENCES)
    env["SIC_DECISION_TRACE"] = str(trace)
    runner = ROOT / "scripts/check-sic-chronological.mjs"
    args = [opts.node, str(runner), game, "auto", str(receipt), "1", "sic"]
    check(not receipt.exists() and not trace.exists(), "Use a fresh output directory per attempt")
    info = {"source": source, "tree": git(opts.checkout, "rev-parse", "HEAD^{tree}"), "game": game,
            "argv": args, "node": "v24.22.3", "referencesSHA256": sha(ROOT / REFERENCES), "seed": 0, "startLevel": 1}
    BENCH["atomic_record"](folder / (opts.label + ".source.json"), info)
    subprocess.run(args, cwd=opts.checkout, env=env, check=True)
    if game in SITES:
        del env["SIC_DECISION_TRACE"]
        env["NODE_OPTIONS"] = "--import=" + (ROOT / "scripts/sic-displacement-call-witness.mjs").as_uri()
        env["SIC_DISPLACEMENT_WITNESS"] = str(folder / (opts.label + ".calls.json"))
        diagnostic = folder / (opts.label + ".L1.receipt")
        subprocess.run([opts.node, str(runner), game, "1", str(diagnostic), "1", "sic"],
                       cwd=opts.checkout, env=env, check=True)
    check(not git(opts.checkout, "status", "--porcelain"), "Engine checkout changed")


def parent_receipt(game):
    archive = ROOT / "docs/diagnostics/sic-qualification-3c2d6bcf"
    ledger = read(archive / "qualification.json")
    check(ledger["candidate"] == PARENT and ledger["frozen"] == FROZEN, "Wrong parent ledger")
    entry, = [r for r in ledger["games"] if r["game"] == game]
    check(entry["matches"] and not entry.get("historicalDifference"), "Unqualified parent game")
    check(sha(archive / "recus.zip") == ledger["archiveSHA256"], "Wrong parent archive")
    with zipfile.ZipFile(archive / "recus.zip") as stored:
        data = stored.read(f"sic-107-3c2d6bcf-shard-{entry['shard']}/results.jsonl")
    line, = [l for l in data.splitlines() if json.loads(l)["code"] == game]
    check(hashlib.sha256(line).hexdigest() == entry["candidateRowSHA256"], "Wrong parent receipt")
    return json.loads(line), entry


def call_witness(game, folder, label, ordinary):
    file, turn, before, after, step = SITES[game]
    diag = read(folder / (label + ".L1.receipt"))
    measured = read(folder / (label + ".calls.json"))
    check(diag["reason"] == "target_levels_completed" and diag["levels"] == 1, "Incomplete L1 diagnostic")
    for field in ("actions", "won", "budget", "prefixHash"):
        check(diag["levelStats"][0][field] == ordinary["levelStats"][0][field], f"L1 prefix mismatch: {field}")
    variant = "inline" if label == "A" else "singleStepDisplacement"
    check(measured["loaded"] == {s[0]: variant for s in SITES.values()}, "Unexpected caller modules")
    samples = measured["samples"]
    hits = [row for row in samples if row["file"] == file and row["from"] == before and row["position"] == after
            and row["step"] == step and row["command"] == "ACTION4" and row["displacement"] == [step, 0]
            and f":revision:{turn+1}:" in row["observation"]]
    check(len(hits) == 1, f"{game} L1 turn {turn}: expected displacement absent or ambiguous")
    return {"site": file, "variant": variant, "turn": turn, "observed": hits[0],
            "callsBySite": {s[0]: sum(row["file"] == s[0] for row in samples) for s in SITES.values()},
            "prefixHash": diag["levelStats"][0]["prefixHash"], "allSamplesSHA256": hashlib.sha256(
                json.dumps(samples, sort_keys=True).encode()).hexdigest()}


def compare(opts):
    folder, game = opts.folder, opts.game
    reference, entry = parent_receipt(game)
    result = {"game": game, "frozen": FROZEN, "parentRowSHA256": entry["candidateRowSHA256"]}
    comparison = subprocess.run([opts.node, str(BENCH["COMPARATOR"]), str(folder/"A.jsonl"), str(folder/"B.jsonl")],
                                capture_output=True, text=True)
    check(comparison.returncode in (0, 1), comparison.stderr[:300])
    result["comparison"] = json.loads(comparison.stdout)
    ok = result["comparison"]["equal"]
    for label, source in (("A", PARENT), ("B", CHILD)):
        check(read(folder / (label + ".source.json"))["source"] == source, "Mismatched capture")
        path = folder / (label + ".receipt")
        receipt = read(path)
        diff = BENCH["receipt_difference"](reference, receipt)
        complete = (receipt.get("reason") == "target_levels_completed" and receipt.get("authority") == receipt.get("actions")
                    and receipt.get("levels") == reference["target"] and len(receipt.get("levelStats", [])) == reference["target"]
                    and all(s["won"] and s.get("scoredMs", float("inf")) <= s["budget"]["activeTimeMs"]
                            and s.get("prefixHash") for s in receipt["levelStats"]))
        data = {"source": source, "traceSHA256": sha(folder / (label + ".jsonl")), "receiptSHA256": sha(path),
                "parentReceiptDifference": diff, "complete": complete, "levels": receipt["levels"],
                "actions": receipt["actions"], "reason": receipt["reason"], "trajectory": receipt.get("trace"),
                "commandsByLevel": [s["actions"] for s in receipt["levelStats"]]}
        if game in SITES:
            data["calls"] = call_witness(game, folder, label, receipt)
        result[label] = data
        ok = ok and diff is None and complete
    if game in SITES:
        ok = ok and result["A"]["calls"]["allSamplesSHA256"] == result["B"]["calls"]["allSamplesSHA256"]
    result["matches"] = bool(ok)
    BENCH["atomic_record"](folder / "pair.json", result)
    print(game, result["comparison"], "matches", ok)
    return 0 if ok else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("record", "compare"))
    parser.add_argument("game")
    parser.add_argument("folder", type=lambda p: Path(p).resolve())
    parser.add_argument("--checkout", type=lambda p: Path(p).resolve())
    parser.add_argument("--label", choices=("A", "B"))
    parser.add_argument("--node", default="node")
    options = parser.parse_args()
    if options.operation == "record":
        if not options.checkout or not options.label:
            parser.error("record requires --checkout and --label")
        record(options)
    else:
        raise SystemExit(compare(options))