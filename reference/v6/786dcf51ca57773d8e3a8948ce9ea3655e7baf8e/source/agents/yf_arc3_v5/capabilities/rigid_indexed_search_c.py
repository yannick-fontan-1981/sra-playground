"""Indexed closed rigid configuration mathematics, with exact native D replay.

SRC chooses this bounded calculation; DRM qualifies the supported model. The
caller supplies every body, domain, goal, command and resource constraint. No
world goal, role, environment action, WHY or permit is created here.
"""
from __future__ import annotations
from heapq import heappop,heappush
from itertools import count
from time import perf_counter
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,stable_digest
from .rigid_rearrangement_c import RigidRearrangementPreparationC
from .mechanical_common_contracts_c import SearchResultC,SearchWitnessC
from .rigid_edit_search_transport_c import bind_rigid_search_step,project_rigid_step_math
from .rigid_edit_primitive_d import measure_rigid_edit_primitive_d
from .mechanical_profile_d import measure_d_native_profile
from .mechanical_transport_c import packet_payload

class RigidIndexedSearchInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_indexed_search_input_c.v1'
    measured: RigidRearrangementPreparationC
    route_witness_policy_ref: Literal['FIRST_SHORTEST']
    evidence_refs: tuple[Ref, ...] = Field(min_length=1,max_length=128)
    maximum_states: int = Field(ge=1,le=65536)
    maximum_candidates: int = Field(ge=1,le=65536)
    time_bound_ms: int = Field(ge=1,le=60000)

class RigidIndexedSearchPreparationC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_indexed_search_preparation_c.v1'
    request: RigidIndexedSearchInputC
    supported: bool
    facts: FrozenMap

class RigidIndexedSearchResultC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_indexed_search_result_c.v1'
    result: SearchResultC
    found: bool
    facts: FrozenMap

def prepare_rigid_indexed_search(value: RigidIndexedSearchInputC) -> RigidIndexedSearchPreparationC:
    measured=value.measured; model=measured.request.template.profile.native_request
    directions=tuple(d.vector for d in measured.request.directions)
    supported=(not measured.missing_refs and measured.driver is not None
        and value.evidence_refs==measured.request.template.packet_contract.cost_dominance_premise_refs
        and not measured.request.preservation_predicates and not model.checkpoints
        and not model.collision_exclusion_pairs and not model.restore_origins
        and model.click_selection_precedes_placement and model.click_focused_body_rule=='SELECT_ONLY'
        and model.quantizer_pitch==(1,1) and model.quantizer_offset==(0,0)
        and model.quantizer_rule=='EXACT' and model.admission_kind in ('FINAL_ONLY','SWEPT_UNIT')
        and model.submitted_cost==1 and model.accepted_edit_cost==model.refused_cost==0
        and all(abs(x)+abs(y)==1 and (x,y) in model.unit_translation_vectors for x,y in directions)
        and all(b.parent_ref is None and b.solid_offsets and b.hit_offsets
            and set(b.hit_offsets)<=set(b.solid_offsets)
            and b.body_ref in measured.request.selection_hit_offsets
            and tuple(measured.request.selection_hit_offsets[b.body_ref]) in b.hit_offsets
            for b in model.bodies)
        and sum(len(b.admitted_solid_cells)*len(b.solid_offsets) for b in model.bodies)
            <= measured.request.maximum_geometry_checks)
    return RigidIndexedSearchPreparationC(request=value,supported=supported,
        facts=FrozenMap({'indexed_model_supported':supported,'body_count':len(model.bodies)}))

