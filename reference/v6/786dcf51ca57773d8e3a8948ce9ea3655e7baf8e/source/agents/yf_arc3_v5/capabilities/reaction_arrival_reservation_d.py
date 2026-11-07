"""Exact one-use phase, ordered arrival and blocker-pose operands; DRM names use."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .reaction_target_dependencies_d import reaction_target_dependencies_d


def reaction_arrival_reservation_d(request,remaining):
    demands=request.reservation_demands
    if not demands:return FrozenMap({'complete':True,'evaluations':0,'rows':(),'missing_refs':()})
    dependency=reaction_target_dependencies_d(request,remaining)
    work=dependency['evaluations']+len(request.state.elements)+len(request.incidences)+len(request.phase_laws)
    pose_work=sum(len(poses) for _,poses in request.overlay_pose_domains)
    work+=sum(len(d.competing_incidence_refs) for d in demands)*(len(request.state.elements)
        +len(request.state.pending)+len(request.required_target_refs)+pose_work+len(request.state.overlays)*40+64)
    if not dependency.get('target_predecessor_projection_complete'):
        return FrozenMap({'complete':False,'evaluations':dependency['evaluations'],'rows':(),
            'missing_refs':dependency['target_predecessor_information_need_refs']})
    if work>remaining:return FrozenMap({'complete':False,'evaluations':dependency['evaluations'],'rows':(),
        'missing_refs':('reaction_reservation.arrival_projection_budget',)})
    elements={e.element_ref:e for e in request.state.elements}
    incidences={i.evidence_ref:i for i in request.incidences}
    if len(incidences)!=len(request.incidences):
        return FrozenMap({'complete':False,'evaluations':work,'rows':(),
            'missing_refs':('reaction_reservation.unique_named_incidence_binding',)})
    phases={p.phase_ref:p for p in request.phase_laws};rows=[];missing=[]
    for demand in demands:
        junction=elements.get(demand.junction_ref);useful=incidences.get(demand.useful_incidence_ref)
        law=phases.get(junction.phase_ref) if junction is not None and junction.junction else None
        following=phases.get(law.next_phase_ref) if law is not None else None
        if law is None or following is None or useful is None:
            missing.append('reaction_reservation.bound_junction_phase_and_named_useful_arrival');continue
        target=next((row for row in dependency['target_predecessor_rows'] if row['target_ref']==demand.target_ref),None)
        for ref in demand.competing_incidence_refs:
            competing=incidences.get(ref)
            if competing is None:
                missing.append('reaction_reservation.bound_named_competing_arrival');continue
            base={'reservation_ref':demand.reservation_ref,'consumer_ref':demand.consumer_ref,
                'target_ref':demand.target_ref,'element_ref':junction.element_ref,
                'useful_incidence_ref':useful.evidence_ref,'competing_incidence_ref':competing.evidence_ref,
                'requested_target_bound':demand.target_ref in request.required_target_refs,
                'junction_on_target_predecessors':target is not None and junction.element_ref in target['predecessor_element_refs'],
                'same_restore_epoch':demand.restore_epoch==request.state.restore_epoch,
                'phase_accepts_incidence':law.accepts_incidence,'required_distinct_direction_count':law.minimum_distinct_directions,
                'following_phase_accepts_incidence':following.accepts_incidence,
                'both_arrivals_name_this_receiver':useful.receiver_ref==competing.receiver_ref==junction.element_ref,
                'distinct_incidence_refs':useful.evidence_ref!=competing.evidence_ref,
                'competing_resolution_not_after_useful':competing.latest_tick+1<=useful.earliest_tick,
                'useful_earliest_tick':useful.earliest_tick,'competing_latest_tick':competing.latest_tick,
                'competing_arrival_not_in_past':request.state.tick<=competing.earliest_tick,
                'current_receiver_pending':any(p.element_ref==junction.element_ref for p in request.state.pending),
                'block_cell':junction.cell,'block_from_tick':competing.earliest_tick,'block_through_tick':competing.latest_tick}
            rows.append(FrozenMap({**base,'provider_ref':None,'provider_pose_in_declared_domain':False}))
            for provider in request.state.overlays:
                if provider.intervention!='BLOCK':continue
                poses=next((poses for ref,poses in request.overlay_pose_domains if ref==provider.overlay_ref),(provider.cell,))
                rows.append(FrozenMap({**base,'provider_ref':provider.overlay_ref,
                    'provider_pose_in_declared_domain':junction.cell in poses}))
    return FrozenMap({'complete':not missing,'evaluations':work,'rows':tuple(rows),
        'missing_refs':tuple(dict.fromkeys(missing)),'cursor_access_and_full_route_not_attested':True})
