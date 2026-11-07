"""Exact current-goal joins for DRM-qualified acquisition returns."""
from collections.abc import Mapping

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from agents.yf_arc3_v5.logos.operational_reasoning import OperationalConsciousnessDependencySnapshot
from .operational_goal_intent import measure_operational_goal_intent


def measure_declared_goal_dependencies(*, goal_ref, facts, goal_facts, snapshot, store=None, timeline_ref=None, frame_ref=None,
                                     additional_dependency_refs=()):
    """Measure an explicit dependency domain; no inferred edges or admission.

    Current goal consumers use measure_current_goal_dependencies so durable
    engagement obligations cannot disappear between wake-up and consumption.
    This kernel also serves bounded inspection of an individual engagement.
    """
    refs = {goal_ref}
    refs.update(additional_dependency_refs)
    for field in ('support_claim_refs', 'parent_goal_refs', 'prerequisite_goal_refs',
                  'alternative_goal_refs', 'conflicting_goal_refs'):
        refs.update(facts.get(field) or ())
    bindings, unresolved = {}, []
    for ref in sorted(refs):
        term, claim = snapshot.term(ref), snapshot.claim(ref)
        goal = goal_facts.get(ref)
        grounded_goal = isinstance(goal, Mapping)
        values = FrozenMap({key: goal[key] for key in ('lifecycle_status', 'support_claim_refs')
                            if key in goal}) if grounded_goal else None
        # Observe the declared intention of each directly linked goal as well
        # as our own. A linked goal can change its proposed destination or lose
        # a premise while its lifecycle and support reference list stay equal.
        # This is one-hop measurement, not recursive planning or a new edge.
        intent_facts = facts if ref == goal_ref else goal if grounded_goal else None
        goal_intent = measure_operational_goal_intent(
            goal_ref=ref, facts=intent_facts, snapshot=snapshot,
            store=store, timeline_ref=timeline_ref, frame_ref=frame_ref) if intent_facts is not None else None
        grounded_goal = bool(values)
        bindings[ref] = FrozenMap({
            'term_revision': term.last_changed_state_revision if term is not None else None,
            'claim_digest': stable_digest(claim) if claim is not None else None,
            # Expiry can change at a later revision without mutating the claim.
            'claim_expired': bool(claim is not None and claim.valid_through_state_revision is not None
                and claim.valid_through_state_revision < snapshot.revision),
            'goal_facts': values,
            # Future conditions can change while the goal TERM stays unchanged.
            # Missing definition refs remain questions, not admission premises.
            'operational_goal_intent_digest': stable_digest(goal_intent) if goal_intent is not None else None,
        })
        if term is None and claim is None and not grounded_goal:
            unresolved.append(ref)
    return OperationalConsciousnessDependencySnapshot(problem_ref=goal_ref,
        bindings=FrozenMap(bindings), unresolved_refs=tuple(unresolved))


def measure_current_goal_dependencies(*, goal_ref, facts, goal_facts, store,
                                      timeline_ref, frame_ref, execution_scope):
    """One scoped domain for goal watches, reviews, returns and frozen frontiers.

    Engagement references were declared and retained by the canonical receipt
    projection. Union them with the goal's named dependencies; do not choose a
    strategy, satisfy a prerequisite or infer any new semantic relationship.
    """
    scope = FrozenMap({key: execution_scope.get(key)
        for key in ('game_ref', 'level_ref', 'session_ref')})
    if not all(isinstance(value, str) and value for _, value in sorted(scope.items())):
        raise ValueError('current goal dependencies require a complete execution scope')
    if not timeline_ref or not frame_ref:
        raise ValueError('current goal dependencies require a timeline and frame')
    consciousness = store.operational_consciousness
    refs = consciousness.engagement_dependency_refs(timeline_ref, scope, goal_ref)
    responses = consciousness.question_response_dependencies(timeline_ref, scope, goal_ref)
    interpretations = consciousness.question_interpretation_dependencies(timeline_ref, scope, goal_ref)
    by_response = {}
    for work_ref, interpretation in sorted(interpretations.items()):
        by_response.setdefault(interpretation['response_dependency_ref'], {})[work_ref] = interpretation
    from agents.yf_arc3_v5.state.conscious_question_response import measure_question_response_physical_evidence, read_question_response
    responses = FrozenMap({ref: FrozenMap.overlay({
        'consumed_interpretation_reviews': FrozenMap(by_response.get(ref, {})),
        'current_physical_evidence':
        measure_question_response_physical_evidence(store=store, consciousness=consciousness, response=row['response'])}, row)
        for ref, row in sorted(responses.items())})
    # An existing interpretation can expire or be contradicted independently of
    # its receipt. Observe its canonical claim as well as the frozen response.
    response_records = tuple(read_question_response(row['response']) for _, row in sorted(responses.items()))
    claim_refs = tuple(response.interpretation_claim_ref for response in response_records
        if response.interpretation_claim_ref is not None)
    # A later acquisition must wake the same goal. Track its consumed review
    # and every interpretation premise, including subsequent contradiction or
    # expiry, without rewriting the original physical response receipt.
    reviewed_claim_refs = tuple(claim_ref for _, row in sorted(responses.items())
        for _, review in sorted(row['consumed_interpretation_reviews'].items())
        for claim_ref in review['interpretation_claim_refs'])
    measured = measure_declared_goal_dependencies(goal_ref=goal_ref, facts=facts, goal_facts=goal_facts,
        snapshot=store.snapshot, store=store, timeline_ref=timeline_ref, frame_ref=frame_ref,
        additional_dependency_refs=(*refs, *claim_refs, *reviewed_claim_refs))
    # A bound receipt proves that this debt was returned, not that its missing
    # evidence exists. Keep the full typed response for the Source/DRM consumer.
    return measured.model_copy(update={'bindings': FrozenMap({**measured.bindings, **responses})})


