"""Finite exclusive key ownership and ordered cell/room entry transactions.

Chart annotations never restore collected objects. The supplied event order,
entry trigger, cost and restoration scope define one physical primitive.
"""
from collections import deque
from fractions import Fraction
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_common_contracts_c import MechanicalEventC, ExternalPrimitivePacketC
from .mechanical_event_composition_c import packet_context_equal
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as translated_layers
from .navigation_obligation_contracts_d import NavigationStorageNeedD,NavigationMaskRetentionD
from .navigation_obligations_d import measure_navigation_storage_need_d,measure_navigation_mask_retention_d


class NavigationKey(FrozenModel):
    key_ref: Ref
    type_ref: Ref
    reusable: bool | None
    owner: Literal['GROUND','INVENTORY','STORED','CONSUMED']
    node_ref: Ref | None = None
    @model_validator(mode='after')
    def exclusive(self):
        if (self.owner in ('GROUND','STORED'))!=(self.node_ref is not None):raise ValueError('exclusive ground/stored versus held/consumed ownership')
        return self


class NavigationState(FrozenModel):
    location_ref: Ref
    keys: tuple[NavigationKey, ...] = Field(max_length=128)
    inventory_order: tuple[Ref, ...] = Field(max_length=64)
    inventory_complete: bool
    capacity: int = Field(ge=0,le=64)
    opened_door_refs: tuple[Ref, ...] = Field(max_length=256)
    collected_key_refs: tuple[Ref, ...] = Field(max_length=128)
    used_refill_refs: tuple[Ref, ...] = Field(max_length=128)
    reserve: int = Field(ge=0,le=10**9)
    input_tick: int = Field(ge=0)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def ledger(self):
        if len({k.key_ref for k in self.keys})!=len(self.keys):raise ValueError('one occurrence per key, including duplicate types')
        if len(set(self.inventory_order))!=len(self.inventory_order) or set(self.inventory_order)!={k.key_ref for k in self.keys if k.owner=='INVENTORY'} or len(self.inventory_order)>self.capacity:raise ValueError('ordered inventory matches current exclusive ownership and capacity')
        for rows in (self.opened_door_refs,self.collected_key_refs,self.used_refill_refs):
            if len(set(rows))!=len(rows):raise ValueError('dynamic opened/collected/refill sets are distinct occurrences')
        return self


class NavigationNode(FrozenModel):
    node_ref: Ref
    terrain: Literal['WALKABLE','BLOCKED','UNKNOWN']
    content_known: bool
    hazard: bool | None
    goal: bool | None
    refill_ref: Ref | None = None
    refill_amount: int | None = Field(default=None,ge=0,le=65536)
    storage_allowed: bool | None = None
    room_ref: Ref | None = None
    point: tuple[int,int] | None = None


class NavigationEdge(FrozenModel):
    edge_ref: Ref
    from_ref: Ref
    to_ref: Ref
    input_ref: Ref
    door_ref: Ref | None = None


class NavigationDoor(FrozenModel):
    door_ref: Ref
    compatible_type_refs: tuple[Ref, ...] = Field(min_length=1,max_length=64)
    triggering_endpoint_ref: Ref
    triggering_from_ref: Ref | None = None
    trigger: Literal['PRESENCE','ATTEMPT','ENTRY']
    consumption: Literal['KEY_FLAG','CONSUME','RETAIN']


class NavigationCommand(FrozenModel):
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    kind: Literal['MOVE','PICKUP','DROP','EXCHANGE','WAIT','RESET']
    cost: int = Field(ge=0,le=65536)
    key_ref: Ref | None = None


class NavigationModel(FrozenModel):
    model_ref: Ref
    nodes: tuple[NavigationNode, ...] = Field(min_length=1,max_length=1024)
    edges: tuple[NavigationEdge, ...] = Field(max_length=4096)
    doors: tuple[NavigationDoor, ...] = Field(max_length=256)
    commands: tuple[NavigationCommand, ...] = Field(min_length=1,max_length=256)
    primitive_scope: Literal['CELL_STEP','ROOM_ENTRY']
    debit_policy: Literal['REQUIRE_FUNDED','CLAMP_TO_ZERO']
    phases: tuple[Literal['DEBIT','TRAVEL','INVENTORY','COLLECT','OPEN','REFILL','HAZARD','GOAL','EXHAUSTION','CLOCK'], ...]
    pickup: Literal['NONE','FIRST','LAST']
    automatic_pickup: bool
    full_capacity: Literal['REFUSE','EXCHANGE_FRONT','EXCHANGE_BACK']
    ground_occupancy: Literal['EMPTY_REQUIRED','STACK_ALLOWED']
    drop_order: Literal['FRONT','BACK']
    key_match_order: Literal['FRONT','BACK']
    forbid_drop_on_goal: bool
    closed_door_travel: Literal['BLOCK_UNTIL_OPEN','ALLOW_COMPATIBLE_PERMISSION']
    collection_trigger: Literal['PRESENCE','ATTEMPT','ENTRY']
    hazard_trigger: Literal['PRESENCE','ATTEMPT','ENTRY']
    goal_trigger: Literal['PRESENCE','ATTEMPT','ENTRY']
    refill_trigger: Literal['PRESENCE','ATTEMPT','ENTRY']
    refill_mode: Literal['ADD','SET']
    terminal_required_type_refs: tuple[Ref, ...] = Field(max_length=64)
    terminal_inventory: Literal['AT_LEAST','EXACT','EMPTY','UNRESTRICTED']
    hazard_outcome: Literal['LOCAL_STOP','GAME_OVER','RESTORE_DECLARED','UNKNOWN']
    exhaustion_outcome: Literal['LOCAL_STOP','GAME_OVER','RESTORE_DECLARED','UNKNOWN']
    restored_state: NavigationState | None = None
    graph_complete: bool
    @model_validator(mode='after')
    def graph(self):
        nodes={n.node_ref for n in self.nodes}
        if len(nodes)!=len(self.nodes) or len({d.door_ref for d in self.doors})!=len(self.doors) or len({c.input_ref for c in self.commands})!=len(self.commands):raise ValueError('distinct node, door and input identities')
        if len(set(self.phases))!=len(self.phases) or set(self.phases)!={'DEBIT','TRAVEL','INVENTORY','COLLECT','OPEN','REFILL','HAZARD','GOAL','EXHAUSTION','CLOCK'}:raise ValueError('one declared physical pass and debit per primitive')
        if self.phases[0]!='DEBIT' or self.phases[-1]!='CLOCK':raise ValueError('explicit input debit and final primitive clock')
        if len({(e.from_ref,e.input_ref) for e in self.edges})!=len(self.edges) or any(e.from_ref not in nodes or e.to_ref not in nodes for e in self.edges):raise ValueError('each current room/port input has one modeled endpoint')
        if any(e.door_ref is not None and e.door_ref not in {d.door_ref for d in self.doors} for e in self.edges):raise ValueError('typed doors have a current supplied law')
        return self


class NavigationLayerTemplate(ContactLayerTemplate):
    component: Literal['MAP_KEY','INVENTORY_KEY','LOCK','ROOM','CHART','MARKER','ANCHOR','RESERVE','FEEDBACK','UNKNOWN']
    type_candidate_ref: Ref | None = None
    occurrence_candidate_ref: Ref | None = None
    complementary_shape_ref: Ref | None = None


