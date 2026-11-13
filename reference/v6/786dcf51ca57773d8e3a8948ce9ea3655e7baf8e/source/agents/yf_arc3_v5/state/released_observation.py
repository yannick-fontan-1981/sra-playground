"""Shared exact read of actual dispatch, acquisition and observation lineage."""
from agents.yf_arc3_v5.logos.operations import (
    ActionIntent, ActionReleasePermit, ActionObservedRecord,
    EnvironmentActionDispatchedRecord, ObservationAcquiredRecord,
    CompiledInteractionEffectRecord,
)
from agents.yf_arc3_v5.logos.operational_observation import OperationalConsciousnessObservedApplication
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest


def _read_physical_effect(store, intent, dispatch, acquired, observed, physical_effect_record_ref,
        physical_measurement_lookup):
    """Join the existing classifier output, without rerunning perception."""
    if physical_effect_record_ref is not None:
        candidates = (store.artifact(physical_effect_record_ref),)
    elif physical_measurement_lookup is None:
        # Replay the recorded evidence domain of pre-contract receipts only.
        candidates = (store.latest_artifact(CompiledInteractionEffectRecord),)
    else:
        candidates = store.physical_measurements_for_interval(timeline_ref=observed.timeline_id,
            before_frame_ref=intent.frame_id, after_frame_ref=acquired.frame_id,
            after_raw_input_ref=acquired.raw_input_ref, action_ref=intent.action_ref,
            action_data_digest=stable_digest(intent.action_data))
    candidates = tuple(record for record in candidates
        if isinstance(record, CompiledInteractionEffectRecord) and record.operational_physical_effect is not None)
    if not candidates:
        return None, None, ('observation.canonical_physical_measurement',)
    matching = []
    dispatch_order = store.artifact_sequence(dispatch.id)
    for record in candidates:
        effect = record.operational_physical_effect
        effect_order = store.artifact_sequence(record.id)
        if (record.timeline_id == observed.timeline_id and record.frame_id == acquired.frame_id
                and effect.before_frame_ref == intent.frame_id and effect.after_frame_ref == acquired.frame_id
                and effect.after_raw_input_ref == acquired.raw_input_ref and effect.action_ref == intent.action_ref
                and effect.action_data_digest == stable_digest(intent.action_data)
                and effect.measurement_digest == record.measurement_digest
                and dispatch_order is not None and effect_order is not None and dispatch_order < effect_order):
            matching.append(record)
    if not matching:
        return None, None, ('observation.physical_measurement_of_this_exact_dispatch',)
    if len(matching) != 1:
        return None, None, ('observation.unambiguous_physical_measurement_of_this_exact_dispatch',)
    record = matching[0]
    return record.operational_physical_effect, record.id, ()


def physical_return_facts(application):
    effect = application.get('physical_effect') if application is not None else None
    return FrozenMap({
        'physical_effect_present': effect is not None,
        'physical_packet_dimensions_consistent': effect['packet_dimensions_consistent'] if effect is not None else None,
        'physical_final_changed_count': effect['final_changed_count'] if effect is not None else None,
        'physical_transient_only_change': effect['final_scene_equivalent_with_intermediate_change'] if effect is not None else None,
    })


def read_released_observation(store, observed_ref, *, timeline_ref, frame_ref, physical_effect_record_ref=None,
        physical_measurement_lookup='exact_observed_interval'):
    if physical_measurement_lookup not in (None, 'exact_observed_interval'):
        raise ValueError('unknown physical measurement lookup contract')
    observed = store.artifact(observed_ref)
    if not isinstance(observed, ActionObservedRecord):
        return FrozenMap({'binding': None, 'missing_refs': ('observation.actual_action_observed_record',)})
    intent = store.artifact(observed.action_intent_id)
    permit = store.artifact(observed.action_release_permit_id)
    dispatch = store.artifact(observed.environment_action_event_ref)
    acquired = store.artifact(observed.observation_record_id)
    refs = (observed.action_intent_id, observed.action_release_permit_id,
        observed.environment_action_event_ref, observed.observation_record_id, observed.id)
    missing = []
    for item, kind, ref in zip((intent, permit, dispatch, acquired),
            (ActionIntent, ActionReleasePermit, EnvironmentActionDispatchedRecord, ObservationAcquiredRecord), refs):
        if not isinstance(item, kind):
            missing.append(ref)
    if missing:
        return FrozenMap({'binding': None, 'missing_refs': tuple(missing)})
    order = tuple(store.artifact_sequence(ref) for ref in refs)
    if (any(value is None for value in order)
            or not (order[0] < order[2] and order[1] < order[2] < order[3] < order[4])):
        missing.append('observation.exact_dispatch_acquisition_order')
    if not all(item.timeline_id == timeline_ref for item in (intent, permit, dispatch, acquired, observed)):
        missing.append('observation.single_execution_timeline')
    if (intent.frame_id != dispatch.frame_id or observed.frame_id != acquired.frame_id
            or observed.frame_id != frame_ref or intent.frame_id is None or observed.frame_id is None):
        missing.append('observation.exact_before_after_frames')
    if (dispatch.action_intent_id != intent.id or dispatch.action_ref != intent.action_ref
            or dispatch.action_release_permit_id != permit.id
            or not (permit.action_intent_id == intent.id or intent.id in permit.declared_series_intent_ids)):
        missing.append('observation.exact_released_action_identity')
    if not (acquired.raw_input_ref == dispatch.raw_input_ref or dispatch.id in acquired.provenance):
        missing.append('observation.acquisition_from_this_dispatch')
    if missing:
        return FrozenMap({'binding': None, 'missing_refs': tuple(missing)})
    physical, physical_ref, physical_missing = _read_physical_effect(
        store, intent, dispatch, acquired, observed, physical_effect_record_ref, physical_measurement_lookup)
    binding = OperationalConsciousnessObservedApplication(observation_ref=observed.id,
        intent_ref=intent.id, permit_ref=permit.id, dispatch_ref=dispatch.id, acquisition_ref=acquired.id,
        timeline_ref=timeline_ref, world_context_ref=intent.world_context_ref,
        before_frame_ref=intent.frame_id, after_frame_ref=observed.frame_id,
        action_ref=intent.action_ref, action_data=intent.action_data,
        dispatch_request_digest=dispatch.request_digest, dispatch_response_digest=dispatch.response_digest,
        physical_effect=physical, physical_effect_record_ref=physical_ref,
        physical_effect_missing_refs=physical_missing,
        control_signature=immutable_json_data(intent.control_evidence_signature)
            if intent.control_evidence_signature is not None else None,
        goal_frontier_digest=stable_digest(intent.goal_acquisition_frontier)
            if intent.goal_acquisition_frontier is not None else None)
    return FrozenMap({'binding': immutable_json_data(binding), 'missing_refs': ()})
