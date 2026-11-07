"""Exact repeated cell insets and bounded routes; no goals or verdict meanings."""
from collections.abc import Mapping

from .agenda_measurement_transport import append_candidate_measurements
from ..logos.types import FrozenMap, stable_digest


def _bbox_tuple(box):
    return (box.top, box.left, box.bottom, box.right)


def _signature(raw):
    if not isinstance(raw, (tuple, list)) or len(raw) != 4:
        return None
    try:
        return (int(raw[0]), int(raw[1]), int(raw[2]),
                tuple(tuple(int(x) for x in pixel) for pixel in raw[3]))
    except (TypeError, ValueError):
        return None


def measure_repeated_inset_domain(value, contract):
    from .interaction import (_unique_primitive_action_translation_quantum,
        _unique_action_conditioned_control_centered_grid_candidate,
        _action_quantized_route_grid_evidence_is_current)
    if (not contract or not _action_quantized_route_grid_evidence_is_current(value)
            or value.current_context_epoch is None):
        return FrozenMap(), ()
    frame = value.frame
    bodies = tuple(value.input_aligned_entity_bboxes)
    if (frame.height * frame.width > contract['maximum_frame_pixels']
            or len(bodies) != 1 or bodies[0].height * bodies[0].width != 1):
        return FrozenMap(), ()
    quantum = _unique_primitive_action_translation_quantum(value)
    if quantum is None:
        return FrozenMap(), ()
    grid = _unique_action_conditioned_control_centered_grid_candidate(value, quantum=quantum)
    if grid is None or not grid.cells or len(grid.cells) > contract['maximum_cells']:
        return FrozenMap(), ()
    phase = (grid.cells[0].bbox.top % quantum, grid.cells[0].bbox.left % quantum)
    geometry = (frame.height, frame.width, quantum, *phase)
    groups = {}
    for cell in grid.cells:
        box = cell.bbox
        if (box.top < 0 or box.left < 0 or box.bottom >= frame.height
                or box.right >= frame.width or box.height * box.width > contract['maximum_cell_pixels']):
            continue
        if any(not (body.bottom < box.top or box.bottom < body.top
                    or body.right < box.left or box.right < body.left) for body in bodies):
            continue
        border = {frame.rows[row][col]
            for row in range(box.top, box.bottom + 1) for col in range(box.left, box.right + 1)
            if row in (box.top, box.bottom) or col in (box.left, box.right)}
        if len(border) != 1:
            continue
        substrate = next(iter(border))
        inset = tuple((row - box.top, col - box.left, frame.rows[row][col])
            for row in range(box.top + 1, box.bottom) for col in range(box.left + 1, box.right)
            if frame.rows[row][col] != substrate)
        if inset and len(inset) <= contract['maximum_inset_pixels']:
            groups.setdefault((box.height, box.width, substrate, inset), []).append(box)
    prior = {}
    for record in value.canonical_probe_precondition_facts[-contract['maximum_canonical_samples']:]:
        sample = record.get('support_preconditions', {}).get('repeated_inset_domain_sample')
        if (not isinstance(sample, Mapping)
                or sample.get('context_epoch') != value.current_context_epoch
                or tuple(sample.get('geometry', ())) != geometry):
            continue
        signature = _signature(sample.get('signature'))
        if signature is not None and signature in groups:
            prior.setdefault(signature, set()).add(record['claim_ref'])
    repeated = tuple(key for key, boxes in sorted(groups.items()) if len(boxes) >= 2)
    licensed = tuple(sorted(set(repeated) | set(prior)))
    unscoped_pattern_count = len(licensed)
    # Exact filtering against Source-supplied concrete target references keeps
    # an already bound query separate from unrelated new repeated patterns.
    target_refs = {ref for _, facts in sorted(value.dynamic_goal_facts.items())
        for ref in (facts.get('concrete_target_ref'),
                    *tuple(facts.get('concrete_target_candidates') or ())) if ref}
    continuity = value.canonical_dispatched_goal_continuity_facts
    carried = continuity.get('dispatched_composition_target_context') or FrozenMap()
    carried_token = carried.get('repeated_inset_domain_token')
    if (carried_token and carried.get('context_epoch') == value.current_context_epoch
            and tuple(carried.get('geometry') or ()) == geometry):
        target_refs.add(carried_token)
    referenced = tuple(signature for signature in licensed
        if stable_digest((value.current_context_epoch, geometry, signature)) in target_refs)
    if referenced:
        licensed = referenced
    if len(licensed) != 1:
        return FrozenMap({'repeated_inset_domain_pairing_count': len(licensed)}), ()
    signature = licensed[0]
    boxes = tuple(groups[signature])
    token = stable_digest((value.current_context_epoch, geometry, signature))
    bindings = tuple((ref, facts) for ref, facts in sorted(value.dynamic_goal_facts.items())
        if facts.get('concrete_target_ref') == token
        or token in tuple(facts.get('concrete_target_candidates') or ()))
    from .occupied_cell_contact import measure_occupied_cell_contact
    contact = measure_occupied_cell_contact(value,
        value.route_generation_policy.get('occupied_cell_contact_observation_contract', {}))
    prior_frame = value.previous_action_observed_frame
    contact_matches = False
    if contact and prior_frame is not None:
        bounds = contact['occupied_cell_contact_context']['cell_bbox']
        top, left, bottom, right = bounds
        border = {prior_frame.rows[row][col]
            for row in range(top, bottom + 1) for col in range(left, right + 1)
            if row in (top, bottom) or col in (left, right)}
        if len(border) == 1:
            substrate = next(iter(border))
            inset = tuple((row - top, col - left, prior_frame.rows[row][col])
                for row in range(top + 1, bottom) for col in range(left + 1, right)
                if prior_frame.rows[row][col] != substrate)
            contact_matches = (bottom-top+1, right-left+1, substrate, inset) == signature
    sample = FrozenMap({'context_epoch': value.current_context_epoch,
        'geometry': geometry, 'signature': signature, 'domain_token': token,
        'member_boxes': tuple(_bbox_tuple(box) for box in boxes)})
    return FrozenMap({'repeated_inset_domain_present': True,
        'repeated_inset_domain_pairing_count': 1,
        'repeated_inset_domain_unscoped_pattern_count': unscoped_pattern_count,
        'repeated_inset_domain_token': token,
        'repeated_inset_domain_continuity_context': FrozenMap({
            'repeated_inset_domain_token': token,
            'context_epoch': value.current_context_epoch, 'geometry': geometry,
            # Preserve the immutable prior WHY by reference, not as current
            # action premises. Its control may belong to an earlier frame.
            'prior_dispatch_intent_ref': continuity.get('dispatched_composition_intent_ref'),
            'parent_goal_why_premise_count': len(continuity.get('dispatched_parent_premise_refs', ())),
            'parent_goal_why_premise_digest': stable_digest(tuple(
                continuity.get('dispatched_parent_premise_refs', ())))}),
        'repeated_inset_domain_dispatched_target_matches': (
            carried_token == token and carried.get('context_epoch') == value.current_context_epoch
            and tuple(carried.get('geometry') or ()) == geometry),
        'repeated_inset_domain_dispatched_parent_goal_ref': continuity.get(
            'dispatched_goal_continuity_parent_goal_ref'),
        'repeated_inset_domain_dispatched_instrumental_count': len(
            continuity.get('dispatched_parent_instrumental_refs', ())),
        'repeated_inset_domain_sample': sample,
        'repeated_inset_domain_current_member_count': len(boxes),
        'repeated_inset_domain_current_member_boxes': tuple(_bbox_tuple(box) for box in boxes),
        'repeated_inset_domain_inset_pixel_count': len(signature[-1]),
        'repeated_inset_domain_current_control_pixel_count': 1,
        'repeated_inset_domain_current_contact_matches_pattern': contact_matches,
        'repeated_inset_domain_bound_goal_count': len(bindings),
        'repeated_inset_domain_current_goal_count': len(value.dynamic_goal_refs),
        'repeated_inset_domain_bound_goal_ref': bindings[0][0] if len(bindings) == 1 else None,
        'repeated_inset_domain_prior_sample_claim_refs': tuple(sorted(prior.get(signature, ()))),
        'repeated_inset_domain_current_repetition_present': signature in repeated,
        'repeated_inset_domain_frame_ref': value.current_observation_frame_ref,
        'repeated_inset_domain_quantum': quantum}), boxes


