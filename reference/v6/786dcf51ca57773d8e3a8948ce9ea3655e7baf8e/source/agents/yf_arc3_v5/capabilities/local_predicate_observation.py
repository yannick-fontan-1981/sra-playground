"""Exact local endpoint measurements; Source owns interpretation and reuse."""
from .components import detect_components
from .contracts import ComponentExtractionInput
from ..logos.types import FrozenMap, immutable_json_data, stable_digest


def annotate_local_predicate_input(value, agenda):
    """Transport an existing receipt and current canonical role, without a decision."""
    if not value.retained_physical_transition_receipt:
        return agenda
    rows = tuple(row for row in value.canonical_provisional_control_term_facts
        if row.get('control_support_partition_frame_ref') == value.current_observation_ref
        and not row.get('control_support_unresolved_refs')
        and not row.get('control_support_stale_term_refs') and row.get('shape_digest'))
    shapes = tuple(sorted(set(row['shape_digest'] for row in rows)))
    if len(shapes) != 1 or len(value.canonical_provisional_control_geometry_bboxes) != 1:
        return agenda
    box = value.canonical_provisional_control_geometry_bboxes[0]
    # Canonical geometric roles may deliberately omit a palette value. Join
    # their current box and shape to the actual component, rather than assume
    # that the role already carries this independent observation.
    known_values = set()
    for row in rows:
        if 'observed_value' in row and row['observed_value'] is not None:
            if type(row['observed_value']) is not int:
                return agenda
            known_values.add(row['observed_value'])
    if len(known_values) > 1:
        return agenda
    measured_values = tuple(sorted(set(c.value for c in value.components.components
        if c.bbox == box and stable_digest(c.relative_pixels).startswith(shapes[0])
        and (not known_values or c.value in known_values))))
    if len(measured_values) != 1:
        return agenda
    criteria = ((measured_values[0], shapes[0]),)

    supports = tuple(sorted(set(binding['term_ref'] for row in rows
        for binding in row.get('control_support_term_bindings', ()))))
    packet = immutable_json_data({'receipt': value.retained_physical_transition_receipt,
        'frame_ref': value.current_observation_frame_ref, 'level_index': value.observed_level_index,
        'epoch': value.current_context_epoch,
        'checkpoint_action_ref': value.level_start_checkpoint_action_ref, 'role_criterion': criteria[0],
        'role_support_refs': supports, 'current_pose': (box.top, box.left, box.bottom, box.right),
        'translation_laws': value.known_action_translation_deltas,
        'interface_deltas': value.interface_action_translation_deltas,
        'available_action_refs': value.available_action_refs,
        'underlay_rows': value.retained_translation_underlay_rows})
    return agenda.model_copy(update={'context_facts': FrozenMap.overlay(
        {'local_predicate_observation_input': packet}, agenda.context_facts)})


def matching_poses(frame, criterion):
    components = detect_components(ComponentExtractionInput(frame=frame, connectivity=4)).components
    return tuple((c.bbox.top, c.bbox.left, c.bbox.bottom, c.bbox.right) for c in components
        if c.value == criterion[0] and stable_digest(c.relative_pixels).startswith(criterion[1]))


def local_support(frame, pose, delta, underlay_rows):
    t, l, b, r = pose; dr, dc = delta
    bounds = (min(t,t+dr), min(l,l+dc), max(b,b+dr), max(r,r+dc))
    t, l, b, r = bounds
    if t < 0 or l < 0 or b >= frame.height or r >= frame.width:
        return None
    pixels = tuple(tuple(frame.rows[y][l:r+1]) for y in range(t,b+1))
    samples = tuple(sorted(set(tuple(sample[:3]) for row in underlay_rows
        for sample in row.get('support_samples', ())
        if t <= sample[0] <= b and l <= sample[1] <= r)))
    return {'bounds': bounds, 'pixel_digest': stable_digest(pixels),
        'known_support_samples': samples, 'known_support_digest': stable_digest(samples),
        'known_support_scope': 'knowledge_at_measurement_return_not_asserted_before_action'}


def measure_endpoint_translation(before, after, criterion, expected, underlay_rows):
    origins, destinations = matching_poses(before, criterion), matching_poses(after, criterion)
    known = len(origins) == len(destinations) == 1
    actual = ((destinations[0][0]-origins[0][0],destinations[0][1]-origins[0][1])
        if known else None)
    support = local_support(before, origins[0], expected, underlay_rows) if known else None
    return {'endpoint_measurement_known': known, 'before_matches': origins, 'after_matches': destinations,
        'measured_delta': actual, 'expected_delta': tuple(expected),
        'expected_delta_observed': known and actual == tuple(expected),
        'before_local_support': support, 'horizon': 'one_observed_response_endpoints',
        'trajectory_absence_measured': False}
