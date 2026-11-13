#!/usr/bin/env python3
"""Unchanged-source oracle for coupled-pair response acquisition.

These controlled public rasters exercise the real common adapter. Supplied
pair plans are explicit guard-contract inputs, not a transferred planner or a
game solution. The native comparison covers the whole pair-memory projection;
other inherited providers and the full inherited digest remain out of scope.
"""
from __future__ import annotations

import copy
import gzip
import hashlib
import inspect
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = ROOT / "reference/v6" / COMMIT / "source"
LAYA = SOURCE / "agents/yf_arc3_v6/laya_proto"
sys.path[:0] = [str(SOURCE), str(LAYA)]

from common_observed_compositions import ObservedCompositionConstraint
from coupled_pair_access import CoupledPairAccess
from coupled_pair_observation import pairs, match_pair
from alternating_graph_observation import description
from agents.yf_arc3_v5.capabilities.components import detect_components
from neutral_observer import measure
from terminal_composition import identity

KINDS = {"coupled_pair_epoch_anchor", "coupled_pair_evidence"}
scenes = {}
journals = []
after_cases = []
covered = {name: set() for name in ("record", "after", "apply_event")}
PAIR_SOURCE = str(LAYA / "coupled_pair_access.py")


def plain(value):
    if isinstance(value, dict):
        return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [plain(item) for item in value]
    if isinstance(value, (set, frozenset)):
        return [plain(item) for item in sorted(value)]
    return value


def board(positions, *, size=3, value=2, extra_groups=(), patches=()):
    rows = [[0] * 24 for _ in range(24)]
    for color, length, cells in [(value, size, positions), *extra_groups]:
        for top, left in cells:
            for y in range(top, top + length):
                for x in range(left, left + length):
                    rows[y][x] = color
    for y, x, color in patches:
        rows[y][x] = color
    return rows


def scene(name, rows, *, epoch=1, score=0, revision=1, state="NOT_FINISHED"):
    public = SimpleNamespace(
        frame_rows=copy.deepcopy(rows), frame_packet=[copy.deepcopy(rows)],
        level=epoch, levels_completed=score, state=state, step_index=revision - 1,
        available_action_refs=["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION6"],
        frame_hash=identity(rows)[:16],
    )
    observation, _ = measure(public, revision, "pair-evidence-reference")
    scenes[name] = {
        "rows": copy.deepcopy(rows), "public": plain(vars(public)),
        "observation": plain(observation),
    }
    return name


def projection(memory):
    assert all(event["kind"] in KINDS for event in memory.pair_events)
    return plain(copy.deepcopy({
        "pair_state": memory.pair_state,
        "pair_events": memory.pair_events,
        "pair_initials": memory.pair_initials,
    }))


def snapshot(family):
    memory = family.memory
    return {
        "state": projection(memory),
        "sourceParentDigest": super(CoupledPairAccess, memory).retained_digest(),
        "sourcePairLayerDigest": CoupledPairAccess.retained_digest(memory),
    }


class Driver:
    def __init__(self, name, qualification):
        print("pair evidence oracle: " + name, file=sys.stderr, flush=True)
        self.family = ObservedCompositionConstraint()
        self.entry = {
            "id": name, "qualification": qualification,
            "initial": snapshot(self.family), "steps": [],
        }
        journals.append(self.entry)

    def finish(self, operation, result):
        expected = snapshot(self.family)
        expected["result"] = plain(copy.deepcopy(result))
        expected["pairEvents"] = (
            [plain(copy.deepcopy(event)) for event in result["events"]
             if event["kind"] in KINDS] if result is not None else None
        )
        complete = copy.deepcopy(self.family.state())
        rebuilt = ObservedCompositionConstraint()
        rebuilt.restore(complete)
        assert rebuilt.state() == complete
        assert snapshot(rebuilt) == {key: expected[key] for key in (
            "state", "sourceParentDigest", "sourcePairLayerDigest",
        )}
        self.family = rebuilt
        self.entry["steps"].append({"operation": operation, "expected": expected})
        self.entry["finalState"] = projection(rebuilt.memory)
        return expected

    def record(self, before, after, *, action="ACTION4", proposal=None, index=0):
        first, second = scenes[before], scenes[after]
        command = {"action_ref": action}
        proposal = copy.deepcopy(proposal or {})
        result = self.family.record(
            first["observation"], second["observation"], command,
            first["rows"], second["rows"], proposal, index,
            frames=second["public"]["frame_packet"],
        )
        return self.finish({
            "kind": "record", "before": before, "after": after,
            "command": command, "proposal": plain(proposal), "index": index,
        }, result)

    def apply(self, event):
        self.family.memory.apply_event(copy.deepcopy(event))
        self.family.events.append(copy.deepcopy(event))
        return self.finish({"kind": "apply", "event": plain(copy.deepcopy(event))}, None)


