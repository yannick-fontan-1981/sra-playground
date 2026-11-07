"""Bounded causal receipt graph of one complete model trace, not global necessity."""
from collections import deque
from agents.yf_arc3_v5.logos.types import FrozenMap


def reaction_causal_trace_d(request,transitions,remaining):
    events=tuple(event for _,_,_,trace in transitions for event in trace)
    work=len(events)*24+len(request.state.elements)+len(request.phase_laws)+len(request.state.pending)*32
    work+=len(request.required_target_refs)*len(events)*8
    work+=len(request.service_demands)*len(request.required_target_refs)*(len(events)*8+len(request.state.elements)+16)
    if work>remaining:return FrozenMap({'complete':False,'evaluations':0,'missing_refs':
        ('reaction_causal.trace_projection_budget',),'target_rows':(),'service_rows':(),'emission_rows':()})
    elements={e.element_ref:e for e in request.state.elements}
    phases={p.phase_ref:p for p in request.phase_laws}
    cache={};roots={};nodes={};batches={};missing=[];held=[];bridges=[];discarded=[]
    for ref in request.state.primed_refs:
        key=('INITIAL_PRIMED',ref,request.state.tick)
        roots[key]=FrozenMap({'node_key':key,'element_ref':ref,'current_primed':True,'current_pending_directions':()})
        cache[ref]=[(key,None,request.state.tick,None)]
    for pending in request.state.pending:
        key=('INITIAL_PENDING',pending.element_ref,request.state.tick)
        roots[key]=FrozenMap({'node_key':key,'element_ref':pending.element_ref,'current_primed':False,
            'current_pending_directions':pending.directions})
        cache[pending.element_ref]=[(key,direction,request.state.tick,None) for direction in pending.directions]
    for event in events:
        owner,tick,ref,kind,value=event
        if owner!=request.scope.event_owner_ref:
            missing.append('reaction_causal.exact_event_owner');continue
        batches.setdefault(tick,[]).append(event)
    for tick,batch in sorted(batches.items()):
        inputs={ref:value for _,_,ref,kind,value in batch if kind=='junction_emission_inputs'}
        emitted={ref for _,_,ref,kind,_ in batch if kind=='emitted'}
        for ref in sorted(emitted):
            key=('EMISSION',ref,tick);parents=tuple(cache.pop(ref,()))
            if not parents:missing.append('reaction_causal.current_root_or_received_incidence_for_emission')
            info=inputs.get(ref)
            nodes[key]=FrozenMap({'node_key':key,'element_ref':ref,'tick':tick,'input_receipts':parents,
                'parent_node_keys':tuple(sorted({row[0] for row in parents})),
                'junction_phase_ref':info[0] if info else None,'old_pending_directions':info[1] if info else (),
                'forcing_provider_ref':info[2] if info else None,'forced_directions':info[3] if info else (),
                'required_distinct_direction_count':info[4] if info else 0})
        for _,_,ref,kind,value in batch:
            if kind=='resolved_old_batch' and ref not in emitted:cache.pop(ref,None)
            elif kind=='accepted_new_hit':
                sender,direction,gap,epoch=value;source=('EMISSION',sender,tick)
                if epoch!=request.state.restore_epoch or source not in nodes:
                    missing.append('reaction_causal.current_epoch_directed_sender_emission');continue
                cache.setdefault(ref,[]).append((source,direction,tick,gap))
            elif kind in ('held_primed','held_pending'):held.append((tick,ref,kind,value))
            elif kind=='bridge_delivered':bridges.append((tick,ref,value))
            elif kind=='discarded_new_hit_source':discarded.append((tick,ref,value))
    discarded_index={}
    for row in discarded:discarded_index.setdefault((row[1],row[2][4]),[]).append(row)
    def closure(starts):
        queue=deque(starts);seen=set(starts);unknown=[]
        while queue:
            key=queue.popleft()
            if key in roots:continue
            node=nodes.get(key)
            if node is None:unknown.append(key);continue
            for parent in node['parent_node_keys']:
                if parent not in seen:seen.add(parent);queue.append(parent)
        return tuple(sorted(seen)),tuple(unknown)
    targets=[];services=[]
    for target in request.required_target_refs:
        emissions=tuple(key for key in sorted(nodes) if elements[nodes[key]['element_ref']].target_ref==target)
        ancestors,unknown=closure(emissions)
        acquired=target in request.state.acquired_target_refs
        complete=not unknown and (acquired or bool(emissions))
        if not complete:missing.append('reaction_causal.requested_target_emission_or_current_acquired_target')
        targets.append(FrozenMap({'target_ref':target,'currently_acquired':acquired,'target_emission_keys':emissions,
            'causal_node_keys':ancestors,'root_input_keys':tuple(key for key in ancestors if key in roots),
            'target_closure_complete':complete,'incoming_sources_are_retained_alternatives':True}))
        relevant=set(ancestors);subject_refs={key[1] for key in ancestors}
        receipts={(nodes[key]['element_ref'],parent[0],parent[1],parent[2],parent[3])
            for key in ancestors if key in nodes for parent in nodes[key]['input_receipts']}
        for demand in request.service_demands:
            subject=tuple(key for key in ancestors if key[1]==demand.element_ref)
            hold_rows=tuple(row for row in held if row[1]==demand.element_ref
                and elements[row[1]].cell==demand.cell and demand.start_tick<=row[0]<=demand.end_tick)
            bridge_rows=tuple(row for row in bridges if row[2][3]==demand.cell
                and (row[2][1],('EMISSION',row[2][0],row[0]),row[2][2],row[0],row[2][3]) in receipts
                and (demand.transmission_receiver_ref is None or demand.transmission_receiver_ref==row[2][1])
                and demand.start_tick<=row[0]<=demand.end_tick)
            discarded_rows=tuple(row for row in discarded if elements[row[1]].cell==demand.cell
                and row[1] in subject_refs and demand.start_tick<=row[0]<=demand.end_tick)
            forced=tuple(key for key in ancestors if key in nodes and nodes[key]['forcing_provider_ref'] is not None
                and nodes[key]['element_ref']==demand.element_ref and demand.start_tick<=key[2]<=demand.end_tick)
            forced_under_threshold=tuple(key for key in forced if len(nodes[key]['old_pending_directions'])
                <nodes[key]['required_distinct_direction_count'])
            loss_without_cover=[]
            for tick,ref,kind,value in hold_rows:
                if kind!='held_pending':continue
                law=phases.get(value[2])
                if law is None:missing.append('reaction_causal.held_pending_current_phase_law');continue
                loss_without_cover.append((tick,ref,not law.accepts_incidence
                    or len(set(value[0])|set(value[3]))<law.minimum_distinct_directions))
            one_shot_receipts=[]
            for key in ancestors:
                node=nodes.get(key)
                if node is None or elements[node['element_ref']].cell!=demand.cell:continue
                law=phases.get(node['junction_phase_ref']);following=phases.get(law.next_phase_ref) if law else None
                if law is None or following is None or not law.accepts_incidence or law.minimum_distinct_directions!=1 or following.accepts_incidence:continue
                received=tuple(receipt for receipt in node['input_receipts'] if receipt[0][0]=='EMISSION')
                if not received:continue
                latest_received=max(receipt[2] for receipt in received)
                for row in discarded_index.get((node['element_ref'],law.phase_ref),()):
                    if work+1>remaining:
                        return FrozenMap({'complete':False,'evaluations':work,'missing_refs':
                            ('reaction_causal.interception_pair_budget',),'target_rows':tuple(targets),
                            'service_rows':tuple(services),'emission_rows':()})
                    work+=1
                    if demand.start_tick<=row[0]<=demand.end_tick and row[0]+1<=latest_received:
                        one_shot_receipts.append((key,row[0],row[2][0]))
            services.append(FrozenMap({'service_ref':demand.service_ref,'consumer_ref':demand.consumer_ref,
                'target_ref':target,'service_kind':demand.kind,'element_ref':demand.element_ref,
                'service_cell':demand.cell,'required_service_window':(demand.start_tick,demand.end_tick),
                'subject_causal_node_keys':subject,'hold_rows':hold_rows,'bridge_delivery_rows':bridge_rows,
                'discarded_competing_hit_rows':discarded_rows,'forced_emission_keys':forced,
                'pending_resolution_without_cover_rows':tuple(loss_without_cover),
                'one_shot_earlier_interception_rows':tuple(one_shot_receipts),
                'target_closure_complete':complete,'subject_on_target_trace':bool(subject),
                'hold_event_count':len(hold_rows),'bridge_delivery_count':len(bridge_rows),
                'discarded_competing_hit_count':len(discarded_rows),'forced_emission_count':len(forced),
                'forced_emission_under_natural_threshold_count':len(forced_under_threshold),
                'pending_loss_without_cover_count':sum(row[2] for row in loss_without_cover),
                'one_shot_earlier_interception_count':len(one_shot_receipts),
                'universal_necessity_not_attested':True}))
    return FrozenMap({'complete':not missing,'evaluations':work,'missing_refs':tuple(dict.fromkeys(missing)),
        'target_rows':tuple(targets),'service_rows':tuple(services),'emission_rows':tuple(nodes[key] for key in sorted(nodes)),
        'current_root_rows':tuple(roots[key] for key in sorted(roots)),
        'all_requested_target_closures_complete':bool(targets) and all(row['target_closure_complete'] for row in targets)})
