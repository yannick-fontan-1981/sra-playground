"""Finite evolving kits and serial survival reactions, without action authority.

Voluntary allocation is captured before the first cell. A copied kit changes
later effects, not that allocation. Forced motion owns a separate trace rule.
"""
from collections import deque
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap,FrozenModel,Ref,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields
from .identity_contact_authentication import ContactPixel,ContactLayerTemplate,ContactLayerSample,_candidate_layers as measure_translated_layers
from .influence_geometry import RasterContactRegion,SweptMaskContactInput,measure_swept_mask_contacts

Point=tuple[int,int]
CARDINALS=((0,-1),(0,1),(-1,0),(1,0))


class KitEntity(FrozenModel):
    entity_ref: Ref
    position: Point
    facing: Point
    kit_ref: Ref
    life: int = Field(ge=0,le=65536)
    minimum_life: int | None = Field(default=None,ge=0,le=65536)
    alive: bool
    frozen_rounds: int = Field(ge=0,le=65536)
    cadence: int = Field(ge=1,le=65536)
    cadence_phase: int = Field(ge=0)
    @model_validator(mode='after')
    def domain(self):
        if self.facing not in CARDINALS or self.cadence_phase>=self.cadence:raise ValueError('facing and cadence belong to supplied domains')
        if self.alive!=(self.life>0):raise ValueError('life and living state remain consistent')
        if self.minimum_life is not None and self.life<self.minimum_life:raise ValueError('life respects a supplied nonzero damage floor')
        return self


class KitDefinition(FrozenModel):
    kit_ref: Ref
    movement_allocation: int = Field(ge=0,le=16)
    power_refs: tuple[Ref,...] = Field(max_length=16)


class KitPower(FrozenModel):
    power_ref: Ref
    kind: Literal['DAMAGE','PUSH','PULL','FREEZE','COPY_KIT','MINE']
    metric: Literal['MANHATTAN','CHEBYSHEV','EXACT_OFFSETS']
    range_cells: int = Field(ge=0,le=16)
    offsets: tuple[Point,...] = Field(max_length=256)
    recipients: tuple[Ref,...] = Field(max_length=16)
    amount: int = Field(ge=0,le=65536)
    force_direction: Literal['FACING','AWAY_AXIS','TOWARD_AXIS','FIXED']
    fixed_delta: Point
    copy_direction: Literal['SOURCE_TO_RECIPIENT','RECIPIENT_TO_SOURCE']
    forced_respects_trace: bool
    forced_writes_departures: bool
    mine_trigger_modes: tuple[Literal['VOLUNTARY','FORCED','AUTONOMOUS'],...] = Field(max_length=3)
    mine_payload_power_ref: Ref | None = None
    permits_dead_source: bool
    @model_validator(mode='after')
    def mask(self):
        if len(set(self.recipients))!=len(self.recipients):raise ValueError('recipient occurrences remain distinct')
        if self.kind in ('PUSH','PULL') and self.amount>16:raise ValueError('bounded supplied forced allocation')
        if self.kind in ('PUSH','PULL') and self.force_direction=='FIXED' and self.fixed_delta not in CARDINALS:raise ValueError('one-cell forced segments require a cardinal displacement')
        return self


class KitMine(FrozenModel):
    mine_ref: Ref
    position: Point
    owner_ref: Ref
    power_ref: Ref
    armed: bool


class KitState(FrozenModel):
    entities: tuple[KitEntity,...] = Field(min_length=1,max_length=16)
    controlled_ref: Ref
    voluntary_departures: tuple[Point,...] = Field(max_length=4096)
    mines: tuple[KitMine,...] = Field(max_length=256)
    cells: tuple[Point,...] = Field(min_length=1,max_length=4096)
    walls: tuple[Point,...] = Field(max_length=4096)
    initiative: tuple[Ref,...] = Field(max_length=16)
    round_clock: int = Field(ge=0)
    horizon_round: int = Field(ge=0,le=65536)
    remaining_budget: int = Field(ge=0,le=65536)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def identities(self):
        refs=tuple(e.entity_ref for e in self.entities)
        if len(set(refs))!=len(refs) or self.controlled_ref not in refs:raise ValueError('selected control keeps its entity identity')
        if len(set(self.initiative))!=len(self.initiative) or not set(self.initiative)<=set(refs):raise ValueError('initiative names each autonomous occurrence at most once')
        if any(e.position not in self.cells for e in self.entities) or not set(self.walls)<=set(self.cells):raise ValueError('current entity terrain domain')
        if len(set(self.voluntary_departures))!=len(self.voluntary_departures):raise ValueError('no-return trace is a set of departures, not a command count')
        return self


class KitInputRule(FrozenModel):
    context: Literal['FREE','BLOCKED_TERRAIN','FORBIDDEN_RETURN','CONTACT','TRUNCATED','FROZEN']
    advances_round: bool
    invokes_power: bool
    invokes_reactions: bool
    changes_facing: bool


class KitCommand(FrozenModel):
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    direction: Point
    explicit_power_only: bool
    cost: int = Field(ge=0,le=65536)
    @model_validator(mode='after')
    def direction_domain(self):
        if self.direction not in CARDINALS:raise ValueError('only a supplied cardinal input is modeled; no invented WAIT')
        return self


