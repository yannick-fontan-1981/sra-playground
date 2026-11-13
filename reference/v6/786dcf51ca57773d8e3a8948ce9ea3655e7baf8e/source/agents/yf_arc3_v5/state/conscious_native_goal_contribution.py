"""Requalify and transport actual DRM consequence reasons for the prepared scope."""
from agents.yf_arc3_v5.logos.operational_experiment_admission import OperationalConsciousnessGoalContributionEvidence
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .conscious_native_question import identity
from .conscious_native_recovery import bind_current_native_application
from agents.yf_arc3_v5.capabilities.conscious_application_consequences import candidate_goal_consequence_rows, goal_prediction_contract

POLICY = 'policy.conscious_application_consequences'


def measure(owner, evidence):
    _, bound, application, _, candidates = bind_current_native_application(owner, evidence)
    consequences = application.consequences if bound else None
    rows, missing = candidate_goal_consequence_rows(consequences, evidence.candidate_refs)
    contract = goal_prediction_contract(application.prediction if bound else None)
    return bound, rows, missing, contract


def capture(owner, context, request, receipt, native, signature):
    evidence = OperationalConsciousnessGoalContributionEvidence(
        source_workflow_ref=context.workflow_definition_id,
        source_hash=context.operational_consciousness.context.source_hash,
        identity=identity(request, context.timeline_id, context.frame_id),
        native_review_ref=native.id, native_review_digest=stable_digest(native), owner_goal_ref=receipt.goal_ref,
        nomination_ref=receipt.nomination_ref, domain_ref=receipt.domain_ref,
        candidate_refs=receipt.candidate_refs, control_signature=immutable_json_data(signature),
        contribution_rows=FrozenMap(), prediction_contract=FrozenMap(),
        missing_candidate_refs=(), policy_hash=owner._drm.resolve(POLICY)[1].source_hash)
    _, rows, missing, contract = measure(owner, evidence)
    evidence = evidence.model_copy(update={'contribution_rows': rows,
        'missing_candidate_refs': missing, 'prediction_contract': contract})
    goal = request.understanding_goal
    if goal is None or goal.responsibility_owner_goal_ref != evidence.owner_goal_ref:
        raise ValueError('native contribution capture lost its understanding responsibility owner')
    return request.model_copy(update={'native_goal_contribution_evidence': evidence,
        'understanding_goal': goal.model_copy(update={
            'possible_beneficiary_goal_refs': evidence.declared_possible_beneficiaries()})})


def read_current(owner, request, *, timeline_ref, frame_ref):
    evidence = request.native_goal_contribution_evidence
    if owner is None or evidence is None:
        return None
    from .conscious_continuation_review import read_continuation_review
    review = read_continuation_review(owner, request, current=True, timeline_ref=timeline_ref, frame_ref=frame_ref)
    if (review is None or evidence.identity != identity(request, timeline_ref, frame_ref)
            or evidence.policy_hash != owner._drm.resolve(POLICY)[1].source_hash):
        return None
    try:
        bound, rows, missing, contract = measure(owner, evidence)
    except (KeyError, TypeError, ValueError):
        return None
    if (not bound or rows != evidence.contribution_rows or missing != evidence.missing_candidate_refs
            or contract != evidence.prediction_contract):
        return None
    goal = request.understanding_goal
    if goal is not None and goal.responsibility_owner_goal_ref is not None and (
            goal.responsibility_owner_goal_ref != evidence.owner_goal_ref
            or goal.possible_beneficiary_goal_refs != evidence.declared_possible_beneficiaries()):
        return None
    return evidence
