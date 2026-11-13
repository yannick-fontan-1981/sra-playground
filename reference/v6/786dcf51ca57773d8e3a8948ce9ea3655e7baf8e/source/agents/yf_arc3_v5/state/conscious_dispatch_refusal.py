"""Retain pre-transport refusal without manufacturing an attempted action."""
from agents.yf_arc3_v5.logos.operations import (
    WorkflowInstanceRecord, WorkflowStatus, CompiledSelectionDecisionRecord,
    OperationalConsciousnessDispatchRefusalRecord, ActionReleasePermit,
)

RECOVERY_WORKFLOW = 'arc3.conditional_reasoning_tree.recover_uncertain_transport'
RETIREMENT_DISPOSITION = 'dispatch_recovery.requalify_release'
PREFIX_DISPOSITION = 'dispatch_recovery.reconcile_executed_prefix'


def require_dispatch_refusal(record, *, consciousness, store):
    checkpoint = store.artifact(record.checkpoint_ref) if store is not None else None
    if (not isinstance(checkpoint, WorkflowInstanceRecord)
            or checkpoint.status is not WorkflowStatus.SUSPENDED
            or checkpoint.operational_consciousness_context != record.operational_consciousness_context
            or checkpoint.workflow_instance_id != record.workflow_instance_id
            or checkpoint.workflow_definition_id != record.workflow_definition_id
            or checkpoint.timeline_id != record.timeline_id or checkpoint.frame_id != record.frame_id
            or checkpoint.pending_action_intent_id != record.action_intent_id
            or checkpoint.pending_action_release_permit_id != record.action_release_permit_id
            or record.operational_consciousness_context.run_ref != store.run_id):
        raise ValueError('conscious dispatch refusal lost its suspended responsibility')
    if record.dispatch_id != 'dispatch:' + record.action_intent_id:
        raise ValueError('conscious dispatch refusal changed its transport identity')
    if store.artifact('attempt:' + record.dispatch_id) is not None:
        raise ValueError('conscious dispatch refusal cannot erase an existing transport attempt')
    return record


def require_dispatch_retirement(record, *, consciousness, store):
    refusal = store.artifact(record.refusal_ref)
    decision = store.artifact(record.selection_ref)
    if not isinstance(refusal, OperationalConsciousnessDispatchRefusalRecord):
        raise ValueError('dispatch retirement has no canonical pre-transport refusal')
    require_dispatch_refusal(refusal, consciousness=consciousness, store=store)
    prior = store.artifact(refusal.checkpoint_ref)
    current = store.latest_workflow_instance(prior.workflow_instance_id)
    permit = store.artifact(refusal.action_release_permit_id)
    if (current is None or current.id not in (prior.id, record.retired_checkpoint_ref)
            or not isinstance(permit, ActionReleasePermit) or permit.concentration_lease is None):
        raise ValueError('dispatch retirement lost its current suspended checkpoint or lease')
    context = prior.operational_consciousness_context
    disposition = RETIREMENT_DISPOSITION
    prefix_count = 0
    transition_suffix = ':interrupt-lease'
    if record.executed_prefix is not None:
        from .conscious_dispatch_prefix import read_observed_dispatch_prefix
        actual = read_observed_dispatch_prefix(refusal, consciousness=consciousness, store=store)
        if actual != record.executed_prefix:
            raise ValueError('dispatch retirement changed its actual observed prefix')
        if (not isinstance(decision, CompiledSelectionDecisionRecord)
                or decision.descriptive_facts.get('executed_prefix_evidence_complete') is not True):
            raise ValueError('dispatch retirement prefix was not qualified in its Source decision')
        disposition = PREFIX_DISPOSITION
        prefix_count = len(actual.intent_refs)
        transition_suffix = ':return-observed-lease'
    if (not isinstance(decision, CompiledSelectionDecisionRecord)
            or decision.workflow_definition_id != RECOVERY_WORKFLOW
            or decision.terminal_ref != disposition
            or decision.descriptive_facts.get('dispatch_refusal_ref') != refusal.id
            or decision.descriptive_facts.get('release_requalification_required') is not True
            or decision.descriptive_facts.get('dispatch_retirement_ready') is not True
            or decision.descriptive_facts.get('executed_prefix_action_count') != prefix_count
            or decision.descriptive_facts.get('response_recorded') is not False
            or decision.descriptive_facts.get('redelivery_permitted') is not False
            or decision.timeline_id != prior.timeline_id or decision.frame_id != prior.frame_id
            or decision.execution_run_ref != store.run_id
            or record.operational_consciousness_context != context
            or record.recipient_context_ref != (context.parent_context_ref or context.context_ref)
            or record.retired_checkpoint_ref != f'{prior.workflow_instance_id}:checkpoint:{prior.checkpoint_sequence + 1:08d}'
            or record.concentration_lease_ref != permit.concentration_lease.id
            or record.lease_transition_ref != record.id + transition_suffix
            or record.id != 'conscious-dispatch-retirement:' + refusal.id):
        raise ValueError('dispatch retirement differs from its Source-selected refusal consequence')
    for field in ('source_unit', 'source_hash', 'workflow_definition_id', 'workflow_instance_id',
                  'workflow_step_id', 'timeline_id', 'frame_id', 'state_revision'):
        if getattr(record, field) != getattr(decision, field):
            raise ValueError('dispatch retirement changed its current Source decision lineage')
    return record


