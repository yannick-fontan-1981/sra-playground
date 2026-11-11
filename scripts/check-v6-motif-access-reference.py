#!/usr/bin/env python3
"""Unmodified pinned MotifAccess over independent synthetic contract inputs.

This is a laboratory oracle, never a production dependency. No game definition,
retained game frame, dispatch, game trace or solved-level answer is interpreted.
All 1,786 original files are hashed opaquely before and after source execution.
The original class has no state/restore methods: the explicit snapshot adapter
below only converts Python tuple keys/sets into documented JSON representations.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = ROOT / "reference/v6" / COMMIT / "source"
MANIFEST_PATH = SOURCE.parent / "manifest.json"
sys.dont_write_bytecode = True


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def fingerprint(path):
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": sha(path), "bytes": path.stat().st_size}


def verify_sources(manifest):
    for name, record in manifest.items():
        path = SOURCE / name
        assert path.is_file() and path.stat().st_size == record["bytes"], name
        assert sha(path) == record["sha256"], name
    return len(manifest)


def plain(value):
    if isinstance(value, dict):
        return {key: plain(child) for key, child in value.items()}
    if isinstance(value, (tuple, list)):
        return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)):
        return [plain(child) for child in sorted(value)]
    if hasattr(value, "item"):
        return value.item()
    return value


def tupled(value):
    return tuple(tupled(child) for child in value) if isinstance(value, list) else value


def snapshot(owner):
    """Exact source attributes; only representation (not semantics) is added."""
    result = {"format": "native.motif_access.v1"}
    for name, value in vars(owner).items():
        if name in ("learned", "blocked"):
            result[name] = [[plain(key), plain(child)] for key, child in value.items()]
        else:
            result[name] = plain(value)
    return result


def restore_source(value):
    owner = MotifAccess()
    for name, value in deepcopy(value).items():
        if name == "format":
            continue
        if name in ("learned", "blocked"):
            value = {tupled(key): child for key, child in value}
        elif name in ("tried", "seen"):
            value = {tupled(child) for child in value}
        elif name == "verified":
            value = set(value)
        elif name in ("selected", "tracked", "colors") and value is not None:
            value = tupled(value)
        elif name == "motion":
            value = {key: tuple(child) for key, child in value.items()}
        elif name == "grid" and value is not None:
            value["points"] = [tuple(child) for child in value["points"]]
            value["base"] = tuple(value["base"])
            for card in value["cards"]:
                card["mask"] = tuple(card["mask"])
        elif name == "ray" and value is not None:
            for key in ("card", "direction"):
                if key in value:
                    value[key] = tupled(value[key])
            if "sampled_trajectory" in value:
                value["sampled_trajectory"] = [tupled(child) for child in value["sampled_trajectory"]]
        setattr(owner, name, value)
    return owner


def paint(rows, box, color):
    left, top, right, bottom = box
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            rows[y][x] = color


POINTS = [(3, 20), (7, 20), (3, 24), (7, 24)]
INPUTS = [{"action_ref": "ACTION4"}] + [
    {"action_ref": "ACTION6", "data": {"x": x, "y": y}} for x, y in POINTS
]


def synthetic_rows(position=(3, 4), bits=(), bridge=False, missing_body=False,
                   goal_x=17, width=34, receiver=False, blocker=False):
    """Construct rectangles from declared geometry, independently of native code.

    The access hypothesis is intentionally fallible: any non-background cell
    looks supported to source paths(). A later response can refute that move.
    """
    rows = [[0] * width for _ in range(30)]
    paint(rows, [2, 3, 9, 8], 7)
    if bridge:
        paint(rows, [9, 4, goal_x - 1, 5], 7)
    paint(rows, [goal_x - 2, 2, goal_x + 3, 8], 6)
    paint(rows, [goal_x, 4, goal_x + 1, 5], 3)
    if not missing_body:
        x, y = position
        paint(rows, [x, y, x, y + 1], 3)
        paint(rows, [x + 1, y, x + 1, y + 1], 4)
    if blocker:
        paint(rows, [7, 4, 8, 5], 14)
    if receiver:
        paint(rows, [25, 3, 29, 8], 13)
        paint(rows, [26, 4, 28, 7], 14)
    for index, (x, y) in enumerate(POINTS):
        paint(rows, [x, y, x + 1, y + 1], 12 if index in bits else 10)
    for left, mask in ((14, (0, 3)), (22, (1, 2))):
        paint(rows, [left, 20, left + 4, 24], 9)
        for index in mask:
            rows[20 + 4 * (index // 2)][left + 4 * (index % 2)] = 11
    return rows


def frame(label, rows, revision, epoch=1, completed=0, state="NOT_FINISHED", inputs=None):
    commands = deepcopy(INPUTS if inputs is None else inputs)
    frame_hash = hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16]
    public = {"frame_rows": deepcopy(rows), "frame_packet": [deepcopy(rows)], "frame_hash": frame_hash,
              "level": epoch, "levels_completed": completed, "state": state, "step_index": revision - 1,
              "available_action_refs": list(dict.fromkeys(item["action_ref"] for item in commands))}
    entities = [{"id": part["id"], "bbox": part["bbox"], "area": part["area"],
                 "rectangular": part["rectangular"], "palette_value": part["color"],
                 "position": [part["bbox"][0], part["bbox"][1]]} for part in components(rows)]
    observed = {"observation_ref": "O_synthetic_motif_" + label, "frame_hash": frame_hash,
                "level_epoch": epoch, "levels_completed": completed, "state": state,
                "available_action_refs": public["available_action_refs"], "entities": entities}
    return {"public": public, "observation": observed, "inputs": commands}


def source_proposal(value):
    value = deepcopy(value)
    if value is None:
        return None
    for step in value["steps"]:
        for key in ("body", "bits", "card", "expected_after"):
            if key in step and step[key] is not None:
                step[key] = tupled(step[key])
    return value


def geometry_cases(frames):
    result = []
    def add(name, operation, arguments, answer):
        result.append({"id": name, "operation": operation, "arguments": plain(arguments), "result": plain(answer)})
    for name in ("base", "missing_click", "missing_cell", "two_lattices"):
        f = frames[name]
        add(name, "lattice", {"frame": name},
            lattice(f["observation"], f["public"]["frame_rows"], f["inputs"]))
    for name, colors, expected in (
        ("base", None, None), ("body_missing", None, None), ("two_bodies", None, None),
        ("merged_body", (3, 4), None), ("merged_body", (3, 4), ((3, 4), 2)),
        ("base", (4, 3), ((3, 4), 2)), ("base", (3, 5), ((3, 4), 2)),
        ("base", (3, 4), ((-1, 4), 2)), ("base", (3, 4), ((3, 4), 3)),
    ):
        add(name + ":" + str(len(result)), "body", {"frame": name, "uiTop": 20, "colors": colors, "expected": expected},
            body(frames[name]["public"]["frame_rows"], 20, colors, expected))
    for name, colors in (("base", (3, 4)), ("base", (8, 12)), ("target_missing", (3, 4)), ("two_targets", (3, 4))):
        add(name + ":" + str(colors), "target", {"frame": name, "uiTop": 20, "colors": colors},
            target(frames[name]["public"]["frame_rows"], 20, colors))
    for name, vectors, blocked, goal in (
        ("base", {"E": (2, 0), "S": (0, 2), "W": (-2, 0), "N": (0, -2)}, {}, [17, 4, 18, 5]),
        ("open_base_pose", {"ACTION4": (2, 0)}, {}, [17, 4, 18, 5]),
        ("open_base_pose", {"ACTION4": (2, 0)}, {((3, 4), "ACTION4", 2): rows_digest(projection(frames["open_base_pose"]["public"]["frame_rows"], [5, 4, 6, 5]))}, [17, 4, 18, 5]),
        ("open_base_pose", {"ACTION4": (2, 0)}, {((3, 4), "ACTION4", 2): "0" * 64}, [17, 4, 18, 5]),
        ("base", {"E": (2, 0), "W": (-2, 0)}, {}, [3, 4, 4, 5]),
        ("base", {}, {}, [17, 4, 18, 5]),
        ("base", {"E": (2, 0)}, {}, None),
        ("base", {"W": (-4, 0), "N": (0, -6), "E": (40, 0), "S": (0, 30)}, {}, [17, 4, 18, 5]),
    ):
        rows = frames[name]["public"]["frame_rows"]
        b = body(rows, 20)
        arguments = {"frame": name, "body": b, "motion": vectors, "uiTop": 20,
                     "blocked": [[plain(key), value] for key, value in blocked.items()], "goal": goal}
        known = paths(rows, b, vectors, 20, blocked)
        add(name + ":" + str(len(result)), "paths", arguments,
            [{"position": position, "last": last, "path": path} for (position, last), path in known.items()])
        add(name + ":" + str(len(result)), "route", arguments, route(rows, b, goal, vectors, 20, blocked))
    return result


def run_scenario(label, specifications, frames, initial=None):
    owner = MotifAccess() if initial is None else restore_source(initial)
    proposal = None
    item = {"id": label, "initialState": snapshot(owner), "steps": []}
    for index, specification in enumerate(specifications):
        spec = deepcopy(specification)
        operation = spec["operation"]
        result = None
        if operation == "propose":
            f = frames[spec["frame"]]
            result = proposal = owner.propose(deepcopy(f["observation"]), deepcopy(f["public"]["frame_rows"]),
                                             deepcopy(f["inputs"]), spec.get("remaining", 16))
        elif operation == "bind":
            assert proposal is not None
            f = frames[spec["frame"]]
            records = [{"point": [command["data"]["x"], command["data"]["y"]],
                        "binding": {"binding_id": "B_synthetic_" + str(j),
                                    "coordinate": [command["data"]["x"], command["data"]["y"]],
                                    "observation_ref": f["observation"]["observation_ref"],
                                    "arbitrary_witness": {"origin": "independent_contract", "index": j}}}
                       for j, command in enumerate(f["inputs"]) if command.get("data")]
            spec["records"] = records
            key = (f["observation"]["level_epoch"], f["observation"]["frame_hash"])
            domain = SimpleNamespace(bindings={key: {tuple(r["point"]): r["binding"] for r in records}})
            result = owner.bind(proposal, domain)
            spec["proposalAfter"] = plain(deepcopy(proposal))
        elif operation == "before":
            f = frames[spec["frame"]]
            public, observation = deepcopy(f["public"]), deepcopy(f["observation"])
            public.update(deepcopy(spec.get("publicPatch", {})))
            observation.update(deepcopy(spec.get("observationPatch", {})))
            result = owner.before(proposal, spec.get("index", 0), SimpleNamespace(**public), observation)
        elif operation in ("after", "record"):
            before, after = frames[spec["before"]], frames[spec["after"]]
            pindex = spec.get("index", 0)
            a, b = deepcopy(before["observation"]), deepcopy(after["observation"])
            first, second = deepcopy(before["public"]["frame_rows"]), deepcopy(after["public"]["frame_rows"])
            if operation == "after":
                result = owner.after(proposal, pindex, a, b, first, second)
            else:
                packet_frames = [deepcopy(frames[name]["public"]["frame_rows"]) for name in spec.get("frames", [])]
                result = owner.record(a, b, deepcopy(proposal["actions"][pindex]), first, second,
                                      proposal, pindex, packet_frames)
        elif operation == "restore":
            owner = restore_source(json.loads(json.dumps(snapshot(owner))))
        elif operation == "bits":
            result = owner.bits(frames[spec["frame"]]["public"]["frame_rows"])
        elif operation == "context":
            result = owner.context(frames[spec["frame"]]["public"]["frame_rows"],
                                   tupled(spec["expected"]) if spec.get("expected") else None)
        elif operation == "aligned":
            result = owner.aligned(tuple(spec["position"]), spec["size"], spec["key"], spec["receiver"])
        else:
            raise AssertionError(operation)
        spec["result"] = plain(deepcopy(result))
        spec["afterState"] = snapshot(owner)
        item["steps"].append(spec)
    return item


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="tests/fixtures/v6-motif-access-reference.json")
    parser.add_argument("--receipt", default="docs/migration/lot8a-evidence/contract/reference-oracle.json")
    args = parser.parse_args()
    started = datetime.now(timezone.utc).isoformat()
    manifest = json.loads(MANIFEST_PATH.read_text())["files"]
    before_count = verify_sources(manifest)
    sys.path[:0] = [str(SOURCE / "agents/yf_arc3_v6/laya_proto")]
    global MotifAccess, lattice, body, target, paths, route, components, rows_digest, projection
    from common_motif_access import MotifAccess, lattice, body, target, paths, route
    from geometric_observer import components
    from common_multiscale_constraints import rows_digest, projection

    executed = Counter()
    source_prefix = str(SOURCE) + "/"
    def profile(frame, event, _argument):
        name = frame.f_code.co_filename
        if event == "call" and name.startswith(source_prefix):
            executed[(name[len(source_prefix):], frame.f_code.co_firstlineno, frame.f_code.co_qualname)] += 1
    sys.setprofile(profile)
    frames = {}
    frame_specs = [
        ("base", {}, 1, 1, 0, "NOT_FINISHED"), ("moved", {"position": (5, 4)}, 2, 1, 0, "NOT_FINISHED"),
        ("toggled", {"position": (5, 4), "bits": (0,)}, 3, 1, 0, "NOT_FINISHED"),
        ("open", {"position": (5, 4), "bridge": True}, 4, 1, 0, "NOT_FINISHED"),
        ("walked", {"position": (7, 4), "bridge": True}, 5, 1, 0, "NOT_FINISHED"),
        ("walked9", {"position": (9, 4), "bridge": True}, 6, 1, 0, "NOT_FINISHED"),
        ("walked11", {"position": (11, 4), "bridge": True}, 7, 1, 0, "NOT_FINISHED"),
        ("next_epoch", {}, 8, 2, 1, "NOT_FINISHED"), ("same_pose", {"position": (5, 4), "bridge": True}, 9, 1, 0, "NOT_FINISHED"),
        ("diagonal", {"position": (5, 6)}, 2, 1, 0, "NOT_FINISHED"),
        ("body_missing", {"missing_body": True}, 2, 1, 0, "NOT_FINISHED"),
        ("invoke_missing_body", {"bridge": True, "missing_body": True}, 4, 1, 0, "NOT_FINISHED"),
        ("official_score", {"position": (5, 4), "bits": (0,)}, 3, 1, 1, "NOT_FINISHED"),
        ("official_epoch", {"position": (5, 4), "bits": (0,)}, 3, 2, 0, "NOT_FINISHED"),
        ("official_state", {"position": (5, 4), "bits": (0,)}, 3, 1, 0, "WIN"),
        ("open_base_pose", {"bridge": True}, 1, 1, 0, "NOT_FINISHED"),
        ("far_goal", {"position": (7, 4), "bridge": True, "goal_x": 51, "width": 64}, 10, 1, 0, "NOT_FINISHED"),
        ("ray_before", {"position": (5, 4), "bridge": True, "receiver": True, "blocker": True, "bits": (0,)}, 10, 1, 0, "NOT_FINISHED"),
        ("ray_after", {"position": (5, 4), "bridge": True, "receiver": True, "blocker": True}, 11, 1, 0, "NOT_FINISHED"),
    ]
    for label, options, revision, epoch, completed, state in frame_specs:
        frames[label] = frame(label, synthetic_rows(**options), revision, epoch, completed, state)
    for label in ("missing_click", "missing_cell", "two_bodies", "merged_body", "target_missing", "two_targets", "blocked_changed"):
        rows = deepcopy(frames["open" if label == "blocked_changed" else "base"]["public"]["frame_rows"])
        inputs = deepcopy(INPUTS)
        if label == "missing_click":
            inputs.pop()
        elif label == "missing_cell":
            paint(rows, [7, 24, 8, 25], 0)
        elif label == "two_bodies":
            paint(rows, [8, 11, 8, 12], 3); paint(rows, [9, 11, 9, 12], 4)
        elif label == "merged_body":
            paint(rows, [2, 4, 2, 5], 3)
        elif label == "target_missing":
            paint(rows, [17, 4, 18, 5], 6)
        elif label == "two_targets":
            paint(rows, [25, 2, 30, 8], 6); paint(rows, [27, 4, 28, 5], 3)
        elif label == "blocked_changed":
            paint(rows, [7, 4, 8, 5], 14)
        frames[label] = frame(label, rows, 11, inputs=inputs)
    rows = deepcopy(frames["base"]["public"]["frame_rows"]) + [[0] * 34 for _ in range(11)]
    inputs = deepcopy(INPUTS)
    for x, y in ((3, 30), (8, 30), (3, 35), (8, 35)):
        paint(rows, [x, y, x + 2, y + 2], 15)
        inputs.append({"action_ref": "ACTION6", "data": {"x": x, "y": y}})
    frames["two_lattices"] = frame("two_lattices", rows, 1, inputs=inputs)
    rows = [[0] * 34 for _ in range(30)]
    frames["new_epoch_without_grid"] = frame("new_epoch_without_grid", rows, 12, epoch=3, completed=2)
    for label, x in (("ray_projectile_a", 10), ("ray_projectile_b", 12)):
        rows = deepcopy(frames["ray_after"]["public"]["frame_rows"])
        paint(rows, [x, 4, x + 1, 5], 13)
        frames[label] = frame(label, rows, 11)
    geometry = geometry_cases(frames)
    assert geometry[0]["result"]["cards"] == [
        {"mask": [0, 3], "box": [14, 20, 18, 24]}, {"mask": [1, 2], "box": [22, 20, 26, 24]}]
    assert all(case["result"] is None for case in geometry[1:4])

    def op(operation, **args):
        return {"operation": operation, **args}
    acquisition = [
        op("propose", frame="base"), op("record", before="base", after="moved"),
        op("propose", frame="moved"), op("bind", frame="moved"),
        op("after", before="moved", after="toggled"), op("record", before="moved", after="toggled"),
        op("restore"), op("propose", frame="toggled"), op("bind", frame="toggled"),
    ]
    complete = acquisition + [
        op("before", frame="toggled"), op("after", before="toggled", after="open"),
        op("record", before="toggled", after="open"), op("propose", frame="open"),
        op("before", frame="open"), op("after", before="open", after="walked"),
        op("record", before="open", after="walked"), op("propose", frame="walked", remaining=2),
        op("before", frame="walked"), op("after", before="walked", after="walked9"),
        op("record", before="walked", after="walked9"), op("before", frame="walked9", index=1),
        op("after", before="walked9", after="walked11", index=1), op("record", before="walked9", after="walked11", index=1),
        op("restore"), op("propose", frame="walked11", remaining=0),
        op("propose", frame="next_epoch"), op("restore"), op("propose", frame="new_epoch_without_grid"),
    ]
    scenarios = [run_scenario("cold_calibrate_toggle_invoke_effect_access_epoch", complete, frames)]
    modes = [step["result"]["steps"][0]["mode"] for step in scenarios[0]["steps"]
             if step["operation"] == "propose" and step["result"]]
    assert modes[:6] == ["calibrate", "toggle", "invoke", "walk", "walk", "toggle"], modes
    acquired = deepcopy(scenarios[0]["steps"][15]["afterState"])
    assert acquired["motion"] == {"ACTION4": [2, 0]} and acquired["learned"] == [[[0, 3], {"ref": "O_synthetic_motif_open", "body_change": False}]]
    scenarios.append(run_scenario("remaining_zero_is_caller_boundary_not_source_calibration", [
        op("propose", frame="base", remaining=0), op("record", before="base", after="moved"),
        op("propose", frame="moved", remaining=0), op("restore"),
    ], frames))
    scenarios.append(run_scenario("long_measured_route_caps_at_sixteen", [
        op("propose", frame="far_goal", remaining=100), op("restore"),
        op("propose", frame="far_goal", remaining=1), op("propose", frame="far_goal", remaining=0),
    ], frames, acquired))
    for bad_frame in ("missing_click", "missing_cell", "two_lattices", "two_bodies", "body_missing"):
        scenarios.append(run_scenario("cold_unique_acquisition:" + bad_frame, [op("propose", frame=bad_frame)], frames))
    scenarios.append(run_scenario("calibration_non_axial_response_is_not_motion", [
        op("propose", frame="base"), op("after", before="base", after="diagonal"),
        op("record", before="base", after="diagonal"), op("propose", frame="diagonal"), op("restore"),
    ], frames))
    scenarios.append(run_scenario("toggle_contrary_effect_retires_owner", [
        op("propose", frame="base"), op("record", before="base", after="moved"),
        op("propose", frame="moved"), op("after", before="moved", after="moved"),
        op("record", before="moved", after="moved"), op("restore"), op("propose", frame="moved"),
    ], frames))
    scenarios.append(run_scenario("invoke_unmeasurable_body_is_source_body_change_true",
        acquisition + [op("after", before="toggled", after="invoke_missing_body"),
                       op("record", before="toggled", after="invoke_missing_body"),
                       op("propose", frame="invoke_missing_body"), op("restore")], frames))
    guard_specs = [op("propose", frame="base"), op("before", frame="base"),
        op("before", frame="base", publicPatch={"level": 2}),
        op("before", frame="base", publicPatch={"levels_completed": 1}),
        op("before", frame="base", publicPatch={"available_action_refs": []}),
        op("before", frame="base", observationPatch={"observation_ref": "O_changed"}),
        op("before", frame="moved", observationPatch={"observation_ref": "O_synthetic_motif_base"}),
        op("before", frame="body_missing", observationPatch={"observation_ref": "O_synthetic_motif_base"}),
        op("after", before="base", after="official_epoch"), op("after", before="base", after="official_score"),
        op("after", before="base", after="official_state"), op("record", before="base", after="official_score"),
        op("restore"), op("propose", frame="next_epoch")]
    scenarios.append(run_scenario("guards_and_official_boundary_are_separate_from_geometry", guard_specs, frames))
    walk_prefix = [op("propose", frame="open")]
    # This state was acquired entirely by the first cold synthetic chain.
    for after_name in ("same_pose", "blocked_changed"):
        scenarios.append(run_scenario("walk_refutation_digest:" + after_name, walk_prefix + [
            op("after", before="open", after="same_pose"), op("record", before="open", after="same_pose"),
            op("restore"), op("propose", frame=after_name)], frames,
            scenarios[0]["steps"][11]["afterState"]))
    scenarios.append(run_scenario("alignment_cardinal_and_opposite", [
        op("aligned", position=[5, 4], size=2, key="ACTION4", receiver=[25, 3, 29, 6]),
        op("aligned", position=[5, 4], size=2, key="ACTION4", receiver=[0, 3, 2, 6]),
        op("aligned", position=[5, 4], size=2, key="MISSING", receiver=[25, 3, 29, 6]),
        op("aligned", position=[5, 4], size=2, key="ACTION4", receiver=[25, 4, 29, 7]),
    ], frames, acquired))
    # A deliberately declared synthetic counterfactual starts from acquired state.
    # It supplies a measured-looking ray hypothesis, not a game or production seed.
    ray_state = deepcopy(scenarios[0]["steps"][5]["afterState"])
    ray_state["blocked"] = [[[[5, 4], "ACTION4", 2],
                            rows_digest(projection(frames["ray_before"]["public"]["frame_rows"], [7, 4, 8, 5]))]]
    scenarios.append(run_scenario("synthetic_linked_ray_witness_and_ambiguous_boundary", [
        op("propose", frame="ray_before"),
        op("record", before="ray_before", after="ray_after", frames=["ray_projectile_a", "ray_projectile_b"]),
        op("restore"), op("propose", frame="ray_after"),
    ], frames, ray_state))
    witness = scenarios[-1]["steps"][1]["afterState"].get("ray")
    assert witness is not None and witness["direction"] == [1, 0]
    ray_aligned = deepcopy(scenarios[-1]["steps"][1]["afterState"])
    receiver = [25, 3, 29, 6]
    ray_aligned["ray"]["receiver"] = receiver
    ray_aligned["ray"]["receiver_digest"] = rows_digest(projection(frames["ray_after"]["public"]["frame_rows"], receiver))
    ray_aligned["ray"]["aimed"] = False
    ray_aligned["facing"] = "ACTION4"
    scenarios.append(run_scenario("empty_aim_path_falls_back_to_card_not_official_success", [
        op("propose", frame="ray_after"), op("restore"),
    ], frames, ray_aligned))
    sys.setprofile(None)
    after_count = verify_sources(manifest)
    imported = sorted({Path(module.__file__).resolve() for module in list(sys.modules.values())
                       if getattr(module, "__file__", None) and Path(module.__file__).resolve().is_relative_to(SOURCE)})
    assert imported and all(path.relative_to(SOURCE).as_posix() in {
        "agents/yf_arc3_v6/laya_proto/common_motif_access.py",
        "agents/yf_arc3_v6/laya_proto/geometric_observer.py",
        "agents/yf_arc3_v6/laya_proto/common_multiscale_constraints.py",
    } for path in imported), imported
    payload = {
        "schema": "logos-engine.v6.motif-access-reference.v1", "referenceCommit": COMMIT,
        "sourceManifest": fingerprint(MANIFEST_PATH), "sourceModified": False,
        "sourceFilesVerifiedBeforeAndAfter": [before_count, after_count],
        "sourceHashes": {path.relative_to(SOURCE).as_posix(): sha(path) for path in imported},
        "generator": fingerprint(Path(__file__)),
        "qualification": "Unmodified pinned component and independent synthetic geometry only; no game data, live dispatch, original caller integration or solved-level claim.",
        "inputOrigin": {"kind": "independently_constructed_contract_geometry", "gamePayloadsInterpreted": 0,
                        "gameActionsDispatched": 0, "nativeOracleAnswersInProduction": False,
                        "opaqueOriginalManifestIntegrityOnly": True},
        "normalization": {
            "tuples": "JSON arrays, preserving element order and all scalar values",
            "sets": "Sorted lexicographically by Python value; set iteration is not a semantic order",
            "tupleKeyDictionaries": "learned and blocked are [key,value] pairs in original insertion order",
            "stateAdapter": "vars(original instance), with only native format tag added; missing attributes remain missing",
            "restoreAdapter": "Fresh original instance then exact reconstruction of tuple keys, tuples and sets; source has no state/restore API",
            "observations": "Only source-read public fields; entities measured by original palette-neutral components on independent rows",
            "frameHash": "SHA256 of compact JSON rows, first 16 hex characters; deterministic synthetic public identifier",
            "proposalsGuardsRecords": "Complete returned objects and all state fields compared; no omitted identity/digest/result fields",
            "rayCounterfactuals": "Explicit synthetic hypotheses derived from the cold acquired state; never a fresh acquisition claim",
            "boundedSearch": "Original finite synthetic domains only; native resource-refusal policy tested separately",
        },
        "executedSourceFunctions": [{"path": path, "line": line, "function": name, "calls": count}
                                   for (path, line, name), count in sorted(executed.items())],
        "frames": frames, "geometry": geometry, "scenarios": scenarios,
    }
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    receipt = {"schema": "logos-engine.v6.motif-access-source-oracle.v1", "status": "passed_original_source_export",
               "startedAt": started, "finishedAt": datetime.now(timezone.utc).isoformat(),
               "command": ["python", "-B", "scripts/check-v6-motif-access-reference.py"],
               "pythonVersion": platform.python_version(), "generator": payload["generator"], "fixture": fingerprint(output),
               "referenceCommit": COMMIT, "sourceManifest": payload["sourceManifest"],
               "sourceFilesVerifiedBeforeAndAfter": [before_count, after_count], "sourceModified": False,
               "importedOriginalFiles": payload["sourceHashes"], "geometryCases": len(geometry),
               "scenarios": len(scenarios), "operations": sum(len(row["steps"]) for row in scenarios),
               "qualification": payload["qualification"], "inputOrigin": payload["inputOrigin"],
               "nativeComparison": "pending targeted native reference test; not asserted by this export"}
    target_receipt = ROOT / args.receipt
    target_receipt.parent.mkdir(parents=True, exist_ok=True)
    target_receipt.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
