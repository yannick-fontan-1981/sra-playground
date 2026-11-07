#!/usr/bin/env python3
"""Execute intact V6 point contrasts and coupled displays on public test images.

These are synthetic geometry/evidence tests, not game solutions. The only
observations supplied to either learner are the original neutral public observer.
"""
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = ROOT / "reference/v6" / COMMIT / "source"
LAYA = SOURCE / "agents/yf_arc3_v6/laya_proto"
sys.path[:0] = [str(LAYA), str(SOURCE)]
import common_point_contrasts as point
import coupled_displays as coupled
from neutral_observer import measure


def plain(value):
    if isinstance(value, dict): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, set): return [plain(v) for v in sorted(value)]
    if isinstance(value, (tuple, list)): return [plain(v) for v in value]
    return value


def observed(rows, revision=1, epoch=1, score=0, state="NOT_FINISHED", actions=("ACTION1", "ACTION5", "ACTION6")):
    frame_hash = hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16]
    public = SimpleNamespace(frame_rows=rows, frame_hash=frame_hash, level=epoch, levels_completed=score, state=state, available_action_refs=actions)
    return measure(public, revision, "point-display-oracle")[0]


def action(x, y): return {"action_ref": "ACTION6", "data": {"x": x, "y": y}}


def box_fill(rows, box, color):
    l, t, r, b = box
    for y in range(t, b + 1):
        for x in range(l, r + 1): rows[y][x] = color


def framed(rows, box, color, border=2):
    l, t, r, b = box
    box_fill(rows, (l - 1, t - 1, r + 1, b + 1), border)
    box_fill(rows, box, color)


def outcome(call):
    try: return {"accepted": True, "value": plain(call())}
    except Exception as error: return {"accepted": False, "error": {"name": type(error).__name__, "message": str(error)}}


