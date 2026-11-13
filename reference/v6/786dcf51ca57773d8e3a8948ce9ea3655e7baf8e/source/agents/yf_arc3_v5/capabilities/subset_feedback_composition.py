"""Bounded raster/set projections under an explicit DRM query contract.

No palette, game identity, hidden state, semantic routing or action release.
The returned set is conditional on the law supplied by Source, not a proof
that the visible interface implements that law.
"""
from collections import defaultdict

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .repeated_patch_catalogue import _append_component_points
from .display_correspondence import regular_boundary_component_groups
from .subset_observation_d import (
    FaultAssignmentD, SubsetLawD, SubsetReceiptD, SubsetObservationRequestD,
    measure_subset_observation_d,
)
from .mechanical_family_contracts_d import DMechanicalScope


def project_compatible_subset_members(universe, history, signature, query, *, epoch, frame_ref):
    """Bind the Source-declared operation, phase, hypothesis and actual receipts.

    The local calculation goal is explicitly declared by Source; it does not
    replace the selected action's live goal or manufacture a canonical parent.
    Evidence revision identifies the currently revalidated input bundle, not
    a claim that historical responses happened on the current physical frame.
    """
    if not history:
        return universe,None
    if frame_ref is None or any(not response['complete_packet'] for response in history):
        return None,None
    prefix=query['member_ref_prefix']+signature+'.'
    members=tuple(prefix+str(i) for i in universe)
    law=SubsetLawD(law_ref=query['law_ref'],predicate=query['predicate'],
                  law_evidence_ref=query['hypothesis_ref'],
                  feedback_by_value=((0,(query['local_label_ref'],)),
                                     (1,(query['outside_label_ref'],))))
    assignments=tuple(FaultAssignmentD(
        assignment_ref=query['assignment_ref_prefix']+signature+'.'+str(i),
        law_ref=law.law_ref,fault_member_refs=(members[i],)) for i in universe)
    model_revision=query['model_revision_ref_prefix']+stable_digest((signature,query))
    request_ref=query['request_ref_prefix']+stable_digest((epoch,frame_ref,history,model_revision))
    scope=DMechanicalScope(
        request_ref=request_ref,caller_ref=query['caller_ref'],
        parent_consumer_ref=query['parent_consumer_ref'],parent_goal_ref=query['calculation_goal_ref'],
        parent_contribution_ref=request_ref,caller_next_item_ref=query['caller_next_item_ref'],
        epoch=epoch,evidence_revision_ref=request_ref,model_revision_ref=model_revision,
        model_status_ref=query['model_status_ref'],event_owner_ref=query['event_owner_ref'],
        input_domain_complete=True,assumption_refs=(query['hypothesis_ref'],))
    receipts=tuple(SubsetReceiptD(
        receipt_ref=query['receipt_ref_prefix']+stable_digest((response['source_frame_ref'],
            response['dispatched_intent_ref'],response['packet_digest'])),epoch=epoch,
        evidence_revision_ref=scope.evidence_revision_ref,
        tested_member_refs=tuple(members[j] for j in response['query']),
        ordered_feedback=(query['outside_label_ref'] if response['outside_response'] else query['local_label_ref'],),
        sealed=response['complete_packet'],positive_singleton_confirmation=False)
        for response in history)
    request=SubsetObservationRequestD(
        scope=scope,operation_ref=query['operation_ref'],mode_ref=query['mode_ref'],
        requested_result_type=query['requested_result_type'],phase_ref=query['phase_ref'],
        node_bound=query['node_bound'],depth_bound=query['depth_bound'],
        domain_bound=query['maximum_members'],time_bound_ms=query['time_bound_ms'],
        member_refs=members,assignments=assignments,laws=(law,),
        tested_member_refs=receipts[-1].tested_member_refs,query_currently_realizable=False,
        receipts=receipts,filter_receipt_ref=None,positive_singleton_confirmation_required=True)
    result=measure_subset_observation_d(request)
    if result.status!='COMPLETE' or not result.domain_complete:
        return None,result
    retained=set(result.values.get('retained_assignment_refs',()))
    return tuple(i for i,assignment in enumerate(assignments) if assignment.assignment_ref in retained),result


