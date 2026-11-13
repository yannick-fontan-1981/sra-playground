"""Station-scoped rigid cargo geometry, independent of other cargo protocols.

Initial exact translation slice; pickup, station rotation, irreversible unload,
viability, owned external packet and Source/DRM integration remain explicit debt.
"""
from typing import Literal
from collections import deque
from heapq import heappop, heappush
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields, with_implementation_debt
from .mutable_kit_survival import KitEventTrace as CargoEventTrace
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as translated_layers
from .mechanical_request_contracts import MechanicalRequestIdentity
from .inventory_gated_navigation import _identity_missing as primitive_identity_missing, _packet as primitive_packet
from .rigid_grasp_geometry import (
    support_collisions, contact_cells, candidate_grasp_roots,
    footprint_measurements, translated_mask, quarter_turned_mask,
)


class CargoTerrain(FrozenModel):
    x: int
    y: int
    support: Literal['SUPPORTED','BLOCKED','UNKNOWN']
    evidence_ref: Ref | None = None


class StationCargo(FrozenModel):
    cargo_ref: Ref
    type_ref: Ref
    origin_x: int
    origin_y: int
    offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    orientation: int = Field(ge=0,le=3)
    delivered: bool
    mask_evidence_ref: Ref | None = None
    @model_validator(mode='after')
    def mask(self):
        if len(set(self.offsets))!=len(self.offsets):raise ValueError('exact body mask has distinct occupied cells')
        return self


class CargoReceiver(FrozenModel):
    receiver_ref: Ref
    accepted_type_refs: tuple[Ref,...] = Field(max_length=128)
    cells: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    containment_evidence_ref: Ref | None = None


class CargoStation(FrozenModel):
    station_ref: Ref
    carrier_support_cells: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    pivot_x: int
    pivot_y: int
    pivot_frame: Literal['WORLD','CARRIER_RELATIVE']
    licensed_quarter_turns: tuple[Literal[-1,1,2],...] = Field(max_length=3)
    collision_scope: Literal['FINAL_MASK','SUPPLIED_SWEEP','UNKNOWN']
    law_evidence_ref: Ref | None = None
    swept_cells_by_turn: tuple[tuple[int,tuple[tuple[int,int],...]],...] = Field(default=(),max_length=3)


class StationCargoState(FrozenModel):
    carrier_x: int
    carrier_y: int
    carrier_offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=128)
    cargo: tuple[StationCargo,...] = Field(max_length=128)
    attached_cargo_ref: Ref | None = None
    terrain: tuple[CargoTerrain,...] = Field(max_length=4096)
    receivers: tuple[CargoReceiver,...] = Field(max_length=128)
    stations: tuple[CargoStation,...] = Field(max_length=128)
    required_cargo_refs: tuple[Ref,...] = Field(max_length=128)
    remaining_budget: int = Field(ge=0,le=65536)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    input_tick: int = Field(ge=0)
    @model_validator(mode='after')
    def identities(self):
        if len({c.cargo_ref for c in self.cargo})!=len(self.cargo):raise ValueError('distinct current cargo identities')
        if len({(t.x,t.y) for t in self.terrain})!=len(self.terrain):raise ValueError('one supplied support per logical cell')
        if len(set(self.carrier_offsets))!=len(self.carrier_offsets):raise ValueError('exact carrier mask has distinct cells')
        if self.attached_cargo_ref is not None and not any(c.cargo_ref==self.attached_cargo_ref and not c.delivered for c in self.cargo):raise ValueError('only undelivered current cargo can be attached')
        if len(set(self.required_cargo_refs))!=len(self.required_cargo_refs) or any(ref not in {c.cargo_ref for c in self.cargo} for ref in self.required_cargo_refs):raise ValueError('required cargo population is explicit and current')
        if len({r.receiver_ref for r in self.receivers})!=len(self.receivers) or len({s.station_ref for s in self.stations})!=len(self.stations):raise ValueError('distinct receiver and station identities')
        return self


class CargoCommand(FrozenModel):
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    kind: Literal['MOVE','CONTEXT','RESET']
    dx: int = 0
    dy: int = 0
    quarter_turns: int | None = Field(default=None,ge=-1,le=2)
    cost: int = Field(ge=0,le=65536)
    cost_evidence_ref: Ref | None = None


class StationCargoModel(FrozenModel):
    model_ref: Ref
    commands: tuple[CargoCommand,...] = Field(default=(),max_length=64)
    phases: tuple[Literal['DEBIT','DIRECT','CLOCK','ACCEPTANCE','EXHAUSTION'],...] = Field(default=(),max_length=5)
    grasp_selector: Literal['FIRST_IN_DECLARED_ORDER','UNIQUE_CONTACT','UNKNOWN'] = 'UNKNOWN'
    grasp_order: tuple[Ref,...] = Field(default=(),max_length=128)
    grasp_vectors: tuple[tuple[int,int],...] = Field(default=(),max_length=16)
    grasp_anchor_scope: Literal['ORIGIN','WHOLE_CARRIER'] = 'ORIGIN'
    grasp_evidence_ref: Ref | None = None
    permanent_unload_evidence_ref: Ref | None = None
    no_free_drop_evidence_ref: Ref | None = None
    autonomy: Literal['NONE','UNKNOWN'] = 'UNKNOWN'
    autonomy_evidence_ref: Ref | None = None
    clock_increment: int | None = Field(default=None,ge=0,le=256)
    failure: Literal['LOCAL_STOP','GAME_OVER','RESTORE_DECLARED','UNKNOWN'] = 'UNKNOWN'
    restore_state: StationCargoState | None = None
    reset_evidence_ref: Ref | None = None
    receiver_selector: Literal['UNIQUE_MATCH','FIRST_IN_DECLARED_ORDER','UNKNOWN'] = 'UNKNOWN'
    receiver_order: tuple[Ref,...] = Field(default=(),max_length=128)
    @model_validator(mode='after')
    def operation_domain(self):
        if self.phases and (len(self.phases)!=5 or len(set(self.phases))!=5):raise ValueError('primitive phases are complete and occur once')
        if len({c.input_ref for c in self.commands})!=len(self.commands):raise ValueError('distinct command mappings')
        if len(set(self.grasp_order))!=len(self.grasp_order):raise ValueError('grasp selector order has distinct cargo identities')
        if any(dx*dy!=0 or dx==dy==0 for dx,dy in self.grasp_vectors):raise ValueError('station cargo grasp approaches are orthogonal')
        return self


