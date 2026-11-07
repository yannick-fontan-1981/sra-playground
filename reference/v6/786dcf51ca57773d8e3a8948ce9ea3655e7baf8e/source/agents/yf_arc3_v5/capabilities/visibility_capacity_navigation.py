"""Separate visibility, retained terrain, operation capacity and action reserve.

Native calculations retain observation waypoints and immutable room states;
Source/DRM owns operation selection, interpretation and action release.
"""
from fractions import Fraction
from collections import deque
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from agents.yf_arc3_v5.logos.types import immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields, with_implementation_debt
from .mutable_kit_survival import KitEventTrace as CapacityEventTrace
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as translated_layers


class ActionReserve(FrozenModel):
    minimum: str
    maximum: str
    capacity: str | None = None
    @model_validator(mode='after')
    def bounds(self):
        lo,hi=Fraction(self.minimum),Fraction(self.maximum)
        if lo<0 or lo>hi:raise ValueError('ordered nonnegative action reserve')
        if self.capacity is not None and hi>Fraction(self.capacity):raise ValueError('reserve inside declared clipping capacity')
        return self


class VisibilityCell(FrozenModel):
    cell_ref: Ref
    x: int
    y: int
    room_ref: Ref
    terrain: Literal['FLOOR','WALL','CONTROL','DOOR','REFILL','DESTINATION','UNKNOWN']
    visible: bool
    remembered: bool
    terrain_evidence_ref: Ref | None = None
    observation_revision_ref: Ref | None = None
    control_cell_support: Literal['FLOOR','WALL','UNKNOWN'] = 'UNKNOWN'


class CapacityLight(FrozenModel):
    light_ref: Ref
    room_ref: Ref
    on: bool
    reserved_units: int = Field(ge=0,le=65536)


class CapacityDoor(FrozenModel):
    door_ref: Ref
    cell_ref: Ref
    open: bool
    reserved_units: int = Field(ge=0,le=65536)


class ContactControl(FrozenModel):
    control_ref: Ref
    cell_ref: Ref
    target_ref: Ref
    target_kind: Literal['LIGHT','DOOR']
    contact_vectors: tuple[tuple[int,int],...] = Field(max_length=32)
    hit_support_refs: tuple[Ref,...] = Field(max_length=128)
    contact_law_evidence_ref: Ref | None = None
    contact_pose: Literal['STAY','ENTER','UNKNOWN']


class CapacityRefill(FrozenModel):
    refill_ref: Ref
    cell_ref: Ref
    unused: bool
    gross_minimum: str
    gross_maximum: str
    evidence_ref: Ref | None = None
    @model_validator(mode='after')
    def gross_interval(self):
        if Fraction(self.gross_minimum)<0 or Fraction(self.gross_minimum)>Fraction(self.gross_maximum):raise ValueError('ordered nonnegative refill interval')
        return self


class CapacityRoomState(FrozenModel):
    actor_x: int
    actor_y: int
    current_room_ref: Ref
    terrain: tuple[VisibilityCell,...] = Field(max_length=4096)
    lights: tuple[CapacityLight,...] = Field(max_length=256)
    doors: tuple[CapacityDoor,...] = Field(max_length=256)
    controls: tuple[ContactControl,...] = Field(max_length=256)
    refills: tuple[CapacityRefill,...] = Field(max_length=256)
    capacity_total: int = Field(ge=0,le=65536)
    action_reserve: ActionReserve
    destination_ref: Ref
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def identities(self):
        for rows,field in ((self.terrain,'cell_ref'),(self.lights,'light_ref'),(self.doors,'door_ref'),(self.controls,'control_ref'),(self.refills,'refill_ref')):
            if len({getattr(row,field) for row in rows})!=len(rows):raise ValueError('distinct current object references')
        if len({(c.x,c.y) for c in self.terrain})!=len(self.terrain):raise ValueError('one current terrain alternative per logical cell')
        if sum(light.reserved_units for light in self.lights)+sum(door.reserved_units for door in self.doors)>self.capacity_total:raise ValueError('reservations inside total supplied capacity')
        return self


class ReserveEvent(FrozenModel):
    event_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    kind: Literal['DEBIT','REFILL','DISPLAY']
    minimum: str
    maximum: str
    refill_ref: Ref | None = None
    evidence_ref: Ref
    @model_validator(mode='after')
    def interval(self):
        if Fraction(self.minimum)<0 or Fraction(self.minimum)>Fraction(self.maximum):raise ValueError('ordered nonnegative declared reserve effect')
        if self.kind=='REFILL' and self.refill_ref is None:raise ValueError('refill occurrence identity is retained')
        return self


class CapacityToggleLaw(FrozenModel):
    target_ref: Ref
    target_kind: Literal['LIGHT','DOOR']
    on_free_requirement: int = Field(ge=0,le=65536)
    off_free_requirement: int = Field(ge=0,le=65536)
    on_reserved_units: int = Field(ge=0,le=65536)
    off_reserved_units: int = Field(ge=0,le=65536)
    permission_basis: Literal['BEFORE_RELEASE','AFTER_RELEASE']
    evidence_ref: Ref | None = None


class RoomCommand(FrozenModel):
    command_ref: Ref
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    dx: int
    dy: int
    cost_minimum: str
    cost_maximum: str
    cost_evidence_ref: Ref | None = None
    @model_validator(mode='after')
    def command(self):
        if self.dx==self.dy==0:raise ValueError('directional contact/motion command has a displacement vector')
        if Fraction(self.cost_minimum)<0 or Fraction(self.cost_minimum)>Fraction(self.cost_maximum):raise ValueError('ordered nonnegative primitive cost')
        return self


