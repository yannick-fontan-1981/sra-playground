"""Pure supplied-law transport, pickup, protection and finite route operations."""
from collections.abc import Mapping
from agents.yf_arc3_v5.capabilities.mechanical_contracts_b import MechanicalRequestB, MechanicalResultB, found, missing
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from agents.yf_arc3_v5.capabilities.mechanical_transport_b import provider_request_payload,provider_result_payload


def _inside(point, rectangle):
    top,left,bottom,right=rectangle
    return top <= point[0] <= bottom and left <= point[1] <= right


def _distance(a,b,metric):
    dr,dc=abs(a[0]-b[0]),abs(a[1]-b[1])
    if metric=='manhattan':return dr+dc
    if metric=='chebyshev':return max(dr,dc)
    if metric=='squared_euclidean':return dr*dr+dc*dc
    raise ValueError('a proximity metric must be declared')


def _threats(state,model):
    positions=state['positions'];sides=state['sides'];carried=set(state['carried_refs']);active=[]
    for relation in model['directed_threats']:
        predator,prey=relation['predator_ref'],relation['prey_ref']
        if predator in carried or prey in carried or sides[predator]!=sides[prey]:continue
        protection=model['protection_by_side'].get(sides[predator])
        supervisor_ref=relation.get('supervisor_ref')
        supervisor=state['supervision_by_actor'][supervisor_ref] if supervisor_ref is not None else FrozenMap({'position':state['carrier_position'],'active':True})
        protected=supervisor['active'] and protection is not None and _inside(supervisor['position'],protection)
        if relation.get('protection_metric') is not None:
            protected=protected and _distance(supervisor['position'],positions[predator],relation['protection_metric']) <= relation['protection_radius']
        if not protected:active.append(FrozenMap({'predator_ref':predator,'prey_ref':prey,'side_ref':sides[predator]}))
    return tuple(active)


def _supervision_complete(state,model):
    supplied=state.get('supervision_by_actor',{})
    return all(relation.get('supervisor_ref') is None or (
        relation['supervisor_ref'] in supplied and 'position' in supplied[relation['supervisor_ref']]
        and type(supplied[relation['supervisor_ref']].get('active')) is bool) for relation in model['directed_threats'])


def _accepted(state,model):
    predicates=model.get('terminal_assignments')
    if predicates is None:return False
    # A receiving-side requirement for the carrier is an independently supplied
    # terminal clause, never an imported traditional-puzzle assumption.
    if 'terminal_carrier_side' in model and state.get('carrier_side')!=model['terminal_carrier_side']:return False
    if 'terminal_carried_refs' in model and tuple(sorted(state['carried_refs']))!=tuple(sorted(model['terminal_carried_refs'])):return False
    return bool(predicates) and all(state['sides'].get(ref)==predicates[ref] and ref not in state['carried_refs'] for ref in sorted(predicates))


