#!/usr/bin/env python3
"""Compare original and suspended V6 runs, including their real public outcomes.

This is a creator-side verifier. Its expected traces never enter the agent.
The two run directories must share a basename because V6 uses it as the
observation scope. Wall-clock measurements and host transport metadata are
reported separately; decisions, guards, pixels and reasoning remain exact.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
from typing import Any
import zlib


TIMING_FIELDS = frozenset({
    "total_ms", "first_action_ms", "full_set_ms", "elapsed_s",
    "latency_to_first_action", "completed_level_seconds",
    "env_step_before_perf_counter_ns", "env_step_after_perf_counter_ns",
    "emission_level_start_perf_counter_s",
})
PUBLIC_METADATA = frozenset({"backend", "game_id"})
REPORT_PUBLIC_FIELDS = frozenset({
    "level", "levels_completed", "state", "step_index",
    "available_action_refs", "frame_hash",
})
PLAN_FIELDS = (
    "target_levels_completed", "max_actions", "max_bundle_actions",
    "level_action_caps", "level_seconds", "information_goal", "policy_sha",
    "model_loaded", "planner_selected_by_game", "game_id_visible_to_reasoning",
)
JSON_PREFIXES = (
    "observation-", "proposal-", "decision-", "packet-", "boundary-",
    "predictions-before-", "transition-", "ensemble-analysis-",
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf8"))


def read_lines(path: Path) -> list[Any]:
    return [json.loads(line) for line in path.read_text(encoding="utf8").splitlines() if line.strip()]


def canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf8")


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def normalize(value: Any, *, file_name: str, path: tuple[str, ...] = ()) -> Any:
    """Drop only enumerated transport/timing metadata, never semantic fields."""
    if isinstance(value, list):
        return [normalize(item, file_name=file_name, path=(*path, str(index))) for index, item in enumerate(value)]
    if not isinstance(value, dict):
        return value
    result = {}
    for key, item in value.items():
        report_clock = file_name == "report.json" and not path and key in {
            "elapsed_s", "latency_to_first_action", "completed_level_seconds"}
        decision_clock = file_name == "report.json" and len(path) == 2 and path[0] == "decisions" and key in {
            "first_action_ms", "full_set_ms"}
        receipt_clock = file_name.startswith("decision-") and not path and key == "total_ms"
        transport_clock = file_name == "execution.jsonl" and value.get("event") == "observation" and key in {
            "env_step_before_perf_counter_ns", "env_step_after_perf_counter_ns", "emission_level_start_perf_counter_s"}
        if report_clock or decision_clock or receipt_clock or transport_clock:
            continue
        is_report_public = file_name == "report.json" and path in (("initial",), ("final",))
        is_observation_event = file_name == "execution.jsonl" and value.get("event") == "observation"
        if key in PUBLIC_METADATA and (is_report_public or is_observation_event):
            continue
        result[key] = normalize(item, file_name=file_name, path=(*path, str(key)))
    return result


def first_difference(left: Any, right: Any, path: str = "$", *, depth: int = 0) -> dict[str, Any] | None:
    if type(left) is not type(right):
        return {"path": path, "reason": "type", "reference_type": type(left).__name__, "candidate_type": type(right).__name__}
    if isinstance(left, dict):
        if set(left) != set(right):
            return {"path": path, "reason": "keys", "reference_only": sorted(set(left) - set(right)), "candidate_only": sorted(set(right) - set(left))}
        for key in sorted(left):
            found = first_difference(left[key], right[key], f"{path}.{key}", depth=depth + 1)
            if found:
                return found
        return None
    if isinstance(left, list):
        if len(left) != len(right):
            return {"path": path, "reason": "length", "reference_length": len(left), "candidate_length": len(right)}
        for index, (a, b) in enumerate(zip(left, right, strict=True)):
            found = first_difference(a, b, f"{path}[{index}]", depth=depth + 1)
            if found:
                return found
        return None
    if left != right:
        # Output a precise location and bounded values, not full public frames.
        def short(v: Any) -> Any:
            return v if not isinstance(v, str) or len(v) <= 240 else v[:240] + "…"
        return {"path": path, "reason": "value", "reference": short(left), "candidate": short(right)}
    return None


def evidence_chunks(root: Path) -> dict[str, Any]:
    database = root / "evidence-blobs.sqlite3"
    with sqlite3.connect(database.as_uri() + "?mode=ro", uri=True) as connection:
        result = {}
        for expected, size, body in connection.execute("SELECT digest,size,body FROM chunks ORDER BY digest"):
            raw = zlib.decompress(body)
            if len(raw) != size or hashlib.sha256(raw).hexdigest() != expected:
                raise ValueError(f"Damaged symbolic evidence chunk {expected} in {root}")
            result[expected] = json.loads(raw)
        return result


def memory_facts(root: Path) -> list[dict[str, Any]]:
    database = root / "memory.sqlite3"
    with sqlite3.connect(database.as_uri() + "?mode=ro", uri=True) as connection:
        return [{"episode": episode, "key": key, "value": json.loads(value), "evidence": evidence, "revision": revision}
                for episode, key, value, evidence, revision in connection.execute("SELECT episode,k,v,evidence,revision FROM facts ORDER BY episode,k")]


def validate_journal(root: Path, report: dict[str, Any]) -> dict[str, Any]:
    events = read_lines(root / "execution.jsonl")
    pending = None
    guard = None
    counts: Counter[str] = Counter()
    responses = 0
    completions = []
    completed = report["initial"]["levels_completed"]
    for event in events:
        kind = event.get("event")
        key = (event.get("decision_revision"), event.get("action_index"))
        if kind == "path_guard":
            guard = key if event["point_admitted"] and event["result"]["admitted"] else None
        elif kind == "dispatch":
            if pending is not None or key != guard:
                raise ValueError(f"Dispatch without a unique admitted guard in {root}: {key}")
            level = str(event["level"])
            counts[level] += 1
            if event["level_action_ordinal"] != counts[level] or counts[level] > event["level_action_cap"]:
                raise ValueError(f"Primitive accounting differs in {root}: {key}")
            pending = key
            guard = None
        elif kind == "observation":
            if pending != key:
                raise ValueError(f"Observation without its dispatched action in {root}: {key}")
            pending = None
            responses += 1
            score = event["levels_completed"]
            if score != completed:
                if score != completed + 1:
                    raise ValueError(f"Invalid level boundary in {root}: {completed} → {score}")
                completed = score
                completions.append({"level": completed, "after_action": responses})
    if pending is not None or responses != report["actions"] or dict(counts) != report["level_actions"]:
        raise ValueError(f"Final primitive/response accounting differs in {root}")
    if completed != report["final"]["levels_completed"]:
        raise ValueError(f"Final level count differs from witnessed observations in {root}")
    return {"event_count": len(events), "actions": responses, "level_actions": dict(counts), "level_completions": completions}


def validate_public_trace(root: Path, trace: list[dict[str, Any]], report: dict[str, Any]) -> None:
    if len(trace) != report["actions"] + 1 or trace[0].get("event") != "reset" or any(item.get("event") != "step" for item in trace[1:]):
        raise ValueError(f"Public transport trace does not match primitive count in {root}")
    journal = read_lines(root / "execution.jsonl")
    dispatches = [event for event in journal if event.get("event") == "dispatch"]
    observations = [report["initial"], *[event for event in journal if event.get("event") == "observation"]]
    for ordinal, (item, witnessed) in enumerate(zip(trace, observations, strict=True)):
        observation = item["observation"]
        frame = observation["frame"]
        frames = observation["frames"]
        if not frames or any(len(f) != 64 or any(len(row) != 64 or any(type(pixel) is not int or not 0 <= pixel <= 15 for pixel in row) for row in f) for f in [frame, *frames]):
            raise ValueError(f"Invalid public pixel packet in {root}, ordinal {ordinal}")
        public = {
            "level": observation["level"], "levels_completed": observation["levelsCompleted"],
            "state": observation["state"], "step_index": observation["stepIndex"],
            "available_action_refs": [f"ACTION{action}" for action in observation["availableActionIds"]],
            "frame_hash": hashlib.sha256(json.dumps(frame, separators=(",", ":")).encode()).hexdigest()[:16],
        }
        expected = {key: witnessed[key] for key in REPORT_PUBLIC_FIELDS}
        if public != expected:
            raise ValueError(f"Public transport differs from V6 observation in {root}, ordinal {ordinal}: {first_difference(expected, public)}")
        if ordinal:
            dispatch = dispatches[ordinal - 1]
            command = {"actionRef": dispatch["action_ref"], "data": dispatch.get("data", {})}
            if item.get("ordinal") != ordinal or item["command"] != command:
                raise ValueError(f"Public command differs from V6 dispatch in {root}, ordinal {ordinal}")
    if trace[-1]["observation"]["levelsCompleted"] != report["final"]["levels_completed"]:
        raise ValueError(f"Reported success differs from actual public transport in {root}")


def compare_runs(reference: Path, candidate: Path, *, require_levels: int = 1, require_public_trace: bool = False) -> dict[str, Any]:
    reference, candidate = reference.resolve(), candidate.resolve()
    if reference == candidate:
        raise ValueError("Reference and candidate must be different directories")
    if reference.name != candidate.name:
        raise ValueError("Run directories need the same basename: V6 uses out.name as its observation scope")
    if require_levels < 0:
        raise ValueError("A nonnegative minimum level count is required")
    compared = []
    mismatches = []

    def compare(label: str, a: Any, b: Any) -> None:
        difference = first_difference(a, b)
        compared.append({"artifact": label, "reference_sha256": digest(a), "candidate_sha256": digest(b), "equal": difference is None})
        if difference:
            mismatches.append({"artifact": label, **difference})

    reports = [read_json(root / "report.json") for root in (reference, candidate)]
    journals = [validate_journal(root, report) for root, report in zip((reference, candidate), reports, strict=True)]
    plans = [read_json(root / "plan.json") for root in (reference, candidate)]
    compare("plan admission", [{key: plan[key] for key in PLAN_FIELDS if key in plan} for plan in plans][0],
            [{key: plan[key] for key in PLAN_FIELDS if key in plan} for plan in plans][1])
    for root, plan in zip((reference, candidate), plans, strict=True):
        if plan.get("model_loaded") is not False or plan.get("planner_selected_by_game") is not False or plan.get("game_id_visible_to_reasoning") is not False:
            raise ValueError(f"Expected the common code-only public caller in {root}")
    files = [set(path.name for path in root.iterdir() if path.is_file() and path.suffix == ".json" and (path.name == "report.json" or path.name.startswith(JSON_PREFIXES))) for root in (reference, candidate)]
    compare("semantic artifact inventory", sorted(files[0]), sorted(files[1]))
    for name in sorted(files[0] & files[1]):
        compare(name, normalize(read_json(reference / name), file_name=name), normalize(read_json(candidate / name), file_name=name))
    for name in ("execution.jsonl", "frontier-deltas.jsonl"):
        compare(name, normalize(read_lines(reference / name), file_name=name), normalize(read_lines(candidate / name), file_name=name))
    compare("memory facts", memory_facts(reference), memory_facts(candidate))
    compare("immutable evidence chunks", evidence_chunks(reference), evidence_chunks(candidate))
    public_trace = [(root / "public-trace.jsonl").is_file() for root in (reference, candidate)]
    if any(public_trace) and not all(public_trace):
        raise ValueError("Only one run has the creator-side public transport trace")
    if require_public_trace and not all(public_trace):
        raise ValueError("Real public transport traces are required for this comparison")
    if all(public_trace):
        traces = [read_lines(root / "public-trace.jsonl") for root in (reference, candidate)]
        for root, trace, report in zip((reference, candidate), traces, reports, strict=True):
            validate_public_trace(root, trace, report)
        compare("public transport trace", traces[0], traces[1])
    minimum_met = all(report["final"]["levels_completed"] >= require_levels for report in reports)
    return {
        "schema": "v6_original_bridge_comparison_v1",
        "passed": not mismatches and minimum_met,
        "scope": "real_public_transport_and_reasoning_parity" if all(public_trace) else "reasoning_artifact_parity_only",
        "reference": str(reference), "candidate": str(candidate),
        "minimum_levels_required": require_levels, "minimum_met": minimum_met,
        "reference_outcome": {"status": reports[0]["status"], "reason": reports[0]["reason"], **journals[0]},
        "candidate_outcome": {"status": reports[1]["status"], "reason": reports[1]["reason"], **journals[1]},
        "compared_artifacts": compared, "mismatches": mismatches,
        "excluded_measurements": sorted(TIMING_FIELDS),
        "excluded_public_transport_metadata": sorted(PUBLIC_METADATA),
        "limits": ["This comparison does not attest unavailable historical V6 campaign results.",
                   "Budget qualification must be recorded by the runner; matching counts alone do not qualify oracle-derived caps.",
                   "An independent browser run is still needed to qualify Python/WASM and worker transport behavior."],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--require-levels", type=int, default=1)
    parser.add_argument("--require-public-trace", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = compare_runs(args.reference, args.candidate, require_levels=args.require_levels, require_public_trace=args.require_public_trace)
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        with args.output.open("x", encoding="utf8") as stream:
            stream.write(text)
    print(json.dumps({key: result[key] for key in ("passed", "scope", "minimum_met", "reference_outcome", "candidate_outcome", "mismatches")}, ensure_ascii=False))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
