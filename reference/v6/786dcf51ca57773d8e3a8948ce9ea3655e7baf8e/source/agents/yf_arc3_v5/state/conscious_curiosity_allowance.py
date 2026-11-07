"""Exact per-trial funding operands; DRM owns assignment, Source its opportunity."""
from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives
from agents.yf_arc3_v5.logos.operational_experiment_admission import OperationalConsciousnessCuriosityAllowance
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from agents.yf_arc3_v5.capabilities.conscious_recovery_cost import declared_recovery_funding

POLICY = 'policy.conscious_curiosity_allowance'
ALTERNATIVE = 'curiosity.current_trial'


def measure(request, continuation_facts):
    recovery = request.native_recovery_evidence
    envelope = recovery.measured_facts.get('conditional_cost_envelope', FrozenMap()) if recovery else FrozenMap()
    budget = request.command_budget_interval
    funding = declared_recovery_funding(recovery)
    cost = funding['upper_bound']
    lower = budget.lower if budget is not None else None
    solver = budget.solver_action_bound if budget is not None else None
    actual_components = FrozenMap({field: getattr(request, field) for field in (
        'consumed_command_cost', 'lost_progress_cost', 'recovery_route_cost',
        'irreversible_population_loss', 'irreversible_material_loss')})
    actual_complete = request.actual_costs_known and all(value is not None for _, value in sorted(actual_components.items()))
    actual_total = (sum(actual_components[field] for field in (
        'consumed_command_cost', 'lost_progress_cost', 'recovery_route_cost')) if actual_complete else None)
    actual_scope = FrozenMap({
        'experiment_ref': request.experiment_ref, 'scope_ref': request.scope_ref,
        'epoch': request.epoch, 'model_refs': request.model_refs,
        'execution_contract_digest': stable_digest(request.execution_contract),
        'cost_components': actual_components, 'command_budget_digest': stable_digest(budget)})
    return FrozenMap({
        'understanding_timing': continuation_facts['understanding_timing'],
        'continuation_review': continuation_facts['continuation_review'],
        'conditional_cost_upper': cost,
        'conditional_cost_complete': cost is not None and envelope.get('retained_model_domain_complete') is True,
        'cost_scope_qualified': funding['supported'] and funding['scope_ref'] is not None and funding['scope_digest'] is not None,
        'cost_scope_ref': funding['scope_ref'], 'cost_scope_digest': funding['scope_digest'],
        'unknown_outside_cost_refs': funding['unknown_outside_cost_refs'],
        'irreversible_losses_known': envelope.get('irreversible_losses_known') is True,
        'remaining_budget_lower': lower, 'solver_action_bound': solver,
        'budget_bounds_known': lower is not None and solver is not None,
        'actual_costs_declared': request.actual_costs_known,
        'actual_cost_components': actual_components,
        'actual_cost_complete': actual_complete,
        'actual_prepared_cost_bound': request.execution_contract is not None
            and len(request.execution_contract.actions) > 0
            and request.consumed_command_cost == len(request.execution_contract.actions),
        'actual_non_destructive': request.destructive is False,
        'actual_cost_total': actual_total,
        'actual_losses_zero': actual_complete and actual_components['irreversible_population_loss'] == 0
            and actual_components['irreversible_material_loss'] == 0,
        'actual_cost_fits_both_bounds': actual_total is not None and lower is not None and solver is not None
            and actual_total <= lower and actual_total <= solver,
        'actual_cost_scope_digest': stable_digest(actual_scope),
        'cost_fits_both_bounds': cost is not None and lower is not None and solver is not None
            and cost <= lower and cost <= solver,
        'conditional_on_refs': tuple(envelope.get('conditional_on_refs', ())),
        'cost_envelope_digest': stable_digest(envelope),
        'command_budget_digest': stable_digest(budget),
    })


def allocate(request, record, continuation_facts, drm):
    measured = measure(request, continuation_facts)
    projected = project_declared_alternatives(drm=drm, selection_policy_ref=POLICY,
        alternative_refs=(ALTERNATIVE,), descriptive_facts=FrozenMap({ALTERNATIVE: measured}))
    selected = projected.alternative_facts[ALTERNATIVE]
    return OperationalConsciousnessCuriosityAllowance(
        continuation_review_ref=record.id, experiment_ref=request.experiment_ref,
        measured_facts=measured, projection_facts=immutable_json_data(projected),
        policy_hash=drm.resolve(POLICY)[1],
        cost_scope_ref=selected['assigned_cost_scope_ref'],
        cost_scope_digest=selected['assigned_cost_scope_digest'],
        maximum_recovery_inclusive_cost=selected['assigned_trial_cost_ceiling'])
