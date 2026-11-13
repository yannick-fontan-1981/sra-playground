"""Carry a conditional budget interval without replacing it with an exact amount."""
from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives
from agents.yf_arc3_v5.logos.operational_experiment_admission import OperationalConsciousnessCommandBudgetInterval
from agents.yf_arc3_v5.logos.types import immutable_json_data
from .conscious_experiment_resources import measure_experiment_resource_scope

POLICY = 'policy.conscious_experiment_resource_obligation'


def capture(measured, projection, policy_ref, policy_hash):
    rows = tuple(row for ref, row in sorted(measured['descriptive_by_ref'].items())
        if projection['alternative_facts'].get(ref, {}).get('budget_current') is True)
    if not measured['measurement_domain_complete'] or len(rows) != 1:
        return None
    row = rows[0]
    if row.get('conditional_remaining_lower') is None:
        return None
    return OperationalConsciousnessCommandBudgetInterval(
        lower=row['conditional_remaining_lower'], upper=row['conditional_remaining_upper'],
        intent_ref=measured['intent_ref'], timeline_ref=measured['timeline_ref'], frame_ref=measured['frame_ref'],
        solver_action_bound=measured['solver_remaining_action_bound'],
        measurement_ref=row['measurement_ref'], measurement_digest=row['measurement_digest'],
        proof_versions=row['proof_digests'], policy_ref=policy_ref, policy_hash=policy_hash)


def read_current(owner, request, *, timeline_ref, frame_ref):
    interval = request.command_budget_interval
    if owner is None or interval is None or interval.policy_ref != POLICY:
        return None
    from .conscious_continuation_review import read_continuation_review
    review = read_continuation_review(owner, request, current=True,
        timeline_ref=timeline_ref, frame_ref=frame_ref)
    if (review is None or review.intent_ref != interval.intent_ref
            or interval.timeline_ref != timeline_ref or interval.frame_ref != frame_ref):
        return None
    policy, loaded_policy = owner._drm.resolve(POLICY)
    policy_hash = loaded_policy.source_hash
    if policy_hash != interval.policy_hash:
        return None
    measured = measure_experiment_resource_scope(owner._store, intent_ref=interval.intent_ref,
        timeline_ref=timeline_ref, frame_ref=frame_ref, solver_action_bound=interval.solver_action_bound,
        configuration=policy.configuration)
    projected = project_declared_alternatives(drm=owner._drm, selection_policy_ref=POLICY,
        alternative_refs=measured['alternative_refs'], descriptive_facts=measured['descriptive_by_ref'])
    current = capture(measured, immutable_json_data(projected), POLICY, policy_hash)
    return interval if current == interval else None