class CapacityRoomModel(FrozenModel):
    model_ref: Ref
    commands: tuple[RoomCommand,...] = Field(default=(),max_length=32)
    toggle_laws: tuple[CapacityToggleLaw,...] = Field(default=(),max_length=256)
    operation_order: tuple[Literal['DEBIT','CONTACT_OR_MOVE','REFILL','DESTINATION','EXHAUSTION'],...] = Field(default=(),max_length=5)
    outside_board: Literal['BLOCK','UNKNOWN'] = 'UNKNOWN'
    failure: Literal['LOCAL_STOP','GAME_OVER','RESTORE_DECLARED','UNKNOWN'] = 'UNKNOWN'
    restore_state: CapacityRoomState | None = None
    contact_priority: Literal['CONTROL_BEFORE_TERRAIN','TERRAIN_BEFORE_CONTROL','UNKNOWN'] = 'UNKNOWN'
    refill_trigger: Literal['OCCUPANCY_PHASE','ON_ENTRY','UNKNOWN'] = 'UNKNOWN'
    @model_validator(mode='after')
    def domain(self):
        if self.operation_order and (len(self.operation_order)!=5 or len(set(self.operation_order))!=5):raise ValueError('each owned room-step phase occurs once in declared order')
        if len({c.command_ref for c in self.commands})!=len(self.commands):raise ValueError('distinct primitive command mappings')
        if len({(l.target_kind,l.target_ref) for l in self.toggle_laws})!=len(self.toggle_laws):raise ValueError('one supplied law per current target')
        return self


class CapacityObservation(FrozenModel):
    observation_ref: Ref
    before: CapacityRoomState
    after: CapacityRoomState
    command_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    trace: CapacityEventTrace | None = None


class CapacityContactEvent(FrozenModel):
    event_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    model_revision_ref: Ref
    model_status_ref: Ref
    control_ref: Ref
    actor_x: int
    actor_y: int
    dx: int
    dy: int


class CapacityLayerTemplate(ContactLayerTemplate):
    component: Literal['ROOM','DOOR','CONTACT_CONTROL','ILLUMINATION','ACTION_GAUGE','CAPACITY_GAUGE','UNKNOWN']
    room_candidate_ref: Ref | None = None
    control_candidate_ref: Ref | None = None


class CapacityRoomRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.visibility_capacity_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=256)
    maximum_witnesses: int = Field(default=3,ge=1,le=3)
    state: CapacityRoomState | None = None
    initial_reserve: ActionReserve | None = None
    reserve_events: tuple[ReserveEvent,...] = Field(default=(),max_length=1024)
    models: tuple[CapacityRoomModel,...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    command_ref: Ref | None = None
    control_ref: Ref | None = None
    contact_event: CapacityContactEvent | None = None
    revealed_cells: tuple[VisibilityCell,...] = Field(default=(),max_length=4096)
    observations: tuple[CapacityObservation,...] = Field(default=(),max_length=256)
    route_question_cell_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    consumer_ref: Ref | None = None
    expected_state: CapacityRoomState | None = None
    actual_state: CapacityRoomState | None = None
    expected_trace: CapacityEventTrace | None = None
    actual_trace: CapacityEventTrace | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[CapacityLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    @model_validator(mode='after')
    def domain(self):
        if len({m.model_ref for m in self.models})!=len(self.models):raise ValueError('bound model references identify distinct hypotheses')
        if len({t.template_ref for t in self.layer_templates})!=len(self.layer_templates):raise ValueError('distinct physical templates')
        if len({c.cell_ref for c in self.revealed_cells})!=len(self.revealed_cells):raise ValueError('distinct revealed cell identities')
        if len({e.event_ref for e in self.reserve_events})!=len(self.reserve_events):raise ValueError('an owned reserve event is propagated only once')
        return self


OPERATION_MODES={'room_control_measurement':'MEASURE','capacity_operation_fit':'FIT','remembered_dark_map':'UPDATE','contact_support_domain':'PRECONDITION',
    'capacity_toggle':'STEP_INTERNAL','room_step':'STEP','reveal_release_service':'INVERSE_DOMAIN','capacity_route_domain':'DOMAIN','reserve_intervals':'PROPAGATE','visibility_access_compare':'COMPARE'}


def _free_capacity(state):
    return state.capacity_total-sum(l.reserved_units for l in state.lights)-sum(d.reserved_units for d in state.doors)


def _cell(state,x,y):return next((c for c in state.terrain if (c.x,c.y)==(x,y)),None)


def _context_work(state,model):
    return 5*len(state.terrain)+6*(len(state.lights)+len(state.doors)+len(state.controls)+len(state.refills))+len(model.commands)+len(model.toggle_laws)


def _traversability(state,cell):
    if cell is None:return 'OUTSIDE'
    if cell.terrain=='UNKNOWN' or cell.terrain_evidence_ref is None:return 'UNKNOWN'
    if cell.terrain=='WALL':return 'BLOCK'
    if cell.terrain=='CONTROL':return 'MOVE' if cell.control_cell_support=='FLOOR' else 'BLOCK' if cell.control_cell_support=='WALL' else 'UNKNOWN'
    if cell.terrain=='DOOR':
        door=next((d for d in state.doors if d.cell_ref==cell.cell_ref),None)
        return 'UNKNOWN' if door is None else 'MOVE' if door.open else 'BLOCK'
    return 'MOVE'


def _toggle(state,model,control_ref,maximum,allow_hypothetical=False):
    work=_context_work(state,model)
    if work>maximum:return state,(),(),0,{'phase':'capacity_toggle_context'}
    control=next((c for c in state.controls if c.control_ref==control_ref),None)
    if control is None:return state,(),('current_addressed_contact_control',),work,{}
    law=next((l for l in model.toggle_laws if (l.target_kind,l.target_ref)==(control.target_kind,control.target_ref)),None)
    if law is None or law.evidence_ref is None and not allow_hypothetical:return state,(),('supported_current_capacity_operation_law',),work,{}
    target=next((t for t in (state.lights if control.target_kind=='LIGHT' else state.doors) if (t.light_ref if control.target_kind=='LIGHT' else t.door_ref)==control.target_ref),None)
    if target is None:return state,(),('current_light_or_door_target',),work,{}
    on=target.on if control.target_kind=='LIGHT' else target.open;new_on=not on
    expected_old=law.on_reserved_units if on else law.off_reserved_units
    if target.reserved_units!=expected_old:return state,(),('capacity_law_matches_current_reservation',),work,{}
    free=_free_capacity(state);requirement=law.on_free_requirement if new_on else law.off_free_requirement;new_reserved=law.on_reserved_units if new_on else law.off_reserved_units
    permission_free=free if law.permission_basis=='BEFORE_RELEASE' else free+target.reserved_units
    eligible=permission_free>=requirement and free+target.reserved_units>=new_reserved
    if not eligible:return state,({'kind':'CAPACITY_PERMISSION_REFUSED','control_ref':control_ref,'target_ref':control.target_ref,'free_capacity':free,'required_free':requirement,'permission_basis':law.permission_basis,'door_traversability_inferred_from_permission':False},),(),work,{}
    field='on' if control.target_kind=='LIGHT' else 'open';changed=target.model_copy(update={field:new_on,'reserved_units':new_reserved});current=state
    if control.target_kind=='LIGHT':
        lights=tuple(changed if l.light_ref==target.light_ref else l for l in state.lights);room_visible=any(l.on and l.room_ref==target.room_ref for l in lights);cells=tuple(c.model_copy(update={'visible':room_visible,'remembered':c.remembered or c.terrain!='UNKNOWN' and c.terrain_evidence_ref is not None}) if c.room_ref==target.room_ref else c for c in state.terrain)
        current=state.model_copy(update={'lights':lights,'terrain':cells})
    else:current=state.model_copy(update={'doors':tuple(changed if d.door_ref==target.door_ref else d for d in state.doors)})
    previous_visibility={c.cell_ref:c.visible for c in state.terrain};newly_unknown=tuple(c.cell_ref for c in current.terrain if c.visible and c.terrain=='UNKNOWN' and not previous_visibility.get(c.cell_ref,False))
    event={'kind':'CAPACITY_TOGGLE','control_ref':control_ref,'target_ref':control.target_ref,'target_kind':control.target_kind,'before_on':on,'after_on':new_on,'before_free_capacity':free,'after_free_capacity':_free_capacity(current),
        'before_reserved_units':target.reserved_units,'after_reserved_units':new_reserved,'newly_visible_unknown_cell_refs':newly_unknown,'actor_pose_changed':False,'learned_terrain_erased':False}
    return current,(event,),(),work,{}


def _dark_map(request):
    state=request.state;work=3*len(state.terrain)+4*len(request.revealed_cells)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'remembered_terrain_patch'})
    cells={c.cell_ref:c for c in state.terrain};points={(c.x,c.y):c.cell_ref for c in state.terrain};conflicts=[];unknown=[]
    for cell in request.revealed_cells:
        previous=cells.get(cell.cell_ref);other=points.get((cell.x,cell.y))
        if other is not None and other!=cell.cell_ref or previous is not None and (previous.x,previous.y)!=(cell.x,cell.y):conflicts.append({'current_cell':cell,'previous':previous,'other_ref':other});continue
        if cell.terrain=='UNKNOWN':
            if previous is not None:cells[cell.cell_ref]=previous.model_copy(update={'visible':cell.visible,'remembered':previous.remembered or previous.terrain!='UNKNOWN' and previous.terrain_evidence_ref is not None})
            else:cells[cell.cell_ref]=cell;points[(cell.x,cell.y)]=cell.cell_ref
            continue
        if not cell.visible or cell.terrain_evidence_ref is None or cell.observation_revision_ref!=request.scope.evidence_revision_ref:unknown.append(cell.cell_ref);continue
        if previous is not None and previous.terrain!='UNKNOWN' and previous.terrain!=cell.terrain:conflicts.append({'current_cell':cell,'previous':previous,'reason':'current_terrain_contradicts_retained_role'});continue
        cells[cell.cell_ref]=cell.model_copy(update={'remembered':True});points[(cell.x,cell.y)]=cell.cell_ref
    updated=state.model_copy(update={'terrain':tuple(cells[ref] for ref in sorted(cells))})
    return family_result(request,values={'after_state':updated,'retained_known_terrain':tuple(c for c in updated.terrain if c.terrain!='UNKNOWN'),'unknown_current_cells':tuple(c.cell_ref for c in updated.terrain if c.terrain=='UNKNOWN'),
        'geometry_or_terrain_contradictions':conflicts,'unqualified_revealed_cells':unknown,'black_pixels_classify_walls':False,'canonical_map_written':False},
        prerequisite_refs=('resolve_current_map_contradictions',) if conflicts else ('current_revealed_terrain_provenance',) if unknown else (),examined_count=work,domain_complete=not conflicts and not unknown)