def measure_slot_inventory(frame, components):
    return tuple(FrozenMap({'boxes':tuple((c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right)
                                          for c in group),
                           'values':tuple(c.value for c in group)})
                 for group in regular_boundary_component_groups(frame,components))


def measure_subset_geometry(frame, components, query):
    groups = defaultdict(list)
    for component in components:
        b = component.bbox
        if (b.width < query['minimum_core_extent'] or b.height < query['minimum_core_extent']
                or component.area == b.width*b.height):
            continue
        shape = tuple(sorted((r-b.top, c-b.left) for r, c in component.pixels))
        groups[(component.value, b.height, b.width, shape)].append(component)
    families = []
    for key, group in sorted(groups.items()):
        if not 4 <= len(group) <= query['maximum_members']:
            continue
        rows = sorted({c.bbox.top for c in group})
        cols = sorted({c.bbox.left for c in group})
        if len(rows) < 2 or len(cols) < 2 or len(group) != len(rows)*len(cols):
            continue
        dr = {b-a for a,b in zip(rows,rows[1:])}
        dc = {b-a for a,b in zip(cols,cols[1:])}
        if len(dr) != 1 or len(dc) != 1 or min(dr) <= key[1] or min(dc) <= key[2]:
            continue
        members = tuple(sorted(group, key=lambda c:(c.bbox.top,c.bbox.left)))
        boxes = tuple((c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right) for c in members)
        pad = min(min(dr),min(dc))//2
        envelope = (max(0,boxes[0][0]-pad),max(0,boxes[0][1]-pad),
                    min(frame.height-1,max(b[2] for b in boxes)+pad),
                    min(frame.width-1,max(b[3] for b in boxes)+pad))
        pixels = defaultdict(list)
        for r in range(envelope[0],envelope[2]+1):
            for c in range(envelope[1],envelope[3]+1):
                if not any(t<=r<=b and l<=c<=rr for t,l,b,rr in boxes):
                    pixels[frame.rows[r][c]].append((r,c))
        outlines = []
        for ink, points in sorted(pixels.items()):
            t,l = min(r for r,c in points),min(c for r,c in points)
            b,rr = max(r for r,c in points),max(c for r,c in points)
            if b-t < 2 or rr-l < 2 or not all(r in (t,b) or c in (l,rr) for r,c in points):
                continue
            subset = tuple(i for i,(mt,ml,mb,mr) in enumerate(boxes)
                           if t<mt and l<ml and mb<b and mr<rr)
            if not subset or len(subset) == len(boxes):
                continue
            outlines.append((ink,subset))
        controls = []
        for ink,subset in outlines:
            for component in components:
                b=component.bbox
                if component.value != ink or b.width < 3 or b.height < 3:
                    continue
                if not (b.bottom < envelope[0] or b.top > envelope[2]
                        or b.right < envelope[1] or b.left > envelope[3]):
                    continue
                controls.append((component,subset,component.area==b.height*b.width))
        # A single family plus two disjoint visible groups is the declared
        # morphology's applicability condition, not acquired control evidence.
        subsets = {subset for _ink,subset in outlines}
        disjoint = any(not set(a)&set(b) for a in sorted(subsets) for b in sorted(subsets) if a!=b)
        if disjoint and controls:
            families.append((key,members,boxes,tuple(controls)))
    return families[0] if len(families)==1 else None


