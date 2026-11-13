"""Encode licensed trait transitions for existing K09 DP/CSP; no new search."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .finite_search_contracts_c import FiniteVariableC,FiniteRelationC,FiniteSearchInputC
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_search_driver_contracts_c import SearchPrimitiveC
from .device_solving_contracts_c import DeviceStageEditGroupC
from .articulated_dependency_measurement_c import _nodes


def build_device_edit_chain(request,ordinal,edit,actuators,evidence_refs,maximum_work):
    selected=tuple(actuator for actuator in actuators if actuator.slot_ref==edit["slot_ref"]
        and actuator.trait_ref==edit["trait_ref"] and actuator.hit_point in edit["hit_region"]
        and actuator.payload.get("x")==actuator.hit_point[0] and actuator.payload.get("y")==actuator.hit_point[1])
    transitions={};branching=False;unique=[]
    for actuator in selected:
        transition=(actuator.before,actuator.after,actuator.action_ref,actuator.payload,actuator.hit_point)
        if transition in unique:continue
        unique.append(transition)
        if actuator.before in transitions:branching=True
        transitions[actuator.before]=True
    selected=tuple(next(actuator for actuator in selected if
        (actuator.before,actuator.after,actuator.action_ref,actuator.payload,actuator.hit_point)==transition)
        for transition in unique)
    states=tuple(sorted({edit["before"],edit["after"],*(actuator.before for actuator in selected),*(actuator.after for actuator in selected)}))
    # A positive-cost minimum path never needs a repeated trait value. This
    # bounds the supplied transition graph, without claiming unknown commands
    # are absent from the physical interface.
    depth=max(1,len(states)-1)
    if len(states)>42 or len(selected)>127 or maximum_work<1:return None,None,("device.compiler_finite_transition_domain_bound",)
    prefix="device.edit.chain."+stable_digest((request.demand,ordinal,edit))
    padding=prefix+".pad"
    actions=tuple((prefix+".command."+str(index),actuator) for index,actuator in enumerate(selected))
    refs=tuple(ref for ref,_actuator in actions)+(padding,)
    variables=[];relations=[];order=[]
    initial=prefix+".value.0"
    variables.append(FiniteVariableC(variable_ref=initial,values=(edit["before"],),costs=FrozenMap({edit["before"]:0})));order.append(initial)
    for index in range(depth):
        current=prefix+".value."+str(index);command=prefix+".action."+str(index);following=prefix+".value."+str(index+1)
        variables.append(FiniteVariableC(variable_ref=command,values=refs,costs=FrozenMap({ref:0 if ref==padding else 1 for ref in refs})))
        values=(edit["after"],) if index==depth-1 else states
        variables.append(FiniteVariableC(variable_ref=following,values=values,costs=FrozenMap({value:0 for value in values})))
        order.extend((command,following))
        rows=tuple((actuator.before,ref,actuator.after) for ref,actuator in actions)+((edit["after"],padding,edit["after"]),)
        relations.append(FiniteRelationC(relation_ref=prefix+".transition."+str(index),variable_refs=(current,command,following),allowed_rows=rows,domain_complete=True))
    variables=tuple(variables);relations=tuple(relations);order=tuple(order);evidence=tuple(sorted(set(evidence_refs)))
    descriptor=(variables,relations,order,"external_primitive_count",True,evidence)
    identity=MechanicalRequestIdentity(request_ref=prefix,kernel_ref="mechanics.bounded_route_search",
        operation_ref="mechanics.bounded_route_search.finite_relations",mode="CSP" if branching else "DP",caller_ref=request.native_request.scope.caller_ref,
        parent_contribution_ref=request.native_request.scope.parent_contribution_ref,epoch=request.native_request.scope.epoch,
        input_revision_ref=request.native_request.scope.evidence_revision_ref,model_assignments=FrozenMap(),
        immutable_inputs=FrozenMap({"finite_relation_digest":stable_digest(immutable_json_data(descriptor)),"cost_metric_ref":"external_primitive_count"}),
        actual_bounds=FrozenMap({"max_candidates":maximum_work,"max_states":min(4096,maximum_work),"max_depth":len(variables)}),
        expected_return_type="FiniteSearchFactsC",requested_domain_ref="current_supported_trait_transitions")
    query=FiniteSearchInputC(request=identity,variables=variables,relations=relations,variable_order=order,
        cost_metric_ref="external_primitive_count",domain_complete=True,evidence_refs=evidence)
    metadata=FrozenMap({"edit":edit,"actions":FrozenMap({ref:immutable_json_data(actuator) for ref,actuator in actions}),
        "padding_ref":padding,"command_variables":tuple(prefix+".action."+str(index) for index in range(depth)),
        "known_transition_domain_only":True,"branching_command_domain":branching,"physical_interface_completeness_claimed":False})
    return query,metadata,()


def bind_device_edit_chain(value):return value.measured.chain_queries[value.index]


def append_device_edit_chain(value):
    measured=value.measured;query=measured.chain_queries[value.index];metadata=measured.chain_metadata[value.index]
    missing=list(measured.missing_refs);groups=list(measured.groups);result=value.result
    domains=list(measured.facts.get("edit_alternative_domains",()))
    request=measured.returned.frozen_measurement.frozen_input
    work=measured.accounted_evaluations+result.examined_count
    available=max(0,request.parent_maximum_evaluations-measured.returned.parent_return.get("accounted_evaluations",0)-work)
    source_population=result.retained_frontier if metadata["branching_command_domain"] else result.assignments
    projection=_nodes(source_population,available//3)
    if result.request!=query:missing.append("device.compiler_exact_K09_transition_return")
    elif result.bounded or not result.complete or result.missing_refs:
        missing.extend(result.missing_refs);missing.append("device.compiler_transition_path_domain_unfinished")
    elif not result.assignments:
        missing.append("device.compiler_no_path_in_current_supported_transitions")
    elif projection is None:
        missing.append("device.compiler_complete_minimum_population_projection_bound")
    else:
        work+=3*projection
        # CSP retains the complete terminal population. Its three-witness
        # convenience view cannot establish uniqueness. DP is used only for
        # a graph with one command per value.
        population=tuple(row["assignment"] for row in result.retained_frontier
            if row["cost"]==result.minimum_cost) if metadata["branching_command_domain"] else result.assignments
        words=tuple(dict.fromkeys(tuple(row[var] for var in metadata["command_variables"]
            if row[var]!=metadata["padding_ref"]) for row in population))
        if not words:missing.append("device.compiler_complete_minimum_command_population")
        elif len(words)>1:
            alternatives=[]
            for word in words:
                primitives=tuple(immutable_json_data(SearchPrimitiveC(
                    primitive_ref="primitive.device.chain."+stable_digest((query.request,ordinal,ref)),
                    action_ref=metadata["actions"][ref]["action_ref"],data=metadata["actions"][ref]["payload"],cost=1))
                    for ordinal,ref in enumerate(word))
                alternatives.append(FrozenMap({"path_ref":"device.edit.path."+stable_digest((query.request,word)),
                    "primitives":primitives,"primitive_count":len(primitives)}))
            domains.append(FrozenMap({"edit":metadata["edit"],"alternatives":tuple(alternatives),
                "minimum_cost":result.minimum_cost,"domain_complete":True,"query":immutable_json_data(query),
                "evidence_refs":query.evidence_refs,"frozen_why":immutable_json_data(request.why),
                "request_ref":query.request.request_ref,"input_revision_ref":query.request.input_revision_ref,
                "current_supported_transition_domain_only":True,"execution_authority":False}))
        else:
            primitives=[]
            for ordinal,ref in enumerate(words[0]):
                actuator=metadata["actions"][ref]
                primitives.append(SearchPrimitiveC(primitive_ref="primitive.device.chain."+stable_digest((query.request,ordinal,ref)),
                    action_ref=actuator["action_ref"],data=actuator["payload"],cost=1))
            edit=metadata["edit"]
            groups.append(DeviceStageEditGroupC(slot_ref=edit["slot_ref"],trait_ref=edit["trait_ref"],before=edit["before"],after=edit["after"],primitives=tuple(primitives)))
    encoded=_nodes(tuple(domains),max(0,request.parent_maximum_evaluations-
        measured.returned.parent_return.get("accounted_evaluations",0)-work))
    if encoded is None:
        missing.append("device.compiler_complete_command_domain_transport_bound");domains=list(measured.facts.get("edit_alternative_domains",()))
    else:work+=encoded
    if work+measured.returned.parent_return.get("accounted_evaluations",0)>request.parent_maximum_evaluations:
        missing.append("device.compiler_K09_chains_global_parent_work_bound")
    positions={tuple(key):index for index,key in enumerate(measured.facts.get("native_edit_order",()))}
    groups=sorted(groups,key=lambda group:positions[(group.slot_ref,group.trait_ref,group.before,group.after)])
    complete=len(groups)==len(positions)
    covered=tuple((group.slot_ref,group.trait_ref,group.before,group.after) for group in groups)+tuple(
        (domain["edit"]["slot_ref"],domain["edit"]["trait_ref"],domain["edit"]["before"],domain["edit"]["after"]) for domain in domains)
    if len(set(covered))!=len(covered):missing.append("device.compiler_unique_edit_domain_population")
    domain_complete=set(covered)==set(positions) and not bool(missing)
    primitives=tuple(immutable_json_data(primitive) for group in groups for primitive in group.primitives)
    facts=FrozenMap({**dict(measured.facts),"compiler_bound":complete and not bool(missing),"edit_groups":immutable_json_data(tuple(groups)),
        "primitive_proposals":primitives,"primitive_count":len(primitives),"edit_alternative_domains":tuple(domains),
        "edit_domain_bound":domain_complete and bool(domains),"minimum_command_selection_required":bool(domains)})
    return measured.model_copy(update={"groups":tuple(groups),"facts":facts,"missing_refs":tuple(sorted(set(missing))),"accounted_evaluations":work})
