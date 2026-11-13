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
EXPORTED_SOURCES = ("generators.src", "activation.src", "experiment.src", "knowledge.logos.json", "knowledge.drm.json")
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
CHOICE_NORMALIZATION = {
    **NORMALIZATION,
    "id": "logos-engine.v7.choice-history.v1",
    "preserved": "All revisions, kinds, statuses, values, evidence, relationships, ordered deltas, SRC causes, commands, policy inputs and outcomes. Only implementation provenance and its propagated basis-dependent identities are aliased in expected; python retains all original identities and hashes.",
    "basis_dependent_identities": "Experiment/option identities include graph-chain basis, which includes the path-dependent Python source digest. For repeatable --check only, alias every node identity by its first delta occurrence and every graph-chain digest by delta sequence. Raw Python snapshots retain every original byte-valued identifier and hash.",
    "ordered_views": "After identity aliasing, sort availability.nodes and receipt.options by aliased id; their original order is a hash-key view, not the policy ranking. Delta order, commands, ranking inputs and all retained knowledge remain unchanged.",
    "exact_replay": "The TypeScript choice test separately injects the raw fixture source_digest as a controlled input to compare complete raw graph histories and identifiers. Production uses its own TypeScript manifest digest.",
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
    elif operation["kind"] == "choose":
        from agents.yf_arc3_v7.kernel import empty_argument_bindings
        observation = operation["observation"]
        bindings = empty_argument_bindings(observation["actions"], runtime.drm["public_interface"]["actions"])
        receipt = runtime.choose(observation, bindings, policy_ref=operation["policy_ref"])
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


def normalize_choice_snapshot(raw):
    memory = raw["memory"]
    identities = {}
    chains = {}
    for delta in memory["deltas"]:
        identity = delta["node"]["id"]
        if identity not in identities:
            identities[identity] = f"node@{len(identities) + 1:04d}"
        chains[delta["digest"]] = f"chain@{delta['sequence']:04d}"
    def alias(value):
        if isinstance(value, str):
            return identities.get(value, chains.get(value, value))
        if isinstance(value, list):
            return [alias(item) for item in value]
        if isinstance(value, dict):
            return {identities.get(key, key): alias(item) for key, item in value.items()}
        return value
    receipt = normalize_receipt(raw["receipt"])
    if "decision" in receipt:
        if receipt["decision"] is not None:
            receipt["decision"]["origin"].pop("source_digest")
        for option in receipt["options"]:
            option["origin"].pop("source_digest")
    result = {"memory": alias(normalize_memory(memory)),
              "availability": alias(normalize_availability(raw["availability"])),
              "receipt": alias(receipt)}
    result["availability"]["nodes"].sort(key=lambda node: node["id"])
    if "options" in result["receipt"]:
        result["receipt"]["options"].sort(key=lambda node: node["id"])
    return result


def validate_raw_histories(fixture, kernel, *, choice=False):
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
            if choice:
                assert normalize_choice_snapshot(step["python"]) == step["expected"]
            else:
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
    from agents.yf_arc3_v7.demo import cases, summary, assess, scenario
    from agents.yf_arc3_v7.runtime import Runtime, plain

    runtime = Runtime()
    programs = {"generators": runtime.module, "activation": runtime.activation_module, "experiment": runtime.experiment_module}
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
                           "activation": str(runtime.activation_entry.transitive_source_hash),
                           "experiment": str(runtime.experiment_entry.transitive_source_hash)},
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

    choice_scenarios = []
    choice_assessments = {}
    def choice_case(name, operations):
        instance = Runtime()
        steps = []
        for label, operation in operations:
            step = capture_step(instance, operation, label, plain)
            step["expected"] = normalize_choice_snapshot(step["python"])
            steps.append(step)
        choice_scenarios.append({"id": name, "steps": steps})
        return steps
    def choose(observation):
        return {"kind": "choose", "observation": observation, "policy_ref": "native_context_curiosity"}
    def advance(event):
        return {"kind": "advance", "event": event}
    native_events = scenario("controlled:native-choice", actions=("ACTION1", "ACTION2", "ACTION6", "ACTION7"))[:3]
    returning = {"before": native_events[2]["after"],
                 "after": {**native_events[1]["after"], "id": "controlled:native-choice:return"}, "action": "ACTION1"}
    native_steps = []
    for index, event in enumerate([*native_events, returning]):
        native_steps.extend([(f"Observe {index}", advance(event)), (f"Choose {index}", choose(event["after"]))])
    native = choice_case("native_context_curiosity", native_steps)
    choices = [step["python"]["receipt"] for step in native if step["operation"]["kind"] == "choose"]
    choice_assessments["context_then_scope_trials_choose_original_policy"] = [receipt["decision"]["action"] for receipt in choices] == ["ACTION1", "ACTION2", "ACTION1", "ACTION1"]
    choice_assessments["arguments_and_authority_remain_deferred"] = all(
        {node["action"]: node["grounding"] for node in receipt["options"] if node["status"] == "deferred"}
        == {"ACTION6": "missing_arguments:x,y", "ACTION7": "authority_missing:recovery"} for receipt in choices)
    deferred = scenario("controlled:deferred-choice", actions=("ACTION0", "ACTION6", "ACTION7"))[0]
    deferred_steps = choice_case("deferred_only", [("Observe unsupported inputs", advance(deferred)), ("Keep unsupported inputs deferred", choose(deferred["after"]))])
    choice_assessments["unsupported_actions_never_create_a_decision"] = deferred_steps[-1]["python"]["receipt"]["decision"] is None
    enabled = scenario("controlled:masked-choice", actions=("ACTION1", "ACTION2"))[0]
    masked_steps = choice_case("question_mask", [
        ("Observe two grounded inputs", advance(enabled)), ("Choose while available", choose(enabled["after"])),
        ("Mask questions", {"kind": "set_activation", "configuration": {"disabled_kinds": ["question"], "disabled_nodes": [], "reason": "Reference choice mask"}}),
        ("No choice from masked questions", choose(enabled["after"])),
        ("Restore questions", {"kind": "set_activation", "configuration": {"disabled_kinds": [], "disabled_nodes": [], "reason": "Reference choice restoration"}}),
        ("Choose after restoration", choose(enabled["after"])),
    ])
    choice_assessments["masked_questions_block_choices_until_reactivation"] = (
        masked_steps[3]["python"]["receipt"]["decision"] is None and not masked_steps[3]["python"]["receipt"]["options"]
        and masked_steps[-1]["python"]["receipt"]["decision"] is not None)
    empty = scenario("controlled:no-choice")[0]
    empty["after"]["actions"] = []
    no_actions = choice_case("no_actions", [("Observe no actions", advance(empty)), ("Stop without inventing actions", choose(empty["after"]))])
    choice_assessments["empty_vocabulary_has_no_options_or_decision"] = no_actions[-1]["python"]["receipt"]["decision"] is None and not no_actions[-1]["python"]["receipt"]["options"]
    if not all(choice_assessments.values()):
        raise AssertionError({"original_choice_failed": choice_assessments})

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
    choice_fixture = {"schema": "logos-engine.v7.python-choice-golden.v1", "provenance": provenance,
        "referenceEngine": fixture["referenceEngine"], "normalization": CHOICE_NORMALIZATION,
        "assessments": choice_assessments, "activationAssessments": {}, "scenarios": choice_scenarios}
    validate_raw_histories(choice_fixture, kernel, choice=True)
    source_bytes = {name: prepared.payloads[str(root / V7 / name)] for name in EXPORTED_SOURCES}
    return bundle, fixture, choice_fixture, source_bytes, kernel


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
    choice_fixture_path = target / "tests" / "fixtures" / "v7-choice-reference.json"
    manifest_bytes = (output / "python-sources.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    if manifest["repository"] != REPOSITORY or manifest["commit"] != COMMIT:
        raise ValueError("Wrong pinned source manifest")
    with tempfile.TemporaryDirectory(prefix="logos-v7-reference-") as temporary:
        root = Path(temporary).resolve()
        materialize(args.python_root.resolve(), root, manifest)
        prepared = prepare_original_source(root)
        bundle, fixture, choice_fixture, sources, kernel = export_reference(root, prepared, manifest, manifest_bytes)
        if args.check:
            previous = json.loads(fixture_path.read_bytes())
            validate_raw_histories(previous, kernel)
            if stable_golden_projection(previous) != stable_golden_projection(fixture):
                raise AssertionError("Normalized Python golden histories changed")
            previous_choice = json.loads(choice_fixture_path.read_bytes())
            validate_raw_histories(previous_choice, kernel, choice=True)
            if stable_golden_projection(previous_choice) != stable_golden_projection(choice_fixture):
                raise AssertionError("Normalized Python choice histories changed")
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
            choice_fixture_path.write_bytes(json_bytes(choice_fixture))
        print(json.dumps({"mode": "checked" if args.check else "exported", "commit": COMMIT,
            "original_demo_assertions": len(fixture["assessments"]),
            "activation_assertions": len(fixture["activationAssessments"]),
            "scenarios": len(fixture["scenarios"]),
            "snapshots": sum(len(case["steps"]) for case in fixture["scenarios"]),
            "choice_assertions": len(choice_fixture["assessments"]),
            "choice_snapshots": sum(len(case["steps"]) for case in choice_fixture["scenarios"]),
            "original_source_files": len(manifest["files"]),
            "bundle": str(output / "bundle.json"), "fixture": str(fixture_path)}))


if __name__ == "__main__":
    main()
