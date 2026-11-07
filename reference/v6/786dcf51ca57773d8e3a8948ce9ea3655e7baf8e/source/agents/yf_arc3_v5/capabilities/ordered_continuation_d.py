"""Pure continuation budget arithmetic, separate from immediate input legality."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_ordered_budget_continuation_d(request,values):
    contract=request.budget_continuation
    if contract is None:return FrozenMap({'explicit_continuation_budget_present':False})
    missing=[]
    if (contract.parent_goal_ref!=request.scope.parent_goal_ref
            or contract.parent_contribution_ref!=request.scope.parent_contribution_ref
            or contract.model_ref!=request.bound_model_ref
            or contract.allowance_claim_ref not in request.scope.assumption_refs
            or contract.remaining_bound_claim_ref not in request.scope.assumption_refs
            or contract.allowance_claim_ref==contract.remaining_bound_claim_ref):
        missing.append('ordered.current_consumer_model_and_supported_budget_bounds')
    available=contract.declared_allowance-contract.consumed_budget_charge
    if available<0 or available!=request.state.remaining_budget:
        missing.append('ordered.actual_consumed_charge_and_remaining_allowance')
    charge=values['budget_charge']
    if charge>contract.supported_remaining_upper_bound:
        missing.append('ordered.recomputed_word_inside_supported_remaining_upper_bound')
    return FrozenMap({'explicit_continuation_budget_present':True,'missing_refs':tuple(missing),
        'parent_goal_ref':contract.parent_goal_ref,'parent_contribution_ref':contract.parent_contribution_ref,
        'allowance_claim_ref':contract.allowance_claim_ref,'remaining_bound_claim_ref':contract.remaining_bound_claim_ref,
        'consumed_budget_charge':contract.consumed_budget_charge,'declared_allowance':contract.declared_allowance,
        'supported_remaining_upper_bound':contract.supported_remaining_upper_bound,
        'recomputed_remaining_word_charge':charge,'consumed_plus_supported_remaining_bound':
            contract.consumed_budget_charge+contract.supported_remaining_upper_bound,
        'consumed_plus_recomputed_word_charge':contract.consumed_budget_charge+charge,
        'supported_bound_inside_allowance':contract.consumed_budget_charge+contract.supported_remaining_upper_bound<=contract.declared_allowance,
        'recomputed_word_inside_allowance':contract.consumed_budget_charge+charge<=contract.declared_allowance,
        'immediate_legality_is_complete_continuation_proof':False,
        'global_minimum_proved':False,'actor_input_authorized':False})
