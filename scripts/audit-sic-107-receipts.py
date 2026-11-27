"""Independent audit of complete chronological SIC-107 shard receipts."""
import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess


BASELINE = "docs/diagnostics/sic-107-4a546a13-20261126"
REFERENCE = "docs/architecture/sic-replay-reference-levels-20261126.json"
CAMPAIGN_SOURCE = "0fe417b2e91bb8ca15573e82b79b7081157aeb37"
BASELINE_SOURCE = "4a546a139f9064422c078ef5f40b8c22133c39a8"
WORKFLOW = "9d730b984b88268162f6de4e51615422e727750a"
RUN_ID = 46047191373
SOURCE_FILES = (
    "scripts/check-sic-chronological.mjs", "scripts/sic-replay-watchdog.mjs",
    "scripts/sic-replay-budgets.mjs", "src/games/catalog.ts", REFERENCE,
    "docs/architecture/sic-v8-level6-campaign-7bb9f152.json", "package-lock.json",
)
TIME_STOPS = {"level_active_time_budget", "level_wall_time_budget", "level_transition_wall_time_budget"}
ACTION_STOPS = {"level_action_budget", "session_action_budget"}
SUCCESS = {"native_win", "target_levels_completed"}
CHILD_STATUSES = {"idle", "preparing", "thinking", "acting", "paused", "stopped", "error"}


def git(*args):
    return subprocess.check_output(["git", *args])


def sha(bytes_):
    return hashlib.sha256(bytes_).hexdigest()


def hex_digest(value):
    return isinstance(value, str) and re.fullmatch("[a-f0-9]{64}", value) is not None


def count(value):
    return type(value) is int and value >= 0


def load(path):
    if path.is_file():
        return path.read_bytes()
    return gzip.decompress(path.with_name(path.name + ".gz").read_bytes())


def json_lines(data):
    return [json.loads(line) for line in data.splitlines() if line.strip()]


def frozen_catalog(source):
    def source_bytes(path):
        return git("show", f"{source}:{path}")

    catalog = json.loads(source_bytes(f"{BASELINE}/manifest.json"))
    reference = json.loads(source_bytes(f"{BASELINE}/expected-budgets.json"))
    if any(sha(source_bytes(path)) != expected
           for path, expected in reference["sourceHashes"].items()):
        raise ValueError("The original level budgets do not bind this Git source")
    codes, counts = catalog["expectedCodes"], catalog["expectedLevelCounts"]
    budgets = reference["budgets"]
    if len(codes) != 107 or set(codes) != set(counts) or set(codes) != set(budgets):
        raise ValueError("Unexpected SIC-107 catalog")
    if sum(counts.values()) != 692 or any(len(budgets[code]) != counts[code] for code in codes):
        raise ValueError("Unexpected SIC-107 level coverage")
    return codes, counts, budgets, reference["sourceHashes"][REFERENCE]


def declared_shards(plan, source, tree, codes, counts):
    if (plan.get("source"), plan.get("tree"), plan.get("baseline")) != (source, tree, BASELINE_SOURCE):
        raise ValueError("Campaign plan points to a different source")
    if plan.get("codes") != codes or plan.get("levels") != counts:
        raise ValueError("Campaign plan changes the canonical 107-game catalog")
    shards = {row["shard"]: row["games"] for row in plan["shards"]}
    if len(plan["shards"]) != 24 or set(shards) != {f"{index:02d}" for index in range(1, 25)}:
        raise ValueError("Campaign plan changes the 24 shard identifiers")
    if not all(shards.values()) or sorted(code for games in shards.values() for code in games) != sorted(codes):
        raise ValueError("Campaign plan omits or duplicates a game")
    return shards


def validate_manifest(manifest, source, tree, run_id, workflow, plan, hashes):
    shard, games = manifest.get("shard"), manifest.get("games")
    if (manifest.get("schema"), manifest.get("source"), manifest.get("tree"), manifest.get("workflowSha"),
        manifest.get("runId"), manifest.get("runAttempt")) != (
        "sic.full-campaign-shard.v1", source, tree, workflow, str(run_id), "1",
    ):
        raise ValueError(f"Shard {shard} does not bind the exact GitHub source, workflow and first attempt")
    if shard not in plan or games != plan[shard]:
        raise ValueError(f"Shard {shard} does not bind the planned games in order")
    if (manifest.get("solver"), manifest.get("parallelWorkers")) != ("sic", 1) \
            or manifest.get("environment") != {"SIC_REPLAY_REFERENCES": REFERENCE}:
        raise ValueError(f"Shard {shard} does not bind the original reference and one SIC worker")
    if manifest.get("argv") != [
        "node", SOURCE_FILES[0], ",".join(games), "auto", "replay/results.jsonl", "1", "sic",
    ] or not str(manifest.get("nodeVersion")).startswith("v24.") or manifest.get("runnerOS") != "Linux":
        raise ValueError(f"Shard {shard} does not bind the chronological command and environment")
    if manifest.get("sourceHashes") != hashes:
        raise ValueError(f"Shard {shard} source hashes differ from the exact Git blobs")
    return shard, games