class CargoObservation(FrozenModel):
    observation_ref: Ref
    before: StationCargoState
    after: StationCargoState
    input_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    trace: CargoEventTrace | None = None


class CargoLayerTemplate(ContactLayerTemplate):
    component: Literal['CARRIER','CARGO_MASK','TERRAIN','RECEIVER','STATION','DECORATION','UNKNOWN']
    grouping_candidate_ref: Ref | None = None
    type_candidate_ref: Ref | None = None


class StationCargoRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.station_gated_cargo_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=256)
    state: StationCargoState | None = None
    dx: int | None = None
    dy: int | None = None
    models: tuple[StationCargoModel,...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    cargo_ref: Ref | None = None
    station_ref: Ref | None = None
    receiver_ref: Ref | None = None
    quarter_turns: int | None = Field(default=None,ge=-1,le=2)
    input_ref: Ref | None = None
    observations: tuple[CargoObservation,...] = Field(default=(),max_length=256)
    expected_state: StationCargoState | None = None
    actual_state: StationCargoState | None = None
    expected_trace: CargoEventTrace | None = None
    actual_trace: CargoEventTrace | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[CargoLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    kernel_ref: Ref = 'mechanics.oriented_cargo_handoffs'
    step_identity: MechanicalRequestIdentity | None = None
    parent_identity: MechanicalRequestIdentity | None = None
    clock_ref: Ref | None = None
    temporal_scope_ref: Ref | None = None
    source_goal_acceptance_contract_ref: Ref | None = None
    @model_validator(mode='after')
    def alternatives(self):
        if len({m.model_ref for m in self.models})!=len(self.models):raise ValueError('distinct supplied model alternatives')
        if len({t.template_ref for t in self.layer_templates})!=len(self.layer_templates):raise ValueError('distinct physical template alternatives')
        return self


OPERATION_MODES={'mechanics.station_gated_cargo.scene_measure':('MEASURE',),'mechanics.station_gated_cargo.grip_motion_fit':('FIT',),
    'mechanics.station_gated_cargo.grip_domains':('INVERSE_DOMAIN',),'mechanics.station_gated_cargo.rigid_translation':('STEP_INTERNAL',),
    'mechanics.station_gated_cargo.pivot_rotation':('STEP_INTERNAL',),'mechanics.station_gated_cargo.irreversible_unload':('PRECONDITION','STEP_INTERNAL'),
    'mechanics.station_gated_cargo.grip_viability':('DOMAIN',),'mechanics.station_gated_cargo.delivery_access':('PRECONDITION','DOMAIN'),
    'mechanics.station_gated_cargo.delivery_domain':('DOMAIN',),'mechanics.station_gated_cargo.sealed_delivery_compare':('COMPARE',),
    'mechanics.station_gated_cargo.external_primitive':('STEP',)}


def _world_cargo(cargo):return tuple((cargo.origin_x+x,cargo.origin_y+y) for x,y in cargo.offsets)


def _cargo(state,ref):return next((c for c in state.cargo if c.cargo_ref==ref),None)


def _carrier_mask(state):return tuple((state.carrier_x+x,state.carrier_y+y) for x,y in state.carrier_offsets)


def _geometry_work(state):
    return 3*len(state.terrain)+3*sum(len(c.offsets) for c in state.cargo)+2*len(state.carrier_offsets)+len(state.cargo)


def _collision(state,carrier,cargo_mask,excluded_ref,extra=()):
    terrain={(t.x,t.y):t for t in state.terrain};others=tuple(c for c in state.cargo if c.cargo_ref!=excluded_ref)
    if any(c.mask_evidence_ref is None for c in others):return (),(),('complete_other_cargo_obstacle_masks',)
    obstacles={point for c in others for point in _world_cargo(c)}
    blocked,unknown=support_collisions(carrier,cargo_mask,
        {point:(row.support,row.evidence_ref) for point,row in sorted(terrain.items())},obstacles,extra)
    return blocked,unknown,()


def _translate(state,dx,dy,maximum):
    work=_geometry_work(state);attached=_cargo(state,state.attached_cargo_ref)
    if work>maximum:return state,(),(),0,{'phase':'rigid_pair_geometry'}
    if attached is not None and attached.mask_evidence_ref is None:return state,(),('current_complete_attached_cargo_mask',),work,{}
    carrier=translated_mask(_carrier_mask(state),(dx,dy));cargo_mask=() if attached is None else translated_mask(_world_cargo(attached),(dx,dy))
    blocked,unknown,debt=_collision(state,carrier,cargo_mask,state.attached_cargo_ref)
    if debt or unknown:return state,({'kind':'TRANSLATION_SUPPORT_UNKNOWN','cells':unknown},),debt or ('current_whole_pair_support',),work,{}
    if blocked:return state,({'kind':'RIGID_TRANSLATION_REFUSED','exact_refusal_mask':blocked,'other_cargo_pushed':False},),(),work,{}
    cargo=tuple(c.model_copy(update={'origin_x':c.origin_x+dx,'origin_y':c.origin_y+dy}) if c.cargo_ref==state.attached_cargo_ref else c for c in state.cargo)
    after=state.model_copy(update={'carrier_x':state.carrier_x+dx,'carrier_y':state.carrier_y+dy,'cargo':cargo})
    return after,({'kind':'RIGID_TRANSLATION','delta':(dx,dy),'whole_pair_mask':tuple(sorted(set(carrier+cargo_mask))),'orientation_unchanged':True,
        'exact_envelope':footprint_measurements(carrier,cargo_mask)},),(),work,{}


def _containments(state,cargo_ref,maximum):
    cargo=_cargo(state,cargo_ref);work=len(state.cargo)+sum(len(r.cells) for r in state.receivers)+(0 if cargo is None else len(cargo.offsets)*len(state.receivers))
    if work>maximum:return (),(),0,{'phase':'typed_whole_mask_containment'}
    if cargo is None:return (),('current_requested_cargo',),work,{}
    if cargo.mask_evidence_ref is None:return (),('current_complete_cargo_mask',),work,{}
    world=set(_world_cargo(cargo));rows=[]
    for receiver in state.receivers:
        compatible=cargo.type_ref in receiver.accepted_type_refs;deficit=tuple(sorted(world-set(receiver.cells)))
        rows.append({'receiver_ref':receiver.receiver_ref,'typed_compatible':compatible,'whole_mask_contained':compatible and not deficit,'containment_deficit':deficit,'law_supported':receiver.containment_evidence_ref is not None,
            'surplus_receiver_cells_must_be_filled':False})
    return tuple(rows),(),work,{}


def _receiver_choice(rows,model,allow_hypothetical=False):
    matches=tuple(row['receiver_ref'] for row in rows if row['whole_mask_contained'])
    if not matches:return None,()
    if any(not row['law_supported'] for row in rows if row['whole_mask_contained']) and not allow_hypothetical:return None,('current_typed_receiver_containment_law',)
    if len(matches)==1:return matches[0],()
    if model.receiver_selector=='FIRST_IN_DECLARED_ORDER':
        if not set(matches).issubset(set(model.receiver_order)):return None,('complete_current_receiver_selector_order',)
        return next(ref for ref in model.receiver_order if ref in matches),()
    return None,('current_competing_receiver_selection_law',)


def _unload(state,model,cargo_ref,receiver_ref,transition,maximum,allow_hypothetical=False):
    rows,debt,count,cut=_containments(state,cargo_ref,maximum)
    if debt or cut:return state,({'kind':'UNLOAD_CONTAINMENT','candidates':rows},),debt,count,cut
    row=next((r for r in rows if r['receiver_ref']==receiver_ref),None);cargo=_cargo(state,cargo_ref)
    if row is None:return state,(),('current_addressed_receiver',),count,{}
    if not transition:return state,({'kind':'UNLOAD_PRECONDITION','cargo_ref':cargo_ref,**row,'canonical_delivery_enacted':False},),() if row['law_supported'] else ('current_typed_receiver_containment_law',),count,{}
    if state.attached_cargo_ref!=cargo_ref or cargo.delivered:return state,(),('current_undelivered_attached_cargo',),count,{}
    if model.permanent_unload_evidence_ref is None and not allow_hypothetical:return state,(),('supported_permanent_unload_and_detachment_law',),count,{}
    if not row['law_supported'] and not allow_hypothetical:return state,(),('current_typed_receiver_containment_law',),count,{}
    if not row['whole_mask_contained']:return state,({'kind':'UNLOAD_REFUSED','cargo_ref':cargo_ref,**row},),(),count,{}
    choice,selector_debt=_receiver_choice(rows,model,allow_hypothetical)
    if selector_debt:return state,(),selector_debt,count,{}
    if choice!=receiver_ref:return state,(),('addressed_receiver_matches_actual_selector',),count,{}
    after=state.model_copy(update={'attached_cargo_ref':None,'cargo':tuple(c.model_copy(update={'delivered':True}) if c.cargo_ref==cargo_ref else c for c in state.cargo)})
    return after,({'kind':'PERMANENT_UNLOAD','cargo_ref':cargo_ref,'receiver_ref':receiver_ref,'retained_obstacle_mask':_world_cargo(cargo),'carrier_released':True},),(),count,{}


def _rotate_point(point,pivot,turn):
    x,y=point[0]-pivot[0],point[1]-pivot[1]
    for _ in range(turn%4):x,y=-y,x
    return pivot[0]+x,pivot[1]+y


def _pivot(state,station_ref,turn,maximum,allow_hypothetical=False):
    attached=_cargo(state,state.attached_cargo_ref);station=next((s for s in state.stations if s.station_ref==station_ref),None);work=_geometry_work(state)+sum(len(s.carrier_support_cells) for s in state.stations)
    if work>maximum:return state,(),(),0,{'phase':'station_pivot_context'}
    if attached is None or station is None:return state,(),('current_attached_cargo_and_station',),work,{}
    if (state.carrier_x,state.carrier_y) not in station.carrier_support_cells:return state,({'kind':'ROTATION_REFUSED','reason':'carrier_not_at_station','station_ref':station_ref},),(),work,{}
    if station.law_evidence_ref is None and not allow_hypothetical or attached.mask_evidence_ref is None:return state,(),('supported_station_pivot_and_complete_body',),work,{}
    if turn not in station.licensed_quarter_turns:return state,({'kind':'ROTATION_REFUSED','reason':'unlicensed_rotation_direction','turn':turn},),(),work,{}
    rows,debt,extra,cut=_containments(state,attached.cargo_ref,maximum-work);work+=extra
    if debt or cut:return state,(),debt,work,cut
    if any(r['whole_mask_contained'] for r in rows):return state,({'kind':'ROTATION_PREEMPTED_BY_DELIVERY','containments':rows},),(),work,{}
    pivot=(station.pivot_x,station.pivot_y) if station.pivot_frame=='WORLD' else (state.carrier_x+station.pivot_x,state.carrier_y+station.pivot_y)
    origin=_rotate_point((attached.origin_x,attached.origin_y),pivot,turn);world=quarter_turned_mask(_world_cargo(attached),pivot,turn);sweep=()
    if station.collision_scope=='UNKNOWN':return state,(),('current_station_collision_scope',),work,{}
    if station.collision_scope=='SUPPLIED_SWEEP':
        sweep=next((cells for value,cells in station.swept_cells_by_turn if value==turn),None)
        if sweep is None:return state,(),('current_licensed_rotation_sweep_cells',),work,{}
        if work+len(sweep)>maximum:return state,(),(),work,{'phase':'licensed_rotation_sweep'}
        work+=len(sweep)
    blocked,unknown,debt=_collision(state,_carrier_mask(state),world,attached.cargo_ref,sweep)
    if debt or unknown:return state,({'kind':'ROTATION_SUPPORT_UNKNOWN','cells':unknown},),debt or ('current_complete_rotated_mask_support',),work,{}
    if blocked:return state,({'kind':'ROTATION_REFUSED','exact_refusal_mask':blocked,'pivot':pivot},),(),work,{}
    changed=attached.model_copy(update={'origin_x':origin[0],'origin_y':origin[1],'offsets':tuple(sorted((x-origin[0],y-origin[1]) for x,y in world)),'orientation':(attached.orientation+turn)%4})
    after=state.model_copy(update={'cargo':tuple(changed if c.cargo_ref==attached.cargo_ref else c for c in state.cargo)})
    return after,({'kind':'STATION_PIVOT_ROTATION','station_ref':station_ref,'pivot':pivot,'turn':turn,'whole_after_mask':world,'inverse_rotation_inferred':False},),(),work,{}


def _grasp_candidates(state,model,maximum,allow_hypothetical=False):
    anchors=_carrier_mask(state) if model.grasp_anchor_scope=='WHOLE_CARRIER' else ((state.carrier_x,state.carrier_y),)
    work=_geometry_work(state)+len(model.grasp_order)+len(model.grasp_vectors)*len(anchors)*sum(len(c.offsets) for c in state.cargo)
    if work>maximum:return (),None,(),0,{'phase':'actual_grasp_contacts'}
    if state.attached_cargo_ref is not None:return (),None,('free_current_carrier',),work,{}
    if model.grasp_evidence_ref is None and not allow_hypothetical or not model.grasp_vectors:return (),None,('supported_grasp_hit_vectors_and_selector',),work,{}
    candidates=[]
    for cargo in state.cargo:
        if cargo.delivered:continue
        if cargo.mask_evidence_ref is None:return tuple(candidates),None,('complete_candidate_cargo_masks',),work,{}
        hits=contact_cells(anchors,_world_cargo(cargo),model.grasp_vectors)
        if hits:candidates.append({'cargo_ref':cargo.cargo_ref,'contact_cells':hits,'origin_offset':(cargo.origin_x-state.carrier_x,cargo.origin_y-state.carrier_y),'legal_grasp_is_viable_proof':False})
    if not candidates:return (),None,(),work,{}
    refs={row['cargo_ref'] for row in candidates}
    if model.grasp_selector=='FIRST_IN_DECLARED_ORDER':
        if not refs.issubset(set(model.grasp_order)):return tuple(candidates),None,('complete_actual_grasp_selector_order',),work,{}
        actual=next(ref for ref in model.grasp_order if ref in refs)
    elif model.grasp_selector=='UNIQUE_CONTACT' and len(refs)==1:actual=next(row['cargo_ref'] for row in candidates)
    else:return tuple(candidates),None,('current_competing_grasp_selector_law',),work,{}
    return tuple(candidates),actual,(),work,{}


def _direct(state,model,command,maximum,allow_hypothetical=False):
    if command.kind=='RESET':
        if model.reset_evidence_ref is None or model.restore_state is None:return state,(),('declared_cargo_reset_contract',),0,{}
        return model.restore_state,({'kind':'DECLARED_RESET','restoration':True},),(),1,{}
    if command.kind=='MOVE':return _translate(state,command.dx,command.dy,maximum)
    if model.no_free_drop_evidence_ref is None and not allow_hypothetical:return state,(),('supported_no_free_drop_context_protocol',),0,{}
    if state.attached_cargo_ref is None:
        candidates,actual,debt,count,cut=_grasp_candidates(state,model,maximum,allow_hypothetical)
        if debt or cut:return state,({'kind':'GRASP_CANDIDATES','candidates':candidates},),debt,count,cut
        if actual is None:return state,({'kind':'NO_GRASP_CONTACT'},),(),count,{}
        return state.model_copy(update={'attached_cargo_ref':actual}),({'kind':'GRASP','cargo_ref':actual,'candidates':candidates,'viability_proved':False},),(),count,{}
    rows,debt,count,cut=_containments(state,state.attached_cargo_ref,maximum)
    if debt or cut:return state,(),debt,count,cut
    receiver,selector_debt=_receiver_choice(rows,model,allow_hypothetical)
    if selector_debt:return state,(),selector_debt,count,{}
    if receiver is not None:
        after,events,debt,extra,cut=_unload(state,model,state.attached_cargo_ref,receiver,True,maximum-count,allow_hypothetical)
        return after,events,debt,count+extra,cut
    stations=tuple(s for s in state.stations if (state.carrier_x,state.carrier_y) in s.carrier_support_cells)
    if not stations:return state,({'kind':'CONTEXT_NO_EFFECT','arbitrary_release':False},),(),count,{}
    if len(stations)!=1 or command.quarter_turns is None:return state,(),('actual_station_and_rotation_gesture_mapping',),count,{}
    after,events,debt,extra,cut=_pivot(state,stations[0].station_ref,command.quarter_turns,maximum-count,allow_hypothetical)
    return after,events,debt,count+extra,cut


def _external(state,model,command,maximum,allow_hypothetical=False):
    if state.status!='ACTIVE':return state,(),(),('active_cargo_primitive_scope',),0,{},0
    if not model.phases or model.clock_increment is None:return state,(),(),('complete_cargo_primitive_phase_and_clock_contract',),0,{},0
    if command.kind=='RESET' and model.phases.index('DEBIT')>model.phases.index('DIRECT'):return state,(),(),('reset_cost_owned_before_scope_restoration',),0,{},0
    if model.autonomy!='NONE' or model.autonomy_evidence_ref is None:return state,(),(),('current_independent_autonomy_contract',),0,{},0
    if command.cost_evidence_ref is None and not allow_hypothetical:return state,(),(),('supported_cargo_primitive_cost',),0,{},0
    current=state;events=[];states=[];count=0;debt=();cut={};cost=0
    for phase_index,phase in enumerate(model.phases):
        if count>=maximum:cut={'phase':'cargo_primitive','next_phase_index':phase_index};break
        count+=1;before=current;detail={}
        if phase=='DEBIT':
            if command.cost>current.remaining_budget:debt=('funded_cargo_primitive',);break
            current=current.model_copy(update={'remaining_budget':current.remaining_budget-command.cost});cost=command.cost;detail={'kind':'PRIMITIVE_DEBIT','cost':cost}
        elif phase=='DIRECT':
            current,trace,debt,work,cut=_direct(current,model,command,maximum-count,allow_hypothetical);count+=work;detail={'kind':'DIRECT_EVENT','trace':trace,'restoration':any(e.get('restoration') for e in trace)}
        elif phase=='CLOCK':current=current.model_copy(update={'input_tick':current.input_tick+model.clock_increment});detail={'kind':'DECLARED_INPUT_CLOCK','increment':model.clock_increment,'automatic_pass_already_owned':True}
        elif phase=='ACCEPTANCE':
            victory=current.attached_cargo_ref is None and all(any(c.cargo_ref==ref and c.delivered for c in current.cargo) for ref in current.required_cargo_refs)
            if victory:current=current.model_copy(update={'status':'WIN'})
            detail={'kind':'QUANTIFIED_DELIVERY_ACCEPTANCE','accepted':victory,'required_refs':current.required_cargo_refs,'carrier_free':current.attached_cargo_ref is None}
        else:
            if current.remaining_budget<=0:
                if model.failure=='UNKNOWN':debt=('current_cargo_empty_budget_lifecycle',)
                elif model.failure=='RESTORE_DECLARED':
                    if model.restore_state is None or model.reset_evidence_ref is None:debt=('declared_cargo_failure_restore_contract',)
                    else:current=model.restore_state;detail={'restoration':True}
                else:current=current.model_copy(update={'status':model.failure})
            detail={'kind':'EMPTY_BUDGET_CHECK','remaining_budget':current.remaining_budget,**detail}
        events.append(detail);states.append((phase,before,current))
        if debt or cut or detail.get('restoration') or current.status!='ACTIVE' or (current.level_scope_ref,current.restore_epoch)!=(state.level_scope_ref,state.restore_epoch):break
    return current,tuple(events),tuple(states),debt,count,cut,cost


def _grip_domains(request,model):
    state=request.state;rows=[];unknown=[];count=0;cuts=[];examined=set()
    if state.attached_cargo_ref is not None:return family_result(request,prerequisite_refs=('free_carrier_for_grasp_domain',),domain_complete=False)
    for cargo in state.cargo:
        if cargo.delivered or request.cargo_ref is not None and request.cargo_ref!=cargo.cargo_ref:continue
        anchor_offsets=state.carrier_offsets if model.grasp_anchor_scope=='WHOLE_CARRIER' else ((0,0),)
        poses,work,complete=candidate_grasp_roots(anchor_offsets,_world_cargo(cargo),model.grasp_vectors,request.maximum_evaluations-count)
        count+=work
        if not complete:cuts.append({'phase':'grip_contact_domain','cargo_ref':cargo.cargo_ref})
        for pose in poses:
            if pose in examined:continue
            if len(examined)>=request.maximum_states:cuts.append({'phase':'grip_support_states','cargo_ref':cargo.cargo_ref,'pose':pose});break
            examined.add(pose);candidate=state.model_copy(update={'carrier_x':pose[0],'carrier_y':pose[1]})
            work=_geometry_work(candidate)
            if count+work>request.maximum_evaluations:cuts.append({'phase':'grip_support_work','cargo_ref':cargo.cargo_ref,'pose':pose});break
            count+=work;blocked,unseen,debt=_collision(candidate,_carrier_mask(candidate),(),None)
            if blocked:continue
            if debt or unseen:unknown.append({'carrier_pose':pose,'missing_refs':debt,'unknown_support_cells':unseen});continue
            contacts,actual,debt,work,cut=_grasp_candidates(candidate,model,request.maximum_evaluations-count);count+=work
            if cut:cuts.append(cut);break
            rows.append({'carrier_pose':pose,'grasp_candidates':contacts,'actual_selector_cargo_ref':actual,'competing_contact_prerequisites':debt,
                'candidate_binding_state':None if actual is None else candidate.model_copy(update={'attached_cargo_ref':actual}),
                'grasp_anchor_scope':model.grasp_anchor_scope,'delivery_viability_proved':False,'approach_route_required':True})
        if cuts:break
    return family_result(request,values={'orthogonal_grasp_domains':rows,'unknown_support_branches':unknown,'legal_grasp_implies_viable_delivery':False},examined_count=count,
        domain_complete=not cuts and not unknown and not any(row['competing_contact_prerequisites'] for row in rows),computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _graph(request,model,grip_only=False):
    if model.no_free_drop_evidence_ref is None or model.autonomy!='NONE' or model.autonomy_evidence_ref is None:return family_result(request,prerequisite_refs=('current_no_free_drop_and_independent_autonomy_assumptions',),domain_complete=False)
    nodes=[request.state];scripts=[()];costs=[0];depths=[0];seen={request.state:0};queue=[(0,0)];edges=[];witnesses=[];cuts=[];boundaries=[];count=0;initial_attached=request.state.attached_cargo_ref
    while queue:
        distance,index=heappop(queue)
        if distance!=costs[index]:continue
        state=nodes[index]
        delivered_initial=initial_attached is not None and any(c.cargo_ref==initial_attached and c.delivered for c in state.cargo)
        achieved=delivered_initial and state.attached_cargo_ref is None if grip_only else state.status=='WIN'
        if achieved:witnesses.append({'node':index,'primitive_cost':distance,'external_word':scripts[index],'after_state':state});continue
        if state.status!='ACTIVE':continue
        if depths[index]>=request.maximum_depth:cuts.append({'node':index,'phase':'cargo_primitive_depth'});continue
        for command_index,command in enumerate(model.commands):
            if command.kind=='RESET':continue
            before=state;after,events,phase_states,debt,work,cut,cost=_external(state,model,command,request.maximum_evaluations-count);count+=work
            if cut:cuts.append({'node':index,'next_command_index':command_index,**cut});queue.clear();break
            if debt:boundaries.append({'node':index,'command':command,'after_prefix_state':after,'events':events,'missing_refs':debt});continue
            restored=any(e.get('restoration') for e in events)
            if restored or (after.level_scope_ref,after.restore_epoch)!=(before.level_scope_ref,before.restore_epoch):boundaries.append({'node':index,'command':command,'reason':'qualify_new_cargo_execution_scope'});continue
            if grip_only and after.attached_cargo_ref not in (initial_attached,None):continue
            child=seen.get(after);newcost=distance+cost;script={'command':command,'events':events,'primitive_cost':cost,'before':before,'after':after}
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'node':index,'next_command_index':command_index,'phase':'cargo_configuration_states'});continue
                child=len(nodes);seen[after]=child;nodes.append(after);scripts.append(scripts[index]+(script,));costs.append(newcost);depths.append(depths[index]+1);heappush(queue,(newcost,child))
            elif newcost<costs[child]:
                costs[child]=newcost;scripts[child]=scripts[index]+(script,);depths[child]=depths[index]+1;heappush(queue,(newcost,child))
            edges.append({'from_node':index,'to_node':child,'command':command,'events':events,'phase_states':phase_states,'primitive_cost':cost})
    return family_result(request,values={'carried_or_delivery_configuration_states':nodes,'owned_external_edges':edges,'delivery_witnesses':witnesses,
        'unknown_model_branches':boundaries,'declared_domain_exhausted':not witnesses and not cuts and not boundaries,'minimum_cost_proved_within_declared_model':bool(witnesses) and not cuts and not boundaries,
        'internal_successor_recursively_searched':False,'intermediate_free_drop_invented':False,'generic_k03_k09_domain_candidate':True,'source_search_identity_and_edge_packet_binding_required':True,'generic_search_invoked':False,'macro_expansions':tuple(w['external_word'] for w in witnesses)},
        examined_count=count,domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'pending_queue':tuple(queue)} if cuts else {})


