"""Mechanical causal guards for actual operations and their observed returns."""
from agents.yf_arc3_v5.logos.operations import (
    ActionIntent, ActionReleasePermit, EnvironmentActionDispatchedRecord,
    ObservationAcquiredRecord, WorkflowStatus,
)
from agents.yf_arc3_v5.logos.operational_responsibility import bind_observed_return


def require_operator_invocation(record, *, consciousness, store):
    if store is None:
        raise ValueError('operational consciousness: invocation requires canonical authority')
    consciousness.require_reasoning_execution(record.operational_consciousness,
        run_ref=store.run_id, timeline_ref=record.timeline_id, frame_ref=record.frame_id,
        workflow_ref=record.workflow_instance_id, source_workflow_ref=record.workflow_definition_id,
        source_hash=record.source_hash, operation_ref=record.operator.value)
    return record


def require_action_observation(record, *, consciousness, store):
    if store is None:
        raise ValueError('operational consciousness: action observation requires canonical authority')
    if (consciousness.observed_action_for_observation(record.observation_record_id) is not None
            or consciousness.observed_action_for_dispatch(record.environment_action_event_ref) is not None):
        raise ValueError('operational consciousness: action observation was already reconciled')
    checkpoint = store.latest_workflow_instance(record.workflow_instance_id)
    from .conscious_response_reconciliation import require_response_reconciliation
    from agents.yf_arc3_v5.logos.operations import OperationalConsciousnessResponseReconciliationRecord
    admissions = tuple(value for ref in record.provenance
        if isinstance(value := store.artifact(ref), OperationalConsciousnessResponseReconciliationRecord))
    admitted_revision = False
    if admissions:
        if len(admissions) != 1:
            raise ValueError('observed response has competing current admissions')
        admission = admissions[0]
        require_response_reconciliation(admission, consciousness=consciousness, store=store)
        if (admission.observed_action_ref != record.id or admission.observation_ref != record.observation_record_id
                or admission.frame_id != record.frame_id or admission.state_revision != record.state_revision):
            raise ValueError('observed response differs from its current admission')
        admitted_revision = True
    if (checkpoint is None or checkpoint.status is not WorkflowStatus.SUSPENDED
            or checkpoint.timeline_id != record.timeline_id
            or checkpoint.workflow_definition_id != record.workflow_definition_id
            or checkpoint.source_hash != record.source_hash
            or (checkpoint.state_revision != record.state_revision and not admitted_revision)
            or checkpoint.pending_action_intent_id != record.action_intent_id
            or checkpoint.pending_action_release_permit_id != record.action_release_permit_id
            or checkpoint.frame_id == record.frame_id):
        raise ValueError('operational consciousness: observed return lost its exact suspended execution')
    intent = store.artifact(record.action_intent_id)
    permit = store.artifact(record.action_release_permit_id)
    dispatched = store.artifact(record.environment_action_event_ref)
    observation = store.artifact(record.observation_record_id)
    if (not isinstance(intent, ActionIntent) or not isinstance(permit, ActionReleasePermit)
            or not isinstance(dispatched, EnvironmentActionDispatchedRecord)
            or not isinstance(observation, ObservationAcquiredRecord)):
        raise ValueError('operational consciousness: observed return lacks canonical causal evidence')
    if (any(row.timeline_id != record.timeline_id for row in (intent, permit, dispatched, observation))
            or dispatched.action_intent_id != intent.id
            or dispatched.action_release_permit_id != permit.id
            or dispatched.action_ref != intent.action_ref
            or dispatched.workflow_instance_id != record.workflow_instance_id
            or dispatched.workflow_definition_id != record.workflow_definition_id
            or dispatched.frame_id != checkpoint.frame_id
            or dispatched.environment_adapter_ref != checkpoint.pending_environment_adapter_ref
            or dispatched.state_revision > record.state_revision
            or observation.raw_input_ref != dispatched.raw_input_ref
            or observation.frame_id != record.frame_id
            or observation.state_revision != record.state_revision
            or observation.workflow_instance_id not in (None, record.workflow_instance_id)
            or permit.commitment_decision_id != intent.commitment_decision_id
            or checkpoint.pre_action_snapshot_digest != permit.pre_action_snapshot_digest):
        raise ValueError('operational consciousness: action, dispatch and observation have different causal lineage')
    if permit.declared_series_ref is None:
        if permit.action_intent_id != intent.id or permit.available_action_ref != intent.available_action_ref:
            raise ValueError('operational consciousness: observed action differs from its release permit')
    else:
        binding = intent.operational_consciousness
        ordinal = binding.series_index
        if (binding.series_ref != permit.declared_series_ref
                or binding.execution_owner_ref != record.workflow_instance_id
                or permit.declared_series_target_workflow_instance_id != record.workflow_instance_id
                or ordinal is None or not 0 <= ordinal < len(permit.declared_series_intent_ids)
                or len(permit.declared_series_intent_ids) != len(permit.declared_series_action_refs)
                or permit.declared_series_intent_ids[ordinal] != intent.id
                or permit.declared_series_action_refs[ordinal] != intent.action_ref
                or binding.responsibility.origin_intent_ref not in permit.provenance):
            raise ValueError('operational consciousness: observed series member lost its exact delegation')
    if bind_observed_return(intent, observation.id) != record.operational_consciousness_return:
        raise ValueError('operational consciousness: observed return changed its original responsibility')
    return record
