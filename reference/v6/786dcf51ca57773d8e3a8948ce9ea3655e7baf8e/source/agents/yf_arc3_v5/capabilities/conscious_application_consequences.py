"""Exact goal-relative measurements; DRM interprets what they mean for the goal."""
from typing import Literal
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from agents.yf_arc3_v5.drm.meaning import DeclaredAlternativeFacts


class OperationalConsciousnessApplicationConsequences(FrozenModel):
    domain_ref: Ref
    goal_ref: Ref
    prediction_digest: Ref | None
    descriptive_by_ref: FrozenMap
    projection: DeclaredAlternativeFacts
    observed_goal_achievement: Literal[False] = False
    preservation_verified: Literal[False] = False
    grants_action: Literal[False] = False


def goal_prediction_contract(prediction):
    """Copy the actual conditional contract, without establishing any premise."""
    return FrozenMap({field: getattr(prediction, field) for field in (
        'domain_ref', 'input_digest', 'observation_ref', 'hypothesis_ref', 'condition_refs', 'falsifier_refs')
    }) if prediction is not None else FrozenMap()


def candidate_goal_consequence_rows(consequences, candidate_refs):
    """Keep every response's measured conditions and DRM meaning for these candidates."""
    rows, covered = {}, set()
    if consequences is not None:
        for ref, measured in sorted(consequences.descriptive_by_ref.items()):
            candidate = measured.get('application_candidate_ref', ref)
            if candidate not in candidate_refs:
                continue
            declared = consequences.projection.alternative_facts.get(ref)
            if declared is None:
                continue
            rows[ref] = FrozenMap({'candidate_ref': candidate, 'measured': measured,
                'declared': declared, 'prediction_digest': consequences.prediction_digest})
            covered.add(candidate)
    return FrozenMap(rows), tuple(ref for ref in candidate_refs if ref not in covered)


def _gaps(subject, target):
    if subject is None or target is None:
        return None
    return (abs(subject[0] + subject[2] - target[0] - target[2]),
        abs(subject[1] + subject[3] - target[1] - target[3]))


def measure_declared_target_binding(context):
    """Compare identities only: an absent declaration never matches every target."""
    explicit = context.get('declared_target_ref')
    proposed = context.get('declared_target_candidates', ())
    candidates_well_formed = isinstance(proposed, (tuple, list)) and all(
        isinstance(ref, str) and bool(ref) for ref in proposed)
    explicit_well_formed = explicit is None or (isinstance(explicit, str) and bool(explicit))
    well_formed = candidates_well_formed and explicit_well_formed
    candidates = tuple(dict.fromkeys(proposed)) if candidates_well_formed else ()
    # An explicit binding retains priority over reserve hypotheses. With no
    # binding, keep the entire candidate domain, including every equality.
    domain = ((explicit,) if explicit is not None else candidates) if well_formed else ()
    target = context.get('fixed_entity_ref')
    return FrozenMap({
        'target_declaration_well_formed': well_formed,
        'target_domain_declared': bool(domain),
        'declared_target_domain': domain,
        'retained_target_candidates': candidates,
        'declared_target_matches': bool(domain) and isinstance(target, str) and target in domain,
        'target_binding_ambiguous': explicit is None and len(candidates) > 1,
        'compared_target_bound': isinstance(target, str) and bool(target),
        'declared_target_ref': explicit,
    })


def measure_application_consequences(domain, prediction):
    context = domain.goal_comparison_context
    legacy = _measure_consequence_rows(domain, prediction, context)
    evidence = context.get('goal_relation_evidence', FrozenMap())
    bindings = evidence.get('bindings', ())
    # A singleton is a measured cardinality, not permission to use that role
    # assignment. DRM below decides whether these separately named facts apply.
    unique = bindings[0] if len(bindings) == 1 else (None, None, None)
    current_context = FrozenMap({**context, 'moving_entity_ref': unique[0],
        'fixed_entity_ref': unique[1], 'alignment_axis': unique[2]})
    current = _measure_consequence_rows(domain, prediction, current_context)
    rows = {}
    for ref, facts in sorted(legacy['descriptive_by_ref'].items()):
        rows[ref] = FrozenMap({**facts,
            **{'current_goal_' + field: value for field, value in sorted(current['descriptive_by_ref'][ref].items())},
            'goal_relation_evidence': evidence,
            'goal_relation_evidence_present': bool(evidence.get('evidence_rows')),
            'current_goal_binding_alternative_count': len(bindings),
            'current_goal_target_singleton': (unique[1],) if unique[1] is not None else (),
            'current_goal_binding_qualified': evidence.get('all_evidence_qualified', False) and len(bindings) == 1})
    return FrozenMap({**legacy, 'descriptive_by_ref': FrozenMap(rows)})


