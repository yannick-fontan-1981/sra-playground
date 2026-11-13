"""Reconstruct only a canonical observed prefix, without interpreting its effect."""
from agents.yf_arc3_v5.logos.operations import (
    ActionIntent, EnvironmentActionDispatchedRecord, OperationalConsciousnessDispatchPrefix,
)
from agents.yf_arc3_v5.scheduler.source_return import read_source_checkpoint_binding_path


def read_observed_dispatch_prefix(refusal, *, consciousness, store):
    checkpoint = store.artifact(refusal.checkpoint_ref)
    return read_canonical_observed_prefix(
        checkpoint, boundary_intent_ref=refusal.action_intent_id,
        include_boundary=False, permit_ref=refusal.action_release_permit_id,
        terminal_frame_ref=refusal.frame_id, consciousness=consciousness, store=store)


def read_canonical_observed_prefix(checkpoint, *, boundary_intent_ref,
                                   include_boundary, permit_ref,
                                   terminal_frame_ref, consciousness, store):
    """Join a Source-bounded physical prefix; never invent a dispatch refusal."""
    if checkpoint.workflow_definition_id != 'arc3.continue_declared_action.continue_declared_action':
        raise ValueError('observed dispatch prefix requires a declared action series')
    binding = read_source_checkpoint_binding_path(checkpoint, ('intents',), store=store)
    if (not binding.value_present or not isinstance(binding.value, (tuple, list))
            or not 1 <= len(binding.value) <= 256):
        raise ValueError('observed dispatch prefix lost its canonical Source intents')
    intents = tuple(ActionIntent.model_validate(value) for value in binding.value)
    positions = tuple(i for i, intent in enumerate(intents) if intent.id == boundary_intent_ref)
    if len(positions) != 1 or not isinstance(include_boundary, bool):
        raise ValueError('observed dispatch prefix has no exact boundary')
    end = positions[0] + int(include_boundary)
    if not 0 < end <= 256:
        raise ValueError('observed dispatch prefix has no exact nonempty boundary')
    references, frames = [], []
    for intent in intents[:end]:
        observations = tuple(row for row in consciousness.observed_actions_for_intent(intent.id)
            if row.workflow_instance_id == checkpoint.workflow_instance_id
            and row.timeline_id == checkpoint.timeline_id)
        if len(observations) != 1:
            raise ValueError('observed dispatch prefix has a missing or ambiguous action return')
        observed = observations[0]
        dispatched = store.artifact(observed.environment_action_event_ref)
        dispatches = tuple(row for row in store.dispatches_for_intent(intent.id)
            if row.workflow_instance_id == checkpoint.workflow_instance_id
            and row.timeline_id == checkpoint.timeline_id)
        if (not isinstance(dispatched, EnvironmentActionDispatchedRecord)
                or len(dispatches) != 1 or dispatches[0].id != dispatched.id
                or dispatched.action_intent_id != intent.id
                or dispatched.action_release_permit_id != permit_ref
                or dispatched.workflow_instance_id != checkpoint.workflow_instance_id
                or dispatched.timeline_id != checkpoint.timeline_id
                or observed.action_release_permit_id != permit_ref
                or observed.source_hash != checkpoint.source_hash
                or dispatched.state_revision > observed.state_revision
                or observed.state_revision > checkpoint.state_revision
                or (frames and frames[-1] != dispatched.frame_id)):
            raise ValueError('observed dispatch prefix crossed another release or physical sequence')
        if not frames:
            frames.append(dispatched.frame_id)
        references.append(observed.id)
        frames.append(observed.frame_id)
    origin = read_source_checkpoint_binding_path(checkpoint, ('reference_frame_ref',), store=store)
    if not origin.value_present or origin.value != frames[0] or frames[-1] != terminal_frame_ref:
        raise ValueError('observed dispatch prefix lost its first or last actual frame')
    return OperationalConsciousnessDispatchPrefix(checkpoint_ref=checkpoint.id,
        intent_refs=tuple(intent.id for intent in intents[:end]),
        observed_action_refs=tuple(references), frame_refs=tuple(frames))