class NavigationObservation(FrozenModel):
    observation_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    before: NavigationState
    after: NavigationState
    input_ref: Ref
    sealed: bool
    owned_events: tuple[MechanicalEventC, ...] = Field(max_length=4096)


class NavigationService(FrozenModel):
    consumer_ref: Ref
    door_ref: Ref | None = None
    key_type_ref: Ref
    required_terminal: bool


class ChartNode(FrozenModel):
    chart_node_ref: Ref
    point: tuple[int,int]
    signature_refs: tuple[Ref, ...] = Field(max_length=32)
    static_key_type_refs: tuple[Ref, ...] = Field(max_length=64)
    static_door_refs: tuple[Ref, ...] = Field(max_length=64)
    disclosed: bool


class ChartLink(FrozenModel):
    from_ref: Ref
    to_ref: Ref
    direction_ref: Ref
    supported_evidence_ref: Ref


class ChartFragment(FrozenModel):
    chart_ref: Ref
    lattice_ref: Ref
    measured_origin: tuple[int,int]
    measured_pitch: tuple[int,int]
    nodes: tuple[ChartNode, ...] = Field(max_length=1024)
    links: tuple[ChartLink, ...] = Field(max_length=4096)
    current_marker_alternatives: tuple[Ref, ...] = Field(max_length=128)
    corner_anchor_refs: tuple[Ref, ...] = Field(max_length=128)
    @model_validator(mode='after')
    def graph(self):
        refs={n.chart_node_ref for n in self.nodes}
        if any(p<=0 for p in self.measured_pitch):raise ValueError('chart scale is measured separately for each fragment')
        if len(refs)!=len(self.nodes) or any(l.from_ref not in refs or l.to_ref not in refs for l in self.links):raise ValueError('chart node/link lattice and partial disclosure')
        return self


class ChartRegistration(FrozenModel):
    registration_ref: Ref
    chart_ref: Ref
    chart_to_room: tuple[tuple[Ref,Ref], ...] = Field(max_length=1024)
    anchor_evidence_refs: tuple[Ref, ...] = Field(min_length=1,max_length=128)
    arrival_evidence_refs: tuple[Ref, ...] = Field(max_length=128)
    @model_validator(mode='after')
    def injective(self):
        if len({a for a,_ in self.chart_to_room})!=len(self.chart_to_room) or len({b for _,b in self.chart_to_room})!=len(self.chart_to_room):raise ValueError('one-to-one registration alternative, not a palette choice')
        return self


class ChartAnchorMatch(FrozenModel):
    chart_ref: Ref
    chart_node_ref: Ref
    room_ref: Ref
    evidence_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    kind: Literal['CORNER_ANCHOR','CURRENT_ARRIVAL','MORPHOLOGY']


