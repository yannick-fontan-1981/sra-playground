#!/usr/bin/env python3
"""Verify completed live Feedback evidence and close its cumulative case clock.

Run after the ordinary live phase AND compare-feedback-public-parity.py finish.
All paths are explicit, repository-confined inputs. The exclusive JSON output
must be inside the declared freeze. No game, agent, test or source replay runs.
Large campaign/trace/parity documents are read only when this script executes.
A failed validation preserves a failed receipt and does not pause the clock.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
import gzip
import importlib.util
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
SCHEMA = "logos-engine.feedback-live-contribution.v1"
HELPERS = {
    "delivery": "scripts/verify-native-delivery.py",
    "comparison": "scripts/compare-v54-regressions.py",
    "feedback": "scripts/compare-feedback-public-parity.py",
}
SCOPE = (
    "Public live-report coherence and cold original FeedbackSequences component parity over captured arguments. "
    "The original common caller is not run. This verifier does not recompute counterfactual proposals: it checks "
    "the complete ablation inventory, retained views, flags and provenance of the existing source comparator. "
    "Local decision dependence does not establish whole-game causal improvement, full-game completion, "
    "full V6 parity or a performance comparison. No replay-only regression field is synthesized."
)


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def moment(value):
    result = datetime.fromisoformat(value)
    if result.tzinfo is None or result.utcoffset() is None:
        raise ValueError("A clock timestamp must include its time zone")
    return result.astimezone(timezone.utc)


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("Expected a finite numeric clock value")
    result = Decimal(str(value))
    if not result.is_finite():
        raise ValueError("Expected a finite numeric clock value")
    return result


def seconds(delta):
    return Decimal(delta.days * 86400 + delta.seconds) + Decimal(delta.microseconds) / 1_000_000


class Audit:
    def __init__(self, args, helpers):
        self.d, self.c, self.f = helpers
        self.p = self.c.PROOF
        self.args, self.inputs, self.checks = args, {}, 0
        self.clock = None
        self.receipt = {"schema": SCHEMA, "status": "failed", "scope": SCOPE,
                        "startedAt": datetime.now(timezone.utc).isoformat(), "checks": [],
                        "newGameRun": False, "sourceReplayRepeated": False}

    def require(self, condition, message):
        self.checks += 1
        if not condition:
            raise ValueError(message)

    def equal(self, actual, expected, label):
        self.require(self.f.encoded(actual) == self.f.encoded(expected), label)

    def path(self, value):
        return self.d.confined(value)

    def file(self, path):
        path = self.path(path)
        record = self.d.fingerprint(path)
        previous = self.inputs.setdefault(record["path"], record)
        self.equal(record, previous, "Input changed while being read: " + record["path"])
        return record

    def read(self, path):
        path = self.path(path)
        self.file(path)
        if path.suffix != ".gz":
            return self.d.read_json(path)
        with gzip.open(path, "rt", encoding="utf-8") as stream:
            return json.load(stream, object_pairs_hook=self.d.unique_object, parse_constant=self.d.invalid_constant)

    def recorded(self, record, expected=None):
        path = self.d.check_record(record)
        if expected is not None:
            self.equal(path.as_posix(), self.path(expected).as_posix(), "Unexpected evidence path")
        self.equal(self.file(path), record, "Recorded file fingerprint differs")
        return path

    def stage(self, name, action):
        before = self.checks
        entry = {"name": name, "status": "passed"}
        try:
            action()
        except Exception as error:
            entry.update(status="failed", error={"type": type(error).__name__, "message": str(error)})
        entry["assertions"] = self.checks - before
        self.receipt["checks"].append(entry)
        return entry["status"] == "passed"

    def selection_and_clock(self):
        self.selection = selection = self.read(self.args.selection)
        self.phase = phase = self.read(self.args.phase_receipt)
        self.require(selection["schema"] == "logos-engine.game-case-selection.v1", "Unsupported selection schema")
        self.require(phase["schema"] == "logos-engine.feedback-case-phase.v1", "Unsupported phase schema")
        maximum, previous = number(selection["maximumCumulativeSeconds"]), number(selection["previousChargedSeconds"])
        start, deadline = moment(selection["selectedAt"]), moment(selection["deadline"])
        self.clock = {"start": start, "deadline": deadline, "maximum": maximum, "previous": previous}
        self.require(0 <= previous < maximum, "Invalid cumulative budget or exhausted inherited budget")
        self.require(abs(seconds(deadline - start) - (maximum - previous)) <= Decimal("0.000001"),
                     "Deadline does not preserve the remaining cumulative budget")
        self.require(start <= datetime.now(timezone.utc) < deadline, "Selected case interval is not active")
        self.require(selection.get("clockReset", False) is False, "The case clock may not be reset")
        if previous:
            prior_path = self.recorded(selection["resumes"])
            prior = self.read(prior_path)
            self.require(prior["game"] == selection["game"], "Resumption changes the selected game")
            if prior["schema"] == SCHEMA:
                closure = prior["budgetClosure"]
                self.require(prior["status"] == "passed" and closure["closed"] is True, "Prior case is not closed successfully")
            else:
                self.require(prior["schema"] == "logos-engine.feedback-case-resolution.v1"
                             and prior["status"] == "target_three_levels_achieved", "Unsupported prior resolution")
                closure = prior
            self.require(closure["clockReset"] is False and number(closure["maximumCumulativeSeconds"]) == maximum
                         and number(closure["cumulativeChargedSeconds"]) == previous,
                         "Prior resolution does not attest the carried budget")
            self.require(moment(closure["resolvedAt"]) <= start, "New interval overlaps the previously closed interval")
            self.receipt["resumes"] = selection["resumes"]
        else:
            self.require(selection.get("resumes") is None, "A resumption cannot discard a previous charged interval")
        self.game = selection["game"]
        self.target = selection["targetLevels"]
        self.require(isinstance(self.game, str) and re.fullmatch(r"[A-Z0-9]{4}", self.game) is not None
                     and type(self.target) is int and 1 <= self.target <= 100, "Invalid declared game or target")
        self.receipt.update(game=self.game, targetLevels=self.target)
        self.declaration = declared = selection["phases"][phase["phase"]]
        self.recorded(phase["selection"], self.args.selection)
        self.recorded(phase["generator"], Path(__file__).with_name("run-case-phase.py"))
        self.require(phase["game"] == self.game and phase["checkout"] == declared["checkout"]
                     and Path(declared["checkout"]).is_absolute(), "Phase does not match its declared origin")
        self.equal(self.path(declared["directory"]).as_posix(), self.args.live_directory.as_posix(), "Live directory differs from selection")
        self.equal(self.path(declared["manifest"]).as_posix(), (self.args.freeze_directory / "source-manifest.json").as_posix(),
                   "Phase does not use the declared freeze")
        self.require(not declared.get("actionCap"), "Expected the ordinary uncapped live campaign")
        self.equal(phase["command"][1:], ["-B", "scripts/run-v53-campaign-proof.py", self.game, str(self.target), declared["directory"]],
                   "Phase did not invoke the ordinary live generator")
        self.require(phase["exitCode"] == 0 and phase["caseDeadlineReached"] is False, "Live phase failed or exhausted its deadline")
        started, finished = moment(phase["startedAt"]), moment(phase["finishedAt"])
        self.require(start <= started <= finished <= deadline, "Phase lies outside the retained case interval")
        expected = previous + seconds(finished - start)
        self.require(abs(number(phase["cumulativeCaseSecondsAtEnd"]) - expected) <= Decimal("0.000001"),
                     "Phase cumulative charge does not include the whole selected wall-clock interval")
        self.recorded(phase["output"])

    def provenance(self):
        live, freeze, stem = self.args.live_directory, self.args.freeze_directory, self.game.lower()
        self.paths = {"campaign": live / f"{stem}-campaign.json.gz", "trace": live / f"{stem}-public-trace.json.gz",
                      "journal": live / f"{stem}-actual-public-journal.jsonl.gz", "execution": live / f"execution-{stem}.json",
                      "manifest": freeze / "source-manifest.json", "liveManifest": live / "source-manifest.json",
                      "archive": freeze / "source-archive.json", "parity": self.args.source_parity}
        self.native = native = self.read(self.paths["manifest"])
        self.equal(self.read(self.paths["liveManifest"]), native, "Live manifest differs from the frozen native source")
        self.equal(self.file(self.paths["manifest"])["sha256"], self.file(self.paths["liveManifest"])["sha256"],
                   "The live and frozen manifests are not byte-identical")
        self.equal(self.p.native_source(), native, "Current native implementation differs from the freeze")
        self.receipt["frozenNativeLink"] = {"nativeSourceDigest": native["digest"], "nativeFileCount": native["fileCount"],
                                            "liveAndFrozenManifestsByteIdentical": True,
                                            "qualification": "The current native tree and passive execution tools are checked against the frozen manifest/archive index. Archive transport bytes remain the responsibility of the existing delivery-integrity verifier."}
        archive = self.read(self.paths["archive"])
        self.require(archive["schema"] == "logos-engine.v53.frozen-source-archive.v1"
                     and archive["nativeSourceManifestDigest"] == native["digest"], "Frozen archive index has a different source")
        for name, digest in native["files"].items():
            self.equal(archive["files"].get(name), digest, "Frozen archive index omits or changes a native file")
        execution = self.execution = self.read(self.paths["execution"])
        self.require(execution["schema"] == "logos-engine.v53.actual-journaled-campaign-execution.v1"
                     and execution["exitCode"] == 0 and execution["nativeSourceUnchanged"] is True
                     and execution["executionCodeUnchanged"] is True, "Live execution failed or changed its inputs")
        for key in ("nativeSource", "nativeSourceAfter"):
            self.equal(execution[key], native, "Execution source differs from the freeze")
        self.equal(execution["nativeSourceManifestDigest"], native["digest"], "Execution manifest digest differs")
        self.equal(execution["executionInputs"], execution["executionInputsAfter"], "Execution tools changed during the live phase")
        tool_names = {"runner": "scripts/run-v53-journaled-campaign.mjs", "harness": "tests/helpers/v6-live-game-campaign.ts",
                      "generator": "scripts/run-v53-campaign-proof.py"}
        self.equal(sorted(execution["executionInputs"]), sorted(tool_names), "Execution input inventory is incomplete")
        for name, path in tool_names.items():
            record = execution["executionInputs"][name]
            self.recorded(record, ROOT / path)
            self.equal(archive["files"].get(path), record["sha256"], "Live tool is not the archived frozen tool")
        origin = Path(self.declaration["checkout"])
        origin_live = origin / self.declaration["directory"]
        self.equal(execution["command"], ["node", str(origin / tool_names["runner"]), self.game, str(self.target),
                   str(origin_live / self.paths["campaign"].name), str(origin_live / self.paths["trace"].name),
                   str(origin.parent / f"v53-{origin_live.name}-{stem}-actual-public-journal.jsonl")], "Unexpected live runner command")
        self.require(moment(self.phase["startedAt"]) <= moment(execution["startedAt"])
                     <= moment(execution["finishedAt"]) <= moment(self.phase["finishedAt"]), "Execution times escape the phase")
        for key, label in (("report", "campaign"), ("trace", "trace"), ("publicJournal", "journal")):
            self.recorded(execution[key], self.paths[label])
        self.recorded(execution["output"], live / f"{stem}-output.log.gz")
        artifacts = self.phase["artifacts"]
        self.require(len({item["path"] for item in artifacts}) == len(artifacts), "Phase artifact paths are duplicated")
        for item in artifacts:
            self.d.confined(self.recorded(item), live)
        required = {self.file(self.paths[key])["path"] for key in ("campaign", "trace", "journal", "execution", "liveManifest")}
        self.require(required <= {item["path"] for item in artifacts}, "Phase artifact inventory omits live evidence")
        self.campaign, self.trace, self.parity = (self.read(self.paths[key]) for key in ("campaign", "trace", "parity"))
        self.receipt["historyAblation"] = {"cases": self.parity.get("replay", {}).get("ablations", []),
                                          "qualification": "All eligible cases are retained, including unchanged decisions and any recorded errors."}
        self.originals = self.f.verify_originals()
        self.receipt["sourceBefore"] = self.originals
        self.receipt["evidence"] = {key: self.file(path) for key, path in self.paths.items()}
        for name, digest in self.campaign["gameAssets"].items():
            self.equal(self.file(self.path("public/python/" + name))["sha256"], digest, "Public game asset differs from execution")

    def public_coherence(self):
        report, trace = self.campaign, self.trace
        self.require(report["schema"] == "logos-engine.v6.integrated-game-campaign.v1" and "recordedPublicReplay" not in report,
                     "Expected a fresh live campaign, not a recorded-public replay")
        self.require(report["status"] == "passed" and report["failure"] is None and report["sourceUnchangedDuringRun"] is True,
                     "Campaign did not finish successfully on unchanged source")
        self.require(report["game"] == self.game and report["targetLevels"] == self.target
                     and report["referenceCommit"] == self.f.COMMIT, "Campaign identity differs from selection/source")
        self.equal(report["source"], self.native, "Campaign does not belong to this freeze")
        self.equal(report["pythonAgentModules"], [], "A Python agent module was loaded in the game host")
        self.require(trace["schema"] == "logos-engine.native-public-game-trace.v1" and trace["game"] == self.game
                     and trace["status"] == report["status"] and trace["sourceDigest"] == self.native["digest"], "Trace identity differs")
        self.actions, self.prefixes, self.packets = report["actions"], report["prefixes"], trace["packets"]
        actions, prefixes, packets = self.actions, self.prefixes, self.packets
        self.require(bool(actions) and len(packets) == len(actions) + 1, "Trace must contain the initial packet and every actual return")
        self.require(packets[0]["command"] is None, "Initial public packet has a command")
        for index, entry in enumerate(packets):
            packet = entry["packet"]
            self.equal(sorted(packet), sorted(self.c.PACKET_KEYS), "Public packet contract changed")
            self.require(packet["step_index"] == index, "Public packet indices are not complete and ordered")
            raster_hash = self.f.sha(json.dumps(packet["frame_rows"], separators=(",", ":")).encode())[:16]
            self.equal(packet["frame_hash"], raster_hash, "Public raster hash differs")
            if not index:
                self.equal(report["initial"], {"publicPacketSha256": self.c.packet_sha(packet), "state": packet["state"],
                           "level": packet["level"], "levelsCompleted": packet["levels_completed"]}, "Initial packet differs from report")
                self.require(packet["level"] == 1 and packet["levels_completed"] == 0, "Live session did not start cold at its first level")
                continue
            action, before = actions[index - 1], packets[index - 1]["packet"]
            expected = {"sequence": index, "command": entry["command"], "levelBefore": before["level"],
                        "completedBefore": before["levels_completed"], "levelAfter": packet["level"],
                        "completedAfter": packet["levels_completed"], "state": packet["state"],
                        "publicPacketSha256": self.c.packet_sha(packet), "frameHash": raster_hash,
                        "animationFrames": len(packet["frame_packet"])}
            self.equal({key: action[key] for key in expected}, expected, "Action and complete public trace disagree")
            self.require(action["command"]["action_ref"] in before["available_action_refs"], "Command was not publicly available")
            self.require(packet["levels_completed"] >= before["levels_completed"], "Public score moved backwards")
        with gzip.open(self.paths["journal"], "rt", encoding="utf-8") as stream:
            count = 0
            for count, line in enumerate(stream, 1):
                self.require(count <= len(packets), "Public journal contains an extra transition")
                self.equal(json.loads(line, object_pairs_hook=self.d.unique_object, parse_constant=self.d.invalid_constant),
                           packets[count - 1], "Actual journal and exported trace differ")
        self.require(count == len(packets), "Public journal is incomplete")
        final, last = report["final"], packets[-1]["packet"]
        for key, value in {"actions": len(actions), "prefixes": len(prefixes), "sessions": 1, "level": last["level"],
                           "levelsCompleted": last["levels_completed"], "state": last["state"]}.items():
            self.equal(final[key], value, "Final report does not match retained public progression")
        self.require(final["levelsCompleted"] >= self.target and final["caller"]["enabled"] is True
                     and final["caller"]["acquiredTransitions"] == len(actions), "Target or common acquisition is incomplete")
        operations = Counter(row["operation"] for row in report["requests"])
        self.equal(dict(operations), final["operationCounts"], "Operation counts differ from requests")
        self.require(operations["init"] == 1 and operations["advance"] == len(actions)
                     and set(operations) <= {"init", "advance", "resume"}, "Unexpected common session operations")
        through, boundaries = 0, []
        for index, prefix in enumerate(prefixes):
            length = prefix["acquiredActions"]
            self.require(type(length) is int and length > 0 and through + length <= len(actions), "Invalid acquired prefix span")
            self.require(prefix["decisionRevision"] == through + 1, "Prefix revision differs from its starting public observation")
            for offset, action in enumerate(actions[through:through + length]):
                self.require(action["decisionRevision"] == prefix["decisionRevision"] and action["actionIndex"] == offset
                             and action["family"] == prefix["family"], "Acquired action does not belong to its declared prefix")
            through += length
            self.require(prefix["callerAcquiredTransitions"] == through, "Prefix common acquisition counter differs")
            action = actions[through - 1]
            if action["completedAfter"] > action["completedBefore"]:
                boundaries.append({"completedLevel": action["completedAfter"], "nativeLevel": action["levelAfter"],
                                   "levelsCompleted": action["completedAfter"], "totalActions": through,
                                   "levelActions": through - (boundaries[-1]["totalActions"] if boundaries else 0),
                                   "prefixCount": index + 1, "sessionRetained": True})
        self.require(through == len(actions), "Some physical actions were not acquired in a sealed prefix")
        self.equal([{key: row[key] for key in boundaries[0]} for row in report["boundaries"]] if boundaries else report["boundaries"],
                   boundaries, "Natural completion boundaries disagree with the acquired public stream")
        self.require(len(boundaries) == self.target, "Declared target boundaries are missing")
        self.receipt["campaignObserved"] = {**{key: final[key] for key in ("actions", "prefixes", "levelsCompleted", "level", "state", "sessions", "reason", "fullV6Parity")},
                                            "publicPackets": len(packets), "journalEntries": count, "boundaries": boundaries,
                                            "callerAcquiredTransitions": final["caller"]["acquiredTransitions"]}

    def feedback_stream(self):
        self.calls = calls = self.campaign["feedbackSourceCalls"]
        self.require(isinstance(calls, list) and bool(calls), "No captured Feedback call stream")
        self.records, self.observations, self.counts = [], [], Counter()
        seen_records, seen_observations = set(), set()
        observation_sessions = set()
        def observation(value, rows, packet_index, call_index, side):
            packet = self.packets[packet_index]["packet"]
            self.equal(rows, packet["frame_rows"], "Feedback raster differs from its independent public packet")
            for name, public_name in (("level_epoch", "level"), ("levels_completed", "levels_completed"), ("state", "state"),
                                      ("frame_hash", "frame_hash"), ("available_action_refs", "available_action_refs")):
                self.equal(value[name], packet[public_name], "Feedback observation metadata differs from the public packet")
            match = self.f.OBSERVATION.fullmatch(value["observation_ref"])
            self.require(match is not None and int(match[2]) == value["level_epoch"] and int(match[3]) == value["revision"]
                         and value["revision"] == packet_index + 1 and match[4] == packet["frame_hash"] and bool(match[1]),
                         "Feedback observation reference is inconsistent with the actual runtime revision")
            observation_sessions.add(match[1])
            self.require(len(observation_sessions) == 1, "Feedback observations changed their cold session identity")
            key = (value["observation_ref"], self.f.digest(rows), self.f.digest(value))
            if key not in seen_observations:
                seen_observations.add(key)
                self.observations.append({"callIndex": call_index, "side": side, "observationRef": key[0], "rasterDigest": key[1],
                                          "originalObservationDigest": key[2], "capturedObservationDigest": key[2], "differences": 0})
        for index, call in enumerate(calls):
            method, args = call["method"], call["arguments"]
            self.require(call["index"] == index and "error" not in call and method in ("propose", "record"), "Incomplete or failed Feedback call")
            self.equal(sorted(call["sourceBefore"]), sorted(self.f.STATE_FIELDS), "Incomplete Feedback state before call")
            self.equal(sorted(call["sourceAfter"]), sorted(self.f.STATE_FIELDS), "Incomplete Feedback state after call")
            if index:
                self.equal(call["sourceBefore"], calls[index - 1]["sourceAfter"], "Feedback owner state changed outside the captured stream")
            cursor = len(self.records)
            if method == "propose":
                self.require(len(args) == 4 and call["nativeMethod"] in ("propose", "proposeInSubquestion"), "Invalid propose surface")
                if call["nativeMethod"] == "proposeInSubquestion":
                    self.require(isinstance(call["selectionEntry"], list) and len(call["selectionEntry"]) == 2, "Missing source selection entry")
                else:
                    self.require(call["selectionEntry"] is None, "Direct propose has an unexpected source selection entry")
                observation(args[0], args[1], cursor, index, "current")
                self.counts["nonNullProposals" if call["result"] is not None else "abstentions"] += 1
            else:
                self.require(5 <= len(args) <= 7 and cursor < len(self.actions) and call["nativeMethod"] == "record"
                             and call["selectionEntry"] is None, "Invalid acquisition surface")
                observation(args[0], args[3], cursor, index, "before")
                observation(args[1], args[4], cursor + 1, index, "after")
                self.equal(args[2], self.actions[cursor]["command"], "Feedback acquired a different physical command")
                key = (args[0]["observation_ref"], args[1]["observation_ref"], self.f.digest(args[2]))
                self.require(key not in seen_records, "Duplicate Feedback acquisition")
                seen_records.add(key)
                selected = len(args) >= 6 and args[5] is not None
                self.require(selected == (self.actions[cursor]["family"] == "feedback_sequences"), "Selected/passive Feedback attribution differs")
                if selected:
                    self.require(args[5].get("kind") == "public_feedback_sequence" and "feedback_plan" in args[5]
                                 and len(args) == 7 and args[6] == self.actions[cursor]["actionIndex"], "Foreign or misindexed selected proposal")
                    self.equal(args[5]["actions"][args[6]], args[2], "Selected Feedback proposal does not own this command")
                self.records.append(call)
                self.counts["selectedRecords" if selected else "passiveRecords"] += 1
                self.counts["recordStatus:" + str(call["result"].get("status"))] += 1
            self.counts[method] += 1
            if call["selectionEntry"] is not None:
                self.counts["selectionEntry:" + str(call["selectionEntry"])] += 1
        self.require(len(self.records) == len(self.actions), "Every physical action must have exactly one Feedback acquisition")
        prefix_checks, through = [], 0
        for prefix in self.prefixes:
            through += prefix["acquiredActions"]
            recorded = self.records[through - 1]
            retained = prefix["observedFeedbackSequence"]
            self.require(retained["stateNode"] == "family_state:feedback_sequences", "Unexpected retained Feedback owner")
            self.equal(retained["state"], recorded["sourceAfter"], "Feedback state was not conserved at the acquired prefix boundary")
            selected = prefix["family"] == "feedback_sequences"
            self.require((retained["proposal"] is not None) == selected, "Prefix proposal is attributed to a foreign Feedback owner")
            if selected:
                commands = [row["command"] for row in self.actions[through - prefix["acquiredActions"]:through]]
                self.equal(retained["proposal"]["actions"][:len(commands)], commands, "Retained Feedback prefix differs from actual actions")
                for call in self.records[through - prefix["acquiredActions"]:through]:
                    self.equal(retained["proposal"], call["arguments"][5], "Full retained Feedback proposal differs from its selected acquisitions")
            prefix_checks.append({"prefix": prefix["id"], "throughAction": through, "throughFeedbackCallIndex": recorded["index"],
                                  "retainedStateEqual": True, "methodWithoutLayout": retained["state"]["layout"] is None
                                  and retained["state"]["entry_method"] is not None})
        self.receipt["capturedStreamCrossChecks"] = {"counts": dict(self.counts), "uniqueAcquisitions": len(seen_records),
                                                    "publicObservations": len(self.observations), "prefixChecks": prefix_checks}
        returns = []
        for ordinal, call in enumerate(self.records, 1):
            if call["result"].get("status") == "observed_submission_feedback":
                following = next((row for row in calls[call["index"] + 1:] if row["method"] == "propose"), None)
                returns.append({"recordCallIndex": call["index"], "actionSequence": ordinal,
                                "observationBefore": call["arguments"][0]["observation_ref"],
                                "observationAfter": call["arguments"][1]["observation_ref"],
                                "boundTrialBefore": call["sourceBefore"]["last"], "command": call["arguments"][2],
                                "returnedFeedback": call["result"], "retainedHistory": call["sourceAfter"]["history"],
                                "nextProposal": {"callIndex": following["index"], "decision": self.f.decision(following["result"]),
                                                 "accounting": self.f.accounting(following["result"])} if following else None})
        self.receipt["publicReturns"] = returns

    def source_parity(self):
        parity, calls = self.parity, self.calls
        self.require(parity["schema"] == "logos-engine.feedback-public-source-parity.v1" and parity["status"] == "passed"
                     and not parity.get("error") and not parity.get("sourceVerificationError"), "Source comparison did not pass completely")
        self.require(parity["game"] == self.game and parity["sourceCommit"] == self.f.COMMIT
                     and parity["gameHostRun"] is False and parity["nativeAgentRun"] is False
                     and parity["originalCommonCallerRun"] is False, "Source comparison scope differs")
        self.equal(parity["nativeSource"], self.native, "Source comparison is for a different freeze")
        self.equal(parity["campaignFinal"], self.campaign["final"], "Source comparison final result differs")
        expected_inputs = {"campaign": self.file(self.paths["campaign"]), "generator": self.file(ROOT / HELPERS["feedback"]),
                           "manifest": self.file(self.f.MANIFEST)}
        self.equal(parity["inputs"], expected_inputs, "Source comparison inputs are not the current retained evidence")
        self.equal(parity["inputsAfter"], expected_inputs, "Source comparison inputs changed")
        self.require(parity["inputsUnchanged"] is True and parity["originalsUnchanged"] is True, "Comparison did not preserve its inputs")
        for key in ("sourceBefore", "sourceAfter"):
            self.equal(parity[key], self.originals, "Pinned original inventory differs from the comparison")
        self.require(moment(self.phase["finishedAt"]) <= moment(parity["startedAt"]) <= moment(parity["completedAt"])
                     <= moment(self.receipt["startedAt"]), "Source comparison chronology differs from the completed live phase")
        replay = parity["replay"]
        self.require(replay["coldStart"] is True and replay["nativeStatesUsedToPrimeSource"] is False
                     and replay["componentParityPassed"] is True and replay["stop"] is None, "Source replay was incomplete or seeded")
        self.equal(replay["normalizations"], [], "Unexpected source receipt normalization")
        self.equal(replay["differences"], [], "Source parity contains differences")
        self.equal(replay["initialSourceState"], calls[0]["sourceBefore"], "Initial owner state is not the cold source state")
        self.equal(replay["finalSourceState"], calls[-1]["sourceAfter"], "Final owner state differs from source replay")
        self.require(replay["callsExpected"] == replay["callsCompared"] == len(calls) == len(replay["callChecks"]), "Source parity omitted calls")
        self.equal(replay["counts"], dict(self.counts), "Source parity call counts differ")
        for call, check in zip(calls, replay["callChecks"]):
            expected = {key: call[key] for key in ("index", "method", "nativeMethod", "selectionEntry")}
            expected.update(argumentDigest=self.f.digest(call["arguments"]), sourceBeforeDigest=self.f.digest(call["sourceBefore"]),
                            nativeBeforeDigest=self.f.digest(call["sourceBefore"]), sourceAfterDigest=self.f.digest(call["sourceAfter"]),
                            nativeAfterDigest=self.f.digest(call["sourceAfter"]), sourceResult=call["result"],
                            sourceResultDigest=self.f.digest(call["result"]), nativeResultDigest=self.f.digest(call["result"]),
                            beforeDifferences=0, resultDifferences=0, afterDifferences=0,
                            sourceHistoryRowsBefore=len(call["sourceBefore"]["history"]), sourceHistoryRowsAfter=len(call["sourceAfter"]["history"]),
                            methodWithoutLayoutAfter=call["sourceAfter"]["entry_method"] is not None and call["sourceAfter"]["layout"] is None)
            self.equal(check, expected, "Source comparison does not attest this complete call/state/return")
        self.equal(replay["publicObservationChecks"], self.observations, "Original public observation remeasurement is incomplete")
        self.receipt["originalParity"] = {"callsCompared": len(calls), "publicObservationsRemeasuredByOriginal": len(self.observations),
                                          "stateBeforeComparisons": len(calls), "stateAfterComparisons": len(calls),
                                          "coldStart": True, "nativeStatesUsedToPrimeSource": False, "normalizations": [],
                                          "fullOriginalCallerRun": False, "sourceCommit": self.f.COMMIT}

    def ablations(self):
        replay = self.parity["replay"]
        eligible = [call for call in self.calls if call["method"] == "propose" and call["sourceBefore"]["history"]]
        cases = replay["ablations"]
        self.equal([case["callIndex"] for case in cases], [call["index"] for call in eligible], "Missing, duplicated or reordered eligible history ablations")
        flags = ("actionOrRefusalChanged", "orderedTrialChanged", "hypothesisAccountingChanged", "strictProposalChanged")
        for call, case in zip(eligible, cases):
            before, actual = call["sourceBefore"], call["result"]
            altered = {**before, "history": []}
            expected = {"intervention": "remove_acquired_feedback_history", "nativeStateSeed": False,
                        "sourceStateBeforeDigest": self.f.digest(before), "ablatedStateBeforeDigest": self.f.digest(altered),
                        "removedFeedbackRows": len(before["history"]), "removedEvidenceRefs": [row["ref"] for row in before["history"]],
                        "retainedBoundTrial": before["last"] is not None, "allOtherOwnerFieldsPreserved": True,
                        "unmodifiedRestorationProposalEqual": True, "actualDecision": self.f.decision(actual),
                        "actualAccounting": self.f.accounting(actual), "actualProposalDigest": self.f.digest(actual), "executed": True}
            self.equal({key: case[key] for key in expected}, expected, "History ablation changes its seed, scope or retained actual result")
            counter = case["counterfactualDecision"]
            expected_flags = {
                "actionOrRefusalChanged": {key: case["actualDecision"][key] for key in ("status", "actions")}
                                          != {key: counter[key] for key in ("status", "actions")},
                "orderedTrialChanged": case["actualDecision"]["orderedTrial"] != counter["orderedTrial"],
                "hypothesisAccountingChanged": case["actualAccounting"] != case["counterfactualAccounting"],
                "strictProposalChanged": case["actualProposalDigest"] != case["counterfactualProposalDigest"],
            }
            self.equal({key: case[key] for key in flags}, expected_flags, "Ablation change flags disagree with retained views/digests")
            self.require(self.d.valid_digest(case["counterfactualProposalDigest"])
                         and self.d.valid_digest(case["counterfactualSourceAfterDigest"]), "Missing counterfactual provenance digest")
        counts = {"total": len(cases), "executed": sum(case["executed"] for case in cases),
                  "errors": sum(not case["executed"] for case in cases),
                  **{key: sum(case[key] is True for case in cases) for key in flags},
                  "actionAndTrialUnchanged": sum(case["executed"] and not case["actionOrRefusalChanged"]
                                                 and not case["orderedTrialChanged"] for case in cases)}
        self.equal(replay["ablationCounts"], counts, "Ablation totals omit or misclassify cases")
        self.receipt["historyAblation"].update(allEligibleContextsRetained=True, counts=counts)
        dependent = counts["actionOrRefusalChanged"] > 0 or counts["orderedTrialChanged"] > 0
        self.receipt["contribution"] = {"status": "local_decision_dependence_observed" if dependent else "local_decision_dependence_not_established",
                                        "selectedAcquisitions": self.counts["selectedRecords"], "passiveAcquisitions": self.counts["passiveRecords"],
                                        "publicSubmissionReturns": self.counts["recordStatus:observed_submission_feedback"],
                                        "actionOrRefusalChanged": counts["actionOrRefusalChanged"], "orderedTrialChanged": counts["orderedTrialChanged"],
                                        "wholeGameCausalImprovementEstablished": False}

    def final_integrity(self):
        self.equal(self.p.native_source(), self.native, "Native implementation changed during verification")
        after = self.f.verify_originals()
        self.receipt["sourceAfter"] = after
        self.equal(after, self.originals, "Pinned original source changed during verification")
        self.receipt["inputsBefore"] = dict(sorted(self.inputs.items()))
        self.receipt["inputsAfter"] = {name: self.d.fingerprint(self.path(name)) for name in sorted(self.inputs)}
        self.equal(self.receipt["inputsAfter"], self.receipt["inputsBefore"], "Verification inputs changed")

    def close(self, verified):
        finished = datetime.now(timezone.utc)
        self.receipt["completedAt"] = finished.isoformat()
        self.receipt.setdefault("inputsBefore", dict(sorted(self.inputs.items())))
        if self.clock is None:
            self.receipt["budgetClosure"] = {"closed": False, "clockReset": False, "reason": "No valid case clock could be established"}
            return
        clock = self.clock
        charged = clock["previous"] + seconds(finished - clock["start"])
        within = charged <= clock["maximum"] and finished <= clock["deadline"]
        self.receipt["budgetClosure"] = {
            "closed": bool(verified and within), "clockReset": False, "selectedAt": clock["start"].isoformat(),
            "deadline": clock["deadline"].isoformat(), "resolvedAt": finished.isoformat() if verified and within else None,
            "verificationFinishedAt": finished.isoformat(), "maximumCumulativeSeconds": float(clock["maximum"]),
            "previousChargedSeconds": float(clock["previous"]), "currentIntervalSeconds": float(seconds(finished - clock["start"])),
            "cumulativeChargedSeconds": float(charged), "remainingSeconds": float(clock["maximum"] - charged),
            "withinBudget": within, "deadlineExhausted": not within,
            "qualification": "All wall time since this selection, including source parity and this verification, is charged. The already closed prior interval is carried intact. A failed receipt leaves the interval open; it does not pause or reset its deadline.",
        }
        self.receipt["status"] = "passed" if verified and within else "failed"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ("live-directory", "freeze-directory", "selection", "phase-receipt", "source-parity", "output"):
        parser.add_argument("--" + option, required=True, type=Path)
    args = parser.parse_args()
    helpers = [load("feedback_live_" + name, path) for name, path in HELPERS.items()]
    delivery = helpers[0]
    for name, value in vars(args).items():
        setattr(args, name, delivery.confined(value))
    delivery.require(args.live_directory.is_dir() and args.freeze_directory.is_dir(), "Missing live/freeze directory")
    delivery.confined(args.output, args.freeze_directory)
    delivery.require(args.output.suffix == ".json" and not args.output.exists() and args.output.parent.is_dir(),
                     "Output must be a new JSON file in an existing directory inside the freeze")
    audit = Audit(args, helpers)
    for path in [Path(__file__), *(ROOT / value for value in HELPERS.values()), ROOT / "scripts/run-v53-campaign-proof.py"]:
        audit.file(path)
    stages = [("selection_and_cumulative_clock", audit.selection_and_clock), ("live_and_frozen_provenance", audit.provenance),
              ("journal_trace_actions_and_common_acquisition", audit.public_coherence), ("feedback_unique_acquisition_and_retained_states", audit.feedback_stream),
              ("complete_cold_original_family_parity", audit.source_parity), ("all_history_ablations", audit.ablations),
              ("unchanged_inputs_and_originals", audit.final_integrity)]
    verified = True
    for name, action in stages:
        if verified:
            verified = audit.stage(name, action)
        else:
            audit.receipt["checks"].append({"name": name, "status": "not_run_after_failure"})
    audit.close(verified)
    with args.output.open("x", encoding="utf-8") as stream:
        json.dump(audit.receipt, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write("\n")
    print(json.dumps({"status": audit.receipt["status"], "output": args.output.relative_to(ROOT).as_posix(),
                      "checks": audit.receipt["checks"], "campaignObserved": audit.receipt.get("campaignObserved"),
                      "contribution": audit.receipt.get("contribution"), "budgetClosure": audit.receipt["budgetClosure"]}, indent=2))
    return 0 if audit.receipt["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
