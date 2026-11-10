#!/usr/bin/env python3
"""Development-only differential oracle for unchanged V6 FeedbackSequences.

Synthetic public interfaces exercise source contracts without a game identifier,
engine introspection, prepared solution, or hidden value entering the family.
The tiny fixture environment owns its answer; exports contain public frames,
measured observations, actions, source returns and preserved source state only.
This is component/source evidence, not common-caller or game-success evidence.
"""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
import gzip
import hashlib
import itertools
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
REF = ROOT / "reference/v6" / COMMIT / "source"
sys.path[:0] = [str(REF / "agents/yf_arc3_v6/laya_proto"), str(REF)]
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from agents.yf_arc3_v6.morphology_policy.feedback_sequences.family import FeedbackSequences
from agents.yf_arc3_v6.morphology_policy.feedback_sequences.finite import choose
from agents.yf_arc3_v6.morphology_policy.feedback_sequences.visual import initial_layout, palette, feedback
from agents.yf_arc3_v5.capabilities.feedback_code_identification import FeedbackAccountingLaw, _feedback

SCOPE = "original-feedback-synthetic"


def plain(value):
    return json.loads(json.dumps(value, separators=(",", ":")))


def packet(rows, revision=0, epoch=1, completed=0, controls=None):
    return SimpleNamespace(
        frame_rows=deepcopy(rows), frame_packet=[deepcopy(rows)], level=epoch,
        levels_completed=completed, state="NOT_FINISHED", step_index=revision,
        available_action_refs=controls or ["ACTION5", "ACTION6"],
        frame_hash=hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16],
    )


def observe(public):
    return measure(public, public.step_index, SCOPE)[0]


class Interface:
    """A fixture-only public input/response simulator, independent of the port."""

    def __init__(self, repeatable=True, answer=(4, 6, 3), dx=0, dy=0, distinguished=True, active_order=1):
        self.alphabet = [3, 4, 6, 7]
        self.xs = [6 + dx + i * 9 for i in range(4)]
        self.palette_y = 8 + dy
        self.slot_ys = [22 + dy, 34 + dy]
        self.history_ys = [45 + dy, 54 + dy]
        self.size = 5
        self.length = 3
        self.active_order = active_order
        self.current = []
        self.revealed = [None] * self.length
        self.history = []
        self.repeatable = repeatable
        self.distinguished = distinguished
        self._answer = list(answer)
        self.revision = 0
        self.epoch = 1
        self.completed = 0

    def available(self):
        return self.alphabet if self.repeatable else [v for v in self.alphabet if v not in self.current]

    def rows(self):
        rows = [[0] * 64 for _ in range(64)]

        def fill(x, y, value, style=None):
            for yy in range(y, y + self.size):
                rows[yy][x:x + self.size] = [value] * self.size
            if style is not None:
                rows[y - 1][x:x + self.size] = [style] * self.size

        for i, value in enumerate(self.available()):
            fill(self.xs[i], self.palette_y, value, 9 if self.distinguished and i == 0 else 8)
        for row_index, y in enumerate(self.slot_ys):
            values = self.current + [1] * (self.length - len(self.current)) if row_index == self.active_order else [2 if v is None else v for v in self.revealed]
            for x, value in zip(self.xs, values):
                fill(x, y, value)
        for history_index, (trial, marks) in enumerate(self.history[-2:]):
            for x, value, mark in zip(self.xs, trial, marks):
                fill(x, self.history_ys[history_index], value, mark)
        return rows

    def public(self):
        return packet(self.rows(), self.revision, self.epoch, self.completed)

    def act(self, command):
        data = command.get("data", {})
        if command["action_ref"] == "ACTION6":
            x, y = data["x"], data["y"]
            if self.palette_y <= y < self.palette_y + self.size:
                matches = [i for i, xx in enumerate(self.xs[:len(self.available())]) if xx <= x < xx + self.size]
                if len(matches) == 1 and len(self.current) < self.length:
                    self.current.append(self.available()[matches[0]])
            elif self.slot_ys[self.active_order] <= y < self.slot_ys[self.active_order] + self.size:
                matches = [i for i, xx in enumerate(self.xs[:len(self.current)]) if xx <= x < xx + self.size]
                if len(matches) == 1:
                    self.current = self.current[:matches[0]]
        elif command["action_ref"] == "ACTION5" and len(self.current) == self.length:
            # Independent Mastermind accounting: reserve exact ranks first.
            unused = list(self._answer)
            marks = [14] * self.length
            for i, v in enumerate(self.current):
                if v == self._answer[i]:
                    marks[i] = 12
                    unused.remove(v)
                    self.revealed[i] = v
            for i, v in enumerate(self.current):
                if marks[i] != 12 and v in unused:
                    marks[i] = 13
                    unused.remove(v)
            self.history.append((list(self.current), marks))
            self.current = []
        self.revision += 1


