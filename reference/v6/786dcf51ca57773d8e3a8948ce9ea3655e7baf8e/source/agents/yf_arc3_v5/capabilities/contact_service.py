"""Bounded geometric contact-service witnesses under a declared experiment model."""
from collections import deque


def measure_contact_services(value, bodies, assignments, contract, *, point_action_ref=None):
    empty={'contact_service_witness_present':False}
    if not contract or not (2 <= len(bodies) <= int(contract['max_bodies'])):
        return empty
    memories=tuple(m for m in value.canonical_contact_transport_facts
        if m.get('stationary_initiator_observed') and int(m.get('ordinary_quantum',0))>0
        and m.get('memory_claim_ref') and all(b.value==m.get('observed_value') for b in bodies))
    floors=frozenset((*value.episode_input_aligned_underlay_values,*value.current_input_aligned_underlay_values))
    point=getattr(value,'last_point_position',None)
    point_test=bool(contract.get('point_selection_requires_one_current_directional_test')
        and point_action_ref and getattr(value,'last_action_ref',None)==point_action_ref and point is not None)
    quanta={abs(dy)+abs(dx) for _,dy,dx in value.known_action_translation_deltas if bool(dy)!=bool(dx)}
    if not memories or not floors or not quanta:
        return empty
    q=min(quanta)
    distances={((abs(int(m.get('delta_row',0)))+abs(int(m.get('delta_col',0))))*q)//int(m['ordinary_quantum'])
        for m in memories if (abs(int(m.get('delta_row',0)))+abs(int(m.get('delta_col',0))))%int(m['ordinary_quantum'])==0}
    if len(distances)!=1:
        return empty
    distance,=distances
    transit=frozenset(v for m in memories for v in m.get('transit_values',()))|floors
    steps=tuple(sorted((a,dy*q,dx*q) for a,dy,dx in value.interface_action_translation_deltas
        if abs(dy)+abs(dx)==1))
    if not steps:
        return empty
    frame=value.current_observed_frame or value.frame
    bodies=tuple(sorted(bodies,key=lambda b:b.component_id))
    starts=tuple((b.bbox.top,b.bbox.left) for b in bodies)
    sizes=tuple((b.bbox.height,b.bbox.width) for b in bodies)
    goals=tuple((int(assignments[b.component_id]['assigned_zone_cell_middle_row'])-(b.bbox.height-1)//2,
                 int(assignments[b.component_id]['assigned_zone_cell_middle_col'])-(b.bbox.width-1)//2) for b in bodies)
    from .enclosure_transfer_graph import measure_transfer_lower_bounds
    transfer_contract=contract.get('required_transfer_frontier_contract',{})
    transfer_frontier=measure_transfer_lower_bounds(frame,starts,sizes,goals,floors,transit,q,distance,
        dict(contract)|dict(transfer_contract))
    transfer_counts=transfer_frontier.get('minimum_transfers',())
    frontier_facts={}
    if transfer_frontier.get('complete') is True:
        frontier_facts={
            'contact_service_required_transfer_frontier_present':True,
            'contact_service_maximum_required_terrain_transfers':max(transfer_counts),
            'contact_service_required_transfer_rows':tuple((body.component_id,*size,count)
                for body,size,count in zip(bodies,sizes,transfer_counts)),
            'contact_service_terrain_graph_proves_actor_availability':False,
        }
    cascade_details={}
    def witness_priority(witness):
        fields=transfer_contract.get('witness_priority_fields',()) if frontier_facts else ()
        if not fields:return (witness[0],)
        detail=cascade_details.get(witness,{})
        measured={'beneficiary_minimum_required_terrain_transfers':detail.get('beneficiary_minimum_required_terrain_transfers',transfer_counts[witness[2]]),
                  'useful_affected_body_count':detail.get('useful_affected_body_count',int(transfer_counts[witness[2]]>0)),
                  'primitive_cost':witness[0]}
        return tuple((-1 if item['direction']=='descending' else 1)*measured[item['field']]
                     for item in fields)
    def pixels(pos,size):
        return {(r,c) for r in range(pos[0],pos[0]+size[0]) for c in range(pos[1],pos[1]+size[1])}
    occupied=tuple(pixels(pos,size) for pos,size in zip(starts,sizes))
    # Exact target interiors and their enclosing outlines are already assigned.
    goal_regions=set().union(*(pixels((p[0]-1,p[1]-1),(s[0]+2,s[1]+2)) for p,s in zip(goals,sizes)))
    def valid(index,pos,*,crossing=False,ignore=frozenset(),obstacles=occupied):
        h,w=sizes[index];r,c=pos
        if r<0 or c<0 or r+h>frame.height or c+w>frame.width: return False
        footprint=pixels(pos,sizes[index])
        if any(footprint & pts for j,pts in enumerate(obstacles) if j!=index and j not in ignore): return False
        allowed=transit if crossing else floors
        return all(p in occupied[index] or p in goal_regions or frame.rows[p[0]][p[1]] in allowed for p in footprint)
    expanded=int(transfer_frontier.get('expanded',0))
    def reachable(index,start,obstacles=occupied):
        nonlocal expanded
        queue=deque((start,)); paths={start:()}
        while queue:
            pos=queue.popleft()
            expanded+=1
            if expanded>int(contract.get('max_total_state_expansions',131072)): return None
            for action,dy,dx in steps:
                dest=(pos[0]+dy,pos[1]+dx)
                if dest in paths or not valid(index,dest,obstacles=obstacles): continue
                if len(paths)>=int(contract['max_states_per_body']): return None
                if len(paths[pos])>=int(contract['max_route_length']): continue
                paths[dest]=(*paths[pos],action);queue.append(dest)
        return paths
    reach=tuple(reachable(i,p) for i,p in enumerate(starts))
    if any(row is None for row in reach): return empty
    inaccessible=tuple(i for i in range(len(bodies)) if goals[i] not in reach[i])
    if not inaccessible: return empty|frontier_facts
    controlled=tuple(i for i,b in enumerate(bodies) if b.bbox in value.input_aligned_entity_bboxes)
    if contract.get('use_unique_canonical_control_geometry'):
        canonical_boxes=getattr(value,'canonical_provisional_control_geometry_bboxes',())
        canonical=tuple(i for i,b in enumerate(bodies) if b.bbox in canonical_boxes)
        if len(canonical)==1:
            controlled=canonical
    reconstructed=tuple(i for i,b in enumerate(bodies) if getattr(b,'source_control_entity_ref',None))
    if len(reconstructed)==1:
        controlled=reconstructed
    control_test=False
    if point_test:
        pointed=tuple(i for i,b in enumerate(bodies)
            if b.bbox.top<=point[0]<=b.bbox.bottom and b.bbox.left<=point[1]<=b.bbox.right)
        if len(pointed)==1:
            controlled=pointed
            control_test=True
    if len(controlled)!=1: return empty
    witnesses=[]
    structural_count=0
    witness_bound=int(contract['max_witnesses'])
    for charge in inaccessible:
        ch,cw=sizes[charge]
        staged=sorted(reach[charge].items(),key=lambda item:(len(item[1]),item[1],item[0])) if contract.get('allow_reachable_charge_preparation') else [(starts[charge],())]
        actor_reach_cache={}
        for actor in range(len(bodies)):
            if actor==charge: continue
            for action,dy,dx in steps:
                structural_count+=1
                if structural_count>int(contract.get('max_structural_descriptions',128)): return empty
                ah,aw=sizes[actor]
                uy,ux=dy//q,dx//q
                first_witness=None
                for (cr,cc),preparation in staged:
                    # Lower bound includes the impulse and both control changes.
                    lower=len(preparation)+1+(charge!=controlled[0])+1 if preparation else 1+(actor!=controlled[0])
                    if first_witness is not None and lower>first_witness[0]: continue
                    landing=(cr+uy*distance,cc+ux*distance)
                    ignore=frozenset((actor,))
                    if not all(valid(charge,(cr+uy*n,cc+ux*n),crossing=True,ignore=ignore)
                               for n in range(q,distance+q,q)): continue
                    for _ in range(int(contract['max_continuation_steps'])):
                        if valid(charge,landing,ignore=ignore): break
                        landing=(landing[0]+dy,landing[1]+dx)
                        if not valid(charge,landing,crossing=True,ignore=ignore): break
                    if not valid(charge,landing,ignore=ignore) or landing in reach[charge]: continue
                    if sum(abs(a-b) for a,b in zip(landing,goals[charge]))>=sum(abs(a-b) for a,b in zip(starts[charge],goals[charge])): continue
                    key=(actor,cr,cc)
                    if key not in actor_reach_cache:
                        obstacles=tuple(pixels((cr,cc),sizes[j]) if j==charge else pts for j,pts in enumerate(occupied))
                        actor_reach_cache[key]=reach[actor] if not preparation else reachable(actor,starts[actor],obstacles)
                    available=actor_reach_cache[key]
                    if available is None: return {'contact_service_witness_present':False,'contact_service_bound_reached':True}
                    contacts=[]
                    for pos,path in sorted(available.items()):
                        ar,ac=pos
                        touches=((ux>0 and ac+aw==cc or ux<0 and cc+cw==ac) and max(ar,cr)<min(ar+ah,cr+ch)
                            or (uy>0 and ar+ah==cr or uy<0 and cr+ch==ar) and max(ac,cc)<min(ac+aw,cc+cw))
                        if touches: contacts.append((len(path),path,pos))
                    if not contacts: continue
                    _,path,pos=min(contacts)
                    route=(*path,action)
                    first=charge if preparation else actor
                    cost=(len(preparation)+(charge!=controlled[0])+1+len(route)) if preparation else len(route)+(actor!=controlled[0])
                    witness=(cost,first,charge,preparation or route,landing,pos,actor,preparation,route)
                    if first_witness is None or witness<first_witness: first_witness=witness
                if first_witness is not None:
                    witnesses.append(first_witness)
                    witnesses.sort(key=lambda witness:(witness_priority(witness),witness))
                    del witnesses[witness_bound:]
    cascade_contract=transfer_contract.get('contact_cascade_hypothesis_contract',{})
    if frontier_facts and cascade_contract:
        from .enclosure_contact_cascade import measure_contact_cascade
        underlay_support=set().union(*occupied)
        protected=frozenset(i for i,(start,goal) in enumerate(zip(starts,goals)) if start==goal)
        for charge in inaccessible:
            cr,cc=starts[charge];ch,cw=sizes[charge]
            for actor in range(len(bodies)):
                if actor==charge:continue
                ah,aw=sizes[actor]
                for action,dy,dx in steps:
                    uy,ux=dy//q,dx//q
                    contacts=[]
                    for pos,path in sorted(reach[actor].items()):
                        ar,ac=pos
                        touches=((ux>0 and ac+aw==cc or ux<0 and cc+cw==ac) and max(ar,cr)<min(ar+ah,cr+ch)
                            or (uy>0 and ar+ah==cr or uy<0 and cr+ch==ar) and max(ac,cc)<min(ac+aw,cc+cw))
                        if touches:contacts.append((len(path),path,pos))
                    if not contacts:continue
                    _,path,pos=min(contacts)
                    remaining_bound=int(contract['max_total_state_expansions'])-expanded
                    if remaining_bound<=0:break
                    prediction=measure_contact_cascade(frame=frame,starts=starts,sizes=sizes,
                        primary=charge,initiator=actor,contact_position=pos,delta=(dy,dx),
                        quantum=q,nominal_distance=distance,floors=floors,transit=transit,
                        underlay_support=underlay_support,goal_support=goal_regions,
                        protected=protected,contract=dict(contract)|dict(cascade_contract)|{'max_total_state_expansions':remaining_bound})
                    expanded+=int(prediction.get('expanded',0))
                    if expanded>int(contract['max_total_state_expansions']):break
                    if not prediction.get('complete'):continue
                    after_frontier=measure_transfer_lower_bounds(frame,prediction['positions'],sizes,
                        goals,floors,transit,q,distance,dict(contract)|dict(transfer_contract)|{'max_total_state_expansions':int(contract['max_total_state_expansions'])-expanded},
                        known_support=underlay_support)
                    expanded+=int(after_frontier.get('expanded',0))
                    if expanded>int(contract['max_total_state_expansions']):break
                    if not after_frontier.get('complete'):continue
                    after_counts=after_frontier['minimum_transfers']
                    affected=prediction['affected_indices']
                    if any(after_counts[i]>transfer_counts[i] for i in affected):continue
                    fields=cascade_contract['goal_progress_lexicographic_fields']
                    def progress_key(i,poses,counts):
                        row={'minimum_required_terrain_transfers':counts[i],
                             'taxicab_residual':sum(abs(a-b) for a,b in zip(poses[i],goals[i]))}
                        return tuple(row[field] for field in fields)
                    useful=tuple(i for i in affected if progress_key(i,prediction['positions'],after_counts)<progress_key(i,starts,transfer_counts))
                    if len(useful)<int(cascade_contract['minimum_useful_affected_bodies']):continue
                    route=(*path,action)
                    witness=(len(route)+(actor!=controlled[0]),actor,charge,route,
                        prediction['positions'][charge],pos,actor,(),route)
                    cascade_details[witness]={
                        'beneficiary_minimum_required_terrain_transfers':max(transfer_counts[i] for i in useful),
                        'useful_affected_body_count':len(useful),
                        'critical_beneficiary_refs':tuple(bodies[i].component_id for i in useful if transfer_counts[i]==max(transfer_counts[j] for j in useful)),
                        'expected_poses':tuple((bodies[i].component_id,*starts[i],*prediction['positions'][i]) for i in affected),
                        'contact_edges':tuple((bodies[a].component_id,bodies[b].component_id) for a,b in prediction['contact_edges']),
                    }
                    witnesses.append(witness)
                    witnesses.sort(key=lambda w:(witness_priority(w),w));del witnesses[witness_bound:]
                    cascade_details={w:cascade_details[w] for w in witnesses if w in cascade_details}
                if expanded>int(contract['max_total_state_expansions']):break
            if expanded>int(contract['max_total_state_expansions']):break
    if not witnesses: return empty|frontier_facts
    witnesses.sort(key=lambda witness:(witness_priority(witness),witness))
    # Exact declared lexicographic fields; retain bounded structural ties.
    witnesses=tuple(w for w in witnesses if witness_priority(w)==witness_priority(witnesses[0]))
    if frontier_facts:
        first_witness_detail=cascade_details.get(witnesses[0],{})
        frontier_facts['contact_service_selected_beneficiary_required_terrain_transfers']=first_witness_detail.get('beneficiary_minimum_required_terrain_transfers',transfer_counts[witnesses[0][2]])
        frontier_facts['contact_service_selected_beneficiary_component_ref']=(first_witness_detail['critical_beneficiary_refs'][0] if first_witness_detail else bodies[witnesses[0][2]].component_id)
        if first_witness_detail:
            frontier_facts.update({
                'contact_service_selected_cascade_hypothesis':True,
                'contact_service_cascade_expected_poses':first_witness_detail['expected_poses'],
                'contact_service_cascade_contact_edges':first_witness_detail['contact_edges'],
                'contact_service_cascade_useful_affected_body_count':first_witness_detail['useful_affected_body_count'],
                'contact_service_cascade_critical_beneficiary_refs':first_witness_detail['critical_beneficiary_refs'],
                'contact_service_cascade_trigger_is_current_action':all(w[1]==controlled[0] and len(w[3])==1 for w in witnesses),
            })
    directional=tuple(sorted({w[3][0] for w in witnesses if w[1]==controlled[0]}))
    points=tuple(sorted({bodies[w[1]].component_id for w in witnesses if w[1]!=controlled[0]}))
    control_premises = set()
    if contract.get('include_current_control_proofs_in_witness') is True:
        # Transport Source's current role proofs with the measured service.
        # Reconciliation needs the selected carrier's proof as well as the
        # learned contact model; neither is replaced by the other.
        control_premises.update(ref
            for row in value.canonical_provisional_control_term_facts
            for ref in row.get('role_premise_claim_refs', ()))
    return {**frontier_facts,'contact_service_witness_present':True,
        'contact_service_requires_current_control_test':control_test,
        'contact_service_directional_action_refs':directional,
        'contact_service_point_component_refs':points,
        'contact_service_point_support_bboxes':tuple(sorted({
            (bodies[w[1]].bbox.top,bodies[w[1]].bbox.left,bodies[w[1]].bbox.bottom,bodies[w[1]].bbox.right)
            for w in witnesses if w[1]!=controlled[0]})),
        'contact_service_premise_claim_refs':tuple(sorted(
            {str(m['memory_claim_ref']) for m in memories} | control_premises)),
        'contact_service_witness_rows':tuple((bodies[a].component_id,bodies[c].component_id,route,landing,pos,
            bodies[actor].component_id,preparation,impulse_route) for _,a,c,route,landing,pos,actor,preparation,impulse_route in witnesses),
        'contact_service_state_expansions':expanded,
        'contact_service_minimum_primitive_cost':witnesses[0][0],
        'contact_service_inaccessible_body_count':len(inaccessible)}
