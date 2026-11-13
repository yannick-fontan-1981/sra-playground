"""Measure the exact finite domain already supplied to a Source selection."""
from collections import ChainMap

from agents.yf_arc3_v5.drm.runtime import declared_eligibility_matches
from agents.yf_arc3_v5.logos.operational_experiment_admission import OperationalConsciousnessSelectionFrontier
from agents.yf_arc3_v5.logos.operational_information_opportunity import declared_action_question_bindings
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .conscious_engagement import measure_incoming_engagement, measure_engagement_frontier


def capture_selection_frontier(owner, context, agenda, projected, selected_facts, intent):
    if selected_facts.get('operational_selection_frontier_required') is not True or intent.frame_id is None:
        return None
    policy_ref = context.arguments['selection_policy_ref']
    policy, loaded_policy = owner._drm.resolve(policy_ref)
    policy_hash = loaded_policy.source_hash
    review, loaded_review = owner._drm.resolve('policy.conscious_native_continuation_review')
    review_hash = loaded_review.source_hash
    config = review.configuration
    fields = tuple(dict.fromkeys((*policy.selection_required_fact_fields,
        *(condition.field for condition in policy.selection_eligibility_conditions))))
    projected_facts = projected['alternative_facts']
    projected_context = projected.get('context_facts') or FrozenMap()
    incoming_facts = ChainMap(selected_facts, projected_context, agenda.context_facts)
    questions = declared_action_question_bindings(intent)
    identity = FrozenMap({'timeline_ref': intent.timeline_id, 'frame_ref': intent.frame_id,
        'execution_scope': intent.operational_consciousness.responsibility.execution_scope,
        'selected_candidate_ref': context.arguments['selected_ref'], 'action_ref': intent.action_ref,
        'action_data': intent.action_data, 'effect_class': intent.expected_effect_class,
        'contribution_digest': stable_digest(intent.operational_consciousness.responsibility.contribution),
        'question_binding_digest': stable_digest(questions)})
    engagement = measure_incoming_engagement(owner._store, identity,
        incoming_facts.get('previous_action_lifecycle_intent_ref'),
        incoming_facts.get('previous_action_lifecycle_closed_intent_refs') or (),
        config['maximum_engagement_members'])
    rows, premises = {}, set(intent.canonical_premise_claim_refs)
    for ref in agenda.alternative_refs:
        facts = ChainMap(projected_facts.get(ref, FrozenMap()), projected_context, agenda.context_facts)
        known = all(field in facts and facts[field] is not None for field in fields)
        markers = FrozenMap({field: facts.get(field) for field in (
            *config['continuation_boolean_fields'], *config['continuation_reference_fields'])})
        rows[ref] = FrozenMap({'eligible': declared_eligibility_matches(facts, policy) if known else None,
            'declaration_markers': markers,
            'declared_premise_refs': tuple(facts.get('premise_claim_refs') or ()),
            # References locate a plan; only its declared availability flags
            # nominate it for local revalidation. A locator alone proves nothing.
            'affirmative_marker_count': sum(markers[field] is True
                for field in config['continuation_boolean_fields'])})
        # Alternative declarations can name unresolved schematic premises.
        # Preserve them for their own review; they are not canonical support
        # for the selected action and cannot turn unrelated debt into a veto.
    return OperationalConsciousnessSelectionFrontier(
        source_workflow_ref=context.workflow_definition_id,
        source_hash=context.operational_consciousness.context.source_hash,
        selection_policy_ref=policy_ref, selection_policy_hash=policy_hash, review_policy_hash=review_hash,
        timeline_ref=intent.timeline_id, frame_ref=intent.frame_id,
        execution_scope=intent.operational_consciousness.responsibility.execution_scope,
        selected_candidate_ref=context.arguments['selected_ref'], action_ref=intent.action_ref,
        action_data=intent.action_data, effect_class=intent.expected_effect_class,
        contribution_digest=stable_digest(intent.operational_consciousness.responsibility.contribution),
        question_ref=selected_facts.get('mechanism_question_ref'), reason_ref=selected_facts.get('selection_principle_ref'),
        question_bindings=questions,
        candidate_rows=FrozenMap(rows), candidate_domain_complete=(set(rows) == set(projected_facts)
            and set(rows) == {candidate.candidate_ref for candidate in agenda.candidates}),
        incoming_engagement_present=selected_facts.get('incoming_declared_route_engagement_present'),
        incoming_engagement_consumed=selected_facts.get('incoming_declared_route_lease_consumed'),
        incoming_engagement_review=engagement,
        premise_versions=FrozenMap({ref: stable_digest(owner._store.snapshot.claim(ref))
            if owner._store.snapshot.claim(ref) is not None else None for ref in sorted(premises)}))


