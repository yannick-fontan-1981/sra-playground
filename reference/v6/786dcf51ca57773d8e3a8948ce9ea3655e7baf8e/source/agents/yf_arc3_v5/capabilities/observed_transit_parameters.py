"""Bounded measurements of restored autonomous trajectories and local scene edits.

Roles, model admission and the next experiment remain declared in DRM/SRC.
All rasters come from the caller's existing canonical physical checkpoints.
"""
from collections import Counter,defaultdict
from functools import lru_cache
from math import gcd
from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.contracts import ComponentExtractionInput,FrameGrid
from agents.yf_arc3_v5.capabilities.configured_transit_d import ConfiguredTransitActorD,ConfiguredTransitRequestD
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DMechanicalScope
from agents.yf_arc3_v5.capabilities.policy_constrained_routing_d import InternalRoutePolicyD
from agents.yf_arc3_v5.capabilities.single_visit_residual_d import ResidualEdgeD
from agents.yf_arc3_v5.logos.types import FrozenMap,stable_digest


def annotate_observed_transit(value,agenda):
    facts={'transit_actual_source_return':False}
    if value.retained_physical_transition_receipt and value.periodic_cell_grids.candidates:
        from .interaction import POINT_ACTION_REF
        facts['observed_transit_point_action_ref']=POINT_ACTION_REF if POINT_ACTION_REF in value.available_action_refs else None
        facts.update(incoming_declared_route_engagement_present=value.incoming_declared_route_engagement_present,
            observed_transit_parameter_input=FrozenMap({'receipt':value.retained_physical_transition_receipt,
                'frame':value.frame,'grids':value.periodic_cell_grids.candidates,
                'frame_ref':value.current_observation_frame_ref,'epoch':value.current_context_epoch,
                'level_index':value.observed_level_index,'last_point_position':value.last_point_position}))
    context=FrozenMap(facts)
    # The Source consumer reads this packet once from the current context.
    # Alternative rows carry only descriptive flags, never duplicate rasters.
    shared=FrozenMap({key:item for key,item in sorted(facts.items()) if key!='observed_transit_parameter_input'})
    return agenda.model_copy(update={'context_facts':FrozenMap.overlay(context,agenda.context_facts),
        'alternative_facts':FrozenMap({k:FrozenMap.overlay(shared,f) for k,f in sorted(agenda.alternative_facts.items())}),
        'descriptive_delta_facts':FrozenMap({k:FrozenMap.overlay(shared,f) for k,f in sorted(agenda.descriptive_delta_facts.items())})})


@lru_cache(maxsize=256)
def _components(frame):
    return detect_components(ComponentExtractionInput(frame=frame,connectivity=8)).components


