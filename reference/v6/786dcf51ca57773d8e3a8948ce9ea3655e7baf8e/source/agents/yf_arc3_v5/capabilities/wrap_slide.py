"""Command-local topology and joint slide state, separate from gravity K19.

Bounded topology, joint response, seat, phase, graph and transfer projections.
Patrol clock/capture ownership belongs to the unique K13 service. Compiled
Source connections do not attest solver use or cognitive memory transfer.
"""
from typing import Literal
from collections import deque
from heapq import heappop,heappush
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields,with_implementation_debt
from .patrol_body import PatrolState,PatrolClockModel,PatrolTickRequest,PatrolTarget,advance_patrol_tick,patrol_mask
from agents.yf_arc3_v5.logos.types import immutable_json_data
from .identity_contact_authentication import ContactPixel,ContactLayerTemplate,ContactLayerSample,_candidate_layers as translated_layers
from .inventory_gated_navigation import _identity_missing as primitive_identity_missing,_packet as primitive_packet
from .mechanical_request_contracts import MechanicalRequestIdentity
from .injective_matching import maximum_injective_matching
from .mutable_kit_survival import KitEventTrace as WrapEventTrace


class WrapCell(FrozenModel):
    x: int
    y: int
    terrain: Literal['SUPPORT','BLOCKED','UNKNOWN']
    paint_type_ref: Ref | None = None
    evidence_ref: Ref | None = None


class WrapMember(FrozenModel):
    member_ref: Ref
    type_ref: Ref
    x: int
    y: int
    offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=128)
    alive: bool
    @model_validator(mode='after')
    def whole_body(self):
        if len(set(self.offsets))!=len(self.offsets):raise ValueError('complete member mask has distinct occupied offsets')
        return self


class WrapSeat(FrozenModel):
    seat_ref: Ref
    interior_cells: tuple[tuple[int,int],...] = Field(min_length=1,max_length=128)
    backing_cells: tuple[tuple[int,int],...] = Field(min_length=1,max_length=128)
    mouth_vector: tuple[int,int]
    accepted_type_refs: tuple[Ref,...] = Field(max_length=128)
    evidence_ref: Ref | None = None


class WrapSeatTypeRelation(FrozenModel):
    seat_ref: Ref
    member_type_ref: Ref
    compatible: bool
    evidence_ref: Ref


class WrapTrail(FrozenModel):
    command_scope_ref: Ref
    member_ref: Ref
    visited_poses: tuple[tuple[int,int],...] = Field(max_length=4096)


class WrapState(FrozenModel):
    members: tuple[WrapMember,...] = Field(max_length=128)
    member_order: tuple[Ref,...] = Field(max_length=128)
    required_member_refs: tuple[Ref,...] = Field(max_length=128)
    cells: tuple[WrapCell,...] = Field(max_length=4096)
    seats: tuple[WrapSeat,...] = Field(max_length=128)
    trails: tuple[WrapTrail,...] = Field(default=(),max_length=128)
    patrol_event_state_ref: Ref | None = None
    patrol_state: PatrolState | None = None
    remaining_budget: int = Field(ge=0,le=65536)
    input_tick: int = Field(ge=0)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def identity(self):
        refs={m.member_ref for m in self.members}
        if len(refs)!=len(self.members) or len(set(self.member_order))!=len(self.member_order) or set(self.member_order)!=refs:raise ValueError('declared order contains each current member exactly once')
        if any(ref not in refs for ref in self.required_member_refs):raise ValueError('required population belongs to current members')
        if len({(c.x,c.y) for c in self.cells})!=len(self.cells):raise ValueError('one terrain alternative per logical cell')
        return self


class WrapSeatingView(FrozenModel):
    """Only the declared input slice used by injective seating EVALUATE."""
    members: tuple[WrapMember,...] = Field(max_length=128)
    required_member_refs: tuple[Ref,...] = Field(max_length=128)
    seats: tuple[WrapSeat,...] = Field(max_length=128)
    @model_validator(mode='after')
    def identities(self):
        refs = tuple(member.member_ref for member in self.members)
        if len(set(refs)) != len(refs) or len(set(self.required_member_refs)) != len(self.required_member_refs):
            raise ValueError('distinct current and requested seating members')
        if not set(self.required_member_refs) <= set(refs) or len({seat.seat_ref for seat in self.seats}) != len(self.seats):
            raise ValueError('requested population and distinct seats are explicitly bound')
        return self


class WrapTopology(FrozenModel):
    topology_ref: Ref
    minimum_x: int
    maximum_x: int
    minimum_y: int
    maximum_y: int
    horizontal: Literal['WRAP','BLOCK','UNKNOWN']
    vertical: Literal['WRAP','BLOCK','UNKNOWN']
    revisit_stop: Literal['BEFORE_REENTER_POSE','AFTER_REENTER_POSE','UNKNOWN']
    evidence_ref: Ref | None = None
    @model_validator(mode='after')
    def extent(self):
        if self.minimum_x>self.maximum_x or self.minimum_y>self.maximum_y:raise ValueError('ordered viewport-independent topology extent')
        return self


class WrapCommand(FrozenModel):
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    dx: int
    dy: int
    cost: int = Field(ge=0,le=65536)
    cost_evidence_ref: Ref | None = None
    kind: Literal['MOVE','RESET'] = 'MOVE'


class WrapModel(FrozenModel):
    model_ref: Ref
    topology: WrapTopology
    commands: tuple[WrapCommand,...] = Field(default=(),max_length=32)
    order_kind: Literal['ORDERED','SIMULTANEOUS','UNKNOWN'] = 'UNKNOWN'
    simultaneous_conflicts: Literal['ALL_BLOCK','UNKNOWN'] = 'UNKNOWN'
    simultaneous_peer_policy: Literal['BLOCK_PRE_ROUND','ALLOW_JOINT_VACATED','UNKNOWN'] = 'UNKNOWN'
    motion: Literal['STEP','SLIDE','UNKNOWN'] = 'UNKNOWN'
    paint_order: Literal['BEFORE_HAZARD','AFTER_HAZARD','UNKNOWN'] = 'UNKNOWN'
    patrol_clock_phase: Literal['PRE_INPUT','POST_INPUT','PER_CELL','NONE','UNKNOWN'] = 'UNKNOWN'
    patrol_clock_model: PatrolClockModel | None = None
    patrol_scope_evidence_ref: Ref | None = None
    boundary_body_rule: Literal['WRAP_ANCHOR','WRAP_EACH_CELL','UNKNOWN'] = 'UNKNOWN'
    input_legal_refs: tuple[Ref,...] = Field(default=(),max_length=32)
    phases: tuple[Literal['DEBIT','PRE_INPUT','DIRECT','POST_INPUT','ACCEPTANCE','EXHAUSTION'],...] = Field(default=(),max_length=6)
    slide_law_evidence_ref: Ref | None = None
    acceptance_evidence_ref: Ref | None = None
    failure: Literal['LOCAL_STOP','GAME_OVER','RESTORE_DECLARED','UNKNOWN'] = 'UNKNOWN'
    restore_state: WrapState | None = None
    restore_evidence_ref: Ref | None = None
    per_cell_clock_order: Literal['AFTER_CELL','UNKNOWN'] = 'UNKNOWN'
    patrol_owner_ref: Ref | None = None
    @model_validator(mode='after')
    def domain(self):
        if len({c.input_ref for c in self.commands})!=len(self.commands):raise ValueError('distinct current joint input mappings')
        if self.phases and (len(self.phases)!=6 or len(set(self.phases))!=6):raise ValueError('each complete primitive phase occurs once in declared order')
        return self


