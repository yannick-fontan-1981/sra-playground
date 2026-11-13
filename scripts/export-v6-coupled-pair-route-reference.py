#!/usr/bin/env python3
"""Export the unchanged V6 joint_route result and its exact consumed V5 search."""
from __future__ import annotations

import copy
import gzip
import hashlib
import json
from pathlib import Path
import random
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = ROOT / "reference/v6" / COMMIT / "source"
LAYA = SOURCE / "agents/yf_arc3_v6/laya_proto"
sys.path[:0] = [str(SOURCE), str(LAYA)]
from coupled_pair_observation import joint_route


def controls(q=2):
    return {"ACTION1": [-q, 0], "ACTION2": [q, 0], "ACTION3": [0, -q], "ACTION4": [0, q]}


def fill(rows, top, left, q, value):
    for y in range(top, top + q):
        for x in range(left, left + q):
            rows[y][x] = value


def scene(positions=((2, 1), (2, 5)), *, nr=8, nc=8, q=2, phase=(0, 0), margin=(0, 0), background=0):
    y0, x0 = phase
    rows = [[background] * (x0 + nc * q + margin[1]) for _ in range(y0 + nr * q + margin[0])]
    boxes = []
    for row, col in positions:
        top, left = y0 + row * q, x0 + col * q
        fill(rows, top, left, q, 2)
        boxes.append([top, left, top + q - 1, left + q - 1])
    return rows, {"size": q, "value": 2, "boxes": boxes}


