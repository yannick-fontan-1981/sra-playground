"""Local Python disposition of an already measured child return.

No active context, inference of a goal, or action authority is created here.
The caller retains canonical receipts and performs the existing release checks.
"""
from collections.abc import Mapping

from agents.yf_arc3_v5.logos.types import FrozenMap


def decide_parent_child_return(facts: Mapping) -> FrozenMap:
    """Consume only the exact current dependency effect, without a metaplan.

    Inputs are the existing measured return and qualified parent facts. A child
    answer alone never establishes an effect or satisfies its parent condition.
    Missing evidence prevents acceptance; unrelated dependencies are untouched.
    """
    required = all(facts.get(key) is True for key in (
        'child_return_present', 'parent_scope_matches',
        'parent_continuity_allows_candidate',
        'child_return_matches_required_dependency',
    ))
    result = {
        'applicable': True,
        'child_effect_consumption_required': required,
        'child_effect_consumption_accepted': False,
        'child_effect_consumption_grants_act': False,
        'child_effect_applied_dependency_refs': (),
        'child_effect_enabled_continuation_refs': (),
        'child_effect_repair_requirement_refs': (),
    }
    if not required:
        return FrozenMap(result)

    result.update({
        'child_effect_consumption_disposition_ref':
            'child_effect.refused_current_dependency_unproved',
        'child_effect_continuation_allowed': False,
        'child_effect_requires_revalidation': True,
        'child_effect_repair_requirement_refs':
            ('requirement.revalidate_exact_child_effect_and_remaining_dependencies',),
    })
    effect_count = facts.get('child_return_effect_claim_count')
    prerequisite_count = facts.get('child_return_prerequisite_count')
    accepted = (
        all(facts.get(key) is True for key in (
            'child_return_canonical', 'child_return_scope_matches',
            'child_return_parent_matches', 'parent_continuity_allows_candidate',
        ))
        and type(effect_count) is int and effect_count > 0
        and facts.get('child_return_current_effect_claim_count') == effect_count
        and type(prerequisite_count) is int and prerequisite_count > 0
        and facts.get('child_return_completed_prerequisite_count') == prerequisite_count
        and bool(facts.get('child_return_dependency_refs'))
        and bool(facts.get('child_return_candidate_refs'))
    )
    if accepted:
        result.update({
            'child_effect_consumption_accepted': True,
            'child_effect_consumption_disposition_ref':
                'child_effect.consumed_for_current_parent_continuation',
            'child_effect_continuation_allowed': True,
            'child_effect_requires_revalidation': False,
            'child_effect_repair_requirement_refs': (),
            'child_effect_applied_dependency_refs':
                tuple(facts['child_return_dependency_refs']),
            'child_effect_enabled_continuation_refs':
                tuple(facts['child_return_candidate_refs']),
        })
    return FrozenMap(result)


def canonical_closed_child_attempt(store, activation):
    """Read a declared closed attempt from its canonical activated SRC return.

    The historical result carries no current execution authority. No journal
    scan or inferred goal/disposition is involved.
    """
    from agents.yf_arc3_v5.logos.operations import ContributionConsumptionRecord
    from agents.yf_arc3_v5.scheduler.contracts import WorkflowInstanceRecord
    from agents.yf_arc3_v5.scheduler.contribution_contract import ChildContributionReturn
    from agents.yf_arc3_v5.scheduler.source_return import read_source_return, SourceReturnContractError
    from agents.yf_arc3_v5.logos.types import stable_digest
    from pydantic import ValidationError
    if (not isinstance(activation, ContributionConsumptionRecord)
            or not activation.accepted or activation.prior_consumption_ref is None
            or activation.comparison_facts.get('return_source_terminal_matches') is not True):
        return None
    evidence = activation.comparison_facts.get('return_source_terminal_evidence', {})
    checkpoint_ref = evidence.get('source_checkpoint_ref')
    checkpoint = store.artifact(checkpoint_ref) if isinstance(checkpoint_ref, str) else None
    if not isinstance(checkpoint, WorkflowInstanceRecord):
        return None
    try:
        raw = read_source_return(checkpoint, store=store)
        schema = raw.get('schema_version') if isinstance(raw, Mapping) else getattr(raw, 'schema_version', None)
        if schema != 'yf_arc3_v5.child_contribution_return.v1':
            return None
        returned = ChildContributionReturn.model_validate(raw)
    except (SourceReturnContractError, ValidationError):
        return None
    payload = returned.domain_payload
    parent = payload.get('parent_goal_ref')
    attempt = payload.get('child_attempt_ref')
    if (payload.get('child_attempt_closed') is not True
            or not isinstance(parent, str) or not parent
            or not isinstance(attempt, str) or not attempt
            or returned.request.parent_goal_ref != parent
            or returned.request.timeline_ref != activation.timeline_id
            or returned.request.request_ref != activation.request_ref
            or returned.request.recipient_workflow_ref != activation.recipient_workflow_ref
            or stable_digest(returned) != activation.return_digest):
        return None
    return FrozenMap({
        'timeline_ref': activation.timeline_id,
        'parent_goal_ref': parent,
        'child_goal_ref': returned.child_goal_ref,
        'child_attempt_ref': attempt,
        'closure_ref': activation.id,
        'source_checkpoint_ref': checkpoint_ref,
        'return_digest': activation.return_digest,
        'child_disposition_ref': returned.disposition_ref,
        'closed': True,
        'grants_current_action': False,
    })
