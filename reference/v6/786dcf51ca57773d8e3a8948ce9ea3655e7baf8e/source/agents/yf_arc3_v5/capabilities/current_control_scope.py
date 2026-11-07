"""Measure identities and current geometry; DRM assigns binding semantics."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def annotate_current_control_scope(value, agenda):
    rows = value.canonical_provisional_control_term_facts
    boxes = value.canonical_provisional_control_geometry_bboxes
    frame_ref = value.current_observation_frame_ref
    receivers = tuple(sorted({ref for row in rows
        for ref in (row.get('current_member_entity_refs') or
                    ((row['entity_ref'],) if row.get('entity_ref') else ())) }))
    supports = tuple(sorted({ref for row in rows for ref in row.get('control_support_claim_refs', ())}))
    term_bindings = tuple({binding['term_ref']: binding for row in rows
        for binding in row.get('control_support_term_bindings', ())}.values())
    provenance = tuple({record['record_ref']: record for row in rows
        for record in row.get('control_support_provenance_records', ())}.values())
    unresolved = tuple(sorted({ref for row in rows for ref in row.get('control_support_unresolved_refs', ())}))
    stale_terms = tuple(sorted({ref for row in rows for ref in row.get('control_support_stale_term_refs', ())}))
    partition_current = bool(rows) and all(
        row.get('control_support_partition_frame_ref') == frame_ref for row in rows)
    models = tuple(sorted({str(row.get('association_ref') or row.get('term_ref') or '') for row in rows}))
    measured = FrozenMap({
        'discrete_control_receiver_refs': receivers,
        'discrete_control_receiver_count': len(receivers),
        'discrete_control_support_claim_refs': supports,
        'discrete_control_support_count': len(supports),
        'discrete_control_support_term_bindings': term_bindings,
        'discrete_control_support_provenance_records': provenance,
        'discrete_control_support_unresolved_refs': unresolved,
        'discrete_control_support_stale_term_refs': stale_terms,
        'discrete_control_support_partition_current': partition_current,
        'discrete_control_support_partition_frame_ref': frame_ref if partition_current else None,
        'discrete_control_current_bbox_count': len(boxes),
        'discrete_control_frame_ref': frame_ref,
        'discrete_control_frame_present': bool(frame_ref),
        'discrete_control_mode_token': stable_digest((models, receivers)),
    })
    facts, deltas = {}, {}
    candidates = {c.candidate_ref: c for c in agenda.candidates}
    for ref in sorted(agenda.alternative_refs):
        candidate = candidates[ref]
        binding = FrozenMap.overlay({
            'discrete_control_action_ref': candidate.action_ref,
            'discrete_control_action_data': candidate.action_data,
            'discrete_control_binding_token': stable_digest((frame_ref,
                candidate.action_ref, candidate.action_data, receivers, supports, models)),
        }, measured)
        facts[ref] = FrozenMap.overlay(binding, agenda.alternative_facts[ref])
        if ref in agenda.descriptive_delta_facts:
            deltas[ref] = FrozenMap.overlay(binding, agenda.descriptive_delta_facts[ref])
    return agenda.model_copy(update={'alternative_facts': FrozenMap(facts),
        'descriptive_delta_facts': FrozenMap(deltas)})
