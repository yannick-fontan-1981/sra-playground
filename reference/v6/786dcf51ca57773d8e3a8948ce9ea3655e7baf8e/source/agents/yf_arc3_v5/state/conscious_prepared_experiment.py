"""Bind pending native questions to a command after its real preparation."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.operations import OperationalConsciousnessReevaluationRecord, ControlEvidenceSignature
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .control_evidence_binding import measure_control_evidence_binding


def matching_recovery_queries(nomination, candidates, *, action_ref, action_data, control_signature):
    """Retain the complete matching query domain, including queries without a return."""
    graph = nomination.measured.get('observed_recovery_composition') if nomination is not None else None
    if not graph or control_signature is None:
        return ()
    signature = ControlEvidenceSignature.model_validate(control_signature)
    return tuple((ref, query, graph['edges'][query['forward_edge_ref']])
        for ref, query in sorted(graph['queries'].items())
        if query['candidate_ref'] in candidates and query['current_matches_departure']
        and graph['edges'][query['forward_edge_ref']]['action_ref'] == action_ref
        and graph['edges'][query['forward_edge_ref']]['action_data'] == action_data
        and ControlEvidenceSignature.model_validate(graph['edges'][query['forward_edge_ref']]['control_signature']).response_recall_key()
            == signature.response_recall_key())


def _matching_recovery_lengths(nomination, candidates, intent):
    graph = nomination.measured.get('observed_recovery_composition') if nomination is not None else None
    if not graph or intent.control_evidence_signature is None:
        return FrozenMap()
    rows = {}
    digest = stable_digest(graph)
    preservation = nomination.measured.get('observed_recovery_preservation', FrozenMap())
    for query_ref, query, edge in matching_recovery_queries(nomination, candidates,
            action_ref=intent.action_ref, action_data=intent.action_data,
            control_signature=intent.control_evidence_signature):
        if (query['minimum_forward_and_return_primitive_count'] is None
                or not query['shortest_relation_complete']):
            continue
        ref = 'prepared-recovery-length:' + stable_digest((nomination.nomination_ref, query_ref))
        assessed = preservation.get('queries', {}).get(query_ref)
        rows[ref] = FrozenMap({'nomination_ref': nomination.nomination_ref, 'query_ref': query_ref,
            'graph_digest': digest, 'candidate_ref': query['candidate_ref'],
            'forward_observation_ref': edge['observation_ref'],
            'minimum_forward_and_return_primitive_count': query['minimum_forward_and_return_primitive_count'],
            'observed_graph_search_complete': query['observed_graph_search_complete'],
            'conflicting_observation_refs': query['conflicting_observation_refs'],
            'future_resource_cost_known': False, 'preservation_established': False})
        if assessed is not None:
            for mode, path in sorted(assessed['endpoint_admission_paths'].items()):
                if path['minimum_forward_and_return_primitive_count'] is None:
                    continue
                mode_ref = 'prepared-recovery-length:' + stable_digest((nomination.nomination_ref, query_ref, mode))
                rows[mode_ref] = FrozenMap.overlay({
                    'endpoint_admission_mode': mode, 'preservation_measurement_digest': stable_digest(preservation),
                    'unbound_requirement_refs': assessed['unbound_requirement_refs'],
                    'observed_graph_search_complete': path['observed_subgraph_search_complete'],
                    'minimum_forward_and_return_primitive_count': path['minimum_forward_and_return_primitive_count'],
                }, rows[ref])
    return FrozenMap(rows)


def measure_prepared_experiment_controls(owner, prepared):
    from agents.yf_arc3_v5.scheduler.conscious_applications import verify_native_review
    from agents.yf_arc3_v5.scheduler.registry import PureCallBlocked
    intent = prepared.intent
    frontier = intent.goal_acquisition_frontier
    proof = measure_control_evidence_binding(intent, owner._store.snapshot, intent.frame_id)
    identity = FrozenMap({'intent_ref': intent.id, 'timeline_ref': intent.timeline_id, 'frame_ref': intent.frame_id,
        'action_ref': intent.action_ref, 'action_data': intent.action_data,
        'control_signature': immutable_json_data(intent.control_evidence_signature),
        'control_claim_ref': intent.control_evidence_claim_ref,
        'control_claim_digest': intent.control_evidence_claim_digest})
    rows = {}
    for branch in frontier.branches if frontier is not None else ():
        for review_ref in branch.native_means_review_refs:
            record = owner._store.artifact(review_ref)
            missing, reviewed = [], None
            entry = owner._entries.get(record.demand.origin_context.source_workflow_ref) \
                if isinstance(record, OperationalConsciousnessReevaluationRecord) else None
            if (not isinstance(record, OperationalConsciousnessReevaluationRecord)
                    or record.status != 'consumed' or record.consumption_ref != record.id
                    or record.demand.kind != 'native_means_review'
                    or record.demand.problem_ref != branch.goal_ref
                    or record.timeline_id != intent.timeline_id or frontier.timeline_ref != intent.timeline_id
                    or frontier.frame_ref != intent.frame_id
                    or record.demand.execution_scope != frontier.execution_scope
                    or immutable_json_data(branch.operational_goal_intent) != record.demand.semantic_inputs.get('operational_goal_intent')
                    or record.projection_facts is None or stable_digest(record.projection_facts) != record.projection_digest
                    or entry is None or entry.transitive_source_hash != record.demand.origin_context.source_hash):
                missing.append('experiment_control.current_consumed_native_review')
            else:
                try:
                    reviewed = verify_native_review(owner, record.demand.semantic_inputs, record.projection_facts)
                except (ValidationError, PureCallBlocked, KeyError):
                    missing.append('experiment_control.exact_frozen_nomination')
            applications = reviewed.application_reviews if reviewed is not None else (None,)
            for application in applications:
                nomination = application.experiment_nomination if application is not None else None
                if application is not None and nomination is None:
                    continue  # Historical reviews are not retroactively nominated experiments.
                domain = application.domain if application is not None else None
                enumeration = application.enumeration if application is not None else None
                signature = intent.control_evidence_signature
                operator_matches = domain is not None and domain.request is not None and domain.request.operator_ref == intent.action_ref
                control_matches = signature is not None and domain is not None and signature.addressed_control_ref in domain.addressed_control_refs
                candidates = tuple(candidate.candidate_ref for candidate in enumeration.rows
                    if set(candidate.participant_refs) == set(signature.receiver_refs)) if (
                        enumeration is not None and enumeration.complete and signature is not None
                        and operator_matches and control_matches and not missing) else ()
                acquisition, acquisition_missing = None, ()
                if candidates and nomination is not None and domain.native_acquisition_required:
                    from .conscious_native_acquisition import prepare_native_acquisition
                    acquisition, acquisition_missing = prepare_native_acquisition(
                        owner, domain, nomination, branch, intent, frontier.execution_scope)
                ref = 'prepared-experiment-question:' + stable_digest((review_ref, branch.goal_ref,
                    domain.domain_ref if domain is not None else None))
                rows[ref] = FrozenMap.overlay(proof, FrozenMap.overlay({'goal_ref': branch.goal_ref, 'native_review_ref': review_ref,
                    'nomination_ref': nomination.nomination_ref if nomination is not None else None,
                    'nomination_disposition_ref': nomination.source_disposition_ref if nomination is not None else None,
                    'domain_ref': domain.domain_ref if domain is not None else None,
                    'mechanism_ref': domain.mechanism_ref if domain is not None else None,
                    'candidate_refs': candidates, 'review_current': not missing,
                    'acquisition_contract': immutable_json_data(acquisition) if acquisition is not None else None,
                    'acquisition_missing_refs': acquisition_missing,
                    'observed_recovery_lengths': _matching_recovery_lengths(nomination, candidates, intent),
                    'goal_preserve_constraint_refs': domain.preservation_requirements.goal_preserve_constraint_refs
                        if domain is not None and domain.preservation_requirements is not None else (),
                    'goal_overshoot_constraint_refs': domain.preservation_requirements.goal_overshoot_constraint_refs
                        if domain is not None and domain.preservation_requirements is not None else (),
                    'missing_refs': tuple(missing), 'operator_bound': domain is not None and domain.request is not None,
                    'operator_matches': bool(operator_matches),
                    'addressed_control_matches': bool(control_matches), 'receiver_binding_present': bool(candidates),
                    'candidate_binding_ambiguous': len(candidates) > 1,
                    }, identity))
    from .conscious_experiment_resources import measure_experiment_resources
    resource_policy, _ = owner._drm.resolve('policy.conscious_experiment_resource_obligation')
    recovery_lengths = FrozenMap({ref: value for _, row in sorted(rows.items())
        for ref, value in sorted(row['observed_recovery_lengths'].items())})
    resources = measure_experiment_resources(owner._store, intent, resource_policy.configuration, recovery_lengths) if rows else FrozenMap({
        'alternative_refs': (), 'descriptive_by_ref': FrozenMap()})
    return FrozenMap({'intent_binding': identity, 'resource_measurement': resources,
        'input_digest': stable_digest((identity, frontier, intent.premise_claim_refs,
            intent.canonical_premise_claim_refs, rows, resources)),
        'alternative_refs': tuple(sorted(rows)), 'descriptive_by_ref': FrozenMap(rows)})
