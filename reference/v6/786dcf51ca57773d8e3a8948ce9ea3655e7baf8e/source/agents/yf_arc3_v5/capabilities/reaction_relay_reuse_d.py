"""Bounded delivery-before-relocation operands on one complete model witness."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def reaction_relay_reuse_d(request,transitions,remaining):
    event_count=sum(len(events) for _,_,_,events in transitions)
    work=len(request.service_demands)*len(request.state.overlays)*(len(transitions)*24+event_count*12+8)
    if work>remaining:
        return FrozenMap({'complete':False,'evaluations':0,'rows':(),
            'missing_refs':('reaction_reuse.delivery_projection_budget',)})
    rows=[]
    for demand in request.service_demands:
        if demand.kind!='BRIDGE' or demand.transmission_receiver_ref is None:continue
        for provider in request.state.overlays:
            if provider.intervention!='RELAY':continue
            delivery=None
            for index,(before,command,after,events) in enumerate(transitions):
                for owner,tick,ref,event,value in events:
                    if (event=='bridge_delivered' and ref==provider.overlay_ref
                            and value[1]==demand.transmission_receiver_ref and value[3]==demand.cell
                            and demand.start_tick<=tick<=demand.end_tick
                            and owner==request.scope.event_owner_ref
                            and value[4]==before.restore_epoch==request.state.restore_epoch):
                        delivery=(index,tick,value)
                old=next(row for row in before.overlays if row.overlay_ref==provider.overlay_ref)
                new=next(row for row in after.overlays if row.overlay_ref==provider.overlay_ref)
                if delivery is None or old.cell!=demand.cell or new.cell==old.cell:continue
                rows.append(FrozenMap({'service_ref':demand.service_ref,'consumer_ref':demand.consumer_ref,
                    'provider_ref':provider.overlay_ref,'command_ref':command.command_ref,'command_index':index,
                    'reusable_after_transmission':provider.reusable_after_transmission,
                    'transmission_source_ref':delivery[2][0],'transmission_receiver_ref':delivery[2][1],
                    'transmission_tick':delivery[1],'delivery_precedes_relocation':before.tick>delivery[1],
                    'source_window_ended':before.tick>demand.end_tick,
                    'same_restore_epoch':before.restore_epoch==after.restore_epoch==request.state.restore_epoch,
                    'relocated_from_cell':old.cell,'relocated_to_cell':new.cell,
                    'command_kind':command.kind,'relocation_on_complete_witness':True}))
                delivery=None
    return FrozenMap({'complete':True,'evaluations':work,'rows':tuple(rows),'missing_refs':()})
