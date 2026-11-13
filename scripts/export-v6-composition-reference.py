"""Execute the pinned terminal_composition.py to export native-transfer goldens.

The scenes below are synthetic public measurements, not solver answers or a
mock implementation. All expected models, paths, guards and memory events are
produced by the unchanged reference source. Python is used only by this exporter.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys


COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SITE = Path(__file__).resolve().parents[1]
SOURCE = "agents/yf_arc3_v6/laya_proto/terminal_composition.py"


def plain(value):
    if hasattr(value, "__dataclass_fields__"):
        return {key: plain(getattr(value, key)) for key in value.__dataclass_fields__}
    if isinstance(value, dict):
        return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (set, frozenset)):
        return [plain(item) for item in sorted(value)]
    if isinstance(value, (bytes, tuple, list)):
        return [plain(item) for item in value]
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=SITE / "reference/v6" / COMMIT / "source")
    parser.add_argument("--output", type=Path, default=SITE / "tests/fixtures/v6-composition-reference.json")
    args = parser.parse_args()
    source = args.source_root.resolve() / SOURCE
    manifest = json.loads((SITE / "reference/v6" / COMMIT / "manifest.json").read_text())
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    if source_hash != manifest["files"][SOURCE]["sha256"]:
        raise ValueError("Reference source changed: " + SOURCE)
    spec = importlib.util.spec_from_file_location("composition_reference", source)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    called = set()

    def profile(frame, event, _arg):
        if event == "call" and frame.f_code.co_filename == str(source):
            called.add(frame.f_code.co_name)

    sys.setprofile(profile)
    scenes, snapshots = {}, {}

    def scene(name, position=(3, 3), *, epoch=1, score=0, goal=8, trigger=5, remote=6,
              extra=(), roles_extra=(), ambiguous=False, goal_at=(15, 12)):
        rows = [[0] * 21 for _ in range(18)]
        for x, y, value in ((1, 1, 11), (2, 1, 11), (18, 1, 12), (18, 2, 12),
                            (1, 15, 13), (2, 15, 13), (1, 16, 13),
                            (*goal_at, goal), (9, 9, trigger), (3, 15, remote), (6, 15, remote)):
            rows[y][x] = value
        for x, y, value in extra:
            rows[y][x] = value
        x, y = position
        rows[y][x] = 9
        roles = [("role:measured", (x, y, x, y), 9, [(0, 0)]),
                 ("landmark:horizontal", (1, 1, 2, 1), 11, [(0, 0), (1, 0)]),
                 ("landmark:vertical", (18, 1, 18, 2), 12, [(0, 0), (0, 1)]),
                 ("landmark:corner", (1, 15, 2, 16), 13, [(0, 0), (1, 0), (0, 1)])]
        observation = {"observation_ref": name, "level_epoch": epoch, "levels_completed": score,
                       "frame_hash": hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16],
                       "entities": [{"signature": sig, "bbox": box, "mask": mask, "palette_value": value,
                                     "identity_ambiguous": ambiguous if sig == "role:measured" else False}
                                    for sig, box, value, mask in roles] + list(roles_extra)}
        scenes[name] = {"observation": plain(observation), "rows": rows}
        snapshots[name] = module.Snapshot.from_public(observation, rows)
        return name

    positions = [(3, 3), (6, 3), (9, 3), (9, 6), (9, 9), (6, 9), (3, 9), (3, 12), (6, 12), (9, 12), (12, 12)]
    commands = ["ACTION4", "ACTION4", "ACTION2", "ACTION2", "ACTION3", "ACTION3", "ACTION2", "ACTION4", "ACTION4", "ACTION4", "ACTION4"]
    learning_ids = [scene(f"learn:{i}", pos, goal=8 if i < 4 else 4, trigger=5 if i < 4 else 0, remote=6 if i < 4 else 7)
                    for i, pos in enumerate(positions)]
    learning_ids.append(scene("learn:entered", epoch=2, score=1))
    episode = [(snapshots[a], command, snapshots[b]) for a, command, b in zip(learning_ids, commands, learning_ids[1:])]
    models = module.fit_boundary(episode)
    assert len(models) == 1 and models[0]["possible_prerequisites"] and models[0]["observed_passages"]
    model = models[0]
    scene("scoring", epoch=2, score=1, goal=4)
    scene("early", epoch=2, score=1)
    scene("missing_role", epoch=2, score=1, ambiguous=True)
    scene("no_goal", epoch=2, score=1, goal=0)
    scene("duplicate_goal", epoch=2, score=1, goal=4, extra=[(15, 9, 4)])
    scene("fallback", epoch=2, score=1, goal=4, trigger=0, extra=[(6, 3, 5)])
    scene("stationary", goal=8)
    scene("nonlocal", (12, 3), goal=8)
    scene("different_nonlocal", (3, 6), goal=8)
    scene("epoch_without_score", epoch=2, goal=8)

    cases = []

    def add_case(name, operation, arguments, value=None, function=None):
        entry = {"id": name, "operation": operation, "arguments": plain(arguments)}
        try:
            result = function() if function is not None else value
            if operation == "repeated_changes":
                result = {key: sorted([sorted(region) for region in regions]) for key, regions in result.items()}
            entry["expected"] = plain(result)
        except Exception as error:
            entry["error"] = str(error)
        cases.append(entry)
        return entry.get("expected")

    add_case("snapshot_ambiguous_role_excluded", "snapshot", {"scene": "missing_role"}, snapshots["missing_role"])
    for name, origin, size in (("one_pixel_halo", (6, 3), (1, 1)), ("edge_no_margin", (0, 3), (1, 1)),
                               ("right_no_margin", (20, 3), (1, 1)), ("rectangular_halo", (4, 6), (2, 1))):
        add_case(name, "local_patch", {"scene": "scoring", "origin": origin, "size": size}, module.local_patch(snapshots["scoring"], origin, size))
    for name, patch, size in (("square_orientations", [0, 1, 0, 0, 2, 3, 0, 0, 0], (1, 1)),
                               ("rectangular_orientations", [0, 1, 2, 0, 0, 3, 4, 0, 0, 0, 0, 0], (2, 1))):
        add_case(name, "orientation_patterns", {"patch": patch, "size": size}, module.orientation_patterns(patch, size))
        add_case(name + "_equality", "equality_pattern", {"patch": patch}, module.equality_pattern(patch))
    add_case("stable_landmark_registration", "registered", {"first": "learn:0", "last": "learn:10"}, module.registered(snapshots["learn:0"], snapshots["learn:10"]))
    add_case("observed_translation", "relative_motion", {"before": "learn:0", "after": "learn:1", "signature": "role:measured"}, module.relative_motion(snapshots["learn:0"], snapshots["learn:1"], "role:measured"))
    add_case("missing_translation_role", "relative_motion", {"before": "learn:0", "after": "missing_role", "signature": "role:measured"}, module.relative_motion(snapshots["learn:0"], snapshots["missing_role"], "role:measured"))
    episode_spec = [[a, command, b] for a, command, b in zip(learning_ids, commands, learning_ids[1:])]
    add_case("supported_controls", "motion_models", {"episode": episode_spec[:-1], "terminal": learning_ids[-2]}, list(module.motion_models(episode[:-1], episode[-1][0])))
    add_case("independent_rewrite_family", "repeated_changes", {"before": "learn:3", "after": "learn:4"}, module.repeated_changes(snapshots["learn:3"], snapshots["learn:4"]))
    add_case("learn_scoring_and_enabling_models", "fit_boundary", {"episode": episode_spec}, models)
    add_case("reject_prefix_without_score", "fit_boundary", {"episode": episode_spec[:-1]}, function=lambda: module.fit_boundary(episode[:-1]))
    bad_epoch = episode_spec[:-1] + [["epoch_without_score", "ACTION4", "learn:entered"]]
    add_case("reject_discontinuous_epoch", "fit_boundary", {"episode": bad_epoch}, function=lambda: module.fit_boundary([(snapshots[a], command, snapshots[b]) for a, command, b in bad_epoch]))

    # Sparse inverse control: one registered left witness, with three other
    # measured vectors whose sole missing inverse is left.
    inverse_positions = [(3, 3), (6, 3), (9, 3), (9, 6), (9, 9), (9, 6), (9, 3), (6, 3), (6, 6), (6, 9), (9, 9), (12, 9), (12, 12)]
    inverse_commands = ["ACTION4", "ACTION4", "ACTION2", "ACTION2", "ACTION1", "ACTION1", "ACTION3", "ACTION2", "ACTION2", "ACTION4", "ACTION4", "ACTION2", "ACTION3"]
    inverse_ids = [scene(f"inverse:{i}", pos, goal=4, trigger=0, goal_at=(9, 12)) for i, pos in enumerate(inverse_positions)]
    inverse_ids.append(scene("inverse:entered", epoch=2, score=1))
    inverse_episode = [(snapshots[a], command, snapshots[b]) for a, command, b in zip(inverse_ids, inverse_commands, inverse_ids[1:])]
    inverse_spec = [[a, command, b] for a, command, b in zip(inverse_ids, inverse_commands, inverse_ids[1:])]
    inverse_contact = ({"role": "role:measured", "epoch": 1, "score": 0, "site": [9, 12], "remote_change_evidence": ["public-change"],
                        "prefix": [{"action_ref": "ACTION3", "input_status": "inverse_hypothesis", "effect": "unknown_then_observe", "from": [12, 12], "to": [9, 12]}]}, 0)
    inverse_moves = dict(module.motion_models(inverse_episode[:-1], inverse_episode[-1][0]))["role:measured"]
    assert "ACTION3" not in inverse_moves
    tentative = module.scoring_contact_direction(inverse_episode, "role:measured", inverse_moves, inverse_contact)
    assert tentative is not None
    add_case("sparse_inverse_scoring_control", "scoring_contact_direction", {"episode": inverse_spec, "signature": "role:measured", "moves": inverse_moves, "contact": inverse_contact}, tentative)
    add_case("missing_inverse_contact", "scoring_contact_direction", {"episode": inverse_spec, "signature": "role:measured", "moves": inverse_moves, "contact": None}, None)
    add_case("learn_tentative_scoring_control", "fit_boundary", {"episode": inverse_spec, "contact": inverse_contact}, module.fit_boundary(inverse_episode, inverse_contact))

    def access_case(name, current="scoring", active=None, **kwargs):
        active = model if active is None else active
        return add_case(name, "propose_access", {"model": active, "scene": current, **kwargs},
                        module.propose_access(active, snapshots[current], **kwargs))

    route = access_case("conditional_scoring_access")
    assert route["status"] == "proposed"
    access_case("bounded_prefix", max_prefix=2)
    access_case("zero_prefix", max_prefix=0)
    access_case("unbound_role", "missing_role")
    access_case("insufficient_control_basis", active={**model, "moves": {"ACTION4": [3, 0]}})
    access_case("ambiguous_goal", "duplicate_goal")
    access_case("missing_goal", "no_goal")
    access_case("no_passage_evidence", active={**model, "observed_passages": []})
    access_case("earlier_goal_prerequisite_search", "early")
    early_route = module.propose_access(model, snapshots["early"])
    access_case("prefer_untried_spatial_occurrence", "early", occurrences={module.identity(early_route["experimental_occurrence"]): {}})
    access_case("condition_specific_trial", tried=[route["trial_key"]])
    access_case("refuted_context_edge", refuted=[route["prefix"][0]["premise_ref"]])
    access_case("changed_progress_context", observed_context=[(3, 15, 7), (6, 15, 7)])
    edge = {"epoch": 2, "role": "role:measured", "origin": [3, 3], "contact": [3, 6], "landing": [12, 9],
            "action_ref": "ACTION2", "surface": list(module.local_patch(snapshots["scoring"], (3, 6), (1, 1))), "before": "edge:b", "after": "edge:a"}
    access_case("measured_nonlocal_edge_seals_prefix", transfers=[edge])
    access_case("competing_nonlocal_arrivals", transfers=[edge, {**edge, "landing": [6, 9]}])
    fallback_edge = {**edge, "origin": [12, 3], "contact": [15, 3], "landing": [18, 3], "action_ref": "ACTION4", "surface": model["possible_prerequisites"][0]["pattern"]}
    fallback = access_case("measured_family_unreachable_goal_probe", "fallback", active={**model, "observed_passages": []}, transfers=[fallback_edge])
    assert fallback["kind"] == "probe_access_to_unreachable_scoring_composition"

    offered = [{"action_ref": key, "data": {}} for key in ["ACTION1", "ACTION2", "ACTION3", "ACTION4"]]
    memory = module.GoalAccessMemory()
    memory.apply_event({"kind": "goal_approach_retrospective", "models": models})
    proposal = memory.propose(scenes["scoring"]["observation"], scenes["scoring"]["rows"], offered)
    assert proposal["status"] == "proposed"
    for name, action_list, override in (("bound_memory_proposal", offered, models), ("no_exposed_controls", [], models),
                                        ("addressed_controls_excluded", [{"action_ref": "ACTION4", "data": {"x": 3}}], models),
                                        ("identical_hypotheses_agree", offered, models + models)):
        m = module.GoalAccessMemory(); m.models = override
        add_case(name, "memory_propose", {"models": override, "scene": "scoring", "actions": action_list}, m.propose(scenes["scoring"]["observation"], scenes["scoring"]["rows"], action_list))
    competitor = copy.deepcopy(model); competitor["scoring_pattern"][4] = 6
    m = module.GoalAccessMemory(); m.models = [model, competitor]
    add_case("competing_hypotheses", "memory_propose", {"models": m.models, "scene": "scoring", "actions": offered}, m.propose(scenes["scoring"]["observation"], scenes["scoring"]["rows"], offered))
    tentative_model = copy.deepcopy(model); tentative_model["tentative_scoring_control"] = {**tentative, "action_ref": proposal["prefix"][0]["action_ref"]}
    m = module.GoalAccessMemory(); m.models = [tentative_model]
    add_case("tentative_control_stops_first_test", "memory_propose", {"models": m.models, "scene": "scoring", "actions": offered}, m.propose(scenes["scoring"]["observation"], scenes["scoring"]["rows"], offered))

    # Every public guard branch, with the same sealed proposal.
    rows = scenes["scoring"]["rows"]
    first = proposal["prefix"][0]
    valid_before = dict(epoch=2, score=1, available=[a["action_ref"] for a in offered], observation_ref="scoring")
    before_variants = [("admitted", proposal, 0, rows, valid_before), ("outside", proposal, -1, rows, valid_before),
                       ("wrong_scope", proposal, 0, rows, {**valid_before, "epoch": 3}),
                       ("stale_observation", proposal, 0, rows, {**valid_before, "observation_ref": "old"}),
                       ("unavailable", proposal, 0, rows, {**valid_before, "available": []})]
    missing = copy.deepcopy(rows); missing[first["from"][1]][first["from"][0]] = 0
    changed = copy.deepcopy(rows); changed[first["to"][1]][first["to"][0]] = 2
    joined = copy.deepcopy(rows); joined[first["from"][1]][first["from"][0] + 1] = 9
    before_variants.extend([("role_missing", proposal, 0, missing, valid_before), ("role_joined", proposal, 0, joined, valid_before),
                            ("destination_changed", proposal, 0, changed, valid_before)])
    for name, plan, index, raster, options in before_variants:
        add_case("before_" + name, "check_access_before", dict(plan=plan, index=index, rows=raster, options=options),
                 module.check_access_before(plan, index, raster, **options))
    moved = copy.deepcopy(rows); moved[first["from"][1]][first["from"][0]] = 0; moved[first["to"][1]][first["to"][0]] = 9
    remote_change = copy.deepcopy(moved); remote_change[17][20] = 2
    after_options = dict(epoch=2, score=1, state="NOT_FINISHED")
    single = {**proposal, "prefix": [first]}
    nonlocal_plan = copy.deepcopy(single); nonlocal_plan["prefix"][0]["effect"] = "conditional_observed_access"
    for name, plan, index, result_rows, options in (
        ("local_continue", proposal, 0, moved, after_options), ("local_seal", single, 0, moved, after_options),
        ("outside", proposal, -1, moved, after_options), ("score_boundary", proposal, 0, moved, {**after_options, "score": 2}),
        ("terminal", proposal, 0, moved, {**after_options, "state": "GAME_OVER"}),
        ("experiment", proposal, len(proposal["prefix"]) - 1, rows, after_options),
        ("viewport", proposal, 0, moved[:-1], after_options), ("refuted", proposal, 0, rows, after_options),
        ("nonlocal_reconcile", nonlocal_plan, 0, moved, after_options), ("remote_refutation", proposal, 0, remote_change, after_options)):
        add_case("after_" + name, "check_access_after", dict(plan=plan, index=index, before_rows=rows, after_rows=result_rows, options=options),
                 module.check_access_after(plan, index, rows, result_rows, **options))
    for name, position, mask, value in (("isolated", first["from"], [(0, 0)], 9), ("empty", first["from"], [], 9),
                                      ("outside", (-1, -1), [(0, 0)], 9), ("wrong_value", first["from"], [(0, 0)], 8)):
        add_case("occurs_" + name, "occurs", dict(rows=rows, position=position, mask=mask, value=value), module._occurs(rows, position, mask, value))

    # Persistent memory traces execute original methods, retaining every emitted
    # event and public state. Replay deliberately does not reconstruct episodes.
    scenarios = []

    def memory_scenario(name, operations):
        m, replay = module.GoalAccessMemory(), module.GoalAccessMemory()
        steps = []
        for operation in operations:
            kind = operation["kind"]
            if kind == "apply_event":
                m.apply_event(copy.deepcopy(operation["event"])); replay.apply_event(copy.deepcopy(operation["event"])); events = None
            elif kind == "record":
                b, a = scenes[operation["before"]], scenes[operation["after"]]
                events = m.record(b["observation"], b["rows"], operation["command"], a["observation"], a["rows"], **copy.deepcopy(operation.get("options", {})))
                for event in events:
                    replay.apply_event(copy.deepcopy(event))
            elif kind == "propose":
                current = scenes[operation["scene"]]
                events = m.propose(current["observation"], current["rows"], operation["actions"], operation.get("max_prefix", 16))
            else:
                raise AssertionError(kind)
            state = plain(m.retained_state())
            assert state == plain(replay.retained_state())
            steps.append({"operation": plain(operation), "expected": {"result": plain(events), "retained": state,
                          "episode": [[b.ref, command, a.ref] for b, command, a in m.episode], "last": m.last.ref if m.last else None,
                          "replay": plain(replay.retained_state())}})
        scenarios.append({"id": name, "steps": steps})

    seed = {"kind": "apply_event", "event": {"kind": "goal_approach_retrospective", "models": models}}
    memory_scenario("learn_across_score_boundary", [
        {"kind": "record", "before": a, "command": {"action_ref": command, "data": {}}, "after": b}
        for a, command, b in episode_spec] + [{"kind": "propose", "scene": "learn:entered", "actions": offered}])
    trial_plan = {"status": "proposed", "role": "role:measured", "role_size": [1, 1], "epoch": 1, "score": 0,
                  "trial_key": module.identity(["trial", "registered public context"]), "terminal_site": [15, 12], "terminal_appearance": "earlier_appearance",
                  "possible_effect_families": model["possible_prerequisites"][0]["event_families"],
                  "prefix": [{"action_ref": "ACTION2", "from": [9, 6], "to": [9, 9], "effect": "unknown_then_observe"}]}
    refutation_plan = {"status": "proposed", "role": "role:measured", "trial_key": "unused",
                       "prefix": [{"action_ref": "ACTION4", "from": [3, 3], "to": [6, 3], "effect": "conditional_translation", "premise_ref": "premise:public"}]}
    memory_scenario("contact_refutation_transfer_and_epoch_retention", [seed,
        {"kind": "record", "before": "learn:3", "after": "learn:4", "command": {"action_ref": "ACTION2", "data": {}}, "options": {"plan": trial_plan, "action_index": 0}},
        {"kind": "record", "before": "learn:0", "after": "stationary", "command": {"action_ref": "ACTION4", "data": {}}, "options": {"plan": refutation_plan, "action_index": 0}},
        {"kind": "record", "before": "learn:0", "after": "nonlocal", "command": {"action_ref": "ACTION4", "data": {}}},
        {"kind": "record", "before": "learn:0", "after": "nonlocal", "command": {"action_ref": "ACTION4", "data": {}}},
        {"kind": "record", "before": "learn:0", "after": "different_nonlocal", "command": {"action_ref": "ACTION4", "data": {}}},
        {"kind": "record", "before": "learn:0", "after": "nonlocal", "command": {"action_ref": "ACTION4", "data": {"x": 3, "y": 3}}},
        {"kind": "record", "before": "nonlocal", "after": "epoch_without_score", "command": {"action_ref": "ACTION4", "data": {}}},
        {"kind": "apply_event", "event": {"kind": "goal_approach_retrospective", "models": []}}])
    memory_scenario("whole_scene_return_is_not_a_local_law", [seed,
        {"kind": "record", "before": "learn:0", "after": "learn:1", "command": {"action_ref": "ACTION4", "data": {}}},
        {"kind": "record", "before": "learn:1", "after": "learn:0", "command": {"action_ref": "ACTION4", "data": {}}}])
    # The nullable occurrence path is needed for older verified event logs.
    old_trial = {"kind": "goal_contact_trial", "key": "old:trial", "matched_effect_points": [[0, 0]], "occurrence": None}
    memory_scenario("legacy_trial_without_occurrence", [{"kind": "apply_event", "event": old_trial}])
    add_case("unknown_persisted_event_rejected", "apply_event_error", {"event": {"kind": "invented"}}, function=lambda: module.GoalAccessMemory().apply_event({"kind": "invented"}))
    add_case("canonical_identity", "identity", {"value": {"é": ["😀", True, 2]}}, module.identity({"é": ["😀", True, 2]}))
    add_case("occurrence_identity", "occurrence_at", {"epoch": 2, "role": "role:measured", "site": [9, 9]}, module.occurrence_at(2, "role:measured", (9, 9)))
    add_case("point_translation", "add", {"point": [3, 6], "delta": [-3, 3]}, module.add((3, 6), (-3, 3)))
    sys.setprofile(None)
    fixture = {"schema": "sra.v6.composition-reference.v1", "commit": COMMIT, "sourceHashes": {SOURCE: source_hash},
               "normalization": ["bytes/tuples become integer JSON arrays", "sets sorted lexicographically", "unordered repeated-change regions sorted by public points"],
               "coveredSourceFunctions": sorted(name for name in called if not name.startswith("<")),
               "scenes": scenes, "cases": cases, "scenarios": scenarios}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(plain(fixture), ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"cases": len(cases), "scenarios": len(scenarios), "steps": sum(len(s["steps"]) for s in scenarios),
                      "coveredSourceFunctions": fixture["coveredSourceFunctions"], "output": str(args.output)}))


if __name__ == "__main__":
    main()