def measure_subset_packet(value, members, proposed_subset):
    packet = value.latest_ordered_action_frames
    count = value.latest_ordered_action_source_frame_count
    complete = (count is not None and len(packet)
                + int(value.latest_ordered_action_terminal_duplicate_omitted)==count)
    off_sets = []
    for frame in packet:
        if frame.height != value.frame.height or frame.width != value.frame.width:
            return None
        off = tuple(i for i,c in enumerate(members)
                    if all(frame.rows[r][col] != c.value for r,col in c.pixels))
        off_sets.append(off)
    nonempty = tuple(s for s in off_sets if s)
    if not nonempty:
        return None
    actual = nonempty[0]
    if set(actual) != set(proposed_subset):
        return None
    outside = any(set(s)-set(actual) for s in off_sets)
    released = bool(off_sets and not off_sets[-1])
    if not outside and not (complete and released):
        return None
    return FrozenMap({'query':actual,'outside_response':outside,
                      'complete_packet':complete,'released':released,
                      'source_frame_count':count,
                      'source_frame_ref':value.current_observation_frame_ref,
                      'dispatched_intent_ref':value.canonical_dispatched_goal_continuity_facts.get(
                          'dispatched_composition_intent_ref'),
                      'packet_digest':stable_digest(tuple(f.rows for f in packet))})