class WrapObservation(FrozenModel):
    observation_ref: Ref
    before: WrapState
    after: WrapState
    input_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    trace: WrapEventTrace | None = None


class WrapLayerTemplate(ContactLayerTemplate):
    component: Literal['MEMBER','SEAT_INTERIOR','SEAT_BACKING','PAINT','COMPOSITE_PATROL','DECORATION','UNKNOWN']
    grouping_candidate_ref: Ref | None = None
    type_candidate_ref: Ref | None = None


class WrapPreservation(FrozenModel):
    member_ref: Ref
    must_live: bool
    required_type_ref: Ref | None = None
    required_seat_ref: Ref | None = None
    scope: Literal['ALL_INTERMEDIATE','SETTLED']


class WrapRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.wrap_slide_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=256)
    state: WrapState | None = None
    seating_view: WrapSeatingView | None = None
    topology: WrapTopology | None = None
    commands: tuple[WrapCommand,...] = Field(default=(),max_length=32)
    command_scope_ref: Ref | None = None
    models: tuple[WrapModel,...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    input_ref: Ref | None = None
    observations: tuple[WrapObservation,...] = Field(default=(),max_length=256)
    expected_state: WrapState | None = None
    actual_state: WrapState | None = None
    expected_trace: WrapEventTrace | None = None
    actual_trace: WrapEventTrace | None = None
    retained_initial_states: tuple[WrapState,...] = Field(default=(),max_length=128)
    requested_word: tuple[Ref,...] = Field(default=(),max_length=256)
    future_consumer_ref: Ref | None = None
    kernel_ref: Ref = 'mechanics.coupled_member_control'
    step_identity: MechanicalRequestIdentity | None = None
    parent_identity: MechanicalRequestIdentity | None = None
    clock_ref: Ref | None = None
    temporal_scope_ref: Ref | None = None
    source_goal_acceptance_contract_ref: Ref | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[WrapLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    preimage_states: tuple[WrapState,...] = Field(default=(),max_length=4096)
    target_member_ref: Ref | None = None
    target_seat_ref: Ref | None = None
    seating_type_relations: tuple[WrapSeatTypeRelation,...] = Field(default=(),max_length=4096)
    seating_population_evidence_ref: Ref | None = None
    seating_relation_domain_complete: bool = False
    preserved_member_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    prior_state: WrapState | None = None
    prior_model: WrapModel | None = None
    preservation_constraints: tuple[WrapPreservation,...] = Field(default=(),max_length=128)
    @model_validator(mode='after')
    def alternatives(self):
        if self.seating_view is not None and (self.operation_ref != 'mechanics.typed_seating.injective_conjunction' or self.mode != 'EVALUATE'):
            raise ValueError('scoped seating view belongs only to injective seating EVALUATE')
        if self.seating_view is not None and self.state is not None:
            raise ValueError('bind one explicit full-state or seating-view input, not both')
        if len({m.model_ref for m in self.models})!=len(self.models):raise ValueError('distinct bound model alternatives')
        if len({t.template_ref for t in self.layer_templates})!=len(self.layer_templates):raise ValueError('distinct physical templates')
        return self


OPERATION_MODES={'mechanics.typed_seating.injective_conjunction':('EVALUATE',),
    'mechanics.wrap_slide.scene_measure':('MEASURE',),'mechanics.wrap_slide.clock_slide_fit':('FIT',),
    'mechanics.wrap_slide.seat_approach_preimages':('INVERSE_DOMAIN',),'mechanics.wrap_slide.ordered_joint_successor':('STEP',),
    'mechanics.wrap_slide.phase_safe_suffix':('PRECONDITION',),'mechanics.wrap_slide.joint_route_domain':('DOMAIN',),
    'mechanics.wrap_slide.sealed_slide_compare':('COMPARE',),'mechanics.wrap_slide.scoped_slide_transfer':('COMPARE',),
    'mechanics.wrap_slide.external_primitive':('STEP',),'mechanics.wrap_slide.topology_and_local_trails':('DOMAIN',)}


def _member(state,ref):return next((m for m in state.members if m.member_ref==ref),None)


def _point(topology,x,y):
    wrapped=[];blocked=False;missing=[]
    for axis,value,lo,hi,kind in (('x',x,topology.minimum_x,topology.maximum_x,topology.horizontal),('y',y,topology.minimum_y,topology.maximum_y,topology.vertical)):
        if lo<=value<=hi:continue
        if kind=='UNKNOWN':missing.append('current_'+axis+'_boundary_transition');continue
        if kind=='BLOCK':blocked=True;continue
        value=lo+(value-lo)%(hi-lo+1);wrapped.append(axis)
        if axis=='x':x=value
        else:y=value
    return (x,y),blocked,tuple(missing),tuple(wrapped)


def _mask(member,model):
    points=[];missing=[];blocked=False
    for dx,dy in member.offsets:
        x,y=member.x+dx,member.y+dy
        if model.boundary_body_rule=='WRAP_EACH_CELL':point,stop,debt,_=_point(model.topology,x,y);points.append(point);blocked|=stop;missing.extend(debt)
        elif model.boundary_body_rule=='WRAP_ANCHOR':points.append((x,y))
        else:missing.append('current_full_body_boundary_rule')
    return tuple(points),blocked,tuple(dict.fromkeys(missing))


def _work(state):
    return 3*len(state.cells)+4*sum(len(m.offsets) for m in state.members)+(0 if state.patrol_state is None else 4*sum(len(p.offsets) for p in state.patrol_state.patrols))


def _failure(state,model):
    if model.failure=='UNKNOWN':return state,('current_joint_failure_lifecycle',),False
    if model.failure=='RESTORE_DECLARED':
        if model.restore_state is None or model.restore_evidence_ref is None:return state,('declared_joint_restoration_contract',),False
        return model.restore_state,(),True
    return state.model_copy(update={'status':model.failure}),(),False


def _hazard(state,model,member):
    if state.patrol_state is None:return (),()
    mask,blocked,debt=_mask(member,model)
    if debt:return (),debt
    hostile={p for patrol in state.patrol_state.patrols for p in patrol_mask(patrol)}
    return tuple(sorted(set(mask)&hostile)),()


def _clock(state,model,request,command,event_suffix,maximum):
    if model.patrol_clock_phase=='NONE':
        if model.patrol_scope_evidence_ref is None:return state,(),('current_no_patrol_clock_contract',),0,{}
        return state,(),(),0,{}
    if state.patrol_state is None or model.patrol_clock_model is None or model.patrol_owner_ref is None or model.patrol_scope_evidence_ref is None or request.clock_ref is None or request.temporal_scope_ref is None:return state,(),('current_owned_k13_patrol_clock_contract',),0,{}
    targets=[];work=sum(len(m.offsets) for m in state.members)
    if work>=maximum:return state,(),(),0,{'phase':'patrol_capture_target_projection'}
    for member in state.members:
        if not member.alive:continue
        cells,blocked,debt=_mask(member,model)
        if debt:return state,(),debt,work,{}
        targets.append(PatrolTarget(target_ref=member.member_ref,cells=cells))
    patrol=state.patrol_state.model_copy(update={'targets':tuple(targets)})
    scope=request.scope.model_copy(update={'request_ref':request.scope.request_ref+'.patrol.'+event_suffix,'event_owner_ref':model.patrol_owner_ref})
    tick=PatrolTickRequest(scope=scope,operation_ref='mechanics.patrol_body.pre_input_tick',mode='STEP_INTERNAL',maximum_evaluations=maximum-work,state=patrol,model=model.patrol_clock_model,
        input_ref=command.input_ref,event_ref=request.command_scope_ref+'.patrol.'+event_suffix,event_clock_tick=patrol.clock_tick,clock_ref=request.clock_ref,temporal_scope_ref=request.temporal_scope_ref)
    receipt=advance_patrol_tick(tick);work+=receipt.examined_count
    if receipt.prerequisite_refs or receipt.computation_bound_reached:return state,({'kind':'K13_INCOMPLETE','receipt':receipt},),receipt.prerequisite_refs,work,receipt.frontier
    after=receipt.values['after_state'];after=after if isinstance(after,PatrolState) else PatrolState.model_validate(after)
    current=state.model_copy(update={'patrol_state':after,'patrol_event_state_ref':tick.event_ref})
    captured=tuple(receipt.values.get('captured_target_refs',()))
    if captured:current=current.model_copy(update={'members':tuple(m.model_copy(update={'alive':False}) if m.member_ref in captured else m for m in current.members)})
    events=[{'kind':'OWNED_K13_PATROL_EVENT','event_ref':tick.event_ref,'receipt':receipt,'captured_refs':captured}]
    if any(ref in captured for ref in current.required_member_refs):
        current,debt,restored=_failure(current,model);events.append({'kind':'REQUIRED_CAPTURE_LIFECYCLE','restoration':restored,'after':current});return current,tuple(events),debt,work,{}
    return current,tuple(events),(),work,{}


def _proposal(state,model,member,command,peers):
    target,boundary_blocked,debt,wrapped=_point(model.topology,member.x+command.dx,member.y+command.dy)
    if debt:return member,(),debt
    if boundary_blocked:return member,({'kind':'BOUNDARY_STOP','member_ref':member.member_ref},),()
    changed=member.model_copy(update={'x':target[0],'y':target[1]});mask,body_blocked,debt=_mask(changed,model)
    if debt:return member,(),debt
    terrain={(c.x,c.y):c for c in state.cells};backing={p for seat in state.seats if seat.evidence_ref is not None for p in seat.backing_cells};blocked=[];unknown=[]
    for point in mask:
        cell=terrain.get(point)
        if body_blocked or point in peers or point in backing or cell is not None and cell.terrain=='BLOCKED':blocked.append(point)
        elif cell is None or cell.terrain=='UNKNOWN' or cell.evidence_ref is None:unknown.append(point)
    if blocked:return member,({'kind':'PROVISIONAL_SUPPORT_OR_PEER_STOP','member_ref':member.member_ref,'blocked_mask':tuple(blocked),'permanent_latch':False},),()
    if unknown:return member,({'kind':'UNKNOWN_SLIDE_SUPPORT','member_ref':member.member_ref,'unknown_cells':tuple(unknown)},),('current_complete_slide_support',)
    types={terrain[p].paint_type_ref for p in mask if terrain[p].paint_type_ref is not None}
    if len(types)>1:return member,(),('current_overlapping_paint_priority',)
    painted=changed.model_copy(update={'type_ref':next(iter(types))}) if types else changed
    hazards,debt=_hazard(state,model,changed)
    if debt:return member,(),debt
    if model.paint_order=='UNKNOWN' and (types or hazards):return member,(),('current_paint_hazard_order',)
    after=painted if model.paint_order=='BEFORE_HAZARD' else changed
    if hazards:after=after.model_copy(update={'alive':False})
    elif model.paint_order=='AFTER_HAZARD':after=painted
    return after,({'kind':'MEMBER_CELL_MOVE','member_ref':member.member_ref,'before':(member.x,member.y),'after':target,'wrapped_axes':wrapped,'whole_mask':mask,'paint_type_refs':tuple(sorted(types)),'hazard_cells':hazards},),()


def _slide(state,model,request,command,maximum,allow_hypothetical=False):
    if model.order_kind=='UNKNOWN' or model.motion=='UNKNOWN' or model.topology.revisit_stop=='UNKNOWN' or model.slide_law_evidence_ref is None and not allow_hypothetical:return state,(),('current_joint_order_slide_and_revisit_laws',),0,{}
    if model.order_kind=='SIMULTANEOUS' and model.simultaneous_peer_policy=='UNKNOWN':return state,(),('current_simultaneous_vacancy_policy',),0,{}
    current=state;paths={m.member_ref:[(m.x,m.y)] for m in state.members};terminated=set();events=[];count=0
    for round_index in range(request.maximum_depth+1):
        if round_index>=request.maximum_depth:return current,tuple(events),(),count,{'phase':'ordered_slide_rounds','next_round_index':round_index,'paths':paths,'after_prefix_state':current}
        moved=False;round_before=current;proposals=[]
        for ref in state.member_order:
            member=_member(current,ref)
            if member is None or not member.alive or ref in terminated:continue
            work=_work(current)
            if count+work>maximum:return current,tuple(events),(),count,{'phase':'joint_member_moves','round_index':round_index,'next_member_ref':ref,'paths':paths}
            count+=work;basis=current if model.order_kind=='ORDERED' else round_before;peers=set()
            for peer in basis.members:
                if peer.member_ref==ref or not peer.alive:continue
                mask,blocked,debt=_mask(peer,model)
                if debt:return current,tuple(events),debt,count,{}
                peers.update(mask)
            if model.order_kind=='SIMULTANEOUS' and model.simultaneous_peer_policy=='ALLOW_JOINT_VACATED':peers=set()
            after,trace,debt=_proposal(basis,model,member,command,peers)
            if debt:return current,tuple(events)+trace,debt,count,{}
            pose=(after.x,after.y);changed=pose!=(member.x,member.y)
            revisited=changed and pose in paths[ref]
            if revisited and model.topology.revisit_stop=='BEFORE_REENTER_POSE':terminated.add(ref);events.append({'kind':'COMMAND_LOCAL_REVISIT_STOP','member_ref':ref,'command_scope_ref':request.command_scope_ref,'before_reentry':True});continue
            if model.order_kind=='SIMULTANEOUS':proposals.append((member,after,trace,revisited));continue
            if changed:
                moved=True;paths[ref].append(pose);current=current.model_copy(update={'members':tuple(after if m.member_ref==ref else m for m in current.members)});events.extend(trace);events.append({'kind':'ORDERED_MOVE_SNAPSHOT','after_state':current})
                if revisited:terminated.add(ref)
                if model.patrol_clock_phase=='PER_CELL':
                    if model.per_cell_clock_order!='AFTER_CELL' or model.patrol_clock_model is None or model.patrol_clock_model.time_base!='SIMULATION_TICK':return current,tuple(events),('current_per_cell_simulation_clock_order',),count,{}
                    current,clock_events,debt,work,cut=_clock(current,model,request,command,'cell.'+str(round_index)+'.'+ref,maximum-count);count+=work;events.extend(clock_events)
                    if debt or cut:return current,tuple(events),debt,count,cut
            else:events.extend(trace)
            if not after.alive and ref in current.required_member_refs:
                current,debt,restored=_failure(current,model);events.append({'kind':'REQUIRED_SLIDE_FAILURE','member_ref':ref,'restoration':restored});return current,tuple(events),debt,count,{}
            if current.status!='ACTIVE':return current,tuple(events),(),count,{}
        if model.order_kind=='SIMULTANEOUS':
            if model.simultaneous_conflicts=='UNKNOWN':return current,tuple(events),('current_simultaneous_conflict_contract',),count,{}
            masks={after.member_ref:set(_mask(after,model)[0]) for before,after,trace,revisited in proposals if (before.x,before.y)!=(after.x,after.y)}
            conflicts={ref for ref in masks if any(ref!=other and masks[ref]&masks[other] for other in masks)}
            if model.simultaneous_peer_policy=='ALLOW_JOINT_VACATED':
                movers=set(masks)-conflicts;original_masks={m.member_ref:set(_mask(m,model)[0]) for m in round_before.members if m.alive}
                while True:
                    work=len(original_masks)*len(movers)
                    if count+work>maximum:return current,tuple(events),(),count,{'phase':'simultaneous_vacancy_closure','round_index':round_index,'candidate_movers':tuple(sorted(movers))}
                    count+=work;blocked={ref for ref in movers if any(ref!=other and other not in movers and masks[ref]&original_masks[other] for other in sorted(original_masks))}
                    if not blocked:break
                    movers-=blocked;conflicts|=blocked
            if model.patrol_clock_phase=='PER_CELL':return current,tuple(events),('simultaneous_cell_clock_event_order',),count,{}
            for before,after,trace,revisited in proposals:
                if after.member_ref in conflicts:events.append({'kind':'SIMULTANEOUS_DESTINATION_CONFLICT','member_ref':after.member_ref});continue
                if (before.x,before.y)!=(after.x,after.y):moved=True;paths[after.member_ref].append((after.x,after.y))
                current=current.model_copy(update={'members':tuple(after if m.member_ref==after.member_ref else m for m in current.members)});events.extend(trace)
                if revisited:terminated.add(after.member_ref)
                if not after.alive and after.member_ref in current.required_member_refs:
                    current,debt,restored=_failure(current,model);events.append({'kind':'REQUIRED_SLIDE_FAILURE','member_ref':after.member_ref,'restoration':restored});return current,tuple(events),debt,count,{}
        events.append({'kind':'ROUND_SNAPSHOT','round_index':round_index,'after_state':current})
        if model.motion=='STEP' or not moved:break
    trails=tuple(WrapTrail(command_scope_ref=request.command_scope_ref,member_ref=ref,visited_poses=tuple(paths[ref])) for ref in state.member_order)
    current=current.model_copy(update={'trails':trails});events.append({'kind':'JOINT_SLIDE_SETTLED','paths':paths,'after':current,'peer_stops_reconsidered_each_round':True})
    return current,tuple(events),(),count,{}


def _injective_seating(request):
    state = request.seating_view if request.seating_view is not None else request.state
    models = {m.model_ref:m for m in request.models}
    model = models.get(request.bound_model_ref)
    if not request.scope.input_domain_complete:
        return family_result(request, prerequisite_refs=('current_complete_seating_input_domain',), domain_complete=False)
    if state is None or model is None:
        return family_result(request, prerequisite_refs=('current_seating_state_and_bound_model',), domain_complete=False)
    if (len(models)!=len(request.models) or len(set(state.required_member_refs))!=len(state.required_member_refs)
            or len({seat.seat_ref for seat in state.seats})!=len(state.seats)):
        return family_result(request, prerequisite_refs=('distinct_current_model_population_and_seat_identities',), domain_complete=False)
    if not request.seating_population_evidence_ref or not request.seating_relation_domain_complete:
        return family_result(request, prerequisite_refs=('requested_cursor_population_and_complete_seat_type_relations',), domain_complete=False)
    relations = {(r.seat_ref,r.member_type_ref):r for r in request.seating_type_relations}
    if len(relations)!=len(request.seating_type_relations):
        return family_result(request, prerequisite_refs=('distinct_seat_type_relation_evidence',), domain_complete=False)
    count, groups, missing, geometric_rows = 0, [], [], []
    def charge(amount):
        nonlocal count
        if count+amount>request.maximum_evaluations:
            raise OverflowError('injective_assignment_edge_bound')
        count+=amount
    def visit(index,seat_ref):
        charge(1)
    try:
        for ref in state.required_member_refs:
            member = _member(state,ref)
            if member is None:
                missing.append('requested_current_member.'+ref); continue
            charge(len(member.offsets))
            mask,blocked,debt = _mask(member,model)
            missing.extend(debt)
            compatible = []
            for seat in state.seats:
                charge(1+len(mask)+len(seat.interior_cells))
                relation = relations.get((seat.seat_ref,member.type_ref))
                if seat.evidence_ref is None or relation is None or not relation.evidence_ref:
                    missing.append('current_seat_type_relation.'+seat.seat_ref+'.'+member.type_ref); continue
                contained = set(mask).issubset(set(seat.interior_cells))
                geometric_rows.append({'member_ref':ref,'seat_ref':seat.seat_ref,'body_contained':contained,
                    'supplied_type_compatible':relation.compatible,'relation_evidence_ref':relation.evidence_ref})
                if member.alive and not blocked and not debt and contained and relation.compatible:
                    compatible.append(seat.seat_ref)
            groups.append((ref,tuple(compatible)))
        if missing:
            return family_result(request,values={'compatibility_edge_measurements':tuple(geometric_rows)},
                prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,domain_complete=False)
        matching,unfilled = maximum_injective_matching(tuple(domain for _,domain in groups),visit)
        witness = tuple((groups[index][0],seat_ref) for index,seat_ref in matching)
        return family_result(request,values={'compatibility_edge_measurements':tuple(geometric_rows),
            'requested_member_refs':state.required_member_refs,'injective_assignment':witness,
            'unfilled_member_refs_in_maximum_matching':tuple(groups[index][0] for index in unfilled),
            'minimum_unfilled_member_count':len(unfilled),'requested_population_injectively_seated':not unfilled,
            'all_seats_requested':False,'absorbing_seat_law_inferred':False,'action_release_authorized':False},
            examined_count=count,domain_complete=True)
    except OverflowError:
        return family_result(request,values={'compatibility_edge_measurements':tuple(geometric_rows)},
            examined_count=count,domain_complete=False,computation_bound_reached=True,
            frontier={'phase':'injective_assignment','resume_strategy':'restart_exact_matching_from_unchanged_inputs'})


def _acceptance(state,model,maximum,allow_hypothetical=False):
    work=sum(len(m.offsets)*len(state.seats) for m in state.members)+sum(len(s.interior_cells) for s in state.seats)
    if work>maximum:return False,(),(),0,{'phase':'typed_seat_occupancy'}
    if model.acceptance_evidence_ref is None and not allow_hypothetical:return False,(),('current_quantified_typed_seat_acceptance_contract',),work,{}
    groups=[]
    for ref in state.required_member_refs:
        member=_member(state,ref)
        if member is None or not member.alive:return False,(),(),work,{}
        mask,blocked,debt=_mask(member,model)
        if debt:return False,(),debt,work,{}
        matches=tuple(s.seat_ref for s in state.seats if s.evidence_ref is not None and member.type_ref in s.accepted_type_refs and set(mask).issubset(set(s.interior_cells)))
        groups.append((ref,matches))
    assignments=[()]
    for ref,seats in groups:
        expanded=[]
        for word in assignments:
            for seat in seats:
                if work>=maximum:return False,(),(),work,{'phase':'distinct_seat_assignments','next_member_ref':ref,'partial_assignments':tuple(expanded)}
                work+=1
                if seat not in {r[1] for r in word}:expanded.append(word+((ref,seat),))
        assignments=expanded
    return bool(assignments),tuple(assignments),(),work,{}


def _external(state,model,request,command,maximum,allow_hypothetical=False):
    if state.status!='ACTIVE' or command.input_ref not in model.input_legal_refs:return state,(),(),('current_legal_joint_input',),0,{},0
    if not model.phases or request.command_scope_ref is None:return state,(),(),('complete_joint_primitive_phase_scope',),0,{},0
    if command.cost_evidence_ref is None and not allow_hypothetical:return state,(),(),('current_joint_primitive_cost',),0,{},0
    if command.kind=='RESET' and model.phases.index('DEBIT')>model.phases.index('DIRECT'):return state,(),(),('reset_cost_owned_before_restoration',),0,{},0
    current=state;events=[];states=[];count=0;cost=0;debt=();cut={}
    for phase_index,phase in enumerate(model.phases):
        if count>=maximum:cut={'phase':'joint_primitive','next_phase_index':phase_index};break
        count+=1;before=current;detail={}
        if phase=='DEBIT':
            if command.cost>current.remaining_budget:debt=('funded_joint_input',);break
            current=current.model_copy(update={'remaining_budget':current.remaining_budget-command.cost});cost=command.cost;detail={'kind':'PRIMITIVE_DEBIT','cost':cost}
        elif phase=='PRE_INPUT' or phase=='POST_INPUT':
            if model.patrol_clock_phase=='UNKNOWN':debt=('current_patrol_input_clock_phase',)
            elif model.patrol_clock_phase==phase:
                current,trace,debt,work,cut=_clock(current,model,request,command,phase.lower(),maximum-count);count+=work;detail={'kind':'OWNED_PATROL_CLOCK','trace':trace,'restoration':any(e.get('restoration') for e in trace)}
            else:detail={'kind':'PHASE_HAS_NO_PATROL_EVENT','phase':phase}
        elif phase=='DIRECT':
            if command.kind=='RESET':
                if model.restore_state is None or model.restore_evidence_ref is None:debt=('declared_joint_reset_contract',)
                else:current=model.restore_state;detail={'kind':'DECLARED_RESET','restoration':True}
            else:
                current,trace,debt,work,cut=_slide(current,model,request,command,maximum-count,allow_hypothetical);count+=work;detail={'kind':'OWNED_JOINT_SLIDE','trace':trace,'restoration':any(e.get('restoration') for e in trace)}
        elif phase=='ACCEPTANCE':
            accepted,assignments,debt,work,cut=_acceptance(current,model,maximum-count,allow_hypothetical);count+=work
            if accepted:current=current.model_copy(update={'status':'WIN'})
            detail={'kind':'SETTLED_TYPED_SEAT_ACCEPTANCE','accepted':accepted,'distinct_assignments':assignments}
        else:
            if current.remaining_budget<=0:current,debt,restored=_failure(current,model);detail={'restoration':restored}
            detail={'kind':'EMPTY_BUDGET_CHECK',**detail}
        if phase_index==0 and not debt and not cut and not detail.get('restoration'):current=current.model_copy(update={'input_tick':state.input_tick+1})
        events.append(detail);states.append((phase,before,current))
        if debt or cut or detail.get('restoration') or current.status!='ACTIVE' or (current.level_scope_ref,current.restore_epoch)!=(state.level_scope_ref,state.restore_epoch):break
    return current,tuple(events),tuple(states),debt,count,cut,cost


def _topology_domain(request):
    topology=request.topology;state=request.state;rows=[];unknown=[];count=len(state.cells)+len(state.members);cut={}
    if count>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'topology_and_trail_input_domain'})
    terrain={(c.x,c.y):c for c in state.cells}
    if topology.evidence_ref is None:return family_result(request,prerequisite_refs=('current_boundary_topology_evidence',),domain_complete=False)
    for cell_index,cell in enumerate(state.cells):
        for command_index,command in enumerate(request.commands):
            if count>=request.maximum_evaluations:cut={'phase':'topological_successors','next_cell_index':cell_index,'next_command_index':command_index};break
            count+=1;x,y=cell.x+command.dx,cell.y+command.dy;wrapped=[];blocked=False;missing=[]
            for axis,value,lo,hi,kind in (('x',x,topology.minimum_x,topology.maximum_x,topology.horizontal),('y',y,topology.minimum_y,topology.maximum_y,topology.vertical)):
                if lo<=value<=hi:continue
                if kind=='UNKNOWN':missing.append('current_'+axis+'_boundary_transition');continue
                if kind=='BLOCK':blocked=True;continue
                value=lo+(value-lo)%(hi-lo+1);wrapped.append(axis)
                if axis=='x':x=value
                else:y=value
            if missing:unknown.append({'before':(cell.x,cell.y),'command_ref':command.input_ref,'missing_refs':tuple(missing)});continue
            destination=terrain.get((x,y));rows.append({'before':(cell.x,cell.y),'command':command,'after':(x,y),'wrapped_axes':tuple(wrapped),'boundary_blocked':blocked,
                'destination_terrain':None if destination is None else destination.terrain,'destination_unknown':destination is None or destination.terrain=='UNKNOWN','paint_type_ref':None if destination is None else destination.paint_type_ref})
        if cut:break
    trails=tuple(WrapTrail(command_scope_ref=request.command_scope_ref,member_ref=member.member_ref,visited_poses=((member.x,member.y),)) for member in state.members)
    return family_result(request,values={'topological_successors':rows,'initialized_command_local_trails':trails,'revisit_stop_rule':topology.revisit_stop,
        'previous_command_trails_reused':False,'local_revisit_is_permanent_obstacle':False,'unknown_boundary_branches':unknown},prerequisite_refs=('current_command_local_revisit_rule',) if topology.revisit_stop=='UNKNOWN' else (),
        examined_count=count,domain_complete=not unknown and not cut,computation_bound_reached=bool(cut),frontier=cut)


