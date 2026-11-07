"""Canonical continuity checks; Source body qualification stays in its registry."""
from agents.yf_arc3_v5.logos.operations import (
    ConsciousCompiledRecord, OperationalConsciousnessReasoningEntryRecord,
    WorkflowInstanceRecord, WorkflowStatus,
)


def _require_context_origin(context, *, consciousness, store):
    if store is None or context.run_ref != store.run_id:
        raise ValueError('operational consciousness: context has no matching canonical run')
    retained = consciousness.reasoning_context(context.context_ref)
    if retained is not None and retained != context:
        raise ValueError('operational consciousness: publication changed its retained context')
    if context.parent_context_ref is None:
        return
    parent = store.artifact(context.parent_checkpoint_ref)
    if isinstance(parent, WorkflowInstanceRecord):
        parent_context = parent.operational_consciousness_context
    elif isinstance(parent, OperationalConsciousnessReasoningEntryRecord):
        parent_context = parent.context
    elif isinstance(parent, ConsciousCompiledRecord) and parent.operational_consciousness is not None:
        parent_context = parent.operational_consciousness.context
    else:
        raise ValueError('operational consciousness: context has no canonical parent record')
    if (parent_context.context_ref != context.parent_context_ref
            or parent_context.root_context_ref != context.root_context_ref
            or parent_context.run_ref != context.run_ref
            or parent_context.timeline_ref != context.timeline_ref
            or consciousness.reasoning_context(parent_context.context_ref) != parent_context):
        raise ValueError('operational consciousness: context changed its canonical parent or root')


def require_compiled_entry_publication(record, *, consciousness, store):
    context = record.context
    _require_context_origin(context, consciousness=consciousness, store=store)
    if context.entry_kind == 'source_workflow':
        raise ValueError('operational consciousness: compiled entry has an interpreted context')
    prior = consciousness.compiled_entry_for_context(context.context_ref)
    if prior is not None and prior != record:
        raise ValueError('operational consciousness: compiled context already has its admitted entry')
    origin = record.initiating_operation
    if origin is not None:
        consciousness.require_reasoning_execution(origin, run_ref=store.run_id,
            timeline_ref=record.timeline_id, frame_ref=record.frame_id,
            workflow_ref=origin.context.owner_workflow_ref,
            source_workflow_ref=origin.context.source_workflow_ref,
            source_hash=origin.context.source_hash, operation_ref=origin.operation_ref)
        branch = consciousness.branch_state(origin.context.context_ref)
        if branch.current_record_ref != context.parent_checkpoint_ref:
            raise ValueError('operational consciousness: compiled child has a stale initiating record')
    if record.replay_of_record_ref is not None:
        historical = store.artifact(record.replay_of_record_ref)
        if (not isinstance(historical, ConsciousCompiledRecord)
                or historical.operational_consciousness is None):
            raise ValueError('operational consciousness: replay subject is not a canonical compiled return')
        returned = historical.operational_consciousness
        consciousness.require_compiled_reasoning_replay(returned)
        entry = consciousness.compiled_entry(returned.entry_ref)
        if (entry.source_hash != record.source_hash
                or entry.module_source_hash != record.module_source_hash
                or entry.workflow_definition_id != record.workflow_definition_id
                or entry.declared_operations != record.declared_operations):
            raise ValueError('operational consciousness: replay entry differs from its historical instructions')
    return record


def require_workflow_checkpoint_publication(record, *, consciousness, store):
    context = record.operational_consciousness_context
    _require_context_origin(context, consciousness=consciousness, store=store)
    if context.entry_kind != 'source_workflow':
        raise ValueError('operational consciousness: interpreted checkpoint has a compiled context')
    prior = store.latest_workflow_instance(record.workflow_instance_id)
    if prior is None:
        if (record.checkpoint_sequence != 1 or record.status is not WorkflowStatus.ACTIVE
                or not record.local_bindings_complete or record.consumed_observation_refs
                or context.origin_frame_ref != record.frame_id):
            raise ValueError('operational consciousness: workflow has no initial active checkpoint')
        return record
    if (record.checkpoint_sequence != prior.checkpoint_sequence + 1
            or record.state_revision < prior.state_revision
            or context != prior.operational_consciousness_context
            or record.module_source_hash != prior.module_source_hash
            or record.source_unit != prior.source_unit):
        raise ValueError('operational consciousness: checkpoint lost its canonical predecessor or Source')
    if prior.status in (WorkflowStatus.COMPLETED, WorkflowStatus.BLOCKED,
                        WorkflowStatus.FAILED, WorkflowStatus.DEFERRED):
        raise ValueError('operational consciousness: terminal workflow cannot silently reopen')
    previous = set(prior.consumed_observation_refs)
    current = set(record.consumed_observation_refs)
    if not previous.issubset(current):
        raise ValueError('operational consciousness: checkpoint erased consumed observations')
    added = current - previous
    if prior.status is WorkflowStatus.SUSPENDED:
        if record.status is WorkflowStatus.BLOCKED:
            from .conscious_response_reconciliation import (
                response_reconciliation_for_checkpoint, require_reconciled_response_checkpoint,
            )
            if response_reconciliation_for_checkpoint(record, store=store) is not None:
                return require_reconciled_response_checkpoint(record, prior, consciousness=consciousness, store=store)
            from .conscious_dispatch_refusal import require_retired_dispatch_checkpoint
            return require_retired_dispatch_checkpoint(record, prior, consciousness=consciousness, store=store)
        if (record.status is not WorkflowStatus.ACTIVE or record.frame_id == prior.frame_id
                or len(added) != 1):
            raise ValueError('operational consciousness: suspended workflow has no exact observed resumption')
        observed = consciousness.observed_action_for_observation(next(iter(sorted(added))))
        if (observed is None or observed.workflow_instance_id != record.workflow_instance_id
                or observed.frame_id != record.frame_id or observed.timeline_id != record.timeline_id
                or observed.action_intent_id != prior.pending_action_intent_id
                or observed.action_release_permit_id != prior.pending_action_release_permit_id):
            raise ValueError('operational consciousness: checkpoint resumed from another action return')
    elif added or record.frame_id != prior.frame_id:
        raise ValueError('operational consciousness: checkpoint changed frame without an observed resumption')
    return record