def measure_goal_frontier_review(*, frontier, current_facts, observation_ref, intent_ref, snapshot,
                                store=None, timeline_ref=None, frame_ref=None):
    rows = {}
    fields = ("lifecycle_status", "priority_position", "support_claim_refs",
              "parent_goal_refs", "prerequisite_goal_refs",
              "alternative_goal_refs", "conflicting_goal_refs")
    for branch in frontier.branches:
        current = current_facts.get(branch.goal_ref)
        present = isinstance(current, Mapping)
        values = {key: current.get(key) for key in fields if key in current} if present else {}
        # Missing fields are uncertainty, not values silently defaulted to false.
        missing = tuple(key for key in fields if key not in values)
        changed = tuple(key for key in fields if key in values and values[key] != getattr(branch, key))
        goal_intent = measure_operational_goal_intent(goal_ref=branch.goal_ref,
            facts=current if present else {}, snapshot=snapshot,
            store=store, timeline_ref=timeline_ref, frame_ref=frame_ref)
        values.update(goal_intent.declarations)
        intent_changed = goal_intent != branch.operational_goal_intent
        if intent_changed:
            changed = (*changed, 'operational_goal_intent')
        dependency_facts = current if present else {key: getattr(branch, key) for key in fields}
        if store is None:
            # Detached measurements have no canonical engagement index. They
            # retain the explicit domain and cannot attest current admission.
            dependencies = measure_declared_goal_dependencies(goal_ref=branch.goal_ref,
                facts=dependency_facts, goal_facts=current_facts, snapshot=snapshot)
        else:
            dependencies = measure_current_goal_dependencies(goal_ref=branch.goal_ref,
                facts=dependency_facts, goal_facts=current_facts, store=store,
                timeline_ref=timeline_ref, frame_ref=frame_ref, execution_scope=frontier.execution_scope)
        prior = branch.operational_consciousness_dependencies
        prior_bound = set(prior.bindings) - set(prior.unresolved_refs)
        now_bound = set(dependencies.bindings) - set(dependencies.unresolved_refs)
        dependency_changed = tuple(sorted(ref for ref in prior_bound & now_bound
                                         if prior.bindings[ref] != dependencies.bindings[ref]))
        newly_bound = tuple(sorted(now_bound - prior_bound))
        lost = tuple(sorted(prior_bound - now_bound))
        rows[branch.goal_ref] = FrozenMap({
            "goal_ref": branch.goal_ref, "current_goal_present": present,
            "changed_field_refs": changed, "goal_facts_changed": bool(changed),
            'goal_fact_comparison_complete': present and not missing,
            "current_facts": FrozenMap(values),
            "native_means_review_refs": branch.native_means_review_refs,
            'native_participant_observation_refs': branch.native_participant_observation_refs,
            'operational_goal_intent': goal_intent.model_dump(mode='python'),
            'goal_intent_changed': intent_changed,
            'missing_field_refs': missing,
            'current_dependency_snapshot': dependencies.model_dump(mode='python'),
            'changed_dependency_refs': dependency_changed,
            'newly_bound_dependency_refs': newly_bound,
            'lost_dependency_refs': lost,
            'dependency_evidence_changed': bool(dependency_changed or newly_bound or lost),
            "agenda_action_witness_measurement_present": current.get("agenda_action_witness_measurement_present") if present else None,
            "current_context_untried_declared_action_witness_count": current.get("current_context_untried_declared_action_witness_count") if present else None,
            "lifecycle_status": current.get("lifecycle_status") if present else None,
        })
    return FrozenMap({
        "review_present": True, "alternative_refs": tuple(sorted(rows)),
        "alternative_facts": FrozenMap(rows), "observation_ref": observation_ref,
        "action_intent_ref": intent_ref, "frontier_digest": stable_digest(frontier),
    })