class NavigationRequestBase(FrozenModel):
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=256)
    state: NavigationState | None = None
    models: tuple[NavigationModel, ...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    input_ref: Ref | None = None
    observations: tuple[NavigationObservation, ...] = Field(default=(),max_length=256)
    needed_key_ref: Ref | None = None
    storage_key_ref: Ref | None = None
    storage_node_ref: Ref | None = None
    storage_word: tuple[Ref, ...] | None = Field(default=None,max_length=256)
    retrieval_word: tuple[Ref, ...] | None = Field(default=None,max_length=256)
    service_word: tuple[Ref, ...] | None = Field(default=None,max_length=256)
    storage_service_consumer_ref: Ref | None = None
    storage_need: NavigationStorageNeedD | None = None
    mask_retention: NavigationMaskRetentionD | None = None
    remaining_services: tuple[NavigationService, ...] = Field(default=(),max_length=128)
    required_door_ref: Ref | None = None
    expected_state: NavigationState | None = None
    actual_state: NavigationState | None = None
    entry_state: NavigationState | None = None
    raw_layer_pixels: tuple[ContactPixel, ...] = Field(default=(),max_length=65536)
    layer_templates: tuple[NavigationLayerTemplate, ...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample, ...] = Field(default=(),max_length=4096)
    charts: tuple[ChartFragment, ...] = Field(default=(),max_length=128)
    prior_charts: tuple[ChartFragment, ...] = Field(default=(),max_length=128)
    registrations: tuple[ChartRegistration, ...] = Field(default=(),max_length=128)
    anchor_matches: tuple[ChartAnchorMatch, ...] = Field(default=(),max_length=256)
    authorized_word: tuple[Ref, ...] | None = Field(default=None,max_length=256)
    step_identity: MechanicalRequestIdentity | None = None
    parent_identity: MechanicalRequestIdentity | None = None
    clock_ref: Ref | None = None
    temporal_scope_ref: Ref | None = None
    @model_validator(mode='after')
    def identities(self):
        for rows,name in ((self.models,'model_ref'),(self.charts,'chart_ref'),(self.registrations,'registration_ref'),(self.layer_templates,'template_ref')):
            if len({getattr(r,name) for r in rows})!=len(rows):raise ValueError('distinct current model, chart and registration alternatives')
        if len({p.point for p in self.raw_layer_pixels})!=len(self.raw_layer_pixels):raise ValueError('one current token per observed pixel')
        return self


class InventoryNavigationRequest(NavigationRequestBase):
    schema_version: Ref = 'yf_arc3_v5.inventory_navigation_request.v1'
    kernel_ref: Literal['mechanics.inventory_gated_navigation'] = 'mechanics.inventory_gated_navigation'


class ChartedNavigationRequest(NavigationRequestBase):
    schema_version: Ref = 'yf_arc3_v5.charted_navigation_request.v1'
    kernel_ref: Literal['mechanics.charted_room_navigation'] = 'mechanics.charted_room_navigation'


INVENTORY_OPERATIONS={'key_lock_inventory':'MEASURE','ownership_capacity_fit':'FIT','permission_consumption':'FIT','inventory_transaction':'STEP_INTERNAL','gated_step':'STEP',
    'capacity_dependencies':'INVERSE_DOMAIN','storage_retrieval':'PRECONDITION','inventory_route_domain':'DOMAIN','entry_memory_restore':'COMPARE','inventory_continuation':'COMPARE'}
CHARTED_OPERATIONS={'mechanics.charted_room_navigation.'+name:mode for name,mode in (
    ('measure_scene','MEASURE'),('decode_chart','MEASURE'),('register_chart','CORRESPOND'),('merge_static_dynamic_memory','UPDATE'),('fit_entry_transactions','FIT'),('room_step','STEP'),
    ('entry_permission_preimages','INVERSE_DOMAIN'),('bounded_route_domain','DOMAIN'),('information_frontier_prefix','COMPILE'),('compare_restore_scope','COMPARE'),('external_primitive','STEP'))}


def _keys(state):return {k.key_ref:k for k in state.keys}


def _state_equal(a,b):
    if _keys(a)!=_keys(b):return False
    sets=('opened_door_refs','collected_key_refs','used_refill_refs')
    return all(set(getattr(a,n))==set(getattr(b,n)) if n in sets else getattr(a,n)==getattr(b,n) for n in type(a).model_fields if n!='keys')


def _replace_keys(state,keys,order=None):
    return state.model_copy(update={'keys':tuple(keys[k] for k in sorted(keys)),'inventory_order':state.inventory_order if order is None else tuple(order)})


def _matching(state,door,model):
    keys=_keys(state);matches=tuple(ref for ref in state.inventory_order if keys[ref].type_ref in door.compatible_type_refs)
    if not matches:return None,('complete_current_inventory',) if not state.inventory_complete else ()
    return matches[0 if model.key_match_order=='FRONT' else -1],()


def _transaction(state,model,command,automatic=False,contact_node_ref=None):
    location=state.location_ref if contact_node_ref is None else contact_node_ref
    keys=_keys(state);order=list(state.inventory_order);ground=tuple(k for k in state.keys if k.node_ref==location and k.owner in ('GROUND','STORED'));events=[]
    node=next((n for n in model.nodes if n.node_ref==location),None)
    if node is None or not node.content_known:return state,(),('current_known_ground_ownership',)
    kind='PICKUP' if automatic else command.kind
    if kind not in ('PICKUP','DROP','EXCHANGE'):return state,({'kind':'REFUSE','cause':'not_an_inventory_transaction'},),()
    if not state.inventory_complete:return state,(),('complete_current_inventory_for_transaction',)
    if kind in ('DROP','EXCHANGE') and model.forbid_drop_on_goal:
        if node.goal is None:return state,(),('current_exit_drop_restriction',)
        if node.goal:return state,({'kind':'REFUSE','cause':'exit_drop_restriction'},),()
    if kind=='DROP':
        ref=command.key_ref if command.key_ref is not None else order[0 if model.drop_order=='FRONT' else -1] if order else None
        if ref not in order:return state,({'kind':'REFUSE','cause':'actual_held_occurrence'},),()
        if node.storage_allowed is None:return state,(),('storage_cell_admissibility',)
        if not node.storage_allowed or (ground and model.ground_occupancy=='EMPTY_REQUIRED'):return state,({'kind':'REFUSE','cause':'occupied_or_forbidden_ground'},),()
        order.remove(ref);keys[ref]=keys[ref].model_copy(update={'owner':'STORED','node_ref':state.location_ref})
        return _replace_keys(state,keys,order),({'kind':'DROP','key_ref':ref,'node_ref':state.location_ref},),()
    if automatic and model.pickup=='NONE':return state,(),()
    candidates=tuple(k for k in ground if command.key_ref is None or k.key_ref==command.key_ref)
    if not candidates:return state,({'kind':'REFUSE','cause':'no_supported_ground_occurrence'},),()
    incoming=candidates[0 if model.pickup!='LAST' else -1]
    if kind=='EXCHANGE' or len(order)>=state.capacity:
        if model.full_capacity=='REFUSE' or not order:return state,({'kind':'REFUSE','cause':'full_capacity_without_exchange'},),()
        outgoing=order[0 if model.full_capacity=='EXCHANGE_FRONT' else -1];order.remove(outgoing)
        keys[outgoing]=keys[outgoing].model_copy(update={'owner':'STORED','node_ref':location});events.append({'kind':'EXCHANGE_OUT','key_ref':outgoing})
    if len(order)>=state.capacity:return state,({'kind':'REFUSE','cause':'capacity'},),()
    keys[incoming.key_ref]=incoming.model_copy(update={'owner':'INVENTORY','node_ref':None});order.append(incoming.key_ref)
    after=_replace_keys(state,keys,order);after=after.model_copy(update={'collected_key_refs':tuple(dict.fromkeys(state.collected_key_refs+(incoming.key_ref,)))})
    return after,tuple(events)+({'kind':'PICKUP','key_ref':incoming.key_ref,'from_node':location},),()


def _trigger(trigger,current,before,target,entered,endpoint,from_ref=None):
    if from_ref is not None and before.location_ref!=from_ref:return False
    if trigger=='PRESENCE':return current.location_ref==endpoint
    if trigger=='ATTEMPT':return target==endpoint
    return entered and current.location_ref==endpoint


def _restore(state,model,outcome):
    if outcome=='RESTORE_DECLARED':return (model.restored_state,()) if model.restored_state is not None else (state,('declared_actual_restoration_scope',))
    if outcome=='UNKNOWN':return state,('current_hazard_or_exhaustion_outcome',)
    return state.model_copy(update={'status':outcome}),()


def _step(state,model,command):
    if state.status!='ACTIVE':return state,(),('qualified_active_navigation_scope',),(),0
    if command.cost>state.reserve and model.debit_policy=='REQUIRE_FUNDED':return state,(),('funded_current_primitive',),(),0
    nodes={n.node_ref:n for n in model.nodes};edge=next((e for e in model.edges if e.from_ref==state.location_ref and e.input_ref==command.input_ref),None)
    target=edge.to_ref if edge is not None else state.location_ref;current=state;entered=False;events=[];phase_states=[];missing=[];actual_cost=0
    for phase in model.phases:
        before=current;detail={'phase':phase};debt=()
        if phase=='DEBIT':
            actual_cost=command.cost;current=current.model_copy(update={'reserve':max(0,current.reserve-command.cost)});detail['cost']=actual_cost
        elif phase=='TRAVEL' and command.kind=='RESET':
            current,debt=_restore(current,model,'RESTORE_DECLARED');detail['direct_reset']=True
        elif phase=='TRAVEL' and command.kind=='MOVE':
            if edge is None:
                if not model.graph_complete:debt=('current_room_port_destination',)
                else:detail['blocked']=True
            else:
                node=nodes[target]
                if node.terrain=='UNKNOWN':debt=('observed_destination_traversability',)
                elif node.terrain=='BLOCKED':detail['blocked']=True
                else:
                    allowed=True
                    if edge.door_ref and edge.door_ref not in current.opened_door_refs:
                        door=next(d for d in model.doors if d.door_ref==edge.door_ref);key,missing_key=_matching(current,door,model)
                        if missing_key:debt=missing_key
                        allowed=model.closed_door_travel=='ALLOW_COMPATIBLE_PERMISSION' and key is not None
                    if allowed and not debt:current=current.model_copy(update={'location_ref':target});entered=target!=state.location_ref;detail['entered']=entered
                    else:detail['blocked']=True
        elif phase=='INVENTORY' and command.kind in ('PICKUP','DROP','EXCHANGE'):
            current,transaction,debt=_transaction(current,model,command);detail['ownership_events']=transaction
        elif phase=='COLLECT' and model.automatic_pickup:
            contact=target if model.collection_trigger=='ATTEMPT' else current.location_ref
            if _trigger(model.collection_trigger,current,state,target,entered,contact):
                current,transaction,debt=_transaction(current,model,command,True,contact);detail['ownership_events']=transaction
        elif phase=='OPEN':
            for door in model.doors:
                if door.door_ref in current.opened_door_refs or not _trigger(door.trigger,current,state,target,entered,door.triggering_endpoint_ref,door.triggering_from_ref):continue
                ref,debt=_matching(current,door,model)
                if debt:break
                if ref is None:continue
                keys=_keys(current);key=keys[ref];consume=door.consumption=='CONSUME'
                if door.consumption=='KEY_FLAG':
                    if key.reusable is None:debt=('occurrence_specific_key_reusability',);break
                    consume=not key.reusable
                order=list(current.inventory_order)
                if consume:order.remove(ref);keys[ref]=key.model_copy(update={'owner':'CONSUMED','node_ref':None})
                current=_replace_keys(current,keys,order).model_copy(update={'opened_door_refs':current.opened_door_refs+(door.door_ref,)})
                detail.setdefault('opened_transactions',[]).append({'door_ref':door.door_ref,'key_ref':ref,'consumed':consume})
        elif phase in ('REFILL','HAZARD','GOAL'):
            trigger=getattr(model,{'REFILL':'refill_trigger','HAZARD':'hazard_trigger','GOAL':'goal_trigger'}[phase]);node=nodes.get(target if trigger=='ATTEMPT' else current.location_ref)
            if node is None or not node.content_known:debt=('observed_current_room_contents',)
            elif _trigger(trigger,current,state,target,entered,node.node_ref):
                if phase=='REFILL' and node.refill_ref and node.refill_ref not in current.used_refill_refs:
                    if node.refill_amount is None:debt=('current_refill_quantity',)
                    else:current=current.model_copy(update={'reserve':node.refill_amount if model.refill_mode=='SET' else current.reserve+node.refill_amount,'used_refill_refs':current.used_refill_refs+(node.refill_ref,)})
                elif phase=='HAZARD':
                    if node.hazard is None:debt=('current_room_hazard_status',)
                    elif node.hazard:current,debt=_restore(current,model,model.hazard_outcome);detail['hazard']=True
                elif phase=='GOAL':
                    if node.goal is None:debt=('current_room_goal_status',)
                    elif node.goal:
                        keys=_keys(current);held=tuple(keys[r].type_ref for r in current.inventory_order);want=model.terminal_required_type_refs
                        satisfied=model.terminal_inventory=='UNRESTRICTED' or model.terminal_inventory=='EMPTY' and not held or model.terminal_inventory=='EXACT' and sorted(held)==sorted(want) or model.terminal_inventory=='AT_LEAST' and all(held.count(t)>=want.count(t) for t in sorted(set(want)))
                        if not current.inventory_complete and model.terminal_inventory!='UNRESTRICTED':debt=('current_terminal_inventory',)
                        elif satisfied:current=current.model_copy(update={'status':'WIN'});detail['acceptance']=True
        elif phase=='EXHAUSTION' and current.reserve<=0:current,debt=_restore(current,model,model.exhaustion_outcome);detail['exhausted']=True
        elif phase=='CLOCK':current=current.model_copy(update={'input_tick':current.input_tick+1})
        events.append(detail);phase_states.append((phase,before,current));missing.extend(debt)
        if debt or current.status!='ACTIVE' or current.level_scope_ref!=state.level_scope_ref or current.restore_epoch!=state.restore_epoch or command.kind=='RESET' and phase=='TRAVEL':break
    return current,tuple(events),tuple(dict.fromkeys(missing)),tuple(phase_states),actual_cost


def _work(state,model):
    return len(model.phases)*(1+len(state.keys)+len(model.doors))+len(model.nodes)+len(model.edges)


def _fit(request):
    compatible=[];refuted=[];unknown=[];count=0;cuts=[]
    for model_index,model in enumerate(request.models):
        valid=[];bad=[];missing=[]
        for observation in request.observations:
            work=_work(observation.before,model)
            if count+work>request.maximum_evaluations:cuts.append({'phase':'navigation_fit','next_model_index':model_index,'observation_ref':observation.observation_ref});break
            count+=work
            if not observation.sealed or observation.event_owner_ref!=request.scope.event_owner_ref or observation.epoch!=request.scope.epoch:missing.append(observation.observation_ref);continue
            command=next((c for c in model.commands if c.input_ref==observation.input_ref),None)
            if command is None:missing.append((observation.observation_ref,'bound_current_input'));continue
            after,events,debt,_,cost=_step(observation.before,model,command)
            if debt:missing.append((observation.observation_ref,debt))
            elif not _state_equal(after,observation.after):bad.append(observation.observation_ref)
            elif observation.owned_events:
                phases=tuple(e.kind_ref.rsplit('.',1)[-1].upper() for e in observation.owned_events)
                if phases!=tuple(e['phase'] for e in events) or any(e.producer_ref!=request.scope.event_owner_ref for e in observation.owned_events):bad.append((observation.observation_ref,'owned_checkpoint_order'))
                else:valid.append({'observation_ref':observation.observation_ref,'events':events,'primitive_cost':cost})
            else:
                valid.append({'observation_ref':observation.observation_ref,'endpoint_ownership_matches':True});missing.append((observation.observation_ref,'entry_ownership_cost_checkpoints'))
        if cuts:break
        if bad:refuted.append((model.model_ref,tuple(bad)))
        elif valid:
            compatible.append({'model':model,'supported_event_scope':valid,'unresolved_observations':missing,'universal_reusable_key_rule_inferred':False})
            if missing:unknown.append((model.model_ref,tuple(missing)))
        else:unknown.append((model.model_ref,tuple(missing) or ('current_owned_observations',)))
    return family_result(request,values={'compatible_transaction_models':compatible,'refuted_model_refs':refuted,'unknown_model_refs':unknown},examined_count=count,domain_complete=not cuts and not unknown,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _domain(request,model):
    nodes=[request.state];depths=[0];parents=[None];seen={request.state:0};queue=deque([0]);edges=[];cuts=[];boundaries=[];count=0
    while queue:
        index=queue.popleft();state=nodes[index]
        if state.status!='ACTIVE':continue
        if depths[index]>=request.maximum_depth:cuts.append({'node':index,'reason':'depth_bound'});continue
        for command_index,command in enumerate(model.commands):
            work=_work(state,model)
            if count+work>request.maximum_evaluations:cuts.append({'node':index,'next_command_index':command_index,'reason':'evaluation_bound'});queue.clear();break
            count+=work;after,events,debt,_,cost=_step(state,model,command)
            if debt:boundaries.append({'node':index,'command':command,'known_prefix_after':after,'events':events,'missing_refs':debt});continue
            if after.level_scope_ref!=state.level_scope_ref or after.restore_epoch!=state.restore_epoch:boundaries.append({'node':index,'command':command,'known_prefix_after':after,'reason':'qualify_new_execution_scope'});continue
            child=seen.get(after)
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'node':index,'next_command_index':command_index,'reason':'state_bound'});continue
                child=len(nodes);seen[after]=child;nodes.append(after);depths.append(depths[index]+1);parents.append((index,command.input_ref));queue.append(child)
            edges.append({'from_node':index,'to_node':child,'command':command,'events':events,'actual_cost':cost})
    return nodes,parents,depths,edges,count,cuts,boundaries