def source_step(family, world, *, passive=False, forced=None):
    before = world.public()
    observation = observe(before)
    domain = ObservedInputDomain(250)
    inputs = domain.candidates(observation)
    state_before = family.state()
    proposal = family.propose(observation, before.frame_rows, inputs, 120 - world.revision)
    case = {
        "stateBefore": state_before, "beforePublic": vars(before), "beforeObservation": observation,
        "inputs": inputs, "remaining": 120 - world.revision, "proposal": deepcopy(proposal),
        "stateAfterPropose": family.state(),
    }
    if proposal is None and forced is None:
        return plain(case)
    command = forced or proposal["actions"][0]
    if proposal:
        family.bind(proposal, domain)
        case["boundProposal"] = deepcopy(proposal)
        case["beforeGuard"] = family.before(proposal, 0, before, observation)
    world.act(command)
    after = world.public()
    after_observation = observe(after)
    if proposal and forced is None:
        case["afterGuard"] = family.after(proposal, 0, observation, after_observation, before.frame_rows, after.frame_rows)
    case.update({
        "command": command, "passive": passive, "afterPublic": vars(after), "afterObservation": after_observation,
        "record": family.record(observation, after_observation, command, before.frame_rows, after.frame_rows, None if passive else proposal, 0),
        "stateAfter": family.state(),
    })
    return plain(case)


def record_case(label, family, before, after, command, proposal=None):
    observation, after_observation = observe(before), observe(after)
    state_before = family.state()
    result = family.record(observation, after_observation, command, before.frame_rows, after.frame_rows, proposal, 0)
    inputs = ObservedInputDomain(250).candidates(after_observation)
    state_after = family.state()
    next_proposal = family.propose(after_observation, after.frame_rows, inputs, 80)
    return plain({
        "id": label, "stateBefore": state_before, "beforePublic": vars(before), "beforeObservation": observation,
        "afterPublic": vars(after), "afterObservation": after_observation, "command": command,
        "proposal": proposal, "record": result, "stateAfter": state_after, "nextInputs": inputs,
        "nextRemaining": 80, "nextProposal": next_proposal, "stateAfterNext": family.state(),
    })