def audit_game(raw, target, budgets):
    issues = []
    status, reason = raw.get("status"), raw.get("reason")
    error = status in {"error", "harness_error"}
    actions, authority = raw.get("actions"), raw.get("authority")
    level_rows = raw.get("levelStats", [])
    levels_scored = raw.get("levels")
    child = hex_digest(raw.get("trace"))
    rows_won = reconciled = cumulative_actions = 0
    score_overruns = []
    if status != "harness_error" and status not in CHILD_STATUSES:
        issues.append("invalid_status")
    if "trace" in raw and not child:
        issues.append("invalid_child_trace")
    counts_known = count(actions) and count(authority)
    if counts_known and authority != actions:
        issues.append("non_sic_actions")
    if not error and not counts_known:
        issues.append("action_or_authority_count_missing")
    if raw.get("target") != target and (not error or raw.get("target") is not None):
        issues.append("target_mismatch")
    if raw.get("mode", "sic") != "sic" or raw.get("parallelWorkers", 1) != 1:
        issues.append("mode_or_worker_mismatch")
    if child and (raw.get("mode") != "sic" or raw.get("parallelWorkers") != 1):
        issues.append("child_mode_or_worker_missing")
    if not isinstance(level_rows, list) or len(level_rows) > target or (not error and not level_rows):
        issues.append("invalid_level_rows")
        level_rows = []
    previous_won = True
    last_hash = None
    for index, row in enumerate(level_rows):
        level = index + 1
        if not isinstance(row, dict):
            issues.append(f"invalid_level_row:L{level}")
            previous_won = False
            continue
        won, commands = row.get("won"), row.get("actions")
        if row.get("level") != level or type(won) is not bool or not previous_won:
            issues.append(f"non_chronological_progress:L{level}")
        previous_won = won is True
        if row.get("budget") != budgets[index]:
            issues.append(f"budget_mismatch:L{level}")
        if not count(commands) or commands > budgets[index]["actions"]:
            issues.append(f"command_cap_or_count_invalid:L{level}")
        if count(commands):
            cumulative_actions += commands
        if won is True:
            rows_won += 1
            if not count(row.get("scoredMs")):
                issues.append(f"score_time_missing:L{level}")
            elif row["scoredMs"] > budgets[index]["activeTimeMs"]:
                score_overruns.append({"level": level, "ms": row["scoredMs"] - budgets[index]["activeTimeMs"]})
            if row.get("acquiredRecords") == cumulative_actions and hex_digest(row.get("graph")) \
                    and hex_digest(row.get("prefixHash")):
                reconciled += 1
        last_hash = row.get("prefixHash")
    if not error and (levels_scored != rows_won or not count(levels_scored)):
        issues.append("official_score_mismatch")
    if not error and counts_known and cumulative_actions != actions:
        issues.append("command_total_mismatch")
    if child and hex_digest(last_hash) and raw["trace"] != last_hash:
        issues.append("terminal_trace_mismatch")
    recoveries = raw.get("recoveries")
    if "recoveries" in raw and (not isinstance(recoveries, dict)
                               or any(not count(recoveries.get(key)) for key in ("reset", "undo"))):
        issues.append("invalid_recoveries")
    if child and recoveries is None:
        issues.append("child_recovery_count_missing")
    if status == "harness_error":
        category = "harness_error"
    elif status == "error":
        category = "runtime_error"
    elif issues:
        category = "invalid_receipt"
    elif status == "stopped" and rows_won == target and reason in SUCCESS:
        category = "complete" if child and reconciled == target else "complete_unsettled"
    elif reason in TIME_STOPS:
        category = "transition_timeout" if reason == "level_transition_wall_time_budget" else "resolution_timeout"
    elif reason in ACTION_STOPS:
        category = "action_limit"
    else:
        category = "other_gameplay_stop"
    return {
        "category": category, "issues": issues, "scored": rows_won, "reconciled": reconciled,
        "scoreDeadlineOverruns": score_overruns, "recoveries": recoveries, "reason": reason,
    }


