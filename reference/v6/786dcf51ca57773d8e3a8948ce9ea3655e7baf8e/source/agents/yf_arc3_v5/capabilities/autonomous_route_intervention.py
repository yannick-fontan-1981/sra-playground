"""Caller-owned autonomous announcements and ordered joint interventions.

Behavior proposals are explicit alternatives, never hidden engine class names.
An external successor interprets one command and its declared reaction order;
it never recursively searches a route. Unknown announcements stop composition.
"""
from collections import deque
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap,FrozenModel,Ref,immutable_json_data,stable_digest
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields
from .identity_contact_authentication import ContactPixel,ContactLayerTemplate,ContactLayerSample,_candidate_layers as measure_translated_layers

Point=tuple[int,int]
CARDINALS=((0,-1),(0,1),(-1,0),(1,0))
PHASES=('INPUT','PRE_CONTACT','MOVE','POST_CONTACT','ARRIVAL','RESOURCE')


class RouteActor(FrozenModel):
    actor_ref: Ref
    role: Literal['BENEFICIARY','ADVERSARY','OTHER']
    position: Point
    alive: bool
    condition: Literal['FREE','HELD','CAPTIVE','REMOVED']
    cadence: int = Field(ge=1,le=65536)
    cadence_elapsed: int = Field(ge=0)
    announced_targets: tuple[Point,...] | None = Field(default=None,max_length=8)
    announcement_tick: int | None = Field(default=None,ge=0)
    announcement_epoch: int | None = Field(default=None,ge=0)
    announcement_snapshot_ref: Ref | None = None
    history: tuple[Point,...] = Field(max_length=64)
    @model_validator(mode='after')
    def announcement(self):
        if self.cadence_elapsed>=self.cadence:raise ValueError('cadence phase belongs to its supplied period')
        if self.condition=='REMOVED' and self.alive:raise ValueError('removed actor is not living')
        if self.announced_targets is not None and (self.announcement_tick is None or self.announcement_epoch is None or self.announcement_snapshot_ref is None):raise ValueError('announcement retains its generating scope and resolving tick')
        if self.announced_targets is not None and len(set(self.announced_targets))!=len(self.announced_targets):raise ValueError('announcement alternatives are distinct')
        return self


class RouteTerrain(FrozenModel):
    cells: tuple[Point,...] = Field(min_length=1,max_length=4096)
    walls: tuple[Point,...] = Field(max_length=4096)
    rails: tuple[Point,...] = Field(max_length=4096)
    traps: tuple[Point,...] = Field(max_length=4096)
    tool_cells: tuple[Point,...] = Field(min_length=1,max_length=4096)
    @model_validator(mode='after')
    def masks(self):
        if any(len(set(rows))!=len(rows) for rows in (self.cells,self.walls,self.rails,self.traps,self.tool_cells)):raise ValueError('terrain masks retain unique cells')
        if not set(self.walls+self.rails+self.traps)<=set(self.cells):raise ValueError('terrain overlays lie in their supplied substrate domain')
        return self


class RouteState(FrozenModel):
    tool: Point
    terrain: RouteTerrain
    actors: tuple[RouteActor,...] = Field(max_length=16)
    grace_remaining: int = Field(ge=0,le=65536)
    clock: int = Field(ge=0)
    remaining_budget: int = Field(ge=0,le=65536)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    snapshot_ref: Ref
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def occurrences(self):
        if len({a.actor_ref for a in self.actors})!=len(self.actors):raise ValueError('actor occurrences retain identity through divergent directions')
        if self.tool not in self.terrain.tool_cells or any(a.position not in self.terrain.cells for a in self.actors):raise ValueError('tool and actor geometry have independent supplied domains')
        return self


class RouteBehavior(FrozenModel):
    behavior_ref: Ref
    actor_ref: Ref
    kind: Literal['DIRECTIONAL','ROUTE','FOLLOWER','PREDICTIVE','DELAYED','NEAREST_RECEIVER','SUPPLIED']
    directions: tuple[Point,...] = Field(max_length=4)
    route: tuple[Point,...] = Field(max_length=128)
    route_mode: Literal['LOOP','STOP']
    target_actor_ref: Ref | None = None
    receiver_points: tuple[Point,...] = Field(max_length=128)
    delay: int = Field(ge=0,le=63)
    avoid_blocked: bool
    prefer_rail: bool
    @model_validator(mode='after')
    def geometry(self):
        if any(d not in CARDINALS for d in self.directions):raise ValueError('declared behavior uses cardinal neighboring directions')
        if len(set(self.directions))!=len(self.directions):raise ValueError('behavior directions are unique')
        if any(_distance(a,b)>1 for a,b in zip(self.route,self.route[1:])):raise ValueError('route steps belong to the supplied one-cell motion model')
        if self.route_mode=='LOOP' and self.route and _distance(self.route[-1],self.route[0])>1:raise ValueError('loop closure is a local motion')
        return self


class RouteCommand(FrozenModel):
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    kind: Literal['MOVE_TOOL','ADD_WALL','REMOVE_WALL','TOGGLE_WALL','WAIT','RESTORE']
    delta: Point
    cost: int = Field(ge=0,le=65536)