def _navigation_predecessor_word_d(parents,index):
    word=[]
    while parents[index] is not None:
        parent,ref=parents[index];word.append(ref);index=parent
    return tuple(reversed(word))


def _run_word(request,model,state,word,remaining):
    current=state;trace=[];count=0;debt=();cut={};prefix=[]
    for index,ref in enumerate(word):
        command=next((c for c in model.commands if c.input_ref==ref),None)
        if command is None:debt=('current_word_input_payload',);break
        work=_work(current,model)
        if count+work>remaining or index>=request.maximum_depth:cut={'phase':'navigation_word','next_input_index':index};break
        count+=work;after,events,debt,_,cost=_step(current,model,command)
        trace.append({'input':command,'before':current,'after':after,'events':events,'actual_cost':cost});prefix.append(ref);current=after
        if debt or current.status!='ACTIVE' or current.level_scope_ref!=state.level_scope_ref or current.restore_epoch!=state.restore_epoch:break
    return current,tuple(prefix),tuple(trace),count,debt,cut


def _services(state,model,services):
    keys=_keys(state);held=tuple(keys[r] for r in state.inventory_order);requirements=[]
    for service in services:
        opened=service.door_ref is not None and service.door_ref in state.opened_door_refs
        terminal_held=any(key.type_ref==service.key_type_ref for key in held)
        terminal_satisfied=state.status=='WIN' and terminal_held
        if (opened or service.door_ref is None) and (not service.required_terminal or terminal_satisfied):continue
        sources=tuple(k for k in state.keys if k.type_ref==service.key_type_ref and k.owner!='CONSUMED')
        requirements.append({'consumer_ref':service.consumer_ref,'key_type_ref':service.key_type_ref,'remaining_occurrence_refs':tuple(k.key_ref for k in sources),
            'currently_held_refs':tuple(k.key_ref for k in held if k.type_ref==service.key_type_ref),'stored_retrieval_refs':tuple(k.key_ref for k in sources if k.owner=='STORED'),'terminal_possession_required':service.required_terminal,
            'remaining_occurrence_properties':tuple((key.key_ref,key.reusable,key.owner,key.node_ref) for key in sources),
            'door_already_open':opened,'terminal_possession_currently_available':terminal_held,
            'joint_service_allocation_certified':False})
    return tuple(requirements)


