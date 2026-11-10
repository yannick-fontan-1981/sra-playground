#!/usr/bin/env python3
"""Review a complete cost window under its predeclared global-session policy.

Usage: python -B scripts/review-native-global-cost-window.py AGGREGATE DECLARATION OUTPUT
       --lot 3C --native-version 0.43.0
Preflight: python -B scripts/review-native-global-cost-window.py --check-protocol DECLARATION

Reads existing evidence only. Imports the unchanged 3B reviewer's strict numeric
and safe-read helpers; never modifies its generator, decision or old protocols.
All original phase metrics and p95 observations remain in the new receipt.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import statistics
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "scripts/review-native-global-cost-budget.py"
HELPER_SHA256 = "b4312bcdae058ba58c16b4e5e24cb53626496b38f8a154834e0452a43e97d341"
if hashlib.sha256(HELPER.read_bytes()).hexdigest() != HELPER_SHA256:
    raise ValueError("Retained 3B calculation helper changed")
spec = importlib.util.spec_from_file_location("retained_global_cost_budget", HELPER)
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)
read, require, within = legacy.read, legacy.require, legacy.within


def fingerprint(path):
    path = (ROOT / path).resolve()
    path.relative_to(ROOT)
    data = path.read_bytes()
    return {"path": path.relative_to(ROOT).as_posix(), "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest()}


def verify(record):
    require(fingerprint(record["path"]) == record, "Declared fingerprint changed: " + record["path"])
    return record


def canonical_ledger(rows):
    """Compare complete rows independently of enumeration order, retaining multiplicity."""
    return sorted(json.dumps(row, sort_keys=True, separators=(",", ":"), allow_nan=False) for row in rows)


def verify_consolidation(aggregate, aggregate_record, window_record, declared):
    """Bind copied diagnostics to the unchanged independent arithmetic review."""
    review_path = (ROOT / aggregate_record["path"]).parent / "consolidation-review.json"
    review, review_record = read(review_path)
    require(review["schema"] == "logos-engine.native-cost-consolidation-review.v2" and review["status"] == "passed",
            "Independent consolidation arithmetic review is missing or failed")
    reviewer = next(record for record in declared["officialTools"]
                    if record["path"] == "scripts/review-native-cost-consolidation.py")
    require(review["generator"] == reviewer, "Consolidation review generator differs from predeclared unchanged tool")
    verify(reviewer)
    require(review["checkedCount"] == len(review["checks"]) > 0
            and all(check["passed"] is True for check in review["checks"]), "Consolidation review checks are incomplete")
    records = [verify(record) for record in review["inputs"]]
    require(len({record["path"] for record in records}) == len(records), "Duplicate consolidation review input")
    require(aggregate_record in records and window_record in records, "Consolidation review names another aggregate or window")
    for cohort in aggregate["inputs"]["cohorts"]:
        require(all(cohort[key] in records for key in ("baseline", "after", "originalComparison")),
                "Consolidation review does not bind every raw cohort and original comparison")
    require(review["sources"] == aggregate["sources"] and review["budgetStatus"] == aggregate["status"]
            and review["budget"]["metrics"] == aggregate["budgetMetricCount"] == declared["diagnosticMetrics"]
            and review["budget"]["withinObservedBudget"] == aggregate["withinObservedBudget"]
            and review["budget"]["unresolved"] == aggregate["unresolved"], "Consolidation review diagnostic verdict differs")
    return review, review_record, records


def instant(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(result.tzinfo is not None, "Timestamp must have an explicit timezone")
    return result


def protocol(declaration_path):
    declaration, declaration_record = read(declaration_path)
    require(declaration["schema"] == "logos-engine.native-cost-protocol-declaration.v2", "Unexpected declaration schema")
    require(declaration["status"] == "declared_before_official_window" and declaration["noOfficialWindowAtDeclaration"] is True,
            "Policy was not declared before its official window")
    keys = ("protocol", "cases", "diagnosticComparisonPolicy", "globalBudgetPolicy", "baselineManifest",
            "candidateManifest", "candidateArchiveManifest", "globalDecisionTool", "globalCalculationTool")
    records = [declaration_record] + [verify(declaration[key]) for key in keys]
    records += [verify(record) for record in declaration["officialTools"]]
    require(declaration["globalDecisionTool"] == fingerprint(__file__), "Final global reviewer is not bound to this declaration")
    require(declaration["globalCalculationTool"] == fingerprint(HELPER), "Retained calculation helper is not bound")
    policy, _ = read(declaration["globalBudgetPolicy"]["path"])
    cases, _ = read(declaration["cases"]["path"])
    baseline, _ = read(declaration["baselineManifest"]["path"])
    candidate, _ = read(declaration["candidateManifest"]["path"])
    require(policy["schema"] == "logos-engine.native-global-cost-policy.v1", "Unexpected global policy schema")
    exact = {"globalStage": "session_elapsed", "relativeIncreaseLimit": 0.1, "comparison": "strictly_less_than",
             "allCasesMustPass": True, "crossCaseCompensation": False, "phaseOverrunsMayBeAccepted": True,
             "phasesAndP95RemainVisible": True, "excludedMeasuredSessions": 0, "excludedOutliers": 0,
             "plannedOrder": ["A1", "B1", "B2", "A2"], "cohorts": 2}
    require(all(policy.get(k) == v and type(policy.get(k)) is type(v) for k, v in exact.items()), "Global policy contract changed")
    require(policy["authorization"]["verbatim"] == legacy.USER_QUOTE, "User authorization differs")
    require(policy["diagnosticPhasePolicy"] == declaration["diagnosticComparisonPolicy"]["path"], "Diagnostic policy differs")
    require(policy["caseIds"] == [case["id"] for case in cases["cases"]]
            and len(set(policy["caseIds"])) == len(policy["caseIds"]) > 0, "Declared case identities differ")
    require(type(cases["rounds"]) is int and cases["rounds"] > 0
            and cases["rounds"] == policy["sessionsPerCaseVersionCohort"], "Declared session count differs")
    for key in ("plannedOrder", "cohorts", "sessionsPerCaseVersionCohort", "measuredSessions", "measuredActions",
                "excludedWarmupSessions", "excludedWarmupActions", "allCasesMustPass", "crossCaseCompensation"):
        require(declaration[key] == policy[key], "Declaration and global policy differ: " + key)
    require(declaration["relativeGlobalBudget"] == policy["relativeIncreaseLimit"]
            and declaration["globalComparison"] == policy["comparison"]
            and declaration["phaseOverrunsBlockAcceptance"] is False, "Declared acceptance criterion differs")
    for role, manifest in (("baseline", baseline), ("candidate", candidate)):
        identity = policy[role]
        require(identity["nativeDigest"] == manifest["digest"] == declaration["nativeDigests"][role]
                and identity["nativeFiles"] == manifest["fileCount"] == len(manifest["files"]), "Declared native identity differs")
        require(hashlib.sha256(json.dumps(dict(sorted(manifest["files"].items())), separators=(",", ":")).encode()).hexdigest()
                == manifest["digest"], "Native manifest digest differs from its files")
    require(policy["baseline"]["nativeDigest"] != policy["candidate"]["nativeDigest"], "A and B must identify distinct native revisions")
    require(instant(policy["declaredAt"]) <= instant(declaration["recordedAt"]) <= instant(declaration["finalizedAt"]),
            "Protocol declaration timestamps are inconsistent")
    text = (ROOT / declaration["protocol"]["path"]).read_text()
    for key in ("globalBudgetPolicy", "globalDecisionTool", "globalCalculationTool"):
        require(declaration[key]["sha256"] in text, "Watched protocol does not commit to " + key)
    return declaration, policy, cases, baseline, candidate, records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("aggregate", "declaration", "output"):
        parser.add_argument(name, nargs="?")
    parser.add_argument("--lot")
    parser.add_argument("--native-version")
    parser.add_argument("--check-protocol", metavar="DECLARATION")
    args = parser.parse_args()
    if args.check_protocol:
        require(not any((args.aggregate, args.declaration, args.output, args.lot, args.native_version)), "Preflight takes only --check-protocol")
        declared, policy, _, _, _, _ = protocol(args.check_protocol)
        print(json.dumps({"status": "protocol_contract_passed", "declaration": args.check_protocol,
                          "finalizedAt": declared["finalizedAt"], "nativeDigests": declared["nativeDigests"],
                          "caseIds": policy["caseIds"], "measurementExecuted": False}))
        return
    require(all((args.aggregate, args.declaration, args.output, args.lot, args.native_version)), "Missing review arguments")
    output = (ROOT / args.output).resolve()
    output.relative_to(ROOT)
    require(not output.exists(), "Decision output already exists")
    declared, policy, cases, baseline, candidate, inputs = protocol(args.declaration)
    require(args.native_version == policy["candidate"]["nativeVersion"], "Candidate version differs from predeclared identity")
    aggregate, aggregate_record = read(args.aggregate)
    window_path = (ROOT / args.declaration).resolve().parent / "window.json"
    window, window_record = read(window_path)
    inputs += [aggregate_record, window_record]
    arithmetic, arithmetic_record, arithmetic_inputs = verify_consolidation(aggregate, aggregate_record, window_record, declared)
    inputs += [arithmetic_record, *arithmetic_inputs]
    require(aggregate["schema"] == "logos-engine.native-loop-cost-cohort-comparison.v1", "Unexpected aggregate schema")
    require(window["schema"] == "logos-engine.native-cost-window.v1" and window["status"] == "passed"
            and window["finalIntegrity"] == "passed", "Official window is incomplete or changed")
    require(instant(declared["finalizedAt"]) < instant(window["startedAt"]), "Final protocol was not declared before window start")
    require(window["plannedOrder"] == policy["plannedOrder"]
            == [execution["label"] for execution in window["executions"]], "Window execution order differs")
    watched_protocol = [item for item in window["inputs"]
                        if Path(item["path"]).resolve() == (ROOT / declared["protocol"]["path"]).resolve()]
    require(len(watched_protocol) == 1 and watched_protocol[0]["sha256"] == declared["protocol"]["sha256"],
            "Pre-window watched protocol fingerprint differs")
    require(window["nativeDigests"] == {"baseline": baseline["digest"], "correction": candidate["digest"]}, "Window source identities differ")
    require(aggregate["sources"] == {"baseline": {k: baseline[k] for k in ("digest", "fileCount")},
                                     "after": {k: candidate[k] for k in ("digest", "fileCount")}}, "Aggregate source identities differ")
    method = aggregate["method"]
    require(method["excludedMeasuredSessions"] == 0 and method["excludedOutliers"] == 0
            and method["selectedCohort"] is None and method["noiseAllowanceAdded"] is False, "Measured sessions or budget were adjusted")
    require(aggregate["inputs"]["policy"] == declared["diagnosticComparisonPolicy"], "Aggregate diagnostic policy differs")
    expected_ids = policy["caseIds"]
    require([case["case"] for case in aggregate["comparisons"]] == expected_ids, "Aggregate case identities differ")
    cohorts = aggregate["inputs"]["cohorts"]
    require(len(cohorts) == policy["cohorts"] and len({c["id"] for c in cohorts}) == len(cohorts), "Cohort count differs")
    pooled = {case: {"baseline": [], "after": []} for case in expected_ids}
    sessions, expected_ledger, warmups = [], [], []
    runner = next(record for record in declared["officialTools"] if record["path"] == "scripts/measure-native-loop-costs.mjs")
    require(window["runnerSha256"] == runner["sha256"], "Window runner differs")
    execution_by_label = {row["label"]: row for row in window["executions"]}
    previous_finish = instant(window["startedAt"])
    for execution in window["executions"]:
        require(execution["status"] == "passed" and execution["exitCode"] == 0, "A declared execution failed")
        require(previous_finish <= instant(execution["startedAt"]) <= instant(execution["finishedAt"])
                <= instant(window["finishedAt"]), "Execution chronology differs")
        previous_finish = instant(execution["finishedAt"])
    for index, cohort in enumerate(cohorts, start=1):
        for side, prefix, manifest in (("baseline", "A", baseline), ("after", "B", candidate)):
            report, actual = read(cohort[side]["path"])
            require(actual == cohort[side], "Retained cohort fingerprint changed")
            inputs.append(actual)
            execution = execution_by_label[prefix + str(index)]
            require(execution["reportSha256"] == actual["sha256"] and execution["nativeDigest"] == manifest["digest"], "Execution report identity differs")
            require(report["schema"] == "logos-engine.native-loop-costs.v1" and report["status"] == "passed"
                    and report["nativeSourceUnchanged"] is True and report["nativeSource"] == manifest
                    and report["generator"] == runner, "Raw report does not bind the declared unchanged source and runner")
            require(report["manifest"] == cases and declared["cases"] in report["inputs"], "Raw report cases differ")
            require([case["id"] for case in report["cases"]] == expected_ids, "Raw report case order differs")
            for case, case_policy in zip(report["cases"], cases["cases"]):
                measured = [trial for trial in case["trials"] if trial["warmup"] is False]
                warm = [trial for trial in case["trials"] if trial["warmup"] is True]
                require(len(measured) == cases["rounds"] and len(warm) == 1 and len(case["trials"]) == len(measured) + 1,
                        "Raw report session count differs")
                require([trial["round"] for trial in measured] == list(range(1, cases["rounds"] + 1)), "Measured rounds differ")
                require(warm[0]["round"] == 0 and warm[0]["actions"] == case_policy["warmupActions"], "Declared warmup differs")
                for trial in case["trials"]:
                    require(trial["case"] == case["id"] and instant(execution["startedAt"]) <= instant(trial["startedAt"])
                            <= instant(trial["finishedAt"]) <= instant(execution["finishedAt"]), "Trial identity or chronology differs")
                    if trial["warmup"]:
                        warmups.append({"cohort": cohort["id"], "side": side, "case": case["id"], "actions": trial["actions"]})
                        continue
                    require(trial["actions"] == case_policy["actions"], "Measured action count differs")
                    elapsed = trial["replayElapsedMs"]
                    require(type(elapsed) in (int, float) and math.isfinite(elapsed) and elapsed > 0, "Invalid elapsed time")
                    pooled[case["id"]][side].append(elapsed)
                    row = {"cohort": cohort["id"], "side": side, "case": case["id"], "round": trial["round"],
                           "startedAt": trial["startedAt"], "actions": trial["actions"], "elapsedMs": elapsed}
                    sessions.append(row)
                    expected_ledger.append({k: v for k, v in row.items() if k != "elapsedMs"} | {
                        "finishedAt": trial["finishedAt"], "levelsCompleted": trial["levelsCompleted"],
                        "sampleCount": len(trial["samples"]), "requestCount": len(trial["requests"])})
    require(canonical_ledger(expected_ledger) == canonical_ledger(aggregate["includedMeasuredSessions"]),
            "Aggregate measured-session rows or their multiplicities differ from raw reports")
    require(len({(s["cohort"], s["side"], s["case"], s["round"], s["startedAt"]) for s in sessions}) == len(sessions), "Duplicate measured session")
    require(len(sessions) == policy["measuredSessions"] and sum(s["actions"] for s in sessions) == policy["measuredActions"], "Declared totals differ")
    require(len(warmups) == policy["excludedWarmupSessions"] and sum(s["actions"] for s in warmups) == policy["excludedWarmupActions"], "Warmup totals differ")
    decisions, phases = [], []
    for case in aggregate["comparisons"]:
        metrics = [metric for metric in case["metrics"] if metric["stage"] == policy["globalStage"]]
        require(len(metrics) == 1, "Missing or duplicate global metric")
        metric, medians = metrics[0], {}
        for side, label in (("baseline", "before"), ("after", "after")):
            values = pooled[case["case"]][side]
            require(len(values) == policy["cohorts"] * cases["rounds"] == metric[label]["count"] == case["measuredSessionsPerVersion"], "Pooled count differs")
            medians[side] = statistics.median(values)
            require(medians[side] == metric[label]["medianMs"], "Aggregate global median differs from raw sessions")
        relative = (medians["after"] - medians["baseline"]) / medians["baseline"]
        require(math.isclose(relative, metric["medianRelativeIncrease"], rel_tol=1e-12, abs_tol=1e-12), "Aggregate global ratio differs")
        accepted = within(medians["baseline"], medians["after"])
        decisions.append({"case": case["case"], "sessionsPerVersion": len(pooled[case["case"]]["baseline"]),
                          "beforeMedianMs": medians["baseline"], "afterMedianMs": medians["after"],
                          "medianRelativeIncrease": relative, "accepted": accepted,
                          "result": "within_user_global_budget" if accepted else "global_budget_exceeded"})
        phases.extend({"case": case["case"], **metric} for metric in case["metrics"] if metric["stage"] != policy["globalStage"])
    accepted = all(case["accepted"] for case in decisions)
    result = {"schema": "logos-engine.predeclared-global-cost-window-decision.v1",
              "recordedAt": datetime.now(timezone.utc).isoformat(), "lot": args.lot, "nativeVersion": args.native_version,
              "status": "accepted_under_user_global_rule" if accepted else "global_budget_review_required", "accepted": accepted,
              "authorization": policy["authorization"], "policy": policy, "sources": aggregate["sources"],
              "predeclaration": {"recordedAt": declared["recordedAt"], "finalizedAt": declared["finalizedAt"],
                                 "windowStartedAt": window["startedAt"], "watchedProtocolMatched": True,
                                 "policyAndReviewersCommittedByWatchedProtocol": True},
              "inputs": inputs, "generator": fingerprint(__file__), "calculationHelper": fingerprint(HELPER),
              "globalCases": decisions, "acceptedCases": sum(case["accepted"] for case in decisions), "totalCases": len(decisions),
              "measuredSessions": len(sessions), "measuredActions": sum(s["actions"] for s in sessions),
              "excludedWarmupSessions": len(warmups), "excludedWarmupActions": sum(s["actions"] for s in warmups),
              "diagnosticPhaseRule": {"status": aggregate["status"], "budgetMetricCount": aggregate["budgetMetricCount"],
                                      "withinObservedBudget": aggregate["withinObservedBudget"], "unresolved": aggregate["unresolved"]},
              "diagnosticArithmeticReview": {"receipt": arithmetic_record, "generator": arithmetic["generator"],
                                             "status": arithmetic["status"], "checkedCount": arithmetic["checkedCount"],
                                             "budgetStatus": arithmetic["budgetStatus"],
                                             "qualification": "This reviewer recalculates global medians. Phase metrics are copied unchanged from the aggregate and bound to this separately retained, passed independent arithmetic review; its exact inputs and generator are verified."},
              "retainedPhaseMetrics": phases, "sessionLedger": sessions,
              "qualifications": ["The user-authorized global rule and exact source identities were declared before this new window; historical measurements and decisions are unchanged.",
                                 "Every measured session and both cohorts are pooled. Only the predeclared warmups are excluded. No cross-game compensation, selected cohort or extra noise allowance.",
                                 "Global means each case's complete measured session, never a sum of nested phase medians. The strict threshold uses the unchanged retained reviewer's decimal comparison.",
                                 "All phase regressions and p95 observations remain diagnostic evidence, without establishing their cause or live-game latency.",
                                 "Functional gates, contribution and the explicitly partial source-transfer scope remain separate from cost acceptance."]}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x") as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    print(json.dumps({"status": result["status"], "output": output.relative_to(ROOT).as_posix(),
                      "acceptedCases": result["acceptedCases"], "totalCases": result["totalCases"],
                      "sessions": len(sessions), "actions": result["measuredActions"]}))


if __name__ == "__main__":
    main()
