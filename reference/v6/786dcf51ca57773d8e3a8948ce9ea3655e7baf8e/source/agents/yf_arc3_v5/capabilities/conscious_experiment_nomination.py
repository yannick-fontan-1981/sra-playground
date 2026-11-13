"""Native experiment questions with measured observables and explicit debts.

Observed response alternatives are not promoted to causal hypotheses. This
contract nominates the exact acquisition problem; an executable frontier still
requires current control, observation, scope, preservation and cost bindings.
"""
from typing import Literal
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest, immutable_json_data
from agents.yf_arc3_v5.drm.meaning import DeclaredAlternativeFacts
from agents.yf_arc3_v5.logos.operations import ControlEvidenceSignature
from .conscious_recovery_evidence import measure_observed_inverse_evidence
from .conscious_recovery_composition import measure_observed_recovery_composition
from .conscious_recovery_preservation import measure_recovery_preservation
from .conscious_recovery_policy import measure_conditional_recovery_policy
from .conscious_application_consequences import candidate_goal_consequence_rows, goal_prediction_contract


class OperationalConsciousnessExperimentNomination(FrozenModel):
    nomination_ref: Ref
    domain_ref: Ref
    goal_ref: Ref
    mechanism_ref: Ref
    measured: FrozenMap
    projection: DeclaredAlternativeFacts
    source_disposition_ref: Ref
    question_ref: Ref
    required_binding_refs: tuple[Ref, ...]
    executable_experiment_bound: Literal[False] = False
    benefit_established: Literal[False] = False
    grants_action: Literal[False] = False


