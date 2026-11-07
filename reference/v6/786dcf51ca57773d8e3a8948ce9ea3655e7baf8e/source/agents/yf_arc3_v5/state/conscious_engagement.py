"""Bind a previously dispatched lease to one consumed terminal return.

Every primitive needs a canonical dispatch, not a separate reconciliation cycle.
Locators from the runtime cache are only lookup hints; they cannot certify closure.
"""
from agents.yf_arc3_v5.logos.operations import ActionIntent, ActionReleasePermit
from agents.yf_arc3_v5.logos.operational_engagement import OperationalConsciousnessEngagementReview
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_incoming_engagement(store, identity, incoming_ref, terminal_refs, maximum):
    incoming = store.artifact(incoming_ref) if incoming_ref else None
    binding = incoming.operational_consciousness if isinstance(incoming, ActionIntent) else None
    scope_current = (binding is not None and incoming.timeline_id == identity['timeline_ref']
        and binding.responsibility.execution_scope == identity['execution_scope'])
    engagements = FrozenMap({field: getattr(incoming, field) for field in
        ('committed_plan_ref', 'declared_plan_ref', 'discriminating_experiment_ref')
        if isinstance(incoming, ActionIntent) and getattr(incoming, field) is not None})
    locators = tuple(dict.fromkeys((*(terminal_refs or ()), *((incoming_ref,) if incoming_ref else ()))))
    proofs, missing = {}, []
    if not scope_current:
        missing.append('engagement.canonical_incoming_intent_in_current_scope')
    if not engagements:
        missing.append('engagement.declared_plan_or_experiment_reference')
    if len(locators) > maximum:
        missing.append('engagement.terminal_locator_bound')
    if scope_current and len(locators) <= maximum:
        consciousness = store.operational_consciousness
        for ref in locators:
            observations = consciousness.observed_actions_for_intent(ref)
            if len(observations) > maximum:
                missing.append('engagement.observation_bound:' + ref)
                continue
            for observed in observations:
                permit = store.artifact(observed.action_release_permit_id)
                if not isinstance(permit, ActionReleasePermit):
                    continue
                members = permit.declared_series_intent_ids or (permit.action_intent_id,)
                # Only the exact terminal member can consume the whole lease.
                if (observed.action_intent_id != members[-1]
                        or permit.timeline_id != identity['timeline_ref']
                        or (incoming_ref not in members and incoming_ref not in permit.provenance)):
                    continue
                gaps, dispatches, previous_sequence = [], [], -1
                if len(members) > maximum or len(set(members)) != len(members):
                    gaps.append('engagement.complete_distinct_member_domain')
                else:
                    for index, member_ref in enumerate(members):
                        member = store.artifact(member_ref)
                        member_binding = member.operational_consciousness if isinstance(member, ActionIntent) else None
                        if (member_binding is None or member.timeline_id != identity['timeline_ref']
                                or member_binding.responsibility.execution_scope != identity['execution_scope']
                                or any(getattr(member, field) != expected for field, expected in sorted(engagements.items()))
                                or (permit.declared_series_ref is not None and (
                                    member_binding.series_ref != permit.declared_series_ref
                                    or member_binding.series_index != index
                                    or len(permit.declared_series_action_refs) != len(members)
                                    or member.action_ref != permit.declared_series_action_refs[index]))):
                            gaps.append('engagement.exact_member:' + member_ref)
                            continue
                        sent = store.dispatches_for_intent(member_ref)
                        if len(sent) != 1:
                            gaps.append('engagement.unique_dispatch:' + member_ref)
                            continue
                        dispatch = sent[0]
                        sequence = store.artifact_sequence(dispatch.id)
                        if (dispatch.timeline_id != identity['timeline_ref']
                                or dispatch.action_release_permit_id != permit.id
                                or dispatch.action_ref != member.action_ref
                                or sequence is None or sequence <= previous_sequence):
                            gaps.append('engagement.ordered_permitted_dispatch:' + member_ref)
                            continue
                        dispatches.append(dispatch.id)
                        previous_sequence = sequence
                observed_sequence = store.artifact_sequence(observed.id)
                if (not dispatches or dispatches[-1] != observed.environment_action_event_ref
                        or observed_sequence is None or observed_sequence <= previous_sequence):
                    gaps.append('engagement.terminal_observation_after_dispatch')
                receipts = consciousness.consumptions_for_consequence(observed.id)
                consumed = []
                if len(receipts) > maximum:
                    gaps.append('engagement.consumption_bound')
                else:
                    for receipt in receipts:
                        sequence = store.artifact_sequence(receipt.id)
                        if (receipt.timeline_id == identity['timeline_ref'] and receipt.frame_id == observed.frame_id
                                and observed.operational_consciousness_return in receipt.consequences
                                and sequence is not None and observed_sequence is not None and sequence > observed_sequence):
                            consumed.append(receipt.id)
                if not consumed:
                    gaps.append('engagement.consumed_terminal_return')
                proofs[observed.id] = FrozenMap({'permit_ref': permit.id, 'permit_digest': stable_digest(permit),
                    'member_refs': members, 'dispatch_refs': tuple(dispatches),
                    'terminal_observation_ref': observed.id, 'terminal_observation_digest': stable_digest(observed),
                    'consumption_refs': tuple(consumed),
                    'consumption_digests': tuple(stable_digest(store.artifact(ref)) for ref in consumed),
                    'missing_evidence_refs': tuple(gaps), 'complete': not gaps})
    if not proofs:
        missing.append('engagement.canonical_terminal_lease_domain')
    from .conscious_engagement_dependencies import measure_engagement_dependencies
    dependencies = (measure_engagement_dependencies(store, incoming, identity, maximum)
        if scope_current and binding.responsibility.problem.local_goal_ref is not None else None)
    return OperationalConsciousnessEngagementReview(incoming_intent_ref=incoming_ref,
        terminal_locator_refs=tuple(terminal_refs or ()), maximum_members=maximum,
        identity_digest=stable_digest(identity), incoming_intent_digest=stable_digest(incoming) if incoming else None,
        engagement_refs=engagements,
        incoming_scope_current=bool(scope_current), candidate_proofs=FrozenMap(proofs),
        missing_evidence_refs=tuple(missing),
        dependency_review=dependencies,
        lease_consumption_complete=not missing and len(proofs) == 1 and all(row['complete'] for _, row in sorted(proofs.items())))


