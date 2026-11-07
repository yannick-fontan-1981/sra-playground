"""Exact observable partitions and cost/recall comparisons; DRM owns usefulness."""
from .experiment_frontier_contracts_c import (ExperimentFrontierInputC, ExperimentFrontierFactsC,
    ExperimentDecisionInputC, ExperimentDecisionC)
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, immutable_json_data
from .conscious_experiment_predictions import measure_observable_compatibility
from .conscious_decision_basis import conscious_decision_basis, conscious_decision_basis_digest
from .conscious_recovery_cost import declared_recovery_funding


def measure_experiment_frontier(value: ExperimentFrontierInputC) -> ExperimentFrontierFactsC:
    canonical = value.canonical_evidence
    admission_bound = canonical is not None and canonical.request_digest == stable_digest(
        value.model_copy(update={'canonical_evidence': None}))
    canonical_current = admission_bound and not canonical.unavailable_refs
    contribution = value.native_goal_contribution_evidence
    contribution_review = ({'native_goal_contribution_review': FrozenMap({
        'owner_goal_ref': contribution.owner_goal_ref,
        'domain_ref': contribution.domain_ref, 'nomination_ref': contribution.nomination_ref,
        'candidate_refs': contribution.candidate_refs, 'evidence_current': canonical_current,
        'contribution_rows': contribution.contribution_rows,
        'prediction_contract': contribution.prediction_contract,
        'missing_candidate_refs': contribution.missing_candidate_refs,
        'utility_established': False, 'grants_action': False,
    })} if contribution is not None else {})
    open_domain = value.open_response_domain
    open_bound = (open_domain is not None and canonical_current and value.execution_contract is not None
        and open_domain.observable_field_refs == tuple(item.field_ref for item in value.execution_contract.observables))
    compatibility = measure_observable_compatibility(value.predictions, value.model_refs, value.observable_field_refs)
    coverage_complete = compatibility['coverage_complete']
    observable_contract_complete = compatibility['observable_contract_complete']
    partitions = compatibility['observation_classes']
    recalled = tuple(evidence.evidence_ref for evidence in value.recalled_evidence
        if admission_bound and evidence.evidence_ref in canonical.admitted_recall_refs
        and evidence.actual_sealed_observation and evidence.stored_epoch <= value.epoch
        and evidence.rebound_epoch == value.epoch and evidence.rebound_revision == value.evidence_revision_ref
        and evidence.rebound_scope_ref == value.scope_ref
        and evidence.current_support_evidence_refs and evidence.question_ref == value.question_ref
        and evidence.operation_ref == value.operation_ref and evidence.context_signature == value.context_signature)
    necessary = tuple(unknown.question_ref for unknown in value.unknowns if any((unknown.affects_identity,
        unknown.affects_payload, unknown.affects_authorization, unknown.affects_safety, unknown.affects_promised_use)))
    costs = (value.consumed_command_cost, value.lost_progress_cost, value.recovery_route_cost)
    risk = sum(costs) if all(cost is not None for cost in costs) else None
    missing_costs = tuple(name for name in ('consumed_command_cost', 'lost_progress_cost',
        'recovery_route_cost', 'irreversible_population_loss', 'irreversible_material_loss') if getattr(value, name) is None)
    costs_known = value.actual_costs_known and not missing_costs
    interval = value.command_budget_interval
    budget_lower = interval.lower if interval is not None else value.remaining_command_budget
    budget_upper = interval.upper if interval is not None else value.remaining_command_budget
    # Missing recovery/loss evidence cannot erase the unavoidable prepared actions.
    # This lower bound alone never establishes affordability or full cost knowledge.
    prepared_cost = len(value.execution_contract.actions) if value.execution_contract is not None else None
    prepared_cost_bound = canonical_current and prepared_cost is not None and prepared_cost == value.consumed_command_cost
    recovery = value.native_recovery_evidence
    recovery_facts = recovery.projection_facts['alternative_facts']['native_recovery.observed_return_domain'] if recovery else FrozenMap()
    envelope = recovery.measured_facts.get('conditional_cost_envelope', FrozenMap()) if recovery else FrozenMap()
    funding = declared_recovery_funding(recovery)
    conditional_upper = funding['upper_bound']
    conditional_funding = bool(canonical_current and recovery is not None
        and funding['supported'] and funding['scope_ref'] is not None and funding['scope_digest'] is not None
        and conditional_upper is not None and value.destructive is not True
        and not value.actual_costs_known)
    actual_funded = bool(canonical_current and costs_known and risk is not None
        and budget_lower is not None and risk <= budget_lower)
    losses = (value.irreversible_population_loss, value.irreversible_material_loss)
    loss_present = True if any(loss is not None and loss > 0 for loss in losses) else (
        False if all(loss is not None for loss in losses) else None)
    manual = value.manual_contract
    manual_current = manual is not None and manual.epoch == value.epoch and manual.scope_ref == value.scope_ref
    manual_current = manual_current and manual.operation_ref == value.operation_ref and bool(manual.precondition_refs)
    operation_keys = {stable_digest(prediction.operation_effect) for prediction in value.predictions}
    benefit_keys = {stable_digest(prediction.downstream_effect) for prediction in value.predictions}
    understanding = value.understanding_goal
    observation_facts = value.observed_return.measured.facts if value.observed_return is not None else FrozenMap()
    observed_cost_stop = bool(admission_bound and canonical.observed_return_current
        and understanding is not None and understanding.maximum_recovery_inclusive_cost is not None
        and observation_facts.get('observed_cost_ceiling') == understanding.maximum_recovery_inclusive_cost
        and observation_facts.get('observed_cost_limit_reached') is True)
    understanding_current = understanding is not None and (
        understanding.scope_ref == value.scope_ref and understanding.epoch == value.epoch
        and understanding.model_refs == value.model_refs
        and understanding.open_response_domain == open_domain
        and understanding.observable_field_refs == value.observable_field_refs)
    actual_allowance_fit = bool(understanding is not None and costs_known and risk is not None
        and understanding.maximum_recovery_inclusive_cost is not None
        and risk <= understanding.maximum_recovery_inclusive_cost)
    conditional_allowance_fit = bool(conditional_funding and understanding is not None
        and understanding.maximum_recovery_inclusive_cost is not None
        and understanding.cost_scope_ref == funding['scope_ref']
        and understanding.cost_scope_digest == funding['scope_digest']
        and conditional_upper <= understanding.maximum_recovery_inclusive_cost)
    supports = set(value.support_evidence_refs)
    preservation_bindings = tuple(value.preservation_evidence_by_constraint.get(ref, ())
        for ref in understanding.preserve_constraint_refs) if understanding else ()
    preservation_bound = bool(preservation_bindings) and all(isinstance(refs, tuple)
        and refs and all(isinstance(ref, str) and ref in supports for ref in refs)
        for refs in preservation_bindings)
    return ExperimentFrontierFactsC(observation_partitions=partitions, recalled_evidence_refs=recalled,
        necessary_unknown_refs=necessary, risk_cost=risk,
        facts=FrozenMap({**contribution_review, "purpose": value.purpose,
            "open_response_domain_bound": open_bound,
            "open_response_domain_present": open_domain is not None,
            "unmodeled_response_is_model_discrimination": False,
            "understanding_observation_complete": value.observed_return is not None
                and not value.observed_return.measured.missing_refs,
            "observed_return_current": admission_bound and canonical.observed_return_current,
            "observed_understanding_cost_limit_reached": observed_cost_stop,
            "understanding_observation_incomplete": value.observed_return is not None
                and bool(value.observed_return.measured.missing_refs),
            "understanding_goal_present": understanding is not None,
            "understanding_binding_current": understanding_current,
            "understanding_preservations_bound": preservation_bound,
            "understanding_stop_contract_bound": understanding is not None and bool(understanding.stop_condition_refs),
            "understanding_stop_observed": understanding is not None
                and bool(set(understanding.stop_condition_refs) & set(value.observed_stop_condition_refs)),
            "understanding_timing": understanding.timing if understanding else None,
            "understanding_cost_limit_known": understanding is not None
                and understanding.maximum_recovery_inclusive_cost is not None,
            "native_curiosity_allowance": immutable_json_data(value.native_curiosity_allowance),
            "understanding_cost_fits": understanding is not None and costs_known and risk is not None
                and understanding.maximum_recovery_inclusive_cost is not None
                and risk <= understanding.maximum_recovery_inclusive_cost,
            "continuation_review": value.continuation_review,
            "question_kind": value.question_kind,
            "question_currently_unanswered": value.question_currently_unanswered,
            "question_answer_status_known": value.question_currently_unanswered is not None,
            "canonical_evidence_current": canonical_current,
            "canonical_unavailable_refs": canonical.unavailable_refs if canonical else (),
            "canonical_rejected_recall_refs": canonical.rejected_recall_refs if canonical else (),
            "scope_current": canonical_current and value.support_epoch == value.epoch
                and value.support_revision_ref == value.evidence_revision_ref
                and value.support_scope_ref == value.scope_ref and bool(value.support_evidence_refs),
            "preconditions_current": value.preconditions_current,
            "protected_conditions_current": value.protected_conditions_current,
            "prediction_coverage_complete": coverage_complete,
            "prediction_assumptions_and_falsifiers_present": all(prediction.assumptions and prediction.falsifier_refs
                for prediction in value.predictions) and bool(value.predictions),
            "model_count": len(value.model_refs),
            "observable_contract_complete": observable_contract_complete,
            "observable_partition_count": len(partitions),
            "observable_models_distinguishable": compatibility['discrimination_possible'],
            "observable_discrimination_guaranteed_within_models": compatibility['discrimination_guaranteed_within_models'],
            "observable_parameter_unique": compatibility['unique_model_for_every_outcome'],
            "observable_outcome_domains_complete": compatibility['outcome_domains_complete'],
            "observable_compatibility": compatibility,
            "operation_effect_partition_count": len(operation_keys),
            "downstream_effect_partition_count": len(benefit_keys),
            "current_recalled_evidence_present": bool(recalled),
            "robust_contribution_current": value.robust_contribution_ref is not None and value.robust_contribution_current,
            "necessary_unknowns_absent": not necessary,
            "observed_whole_code_present": value.observed_whole_code_ref is not None,
            "requested_code_scope": value.requested_code_scope,
            "composition_evidence_present": value.composition_evidence_ref is not None,
            "destructive": value.destructive, "destructiveness_known": value.destructive is not None,
            "manual_contract_current": manual_current,
            "irreversible_loss_present": loss_present,
            "cost_missing_fields": missing_costs,
            "cost_values_complete": not missing_costs,
            "cost_evidence_declared_known": value.actual_costs_known,
            "cost_declaration_consistent": not value.actual_costs_known or not missing_costs,
            "actual_costs_known": costs_known,
            "funding_cost_supported": costs_known or conditional_funding,
            "funding_cost_fits_budget": actual_funded or conditional_funding,
            "funding_loss_review_complete": value.destructive is not None or conditional_funding,
            "understanding_funding_cost_fits": actual_allowance_fit or conditional_allowance_fit,
            "cost_funding_review": FrozenMap({
                'actual_costs_known': costs_known, 'actual_cost_fits_budget': actual_funded,
                'conditional_funding_current': conditional_funding,
                'conditional_upper_bound': conditional_upper,
                'conditional_allowance_fit': conditional_allowance_fit,
                'conditional_admission_reason_ref': funding['reason_ref'],
                'conditional_cost_scope_ref': funding['scope_ref'],
                'conditional_cost_scope_digest': funding['scope_digest'],
                'unknown_outside_cost_refs': funding['unknown_outside_cost_refs'],
                'conditional_on_refs': tuple(envelope.get('conditional_on_refs', ())),
                'cost_missing_fields': missing_costs,
                'future_recovery_established': False, 'grants_action': False,
            }),
            "prepared_command_cost": prepared_cost,
            "prepared_command_cost_bound": prepared_cost_bound,
            "prepared_command_cost_exceeds_budget": prepared_cost_bound and budget_upper is not None and prepared_cost > budget_upper,
            "native_recovery_evidence_present": recovery is not None,
            "native_recovery_evidence_current": canonical_current and recovery is not None,
            "native_recovery_status": recovery_facts.get('recovery_status'),
            "native_recovery_cost_review_status": recovery_facts.get('cost_review_status'),
            "native_recovery_conditional_cost_envelope": recovery.measured_facts.get('conditional_cost_envelope') if recovery else None,
            "native_recovery_next_evidence_refs": recovery_facts.get('next_evidence_refs', ()),
            "native_recovery_observed_returns": recovery.observed_returns if recovery else FrozenMap(),
            "native_recovery_required_constraint_refs": recovery.measured_facts['required_constraint_refs'] if recovery else (),
            "native_recovery_missing_refs": tuple(dict.fromkeys((*recovery.measured_facts['missing_refs'],
                *recovery.measured_facts.get('conditional_recovery_missing_refs', ())))) if recovery else (),
            "command_budget_interval_present": interval is not None,
            "command_budget_lower": budget_lower, "command_budget_upper": budget_upper,
            "recovery_inclusive_cost": risk,
            "recovery_inclusive_cost_fits": canonical_current and costs_known and risk is not None
                and budget_lower is not None and risk <= budget_lower,
            "recovery_inclusive_cost_exceeds_budget": canonical_current and costs_known and risk is not None
                and budget_upper is not None and risk > budget_upper,
            "recovery_inclusive_budget_ambiguous": canonical_current and costs_known and risk is not None
                and budget_lower is not None and risk > budget_lower
                and (budget_upper is None or risk <= budget_upper),
            "irreversible_population_loss": value.irreversible_population_loss,
            "irreversible_material_loss": value.irreversible_material_loss}))