def family_cases():
    sessions, snapshots = [], {}
    for repeatable in (True, False):
        world, family = Interface(repeatable=repeatable), FeedbackSequences()
        steps = []
        for _ in range(18):
            item = source_step(family, world)
            steps.append(item)
            if "record" not in item:
                break
            if len(family.entry_evidence) >= 2 and len(world.current) == 2 and "two" not in snapshots and repeatable:
                snapshots["two"] = (deepcopy(world), family.state())
            if family.history and "feedback" not in snapshots and repeatable:
                snapshots["feedback"] = (deepcopy(world), family.state())
            if len(family.history) >= 2:
                break
        sessions.append({"id": "repeatable" if repeatable else "compacting", "steps": steps})
        if repeatable:
            snapshots["learned"] = (deepcopy(world), family.state())

    assert all(len(s["steps"]) > 3 for s in sessions), "The original must acquire an actual interface"
    assert "two" in snapshots and "feedback" in snapshots, "Source feedback acquisition was not reached"
    cases = []
    unmarked = Interface(distinguished=False)
    family = FeedbackSequences()
    # Actions chosen by the common factory on this unmarked public interface:
    # its first ordinary control is stationary, then it probes value4's locus.
    # The original family is only a passive observer for these two responses.
    stationary = source_step(family, unmarked, passive=True, forced={"action_ref": "ACTION5", "data": {}})
    passive = source_step(family, unmarked, passive=True, forced={"action_ref": "ACTION6", "data": {"x": unmarked.xs[1] + 2, "y": unmarked.palette_y + 2}})
    assert stationary["proposal"] is None and stationary["record"]["status"] == "no_bound_sequence_effect"
    assert passive["proposal"] is None and passive["record"]["status"] == "observed_append"
    sessions.append({"id": "passive-unmarked-append", "steps": [stationary, passive, source_step(family, unmarked)]})
    # These two worlds have identical public frames/actions through submission.
    # Their first revealed rank is also identical: only public feedback differs.
    for label, answer in [("discriminant-a", (3, 3, 3)), ("discriminant-b", (3, 3, 4))]:
        world, family = Interface(answer=answer), FeedbackSequences()
        steps = [source_step(family, world) for _ in range(8)]
        assert all("record" in step for step in steps)
        sessions.append({"id": label, "steps": steps})
    branch_a, branch_b = sessions[-2:]
    assert branch_a["steps"][3]["beforePublic"] == branch_b["steps"][3]["beforePublic"]
    assert branch_a["steps"][4]["proposal"]["feedback_plan"]["selection"]["trial"] != branch_b["steps"][4]["proposal"]["feedback_plan"]["selection"]["trial"]

    # Suffix clear is an observed result of a currently bound row point.
    world, state = deepcopy(snapshots["two"])
    family = FeedbackSequences(); family.restore(state)
    before = world.public()
    command = {"action_ref": "ACTION6", "data": {"x": world.xs[1] + 2, "y": world.slot_ys[world.active_order] + 2}}
    world.act(command)
    cases.append(record_case("observed-suffix-clear", family, before, world.public(), command))

    # Same added value, conflicting palette behavior refutes the learned protocol.
    world, state = deepcopy(snapshots["two"])
    family = FeedbackSequences(); family.restore(state)
    before = world.public()
    command = {"action_ref": "ACTION6", "data": {"x": world.xs[2] + 2, "y": world.palette_y + 2}}
    world.act(command); world.repeatable = False
    cases.append(record_case("entry-protocol-refuted", family, before, world.public(), command))

    # A full submission with two matching public response rows stays ambiguous.
    world, state = deepcopy(snapshots["two"])
    family = FeedbackSequences(); family.restore(state)
    while len(world.current) < 3:
        source_step(family, world)
    before = world.public(); command = {"action_ref": "ACTION5", "data": {}}
    world.act(command); world.history.append(deepcopy(world.history[-1]))
    cases.append(record_case("ambiguous-feedback-not-acquired", family, before, world.public(), command))

    # Unchanged public response remains distinct from an entry-protocol refutation.
    world, state = deepcopy(snapshots["two"])
    family = FeedbackSequences(); family.restore(state)
    before = world.public(); world.revision += 1
    cases.append(record_case("no-bound-sequence-effect", family, before, world.public(), {"action_ref": "ACTION5", "data": {}}))

    # An official boundary preserves only the portable hypothesis and its evidence.
    old_world, learned = deepcopy(snapshots["learned"])
    family = FeedbackSequences(); family.restore(learned)
    before = old_world.public()
    relocated = Interface(dx=2, dy=1, distinguished=False)
    relocated.epoch = 2; relocated.completed = 1; relocated.revision = old_world.revision + 1
    boundary_after = relocated.public()
    observation, after_observation = observe(before), observe(boundary_after)
    boundary_result = family.record(observation, after_observation, {"action_ref": "ACTION5", "data": {}}, before.frame_rows, boundary_after.frame_rows)
    boundary_state = family.state()
    assert boundary_state["layout"] is None and boundary_state["entry_method"], "Portable method must survive without layout"
    cases.append(plain({"id": "official-boundary-method-only", "stateBefore": learned, "beforePublic": vars(before), "beforeObservation": observation,
                        "afterPublic": vars(boundary_after), "afterObservation": after_observation, "command": {"action_ref": "ACTION5", "data": {}},
                        "proposal": None, "record": boundary_result, "stateAfter": boundary_state}))
    for label, active_order, no_effect in [("recalled-method-confirmed", 1, False), ("recalled-row-role-refuted", 0, False), ("recalled-method-no-effect-refuted", 1, True)]:
        world = Interface(dx=2, dy=1, distinguished=False, active_order=active_order)
        world.epoch = 2; world.completed = 1; world.revision = relocated.revision
        family = FeedbackSequences(); family.restore(boundary_state)
        before = world.public(); obs = observe(before); inputs = ObservedInputDomain(250).candidates(obs)
        proposal = family.propose(obs, before.frame_rows, inputs, 80)
        assert proposal and proposal["feedback_plan"]["selection"].get("recalled_entry"), label
        state_after_propose = family.state()
        if no_effect:
            world.revision += 1
        else:
            world.act(proposal["actions"][0])
        cases.append(record_case(label, family, before, world.public(), proposal["actions"][0], proposal))
        cases[-1]["methodOnlyState"] = plain(boundary_state)
        cases[-1]["recalledInputs"] = inputs
        cases[-1]["stateAfterRecallPropose"] = plain(state_after_propose)

    # Guards use the measured palette and exact currently filled prefix.
    world, state = deepcopy(snapshots["two"])
    family = FeedbackSequences(); family.restore(state)
    current = world.public(); obs = observe(current); domain = ObservedInputDomain(250)
    inputs = domain.candidates(obs); proposal = family.propose(obs, current.frame_rows, inputs, 80)
    assert proposal and len(proposal["actions"]) >= 1
    guards = []
    for label in ("current", "palette-value-changed", "palette-locus-moved", "prefix-changed", "action-unavailable", "epoch-changed"):
        modified = deepcopy(current)
        if label == "palette-value-changed":
            for yy in range(world.palette_y, world.palette_y + 5):
                modified.frame_rows[yy][world.xs[0]:world.xs[0] + 5] = [10] * 5
        elif label == "palette-locus-moved":
            for yy in range(world.palette_y, world.palette_y + 5):
                modified.frame_rows[yy][world.xs[0]:world.xs[0] + 6] = [0] + [world.alphabet[0]] * 5
        elif label == "prefix-changed":
            for yy in range(world.slot_ys[world.active_order], world.slot_ys[world.active_order] + 5):
                modified.frame_rows[yy][world.xs[0]:world.xs[0] + 5] = [7] * 5
        elif label == "action-unavailable":
            modified.available_action_refs = ["ACTION5"]
        elif label == "epoch-changed":
            modified.level = 2
        guards.append({"id": label, "public": vars(modified), "expected": family.before(proposal, 0, modified, obs)})
    guard_case = plain({"stateBefore": state, "observation": obs, "inputs": inputs, "remaining": 80, "proposal": proposal, "cases": guards})

    refusals = []
    for label, world in [("no-distinctive-entry-without-method", Interface(distinguished=False)), ("initial-entry", Interface())]:
        family = FeedbackSequences(); public = world.public(); obs = observe(public); inputs = ObservedInputDomain(250).candidates(obs)
        refusals.append(plain({"id": label, "public": vars(public), "observation": obs, "inputs": inputs,
                               "layout": initial_layout(obs), "palette": palette(obs, initial_layout(obs)),
                               "proposal": family.propose(obs, public.frame_rows, inputs, 80), "state": family.state()}))
    return sessions, cases, guard_case, refusals


