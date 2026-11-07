"""Read scoped response availability without confusing an observation with a law."""
from agents.yf_arc3_v5.capabilities.experiment_frontier_contracts_c import (
    ExperimentDecisionC, UnderstandingObservationReturn,
)
from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives
from agents.yf_arc3_v5.logos.operational_experiment_admission import OperationalConsciousnessResponseQuestionEvidence
from agents.yf_arc3_v5.logos.operations import OperationalUnderstandingAssessmentRecord
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .understanding_observation import measure_understanding_observation

POLICY = 'policy.conscious_native_response_question'


def identity(request, timeline_ref, frame_ref):
    goal = request.understanding_goal
    owner = ({'responsibility_owner_goal_ref': goal.responsibility_owner_goal_ref}
        if goal.responsibility_owner_goal_ref is not None else {})
    return FrozenMap({**owner, 'timeline_ref': timeline_ref, 'frame_ref': frame_ref, 'scope_ref': request.scope_ref,
        'epoch': request.epoch, 'goal_ref': goal.goal_ref, 'question_ref': request.question_ref,
        'operation_ref': request.operation_ref, 'context_signature': request.context_signature,
        'execution_digest': stable_digest(request.execution_contract),
        'observable_field_refs': request.observable_field_refs, 'stop_condition_refs': goal.stop_condition_refs})


def project(owner, measured):
    return project_declared_alternatives(drm=owner._drm, selection_policy_ref=POLICY,
        alternative_refs=(), descriptive_facts=measured)


def facts(evidence):
    rows = evidence.projection_facts['alternative_facts']
    if len(rows) != 1:
        raise ValueError('response question lost its single scoped interpretation')
    return rows[tuple(rows)[0]]


def measure(owner, evidence):
    key = evidence.identity
    policy, _ = owner._drm.resolve(POLICY)
    records = owner._store.operational_consciousness.understanding_question_observations(
        key['timeline_ref'], key['scope_ref'], key['epoch'], key['goal_ref'], key['question_ref'])
    complete = len(records) <= policy.configuration['maximum_observation_records']
    _, loaded_observation = owner._drm.resolve('policy.understanding_observation')
    observation_hash = loaded_observation.source_hash
    rows, signatures = {}, set()
    invalid = available = incompatible = incomplete = 0
    for assessment_ref, record in sorted(records.items()) if complete else ():
        assessment = owner._store.artifact(assessment_ref)
        source = owner._entries.get(record.workflow_definition_id)
        source_current = source is not None and source.transitive_source_hash == record.source_hash
        original = ExperimentDecisionC.model_validate(assessment.decision).frozen_request if isinstance(
            assessment, OperationalUnderstandingAssessmentRecord) else None
        compatible = original is not None and all((
            original.operation_ref == key['operation_ref'], original.context_signature == key['context_signature'],
            stable_digest(original.execution_contract) == key['execution_digest'],
            original.observable_field_refs == key['observable_field_refs'], original.open_response_domain is not None))
        current = response_complete = False
        signature = None
        if compatible:
            returned = UnderstandingObservationReturn.model_validate(record.returned)
            actual = measure_understanding_observation(owner._store, returned.request,
                timeline_ref=key['timeline_ref'], frame_ref=record.frame_id, owner=owner)
            projected = project_declared_alternatives(drm=owner._drm, selection_policy_ref='policy.understanding_observation',
                alternative_refs=(), descriptive_facts=actual.facts)
            selected = projected.alternative_facts.get(returned.source_disposition_ref, FrozenMap())
            current = (source_current and returned.source_policy_hash == observation_hash
                and returned.measured == actual and selected.get('eligible') is True
                and tuple(selected.get('observed_stop_condition_refs', ())) == returned.observed_stop_condition_refs)
            response_complete = current and not actual.missing_refs and bool(
                set(key['stop_condition_refs']) & set(returned.observed_stop_condition_refs))
            if response_complete:
                signature = stable_digest(actual.observed_signature)
                signatures.add(signature)
                available += 1
            elif current:
                incomplete += 1
            else:
                invalid += 1
        else:
            incompatible += 1
        rows[record.id] = FrozenMap({'assessment_ref': assessment_ref,
            'assessment_digest': stable_digest(assessment), 'observation_digest': stable_digest(record),
            'compatible': compatible, 'current': current, 'response_complete': response_complete,
            'signature_digest': signature})
    entry = owner._entries.get(evidence.source_workflow_ref)
    measured = FrozenMap({'producer_current': entry is not None and entry.transitive_source_hash == evidence.source_hash,
        'observation_domain_version': owner._store.operational_consciousness.understanding_question_observation_version(
            key['timeline_ref'], key['scope_ref'], key['epoch'], key['goal_ref'], key['question_ref']),
        'source_question_open': evidence.source_question_open, 'observation_domain_complete': complete,
        'observation_record_count': len(records), 'available_response_count': available,
        'distinct_response_count': len(signatures), 'unqualified_response_count': invalid,
        'incomplete_response_count': incomplete, 'incompatible_response_count': incompatible})
    return FrozenMap(rows), measured


def capture(owner, context, request, source_question_open):
    evidence = OperationalConsciousnessResponseQuestionEvidence(
        source_workflow_ref=context.workflow_definition_id,
        source_hash=context.operational_consciousness.context.source_hash,
        identity=identity(request, context.timeline_id, context.frame_id), source_question_open=source_question_open,
        observations=FrozenMap(), measured_facts=FrozenMap(), projection_facts=FrozenMap(),
        policy_hash=owner._drm.resolve(POLICY)[1].source_hash)
    rows, measured = measure(owner, evidence)
    evidence = evidence.model_copy(update={'observations': rows, 'measured_facts': measured,
        'projection_facts': immutable_json_data(project(owner, measured))})
    return request.model_copy(update={'native_question_evidence': evidence,
        'question_currently_unanswered': facts(evidence)['question_currently_unanswered']})


def read_current(owner, request, *, timeline_ref, frame_ref):
    evidence = request.native_question_evidence
    if owner is None or evidence is None:
        return None
    from .conscious_continuation_review import read_continuation_review
    review = read_continuation_review(owner, request, current=True, timeline_ref=timeline_ref, frame_ref=frame_ref)
    if (review is None or evidence.identity != identity(request, timeline_ref, frame_ref)
            or evidence.policy_hash != owner._drm.resolve(POLICY)[1].source_hash):
        return None
    rows, measured = measure(owner, evidence)
    if (rows != evidence.observations or measured != evidence.measured_facts
            or immutable_json_data(project(owner, measured)) != evidence.projection_facts
            or request.question_currently_unanswered is not facts(evidence)['question_currently_unanswered']):
        return None
    return evidence