class KitOpponentRule(FrozenModel):
    entity_ref: Ref
    target_refs: tuple[Ref,...] = Field(max_length=16)
    target_selection: Literal['NEAREST','ALL_DECLARED','STATIONARY']
    permitted_directions: tuple[Point,...] = Field(max_length=4)
    invokes_power: bool
    respects_voluntary_trace: bool
    @model_validator(mode='after')
    def directions(self):
        if any(d not in CARDINALS for d in self.permitted_directions) or len(set(self.permitted_directions))!=len(self.permitted_directions):raise ValueError('bounded cardinal direction alternatives')
        if len(set(self.target_refs))!=len(self.target_refs):raise ValueError('target occurrence ties are distinct')
        return self


class KitModel(FrozenModel):
    model_ref: Ref
    kits: tuple[KitDefinition,...] = Field(min_length=1,max_length=32)
    powers: tuple[KitPower,...] = Field(max_length=64)
    commands: tuple[KitCommand,...] = Field(min_length=1,max_length=32)
    input_rules: tuple[KitInputRule,...] = Field(min_length=6,max_length=6)
    opponent_rules: tuple[KitOpponentRule,...] = Field(max_length=16)
    contact_power_refs: tuple[Ref,...] = Field(max_length=16)
    contact_allows_entry: bool
    contact_effect_order: tuple[Literal['MINES','CONTACT_POWER'],...] = Field(min_length=2,max_length=2)
    facing_phase: Literal['BEFORE_MOTION','AFTER_MOTION']
    input_rule_basis: Literal['INITIAL_CONTEXT','RESOLVED_CONTEXT']
    controlled_obeys_trace: bool
    freeze_driven_internal_rounds: bool
    decrement_existing_controlled_freeze_on_input_round: bool
    death_horizon_priority: Literal['DEATH_FIRST','HORIZON_FIRST']
    budget_admission: Literal['REFUSE_BEFORE_INPUT','ALLOW_EXHAUSTING_INPUT']
    exhaustion_outcome: Literal['LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def complete_tables(self):
        for rows,name in ((self.kits,'kit_ref'),(self.powers,'power_ref'),(self.commands,'input_ref'),(self.opponent_rules,'entity_ref')):
            if len({getattr(r,name) for r in rows})!=len(rows):raise ValueError('supplied laws have unique identities')
        if len({r.context for r in self.input_rules})!=6:raise ValueError('one explicit time/power rule per movement context')
        if len({(c.action_ref,c.payload) for c in self.commands})!=len(self.commands):raise ValueError('one meaning per actual input payload')
        if set(self.contact_effect_order)!={'MINES','CONTACT_POWER'}:raise ValueError('one declared contact phase of each kind')
        return self


class KitObservation(FrozenModel):
    observation_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    before: KitState
    after: KitState
    action_ref: Ref
    payload: FrozenMap
    observed_entity_refs: tuple[Ref,...] = Field(max_length=16)
    trace_mines_observed: bool
    clock_resource_observed: bool


class KitLayerTemplate(ContactLayerTemplate):
    component: Literal['CONTROL_OUTLINE','KIT_APPEARANCE','TERRAIN','VISITED','POWER_OVERLAY','MINE','LIFE','HORIZON']
    entity_ref: Ref | None = None


class KitEventTrace(FrozenModel):
    trace_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    input_ref: Ref
    evidence_revision_ref: Ref
    model_revision_ref: Ref
    sealed: bool
    events: tuple[FrozenMap,...] = Field(max_length=1024)


class MutableKitRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.mutable_kit_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=128)
    maximum_responses: int = Field(ge=1,le=128)
    maximum_internal_rounds: int = Field(ge=1,le=256)
    maximum_evaluations: int = Field(ge=1,le=65536)
    state: KitState | None = None
    models: tuple[KitModel,...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    input_ref: Ref | None = None
    actor_ref: Ref | None = None
    direction: Point | None = None
    initial_allocation: int | None = Field(default=None,ge=0,le=16)
    power_refs: tuple[Ref,...] | None = Field(default=None,max_length=16)
    observations: tuple[KitObservation,...] = Field(default=(),max_length=256)
    expected_state: KitState | None = None
    actual_state: KitState | None = None
    expected_trace: KitEventTrace | None = None
    actual_trace: KitEventTrace | None = None
    influence_actor_ref: Ref | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[KitLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    @model_validator(mode='after')
    def references(self):
        if self.direction is not None and self.direction not in CARDINALS:raise ValueError('supplied movement direction is cardinal')
        for rows,name in ((self.models,'model_ref'),(self.observations,'observation_ref'),(self.layer_templates,'template_ref')):
            if len({getattr(r,name) for r in rows})!=len(rows):raise ValueError('model/evidence occurrences remain distinct')
        if len({p.point for p in self.raw_layer_pixels})!=len(self.raw_layer_pixels):raise ValueError('one current token per raw pixel')
        return self


OPERATION_MODES={'entity_and_trace_layers':'MEASURE','input_effect_clock':'FIT','capability_transition':'FIT','voluntary_motion':'STEP_INTERNAL',
    'power_and_forced_motion':'STEP_INTERNAL','serial_reactions':'STEP_INTERNAL','survival_successor':'STEP','survival_viability':'DOMAIN',
    'influence_preparation':'INVERSE_DOMAIN','survival_compare':'COMPARE'}


def _entities(state):return {e.entity_ref:e for e in state.entities}
def _kits(model):return {k.kit_ref:k for k in model.kits}
def _model(request):return next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
def _add(p,d):return (p[0]+d[0],p[1]+d[1])
def _distance(a,b):return abs(a[0]-b[0])+abs(a[1]-b[1])
def _replace_entity(state,entity):return state.model_copy(update={'entities':tuple(entity if e.entity_ref==entity.entity_ref else e for e in state.entities)})
def _bound(state,model):return set(e.kit_ref for e in state.entities)<=set(_kits(model)) and set(state.initiative)<=set(r.entity_ref for r in model.opponent_rules)


def _initial_context(state,actor,direction,allocation,respects_trace):
    if actor.frozen_rounds:return 'FROZEN'
    if not allocation:return 'FREE'
    destination=_add(actor.position,direction)
    if destination not in state.cells or destination in state.walls:return 'BLOCKED_TERRAIN'
    if respects_trace and destination in state.voluntary_departures:return 'FORBIDDEN_RETURN'
    if any(e.alive and e.entity_ref!=actor.entity_ref and e.position==destination for e in state.entities):return 'CONTACT'
    return 'FREE'


def _mine_entries(request,state,model,entrant_ref,mode,bound):
    powers={p.power_ref:p for p in model.powers};entrant=_entities(state)[entrant_ref];events=[];missing=[];count=0;frontier={}
    for mi,mine in enumerate(state.mines):
        if count>=bound:frontier={'phase':'mine_entry_scan','mine_index':mi};break
        count+=1
        if not mine.armed or mine.position!=entrant.position:continue
        law=powers.get(mine.power_ref)
        if law is None or law.mine_payload_power_ref not in powers:missing.append('known_mine_payload_law');continue
        if mode not in law.mine_trigger_modes:continue
        state=state.model_copy(update={'mines':tuple(m.model_copy(update={'armed':False}) if m.mine_ref==mine.mine_ref else m for m in state.mines)})
        state,effects,debt,visits,cut=_power(request,state,model,mine.owner_ref,(law.mine_payload_power_ref,),max(0,bound-count),mine.position);count+=visits;events.extend(effects);missing.extend(debt)
        events.append((mine.mine_ref,'MINE_TRIGGER',entrant_ref,mode))
        if cut:frontier={'phase':'mine_payload','native_frontier':cut};break
    return state,tuple(events),tuple(dict.fromkeys(missing)),count,frontier


def _recipient_mask(state,source,power):
    targets=tuple(e for e in state.entities if e.entity_ref in power.recipients and e.alive)
    if power.metric=='EXACT_OFFSETS':
        positions=tuple(_add(source.position,d) for d in power.offsets)
        # Existing contact service supplies geometry only; the power law owns effects.
        contact=measure_swept_mask_contacts(SweptMaskContactInput(positions=positions,translation_delta=(0,0),regions=tuple(RasterContactRegion(region_ref=e.entity_ref,positions=(e.position,)) for e in targets)))
        return tuple(e for e in targets if e.position in contact.translated_positions)
    return tuple(e for e in targets if (_distance(source.position,e.position) if power.metric=='MANHATTAN' else max(abs(source.position[0]-e.position[0]),abs(source.position[1]-e.position[1])))<=power.range_cells)


def _forced(state,entity,delta,amount,power):
    trace=set(state.voluntary_departures);current=entity;events=[]
    for step in range(amount):
        destination=_add(current.position,delta)
        occupied=any(e.alive and e.entity_ref!=current.entity_ref and e.position==destination for e in state.entities)
        if destination not in state.cells or destination in state.walls or occupied or power.forced_respects_trace and destination in trace:break
        old=current.position
        if power.forced_writes_departures:trace.add(old)
        current=current.model_copy(update={'position':destination});state=_replace_entity(state,current);events.append((current.entity_ref,old,destination,'FORCED'))
    return state.model_copy(update={'voluntary_departures':tuple(sorted(trace))}),tuple(events)


def _power(request,state,model,source_ref,power_refs,bound,origin=None):
    powers={p.power_ref:p for p in model.powers};count=0;events=[];missing=[];frontier={}
    for pi,ref in enumerate(power_refs):
        power=powers.get(ref);source=_entities(state).get(source_ref)
        if power is None or source is None:missing.append('current_source_and_supplied_power');break
        if not source.alive and not power.permits_dead_source:break
        work=max(1,len(state.entities)+len(power.offsets)*max(1,len(state.entities)))
        if count+work>bound:frontier={'phase':'recipient_mask','next_power_index':pi};break
        count+=work;geometry_source=source if origin is None else source.model_copy(update={'position':origin})
        recipients=_recipient_mask(state,geometry_source,power)
        if power.kind=='MINE':
            if len(state.mines)>=256:frontier={'phase':'mine_state_cap','next_power_index':pi};break
            mine=KitMine(mine_ref=source_ref+'.mine.'+str(state.round_clock)+'.'+str(len(state.mines)),position=source.position,owner_ref=source_ref,power_ref=ref,armed=True)
            state=state.model_copy(update={'mines':state.mines+(mine,)});events.append((source_ref,'MINE_PLACED',mine.mine_ref));continue
        for ri,recipient in enumerate(recipients):
            work=max(1,len(state.entities)+power.amount)
            if count+work>bound:frontier={'power_index':pi,'recipient_index':ri};break
            count+=work;actual=_entities(state)[recipient.entity_ref];current_source=_entities(state)[source_ref]
            if power.kind=='DAMAGE':
                if actual.minimum_life is None:missing.append('observed_damage_floor.'+actual.entity_ref);continue
                life=max(actual.minimum_life,actual.life-power.amount);after=actual.model_copy(update={'life':life,'alive':life>0});state=_replace_entity(state,after)
                events.append((actual.entity_ref,'DAMAGE',actual.life,life))
            elif power.kind=='FREEZE':state=_replace_entity(state,actual.model_copy(update={'frozen_rounds':max(actual.frozen_rounds,power.amount)}));events.append((actual.entity_ref,'FREEZE',power.amount))
            elif power.kind=='COPY_KIT':
                donor=current_source if power.copy_direction=='SOURCE_TO_RECIPIENT' else actual;receiver=actual if power.copy_direction=='SOURCE_TO_RECIPIENT' else current_source
                state=_replace_entity(state,receiver.model_copy(update={'kit_ref':donor.kit_ref}));events.append((receiver.entity_ref,'COPY_KIT',receiver.kit_ref,donor.kit_ref))
            else:
                if power.force_direction=='FIXED':delta=power.fixed_delta
                elif power.force_direction=='FACING':delta=current_source.facing
                else:
                    dx=actual.position[0]-geometry_source.position[0];dy=actual.position[1]-geometry_source.position[1]
                    if dx and dy:missing.append('declared_axis_tie_for_forced_recipient.'+actual.entity_ref);continue
                    delta=((1 if dx>0 else -1) if dx else 0,(1 if dy>0 else -1) if dy else 0)
                    if power.force_direction=='TOWARD_AXIS':delta=(-delta[0],-delta[1])
                for forced_step in range(power.amount):
                    current=_entities(state)[actual.entity_ref]
                    state,movements=_forced(state,current,delta,1,power);events.extend(movements)
                    if not movements:break
                    state,mine_events,debt,visits,cut=_mine_entries(request,state,model,actual.entity_ref,'FORCED',max(0,bound-count));events.extend(mine_events);missing.extend(debt);count+=visits
                    if cut:frontier={'phase':'forced_mine_contact','forced_step':forced_step,'native_frontier':cut};break
        if frontier:break
    return state,tuple(events),tuple(dict.fromkeys(missing)),count,frontier


def _voluntary(request,state,model,actor_ref,direction,allocation,bound,respects_trace=True,mode='VOLUNTARY'):
    actor=_entities(state).get(actor_ref);count=0;path=[];events=[];missing=[];frontier={};context='FREE'
    if actor is None:return state,(),(),('current_voluntary_actor',),0,{},'CONTACT'
    if actor.frozen_rounds:return state,(),(),(),0,{},'FROZEN'
    # The supplied allocation is never recalculated after a kit transfer.
    for step in range(allocation):
        work=max(1,len(state.entities))
        if count+work>bound:frontier={'next_voluntary_substep':step};break
        count+=work;actor=_entities(state)[actor_ref];destination=_add(actor.position,direction)
        if not actor.alive:break
        if destination not in state.cells or destination in state.walls:context='TRUNCATED' if path else 'BLOCKED_TERRAIN';break
        if respects_trace and destination in state.voluntary_departures:context='TRUNCATED' if path else 'FORBIDDEN_RETURN';break
        contact=any(e.alive and e.entity_ref!=actor_ref and e.position==destination for e in state.entities)
        if contact and not model.contact_allows_entry:context='CONTACT';break
        old=actor.position;state=_replace_entity(state,actor.model_copy(update={'position':destination}));path.append(destination)
        if mode=='VOLUNTARY':state=state.model_copy(update={'voluntary_departures':tuple(sorted(set(state.voluntary_departures)|{old}))})
        events.append((actor_ref,old,destination,mode))
        if contact:context='CONTACT'
        for phase in model.contact_effect_order:
            if phase=='MINES':state,effects,debt,visits,cut=_mine_entries(request,state,model,actor_ref,mode,max(0,bound-count))
            elif contact:state,effects,debt,visits,cut=_power(request,state,model,actor_ref,model.contact_power_refs,max(0,bound-count))
            else:continue
            events.extend(effects);missing.extend(debt);count+=visits
            if cut:frontier={'phase':phase,'voluntary_substep':step,'native_frontier':cut};break
        if frontier:break
        if _entities(state)[actor_ref].frozen_rounds or not _entities(state)[actor_ref].alive:break
    return state,tuple(path),tuple(events),tuple(dict.fromkeys(missing)),count,frontier,context


def _opponent_directions(state,actor,rule):
    if rule.target_selection=='STATIONARY':return ((0,0),),()
    targets=tuple(e for e in state.entities if e.entity_ref in rule.target_refs and e.alive and e.entity_ref!=actor.entity_ref)
    if not targets:return (),('living_declared_opponent_target',)
    if rule.target_selection=='NEAREST':
        distance=min(_distance(actor.position,e.position) for e in targets);targets=tuple(e for e in targets if _distance(actor.position,e.position)==distance)
    directions=tuple(d for d in rule.permitted_directions if any(_distance(_add(actor.position,d),t.position)<_distance(actor.position,t.position) for t in targets))
    return tuple(dict.fromkeys(directions)) or ((0,0),),()


def _serial(request,state,model,bound):
    branches=[(state,())];count=0;missing=[];frontier={};rules={r.entity_ref:r for r in model.opponent_rules}
    for ai,ref in enumerate(state.initiative):
        following=[]
        for current,history in branches:
            work=max(1,len(current.entities))
            if count+work>bound:frontier={'initiative_index':ai,'reason':'initiative_state_work_bound'};break
            count+=work
            actor=_entities(current)[ref];rule=rules.get(ref)
            if rule is None:missing.append('declared_initiative_actor_behavior.'+ref);continue
            if not actor.alive:following.append((current,history));continue
            if actor.frozen_rounds:
                following.append((_replace_entity(current,actor.model_copy(update={'frozen_rounds':actor.frozen_rounds-1})),history+((ref,'FROZEN_SKIP'),)));continue
            due=actor.cadence_phase+1>=actor.cadence;current=_replace_entity(current,actor.model_copy(update={'cadence_phase':(actor.cadence_phase+1)%actor.cadence}))
            if not due:following.append((current,history));continue
            directions,debt=_opponent_directions(current,actor,rule);missing.extend(debt)
            for direction in directions:
                if len(following)>=request.maximum_responses:frontier={'initiative_index':ai,'reason':'reaction_response_bound'};break
                if count>=bound:frontier={'initiative_index':ai,'reason':'reaction_work_bound'};break
                allocation=_kits(model)[_entities(current)[ref].kit_ref].movement_allocation
                moved,path,events,debt,visits,cut,context=_voluntary(request,current,model,ref,direction,0 if direction==(0,0) else allocation,max(0,bound-count),rule.respects_voluntary_trace,'AUTONOMOUS');count+=visits;missing.extend(debt)
                if cut:frontier={'initiative_index':ai,'native_frontier':cut};break
                power_events=()
                if rule.invokes_power:
                    kit=_kits(model)[_entities(moved)[ref].kit_ref];moved,power_events,debt,visits,cut=_power(request,moved,model,ref,kit.power_refs,max(0,bound-count));count+=visits;missing.extend(debt)
                    if cut:frontier={'initiative_index':ai,'native_frontier':cut};break
                following.append((moved,history+events+power_events))
        branches=following
        if frontier:break
    return tuple(branches),tuple(dict.fromkeys(missing)),count,frontier


def _successor(request,state,model,command,bound):
    if state.status!='ACTIVE':return (),('authoritative_survival_terminal',),0,{}
    if command.cost>state.remaining_budget and model.budget_admission=='REFUSE_BEFORE_INPUT':return (),('remaining_survival_input_budget',),0,{}
    actor=_entities(state)[state.controlled_ref];allocation=0 if command.explicit_power_only else _kits(model)[actor.kit_ref].movement_allocation
    initial_context=_initial_context(state,actor,command.direction,allocation,model.controlled_obeys_trace)
    initial_rule=next(r for r in model.input_rules if r.context==initial_context);prepared=state
    if model.facing_phase=='BEFORE_MOTION' and initial_rule.changes_facing:prepared=_replace_entity(state,actor.model_copy(update={'facing':command.direction}))
    moved,path,events,missing,count,frontier,context=_voluntary(request,prepared,model,state.controlled_ref,command.direction,allocation,bound,model.controlled_obeys_trace)
    rule=initial_rule if model.input_rule_basis=='INITIAL_CONTEXT' else next(r for r in model.input_rules if r.context==context)
    current_actor=_entities(moved)[state.controlled_ref]
    if actor.frozen_rounds and rule.advances_round and model.decrement_existing_controlled_freeze_on_input_round:
        moved=_replace_entity(moved,current_actor.model_copy(update={'frozen_rounds':max(0,current_actor.frozen_rounds-1)}));current_actor=_entities(moved)[state.controlled_ref]
    if model.facing_phase=='AFTER_MOTION' and rule.changes_facing:moved=_replace_entity(moved,current_actor.model_copy(update={'facing':command.direction}))
    if rule.invokes_power or command.explicit_power_only:
        kit=_kits(model)[_entities(moved)[state.controlled_ref].kit_ref];moved,power_events,debt,visits,cut=_power(request,moved,model,state.controlled_ref,kit.power_refs,max(0,bound-count));count+=visits;events+=power_events;missing+=debt
        if cut:frontier={'phase':'automatic_power','native_frontier':cut}
    if missing or frontier:return (),tuple(dict.fromkeys(missing)),count,{**frontier,'partial_after_state':moved,'partial_events':events}
    moved=moved.model_copy(update={'remaining_budget':max(0,state.remaining_budget-command.cost)})
    branches=((moved,events),)
    if rule.invokes_reactions:
        reactions,debt,visits,cut=_serial(request,moved,model,max(0,bound-count));count+=visits;missing+=debt;branches=tuple((s,events+trace) for s,trace in reactions)
        if cut:frontier={'phase':'serial_reactions','native_frontier':cut}
    rounds=[];pending=deque()
    for current,trace in branches:
        if rule.advances_round:current=current.model_copy(update={'round_clock':current.round_clock+1})
        pending.append((current,trace,0))
    while pending:
        current,trace,internal=pending.popleft()
        if model.freeze_driven_internal_rounds and _entities(current)[current.controlled_ref].alive and _entities(current)[current.controlled_ref].frozen_rounds and current.round_clock<current.horizon_round:
            if internal>=request.maximum_internal_rounds or count>=bound:frontier={'phase':'freeze_internal_rounds','state':current,'internal_rounds':internal};break
            player=_entities(current)[current.controlled_ref];current=_replace_entity(current,player.model_copy(update={'frozen_rounds':player.frozen_rounds-1}))
            options,debt,visits,cut=_serial(request,current,model,max(0,bound-count));count+=visits;missing+=debt
            if cut:frontier={'phase':'freeze_internal_rounds','native_frontier':cut};break
            for after,newtrace in options:
                if len(pending)+len(rounds)>=request.maximum_responses:frontier={'phase':'freeze_response_bound','pending_rounds':tuple(pending)};break
                pending.append((after.model_copy(update={'round_clock':after.round_clock+1}),trace+newtrace,internal+1))
            continue
        player=_entities(current)[current.controlled_ref];finished=current.round_clock>=current.horizon_round
        status='WIN' if finished and (player.alive or model.death_horizon_priority=='HORIZON_FIRST') else 'GAME_OVER' if not player.alive else model.exhaustion_outcome if current.remaining_budget==0 else 'ACTIVE'
        rounds.append((current.model_copy(update={'status':status}),trace,context,allocation,internal,command.cost))
    return tuple(rounds),tuple(dict.fromkeys(missing)),count,frontier


def _layers(request):
    result=measure_translated_layers(request);templates={t.template_ref:t for t in request.layer_templates};values=dict(result.values)
    rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
    return result.model_copy(update={'values':immutable_json_data({**values,'entity_trace_layer_candidates':tuple({'measurement':r,
        'component':templates[r['template_ref']].component,'entity_ref':templates[r['template_ref']].entity_ref,
        'kit_appearance_is_new_identity':False} for r in rows)})})


def _same_observed(expected,actual,row):
    a=_entities(expected);b=_entities(actual)
    if not set(row.observed_entity_refs)<=set(a)&set(b):return False
    if any(a[ref]!=b[ref] for ref in row.observed_entity_refs):return False
    if row.trace_mines_observed and (expected.voluntary_departures,expected.mines)!=(actual.voluntary_departures,actual.mines):return False
    if row.clock_resource_observed and any(getattr(expected,n)!=getattr(actual,n) for n in ('round_clock','remaining_budget','status','restore_epoch','level_scope_ref','controlled_ref')):return False
    return True


def _fit(request):
    if not request.models or not request.observations:return family_result(request,prerequisite_refs=('kit_models_and_sealed_observations',),domain_complete=False)
    results=[];count=0;missing=[];frontier={}
    for mi,model in enumerate(request.models):
        supported=[];refuted=[];contexts=[]
        for oi,row in enumerate(request.observations):
            if count>=request.maximum_evaluations:frontier={'model_index':mi,'next_observation_index':oi};break
            if not row.sealed or row.event_owner_ref!=request.scope.event_owner_ref or row.epoch!=request.scope.epoch or not _bound(row.before,model):missing.append('current_sealed_kit_interval');continue
            if not row.observed_entity_refs and not row.trace_mines_observed and not row.clock_resource_observed:missing.append('observed_kit_fields_mask');continue
            command=next((c for c in model.commands if (c.action_ref,c.payload)==(row.action_ref,row.payload)),None)
            if command is None:refuted.append((row.observation_ref,'actual_input_map'));continue
            after,debt,visits,cut=_successor(request,row.before,model,command,request.maximum_evaluations-count);count+=visits;missing.extend(debt)
            if cut:frontier={'model_index':mi,'observation_index':oi,'native_frontier':cut};break
            if debt:continue
            compatible=tuple(result for result in after if _same_observed(result[0],row.after,row))
            if compatible:supported.append(row.observation_ref);contexts.extend(result[2] for result in compatible)
            else:refuted.append((row.observation_ref,'complete_serial_packet'))
        results.append({'model_ref':model.model_ref,'supported_observation_refs':supported,'refutations':refuted,'observed_input_contexts':tuple(sorted(set(contexts))),
            'copied_kit_without_damage_is_distinct':True,'retained_as_unfalsified_model':not refuted})
        if frontier:break
    return family_result(request,values={'kit_clock_order_fit':results},prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,
        domain_complete=not missing and not frontier,computation_bound_reached=bool(frontier),frontier=frontier)


def _domain(request,influence=False):
    model=_model(request);nodes=[(request.state,0,None,None,0)];queue=deque([0]);seen={request.state:0};edges=[];boundaries=[];cuts=[];count=0;wins=[]
    while queue:
        index=queue.popleft();state,depth,_,_,path_cost=nodes[index]
        if state.status=='WIN':
            if _entities(state)[state.controlled_ref].alive:wins.append(index)
            continue
        if state.status!='ACTIVE':continue
        if depth>=request.maximum_depth:cuts.append({'node_index':index,'reason':'depth_bound'});continue
        for ci,command in enumerate(model.commands):
            if count>=request.maximum_evaluations:cuts.append({'node_index':index,'next_input_index':ci,'reason':'evaluation_bound'});queue.clear();break
            results,debt,visits,cut=_successor(request,state,model,command,request.maximum_evaluations-count);count+=visits
            if debt:boundaries.append({'node_index':index,'input_ref':command.input_ref,'prerequisites':debt})
            if cut:cuts.append({'node_index':index,'input_ref':command.input_ref,'native_frontier':cut})
            if debt or cut:continue
            for after,trace,context,allocation,internal,cost in results:
                child=seen.get(after)
                if child is None:
                    if len(nodes)>=request.maximum_states:cuts.append({'node_index':index,'input_ref':command.input_ref,'reason':'state_bound'});continue
                    child=len(nodes);seen[after]=child;nodes.append((after,depth+1,index,len(edges),path_cost+cost));queue.append(child)
                edges.append({'from_node':index,'to_node':child,'input_ref':command.input_ref,'context':context,'initial_allocation':allocation,'internal_rounds':internal,'cost':cost,'events':trace})
    witnesses=[]
    for index in wins[:3]:
        state,depth,_,_,path_cost=nodes[index]
        word,history,work=_kit_predecessor_witness_d(nodes,edges,index,request.maximum_evaluations-count)
        if word is None:cuts.append({'phase':'completion_witness_reconstruction','node_index':index});break
        count+=work
        witnesses.append({'after_state':state,'actual_input_word':word,'events':history,
            'final_life':_entities(state)[state.controlled_ref].life,'elapsed_rounds':state.round_clock-request.state.round_clock,
            'external_command_count':depth,'command_cost':path_cost})
    values={'nodes':nodes,'edges':edges,'continuation_witnesses':tuple(witnesses),'observation_boundaries':boundaries,'robust_policy_or_minimum_cost_proved':False,
        'life_and_free_area_are_survival_proof':False}
    if influence:
        opponent=_entities(request.state).get(request.influence_actor_ref);preparations=[]
        if opponent is None:return family_result(request,prerequisite_refs=('current_influence_recipient',),domain_complete=False)
        rules={r.entity_ref:r for r in model.opponent_rules};rule=rules.get(opponent.entity_ref)
        if rule is None:return family_result(request,prerequisite_refs=('known_influence_targeting_model',),domain_complete=False)
        original_directions,original_debt=_opponent_directions(request.state,opponent,rule)
        original_distance=_distance(opponent.position,_entities(request.state)[request.state.controlled_ref].position)
        for index,(state,depth,_,_,_) in enumerate(nodes):
            if len(witnesses)+len(preparations)>=3:break
            if not _entities(state)[state.controlled_ref].alive:continue
            directions,debt=_opponent_directions(state,_entities(state)[opponent.entity_ref],rule)
            distance=_distance(_entities(state)[opponent.entity_ref].position,_entities(state)[state.controlled_ref].position)
            if not depth or directions==original_directions and distance==original_distance and state.status!='WIN':continue
            word,_,work=_kit_predecessor_witness_d(nodes,edges,index,request.maximum_evaluations-count)
            if word is None:cuts.append({'phase':'influence_witness_reconstruction','node_index':index});break
            count+=work
            preparations.append({'preparation_state':state,'actual_input_word':word,'opponent_direction_alternatives':directions,'target_prerequisites':debt,
                'competing_recipient_states':state.entities,'resource_cost':request.state.remaining_budget-state.remaining_budget,'survival_to_horizon_found':state.status=='WIN'})
            if len(preparations)>=3:break
        values['conditional_influence_preparations']=preparations
    return family_result(request,values=values,examined_count=count,domain_complete=not cuts and not boundaries,
        computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'nodes':nodes,'edges':edges} if cuts else {})


def _kit_predecessor_witness_d(nodes,edges,index,remaining):
    word=[];history=[];work=0
    while nodes[index][2] is not None:
        if work+1>remaining:return None,(),work
        edge=edges[nodes[index][3]];size=len(edge['events'])+3
        if work+size>remaining:return None,(),work
        work+=size;word.append(edge['input_ref']);history.append(edge['events']);index=nodes[index][2]
    return tuple(reversed(word)),tuple(reversed(history)),work


def _compare(request):
    expected=request.expected_state;actual=request.actual_state;a=_entities(expected);b=_entities(actual)
    from .articulated_dependency_measurement_c import _nodes
    snapshot_work=_nodes(immutable_json_data((expected,actual)),request.maximum_evaluations)
    fixed_work=2*snapshot_work if snapshot_work is not None else request.maximum_evaluations+1
    if fixed_work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'survival_snapshot_comparison','next_field_index':0})
    entities=tuple((ref,a.get(ref),b.get(ref)) for ref in sorted(set(a)|set(b)) if a.get(ref)!=b.get(ref))
    fields=tuple((n,getattr(expected,n),getattr(actual,n)) for n in ('controlled_ref','voluntary_departures','mines','initiative','round_clock','horizon_round','remaining_budget','status','level_scope_ref','restore_epoch') if getattr(expected,n)!=getattr(actual,n))
    expected_trace=request.expected_trace;actual_trace=request.actual_trace;trace_current=(expected_trace is not None and actual_trace is not None and actual_trace.sealed
        and actual_trace.event_owner_ref==expected_trace.event_owner_ref==request.scope.event_owner_ref and actual_trace.epoch==expected_trace.epoch==request.scope.epoch
        and actual_trace.input_ref==expected_trace.input_ref and actual_trace.evidence_revision_ref==expected_trace.evidence_revision_ref==request.scope.evidence_revision_ref
        and actual_trace.model_revision_ref==expected_trace.model_revision_ref==request.scope.model_revision_ref)
    events=()
    cut=False;frontier={};event_count=0
    if trace_current:
        length=max(len(expected_trace.events),len(actual_trace.events));event_count=min(length,request.maximum_evaluations-fixed_work);cut=event_count<length
        if cut:frontier={'phase':'survival_event_comparison','next_event_index':event_count}
        events=tuple((i,expected_trace.events[i] if i<len(expected_trace.events) else None,actual_trace.events[i] if i<len(actual_trace.events) else None)
            for i in range(event_count) if i>=len(expected_trace.events) or i>=len(actual_trace.events) or expected_trace.events[i]!=actual_trace.events[i])
    missing=() if trace_current else ('current_owned_sealed_survival_event_trace',)
    return family_result(request,values={'entity_changes':entities,'trace_clock_resource_changes':fields,'first_snapshot_discrepancy':entities[0] if entities else fields[0] if fields else None,
        'ordered_packet_event_differences':events,'first_owned_packet_event_discrepancy':events[0] if events else None,'full_packet_trace_current':trace_current,
        'unchanged_pose_proves_no_effect':False,'actual_rounds_remaining':max(0,actual.horizon_round-actual.round_clock),
        'commands_counted_as_survived_rounds':False,'actual_controlled_life':b[actual.controlled_ref].life},prerequisite_refs=missing,domain_complete=trace_current and not cut,
        computation_bound_reached=cut,frontier=frontier,examined_count=fixed_work+event_count)


