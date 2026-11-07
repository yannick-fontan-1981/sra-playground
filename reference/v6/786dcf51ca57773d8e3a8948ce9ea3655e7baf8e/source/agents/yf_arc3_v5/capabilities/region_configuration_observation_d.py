"""Declared conditional region geometry into existing finite/graph services.

Only measured shapes, exact finite relations, kinematics and one bounded
declaration-ordered witness are computed. DRM owns interpretation/admission;
SRC owns the current experiment and independent control/WHY/ACT release.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .region_frame_observation_d import measure_region_frames
from .container_admission_d import ContainerVolumeD, ContainerAdmissionRequestD, measure_container_admission_d
from .mechanical_family_contracts_d import DMechanicalScope
from .finite_search_contracts_c import FiniteVariableC, FiniteRelationC, FiniteSearchInputC
from .finite_search_c import enumerate_finite_relations
from .mechanical_request_contracts import MechanicalRequestIdentity
from .articulated_channel_kinematics import measure_articulated_kinematics
from .contracts import ArticulatedBodyState, ArticulatedKinematicsInput, FrameGrid, ComponentExtractionInput
from .components import detect_components
from .planning import _first_shortest_route_witness


def _volume(ref,parent,h,w,origin,walls):
    return ContainerVolumeD(identity_ref=ref,parent_ref=parent,world_origin=(origin[1],origin[0]),
        volume_offsets=tuple((x,y) for y in range(h) for x in range(w)),
        interior_offsets=tuple((x,y) for y in range(1,h-1) for x in range(1,w-1)),
        passage_wall_offsets=tuple((x,y) for y,x in walls))


def _scope(value,token,contract,suffix):
    return DMechanicalScope(**dict(contract['scope']),request_ref='measurement.region_configuration.'+token+suffix,
        evidence_revision_ref=value.current_observation_frame_ref,model_revision_ref=token,
        epoch=value.current_context_epoch or 0,input_domain_complete=True)


def _origins(frames,poses):
    bodies=[]
    for i,g in enumerate(frames):
        y,x=(0,0) if not i else poses[i-1]
        bodies.append(ArticulatedBodyState(body_ref=f'measurement.region.{i}',
            parent_ref=f'measurement.region.{g["parent_index"]}' if i else None,
            local_translation=((x,1),(y,1))))
    result=measure_articulated_kinematics(ArticulatedKinematicsInput(bodies=tuple(bodies)))
    return tuple((int(g.root_position[1][0]),int(g.root_position[0][0])) for g in result.body_geometries)


def _position_domains(value,field,token,contract):
    frames=field['frames'];domains=[];examined=0
    for i,g in enumerate(frames[1:],1):
        parent=frames[g['parent_index']];ph,pw=parent['dimensions'];h,w=g['dimensions'];oy,ox=g['local_origin']
        candidates=tuple((y,x) for y in range(1,ph-h) for x in range(1,pw-w))
        if not candidates or len(candidates)>contract['maximum_pose_candidates']:return None
        request=ContainerAdmissionRequestD(scope=_scope(value,token,contract,f'.domain.{i}'),
            operation_ref=contract['admission_operation_ref'],mode_ref='DOMAIN',phase_ref='SUBTREE_GEOMETRY',
            requested_result_type='DMechanicalResult',**dict(contract['admission_bounds']),
            containers=(_volume('measurement.parent',None,ph,pw,(0,0),parent['walls']),
                        _volume('measurement.child','measurement.parent',h,w,(oy,ox),g['walls'])),
            moving_root_ref='measurement.child',candidate_displacements=tuple((x-ox,y-oy) for y,x in candidates),
            world_admission_cells=tuple((x,y) for y in range(ph) for x in range(pw)),
            fixed_partition_cells=tuple((x,y) for y,x in parent['walls'] if 0<y<ph-1 and 0<x<pw-1),
            partition_domain=contract['partition_domain'],transition_policy=contract['transition_policy'])
        result=measure_container_admission_d(request)
        if not result.domain_complete:return None
        examined+=result.examined_count
        domain=tuple(pose for pose,row in zip(candidates,result.values['pose_rows']) if row['geometrically_admissible'])
        if not domain or len(domain)>contract['maximum_pose_values']:return None
        domains.append(domain)
    return tuple(domains),examined


def _sibling_poses_admissible(frames,indices,poses):
    for left,first in enumerate(indices):
        ay,ax=poses[left];ah,aw=frames[first]['dimensions']
        for right in range(left+1,len(indices)):
            second=indices[right];by,bx=poses[right];bh,bw=frames[second]['dimensions']
            if not (ax+aw<=bx or bx+bw<=ax or ay+ah<=by or by+bh<=ay):return False
    return True


def _configuration_population(value,field,token,contract,domains):
    frames=field['frames'];variables=[];poses={}
    for i,domain in enumerate(domains,1):
        refs=[]
        for pose in domain:
            ref=f'measurement.region_pose.{i}.{pose[0]}.{pose[1]}'
            poses[ref]=pose;refs.append(ref)
        variables.append(FiniteVariableC(variable_ref=f'measurement.region.{i}',values=tuple(refs),
            costs=FrozenMap({ref:0 for ref in refs})))
    relations=[]
    for i,a in enumerate(frames[1:],1):
        for j,b in enumerate(frames[1:],1):
            if i>=j or a['parent_index']!=b['parent_index']:continue
            ah,aw=a['dimensions'];bh,bw=b['dimensions'];rows=[]
            for x in variables[i-1].values:
                ay,ax=poses[x]
                for z in variables[j-1].values:
                    by,bx=poses[z]
                    if _sibling_poses_admissible(frames,(i,j),(poses[x],poses[z])):rows.append((x,z))
            relations.append(FiniteRelationC(relation_ref=f'measurement.region_siblings.{i}.{j}',
                variable_refs=(variables[i-1].variable_ref,variables[j-1].variable_ref),
                allowed_rows=tuple(rows),domain_complete=True))
    if len(relations)>contract['maximum_relations']:return None
    variables,relations=tuple(variables),tuple(relations)
    order=tuple(x.variable_ref for x in variables);evidence=(value.current_observation_frame_ref,)
    metric=contract['population_metric_ref'];descriptor=(variables,relations,order,metric,True,evidence)
    request=MechanicalRequestIdentity(request_ref='measurement.region_population.'+token,
        kernel_ref=contract['kernel_ref'],operation_ref=contract['finite_operation_ref'],mode='CSP',
        caller_ref=contract['scope']['caller_ref'],parent_contribution_ref=contract['scope']['parent_contribution_ref'],
        epoch=value.current_context_epoch or 0,input_revision_ref=evidence[0],
        model_assignments=FrozenMap(contract['conditional_model_assignments']),
        immutable_inputs=FrozenMap({'finite_relation_digest':stable_digest(immutable_json_data(descriptor)),
                                   'cost_metric_ref':metric}),
        actual_bounds=FrozenMap(contract['finite_bounds']),expected_return_type='FiniteSearchFactsC')
    result=enumerate_finite_relations(FiniteSearchInputC(request=request,variables=variables,relations=relations,
        variable_order=order,cost_metric_ref=metric,domain_complete=True,evidence_refs=evidence))
    examined=result.examined_count;batches=1
    for _ in range(contract['maximum_finite_batches']-1):
        if result.complete or not result.bounded or result.checkpoint is None:break
        result=enumerate_finite_relations(result.request.model_copy(update={'resume':result.checkpoint}))
        examined+=result.examined_count;batches+=1
    if not result.complete:return None
    configs=tuple(tuple(poses[row['assignment'][v.variable_ref]] for v in variables) for row in result.retained_frontier)
    return configs,examined,batches


def _passage_present(field,poses):
    frames=field['frames'];origins=_origins(frames,poses);walls=set()
    for origin,g in zip(origins,frames):
        walls.update((origin[0]+y,origin[1]+x) for y,x in g['walls'])
    h,w=frames[0]['dimensions'];owner=field['cross_owner'];anchor=field['cross_anchor']
    source=(origins[owner][0]+anchor[0],origins[owner][1]+anchor[1])
    grid=FrameGrid(rows=tuple(tuple(int((y,x) in walls) for x in range(w)) for y in range(h)))
    components=detect_components(ComponentExtractionInput(frame=grid)).components
    return any(c.value==0 and source in c.pixels and field['boundary_opening'] in c.pixels for c in components)


def _witness(value,field,token,contract,focus):
    measured=_position_domains(value,field,token,contract)
    if measured is None:return None
    domains,admission_count=measured
    if contract.get('factorize_independent_pose_domains') is True:
        from math import prod
        from collections import Counter
        independent_groups=Counter(g['parent_index'] for g in field['frames'][1:])
        if (len(independent_groups)>1
                and max(independent_groups.values())<=contract.get('maximum_factor_variables',0)
                and contract['control_order']=='canonical'
                and prod(len(domain) for domain in domains)>contract['finite_bounds']['max_states']):
            from .region_configuration_factors_d import factorized_region_witness
            factored=factorized_region_witness(value,field,token,contract,domains)
            if factored is None:return None
            word,counts=factored
            return word,FrozenMap({**dict(counts),'admission_examined':admission_count})
    population=_configuration_population(value,field,token,contract,domains)
    if population is None:return None
    configs,finite_count,batches=population;frames=field['frames']
    initial=tuple(g['local_origin'] for g in frames[1:]);known=set(configs)
    if initial not in known or len(configs)*(len(frames)-1)>contract['maximum_graph_nodes']:return None
    nodes=tuple((c,s) for c in configs for s in range(1,len(frames)))
    indices={row:i for i,row in enumerate(nodes)}
    accepting=frozenset(c for c in configs if _passage_present(field,c))
    accepting_indices=frozenset(i for i,(c,s) in enumerate(nodes) if c in accepting)
    edges=[];commands={}
    for ni,(c,active) in enumerate(nodes):
        for action_ref,vector in sorted(contract['direction_vectors'].items()):
            if action_ref not in value.available_action_refs:continue
            dy,dx=vector;y,x=c[active-1]
            new=tuple((y+dy,x+dx) if i==active-1 else p for i,p in enumerate(c))
            if new not in known:continue
            j=indices[(new,active)];label=f'measurement.region_command.{ni}.{action_ref}'
            edges.append((ni,j,label));commands[label]=(action_ref,active)
        if contract['point_action_ref'] in value.available_action_refs:
            for other in range(1,len(frames)):
                if other==active:continue
                j=indices[(c,other)];label=f'measurement.region_command.{ni}.focus.{other}'
                edges.append((ni,j,label));commands[label]=(contract['point_action_ref'],other)
    if len(edges)>contract['maximum_graph_edges']:return None
    start=indices[(initial,focus)]
    route=_first_shortest_route_witness(initial=tuple(int(i==start) for i in range(len(nodes))),
        controls=tuple(edges),goal_test=lambda state:any(state[i] for i in accepting_indices),capacities=(1,)*len(nodes),
        max_expanded_states=contract['maximum_expanded_states'],max_depth=contract['maximum_route_depth'],
        control_order_variant=contract['control_order'])
    if route is None or not route.route:return None
    word=[]
    for source,destination,label in route.route:
        before,before_focus=nodes[source];after,after_focus=nodes[destination]
        action_ref,actor=commands[label]
        word.append(FrozenMap({'before_poses':before,'after_poses':after,'before_focus':before_focus,
            'after_focus':after_focus,'action_ref':action_ref,'actor_index':actor}))
    return tuple(word),FrozenMap({'admission_examined':admission_count,'finite_examined':finite_count,
        'finite_batches':batches,'configuration_population':len(configs),'graph_nodes':len(nodes),
        'graph_edges':len(edges),'accepting_configurations':len(accepting),'expanded_states':route.expanded_state_count})


def _current_full_admission(value,field,token,contract,step):
    frames=field['frames'];before=tuple(tuple(p) for p in step['before_poses'])
    after=tuple(tuple(p) for p in step['after_poses']);origins=_origins(frames,before)
    predicted=_origins(frames,after);actor=step['actor_index'];parent=frames[actor]['parent_index']
    if parent is None:return None
    ph,pw=frames[parent]['dimensions'];py,px=origins[parent]
    delta=(predicted[actor][1]-origins[actor][1],predicted[actor][0]-origins[actor][0])
    h,w=frames[0]['dimensions']
    containers=tuple(_volume(f'measurement.region.{i}',f'measurement.region.{g["parent_index"]}' if i else None,
        *g['dimensions'],origin,g['walls']) for i,(g,origin) in enumerate(zip(frames,origins)))
    result=measure_container_admission_d(ContainerAdmissionRequestD(scope=_scope(value,token,contract,'.current_step'),
        operation_ref=contract['admission_operation_ref'],mode_ref='PRECONDITION',phase_ref='SUBTREE_GEOMETRY',
        requested_result_type='DMechanicalResult',**dict(contract['admission_bounds']),containers=containers,
        moving_root_ref=f'measurement.region.{actor}',candidate_displacements=(delta,),
        world_admission_cells=tuple((x,y) for y in range(h) for x in range(w)),
        fixed_partition_cells=tuple((px+x,py+y) for y,x in frames[parent]['walls'] if 0<y<ph-1 and 0<x<pw-1),
        partition_domain=contract['partition_domain'],transition_policy=contract['transition_policy']))
    if not result.domain_complete:return None
    row=result.values['pose_rows'][0]
    if not row['geometrically_admissible']:return None
    if any(tuple(row['world_origins'][f'measurement.region.{i}'])!=(p[1],p[0]) for i,p in enumerate(predicted)):
        return None
    return row['carried_identity_refs'],result.examined_count


def measure_region_configuration_loci(value,frame,components,contract):
    if (not contract or frame.width*frame.height>contract['maximum_frame_pixels']
            or len(components)>contract['maximum_components'] or not value.current_observation_frame_ref):return ()
    if not all(item is True for item in sorted(contract['conditional_model_assignments'].values())):return ()
    field=measure_region_frames(frame,components,contract)
    if field is None:return ()
    frames=field['frames'];poses=tuple(g['local_origin'] for g in frames[1:])
    # ARC white is a protocol colour measurement, not a game-role assignment.
    from .interaction import ARC_PALETTE_WHITE_VALUE
    white=tuple(i for i,g in enumerate(frames) if g['value']==ARC_PALETTE_WHITE_VALUE)
    if len(white)!=1 or white[0]==0:return ()
    focus=white[0]
    token=stable_digest((field['quantum'],frames[0]['box'][:2],
        tuple((g['identity'],g['parent_index']) for g in frames),field['cross_owner'],field['cross_anchor'],field['boundary_opening']))
    carried=value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context') or {}
    retired_prior_epoch=False
    if (contract.get('retire_prior_epoch_geometry_bindings') is True
            and carried.get('region_configuration_context_epoch') is not None
            and value.current_context_epoch is not None
            and carried['region_configuration_context_epoch']!=value.current_context_epoch):
        # Keep the canonical history, but do not use its poses or route as
        # current input. All same-epoch prediction/selection guards below stay.
        carried={}
        retired_prior_epoch=True
    prior=bool(carried.get('region_configuration_geometry_token'));matches=None
    if prior:
        matches=(carried['region_configuration_geometry_token']==token
            and carried.get('region_configuration_context_epoch')==value.current_context_epoch
            and value.previous_action_observed_frame is not None
            and carried.get('region_configuration_source_frame_digest')==stable_digest(value.previous_action_observed_frame.rows)
            and tuple(tuple(p) for p in carried.get('region_configuration_expected_poses',()))==poses
            and carried.get('region_configuration_expected_focus')==focus)
        if not matches:return ()
        word=tuple(carried.get('region_configuration_word',()))[1:]
        counts=FrozenMap({'admission_examined':0,'finite_examined':0,'finite_batches':0,
            'configuration_population':0,'graph_nodes':0,'graph_edges':0,'accepting_configurations':0,'expanded_states':0})
    else:
        witness=_witness(value,field,token,contract,focus)
        if witness is None:return ()
        word,counts=witness
    if not word:return ()
    step=word[0]
    if tuple(tuple(p) for p in step['before_poses'])!=poses or step['before_focus']!=focus:return ()
    admission=_current_full_admission(value,field,token,contract,step)
    if admission is None:return ()
    carried_ids,admission_count=admission;actor=step['actor_index'];action=step['action_ref']
    point=None
    if action==contract['point_action_ref']:
        t,l,b,r=frames[actor]['box'];q=field['quantum'];point=(t+q//2,l+q//2)
    expected=tuple(tuple(p) for p in step['after_poses'])
    recalled=tuple(str(item['claim_ref']) for item in
        value.prior_context_transmitted_workflow_activity_schema_claim_facts
        if item.get('workflow_ref')==contract.get('portable_workflow_ref')
        and item.get('claim_ref') and item.get('ordered_activity_refs'))
    return (FrozenMap({'point':point,'component_ref':frames[actor]['component_ref'],'action_ref':action,
        'region_configuration_prior_epoch_geometry_retired':retired_prior_epoch,
        'region_configuration_recalled_method_claim_refs':recalled,
        'region_configuration_recalled_method_claim_count':len(recalled),
        'region_configuration_geometry_token':token,'region_configuration_context_epoch':value.current_context_epoch,
        'region_configuration_source_frame_ref':value.current_observation_frame_ref,
        'region_configuration_source_frame_digest':stable_digest(frame.rows),
        'region_configuration_poses':poses,'region_configuration_focus':focus,
        'region_configuration_expected_poses':expected,'region_configuration_expected_focus':step['after_focus'],
        'region_configuration_word':word,'region_configuration_remaining_step_count':len(word),
        'region_configuration_previous_prediction_matches':matches,'region_configuration_word_reused':prior,
        'region_configuration_prior_intent_ref':value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_intent_ref'),
        'region_configuration_prior_active_goal_ref':value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_active_goal_ref'),
        'region_configuration_search_counts':counts,'region_configuration_current_admission_examined':admission_count,
        'region_configuration_predicted_carried_identity_refs':carried_ids,
        'region_configuration_current_step_geometry_complete':True,'region_configuration_conditional_model':True,
        'region_configuration_quantum':field['quantum'],'region_configuration_frame_count':len(frames),
        'region_configuration_unique_white_frame_count':len(white),
        'region_configuration_incoming_route_remaining_step_count':value.incoming_declared_route_remaining_step_count}),)