def _flat_events(events):
    for event in events:
        yield event
        for key in ('trace','events'):
            for nested in event.get(key,()):
                if hasattr(nested,'get'):yield from _flat_events((nested,))


def _physics_signature(state):
    patrols=None if state.patrol_state is None else (tuple((p.patrol_ref,p.x,p.y,p.offsets,p.marker_offsets,p.dx,p.dy,p.phase) for p in state.patrol_state.patrols),state.patrol_state.clock_tick)
    return (tuple((m.member_ref,m.type_ref,m.x,m.y,m.offsets,m.alive) for m in state.members),state.member_order,state.required_member_refs,
        tuple(sorted((c.x,c.y,c.terrain,c.paint_type_ref or '') for c in state.cells)),tuple((s.seat_ref,s.interior_cells,s.backing_cells,s.mouth_vector,s.accepted_type_refs) for s in state.seats),
        tuple((t.member_ref,t.visited_poses) for t in state.trails),patrols,state.remaining_budget,state.input_tick,state.level_scope_ref,state.restore_epoch,state.status)


def _preservation(state,model,constraints,settled):
    violations=[]
    for condition in constraints:
        if condition.scope=='SETTLED' and not settled:continue
        member=_member(state,condition.member_ref)
        if member is None or condition.must_live and not member.alive:violations.append((condition.member_ref,'required_live_member'));continue
        if condition.required_type_ref is not None and member.type_ref!=condition.required_type_ref:violations.append((condition.member_ref,'preserved_type'))
        if condition.required_seat_ref is not None:
            seat=next((s for s in state.seats if s.seat_ref==condition.required_seat_ref),None);mask,blocked,debt=_mask(member,model)
            if seat is None or debt or not set(mask).issubset(set(seat.interior_cells)):violations.append((condition.member_ref,'preserved_seat_occupancy'))
    return tuple(violations)