def _step(state,model,action,data,include_checkpoints=True,ledger=None):
    definition=model['actions'].get(action)
    if definition is None:return None,(),'unknown_action'
    output=dict(state);positions=dict(state['positions']);sides=dict(state['sides']);carried=list(state['carried_refs']);events=[]
    def capture(kind,fields=(),predicates=None,interruption=None):
        if ledger is not None:ledger.record(output,kind,fields,predicates,interruption)
    operator=definition['operator_ref'];before=tuple(state['carrier_position']);position=before
    if operator=='translate':
        dr,dc=definition['delta'];top,left,bottom,right=model['carrier_bounds']
        position=(max(top,min(bottom,before[0]+dr)),max(left,min(right,before[1]+dc)))
        for ref in carried:
            old=positions[ref];positions[ref]=(old[0]+position[0]-before[0],old[1]+position[1]-before[1])
    elif operator=='cross':
        crossing=model['crossing_by_side'].get(state['carrier_side'])
        if crossing is None or not _inside(before,crossing['trigger_rectangle']):
            capture('direct.safe_refusal',('carrier_position','carrier_side'),{'safe_refusal':True})
            return output,(),'safe_refusal'
        position=tuple(crossing['receiving_position']);output['carrier_side']=crossing['receiving_side']
        for ref in carried:
            old=positions[ref];positions[ref]=(old[0]+position[0]-before[0],old[1]+position[1]-before[1]);sides[ref]=output['carrier_side']
    elif operator=='pickup':
        target=data.get('object_ref')
        if target is None:return None,(),'unknown_selected_occurrence'
        if target not in positions or target in carried or len(carried)>=model['capacity'] or sides[target]!=state['carrier_side'] or _distance(before,positions[target],model['pickup_metric'])>model['pickup_radius']:
            capture('direct.safe_refusal',('positions','sides','carried_refs','carrier_position','carrier_side'),{'safe_refusal':True})
            return output,(),'safe_refusal'
        carried.append(target)
    elif operator=='deposit':
        target=data.get('object_ref')
        if target is None:return None,(),'unknown_selected_occurrence'
        if target not in carried:
            capture('direct.safe_refusal',('carried_refs',),{'safe_refusal':True})
            return output,(),'safe_refusal'
        if model['release_kind']=='rigid_offset':pass
        elif model['release_kind']=='canonical_receiver':positions[target]=tuple(model['receiver_by_side'][state['carrier_side']])
        else:return None,(),'unknown_release_model'
        sides[target]=state['carrier_side'];carried.remove(target)
    elif operator=='set_supervision':
        if any(key not in definition for key in ('supervisor_ref','position','active')) or type(definition.get('active')) is not bool:
            return None,(),'unknown_supervision_effect'
        supervision=dict(state.get('supervision_by_actor',{}))
        supervision[definition['supervisor_ref']]=FrozenMap({'position':tuple(definition['position']),'active':definition['active']})
        output['supervision_by_actor']=FrozenMap(supervision)
    elif operator=='reset':
        if 'reset_state' not in model:return None,(),'unknown_reset_contract'
        output=dict(model['reset_state'])
        capture('restoration.reset')
        return FrozenMap(output),(FrozenMap({'phase':'restoration','operator':'reset'}),),'reset'
    else:return None,(),'unsupported_operator'
    output.update(carrier_position=position,positions=FrozenMap(positions),sides=FrozenMap(sides),carried_refs=tuple(carried))
    events.append(FrozenMap({'phase':'direct','operator_ref':operator,'before_position':before,'after_position':position}))
    read_fields={'translate':('carrier_position','positions','carried_refs'),
        'cross':('carrier_position','carrier_side','positions','sides','carried_refs'),
        'pickup':('carrier_position','carrier_side','positions','sides','carried_refs'),
        'deposit':('carrier_position','carrier_side','positions','sides','carried_refs'),
        'set_supervision':('supervision_by_actor',)}
    capture('direct.'+operator,read_fields[operator])
    for phase in model['checkpoint_order'] if include_checkpoints else ():
        if phase=='acceptance':
            accepted=_accepted(output,model);events.append(FrozenMap({'phase':'acceptance','accepted':accepted}))
            output['accepted']=accepted
            capture('checkpoint.acceptance',('carrier_side','sides','carried_refs'),{'accepted':accepted},
                'model.terminal_acceptance' if accepted else None)
            if accepted:break
        elif phase=='threat':
            if not _supervision_complete(output,model):return None,tuple(events),'unknown_supervision_domain'
            threats=_threats(output,model);events.append(FrozenMap({'phase':'automatic','active_threats':threats}))
            output['active_threats']=threats
            capture('checkpoint.threat',('carrier_position','carrier_side','positions','sides','carried_refs','supervision_by_actor'),
                {'active_threats':threats},'model.active_threat' if threats else None)
            if threats:break
        else:return None,tuple(events),'unknown_checkpoint'
    return FrozenMap(output),tuple(events),'accepted_no_motion_preparation' if position==before and operator in ('pickup','deposit','set_supervision') else 'applied'


