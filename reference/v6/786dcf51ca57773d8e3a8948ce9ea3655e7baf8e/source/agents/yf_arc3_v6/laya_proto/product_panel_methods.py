"""Existing readonly cyclic coverage compiler for an explicitly experimental goal."""
import itertools,time
from agents.yf_arc3_v5.capabilities.cyclic_configuration_coverage import CyclicCoverageRequest,measure_cyclic_configuration_coverage
from terminal_composition import identity
from rooted_quota_methods import plain

def compile_routes(scene,state,obs,remaining,deadline,max_factors):
    n=len(scene['controls'])
    if n>max_factors:return None
    factors=[[str(v)for v in c['values']]for c in scene['controls']]
    # Legend order is only a candidate. Reverse it if actual observed transitions
    # refute the forward direction and support the reverse; abstain otherwise.
    for i,values in enumerate(factors):
        edges=[(str(e['from']),str(e['to']))for e in state['edges']if e['factor']==i]
        variants=[values,list(reversed(values))];fits=[v for v in variants if all(v[(v.index(a)+1)%len(v)]==b for a,b in edges)]
        if not fits:return None
        factors[i]=fits[0]
    model={'model_ref':'conditional:'+identity([factors,state['edges']]),'factors':factors,'bindings':[[f'factor:{i}',i]for i in range(n)],'costs':[[f'factor:{i}',1]for i in range(n)],'independent':True,'initial_credited':True,'catalogue':[[str(v)for v in q]for q in scene['catalogue']],'debit_rule':'reject_if_insufficient','terminal_order':['acceptance','exhaustion'],'sweep_actions':[f'factor:{i}'for i in range(n)]}
    scope={'request_ref':'product:'+identity([obs['observation_ref'],model,state['visited']]),'caller_ref':'public_product_question','parent_consumer_ref':'SRC_composition','parent_goal_ref':'G_official_completion','parent_contribution_ref':'experimentally_cover_measured_catalogue','caller_next_item_ref':obs['observation_ref'],'epoch':obs['level_epoch'],'evidence_revision_ref':obs['observation_ref'],'model_revision_ref':identity(model),'model_status_ref':'conditional_local_cycle_and_independence_hypotheses','event_owner_ref':'SRC','input_domain_complete':True,'assumption_refs':['measured_catalogue_equals_finite_product','legend_order_cycle_candidate_constrained_by_effects','local_effect_independence_remains_conditional','acceptance_is_experimental_catalogue_goal_not_official_game_verdict','reserve_counts_emitted_commands_not_unknown_internal_resource','initial_current_tuple_observed_not_assumed_game_credit']}
    cov={'current':[str(v)for v in scene['current']],'visited':[[str(v)for v in q]for q in state['visited']],'reserve':remaining};best=None
    for order in itertools.permutations(range(n)):
        if time.perf_counter()>=deadline:break
        request=CyclicCoverageRequest(scope=scope,operation_ref='mechanics.cyclic_configuration_coverage.product_sweep',mode_ref='COMPILE',requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=4096,domain_bound=4096,time_bound_ms=max(1,min(300000,int((deadline-time.perf_counter())*1000))),models=[model],state=cov,factor_order=order)
        result=plain(measure_cyclic_configuration_coverage(request).model_dump())
        if result['status']!='COMPLETE':continue
        rows=result['values']['model_correlated_results'];value=rows[0]['result']
        if not value['coverage_complete']:continue
        word=list(value['primitive_word'])[:len(value['event_trace'])];indices=[int(x.split(':')[1])for x in word]
        key=(len(indices),indices)
        if best is None or key<best[0]:best=(key,{'indices':indices,'trace':value['event_trace'],'receipt':result,'factors':factors})
    return best[1]if best else None