def measure_selection_frontier(owner, prepared):
    return measure_frozen_selection_frontier(owner, prepared.selection_frontier, selection_identity(prepared))


def selection_identity(prepared):
    intent = prepared.intent
    questions = ({'question_binding_digest': stable_digest(declared_action_question_bindings(intent))}
        if prepared.selection_frontier is not None and prepared.selection_frontier.question_bindings is not None else {})
    return FrozenMap({'timeline_ref': intent.timeline_id, 'frame_ref': intent.frame_id,
        'execution_scope': intent.operational_consciousness.responsibility.execution_scope,
        'selected_candidate_ref': prepared.selected_candidate_ref, 'action_ref': intent.action_ref,
        'action_data': intent.action_data, 'effect_class': intent.expected_effect_class,
        'contribution_digest': stable_digest(intent.operational_consciousness.responsibility.contribution), **questions})


def measure_frozen_selection_frontier(owner, frontier, identity):
    if frontier is None:
        return FrozenMap({'selection_domain_current': False})
    current = (selection_frontier_source_current(owner, frontier)
        and (frontier.question_bindings is None or
            identity.get('question_binding_digest') == stable_digest(frontier.question_bindings))
        and all(getattr(frontier, field) == identity[field] for field in (
            'timeline_ref', 'frame_ref', 'execution_scope', 'selected_candidate_ref', 'action_ref', 'action_data', 'effect_class', 'contribution_digest'))
        and owner._store.snapshot.timeline_id == identity['timeline_ref']
        and all(version is not None and owner._store.snapshot.claim(ref) is not None
            and stable_digest(owner._store.snapshot.claim(ref)) == version
            and (owner._store.snapshot.claim(ref).valid_through_state_revision is None
                or owner._store.snapshot.claim(ref).valid_through_state_revision >= owner._store.snapshot.revision)
            for ref, version in sorted(frontier.premise_versions.items())))
    rows = frontier.candidate_rows
    selected = rows.get(frontier.selected_candidate_ref, FrozenMap())
    dependency_facts = measure_engagement_frontier(owner._store, identity, frontier.incoming_engagement_review,
        owner._drm.resolve('policy.conscious_native_continuation_review')[0].configuration['maximum_engagement_members'])
    return FrozenMap({**dependency_facts, 'selection_domain_current': bool(current and frontier.candidate_domain_complete),
        'selected_eligibility_current': selected.get('eligible'),
        'selected_affirmative_marker_count': selected.get('affirmative_marker_count', 0),
        'selected_effect_class': frontier.effect_class,
        'selected_question_named': bool((frontier.question_ref is not None or frontier.question_bindings)
            and frontier.reason_ref is not None),
        'selected_declared_question_bindings': frontier.question_bindings,
        'unexamined_eligibility_count': sum(row['eligible'] is None for _, row in sorted(rows.items())),
        'nonexcluded_marked_candidate_count': sum(row['eligible'] is not False and row['affirmative_marker_count'] > 0
            for _, row in sorted(rows.items())),
        'nonexcluded_marked_candidate_refs': tuple(ref for ref, row in sorted(rows.items())
            if row['eligible'] is not False and row['affirmative_marker_count'] > 0),
        'incoming_engagement_present': frontier.incoming_engagement_present,
        'incoming_engagement_consumed': frontier.incoming_engagement_consumed})


def selection_frontier_source_current(owner, frontier):
    entry = owner._entries.get(frontier.source_workflow_ref)
    return (entry is not None and entry.transitive_source_hash == frontier.source_hash
        and owner._drm.resolve(frontier.selection_policy_ref)[1].source_hash == frontier.selection_policy_hash
        and owner._drm.resolve('policy.conscious_native_continuation_review')[1].source_hash == frontier.review_policy_hash)