def _model_complete(model):
    return (all(key in model for key in ('actions','carrier_bounds','crossing_by_side','capacity','pickup_metric','pickup_radius','release_kind','directed_threats','protection_by_side','checkpoint_order'))
            and (model.get('release_kind') != 'canonical_receiver' or 'receiver_by_side' in model)
            and ('acceptance' not in model.get('checkpoint_order',()) or 'terminal_assignments' in model))


def external_primitive(request: MechanicalRequestB):
    if not _model_complete(request.model):return missing(request,'model.complete_guarded_transport')
    from agents.yf_arc3_v5.capabilities.mechanical_ledger_b import MechanicalLedgerB
    ledger=MechanicalLedgerB(request)
    after,events,outcome=_step(request.state,request.model,request.data.get('action_ref'),request.data,ledger=ledger)
    if after is None:return MechanicalResultB(request=request,source_status='NEEDS_EVIDENCE',cause='UNSUPPORTED_MODEL',
        values=FrozenMap({'events':events,**ledger.values(False,outcome)}),missing_refs=(outcome,))
    return found(request,state=after,events=events,source_outcome=outcome,primitive_count=1,
        **ledger.values(True,outcome))


def step(request: MechanicalRequestB):
    return external_primitive(request)


def _fit(request,dimensions):
    survivors=[];rejected=[]
    for index,model in enumerate(request.model_alternatives):
        covered=bool(request.observations);agrees=True
        for observation in request.observations:
            if observation.get('sealed') is not True or observation.get('direct_phase_sealed') is not True:
                covered=False;continue
            try:
                after,events,outcome=_step(observation['before'],model,observation['action_ref'],observation.get('data',{}),include_checkpoints=False)
            except KeyError:
                covered=False;break
            if after is None:covered=False;break
            if any(key not in after or key not in observation['after'] for key in dimensions):covered=False;break
            if any(after[key]!=observation['after'][key] for key in dimensions):agrees=False;break
        if agrees:survivors.append(FrozenMap({'model_index':index,'model':model,'covered':covered,'observation_count':len(request.observations)}))
        else:rejected.append(index)
    return found(request,unrejected_models=tuple(survivors),contradicted_model_indices=tuple(rejected),
                 observed_count=len(request.observations),motion_quantum_from_silhouette=False)


def control_crossing_fit(request: MechanicalRequestB):
    return _fit(request,('carrier_position','carrier_side'))


def binding_fit(request: MechanicalRequestB):
    return _fit(request,('positions','carried_refs','sides'))


def threat_fit(request: MechanicalRequestB):
    if any('directed_threats' not in model or 'protection_by_side' not in model for model in request.model_alternatives):
        return missing(request,'model.directed_threat_or_supervision')
    survivors=[];rejected=[]
    for index,model in enumerate(request.model_alternatives):
        covered=bool(request.observations);contradiction=False
        for observation in request.observations:
            if observation.get('sealed') is not True or 'active_threats' not in observation or not _supervision_complete(observation['state'],model):covered=False;continue
            actual=_threats(observation['state'],model)
            if actual!=tuple(observation['active_threats']):contradiction=True;break
        if not contradiction:survivors.append(FrozenMap({'model_index':index,'model':model,'covered':covered}))
        else:rejected.append(index)
    return found(request,unrejected_models=tuple(survivors),contradicted_model_indices=tuple(rejected),
                 singleton_does_not_certify_arbitrary_group=True)


def protection_domain(request: MechanicalRequestB):
    if any(key not in request.model for key in ('directed_threats','protection_by_side')):
        return missing(request,'model.named_threat_checkpoint')
    if request.data.get('terminal_already_accepted') is True and request.data.get('acceptance_terminates_before_threat') is True:
        return found(request,active_threats=(),checkpoint_discharge='terminal_acceptance_precedes_threat')
    if not _supervision_complete(request.state,request.model):return missing(request,'state.current_supervision')
    return found(request,active_threats=_threats(request.state,request.model),checkpoint_ref=request.data.get('checkpoint_ref'))


