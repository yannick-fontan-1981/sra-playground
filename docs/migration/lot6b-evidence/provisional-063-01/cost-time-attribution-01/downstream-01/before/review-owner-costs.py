#!/usr/bin/env python3
"""Independently review the predeclared lot 6B owner-qualified cost evidence.

Usage: python -B docs/migration/lot6b-evidence/review-owner-costs.py CONTRACT AGGREGATE OUTPUT

This standard-library implementation reads retained evidence only. It never
imports the JavaScript consolidator or another review helper, starts a process,
changes a raw report, or rewrites the historical strict tool's failure. The
three retained Python sources listed in DERIVED_FROM identify the arithmetic
and protocol derivation; their exact bytes are checked before a new receipt.
Only the four predeclared structural paths may differ between versions. Every
warmup and measured session must match the fingerprinted functional fixture,
whose separate causal qualification is retained without reloading its graphs.
Failure writes no receipt and reports structuralProof:false on standard error.
"""
# Directly adapted from the immutable published lot6A tool. Exact source bytes,
# fingerprints and review diffs are retained in cost-review/attempt-01.
# No predecessor measurements are reused.
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
from statistics import median
import sys


ROOT = Path(__file__).resolve().parents[3]
PHASES = ["session_elapsed", "new_decision", "known_prefix_service", "known_prefix_request",
          "known_prefix_guard", "acquisition_and_persistence", "persistence", "restoration"]
CASE_IDS = ["STCK", "SMLP"]
ACTIONS = {"STCK": 10, "SMLP": 15}
ORDER = ["A1", "B1", "B2", "A2"]
OWNER = "selected_rigid"
PROGRAM = None
STRUCTURAL_EXPECTATION = {
    "ownerId": OWNER, "programId": PROGRAM,
    "installedNodeIds": ["family_state:" + OWNER, "family_activation:" + OWNER],
    "allowedPaths": ["observations[*].nodeCount", "inspection[*].graphNodes", "final.nodeCount", "final.graphRevision"],
    "mode": "predeclared_functional_fixture",
    "qualification": "functional_structure_frozen_before_measurement",
}
SOURCE_PATHS = ['src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-selected-rigid.ts', 'src/logos-engine/v6-selected-rigid-types.ts', 'src/logos-engine/v6-selected-rigid-geometry.ts', 'src/logos-engine/v6-selected-rigid-search.ts', 'src/logos-engine/v6-knowledge-store.ts', 'src/logos-engine/kernel.ts']
USER_QUOTE = "si le global reste en dessous de 10% d'augmentation alors une phase qui dépasse 10% peut être accepté."
DERIVED_FROM = [
    {"path": "scripts/review-native-cost-consolidation.py", "bytes": 17810,
     "sha256": "b13174cec5befbb816e70554fd5d47da215eae941b983e66f05b9dd4417b3bd4"},
    {"path": "scripts/review-native-global-cost-window.py", "bytes": 22204,
     "sha256": "9ab2ecd9d6ddf234e96332421a6e55937a766495c1a20dd223f4441d6b516940"},
    {"path": "scripts/review-native-global-cost-budget.py", "bytes": 8476,
     "sha256": "b4312bcdae058ba58c16b4e5e24cb53626496b38f8a154834e0452a43e97d341"},
]


def same(left, right):
    """JSON structural equality with booleans distinct from numeric 0 and 1."""
    if isinstance(left, bool) or isinstance(right, bool):
        return type(left) is type(right) and left == right
    if type(left) in (int, float) and type(right) in (int, float):
        return math.isfinite(left) and math.isfinite(right) and left == right
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(same(left[key], right[key]) for key in left)
    if isinstance(left, list):
        return len(left) == len(right) and all(same(a, b) for a, b in zip(left, right))
    return left == right


def object_unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON object key: " + key)
        result[key] = value
    return result


def invalid_constant(value):
    raise ValueError("Non-finite JSON number: " + value)