def finite_cases(configuration):
    observation = {"observation_ref": "finite-public-observation", "level_epoch": 3}
    base = dict(alphabet=[3, 4, 6], length=3, prefix=[], history=[], revealed=[None] * 3,
                repeatable=True, observation=observation, budget=80, configuration=configuration)
    cases = []

    def add(label, **changes):
        args = deepcopy(base); args.update(changes)
        result = choose(**args)
        cases.append({"id": label, "arguments": args, "expected": result})
        return result

    add("unobserved-mark-renaming-symmetry", prefix=[3])
    add("palette-removal-is-not-secret-uniqueness", prefix=[3], repeatable=False)
    law = FeedbackAccountingLaw(law_ref="fixture-only", exact_ref="exact", elsewhere_ref="elsewhere", absent_ref="absent", allocation_order="LEFT_TO_RIGHT")
    trial = [3, 4, 6]
    discriminants = []
    for answer in itertools.product(base["alphabet"], repeat=3):
        marks = list(_feedback(answer, trial, law))
        history = [{"ref": "public-feedback-1", "values": trial, "marks": marks}]
        revealed = [v if v == answer[i] else None for i, v in enumerate(trial)]
        args = {**base, "history": history, "revealed": revealed}
        result = choose(**args)
        if result.get("status") == "proposed" and all(result["trial"] != item["expected"]["trial"] for item in discriminants):
            discriminants.append({"id": "discriminating-public-return-" + str(len(discriminants) + 1), "arguments": args, "expected": result})
        if len(discriminants) == 2:
            break
    assert len(discriminants) == 2
    cases.extend(discriminants)
    history = discriminants[0]["arguments"]["history"]
    add("candidate-domain-bound", configuration={**configuration, "maximum_candidates": 2})
    add("trial-domain-bound", configuration={**configuration, "maximum_trials": 1})
    add("candidate-evaluation-bound", history=history, configuration={**configuration, "maximum_evaluations": 1})
    add("partition-evaluation-bound", configuration={**configuration, "maximum_evaluations": 40})
    add("input-budget-refusal", budget=2)
    add("preserved-prefix-no-legal-removal-trial", prefix=[3, 3], repeatable=False)
    add("unsupported-four-feedback-classes", history=[{"ref": "style1", "values": [3, 4, 6], "marks": ["a", "b", "c"]}, {"ref": "style2", "values": [3, 4, 6], "marks": ["a", "b", "d"]}])
    add("same-trial-incompatible-public-returns", history=[{"ref": "feedback1", "values": [3, 4, 6], "marks": ["a", "a", "a"]}, {"ref": "feedback2", "values": [3, 4, 6], "marks": ["b", "b", "b"]}])
    add("duplicate-allocation-alternatives", history=[{"ref": "duplicated-trial", "values": [3, 3, 4], "marks": ["a", "b", "c"]}])
    return plain(cases)


