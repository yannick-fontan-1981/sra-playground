"""Exact cost envelope over every retained recovery hypothesis in a declared mode."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest


class OperationalConsciousnessRecoveryCostEnvelope(FrozenModel):
    endpoint_mode: Ref
    query_costs: FrozenMap
    query_count: int = Field(ge=0)
    complete_query_count: int = Field(ge=0)
    unresolved_query_refs: tuple[Ref, ...]
    single_forward_primitive_bound: bool
    required_prepared_primitive_count: int | None = Field(ge=1)
    retained_model_domain_complete: bool
    minimum_retained_model_command_upper_bound: int | None = Field(ge=0)
    maximum_retained_model_command_upper_bound: int | None = Field(ge=0)
    lost_progress_cost: int | None = Field(ge=0)
    minimum_retained_model_total_upper_bound: int | None = Field(ge=0)
    maximum_recovery_inclusive_bound: int | None = Field(ge=0)
    known_component_cost_floor: int | None = Field(ge=0)
    known_component_cost_exceeds_upper_budget: bool
    remaining_command_lower: int | None = Field(ge=0)
    remaining_command_upper: int | None = Field(ge=0)
    all_retained_models_fit_lower_budget: bool
    all_retained_model_bounds_exceed_upper_budget: bool
    retained_models_disagree_at_upper_budget: bool
    funding_depends_on_resource_model: bool
    irreversible_population_loss: int | None = Field(ge=0)
    irreversible_material_loss: int | None = Field(ge=0)
    irreversible_losses_known: bool
    conditional_on_refs: tuple[Ref, ...]
    future_recovery_established: Literal[False] = False
    grants_action: Literal[False] = False
    cost_unit: Literal['primitive_action'] = 'primitive_action'
    model_bound_semantics: Literal['conditional_upper_bounds_not_realized_costs'] = 'conditional_upper_bounds_not_realized_costs'
    schema_version: Literal['operational_consciousness_recovery_cost_envelope.v2'] = 'operational_consciousness_recovery_cost_envelope.v2'


class OperationalConsciousnessScopedRestorationCost(FrozenModel):
    """A return-to-projection certificate, never a zero-loss claim about the world."""
    domain_ref: Ref
    goal_ref: Ref
    projection_digest: Ref
    query_costs: FrozenMap
    required_constraint_refs: tuple[Ref, ...]
    uncovered_constraint_refs: tuple[Ref, ...]
    scope_complete: bool
    maximum_primitive_count: int | None = Field(ge=1)
    outside_cost_values: FrozenMap
    unknown_outside_cost_refs: tuple[Ref, ...]
    known_outside_cost_positive: bool
    conditional_on_refs: tuple[Ref, ...]
    cost_scope_ref: Literal['recovery.cost_scope.recorded_joint_projection'] = 'recovery.cost_scope.recorded_joint_projection'
    complete_world_recovery_established: Literal[False] = False
    grants_action: Literal[False] = False


def measure_scoped_restoration_cost(domain, envelope, identity, *, current):
    contract = domain.preservation_requirements if domain is not None else None
    required = tuple(identity['required_constraint_refs'])
    declared = set((*contract.goal_preserve_constraint_refs, *contract.goal_overshoot_constraint_refs)) if contract else set()
    uncovered = tuple(sorted(set(required) - declared))
    complete = bool(current and domain is not None and contract is not None
        and domain.goal_ref == identity['owner_goal_ref'] and contract.goal_ref == domain.goal_ref and not uncovered
        and envelope.retained_model_domain_complete)
    # The recovery certificate already counts every command until that same
    # joint projection is restored. Do not add a fabricated global progress loss.
    outside = FrozenMap({name: identity[name] for name in (
        'lost_progress_cost', 'irreversible_population_loss', 'irreversible_material_loss')})
    return OperationalConsciousnessScopedRestorationCost(
        domain_ref=domain.domain_ref if domain is not None else identity['domain_ref'],
        goal_ref=identity['owner_goal_ref'],
        projection_digest=stable_digest((contract, domain.recovery_subject_fields if domain else None,
            domain.recovery_observation_fields if domain else None, envelope.query_costs)),
        query_costs=envelope.query_costs, required_constraint_refs=required,
        uncovered_constraint_refs=uncovered, scope_complete=complete,
        maximum_primitive_count=envelope.maximum_retained_model_command_upper_bound if complete else None,
        outside_cost_values=outside,
        unknown_outside_cost_refs=tuple(name for name, value in sorted(outside.items()) if value is None),
        known_outside_cost_positive=any(value is not None and value > 0 for _, value in sorted(outside.items())),
        conditional_on_refs=envelope.conditional_on_refs)


def declared_recovery_funding(evidence):
    """Read the DRM-selected bound and its scope as one indivisible contribution."""
    row = (evidence.projection_facts['alternative_facts']['native_recovery.observed_return_domain']
        if evidence is not None else FrozenMap())
    return FrozenMap({
        'supported': row.get('conditional_cost_admission_supported') is True,
        'upper_bound': row.get('conditional_admission_upper_bound'),
        'scope_ref': row.get('conditional_admission_scope_ref'),
        'scope_digest': row.get('conditional_admission_scope_digest'),
        'reason_ref': row.get('conditional_cost_admission_reason_ref'),
        'unknown_outside_cost_refs': tuple(row.get('conditional_admission_unknown_outside_cost_refs', ())),
    })


def measure_recovery_cost_envelope(rows, identity, endpoint_mode, observation_domain_complete):
    """No cheapest-model selection, no missing component promoted to zero.