class RouteModel(FrozenModel):
    model_ref: Ref
    beneficiary_ref: Ref
    destination: tuple[Point,...] = Field(min_length=1,max_length=128)
    goal_requires_alive_after_reaction: bool
    phase_order: tuple[Literal['INPUT','PRE_CONTACT','MOVE','POST_CONTACT','ARRIVAL','RESOURCE'],...] = Field(min_length=6,max_length=6)
    announce_timing: Literal['BEFORE_INPUT','AFTER_INPUT','NEXT_TURN','SUPPLIED_ONLY']
    blocked_announcement: Literal['CANCEL','REANNOUNCE']
    movement_order: Literal['SIMULTANEOUS','SEQUENTIAL']
    actor_order: tuple[Ref,...] = Field(max_length=16)
    held_cadence: Literal['KEEP','ADVANCE']
    build_on_adversary: Literal['CAPTURE','REMOVE','REJECT']
    build_on_beneficiary: Literal['HOLD','REMOVE','REJECT']
    reopen_captive: Literal['REMOVE','RELEASE']
    release_beneficiary_on_reopen: bool
    edge_crossing_contact: bool
    arrival_resource_priority: Literal['ARRIVAL_FIRST','RESOURCE_FIRST']
    exhaustion_outcome: Literal['LOCAL_STOP','GAME_OVER','RESTORE']
    budget_admission: Literal['REFUSE_BEFORE_INPUT','ALLOW_EXHAUSTING_INPUT']
    restoration_scope: Literal['TERRAIN','WORLD','NONE']
    restored_state: RouteState | None = None
    behaviors: tuple[RouteBehavior,...] = Field(max_length=16)
    commands: tuple[RouteCommand,...] = Field(min_length=1,max_length=64)
    @model_validator(mode='after')
    def ordering(self):
        if set(self.phase_order)!=set(PHASES):raise ValueError('every declared external phase occurs exactly once')
        if len(set(self.actor_order))!=len(self.actor_order) or len({b.actor_ref for b in self.behaviors})!=len(self.behaviors):raise ValueError('actor order and behavior ownership are unambiguous')
        if len({c.input_ref for c in self.commands})!=len(self.commands) or len({(c.action_ref,c.payload) for c in self.commands})!=len(self.commands):raise ValueError('one exact meaning per actual command payload')
        return self


class RouteObservation(FrozenModel):
    observation_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    before: RouteState
    after: RouteState
    action_ref: Ref
    payload: FrozenMap
    observed_actor_refs: tuple[Ref,...] = Field(max_length=16)
    announcements_observed: bool
    terrain_tool_observed: bool
    resources_observed: bool


class RouteLayerTemplate(ContactLayerTemplate):
    component: Literal['TOOL','BODY','TERRAIN','RAIL','TRAP','ADVANCE_MARK','DESTINATION']
    actor_ref: Ref | None = None
    generating_snapshot_ref: Ref | None = None
    declared_transparent: bool


class RouteOverlayModel(FrozenModel):
    model_ref: Ref
    overlay_pixels: tuple[ContactPixel,...] = Field(max_length=4096)
    composition_rows: tuple[tuple[Ref,Ref,Ref],...] = Field(max_length=256)
    @model_validator(mode='after')
    def pixels(self):
        if len({p.point for p in self.overlay_pixels})!=len(self.overlay_pixels):raise ValueError('one overlay hypothesis per addressed pixel')
        return self


class RouteInterventionRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.route_intervention_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=128)
    maximum_responses: int = Field(ge=1,le=128)
    maximum_evaluations: int = Field(ge=1,le=65536)
    state: RouteState | None = None
    models: tuple[RouteModel,...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    input_ref: Ref | None = None
    observations: tuple[RouteObservation,...] = Field(default=(),max_length=256)
    expected_state: RouteState | None = None
    actual_state: RouteState | None = None
    addressed_cell: Point | None = None
    edit_kind: Literal['ADD_WALL','REMOVE_WALL','TOGGLE_WALL'] | None = None
    collision_cell: Point | None = None
    threatened_actor_ref: Ref | None = None
    event_deadline_tick: int | None = Field(default=None,ge=0)
    hold_cell: Point | None = None
    trap_cell: Point | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[RouteLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    overlay_models: tuple[RouteOverlayModel,...] = Field(default=(),max_length=128)
    @model_validator(mode='after')
    def identities(self):
        for rows,name in ((self.models,'model_ref'),(self.observations,'observation_ref'),(self.layer_templates,'template_ref')):
            if len({getattr(r,name) for r in rows})!=len(rows):raise ValueError('scoped model and observation identities are distinct')
        if len({p.point for p in self.raw_layer_pixels})!=len(self.raw_layer_pixels):raise ValueError('one current token per raw pixel')
        return self


OPERATION_MODES={'actor_layers':'MEASURE','announce_order':'FIT','terrain_intervention':'STEP_INTERNAL','announced_transition':'STEP',
    'behavior_alternatives':'FIT','intervention_deadlines':'INVERSE_DOMAIN','hold_release':'PRECONDITION','trap_reuse':'INVERSE_DOMAIN',
    'joint_intervention_domain':'DOMAIN','intervention_compare':'COMPARE'}


def _model(request):return next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
def _actors(state):return {a.actor_ref:a for a in state.actors}
def _add(p,d):return (p[0]+d[0],p[1]+d[1])
def _distance(a,b):return abs(a[0]-b[0])+abs(a[1]-b[1])
def _snapshot(state):
    return state.model_copy(update={'snapshot_ref':stable_digest((state.tool,state.terrain,state.actors,state.clock,state.remaining_budget,state.restore_epoch))})
def _bound(state,model):return model.beneficiary_ref in _actors(state) and _actors(state)[model.beneficiary_ref].role=='BENEFICIARY' and set(model.actor_order)==set(_actors(state)) and set(b.actor_ref for b in model.behaviors)<=set(_actors(state))


def _next_targets(state,actor,behavior):
    if behavior.kind=='SUPPLIED':
        valid=actor.announced_targets is not None and actor.announcement_tick==state.clock+1 and actor.announcement_epoch==state.restore_epoch
        return actor.announced_targets if valid else None,() if valid else ('current_scoped_next_announcement',)
    targets=()
    if behavior.kind=='DIRECTIONAL':targets=tuple(_add(actor.position,d) for d in behavior.directions)
    elif behavior.kind=='ROUTE':
        indices=tuple(i for i,p in enumerate(behavior.route) if p==actor.position)
        if not indices:return None,('current_actor_on_supplied_route',)
        targets=tuple(behavior.route[(i+1)%len(behavior.route)] if i+1<len(behavior.route) or behavior.route_mode=='LOOP' else actor.position for i in indices)
    else:
        points=behavior.receiver_points
        if behavior.kind in ('FOLLOWER','PREDICTIVE','DELAYED'):
            target=_actors(state).get(behavior.target_actor_ref)
            if target is None:return None,('current_behavior_target_occurrence',)
            point=target.position
            if behavior.kind=='DELAYED':
                if len(target.history)<=behavior.delay:return None,('observed_target_history_for_declared_delay',)
                point=target.history[-1-behavior.delay]
            elif behavior.kind=='PREDICTIVE':
                if target.announced_targets is None or target.announcement_tick!=state.clock+1 or target.announcement_epoch!=state.restore_epoch:return None,('scoped_target_announcement_for_prediction',)
                points=target.announced_targets
            if behavior.kind!='PREDICTIVE':points=(point,)
        if not points:return None,('declared_behavior_receiver_domain',)
        closest=min(_distance(actor.position,p) for p in points);receivers=tuple(p for p in points if _distance(actor.position,p)==closest)
        targets=tuple(_add(actor.position,d) for d in CARDINALS if any(_distance(_add(actor.position,d),p)<_distance(actor.position,p) for p in receivers)) or (actor.position,)
    targets=tuple(dict.fromkeys(targets))
    if behavior.avoid_blocked:targets=tuple(p for p in targets if p in state.terrain.cells and p not in state.terrain.walls)
    if behavior.prefer_rail:
        rail=tuple(p for p in targets if p in state.terrain.rails)
        if rail:targets=rail
    return targets or (actor.position,),()


def _announce(state,model):
    behaviors={b.actor_ref:b for b in model.behaviors};after=[];missing=[]
    for actor in state.actors:
        behavior=behaviors.get(actor.actor_ref)
        if not actor.alive or actor.condition!='FREE':after.append(actor);continue
        if behavior is None:
            # Keep a supplied current announcement; its expiration is a boundary.
            valid=actor.announcement_tick==state.clock+1 and actor.announcement_epoch==state.restore_epoch
            if not valid:missing.append('next_announcement_behavior_or_observation.'+actor.actor_ref)
            after.append(actor if valid else actor.model_copy(update={'announced_targets':None,'announcement_tick':None,'announcement_epoch':None,'announcement_snapshot_ref':None}));continue
        if behavior.kind=='SUPPLIED':
            valid=actor.announcement_tick==state.clock+1 and actor.announcement_epoch==state.restore_epoch
            if not valid:missing.append('next_scoped_supplied_announcement.'+actor.actor_ref)
            after.append(actor if valid else actor.model_copy(update={'announced_targets':None,'announcement_tick':None,'announcement_epoch':None,'announcement_snapshot_ref':None}));continue
        targets,debt=_next_targets(state,actor,behavior);missing.extend(debt)
        after.append(actor.model_copy(update={'announced_targets':targets,'announcement_tick':state.clock+1,
            'announcement_epoch':state.restore_epoch,'announcement_snapshot_ref':state.snapshot_ref}) if targets is not None else actor)
    return _snapshot(state.model_copy(update={'actors':tuple(after)})),tuple(dict.fromkeys(missing))


def _edit(state,model,cell,kind):
    if cell not in state.terrain.cells:return state,('addressed_edit_cell_in_bound_terrain',),()
    removing=kind=='REMOVE_WALL' or kind=='TOGGLE_WALL' and cell in state.terrain.walls
    occupants=tuple(a for a in state.actors if a.position==cell and a.alive)
    if not removing and any((a.role=='ADVERSARY' and model.build_on_adversary=='REJECT') or (a.actor_ref==model.beneficiary_ref and model.build_on_beneficiary=='REJECT') for a in occupants):return state,(),('edit_rejected_by_occupant_law',)
    walls=set(state.terrain.walls);events=[];actors=[]
    if removing:walls.discard(cell)
    else:walls.add(cell)
    for actor in state.actors:
        after=actor
        if actor.position==cell and actor.alive:
            if removing and actor.condition=='CAPTIVE':after=actor.model_copy(update={'condition':'REMOVED' if model.reopen_captive=='REMOVE' else 'FREE','alive':model.reopen_captive!='REMOVE'})
            elif removing and actor.condition=='HELD' and model.release_beneficiary_on_reopen:after=actor.model_copy(update={'condition':'FREE'})
            elif not removing and actor.actor_ref==model.beneficiary_ref:after=actor.model_copy(update={'condition':'HELD' if model.build_on_beneficiary=='HOLD' else 'REMOVED','alive':model.build_on_beneficiary=='HOLD'})
            elif not removing and actor.role=='ADVERSARY':after=actor.model_copy(update={'condition':'CAPTIVE' if model.build_on_adversary=='CAPTURE' else 'REMOVED','alive':model.build_on_adversary=='CAPTURE'})
        if after!=actor:events.append((actor.actor_ref,actor.condition,after.condition))
        actors.append(after)
    terrain=state.terrain.model_copy(update={'walls':tuple(sorted(walls))})
    return _snapshot(state.model_copy(update={'terrain':terrain,'actors':tuple(actors)})),(),tuple(events)


def _restore(state,model):
    reset=model.restored_state
    if model.restoration_scope=='NONE' or reset is None:return state,('supported_restore_scope_and_state',)
    if model.restoration_scope=='TERRAIN':
        if state.tool not in reset.terrain.tool_cells or any(a.position not in reset.terrain.cells for a in state.actors):return state,('current_poses_compatible_with_restored_terrain',)
        return _snapshot(state.model_copy(update={'terrain':reset.terrain})),()
    if reset.level_scope_ref!=state.level_scope_ref or reset.restore_epoch<=state.restore_epoch or not _bound(reset,model):return state,('qualified_same_level_new_epoch_world_restore',)
    return reset,()


def _contact(state,model,before_move=None):
    actors=_actors(state);beneficiary=actors[model.beneficiary_ref]
    if not beneficiary.alive or state.grace_remaining>0:return state,()
    enemies=tuple(a for a in state.actors if a.role=='ADVERSARY' and a.alive and a.condition=='FREE')
    collision=tuple(a.actor_ref for a in enemies if a.position==beneficiary.position or model.edge_crossing_contact and before_move is not None and a.actor_ref in before_move and before_move[a.actor_ref]==beneficiary.position and before_move[beneficiary.actor_ref]==a.position)
    if not collision:return state,()
    actors[beneficiary.actor_ref]=beneficiary.model_copy(update={'alive':False,'condition':'REMOVED'})
    return _snapshot(state.model_copy(update={'actors':tuple(actors[a.actor_ref] for a in state.actors)})),collision


def _moves(state,model,maximum_responses,work_bound):
    possibilities=[state];missing=[];cut=False;count=0;behaviors={b.actor_ref:b for b in model.behaviors};snapshot=state
    for ref in model.actor_order:
        following=[]
        for branch in possibilities:
            work=max(1,len(branch.actors))
            if count+work>work_bound:cut=True;break
            count+=work
            actor=_actors(branch)[ref];source_actor=_actors(snapshot)[ref] if model.movement_order=='SIMULTANEOUS' else actor
            elapsed=(actor.cadence_elapsed+1)%actor.cadence;due=actor.cadence_elapsed+1>=actor.cadence
            if not actor.alive or actor.condition!='FREE':
                after=actor.model_copy(update={'cadence_elapsed':elapsed}) if model.held_cadence=='ADVANCE' and actor.alive else actor;targets=(after.position,)
            elif not due:after=actor.model_copy(update={'cadence_elapsed':elapsed});targets=(after.position,)
            else:
                valid=source_actor.announced_targets is not None and source_actor.announcement_tick==state.clock+1 and source_actor.announcement_epoch==state.restore_epoch and source_actor.announcement_snapshot_ref is not None
                if not valid:missing.append('current_scoped_announcement.'+ref);continue
                targets=source_actor.announced_targets or (actor.position,);after=actor.model_copy(update={'cadence_elapsed':elapsed})
                if any(_distance(actor.position,p)>1 for p in targets):missing.append('one_cell_or_supported_swept_announcement.'+ref);continue
                if any(p not in branch.terrain.cells or p in branch.terrain.walls for p in targets) and model.blocked_announcement=='REANNOUNCE':
                    behavior=behaviors.get(ref)
                    if behavior is None:missing.append('blocked_announcement_behavior.'+ref);continue
                    targets,debt=_next_targets(snapshot if model.movement_order=='SIMULTANEOUS' else branch,actor,behavior);missing.extend(debt)
                    if targets is None:continue
            for target in targets:
                if len(following)>=maximum_responses:cut=True;break
                admitted=target in branch.terrain.cells and target not in branch.terrain.walls and actor.alive and actor.condition=='FREE'
                moved=after.model_copy(update={'position':target if admitted else actor.position})
                actors=tuple(moved if a.actor_ref==ref else a for a in branch.actors);following.append(_snapshot(branch.model_copy(update={'actors':actors})))
        possibilities=following
        if not possibilities:break
    return tuple(possibilities),tuple(dict.fromkeys(missing)),cut,count


def _successors(request,state,model,command,bound):
    if state.status!='ACTIVE':return (),('authoritative_joint_terminal',),(),0,False,False
    if command.cost>state.remaining_budget and model.budget_admission=='REFUSE_BEFORE_INPUT':return (),('remaining_external_input_budget',),(),0,False,False
    branches=[(state,(),False,None)];missing=[];count=0;cut=False;input_applied=False
    phases=list(model.phase_order)
    if model.announce_timing=='BEFORE_INPUT':phases.insert(phases.index('INPUT'),'ANNOUNCE')
    if model.announce_timing=='AFTER_INPUT':phases.insert(phases.index('INPUT')+1,'ANNOUNCE')
    for phase_index,phase in enumerate(phases):
        following=[]
        for current,trace,arrived,before_move in branches:
            work=max(1,len(current.actors))
            if count+work>bound:cut=True;break
            count+=work;after=current;events=();outputs=(current,)
            if phase=='ANNOUNCE':after,debt=_announce(current,model);missing.extend(debt);outputs=(after,)
            elif phase=='INPUT':
                input_applied=True
                if command.kind=='MOVE_TOOL':
                    point=_add(current.tool,command.delta);after=_snapshot(current.model_copy(update={'tool':point if point in current.terrain.tool_cells else current.tool}))
                elif command.kind in ('ADD_WALL','REMOVE_WALL','TOGGLE_WALL'):after,debt,events=_edit(current,model,current.tool,command.kind);missing.extend(debt)
                elif command.kind=='RESTORE':after,debt=_restore(current,model);missing.extend(debt)
                if not missing and (after.restore_epoch,after.level_scope_ref)!=(state.restore_epoch,state.level_scope_ref):
                    receipt={'phase_ref':'INPUT','before':current,'after':after,'events':events,'command_ref':command.input_ref,'scope_boundary':True}
                    return ((after,trace+(receipt,),command.cost),),(),(),count,False,True
                outputs=(after,)
            elif phase in ('PRE_CONTACT','POST_CONTACT'):
                after,events=_contact(current,model,before_move if phase=='POST_CONTACT' else None);outputs=(after,)
            elif phase=='MOVE':
                outputs,debt,local_cut,move_work=_moves(current,model,request.maximum_responses,max(0,bound-count));count+=move_work;missing.extend(debt);cut=cut or local_cut
                before_move={a.actor_ref:a.position for a in current.actors}
            elif phase=='ARRIVAL':
                beneficiary=_actors(current)[model.beneficiary_ref];arrived=arrived or beneficiary.alive and beneficiary.position in model.destination
            elif phase=='RESOURCE':after=_snapshot(current.model_copy(update={'remaining_budget':max(0,current.remaining_budget-command.cost)}));outputs=(after,)
            for output in outputs:
                if len(following)>=request.maximum_responses:cut=True;break
                receipt={'phase_ref':phase,'before':current,'after':output,'events':events,'command_ref':command.input_ref}
                following.append((output,trace+(receipt,),arrived,before_move))
        branches=following
        if cut or missing:break
    complete=[]
    if not cut and not missing:
        for current,trace,arrived,before_move in branches:
            beneficiary=_actors(current)[model.beneficiary_ref];arrival=arrived and (beneficiary.alive or not model.goal_requires_alive_after_reaction);exhausted=current.remaining_budget==0
            outcome='GAME_OVER' if not beneficiary.alive and not arrival else 'WIN' if arrival and (model.arrival_resource_priority=='ARRIVAL_FIRST' or not exhausted) else model.exhaustion_outcome if exhausted else 'ACTIVE'
            after=current.model_copy(update={'clock':state.clock+1,'grace_remaining':max(0,state.grace_remaining-1)})
            actors=tuple(a.model_copy(update={'history':(a.history+(a.position,))[-64:]}) for a in after.actors);after=after.model_copy(update={'actors':actors})
            if outcome=='RESTORE':after,debt=_restore(after,model);missing.extend(debt)
            else:after=after.model_copy(update={'status':outcome})
            after=_snapshot(after)
            if model.announce_timing=='NEXT_TURN' and after.status=='ACTIVE' and (after.restore_epoch,after.level_scope_ref)==(state.restore_epoch,state.level_scope_ref):after,debt=_announce(after,model);missing.extend(debt)
            complete.append((after,trace,command.cost))
    return tuple(complete),tuple(dict.fromkeys(missing)),tuple(branches),count,cut,input_applied


def _layers(request):
    result=measure_translated_layers(request);values=dict(result.values);templates={t.template_ref:t for t in request.layer_templates}
    if result.computation_bound_reached:return result
    rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
    layers=tuple({'physical_measurement':row,'component':templates[row['template_ref']].component,'actor_ref':templates[row['template_ref']].actor_ref,
        'generating_snapshot_ref':templates[row['template_ref']].generating_snapshot_ref,'transparent_controller_preserves_substrate':templates[row['template_ref']].declared_transparent,
        'tool_wall_passage_proves_beneficiary_passage':False} for row in rows)
    decoded=[];count=result.examined_count;frontier={};pixels={p.point:p.token_ref for p in request.raw_layer_pixels};missing=list(result.prerequisite_refs)
    for mi,model in enumerate(request.overlay_models):
        alternatives=[None];override_nodes=[]
        for pi,overlay in enumerate(model.overlay_pixels):
            work=max(1,len(model.composition_rows))
            if count+work>request.maximum_evaluations:frontier={'phase':'transparent_underlay','model_index':mi,'pixel_index':pi};break
            count+=work;rendered=pixels.get(overlay.point)
            if rendered is None:missing.append('observed_rendered_overlay_pixel');continue
            underlays=tuple(dict.fromkeys(base for base,top,composite in model.composition_rows if top==overlay.token_ref and composite==rendered))
            if not underlays:alternatives=[];break
            expanded=[]
            for parent in alternatives:
                for token in underlays:
                    if len(expanded)>=request.maximum_responses:frontier={'phase':'transparent_underlay_branches','model_index':mi,'pixel_index':pi};break
                    if count>=request.maximum_evaluations:frontier={'phase':'transparent_underlay_deltas','model_index':mi,'pixel_index':pi};break
                    count+=1;expanded.append(len(override_nodes));override_nodes.append((parent,overlay.point,token))
                if frontier:break
            alternatives=expanded
            if frontier:break
        if frontier:break
        for ai,tail in enumerate(alternatives):
            if count>=request.maximum_evaluations:frontier={'phase':'underlay_template_measurement','model_index':mi,'alternative_index':ai};break
            overrides={};cursor=tail
            while cursor is not None:
                if count>=request.maximum_evaluations:frontier={'phase':'underlay_delta_projection','model_index':mi,'alternative_index':ai,'delta_node_index':cursor};break
                count+=1;cursor,point,token=override_nodes[cursor];overrides.setdefault(point,token)
            if frontier:break
            if count+len(request.raw_layer_pixels)>=request.maximum_evaluations:frontier={'phase':'underlay_raster_projection','model_index':mi,'alternative_index':ai};break
            count+=len(request.raw_layer_pixels)
            raw=tuple(ContactPixel(point=p.point,token_ref=overrides.get(p.point,p.token_ref)) if p.point in overrides else p for p in request.raw_layer_pixels)
            supported=measure_translated_layers(request.model_copy(update={'raw_layer_pixels':raw,
                'layer_templates':tuple(t for t in request.layer_templates if t.component in ('TERRAIN','RAIL','TRAP','DESTINATION')),
                'maximum_evaluations':request.maximum_evaluations-count}))
            count+=supported.examined_count;decoded.append({'composition_model_ref':model.model_ref,'underlay_measurement':supported})
            if supported.computation_bound_reached:frontier={'phase':'underlay_template_measurement','model_index':mi,'alternative_index':ai,'native_frontier':supported.frontier};break
        if frontier:break
    return result.model_copy(update={'values':immutable_json_data({**values,'separate_actor_terrain_announcement_layers':layers,'transparent_underlay_alternatives':decoded}),
        'prerequisite_refs':tuple(dict.fromkeys(missing)),'examined_count':count,'domain_complete':result.domain_complete and not frontier and not missing,
        'computation_bound_reached':bool(frontier),'frontier':immutable_json_data(frontier),
        'descriptive_facts':FrozenMap({**result.descriptive_facts,'prerequisites_empty':not missing,'domain_complete':result.domain_complete and not frontier and not missing,'computation_bound_reached':bool(frontier)})})


def _observed_match(predicted,actual,row):
    a=_actors(predicted);b=_actors(actual)
    if not set(row.observed_actor_refs)<=set(a)&set(b):return False
    for ref in row.observed_actor_refs:
        if (a[ref].position,a[ref].alive,a[ref].condition,a[ref].cadence_elapsed)!=(b[ref].position,b[ref].alive,b[ref].condition,b[ref].cadence_elapsed):return False
        if row.announcements_observed and (a[ref].announced_targets is None or b[ref].announced_targets is None or not set(b[ref].announced_targets)<=set(a[ref].announced_targets)
            or (a[ref].announcement_tick,a[ref].announcement_epoch)!=(b[ref].announcement_tick,b[ref].announcement_epoch)):return False
    if row.terrain_tool_observed and (predicted.tool,predicted.terrain)!=(actual.tool,actual.terrain):return False
    if row.resources_observed and any(getattr(predicted,n)!=getattr(actual,n) for n in ('clock','remaining_budget','grace_remaining','status','restore_epoch','level_scope_ref')):return False
    return True


def _fit(request):
    count=0;rows=[];missing=[];frontier={}
    if not request.models or not request.observations:return family_result(request,prerequisite_refs=('joint_models_and_sealed_action_observations',),domain_complete=False)
    for mi,model in enumerate(request.models):
        compatible=[];refuted=[];unresolved=[]
        for oi,row in enumerate(request.observations):
            if count>=request.maximum_evaluations:frontier={'next_model_index':mi,'next_observation_index':oi};break
            if not row.sealed or row.event_owner_ref!=request.scope.event_owner_ref or row.epoch!=request.scope.epoch or not _bound(row.before,model):unresolved.append(row.observation_ref);missing.append('current_owned_sealed_actor_model_interval');continue
            if not row.observed_actor_refs and not row.terrain_tool_observed and not row.resources_observed:unresolved.append(row.observation_ref);missing.append('observed_joint_fields_mask');continue
            command=next((c for c in model.commands if (c.action_ref,c.payload)==(row.action_ref,row.payload)),None)
            if command is None:refuted.append((row.observation_ref,'exact_input_map'));continue
            successors,debt,partial,visits,cut,applied=_successors(request,row.before,model,command,request.maximum_evaluations-count);count+=visits
            if debt or cut:
                unresolved.append(row.observation_ref);missing.extend(debt)
                if cut:frontier={'next_model_index':mi,'observation_index':oi,'partial_joint_phases':partial};break
                continue
            if any(_observed_match(after,row.after,row) for after,trace,cost in successors):compatible.append(row.observation_ref)
            else:refuted.append((row.observation_ref,'ordered_joint_effect'))
        rows.append({'model_ref':model.model_ref,'compatible_observation_refs':compatible,'refutations':refuted,'unresolved_observation_refs':unresolved,
            'announce_timing':model.announce_timing,'phase_order':model.phase_order,'retained_as_unfalsified_alternative':not refuted})
        if frontier:break
    return family_result(request,values={'joint_behavior_schedule_fit':rows},prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,domain_complete=not frontier and not missing,
        computation_bound_reached=bool(frontier),frontier=frontier)


def _domain_graph(request):
    model=_model(request);nodes=[(request.state,0,None,None)];queue=deque([0]);seen={request.state:0};edges=[];boundaries=[];count=0;cuts=[]
    while queue:
        index=queue.popleft();state,depth,_,_=nodes[index]
        if state.status!='ACTIVE' or (state.restore_epoch,state.level_scope_ref)!=(request.state.restore_epoch,request.state.level_scope_ref):continue
        if request.operation_ref=='intervention_deadlines' and request.event_deadline_tick is not None and state.clock>=request.event_deadline_tick:continue
        if depth>=request.maximum_depth:cuts.append({'node_index':index,'reason':'depth_bound'});continue
        for ci,command in enumerate(model.commands):
            if count>=request.maximum_evaluations:cuts.append({'node_index':index,'next_command_index':ci,'reason':'evaluation_bound'});queue.clear();break
            successors,debt,partial,visits,cut,applied=_successors(request,state,model,command,request.maximum_evaluations-count);count+=visits
            if debt:boundaries.append({'node_index':index,'input_ref':command.input_ref,'prerequisites':debt,'partial_phases':partial})
            if cut:cuts.append({'node_index':index,'input_ref':command.input_ref,'reason':'response_or_phase_bound'})
            for after,phases,cost in successors:
                child=seen.get(after)
                if child is None:
                    if len(nodes)>=request.maximum_states:cuts.append({'node_index':index,'input_ref':command.input_ref,'reason':'state_bound'});continue
                    child=len(nodes);seen[after]=child;nodes.append((after,depth+1,index,len(edges)));queue.append(child)
                edges.append({'from_node':index,'to_node':child,'input_ref':command.input_ref,'cost':cost,'phase_receipts':phases})
    return nodes,edges,boundaries,cuts,count


def _route_predecessor_d(nodes,edges,index,remaining,word_requested=True):
    word=[];trace=[];work=0
    while nodes[index][2] is not None:
        edge=edges[nodes[index][3]];size=3 if word_requested else len(edge['phase_receipts'])+3
        if work+size>remaining:return None,(),work
        work+=size
        if word_requested:word.append(edge['input_ref'])
        if not word_requested:trace.append(edge['phase_receipts'])
        index=nodes[index][2]
    return tuple(reversed(word)),tuple(reversed(trace)),work


def _inverse(request,kind):
    nodes,edges,boundaries,cuts,count=_domain_graph(request);model=_model(request);candidates=[]
    adjacency={}
    if kind=='hold':
        for edge_index,edge in enumerate(edges):
            if count>=request.maximum_evaluations:cuts.append({'phase':'hold_adjacency','next_edge_index':edge_index});break
            count+=1;adjacency.setdefault(edge['from_node'],[]).append(edge)
    if kind!='hold':
        for edge in edges:
            if count+1>request.maximum_evaluations:cuts.append({'phase':'preparation_adjacency'});break
            count+=1;adjacency.setdefault(edge['from_node'],[]).append(edge)
    for index,(state,depth,_,_) in enumerate(nodes):
        actors=_actors(state);beneficiary=actors[model.beneficiary_ref]
        if not beneficiary.alive or state.status=='GAME_OVER':continue
        if len(candidates)>=3:break
        word,trace,work=_route_predecessor_d(nodes,edges,index,request.maximum_evaluations-count,False)
        if word is None:cuts.append({'phase':'preparation_word_reconstruction','node_index':index});break
        count+=work
        if kind=='deadline':
            if state.clock>request.event_deadline_tick:continue
            target=actors.get(request.threatened_actor_ref)
            if target is None:continue
            prevented=not target.alive or target.condition in ('CAPTIVE','HELD') or request.collision_cell in state.terrain.walls
            if not prevented:continue
            if count+3*depth>request.maximum_evaluations:cuts.append({'phase':'deadline_word'});break
            count+=3*depth;word,_,_=_route_predecessor_d(nodes,edges,index,request.maximum_evaluations,True)
            candidates.append({'state':state,'preparation_word':word,'consumer_ref':model.beneficiary_ref,'deadline_tick':request.event_deadline_tick,
                'remaining_ticks':request.event_deadline_tick-state.clock,'competing_actor_states':state.actors,'tool_escape_and_beneficiary_suffix_proved':state.status=='WIN',
                'named_event_scope':(request.threatened_actor_ref,request.collision_cell,request.event_deadline_tick),
                'escape_and_downstream_requirements_remaining':state.status!='WIN'})
        elif kind=='hold':
            if beneficiary.condition!='HELD' or beneficiary.position!=request.hold_cell:continue
            # An actual graph continuation must release, survive and reach WIN.
            future=deque([index]);parents={index:None};release=[]
            while future and count<request.maximum_evaluations:
                cursor=future.popleft();count+=1;current=nodes[cursor][0];actor=_actors(current)[model.beneficiary_ref]
                if current.status=='WIN' and actor.alive and actor.condition=='FREE':
                    suffix=[];child=cursor
                    while parents[child] is not None:
                        if count+1>request.maximum_evaluations:cuts.append({'phase':'release_word_reconstruction'});break
                        count+=1
                        parent,ref=parents[child];suffix.append(ref);child=parent
                    if parents[child] is None:release.append(tuple(reversed(suffix)))
                    break
                if not actor.alive or current.status=='GAME_OVER':continue
                for edge in adjacency.get(cursor,()):
                    if count>=request.maximum_evaluations:cuts.append({'phase':'hold_release_suffix','node_index':cursor,'next_input_ref':edge['input_ref']});break
                    count+=1
                    if edge['to_node'] not in parents:parents[edge['to_node']]=(cursor,edge['input_ref']);future.append(edge['to_node'])
            if future and count>=request.maximum_evaluations:cuts.append({'phase':'hold_release_suffix','pending_nodes':tuple(future)})
            if release:
                if count+3*depth>request.maximum_evaluations:cuts.append({'phase':'hold_word'});break
                count+=3*depth;word,_,_=_route_predecessor_d(nodes,edges,index,request.maximum_evaluations,True)
                start=next((phase['after'].clock for packet in trace for phase in packet if _actors(phase['after'])[model.beneficiary_ref].condition=='HELD'),request.state.clock)
                candidates.append({'held_state':state,'hold_word':word,'actual_release_and_completion_word':release[0],
                    'hold_start_tick':start,'prepared_held_duration':state.clock-start,'release_and_completion_tick_bound':state.clock+len(release[0]),
                    'release_cell':request.hold_cell,'protected_consumer_ref':model.beneficiary_ref})
        else:
            occupants=tuple(a for a in state.actors if a.position==request.trap_cell)
            if not depth:continue
            transitions=tuple(event for packet in trace for phase in packet if phase['phase_ref']=='INPUT' and phase['before'].tool==request.trap_cell for event in phase['events'])
            capture=any(event[2]=='CAPTIVE' for event in transitions if len(event)==3)
            removal=any(event[2]=='REMOVED' for event in transitions if len(event)==3)
            reopening=any(phase['phase_ref']=='INPUT' and phase['before'].tool==request.trap_cell and request.trap_cell in phase['before'].terrain.walls and request.trap_cell not in phase['after'].terrain.walls for packet in trace for phase in packet)
            bypass=state.status=='WIN' and not transitions
            if not capture and not removal and not reopening and not bypass:continue
            opening_suffix=()
            if reopening:
                opened=False;used_in_preparation=False
                for packet in trace:
                    for phase in packet:
                        if phase['phase_ref']=='INPUT' and phase['before'].tool==request.trap_cell:
                            if request.trap_cell in phase['before'].terrain.walls and request.trap_cell not in phase['after'].terrain.walls:opened=True
                            elif request.trap_cell in phase['after'].terrain.walls:opened=False
                        if opened and phase['phase_ref']=='MOVE' and _actors(phase['after'])[model.beneficiary_ref].position==request.trap_cell:
                            used_in_preparation=True
                future=deque([(index,used_in_preparation)]);parents={(index,used_in_preparation):None};found=None
                while future and count<request.maximum_evaluations:
                    cursor,used=future.popleft();count+=1;current=nodes[cursor][0];actor=_actors(current)[model.beneficiary_ref]
                    if current.status=='WIN' and actor.alive and used:found=(cursor,used);break
                    if not actor.alive or current.status=='GAME_OVER':continue
                    for edge in adjacency.get(cursor,()):
                        work=len(edge['phase_receipts'])+1
                        if count+work>request.maximum_evaluations:cuts.append({'phase':'opening_use_suffix','node_index':cursor});break
                        count+=work
                        crossed=any(phase['phase_ref']=='MOVE' and _actors(phase['after'])[model.beneficiary_ref].position==request.trap_cell
                            and _actors(phase['before'])[model.beneficiary_ref].position!=request.trap_cell for phase in edge['phase_receipts'])
                        key=(edge['to_node'],used or crossed)
                        if key not in parents:parents[key]=((cursor,used),edge['input_ref']);future.append(key)
                if found is None:continue
                suffix=[];child=found
                while parents[child] is not None:
                    if count+1>request.maximum_evaluations:cuts.append({'phase':'opening_word_reconstruction'});break
                    count+=1
                    parent,ref=parents[child];suffix.append(ref);child=parent
                if parents[child] is not None:continue
                opening_suffix=tuple(reversed(suffix))
            if count+3*depth>request.maximum_evaluations:cuts.append({'phase':'trap_word'});break
            count+=3*depth;word,_,_=_route_predecessor_d(nodes,edges,index,request.maximum_evaluations,True)
            candidates.append({'state':state,'actual_input_word':word,'trap_cell':request.trap_cell,'wall_present':request.trap_cell in state.terrain.walls,
                'occupant_states':occupants,'capture_observed_in_model':capture,'reopening_in_word':reopening,'removal_in_word':removal,'bypass_completion_found':bypass,
                'reopening_captive_rule':model.reopen_captive,'terrain_restore_is_world_restore':False,'all_adversaries_neutralization_required':False})
            candidates[-1]['opening_use_and_completion_word']=opening_suffix
        if len(candidates)>=3:break
    return family_result(request,values={'preparation_candidates':candidates,'nodes_examined':len(nodes),'observation_boundaries':boundaries},examined_count=count,
        domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'nodes':nodes,'edges':edges} if cuts else {})


def _compare(request):
    expected=request.expected_state;actual=request.actual_state;a=_actors(expected);b=_actors(actual)
    from .articulated_dependency_measurement_c import _nodes
    work=_nodes(immutable_json_data((expected,actual)),request.maximum_evaluations)
    if work is None or 2*work>request.maximum_evaluations:
        return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'full_intervention_snapshot_compare'})
    differences=tuple((ref,a.get(ref),b.get(ref)) for ref in sorted(set(a)|set(b)) if a.get(ref)!=b.get(ref))
    fields=tuple((n,getattr(expected,n),getattr(actual,n)) for n in ('tool','terrain','clock','grace_remaining','remaining_budget','status','level_scope_ref','restore_epoch') if getattr(expected,n)!=getattr(actual,n))
    return family_result(request,values={'per_actor_differences':differences,'tool_terrain_resource_scope_differences':fields,
        'first_snapshot_discrepancy':differences[0] if differences else fields[0] if fields else None,
        'effective_edit_invalidated_by_one_wait':False,'same_restore_counter_proves_equal_geometry':False},examined_count=2*work)


