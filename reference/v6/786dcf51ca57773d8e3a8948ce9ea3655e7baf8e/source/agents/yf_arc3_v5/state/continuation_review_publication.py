"""Canonical identity and measurement checks for Source-owned continuation reviews.

DRM projection and source-hash qualification remain at production and consumption;
this boundary does not introduce another selection policy or grant an action.
"""
from .conscious_engagement import measure_engagement_frontier
from .reasoning_context_publication import _require_context_origin


def require_continuation_review_publication(record, *, consciousness, store):
    _require_context_origin(record.operational_consciousness_context, consciousness=consciousness, store=store)
    committed = getattr(store, 'committed_evidence_store', store)
    if (record.state_revision != committed.snapshot.revision
            or record.timeline_id != committed.snapshot.timeline_id):
        raise ValueError('operational consciousness: continuation review has a stale canonical observation scope')
    frontier = record.selection_frontier
    if frontier is None:
        if record.measured_facts.get('selection_domain_current') is not False or record.measured_facts.get('incoming_engagement_review') is not None:
            raise ValueError('operational consciousness: continuation review invented an absent selection domain')
        return record
    if (any(getattr(frontier, field) != record.identity.get(field) for field in (
            'timeline_ref', 'frame_ref', 'execution_scope', 'selected_candidate_ref',
            'action_ref', 'action_data', 'effect_class', 'contribution_digest'))
            or frontier.review_policy_hash != record.review_policy_hash):
        raise ValueError('operational consciousness: continuation review changed its frozen selection identity')
    maximum = record.measured_facts.get('incoming_engagement_member_bound')
    if type(maximum) is not int or maximum < 1:
        raise ValueError('operational consciousness: continuation review omitted its declared reading bound')
    expected = measure_engagement_frontier(committed, record.identity, frontier.incoming_engagement_review, maximum)
    if any(record.measured_facts.get(key) != value for key, value in sorted(expected.items())):
        raise ValueError('operational consciousness: continuation review changed its current canonical engagement evidence')
    # Missing, contested and stale prepared evidence are valid negative results.
    # Only a false account of what was measured is rejected here.
    return record
