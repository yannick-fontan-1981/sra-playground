"""Bounded hidden lineages and arrival-scoped reception under supplied laws.

Prediction under fog is not a new observation. Every mover owns its cadence,
phase and miss restart; a request acquisition and a later hazard can coexist.
"""
from collections import deque
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap,FrozenModel,Ref,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields
from .identity_contact_authentication import ContactMotion,ContactPixel,ContactLayerTemplate,ContactLayerSample,_candidate_layers as measure_translated_layers,_advance_motion
from .mutable_kit_survival import KitEventTrace as ReceptionEventTrace

Point=tuple[int,int]
CARDINALS=((0,-1),(0,1),(-1,0),(1,0),(0,0))


class ReceptionMover(FrozenModel):
    occurrence_ref: Ref
    lineage_ref: Ref
    signature_ref: Ref
    role: Literal['REQUESTED','HAZARD','UNKNOWN']
    request_ref: Ref | None = None
    motion: ContactMotion | None = None
    position: Point
    active: bool
    @model_validator(mode='after')
    def phase(self):
        if self.motion is not None and self.position!=self.motion.path[self.motion.phase]:raise ValueError('occurrence and current route phase agree')
        if self.role=='REQUESTED' and self.request_ref is None:raise ValueError('request counterpart belongs to a lineage, not its color alone')
        return self


class ReceptionSupport(FrozenModel):
    support_ref: Ref
    position: Point
    admissible_modes: tuple[Ref,...] = Field(max_length=32)
    request_refs: tuple[Ref,...] = Field(max_length=32)


class ReceptionState(FrozenModel):
    carrier_ref: Ref
    carrier: Point
    cells: tuple[Point,...] = Field(min_length=1,max_length=4096)
    walls: tuple[Point,...] = Field(max_length=4096)
    fog: tuple[Point,...] = Field(max_length=4096)
    supports: tuple[ReceptionSupport,...] = Field(max_length=128)
    movers: tuple[ReceptionMover,...] = Field(max_length=64)
    route_mode_ref: Ref
    lever_count: int = Field(ge=0,le=65536)
    acquired_request_refs: tuple[Ref,...] = Field(max_length=64)
    required_request_refs: tuple[Ref,...] = Field(max_length=64)
    clock: int = Field(ge=0)
    remaining_budget: int = Field(ge=0,le=65536)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def domains(self):
        if self.carrier not in self.cells or not set(self.walls+self.fog)<=set(self.cells):raise ValueError('observed cell and opacity masks remain separate')
        if len({m.occurrence_ref for m in self.movers})!=len(self.movers):raise ValueError('phase-shifted occurrences are never merged by lineage')
        if len({s.support_ref for s in self.supports})!=len(self.supports):raise ValueError('receiving supports retain occurrence identity')
        if len(set(self.acquired_request_refs))!=len(self.acquired_request_refs) or len(set(self.required_request_refs))!=len(self.required_request_refs):raise ValueError('per-request acquisition flags are distinct')
        return self


class ReceptionClock(FrozenModel):
    mover_ref: Ref
    ticks: int = Field(ge=0,le=16)


class ReceptionCommand(FrozenModel):
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    delta: Point
    clock_rows: tuple[ReceptionClock,...] = Field(max_length=64)
    cost: int = Field(ge=0,le=65536)
    @model_validator(mode='after')
    def clocks(self):
        if self.delta not in CARDINALS:raise ValueError('a stationary input exists only when supplied by caller')
        if len({r.mover_ref for r in self.clock_rows})!=len(self.clock_rows):raise ValueError('one scoped clock per mover and input class')
        return self


class ReceptionRoute(FrozenModel):
    mode_ref: Ref
    mover_ref: Ref
    path: tuple[Point,...] = Field(min_length=1,max_length=256)
    arrival_pauses: tuple[int,...] | None = Field(default=None,max_length=256)
    @model_validator(mode='after')
    def pauses(self):
        if self.arrival_pauses is not None and (len(self.arrival_pauses)!=len(self.path) or any(n<0 or n>65536 for n in self.arrival_pauses)):raise ValueError('current revised route owns its pause table')
        return self


class ReceptionLever(FrozenModel):
    position: Point
    activation_events: tuple[Literal['CONTACT','FLEE','BLOCKED_FLEE'],...] = Field(max_length=3)
    threshold: int = Field(ge=1,le=65536)
    counting: Literal['CUMULATIVE','CONSECUTIVE']
    contact_mode: Literal['ENTER','PRESENT']
    mode_cycle: tuple[Ref,...] = Field(min_length=1,max_length=32)
    reset_phase_on_revision: bool
    reset_cadence_on_revision: bool


