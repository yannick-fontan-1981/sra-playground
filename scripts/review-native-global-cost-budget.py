#!/usr/bin/env python3
"""Apply the user's global-session cost rule without rewriting phase evidence.

Usage: python -B scripts/review-native-global-cost-budget.py AGGREGATE OUTPUT
       --lot 3B --native-version 0.42.0

Reads retained cohort reports, independently pools complete measured-session
durations, checks their aggregate medians, and writes one new decision receipt.
It does not run a benchmark or modify its inputs. Existing output is refused.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import math
from pathlib import Path
import statistics

ROOT = Path(__file__).resolve().parents[1]
USER_QUOTE = "si le global reste en dessous de 10% d'augmentation alors une phase qui dépasse 10% peut être accepté."


def require(value, message):
    if not value:
        raise ValueError(message)


def read(path):
    path = Path(path)
    if not path.is_absolute():
        path = ROOT / path
    path = path.resolve()
    path.relative_to(ROOT)
    data = path.read_bytes()
    return json.loads(data), {"path": str(path.relative_to(ROOT)), "bytes": len(data),
                             "sha256": hashlib.sha256(data).hexdigest()}


def within(before, after):
    require(all(type(v) in (float, int) and math.isfinite(v) and v > 0 for v in (before, after)),
            "Global medians must be finite and positive")
    # Decimal comparison preserves the strict user threshold at exactly +10%.
    return Decimal(str(after)) < Decimal(str(before)) * Decimal("1.1")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("aggregate")
    parser.add_argument("output")
    parser.add_argument("--lot", required=True)
    parser.add_argument("--native-version", required=True)
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    output.relative_to(ROOT)
    require(not output.exists(), "Decision output already exists")
    aggregate, aggregate_record = read(args.aggregate)
    require(aggregate["schema"] == "logos-engine.native-loop-cost-cohort-comparison.v1", "Unexpected aggregate schema")
    require(aggregate["method"]["excludedMeasuredSessions"] == 0 and aggregate["method"]["excludedOutliers"] == 0,
            "Global decision requires all declared measured sessions")
    comparisons = aggregate["comparisons"]
    require(bool(comparisons) and len({c["case"] for c in comparisons}) == len(comparisons), "Missing or duplicate cases")
    expected_cases = {c["case"] for c in comparisons}
    pooled = {case: {"baseline": [], "after": []} for case in expected_cases}
    sessions = []
    inputs = [aggregate_record]
    for cohort in aggregate["inputs"]["cohorts"]:
        for side in ("baseline", "after"):
            declared = cohort[side]
            report, actual = read(declared["path"])
            require(actual == declared, "Retained report fingerprint changed")
            inputs.append(actual)
            require({c["id"] for c in report["cases"]} == expected_cases, "Report cases differ")
            for case in report["cases"]:
                for trial in case["trials"]:
                    if trial["warmup"]:
                        continue
                    elapsed = trial["replayElapsedMs"]
                    require(type(elapsed) in (int, float) and math.isfinite(elapsed) and elapsed > 0, "Invalid elapsed time")
                    pooled[case["id"]][side].append(elapsed)
                    sessions.append({"cohort": cohort["id"], "side": side, "case": case["id"],
                                     "round": trial["round"], "startedAt": trial["startedAt"],
                                     "actions": trial["actions"], "elapsedMs": elapsed})
    require(len({(s["cohort"], s["side"], s["case"], s["round"], s["startedAt"]) for s in sessions}) == len(sessions),
            "Duplicate measured session identity")
    decisions = []
    phases = []
    for case in comparisons:
        metrics = [m for m in case["metrics"] if m["stage"] == "session_elapsed"]
        require(len(metrics) == 1, "Missing or duplicate session metric")
        metric = metrics[0]
        values = pooled[case["case"]]
        medians = {}
        for side, label in (("baseline", "before"), ("after", "after")):
            require(len(values[side]) == metric[label]["count"] == case["measuredSessionsPerVersion"], "Session count changed")
            medians[side] = statistics.median(values[side])
            require(medians[side] == metric[label]["medianMs"], "Aggregate global median differs from original sessions")
        relative = (medians["after"] - medians["baseline"]) / medians["baseline"]
        require(math.isclose(relative, metric["medianRelativeIncrease"], rel_tol=1e-12, abs_tol=1e-12), "Aggregate ratio differs")
        accepted = within(medians["baseline"], medians["after"])
        decisions.append({"case": case["case"], "sessionsPerVersion": len(values["baseline"]),
                          "beforeMedianMs": medians["baseline"], "afterMedianMs": medians["after"],
                          "medianRelativeIncrease": relative, "accepted": accepted,
                          "result": "within_user_global_budget" if accepted else "global_budget_exceeded"})
        phases.extend({"case": case["case"], **m} for m in case["metrics"] if m["stage"] != "session_elapsed")
    require(len(sessions) == len(aggregate["includedMeasuredSessions"]), "Aggregate session ledger count differs")
    accepted = all(c["accepted"] for c in decisions)
    script = Path(__file__)
    script_bytes = script.read_bytes()
    result = {
        "schema": "logos-engine.user-global-cost-budget-decision.v1",
        "recordedAt": datetime.now(timezone.utc).isoformat(), "lot": args.lot,
        "nativeVersion": args.native_version, "status": "accepted_under_user_global_rule" if accepted else "global_budget_review_required",
        "accepted": accepted,
        "authorization": {"source": "explicit user message in this task", "date": "2026-11-10", "verbatim": USER_QUOTE},
        "policy": {"globalStage": "session_elapsed", "statistic": "pooled median of complete measured-session durations per case",
                   "relativeIncreaseLimit": 0.1, "comparison": "strictly_less_than", "allCasesMustPass": True,
                   "crossCaseCompensation": False, "phaseOverrunsMayBeAccepted": True,
                   "phasesAndP95RemainVisible": True, "excludedMeasuredSessions": 0, "excludedOutliers": 0,
                   "qualification": "User-authorized decision rule change after the retained measurement; no retroactive change to its protocol or results."},
        "sources": aggregate["sources"], "inputs": inputs,
        "generator": {"path": str(script.relative_to(ROOT)), "bytes": len(script_bytes), "sha256": hashlib.sha256(script_bytes).hexdigest()},
        "globalCases": decisions, "acceptedCases": sum(c["accepted"] for c in decisions), "totalCases": len(decisions),
        "measuredSessions": len(sessions), "measuredActions": sum(s["actions"] for s in sessions),
        "historicalPhaseRule": {"status": aggregate["status"], "budgetMetricCount": aggregate["budgetMetricCount"],
                                "withinObservedBudget": aggregate["withinObservedBudget"], "unresolved": aggregate["unresolved"]},
        "retainedPhaseMetrics": phases, "sessionLedger": sessions,
        "qualifications": ["No benchmark rerun, selected cohort, new noise allowance or discarded measured session.",
                           "Global means each tested case's complete session, not a sum of nested phase medians or a compensation between games.",
                           "Per-phase and p95 regressions remain diagnostic observations; this decision does not establish their cause or live-game latency.",
                           "Functional gates and their original qualifications remain separate from this performance acceptance."]}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x") as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    print(json.dumps({"status": result["status"], "output": str(output.relative_to(ROOT)), "acceptedCases": result["acceptedCases"],
                      "totalCases": result["totalCases"], "sessions": len(sessions), "actions": result["measuredActions"]}))


if __name__ == "__main__":
    main()
