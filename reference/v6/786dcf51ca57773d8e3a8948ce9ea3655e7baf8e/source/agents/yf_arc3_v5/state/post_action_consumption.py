"""Canonical receiver evidence for Source-selected post-action consumption.

This verifies ownership/delegation; it never selects a continuation or action.
"""
from agents.yf_arc3_v5.logos.operations import (
    ActionIntent, ActionReleasePermit, WorkflowStatus, EnvironmentActionDispatchedRecord,
)
from agents.yf_arc3_v5.logos.operational_responsibility import (
    OperationalConsciousnessReceiverBinding, bind_observed_return,
)


def post_action_receiver_bindings(*, store, consumer_ref, timeline_ref, returns):
    from agents.yf_arc3_v5.dynamic_workflow.runtime import RootColdExecutionRecord
    from agents.yf_arc3_v5.scheduler.source_return import resolve_composition_parent_context

    if not returns:
        raise ValueError('operational consciousness: continuation has no observed consequence')
    ancestry = set()
    ancestry_evidence = []
    workflow_ref = consumer_ref
    while workflow_ref:
        if workflow_ref in ancestry:
            raise ValueError('operational consciousness: cyclic consumer ancestry')
        ancestry.add(workflow_ref)
        checkpoint = store.latest_workflow_instance(workflow_ref)
        if checkpoint is None or checkpoint.timeline_id != timeline_ref:
            raise ValueError('operational consciousness: consumer ancestry is not canonical')
        execution = store.artifact(f'{workflow_ref}:root-cold:{checkpoint.checkpoint_sequence:08d}')
        if (not isinstance(execution, RootColdExecutionRecord)
                or execution.workflow_instance_id != workflow_ref
                or execution.timeline_id != timeline_ref):
            raise ValueError('operational consciousness: canonical composition binding missing')
        parent = resolve_composition_parent_context(execution, store=store)
        if execution.parent_workflow_instance_id is not None and parent is None:
            raise ValueError('operational consciousness: parent context is unqualified')
        ancestry_evidence.append(execution.id)
        workflow_ref = parent.workflow_instance_id if parent is not None else None

    bindings = []
    for returned in returns:
        obligation = returned.operational_consciousness_return
        intent = store.artifact(returned.action_intent_id)
        if (not isinstance(intent, ActionIntent)
                or bind_observed_return(intent, returned.observation_record_id) != obligation):
            raise ValueError('operational consciousness: returned consequence changed its intention')
        if obligation.recipient_workflow_ref in ancestry:
            binding_kind = 'canonical_parent_chain'
            authority_refs = tuple(ancestry_evidence)
        else:
            # The permit binds the exact series member and execution owner,
            # not merely a common goal, similar body or historical relation.
            permit = store.artifact(returned.action_release_permit_id)
            binding = intent.operational_consciousness
            ordinal = binding.series_index
            owner = store.latest_workflow_instance(obligation.recipient_workflow_ref)
            if (not isinstance(permit, ActionReleasePermit)
                    or permit.timeline_id != timeline_ref
                    or not binding.series_ref or permit.declared_series_ref != binding.series_ref
                    or permit.declared_series_target_workflow_instance_id != binding.execution_owner_ref
                    or binding.execution_owner_ref != returned.workflow_instance_id
                    or binding.execution_owner_ref not in ancestry
                    or ordinal is None or not 0 <= ordinal < len(permit.declared_series_intent_ids)
                    or len(permit.declared_series_intent_ids) != len(permit.declared_series_action_refs)
                    or permit.declared_series_intent_ids[ordinal] != intent.id
                    or permit.declared_series_action_refs[ordinal] != intent.action_ref
                    or binding.responsibility.origin_intent_ref not in permit.provenance
                    or owner is None or owner.timeline_id != timeline_ref):
                raise ValueError('operational consciousness: no canonical delegation to the result consumer')
            binding_kind = 'declared_series_executor'
            authority_refs = (*ancestry_evidence, permit.id, owner.id)
        bindings.append(OperationalConsciousnessReceiverBinding(
            kind=binding_kind, recipient_workflow_ref=obligation.recipient_workflow_ref,
            consumer_workflow_ref=consumer_ref, execution_workflow_ref=returned.workflow_instance_id,
            authority_refs=authority_refs))
    return tuple(bindings)


