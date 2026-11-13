#!/usr/bin/env python3
"""Intact five-module prospective-contact oracle over public synthetic rasters.

No game API, private state, source-to-target route, or solution enters the agent.
All component observations are produced by the unchanged neutral observer.
"""
from pathlib import Path
from copy import deepcopy
from types import SimpleNamespace
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = ROOT / "reference/v6" / COMMIT / "source"
LAYA = SOURCE / "agents/yf_arc3_v6/laya_proto"
sys.path[:0] = [str(LAYA), str(SOURCE)]
import effect_access as effect
import factored_return as factored
import scored_local_rewrite as rewrite
import passage_options as passage
import prospective_contact_adapter as prospective
from terminal_composition import Snapshot, identity
from neutral_observer import measure

SOURCE_NAMES = ["effect_access.py", "factored_return.py", "scored_local_rewrite.py", "passage_options.py", "prospective_contact_adapter.py"]
CLASSES = {"EffectAccess": effect.EffectAccess, "FactoredEffectAccess": factored.FactoredEffectAccess,
           "ScoredRewriteAccess": rewrite.ScoredRewriteAccess, "PassageOptions": passage.PassageOptions,
           "ProspectiveContactAdapter": prospective.ProspectiveContactAdapter}


def plain(value):
    if hasattr(value, "__dataclass_fields__"): return {k: plain(getattr(value, k)) for k in value.__dataclass_fields__}
    if isinstance(value, dict): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    if isinstance(value, (tuple, list, bytes)): return [plain(v) for v in value]
    return value


def state(instance):
    if isinstance(instance, prospective.ProspectiveContactAdapter):
        memory = instance.memory
        return plain({**memory.retained_state(), "episode": memory.episode, "last": memory.last, "pre_score": state(memory.pre_score)})
    result = dict(vars(instance))
    result["_changes"] = [[list(pair), {key: sorted([sorted(region) for region in regions]) for key, regions in groups.items()}]
                          for pair, groups in instance._changes.items()]
    return plain(result)


def output(call):
    try: return {"accepted": True, "value": plain(call())}
    except Exception as error: return {"accepted": False, "error": {"name": type(error).__name__, "message": str(error)}}