def measure_mutable_kit_survival(request: MutableKitRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    required={'entity_and_trace_layers':('raw_layer_pixels','layer_templates'),'input_effect_clock':('models','observations'),'capability_transition':('models','observations'),
        'voluntary_motion':('state','models','bound_model_ref','actor_ref','direction','initial_allocation'),
        'power_and_forced_motion':('state','models','bound_model_ref','actor_ref','power_refs'),'serial_reactions':('state','models','bound_model_ref'),
        'survival_successor':('state','models','bound_model_ref','input_ref'),'survival_viability':('state','models','bound_model_ref'),
        'influence_preparation':('state','models','bound_model_ref','influence_actor_ref'),'survival_compare':('expected_state','actual_state')}
    missing=missing_supplied_fields(request,required[request.operation_ref])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    op=request.operation_ref
    if op=='entity_and_trace_layers':return _layers(request)
    if op in ('input_effect_clock','capability_transition'):return _fit(request)
    if op=='survival_compare':return _compare(request)
    model=_model(request)
    if model is None or not _bound(request.state,model):return family_result(request,prerequisite_refs=('current_complete_kit_and_initiative_model',),domain_complete=False)
    if op in ('survival_viability','influence_preparation'):return _domain(request,op=='influence_preparation')
    if op=='voluntary_motion':
        state,path,events,debt,count,frontier,context=_voluntary(request,request.state,model,request.actor_ref,request.direction,request.initial_allocation,request.maximum_evaluations,model.controlled_obeys_trace)
        values={'after_state':state,'traversed_prefix':path,'events':events,'input_context':context,'initial_allocation':request.initial_allocation,'external_command_count':0}
    elif op=='power_and_forced_motion':
        state,events,debt,count,frontier=_power(request,request.state,model,request.actor_ref,request.power_refs,request.maximum_evaluations);values={'after_state':state,'recipient_events':events,'external_command_count':0}
    elif op=='serial_reactions':
        branches,debt,count,frontier=_serial(request,request.state,model,request.maximum_evaluations);values={'serial_successors':branches,'external_command_count':0,'simultaneous_union_assumed':False}
    else:
        command=next((c for c in model.commands if c.input_ref==request.input_ref),None)
        if command is None:return family_result(request,prerequisite_refs=('grounded_survival_input',),domain_complete=False)
        results,debt,count,frontier=_successor(request,request.state,model,command,request.maximum_evaluations);values={'joint_successors':results,'external_command_count':1,'event_owner_ref':request.scope.event_owner_ref}
    return family_result(request,values=values,prerequisite_refs=debt,examined_count=count,domain_complete=not debt and not frontier,
        computation_bound_reached=bool(frontier),frontier=frontier)
