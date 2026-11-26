#!/usr/bin/env python3
"""Summarize this append-only SIC campaign without running or changing any game.

Inputs: manifest.json, expected-budgets.json, execution-start.json,
execution-end.json (when present), and results.jsonl. Outputs are replaced
atomically in this same directory.
"""
from __future__ import annotations

import collections
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import sys
import zlib

ROOT = Path(__file__).resolve().parent
COMMIT = "4a546a139f9064422c078ef5f40b8c22133c39a8"
CODES = """AMZE AR25 AS66 BP35 CASC CATL CATR CAVA CD82 CGWL CLRS CN04 COLM COMB CONN
CRAF CWSE DAME DC22 DICO DNOI ELAS ESCT ETAG EVAS FITE FOGW FT09 FUIT G50T
GABA GARE GIGO GLOB GMAP GORI GRAV GRIL HANO HOLE HPDL ISOS KA59 KATA KEYD
KLOT LF52 LIFE LKEY LOGI LP85 LS19 LS20 M0R0 MEMO MIND MOTO ONDE PIPE POLA
PORT PRTL R11L RE86 RECR REGN REWI RSWP S5I5 SB26 SC25 SELE SEQN SERI SIGN
SK48 SKBN SMLP SNAR SP80 SPOR SS01 SS02 SS03 SS04 SS05 SS06 SS07 STCK SU15
SWCH SYME TEQU THER TICT TN36 TR87 TRCP TRIA TU93 UPST VALV VC33 VOIS WA30
WEAV ZIPP""".split()
COUNTS = dict.fromkeys(CODES, 6)
for _count, _codes in {
    4: "HANO", 7: "G50T KA59 LS20 TN36 VC33",
    8: "AR25 LP85 LS19 RE86 S5I5 SB26 SK48 SS01 SS02 SS03 SS04 SS05 SS06 SS07",
    9: "AS66 BP35 SU15 TU93 WA30", 10: "LF52",
}.items():
    COUNTS.update(dict.fromkeys(_codes.split(), _count))