def _step(state,model,command,maximum,allow_hypothetical=False):
    if not model.operation_order:return state,(),('declared_room_step_operation_order',),0,{}
    count=_context_work(state,model)
    if count+len(model.operation_order)>maximum:return state,(),(),0,{'phase':'room_step_context','command_ref':command.command_ref}
    if state.status!='ACTIVE':return state,(),('current_active_room_scope',),count,{}
    if command.cost_evidence_ref is None and not allow_hypothetical:return state,(),('supported_directional_command_cost',),count,{}
    current=state;events=[];new_unknown=[];restored=False
    for phase in model.operation_order:
        count+=1
        if current.status!='ACTIVE' or restored:break
        if phase=='DEBIT':
            reserve=current.action_reserve;lo,hi=Fraction(reserve.minimum),Fraction(reserve.maximum);minimum,maximum_cost=Fraction(command.cost_minimum),Fraction(command.cost_maximum)
            if hi<minimum:return current,tuple(events),('funded_directional_command',),count,{}
            if lo<maximum_cost:return current,tuple(events),('unambiguous_directional_command_funding',),count,{}
            after=reserve.model_copy(update={'minimum':str(lo-maximum_cost),'maximum':str(hi-minimum)});current=current.model_copy(update={'action_reserve':after});events.append({'kind':'DIRECTIONAL_DEBIT','command_ref':command.command_ref,'before':reserve,'after':after,'cost_interval':(command.cost_minimum,command.cost_maximum)})
        elif phase=='CONTACT_OR_MOVE':
            cell=_cell(current,current.actor_x+command.dx,current.actor_y+command.dy);terrain=_traversability(current,cell)
            if terrain=='OUTSIDE':
                if model.outside_board=='UNKNOWN':return current,tuple(events),('current_outside_board_movement_law',),count,{}
                events.append({'kind':'OUTSIDE_BLOCKED','command_ref':command.command_ref});continue
            if model.contact_priority=='TERRAIN_BEFORE_CONTROL' and terrain=='BLOCK':events.append({'kind':'TERRAIN_BLOCKED','cell_ref':cell.cell_ref});continue
            controls=tuple(c for c in current.controls if c.cell_ref==cell.cell_ref)
            if controls and model.contact_priority=='UNKNOWN':return current,tuple(events),('current_contact_terrain_priority',),count,{}
            if controls:
                support=_cell(current,current.actor_x,current.actor_y)
                if any(c.contact_law_evidence_ref is None for c in controls) and not allow_hypothetical:return current,tuple(events),('current_contact_hit_and_approach_law',),count,{}
                matching=tuple(c for c in controls if (command.dx,command.dy) in c.contact_vectors and support is not None and support.cell_ref in c.hit_support_refs)
                if not matching:events.append({'kind':'CONTACT_MISS','control_refs':tuple(c.control_ref for c in controls),'command_ref':command.command_ref});continue
                if len(matching)>1:return current,tuple(events),('owned_simultaneous_contact_dispatch_law',),count,{}
                controls=matching
                control=controls[0];support=_cell(current,current.actor_x,current.actor_y)
                if control.contact_law_evidence_ref is None and not allow_hypothetical:return current,tuple(events),('current_contact_hit_and_approach_law',),count,{}
                hits=(command.dx,command.dy) in control.contact_vectors and support is not None and support.cell_ref in control.hit_support_refs
                if not hits:events.append({'kind':'CONTACT_MISS','control_ref':control.control_ref,'command_ref':command.command_ref});continue
                if control.contact_pose=='UNKNOWN':return current,tuple(events),('current_contact_pose_law',),count,{}
                if control.contact_pose=='ENTER' and terrain!='MOVE':return current,tuple(events),('supported_contact_entry_terrain',),count,{}
                after,trace,debt,work,cut=_toggle(current,model,control.control_ref,maximum-count,allow_hypothetical);count+=work;events.extend(trace);current=after
                if debt or cut:return current,tuple(events),debt,count,cut
                toggled=any(e.get('kind')=='CAPACITY_TOGGLE' for e in trace)
                new_unknown.extend(ref for e in trace for ref in e.get('newly_visible_unknown_cell_refs',()))
                if toggled and control.contact_pose=='ENTER':current=current.model_copy(update={'actor_x':cell.x,'actor_y':cell.y,'current_room_ref':cell.room_ref})
            elif terrain=='UNKNOWN':return current,tuple(events),('observe_or_bind_current_terrain.'+cell.cell_ref,),count,{}
            elif terrain=='BLOCK':events.append({'kind':'TERRAIN_BLOCKED','cell_ref':cell.cell_ref})
            else:
                before=(current.actor_x,current.actor_y);current=current.model_copy(update={'actor_x':cell.x,'actor_y':cell.y,'current_room_ref':cell.room_ref});events.append({'kind':'ROOM_MOVE','before':before,'after':(cell.x,cell.y),'cell_ref':cell.cell_ref})
        elif phase=='REFILL':
            cell=_cell(current,current.actor_x,current.actor_y);eligible=tuple(r for r in current.refills if r.unused and cell is not None and r.cell_ref==cell.cell_ref)
            if len(eligible)>1:return current,tuple(events),('ordered_refill_occurrences_at_current_pose',),count,{}
            if not eligible:continue
            if model.refill_trigger=='UNKNOWN':return current,tuple(events),('current_refill_trigger_law',),count,{}
            if model.refill_trigger=='ON_ENTRY' and (current.actor_x,current.actor_y)==(state.actor_x,state.actor_y):continue
            refill=eligible[0]
            if refill.evidence_ref is None and not allow_hypothetical:return current,tuple(events),('supported_current_gross_refill',),count,{}
            reserve=current.action_reserve;lo,hi=Fraction(reserve.minimum)+Fraction(refill.gross_minimum),Fraction(reserve.maximum)+Fraction(refill.gross_maximum)
            if reserve.capacity is not None:cap=Fraction(reserve.capacity);lo=min(cap,lo);hi=min(cap,hi)
            after=reserve.model_copy(update={'minimum':str(lo),'maximum':str(hi)});current=current.model_copy(update={'action_reserve':after,'refills':tuple(r.model_copy(update={'unused':False}) if r.refill_ref==refill.refill_ref else r for r in current.refills)});events.append({'kind':'REFILL_USED','refill_ref':refill.refill_ref,'gross_interval':(refill.gross_minimum,refill.gross_maximum),'before':reserve,'after':after})
        elif phase=='DESTINATION':
            cell=_cell(current,current.actor_x,current.actor_y)
            if cell is not None and cell.cell_ref==current.destination_ref:current=current.model_copy(update={'status':'WIN'});events.append({'kind':'DESTINATION_ACCEPTED','cell_ref':cell.cell_ref})
        else:
            reserve=current.action_reserve;lo,hi=Fraction(reserve.minimum),Fraction(reserve.maximum)
            if lo<=0<hi:return current,tuple(events),('unambiguous_empty_action_reserve_check',),count,{}
            if hi>0:continue
            if model.failure=='UNKNOWN':return current,tuple(events),('current_empty_budget_lifecycle',),count,{}
            if model.failure=='RESTORE_DECLARED':
                if model.restore_state is None:return current,tuple(events),('declared_room_restore_scope',),count,{}
                current=model.restore_state;restored=True
            else:current=current.model_copy(update={'status':model.failure})
            events.append({'kind':'EMPTY_RESERVE_LIFECYCLE','lifecycle':model.failure,'after':current,'restoration':restored})
    events.append({'kind':'ROOM_STEP_SEALED','command_ref':command.command_ref,'before':state,'after':current,'observation_boundary_cell_refs':tuple(dict.fromkeys(new_unknown))})
    return current,tuple(events),(),count,{}