def annotate_subset_feedback(value, agenda, *, point_measurements=None):
    query = value.route_generation_policy.get('subset_feedback_query')
    if not query or query.get('conditional_law') != 'one_fixed_member_global_iff_in_queried_subset':
        return agenda
    geometry = measure_subset_geometry(value.frame,value.components.components,query)
    if geometry is None:
        return agenda
    key,members,boxes,controls = geometry
    universe = tuple(range(len(members)))
    signature = stable_digest((boxes,key))
    contract = query['projection_contract']
    prior = value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context',{})
    history = ()
    compatible = universe
    slots=measure_slot_inventory(value.frame,value.components.components)
    resource_basis=()
    if (prior.get('projection_contract') == contract and prior.get('epoch')==value.current_context_epoch
            and prior.get('universe_signature')==signature):
        history = tuple(prior.get('response_history',()))
        resource_basis=tuple(prior.get('slot_change_basis',()))
        # Measure the response independently of the control's current drawing.
        # A navigation has no changed member cores; a test can puncture its own
        # icon and must not thereby lose its already observed correspondence.
        if any(frame.height!=value.frame.height or frame.width!=value.frame.width
               for frame in value.latest_ordered_action_frames):
            return agenda
        packet_has_core_change=any(
            any(frame.rows[r][col] != component.value for r,col in component.pixels)
            for frame in value.latest_ordered_action_frames for component in members)
        if packet_has_core_change:
            response=measure_subset_packet(value,members,prior.get('query',()))
            if response is None:
                # An incomplete or unexpected response cannot become a negative.
                return agenda
            if not history or (history[-1].get('source_frame_ref'),history[-1].get('dispatched_intent_ref')) != (
                    response['source_frame_ref'],response['dispatched_intent_ref']):
                response=FrozenMap.overlay({'control_bounds':prior.get('control_bounds')},response)
                history=history+(response,)
                changes=[]
                for before in prior.get('slot_inventory',()):
                    after=next((g for g in slots if g['boxes']==before['boxes']),None)
                    if after is None:
                        continue
                    differing=tuple(i for i,(a,b) in enumerate(zip(before['values'],after['values'])) if a!=b)
                    if len(differing)==1:
                        index=differing[0]
                        old=before['values'][index]
                        changes.append(FrozenMap({'boxes':before['boxes'],'old_value':old,
                            'old_count':sum(v==old for v in before['values']),
                            'new_count':sum(v==old for v in after['values'])}))
                if len(changes)==1:
                    resource_basis=tuple(changes)
    if len(history)>query['maximum_response_records']:
        return agenda
    compatible,observation_result=project_compatible_subset_members(
        universe,history,signature,query,epoch=value.current_context_epoch,
        frame_ref=value.current_observation_frame_ref)
    if not compatible:
        return agenda
    remaining=None
    if len(resource_basis)==1:
        basis=resource_basis[0]
        current=next((g for g in slots if g['boxes']==basis['boxes']),None)
        if current is not None:
            remaining=sum(v==basis['old_value'] for v in current['values'])
    refs=tuple(c.component_id for c,_,_ in controls)+tuple(c.component_id for c in members)
    agenda=_append_component_points(value,agenda,refs,point_measurements)
    candidates={c.candidate_ref:c for c in agenda.candidates}
    alternatives={}
    descriptive={}
    for ref in agenda.alternative_refs:
        candidate=candidates[ref]
        point=candidate.point
        control=next(((c,q,solid) for c,q,solid in controls if point is not None
                      and c.bbox.top<=point[0]<=c.bbox.bottom
                      and c.bbox.left<=point[1]<=c.bbox.right),None)
        selected=next((i for i,c in enumerate(members) if point is not None
                       and c.bbox.top<=point[0]<=c.bbox.bottom
                       and c.bbox.left<=point[1]<=c.bbox.right),None)
        q=control[1] if control else ((selected,) if selected is not None else ())
        inside=sum(i in q for i in compatible)
        outside=len(compatible)-inside
        solid=bool(control and control[2])
        paired_bounds=tuple(response.get('control_bounds') for response in history
                            if response.get('control_bounds') is not None)
        in_paired_bounds=bool(point is not None and any(
            t<=point[0]<=b and l<=point[1]<=r for t,l,b,r in paired_bounds))
        control_bounds=(control[0].bbox.top,control[0].bbox.left,
                        control[0].bbox.bottom,control[0].bbox.right) if control else None
        context=FrozenMap({'projection_contract':contract,'epoch':value.current_context_epoch,
                          'universe_signature':signature,'response_history':history,
                          'compatible_member_indices':compatible,'member_bounds':boxes,
                          'observation_result_summary':FrozenMap({
                              'request_ref':observation_result.scope.request_ref,
                              'model_revision_ref':observation_result.scope.model_revision_ref,
                              'operation_ref':observation_result.operation_ref,
                              'mode_ref':observation_result.mode_ref,
                              'status':observation_result.status,'cause':observation_result.cause,
                              'domain_complete':observation_result.domain_complete,
                          }) if observation_result else FrozenMap(),
                          'slot_inventory':slots,'slot_change_basis':resource_basis,
                          'query':q,'control_bounds':control_bounds})
        facts={'subset_universe_signature':signature,'subset_member_count':len(members),
               'subset_compatible_count':len(compatible),'subset_inside_count':inside,
               'subset_outside_count':outside,'subset_query_count':len(q),
               'subset_control_solid':solid,'subset_control_nonsolid':bool(control and not solid),
               'subset_point_in_response_paired_control_bounds':in_paired_bounds,
               'subset_member_point':selected is not None,
               'subset_response_record_count':len(history),
               'subset_conditional_context':context,
               'subset_worst_branch':max(inside,outside),
               'subset_observation_operation_ref':observation_result.operation_ref if observation_result else None,
               'subset_observation_mode_ref':observation_result.mode_ref if observation_result else None,
               'subset_observation_status':observation_result.status if observation_result else None,
               'subset_observation_cause':observation_result.cause if observation_result else None,
               'subset_observation_request_ref':observation_result.scope.request_ref if observation_result else None,
               'subset_remaining_slots_known':remaining is not None,
               'subset_remaining_slots':remaining,
               'subset_slot_change_basis_count':len(resource_basis),
               'subset_identification_and_confirmation_lower_bound':(len(compatible)-1).bit_length()+1}
        alternatives[ref]=FrozenMap.overlay(facts,agenda.alternative_facts[ref])
        if ref in agenda.descriptive_delta_facts:
            descriptive[ref]=FrozenMap.overlay(facts,agenda.descriptive_delta_facts[ref])
    return agenda.model_copy(update={'alternative_facts':FrozenMap(alternatives),
                                    'descriptive_delta_facts':FrozenMap(descriptive)})
