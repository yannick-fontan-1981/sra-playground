"""Thin caller of existing readonly mechanical prefix contracts."""
import time
from collections.abc import Mapping
from agents.yf_arc3_v5.capabilities.rooted_prefix_marginals_d import RootedPrefixMarginalsRequestD,measure_rooted_prefix_marginals_d
from agents.yf_arc3_v5.capabilities.indexed_prefix_primitive_d import IndexedPrefixPrimitiveRequestD,measure_indexed_prefix_primitive_d
from terminal_composition import identity
def plain(v):
    if isinstance(v,Mapping):return {k:plain(x)for k,x in v.items()}
    if isinstance(v,(tuple,list)):return [plain(x)for x in v]
    return v
def scope(obs,model,contribution):
    return {'request_ref':'request:'+identity([obs['observation_ref'],contribution]),'caller_ref':'public_rooted_quota_composition','parent_consumer_ref':'SRC_composition','parent_goal_ref':'G_official_completion','parent_contribution_ref':contribution,'caller_next_item_ref':obs['observation_ref'],'epoch':obs['level_epoch'],'evidence_revision_ref':obs['observation_ref'],'model_revision_ref':identity(model),'model_status_ref':'conditional_public_hypothesis_with_observed_edit_examples','event_owner_ref':'SRC','input_domain_complete':True,'assumption_refs':['measured_marks_as_required_integer_marginals','wider_endpoint_as_root','scoped_prefix_edit_transfer']}
def cells(scene):return [{'chain_ref':f'chain:{i}','cells':[{'cell_ref':f'cell:{x}:{y}','marginal_refs':[f'row:{y}',f'column:{x}']}for x,y in ch['cells']]}for i,ch in enumerate(scene['chains'])]
def quotas(scene):return [{'marginal_ref':f'{axis}:{i}','required_count':v}for axis,values in(('row',scene['row_marks']),('column',scene['column_marks']))for i,v in enumerate(values)]
def request_base(obs,model,contribution,deadline):
    return {'scope':scope(obs,model,contribution),'requested_result_type':'DMechanicalResult','node_bound':100000,'depth_bound':4096,'domain_bound':4096,'time_bound_ms':max(1,min(300000,int((deadline-time.perf_counter())*1000)))}
def propagate(scene,obs,model,deadline):
    chains=[{**c,'length_domain':list(range(len(c['cells'])+1))}for c in cells(scene)];request=RootedPrefixMarginalsRequestD(**request_base(obs,model,'conditional_joint_marginals',deadline),operation_ref='mechanics.coupled_value_constraints.rooted_prefix_marginals',mode_ref='PROPAGATE',phase_ref='INTEGER_QUOTA_CONSTRAINTS',chains=chains,quotas=quotas(scene));result=measure_rooted_prefix_marginals_d(request);return plain(result.model_dump())
def step(scene,lengths,chain,rank,obs,model,deadline):
    assert model.get('addition_observed')and model.get('cut_observed')
    request=IndexedPrefixPrimitiveRequestD(**request_base(obs,model,'conditional_indexed_edit',deadline),operation_ref='mechanics.editable_configuration_graph.indexed_prefix_external_primitive',mode_ref='STEP',phase_ref='EXTERNAL_COMMAND',chains=[{**c,'filled_length':n}for c,n in zip(cells(scene),lengths)],quotas=quotas(scene),channel='CLICK',bound_chain_ref=f'chain:{chain}',bound_rank=rank,native_focus_chain_ref=None,native_focus_rank=None,inclusive_fill_exclusive_cut_supported=True,focus_initial_selection_supported=False,focus_boundary_rule='REFUSE',focus_delta=0,submitted_cost=1,selection_cost=0,mutation_cost=0,quota_acceptance_supported=False)
    return plain(measure_indexed_prefix_primitive_d(request).model_dump())