class ReceptionModel(FrozenModel):
    model_ref: Ref
    commands: tuple[ReceptionCommand,...] = Field(min_length=1,max_length=64)
    routes: tuple[ReceptionRoute,...] = Field(max_length=1024)
    lever: ReceptionLever | None = None
    phase_order: tuple[Literal['CARRIER','REVISION','MOVERS','ARRIVALS','HAZARDS','COMPLETION'],...] = Field(min_length=6,max_length=6)
    stationary_overlap_accepts: bool
    acquired_latches: bool
    acquired_occurrence: Literal['CONTINUE','REMOVE','STOP']
    missed_arrival: Literal['CONTINUE','RESTART_OWN_MOVER']
    arrival_timing: Literal['AFTER_ALL_MOTION','EACH_CLOCK_TICK']
    miss_restart_phase: int = Field(ge=0,le=255)
    miss_restart_cadence: bool
    hazard_distance: int = Field(ge=0,le=16)
    completion_hazard_priority: Literal['COMPLETION_FIRST','HAZARD_FIRST']
    budget_admission: Literal['REFUSE_BEFORE_INPUT','ALLOW_EXHAUSTING_INPUT']
    exhaustion_outcome: Literal['LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def whole_law(self):
        if set(self.phase_order)!={'CARRIER','REVISION','MOVERS','ARRIVALS','HAZARDS','COMPLETION'}:raise ValueError('each declared joint phase appears exactly once')
        if len({c.input_ref for c in self.commands})!=len(self.commands) or len({(c.action_ref,c.payload) for c in self.commands})!=len(self.commands):raise ValueError('input map is exact')
        if len({(r.mode_ref,r.mover_ref) for r in self.routes})!=len(self.routes):raise ValueError('one whole route per mode and occurrence')
        return self


class VisibleReceptionSample(FrozenModel):
    sample_ref: Ref
    position: Point
    compatible_signature_refs: tuple[Ref,...] = Field(min_length=1,max_length=32)
    known_occurrence_ref: Ref | None = None


class ReceptionObservation(FrozenModel):
    observation_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    before: ReceptionState
    after: ReceptionState
    action_ref: Ref
    payload: FrozenMap
    visible_samples: tuple[VisibleReceptionSample,...] = Field(max_length=64)
    visible_population_complete: bool
    carrier_mode_acquisitions_observed: bool
    resources_observed: bool


class ReceptionLayerTemplate(ContactLayerTemplate):
    component: Literal['CARRIER_CORNERS','CONCAVE_SUPPORT','REQUEST_SILHOUETTE','MOVING_BODY','HAZARD','RAIL','OPAQUE','LEVER']
    request_ref: Ref | None = None
    counterpart_geometry_ref: Ref | None = None


from .reception_wait_contracts_d import ReceptionWaitBudgetD


class HiddenReceptionRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.hidden_reception_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=128)
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_correspondences: int = Field(ge=1,le=128)
    state: ReceptionState | None = None
    state_alternatives: tuple[ReceptionState,...] = Field(default=(),max_length=128)
    models: tuple[ReceptionModel,...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    input_ref: Ref | None = None
    observations: tuple[ReceptionObservation,...] = Field(default=(),max_length=256)
    arrival_mover_refs: tuple[Ref,...] = Field(default=(),max_length=64)
    lever_event: Literal['CONTACT','FLEE','BLOCKED_FLEE','NONE'] | None = None
    horizon_ticks: int | None = Field(default=None,ge=0,le=128)
    wait_budget: ReceptionWaitBudgetD | None = None
    stationary_time_claim_ref: Ref | None = None
    receiving_support_ref: Ref | None = None
    missing_request_ref: Ref | None = None
    expected_state: ReceptionState | None = None
    actual_state: ReceptionState | None = None
    expected_trace: ReceptionEventTrace | None = None
    actual_trace: ReceptionEventTrace | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[ReceptionLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    @model_validator(mode='after')
    def references(self):
        for rows,name in ((self.models,'model_ref'),(self.observations,'observation_ref'),(self.layer_templates,'template_ref')):
            if len({getattr(r,name) for r in rows})!=len(rows):raise ValueError('model and evidence identities remain distinct')
        if len({p.point for p in self.raw_layer_pixels})!=len(self.raw_layer_pixels):raise ValueError('one current token per pixel')
        return self


OPERATION_MODES={'receiver_request_layers':'MEASURE','hidden_track_sets':'FIT','multi_clock_fit':'FIT','reception_event':'PRECONDITION',
    'route_revision':'STEP_INTERNAL','reception_successor':'STEP','arrival_windows':'INVERSE_DOMAIN','approach_hold_domain':'DOMAIN',
    'intervention_preimages':'INVERSE_DOMAIN','reception_compare':'COMPARE'}


def _model(request):return next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
def _movers(state):return {m.occurrence_ref:m for m in state.movers}
def _add(p,d):return (p[0]+d[0],p[1]+d[1])
def _distance(a,b):return abs(a[0]-b[0])+abs(a[1]-b[1])


def _revision(state,model,event):
    law=model.lever
    if law is None:return state,(),()
    count=state.lever_count+1 if event in law.activation_events else 0 if law.counting=='CONSECUTIVE' else state.lever_count
    if count<law.threshold:return state.model_copy(update={'lever_count':count}),(),()
    if state.route_mode_ref not in law.mode_cycle:return state,('current_mode_in_supplied_lever_cycle',),()
    mode=law.mode_cycle[(law.mode_cycle.index(state.route_mode_ref)+1)%len(law.mode_cycle)];routes={(r.mode_ref,r.mover_ref):r for r in model.routes};movers=[];missing=[]
    for mover in state.movers:
        route=routes.get((mode,mover.occurrence_ref))
        if route is None or mover.motion is None:missing.append('revised_route_and_retained_clock.'+mover.occurrence_ref);movers.append(mover);continue
        phase=0 if law.reset_phase_on_revision else mover.motion.phase
        if phase>=len(route.path):missing.append('retained_phase_in_revised_route.'+mover.occurrence_ref);movers.append(mover);continue
        pauses=route.arrival_pauses if route.arrival_pauses is not None else mover.motion.arrival_pauses
        if len(pauses)!=len(route.path):missing.append('supported_pause_table_for_revised_route.'+mover.occurrence_ref);movers.append(mover);continue
        motion=mover.motion.model_copy(update={'path':route.path,'phase':phase,'arrival_pauses':pauses,
            'cadence_elapsed':0 if law.reset_cadence_on_revision else mover.motion.cadence_elapsed})
        movers.append(mover.model_copy(update={'motion':motion,'position':motion.path[phase]}))
    if missing:return state,tuple(missing),()
    return state.model_copy(update={'movers':tuple(movers),'route_mode_ref':mode,'lever_count':0}),(),(('ROUTE_REVISION',state.route_mode_ref,mode),)


def _advance(state,model,command,bound):
    clocks={r.mover_ref:r.ticks for r in command.clock_rows};arrivals=[];missing=[];events=[];count=0;frontier={};current=state
    for mi,original in enumerate(state.movers):
        mover=_movers(current)[original.occurrence_ref]
        if not mover.active:continue
        if mover.occurrence_ref not in clocks or mover.motion is None:missing.append('scoped_mover_clock_route.'+mover.occurrence_ref);continue
        for tick in range(clocks[mover.occurrence_ref]):
            work=max(1,len(current.movers)+len(current.supports))
            if count+work>bound:frontier={'mover_index':mi,'next_clock_tick':tick};break
            count+=work;mover=_movers(current)[original.occurrence_ref]
            if not mover.active:break
            motion=mover.motion;old=motion.path[motion.phase];motion=_advance_motion(motion);new=motion.path[motion.phase]
            updated=mover.model_copy(update={'motion':motion,'position':new});current=current.model_copy(update={'movers':tuple(updated if m.occurrence_ref==updated.occurrence_ref else m for m in current.movers)})
            if old!=new:
                events.append((mover.occurrence_ref,'MOTION',old,new,tick))
                if any(s.position==new for s in current.supports):
                    arrival=(mover.occurrence_ref,new,tick)
                    if model.arrival_timing=='EACH_CLOCK_TICK':
                        current,reception_events,debt=_arrival_events(current,model,(arrival,),False);events.extend(reception_events);missing.extend(debt)
                    else:arrivals.append(arrival)
        if frontier:break
    return current,tuple(arrivals),tuple(events),tuple(missing),count,frontier


def _arrival_events(state,model,arrivals,include_stationary=True):
    acquired=set(state.acquired_request_refs);movers=_movers(state);events=[];missing=[]
    candidates=arrivals
    if model.stationary_overlap_accepts and include_stationary:candidates=tuple(candidates)+tuple((m.occurrence_ref,m.position,-1) for m in state.movers if m.active and m.position==state.carrier)
    for ref,point,tick in candidates:
        mover=movers.get(ref)
        if mover is None:missing.append('arrival_occurrence');continue
        if mover.role=='UNKNOWN':missing.append('arrival_lineage_request_or_hazard_role.'+ref);continue
        if mover.role!='REQUESTED':continue
        supports=tuple(s for s in state.supports if s.position==point and mover.request_ref in s.request_refs)
        accepted=any(state.carrier==s.position and state.route_mode_ref in s.admissible_modes for s in supports)
        if accepted:
            acquired.add(mover.request_ref);events.append((ref,'ACQUIRE',mover.request_ref,point,tick))
            if model.acquired_occurrence=='REMOVE':movers[ref]=mover.model_copy(update={'active':False})
            elif model.acquired_occurrence=='STOP':
                if mover.motion is None:missing.append('stopped_acquired_motion.'+ref)
                else:movers[ref]=mover.model_copy(update={'motion':mover.motion.model_copy(update={'path_mode':'STOP','path':(point,), 'phase':0,'arrival_pauses':(0,),'pause_remaining':0}), 'position':point})
        else:
            events.append((ref,'MISS',mover.request_ref,point,tick))
            if model.missed_arrival=='RESTART_OWN_MOVER':
                if mover.motion is None or model.miss_restart_phase>=len(mover.motion.path):missing.append('qualified_own_mover_miss_restart.'+ref);continue
                motion=mover.motion.model_copy(update={'phase':model.miss_restart_phase,'cadence_elapsed':0 if model.miss_restart_cadence else mover.motion.cadence_elapsed})
                movers[ref]=mover.model_copy(update={'motion':motion,'position':motion.path[motion.phase]})
    if not model.acquired_latches:
        retained=tuple(movers[original.occurrence_ref].request_ref for original in state.movers if movers[original.occurrence_ref].role=='REQUESTED' and movers[original.occurrence_ref].position==state.carrier)
        acquired.intersection_update(retained)
    return state.model_copy(update={'movers':tuple(movers[m.occurrence_ref] for m in state.movers),'acquired_request_refs':tuple(sorted(acquired))}),tuple(events),tuple(dict.fromkeys(missing))


def _step(request,state,model,command,bound):
    if state.status!='ACTIVE':return state,(),('authoritative_reception_terminal',),0,{},False
    if command.cost>state.remaining_budget and model.budget_admission=='REFUSE_BEFORE_INPUT':return state,(),('remaining_reception_budget',),0,{},False
    current=state;trace=[];missing=[];arrivals=();lever_event='NONE';hazard=False;complete=False;count=0;frontier={};applied=False
    for pi,phase in enumerate(model.phase_order):
        work=max(1,len(current.movers)+len(current.supports))
        if count+work>bound:frontier={'next_phase_index':pi,'partial_state':current};break
        count+=work;before=current;events=()
        if phase=='CARRIER':
            destination=_add(current.carrier,command.delta);free=destination in current.cells and destination not in current.walls;new=destination if free else current.carrier;applied=True
            if model.lever is not None:
                lever=model.lever.position
                if before.carrier==lever and destination!=lever:lever_event='FLEE' if free else 'BLOCKED_FLEE'
                elif new==lever and (model.lever.contact_mode=='PRESENT' or before.carrier!=lever):lever_event='CONTACT'
            current=current.model_copy(update={'carrier':new})
        elif phase=='REVISION':current,debt,events=_revision(current,model,lever_event);missing.extend(debt)
        elif phase=='MOVERS':
            current,arrivals,events,debt,visits,cut=_advance(current,model,command,max(0,bound-count));missing.extend(debt);count+=visits
            if cut:frontier={'phase':'mover_ticks','partial_state':current,'native_frontier':cut}
        elif phase=='ARRIVALS':current,events,debt=_arrival_events(current,model,arrivals);missing.extend(debt)
        elif phase=='HAZARDS':
            dangerous=tuple(m.occurrence_ref for m in current.movers if m.active and m.role=='HAZARD' and _distance(current.carrier,m.position)<=model.hazard_distance)
            unknown=tuple(m.occurrence_ref for m in current.movers if m.active and m.role=='UNKNOWN' and _distance(current.carrier,m.position)<=model.hazard_distance)
            if unknown:missing.extend('current_collision_role.'+ref for ref in unknown)
            hazard=bool(dangerous);events=tuple((ref,'HAZARD_CONTACT') for ref in dangerous)
        else:complete=set(current.required_request_refs)<=set(current.acquired_request_refs)
        trace.append({'phase_ref':phase,'before':before,'after':current,'events':events})
        if missing or frontier:break
    if not missing and not frontier:
        remaining=max(0,state.remaining_budget-command.cost)
        outcome='WIN' if complete and (not hazard or model.completion_hazard_priority=='COMPLETION_FIRST') else 'GAME_OVER' if hazard else model.exhaustion_outcome if remaining==0 else 'ACTIVE'
        current=current.model_copy(update={'status':outcome,'remaining_budget':remaining,'clock':state.clock+1})
    return current,tuple(trace),tuple(dict.fromkeys(missing)),count,frontier,applied


def _layers(request):
    result=measure_translated_layers(request);values=dict(result.values);templates={t.template_ref:t for t in request.layer_templates};rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
    return result.model_copy(update={'values':immutable_json_data({**values,'receiver_request_layer_candidates':tuple({'physical_measurement':r,'component':templates[r['template_ref']].component,
        'request_ref':templates[r['template_ref']].request_ref,'counterpart_geometry_ref':templates[r['template_ref']].counterpart_geometry_ref,
        'equal_HUD_world_color_required':False,'hazard_request_merged_from_shape':False} for r in rows)})})


def _correspondences(state,row,bound,maximum):
    visible=tuple(m for m in state.movers if m.active and m.position not in state.fog);possibilities=[()];count=0;frontier={}
    for si,sample in enumerate(row.visible_samples):
        following=[]
        for assigned in possibilities:
            used={ref for _,ref in assigned}
            for mover in visible:
                if count>=bound:frontier={'sample_index':si,'assigned_prefix':assigned};break
                count+=1
                if mover.occurrence_ref in used or mover.position!=sample.position or mover.signature_ref not in sample.compatible_signature_refs or sample.known_occurrence_ref is not None and sample.known_occurrence_ref!=mover.occurrence_ref:continue
                if len(following)>=maximum:frontier={'sample_index':si,'reason':'correspondence_bound'};break
                following.append(assigned+((sample.sample_ref,mover.occurrence_ref),))
            if frontier:break
        possibilities=following
        if frontier or not possibilities:break
    if row.visible_population_complete:possibilities=[p for p in possibilities if len(p)==len(visible)]
    return tuple(possibilities),count,frontier


def _fit(request):
    if not request.models or not request.observations:return family_result(request,prerequisite_refs=('reception_models_and_owned_observations',),domain_complete=False)
    rows=[];count=0;frontier={};missing=[]
    for mi,model in enumerate(request.models):
        retained=[];refuted=[]
        for oi,row in enumerate(request.observations):
            if not row.sealed or row.event_owner_ref!=request.scope.event_owner_ref or row.epoch!=request.scope.epoch:missing.append('current_sealed_reception_interval');continue
            command=next((c for c in model.commands if (c.action_ref,c.payload)==(row.action_ref,row.payload)),None)
            if command is None:refuted.append((row.observation_ref,'actual_input_clock_map'));continue
            alternatives=request.state_alternatives or (row.before,)
            compatible=[]
            for ai,before in enumerate(alternatives):
                if (before.clock,before.level_scope_ref,before.restore_epoch,before.carrier_ref)!=(row.before.clock,row.before.level_scope_ref,row.before.restore_epoch,row.before.carrier_ref):missing.append('current_scoped_hidden_state_alternative');continue
                if count>=request.maximum_evaluations:frontier={'model_index':mi,'observation_index':oi,'state_alternative_index':ai};break
                after,trace,debt,visits,cut,applied=_step(request,before,model,command,request.maximum_evaluations-count);count+=visits;missing.extend(debt)
                if cut:frontier={'model_index':mi,'observation_index':oi,'native_frontier':cut};break
                if debt:continue
                mappings,visits,cut=_correspondences(after,row,request.maximum_evaluations-count,request.maximum_correspondences);count+=visits
                if cut:frontier={'phase':'visible_correspondence','native_frontier':cut};break
                if row.carrier_mode_acquisitions_observed and (after.carrier,after.route_mode_ref,after.acquired_request_refs)!=(row.after.carrier,row.after.route_mode_ref,row.after.acquired_request_refs):continue
                if row.resources_observed and any(getattr(after,n)!=getattr(row.after,n) for n in ('clock','remaining_budget','status','restore_epoch','level_scope_ref')):continue
                if mappings:compatible.append({'before_hypothesis':before,'predicted_hidden_state':after,'visible_correspondences':mappings,'prediction_is_observation':False})
            if compatible:retained.append({'observation_ref':row.observation_ref,'compatible_lineage_states':compatible})
            elif not missing and not frontier:refuted.append((row.observation_ref,'sealed_visible_or_clock_constraints'))
            if frontier:break
        rows.append({'model_ref':model.model_ref,'retained_intervals':retained,'refutations':refuted,'HUD_counter_is_mover_period':False})
        if frontier:break
    return family_result(request,values={'hidden_lineage_clock_fit':rows},prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,
        domain_complete=not missing and not frontier,computation_bound_reached=bool(frontier),frontier=frontier)


def _windows(request):
    model=_model(request);support=next((s for s in request.state.supports if s.support_ref==request.receiving_support_ref),None)
    if support is None:return family_result(request,prerequisite_refs=('current_requested_receiving_support',),domain_complete=False)
    alternatives=request.state_alternatives or (request.state,);rows=[];count=0;frontier={};missing=[]
    command=next((c for c in model.commands if c.input_ref==request.input_ref),None)
    if command is None:return family_result(request,prerequisite_refs=('established_stationary_time_advancing_input',),domain_complete=False)
    budget=request.wait_budget
    if (budget is None or budget.parent_goal_ref!=request.scope.parent_goal_ref
            or budget.parent_contribution_ref!=request.scope.parent_contribution_ref
            or budget.consumer_request_ref not in support.request_refs
            or budget.level_scope_ref!=request.state.level_scope_ref or budget.restore_epoch!=request.state.restore_epoch
            or budget.observed_clock!=request.state.clock or budget.ledger_claim_ref not in request.scope.assumption_refs
            or budget.spent_wait_primitives>budget.maximum_total_wait_primitives):
        return family_result(request,prerequisite_refs=('current_same_consumer_cumulative_wait_ledger',),domain_complete=False)
    observed_hold=any(row.sealed and row.event_owner_ref==request.scope.event_owner_ref and row.epoch==request.scope.epoch
        and (row.action_ref,row.payload)==(command.action_ref,command.payload)
        and row.before.carrier==row.after.carrier==request.state.carrier
        and row.after.clock>row.before.clock and row.resources_observed
        and row.before.level_scope_ref==row.after.level_scope_ref==request.state.level_scope_ref
        and row.before.restore_epoch==row.after.restore_epoch==request.state.restore_epoch for row in request.observations)
    if (request.stationary_time_claim_ref not in request.scope.assumption_refs or not observed_hold
            or not any(clock.ticks>0 for clock in command.clock_rows)):
        return family_result(request,prerequisite_refs=('current_observed_stationary_time_advancing_input',),domain_complete=False)
    horizon=min(request.horizon_ticks,budget.maximum_total_wait_primitives-budget.spent_wait_primitives)
    for ai,state in enumerate(alternatives):
        if (state.clock,state.level_scope_ref,state.restore_epoch,state.carrier_ref)!=(request.state.clock,
                request.state.level_scope_ref,request.state.restore_epoch,request.state.carrier_ref):
            missing.append('current_scoped_wait_phase_alternative');break
        windows=[]
        predicted_spent=budget.spent_wait_primitives
        for tick in range(horizon):
            if count>=request.maximum_evaluations:frontier={'alternative_index':ai,'next_window_tick':tick};break
            after,trace,debt,visits,cut,applied=_step(request,state,model,command,request.maximum_evaluations-count);count+=visits;missing.extend(debt)
            if after.carrier!=state.carrier:missing.append('stationary_input_at_current_receiving_window');break
            if applied:predicted_spent+=1
            for phase in trace:
                for event in phase['events']:
                    if len(event)>=4 and event[1] in ('ACQUIRE','MISS') and event[3]==support.position:windows.append((tick+1,event[0],event[2],event[1]))
            state=after
            if cut:frontier={'alternative_index':ai,'next_window_tick':tick,'native_frontier':cut};break
            if debt or after.status!='ACTIVE':break
        rows.append({'alternative_index':ai,'windows':tuple(windows),'after_prediction':state,
            'consumer_request_ref':budget.consumer_request_ref,'predicted_spent_wait_primitives':predicted_spent,
            'maximum_total_wait_primitives':budget.maximum_total_wait_primitives,
            'wait_ledger_claim_ref':budget.ledger_claim_ref,'actual_wait_ledger_published':False})
        if frontier:break
    sets=[set((tick,request_ref) for tick,occurrence,request_ref,event in row['windows']) for row in rows]
    possible=set().union(*sets) if sets else set();covered=bool(sets) and len(rows)==len(alternatives) and not frontier and not missing and request.scope.input_domain_complete
    robust=set.intersection(*sets) if covered else set()
    accepted=[set((tick,request_ref) for tick,occurrence,request_ref,event in row['windows'] if event=='ACQUIRE') for row in rows]
    possible_accepted=set().union(*accepted) if accepted else set();robust_accepted=set.intersection(*accepted) if covered else set()
    return family_result(request,values={'per_alternative_windows':rows,'possible_arrival_windows':tuple(sorted(possible)),'robust_arrival_windows':tuple(sorted(robust)),
        'possible_accepted_windows':tuple(sorted(possible_accepted)),'robust_accepted_windows':tuple(sorted(robust_accepted)),
        'assumption_refs':request.scope.assumption_refs},prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,domain_complete=not missing and not frontier,
        computation_bound_reached=bool(frontier),frontier=frontier)


def _domain(request,intervention=False):
    model=_model(request);nodes=[(request.state,0,None,None,False)];queue=deque([0]);seen={request.state:0};edges=[];cuts=[];boundaries=[];count=0
    while queue:
        index=queue.popleft();state,depth,_,_,revised=nodes[index]
        if state.status!='ACTIVE':continue
        if depth>=request.maximum_depth:cuts.append({'node_index':index,'reason':'depth_bound'});continue
        for ci,command in enumerate(model.commands):
            if count>=request.maximum_evaluations:cuts.append({'node_index':index,'next_command_index':ci,'reason':'work_bound'});queue.clear();break
            after,trace,debt,visits,cut,applied=_step(request,state,model,command,request.maximum_evaluations-count);count+=visits
            if debt:boundaries.append({'node_index':index,'input_ref':command.input_ref,'prerequisites':debt,'partial_trace':trace})
            if cut:cuts.append({'node_index':index,'input_ref':command.input_ref,'native_frontier':cut})
            if debt or cut:continue
            child=seen.get(after)
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'node_index':index,'input_ref':command.input_ref,'reason':'state_bound'});continue
                child=len(nodes);seen[after]=child;nodes.append((after,depth+1,index,command.input_ref,
                    revised or after.route_mode_ref!=state.route_mode_ref));queue.append(child)
            edges.append({'from_node':index,'to_node':child,'input_ref':command.input_ref,'phase_receipts':trace,'cost':command.cost})
    witnesses=[];preparations=[];current_mode_support=False
    for index,(state,depth,_,_,revised) in enumerate(nodes):
        supports=tuple(s.support_ref for s in state.supports if state.route_mode_ref in s.admissible_modes and request.missing_request_ref in s.request_refs)
        if not revised and state.status in ('ACTIVE','WIN') and any(s.support_ref in supports and s.position==state.carrier for s in state.supports):
            current_mode_support=True
        complete=state.status=='WIN'
        preparation=intervention and revised and bool(supports) and state.status=='ACTIVE'
        if not complete and not preparation:continue
        if len(witnesses)+len(preparations)>=3:continue
        if count+3*depth>request.maximum_evaluations:cuts.append({'node_index':index,'reason':'witness_reconstruction_bound'});break
        count+=3*depth;word=[];parent=index
        while nodes[parent][2] is not None:
            word.append(nodes[parent][3]);parent=nodes[parent][2]
        word=tuple(reversed(word))
        if complete:witnesses.append({'after_state':state,'actual_input_word':word,'acquired_requests':state.acquired_request_refs})
        else:preparations.append({'state':state,'lever_approach_or_escape_word':word,
            'newly_available_receiving_supports':supports,'hazard_states':tuple(m for m in state.movers if m.role=='HAZARD'),
            'capture_continuation_found':False})
    values={'nodes':nodes,'edges':edges,'conditional_completion_witnesses':tuple(witnesses),
        'observation_boundaries':boundaries,'robust_policy_proved':False,
        'current_mode_receiving_support_reachable':None if request.missing_request_ref is None else
            True if current_mode_support else False if not cuts and not boundaries else None}
    if intervention:values['intervention_preparations']=tuple(preparations)
    return family_result(request,values=values,examined_count=count,domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),
        frontier={'cuts':cuts,'nodes':nodes,'edges':edges} if cuts else {})


