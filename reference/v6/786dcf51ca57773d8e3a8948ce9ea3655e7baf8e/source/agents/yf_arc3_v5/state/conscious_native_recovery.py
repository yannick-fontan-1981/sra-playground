"""Carry the exact observed recovery alternatives into native admission and its return.

The reviewed graph describes observations. Rechecking its provenance and current
departure does not make its edges executable or establish future preservation.
"""
from pydantic import ValidationError
from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives
from agents.yf_arc3_v5.logos.operational_experiment_admission import OperationalConsciousnessRecoveryEvidence
from agents.yf_arc3_v5.logos.operations import OperationalConsciousnessReevaluationRecord, ControlEvidenceSignature
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .conscious_native_question import identity
from .conscious_prepared_experiment import matching_recovery_queries
from agents.yf_arc3_v5.capabilities.conscious_recovery_cost import measure_recovery_cost_envelope, measure_scoped_restoration_cost

POLICY = 'policy.conscious_native_recovery_evidence'
ALTERNATIVE = 'native_recovery.observed_return_domain'


def project(owner, measured):
    return project_declared_alternatives(drm=owner._drm, selection_policy_ref=POLICY,
        alternative_refs=(ALTERNATIVE,), descriptive_facts=FrozenMap({ALTERNATIVE: measured}))


def facts(evidence):
    return evidence.projection_facts['alternative_facts'][ALTERNATIVE]


def bind_current_native_application(owner, evidence):
    """Shared canonical binding for native evidence variants; no utility inference."""
    from agents.yf_arc3_v5.scheduler.conscious_applications import verify_native_review
    from agents.yf_arc3_v5.scheduler.registry import PureCallBlocked
    record = owner._store.artifact(evidence.native_review_ref)
    entry = owner._entries.get(evidence.source_workflow_ref)
    native_entry = owner._entries.get(record.demand.origin_context.source_workflow_ref) \
        if isinstance(record, OperationalConsciousnessReevaluationRecord) else None
    current = (entry is not None and entry.transitive_source_hash == evidence.source_hash
        and native_entry is not None and native_entry.transitive_source_hash == record.demand.origin_context.source_hash
        and stable_digest(record) == evidence.native_review_digest
        and record.status == 'consumed' and record.consumption_ref == record.id
        and record.demand.kind == 'native_means_review'
        and record.demand.problem_ref == evidence.owner_goal_ref
        and record.timeline_id == evidence.identity['timeline_ref']
        and record.projection_facts is not None and stable_digest(record.projection_facts) == record.projection_digest)
    applications = ()
    if current:
        try:
            reviewed = verify_native_review(owner, record.demand.semantic_inputs, record.projection_facts)
            applications = tuple(row for row in reviewed.application_reviews
                if row.domain.domain_ref == evidence.domain_ref and row.experiment_nomination is not None
                and row.experiment_nomination.nomination_ref == evidence.nomination_ref)
        except (ValidationError, PureCallBlocked, KeyError):
            current = False
    application = applications[0] if len(applications) == 1 else None
    signature = ControlEvidenceSignature.model_validate(evidence.control_signature)
    candidates = tuple(row.candidate_ref for row in application.enumeration.rows
        if set(row.participant_refs) == set(signature.receiver_refs)) if (
            application is not None and application.enumeration is not None) else ()
    bound = bool(current and application is not None and candidates == evidence.candidate_refs
        and application.domain.request is not None
        and application.domain.request.operator_ref == evidence.identity['operation_ref']
        and signature.addressed_control_ref in application.domain.addressed_control_refs)
    return current, bound, application, signature, candidates


