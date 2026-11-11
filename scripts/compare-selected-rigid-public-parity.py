#!/usr/bin/env python3
"""Cold original SelectedRigid replay over passive public call evidence.

No native plan/state initializes the source. Observations are remeasured by the
original observer. Only a previously generated original proposal is used for
bind, guards and acquisition. Restore arguments are comparands; the source
restores its own independently acquired event state.

The public execution budget is reconstructed from recorded setter arguments
and clock values already consumed by the native owner. The replay clock is
independent elapsed Python time anchored to the first such value, not a fixed
or incremented synthetic clock. Counterfactual ablations get the same observed
entry budget and are reported separately from the chronological baseline.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
import datetime
import gzip
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import traceback
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
STATE_FORMAT = "selected_rigid_events.v1"
NATIVE_SCHEMA = "native.selected_rigid.v1"
OBSERVATION = re.compile(r"(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)")
CALLER_FIELDS = ("strategy_receipt", "morphology", "composition_target_tree")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False, allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def equivalent(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isfinite(a) and math.isfinite(b) and a == b
    if isinstance(a, dict) and isinstance(b, dict):
        return set(a) == set(b) and all(equivalent(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(equivalent(x, y) for x, y in zip(a, b))
    return type(a) is type(b) and a == b


def differences(expected, actual, path="$", limit=12):
    if equivalent(expected, actual):
        return []
    if isinstance(expected, dict) and isinstance(actual, dict):
        result = []
        for key in sorted(set(expected) | set(actual)):
            if key not in expected or key not in actual:
                result.append({"path": path + "." + key,
                    "expectedPresent": key in expected, "actualPresent": key in actual})
            else:
                result += differences(expected[key], actual[key], path + "." + key, limit - len(result))
            if len(result) >= limit:
                break
        return result
    if isinstance(expected, list) and isinstance(actual, list):
        result = []
        if len(expected) != len(actual):
            result.append({"path": path + ".length", "expected": len(expected), "actual": len(actual)})
        for i, (a, b) in enumerate(zip(expected, actual)):
            result += differences(a, b, path + "[" + str(i) + "]", limit - len(result))
            if len(result) >= limit:
                break
        return result
    return [{"path": path, "expected": expected, "actual": actual}]


def source_state(value, envelope=False):
    expected = {"format", "events"} | ({"schema"} if envelope else set())
    require(isinstance(value, dict) and set(value) == expected, "Unexpected source/checkpoint fields")
    require(value["format"] == STATE_FORMAT and isinstance(value["events"], list),
            "Malformed original event state")
    if envelope:
        require(value["schema"] == NATIVE_SCHEMA, "Wrong native checkpoint schema")
    return {"format": STATE_FORMAT, "events": deepcopy(value["events"])}


def public_command(value):
    require(isinstance(value, dict) and set(value) <= {"action_ref", "data"}
            and isinstance(value.get("action_ref"), str), "Malformed public command")
    data = value.get("data", {})
    require(isinstance(data, dict), "Command data must be a JSON object")
    return {"action_ref": value["action_ref"], "data": deepcopy(data)}


def decision(value, stop):
    if stop is not None:
        return {"status": "unknown", "block_unrelated_probe": True, "reason": stop, "actions": []}
    if value is None:
        return {"status": "abstained", "actions": []}
    return {k: deepcopy(value[k]) for k in ("status", "kind", "actions", "reason", "block_unrelated_probe")
            if k in value}


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    require(spec is not None and spec.loader is not None, "Cannot load local verifier " + str(path))
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def read_json(path):
    def unique(pairs):
        out = {}
        for key, value in pairs:
            require(key not in out, "Duplicate JSON key " + key)
            out[key] = value
        return out
    data = Path(path).read_bytes()
    if Path(path).suffix == ".gz":
        data = gzip.decompress(data)
    return json.loads(data, object_pairs_hook=unique,
        parse_constant=lambda value: (_ for _ in ()).throw(ValueError("Invalid JSON number " + value)))


def compare_capture(capture, oracle, exporter, presence, include_ablations=True, require_prefixes=False):
    require(capture.get("referenceCommit") == COMMIT, "Capture is not bound to the immutable original")
    require(capture.get("status") in ("passed", "failed"), "Capture has no completed outcome")
    surface = capture.get("selectedRigidCapture")
    require(isinstance(surface, dict) and surface.get("clockObserverAttached") is True
            and surface.get("unscopedClockReads") == [],
            "Missing passive already-consumed clock surface")
    calls = capture.get("selectedRigidEvents")
    # Structural journal validation is separate from source execution. It is
    # strict about complete calls, permitted nesting, clock reads and null/void.
    roots, captured_snapshots = presence.journal(calls)
    family = oracle.SelectedRigid()
    original_empty = exporter.state(oracle, family)
    require(original_empty == {"format": STATE_FORMAT, "events": []}, "Original owner is not cold")
    report = {
        "schema": "sra.selected-rigid-cold-original-parity.v1", "status": "failed",
        "coldStart": True, "nativeStatesUsedToPrimeSource": False,
        "nativePlansUsedToAcquireSource": False, "gameExecution": False,
        "callChecks": [], "nestedChecks": [], "restorationChecks": [],
        "publicObservationChecks": [], "callerAnnotations": [], "budgetChecks": [],
        "clockChecks": [], "physicalActionChecks": [], "prefixChecks": [],
        "guardCoverage": [], "ablations": [], "differences": [], "stop": None,
        "scope": "One unchanged original SelectedRigid component on recorded public observations and actual execution budgets; not the complete original caller or a new game success.",
        "normalizations": [
            "JSON tuple/list transport only; complete array order and object fields are retained.",
            "The native explicit blocking result is compared to the original internal result plus its actual requested_stop_reason; the original family null is also retained.",
            "Only named top-level common-caller annotations are separated and validated.",
            "Only physical-command binding treats omitted data and the empty object as the same zero-argument command.",
            "Python None from bind/restore and the adapter setter corresponds to explicitly captured native undefined; record null remains distinct.",
            "Controlled synthetic clocks are not used for chronological public replay."]}
    counts = Counter()
    offers, observed, reference_values = {}, {}, {}
    records, before_guards, after_guards, restore_events = [], [], [], []
    snapshots = {0: deepcopy(original_empty)}
    contexts = {}
    context_budget = {"levelDeadlineMs": None, "remainingLevelActions": None, "observedNowMs": None}
    selected_record_keys = set()

    def check(expected, actual, where):
        found = differences(expected, actual, where)
        report["differences"].extend(found)
        return len(found)

    def expected_context():
        return {"configuration": deepcopy(oracle.configuration),
                "requestedStopReason": family.requested_stop_reason, **deepcopy(context_budget)}

    def check_context(value, where):
        return check(expected_context(), value, where)

    def observe(value, rows, index, side, public=None):
        require(isinstance(value, dict), "Missing public observation")
        require(all(type(value.get(k)) is int and value[k] >= 0
                    for k in ("revision", "level_epoch", "levels_completed")),
                "Invalid public observation counters")
        match = OBSERVATION.fullmatch(value.get("observation_ref", ""))
        require(match is not None, "Malformed public observation reference")
        raster_hash = hashlib.sha256(json.dumps(rows, separators=(",", ":"), allow_nan=False).encode()).hexdigest()[:16]
        packet = {"frame_rows": deepcopy(rows), "level": value["level_epoch"],
            "levels_completed": value["levels_completed"], "state": value["state"],
            "available_action_refs": deepcopy(value["available_action_refs"]), "frame_hash": raster_hash}
        if public is not None:
            for key, expected in packet.items():
                check(expected, public.get(key), "events[" + str(index) + "]." + side + ".packet." + key)
        measured = oracle.plain(oracle.measure(SimpleNamespace(**packet), value["revision"], match[1])[0])
        key = (value["observation_ref"], digest(rows), digest(value))
        if key not in observed:
            mismatch = check(measured, value, "events[" + str(index) + "]." + side + ".originalObservation")
            if value["observation_ref"] in reference_values:
                check(reference_values[value["observation_ref"]], {"rows": rows, "observation": value},
                      "events[" + str(index) + "]." + side + ".sameReference")
            reference_values[value["observation_ref"]] = {"rows": deepcopy(rows), "observation": deepcopy(value)}
            observed[key] = measured
            report["publicObservationChecks"].append({
                "firstEvent": index, "side": side, "reference": value["observation_ref"],
                "rowsDigest": digest(rows), "originalDigest": digest(measured), "differences": mismatch})
        return deepcopy(measured)

    def proposal_core(native, where):
        require(isinstance(native, dict), "Selected call needs an actual proposal")
        core = deepcopy(native)
        for key in CALLER_FIELDS:
            if key not in core:
                continue
            annotation = core.pop(key)
            require(isinstance(annotation, dict), "Malformed caller annotation " + key)
            if key == "strategy_receipt":
                require(annotation.get("selected") == "goal_access"
                        and annotation.get("workflow") == "v6.composition_strategy.choose",
                        "Foreign common selection receipt")
            elif key == "composition_target_tree":
                binding, bundle = core.get("binding", {}), core.get("bundle_template", {})
                require(annotation.get("admitted") is True
                        and annotation.get("observation_ref") == binding.get("observation_ref")
                        and annotation.get("level_epoch") == binding.get("level_epoch")
                        and annotation.get("root") == bundle.get("objective_ref")
                        and isinstance(annotation.get("path"), list)
                        and len(annotation["path"]) >= 2
                        and annotation["path"][0] == annotation["root"]
                        and annotation["path"][-1] == bundle.get("composition_ref"),
                        "Unbound common composition target tree")
            report["callerAnnotations"].append({"path": where + "." + key, "value": annotation,
                                                "origin": "Common caller, outside SelectedRigid"})
        return core

    def own_proposal(native, where):
        core = proposal_core(native, where)
        require(core.get("kind") == "selected_rigid" and core.get("proposal_id") in offers,
                "No earlier independently generated original proposal owns this call")
        entry = offers[core["proposal_id"]]
        check(entry["snapshot"], core, where + ".completeIndependentProposal")
        return entry["proposal"], entry

    def apply_setter(event, index, nested=False):
        where = "events[" + str(index) + "]"
        check(exporter.state(oracle, family), source_state(event["sourceBefore"]), where + ".sourceBefore")
        check_context(event["contextBefore"], where + ".contextBefore")
        descriptor, remaining = event["arguments"]
        context_budget["levelDeadlineMs"] = None if descriptor is None else descriptor["deadlineMs"]
        context_budget["remainingLevelActions"] = remaining
        context_budget["observedNowMs"] = None
        family.level_deadline = None if context_budget["levelDeadlineMs"] is None else context_budget["levelDeadlineMs"] / 1000
        family.remaining_level_actions = remaining
        check_context(event["contextAfter"], where + ".contextAfter")
        check(exporter.state(oracle, family), source_state(event["sourceAfter"]), where + ".sourceAfter")
        check("undefined", event["resultKind"], where + ".resultKind")
        check(None, event["result"], where + ".result")
        counts["setCurrentBudget"] += 1
        report["budgetChecks"].append({"event": index, "nested": nested, "execution": descriptor,
            "remainingLevelActions": remaining, "stateOrigin": "Recorded public execution arguments, never retained native knowledge"})

    def elapsed_clock(event, index):
        reads = event["clockReads"]
        require(isinstance(reads, list) and all(type(v) in (int, float) and math.isfinite(v) for v in reads),
                "Missing finite already-consumed clock reads")
        if not reads:
            def unavailable():
                raise ValueError("Original needed an unobserved clock read at event " + str(index))
            return unavailable, lambda: {"sourceReads": 0, "elapsedSeconds": 0.0}
        anchor = reads[0] / 1000
        started = None
        source_reads = 0
        def current():
            nonlocal source_reads, started
            source_reads += 1
            current_time = time.perf_counter()
            if started is None:
                started = current_time
            return anchor + current_time - started
        def summary():
            return {"sourceReads": source_reads,
                    "elapsedSeconds": 0.0 if started is None else time.perf_counter() - started}
        return current, summary

    def original_propose(owner, args, clock):
        internal = {"called": False, "result": None}
        engine = owner.engine
        actual = engine.propose_graph
        def recorded(*values, **keywords):
            internal["called"] = True
            result = actual(*values, **keywords)
            internal["result"] = deepcopy(oracle.plain(result))
            return result
        engine.propose_graph = recorded
        try:
            with exporter.source_clock(oracle, clock):
                result = owner.propose(*deepcopy(args), deepcopy(oracle.configuration))
            return oracle.plain(result), internal
        finally:
            del engine.propose_graph

    def ablations(event, index, before, args, baseline, baseline_stop):
        if not include_ablations:
            return
        if not before["events"] and baseline is None:
            return
        variants = []
        empty = {"format": STATE_FORMAT, "events": []}
        variants.append(("all-events-cleared", empty))
        if before["events"]:
            without_last = deepcopy(before)
            without_last["events"] = without_last["events"][:-1]
            variants.append(("last-event-removed", without_last))
            for label, field, value in (
                    ("selection-hypothesis-cleared", "active", None),
                    ("trials-cleared", "tried", []),
                    ("evidence-refs-cleared", "evidence", [])):
                changed = deepcopy(before)
                changed["events"][-1]["state"][field] = value
                variants.append((label, changed))
            changed = deepcopy(before)
            changed["events"][-1]["models"] = deepcopy(before["events"][0]["models"])
            variants.append(("controls-reset-to-first-source-acquired-hypotheses", changed))
            unchanged_latest = deepcopy(before)
            if len(before["events"]) > 1:
                unchanged_latest["events"] = unchanged_latest["events"][1:]
            variants.append(("oldest-event-removed-latest-snapshot-kept", unchanged_latest))
        for label, changed in variants:
            branch = oracle.SelectedRigid()
            branch.restore(deepcopy(changed))
            branch.level_deadline = family.level_deadline
            branch.remaining_level_actions = family.remaining_level_actions
            clock, clock_summary = elapsed_clock(event, index)
            outcome = error = None
            try:
                outcome, _ = original_propose(branch, args, clock)
            except Exception as caught:
                error = {"type": type(caught).__name__, "message": str(caught)}
            applied = not equivalent(before, changed)
            report["ablations"].append({
                "event": index, "intervention": label,
                "sourceStateOrigin": "This cold independently acquired original event history",
                "nativeStateUsed": False, "nativePlanUsed": False,
                "sourceStateChanged": applied, "emptyIntervention": not applied,
                "baselineStateDigest": digest(before), "intervenedStateDigest": digest(changed),
                "entryBudget": {"levelDeadlineMs": context_budget["levelDeadlineMs"],
                    "remainingLevelActions": context_budget["remainingLevelActions"],
                    "observedEntryMs": event["clockReads"][0] if event["clockReads"] else None},
                "clock": clock_summary(),
                "originalDecision": decision(baseline, baseline_stop),
                "ablatedDecision": decision(outcome, branch.requested_stop_reason),
                "actionOrRefusalChanged": not equivalent(decision(baseline, baseline_stop),
                                                         decision(outcome, branch.requested_stop_reason)),
                "fullProposalChanged": not equivalent(baseline, outcome), "proposal": outcome, "error": error})

    for root in roots:
        index, end, event = root["start"], root["end"], root["event"]
        where = "events[" + str(index) + "]"
        try:
            before = exporter.state(oracle, family)
            before_derived = exporter.derived(oracle, family)
            before_differences = check(before, source_state(event["sourceBefore"]), where + ".sourceBefore")
            check_context(event["contextBefore"], where + ".contextBefore")
            method = event["method"]
            args = deepcopy(event["arguments"])
            original_result = returned = None
            offer = None
            baseline_clock_summary = None
            clock, clock_summary = elapsed_clock(event, index)
            if method == "setCurrentBudget":
                apply_setter(event, index)
            elif method in ("restoreNative", "restoreSourceState"):
                received = source_state(args[0], method == "restoreNative")
                mismatch = check(before, received, where + ".receivedState")
                family.restore(deepcopy(family.state()))
                check("undefined", event["resultKind"], where + ".resultKind")
                check_context(event["contextAfter"], where + ".contextAfter")
                restore_events.append(index)
                counts["actualRestores"] += 1
                counts["nativeRestores" if method == "restoreNative" else "sourceRestores"] += 1
                report["restorationChecks"].append({"event": index, "method": method,
                    "receivedDifferences": mismatch, "nativeStateSeed": False,
                    "restoredSourceStateOrigin": "Copy of this original owner's independently acquired state"})
            elif method == "propose":
                # The native adapter clears this original ephemeral field before
                # an optional nested setter. No learned state is initialized.
                family.requested_stop_reason = None
                children = calls[index + 1:end]
                require(all(child["method"] == "setCurrentBudget" for child in children),
                        "Unexpected proposal child")
                for child in children:
                    apply_setter(child, child["sequence"], nested=True)
                    report["nestedChecks"].append({"event": child["sequence"], "parent": index,
                        "method": "setCurrentBudget", "sourceStateOrigin": "Read-only adapter execution budget"})
                if event.get("execution") is not None:
                    require(len(children) == 1, "Supplied execution has no unique actual nested setter")
                obs, rows, inputs, remaining = args
                measured = observe(obs, rows, index, "current")
                measured_inputs = oracle.plain(oracle.ObservedInputDomain(oracle.point_limit).candidates(measured))
                check(measured_inputs, inputs, where + ".originalInputDomain")
                source_args = [measured, rows, measured_inputs, remaining]
                original_result, internal = original_propose(family, source_args, clock)
                baseline_clock_summary = clock_summary()
                returned = internal["result"] if family.requested_stop_reason is not None else original_result
                if family.requested_stop_reason is not None:
                    require(original_result is None and internal["called"],
                            "Original blocking adapter contract changed")
                    counts["blocked"] += 1
                elif original_result is None:
                    counts["abstained"] += 1
                else:
                    require(original_result.get("status") == "proposed", "Unexpected original family status")
                    offers[original_result["proposal_id"]] = {
                        "event": index, "proposal": deepcopy(original_result),
                        "snapshot": deepcopy(original_result), "observationRevision": measured["revision"]}
                    counts["proposed"] += 1
                check("null" if returned is None else "value", event["resultKind"], where + ".resultKind")
                ablations(event, index, before, source_args, original_result, family.requested_stop_reason)
            elif method == "bind":
                own, offer = own_proposal(args[0], where + ".arguments[0]")
                family.bind(own, None)
                check("undefined", event["resultKind"], where + ".resultKind")
            elif method == "before":
                native, action_index, public, obs = args
                own, offer = own_proposal(native, where + ".arguments[0]")
                for child in calls[index + 1:end]:
                    require(child["method"] == "bind", "Unexpected guard child")
                    child_where = "events[" + str(child["sequence"]) + "]"
                    child_own, _ = own_proposal(child["arguments"][0], child_where + ".arguments[0]")
                    check(before, source_state(child["sourceBefore"]), child_where + ".sourceBefore")
                    check_context(child["contextBefore"], child_where + ".contextBefore")
                    family.bind(child_own, None)
                    check(None, child["result"], child_where + ".result")
                    check("undefined", child["resultKind"], child_where + ".resultKind")
                    check(before, source_state(child["sourceAfter"]), child_where + ".sourceAfter")
                    check_context(child["contextAfter"], child_where + ".contextAfter")
                    report["nestedChecks"].append({"event": child["sequence"], "parent": index,
                        "method": "bind", "sourceProposalEvent": offer["event"]})
                    counts["bind"] += 1
                measured = observe(obs, public["frame_rows"], index, "beforeGuard", public)
                with exporter.source_clock(oracle, clock):
                    returned = oracle.plain(family.before(own, action_index,
                        SimpleNamespace(**public), measured))
                before_guards.append({"event": index, "proposalEvent": offer["event"],
                    "actionIndex": action_index, "before": measured["observation_ref"],
                    "command": public_command(own["actions"][action_index]), "result": returned})
            elif method == "after":
                native, action_index, obs1, obs2, rows, later = args
                own, offer = own_proposal(native, where + ".arguments[0]")
                first = observe(obs1, rows, index, "before")
                second = observe(obs2, later, index, "after")
                returned = oracle.plain(family.after(own, action_index, first, second, rows, later))
                after_guards.append({"event": index, "proposalEvent": offer["event"],
                    "actionIndex": action_index, "before": first["observation_ref"], "after": second["observation_ref"],
                    "command": public_command(own["actions"][action_index]), "result": returned})
            elif method == "record":
                require(len(args) == 8, "Actual record must retain the optional frame packet explicitly")
                obs1, obs2, command, rows, later, native, action_index, frames = args
                own, offer = own_proposal(native, where + ".arguments[5]")
                check(public_command(own["actions"][action_index]), public_command(command),
                      where + ".actualSelectedCommand")
                first = observe(obs1, rows, index, "before")
                second = observe(obs2, later, index, "after")
                record_key = (first["observation_ref"], second["observation_ref"], digest(public_command(command)))
                require(record_key not in selected_record_keys, "Duplicate selected acquisition")
                selected_record_keys.add(record_key)
                returned = oracle.plain(family.record(first, second, command, rows, later, own, action_index, frames))
                check("null" if returned is None else "value", event["resultKind"], where + ".resultKind")
                records.append({"event": index, "proposalEvent": offer["event"], "actionIndex": action_index,
                    "decisionRevision": offer["observationRevision"],
                    "beforeObservation": first, "afterObservation": second, "command": public_command(command),
                    "sourceRecord": deepcopy(returned), "afterRows": later, "frames": frames})
                after_derived = exporter.derived(oracle, family)
                counts["selectedRecords"] += 1
                counts["nullSelectedReturns"] += returned is None
                counts["acquiredSourceEvents"] += 0 if returned is None else len(returned["events"])
                counts["modelChangingRecords"] += not equivalent(before_derived["state"], after_derived["state"])
                counts["controlChangingRecords"] += not equivalent(before_derived["models"], after_derived["models"])
                counts["epochBoundaryReturns"] += first["level_epoch"] != second["level_epoch"]
                counts["scoreOnlyBoundaryReturns"] += (first["level_epoch"] == second["level_epoch"]
                                                      and first["levels_completed"] != second["levels_completed"])
            else:
                raise ValueError("Unexpected source method " + str(method))
            if method != "setCurrentBudget":
                counts[method] += 1
            if event["clockReads"]:
                context_budget["observedNowMs"] = event["clockReads"][-1]
            check_context(event["contextAfter"], where + ".contextAfter")
            clock_evidence = baseline_clock_summary if baseline_clock_summary is not None else clock_summary()
            if event["clockReads"]:
                report["clockChecks"].append({
                    "event": index, "mode": "independent-elapsed-source-clock",
                    "nativeReadsAlreadyConsumed": len(event["clockReads"]),
                    "nativeFirstMs": event["clockReads"][0], "nativeLastMs": event["clockReads"][-1],
                    "levelDeadlineMs": context_budget["levelDeadlineMs"],
                    "remainingAtObservedEntryMs": None if context_budget["levelDeadlineMs"] is None
                        else context_budget["levelDeadlineMs"] - event["clockReads"][0],
                    **clock_evidence})
            mismatch = check(returned, event["result"], where + ".result")
            after = exporter.state(oracle, family)
            after_differences = check(after, source_state(event["sourceAfter"]), where + ".sourceAfter")
            report["callChecks"].append({
                "event": index, "endCursor": end, "method": method,
                "sourceProposalEvent": None if offer is None else offer["event"],
                "sourceBeforeDigest": digest(before), "sourceAfterDigest": digest(after),
                "sourceResult": deepcopy(returned), "originalFamilyResult": original_result,
                "beforeDifferences": before_differences, "returnDifferences": mismatch,
                "afterDifferences": after_differences})
            snapshots[end] = deepcopy(after)
            contexts[end] = expected_context()
        except Exception as error:
            report["stop"] = {"event": index, "type": type(error).__name__, "message": str(error)}
            break

    for record in records:
        before = [g for g in before_guards if g["event"] < record["event"]
            and g["proposalEvent"] == record["proposalEvent"] and g["actionIndex"] == record["actionIndex"]
            and g["before"] == record["beforeObservation"]["observation_ref"] and g["command"] == record["command"]]
        after = [g for g in after_guards if g["event"] < record["event"]
            and g["proposalEvent"] == record["proposalEvent"] and g["actionIndex"] == record["actionIndex"]
            and g["before"] == record["beforeObservation"]["observation_ref"]
            and g["after"] == record["afterObservation"]["observation_ref"] and g["command"] == record["command"]]
        admitted = [g for g in before if g["result"].get("admitted") is True]
        passed = bool(admitted) and len(after) == 1 and max(g["event"] for g in admitted) < after[0]["event"]
        check(True, passed, "events[" + str(record["event"]) + "].actualGuardCoverage")
        report["guardCoverage"].append({"recordEvent": record["event"], "beforeEvents": [g["event"] for g in before],
            "afterEvents": [g["event"] for g in after], "passed": passed})

    actions = capture.get("actions")
    require(isinstance(actions, list), "Missing actual physical action inventory")
    check(list(range(1, len(actions) + 1)), [a.get("sequence") for a in actions], "physicalActions.completeOrder")
    selected = [a for a in actions if a.get("family") == "selected_rigid"]
    check(len(records), len(selected), "physicalActions.exactSelectedRecordCount")
    for ordinal, record in enumerate(records):
        actual = selected[ordinal] if ordinal < len(selected) else None
        start = len(report["differences"])
        if actual is None:
            check(True, False, "events[" + str(record["event"]) + "].physicalReturn")
        else:
            before, after = record["beforeObservation"], record["afterObservation"]
            expected = {"command": record["command"], "levelBefore": before["level_epoch"],
                "completedBefore": before["levels_completed"], "levelAfter": after["level_epoch"],
                "completedAfter": after["levels_completed"], "state": after["state"],
                "frameHash": after["frame_hash"], "actionIndex": record["actionIndex"],
                "decisionRevision": record["decisionRevision"]}
            for key, value in expected.items():
                check(value, public_command(actual[key]) if key == "command" else actual.get(key),
                      "physicalActions[" + str(actual["sequence"]) + "]." + key)
            frames = record["frames"]
            require(isinstance(frames, list) and frames, "Missing actual public animation frame packet")
            check(len(frames), actual.get("animationFrames"), "physicalAction.animationFrames")
            public = {"frame_rows": record["afterRows"], "frame_packet": frames, "level": after["level_epoch"],
                "levels_completed": after["levels_completed"], "state": after["state"], "step_index": actual["sequence"],
                "available_action_refs": after["available_action_refs"], "frame_hash": after["frame_hash"]}
            packet_hash = hashlib.sha256(json.dumps(public, separators=(",", ":"), ensure_ascii=False,
                                                    allow_nan=False).encode()).hexdigest()
            check(packet_hash, actual.get("publicPacketSha256"), "physicalAction.fullPublicPacketHash")
        report["physicalActionChecks"].append({"recordEvent": record["event"],
            "sequence": None if actual is None else actual["sequence"],
            "differences": len(report["differences"]) - start})

    prefixes = capture.get("prefixes")
    require(isinstance(prefixes, list), "Missing sealed prefix inventory")
    if require_prefixes:
        require(prefixes and any(p.get("selectedRigid", {}).get("proposal") is not None for p in prefixes),
                "No actually selected SelectedRigid prefix")
    previous = 0
    covered_records = set()
    for index, prefix in enumerate(prefixes):
        try:
            checkpoint = prefix.get("selectedRigid")
            require(isinstance(checkpoint, dict) and checkpoint.get("stateNode") == "family_state:selected_rigid",
                    "Prefix has no actual selected-rigid owner")
            through = checkpoint.get("eventsThrough")
            require(type(through) is int and previous <= through <= len(calls) and through in snapshots,
                    "Prefix cursor is not a complete source root boundary")
            start = len(report["differences"])
            own_state = snapshots[through]
            check(own_state, source_state(checkpoint.get("state"), True), "prefixes[" + str(index) + "].checkpoint")
            check(own_state, source_state(checkpoint.get("instanceSourceState")), "prefixes[" + str(index) + "].instance")
            check(contexts[through], checkpoint.get("instanceContext"), "prefixes[" + str(index) + "].context")
            acquired = [r for r in records if previous <= r["event"] < through]
            covered_records.update(r["event"] for r in acquired)
            restored = [n for n in restore_events if previous <= n < through]
            is_selected = checkpoint.get("proposal") is not None
            if is_selected:
                require(prefix.get("family") == "selected_rigid" and prefix.get("selectionGroup") == "goal_access"
                        and prefix.get("proposalKind") == "selected_rigid", "Wrong selected owner")
                own, offer = own_proposal(checkpoint["proposal"], "prefixes[" + str(index) + "].proposal")
                require(acquired and len(acquired) == prefix.get("acquiredActions")
                        and all(r["proposalEvent"] == offer["event"] for r in acquired),
                        "Selected prefix does not own all its physical acquisitions")
                check(list(range(len(acquired))), [r["actionIndex"] for r in acquired],
                      "prefixes[" + str(index) + "].orderedAcquisition")
                require(restored and max(restored) > max(r["event"] for r in acquired),
                        "No actual checkpoint restore after selected return")
            else:
                require(not acquired, "Foreign prefix acquired SelectedRigid passively")
            expected_facts = [{"key": "selected_rigid_event:" + str(r["beforeObservation"]["revision"]),
                "evidence": r["afterObservation"]["observation_ref"],
                "revision": r["afterObservation"]["revision"], "result": r["sourceRecord"]} for r in acquired]
            check(expected_facts, checkpoint.get("acquired"), "prefixes[" + str(index) + "].acquiredFactsIncludingNull")
            fact = checkpoint.get("retainedSourceFact")
            if own_state["events"]:
                require(isinstance(fact, dict) and fact.get("key") == "selected_rigid_state",
                        "Missing retained source-event state fact")
                check(own_state, fact.get("value"), "prefixes[" + str(index) + "].retainedOwnSourceState")
                require(restored, "Retained source state has no actual restore on this prefix")
            else:
                check(None, fact, "prefixes[" + str(index) + "].coldOwnerHasNoAcquiredFact")
            report["prefixChecks"].append({"prefix": index, "eventsThrough": through, "selected": is_selected,
                "recordEvents": [r["event"] for r in acquired], "restoreEvents": restored,
                "differences": len(report["differences"]) - start,
                "passed": len(report["differences"]) == start})
            previous = through
        except Exception as error:
            report["prefixChecks"].append({"prefix": index, "passed": False,
                "error": {"type": type(error).__name__, "message": str(error)}})
    if prefixes:
        check(sorted(r["event"] for r in records), sorted(covered_records), "prefixes.exhaustiveSourceRecords")
        check(len(calls), previous, "prefixes.exhaustiveJournalCursor")
    if capture.get("schema") == "logos-engine.v6.recorded-public-regression.v1":
        report["independentPresenceValidation"] = presence.verify_report(capture, "cold-source-reader")
        check("passed", report["independentPresenceValidation"]["status"], "independentPresenceValidation.status")
    report["counts"] = dict(counts)
    report["counts"].update({
        "chronologicalEvents": len(calls), "comparedRootEvents": len(report["callChecks"]),
        "comparedEvents": len(report["callChecks"]) + len(report["nestedChecks"]),
        "uniqueObservations": len(report["publicObservationChecks"]),
        "selectedPrefixes": sum(row.get("selected") is True for row in report["prefixChecks"]),
        "foreignPrefixes": sum(row.get("selected") is False for row in report["prefixChecks"]),
        "ablations": len(report["ablations"]),
        "actionChangingAblations": sum(row["actionOrRefusalChanged"] for row in report["ablations"]),
        "nonemptyAblations": sum(row["sourceStateChanged"] for row in report["ablations"]),
        "ablationErrors": sum(row["error"] is not None for row in report["ablations"])})
    report["finalSourceState"] = exporter.state(oracle, family)
    report["finalRetainedDigest"] = exporter.retained(oracle, family)
    report["status"] = "passed" if (report["stop"] is None and not report["differences"]
        and report["counts"]["comparedEvents"] == len(calls)
        and all(row["passed"] for row in report["prefixChecks"])
        and report["counts"]["ablationErrors"] == 0) else "failed"
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--without-ablations", action="store_true")
    parser.add_argument("--require-prefixes", action="store_true")
    args = parser.parse_args()
    require(not args.output.exists() and not args.receipt.exists(), "Retain previous attempts; use fresh output paths")
    require(os.environ.get("PYTHONHASHSEED") == "0", "Run with PYTHONHASHSEED=0")
    exporter_path = args.root / "scripts/export-v6-selected-rigid-reference.py"
    presence_path = args.root / "scripts/verify-selected-rigid-presence.py"
    exporter = load_module(exporter_path, "selected_rigid_original_exporter")
    presence = load_module(presence_path, "selected_rigid_presence_qualification")
    start = time.monotonic()
    receipt = {
        "schema": "sra.selected-rigid-cold-original-execution.v1", "status": "failed",
        "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "command": sys.argv, "gameExecution": False, "nativeExecution": False,
        "nativeStateSeed": False, "nativePlanSeed": False,
        "input": {"path": str(args.report), **exporter.fingerprint(args.report)},
        "reader": {"path": str(Path(__file__)), **exporter.fingerprint(Path(__file__))},
        "exporter": {"path": str(exporter_path), **exporter.fingerprint(exporter_path)},
        "presenceVerifier": {"path": str(presence_path), **exporter.fingerprint(presence_path)}}
    oracle = None
    try:
        oracle = exporter.load_original(args.root)
        receipt["sourceBefore"] = oracle.sourceBefore
        result = compare_capture(read_json(args.report), oracle, exporter, presence,
                                 not args.without_ablations, args.require_prefixes)
        receipt["output"] = exporter.write_exclusive(args.output, result)
        receipt.update(status=result["status"], counts=result["counts"],
                       differences=len(result["differences"]), stop=result["stop"])
    except Exception as error:
        receipt["error"] = {"type": type(error).__name__, "message": str(error),
                            "traceback": traceback.format_exc()}
    finally:
        if oracle is not None:
            try:
                receipt["sourceAfter"] = exporter.verify_original(args.root)
                require(receipt["sourceAfter"] == oracle.sourceBefore, "Original source changed during replay")
            except Exception as error:
                receipt["status"] = "failed"
                receipt["integrityError"] = {"type": type(error).__name__, "message": str(error)}
        if exporter.fingerprint(args.report) != {k: receipt["input"][k] for k in ("bytes", "sha256")}:
            receipt["status"] = "failed"
            receipt["inputChanged"] = True
        receipt.update(elapsedSeconds=time.monotonic() - start,
            finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            exitCode=0 if receipt["status"] == "passed" else 1)
        exporter.write_exclusive(args.receipt, receipt)
        print(json.dumps(receipt, indent=2))
    return receipt["exitCode"]


if __name__ == "__main__":
    raise SystemExit(main())
