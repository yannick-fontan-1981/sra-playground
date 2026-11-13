"""Exact hollow-frame/body correspondences and bounded pixel-pose contacts.

No palette or component receives a semantic role. DRM interprets the measured
correspondence; SRC selects and releases an experiment. Sprite extent and
observed translation magnitude are separate geometric quantities.
"""
from dataclasses import dataclass

from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.contracts import ComponentExtractionInput, BoundingBox
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


@dataclass(frozen=True)
class HollowFrameBodyPair:
    frame_component: object
    body_component: object


@dataclass(frozen=True)
class RevalidatedEnclosure:
    component_id: str
    value: int
    bbox: object
    relative_pixels: tuple
    occluded_pixel_count: int


def measure_stationary_enclosure_rows(before, after, *, transition_ref, context_epoch):
    rows = {}
    for pair in measure_hollow_frame_body_pairs(before):
        outer = pair.frame_component
        if not all(after.rows[r][c] == outer.value for r, c in outer.pixels):
            continue
        box = outer.bbox
        token = stable_digest((outer.value, box, outer.relative_pixels))[:24]
        rows[token] = FrozenMap({'enclosure_token': token, 'value': outer.value,
            'bbox': (box.top, box.left, box.bottom, box.right),
            'relative_pixels': outer.relative_pixels, 'matching_body_value': pair.body_component.value,
            'transition_ref': transition_ref, 'context_epoch': context_epoch,
            'exact_stationary_perimeter_present': True})
    return tuple(rows[key] for key in sorted(rows))


def revalidate_enclosure_memories(frame, memories, occluding_rows, anchor_boxes=(),
                                *, controlled_term_facts=(), components=()):
    masks = set()
    # A currently reidentified controlled silhouette can explain an occlusion
    # just as a matched contour can. Mask its exact pixels, never its whole box.
    for component in components if controlled_term_facts else ():
        if component.bbox not in anchor_boxes:
            continue
        shape_digest = stable_digest(component.relative_pixels)[:16]
        if any(row.get('role_premise_claim_refs')
               and row.get('observed_value') == component.value
               and row.get('bbox_height') == component.bbox.height
               and row.get('bbox_width') == component.bbox.width
               and row.get('shape_digest') == shape_digest
               for row in controlled_term_facts):
            masks.update(component.pixels)
    for row in occluding_rows:
        origin = (row.get('origin_row'), row.get('origin_col'))
        pixels = row.get('relative_boundary', ())
        value = row.get('observed_value')
        if value is None or not pixels:
            continue
        height=max(r for r,c in pixels)+1; width=max(c for r,c in pixels)+1
        interiors=frozenset(tuple(point) for point in row.get('relative_interior', ()))
        candidates=[]
        for top in range(frame.height-height+1):
            for left in range(frame.width-width+1):
                if anchor_boxes and not any(all((r-top,c-left) in interiors
                    for r in range(box.top,box.bottom+1) for c in range(box.left,box.right+1))
                    for box in anchor_boxes):
                    continue
                absolute=tuple((r+top,c+left) for r,c in pixels)
                if all(frame.rows[r][c]==value for r,c in absolute):candidates.append(absolute)
        if len(candidates)==1:
            masks.update(candidates[0])
    recovered = []
    for row in memories:
        top, left, bottom, right = row['bbox']
        if not (0 <= top <= bottom < frame.height and 0 <= left <= right < frame.width):
            continue
        expected = tuple((top+r, left+c) for r, c in row['relative_pixels'])
        missing = tuple(p for p in expected if frame.rows[p[0]][p[1]] != row['value'])
        if not missing or len(missing) == len(expected) or any(p not in masks for p in missing):
            continue
        recovered.append(RevalidatedEnclosure(component_id=row['term_ref'], value=row['value'],
            bbox=BoundingBox(top=top, left=left, bottom=bottom, right=right),
            relative_pixels=tuple(row['relative_pixels']), occluded_pixel_count=len(missing)))
    return tuple(recovered)


def measure_hollow_frame_body_pairs(frame, memories=(), occluding_rows=(), anchor_boxes=(),
                                  controlled_term_facts=()):
    if frame.height * frame.width > 4096:
        return ()
    grouped = detect_components(ComponentExtractionInput(frame=frame, connectivity=8)).components
    bodies = detect_components(ComponentExtractionInput(frame=frame, connectivity=4)).components
    if len(grouped) > 128 or len(bodies) > 128:
        return ()
    frames = []
    for component in grouped:
        box = component.bbox
        if min(box.height, box.width) < 5 or component.touches_frame_boundary:
            continue
        pixels = frozenset(component.relative_pixels)
        border = frozenset(
            (row, col) for row in range(box.height) for col in range(box.width)
            if row in (0, box.height - 1) or col in (0, box.width - 1)
        )
        corners = frozenset(((0, 0), (0, box.width - 1),
                             (box.height - 1, 0), (box.height - 1, box.width - 1)))
        if pixels not in (border, border - corners):
            continue
        # Keep filled/occupied frames separate from the empty geometry.
        if any(frame.rows[row][col] == component.value
               for row in range(box.top + 1, box.bottom)
               for col in range(box.left + 1, box.right)):
            continue
        frames.append(component)
    frames.extend(revalidate_enclosure_memories(
        frame, memories, occluding_rows, anchor_boxes,
        controlled_term_facts=controlled_term_facts, components=bodies))
    pairs = []
    for outer in frames:
        for body in bodies:
            b, o = body.bbox, outer.bbox
            if (body.value != outer.value or min(b.height, b.width) < 3
                    or body.touches_frame_boundary
                    or b.height > o.height - 2 or b.width > o.width - 2
                    or body.area <= max(b.height, b.width)):
                continue
            if not (b.bottom < o.top or o.bottom < b.top
                    or b.right < o.left or o.right < b.left):
                continue
            pairs.append(HollowFrameBodyPair(outer, body))
            if len(pairs) > 32:
                return ()
    return tuple(pairs)


