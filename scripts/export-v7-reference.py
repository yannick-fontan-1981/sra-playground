#!/usr/bin/env python3
"""Compile and execute the pinned original Python V7 reference.

Usage:
  python scripts/export-v7-reference.py --python-root /path/to/private/checkout
  python scripts/export-v7-reference.py --python-root /path/to/private/checkout --check

Only the exact files in python-sources.json are copied to a temporary snapshot.
The original PreparedSource loader, compiler, scheduler, Runtime and kernel run
unchanged. Two package export initializers are intentionally absent; the original
loader supplies their namespace packages. No Python business logic is substituted.

The original Python source digest includes absolute paths. Its raw graph hashes
therefore vary between snapshots. --check compares the explicitly normalized
histories and separately validates every retained raw Python hash chain.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
import sys
import tempfile


COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
REPOSITORY = "yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan"
V7 = Path("agents/yf_arc3_v7")
EXPORTED_SOURCES = ("generators.src", "activation.src", "knowledge.logos.json", "knowledge.drm.json")
LABELS = ("Initial observation", "First transition", "Composable transition",
          "Supporting evidence", "Counterexample", "Repeated event")
SCENARIO_METADATA = {
    "discovery": ("Hypotheses and counterexamples",
        "Original V7 controlled sequence: discovery, composition, support, contradiction and exact replay.", LABELS),
    "renamed": ("Renamed observations",
        "The same original V7 sequence with renamed attributes and actions.", LABELS),
    "scope_isolation": ("Separate contexts",
        "Original V7 transitions in separate scopes cannot create a cross-scope composition.",
        ("Left context: initial observation", "Left context: transition",
         "Right context: initial observation", "Right context: transition")),
}
NORMALIZATION = {
    "id": "logos-engine.v7.engine-independent-history.v1",
    "memory": ["Remove memory.chain", "Remove each delta.previous, delta.digest and delta.source_digest",
        "Remove node.origin.source_digest in current nodes and delta snapshots"],
    "availability": ["Remove graph_chain and source_digest"],
    "receipt": ["Remove source_digest, graph_chain, before_chain and configured_chain",
        "Remove compute_ms, total_ms and timing_ms; apply the same rule to reconsideration receipts"],
    "preserved": "Every node identity, revision, kind, status, value, evidence, relationship, delta sequence, cause and SRC statement identifier; receipt sequence, workflow hash, input hash, status and instruction count.",
    "raw_reference": "python contains original graph and provenance hashes; volatile timing fields alone are omitted from raw receipts.",
    "numeric_scope": "These fixtures use safe integers. They do not establish equivalence for Python float versus int identity or integers outside the JavaScript safe-integer range.",
}


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def git_blob_sha1(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def materialize(source_root, destination, manifest):
    for relative, expected in manifest["files"].items():
        path = Path(relative)
        if path.is_absolute() or ".." in path.parts:
            raise ValueError("Unsafe path in reference manifest: " + relative)
        data = (source_root / path).read_bytes()
        if (len(data) != expected["bytes"] or sha256(data) != expected["sha256"]
                or git_blob_sha1(data) != expected["git_blob_sha1"]):
            raise ValueError("Pinned source mismatch: " + relative)
        target = destination / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)


def prepare_original_source(root):
    # Import the stdlib-only bootstrap by file, before importing agents or tools.
    # This is the same trust boundary as the original helper's CLI launcher.
    name = "_logos_v7_reference_bootstrap"
    spec = importlib.util.spec_from_file_location(name, root / "tools/v7_prepared_source.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load the original PreparedSource bootstrap")
    bootstrap = importlib.util.module_from_spec(spec)
    sys.modules[name] = bootstrap
    spec.loader.exec_module(bootstrap)
    prepared = bootstrap.PreparedSource(root)
    prepared.install()
    return prepared


def normalize_memory(memory):
    result = copy.deepcopy(memory)
    result.pop("chain")
    for node in result["nodes"].values():
        node["origin"].pop("source_digest")
    for delta in result["deltas"]:
        for key in ("previous", "digest", "source_digest"):
            delta.pop(key)
        delta["node"]["origin"].pop("source_digest")
    return result


def normalize_availability(availability):
    return {key: copy.deepcopy(value) for key, value in availability.items()
            if key not in {"graph_chain", "source_digest"}}


def receipt_without_timing(receipt):
    result = {key: copy.deepcopy(value) for key, value in receipt.items()
              if key not in {"compute_ms", "total_ms", "timing_ms"}}
    if "reconsideration" in result:
        result["reconsideration"] = receipt_without_timing(result["reconsideration"])
    return result


def normalize_receipt(receipt):
    result = {key: value for key, value in receipt_without_timing(receipt).items()
              if key not in {"source_digest", "graph_chain", "before_chain", "configured_chain"}}
    if "reconsideration" in result:
        result["reconsideration"] = normalize_receipt(result["reconsideration"])
    return result


def relative_source_metadata(value, root):
    if isinstance(value, dict):
        return {key: relative_source_metadata(item, root) for key, item in value.items()}
    if isinstance(value, list):
        return [relative_source_metadata(item, root) for item in value]
    if isinstance(value, str) and Path(value).is_absolute():
        try:
            return Path(value).relative_to(root).as_posix()
        except ValueError:
            pass
    return value


def capture_step(runtime, operation, label, plain):
    if operation["kind"] == "advance":
        receipt = runtime.advance(operation["event"])
    elif operation["kind"] == "set_activation":
        receipt = runtime.set_activation(**operation["configuration"])
    else:
        raise ValueError("Unsupported reference operation")
    memory = plain(runtime.memory)
    availability = plain(runtime.availability())
    raw_receipt = receipt_without_timing(plain(receipt))
    return {"label": label, "operation": operation,
        "expected": {"memory": normalize_memory(memory),
                     "availability": normalize_availability(availability),
                     "receipt": normalize_receipt(raw_receipt)},
        "python": {"memory": memory, "availability": availability, "receipt": raw_receipt}}


def validate_raw_histories(fixture, kernel):
    for scenario in fixture["scenarios"]:
        for step in scenario["steps"]:
            memory = step["python"]["memory"]
            previous = None
            for sequence, delta in enumerate(memory["deltas"], start=1):
                assert delta["sequence"] == sequence
                assert delta["previous"] == previous
                assert kernel.digest({k: v for k, v in delta.items() if k != "digest"}) == delta["digest"]
                previous = delta["digest"]
            assert memory["chain"] == previous
            assert step["python"]["availability"]["graph_chain"] == previous
            assert step["python"]["receipt"]["graph_chain"] == previous
            assert normalize_memory(memory) == step["expected"]["memory"]
            assert normalize_availability(step["python"]["availability"]) == step["expected"]["availability"]
            assert normalize_receipt(step["python"]["receipt"]) == step["expected"]["receipt"]


def stable_golden_projection(fixture):
    return {"schema": fixture["schema"], "provenance": fixture["provenance"],
        "normalization": fixture["normalization"], "assessments": fixture["assessments"],
        "activationAssessments": fixture["activationAssessments"],
        "scenarios": [{"id": scenario["id"], "steps": [
            {key: step[key] for key in ("label", "operation", "expected")}
            for step in scenario["steps"]]} for scenario in fixture["scenarios"]]}


def export_reference(root, prepared, manifest, manifest_bytes):
    import pydantic
    from agents.yf_arc3_v5.src.compiler import CompiledModule
    from agents.yf_arc3_v7 import kernel
    from agents.yf_arc3_v7.demo import cases, summary, assess
    from agents.yf_arc3_v7.runtime import Runtime, plain

    runtime = Runtime()
    programs = {"generators": runtime.module, "activation": runtime.activation_module}
    compiled = {name: relative_source_metadata(module.model_dump(mode="json"), root)
                for name, module in programs.items()}
    for module in compiled.values():
        # Confirms that normalizing display paths did not change the semantic IR.
        CompiledModule.model_validate(module)
    provenance = {"repository": REPOSITORY, "commit": COMMIT,
        "compiler": "agents/yf_arc3_v5/src/compiler.py",
        "compilerSha256": manifest["files"]["agents/yf_arc3_v5/src/compiler.py"]["sha256"],
        "sourceFiles": {name: manifest["files"][(V7 / name).as_posix()]["sha256"] for name in EXPORTED_SOURCES},
        "workflowHashes": {"generators": str(runtime.entry.transitive_source_hash),
                           "activation": str(runtime.activation_entry.transitive_source_hash)},
        "pythonSourceManifest": f"reference/v7/{COMMIT}/python-sources.json",
        "pythonSourceManifestSha256": sha256(manifest_bytes),
        "sourceBoundary": manifest["source_boundary"],
        "sourceNameNormalization": "Repository-relative display paths; original semantic IR and hashes are preserved."}
    events_by_case = cases()
    browser_scenarios = []
    for name, events in events_by_case.items():
        title, description, labels = SCENARIO_METADATA[name]
        browser_scenarios.append({"id": name, "title": title, "description": description,
            "events": [{"label": label, "event": event} for label, event in zip(labels, events, strict=True)]})
    bundle = {"schema": "logos-engine.v7.reference.v1", "provenance": provenance,
        "programs": compiled, "knowledge": {"logos": runtime.logos, "drm": runtime.drm},
        "sources": {name: prepared.read_text(root / V7 / (name + ".src")) for name in programs},
        "scenarios": browser_scenarios}

    scenarios, original_results = [], {}
    for name, events in events_by_case.items():
        runtime = Runtime()
        stages, steps = [], []
        for event, label in zip(events, SCENARIO_METADATA[name][2], strict=True):
            steps.append(capture_step(runtime, {"kind": "advance", "event": event}, label, plain))
            stages.append(summary(runtime.memory))
        scenarios.append({"id": name, "steps": steps})
        original_results[name] = {"memory": runtime.memory, "stages": stages, "receipts": runtime.receipts}
    assessments = assess(original_results)
    if not all(assessments.values()):
        raise AssertionError({"original_demo_failed": assessments})

    activation_assessments = {}
    for mask_kind in ("node", "kind"):
        runtime = Runtime()
        steps = [capture_step(runtime, {"kind": "advance", "event": event}, label, plain)
                 for event, label in zip(events_by_case["discovery"][:3], LABELS[:3], strict=True)]
        hypothesis = next(node for node in runtime.memory["nodes"].values() if node["kind"] == "hypothesis")
        composition = next(node for node in runtime.memory["nodes"].values() if node["kind"] == "composition")
        configuration = {"disabled_kinds": ["hypothesis"] if mask_kind == "kind" else [],
            "disabled_nodes": [hypothesis["id"]] if mask_kind == "node" else [],
            "reason": f"Reference {mask_kind}-mask parity test"}
        steps.append(capture_step(runtime, {"kind": "set_activation", "configuration": configuration},
                                  "Mask hypotheses" if mask_kind == "kind" else "Mask one hypothesis", plain))
        masked = {node["id"]: node for node in steps[-1]["expected"]["availability"]["nodes"]}
        if not masked[composition["id"]]["blockers"]:
            raise AssertionError("The original composition must retain dependency blockers")
        reactivation = {"disabled_kinds": [], "disabled_nodes": [],
                        "reason": f"Reference {mask_kind}-mask reactivation"}
        steps.append(capture_step(runtime, {"kind": "set_activation", "configuration": reactivation},
                                  "Reactivate hypotheses", plain))
        active = {node["id"]: node for node in steps[-1]["expected"]["availability"]["nodes"]}
        if active[composition["id"]]["blockers"]:
            raise AssertionError("Reactivation must clear the use mask")
        activation_assessments[mask_kind + "_mask_blocks_dependency_and_reactivation_clears_it"] = True
        scenarios.append({"id": "activation_" + mask_kind, "steps": steps})

    prepared.verify_workspace()
    report = prepared.report()
    fixture = {"schema": "logos-engine.v7.python-golden.v1", "provenance": provenance,
        "referenceEngine": {"python": platform.python_version(), "pydantic": pydantic.__version__,
            "pathDependentSourceDigest": prepared.digest,
            "preparedSource": {key: report[key] for key in ("schema", "source_digest", "source_files",
                "source_bytes", "runtime_constructions", "invalidated", "loaded_modules", "boundary")}},
        "normalization": NORMALIZATION, "assessments": assessments,
        "activationAssessments": activation_assessments, "scenarios": scenarios}
    validate_raw_histories(fixture, kernel)
    source_bytes = {name: prepared.payloads[str(root / V7 / name)] for name in EXPORTED_SOURCES}
    return bundle, fixture, source_bytes, kernel


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--python-root", type=Path, required=True,
                        help="Local checkout or exact dependency closure of the pinned private repository")
    parser.add_argument("--target-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--check", action="store_true", help="Verify existing exports without changing files")
    args = parser.parse_args()
    target = args.target_root.resolve()
    output = target / "reference" / "v7" / COMMIT
    fixture_path = target / "tests" / "fixtures" / "v7-reference.json"
    manifest_bytes = (output / "python-sources.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    if manifest["repository"] != REPOSITORY or manifest["commit"] != COMMIT:
        raise ValueError("Wrong pinned source manifest")
    with tempfile.TemporaryDirectory(prefix="logos-v7-reference-") as temporary:
        root = Path(temporary).resolve()
        materialize(args.python_root.resolve(), root, manifest)
        prepared = prepare_original_source(root)
        bundle, fixture, sources, kernel = export_reference(root, prepared, manifest, manifest_bytes)
        if args.check:
            previous = json.loads(fixture_path.read_bytes())
            validate_raw_histories(previous, kernel)
            if stable_golden_projection(previous) != stable_golden_projection(fixture):
                raise AssertionError("Normalized Python golden histories changed")
            if (output / "bundle.json").read_bytes() != json_bytes(bundle):
                raise AssertionError("Compiled browser bundle changed")
            for name, data in sources.items():
                if (output / name).read_bytes() != data:
                    raise AssertionError("Pinned source copy changed: " + name)
        else:
            output.mkdir(parents=True, exist_ok=True)
            fixture_path.parent.mkdir(parents=True, exist_ok=True)
            for name, data in sources.items():
                (output / name).write_bytes(data)
            (output / "bundle.json").write_bytes(json_bytes(bundle))
            fixture_path.write_bytes(json_bytes(fixture))
        print(json.dumps({"mode": "checked" if args.check else "exported", "commit": COMMIT,
            "original_demo_assertions": len(fixture["assessments"]),
            "activation_assertions": len(fixture["activationAssessments"]),
            "scenarios": len(fixture["scenarios"]),
            "snapshots": sum(len(case["steps"]) for case in fixture["scenarios"]),
            "original_source_files": len(manifest["files"]),
            "bundle": str(output / "bundle.json"), "fixture": str(fixture_path)}))


if __name__ == "__main__":
    main()