def _storage(request,model):
    node=next((n for n in model.nodes if n.node_ref==request.storage_node_ref),None)
    if node is None or node.storage_allowed is None:return family_result(request,prerequisite_refs=('current_storage_admissibility',),domain_complete=False)
    if not node.storage_allowed:return family_result(request,values={'storage_service_usable':False,'refusal':'storage_forbidden'})
    current=request.state;count=0;traces=[];debts=[];cuts=[];valid=True
    need_work=2*len(current.keys)+len(request.remaining_services)+len(request.scope.assumption_refs)+128
    if need_work>request.maximum_evaluations:
        return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'storage_capacity_reason'})
    count+=need_work;capacity=measure_navigation_storage_need_d(request);debts.extend(capacity['missing_refs'])
    for phase,word in (('STORE',request.storage_word),('RETRIEVE',request.retrieval_word),('SERVICE',request.service_word)):
        after,prefix,trace,work,debt,cut=_run_word(request,model,current,word,request.maximum_evaluations-count);count+=work;traces.append({'phase':phase,'prefix':prefix,'trace':trace});debts.extend(debt)
        current=after
        if cut:cuts.append(cut)
        key=_keys(after).get(request.storage_key_ref)
        if phase=='STORE':valid=valid and key is not None and key.owner=='STORED' and key.node_ref==request.storage_node_ref
        elif phase=='RETRIEVE':valid=valid and key is not None and key.owner=='INVENTORY'
        if len(prefix)!=len(word) or debt or cut:valid=False;break
    consumer=next((s for s in request.remaining_services if s.consumer_ref==request.storage_service_consumer_ref),None)
    if consumer is None:debts.append('named_next_storage_permission_consumer');valid=False
    else:
        fulfilled=consumer.door_ref in current.opened_door_refs if consumer.door_ref is not None else consumer.required_terminal and current.status=='WIN' and any(k.type_ref==consumer.key_type_ref and k.owner=='INVENTORY' for k in current.keys)
        valid=valid and fulfilled
    pending=_services(current,model,request.remaining_services)
    key=_keys(current).get(request.storage_key_ref)
    retrieval_needed=key is not None and key.owner=='STORED' and any(
        row['consumer_ref']==request.storage_service_consumer_ref and request.storage_key_ref in row['remaining_occurrence_refs'] for row in pending)
    return family_result(request,values={'storage_service_usable':not debts and valid and current.status in ('ACTIVE','WIN'),'storage_retrieval_service_trace':traces,'after_service_state':current,
        'capacity_reason':capacity,'retained_retrieval_key_ref':request.storage_key_ref if retrieval_needed else None,
        'retained_retrieval_consumer_ref':request.storage_service_consumer_ref if retrieval_needed else None,
        'remaining_dependencies':pending,'legal_drop_is_sufficient':False},prerequisite_refs=tuple(dict.fromkeys(debts)),examined_count=count,domain_complete=not cuts and not debts,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _inverse(request,model,kind):
    if kind=='capacity_dependencies' and request.needed_key_ref not in _keys(request.state):return family_result(request,prerequisite_refs=('current_needed_key_occurrence',),domain_complete=False)
    if kind=='entry_permission_preimages':
        door=next((d for d in model.doors if d.door_ref==request.required_door_ref),None)
        if door is None:return family_result(request,prerequisite_refs=('current_required_door',),domain_complete=False)
        if door.door_ref in request.state.opened_door_refs:return family_result(request,values={'permission_services':({'door_ref':door.door_ref,'already_open':True,'new_key_debt':False},)})
    nodes,parents,depths,edges,count,cuts,boundaries=_domain(request,model);rows=[]
    for index,state in enumerate(nodes):
        if kind=='capacity_dependencies':
            needed=_keys(state).get(request.needed_key_ref)
            if needed is None:continue
            if needed.owner=='INVENTORY' or len(state.inventory_order)<state.capacity:
                changes=tuple((k.key_ref,k.owner,k.node_ref) for k in state.keys if _keys(request.state).get(k.key_ref)!=k)
                if count+3*depths[index]>request.maximum_evaluations:cuts.append({'node':index,'reason':'witness_reconstruction_bound'});break
                count+=3*depths[index];word=_navigation_predecessor_word_d(parents,index)
                rows.append({'state':state,'capacity_release_word':word,'needed_key_acquired':needed.owner=='INVENTORY','ownership_changes':changes,'remaining_services':_services(state,model,request.remaining_services),'always_drop_reusable_key':False})
        elif door.door_ref in state.opened_door_refs:
            if count+3*depths[index]>request.maximum_evaluations:cuts.append({'node':index,'reason':'witness_reconstruction_bound'});break
            count+=3*depths[index];word=_navigation_predecessor_word_d(parents,index)
            rows.append({'state':state,'door_ref':door.door_ref,'triggering_endpoint_ref':door.triggering_endpoint_ref,'actual_entry_permission_word':word,'reserve_after':state.reserve,'remaining_services':_services(state,model,request.remaining_services)})
        if len(rows)>=3:break
    return family_result(request,values={'capacity_release_candidates' if kind=='capacity_dependencies' else 'permission_services':rows,'joint_domain_edges':edges,'observation_boundaries':boundaries},examined_count=count,
        domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _compare(request,entry=False):
    before=request.entry_state if entry else request.expected_state;after=request.actual_state;count=len(before.keys)+len(after.keys)
    if count>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'navigation_ownership_compare'})
    a=_keys(before);b=_keys(after);changes=tuple((ref,a.get(ref),b.get(ref)) for ref in sorted(set(a)|set(b)) if a.get(ref)!=b.get(ref));lost=tuple(ref for ref in before.inventory_order if ref not in after.inventory_order)
    fields=tuple((name,getattr(before,name),getattr(after,name)) for name in ('location_ref','inventory_order','inventory_complete','capacity','opened_door_refs','collected_key_refs','used_refill_refs','reserve','status','level_scope_ref','restore_epoch') if getattr(before,name)!=getattr(after,name))
    stale=tuple(o.observation_ref for o in request.observations if not o.sealed or o.event_owner_ref!=request.scope.event_owner_ref or o.epoch!=request.scope.epoch)
    visible_absence=lost;mask=None;missing=[] if not stale else ['current_owned_sealed_navigation_events']
    if request.mask_retention is not None or not after.inventory_complete:
        mask=measure_navigation_mask_retention_d(request,before,request.maximum_evaluations-count)
        count+=mask['accounted_evaluations'];missing.extend(mask['missing_refs'])
        if not after.inventory_complete:
            lost=tuple(ref for ref in before.inventory_order if ref not in mask['proposed_inventory_order']) if not mask['missing_refs'] else ()
    return family_result(request,values={'ownership_changes':changes,'resource_permission_scope_changes':fields,'reacquisition_or_cleared_occurrence_refs':lost,'static_chart_redraw_is_dynamic_reset':False,
        'capacity_inherited_automatically':False,'actual_capacity':after.capacity,'still_open_permissions':after.opened_door_refs,'unverified_observation_refs':stale,'physical_rollback_performed':False,
        'masked_possession_review':mask,'unqualified_visible_absence_refs':visible_absence if not after.inventory_complete else (),
        'incomplete_visibility_proves_lost_possession':False},
        prerequisite_refs=tuple(missing),examined_count=count,domain_complete=not missing)


