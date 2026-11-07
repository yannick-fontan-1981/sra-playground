"""Finite observed state edges, without inventing inverse edges or hidden clocks."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, immutable_json_data
from agents.yf_arc3_v5.logos.operational_prediction import (
    OperationalConsciousnessApplicationPrediction, OperationalConsciousnessSymbolicStateRow,
)
from .conscious_application_prediction import application_observation_binding, _unique_pose
from agents.yf_arc3_v5.logos.operations import ControlEvidenceSignature


def measure_symbolic_transition(domain, enumeration):
    # Historical envelopes retain their original calculation, without being
    # relabelled as an exhaustive multi-edge memory.
    if domain.maximum_symbolic_prediction_variants is None:
        return _measure_single_transition(domain, enumeration)
    latest, common_missing = application_observation_binding(domain)
    history = (domain.observed_return_context or FrozenMap()).get('symbolic_transition_history')
    incomplete = history is None or history.get('complete') is not True
    if incomplete:
        common_missing.append('symbolic.complete_scoped_transition_history')
        common_missing.extend(history.get('missing_refs', ()) if history else ())
    candidates = enumeration.rows if enumeration is not None and enumeration.complete else ()
    variants, reasons, interval_missing, changed_refs = {}, {}, {}, set()
    for interval in history['intervals'] if not common_missing else ():
        transition, missing = application_observation_binding(domain, interval)
        control_matches = (transition is not None and latest is not None
            and transition['control_signature'] is not None and latest['control_signature'] is not None
            and ControlEvidenceSignature.model_validate(transition['control_signature']).response_recall_key()
                == ControlEvidenceSignature.model_validate(latest['control_signature']).response_recall_key())
        if transition is not None and latest is not None and (not control_matches
                or any(transition[key] != latest[key] for key in ('action_ref', 'action_data'))):
            missing.append('symbolic.same_observed_action_payload_and_control')
        if missing:
            interval_missing[interval['goal_review_ref']] = tuple(sorted(set(missing)))
            continue
        measured = _measure_single_transition(domain, enumeration, interval, retain_unchanged=True)
        interval_missing[interval['goal_review_ref']] = FrozenMap({
            'common_missing_refs': measured['common_missing_refs'],
            'context_missing_refs': measured['context_missing_refs'],
            'uncalculated_candidates': measured['uncalculated_candidates']})
        if measured['observed_changed_state_count']:
            changed_refs.add(interval['goal_review_ref'])
        for ref, values in sorted(measured['uncalculated_candidates'].items()):
            reasons.setdefault(ref, set()).update(values)
        for row in measured['rows']:
            context = measured['symbolic_state_context']
            context_missing = measured['context_missing_refs']
            variant_ref = 'symbolic_response.' + stable_digest((row['candidate_ref'], row['participant_refs'],
                row['current_states'], row['predicted_states'], context, context_missing))
            previous = variants.get(variant_ref)
            witnesses = {transition['observation_ref'], *(previous.observation_refs if previous else ())}
            bindings = {*row['historical_candidate_refs'], *(previous.historical_candidate_refs if previous else ())}
            variants[variant_ref] = OperationalConsciousnessSymbolicStateRow(
                candidate_ref=row['candidate_ref'], prediction_ref=variant_ref,
                historical_candidate_refs=tuple(sorted(bindings)), observation_refs=tuple(sorted(witnesses)),
                participant_refs=row['participant_refs'], current_states=row['current_states'],
                predicted_states=row['predicted_states'], state_context=context,
                state_context_missing_refs=context_missing)
    exceeds = len(variants) > domain.maximum_symbolic_prediction_variants
    rows = tuple(row for _, row in sorted(variants.items())) if not exceeds else ()
    counts = {}
    for _, row in sorted(variants.items()):
        counts[row.candidate_ref] = counts.get(row.candidate_ref, 0) + 1
    represented = {row.candidate_ref for row in rows}
    uncalculated = {}
    for candidate in candidates:
        if candidate.candidate_ref not in represented:
            missing = {*common_missing, *reasons.get(candidate.candidate_ref, ())}
            if exceeds:
                missing.add('symbolic.prediction_variants_exceed_declared_bound')
            if not missing:
                missing.add('symbolic.observed_response_for_current_precondition_and_control')
            uncalculated[candidate.candidate_ref] = tuple(sorted(missing))
    return FrozenMap({'domain_ref': domain.domain_ref, 'input_digest': stable_digest((domain, enumeration)),
        'observation_ref': latest['observation_ref'] if latest else None,
        'historical_action_ref': latest['action_ref'] if latest else None,
        'historical_action_data': latest['action_data'] if latest else None,
        'historical_control_signature': latest['control_signature'] if latest else None,
        'rows': tuple(immutable_json_data(row) for row in rows), 'symbolic_state_context': FrozenMap(),
        'uncalculated_candidates': FrozenMap(uncalculated), 'context_missing_refs': FrozenMap(interval_missing),
        'common_missing_refs': tuple(common_missing), 'observed_changed_state_count': len(changed_refs),
        'symbolic_transition_computable_count': len(rows), 'history_incomplete': incomplete,
        'variants_exceed_bound': exceeds, 'response_variant_count': len(variants),
        'competing_response_count': sum(count > 1 for _, count in sorted(counts.items()))})


def _measure_single_transition(domain, enumeration, observed_context=None, *, retain_unchanged=False):
    transition, common_missing = application_observation_binding(domain, observed_context)
    fields = domain.symbolic_observation_fields
    if not fields:
        common_missing.append('symbolic.declared_observation_fields')
    context, context_missing, changed = {}, {}, []
    if not common_missing:
        for ref in sorted(domain.participant_measurements):
            poses = (_unique_pose(transition['before'], ref), _unique_pose(transition['after'], ref),
                _unique_pose(domain.participant_measurements, ref))
            if any(pose is None or any(field not in pose for field in fields) for pose in poses):
                context_missing[ref] = ('symbolic.exact_observed_identity_and_state:' + ref,)
                continue
            before, after, current = tuple(FrozenMap({field: pose[field] for field in fields}) for pose in poses)
            if before != after:
                changed.append(ref)
            if current != before:
                context_missing[ref] = ('symbolic.current_state_differs_from_observed_precondition:' + ref,)
                continue
            context[ref] = FrozenMap({'current_state': current, 'predicted_state': after})
    rows, uncalculated = [], {}
    candidates = enumeration.rows if enumeration is not None and enumeration.complete else ()
    for candidate in candidates:
        missing = list(common_missing)
        historical = tuple(ref for ref, participants in sorted(transition['historical_bindings'].items())
            if tuple(participants) == candidate.participant_refs) if transition is not None else ()
        if not historical:
            missing.append('symbolic.exact_historical_participant_binding')
        for ref in candidate.participant_refs:
            if ref not in context:
                missing.extend(context_missing.get(ref, ('symbolic.observed_state:' + ref,)))
        if not retain_unchanged and not any(ref in changed for ref in candidate.participant_refs):
            missing.append('symbolic.observed_state_change')
        if missing:
            uncalculated[candidate.candidate_ref] = tuple(sorted(set(missing)))
        else:
            rows.append(OperationalConsciousnessSymbolicStateRow(candidate_ref=candidate.candidate_ref,
                historical_candidate_refs=historical, participant_refs=candidate.participant_refs,
                current_states=tuple(context[ref]['current_state'] for ref in candidate.participant_refs),
                predicted_states=tuple(context[ref]['predicted_state'] for ref in candidate.participant_refs)))
    return FrozenMap({'domain_ref': domain.domain_ref, 'input_digest': stable_digest((domain, enumeration)),
        'observation_ref': transition['observation_ref'] if transition else None,
        'historical_action_ref': transition['action_ref'] if transition else None,
        'historical_action_data': transition['action_data'] if transition else None,
        'historical_control_signature': transition['control_signature'] if transition else None,
        'rows': tuple(immutable_json_data(row) for row in rows), 'symbolic_state_context': FrozenMap(context),
        'uncalculated_candidates': FrozenMap(uncalculated), 'context_missing_refs': FrozenMap(context_missing),
        'common_missing_refs': tuple(common_missing), 'observed_changed_state_count': len(changed),
        'symbolic_transition_computable_count': len(rows)})


def calculate_symbolic_transition(measured, declaration):
    return OperationalConsciousnessApplicationPrediction(
        **{key: measured[key] for key in ('domain_ref', 'input_digest', 'observation_ref',
            'historical_action_ref', 'historical_action_data', 'historical_control_signature')},
        hypothesis_ref=declaration['hypothesis_ref'], condition_refs=declaration['condition_refs'],
        falsifier_refs=declaration['falsifier_refs'],
        symbolic_state_rows=tuple(OperationalConsciousnessSymbolicStateRow.model_validate(row) for row in measured['rows']),
        symbolic_state_context=measured['symbolic_state_context'],
        uncalculated_candidates=measured['uncalculated_candidates'])


def combine_application_predictions(measured, translation, symbolic):
    """Merge Source-calculated fragments with identical evidence, never select a model."""
    parts = tuple(part for part in (translation, symbolic) if part is not None)
    if not parts:
        return None
    common_fields = ('domain_ref', 'input_digest', 'observation_ref', 'historical_action_ref',
        'historical_action_data', 'historical_control_signature', 'hypothesis_ref', 'condition_refs', 'falsifier_refs')
    first = parts[0]
    if any(any(getattr(part, field) != getattr(first, field) for field in common_fields) for part in parts):
        raise ValueError('application prediction fragments belong to different evidence or hypotheses')
    represented = {row.candidate_ref for part in parts for row in (*part.rows, *part.symbolic_state_rows)}
    missing = {}
    family_missing = FrozenMap({
        'translation': measured['conditional_translation_measurement']['uncalculated_candidates'],
        'symbolic_state': measured['symbolic_transition_measurement']['uncalculated_candidates']})
    for _, reasons in sorted(family_missing.items()):
        for ref, values in sorted(reasons.items()):
            if ref not in represented:
                missing[ref] = tuple(sorted(set((*missing.get(ref, ()), *values))))
    return OperationalConsciousnessApplicationPrediction(
        **{key: getattr(first, key) for key in common_fields},
        rows=translation.rows if translation else (),
        context_translations=translation.context_translations if translation else (),
        context_translation_missing_refs=translation.context_translation_missing_refs if translation else FrozenMap(),
        symbolic_state_rows=symbolic.symbolic_state_rows if symbolic else (),
        symbolic_state_context=symbolic.symbolic_state_context if symbolic else FrozenMap(),
        uncalculated_candidates=FrozenMap(missing), prediction_family_missing_refs=family_missing)