def _pixel_translation_quantum(value):
    observed = value.observed_input_aligned_action_translation
    if observed is not None:
        action, row, col = observed
        row, col = int(row), int(col)
        for direction, unit_row, unit_col in value.interface_action_translation_deltas:
            if direction != action or abs(int(unit_row)) + abs(int(unit_col)) != 1:
                continue
            # The current reidentified control's directional displacement is
            # more specific than an accumulated cross-object translation.
            if (row == 0 and int(unit_row) == 0 and col * int(unit_col) > 1):
                return abs(col)
            if (col == 0 and int(unit_col) == 0 and row * int(unit_row) > 1):
                return abs(row)
    magnitudes = {
        abs(int(row) or int(col))
        for _action, row, col in value.known_action_translation_deltas
        if (int(row) == 0) != (int(col) == 0) and abs(int(row) or int(col)) > 1
    }
    if observed is not None:
        _action, row, col = observed
        if (int(row) == 0) != (int(col) == 0) and abs(int(row) or int(col)) > 1:
            magnitudes.add(abs(int(row) or int(col)))
    if not magnitudes:
        return None
    quantum = min(magnitudes)
    return quantum if all(n % quantum == 0 for n in magnitudes) else None


def measure_paired_body_contact(value):
    frame = value.current_observed_frame or value.frame
    canonical = tuple(value.canonical_provisional_control_geometry_bboxes)
    pairs = measure_hollow_frame_body_pairs(frame, value.canonical_matching_enclosure_memory_rows,
                                          value.canonical_occluding_contour_rows, canonical,
                                          value.canonical_provisional_control_term_facts)
    raw = tuple(value.input_aligned_entity_bboxes)
    boxes = canonical if len(canonical) == 1 else ()
    quantum = _pixel_translation_quantum(value)
    context = {
        "hollow_frame_fitting_uncontained_body_pair_count": len(pairs),
        "hollow_frame_revalidated_occluded_pair_count": sum(
            bool(getattr(pair.frame_component, 'occluded_pixel_count', 0)) for pair in pairs),
        "paired_contact_control_bbox_count": len(boxes),
        "paired_contact_canonical_bbox_count": len(canonical),
        "paired_contact_raw_bbox_count": len(raw),
        "paired_contact_observed_translation": value.observed_input_aligned_action_translation,
        "paired_contact_observed_pixel_quantum": quantum or 0,
        "paired_body_control_contact_present": False,
    }
    if len(pairs) != 1 or len(boxes) != 1:
        return {}, FrozenMap(context)
    mover, pair = boxes[0], pairs[0]
    body, target = pair.body_component, pair.frame_component
    box = body.bbox
    # Never use the controller itself as the supposedly independent body.
    if mover == box:
        return {}, FrozenMap(context)
    contact = not (mover.bottom < box.top or box.bottom < mover.top
                   or mover.right < box.left or box.right < mover.left)
    context.update({
        "paired_body_control_contact_present": contact,
        "paired_contact_body_ref": body.component_id,
        "paired_contact_frame_ref": target.component_id,
        "paired_contact_body_bbox": (box.top, box.left, box.bottom, box.right),
        "paired_contact_receiving_bbox": (target.bbox.top, target.bbox.left,
                                          target.bbox.bottom, target.bbox.right),
    })
    mover_tuple = (mover.top, mover.left, mover.bottom, mover.right)
    body_tuple = (box.top, box.left, box.bottom, box.right)
    assemblies = tuple(row for row in value.canonical_controlled_assembly_term_facts
        if mover_tuple in row.get('member_bbox_tuples', ())
        and body_tuple in row.get('member_bbox_tuples', ()))
    member_present = bool(assemblies)
    target_box = target.bbox
    receiver_contact = not (box.bottom < target_box.top + 1 or target_box.bottom - 1 < box.top
                            or box.right < target_box.left + 1 or target_box.right - 1 < box.left)
    # Current paint supports adjacent to the reference enclosure. Keep every
    # connected support; this measures a contact domain, not a terrain law.
    receiver_ring = frozenset((row, col)
        for row in range(max(0, target_box.top - 1), min(frame.height, target_box.bottom + 2))
        for col in range(max(0, target_box.left - 1), min(frame.width, target_box.right + 2))
        if not (target_box.top <= row <= target_box.bottom and target_box.left <= col <= target_box.right))
    receiver_support = frozenset(point
        for component in detect_components(ComponentExtractionInput(frame=frame, connectivity=4)).components
        if receiver_ring.intersection(component.pixels)
        for point in component.pixels)
    def surface_contact(top, left):
        return any((row, col) in receiver_support
            for row in range(max(0, top - 1), min(frame.height, top + mover.height + 1))
            for col in range(max(0, left - 1), min(frame.width, left + mover.width + 1)))
    receiver_surface_contact = surface_contact(mover.top, mover.left)
    context.update({
        'paired_body_in_control_assembly': member_present,
        'paired_body_receiver_contact_present': receiver_contact,
        'paired_receiver_surface_contact_present': receiver_surface_contact,
        'paired_contact_reference_is_receiving_frame': member_present,
        'paired_control_assembly_premise_claim_refs': tuple(dict.fromkeys(
            ref for row in assemblies for ref in row.get('role_premise_claim_refs', ()))),
    })
    if (receiver_surface_contact if member_present else contact) or quantum is None:
        return {}, FrozenMap(context)
    deltas = {
        str(action): (int(row) * quantum, int(col) * quantum)
        for action, row, col in value.interface_action_translation_deltas
        if action in value.available_action_refs and abs(int(row)) + abs(int(col)) == 1
    }
    if not deltas:
        return {}, FrozenMap(context)
    # Reuse the bounded residual BFS; request its anonymous exact pose goals.
    from agents.yf_arc3_v5.capabilities.interaction import _bfs_residual_path
    routes = {}
    reference = box if member_present else mover
    target_top = target_box.top + 1 if member_present else box.top
    target_left = target_box.left + 1 if member_present else box.left
    target_bottom = target_box.bottom - 1 if member_present else box.bottom
    target_right = target_box.right - 1 if member_present else box.right
    row_offset, col_offset = reference.top - mover.top, reference.left - mover.left
    tops = range(0, frame.height - mover.height + 1) if member_present else range(max(0, target_top - reference.height + 1 - row_offset), min(target_bottom - row_offset, frame.height - mover.height) + 1)
    lefts = range(0, frame.width - mover.width + 1) if member_present else range(max(0, target_left - reference.width + 1 - col_offset), min(target_right - col_offset, frame.width - mover.width) + 1)
    for top in tops:
        for left in lefts:
            if ((top - mover.top) % quantum or (left - mover.left) % quantum):
                continue
            if member_present and not surface_contact(top, left):
                continue
            residual = (2 * (top - mover.top), 2 * (left - mover.left))
            for first in sorted(deltas):
                dr, dc = deltas[first]
                remaining = (residual[0] - 2 * dr, residual[1] - 2 * dc)
                if abs(remaining[0]) + abs(remaining[1]) >= abs(residual[0]) + abs(residual[1]):
                    continue
                suffix = _bfs_residual_path(
                    residual_row=remaining[0], residual_col=remaining[1],
                    action_deltas=deltas, couple=(1, 1), max_depth=31,
                )
                if not suffix and remaining != (0, 0):
                    continue
                route = (first, *suffix)
                prior = routes.get(first)
                if prior is None or (len(route), route) < (len(prior[0]), prior[0]):
                    routes[first] = (route, (top, left, top + mover.height - 1, left + mover.width - 1))
    measured = {}
    known_deltas = {str(action): (int(row), int(col))
                    for action, row, col in value.known_action_translation_deltas}
    for action in sorted(routes):
        route, endpoint = routes[action]
        measured[action] = FrozenMap({
            "paired_contact_route_present": True,
            "paired_contact_route_action_refs": route,
            "paired_contact_route_action_payloads": tuple(
                FrozenMap({"expected_step_delta_row": deltas[ref][0],
                           "expected_step_delta_col": deltas[ref][1]})
                for ref in route
            ),
            "paired_contact_route_uses_only_pose_geometry": True,
            "paired_contact_route_candidate_refs": tuple(f"probe:discrete:{ref}" for ref in route),
            "paired_contact_route_length": len(route),
            "paired_contact_route_actions_all_observed": all(known_deltas.get(ref) == deltas[ref] for ref in route),
            "paired_contact_route_ref": "measurement.paired_contact." + stable_digest((body.component_id, target.component_id, route))[:20],
            "paired_contact_route_endpoint_bbox": endpoint,
            "paired_contact_endpoint_top": endpoint[0],
            "paired_contact_endpoint_left": endpoint[1],
            "paired_contact_endpoint_bottom": endpoint[2],
            "paired_contact_endpoint_right": endpoint[3],
            "paired_contact_step_delta_row": deltas[action][0],
            "paired_contact_step_delta_col": deltas[action][1],
        })
    return measured, FrozenMap(context)