def dispatch_retirement_for_checkpoint(checkpoint, *, store):
    """Read the canonical causal link, never the terminal display string."""
    from agents.yf_arc3_v5.logos.operations import OperationalConsciousnessDispatchRetirementRecord
    receipts = tuple(value for ref in checkpoint.provenance
        if isinstance(value := store.artifact(ref), OperationalConsciousnessDispatchRetirementRecord)
        and value.retired_checkpoint_ref == checkpoint.id)
    if len(receipts) > 1:
        raise ValueError('dispatch checkpoint has competing retirement receipts')
    return receipts[0] if receipts else None


def require_retired_dispatch_checkpoint(record, prior, *, consciousness, store):
    from agents.yf_arc3_v5.logos.operations import (
        OperationalConsciousnessDispatchRetirementRecord, ConcentrationLeaseTransition,
        ConcentrationLeaseState,
    )
    receipt = dispatch_retirement_for_checkpoint(record, store=store)
    if not isinstance(receipt, OperationalConsciousnessDispatchRetirementRecord):
        raise ValueError('suspended workflow retirement requires its canonical consumption receipt')
    require_dispatch_retirement(receipt, consciousness=consciousness, store=store)
    refusal = store.artifact(receipt.refusal_ref)
    transition = store.artifact(receipt.lease_transition_ref)
    expected_state = ConcentrationLeaseState.INTERRUPTED
    expected_intent = refusal.action_intent_id
    if receipt.executed_prefix is not None:
        expected_state = ConcentrationLeaseState.OBSERVED
        expected_intent = receipt.executed_prefix.intent_refs[-1]
    if (record.status is not WorkflowStatus.BLOCKED
            or refusal.checkpoint_ref != prior.id or receipt.retired_checkpoint_ref != record.id
            or record.frame_id != prior.frame_id
            or record.consumed_observation_refs != prior.consumed_observation_refs
            or record.control_stack or record.pending_action_intent_id or record.pending_action_release_permit_id
            or record.pending_expectation_refs or record.pending_environment_adapter_ref
            or record.pending_world_context or record.pre_action_snapshot_digest
            or record.awaiting_frame_binding or record.suspension_frame_id
            or record.source_terminal_binding is not None
            or record.provenance != (prior.id, receipt.id)
            or not isinstance(transition, ConcentrationLeaseTransition)
            or transition.concentration_lease_id != receipt.concentration_lease_ref
            or transition.from_state is not ConcentrationLeaseState.RELEASED
            or transition.to_state is not expected_state
            or transition.reason_ref != receipt.id or transition.action_intent_id != expected_intent):
        raise ValueError('dispatch retirement must preserve the parent and interrupt only the refused lease')
    return record


def execution_interruption_for_checkpoint(checkpoint, *, store):
    from .conscious_response_reconciliation import response_reconciliation_for_checkpoint
    return (response_reconciliation_for_checkpoint(checkpoint, store=store)
        or dispatch_retirement_for_checkpoint(checkpoint, store=store))


def require_interrupted_execution_checkpoint(record, prior, *, consciousness, store):
    from .conscious_response_reconciliation import (
        response_reconciliation_for_checkpoint, require_reconciled_response_checkpoint,
    )
    if response_reconciliation_for_checkpoint(record, store=store) is not None:
        return require_reconciled_response_checkpoint(record, prior, consciousness=consciousness, store=store)
    return require_retired_dispatch_checkpoint(record, prior, consciousness=consciousness, store=store)