def audit_receipts(source, plan_file, shards, run_id=RUN_ID, workflow=WORKFLOW):
    codes, counts, budgets, reference_hash = frozen_catalog(source)
    tree = git("rev-parse", f"{source}^{{tree}}").decode().strip()
    plan = declared_shards(json.loads(load(plan_file)), source, tree, codes, counts)
    hashes = {path: sha(git("show", f"{source}:{path}")) for path in SOURCE_FILES}
    if hashes[REFERENCE] != reference_hash:
        raise ValueError("Campaign source disagrees with the original replay references")
    seen = {}
    seen_shards = set()
    artifacts = []
    for shard in shards:
        manifest = json.loads(load(shard / "manifest.json"))
        shard_id, prefix = validate_manifest(manifest, source, tree, run_id, workflow, plan, hashes)
        if shard_id in seen_shards:
            raise ValueError(f"Duplicate shard receipt {shard_id}")
        seen_shards.add(shard_id)
        result_bytes = load(shard / "results.jsonl")
        rows = json_lines(result_bytes)
        if [row.get("code") for row in rows] != prefix:
            raise ValueError(f"Manifest/result game order mismatch in {shard.name}")
        expected_level_rows = [{"code": row["code"], "level": level}
                               for row in rows for level in row.get("levelStats", [])]
        try:
            level_bytes = load(shard / "results.jsonl.levels")
        except FileNotFoundError:
            if expected_level_rows:
                raise
            level_bytes = b""
        if json_lines(level_bytes) != expected_level_rows:
            raise ValueError(f"Per-level JSONL differs from game results in {shard.name}")
        for row in rows:
            code = row["code"]
            if code not in counts or code in seen:
                raise ValueError(f"Unexpected or duplicate game {code}")
            seen[code] = audit_game(row, counts[code], budgets[code])
        artifacts.append({
            "shard": shard_id, "directory": shard.name, "codes": prefix,
            "resultsSHA256": sha(result_bytes), "levelsSHA256": sha(level_bytes),
            "logSHA256": sha(load(shard / "runner.log")),
        })
    eligible = [game for game in seen.values() if game["category"] not in {"invalid_receipt", "harness_error", "runtime_error"}]
    known = [game["recoveries"] for game in eligible if game["recoveries"] is not None]
    summary = {
        "source": source, "sourceTree": tree, "runId": run_id, "workflowSha": workflow,
        "referenceSHA256": reference_hash, "verifiedShards": len(seen_shards),
        "expectedGames": len(codes), "expectedLevels": sum(counts.values()), "receipts": len(seen),
        "missing": [code for code in codes if code not in seen],
        "categories": dict(Counter(game["category"] for game in seen.values())),
        "publicLevelsScored": sum(game["scored"] for game in eligible),
        "levelsReconciled": sum(game["reconciled"] for game in eligible),
        "gamesReconciledWithoutRecovery": sum(
            game["category"] == "complete" and game["recoveries"] == {"reset": 0, "undo": 0}
            and not game["scoreDeadlineOverruns"] for game in eligible
        ),
        "gamesWithScoreDeadlineOverrun": [code for code, game in seen.items() if game["scoreDeadlineOverruns"]],
        "recoveries": {
            "knownGames": len(known), "unknownGames": len(eligible) - len(known),
            "knownResets": sum(row["reset"] for row in known), "knownUndos": sum(row["undo"] for row in known),
        },
        "invalid": {code: game["issues"] for code, game in seen.items() if game["issues"]},
    }
    return {"summary": summary, "games": seen, "artifacts": artifacts}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("shards", nargs="+", type=Path)
    parser.add_argument("--source", default=CAMPAIGN_SOURCE)
    parser.add_argument("--plan", required=True, type=Path)
    parser.add_argument("--run-id", type=int, default=RUN_ID)
    parser.add_argument("--workflow", default=WORKFLOW)
    parser.add_argument("--output", type=Path)
    options = parser.parse_args()
    source = git("rev-parse", f"{options.source}^{{commit}}").decode().strip()
    report = audit_receipts(source, options.plan, options.shards, options.run_id, options.workflow)
    if options.output:
        with options.output.open("x", encoding="utf-8") as file:
            json.dump(report, file, ensure_ascii=False, indent=2)
            file.write("\n")
    summary = report["summary"]
    print(json.dumps({
        **summary, "invalidReceipts": len(summary["invalid"]),
        "invalid": dict(list(summary["invalid"].items())[:8]),
    }, ensure_ascii=False))
    if summary["missing"] or summary["invalid"] or summary["gamesWithScoreDeadlineOverrun"]:
        return 1
    if any(summary["categories"].get(key) for key in ("harness_error", "runtime_error")):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
