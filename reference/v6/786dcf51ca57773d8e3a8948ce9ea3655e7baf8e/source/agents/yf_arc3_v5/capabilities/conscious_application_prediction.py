"""Exact translation measurement and conditional simulation; DRM owns the hypothesis."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from agents.yf_arc3_v5.logos.operational_prediction import (
    OperationalConsciousnessApplicationPrediction, OperationalConsciousnessTranslationRow,
    OperationalConsciousnessContextTranslation,
)


def _unique_pose(values, ref):
    rows = values.get(ref, ())
    if len(rows) != 1 or rows[0]['possible_predecessor_entity_refs']:
        return None
    return rows[0]


def _measure_translation(transition, current_values, ref):
    before = _unique_pose(transition['before'], ref)
    after = _unique_pose(transition['after'], ref)
    current = _unique_pose(current_values, ref)
    if before is None or after is None or current is None:
        return None, 'translation.unique_observed_identity_and_pose:' + ref
    b, a, c = before['bounds'], after['bounds'], current['bounds']
    dr, dc = a[0] - b[0], a[1] - b[1]
    if (not all(before[key] == after[key] == current[key]
            for key in ('relative_shape_digest', 'pixel_area', 'observed_value'))
            or tuple(a) != (b[0] + dr, b[1] + dc, b[2] + dr, b[3] + dc)
            or (c[2] - c[0], c[3] - c[1]) != (b[2] - b[0], b[3] - b[1])):
        return None, 'translation.unchanged_shape_extent_and_value:' + ref
    return FrozenMap({'entity_ref': ref, 'current_bounds': tuple(c), 'observed_delta': (dr, dc)}), None


def application_observation_binding(domain, observed_context=None):
    context = (domain.observed_return_context if observed_context is None else observed_context) or FrozenMap()
    transition = context.get('participant_transition')
    common_missing = []
    if transition is None:
        common_missing.append('application.witnessed_participant_transition')
    if context.get('producer_source_current') is not True:
        common_missing.append('application.current_observation_source')
    if context.get('physical_packet_dimensions_consistent') is not True:
        common_missing.append('application.compatible_frame_dimensions')
    if transition is not None and (domain.request is None
            or domain.request.operator_ref != transition['action_ref']
            or transition['control_signature'] is None
            or transition['control_signature']['addressed_control_ref'] not in domain.addressed_control_refs):
        common_missing.append('application.same_declared_operator_and_control')
    return transition, common_missing


def measure_conditional_translation(domain, enumeration):
    """Preserve each unmatched candidate; never choose among identity or pose variants."""
    transition, common_missing = application_observation_binding(domain)
    measured, uncalculated = [], {}
    context_rows, context_missing = {}, {}
    if not common_missing:
        for ref in sorted(domain.participant_measurements):
            row, missing = _measure_translation(transition, domain.participant_measurements, ref)
            if row is not None:
                context_rows[ref] = row
            else:
                context_missing[ref] = missing
    candidates = enumeration.rows if enumeration is not None and enumeration.complete else ()
    for candidate in candidates:
        missing = list(common_missing)
        historical = tuple(ref for ref, participants in sorted(transition['historical_bindings'].items())
            if tuple(participants) == candidate.participant_refs) if transition is not None else ()
        if not historical:
            missing.append('translation.exact_historical_participant_binding')
        bounds, deltas = [], []
        if not missing:
            for ref in candidate.participant_refs:
                row = context_rows.get(ref)
                if row is None:
                    missing.append(context_missing.get(ref, 'translation.unique_observed_identity_and_pose:' + ref))
                else:
                    bounds.append(row['current_bounds'])
                    deltas.append(row['observed_delta'])
        if not missing and not any(dr or dc for dr, dc in deltas):
            missing.append('translation.nonzero_observed_displacement')
        if missing:
            uncalculated[candidate.candidate_ref] = tuple(sorted(set(missing)))
        else:
            measured.append(FrozenMap({'candidate_ref': candidate.candidate_ref,
                'historical_candidate_refs': historical, 'participant_refs': candidate.participant_refs,
                'current_bounds': tuple(bounds), 'observed_deltas': tuple(deltas)}))
    return FrozenMap({'domain_ref': domain.domain_ref,
        'input_digest': stable_digest((domain, enumeration)),
        'observation_ref': transition['observation_ref'] if transition is not None else None,
        'historical_action_ref': transition['action_ref'] if transition is not None else None,
        'historical_action_data': transition['action_data'] if transition is not None else None,
        'historical_control_signature': transition['control_signature'] if transition is not None else None,
        'rows': tuple(measured), 'uncalculated_candidates': FrozenMap(uncalculated),
        'context_rows': tuple(row for _, row in sorted(context_rows.items())),
        'context_translation_missing_refs': FrozenMap(context_missing),
        'common_missing_refs': tuple(common_missing), 'translation_computable_count': len(measured)})


def calculate_conditional_translation(measured, declaration):
    """Translate current bounds only, under the Source-selected DRM hypothesis."""
    rows = tuple(OperationalConsciousnessTranslationRow(**row,
        predicted_bounds=tuple((b[0] + d[0], b[1] + d[1], b[2] + d[0], b[3] + d[1])
            for b, d in zip(row['current_bounds'], row['observed_deltas']))) for row in measured['rows'])
    context_rows = tuple(OperationalConsciousnessContextTranslation(**row,
        predicted_bounds=(row['current_bounds'][0] + row['observed_delta'][0],
            row['current_bounds'][1] + row['observed_delta'][1],
            row['current_bounds'][2] + row['observed_delta'][0],
            row['current_bounds'][3] + row['observed_delta'][1])) for row in measured['context_rows'])
    return OperationalConsciousnessApplicationPrediction(
        domain_ref=measured['domain_ref'], input_digest=measured['input_digest'],
        observation_ref=measured['observation_ref'], historical_action_ref=measured['historical_action_ref'],
        historical_action_data=measured['historical_action_data'],
        historical_control_signature=measured['historical_control_signature'],
        hypothesis_ref=declaration['hypothesis_ref'], condition_refs=declaration['condition_refs'],
        falsifier_refs=declaration['falsifier_refs'], rows=rows,
        uncalculated_candidates=measured['uncalculated_candidates'], context_translations=context_rows,
        context_translation_missing_refs=measured['context_translation_missing_refs'])
