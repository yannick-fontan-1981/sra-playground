#!/usr/bin/env python3
"""Exact original coupled-pair proposition and guard development oracle.

No solver or route is replaced. Learning uses controlled public raster responses;
the returned plans are produced by the pinned source. Explicit state variants and
point-binding payloads are contract inputs, never game solutions. Raw ancestral
fallbacks are preserved separately from the pair-only native comparison.
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

from common_coupled_support import CoupledSupportConstraint
from coupled_pair_access import CoupledPairAccess
from coupled_pair_observation import pairs, match_pair, joint_route
from alternating_graph_observation import description
from agents.yf_arc3_v5.capabilities.interaction import _bounded_joint_peer_collision_route_candidates
from agents.yf_arc3_v5.capabilities.cell_recount import recount_known_grid_cells
from neutral_observer import measure
from terminal_composition import identity

configuration = json.loads((SOURCE / "agents/yf_arc3_v6/morphology_policy/strategy.drm").read_text())["declarations"][0]["configuration"]
coupled_policy = configuration["coupled_support_composition"]
pair_policy = copy.deepcopy(coupled_policy)
pair_policy["coupled_pair_question"]["prepare_unmatched_supports"] = False
scenes, states, plans = {}, {}, {}
learning, proposals, guards, bindings = [], [], [], []
covered = {"propose_graph": set(), "before": set(), "coupled_propose": set(), "bind": set()}
TRACE_FILES = {str(LAYA / name) for name in ("coupled_pair_access.py", "common_coupled_support.py")}


def plain(value):
    if isinstance(value, dict):
        return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [plain(item) for item in value]
    if isinstance(value, (set, frozenset)):
        return [plain(item) for item in sorted(value)]
    return value


def board(positions, width=16, size=2, value=2):
    rows = [[0] * width for _ in range(16)]
    for top, left in positions:
        for y in range(top, top + size):
            for x in range(left, left + size):
                rows[y][x] = value
    return rows


def scene(name, rows, *, revision=1, epoch=1, score=0, state="NOT_FINISHED", available=None):
    public = SimpleNamespace(
        frame_rows=copy.deepcopy(rows), frame_packet=[copy.deepcopy(rows)],
        level=epoch, levels_completed=score, state=state, step_index=revision - 1,
        available_action_refs=available or ["ACTION1", "ACTION2", "ACTION3", "ACTION4"],
        frame_hash=identity(rows)[:16],
    )
    observation, _ = measure(public, revision, "pair-planning-reference")
    scenes[name] = {"rows": copy.deepcopy(rows), "public": plain(vars(public)), "observation": plain(observation)}
    return name


def acquire(name, width, right):
    family = CoupledSupportConstraint()
    entry = {"id": name, "qualification": "Controlled public responses, recorded by the original common adapter; no route, plan, or game solution is injected.", "steps": []}
    learning.append(entry)
    before = scene(name + ":0", board([(2, 4), (2, right)], width))
    transitions = [
        ("ACTION2", [(4, 4), (4, right)]),
        ("ACTION4", [(4, 6), (4, right - 2)]),
        ("ACTION3", [(4, 4), (4, right)]),
        ("ACTION1", [(2, 4), (2, right)]),
        ("ACTION2", [(4, 4), (4, right)]),
    ]
    for index, (action, positions) in enumerate(transitions, 1):
        after = scene(name + ":" + str(index), board(positions, width), revision=index + 1)
        first, second = scenes[before], scenes[after]
        command = {"action_ref": action}
        result = family.record(first["observation"], second["observation"], command,
                               first["rows"], second["rows"], {}, 0, frames=second["public"]["frame_packet"])
        assert all(event["kind"] in ("coupled_pair_epoch_anchor", "coupled_pair_evidence") for event in result["events"])
        entry["steps"].append({"before": before, "after": after, "command": command,
                               "expected": plain(result), "pairState": plain(family.memory.pair_state)})
        before = after
    entry["sourceState"] = plain(family.state())
    entry["finalScene"] = before
    states[name] = {"pairState": plain(family.memory.pair_state), "events": plain(family.events)}
    return family, before


def state_variant(name, base="small", edit=lambda value: None):
    value = plain(states[base]["pairState"])
    edit(value)
    event = {"kind": "coupled_pair_evidence", "state": value, "evidence": []}
    states[name] = {"pairState": value, "events": plain(states[base]["events"]) + [event],
                    "qualification": "Controlled retained-state contract variant, applied through the original event reducer."}
    return name


def family_for(state_name):
    family = CoupledSupportConstraint()
    for event in states[state_name]["events"]:
        family.memory.apply_event(copy.deepcopy(event))
        family.events.append(copy.deepcopy(event))
    assert plain(family.memory.pair_state) == states[state_name]["pairState"]
    return family


def proposal_case(name, *, state="small", view="small:5", maximum=16, config=None,
                  remaining=40, common=False, deadline=1, observation_patch=None):
    family = family_for(state)
    family.level_deadline = deadline
    public = scenes[view]
    observation = {**plain(public["observation"]), **(observation_patch or {})}
    actual_config = copy.deepcopy(pair_policy if config is None else config)
    if not common:
        actual_config.setdefault("remaining_level_actions", remaining)
    entry = {"id": name, "operation": "common" if common else "pair", "state": state,
             "scene": view, "observation": observation, "inputs": [], "maxPrefix": maximum,
             "remaining": remaining, "deadline": deadline, "config": actual_config}
    before = plain(family.state())
    try:
        if common:
            result = family.coupled_propose(observation, public["rows"], [], remaining, actual_config)
        else:
            result = CoupledPairAccess.propose_graph(family.memory, observation, public["rows"], [], maximum, actual_config)
        entry["sourceResult"] = plain(result)
        if not common and not (result.get("pair_access_plan") or result.get("block_unrelated_probe")):
            entry["expected"] = None
            entry["qualification"] = "The unchanged ancestral fallback is captured in sourceResult; native pair branch deliberately returns null and does not claim that ancestor."
        else:
            entry["expected"] = plain(result)
    except (ValueError, KeyError, TypeError) as error:
        entry["error"] = {"type": type(error).__name__, "message": str(error)}
    assert plain(family.state()) == before, name + " mutated retained evidence during planning"
    entry["sourceStateUnchanged"] = True
    proposals.append(entry)
    return entry.get("expected")


def guard_case(name, plan="small", *, index=0, view="small:5", edit=lambda value: None, meta_patch=None):
    proposal = plain(plans[plan])
    edit(proposal)
    public = scenes[view]
    observation = public["observation"]
    meta = {"epoch": observation["level_epoch"], "score": observation["levels_completed"],
            "observation_ref": observation["observation_ref"], "available": observation["available_action_refs"],
            **(meta_patch or {})}
    expected = CoupledPairAccess.before(CoupledPairAccess(), proposal, index, public["rows"], **meta)
    guards.append({"id": name, "proposal": proposal, "index": index, "scene": view, "meta": meta, "expected": plain(expected)})
    return expected


def bind_case(name, proposal, edit=lambda value: None, qualification=None):
    value = plain(proposal)
    edit(value)
    entry = {"id": name, "proposal": plain(value), "qualification": qualification}
    try:
        CoupledSupportConstraint().bind(value, None)
        entry["expected"] = plain(value)
    except (ValueError, KeyError, TypeError) as error:
        entry["error"] = {"type": type(error).__name__, "message": str(error)}
    bindings.append(entry)


def main():
    small, small_view = acquire("small", 16, 12)
    acquire("long", 96, 88)
    states["none"] = {"pairState": None, "events": []}
    plans["small"] = proposal_case("learned_cardinal_controls_produce_a_real_route")
    assert plans["small"]["actions"] == [{"action_ref": "ACTION4"}] * 2
    plans["long"] = proposal_case("long_route_keeps_21_steps_behind_a_16_action_prefix", state="long", view="long:5")
    assert len(plans["long"]["actions"]) == 16 and len(plans["long"]["pair_access_plan"]["route"]["actions"]) == 21
    proposal_case("one_action_prefix_keeps_the_complete_route", maximum=1)
    proposal_case("large_prefix_does_not_extend_route", maximum=40)
    proposal_case("remaining_route_budget_is_separate_from_prefix", maximum=1, remaining=1)
    proposal_case("remaining_route_budget_at_exact_distance", maximum=1, remaining=2)
    proposal_case("no_pair_state", state="none")
    proposal_case("missing_configuration", config={})
    proposal_case("empty_configuration", config={"coupled_pair_question": {}})
    proposal_case("no_prefix_budget", maximum=0)
    proposal_case("negative_prefix_budget", maximum=-1)
    proposal_case("old_epoch_is_not_a_current_pair", observation_patch={"level_epoch": 2})
    proposal_case("unavailable_horizontal_control_is_not_reused", observation_patch={"available_action_refs": ["ACTION1", "ACTION2", "ACTION4"]})
    proposal_case("unavailable_vertical_control_is_not_required_for_this_route", observation_patch={"available_action_refs": ["ACTION3", "ACTION4"]})
    changed = plain(scenes[small_view]["rows"])
    changed[4][4] = 0
    scene("member:missing", changed, revision=6)
    scene("member:palette", board([(4, 4), (4, 12)], value=3), revision=6)
    scene("member:size", board([(4, 4), (4, 12)], size=3), revision=6)
    scene("member:moved", board([(4, 6), (4, 10)]), revision=6)
    for variant in ("missing", "palette", "size", "moved"):
        proposal_case("current_member_" + variant + "_does_not_match_retained_pair", view="member:" + variant)

    state_variant("no_sign_row", edit=lambda state: state["samples"].update({"ACTION1": [], "ACTION2": []}))
    state_variant("no_sign_column", edit=lambda state: state["samples"].update({"ACTION3": [], "ACTION4": []}))
    state_variant("ambiguous_sign_row", edit=lambda state: state["samples"]["ACTION2"].append({"deltas": [[2, 0], [-2, 0]], "evidence": ["controlled-sign-conflict"]}))
    state_variant("ambiguous_sign_column", edit=lambda state: state["samples"]["ACTION4"].append({"deltas": [[0, 2], [0, 2]], "evidence": ["controlled-sign-conflict"]}))
    state_variant("ambiguous_translation", edit=lambda state: state["samples"]["ACTION4"].append({"deltas": [[0, 1], [0, 0]], "evidence": ["controlled-motion-conflict"]}))
    state_variant("non_pitch_translation", edit=lambda state: state["samples"].update({"ACTION4": [{"deltas": [[0, 1], [0, -1]], "evidence": []}]}))
    state_variant("no_floor", edit=lambda state: state.update(floors=[]))
    state_variant("unknown_floor", edit=lambda state: state.update(floors=[9]))
    state_variant("zero_effect", edit=lambda state: state["samples"]["ACTION4"].append({"deltas": [[0, 0], [0, 0]], "evidence": []}))
    state_variant("one_sided_sample", edit=lambda state: state["samples"]["ACTION4"].append({"deltas": [[0, 2], [0, 0]], "evidence": []}))
    state_variant("unequal_magnitudes", edit=lambda state: state["samples"]["ACTION4"].append({"deltas": [[0, 2], [0, -1]], "evidence": []}))
    def unsupported_sign(state):
        for action in ("ACTION3", "ACTION4"):
            for sample in state["samples"][action]:
                sample["deltas"][1][1] *= -1
    state_variant("unique_but_unsupported_sign", edit=unsupported_sign)
    for variant in ("no_sign_row", "no_sign_column", "ambiguous_sign_row", "ambiguous_sign_column", "ambiguous_translation",
                    "non_pitch_translation", "no_floor", "unknown_floor", "zero_effect", "one_sided_sample", "unequal_magnitudes", "unique_but_unsupported_sign"):
        proposal_case(variant, state=variant)
    state_variant("refused", edit=lambda state: state["refused"].append(plans["small"]["pair_access_plan"]["trial"]))
    state_variant("other_refused", edit=lambda state: state["refused"].append("a-different-public-trial"))
    proposal_case("exact_refused_trial_is_not_proposed_again", state="refused")
    proposal_case("a_different_refused_trial_does_not_block_this_one", state="other_refused")
    proposal_case("one_step_trial_differs_from_the_refused_two_step_trial", state="refused", maximum=1)

    # Use the original after/record branch to acquire an actual causal refusal.
    refusal = family_for("small")
    before = scenes[small_view]
    result = refusal.record(before["observation"], before["observation"], plans["small"]["actions"][0],
                            before["rows"], before["rows"], plans["small"], 0, frames=before["public"]["frame_packet"])
    assert refusal.memory.pair_state["unresolved"]["kind"] == "joint_projection_refuted"
    states["unresolved"] = {"pairState": plain(refusal.memory.pair_state), "events": plain(refusal.events), "sourceRefusalResult": plain(result)}
    proposal_case("refuted_projection_blocks_unrelated_probe", state="unresolved")
    proposal_case("unresolved_blocks_before_current_pair_measurement", state="unresolved", view="member:missing")
    proposal_case("old_unresolved_state_does_not_block_new_epoch", state="unresolved", observation_patch={"level_epoch": 2})
    proposal_case("unresolved_still_requires_enabled_question", state="unresolved", config={})
    proposal_case("unresolved_still_requires_prefix_budget", state="unresolved", maximum=0)

    # More than 24 genuine source evidence references, including measured no-effect.
    before_name = small_view
    for i in range(12):
        after_name = scene("held:" + str(i), scenes[small_view]["rows"], revision=7 + i)
        first, second = scenes[before_name], scenes[after_name]
        small.record(first["observation"], second["observation"], {"action_ref": "ACTION4"},
                     first["rows"], second["rows"], {}, 0, frames=second["public"]["frame_packet"])
        before_name = after_name
    states["many_evidence"] = {"pairState": plain(small.memory.pair_state), "events": plain(small.events)}
    capped = proposal_case("plan_retains_only_the_last_24_evidence_references", state="many_evidence", view=before_name)
    assert len(capped["pair_access_plan"]["evidence"]) == 24
    assert capped["pair_access_plan"]["evidence"] == states["many_evidence"]["pairState"]["evidence"][-24:]

    plans["common"] = proposal_case("common_adapter_adds_expected_before_and_source_subquestion", common=True, config=coupled_policy)
    proposal_case("common_adapter_limits_long_prefix_to_16", state="long", view="long:5", common=True, config=coupled_policy)
    proposal_case("common_remaining_shorter_than_whole_route", state="long", view="long:5", common=True, remaining=20)
    proposal_case("common_remaining_equal_to_whole_route", state="long", view="long:5", common=True, remaining=21)
    proposal_case("common_zero_remaining_precedes_missing_deadline", common=True, remaining=0, deadline=None)
    proposal_case("common_negative_remaining_precedes_missing_deadline", common=True, remaining=-1, deadline=None)
    proposal_case("common_positive_budget_requires_current_deadline", common=True, deadline=None)
    proposal_case("common_absent_pair_yields_no_candidate", common=True, state="none")
    proposal_case("common_preserves_causal_block_without_annotation", common=True, state="unresolved", config=coupled_policy)

    assert guard_case("first_bound_members_and_command_are_admitted")["admitted"]
    for field, value in (("epoch", 2), ("score", 1), ("observation_ref", "different-reference"), ("available", ["ACTION1", "ACTION2", "ACTION3"])):
        assert not guard_case("first_changed_" + field, meta_patch={field: value})["admitted"]
    assert not guard_case("first_missing_member", view="member:missing")["admitted"]
    extra = plain(scenes[small_view]["rows"]); extra[0][0] = 9
    scene("first:extra", extra, revision=6)
    guard_case("first_changed_frame_even_outside_members", view="first:extra", meta_patch={"observation_ref": before["observation"]["observation_ref"]})
    guard_case("first_actions_must_equal_retained_commands", edit=lambda proposal: proposal["actions"][0].update(action_ref="ACTION3"))
    guard_case("first_bundle_must_equal_actions", edit=lambda proposal: proposal["bundle_template"]["actions"][0].update(action_ref="ACTION3"))
    guard_case("first_discrete_empty_payload_still_changes_full_command", edit=lambda proposal: proposal["actions"][0].update(data={}))
    guard_case("first_discrete_nonempty_payload_changes_full_command", edit=lambda proposal: proposal["actions"][0].update(data={"x": 3}))
    predicted = plans["small"]["pair_access_plan"]["expected"][0]
    later = board([(box[0], box[1]) for box in predicted])
    scene("later:predicted", later, revision=7)
    assert guard_case("later_current_members_admit_the_remaining_command", index=1, view="later:predicted")["admitted"]
    assert guard_case("later_reference_may_change", index=1, view="later:predicted", meta_patch={"observation_ref": "another-current-reference"})["admitted"]
    extra = plain(later); extra[0][0] = 9
    scene("later:extra", extra, revision=7)
    assert guard_case("later_before_guard_only_binds_members_not_initial_frame", index=1, view="later:extra")["admitted"]
    missing = plain(later); missing[predicted[0][0]][predicted[0][1]] = 0
    scene("later:missing", missing, revision=7)
    assert not guard_case("later_member_disappearance_is_rejected", index=1, view="later:missing")["admitted"]
    guard_case("later_epoch_still_bound", index=1, view="later:predicted", meta_patch={"epoch": 2})
    guard_case("later_score_still_bound", index=1, view="later:predicted", meta_patch={"score": 1})
    guard_case("later_command_availability_still_bound", index=1, view="later:predicted", meta_patch={"available": ["ACTION1"]})
    bind_case("unchanged_discrete_proposal", plans["common"])
    bind_case("empty_discrete_payload_is_allowed_by_binder", plans["common"], edit=lambda proposal: proposal["actions"][0].update(data={}))
    bind_case("nonempty_discrete_payload_is_rejected_by_binder", plans["common"], edit=lambda proposal: proposal["actions"][0].update(data={"x": 3}))
    point = {"pair_access_plan": {"guard_contract_only": True}, "actions": [{"action_ref": "ACTION6", "data": {"x": 3, "y": 4}}],
             "steps": [{"point_support": {"point": [3, 4], "observation_ref": "controlled-point-guard", "palette_value": 0}}]}
    qualification = "Explicit point-binding contract input only; the pair route did not generate a click or a game solution."
    bind_case("current_point_support_is_copied_to_binding", point, qualification=qualification)
    bind_case("changed_current_point_is_rejected", point, edit=lambda proposal: proposal["actions"][0]["data"].update(x=4), qualification=qualification)

    functions = (identity, measure, pairs, match_pair, joint_route, description,
                 recount_known_grid_cells, _bounded_joint_peer_collision_route_candidates)
    paths = {Path(inspect.getsourcefile(inspect.unwrap(item))) for item in (
        *CoupledSupportConstraint.__mro__, *type(CoupledSupportConstraint().memory).__mro__, *functions,
    ) if item is not object}
    fixture = {
        "provenance": {"commit": COMMIT, "sourceModified": False,
                       "sourceMethod": "Original CoupledPairAccess.propose_graph/before, exact original joint_route and V5 bounded joint search, and original CoupledSupportConstraint.coupled_propose/bind.",
                       "qualification": "Controlled public raster learning and retained-state/guard contract variants; no game is declared solved. Raw source ancestral fallbacks are retained but are outside pair-only native parity. Auxiliary support planning has an independent oracle. No Python solver is part of the browser runtime.",
                       "sources": {str(path.relative_to(SOURCE)): hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(paths)},
                       "coveredSourceLines": {key: sorted(value) for key, value in covered.items()}},
        "policy": {"recall": configuration["window_constraints"]["occurrence_recall"], "coupled": coupled_policy, "pairOnly": pair_policy},
        "scenes": scenes, "states": states, "plans": plans, "learning": learning,
        "proposalCases": proposals, "guardCases": guards, "bindCases": bindings,
    }
    target = ROOT / "tests/fixtures/v6-coupled-pair-planning-reference.json.gz"
    target.write_bytes(gzip.compress((json.dumps(fixture, ensure_ascii=False, indent=2) + "\n").encode(), mtime=0))
    print(json.dumps({"path": str(target.relative_to(ROOT)), "learning": len(learning), "proposals": len(proposals),
                      "guards": len(guards), "bindings": len(bindings), "bytes": target.stat().st_size,
                      "sourceHashes": len(paths), "coveredSourceLines": fixture["provenance"]["coveredSourceLines"]}))


if __name__ == "__main__":
    def trace(frame, event, _arg):
        if frame.f_code.co_filename not in TRACE_FILES:
            return None
        if event == "line" and frame.f_code.co_name in covered:
            covered[frame.f_code.co_name].add(frame.f_lineno)
        return trace
    sys.settrace(trace)
    try:
        main()
    finally:
        sys.settrace(None)
