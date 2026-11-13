"""Transport qualified native acquisition data into the shared experiment contract."""
from agents.yf_arc3_v5.capabilities.experiment_frontier_contracts_c import (
    ExperimentFrontierInputC, ExperimentDecisionC, OperationalUnderstandingGoal,
)
from agents.yf_arc3_v5.logos.operations import (
    OperationalUnderstandingAssessmentRecord, OperationalUnderstandingConsumptionRecord,
    OperationalConsciousnessReevaluationRecord,
)
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from agents.yf_arc3_v5.logos.operational_assessment_read import OperationalConsciousnessAssessmentRead
from .experiment_admission import current_admission_obligations, experiment_policy_fingerprint
from .conscious_continuation_review import read_continuation_review


def native_understanding_identity(execution_scope, goal_ref, domain_ref, question_ref):
    """Shared producer/feedback identity; unrelated goals cannot inherit a refusal."""
    scope = 'native-experiment-scope:' + stable_digest(execution_scope)
    return scope, 'native-understanding:' + stable_digest((scope, goal_ref, domain_ref, question_ref))


def assemble_native_request(intent, receipt, native_review, facts, preparation_evidence=None):
    acquisition = receipt.acquisition_contract
    domain = acquisition.open_response_domain
    scope, understanding_ref = native_understanding_identity(acquisition.execution_scope,
        acquisition.goal_ref, acquisition.domain_ref, acquisition.question_ref)
    epoch = native_review.state_revision
    contribution = intent.operational_consciousness.responsibility.contribution
    constraints = tuple(dict.fromkeys((*contribution.preserve_constraint_refs, *contribution.overshoot_constraint_refs)))
    goal = OperationalUnderstandingGoal(
        goal_ref=understanding_ref,
        question_ref=acquisition.question_ref, scope_ref=scope, epoch=epoch, model_refs=(),
        open_response_domain=domain, observable_field_refs=domain.observable_field_refs,
        information_reason_ref=facts['information_reason_ref'], falsifier_refs=domain.falsifier_refs,
        preserve_constraint_refs=constraints, stop_condition_refs=tuple(facts['stop_condition_refs']), maximum_recovery_inclusive_cost=None,
        timing=facts['understanding_timing'], responsibility_owner_goal_ref=acquisition.goal_ref,
        possible_beneficiary_goal_refs=())
    resource = receipt.resource_return
    from .conscious_command_budget import capture as capture_budget
    interval = capture_budget(resource.measured, resource.projection, resource.policy_ref, resource.policy_hash) if resource else None
    # Keep the exact field exact. A conditional interval remains a separate witness.
    budget = interval.lower if interval is not None and interval.lower == interval.upper else None
    from .conscious_native_preparation import facts as preparation_facts, preservation_bindings
    prepared_facts = preparation_facts(preparation_evidence) if preparation_evidence is not None else FrozenMap()
    preparation_supports = tuple(preparation_evidence.premise_versions) if prepared_facts.get('preconditions_current') is True else ()
    if prepared_facts.get('protected_conditions_current') is True:
        preparation_supports = (*preparation_supports, preparation_evidence.source_viability_ref)
    supports = tuple(dict.fromkeys((*domain.support_evidence_refs, *preparation_supports,
        *(tuple(interval.proof_versions) if interval is not None else ()))))
    return ExperimentFrontierInputC(
        experiment_ref='native-experiment:' + stable_digest((native_review.id, acquisition.contract_ref)),
        operation_ref=intent.action_ref, purpose=facts['purpose'], question_kind=facts['question_kind'],
        parent_goal_ref=None, utility_reason_ref=None, understanding_goal=goal,
        execution_contract=acquisition.execution, continuation_review=facts['continuation_review'],
        native_preparation_evidence=preparation_evidence,
        preservation_evidence_by_constraint=preservation_bindings(preparation_evidence) if preparation_evidence is not None else FrozenMap(),
        question_ref=acquisition.question_ref, question_currently_unanswered=None,
        epoch=epoch, evidence_revision_ref=native_review.id, scope_ref=scope,
        support_epoch=epoch, support_revision_ref=native_review.id, support_scope_ref=scope,
        support_evidence_refs=supports, context_signature=domain.context_signature,
        model_refs=(), open_response_domain=domain, observation_contract_ref=acquisition.contract_ref,
        observable_field_refs=domain.observable_field_refs, robust_contribution_ref=None,
        robust_contribution_current=False, observed_whole_code_ref=None, requested_code_scope='WHOLE',
        composition_evidence_ref=None, preconditions_current=prepared_facts.get('preconditions_current') is True,
        protected_conditions_current=prepared_facts.get('protected_conditions_current') is True,
        manual_contract=None, destructive=None, consumed_command_cost=len(acquisition.execution.actions),
        lost_progress_cost=None, recovery_route_cost=None, irreversible_population_loss=None,
        irreversible_material_loss=None, remaining_command_budget=budget,
        command_budget_interval=interval, actual_costs_known=False)