def measure_experiment_nomination(domain, enumeration, prediction, consequences, control_projection=None):
    recovery = measure_observed_inverse_evidence(domain, enumeration)
    composition = measure_observed_recovery_composition(domain, enumeration) if domain.recovery_search_bounds else None
    preservation = measure_recovery_preservation(domain, composition) if composition is not None \
        and domain.preservation_requirements is not None else None
    transition = (domain.observed_return_context or {}).get('participant_transition') or FrozenMap()
    acquisitions = transition.get('native_acquisition_returns', FrozenMap())
    variants = {}
    if prediction is not None:
        for row in prediction.symbolic_state_rows:
            if row.prediction_ref is None:
                continue  # Legacy intervals have no individually bound response variant.
            signature, descriptors = {}, {}
            for participant, state in zip(row.participant_refs, row.predicted_states):
                for field, value in sorted(state.items()):
                    observable = 'participant-state-observable:' + stable_digest((participant, field))
                    signature[observable] = value
                    descriptors[observable] = FrozenMap({'entity_ref': participant, 'state_field_ref': field})
            variants.setdefault(row.candidate_ref, []).append(FrozenMap({
                'response_family_ref': 'symbolic_state',
                'response_ref': row.prediction_ref, 'observation_refs': row.observation_refs,
                'observable_signature': FrozenMap(signature), 'observable_descriptors': FrozenMap(descriptors)}))
        for row in prediction.rows:
            signature, descriptors = {}, {}
            for participant, bounds in zip(row.participant_refs, row.predicted_bounds):
                observable = 'participant-bounds-observable:' + stable_digest(participant)
                signature[observable] = bounds
                descriptors[observable] = FrozenMap({'entity_ref': participant, 'state_field_ref': 'bounds'})
            variants.setdefault(row.candidate_ref, []).append(FrozenMap({
                'response_family_ref': 'spatial_translation',
                'response_ref': 'spatial-response:' + stable_digest(row),
                'observation_refs': (prediction.observation_ref,),
                'observable_signature': FrozenMap(signature), 'observable_descriptors': FrozenMap(descriptors)}))
    candidates, competing = {}, []
    for candidate in enumeration.rows if enumeration is not None and enumeration.complete else ():
        rows = tuple(sorted(variants.get(candidate.candidate_ref, ()), key=lambda row: row['response_ref']))
        differing, unbound = [], []
        for family in sorted({row['response_family_ref'] for row in rows}):
            responses = tuple(row for row in rows if row['response_family_ref'] == family)
            fields = {field for row in responses for field in row['observable_signature']}
            for field in sorted(fields):
                if any(field not in row['observable_signature'] for row in responses):
                    unbound.append(field)
                elif len({stable_digest(row['observable_signature'][field]) for row in responses}) > 1:
                    differing.append(field)
        if differing:
            competing.append(candidate.candidate_ref)
        current_controls = []
        for ref, measured in sorted(domain.current_control_candidates.get('rows', {}).items()):
            declared = control_projection.alternative_facts.get(ref, {}) if control_projection is not None else {}
            if declared.get('current_control_option') is not True:
                continue
            signature = ControlEvidenceSignature.model_validate(measured['signature'])
            if set(signature.receiver_refs) != set(candidate.participant_refs):
                continue
            historical = ControlEvidenceSignature.model_validate(prediction.historical_control_signature) if prediction else None
            refusal_refs = tuple(feedback_ref for feedback_ref, feedback in sorted(domain.commitment_feedback.get('rows', {}).items())
                if feedback['current_noncommitted'] and domain.request is not None
                and feedback['action_ref'] == domain.request.operator_ref
                and feedback['action_data'] == measured['action_data']
                and ControlEvidenceSignature.model_validate(feedback['control_signature']).response_recall_key()
                    == signature.response_recall_key())
            current_controls.append(FrozenMap({
                'proof_ref': ref, 'proof_digest': measured['proof_digest'], 'signature': measured['signature'],
                'action_data': measured['action_data'],
                'commitment_feedback_refs': refusal_refs,
                'current_commitment_refused': bool(refusal_refs),
                'historical_method_binding_matches': signature.response_recall_key() == historical.response_recall_key()
                    if historical is not None else None,
                'historical_payload_matches': measured['action_data'] == prediction.historical_action_data if prediction else None}))
        candidates[candidate.candidate_ref] = FrozenMap({
            'participant_refs': candidate.participant_refs, 'conditional_responses': rows,
            'response_distinguishing_observable_refs': tuple(differing),
            'unbound_response_observable_refs': tuple(unbound),
            'observed_response_domain_complete': False,
            'current_control_options': tuple(current_controls)})
    goal_rows, goal_missing = candidate_goal_consequence_rows(consequences, tuple(sorted(candidates)))
    measured = FrozenMap.overlay({'native_acquisition_returns': acquisitions,
        'native_acquisition_count': len(acquisitions),
        'native_acquisition_incomplete_count': sum(not row['complete_observation'] for _, row in sorted(acquisitions.items())),
        'native_acquisition_transient_count': sum(row['intermediate_change_measured'] for _, row in sorted(acquisitions.items()))}
        if domain.native_acquisition_required else {}, FrozenMap.overlay({'observed_recovery_preservation': preservation,
        'observed_recovery_contradicted_query_count': preservation['contradicted_query_count'],
        'observed_recovery_unknown_query_count': preservation['unknown_query_count']} if preservation is not None else {},
        FrozenMap.overlay({'observed_recovery_composition': composition,
        'observed_composed_return_count': composition['composed_return_count']} if composition is not None else {},
        FrozenMap({'domain_ref': domain.domain_ref, 'goal_ref': domain.goal_ref,
        'mechanism_ref': domain.mechanism_ref,
        'observed_recovery': recovery,
        'observed_inverse_count': recovery['observed_inverse_count'],
        'input_digest': stable_digest((domain, enumeration, prediction, consequences, control_projection)),
        'control_projection': immutable_json_data(control_projection) if control_projection is not None else None,
        'control_domain_complete': domain.current_control_candidates.get('complete', False),
        'control_binding_missing_refs': domain.current_control_candidates.get('missing_refs', ()),
        'commitment_feedback': domain.commitment_feedback,
        'all_current_application_options_refused': domain.commitment_feedback.get('complete') is True and bool(candidates)
            and all(row['current_control_options'] and all(option['current_commitment_refused']
                for option in row['current_control_options']) for _, row in sorted(candidates.items())),
        'application_domain_bound': domain.request is not None and enumeration is not None and enumeration.complete,
        'operator_ref': domain.request.operator_ref if domain.request is not None else None,
        'historical_operation': FrozenMap({
            'action_ref': prediction.historical_action_ref, 'action_data': prediction.historical_action_data,
            'control_signature': prediction.historical_control_signature,
            'current_control_and_payload_revalidated': False}) if prediction is not None else None,
        'candidates': FrozenMap(candidates), 'competing_response_candidate_refs': tuple(competing),
        'responses_differ_on_bound_observables': bool(competing),
        'goal_consequence_digest': stable_digest(consequences) if consequences is not None else None,
        'goal_consequence_rows': goal_rows,
        'goal_prediction_contract': goal_prediction_contract(prediction),
        'goal_consequence_missing_candidate_refs': goal_missing,
        'application_missing_refs': domain.missing_refs,
        'unmeasured_candidate_refs': tuple(sorted(prediction.uncalculated_candidates)) if prediction is not None else tuple(sorted(candidates)),
        'current_execution_bindings_present': False}))))
    return FrozenMap.overlay({'conditional_recovery_policy': measure_conditional_recovery_policy(domain, composition, preservation)},
        measured) if domain.conditional_recovery_policy_required else measured


def assemble_experiment_nomination(measured, projection, selected_ref):
    facts = projection.alternative_facts.get(selected_ref)
    if facts is None or facts.get('eligible') is not True:
        raise ValueError('experiment nomination requires its Source-selected DRM question')
    return OperationalConsciousnessExperimentNomination(
        nomination_ref='conscious-experiment-nomination:' + stable_digest((measured, projection, selected_ref)),
        domain_ref=measured['domain_ref'], goal_ref=measured['goal_ref'], mechanism_ref=measured['mechanism_ref'],
        measured=measured, projection=projection, source_disposition_ref=selected_ref,
        question_ref=facts['question_ref'], required_binding_refs=tuple(facts['required_binding_refs']))
