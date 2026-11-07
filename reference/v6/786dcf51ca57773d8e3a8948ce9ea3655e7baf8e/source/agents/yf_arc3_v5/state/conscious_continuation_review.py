"""Canonical scoped continuation reviews, with past evidence distinct from current admission."""
from agents.yf_arc3_v5.capabilities.experiment_frontier_contracts_c import ExperimentFrontierInputC
from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives
from agents.yf_arc3_v5.logos.operations import OperationalConsciousnessContinuationReviewRecord
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .conscious_selection_frontier import measure_frozen_selection_frontier, selection_frontier_source_current
from .native_admission_witness import retained_witness_matches
from .conscious_engagement import retained_engagement_measurement


POLICY = 'policy.conscious_native_continuation_review'


def project_continuation_review(drm, measured):
    return project_declared_alternatives(drm=drm, selection_policy_ref=POLICY,
        alternative_refs=(), descriptive_facts=measured)


def review_facts(record):
    rows = record.projection_facts['alternative_facts']
    if len(rows) != 1:
        raise ValueError('native continuation review requires its exact single declared domain')
    return rows[tuple(sorted(rows))[0]]


def apply_continuation_review(raw, record, drm=None):
    request = ExperimentFrontierInputC.model_validate(raw)
    facts = review_facts(record)
    goal_changes = {'timing': facts['understanding_timing']}
    allocation = {}
    if drm is not None:
        from .conscious_curiosity_allowance import allocate
        allowance = allocate(request, record, facts, drm)
        allocation['native_curiosity_allowance'] = allowance
        goal_changes['maximum_recovery_inclusive_cost'] = allowance.maximum_recovery_inclusive_cost
        goal_changes['cost_scope_ref'] = allowance.cost_scope_ref
        goal_changes['cost_scope_digest'] = allowance.cost_scope_digest
    return immutable_json_data(request.model_copy(update={
        **allocation,
        'native_continuation_review_ref': record.id,
        'incoming_engagement_review': retained_engagement_measurement(record),
        'native_continuation_disposition': facts,
        'continuation_review': facts['continuation_review'],
        'understanding_goal': request.understanding_goal.model_copy(update=goal_changes),
        'support_evidence_refs': tuple(dict.fromkeys((*request.support_evidence_refs, record.id)))}))


def read_continuation_review(owner, request, *, current=False, timeline_ref=None, frame_ref=None):
    if owner is None or request.native_continuation_review_ref is None:
        return None
    record = owner._store.artifact(request.native_continuation_review_ref)
    if not isinstance(record, OperationalConsciousnessContinuationReviewRecord):
        return None
    if (request.incoming_engagement_review is not None
            and request.incoming_engagement_review.dependency_review is not None
            and request.native_continuation_disposition is None):
        return None
    entry = owner._entries.get(record.workflow_definition_id)
    identity = record.identity
    execution = request.execution_contract
    if (entry is None or entry.transitive_source_hash != record.source_hash
            or (record.selection_frontier is not None and not selection_frontier_source_current(owner, record.selection_frontier))
            or record.review_policy_hash != owner._drm.resolve(POLICY)[1].source_hash
            or not retained_witness_matches(record, request)
            or immutable_json_data(project_continuation_review(owner._drm, record.measured_facts)) != record.projection_facts
            or request.scope_ref != 'native-experiment-scope:' + stable_digest(identity['execution_scope'])
            or record.id not in request.support_evidence_refs
            or execution is None or len(execution.actions) != 1
            or execution.actions[0].action_ref != identity['action_ref']
            or execution.actions[0].action_data != identity['action_data']
            or request.continuation_review != review_facts(record)['continuation_review']
            or request.incoming_engagement_review != retained_engagement_measurement(record)
            or (request.native_continuation_disposition is not None and request.native_continuation_disposition != review_facts(record))
            or request.understanding_goal is None
            or request.understanding_goal.timing != review_facts(record)['understanding_timing']):
        return None
    if current and (record.timeline_id != timeline_ref or record.frame_id != frame_ref
            or record.measured_facts != measure_frozen_selection_frontier(owner, record.selection_frontier, identity)):
        return None
    if request.native_curiosity_allowance is not None:
        from .conscious_curiosity_allowance import allocate
        expected = allocate(request, record, review_facts(record), owner._drm)
        if (request.native_curiosity_allowance != expected
                or request.understanding_goal.maximum_recovery_inclusive_cost != expected.maximum_recovery_inclusive_cost
                or request.understanding_goal.cost_scope_ref != expected.cost_scope_ref
                or request.understanding_goal.cost_scope_digest != expected.cost_scope_digest):
            return None
    return record