def inspect_native_assessment_link(owner, receipt):
    """Return exact failed bindings as data, including malformed retained contracts.

    Source consumes these measurements through the existing preparation-refusal
    path. Neither successful reading nor diagnostic recovery grants an action.
    """
    link, acquisition = receipt.frontier_assessment, receipt.acquisition_contract
    identity = dict(receipt_ref=receipt.return_ref,
        assessment_ref=link.assessment_ref if link is not None else None,
        consumption_ref=link.consumption_ref if link is not None else None)
    missing = tuple(ref for ref, absent in (
        ('assessment.link', link is None), ('assessment.acquisition_contract', acquisition is None),
        ('assessment.reader_owner', owner is None)) if absent)
    if missing:
        return OperationalConsciousnessAssessmentRead(**identity, failed_check_refs=missing)
    try:
        return _inspect_native_assessment_link(owner, receipt, identity)
    except (KeyError, TypeError, ValueError) as error:
        # Do not serialize an exception message containing a whole frozen request.
        return OperationalConsciousnessAssessmentRead(**identity,
            failed_check_refs=('assessment.retained_contract_readable',),
            contract_error_kind=type(error).__name__)


def _inspect_native_assessment_link(owner, receipt, identity):
    link, acquisition = receipt.frontier_assessment, receipt.acquisition_contract
    store = owner._store
    assessment = store.artifact(link.assessment_ref)
    consumption = store.artifact(link.consumption_ref)
    review = store.artifact(receipt.native_review_ref)
    missing = tuple(ref for ref, valid in (
        ('assessment.producer_record', isinstance(assessment, OperationalUnderstandingAssessmentRecord)),
        ('assessment.consumption_record', isinstance(consumption, OperationalUnderstandingConsumptionRecord)),
        ('assessment.native_review_record', isinstance(review, OperationalConsciousnessReevaluationRecord))) if not valid)
    if missing:
        return OperationalConsciousnessAssessmentRead(**identity, failed_check_refs=missing)
    entry = owner._entries.get(assessment.workflow_definition_id)
    decision = ExperimentDecisionC.model_validate(assessment.decision)
    request = decision.frozen_request
    canonical = request.canonical_evidence
    continuation = read_continuation_review(owner, request)
    policy_hash = experiment_policy_fingerprint(owner._drm)
    checks = (
        ('assessment.source_current', entry is not None and entry.transitive_source_hash == assessment.source_hash),
        ('assessment.continuation_review', request.native_continuation_review_ref is None or continuation is not None),
        ('assessment.policy_identity', decision.source_policy_ref == 'policy.experiment_frontier_c'),
        ('assessment.input_signature', assessment.input_signature == stable_digest((request, assessment.source_hash, policy_hash, canonical))),
        ('assessment.consumption_source', consumption.source_hash == assessment.source_hash),
        ('assessment.consumption_producer', consumption.assessment_ref == assessment.id),
        ('assessment.consumption_input', consumption.input_signature == assessment.input_signature),
        ('assessment.producer_timeline', assessment.timeline_id == receipt.timeline_ref),
        ('assessment.consumer_timeline', consumption.timeline_id == receipt.timeline_ref),
        ('assessment.producer_frame', assessment.frame_id == receipt.frame_ref),
        ('assessment.consumer_frame', consumption.frame_id == receipt.frame_ref),
        ('assessment.decision_producer', decision.understanding_record_ref == assessment.id),
        ('assessment.request_digest', stable_digest(request) == link.request_digest),
        ('assessment.link_disposition', decision.source_disposition_ref == link.source_disposition_ref),
        ('assessment.consumed_disposition', consumption.source_disposition_ref == decision.source_disposition_ref),
        ('assessment.unavailable_evidence', canonical is not None and consumption.unavailable_evidence_refs == canonical.unavailable_refs),
        ('assessment.missing_costs', consumption.cost_missing_fields == tuple(decision.frozen_measurement.facts.get('cost_missing_fields', ()))),
        ('assessment.consumed_obligations', consumption.admission_obligations == decision.admission_obligations),
        ('assessment.consumed_reasoning', decision.conscious_reasoning_basis_digest is not None
            and consumption.conscious_reasoning_basis_digest == decision.conscious_reasoning_basis_digest),
        ('assessment.consumed_contribution', consumption.goal_contribution_review == decision.goal_contribution_review),
        ('assessment.current_obligations', decision.admission_obligations == current_admission_obligations(owner._drm, decision.frozen_measurement)),
        ('assessment.nomination', link.nomination_ref == receipt.nomination_ref),
        ('assessment.acquisition_identity', link.acquisition_contract_ref == acquisition.contract_ref),
        ('assessment.review_identity', request.evidence_revision_ref == review.id),
        ('assessment.review_epoch', request.epoch == review.state_revision),
        ('assessment.execution_scope', request.scope_ref == 'native-experiment-scope:' + stable_digest(acquisition.execution_scope)),
        ('assessment.execution_contract', request.execution_contract == acquisition.execution),
        ('assessment.response_domain', request.open_response_domain == acquisition.open_response_domain),
        ('assessment.question', request.question_ref == acquisition.question_ref),
        ('assessment.responsibility_owner', request.understanding_goal is not None
            and request.understanding_goal.responsibility_owner_goal_ref == acquisition.goal_ref
            and receipt.goal_ref == acquisition.goal_ref),
    )
    failed = tuple(ref for ref, valid in checks if not valid)
    if failed:
        return OperationalConsciousnessAssessmentRead(**identity, failed_check_refs=failed)
    return OperationalConsciousnessAssessmentRead(**identity, bound_return=FrozenMap({'assessment_ref': assessment.id, 'consumption_ref': consumption.id,
        'request_digest': link.request_digest, 'source_disposition_ref': decision.source_disposition_ref,
        'unavailable_evidence_refs': consumption.unavailable_evidence_refs,
        'cost_missing_fields': consumption.cost_missing_fields,
        'admission_obligations': tuple(item.model_dump(mode='python') for item in consumption.admission_obligations),
        'conscious_reasoning_basis_digest': consumption.conscious_reasoning_basis_digest,
        'goal_contribution_review': consumption.goal_contribution_review,
        'continuation_review_ref': request.native_continuation_review_ref,
        'continuation_review': request.continuation_review,
        'understanding_timing': request.understanding_goal.timing if request.understanding_goal is not None else None,
        'accompanying_action_admitted_by_this_assessment': False, 'grants_action': False}))