def _delivery_access(request,model):
    state=request.state;after,trace,debt,count,cut=_unload(state,model,request.cargo_ref,request.receiver_ref,True,request.maximum_evaluations)
    if debt or cut:return family_result(request,values={'candidate_unload_events':trace},prerequisite_refs=debt,examined_count=count,domain_complete=False,computation_bound_reached=bool(cut),frontier=cut)
    if after is state:return family_result(request,values={'unload_precondition_refused':True,'events':trace},examined_count=count)
    work=_geometry_work(after)+sum(len(s.carrier_support_cells) for s in after.stations)+sum(len(r.cells) for r in after.receivers)
    if count+work>request.maximum_evaluations:return family_result(request,values={'after_permanent_unload':after,'unload_events':trace},examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'phase':'remaining_delivery_access'})
    count+=work;remaining=tuple(c for c in after.cargo if c.cargo_ref in after.required_cargo_refs and not c.delivered);compatibility=[];station_supports=[]
    for cargo in remaining:
        for receiver in after.receivers:
            if count>=request.maximum_evaluations:return family_result(request,values={'after_permanent_unload':after,'remaining_cargo_receiver_constraints':compatibility},examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'phase':'remaining_receiver_assignments','cargo_ref':cargo.cargo_ref,'receiver_ref':receiver.receiver_ref})
            count+=1
            if cargo.type_ref in receiver.accepted_type_refs:compatibility.append({'cargo_ref':cargo.cargo_ref,'receiver_ref':receiver.receiver_ref,'typed_match':True,'dynamic_delivery_proved':False})
    for station in after.stations:
        supports=[]
        for point in station.carrier_support_cells:
            candidate=after.model_copy(update={'carrier_x':point[0],'carrier_y':point[1]});support_work=_geometry_work(candidate)
            if count+support_work>request.maximum_evaluations:return family_result(request,values={'after_permanent_unload':after,'remaining_cargo_receiver_constraints':compatibility,'remaining_station_support_constraints':station_supports,'current_station_examined_supports':supports},examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'phase':'remaining_station_access','station_ref':station.station_ref,'next_support':point})
            count+=support_work;blocked,unknown,missing=_collision(candidate,_carrier_mask(candidate),(),None)
            supports.append({'carrier_pose':point,'blocked_mask':blocked,'unknown_cells':unknown,'missing_refs':missing,'route_from_released_carrier_required':True})
        station_supports.append({'station_ref':station.station_ref,'supports':supports})
    values={'after_permanent_unload':after,'unload_events':trace,'projection_only':True,'canonical_unload_enacted':False,'permanent_obstacle_mask':_world_cargo(_cargo(after,request.cargo_ref)),'remaining_cargo_receiver_constraints':compatibility,
        'remaining_station_support_constraints':station_supports,'released_carrier_pose':(after.carrier_x,after.carrier_y),'static_assignment_is_delivery_order_proof':False}
    if request.mode=='DOMAIN':
        if count>=request.maximum_evaluations:return family_result(request,values=values,examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'phase':'remaining_delivery_domain'})
        nested=request.model_copy(update={'state':after,'maximum_evaluations':request.maximum_evaluations-count});domain=_graph(nested,model);count+=domain.examined_count;values['remaining_full_state_delivery_domain']=domain.values
        return family_result(request,values=values,prerequisite_refs=domain.prerequisite_refs,examined_count=count,domain_complete=domain.domain_complete,computation_bound_reached=domain.computation_bound_reached,frontier=domain.frontier)
    return family_result(request,values=values,examined_count=count,domain_complete=not any(s['unknown_cells'] or s['missing_refs'] for row in station_supports for s in row['supports']))


