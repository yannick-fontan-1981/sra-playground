#!/usr/bin/env python3
"""Cold original FeedbackSequences replay over a completed captured campaign.

Usage:
  python3 -B scripts/compare-feedback-public-parity.py CAMPAIGN.json.gz \
    --output COMPARISON.json.gz

No game, controller, native agent or performance campaign is run. The unchanged
Python component starts empty; captured native states are comparison data only.
History ablations start from clones of the cold-replayed original state. This
does not establish the original common caller's choice/order or game success.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = ROOT / "reference/v6" / COMMIT / "source"
MANIFEST = SOURCE.parent / "manifest.json"
OBSERVATION = re.compile(r"(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)")
STATE_FIELDS = {"layout", "active", "repeatable", "entry_evidence", "history", "submit", "clear_evidence", "last",
                "blocked", "palette_background", "entry_method", "transfer_refuted_epoch"}


def plain(value):
    return json.loads(json.dumps(value, separators=(",", ":")))


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


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
    data = path.read_bytes()
    return {"path": path_label(path), "bytes": len(data), "sha256": sha(data)}


def read_json(path):
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == ".gz" else data)


def verify_originals():
    manifest = read_json(MANIFEST)
    if manifest.get("commit") != COMMIT or len(manifest.get("files", {})) != 1786:
        raise ValueError("The pinned original inventory must name the expected commit and 1786 files")
    inventory = {}
    for name, expected in manifest["files"].items():
        data = (SOURCE / name).read_bytes()
        if len(data) != expected["bytes"] or sha(data) != expected["sha256"]:
            raise ValueError("Pinned original bytes changed: " + name)
        inventory[name] = {"bytes": len(data), "sha256": sha(data)}
    return {"commit": COMMIT, "filesVerified": len(inventory), "inventoryDigest": digest(inventory),
            "manifest": fingerprint(MANIFEST)}


def differences(source, native, path=""):
    """Strict JSON comparison; do not project away extra native properties."""
    source, native = plain(source), plain(native)
    if encoded(source) == encoded(native):
        return []
    if isinstance(source, dict) and isinstance(native, dict):
        result = []
        for key in sorted(set(source) | set(native)):
            current = f"{path}.{key}" if path else key
            if key not in source or key not in native:
                item = {"path": current, "sourcePresent": key in source, "nativePresent": key in native}
                if key in source:
                    item["source"] = source[key]
                if key in native:
                    item["native"] = native[key]
                result.append(item)
            else:
                result.extend(differences(source[key], native[key], current))
        return result
    if isinstance(source, list) and isinstance(native, list) and len(source) == len(native):
        return [item for i, (left, right) in enumerate(zip(source, native))
                for item in differences(left, right, f"{path}[{i}]")]
    return [{"path": path, "source": source, "native": native}]


def decision(proposal):
    if proposal is None:
        return {"status": "no_proposal", "actions": [], "orderedTrial": None}
    selection = proposal.get("feedback_plan", {}).get("selection", {})
    return {"status": proposal.get("status"), "kind": proposal.get("kind"), "actions": proposal.get("actions", []),
            "orderedTrial": selection.get("trial")}


def accounting(proposal):
    selection = (proposal or {}).get("feedback_plan", {}).get("selection", {})
    keys = ("candidate_count", "law_alternatives", "trial_count", "minimax", "partition_count", "information_cost")
    return {key: selection[key] for key in keys if key in selection}


def action_or_refusal(proposal):
    view = decision(proposal)
    return {"status": view["status"], "actions": view["actions"]}


def exception(error):
    return {"type": type(error).__name__, "message": str(error)}


def compare_campaign(campaign, family_class, measure):
    calls = campaign.get("feedbackSourceCalls")
    if not isinstance(calls, list) or not calls:
        raise ValueError("The completed campaign contains no captured Feedback source calls")
    family = family_class()
    initial = plain(family.state())
    if set(initial) != STATE_FIELDS:
        raise ValueError("Unexpected original Feedback state owner")
    result = {"coldStart": True, "nativeStatesUsedToPrimeSource": False, "initialSourceState": initial,
              "normalizations": [], "comparisonPolicy": "Exact JSON equality for source state, return and full proposal, including SRC receipt. The source-reference tests require no receipt normalization.",
              "callChecks": [], "publicObservationChecks": [], "ablations": [], "differences": [], "stop": None}
    counts = Counter()
    observed = {}
    record_keys = set()

    def public_observation(value, rows, call_index, side):
        reference = value.get("observation_ref")
        match = OBSERVATION.fullmatch(reference or "")
        if not match:
            raise ValueError("Captured public observation has no source-shaped reference")
        key = (reference, digest(rows), digest(value))
        if key in observed:
            return
        raster_hash = sha(json.dumps(rows, separators=(",", ":")).encode())[:16]
        packet = SimpleNamespace(frame_rows=rows, level=value["level_epoch"], levels_completed=value["levels_completed"],
                                 state=value["state"], available_action_refs=value["available_action_refs"], frame_hash=raster_hash)
        measured = plain(measure(packet, value["revision"], match[1])[0])
        diff = differences(measured, value, f"calls[{call_index}].public.{side}")
        result["differences"].extend(diff)
        result["publicObservationChecks"].append({"callIndex": call_index, "side": side, "observationRef": reference,
                                                  "rasterDigest": digest(rows), "originalObservationDigest": digest(measured),
                                                  "capturedObservationDigest": digest(value), "differences": len(diff)})
        observed[key] = True

    def ablate_history(call_index, arguments, state_before, actual):
        if not state_before["history"]:
            return
        retained = deepcopy(state_before)
        unmodified = family_class(); unmodified.restore(deepcopy(retained))
        restored_result = plain(unmodified.propose(*deepcopy(arguments)))
        restoration_diff = differences(actual, restored_result, f"calls[{call_index}].sourceRestoration")
        result["differences"].extend(restoration_diff)
        altered = deepcopy(retained); removed = altered["history"]; altered["history"] = []
        counterfactual = family_class(); counterfactual.restore(altered)
        item = {
            "callIndex": call_index, "intervention": "remove_acquired_feedback_history",
            "stateOrigin": "Only original state acquired/computed by the cold public-call replay before this proposal",
            "nativeStateSeed": False, "sourceStateBeforeDigest": digest(retained), "ablatedStateBeforeDigest": digest(altered),
            "removedFeedbackRows": len(removed), "removedEvidenceRefs": [row["ref"] for row in removed],
            "retainedBoundTrial": retained["last"] is not None,
            "allOtherOwnerFieldsPreserved": all(retained[key] == altered[key] for key in STATE_FIELDS - {"history"}),
            "unmodifiedRestorationProposalEqual": not restoration_diff,
            "actualDecision": decision(actual), "actualAccounting": accounting(actual), "actualProposalDigest": digest(actual),
            "scope": "Source-component counterfactual at the same captured public context. Current revealed ranks and any already bound trial remain. No new game run, full-caller ablation or success guarantee.",
        }
        try:
            alternate = plain(counterfactual.propose(*deepcopy(arguments)))
            item.update(executed=True, counterfactualDecision=decision(alternate), counterfactualAccounting=accounting(alternate),
                        counterfactualProposalDigest=digest(alternate), counterfactualSourceAfterDigest=digest(counterfactual.state()),
                        counterfactualDiagnostic=plain(getattr(counterfactual, "last_diagnostic", None)),
                        actionOrRefusalChanged=action_or_refusal(actual) != action_or_refusal(alternate),
                        orderedTrialChanged=decision(actual)["orderedTrial"] != decision(alternate)["orderedTrial"],
                        hypothesisAccountingChanged=accounting(actual) != accounting(alternate),
                        strictProposalChanged=actual != alternate)
        except Exception as error:
            item.update(executed=False, error=exception(error), actionOrRefusalChanged=None,
                        orderedTrialChanged=None, hypothesisAccountingChanged=None, strictProposalChanged=None)
        result["ablations"].append(item)

    for index, call in enumerate(calls):
        try:
            if call.get("index") != index:
                raise ValueError("Feedback call indices are not complete and ordered from zero")
            if "error" in call:
                raise ValueError("A native captured call failed: " + json.dumps(call["error"]))
            method, arguments = call.get("method"), deepcopy(call.get("arguments"))
            if not isinstance(arguments, list) or method not in ("propose", "record"):
                raise ValueError("Unsupported captured Feedback call surface")
            state_before = plain(family.state())
            before_diff = differences(state_before, call.get("sourceBefore"), f"calls[{index}].stateBefore")
            result["differences"].extend(before_diff)
            if method == "propose":
                if len(arguments) != 4:
                    raise ValueError("Source propose must receive exactly four public arguments")
                observation, rows, inputs, remaining = arguments
                public_observation(observation, rows, index, "current")
                returned = family.propose(observation, rows, inputs, remaining)
                counts["nonNullProposals" if returned is not None else "abstentions"] += 1
            else:
                if not 5 <= len(arguments) <= 7:
                    raise ValueError("Source record must receive its five public arguments and optional selected proposal/index")
                before, after, command, first, second = arguments[:5]
                public_observation(before, first, index, "before")
                public_observation(after, second, index, "after")
                transition = (before["observation_ref"], after["observation_ref"], digest(command))
                if transition in record_keys:
                    raise ValueError("The same actual Feedback transition was acquired more than once")
                record_keys.add(transition)
                selected = len(arguments) >= 6 and arguments[5] is not None
                if selected and (arguments[5].get("kind") != "public_feedback_sequence" or "feedback_plan" not in arguments[5]):
                    raise ValueError("Passive Feedback acquisition received a foreign selected proposal")
                counts["selectedRecords" if selected else "passiveRecords"] += 1
                returned = family.record(*arguments)
            returned = plain(returned)
            state_after = plain(family.state())
            return_diff = differences(returned, call.get("result"), f"calls[{index}].result")
            after_diff = differences(state_after, call.get("sourceAfter"), f"calls[{index}].stateAfter")
            result["differences"].extend(return_diff + after_diff)
            if method == "record":
                counts["recordStatus:" + str(returned.get("status"))] += 1
            counts[method] += 1
            if call.get("selectionEntry") is not None:
                counts["selectionEntry:" + str(call["selectionEntry"])] += 1
            result["callChecks"].append({
                "index": index, "method": method, "nativeMethod": call.get("nativeMethod"),
                "selectionEntry": call.get("selectionEntry"), "argumentDigest": digest(arguments),
                "sourceBeforeDigest": digest(state_before), "sourceAfterDigest": digest(state_after),
                "nativeBeforeDigest": digest(call.get("sourceBefore")), "nativeAfterDigest": digest(call.get("sourceAfter")),
                "sourceResult": returned, "sourceResultDigest": digest(returned), "nativeResultDigest": digest(call.get("result")),
                "beforeDifferences": len(before_diff), "resultDifferences": len(return_diff), "afterDifferences": len(after_diff),
                "sourceHistoryRowsBefore": len(state_before["history"]), "sourceHistoryRowsAfter": len(state_after["history"]),
                "methodWithoutLayoutAfter": state_after["entry_method"] is not None and state_after["layout"] is None,
            })
            if method == "propose":
                ablate_history(index, arguments, state_before, returned)
        except Exception as error:
            result["stop"] = {"kind": "source_replay_exception", "callIndex": index, "error": exception(error)}
            break
    result["counts"] = dict(counts)
    result["callsExpected"] = len(calls)
    result["callsCompared"] = len(result["callChecks"])
    result["finalSourceState"] = plain(family.state())
    result["ablationCounts"] = {
        "total": len(result["ablations"]),
        "executed": sum(item["executed"] for item in result["ablations"]),
        "errors": sum(not item["executed"] for item in result["ablations"]),
        **{key: sum(item.get(key) is True for item in result["ablations"])
           for key in ("actionOrRefusalChanged", "orderedTrialChanged", "hypothesisAccountingChanged", "strictProposalChanged")},
        "actionAndTrialUnchanged": sum(item["executed"] and not item["actionOrRefusalChanged"] and not item["orderedTrialChanged"] for item in result["ablations"]),
    }
    result["componentParityPassed"] = result["stop"] is None and not result["differences"] and result["callsCompared"] == result["callsExpected"]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("campaign", type=Path, help="Completed campaign report with feedbackSourceCalls")
    parser.add_argument("--output", required=True, type=Path, help="New gzip JSON comparison report")
    args = parser.parse_args()
    campaign_path, output = args.campaign.resolve(), args.output.resolve()
    if output == campaign_path or output.exists():
        parser.error("Output must be a new path; existing campaign/comparison evidence is never overwritten")
    if not output.name.endswith(".json.gz"):
        parser.error("Output must end with .json.gz")
    started = datetime.now(timezone.utc).isoformat()
    inputs = {"campaign": fingerprint(campaign_path), "generator": fingerprint(Path(__file__).resolve()), "manifest": fingerprint(MANIFEST)}
    report = {"schema": "logos-engine.feedback-public-source-parity.v1", "startedAt": started,
              "sourceCommit": COMMIT, "inputs": inputs, "game": None,
              "scope": "Cold unchanged original FeedbackSequences component over the captured public-call stream; not full original caller parity, a new game campaign, a global performance verdict or complete V5 migration.",
              "gameHostRun": False, "nativeAgentRun": False, "originalCommonCallerRun": False}
    try:
        report["sourceBefore"] = verify_originals()
        # Verification occurs before importing any original code.
        sys.path[:0] = [str(SOURCE / "agents/yf_arc3_v6/laya_proto"), str(SOURCE)]
        from agents.yf_arc3_v6.morphology_policy.feedback_sequences.family import FeedbackSequences
        from neutral_observer import measure
        campaign = read_json(campaign_path)
        report["game"] = campaign.get("game")
        report["nativeSource"] = campaign.get("source")
        report["campaignFinal"] = campaign.get("final")
        report["replay"] = compare_campaign(campaign, FeedbackSequences, measure)
    except Exception as error:
        report["error"] = exception(error)
    try:
        report["sourceAfter"] = verify_originals()
        report["originalsUnchanged"] = report.get("sourceBefore") == report["sourceAfter"]
    except Exception as error:
        report["sourceVerificationError"] = exception(error)
        report["originalsUnchanged"] = False
    report["inputsAfter"] = {"campaign": fingerprint(campaign_path), "generator": fingerprint(Path(__file__).resolve()), "manifest": fingerprint(MANIFEST)}
    report["inputsUnchanged"] = report["inputs"] == report["inputsAfter"]
    replay = report.get("replay", {})
    report["status"] = "passed" if not report.get("error") and report["originalsUnchanged"] and report["inputsUnchanged"] and replay.get("componentParityPassed") and replay.get("ablationCounts", {}).get("errors") == 0 else "failed"
    report["completedAt"] = datetime.now(timezone.utc).isoformat()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("xb") as stream:
        stream.write(gzip.compress(encoded(report) + b"\n", mtime=0))
    print(json.dumps({"status": report["status"], "output": path_label(output), "sourceFilesVerifiedBefore": report.get("sourceBefore", {}).get("filesVerified"),
                      "sourceFilesVerifiedAfter": report.get("sourceAfter", {}).get("filesVerified"), "originalsUnchanged": report["originalsUnchanged"],
                      "callsCompared": replay.get("callsCompared", 0), "callsExpected": replay.get("callsExpected", 0),
                      "counts": replay.get("counts", {}), "differences": len(replay.get("differences", [])),
                      "ablations": replay.get("ablationCounts", {}), "stop": replay.get("stop"), "error": report.get("error")}, indent=2))
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
