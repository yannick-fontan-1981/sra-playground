"""K13 single owned pre-input patrol event over complete body masks.

The service reports captures; its caller owns the resulting game lifecycle.
Animation frames never supply additional patrol ticks.
"""
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref,stable_digest
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields


class PatrolCell(FrozenModel):
    x: int
    y: int
    support: Literal['SUPPORTED','BLOCKED','UNKNOWN']
    evidence_ref: Ref | None = None


class PatrolBody(FrozenModel):
    patrol_ref: Ref
    x: int
    y: int
    offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=128)
    marker_offsets: tuple[tuple[int,int],...] = Field(default=(),max_length=128)
    dx: int
    dy: int
    phase: int = Field(ge=0)
    mask_evidence_ref: Ref | None = None
    @model_validator(mode='after')
    def mask(self):
        if len(set(self.offsets))!=len(self.offsets):raise ValueError('full patrol body has distinct occupied cells')
        if not set(self.marker_offsets).issubset(set(self.offsets)):raise ValueError('attached marker stays inside the supplied complete hostile mask')
        return self


class PatrolTarget(FrozenModel):
    target_ref: Ref
    cells: tuple[tuple[int,int],...] = Field(min_length=1,max_length=128)


class PatrolState(FrozenModel):
    patrols: tuple[PatrolBody,...] = Field(max_length=128)
    cells: tuple[PatrolCell,...] = Field(max_length=4096)
    targets: tuple[PatrolTarget,...] = Field(max_length=128)
    clock_tick: int = Field(ge=0)
    applied_event_ref: Ref | None = None
    applied_event_tick: int | None = Field(default=None,ge=0)
    applied_capture_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    applied_scope_digest: str | None = None
    @model_validator(mode='after')
    def identities(self):
        if len({p.patrol_ref for p in self.patrols})!=len(self.patrols):raise ValueError('ordered patrol occurrences are distinct')
        if len({(c.x,c.y) for c in self.cells})!=len(self.cells):raise ValueError('one current terrain alternative per cell')
        if len({t.target_ref for t in self.targets})!=len(self.targets):raise ValueError('distinct capture recipient identities')
        if (self.applied_event_ref is None)!=(self.applied_event_tick is None):raise ValueError('last owned event reference and tick are paired')
        return self


class PatrolLaw(FrozenModel):
    patrol_ref: Ref
    cadence: int = Field(ge=1,le=256)
    phase_modulus: int = Field(ge=1,le=65536)
    blocked_response: Literal['REVERSE_ONLY','REVERSE_AND_ATTEMPT','STOP','UNKNOWN']
    other_patrols_block: bool
    pre_motion_capture: bool
    post_motion_capture: bool
    pre_capture_interruption: Literal['STOP','CONTINUE','UNKNOWN'] = 'UNKNOWN'
    post_capture_interruption: Literal['STOP','CONTINUE','UNKNOWN'] = 'UNKNOWN'
    law_evidence_ref: Ref | None = None


class PatrolClockModel(FrozenModel):
    model_ref: Ref
    input_advancement: tuple[tuple[Ref,bool],...] = Field(max_length=64)
    laws: tuple[PatrolLaw,...] = Field(max_length=128)
    clock_evidence_ref: Ref | None = None
    time_base: Literal['INPUT_INDEX','SIMULATION_TICK','UNKNOWN'] = 'UNKNOWN'
    @model_validator(mode='after')
    def identities(self):
        if len({r for r,_ in self.input_advancement})!=len(self.input_advancement):raise ValueError('one declared clock law per input')
        if len({l.patrol_ref for l in self.laws})!=len(self.laws):raise ValueError('one law per ordered patrol')
        return self


class PatrolTickRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.patrol_tick_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    state: PatrolState | None = None
    model: PatrolClockModel | None = None
    input_ref: Ref | None = None
    event_ref: Ref | None = None
    event_clock_tick: int | None = Field(default=None,ge=0)
    clock_ref: Ref | None = None
    temporal_scope_ref: Ref | None = None


def patrol_mask(body):return tuple((body.x+x,body.y+y) for x,y in body.offsets)


def _capture(body,state):
    occupied=set(patrol_mask(body));return tuple(t.target_ref for t in state.targets if occupied.intersection(t.cells))


def _destination(body,state,law,dx,dy):
    terrain={(c.x,c.y):c for c in state.cells};others={p for other in state.patrols if other.patrol_ref!=body.patrol_ref for p in patrol_mask(other)} if law.other_patrols_block else set();blocked=[];unknown=[]
    for x,y in patrol_mask(body):
        point=(x+dx,y+dy);cell=terrain.get(point)
        if point in others or cell is not None and cell.support=='BLOCKED':blocked.append(point)
        elif cell is None or cell.support=='UNKNOWN' or cell.evidence_ref is None:unknown.append(point)
    return tuple(blocked),tuple(unknown)