def _identity_missing(request,model_assignment_ref='navigation_model_ref'):
    identity=request.step_identity;parent=request.parent_identity;s=request.scope
    if identity is None or parent is None or request.clock_ref is None or request.temporal_scope_ref is None:return ('full_primitive_identity_parent_clock_scope',)
    checks=(identity.request_ref==s.request_ref,identity.caller_ref==s.caller_ref,identity.parent_contribution_ref==s.parent_contribution_ref,identity.epoch==s.epoch,
        identity.input_revision_ref==s.evidence_revision_ref,identity.model_assignments.get('model_revision_ref')==s.model_revision_ref,
        identity.kernel_ref==request.kernel_ref,identity.operation_ref==request.operation_ref,identity.mode=='STEP',
        identity.immutable_inputs.get('parent_goal_ref')==s.parent_goal_ref,identity.model_assignments.get(model_assignment_ref)==request.bound_model_ref,
        packet_context_equal(parent,identity,request.bound_model_ref),identity.actual_bounds.get('max_primitives',0)>=1,identity.actual_bounds.get('max_events',0)>=1)
    if not all(checks):return ('exact_complete_primitive_request_identity',)
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    if model is None or identity.actual_bounds.get('max_events',0)<len(model.phases):return ('declared_complete_primitive_event_bound',)
    command=next((c for c in model.commands if c.input_ref==request.input_ref),None) if model is not None else None
    if identity.immutable_inputs.get('state')!=immutable_json_data(request.state) or identity.immutable_inputs.get('command')!=immutable_json_data(command):return ('current_state_command_primitive_identity',)
    return ()


def _packet(request,model,command,after,events,phase_states,cost,missing=(),model_assignment_ref='navigation_model_ref',event_namespace='navigation'):
    identity=request.step_identity;parent=request.parent_identity;s=request.scope
    identity_debt=_identity_missing(request,model_assignment_ref)
    if identity_debt:return None,identity_debt
    ledger=[];snapshots={};before_fields=immutable_json_data(request.state.model_dump(mode='json'));after_fields=before_fields
    for index,((phase,before,current),detail) in enumerate(zip(phase_states,events)):
        prior_fields=after_fields;writes={k:getattr(current,k) for k in sorted(type(current).model_fields) if getattr(current,k)!=getattr(before,k)};writes=immutable_json_data(writes);after_fields=FrozenMap.overlay(writes,prior_fields)
        ref=s.request_ref+'.'+event_namespace+'.event.'+str(index);snapshot_ref=ref+'.before';snapshots[snapshot_ref]=prior_fields
        interrupted=current.status!='ACTIVE' or current.level_scope_ref!=request.state.level_scope_ref or current.restore_epoch!=request.state.restore_epoch
        ledger.append(MechanicalEventC(occurrence_ref=ref,producer_ref=s.event_owner_ref,kind_ref=event_namespace+'.'+phase.lower(),clock_ref=request.clock_ref,tick=before.input_tick,
            temporal_scope_ref=request.temporal_scope_ref,snapshot_ref=snapshot_ref,snapshot_kind='PRE_COMMAND' if phase=='DEBIT' and index==0 else 'SIMULTANEOUS',reads=prior_fields,writes=writes,
            costs=FrozenMap({'primitive_cost':cost}) if phase=='DEBIT' else FrozenMap(),predecessor_refs=(ledger[-1].occurrence_ref,) if ledger else (),predicate_values=immutable_json_data(detail),
            interruption_ref='navigation.execution_scope_ended' if interrupted else None))
    packet=ExternalPrimitivePacketC(request=identity,parent_request=parent,model_ref=model.model_ref,action_ref=command.action_ref,primitive_ref=command.input_ref,before=before_fields,after=after_fields,events=tuple(ledger),
        snapshots=FrozenMap(snapshots),closure_domain_ref=model.model_ref,closure_stop_ref='navigation.observation_boundary' if missing else ledger[-1].interruption_ref if ledger and ledger[-1].interruption_ref else 'navigation.declared_phases_complete',complete=not missing,missing_refs=missing,cost=cost,
        terminal=after.status!='ACTIVE' or after.level_scope_ref!=request.state.level_scope_ref or after.restore_epoch!=request.state.restore_epoch,acceptance=after.status=='WIN',response_ref=s.request_ref+'.navigation.response')
    return packet,()