def _route_ends_in_boxes(value, facts, boxes, quantum):
    word = facts.get('provisional_object_terminating_action_refs') or ()
    if not word or len(value.input_aligned_entity_bboxes) != 1:
        return False
    deltas = {ref: (row, col) for ref, row, col in value.interface_action_translation_deltas}
    row = col = 0
    for action in word:
        if action not in deltas:
            return False
        dr, dc = deltas[action]
        if bool(dr) == bool(dc):
            return False
        row += (1 if dr > 0 else -1 if dr < 0 else 0) * quantum
        col += (1 if dc > 0 else -1 if dc < 0 else 0) * quantum
    body = value.input_aligned_entity_bboxes[0]
    return any(box.top <= body.top + row <= body.bottom + row <= box.bottom
        and box.left <= body.left + col <= body.right + col <= box.right for box in boxes)


def append_repeated_inset_domain_measurements(value, agenda, contract):
    context, boxes = measure_repeated_inset_domain(value, contract)
    if not boxes:
        return agenda
    from .ordinal_prefix_samples import measure_ordinal_prefix_samples
    from .contracts import BoundingBox
    member_boxes = set(context['repeated_inset_domain_current_member_boxes'])
    if context['repeated_inset_domain_current_contact_matches_pattern']:
        from .occupied_cell_contact import measure_occupied_cell_contact
        contact = measure_occupied_cell_contact(value,
            value.route_generation_policy.get('occupied_cell_contact_observation_contract', {}))
        member_boxes.add(tuple(contact['occupied_cell_contact_context']['cell_bbox']))
    prefix = measure_ordinal_prefix_samples(value, context, member_boxes,
        contract.get('ordinal_prefix_observation_contract', {}))
    context = FrozenMap.overlay(prefix, context)
    subset = tuple(context.get('repeated_inset_indicator_current_member_boxes') or ())
    # A complete singleton arithmetic fit may delimit an additional conditional
    # query. DRM still decides whether its evidence licenses the interpretation.
    query_boxes = boxes
    if (contract.get('singleton_inverse_l1_subset_candidate_scope') is True
            and context.get('repeated_inset_indicator_unique_fit_count') == 1 and subset):
        query_boxes = tuple(BoundingBox(top=t, left=l, bottom=b, right=r)
            for t, l, b, r in subset)
    # No extra route query if any complete route witness already exists.
    # A new query therefore has the kernel's existing global bound of three,
    # shared by the whole target set, rather than one budget per member.
    existing = tuple(ref for ref in agenda.alternative_refs
        if agenda.alternative_facts[ref].get('provisional_object_terminating_route_ref'))
    if not existing:
        from .interaction import _enumerate_interaction_probes_with_declared_scope
        variants = _enumerate_interaction_probes_with_declared_scope(value, requested_endpoint_boxes=query_boxes)
        candidates = list(agenda.candidates)
        facts = dict(agenda.alternative_facts)
        deltas = dict(agenda.descriptive_delta_facts or agenda.alternative_facts)
        for candidate in variants.candidates:
            row = variants.alternative_facts[candidate.candidate_ref]
            route_ref = row.get('provisional_object_terminating_route_ref')
            if not route_ref:
                continue
            ref = 'probe:route-variant:' + stable_digest((route_ref, candidate.action_ref))[:24]
            measured = FrozenMap.overlay(FrozenMap({'candidate_ref': ref}),
                FrozenMap.overlay(row, variants.context_facts))
            candidates.append(candidate.model_copy(update={'candidate_ref': ref}))
            facts[ref] = measured
            deltas[ref] = measured
        agenda = agenda.model_copy(update={'candidates': tuple(candidates),
            'alternative_refs': tuple(candidate.candidate_ref for candidate in candidates),
            'alternative_facts': FrozenMap(facts), 'descriptive_delta_facts': FrozenMap(deltas),
            'has_candidates': bool(candidates)})
    quantum = context['repeated_inset_domain_quantum']
    members = {ref: facts for ref in agenda.alternative_refs
        for facts in (agenda.alternative_facts[ref],)
        if facts.get('provisional_object_terminating_route_ref')
        and _route_ends_in_boxes(value, facts, boxes, quantum)}
    lengths = {ref: int(facts['provisional_object_terminating_route_length'])
        for ref, facts in sorted(members.items())}
    minimum = min(sorted(lengths.values())) if lengths else None
    subset_boxes = tuple(BoundingBox(top=t, left=l, bottom=b, right=r)
        for t, l, b, r in subset)
    subset_lengths = {ref: length for ref, length in sorted(lengths.items())
        if _route_ends_in_boxes(value, members[ref], subset_boxes, quantum)}
    subset_minimum = min(sorted(subset_lengths.values())) if subset_lengths else None
    rows = FrozenMap({ref: FrozenMap.overlay(FrozenMap({
        'candidate_is_repeated_inset_domain_route': ref in members,
        'repeated_inset_domain_route_is_minimum': ref in lengths and lengths[ref] == minimum,
        'repeated_inset_domain_route_length': lengths.get(ref, 0),
        'candidate_is_repeated_inset_indicator_fit_route': ref in subset_lengths,
        'repeated_inset_indicator_route_is_minimum': (ref in subset_lengths
            and subset_lengths[ref] == subset_minimum),
    }), context) for ref in agenda.alternative_refs})
    return append_candidate_measurements(agenda, rows, context)