def main():
    scenes, snapshots, episodes, cases, helper_cases = {}, {}, {}, [], []
    called = {name: set() for name in SOURCE_NAMES}
    def profile(frame, event, _arg):
        if event == "call":
            path = Path(frame.f_code.co_filename)
            if path.parent == LAYA and path.name in called: called[path.name].add(frame.f_code.co_qualname)
    sys.setprofile(profile)

    def scene(name, rows, epoch=1, score=0, status="NOT_FINISHED"):
        rows = deepcopy(rows)
        digest = hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16]
        public = SimpleNamespace(frame_rows=rows, frame_hash=digest, level=epoch, levels_completed=score,
                                 state=status, available_action_refs=("ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "ACTION6"))
        observation, _ = measure(public, len(scenes) + 1, "prospective-oracle")
        observation["observation_ref"] = name
        scenes[name] = {"observation": observation, "rows": rows}; snapshots[name] = Snapshot.from_public(observation, rows)
        return name

    def episode(name, transitions):
        episodes[name] = transitions
        return [(snapshots[b], action, snapshots[a]) for b, action, a in transitions]
    def read_episode(name): return [(snapshots[b], action, snapshots[a]) for b, action, a in episodes[name]]

    def run(identity, instance, method, args):
        initial = state(instance)
        def invoke():
            if method in ("propose", "propose_effect", "propose_scored_rewrite", "propose_passage_options"):
                s = scenes[args["scene"]]
                if isinstance(instance, prospective.ProspectiveContactAdapter):
                    if method == "propose": return instance.propose(s["observation"], s["rows"], args["inputs"], args["limit"])
                    return getattr(instance, method)(s["observation"], s["rows"], args["inputs"], args["limit"], args["config"])
                return instance.propose(read_episode(args["episode"]), s["observation"], s["rows"], args["inputs"], args["limit"], args["config"])
            if method == "propose_factored": return instance.propose_factored(scenes[args["scene"]]["observation"], args["inputs"], args["limit"])
            if method == "before": return instance.before(args["proposal"], args["index"], scenes[args["scene"]]["rows"], **args["metadata"])
            if method == "after": return instance.after(args["proposal"], args["index"], scenes[args["first"]]["rows"], scenes[args["last"]]["rows"], **args["metadata"])
            if method == "record":
                b, a = scenes[args["before"]], scenes[args["after"]]
                if isinstance(instance, prospective.ProspectiveContactAdapter):
                    return instance.record(b["observation"], b["rows"], args["command"], a["observation"], a["rows"], proposal=args["proposal"], index=args["index"])
                return instance.record(b["observation"], args["command"], a["observation"], b["rows"], a["rows"], args["proposal"], args["index"])
            if method == "apply_event":
                if isinstance(instance, prospective.ProspectiveContactAdapter): return instance.memory.apply_event(args["event"])
                return instance.apply_event(args["event"])
            raise ValueError(method)
        result = output(invoke)
        cases.append({"id": identity, "class": type(instance).__name__, "method": method, "arguments": deepcopy(args),
                      "initialState": initial, "outcome": result, "state": state(instance),
                      "retainedDigest": instance.memory.pre_score.retained_digest() if isinstance(instance, prospective.ProspectiveContactAdapter) else instance.retained_digest()})
        return result.get("value")

    def helper(identity, operation, args, call): helper_cases.append({"id": identity, "operation": operation, "arguments": deepcopy(args), "outcome": output(call)})
    config = {"minimum_passage_positions": 2, "test_alternative_part_arrangements": True,
              "initial_contact_question": {"enabled": False, "purpose": "Measure the outcome of a newly bound visible material contact."},
              "test_factored_return": True, "rebind_scored_local_rewrites": True,
              "compare_scored_passage_options": True, "passage_lookahead": 2}
    inputs = [{"action_ref": "ACTION" + str(i)} for i in range(1, 5)]

    def motion_rows(position, *, remote=6, goal=8, extra=(), size=1):
        rows = [[0] * 24 for _ in range(20)]
        for x, y, color in [(1, 1, 11), (2, 1, 11), (21, 1, 12), (21, 2, 12), (1, 17, 13), (2, 17, 13), (1, 18, 13),
                            (6, 9, 5), (15, 12, goal), (3, 15, remote), (6, 15, remote), *extra]: rows[y][x] = color
        x, y = position
        for py in range(y, y + size):
            for px in range(x, x + size): rows[py][px] = 9
        return rows

    positions = [(3, 3), (6, 3), (9, 3), (9, 6), (9, 9), (6, 9), (3, 9), (3, 12)]
    commands = ["ACTION4", "ACTION4", "ACTION2", "ACTION2", "ACTION3", "ACTION3", "ACTION4"]
    for i, position in enumerate(positions): scene("effect:" + str(i), motion_rows(position, remote=7 if i == 7 else 6, goal=4 if i == 7 else 8))
    effect_transitions = [["effect:" + str(i), command, "effect:" + str(i + 1)] for i, command in enumerate(commands)]
    episode("effect", effect_transitions); episode("initial", effect_transitions[:6]); episode("short", effect_transitions[:2]); episode("empty", [])
    base_args = {"episode": "effect", "scene": "effect:7", "inputs": inputs, "limit": 16, "config": config}
    effect_instance = effect.EffectAccess()
    effect_proposal = run("effect-remote-positive", effect_instance, "propose", base_args)
    if effect_proposal.get("kind") != "observed_effect_access": raise RuntimeError(("Missing positive effect proposal", effect_proposal))
    run("effect-short-episode", effect.EffectAccess(), "propose", {**base_args, "episode": "short"})
    run("effect-prefix-cap", effect.EffectAccess(), "propose", {**base_args, "limit": 2})
    run("effect-initial-disabled", effect.EffectAccess(), "propose", {**base_args, "episode": "initial", "scene": "effect:6"})
    enabled = {**config, "initial_contact_question": {**config["initial_contact_question"], "enabled": True}}
    initial_proposal = run("effect-initial-question", effect.EffectAccess(), "propose", {**base_args, "episode": "initial", "scene": "effect:6", "config": enabled})
    if initial_proposal.get("status") != "proposed": raise RuntimeError("Initial contact fixture did not produce a proposal")
    run("effect-no-available-movement", effect.EffectAccess(), "propose", {**base_args, "inputs": [{"action_ref": "ACTION6", "data": {"x": 1, "y": 1}}]})
    helper("support-halo", "support_box", {"origin": [3, 4], "size": [2, 3]}, lambda: sorted(effect.support_box((3, 4), (2, 3))))
    path = effect_proposal["effect_plan"]["prefix"]
    for index, step in enumerate(path):
        first = scene("effect:prefix:" + str(index), motion_rows(tuple(step["from"]), remote=7, goal=4))
        last = scene("effect:prefix:" + str(index + 1), motion_rows(tuple(step["to"]), remote=7, goal=4))
        metadata = {"epoch": 1, "score": 0, "available": [x["action_ref"] for x in inputs], "observation_ref": effect_proposal["effect_plan"]["observation_ref"] if index == 0 else first}
        run("effect-before-" + str(index), effect_instance, "before", {"proposal": effect_proposal, "index": index, "scene": first, "metadata": metadata})
        run("effect-after-" + str(index), effect_instance, "after", {"proposal": effect_proposal, "index": index, "first": first, "last": last, "metadata": {"epoch": 1, "score": 0, "state": "NOT_FINISHED"}})
        run("effect-record-" + str(index), effect_instance, "record", {"proposal": effect_proposal, "index": index, "before": first, "after": last, "command": {"action_ref": step["action_ref"]}})
    first = "effect:prefix:0"
    run("effect-stale-before", effect_instance, "before", {"proposal": effect_proposal, "index": 0, "scene": first, "metadata": {"epoch": 2, "score": 0, "available": ["ACTION4"], "observation_ref": first}})
    run("effect-refute-stationary", effect_instance, "record", {"proposal": effect_proposal, "index": 0, "before": first, "after": first, "command": {"action_ref": path[0]["action_ref"]}})
    run("effect-terminal-after", effect_instance, "after", {"proposal": effect_proposal, "index": 0, "first": first, "last": first, "metadata": {"epoch": 1, "score": 0, "state": "WIN"}})
    inverse = deepcopy(effect_proposal); inverse["effect_plan"]["prefix"][0]["effect"] = "test_unpaired_inverse"
    run("effect-inverse-always-seals", effect_instance, "after", {"proposal": inverse, "index": 0, "first": first, "last": "effect:prefix:1", "metadata": {"epoch": 1, "score": 0, "state": "NOT_FINISHED"}})
    run("effect-replay-contact", effect.EffectAccess(), "apply_event", {"event": next(c["outcome"]["value"][0] for c in cases if c["id"] == "effect-record-" + str(len(path)-1))})
    run("effect-reject-foreign-event", effect.EffectAccess(), "apply_event", {"event": {"kind": "unknown"}})

    # Two material rewrites plus a separately translated band, followed by an
    # exact observed recurrence. Only the projection combination is forecast.
    masks = [[(0, 0), (0, 1), (1, 0)], [(0, 0), (1, 0), (1, 1)], [(0, 1), (1, 0), (1, 1)]]
    origins = [(2, 5), (7, 5), (12, 5)]
    def factor_rows(band, rewritten=(), positions=origins, extra_shapes=()):
        rows = [[0] * 18 for _ in range(10)]; rows[1][1 + band] = 10
        for i, (origin, mask) in enumerate(zip(positions, masks)):
            for dx, dy in mask: rows[origin[1] + dy][origin[0] + dx] = 6 if i in rewritten else 5
        for origin, mask in extra_shapes:
            for dx, dy in mask: rows[origin[1] + dy][origin[0] + dx] = 5
        return rows
    states = [(0, []), (1, [0]), (2, [0]), (3, [0]), (4, [0, 1]), (5, [0, 1]), (0, [])]
    for i, (band, rewritten) in enumerate(states): scene("factor:" + str(i), factor_rows(band, rewritten))
    factor_actions = ["ACTION1", "ACTION5", "ACTION5", "ACTION2", "ACTION1", "ACTION5"]
    factor_episode = episode("factor", [["factor:" + str(i), a, "factor:" + str(i + 1)] for i, a in enumerate(factor_actions)])
    factor_inputs = [{"action_ref": "ACTION" + str(i)} for i in [1, 2, 3, 5]]
    helper("factor-partition-row", "partition", {"scene": "factor:0", "axis": "row", "indices": [1]}, lambda: factored.partition(scenes["factor:0"]["rows"], "row", [1]))
    helper("factor-partition-column", "partition", {"scene": "factor:0", "axis": "column", "indices": [2, 7]}, lambda: factored.partition(scenes["factor:0"]["rows"], "column", [2, 7]))
    helper("measured-independent-band", "measured_partitions", {"episode": "factor", "exclude_last": True}, lambda: factored.measured_partitions(factor_episode[:-1]))
    for name, limit, offered in [("factored-positive", 16, factor_inputs), ("factored-cap-too-small", 2, factor_inputs), ("factored-no-unique-novel", 16, factor_inputs + [{"action_ref": "ACTION4"}])]:
        helper(name, "factored_proposal", {"episode": "factor", "scene": "factor:6", "inputs": offered, "limit": limit}, lambda limit=limit, offered=offered: factored.factored_proposal(factor_episode, scenes["factor:6"]["observation"], offered, limit))
    factor_proposal = helper_cases[-3]["outcome"]["value"]
    if factor_proposal is None: raise RuntimeError("Factored-return positive fixture did not bind")
    run("factor-provider-fallback", factored.FactoredEffectAccess(), "propose", {"episode": "factor", "scene": "factor:6", "inputs": factor_inputs, "limit": 16, "config": config})
    run("factor-provider-disabled", factored.FactoredEffectAccess(), "propose", {"episode": "factor", "scene": "factor:6", "inputs": factor_inputs, "limit": 16, "config": {**config, "test_factored_return": False}})
    scene("factor:replay0", factor_rows(0)); scene("factor:replay1", factor_rows(1, [0])); scene("factor:replay2", factor_rows(2, [0, 1]))
    scene("rewrite:next", factor_rows(0, [], positions=[(3, 3), (8, 3), (13, 3)], extra_shapes=[((3, 7), masks[0])]), epoch=2, score=1)
    scored = rewrite.ScoredRewriteAccess()
    for index in range(3):
        before = "factor:replay" + str(index); after = "factor:replay" + str(index + 1) if index < 2 else "rewrite:next"
        step = factor_proposal["factor_plan"]["steps"][index]
        run("factor-before-" + str(index), scored, "before", {"proposal": factor_proposal, "index": index, "scene": before,
            "metadata": {"epoch": 1, "score": 0, "available": [a["action_ref"] for a in factor_inputs], "observation_ref": factor_proposal["factor_plan"]["observation_ref"] if index == 0 else before}})
        run("factor-after-" + str(index), scored, "after", {"proposal": factor_proposal, "index": index, "first": before, "last": after,
            "metadata": {"epoch": 1 if index < 2 else 2, "score": 0 if index < 2 else 1, "state": "NOT_FINISHED"}})
        run("factor-rewrite-record-" + str(index), scored, "record", {"proposal": factor_proposal, "index": index, "before": before, "after": after, "command": {"action_ref": step["action_ref"]}})
    if scored.model is None: raise RuntimeError("Scored rewrite model was not acquired from the factored records")
    helper("rewrite-public-differences", "local_rewrites", {"before": "factor:replay0", "after": "factor:replay1"}, lambda: rewrite.local_rewrites(scenes["factor:replay0"]["observation"], scenes["factor:replay1"]["observation"]))
    helper("rewrite-empty-series", "scored_model", {"series": [], "before": "factor:replay2", "command": "ACTION3"}, lambda: rewrite.scored_model([], scenes["factor:replay2"]["observation"], "ACTION3"))
    rewrite_proposal = run("rewrite-relocated-positive", scored, "propose", {"episode": "empty", "scene": "rewrite:next", "inputs": factor_inputs, "limit": 16, "config": config})
    if rewrite_proposal.get("kind") != "public_scored_rewrite": raise RuntimeError("Scored rewrite not rebound")
    rewritten_rows = deepcopy(scenes["rewrite:next"]["rows"])
    for site in rewrite_proposal["rewrite_plan"]["sites"]:
        for dx, dy in site["mask"]: rewritten_rows[site["origin"][1] + dy][site["origin"][0] + dx] = 6
    scene("rewrite:matched", rewritten_rows, epoch=2, score=1)
    for identity, before_name, later_name, metadata in [("rewrite-matched", "rewrite:next", "rewrite:matched", {"epoch": 2, "score": 1, "state": "NOT_FINISHED"}),
        ("rewrite-refuted", "rewrite:next", "rewrite:next", {"epoch": 2, "score": 1, "state": "NOT_FINISHED"}),
        ("rewrite-boundary", "rewrite:next", "rewrite:next", {"epoch": 3, "score": 2, "state": "NOT_FINISHED"})]:
        run(identity, scored, "after", {"proposal": rewrite_proposal, "index": 0, "first": before_name, "last": later_name, "metadata": metadata})
    run("rewrite-bound-before", scored, "before", {"proposal": rewrite_proposal, "index": 0, "scene": "rewrite:next", "metadata": {"epoch": 2, "score": 1, "available": ["ACTION1", "ACTION2", "ACTION3"], "observation_ref": "rewrite:next"}})
    run("rewrite-stale-before", scored, "before", {"proposal": rewrite_proposal, "index": 0, "scene": "rewrite:next", "metadata": {"epoch": 2, "score": 1, "available": ["ACTION1"], "observation_ref": "stale"}})
    run("rewrite-refutation-record", scored, "record", {"proposal": rewrite_proposal, "index": 0, "before": "rewrite:next", "after": "rewrite:next", "command": rewrite_proposal["actions"][0]})
    run("rewrite-refuted-input-not-reused", scored, "propose", {"episode": "empty", "scene": "rewrite:next", "inputs": factor_inputs, "limit": 16, "config": config})
    samples_before_score = next(c for c in cases if c["id"] == "factor-rewrite-record-2")["initialState"]["series"][factor_proposal["proposal_id"]]
    for identity_name, series, command in [
        ("rewrite-positive-model", samples_before_score, "ACTION3"),
        ("rewrite-command-already-known", samples_before_score, "ACTION1"),
        ("rewrite-one-shape-two-inputs", samples_before_score + [{**samples_before_score[0], "action": "ACTION4"}], "ACTION3"),
        ("rewrite-two-shapes-one-input", [samples_before_score[0], {**samples_before_score[1], "action": "ACTION1"}], "ACTION3"),
    ]:
        helper(identity_name, "scored_model", {"series": series, "before": "factor:replay2", "command": command},
               lambda series=series, command=command: rewrite.scored_model(series, scenes["factor:replay2"]["observation"], command))
    for name, index, first_name, last_name, meta in [
        ("factor-unknown-step-measured", 2, "factor:replay2", "factor:replay2", {"epoch": 1, "score": 0, "state": "NOT_FINISHED"}),
        ("factor-body-forecast-refuted", 0, "factor:replay0", "factor:replay0", {"epoch": 1, "score": 0, "state": "NOT_FINISHED"}),
    ]:
        run(name, scored, "after", {"proposal": factor_proposal, "index": index, "first": first_name, "last": last_name, "metadata": meta})

    # Independent measured lattice displacements persist across scored episodes.
    def passage_rows(position):
        rows = motion_rows(position, size=2)
        rows[9][6] = 0; rows[12][15] = 0; rows[15][3] = 0; rows[15][6] = 0
        return rows
    passage_positions = [(4, 4), (6, 4), (8, 4), (8, 6), (8, 8)]
    for i, position in enumerate(passage_positions): scene("passage:" + str(i), passage_rows(position))
    scene("passage:level2", passage_rows((4, 4)), epoch=2, score=1)
    scene("passage:level3", passage_rows((4, 4)), epoch=3, score=2)
    scene("passage:moved3", passage_rows((6, 4)), epoch=3, score=2)
    passage_instance = passage.PassageOptions()
    for index, action_name in enumerate(["ACTION4", "ACTION4", "ACTION2", "ACTION2"]):
        run("passage-calibrate-" + str(index), passage_instance, "record", {"before": "passage:" + str(index), "after": "passage:" + str(index + 1), "command": {"action_ref": action_name}, "proposal": {}, "index": 0})
    for before_name, after_name in [("passage:4", "passage:level2"), ("passage:level2", "passage:level3")]:
        run("passage-score-" + before_name, passage_instance, "record", {"before": before_name, "after": after_name, "command": {"action_ref": "ACTION4"}, "proposal": {}, "index": 0})
    if len(passage_instance.scores) != 2: raise RuntimeError(("Missing scoring witnesses", passage_instance.scores))
    helper("calibrated-observed-lattice", "calibrated", {"samples": passage_instance.motion_samples}, lambda: (
        passage.calibrated(passage_instance.motion_samples)[0], [[list(compound), sorted(positions)] for compound, positions in passage.calibrated(passage_instance.motion_samples)[1].items()]))
    for name, position, size in [("patch-inner", (4, 4), (2, 2)), ("patch-edge", (0, 0), (2, 2)), ("patch-negative", (-1, 0), (2, 2)), ("patch-outside", (23, 19), (2, 2))]:
        helper(name, "patch", {"scene": "passage:level3", "position": position, "size": size}, lambda position=position, size=size: passage.patch(scenes["passage:level3"]["rows"], position, size))
    passage_proposal = run("passage-options-positive", passage_instance, "propose", {"episode": "empty", "scene": "passage:level3", "inputs": inputs, "limit": 16, "config": config})
    if passage_proposal.get("kind") != "public_passage_options": raise RuntimeError(("Passage options not bound", passage_proposal))
    run("passage-current-binding", passage_instance, "before", {"proposal": passage_proposal, "index": 0, "scene": "passage:level3", "metadata": {"epoch": 3, "score": 2, "observation_ref": "passage:level3", "available": ["ACTION4", "ACTION2"]}})
    run("passage-moved-matches", passage_instance, "after", {"proposal": passage_proposal, "index": 0, "first": "passage:level3", "last": "passage:moved3", "metadata": {"epoch": 3, "score": 2, "state": "NOT_FINISHED"}})
    run("passage-stationary-refutes", passage_instance, "record", {"proposal": passage_proposal, "index": 0, "before": "passage:level3", "after": "passage:level3", "command": passage_proposal["actions"][0]})
    run("passage-refuted-trial-excluded", passage_instance, "propose", {"episode": "empty", "scene": "passage:level3", "inputs": inputs, "limit": 16, "config": config})
    run("passage-explicit-matched-event", passage_instance, "apply_event", {"event": {"kind": "passage_option_result", "trial": "measured-matched", "result": "matched", "after": "public-after"}})
    sparse = passage.PassageOptions(); sparse.motion_samples = deepcopy(passage_instance.motion_samples)
    scene("passage:sparse-up", passage_rows((8, 6)))
    run("passage-single-inverse-sample", sparse, "record", {"before": "passage:4", "after": "passage:sparse-up", "command": {"action_ref": "ACTION1"}, "proposal": {}, "index": 0})
    run("passage-sparse-scored-contact", sparse, "record", {"before": "passage:sparse-up", "after": "passage:level2", "command": {"action_ref": "ACTION1"}, "proposal": {}, "index": 0})
    run("passage-contingent-second-score", sparse, "record", {"before": "passage:level2", "after": "passage:level3", "command": {"action_ref": "ACTION4"}, "proposal": {}, "index": 0})
    run("passage-contingent-command-options", sparse, "propose", {"episode": "empty", "scene": "passage:level3", "inputs": inputs, "limit": 16, "config": config})
    conflict = deepcopy(passage_instance.motion_samples[0]); conflict.update(delta=[-2, 0], dest=[conflict["origin"][0]-2, conflict["origin"][1]])
    contradicting = passage_instance.motion_samples + [conflict]
    helper("calibration-retains-contradictory-motion", "calibrated", {"samples": contradicting}, lambda: (
        passage.calibrated(contradicting)[0], [[list(compound), sorted(positions)] for compound, positions in passage.calibrated(contradicting)[1].items()]))

    # Whole prospective caller: event replay plus the real live episode and
    # last public snapshot are all retained; no provider is substituted.
    adapter = prospective.ProspectiveContactAdapter()
    for index, (b, action_name, a) in enumerate(effect_transitions):
        run("adapter-observe-effect-" + str(index), adapter, "record", {"before": b, "after": a, "command": {"action_ref": action_name}, "proposal": {}, "index": 0})
    run("adapter-effect-provider", adapter, "propose_effect", base_args)
    run("adapter-base-goal-unbound", adapter, "propose", base_args)
    run("adapter-no-scored-rewrite", adapter, "propose_scored_rewrite", base_args)
    run("adapter-no-passage-witnesses", adapter, "propose_passage_options", base_args)
    factor_adapter = prospective.ProspectiveContactAdapter()
    for index, (b, action_name, a) in enumerate(episodes["factor"]):
        run("adapter-factor-observe-" + str(index), factor_adapter, "record", {"before": b, "after": a, "command": {"action_ref": action_name}, "proposal": {}, "index": 0})
    run("adapter-factored-provider", factor_adapter, "propose_factored", {"scene": "factor:6", "inputs": factor_inputs, "limit": 16})
    # Replay observed source events into the nested class, checking digest/state.
    for source_case in list(cases):
        if source_case["method"] == "record" and source_case["class"] in ("ScoredRewriteAccess", "PassageOptions") and source_case["outcome"]["accepted"]:
            for index, event in enumerate(source_case["outcome"]["value"]):
                run("adapter-replay-" + source_case["id"] + ":" + str(index), adapter, "apply_event", {"event": event})
    run("adapter-scored-rewrite-provider", adapter, "propose_scored_rewrite", {**base_args, "scene": "rewrite:next", "inputs": factor_inputs})
    run("adapter-passage-provider", adapter, "propose_passage_options", {**base_args, "scene": "passage:level3"})
    for identity_name, proposal, before_name, after_name, ep, score in [
        ("effect", effect_proposal, "effect:prefix:0", "effect:prefix:1", 1, 0),
        ("factor", factor_proposal, "factor:replay0", "factor:replay1", 1, 0),
        ("rewrite", rewrite_proposal, "rewrite:next", "rewrite:matched", 2, 1),
        ("passage", passage_proposal, "passage:level3", "passage:moved3", 3, 2),
    ]:
        plan = next(proposal[k] for k in ("effect_plan", "factor_plan", "rewrite_plan", "passage_plan") if k in proposal)
        run("adapter-before-dispatch-" + identity_name, adapter, "before", {"proposal": proposal, "index": 0, "scene": before_name,
            "metadata": {"epoch": ep, "score": score, "observation_ref": plan["observation_ref"], "available": ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5"]}})
        run("adapter-after-dispatch-" + identity_name, adapter, "after", {"proposal": proposal, "index": 0, "first": before_name, "last": after_name,
            "metadata": {"epoch": ep, "score": score, "state": "NOT_FINISHED"}})
    uncommitted = {"goal_access_plan": {"status": "unbound_or_no_access"}}
    run("adapter-goal-before-delegates", adapter, "before", {"proposal": uncommitted, "index": 0, "scene": "effect:7", "metadata": {"epoch": 1, "score": 0, "observation_ref": "effect:7", "available": ["ACTION4"]}})
    run("adapter-goal-after-delegates", adapter, "after", {"proposal": uncommitted, "index": 0, "first": "effect:7", "last": "effect:7", "metadata": {"epoch": 1, "score": 0, "state": "NOT_FINISHED"}})
    run("adapter-goal-event-dispatch", adapter, "apply_event", {"event": {"kind": "goal_approach_retrospective", "models": [], "before": "public-before", "after": "public-after"}})
    scoring_adapter = prospective.ProspectiveContactAdapter()
    for index, (b, action_name, a) in enumerate(effect_transitions):
        run("adapter-scoring-history-" + str(index), scoring_adapter, "record", {"before": b, "after": a, "command": {"action_ref": action_name}, "proposal": {}, "index": 0})
    scene("effect:scored-boundary", motion_rows((3, 3), remote=7, goal=4), epoch=2, score=1)
    for index, step in enumerate(path):
        before_name = "effect:7" if index == 0 else "effect:prefix:" + str(index)
        after_name = "effect:scored-boundary" if index == len(path)-1 else "effect:prefix:" + str(index+1)
        run("adapter-record-committed-effect-" + str(index), scoring_adapter, "record", {"before": before_name, "after": after_name,
            "command": {"action_ref": step["action_ref"]}, "proposal": effect_proposal, "index": index})
    run("adapter-recall-after-observed-score", scoring_adapter, "propose", {**base_args, "scene": "effect:scored-boundary"})
    run("adapter-effect-after-observed-score", scoring_adapter, "propose_effect", {**base_args, "scene": "effect:scored-boundary"})
    adapter.memory.models = [{"source": "retained-terminal-hypothesis"}]
    run("adapter-terminal-hypothesis-prioritizes-recall", adapter, "propose_effect", base_args)
    run("adapter-terminal-disables-factored", adapter, "propose_factored", {"scene": "factor:6", "inputs": factor_inputs, "limit": 16})

    sys.setprofile(None)
    paths = [LAYA / name for name in SOURCE_NAMES + ["terminal_composition.py", "goal_access_adapter.py", "neutral_observer.py", "geometric_observer.py"]]
    payload = {"schema": "logos-engine.v6.prospective.oracle.v1", "commit": COMMIT,
               "scope": "Original providers, original neutral measurements, source-produced positive proposals/guards/events over synthetic public rasters; no game or private oracle.",
               "sourceHashes": {str(path.relative_to(SOURCE)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths},
               "calledFunctions": {name: sorted(names) for name, names in called.items()}, "scenes": scenes, "episodes": episodes,
               "helpers": helper_cases, "cases": cases}
    target = ROOT / "tests/fixtures/v6-prospective-reference.json"
    target.write_text(json.dumps(plain(payload), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8")
    print(json.dumps({"helpers": len(helper_cases), "cases": len(cases), "scenes": len(scenes), "bytes": target.stat().st_size,
                      "functions": {name: len(names) for name, names in called.items()}}))


if __name__ == "__main__": main()