def _enumerate_indexed_candidate(request, *, max_states, max_candidates, time_bound_ms):
    start=perf_counter(); model=request.template.profile.native_request
    supported=(not request.preservation_predicates and not model.checkpoints
        and not model.collision_exclusion_pairs and not model.restore_origins
        and model.click_selection_precedes_placement and model.click_focused_body_rule=='SELECT_ONLY'
        and model.quantizer_pitch==(1,1) and model.quantizer_offset==(0,0)
        and model.quantizer_rule=='EXACT' and model.admission_kind in ('FINAL_ONLY','SWEPT_UNIT')
        and model.submitted_cost==1 and model.accepted_edit_cost==model.refused_cost==0
        and all(abs(x)+abs(y)==1 for x,y in tuple(d.vector for d in request.directions))
        and all(b.parent_ref is None and b.solid_offsets and b.hit_offsets
            and set(b.hit_offsets)<=set(b.solid_offsets) for b in model.bodies))
    if not supported:return {'status':'UNSUPPORTED_MODEL','ACT_count':0}
    bodies=model.bodies; refs=tuple(b.body_ref for b in bodies); target=refs.index(request.beneficiary_ref)
    domain=sorted(set(c for b in bodies for c in b.admitted_solid_cells)); bits={p:1<<i for i,p in enumerate(domain)}
    origins=[]; masks=[]; origin_indices=[]; neighbours=[]
    for b in bodies:
        admitted=set(b.admitted_solid_cells); ox,oy=b.solid_offsets[0]; rows=[]
        for x,y in sorted(admitted):
            origin=(x-ox,y-oy); cells=tuple((origin[0]+dx,origin[1]+dy) for dx,dy in b.solid_offsets)
            if all(c in admitted for c in cells):rows.append((origin,sum(bits[c] for c in sorted(set(cells)))))
        rows.sort(); ps=tuple(p for p,_ in rows); ms=tuple(m for _,m in rows); indices={p:i for i,p in enumerate(ps)}
        if b.origin not in indices:return {'status':'INVALID_INITIAL_MODEL','ACT_count':0}
        origins.append(ps);masks.append(ms);origin_indices.append(indices)
        neighbours.append(tuple(tuple(indices.get((p[0]+dx,p[1]+dy)) for dx,dy in tuple(d.vector for d in request.directions)) for p in ps))
    initial=tuple(origin_indices[i][b.origin] for i,b in enumerate(bodies))
    initial_masks=tuple(masks[i][p] for i,p in enumerate(initial));occupied=0
    for mask in initial_masks:
        if mask & occupied:return {'status':'OVERLAPPING_INITIAL_MODEL','ACT_count':0}
        occupied|=mask
    focus=refs.index(model.native_focus_ref) if model.native_focus_ref is not None else -1
    start_state=initial+(focus,);destinations=tuple(sorted(set(request.destination_origins)))
    remaining=min(request.remaining_primitive_reserve,request.query_identity.actual_bounds['max_primitives'],request.query_identity.actual_bounds['max_depth'])
    def lower_bound(state):
        x,y=origins[target][state[target]]
        distance=min(abs(x-a)+abs(y-b) for a,b in destinations)
        return distance+(distance>0 and state[-1]!=target)
    queue=[];serial=count();heappush(queue,(lower_bound(start_state),0,next(serial),start_state))
    costs={start_state:0};parents={};expanded=edges=0;terminal=None;status='DOMAIN_EXHAUSTED'
    prep_ms=(perf_counter()-start)*1000; search_start=perf_counter()
    while queue:
        if expanded>=max_states or (perf_counter()-search_start)*1000>=time_bound_ms:
            status='BUDGET_REACHED';break
        _,cost,_,state=heappop(queue)
        if costs.get(state)!=cost:continue
        expanded+=1
        if origins[target][state[target]] in destinations:terminal=state;status='FOUND_CANDIDATE';break
        current_masks=tuple(masks[i][state[i]] for i in range(len(bodies))); occupied=0
        for mask in current_masks:occupied|=mask
        for i,b in enumerate(bodies):
            next_cost=cost+1+(state[-1]!=i)
            if next_cost>remaining:continue
            others=occupied^current_masks[i]
            for direction,j in enumerate(neighbours[i][state[i]]):
                if edges>=max_candidates:
                    return {'status':'BUDGET_REACHED','steps':(),'expanded_states':expanded,'candidate_edges':edges}
                edges+=1
                if j is None or masks[i][j]&others:continue
                changed=list(state);changed[i]=j;changed[-1]=i;child=tuple(changed)
                bound=lower_bound(child)
                if next_cost+bound>remaining or next_cost>=costs.get(child,remaining+1):continue
                if child not in costs and len(costs)>=max_states:
                    return {'status':'BUDGET_REACHED','steps':(),'expanded_states':expanded,'candidate_edges':edges,'retained_states':len(costs)}
                costs[child]=next_cost;parents[child]=(state,i,direction)
                heappush(queue,(next_cost+bound,next_cost,next(serial),child))
    search_ms=(perf_counter()-search_start)*1000; word=[]
    if terminal is not None:
        current=terminal;rev=[]
        while current!=start_state:
            previous,i,direction=parents[current];rev.append((previous,i,direction));current=previous
        for previous,i,direction in reversed(rev):
            if previous[-1]!=i:word.append({'action':'select','body_ref':refs[i]})
            word.append({'action':'move','body_ref':refs[i],'vector':tuple(d.vector for d in request.directions)[direction]})
    return {'status':status,'steps':tuple(word),'expanded_states':expanded,'retained_states':len(costs),'candidate_edges':edges,'preparation_ms':prep_ms,'search_ms':search_ms}