def _fit(request):
    supported=[];refuted=[];unknown=[];count=0;cuts=[]
    for model_index,model in enumerate(request.models):
        evidence=[];bad=[];missing=[]
        for observation in request.observations:
            if not observation.sealed or observation.event_owner_ref!=request.scope.event_owner_ref or observation.epoch!=request.scope.epoch:missing.append((observation.observation_ref,'current_owned_motion_observation'));continue
            command=next((c for c in model.commands if c.input_ref==observation.input_ref),None)
            if command is None:missing.append((observation.observation_ref,'current_observed_command'));continue
            after,events,phase_states,debt,work,cut,cost=_external(observation.before,model,command,request.maximum_evaluations-count,True);count+=work
            if cut:cuts.append({'phase':'grip_motion_fit','next_model_index':model_index,'observation_ref':observation.observation_ref,**cut});break
            if debt:missing.append((observation.observation_ref,debt));continue
            trace=observation.trace
            if trace is not None and (not trace.sealed or trace.input_ref!=command.input_ref or trace.event_owner_ref!=request.scope.event_owner_ref or trace.epoch!=request.scope.epoch or trace.evidence_revision_ref!=request.scope.evidence_revision_ref or trace.model_revision_ref!=request.scope.model_revision_ref):missing.append((observation.observation_ref,'current_owned_cargo_trace'));continue
            if after!=observation.after or trace is not None and immutable_json_data(events)!=trace.events:bad.append(observation.observation_ref)
            else:
                co_motion=tuple({'cargo_ref':c.cargo_ref,'before_origin':(c.origin_x,c.origin_y),'after_origin':None if _cargo(after,c.cargo_ref) is None else (_cargo(after,c.cargo_ref).origin_x,_cargo(after,c.cargo_ref).origin_y),
                    'whole_mask':c.offsets} for c in observation.before.cargo)
                evidence.append({'observation_ref':observation.observation_ref,'co_motion':co_motion,'actual_carrier_delta':(after.carrier_x-observation.before.carrier_x,after.carrier_y-observation.before.carrier_y),'events':events})
        if cuts:break
        if bad:refuted.append({'model_ref':model.model_ref,'falsifiers':bad})
        elif evidence:
            common_motion=any(row['actual_carrier_delta']!=(0,0) and any(c['after_origin'] is not None and (c['after_origin'][0]-c['before_origin'][0],c['after_origin'][1]-c['before_origin'][1])==row['actual_carrier_delta'] for c in row['co_motion']) for row in evidence)
            if not common_motion:missing.append(('distinguishable_later_common_motion_for_binding',))
            supported.append({'model':model,'motion_support':evidence,'later_common_motion_observed':common_motion,'unresolved_observations':missing})
        else:unknown.append({'model_ref':model.model_ref,'missing_refs':missing or ('pickup_followed_by_distinguishable_common_motion',)})
    return family_result(request,values={'conditional_binding_and_motion_models':supported,'refuted_models':refuted,'unknown_models':unknown,'appearance_alone_establishes_attachment':False},
        examined_count=count,domain_complete=not cuts and not unknown and not any(row['unresolved_observations'] for row in supported),computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _compare(request):
    expected=request.expected_trace;actual=request.actual_trace;a=request.expected_state;b=request.actual_state;count=_geometry_work(a)+_geometry_work(b);first=None;cut={}
    if count>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'sealed_delivery_state_compare'})
    current=expected is not None and actual is not None and expected.sealed and actual.sealed and expected.event_owner_ref==actual.event_owner_ref==request.scope.event_owner_ref and expected.epoch==actual.epoch==request.scope.epoch and expected.input_ref==actual.input_ref and expected.evidence_revision_ref==actual.evidence_revision_ref==request.scope.evidence_revision_ref and expected.model_revision_ref==actual.model_revision_ref==request.scope.model_revision_ref
    same_scene=(a.level_scope_ref,a.restore_epoch)==(b.level_scope_ref,b.restore_epoch)
    if current and same_scene:
        for index in range(max(len(expected.events),len(actual.events))):
            if count>=request.maximum_evaluations:cut={'phase':'sealed_delivery_owned_events','next_event_index':index};break
            count+=1;x=expected.events[index] if index<len(expected.events) else None;y=actual.events[index] if index<len(actual.events) else None
            if x!=y:first={'event_index':index,'expected':x,'actual':y};break
    return family_result(request,values={'first_cargo_station_offset_or_lifecycle_mismatch':first,'same_execution_scene':same_scene,'state_mismatch':a!=b,
        'carrier_release_mismatch':a.attached_cargo_ref!=b.attached_cargo_ref,'expected_delivered_refs':tuple(c.cargo_ref for c in a.cargo if c.delivered),'actual_delivered_refs':tuple(c.cargo_ref for c in b.cargo if c.delivered),'next_scene_used_as_previous_terminal':False},
        prerequisite_refs=() if current and same_scene else ('owned_sealed_previous_cargo_scene_and_trace',),examined_count=count,domain_complete=current and same_scene and not cut,computation_bound_reached=bool(cut),frontier=cut)


