#!/usr/bin/env python3
"""Replay unchanged FacetExamples cold over a completed public campaign.

Usage:
  python3 -B scripts/compare-facet-example-public-parity.py CAMPAIGN.json.gz \
    --output COMPARISON.json.gz

Capture contract (tests/helpers/v6-live-game-campaign.ts):
  facetExampleSourceCalls[{index, method, nativeMethod, selectionEntry,
    arguments, sourceBefore, result|error, sourceAfter}]
  method: propose (4 arguments), before (4), after (6), record (7).
  proposeInSubquestion is the nativeMethod of a canonical propose, with
  selectionEntry=['surface','facet_example']. Record result
  is the actual events[0], not its native adapter envelope.
  facetExampleRestoreCalls[{index, method='restore', arguments=[sourceState],
    sourceCallsBefore, sourceCallsAfter, sourceDepthBefore, sourceDepthAfter,
    sourceBefore, sourceAfter, returnMode, completion, returnedNormally,
    exception, observationErrors}]
  prefixes[].facetExample supplies stateNode, state, sourceCallsThrough,
    restoreCallsThrough, instanceSourceState, nativeRestoration, proposal|null
    and qualification at the actual sealed-prefix boundary.

Only public rasters/metadata/candidates/budgets and actual commands/returns feed
the source. Native states and plans are comparands, never source initialization.
Selected source plans are retained from this independent replay. Only exact
named top-level caller annotations have an explicit comparison scope. Both
source string sets must already have the source's sorted serialization.
Native prefix evidence freezes the selected offer before acquisition. Those
historical proofs are compared to a separately frozen original offer at its
propose return, while the live original object remains in before/after/record.
Later source-owned alias mutations are retained as explicit diagnostics rather
than being mistaken for changes to an earlier immutable offer snapshot.
All five memory interventions are retained, including empty and unchanged ones.
This runs no game, native agent, original common caller or performance campaign.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from copy import deepcopy
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import tempfile
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = ROOT / "reference/v6" / COMMIT / "source"
MANIFEST = SOURCE.parent / "manifest.json"
STATE_FIELDS = {"failed", "events", "method", "epoch", "portable", "compound_methods", "refuted_compounds"}
OWNER = "family_state:facet_examples"
ENTRY = ["surface", "facet_example"]
OBSERVATION = re.compile(r"(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)")
ARITIES = {"propose": 4, "before": 4, "after": 6, "record": 7}
INTERVENTIONS = {"remove_method": "method", "remove_portable": "portable", "remove_compound_methods": "compound_methods",
                 "remove_refuted_compounds": "refuted_compounds", "remove_failed": "failed"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(value):
    return json.loads(json.dumps(value, allow_nan=False, separators=(",", ":")))


def encoded(value):
    return json.dumps(value, allow_nan=False, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def digest(value):
    return sha(encoded(plain(value)))


def path_label(path):
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def fingerprint(path):
    checksum, size = hashlib.sha256(), 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk); size += len(chunk)
    return {"path": path_label(path), "bytes": size, "sha256": checksum.hexdigest()}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON property: " + key)
        result[key] = value
    return result


def invalid_number(value):
    raise ValueError("Non-JSON numeric constant: " + value)


def read_json(path):
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf8") as stream:
        return json.load(stream, object_pairs_hook=unique_object, parse_constant=invalid_number)


def verify_originals():
    manifest = read_json(MANIFEST)
    require(manifest.get("commit") == COMMIT and len(manifest.get("files", {})) == 1786,
            "Expected the pinned commit and exactly 1786 original file records")
    inventory = {}
    for name, expected in manifest["files"].items():
        actual = fingerprint(SOURCE / name)
        require(actual["bytes"] == expected["bytes"] and actual["sha256"] == expected["sha256"],
                "Pinned original bytes changed: " + name)
        inventory[name] = {"bytes": actual["bytes"], "sha256": actual["sha256"]}
    return {"commit": COMMIT, "filesVerified": len(inventory), "inventoryDigest": digest(inventory),
            "manifest": fingerprint(MANIFEST)}


def existing_source_bytecode():
    inventory = [fingerprint(path) for path in sorted(SOURCE.rglob("*.pyc"))]
    return {"files": len(inventory), "inventoryDigest": digest(inventory)}


def differences(source, native, path=""):
    """All JSON properties/order remain exact; numbers compare by numeric value.

    JSON has one number type: original 1.0 and captured 1 are equal values.
    Booleans never compare equal to 0/1. Diagnostic digests preserve each side's
    actual JSON serialization, so numeric spelling alone can change a digest.
    """
    if isinstance(source, dict) and isinstance(native, dict):
        result = []
        for key in sorted(set(source) | set(native)):
            current = f"{path}.{key}" if path else key
            if key not in source or key not in native:
                item = {"path": current, "sourcePresent": key in source, "nativePresent": key in native}
                if key in source: item["source"] = source[key]
                if key in native: item["native"] = native[key]
                result.append(item)
            else:
                result.extend(differences(source[key], native[key], current))
        return result
    if isinstance(source, list) and isinstance(native, list):
        if len(source) == len(native):
            return [item for i, (a, b) in enumerate(zip(source, native))
                    for item in differences(a, b, f"{path}[{i}]")]
    elif isinstance(source, (int, float)) and not isinstance(source, bool) \
            and isinstance(native, (int, float)) and not isinstance(native, bool):
        if math.isfinite(source) and math.isfinite(native) and source == native:
            return []
    elif type(source) is type(native) and source == native:
        return []
    return [{"path": path, "source": source, "native": native}]


def state(value):
    result = plain(value)
    require(isinstance(result, dict) and set(result) == STATE_FIELDS, "Unexpected facet owner fields")
    require(isinstance(result["events"], list) and all(isinstance(item, dict) for item in result["events"]),
            "Facet events must be an array of source event objects")
    for field in ("failed", "refuted_compounds"):
        values = result[field]
        require(isinstance(values, list) and all(isinstance(item, str) and re.fullmatch(r"[0-9a-f]{64}", item) for item in values),
                "Malformed facet identity set: " + field)
        require(len(set(values)) == len(values), "Captured identity set contains duplicate members: " + field)
        require(values == sorted(values), "Captured identity set does not preserve the source sorted serialization: " + field)
    require(result["epoch"] is None or type(result["epoch"]) is int, "Facet epoch must be an integer or null")
    require(all(result[field] is None or isinstance(result[field], dict) for field in ("method", "portable")),
            "Facet methods must be source objects or null")
    require(isinstance(result["compound_methods"], dict), "Facet compound methods must be a source dictionary")
    return result


def action_or_refusal(proposal):
    return {"status": "no_proposal", "actions": []} if proposal is None else {
        "status": proposal.get("status"), "actions": proposal.get("actions", [])}


def decision(proposal):
    result = action_or_refusal(proposal)
    if proposal is not None:
        plan = proposal.get("facet_plan", {})
        projection = plan.get("projection", {})
        offer, compound = projection.get("offer", {}), projection.get("compound")
        result.update(kind=proposal.get("kind"), experiment=offer.get("kind"), point=offer.get("point"),
                      scopeRef=projection.get("scope_ref"), method=plan.get("method"),
                      routeRefs=proposal.get("route_refs", []), compound=compound is not None,
                      compoundPrefix=None if compound is None else compound.get("prefix"),
                      portStatus=None if compound is None else compound.get("port_status"),
                      expectedColoredPixels=None if compound is None else compound.get("expected_colored_pixels"))
    return result


def diagnostic(family):
    """Read transient source diagnostics without treating them as durable state."""
    current = getattr(family, "current", None)
    compound = None if current is None else current.get("compound")
    return {"recognized": current is not None, "compound": compound is not None,
            "scopeRef": None if current is None else current.get("scope_ref"),
            "compoundPrefix": None if compound is None else compound.get("prefix"),
            "cacheEntries": len(family.compound_cache)}


def error_value(error):
    return {"type": type(error).__name__, "message": str(error)}


def compare_campaign(campaign, family_class, measure):
    calls = campaign.get("facetExampleSourceCalls")
    require(isinstance(calls, list) and calls, "No captured FacetExamples source calls")
    require(campaign.get("status") in ("passed", "failed"), "The input campaign is not completed")
    require(campaign.get("referenceCommit") == COMMIT, "Unexpected campaign reference commit")
    prefixes = campaign.get("prefixes")
    require(isinstance(prefixes, list), "Missing sealed-prefix inventory")
    family = family_class()
    initial = state(family.state())
    require(initial == {"failed": [], "events": [], "method": None, "epoch": None,
                        "portable": None, "compound_methods": {}, "refuted_compounds": []},
            "The original facet family is not cold")
    restores = campaign.get("facetExampleRestoreCalls")
    require(isinstance(restores, list), "Missing actual native facet restore capture")
    report = {
        "coldStart": True, "nativeStatesUsedToPrimeSource": False, "nativePlansUsedToAcquireSource": False,
        "initialSourceState": initial, "callChecks": [], "publicObservationChecks": [], "prefixChecks": [],
        "guardCoverage": [], "nextChoiceChecks": [], "restorationChecks": [], "nativeRestorationChecks": [],
        "sourceRestorationReplay": [], "ablations": [],
        "immutableSelectedProposalChecks": [],
        "callerAnnotations": [], "differences": [], "stop": None,
        "normalizations": [{"field": "proposal.program_subquestion", "rule": "Remove only the exact value facet_example supplied by the source entry adapter"},
                           {"field": "selected proposal.strategy_receipt / morphology / composition_target_tree",
                            "rule": "Named top-level caller annotations only; retain their complete values separately; never alter the facet plan or SRC receipt"}],
        "comparisonPolicy": "Complete parsed JSON values, including source SRC receipts; JSON numbers compare numerically without boolean coercion. Digests retain each side's numeric spelling. No recursive extra-property deletion, geometry normalization or tolerance.",
        "capturedNativeFailures": [{"index": row.get("index"), "nativeMethod": row.get("nativeMethod"), "error": row["error"]}
                                   for row in calls if "error" in row],
    }
    counts = Counter()
    observations, observations_by_ref, offers = {}, {}, defaultdict(list)
    records, pending_records, before_guards, after_guards = [], [], [], []
    record_keys, source_scopes = set(), set()
    snapshots = {0: initial}
    needed_snapshots = {item.get("facetExample", {}).get("sourceCallsThrough") for item in prefixes}
    needed_snapshots.update(row.get(key) for row in restores if isinstance(row, dict)
                            for key in ("sourceCallsBefore", "sourceCallsAfter"))

    def compare(left, right, where):
        diff = differences(plain(left), plain(right), where)
        report["differences"].extend(diff)
        return diff

    next_source_restore = 0

    def replay_source_restores(cursor):
        """Mirror observed restore timing using only this original owner's state.

        Restoring the same fields also breaks source-owned durable aliases in
        the same place as the real caller. Native arguments remain comparands.
        """
        nonlocal next_source_restore
        while next_source_restore < len(restores):
            captured = restores[next_source_restore]
            require(isinstance(captured, dict) and type(captured.get("sourceCallsBefore")) is int
                    and captured["sourceCallsBefore"] >= cursor, "Actual restores have a stale or malformed source cursor")
            if captured["sourceCallsBefore"] != cursor:
                break
            require(captured.get("sourceCallsAfter") == cursor, "Actual restore intersects an unfinished source call")
            retained = family.state()
            before = state(retained)
            family.restore(deepcopy(retained))
            after = state(family.state())
            delta = compare(before, after, f"sourceRestores[{next_source_restore}].roundTrip")
            report["sourceRestorationReplay"].append({"restoreIndex": next_source_restore,
                "sourceCallsThrough": cursor, "stateOrigin": "this cold original owner only", "nativeStateSeed": False,
                "sourceBeforeDigest": digest(before), "sourceAfterDigest": digest(after), "differences": len(delta)})
            snapshots[cursor] = deepcopy(after)
            next_source_restore += 1

    def proposal_core(value, where, selected=False):
        if value is None:
            return None
        require(isinstance(value, dict), "Captured proposal must be an object or null")
        result = deepcopy(value)
        if "program_subquestion" in result:
            require(result["program_subquestion"] == ENTRY[1], "Foreign program_subquestion on an facet proposal")
            report["callerAnnotations"].append({"path": where + ".program_subquestion", "value": result.pop("program_subquestion"),
                                                "origin": "facetExampleFamily offer / strategy.py program_construction"})
        if selected:
            for key in ("strategy_receipt", "morphology", "composition_target_tree"):
                if key not in result: continue
                require(isinstance(result[key], dict), "Malformed caller annotation: " + key)
                if key == "strategy_receipt":
                    require(result[key].get("selected") == ENTRY[0]
                            and result[key].get("workflow") == "v6.composition_strategy.choose", "Foreign selected-group receipt")
                if key == "composition_target_tree":
                    # Original common_frontier_runtime.py:476 and native
                    # NativeCompositionAuthority.bind add this exact top-level
                    # receipt after family proposal. The family never reads it.
                    target, bound, template = result[key], result.get("binding", {}), result.get("bundle_template", {})
                    require(target.get("admitted") is True and target.get("observation_ref") == bound.get("observation_ref")
                            and target.get("level_epoch") == bound.get("level_epoch")
                            and target.get("root") == template.get("objective_ref")
                            and isinstance(target.get("path"), list) and len(target["path"]) >= 2
                            and target["path"][0] == target["root"] and target["path"][-1] == template.get("composition_ref"),
                            "Caller target-tree annotation is not bound to this selected proposal")
                report["callerAnnotations"].append({"path": where + "." + key, "value": result.pop(key),
                    "origin": "NativeCompositionAuthority.bind / original common_frontier_runtime.py target binding"
                              if key == "composition_target_tree" else "NativeV6Runtime selection, outside FacetExamples"})
        return result

    def source_proposal(native, where, *, selected_offer_snapshot=False):
        core = proposal_core(native, where, selected=True)
        require(isinstance(core, dict) and core.get("kind") == "public_facet_example"
                and "facet_plan" in core, "Selected facet call received a foreign proposal")
        reference = core.get("binding", {}).get("observation_ref")
        candidates = offers.get(reference, [])
        require(candidates, "No earlier original offer binds the selected public observation")
        # NativeV6Runtime freezes structuredClone(proposal) when the prefix is
        # created, before the action or its response. Its later prefix_evidence
        # retains that immutable offer. The live Python proposal deliberately
        # retains portable aliases and can change during record at a boundary.
        # Compare like capture times without dropping or rewriting any field.
        def at_capture_time(item):
            return item["offerSnapshot"] if selected_offer_snapshot else item["proposal"]
        exact = [item for item in candidates if not differences(plain(at_capture_time(item)), core)]
        chosen = (exact or candidates)[-1]
        source_value = at_capture_time(chosen)
        compare(source_value, core, where + ".sourceProposal")
        if selected_offer_snapshot:
            report["immutableSelectedProposalChecks"].append({"path": where,
                "sourceProposalCallIndex": chosen["index"],
                "snapshotOrigin": "Complete independently produced original proposal frozen at its propose return, before acquisition",
                "sourceOfferSnapshotDigest": digest(source_value), "nativeOfferSnapshotDigest": digest(core),
                "currentOriginalProposalDigest": digest(chosen["proposal"]),
                "offerSnapshotToCurrentOriginalDifferences": differences(plain(source_value), plain(chosen["proposal"])),
                "qualification": "Native sealed-prefix proposal evidence is immutable pre-acquisition evidence. This check does not assert equality to the live Python proposal object after acquisition. All fields, including boundary_ref, remain compared at the matching capture time."})
        # Keep this original object and its source-owned aliases. In particular
        # compound.source_method points to portable, whose boundary_ref changes
        # in record. Historical call results are separately frozen JSON values.
        return source_value, chosen["index"], core

    def public_observation(value, rows, call_index, side, explicit_packet=None):
        require(isinstance(value, dict), "Missing public observation")
        reference = value.get("observation_ref")
        match = OBSERVATION.fullmatch(reference or "")
        require(match is not None, "Captured observation has no source-shaped reference")
        source_scopes.add(match[1])
        key = (reference, digest(rows), digest(value), digest(explicit_packet))
        if key in observations:
            return deepcopy(observations[key])
        raster_hash = sha(json.dumps(rows, allow_nan=False, separators=(",", ":")).encode())[:16]
        packet = {"frame_rows": rows, "level": value["level_epoch"], "levels_completed": value["levels_completed"],
                  "state": value["state"], "available_action_refs": value["available_action_refs"], "frame_hash": raster_hash}
        if explicit_packet is not None:
            require(isinstance(explicit_packet, dict), "Captured before packet is not public JSON")
            compare(raster_hash, explicit_packet.get("frame_hash"), f"calls[{call_index}].public.{side}.packetRasterHash")
            packet.update({key: explicit_packet[key] for key in packet})
        measured = plain(measure(SimpleNamespace(**packet), value["revision"], match[1])[0])
        diff = compare(measured, value, f"calls[{call_index}].public.{side}")
        if reference in observations_by_ref:
            compare(observations_by_ref[reference], {"rows": rows, "observation": value},
                    f"calls[{call_index}].public.{side}.repeatedReference")
        else:
            observations_by_ref[reference] = {"rows": deepcopy(rows), "observation": deepcopy(value)}
        report["publicObservationChecks"].append({"callIndex": call_index, "side": side, "observationRef": reference,
            "rasterDigest": digest(rows), "originalObservationDigest": digest(measured),
            "capturedObservationDigest": digest(value), "differences": len(diff)})
        observations[key] = measured
        return deepcopy(measured)

    def ablations(call_index, arguments, retained, actual, actual_after):
        baseline = family_class(); baseline.restore(deepcopy(retained))
        restored = plain(baseline.propose(*deepcopy(arguments)))
        restored_state = state(baseline.state())
        proposal_diff = compare(actual, restored, f"calls[{call_index}].restoration.proposal")
        state_diff = compare(actual_after, restored_state, f"calls[{call_index}].restoration.state")
        report["restorationChecks"].append({"callIndex": call_index, "stateOrigin": "cold original replay only",
            "nativeStateSeed": False, "proposalDifferences": len(proposal_diff), "stateDifferences": len(state_diff),
            "sourceStateBeforeDigest": digest(retained), "restoredStateAfterDigest": digest(restored_state)})
        source_diagnostic = diagnostic(baseline)
        for intervention, field in INTERVENTIONS.items():
            changed = deepcopy(retained)
            removed = deepcopy(changed[field])
            changed[field] = None if field in ("method", "portable") else {} if field == "compound_methods" else []
            applied = removed is not None if field in ("method", "portable") else bool(removed)
            item = {"callIndex": call_index, "intervention": intervention, "field": field,
                "stateOrigin": "Only original state acquired/computed by this cold public-call replay",
                "nativeStateSeed": False, "interventionApplied": applied, "removed": removed,
                "removedCount": (int(removed is not None) if field in ("method", "portable") else len(removed)),
                "sourceStateBeforeDigest": digest(retained), "ablatedStateBeforeDigest": digest(changed),
                "allOtherOwnerFieldsPreserved": not differences({k: retained[k] for k in STATE_FIELDS - {field}},
                                                               {k: changed[k] for k in STATE_FIELDS - {field}}),
                "actualDecision": decision(actual), "actualProposalDigest": digest(actual),
                "scope": "Independent single-field source-component counterfactual at the same public arguments. Other memory fields, including events, remain. No new game, original caller arbitration, joint intervention or whole-game causal improvement is claimed."}
            try:
                alternate_owner = family_class(); alternate_owner.restore(changed)
                alternate = plain(alternate_owner.propose(*deepcopy(arguments)))
                delta = differences(actual, alternate)
                action_changed = bool(differences(action_or_refusal(actual), action_or_refusal(alternate)))
                item.update(executed=True, counterfactualProposal=alternate, counterfactualDecision=decision(alternate),
                    counterfactualProposalDigest=digest(alternate), counterfactualSourceAfterDigest=digest(state(alternate_owner.state())),
                    counterfactualDiagnostic=diagnostic(alternate_owner), proposalDifferences=delta,
                    actionOrRefusalChanged=action_changed, strictProposalChanged=bool(delta),
                    metadataOnlyChanged=bool(delta) and not action_changed,
                    diagnosticChanged=bool(differences(source_diagnostic, diagnostic(alternate_owner))),
                    sourceStateChanged=bool(differences(actual_after, state(alternate_owner.state()))))
            except Exception as error:
                item.update(executed=False, error=error_value(error), actionOrRefusalChanged=None,
                            strictProposalChanged=None, metadataOnlyChanged=None, diagnosticChanged=None, sourceStateChanged=None)
            report["ablations"].append(item)

    for index, captured in enumerate(calls):
        try:
            replay_source_restores(index)
            require(captured.get("index") == index, "Source call indices must be complete and ordered from zero")
            require("error" not in captured, "Native captured call failed: " + str(captured.get("error")))
            method, arguments = captured.get("method"), deepcopy(captured.get("arguments"))
            require(method in ARITIES and isinstance(arguments, list) and len(arguments) == ARITIES[method],
                    "Unexpected facet method or source arity")
            native_method = captured.get("nativeMethod")
            require(native_method in (("propose", "proposeInSubquestion") if method == "propose" else (method,)),
                    "Native method does not match its captured source surface")
            require(captured.get("selectionEntry") == (ENTRY if native_method == "proposeInSubquestion" else None),
                    "Unexpected facet selection entry")
            state_before = state(family.state())
            before_diff = compare(state_before, state(captured.get("sourceBefore")), f"calls[{index}].stateBefore")
            own_proposal_index, extra = None, {}
            if method == "propose":
                observation, rows, inputs, remaining = arguments
                source_args = [public_observation(observation, rows, index, "current"), rows, inputs, remaining]
                original_offer = family.propose(*deepcopy(source_args))
                returned = plain(original_offer)
                native_result = proposal_core(captured.get("result"), f"calls[{index}].result")
                if returned is not None:
                    offers[returned["binding"]["observation_ref"]].append({"index": index,
                        "proposal": original_offer, "offerSnapshot": deepcopy(returned)})
                counts["nonNullProposals" if returned is not None else "abstentions"] += 1
                extra = {"sourceDecision": decision(returned), "nativeDecision": decision(native_result),
                         "sourceDiagnostic": diagnostic(family), "sourceRecognizedInterface": family.current is not None}
                if returned is not None:
                    projection = returned["facet_plan"]["projection"]
                    counts["proposalBranch:" + ("compound" if projection.get("compound") else "simple")] += 1
                    counts["proposalExperiment:" + projection["offer"]["kind"]] += 1
                for prior in pending_records:
                    report["nextChoiceChecks"].append({"recordCallIndex": prior["index"], "proposalCallIndex": index,
                        "sameCapturedAfterObservation": observation["observation_ref"] == prior["after"],
                        "sourceDecision": decision(returned), "nativeDecision": decision(native_result),
                        "differences": len(differences(returned, native_result)),
                        "scope": "Next captured call of this family, not a claim that the original caller would select it"})
                pending_records.clear()
            elif method == "before":
                native_proposal, action_index, packet, observation = arguments
                own, own_proposal_index, _ = source_proposal(native_proposal, f"calls[{index}].arguments[0]")
                require(action_index == 0 and len(own["actions"]) == 1, "Facet guard must bind its single primitive")
                observed = public_observation(observation, packet["frame_rows"], index, "beforeGuard", packet)
                returned = plain(family.before(own, action_index, SimpleNamespace(**packet), observed))
                native_result = captured.get("result")
                before_guards.append({"index": index, "proposalCallIndex": own_proposal_index, "before": observed["observation_ref"],
                    "command": own["actions"][0], "sourceResult": returned, "nativeResult": native_result})
            elif method == "after":
                native_proposal, action_index, before, after, first, second = arguments
                own, own_proposal_index, _ = source_proposal(native_proposal, f"calls[{index}].arguments[0]")
                require(action_index == 0 and len(own["actions"]) == 1, "Facet outcome must bind its single primitive")
                source_before = public_observation(before, first, index, "before")
                source_after = public_observation(after, second, index, "after")
                returned = plain(family.after(own, action_index, source_before, source_after, first, second))
                native_result = captured.get("result")
                after_guards.append({"index": index, "proposalCallIndex": own_proposal_index, "before": source_before["observation_ref"],
                    "after": source_after["observation_ref"], "command": own["actions"][0], "sourceResult": returned, "nativeResult": native_result})
            else:
                before, after, command, first, second, native_proposal, action_index = arguments
                own, own_proposal_index, _ = source_proposal(native_proposal, f"calls[{index}].arguments[5]")
                require(action_index == 0 and len(own["actions"]) == 1, "Facet record must bind its single primitive")
                source_before = public_observation(before, first, index, "before")
                source_after = public_observation(after, second, index, "after")
                key = (before["observation_ref"], after["observation_ref"], digest(command))
                require(key not in record_keys, "The same selected transition was acquired more than once")
                record_keys.add(key)
                returned = plain(family.record(source_before, source_after, command, first, second, own, action_index))
                native_result = captured.get("result")
                item = {"index": index, "proposalCallIndex": own_proposal_index, "before": before["observation_ref"],
                        "after": after["observation_ref"], "command": command, "sourceResult": returned}
                records.append(item); pending_records.append(item)
                counts["selectedRecords"] += 1; counts["recordStatus:" + str(returned.get("status"))] += 1
            state_after = state(family.state())
            result_diff = compare(returned, native_result, f"calls[{index}].result")
            after_diff = compare(state_after, state(captured.get("sourceAfter")), f"calls[{index}].stateAfter")
            counts[method] += 1
            report["callChecks"].append({"index": index, "method": method, "nativeMethod": native_method,
                "selectionEntry": captured.get("selectionEntry"), "argumentDigest": digest(arguments),
                "sourceBeforeDigest": digest(state_before), "sourceAfterDigest": digest(state_after),
                "nativeBeforeDigest": digest(state(captured["sourceBefore"])), "nativeAfterDigest": digest(state(captured["sourceAfter"])),
                "sourceResult": returned, "sourceResultDigest": digest(returned), "nativeResultDigest": digest(native_result),
                "sourceProposalCallIndex": own_proposal_index, "beforeDifferences": len(before_diff),
                "resultDifferences": len(result_diff), "afterDifferences": len(after_diff),
                "methodBefore": state_before["method"] is not None, "methodAfter": state_after["method"] is not None,
                "portableBefore": state_before["portable"] is not None, "portableAfter": state_after["portable"] is not None,
                "compoundMethodsBefore": len(state_before["compound_methods"]), "compoundMethodsAfter": len(state_after["compound_methods"]),
                "refutedCompoundsBefore": len(state_before["refuted_compounds"]), "refutedCompoundsAfter": len(state_after["refuted_compounds"]),
                "failedBefore": len(state_before["failed"]), "failedAfter": len(state_after["failed"]), **extra})
            if index + 1 in needed_snapshots: snapshots[index + 1] = deepcopy(state_after)
            if method == "propose": ablations(index, source_args, state_before, returned, state_after)
            replay_source_restores(index + 1)
        except Exception as error:
            report["stop"] = {"kind": "source_call_replay_stopped", "callIndex": index, "error": error_value(error)}
            break

    for acquired in records:
        before = [guard for guard in before_guards if guard["index"] < acquired["index"]
                  and guard["proposalCallIndex"] == acquired["proposalCallIndex"] and guard["before"] == acquired["before"]
                  and not differences(guard["command"], acquired["command"])]
        after = [guard for guard in after_guards if guard["index"] < acquired["index"]
                 and guard["proposalCallIndex"] == acquired["proposalCallIndex"] and guard["before"] == acquired["before"]
                 and guard["after"] == acquired["after"] and not differences(guard["command"], acquired["command"])]
        admitted = [guard for guard in before if guard["sourceResult"].get("admitted") is True
                    and isinstance(guard["nativeResult"], dict) and guard["nativeResult"].get("admitted") is True]
        sealed = [guard for guard in after if guard["sourceResult"].get("matched") is None
                  and guard["sourceResult"].get("seal_prefix") is True
                  and not differences(guard["sourceResult"], guard["nativeResult"])]
        passed = bool(admitted) and len(after) == 1 and len(sealed) == 1 and max(g["index"] for g in admitted) < after[0]["index"]
        report["guardCoverage"].append({"recordCallIndex": acquired["index"], "beforeGuardCallIndices": [g["index"] for g in before],
            "afterGuardCallIndices": [g["index"] for g in after], "passed": passed})
        if not passed: compare(True, False, f"calls[{acquired['index']}].selectedAcquisitionGuardCoverage")

    previous_restore_cursor = 0
    for restore_index, captured in enumerate(restores):
        try:
            require(isinstance(captured, dict) and type(captured.get("index")) is int
                    and captured["index"] == restore_index and captured.get("method") == "restore",
                    "Actual facet restore indices or method are not ordered")
            before_cursor, after_cursor = captured.get("sourceCallsBefore"), captured.get("sourceCallsAfter")
            require(type(before_cursor) is int and type(after_cursor) is int
                    and previous_restore_cursor <= before_cursor == after_cursor <= len(calls),
                    "Actual facet restore does not occur between complete source calls")
            require(before_cursor in snapshots, "Cold original replay did not reach this restore cursor")
            require(all(type(captured.get(key)) is int and captured[key] == 0
                        for key in ("sourceDepthBefore", "sourceDepthAfter")),
                    "Actual facet restore occurred inside a source method")
            require(captured.get("returnMode") == "sync" and captured.get("completion") == "returned"
                    and captured.get("returnedNormally") is True and captured.get("exception") is None
                    and captured.get("observationErrors") == [],
                    "Actual synchronous facet restore failed or was not faithfully observed")
            arguments = captured.get("arguments")
            require(isinstance(arguments, list) and len(arguments) == 1,
                    "Actual facet restore must receive the source state once")
            expected = snapshots[before_cursor]
            argument_diff = compare(expected, state(arguments[0]), f"nativeRestores[{restore_index}].receivedState")
            before_diff = compare(expected, state(captured.get("sourceBefore")), f"nativeRestores[{restore_index}].beforeState")
            after_diff = compare(expected, state(captured.get("sourceAfter")), f"nativeRestores[{restore_index}].afterState")
            # A fresh original instance round-trips only independently replayed
            # original state. The native received argument is never a seed.
            restored_source = family_class(); restored_source.restore(deepcopy(expected))
            round_trip_diff = compare(expected, state(restored_source.state()), f"nativeRestores[{restore_index}].sourceRoundTrip")
            report["nativeRestorationChecks"].append({"restoreIndex": restore_index,
                "sourceCallsThrough": before_cursor, "stateOrigin": "cold original replay only",
                "nativeStateSeed": False, "actualNativeRestoreObserved": True,
                "sourceStateDigest": digest(expected), "receivedStateDigest": digest(arguments[0]),
                "nativeSourceAfterDigest": digest(captured["sourceAfter"]),
                "argumentDifferences": len(argument_diff), "beforeDifferences": len(before_diff),
                "afterDifferences": len(after_diff), "sourceRoundTripDifferences": len(round_trip_diff),
                "passed": not (argument_diff or before_diff or after_diff or round_trip_diff)})
            previous_restore_cursor = before_cursor
        except Exception as error:
            report["nativeRestorationChecks"].append({"restoreIndex": restore_index, "passed": False, "error": error_value(error)})

    previous_through, previous_restore_through, covered_records, covered_restores = 0, 0, set(), set()
    for prefix_index, prefix in enumerate(prefixes):
        try:
            retained = prefix.get("facetExample")
            require(isinstance(retained, dict) and retained.get("stateNode") == OWNER, "Missing actual facet owner checkpoint")
            through = retained.get("sourceCallsThrough")
            require(type(through) is int and previous_through <= through <= len(calls), "Invalid prefix source-call cursor")
            require(through in snapshots, "Original replay did not reach the captured checkpoint cursor")
            checkpoint_diff = compare(snapshots[through], state(retained.get("state")), f"prefixes[{prefix_index}].state")
            instance_diff = compare(snapshots[through], state(retained.get("instanceSourceState")),
                                    f"prefixes[{prefix_index}].instanceSourceState")
            restore_through = retained.get("restoreCallsThrough")
            require(type(restore_through) is int and previous_restore_through <= restore_through <= len(restores),
                    "Invalid prefix actual restore cursor")
            latest_restore = restores[restore_through - 1] if restore_through else None
            restore_copy_diff = compare(latest_restore, retained.get("nativeRestoration"),
                                        f"prefixes[{prefix_index}].nativeRestoration")
            if latest_restore is not None:
                require(latest_restore["sourceCallsAfter"] <= through,
                        "Captured prefix points to a restore from a later source cursor")
            if restore_through < len(restores):
                require(restores[restore_through]["sourceCallsBefore"] >= through,
                        "Captured prefix skips an earlier actual restore")
            acquired = [row for row in records if previous_through <= row["index"] < through]
            selected = retained.get("proposal") is not None
            proposal_diff = []
            if selected:
                require(prefix.get("family") == "facet_examples" and prefix.get("programSubquestion") == ENTRY[1]
                        and prefix.get("selectionGroup") == ENTRY[0] and prefix.get("proposalKind") == "public_facet_example",
                        "Selected prefix is not attributed to the facet owner/entry")
                require(prefix.get("acquiredActions") == 1 and len(acquired) == 1, "Selected facet prefix must acquire exactly once")
                require(restore_through > previous_restore_through and latest_restore is not None
                        and latest_restore["sourceCallsBefore"] == latest_restore["sourceCallsAfter"] == acquired[0]["index"] + 1 == through,
                        "Selected facet record must be followed by its actual restore before prefix capture")
                require(report["nativeRestorationChecks"][restore_through - 1]["passed"],
                        "Selected facet checkpoint restore does not match independently acquired source state")
                covered_restores.add(restore_through - 1)
                before_count = len(report["differences"])
                own, source_index, core = source_proposal(retained["proposal"], f"prefixes[{prefix_index}].proposal",
                                                        selected_offer_snapshot=True)
                require(source_index == acquired[0]["proposalCallIndex"], "Checkpoint proposal and acquired original offer disagree")
                proposal_diff = report["differences"][before_count:]
                covered_records.add(acquired[0]["index"])
                captured_transitions = [prefix[name]["transitions"] for name in
                    ("inventoryAcquisition", "recolorAcquisition", "reactionAcquisition", "reactiveAcquisition")
                    if isinstance(prefix.get(name), dict) and isinstance(prefix[name].get("transitions"), list)]
                for other in captured_transitions[1:]:
                    compare(captured_transitions[0], other, f"prefixes[{prefix_index}].commonTransitionCopies")
                if captured_transitions:
                    actual = [{key: row[key] for key in ("before", "after", "command")} for row in captured_transitions[0]]
                    expected = [{key: acquired[0][key] for key in ("before", "after", "command")}]
                    compare(expected, actual, f"prefixes[{prefix_index}].selectedTransition")
            else:
                require(not acquired and prefix.get("family") != "facet_examples", "Foreign prefix acquired an facet return")
            report["prefixChecks"].append({"prefixIndex": prefix_index, "prefixId": prefix.get("id"),
                "sourceCallsThrough": through, "selected": selected, "recordCallIndices": [row["index"] for row in acquired],
                "restoreCallsThrough": restore_through,
                "actualRestoreIndex": restore_through - 1 if restore_through else None,
                "sourceStateDigest": digest(snapshots[through]), "nativeStateDigest": digest(state(retained["state"])),
                "stateDifferences": len(checkpoint_diff), "instanceStateDifferences": len(instance_diff),
                "restoreCopyDifferences": len(restore_copy_diff), "proposalDifferences": len(proposal_diff)})
            previous_through, previous_restore_through = through, restore_through
        except Exception as error:
            report["prefixChecks"].append({"prefixIndex": prefix_index, "prefixId": prefix.get("id"), "error": error_value(error)})
    uncovered_records = sorted({row["index"] for row in records} - covered_records)
    if uncovered_records: compare([], uncovered_records, "selectedRecordsWithoutSealedCheckpoint")
    if len(source_scopes) != 1: compare(1, len(source_scopes), "publicSourceSessionScopeCount")
    report.update(counts=dict(counts), callsExpected=len(calls), callsCompared=len(report["callChecks"]),
        finalSourceState=state(family.state()), sourceSessionScopes=sorted(source_scopes),
        uniquePublicObservations=len(observations_by_ref), prefixesExpected=len(prefixes),
        prefixesCompared=sum("error" not in item for item in report["prefixChecks"]),
        sourceRecordCalls=records, recordsWithoutFollowingCapturedProposal=[row["index"] for row in pending_records],
        selectedContributionCaptured=bool(records), passiveRecords=0,
        nativeRestoresExpected=len(restores), nativeRestoresCompared=len(report["nativeRestorationChecks"]),
        originalRestoresReplayed=len(report["sourceRestorationReplay"]),
        nativeRestoresMatched=sum(row["passed"] for row in report["nativeRestorationChecks"]),
        selectedRecordRestoresCovered=len(covered_restores),
        allActualNativeRestoresMatched=all(row["passed"] for row in report["nativeRestorationChecks"]),
        allSelectedRecordsRestored=len(covered_restores) == len(records),
        guardsCompared=counts["before"] + counts["after"], allSelectedRecordsGuarded=all(item["passed"] for item in report["guardCoverage"]))
    covered_statuses = {row["sourceResult"].get("status") for row in records}
    required_statuses = ("filled_example_correspondence", "observed_visible_cap_and_side_change",
        "cap_change_without_verified_side_extension", "outside_contribution_changed", "no_visible_effect",
        "effect_not_yet_explained", "compound_seed_effect_matched", "compound_extension_effect_matched",
        "compound_effect_refuted", "compound_visual_candidate_not_accepted", "official_boundary")
    report["trajectoryCoverage"] = {"recordStatusesObserved": sorted(covered_statuses),
        "recordStatusesNotObserved": [name for name in required_statuses if name not in covered_statuses],
        "simpleProposals": counts["proposalBranch:simple"], "compoundProposals": counts["proposalBranch:compound"],
        "selectedRecords": len(records), "selectedNativeRestores": len(covered_restores),
        "qualification": "Missing branches remain absent from this campaign; synthetic fixture coverage or other campaigns are separate evidence. A component comparison can pass on a limited or unsuccessful trajectory."}

    def ablation_counts(items):
        return {"total": len(items), "executed": sum(item["executed"] for item in items),
                "errors": sum(not item["executed"] for item in items),
                "interventionApplied": sum(item["interventionApplied"] for item in items),
                "emptyIntervention": sum(not item["interventionApplied"] for item in items),
                **{key: sum(item.get(key) is True for item in items) for key in
                   ("actionOrRefusalChanged", "strictProposalChanged", "metadataOnlyChanged", "diagnosticChanged", "sourceStateChanged")},
                "actionOrRefusalUnchanged": sum(item["executed"] and item["actionOrRefusalChanged"] is False for item in items),
                "fullProposalUnchanged": sum(item["executed"] and item["strictProposalChanged"] is False for item in items)}

    report["ablationCounts"] = {**ablation_counts(report["ablations"]), "expected": counts["propose"] * len(INTERVENTIONS),
        "distinctProposalsWithActionOrRefusalChange": len({item["callIndex"] for item in report["ablations"] if item.get("actionOrRefusalChanged") is True}),
        "byIntervention": {name: ablation_counts([item for item in report["ablations"] if item["intervention"] == name]) for name in INTERVENTIONS}}
    report["componentParityPassed"] = (report["stop"] is None and not report["differences"]
        and report["callsCompared"] == report["callsExpected"] and report["prefixesCompared"] == len(prefixes)
        and counts["propose"] > 0 and report["allSelectedRecordsGuarded"]
        and report["allActualNativeRestoresMatched"] and report["allSelectedRecordsRestored"]
        and report["originalRestoresReplayed"] == report["nativeRestoresExpected"])
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("campaign", type=Path, help="Completed public campaign with FacetExamples call/guard/checkpoint capture")
    parser.add_argument("--output", required=True, type=Path, help="New .json.gz comparison, never overwritten")
    args = parser.parse_args()
    campaign_path, output = args.campaign.resolve(), args.output.resolve()
    if output.exists() or output == campaign_path or output.is_relative_to(SOURCE.parent):
        parser.error("Output must be a new evidence path outside the pinned originals")
    if not output.name.endswith(".json.gz"):
        parser.error("Output must end in .json.gz")
    paths = {"campaign": campaign_path, "generator": Path(__file__).resolve(), "manifest": MANIFEST,
             "captureHelperAtComparison": ROOT / "tests/helpers/v6-live-game-campaign.ts",
             "nativeCallerAtComparison": ROOT / "src/logos-engine/v6-native-runtime.ts",
             "nativeAuthorityAtComparison": ROOT / "src/logos-engine/v6-native-authority.ts",
             "nativeFamilyAtComparison": ROOT / "src/logos-engine/v6-facet-examples.ts",
             "nativeGeometryAtComparison": ROOT / "src/logos-engine/v6-facet-examples-geometry.ts",
             "nativeCompoundAtComparison": ROOT / "src/logos-engine/v6-facet-examples-compound.ts",
             "nativeStencilsAtComparison": ROOT / "src/logos-engine/v6-facet-examples-stencils.ts"}
    report = {"schema": "logos-engine.facet-example-public-source-parity.v1",
        "startedAt": datetime.now(timezone.utc).isoformat(), "sourceCommit": COMMIT, "inputs": {},
        "scope": "Cold unchanged original FacetExamples component on captured public calls, with its own independently produced selected plans. Public observer, source guards, returned events, all seven owner fields, actual native restore calls, sealed checkpoints and subsequent captured choices are compared. Single-field source-memory ablations do not establish full original caller parity, whole-game causal improvement, complete V5 transfer or a performance verdict.",
        "gameHostRun": False, "nativeAgentRun": False, "originalCommonCallerRun": False,
        "helperProvenanceQualification": "Helper/runtime fingerprints describe files read at comparison time; campaign execution provenance remains the campaign and its enclosing freeze/phase receipts."}
    bytecode = tempfile.TemporaryDirectory(prefix="facet-public-source-parity-")
    sys.pycache_prefix = bytecode.name
    report["bytecodeIsolation"] = {"freshPrefix": bytecode.name, "dontWriteBytecode": sys.dont_write_bytecode,
        "freshPrefixEmptyBefore": not any(Path(bytecode.name).rglob("*")),
        "existingSourceBytecodeBefore": existing_source_bytecode()}
    try:
        report["inputs"] = {key: fingerprint(path) for key, path in paths.items()}
        report["sourceBefore"] = verify_originals()
        campaign = read_json(campaign_path)
        report.update(game=campaign.get("game"), campaignStatus=campaign.get("status"), campaignFailure=campaign.get("failure"),
                      campaignFinal=campaign.get("final"), nativeSource=campaign.get("source"))
        # All 1786 pinned files are verified before importing any original code.
        sys.path[:0] = [str(SOURCE / "agents/yf_arc3_v6/laya_proto"), str(SOURCE)]
        from agents.yf_arc3_v6.morphology_policy.facet_examples.family import FacetExamples
        from neutral_observer import measure
        report["replay"] = compare_campaign(campaign, FacetExamples, measure)
    except Exception as error:
        report["error"] = error_value(error)
    try:
        report["sourceAfter"] = verify_originals()
        report["originalsUnchanged"] = report.get("sourceBefore") == report["sourceAfter"]
    except Exception as error:
        report["sourceVerificationError"] = error_value(error); report["originalsUnchanged"] = False
    try:
        report["inputsAfter"] = {key: fingerprint(path) for key, path in paths.items()}
        report["inputsUnchanged"] = report["inputs"] == report["inputsAfter"]
    except Exception as error:
        report["inputVerificationError"] = error_value(error); report["inputsUnchanged"] = False
    report["bytecodeIsolation"]["freshPrefixEmptyAfter"] = not any(Path(bytecode.name).rglob("*"))
    report["bytecodeIsolation"]["existingSourceBytecodeAfter"] = existing_source_bytecode()
    report["bytecodeIsolation"]["existingSourceBytecodeUnchanged"] = (
        report["bytecodeIsolation"]["existingSourceBytecodeBefore"] == report["bytecodeIsolation"]["existingSourceBytecodeAfter"])
    report["bytecodeIsolation"]["passed"] = all(report["bytecodeIsolation"][name] is True for name in (
        "dontWriteBytecode", "freshPrefixEmptyBefore", "freshPrefixEmptyAfter", "existingSourceBytecodeUnchanged"))
    bytecode.cleanup()
    replay = report.get("replay", {})
    ablations = replay.get("ablationCounts", {})
    report["status"] = "passed" if not report.get("error") and report["originalsUnchanged"] and report["inputsUnchanged"] \
        and report["bytecodeIsolation"]["passed"] \
        and replay.get("componentParityPassed") and ablations.get("errors") == 0 \
        and ablations.get("total") == ablations.get("expected") else "failed"
    report["completedAt"] = datetime.now(timezone.utc).isoformat()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("xb") as stream:
        with gzip.GzipFile(fileobj=stream, mode="wb", filename="", mtime=0) as compressed:
            for part in json.JSONEncoder(ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")).iterencode(report):
                compressed.write(part.encode())
            compressed.write(b"\n")
    print(json.dumps({"status": report["status"], "output": path_label(output), "campaignStatus": report.get("campaignStatus"),
        "sourceFilesVerifiedBefore": report.get("sourceBefore", {}).get("filesVerified"),
        "sourceFilesVerifiedAfter": report.get("sourceAfter", {}).get("filesVerified"),
        "originalsUnchanged": report["originalsUnchanged"], "inputsUnchanged": report["inputsUnchanged"],
        "callsCompared": replay.get("callsCompared", 0), "callsExpected": replay.get("callsExpected", 0),
        "counts": replay.get("counts", {}), "uniquePublicObservations": replay.get("uniquePublicObservations", 0),
        "prefixesCompared": replay.get("prefixesCompared", 0), "guardsCompared": replay.get("guardsCompared", 0),
        "nativeRestoresCompared": replay.get("nativeRestoresCompared", 0), "nativeRestoresMatched": replay.get("nativeRestoresMatched", 0),
        "allSelectedRecordsRestored": replay.get("allSelectedRecordsRestored"),
        "trajectoryCoverage": replay.get("trajectoryCoverage"),
        "differences": len(replay.get("differences", [])), "ablations": ablations,
        "stop": replay.get("stop"), "error": report.get("error")}, indent=2))
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
