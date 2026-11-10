#!/usr/bin/env python3
"""Development-only oracle executing the unchanged pinned RelativeArrangements.

Rendered synthetic interfaces are measured by the original public observer.
Abstract planner inputs and intentionally corrupted support observations are
labelled separately. No game, engine, prepared solution or native port is used.
Only failed (a Python set) has a canonical transport order; offer order is exact.
"""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
import argparse
import gzip
import hashlib
import json
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
REF = ROOT / "reference/v6" / COMMIT / "source"
SCOPE = "original-relative-arrangements-synthetic"
sys.path[:0] = [str(REF / "agents/yf_arc3_v6/laya_proto"), str(REF)]
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from agents.yf_arc3_v6.morphology_policy.relative_arrangements.family import RelativeArrangements
from agents.yf_arc3_v6.morphology_policy.relative_arrangements.geometry import rectangles, cell, pads, project, translated_targets, effect
from agents.yf_arc3_v6.morphology_policy.relative_arrangements.planner import assignments, options


def plain(value):
    return json.loads(json.dumps(value, separators=(",", ":")))


def state(family):
    value = plain(family.state())
    value["failed"].sort(key=lambda trial: (tuple(trial[0]), trial[1], tuple(trial[2]), tuple(trial[3])))
    return value


def failed_set(values):
    return {(tuple(t[0]), t[1], tuple(t[2]), tuple(t[3])) for t in values}


def packet(rows, revision=0, epoch=1, completed=0, controls=None):
    return SimpleNamespace(frame_rows=deepcopy(rows), frame_packet=[deepcopy(rows)], level=epoch,
        levels_completed=completed, state="NOT_FINISHED", step_index=revision,
        available_action_refs=["ACTION5", "ACTION6"] if controls is None else list(controls),
        frame_hash=hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16])


def observe(public):
    return measure(public, public.step_index, SCOPE)[0]