def _reserve_intervals(request):
    initial=request.initial_reserve;lo=Fraction(initial.minimum);hi=Fraction(initial.maximum);initial_lo=lo;initial_hi=hi;net_lower_state=hi;net_upper_state=lo;capacity=None if initial.capacity is None else Fraction(initial.capacity);events=[];used=set();debt=();cut={};first_unfunded=None;count=0
    for index,event in enumerate(request.reserve_events):
        if count>=request.maximum_evaluations:cut={'phase':'reserve_events','next_event_index':index,'after_prefix_interval':(str(lo),str(hi))};break
        count+=1
        if event.event_owner_ref!=request.scope.event_owner_ref or event.epoch!=request.scope.epoch:debt=('current_owned_reserve_event',);break
        minimum,maximum=Fraction(event.minimum),Fraction(event.maximum);before=(lo,hi)
        if event.kind=='DEBIT':
            if hi<minimum:first_unfunded=event.event_ref;break
            if lo<maximum:debt=('unambiguous_funding_for_reserve_event.'+event.event_ref,);break
            lo-=maximum;hi-=minimum
            net_lower_state-=maximum;net_upper_state-=minimum
            details={'known_debit':(str(minimum),str(maximum))}
        elif event.kind=='REFILL':
            if event.refill_ref in used:debt=('unused_refill_occurrence.'+event.refill_ref,);break
            used.add(event.refill_ref);lo+=minimum;hi+=maximum
            net_lower_state+=minimum;net_upper_state+=maximum
            if capacity is not None:lo=min(capacity,lo);hi=min(capacity,hi)
            if capacity is not None:net_lower_state=min(capacity,net_lower_state);net_upper_state=min(capacity,net_upper_state)
            gain_min=minimum if capacity is None else min(minimum,max(Fraction(0),capacity-before[1]));gain_max=maximum if capacity is None else min(maximum,max(Fraction(0),capacity-before[0]))
            details={'gross_refill':(str(minimum),str(maximum)),'net_refill_event_gain':(str(gain_min),str(gain_max)),'refill_ref':event.refill_ref}
        else:
            lo=max(lo,minimum);hi=min(hi,maximum)
            if lo>hi:debt=('reserve_display_contradicts_owned_effect_history',);lo,hi=before;break
            details={'display_interval':(str(minimum),str(maximum)),'unchanged_pixels_prove_free_action':False}
        events.append({'event_ref':event.event_ref,'kind':event.kind,'before':tuple(str(x) for x in before),'after':(str(lo),str(hi)),'cumulative_net_change_bounds':(str(net_lower_state-initial_hi),str(net_upper_state-initial_lo)),**details})
    return family_result(request,values={'after_reserve':ActionReserve(minimum=str(lo),maximum=str(hi),capacity=initial.capacity),'owned_reserve_events':events,'used_refill_refs':tuple(sorted(used)),
        'first_unfunded_event_ref':first_unfunded,'first_uncertain_event_index':len(events) if debt else None,'net_change_bounds':(str(net_lower_state-initial_hi),str(net_upper_state-initial_lo)),'net_change_retains_initial_quantity_correlation':True,'display_intersection_may_further_tighten_net_bounds':True,'net_gain_is_gross_refill':False},prerequisite_refs=debt,examined_count=count,domain_complete=not debt and not cut,
        computation_bound_reached=bool(cut),frontier=cut)


def _capacity_signature(state,include_reserve=True):
    reserve=(Fraction(state.action_reserve.minimum),Fraction(state.action_reserve.maximum),None if state.action_reserve.capacity is None else Fraction(state.action_reserve.capacity)) if include_reserve else None
    return (state.actor_x,state.actor_y,state.current_room_ref,{l.light_ref:(l.on,l.reserved_units) for l in state.lights},{d.door_ref:(d.open,d.reserved_units,d.cell_ref) for d in state.doors},state.capacity_total,reserve,{r.refill_ref:r.unused for r in state.refills},state.status,state.level_scope_ref,state.restore_epoch)


