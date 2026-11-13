"""Bounded translations of visible raster support onto repeated marker loci.

Values propose partitions only. No body, control, goal or action is selected;
Source interprets the exact correspondences and their incompleteness.
"""
from collections import defaultdict

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_rigid_marker_poses(*, frame, components, quantum, contract, association_rows=(),
        prior_target_rows=(), prior_body_rows=()):
    empty = FrozenMap({"rigid_marker_pose_rows": (),
        "rigid_marker_pose_enumeration_complete": True,
        "rigid_marker_pose_group_count": 0,
        "rigid_marker_non_axial_support_group_count": 0})
    if not contract or quantum is None or quantum <= 0:
        return empty
    if not frame or not frame[0] or len({len(row) for row in frame}) != 1:
        return FrozenMap({**dict(empty), "rigid_marker_pose_enumeration_complete": False})
    height, width = len(frame), len(frame[0])
    if height * width > contract["maximum_pixels"]:
        return FrozenMap({**dict(empty), "rigid_marker_pose_enumeration_complete": False})
    def bounded_point(point):
        return (len(point) == 2 and all(isinstance(x, int) for x in point)
            and 0 <= point[0] < height and 0 <= point[1] < width)
    if (len(prior_target_rows) > contract["maximum_groups"]
            or len(prior_body_rows) > contract["maximum_groups"]
            or len({row["partition_value"] for row in prior_target_rows}) != len(prior_target_rows)
            or len({row["partition_value"] for row in prior_body_rows}) != len(prior_body_rows)):
        return FrozenMap({**dict(empty), "rigid_marker_pose_enumeration_complete": False})
    for row in prior_target_rows:
        centres, rings = row["marker_centres"], row["marker_ring_rows"]
        if (not contract["minimum_markers"] <= len(centres) <= contract["maximum_markers"]
                or len(rings) != len(centres) or any(not bounded_point(p) for p in centres)
                or set(map(tuple, centres)) != {tuple(ring["centre"]) for ring in rings}
                or any(ring["ring_width"] not in contract["ring_widths"] for ring in rings)):
            return FrozenMap({**dict(empty), "rigid_marker_pose_enumeration_complete": False})
    for row in prior_body_rows:
        offsets = row["relative_support_pixels"]
        if (not bounded_point(row["indicator_position"])
                or not contract["minimum_support_pixels"] <= len(offsets) <= contract["maximum_support_pixels"]
                or any(len(p) != 2 or any(not isinstance(x, int) or abs(x) >= max(height, width)
                    for x in p) for p in offsets)):
            return FrozenMap({**dict(empty), "rigid_marker_pose_enumeration_complete": False})
    groups = defaultdict(list)
    ring_rows = defaultdict(list)
    excluded = set()
    for component in components:
        box = component.bbox
        if component.touches_frame_boundary:
            excluded.update(component.pixels)
        if (box.height != box.width or box.height not in contract["ring_widths"]
                or component.area != box.height * box.width - 1):
            continue
        middle = box.height // 2
        centre = (box.top + middle, box.left + middle)
        expected = tuple((r, c) for r in range(box.height) for c in range(box.width)
            if (r, c) != (middle, middle))
        if tuple(component.relative_pixels) != expected or frame[centre[0]][centre[1]] == component.value:
            continue
        centre_value = frame[centre[0]][centre[1]]
        groups[centre_value].append(centre)
        ring_rows[centre_value].append(FrozenMap({"centre": centre,
            "ring_width": box.height, "ring_value": component.value}))
    contradictions = 0
    for row in prior_target_rows:
        value = row["partition_value"]
        centres = tuple(map(tuple, row["marker_centres"]))
        contradictions += len(set(groups.get(value, ())) - set(centres))
        groups[value] = list(centres)
        ring_rows[value] = tuple(row["marker_ring_rows"])
    if len(groups) > contract["maximum_groups"]:
        return FrozenMap({**dict(empty), "rigid_marker_pose_enumeration_complete": False})
    singleton_positions = tuple(component.pixels[0] for component in components
        if component.area == 1 and not component.touches_frame_boundary)
    glyph_bindings = tuple((point, association) for point in singleton_positions
        for association in association_rows if association.get("active") is True
        and association.get("role_ref") == contract["indicator_role_ref"]
        and tuple(map(tuple, association.get("normalized_valued_pixels") or ()))
            == ((0, 0, frame[point[0]][point[1]]),))
    glyph_positions = tuple(sorted({point for point, association in glyph_bindings}))
    marker_pixels = frozenset((r + dr, c + dc)
        for value in sorted(ring_rows) for ring in ring_rows[value]
        for r, c in (ring["centre"],)
        for dr in range(-(ring["ring_width"]//2), ring["ring_width"]//2 + 1)
        for dc in range(-(ring["ring_width"]//2), ring["ring_width"]//2 + 1))
    templates = {row["partition_value"]: row for row in prior_body_rows}
    rows = []
    for value, centres in sorted(groups.items()):
        if not contract["minimum_markers"] <= len(centres) <= contract["maximum_markers"]:
            continue
        centre_set = frozenset(centres)
        visible_pixels = frozenset((r, c) for r in range(height) for c in range(width)
            if frame[r][c] == value and (r, c) not in centre_set and (r, c) not in excluded)
        pixels = visible_pixels
        template = templates.get(value)
        template_anchor_candidates = ()
        template_anchor = None
        incompatible = 0
        if template is not None:
            offsets = tuple(map(tuple, template["relative_support_pixels"]))
            def placed(anchor):
                return frozenset((anchor[0] + dr, anchor[1] + dc) for dr, dc in offsets)
            def incompatible_pixels(predicted):
                return sum(not (0 <= r < height and 0 <= c < width)
                    or (frame[r][c] != value and (r,c) not in marker_pixels
                        and frame[r][c] not in groups)
                    for r,c in predicted)
            template_anchor_candidates = tuple(point for point in glyph_positions
                if sum(p in visible_pixels for p in placed(point)) >= contract["minimum_support_pixels"]
                and incompatible_pixels(placed(point)) == 0)
            if len(template_anchor_candidates) <= 1:
                template_anchor = (template_anchor_candidates[0] if template_anchor_candidates
                    else tuple(template["indicator_position"]))
                predicted = placed(template_anchor)
                incompatible = incompatible_pixels(predicted)
                if incompatible == 0:
                    pixels = visible_pixels | predicted
        if not contract["minimum_support_pixels"] <= len(pixels) <= contract["maximum_support_pixels"]:
            continue
        top, bottom = min(r for r, c in pixels), max(r for r, c in pixels)
        left, right = min(c for r, c in pixels), max(c for r, c in pixels)
        adjacent = {(r, c): sum((r + dr, c + dc) in pixels
            for dr, dc in contract["neighbour_offsets"])
            for r, c in singleton_positions}
        internal = tuple((r, c) for r, c in singleton_positions
            if top < r < bottom and left < c < right and frame[r][c] != value
            and (adjacent[r, c] >= contract["minimum_internal_neighbours"]
                or (abs(2 * r - top - bottom) <= contract["maximum_midpoint_twice_offset"]
                    and abs(2 * c - left - right) <= contract["maximum_midpoint_twice_offset"])))
        if template is not None:
            internal = template_anchor_candidates
        # Connectivity is a measured partition, not an identity assignment.
        support = pixels | frozenset(point for point in internal
            if adjacent[point] >= contract["minimum_internal_neighbours"])
        remaining = set(support)
        partitions = 0
        while remaining:
            partitions += 1
            pending = [remaining.pop()]
            while pending:
                r, c = pending.pop()
                for dr, dc in contract["neighbour_offsets"]:
                    neighbour = (r + dr, c + dc)
                    if neighbour in remaining:
                        remaining.remove(neighbour)
                        pending.append(neighbour)
        # A raster support can be disconnected at a hollow junction or by a
        # visible marker overlay. Count those parts without inventing pixels.
        # Source declares the finite enumeration domain; current control and
        # cover eligibility remain independently qualified by DRM.
        if (partitions > contract.get("maximum_visible_support_partitions", 1)
                and template is None):
            continue
        translations = None
        for r, c in centres:
            supported = {(r - br, c - bc) for br, bc in pixels}
            translations = supported if translations is None else translations & supported
        translated_rows = []
        for dr, dc in sorted(translations or ()):
            if dr % quantum or dc % quantum:
                continue
            if not (0 <= top + dr <= bottom + dr < height
                    and 0 <= left + dc <= right + dc < width):
                continue
            translated_rows.append(FrozenMap({"delta_row": dr, "delta_col": dc,
                "primitive_distance": (abs(dr) + abs(dc)) // quantum}))
        if len(translated_rows) > contract["maximum_poses_per_group"]:
            return FrozenMap({**dict(empty), "rigid_marker_pose_enumeration_complete": False})
        token = stable_digest((value, tuple(sorted(pixels)), tuple(sorted(centres))))[:16]
        rows.append(FrozenMap({"measurement_ref": f"measurement.rigid_marker_pose.{token}",
            "partition_value": value, "marker_centres": tuple(sorted(centres)),
            "marker_ring_rows": tuple(ring_rows[value]),
            "visible_support_pixels": tuple(sorted(pixels)),
            "support_bbox": (top, left, bottom, right),
            "support_partition_count": partitions,
            "internal_singleton_positions": internal,
            "internal_singleton_values": tuple(frame[r][c] for r, c in internal),
            "internal_singleton_association_rows": tuple(FrozenMap({
                "position": point,
                "association_ref": association["term_ref"],
                "source_claim_refs": tuple(association.get("source_claim_refs") or ())})
                for point in internal for association in association_rows
                if association.get("active") is True
                and association.get("role_ref") == contract["indicator_role_ref"]
                and tuple(map(tuple, association.get("normalized_valued_pixels") or ()))
                    == ((0, 0, frame[point[0]][point[1]]),)),
            "pose_rows": tuple(translated_rows), "pose_count": len(translated_rows),
            "uses_scoped_support_template": template is not None,
            "template_pixel_incompatibility_count": incompatible,
            "template_anchor_match_count": len(template_anchor_candidates),
            "template_anchor": template_anchor,
            "relative_support_pixels": (
                tuple(map(tuple, template["relative_support_pixels"]))
                if template is not None else
                tuple((r-internal[0][0],c-internal[0][1]) for r,c in sorted(pixels))
            ) if len(internal)==1 else (),
            "translation_quantum": quantum,
            "uses_visible_support_lower_bound": True,
            "unobserved_support_is_not_certified": True}))
    def covered_by_one_row_and_column(points):
        # Any such cover must contain the first point on its row or column.
        # This exact linear predicate also accepts a cross with missing tips,
        # a hollow junction or marker occlusion; no hidden pixel is filled.
        first_row, first_col = points[0]
        return (len({c for r, c in points if r != first_row}) <= 1
                or len({r for r, c in points if c != first_col}) <= 1)

    return FrozenMap({"rigid_marker_pose_rows": tuple(rows),
        "rigid_marker_non_axial_support_group_count": sum(
            not covered_by_one_row_and_column(row["visible_support_pixels"])
            for row in rows),
        "rigid_marker_pose_enumeration_complete": True,
        "rigid_marker_pose_group_count": len(rows),
        "rigid_marker_pose_all_groups_admitted": len(rows) == len(groups),
        "rigid_marker_visible_target_contradiction_count": contradictions})


def measure_rigid_marker_action_delta(measurements, delta, *, action_ref=None, maximum_steps=0):
    """Exact distance deltas; interpretation and admission belong to Source."""
    rows = measurements.get("rigid_marker_pose_rows", ())
    bound_rows = tuple(row for row in rows if len(row["internal_singleton_association_rows"]) == 1)
    row = bound_rows[0] if len(bound_rows) == 1 else None
    distances = tuple(p["primitive_distance"] for p in row["pose_rows"]) if row else ()
    minimum = min(distances) if distances else -1
    quantum = row["translation_quantum"] if row else 0
    after = tuple((abs(p["delta_row"]-delta[0])+abs(p["delta_col"]-delta[1]))//quantum
        for p in row["pose_rows"]) if row and delta is not None and quantum > 0 else ()
    # A common axial prefix is a geometric measurement, not a commitment.
    # Each final pose already passed support/viewport bounds. Every intermediate
    # translation lies between its current and final axial support bounds.
    prefix_lengths = ()
    if (row and delta is not None and quantum > 0 and maximum_steps > 0
            and action_ref is not None
            and ((abs(delta[0]) == quantum and delta[1] == 0)
                 or (abs(delta[1]) == quantum and delta[0] == 0))):
        axis = "delta_row" if delta[0] else "delta_col"
        signed_step = delta[0] or delta[1]
        prefix_lengths = tuple(
            p[axis] // signed_step if p[axis] * signed_step > 0
            and p[axis] % signed_step == 0 else 0
            for p in row["pose_rows"])
    common_steps = min((*prefix_lengths, maximum_steps)) if prefix_lengths else 0
    return FrozenMap({
        "rigid_marker_common_axial_prefix_step_count": common_steps,
        "rigid_marker_common_axial_prefix_action_refs": tuple(action_ref for _ in range(common_steps)),
        "rigid_marker_common_axial_prefix_delta_row": delta[0] if common_steps else 0,
        "rigid_marker_common_axial_prefix_delta_col": delta[1] if common_steps else 0,
        "rigid_marker_control_binding_count": len(bound_rows),
        "rigid_marker_bound_pose_count": len(distances),
        "rigid_marker_bound_minimum_distance": minimum,
        "rigid_marker_candidate_minimum_distance_delta": min(after)-minimum if after else 0,
        "rigid_marker_candidate_has_measured_delta": delta is not None,
        "rigid_marker_other_nonzero_distance_count": sum(
            bool(r["pose_rows"]) and min(p["primitive_distance"] for p in r["pose_rows"]) > 0
            for r in rows if r not in bound_rows),
        "rigid_marker_template_contradiction_count": sum(r["template_pixel_incompatibility_count"]
            + int(r["template_anchor_match_count"] > 1) for r in rows),
        "rigid_marker_bound_body_rows": (FrozenMap({"partition_value":row["partition_value"],
            "relative_support_pixels":row["relative_support_pixels"],
            "indicator_position":row["internal_singleton_association_rows"][0]["position"]}),)
            if row and row["relative_support_pixels"] else (),
        "rigid_marker_bound_association_refs": tuple(a["association_ref"]
            for r in bound_rows for a in r["internal_singleton_association_rows"]),
        "rigid_marker_bound_source_claim_refs": tuple(dict.fromkeys(c
            for r in bound_rows for a in r["internal_singleton_association_rows"]
            for c in a["source_claim_refs"])),
        "rigid_marker_bound_source_claim_count": len({c for r in bound_rows
            for a in r["internal_singleton_association_rows"] for c in a["source_claim_refs"]}),
    })



def measure_marker_pair_pose_before_series_terminal(
        prior, origin, terminal_before, *, expected_delta, maximum_prefix_steps):
    """Rebind cached numeric pose to an actually observed pre-terminal frame.

    A whole executed interval is distinct from its final primitive. Match both
    material components uniquely by their exact observed signature, and require
    the fixed member to retain its position. No projected suffix supplies data.
    """
    from agents.yf_arc3_v5.capabilities.components import detect_components
    from agents.yf_arc3_v5.capabilities.contracts import ComponentExtractionInput, FrameGrid
    if (prior.get("unique_bounded_marker_pair_cover_present") is not True
            or prior.get("marker_pair_cover_pose_candidate_count") != 1
            or prior.get("marker_pair_cover_rotation_degrees") not in (0, 90, 180, 270)
            or origin.score != terminal_before.score
            or origin.metadata.get('level') != terminal_before.metadata.get('level')):
        return None
    moving=tuple(prior.get('marker_pair_cover_moving_bbox') or ())
    fixed=tuple(prior.get('marker_pair_cover_fixed_bbox') or ())
    if len(moving)!=4 or len(fixed)!=4:
        return None
    def components(world):
        return detect_components(ComponentExtractionInput(frame=FrameGrid(rows=world.frame),connectivity=4)).components
    def box(component):
        b=component.bbox
        return b.top,b.left,b.bottom,b.right
    def signature(component):
        return component.value,component.area,component.relative_pixels
    first,last=components(origin),components(terminal_before)
    sources=[c for c in first if box(c)==moving]
    anchors=[c for c in first if box(c)==fixed]
    if len(sources)!=1 or len(anchors)!=1:
        return None
    if (len(expected_delta)!=2 or any(type(v) is not int for v in expected_delta)
            or (expected_delta[0]==0)==(expected_delta[1]==0)
            or not 1 <= maximum_prefix_steps <= 128):
        return None
    current=[c for c in last if signature(c)==signature(sources[0])]
    stable=[c for c in last if signature(c)==signature(anchors[0])]
    frame=terminal_before.frame
    def support_matches(component,position):
        return (0 <= position[0] <= position[2] < len(frame)
                and 0 <= position[1] <= position[3] < len(frame[0])
                and all(frame[position[0]+r][position[1]+c]==component.value
                        for r,c in component.relative_pixels))
    if len(current)==1 and len(stable)==1 and box(stable[0])==fixed:
        candidates=(box(current[0]),)
    elif support_matches(anchors[0],fixed):
        # Touching same-material bodies can merge visible components. Check
        # the retained material footprint in the actual raster; background
        # holes are not parts of the moving body. Ambiguous matches stay open.
        candidates=tuple(position for count in range(maximum_prefix_steps+1)
            for position in (tuple(v+count*expected_delta[i%2] for i,v in enumerate(moving)),)
            if support_matches(sources[0],position))
    else:
        return None
    if len(candidates)!=1:
        return None
    actual=candidates[0];dr,dc=actual[0]-moving[0],actual[1]-moving[1]
    axis=0 if expected_delta[0] else 1
    count=(dr,dc)[axis]//expected_delta[axis]
    if not (0 <= count <= maximum_prefix_steps
            and (dr,dc)==tuple(count*v for v in expected_delta)):
        return None
    return FrozenMap.overlay({
        'marker_pair_cover_moving_bbox':actual,
        'marker_pair_cover_residual_row_twice':int(prior['marker_pair_cover_residual_row_twice'])-2*dr,
        'marker_pair_cover_residual_col_twice':int(prior['marker_pair_cover_residual_col_twice'])-2*dc,
    },prior)


def measure_current_marker_pair_axis_word(value, measurements, action_ref, candidate_ref):
    """Finite axial prefix from a current pose and its actual interval delta.

    This computes geometry only. DRM owns admission and conditional execution;
    no action is inferred from a recorded witness or an interface's unit pitch.
    """
    empty = FrozenMap({"marker_pair_axis_word_step_count": 0})
    moving = tuple(measurements.get("marker_pair_cover_moving_bbox") or ())
    fixed = tuple(measurements.get("marker_pair_cover_fixed_bbox") or ())
    prior = value.prior_bounded_marker_pair_cover_moving_bbox
    boxes = value.canonical_provisional_control_geometry_bboxes
    if (len(moving) != 4 or len(fixed) != 4 or prior is None or len(boxes) != 1
            or value.last_action_ref != action_ref
            or not value.prior_bounded_marker_pair_cover_unique
            or value.prior_bounded_marker_pair_pose_candidate_count != 1
            or value.prior_bounded_marker_pair_rotation_degrees not in (0, 90, 180, 270)
            or measurements.get("unique_bounded_marker_pair_cover_present") is not True
            or measurements.get("marker_pair_cover_pose_candidate_count") != 1
            or measurements.get("marker_pair_cover_rotation_degrees")
                != value.prior_bounded_marker_pair_rotation_degrees
            or measurements.get("marker_pair_cover_focus_transfer_required") is True
            or tuple(value.prior_bounded_marker_pair_cover_fixed_bbox or ()) != fixed):
        return empty
    # A translation can reduce the current pose's positional residual while a
    # rotation remains pending. Require the same unique relative orientation
    # across the observed translation; do not mistake that remaining obligation
    # for a change of model, or mark it satisfied by this purely axial word.
    if ((moving[2]-moving[0], moving[3]-moving[1])
            != (prior[2]-prior[0], prior[3]-prior[1])):
        return empty
    control = boxes[0]
    if not (control.top <= moving[0] <= moving[2] <= control.bottom
            and control.left <= moving[1] <= moving[3] <= control.right):
        return empty
    # The global rebinding question may remain open while this actual body has
    # a uniquely measured local displacement. Keep that uncertainty; do not turn
    # it into an additional blanket veto on a Source-authorized conditional word.
    # A second projection of the same immutable observation reuses the existing
    # action-aligned measurement, without applying its delta to the pose twice.
    observed = value.observed_input_aligned_action_translation
    current_projection = value.prior_bounded_marker_pair_measurement_is_current_observation
    if current_projection:
        if moving != tuple(prior) or observed is None or observed[0] != action_ref:
            return empty
        delta = int(observed[1]),int(observed[2])
    else:
        delta = moving[0]-prior[0], moving[1]-prior[1]
        if observed is not None and observed[0] == action_ref and delta != tuple(observed[1:]):
            return empty
    interface = {ref:(dr,dc) for ref,dr,dc in value.interface_action_translation_deltas}
    direction = interface.get(action_ref)
    if (direction is None or (delta[0] == 0) == (delta[1] == 0)
            or any((d != 0 and d*s <= 0) or (d == 0 and s != 0)
                   for d,s in zip(delta,direction))):
        return empty
    residual = (int(measurements.get("marker_pair_cover_residual_row_twice") or 0),
                int(measurements.get("marker_pair_cover_residual_col_twice") or 0))
    previous = (value.prior_bounded_marker_pair_residual_row_twice,
                value.prior_bounded_marker_pair_residual_col_twice)
    expected = previous if current_projection else tuple(p-2*d for p,d in zip(previous,delta))
    if residual != expected:
        return empty
    axis = 0 if residual[0] else 1
    step = 2*delta[axis]
    if step == 0 or residual[axis]*step <= 0 or residual[axis] % step:
        return empty
    count = min(residual[axis]//step,
                max(1,int(value.route_generation_policy.get("max_plan_actions",24))))
    frame = value.current_observed_frame or value.frame
    envelope = (control.top,control.left,control.bottom,control.right)
    endpoint = tuple(v+count*delta[i % 2] for i,v in enumerate(envelope))
    if count < 2 or not (0 <= endpoint[0] <= endpoint[2] < frame.height
                         and 0 <= endpoint[1] <= endpoint[3] < frame.width):
        return empty
    return FrozenMap({
        "marker_pair_axis_word_step_count": count,
        "marker_pair_axis_word_action_refs": (action_ref,)*count,
        "marker_pair_axis_word_candidate_refs": (candidate_ref,)*count,
        "marker_pair_axis_word_component_refs": (
            str(measurements["marker_pair_cover_moving_component_ref"]),),
        "marker_pair_axis_word_delta_row": delta[0],
        "marker_pair_axis_word_delta_col": delta[1],
    })