def measure(owner, evidence):
    current, bound, application, signature, candidates = bind_current_native_application(owner, evidence)
    nomination = application.experiment_nomination if bound else None
    graph = nomination.measured.get('observed_recovery_composition', FrozenMap()) if nomination else FrozenMap()
    preservation = nomination.measured.get('observed_recovery_preservation', FrozenMap()) if nomination else FrozenMap()
    conditional = nomination.measured.get('conditional_recovery_policy', FrozenMap()) if nomination else FrozenMap()
    rows = {}
    for ref, query, edge in matching_recovery_queries(nomination, candidates,
            action_ref=evidence.identity['operation_ref'], action_data=evidence.identity['action_data'],
            control_signature=signature):
        preserved = preservation.get('queries', {}).get(ref, FrozenMap())
        conditional_models = FrozenMap({mode: FrozenMap.overlay({
                'policy_digest': stable_digest(conditional['policies'][result['policy_ref']]),
                'conditional_on_refs': conditional['policies'][result['policy_ref']]['conditional_on_refs'],
            }, result) for mode, result in sorted(conditional.get('queries', {}).get(ref, {}).items())})
        rows[ref] = FrozenMap({
            'candidate_ref': query['candidate_ref'], 'forward_observation_ref': edge['observation_ref'],
            'query_digest': stable_digest(query),
            'departure_state_ref': query['departure_state_ref'], 'displaced_state_ref': query['displaced_state_ref'],
            'shortest_return_edge_refs': query['shortest_return_edge_refs'],
            'conflicting_observation_refs': query['conflicting_observation_refs'],
            'minimum_return_primitive_count': query['minimum_return_primitive_count'],
            'observed_projection_unchanged': query['observed_projection_unchanged'],
            'minimum_forward_and_return_primitive_count': query['minimum_forward_and_return_primitive_count'],
            'search_complete': query['observed_graph_search_complete'] and query['shortest_relation_complete'],
            'unbound_requirement_refs': preserved.get('unbound_requirement_refs', ()),
            'preservation_measurement_digest': stable_digest(preserved),
            'conditional_return_models': conditional_models,
            'future_recovery_established': False})
    envelope = measure_recovery_cost_envelope(rows, evidence.identity,
        owner._drm.resolve(POLICY)[0].configuration['recovery_budget_endpoint_mode'],
        bound and graph.get('search_complete') is True)
    cost_identity = FrozenMap.overlay({'owner_goal_ref': evidence.owner_goal_ref,
        'domain_ref': evidence.domain_ref}, evidence.identity)
    scoped = measure_scoped_restoration_cost(application.domain if bound else None, envelope,
        cost_identity, current=bound)
    scoped_upper = scoped.maximum_primitive_count
    budget, solver = evidence.identity['command_budget_lower'], evidence.identity.get('solver_action_bound')
    measured = FrozenMap({
        'native_review_current': bool(current), 'nomination_bound': bound,
        'graph_digest': stable_digest(graph), 'preservation_digest': stable_digest(preservation),
        'conditional_recovery_digest': stable_digest(conditional),
        'conditional_cost_envelope': immutable_json_data(envelope),
        'conditional_cost_envelope_digest': stable_digest(envelope),
        'conditional_global_upper_bound': envelope.maximum_recovery_inclusive_bound,
        'scoped_restoration_cost': immutable_json_data(scoped),
        'scoped_restoration_cost_digest': stable_digest(scoped),
        'scoped_restoration_complete': scoped.scope_complete,
        'scoped_restoration_upper_bound': scoped_upper,
        'scoped_restoration_unknown_outside_cost_refs': scoped.unknown_outside_cost_refs,
        'scoped_restoration_known_outside_cost_positive': scoped.known_outside_cost_positive,
        'scoped_restoration_fits_budgets': scoped_upper is not None and budget is not None and solver is not None
            and scoped_upper <= budget and scoped_upper <= solver,
        'retained_recovery_models_complete': envelope.retained_model_domain_complete,
        'conditional_recovery_costs_include_progress': envelope.maximum_recovery_inclusive_bound is not None,
        'conditional_recovery_losses_known': envelope.irreversible_losses_known,
        'conditional_recovery_losses_zero': envelope.irreversible_losses_known
            and envelope.irreversible_population_loss == 0 and envelope.irreversible_material_loss == 0,
        'conditional_recovery_models_fit_solver_bound': envelope.maximum_recovery_inclusive_bound is not None
            and evidence.identity.get('solver_action_bound') is not None
            and envelope.maximum_recovery_inclusive_bound <= evidence.identity['solver_action_bound'],
        'conditional_recovery_models_all_funded': envelope.all_retained_models_fit_lower_budget,
        'conditional_recovery_model_bounds_all_exceed_budget': envelope.all_retained_model_bounds_exceed_upper_budget,
        'known_trial_component_cost_exceeds_budget': envelope.known_component_cost_exceeds_upper_budget,
        'conditional_recovery_models_disagree_on_budget': envelope.retained_models_disagree_at_upper_budget,
        'conditional_recovery_resource_models_ambiguous': envelope.funding_depends_on_resource_model,
        'conditional_recovery_missing_refs': conditional.get('missing_refs', ('recovery.conditional_model_not_requested',)),
        'conditional_return_model_count': sum(model['conditional_policy_covers_all_recorded_outcomes']
            for _, row in sorted(rows.items()) for _, model in sorted(row['conditional_return_models'].items())),
        'conditional_no_policy_count': sum(model['conditional_no_strong_policy']
            for _, row in sorted(rows.items()) for _, model in sorted(row['conditional_return_models'].items())),
        'observation_domain_complete': bound and graph.get('search_complete') is True,
        'missing_refs': graph.get('missing_refs', ('recovery.observed_graph',)),
        'matching_query_count': len(rows),
        'observed_return_count': sum(row['minimum_return_primitive_count'] is not None
            and row['minimum_return_primitive_count'] > 0 and row['search_complete'] for _, row in sorted(rows.items())),
        'observed_unchanged_projection_count': sum(row['observed_projection_unchanged']
            and row['search_complete'] for _, row in sorted(rows.items())),
        'conflicting_query_count': sum(bool(row['conflicting_observation_refs']) for _, row in sorted(rows.items())),
        'incomplete_query_count': sum(not row['search_complete'] for _, row in sorted(rows.items())),
        'required_constraint_refs': evidence.identity['required_constraint_refs'],
        'prepared_primitive_count': evidence.identity['prepared_primitive_count'],
        'future_recovery_established': False})
    return FrozenMap(rows), measured