def handoff_domain(request: MechanicalRequestB):
    if not _model_complete(request.model) or any(key not in request.data for key in ('deposit_action_ref','object_ref','next_object_ref','deposit_pose_domain','next_pickup_pose_domain')):
        return missing(request,'model.handoff_consumer_domains')
    deposit=request.model['actions'].get(request.data['deposit_action_ref'])
    if not isinstance(deposit,Mapping) or 'operator_ref' not in deposit:
        return missing(request,'model.handoff_deposit_operator')
    if deposit['operator_ref']!='deposit':
        return MechanicalResultB(request=request,source_status='MODEL_CONTRADICTION',
            cause='INCOMPATIBLE_INPUT_DOMAIN',values=FrozenMap({
                'action_ref':request.data['deposit_action_ref'],
                'expected_operator_ref':'deposit','actual_operator_ref':deposit['operator_ref'],
                'route_computed':False,'no_dispatch_or_action_authority':True}))
    candidates=[];poses=tuple(request.data['deposit_pose_domain']);bound=request.bounds.get('max_domain',0)
    for index,pose in enumerate(poses):
        if index>=bound:return MechanicalResultB(request=request,source_status='BUDGET_REACHED',cause='COMPUTATION_BOUND',values=FrozenMap({'candidates':tuple(candidates)}),examined_count=index,frontier=tuple(FrozenMap({'pose':p}) for p in poses[index:]))
        before=request.state
        moved=dict(before);origin=before['carrier_position'];positions=dict(before['positions'])
        for ref in before['carried_refs']:
            p=positions[ref];positions[ref]=(p[0]+pose[0]-origin[0],p[1]+pose[1]-origin[1])
        moved.update(carrier_position=tuple(pose),positions=FrozenMap(positions))
        after,events,outcome=_step(FrozenMap(moved),request.model,request.data['deposit_action_ref'],request.data)
        if after is None:
            return MechanicalResultB(request=request,source_status='NEEDS_EVIDENCE',cause='UNSUPPORTED_MODEL',
                values=FrozenMap({'candidates':tuple(candidates),'unresolved_outcome':outcome,'events':events}),
                examined_count=index,domain_size=len(poses),domain_exhausted=False,
                missing_refs=(outcome,),frontier=tuple(FrozenMap({'pose':p}) for p in poses[index:]))
        if outcome=='safe_refusal' or (not after.get('accepted') and _threats(after,request.model)):continue
        target=request.data['next_object_ref']
        absent=tuple('state.'+field+'.'+target for field in ('positions','sides') if target not in after[field])
        if absent:
            return MechanicalResultB(request=request,source_status='NEEDS_EVIDENCE',cause='MISSING_OBSERVATION',
                values=FrozenMap({'candidates':tuple(candidates),'after':after,'events':events}),
                examined_count=index,domain_size=len(poses),domain_exhausted=False,
                missing_refs=absent,frontier=tuple(FrozenMap({'pose':p}) for p in poses[index:]))
        if target in after['carried_refs'] or len(after['carried_refs']) >= request.model['capacity'] or after['sides'][target] != after['carrier_side']:
            continue
        pickup=tuple(p for p in request.data['next_pickup_pose_domain']
            if _distance(p,after['positions'][target],request.model['pickup_metric'])<=request.model['pickup_radius'])
        if pickup:
            # Inverse poses are conditional endpoints, never executed movement.
            # Keep the dependency states explicit for the external K03/K09 caller.
            constraints=FrozenMap({'directed_threats':request.model['directed_threats'],
                'protection_by_side':request.model['protection_by_side'],
                'checkpoint_order':request.model['checkpoint_order']})
            common=FrozenMap({'model_ref':request.model_ref,'epoch':request.epoch,
                'input_revision_ref':request.input_revision_ref,
                'consumer_ref':request.data.get('consumer_ref'),
                'preservation_refs':tuple(request.data.get('preservation_refs',())),
                'protection_constraints':constraints,'prospective_only':True,
                'route_computed':False,'reachable_domain_exhausted':False,
                'successor_operation_ref':'mechanics.guarded_transport.external_primitive',
                'successor_mode':'STEP'})
            route_preconditions=(
                FrozenMap({**common,'phase_ref':'before_deposit','initial_state':before,
                    'initial_state_key':stable_digest((request.model_ref,before)),
                    'required_carrier_pose_domain':(tuple(pose),),
                    'assumed_endpoint_state':FrozenMap(moved),
                    'required_carried_refs':before['carried_refs'],
                    'required_carrier_side':before['carrier_side']}),
                FrozenMap({**common,'phase_ref':'before_next_pickup','initial_state':after,
                    'initial_state_key':stable_digest((request.model_ref,after)),
                    'required_carrier_pose_domain':pickup,'next_object_ref':target,
                    'required_carrier_side':after['sides'][target],
                    'next_member_must_be_uncarried':target,
                    'maximum_carried_count':request.model['capacity']-1,
                    'required_capacity_available':True}))
            candidates.append(FrozenMap({'deposit_pose':tuple(pose),'after':after,
                'next_pickup_poses':pickup,'consumer_ref':request.data.get('consumer_ref'),
                'restoration_duty_refs':tuple(request.data.get('restoration_duty_refs',())),
                'route_preconditions':route_preconditions,
                'deposit_transition':FrozenMap({'before':FrozenMap(moved),'after':after,
                    'action_ref':request.data['deposit_action_ref'],'object_ref':request.data['object_ref'],
                    'events':events,'outcome':outcome,'prospective_only':True}),
                'assumption_state_fields':tuple(sorted(before))}))
    return MechanicalResultB(request=request,source_status='FOUND' if candidates else 'EMPTY_DECLARED_DOMAIN',values=FrozenMap({'candidates':tuple(candidates)}),examined_count=len(poses),domain_size=len(poses),domain_exhausted=True)