def _measure_consequence_rows(domain, prediction, context):
    target_binding = measure_declared_target_binding(context)
    moving, fixed = context.get('moving_entity_ref'), context.get('fixed_entity_ref')
    current = {ref: rows[0]['bounds'] for ref, rows in sorted(domain.participant_measurements.items())
        if len(rows) == 1 and not rows[0]['possible_predecessor_entity_refs']}
    future = {row.entity_ref: row.predicted_bounds for row in prediction.context_translations} if prediction else {}
    initial_gap, future_gap = _gaps(current.get(moving), current.get(fixed)), _gaps(future.get(moving), future.get(fixed))
    spatial_candidates = {row.candidate_ref for row in prediction.rows} if prediction else set()
    symbolic_rows = {(row.prediction_ref or row.candidate_ref): row for row in prediction.symbolic_state_rows} if prediction else {}
    candidate_refs = tuple(sorted(spatial_candidates | set(symbolic_rows)))
    uncalculated = prediction.uncalculated_candidates if prediction else FrozenMap()
    refs = tuple(sorted((*candidate_refs, *uncalculated))) or (domain.domain_ref,)
    rows = {}
    for ref in refs:
        symbolic_row = symbolic_rows.get(ref)
        symbolic_context = (symbolic_row.state_context if symbolic_row.prediction_ref else prediction.symbolic_state_context
            ) if symbolic_row is not None else FrozenMap()
        state_subject, state_target = symbolic_context.get(moving), symbolic_context.get(fixed)
        calculated = ref in candidate_refs
        predicted = future_gap if ref in spatial_candidates else None
        comparable = initial_gap is not None and predicted is not None
        state_pair = symbolic_row is not None and state_subject is not None and state_target is not None
        observed_states = (state_subject['current_state'], state_target['current_state']) if state_pair else None
        predicted_states = (state_subject['predicted_state'], state_target['predicted_state']) if state_pair else None
        shape_bound = state_pair and all('relative_shape_digest' in state for state in (*observed_states, *predicted_states))
        appearance_bound = shape_bound and all('observed_value' in state for state in (*observed_states, *predicted_states))
        facts = {
            'goal_ref': domain.goal_ref, 'goal_kind': context.get('goal_kind'),
            'mechanism_ref': domain.mechanism_ref,
            'evidence_contract_ref': context.get('evidence_contract_ref'),
            'mechanism_goal_matches': context.get('mechanism_goal_ref') == domain.goal_ref,
            'subject_ref': moving, 'target_ref': fixed,
            'distinct_participants_bound': isinstance(moving, str) and isinstance(fixed, str) and moving != fixed,
            **target_binding,
            'alignment_axis': context.get('alignment_axis'),
            'current_gaps_twice': initial_gap, 'predicted_gaps_twice': predicted,
            'current_and_predicted_pair_bound': comparable,
            'conditional_prediction_present': calculated,
            'symbolic_shape_pair_bound': bool(shape_bound), 'symbolic_appearance_pair_bound': bool(appearance_bound),
            'observed_symbolic_states': observed_states, 'predicted_symbolic_states': predicted_states,
            'shape_equal_current': observed_states[0]['relative_shape_digest'] == observed_states[1]['relative_shape_digest']
                if shape_bound else None,
            'shape_equal_predicted': predicted_states[0]['relative_shape_digest'] == predicted_states[1]['relative_shape_digest']
                if shape_bound else None,
            'appearance_equal_current': all(observed_states[0][key] == observed_states[1][key]
                for key in ('relative_shape_digest', 'observed_value')) if appearance_bound else None,
            'appearance_equal_predicted': all(predicted_states[0][key] == predicted_states[1][key]
                for key in ('relative_shape_digest', 'observed_value')) if appearance_bound else None,
            'uncalculated_refs': uncalculated.get(ref, ()) if prediction else ('consequence.conditional_prediction',),
            'unverified_preservation_refs': tuple(context.get('preserved_dimension_refs') or ()),
            'goal_falsifier_refs': tuple(context.get('goal_falsifier_refs') or ()),
            'collision_and_preservation_verified': False,
            'current_control_and_payload_revalidated': False,
        }
        if symbolic_row is not None and symbolic_row.prediction_ref is not None:
            facts.update({'application_candidate_ref': symbolic_row.candidate_ref,
                'symbolic_response_ref': symbolic_row.prediction_ref,
                'response_observation_refs': symbolic_row.observation_refs,
                'response_context_missing_refs': symbolic_row.state_context_missing_refs})
        for axis, index in (('row', 0), ('column', 1)):
            facts[axis + '_equal_predicted'] = predicted[index] == 0 if predicted is not None else None
            facts[axis + '_gap_smaller'] = predicted[index] < initial_gap[index] if comparable else None
            facts[axis + '_gap_larger'] = predicted[index] > initial_gap[index] if comparable else None
        facts['both_equal_predicted'] = predicted == (0, 0) if predicted is not None else None
        facts['both_gaps_no_larger'] = all(p <= b for b, p in zip(initial_gap, predicted)) if comparable else None
        facts['at_least_one_gap_smaller'] = any(p < b for b, p in zip(initial_gap, predicted)) if comparable else None
        rows[ref] = FrozenMap(facts)
    return FrozenMap({'domain_ref': domain.domain_ref, 'goal_ref': domain.goal_ref,
        'prediction_digest': stable_digest(prediction) if prediction else None,
        'alternative_refs': refs, 'descriptive_by_ref': FrozenMap(rows)})