def _fit(request):
    compatible=[];refuted=[];unknown=[];count=0;cuts=[]
    for model_index,model in enumerate(request.models):
        supports=[];bad=[];missing=[]
        for observation in request.observations:
            if not observation.sealed or observation.event_owner_ref!=request.scope.event_owner_ref or observation.epoch!=request.scope.epoch:missing.append((observation.observation_ref,'current_owned_capacity_observation'));continue
            command=next((c for c in model.commands if c.command_ref==observation.command_ref),None)
            if command is None:missing.append((observation.observation_ref,'observed_command_mapping'));continue
            after,events,debt,work,cut=_step(observation.before,model,command,request.maximum_evaluations-count,True);count+=work
            if cut:cuts.append({'phase':'capacity_operation_fit','model_index':model_index,'observation_ref':observation.observation_ref,**cut});break
            if debt:missing.append((observation.observation_ref,debt));continue
            trace=observation.trace
            if trace is not None and (not trace.sealed or trace.event_owner_ref!=request.scope.event_owner_ref or trace.epoch!=request.scope.epoch or trace.input_ref!=command.input_ref or trace.evidence_revision_ref!=request.scope.evidence_revision_ref or trace.model_revision_ref!=request.scope.model_revision_ref):missing.append((observation.observation_ref,'current_owned_capacity_trace'));continue
            reserve_disjoint=Fraction(after.action_reserve.maximum)<Fraction(observation.after.action_reserve.minimum) or Fraction(observation.after.action_reserve.maximum)<Fraction(after.action_reserve.minimum)
            if _capacity_signature(after,False)!=_capacity_signature(observation.after,False) or reserve_disjoint or trace is not None and immutable_json_data(events)!=trace.events:bad.append(observation.observation_ref)
            else:supports.append({'observation_ref':observation.observation_ref,'owned_events':events})
        if cuts:break
        if bad:refuted.append({'model_ref':model.model_ref,'falsifiers':bad})
        elif supports:compatible.append({'model':model,'supported_capacity_operations':supports,'unknown_observations':missing})
        else:unknown.append({'model_ref':model.model_ref,'missing_refs':missing or ('current_capacity_operation_observation',)})
    return family_result(request,values={'scoped_capacity_laws':compatible,'refuted_models':refuted,'unknown_models':unknown,'door_permission_is_persistent_reservation':False},
        examined_count=count,domain_complete=not cuts and not unknown and not any(row['unknown_observations'] for row in compatible),computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _capacity_route_word_d(parents,index,remaining,final_edge=None):
    word=[];work=0
    while parents[index] is not None:
        parent,edge=parents[index]
        work+=1+len(edge['owned_events'])
        if work>remaining:return None,work
        word.append(edge);index=parent
    word.reverse()
    if final_edge is not None:
        work+=1+len(final_edge['owned_events'])
        if work>remaining:return None,work
        word.append(final_edge)
    return tuple(word),work


def _route_graph(request,model,purpose='DESTINATION',rooms=(),release_capacity=None,native_receipt=False,materialize_words=True):
    nodes=[request.state];parents=[None];depths=[0];seen={request.state:0};queue=deque([0]);edges=[];goals=[];boundaries=[];cuts=[];count=0;witnesses=0
    addressed=next((c for c in request.state.controls if c.control_ref==request.control_ref),None) if purpose=='CONTACT' else None
    if purpose=='CONTACT' and (addressed is None or addressed.contact_law_evidence_ref is None):return family_result(request,prerequisite_refs=('current_addressed_contact_hit_law',),domain_complete=False)

    def retain(target,row,index,final_edge=None):
        nonlocal count,witnesses
        if witnesses>=request.maximum_witnesses:
            cuts.append({'node':index,'phase':'room_global_witness_bound'})
            return False
        if materialize_words:
            word,work=_capacity_route_word_d(parents,index,request.maximum_evaluations-count,final_edge)
            if word is None:
                cuts.append({'node':index,'phase':'room_word_reconstruction_bound'})
                return False
            count+=work;row['external_script']=word
        else:row['external_script']=()
        row['external_word_materialized']=materialize_words
        target.append(row);witnesses+=1
        return True

    while queue:
        index=queue.popleft();state=nodes[index]
        achieved=state.status=='WIN' if purpose=='DESTINATION' else all(any(l.on and l.room_ref==room for l in state.lights) for room in rooms) if purpose=='REVEAL' else all(not l.on for l in state.lights if l.room_ref in rooms) and (release_capacity is None or _free_capacity(state)>=release_capacity) if purpose=='RELEASE' else False
        if achieved:
            retain(goals,{'node':index,'after_state':state,'free_capacity':_free_capacity(state)},index)
            if cuts:break
            continue
        if state.status!='ACTIVE':continue
        if depths[index]>=request.maximum_depth:cuts.append({'node':index,'phase':'room_route_depth'});continue
        for command_index,command in enumerate(model.commands):
            before_cell=_cell(state,state.actor_x,state.actor_y);target_cell=_cell(state,state.actor_x+command.dx,state.actor_y+command.dy)
            after,events,debt,work,cut=_step(state,model,command,request.maximum_evaluations-count);count+=work
            script={'command':command,'owned_events':events,'primitive_cost_interval':next((e['cost_interval'] for e in events if e.get('kind')=='DIRECTIONAL_DEBIT'),('0','0'))}
            if cut:cuts.append({'node':index,'next_command_index':command_index,**cut});queue.clear();break
            if purpose=='CONTACT' and before_cell is not None and target_cell is not None and target_cell.cell_ref==addressed.cell_ref and before_cell.cell_ref in addressed.hit_support_refs and (command.dx,command.dy) in addressed.contact_vectors:
                retain(goals,{'node':index,'support_cell':before_cell,'before_contact_state':state,'after_state':after,
                    'toggle_eligible':any(e.get('kind')=='CAPACITY_TOGGLE' and e.get('control_ref')==addressed.control_ref for e in events),'capacity_and_resource_prerequisites':debt},index,script)
                if cuts:queue.clear();break
            if debt:
                retain(boundaries,{'node':index,'command':command,'after_prefix_state':after,'owned_events':events,'missing_refs':debt,
                    'probe_released':False,'route_after_unknown_authorized':False},index)
                if cuts:queue.clear();break
                continue
            restore=any(e.get('restoration') for e in events)
            if restore or (after.level_scope_ref,after.restore_epoch)!=(state.level_scope_ref,state.restore_epoch):boundaries.append({'node':index,'command':command,'after_prefix_state':after,'reason':'qualify_restored_room_scope'});continue
            newly_unknown=tuple(ref for e in events for ref in e.get('observation_boundary_cell_refs',()))
            if newly_unknown:
                boundary={'node':index,'command':command,'after_prefix_state':after,'observation_cell_refs':newly_unknown,'reason':'observe_revealed_layout_before_post_reveal_route'}
                retained=retain(boundaries,boundary,index,script)
                if cuts:queue.clear();break
                if retained and purpose=='REVEAL' and all(any(l.on and l.room_ref==room for l in after.lights) for room in rooms):
                    goals.append({'node':index,'external_script':boundary['external_script'],'external_word_materialized':materialize_words,
                        'after_state':after,'observation_cell_refs':newly_unknown,'free_capacity':_free_capacity(after)})
                continue
            child=seen.get(after)
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'node':index,'next_command_index':command_index,'phase':'room_route_states'});continue
                child=len(nodes);seen[after]=child;nodes.append(after);parents.append((index,script));depths.append(depths[index]+1);queue.append(child)
            edges.append({'from_node':index,'to_node':child,'command_ref':command.command_ref,'owned_events':events})
    receipt=dict(values={'complete_room_capacity_states':nodes,'owned_command_edges':edges,'goal_services_or_routes':goals,'observation_boundaries':boundaries,
        'external_witness_count':witnesses if materialize_words else 0,'rejected_executable_word_bank_retained':False,
        'declared_domain_exhausted':not goals and not cuts and not boundaries,'minimum_cost_proved':False,'unknown_post_reveal_layout_precommitted':False,'action_release':False},
        examined_count=count,domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'pending_nodes':tuple(queue)} if cuts else {})
    return receipt if native_receipt else family_result(request,**receipt)