def _compare(request):
    a=_movers(request.expected_state);b=_movers(request.actual_state);changes=tuple((ref,a.get(ref),b.get(ref)) for ref in sorted(set(a)|set(b)) if a.get(ref)!=b.get(ref))
    fields=tuple((n,getattr(request.expected_state,n),getattr(request.actual_state,n)) for n in ('carrier_ref','carrier','cells','walls','fog','supports','required_request_refs','route_mode_ref','lever_count','acquired_request_refs','clock','remaining_budget','status','level_scope_ref','restore_epoch') if getattr(request.expected_state,n)!=getattr(request.actual_state,n))
    expected=request.expected_trace;actual=request.actual_trace;current=(expected is not None and actual is not None and actual.sealed
        and actual.event_owner_ref==expected.event_owner_ref==request.scope.event_owner_ref and actual.epoch==expected.epoch==request.scope.epoch
        and actual.input_ref==expected.input_ref and actual.evidence_revision_ref==expected.evidence_revision_ref==request.scope.evidence_revision_ref
        and actual.model_revision_ref==expected.model_revision_ref==request.scope.model_revision_ref)
    from .articulated_dependency_measurement_c import _nodes
    snapshot_work=_nodes(immutable_json_data((request.expected_state,request.actual_state)),request.maximum_evaluations)
    count=2*snapshot_work if snapshot_work is not None else request.maximum_evaluations+1
    if count>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'reception_snapshot_compare'})
    length=max(len(expected.events),len(actual.events)) if current else 0;limit=min(length,request.maximum_evaluations-count);cut=limit<length
    event_changes=tuple((i,expected.events[i] if i<len(expected.events) else None,actual.events[i] if i<len(actual.events) else None) for i in range(limit)
        if i>=len(expected.events) or i>=len(actual.events) or expected.events[i]!=actual.events[i]) if current else ()
    return family_result(request,values={'occurrence_differences':changes,'acquisition_route_resource_differences':fields,'first_snapshot_contradiction':changes[0] if changes else fields[0] if fields else None,
        'owned_packet_event_differences':event_changes,'first_owned_event_contradiction':event_changes[0] if event_changes else None,'full_event_trace_current':current,
        'all_acquisitions_retained':request.actual_state.acquired_request_refs,'stale_status_hides_capture':False,'hidden_prediction_is_observation':False},
        prerequisite_refs=() if current else ('current_owned_sealed_reception_trace',),examined_count=count+limit,domain_complete=current and not cut,
        computation_bound_reached=cut,frontier={'phase':'reception_event_compare','next_event_index':limit} if cut else {})


