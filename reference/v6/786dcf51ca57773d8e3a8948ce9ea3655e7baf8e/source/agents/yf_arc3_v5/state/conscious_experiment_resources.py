"""Read current Source-produced gauge intervals without inventing an action budget."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _nonnegative_integer(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def measure_experiment_resources(store, intent, configuration, recovery_lengths=None):
    return measure_experiment_resource_scope(store, intent_ref=intent.id,
        timeline_ref=intent.timeline_id, frame_ref=intent.frame_id,
        solver_action_bound=intent.remaining_action_bound, configuration=configuration,
        recovery_lengths=recovery_lengths)


def measure_experiment_resource_scope(store, *, intent_ref, timeline_ref, frame_ref,
        solver_action_bound, configuration, recovery_lengths=None):
    snapshot = store.snapshot
    terms = snapshot.terms_for_literal_attribute('measurement_kind', configuration['measurement_kind'])
    proofs = snapshot.claims_for_predicate(configuration['quantity_predicate'])
    rows = {}
    complete = len(terms) <= configuration['maximum_resource_measurements']
    for term in terms if complete else ():
        data = term.attributes
        matching = tuple(claim for claim in proofs if data.get('indicator_entity_ref') in claim.arguments
            and all(claim.attributes.get(key) == data.get(key) for key in (
                'evidence_scope_ref', 'transition_ref', 'primitive_count_after', 'render_fit_intervals',
                'observation_frame_ref', 'observation_timeline_ref')))
        intervals = data.get('render_fit_intervals', ())
        ordinal = data.get('primitive_count_after')
        numeric = isinstance(intervals, tuple) and bool(intervals) and _nonnegative_integer(ordinal) and all(
            isinstance(row, FrozenMap) and _nonnegative_integer(row.get('minimum_total_budget'))
            and (row.get('maximum_total_budget') is None or (
                _nonnegative_integer(row['maximum_total_budget'])
                and row['maximum_total_budget'] >= row['minimum_total_budget'])) for row in intervals)
        primitive_basis = bool(numeric) and all(row.get('consumption_basis') == 'primitive_count' for row in intervals)
        action_units = primitive_basis and data.get('unit_debit_per_primitive') == 1
        lower = min(max(0, row['minimum_total_budget'] - ordinal) for row in intervals) if action_units else None
        upper = max(max(0, row['maximum_total_budget'] - ordinal) for row in intervals) \
            if action_units and all(row.get('maximum_total_budget') is not None for row in intervals) else None
        comparisons = FrozenMap({ref: FrozenMap.overlay({
            'fits_conditional_lower': lower is not None and length['minimum_forward_and_return_primitive_count'] <= lower,
            'exceeds_conditional_upper': upper is not None and length['minimum_forward_and_return_primitive_count'] > upper,
            'fits_solver_bound': solver_action_bound is not None
                and length['minimum_forward_and_return_primitive_count'] <= solver_action_bound}, length)
            for ref, length in sorted((recovery_lengths or {}).items())})
        rows[term.id] = FrozenMap({
            'measurement_ref': term.id, 'measurement_digest': stable_digest(term),
            'indicator_ref': data.get('indicator_entity_ref'), 'evidence_scope_ref': data.get('evidence_scope_ref'),
            'transition_ref': data.get('transition_ref'), 'primitive_count_after': ordinal,
            'render_models': intervals, 'model_status': data.get('model_status'),
            'observation_frame_matches': data.get('observation_frame_ref') == frame_ref,
            'observation_timeline_matches': data.get('observation_timeline_ref') == timeline_ref,
            'proof_refs': tuple(claim.id for claim in matching),
            'proof_digests': FrozenMap({claim.id: stable_digest(claim) for claim in matching}),
            'proof_count': len(matching),
            'all_proofs_active_positive_supported': bool(matching) and all(
                claim.disposition.value == 'active' and claim.polarity.value == 'positive'
                and claim.epistemic_status.value in configuration['admitted_quantity_statuses'] for claim in matching),
            'proof_contest_count': sum(len(claim.active_contradictions) + len(claim.defeated_by) for claim in matching),
            'proof_expired_count': sum(claim.valid_through_state_revision is not None
                and claim.valid_through_state_revision < snapshot.revision for claim in matching),
            'primitive_consumption_basis': primitive_basis,
            'unit_debit_per_primitive': data.get('unit_debit_per_primitive'),
            'intervals_numeric': bool(numeric),
            'stored_bounds_match_models': action_units and lower == data.get('minimum_remaining_action_units')
                and upper == data.get('maximum_remaining_action_units'),
            'conditional_remaining_lower': lower, 'conditional_remaining_upper': upper,
            'prepared_primitive_count': 1,
            'prepared_primitive_fits_lower': lower is not None and lower >= 1,
            'prepared_primitive_exceeds_upper': upper is not None and upper < 1,
            'observed_return_length_comparisons': comparisons,
            'observed_return_comparison_count': len(comparisons),
        })
    if not rows:
        rows['experiment.resource_budget_unbound'] = FrozenMap({'resource_observation_present': False})
    return FrozenMap({'intent_ref': intent_ref, 'timeline_ref': timeline_ref, 'frame_ref': frame_ref,
        'solver_remaining_action_bound': solver_action_bound,
        'measurement_domain_complete': complete, 'measurement_count': len(terms),
        'alternative_refs': tuple(sorted(rows)), 'descriptive_by_ref': FrozenMap(rows),
        'missing_refs': (() if complete and terms else ('experiment.current_observed_resource_budget',))
            + (() if complete else ('experiment.resource_measurement_domain_exceeds_bound',)),
        'experiment_execution_cost_known': False, 'recovery_cost_known': False,
        'preservation_proven': False})
