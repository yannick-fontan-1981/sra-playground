#!/usr/bin/env python3
"""Original public pairs()/match_pair() oracle; joint_route is not transferred."""
from __future__ import annotations

import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = ROOT / "reference/v6" / COMMIT / "source"
LAYA = SOURCE / "agents/yf_arc3_v6/laya_proto"
sys.path[:0] = [str(SOURCE), str(LAYA)]
from coupled_pair_observation import pairs, match_pair


def board(height=32, width=None, background=0):
    return [[background] * (width or height) for _ in range(height)]


def rectangle(rows, top, left, height, width, value):
    for y in range(top, top + height):
        for x in range(left, left + width):
            rows[y][x] = value
    return rows


def squares(specs, *, height=32, width=None, background=0):
    rows = board(height, width, background)
    for top, left, size, value in specs:
        rectangle(rows, top, left, size, size, value)
    return rows


def pair(positions, size=3, value=2):
    return {
        "value": value, "size": size,
        "boxes": [[top, left, top + size - 1, left + size - 1] for top, left in positions],
    }


def main():
    scenes = {}
    cases = []

    def measurement(name, rows):
        scenes[name] = rows
        result = pairs(rows)
        cases.append({
            "id": name, "operation": "pairs", "arguments": {"scene": name},
            "expected": copy.deepcopy(result),
        })
        return result

    def correspondence(name, before, after, qualification="Direct original geometry-helper comparison."):
        result = match_pair(before, after)
        cases.append({
            "id": name, "operation": "match_pair",
            "arguments": {"before": before, "after": after},
            "qualification": qualification, "expected": copy.deepcopy(result),
        })
        return result

    measurement("uniform_frame_has_no_pair", board())
    measurement("one_uniform_component_at_minimum_frame_size", [[0]])
    measurement("one_square_is_insufficient", squares([(3, 3, 2, 2)]))
    measurement("two_filled_squares", squares([(3, 3, 2, 2), (20, 17, 2, 2)]))
    measurement("palette_zero_is_measured", squares([(3, 3, 2, 0), (20, 17, 2, 0)], background=7))
    measurement("upper_palette_value_is_not_a_role", squares([(3, 3, 2, 255), (20, 17, 2, 255)]))
    measurement("frame_boundary_is_not_excluded", squares([(0, 0, 2, 2), (30, 30, 2, 2)]))
    measurement("non_square_frame", squares([(0, 5, 2, 4), (21, 35, 2, 4)], height=24, width=40))
    measurement("single_pixels_are_excluded", squares([(3, 3, 1, 2), (20, 17, 1, 2)]))
    measurement("size_sixteen_is_included", squares([(1, 1, 16, 2), (28, 28, 16, 2)], height=48))
    measurement("size_seventeen_is_excluded", squares([(1, 1, 17, 2), (29, 29, 17, 2)], height=48))
    measurement("three_members_do_not_form_a_pair", squares([(3, 3, 2, 2), (13, 13, 2, 2), (23, 23, 2, 2)]))
    measurement("different_sizes_are_separate_groups", squares([(3, 3, 2, 2), (13, 13, 3, 2)]))
    measurement("different_values_are_separate_groups", squares([(3, 3, 2, 2), (13, 13, 2, 3)]))
    measurement("first_component_order_not_palette_or_size_order", squares([
        (2, 2, 3, 11), (2, 10, 2, 3), (7, 20, 2, 11),
        (11, 14, 2, 3), (16, 2, 3, 11), (22, 18, 2, 11),
    ]))
    measurement("remove_three_member_group_without_reordering_others", squares([
        (2, 2, 2, 9), (2, 10, 2, 4), (7, 20, 2, 9),
        (11, 14, 2, 4), (16, 2, 2, 9),
    ]))
    measurement("corner_touching_uses_four_connectivity", squares([(3, 3, 2, 2), (5, 5, 2, 2)]))
    measurement("edge_touching_merges_components", squares([(3, 3, 2, 2), (3, 5, 2, 2)]))

    rows = board()
    rectangle(rows, 3, 3, 2, 3, 2)
    rectangle(rows, 13, 13, 2, 3, 2)
    measurement("non_square_rectangles_are_excluded", rows)
    rows = squares([(3, 3, 3, 2), (13, 13, 3, 2)])
    rows[3][3] = 0
    rows[13][13] = 0
    measurement("not_filled_bounding_boxes_are_excluded", rows)
    rows = squares([(3, 3, 4, 2), (15, 15, 4, 2)])
    rectangle(rows, 4, 4, 2, 2, 0)
    rectangle(rows, 16, 16, 2, 2, 0)
    measurement("hollow_borders_excluded_but_interior_components_remain", rows)
    rows = squares([(3, 3, 2, 2), (20, 17, 2, 2)])
    rectangle(rows, 12, 10, 2, 4, 2)
    measurement("extra_non_square_is_not_a_third_member", rows)
    rows = squares([(3, 3, 2, 2), (20, 17, 2, 2)])
    rows[20][17] = 0
    measurement("partially_occluded_member_is_not_completed_by_inference", rows)

    crossing_before = measurement(
        "crossing_before", squares([(2, 2, 2, 5), (4, 10, 2, 5)], height=16),
    )
    crossing_after = measurement(
        "crossing_after", squares([(4, 2, 2, 5), (2, 10, 2, 5)], height=16),
    )
    assert len(crossing_before) == len(crossing_after) == 1
    crossing = correspondence(
        "spatial_order_changes_but_member_identity_is_retained",
        crossing_before[0], crossing_after[0],
        "Both arguments are original pairs() measurements of the two public scenes above.",
    )
    assert crossing["boxes"] != sorted(crossing["boxes"])
    assert crossing["deltas"] == [[2, 0], [-2, 0]]

    before = pair([(4, 4), (18, 18)])
    for name, positions in (
        ("both_members_stationary", [(4, 4), (18, 18)]),
        ("one_row_move_at_size_bound", [(7, 4), (18, 18)]),
        ("one_column_move_at_size_bound", [(4, 1), (18, 18)]),
        ("both_move_in_same_row_direction", [(7, 4), (21, 18)]),
        ("opposite_row_directions_are_observed_without_assuming_coupling", [(7, 4), (15, 18)]),
        ("different_cardinal_axes_are_not_rejected_as_a_control_hypothesis", [(4, 7), (15, 18)]),
        ("shorter_than_size_displacements_are_allowed", [(5, 4), (18, 20)]),
        ("diagonal_within_manhattan_bound_is_rejected", [(5, 5), (18, 18)]),
        ("row_distance_over_size_is_rejected", [(8, 4), (18, 18)]),
        ("column_distance_over_size_is_rejected", [(4, 4), (18, 22)]),
        ("second_member_only_moves", [(4, 4), (18, 15)]),
        ("after_boxes_can_arrive_in_reverse_order", [(18, 18), (4, 4)]),
    ):
        correspondence(name, copy.deepcopy(before), pair(positions))

    correspondence(
        "before_member_order_is_not_resorted",
        pair([(18, 18), (4, 4)]), pair([(4, 4), (18, 18)]),
    )
    assert correspondence(
        "equal_minimum_assignments_are_ambiguous",
        pair([(4, 4), (7, 7)]), pair([(4, 7), (7, 4)]),
    ) is None
    unique = correspondence(
        "unique_minimum_is_selected_among_multiple_admissible_assignments",
        pair([(4, 4), (7, 6)], size=4), pair([(4, 6), (7, 4)], size=4),
        "Direct helper inputs test minimum-cost selection; no claim that overlapping supplied boxes are measured physical components.",
    )
    assert unique["deltas"] == [[0, 2], [0, -2]]
    assert correspondence(
        "equal_valued_permutations_are_not_deduplicated",
        pair([(4, 4), (4, 8)], size=4), pair([(4, 6), (4, 6)], size=4),
        "Direct helper inputs test itertools.permutations multiplicity; duplicate boxes are not a measured pair.",
    ) is None
    after = copy.deepcopy(before)
    after["value"] = 9
    assert correspondence(
        "helper_leaves_palette_filtering_to_its_caller", copy.deepcopy(before), after,
    ) is not None
    after = copy.deepcopy(before)
    after["size"] = 1
    assert correspondence(
        "helper_uses_before_size_and_leaves_size_filtering_to_caller", copy.deepcopy(before), after,
    ) is not None

    source_paths = [
        "agents/yf_arc3_v6/laya_proto/coupled_pair_observation.py",
        "agents/yf_arc3_v6/laya_proto/alternating_graph_observation.py",
        "agents/yf_arc3_v5/capabilities/components.py",
        "agents/yf_arc3_v5/capabilities/contracts.py",
        "agents/yf_arc3_v5/capabilities/sprites.py",
    ]
    fixture = {
        "provenance": {
            "commit": COMMIT,
            "sourceMethod": "Direct calls to unchanged pairs() and match_pair(), without source rewriting.",
            "qualification": "Only the public pair measurement and correspondence functions are transferred. joint_route is explicitly excluded, as are paired-control planning and game-success claims. Cases marked as direct helper inputs do not assert the existence of physical raster components.",
            "descriptionProjection": "pairs() consumes only detect_components from description(); unused visual-scene and joint-route computations are not native dependencies.",
            "sources": {
                path: hashlib.sha256((SOURCE / path).read_bytes()).hexdigest()
                for path in source_paths
            },
        },
        "scenes": scenes,
        "cases": cases,
    }
    payload = (json.dumps(fixture, indent=2, ensure_ascii=False) + "\n").encode()
    output = ROOT / "tests/fixtures/v6-coupled-pair-observation-reference.json.gz"
    output.write_bytes(gzip.compress(payload, mtime=0))
    print(json.dumps({
        "path": str(output.relative_to(ROOT)), "scenes": len(scenes),
        "pairsCases": sum(case["operation"] == "pairs" for case in cases),
        "matchingCases": sum(case["operation"] == "match_pair" for case in cases),
        "bytes": output.stat().st_size,
    }))


if __name__ == "__main__":
    main()