def measure_station_gated_cargo(request: StationCargoRequest) -> MechanicalFamilyResult:
    if request.mode is None or request.mode not in OPERATION_MODES.get(request.operation_ref,()):return family_result(request,signature_supported=False,domain_complete=False)
    op=request.operation_ref.rsplit('.',1)[-1];required={'scene_measure':('raw_layer_pixels','layer_templates'),'grip_motion_fit':('models','observations'),'grip_domains':('state','models','bound_model_ref'),
        'rigid_translation':('state','dx','dy'),'pivot_rotation':('state','station_ref','quarter_turns'),'irreversible_unload':('state','models','bound_model_ref','cargo_ref','receiver_ref'),
        'grip_viability':('state','models','bound_model_ref'),'delivery_access':('state','models','bound_model_ref','cargo_ref','receiver_ref'),'delivery_domain':('state','models','bound_model_ref'),
        'sealed_delivery_compare':('expected_state','actual_state'),'external_primitive':('state','models','bound_model_ref','input_ref','step_identity','parent_identity','clock_ref','temporal_scope_ref')}
    missing=missing_supplied_fields(request,required[op])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op=='scene_measure':
        measured=translated_layers(request);templates={t.template_ref:t for t in request.layer_templates};values=dict(measured.values);rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
        return measured.model_copy(update={'values':immutable_json_data({**values,'body_terrain_station_receiver_candidates':tuple({'measurement':r,'component':templates[r['template_ref']].component,'grouping_candidate_ref':templates[r['template_ref']].grouping_candidate_ref,'type_candidate_ref':templates[r['template_ref']].type_candidate_ref} for r in rows),'monochrome_connected_pixels_are_one_physical_identity':False})})
    if op=='grip_motion_fit':return _fit(request)
    if op=='sealed_delivery_compare':return _compare(request)
    if request.mode=='STEP_INTERNAL' and request.state.status!='ACTIVE':return family_result(request,prerequisite_refs=('active_current_cargo_internal_scope',),domain_complete=False)
    if op=='rigid_translation':after,events,debt,count,cut=_translate(request.state,request.dx,request.dy,request.maximum_evaluations)
    elif op=='pivot_rotation':after,events,debt,count,cut=_pivot(request.state,request.station_ref,request.quarter_turns,request.maximum_evaluations)
    else:
        model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
        if model is None:return family_result(request,prerequisite_refs=('bound_current_station_cargo_model',),domain_complete=False)
        if op=='grip_domains':return _grip_domains(request,model)
        if op=='grip_viability':return _graph(request,model,True)
        if op=='delivery_domain':return _graph(request,model)
        if op=='delivery_access':return _delivery_access(request,model)
        if op=='irreversible_unload':after,events,debt,count,cut=_unload(request.state,model,request.cargo_ref,request.receiver_ref,request.mode=='STEP_INTERNAL',request.maximum_evaluations)
        else:
            identity_debt=primitive_identity_missing(request,'station_cargo_model_ref')
            if identity_debt:return family_result(request,prerequisite_refs=identity_debt,domain_complete=False)
            command=next((c for c in model.commands if c.input_ref==request.input_ref),None)
            if command is None:return family_result(request,prerequisite_refs=('current_station_cargo_command',),domain_complete=False)
            after,events,states,debt,count,cut,cost=_external(request.state,model,command,request.maximum_evaluations)
            packet,packet_debt=primitive_packet(request,model,command,after,events,states,cost,debt or ('remaining_complete_primitive_work',) if cut else debt,'station_cargo_model_ref','station_cargo')
            if packet is not None:
                if after.status=='WIN' and request.source_goal_acceptance_contract_ref is None:
                    packet_debt=packet_debt+('source_owned_required_cargo_acceptance_contract',)
                    packet=packet.model_copy(update={'complete':False,'missing_refs':packet.missing_refs+packet_debt})
                else:packet=packet.model_copy(update={'source_goal_acceptance_contract_ref':request.source_goal_acceptance_contract_ref})
            return family_result(request,values={'after_state':after,'ordered_direct_clock_cost_acceptance_events':events,'external_primitive_packet':packet,'primitive_cost':cost,'external_command_count':1,'second_automatic_pass_permitted':False},
                prerequisite_refs=debt+packet_debt,examined_count=count,domain_complete=not debt and not cut and not packet_debt,computation_bound_reached=bool(cut),frontier=cut)
    return family_result(request,values={'after_state':after,'owned_internal_geometry_events':events,'external_command_count':0,'action_release':False},prerequisite_refs=debt,examined_count=count,
        domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)
