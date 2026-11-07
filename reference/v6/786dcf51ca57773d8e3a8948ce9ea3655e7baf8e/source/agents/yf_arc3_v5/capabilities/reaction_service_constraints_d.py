"""Exact caller-supplied service occupancy constraints at one microstate."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def reaction_service_constraints_d(request,state,remaining):
    demands=request.service_demands
    work=len(state.elements)+len(state.overlays)+len(state.pending)
    work+=len(demands)*(len(state.overlays)*10+16)
    if work>remaining:return FrozenMap({'complete':False,'evaluations':0,
        'missing_refs':('reaction_service.microstate_evaluation_budget',),'violated_service_refs':()})
    elements={row.element_ref:row for row in state.elements}
    pending={row.element_ref:row.directions for row in state.pending};rows=[];violations=[]
    for demand in demands:
        if not demand.start_tick<=state.tick<=demand.end_tick:continue
        element=elements.get(demand.element_ref)
        expected='RELAY' if demand.kind in ('BRIDGE','FORCE_JUNCTION') else 'BLOCK'
        providers=tuple(row.overlay_ref for row in state.overlays if row.cell==demand.cell
            and row.intervention==expected and (demand.kind!='FORCE_JUNCTION'
                or set(demand.required_directions)<=set(row.forced_incidence_directions)))
        live=(element is not None and element.cell==demand.cell
            and (demand.kind!='HOLD_PRIMED' or element.element_ref in state.primed_refs)
            and (demand.kind!='HOLD_PENDING' or bool(pending.get(element.element_ref)))) if demand.kind in ('HOLD_PRIMED','HOLD_PENDING','FORCE_JUNCTION') else True
        met=bool(providers) and live
        if not met:violations.append(demand.service_ref)
        rows.append(FrozenMap({'service_ref':demand.service_ref,'consumer_ref':demand.consumer_ref,
            'tick':state.tick,'restore_epoch':state.restore_epoch,'current_provider_refs':providers,
            'required_cell':demand.cell,'required_window':(demand.start_tick,demand.end_tick),
            'current_operand_present':live,'constraint_met':met}))
    return FrozenMap({'complete':True,'evaluations':work,'missing_refs':(),
        'service_state_rows':tuple(rows),'violated_service_refs':tuple(violations)})