def post_action_consequence_partition(*, consciousness, store, timeline_ref, frame_ref):
    """Read sealed observed members, not the planned or unexecuted route suffix."""
    terminal_returns = consciousness.observed_consequences_at(timeline_ref, frame_ref)
    returns, boundaries, seen = [], [], set()
    for terminal in terminal_returns:
        intent = store.artifact(terminal.action_intent_id)
        permit = store.artifact(terminal.action_release_permit_id)
        members = (terminal,)
        if isinstance(permit, ActionReleasePermit) and permit.declared_series_ref is not None:
            if not isinstance(intent, ActionIntent):
                raise ValueError('consequence partition lost its canonical series member')
            binding = intent.operational_consciousness
            ordinal = binding.series_index
            owner = store.latest_workflow_instance(terminal.workflow_instance_id)
            if (ordinal is None or not 0 <= ordinal < min(256, len(permit.declared_series_intent_ids))
                    or permit.declared_series_ref != binding.series_ref
                    or permit.declared_series_target_workflow_instance_id != terminal.workflow_instance_id
                    or permit.declared_series_intent_ids[ordinal] != intent.id
                    or owner is None or owner.timeline_id != timeline_ref or owner.frame_id != frame_ref
                    or owner.status not in (WorkflowStatus.COMPLETED, WorkflowStatus.BLOCKED)):
                raise ValueError('consequence partition has no sealed canonical series boundary')
            observed = []
            previous_frame = None
            for ref in permit.declared_series_intent_ids[:ordinal + 1]:
                candidates = tuple(row for row in consciousness.observed_actions_for_intent(ref)
                    if row.workflow_instance_id == terminal.workflow_instance_id and row.timeline_id == timeline_ref)
                if len(candidates) != 1:
                    raise ValueError('consequence partition has missing or competing actual returns')
                row = candidates[0]
                dispatched = store.artifact(row.environment_action_event_ref)
                if (row.action_release_permit_id != permit.id
                        or row.observation_record_id not in owner.consumed_observation_refs
                        or not isinstance(dispatched, EnvironmentActionDispatchedRecord)
                        or dispatched.action_intent_id != ref
                        or (previous_frame is not None and dispatched.frame_id != previous_frame)):
                    raise ValueError('consequence partition lost its exact physical prefix')
                previous_frame = row.frame_id
                observed.append(row)
            if not observed or observed[-1].id != terminal.id:
                raise ValueError('consequence partition does not end at the current return')
            if owner.status is WorkflowStatus.BLOCKED:
                from .conscious_dispatch_refusal import (
                    execution_interruption_for_checkpoint, require_interrupted_execution_checkpoint,
                )
                receipt = execution_interruption_for_checkpoint(owner, store=store)
                if (receipt is None or receipt.executed_prefix is None
                        or receipt.executed_prefix.observed_action_refs != tuple(row.id for row in observed)):
                    raise ValueError('blocked series has no qualified observed prefix')
                require_interrupted_execution_checkpoint(owner,
                    store.artifact(receipt.executed_prefix.checkpoint_ref), consciousness=consciousness, store=store)
                boundaries.append(receipt.id)
            boundaries.append(owner.id)
            members = tuple(observed)
        for row in members:
            if row.id not in seen:
                seen.add(row.id)
                returns.append(row)
    return tuple(returns), tuple(dict.fromkeys(boundaries))


def require_post_action_consumption(record, *, consciousness, store):
    if store is None:
        raise ValueError('operational consciousness: post-action consumption requires canonical authority')
    if record.consequence_boundary_refs is None:
        # Historical receipts retain their recorded frame-only scope.
        returns = consciousness.observed_consequences_at(record.timeline_id, record.frame_id)
    else:
        returns, boundaries = post_action_consequence_partition(consciousness=consciousness,
            store=store, timeline_ref=record.timeline_id, frame_ref=record.frame_id)
        if record.consequence_boundary_refs != boundaries:
            raise ValueError('consumption changed its canonical execution boundaries')
    if (record.consequence_record_refs != tuple(row.id for row in returns)
            or record.consequences != tuple(row.operational_consciousness_return for row in returns)):
        raise ValueError('operational consciousness: consumption changed its canonical consequence partition')
    bindings = post_action_receiver_bindings(store=store, consumer_ref=record.consumer_workflow_ref,
        timeline_ref=record.timeline_id, returns=returns)
    if record.receiver_bindings != bindings:
        raise ValueError('operational consciousness: consumption changed its canonical receiver evidence')
    from .conscious_question_response import measure_question_responses
    if record.question_responses is None or record.question_response_claim_refs is None:
        raise ValueError('operational consciousness: new consumption omitted its question interpretation domain')
    expected = measure_question_responses(store=store, consciousness=consciousness, returns=returns,
        coverage_claim_refs=record.question_response_claim_refs, consumer_ref=record.consumer_workflow_ref,
        timeline_ref=record.timeline_id, frame_ref=record.frame_id,
        physical_measurement_lookup=record.question_response_measurement_lookup,
        question_response_scope=record.question_response_scope)
    if record.question_responses != expected:
        raise ValueError('operational consciousness: consumption changed a question or its observed interpretation')
    return record
