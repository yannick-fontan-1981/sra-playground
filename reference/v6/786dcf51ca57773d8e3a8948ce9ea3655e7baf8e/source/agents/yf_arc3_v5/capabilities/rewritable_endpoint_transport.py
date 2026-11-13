"""Directed layered transport using the pre-input pairing and scoped patches."""
from collections import deque
from heapq import heappop,heappush
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields
from .mechanical_request_contracts import MechanicalRequestIdentity
from .inventory_gated_navigation import _identity_missing as primitive_identity_missing,_packet as primitive_packet
from .identity_contact_authentication import ContactPixel,ContactLayerTemplate,ContactLayerSample,_candidate_layers as translated_layers
from .mutable_kit_survival import KitEventTrace as EndpointEventTrace
from .contracts import PeriodicCellGridInput
from .frame import enumerate_periodic_cell_grids

Point=tuple[int,int]
CARDINALS=((0,-1),(0,1),(-1,0),(1,0))


def _add(a,b):return (a[0]+b[0],a[1]+b[1])


class EndpointCell(FrozenModel):
    point: Point
    terrain: Literal['FLOOR','WALL','UNKNOWN']


class EndpointLayer(FrozenModel):
    layer_ref: Ref
    cells: tuple[EndpointCell,...] = Field(max_length=4096)
    observed: bool
    geometry_revision_ref: Ref
    @model_validator(mode='after')
    def addresses(self):
        if len({c.point for c in self.cells})!=len(self.cells):raise ValueError('one current terrain state per observed address')
        return self


class Endpoint(FrozenModel):
    endpoint_ref: Ref
    signature_ref: Ref
    layer_ref: Ref
    point: Point
    outward_face: Point | None = None
    @model_validator(mode='after')
    def face(self):
        if self.outward_face is not None and self.outward_face not in CARDINALS:raise ValueError('supported face orientation remains distinct from jump vector')
        return self


class EndpointPair(FrozenModel):
    source_ref: Ref
    destination_ref: Ref


class EndpointState(FrozenModel):
    layer_ref: Ref
    point: Point
    phase: Literal['FLOOR','ON_LANDING','DISMOUNT_REQUIRED']
    landed_endpoint_ref: Ref | None = None
    layers: tuple[EndpointLayer,...] = Field(max_length=128)
    pairs: tuple[EndpointPair,...] = Field(max_length=256)
    graph_mode_ref: Ref
    graph_revision: int = Field(ge=0)
    acquired_visit_refs: tuple[Ref,...] = Field(max_length=256)
    remaining_resource: int = Field(ge=0,le=10**9)
    input_tick: int = Field(ge=0)
    episode_ref: Ref
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def relations(self):
        if len({l.layer_ref for l in self.layers})!=len(self.layers) or len({p.source_ref for p in self.pairs})!=len(self.pairs):raise ValueError('one layer and current directed partner per identity')
        if len(set(self.acquired_visit_refs))!=len(self.acquired_visit_refs):raise ValueError('acquired visits are not pairing knowledge')
        if (self.phase!='FLOOR')!=(self.landed_endpoint_ref is not None):raise ValueError('landing phase has its actual endpoint context')
        return self


class EndpointInput(FrozenModel):
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    kind: Literal['MOVE','WAIT','RESET']
    delta: Point
    cost: int = Field(ge=0,le=65536)
    @model_validator(mode='after')
    def motion(self):
        if self.kind=='MOVE' and self.delta not in CARDINALS:raise ValueError('supplied local input map is one ordinary step')
        if self.kind!='MOVE' and self.delta!=(0,0):raise ValueError('stationary controls have no hidden move')
        return self


class EndpointRewrite(FrozenModel):
    rewrite_ref: Ref
    layer_ref: Ref
    point: Point
    trigger: Literal['ARRIVAL','LANDING','DISMOUNT']
    before_mode_ref: Ref
    after_mode_ref: Ref
    after_pairs: tuple[EndpointPair,...] = Field(max_length=256)
    supported_evidence_ref: Ref


class TerrainWrite(FrozenModel):
    point: Point
    before_terrain: Literal['FLOOR','WALL','UNKNOWN']
    after_terrain: Literal['FLOOR','WALL','UNKNOWN']


class EndpointPatch(FrozenModel):
    patch_ref: Ref
    source_endpoint_ref: Ref
    destination_endpoint_ref: Ref
    layer_ref: Ref
    before_revision_ref: Ref
    after_revision_ref: Ref
    licensed_points: tuple[Point,...] = Field(max_length=128)
    writes: tuple[TerrainWrite,...] = Field(max_length=128)
    supported_event_evidence_ref: Ref
    event_owner_ref: Ref
    current_epoch: int = Field(ge=0)
    @model_validator(mode='after')
    def localized(self):
        if len({w.point for w in self.writes})!=len(self.writes) or not {w.point for w in self.writes}<=set(self.licensed_points):raise ValueError('only exact event-licensed terrain writes, never broad wall clearing')
        return self


class EndpointModel(FrozenModel):
    model_ref: Ref
    endpoints: tuple[Endpoint,...] = Field(max_length=256)
    commands: tuple[EndpointInput,...] = Field(min_length=1,max_length=64)
    footprint: tuple[Point,...] = Field(min_length=1,max_length=128)
    rewrites: tuple[EndpointRewrite,...] = Field(max_length=128)
    patches: tuple[EndpointPatch,...] = Field(max_length=128)
    phases: tuple[Literal['DEBIT','MOVE','TRANSFER','PATCH','REWRITE','VISITS','GOAL','EXHAUSTION','CLOCK'],...]
    entry_side: Literal['FRONT_ONLY','ANY_SIDE']
    landing: Literal['ON_ENDPOINT','EMERGE_ADJACENT']
    landing_phase: Literal['ON_LANDING','DISMOUNT_REQUIRED']
    landing_control: Literal['DISMOUNT_BY_MOVE','RETURN_BY_MOVE','RETURN_BY_WAIT']
    visit_recording: Literal['SOURCE','DESTINATION','BOTH']
    require_funded_input: bool
    required_visit_refs: tuple[Ref,...] = Field(max_length=256)
    required_mode_ref: Ref | None = None
    goal_layer_ref: Ref
    goal_point: Point
    goal_phases: tuple[Literal['FLOOR','ON_LANDING','DISMOUNT_REQUIRED'],...] = Field(min_length=1,max_length=3)
    exhaustion: Literal['LOCAL_STOP','GAME_OVER','RESTORE_DECLARED','UNKNOWN']
    restored_state: EndpointState | None = None
    graph_complete: bool
    @model_validator(mode='after')
    def exact(self):
        if len({e.endpoint_ref for e in self.endpoints})!=len(self.endpoints) or len({i.input_ref for i in self.commands})!=len(self.commands):raise ValueError('distinct endpoint and input identities')
        if len(set(self.phases))!=len(self.phases) or set(self.phases)!={'DEBIT','MOVE','TRANSFER','PATCH','REWRITE','VISITS','GOAL','EXHAUSTION','CLOCK'}:raise ValueError('one event pass and cost per primitive')
        if self.phases[0]!='DEBIT' or self.phases[-1]!='CLOCK' or self.phases.index('REWRITE')<self.phases.index('TRANSFER'):raise ValueError('rewrites follow transport using the pre-input relation')
        if not self.phases.index('MOVE')<self.phases.index('TRANSFER')<self.phases.index('PATCH') or self.phases.index('VISITS')<self.phases.index('TRANSFER'):raise ValueError('move, one transfer, then its patch/visits are causally ordered')
        return self


