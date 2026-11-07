"""Exact canonical proof measurements for a DRM-declared proposed goal."""
from agents.yf_arc3_v5.logos.operations import OperatorInvocation, OperatorResult
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_goal_observation_support(*, evidence_ref, origin_claim_ref, goal_ref,
                                     snapshot, store=None, timeline_ref=None):
    """Resolve an observation basis through its exact canonical DERIVE receipts.

    This qualifies acquisition provenance, not present-world truth or utility.
    """
    origin = snapshot.claim(origin_claim_ref)
    current = bool(origin is not None and origin.attributes.get('goal_ref') == goal_ref
        and origin.polarity.value == 'positive' and origin.disposition.value == 'active'
        and not origin.active_contradictions and not origin.defeated_by
        and evidence_ref in origin.grounds
        and (origin.valid_through_state_revision is None or origin.valid_through_state_revision >= snapshot.revision))
    rows = []
    if current and store is not None and timeline_ref:
        for ref in origin.source_operator_results:
            result = store.artifact(ref)
            invocation = store.artifact(result.invocation_id) if isinstance(result, OperatorResult) else None
            if not isinstance(invocation, OperatorInvocation):
                continue
            lineage = ('source_unit', 'source_hash', 'workflow_definition_id',
                'workflow_instance_id', 'workflow_step_id', 'timeline_id', 'frame_id')
            if (result.status.value == 'completed' and result.operator.value == 'DERIVE'
                    and invocation.operator == result.operator and result.timeline_id == timeline_ref
                    and origin.id in result.output_refs and evidence_ref in invocation.input_refs
                    and invocation.authority_ref == origin.proof_rule
                    and result.state_revision >= invocation.state_revision
                    and all(getattr(result, field) == getattr(invocation, field) for field in lineage)):
                rows.append(FrozenMap({'result_ref': result.id, 'result_digest': stable_digest(result),
                    'invocation_ref': invocation.id, 'invocation_digest': stable_digest(invocation),
                    'acquisition_frame_ref': result.frame_id}))
    return FrozenMap({'evidence_ref': evidence_ref, 'origin_claim_ref': origin_claim_ref,
        'origin_claim_digest': stable_digest(origin) if origin is not None else None,
        'origin_current': current, 'matching_receipts': tuple(sorted(rows, key=lambda row: row['result_ref'])),
        'acquisition_support_bound': bool(rows), 'current_world_revalidated': False,
        'establishes_utility': False, 'grants_action': False})


def measure_declared_goal_evidence(*, expectation, goal_ref, snapshot,
                                   store=None, timeline_ref=None, frame_ref=None):
    available = store is not None and bool(timeline_ref) and bool(frame_ref)
    rows = []
    for claim in snapshot.claims_for_predicate(expectation.predicate_ref):
        if (len(claim.arguments) <= expectation.goal_argument_index
                or claim.arguments[expectation.goal_argument_index] != goal_ref):
            continue
        failures = []
        if (claim.polarity.value != 'positive' or claim.disposition.value != 'active'
                or claim.epistemic_status.value not in expectation.epistemic_status_refs
                or claim.active_contradictions or claim.defeated_by
                or (claim.valid_through_state_revision is not None
                    and claim.valid_through_state_revision < snapshot.revision)):
            failures.append('claim_not_current_positive_declared_status')
        if claim.proof_rule not in expectation.proof_rule_refs:
            failures.append('proof_rule_not_declared')
        event_ref = (claim.arguments[expectation.event_argument_index]
            if len(claim.arguments) > expectation.event_argument_index else None)
        event = snapshot.term(event_ref) if event_ref else None
        if event is None or event.attributes.get(expectation.event_kind_attribute_ref) != expectation.expected_event_kind_ref:
            failures.append('event_kind_not_observed')
        before = event.attributes.get(expectation.event_before_measure_field) if event else None
        after = event.attributes.get(expectation.event_after_measure_field) if event else None
        delta = after - before if type(before) is int and type(after) is int else None
        if delta is None or delta < expectation.minimum_event_delta:
            failures.append('event_measurement_does_not_meet_declared_delta')
        proofs = []
        if available:
            for ref in claim.source_operator_results:
                result = store.artifact(ref)
                if (isinstance(result, OperatorResult) and claim.id in result.output_refs
                        and result.status.value == expectation.successful_operation_status_ref
                        and result.timeline_id == timeline_ref and result.frame_id == frame_ref):
                    proofs.append(result.id)
        if not proofs:
            failures.append('current_source_proof_missing')
        rows.append(FrozenMap({'claim_ref': claim.id, 'claim_digest': stable_digest(claim),
            'event_ref': event_ref, 'event_digest': stable_digest(event) if event is not None else None,
            'observed_delta': delta, 'current_source_proof_refs': tuple(sorted(proofs)),
            'failed_checks': tuple(failures), 'declared_checks_satisfied': not failures}))
    return FrozenMap({'expectation': expectation.model_dump(mode='python'),
        'goal_ref': goal_ref, 'proof_context_available': available,
        'candidate_rows': tuple(sorted(rows, key=lambda row: row['claim_ref'])),
        'matching_claim_refs': tuple(sorted(row['claim_ref'] for row in rows if row['declared_checks_satisfied'])),
        'absence_refutes_goal': False, 'establishes_mechanism_causality': False, 'grants_action': False})