def calculate_rigid_indexed_search(value: RigidIndexedSearchPreparationC) -> RigidIndexedSearchResultC:
    checked=prepare_rigid_indexed_search(value.request)
    if not value.supported or checked!=value:raise ValueError('Indexed calculation requires its exact supported Source input')
    args=value.request; request=args.measured.request; driver=args.measured.driver
    query=driver.query
    # Bind the distinct Source-selected calculation bounds to the same current
    # question. This does not silently relax the legacy K09 STEP-ledger budget.
    identity=query.request.model_copy(update={'actual_bounds':FrozenMap.overlay({
        'max_states':args.maximum_states,'max_candidates':args.maximum_candidates},query.request.actual_bounds),
        'immutable_inputs':FrozenMap.overlay({'indexed_rigid_calculation':FrozenMap({
            'maximum_states':args.maximum_states,'maximum_candidates':args.maximum_candidates,
            'time_bound_ms':args.time_bound_ms,'input_digest':stable_digest(request),
            'algorithm_ref':'ASTAR_ADMISSIBLE_UNIT_TRANSLATION_DISTANCE'}),
            'route_witness_policy_ref':args.route_witness_policy_ref,
            'route_witness_evidence_digest':stable_digest(args.evidence_refs),
            'primitive_unit_cost_domain':True},query.request.immutable_inputs)})
    calculated=_enumerate_indexed_candidate(request,max_states=args.maximum_states,
        max_candidates=args.maximum_candidates,time_bound_ms=args.time_bound_ms)
    word=[];packets=[];native_nodes=0;current=request.template.profile.native_request
    contract=request.template.packet_contract;verify_started=perf_counter();missing=[]
    primitives=driver.primitives
    for number,step in enumerate(calculated.get('steps',())):
        if step['action']=='select':
            primitive=next(p for p in primitives if p.data.get('channel')=='CLICK' and p.data.get('body_ref')==step['body_ref'])
        else:
            if current.native_focus_ref!=step['body_ref']:raise ValueError('Indexed word lost selection')
            primitive=next(p for p in primitives if p.data.get('channel')=='TRANSLATE' and tuple(p.data['translation'])==tuple(step['vector']))
        state=FrozenMap({contract.poses_field:FrozenMap({b.body_ref:b.origin for b in current.bodies}),contract.focus_field:current.native_focus_ref})
        row=bind_rigid_search_step(request.template,child_ref=identity.request_ref+'.indexed.'+str(number),
            state=state,primitive=primitive,parent=identity,response_ref=request.deterministic_response_ref)
        profile=measure_d_native_profile(row.d_profile)
        if profile.missing_refs:missing.extend(profile.missing_refs);break
        native=measure_rigid_edit_primitive_d(row.d_profile.native_request)
        measured=project_rigid_step_math(row,native)
        native_nodes+=native.examined_count
        if measured.missing_refs or measured.packet is None:
            missing.extend(measured.missing_refs or ('indexed_missing_native_packet',));break
        packet=measured.packet;after=native.values['poses'];focus=native.values['native_focus_ref']
        body=next(b for b in current.bodies if b.body_ref==step['body_ref'])
        expected=body.origin if step['action']=='select' else tuple(body.origin[i]+step['vector'][i] for i in (0,1))
        if tuple(after[body.body_ref])!=expected or focus!=body.body_ref:
            missing.append('indexed_candidate_native_effect_mismatch');break
        word.append(primitive.primitive_ref);packets.append(packet)
        current=current.model_copy(update={'native_focus_ref':focus,
            'bodies':tuple(b.model_copy(update={'origin':tuple(after[b.body_ref])}) for b in current.bodies)})
    goal=next(b.origin for b in current.bodies if b.body_ref==request.beneficiary_ref) in request.destination_origins
    found=(calculated['status']=='FOUND_CANDIDATE' and not missing
        and len(word)==len(calculated.get('steps',())) and goal)
    facts=FrozenMap({'first_shortest_witness_settled':found,'complete':found,
        'indexed_model_supported':True,'indexed_native_goal_holds':goal,'indexed_native_packet_count':len(packets),
        'indexed_native_node_count':native_nodes,'indexed_preparation_ms':calculated.get('preparation_ms',0.0),
        'indexed_search_ms':calculated.get('search_ms',0.0),'indexed_native_replay_ms':(perf_counter()-verify_started)*1000,
        'indexed_expanded_state_count':calculated.get('expanded_states',0),
        'indexed_candidate_edge_count':calculated.get('candidate_edges',0),
        'indexed_retained_state_count':calculated.get('retained_states',0),
        'first_shortest_certificate_only':found,'named_domain_exhausted':False})
    result=SearchResultC(request=identity,witnesses=(SearchWitnessC(root_action_ref=primitives[[p.primitive_ref for p in primitives].index(word[0])].action_ref if word else None,
            word=tuple(word),cost=len(word),covered_response_refs=(request.deterministic_response_ref,)),) if found else (),
        current_prefix=tuple(word) if found else (),complete=found,bounded=calculated['status']=='BUDGET_REACHED',
        contradictory=False,examined_count=calculated.get('candidate_edges',0),declared_domain_size=None,
        missing_refs=tuple(dict.fromkeys(missing)) if missing else () if found else ('indexed_unsettled_candidate',),
        requested_steps=(),continuation=FrozenMap({'exact_step_packets':tuple(packet_payload(p) for p in packets),
            'indexed_calculation_status':calculated['status']}),facts=facts)
    return RigidIndexedSearchResultC(result=result,found=found,facts=facts)
