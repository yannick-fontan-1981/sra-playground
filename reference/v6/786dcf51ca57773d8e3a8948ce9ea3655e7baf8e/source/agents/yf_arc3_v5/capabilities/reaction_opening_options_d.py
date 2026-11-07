"""Bounded current incidence/phase arithmetic; DRM interprets alternative means."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def reaction_opening_options_d(request,remaining):
    demands=tuple(row for row in request.service_demands if row.kind=='FORCE_JUNCTION')
    state=request.state;work=len(state.elements)+len(state.pending)+len(request.phase_laws)
    work+=len(demands)*(len(state.overlays)*32+128)
    if work>remaining:return FrozenMap({'complete':False,'evaluations':0,'rows':(),
        'missing_refs':('reaction_opening.current_phase_projection_budget',)})
    elements={row.element_ref:row for row in state.elements}
    pending={row.element_ref:row.directions for row in state.pending}
    phases={row.phase_ref:row for row in request.phase_laws};rows=[];missing=[]
    for demand in demands:
        element=elements.get(demand.element_ref)
        law=phases.get(element.phase_ref) if element is not None and element.junction else None
        following=phases.get(law.next_phase_ref) if law is not None else None
        if law is None or following is None:
            missing.append('reaction_opening.current_and_next_incidence_law');continue
        directions=pending.get(element.element_ref,());count=len(directions)
        lower=following.accepts_incidence and following.minimum_distinct_directions<law.minimum_distinct_directions
        base={'service_ref':demand.service_ref,'consumer_ref':demand.consumer_ref,'element_ref':element.element_ref,
            'current_phase_ref':law.phase_ref,'next_phase_ref':law.next_phase_ref,'tick':state.tick,
            'restore_epoch':state.restore_epoch,'pending_directions':directions,'distinct_direction_count':count,
            'required_distinct_direction_count':law.minimum_distinct_directions,
            'next_phase_accepts_incidence':following.accepts_incidence,'next_required_direction_count':following.minimum_distinct_directions,
            'source_service_cell_matches':element.cell==demand.cell,
            'current_service_window':demand.start_tick<=state.tick<=demand.end_tick,
            'current_cell_blocked':any(row.cell==element.cell and row.intervention=='BLOCK' for row in state.overlays)}
        rows.append(FrozenMap({**base,'additional_direction_count':0,'provider_ref':None,'provider_present':False,
            'lower_following_threshold':lower,'multiple_current_directions':count>=2,
            'current_threshold_met':law.accepts_incidence and count>=law.minimum_distinct_directions,
            'single_current_threshold':law.minimum_distinct_directions==1,'following_phase_rejects_incidence':not following.accepts_incidence}))
        for provider in state.overlays:
            if provider.intervention!='RELAY':continue
            combined=set(directions)|set(provider.forced_incidence_directions)
            rows.append(FrozenMap({**base,'additional_direction_count':len(combined)-count,'provider_ref':provider.overlay_ref,'provider_present':True,
                'provider_currently_at_service_cell':provider.cell==demand.cell,'combined_direction_count':len(combined),
                'lower_following_threshold':lower,'multiple_current_directions':count>=2,
                'current_threshold_met':law.accepts_incidence and count>0 and len(combined)>=law.minimum_distinct_directions,
                'single_current_threshold':law.minimum_distinct_directions==1,'following_phase_rejects_incidence':not following.accepts_incidence}))
    return FrozenMap({'complete':not missing,'evaluations':work,'rows':tuple(rows),
        'missing_refs':tuple(dict.fromkeys(missing)),'current_batch_not_future_unobserved_arrivals':True})