def _suffix(request,model):
    branches=[];count=0;cuts=[];common_length=len(request.requested_word)
    for state_index,initial in enumerate(request.retained_initial_states):
        current=initial;prefix=[];failure=None;debt=()
        protected=set(initial.required_member_refs)|{c.member_ref for c in request.preservation_constraints}
        for word_index,input_ref in enumerate(request.requested_word):
            command=next((c for c in model.commands if c.input_ref==input_ref),None)
            if command is None:debt=('current_named_suffix_command',);break
            word_request=request.model_copy(update={'state':current,'command_scope_ref':request.command_scope_ref+'.suffix.'+str(word_index)})
            after,events,phases,debt,work,cut,cost=_external(current,model,word_request,command,request.maximum_evaluations-count);count+=work
            if cut:cuts.append({'state_index':state_index,'word_index':word_index,**cut});break
            if debt:break
            for event in _flat_events(events):
                snapshot=event.get('after_state')
                if snapshot is not None:
                    if not isinstance(snapshot,WrapState):snapshot=WrapState.model_validate(snapshot)
                    violation=_preservation(snapshot,model,request.preservation_constraints,False)
                    if violation:failure={'word_index':word_index,'event':event,'violations':violation};break
                if event.get('hazard_cells') and event.get('member_ref') in protected or protected.intersection(event.get('captured_refs',())):failure={'word_index':word_index,'event':event,'violations':('all_intermediate_path_safety',)};break
            if failure:break
            violation=_preservation(after,model,request.preservation_constraints,True)
            if violation:failure={'word_index':word_index,'violations':violation};break
            prefix.append({'command':command,'events':events,'after_state':after,'primitive_cost':cost});current=after
            if current.status!='ACTIVE' or (current.level_scope_ref,current.restore_epoch)!=(initial.level_scope_ref,initial.restore_epoch):break
        common_length=min(common_length,len(prefix));branches.append({'initial_state':initial,'safe_prefix':prefix,'after_state':current,'first_dangerous_interval':failure,'missing_refs':debt})
        if count>=request.maximum_evaluations:break
    if len(branches)!=len(request.retained_initial_states):cuts.append({'phase':'unexamined_retained_phases','next_state_index':len(branches)})
    return family_result(request,values={'retained_phase_predictions':branches,'common_safe_input_prefix':request.requested_word[:common_length],'all_intermediate_path_safety_required':True,
        'every_retained_phase_examined':len(branches)==len(request.retained_initial_states),'future_consumer_ref':request.future_consumer_ref,'safe_endpoint_overrides_path_safety':False},
        examined_count=count,domain_complete=not cuts and not any(b['missing_refs'] for b in branches),computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _graph(request,model):
    def key(state):
        signature=_physics_signature(state)
        # Trails and event leases expire at this primitive boundary; future input
        # always initializes its own trails. Keep all world, type and clock data.
        return signature[:5]+signature[6:]
    nodes=[request.state];scripts=[()];depths=[0];seen={key(request.state):0};queue=deque([0]);edges=[];goals=[];cuts=[];boundaries=[];count=0
    while queue:
        index=queue.popleft();state=nodes[index]
        if state.status=='WIN':goals.append({'after_state':state,'external_word':scripts[index]});continue
        if state.status!='ACTIVE':continue
        if depths[index]>=request.maximum_depth:cuts.append({'node':index,'phase':'joint_word_depth'});continue
        for command_index,command in enumerate(model.commands):
            if command.kind=='RESET':continue
            edge_request=request.model_copy(update={'state':state,'command_scope_ref':request.command_scope_ref+'.edge.'+str(index)+'.'+command.input_ref})
            after,events,phase_states,debt,work,cut,cost=_external(state,model,edge_request,command,request.maximum_evaluations-count);count+=work
            if cut:cuts.append({'node':index,'next_command_index':command_index,**cut});queue.clear();break
            if debt:boundaries.append({'node':index,'command':command,'after_prefix_state':after,'events':events,'missing_refs':debt});continue
            if any(e.get('restoration') for e in events) or (after.level_scope_ref,after.restore_epoch)!=(state.level_scope_ref,state.restore_epoch):boundaries.append({'node':index,'reason':'qualify_new_joint_execution_scope'});continue
            child=seen.get(key(after));word={'command':command,'events':events,'phase_states':phase_states,'primitive_cost':cost}
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'node':index,'next_command_index':command_index,'phase':'joint_state_bound'});continue
                child=len(nodes);seen[key(after)]=child;nodes.append(after);scripts.append(scripts[index]+(word,));depths.append(depths[index]+1);queue.append(child)
            edges.append({'from_node':index,'to_node':child,**word})
    return family_result(request,values={'full_joint_clock_type_states':nodes,'owned_external_edges':edges,'typed_joint_witnesses':goals,'unknown_phase_or_world_branches':boundaries,
        'declared_domain_exhausted':not goals and not cuts and not boundaries,'returned_witness_budget_is_domain_bound':False,'minimum_cost_proved':False,'independent_k03_k09_edge_binding_required':True},
        examined_count=count,domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'pending_queue':tuple(queue)} if cuts else {})