def plan(before, expected_positions, *, pair=None, trial="guard-contract-trial", index=0):
    view = scenes[before]
    selected = copy.deepcopy(pair or pairs(view["rows"])[0])
    expected = copy.deepcopy(expected_positions)
    actions = [{"action_ref": "ACTION4"} for _ in expected]
    return {"pair_access_plan": {
        "epoch": view["observation"]["level_epoch"],
        "score": view["observation"]["levels_completed"],
        "observation_ref": view["observation"]["observation_ref"],
        "initial_digest": identity(view["rows"]),
        "pair": selected, "commands": actions, "expected": expected,
        "trial": trial,
    }, "actions": actions, "bundle_template": {"actions": actions}}


def after_case(name, before, after, proposal, *, index=0, meta=None):
    first, second = scenes[before], scenes[after]
    actual_meta = {
        "epoch": second["observation"]["level_epoch"],
        "score": second["observation"]["levels_completed"],
        "state": second["observation"]["state"],
        **(meta or {}),
    }
    result = CoupledPairAccess.after(
        CoupledPairAccess(), proposal, index, first["rows"], second["rows"], **actual_meta,
    )
    after_cases.append({"id": name, "before": before, "after": after,
                        "proposal": plain(proposal), "index": index,
                        "meta": actual_meta, "expected": plain(result)})
    return result


def seed(name, qualification):
    driver = Driver(name, qualification)
    acquired = driver.record("a", "b")
    assert acquired["state"]["pair_state"] is not None
    return driver


