"""Measure a declared experiment's actual interval through existing canonical fields."""
from agents.yf_arc3_v5.capabilities.experiment_frontier_contracts_c import (
    ExperimentDecisionC, UnderstandingObservationMeasurement,
)
from agents.yf_arc3_v5.logos.operations import (
    ActionIntent, ActionObservedRecord, ActionReleasePermit, EnvironmentActionDispatchedRecord,
    ObservationAcquiredRecord, OperationalUnderstandingAssessmentRecord,
)
from agents.yf_arc3_v5.logos.types import FrozenMap
from .observed_canonical_field_reader_b import read_observed_canonical_field
from .released_observation import read_released_observation
from agents.yf_arc3_v5.logos.operational_acquisition import OperationalExperimentParticipantObservable
from .conscious_acquisition_observables import read_participant_observables
from agents.yf_arc3_v5.capabilities.conscious_experiment_predictions import (
    measure_observable_compatibility, classify_observed_response,
)


def measure_understanding_observation(store, request, *, timeline_ref, frame_ref, owner=None):
    missing = []
    evidence = [request.assessment_ref]
    signature = {}
    models = ()
    matching = ()
    mismatching = ()
    unassessed = ()
    open_models = ()
    open_response = False
    observed_primitive_count = None
    observed_cost_ceiling = None
    native_binding_refs = []
    question = goal = None
    assessment = store.artifact(request.assessment_ref)
    if not isinstance(assessment, OperationalUnderstandingAssessmentRecord):
        missing.append('understanding.canonical_assessment')
    else:
        decision = ExperimentDecisionC.model_validate(assessment.decision)
        original = decision.frozen_request
        if original.understanding_goal is not None:
            observed_cost_ceiling = original.understanding_goal.maximum_recovery_inclusive_cost
        open_response = original.open_response_domain is not None
        question, goal, models = assessment.question_ref, assessment.goal_ref, original.model_refs
        if len(set(models)) != len(models):
            missing.append('understanding.unique_declared_models')
            models = tuple(sorted(set(models)))
        if (not store.operational_consciousness.understanding_assessment_is_current_ancestor(assessment)
                or assessment.timeline_id != timeline_ref
                or assessment.scope_ref != request.scope_ref or assessment.epoch != request.epoch):
            missing.append('understanding.exact_current_question_scope')
        execution = original.execution_contract
        if execution is None:
            missing.append('understanding.prior_execution_and_observation_contract')
        else:
            observed_refs = request.action_observed_refs
            if len(set(observed_refs)) != len(observed_refs) or len(observed_refs) != len(execution.actions):
                missing.append('understanding.complete_ordered_action_interval')
            before_frame = assessment.frame_id
            preceding_sequence = store.artifact_sequence(assessment.id)
            final_acquisition = None
            for ordinal, (ref, expected) in enumerate(zip(observed_refs, execution.actions)):
                observed = store.artifact(ref)
                if not isinstance(observed, ActionObservedRecord):
                    missing.append(f'understanding.actual_action_observation.{ordinal}')
                    continue
                intent = store.artifact(observed.action_intent_id)
                dispatch = store.artifact(observed.environment_action_event_ref)
                acquired = store.artifact(observed.observation_record_id)
                permit = store.artifact(observed.action_release_permit_id)
                order = tuple(store.artifact_sequence(identity) for identity in (
                    assessment.id, observed.action_intent_id, observed.action_release_permit_id,
                    observed.environment_action_event_ref, observed.observation_record_id, observed.id))
                ordered = (preceding_sequence is not None and all(value is not None for value in order)
                    and order[0] < order[3] and order[1] < order[3] and order[2] < order[3]
                    and preceding_sequence < order[3] < order[4] < order[5])
                evidence.extend((ref, observed.action_intent_id, observed.environment_action_event_ref,
                    observed.observation_record_id, observed.action_release_permit_id))
                released = read_released_observation(store, observed.id,
                    timeline_ref=timeline_ref, frame_ref=observed.frame_id)
                native_bound = False
                if released['binding'] is not None and intent.discriminating_experiment_ref != original.experiment_ref:
                    from .conscious_native_experiment import read_native_observation_binding
                    native = read_native_observation_binding(owner, intent, permit, assessment.id)
                    native_bound = native['bound']
                    if native_bound:
                        native_binding_refs.extend(native['matching_receipt_refs'])
                        evidence.extend(native['evidence_refs'])
                    else:
                        missing.extend(native['missing_refs'])
                valid = (released['binding'] is not None
                    and (intent.discriminating_experiment_ref == original.experiment_ref or native_bound)
                    and ordered
                    and intent.action_ref == expected.action_ref
                    and intent.action_data == expected.action_data
                    and intent.frame_id == before_frame)
                if not valid:
                    missing.extend(released['missing_refs'])
                    missing.append(f'understanding.exact_released_response_chain.{ordinal}')
                    continue
                before_frame = acquired.frame_id
                preceding_sequence = order[5]
                final_acquisition = acquired
            if final_acquisition is None or final_acquisition.frame_id != frame_ref:
                missing.append('understanding.actual_terminal_acquisition')
            # This proof precedes interpretation of the response. Unknown visual
            # fields do not erase a completely verified physical command interval.
            if not missing:
                observed_primitive_count = len(observed_refs)
            supplied = {field.field_ref: field for field in request.fields}
            expected_fields = {field.field_ref: field for field in execution.observables}
            canonical_fields = {name for name, item in sorted(expected_fields.items())
                if not isinstance(item, OperationalExperimentParticipantObservable)}
            if len(supplied) != len(request.fields) or set(supplied) != canonical_fields:
                missing.append('understanding.exact_observable_field_set')
            if final_acquisition is not None and final_acquisition.frame_id == frame_ref:
                for name, specification in sorted(expected_fields.items()):
                    if isinstance(specification, OperationalExperimentParticipantObservable):
                        continue
                    field = supplied.get(name)
                    if field is None:
                        continue
                    read = read_observed_canonical_field(store,
                        {'term_ref': field.term_ref, 'support_claim_ref': field.support_claim_ref,
                         'attribute_path': specification.attribute_path},
                        {'observation_record_ref': final_acquisition.id, 'frame_ref': frame_ref,
                         'expected_claim_scope': FrozenMap({'scope_ref': request.scope_ref, 'epoch': request.epoch}),
                         'support_predicate': specification.support_predicate,
                         'acquired_source_kind_ref': specification.acquired_source_kind_ref,
                         'accepted_evidence_status_refs': ('supported', 'established')})
                    if not read['field_binding_current']:
                        missing.extend(str(reason) + ':' + name for reason in read['missing_refs'])
                    else:
                        signature[name] = read['value']
                        evidence.extend(read['evidence_refs'])
                tracked = tuple(item for item in execution.observables if isinstance(item, OperationalExperimentParticipantObservable))
                observed = read_participant_observables(owner, tracked, timeline_ref=timeline_ref, frame_ref=frame_ref)
                signature.update(observed['observed_signature'])
                missing.extend(observed['missing_refs'])
                evidence.extend(observed['evidence_refs'])
            if not open_response:
                compatibility = measure_observable_compatibility(original.predictions, models, tuple(expected_fields))
                if not compatibility['coverage_complete'] or not compatibility['observable_contract_complete']:
                    missing.append('understanding.complete_prior_predictions')
            elif original.open_response_domain.observable_field_refs != tuple(expected_fields):
                missing.append('understanding.exact_open_response_fields')
            if not missing and not open_response:
                classified = classify_observed_response(original.predictions, models, FrozenMap(signature))
                matching, mismatching = classified['matching_model_refs'], classified['mismatching_model_refs']
                unassessed, open_models = classified['unassessed_model_refs'], classified['open_prediction_model_refs']
    complete = not missing
    return UnderstandingObservationMeasurement(assessment_ref=request.assessment_ref, question_ref=question,
        goal_ref=goal, observed_signature=FrozenMap(signature), matching_model_refs=matching,
        mismatching_model_refs=mismatching, unassessed_model_refs=models if missing else unassessed,
        open_prediction_model_refs=open_models,
        evidence_refs=tuple(sorted(set(evidence))), missing_refs=tuple(sorted(set(missing))),
        facts=FrozenMap({'observation_incomplete': not complete,
            'observed_primitive_count': observed_primitive_count,
            'observed_cost_ceiling': observed_cost_ceiling,
            'observed_cost_limit_reached': observed_primitive_count is not None
                and observed_cost_ceiling is not None and observed_primitive_count >= observed_cost_ceiling,
            'observed_primitive_count_establishes_recovery_cost': False,
            'native_response_binding_refs': tuple(native_binding_refs),
            'native_observation_proves_independent_admission': False,
            'observed_open_response': complete and open_response,
            'observed_model_gap': complete and not open_response and not matching and not unassessed,
            'observed_model_ambiguity': complete and (open_response or len(matching) > 1 or bool(open_models)),
            'observed_model_distinction': complete and len(matching) == 1 and not open_models,
            'observed_prediction_domains_open': complete and bool(open_models)}))
