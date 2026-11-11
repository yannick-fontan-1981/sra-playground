#!/usr/bin/env python3
"""Bounded development validation only: explicit tests, then five separate gates.

No game campaign, replay, original oracle, cost measurement or publication is
launched. Each invocation executes at most one predeclared command, under the
shared performance lock, with prospectively bounded timeouts and one-second
activity. The retained 133-file run took 854.432 seconds; tools should yield
after 1,000 ms and poll the live process, not block for the whole suite.
Failed attempts are retained and cannot be overwritten or silently reclassified.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[4]
BASE = ROOT / "docs/migration/lot8a-evidence"
PLAN = BASE / "contract/development-validation-plan.json"
LOCK = Path("/workspace/shared/sra-coordination/performance.lock")
SOURCE = ROOT / "reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source"
MANIFEST = SOURCE.parent / "manifest.json"
BUILD_EXTRAS = [
    "package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "index.html", ".openai/hosting.json",
    "scripts/prepare-python.mjs", "scripts/python-runtime-assets.json",
    "scripts/generate-content-pages.mjs", "scripts/generate-game-gallery.mjs",
]
EXCLUDED = [
    "tests/v6-ranked-workshop-reference.test.ts",
    "tests/v6-ranked-workshop-kernel.test.ts",
    "tests/v6-symbol-transactions-kernel.test.ts",
    "tests/v6-framed-transfer-reference.test.ts",
]
NEW_TESTS = [
    "tests/v6-motif-access-reference.test.ts",
    "tests/v6-motif-access-contract.test.ts",
    "tests/v6-motif-access-kernel.test.ts",
    "tests/v6-window-question-kernel.test.ts",
    "tests/v6-window-question-reference.test.ts",
]


def now():
    return datetime.now(timezone.utc).isoformat()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def fp(path):
    path = Path(path)
    return {"path": path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path),
            "sha256": sha(path), "bytes": path.stat().st_size}


def write_absent(path, value):
    with path.open("x") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def checked(record):
    path = Path(record["path"])
    path = path if path.is_absolute() else ROOT / path
    require(fp(path) == record, "Recorded bytes changed: " + record["path"])
    return path


def coordination(plan):
    require(set(plan["coordination"]) == {"lot10b", "lot10c", "lot5c", "lot6b"}, "Monitor actual successor10C as well as the retained10B/5C/6B records")
    result = {}
    for lane, declaration in plan["coordination"].items():
        path = Path(declaration["path"])
        with path.open("rb") as stream:
            raw = stream.read(65537)
        require(len(raw) <= 65536, "Coordination record exceeds 64 KiB: " + lane)
        value = json.loads(raw)
        require(value.get("quiet_requested") is not True, "New quiet request: " + lane)
        require(value.get("performance_lock_held") is not True, "Peer owns performance interval: " + lane)
        require(value.get("quiet_request_id") == declaration["observedRequestId"],
                "Quiet request identity changed; stop and coordinate: " + lane)
        request = value.get("cost_quiet_request")
        if isinstance(request, dict):
            require(request.get("id") == declaration.get("observedCostRequestId") and
                    request.get("requestedAt") == declaration.get("observedCostRequestedAt"),
                    "New official quiet request: " + lane)
        require(value.get("quiet_requested_at") == declaration.get("observedRequestedAt"),
                "Quiet request timestamp changed: " + lane)
        result[lane] = {"path": str(path), "sha256": hashlib.sha256(raw).hexdigest(),
                        "bytes": len(raw), "observedAt": now(), "value": value}
    return result


def inventory(folders):
    """Filename inventory followed by opaque hashing; no fixture decoding."""
    command = ["rg", "--files", "--hidden", "--no-ignore", "-g", "!**/__pycache__/**", "-g", "!**/*.pyc",
               "--", *folders]
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=10)
    require(completed.returncode in (0, 1), "Filename inventory failed")
    paths = sorted(set(completed.stdout.splitlines()))
    require(all(not Path(name).is_absolute() and (ROOT / name).is_file() for name in paths),
            "Invalid filename inventory")
    return {name: sha(ROOT / name) for name in paths}


def native(source):
    files = {name: digest for name, digest in source.items()
             if (name.startswith("src/logos-engine/") or name.startswith("src/runtime/")) and
             Path(name).suffix in (".ts", ".json", ".drm")}
    return {"fileCount": len(files),
            "digest": hashlib.sha256(json.dumps(files, separators=(",", ":")).encode()).hexdigest(),
            "files": files}


def original_inputs():
    manifest = json.loads(MANIFEST.read_text())
    result = {}
    for name, record in manifest["files"].items():
        path = SOURCE / name
        require(path.is_file() and path.stat().st_size == record["bytes"], "Original input missing: " + name)
        actual = sha(path)
        require(actual == record["sha256"], "Pinned original changed: " + name)
        result[path.relative_to(ROOT).as_posix()] = actual
    require(len(result) == 1786, "Unexpected original pin membership")
    return {"manifest": fp(MANIFEST), "files": result}


def inputs():
    source_tests = inventory(["src", "tests"])
    build = inventory(["src", "public", "content"])
    for name in BUILD_EXTRAS:
        if (ROOT / name).exists():
            build[name] = sha(ROOT / name)
    return {"nativeSource": native(source_tests), "sourceAndTestInputs": source_tests,
            "auxiliaryScriptInputs": inventory(["scripts"]), "buildInputs": dict(sorted(build.items())),
            "originalInputs": original_inputs()}


def audit_inputs(plan):
    names = ["scripts/audit-v6-entry-points.ts", "scripts/audit-v6-migration.py", "migration/v6-transfer-map.json"]
    result = {"files": {name: fp(ROOT / name) for name in names},
              "externalBuildHelperFiles": plan["externalBuildHelperFiles"]}
    for record in result["externalBuildHelperFiles"]:
        checked(record)
    transfer = json.loads((ROOT / "migration/v6-transfer-map.json").read_text())
    paths = set()
    for row in transfer["mappings"]:
        paths.update(row["targets"])
        paths.update(row["proof"])
        paths.update((SOURCE / value).relative_to(ROOT).as_posix() for value in row["sources"])
    result["proofTargetAndOriginalExistence"] = {name: (ROOT / name).is_file() for name in sorted(paths)}
    return result


def validate_plan(plan):
    require(plan.get("status") == "declared_ready_for_explicit_root_go", "Draft plan cannot execute; reconcile the actual published predecessor and obtain root GO")
    require(plan["schema"] == "logos-engine.v6.motif-access-development-validation-plan.v1", "Unexpected plan")
    require(plan["qualification"] == "development_only_on_site103_not_final_065_or_cost", "Development qualification changed")
    require(plan["excludedTestModules"] == EXCLUDED, "Closed LKEY exclusions changed")
    require(plan["baseSite"]["version"] == 103 and
            plan["baseSite"]["publishedCommit"] == "4afcbfe6a25bd3a88223be543e443bc53b9c8814",
            "Actual published predecessor changed")
    publication = json.loads(checked(plan["predecessorProof"]["publication"]).read_text())
    require(publication["siteVersion"] == 103 and publication["deployment"]["status"] == "succeeded" and
            publication["versions"][0]["source"]["commit_sha"] == plan["baseSite"]["publishedCommit"],
            "Actual Site103 publication proof mismatch")
    review = json.loads(checked(plan["predecessorProof"]["mergeReview"]).read_text())
    require(review["publishedPredecessor"] == plan["baseSite"]["publishedCommit"] and
            sorted(review["nativeDeltas"]) == plan["predecessorProof"]["allowedNativeDeltas"],
            "Declared native merge delta changed")
    checked(plan["predecessorProof"]["nativeManifest"])
    materialization = json.loads(checked(plan["safeFixtureMaterialization"]).read_text())
    for item in materialization["files"]:
        actual = fp(ROOT / item["file"])
        require(actual["sha256"] == item["sha256"] and actual["bytes"] == item["bytes"],
                "Materialized safe fixture differs from its retained byte proof")
    checked(plan["newPredecessorSyntheticFixture"])
    require(plan["newTestFiles"] == NEW_TESTS, "New scope changed")
    scope = json.loads(checked(plan["inheritedScope"]).read_text())
    require(len(scope["testFiles"]) == 133, "Inherited safe scope changed")
    require(plan["testFiles"] == scope["testFiles"] + NEW_TESTS, "Exact inherited order plus the five declared added files is required")
    require(len(plan["testFiles"]) == len(set(plan["testFiles"])) == 138, "Expected 138 unique test files")
    require(not set(EXCLUDED).intersection(plan["testFiles"]), "Closed module is in test scope")
    for name in plan["testFiles"]:
        require(name.startswith("tests/") and name.endswith(".test.ts") and (ROOT / name).is_file(),
                "Missing declared test: " + name)
        require(sha(ROOT / name) == plan["testFileHashes"][name], "Declared test source changed: " + name)
    historical = json.loads(checked(plan["historicalChecks"]).read_text())
    require(plan["checks"] == [{"name": row["name"], "command": row["command"]} for row in historical["checks"]],
            "Five gate commands must match the retained actual receipt")
    require([row["name"] for row in plan["checks"]] ==
            ["typecheck", "entry-audit", "migration-audit", "diff-check", "build"], "Five gate order changed")
    require(plan["testCommand"] == ["node", "--test", "--test-concurrency=1", "--test-reporter=tap", *plan["testFiles"]],
            "Explicit TAP test command changed")
    require(plan["commandTimeoutSeconds"] == {"tests": 1800, "check": 180} and plan["activityIntervalSeconds"] == 1,
            "Prospective execution budget changed")
    require(fp(Path(__file__)) == plan["runner"], "Runner differs from prospective plan")
    for record in plan["externalBuildHelperFiles"]:
        checked(record)


def transport_logs(records, directory, name):
    """Lossless named-log storage, with no rewriting or omission of raw bytes."""
    stored = []
    for record in records:
        raw_path = checked(record)
        compressed_path = Path(str(raw_path) + ".gz")
        raw = raw_path.read_bytes()
        compressed = gzip.compress(raw, mtime=0)
        with compressed_path.open("xb") as stream:
            stream.write(compressed)
        require(gzip.decompress(compressed) == raw, "Lossless log transport mismatch")
        stored.append({"raw": record, "gzip": fp(compressed_path)})
    manifest = {"schema": "logos-engine.v6.development-log-transport.v1", "recordedAt": now(),
                "status": "verified_byte_exact", "entries": stored,
                "qualification": "Complete stdout, stderr and activity, including failures; no filtering or newline normalization."}
    target = directory / (name + "-log-transport.json")
    write_absent(target, manifest)
    return fp(target)


def retained_log(execution, record):
    manifest = json.loads(checked(execution["logTransport"]).read_text())
    require(manifest["status"] == "verified_byte_exact", "Invalid log transport")
    matches = [row for row in manifest["entries"] if row["raw"] == record]
    require(len(matches) == 1, "Log not uniquely bound by transport")
    raw = gzip.decompress(checked(matches[0]["gzip"]).read_bytes())
    require(len(raw) == record["bytes"] and hashlib.sha256(raw).hexdigest() == record["sha256"],
            "Transported raw log fingerprint mismatch")
    original = ROOT / record["path"]
    if original.exists():
        checked(record)
    return raw


def terminate(process):
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=0.5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=1)


def execute(command, name, directory, lock_fd, plan):
    stdout_path, stderr_path = directory / (name + "-stdout.log"), directory / (name + "-stderr.log")
    activity_path = directory / (name + "-activity.jsonl")
    started, clock = now(), time.monotonic()
    stop_reason = None
    process = None
    limit = plan["commandTimeoutSeconds"]["tests" if name == "tests" else "check"]
    with stdout_path.open("xb") as output, stderr_path.open("xb") as errors, activity_path.open("x") as activity:
        try:
            env = os.environ.copy()
            env["PYTHONDONTWRITEBYTECODE"] = "1"
            process = subprocess.Popen(command, cwd=ROOT, stdout=output, stderr=errors, env=env,
                                       start_new_session=True, pass_fds=(lock_fd,))
            while process.poll() is None:
                elapsed = time.monotonic() - clock
                status = {"name": name, "pid": process.pid, "elapsedSeconds": round(elapsed, 3), "at": now()}
                activity.write(json.dumps(status) + "\n")
                activity.flush()
                print(json.dumps(status), flush=True)
                if elapsed >= limit:
                    stop_reason = "predeclared_" + str(limit) + "_second_timeout"
                    terminate(process)
                    break
                try:
                    coordination(plan)
                except Exception as error:
                    stop_reason = "coordination_stop: " + str(error)
                    terminate(process)
                    break
                try:
                    process.wait(timeout=min(1, limit - elapsed))
                except subprocess.TimeoutExpired:
                    pass
        except BaseException as error:
            if process is not None:
                terminate(process)
            stop_reason = "execution_exception: " + type(error).__name__ + ": " + str(error)
    quiet_stop = bool(stop_reason and stop_reason.startswith("coordination_stop:"))
    def recorded_log(path):
        if quiet_stop:
            return {"path": path.relative_to(ROOT).as_posix(), "bytes": path.stat().st_size,
                    "sha256DeferredBecauseQuietWasRequested": True}
        return fp(path)
    row = {"name": name, "command": command, "startedAt": started, "finishedAt": now(),
           "elapsedSeconds": time.monotonic() - clock,
           "exitCode": process.returncode if process is not None else None,
           "predeclaredTimeoutSeconds": limit, "stoppedReason": stop_reason,
           "stdout": recorded_log(stdout_path), "stderr": recorded_log(stderr_path),
           "activity": recorded_log(activity_path)}
    if not quiet_stop:
        row["logTransport"] = transport_logs([row["stdout"], row["stderr"], row["activity"]], directory, name)
    return row


def semantic(row, plan):
    output = retained_log(row, row["stdout"]).decode()
    name = row["name"]
    result = {"passed": False, "failures": []}
    if row["exitCode"] != 0 or row["stoppedReason"] is not None:
        result["failures"].append("Child process did not complete successfully")
        return result
    if name == "tests":
        matches = {key: re.findall(r"^# " + key + r" (\d+)\s*$", output, re.M)
                   for key in ("tests", "pass", "fail", "cancelled", "skipped", "todo")}
        require(all(len(value) == 1 for value in matches.values()), "Missing or ambiguous full TAP summary")
        counts = {key: int(value[0]) for key, value in matches.items()}
        result["counts"] = counts
        require(counts["tests"] > 0 and counts["tests"] == counts["pass"] and
                all(counts[key] == 0 for key in ("fail", "cancelled", "skipped", "todo")), "TAP counts failed")
    elif name == "entry-audit":
        summary = json.loads(output)
        report_path = ROOT / "docs/migration/v6-entry-point-progress.json"
        report = json.loads(report_path.read_text())
        expected = plan["expectedEntryCoverage"]
        require(summary["connected"] == report["connected"] == expected["connected"] and
                summary["declared"] == report["declared"] == expected["declared"], "Entry coverage differs from declared 65/76")
        require(summary["fullV6Parity"] is False and report["fullV6Parity"] is False, "Development report overclaims full parity")
        require(summary["groups"] == expected["groups"] and
                [{"id": group["id"], "connected": group["connected"], "declared": group["declared"]}
                 for group in report["groups"]] == expected["groups"], "Entry group counters differ from declaration")
        require(all(summary[key] == report[key] for key in ("connected", "declared", "percent", "fullV6Parity")),
                "Entry stdout differs from its retained report")
        require(summary.get("failures", []) == [] and report.get("failures", []) == [], "Entry audit semantic failures")
        result.update(summary=summary, report=fp(report_path))
    elif name == "migration-audit":
        summary = json.loads(output)
        report_path = ROOT / "docs/migration/v6-coverage.json"
        report = json.loads(report_path.read_text())
        require("failures" in summary and summary["failures"] == [], "Migration audit stdout has semantic failures: " + repr(summary.get("failures")))
        require("failures" in report and report["failures"] == [], "Migration coverage has semantic failures")
        require(summary == {"complete": report["complete"], **report["summary"], "failures": report["failures"]},
                "Migration stdout and complete coverage summary differ")
        require(summary["complete"] is False, "Development stage unexpectedly claims complete migration")
        result.update(summary=summary, report=fp(report_path))
    elif name == "build":
        workers = sorted((ROOT / "dist/assets").glob("v6-agent-worker-*.js"))
        require(len(workers) == 1, "Expected exactly one built native agent worker")
        result["nativeAgentWorker"] = fp(workers[0])
        result["distFiles"] = inventory(["dist"])
    result["passed"] = True
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=("tests", "check"))
    parser.add_argument("--directory", required=True, help="A new development attempt beneath docs/migration/lot8a-evidence")
    parser.add_argument("--name", choices=("typecheck", "entry-audit", "migration-audit", "diff-check", "build"))
    args = parser.parse_args()
    require((args.stage == "check") == (args.name is not None), "check requires --name; tests must not use it")
    directory = (ROOT / args.directory).resolve()
    require(directory.is_relative_to(BASE) and directory not in (BASE, BASE / "contract", BASE / "tools") and
            not directory.is_relative_to(BASE / "contract") and not directory.is_relative_to(BASE / "tools"),
            "Use a distinct development attempt directory")
    plan = json.loads(PLAN.read_text())
    with LOCK.open("a+b") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_SH | fcntl.LOCK_NB)
        coordination_before = coordination(plan)
        validate_plan(plan)
        if args.stage == "tests":
            require(not directory.exists(), "Attempt directory already exists; preserve prior outputs")
            directory.mkdir(parents=True)
            name, command, receipt_path = "tests", plan["testCommand"], directory / "tests-run.json"
        else:
            require(directory.is_dir(), "Successful declared tests stage is required")
            name = args.name
            command = next(row["command"] for row in plan["checks"] if row["name"] == name)
            receipt_path = directory / (name + "-run.json")
        require(not receipt_path.exists(), "Receipt already exists; no overwrite")
        receipt = {"schema": "logos-engine.v6.motif-access-development-validation.v1",
                   "status": "failed", "stage": args.stage, "name": name, "startedAt": now(),
                   "qualification": plan["qualification"], "baseSite": plan["baseSite"],
                   "plan": fp(PLAN), "generator": fp(Path(__file__)), "coordinationBefore": coordination_before,
                   "testFiles": plan["testFiles"], "excludedTestModules": EXCLUDED,
                   "launchedGameActions": 0, "launchedOriginalOracles": 0, "launchedReplays": 0}
        passed = False
        try:
            before = inputs()
            require(before["nativeSource"]["digest"] == plan["preparedNativeSource"]["digest"] and
                    before["nativeSource"]["fileCount"] == plan["preparedNativeSource"]["fileCount"],
                    "Native source differs from the prepared development declaration")
            if args.stage == "tests":
                receipt["mappingAtTestsBefore"] = fp(ROOT / "migration/v6-transfer-map.json")
                write_absent(directory / "development-freeze.json", {
                    "schema": "logos-engine.v6.development-freeze.v1", "frozenAt": now(),
                    "qualification": plan["qualification"], "baseSite": plan["baseSite"],
                    "plan": receipt["plan"], "generator": receipt["generator"], "inputs": before})
            else:
                tests_path = directory / "tests-run.json"
                tests = json.loads(tests_path.read_text())
                require(tests["status"] == "passed" and tests["plan"] == receipt["plan"] and
                        tests["generator"] == receipt["generator"], "Fresh successful tests with the same plan and runner are required")
                require(tests["inputsAfter"] == before, "Native/source/test/build/original inputs changed since successful tests")
                receipt["successfulTests"] = fp(tests_path)
                for record in (tests["execution"]["stdout"], tests["execution"]["stderr"], tests["execution"]["activity"]):
                    retained_log(tests["execution"], record)
                index = [row["name"] for row in plan["checks"]].index(name)
                receipt["precedingChecks"] = []
                for previous in plan["checks"][:index]:
                    prior_path = directory / (previous["name"] + "-run.json")
                    prior = json.loads(prior_path.read_text())
                    require(prior["status"] == "passed" and prior["plan"] == receipt["plan"] and
                            prior["generator"] == receipt["generator"] and prior["inputsAfter"] == before,
                            "A preceding gate is absent, failed or bound to changed inputs")
                    for record in (prior["execution"]["stdout"], prior["execution"]["stderr"], prior["execution"]["activity"]):
                        retained_log(prior["execution"], record)
                    if prior.get("semantic", {}).get("report"):
                        checked(prior["semantic"]["report"])
                    receipt["precedingChecks"].append(fp(prior_path))
                current_audits = audit_inputs(plan)
                audit_path = directory / "checks-inputs.json"
                if index == 0:
                    require(not audit_path.exists(), "Checks stage already initialized")
                    write_absent(audit_path, {"recordedAt": now(), "successfulTests": receipt["successfulTests"],
                                            "qualification": "Mapping and named proof existence pinned after tests, before gates",
                                            "inputs": current_audits})
                else:
                    require(json.loads(audit_path.read_text())["inputs"] == current_audits,
                            "Audit/mapping/build-helper inputs changed after checks began")
                receipt["checksInputs"] = fp(audit_path)
                receipt["auditInputsBefore"] = current_audits
            receipt["inputsBefore"] = before
            coordination(plan)
            receipt["execution"] = execute(command, name, directory, lock.fileno(), plan)
            require(not str(receipt["execution"].get("stoppedReason") or "").startswith("coordination_stop:"),
                    "New quiet request stopped this attempt; post-command hashing deferred and no validation claimed")
            coordination(plan)
            # Preserve stable inputs even when the child or semantic gate failed.
            after = inputs()
            if args.stage == "tests":
                receipt["mappingAtTestsAfter"] = fp(ROOT / "migration/v6-transfer-map.json")
                require(receipt["mappingAtTestsBefore"] == receipt["mappingAtTestsAfter"],
                        "Mapping changed during the test stage")
            receipt["inputsAfter"] = after
            receipt["inputsUnchanged"] = before == after
            receipt["coordinationAfter"] = coordination(plan)
            if args.stage == "check":
                receipt["auditInputsAfter"] = audit_inputs(plan)
                require(receipt["auditInputsBefore"] == receipt["auditInputsAfter"], "Audit inputs changed during the gate")
            require(receipt["inputsUnchanged"], "Declared functional or build inputs changed during the command")
            receipt["semantic"] = semantic(receipt["execution"], plan)
            require(receipt["semantic"]["passed"], "Command or semantic gate failed")
            if name == "build":
                receipt["finalValidatedBuild"] = receipt["semantic"]["nativeAgentWorker"]
                receipt["completedChecks"] = [row["name"] for row in plan["checks"]]
            passed = True
            receipt["status"] = "passed"
        except BaseException as error:
            receipt["error"] = {"type": type(error).__name__, "message": str(error)}
            receipt["status"] = "failed"
        receipt["finishedAt"] = now()
        write_absent(receipt_path, receipt)
        print(json.dumps({"status": receipt["status"], "name": name, "receipt": fp(receipt_path),
                          "semanticPassed": receipt.get("semantic", {}).get("passed"),
                          "counts": receipt.get("semantic", {}).get("counts"),
                          "error": receipt.get("error")}), flush=True)
        if not passed:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