def measure_engagement_frontier(store, identity, engagement, maximum):
    """Shared mechanical facts for Source production and canonical publication."""
    from agents.yf_arc3_v5.logos.types import immutable_json_data
    measured = measure_incoming_engagement(store, identity, engagement.incoming_intent_ref,
        engagement.terminal_locator_refs, engagement.maximum_members) if engagement else None
    current = engagement is not None and engagement == measured and engagement.maximum_members == maximum
    dependencies = measured.dependency_review if measured else None
    return FrozenMap({
        'incoming_engagement_member_bound': maximum,
        'incoming_dependency_domain_complete': bool(current and dependencies is not None and dependencies.reference_domain_complete),
        'incoming_missing_premise_count': len(dependencies.missing_premise_refs) if dependencies else None,
        'incoming_expired_premise_count': len(dependencies.expired_premise_refs) if dependencies else None,
        'incoming_inactive_premise_count': len(dependencies.inactive_premise_refs) if dependencies else None,
        'incoming_contested_premise_count': len(dependencies.contested_premise_refs) if dependencies else None,
        'incoming_engagement_consumption_proved': bool(current and engagement.lease_consumption_complete),
        'incoming_engagement_review_current': current,
        'incoming_engagement_review': immutable_json_data(measured) if measured else None})


def retained_engagement_measurement(record):
    """Project the actually published observation, never a stale prepared copy."""
    measured = record.measured_facts.get('incoming_engagement_review')
    return OperationalConsciousnessEngagementReview.model_validate(measured) if measured is not None else None
