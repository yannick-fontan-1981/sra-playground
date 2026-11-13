#!/usr/bin/env python3
"""Independent unchanged-Python oracle for the alternating-graph primitives."""
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
sys.path[:0] = [str(SOURCE), str(SOURCE / "agents/yf_arc3_v6/laya_proto")]
from alternating_graph_observation import description, histogram, measure, overlays
from alternating_graph_questions import instrumental_contact, topology


def controls(pitch=6):
    return {"ACTION1": [-pitch, 0], "ACTION2": [pitch, 0], "ACTION3": [0, -pitch], "ACTION4": [0, pitch]}


def fill(rows, top, left, q, value):
    for row in range(top, top + q):
        for col in range(left, left + q):
            rows[row][col] = value


def grid(nr=2, nc=3, *, q=3, phase=(1, 1), actor=(0, 0), targets=None, first=5, link=6, background=0):
    pitch = q * 2
    targets = [(nr - 1, nc - 1)] if targets is None else targets
    rows = [[background] * (phase[1] + (nc - 1) * pitch + q + 1)
            for _ in range(phase[0] + (nr - 1) * pitch + q + 1)]
    for r in range(nr):
        for c in range(nc):
            y, x = phase[0] + r * pitch, phase[1] + c * pitch
            fill(rows, y, x, q, first)
            if c + 1 < nc:
                fill(rows, y, x + q, q, link)
            if r + 1 < nr:
                fill(rows, y + q, x, q, link)
    ay, ax = phase[0] + actor[0] * pitch, phase[1] + actor[1] * pitch
    fill(rows, ay, ax, q, 9)
    rows[ay + q // 2][ax + q // 2] = 8
    for r, c in targets:
        fill(rows, phase[0] + r * pitch, phase[1] + c * pitch, q, 4)
    bbox = [ay, ax, ay + q - 1, ax + q - 1]
    return rows, {"bbox": bbox, "histogram": histogram(rows, bbox), "size": q}


def guard(rows, r, c, *, q=3, phase=(1, 1), offset=None, values=(7, 3)):
    y, x = phase[0] + r * q * 2, phase[1] + c * q * 2
    fill(rows, y, x, q, values[0])
    dy, dx = (q - 1, q // 2) if offset is None else offset
    rows[y + dy][x + dx] = values[1]


def normalize_graph(graph):
    if graph is None:
        return None
    return {**graph, "nodes": sorted(graph["nodes"]),
            "edges": [{"node": node, "neighbors": sorted(graph["edges"][node])} for node in sorted(graph["edges"])]}


def projection(rows):
    _, components, scene = description(tuple(map(tuple, rows)))
    def box(b):
        return {"top": b.top, "left": b.left, "bottom": b.bottom, "right": b.right, "height": b.height, "width": b.width}
    return {
        "components": [{"component_id": c.component_id, "value": c.value, "pixels": c.pixels,
                        "relative_pixels": c.relative_pixels, "bbox": box(c.bbox), "area": c.area,
                        "touches_frame_boundary": c.touches_frame_boundary, "schema_version": c.schema_version}
                       for c in components.components],
        "sprites": [{"sprite_id": s.sprite_id, "bbox": box(s.bbox), "pattern": s.pattern,
                     "color_histogram": s.color_histogram, "pattern_occurrence_count": s.pattern_occurrence_count,
                     "touches_frame_boundary": s.touches_frame_boundary} for s in scene.sprites],
    }


def main():
    scenes, scene_keys, cases, public_rasters = {}, {}, [], []
    def scene_ref(rows):
        digest = hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()
        if digest not in scene_keys:
            key = "scene_" + str(len(scenes)).zfill(3)
            scene_keys[digest] = key
            scenes[key] = copy.deepcopy(rows)
        return scene_keys[digest]

    def export(kind, name, rows, *, actor=None, moves=None, evidence=("public.before", "public.after"),
               last="ACTION4", available=None, precaution=False, calibration=None, removals=(), remaining=40,
               box=None, qualification=None):
        args = {"scene": scene_ref(rows)}
        if actor is not None:
            args["actor"] = copy.deepcopy(actor)
        if kind == "measure":
            args.update(controls=copy.deepcopy(controls(actor["size"] * 2) if moves is None else moves),
                        evidence=list(evidence), lastAction=last, markerPrecaution=precaution)
            args["observation"] = {"observation_ref": "scene.public",
                                   "available_action_refs": list(args["controls"]) if available is None else available}
        if kind in ("topology", "contact"):
            args["calibration"] = copy.deepcopy(calibration)
        if kind == "contact":
            args.update(controls=copy.deepcopy(controls(actor["size"] * 2) if moves is None else moves),
                        removals=copy.deepcopy(list(removals)), remaining=remaining)
        if kind == "histogram":
            args["box"] = box
        source_search = []
        def observe(frame, event, _value):
            if event != "return":
                return
            v = frame.f_locals
            if frame.f_code.co_name == "_alternating_material_graph_measurement":
                source_search.append({"expanded": v.get("expanded"), "depthBound": v["maximum_depth"],
                                      "expansionBound": v["maximum_expanded_states"],
                                      "descriptions": len(v["records"]), "descriptionBoundReached": v["description_bound_reached"],
                                      "greatestDepth": max(v.get("depths", {None: 0}).values())})
            elif frame.f_code.co_name == "instrumental_contact" and "examined" in v:
                source_search.append({"examined": v["examined"], "states": len(v["parents"]),
                                      "greatestRemovedBitLength": max((state[1].bit_length() for state in v["parents"]), default=0)})
        original = copy.deepcopy([rows, args])
        sys.setprofile(observe)
        try:
            if kind == "measure":
                expected = measure(rows, args["observation"], args["actor"], args["controls"], args["evidence"],
                                   args["lastAction"], marker_precaution=args["markerPrecaution"])
            elif kind == "topology":
                expected = normalize_graph(topology(rows, args["actor"], args["calibration"]))
            elif kind == "contact":
                expected = instrumental_contact(rows, args["actor"], args["controls"], args["calibration"], args["removals"], args["remaining"])
            elif kind == "description":
                expected = projection(rows)
            elif kind == "overlays":
                expected = overlays(rows)
            elif kind == "histogram":
                expected = histogram(rows, box)
            else:
                raise AssertionError(kind)
            error = None
        except IndexError as caught:
            expected = None
            error = {"kind": type(caught).__name__, "message": str(caught)}
        finally:
            sys.setprofile(None)
        assert [rows, args] == original, name + " mutated input"
        item = {"kind": kind, "id": name, "arguments": args, "expected": expected}
        if error:
            item["error"] = error
        if source_search:
            item["sourceSearch"] = source_search
        if qualification:
            item["qualification"] = qualification
        cases.append(item)
        return expected

    basic, actor = grid()
    calibration = export("measure", "unique_grid_canonical_rc_route", basic, actor=actor)
    assert calibration["alternating_material_first_shortest_action_refs"] == ("ACTION4", "ACTION4", "ACTION2")
    export("description", "all_consumed_component_and_sprite_fields", basic)
    export("overlays", "one_nonuniform_component_crop", basic)
    export("topology", "one_uniform_target_and_no_guard", basic, actor=actor, calibration=calibration)
    export("contact", "no_guard_has_no_instrumental_contact", basic, actor=actor, calibration=calibration)
    for label, kwargs in (
        ("empty_evidence_withholds_full_route", {"evidence": ()}),
        ("null_last_action_withholds_full_route", {"last": None}),
        ("unknown_last_action_withholds_full_route", {"last": "UNKNOWN"}),
        ("reversed_control_insertion_order", {"moves": dict(reversed(list(controls().items())))}),
        ("empty_controls_no_route_bearing_description", {"moves": {}}),
        ("no_available_controls", {"available": []}),
        ("missing_one_direction_can_keep_a_directed_route", {"available": ["ACTION2", "ACTION4"]}),
        ("no_target_reachable_by_available_controls", {"available": ["ACTION1", "ACTION3"]}),
        ("wrong_measured_pitch_withholds_translation", {"moves": controls(3)}),
        ("duplicate_forward_aliases_remove_that_direction", {"moves": {**controls(), "OTHER_RIGHT": [0, 6]}}),
        ("zero_control_delta_is_ignored", {"moves": {**controls(), "NOTHING": [0, 0]}}),
        ("diagonal_control_not_a_cardinal_edge", {"moves": {**controls(), "DIAGONAL": [6, 6]}}),
        ("fractional_delta_uses_python_int", {"moves": {k: [d[0] + .9, d[1] + .9] for k, d in controls().items()}}),
        ("exact_extra_evidence_count_does_not_change_geometry", {"evidence": ("a", "b", "a", "c")}),
    ):
        export("measure", label, basic, actor=actor, **kwargs)
    moved_actor = copy.deepcopy(actor)
    moved_actor["bbox"] = [1, 7, 3, 9]
    export("measure", "single_overlay_with_unaligned_supplied_actor_keeps_geometry_only", basic, actor=moved_actor)
    unicode_moves = {"\U00010000": [6, 0], "\ue000": [0, 6], "UP": [-6, 0], "LEFT": [0, -6]}
    export("measure", "unicode_labels_do_not_replace_rc_first_shortest_order", basic, actor=actor, moves=unicode_moves, last="\ue000")

    for q in (2, 4, 5, 16, 17):
        rows, a = grid(q=q)
        export("overlays", "overlay_size_" + str(q), rows)
        export("measure", "square_quantum_" + str(q), rows, actor=a)
    rows, a = grid(1, 6)
    single = export("measure", "single_supported_departure_without_evidence", rows, actor=a, evidence=())
    assert single["nonuniform_overlay_single_adjacent_action_refs"] == ("ACTION4",)
    rows, a = grid(2, 3, phase=(0, 0))
    export("measure", "frame_boundary_squares_are_excluded", rows, actor=a)
    export("description", "boundary_crop_projection_and_frame_enclosure", rows)
    rows, a = grid(1, 4)
    export("measure", "fewer_than_four_ordinary_squares", rows, actor=a)
    rows, a = grid(3, 4, targets=[(0, 3), (2, 3)])
    result = export("measure", "two_targets_withhold_unique_route", rows, actor=a)
    assert result["alternating_material_route_witness_count"] == 2
    export("topology", "multiple_uniform_targets_reject_topology", rows, actor=a, calibration=calibration)
    repeated_rows, repeated_actor = grid(3, 4, targets=[(2, 3), (0, 3), (1, 3), (2, 2)])
    export("measure", "four_repeated_targets_create_a_second_material_description", repeated_rows, actor=repeated_actor)
    for count in (3, 4, 7, 8):
        targets = [(2, 3), (0, 3), (1, 3), (2, 2), (1, 2), (0, 2), (2, 1), (1, 1)][:count]
        rows, a = grid(4, 4, targets=targets)
        for (r, c), value in zip(targets, [4, 10, 11, 12, 13, 14, 15, 16]):
            fill(rows, 1 + 6 * r, 1 + 6 * c, 3, value)
        export("measure", "target_count_" + str(count), rows, actor=a)
    rows, a = grid(2, 3, targets=[])
    export("measure", "no_exceptional_uniform_target", rows, actor=a)
    export("topology", "no_uniform_target_rejects_topology", rows, actor=a, calibration=calibration)

    rows, a = grid(3, 3)
    guard(rows, 1, 2)
    assert not export("measure", "marker_precaution_absent_with_additional_occupant", rows, actor=a)["unique_alternating_material_graph_description_present"]
    assert not export("measure", "marker_front_excludes_target", rows, actor=a, precaution=True)["unique_alternating_material_graph_description_present"]
    guarded = copy.deepcopy(rows)
    guarded_actor = copy.deepcopy(a)
    export("description", "guard_crop_counts_and_singleton_projection", guarded)
    export("overlays", "actor_and_one_guard_in_source_order", guarded)
    graph = export("topology", "one_cardinal_guard", guarded, actor=a, calibration=calibration)
    assert graph["guards"][0]["front"] == (13, 13)
    removal = {"guard_histogram": [[3, 1], [7, 8]], "size": 3, "evidence": ["prior.contact", "prior.revealed_support"]}
    for remaining in (0, 1, 3, 4, 40):
        result = export("contact", "instrumental_contact_remaining_" + str(remaining), guarded, actor=a,
                        calibration=calibration, removals=[removal], remaining=remaining)
        assert (result is None) == (remaining < 4)
    result = cases[-1]["expected"]
    assert result["counterfactual_complete_length"] == 4
    assert result["prefix"][-1]["contact_index"] == 0
    for label, removals in (
        ("no_prior_removal", []),
        ("wrong_prior_histogram", [{**removal, "guard_histogram": [[1, 1], [7, 8]]}]),
        ("wrong_prior_size", [{**removal, "size": 5}]),
        ("all_matching_histogram_evidence_kept_after_one_size_witness", [removal, {**removal, "size": 5, "evidence": ["same.histogram.different.size"]}]),
        ("duplicate_matching_evidence_preserved", [removal, removal]),
    ):
        export("contact", label, guarded, actor=a, calibration=calibration, removals=removals)
    export("contact", "contact_controls_use_python_unicode_order", guarded, actor=a, calibration=calibration,
           removals=[removal], moves={"\U00010000": [0, 6], "\ue000": [6, 0], "UP": [-6, 0], "LEFT": [0, -6]})
    export("contact", "wrong_contact_delta_cannot_traverse_edges", guarded, actor=a, calibration=calibration, removals=[removal], moves=controls(3))
    export("topology", "wrong_calibration_pitch", guarded, actor=a, calibration={**calibration, "alternating_material_full_step_pitch": 3})
    for label, offset in (("up", (0, 1)), ("left", (1, 0)), ("right", (1, 2)), ("center", (1, 1)), ("diagonal", (0, 0))):
        rows, a = grid(3, 3)
        guard(rows, 1, 2, offset=offset)
        export("topology", "guard_marker_" + label, rows, actor=a, calibration=calibration)
        export("measure", "precaution_guard_marker_" + label, rows, actor=a, precaution=True)
    rows, a = grid(3, 3)
    guard(rows, 1, 2)
    rows[7][14] = 1
    export("topology", "three_color_guard_is_not_cardinal_singleton_contract", rows, actor=a, calibration=calibration)
    export("measure", "three_color_guard_rejects_precaution", rows, actor=a, precaution=True)
    for count in (2, 3, 4):
        rows, a = grid(4, 4)
        for c in range(count):
            guard(rows, 1, c, offset=(0, 1))
        export("measure", "additional_guard_count_" + str(count), rows, actor=a, precaution=True)
    # Unlike measurement's bounded precursor, the topology helper itself has
    # no three-guard limit. Exercise Python's non-wrapping removed bitmask.
    rows, a = grid(1, 38, actor=(0, 34), targets=[(0, 36)])
    for c in [*range(33), 35]:
        guard(rows, 0, c, offset=(0, 1))
    large_index = export("contact", "removed_guard_index_33_is_not_a_32_bit_mask", rows, actor=a, calibration=calibration,
                         moves={"RIGHT": [0, 6]}, removals=[removal])
    assert large_index["prefix"][-1]["contact_index"] == 33
    assert cases[-1]["sourceSearch"][0]["greatestRemovedBitLength"] == 34

    for length in (39, 40, 41):
        rows, a = grid(1, length + 1)
        result = export("measure", "source_maximum_route_depth_" + str(length), rows, actor=a)
        assert bool(result["alternating_material_first_shortest_action_refs"]) == (length <= 40)
    rows, a = grid(24, 24, q=2)
    result = export("measure", "source_512_expansion_bound", rows, actor=a)
    assert not result["unique_alternating_material_graph_description_present"]
    assert cases[-1]["sourceSearch"][0]["expanded"] == 512
    rows, a = grid(11, 11, actor=(10, 0))
    for c in range(2, 10):
        guard(rows, 0, c, offset=(0, 1))
    # The target in this case is reassigned to the opposite top corner.
    fill(rows, 61, 61, 3, 5)
    fill(rows, 1, 61, 3, 4)
    result = export("contact", "conditional_search_keeps_512_examined_bound", rows, actor=a,
                    calibration=calibration, removals=[removal], remaining=40)
    assert result is None
    assert cases[-1]["sourceSearch"][0]["examined"] == 512

    # Independent scales keep their measurements separate. Four descriptions
    # trigger the original (>3) ambiguity bound, rather than selecting one.
    subgraphs = [grid(q=q) for q in (2, 3, 4, 5)]
    for count in (2, 3, 4):
        width = sum(len(rows[0]) + 3 for rows, _ in subgraphs[:count]) + 1
        height = max(len(rows) for rows, _ in subgraphs[:count]) + 2
        rows = [[0] * width for _ in range(height)]
        left = 0
        for part, _ in subgraphs[:count]:
            for y, line in enumerate(part):
                rows[y][left:left + len(line)] = line
            left += len(part[0]) + 3
        result = export("measure", "independent_description_count_" + str(count), rows, actor=subgraphs[0][1])
        assert result["alternating_material_graph_description_count"] == count
        assert result["alternating_material_graph_description_bound_reached"] == (count == 4)

    for name, box in (("whole", [0, 0, len(basic) - 1, len(basic[0]) - 1]),
                      ("one_pixel", [2, 2, 2, 2]), ("negative_indices", [-2, -3, -1, -1]),
                      ("reversed_rows", [4, 1, 1, 3]), ("reversed_columns", [1, 4, 3, 1]),
                      ("row_outside", [len(basic), 0, len(basic), 0]),
                      ("column_outside", [0, len(basic[0]), 0, len(basic[0])]),
                      ("negative_row_outside", [-len(basic)-1, 0, -len(basic)-1, 0])):
        export("histogram", "histogram_" + name, basic, box=box)

    rng = random.Random(360786)
    for index in range(12):
        nr, nc = rng.randrange(3, 6), rng.randrange(3, 6)
        positions = [(r, c) for r in range(nr) for c in range(nc)]
        start, target = rng.sample(positions, 2)
        rows, a = grid(nr, nc, actor=start, targets=[target])
        for r, c in rng.sample([p for p in positions if p not in (start, target)], rng.randrange(4)):
            guard(rows, r, c, offset=rng.choice([(0, 1), (1, 0), (1, 2), (2, 1)]))
        export("measure", "neutral_public_raster_" + str(index).zfill(2), rows, actor=a, precaution=True)
        export("topology", "neutral_topology_" + str(index).zfill(2), rows, actor=a, calibration=calibration)
        export("contact", "neutral_contact_" + str(index).zfill(2), rows, actor=a, calibration=calibration, removals=[removal])
        if index < 2:
            export("description", "neutral_consumed_projection_" + str(index).zfill(2), rows)

    # Published PNG previews are immutable public pixels. Synthetic controls
    # below are only primitive arguments; they are not game observations and
    # must not be reused as learned controls by a campaign or runtime agent.
    from PIL import Image
    palette = ["FFFFFF", "CCCCCC", "999999", "666666", "333333", "000000", "E53AA3", "FF7BCC", "F93C31", "1E93FF", "88D8F1", "FFDC00", "FF851B", "921231", "4FCC30", "A356D6"]
    indices = {tuple(bytes.fromhex(value)): index for index, value in enumerate(palette)}
    atlas = Image.open(ROOT / "public/gallery/official.png").convert("RGB")
    expected_hashes = ["98673a054ca46c417d9b879aaa6997061bfa9ceeb34cf75f719faed6b504210f",
                       "96265052e474bee9ba84ea5a61a7300ea59f685f4c2ecca3d8cd6da9bed0acfc",
                       "50c0be06b5054312d8802f3a0616bec9fbc27586ce1071a95ab4e822f1ae4634"]
    for column, expected_hash in enumerate(expected_hashes):
        tile = atlas.crop((column * 64, 22 * 64, (column + 1) * 64, 23 * 64))
        rows = [[indices[tile.getpixel((x, y))] for x in range(64)] for y in range(64)]
        digest = hashlib.sha256(bytes(value for row in rows for value in row)).hexdigest()
        assert digest == expected_hash
        label = "public_gallery_frame_" + str(column + 1)
        public_rasters.append({"scene": scene_ref(rows), "frameSha256": digest, "source": "public/gallery/official.png", "tile": [column, 22], "tileSize": 64})
        found = export("overlays", label + "_overlays", rows)
        export("description", label + "_consumed_projection", rows)
        for index, candidate in enumerate(found):
            export("measure", label + "_candidate_" + str(index) + "_without_learned_controls", rows, actor=candidate,
                   moves={}, evidence=(), last=None, precaution=True,
                   qualification="Public preview raster; no action, learned controls, or solved-level claim.")
            export("measure", label + "_candidate_" + str(index) + "_synthetic_controls", rows, actor=candidate,
                   precaution=True, qualification="Direct primitive oracle only. Supplied control/evidence strings are synthetic and are never an agent or game trajectory.")
        # Pure topology has no calibration of control directions. These are
        # deliberately supplied measurement facts for a helper comparison.
        export("topology", label + "_explicit_calibration", rows, actor=found[0],
               calibration={"alternating_material_full_step_pitch": 6, "alternating_material_first_value": 0, "alternating_material_connector_values": [2]},
               qualification="Direct helper comparison using supplied material calibration; no learned actor identity or successful game action is claimed.")

    source_paths = [
        "agents/yf_arc3_v6/laya_proto/alternating_graph_observation.py",
        "agents/yf_arc3_v6/laya_proto/alternating_graph_questions.py",
        "agents/yf_arc3_v5/capabilities/interaction.py",
        "agents/yf_arc3_v5/capabilities/sprites.py",
        "agents/yf_arc3_v5/capabilities/components.py",
        "agents/yf_arc3_v5/capabilities/contracts.py",
    ]
    fixture = {"provenance": {"commit": COMMIT,
        "sourceMethod": "Direct calls to unchanged description, histogram, overlays, measure, topology and instrumental_contact. Read-only return profiling; no source rewriting, mocked measurement or supplied route.",
        "qualification": "The complete measure/overlays/histogram/contact returns and topology set/map semantics are compared. Description covers exactly the component and crop-sprite fields consumed by these wrappers, not unconsumed grids, holes, memberships or the rest of V5 sprites.py. Synthetic control and removal inputs exercise pure helpers; these cases are not solved-game evidence.",
        "sources": {path: hashlib.sha256((SOURCE / path).read_bytes()).hexdigest() for path in source_paths}},
        "publicRasters": public_rasters, "scenes": scenes, "cases": cases}
    output = ROOT / "tests/fixtures/v6-alternating-graph-measurement-reference.json.gz"
    output.write_bytes(gzip.compress((json.dumps(fixture, ensure_ascii=False, indent=2) + "\n").encode(), mtime=0))
    print(json.dumps({"path": str(output.relative_to(ROOT)), "cases": len(cases), "scenes": len(scenes),
                      "byKind": {kind: sum(item["kind"] == kind for item in cases) for kind in sorted(set(item["kind"] for item in cases))},
                      "bytes": output.stat().st_size}))


if __name__ == "__main__":
    main()