def main():
    family = FeedbackSequences()
    sessions, records, guards, initial = family_cases()
    source_names = ["family.py", "finite.py", "visual.py", "feedback_sequences.drm", "feedback_sequences.src"]
    paths = [REF / "agents/yf_arc3_v6/morphology_policy/feedback_sequences" / name for name in source_names]
    paths += [REF / "agents/yf_arc3_v5/capabilities" / name for name in ("feedback_code_identification.py", "code_history_d.py", "code_history_contracts_d.py")]
    sources = {str(p.relative_to(REF)): {"bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths}
    fixture = {
        "provenance": {"commit": COMMIT, "sources": sources, "scope": "Unmodified Python component source and finite V5 dependency; synthetic public transitions, not router/game parity.",
                       "limitations": ["Selected/passive common-caller ordering requires separate integration evidence.", "No real game victory is asserted by these synthetic fixtures.", "Reference entry evidence is not internally deduplicated; the common caller must avoid duplicate acquisition.", "Source method_only state is persistent even with layout absent."]},
        "configuration": family.configuration, "finite": finite_cases(family.configuration),
        "sessions": sessions, "records": records, "guards": guards, "initial": initial,
    }
    out = ROOT / "tests/fixtures/v6-feedback-sequences-reference.json.gz"
    out.write_bytes(gzip.compress((json.dumps(fixture, separators=(",", ":")) + "\n").encode(), mtime=0))
    print(json.dumps({"file": str(out), "bytes": out.stat().st_size, "finite_cases": len(fixture["finite"]),
                      "sessions": [{"id": s["id"], "steps": len(s["steps"]), "events": [x.get("record", {}).get("status") for x in s["steps"]]} for s in sessions],
                      "records": [{"id": r["id"], "status": r["record"]["status"]} for r in records]}, indent=2))


if __name__ == "__main__":
    main()