def measure_autonomous_route_intervention(request: RouteInterventionRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    required={'actor_layers':('raw_layer_pixels','layer_templates'),'announce_order':('models','observations'),'behavior_alternatives':('models','observations'),
        'terrain_intervention':('state','models','bound_model_ref','addressed_cell','edit_kind'),'announced_transition':('state','models','bound_model_ref','input_ref'),
        'intervention_deadlines':('state','models','bound_model_ref','collision_cell','threatened_actor_ref','event_deadline_tick'),
        'hold_release':('state','models','bound_model_ref','hold_cell'),'trap_reuse':('state','models','bound_model_ref','trap_cell'),
        'joint_intervention_domain':('state','models','bound_model_ref'),'intervention_compare':('expected_state','actual_state')}
    missing=missing_supplied_fields(request,required[request.operation_ref])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    op=request.operation_ref
    if op=='actor_layers':return _layers(request)
    if op in ('announce_order','behavior_alternatives'):return _fit(request)
    if op=='intervention_compare':return _compare(request)
    model=_model(request)
    if model is None or not _bound(request.state,model):return family_result(request,prerequisite_refs=('current_whole_joint_model_and_actor_ownership',),domain_complete=False)
    if op=='terrain_intervention':
        if max(1,len(request.state.actors))>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'terrain_actor_effect','next_actor_index':0})
        after,debt,events=_edit(request.state,model,request.addressed_cell,request.edit_kind)
        return family_result(request,values={'after_state':after,'local_terrain_actor_events':events,'external_command_count':0,'clock_advanced':False},prerequisite_refs=debt,examined_count=len(request.state.actors))
    if op in ('intervention_deadlines','hold_release','trap_reuse'):return _inverse(request,'deadline' if op=='intervention_deadlines' else 'hold' if op=='hold_release' else 'trap')
    if op=='joint_intervention_domain':
        nodes,edges,boundaries,cuts,count=_domain_graph(request)
        return family_result(request,values={'nodes':nodes,'edges':edges,'observation_boundaries':boundaries,'robust_policy_proved':False},examined_count=count,
            domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'nodes':nodes,'edges':edges} if cuts else {})
    command=next((c for c in model.commands if c.input_ref==request.input_ref),None)
    if command is None:return family_result(request,prerequisite_refs=('grounded_actual_tool_command',),domain_complete=False)
    successors,debt,partial,count,cut,applied=_successors(request,request.state,model,command,request.maximum_evaluations)
    return family_result(request,values={'joint_successors':tuple({'after_state':s,'phase_receipts':p,'actual_cost':c} for s,p,c in successors),
        'partial_joint_phases':partial,'external_command_count':int(applied),'event_owner_ref':request.scope.event_owner_ref},prerequisite_refs=debt,examined_count=count,
        domain_complete=not debt and not cut,computation_bound_reached=cut,frontier={'partial_phases':partial} if cut else {})