def measure_hidden_motion_reception(request: HiddenReceptionRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    if request.wait_budget is not None and request.operation_ref!='arrival_windows':
        return family_result(request,prerequisite_refs=('cumulative_wait_ledger_requires_arrival_window_review',),domain_complete=False)
    required={'receiver_request_layers':('raw_layer_pixels','layer_templates'),'hidden_track_sets':('models','observations'),'multi_clock_fit':('models','observations'),
        'reception_event':('state','models','bound_model_ref','arrival_mover_refs'),'route_revision':('state','models','bound_model_ref','lever_event'),
        'reception_successor':('state','models','bound_model_ref','input_ref'),'arrival_windows':('state','models','bound_model_ref','input_ref','receiving_support_ref','horizon_ticks'),
        'approach_hold_domain':('state','models','bound_model_ref'),'intervention_preimages':('state','models','bound_model_ref','missing_request_ref'),
        'reception_compare':('expected_state','actual_state')}
    missing=missing_supplied_fields(request,required[request.operation_ref])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    op=request.operation_ref
    if op=='receiver_request_layers':return _layers(request)
    if op in ('hidden_track_sets','multi_clock_fit'):return _fit(request)
    if op=='reception_compare':return _compare(request)
    model=_model(request)
    if model is None:return family_result(request,prerequisite_refs=('bound_whole_reception_model',),domain_complete=False)
    if op=='route_revision':
        if len(model.routes)+len(request.state.movers)>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'route_revision','next_mover_index':0})
        after,debt,events=_revision(request.state,model,request.lever_event);return family_result(request,values={'after_state':after,'revision_events':events,'external_command_count':0},prerequisite_refs=debt,examined_count=len(request.state.movers))
    if op=='reception_event':
        movers=_movers(request.state)
        if not set(request.arrival_mover_refs)<=set(movers):return family_result(request,prerequisite_refs=('current_arriving_occurrence_identity',),domain_complete=False)
        if max(1,len(request.arrival_mover_refs))*max(1,len(request.state.supports)+len(request.state.movers))>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'reception_event','next_arrival_index':0})
        arrivals=tuple((ref,movers[ref].position,0) for ref in request.arrival_mover_refs)
        after,events,debt=_arrival_events(request.state,model,arrivals);return family_result(request,values={'after_state':after,'arrival_events':events,'external_command_count':0},prerequisite_refs=debt,examined_count=len(arrivals))
    if op=='arrival_windows':return _windows(request)
    if op in ('approach_hold_domain','intervention_preimages'):return _domain(request,op=='intervention_preimages')
    command=next((c for c in model.commands if c.input_ref==request.input_ref),None)
    if command is None:return family_result(request,prerequisite_refs=('grounded_reception_input',),domain_complete=False)
    after,trace,debt,count,frontier,applied=_step(request,request.state,model,command,request.maximum_evaluations)
    return family_result(request,values={'after_state':after,'phase_receipts':trace,'external_command_count':int(applied),'actual_cost':command.cost if applied else 0,
        'event_owner_ref':request.scope.event_owner_ref},prerequisite_refs=debt,examined_count=count,domain_complete=not debt and not frontier,
        computation_bound_reached=bool(frontier),frontier=frontier)
