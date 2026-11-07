"""Mechanical partition/cost facts only; no Python rank or future trial sequence."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .feedback_trial_contracts_d import FeedbackTrialBindInputD,FeedbackTrialFactsD,FeedbackTrialChoiceReturnD


def bind_feedback_trial_measure_d(value):
    return value


def measure_feedback_trial_choices_d(value):
    from .articulated_dependency_measurement_c import _nodes
    from .mechanical_return_a import mechanical_request_identity_a
    choice=value.choice;request=choice.calculation;reply=value.reply;missing=[];facts={}
    size=_nodes(immutable_json_data(value),choice.maximum_projection_nodes)
    if size is None:missing.append('code.complete_trial_partition_projection_bound')
    if (request.operation_ref!='trial_partitions' or reply.request!=mechanical_request_identity_a(request,
            'mechanics.feedback_code_identification',request.scope,request.operation_ref,request.mode)
            or reply.source_status!='FOUND' or request.remaining_input_budget is None
            or not request.scope.input_domain_complete
            or request.state is None or not {'WORST_NONWINNING_RESIDUAL','SUM_SQUARED_RESIDUALS'}<=set(request.declared_measures)):
        missing.append('code.current_complete_partition_and_declared_order')
    costs={row.trial_ref:row for row in choice.trial_costs};trials={row.trial_ref:row for row in request.trials}
    if len(costs)!=len(choice.trial_costs) or set(costs)!=set(trials) or choice.unresolved_ref in trials:
        missing.append('code.exact_trial_cost_inventory_and_distinct_need_reference')
    calculation=reply.descriptive_values.get('calculation',FrozenMap())
    payload=calculation.get('values',FrozenMap()) if isinstance(calculation,FrozenMap) else FrozenMap()
    partitions=payload.get('partitions',())
    if {row.get('trial_ref') for row in partitions}!=set(trials):missing.append('code.complete_native_trial_partition_inventory')
    if not missing:
        accounts=payload.get('candidate_accounts',())
        codes=tuple(sorted(set(tuple(row[0]) for row in accounts)))
        for row in partitions:
            ref=row['trial_ref'];cost=costs[ref];measures=dict(row['declared_measures'])
            facts[ref]=FrozenMap({'alternative_ref':ref,'need_row':False,'native_partition_current':True,
                'cost_support_current':cost.support_claim_ref in request.scope.assumption_refs,
                'resource_funded':cost.input_cost<=request.remaining_input_budget and request.state.attempts_remaining>0,
                'preservation_ok':row['preservation']['preserved_exact_ranks_satisfied'],
                'candidate_code_count':len(codes),'trial_equals_unique_code':len(codes)==1 and trials[ref].values==codes[0],
                'information_has_multiple_branches':len(row['branches'])>1,
                'worst_residual':measures['WORST_NONWINNING_RESIDUAL'],
                'sum_squared_residuals':measures['SUM_SQUARED_RESIDUALS'],'input_cost':cost.input_cost})
    facts[choice.unresolved_ref]=FrozenMap({'alternative_ref':choice.unresolved_ref,'need_row':True,
        'worst_residual':0,'sum_squared_residuals':0,'input_cost':0})
    return FeedbackTrialFactsD(request=value,alternative_refs=tuple(sorted(facts)),
        alternative_facts=FrozenMap(facts),missing_refs=tuple(sorted(set(missing))))


def finish_feedback_trial_choice_d(value):
    measured=value.measured;ref=value.source_alternative_ref
    if ref not in measured.alternative_refs:raise ValueError('Source choice must match the current measured bank')
    return FeedbackTrialChoiceReturnD(measured=measured,source_alternative_ref=ref,
        trial_ref=None if ref==measured.request.choice.unresolved_ref else ref)