def _preimages(request,model):
    rows=[];unknown=[];count=0;cuts=[];seat=next((s for s in request.state.seats if s.seat_ref==request.target_seat_ref),None)
    if seat is None:return family_result(request,prerequisite_refs=('current_requested_oriented_seat',),domain_complete=False)
    if seat.evidence_ref is None:return family_result(request,prerequisite_refs=('current_oriented_seat_geometry_and_type_evidence',),domain_complete=False)
    for state_index,state in enumerate(request.preimage_states):
        if state_index>=request.maximum_states:cuts.append({'phase':'approach_candidate_states','next_state_index':state_index});break
        for command in model.commands:
            if command.kind=='RESET':continue
            member=_member(state,request.target_member_ref)
            if member is None:continue
            word_request=request.model_copy(update={'state':state,'command_scope_ref':request.command_scope_ref+'.preimage.'+str(state_index)+'.'+command.input_ref})
            after,events,phase_states,debt,work,cut,cost=_external(state,model,word_request,command,request.maximum_evaluations-count);count+=work
            if cut:cuts.append({'state_index':state_index,**cut});break
            if debt:unknown.append({'candidate_state':state,'command':command,'missing_refs':debt});continue
            target=_member(after,request.target_member_ref)
            if target is None or not target.alive:continue
            mask,blocked,debt=_mask(target,model)
            if debt or not set(mask).issubset(set(seat.interior_cells)) or target.type_ref not in seat.accepted_type_refs:continue
            moves=tuple(e for e in _flat_events(events) if e.get('kind')=='MEMBER_CELL_MOVE' and e.get('member_ref')==request.target_member_ref)
            stop_against_backing=bool(set((x+command.dx,y+command.dy) for x,y in mask)&set(seat.backing_cells))
            entered_open_side=bool(moves) and (command.dx,command.dy)==tuple(-v for v in seat.mouth_vector)
            if not stop_against_backing or not entered_open_side:continue
            rows.append({'prepared_joint_state':state,'command':command,'after_state':after,'member_path':moves,'whole_mask':mask,'type_compatible':True,'enters_open_side':True,'stops_against_backing':True,
                'phase_and_type_prerequisites_retained':True,'primitive_cost':cost,'reachable_preparation_proved':False})
        if cuts:break
    return family_result(request,values={'oriented_seat_approach_preimages':rows,'unknown_phase_or_support_branches':unknown,'seat_coordinate_is_free_stop':False},
        examined_count=count,domain_complete=not cuts and not unknown,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _fit(request):
    supported=[];refuted=[];unknown=[];count=0;cuts=[]
    for model_index,model in enumerate(request.models):
        observations=[];bad=[];missing=[]
        for observation in request.observations:
            if not observation.sealed or observation.event_owner_ref!=request.scope.event_owner_ref or observation.epoch!=request.scope.epoch:missing.append((observation.observation_ref,'current_owned_command_packet'));continue
            command=next((c for c in model.commands if c.input_ref==observation.input_ref),None)
            if command is None:missing.append((observation.observation_ref,'observed_input_class'));continue
            word_request=request.model_copy(update={'state':observation.before,'command_scope_ref':observation.observation_ref+'.command'})
            after,events,phases,debt,work,cut,cost=_external(observation.before,model,word_request,command,request.maximum_evaluations-count,True);count+=work
            if cut:cuts.append({'model_index':model_index,'observation_ref':observation.observation_ref,**cut});break
            if debt:missing.append((observation.observation_ref,debt));continue
            trace=observation.trace
            if trace is not None and (not trace.sealed or trace.event_owner_ref!=request.scope.event_owner_ref or trace.epoch!=request.scope.epoch or trace.input_ref!=command.input_ref or trace.evidence_revision_ref!=request.scope.evidence_revision_ref or trace.model_revision_ref!=request.scope.model_revision_ref):missing.append((observation.observation_ref,'current_sealed_slide_trace'));continue
            if _physics_signature(after)!=_physics_signature(observation.after) or trace is not None and immutable_json_data(events)!=trace.events:bad.append(observation.observation_ref)
            else:observations.append({'observation_ref':observation.observation_ref,'events':events,'input_tick_delta':after.input_tick-observation.before.input_tick})
        if cuts:break
        if bad:refuted.append({'model_ref':model.model_ref,'first_recorded_falsifiers':bad})
        elif observations:supported.append({'model':model,'observations':observations,'unknown_observations':missing})
        else:unknown.append({'model_ref':model.model_ref,'missing_refs':missing or ('distinguishable_sealed_clock_slide_observation',)})
    return family_result(request,values={'conditional_clock_boundary_slide_models':supported,'rejected_models':refuted,'unknown_models':unknown,'animation_length_is_tick_count':False},
        examined_count=count,domain_complete=not cuts and not unknown and not any(row['unknown_observations'] for row in supported),computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _compare(request):
    a=request.expected_state;b=request.actual_state;expected=request.expected_trace;actual=request.actual_trace;count=_work(a)+_work(b);first=None;cut={}
    if count>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'sealed_full_joint_state_compare'})
    current=expected is not None and actual is not None and expected.sealed and actual.sealed and expected.event_owner_ref==actual.event_owner_ref==request.scope.event_owner_ref and expected.epoch==actual.epoch==request.scope.epoch and expected.input_ref==actual.input_ref and expected.evidence_revision_ref==actual.evidence_revision_ref==request.scope.evidence_revision_ref and expected.model_revision_ref==actual.model_revision_ref==request.scope.model_revision_ref
    same_scene=(a.level_scope_ref,a.restore_epoch)==(b.level_scope_ref,b.restore_epoch)
    if current and same_scene:
        for index in range(max(len(expected.events),len(actual.events))):
            if count>=request.maximum_evaluations:cut={'phase':'sealed_joint_events','next_event_index':index};break
            count+=1;x=expected.events[index] if index<len(expected.events) else None;y=actual.events[index] if index<len(actual.events) else None
            if x!=y:first={'event_index':index,'expected':x,'actual':y};break
    return family_result(request,values={'first_cursor_paint_patrol_phase_or_lifecycle_mismatch':first,'same_execution_scene':same_scene,'full_state_mismatch':_physics_signature(a)!=_physics_signature(b),'operational_lease_or_provenance_changed':a!=b,'next_scene_used_as_terminal_snapshot':False,
        'expected_member_states':a.members,'actual_member_states':b.members,'expected_patrol_state':a.patrol_state,'actual_patrol_state':b.patrol_state},
        prerequisite_refs=() if current and same_scene else ('owned_sealed_same_scene_joint_trace',),examined_count=count,domain_complete=current and same_scene and not cut,computation_bound_reached=bool(cut),frontier=cut)