def _measure_layers(request):
    measured=translated_layers(request);values=dict(measured.values);templates={t.template_ref:t for t in request.layer_templates};rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
    patterns={};count=measured.examined_count;cut={}
    for template in request.layer_templates:
        points=tuple(p.point for p in template.positive_pixels+template.negative_pixels)
        if not points:continue
        if count+len(points)>request.maximum_evaluations:cut={'phase':'whole_key_morphology','next_template_ref':template.template_ref};break
        count+=len(points);origin=(min(p[0] for p in points),min(p[1] for p in points))
        positive=tuple(sorted(((p.point[0]-origin[0],p.point[1]-origin[1]),p.token_ref) for p in template.positive_pixels))
        negative=tuple(sorted(((p.point[0]-origin[0],p.point[1]-origin[1]),p.token_ref) for p in template.negative_pixels))
        patterns[template.template_ref]=(positive,negative)
    correspondences=[];eligible=tuple(templates[r['template_ref']] for r in rows if r['template_ref'] in patterns)
    if not cut:
        for i,a in enumerate(eligible):
            if a.component not in ('MAP_KEY','INVENTORY_KEY'):continue
            for b_index,b in enumerate(eligible):
                if b.component not in ('MAP_KEY','INVENTORY_KEY','LOCK'):continue
                if b.component!='LOCK' and b_index<=i:continue
                work=sum(len(x) for x in patterns[a.template_ref]+patterns[b.template_ref])
                if count+work>request.maximum_evaluations:cut={'phase':'key_lock_correspondence','left_template_ref':a.template_ref,'right_template_ref':b.template_ref};break
                count+=work;ap,an=patterns[a.template_ref];bp,bn=patterns[b.template_ref]
                same=ap==bp and an==bn
                complement={p for p,_ in ap}=={p for p,_ in bn} and bool(ap)
                correspondences.append({'left_template_ref':a.template_ref,'right_template_ref':b.template_ref,'whole_multicolor_and_hole_pattern_equal':same,
                    'complementary_constraint_shape_candidate':complement if b.component=='LOCK' else None,'nonmatch_may_require_scale_or_view_calibration':not same,'semantic_key_type_assigned':False})
            if cut:break
    return measured.model_copy(update={'values':immutable_json_data({**values,'whole_morphology_correspondence_candidates':tuple({'measurement':r,'component':templates[r['template_ref']].component,'type_candidate_ref':templates[r['template_ref']].type_candidate_ref,
        'occurrence_candidate_ref':templates[r['template_ref']].occurrence_candidate_ref,'complementary_shape_ref':templates[r['template_ref']].complementary_shape_ref} for r in rows),'measured_pattern_correspondences':correspondences,'masked_inventory_is_absent':False,'marker_anchor_feedback_merged':False}),
        'examined_count':count,'domain_complete':measured.domain_complete and not cut,'computation_bound_reached':measured.computation_bound_reached or bool(cut),
        'frontier':immutable_json_data({'physical_measurement':measured.frontier,'correspondence':cut}) if cut else measured.frontier})


def _chart_decode(request):
    count=sum(len(c.nodes)+len(c.links) for c in request.charts)
    if count>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'chart_lattice_decode','next_chart_index':0})
    decoded=[]
    for chart in request.charts:
        points={};adjacency={}
        for node in chart.nodes:points.setdefault(node.point,[]).append(node.chart_node_ref)
        for link in chart.links:adjacency.setdefault(link.from_ref,[]).append(link)
        coordinates=tuple({'node_ref':n.chart_node_ref,'normalized_chart_address':tuple(str(Fraction(p-o,scale)) for p,o,scale in zip(n.point,chart.measured_origin,chart.measured_pitch)),'chart_pitch':chart.measured_pitch,'disclosed':n.disclosed,'signature_alternatives':n.signature_refs} for n in chart.nodes)
        links=tuple({'from_ref':n.chart_node_ref,'supported_links':tuple(adjacency.get(n.chart_node_ref,()))} for n in chart.nodes)
        decoded.append({'chart_ref':chart.chart_ref,'lattice_ref':chart.lattice_ref,'coordinate_index':tuple((p,tuple(points[p])) for p in sorted(points)),'normalized_node_coordinates':coordinates,'directional_link_index':links,'marker_alternatives':chart.current_marker_alternatives,'corner_anchors':chart.corner_anchor_refs})
    return family_result(request,values={'partial_chart_graphs':decoded,'node_interiors_and_corner_anchors_separate':True,'missing_disclosure_is_blocked_terrain':False,'visually_identical_markers_retained':True},examined_count=count)


