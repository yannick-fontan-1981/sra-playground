"""Bounded BFS of supplied quantity/identity dynamics, retaining one witness."""
from collections import deque
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .conservative_quantity_identity import quantity_transfer_successor,quantity_door_successor,QuantityTag


def measure_quantity_route_d(request,budget):
    spec=request.planning;compartments={row.compartment_ref:row for row in request.compartments}
    tags={row.tag_ref:row for row in request.tags};controls={row.control_ref:row for row in spec.controls}
    refs=tuple(compartments);tag_refs=tuple(tags)
    missing=[]
    if request.resume_state is not None:missing.append('quantity_route.incremental_resume_not_implemented')
    if any(row.capacity is None for row in request.compartments):missing.append('quantity_route.current_hard_capacity_model')
    if any(goal.tag_ref not in tags or goal.compartment_ref not in compartments for goal in spec.goals):
        missing.append('quantity_route.current_target_identity_and_compartment')
    for ref,interval in sorted(spec.preserved_intervals.items()):
        if (ref not in compartments or not isinstance(interval,tuple) or len(interval)!=2
                or any(type(value) is not int for value in interval) or not 0<=interval[0]<=interval[1]):
            missing.append('quantity_route.current_preserved_quantity_interval')
    if missing:return {},tuple(dict.fromkeys(missing)),False,{}
    if any(not interval[0]<=compartments[ref].quantity<=interval[1] for ref,interval in sorted(spec.preserved_intervals.items())):
        return {},('quantity_route.current_initial_preservation_constraints',),False,{}
    def state_key(quantities,identities):
        return (tuple(quantities[ref] for ref in refs),tuple((identities[ref].owner_compartment_ref,
            identities[ref].local_offset,identities[ref].pose) for ref in tag_refs))
    initial=state_key({ref:row.quantity for ref,row in sorted(compartments.items())},tags)
    queue=deque((initial,));records={initial:(None,None,0)};expanded=0;depth_limited=False;debts=set()
    found=None
    while queue:
        key=queue.popleft();previous,control_ref,depth=records[key]
        quantities=dict(zip(refs,key[0]))
        identities={ref:tags[ref].model_copy(update={'owner_compartment_ref':row[0],'local_offset':row[1],'pose':row[2]})
            for ref,row in zip(tag_refs,key[1])}
        if not budget.take(len(refs)+len(tag_refs)+len(spec.goals)):break
        if all(identities[goal.tag_ref].owner_compartment_ref==goal.compartment_ref
                and goal.quantity_interval[0]<=quantities[goal.compartment_ref]<=goal.quantity_interval[1]
                and (goal.target_pose is None or identities[goal.tag_ref].pose==goal.target_pose) for goal in spec.goals):
            found=key;break
        if depth>=spec.maximum_depth:depth_limited=True;continue
        model=request.model_copy(update={'compartments':tuple(compartments[ref].model_copy(update={'quantity':quantities[ref]}) for ref in refs),
            'tags':tuple(identities[ref] for ref in tag_refs)})
        for ref in spec.traversal_order:
            control=controls[ref]
            work=len(refs)+len(tag_refs)+len(request.transfers)+len(request.doors)
            work+=sum(len(row.support_samples) for row in model.compartments)
            if not budget.take(work):break
            if control.kind=='TRANSFER':
                query=model.model_copy(update={'requested_transfer_ref':control.operation_ref})
                value,need=quantity_transfer_successor(query)
            else:
                query=model.model_copy(update={'requested_door_ref':control.operation_ref,'transported_tag_refs':control.transported_tag_refs})
                value,need=quantity_door_successor(query)
            expanded+=1
            if need:debts.update(need);continue
            if value.get('accepted') is not True:continue
            next_quantities=value['quantities_after']
            if any(not interval[0]<=next_quantities[ref]<=interval[1] for ref,interval in sorted(spec.preserved_intervals.items())):continue
            next_tags={row['tag_ref']:QuantityTag.model_validate(row) for row in value['tags_after']}
            successor=state_key(next_quantities,next_tags)
            if successor in records:continue
            if len(records)>=spec.maximum_states:
                return {'route_witnesses':(),'states_visited':len(records),'edges_examined':expanded},('quantity_route.state_bound',),False,{}
            records[successor]=(key,ref,depth+1);queue.append(successor)
        if budget.reached:break
    path=[]
    if found is not None:
        cursor=found
        while records[cursor][0] is not None:
            parent,ref,depth=records[cursor];path.append(FrozenMap({'control_ref':ref,
                'quantities_before':tuple(zip(refs,parent[0])),'quantities_after':tuple(zip(refs,cursor[0])),
                'identities_before':tuple(zip(tag_refs,parent[1])),'identities_after':tuple(zip(tag_refs,cursor[1]))}));cursor=parent
        path.reverse()
    complete=found is not None or not queue and not budget.reached and not depth_limited and not debts
    needs=() if found is not None else tuple(sorted(debts))+(() if complete else ('quantity_route.remaining_bounded_or_depth_frontier',))
    from .quantity_route_dependencies_d import measure_quantity_route_dependencies_d
    dependencies=measure_quantity_route_dependencies_d(request,tuple(path),budget) if found is not None else FrozenMap()
    if found is not None and not dependencies.get('dependency_projection_complete'):
        complete=False;needs=tuple(dict.fromkeys((*needs,*dependencies.get('dependency_information_need_refs',()))))
    return {'route_witnesses':(tuple(path),) if found is not None else (),
        'route_dependency_projection':dependencies,
        'states_visited':len(records),'edges_examined':expanded,'terminal_tag_goals':immutable_json_data(spec.goals),
        'implicit_terminal_surplus_distribution_constraints':False,'actions_authorized':False,
        'first_complete_witness_in_source_order':found is not None,
        'unresolved_alternative_transition_refs':tuple(sorted(debts)),
        'global_optimality_across_unresolved_models_proved':False},needs,complete,{}