def _transfer(request,model):
    old=request.prior_model;before=request.prior_state;after=request.state;work=_work(before)+_work(after)+len(old.commands)+len(model.commands)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'entry_reset_joint_contract_compare'})
    portable=('order_kind','simultaneous_peer_policy','simultaneous_conflicts','motion','paint_order','patrol_clock_phase','boundary_body_rule','per_cell_clock_order')
    differences=tuple((name,getattr(old,name),getattr(model,name)) for name in portable if getattr(old,name)!=getattr(model,name))
    return family_result(request,values={'portable_contract_differences':differences,'same_portable_laws_candidate':not differences,'reset_pose_and_trail_fields_not_transferred':True,
        'regrounding_obligations':('current_cursor_types_and_masks','current_typed_seat_bindings','current_boundary_topology','current_patrol_phase_and_masks','current_command_costs_and_clock_scope'),
        'retained_old_witness_word':(),'old_phase_copied_by_level_identity':False,'canonical_memory_written':False},examined_count=work)


def measure_wrap_slide(request: WrapRequest) -> MechanicalFamilyResult:
    if request.mode is None or request.mode not in OPERATION_MODES.get(request.operation_ref,()):return family_result(request,signature_supported=False,domain_complete=False)
    if request.operation_ref == 'mechanics.typed_seating.injective_conjunction':
        return _injective_seating(request)
    op=request.operation_ref.rsplit('.',1)[-1];required={'scene_measure':('raw_layer_pixels','layer_templates'),'clock_slide_fit':('models','observations'),
        'seat_approach_preimages':('state','models','bound_model_ref','preimage_states','target_member_ref','target_seat_ref','command_scope_ref','clock_ref','temporal_scope_ref'),
        'ordered_joint_successor':('state','models','bound_model_ref','input_ref','command_scope_ref','clock_ref','temporal_scope_ref'),
        'phase_safe_suffix':('models','bound_model_ref','retained_initial_states','requested_word','command_scope_ref','preservation_constraints','future_consumer_ref','clock_ref','temporal_scope_ref'),
        'joint_route_domain':('state','models','bound_model_ref','command_scope_ref','clock_ref','temporal_scope_ref'),'sealed_slide_compare':('expected_state','actual_state'),
        'scoped_slide_transfer':('state','models','bound_model_ref','prior_state','prior_model'),'external_primitive':('state','models','bound_model_ref','input_ref','command_scope_ref','step_identity','parent_identity','clock_ref','temporal_scope_ref'),
        'topology_and_local_trails':('state','topology','commands','command_scope_ref')}
    missing=missing_supplied_fields(request,required[op])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op=='topology_and_local_trails':return _topology_domain(request)
    if op=='clock_slide_fit':return _fit(request)
    if op=='sealed_slide_compare':return _compare(request)
    if op=='scene_measure':
        measured=translated_layers(request);templates={t.template_ref:t for t in request.layer_templates};values=dict(measured.values);rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
        return measured.model_copy(update={'values':immutable_json_data({**values,'body_seat_armature_paint_patrol_candidates':tuple({'measurement':r,'component':templates[r['template_ref']].component,'grouping_candidate_ref':templates[r['template_ref']].grouping_candidate_ref,'type_candidate_ref':templates[r['template_ref']].type_candidate_ref} for r in rows),
            'palette_index_assigns_semantic_role':False,'composite_patrol_reduced_to_marker':False})})
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    if model is None:return family_result(request,prerequisite_refs=('bound_current_joint_slide_model',),domain_complete=False)
    if op=='scoped_slide_transfer':return _transfer(request,model)
    if op=='phase_safe_suffix':return _suffix(request,model)
    if op=='joint_route_domain':return _graph(request,model)
    if op=='seat_approach_preimages':return _preimages(request,model)
    command=next((c for c in model.commands if c.input_ref==request.input_ref),None)
    if command is None:return family_result(request,prerequisite_refs=('current_joint_input_mapping',),domain_complete=False)
    if op=='external_primitive':
        identity_debt=primitive_identity_missing(request,'wrap_slide_model_ref')
        if identity_debt:return family_result(request,prerequisite_refs=identity_debt,domain_complete=False)
        if model.patrol_clock_phase!='PRE_INPUT':return family_result(request,prerequisite_refs=('declared_external_pre_input_patrol_scope',),domain_complete=False)
    after,events,phase_states,debt,count,cut,cost=_external(request.state,model,request,command,request.maximum_evaluations)
    packet=None;packet_debt=()
    if op=='external_primitive':
        packet,packet_debt=primitive_packet(request,model,command,after,events,phase_states,cost,debt or ('remaining_complete_joint_primitive_work',) if cut else debt,'wrap_slide_model_ref','wrap_slide')
        if packet is not None:
            if after.status=='WIN' and request.source_goal_acceptance_contract_ref is None:packet_debt=('source_owned_settled_typed_seat_acceptance_contract',);packet=packet.model_copy(update={'complete':False,'missing_refs':packet.missing_refs+packet_debt})
            else:packet=packet.model_copy(update={'source_goal_acceptance_contract_ref':request.source_goal_acceptance_contract_ref})
    return family_result(request,values={'after_state':after,'owned_clock_slide_cost_acceptance_events':events,'primitive_packet':packet,'primitive_cost':cost,'external_command_count':1,'second_automatic_pass_permitted':False},
        prerequisite_refs=debt+packet_debt,examined_count=count,domain_complete=not debt and not cut and not packet_debt,computation_bound_reached=bool(cut),frontier=cut)