def instant(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("Timestamp must include its timezone")
    return result


def without(value, fields):
    return {key: item for key, item in value.items() if key not in fields}


def numeric(value, positive=False):
    return type(value) in (int, float) and math.isfinite(value) and (value > 0 if positive else value >= 0)


def distribution(values):
    if not values or not all(numeric(value) for value in values):
        raise ValueError("Missing, negative or non-finite timing sample")
    ordered = sorted(values)
    count = len(ordered)
    return {"count": count, "medianMs": median(ordered),
            "p95Ms": ordered[math.ceil(count * 0.95) - 1] if count >= 20 else None,
            "minMs": ordered[0], "maxMs": ordered[-1]}


def samples(trial, phase):
    if phase == "session_elapsed":
        return [trial["replayElapsedMs"]]
    if phase in ("known_prefix_service", "known_prefix_request"):
        field = "nativeServiceMs" if phase == "known_prefix_service" else "wallMs"
        return [row[field] for row in trial["requests"] if row["type"] == "advance" and row["kind"] == "action"]
    return [row["elapsedMs"] for row in trial["samples"] if row["stage"] == phase]


def calculate(trials, phase):
    rows = [samples(trial, phase) for trial in trials]
    pooled = distribution([value for row in rows for value in row])
    centers = [median(row) for row in rows if row]
    center = median(centers)
    return pooled, (max(centers) - min(centers)) / center if center else None


def metric(left, right, phase):
    before, before_noise = calculate(left, phase)
    after, after_noise = calculate(right, phase)
    if before["count"] != after["count"] or before["medianMs"] <= 0:
        raise ValueError("Noncomparable work for phase " + phase)
    increase = after["medianMs"] / before["medianMs"] - 1
    result = "within_observed_budget" if increase <= 0.1 else (
        "over_budget_with_noise_unresolved" if max(before_noise or 0, after_noise or 0) > 0.1 else "over_budget")
    return {"stage": phase, "before": before, "after": after, "medianRelativeIncrease": increase,
            "roundMedianNoise": {"baselineRelativeRange": before_noise, "afterRelativeRange": after_noise},
            "budgetApplies": True, "result": result}


def unresolved_for(comparisons):
    return [{"case": row["case"], "stage": item["stage"], "result": item["result"],
             "medianRelativeIncrease": item["medianRelativeIncrease"]}
            for row in comparisons for item in row["metrics"] if item["result"] != "within_observed_budget"]


def within_decimal(before, after):
    if not all(numeric(value, positive=True) for value in (before, after)):
        raise ValueError("Global medians must be finite and positive")
    return Decimal(str(after)) < Decimal(str(before)) * Decimal("1.1")


def work(trial):
    """Retain the historical strict work signature before any structural check."""
    return {"case": trial["case"], "warmup": trial["warmup"], "actions": trial["actions"],
            "levelsCompleted": trial["levelsCompleted"], "cycles": trial["cycles"],
            "samples": [without(row, {"elapsedMs"}) for row in trial["samples"]],
            "requests": [without(row, {"wallMs", "nativeServiceMs", "transportAndSchedulingMs"}) for row in trial["requests"]],
            "observations": trial["observations"],
            "pauses": [without(row, {"requestedAt", "acknowledgementMs", "safeBoundaryMs"}) for row in trial["pauses"]],
            "inspection": [without(row, {"nativeServiceMs", "endToEndMs"}) for row in trial["inspection"]],
            "memorySamples": [without(row, {"heapUsed", "rss"}) for row in trial["memory"]],
            "final": without(trial["final"], {"implementation"})}


def functional_shape(trial):
    """Project only the exact predeclared timing-free functional shape."""
    return {"actions": trial["actions"], "cycles": trial["cycles"], "levelsCompleted": trial["levelsCompleted"],
            "requests": [{key: row[key] for key in ("type", "sequence", "kind", "actions")} for row in trial["requests"]],
            "observations": trial["observations"],
            "inspection": [{"graphNodes": row["graphNodes"]} for row in trial["inspection"]],
            "final": trial["final"]}


class Review:
    def __init__(self):
        self.checks = []
        self.retained = {}
        self.structural_rows = []
        # Premeasurement adaptation of the bounded path handling in 7A io-v1
        # (reviewer SHA-256 c95fd37389b7af18c049b6264fab968a52d4055f7c590004ecd4877d8b65044e).
        # The immutable baseline capture supplies the exact whitelist. There is
        # no 6B post-measurement correction receipt or alternate declared tool.
        self.baseline_attribution_root = None
        self.baseline_attribution_inputs = {}

    def check(self, name, condition):
        if not condition:
            raise ValueError("Owner-cost review failed: " + name)
        self.checks.append({"name": name, "passed": True})

    def equal(self, name, actual, expected):
        self.check(name, same(actual, expected))

    def local(self, name):
        path = Path(name)
        result = (ROOT / path).resolve()
        self.check("repository_path/" + str(name), result.is_relative_to(ROOT) and result != ROOT)
        return result

    def bytes(self, path, external=False):
        target = Path(path).resolve() if external else self.local(path)
        data = target.read_bytes()
        record = {"path": target.relative_to(ROOT).as_posix() if target.is_relative_to(ROOT) else str(target),
                  "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        previous = self.retained.setdefault(target, record)
        self.equal("stable_read/" + record["path"], record, previous)
        return data, record

    def read(self, path):
        data, record = self.bytes(path)
        if str(path).endswith(".gz"):
            data = gzip.decompress(data)
        value = json.loads(data, object_pairs_hook=object_unique, parse_constant=invalid_constant)
        return value, record

    def fingerprint(self, path):
        target = self.local(path)
        hasher, size = hashlib.sha256(), 0
        with target.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                size += len(chunk)
                hasher.update(chunk)
        record = {"path": target.relative_to(ROOT).as_posix(), "bytes": size, "sha256": hasher.hexdigest()}
        previous = self.retained.setdefault(target, record)
        self.equal("stable_fingerprint/" + record["path"], record, previous)
        return record

    def verify(self, record):
        self.check("fingerprint_shape", isinstance(record, dict) and set(record) == {"path", "bytes", "sha256"}
                   and isinstance(record["path"], str) and not Path(record["path"]).is_absolute()
                   and type(record["bytes"]) is int and record["bytes"] >= 0
                   and isinstance(record["sha256"], str) and re.fullmatch(r"[0-9a-f]{64}", record["sha256"]) is not None)
        self.equal("fingerprint/" + record["path"], self.fingerprint(record["path"]), record)
        return record

    def manifest(self, value, role):
        files = value["files"]
        self.check(role + "/manifest_shape", isinstance(files, dict) and bool(files)
                   and type(value["fileCount"]) is int and value["fileCount"] == len(files)
                   and all(isinstance(k, str) and isinstance(v, str) and re.fullmatch(r"[0-9a-f]{64}", v) for k, v in files.items()))
        encoded = json.dumps(dict(sorted(files.items())), separators=(",", ":"), ensure_ascii=False).encode()
        self.equal(role + "/manifest_digest", hashlib.sha256(encoded).hexdigest(), value["digest"])

    def load_protocol(self, contract_path, aggregate_path):
        contract, contract_record = self.read(contract_path)
        self.check("contract_schema", contract["schema"] == "logos-engine.lot6b-owner-cost-contract.v2" and contract["lot"] == "6B")
        self.equal("four_structural_paths_and_functional_fixture", contract["structuralExpectation"], STRUCTURAL_EXPECTATION)
        directory = self.local(contract["performanceDirectory"])
        self.check("performance_directory", directory.is_dir() and directory.is_relative_to(ROOT / "docs/migration/lot6b-evidence"))
        self.verify(contract["declaration"])
        declaration, declaration_record = self.read(contract["declaration"]["path"])
        self.equal("declaration_location", declaration_record, self.fingerprint(directory / "declaration.json"))
        self.check("predeclared_declaration", declaration["schema"] == "logos-engine.native-cost-protocol-declaration.v2"
                   and declaration["status"] == "declared_before_official_window" and declaration["noOfficialWindowAtDeclaration"] is True)
        self.check("actual_6B_predecessor_and_candidate_versions", declaration["baseline"]["nativeVersion"] == "0.63.0"
                   and declaration["candidate"]["nativeVersion"] == "0.64.0")
        self.equal("owner_qualification", declaration["ownerCostQualification"], {
            "schema": "logos-engine.lot6b-owner-cost-qualification.v1", "contractPath": contract_record["path"], "tools": contract["tools"]})
        self.equal("owner_tool_roles", sorted(contract["tools"]), ["consolidator", "reviewer"])
        for record in contract["tools"].values():
            self.verify(record)
        self.equal("independent_reviewer_identity", contract["tools"]["reviewer"], self.fingerprint(__file__))
        historical, _ = self.read("docs/migration/lot3h-evidence/performance/declaration.json")
        for key in ("officialTools", "globalDecisionTool", "globalCalculationTool"):
            self.equal("unchanged_historical_tools/" + key, declaration[key], historical[key])
        tools = declaration["officialTools"] + [declaration["globalDecisionTool"], declaration["globalCalculationTool"]]
        self.check("seven_distinct_historical_tools", len(tools) == len({record["path"] for record in tools}) == 7)
        for record in tools + DERIVED_FROM:
            self.verify(record)
        bound = ("protocol", "cases", "diagnosticComparisonPolicy", "globalBudgetPolicy", "baselineManifest",
                 "candidateManifest", "candidateArchiveManifest")
        for key in bound:
            self.verify(declaration[key])
        cases, _ = self.read(declaration["cases"]["path"])
        phase_policy, _ = self.read(declaration["diagnosticComparisonPolicy"]["path"])
        policy, _ = self.read(declaration["globalBudgetPolicy"]["path"])
        baseline, _ = self.read(declaration["baselineManifest"]["path"])
        candidate, _ = self.read(declaration["candidateManifest"]["path"])
        self.equal("cases_location", declaration["cases"], self.fingerprint(directory / "cases.json"))
        self.equal("phase_policy_location", declaration["diagnosticComparisonPolicy"], self.fingerprint(directory / "comparison-policy.json"))
        self.check("phase_policy", phase_policy["schema"] == "logos-engine.native-loop-cost-comparison-policy.v1")
        self.equal("eight_phases", phase_policy["stages"], PHASES)
        self.equal("two_unaffected_cases", phase_policy["unaffectedCaseIds"], CASE_IDS)
        self.equal("phase_budget", phase_policy["relativeBudget"], 0.1)
        self.equal("case_order", [item["id"] for item in cases["cases"]], CASE_IDS)
        self.equal("four_rounds", cases["rounds"], 4)
        self.equal("manifest_budget", cases["budget"]["unaffectedMedianRelativeIncrease"], 0.1)
        for item in cases["cases"]:
            self.check("declared_actions/" + item["id"], type(item["actions"]) is int and item["actions"] == ACTIONS[item["id"]]
                       and type(item["warmupActions"]) is int and item["warmupActions"] == 3)
        expected = {"globalStage": "session_elapsed", "relativeIncreaseLimit": 0.1, "comparison": "strictly_less_than",
                    "caseIds": CASE_IDS, "allCasesMustPass": True, "crossCaseCompensation": False,
                    "phaseOverrunsMayBeAccepted": True, "phasesAndP95RemainVisible": True,
                    "excludedMeasuredSessions": 0, "excludedOutliers": 0, "plannedOrder": ORDER, "cohorts": 2,
                    "sessionsPerCaseVersionCohort": 4, "measuredSessions": 32, "measuredActions": 400,
                    "excludedWarmupSessions": 8, "excludedWarmupActions": 24}
        self.check("global_policy_schema", policy["schema"] == "logos-engine.native-global-cost-policy.v1")
        for key, value in expected.items():
            self.equal("global_policy/" + key, policy[key], value)
        for key in ("plannedOrder", "cohorts", "sessionsPerCaseVersionCohort", "measuredSessions", "measuredActions",
                    "excludedWarmupSessions", "excludedWarmupActions", "allCasesMustPass", "crossCaseCompensation"):
            self.equal("declaration_policy/" + key, declaration[key], policy[key])
        self.equal("global_authorization", policy["authorization"]["verbatim"], USER_QUOTE)
        self.equal("diagnostic_policy_binding", policy["diagnosticPhasePolicy"], declaration["diagnosticComparisonPolicy"]["path"])
        self.check("declaration_budget", declaration["relativeGlobalBudget"] == 0.1
                   and declaration["globalComparison"] == "strictly_less_than" and declaration["phaseOverrunsBlockAcceptance"] is False
                   and declaration["diagnosticMetrics"] == 16 and declaration["globalBudgetCases"] == 2)
        for role, manifest in (("baseline", baseline), ("candidate", candidate)):
            self.manifest(manifest, role)
            self.check("native_identity/" + role, policy[role]["nativeDigest"] == declaration["nativeDigests"][role] == manifest["digest"]
                       and policy[role]["nativeFiles"] == manifest["fileCount"])
        self.check("distinct_native_versions", baseline["digest"] != candidate["digest"])
        protocol_bytes, _ = self.bytes(declaration["protocol"]["path"])
        protocol_text = protocol_bytes.decode("utf-8")
        for needle in [contract_record["path"], *[record["sha256"] for record in contract["tools"].values()],
                       *[declaration[key]["sha256"] for key in ("globalBudgetPolicy", "globalDecisionTool", "globalCalculationTool")]]:
            self.check("watched_protocol_binding/" + needle, needle in protocol_text)
        self.check("complete_source_evidence_files", len(contract["sourceEvidence"]) == len(SOURCE_PATHS)
                   and {record["path"] for record in contract["sourceEvidence"]} == set(SOURCE_PATHS))
        for record in contract["sourceEvidence"]:
            self.verify(record)
            self.equal("source_evidence_native_identity/" + record["path"], candidate["files"][record["path"]], record["sha256"])
        self.verify(contract["ownerInventory"])
        inventory, _ = self.read(contract["ownerInventory"]["path"])
        self.check("owner_inventory_schema", inventory["schema"] == "logos-engine.lot6b-owner-cost-source-inventory.v1"
                   and inventory["programScope"] == "family-installed programs")
        self.equal("inventory_native_digests", inventory["nativeDigests"], declaration["nativeDigests"])
        for key, addition in (("owners", OWNER), ("programs", PROGRAM)):
            old, new = inventory[key]["baseline"], inventory[key]["candidate"]
            self.check("inventory_unique_strings/" + key, isinstance(old, list) and isinstance(new, list)
                       and all(isinstance(value, str) and value for value in old + new)
                       and len(set(old)) == len(old) and len(set(new)) == len(new))
            self.check("inventory_exact_addition/" + key, (addition is None or addition not in old) and set(new) == set(old) | (set() if addition is None else {addition}))
        fixture = self.load_structural_fixture(contract, declaration, {"baseline": baseline, "candidate": candidate})
        static, static_record = self.read(directory / "static-preflight.json")
        readiness, readiness_record = self.read(directory / "readiness.json")
        window, window_record = self.read(directory / "window.json")
        self.check("static_preflight_passed", static["status"] == "static_inputs_checked" and bool(static["checks"])
                   and all(item["satisfied"] is True for item in static["checks"]))
        self.equal("static_owner_contract", static["ownerCostContract"], contract_record)
        self.equal("static_owner_tools", static["ownerCostTools"], contract["tools"])
        self.check("readiness_authorized", readiness["measurementAuthorized"] is True and readiness["pendingRequirements"] == []
                   and readiness["nativeSourceDigest"] == candidate["digest"])
        for record in readiness["inputs"]:
            self.verify(record)
        for record in [contract_record, static_record, declaration_record, *contract["tools"].values()]:
            self.check("readiness_binding/" + record["path"], record in readiness["inputs"])
        self.check("predeclaration_chronology", instant(policy["declaredAt"]) <= instant(declaration["recordedAt"])
                   <= instant(declaration["finalizedAt"]) <= instant(contract["declaredAt"]) <= instant(static["recordedAt"])
                   <= instant(readiness["finalizedAt"]) < instant(window["startedAt"]))
        self.check("inventory_before_contract", instant(inventory["recordedAt"]) <= instant(contract["declaredAt"]))
        aggregate, aggregate_record = self.read(aggregate_path)
        self.check("qualified_aggregate_schema", aggregate["schema"] == "logos-engine.lot6b-owner-cost-consolidation.v2"
                   and aggregate["status"] == "qualified_consolidation_complete")
        self.equal("aggregate_generator", aggregate["generator"], contract["tools"]["consolidator"])
        self.equal("aggregate_contract", aggregate["contract"], contract_record)
        self.equal("aggregate_declaration", aggregate["declaration"], declaration_record)
        old_tools = {record["path"]: record for record in tools}
        self.equal("aggregate_derivation", aggregate["derivedFrom"], [old_tools["scripts/compare-native-cost-cohorts.mjs"],
                                                                    old_tools["scripts/compare-native-loop-costs.mjs"]])
        expected_inputs = {"policy": declaration["diagnosticComparisonPolicy"], "window": window_record,
                           "readiness": readiness_record, "staticPreflight": static_record,
                           "sourceInventory": contract["ownerInventory"], "sourceEvidence": contract["sourceEvidence"],
                           "structuralFixture": contract["structuralFixture"], "structuralAttribution": fixture["attribution"]}
        for key, value in expected_inputs.items():
            self.equal("aggregate_input/" + key, aggregate["inputs"][key], value)
        self.equal("aggregate_input_keys", sorted(aggregate["inputs"]), sorted([*expected_inputs, "cohorts"]))
        return {"contract": contract, "contractRecord": contract_record, "directory": directory,
                "declaration": declaration, "declarationRecord": declaration_record, "policy": policy,
                "cases": cases, "baseline": baseline, "candidate": candidate, "window": window,
                "windowRecord": window_record, "aggregate": aggregate, "aggregateRecord": aggregate_record,
                "historicalTools": old_tools, "structuralFixture": fixture}

    def load_structural_fixture(self, contract, declaration, manifests):
        self.verify(contract["structuralFixture"])
        fixture, _ = self.read(contract["structuralFixture"]["path"])
        self.check("functional_fixture_schema", fixture["schema"] == "logos-engine.lot6b-owner-cost-structural-fixture.v1"
                   and fixture["status"] == "qualified_functional_structure")
        self.equal("functional_fixture_native_identities", fixture["nativeDigests"], declaration["nativeDigests"])
        self.equal("functional_fixture_cases_bytes", without(fixture["cases"], {"path"}), without(declaration["cases"], {"path"}))
        self.verify(fixture["cases"])
        self.verify(fixture["captureTool"])
        self.equal("functional_fixture_capture_roles", sorted(fixture["captures"]), ["baseline", "candidate"])
        required_inputs = [fixture["captureTool"], fixture["cases"], *contract["sourceEvidence"]]
        capture_finishes = []
        for role in ("baseline", "candidate"):
            capture = fixture["captures"][role]
            self.equal("functional_capture_records/" + role, sorted(capture), ["receipt", "report"])
            # The captured reports can contain full graphs. Only their immutable
            # bytes are fingerprinted here; the separate qualifier checked them.
            self.verify(capture["report"])
            self.verify(capture["receipt"])
            receipt, _ = self.read(capture["receipt"]["path"])
            self.validate_capture_receipt(receipt, role, fixture, capture, manifests[role], declaration[role + "Manifest"])
            if role == "baseline":
                self.pin_baseline_attribution_inputs(receipt)
            capture_finishes.append(instant(receipt["finishedAt"]))
            required_inputs.extend([capture["report"], capture["receipt"]])
        expected_order = [(case, form) for case in CASE_IDS for form in ("warmup", "measured")]
        self.equal("exact_four_functional_forms", [(row["case"], row["form"]) for row in fixture["forms"]], expected_order)
        shape_keys = {"actions", "cycles", "levelsCompleted", "requests", "observations", "inspection", "final"}
        observation_keys = {"type", "sequence", "family", "proposalKind", "poseMode", "actions", "cycles",
                            "levelsCompleted", "nodeCount", "acquiredTransitions"}
        final_keys = {"actions", "levelsCompleted", "reason", "graphRevision", "nodeCount", "acquiredTransitions", "implementation"}
        for form in fixture["forms"]:
            self.equal("functional_form_keys/" + form["case"] + "/" + form["form"], sorted(form), ["baseline", "candidate", "case", "form"])
            for role in ("baseline", "candidate"):
                shape = form[role]
                name = form["case"] + "/" + form["form"] + "/" + role
                self.equal("functional_shape_keys/" + name, sorted(shape), sorted(shape_keys))
                self.check("functional_shape_actions/" + name, type(shape["actions"]) is int
                           and shape["actions"] == (3 if form["form"] == "warmup" else ACTIONS[form["case"]]))
                self.check("functional_shape_counters/" + name, type(shape["cycles"]) is int and shape["cycles"] >= 0
                           and type(shape["levelsCompleted"]) is int and shape["levelsCompleted"] >= 0)
                self.check("functional_shape_requests/" + name, isinstance(shape["requests"], list) and bool(shape["requests"])
                           and all(set(row) == {"type", "sequence", "kind", "actions"} for row in shape["requests"]))
                self.check("functional_shape_observations/" + name, isinstance(shape["observations"], list) and bool(shape["observations"])
                           and all(set(row) == observation_keys and type(row["nodeCount"]) is int and row["nodeCount"] >= 0
                                   for row in shape["observations"]))
                self.check("functional_shape_inspections/" + name, isinstance(shape["inspection"], list)
                           and len(shape["inspection"]) == (0 if form["form"] == "warmup" else 3)
                           and all(set(row) == {"graphNodes"} and type(row["graphNodes"]) is int and row["graphNodes"] >= 0
                                   for row in shape["inspection"]))
                self.equal("functional_final_keys/" + name, sorted(shape["final"]), sorted(final_keys))
                self.equal("functional_final_implementation/" + name, shape["final"]["implementation"],
                           "logos-engine.typescript.v6.native-migration/" + declaration[role]["nativeVersion"])
                self.check("functional_final_counters/" + name,
                           all(type(shape["final"][key]) is int and shape["final"][key] >= 0 for key in ("nodeCount", "graphRevision"))
                           and shape["final"]["actions"] == shape["final"]["acquiredTransitions"] == shape["actions"]
                           and shape["final"]["levelsCompleted"] == shape["levelsCompleted"])
        self.verify(fixture["attribution"])
        attribution, _ = self.read(fixture["attribution"]["path"])
        self.check("functional_attribution_schema", attribution["schema"] == "logos-engine.lot6b-owner-cost-structural-attribution.v1"
                   and attribution["status"] == "qualified_functional_structure")
        self.equal("functional_attribution_native_identities", attribution["nativeDigests"], declaration["nativeDigests"])
        self.equal("functional_attribution_no_failures", attribution["failures"], [])
        self.equal("common_value_policy", attribution["commonValuePolicy"], {
            "comparison": "exact", "permittedMetadataDifference": "origin.source_digest",
            "identityValueAttributions": [], "unattributedDifferencesAllowed": 0})
        self.check("common_value_points_nonempty", isinstance(attribution["points"], list) and bool(attribution["points"]))
        self.equal("complete_common_value_coverage", attribution["commonValueCoverage"], [
            {**{key: point[key] for key in ("case", "form", "pointIndex")},
             "commonNodesCompared": point["baselineNodeCount"], "commonDeltasCompared": point["baselineDeltaCount"],
             "comparison": "exact", "unattributedDifferences": 0} for point in attribution["points"]])
        self.verify(attribution["generator"])
        self.check("functional_attribution_checks", type(attribution["checkedCount"]) is int
                   and attribution["checkedCount"] == len(attribution["checks"]) > 0
                   and all(row["passed"] is True for row in attribution["checks"]))
        self.check("functional_node_attribution_register", isinstance(attribution["nodeAttributions"], list) and bool(attribution["nodeAttributions"]))
        self.check("unique_functional_attribution_inputs", len(attribution["inputs"]) == len({row["path"] for row in attribution["inputs"]}))
        for record in attribution["inputs"]:
            self.verify_attribution_input(record)
        for record in required_inputs:
            self.check("functional_attribution_binding/" + record["path"], record in attribution["inputs"])
        canonical_forms = json.dumps(fixture["forms"], sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
        self.equal("functional_attribution_forms_hash", attribution["formsSha256"], hashlib.sha256(canonical_forms).hexdigest())
        self.check("functional_fixture_predeclaration", all(stamp <= instant(attribution["recordedAt"]) for stamp in capture_finishes)
                   and instant(attribution["recordedAt"]) <= instant(fixture["recordedAt"])
                   <= instant(contract["declaredAt"]))
        return fixture

    def verify_capture_input(self, record):
        """Bind receipt inputs, including an external frozen baseline checkout."""
        self.check("capture_input_fingerprint_shape", isinstance(record, dict)
                   and set(record) == {"path", "bytes", "sha256"} and isinstance(record["path"], str)
                   and type(record["bytes"]) is int and record["bytes"] >= 0
                   and isinstance(record["sha256"], str) and re.fullmatch(r"[0-9a-f]{64}", record["sha256"]) is not None)
        if Path(record["path"]).is_absolute():
            _, current = self.bytes(record["path"], external=True)
            self.equal("capture_external_input/" + record["path"], without(current, {"path"}), without(record, {"path"}))
        else:
            self.verify(record)

    def pin_baseline_attribution_inputs(self, receipt):
        self.check("single_predeclared_baseline_capture", self.baseline_attribution_root is None)
        self.check("baseline_capture_absolute_checkout", isinstance(receipt["checkout"], str)
                   and Path(receipt["checkout"]).is_absolute())
        root = Path(receipt["checkout"]).resolve(strict=True)
        self.check("baseline_capture_distinct_checkout", root != ROOT.resolve(strict=True))
        records = [record for record in receipt["inputsBefore"] if Path(record["path"]).is_absolute()]
        self.check("baseline_capture_external_inputs", bool(records) and len(records) == len({record["path"] for record in records}))
        for record in records:
            target = Path(record["path"]).resolve(strict=True)
            self.check("baseline_capture_input_containment/" + record["path"], target != root and target.is_relative_to(root))
        self.baseline_attribution_root = root
        self.baseline_attribution_inputs = {record["path"]: deepcopy(record) for record in records}

    def verify_attribution_input(self, record):
        if not Path(record["path"]).is_absolute():
            return self.verify(record)
        self.check("attribution_has_pinned_baseline", self.baseline_attribution_root is not None)
        self.equal("predeclared_external_attribution_input/" + record["path"], record,
                   self.baseline_attribution_inputs.get(record["path"]))
        target = Path(record["path"]).resolve(strict=True)
        self.check("attribution_baseline_containment/" + record["path"], target != self.baseline_attribution_root
                   and target.is_relative_to(self.baseline_attribution_root))
        return self.verify_capture_input(record)

    def validate_capture_receipt(self, receipt, role, fixture, capture, manifest, manifest_record):
        self.check("functional_capture_schema/" + role,
                   receipt["schema"] == "logos-engine.lot6b-owner-cost-functional-capture-receipt.v1"
                   and receipt["status"] == "captured_functional_structure" and receipt["role"] == role)
        self.equal("functional_capture_native_digest/" + role, receipt["nativeDigest"], fixture["nativeDigests"][role])
        for key in ("nativeSourceBefore", "nativeSourceAfter"):
            self.verify_capture_input(receipt[key])
            self.equal("functional_capture_source_manifest/" + role + "/" + key,
                       without(receipt[key], {"path"}), without(manifest_record, {"path"}))
        self.equal("functional_capture_source_manifest_unchanged/" + role, receipt["nativeSourceBefore"], receipt["nativeSourceAfter"])
        self.equal("functional_capture_inventory_before/" + role, receipt["nativeInventoryBefore"], manifest)
        self.equal("functional_capture_inventory_after/" + role, receipt["nativeInventoryAfter"], manifest)
        self.check("functional_capture_integrity/" + role, receipt["nativeSourceUnchanged"] is True
                   and receipt["inputsUnchanged"] is True and receipt["generatorUnchanged"] is True and receipt["failures"] == [])
        self.equal("functional_capture_report/" + role, receipt["report"], capture["report"])
        self.equal("functional_capture_generator/" + role, receipt["generator"], fixture["captureTool"])
        self.verify_capture_input(receipt["cases"])
        self.equal("functional_capture_cases_bytes/" + role, without(receipt["cases"], {"path"}), without(fixture["cases"], {"path"}))
        self.equal("functional_capture_immutable_inputs/" + role, receipt["inputsBefore"], receipt["inputsAfter"])
        self.check("functional_capture_unique_inputs/" + role, isinstance(receipt["inputsBefore"], list)
                   and bool(receipt["inputsBefore"]) and len(receipt["inputsBefore"]) == len({row["path"] for row in receipt["inputsBefore"]}))
        for record in receipt["inputsBefore"]:
            self.verify_capture_input(record)
        self.check("functional_capture_source_input/" + role, receipt["nativeSourceBefore"] in receipt["inputsBefore"])
        self.check("functional_capture_case_input/" + role, receipt["cases"] in receipt["inputsBefore"])
        self.check("functional_capture_totals/" + role, type(receipt["sessionCount"]) is int and receipt["sessionCount"] == 4
                   and type(receipt["actions"]) is int and receipt["actions"] == 31 and len(receipt["sessions"]) == 4)
        self.equal("functional_capture_form_order/" + role, [(row["case"], row["form"]) for row in receipt["sessions"]],
                   [(case, form) for case in CASE_IDS for form in ("warmup", "measured")])
        for session, form in zip(receipt["sessions"], fixture["forms"]):
            self.equal("functional_capture_shape/" + role + "/" + session["case"] + "/" + session["form"], session["shape"], form[role])
        self.check("functional_capture_action_sum/" + role, sum(row["shape"]["actions"] for row in receipt["sessions"]) == 31)
        self.check("functional_capture_chronology/" + role, instant(receipt["startedAt"]) <= instant(receipt["finishedAt"])
                   <= instant(fixture["recordedAt"]))

    def load_window(self, context):
        window, aggregate, declaration = context["window"], context["aggregate"], context["declaration"]
        directory = context["directory"]
        runner = context["historicalTools"]["scripts/measure-native-loop-costs.mjs"]
        self.check("complete_unchanged_window", window["schema"] == "logos-engine.native-cost-window.v1"
                   and window["status"] == window["finalIntegrity"] == "passed")
        self.equal("ABBA_plan", window["plannedOrder"], ORDER)
        self.equal("ABBA_executions", [row["label"] for row in window["executions"]], ORDER)
        self.equal("window_native_digests", window["nativeDigests"], {
            "baseline": context["baseline"]["digest"], "correction": context["candidate"]["digest"]})
        self.equal("window_runner_hash", window["runnerSha256"], runner["sha256"])
        self.equal("candidate_checkout", str(Path(window["correctionCheckout"]).resolve()), str(ROOT))
        self.check("distinct_checkouts", Path(window["baselineCheckout"]).resolve() != ROOT)
        self.equal("measured_baseline_is_predeclared_capture_checkout", str(Path(window["baselineCheckout"]).resolve(strict=True)),
                   str(self.baseline_attribution_root))
        watched = set()
        for record in window["inputs"]:
            self.check("window_fingerprint_shape", set(record) == {"path", "sha256"} and Path(record["path"]).is_absolute())
            target = Path(record["path"]).resolve()
            self.check("unique_watched_path/" + record["path"], target not in watched)
            watched.add(target)
            _, current = self.bytes(target, external=True)
            self.equal("watched_window_input/" + record["path"], current["sha256"], record["sha256"])
        protocol_path = self.local(declaration["protocol"]["path"])
        self.check("protocol_watched_during_measurement", protocol_path in watched)
        self.check("declared_window_bounds", instant(window["startedAt"]) < instant(window["finishedAt"]))
        previous_end = instant(window["startedAt"])
        execution_by_label = {}
        for row in window["executions"]:
            label = row["label"]
            self.check("successful_execution/" + label, row["status"] == "passed" and type(row["exitCode"]) is int and row["exitCode"] == 0)
            self.check("sequential_execution/" + label, previous_end <= instant(row["startedAt"])
                       <= instant(row["finishedAt"]) <= instant(window["finishedAt"]))
            previous_end = instant(row["finishedAt"])
            side = "baseline" if label.startswith("A") else "after"
            manifest = context["baseline"] if side == "baseline" else context["candidate"]
            report_path = directory / ("cohort" + label[1]) / (side + ".json")
            self.equal("execution_command/" + label, row["command"], ["node", runner["path"],
                declaration["cases"]["path"], report_path.relative_to(ROOT).as_posix()])
            expected_checkout = Path(window["baselineCheckout"]).resolve() if side == "baseline" else ROOT
            self.equal("execution_checkout/" + label, str(Path(row["checkout"]).resolve()), str(expected_checkout))
            self.equal("execution_native_digest/" + label, row["nativeDigest"], manifest["digest"])
            _, log_record = self.bytes(row["log"], external=True)
            self.equal("execution_log/" + label, log_record["sha256"], row["logSha256"])
            execution_by_label[label] = row
        cohorts = aggregate["inputs"]["cohorts"]
        self.equal("two_cohort_identities", [row["id"] for row in cohorts], ["cohort_1", "cohort_2"])
        reports, comparisons, report_records = {}, {}, []
        timing_inputs = None
        environment = None
        signatures = {}
        physical_sessions = set()
        for index, cohort in enumerate(cohorts, 1):
            self.equal("cohort_input_keys/" + cohort["id"], sorted(cohort), ["after", "baseline", "id", "originalComparison"])
            for side, prefix in (("baseline", "A"), ("after", "B")):
                record = cohort[side]
                self.verify(record)
                self.equal("cohort_report_path/" + cohort["id"] + "/" + side, record["path"],
                           (directory / f"cohort{index}" / (side + ".json")).relative_to(ROOT).as_posix())
                report, actual = self.read(record["path"])
                report_records.append(actual)
                manifest = context["baseline"] if side == "baseline" else context["candidate"]
                execution = execution_by_label[prefix + str(index)]
                label = cohort["id"] + "/" + side
                self.check("raw_report_status/" + label, report["schema"] == "logos-engine.native-loop-costs.v1"
                           and report["status"] == "passed" and report["nativeSourceUnchanged"] is True)
                self.equal("raw_source_manifest/" + label, report["nativeSource"], manifest)
                self.equal("raw_runner/" + label, report["generator"], runner)
                self.equal("raw_cases/" + label, report["manifest"], context["cases"])
                self.equal("execution_report_hash/" + label, execution["reportSha256"], actual["sha256"])
                self.equal("execution_copied_report_hash/" + label, execution.get("copiedReportSha256", actual["sha256"]), actual["sha256"])
                self.check("raw_inputs_nonempty/" + label, isinstance(report["inputs"], list) and bool(report["inputs"]))
                for item in report["inputs"]:
                    self.verify(item)
                self.equal("raw_cases_input_first/" + label, report["inputs"][0], declaration["cases"])
                self.check("unique_raw_inputs/" + label, len(report["inputs"]) == len({item["path"] for item in report["inputs"]}))
                if timing_inputs is None:
                    timing_inputs, environment = report["inputs"], report["environment"]
                self.equal("same_harness_inputs/" + label, report["inputs"], timing_inputs)
                self.equal("same_environment/" + label, report["environment"], environment)
                self.equal("raw_case_order/" + label, [item["id"] for item in report["cases"]], CASE_IDS)
                previous_trial_end = instant(execution["startedAt"])
                for item in report["cases"]:
                    case = item["id"]
                    trials = item["trials"]
                    self.equal("five_trial_rounds/" + label + "/" + case, [row["round"] for row in trials], list(range(5)))
                    self.equal("one_warmup/" + label + "/" + case, [row["warmup"] for row in trials], [True, False, False, False, False])
                    for trial in trials:
                        name = label + "/" + case + "/round" + str(trial["round"])
                        self.check("trial_integer_identity/" + name, type(trial["round"]) is int and trial["case"] == case
                                   and type(trial["cycles"]) is int and trial["cycles"] >= 0)
                        self.check("trial_chronology/" + name, previous_trial_end <= instant(trial["startedAt"])
                                   <= instant(trial["finishedAt"]) <= instant(execution["finishedAt"]))
                        previous_trial_end = instant(trial["finishedAt"])
                        physical = (trial["startedAt"], trial["finishedAt"])
                        self.check("unique_physical_session/" + name, physical not in physical_sessions)
                        physical_sessions.add(physical)
                        expected_actions = 3 if trial["warmup"] else ACTIONS[case]
                        self.check("acquired_actions/" + name, type(trial["actions"]) is int and trial["actions"] == expected_actions
                                   and trial["final"]["actions"] == expected_actions and trial["final"]["acquiredTransitions"] == expected_actions
                                   and trial["final"]["levelsCompleted"] == trial["levelsCompleted"])
                        self.check("request_counts/" + name, sum(row["type"] == "init" for row in trial["requests"]) == 1
                                   and sum(row["type"] == "advance" for row in trial["requests"]) == expected_actions)
                        self.check("positive_session_time/" + name, numeric(trial["replayElapsedMs"], positive=True))
                        self.check("valid_sample_times/" + name, all(numeric(row["elapsedMs"]) for row in trial["samples"]))
                        self.check("valid_request_times/" + name, all(numeric(row[key]) for row in trial["requests"]
                                   for key in ("wallMs", "nativeServiceMs", "transportAndSchedulingMs")))
                        self.check("valid_inspection_times/" + name, all(numeric(row[key]) for row in trial["inspection"]
                                   for key in ("nativeServiceMs", "endToEndMs")))
                        if trial["warmup"]:
                            self.check("unmeasured_warmup_extras/" + name, trial["pauses"] == [] and trial["inspection"] == [])
                        else:
                            self.equal("measured_pause_phases/" + name, [row["phase"] for row in trial["pauses"]], ["initial_planning", "engaged_action"])
                            self.check("measured_safe_pauses/" + name, all(row["acknowledgedPaused"] is True for row in trial["pauses"])
                                       and [row["actionsAtSafeBoundary"] for row in trial["pauses"]] == [0, 1])
                            self.check("measured_three_inspections/" + name, len(trial["inspection"]) == 3)
                        fixture_form = next(row for row in context["structuralFixture"]["forms"]
                                            if row["case"] == case and row["form"] == ("warmup" if trial["warmup"] else "measured"))
                        fixture_role = "baseline" if side == "baseline" else "candidate"
                        self.equal("exact_predeclared_functional_shape/" + name, functional_shape(trial), fixture_form[fixture_role])
                        signature_key = (side, case, trial["warmup"])
                        signature = work(trial)
                        reference = signatures.setdefault(signature_key, signature)
                        self.equal("full_work_within_version/" + name, signature, reference)
                    self.equal("session_summary/" + label + "/" + case,
                               without(item["sessionElapsed"], {"tailQualification"}),
                               distribution([row["replayElapsedMs"] for row in trials if not row["warmup"]]))
                reports[(cohort["id"], side)] = report
            self.verify(cohort["originalComparison"])
            self.equal("pair_comparison_path/" + cohort["id"], cohort["originalComparison"]["path"],
                       (directory / f"cohort{index}" / "comparison.json").relative_to(ROOT).as_posix())
            comparison, _ = self.read(cohort["originalComparison"]["path"])
            self.check("pair_comparison_schema/" + cohort["id"], comparison["schema"] == "logos-engine.native-loop-cost-comparison.v1")
            generator = context["historicalTools"]["scripts/compare-native-loop-costs.mjs"]
            self.equal("pair_comparison_generator/" + cohort["id"], comparison["generator"], without(generator, {"bytes"}))
            self.equal("pair_comparison_inputs/" + cohort["id"], comparison["inputs"], {
                "policy": declaration["diagnosticComparisonPolicy"], "baseline": cohort["baseline"], "after": cohort["after"]})
            for key in ("harnessInputsMatched", "environmentMatched", "replayWorkMatched"):
                self.equal("pair_comparison_match/" + cohort["id"] + "/" + key, comparison[key], True)
            comparisons[cohort["id"]] = comparison
        self.check("four_distinct_raw_reports", len({row["sha256"] for row in report_records}) == 4)
        self.check("two_distinct_pair_receipts", len({row["originalComparison"]["sha256"] for row in cohorts}) == 2)
        self.equal("aggregate_environment", aggregate["environment"], environment)
        self.equal("aggregate_timing_harness", aggregate["timingHarness"], runner)
        context.update(reports=reports, originalComparisons=comparisons)

    def structural_pair(self, cohort, case, baseline, candidate, fixture_form):
        prefix = f"{cohort}/{case}/round{baseline['round']}"
        self.equal("paired_trial_identity/" + prefix, [baseline["case"], baseline["round"], baseline["warmup"]],
                   [candidate["case"], candidate["round"], candidate["warmup"]])
        self.equal("paired_cycles/" + prefix, baseline["cycles"], candidate["cycles"])
        left, right = deepcopy(work(baseline)), deepcopy(work(candidate))
        expected_before, expected_after = fixture_form["baseline"], fixture_form["candidate"]
        form_identity = {"case": case, "form": "warmup" if baseline["warmup"] else "measured"}
        rows = []

        def record(path, before, after, old_expected, new_expected):
            self.check("integer_structure/" + prefix + "/" + path,
                       all(type(value) is int and value >= 0 for value in (before, after, old_expected, new_expected)))
            delta = after - before
            expected_delta = new_expected - old_expected
            rows.append({"cohort": cohort, "case": case, "round": baseline["round"], "warmup": baseline["warmup"],
                         "path": path, "before": before, "after": after, "delta": delta,
                         "expectedBefore": old_expected, "expectedAfter": new_expected, "expectedDelta": expected_delta,
                         "rule": "predeclared_functional_fixture", "fixtureForm": form_identity})
            self.check("exact_structural_fixture_values/" + prefix + "/" + path,
                       before == old_expected and after == new_expected and delta == expected_delta)

        for field, key in (("observations", "nodeCount"), ("inspection", "graphNodes")):
            self.equal("structural_array_length/" + prefix + "/" + field, len(left[field]), len(right[field]))
            self.equal("baseline_fixture_array_length/" + prefix + "/" + field, len(left[field]), len(expected_before[field]))
            self.equal("candidate_fixture_array_length/" + prefix + "/" + field, len(right[field]), len(expected_after[field]))
            if field == "observations":
                self.check("nonempty_observation_structure/" + prefix, bool(left[field]))
            for index, (old, new) in enumerate(zip(left[field], right[field])):
                self.check("required_structural_field/" + prefix + f"/{field}[{index}].{key}", key in old and key in new)
                record(f"{field}[{index}].{key}", old.pop(key), new.pop(key),
                       expected_before[field][index][key], expected_after[field][index][key])
        self.check("required_final_structural_fields/" + prefix,
                   all(key in left["final"] and key in right["final"] for key in ("nodeCount", "graphRevision")))
        record("final.nodeCount", left["final"].pop("nodeCount"), right["final"].pop("nodeCount"),
               expected_before["final"]["nodeCount"], expected_after["final"]["nodeCount"])
        record("final.graphRevision", left["final"].pop("graphRevision"), right["final"].pop("graphRevision"),
               expected_before["final"]["graphRevision"], expected_after["final"]["graphRevision"])
        self.equal("all_other_cross_version_work/" + prefix, left, right)
        self.structural_rows.extend(sorted(rows, key=lambda row: row["path"]))

    def verify_structure_and_ledgers(self, context):
        reports = context["reports"]
        for cohort in ("cohort_1", "cohort_2"):
            for case in CASE_IDS:
                old = next(row for row in reports[(cohort, "baseline")]["cases"] if row["id"] == case)
                new = next(row for row in reports[(cohort, "after")]["cases"] if row["id"] == case)
                for left, right in zip(old["trials"], new["trials"]):
                    form = next(row for row in context["structuralFixture"]["forms"]
                                if row["case"] == case and row["form"] == ("warmup" if left["warmup"] else "measured"))
                    self.structural_pair(cohort, case, left, right, form)
        included, warmups, session_times = [], [], []
        for case in CASE_IDS:
            for side in ("baseline", "after"):
                for cohort in ("cohort_1", "cohort_2"):
                    item = next(row for row in reports[(cohort, side)]["cases"] if row["id"] == case)
                    for trial in item["trials"]:
                        identity = {"cohort": cohort, "side": side, "case": case, "round": trial["round"],
                                    "startedAt": trial["startedAt"], "finishedAt": trial["finishedAt"], "actions": trial["actions"]}
                        if trial["warmup"]:
                            warmups.append({**identity, "cycles": trial["cycles"]})
                        else:
                            included.append({**identity, "levelsCompleted": trial["levelsCompleted"],
                                             "sampleCount": len(trial["samples"]), "requestCount": len(trial["requests"])})
                            session_times.append({**identity, "elapsedMs": trial["replayElapsedMs"]})
        self.check("all_32_sessions_400_actions", len(included) == 32 and sum(row["actions"] for row in included) == 400)
        self.check("all_8_warmups_24_actions", len(warmups) == 8 and sum(row["actions"] for row in warmups) == 24)
        for side in ("baseline", "after"):
            self.check("sixteen_sessions_200_actions/" + side, sum(row["side"] == side for row in included) == 16
                       and sum(row["actions"] for row in included if row["side"] == side) == 200)
            for case in CASE_IDS:
                self.check("eight_sessions_per_version_game/" + side + "/" + case,
                           sum(row["side"] == side and row["case"] == case for row in included) == 8)
        self.equal("complete_measured_ledger", context["aggregate"]["includedMeasuredSessions"], included)
        self.equal("complete_warmup_ledger", context["aggregate"]["excludedWarmups"], warmups)
        self.equal("complete_structural_delta_ledger", context["aggregate"]["structuralDifferences"], self.structural_rows)
        for key, value in (("measuredSessions", 32), ("measuredActions", 400), ("excludedWarmupSessions", 8), ("excludedWarmupActions", 24)):
            self.equal("aggregate_total/" + key, context["aggregate"][key], value)
        context.update(included=included, warmups=warmups, sessionTimes=session_times)

    def verify_historical_failure(self, context):
        contract, aggregate = context["contract"], context["aggregate"]
        failure, failure_record = self.read(contract["strictFailureReceipt"])
        log_bytes, log_record = self.bytes(contract["strictFailureLog"])
        tool = context["historicalTools"]["scripts/compare-native-cost-cohorts.mjs"]
        command_inputs = [context["declaration"]["diagnosticComparisonPolicy"]]
        for cohort in aggregate["inputs"]["cohorts"]:
            command_inputs.extend(cohort[key] for key in ("baseline", "after", "originalComparison"))
        old_output = self.local(contract["historicalAggregateOutput"])
        self.check("historical_output_remains_absent", not old_output.exists()
                   and old_output != self.local(context["aggregateRecord"]["path"]))
        expected_command = ["node", tool["path"], *[record["path"] for record in command_inputs],
                            old_output.relative_to(ROOT).as_posix()]
        self.check("retained_historical_failure", failure["schema"] == "logos-engine.retained-tool-failure.v1"
                   and type(failure["exitCode"]) is int and failure["exitCode"] != 0
                   and failure["inputsUnchanged"] is True and failure["outputExists"] is False)
        self.equal("historical_failure_command", failure["command"], expected_command)
        self.equal("historical_failure_inputs", failure["inputs"], [tool, *command_inputs])
        for record in failure["inputs"]:
            self.verify(record)
        self.equal("historical_failure_log", failure["log"], log_record)
        self.check("historical_failure_reason", "Within-cohort work metadata changed" in log_bytes.decode("utf-8"))
        self.check("historical_failure_chronology", instant(context["window"]["finishedAt"]) <= instant(failure["startedAt"])
                   <= instant(failure["finishedAt"]) <= instant(aggregate["recordedAt"]))
        historical = {"passed": False, "status": "failed_work_metadata", "failureReceipt": failure_record,
                      "failureLog": log_record, "tool": tool}
        self.equal("historical_failure_not_reclassified", aggregate["historicalStrict"], historical)
        context["historicalStrict"] = historical

    def recalculate(self, context):
        reports, aggregate = context["reports"], context["aggregate"]

        def retained(cohort, side, case):
            row = next(item for item in reports[(cohort, side)]["cases"] if item["id"] == case)
            return [trial for trial in row["trials"] if not trial["warmup"]]

        cohort_comparisons = []
        for cohort in ("cohort_1", "cohort_2"):
            original = context["originalComparisons"][cohort]
            self.equal("original_pair_case_order/" + cohort, [row["case"] for row in original["comparisons"]], CASE_IDS)
            rows = []
            for case, original_row in zip(CASE_IDS, original["comparisons"]):
                before, after = retained(cohort, "baseline", case), retained(cohort, "after", case)
                raw_before = next(item for item in reports[(cohort, "baseline")]["cases"] if item["id"] == case)
                raw_after = next(item for item in reports[(cohort, "after")]["cases"] if item["id"] == case)
                values = [metric(before, after, stage) for stage in PHASES]
                self.equal("all_original_phase_metrics/" + cohort + "/" + case, original_row["metrics"], values)
                self.equal("original_pair_session_summary/" + cohort + "/" + case, original_row["sessionElapsed"], {
                    "before": raw_before["sessionElapsed"], "after": raw_after["sessionElapsed"],
                    "medianRelativeIncrease": raw_after["sessionElapsed"]["medianMs"] / raw_before["sessionElapsed"]["medianMs"] - 1})
                for key in ("inspection", "pause"):
                    self.equal("original_pair_retained_summary/" + cohort + "/" + case + "/" + key,
                               original_row[key], {"before": raw_before[key], "after": raw_after[key]})
                self.check("original_pair_counts/" + cohort + "/" + case,
                           original_row["unaffected"] is True and original_row["measuredSessions"] == 4
                           and original_row["actionsPerSession"] == ACTIONS[case]
                           and original_row["levelsCompleted"] == before[0]["levelsCompleted"])
                rows.append({"case": case, "metrics": values})
            unresolved = unresolved_for(rows)
            status = "budget_review_required" if unresolved else "passed"
            self.equal("original_pair_budget/" + cohort, original["relativeBudget"], 0.1)
            self.equal("original_pair_unresolved/" + cohort, original["unresolved"], unresolved)
            self.equal("original_pair_status/" + cohort, original["status"], status)
            for side, key in (("baseline", "before"), ("after", "after")):
                report = reports[(cohort, side)]
                self.equal("original_pair_source/" + cohort + "/" + side, original[key], {
                    "headCommit": report["gitHead"], "nativeDigest": report["nativeSource"]["digest"]})
            cohort_comparisons.append({"cohort": cohort, "status": status, "withinObservedBudget": 16 - len(unresolved),
                                       "budgetMetricCount": 16, "comparisons": rows, "unresolved": unresolved})
        self.equal("both_original_cohort_recalculations", aggregate["cohortComparisons"], cohort_comparisons)
        pooled, global_cases = [], []
        for case in CASE_IDS:
            before = [trial for cohort in ("cohort_1", "cohort_2") for trial in retained(cohort, "baseline", case)]
            after = [trial for cohort in ("cohort_1", "cohort_2") for trial in retained(cohort, "after", case)]
            self.check("eight_pooled_sessions/" + case, len(before) == len(after) == 8)
            values = [metric(before, after, stage) for stage in PHASES]
            pooled.append({"case": case, "unaffected": True, "measuredSessionsPerVersion": 8,
                           "actionsPerSession": ACTIONS[case], "levelsCompleted": before[0]["levelsCompleted"],
                           "cohortRounds": [{"cohort": cohort, "rounds": 4} for cohort in ("cohort_1", "cohort_2")],
                           "metrics": values})
            a, b = median([trial["replayElapsedMs"] for trial in before]), median([trial["replayElapsedMs"] for trial in after])
            accepted = within_decimal(a, b)
            global_cases.append({"case": case, "sessionsPerVersion": 8, "beforeMedianMs": a, "afterMedianMs": b,
                                 "medianRelativeIncrease": (b - a) / a, "accepted": accepted,
                                 "result": "within_user_global_budget" if accepted else "global_budget_exceeded"})
        unresolved = unresolved_for(pooled)
        phase_status = "budget_review_required" if unresolved else "passed"
        accepted = all(row["accepted"] for row in global_cases)
        global_status = "accepted_under_predeclared_owner_cost_rule" if accepted else "global_budget_review_required"
        self.equal("all_pooled_phase_metrics", aggregate["comparisons"], pooled)
        self.equal("all_pooled_unresolved", aggregate["unresolved"], unresolved)
        self.equal("pooled_diagnostic_phase_status", aggregate["phaseStatus"], phase_status)
        self.equal("sixteen_budget_metrics", aggregate["budgetMetricCount"], 16)
        self.equal("unchanged_relative_phase_budget", aggregate["relativeBudget"], 0.1)
        self.equal("pooled_within_budget_count", aggregate["withinObservedBudget"], 16 - len(unresolved))
        self.equal("all_global_cases_decimal_rule", aggregate["globalCases"], global_cases)
        self.equal("global_accepted", aggregate["globalAccepted"], accepted)
        self.equal("distinct_global_status", aggregate["globalStatus"], global_status)
        sources = {side: {key: context[role][key] for key in ("digest", "fileCount")}
                   for side, role in (("baseline", "baseline"), ("after", "candidate"))}
        self.equal("aggregate_sources", aggregate["sources"], sources)
        method = {"selectedCohort": None, "excludedMeasuredSessions": 0, "excludedOutliers": 0,
                  "noiseAllowanceAdded": False, "excludedWarmupsPerCaseAndVersion": 2,
                  "workMetadataExactWithinEachVersion": True, "workMetadataExactAcrossVersions": False,
                  "behaviorMetadataExactAcrossVersions": True, "structuralExpectation": STRUCTURAL_EXPECTATION,
                  "structuralFixture": context["contract"]["structuralFixture"],
                  "structuralDifferencesEnumerated": True, "originalBudgetMetricsExactlyReproduced": True,
                  "p95MinimumSamples": 20, "p95Method": "Empirical nearest rank, withheld below 20 samples.",
                  "globalComparison": "strictly_less_than", "globalRelativeLimit": 0.1}
        self.equal("exact_predeclared_method", aggregate["method"], method)
        context.update(cohortComparisons=cohort_comparisons, comparisons=pooled, globalCases=global_cases,
                       globalAccepted=accepted, globalStatus=global_status, sources=sources, method=method,
                       diagnosticPhaseRule={"status": phase_status, "budgetMetricCount": 16,
                                            "withinObservedBudget": 16 - len(unresolved), "unresolved": unresolved})

    def finish(self, context):
        for target, record in list(self.retained.items()):
            hasher, size = hashlib.sha256(), 0
            with target.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    size += len(chunk)
                    hasher.update(chunk)
            self.check("unchanged_at_end/" + record["path"], size == record["bytes"] and hasher.hexdigest() == record["sha256"])
        inputs = [record for path, record in self.retained.items() if path.is_relative_to(ROOT)]
        external = [record for path, record in self.retained.items() if not path.is_relative_to(ROOT)]
        self.check("unique_final_input_paths", len(inputs) == len({record["path"] for record in inputs}))
        accepted = context["globalAccepted"]
        return {"schema": "logos-engine.lot6b-owner-cost-review.v2", "status": "qualified_owner_cost_review_passed",
                "recordedAt": datetime.now(timezone.utc).isoformat(), "lot": "6B",
                "nativeVersion": context["policy"]["candidate"]["nativeVersion"],
                "generator": context["contract"]["tools"]["reviewer"], "derivedFrom": DERIVED_FROM,
                "contract": context["contractRecord"], "aggregate": context["aggregateRecord"],
                "declaration": context["declarationRecord"], "inputs": inputs, "watchedExternalInputs": external,
                "structuralFixture": context["contract"]["structuralFixture"], "structuralAttribution": context["structuralFixture"]["attribution"],
                "inputsUnchanged": True, "structuralProof": True,
                "historicalStrictPassed": False, "historicalStrict": context["historicalStrict"],
                "globalStatus": context["globalStatus"], "globalAccepted": accepted, "accepted": accepted,
                "acceptedCases": sum(row["accepted"] for row in context["globalCases"]), "totalCases": 2,
                "globalCases": context["globalCases"], "diagnosticPhaseRule": context["diagnosticPhaseRule"],
                "cohortComparisons": context["cohortComparisons"], "comparisons": context["comparisons"],
                "retainedPhaseMetrics": [{"case": row["case"], **item} for row in context["comparisons"]
                                         for item in row["metrics"] if item["stage"] != "session_elapsed"],
                "structuralDifferences": self.structural_rows, "includedMeasuredSessions": context["included"],
                "excludedWarmups": context["warmups"], "sessionLedger": context["sessionTimes"],
                "measuredSessions": 32, "measuredActions": 400, "excludedWarmupSessions": 8, "excludedWarmupActions": 24,
                "sources": context["sources"], "method": context["method"],
                "checkedCount": len(self.checks), "checks": self.checks,
                "qualification": "Independent standard-library recalculation of both original phase comparisons, all pooled phase metrics, every structural delta, the complete ABBA ledger and the strict Decimal global-session rule. No measurement, comparator or agent was executed by this reviewer. The historical strict failure remains failed. Exactly four predeclared structural paths are qualified only when every warmup and measured session matches the fingerprinted functional fixture; its separate causal attribution and capture receipts remain bound. Large capture graphs are fingerprinted, not reinterpreted. All other cross-version work and all within-version work must match. All measured sessions and available p95 remain. A qualified arithmetic review does not turn a global budget failure into acceptance, establish the cause of a timing difference, or establish source-parity, isolation, live-game or hours-long guarantees."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("contract")
    parser.add_argument("aggregate")
    parser.add_argument("output")
    args = parser.parse_args()
    review = Review()
    output = review.local(args.output)
    review.check("exclusive_new_output", not output.exists())
    context = review.load_protocol(args.contract, args.aggregate)
    review.load_window(context)
    review.verify_structure_and_ledgers(context)
    review.verify_historical_failure(context)
    review.recalculate(context)
    review.check("output_does_not_replace_retained_input", output not in review.retained)
    result = review.finish(context)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as stream:
        json.dump(result, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write("\n")
    print(json.dumps({"status": result["status"], "historicalStrictPassed": False,
                      "globalStatus": result["globalStatus"], "accepted": result["accepted"],
                      "acceptedCases": result["acceptedCases"], "totalCases": result["totalCases"],
                      "structuralProof": True, "checkedCount": result["checkedCount"],
                      "output": output.relative_to(ROOT).as_posix()}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"schema": "logos-engine.lot6b-owner-cost-review-error.v2", "status": "owner_cost_review_failed",
                          "structuralProof": False, "historicalStrictPassed": False,
                          "error": type(error).__name__ + ": " + str(error)}), file=sys.stderr)
        raise SystemExit(1)
