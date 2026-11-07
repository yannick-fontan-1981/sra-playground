"""Canonical admission of a received effect, distinct from permission to resume."""
from agents.yf_arc3_v5.logos.operations import (
    ActionIntent, ActionReleasePermit, CompiledSelectionDecisionRecord,
    ConcentrationLeaseState, ConcentrationLeaseTransition,
    OperationalConsciousnessDispatchPrefix, OperationalConsciousnessResumeRefusalRecord,
    OperationalConsciousnessResponseReconciliationRecord, WorkflowStatus,
)
from .conscious_resume_refusal import require_causal_resume_refusal

RESPONSE_DISPOSITION = 'resume_recovery.reconcile_recorded_response'


def recorded_response_readiness(refusal, *, consciousness, store, world_inputs, frame_ref):
    """Exact admission prerequisites; DRM owns the consequence of this measurement."""
    try:
        require_causal_resume_refusal(refusal, consciousness=consciousness, store=store)
        prior = store.artifact(refusal.checkpoint_ref)
        current = store.latest_workflow_instance(prior.workflow_instance_id)
        permit = store.artifact(refusal.action_release_permit_id)
        intent = store.artifact(refusal.action_intent_id)
        dispatched = store.artifact(refusal.environment_action_event_ref)
        raw = world_inputs.get(refusal.raw_input_ref)
        existing = store.artifact('conscious-response-reconciliation:' + refusal.id)
        prefix = response_observed_prefix(refusal, consciousness=consciousness, store=store)
        from agents.yf_arc3_v5.logos.operational_responsibility import validate_action_responsibility
        validate_action_responsibility(intent)
        if (current is None or not isinstance(permit, ActionReleasePermit) or permit.concentration_lease is None
                or raw.frame_id != frame_ref or raw.frame_id != refusal.response_frame_ref or raw.frame_id == prior.frame_id
                or dispatched.frame_id != prior.frame_id or dispatched.action_ref != intent.action_ref
                or permit.pre_action_snapshot_digest != prior.pre_action_snapshot_digest
                or any(world_inputs.get_by_frame_id(ref) is None for ref in prefix.frame_refs)):
            return False
        if existing is not None:
            require_reconciled_response_checkpoint(current, prior, consciousness=consciousness, store=store)
            return True
        return (current.id == prior.id
            and store.concentration_state(permit.concentration_lease.id) is ConcentrationLeaseState.RELEASED
            and consciousness.observed_action_for_dispatch(dispatched.id) is None
            and consciousness.observed_action_for_observation('observation-receipt:' + refusal.dispatch_id) is None)
    except (ValueError, KeyError):
        return False


def response_observed_prefix(refusal, *, consciousness, store):
    """The final observation identity is deterministic; earlier ones already exist."""
    checkpoint = store.artifact(refusal.checkpoint_ref)
    intent = store.artifact(refusal.action_intent_id)
    if not isinstance(intent, ActionIntent):
        raise ValueError('response reconciliation lost its canonical intent')
    previous = None
    if intent.operational_consciousness.series_index not in (None, 0):
        from .conscious_dispatch_prefix import read_observed_dispatch_prefix
        previous = read_observed_dispatch_prefix(refusal, consciousness=consciousness, store=store)
    observed_ref = f'{checkpoint.workflow_instance_id}:action-observed:{checkpoint.checkpoint_sequence + 1:08d}'
    return OperationalConsciousnessDispatchPrefix(checkpoint_ref=checkpoint.id,
        intent_refs=(*(previous.intent_refs if previous else ()), intent.id),
        observed_action_refs=(*(previous.observed_action_refs if previous else ()), observed_ref),
        frame_refs=(*(previous.frame_refs if previous else (checkpoint.frame_id,)), refusal.response_frame_ref))


