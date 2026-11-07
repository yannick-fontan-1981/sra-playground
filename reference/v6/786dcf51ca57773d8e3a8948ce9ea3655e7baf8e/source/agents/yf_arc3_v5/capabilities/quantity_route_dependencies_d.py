"""Bounded operand-gap dependencies along one supplied complete witness."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def _gap(quantity,interval):
    return max(0,interval[0]-quantity,quantity-interval[1])


def measure_quantity_route_dependencies_d(request,path,budget):
    spec=request.planning;controls={control.control_ref:control for control in spec.controls}
    compartments={row.compartment_ref:row for row in request.compartments}
    refs=tuple(row.compartment_ref for row in request.compartments)
    transfers={row.transfer_ref:row for row in request.transfers};doors={row.door_ref:row for row in request.doors}
    work=len(path)*len(path)*(len(compartments)*8+len(spec.goals)*8+8)+len(path)*len(compartments)*8
    work+=len(spec.goals)*(len(path)+1)*(len(compartments)+len(spec.controls)+len(request.tags)+8)
    work+=len(spec.goals)*len(path)*len(path)*len(compartments)
    if not budget.take(work):return FrozenMap({'dependency_projection_complete':False,
        'dependency_information_need_refs':('quantity_route.complete_consumer_dependency_projection_bound',)})
    before_states=tuple(dict(step['quantities_before']) for step in path)
    after_states=tuple(dict(step['quantities_after']) for step in path)
    batch_units={}
    for index in range(len(path)-1,-1,-1):
        control=controls[path[index]['control_ref']]
        if control.kind=='TRANSFER' and control.operation_ref in transfers:
            edge=transfers[control.operation_ref]
            same_next=index+1<len(path) and path[index+1]['control_ref']==control.control_ref
            batch_units[index]=edge.conserved_units+(batch_units.get(index+1,0) if same_next else 0)
    negative_prefix={ref:[0] for ref in refs};positive_prefix={ref:[0] for ref in refs}
    for before,after in zip(before_states,after_states):
        for ref in refs:
            negative_prefix[ref].append(negative_prefix[ref][-1]+int(after[ref]<before[ref]))
            positive_prefix[ref].append(positive_prefix[ref][-1]+int(after[ref]>before[ref]))
    rows=[];unbound=[];final=after_states[-1] if path else {ref:row.quantity for ref,row in sorted(compartments.items())}
    for index,step in enumerate(path):
        control=controls[step['control_ref']]
        if control.kind!='TRANSFER':continue
        before=before_states[index];after=after_states[index];supported=False
        for later_index in range(index+1,len(path)+1):
            constraints=[];consumer_ref=None
            if later_index==len(path):
                constraints=tuple((goal.compartment_ref,goal.quantity_interval) for goal in spec.goals)
                at_consumer=final
            else:
                later=path[later_index];consumer=controls[later['control_ref']];consumer_ref=consumer.control_ref
                at_consumer=before_states[later_index]
                if consumer.kind=='DOOR':
                    door=doors.get(consumer.operation_ref)
                    if door is not None:
                        constraints=tuple((ref,(door.side_quantity_requirements[ref],door.side_quantity_requirements[ref]))
                            for ref in (door.left_compartment_ref,door.right_compartment_ref)
                            if type(door.side_quantity_requirements.get(ref)) is int)
                else:
                    edge=transfers.get(consumer.operation_ref)
                    if edge is not None:
                        units=batch_units.get(later_index,edge.conserved_units)
                        constraints=((edge.donor_ref,(units,compartments[edge.donor_ref].capacity)),
                            (edge.recipient_ref,(0,compartments[edge.recipient_ref].capacity-units)))
            for ref,interval in constraints:
                if ref not in before or after[ref]==before[ref] or interval[1] is None:continue
                old_gap=_gap(before[ref],interval);new_gap=_gap(after[ref],interval)
                if old_gap<=new_gap or _gap(at_consumer[ref],interval):continue
                sign=1 if after[ref]>before[ref] else -1
                # A later reversal removes this simple monotone contribution;
                # do not invent a consumer link through an overwritten value.
                prefix=negative_prefix[ref] if sign>0 else positive_prefix[ref]
                retained=prefix[later_index]==prefix[index+1]
                if not retained:continue
                supported=True
                edge=transfers[control.operation_ref]
                rows.append(FrozenMap({'producer_step_index':index,'consumer_step_index':later_index,
                    'producer_control_ref':control.control_ref,'consumer_control_ref':consumer_ref,
                    'transfer_ref':edge.transfer_ref,'donor_ref':edge.donor_ref,'recipient_ref':edge.recipient_ref,
                    'conserved_units':edge.conserved_units,'donor_quantity_before':before[edge.donor_ref],
                    'recipient_quantity_before':before[edge.recipient_ref],
                    'recipient_hard_capacity':compartments[edge.recipient_ref].capacity,
                    'compartment_ref':ref,'required_quantity_interval':interval,
                    'quantity_before':before[ref],'quantity_after':after[ref],
                    'gap_before':old_gap,'gap_after':new_gap,'quantity_at_consumer':at_consumer[ref],
                    'terminal_consumer':later_index==len(path),'monotone_contribution_retained':True}))
        if not supported:unbound.append(index)
    links={}
    for row_index,row in enumerate(rows):
        links.setdefault((row['producer_step_index'],row['compartment_ref']),[]).append(row_index)
    segments=[];directions=[];unbound_segments=[]
    for ref in refs:
        group=[];direction=0;reference_segments=[]
        for index in range(len(path)+1):
            delta=after_states[index][ref]-before_states[index][ref] if index<len(path) else 0
            sign=1 if delta>0 else -1 if delta<0 else 0
            if group and (index==len(path) or sign and sign!=direction):
                indices=tuple(group);evidence=tuple(tuple(links.get((step,ref),())) for step in indices)
                segment=FrozenMap({'compartment_ref':ref,'hard_capacity':compartments[ref].capacity,
                    'direction_sign':direction,'producer_step_indices':indices,'consumer_row_indices_by_step':evidence,
                    'quantity_before':before_states[indices[0]][ref],'quantity_after':after_states[indices[-1]][ref],
                    'every_change_has_consumer':all(evidence)})
                segment_index=len(segments);segments.append(segment);reference_segments.append(segment_index)
                if not all(evidence):unbound_segments.append(segment_index)
                group=[]
            if sign:
                if not group:direction=sign
                group.append(index)
        if len(reference_segments)>1:
            directions.append(FrozenMap({'compartment_ref':ref,'segment_indices':tuple(reference_segments),
                'direction_signs':tuple(segments[index]['direction_sign'] for index in reference_segments),
                'all_segments_have_consumers':all(segments[index]['every_change_has_consumer'] for index in reference_segments)}))
    tag_rows=[];unbound_tags=[]
    initial_tags={row.tag_ref:(row.owner_compartment_ref,row.local_offset,row.pose) for row in request.tags}
    for goal in spec.goals:
        current=initial_tags[goal.tag_ref];next_index=None;door=None
        for index,step in enumerate(path):
            control=controls[step['control_ref']]
            if control.kind=='DOOR' and goal.tag_ref in control.transported_tag_refs:
                before=dict(step['identities_before'])[goal.tag_ref]
                after=dict(step['identities_after'])[goal.tag_ref]
                if before[0]!=after[0]:
                    next_index=index;door=doors.get(control.operation_ref);break
        target_current=(current[0]==goal.compartment_ref
            and goal.quantity_interval[0]<=compartments[goal.compartment_ref].quantity<=goal.quantity_interval[1]
            and (goal.target_pose is None or current[2]==goal.target_pose))
        thresholds=();preparation=()
        if door is not None:
            thresholds=tuple(FrozenMap({'compartment_ref':ref,'required_quantity':quantity,
                'quantity_initial':compartments[ref].quantity,'quantity_at_passage':before_states[next_index][ref],
                'hard_capacity':compartments[ref].capacity})
                for ref in (door.left_compartment_ref,door.right_compartment_ref)
                for quantity in (door.side_quantity_requirements[ref],))
            preparation=tuple(index for index,row in enumerate(rows)
                if row['consumer_step_index']==next_index)
        if not target_current and door is None and current[0]!=goal.compartment_ref:unbound_tags.append(goal.tag_ref)
        tag_rows.append(FrozenMap({'tag_ref':goal.tag_ref,'current_compartment_ref':current[0],
            'target_compartment_ref':goal.compartment_ref,'target_quantity_interval':goal.quantity_interval,
            'target_pose':goal.target_pose,'target_currently_satisfied':target_current,
            'next_door_ref':door.door_ref if door is not None else None,'next_door_step_index':next_index,
            'local_support_threshold_rows':thresholds,'preparation_consumer_row_indices':preparation,
            'door_quantities_satisfied_in_witness':door is not None and all(
                row['quantity_at_passage']==row['required_quantity'] for row in thresholds),
            'same_compartment_terminal_adjustment':current[0]==goal.compartment_ref and not target_current}))
    return FrozenMap({'dependency_projection_complete':True,'quantity_consumer_dependency_rows':tuple(rows),
        'quantity_tag_target_passage_rows':tuple(tag_rows),
        'quantity_tag_target_passage_complete':not unbound_tags,'unbound_quantity_target_tag_refs':tuple(unbound_tags),
        'quantity_capacity_phase_rows':tuple(segments),'quantity_direction_cycle_rows':tuple(directions),
        'quantity_supported_direction_cycle_count':sum(row['all_segments_have_consumers'] for row in directions),
        'unbound_quantity_phase_indices':tuple(unbound_segments),
        'unbound_quantity_transfer_step_indices':tuple(unbound),'all_quantity_transfers_have_consumers':not unbound,
        'dependency_information_need_refs':() if not unbound else ('quantity_route.unproved_transfer_consumer',),
        'dependency_rows_are_not_universal_necessity':True})