def main():
    a_positions = [(4, 3), (12, 13)]
    b_positions = [(4, 6), (12, 16)]
    c_positions = [(7, 6), (15, 16)]
    a, b, c = (board(positions) for positions in (a_positions, b_positions, c_positions))
    scene("a", a)
    scene("b", b, revision=2)
    scene("c", c, revision=3)
    scene("c:held", c, revision=4)
    scene("b:held", b, revision=3)
    scene("a:return", a, revision=3)
    scene("a:border-return", board(a_positions, patches=[(0, 0, 9)]), revision=3)
    scene("a:changed-return", board(a_positions, patches=[(1, 1, 9)]), revision=3)
    scene("c:border", board(c_positions, patches=[(0, 0, 9)]), revision=3)
    scene("c:extra", board(c_positions, patches=[(1, 1, 9)]), revision=3)
    scene("a:score", a, score=1, revision=3)
    scene("a:win", a, state="WIN", revision=3)
    scene("a:over", a, state="GAME_OVER", revision=3)
    scene("b:epoch2", b, epoch=2, score=1, revision=2)
    scene("c:epoch2", c, epoch=2, score=1, revision=3)
    scene("c:epoch3", c, epoch=3, score=2, revision=4)
    scene("c:epoch3-held", c, epoch=3, score=2, revision=5)
    scene("b:epoch3", b, epoch=3, score=2, revision=6)

    learned = seed("learned_motion_and_exact_sample_deduplication", "Real source sampling: cardinal controls, zero effects and repeated identical references.")
    learned.record("b", "c", action="ACTION2")
    held = learned.record("c", "c:held", action="ACTION2")
    repeated = learned.record("c", "c:held", action="ACTION2")
    first, last = held["state"]["pair_state"], repeated["state"]["pair_state"]
    assert first["samples"] == last["samples"]
    assert len(last["evidence"]) == len(first["evidence"]) + 2
    assert last["floors"] == [0]

    no_effect = Driver("no_effect_cannot_initialize_a_pair", "An unmoved scene does not establish a moving pair; only its epoch anchor is retained.")
    result = no_effect.record("b", "b:held")
    assert result["state"]["pair_state"] is None
    assert [event["kind"] for event in result["pairEvents"]] == ["coupled_pair_epoch_anchor"]

    scene("two:a", board([(3, 3), (12, 12)], extra_groups=[(3, 2, [(3, 17), (17, 3)])]))
    scene("two:b", board([(3, 4), (12, 13)], extra_groups=[(3, 2, [(3, 18), (17, 4)])]), revision=2)
    ambiguous = Driver("two_moving_candidates_do_not_choose_one", "Two independent moving public pairs keep initialization unknown.")
    assert ambiguous.record("two:a", "two:b")["state"]["pair_state"] is None

    scene("tie:prior", board([(2, 4), (6, 8)], size=2))
    scene("tie:before", board([(4, 4), (6, 6)], size=2), revision=2)
    scene("tie:after", board([(4, 6), (6, 4)], size=2), revision=3)
    assert match_pair(pairs(scenes["tie:before"]["rows"])[0], pairs(scenes["tie:after"]["rows"])[0]) is None
    tie = Driver("ambiguous_assignment_does_not_reassign_members", "Equal-cost assignments produce neither initialization nor a later sample.")
    assert tie.record("tie:before", "tie:after")["state"]["pair_state"] is None
    tie.record("tie:prior", "tie:before")
    retained = projection(tie.family.memory)
    assert tie.record("tie:before", "tie:after")["pairEvents"] == []
    assert projection(tie.family.memory) == retained

    variants = {
        "missing": board([(4, 6)]),
        "palette": board(b_positions, value=3),
        "size": board(b_positions, size=2),
        "far": board([(4, 10), (12, 20)]),
        "diagonal": board([(5, 7), (13, 17)]),
    }
    incompatible = seed("incompatible_observations_preserve_prior_evidence", "Missing, changed-palette, changed-size, too-far and diagonal scenes do not invent compatible displacements.")
    retained = projection(incompatible.family.memory)
    for label, rows in variants.items():
        scene("invalid:" + label, rows, revision=3)
        assert incompatible.record("b", "invalid:" + label)["pairEvents"] == []
        assert projection(incompatible.family.memory) == retained

    scene("cross:a", board([(4, 4), (5, 12)], size=2))
    scene("cross:b", board([(6, 4), (5, 12)], size=2), revision=2)
    scene("cross:c", board([(8, 4), (5, 10)], size=2), revision=3)
    crossed = Driver("one_sided_motion_preserves_identity_after_spatial_reordering", "The tracked first member remains first after its top row passes the other member.")
    first = crossed.record("cross:a", "cross:b")
    assert first["state"]["pair_state"]["samples"]["ACTION4"][0]["deltas"] == [[2, 0], [0, 0]]
    last = crossed.record("cross:b", "cross:c")
    boxes = last["state"]["pair_state"]["pair"]["boxes"]
    assert boxes != sorted(boxes)
    assert boxes[0][:2] == [8, 4]

    floor_positions = [(4, 4), (12, 14)]
    next_positions = [(4, 5), (12, 15)]
    scene("floor:a", board(floor_positions))
    reveal = [(y, 4, 5) for y in range(4, 7)] + [(y, 14, 6) for y in range(12, 15)]
    scene("floor:two", board(next_positions, patches=reveal), revision=2)
    floors = Driver("partial_overlap_only_measures_unoccupied_revealed_pixels", "Overlapping old/new boxes exclude occupied pixels; the two homogeneous exposed strips keep encounter order.")
    assert floors.record("floor:a", "floor:two")["state"]["pair_state"]["floors"] == [5, 6]
    scene("floor:mixed", board([(4, 6), (12, 14)], patches=[(4, 4, 7)]), revision=2)
    mixed = Driver("heterogeneous_exposed_floor_remains_unknown", "A mixture in the vacated region is not a single passable floor value.")
    assert mixed.record("floor:a", "floor:mixed")["state"]["pair_state"]["floors"] == []

    epochs = Driver("epoch_boundaries_preserve_old_state_until_new_motion", "The before epoch anchors first, then boundary returns without clearing the last acquired pair.")
    assert epochs.record("a", "b:epoch2")["state"]["pair_state"] is None
    epochs.record("b:epoch2", "c:epoch2")
    old = projection(epochs.family.memory)["pair_state"]
    epochs.record("c:epoch2", "c:epoch3")
    assert projection(epochs.family.memory)["pair_state"] == old
    epochs.record("c:epoch3", "c:epoch3-held")
    assert projection(epochs.family.memory)["pair_state"] == old
    epochs.record("c:epoch3-held", "b:epoch3")
    assert projection(epochs.family.memory)["pair_state"]["epoch"] == 3

    b_pair = pairs(b)[0]
    c_boxes = pairs(c)[0]["boxes"]
    good = plan("b", [c_boxes], pair=b_pair)
    matched = seed("matched_plan_acquires_normal_response", "A supplied guard-contract plan is checked against actual public pixels; no planner is called.")
    after_case("matched_displacement", "b", "c", good)
    assert not matched.record("b", "c", proposal=good)["state"]["pair_state"]["refused"]
    after_case("border_only_change_is_outside_extra_effect_count", "b", "c:border", good)
    after_case("unexpected_interior_effect_refutes", "b", "c:extra", good)
    after_case("missing_expected_member_refutes", "b", "b:held", good)
    for boundary, metadata in (
        ("new_epoch", {"epoch": 2}), ("score_changed", {"score": 1}),
        ("win", {"state": "WIN"}), ("game_over", {"state": "GAME_OVER"}),
    ):
        after_case(boundary, "b", "a:return", good, meta=metadata)
    indexed = plan("a", [pairs(b)[0]["boxes"], c_boxes])
    after_case("later_prefix_index_uses_previous_expected_boxes", "b", "c", indexed, index=1)

    for label, target, expected_flags in (
        ("whole", "a:return", (True, True)),
        ("interior_only", "a:border-return", (False, True)),
        ("changed", "a:changed-return", (False, False)),
    ):
        refused = seed("refuted_plan_" + label + "_return", "A failed projection preserves prior motion evidence and records qualified return evidence, without inferring reset or teleportation.")
        before_state = projection(refused.family.memory)["pair_state"]
        result = refused.record("b", target, proposal=good)
        state = result["state"]["pair_state"]
        assert (state["unresolved"]["whole_scene_initial_equal"], state["unresolved"]["interior_initial_equal"]) == expected_flags
        for key in ("pair", "samples", "floors", "evidence"):
            assert state[key] == before_state[key]
        if label == "whole":
            again = refused.record("b", target, proposal=good)["state"]["pair_state"]
            assert again["refused"] == ["guard-contract-trial", "guard-contract-trial"]
            later = refused.record("a:return", "b")["state"]["pair_state"]
            assert later["unresolved"] == again["unresolved"]
            assert later["refused"] == again["refused"]

    for label, target in (("score", "a:score"), ("win", "a:win"), ("game_over", "a:over")):
        terminal = seed("official_" + label + "_does_not_refute_pair_plan", "A score/terminal result seals the guard with matched=None while ordinary same-epoch response acquisition remains eligible.")
        state = terminal.record("b", target, proposal=good)["state"]["pair_state"]
        assert not state["refused"] and "unresolved" not in state

    initial_plan = plan("a", [c_boxes])
    initial_refusal = Driver("first_acquisition_refusal_has_no_prior_unresolved_state", "With no earlier pair_state, only the post-acquisition trial refusal applies; unresolved is not invented.")
    state = initial_refusal.record("a", "b", proposal=initial_plan)["state"]["pair_state"]
    assert state["refused"] == ["guard-contract-trial"] and "unresolved" not in state

    replay = Driver("direct_replay_preserves_all_evidence_and_last_state", "The exact original event reducer is also tested independently of acquisition.")
    evidence = learned.entry["steps"][-1]["expected"]["pairEvents"][-1]
    anchor = learned.entry["steps"][0]["expected"]["pairEvents"][0]
    replay.apply(anchor)
    replay.apply(evidence)
    replay.apply(evidence)
    assert len(projection(replay.family.memory)["pair_events"]) == 3
    assert projection(replay.family.memory)["pair_state"] == evidence["state"]

    functions = (identity, measure, pairs, match_pair, description, detect_components)
    paths = {Path(inspect.getsourcefile(inspect.unwrap(item))) for item in (
        *ObservedCompositionConstraint.__mro__,
        *type(ObservedCompositionConstraint().memory).__mro__, *functions,
    ) if item is not object}
    sources = {str(path.relative_to(SOURCE)): hashlib.sha256(path.read_bytes()).hexdigest()
               for path in sorted(paths)}
    fixture = {
        "provenance": {
            "commit": COMMIT,
            "sourceMethod": "Unchanged full ObservedCompositionConstraint.record/apply_event/restore and original CoupledPairAccess.after.",
            "qualification": "Only the entire coupled-pair acquisition projection is compared. The supplied source parent digest verifies its exact layer formula; no equality with the full ObservedCompositionConstraint digest is claimed. Controlled public rasters and explicitly supplied guard-contract plans are not game solutions or transferred planning.",
            "sources": sources,
            "coveredSourceLines": {key: sorted(value) for key, value in covered.items()},
            "sourceModified": False,
        },
        "scenes": scenes, "journals": journals, "afterCases": after_cases,
    }
    target = ROOT / "tests/fixtures/v6-coupled-pair-evidence-reference.json.gz"
    payload = (json.dumps(fixture, ensure_ascii=False, indent=2) + "\n").encode()
    target.write_bytes(gzip.compress(payload, mtime=0))
    print(json.dumps({"path": str(target.relative_to(ROOT)), "journals": len(journals),
                      "operations": sum(len(row["steps"]) for row in journals),
                      "afterCases": len(after_cases), "sourceHashes": len(sources),
                      "bytes": target.stat().st_size,
                      "coveredSourceLines": fixture["provenance"]["coveredSourceLines"]}))


if __name__ == "__main__":
    def trace(frame, event, _arg):
        if frame.f_code.co_filename != PAIR_SOURCE:
            return None
        if event == "line":
            name = frame.f_code.co_name
            if name in covered:
                covered[name].add(frame.f_lineno)
        return trace
    sys.settrace(trace)
    try:
        main()
    finally:
        sys.settrace(None)
