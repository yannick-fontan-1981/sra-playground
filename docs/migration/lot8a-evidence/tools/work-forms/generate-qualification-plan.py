#!/usr/bin/env python3
"""Pin completed 8A functional captures and declare their later static review.

This program reads files and writes one new plan only. It does not import native
code, run the qualifier, start a session, or modify the retained capture plan.
"""
import argparse
import copy
import datetime
import hashlib
import json
from pathlib import Path

DEFAULT_ROOT = "/workspace/sites/sra-lot8a-motif-20261111/.sites-checkout"
BASE = "docs/migration/lot8a-evidence"
RUN = BASE + "/qualification-provisional-02"
DEFAULT_SOURCE = RUN + "/contract/work-form-capture-plan.json"
DEFAULT_OUTPUT = RUN + "/contract/work-form-qualification-plan.json"
QUALIFIER = BASE + "/tools/work-forms/qualify-cost-owner-graphs.mjs"
SUCCESS = "qualified_prepared_work_forms_and_individual_graphs"
EXPECTED = {
    "baseline": "fa23bb76ca4a01b5cfaa72ec6d1d4b4fc2e8969762e966ada8225265fc546886",
    "candidate": "936fa2bf81965272b1ddbab4a5c01f98aeb6a48188c1f7a8c91de226598c5e43",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=DEFAULT_ROOT)
    parser.add_argument("--capture-plan", default=DEFAULT_SOURCE)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--timeout-seconds", type=int, default=600)
    parser.add_argument("--total-timeout-seconds", type=int, default=700)
    args = parser.parse_args()
    root = Path(args.root).resolve(strict=True)
    require(0 < args.timeout_seconds <= args.total_timeout_seconds <= 2400,
            "Expected 0 < command timeout <= total timeout <= 2400")

    def resolve(value):
        p = Path(value)
        return (p if p.is_absolute() else root / p).resolve()

    def label(value):
        p = resolve(value)
        return p.relative_to(root).as_posix() if p.is_relative_to(root) else str(p)

    def fingerprint(value):
        p = resolve(value)
        require(p.is_file(), "Required completed input is absent: " + str(p))
        before = p.stat()
        digest = hashlib.sha256()
        with p.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        after = p.stat()
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) ==
                (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns),
                "Input changed while hashing: " + str(p))
        return {"path": label(p), "sha256": digest.hexdigest(), "bytes": after.st_size}

    def read(value):
        return json.loads(resolve(value).read_text(),
                          parse_constant=lambda x: (_ for _ in ()).throw(ValueError(x)))

    source_path = resolve(args.capture_plan)
    output_path = resolve(args.output)
    require(source_path.is_relative_to(root / BASE), "Capture plan is outside 8A evidence")
    require(output_path.is_relative_to(root / BASE), "New plan is outside 8A evidence")
    require(source_path != output_path and not output_path.exists(), "New plan must not exist")
    require(output_path.parent.is_dir(), "New plan parent directory must already exist")
    source_fp = fingerprint(source_path)
    source = read(source_path)
    require(source["schema"] == "logos-engine.v6.functional-qualification-plan.v1"
            and source["version"] == 1 and source["qualification"] == "functional_only"
            and source["status"] == "declared_ready_for_explicit_root_go", "Unexpected source plan")
    require(source["runner"]["path"] == BASE + "/tools/qualify-composition-v2.py", "Expected V2 wrapper")
    stages = {s["name"]: s for s in source["stages"]}
    require(len(stages) == len(source["stages"]) == 3, "Expected the three capture-plan stages")
    inventory_stage = stages["work-form-owner-inventory"]
    inventory_path = resolve(inventory_stage["argv"][-1])
    captures = {}
    for role in ("baseline", "candidate"):
        stage = stages["work-form-" + role + "-capture"]
        require(len(stage["argv"]) == 7 and stage["argv"][2] == role, "Unexpected capture argv")
        report = resolve(stage["argv"][-1])
        require(report.name.endswith(".json.gz"), "Expected gzip capture")
        receipt = report.with_name(report.name[:-8] + ".receipt.json")
        require([report, receipt] == [resolve(p) for p in stage["outputPaths"]], "Capture output mismatch")
        captures[role] = {"report": report, "receipt": receipt}
    require([inventory_path] == [resolve(p) for p in inventory_stage["outputPaths"]], "Inventory output mismatch")
    artifacts = [inventory_path] + [captures[role][kind] for role in ("baseline", "candidate")
                                    for kind in ("report", "receipt")]
    require(all(p.is_relative_to(root / BASE) and p.is_file() for p in artifacts),
            "Run this generator only after all five capture artifacts exist")
    workdir = inventory_path.parent
    require(all(p.parent == workdir for p in artifacts), "Expected one work-form evidence directory")
    review = workdir / "owner-graph-attribution.json"
    forms = workdir / "work-forms.json"
    differences = workdir / "owner-graph-attribution.differences.jsonl.gz"
    outputs = [review, forms, differences]
    require(all(not p.exists() for p in outputs + [workdir / "window.json", workdir / "readiness.json"]),
            "Refusing an existing qualification output or official cost window")

    pins = {}
    def pin(value, expected=None):
        actual = fingerprint(value)
        if expected is not None:
            require(actual["sha256"] == expected["sha256"] and actual["bytes"] == expected["bytes"],
                    "Recorded fingerprint differs: " + actual["path"])
        key = str(resolve(value))
        require(key not in pins or pins[key] == actual, "Conflicting input fingerprint")
        pins[key] = actual
        return actual

    for record in source["inputFiles"]:
        pin(record["path"], record)
    for key in ("runner", "inventoryRunner", "summary", "nativeManifest", "freeze"):
        pin(source[key]["path"], source[key])
    pin(source_path, source_fp)
    generator = pin(Path(__file__).resolve())
    inventory_fp = pin(inventory_path)
    inventory = read(inventory_path)
    require(inventory["schema"] == "logos-engine.lot8a-prepared-owner-cost-source-inventory.v1"
            and inventory["qualificationStage"] == "prepared_parent_only_not_official_cost"
            and inventory["officialPerformanceEligible"] is False
            and inventory["globalLockUsed"] is False, "Inventory is not the prepared functional inventory")
    require(inventory["changes"] == {"ownersAdded": ["motif_access"], "ownersRemoved": [],
                                    "programsAdded": [], "programsRemoved": []}, "Owner inventory changed")
    capture_fps = {}
    for role in ("baseline", "candidate"):
        report_fp = pin(captures[role]["report"])
        receipt_fp = pin(captures[role]["receipt"])
        receipt = read(captures[role]["receipt"])
        require(receipt["schema"] == "logos-engine.lot8a-prepared-owner-cost-functional-capture-receipt.v1"
                and receipt["status"] == "captured_functional_structure" and receipt["role"] == role
                and receipt["preparedOnly"] is True and receipt["officialPerformanceEligible"] is False
                and receipt["globalLockUsed"] is False and receipt["failures"] == [], "Capture is incomplete: " + role)
        require(receipt["sessionCount"] == 4 and len(receipt["sessions"]) == 4 and receipt["actions"] == 31,
                "Unexpected capture size: " + role)
        require(all(receipt[k] is True for k in ("nativeSourceUnchanged", "inputsUnchanged", "generatorUnchanged")),
                "Capture inputs changed: " + role)
        require(all(receipt[k] == 0 for k in ("measuredCostSessions", "timingReportsRead", "timingMetricsProduced")),
                "Capture is not untimed: " + role)
        require(receipt["nativeDigest"] == EXPECTED[role]
                and receipt["nativeInventoryBefore"] == receipt["nativeInventoryAfter"]
                == inventory["sourceInventory"][role]["native"], "Native source binding differs: " + role)
        require(receipt["sourceCommit"] == inventory["sourceInventory"][role]["sourceCommit"],
                "HEAD changed between inventory and capture: " + role)
        require(receipt["checkout"] == inventory["sourceInventory"][role]["checkout"], "Checkout binding differs")
        require(resolve(receipt["report"]["path"]) == captures[role]["report"], "Wrong captured report path")
        pin(receipt["report"]["path"], receipt["report"])
        require(receipt["inputsBefore"] == receipt["inputsAfter"], "Capture input list changed")
        for record in receipt["inputsBefore"]:
            pin(record["path"], record)
        capture_fps[role] = {"report": report_fp, "receipt": receipt_fp}

    assertions = []
    def equal(file, path, value):
        assertions.append({"file": label(file), "path": path, "op": "value_equal", "value": value})
    for file, schema in ((review, "logos-engine.lot8a-prepared-work-graph-review.v1"),
                         (forms, "logos-engine.lot8a-prepared-work-forms.v1")):
        for path, value in ((["schema"], schema), (["status"], SUCCESS), (["preparedOnly"], True),
                            (["officialPerformanceEligible"], False), (["strictCommonGraphParity"], False),
                            (["nativeDigests"], EXPECTED), (["differences", "path"], label(differences))):
            equal(file, path, value)
    assertions.append({"file": label(review), "path": ["failures"], "op": "list_empty"})
    assertions.append({"file": label(forms), "path": ["forms"], "op": "length", "value": 4})
    equal(review, ["ownerInventory"], inventory_fp)
    equal(forms, ["captures"], capture_fps)
    equal(forms, ["review", "path"], label(review))
    argv = [stages["work-form-candidate-capture"]["argv"][0], QUALIFIER] + [label(p) for p in artifacts + [review, forms]]
    require(len(argv) == 9 and all(str(resolve(p)) in pins for p in argv[1:7]),
            "All six existing argv files must be declared in inputFiles, independently of top-level metadata")
    stage_name = "work-form-graph-qualification"
    plan = {key: copy.deepcopy(source[key]) for key in
            ("schema", "version", "status", "qualification", "parent", "summary", "nativeManifest",
             "runner", "inventoryRunner", "freeze", "costRule", "currentWorkPolicy", "preparedBaseline")}
    plan.update({
        "declaredAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "qualificationDetail": "Read the completed prepared 6B/8A captures; validate each graph and four work forms per role. Retain every private difference. No session, official timing, strict common-graph parity or publication is granted.",
        "sourceCapturePlan": source_fp,
        "planGenerator": generator,
        "inputFiles": sorted(pins.values(), key=lambda item: item["path"]),
        "stages": [{"name": stage_name, "argv": argv,
                    "env": copy.deepcopy(stages["work-form-candidate-capture"]["env"]),
                    "timeoutSeconds": args.timeout_seconds, "totalTimeoutSeconds": args.total_timeout_seconds,
                    "expectedExitCode": 0, "outputPaths": [label(p) for p in outputs], "assertions": assertions}],
        "executionPolicy": {"explicitRootGoPerStage": True, "automaticRetry": False,
                            "maximumConcurrentNativeQualifications": 1, "noLiveGames": True,
                            "newNativeSessions": False, "globalLockRequired": False,
                            "waitForOtherLotPublication": False, "officialPerformanceOrPublication": False,
                            "sequentialStageOrder": [stage_name]},
        "limits": {"preparedOnly": True, "officialPerformanceEligible": False, "strictCommonGraphParity": False,
                   "fullCallerParity": False, "sameEpisodeThreeOwnerActivation": False,
                   "allPrivateGraphDifferencesRetained": True, "unattributedDifferenceCountMustBeZero": False,
                   "LKEY": source["limits"]["LKEY"]},
        "qualificationContract": {"sessionsPerRole": 4, "actionsPerRole": 31,
                                  "inputArtifacts": {"ownerInventory": inventory_fp, "captures": capture_fps},
                                  "privateComparison": "Nonzero unattributedDifferenceCount remains visible and blocks any strict-parity claim; it does not invalidate this limited prepared-only qualification.",
                                  "differenceStream": label(differences)},
    })
    # Final file-only check before the exclusive write; do not refresh a changed pin.
    for record in plan["inputFiles"]:
        require(fingerprint(record["path"]) == record, "Input changed while constructing the prospective plan")
    with output_path.open("x") as stream:
        json.dump(plan, stream, indent=2, ensure_ascii=True, allow_nan=False)
        stream.write("\n")
    print(json.dumps({"status": "prospective_plan_written_only", "plan": fingerprint(output_path),
                      "stage": stage_name, "inputsPinned": len(plan["inputFiles"]),
                      "argvInputsExplicitlyPinned": True, "nativeSessionsRun": 0,
                      "qualifierExecuted": False, "officialPerformanceEligible": False}, indent=2))


if __name__ == "__main__":
    main()