def assemble_admission_obligations(measured, projection):
    """Copy every DRM-declared pending obligation, without choosing a remedy."""
    from agents.yf_arc3_v5.logos.operational_experiment_admission import OperationalConsciousnessExperimentAdmissionObligation
    if projection is None:
        return ()
    rows = projection['alternative_facts']
    if set(rows) != set(projection['alternative_refs']):
        raise ValueError('admission review lost its complete declared obligation domain')
    result = []
    for ref, row in sorted(rows.items()):
        if row.get('pending') is True:
            fields = tuple(row['measured_fields'])
            if any(field not in measured.facts for field in fields):
                raise ValueError('admission review refers to an unmeasured field')
            result.append(OperationalConsciousnessExperimentAdmissionObligation(
                obligation_ref=ref, reason_ref=row['reason_ref'], measured_fields=fields,
                measured_values=FrozenMap({field: measured.facts[field] for field in fields})))
    return tuple(result)


def assemble_experiment_decision(value: ExperimentDecisionInputC) -> ExperimentDecisionC:
    request, measured = value.request, value.measured
    if measured != measure_experiment_frontier(request):
        raise ValueError('experiment decision lost its exact current question measurements')
    admission = ({'admission_obligations': assemble_admission_obligations(measured, value.admission_projection)}
        if value.admission_projection is not None else {})
    return ExperimentDecisionC(**admission, source_disposition_ref=value.source_disposition_ref,
        source_policy_ref=value.source_policy_ref, frozen_request=request, frozen_measurement=measured,
        understanding_goal=request.understanding_goal,
        conscious_reasoning_basis_digest=conscious_decision_basis_digest(request, measured,
            value.source_disposition_ref, value.source_policy_ref, admission.get('admission_obligations', ())),
        **conscious_decision_basis(request, measured, value.source_disposition_ref))