def route_domain(request: MechanicalRequestB):
    if not _model_complete(request.model) or 'primitive_domain' not in request.data or 'max_nodes' not in request.bounds or request.model_ref is None:
        return missing(request,'model.joint_transport_route')
    raw_primitives=request.data['primitive_domain'];costs=request.model.get('input_costs')
    if not isinstance(raw_primitives,(tuple,list)) or any(not isinstance(p,Mapping) for p in raw_primitives):
        return missing(request,'data.typed_primitive_domain')
    primitives=tuple(raw_primitives)
    if not isinstance(costs,Mapping):return missing(request,'model.actual_input_costs')
    absent=tuple('state.'+field for field in ('carrier_position','carrier_side','positions','sides','carried_refs') if field not in request.state)
    if absent:return missing(request,*absent)
    if len(primitives)>256:return missing(request,'data.bounded_primitive_domain')
    primitive_refs=tuple(p.get('primitive_ref') for p in primitives)
    if any(ref is None for ref in primitive_refs) or len(set(primitive_refs))!=len(primitive_refs):
        return missing(request,'data.identified_primitive_domain')
    for primitive in primitives:
        action=primitive.get('action_ref')
        if action not in request.model['actions']:return missing(request,'model.bound_domain_action')
        if action not in costs or type(costs[action]) is not int or costs[action]<0:
            return missing(request,'model.actual_cost_for_each_domain_action')
    unresolved=tuple(request.data.get('unresolved_dependencies',()))
    if not _supervision_complete(request.state,request.model):unresolved+=('state.current_supervision_domain',)
    # DOMAIN exposes a K09 input. It must not search, manufacture a path or
    # mistake enumeration of the primitive domain for reachable-state closure.
    descriptor=FrozenMap({'initial_state':request.state,'model_ref':request.model_ref,
        'immutable_transition_model':request.model,'initial_state_key':stable_digest((request.model_ref,request.state)),
        'state_dimensions':tuple(sorted(request.state)),'primitive_domain':primitives,'input_costs':costs,
        'route_bounds':request.bounds,'unresolved_dependencies':unresolved,
        'protection_constraints':FrozenMap({'directed_threats':request.model['directed_threats'],
            'protection_by_side':request.model['protection_by_side'],'checkpoint_order':request.model['checkpoint_order']}),
        'goal_contract':FrozenMap({key:request.model[key] for key in ('terminal_assignments','terminal_carrier_side','terminal_carried_refs') if key in request.model}),
        'preservation_refs':tuple(request.data.get('preservation_refs',())),
        'source_request':provider_request_payload(request),'successor_operation_ref':'mechanics.guarded_transport.external_primitive',
        'successor_mode':'STEP','requested_search_operation_ref':'mechanics.bounded_route_search',
        'search_execution_pending':True})
    return found(request,search_ready_descriptor=descriptor,search_execution_pending=True,
        unresolved_dependencies=unresolved,route_computed=False,reachable_domain_exhausted=False)