def integer(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def duration(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def digest(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_json(name, issues, required=False):
    path = ROOT / name
    if not path.exists():
        if required:
            issues.append(f"missing_input:{name}")
        return None, None
    raw = path.read_bytes()
    try:
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise ValueError("expected an object")
        return value, {"path": name, "bytes": len(raw), "sha256": sha(raw)}
    except (ValueError, UnicodeError) as error:
        issues.append(f"invalid_input:{name}:{error}")
        return None, {"path": name, "bytes": len(raw), "sha256": sha(raw)}


def empty_game(code, closed):
    return {
        "code": code, "expectedLevels": COUNTS[code], "observedTarget": None,
        "terminalCategory": "missing" if closed else "pending", "stopStage": None,
        "rawStatus": None, "rawReason": None, "message": None,
        "levelsScored": None, "levelsScoredBasis": None, "allLevelsScored": False,
        "levelsWithFinishedRecord": 0, "levelsReconciled": 0, "reconciledComplete": False,
        "actions": None, "authority": None, "sicAuthorityComplete": None,
        "resetCount": None, "undoCount": None, "resumeCount": None,
        "stoppedAtLevel": None, "resolutionScoredMs": None, "settlementMs": None,
        "stopBudgetSource": None, "stopBudgetBasis": None, "stopActionCap": None, "stopTimeCapMs": None,
        "timingConformance": "not_observed", "scoreDeadlineOverrunMs": None, "timingWarnings": [],
        "reportedLevelMs": None, "trace": None, "resultOrigin": None,
        "recordLocations": [], "levels": [], "auditIssues": [], "notes": [],
        "countsEligible": False,
    }


def analyze(code, raw, line, expected_budgets=None, result_name="results.jsonl"):
    game = empty_game(code, False)
    game["recordLocations"] = [{"path": result_name, "line": line, "lineBasis": "uncompressed_jsonl"}]
    problems, notes = game["auditIssues"], game["notes"]
    status, reason = raw.get("status"), raw.get("reason")
    if not isinstance(status, str):
        problems.append("invalid_raw_status")
        status = None
    if reason is not None and not isinstance(reason, str):
        problems.append("invalid_raw_reason")
        reason = None
    error_status = status in {"error", "harness_error"}
    game.update(rawStatus=raw.get("status"), rawReason=raw.get("reason"), message=raw.get("message"), observedTarget=raw.get("target"))
    if raw.get("target") is not None and raw["target"] != COUNTS[code]:
        problems.append("target_mismatch")
    elif raw.get("target") is None:
        (notes if error_status else problems).append("target_unavailable")
    if "mode" in raw and raw["mode"] != "sic":
        problems.append("non_sic_mode")
    if "parallelWorkers" in raw and raw["parallelWorkers"] != 1:
        problems.append("worker_count_mismatch")
    recoveries = raw.get("recoveries")
    if isinstance(recoveries, dict):
        for source, target in (("reset", "resetCount"), ("undo", "undoCount")):
            if integer(recoveries.get(source)):
                game[target] = recoveries[source]
    if integer(raw.get("resumes")):
        game["resumeCount"] = raw["resumes"]
    for name in ("actions", "authority"):
        value = raw.get(name)
        if integer(value):
            game[name] = value
        else:
            (notes if error_status else problems).append(f"{name}_unavailable_or_invalid")
    if game["actions"] is not None and game["authority"] is not None:
        game["sicAuthorityComplete"] = game["authority"] == game["actions"]
        if not game["sicAuthorityComplete"]:
            problems.append("sic_authority_mismatch")

    source_levels = raw.get("levelStats", [])
    if not isinstance(source_levels, list):
        problems.append("invalid_level_stats")
        source_levels = []
    cumulative = 0
    saw_unwon = False
    for index, item in enumerate(source_levels, 1):
        if not isinstance(item, dict):
            problems.append(f"invalid_level_record:{index}")
            continue
        level = {key: item[key] for key in (
            "level", "won", "actions", "ms", "activeMs", "scoredMs", "settlementMs", "gameMs",
            "budget", "prefixHash", "graph", "acquiredRecords", "nodes", "deltas", "traceEvents",
        ) if key in item}
        number, won, actions = item.get("level"), item.get("won"), item.get("actions")
        if not integer(number) or number != index or number > COUNTS[code]:
            problems.append(f"nonconsecutive_or_invalid_level:{index}")
        if not isinstance(won, bool):
            problems.append(f"invalid_won:{index}")
        if saw_unwon:
            problems.append(f"level_after_unwon:{index}")
        saw_unwon = saw_unwon or won is not True
        if not integer(actions):
            problems.append(f"invalid_level_actions:{index}")
        else:
            cumulative += actions
        for key in ("ms", "activeMs", "scoredMs", "settlementMs", "gameMs"):
            if key in item and not duration(item[key]):
                problems.append(f"invalid_duration:{index}:{key}")
        budget = item.get("budget")
        if not isinstance(budget, dict) or not integer(budget.get("actions")) or not budget["actions"] \
                or not integer(budget.get("activeTimeMs")) or not budget["activeTimeMs"]:
            problems.append(f"invalid_budget:{index}")
        elif integer(actions) and actions > budget["actions"]:
            problems.append(f"level_actions_exceed_reported_cap:{index}")
        if expected_budgets is not None:
            if index > len(expected_budgets) or budget != expected_budgets[index - 1]:
                problems.append(f"archived_budget_mismatch:{index}")
        level["scoreDeadlineOverrunMs"] = None
        if won is True and duration(item.get("scoredMs")) and isinstance(budget, dict) \
                and integer(budget.get("activeTimeMs")) and budget["activeTimeMs"] > 0:
            overrun = max(0, item["scoredMs"] - budget["activeTimeMs"])
            level["scoreDeadlineOverrunMs"] = overrun
            if overrun:
                game["timingWarnings"].append({"code": code, "level": number, "scoredMs": item["scoredMs"],
                    "resolutionCapMs": budget["activeTimeMs"], "scoreDeadlineOverrunMs": overrun,
                    "budgetSource": budget.get("source"), "resultPath": result_name, "resultLine": line})
        finished = digest(item.get("prefixHash")) and digest(item.get("graph")) \
            and duration(item.get("activeMs")) and integer(item.get("acquiredRecords"))
        level["finishedRecord"] = finished
        level["reconciliationAttested"] = bool(finished and item["acquiredRecords"] == cumulative)
        if finished and item["acquiredRecords"] > cumulative:
            problems.append(f"acquisitions_exceed_actions:{index}")
        game["levels"].append(level)

    scored_rows = sum(level.get("won") is True for level in game["levels"])
    timed_scores = [level for level in game["levels"] if level["scoreDeadlineOverrunMs"] is not None]
    if timed_scores:
        game["scoreDeadlineOverrunMs"] = sum(level["scoreDeadlineOverrunMs"] for level in timed_scores)
    game["timingConformance"] = "reported_overrun" if game["timingWarnings"] else \
        "within_reported_caps" if scored_rows and len(timed_scores) == scored_rows else "unknown" if scored_rows else "not_applicable"
    reported = raw.get("levels")
    if integer(reported):
        game["levelsScored"], game["levelsScoredBasis"] = reported, "result.levels"
        if reported != scored_rows or reported > COUNTS[code]:
            problems.append("public_score_level_rows_mismatch")
    elif error_status:
        game["levelsScored"] = scored_rows if game["levels"] else None
        game["levelsScoredBasis"] = "finished_level_rows_lower_bound" if game["levels"] else None
        notes.append("result_level_total_unavailable")
    else:
        problems.append("result_level_total_unavailable_or_invalid")
    if game["actions"] is not None and cumulative != game["actions"]:
        (notes if error_status else problems).append("action_total_level_rows_mismatch")
    game["allLevelsScored"] = game["levelsScored"] == COUNTS[code] and scored_rows == COUNTS[code]
    game["levelsWithFinishedRecord"] = sum(level["finishedRecord"] for level in game["levels"])
    game["levelsReconciled"] = sum(level.get("won") is True and level["reconciliationAttested"] for level in game["levels"])
    game["trace"] = raw.get("trace") if digest(raw.get("trace")) else None
    child_result = game["trace"] is not None and raw.get("mode") == "sic"
    game["resultOrigin"] = "child_result" if child_result else "supervisor_or_error_result"
    success_reason = reason in {"target_levels_completed", "native_win"}
    game["reconciledComplete"] = bool(game["allLevelsScored"] and child_result and not error_status
        and status == "stopped" and success_reason and game["levelsReconciled"] == COUNTS[code])
    if game["trace"] and game["levels"] and digest(game["levels"][-1].get("prefixHash")) \
            and game["trace"] != game["levels"][-1]["prefixHash"]:
        problems.append("final_trajectory_prefix_mismatch")

    if game["levels"]:
        last = game["levels"][-1]
        game.update(stoppedAtLevel=last.get("level"), resolutionScoredMs=last.get("scoredMs"), settlementMs=last.get("settlementMs"))
        last_budget = last.get("budget")
        if isinstance(last_budget, dict):
            basis = "no_level_reference" if last_budget.get("source") == "no_level_reference" else last_budget.get("timeBasis")
            game.update(stopBudgetSource=last_budget.get("source"), stopBudgetBasis=basis,
                stopActionCap=last_budget.get("actions"), stopTimeCapMs=last_budget.get("activeTimeMs"))
        if all(duration(level.get("ms")) for level in game["levels"]):
            game["reportedLevelMs"] = sum(level["ms"] for level in game["levels"])
    else:
        last = {}
    if error_status:
        category = "harness_error" if status == "harness_error" else "engine_error"
        stage = "startup" if not game["levels"] else "unknown"
    elif game["reconciledComplete"]:
        category, stage = "complete", None
    elif game["allLevelsScored"] and success_reason:
        category, stage = "complete_unsettled", "final_reconciliation"
    elif reason in {"level_wall_time_budget", "level_active_time_budget", "level_transition_wall_time_budget"}:
        category, stage = "time", "transition" if reason == "level_transition_wall_time_budget" else "resolution"
    elif reason in {"level_action_budget", "session_action_budget"}:
        category, stage = "commands", "resolution"
    elif reason == "no_applicable_transferred_family" or isinstance(reason, str) and (
        reason.startswith("composition_dependency_") or reason in {
            "sic_observed_coverage_deadlock", "sic_observed_transport_deadlock", "sic_observed_weight_shortage",
            "sic_observed_motion_cycle", "sic_observed_unplanned_material_loss",
        }
    ):
        category, stage = "stalled", "resolution"
    elif reason in {"native_game_over", "sic_observed_game_over"}:
        category, stage = "lost", "resolution"
    elif reason == "native_acquisition_incomplete":
        category, stage = "acquisition_incomplete", "transition" if last.get("won") else "resolution"
    else:
        category, stage = "other_stop", "unknown"
    game["terminalCategory"], game["stopStage"] = category, stage
    game["countsEligible"] = not problems
    if problems:
        game["terminalCategory"] = "invalid_result"
        game["reconciledComplete"] = False
    return game


def parse_results(data, closed):
    records, issues, warnings = [], [], []
    pieces = data.splitlines(keepends=True)
    for index, piece in enumerate(pieces, 1):
        if not piece.strip():
            continue
        if index == len(pieces) and not piece.endswith(b"\n") and not closed:
            warnings.append(f"live_trailing_append_ignored:line_{index}")
            continue
        try:
            raw = json.loads(piece)
            if not isinstance(raw, dict) or not isinstance(raw.get("code"), str):
                raise ValueError("result must be an object with a code")
            records.append((index, raw))
        except (ValueError, UnicodeError) as error:
            issues.append(f"invalid_result_line:{index}:{error}")
    return records, issues, warnings


def build_report():
    issues, warnings, inputs = [], [], {}
    manifest, inputs["manifest"] = read_json("manifest.json", issues, True)
    expected, inputs["expectedBudgets"] = read_json("expected-budgets.json", issues, True)
    start, inputs["executionStart"] = read_json("execution-start.json", issues)
    end, inputs["executionEnd"] = read_json("execution-end.json", issues)
    manifest = manifest or {}
    expected = expected or {}
    expected_budgets = expected.get("budgets", {})
    if not isinstance(expected_budgets, dict):
        issues.append("expected_budget_map_invalid")
        expected_budgets = {}
    if expected.get("sourceCommit") != COMMIT or set(expected_budgets) != set(CODES) \
            or any(not isinstance(expected_budgets.get(code), list) or len(expected_budgets[code]) != COUNTS[code] for code in CODES):
        issues.append("expected_budget_scope_mismatch")
    expected_hashes = expected.get("sourceHashes", {})
    manifest_hashes = manifest.get("sourceHashes", {})
    for key in ("scripts/sic-replay-budgets.mjs", "docs/architecture/sic-v8-level6-campaign-7bb9f152.json",
                "docs/architecture/sic-replay-reference-levels-20261126.json"):
        if not isinstance(expected_hashes, dict) or not isinstance(manifest_hashes, dict) \
                or not digest(expected_hashes.get(key)) or expected_hashes.get(key) != manifest_hashes.get(key):
            issues.append(f"expected_budget_source_hash_mismatch:{key}")
    closed = end is not None
    for key, expected in {
        "requestedCommit": COMMIT, "sourceCommit": COMMIT, "expectedGames": 107, "expectedLevels": 692,
        "expectedCodes": CODES, "expectedLevelCounts": COUNTS, "mode": "sic", "declaredWorkers": 1,
        "actualConcurrentGames": 1, "retries": 0, "selectiveRerunsMerged": False, "sourceCleanAtStart": True,
    }.items():
        if manifest.get(key) != expected:
            issues.append(f"manifest_mismatch:{key}")
    argv = manifest.get("argv", [])
    if not isinstance(argv, list) or len(argv) != 7 or argv[2] != ",".join(CODES) or argv[3] != "auto" or argv[5:] != ["1", "sic"]:
        issues.append("manifest_argv_mismatch")
    if start and start.get("sourceCommit") != COMMIT:
        issues.append("execution_start_source_mismatch")
    if end and (end.get("sourceCommitAtEnd") != COMMIT or end.get("sourceCleanAtEnd") is not True):
        issues.append("execution_end_source_changed_or_dirty")
    if end and end.get("parentExitCode") != 0:
        issues.append("execution_parent_failed")
    path = ROOT / "results.jsonl"
    if not path.exists() and (ROOT / "results.jsonl.gz").exists():
        path = ROOT / "results.jsonl.gz"
    stored = path.read_bytes() if path.exists() else b""
    compressed = path.suffix == ".gz"
    try:
        data = gzip.decompress(stored) if compressed else stored
    except (OSError, EOFError, zlib.error) as error:
        issues.append(f"invalid_compressed_results:{error}")
        data = b""
    inputs["resultsSnapshot"] = {"path": path.name, "bytes": len(data), "sha256": sha(data), "exists": path.exists(),
        "hashBasis": "uncompressed_jsonl_bytes", "compression": "gzip" if compressed else None,
        "storedBytes": len(stored), "storedSha256": sha(stored)}
    records, parse_issues, parse_warnings = parse_results(data, closed)
    issues.extend(parse_issues)
    warnings.extend(parse_warnings)
    by_code = collections.defaultdict(list)
    unexpected = []
    for line, raw in records:
        if raw["code"] not in COUNTS:
            unexpected.append({"code": raw["code"], "line": line})
        else:
            by_code[raw["code"]].append((line, raw))
    if unexpected:
        issues.append("unexpected_game_codes")
    games = []
    for code in CODES:
        entries = by_code.get(code, [])
        budgets = expected_budgets.get(code)
        game = analyze(code, entries[0][1], entries[0][0], budgets if isinstance(budgets, list) else None, path.name) if entries else empty_game(code, closed)
        if len(entries) > 1:
            game["recordLocations"] = [{"path": path.name, "line": line, "lineBasis": "uncompressed_jsonl"} for line, _ in entries]
            game["auditIssues"].append("duplicate_result_first_record_retained_for_inspection")
            game.update(terminalCategory="invalid_result", countsEligible=False, reconciledComplete=False)
        games.append(game)
    if closed and len(by_code) < len(CODES):
        issues.append("finished_campaign_missing_results")
    eligible = [game for game in games if game["countsEligible"]]
    categories = dict(sorted(collections.Counter(game["terminalCategory"] for game in games).items()))
    budget_bases = collections.Counter()
    for rows in expected_budgets.values():
        if isinstance(rows, list):
            for budget in rows:
                if isinstance(budget, dict):
                    budget_bases["no_level_reference" if budget.get("source") == "no_level_reference" else str(budget.get("timeBasis"))] += 1
    aggregate = {
        "expectedGames": 107, "expectedLevels": 692, "resultRows": len(records),
        "gamesWithResult": len(by_code), "categories": categories,
        "publicCompleteGames": sum(game["allLevelsScored"] for game in eligible),
        "reconciledCompleteGames": sum(game["reconciledComplete"] for game in eligible),
        "publicLevelsScored": sum(game["levelsScored"] or 0 for game in eligible),
        "levelsReconciled": sum(game["levelsReconciled"] for game in eligible),
        "gamesWithUnknownScore": sum(game["levelsScored"] is None for game in eligible),
        "knownActions": sum(game["actions"] or 0 for game in eligible),
        "knownSicAuthorizedActions": sum(game["authority"] or 0 for game in eligible),
        "gamesWithUnknownActions": sum(game["actions"] is None for game in eligible),
        "knownResets": sum(game["resetCount"] or 0 for game in eligible),
        "knownUndos": sum(game["undoCount"] or 0 for game in eligible),
        "gamesWithUnknownResetCount": sum(game["resetCount"] is None for game in eligible),
        "gamesWithUnknownUndoCount": sum(game["undoCount"] is None for game in eligible),
        "gamesWithAuditIssues": sum(bool(game["auditIssues"]) for game in games),
        "pendingGames": categories.get("pending", 0), "missingGames": categories.get("missing", 0),
        "expectedBudgetBases": dict(sorted(budget_bases.items())),
        "noncompleteStopsByBudgetBasis": dict(sorted(collections.Counter(game["stopBudgetBasis"] or "unavailable" for game in eligible
            if game["terminalCategory"] not in {"complete", "complete_unsettled"}).items())),
        "timingConformance": dict(sorted(collections.Counter(game["timingConformance"] for game in eligible).items())),
        "scoreDeadlineOverrunMs": sum(game["scoreDeadlineOverrunMs"] or 0 for game in eligible),
        "scoreDeadlineMaxOverrunMs": max((warning["scoreDeadlineOverrunMs"] for game in eligible for warning in game["timingWarnings"]), default=0),
        "scoresWithTiming": sum(level["scoreDeadlineOverrunMs"] is not None for game in eligible for level in game["levels"]),
        "scoresWithoutTiming": sum(level.get("won") is True and level["scoreDeadlineOverrunMs"] is None for game in eligible for level in game["levels"]),
    }
    state = "finished" if closed and end.get("parentExitCode") == 0 else "interrupted" if closed else "running" if start else "not_started"
    return {
        "schema": "sic.campaign-107-report.v1", "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "campaignState": state, "sourceCommit": COMMIT, "sourceTree": manifest.get("sourceTree"),
        "executionStart": start, "executionEnd": end, "inputs": inputs,
        "summarizerSha256": sha(Path(__file__).read_bytes()),
        "coverageComplete": len(by_code) == 107 and not unexpected and not parse_issues and all(len(v) == 1 for v in by_code.values()),
        "auditPassed": not issues and not aggregate["gamesWithAuditIssues"],
        "auditIssues": issues, "warnings": warnings, "unexpectedResults": unexpected,
        "timingWarnings": [warning for game in eligible for warning in game["timingWarnings"]],
        "aggregate": aggregate, "games": games,
        "semantics": {
            "lifecycle": "Without an execution-end receipt, absent results remain pending; process liveness is not probed.",
            "publicScore": "Public levels already scored are retained even if reconciliation or a later level stops.",
            "reconciliation": "Attested by a child level-finished record, matching cumulative acquiredRecords, and a normal final child result; this is not a full executed-ticket audit.",
            "invalidResults": "Duplicates and internally inconsistent results are visible but excluded from aggregate score/action totals.",
            "unknownTotals": "Missing counters remain null; sums contain only known confirmed values and may be lower bounds on errors.",
            "budgetValidation": "Every reported per-level budget is compared exactly with expected-budgets.json, generated by the unchanged pure budget module and both hashed archives.",
            "fallbackBudgets": "203 levels have no archived individual reference and retain 80 actions / 90000 ms; a stop under this fallback does not by itself identify a solver bug.",
            "clock": "Resolution and post-score reconciliation have separate deadlines; total level ms alone does not establish a deadline violation.",
            "timingConformance": "Only scoredMs is compared with the resolution cap; reported overruns are listed separately, preserve public scores and terminal categories, and require interpretation of rounded measurements/IPC timing. These warnings do not invalidate structurally consistent raw evidence.",
            "recoveries": "Reset, undo and resume counts are reported only when present as nonnegative integers; absent counters remain null.",
            "scope": "One first chronological SIC attempt per game from L1, 100 source games plus SS01-SS07; no historical successes are merged.",
        },
    }


CSV_FIELDS = ["code", "expectedLevels", "observedTarget", "terminalCategory", "stopStage", "rawStatus", "rawReason",
    "levelsScored", "levelsScoredBasis", "allLevelsScored", "levelsReconciled", "reconciledComplete", "actions", "authority",
    "sicAuthorityComplete", "stoppedAtLevel", "resolutionScoredMs", "settlementMs", "reportedLevelMs", "resultOrigin", "trace",
    "stopBudgetSource", "stopBudgetBasis", "stopActionCap", "stopTimeCapMs", "timingConformance", "scoreDeadlineOverrunMs",
    "resetCount", "undoCount", "resumeCount", "countsEligible", "auditIssues", "message"]


def csv_text(report):
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=CSV_FIELDS, lineterminator="\n")
    writer.writeheader()
    for game in report["games"]:
        row = {key: game.get(key) for key in CSV_FIELDS}
        row["auditIssues"] = ";".join(game["auditIssues"])
        writer.writerow(row)
    return stream.getvalue()


def cell(value):
    return "—" if value is None else str(value).replace("|", "\\|").replace("\n", " ")


def seconds(value):
    return "—" if not duration(value) else f"{value / 1000:.3f}".rstrip("0").rstrip(".").replace(".", ",")


def incomplete_details(game):
    """Presentation only: keep the received verdict, score and counters intact."""
    last = game["levels"][-1] if game["levels"] else {}
    number = last.get("level")
    won = last.get("won") is True
    stage, reason, category = game["stopStage"], game["rawReason"], game["terminalCategory"]
    level_text = f"Après L{number} (score acquis)" if won and number is not None else \
        f"L{number}" if number is not None else "Démarrage" if stage == "startup" else "Non connu"
    budget = last.get("budget") if isinstance(last.get("budget"), dict) else {}
    moves = f"{cell(last.get('actions'))} / {cell(budget.get('actions'))}"
    cap, scored, settled = budget.get("activeTimeMs"), last.get("scoredMs"), last.get("settlementMs")
    if won:
        timing = f"score {seconds(scored)} / {seconds(cap)} s"
        if stage in {"transition", "final_reconciliation"} or duration(settled):
            allocation = max(cap - scored, min(5000, max(250, math.ceil(cap / 4)))) \
                if duration(cap) and cap > 0 and duration(scored) else None
            timing = f"réconciliation {seconds(settled)} / ≈{seconds(allocation)} s ; {timing}" \
                if allocation is not None else f"réconciliation {seconds(settled)} s (plafond non calculable) ; {timing}"
    else:
        active = reason == "level_active_time_budget" and duration(last.get("activeMs"))
        observed = last.get("activeMs") if active else last.get("ms")
        timing = f"{seconds(observed)} / {seconds(cap)} s ({'calcul actif' if active else 'mural'})" \
            if duration(observed) or duration(cap) else "Non disponible"
    reasons = {
        "level_action_budget": "Plafond de commandes du niveau atteint",
        "session_action_budget": "Plafond de commandes de la session atteint",
        "level_wall_time_budget": "Plafond de temps de résolution atteint",
        "level_active_time_budget": "Plafond de calcul actif atteint",
        "level_transition_wall_time_budget": "Transition arrêtée après le score acquis : délai de réconciliation atteint",
        "no_applicable_transferred_family": "Aucune famille acquise applicable",
        "native_game_over": "Défaite signalée par le jeu",
        "sic_observed_game_over": "Défaite observée, récupération non aboutie",
        "native_acquisition_incomplete": "Acquisition du retour incomplète",
        "sic_observed_coverage_deadlock": "Impasse de couverture observée",
        "sic_observed_transport_deadlock": "Transport bloqué selon les observations",
        "sic_observed_weight_shortage": "Poids mobile nécessaire indisponible",
        "sic_observed_motion_cycle": "Cycle de déplacements sans progrès observé",
        "sic_observed_unplanned_material_loss": "Perte de matériel mobile observée",
        "replay_process_unresponsive": "Processus de rejeu sans réponse",
        "command_outside_active_level": "Erreur du banc : commande reçue hors d'un niveau actif",
    }
    if category == "complete_unsettled":
        motive = "Tous les scores acquis ; réconciliation finale non attestée"
    elif category == "harness_error":
        motive = reasons.get(reason, "Erreur du banc de rejeu") if isinstance(reason, str) else "Erreur du banc de rejeu"
    elif category == "engine_error":
        motive = "Erreur du moteur SIC ; détail conservé dans le rapport"
    elif category == "invalid_result":
        motive = "Résultat incohérent à vérifier ; détail conservé dans le rapport"
    elif category == "missing":
        motive = "Résultat absent après clôture de la campagne"
    elif isinstance(reason, str) and reason.startswith("composition_dependency_"):
        motive = "Dépendance de composition non satisfaite"
    else:
        motive = reasons.get(reason, "Autre arrêt ; motif brut dans le tableau détaillé") if isinstance(reason, str) else "Motif d'arrêt non disponible"
    if game["stopBudgetBasis"] == "no_level_reference":
        motive += " ; plafond de repli sans référence individuelle"
    return [level_text, f"{cell(game['levelsScored'])}/{game['expectedLevels']}", moves, timing, motive]


def readme_text(report):
    a = report["aggregate"]
    lines = ["# Campagne SIC des 107 jeux", "", f"Instantané généré le {report['generatedAt']}.", "",
        f"**État : `{report['campaignState']}` — {a['gamesWithResult']}/107 résultats reçus.**",
        f"Source figée : `{COMMIT}`. Périmètre : **107 jeux / 692 niveaux**.", "",
        f"**{a['publicCompleteGames']} jeux ont tous leurs scores publics ; {a['reconciledCompleteGames']} ont aussi leur réconciliation finale attestée.**",
        f"Niveaux publiquement gagnés confirmés : **{a['publicLevelsScored']}/692** ; réconciliation attestée : **{a['levelsReconciled']}**.",
        f"Commandes connues : **{a['knownActions']}**, dont **{a['knownSicAuthorizedActions']}** attribuées à SIC.", "",
        f"En attente : **{a['pendingGames']}**. Manquants après clôture : **{a['missingGames']}**. Résultats avec incohérence : **{a['gamesWithAuditIssues']}**.", "",
        "Les scores acquis sont conservés en cas d'arrêt pendant la transition. `complete_unsettled` distingue une victoire publique complète d'une réconciliation finale non attestée.",
        "Un jeu en attente n'est pas un échec. L'absence du reçu de fin maintient le statut en attente ; ce rapport ne sonde pas le processus.",
        "Les erreurs du banc sont séparées des arrêts du solveur. Les résultats invalides ne contribuent pas aux totaux. Les compteurs absents restent inconnus et ne sont pas inventés.",
        "Le contrôle de réconciliation repose sur les comptes rendus de l'enfant ; il ne remplace pas le contrôle détaillé des tickets de continuité.", "",
        "Les plafonds sont comparés exactement à l'export du module de budgets inchangé : 432 niveaux avec temps mesuré, 57 avec temps estimé depuis les commandes, et 203 sans référence individuelle (repli : 80 commandes / 90 secondes). Un arrêt au repli ne suffit pas à identifier un défaut du solveur.", "",
        f"Compteurs de récupération connus : **{a['knownResets']} réinitialisations**, **{a['knownUndos']} retours arrière**. Parmi les résultats valides reçus, {a['gamesWithUnknownResetCount']} n'ont pas de compteur de réinitialisation et {a['gamesWithUnknownUndoCount']} n'ont pas de compteur de retour arrière.", "",
        "## Catégories", "", "| Catégorie | Jeux |", "|---|---:|"]
    lines.extend(f"| {category} | {count} |" for category, count in a["categories"].items())
    lines.extend(["", "## Jeux incomplets et résultats à vérifier", "",
        "Les coups et les temps de ce tableau concernent le niveau d'arrêt. Une transition interrompue conserve le score déjà acquis. L'allocation de réconciliation affichée est recalculée avec la règle du surveillant à partir des mesures arrondies ; elle est distincte du plafond jusqu'au score.",
        "Les jeux encore en attente figurent dans le tableau exhaustif qui suit.", ""])
    incomplete = [game for game in report["games"] if game["terminalCategory"] not in {"complete", "pending"}]
    if incomplete:
        lines.extend(["| Jeu | Niveau d'arrêt | Gagnés / cible | Coups du niveau / plafond du niveau | Temps observé / plafond | Motif |",
            "|---|---|---:|---:|---|---|"])
        for game in incomplete:
            lines.append("| " + " | ".join(cell(value) for value in [game["code"], *incomplete_details(game)]) + " |")
    else:
        lines.append("Aucun résultat incomplet reçu à cet instant.")
    lines.extend(["", "## Verdicts par jeu", "", "| Jeu | Score public | Réconciliés | Verdict | Étape | Coups | Base du plafond | Raison brute |", "|---|---:|---:|---|---|---:|---|---|"])
    for game in report["games"]:
        score = f"{cell(game['levelsScored'])}/{game['expectedLevels']}"
        lines.append(f"| {game['code']} | {score} | {game['levelsReconciled']} | {game['terminalCategory']} | {cell(game['stopStage'])} | {cell(game['actions'])} | {cell(game['stopBudgetBasis'])} | {cell(game['rawReason'])} |")
    lines.extend(["", "## Mesures jusqu'au score", "",
        f"{a['scoresWithTiming']} scores ont un temps disponible ; {a['scoresWithoutTiming']} scores n'en ont pas. Dépassement rapporté cumulé : **{a['scoreDeadlineOverrunMs']} ms** ; maximum : **{a['scoreDeadlineMaxOverrunMs']} ms**.",
        "Seul `scoredMs` est comparé au plafond de résolution. La durée totale et la réconciliation ne sont pas comparées à ce plafond. Les éventuels dépassements restent distincts du score public et du verdict brut ; les mesures arrondies et l'ordonnancement IPC devront être interprétés à l'audit final.", ""])
    if report["timingWarnings"]:
        lines.extend(["| Jeu | Niveau | Score à (ms) | Plafond (ms) | Dépassement rapporté (ms) |", "|---|---:|---:|---:|---:|"])
        lines.extend(f"| {w['code']} | {w['level']} | {w['scoredMs']} | {w['resolutionCapMs']} | {w['scoreDeadlineOverrunMs']} |" for w in report["timingWarnings"])
    else:
        lines.append("Aucun dépassement rapporté parmi les scores dont le temps est disponible.")
    lines.extend(["", "## Contrôle et provenance", "",
        f"Couverture complète : **{report['coverageComplete']}**. Contrôles de cet instantané : **{report['auditPassed']}**.",
        "Les plafonds rapportés sont comparés, champs et sources compris, aux plafonds exportés par le module pur du SHA évalué.", ""])
    messages = report["auditIssues"] + report["warnings"]
    messages += [f"{game['code']}: {issue}" for game in report["games"] for issue in game["auditIssues"]]
    lines.extend([f"- {cell(message)}" for message in messages] or ["Aucune incohérence détectée dans cet instantané."])
    lines.extend(["", "Fichiers bruts : `manifest.json`, `expected-budgets.json`, `execution-start.json`, `execution-end.json` quand disponible, `results.jsonl` ou `results.jsonl.gz`.",
        "Si le JSONL est absent, l'archive gzip est lue et décompressée en mémoire, sans créer de fichier brut. L'empreinte principale porte toujours sur les octets JSONL décompressés ; l'empreinte du conteneur compressé est conservée séparément.",
        "Les empreintes des octets lus figurent dans `report.json`. Les fichiers bruts ne sont jamais modifiés par ce script.", "",
        "Régénération légère, sans rejeu, depuis le dossier contenant ce rapport :", "", "```bash", "python summarize.py", "```", ""])
    return "\n".join(lines)


def atomic_write(name, text):
    path = ROOT / name
    temporary = ROOT / f".{name}.{os.getpid()}.tmp"
    try:
        temporary.write_text(text, encoding="utf-8")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def self_test():
    def sample():
        levels = [{"level": i, "won": True, "actions": 1, "ms": 12, "activeMs": 11, "scoredMs": 8,
            "settlementMs": 4, "budget": {"actions": 5, "activeTimeMs": 100}, "prefixHash": "a" * 64,
            "graph": "b" * 64, "acquiredRecords": i} for i in range(1, 7)]
        return {"code": "AMZE", "target": 6, "mode": "sic", "parallelWorkers": 1, "status": "stopped",
            "reason": "target_levels_completed", "actions": 6, "authority": 6, "levels": 6, "levelStats": levels, "trace": "a" * 64}
    normal = sample()
    assert analyze("AMZE", normal, 1)["terminalCategory"] == "complete"
    unsettled = sample()
    for key in ("trace", "mode", "parallelWorkers"):
        unsettled.pop(key)
    for key in ("activeMs", "prefixHash", "graph", "acquiredRecords"):
        unsettled["levelStats"][-1].pop(key)
    result = analyze("AMZE", unsettled, 1)
    assert result["terminalCategory"] == "complete_unsettled" and result["levelsScored"] == 6 and result["levelsReconciled"] == 5
    timeout = sample()
    timeout.update(levels=5, reason="level_wall_time_budget")
    timeout["levelStats"][-1]["won"] = False
    assert analyze("AMZE", timeout, 1)["terminalCategory"] == "time"
    transition = sample()
    transition.update(levels=5, actions=5, authority=5, reason="level_transition_wall_time_budget")
    transition["levelStats"].pop()
    assert analyze("AMZE", transition, 1)["stopStage"] == "transition"
    broken = sample()
    broken["target"] = 5
    assert not analyze("AMZE", broken, 1)["countsEligible"]
    changed_budget = sample()
    expected_budgets = [dict(item["budget"]) for item in changed_budget["levelStats"]]
    changed_budget["levelStats"][-1]["budget"]["activeTimeMs"] += 1
    assert "archived_budget_mismatch:6" in analyze("AMZE", changed_budget, 1, expected_budgets)["auditIssues"]
    late_score = sample()
    late_score["levelStats"][-1]["scoredMs"] = 1100
    late_score["levelStats"][-1]["ms"] = 1104
    late = analyze("AMZE", late_score, 1)
    assert late["terminalCategory"] == "complete" and late["allLevelsScored"] and late["countsEligible"]
    assert late["timingConformance"] == "reported_overrun" and late["scoreDeadlineOverrunMs"] == 1000
    assert late["levels"][-1]["scoreDeadlineOverrunMs"] == 1000
    long_settlement = sample()
    long_settlement["levelStats"][-1].update(ms=1500, activeMs=1490, settlementMs=1492)
    assert analyze("AMZE", long_settlement, 1)["timingConformance"] == "within_reported_caps"
    assert analyze("AMZE", normal, 1)["resetCount"] is None
    known_recoveries = sample()
    known_recoveries["recoveries"] = {"reset": 0, "undo": 2}
    recovery = analyze("AMZE", known_recoveries, 1)
    assert recovery["resetCount"] == 0 and recovery["undoCount"] == 2
    error = {"code": "AMZE", "status": "harness_error", "message": "startup failure"}
    assert analyze("AMZE", error, 1)["terminalCategory"] == "harness_error"
    assert empty_game("AMZE", False)["terminalCategory"] == "pending"
    assert empty_game("AMZE", True)["terminalCategory"] == "missing"
    assert parse_results(b'{"code":"AMZE"', False) == ([], [], ["live_trailing_append_ignored:line_1"])
    assert parse_results(b'{"code":"AMZE"', True)[1]
    assert len(CODES) == len(set(CODES)) == 107 and sum(COUNTS.values()) == 692
    print("self-test: focused classification/timing/recovery checks passed; no games run, no output files written")


def main():
    try:
        os.nice(10)
    except (AttributeError, OSError):
        pass
    if sys.argv[1:] == ["--self-test"]:
        self_test()
        return 0
    if len(sys.argv) != 1:
        raise SystemExit("Usage: python summarize.py [--self-test]")
    report = build_report()
    atomic_write("report.json", json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    atomic_write("verdicts.csv", csv_text(report))
    atomic_write("README.md", readme_text(report))
    print(json.dumps({"campaignState": report["campaignState"], "auditPassed": report["auditPassed"], **report["aggregate"]}, ensure_ascii=False))
    return 0 if report["auditPassed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
