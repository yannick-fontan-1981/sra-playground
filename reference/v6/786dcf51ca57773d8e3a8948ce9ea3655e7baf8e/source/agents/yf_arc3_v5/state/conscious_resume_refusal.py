"""Exact lineage for an unresolved causal resume, shared by commit and restore."""
from agents.yf_arc3_v5.logos.operations import (
    EnvironmentActionDispatchedRecord, WorkflowInstanceRecord, WorkflowStatus,
)


def require_causal_resume_refusal(record, *, consciousness, store):
    checkpoint = store.artifact(record.checkpoint_ref) if store is not None else None
    dispatched = store.artifact(record.environment_action_event_ref) if store is not None else None
    if (not isinstance(checkpoint, WorkflowInstanceRecord)
            or checkpoint.status is not WorkflowStatus.SUSPENDED
            or checkpoint.operational_consciousness_context != record.operational_consciousness_context
            or checkpoint.workflow_instance_id != record.workflow_instance_id
            or checkpoint.workflow_definition_id != record.workflow_definition_id
            or checkpoint.timeline_id != record.timeline_id
            or checkpoint.frame_id != record.frame_id
            or checkpoint.pending_action_intent_id != record.action_intent_id
            or checkpoint.pending_action_release_permit_id != record.action_release_permit_id):
        raise ValueError('conscious resume refusal lost its suspended responsibility')
    if (not isinstance(dispatched, EnvironmentActionDispatchedRecord)
            or dispatched.workflow_instance_id != record.workflow_instance_id
            or dispatched.timeline_id != record.timeline_id
            or dispatched.dispatch_id != record.dispatch_id
            or dispatched.action_intent_id != record.action_intent_id
            or dispatched.action_release_permit_id != record.action_release_permit_id
            or dispatched.raw_input_ref != record.raw_input_ref):
        raise ValueError('conscious resume refusal has no matching recorded response')
    if record.operational_consciousness_context.run_ref != store.run_id:
        raise ValueError('conscious resume refusal crossed its responsible run')
    return record