class Interface:
    """Small public fixture, with its responses defined independently of policy."""

    def __init__(self):
        self.board = [3, 3, 25, 25]
        self.size = 3
        self.shape = [7, 7]
        self.objects = [{"xy": [1, 1], "value": 3}, {"xy": [5, 4], "value": 12}]
        self.features = [{"xy": [0, 0], "value": 3}, {"xy": [2, 0], "value": 12}]
        self.legends = [[34, 3, 40, 7]]
        self.controls = [{"origin": [34, 18], "shape": [4, 3], "selected": [1, 1]}]
        self.selected = None
        self.extra_selected = []
        self.revision = 0
        self.epoch = 1
        self.completed = 0
        self.available = ["ACTION5", "ACTION6"]
        self.pixel_changes = []

    def rows(self):
        rows = [[0] * 64 for _ in range(64)]

        def fill(x, y, width, height, value):
            for yy in range(y, y + height):
                rows[yy][x:x + width] = [value] * width

        def frame(box):
            l, t, r, b = box
            fill(l, t, r - l + 1, 1, 8); fill(l, b, r - l + 1, 1, 8)
            fill(l, t, 1, b - t + 1, 8); fill(r, t, 1, b - t + 1, 8)

        frame(self.board)
        l, t, _, _ = self.board
        for y in range(self.shape[1]):
            for x in range(self.shape[0]):
                fill(l + 1 + x * self.size, t + 1 + y * self.size, self.size, self.size, 1 + (x + y) % 2)
        for index, obj in enumerate(self.objects):
            x, y = [obj["xy"][i] * self.size + self.board[i] + 1 for i in (0, 1)]
            fill(x, y, self.size, self.size, obj["value"])
            if index == self.selected or index in self.extra_selected:
                rows[y + self.size // 2][x + self.size // 2] = 14
        for box in self.legends:
            frame(box)
            a, b, c, d = box
            fill(a + 1, b + 1, c - a - 1, d - b - 1, 1)
            for feature in self.features:
                rows[b + 1 + feature["xy"][1]][a + 1 + feature["xy"][0]] = feature["value"]
        selected_value = self.objects[self.selected]["value"] if self.selected is not None else 3
        for control in self.controls:
            for y in range(control["shape"][1]):
                for x in range(control["shape"][0]):
                    xx, yy = control["origin"][0] + x * 5, control["origin"][1] + y * 5
                    fill(xx, yy, self.size, self.size, selected_value)
                    if [x, y] == control["selected"]:
                        rows[yy + self.size // 2][xx + self.size // 2] = 14
        for x, y, value in self.pixel_changes:
            rows[y][x] = value
        return rows

    def public(self):
        return packet(self.rows(), self.revision, self.epoch, self.completed, self.available)

    def act(self, command, response="unit"):
        if response == "unchanged":
            self.revision += 1
            return
        data = command.get("data", {})
        if command["action_ref"] == "ACTION6":
            x, y = data["x"], data["y"]
            for index, obj in enumerate(self.objects):
                xx, yy = [obj["xy"][i] * self.size + self.board[i] + 1 for i in (0, 1)]
                if xx <= x < xx + self.size and yy <= y < yy + self.size:
                    self.selected = index
                    for control in self.controls:
                        control["selected"] = [1, 1]
                    break
            else:
                for control in self.controls:
                    for cy in range(control["shape"][1]):
                        for cx in range(control["shape"][0]):
                            xx, yy = control["origin"][0] + cx * 5, control["origin"][1] + cy * 5
                            if not (xx <= x < xx + self.size and yy <= y < yy + self.size) or self.selected is None:
                                continue
                            previous = control["selected"]
                            gain = -1 if response == "opposite" else 1
                            obj = self.objects[self.selected]
                            target = [obj["xy"][i] + ([cx, cy][i] - previous[i]) * gain for i in (0, 1)]
                            if all(0 <= target[i] < self.shape[i] for i in (0, 1)) and not any(o["xy"] == target for j, o in enumerate(self.objects) if j != self.selected):
                                obj["xy"] = target
                            control["selected"] = [cx, cy]
        self.revision += 1


def source_step(family, world, *, response="unit", apply=True):
    before = world.public(); obs = observe(before)
    domain = ObservedInputDomain(250); inputs = domain.candidates(obs)
    out = {"stateBefore": state(family), "beforePublic": vars(before), "beforeObservation": obs,
           "inputs": inputs, "remaining": 80 - world.revision}
    proposal = family.propose(obs, before.frame_rows, inputs, out["remaining"])
    out.update(proposal=deepcopy(proposal), stateAfterPropose=state(family), diagnostic=deepcopy(family.last))
    if proposal is None or not apply:
        return plain(out)
    family.bind(proposal, domain)
    out.update(boundProposal=deepcopy(proposal), beforeGuard=family.before(proposal, 0, before, obs))
    command = deepcopy(proposal["actions"][0]); world.act(command, response)
    if response == "boundary":
        world.completed += 1
        world.epoch += 1
    after = world.public(); second = observe(after)
    out.update(command=command, afterPublic=vars(after), afterObservation=second,
        afterGuard=family.after(proposal, 0, obs, second, before.frame_rows, after.frame_rows),
        record=family.record(obs, second, command, before.frame_rows, after.frame_rows, proposal, 0),
        stateAfter=state(family))
    return plain(out)


def initial_cases():
    cases = []

    def add(label, world, *, remaining=80, inputs_override=None, corrupt=None):
        family = RelativeArrangements(); public = world.public(); obs = observe(public)
        if corrupt:
            seed = family.propose(obs, public.frame_rows, ObservedInputDomain(250).candidates(obs), remaining)
            assert seed, label
            point = seed["arrangement_plan"]["offer"]["point"]
            supports = [e for e in obs["entities"] if e["bbox"][0] <= point[0] <= e["bbox"][2] and e["bbox"][1] <= point[1] <= e["bbox"][3] and [point[0] - e["position"][0], point[1] - e["position"][1]] in plain(e["mask"])]
            assert len(supports) == 1
            if corrupt == "duplicate":
                extra = deepcopy(supports[0]); extra["id"] += ":duplicate"; obs["entities"].append(extra)
            else:
                obs["entities"].remove(supports[0])
            family = RelativeArrangements()
        inputs = ObservedInputDomain(250).candidates(obs) if inputs_override is None else inputs_override
        layout = project(obs, public.frame_rows)
        proposal = family.propose(obs, public.frame_rows, inputs, remaining)
        cases.append(plain({"id": label, "observationMode": "synthetic-support-corruption" if corrupt else "original-public-measurement",
            "public": vars(public), "observation": obs, "inputs": inputs, "remaining": remaining,
            "rectangles": rectangles(obs), "layout": layout,
            "targets": translated_targets(layout) if layout else None, "proposal": proposal,
            "state": state(family), "diagnostic": family.last}))

    add("measured-unselected-participants", Interface())
    arranged = Interface(); arranged.objects[1]["xy"] = [3, 1]
    add("already_arranged", arranged)
    unrecognized = Interface(); unrecognized.legends = []
    add("unrecognized_no_model", unrecognized)
    selected = Interface(); selected.selected = 0
    add("measured-selected-participant", selected)
    add("input-candidates-are-not-a-source-offer-prerequisite", Interface(), inputs_override=[])
    add("remaining-zero", Interface(), remaining=0)
    unavailable = Interface(); unavailable.available = ["ACTION5"]
    add("action6-unavailable", unavailable)
    unavailable = Interface(); unavailable.available = []
    add("no-available-actions", unavailable)
    missing = Interface(); missing.controls = []
    add("no-measured-actuator", missing)
    ambiguous = Interface(); ambiguous.legends.append([51, 3, 57, 7])
    add("two-matching-model-frames-are-ambiguous", ambiguous)
    multiple = Interface(); multiple.selected = 0; multiple.extra_selected = [1]
    add("two-selected-participants", multiple)
    bad = Interface(); bad.pixel_changes = [(4, 4, 9), (5, 4, 9)]
    add("cell-with-two-off-center-exceptions", bad)
    bad = Interface(); bad.features.append({"xy": [4, 1], "value": 12})
    add("model-participant-multiplicity-mismatch", bad)
    duplicate = Interface()
    duplicate.objects = [{"xy": [1, 1], "value": 3}, {"xy": [5, 4], "value": 3}, {"xy": [2, 5], "value": 12}]
    duplicate.features = [{"xy": [0, 0], "value": 3}, {"xy": [2, 0], "value": 3}, {"xy": [1, 1], "value": 12}]
    add("repeated-participant-signatures-retain-all-assignments", duplicate)
    add("no-unique-point-support", Interface(), corrupt="duplicate")
    add("missing-point-support", Interface(), corrupt="missing")
    return cases


def sessions_and_records():
    sessions = []
    for label, responses in [("selected_displacement", ["unit"] * 6),
                             ("failed_trial", ["unit", "unchanged", "unchanged"]),
                             ("official_boundary", ["unit", "boundary"]),
                             ("discriminating-return-unit", ["unit", "unit"]),
                             ("discriminating-return-opposite", ["unit", "opposite"])]:
        family = RelativeArrangements(); world = Interface(); steps = []
        for response in responses:
            row = source_step(family, world, response=response)
            steps.append(row)
            if row["proposal"] is None:
                break
        steps.append(source_step(family, world, apply=False))
        sessions.append({"id": label, "steps": steps})

    base = sessions[0]["steps"][1]
    assert base.get("record", {}).get("status") == "single_object_and_actuator_displacement", "Fixture must acquire an actual source relation"
    before = SimpleNamespace(**base["beforePublic"])
    original = Interface(); original.selected = 0; original.revision = 1
    assert original.rows() == before.frame_rows
    records = []

    def add(label, world):
        family = RelativeArrangements(); family.restore(deepcopy(base["stateAfterPropose"]))
        after = world.public(); obs = observe(after); proposal = deepcopy(base["proposal"])
        result = family.record(base["beforeObservation"], obs, base["command"], before.frame_rows, after.frame_rows, proposal, 0)
        saved = state(family); inputs = ObservedInputDomain(250).candidates(obs)
        next_proposal = family.propose(obs, after.frame_rows, inputs, 60)
        records.append(plain({"id": label, "stateBefore": base["stateAfterPropose"], "beforePublic": vars(before),
            "beforeObservation": base["beforeObservation"], "afterPublic": vars(after), "afterObservation": obs,
            "proposal": proposal, "command": base["command"], "record": result, "stateAfter": saved,
            "nextInputs": inputs, "nextRemaining": 60, "nextProposal": next_proposal, "stateAfterNext": state(family),
            "beforeLayout": project(base["beforeObservation"], before.frame_rows), "afterLayout": project(obs, after.frame_rows),
            "effect": effect(project(base["beforeObservation"], before.frame_rows), project(obs, after.frame_rows), base["command"])}))

    world = deepcopy(original); world.act(base["command"]); add("single-selected-object-and-one-actuator", world)
    world = deepcopy(original); world.revision += 1; add("no-effect-excludes-current-trial", world)
    world = deepcopy(original); world.act(base["command"]); world.objects[1]["xy"] = [6, 5]; add("multiple-participants-move", world)
    world = deepcopy(original); world.act(base["command"]); world.selected = None; add("moved-participant-no-longer-selected", world)
    world = deepcopy(original); world.act(base["command"]); world.selected = 1; add("another-participant-selected", world)
    world = deepcopy(original); world.act(base["command"]); world.controls[0]["selected"] = [1, 1]; add("movement-without-actuator-marker-change", world)
    world = deepcopy(original); world.act(base["command"]); world.controls = []; add("actuator-layout-disappeared", world)
    world = deepcopy(original); world.act(base["command"]); world.epoch = 2; add("epoch-changed-without-completion", world)
    world = deepcopy(original); world.act(base["command"]); world.epoch = 2; world.completed = 1; add("official-boundary-retains-events-resets-epoch-models", world)

    # Additional effects are direct public projections; they are not family offers.
    effects = []
    for label, first, second in [("select-first-participant", Interface(), deepcopy(original))]:
        a, b = first.public(), second.public(); ao, bo = observe(a), observe(b)
        la, lb = project(ao, a.frame_rows), project(bo, b.frame_rows)
        effects.append(plain({"id": label, "before": la, "after": lb, "command": {"action_ref": "ACTION6", "data": {"x": 8, "y": 8}},
            "expected": effect(la, lb, {"action_ref": "ACTION6", "data": {"x": 8, "y": 8}})}))
    first = deepcopy(original); first.controls.append({"origin": [34, 42], "shape": [4, 3], "selected": [1, 1]})
    second = deepcopy(first); second.act(base["command"]); second.controls[1]["selected"] = [2, 1]
    a, b = first.public(), second.public(); la, lb = project(observe(a), a.frame_rows), project(observe(b), b.frame_rows)
    assert la and lb, "Two separately measured pads remain a valid projection"
    effects.append(plain({"id": "two-actuators-change", "before": la, "after": lb, "command": base["command"], "expected": effect(la, lb, base["command"])}))
    effects.append({"id": "missing-before-projection", "before": None, "after": lb, "command": base["command"], "expected": effect(None, lb, base["command"])})
    return sessions, records, effects


def abstract_layout(objects=None, selected=0, shape=(9, 9)):
    objects = objects or [([1, 1], 3), ([7, 7], 12)]
    participants = [{"xy": list(xy), "value": value, "marker": 14 if index == selected else None,
                     "point": [4 + 3 * xy[0], 4 + 3 * xy[1]]} for index, (xy, value) in enumerate(objects)]
    cells = [{"xy": [x, y], "value": participants[selected or 0]["value"], "marker": 14 if [x, y] == [1, 1] else None,
              "point": [35 + 5 * x, 19 + 5 * y]} for x in range(5) for y in range(3)]
    return {"objects": participants, "selected": participants[selected] if selected is not None else None,
            "shape": list(shape), "pads": [{"ref": "abstract-public-pad", "selected": next(c for c in cells if c["xy"] == [1, 1]), "cells": cells}],
            "legend": {"features": [{"xy": [0, 0], "value": 3}, {"xy": [2, 0], "value": 12}]}}


def target(layout, points):
    current = {(o["xy"][0], o["xy"][1], o["value"]) for o in layout["objects"]}; wanted = set(map(tuple, points))
    return {"target": sorted(wanted), "already_preserved": sorted(current & wanted), "remove": sorted(current - wanted), "add": sorted(wanted - current),
            "relation": "same_typed_relative_displacements_as_visible_model", "terminal_role": "hypothesis_until_observed_boundary"}


def model(delta=(1, 0), control_to=(2, 1), *, selection_ref="selection:current", object_value=3, pad_ref="abstract-public-pad", evidence=None):
    return {"status": "single_object_and_actuator_displacement", "object_value": object_value, "from": [1, 1],
            "to": [1 + delta[0], 1 + delta[1]], "delta": list(delta), "selection_ref": selection_ref,
            "control": {"pad_ref": pad_ref, "from": [1, 1], "to": list(control_to), "marker_value": object_value},
            "evidence": evidence or ["public:before", "public:after"]}


def planner_cases(config):
    cases = []

    def add(label, layout=None, targets=None, models=None, selection_ref="selection:current", failed=None, configuration=None):
        layout = layout or abstract_layout(); targets = targets if targets is not None else [target(layout, [(4, 1, 3), (7, 7, 12)])]
        arguments = {"layout": layout, "targets": targets, "models": models or [], "selection_ref": selection_ref, "failed": failed or [], "config": configuration or config}
        expected = options(layout, targets, arguments["models"], selection_ref, failed_set(arguments["failed"]), arguments["config"])
        cases.append(plain({"id": label, "arguments": arguments, "assignments": assignments(layout, targets, arguments["config"]["maximum_assignments"]), "expected": expected}))
        return expected

    add("first-experiment-adjacent-control-only")
    add("half-scalar-gain-rejects-nonintegral-destination", models=[model((1, 0), (3, 1))])
    add("three-halves-gain-preserves-integer-result", models=[model((3, 0), (3, 1))])
    add("contradictory-gains-refuse-same-pad", models=[model((1, 0), (2, 1)), model((2, 0), (2, 1))])
    add("zero-displacement-is-not-acquired-gain", models=[model((0, 0), (2, 1))])
    add("more-than-half-shape-is-not-acquired-gain", models=[model((5, 0), (2, 1))])
    add("exactly-half-shape-floor-remains-an-acquired-gain", models=[model((4, 0), (2, 1))])
    add("gain-evidence-is-stably-deduplicated", models=[model(evidence=["a", "b"]), model(evidence=["b", "c"])])
    add("gain-from-another-selection-is-not-reused", models=[model((2, 0), selection_ref="selection:other")])
    add("gain-from-another-actuator-is-not-reused", models=[model((2, 0), pad_ref="another-pad")])
    add("gain-from-another-value-is-not-reused", models=[model((2, 0), object_value=12)])
    add("coupled-return-does-not-acquire-unmoved-control-axis", models=[model((1, 2), (2, 1))])
    offered = add("measured-unit-gain-permits-larger-local-control-displacement", models=[model()])
    assert offered
    add("failed-trial-excluded-with-other-options-preserved", models=[model()], failed=[offered[0]["trial"]])
    add("all-improving-trials-excluded", models=[model()], failed=[o["trial"] for o in offered])
    reverse = abstract_layout(objects=[([4, 1], 3), ([7, 7], 12)])
    add("negative-local-gain", reverse, [target(reverse, [(2, 1, 3), (7, 7, 12)])], [model((-1, 0), (2, 1))])
    occupied = abstract_layout(objects=[([1, 1], 3), ([2, 1], 12)])
    add("predicted-participant-overlap-refused", occupied, [target(occupied, [(4, 1, 3), (2, 1, 12)])])
    add("no-targets-no-offer", targets=[])
    layout = abstract_layout()
    add("already-preserved-target-no-experiment", layout, [target(layout, [(1, 1, 3), (7, 7, 12)])])
    unselected = abstract_layout(selected=None)
    add("unselected-participant-requires-selection", unselected)
    numeric = abstract_layout(objects=[([10, 1], 10), ([2, 1], 2)], selected=None, shape=(14, 14))
    add("numeric-values-and-nested-rank-coordinates", numeric, [target(numeric, [(9, 1, 10), (3, 1, 2)])])
    same = abstract_layout(objects=[([1, 1], 3), ([2, 2], 3), ([7, 7], 12)], selected=None)
    add("all-same-value-correspondences-retained", same, [target(same, [(3, 1, 3), (4, 2, 3), (7, 7, 12)])])
    groups = abstract_layout(objects=[([1, 1], 3), ([2, 2], 3), ([5, 5], 12), ([6, 6], 12)], selected=None)
    group_targets = [target(groups, [(2, 1, 3), (3, 2, 3), (4, 5, 12), (5, 6, 12)]),
                     target(groups, [(1, 2, 3), (2, 3, 3), (5, 4, 12), (6, 5, 12)])]
    add("assignment-product-across-distinct-values", groups, group_targets[:1], configuration={**config, "maximum_assignments": 4})
    add("assignment-product-bound-across-distinct-values", groups, group_targets[:1], configuration={**config, "maximum_assignments": 3})
    add("assignment-bound-is-per-target-not-global", groups, group_targets, configuration={**config, "maximum_assignments": 4})
    many = abstract_layout(objects=[([i, 1], 3) for i in range(6)], selected=None)
    many_target = [target(many, [(i, 2, 3) for i in range(6)])]
    add("six-identical-values-permutation-bound-inclusive", many, many_target, configuration={**config, "maximum_assignments": 720})
    add("assignment-product-exceeds-bound", many, many_target, configuration={**config, "maximum_assignments": 719})
    too_many = abstract_layout(objects=[([i, 1], 3) for i in range(7)], selected=None)
    add("seven-identical-values-refused-before-permutations", too_many, [target(too_many, [(i, 2, 3) for i in range(7)])])
    return cases


def guard_and_error_cases(session):
    row = session["steps"][1]; proposal = deepcopy(row["proposal"]); public = deepcopy(row["beforePublic"]); observation = deepcopy(row["beforeObservation"])
    family = RelativeArrangements(); family.restore(deepcopy(row["stateAfterPropose"]))
    cases = []

    def add(label, p=None, pub=None, obs=None):
        p = deepcopy(proposal if p is None else p); pub = deepcopy(public if pub is None else pub); obs = deepcopy(observation if obs is None else obs)
        cases.append(plain({"id": label, "proposal": p, "public": pub, "observation": obs, "expected": family.before(p, 0, SimpleNamespace(**pub), obs)}))

    add("current")
    for field, value in [("level", 99), ("levels_completed", 99), ("frame_hash", "stale-public-frame"), ("available_action_refs", ["ACTION5"])]:
        changed = deepcopy(public); changed[field] = value; add("changed-" + field, pub=changed)
    changed = deepcopy(observation); changed["observation_ref"] = "another-public-observation"; add("changed-observation-ref", obs=changed)
    changed = deepcopy(public); x, y = proposal["arrangement_plan"]["offer"]["point"]; changed["frame_rows"][y][x] = 15; add("changed-locus-pixel", pub=changed)
    changed = deepcopy(proposal); changed["steps"][0]["action"] = {"action_ref": "ACTION5"}; add("step-command-differs", p=changed)
    changed = deepcopy(proposal); changed["arrangement_plan"]["offer"]["point"][0] += 1; add("changed-offer-locus", p=changed)
    errors = []
    changed = deepcopy(proposal); changed["steps"][0]["point_binding"]["point"][0] += 1
    for label, operation, p, command, obs in [
        ("bind-rejects-point-repair", "bind", changed, row["command"], observation),
        ("record-rejects-unoffered-command", "record", proposal, {"action_ref": "ACTION5"}, observation),
        ("record-rejects-unbound-before-observation", "record", proposal, row["command"], {**observation, "observation_ref": "foreign"})]:
        try:
            if operation == "bind":
                family.bind(deepcopy(p), ObservedInputDomain(250))
            else:
                family.record(obs, row["afterObservation"], command, public["frame_rows"], row["afterPublic"]["frame_rows"], p, 0)
        except Exception as error:
            errors.append(plain({"id": label, "operation": operation, "proposal": p, "command": command, "observation": obs,
                "errorType": type(error).__name__, "message": str(error)}))
        else:
            raise AssertionError("Expected original rejection: " + label)
    return {"state": row["stateAfterPropose"], "cases": cases, "errors": errors,
            "beforePublic": public, "afterPublic": row["afterPublic"], "afterObservation": row["afterObservation"]}


def assert_fixture_contract(initial, sessions, records, effects, planners):
    """Prevent a malformed fixture from silently turning positive tests negative."""
    initial_by_id = {row["id"]: row for row in initial}
    for name in ("measured-unselected-participants", "measured-selected-participant",
                 "input-candidates-are-not-a-source-offer-prerequisite", "repeated-participant-signatures-retain-all-assignments"):
        assert initial_by_id[name]["proposal"] is not None, name
    for name in ("already_arranged", "action6-unavailable", "no-available-actions", "no-unique-point-support", "missing-point-support"):
        assert initial_by_id[name]["layout"] is not None and initial_by_id[name]["proposal"] is None, name
    for name in ("unrecognized_no_model", "no-measured-actuator", "two-matching-model-frames-are-ambiguous", "two-selected-participants",
                 "cell-with-two-off-center-exceptions", "model-participant-multiplicity-mismatch"):
        assert initial_by_id[name]["layout"] is None and initial_by_id[name]["proposal"] is None, name
    session_by_id = {row["id"]: row for row in sessions}
    for row in sessions:
        assert row["steps"][0]["record"]["status"] == "selection_observed", row["id"]
    assert session_by_id["failed_trial"]["steps"][1]["record"]["status"] == "no_arrangement_change"
    assert session_by_id["official_boundary"]["steps"][1]["record"]["status"] == "official_boundary"
    left, right = [session_by_id["discriminating-return-" + suffix]["steps"] for suffix in ("unit", "opposite")]
    assert left[1]["proposal"] == right[1]["proposal"]
    assert left[2]["proposal"] and right[2]["proposal"]
    assert left[2]["proposal"]["actions"] != right[2]["proposal"]["actions"]
    assert left[2]["proposal"]["arrangement_plan"]["offer"]["model_evidence"]
    assert right[2]["proposal"]["arrangement_plan"]["offer"]["model_evidence"]
    assert next(row for row in effects if row["id"] == "two-actuators-change")["expected"]["status"] == "actuator_change_ambiguous"
    assert {row["record"]["status"] for row in records} >= {"single_object_and_actuator_displacement", "no_arrangement_change",
        "ambiguous_multi_object_change", "selected_identity_unbound", "actuator_change_ambiguous", "scope_unbound", "official_boundary"}
    by_id = {row["id"]: row for row in planners}
    for name in ("contradictory-gains-refuse-same-pad", "all-improving-trials-excluded", "predicted-participant-overlap-refused",
                 "no-targets-no-offer", "already-preserved-target-no-experiment", "assignment-product-exceeds-bound",
                 "assignment-product-bound-across-distinct-values", "seven-identical-values-refused-before-permutations"):
        assert by_id[name]["expected"] == [], name
    assert len(by_id["six-identical-values-permutation-bound-inclusive"]["assignments"]) == 720
    assert len(by_id["assignment-bound-is-per-target-not-global"]["assignments"]) == 8
    assert by_id["numeric-values-and-nested-rank-coordinates"]["assignments"][0]["pairs"][0]["value"] == 2
    for name in ("half-scalar-gain-rejects-nonintegral-destination", "three-halves-gain-preserves-integer-result"):
        assert by_id[name]["expected"], name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "tests/fixtures/v6-relative-arrangements-reference.json.gz")
    args = parser.parse_args()
    family = RelativeArrangements()
    initial = initial_cases(); sessions, records, effects = sessions_and_records()
    planners = planner_cases(family.config); guards = guard_and_error_cases(sessions[0])
    assert_fixture_contract(initial, sessions, records, effects, planners)
    cell_cases = []
    for label, rows in [("uniform", [[2] * 3 for _ in range(3)]), ("unique-center-marker", [[2, 2, 2], [2, 12, 2], [2, 2, 2]]),
                        ("off-center-marker-refused", [[12, 2, 2], [2, 2, 2], [2, 2, 2]]),
                        ("two-markers-refused", [[2, 2, 2], [2, 12, 2], [2, 2, 12]])]:
        cell_cases.append({"id": label, "rows": rows, "x": 0, "y": 0, "size": 3, "expected": cell(rows, 0, 0, 3)})
    paths = {Path(module.__file__).resolve() for module in tuple(sys.modules.values()) if getattr(module, "__file__", None) and Path(module.__file__).resolve().is_relative_to(REF)}
    paths.update(REF / "agents/yf_arc3_v6/morphology_policy/relative_arrangements" / name for name in ("relative_arrangements.drm", "relative_arrangements.src"))
    sources = {str(path.relative_to(REF)): {"bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in sorted(paths)}
    fixture = {"provenance": {"commit": COMMIT, "sources": sources, "observationScope": SCOPE,
        "scope": "Unmodified original Python component/SRC execution; synthetic public transitions and abstract finite cases, not router/game parity.",
        "stateNormalization": {"field": "failed", "reason": "Python set iteration order is not authored; planner consumes membership only.", "order": "lexicographic (from, pad_ref, marker_from, marker_to)", "otherOrdersPreserved": True},
        "limitations": ["Abstract planner inputs are explicitly separate from rendered public family cases.", "Support corruption cases intentionally alter observations and do not claim observer parity.", "No real game success, complete caller ordering or global strategy parity is asserted."]},
        "configuration": family.config, "initial": initial, "sessions": sessions, "records": records,
        "effects": effects, "planner": planners, "cells": cell_cases, "guards": guards}
    payload = (json.dumps(plain(fixture), separators=(",", ":")) + "\n").encode()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(gzip.compress(payload, mtime=0))
    print(json.dumps({"file": str(args.out), "bytes": args.out.stat().st_size, "sourceFiles": len(sources), "initial": len(initial),
        "planner": len(planners), "sessions": [{"id": s["id"], "steps": len(s["steps"]), "events": [r.get("record", {}).get("status") for r in s["steps"]} for s in sessions],
        "records": [{"id": r["id"], "status": r["record"]["status"]} for r in records]}, indent=2))


if __name__ == "__main__":
    main()