Each query already minimizes its worst-case return over commands. Here queries
are competing retained contexts, not freely interchangeable cheaper routes.
"""
    costs, unresolved, assumptions = {}, [], set()
    prepared = identity['prepared_primitive_count']
    prepared_bound = isinstance(prepared, int) and not isinstance(prepared, bool) and prepared > 0
    single = prepared_bound and prepared == 1
    for ref, row in sorted(rows.items()):
        model = row['conditional_return_models'].get(endpoint_mode)
        proposed_bound = model['worst_case_forward_and_return_primitive_count'] if model else None
        bound_valid = (isinstance(proposed_bound, int) and not isinstance(proposed_bound, bool)
            and prepared_bound and proposed_bound >= prepared)
        complete = bool(single and model is not None
            and model['conditional_policy_covers_all_recorded_outcomes']
            and not model['unbound_requirement_refs']
            and bound_valid)
        bound = proposed_bound if complete else None
        costs[ref] = FrozenMap({'policy_ref': model['policy_ref'] if model else None,
            'policy_digest': model['policy_digest'] if model else None,
            'conditional_on_refs': model['conditional_on_refs'] if model else (),
            'command_upper_bound': bound,
            'command_upper_bound_valid': bound_valid,
            'unbound_requirement_refs': model['unbound_requirement_refs'] if model else (),
            'complete_for_query': complete})
        if not complete:
            unresolved.append(ref)
        if model:
            assumptions.update(model['conditional_on_refs'])
    complete = bool(costs) and single and observation_domain_complete and not unresolved
    amounts = tuple(row['command_upper_bound'] for _, row in sorted(costs.items()) if row['complete_for_query'])
    low, high = (min(amounts), max(amounts)) if complete else (None, None)
    progress = identity['lost_progress_cost']
    total_low = low + progress if low is not None and progress is not None else None
    total_high = high + progress if high is not None and progress is not None else None
    # The minimum of model upper bounds is NOT a lower bound on actual cost.
    # Only commands required by the complete prepared trial and explicitly known
    # progress loss enter this floor. Unknown progress stays None above: omitting
    # a nonnegative unknown from a lower bound is not measuring it as zero.
    floor = prepared + (progress if progress is not None else 0) if prepared_bound else None
    budget_low, budget_high = identity['command_budget_lower'], identity['command_budget_upper']
    population, material = identity['irreversible_population_loss'], identity['irreversible_material_loss']
    return OperationalConsciousnessRecoveryCostEnvelope(
        endpoint_mode=endpoint_mode, query_costs=FrozenMap(costs), query_count=len(costs),
        complete_query_count=len(amounts), unresolved_query_refs=tuple(unresolved),
        single_forward_primitive_bound=single, required_prepared_primitive_count=prepared if prepared_bound else None,
        retained_model_domain_complete=complete,
        minimum_retained_model_command_upper_bound=low, maximum_retained_model_command_upper_bound=high,
        lost_progress_cost=progress,
        minimum_retained_model_total_upper_bound=total_low, maximum_recovery_inclusive_bound=total_high,
        known_component_cost_floor=floor,
        known_component_cost_exceeds_upper_budget=bool(floor is not None and budget_high is not None and floor > budget_high),
        remaining_command_lower=budget_low, remaining_command_upper=budget_high,
        all_retained_models_fit_lower_budget=bool(total_high is not None and budget_low is not None and total_high <= budget_low),
        all_retained_model_bounds_exceed_upper_budget=bool(total_low is not None and budget_high is not None and total_low > budget_high),
        retained_models_disagree_at_upper_budget=bool(total_low is not None and budget_high is not None and total_low <= budget_high < total_high),
        funding_depends_on_resource_model=bool(complete and progress is not None and budget_low is not None
            and any(cost + progress > budget_low and (budget_high is None or cost + progress <= budget_high)
                for cost in amounts)),
        irreversible_population_loss=population, irreversible_material_loss=material,
        irreversible_losses_known=population is not None and material is not None,
        conditional_on_refs=tuple(sorted(assumptions)))