class EndpointObservation(FrozenModel):
    observation_ref: Ref
    before: EndpointState
    after: EndpointState
    input_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    pre_graph_revision: int = Field(ge=0)


class EpisodePairMemory(FrozenModel):
    memory_ref: Ref
    episode_ref: Ref
    mode_ref: Ref
    source_signature_ref: Ref
    destination_signature_ref: Ref
    outward_face: Point | None


class LayerRegistration(FrozenModel):
    registration_ref: Ref
    old_layer_ref: Ref
    new_layer_ref: Ref
    offset: Point
    supported_identity_evidence_ref: Ref | None = None


class EndpointLayerTemplate(ContactLayerTemplate):
    component: Literal['ENDPOINT_ID','PAIR_PATTERN','FACE','SWITCH','EXIT','LAYER_MARKER','GAUGE_TICK','RESERVE','PROGRESS','TERRAIN','CURSOR','DECORATION','UNKNOWN']
    endpoint_candidate_ref: Ref | None = None
    layer_candidate_ref: Ref | None = None


class EndpointNumericCalibration(FrozenModel):
    template_ref: Ref
    quantity: Literal['LAYER_INDEX','RESERVE','CAMPAIGN_PROGRESS','REFERENCE_TICKS']
    minimum: int = Field(ge=0,le=10**9)
    maximum: int = Field(ge=0,le=10**9)
    supported_evidence_ref: Ref
    @model_validator(mode='after')
    def interval(self):
        if self.minimum>self.maximum:raise ValueError('quantized render interval is not an invented exact count')
        return self