def return_necessity(request: MechanicalRequestB):
    caller_request=request.data.get('return_caller_request',request)
    required=('unrestricted_request','restricted_request','unrestricted_result','restricted_result','restriction_ref','removed_primitive_refs')
    absent=tuple('data.'+key for key in required if key not in request.data)
    if absent:return missing(caller_request,*absent)
    unrestricted=MechanicalRequestB.model_validate(request.data['unrestricted_request'])
    restricted=MechanicalRequestB.model_validate(request.data['restricted_request'])
    unrestricted_result=MechanicalResultB.model_validate(request.data['unrestricted_result'])
    restricted_result=MechanicalResultB.model_validate(request.data['restricted_result'])
    if unrestricted_result.request != unrestricted or restricted_result.request != restricted:
        return MechanicalResultB(request=caller_request,source_status='MODEL_CONTRADICTION',cause='SIGNATURE_MISMATCH')
    same_domain=(unrestricted.state==restricted.state and unrestricted.model==restricted.model
                 and unrestricted.model_ref==restricted.model_ref
                 and unrestricted.operation_ref==restricted.operation_ref=='mechanics.guarded_transport.route_domain'
                 and unrestricted.mode==restricted.mode=='DOMAIN'
                 and unrestricted.request_ref!=restricted.request_ref
                 and unrestricted.bounds==restricted.bounds and unrestricted.epoch==restricted.epoch==request.epoch
                 and unrestricted.input_revision_ref==restricted.input_revision_ref==request.input_revision_ref
                 and unrestricted.requested_domain_ref==restricted.requested_domain_ref
                 and unrestricted.caller_ref==restricted.caller_ref
                 and unrestricted.parent_contribution_ref==restricted.parent_contribution_ref==request.parent_contribution_ref
                 and unrestricted.event_owner_ref==restricted.event_owner_ref
                 and unrestricted.expected_return_type==restricted.expected_return_type=='MechanicalResultB'
                 and unrestricted.observations==restricted.observations
                 and unrestricted.evidence_refs==restricted.evidence_refs
                 and unrestricted.model_alternatives==restricted.model_alternatives
                 and unrestricted.schema_version==restricted.schema_version
                 and FrozenMap({k:unrestricted.data[k] for k in sorted(unrestricted.data) if k!='primitive_domain'})==
                     FrozenMap({k:restricted.data[k] for k in sorted(restricted.data) if k!='primitive_domain'}))
    base_domain=tuple(unrestricted.data.get('primitive_domain',()))
    reduced_domain=tuple(restricted.data.get('primitive_domain',()))
    removed=tuple(request.data['removed_primitive_refs'])
    primitive_refs=tuple(item.get('primitive_ref') for item in base_domain)
    if any(ref is None for ref in primitive_refs):
        return missing(caller_request,'data.identified_audit_primitive_domain')
    subset=(bool(removed) and len(set(primitive_refs))==len(primitive_refs)
            and all(ref in primitive_refs for ref in removed)
            and reduced_domain==tuple(item for item in base_domain if item['primitive_ref'] not in removed))
    if not same_domain or not subset:
        return MechanicalResultB(request=caller_request,source_status='MODEL_CONTRADICTION',cause='DOMAIN_IDENTITY_MISMATCH')
    if 'search_return' in unrestricted_result.values or 'search_return' in restricted_result.values:
        from .guarded_search_bridge_b import compare_guarded_search_returns
        caller_request=caller_request if isinstance(caller_request,MechanicalRequestB) else MechanicalRequestB.model_validate(caller_request)
        return compare_guarded_search_returns(caller_request,unrestricted,restricted,unrestricted_result,restricted_result)
    if 'search_ready_descriptor' in unrestricted_result.values or 'search_ready_descriptor' in restricted_result.values:
        return MechanicalResultB(request=caller_request,source_status='NEEDS_EVIDENCE',cause='MISSING_IMPLEMENTATION',
            values=FrozenMap({'separate_search_demands':(unrestricted_result.values,restricted_result.values),
                'same_declared_domain':True,'restriction_ref':request.data['restriction_ref'],
                'removed_primitive_refs':removed,'audit_only':True,'conditional_necessity':None,
                'unresolved':True,'descriptors_are_not_witnesses':True}),
            missing_refs=('implementation.separate_K09_dispatch_and_witness_closure',))
    # Old family-local paths are not K09 witness/closure certificates. The
    # qualified C result contract must be bound before any necessity is claimed.
    return MechanicalResultB(request=caller_request,source_status='NEEDS_EVIDENCE',cause='MISSING_IMPLEMENTATION',
        values=FrozenMap({'restriction_ref':request.data['restriction_ref'],'same_declared_domain':True,
            'conditional_necessity':None,'restriction_not_necessary':None,'unresolved':True,
            'audit_only':True,'legacy_paths_are_not_K09_certificates':True,
            'unrestricted_return':provider_result_payload(unrestricted_result),'restricted_return':provider_result_payload(restricted_result)}),
        missing_refs=('implementation.qualified_K09_witness_closure_contract',))