def export():
    base = [[0] * 14 for _ in range(10)]
    for x, y in [(2, 2), (3, 2), (2, 3)]: base[y][x] = 1
    box_fill(base, (6, 2, 7, 3), 4); box_fill(base, (10, 6, 11, 7), 4)
    before = observed(base)
    moved = deepcopy(base)
    for x, y in [(2, 2), (3, 2), (2, 3)]: moved[y][x] = 0
    for x, y in [(3, 2), (4, 2), (3, 3)]: moved[y][x] = 1
    after_move = observed(moved, 2)
    moving = [e["signature"] for e in after_move["entities"] if e["palette_value"] == 1]
    commands = [action(6, 2), action(7, 3), action(10, 6), action(3, 2), action(0, 0), action(40, 40), {"action_ref": "ACTION1"}]
    scenes = []
    for identity, observation, anchors in [("without-anchor", before, []), ("unique-moving-anchor", after_move, moving),
                                          ("ambiguous-signature-not-anchor", after_move, [e["signature"] for e in after_move["entities"] if e["palette_value"] == 4]),
                                          ("point-input-unavailable", {**after_move, "available_action_refs": ["ACTION1"]}, moving)]:
        scene = point.SceneRelations(observation, previous_moving_signatures=anchors)
        scenes.append({"id": identity, "observation": observation, "anchors": anchors, "commands": commands,
                       "supports": {key: sorted(values) for key, values in scene.regions.items()},
                       "features": [scene.features(command) for command in commands]})
    overlap = deepcopy(before); overlap["entities"].append({**overlap["entities"][1], "id": "overlapping-copy"})
    scenes.append({"id": "overlapping-supports", "observation": overlap, "anchors": [], "error": outcome(lambda: point.SceneRelations(overlap))})

    def binding(identity, features, mode=None, frame=None, command=None):
        return {"action": command or action(len(identity), 1), "observation_ref": "before:" + identity,
                "mode": mode or [1, "NOT_FINISHED"], "entity_ref": "entity:" + identity, "features": features, "frame_hash": frame or identity}
    red = {"color": "red", "touch": True, "distance": 2, "unicode": "é", "nullable": None}
    blue = {"color": "blue", "touch": False, "distance": 3, "unicode": "ø", "nullable": "present"}
    records = [point.tested_occurrence(binding("positive", red), True, "after:positive"),
               point.tested_occurrence(binding("negative", blue), False, "after:negative")]
    candidates = [binding("mixed-a", {**red, "touch": False}), binding("mixed-b", {**blue, "touch": True}),
                  binding("balanced", {**red, "touch": False, "distance": 3}), binding("agreement", red),
                  binding("missing-null", {k: v for k, v in red.items() if k != "nullable"}),
                  binding("other-epoch", red, [2, "NOT_FINISHED"]), records[0], None]
    contrast_cases = []
    scenarios = [("no-records", [], candidates, []), ("no-positive", records[1:], candidates, []),
                 ("literal-alternatives", records, candidates, []),
                 ("refutation-retained", records + [point.tested_occurrence(binding("counterexample", {**blue, "color": "red"}), False, "after:counterexample")], candidates, []),
                 ("different-mode-does-not-refute", records + [point.tested_occurrence(binding("next-level", red, [2, "NOT_FINISHED"]), False, "after:next-level")], candidates, []),
                 ("duplicate-positive", records + [point.tested_occurrence(binding("repeat", red), True, "after:repeat")], candidates, [])]
    offers = point.contrast_offers(records, candidates)
    pairs = sorted({tuple(pair) for offer in offers for pair in offer["new_contrast_pairs"]})
    scenarios.append(("all-pairs-already-tested", records, candidates, pairs))
    scenarios.append(("partial-pair-exclusion", records, candidates, pairs[:2]))
    boolean = [point.tested_occurrence(binding("bool", {"truth": True, "other": "a"}), True, "after:bool")]
    scenarios.append(("python-bool-equality", boolean, [binding("int", {"truth": 1, "other": "b"})], []))
    for identity, observations, choices, compared in scenarios:
        models = point.contrast_models(observations)
        contrast_cases.append({"id": identity, "records": observations, "candidates": choices, "compared_pairs": compared,
                               "models": models, "forecasts": [None if c is None else point.forecast(models, c) for c in choices],
                               "offers": point.contrast_offers(observations, choices, compared_pairs=compared),
                               "proposal": point.propose_contrast(observations, choices, compared_pairs=compared)})

    memory = point.PointExperimentMemory(); memory_steps = []
    def memory_call(method, arguments, identity):
        arguments = deepcopy(arguments)
        result = outcome(lambda: getattr(memory, method)(*arguments))
        memory_steps.append({"id": identity, "method": method, "arguments": arguments, "outcome": result,
                             "state": plain(vars(memory))})
        return result.get("value")
    memory_call("offers", [before, commands], "no-positive-no-offers")
    memory_call("observe", [before, {"action_ref": "ACTION1"}, after_move, base, moved], "track-moved-signature")
    memory_call("observe", [after_move, {"action_ref": "ACTION5"}, after_move, moved, moved], "retain-anchor-when-stationary")
    changed = deepcopy(moved); box_fill(changed, (6, 2, 7, 3), 6)
    changed_obs = observed(changed, 3)
    memory_call("observe", [after_move, action(6, 2), changed_obs, moved, changed], "first-positive-addressed-support")
    actual_offers = memory_call("offers", [changed_obs, commands], "prebound-feature-contrasts")
    if not actual_offers: raise RuntimeError("Synthetic public fixture produced no discriminating point")
    selected = actual_offers[0]
    after_nochange = observed(changed, 4)
    memory_call("observe", [changed_obs, selected["binding"]["action"], after_nochange, changed, changed, selected], "measure-frozen-contrast")
    memory_call("offers", [after_nochange, commands], "retain-counterexamples-and-pairs")
    memory_call("offer", [after_nochange, commands], "first-offer-api")
    memory_call("observe", [after_nochange, action(40, 40), after_nochange, changed, changed], "reject-unbound-point")
    forged = deepcopy(selected); forged["binding"]["entity_ref"] = "not-the-executed-occurrence"
    memory_call("observe", [after_nochange, action(6, 2), observed(changed, 5), changed, changed, forged], "mismatch-retains-observation-before-rejection")
    next_epoch = observed(changed, 6, epoch=2)
    memory_call("observe", [after_nochange, {"action_ref": "ACTION1"}, next_epoch, changed, changed], "epoch-boundary-clears-moving-only")
    memory_call("offers", [next_epoch, commands], "no-cross-epoch-feature-forecast")
    memory_call("observe", [next_epoch, action(6, 2), observed(changed, 7, epoch=2, state="WIN"), changed, changed], "terminal-clears-moving-only")

    controls = [(4, 6, 7, 8), (16, 6, 19, 8), (28, 6, 31, 8)]
    receivers = [(8, 20, 9, 21), (20, 20, 21, 21), (32, 20, 33, 21)]
    screen = [[0] * 44 for _ in range(28)]
    for b in controls: framed(screen, b, 5)
    for b, v in zip(receivers, [7, 9, 7]): framed(screen, b, v)
    points = [action((b[0] + b[2]) // 2, (b[1] + b[3]) // 2) for b in controls]
    policy = {"question": "Which framed controls alter the observed receiver row?"}
    display = coupled.CoupledDisplays(); display_steps = []
    def display_call(method, arguments, identity):
        arguments = deepcopy(arguments); result = outcome(lambda: getattr(display, method)(*arguments))
        display_steps.append({"id": identity, "method": method, "arguments": arguments, "outcome": result, "state": plain(vars(display))})
        return result.get("value")
    obs = observed(screen)
    display_call("offers", [obs, screen, [{"action_ref": "ACTION1"}, {"action_ref": "ACTION6", "data": {}}], policy], "empty-points-do-not-initialize")
    current = screen
    for i, expected_effect in enumerate(["local_only", "coupled", "unchanged", "other"]):
        obs = observed(current, i * 2 + 1)
        offers = display_call("offers", [obs, current, points, policy], "choose-exposure-" + expected_effect)
        if not offers: raise RuntimeError("Coupled fixture exhausted before required effect: " + expected_effect)
        probe = offers[0]; new = deepcopy(current)
        index = probe["control_index"]
        if expected_effect in ("local_only", "coupled"):
            box_fill(new, controls[index], 6 if coupled.value(new, controls[index]) == 5 else 5)
        if expected_effect == "coupled": box_fill(new, receivers[1], 7)
        if expected_effect == "other": box_fill(new, receivers[0], 8)
        effect = display_call("observe", [probe, observed(new, i * 2 + 2), new], "measure-" + expected_effect)
        if effect != expected_effect: raise RuntimeError((expected_effect, effect))
        current = new
    offers = display_call("offers", [observed(current, 9), current, points, policy], "next-untested-control-state")
    if not offers: raise RuntimeError("Coupled fixture needs a final probe")
    probe = offers[0]
    display_call("observe", [probe, observed(current, 10, epoch=2, score=1), current], "scored-boundary-learns-shape-only")
    scaled = [[0] * 64 for _ in range(56)]
    scaled_controls = [(3, 6, 10, 11), (23, 6, 30, 11), (43, 6, 50, 11)]
    scaled_receivers = [(8, 38, 11, 41), (28, 38, 31, 41), (48, 38, 51, 41)]
    for b in scaled_controls: framed(scaled, b, 5)
    for b in scaled_receivers: framed(scaled, b, 7)
    scaled_points = [action((b[0] + b[2]) // 2, (b[1] + b[3]) // 2) for b in scaled_controls]
    obs2 = observed(scaled, 11, epoch=2, score=1)
    display_call("offers", [obs2, scaled, [{"action_ref": "ACTION1"}], policy], "no-point-does-not-reset-epoch")
    offers2 = display_call("offers", [obs2, scaled, scaled_points, policy], "scaled-shape-inheritance")
    if not offers2: raise RuntimeError("Scored geometric schema did not transfer")
    display_call("observe", [offers2[0], observed(scaled, 12, epoch=3, score=1), scaled], "unscored-epoch-boundary-is-unknown")
    mixed = deepcopy(scaled); mixed[scaled_controls[0][1]][scaled_controls[0][0]] = 6
    display_call("observe", [offers2[0], observed(mixed, 13, epoch=2, score=1), mixed], "nonuniform-support-is-unknown")
    display_call("offers", [observed(mixed, 13, epoch=2, score=1), mixed, scaled_points, policy], "nonuniform-state-abstains")

    display_cases = []
    def display_case(identity, rows, inputs=None, state=None):
        instance = coupled.CoupledDisplays()
        if state:
            for key, item in state.items(): setattr(instance, key, deepcopy(item))
        observation = observed(rows)
        output = instance.offers(observation, rows, points if inputs is None else inputs, policy)
        display_cases.append({"id": identity, "rows": rows, "observation": observation, "inputs": points if inputs is None else inputs,
                              "policy": policy, "initialState": plain(state), "groups": coupled.framed_rows(observation, rows), "offers": output,
                              "state": plain(vars(instance))})
    display_case("initial", screen)
    display_case("two-points-on-same-interior", screen, points + [action(17, 7)])
    ambiguous_screen = deepcopy(screen)
    for l, t, r, b in controls: framed(ambiguous_screen, (l, 12, r, 14), 5)
    display_case("ambiguous-row-pair", ambiguous_screen)
    extra_colors = deepcopy(screen); box_fill(extra_colors, controls[0], 6); box_fill(extra_colors, controls[1], 8)
    display_case("multiple-active-values", extra_colors, state={"epoch": 1, "controls": controls, "receivers": receivers, "initial_value": 5, "history": []})
    inactive = {"epoch": 1, "controls": controls, "receivers": receivers, "initial_value": 5,
                "history": [{"control": i, "state": (5, 5, 5), "new_state": (5, 5, 5), "result": "unchanged", "evidence": "prior"} for i in range(3)]}
    display_case("all-controls-inert", screen, state=inactive)
    tested_state = {**inactive, "history": [{**event, "result": "other"} for event in inactive["history"]]}
    display_case("all-exact-state-inputs-tested", screen, state=tested_state)
    for name, xs in [("fractional-pitch", [3, 9, 16]), ("irregular-pitch", [3, 8, 16])]:
        frame = [[0] * 24 for _ in range(10)]
        for x in xs: framed(frame, (x, 3, x + 2, 5), 5)
        display_case(name, frame, [])
    broken_border = deepcopy(screen); broken_border[5][4] = 3
    display_case("broken-frame-border", broken_border)
    same_shape = deepcopy(screen)
    box_fill(same_shape, (0, 18, 43, 27), 0)
    for b, color in zip([(4, 20, 7, 22), (16, 20, 19, 22), (28, 20, 31, 22)], [7, 9, 7]): framed(same_shape, b, color)
    display_case("equal-shapes-without-scored-schema", same_shape)

    paths = [LAYA / name for name in ["common_point_contrasts.py", "coupled_displays.py", "neutral_observer.py", "geometric_observer.py"]]
    payload = {"schema": "logos-engine.v6.point-display.oracle.v1", "commit": COMMIT,
               "scope": "Original code on neutral measurements of synthetic public images; no private game state or solution is included.",
               "sourceHashes": {str(path.relative_to(SOURCE)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths},
               "scenes": scenes, "contrasts": contrast_cases, "pointMemorySteps": memory_steps,
               "displaySteps": display_steps, "displayCases": display_cases,
               "valueCases": [{"rows": [[1, 1], [1, 2]], "box": b, "expected": coupled.value([[1, 1], [1, 2]], b)}
                              for b in [(0, 0, 1, 0), (0, 0, 1, 1), (-1, -1, -1, -1), (1, 1, 0, 0)]]}
    target = ROOT / "tests/fixtures/v6-point-display-reference.json"
    target.write_text(json.dumps(plain(payload), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8")
    print(json.dumps({"scenes": len(scenes), "contrasts": len(contrast_cases), "pointMemorySteps": len(memory_steps),
                      "displaySteps": len(display_steps), "displayCases": len(display_cases), "bytes": target.stat().st_size}))


if __name__ == "__main__": export()
