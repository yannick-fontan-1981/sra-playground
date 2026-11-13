"""Join a witnessed dispatch only to reviews frozen before its actual intent."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.operations import (ActionIntent, ActionReleasePermit, CommitmentDecision,
    ViabilityAssessment, OperationalConsciousnessReevaluationRecord)
from agents.yf_arc3_v5.logos.operational_observation import (
    OperationalConsciousnessObservedApplication, OperationalConsciousnessApplicationAssociation,
)
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest


def _receipt_action_origin(owner, row, intent, permit):
    if row.intent_ref == intent.id:
        return True
    if (not isinstance(permit, ActionReleasePermit) or intent.declared_series_ref is None
            or permit.declared_series_ref != intent.declared_series_ref
            or permit.declared_series_intent_ids != (intent.id,) or intent.declared_series_index != 0
            or permit.declared_series_action_refs != (intent.action_ref,) or permit.action_intent_id != intent.id
            or permit.available_action_ref != intent.available_action_ref
            or row.intent_ref not in intent.provenance or row.intent_ref not in permit.provenance
            or intent.operational_consciousness.responsibility.origin_intent_ref != row.intent_ref
            or row.frame_ref != intent.frame_id or row.commitment_return is None):
        return False
    viability = owner._store.artifact(permit.viability_assessment_id)
    wisdom = owner._store.artifact(permit.commitment_decision_id)
    _, loaded_policy = owner._drm.resolve('policy.conscious_experiment_commitment')
    policy_hash = loaded_policy.source_hash
    returned = row.commitment_return
    return (isinstance(viability, ViabilityAssessment) and isinstance(wisdom, CommitmentDecision)
        and wisdom.viability_assessment_id == viability.id and wisdom.decision.value == 'commit'
        and wisdom.timeline_id == viability.timeline_id == permit.timeline_id == intent.timeline_id
        and wisdom.frame_id == viability.frame_id == row.frame_ref
        and returned.revised_viability_digest == stable_digest(viability)
        and returned.policy_ref == 'policy.conscious_experiment_commitment' and returned.policy_hash == policy_hash)


def read_frozen_application_associations(owner, frontier, observation_ref, application, *, frozen_acquisitions=None):
    """Descriptive equality only; DRM interprets the preserved alternatives."""
    from agents.yf_arc3_v5.scheduler.conscious_applications import verify_native_review
    from agents.yf_arc3_v5.scheduler.registry import PureCallBlocked
    store = owner._store
    witness = OperationalConsciousnessObservedApplication.model_validate(application) if application is not None else None
    intent = store.artifact(witness.intent_ref) if witness is not None else None
    permit = store.artifact(witness.permit_ref) if witness is not None else None
    origin_valid = (isinstance(intent, ActionIntent) and intent.goal_acquisition_frontier == frontier
        and frontier.timeline_ref == witness.timeline_ref and frontier.frame_ref == witness.before_frame_ref
        and stable_digest(frontier) == witness.goal_frontier_digest)
    signature = witness.control_signature if witness is not None else None
    result = {}
    for branch in frontier.branches:
        rows = []
        for review_ref in branch.native_means_review_refs:
            common = dict(goal_ref=branch.goal_ref, review_ref=review_ref, observation_ref=observation_ref)
            record = store.artifact(review_ref)
            missing = []
            if not origin_valid:
                missing.append('application.exact_observed_frontier')
            if not isinstance(record, OperationalConsciousnessReevaluationRecord):
                missing.append(review_ref)
            else:
                demand = record.demand
                entry = owner._entries.get(demand.origin_context.source_workflow_ref)
                prior = store.artifact_sequence(review_ref)
                dispatched_intent = store.artifact_sequence(intent.id) if intent is not None else None
                if (record.status != 'consumed' or demand.kind != 'native_means_review'
                        or demand.problem_ref != branch.goal_ref or record.timeline_id != frontier.timeline_ref
                        or demand.execution_scope != frontier.execution_scope
                        or immutable_json_data(branch.operational_goal_intent) != demand.semantic_inputs.get('operational_goal_intent')
                        or prior is None or dispatched_intent is None or prior >= dispatched_intent
                        or record.consumption_ref != record.id or record.projection_facts is None
                        or stable_digest(record.projection_facts) != record.projection_digest
                        or entry is None or entry.transitive_source_hash != demand.origin_context.source_hash):
                    missing.append('application.exact_prior_scoped_consumption')
            review = None
            if not missing:
                try:
                    review = verify_native_review(owner, record.demand.semantic_inputs, record.projection_facts)
                except (ValidationError, PureCallBlocked, KeyError):
                    missing.append('application.qualified_frozen_review')
            if missing:
                rows.append(OperationalConsciousnessApplicationAssociation(**common, missing_refs=tuple(missing)))
                continue
            for assessed in review.application_reviews:
                domain, enumeration = assessed.domain, assessed.enumeration
                missing = list(domain.missing_refs)
                if domain.participant_measurements:
                    from .conscious_participant_measurement import read_frozen_participant_measurements
                    poses = read_frozen_participant_measurements(owner, branch.native_participant_observation_refs,
                        timeline_ref=frontier.timeline_ref, frame_ref=frontier.frame_ref,
                        participant_refs=tuple(domain.participant_measurements),
                        before_sequence=store.artifact_sequence(intent.id))
                    if poses['values'] != domain.participant_measurements:
                        missing.append('application.exact_frozen_participant_measurements')
                if domain.goal_ref != branch.goal_ref:
                    missing.append('application.exact_domain_goal')
                if domain.request is None or enumeration is None or not enumeration.complete:
                    missing.append('application.complete_frozen_enumeration')
                if not domain.addressed_control_refs:
                    missing.append('application.declared_addressed_control')
                if signature is None:
                    missing.append('application.actual_control_signature')
                operator_matches = (domain.request.operator_ref == witness.action_ref
                    if domain.request is not None and witness is not None else None)
                control_matches = (signature['addressed_control_ref'] in domain.addressed_control_refs
                    if signature is not None and domain.addressed_control_refs else None)
                receivers = set(signature['receiver_refs']) if signature is not None else set()
                matches = tuple(candidate.candidate_ref for candidate in enumeration.rows
                    if set(candidate.participant_refs) == receivers) if (
                        not missing and operator_matches and control_matches) else ()
                late_fields = {}
                if domain.late_experiment_control_required or 'operational_experiment_control_returns' in intent.model_fields_set:
                    _, loaded_policy = owner._drm.resolve('policy.conscious_prepared_experiment_control')
                    policy_hash = loaded_policy.source_hash
                    nomination = assessed.experiment_nomination
                    receipts = tuple(dict.fromkeys(row.return_ref for row in (
                        *intent.operational_experiment_control_returns, *intent.inherited_experiment_control_returns)
                        if row.native_review_ref == review_ref and row.domain_ref == domain.domain_ref
                        and row.goal_ref == branch.goal_ref and nomination is not None
                        and row.nomination_ref == nomination.nomination_ref
                        and _receipt_action_origin(owner, row, intent, permit) and row.timeline_ref == intent.timeline_id
                        and row.frame_ref == witness.before_frame_ref
                        and row.action_ref == witness.action_ref and row.action_data == witness.action_data
                        and immutable_json_data(row.control_signature) == witness.control_signature
                        and row.control_claim_ref == intent.control_evidence_claim_ref
                        and row.control_claim_digest == intent.control_evidence_claim_digest
                        and row.source_policy_ref == 'policy.conscious_prepared_experiment_control'
                        and row.source_policy_hash == policy_hash and row.current_control_bound
                        and not row.missing_refs and row.candidate_refs == matches))
                    late_fields['experiment_control_return_refs'] = receipts
                    if matches and nomination is not None and not receipts:
                        missing.append('application.exact_prepared_experiment_control_return')
                        matches = ()
                    if domain.native_acquisition_required and matches and nomination is not None:
                        from .conscious_native_acquisition import prepare_native_acquisition, observe_native_acquisition
                        expected, absent = prepare_native_acquisition(owner, domain, nomination, branch, intent,
                            frontier.execution_scope)
                        returns, assessment_failures = {}, {}
                        for receipt in (*intent.operational_experiment_control_returns, *intent.inherited_experiment_control_returns):
                            if receipt.return_ref not in receipts:
                                continue
                            if expected is None or absent or receipt.acquisition_contract != expected:
                                missing.append('application.exact_prior_acquisition_contract')
                                continue
                            assessment_return = None
                            if receipt.frontier_assessment is not None:
                                from .conscious_native_experiment import inspect_native_assessment_link
                                reading = inspect_native_assessment_link(owner, receipt)
                                assessment_return = reading.bound_return
                                if assessment_return is None:
                                    missing.append('application.exact_consumed_native_frontier_assessment')
                                    missing.extend(reading.failed_check_refs)
                                    assessment_failures[receipt.return_ref] = immutable_json_data(reading)
                                    continue
                            returns[receipt.return_ref] = observe_native_acquisition(owner, receipt.acquisition_contract,
                                witness, frontier.execution_scope,
                                after_observation_refs=frozen_acquisitions.get(receipt.return_ref, {}).get('after_observation_refs', ())
                                     if frozen_acquisitions is not None else None)
                            if assessment_return is not None:
                                returns[receipt.return_ref] = FrozenMap.overlay(
                                    {'frontier_assessment_return': assessment_return}, returns[receipt.return_ref])
                        late_fields['acquisition_returns'] = FrozenMap(returns)
                        late_fields['assessment_read_failures'] = FrozenMap(assessment_failures)
                        if missing:
                            matches = ()
                rows.append(OperationalConsciousnessApplicationAssociation(**common,
                    **late_fields,
                    domain_ref=domain.domain_ref,
                    mechanism_ref=domain.mechanism_ref,
                    conditioning_signature_ref=domain.request.conditioning_signature_ref if domain.request is not None else None,
                    candidate_refs=matches, missing_refs=tuple(dict.fromkeys(missing)),
                    operator_matches=operator_matches, addressed_control_matches=control_matches,
                    participant_order_ambiguous=bool(len(matches) > 1 and not domain.request.exchangeable_slots_declared)))
        candidate_count = sum(len(row.candidate_refs) for row in rows)
        result[branch.goal_ref] = FrozenMap({
            'application_associations': tuple(immutable_json_data(row) for row in rows),
            'application_association_count': candidate_count,
            'application_association_incomplete': any(row.missing_refs for row in rows),
            'application_association_ambiguous': candidate_count > 1,
        })
    return FrozenMap(result)
