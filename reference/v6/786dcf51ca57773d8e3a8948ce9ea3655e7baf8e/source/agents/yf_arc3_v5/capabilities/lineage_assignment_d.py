"""Bounded exact bipartite reservation in caller order, one reconstructed witness."""
from collections import deque


def calculate_lineage_assignment_d(request,state,accepts,associations,family_result):
    requested=set(request.required_receptor_refs)
    receptors=tuple(r for r in state.receptors if r.filled_entity_ref is None
        and (not requested or r.receptor_ref in requested))
    missing_refs=tuple(ref for ref in request.required_receptor_refs if not any(r.receptor_ref==ref for r in state.receptors))
    entities=tuple(e for e in state.entities if e.kind=='DESCENDANT')
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    count=sum((len(e.marks)+len(r.required_signature or ())+sum(len(a.signature) for a in associations)+8)
        for r in receptors for e in entities)
    if count>request.maximum_evaluations:
        return family_result(request,domain_complete=False,computation_bound_reached=True,
            frontier={'phase':'lineage_assignment_edges'})
    compatibility={};uncertain=[]
    for receptor in receptors:
        refs=[]
        for entity in entities:
            value=accepts(entity,receptor,associations)
            if value is True:refs.append(entity.entity_ref)
            elif value is None:uncertain.append((entity.entity_ref,receptor.receptor_ref))
        compatibility[receptor.receptor_ref]=tuple(refs)
    needs=list(missing_refs)
    if model is None:needs.append('lineage_assignment.current_delivery_consumption_protocol')
    reusable=model is not None and not model.delivery_consumes
    assigned={};owner={};bounded=False
    for receptor in receptors:
        start=receptor.receptor_ref
        if reusable:
            if compatibility[start]:assigned[start]=compatibility[start][0]
            continue
        queue=deque((start,));seen={start};links={};free=None
        while queue and free is None:
            ref=queue.popleft()
            for entity_ref in compatibility[ref]:
                if count>=request.maximum_evaluations:bounded=True;break
                count+=1
                if entity_ref in links:continue
                links[entity_ref]=ref
                previous=owner.get(entity_ref)
                if previous is None:free=entity_ref;break
                if previous not in seen:seen.add(previous);queue.append(previous)
            if bounded:break
        if bounded:break
        while free is not None:
            ref=links[free];previous=assigned.get(ref)
            assigned[ref]=free;owner[free]=ref;free=previous
    assignment=tuple((r.receptor_ref,assigned.get(r.receptor_ref)) for r in receptors)
    missing_production=tuple(ref for ref,entity in assignment if entity is None)
    complete=not bounded and not missing_production and not needs
    rows=({'assignment':assignment,'missing_production_request_refs':missing_production,
        'complete_assignment':complete,'reservation_reuses_descendants':reusable,
        'missing_requests_are_relative_to_this_matching':True},) if not bounded else ()
    return family_result(request,values={'joint_assignments':rows,'compatible_descendant_request_edges':compatibility,
        'unknown_acceptance_edges':tuple(uncertain),'remaining_requested_receptor_refs':tuple(r.receptor_ref for r in receptors),
        'preserved_occupied_receptor_refs':tuple(r.receptor_ref for r in state.receptors if r.filled_entity_ref is not None),
        'birth_lineage_must_match_request':False,'first_witness_in_supplied_order':True,
        'assignment_is_not_an_executable_word':True},prerequisite_refs=tuple(needs),examined_count=count,
        domain_complete=not bounded and not uncertain and not needs,computation_bound_reached=bounded,
        frontier={'phase':'lineage_assignment_augmenting_search','matched_request_refs':tuple(sorted(assigned))} if bounded else {})
