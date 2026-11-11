#!/usr/bin/env python3
"""Independent SelectedRigid oracle over declared public geometry.

Importing this exporter performs no original-source import or file scan.
Execution must be explicitly authorized and use the shared performance lock.
No native module, game engine, private level, authored route or native state
is used to generate expected results. The source modules themselves execute
scene measurement, search, proposal, guards, acquisition and event replay.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from copy import deepcopy
import datetime
import gzip
import hashlib
import importlib
import json
import os
from pathlib import Path
import platform
import sys
import time
import traceback
from types import SimpleNamespace

sys.dont_write_bytecode = True
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
DEFAULT_ROOT = Path(__file__).resolve().parents[1]
SCOPE = "original-selected-rigid-synthetic-public"
EMPTY_STATE = {"format": "selected_rigid_events.v1", "events": []}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fingerprint(path):
    data = Path(path).read_bytes()
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False, allow_nan=False)


def write_exclusive(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = (json.dumps(value, separators=(",", ":"), ensure_ascii=False,
                      allow_nan=False) + "\n").encode()
    data = gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw
    with path.open("xb") as target:
        target.write(data)
    return {"path": str(path), **fingerprint(path), "rawBytes": len(raw)}


def verify_original(root):
    pin = Path(root) / "reference/v6" / COMMIT
    manifest = json.loads((pin / "manifest.json").read_text())
    require(manifest["commit"] == COMMIT, "Wrong immutable source commit")
    require(len(manifest["files"]) == 1786, "Original manifest must contain all 1786 files")
    for name, expected in manifest["files"].items():
        require(fingerprint(pin / "source" / name) ==
                {key: expected[key] for key in ("bytes", "sha256")},
                "Changed original source: " + name)
    return {"commit": COMMIT, "files": len(manifest["files"]),
            "manifest": fingerprint(pin / "manifest.json"), "unchanged": True}


def load_original(root):
    root = Path(root).resolve()
    verified = verify_original(root)
    ref = root / "reference/v6" / COMMIT / "source"
    sys.path[:0] = [str(ref / "agents/yf_arc3_v6/laya_proto"), str(ref)]
    family_module = importlib.import_module(
        "agents.yf_arc3_v6.morphology_policy.selected_rigid.family")
    mechanism = importlib.import_module(
        "agents.yf_arc3_v6.morphology_policy.selected_rigid.mechanism")
    neutral = importlib.import_module("neutral_observer")
    domain = importlib.import_module("observed_input_domain")
    bridge = importlib.import_module("src_bridge")
    identity = importlib.import_module("terminal_composition").identity
    config_path = ref / "agents/yf_arc3_v6/morphology_policy/strategy.drm"
    policy_path = ref / "agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json"
    config = json.loads(config_path.read_text())["declarations"][0]["configuration"]["selected_rigid_question"]
    point_limit = json.loads(policy_path.read_text())["input_domain"]["max_point_occurrences"]
    for module in (family_module, mechanism, neutral, domain, bridge):
        require(Path(module.__file__).resolve().is_relative_to(ref),
                "Original import escaped pinned source: " + str(module.__file__))
    return SimpleNamespace(
        root=root, REF=ref, sourceBefore=verified, SelectedRigid=family_module.SelectedRigid,
        family_module=family_module, mechanism=mechanism, measure=neutral.measure,
        ObservedInputDomain=domain.ObservedInputDomain, plain=bridge.plain,
        identity=identity, configuration=config, point_limit=point_limit,
        declared_files=[config_path, policy_path])


def state(oracle, family):
    return deepcopy(oracle.plain(family.state()))


def retained(oracle, family):
    return family.engine.retained_digest()


def derived(oracle, family):
    return oracle.plain({"state": deepcopy(family.engine.rigid_state),
                         "models": deepcopy(family.engine.rigid_models)})


@contextmanager
def source_clock(oracle, clock):
    """Replace only the two modules' time dependency, never source code.

    Fixed clocks are explicit synthetic inputs. Public replay instead supplies
    an independent elapsed clock anchored to an actually observed native read.
    The standard-library time module and receipt clocks are never modified.
    """
    old_family = oracle.family_module.time
    old_mechanism = oracle.mechanism.time
    proxy = SimpleNamespace(perf_counter=clock)
    oracle.family_module.time = proxy
    oracle.mechanism.time = proxy
    try:
        yield
    finally:
        oracle.family_module.time = old_family
        oracle.mechanism.time = old_mechanism


def budget(deadline_ms=61000, now_ms=1000, remaining_level_actions=80):
    return {"levelDeadlineMs": deadline_ms, "observedNowMs": now_ms,
            "remainingLevelActions": remaining_level_actions,
            "clockMode": "declared-fixed-synthetic-clock"}


def install_budget(family, value):
    family.level_deadline = (None if value["levelDeadlineMs"] is None
                             else value["levelDeadlineMs"] / 1000)
    family.remaining_level_actions = value["remainingLevelActions"]


def source_propose(oracle, family, observation, rows, inputs, remaining,
                   configuration, current_budget):
    """Observe the actual internal return once; do not run search twice."""
    install_budget(family, current_budget)
    engine = family.engine
    actual = engine.propose_graph
    internal = {"called": False, "result": None}

    def observed(*args, **kwargs):
        internal["called"] = True
        value = actual(*args, **kwargs)
        internal["result"] = deepcopy(oracle.plain(value))
        return value

    engine.propose_graph = observed
    result = None
    error = None
    try:
        with source_clock(oracle, lambda: current_budget["observedNowMs"] / 1000):
            result = family.propose(deepcopy(observation), deepcopy(rows),
                                    deepcopy(inputs), remaining, deepcopy(configuration))
    except Exception as caught:
        error = {"type": type(caught).__name__, "message": str(caught)}
    finally:
        del engine.propose_graph
    return oracle.plain({
        "proposal": result, "requestedStopReason": family.requested_stop_reason,
        "engineCalled": internal["called"], "engineResult": internal["result"],
        "error": error})


def source_before(oracle, family, proposal, index, public, observation, current_budget):
    install_budget(family, current_budget)
    with source_clock(oracle, lambda: current_budget["observedNowMs"] / 1000):
        return oracle.plain(family.before(deepcopy(proposal), index,
                            SimpleNamespace(**deepcopy(public)), deepcopy(observation)))


def packet(rows, revision=0, epoch=1, completed=0, controls=None, terminal="NOT_FINISHED"):
    return {
        "frame_rows": deepcopy(rows), "frame_packet": [deepcopy(rows)],
        "level": epoch, "levels_completed": completed, "state": terminal,
        "step_index": revision,
        "available_action_refs": list(controls) if controls is not None
            else ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION6"],
        "frame_hash": hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16]}


def observe(oracle, public, scope=SCOPE):
    return oracle.plain(oracle.measure(SimpleNamespace(**deepcopy(public)),
                                      public["step_index"], scope)[0])


class PublicGrid:
    """Named raster construction and named responses, not a game simulator.

    No route, control map or expected decision is supplied to either owner.
    Responses below are test interventions explicitly named in every return.
    The thin top/left frame intentionally exercises the actual source detector.
    """
    def __init__(self, height=5):
        self.width = 64
        self.height = 64
        self.q = 6
        self.origin = [8, 8]
        self.size = [4, height]
        self.background = 0
        self.frame_color = 8
        self.bodies = [
            {"color": 2, "position": [1, 0], "mask": [[0, 0], [0, 1]]},
            {"color": 10, "position": [0, 0], "mask": [[0, 0]]},
            {"color": 5, "position": [3, 0], "mask": [[0, 0]]}]
        self.target_color = 2
        self.target_position = [1, height]
        self.revision = 0
        self.epoch = 1
        self.completed = 0
        self.selected = None
        self.selection_mark = False
        self.available = ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION6"]
        self.extra_pixels = []
        self.extra_receptacles = []
        self.complete_frame = False
        self.hide_receptacle = False

    def rows(self):
        rows = [[self.background] * self.width for _ in range(self.height)]
        ox, oy = self.origin
        w, h = self.size
        left, top = ox - 2, oy - 2
        right, bottom = ox + w * self.q + 1, oy + h * self.q + 1
        for x in range(left, right + 1):
            rows[top][x] = self.frame_color
        for y in range(top, bottom + 1):
            rows[y][left] = self.frame_color
        if self.complete_frame:
            for x in range(left, right + 1):
                rows[bottom][x] = self.frame_color
            for y in range(top, bottom + 1):
                rows[y][right] = self.frame_color
        for body in self.bodies:
            for dx, dy in body["mask"]:
                x = ox + (body["position"][0] + dx) * self.q
                y = oy + (body["position"][1] + dy) * self.q
                for yy in range(y + 1, y + self.q - 1):
                    for xx in range(x + 1, x + self.q - 1):
                        if 0 <= xx < self.width and 0 <= yy < self.height:
                            rows[yy][xx] = body["color"]
        if not self.hide_receptacle:
            target = next(body for body in self.bodies if body["color"] == self.target_color)
            for position in [self.target_position, *self.extra_receptacles]:
                left = ox + position[0] * self.q
                top = oy + position[1] * self.q
                right = left + (max(x for x, y in target["mask"]) + 1) * self.q - 1
                bottom = top + (max(y for x, y in target["mask"]) + 1) * self.q - 1
                for x in range(left, right + 1):
                    rows[top][x] = rows[bottom][x] = target["color"]
                for y in range(top, bottom + 1):
                    rows[y][left] = rows[y][right] = target["color"]
        if self.selection_mark and self.selected is not None:
            body = self.bodies[self.selected]
            dx, dy = body["mask"][0]
            rows[oy + (body["position"][1] + dy) * self.q + 1][
                ox + (body["position"][0] + dx) * self.q + 1] = 13
        for x, y, color in self.extra_pixels:
            rows[y][x] = color
        return rows

    def public(self):
        return packet(self.rows(), self.revision, self.epoch, self.completed, self.available)

    def respond(self, command, response):
        if response in ("select_unchanged", "select_marked"):
            require(command["action_ref"] == "ACTION6", "Fixture selection needs a source point")
            x = (command["data"]["x"] - self.origin[0]) // self.q
            y = (command["data"]["y"] - self.origin[1]) // self.q
            found = [i for i, body in enumerate(self.bodies)
                     if [x - body["position"][0], y - body["position"][1]] in body["mask"]]
            require(len(found) == 1, "Declared synthetic point must have one body")
            self.selected = found[0]
            self.selection_mark = response == "select_marked"
        elif response in ("up", "down", "left", "right", "two_down", "down_score"):
            require(self.selected is not None, "Synthetic response requires prior selection")
            dx, dy = {"up": (0, -1), "down": (0, 1), "left": (-1, 0),
                      "right": (1, 0), "two_down": (0, 2), "down_score": (0, 1)}[response]
            body = self.bodies[self.selected]
            body["position"] = [body["position"][0] + dx, body["position"][1] + dy]
            if response == "down_score":
                self.completed += 1
        elif response == "epoch_boundary":
            self.epoch += 1
            self.completed += 1
            self.selected = None
            self.selection_mark = False
            self.bodies[0]["position"] = [1, 0]
        elif response == "score_only":
            self.completed += 1
        elif response != "unchanged":
            raise ValueError("Unknown declared public response " + response)
        self.revision += 1


def inputs_for(oracle, observation):
    return oracle.plain(oracle.ObservedInputDomain(oracle.point_limit).candidates(observation))


def transition(oracle, family, world, responses=(), remaining=80, host_empty_data=False):
    public = world.public()
    observation = observe(oracle, public)
    inputs = inputs_for(oracle, observation)
    current_budget = budget()
    row = {
        "stateBefore": state(oracle, family), "digestBefore": retained(oracle, family),
        "beforePublic": public, "beforeObservation": observation, "inputs": inputs,
        "remaining": remaining, "budget": current_budget,
        "configuration": deepcopy(oracle.configuration), "returns": []}
    outcome = source_propose(oracle, family, observation, public["frame_rows"], inputs,
                             remaining, oracle.configuration, current_budget)
    row.update(outcome=outcome, proposal=deepcopy(outcome["proposal"]),
               stateAfterPropose=state(oracle, family))
    require(outcome["error"] is None, "Synthetic source proposal raised: " + str(outcome["error"]))
    proposal = outcome["proposal"]
    if responses:
        require(proposal and proposal["status"] == "proposed", "No source proposal for declared response")
        require(len(responses) <= len(proposal["actions"]), "Fixture responses exceed source prefix")
        family.bind(proposal, oracle.ObservedInputDomain(oracle.point_limit))
        row["boundProposal"] = deepcopy(proposal)
        for index, response in enumerate(responses):
            first = world.public()
            before = observe(oracle, first)
            guard = source_before(oracle, family, proposal, index, first, before, current_budget)
            require(guard["admitted"], "Declared dispatch was refused by the original before guard")
            command = deepcopy(proposal["actions"][index])
            if host_empty_data and "data" not in command:
                command["data"] = {}
            source_before_state = state(oracle, family)
            world.respond(command, response)
            second = world.public()
            after = observe(oracle, second)
            after_guard = oracle.plain(family.after(proposal, index, before, after,
                                                   first["frame_rows"], second["frame_rows"]))
            acquired = oracle.plain(family.record(before, after, deepcopy(command),
                                     first["frame_rows"], second["frame_rows"], proposal, index,
                                     second["frame_packet"]))
            acquired_state = state(oracle, family)
            family.restore(deepcopy(family.state()))
            restored = state(oracle, family)
            require(acquired_state == restored, "Original event replay changed source state")
            row["returns"].append(oracle.plain({
                "index": index, "response": response, "command": command,
                "beforePublic": first, "afterPublic": second,
                "beforeObservation": before, "afterObservation": after,
                "stateBefore": source_before_state, "beforeGuard": guard, "afterGuard": after_guard,
                "sourceRecord": acquired, "stateAfter": acquired_state,
                "restoredState": restored, "digestAfter": retained(oracle, family)}))
    row["stateAfter"] = state(oracle, family)
    row["digestAfter"] = retained(oracle, family)
    return oracle.plain(row)


def session_cases(oracle):
    sessions = []

    def run(label, world, operations):
        owner = oracle.SelectedRigid()
        rows = [transition(oracle, owner, world, *operation) for operation in operations]
        sessions.append({"id": label, "cold": True,
                         "origin": "declared-synthetic-public-raster-and-named-responses",
                         "steps": rows})

    run("selection-learning-prefix-restoration-and-epoch", PublicGrid(), [
        (["select_unchanged"],), (["down"], 80, True), (["down", "down"],),
        (["epoch_boundary"],), ([],)])
    run("selection-decoration-and-ambiguous-blocked-control", PublicGrid(), [
        (["select_marked"],), (["unchanged"], 80, True), (["right"],), ([],)])
    run("score-change-still-acquires", PublicGrid(), [
        (["select_unchanged"],), (["down_score"],), ([],)])
    run("two-cell-counterexample-refutes-every-cardinal-model", PublicGrid(), [
        (["select_unchanged"],), (["two_down"],), ([],)])
    mixed = PublicGrid(height=6)
    mixed.bodies[1]["position"] = [1, 4]
    run("blocker-first-is-the-original-cold-choice", mixed, [
        (["select_unchanged"],), (["down"],), ([],)])
    offset_goal = PublicGrid()
    offset_goal.target_position = [2, 5]
    run("offset-receptacle-known-prefix-then-discriminating-control", offset_goal, [
        (["select_unchanged"],), (["down"],), (["down"],)])
    run("common-caller-exact-commands-prefix-and-boundary", PublicGrid(), [
        (["select_unchanged"],), (["down"],),
        (["down", "down", "epoch_boundary"],), ([],)])
    return sessions


def initial_cases(oracle):
    result = []

    def add(label, world=None, current_budget=None, remaining=80,
            config_marker="default", config=None, corruption=None, empty_inputs=False):
        world = world or PublicGrid()
        owner = oracle.SelectedRigid()
        public = world.public()
        original_observation = observe(oracle, public)
        observation = deepcopy(original_observation)
        configuration = deepcopy(oracle.configuration if config_marker == "default" else config)
        current_budget = current_budget or budget()
        if corruption:
            measurement = oracle.mechanism.scene(public["frame_rows"])
            require(measurement is not None, "Ownership intervention needs a measured source scene")
            selected = oracle.mechanism.point(measurement, 0)
            entity = next(e for e in observation["entities"]
                          if [selected["x"] - e["bbox"][0], selected["y"] - e["bbox"][1]]
                          in [list(p) for p in e["mask"]])
            if corruption == "duplicate":
                observation["entities"].append({**deepcopy(entity), "id": entity["id"] + ":duplicate"})
            elif corruption == "missing":
                observation["entities"].remove(entity)
            else:
                raise ValueError(corruption)
        inputs = [] if empty_inputs else inputs_for(oracle, observation)
        outcome = source_propose(oracle, owner, observation, public["frame_rows"],
                                 inputs, remaining, configuration, current_budget)
        result.append(oracle.plain({
            "id": label, "public": public, "observation": observation,
            "originalObservation": original_observation,
            "observationMode": "labelled-owner-intervention" if corruption else "original-public-measurement",
            "inputs": inputs, "inputMode": "explicit-empty-candidate-list" if empty_inputs else "original-domain",
            "configuration": configuration, "remaining": remaining, "budget": current_budget,
            "outcome": outcome, "state": state(oracle, owner), "digest": retained(oracle, owner)}))

    add("numeric-colors-2-5-10-and-source-selection")
    add("candidate-list-does-not-authorize-point", empty_inputs=True)
    add("remaining-zero", remaining=0)
    add("deadline-absent", current_budget=budget(None))
    add("deadline-already-expired", current_budget=budget(1000))
    add("missing-level-action-budget", current_budget=budget(remaining_level_actions=None))
    add("zero-level-budget-is-present-but-not-consumed", current_budget=budget(remaining_level_actions=0))
    add("null-configuration-neutral-fallback", config_marker="override", config=None)
    add("empty-configuration-neutral-fallback", config_marker="override", config={})
    no_click = PublicGrid()
    no_click.available.remove("ACTION6")
    add("selection-action-unavailable", no_click)
    incomplete = PublicGrid()
    incomplete.available.remove("ACTION3")
    add("incomplete-direction-domain-is-blocking", incomplete)
    no_goal = PublicGrid()
    no_goal.hide_receptacle = True
    add("no-measured-receptacle-neutral-fallback", no_goal)
    two_goals = PublicGrid()
    two_goals.extra_receptacles = [[3, 5]]
    add("multiple-receptacles-neutral-fallback", two_goals)
    full_frame = PublicGrid()
    full_frame.complete_frame = True
    add("dense-complete-frame-outside-source-area-filter", full_frame)
    full_board = PublicGrid(height=3)
    full_board.size = [3, 3]
    full_board.target_position = [1, 3]
    full_board.bodies = [
        {"color": 2, "position": [0, 0], "mask": [[0, 0]]},
        {"color": 5, "position": [1, 0],
         "mask": [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]},
        {"color": 10, "position": [0, 1], "mask": [[0, 0], [0, 1]]}]
    add("finite-full-mask-frontier-exhausted-is-unknown", full_board)
    add("two-current-owners", corruption="duplicate")
    add("no-current-owner", corruption="missing")
    translated = PublicGrid()
    translated.origin = [10, 10]
    add("translated-lattice", translated)
    return result


def helper_cases(oracle):
    h = {"scenes": [], "points": [], "inputs": [], "poses": [], "moved": [], "routes": []}
    worlds = [("base", PublicGrid()), ("taller", PublicGrid(6))]
    concave = PublicGrid()
    concave.bodies[0]["mask"] = [[0, 0], [0, 1], [1, 0]]
    concave.bodies[0]["position"] = [1, 1]
    worlds.append(("concave-full-mask", concave))
    disconnected = PublicGrid()
    disconnected.bodies[0]["mask"] = [[0, 0], [0, 2]]
    worlds.append(("same-appearance-disconnected-mask", disconnected))
    for label, world in worlds:
        rows = world.rows()
        measured = oracle.plain(oracle.mechanism.scene(rows))
        h["scenes"].append({"id": label, "rows": rows, "old": None, "expected": measured})
        h["inputs"].append({"id": label, "rows": rows, "available": world.available,
                            "expected": oracle.plain(oracle.mechanism.input_candidates(rows, world.available))})
        if measured is None:
            continue
        positions = oracle.mechanism.poses(measured)
        h["poses"].append({"id": label, "scene": measured, "expected": oracle.plain(positions)})
        for index in range(len(measured["bodies"])):
            h["points"].append({"id": label + "/" + str(index), "scene": measured, "index": index,
                                "expected": oracle.plain(oracle.mechanism.point(measured, index))})
            for direction in oracle.mechanism.DIRS:
                h["moved"].append({"id": label + "/" + str(index) + "/" + str(direction),
                    "scene": measured, "poses": oracle.plain(positions), "index": index,
                    "direction": list(direction),
                    "expected": oracle.plain(oracle.mechanism.moved(measured, positions, index, direction))})
        for active in (None, 0, len(measured["bodies"]) - 1):
            with source_clock(oracle, lambda: 1.0):
                expected = oracle.plain(oracle.mechanism.route(measured, active, 61.0))
            h["routes"].append({"id": label + "/active=" + str(active),
                "scene": measured, "active": active, "budget": budget(),
                "expected": expected, "origin": "original-helper-on-measured-public-scene"})
        changed = deepcopy(rows)
        changed[6][20] = 14
        h["scenes"].append({"id": label + "/retained-geometry-does-not-remeasure-frame",
            "rows": changed, "old": measured,
            "expected": oracle.plain(oracle.mechanism.scene(changed, measured))})
    # Direct finite geometry inputs are labelled independently of raster recognition.
    direct = {
        "geometry": {"q": 6, "origin": [8, 8], "size": [3, 3], "frame_color": 8},
        "bodies": [
            {"key": "2", "color": 2, "position": [0, 0], "mask": [[0, 0], [0, 1], [1, 0]]},
            {"key": "5", "color": 5, "position": [1, 1], "mask": [[0, 0]]},
            {"key": "10", "color": 10, "position": [2, 2], "mask": [[0, 0]]}],
        "receptacle": {"key": "2", "position": [0, 3], "mask": [[0, 0], [0, 1], [1, 0]]}}
    hole_entry = deepcopy(direct)
    hole_entry["bodies"][1]["position"] = [2, 1]
    for label, scene_value, index, direction in (
            ("concave-corner-entry-is-not-a-bbox-collision", hole_entry, 1, (-1, 0)),
            ("real-full-mask-collision", direct, 1, (-1, 0)),
            ("foreign-body-cannot-enter-extra-domain", direct, 2, (0, 1))):
        positions = oracle.mechanism.poses(scene_value)
        h["moved"].append({"id": label, "scene": scene_value, "poses": oracle.plain(positions),
            "index": index, "direction": list(direction),
            "expected": oracle.plain(oracle.mechanism.moved(scene_value, positions, index, direction)),
            "origin": "explicit-finite-geometry-helper-input"})
    goal = deepcopy(direct)
    goal["bodies"][0]["position"] = list(goal["receptacle"]["position"])
    for label, scene_value, active, deadline in (
            ("helper-already-at-goal-not-a-measured-cold-family-case", goal, 0, 61000),
            ("helper-expired-before-expansion", direct, None, 1000)):
        with source_clock(oracle, lambda: 1.0):
            expected = oracle.plain(oracle.mechanism.route(scene_value, active, deadline / 1000))
        h["routes"].append({"id": label, "scene": scene_value, "active": active,
            "budget": budget(deadline), "expected": expected,
            "origin": "explicit-finite-geometry-helper-input"})
    return oracle.plain(h)


def guard_cases(oracle, sessions):
    cases = {"before": [], "after": [], "bind": []}
    first = sessions[0]["steps"][0]
    known = sessions[0]["steps"][2]

    def before_case(label, base, mutation=None, index=0, public=None, observation=None):
        owner = oracle.SelectedRigid()
        owner.restore(deepcopy(base["stateBefore"]))
        proposal = deepcopy(base["proposal"])
        public = deepcopy(public or base["beforePublic"])
        observation = deepcopy(observation or base["beforeObservation"])
        current_budget = deepcopy(base["budget"])
        if mutation:
            mutation(proposal, public, observation, current_budget)
        expected = source_before(oracle, owner, proposal, index, public, observation, current_budget)
        cases["before"].append({"id": label, "stateBefore": base["stateBefore"],
            "proposal": proposal, "index": index, "public": public, "observation": observation,
            "budget": current_budget, "expected": expected})

    before_case("exact-first-binding", first)
    before_case("action-differs-from-plan", first,
        lambda p, public, obs, b: p["actions"][0].update(action_ref="ACTION1"))
    before_case("bundle-action-differs", first,
        lambda p, public, obs, b: p["bundle_template"].update(actions=[]))
    before_case("step-action-differs", first,
        lambda p, public, obs, b: p["steps"][0].update(action={"action_ref": "ACTION1"}))
    before_case("plan-hash-changed", first,
        lambda p, public, obs, b: p["selected_rigid_plan"].update(why="different declared prior"))
    before_case("proposal-id-changed", first,
        lambda p, public, obs, b: p.update(proposal_id="selected-rigid:tampered"))
    before_case("epoch-changed", first, lambda p, public, obs, b: obs.update(level_epoch=2))
    before_case("score-changed", first, lambda p, public, obs, b: obs.update(levels_completed=1))
    before_case("action-unavailable", first, lambda p, public, obs, b: obs.update(available_action_refs=[]))
    before_case("observation-reference-changed", first,
        lambda p, public, obs, b: obs.update(observation_ref=obs["observation_ref"] + ":changed"))
    before_case("deadline-expired", first, lambda p, public, obs, b: b.update(levelDeadlineMs=1000))
    before_case("point-binding-metadata-not-rechecked-by-family", first,
        lambda p, public, obs, b: p["steps"][0]["point_binding"].update(entity_ref="different"))
    before_case("step-expected-after-metadata-not-used", first,
        lambda p, public, obs, b: p["steps"][0].update(expected_after={"counterexample": True}))
    before_case("facts-metadata-not-used-by-family", first,
        lambda p, public, obs, b: p["facts"].update(current_full_masks_measured=False))
    continued = known["returns"][0]
    public = deepcopy(continued["afterPublic"])
    public["frame_rows"][63][63] = 14
    public["frame_packet"] = [deepcopy(public["frame_rows"])]
    public["frame_hash"] = packet(public["frame_rows"])["frame_hash"]
    changed_observation = observe(oracle, public)
    before_case("later-support-keeps-unrelated-raster-change", known, index=1,
                public=public, observation=changed_observation)
    for label, proposal in (("valid", first["proposal"]), ("empty-actions", {**deepcopy(first["proposal"]), "actions": []})):
        owner = oracle.SelectedRigid()
        error = None
        try:
            owner.bind(deepcopy(proposal), None)
        except Exception as caught:
            error = {"type": type(caught).__name__, "message": str(caught)}
        cases["bind"].append({"id": label, "proposal": proposal, "error": error})
    for label, base, record in (
            ("selected-unchanged-still-seals", first, first["returns"][0]),
            ("unknown-control-response-seals", sessions[0]["steps"][1], sessions[0]["steps"][1]["returns"][0]),
            ("known-matching-return", known, known["returns"][0]),
            ("mixed-probe-known-step-does-not-seal", sessions[5]["steps"][2],
             sessions[5]["steps"][2]["returns"][0])):
        source = deepcopy(record)
        for suffix in ("original", "epoch", "score", "terminal-state-only", "unchanged-poses"):
            after = deepcopy(source["afterObservation"])
            later = deepcopy(source["afterPublic"]["frame_rows"])
            if suffix == "epoch":
                after["level_epoch"] += 1
            elif suffix == "score":
                after["levels_completed"] += 1
            elif suffix == "terminal-state-only":
                after["state"] = "WIN"
            elif suffix == "unchanged-poses":
                later = deepcopy(source["beforePublic"]["frame_rows"])
            owner = oracle.SelectedRigid()
            value = owner.after(deepcopy(base["proposal"]), source["index"],
                source["beforeObservation"], after, source["beforePublic"]["frame_rows"], later)
            cases["after"].append({"id": label + "/" + suffix, "proposal": base["proposal"],
                "index": source["index"], "beforeObservation": source["beforeObservation"],
                "afterObservation": after, "rows": source["beforePublic"]["frame_rows"],
                "later": later, "expected": oracle.plain(value)})
    return oracle.plain(cases)


def state_variants(oracle, sessions):
    base = sessions[0]["steps"][2]
    original = deepcopy(base["stateBefore"])
    full_models = deepcopy(sessions[0]["steps"][0]["stateAfter"]["events"][-1]["models"])
    variants = []
    mutations = [
        ("all-events-cleared", lambda s: s.update(events=[])),
        ("selection-hypothesis-cleared", lambda s: s["events"][-1]["state"].update(active=None)),
        ("control-hypotheses-reset", lambda s: s["events"][-1].update(models=deepcopy(full_models))),
        ("all-controls-refuted", lambda s: s["events"][-1].update(models=[])),
        ("old-event-removed-last-snapshot-retained", lambda s: s.update(events=s["events"][1:]))]
    for label, mutation in mutations:
        changed = deepcopy(original)
        mutation(changed)
        owner = oracle.SelectedRigid()
        owner.restore(deepcopy(changed))
        outcome = source_propose(oracle, owner, base["beforeObservation"], base["beforePublic"]["frame_rows"],
            base["inputs"], base["remaining"], oracle.configuration, base["budget"])
        variants.append({"id": label, "origin": "explicit-intervention-on-original-acquired-events",
            "stateBefore": changed, "public": base["beforePublic"], "observation": base["beforeObservation"],
            "inputs": base["inputs"], "remaining": base["remaining"], "configuration": oracle.configuration,
            "budget": base["budget"], "outcome": outcome, "stateAfter": state(oracle, owner),
            "digestAfter": retained(oracle, owner)})
    for epoch in (1, 2):
        changed = deepcopy(original)
        changed["events"][-1]["models"] = []
        public = deepcopy(base["beforePublic"])
        public["level"] = epoch
        observation = observe(oracle, public)
        owner = oracle.SelectedRigid()
        owner.restore(deepcopy(changed))
        outcome = source_propose(oracle, owner, observation, public["frame_rows"],
            inputs_for(oracle, observation), 80, oracle.configuration, budget())
        variants.append({"id": "refuted-models-persist-epoch-" + str(epoch),
            "origin": "explicit-intervention-on-original-acquired-events", "stateBefore": changed,
            "public": public, "observation": observation, "inputs": inputs_for(oracle, observation),
            "remaining": 80, "configuration": oracle.configuration, "budget": budget(),
            "outcome": outcome, "stateAfter": state(oracle, owner), "digestAfter": retained(oracle, owner)})
    # This is deliberately NOT a cold-session claim. The original cold choice
    # selects the blocker. Change only the source-acquired receiver hypothesis
    # and retain whatever the original planner actually returns.
    mixed_base = sessions[4]["steps"][-1]
    changed = deepcopy(mixed_base["stateBefore"])
    current_scene = changed["events"][-1]["state"]["scene"]
    target_index = next(i for i, b in enumerate(current_scene["bodies"])
                        if b["key"] == current_scene["receptacle"]["key"])
    changed["events"][-1]["state"]["active"] = target_index
    owner = oracle.SelectedRigid()
    owner.restore(deepcopy(changed))
    outcome = source_propose(oracle, owner, mixed_base["beforeObservation"],
        mixed_base["beforePublic"]["frame_rows"], mixed_base["inputs"], 80,
        oracle.configuration, budget())
    variants.append({"id": "source-active-target-hypothesis-intervention",
        "origin": "explicit-intervention-on-original-acquired-events-not-a-cold-session",
        "stateBefore": changed, "public": mixed_base["beforePublic"],
        "observation": mixed_base["beforeObservation"], "inputs": mixed_base["inputs"],
        "remaining": 80, "configuration": oracle.configuration, "budget": budget(),
        "outcome": outcome, "stateAfter": state(oracle, owner), "digestAfter": retained(oracle, owner)})
    changed = deepcopy(original)
    changed["events"][-1]["models"] = deepcopy(full_models)
    current = changed["events"][-1]["state"]
    measured = oracle.mechanism.scene(base["beforePublic"]["frame_rows"], current["scene"])
    current["tried"] = [[oracle.identity(oracle.mechanism.poses(measured)), current["active"], action]
                        for action in ("ACTION1", "ACTION2", "ACTION3", "ACTION4")]
    owner = oracle.SelectedRigid()
    owner.restore(deepcopy(changed))
    outcome = source_propose(oracle, owner, base["beforeObservation"], base["beforePublic"]["frame_rows"],
        base["inputs"], 80, oracle.configuration, budget())
    variants.append({"id": "all-current-discriminating-inputs-explicitly-tried",
        "origin": "explicit-intervention-on-original-acquired-events",
        "stateBefore": changed, "public": base["beforePublic"], "observation": base["beforeObservation"],
        "inputs": base["inputs"], "remaining": 80, "configuration": oracle.configuration,
        "budget": budget(), "outcome": outcome, "stateAfter": state(oracle, owner),
        "digestAfter": retained(oracle, owner)})
    return oracle.plain(variants)


def restore_and_foreign_cases(oracle, sessions):
    base = sessions[0]["steps"][2]
    retained_state = deepcopy(base["stateBefore"])
    setup_public = deepcopy(base["beforePublic"])
    setup_public["available_action_refs"].remove("ACTION3")
    setup_observation = observe(oracle, setup_public)
    setup = {"public": setup_public, "observation": setup_observation,
             "inputs": inputs_for(oracle, setup_observation), "remaining": 80,
             "configuration": oracle.configuration, "budget": budget()}
    restores = []
    for label, value in (
            ("empty-event-replay", deepcopy(EMPTY_STATE)),
            ("original-event-replay", retained_state),
            ("wrong-format", {**deepcopy(retained_state), "format": "wrong"}),
            ("extra-top-level-field", {**deepcopy(retained_state), "extra": True}),
            ("foreign-event-kind", {"format": EMPTY_STATE["format"], "events": [{"kind": "foreign"}]})):
        owner = oracle.SelectedRigid()
        owner.restore(deepcopy(retained_state))
        setup_outcome = source_propose(oracle, owner, setup["observation"],
            setup["public"]["frame_rows"], setup["inputs"], setup["remaining"],
            setup["configuration"], setup["budget"])
        before = state(oracle, owner)
        error = None
        try:
            owner.restore(deepcopy(value))
        except Exception as caught:
            error = {"type": type(caught).__name__, "message": str(caught)}
        restores.append({"id": label, "stateBefore": before, "setup": setup,
            "setupOutcome": setup_outcome, "input": value, "error": error,
            "stateAfter": state(oracle, owner), "digestAfter": retained(oracle, owner),
            "ephemeralAfter": {"levelDeadlineMs": owner.level_deadline * 1000,
                "remainingLevelActions": owner.remaining_level_actions,
                "requestedStopReason": owner.requested_stop_reason}})
    records = []
    returned = base["returns"][0]
    for label, proposal in (("no-proposal", None), ("foreign-proposal", {"kind": "another-family"})):
        owner = oracle.SelectedRigid()
        owner.restore(deepcopy(retained_state))
        result = owner.record(returned["beforeObservation"], returned["afterObservation"],
            deepcopy(returned["command"]), returned["beforePublic"]["frame_rows"],
            returned["afterPublic"]["frame_rows"], proposal, 0)
        records.append({"id": label, "stateBefore": retained_state,
            "beforeObservation": returned["beforeObservation"], "afterObservation": returned["afterObservation"],
            "command": returned["command"], "rows": returned["beforePublic"]["frame_rows"],
            "later": returned["afterPublic"]["frame_rows"], "proposal": proposal, "index": 0,
            "expected": oracle.plain(result), "stateAfter": state(oracle, owner)})
    return oracle.plain(restores), oracle.plain(records)


def assert_meaningful(fixture):
    initial = {row["id"]: row for row in fixture["initial"]}
    require(initial["numeric-colors-2-5-10-and-source-selection"]["outcome"]["proposal"] is not None,
            "Baseline synthetic scene must really yield an original proposal")
    require(initial["incomplete-direction-domain-is-blocking"]["outcome"]["requestedStopReason"] ==
            "rigid_direction_domain_incomplete", "Incomplete direction fixture must reach its original refusal")
    require(initial["missing-level-action-budget"]["outcome"]["error"] is not None,
            "Missing current action budget must be exercised")
    require(initial["zero-level-budget-is-present-but-not-consumed"]["outcome"]["proposal"] is not None,
            "Zero level budget source behavior was not exercised")
    require(initial["finite-full-mask-frontier-exhausted-is-unknown"]["outcome"]["requestedStopReason"] ==
            "rigid_conditional_configuration_search_incomplete",
            "Finite unreachable frontier must preserve the original unknown result")
    steps = fixture["sessions"][0]["steps"]
    require(len(steps[0]["stateAfter"]["events"][-1]["models"]) == 24, "Initial competing permutations missing")
    require(len(steps[1]["stateAfter"]["events"][-1]["models"]) < 24, "No discriminating source acquisition")
    require(len(steps[2]["proposal"]["actions"]) > 1, "No actual multi-action source prefix")
    require(steps[3]["returns"][0]["sourceRecord"] is None, "Epoch boundary source return must be null")
    require(steps[3]["stateBefore"] == steps[3]["stateAfter"], "Epoch boundary must preserve acquired events")
    require(fixture["sessions"][2]["steps"][1]["returns"][0]["sourceRecord"] is not None,
            "Score-only boundary must still acquire")
    require(fixture["sessions"][3]["steps"][-1]["outcome"]["requestedStopReason"] ==
            "rigid_control_or_collision_model_refuted", "Two-cell response did not refute cardinal models")
    mixed = fixture["sessions"][5]["steps"][-1]["proposal"]
    require(mixed and mixed["selected_rigid_plan"]["mode"] == "probe" and
            len(mixed["actions"]) > 1 and mixed["selected_rigid_plan"]["expected"][0] is not None,
            "Offset-receptacle cold session did not reach a mixed original prefix")
    require(fixture["sessions"][5]["steps"][2]["returns"][0]["afterGuard"]["seal_prefix"] is False,
            "A known first step in mode probe must remain unsealed")
    exhausted = next(row for row in fixture["stateVariants"]
                     if row["id"] == "all-current-discriminating-inputs-explicitly-tried")
    require(exhausted["outcome"]["requestedStopReason"] == "rigid_control_discrimination_exhausted",
            "Explicit tried-control intervention did not reach the original exhausted refusal")
    guard = {row["id"]: row for row in fixture["guards"]["before"]}
    require(guard["point-binding-metadata-not-rechecked-by-family"]["expected"]["admitted"],
            "Source guard scope counterexample missing")
    require(guard["later-support-keeps-unrelated-raster-change"]["expected"]["admitted"],
            "Continuation guard was not exercised on current support")


def build_fixture(oracle):
    sessions = session_cases(oracle)
    restores, records = restore_and_foreign_cases(oracle, sessions)
    return {
        "schema": "sra.selected-rigid-original-reference.v1",
        "provenance": {
            "commit": COMMIT, "observationScope": SCOPE,
            "scope": "Original SelectedRigid family and consumed helpers on synthetic public inputs; no game or complete-caller parity.",
            "normalization": "Only JSON tuple/list transport; no proposal, event, mask, model, route, tie or action order is normalized.",
            "clock": "Fixed declared clocks for synthetic cases; no elapsed-time performance assertion.",
            "nativeStatesUsedToGenerateExpected": False, "nativePlansUsedToGenerateExpected": False,
            "gameExecution": False, "privateLevelsRead": False, "historicalResultsReused": False},
        "configuration": oracle.configuration, "pointLimit": oracle.point_limit,
        "initial": initial_cases(oracle), "sessions": sessions, "helpers": helper_cases(oracle),
        "guards": guard_cases(oracle, sessions), "stateVariants": state_variants(oracle, sessions),
        "restores": restores, "records": records,
        "coverageLimits": [
            "No game engine, private level, authored route or terminal success is part of this corpus.",
            "Direct helper goal inputs are not claimed as measured cold family scenes.",
            "The 150000-node source cap is retained in source, not claimed exhausted without a corresponding actual receipt.",
            "Native abort, yield and additional resource caps are adaptations tested separately.",
            "Stricter native malformed-event validation is not silently attributed to the weak source event validator."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    require(not args.out.exists() and not args.receipt.exists(), "Retain previous attempts; choose fresh output paths")
    require(os.environ.get("PYTHONHASHSEED") == "0", "Run with PYTHONHASHSEED=0")
    start = time.monotonic()
    receipt = {"schema": "sra.selected-rigid-original-export-execution.v1",
        "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "python": platform.python_version(), "pythonHashSeed": os.environ.get("PYTHONHASHSEED"),
        "exporter": {"path": str(Path(__file__)), **fingerprint(Path(__file__))},
        "gameExecution": False, "nativeExecution": False, "privateLevelsRead": False,
        "status": "failed"}
    oracle = None
    fixture = None
    try:
        oracle = load_original(args.root)
        receipt["sourceBefore"] = oracle.sourceBefore
        fixture = build_fixture(oracle)
        paths = {Path(module.__file__).resolve() for module in tuple(sys.modules.values())
                 if getattr(module, "__file__", None) and
                 Path(module.__file__).resolve().is_relative_to(oracle.REF)}
        paths.update(oracle.declared_files)
        fixture["provenance"]["sources"] = {
            str(path.relative_to(oracle.REF)): fingerprint(path) for path in sorted(paths)}
        fixture["provenance"]["sourceBefore"] = oracle.sourceBefore
        assert_meaningful(fixture)
        receipt["status"] = "passed"
    except Exception as error:
        receipt["error"] = {"type": type(error).__name__, "message": str(error),
                            "traceback": traceback.format_exc()}
    finally:
        if oracle is not None:
            try:
                receipt["sourceAfter"] = verify_original(args.root)
                require(receipt["sourceAfter"] == oracle.sourceBefore, "Original source changed during export")
                if fixture is not None:
                    fixture["provenance"]["sourceAfter"] = receipt["sourceAfter"]
            except Exception as error:
                receipt["status"] = "failed"
                receipt["integrityError"] = {"type": type(error).__name__, "message": str(error)}
        if fixture is not None:
            fixture["exportStatus"] = receipt["status"]
            receipt["output"] = write_exclusive(args.out, fixture)
            receipt["counts"] = {
                "initialCases": len(fixture["initial"]), "sessions": len(fixture["sessions"]),
                "sourceSteps": sum(len(s["steps"]) for s in fixture["sessions"]),
                "sourceReturns": sum(len(step["returns"]) for s in fixture["sessions"] for step in s["steps"]),
                "helpers": {k: len(v) for k, v in fixture["helpers"].items()},
                "guards": {k: len(v) for k, v in fixture["guards"].items()},
                "stateVariants": len(fixture["stateVariants"]), "restoreCases": len(fixture["restores"]),
                "foreignRecordCases": len(fixture["records"]),
                "importedSourceFiles": len(fixture["provenance"].get("sources", {}))}
        receipt.update(elapsedSeconds=time.monotonic() - start,
            finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            exitCode=0 if receipt["status"] == "passed" else 1)
        write_exclusive(args.receipt, receipt)
        print(json.dumps(receipt, indent=2))
    return receipt["exitCode"]


if __name__ == "__main__":
    raise SystemExit(main())
