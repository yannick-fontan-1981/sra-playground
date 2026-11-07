"""Exact objective/cost correspondence, not strategy choice or heuristic weights."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .search_objective_contracts_d import SearchObjectiveFactsD


def measure_search_objective_d(request):
    from .articulated_dependency_measurement_c import _nodes
    objective=request.objective
    if objective is None:
        return SearchObjectiveFactsD(facts=FrozenMap({'objective_requested':False,
            'objective_bound':True,'existing_cost_contract_unchanged':True}),missing_refs=(),scalar_multipliers=())
    missing=[]
    identity=request.request
    components=objective.components
    if (len({row.component_ref for row in components})!=len(components)
            or identity.immutable_inputs.get('declared_search_objective')!=immutable_json_data(objective)
            or identity.immutable_inputs.get('cost_metric_ref')!=objective.cost_metric_ref):
        missing.append('search_objective.exact_source_declared_objective_order')
    depth=identity.actual_bounds.get('max_depth')
    if type(depth) is not int or depth<0:
        missing.append('search_objective.explicit_primitive_horizon')
    elif any(row.maximum_per_primitive*depth>row.maximum_path_total for row in components):
        missing.append('search_objective.component_total_bound_covers_entire_horizon')
    multipliers=[1]*len(components)
    for index in range(len(components)-2,-1,-1):
        multipliers[index]=multipliers[index+1]*(components[index+1].maximum_path_total+1)
    packet_refs=tuple(packet.request.request_ref for packet in request.packets)
    if len(set(packet_refs))!=len(packet_refs) or set(objective.packet_cost_vectors)!=set(packet_refs):
        missing.append('search_objective.exact_all_packet_vector_inventory')
    visits=0
    limit=identity.actual_bounds.get('max_state_visits',0)
    if _nodes(immutable_json_data(objective),limit) is None:
        missing.append('search_objective.complete_objective_projection_bound')
    else:
        for packet in request.packets:
            visits+=len(components)+1
            if visits>limit:
                missing.append('search_objective.packet_component_comparison_bound');break
            vector=objective.packet_cost_vectors.get(packet.request.request_ref)
            if (not isinstance(vector,tuple) or len(vector)!=len(components)
                    or any(type(value) is not int or value<0 or value>component.maximum_per_primitive
                        for value,component in zip(vector,components))):
                missing.append('search_objective.typed_complete_nonnegative_cost_vector');continue
            if (packet.request.immutable_inputs.get('cost_metric_ref')!=objective.cost_metric_ref
                    or packet.request.immutable_inputs.get('declared_cost_vector')!=vector
                    or packet.cost!=sum(value*multiplier for value,multiplier in zip(vector,multipliers))):
                missing.append('search_objective.exact_native_packet_cost_correspondence')
    refs=tuple(sorted(set(missing)))
    return SearchObjectiveFactsD(facts=FrozenMap({'objective_requested':True,'objective_bound':not refs,
        'objective_ref':objective.objective_ref,'component_order':tuple(row.component_ref for row in components),
        'scalar_multipliers':tuple(multipliers),'actual_bounds':identity.actual_bounds,
        'metric_substituted':False,'lexicographic_encoding_not_blended_score':True}),
        missing_refs=refs,scalar_multipliers=tuple(multipliers))


def retain_search_objective_need_d(request):
    """Copy the exact failed contract; no search, substitute metric or fallback."""
    from .mechanical_common_contracts_c import SearchResultC
    measured=measure_search_objective_d(request)
    return SearchResultC(request=request.request,witnesses=(),current_prefix=(),
        complete=False,bounded=False,contradictory=False,examined_count=0,
        declared_domain_size=request.declared_domain_size,missing_refs=measured.missing_refs,
        requested_steps=(),continuation=request.continuation,
        facts=FrozenMap({'search_objective':measured.facts,'missing_measurement':True,
            'witness_count':0,'named_domain_exhausted':False}))
