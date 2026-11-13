"""Bounded exact endpoints of the one supplied complete reaction witness."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .mechanical_family_contracts_d import d_map


def reaction_staged_endpoints_d(request, transitions, remaining):
    work=len(transitions)*(len(request.service_demands)+8)
    for _,command,after,events in transitions:
        work+=len(command.phases)+len(events)*8
        work+=32+len(after.elements)*8+len(after.overlays)*16
        work+=len(after.primed_refs)+len(after.pending)*10+len(after.acquired_target_refs)
    if work>remaining:
        return FrozenMap({'complete':False,'evaluations':0,'rows':(),
            'missing_refs':('reaction_stage.endpoint_projection_budget',)})
    rows=[]
    for index, (before,command,after,events) in enumerate(transitions):
        if not any(phase in ('BURST','FLUSH') for phase in command.phases):continue
        following=transitions[index+1] if index+1<len(transitions) else None
        next_command=following[1] if following is not None else None
        next_after=following[2] if following is not None else None
        rows.append(d_map({'command_index':index,'command_ref':command.command_ref,
            'phases':command.phases,'burst_quota':command.burst_quota,
            'before_tick':before.tick,'after_tick':after.tick,
            'after_state':after,'dated_events':events,
            'next_command':next_command,'next_after_state':next_after,
            'next_command_exists':next_command is not None,
            'next_command_kind':next_command.kind if next_command is not None else '',
            'endpoint_active':after.execution_status=='ACTIVE',
            'same_restore_epoch':before.restore_epoch==after.restore_epoch,
            'active_service_refs':tuple(d.service_ref for d in request.service_demands
                if d.start_tick<=after.tick<=d.end_tick),
            'endpoint_on_complete_witness':True}))
    return FrozenMap({'complete':True,'evaluations':work,'rows':tuple(rows),'missing_refs':()})