def require_response_reconciliation(record, *, consciousness, store):
    committed = getattr(store, 'committed_evidence_store', store)
    if store.artifact(record.id) is None and record.state_revision != committed.snapshot.revision:
        raise ValueError('response reconciliation admission is not at the current semantic revision')
    refusal = store.artifact(record.refusal_ref)
    decision = store.artifact(record.selection_ref)
    if not isinstance(refusal, OperationalConsciousnessResumeRefusalRecord):
        raise ValueError('response reconciliation requires its canonical causal refusal')
    require_causal_resume_refusal(refusal, consciousness=consciousness, store=store)
    prior = store.artifact(refusal.checkpoint_ref)
    permit = store.artifact(refusal.action_release_permit_id)
    current = store.latest_workflow_instance(prior.workflow_instance_id)
    context = prior.operational_consciousness_context
    if (current is None or current.id not in (prior.id, record.retired_checkpoint_ref)
            or not isinstance(permit, ActionReleasePermit) or permit.concentration_lease is None
            or not isinstance(decision, CompiledSelectionDecisionRecord)
            or decision.workflow_definition_id != 'arc3.conditional_reasoning_tree.recover_uncertain_transport'
            or decision.terminal_ref != RESPONSE_DISPOSITION
            or decision.descriptive_facts.get('resume_refusal_ref') != refusal.id
            or decision.descriptive_facts.get('recorded_response_reconciliation_ready') is not True
            or decision.descriptive_facts.get('response_recorded') is not True
            or decision.descriptive_facts.get('redelivery_permitted') is not False
            or decision.timeline_id != prior.timeline_id or decision.frame_id != refusal.response_frame_ref
            or decision.execution_run_ref != store.run_id
            or record.operational_consciousness_context != context
            or record.recipient_context_ref != (context.parent_context_ref or context.context_ref)
            or record.id != 'conscious-response-reconciliation:' + refusal.id
            or record.retired_checkpoint_ref != f'{prior.workflow_instance_id}:checkpoint:{prior.checkpoint_sequence + 1:08d}'
            or record.concentration_lease_ref != permit.concentration_lease.id
            or record.lease_transition_ref != record.id + ':observed-lease'
            or record.observation_ref != 'observation-receipt:' + refusal.dispatch_id
            or record.executed_prefix != response_observed_prefix(refusal, consciousness=consciousness, store=store)
            or record.observed_action_ref != record.executed_prefix.observed_action_refs[-1]):
        raise ValueError('response reconciliation changed its selected owner, effect or physical lineage')
    for field in ('source_unit', 'source_hash', 'workflow_definition_id', 'workflow_instance_id',
                  'workflow_step_id', 'timeline_id', 'frame_id', 'state_revision'):
        if getattr(record, field) != getattr(decision, field):
            raise ValueError('response reconciliation lost its current Source decision')
    return record


def response_reconciliation_for_checkpoint(checkpoint, *, store):
    receipts = tuple(value for ref in checkpoint.provenance
        if isinstance(value := store.artifact(ref), OperationalConsciousnessResponseReconciliationRecord)
        and value.retired_checkpoint_ref == checkpoint.id)
    if len(receipts) > 1:
        raise ValueError('response checkpoint has competing reconciliation receipts')
    return receipts[0] if receipts else None


def require_reconciled_response_checkpoint(record, prior, *, consciousness, store):
    receipt = response_reconciliation_for_checkpoint(record, store=store)
    if receipt is None:
        raise ValueError('response interruption lacks its canonical admission')
    require_response_reconciliation(receipt, consciousness=consciousness, store=store)
    refusal = store.artifact(receipt.refusal_ref)
    observed = consciousness.observed_action_for_observation(receipt.observation_ref)
    transition = store.artifact(receipt.lease_transition_ref)
    if (record.status is not WorkflowStatus.BLOCKED or refusal.checkpoint_ref != prior.id
            or record.frame_id != refusal.response_frame_ref
            or set(record.consumed_observation_refs) != {*prior.consumed_observation_refs, receipt.observation_ref}
            or observed is None or observed.id != receipt.observed_action_ref
            or observed.action_intent_id != refusal.action_intent_id
            or record.control_stack or record.pending_action_intent_id or record.pending_action_release_permit_id
            or record.pending_expectation_refs or record.pending_environment_adapter_ref
            or record.pending_world_context or record.pre_action_snapshot_digest
            or record.awaiting_frame_binding or record.suspension_frame_id or record.source_terminal_binding is not None
            or record.provenance != (prior.id, receipt.id)
            or not isinstance(transition, ConcentrationLeaseTransition)
            or transition.concentration_lease_id != receipt.concentration_lease_ref
            or transition.from_state is not ConcentrationLeaseState.RELEASED
            or transition.to_state is not ConcentrationLeaseState.OBSERVED
            or transition.reason_ref != receipt.id or transition.action_intent_id != refusal.action_intent_id):
        raise ValueError('response interruption did not preserve and admit its exact physical effect')
    return record