def advance_patrol_tick(request: PatrolTickRequest) -> MechanicalFamilyResult:
    # The normative extension and inherited callers share one owned producer.
    # Never infer STEP_INTERNAL from either name or run both for one event.
    if request.operation_ref not in ('mechanics.patrol_body.pre_input_tick', 'mechanics.patrol_body.pre_clock_tick') or request.mode!='STEP_INTERNAL':return family_result(request,signature_supported=False,domain_complete=False)
    missing=missing_supplied_fields(request,('state','model','input_ref','event_ref','event_clock_tick','clock_ref','temporal_scope_ref'))
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    state=request.state;model=request.model
    scope_digest=stable_digest((request.scope,model.model_ref,request.input_ref,request.clock_ref,request.temporal_scope_ref))
    if (request.event_ref,request.event_clock_tick)==(state.applied_event_ref,state.applied_event_tick):
        if state.applied_scope_digest!=scope_digest:return family_result(request,prerequisite_refs=('current_revalidated_owned_clock_event_lease',),domain_complete=False)
        return family_result(request,values={'after_state':state,'event_already_applied':True,'events':(),'captured_target_refs':state.applied_capture_refs,'clock_event_completed':True},examined_count=0)
    if request.event_clock_tick!=state.clock_tick:return family_result(request,prerequisite_refs=('current_patrol_clock_event_tick',),domain_complete=False)
    if model.clock_evidence_ref is None or model.time_base=='UNKNOWN':return family_result(request,prerequisite_refs=('current_declared_clock_time_base_and_evidence',),domain_complete=False)
    advancement=next((v for ref,v in model.input_advancement if ref==request.input_ref),None)
    if advancement is None:return family_result(request,prerequisite_refs=('current_input_class_clock_law',),domain_complete=False)
    if not advancement:
        after=state.model_copy(update={'applied_event_ref':request.event_ref,'applied_event_tick':request.event_clock_tick,'applied_capture_refs':(),'applied_scope_digest':scope_digest})
        return family_result(request,values={'after_state':after,'events':({'kind':'DECLARED_INPUT_DOES_NOT_TICK','event_ref':request.event_ref},),'captured_target_refs':(),'animation_frames_advance_clock':False},examined_count=1)
    current=state;events=[];captured=[];count=0;cut={};debt=();laws={l.patrol_ref:l for l in model.laws}
    for index,body in enumerate(state.patrols):
        law=laws.get(body.patrol_ref);work=3*len(state.cells)+4*sum(len(p.offsets) for p in current.patrols)+2*sum(len(t.cells) for t in state.targets)
        if count+work>request.maximum_evaluations:cut={'phase':'ordered_patrol_tick','next_patrol_index':index,'after_prefix_state':current};break
        count+=work
        if law is None or law.law_evidence_ref is None or body.mask_evidence_ref is None:debt=('current_patrol_mask_direction_and_clock_law',);break
        if law.pre_motion_capture:
            hits=_capture(body,current);captured.extend(hits)
            if hits and law.pre_capture_interruption=='UNKNOWN':debt=('current_pre_motion_capture_interruption_law',);break
            if hits and law.pre_capture_interruption=='STOP':events.append({'kind':'PRE_MOTION_CAPTURE_STOP','event_ref':request.event_ref,'patrol_ref':body.patrol_ref,'captured_refs':hits,'snapshot':current});break
        due=state.clock_tick%law.cadence==0;changed=body;blocked=unknown=()
        if due:
            blocked,unknown=_destination(body,current,law,body.dx,body.dy)
            if unknown and not blocked:debt=('current_patrol_destination_support',);break
            if blocked:
                if law.blocked_response=='UNKNOWN':debt=('current_patrol_bounce_rule',);break
                if law.blocked_response in ('REVERSE_ONLY','REVERSE_AND_ATTEMPT'):changed=body.model_copy(update={'dx':-body.dx,'dy':-body.dy})
                if law.blocked_response=='REVERSE_AND_ATTEMPT':
                    reverse_blocked,reverse_unknown=_destination(changed,current,law,changed.dx,changed.dy)
                    if reverse_unknown and not reverse_blocked:debt=('current_reversed_patrol_destination_support',);break
                    if not reverse_blocked:changed=changed.model_copy(update={'x':body.x+changed.dx,'y':body.y+changed.dy})
            else:changed=body.model_copy(update={'x':body.x+body.dx,'y':body.y+body.dy})
        changed=changed.model_copy(update={'phase':(body.phase+1)%law.phase_modulus});before=current;current=current.model_copy(update={'patrols':tuple(changed if p.patrol_ref==body.patrol_ref else p for p in current.patrols)})
        post_hits=_capture(changed,current) if law.post_motion_capture else ();captured.extend(post_hits)
        events.append({'kind':'OWNED_PATROL_UPDATE','event_ref':request.event_ref,'producer_ref':request.scope.event_owner_ref,'clock_ref':request.clock_ref,'temporal_scope_ref':request.temporal_scope_ref,'patrol_ref':body.patrol_ref,'tick':state.clock_tick,
            'before':before,'after':current,'full_occupied_mask':patrol_mask(changed),'attached_marker_cells':tuple((changed.x+x,changed.y+y) for x,y in changed.marker_offsets),'motion_due':due,'blocked_mask':blocked,'same_position_may_advance_phase':True})
        if post_hits and law.post_capture_interruption=='UNKNOWN':debt=('current_post_motion_capture_interruption_law',);break
        if post_hits and law.post_capture_interruption=='STOP':events.append({'kind':'POST_MOTION_CAPTURE_STOP','event_ref':request.event_ref,'patrol_ref':body.patrol_ref,'captured_refs':post_hits,'snapshot':current});break
    if not debt and not cut:current=current.model_copy(update={'clock_tick':state.clock_tick+1,'applied_event_ref':request.event_ref,'applied_event_tick':request.event_clock_tick,'applied_capture_refs':tuple(dict.fromkeys(captured)),'applied_scope_digest':scope_digest})
    return family_result(request,values={'after_state':current if not debt and not cut else state,'after_prefix_state':current,'events':tuple(events),'captured_target_refs':tuple(dict.fromkeys(captured)) if not debt and not cut else (),
        'partial_capture_target_refs':tuple(dict.fromkeys(captured)) if debt or cut else (),'clock_event_completed':not debt and not cut,'restart_partial_tick_from_immutable_before':bool(debt or cut),'animation_frames_advance_clock':False,'caller_owns_capture_lifecycle':True},
        prerequisite_refs=debt,examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)