def main():
    cases, scenes = [], {}

    def export(name, rows, pair, *, moves=None, floors=(0,), signs=(1, -1), limit=40,
               evidence=("public.fixture.evidence",), exclude=False, qualification=None):
        scenes[name] = copy.deepcopy(rows)
        args = {"scene": name, "pair": copy.deepcopy(pair),
                "controls": copy.deepcopy(controls(pair["size"]) if moves is None else moves),
                "floorValues": list(floors), "signs": list(signs), "limit": limit,
                "evidence": list(evidence), "excludeMixtures": exclude}
        searches = []

        def observe_return(frame, event, _result):
            # A read-only profile records counters on refused searches too.
            # No source, argument, return, or planner implementation is replaced.
            if event == "return" and frame.f_code.co_name == "_bounded_joint_peer_collision_route_candidates":
                values = frame.f_locals
                if "visited" in values:
                    searches.append({"states": len(values["visited"]), "expanded": values["expanded"],
                                     "maxDepth": values["max_depth"], "stateBudget": values["state_budget"],
                                     "routeLength": len(values["route"])})

        before = copy.deepcopy([rows, pair, args])
        sys.setprofile(observe_return)
        try:
            result = joint_route(rows, pair, args["controls"], args["floorValues"], args["signs"],
                                 limit, args["evidence"], exclude)
            error = None
        except ValueError as caught:
            result = None
            error = {"kind": type(caught).__name__, "message": str(caught)}
        finally:
            sys.setprofile(None)
        assert [rows, pair, args] == before, name + " mutated an oracle input"
        item = {"id": name, "arguments": args, "expected": result, "sourceSearch": searches}
        if error:
            item["error"] = error
        if qualification:
            item["qualification"] = qualification
        cases.append(item)
        return result

    rows, pair = scene()
    basic = export("two_steps_on_uniform_known_floor", rows, pair)
    assert basic["actions"] == ["ACTION4", "ACTION4"]
    export("insertion_order_does_not_change_canonical_control_order", rows, pair,
           moves=dict(reversed(list(controls().items()))))
    export("empty_evidence_does_not_change_geometric_result", rows, pair, evidence=())
    export("extra_evidence_does_not_change_geometric_result", rows, pair,
           evidence=("public.a", "public.b", "public.a"))
    reversed_pair = copy.deepcopy(pair)
    reversed_pair["boxes"].reverse()
    reversed_route = export("first_tracked_member_is_not_spatially_resorted", rows, reversed_pair)
    assert reversed_route["actions"] == ["ACTION3", "ACTION3"]
    value_changed = copy.deepcopy(pair)
    value_changed["value"] = 9
    assert export("palette_role_filtering_remains_with_the_caller", rows, value_changed) == basic
    export("horizontal_aliases_are_counted_as_distinct_actions", rows, pair,
           moves={"B": [0, 2], "A": [0, 2]})
    export("python_unicode_control_order", rows, pair,
           moves={"\U00010000": [0, 2], "\ue000": [0, 2]})
    export("lexical_order_between_equal_length_routes", rows, pair,
           moves={"z_up": [-2, 0], "y_down": [2, 0], "x_left": [0, -2], "a_right": [0, 2]})
    for limit in (0, -5, 1, 2, 40, 400):
        export("two_step_route_limit_" + str(limit), rows, pair, limit=limit)

    one_rows, one_pair = scene(((2, 1), (2, 3)))
    for limit in (0, -1, 1):
        result = export("one_step_route_original_minimum_depth_" + str(limit), one_rows, one_pair, limit=limit)
        assert len(result["actions"]) == 1

    long_rows, long_pair = scene(((2, 2), (2, 44)), nr=8, nc=48)
    for limit in (20, 21, 40, 400):
        result = export("twenty_one_step_route_limit_" + str(limit), long_rows, long_pair, limit=limit)
        if limit == 20:
            assert result is None
        else:
            assert result["actions"] == ["ACTION4"] * 21
            if limit >= 40:
                assert (result["states"], result["expanded"]) == (323, 308)

    phase_rows, phase_pair = scene(((2, 1), (2, 5)), q=3, phase=(1, 2), margin=(2, 1))
    result = export("nonzero_lattice_phase_and_incomplete_margins", phase_rows, phase_pair)
    assert result["expected"][-1] == [[7, 11, 9, 13], [7, 11, 9, 13]]
    # Ignore incomplete margins: their pixels are not full measured lattice cells.
    for row in range(len(phase_rows)):
        phase_rows[row][0] = 9
        phase_rows[row][-1] = 8
    export("margin_pixels_cannot_become_floor_or_blocker_cells", phase_rows, phase_pair)

    boundary_rows, boundary_pair = scene(((1, 1), (5, 5)))
    boundary = export("independent_boundary_stops_reconcile_different_rows", boundary_rows, boundary_pair)
    assert boundary["one_sided_steps"] == 4
    export("boundary_stops_remain_available_with_mixture_exclusion", boundary_rows, boundary_pair, exclude=True)

    wall_rows, wall_pair = scene(((2, 1), (2, 6)))
    fill(wall_rows, 4, 4, 2, 9)
    wall = export("one_member_stops_at_an_unlearned_uniform_pattern", wall_rows, wall_pair)
    assert wall["one_sided_steps"] == 1
    export("uniform_blocker_is_not_a_mixture_exclusion", wall_rows, wall_pair, exclude=True)
    mixed_rows = copy.deepcopy(wall_rows)
    mixed_rows[4][4] = 0
    export("known_floor_mixture_can_conditionally_stop_a_member", mixed_rows, wall_pair)
    assert export("known_floor_mixture_contact_is_excluded_as_a_whole_action", mixed_rows, wall_pair, exclude=True) is None
    unrelated_rows = copy.deepcopy(wall_rows)
    unrelated_rows[4][4] = 8
    assert export("unrelated_mixture_does_not_trigger_floor_contact_exclusion", unrelated_rows, wall_pair, exclude=True) == wall
    detour_rows, detour_pair = scene()
    fill(detour_rows, 4, 4, 2, 9)
    detour_rows[4][4] = 0
    export("mixture_blocker_detour_without_exclusion", detour_rows, detour_pair)
    export("mixture_blocker_detour_with_exclusion_changes_state_count", detour_rows, detour_pair, exclude=True)
    floors_rows, floors_pair = scene()
    fill(floors_rows, 4, 4, 2, 7)
    export("second_uniform_floor_pattern_unobserved", floors_rows, floors_pair)
    export("second_uniform_floor_pattern_observed", floors_rows, floors_pair, floors=(0, 7))
    export("multiple_floor_values_do_not_make_mixtures_traversable", mixed_rows, wall_pair, floors=(0, 9))
    export("mixtures_of_two_known_floor_values_are_still_excluded", mixed_rows, wall_pair, floors=(0, 9), exclude=True)

    for label, signs in (("same_columns", (1, 1)), ("opposed_rows", (-1, -1)),
                         ("both_unknown", (0, 0)), ("missing_row_witness", (0, -1)),
                         ("missing_column_witness", (1, 0))):
        assert export("reject_unsupported_coupling_" + label, rows, pair, signs=signs) is None
    for label, moves in (("empty", {}), ("only_vertical", {"A": [-2, 0], "B": [2, 0]}),
                         ("only_one_horizontal", {"A": [0, 2], "B": [2, 0]}),
                         ("wrong_quantum", {"A": [0, -1], "B": [0, 2]}),
                         ("zero_delta", {"A": [0, -2], "B": [0, 2], "C": [0, 0]})):
        assert export("reject_controls_" + label, rows, pair, moves=moves) is None
    export("negative_diagonal_uses_original_floor_division", rows, pair,
           moves={"A": [-1, -1], "B": [1, -1], "C": [0, 2]},
           qualification="Direct joint_route helper input. Normal learned controls are cardinal; the original helper validates L1 size only and floors each logical axis.")
    assert export("no_learned_floor", rows, pair, floors=()) is None
    assert export("absent_learned_floor_palette", rows, pair, floors=(99,)) is None
    mismatch = copy.deepcopy(rows)
    fill(mismatch, 4, 10, 2, 3)
    assert export("supplied_members_have_different_pixel_patterns", mismatch, pair) is None
    third = copy.deepcopy(rows)
    fill(third, 12, 12, 2, 2)
    assert export("third_identical_cell_invalidates_the_two_member_contract", third, pair) is None
    duplicate = copy.deepcopy(pair)
    duplicate["boxes"][1] = duplicate["boxes"][0][:]
    assert export("duplicate_member_box_is_not_two_measured_cells", rows, duplicate) is None
    wrong_size = copy.deepcopy(pair)
    wrong_size["boxes"][1][3] += 1
    assert export("bounding_box_must_equal_a_whole_cell", rows, wrong_size) is None
    wrong_phase = copy.deepcopy(pair)
    wrong_phase["boxes"][1][0] += 1
    wrong_phase["boxes"][1][2] += 1
    assert export("member_lattice_phases_must_agree", rows, wrong_phase) is None
    empty_rows, empty_pair = scene(((2, 1), (2, 6)))
    assert export("unresolvable_odd_column_sum_exhausts_known_lattice", empty_rows, empty_pair) is None

    exact_rows, exact_pair = scene(((2, 2), (2, 6)), nr=64, nc=64, q=1)
    export("known_lattice_exactly_4096_cells", exact_rows, exact_pair,
           qualification="Direct helper input with q=1 tests the recount hard bound; pairs() itself retains square size >1.")
    overflow_rows, overflow_pair = scene(((2, 2), (2, 6)), nr=65, nc=65, q=1)
    export("known_lattice_over_4096_cells_is_rejected", overflow_rows, overflow_pair,
           qualification="Direct helper input tests the original KnownGridCellRecountInput hard bound.")
    assert "known grid cell count exceeds hard bound" in cases[-1]["error"]["message"]
    budget_rows, budget_pair = scene(((0, 0), (31, 31)), nr=32, nc=32)
    assert export("search_expansion_budget_is_4096_not_the_visited_count", budget_rows, budget_pair) is None
    assert cases[-1]["sourceSearch"] == [{"states": 4470, "expanded": 4096, "maxDepth": 40, "stateBudget": 4096, "routeLength": 0}]

    # Additional fixed-seed public rasters compare exact actions, tracked pixel
    # boxes, canonical first-shortest selection, and both search counters.
    rng = random.Random(350786)
    for index in range(24):
        positions = rng.sample([(r, c) for r in range(1, 7) for c in range(1, 7)], 2)
        random_rows, random_pair = scene(positions)
        occupied = set(positions)
        for row, col in rng.sample([(r, c) for r in range(8) for c in range(8) if (r, c) not in occupied], 5):
            fill(random_rows, row * 2, col * 2, 2, 9)
            if rng.randrange(2):
                random_rows[row * 2][col * 2] = 0
        export("fixed_public_raster_" + str(index).zfill(2), random_rows, random_pair, exclude=bool(index % 2))

    source_paths = [
        "agents/yf_arc3_v6/laya_proto/coupled_pair_observation.py",
        "agents/yf_arc3_v6/laya_proto/terminal_composition.py",
        "agents/yf_arc3_v5/capabilities/interaction.py",
        "agents/yf_arc3_v5/capabilities/memorial_peer_step.py",
        "agents/yf_arc3_v5/capabilities/cell_recount.py",
        "agents/yf_arc3_v5/capabilities/contracts.py",
    ]
    fixture = {
        "provenance": {
            "commit": COMMIT,
            "sourceMethod": "Direct calls to unchanged joint_route() and its unchanged V5 search; read-only return profiling captures refused-search counters. No source rewriting or mocked route.",
            "qualification": "Complete joint_route return projection for its V6 SimpleNamespace request. Other generic V5 request types, tracking inference, typed footprints, additional route variants, candidate facts and overlays not returned by this wrapper are excluded. These are public raster and direct helper comparisons, not solved-game evidence.",
            "sources": {path: hashlib.sha256((SOURCE / path).read_bytes()).hexdigest() for path in source_paths},
        },
        "scenes": scenes, "cases": cases,
    }
    output = ROOT / "tests/fixtures/v6-coupled-pair-route-reference.json.gz"
    output.write_bytes(gzip.compress((json.dumps(fixture, ensure_ascii=False, indent=2) + "\n").encode(), mtime=0))
    print(json.dumps({"path": str(output.relative_to(ROOT)), "cases": len(cases),
                      "routes": sum(item["expected"] is not None for item in cases),
                      "refusals": sum(item["expected"] is None and "error" not in item for item in cases),
                      "errors": sum("error" in item for item in cases), "bytes": output.stat().st_size}))


if __name__ == "__main__":
    main()