class EndpointRequestBase(FrozenModel):
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=256)
    maximum_witnesses: int = Field(default=3,ge=1,le=3)
    state: EndpointState | None = None
    models: tuple[EndpointModel,...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    input_ref: Ref | None = None
    source_endpoint_ref: Ref | None = None
    destination_endpoint_ref: Ref | None = None
    rewrite_ref: Ref | None = None
    patch_ref: Ref | None = None
    authorized_need_ref: Ref | None = None
    need_endpoint_refs: tuple[Ref,...] = Field(default=(),max_length=256)
    ablated_endpoint_ref: Ref | None = None
    proposed_lower_bound: int | None = Field(default=None,ge=0,le=65536)
    minimum_primitive_cost: int | None = Field(default=None,ge=0,le=65536)
    observations: tuple[EndpointObservation,...] = Field(default=(),max_length=256)
    episode_memories: tuple[EpisodePairMemory,...] = Field(default=(),max_length=128)
    registrations: tuple[LayerRegistration,...] = Field(default=(),max_length=128)
    prior_layers: tuple[EndpointLayer,...] = Field(default=(),max_length=128)
    expected_state: EndpointState | None = None
    actual_state: EndpointState | None = None
    expected_trace: EndpointEventTrace | None = None
    actual_trace: EndpointEventTrace | None = None
    step_identity: MechanicalRequestIdentity | None = None
    parent_identity: MechanicalRequestIdentity | None = None
    clock_ref: Ref | None = None
    temporal_scope_ref: Ref | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[EndpointLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    grid_input: PeriodicCellGridInput | None = None
    numeric_calibrations: tuple[EndpointNumericCalibration,...] = Field(default=(),max_length=128)
    @model_validator(mode='after')
    def identity(self):
        for rows,name in ((self.models,'model_ref'),(self.layer_templates,'template_ref'),(self.registrations,'registration_ref')):
            if len({getattr(x,name) for x in rows})!=len(rows):raise ValueError('distinct scoped model/measurement/registration alternatives')
        return self


class EndpointTransportRequest(EndpointRequestBase):
    schema_version: Ref = 'yf_arc3_v5.endpoint_request.v1'
    kernel_ref: Literal['mechanics.rewritable_endpoint_transport'] = 'mechanics.rewritable_endpoint_transport'


class OrientedPassageRequest(EndpointRequestBase):
    schema_version: Ref = 'yf_arc3_v5.oriented_passage_request.v1'
    kernel_ref: Literal['mechanics.oriented_passage'] = 'mechanics.oriented_passage'


ENDPOINT_OPERATIONS={'endpoint_correspondence':'MEASURE','transport_law_fit':'FIT','oriented_landing':'PRECONDITION','graph_rewrite':'STEP_INTERNAL','endpoint_step':'STEP',
    'visit_access_constraints':'PROPAGATE','transport_preimages':'INVERSE_DOMAIN','rewritable_route_domain':'DOMAIN','episode_relation_rebind':'FIT','endpoint_compare':'COMPARE'}
PASSAGE_OPERATIONS={'mechanics.oriented_passage.'+name:mode for name,mode in (('passage_scene_measure','MEASURE'),('layer_resource_measure','MEASURE'),('passage_control_fit','FIT'),('layer_correspondence','COMPARE'),
    ('component_port_graph','DOMAIN'),('successor','STEP'),('costed_passage_domain','DOMAIN'),('continuation_domain','INVERSE_DOMAIN'),('sealed_passage_compare','COMPARE'),('cost_admissible_bound','BOUND'),('external_primitive','STEP'),('event_scoped_terrain_patch','STEP_INTERNAL'))}


def _layer(state,ref):return next((l for l in state.layers if l.layer_ref==ref),None)


def _support(state,model,layer_ref,point):
    layer=_layer(state,layer_ref)
    if layer is None or not layer.observed:return False,('observed_landing_layer',)
    cells={c.point:c.terrain for c in layer.cells};terrain=tuple(cells.get(_add(point,p),'UNKNOWN') for p in model.footprint)
    if 'WALL' in terrain:return False,()
    if 'UNKNOWN' in terrain:return False,('whole_landing_footprint_terrain',)
    return True,()


def _landing(state,model,source_ref):
    endpoints={e.endpoint_ref:e for e in model.endpoints};source=endpoints.get(source_ref);pair=next((p for p in state.pairs if p.source_ref==source_ref),None)
    if source is None or pair is None:return None,('current_directed_endpoint_pair',)
    destination=endpoints.get(pair.destination_ref)
    if destination is None or destination.outward_face is None:return None,('current_partner_and_outward_face',)
    point=destination.point if model.landing=='ON_ENDPOINT' else _add(destination.point,destination.outward_face)
    supported,debt=_support(state,model,destination.layer_ref,point)
    if debt:return None,debt
    return {'source':source,'destination':destination,'layer_ref':destination.layer_ref,'point':point,'supported':supported,'pre_graph_revision':state.graph_revision},()


def _patch(request,state,model,patch,source_ref,destination_ref):
    if patch.event_owner_ref!=request.scope.event_owner_ref or patch.current_epoch!=request.scope.epoch or patch.source_endpoint_ref!=source_ref or patch.destination_endpoint_ref!=destination_ref:return state,('exact_current_transfer_patch_license',)
    layer=_layer(state,patch.layer_ref)
    if layer is None or not layer.observed or layer.geometry_revision_ref!=patch.before_revision_ref:return state,('patch_current_layer_and_before_revision',)
    cells={c.point:c.terrain for c in layer.cells}
    if any(cells.get(w.point,'UNKNOWN')!=w.before_terrain for w in patch.writes):return state,('patch_before_terrain_correspondence',)
    for write in patch.writes:cells[write.point]=write.after_terrain
    changed=layer.model_copy(update={'cells':tuple(EndpointCell(point=p,terrain=cells[p]) for p in sorted(cells)),'geometry_revision_ref':patch.after_revision_ref})
    return state.model_copy(update={'layers':tuple(changed if l.layer_ref==layer.layer_ref else l for l in state.layers)}),()


def _rewrite(state,rewrite):
    if state.graph_mode_ref!=rewrite.before_mode_ref:return state,('current_switch_before_mode',)
    if len({p.source_ref for p in rewrite.after_pairs})!=len(rewrite.after_pairs):return state,('unambiguous_rewritten_directed_pairs',)
    return state.model_copy(update={'pairs':rewrite.after_pairs,'graph_mode_ref':rewrite.after_mode_ref,'graph_revision':state.graph_revision+1}),()


def _access(state,model):
    missing=tuple(r for r in model.required_visit_refs if r not in state.acquired_visit_refs)
    mode_ok=model.required_mode_ref is None or state.graph_mode_ref==model.required_mode_ref
    entered=state.layer_ref==model.goal_layer_ref and state.point==model.goal_point and state.phase in model.goal_phases
    return {'missing_visit_services':missing,'required_mode_satisfied':mode_ok,'actual_destination_entered':entered,'access_and_acceptance_predicate':not missing and mode_ok and entered}


def _step(request,state,model,command):
    if state.status!='ACTIVE':return state,(),('qualified_active_endpoint_scope',),(),0
    if model.require_funded_input and command.cost>state.remaining_resource:return state,(),('funded_endpoint_input',),(),0
    current=state;events=[];phase_states=[];debt=();cost=0;source_ref=None;destination_ref=None;landing_info=None;motion_event=None
    endpoints={e.endpoint_ref:e for e in model.endpoints};pre_pairs=state.pairs
    for phase in model.phases:
        before=current;detail={'phase':phase};missing=()
        if phase=='DEBIT':cost=command.cost;current=current.model_copy(update={'remaining_resource':max(0,current.remaining_resource-cost)});detail['cost']=cost
        elif phase=='MOVE':
            if command.kind=='RESET':
                if model.restored_state is None:missing=('declared_actual_endpoint_restoration',)
                else:current=model.restored_state;detail['reset']=True
            elif state.phase!='FLOOR':
                if state.landed_endpoint_ref not in endpoints:missing=('current_landing_endpoint_phase',)
                elif (model.landing_control=='RETURN_BY_MOVE' and command.kind=='MOVE') or (model.landing_control=='RETURN_BY_WAIT' and command.kind=='WAIT'):source_ref=state.landed_endpoint_ref;motion_event='LANDING_RETURN'
                elif command.kind=='MOVE':
                    target=_add(current.point,command.delta);supported,missing=_support(current,model,current.layer_ref,target)
                    if supported:current=current.model_copy(update={'point':target,'phase':'FLOOR','landed_endpoint_ref':None});motion_event='DISMOUNT'
                    detail['blocked']=not supported
            elif command.kind=='MOVE':
                target=_add(current.point,command.delta);endpoint=next((e for e in model.endpoints if e.layer_ref==current.layer_ref and e.point==target),None)
                if endpoint:
                    if model.entry_side=='FRONT_ONLY' and endpoint.outward_face is None:missing=('supported_source_face',)
                    elif model.entry_side=='FRONT_ONLY' and current.point!=_add(endpoint.point,endpoint.outward_face):detail['blocked_face']=True
                    else:source_ref=endpoint.endpoint_ref;motion_event='ENTRY'
                else:
                    supported,missing=_support(current,model,current.layer_ref,target)
                    if supported:current=current.model_copy(update={'point':target});motion_event='ARRIVAL'
                    detail['blocked']=not supported
        elif phase=='TRANSFER' and source_ref is not None:
            # Pairing from the before state, even if later landing rewrites the graph.
            paired_state=current.model_copy(update={'pairs':pre_pairs,'graph_revision':state.graph_revision})
            landing_info,missing=_landing(paired_state,model,source_ref)
            if landing_info and landing_info['supported']:
                destination_ref=landing_info['destination'].endpoint_ref
                current=current.model_copy(update={'layer_ref':landing_info['layer_ref'],'point':landing_info['point'],'phase':model.landing_phase if model.landing=='ON_ENDPOINT' else 'FLOOR',
                    'landed_endpoint_ref':destination_ref if model.landing=='ON_ENDPOINT' else None})
                motion_event='LANDING';detail['transport']={'source_ref':source_ref,'destination_ref':destination_ref,'pre_graph_revision':state.graph_revision,'landing':landing_info['point']}
            elif landing_info:detail['blocked_landing']=True
        elif phase=='PATCH' and destination_ref is not None:
            patches=tuple(p for p in model.patches if p.source_endpoint_ref==source_ref and p.destination_endpoint_ref==destination_ref)
            for patch in patches:
                current,missing=_patch(request,current,model,patch,source_ref,destination_ref)
                if missing:break
                detail.setdefault('event_scoped_patch_refs',[]).append(patch.patch_ref)
        elif phase=='REWRITE' and motion_event is not None:
            for rewrite in model.rewrites:
                if rewrite.layer_ref==current.layer_ref and rewrite.point==current.point and rewrite.trigger==motion_event and rewrite.before_mode_ref==current.graph_mode_ref:
                    current,missing=_rewrite(current,rewrite)
                    if missing:break
                    detail.setdefault('rewrite_refs',[]).append(rewrite.rewrite_ref)
        elif phase=='VISITS' and destination_ref is not None:
            visits=(source_ref,) if model.visit_recording=='SOURCE' else (destination_ref,) if model.visit_recording=='DESTINATION' else (source_ref,destination_ref)
            current=current.model_copy(update={'acquired_visit_refs':tuple(dict.fromkeys(current.acquired_visit_refs+visits))});detail['acquired']=visits
        elif phase=='GOAL':
            predicate=_access(current,model);detail['acceptance_predicate']=predicate
            if predicate['access_and_acceptance_predicate']:current=current.model_copy(update={'status':'WIN'})
        elif phase=='EXHAUSTION' and current.remaining_resource<=0:
            if model.exhaustion=='UNKNOWN':missing=('actual_endpoint_exhaustion_outcome',)
            elif model.exhaustion=='RESTORE_DECLARED':
                if model.restored_state is None:missing=('declared_endpoint_restoration_scope',)
                else:current=model.restored_state;detail['restored']=True
            else:current=current.model_copy(update={'status':model.exhaustion})
        elif phase=='CLOCK':current=current.model_copy(update={'input_tick':current.input_tick+1})
        events.append(detail);phase_states.append((phase,before,current));debt=tuple(dict.fromkeys(debt+missing))
        if missing or current.status!='ACTIVE' or current.level_scope_ref!=state.level_scope_ref or current.restore_epoch!=state.restore_epoch or command.kind=='RESET' and phase=='MOVE':break
    return current,tuple(events),debt,tuple(phase_states),cost


def _work(state,model):return len(model.phases)*(1+len(model.endpoints)+sum(len(l.cells) for l in state.layers))+sum(len(p.writes) for p in model.patches)


def _floor_approach_distances(request,model):
    # Only the explicitly anchored source-face approach has this local domain.
    # Distances order exact successor evaluation; they never authorize an input.
    state=request.state
    if (not isinstance(request,OrientedPassageRequest)
            or request.operation_ref!='mechanics.oriented_passage.costed_passage_domain'
            or request.source_endpoint_ref is None or state.phase!='FLOOR'
            or state.layer_ref!=model.goal_layer_ref or model.goal_phases!=('FLOOR',)
            or model.patches or model.rewrites or model.required_visit_refs
            or model.required_mode_ref is not None or model.footprint!=((0,0),)
            or any(c.kind!='MOVE' or c.delta not in CARDINALS or c.cost!=1 for c in model.commands)):
        return None,0
    source=next((e for e in model.endpoints if e.endpoint_ref==request.source_endpoint_ref),None)
    if (source is None or source.layer_ref!=state.layer_ref or source.outward_face is None
            or _add(source.point,source.outward_face)!=model.goal_point):return None,0
    layer=_layer(state,state.layer_ref)
    if layer is None or not layer.observed:return None,0
    work=len(layer.cells)+len(model.endpoints)
    if work>request.maximum_evaluations:return None,0
    floor={c.point for c in layer.cells if c.terrain=='FLOOR'}-{e.point for e in model.endpoints if e.layer_ref==state.layer_ref}
    if state.point not in floor or model.goal_point not in floor:return None,work
    distances={model.goal_point:0};pending=deque([model.goal_point])
    while pending:
        point=pending.popleft()
        if point==state.point:return distances,work
        if distances[point]>=request.maximum_depth:continue
        if work+4>request.maximum_evaluations:return None,work
        work+=4
        for delta in CARDINALS:
            neighbor=_add(point,delta)
            if neighbor not in floor or neighbor in distances:continue
            if len(distances)>=request.maximum_states:return None,work
            distances[neighbor]=distances[point]+1;pending.append(neighbor)
    return None,work


def _staged_floor_domain_eligible(request, model, distances):
    # Caller obtained distances from unchanged _floor_approach_distances.
    # Additional restrictions only; all other cases keep the existing _domain.
    return (distances is not None and request.state.point != model.goal_point
            and 1 <= len(model.commands) <= 4
            and len({c.delta for c in model.commands}) == len(model.commands)
            and len({c.input_ref for c in model.commands}) == len(model.commands))


def _staged_floor_domain(request, model, distances, count):
    """Same typed successor, charges and state/depth bounds; retain pending alternatives.

    A priority estimates only the already supplied local geometric target. It is
    never an edge, witness or permission. Only actual _step returns make edges.
    Search favors deeper equal-distance candidates before lateral continuations;
    every unexamined (node, command) remains on the finite heap until an explicit
    bound. There is no route/goal shortcut and no direct completion-word insertion.
    """
    nodes = [request.state]
    parents = [None]
    depths = [0]
    seen = {request.state: 0}
    edges, cuts, boundaries, queue = [], [], [], []

    def enqueue(index):
        state = nodes[index]
        if state.status != 'ACTIVE':
            return
        if depths[index] >= request.maximum_depth:
            cuts.append({'node': index, 'reason': 'depth_bound'})
            return
        for command_index, command in enumerate(model.commands):
            distance = (distances.get(_add(state.point, command.delta))
                        if state.layer_ref == request.state.layer_ref
                        and state.phase == 'FLOOR' else None)
            child_depth = depths[index] + 1
            estimate = ((0, child_depth + distance, -child_depth)
                        if distance is not None else (1, child_depth, -child_depth))
            heappush(queue, (*estimate, index, command_index))

    enqueue(0)
    while queue:
        _, _, _, index, command_index = heappop(queue)
        state = nodes[index]
        command = model.commands[command_index]
        work = _work(state, model)
        if count + work > request.maximum_evaluations:
            # The rejected item plus every pending alternative are retained as
            # bounded descriptors. No completeness or uniqueness is asserted.
            pending = ((index, command_index),
                       *((entry[-2], entry[-1]) for entry in queue))
            cuts.append({'node': index, 'next_command_index': command_index,
                         'reason': 'evaluation_bound',
                         'unexpanded_node_command_pairs': pending})
            break
        count += work
        after, events, debt, phase_states, cost = _step(request, state, model, command)
        if debt:
            boundaries.append({'node': index, 'input': command,
                               'after_prefix': after, 'events': events,
                               'missing_refs': debt})
            continue
        if not phase_states:
            continue
        if after.level_scope_ref != state.level_scope_ref or after.restore_epoch != state.restore_epoch:
            boundaries.append({'node': index, 'input': command,
                               'after_prefix': after,
                               'reason': 'qualify_new_execution_scope'})
            continue
        child = seen.get(after)
        if child is None:
            if len(nodes) >= request.maximum_states:
                cuts.append({'node': index, 'next_command_index': command_index,
                             'reason': 'state_bound'})
                continue
            child = len(nodes)
            seen[after] = child
            nodes.append(after)
            parents.append((index, command.input_ref))
            depths.append(depths[index] + 1)
            enqueue(child)
        edges.append({'from_node': index, 'to_node': child, 'input': command,
                      'primitive_cost': cost, 'events': events,
                      'pre_graph_revision': state.graph_revision,
                      'post_graph_revision': after.graph_revision})
    return nodes, parents, edges, count, cuts, boundaries


def _domain(request,model):
    distances,count=_floor_approach_distances(request,model)
    if _staged_floor_domain_eligible(request,model,distances):
        return _staged_floor_domain(request,model,distances,count)
    nodes=[request.state];parents=[None];depths=[0];seen={request.state:0};edges=[];cuts=[];boundaries=[]
    def priority(index):
        state=nodes[index];distance=(distances.get(state.point) if state.layer_ref==request.state.layer_ref and state.phase=='FLOOR' else None)
        return (0,depths[index]+distance,depths[index],index) if distance is not None else (1,depths[index],depths[index],index)
    queue=[priority(0)] if distances is not None else deque([0])
    while queue:
        index=heappop(queue)[-1] if distances is not None else queue.popleft();state=nodes[index]
        if state.status!='ACTIVE':continue
        if depths[index]>=request.maximum_depth:cuts.append({'node':index,'reason':'depth_bound'});continue
        for i,command in enumerate(model.commands):
            work=_work(state,model)
            if count+work>request.maximum_evaluations:cuts.append({'node':index,'next_command_index':i,'reason':'evaluation_bound'});queue.clear();break
            count+=work;after,events,debt,phase_states,cost=_step(request,state,model,command)
            if debt:boundaries.append({'node':index,'input':command,'after_prefix':after,'events':events,'missing_refs':debt});continue
            if not phase_states:continue
            if after.level_scope_ref!=state.level_scope_ref or after.restore_epoch!=state.restore_epoch:boundaries.append({'node':index,'input':command,'after_prefix':after,'reason':'qualify_new_execution_scope'});continue
            child=seen.get(after)
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'node':index,'next_command_index':i,'reason':'state_bound'});continue
                child=len(nodes);seen[after]=child;nodes.append(after);parents.append((index,command.input_ref));depths.append(depths[index]+1)
                if distances is not None:heappush(queue,priority(child))
                else:queue.append(child)
            edges.append({'from_node':index,'to_node':child,'input':command,'primitive_cost':cost,'events':events,'pre_graph_revision':state.graph_revision,'post_graph_revision':after.graph_revision})
    return nodes,parents,edges,count,cuts,boundaries


