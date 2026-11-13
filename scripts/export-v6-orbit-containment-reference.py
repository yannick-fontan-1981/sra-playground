"""Original-Python goldens for the complete native orbit/containment transfer.

All scenes are public raster experiments. The unchanged observer creates the
entities, sampled commands and bindings; the unchanged family supplies every
expected fit, proposal, guard and learning event. No Python solver ships.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace

COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SITE = Path(__file__).resolve().parents[1]


def plain(value):
    if hasattr(value, "tolist"):
        return value.tolist()
    if isinstance(value, dict):
        return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (set, frozenset)):
        return [plain(item) for item in sorted(value)]
    if isinstance(value, (tuple, list)):
        return [plain(item) for item in value]
    return value


def set_transport(values):
    return sorted([plain(value) for value in values], key=lambda value: json.dumps(value, separators=(",", ":"), sort_keys=True))


def body_transport(body):
    return {"origin": plain(body["origin"]), "shape": plain(body["shape"]), "shell": plain(body["shell"]), "color": body["color"]}


def containment_scene(value):
    if value is None:
        return None
    bodies, goals, assignments, terrain = value
    return {"bodies": [body_transport(body) for body in bodies], "goals": plain(goals), "assignments": plain(assignments), "terrain": plain(terrain)}


def containment_state(memory):
    result = {"format": "native.containment.v1", "epoch": memory.epoch, "positions": plain(memory.positions),
              "events": plain(memory.events), "passed": plain(memory.passed), "previous": plain(memory.previous)}
    if hasattr(memory, "fit"):
        result.update(fit=containment_scene(memory.fit), vectors=plain(memory.vectors), no_moves=set_transport(memory.no_moves), active=memory.active,
                      failed=set_transport(memory.failed), probes=set_transport(memory.probes), motion_refs=plain(memory.motion_refs),
                      selection_tests=set_transport(memory.selection_tests), effect_bounds=plain(memory.effect_bounds))
    if hasattr(memory, "bodies"):
        result.update(bodies=[body_transport(body) for body in memory.bodies], goals=plain(memory.goals), assignments=plain(memory.assignments),
                      terrain=plain(memory.terrain), passable=[plain(value) for value in memory.passable])
    if hasattr(memory, "regions"):
        result["regions"] = [[plain(key), plain(value)] for key, value in memory.regions.items()]
    return result


def orbit_state(memory):
    result = {"format": "native.orbit_constraints.v1", "layout": plain(memory.layout), "history": plain(memory.history), "scored": plain(memory.scored)}
    if hasattr(memory, "contours"):
        result.update(contours=plain(memory.contours), models=[[plain(key), plain(value)] for key, value in memory.models.items()],
                      refs=[[plain(key), value] for key, value in memory.refs.items()], tried=[[plain(key), plain(value)] for key, value in memory.tried.items()])
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=SITE / "reference/v6" / COMMIT / "source")
    parser.add_argument("--output", type=Path, default=SITE / "tests/fixtures/v6-orbit-containment-reference.json")
    args = parser.parse_args()
    root = args.source_root.resolve()
    paths = [f"agents/yf_arc3_v6/laya_proto/{name}.py" for name in ["common_orbit_constraints", "common_containment", "common_multiscale_constraints", "neutral_observer", "geometric_observer", "observed_input_domain"]]
    manifest = json.loads((SITE / "reference/v6" / COMMIT / "manifest.json").read_text())
    hashes = {}
    for path in paths:
        value = hashlib.sha256((root / path).read_bytes()).hexdigest()
        if value != manifest["files"][path]["sha256"]:
            raise ValueError("Reference source changed: " + path)
        hashes[path] = value
    sys.path[:0] = [str(root), str(root / "agents/yf_arc3_v6/laya_proto")]
    import common_orbit_constraints as orbit
    import common_containment as containment
    from neutral_observer import measure
    from observed_input_domain import ObservedInputDomain
    covered = {"orbit": set(), "containment": set()}
    source_files = {str(root / paths[0]): "orbit", str(root / paths[1]): "containment"}

    def profile(frame, event, _arg):
        if event == "call" and frame.f_code.co_filename in source_files:
            covered[source_files[frame.f_code.co_filename]].add(frame.f_code.co_name)

    sys.setprofile(profile)
    scenes, raws, cases, scenarios = {}, {}, [], []

    def observe(name, rows, *, level=1, score=0, actions=("ACTION1", "ACTION2", "ACTION6"), state="NOT_FINISHED"):
        raw = SimpleNamespace(frame_rows=rows, frame_packet=[rows], level=level, levels_completed=score, state=state,
                              step_index=len(scenes), available_action_refs=tuple(actions),
                              frame_hash=hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16])
        observation, _ = measure(raw, len(scenes) + 1, "constraint-reference")
        domain = ObservedInputDomain(4096); inputs = domain.candidates(observation)
        raws[name] = raw
        scenes[name] = {"rows": rows, "observation": plain(observation), "public": plain(vars(raw)), "inputs": plain(inputs),
                        "bindings": [[f"{x},{y}", plain(value)] for (x, y), value in domain.bindings[(level, raw.frame_hash)].items()]}
        return name

    def orbit_rows(arrangement, *, marks=(1, 2, 3, 4), controls=True, ragged=False):
        rows = [[0] * 25 for _ in range(15)]
        for i, value in enumerate(arrangement):
            x, y = 3 + i * 5, 3
            for yy in range(y, y + 2):
                for xx in range(x, x + 2): rows[yy][xx] = value
            for xx in (x - 1, x + 2):
                for yy in (y - 1, y + 2): rows[yy][xx] = marks[i]
        if controls:
            for x, y in ((5, 10), (6, 10), (5, 11)): rows[y][x] = 7
            for x, y in ((12, 10), (13, 10), (13, 11)): rows[y][x] = 8
        if ragged: rows[3][3] = 10
        return rows

    shape = frozenset((x, y) for x in range(3) for y in range(3))
    shell = shape - {(1, 1)}

    def containment_rows(positions, *, goals=((11, 9),), colors=None, interiors=None, barrier=None, erase=False, lost=()):
        rows = [[0] * 21 for _ in range(17)]
        for x, y in goals:
            for yy in range(y - 1, y + 4):
                for xx in range(x - 1, x + 4):
                    if xx in (x - 1, x + 3) or yy in (y - 1, y + 3): rows[yy][xx] = 1
        if barrier is not None:
            for row in rows: row[barrier] = 6
        if not erase:
            for i, (x, y) in enumerate(positions):
                color = colors[i] if colors else 2 + i
                for dx, dy in shell: rows[y + dy][x + dx] = color
                if interiors and i in interiors: rows[y + 1][x + 1] = interiors[i]
        for x, y, value in lost: rows[y][x] = value
        return rows

    def add_case(family, name, operation, arguments, callback, transform=plain):
        item = {"family": family, "id": name, "operation": operation, "arguments": plain(arguments)}
        try: item["expected"] = transform(callback())
        except Exception as error: item["error"] = str(error)
        cases.append(item)
        return item.get("expected")

    observe("orbit:initial", orbit_rows((3, 4, 1, 2)), actions=("ACTION6",))
    observe("orbit:turned", orbit_rows((2, 3, 4, 1)), actions=("ACTION6",))
    observe("orbit:solved", orbit_rows((1, 2, 3, 4)), actions=("ACTION6",))
    observe("orbit:score", orbit_rows((1, 2, 3, 4)), actions=("ACTION6",), score=1)
    observe("orbit:refuted", orbit_rows((5, 3, 4, 1)), actions=("ACTION6",))
    observe("orbit:no_controls", orbit_rows((3, 4, 1, 2), controls=False), actions=("ACTION6",))
    observe("orbit:ragged", orbit_rows((3, 4, 1, 2), ragged=True), actions=("ACTION6",))
    observe("orbit:next_epoch", orbit_rows((3, 4, 1, 2)), actions=("ACTION6",), level=2)
    for name in ["orbit:initial", "orbit:no_controls", "orbit:ragged"]:
        current = scenes[name]
        def field_transport(value):
            if value is None: return None
            positions, size, targets, controls = value
            return {"positions": plain(positions), "size": size, "targets": plain(list(targets.items())),
                    "controls": [[plain(key), {"key": plain(key), "command": plain(command), "box": plain(box)}] for key, (command, box) in controls.items()]}
        add_case("orbit", name + "_field", "field", {"scene": name}, lambda current=current: orbit.field(current["observation"], current["inputs"]), field_transport)
    entity = next(e for e in scenes["orbit:initial"]["observation"]["entities"] if e["palette_value"] == 7)
    add_case("orbit", "dihedral_silhouette", "silhouette", {"entity": entity}, lambda: orbit.silhouette(entity))
    for name, positions in [("line", [(0, 0), (1, 0), (3, 0)]), ("square_with_collinear_slots", [(0, 0), (1, 0), (2, 0), (2, 2), (0, 2), (1, 1)]),
                            ("radial_diamond", [(0, 2), (2, 0), (2, 2), (2, 4), (4, 2)]), ("two_slots", [(3, 4), (1, 2)])]:
        add_case("orbit", name + "_hull", "hull", {"positions": positions}, lambda positions=positions: orbit.hull(positions))
        add_case("orbit", name + "_cycles", "cycles", {"positions": positions}, lambda positions=positions: orbit.cycles(positions))
    positions = [(3 + i * 5, 3) for i in range(4)]
    contours = orbit.cycles(positions)
    for name, before, after in [("unique_rotation", [3, 4, 1, 2], [2, 3, 4, 1]), ("ambiguous_rotation", [1, 1, 2, 2], [2, 1, 1, 2]),
                                ("stationarity_not_operator", [1, 2, 3, 4], [1, 2, 3, 4]), ("non_permutation_refuted", [1, 2, 3, 4], [1, 2, 3, 5])]:
        add_case("orbit", name, "fit", {"before": before, "after": after, "contours": contours}, lambda before=before, after=after: orbit.fit(before, after, contours))
    for name in ["orbit:initial", "orbit:ragged"]:
        add_case("orbit", name + "_values", "values", {"scene": name, "positions": positions, "size": 2}, lambda name=name: orbit.values(scenes[name]["rows"], positions, 2))
    targets = {0: 1, 1: 2, 2: 3, 3: 4}; operators = {(5, 10): (3, 0, 1, 2)}
    for name, arrangement, budget in [("two_turn_route", [3, 4, 1, 2], 2), ("bounded_route", [3, 4, 1, 2], 1), ("already_matching_route", [1, 2, 3, 4], 4)]:
        add_case("orbit", name, "route", {"values": arrangement, "targets": list(targets.items()), "operators": list(operators.items()), "budget": budget},
                 lambda arrangement=arrangement, budget=budget: orbit.route(arrangement, targets, operators, budget))

    class Driver:
        def __init__(self, family, name):
            self.family = family; self.name = name; self.memory = orbit.OrbitConstraints() if family == "orbit" else containment.Containment()
            self.state = orbit_state if family == "orbit" else containment_state
            self.steps = []; self.proposal = None; self.domain = None

        def execute(self, operation):
            kind = operation["kind"]
            try:
                if kind == "propose":
                    current = scenes[operation["scene"]]; self.domain = ObservedInputDomain(4096)
                    inputs = self.domain.candidates(current["observation"])
                    if "inputs" in operation: inputs = operation["inputs"]
                    self.proposal = self.memory.propose(current["observation"], current["rows"], inputs, operation.get("remaining", 100))
                    result = self.proposal
                elif kind == "bind":
                    self.memory.bind(self.proposal, self.domain); result = self.proposal
                elif kind == "before":
                    result = self.memory.before(self.proposal, operation.get("index", 0), raws[operation["scene"]], scenes[operation.get("observation", operation["scene"])]["observation"])
                elif kind in ("after", "record"):
                    b, a = scenes[operation["before"]], scenes[operation["after"]]; index = operation.get("index", 0)
                    if kind == "after": result = self.memory.after(self.proposal, index, b["observation"], a["observation"], b["rows"], a["rows"])
                    else: result = self.memory.record(b["observation"], a["observation"], operation.get("command", self.proposal["actions"][index]), b["rows"], a["rows"], self.proposal, index)
                elif kind == "helper":
                    function = operation["function"]
                    if function == "graph":
                        result = list(self.memory.graph(operation["index"], tuple(map(tuple, operation["positions"])), operation.get("ignore", ())).items())
                    elif function == "select": result = self.memory.select(operation["index"], tuple(map(tuple, operation["positions"])), scenes[operation["scene"]]["inputs"])
                    elif function == "walk": result = self.memory.walk(operation["index"], operation["path"], tuple(map(tuple, operation["positions"])))
                    elif function == "choices": result = self.memory.choices(scenes[operation["scene"]]["observation"], scenes[operation["scene"]]["inputs"])
                    elif function == "footprint": result = self.memory.footprint(operation["index"], tuple(operation["position"]))
                    elif function == "region": result = self.memory._region(operation["index"], tuple(operation["goal"]))
                    else: raise AssertionError(function)
                else: raise AssertionError(kind)
                expected = {"result": plain(result), "state": self.state(self.memory)}
            except Exception as error:
                expected = {"error": str(error), "state": self.state(self.memory)}
            self.steps.append({"operation": plain(operation), "expected": expected})
            return result if "result" in expected else None

        def save(self):
            scenarios.append({"family": self.family, "id": self.name, "steps": self.steps})

    d = Driver("orbit", "learn_plan_bind_guards_and_score")
    assert d.execute({"kind": "propose", "scene": "orbit:initial"}) is not None
    d.execute({"kind": "bind"}); d.execute({"kind": "before", "scene": "orbit:initial"})
    d.execute({"kind": "before", "scene": "orbit:initial", "observation": "orbit:turned"})
    d.execute({"kind": "after", "before": "orbit:initial", "after": "orbit:turned"})
    event = d.execute({"kind": "record", "before": "orbit:initial", "after": "orbit:turned"})
    assert event["matches"] == 1
    p = d.execute({"kind": "propose", "scene": "orbit:turned"}); assert p["steps"][0]["expected_after"] is not None
    d.execute({"kind": "bind"}); d.execute({"kind": "before", "scene": "orbit:turned"})
    d.execute({"kind": "before", "scene": "orbit:refuted"})
    d.execute({"kind": "after", "before": "orbit:turned", "after": "orbit:refuted"})
    d.execute({"kind": "after", "before": "orbit:turned", "after": "orbit:solved"})
    d.execute({"kind": "after", "before": "orbit:turned", "after": "orbit:score"})
    d.execute({"kind": "record", "before": "orbit:turned", "after": "orbit:solved", "command": {"action_ref": "ACTION5", "data": {}}})
    d.execute({"kind": "record", "before": "orbit:turned", "after": "orbit:score"})
    d.execute({"kind": "propose", "scene": "orbit:next_epoch"}); d.save()

    d = Driver("orbit", "operator_intersection_refutes_and_remembers")
    d.execute({"kind": "propose", "scene": "orbit:initial"}); d.execute({"kind": "record", "before": "orbit:initial", "after": "orbit:turned"})
    d.execute({"kind": "propose", "scene": "orbit:turned"}); d.execute({"kind": "record", "before": "orbit:turned", "after": "orbit:refuted"})
    d.execute({"kind": "propose", "scene": "orbit:refuted"}); d.save()

    for i, arrangement in enumerate([(1, 1, 2, 2), (2, 1, 1, 2), (2, 2, 1, 1)]):
        observe(f"orbit:ambiguous:{i}", orbit_rows(arrangement, marks=(2, 2, 1, 1)), actions=("ACTION6",))
    d = Driver("orbit", "ambiguous_operator_is_retested_on_new_contents")
    d.execute({"kind": "propose", "scene": "orbit:ambiguous:0"})
    e = d.execute({"kind": "record", "before": "orbit:ambiguous:0", "after": "orbit:ambiguous:1"}); assert e["matches"] > 1
    d.execute({"kind": "propose", "scene": "orbit:ambiguous:1"})
    d.execute({"kind": "record", "before": "orbit:ambiguous:1", "after": "orbit:ambiguous:1"})
    p = d.execute({"kind": "propose", "scene": "orbit:ambiguous:1"}); assert p is not None and "distinguish" in p["question"]["reason"]
    d.execute({"kind": "record", "before": "orbit:ambiguous:1", "after": "orbit:ambiguous:2"})
    d.execute({"kind": "propose", "scene": "orbit:ambiguous:2"}); d.save()

    observe("contain:initial", containment_rows([(2, 3)]))
    observe("contain:right", containment_rows([(3, 3)]))
    observe("contain:down", containment_rows([(3, 4)]))
    observe("contain:missing", containment_rows([(2, 3)], erase=True))
    observe("contain:score", containment_rows([(11, 9)]), score=1)
    observe("contain:invalid_epoch", [[0] * 21 for _ in range(17)], level=2)
    sample_scene = containment.scene(scenes["contain:initial"]["observation"], scenes["contain:initial"]["rows"])
    assert sample_scene is not None and len(sample_scene[0]) == 1
    bodies = sample_scene[0]
    for name in ["contain:initial", "contain:missing", "contain:invalid_epoch"]:
        add_case("containment", name + "_scene", "scene", {"scene": name}, lambda name=name: containment.scene(scenes[name]["observation"], scenes[name]["rows"]), containment_scene)
    for name, support, width, height in [("closed_shell", shell, 3, 3), ("open_shell", shell - {(1, 0)}, 3, 3), ("single_pixel", {(0, 0)}, 1, 1)]:
        add_case("containment", name + "_neighborhood", "neighborhood", {"mask": support}, lambda support=support: containment.neighborhood(support))
        add_case("containment", name + "_fill", "filled", {"mask": support, "width": width, "height": height}, lambda support=support, width=width, height=height: containment.filled(support, width, height))
    for name, target, prior in [("pose_exact", "contain:initial", [(2, 3)]), ("pose_moved", "contain:right", [(2, 3)]), ("pose_missing", "contain:missing", [(2, 3)])]:
        add_case("containment", name, "measured_positions", {"scene": target, "bodies": [body_transport(body) for body in bodies], "prior": prior},
                 lambda target=target, prior=prior: containment.measured_positions(scenes[target]["rows"], bodies, prior))
    adjacent_bodies = [{"origin": (3, 4), "shape": shape, "shell": shell, "color": 2}, {"origin": (6, 4), "shape": shape, "shell": shell, "color": 3}]
    contact_rows = containment_rows([(3, 4), (6, 4)], goals=(), lost=[(6, 4, 0), (6, 5, 0), (6, 6, 0)])
    observe("contain:covered_edge", contact_rows)
    for name, predicted in [("explained_contact_edge", [(3, 4), (6, 4)]), ("overlapping_footprints_rejected", [(3, 4), (5, 4)]), ("out_of_view_contact", [(-1, 4), (6, 4)])]:
        add_case("containment", name, "contact_pose", {"scene": "contain:covered_edge", "bodies": [body_transport(body) for body in adjacent_bodies], "predicted": predicted},
                 lambda predicted=predicted: containment.contact_pose(contact_rows, adjacent_bodies, predicted))
    assert containment.contact_pose(contact_rows, adjacent_bodies, [(3, 4), (6, 4)])
    same_bodies = [{**body, "color": 2} for body in adjacent_bodies]
    observe("contain:identical_neighbors", containment_rows([(3, 4), (6, 4)], goals=(), colors=[2, 2]))
    add_case("containment", "joint_pose_keeps_neighbor_identity", "measured_positions", {"scene": "contain:identical_neighbors", "bodies": [body_transport(body) for body in same_bodies], "prior": [(3, 4), (6, 4)]},
             lambda: containment.measured_positions(scenes["contain:identical_neighbors"]["rows"], same_bodies, [(3, 4), (6, 4)]))
    add_case("containment", "pixel_translation", "add", {"point": (3, 4), "delta": (-1, 2)}, lambda: containment.add((3, 4), (-1, 2)))
    add_case("containment", "manhattan_distance", "distance", {"first": (3, 4), "second": (7, 1)}, lambda: containment.distance((3, 4), (7, 1)))

    d = Driver("containment", "learn_controls_then_plan_guard_and_refute")
    p = d.execute({"kind": "propose", "scene": "contain:initial"}); assert p and p["steps"][0]["mode"] == "calibrate"
    d.execute({"kind": "bind"}); d.execute({"kind": "before", "scene": "contain:initial"})
    d.execute({"kind": "before", "scene": "contain:initial", "observation": "contain:right"})
    d.execute({"kind": "after", "before": "contain:initial", "after": "contain:right"})
    d.execute({"kind": "record", "before": "contain:initial", "after": "contain:right"})
    d.execute({"kind": "propose", "scene": "contain:right"}); d.execute({"kind": "record", "before": "contain:right", "after": "contain:down"})
    p = d.execute({"kind": "propose", "scene": "contain:down"}); assert p and p["steps"][0]["mode"] == "walk" and len(p["steps"]) > 1
    d.execute({"kind": "bind"}); d.execute({"kind": "before", "scene": "contain:down"})
    d.execute({"kind": "helper", "function": "graph", "index": 0, "positions": [(3, 4)]})
    d.execute({"kind": "helper", "function": "footprint", "index": 0, "position": (3, 4)})
    d.execute({"kind": "helper", "function": "walk", "index": 0, "positions": [(3, 4)], "path": ["ACTION1", "ACTION2"]})
    first_expected = p["steps"][0]["expected_after"]
    observe("contain:first_walk", containment_rows(first_expected))
    d.execute({"kind": "after", "before": "contain:down", "after": "contain:first_walk"})
    d.execute({"kind": "after", "before": "contain:down", "after": "contain:down"})
    d.execute({"kind": "after", "before": "contain:down", "after": "contain:score"})
    d.execute({"kind": "record", "before": "contain:down", "after": "contain:missing"})
    d.execute({"kind": "record", "before": "contain:down", "after": "contain:down"})
    d.execute({"kind": "helper", "function": "graph", "index": 0, "positions": [(3, 4)]})
    d.execute({"kind": "record", "before": "contain:down", "after": "contain:score"})
    d.execute({"kind": "propose", "scene": "contain:invalid_epoch"}); d.save()

    # Complete measured walking prefix, without supplying a path to the family.
    d = Driver("containment", "positive_complete_walk_and_score")
    d.execute({"kind": "propose", "scene": "contain:initial"}); d.execute({"kind": "record", "before": "contain:initial", "after": "contain:right"})
    d.execute({"kind": "propose", "scene": "contain:right"}); d.execute({"kind": "record", "before": "contain:right", "after": "contain:down"})
    p = d.execute({"kind": "propose", "scene": "contain:down"}); current = "contain:down"; position = [3, 4]
    for index, command in enumerate(p["actions"]):
        delta = (1, 0) if command["action_ref"] == "ACTION1" else (0, 1)
        position = [position[0] + delta[0], position[1] + delta[1]]
        after = observe(f"contain:walk:{index}", containment_rows([position]))
        d.execute({"kind": "before", "scene": current, "index": index})
        d.execute({"kind": "after", "before": current, "after": after, "index": index})
        d.execute({"kind": "record", "before": current, "after": after, "index": index}); current = after
    assert position == [11, 9]
    d.execute({"kind": "propose", "scene": current}); d.save()

    # Selection is inferred from changed appearance on an otherwise fixed body.
    double_goals = ((11, 3), (11, 10))
    observe("contain:two_initial", containment_rows([(2, 3), (2, 10)], goals=double_goals), actions=("ACTION1", "ACTION6"))
    observe("contain:two_right", containment_rows([(3, 3), (2, 10)], goals=double_goals), actions=("ACTION1", "ACTION6"))
    d = Driver("containment", "selection_appearance_then_shared_control")
    d.execute({"kind": "propose", "scene": "contain:two_initial"}); d.execute({"kind": "record", "before": "contain:two_initial", "after": "contain:two_right"})
    p = d.execute({"kind": "propose", "scene": "contain:two_right"}); assert p["steps"][0]["mode"] == "walk"
    current = "contain:two_right"; positions_two = [[3, 3], [2, 10]]
    for index, command in enumerate(p["actions"]):
        positions_two[0][0] += 1
        after = observe(f"contain:two_walk:{index}", containment_rows(positions_two, goals=double_goals), actions=("ACTION1", "ACTION6"))
        d.execute({"kind": "record", "before": current, "after": after, "index": index}); current = after
    p = d.execute({"kind": "propose", "scene": current}); assert p["steps"][0]["mode"] == "selection"
    d.execute({"kind": "bind"}); d.execute({"kind": "before", "scene": current})
    selected = observe("contain:selected_second", containment_rows(positions_two, goals=double_goals, interiors={1: 4}), actions=("ACTION1", "ACTION6"))
    d.execute({"kind": "after", "before": current, "after": selected})
    e = d.execute({"kind": "record", "before": current, "after": selected}); assert e.get("selection_status")
    d.execute({"kind": "propose", "scene": selected}); d.save()

    # Two occupants, a measured barrier and a still uncharacterized contact.
    contact_goals = ((15, 4), (15, 10))
    observe("contain:contact_initial", containment_rows([(6, 4), (1, 4)], goals=contact_goals, barrier=10), actions=("ACTION1", "ACTION6"))
    observe("contain:contact_calibrated", containment_rows([(6, 4), (2, 4)], goals=contact_goals, barrier=10), actions=("ACTION1", "ACTION6"))
    d = Driver("containment", "contact_service_retains_measured_remote_endpoint")
    d.execute({"kind": "propose", "scene": "contain:contact_initial"}); d.execute({"kind": "record", "before": "contain:contact_initial", "after": "contain:contact_calibrated"})
    p = d.execute({"kind": "propose", "scene": "contain:contact_calibrated"}); assert p and p["steps"][-1]["mode"] == "contact"
    current = "contain:contact_calibrated"; current_positions = [(6, 4), (2, 4)]
    for index, step in enumerate(p["steps"]):
        physical_index = d.memory.bodies[step["body"]]["color"] - 2
        if step["mode"] == "walk": current_positions[physical_index] = (current_positions[physical_index][0] + 1, current_positions[physical_index][1])
        else: current_positions[physical_index] = (15, 4)
        after = observe(f"contain:contact:{index}", containment_rows(current_positions, goals=contact_goals, barrier=10), actions=("ACTION1", "ACTION6"))
        d.execute({"kind": "before", "scene": current, "index": index}); d.execute({"kind": "after", "before": current, "after": after, "index": index})
        e = d.execute({"kind": "record", "before": current, "after": after, "index": index}); current = after
    assert e.get("contact_displacement")
    d.execute({"kind": "helper", "function": "region", "index": 0, "goal": (15, 4)})
    d.execute({"kind": "propose", "scene": current}); d.save()

    d = Driver("containment", "stationary_calibration_is_context_specific")
    d.execute({"kind": "propose", "scene": "contain:initial"}); d.execute({"kind": "record", "before": "contain:initial", "after": "contain:initial"})
    d.execute({"kind": "propose", "scene": "contain:initial"}); d.execute({"kind": "record", "before": "contain:initial", "after": "contain:initial"})
    d.execute({"kind": "propose", "scene": "contain:initial"}); d.save()
    sys.setprofile(None)
    fixture = {"schema": "sra.v6.orbit-containment-reference.v1", "commit": COMMIT, "sourceHashes": hashes,
               "normalization": ["NumPy matrices become exact boolean/integer rows", "tuple keys become entries preserving dictionary insertion order",
                                 "structural point/permutation sets sorted lexicographically", "heterogeneous state sets sorted by compact JSON", "native state format tag is added"],
               "coveredSourceFunctions": {family: sorted(name for name in names if not name.startswith("<")) for family, names in covered.items()},
               "scenes": scenes, "cases": cases, "scenarios": scenarios}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"cases": len(cases), "scenarios": len(scenarios), "steps": sum(len(s["steps"]) for s in scenarios),
                      "covered": fixture["coveredSourceFunctions"], "output": str(args.output)}))


if __name__ == "__main__": main()