def read_native_assessment_link(owner, receipt):
    """Compatibility reader; diagnostic consumers use inspect_native_assessment_link."""
    return inspect_native_assessment_link(owner, receipt).bound_return


def native_assessment_candidates(store, intent, timeline_ref):
    """Index candidates from actual intent links; full qualification is deferred to the reader."""
    result = {}
    for receipt in (*intent.operational_experiment_control_returns, *intent.inherited_experiment_control_returns):
        link = receipt.frontier_assessment
        if link is None or receipt.timeline_ref != timeline_ref or receipt.frame_ref != intent.frame_id:
            continue
        assessment = store.artifact(link.assessment_ref)
        consumption = store.artifact(link.consumption_ref)
        if (isinstance(assessment, OperationalUnderstandingAssessmentRecord)
                and isinstance(consumption, OperationalUnderstandingConsumptionRecord)
                and assessment.timeline_id == consumption.timeline_id == timeline_ref
                and assessment.frame_id == consumption.frame_id == intent.frame_id
                and consumption.assessment_ref == assessment.id):
            result[assessment.id] = assessment
    return tuple(record for _, record in sorted(result.items()))


def read_native_observation_binding(owner, intent, permit, assessment_ref):
    """Accept one exact native question linkage, including a qualified singleton series."""
    if owner is None:
        return FrozenMap({'bound': False, 'evidence_refs': (), 'matching_receipt_refs': (),
            'missing_refs': ('assessment.reader_owner',)})
    from .conscious_application_observation import _receipt_action_origin
    matches, failures = {}, []
    for receipt in (*intent.operational_experiment_control_returns, *intent.inherited_experiment_control_returns):
        link = receipt.frontier_assessment
        if (link is None or link.assessment_ref != assessment_ref
                or receipt.action_ref != intent.action_ref or receipt.action_data != intent.action_data
                or receipt.timeline_ref != intent.timeline_id or receipt.frame_ref != intent.frame_id
                or not _receipt_action_origin(owner, receipt, intent, permit)):
            continue
        reading = inspect_native_assessment_link(owner, receipt)
        if reading.bound_return is not None:
            from .conscious_acquisition_observables import read_participant_observables
            acquisition = receipt.acquisition_contract
            before = read_participant_observables(owner, acquisition.execution.observables,
                timeline_ref=intent.timeline_id, frame_ref=intent.frame_id,
                before_sequence=owner._store.artifact_sequence(intent.id),
                frozen_record_refs=acquisition.prior_observation_refs)
            if (before['observed_signature'] == acquisition.before_signature
                    and before['missing_refs'] == acquisition.before_missing_refs):
                matches[stable_digest(receipt)] = receipt
            else:
                failures.append('assessment.prior_observation_signature')
        else:
            failures.extend(reading.failed_check_refs)
    return FrozenMap({'bound': len(matches) == 1,
        'missing_refs': () if len(matches) == 1 else tuple(dict.fromkeys((*failures,
            'assessment.unique_native_observation_binding'))),
        'matching_receipt_refs': tuple(row.return_ref for _, row in sorted(matches.items())),
        'evidence_refs': tuple(sorted({ref for _, row in sorted(matches.items())
            for ref in (row.frontier_assessment.consumption_ref, row.native_review_ref)})) if len(matches) == 1 else ()})
