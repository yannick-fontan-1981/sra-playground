"""Finite measured-surface graphs delegated to the existing route service.

No temporal safety assertion and no native tie-order inference. Source chooses
between supplied surface domains and interprets the returned straight-prefix
questions. Exactly one declared domain and at most one deterministic witness.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_family_contracts_d import DMechanicalScope
from .policy_constrained_routing_d import (
    InternalRoutePolicyD, PolicyConstrainedRoutingRequestD,
    measure_policy_constrained_routing_d,
)
from .single_visit_residual_d import ResidualEdgeD


def measure_surface_route_questions(value, body, peer, radiometry, context, contract):
    specification=contract.get('surface_route_contract')
    parent=value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_active_goal_ref')
    if not specification or not parent or len(specification['variants'])!=1:
        return ()
    extent=body['extent']; frame=value.frame
    start=body['bounds'][:2]; destination=peer['bounds'][:2]
    common=radiometry.get('gray_common_perimeter_value')
    if common is None:
        return ()
    lifted={(r,c) for patch in (body,peer)
        for r in range(patch['bounds'][0],patch['bounds'][2]+1)
        for c in range(patch['bounds'][1],patch['bounds'][3]+1)}
    raw_positions=tuple((r,c) for r in range(start[0]%extent,frame.height-extent+1,extent)
        for c in range(start[1]%extent,frame.width-extent+1,extent))
    rows=[]
    for variant in specification['variants']:
        values={common}
        if variant['include_higher_measured_values']:
            values.update(radiometry.get('gray_higher_palette_values',()))
        positions=tuple(p for p in raw_positions if all((r,c) in lifted or frame.rows[r][c] in values
            for r in range(p[0],p[0]+extent) for c in range(p[1],p[1]+extent)))
        if start not in positions or destination not in positions:
            continue
        refs={p:f'raster:{p[0]}:{p[1]}' for p in positions}
        edges=tuple(ResidualEdgeD(edge_ref=f'{refs[p]}:{refs[q]}',first_ref=refs[p],second_ref=refs[q])
            for p in positions for q in ((p[0]+extent,p[1]),(p[0],p[1]+extent)) if q in refs)
        revision=stable_digest((value.current_observation_frame_ref,positions,edges,variant))
        token=stable_digest((parent,revision,start,destination))
        scope=DMechanicalScope(request_ref=token,caller_ref=specification['caller_ref'],
            parent_consumer_ref=specification['consumer_ref'],parent_goal_ref=parent,
            parent_contribution_ref=token,caller_next_item_ref=specification['next_item_ref'],
            epoch=value.current_context_epoch,evidence_revision_ref=value.current_observation_frame_ref,
            model_revision_ref=revision,model_status_ref=specification['model_status_ref'],
            event_owner_ref=specification['event_owner_ref'],input_domain_complete=True,
            assumption_refs=tuple(specification['assumption_refs']))
        request=PolicyConstrainedRoutingRequestD(scope=scope,
            operation_ref=specification['operation_ref'],mode_ref='DOMAIN',requested_result_type='DMechanicalResult',
            node_bound=specification['node_bound'],depth_bound=specification['depth_bound'],
            domain_bound=specification['domain_bound'],time_bound_ms=specification['time_bound_ms'],
            phase_ref='ROLE_TAGGED_INTERNAL_ROUTE',graph_role='PHYSICAL_PASSAGE',
            node_refs=tuple(refs.values()),edges=edges,directed=False,
            origin_ref=refs[start],destination_ref=refs[destination],requested_property='REALIZED_ROUTE',
            policies=(InternalRoutePolicyD(policy_ref=variant['policy_ref'],metric='EDGE_COUNT',
                neighbor_order=tuple(refs.values()),permit_blocked_nodes=False),))
        result=measure_policy_constrained_routing_d(request)
        if not result.domain_complete:
            continue
        results=result.values.get('policy_result_rows',())
        witnesses=results[0].get('policy_realized_routes',()) if results else ()
        if len(witnesses)!=1 or len(witnesses[0])<2:
            continue
        inverse={ref:p for p,ref in sorted(refs.items())}
        path=tuple(inverse[ref] for ref in witnesses[0])
        delta=tuple(path[1][i]-path[0][i] for i in (0,1))
        count=1
        while count+1<len(path) and tuple(path[count+1][i]-path[count][i] for i in (0,1))==delta:
            count+=1
        end=path[count]
        prefix_common=all((r,c) in lifted or frame.rows[r][c]==common
            for p in path[:count+1] for r in range(p[0],p[0]+extent) for c in range(p[1],p[1]+extent))
        point=(end[0]+extent//2,end[1]+extent//2)
        route_context=FrozenMap.overlay({'projection_contract':specification['projection_contract'],
            'surface_route_variant_ref':variant['policy_ref'],'surface_route_positions':path,
            'surface_route_first_leg_positions':path[:count+1],
            'surface_route_service_scope':scope,'surface_route_service_cause':result.cause,
            'surface_route_service_examined':result.examined_count,
            'surface_route_temporal_model_bound':False,'surface_route_native_tie_order_known':False},context)
        rows.append((point,FrozenMap({'surface_route_question_present':True,
            'surface_route_variant_ref':variant['policy_ref'],'surface_route_pitch':extent,
            'surface_route_path_edge_count':len(path)-1,'surface_route_first_leg_edge_count':count,
            'surface_route_first_leg_common_extent':prefix_common,
            'surface_route_payload_outside_body_bounds':not(
                body['bounds'][0]<=point[0]<=body['bounds'][2]
                and body['bounds'][1]<=point[1]<=body['bounds'][3]),
            'surface_route_first_leg_manhattan_exact':sum(abs(end[i]-start[i]) for i in (0,1))==count*extent,
            'surface_route_context':route_context,'surface_route_revision':revision})))
    return tuple(rows)