def _reveal_service(request,model):
    cells={c.cell_ref:c for c in request.state.terrain};missing_refs=tuple(ref for ref in request.route_question_cell_refs if ref not in cells)
    if missing_refs:return family_result(request,values={'missing_question_cell_refs':missing_refs},prerequisite_refs=('current_named_route_question_partition',),domain_complete=False)
    rooms=tuple(sorted({cells[ref].room_ref for ref in request.route_question_cell_refs if cells[ref].terrain=='UNKNOWN'}))
    if not rooms:return family_result(request,values={'consumer_ref':request.consumer_ref,'service_unnecessary_known_question_cells':request.route_question_cell_refs,'staged_services':()})
    reveal=_route_graph(request,model,'REVEAL',rooms,native_receipt=True);count=reveal['examined_count'];services=[];pending=[]
    for index,candidate in enumerate(reveal['values'].get('goal_services_or_routes',())):
        after=candidate['after_state']
        if count>=request.maximum_evaluations:pending.append({'next_service_index':index,'reason':'remaining_release_work_bound'});break
        release_request=request.model_copy(update={'state':after,'maximum_evaluations':request.maximum_evaluations-count})
        release=_route_graph(release_request,model,'RELEASE',rooms,_free_capacity(request.state),True,False);count+=release['examined_count']
        services.append({'consumer_ref':request.consumer_ref,'question_cell_refs':request.route_question_cell_refs,'reveal_room_refs':rooms,'reveal_script':candidate['external_script'],'after_reveal_state':after,
            'observation_required_cell_refs':tuple(ref for ref in request.route_question_cell_refs if cells[ref].terrain=='UNKNOWN'),'release_services_under_retained_terrain':release['values'].get('goal_services_or_routes',()),
            'release_observation_boundaries':release['values'].get('observation_boundaries',()),'release_domain_complete':release['domain_complete'],'release_frontier':release['frontier'],
            'release_premises_revalidate_after_observation':True,'information_not_discarded_by_extinction':True,'post_reveal_unknown_route_authorized':False})
    return family_result(request,values={'staged_information_capacity_services':services,'reveal_observation_boundaries':reveal['values'].get('observation_boundaries',()),'service_prefix_feasible':bool(services),'consumer_ref':request.consumer_ref,'light_every_room_required':False,'actual_action_release':False},
        examined_count=count,domain_complete=reveal['domain_complete'] and not pending and all(s['release_domain_complete'] for s in services),computation_bound_reached=reveal['computation_bound_reached'] or bool(pending),
        frontier={'reveal_frontier':reveal['frontier'],'pending_services':pending} if reveal['frontier'] or pending else {})


