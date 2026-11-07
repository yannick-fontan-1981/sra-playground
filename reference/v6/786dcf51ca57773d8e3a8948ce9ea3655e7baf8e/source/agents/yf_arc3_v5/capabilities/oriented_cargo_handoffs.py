"""K35 common oriented cargo protocol, distinct from permanent station delivery.

Pure bounded projections of supplied facing, coupling, interaction and autonomous
laws. No policy, action release, oracle replay or recursive route-search service.
"""
from typing import Literal
from collections import deque
import hashlib
import json
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields
from .mutable_kit_survival import KitEventTrace as HandoffEventTrace
from .identity_contact_authentication import ContactPixel,ContactLayerTemplate,ContactLayerSample,_candidate_layers as translated_layers
from .mechanical_common_contracts_c import MechanicalPredicateC
from .mechanical_event_composition_c import predicate_value


class HandoffTerrain(FrozenModel):
    x: int
    y: int
    actor_type_ref: Ref
    traversable: bool | None = None
    evidence_ref: Ref | None = None


class HandoffCargo(FrozenModel):
    cargo_ref: Ref
    type_ref: Ref
    x: int
    y: int
    offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    holder_ref: Ref | None = None
    delivery_acquired: bool
    mask_evidence_ref: Ref | None = None
    @model_validator(mode='after')
    def distinct_mask(self):
        if len(set(self.offsets))!=len(self.offsets):raise ValueError('one occurrence per cargo mask cell')
        return self


class HandoffActor(FrozenModel):
    actor_ref: Ref
    type_ref: Ref
    x: int
    y: int
    offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=128)
    face: tuple[int,int]
    held_cargo_ref: Ref | None = None
    locked_interaction_face: tuple[int,int] | None = None
    alive: bool
    @model_validator(mode='after')
    def distinct_mask(self):
        if len(set(self.offsets))!=len(self.offsets):raise ValueError('one occurrence per actor mask cell')
        return self


class HandoffReceiver(FrozenModel):
    receiver_ref: Ref
    cells: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    type_refs: tuple[Ref,...] = Field(max_length=128)
    capacity: int = Field(ge=0,le=128)
    acquired_cargo_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    delivery_evidence_ref: Ref | None = None


class HandoffState(FrozenModel):
    actors: tuple[HandoffActor,...] = Field(max_length=128)
    player_ref: Ref
    cargo: tuple[HandoffCargo,...] = Field(max_length=128)
    terrain: tuple[HandoffTerrain,...] = Field(max_length=8192)
    remaining_budget: int = Field(ge=0,le=65536)
    input_tick: int = Field(ge=0)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    receivers: tuple[HandoffReceiver,...] = Field(default=(),max_length=128)
    autonomous_phase: int = Field(default=0,ge=0)
    @model_validator(mode='after')
    def identities(self):
        if len({a.actor_ref for a in self.actors})!=len(self.actors) or self.player_ref not in {a.actor_ref for a in self.actors}:raise ValueError('distinct current actors and player identity')
        if len({c.cargo_ref for c in self.cargo})!=len(self.cargo):raise ValueError('distinct current cargo identities')
        if len({r.receiver_ref for r in self.receivers})!=len(self.receivers):raise ValueError('distinct receiver identities')
        if len({(c.x,c.y,c.actor_type_ref) for c in self.terrain})!=len(self.terrain):raise ValueError('one supplied terrain law per type/cell')
        return self


class HandoffCommand(FrozenModel):
    input_ref: Ref
    actor_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    kind: Literal['MOVE','INTERACT','WAIT']
    dx: int = 0
    dy: int = 0
    target_ref: Ref | None = None
    interaction_kind: Literal['ATTACH','RELEASE','REMOVE_ACTOR','REMOVE_CARGO'] | None = None
    cost: int = Field(ge=0,le=65536)


class HandoffInteractionRule(FrozenModel):
    actor_type_ref: Ref
    target_type_ref: Ref
    kind: Literal['ATTACH','RELEASE','REMOVE_ACTOR','REMOVE_CARGO']
    front_required: bool
    delivered_cargo_regrasp_allowed: bool
    acquisition_retained_on_regrasp: bool | None = None
    release_carried_after_actor_removal: bool | None = None
    evidence_ref: Ref | None = None


class AutonomousHandoffChoice(FrozenModel):
    actor_ref: Ref
    x: int
    y: int
    held_cargo_ref: Ref | None
    phase: int = Field(ge=0)
    command: HandoffCommand
    policy_evidence_ref: Ref | None = None
    preservation_cargo_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    @model_validator(mode='after')
    def actor_binding(self):
        if self.command.actor_ref!=self.actor_ref:raise ValueError('autonomous response belongs to its actual actor')
        return self


class HandoffObservation(FrozenModel):
    observation_ref: Ref
    before: HandoffState
    after: HandoffState
    input_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    trace: HandoffEventTrace | None = None


class HandoffAssignment(FrozenModel):
    assignment_ref: Ref
    input_word: tuple[Ref,...] = Field(max_length=256)


class HandoffLayerTemplate(ContactLayerTemplate):
    component: Literal['ACTOR','CARGO','RECEIVER','READINESS','COUPLING','UNKNOWN']
    occurrence_candidate_ref: Ref | None = None


class HandoffModel(FrozenModel):
    model_ref: Ref
    free_facing: Literal['BEFORE_TRANSLATION','AFTER_SUCCESSFUL_TRANSLATION','UNCHANGED','UNKNOWN'] = 'UNKNOWN'
    free_facing_evidence_ref: Ref | None = None
    free_move_evidence_ref: Ref | None = None
    interaction_rules: tuple[HandoffInteractionRule,...] = Field(default=(),max_length=256)
    commands: tuple[HandoffCommand,...] = Field(default=(),max_length=128)
    autonomous_order: tuple[Ref,...] = Field(default=(),max_length=128)
    autonomous_choices: tuple[AutonomousHandoffChoice,...] = Field(default=(),max_length=4096)
    joint_order: Literal['PLAYER_THEN_AUTONOMOUS','AUTONOMOUS_THEN_PLAYER','UNKNOWN'] = 'UNKNOWN'
    phase_modulus: int | None = Field(default=None,ge=1,le=65536)
    clock_inputs: tuple[Ref,...] = Field(default=(),max_length=128)
    clock_evidence_ref: Ref | None = None
    coupling_evidence_ref: Ref | None = None
    wait_evidence_ref: Ref | None = None
    @model_validator(mode='after')
    def declared_domain(self):
        if len({c.input_ref for c in self.commands})!=len(self.commands):raise ValueError('distinct exact command mappings')
        if len(set(self.autonomous_order))!=len(self.autonomous_order):raise ValueError('each owned autonomous actor occurs once')
        return self


class HandoffResumeState(FrozenModel):
    actors: tuple[HandoffActor,...] = Field(max_length=128)
    cargo: tuple[HandoffCargo,...] = Field(max_length=128)
    receivers: tuple[HandoffReceiver,...] = Field(max_length=128)
    remaining_budget: int = Field(ge=0)
    input_tick: int = Field(ge=0)
    autonomous_phase: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']


class HandoffResumeBranch(FrozenModel):
    state: HandoffResumeState
    events: tuple[FrozenMap,...] = Field(default=(),max_length=65536)
    cost_components: tuple[FrozenMap,...] = Field(default=(),max_length=256)


class HandoffBelief(FrozenModel):
    branches: tuple[HandoffResumeBranch,...] = Field(max_length=4096)
    input_word: tuple[Ref,...] = Field(default=(),max_length=256)
    node_index: int | None = Field(default=None,ge=0,le=4095)


class HandoffRouteLink(FrozenModel):
    parent_index: int | None = Field(default=None,ge=0,le=4095)
    input_ref: Ref | None = None
    depth: int = Field(ge=0,le=256)


class HandoffContinuation(FrozenModel):
    input_digest: Ref
    phase: Literal['INVERSE','GRASP','FIT','COST','UNSTARTED']
    accounted_evaluations: int = Field(default=0,ge=0)
    index: int = Field(default=0,ge=0,le=4096)
    inner_index: int = Field(default=0,ge=0,le=256)
    next_command_index: int = Field(default=0,ge=0,le=128)
    pending_belief: HandoffBelief | None = None
    open_queue: tuple[HandoffBelief,...] = Field(default=(),max_length=4096)
    deferred_queue: tuple[HandoffBelief,...] = Field(default=(),max_length=4096)
    visited_digests: tuple[Ref,...] = Field(default=(),max_length=4096)
    branches: tuple[HandoffResumeBranch,...] = Field(default=(),max_length=4096)
    completed_rows: tuple[FrozenMap,...] = Field(default=(),max_length=4096)
    prerequisite_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    current_missing_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    compared_observations: int = Field(default=0,ge=0,le=256)
    route_links: tuple[HandoffRouteLink,...] = Field(default=(),max_length=4096)


class HandoffRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.oriented_cargo_handoffs_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=256)
    maximum_witnesses: int = Field(default=3,ge=1,le=3)
    state: HandoffState | None = None
    model: HandoffModel | None = None
    actor_ref: Ref | None = None
    dx: int | None = None
    dy: int | None = None
    input_ref: Ref | None = None
    target_ref: Ref | None = None
    cargo_ref: Ref | None = None
    receiver_actor_ref: Ref | None = None
    interaction_kind: Literal['ATTACH','RELEASE','REMOVE_ACTOR','REMOVE_CARGO'] | None = None
    models: tuple[HandoffModel,...] = Field(default=(),max_length=128)
    observations: tuple[HandoffObservation,...] = Field(default=(),max_length=256)
    candidate_states: tuple[HandoffState,...] = Field(default=(),max_length=4096)
    requested_offsets: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    requested_faces: tuple[tuple[int,int],...] = Field(default=(),max_length=4)
    cargo_targets: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    grasp_detachment_assumption_ref: Ref | None = None
    requested_predicates: tuple[MechanicalPredicateC,...] = Field(default=(),max_length=256)
    postroute_horizon: int | None = Field(default=None,ge=0,le=256)
    postroute_input_word: tuple[Ref,...] = Field(default=(),max_length=256)
    candidate_assignments: tuple[HandoffAssignment,...] = Field(default=(),max_length=256)
    protected_delivery_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    future_consumer_ref: Ref | None = None
    expected_autonomous_actor_ref: Ref | None = None
    expected_autonomous_phase: int | None = Field(default=None,ge=0)
    expected_receiver_cargo_ref: Ref | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[HandoffLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    source_identity_ref: Ref | None = None
    resume: HandoffContinuation | None = None


def _handoff_digest(request):
    data=request.model_dump(mode='json',exclude={'resume','maximum_evaluations','maximum_states','maximum_depth'})
    return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()


def _handoff_delta(state):
    return HandoffResumeState(actors=state.actors,cargo=state.cargo,receivers=state.receivers,remaining_budget=state.remaining_budget,
        input_tick=state.input_tick,autonomous_phase=state.autonomous_phase,status=state.status)


def _handoff_restore(request,state):
    return request.state.model_copy(update={name:getattr(state,name) for name in HandoffResumeState.model_fields})


def _handoff_pack(value):
    if isinstance(value,HandoffState):return {'_handoff_resume_state':_handoff_delta(value).model_dump(mode='json')}
    if isinstance(value,(dict,FrozenMap)):return {key:_handoff_pack(item) for key,item in sorted(value.items())}
    if isinstance(value,(tuple,list)):return tuple(_handoff_pack(item) for item in value)
    return value


def _handoff_unpack(request,value):
    if isinstance(value,(dict,FrozenMap)):
        if set(value)=={'_handoff_resume_state'}:return _handoff_restore(request,HandoffResumeState.model_validate(dict(value['_handoff_resume_state'])))
        return {key:_handoff_unpack(request,item) for key,item in sorted(value.items())}
    if isinstance(value,(tuple,list)):return tuple(_handoff_unpack(request,item) for item in value)
    return value


def _handoff_branch(state,events,components=()):
    return HandoffResumeBranch(state=_handoff_delta(state),events=tuple(immutable_json_data(_handoff_pack(e)) for e in events),
        cost_components=tuple(immutable_json_data(c) for c in components))


def _handoff_belief(retained,node):return HandoffBelief(branches=tuple(_handoff_branch(s,e) for s,e in retained),node_index=node)


def _handoff_expand_belief(request,belief):
    return tuple((_handoff_restore(request,b.state),tuple(_handoff_unpack(request,e) for e in b.events)) for b in belief.branches),belief.node_index


def _handoff_seen(retained):
    data=tuple((_handoff_delta(s).model_dump(mode='json'),tuple(sorted({event.get('target_ref') for event in events if event.get('kind')=='RELEASE' and event.get('target_ref') is not None}))) for s,events in retained)
    return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def _handoff_resume(request,phase,**fields):
    if 'completed_rows' in fields:fields['completed_rows']=tuple(immutable_json_data(_handoff_pack(row)) for row in fields['completed_rows'])
    return HandoffContinuation(input_digest=_handoff_digest(request),phase=phase,**fields)


def _actor(state,ref):return next((a for a in state.actors if a.actor_ref==ref),None)


def _cargo(state,ref):return next((c for c in state.cargo if c.cargo_ref==ref),None)


def _geometry_work(state):
    return 3*len(state.terrain)+4*sum(len(a.offsets) for a in state.actors)+4*sum(len(c.offsets) for c in state.cargo)


def _actor_mask(actor):return tuple((actor.x+x,actor.y+y) for x,y in actor.offsets)


def _cargo_mask(cargo):return tuple((cargo.x+x,cargo.y+y) for x,y in cargo.offsets)


def _blocked(state,actor,actor_mask,cargo=None,cargo_mask=()):
    terrain={(t.x,t.y,t.actor_type_ref):t for t in state.terrain};obstacles={p for other in state.actors if other.actor_ref!=actor.actor_ref and other.alive for p in _actor_mask(other)}|{p for other in state.cargo if cargo is None or other.cargo_ref!=cargo.cargo_ref for p in _cargo_mask(other)}
    blocked=[];unknown=[]
    for type_ref,mask in ((actor.type_ref,actor_mask),(None if cargo is None else cargo.type_ref,cargo_mask)):
        for point in mask:
            terrain_row=terrain.get((point[0],point[1],type_ref))
            if point in obstacles or terrain_row is not None and terrain_row.traversable is False:blocked.append(point)
            elif terrain_row is None or terrain_row.traversable is None or terrain_row.evidence_ref is None:unknown.append(point)
    return tuple(sorted(set(blocked))),tuple(sorted(set(unknown)))


def _move(state,model,actor_ref,dx,dy,maximum,allow_hypothetical=False):
    actor=_actor(state,actor_ref);work=_geometry_work(state)
    if work>maximum:return state,(),(),0,{'phase':'oriented_actor_pair_geometry'}
    if abs(dx)+abs(dy)!=1:return state,(),('supplied_single_cell_direction',),work,{}
    if actor is None or not actor.alive:return state,(),('current_living_addressed_actor',),work,{}
    held=_cargo(state,actor.held_cargo_ref) if actor.held_cargo_ref is not None else None
    if actor.held_cargo_ref is not None and (held is None or held.holder_ref!=actor.actor_ref):return state,(),('current_exact_cargo_actor_coupling',),work,{}
    if held is None:
        if model.free_facing=='UNKNOWN' or (model.free_facing_evidence_ref is None or model.free_move_evidence_ref is None) and not allow_hypothetical:return state,(),('current_free_facing_and_move_law',),work,{}
        faced=actor.model_copy(update={'face':(dx,dy)}) if model.free_facing=='BEFORE_TRANSLATION' else actor
    else:
        if actor.locked_interaction_face is None or model.coupling_evidence_ref is None and not allow_hypothetical:return state,(),('current_locked_pair_face_and_rigid_coupling',),work,{}
        faced=actor
    actor_mask=tuple((x+dx,y+dy) for x,y in _actor_mask(actor));cargo_mask=() if held is None else tuple((x+dx,y+dy) for x,y in _cargo_mask(held))
    blocked,unknown=_blocked(state,actor,actor_mask,held,cargo_mask)
    if unknown and not blocked:return state,({'kind':'UNKNOWN_PAIR_SUPPORT','cells':unknown},),('current_actor_and_cargo_class_support',),work,{}
    moved=not blocked;changed=faced
    if moved:
        changed=faced.model_copy(update={'x':actor.x+dx,'y':actor.y+dy})
        if held is None and model.free_facing=='AFTER_SUCCESSFUL_TRANSLATION':changed=changed.model_copy(update={'face':(dx,dy)})
    actors=tuple(changed if a.actor_ref==actor_ref else a for a in state.actors);cargo=state.cargo
    if moved and held is not None:cargo=tuple(c.model_copy(update={'x':c.x+dx,'y':c.y+dy}) if c.cargo_ref==held.cargo_ref else c for c in cargo)
    after=state.model_copy(update={'actors':actors,'cargo':cargo})
    return after,({'kind':'RIGID_PAIR_MOVE' if held is not None else 'FREE_MOVE','actor_ref':actor_ref,'moved':moved,'refusal_mask':blocked,'before_face':actor.face,'after_face':changed.face,
        'locked_face_preserved':held is not None,'whole_actor_mask':actor_mask,'whole_cargo_mask':cargo_mask,'own_vacated_cells_are_static_blockers':False},),(),work,{}


def _interaction_front_condition(state,model,actor_ref,target_ref,kind,allow_hypothetical=False):
    actor=_actor(state,actor_ref);cargo=_cargo(state,target_ref);target_actor=_actor(state,target_ref)
    if actor is None or not actor.alive or cargo is None and target_actor is None:
        return None,('current_addressed_actor_and_target_type',)
    target_type=cargo.type_ref if cargo is not None else target_actor.type_ref;rules=tuple(r for r in model.interaction_rules if (r.actor_type_ref,r.target_type_ref,r.kind)==(actor.type_ref,target_type,kind))
    if len(rules)!=1:return None,('unique_current_type_interaction_law',)
    rule=rules[0]
    if rule.evidence_ref is None and not allow_hypothetical:return None,('current_type_front_interaction_evidence',)
    face=actor.locked_interaction_face if actor.held_cargo_ref is not None else actor.face
    if face is None:return None,('current_interaction_face',)
    if rule.front_required and abs(face[0])+abs(face[1])!=1:return None,('current_unit_front_interaction_face',)
    mask=_cargo_mask(cargo) if cargo is not None else _actor_mask(target_actor)
    front_cell=(actor.x+face[0],actor.y+face[1]);contact=front_cell in mask
    facts={'actor_ref':actor_ref,'target_ref':target_ref,
        'actor_type_ref':actor.type_ref,'target_type_ref':target_type,'rule_evidence_ref':rule.evidence_ref,
        'front_required':rule.front_required,'effective_face':face,'face_locked':actor.held_cargo_ref is not None,
        'front_cell':front_cell,'target_mask':mask,'front_contact':contact,
        'front_precondition_satisfied':not rule.front_required or contact,
        'actor_held_cargo_ref':actor.held_cargo_ref,'target_holder_ref':None if cargo is None else cargo.holder_ref,
        'target_is_cargo':cargo is not None,'state_status':state.status,
        'target_delivery_acquired':False if cargo is None else cargo.delivery_acquired,
        'delivered_cargo_regrasp_allowed':rule.delivered_cargo_regrasp_allowed,
        'level_scope_ref':state.level_scope_ref,'restore_epoch':state.restore_epoch,
        'input_tick':state.input_tick,'autonomous_phase':state.autonomous_phase}
    return (actor,cargo,target_actor,rule,face,facts),()


def _interaction_precondition(request):
    state=request.state;model=request.model;work=_geometry_work(state)+len(model.interaction_rules)
    if work>request.maximum_evaluations:
        return family_result(request,domain_complete=False,computation_bound_reached=True,
            frontier={'phase':'interaction_front_precondition'})
    measured,missing=_interaction_front_condition(state,model,request.actor_ref,request.target_ref,request.interaction_kind)
    return family_result(request,values={'front_precondition':{} if measured is None else measured[-1],
        'before_state_unchanged':True,'no_autonomous_advance':True,'physical_effect_observed':False,
        'full_interaction_readiness_proven':False},prerequisite_refs=missing,
        examined_count=work,domain_complete=not missing)


def _interaction(state,model,actor_ref,target_ref,kind,maximum,allow_hypothetical=False):
    work=_geometry_work(state)+len(model.interaction_rules)
    if work>maximum:return state,(),(),0,{'phase':'front_conditioned_interaction'}
    measured,missing=_interaction_front_condition(state,model,actor_ref,target_ref,kind,allow_hypothetical)
    if missing:return state,(),missing,work,{}
    actor,cargo,target_actor,rule,face,front=measured
    if not front['front_precondition_satisfied']:
        return state,({'kind':'FRONT_INTERACTION_REFUSED','actor_ref':actor_ref,'target_ref':target_ref},),(),work,{}
    actors=state.actors;objects=state.cargo;receivers=state.receivers;details={}
    if kind=='ATTACH':
        if cargo is None or actor.held_cargo_ref is not None or cargo.holder_ref is not None:return state,(),('current_free_actor_and_unowned_cargo',),work,{}
        if cargo.delivery_acquired and not rule.delivered_cargo_regrasp_allowed:return state,({'kind':'ACQUIRED_CARGO_REGRASP_REFUSED','cargo_ref':cargo.cargo_ref},),(),work,{}
        if cargo.delivery_acquired and rule.acquisition_retained_on_regrasp is None:
            return state,(),('current_delivery_retention_or_reclaim_law',),work,{}
        retained=cargo.delivery_acquired and rule.acquisition_retained_on_regrasp is True
        changed=actor.model_copy(update={'held_cargo_ref':cargo.cargo_ref,'locked_interaction_face':face})
        actors=tuple(changed if a.actor_ref==actor_ref else a for a in actors);objects=tuple(c.model_copy(update={'holder_ref':actor_ref,'delivery_acquired':retained}) if c.cargo_ref==cargo.cargo_ref else c for c in objects)
        if cargo.delivery_acquired and not retained:
            receivers=tuple(r.model_copy(update={'acquired_cargo_refs':tuple(ref for ref in r.acquired_cargo_refs if ref!=cargo.cargo_ref)}) for r in receivers)
        details={'coupling_offset':(cargo.x-actor.x,cargo.y-actor.y),'locked_face':face}
    elif kind=='RELEASE':
        if cargo is None or actor.held_cargo_ref!=cargo.cargo_ref or cargo.holder_ref!=actor_ref:return state,(),('current_owned_cargo_release',),work,{}
        changed=actor.model_copy(update={'held_cargo_ref':None,'locked_interaction_face':None});actors=tuple(changed if a.actor_ref==actor_ref else a for a in actors)
        matches=tuple(r for r in receivers if cargo.type_ref in r.type_refs and set(_cargo_mask(cargo)).issubset(set(r.cells)) and len(r.acquired_cargo_refs)<r.capacity)
        if len(matches)>1:return state,(),('current_competing_receiver_selection',),work,{}
        if matches and matches[0].delivery_evidence_ref is None:return state,(),('current_receiver_acceptance_evidence',),work,{}
        acquired=bool(matches and matches[0].delivery_evidence_ref is not None)
        objects=tuple(c.model_copy(update={'holder_ref':None,'delivery_acquired':c.delivery_acquired or acquired}) if c.cargo_ref==cargo.cargo_ref else c for c in objects)
        if acquired:receivers=tuple(r.model_copy(update={'acquired_cargo_refs':r.acquired_cargo_refs+(cargo.cargo_ref,)}) if r.receiver_ref==matches[0].receiver_ref else r for r in receivers)
        details={'temporary_deposit':not acquired,'receiver_ref':None if not matches else matches[0].receiver_ref,'delivery_supported':acquired}
    elif kind=='REMOVE_ACTOR':
        if target_actor is None:return state,(),('current_removal_actor',),work,{}
        carried=_cargo(state,target_actor.held_cargo_ref)
        if carried is not None and rule.release_carried_after_actor_removal is None:return state,(),('current_removed_actor_cargo_lifecycle',),work,{}
        changed=target_actor.model_copy(update={'alive':False,'held_cargo_ref':None,'locked_interaction_face':None});actors=tuple(changed if a.actor_ref==target_actor.actor_ref else a for a in actors)
        if carried is not None:
            if rule.release_carried_after_actor_removal:objects=tuple(c.model_copy(update={'holder_ref':None}) if c.cargo_ref==carried.cargo_ref else c for c in objects)
            else:return state,(),('explicit_retained_or_removed_cargo_policy_after_actor_removal',),work,{}
        details={'removed_actor_ref':target_actor.actor_ref,'cargo_deleted_without_supported_removal':False}
    else:
        if cargo is None:return state,(),('current_explicit_cargo_removal_target',),work,{}
        objects=tuple(c for c in objects if c.cargo_ref!=cargo.cargo_ref);actors=tuple(a.model_copy(update={'held_cargo_ref':None,'locked_interaction_face':None}) if a.held_cargo_ref==cargo.cargo_ref else a for a in actors)
        details={'explicitly_supported_cargo_removal':True}
    after=state.model_copy(update={'actors':actors,'cargo':objects,'receivers':receivers})
    return after,({'kind':kind,'actor_ref':actor_ref,'target_ref':target_ref,'after_state':after,**details},),(),work,{}


def _apply(state,model,command,maximum,allow_hypothetical=False):
    if maximum<1:return state,(),(),0,{'phase':'next_owned_direct_effect'}
    if command.kind=='MOVE':return _move(state,model,command.actor_ref,command.dx,command.dy,maximum,allow_hypothetical)
    if command.kind=='WAIT':
        if model.wait_evidence_ref is None and not allow_hypothetical:return state,(),('current_named_wait_clock_contract',),0,{}
        return state,({'kind':'NO_SPATIAL_DIRECT_EFFECT','actor_ref':command.actor_ref},),(),1,{}
    if command.target_ref is None or command.interaction_kind is None:return state,(),('exact_addressed_interaction_type_and_kind',),0,{}
    return _interaction(state,model,command.actor_ref,command.target_ref,command.interaction_kind,maximum,allow_hypothetical)


def _joint(state,model,command,maximum,maximum_branches,allow_hypothetical=False):
    if state.status!='ACTIVE':return ((state,({'kind':'TERMINAL_INTERRUPTION'},)),),(),0,{}
    if command.cost>state.remaining_budget:return (),('funded_joint_cargo_input',),0,{}
    if model.joint_order=='UNKNOWN' or model.clock_evidence_ref is None and not allow_hypothetical or model.phase_modulus is None:return (),('current_joint_clock_and_order_contract',),0,{}
    if state.player_ref in model.autonomous_order or command.actor_ref!=state.player_ref:return (),('each_joint_actor_owned_once_and_actual_player_input',),0,{}
    debited=state.model_copy(update={'remaining_budget':state.remaining_budget-command.cost})
    count=0;branches=[(debited,({'kind':'PLAYER_INPUT_DEBIT','cost':command.cost,
        'before_state':state,'after_state':debited,'native_command':command,
        'owned_phase_complete':True},))];unknown=[];cut={}
    advance=command.input_ref in model.clock_inputs
    order=(state.player_ref,)+model.autonomous_order if model.joint_order=='PLAYER_THEN_AUTONOMOUS' else model.autonomous_order+(state.player_ref,)
    for actor_index,actor_ref in enumerate(order):
        expanded=[]
        for current,events in branches:
            actor=_actor(current,actor_ref)
            if actor is None:unknown.append(('current_ordered_actor',actor_ref));continue
            if not actor.alive:expanded.append((current,events+({'kind':'SKIP_REMOVED_ACTOR','actor_ref':actor_ref,
                'before_state':current,'after_state':current,'owned_phase_complete':True},)));continue
            if actor_ref==state.player_ref:choices=(command,)
            elif not advance:expanded.append((current,events));continue
            else:
                rows=tuple(r for r in model.autonomous_choices if r.actor_ref==actor_ref and (r.x,r.y,r.held_cargo_ref,r.phase)==(actor.x,actor.y,actor.held_cargo_ref,current.autonomous_phase))
                if not rows or any(r.policy_evidence_ref is None for r in rows) and not allow_hypothetical:unknown.append(('current_supported_autonomous_policy',actor_ref));continue
                choices=tuple(r.command for r in rows)
            for response_index,response in enumerate(choices):
                if len(expanded)>=maximum_branches:cut={'phase':'joint_response_domain','actor_index':actor_index,'next_response_index':response_index};break
                after,trace,debt,work,bound=_apply(current,model,response,maximum-count,allow_hypothetical);count+=work
                if bound:cut={'actor_index':actor_index,'next_response_index':response_index,**bound};break
                if debt:unknown.append((actor_ref,debt));continue
                protected=tuple(r.preservation_cargo_refs for r in rows if r.command==response) if actor_ref!=state.player_ref else ()
                if any(_cargo(after,ref) is None or _cargo(current,ref) is not None and _cargo(current,ref).delivery_acquired and not _cargo(after,ref).delivery_acquired for group in protected for ref in group):unknown.append((actor_ref,'autonomous_preservation_constraint_contradiction'));continue
                # Keep the existing event kinds/order for inverse-domain consumers.
                # These are the already calculated states, never a second effect.
                owned_trace=tuple({**event,'before_state':current,'after_state':after,
                    'native_command':response,'owned_phase_complete':True,
                    'owned_phase_group':(actor_index,response_index)} for event in trace)
                expanded.append((after,events+owned_trace))
            if cut:break
        if cut:break
        branches=expanded
    if not cut:
        completed=[]
        for current,events in branches:
            after=current.model_copy(update={'input_tick':state.input_tick+1,
                'autonomous_phase':(current.autonomous_phase+1)%model.phase_modulus if advance else current.autonomous_phase})
            completed.append((after,events+({'kind':'JOINT_CLOCK_COMPLETE','advanced':advance,
                'before_state':current,'after_state':after,'owned_phase_complete':True},)))
        branches=completed
    return tuple(branches),tuple(str(x) for x in unknown),count,cut


OPERATION_MODES = {
    'scene_measure': ('MEASURE',),
    'free_successor': ('STEP_INTERNAL',),
    'coupled_successor': ('STEP_INTERNAL',),
    'interaction_successor': ('STEP_INTERNAL',),
    'interaction_precondition': ('PRECONDITION',),
    'front_domains': ('INVERSE_DOMAIN',),
    'predicate_domains': ('INVERSE_DOMAIN',),
    'grasp_domains': ('INVERSE_DOMAIN',),
    'regrasp_domains': ('INVERSE_DOMAIN',),
    'handoff_domains': ('INVERSE_DOMAIN',),
    'autonomous_fit': ('FIT',),
    'joint_successor': ('STEP',),
    'wait_domains': ('INVERSE_DOMAIN',),
    'assignment_cost': ('EVALUATE',),
}


def _preserved(before,after,refs):
    return all(_cargo(before,r) is not None and _cargo(after,r) is not None and
               (not _cargo(before,r).delivery_acquired or _cargo(after,r).delivery_acquired) and
               (not _cargo(before,r).delivery_acquired or _cargo(before,r)==_cargo(after,r)) for r in refs)


def _command(request,model):
    return next((c for c in model.commands if c.input_ref==request.input_ref),None)


def _successor(request,operation):
    state=request.state;model=request.model
    if state.status!='ACTIVE':return family_result(request,values={'after_state':state,'terminal_interrupted':True})
    if operation=='joint_successor':
        command=_command(request,model)
        if command is None:return family_result(request,prerequisite_refs=('current_exact_player_command',),domain_complete=False)
        branches,debt,count,cut=_joint(state,model,command,request.maximum_evaluations,request.maximum_states)
        return family_result(request,values={'response_domain':tuple({'after_state':s,'ordered_events':events} for s,events in branches),
            'all_responses_complete':not debt and not cut,'partial_prefix_only':bool(cut),'source_owned_release_required':True},
            prerequisite_refs=debt,examined_count=count,domain_complete=not debt and not cut,
            computation_bound_reached=bool(cut),frontier={'input_ref':request.input_ref,'restore_epoch':state.restore_epoch,**cut})
    actor=_actor(state,request.actor_ref)
    if actor is None or (operation=='free_successor' and actor.held_cargo_ref is not None) or (operation=='coupled_successor' and actor.held_cargo_ref is None):
        return family_result(request,prerequisite_refs=('current_requested_free_or_coupled_actor',),domain_complete=False)
    if operation=='interaction_successor':
        after,events,debt,count,cut=_interaction(state,model,request.actor_ref,request.target_ref,request.interaction_kind,request.maximum_evaluations)
    else:after,events,debt,count,cut=_move(state,model,request.actor_ref,request.dx,request.dy,request.maximum_evaluations)
    return family_result(request,values={'after_state':after,'events':events,'internal_projection_only':True},
        prerequisite_refs=debt,examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)


def _grasp_domains(request):
    state=request.state;actor=_actor(state,request.actor_ref);cargo=_cargo(state,request.cargo_ref)
    if actor is None or cargo is None:return family_result(request,prerequisite_refs=('current_actor_and_requested_cargo',),domain_complete=False)
    if actor.held_cargo_ref not in (None,cargo.cargo_ref):
        return family_result(request,prerequisite_refs=('free_requested_carrier_before_grasp_domain',),domain_complete=False)
    ownership_work=len(state.actors)+(len(state.actors)+len(state.cargo) if cargo.holder_ref is not None else 0)
    if ownership_work>request.maximum_evaluations:
        return family_result(request,domain_complete=False,computation_bound_reached=True,
            frontier={'phase':'grasp_ownership_projection','required_evaluations':ownership_work})
    owners=tuple(a for a in state.actors if a.held_cargo_ref==cargo.cargo_ref)
    if ((cargo.holder_ref is None and owners) or
        (cargo.holder_ref is not None and (len(owners)!=1 or owners[0].actor_ref!=cargo.holder_ref))):
        return family_result(request,prerequisite_refs=('consistent_current_cargo_and_carrier_ownership',),domain_complete=False)
    detachment=cargo.holder_ref is not None
    if detachment and request.grasp_detachment_assumption_ref is None:
        return family_result(request,prerequisite_refs=('source_declared_grasp_detachment_assumption',),domain_complete=False)
    # A supplied endpoint supposition is not an observed RELEASE or a reached
    # deposit. Preserve physical state and clear both sides only in this domain.
    free_state=state
    if detachment:
        free_state=state.model_copy(update={
            'actors':tuple(a.model_copy(update={'held_cargo_ref':None,'locked_interaction_face':None})
                if a.actor_ref==cargo.holder_ref else a for a in state.actors),
            'cargo':tuple(c.model_copy(update={'holder_ref':None}) if c.cargo_ref==cargo.cargo_ref else c for c in state.cargo)})
    resume=request.resume if request.resume is not None and request.resume.phase=='GRASP' else None
    rows=[_handoff_unpack(request,row) for row in resume.completed_rows] if resume is not None else []
    debt=list(resume.prerequisite_refs) if resume is not None else [];count=(resume.accounted_evaluations if resume is not None else 0)+ownership_work;cut={}
    for index,(offset,face) in enumerate((offset,face) for offset in request.requested_offsets for face in request.requested_faces):
        if resume is not None and index<resume.index:continue
        if abs(face[0])+abs(face[1])!=1:
            debt.append('supplied_single_cell_grasp_face');continue
        if len(rows)>=request.maximum_states:cut={'phase':'grasp_offsets','next_offset_index':index};break
        candidate=actor.model_copy(update={'x':cargo.x-offset[0],'y':cargo.y-offset[1],'face':face,'held_cargo_ref':None,'locked_interaction_face':None})
        pose_projection=free_state.model_copy(update={'actors':tuple(candidate if a.actor_ref==actor.actor_ref else a for a in free_state.actors)})
        work=_geometry_work(state)
        if count+work>request.maximum_evaluations:cut={'phase':'grasp_support','next_offset_index':index};break
        blocked,unknown=_blocked(pose_projection,candidate,_actor_mask(candidate));count+=work
        if unknown:debt.append('current_candidate_grasp_type_support')
        if blocked or unknown:continue
        attached,events,missing,work,bound=_interaction(pose_projection,request.model,actor.actor_ref,cargo.cargo_ref,'ATTACH',request.maximum_evaluations-count);count+=work
        if bound:cut={'next_offset_index':index,**bound};break
        if missing:debt.extend(missing);continue
        if _actor(attached,actor.actor_ref).held_cargo_ref!=cargo.cargo_ref:continue
        deliveries=[]
        for target_index,(tx,ty) in enumerate(request.cargo_targets):
            if count+work>request.maximum_evaluations:cut={'phase':'delivery_offsets','offset_index':index,'next_target_index':target_index};break
            final_actor=candidate.model_copy(update={'x':tx-offset[0],'y':ty-offset[1]})
            final_cargo=cargo.model_copy(update={'x':tx,'y':ty})
            refusal,unresolved=_blocked(state,final_actor,_actor_mask(final_actor),cargo,_cargo_mask(final_cargo));count+=work
            if unresolved:debt.append('current_delivery_actor_and_cargo_support')
            deliveries.append({'cargo_target':(tx,ty),'carrier_final_pose':(tx-offset[0],ty-offset[1]),
                               'whole_mask_refusal':refusal,'unknown_support':unresolved,'endpoint_feasible':not refusal and not unresolved,
                               'route_proven':False})
        if cut:break
        rows.append({'offset':offset,'face':face,'grasp_pose':(candidate.x,candidate.y),'attached_state':attached,
            'events':events,'delivery_offsets':tuple(deliveries),'endpoint_projection_only':True,
            'counterfactual_detachment':detachment,
            'source_detachment_assumption_ref':request.grasp_detachment_assumption_ref if detachment else None,
            'detachment_route_proven':False})
    if cut:cut['continuation']=_handoff_resume(request,'GRASP',index=index,accounted_evaluations=count,completed_rows=tuple(rows),prerequisite_refs=tuple(dict.fromkeys(debt)))
    return family_result(request,values={'grasp_domain':tuple(rows),'endpoint_fit_is_not_delivery_reachability':True,
        'counterfactual_detachment':detachment,
        'source_detachment_assumption_ref':request.grasp_detachment_assumption_ref if detachment else None,
        'detachment_route_proven':False,'physical_release_observed':False},
        prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,domain_complete=not debt and not cut,
        computation_bound_reached=bool(cut),frontier=cut)


def _state_key(state):
    # Time remains part of identity: equal geometry at another phase is not a loop.
    return (state.actors,state.cargo,state.receivers,state.remaining_budget,state.input_tick,
            state.autonomous_phase,state.level_scope_ref,state.restore_epoch,state.status)


def _domain_hit(request,operation,before,current,events):
    cargo=_cargo(current,request.cargo_ref) if request.cargo_ref is not None else None
    if operation=='regrasp_domains':
        actor=_actor(current,request.actor_ref)
        return (actor is not None and cargo is not None and actor.held_cargo_ref==cargo.cargo_ref and
                any(e.get('kind')=='RELEASE' and e.get('target_ref')==cargo.cargo_ref for e in events) and
                (cargo.x-actor.x,cargo.y-actor.y) in request.requested_offsets)
    if operation=='handoff_domains':
        receiver=_actor(current,request.receiver_actor_ref)
        return cargo is not None and receiver is not None and receiver.held_cargo_ref==cargo.cargo_ref and cargo.holder_ref==receiver.actor_ref
    receiver=_actor(current,request.expected_autonomous_actor_ref)
    return receiver is not None and current.input_tick>before.input_tick and (
        request.expected_autonomous_phase is not None and current.autonomous_phase==request.expected_autonomous_phase or
        request.expected_receiver_cargo_ref is not None and receiver.held_cargo_ref==request.expected_receiver_cargo_ref)


def _requested_predicate_measure(request,state,maximum):
    """Project only requested typed paths; C owns the comparison operators."""
    count=0;missing=[];results={};indices={}
    class Cut(Exception):pass
    def bill(work=1):
        nonlocal count
        if count+work>maximum:raise Cut()
        count+=work
    def size(value):
        bill()
        if isinstance(value,FrozenModel):
            for name in type(value).model_fields:size(getattr(value,name))
        elif isinstance(value,(dict,FrozenMap)):
            for key in sorted(value):size(value[key])
        elif isinstance(value,(tuple,list,frozenset)):
            for child in value:size(child)
    roots={'native_state':state,'remaining_budget':state.remaining_budget,
        'input_tick':state.input_tick,'autonomous_phase':state.autonomous_phase,'status':state.status}
    tables={'cargo_by_ref':(state.cargo,'cargo_ref'),'actors_by_ref':(state.actors,'actor_ref'),
        'receivers_by_ref':(state.receivers,'receiver_ref'),'cargo_pose_by_ref':(state.cargo,'cargo_ref')}
    try:
        for predicate in request.requested_predicates:
            bill()
            if predicate.field_ref in tables and predicate.field_ref not in indices:
                rows,key=tables[predicate.field_ref];bill(len(rows))
                indices[predicate.field_ref]={getattr(row,key):((row.x,row.y) if predicate.field_ref=='cargo_pose_by_ref' else row) for row in rows}
            if predicate.field_ref in indices:actual=indices[predicate.field_ref]
            elif predicate.field_ref in roots:actual=roots[predicate.field_ref]
            else:missing.append('current_requested_predicate_field:'+predicate.predicate_ref);continue
            absent=False
            for part in predicate.field_path:
                bill()
                if isinstance(actual,FrozenModel) and isinstance(part,str) and part in type(actual).model_fields:actual=getattr(actual,part)
                elif isinstance(actual,(dict,FrozenMap)) and isinstance(part,str) and part in actual:actual=actual[part]
                elif isinstance(actual,tuple) and type(part) is int and 0<=part<len(actual):actual=actual[part]
                else:absent=True;break
            if absent:missing.append('current_requested_predicate_path:'+predicate.predicate_ref);continue
            before=count;size(actual);size(predicate.expected);bill(count-before)
            if predicate.comparison=='SET_EQ' and isinstance(actual,(tuple,frozenset)) and isinstance(predicate.expected,(tuple,frozenset)):
                bill(2*len(actual)*len(predicate.expected))
            result=predicate_value(predicate.model_copy(update={'field_path':()}),
                FrozenMap({predicate.field_ref:immutable_json_data(actual)}))
            if result is None:missing.append('current_requested_predicate_comparison:'+predicate.predicate_ref)
            else:results[predicate.predicate_ref]=result
    except Cut:return {'results':results,'missing_refs':tuple(dict.fromkeys(missing)),'examined_count':count,'bounded':True}
    return {'results':results,'missing_refs':tuple(dict.fromkeys(missing)),'examined_count':count,'bounded':False}


def _verify_predicate_horizon(request,initial,retained,maximum):
    """All supplied autonomous responses under the exact Source input word."""
    count=0;boundaries=[];branches=tuple(state for state,events in retained);missing=[]
    def measure(states):
        nonlocal count
        values=[]
        for state in states:
            measured=_requested_predicate_measure(request,state,maximum-count);count+=measured['examined_count']
            missing.extend(measured['missing_refs']);values.append(measured['results'])
            if measured['bounded']:return values,False,True
        valid=not missing and all(len(v)==len(request.requested_predicates) and all(v.values()) for v in values)
        return values,valid,False
    initial_values,endpoint,bound=measure(branches)
    if bound or missing or not endpoint:
        return {'endpoint_predicates_satisfied':endpoint,'postroute_verified':False,'missing_refs':tuple(dict.fromkeys(missing)),
            'examined_count':count,'bounded':bound,'postroute_response_domain':()}
    total_responses=len(branches)
    if total_responses>request.maximum_states:
        return {'endpoint_predicates_satisfied':True,'postroute_verified':False,'missing_refs':(),
            'examined_count':count,'bounded':True,'postroute_response_domain':()}
    boundaries.append({'boundary_index':0,'input_ref':None,'responses':tuple({'after_state':state,'predicate_values':values}
        for state,values in zip(branches,initial_values))})
    for index,input_ref in enumerate(request.postroute_input_word):
        if count+len(request.model.commands)>maximum:
            return {'endpoint_predicates_satisfied':True,'postroute_verified':False,'missing_refs':tuple(dict.fromkeys(missing)),
                'examined_count':count,'bounded':True,'postroute_response_domain':tuple(boundaries)}
        count+=len(request.model.commands)
        commands=tuple(c for c in request.model.commands if c.input_ref==input_ref)
        if len(commands)!=1:
            missing.append('unique_current_postroute_input:'+input_ref);break
        next_states=[];traces=[]
        for state in branches:
            if state.status!='ACTIVE' or (state.level_scope_ref,state.restore_epoch)!=(initial.level_scope_ref,initial.restore_epoch):
                missing.append('active_same_scope_state_before_predicate_verification');break
            responses,debt,work,cut=_joint(state,request.model,commands[0],maximum-count,request.maximum_states);count+=work
            missing.extend(debt)
            if cut:return {'endpoint_predicates_satisfied':True,'postroute_verified':False,'missing_refs':tuple(dict.fromkeys(missing)),
                'examined_count':count,'bounded':True,'postroute_response_domain':tuple(boundaries)}
            for after,events in responses:
                if total_responses+len(next_states)>=request.maximum_states:
                    return {'endpoint_predicates_satisfied':True,'postroute_verified':False,'missing_refs':tuple(dict.fromkeys(missing)),
                        'examined_count':count,'bounded':True,'postroute_response_domain':tuple(boundaries)}
                next_states.append(after);traces.append(events)
        if missing or not next_states:break
        branches=tuple(next_states);total_responses+=len(branches)
        values,satisfied,bound=measure(branches)
        preserved=all(_preserved(initial,s,request.protected_delivery_refs)
            and (s.level_scope_ref,s.restore_epoch)==(initial.level_scope_ref,initial.restore_epoch)
            and _actor(s,initial.player_ref) is not None and _actor(s,initial.player_ref).alive for s in branches)
        boundaries.append({'boundary_index':index+1,'input_ref':input_ref,
            'responses':tuple({'after_state':state,'events':events,'predicate_values':value}
                for state,events,value in zip(branches,traces,values)),'preservation_satisfied':preserved})
        if bound or missing or not satisfied or not preserved:
            return {'endpoint_predicates_satisfied':True,'postroute_verified':False,'missing_refs':tuple(dict.fromkeys(missing)),
                'examined_count':count,'bounded':bound,'postroute_response_domain':tuple(boundaries)}
    verified=not missing and len(boundaries)==request.postroute_horizon+1
    return {'endpoint_predicates_satisfied':True,'postroute_verified':verified,
        'postroute_horizon':request.postroute_horizon,'postroute_input_word':request.postroute_input_word,
        'postroute_response_domain':tuple(boundaries),'verification_allresponses_complete':verified,
        'protection_horizon_checked':verified and request.postroute_horizon>0,
        'missing_refs':tuple(dict.fromkeys(missing)),'examined_count':count,'bounded':False}


def _handoff_predecessor_word_d(links,index,remaining):
    word=[];work=0
    while links[index].parent_index is not None:
        work+=1
        if work>remaining:return None,work
        word.append(links[index].input_ref);index=links[index].parent_index
    return tuple(reversed(word)),work


def _inverse_routes(request,operation):
    initial=request.state
    if operation=='predicate_domains':
        if (not request.requested_predicates or request.future_consumer_ref is None
            or request.postroute_horizon is None or len(request.postroute_input_word)!=request.postroute_horizon
            or len({p.predicate_ref for p in request.requested_predicates})!=len(request.requested_predicates)):
            return family_result(request,prerequisite_refs=('source_declared_predicates_consumer_and_exact_postroute_word_horizon',),domain_complete=False)
        if any(p.event_kind_refs or not p.include_initial for p in request.requested_predicates):
            return family_result(request,prerequisite_refs=('state_only_initial_inclusive_predicate_domain_contract',),domain_complete=False)
    if operation=='front_domains' and request.future_consumer_ref is None:
        return family_result(request,prerequisite_refs=('named_future_interaction_consumer_for_front_preparation',),domain_complete=False)
    if operation=='regrasp_domains':
        actor=_actor(initial,request.actor_ref);cargo=_cargo(initial,request.cargo_ref)
        if actor is None or cargo is None or actor.held_cargo_ref!=cargo.cargo_ref:
            return family_result(request,prerequisite_refs=('current_carried_cargo_before_temporary_deposit',),domain_complete=False)
    if operation=='handoff_domains' and request.receiver_actor_ref not in request.model.autonomous_order:
        return family_result(request,prerequisite_refs=('current_receiver_autonomous_policy',),domain_complete=False)
    if operation=='handoff_domains' and (_cargo(initial,request.cargo_ref) is None or _cargo(initial,request.cargo_ref).holder_ref!=initial.player_ref):
        return family_result(request,prerequisite_refs=('actual_sender_owned_cargo_before_handoff',),domain_complete=False)
    if operation=='wait_domains' and (request.future_consumer_ref is None or request.expected_autonomous_actor_ref not in request.model.autonomous_order or
            request.expected_autonomous_phase is None and request.expected_receiver_cargo_ref is None):
        return family_result(request,prerequisite_refs=('named_future_consumer_and_autonomous_event_predicate',),domain_complete=False)
    resume=request.resume if request.resume is not None and request.resume.phase=='INVERSE' else None
    if resume is None:
        links=[HandoffRouteLink(depth=0)]
        queue=deque([(((initial,()),),0)]);seen={_handoff_seen(((initial,()),))};rows=[];count=0;debt=[];pending=None;command_start=0;deferred=[]
    else:
        links=list(resume.route_links)
        beliefs=resume.open_queue+resume.deferred_queue+(() if resume.pending_belief is None else (resume.pending_belief,))
        commands={command.input_ref for command in request.model.commands}
        valid=bool(links) and all(
            link.parent_index is None and i==0 and link.input_ref is None and link.depth==0 or
            link.parent_index is not None and link.parent_index<i and link.input_ref in commands
            and link.depth==links[link.parent_index].depth+1 for i,link in enumerate(links))
        if not valid or any(b.input_word or b.node_index is None or b.node_index>=len(links) for b in beliefs):
            return family_result(request,prerequisite_refs=('current_structural_handoff_continuation',),domain_complete=False)
        queue=deque(_handoff_expand_belief(request,b) for b in resume.open_queue+resume.deferred_queue)
        seen=set(resume.visited_digests);rows=[_handoff_unpack(request,row) for row in resume.completed_rows]
        count=resume.accounted_evaluations;debt=list(resume.prerequisite_refs)
        pending=None if resume.pending_belief is None else _handoff_expand_belief(request,resume.pending_belief)
        command_start=resume.next_command_index;deferred=[]
    cut={}
    if operation=='predicate_domains' and resume is None:
        verified=_verify_predicate_horizon(request,initial,((initial,()),),request.maximum_evaluations-count)
        count+=verified['examined_count'];debt.extend(verified['missing_refs'])
        if verified['bounded']:
            return family_result(request,examined_count=count,domain_complete=False,computation_bound_reached=True,
                frontier={'phase':'initial_predicate_postroute_verification'})
        if verified['postroute_verified']:
            return family_result(request,values={'route_witnesses':({'input_word':(),
                'response_domain':({'after_state':initial,'events':()},),
                'future_consumer_ref':request.future_consumer_ref,'robust_over_supplied_responses':True,
                'endpoint_only':request.postroute_horizon==0,**verified},),
                'future_consumer_ref':request.future_consumer_ref,'source_owned_selection_required':True,
                'minimum_cost_proven':False},examined_count=count)
    def measure_front(current):
        nonlocal count
        work=_geometry_work(current)+len(request.model.interaction_rules)
        if count+work>request.maximum_evaluations:return None,(),True
        measured,missing=_interaction_front_condition(current,request.model,request.actor_ref,request.target_ref,request.interaction_kind)
        count+=work
        return None if measured is None else measured[-1],missing,False
    if operation=='front_domains' and resume is None:
        front,missing,bound=measure_front(initial)
        if missing or bound:
            return family_result(request,prerequisite_refs=missing,examined_count=count,domain_complete=False,
                computation_bound_reached=bound,frontier={'phase':'initial_front_preparation_condition'} if bound else {})
        if front['front_precondition_satisfied']:
            return family_result(request,values={'route_witnesses':({'input_word':(),
                'response_domain':({'after_state':initial,'events':(),'front_precondition':front},),
                'future_consumer_ref':request.future_consumer_ref,'robust_over_supplied_responses':True,'endpoint_only':False},),
                'front_measured_before_next_interaction':True,'full_interaction_readiness_proven':False,
                'source_owned_selection_required':True,'minimum_cost_proven':False},examined_count=count)
    def checkpoint(current,next_command):
        return _handoff_resume(request,'INVERSE',accounted_evaluations=count,next_command_index=next_command,
            pending_belief=None if current is None else _handoff_belief(*current),
            open_queue=tuple(_handoff_belief(*item) for item in queue),deferred_queue=tuple(_handoff_belief(*item) for item in deferred),
            visited_digests=tuple(sorted(seen)),completed_rows=tuple(rows),prerequisite_refs=tuple(dict.fromkeys(debt)),route_links=tuple(links))
    while queue or pending is not None:
        retained,node=pending if pending is not None else queue.popleft()
        first_command=command_start if pending is not None else 0;pending=None;command_start=0
        if any(current.status!='ACTIVE' for current,e in retained):continue
        if links[node].depth>=request.maximum_depth:deferred.append((retained,node));continue
        for command_index in range(first_command,len(request.model.commands)):
            command=request.model.commands[command_index]
            if command.actor_ref!=initial.player_ref:continue
            if len(rows)>=request.maximum_witnesses:
                cut={'phase':'returned_inverse_witnesses','witness_sample_only':True};break
            branches=[];missing=[]
            for current,events in retained:
                responses,unresolved,work,bound=_joint(current,request.model,command,request.maximum_evaluations-count,request.maximum_states);count+=work
                missing.extend(unresolved)
                if bound:
                    cut={'phase':'inverse_joint_prefix','predecessor_node':node,'next_command_index':command_index,
                         'continuation':checkpoint((retained,node),command_index)};break
                for state,trace in responses:
                    if len(branches)>=request.maximum_states:
                        cut={'phase':'retained_inverse_responses','predecessor_node':node,'continuation':checkpoint((retained,node),command_index)};break
                    branches.append((state,events+trace))
                if cut:break
            if missing:debt.extend(missing)
            if cut:break
            if not branches or missing:continue
            cargo_refs=request.protected_delivery_refs+((request.cargo_ref,) if operation in ('regrasp_domains','handoff_domains') else ())
            if not all(_preserved(initial,s,cargo_refs) and _actor(s,initial.player_ref) is not None and _actor(s,initial.player_ref).alive for s,e in branches):continue
            fronts=[]
            verified=None
            if operation=='front_domains':
                for state,events in branches:
                    front,unresolved,bound=measure_front(state)
                    debt.extend(unresolved);fronts.append(front)
                    if bound:
                        cut={'phase':'inverse_front_precondition','continuation':checkpoint((retained,node),command_index)};break
                if cut:break
                reached=all(f is not None and f['front_precondition_satisfied'] for f in fronts)
            elif operation=='predicate_domains':
                verified=_verify_predicate_horizon(request,initial,tuple(branches),request.maximum_evaluations-count)
                count+=verified['examined_count'];debt.extend(verified['missing_refs'])
                if verified['bounded']:
                    cut={'phase':'inverse_predicate_postroute_verification','continuation':checkpoint((retained,node),command_index)};break
                reached=verified['postroute_verified']
            else:reached=all(_domain_hit(request,operation,initial,s,e) for s,e in branches)
            if reached:
                prefix,work=_handoff_predecessor_word_d(links,node,request.maximum_evaluations-count-1)
                if prefix is None or count+work+1>request.maximum_evaluations:
                    cut={'phase':'inverse_word_reconstruction','continuation':checkpoint((retained,node),command_index)};break
                count+=work+1;next_word=prefix+(command.input_ref,)
                rows.append({'input_word':next_word,'response_domain':tuple({'after_state':s,'events':e} for s,e in branches),
                    'future_consumer_ref':request.future_consumer_ref,'robust_over_supplied_responses':True,'endpoint_only':False})
                if operation=='front_domains':
                    rows[-1]['response_domain']=tuple({**row,'front_precondition':front} for row,front in zip(rows[-1]['response_domain'],fronts))
                if verified is not None:
                    rows[-1].update(verified);rows[-1]['endpoint_only']=request.postroute_horizon==0
                continue
            key=_handoff_seen(branches)
            if key in seen:continue
            if len(seen)>=request.maximum_states or len(links)>=request.maximum_states:
                cut={'phase':'visited_inverse_domain','predecessor_node':node,'continuation':checkpoint((retained,node),command_index)};break
            child=len(links);links.append(HandoffRouteLink(parent_index=node,input_ref=command.input_ref,depth=links[node].depth+1))
            seen.add(key);queue.append((tuple(branches),child))
        if cut:break
    if not cut and deferred:cut={'phase':'inverse_route_depth','maximum_depth':request.maximum_depth,'continuation':checkpoint(None,0)}
    return family_result(request,values={'route_witnesses':tuple(rows),'future_consumer_ref':request.future_consumer_ref,
            'exhaustive_impossibility':not rows and not debt and not cut,'minimum_cost_proven':False,
            'receiver_maps_are_type_specific':True,'source_owned_selection_required':True,
            'front_measured_before_next_interaction':operation=='front_domains','full_interaction_readiness_proven':False},
        prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,domain_complete=not debt and not cut,
        computation_bound_reached=bool(cut),frontier={'restore_epoch':initial.restore_epoch,**cut})


def _fit(request):
    resume=request.resume if request.resume is not None and request.resume.phase=='FIT' else None
    surviving=[];rejected=[];unresolved=[]
    if resume is not None:
        for stored in resume.completed_rows:
            row=_handoff_unpack(request,stored);bucket=row.pop('_bucket')
            (surviving if bucket=='supported' else rejected if bucket=='rejected' else unresolved).append(row)
    count=resume.accounted_evaluations if resume is not None else 0;cut={}
    for model_index in range(resume.index if resume is not None else 0,len(request.models)):
        model=request.models[model_index];continuing=resume is not None and model_index==resume.index
        contradiction=False;missing=list(resume.current_missing_refs) if continuing else [];examined=resume.compared_observations if continuing else 0
        for observation_index in range(resume.inner_index if continuing else 0,len(request.observations)):
            observation=request.observations[observation_index]
            if not observation.sealed or observation.event_owner_ref!=request.scope.event_owner_ref or observation.epoch!=request.scope.epoch or observation.before.level_scope_ref!=observation.after.level_scope_ref or observation.before.restore_epoch!=observation.after.restore_epoch:
                missing.append('sealed_same_scope_and_restore_observation');continue
            command=next((c for c in model.commands if c.input_ref==observation.input_ref),None)
            if command is None:missing.append('supplied_observed_input_mapping');continue
            branches,debt,work,bound=_joint(observation.before,model,command,request.maximum_evaluations-count,request.maximum_states,True);count+=work
            if bound:
                completed=tuple({**row,'_bucket':name} for name,rows in (('supported',surviving),('rejected',rejected),('unresolved',unresolved)) for row in rows)
                cut={'phase':'autonomous_fit','continuation':_handoff_resume(request,'FIT',index=model_index,inner_index=observation_index,
                    accounted_evaluations=count,completed_rows=completed,current_missing_refs=tuple(dict.fromkeys(missing)),compared_observations=examined)};break
            if debt:missing.extend(debt);continue
            examined+=1
            if not any(s==observation.after for s,e in branches):contradiction=True;break
        if cut:break
        row={'model_ref':model.model_ref,'observations_compared':examined,'missing_refs':tuple(dict.fromkeys(missing))}
        if contradiction:rejected.append(row)
        elif missing or examined==0:unresolved.append(row)
        else:surviving.append(row)
    return family_result(request,values={'supported_models':tuple(surviving),'contradicted_models':tuple(rejected),'unresolved_models':tuple(unresolved),
        'unvisited_terrain_or_route_tie_breaks_inferred':False,'conditional_player_model_is_not_autonomous_prediction':True,
        'pending_model_refs':tuple(m.model_ref for m in request.models[len(surviving)+len(rejected)+len(unresolved):])},
        prerequisite_refs=('complete_owned_evidence_for_supplied_model_bank',) if unresolved else (),examined_count=count,
        domain_complete=not cut and not unresolved,computation_bound_reached=bool(cut),frontier=cut)


def _assignment_cost(request):
    resume=request.resume if request.resume is not None and request.resume.phase=='COST' else None
    rows=[_handoff_unpack(request,row) for row in resume.completed_rows] if resume is not None else []
    count=resume.accounted_evaluations if resume is not None else 0;debt=list(resume.prerequisite_refs) if resume is not None else [];cut={}
    for assignment_index in range(resume.index if resume is not None else 0,len(request.candidate_assignments)):
        assignment=request.candidate_assignments[assignment_index];continuing=resume is not None and assignment_index==resume.index
        branches=[(_handoff_restore(request,b.state),tuple(_handoff_unpack(request,e) for e in b.events),tuple(b.cost_components)) for b in resume.branches] if continuing else [(request.state,(),())]
        prefix_complete=True;start=resume.inner_index if continuing else 0
        def checkpoint(primitive_index):
            return _handoff_resume(request,'COST',index=assignment_index,inner_index=primitive_index,accounted_evaluations=count,
                branches=tuple(_handoff_branch(s,e,p) for s,e,p in branches),completed_rows=tuple(rows),prerequisite_refs=tuple(dict.fromkeys(debt)))
        for primitive_index in range(start,len(assignment.input_word)):
            input_ref=assignment.input_word[primitive_index]
            if primitive_index>=request.maximum_depth:
                cut={'phase':'assignment_word_depth','continuation':checkpoint(primitive_index)};prefix_complete=False;break
            command=next((c for c in request.model.commands if c.input_ref==input_ref),None)
            if command is None:debt.append('current_exact_assignment_input_mapping');prefix_complete=False;break
            expanded=[]
            for state,events,components in branches:
                after,missing,work,bound=_joint(state,request.model,command,request.maximum_evaluations-count,request.maximum_states);count+=work
                if missing:debt.extend(missing);prefix_complete=False
                if bound:cut={'phase':'assignment_joint_atomic','continuation':checkpoint(primitive_index)};prefix_complete=False;break
                for next_state,trace in after:
                    if not _preserved(request.state,next_state,request.protected_delivery_refs):continue
                    if len(expanded)>=request.maximum_states:cut={'phase':'assignment_response_domain','continuation':checkpoint(primitive_index)};prefix_complete=False;break
                    expanded.append((next_state,events+trace,components+({'input_ref':input_ref,'kind':command.kind,'cost':command.cost,'input_tick':next_state.input_tick,'autonomous_phase':next_state.autonomous_phase},)))
                if cut:break
            if cut:break
            branches=expanded
            if not prefix_complete or not branches:break
        if cut:break
        rows.append({'assignment_ref':assignment.assignment_ref,'complete_word_evaluated':prefix_complete,
            'responses':tuple({'after_state':s,'full_cost':request.state.remaining_budget-s.remaining_budget,'time_ticks':s.input_tick-request.state.input_tick,
                'cost_components':parts,'ordered_events':events} for s,events,parts in branches),'minimum_cost_proven':False})
    return family_result(request,values={'assignment_costs':tuple(rows),'costs_are_exact_supplied_command_costs':True},
        prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,domain_complete=not debt and not cut,
        computation_bound_reached=bool(cut),frontier=cut)


def _measure_oriented_cargo_handoffs(request: HandoffRequest) -> MechanicalFamilyResult:
    prefix='mechanics.oriented_cargo_handoffs.'
    operation=request.operation_ref[len(prefix):] if request.operation_ref.startswith(prefix) else ''
    if operation not in OPERATION_MODES or request.mode not in OPERATION_MODES[operation]:
        return family_result(request,signature_supported=False,domain_complete=False)
    required={'scene_measure':('raw_layer_pixels','layer_templates'),'autonomous_fit':('models','observations'),
        'free_successor':('state','model','actor_ref','dx','dy'),'coupled_successor':('state','model','actor_ref','dx','dy'),
        'interaction_successor':('state','model','actor_ref','target_ref','interaction_kind'),
        'interaction_precondition':('state','model','actor_ref','target_ref','interaction_kind'),
        'front_domains':('state','model','actor_ref','target_ref','interaction_kind','future_consumer_ref'),
        'predicate_domains':('state','model','requested_predicates','future_consumer_ref','postroute_horizon'),
        'joint_successor':('state','model','input_ref'),'grasp_domains':('state','model','actor_ref','cargo_ref','requested_offsets','requested_faces','cargo_targets'),
        'regrasp_domains':('state','model','actor_ref','cargo_ref','requested_offsets'),
        'handoff_domains':('state','model','cargo_ref','receiver_actor_ref'),'wait_domains':('state','model','future_consumer_ref','expected_autonomous_actor_ref'),
        'assignment_cost':('state','model','candidate_assignments')}[operation]
    missing=missing_supplied_fields(request,required)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if operation=='scene_measure':return translated_layers(request)
    if operation=='interaction_precondition':return _interaction_precondition(request)
    if operation in ('free_successor','coupled_successor','interaction_successor','joint_successor'):return _successor(request,operation)
    if operation=='grasp_domains':return _grasp_domains(request)
    if operation in ('regrasp_domains','handoff_domains','wait_domains','front_domains','predicate_domains'):return _inverse_routes(request,operation)
    if operation=='autonomous_fit':return _fit(request)
    return _assignment_cost(request)


def measure_oriented_cargo_handoffs(request: HandoffRequest) -> MechanicalFamilyResult:
    if request.source_identity_ref is None or request.resume is not None and request.resume.input_digest!=_handoff_digest(request):
        return family_result(request,prerequisite_refs=('same_source_scope_revisions_and_immutable_handoff_inputs',),domain_complete=False)
    offset=request.resume.accounted_evaluations if request.resume is not None and request.resume.phase=='UNSTARTED' else 0
    if offset>=request.maximum_evaluations:return family_result(request,examined_count=offset,domain_complete=False,computation_bound_reached=True,frontier={'phase':'resumed_atomic_budget','continuation':request.resume})
    bounded=request.model_copy(update={'maximum_evaluations':request.maximum_evaluations-offset}) if offset else request
    result=_measure_oriented_cargo_handoffs(bounded)
    if offset:result=result.model_copy(update={'examined_count':result.examined_count+offset})
    if result.computation_bound_reached and 'continuation' not in result.frontier:
        token=_handoff_resume(request,'UNSTARTED',accounted_evaluations=result.examined_count)
        result=result.model_copy(update={'frontier':immutable_json_data({**dict(result.frontier),'continuation':token})})
    return result