def request_identity(request, timeline_ref, frame_ref):
    budget = request.command_budget_interval
    return FrozenMap.overlay({
        'action_data': request.execution_contract.actions[0].action_data,
        'prepared_primitive_count': len(request.execution_contract.actions),
        'required_constraint_refs': request.understanding_goal.preserve_constraint_refs,
        'command_budget_digest': stable_digest(budget),
        'command_budget_lower': budget.lower if budget is not None else request.remaining_command_budget,
        'command_budget_upper': budget.upper if budget is not None else request.remaining_command_budget,
        'solver_action_bound': budget.solver_action_bound if budget is not None else None,
        'lost_progress_cost': request.lost_progress_cost,
        'irreversible_population_loss': request.irreversible_population_loss,
        'irreversible_material_loss': request.irreversible_material_loss,
    }, identity(request, timeline_ref, frame_ref))


def capture(owner, context, request, receipt, native, signature):
    evidence = OperationalConsciousnessRecoveryEvidence(
        source_workflow_ref=context.workflow_definition_id,
        source_hash=context.operational_consciousness.context.source_hash,
        identity=request_identity(request, context.timeline_id, context.frame_id),
        native_review_ref=native.id, native_review_digest=stable_digest(native), owner_goal_ref=receipt.goal_ref,
        nomination_ref=receipt.nomination_ref, domain_ref=receipt.domain_ref,
        candidate_refs=receipt.candidate_refs, control_signature=immutable_json_data(signature),
        observed_returns=FrozenMap(), measured_facts=FrozenMap(), projection_facts=FrozenMap(),
        policy_hash=owner._drm.resolve(POLICY)[1].source_hash)
    rows, measured = measure(owner, evidence)
    evidence = evidence.model_copy(update={'observed_returns': rows, 'measured_facts': measured,
        'projection_facts': immutable_json_data(project(owner, measured))})
    return request.model_copy(update={'native_recovery_evidence': evidence})


def read_current(owner, request, *, timeline_ref, frame_ref):
    evidence = request.native_recovery_evidence
    if owner is None or evidence is None or request.execution_contract is None or request.understanding_goal is None:
        return None
    from .conscious_continuation_review import read_continuation_review
    review = read_continuation_review(owner, request, current=True, timeline_ref=timeline_ref, frame_ref=frame_ref)
    if (review is None or evidence.identity != request_identity(request, timeline_ref, frame_ref)
            or evidence.policy_hash != owner._drm.resolve(POLICY)[1].source_hash):
        return None
    try:
        rows, measured = measure(owner, evidence)
    except (ValidationError, KeyError, TypeError):
        return None
    if (not measured['nomination_bound'] or rows != evidence.observed_returns or measured != evidence.measured_facts
            or immutable_json_data(project(owner, measured)) != evidence.projection_facts):
        return None
    return evidence