def _endpoint_predecessor_word_d(parents,index,remaining):
    word=[];work=0
    while parents[index] is not None:
        parent,input_ref=parents[index]
        work+=1
        if work>remaining:return None,work
        word.append(input_ref);index=parent
    return tuple(reversed(word)),work


def _fit(request):
    compatible=[];refuted=[];unknown=[];count=0;cuts=[]
    for index,model in enumerate(request.models):
        supports=[];bad=[];missing=[]
        for o in request.observations:
            if not o.sealed or o.event_owner_ref!=request.scope.event_owner_ref or o.epoch!=request.scope.epoch or o.pre_graph_revision!=o.before.graph_revision:missing.append(o.observation_ref);continue
            command=next((c for c in model.commands if c.input_ref==o.input_ref),None)
            if command is None:missing.append((o.observation_ref,'bound_local_input'));continue
            work=_work(o.before,model)
            if count+work>request.maximum_evaluations:cuts.append({'phase':'transport_fit','next_model_index':index,'observation_ref':o.observation_ref});break
            count+=work;after,events,debt,_,cost=_step(request,o.before,model,command)
            if debt:missing.append((o.observation_ref,debt))
            elif after!=o.after:bad.append(o.observation_ref)
            else:supports.append({'observation_ref':o.observation_ref,'events':events,'cost':cost})
        if cuts:break
        if bad:refuted.append((model.model_ref,tuple(bad)))
        elif supports:compatible.append({'model':model,'supported_scope':supports,'unknown_observations':missing})
        else:unknown.append((model.model_ref,tuple(missing) or ('owned_current_transport_observation',)))
    return family_result(request,values={'compatible_transport_models':compatible,'refuted_models':refuted,'unknown_models':unknown,'jump_vector_calibrates_local_input':False},examined_count=count,
        domain_complete=not cuts and not unknown,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _components(request,model):
    components=[];ports=[];links=[];count=0;cuts=[];membership={}
    for layer in request.state.layers:
        if not layer.observed:continue
        floor={c.point for c in layer.cells if c.terrain=='FLOOR'}-{e.point for e in model.endpoints if e.layer_ref==layer.layer_ref};remaining=set(floor)
        while remaining:
            seed=min(remaining);queue=deque([seed]);remaining.remove(seed);group=[]
            while queue:
                if count+4>request.maximum_evaluations:cuts.append({'phase':'floor_components','layer_ref':layer.layer_ref,'pending_point':queue[0]});break
                p=queue.popleft();group.append(p);count+=4
                for d in CARDINALS:
                    q=_add(p,d)
                    if q in remaining:remaining.remove(q);queue.append(q)
            if cuts:break
            ref=layer.layer_ref+'.component.'+str(len(components));components.append({'component_ref':ref,'layer_ref':layer.layer_ref,'points':tuple(group)})
            for point in group:membership[(layer.layer_ref,point)]=ref
        if cuts:break
    for endpoint in model.endpoints:
        work=1+sum(len(l.cells) for l in request.state.layers)+len(model.footprint)
        if count+work>request.maximum_evaluations:cuts.append({'phase':'oriented_component_ports','next_endpoint_ref':endpoint.endpoint_ref});break
        count+=work
        face=None if endpoint.outward_face is None else _add(endpoint.point,endpoint.outward_face);component=membership.get((endpoint.layer_ref,face))
        ports.append({'endpoint_ref':endpoint.endpoint_ref,'source_face':face,'walking_component_ref':component,'orientation_unknown':endpoint.outward_face is None})
        landing,debt=_landing(request.state,model,endpoint.endpoint_ref)
        if landing:links.append({'source_endpoint_ref':endpoint.endpoint_ref,'destination_endpoint_ref':landing['destination'].endpoint_ref,'landing':landing['point'],'usable':landing['supported'],'pre_graph_revision':request.state.graph_revision})
        elif debt:links.append({'source_endpoint_ref':endpoint.endpoint_ref,'missing_refs':debt})
    values={'walking_components':components,'oriented_ports':ports,'parallel_directed_transport_links':links,'one_node_per_layer_is_sufficient':False}
    if isinstance(request,OrientedPassageRequest):
        from .conditional_room_frontiers import measure_conditional_room_frontiers
        room_frontiers,room_count,room_cuts=measure_conditional_room_frontiers(request,model,membership,ports,links,count)
        if room_frontiers['available']:
            count=room_count;cuts.extend(room_cuts);values['conditional_room_frontiers']=room_frontiers
    return family_result(request,values=values,examined_count=count,
        domain_complete=not cuts and all(l.observed for l in request.state.layers) and not any('missing_refs' in link for link in links),computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _layer_correspondence(request):
    old={l.layer_ref:l for l in request.prior_layers};new={l.layer_ref:l for l in request.state.layers};rows=[];count=0;cuts=[]
    for index,registration in enumerate(request.registrations):
        a=old.get(registration.old_layer_ref);b=new.get(registration.new_layer_ref)
        if a is None or b is None or not a.observed or not b.observed:rows.append({'registration_ref':registration.registration_ref,'status':'UNKNOWN_UNOBSERVED_LAYER'});continue
        if count+len(a.cells)+len(b.cells)>request.maximum_evaluations:cuts.append({'phase':'layer_correspondence','next_registration_index':index});break
        count+=len(a.cells)+len(b.cells);expected={_add(c.point,registration.offset):c.terrain for c in a.cells};actual={c.point:c.terrain for c in b.cells};shared=set(expected)&set(actual)
        changes=tuple((p,expected[p],actual[p]) for p in sorted(shared) if expected[p]!=actual[p])
        rows.append({'registration_ref':registration.registration_ref,'same_layer_identity_licensed':registration.supported_identity_evidence_ref is not None,'registration_offset':registration.offset,'terrain_changes':changes,
            'unseen_addresses':tuple(sorted(set(expected)^set(actual))),'zero_offset_proves_same_layer':False})
    return family_result(request,values={'layer_correspondences':rows,'canonical_map_merge_performed':False},examined_count=count,domain_complete=not cuts,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _rebind(request,model):
    rows=[];count=0;cuts=[]
    for index,memory in enumerate(request.episode_memories):
        if count+len(model.endpoints)**2>request.maximum_evaluations:cuts.append({'phase':'episode_pair_rebind','next_memory_index':index});break
        count+=len(model.endpoints)**2
        pairs=tuple((a.endpoint_ref,b.endpoint_ref) for a in model.endpoints for b in model.endpoints if a.signature_ref==memory.source_signature_ref and b.signature_ref==memory.destination_signature_ref)
        current=memory.episode_ref==request.state.episode_ref and memory.mode_ref==request.state.graph_mode_ref
        compatible=tuple(pair for pair in pairs if any(p.source_ref==pair[0] and p.destination_ref==pair[1] for p in request.state.pairs)) if current else ()
        faces={e.endpoint_ref:e.outward_face for e in model.endpoints};face_compatible=tuple(pair for pair in compatible if memory.outward_face is None or faces[pair[1]]==memory.outward_face)
        unknown_faces=tuple(pair for pair in compatible if faces[pair[1]] is None);contradicted_faces=tuple(pair for pair in compatible if memory.outward_face is not None and faces[pair[1]] is not None and faces[pair[1]]!=memory.outward_face)
        rows.append({'memory_ref':memory.memory_ref,'signature_rebindings':pairs,'current_mode_compatible_pairs':face_compatible,'unknown_orientation_pairs':unknown_faces,'contradicted_orientation_pairs':contradicted_faces,'episode_mode_current':current,'old_coordinates_copied':False,'visit_flags_acquired_by_recall':False})
    return family_result(request,values={'episode_relation_variants':rows},examined_count=count,domain_complete=not cuts,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _shortest(nodes,edges,remaining,ablated=None):
    count=0
    adjacency={}
    for edge in edges:
        if count>=remaining:return None,count,{'phase':'costed_model_edge_index'}
        count+=1
        if ablated is not None and any(e.get('transport',{}).get('source_ref')==ablated for e in edge['events']):continue
        adjacency.setdefault(edge['from_node'],[]).append(edge)
    distances={0:0};heap=[(0,0)]
    while heap:
        if count>=remaining:return None,count,{'phase':'bounded_model_shortest','pending_heap':tuple(heap)}
        count+=1
        cost,node=heappop(heap)
        if distances.get(node)!=cost:continue
        if nodes[node].status=='WIN':return cost,count,{}
        for edge in adjacency.get(node,()):
            if count>=remaining:return None,count,{'phase':'bounded_model_shortest_edges','node':node}
            count+=1
            child=edge['to_node'];new=cost+edge['primitive_cost']
            if new<distances.get(child,float('inf')):distances[child]=new;heappush(heap,(new,child))
    return None,count,{}


def _routes(request,model,inverse=False,bound=False):
    nodes,parents,edges,count,cuts,boundaries=_domain(request,model);complete=not cuts and not boundaries and model.graph_complete and request.scope.input_domain_complete
    words={};completions=[]

    def witness(index):
        nonlocal count
        if index in words:return words[index]
        if len(words)>=request.maximum_witnesses:return None
        word,work=_endpoint_predecessor_word_d(parents,index,request.maximum_evaluations-count)
        if word is None:
            cuts.append({'phase':'endpoint_witness_reconstruction','node':index});return None
        count+=work;words[index]=word;return word

    goals=tuple(i for i,s in enumerate(nodes) if s.status=='WIN' and _access(s,model)['access_and_acceptance_predicate'])
    for index in goals:
        word=witness(index)
        if word is not None:completions.append(word)
    qualified_boundaries=[]
    for boundary in boundaries:
        prefix=witness(boundary['node'])
        qualified_boundaries.append({**boundary,'known_prefix_word':prefix or (),
            'known_prefix_materialized':prefix is not None,'unknown_transaction_in_prefix':False,
            'destination_goal_retained':True,'route_after_probe_authorized':False})
    values={'joint_transport_states':nodes,'primitive_edges':edges,'conditional_completion_words':tuple(completions),'observation_boundaries':tuple(qualified_boundaries),
        'all_historical_pairs_simultaneously_available':False,'dominance_relation_applied':False,
        'completion_word_samples_exhaustive':len(completions)==len(goals),'rejected_executable_word_bank_retained':False}
    if inverse:
        incoming={}
        for edge in edges:incoming.setdefault(edge['to_node'],[]).append(edge['from_node'])
        useful=set(goals);queue=deque(goals)
        while queue:
            for parent in incoming.get(queue.popleft(),()):
                if count>=request.maximum_evaluations:cuts.append({'phase':'directed_preimage','pending_nodes':tuple(queue)});queue.clear();break
                count+=1
                if parent not in useful:useful.add(parent);queue.append(parent)
        values['directed_return_staging_nodes']=tuple(sorted(useful));values['authorized_need_ref']=request.authorized_need_ref;values['unvisited_pocket_is_semantic_priority']=False
        if request.need_endpoint_refs:
            prefixes=[]
            for i,s in enumerate(nodes):
                matched=tuple(r for r in request.need_endpoint_refs if r in s.acquired_visit_refs)
                if matched:
                    word=witness(i)
                    if word is not None:prefixes.append({'state':s,'word':word,'matched_need_endpoint_refs':matched})
            values['information_or_access_prefixes']=tuple(prefixes)
    if bound:
        optimum,work,cut=_shortest(nodes,edges,request.maximum_evaluations-count);count+=work
        if cut:cuts.append(cut)
        ablated=None
        if request.ablated_endpoint_ref is not None and not cut:
            ablated,work,cut=_shortest(nodes,edges,request.maximum_evaluations-count,request.ablated_endpoint_ref);count+=work
            if cut:cuts.append(cut)
        complete=complete and not cuts;assumptions=request.minimum_primitive_cost is not None and all(e['primitive_cost']>=request.minimum_primitive_cost for e in edges)
        values.update({'best_seen_goal_cost':optimum,'bounded_optimum_proved':complete,'declared_lower_bound_valid':complete and assumptions and optimum is not None and request.proposed_lower_bound is not None and request.proposed_lower_bound<=optimum,
            'ablated_model_best_cost':ablated,'ablated_link_necessary_in_complete_domain':complete and request.ablated_endpoint_ref is not None and optimum is not None and ablated is None,'ablation_is_game_action':False})
    values['global_executable_witness_count']=len(words)
    return family_result(request,values=values,examined_count=count,domain_complete=complete and not cuts,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _compare(request):
    from .articulated_dependency_measurement_c import _nodes
    from agents.yf_arc3_v5.logos.types import immutable_json_data
    a=request.expected_state;b=request.actual_state
    count=_nodes(immutable_json_data((a,b)),request.maximum_evaluations)
    if count is None:return family_result(request,domain_complete=False,computation_bound_reached=True,
        frontier={'phase':'full_endpoint_layer_graph_visit_resource_compare'})
    fields=tuple((n,getattr(a,n),getattr(b,n)) for n in type(a).model_fields if getattr(a,n)!=getattr(b,n))
    expected=request.expected_trace;actual=request.actual_trace;current=expected is not None and actual is not None and expected.sealed and actual.sealed and expected.event_owner_ref==actual.event_owner_ref==request.scope.event_owner_ref and expected.epoch==actual.epoch==request.scope.epoch and expected.input_ref==actual.input_ref and expected.evidence_revision_ref==actual.evidence_revision_ref==request.scope.evidence_revision_ref and expected.model_revision_ref==actual.model_revision_ref==request.scope.model_revision_ref
    first=None;cut={}
    if current:
        for i in range(max(len(expected.events),len(actual.events))):
            if count>=request.maximum_evaluations:cut={'phase':'sealed_passage_compare','next_event_index':i};break
            count+=1;x=expected.events[i] if i<len(expected.events) else None;y=actual.events[i] if i<len(actual.events) else None
            if x!=y:first=(i,x,y);break
    return family_result(request,values={'pose_layer_phase_graph_visit_resource_differences':fields,'first_owned_interval_mismatch':first,'effective_transport_retained':True,'automatic_reset_or_replay':False},prerequisite_refs=() if current else ('current_owned_sealed_endpoint_path',),examined_count=count,domain_complete=current and not cut,computation_bound_reached=bool(cut),frontier=cut)


def measure_endpoint_transport(request: EndpointTransportRequest | OrientedPassageRequest) -> MechanicalFamilyResult:
    operations=ENDPOINT_OPERATIONS if request.kernel_ref=='mechanics.rewritable_endpoint_transport' else PASSAGE_OPERATIONS
    if request.mode is None or operations.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    op=request.operation_ref.rsplit('.',1)[-1];required={'endpoint_correspondence':('raw_layer_pixels','layer_templates'),'passage_scene_measure':('raw_layer_pixels','layer_templates','grid_input'),'layer_resource_measure':('raw_layer_pixels','layer_templates'),
        'transport_law_fit':('models','observations'),'passage_control_fit':('models','observations'),'layer_correspondence':('state','prior_layers','registrations'),'oriented_landing':('state','models','bound_model_ref','source_endpoint_ref'),
        'graph_rewrite':('state','models','bound_model_ref','rewrite_ref'),'endpoint_step':('state','models','bound_model_ref','input_ref'),'successor':('state','models','bound_model_ref','input_ref'),
        'external_primitive':('state','models','bound_model_ref','input_ref','step_identity','parent_identity','clock_ref','temporal_scope_ref'),'visit_access_constraints':('state','models','bound_model_ref'),
        'transport_preimages':('state','models','bound_model_ref'),'rewritable_route_domain':('state','models','bound_model_ref'),'component_port_graph':('state','models','bound_model_ref'),
        'costed_passage_domain':('state','models','bound_model_ref'),'continuation_domain':('state','models','bound_model_ref','authorized_need_ref','need_endpoint_refs'),
        'cost_admissible_bound':('state','models','bound_model_ref','proposed_lower_bound','minimum_primitive_cost'),'episode_relation_rebind':('state','models','bound_model_ref','episode_memories'),
        'endpoint_compare':('expected_state','actual_state'),'sealed_passage_compare':('expected_state','actual_state'),'event_scoped_terrain_patch':('state','models','bound_model_ref','patch_ref','source_endpoint_ref','destination_endpoint_ref')}
    missing=missing_supplied_fields(request,required[op])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op in ('endpoint_correspondence','passage_scene_measure','layer_resource_measure'):
        result=translated_layers(request);values=dict(result.values);templates={t.template_ref:t for t in request.layer_templates};rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
        grids=enumerate_periodic_cell_grids(request.grid_input) if op=='passage_scene_measure' else None
        calibrations={c.template_ref:c for c in request.numeric_calibrations};intervals=tuple({'quantity':calibrations[r['template_ref']].quantity,'minimum':calibrations[r['template_ref']].minimum,'maximum':calibrations[r['template_ref']].maximum,
            'supported_evidence_ref':calibrations[r['template_ref']].supported_evidence_ref,'physical_measurement':r} for r in rows if r['template_ref'] in calibrations)
        return result.model_copy(update={'values':immutable_json_data({**values,'endpoint_layer_resource_candidates':tuple({'measurement':r,'component':templates[r['template_ref']].component,'endpoint_candidate_ref':templates[r['template_ref']].endpoint_candidate_ref,'layer_candidate_ref':templates[r['template_ref']].layer_candidate_ref} for r in rows),'measured_numeric_intervals':intervals,'numeric_calibration_missing':op=='layer_resource_measure' and not intervals,'physical_grid_candidates':grids,'decorative_extent_is_cell_pitch':False,'unchanged_gauge_proves_no_debit':False})})
    if op in ('transport_law_fit','passage_control_fit'):return _fit(request)
    if op=='layer_correspondence':return _layer_correspondence(request)
    if op in ('endpoint_compare','sealed_passage_compare'):return _compare(request)
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    if model is None:return family_result(request,prerequisite_refs=('bound_current_endpoint_model',),domain_complete=False)
    if op=='oriented_landing':
        landing,debt=_landing(request.state,model,request.source_endpoint_ref);return family_result(request,values={'directed_landing':landing,'reciprocity_implies_two_usable_links':False},prerequisite_refs=debt,domain_complete=not debt)
    if op=='visit_access_constraints':return family_result(request,values=_access(request.state,model))
    if op=='episode_relation_rebind':return _rebind(request,model)
    if op=='component_port_graph':return _components(request,model)
    if op in ('transport_preimages','rewritable_route_domain','costed_passage_domain','continuation_domain','cost_admissible_bound'):return _routes(request,model,op in ('transport_preimages','continuation_domain'),op=='cost_admissible_bound')
    if op=='graph_rewrite':
        rewrite=next((r for r in model.rewrites if r.rewrite_ref==request.rewrite_ref),None)
        if rewrite is None:return family_result(request,prerequisite_refs=('current_supported_switch',),domain_complete=False)
        after,debt=_rewrite(request.state,rewrite);return family_result(request,values={'after_state':after,'external_command_count':0,'acquired_visits_retained':after.acquired_visit_refs},prerequisite_refs=debt,domain_complete=not debt)
    if op=='event_scoped_terrain_patch':
        patch=next((p for p in model.patches if p.patch_ref==request.patch_ref),None)
        if patch is None:return family_result(request,prerequisite_refs=('current_event_scoped_patch',),domain_complete=False)
        after,debt=_patch(request,request.state,model,patch,request.source_endpoint_ref,request.destination_endpoint_ref)
        return family_result(request,values={'after_state':after,'patch':patch,'unrelated_unknown_terrain_cleared':False,'external_command_count':0},prerequisite_refs=debt,examined_count=len(patch.writes),domain_complete=not debt)
    command=next((c for c in model.commands if c.input_ref==request.input_ref),None)
    if command is None:return family_result(request,prerequisite_refs=('current_local_input_binding',),domain_complete=False)
    if _work(request.state,model)>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'endpoint_primitive'})
    if op=='external_primitive':
        identity_debt=primitive_identity_missing(request,'endpoint_model_ref')
        if identity_debt:return family_result(request,prerequisite_refs=identity_debt,domain_complete=False)
    after,events,debt,phase_states,cost=_step(request,request.state,model,command);packet=None
    if op=='external_primitive':packet,packet_debt=primitive_packet(request,model,command,after,events,phase_states,cost,debt,'endpoint_model_ref','endpoint_transport');debt=debt+packet_debt
    return family_result(request,values={'after_state':after,'ordered_endpoint_events':events,'primitive_packet':packet,'actual_primitive_cost':cost,'external_command_count':int(bool(phase_states)),
        'single_transfer_per_input':True,'cost_and_restoration_applied_once':True},prerequisite_refs=debt,examined_count=_work(request.state,model),domain_complete=not debt)
