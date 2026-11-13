"""Readonly join of two real acquisitions and their actual dispatched input.

This binds transport provenance only. Source owns identity, causal meaning,
roles, level compatibility and the interpretation of all measured effects.
"""
from dataclasses import dataclass
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from agents.yf_arc3_v5.logos.operations import ActionIntent, EnvironmentActionDispatchedRecord
from .observed_scene_reader import ObservedInputReadRequest, ObservedInputReadResult, read_observed_input


class ObservedDispatchPairInputB(FrozenModel):
    before: ObservedInputReadRequest
    after: ObservedInputReadRequest
    dispatch_record_ref: Ref
    expected_action_ref: Ref


@dataclass(frozen=True)
class ObservedDispatchPairResultB:
    before: ObservedInputReadResult
    after: ObservedInputReadResult
    dispatch: EnvironmentActionDispatchedRecord | None
    intent: ActionIntent | None
    evidence_refs: tuple[Ref,...]
    missing_refs: tuple[Ref,...]
    current_owner_frame_matches: bool


def read_observed_dispatch_pair(store, repository, value, current_frame_ref=None):
    """An omitted owner frame permits historical reading, never current authority."""
    value = ObservedDispatchPairInputB.model_validate(value)
    before = read_observed_input(store,repository,value.before)
    after = read_observed_input(store,repository,value.after)
    missing = list((*before.missing_refs,*after.missing_refs))
    owner_matches = current_frame_ref is not None and value.after.expected_frame_ref == current_frame_ref
    if (value.before.timeline_ref != value.after.timeline_ref
            or value.before.expected_frame_ref is None or value.after.expected_frame_ref is None
            or value.before.expected_frame_ref == value.after.expected_frame_ref
            or before.state_revision != after.state_revision
            or store.snapshot.revision != after.state_revision):
        missing.append('observed_dispatch_pair.distinct_explicit_frames_same_timeline_and_read_revision')
    if current_frame_ref is not None and not owner_matches:
        missing.append('observed_dispatch_pair.current_owner_frame')
    dispatch = store.artifact(value.dispatch_record_ref)
    intent = store.artifact(dispatch.action_intent_id) if isinstance(dispatch,EnvironmentActionDispatchedRecord) else None
    if (not isinstance(dispatch,EnvironmentActionDispatchedRecord) or not isinstance(intent,ActionIntent)
            or dispatch.action_ref != value.expected_action_ref or intent.action_ref != dispatch.action_ref
            or dispatch.raw_input_ref != value.after.raw_input_ref
            or dispatch.timeline_id != value.after.timeline_ref or intent.timeline_id != value.before.timeline_ref
            or dispatch.frame_id != value.before.expected_frame_ref or intent.frame_id != value.before.expected_frame_ref):
        missing.append('observed_dispatch_pair.actual_dispatch_between_the_acquired_frames')
    evidence = (value.before.observation_record_ref,value.after.observation_record_ref,
        value.dispatch_record_ref,*( (intent.id,) if isinstance(intent,ActionIntent) else () ))
    return ObservedDispatchPairResultB(before,after,
        dispatch if isinstance(dispatch,EnvironmentActionDispatchedRecord) else None,
        intent if isinstance(intent,ActionIntent) else None,
        tuple(dict.fromkeys(evidence)),tuple(dict.fromkeys(missing)),owner_matches)