def _tracks(before,packet,config):
    frames=(before,*packet);groups=defaultdict(dict)
    for i,frame in enumerate(frames):
        for c in _components(frame):
            b=c.bbox
            if (max(b.height,b.width)>config['maximum_body_extent'] or c.area<config['minimum_body_pixels']):continue
            pattern=tuple((r-b.top,col-b.left) for r in range(b.top,b.top+b.height)
                for col in range(b.left,b.left+b.width) if frame.rows[r][col]==c.value)
            key=(c.value,b.height,b.width,pattern)
            groups[key].setdefault(i,[]).append((b.top+b.height//2,b.left+b.width//2))
    rows=[]
    for key,seen in sorted(groups.items()):
        if len(seen.get(0,()))!=1 or seen.get(len(frames)-1)!=seen[0] or any(len(p)!=1 for p in sorted(seen.values())):continue
        initial=seen[0][0];ordered=tuple((i,p[0]) for i,p in sorted(seen.items()))
        noninitial=tuple((i,p) for i,p in ordered if p!=initial)
        if len({p for _,p in noninitial})<config['minimum_motion_positions']:continue
        end=noninitial[-1][0]
        prefix=tuple((i,p) for i,p in ordered if i<=end)
        if end>=len(frames)-2 or not prefix or prefix[-1][0]-prefix[-2][0]!=1:continue
        deltas=tuple((b[1][0]-a[1][0],b[1][1]-a[1][1]) for a,b in zip(prefix,prefix[1:]) if b[0]==a[0]+1 and b[1]!=a[1])
        if not deltas or any(dr and dc for dr,dc in deltas):continue
        unit=0
        for dr,dc in deltas:unit=gcd(unit,abs(dr)+abs(dc))
        if unit<1 or any(abs(dr)+abs(dc)!=unit for dr,dc in deltas):continue
        last_delta=tuple(b-a for a,b in zip(prefix[-2][1],prefix[-1][1]))
        rows.append({'actor_ref':'measurement:transit-actor:'+stable_digest((key,initial))[:20],
            'template':key,'positions':prefix,'origin':initial,'last':prefix[-1][1],
            'continued_last':tuple(a+b for a,b in zip(prefix[-1][1],last_delta)),
            'first_absence_index':end+1,'axis_deltas':deltas,'pixel_quantum':unit})
    return tuple(rows)


def _point(grid,pixel):
    dr=pixel[0]-grid.row_offset-grid.cell_height//2
    dc=pixel[1]-grid.col_offset-grid.cell_width//2
    if dr%grid.row_pitch or dc%grid.col_pitch:return None
    p=(dr//grid.row_pitch,dc//grid.col_pitch)
    return p if 0<=p[0]<grid.logical_rows and 0<=p[1]<grid.logical_columns else None


def _patch(frame,grid,point):
    top=grid.row_offset+point[0]*grid.row_pitch;left=grid.col_offset+point[1]*grid.col_pitch
    return tuple(tuple(frame.rows[r][left:left+grid.cell_width]) for r in range(top,top+grid.cell_height))


def measure_observed_transit(before,packet,current,grids,config):
    if len(packet)>config['maximum_packet_frames']:return ()
    tracks=_tracks(before,packet,config)
    if not config['minimum_actor_count']<=len(tracks)<=config['maximum_actor_count']:return ()
    scenes=[]
    for grid in grids:
        # Validate the lattice against each stationary axis of actual motion;
        # interpolation positions are not silently counted as logical cells.
        if any((dc and (a[0]-grid.row_offset-grid.cell_height//2)%grid.row_pitch)
            or (dr and (a[1]-grid.col_offset-grid.cell_width//2)%grid.col_pitch)
            for t in tracks for (_,a),(_,b) in zip(t['positions'],t['positions'][1:])
            for dr,dc in [(b[0]-a[0],b[1]-a[1])] if (dr==0)!=(dc==0)):continue
        endpoints=[set(p for pixel in (t['last'],t['continued_last']) if (p:=_point(grid,pixel)) is not None) for t in tracks]
        common=set.intersection(*endpoints)
        if len(common)!=1:continue
        terminal=next(iter(common));actors=[];valid=True
        for t in tracks:
            samples=[]
            for i,pixel in t['positions']:
                p=_point(grid,pixel)
                if p is not None and (not samples or samples[-1][1]!=p):samples.append((i,p))
            if len(samples)<config['minimum_route_cells'] or samples[0][1]==terminal:valid=False;break
            samples.append((t['first_absence_index'],terminal))
            periods={b[0]-a[0] for a,b in zip(samples[1:],samples[2:])}
            if len(periods)!=1 or min(periods)<1:valid=False;break
            period=next(iter(periods));offset=samples[1][0]-period
            if offset<0 or any(i!=offset+ordinal*period for ordinal,(i,p) in enumerate(samples) if ordinal):valid=False;break
            if any(abs(a[1][0]-b[1][0])+abs(a[1][1]-b[1][1])!=1 for a,b in zip(samples,samples[1:])):valid=False;break
            actors.append({'actor_ref':t['actor_ref'],'route':tuple(p for _,p in samples),
                'start':samples[0][1],'arrival_index':samples[-1][0],'edge_ticks':period,'departure_tick':offset})
        if not valid:continue
        starts={a['start'] for a in actors};visited={p for a in actors for p in a['route']}
        counts=Counter(_patch(before,grid,p) for p in visited if p not in starts|{terminal})
        if not counts:continue
        maximum=max(sorted(counts.values()));floors=tuple(p for p,n in sorted(counts.items()) if n==maximum)
        if len(floors)!=1:continue
        floor=floors[0];nodes={p for p in ((r,c) for r in range(grid.logical_rows) for c in range(grid.logical_columns)) if _patch(before,grid,p)==floor}|visited
        motifs=tuple(sorted(p for p in visited-starts-{terminal} if _patch(before,grid,p)!=floor))
        if not motifs or len(motifs)>config['maximum_local_control_motifs']:continue
        changed=tuple(p for p in motifs if _patch(current,grid,p)!=_patch(before,grid,p))
        if any(_patch(current,grid,p)!=_patch(packet[-1],grid,p) for p in starts):continue
        scene={'grid':grid,'actors':tuple(actors),'nodes':tuple(sorted(nodes)),'terminal':terminal,
            'motifs':motifs,'changed':changed,'launch_action_ref':None,'floor_pattern':floor}
        scenes.append(scene)
    return tuple(scenes)


def configured_request(scene,config,context,*,exclude_changed):
    node=lambda p:'measurement:transit-cell:'+str(p[0])+':'+str(p[1])
    nodes=scene['nodes'];node_set=set(nodes);edges=[]
    for p in nodes:
        for delta in ((1,0),(0,1)):
            q=tuple(a+b for a,b in zip(p,delta))
            if q in node_set:edges.append(ResidualEdgeD(edge_ref='measurement:transit-edge:'+stable_digest((p,q))[:20],first_ref=node(p),second_ref=node(q)))
    model_ref='measurement:transit-model:'+stable_digest((scene,exclude_changed))[:20]
    scope=DMechanicalScope(request_ref='request:observed-transit:'+stable_digest((context,model_ref))[:24],
        caller_ref=context['caller'],parent_consumer_ref=config['parent_consumer_ref'],parent_goal_ref=config['parent_goal_ref'],
        parent_contribution_ref=config['parent_contribution_ref'],caller_next_item_ref=config['caller_next_item_ref'],
        epoch=context['epoch'],evidence_revision_ref=context['frame_ref'],model_revision_ref=model_ref,
        model_status_ref='SUPPOSITION',event_owner_ref=context['caller'],input_domain_complete=config['conditional_input_domain_complete'],
        assumption_refs=tuple(config['assumption_refs']))
    policy_ref=config['internal_policy_ref']
    return ConfiguredTransitRequestD(scope=scope,operation_ref=config['operation_ref'],mode_ref='STEP',requested_result_type='DMechanicalResult',
        node_bound=config['node_bound'],depth_bound=config['depth_bound'],domain_bound=config['domain_bound'],time_bound_ms=config['time_bound_ms'],
        phase_ref='EXTERNAL_CONFIGURATION_OR_TRANSIT',channel='LAUNCH',bound_switch_ref=None,
        switch_values=(),incidences=(),node_refs=tuple(map(node,nodes)),edges=tuple(edges),
        blocked_node_refs=tuple(map(node,scene['changed'])) if exclude_changed else (),directed=False,
        actors=tuple(ConfiguredTransitActorD(actor_ref=a['actor_ref'],start_ref=node(a['start']),destination_ref=node(scene['terminal']),
            current_node_ref=node(a['start']),policy_ref=policy_ref,departure_tick=a['departure_tick'],edge_travel_ticks=a['edge_ticks']) for a in scene['actors']),
        policies=(InternalRoutePolicyD(policy_ref=policy_ref,metric='EDGE_COUNT',neighbor_order=None,permit_blocked_nodes=False),),
        gates=(),dwell_ticks=(),timing_rule=config['timing_rule'],required_actor_refs=tuple(a['actor_ref'] for a in scene['actors']),
        elapsed_tick_limit=config['elapsed_tick_limit'],remaining_resource=config['modeled_physical_resource'],edit_debit=config['modeled_edit_resource_debit'],
        launch_debit=config['modeled_launch_resource_debit'],edit_has_world_clock=False,restore_actors_after_failure=True,
        preserve_configuration_after_failure=True,goal_boundary_ref=config['goal_boundary_ref'],failed_trial_event_ref=config['failed_trial_event_ref'])
