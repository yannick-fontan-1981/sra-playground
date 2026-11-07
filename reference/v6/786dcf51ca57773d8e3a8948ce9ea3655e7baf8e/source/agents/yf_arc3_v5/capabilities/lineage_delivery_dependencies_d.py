"""Bounded ancestry of one existing witness; no strategy or necessity selection."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .articulated_dependency_measurement_c import _nodes


def project_lineage_delivery_dependencies_d(request,states,edges,parents,terminal,limit):
    empty=FrozenMap({'complete':False,'need_refs':('lineage_dependencies.current_complete_requested_witness',),
        'examined_count':0,'universal_necessity_attested':False})
    if terminal is None or not request.required_receptor_refs:return empty
    work=_nodes(immutable_json_data((states[0],edges)),limit)
    if work is None:return empty
    edge_index={(row['from_node'],row['to_node'],row['input'].input_ref):row for row in edges}
    path=[];cursor=terminal
    while parents[cursor] is not None:
        work+=1
        if work>limit:return empty
        previous,input_ref=parents[cursor];edge=edge_index.get((previous,cursor,input_ref))
        if edge is None:return empty
        path.append(edge);cursor=previous
    path.reverse()
    initial=states[0];last=states[terminal]
    slots={r.receptor_ref:r for r in initial.receptors};final_slots={r.receptor_ref:r for r in last.receptors}
    remaining=tuple(ref for ref in request.required_receptor_refs if ref in slots and slots[ref].filled_entity_ref is None)
    if len(slots.keys()&set(request.required_receptor_refs))!=len(request.required_receptor_refs):return empty
    vertices=[];current={};deliveries={}
    for entity in initial.entities:
        node=len(vertices);current[entity.entity_ref]=node
        vertices.append(FrozenMap({'node_index':node,'entity_ref':entity.entity_ref,'input_ref':None,
            'parent_node_indices':(),'kind':'CURRENT_OCCURRENCE','entity':immutable_json_data(entity)}))
    for sequence,edge in enumerate(path):
        before=states[edge['from_node']];after=states[edge['to_node']]
        left={e.entity_ref:e for e in before.entities};right={e.entity_ref:e for e in after.entities}
        for event in edge['events']:
            work+=1
            if work>limit:return empty
            if 'parent_occurrences' in event and 'produced_occurrences' in event:
                operands=event['parent_occurrences']
                if not all(ref in current for ref in operands):return empty
                dependencies=tuple(current[ref] for ref in operands)
                for ref in event['produced_occurrences']:
                    if ref not in right:return empty
                    charge=_nodes(immutable_json_data(right[ref]),max(0,limit-work))
                    if charge is None:return empty
                    work+=len(dependencies)+charge+1
                    if work>limit:return empty
                    node=len(vertices);current[ref]=node
                    vertices.append(FrozenMap({'node_index':node,'entity_ref':ref,'input_ref':edge['input'].input_ref,
                        'parent_node_indices':dependencies,'kind':'PRODUCED_OCCURRENCE',
                        'rule_ref':event['rule_ref'],'sequence_index':sequence,'entity':immutable_json_data(right[ref])}))
            elif event.get('kind')=='DELIVERY' and event['receptor_ref'] in remaining:
                carrier=event['entity'];ref=carrier.entity_ref
                if ref not in current:return empty
                deliveries[event['receptor_ref']]=(ref,current[ref],edge['input'].input_ref,sequence)
        # Ordered core changes are separate vertices, including same occurrence identity.
        for ref in sorted(set(left)&set(right)):
            work+=len(left[ref].marks)+len(right[ref].marks)+1
            if work>limit:return empty
            if left[ref].marks!=right[ref].marks:
                if ref not in current:return empty
                node=len(vertices);dependency=current[ref];current[ref]=node
                vertices.append(FrozenMap({'node_index':node,'entity_ref':ref,'input_ref':edge['input'].input_ref,
                    'parent_node_indices':(dependency,),'kind':'CORE_CHANGE','sequence_index':sequence,
                    'before_marks':immutable_json_data(left[ref].marks),'entity':immutable_json_data(right[ref])}))
    target_rows=[];all_nodes=set();complete=all(final_slots[ref].filled_entity_ref==slots[ref].filled_entity_ref
        for ref in request.required_receptor_refs if slots[ref].filled_entity_ref is not None)
    for target in remaining:
        delivery=deliveries.get(target)
        if delivery is None or final_slots[target].filled_entity_ref!=delivery[0]:complete=False;continue
        pending=[delivery[1]];closure=set()
        while pending:
            node=pending.pop();work+=1
            if work>limit:return empty
            if node in closure:continue
            closure.add(node);pending.extend(vertices[node]['parent_node_indices'])
        all_nodes.update(closure)
        target_rows.append(FrozenMap({'receptor_ref':target,'delivered_entity_ref':delivery[0],
            'delivery_input_ref':delivery[2],'delivery_sequence_index':delivery[3],
            'ancestor_node_indices':tuple(sorted(closure)),
            'core_change_node_indices':tuple(n for n in sorted(closure) if vertices[n]['kind']=='CORE_CHANGE'),
            'production_node_indices':tuple(n for n in sorted(closure) if vertices[n]['kind']=='PRODUCED_OCCURRENCE')}))
    used_occurrences={vertices[n]['entity_ref'] for n in sorted(all_nodes)}
    work+=len(all_nodes)+len(initial.entities)
    if work>limit:return empty
    return FrozenMap({'complete':complete and len(target_rows)==len(remaining),'remaining_request_refs':remaining,
        'preserved_filled_request_refs':tuple(ref for ref in request.required_receptor_refs if slots[ref].filled_entity_ref is not None),
        'target_rows':tuple(target_rows),'ancestor_vertices':tuple(vertices[n] for n in sorted(all_nodes)),
        'unused_current_occurrence_refs':tuple(e.entity_ref for e in initial.entities if e.entity_ref not in used_occurrences),
        'need_refs':() if complete else ('lineage_dependencies.remaining_request_delivery',),
        'conditional_witness_only':True,'universal_necessity_attested':False,'examined_count':work})
