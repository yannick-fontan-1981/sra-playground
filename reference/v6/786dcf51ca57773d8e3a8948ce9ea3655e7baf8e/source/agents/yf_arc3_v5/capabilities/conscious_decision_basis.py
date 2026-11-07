"""Lossless decision transport; Source selects the disposition, DRM its meaning."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data


def conscious_decision_basis(request, measured, disposition):
    """Project the selected review's basis without granting conditional premises."""
    observed = request.observed_return
    retained = request.model_refs
    if disposition in ('experiment.review_observed_result', 'experiment.end_cost_limited_trial') and observed is not None and not observed.measured.missing_refs:
        retained = tuple(ref for ref in retained if ref in (
            *observed.measured.matching_model_refs, *observed.measured.unassessed_model_refs))
    envelope = measured.facts.get('native_recovery_conditional_cost_envelope')
    conditional = tuple(envelope.get('conditional_on_refs', ())) if envelope is not None else ()
    goal_review = measured.facts.get('native_goal_contribution_review', FrozenMap())
    goal_contract = goal_review.get('prediction_contract', FrozenMap())
    goal_conditions = tuple(goal_contract.get('condition_refs', ()))
    if goal_contract.get('hypothesis_ref') is not None:
        goal_conditions = (*goal_conditions, goal_contract['hypothesis_ref'])
    contribution = ({'goal_contribution_review': measured.facts['native_goal_contribution_review']}
        if 'native_goal_contribution_review' in measured.facts else {})
    funding = ({'cost_funding_review': measured.facts['cost_funding_review']}
        if 'cost_funding_review' in measured.facts else {})
    evidence = request.native_preparation_evidence
    preparation = ({'preparation_review': FrozenMap({
        'source_viability_ref': evidence.source_viability_ref,
        'source_viability_digest': evidence.source_viability_digest,
        'measured_facts': evidence.measured_facts,
        'projection_facts': evidence.projection_facts,
        'policy_hash': evidence.policy_hash,
    })} if evidence is not None and evidence.acquisition_contract is not None else {})
    goal = request.understanding_goal
    engagement = ({'engagement_review': FrozenMap({
        'continuation_review_ref': request.native_continuation_review_ref,
        **({'disposition': request.native_continuation_disposition} if request.native_continuation_disposition is not None else {}),
        'review': immutable_json_data(request.incoming_engagement_review),
    })} if request.incoming_engagement_review is not None else {})
    cost_scope = ({'cost_scope_ref': goal.cost_scope_ref, 'cost_scope_digest': goal.cost_scope_digest}
        if goal is not None and goal.cost_scope_ref is not None else {})
    understanding = ({'understanding_objective': FrozenMap({
        **cost_scope,
        'goal_ref': goal.goal_ref, 'responsibility_owner_goal_ref': goal.responsibility_owner_goal_ref,
        'information_reason_ref': goal.information_reason_ref,
        'possible_beneficiary_goal_refs': goal.possible_beneficiary_goal_refs,
        'timing': goal.timing, 'stop_condition_refs': goal.stop_condition_refs,
        'maximum_recovery_inclusive_cost': goal.maximum_recovery_inclusive_cost,
    })} if goal is not None and goal.responsibility_owner_goal_ref is not None else {})
    return FrozenMap({**contribution, **understanding, **funding, **preparation, **engagement,
        'experiment_ref': request.experiment_ref,
        'parent_goal_ref': request.parent_goal_ref, 'utility_reason_ref': request.utility_reason_ref,
        'question_ref': request.question_ref, 'purpose': request.purpose,
        'observation_partitions': measured.observation_partitions, 'retained_model_refs': retained,
        'recalled_evidence_refs': measured.recalled_evidence_refs,
        'necessary_unknown_refs': measured.necessary_unknown_refs, 'risk_cost': measured.risk_cost,
        'irreversible_population_loss': request.irreversible_population_loss,
        'irreversible_material_loss': request.irreversible_material_loss,
        'assumptions': tuple(sorted({ref for prediction in request.predictions for ref in prediction.assumptions}
            | set(conditional) | set(goal_conditions))),
        'falsifier_refs': tuple(sorted({ref for prediction in request.predictions for ref in prediction.falsifier_refs}
            | set(request.understanding_goal.falsifier_refs if request.understanding_goal else ())
            | set(request.open_response_domain.falsifier_refs if request.open_response_domain else ())
            | set(goal_contract.get('falsifier_refs', ())))),
    })


def conscious_decision_basis_digest(request, measured, disposition, policy, obligations):
    """Bind conditions to their full scoped evidence, not only a flattened label set."""
    from agents.yf_arc3_v5.logos.types import stable_digest
    return stable_digest((request, measured, disposition, policy, obligations,
        conscious_decision_basis(request, measured, disposition)))