def _register_chart(request):
    charts={c.chart_ref:c for c in request.charts+request.prior_charts};retained=[];refuted=[];unknown=[];count=0;cuts=[]
    for index,registration in enumerate(request.registrations):
        work=len(registration.chart_to_room)+len(request.anchor_matches)
        if count+work>request.maximum_evaluations:cuts.append({'phase':'chart_registration','next_registration_index':index});break
        count+=work;chart=charts.get(registration.chart_ref)
        if chart is None:unknown.append((registration.registration_ref,'observed_chart_fragment'));continue
        mapping=dict(registration.chart_to_room);node_refs={n.chart_node_ref for n in chart.nodes}
        if not set(mapping)<=node_refs:unknown.append((registration.registration_ref,'current_chart_node_correspondence'));continue
        anchors=tuple(a for a in request.anchor_matches if a.chart_ref==chart.chart_ref and a.event_owner_ref==request.scope.event_owner_ref and a.epoch==request.scope.epoch)
        available={a.evidence_ref for a in anchors}
        if not set(registration.anchor_evidence_refs+registration.arrival_evidence_refs)<=available:unknown.append((registration.registration_ref,'current_independent_anchor_and_arrival_evidence'));continue
        independent={a.evidence_ref for a in anchors if a.kind in ('CORNER_ANCHOR','CURRENT_ARRIVAL')}
        arrivals={a.evidence_ref for a in anchors if a.kind=='CURRENT_ARRIVAL'}
        if (not set(registration.anchor_evidence_refs)<=independent
                or not set(registration.arrival_evidence_refs)<=arrivals):
            unknown.append((registration.registration_ref,'independent_room_identity_not_visual_equality'));continue
        bad=tuple(a.evidence_ref for a in anchors if a.chart_node_ref not in mapping or mapping[a.chart_node_ref]!=a.room_ref)
        if bad:refuted.append((registration.registration_ref,bad))
        else:retained.append(registration)
    overlaps=[]
    for i,a in enumerate(retained):
        for b in retained[i+1:]:
            if a.chart_ref==b.chart_ref:continue
            work=len(a.chart_to_room)+len(b.chart_to_room)+len(charts[a.chart_ref].links)+len(charts[b.chart_ref].links)
            if count+work>request.maximum_evaluations:
                cuts.append({'phase':'chart_overlap','left_registration_ref':a.registration_ref,'right_registration_ref':b.registration_ref});break
            count+=work
            left={room:node for node,room in a.chart_to_room};right={room:node for node,room in b.chart_to_room};shared=tuple((room,left[room],right[room]) for room in sorted(set(left)&set(right)))
            am=dict(a.chart_to_room);bm=dict(b.chart_to_room)
            ae={(am[l.from_ref],l.direction_ref):am[l.to_ref] for l in charts[a.chart_ref].links if l.from_ref in am and l.to_ref in am}
            be={(bm[l.from_ref],l.direction_ref):bm[l.to_ref] for l in charts[b.chart_ref].links if l.from_ref in bm and l.to_ref in bm}
            contradictions=tuple((key,ae[key],be[key]) for key in sorted(set(ae)&set(be)) if ae[key]!=be[key])
            overlaps.append({'old_registration_ref':a.registration_ref,'new_registration_ref':b.registration_ref,'overlapping_rooms':shared,'supported_link_contradictions':contradictions,'chart_scale_moves_world_rooms':False})
        if cuts:break
    return family_result(request,values={'retained_registrations':retained,'refuted_registration_causes':refuted,'unknown_registrations':unknown,'old_new_room_correspondences':overlaps},examined_count=count,
        domain_complete=not cuts and not unknown,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _memory_delta(request):
    state=request.actual_state;static=[];count=0;cuts=[]
    for chart in request.charts:
        registration=tuple(r for r in request.registrations if r.chart_ref==chart.chart_ref)
        for node in chart.nodes:
            if count>=request.maximum_evaluations:cuts.append({'phase':'static_chart_delta','chart_ref':chart.chart_ref,'next_chart_node_ref':node.chart_node_ref});break
            count+=1;static.append({'chart_ref':chart.chart_ref,'node':node,'room_correspondence_alternatives':tuple((r.registration_ref,dict(r.chart_to_room).get(node.chart_node_ref)) for r in registration)})
        if cuts:break
    previous=request.expected_state or request.entry_state;dynamic={};missing=[];mask=None
    if not state.inventory_complete:
        mask=measure_navigation_mask_retention_d(request,previous,request.maximum_evaluations-count)
        count+=mask['accounted_evaluations'];missing.extend(mask['missing_refs'])
    for name in ('keys','inventory_order','inventory_complete','collected_key_refs','opened_door_refs','used_refill_refs'):
        if name in ('keys','inventory_order') and not state.inventory_complete:continue
        if previous is None or getattr(previous,name)!=getattr(state,name):dynamic[name]=getattr(state,name)
    if mask is not None and not mask['missing_refs']:
        dynamic['keys']=mask['proposed_keys'];dynamic['inventory_order']=mask['proposed_inventory_order']
        dynamic['inventory_complete']=mask['logical_inventory_complete_under_declared_premises']
    return family_result(request,values={'proposed_static_chart_updates':static,'proposed_dynamic_ledger_delta':dynamic,'dynamic_baseline_supplied':previous is not None,'negative_possession_qualified':state.inventory_complete,
        'observed_inventory_complete':state.inventory_complete,
        'masked_possession_review':mask,'independent_dynamic_scope':{'level_scope_ref':state.level_scope_ref,'restore_epoch':state.restore_epoch},'chart_annotation_restores_collected_flags':False,'canonical_memory_published':False},examined_count=count,
        prerequisite_refs=tuple(missing),domain_complete=not cuts and not missing,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def measure_inventory_navigation(request: InventoryNavigationRequest | ChartedNavigationRequest) -> MechanicalFamilyResult:
    operations=INVENTORY_OPERATIONS if request.kernel_ref=='mechanics.inventory_gated_navigation' else CHARTED_OPERATIONS
    if request.mode is None or operations.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    op=request.operation_ref.rsplit('.',1)[-1]
    if request.storage_need is not None and op!='storage_retrieval':
        return family_result(request,prerequisite_refs=('navigation.capacity_cause_requires_storage_review',),domain_complete=False)
    if request.mask_retention is not None and op not in ('merge_static_dynamic_memory','inventory_continuation','entry_memory_restore'):
        return family_result(request,prerequisite_refs=('navigation.retention_contract_requires_memory_review',),domain_complete=False)
    required={'key_lock_inventory':('raw_layer_pixels','layer_templates'),'measure_scene':('raw_layer_pixels','layer_templates'),'decode_chart':('charts',),'register_chart':('charts','registrations','anchor_matches'),
        'merge_static_dynamic_memory':('charts','registrations','actual_state'),'ownership_capacity_fit':('models','observations'),'permission_consumption':('models','observations'),'fit_entry_transactions':('models','observations'),
        'inventory_transaction':('state','models','bound_model_ref','input_ref'),'gated_step':('state','models','bound_model_ref','input_ref'),'room_step':('state','models','bound_model_ref','input_ref'),
        'external_primitive':('state','models','bound_model_ref','input_ref','step_identity','parent_identity','clock_ref','temporal_scope_ref'),'capacity_dependencies':('state','models','bound_model_ref','needed_key_ref'),
        'storage_retrieval':('state','models','bound_model_ref','storage_key_ref','storage_node_ref','storage_word','retrieval_word','service_word','storage_service_consumer_ref','remaining_services'),
        'inventory_route_domain':('state','models','bound_model_ref'),'bounded_route_domain':('state','models','bound_model_ref'),'entry_permission_preimages':('state','models','bound_model_ref','required_door_ref'),
        'information_frontier_prefix':('state','models','bound_model_ref','authorized_word'),'entry_memory_restore':('entry_state','actual_state'),'inventory_continuation':('expected_state','actual_state'),
        'compare_restore_scope':('expected_state','actual_state')}
    missing=missing_supplied_fields(request,required[op])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op in ('key_lock_inventory','measure_scene'):return _measure_layers(request)
    if op=='decode_chart':return _chart_decode(request)
    if op=='register_chart':return _register_chart(request)
    if op=='merge_static_dynamic_memory':return _memory_delta(request)
    if op in ('ownership_capacity_fit','permission_consumption','fit_entry_transactions'):return _fit(request)
    if op in ('entry_memory_restore','inventory_continuation','compare_restore_scope'):return _compare(request,op=='entry_memory_restore')
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    if model is None:return family_result(request,prerequisite_refs=('bound_current_navigation_model',),domain_complete=False)
    if op=='storage_retrieval':return _storage(request,model)
    if op in ('capacity_dependencies','entry_permission_preimages'):return _inverse(request,model,op)
    if op in ('inventory_route_domain','bounded_route_domain'):
        nodes,parents,depths,edges,count,cuts,boundaries=_domain(request,model)
        witnesses=[]
        for index,state in enumerate(nodes):
            if state.status!='WIN':continue
            if count+3*depths[index]>request.maximum_evaluations:
                cuts.append({'node':index,'reason':'witness_reconstruction_bound'});break
            count+=3*depths[index];witnesses.append(_navigation_predecessor_word_d(parents,index))
            if len(witnesses)>=3:break
        return family_result(request,values={'joint_states':nodes,'primitive_edges':edges,
            'structural_predecessors':parents,'conditional_completion_words':tuple(witnesses),
            'observation_boundaries':boundaries,'same_pose_capacity_is_equivalence':False},examined_count=count,
            domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})
    if op=='information_frontier_prefix':
        after,prefix,trace,count,debt,cut=_run_word(request,model,request.state,request.authorized_word,request.maximum_evaluations)
        return family_result(request,values={'candidate_prefix':prefix,'trace':trace,'after_prefix_state':after,'first_information_question':debt,'action_release':False,'unknown_future_chart_used':False},prerequisite_refs=debt,examined_count=count,domain_complete=not cut and not debt,computation_bound_reached=bool(cut),frontier=cut)
    command=next((c for c in model.commands if c.input_ref==request.input_ref),None)
    if command is None:return family_result(request,prerequisite_refs=('current_registered_input',),domain_complete=False)
    work=_work(request.state,model)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'navigation_primitive'})
    if op=='inventory_transaction':
        after,events,debt=_transaction(request.state,model,command)
        return family_result(request,values={'after_state':after,'ownership_events':events,'external_command_count':0,'debit_applied':False},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
    if op=='external_primitive':
        identity_debt=_identity_missing(request)
        if identity_debt:return family_result(request,prerequisite_refs=identity_debt,domain_complete=False)
    after,events,debt,phase_states,cost=_step(request.state,model,command);packet=None
    if op=='external_primitive':
        packet,packet_debt=_packet(request,model,command,after,events,phase_states,cost,debt);debt=debt+packet_debt
    return family_result(request,values={'after_state':after,'event_ordered_trace':events,'primitive_packet':packet,'external_command_count':int(bool(phase_states)),'primitive_applied':bool(phase_states),'actual_primitive_cost':cost,
        'primitive_scope':model.primitive_scope,'cost_and_restoration_applied_once':True},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
