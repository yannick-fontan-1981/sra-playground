"""Bind a native question before action and consume that exact observation scope."""
from agents.yf_arc3_v5.logos.operational_acquisition import (
    OperationalConsciousnessNativeAcquisition, OperationalExperimentExecution,
    OperationalExperimentAction, OperationalExperimentParticipantObservable,
    OperationalOpenResponseDomain,
)
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .conscious_acquisition_observables import read_participant_observables


def prepare_native_acquisition(owner, domain, nomination, branch, intent, scope):
    policy_ref = 'policy.conscious_application_enumeration'
    policy, loaded_policy = owner._drm.resolve(policy_ref)
    policy_hash = loaded_policy.source_hash
    configuration = policy.configuration
    subjects = tuple(sorted(domain.participant_measurements))
    fields = tuple(configuration['native_acquisition_fields'])
    if not subjects or not fields or len(subjects) * len(fields) > configuration['maximum_native_acquisition_fields']:
        return None, ('acquisition.complete_observable_domain_within_bound',)
    observables = tuple(OperationalExperimentParticipantObservable(
        field_ref='participant-state-observable:' + stable_digest((subject, field)),
        participant_ref=subject, measurement_field_ref=field,
        source_workflow_refs=tuple(configuration['participant_measurement_workflow_refs']))
        for subject in subjects for field in fields)
    before = read_participant_observables(owner, observables,
        timeline_ref=intent.timeline_id, frame_ref=intent.frame_id,
        frozen_record_refs=branch.native_participant_observation_refs)
    execution = OperationalExperimentExecution(actions=(OperationalExperimentAction(
        action_ref=intent.action_ref, action_data=intent.action_data),), observables=observables)
    contract_ref = 'native-acquisition:' + stable_digest((nomination.nomination_ref, execution, scope,
        intent.timeline_id, intent.frame_id, before, policy_hash))
    open_domain = OperationalOpenResponseDomain(question_ref=nomination.question_ref,
        observation_contract_ref=contract_ref, execution_contract_digest=stable_digest(execution),
        observable_field_refs=tuple(item.field_ref for item in observables),
        context_signature=FrozenMap({'before_signature': before['observed_signature'], 'execution_scope': scope,
            'action_ref': intent.action_ref, 'action_data': intent.action_data,
            'control_signature': immutable_json_data(intent.control_evidence_signature)}),
        support_evidence_refs=before['evidence_refs'],
        falsifier_refs=tuple(configuration['open_response_falsifier_refs'])) if before['evidence_refs'] \
            and len(before['evidence_refs']) <= 256 else None
    return OperationalConsciousnessNativeAcquisition(
        contract_ref=contract_ref, open_response_domain=open_domain,
        question_ref=nomination.question_ref, goal_ref=domain.goal_ref, nomination_ref=nomination.nomination_ref,
        domain_ref=domain.domain_ref, timeline_ref=intent.timeline_id, before_frame_ref=intent.frame_id,
        execution_scope=scope, execution=execution, prior_observation_refs=before['evidence_refs'],
        before_signature=before['observed_signature'], before_missing_refs=before['missing_refs'],
        observation_policy_ref=policy_ref, observation_policy_hash=policy_hash), ()


def observe_native_acquisition(owner, contract, witness, scope, *, before_sequence=None, after_observation_refs=None):
    missing = []
    _, loaded_policy = owner._drm.resolve(contract.observation_policy_ref)
    policy_hash = loaded_policy.source_hash
    action = contract.execution.actions[0]
    if (contract.observation_policy_ref != 'policy.conscious_application_enumeration'
            or contract.observation_policy_hash != policy_hash):
        missing.append('acquisition.current_observation_policy')
    if (contract.timeline_ref != witness.timeline_ref or contract.before_frame_ref != witness.before_frame_ref
            or contract.execution_scope != scope or action.action_ref != witness.action_ref
            or action.action_data != witness.action_data):
        missing.append('acquisition.exact_action_and_scope')
    before = read_participant_observables(owner, contract.execution.observables,
        timeline_ref=witness.timeline_ref, frame_ref=witness.before_frame_ref,
        before_sequence=owner._store.artifact_sequence(witness.intent_ref),
        frozen_record_refs=contract.prior_observation_refs)
    if before['observed_signature'] != contract.before_signature or before['missing_refs'] != contract.before_missing_refs:
        missing.append('acquisition.exact_frozen_before_measurements')
    after = read_participant_observables(owner, contract.execution.observables,
        timeline_ref=witness.timeline_ref, frame_ref=witness.after_frame_ref, before_sequence=before_sequence,
        frozen_record_refs=after_observation_refs)
    missing.extend(after['missing_refs'])
    changed = FrozenMap({item.field_ref: after['observed_signature'][item.field_ref] != contract.before_signature[item.field_ref]
        if item.field_ref in after['observed_signature'] and item.field_ref in contract.before_signature else None
        for item in contract.execution.observables})
    physical = witness.physical_effect
    return FrozenMap({'contract_ref': contract.contract_ref, 'question_ref': contract.question_ref,
        'goal_ref': contract.goal_ref, 'observation_ref': witness.observation_ref,
        'before_signature': contract.before_signature, 'before_missing_refs': contract.before_missing_refs,
        'after_signature': after['observed_signature'], 'changed_fields': changed,
        'participant_alternatives': after['participant_alternatives'],
        'after_observation_refs': after['evidence_refs'],
        'evidence_refs': tuple(sorted(set((*contract.prior_observation_refs, *after['evidence_refs'])))),
        'missing_refs': tuple(sorted(set(missing))), 'complete_observation': not missing,
        'unchanged_all_measured_fields': not missing and bool(changed) and all(value is False for _, value in sorted(changed.items())),
        'physical_effect_record_ref': witness.physical_effect_record_ref,
        'intermediate_change_measured': physical is not None and physical.final_scene_equivalent_with_intermediate_change,
        'physical_effect_missing_refs': witness.physical_effect_missing_refs,
        'open_response_domain': immutable_json_data(contract.open_response_domain)
            if contract.open_response_domain is not None else None,
        'all_scene_effects_exhaustively_observed': False,
        'causal_law_established': False, 'response_domain_complete': False,
        'independently_admitted_experiment': False})