def _compare(request):
    a=request.expected_state;b=request.actual_state;expected=request.expected_trace;actual=request.actual_trace;count=len(a.terrain)+len(b.terrain)+len(a.lights)+len(b.lights)+len(a.doors)+len(b.doors);first=None;cut={}
    if count>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'visibility_access_population_compare'})
    current=expected is not None and actual is not None and expected.sealed and actual.sealed and expected.event_owner_ref==actual.event_owner_ref==request.scope.event_owner_ref and expected.epoch==actual.epoch==request.scope.epoch and expected.input_ref==actual.input_ref and expected.evidence_revision_ref==actual.evidence_revision_ref==request.scope.evidence_revision_ref and expected.model_revision_ref==actual.model_revision_ref==request.scope.model_revision_ref
    if current:
        for index in range(max(len(expected.events),len(actual.events))):
            if count>=request.maximum_evaluations:cut={'phase':'capacity_owned_events','next_event_index':index};break
            count+=1;x=expected.events[index] if index<len(expected.events) else None;y=actual.events[index] if index<len(actual.events) else None
            if x!=y:first={'event_index':index,'expected':x,'actual':y};break
    ac={c.cell_ref:c for c in a.terrain};bc={c.cell_ref:c for c in b.terrain};visibility=tuple({'cell_ref':ref,'before':ac.get(ref),'after':bc.get(ref)} for ref in sorted(set(ac)|set(bc)) if ac.get(ref)!=bc.get(ref))
    return family_result(request,values={'first_visibility_permission_access_or_recovery_event_difference':first,'visibility_and_retained_map_differences':visibility,'pose_capacity_access_or_reserve_mismatch':_capacity_signature(a)!=_capacity_signature(b),
        'expected_free_capacity':_free_capacity(a),'actual_free_capacity':_free_capacity(b),'refill_differences':a.refills!=b.refills,'inaccessible_flag_collapses_visibility_access_permission':False},
        prerequisite_refs=() if current else ('current_owned_sealed_visibility_access_trace',),examined_count=count,domain_complete=current and not cut,computation_bound_reached=bool(cut),frontier=cut)


def measure_visibility_capacity_navigation(request: CapacityRoomRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    op=request.operation_ref;required={'room_control_measurement':('raw_layer_pixels','layer_templates'),'capacity_operation_fit':('models','observations'),
        'remembered_dark_map':('state','revealed_cells'),'contact_support_domain':('state','models','bound_model_ref','control_ref'),
        'capacity_toggle':('state','models','bound_model_ref','control_ref','contact_event'),'room_step':('state','models','bound_model_ref','command_ref'),
        'reveal_release_service':('state','models','bound_model_ref','route_question_cell_refs','consumer_ref'),'capacity_route_domain':('state','models','bound_model_ref'),
        'reserve_intervals':('initial_reserve','reserve_events'),'visibility_access_compare':('expected_state','actual_state')}
    missing=missing_supplied_fields(request,required[op])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op=='reserve_intervals':return _reserve_intervals(request)
    if op=='remembered_dark_map':return _dark_map(request)
    if op=='capacity_operation_fit':return _fit(request)
    if op=='visibility_access_compare':return _compare(request)
    if op=='room_control_measurement':
        measured=translated_layers(request);templates={t.template_ref:t for t in request.layer_templates};values=dict(measured.values);rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
        return measured.model_copy(update={'values':immutable_json_data({**values,'room_control_illumination_resource_candidates':tuple({'measurement':r,'component':templates[r['template_ref']].component,'room_candidate_ref':templates[r['template_ref']].room_candidate_ref,'control_candidate_ref':templates[r['template_ref']].control_candidate_ref} for r in rows),
            'transparent_control_pixels_are_free_terrain':False,'drawn_face_proves_only_legal_side':False})})
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    if model is None:return family_result(request,prerequisite_refs=('bound_current_visibility_capacity_model',),domain_complete=False)
    if op=='capacity_route_domain':return _route_graph(request,model)
    if op=='contact_support_domain':return _route_graph(request,model,'CONTACT')
    if op=='reveal_release_service':return _reveal_service(request,model)
    if op=='capacity_toggle':
        event=request.contact_event;state=request.state;control=next((c for c in state.controls if c.control_ref==request.control_ref),None);support=_cell(state,state.actor_x,state.actor_y);target=_cell(state,event.actor_x+event.dx,event.actor_y+event.dy)
        if (event.event_owner_ref,event.epoch,event.evidence_revision_ref,event.model_revision_ref,event.model_status_ref)!=(request.scope.event_owner_ref,request.scope.epoch,request.scope.evidence_revision_ref,request.scope.model_revision_ref,request.scope.model_status_ref) or event.control_ref!=request.control_ref or (event.actor_x,event.actor_y)!=(state.actor_x,state.actor_y):return family_result(request,prerequisite_refs=('current_owned_capacity_contact_event',),domain_complete=False)
        if control is None or support is None or target is None or target.cell_ref!=control.cell_ref or support.cell_ref not in control.hit_support_refs or (event.dx,event.dy) not in control.contact_vectors or control.contact_law_evidence_ref is None:return family_result(request,prerequisite_refs=('current_bound_capacity_contact_hit',),domain_complete=False)
        after,events,debt,count,cut=_toggle(state,model,request.control_ref,request.maximum_evaluations)
    else:
        command=next((c for c in model.commands if c.command_ref==request.command_ref),None)
        if command is None:return family_result(request,prerequisite_refs=('current_directional_command_mapping',),domain_complete=False)
        after,events,debt,count,cut=_step(request.state,model,command,request.maximum_evaluations)
    return family_result(request,values={'after_state':after,'owned_events':events,'free_capacity':_free_capacity(after),'external_command_count':1 if op=='room_step' else 0,
        'contact_event_ref':request.contact_event.event_ref if op=='capacity_toggle' else None,
        'primitive_cost_interval':next((e['cost_interval'] for e in events if e.get('kind')=='DIRECTIONAL_DEBIT'),('0','0')),'action_release':False},
        prerequisite_refs=debt,examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)