def scene_layers(request: MechanicalRequestB):
    masks=request.data.get('entity_masks')
    if masks is None:return missing(request,'evidence.current_multiscale_entity_masks')
    rows=[]
    for ref in sorted(masks):
        points=tuple(tuple(p) for p in masks[ref])
        if not points:continue
        if len(points)>4096:raise ValueError('mask exceeds explicit bounded scene support')
        rs=tuple(p[0] for p in points);cs=tuple(p[1] for p in points)
        top,left,bottom,right=min(rs),min(cs),max(rs),max(cs)
        rows.append(FrozenMap({'entity_ref':ref,'mask':points,'bbox':(top,left,bottom,right),'height':bottom-top+1,'width':right-left+1,
            'relative_support':tuple(sorted((r-top,c-left) for r,c in points))}))
    return found(request,mask_rows=tuple(rows),unresolved_groupings=tuple(request.data.get('unresolved_groupings',())),
                 declared_layer_candidates=tuple(request.data.get('layer_candidates',())),motion_quantum_inferred=False,
                 layer_supports=FrozenMap({layer:tuple(row for row in rows if row['entity_ref'] in request.data['layer_bindings'][layer])
                    for layer in sorted(request.data.get('layer_bindings',{}))}),
                 unknown_layer_refs=tuple(layer for layer in request.data.get('required_layer_refs',()) if layer not in request.data.get('layer_bindings',{})))


def sealed_transport_compare(request: MechanicalRequestB):
    from agents.yf_arc3_v5.capabilities.sealed_mechanical_compare_b import compare_sealed
    return compare_sealed(request, external_primitive,
                          ('carrier_position', 'carrier_side', 'positions', 'sides', 'carried_refs'),
                          ('events', 'source_outcome', 'primitive_count'))
