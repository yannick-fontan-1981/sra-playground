"""Finite identity-owned flow under explicit quantity, passage and release laws.

Direct dosing fixes sinks before priming. Reservoir release fixes the sink set
but can reconsider receiving capacity after every unit. Neither law is guessed
from a vessel silhouette, geometric adjacency or a rounded fill display.
"""
from collections import deque
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, immutable_json_data
from .mechanical_common_contracts_c import MechanicalEventC, ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields


class FlowInterval(FrozenModel):
    lower: int = Field(ge=0,le=65536)
    upper: int = Field(ge=0,le=65536)
    @model_validator(mode="after")
    def order(self):
        if self.lower>self.upper:raise ValueError("quantity interval is ordered")
        return self


class FlowVessel(FrozenModel):
    vessel_ref: Ref
    role: Literal["RELAY","RESERVOIR","TERMINAL","DRAIN"]
    quantity: FlowInterval
    capacity: FlowInterval
    relay_threshold: int | None = Field(default=None,ge=0,le=65536)
    release_threshold: int | None = Field(default=None,ge=0,le=65536)
    terminal_demand: int | None = Field(default=None,ge=0,le=65536)
    envelope_ref: Ref | None = None


class FlowValve(FrozenModel):
    valve_ref: Ref
    opened: bool


class FlowPipe(FrozenModel):
    pipe_ref: Ref
    from_ref: Ref
    to_ref: Ref
    valve_ref: Ref | None
    serial_valve_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    direction_supported: bool


class FlowState(FrozenModel):
    level_ref: Ref
    source_ref: Ref
    source_reserve: FlowInterval
    vessels: tuple[FlowVessel,...] = Field(max_length=128)
    valves: tuple[FlowValve,...] = Field(max_length=128)
    pipes: tuple[FlowPipe,...] = Field(max_length=512)
    cumulative_loss: int = Field(ge=0)
    remaining_budget: int = Field(ge=0,le=65536)
    input_tick: int = Field(ge=0)
    restoration_epoch: int = Field(ge=0)
    execution_status: Literal["ACTIVE","WIN","LOCAL_STOP","GAME_OVER"]
    @model_validator(mode="after")
    def graph(self):
        vessels=tuple(v.vessel_ref for v in self.vessels);valves=tuple(v.valve_ref for v in self.valves)
        if len(set(vessels))!=len(vessels) or self.source_ref in vessels or len(set(valves))!=len(valves):
            raise ValueError("source, vessel and valve identities are distinct")
        nodes=set(vessels)|{self.source_ref}
        if len({p.pipe_ref for p in self.pipes})!=len(self.pipes):raise ValueError("pipe identities are unique")
        if any(p.from_ref not in nodes or p.to_ref not in nodes
               or any(ref not in valves for ref in p.serial_valve_refs)
               or p.valve_ref is not None and p.valve_ref not in valves for p in self.pipes):
            raise ValueError("pipe endpoints and controls refer to the supplied graph")
        return self


class RecipientOrder(FrozenModel):
    model_ref: Ref
    vessel_refs: tuple[Ref,...] = Field(max_length=128)
    @model_validator(mode="after")
    def distinct(self):
        if len(set(self.vessel_refs))!=len(self.vessel_refs):raise ValueError("recipient order keeps unique vessel identities")
        return self


class FlowLaw(FrozenModel):
    law_ref: Ref
    dose_per_sink: int = Field(ge=0,le=65536)
    release_lot: int = Field(ge=0,le=65536)
    reservoir_distribution: Literal["CYCLIC_SKIP_FULL","FIRST_CAPABLE","CYCLIC_WITH_LOSS"]
    reservoir_passes_when_ready: bool
    reverse_orientation: Literal["DOWNSTREAM","REVERSE_PIPES"]
    reverse_ignores_passage_thresholds: bool
    recovery_per_vessel: int = Field(ge=0,le=65536)


class QuantityAccount(FrozenModel):
    model_ref: Ref
    vessel_ref: Ref
    capacity: int = Field(ge=1,le=65536)
    initial_quantity: int = Field(ge=0,le=65536)
    height_rounding: Literal["FLOOR","CEIL","NEAREST"]
    quantities: tuple[int,...] = Field(min_length=1,max_length=256)
    @model_validator(mode="after")
    def initial_stock(self):
        if self.initial_quantity>self.capacity:raise ValueError("initial quantity fits the declared capacity")
        return self


class QuantityObservation(FrozenModel):
    evidence_ref: Ref
    vessel_ref: Ref
    rounded_height: FlowInterval
    display_height: int = Field(ge=1,le=4096)
    incoming_since_previous: int = Field(ge=0,le=65536)
    outgoing_since_previous: int = Field(ge=0,le=65536)
    overflow_since_previous: int = Field(ge=0,le=65536)


class FlowCommand(FrozenModel):
    action_ref: Ref
    kind: Literal["DOSE","REVERSE","VALVE","WAIT"]
    cost: int = Field(ge=0,le=65536)
    valve_ref: Ref | None = None
    valve_opened: bool | None = None
    @model_validator(mode="after")
    def control(self):
        if self.kind=="VALVE" and (self.valve_ref is None or self.valve_opened is None):
            raise ValueError("a valve command has a bound control and target state")
        if self.kind!="VALVE" and (self.valve_ref is not None or self.valve_opened is not None):
            raise ValueError("non-valve commands do not carry a valve effect")
        return self


class FlowReleasePass(FrozenModel):
    pass_ref: Ref
    triggered_by: tuple[Literal["DOSE","REVERSE","VALVE","WAIT"],...] = Field(min_length=1,max_length=4)
    reservoir_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    repetitions: int = Field(ge=1,le=16)
    stop_when_unchanged: bool


class FlowTransitionLaw(FrozenModel):
    law_ref: Ref
    phase_order: tuple[Literal["INPUT","RELEASES","LOSS_CHECK","TERMINAL_CHECK","BUDGET_CHECK","TICK"],...]
    release_passes: tuple[FlowReleasePass,...] = Field(max_length=32)
    loss_condition: Literal["IGNORE","NEW_LOSS","CUMULATIVE_LIMIT"]
    cumulative_loss_limit: int = Field(ge=0)
    loss_outcome: Literal["LOCAL_STOP","GAME_OVER","RESTORE"]
    exhaustion_outcome: Literal["LOCAL_STOP","GAME_OVER"]
    terminal_quantity_rule: Literal["EXACT","AT_LEAST"]
    terminal_outcome: Literal["WIN","LOCAL_STOP","ENTER_NEXT"]
    @model_validator(mode="after")
    def ordered_transaction(self):
        phases=("INPUT","RELEASES","LOSS_CHECK","TERMINAL_CHECK","BUDGET_CHECK","TICK")
        if len(self.phase_order)!=len(phases) or set(self.phase_order)!=set(phases) or self.phase_order[0]!="INPUT":
            raise ValueError("one external input precedes each declared transition phase exactly once")
        if len({p.pass_ref for p in self.release_passes})!=len(self.release_passes):raise ValueError("release pass identities are unique")
        return self


class FlowWorldModel(FrozenModel):
    model_ref: Ref
    state: FlowState
    flow_law: FlowLaw
    transition_law: FlowTransitionLaw
    recipient_order: RecipientOrder
    restoration_state: FlowState | None = None
    next_entry_state: FlowState | None = None


class FlowComparisonModel(FrozenModel):
    model_ref: Ref
    predicted_word: tuple[Ref,...] = Field(max_length=256)
    observed_word: tuple[Ref,...] = Field(max_length=256)
    predicted_packets: tuple[ExternalPrimitivePacketC,...] = Field(max_length=256)
    observed_packets: tuple[ExternalPrimitivePacketC,...] = Field(max_length=256)


class FlowTracePixel(FrozenModel):
    x: int = Field(ge=-4096,le=4096)
    y: int = Field(ge=-4096,le=4096)
    color_ref: Ref


class FlowPort(FrozenModel):
    port_ref: Ref
    node_ref: Ref
    position: tuple[int,int]
    direction: Literal["INLET","OUTLET","BOTH"]


class FlowTraceDirection(FrozenModel):
    position: tuple[int,int]
    allowed_offsets: tuple[tuple[int,int],...] = Field(max_length=8)


class FlowValveGate(FrozenModel):
    valve_ref: Ref
    pixel_positions: tuple[tuple[int,int],...] = Field(min_length=1,max_length=256)


class FlowTraceModel(FrozenModel):
    model_ref: Ref
    conductive_color_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)
    ports: tuple[FlowPort,...] = Field(max_length=256)
    valve_gates: tuple[FlowValveGate,...] = Field(max_length=128)
    adjacency_offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=8)
    directions: tuple[FlowTraceDirection,...] = Field(max_length=4096)
    excluded_fill_positions: tuple[tuple[int,int],...] = Field(max_length=65536)
    directed_port_evidence_complete: bool
    @model_validator(mode="after")
    def local_topology(self):
        if len(set(self.adjacency_offsets))!=len(self.adjacency_offsets) or any((x,y)==(0,0) or abs(x)>1 or abs(y)>1 for x,y in self.adjacency_offsets):
            raise ValueError("raw conduit tracing declares unique adjacent-pixel offsets")
        if len({p.port_ref for p in self.ports})!=len(self.ports):raise ValueError("trace port identities are unique")
        if len({d.position for d in self.directions})!=len(self.directions):raise ValueError("one local direction constraint per pixel")
        if any(not set(d.allowed_offsets)<=set(self.adjacency_offsets) for d in self.directions):raise ValueError("direction constraints use the declared pixel topology")
        return self


class FlowRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.flow_request.v1"
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=64)
    maximum_witnesses: int = Field(ge=1,le=3)
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)
    state: FlowState | None = None
    law: FlowLaw | None = None
    start_ref: Ref | None = None
    reservoir_ref: Ref | None = None
    recipient_orders: tuple[RecipientOrder,...] = Field(default=(),max_length=64)
    quantity_accounts: tuple[QuantityAccount,...] = Field(default=(),max_length=256)
    quantity_observations: tuple[QuantityObservation,...] = Field(default=(),max_length=256)
    fixed_sink_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    held_stock: FlowInterval | None = None
    reuse_count: int | None = Field(default=None,ge=1,le=65536)
    service_kind: Literal["RESERVOIR_RELEASE","DIRECT_DOSE"] | None = None
    command: FlowCommand | None = None
    transition_law: FlowTransitionLaw | None = None
    restoration_state: FlowState | None = None
    next_entry_state: FlowState | None = None
    step_identity: MechanicalRequestIdentity | None = None
    parent_identity: MechanicalRequestIdentity | None = None
    active_model_ref: Ref | None = None
    clock_ref: Ref | None = None
    temporal_scope_ref: Ref | None = None
    world_models: tuple[FlowWorldModel,...] = Field(default=(),max_length=64)
    commands: tuple[FlowCommand,...] = Field(default=(),max_length=64)
    comparison_models: tuple[FlowComparisonModel,...] = Field(default=(),max_length=64)
    trace_pixels: tuple[FlowTracePixel,...] = Field(default=(),max_length=65536)
    tracing_models: tuple[FlowTraceModel,...] = Field(default=(),max_length=64)
    consumer_ref: Ref | None = None
    required_consumer_quantity: FlowInterval | None = None
    funded_relay_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    preserved_terminal_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    maximum_new_loss: int | None = Field(default=None,ge=0,le=65536)
    maximum_domain_evaluations: int = Field(default=16384,ge=1,le=65536)
    initial_total_material: FlowInterval | None = None
    account_incoming_total: int = Field(default=0,ge=0,le=65536)
    account_outgoing_total: int = Field(default=0,ge=0,le=65536)
    @model_validator(mode="after")
    def unique_domains(self):
        if len(set(self.fixed_sink_refs))!=len(self.fixed_sink_refs):raise ValueError("a receiver capacity is counted once per identity")
        for models in (self.recipient_orders,self.quantity_accounts,self.world_models,self.comparison_models,self.tracing_models):
            refs=tuple(x.model_ref for x in models)
            if len(set(refs))!=len(refs):raise ValueError("model alternatives keep unique identities")
        if len({(p.x,p.y) for p in self.trace_pixels})!=len(self.trace_pixels):raise ValueError("one observed color per retained pixel")
        return self


OPERATION_MODES={"flow_graph_measurement":"MEASURE","quantity_calibration":"FIT",
    "relay_reachability":"PRECONDITION","source_dose":"STEP_INTERNAL",
    "reservoir_release":"STEP_INTERNAL","reverse_recovery":"STEP_INTERNAL",
    "flow_action":"STEP","material_service_certificate":"PROPAGATE",
    "allocation_preimages":"INVERSE_DOMAIN","flow_compare":"COMPARE",
    "flow_composition_domain":"DOMAIN"}


def _exact(interval):
    return interval.lower if interval.lower==interval.upper else None


def _exact_state(state):
    missing=[]
    if _exact(state.source_reserve) is None:missing.append("source_reserve_interval")
    for vessel in state.vessels:
        if _exact(vessel.quantity) is None or _exact(vessel.capacity) is None:missing.append(vessel.vessel_ref)
        if vessel.quantity.upper>vessel.capacity.upper:missing.append("quantity_within_capacity")
    return tuple(missing)


class FlowTraversal(FrozenModel):
    sink_refs: tuple[Ref,...]
    conditions: tuple[tuple[Ref,Ref,int],...]
    prerequisite_refs: tuple[Ref,...]
    examined_count: int
    frontier: FrozenMap


def _walk(state,law,start,*,reverse=False,maximum_evaluations=65536):
    by_ref={v.vessel_ref:v for v in state.vessels};valves={v.valve_ref:v.opened for v in state.valves}
    adjacency={};missing=[];count=0
    def result(sinks=(),conditions=(),frontier=None):
        return FlowTraversal(sink_refs=tuple(sinks),conditions=tuple(conditions),prerequisite_refs=tuple(missing),
            examined_count=count,frontier=immutable_json_data(frontier or {}))
    for pipe_index,pipe in enumerate(state.pipes):
        if count>=maximum_evaluations:
            return result(frontier={"phase":"pipes","next_pipe_index":pipe_index,"retained_adjacency":adjacency})
        count+=1
        if not pipe.direction_supported:missing.append(pipe.pipe_ref);continue
        a,b=(pipe.to_ref,pipe.from_ref) if reverse and law.reverse_orientation=="REVERSE_PIPES" else (pipe.from_ref,pipe.to_ref)
        controls=tuple(dict.fromkeys(((pipe.valve_ref,) if pipe.valve_ref is not None else ())+pipe.serial_valve_refs))
        adjacency.setdefault(a,[]).append((b,controls))
    if start!=state.source_ref and start not in by_ref:
        missing.append("current_start_node");return result()
    queue=deque(adjacency.get(start,()));visited={start};sinks=[];conditions=[]
    while queue:
        if count>=maximum_evaluations:
            return result(sinks,conditions,{"phase":"nodes","pending_nodes":tuple(queue),"visited_node_refs":tuple(sorted(visited)),"retained_adjacency":adjacency})
        count+=1
        ref,controls=queue.popleft()
        closed=tuple(control for control in controls if not valves[control])
        if closed:
            for valve_ref in closed:
                condition=(valve_ref,"open_valve",1)
                if condition not in conditions:conditions.append(condition)
            continue
        if ref in visited:continue
        visited.add(ref);vessel=by_ref.get(ref)
        if vessel is None:continue
        if reverse and law.reverse_ignores_passage_thresholds:
            sinks.append(ref);queue.extend(adjacency.get(ref,()));continue
        if reverse:sinks.append(ref)
        threshold=vessel.relay_threshold if vessel.role=="RELAY" else vessel.release_threshold
        passing=vessel.role=="RELAY" or vessel.role=="RESERVOIR" and law.reservoir_passes_when_ready
        if passing:
            if threshold is None:missing.append(ref);continue
            if vessel.quantity.lower>=threshold:queue.extend(adjacency.get(ref,()));continue
            if vessel.quantity.upper>=threshold:missing.append(ref);continue
            conditions.append((ref,"prime_threshold",threshold-vessel.quantity.upper))
        if not reverse:sinks.append(ref)
    return result(sinks,conditions)


def _order_sinks(order,sinks):
    if not set(sinks)<=set(order.vessel_refs):return None
    return tuple(ref for ref in order.vessel_refs if ref in sinks)


def _quantity_fit(request):
    compatible=[];refutations=[];count=0
    for account_index,account in enumerate(request.quantity_accounts):
        observations=tuple(o for o in request.quantity_observations if o.vessel_ref==account.vessel_ref)
        if len(observations)!=len(account.quantities):
            refutations.append((account.model_ref,"complete_observation_history_length"));continue
        mismatch=None
        for index,(quantity,observation) in enumerate(zip(account.quantities,observations)):
            if count>=request.maximum_evaluations:
                return family_result(request,values={"compatible_quantity_accounts":tuple(compatible),
                    "refutations":tuple(refutations)},examined_count=count,domain_complete=False,
                    computation_bound_reached=True,frontier={"account_index":account_index,"observation_index":index})
            count+=1
            if quantity<0 or quantity>account.capacity:mismatch=(account.model_ref,observation.evidence_ref,"quantity_capacity");break
            numerator=quantity*observation.display_height
            height=(numerator//account.capacity if account.height_rounding=="FLOOR" else
                    (numerator+account.capacity-1)//account.capacity if account.height_rounding=="CEIL" else
                    (2*numerator+account.capacity)//(2*account.capacity))
            if not observation.rounded_height.lower<=height<=observation.rounded_height.upper:
                mismatch=(account.model_ref,observation.evidence_ref,"rounded_height");break
            previous=account.quantities[index-1] if index else account.initial_quantity
            if quantity!=previous+observation.incoming_since_previous-observation.outgoing_since_previous-observation.overflow_since_previous:
                mismatch=(account.model_ref,observation.evidence_ref,"conservation");break
        if mismatch:refutations.append(mismatch)
        else:compatible.append(account)
    domains=[]
    for vessel_ref in sorted({a.vessel_ref for a in compatible}):
        accounts=tuple(a for a in compatible if a.vessel_ref==vessel_ref)
        domains.append((vessel_ref,FlowInterval(lower=min(a.capacity for a in accounts),upper=max(a.capacity for a in accounts)),
                        tuple(FlowInterval(lower=min(a.quantities[i] for a in accounts),upper=max(a.quantities[i] for a in accounts))
                              for i in range(len(accounts[0].quantities)))))
    return family_result(request,values={"compatible_quantity_accounts":tuple(compatible),
        "compatible_capacity_quantity_intervals":tuple(domains),
        "refutations":tuple(refutations),"unchanged_height_proves_no_transfer":False},examined_count=count)


def _dose(request):
    state=request.state;law=request.law;missing=_exact_state(state)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if not request.recipient_orders:return family_result(request,prerequisite_refs=("current_recipient_order_alternatives",),domain_complete=False)
    traversal=_walk(state,law,state.source_ref,maximum_evaluations=request.maximum_evaluations)
    if traversal.prerequisite_refs or traversal.frontier:
        return family_result(request,prerequisite_refs=traversal.prerequisite_refs,examined_count=traversal.examined_count,
            domain_complete=False,computation_bound_reached=bool(traversal.frontier),frontier=traversal.frontier)
    sinks=traversal.sink_refs;conditions=traversal.conditions;outcomes=[];count=traversal.examined_count
    for order_index,order in enumerate(request.recipient_orders):
        recipients=_order_sinks(order,sinks)
        if recipients is None:return family_result(request,prerequisite_refs=("recipient_order_covers_fixed_sink_set",),domain_complete=False)
        amounts={v.vessel_ref:_exact(v.quantity) for v in state.vessels};by_ref={v.vessel_ref:v for v in state.vessels}
        reserve=_exact(state.source_reserve);loss=0;changes=[]
        # The sink set above is fixed; a newly primed relay receives this dose.
        for recipient_index,ref in enumerate(recipients):
            if count>=request.maximum_evaluations:
                return family_result(request,values={"dose_outcomes":tuple(outcomes),"fixed_sink_refs":sinks},
                    examined_count=count,domain_complete=False,computation_bound_reached=True,
                    frontier={"order_index":order_index,"recipient_index":recipient_index,
                              "amounts":amounts,"reserve":reserve,"loss":loss,"changes":tuple(changes)})
            count+=1
            offered=min(law.dose_per_sink,reserve);reserve-=offered;vessel=by_ref[ref]
            retained=0 if vessel.role=="DRAIN" else min(offered,_exact(vessel.capacity)-amounts[ref])
            amounts[ref]+=retained;loss+=offered-retained;changes.append((ref,offered,retained,offered-retained))
        bodies=tuple(v.model_copy(update={"quantity":FlowInterval(lower=amounts[v.vessel_ref],upper=amounts[v.vessel_ref])}) for v in state.vessels)
        after=state.model_copy(update={"vessels":bodies,"source_reserve":FlowInterval(lower=reserve,upper=reserve),"cumulative_loss":state.cumulative_loss+loss})
        outcomes.append({"order_model_ref":order.model_ref,"after_state":after,"quantity_changes":tuple(changes),"loss":loss})
    return family_result(request,values={"fixed_sink_refs":sinks,"missing_prime_conditions":conditions,
        "dose_outcomes":tuple(outcomes),"same_unit_forwarded_after_priming":False},examined_count=count)


def _release(request):
    state=request.state;law=request.law;missing=_exact_state(state)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if not request.recipient_orders:return family_result(request,prerequisite_refs=("current_recipient_order_alternatives",),domain_complete=False)
    reservoir=next((v for v in state.vessels if v.vessel_ref==request.reservoir_ref),None)
    if reservoir is None or reservoir.role!="RESERVOIR" or reservoir.release_threshold is None:
        return family_result(request,prerequisite_refs=("current_reservoir_release_threshold",),domain_complete=False)
    quantity=_exact(reservoir.quantity)
    if quantity<reservoir.release_threshold:
        return family_result(request,values={"release_outcomes":(),"reservoir_ready":False,"missing_charge":reservoir.release_threshold-quantity})
    traversal=_walk(state,law,reservoir.vessel_ref,maximum_evaluations=request.maximum_evaluations)
    if traversal.prerequisite_refs or traversal.frontier:
        return family_result(request,prerequisite_refs=traversal.prerequisite_refs,examined_count=traversal.examined_count,
            domain_complete=False,computation_bound_reached=bool(traversal.frontier),frontier=traversal.frontier)
    sinks=traversal.sink_refs;conditions=traversal.conditions
    if not sinks:return family_result(request,values={"release_outcomes":(),"reservoir_ready":True,"fixed_sink_refs":()},examined_count=traversal.examined_count)
    if quantity<law.release_lot:
        return family_result(request,prerequisite_refs=("stock_for_whole_declared_release_lot",),domain_complete=False)
    lot=law.release_lot;outcomes=[];count=traversal.examined_count
    for order_index,order in enumerate(request.recipient_orders):
        recipients=_order_sinks(order,sinks)
        if recipients is None:return family_result(request,prerequisite_refs=("recipient_order_covers_fixed_sink_set",),domain_complete=False)
        amounts={v.vessel_ref:_exact(v.quantity) for v in state.vessels};by_ref={v.vessel_ref:v for v in state.vessels}
        amounts[reservoir.vessel_ref]-=lot;loss=0;cursor=0;changes=[]
        for unit in range(lot):
            if count>=request.maximum_evaluations:
                return family_result(request,values={"release_outcomes":tuple(outcomes)},examined_count=count,
                    domain_complete=False,computation_bound_reached=True,
                    frontier={"order_index":order_index,"next_unit":unit,"amounts":amounts,"loss":loss,"cursor":cursor})
            count+=1
            capable=tuple(ref for ref in recipients if by_ref[ref].role=="DRAIN" or amounts[ref]<_exact(by_ref[ref].capacity))
            if law.reservoir_distribution=="FIRST_CAPABLE":ref=capable[0] if capable else None
            elif law.reservoir_distribution=="CYCLIC_WITH_LOSS":ref=recipients[cursor%len(recipients)];cursor+=1
            else:
                ref=None
                for offset in range(len(recipients)):
                    candidate=recipients[(cursor+offset)%len(recipients)]
                    if candidate in capable:ref=candidate;cursor=(cursor+offset+1)%len(recipients);break
            if ref is None or by_ref[ref].role=="DRAIN" or amounts[ref]>=_exact(by_ref[ref].capacity):loss+=1;changes.append((ref,0,1))
            else:amounts[ref]+=1;changes.append((ref,1,0))
        bodies=tuple(v.model_copy(update={"quantity":FlowInterval(lower=amounts[v.vessel_ref],upper=amounts[v.vessel_ref])}) for v in state.vessels)
        outcomes.append({"order_model_ref":order.model_ref,"after_state":state.model_copy(update={"vessels":bodies,"cumulative_loss":state.cumulative_loss+loss}),
            "per_unit_changes":tuple(changes),"loss":loss})
    return family_result(request,values={"release_outcomes":tuple(outcomes),"fixed_sink_refs":sinks,
        "missing_prime_conditions":conditions,"release_lot":lot},examined_count=count)


def _recovery(request):
    state=request.state;law=request.law;missing=_exact_state(state)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    traversal=_walk(state,law,state.source_ref,reverse=True,maximum_evaluations=request.maximum_evaluations)
    if traversal.prerequisite_refs or traversal.frontier:
        return family_result(request,prerequisite_refs=traversal.prerequisite_refs,examined_count=traversal.examined_count,
            domain_complete=False,computation_bound_reached=bool(traversal.frontier),frontier=traversal.frontier)
    targets=traversal.sink_refs;recovered=0;changes=[];bodies=[];count=traversal.examined_count
    for vessel_index,vessel in enumerate(state.vessels):
        if count>=request.maximum_evaluations:
            return family_result(request,values={"per_vessel_recovery":tuple(changes)},examined_count=count,
                domain_complete=False,computation_bound_reached=True,
                frontier={"vessel_index":vessel_index,"recovered_stock":recovered,"updated_vessels":tuple(bodies)})
        count+=1
        amount=min(_exact(vessel.quantity),law.recovery_per_vessel) if vessel.vessel_ref in targets else 0
        quantity=_exact(vessel.quantity)-amount;recovered+=amount;changes.append((vessel.vessel_ref,amount))
        bodies.append(vessel.model_copy(update={"quantity":FlowInterval(lower=quantity,upper=quantity)}))
    reserve=_exact(state.source_reserve)+recovered
    if reserve>65536:return family_result(request,prerequisite_refs=("source_stock_within_declared_quantity_domain",),domain_complete=False)
    after_by_ref={v.vessel_ref:v for v in bodies}
    de_primed=tuple(v.vessel_ref for v in state.vessels if v.role=="RELAY" and v.relay_threshold is not None
        and _exact(v.quantity)>=v.relay_threshold>_exact(after_by_ref[v.vessel_ref].quantity))
    undone=tuple((v.vessel_ref,_exact(v.quantity),_exact(after_by_ref[v.vessel_ref].quantity))
        for v in state.vessels if v.role=="TERMINAL" and _exact(after_by_ref[v.vessel_ref].quantity)<_exact(v.quantity))
    return family_result(request,values={"after_state":state.model_copy(update={"vessels":tuple(bodies),"source_reserve":FlowInterval(lower=reserve,upper=reserve)}),
        "recovered_stock":recovered,"per_vessel_recovery":tuple(changes),"reverse_access_refs":targets,
        "de_primed_relay_refs":de_primed,"undone_terminal_quantities":undone,
        "dose_inverse_claimed":False,"passage_thresholds_ignored":law.reverse_ignores_passage_thresholds},examined_count=count)


def _ledger_fields(state):
    fields={"level_ref":state.level_ref,"source_ref":state.source_ref,
        "source_reserve":state.source_reserve,"cumulative_loss":state.cumulative_loss,
        "remaining_budget":state.remaining_budget,"input_tick":state.input_tick,
        "restoration_epoch":state.restoration_epoch,"execution_status":state.execution_status,
        "pipes":state.pipes,"vessel_refs":tuple(v.vessel_ref for v in state.vessels),
        "valve_refs":tuple(v.valve_ref for v in state.valves)}
    for vessel in state.vessels:
        for name in ("role","quantity","capacity","relay_threshold","release_threshold","terminal_demand","envelope_ref"):
            fields["vessel."+vessel.vessel_ref+"."+name]=getattr(vessel,name)
    for valve in state.valves:fields["valve."+valve.valve_ref+".opened"]=valve.opened
    return immutable_json_data(fields)


def _phase_reads(fields,phase,command):
    if phase in ("RELEASES",) or phase=="INPUT" and command.kind in ("DOSE","REVERSE"):
        keys=tuple(sorted(fields))
    elif phase=="INPUT":keys=("remaining_budget",)+(("valve."+command.valve_ref+".opened",) if command.kind=="VALVE" else ())
    elif phase=="LOSS_CHECK":keys=("cumulative_loss","restoration_epoch")
    elif phase=="TERMINAL_CHECK":keys=tuple(key for key in sorted(fields) if key.endswith((".quantity",".terminal_demand",".role")))
    elif phase=="BUDGET_CHECK":keys=("remaining_budget",)
    else:keys=("input_tick",)
    return FrozenMap({key:fields[key] for key in sorted(keys) if key in fields})


def _phase_event(request,before,after,events,snapshots,phase,detail,*,cost=0):
    before_fields=snapshots[-1];fresh=_ledger_fields(after)
    writes={key:fresh[key] for key in sorted(fresh) if key not in before_fields or fresh[key]!=before_fields[key]}
    deleted=tuple(key for key in sorted(before_fields) if key not in fresh)
    retained=FrozenMap({key:before_fields[key] for key in sorted(before_fields) if key not in deleted}) if deleted else before_fields
    changed=FrozenMap.overlay(writes,retained)
    occurrence=request.scope.request_ref+".flow."+str(len(events))
    snapshot_ref=occurrence+".before"
    event=MechanicalEventC(occurrence_ref=occurrence,producer_ref=request.scope.event_owner_ref,
        kind_ref="flow."+phase.lower(),clock_ref=request.clock_ref,tick=before.input_tick,
        temporal_scope_ref=request.temporal_scope_ref,snapshot_ref=snapshot_ref,
        snapshot_kind="PRE_COMMAND" if phase=="INPUT" else "PRE_DOSE" if phase=="RELEASES" else "SIMULTANEOUS",
        reads=_phase_reads(before_fields,phase,request.command),writes=immutable_json_data(writes),
        deleted_state_refs=deleted,costs=FrozenMap({"primitive_cost":cost}) if cost else FrozenMap(),
        predecessor_refs=(events[-1].occurrence_ref,) if events else (),
        predicate_values=immutable_json_data(detail),
        interruption_ref="flow.execution_scope_ended" if after.execution_status!="ACTIVE" or after.level_ref!=request.state.level_ref or after.restoration_epoch!=request.state.restoration_epoch else None)
    return events+(event,),snapshots+(changed,)


def _step_identity_missing(request):
    identity=request.step_identity;scope=request.scope
    if identity.mode!="STEP" or identity.operation_ref!="flow_action" or identity.kernel_ref!="mechanics.finite_flow_network":
        return ("exact_flow_step_identity",)
    if (identity.request_ref!=scope.request_ref or identity.caller_ref!=scope.caller_ref
        or identity.epoch!=scope.epoch or identity.input_revision_ref!=scope.evidence_revision_ref
        or identity.parent_contribution_ref!=scope.parent_contribution_ref):return ("current_caller_scope_step_identity",)
    if identity.model_assignments.get("flow_model_ref")!=request.active_model_ref:return ("bound_flow_model_assignment",)
    if identity.immutable_inputs.get("state")!=_ledger_fields(request.state) or identity.immutable_inputs.get("command")!=immutable_json_data(request.command):
        return ("current_state_and_command_step_inputs",)
    if not packet_context_equal(request.parent_identity,identity,request.active_model_ref):return ("flow_parent_child_model_context",)
    if identity.actual_bounds.get("max_primitives",0)<1 or identity.actual_bounds.get("max_events",0)<1:
        return ("external_primitive_and_event_bounds",)
    return ()


def _flow_action(request):
    state=request.state;command=request.command;law=request.transition_law
    missing=_exact_state(state)+_step_identity_missing(request)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if state.execution_status!="ACTIVE":return family_result(request,values={"primitive_applied":False,"stopped_status":state.execution_status})
    if command.cost>state.remaining_budget:return family_result(request,values={"primitive_applied":False,"unaffordable_cost":command.cost})
    if law.loss_condition!="IGNORE" and law.loss_outcome=="RESTORE":
        if request.restoration_state is None or request.restoration_state.level_ref!=state.level_ref or request.restoration_state.restoration_epoch<=state.restoration_epoch:
            return family_result(request,prerequisite_refs=("new_epoch_qualified_flow_restoration",),domain_complete=False)
    if law.terminal_outcome=="ENTER_NEXT" and (request.next_entry_state is None or request.next_entry_state.level_ref==state.level_ref or request.next_entry_state.execution_status!="ACTIVE"):
        return family_result(request,prerequisite_refs=("qualified_next_flow_entry",),domain_complete=False)
    if command.kind=="VALVE" and command.valve_ref not in {v.valve_ref for v in state.valves}:
        return family_result(request,prerequisite_refs=("current_bound_valve_identity",),domain_complete=False)
    if not request.recipient_orders:return family_result(request,prerequisite_refs=("whole_transition_recipient_order_alternatives",),domain_complete=False)
    branches=[];pending=[];count=0;missing=[]
    event_limit=min(4096,request.step_identity.actual_bounds["max_events"])
    # One order assignment is retained through the input and every release.
    for order_index,order in enumerate(request.recipient_orders):
        current=state;events=();snapshots=(_ledger_fields(state),);interrupted=False
        for phase_index,phase in enumerate(law.phase_order):
            if current.execution_status!="ACTIVE" or current.level_ref!=state.level_ref or current.restoration_epoch!=state.restoration_epoch:
                interrupted=True;break
            if count>=request.maximum_evaluations or len(events)>=event_limit:
                pending.append((order_index,phase_index,current,events,snapshots));break
            count+=1;before=current;detail={"phase":phase,"order_model_ref":order.model_ref,"transition_law_ref":law.law_ref}
            if phase=="INPUT":
                if command.kind in ("DOSE","REVERSE"):
                    internal=request.model_copy(update={"state":current,"recipient_orders":(order,),"maximum_evaluations":request.maximum_evaluations-count})
                    if internal.maximum_evaluations<=0:
                        pending.append((order_index,phase_index,current,events,snapshots));break
                    result=_dose(internal) if command.kind=="DOSE" else _recovery(internal)
                    count+=result.examined_count
                    if result.prerequisite_refs or result.computation_bound_reached:
                        missing.extend(result.prerequisite_refs);pending.append((order_index,phase_index,current,events,snapshots,result));break
                    outcomes=result.values.get("dose_outcomes",())
                    current=FlowState.model_validate(outcomes[0]["after_state"] if command.kind=="DOSE" else result.values["after_state"])
                    detail["internal_result"]=result.values
                elif command.kind=="VALVE":
                    current=current.model_copy(update={"valves":tuple(v.model_copy(update={"opened":command.valve_opened}) if v.valve_ref==command.valve_ref else v for v in current.valves)})
                current=current.model_copy(update={"remaining_budget":current.remaining_budget-command.cost})
            elif phase=="RELEASES":
                stopped=False
                for pass_index,release_pass in enumerate(law.release_passes):
                    if command.kind not in release_pass.triggered_by:continue
                    for repetition in range(release_pass.repetitions):
                        pass_before=current
                        for reservoir_index,reservoir_ref in enumerate(release_pass.reservoir_refs):
                            if count>=request.maximum_evaluations or len(events)>=event_limit:
                                pending.append((order_index,phase_index,pass_index,repetition,reservoir_index,current,events,snapshots));stopped=True;break
                            before_release=current;count+=1
                            internal=request.model_copy(update={"state":current,"recipient_orders":(order,),"reservoir_ref":reservoir_ref,
                                "maximum_evaluations":request.maximum_evaluations-count})
                            if internal.maximum_evaluations<=0:
                                pending.append((order_index,phase_index,pass_index,repetition,reservoir_index,current,events,snapshots));stopped=True;break
                            result=_release(internal);count+=result.examined_count
                            if result.prerequisite_refs or result.computation_bound_reached:
                                missing.extend(result.prerequisite_refs);pending.append((order_index,phase_index,pass_index,repetition,reservoir_index,current,events,snapshots,result));stopped=True;break
                            outcomes=result.values.get("release_outcomes",())
                            if outcomes:current=FlowState.model_validate(outcomes[0]["after_state"])
                            events,snapshots=_phase_event(request,before_release,current,events,snapshots,phase,
                                {"pass_ref":release_pass.pass_ref,"repetition":repetition,"reservoir_ref":reservoir_ref,"internal_result":result.values})
                        if stopped or release_pass.stop_when_unchanged and current==pass_before:break
                    if stopped:break
                if stopped:break
                # Each release already owns its exact pre-dose snapshot.
                continue
            elif phase=="LOSS_CHECK":
                lost=(law.loss_condition=="NEW_LOSS" and current.cumulative_loss>state.cumulative_loss
                    or law.loss_condition=="CUMULATIVE_LIMIT" and current.cumulative_loss>law.cumulative_loss_limit)
                detail["loss_condition_satisfied"]=lost
                if lost:current=request.restoration_state if law.loss_outcome=="RESTORE" else current.model_copy(update={"execution_status":law.loss_outcome})
            elif phase=="TERMINAL_CHECK":
                terminals=tuple(v for v in current.vessels if v.role=="TERMINAL")
                if any(v.terminal_demand is None for v in terminals):
                    missing.append("current_terminal_quantity_requirements");pending.append((order_index,phase_index,current,events,snapshots));break
                attained=bool(terminals) and all(_exact(v.quantity)==v.terminal_demand if law.terminal_quantity_rule=="EXACT" else _exact(v.quantity)>=v.terminal_demand for v in terminals)
                detail["terminal_requirements_satisfied"]=attained
                if attained:current=request.next_entry_state if law.terminal_outcome=="ENTER_NEXT" else current.model_copy(update={"execution_status":law.terminal_outcome})
            elif phase=="BUDGET_CHECK":
                detail["budget_exhausted"]=current.remaining_budget==0
                if current.remaining_budget==0:current=current.model_copy(update={"execution_status":law.exhaustion_outcome})
            else:current=current.model_copy(update={"input_tick":current.input_tick+1})
            events,snapshots=_phase_event(request,before,current,events,snapshots,phase,detail,cost=command.cost if phase=="INPUT" else 0)
        else:interrupted=False
        if pending and pending[-1][0]==order_index:continue
        packet=ExternalPrimitivePacketC(request=request.step_identity,parent_request=request.parent_identity,
            model_ref=request.active_model_ref,action_ref=command.action_ref,primitive_ref=command.action_ref,
            before=snapshots[0],after=snapshots[-1],events=events,
            snapshots=FrozenMap({event.snapshot_ref:snapshot for event,snapshot in zip(events,snapshots)}),
            closure_domain_ref=law.law_ref,closure_stop_ref=events[-1].interruption_ref if events and events[-1].interruption_ref else "flow.declared_phases_complete",
            complete=True,cost=command.cost,terminal=current.execution_status!="ACTIVE" or current.level_ref!=state.level_ref,
            acceptance=current.execution_status=="WIN" or current.level_ref!=state.level_ref,
            response_ref=request.scope.request_ref+".flow.response."+str(order_index))
        branches.append({"order_model_ref":order.model_ref,"after_state":current,"primitive_packet":packet})
    return family_result(request,values={"successors":tuple(branches),"primitive_applied":True,
        "actual_cost":command.cost,"command":command,"transition_law_ref":law.law_ref,
        "event_owner_ref":request.scope.event_owner_ref,"primitive_cost_debited_once":True},
        prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,
        domain_complete=not pending and not missing,computation_bound_reached=bool(pending) and not missing,
        frontier={"pending_transactions":tuple(pending)} if pending else {})


def _quantity_relation(expected,observed):
    if isinstance(expected,FrozenMap) and isinstance(observed,FrozenMap) and set(expected)=={"lower","upper"} and set(observed)=={"lower","upper"}:
        if any(type(value[key]) is not int for value in (expected,observed) for key in ("lower","upper")) or any(value["lower"]>value["upper"] for value in (expected,observed)):
            return False,False
        overlap=max(expected["lower"],observed["lower"])<=min(expected["upper"],observed["upper"])
        return overlap,overlap and (expected["lower"]!=expected["upper"] or observed["lower"]!=observed["upper"])
    return type(expected) is type(observed) and expected==observed,False


def _flow_compare(request):
    outcomes=[];count=0
    for model_index,model in enumerate(request.comparison_models):
        first=None;unknown=[];aliases=[]
        expected=model.predicted_packets;observed=model.observed_packets
        if model.predicted_word!=model.observed_word:first=("primitive_word",model.predicted_word,model.observed_word)
        elif len(expected)!=len(model.predicted_word) or len(observed)!=len(model.observed_word):unknown.append("complete_sealed_primitive_word")
        for packet_index,(a,b) in enumerate(zip(expected,observed)):
            if first:break
            if not a.complete or not b.complete:unknown.append((packet_index,"complete_intermediate_event_ledger"))
            if b.observation_ref is None:unknown.append((packet_index,"observed_sealed_packet_reference"))
            if packet_index>=len(model.predicted_word) or a.action_ref!=model.predicted_word[packet_index]:
                first=(packet_index,"predicted_word_binding",a.action_ref);break
            if packet_index>=len(model.observed_word) or b.action_ref!=model.observed_word[packet_index]:
                first=(packet_index,"observed_word_binding",b.action_ref);break
            for name in ("action_ref","cost","terminal","acceptance","closure_stop_ref"):
                if getattr(a,name)!=getattr(b,name):first=(packet_index,name,getattr(a,name),getattr(b,name));break
            if first:break
            stages=[("before",a.before,b.before)]
            if len(a.events)!=len(b.events):
                if a.complete and b.complete:first=(packet_index,"event_count",len(a.events),len(b.events));break
                unknown.append((packet_index,"event_count_alias"))
            for event_index,(x,y) in enumerate(zip(a.events,b.events)):
                metadata=("producer_ref","kind_ref","clock_ref","tick","temporal_scope_ref","snapshot_kind","deleted_state_refs","costs","interruption_ref")
                stages.append(("event_owner_clock."+str(event_index),
                    immutable_json_data({name:getattr(x,name) for name in metadata}),
                    immutable_json_data({name:getattr(y,name) for name in metadata})))
                if x.snapshot_ref not in a.snapshots or y.snapshot_ref not in b.snapshots:
                    unknown.append((packet_index,event_index,"current_event_snapshot"))
                else:stages.append(("event_snapshot."+str(event_index),a.snapshots[x.snapshot_ref],b.snapshots[y.snapshot_ref]))
                stages.extend((("event_reads."+str(event_index),x.reads,y.reads),("event_writes."+str(event_index),x.writes,y.writes)))
            if first:break
            stages.append(("after",a.after,b.after))
            for stage,expected_fields,observed_fields in stages:
                for key in sorted(set(expected_fields)|set(observed_fields)):
                    if count>=request.maximum_evaluations:
                        return family_result(request,values={"comparison_outcomes":tuple(outcomes)},examined_count=count,
                            domain_complete=False,computation_bound_reached=True,
                            frontier={"model_index":model_index,"packet_index":packet_index,"stage":stage,"field_ref":key,
                                "current_unresolved":tuple(unknown),"current_raster_aliases":tuple(aliases)})
                    count+=1
                    if key not in expected_fields or key not in observed_fields:
                        unknown.append((packet_index,stage,key,"missing_corresponding_field"));continue
                    compatible,alias=_quantity_relation(expected_fields[key],observed_fields[key])
                    if not compatible:first=(packet_index,stage,key,expected_fields[key],observed_fields[key]);break
                    if alias:aliases.append((packet_index,stage,key,expected_fields[key],observed_fields[key]))
                if first:break
            if first:break
        outcomes.append({"model_ref":model.model_ref,"first_mismatch":first,
            "unresolved_evidence":tuple(unknown),"raster_aliases":tuple(aliases),
            "exactly_reconciled":first is None and not unknown and not aliases,
            "interval_compatible":first is None,"closing_valve_reverses_stock":False})
    return family_result(request,values={"comparison_outcomes":tuple(outcomes)},examined_count=count,
        prerequisite_refs=("complete_sealed_evidence_and_raster_disambiguation",) if any(o["unresolved_evidence"] or o["raster_aliases"] for o in outcomes if o["first_mismatch"] is None) else ())


def _flow_predecessor_word_d(parents,index,remaining):
    word=[];work=0
    while parents[index] is not None:
        parent,command=parents[index]
        work+=1
        if work>remaining:return None,work
        word.append(command if isinstance(command,FlowCommand) else FlowCommand.model_validate(command));index=parent
    return tuple(reversed(word)),work


def _flow_domain(request,materialize_words=True):
    states=[];parents=[];index_by_state={};front=deque();edges=[];witnesses=[];pending=[];missing=[];count=0
    for model_index,model in enumerate(request.world_models):
        if len(states)>=request.maximum_states:
            pending.append(("initial_model",model_index));continue
        index=len(states);states.append((model.model_ref,model.state));index_by_state[(model_index,model.state)]=index
        parents.append(None)
        front.append((model_index,index,0,0))
    while front:
        model_index,index,depth,cost=front.popleft();model=request.world_models[model_index];state=states[index][1]
        if state.restoration_epoch!=model.state.restoration_epoch:continue
        if state.level_ref!=model.state.level_ref or state.execution_status=="WIN":
            if len(witnesses)<request.maximum_witnesses:
                word=()
                if materialize_words:
                    word,work=_flow_predecessor_word_d(parents,index,request.maximum_evaluations-count)
                    if word is None:pending.append((model_index,index,'flow_witness_reconstruction_bound'));continue
                    count+=work
                witnesses.append({"model_ref":model.model_ref,"state_index":index,
                    "word":word,"external_word_materialized":materialize_words,"cost":cost,"new_execution_scope_required":state.level_ref!=model.state.level_ref})
            continue
        if state.execution_status!="ACTIVE" or state.restoration_epoch!=model.state.restoration_epoch:continue
        if depth>=request.maximum_depth:
            pending.append((model_index,index,depth,cost,"depth_bound"));continue
        for command_index,command in enumerate(request.commands):
            if command.cost>state.remaining_budget:continue
            if count>=request.maximum_evaluations:
                pending.append((model_index,index,depth,cost,command_index));pending.extend(tuple(front));front.clear();break
            parent=request.parent_identity
            step_ref=request.scope.request_ref+".model."+str(model_index)+".state."+str(index)+".command."+str(command_index)
            scope=request.scope.model_copy(update={"request_ref":step_ref})
            assignments=FrozenMap({"flow_model_ref":model.model_ref})
            if parent.model_assignments!=assignments and parent.model_assignments.get(model.model_ref)!=assignments:
                missing.append("whole_flow_domain_model_assignment");pending.append((model_index,index,command_index));continue
            identity=request.step_identity.model_copy(update={"request_ref":step_ref,"kernel_ref":"mechanics.finite_flow_network",
                "operation_ref":"flow_action","mode":"STEP","caller_ref":scope.caller_ref,"parent_contribution_ref":scope.parent_contribution_ref,
                "epoch":scope.epoch,"input_revision_ref":scope.evidence_revision_ref,"model_assignments":assignments,
                "immutable_inputs":FrozenMap({"state":_ledger_fields(state),"command":immutable_json_data(command)})})
            child=request.model_copy(update={"scope":scope,"state":state,"law":model.flow_law,"transition_law":model.transition_law,
                "recipient_orders":(model.recipient_order,),"restoration_state":model.restoration_state,
                "next_entry_state":model.next_entry_state,"command":command,"active_model_ref":model.model_ref,
                "step_identity":identity,"maximum_evaluations":request.maximum_evaluations-count})
            result=_flow_action(child);count+=result.examined_count
            if result.prerequisite_refs or result.computation_bound_reached:
                missing.extend(result.prerequisite_refs);pending.append((model_index,index,depth,cost,command_index,result));continue
            destinations=[]
            for successor_index,row in enumerate(result.values.get("successors",())):
                successor=FlowState.model_validate(row["after_state"]);key=(model_index,successor);destination=index_by_state.get(key)
                if destination is None:
                    if len(states)>=request.maximum_states:
                        pending.append((model_index,index,depth,cost,command_index,successor_index,successor));continue
                    destination=len(states);states.append((model.model_ref,successor));index_by_state[key]=destination
                    parents.append((index,command))
                    front.append((model_index,destination,depth+1,cost+command.cost))
                destinations.append(destination)
                edges.append({"from_state":index,"to_state":destination,"model_ref":model.model_ref,
                    "command":command,"primitive_packet":row["primitive_packet"]})
    return family_result(request,values={"joint_states":tuple(states),"state_predecessors":tuple(parents),"conditional_edges":tuple(edges),
        "feasible_witnesses":tuple(witnesses),"requested_primitive_domain":request.commands,
        "robust_strategy_proved":False,"minimum_cost_proved":False,
        "unused_intermediates_required_full":False},prerequisite_refs=tuple(dict.fromkeys(missing)),
        examined_count=count,domain_complete=not pending and not missing,
        computation_bound_reached=bool(pending) and not missing,
        frontier={"pending_work":tuple(pending),"state_count":len(states)} if pending else {})


def _flow_graph_measurement(request):
    pixels={};count=0;outcomes=[];missing=[];pending=[]
    for pixel_index,pixel in enumerate(request.trace_pixels):
        if count>=request.maximum_evaluations:
            return family_result(request,examined_count=count,domain_complete=False,computation_bound_reached=True,
                frontier={"phase":"pixel_index","next_pixel_index":pixel_index,
                    "retained_pixel_colors":tuple(sorted(pixels.items()))})
        count+=1;pixels[(pixel.x,pixel.y)]=pixel.color_ref
    nodes={request.state.source_ref}|{v.vessel_ref for v in request.state.vessels}
    valves={v.valve_ref for v in request.state.valves}
    for model_index,model in enumerate(request.tracing_models):
        conductive=set(model.conductive_color_refs);excluded=set(model.excluded_fill_positions)
        port_nodes={};gate_positions={};directions={d.position:d.allowed_offsets for d in model.directions}
        for port in model.ports:port_nodes.setdefault(port.position,[]).append(port)
        for gate in model.valve_gates:
            for pos in gate.pixel_positions:gate_positions.setdefault(pos,[]).append(gate.valve_ref)
        model_missing=[]
        if any(p.node_ref not in nodes for p in model.ports) or any(g.valve_ref not in valves for g in model.valve_gates):model_missing.append("current_port_and_valve_identities")
        if any(len({p.node_ref for p in ports})>1 for _,ports in sorted(port_nodes.items())):model_missing.append("distinct_node_port_pixels")
        if any(p.position not in pixels or p.position in excluded or pixels[p.position] not in conductive for p in model.ports):model_missing.append("retained_conductive_port_pixels")
        if model_missing:
            missing.extend(model_missing);outcomes.append({"model_ref":model.model_ref,"prerequisite_refs":tuple(model_missing)});continue
        pipes=[];path_evidence=[];seen_edges=set();expanded=0;stopped=False
        for port_index,port in enumerate(model.ports):
            if port.direction=="INLET":continue
            initial_gates=frozenset(gate_positions.get(port.position,()))
            queue=deque([(port.position,initial_gates,(port.position,))]);visited={(port.position,initial_gates)}
            while queue:
                if count>=request.maximum_evaluations or expanded>=request.maximum_states or len(pipes)>=512:
                    pending.append({"model_index":model_index,"port_index":port_index,
                        "queue":tuple((pos,tuple(sorted(gates)),path) for pos,gates,path in queue),
                        "visited":tuple(sorted((pos,tuple(sorted(gates))) for pos,gates in visited)),
                        "retained_pipes":tuple(pipes),"path_evidence":tuple(path_evidence)})
                    stopped=True;break
                pos,gates,path=queue.popleft();count+=1;expanded+=1
                terminal_ports=tuple(p for p in port_nodes.get(pos,()) if p.port_ref!=port.port_ref)
                if terminal_ports:
                    for receiver in terminal_ports:
                        if receiver.node_ref==port.node_ref or receiver.direction=="OUTLET":continue
                        controls=tuple(sorted(gates));key=(port.node_ref,receiver.node_ref,controls)
                        if key in seen_edges:continue
                        seen_edges.add(key)
                        pipe=FlowPipe(pipe_ref="trace."+model.model_ref+"."+str(len(pipes)),from_ref=port.node_ref,to_ref=receiver.node_ref,
                            valve_ref=None,serial_valve_refs=controls,direction_supported=model.directed_port_evidence_complete)
                        pipes.append(pipe);path_evidence.append((pipe.pipe_ref,port.port_ref,receiver.port_ref,path))
                    continue
                for dx,dy in directions.get(pos,model.adjacency_offsets):
                    nxt=(pos[0]+dx,pos[1]+dy)
                    if nxt not in pixels or nxt in excluded or pixels[nxt] not in conductive:continue
                    next_gates=gates|frozenset(gate_positions.get(nxt,()));key=(nxt,next_gates)
                    if key in visited:continue
                    visited.add(key);queue.append((nxt,next_gates,path+(nxt,)))
            if stopped:break
        if not model.directed_port_evidence_complete:model_missing.append("directional_port_evidence")
        missing.extend(model_missing)
        outcomes.append({"model_ref":model.model_ref,"measured_state":request.state.model_copy(update={"pipes":tuple(pipes)}),
            "port_path_evidence":tuple(path_evidence),"connectivity_complete":not stopped and not model_missing,
            "prerequisite_refs":tuple(model_missing),"vessel_quantity_capacity_evidence":request.state.vessels,
            "valve_state_evidence":request.state.valves,"fill_pixels_excluded":True,
            "identical_envelopes_prove_equal_capacities":False})
        if stopped:break
    return family_result(request,values={"trace_model_outcomes":tuple(outcomes)},
        prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,
        domain_complete=not pending and not missing,computation_bound_reached=bool(pending) and not missing,
        frontier={"pending_traces":tuple(pending),
            "unstarted_trace_model_refs":tuple(m.model_ref for m in request.tracing_models[model_index+1:])} if pending else {})


def _allocation_preimages(request):
    if request.maximum_domain_evaluations>=request.maximum_evaluations:
        return family_result(request,prerequisite_refs=("domain_budget_leaves_preimage_evaluation",),domain_complete=False)
    domain=_flow_domain(request.model_copy(update={"maximum_evaluations":request.maximum_domain_evaluations}),False)
    states=domain.values.get("joint_states",());parents=domain.values.get("state_predecessors",());models={m.model_ref:m for m in request.world_models}
    preparations=[];rejected=[];missing=list(domain.prerequisite_refs);count=domain.examined_count;pending=[];already=[]
    for model in request.world_models:
        by_ref={v.vessel_ref:v for v in model.state.vessels};consumer=by_ref.get(request.consumer_ref)
        if consumer is None or consumer.role!="TERMINAL":missing.append("current_terminal_consumer_identity");continue
        quantity=_exact(consumer.quantity)
        if quantity is not None and request.required_consumer_quantity.lower<=quantity<=request.required_consumer_quantity.upper:already.append(model.model_ref)
        if any(ref not in by_ref or by_ref[ref].role!="RELAY" or by_ref[ref].relay_threshold is None for ref in request.funded_relay_refs):missing.append("declared_funded_relay_thresholds")
        if any(ref not in by_ref or by_ref[ref].role!="TERMINAL" or _exact(by_ref[ref].quantity) is None for ref in request.preserved_terminal_refs):missing.append("declared_preserved_terminal_quantities")
    if missing:
        return family_result(request,values={"composition_domain":domain,"already_satisfied_model_refs":tuple(already)},
            prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,domain_complete=False)
    for edge_index,edge in enumerate(domain.values.get("conditional_edges",())):
        if len(preparations)>=request.maximum_witnesses:break
        if count>=request.maximum_evaluations:
            pending.append({"next_edge_index":edge_index});break
        count+=1;model=models[edge["model_ref"]]
        before=FlowState.model_validate(states[edge["from_state"]][1]);after=FlowState.model_validate(states[edge["to_state"]][1])
        if before.level_ref!=model.state.level_ref or after.level_ref!=model.state.level_ref or before.restoration_epoch!=after.restoration_epoch:
            rejected.append((edge_index,"same_allocation_execution_scope"));continue
        old={v.vessel_ref:v for v in before.vessels};new={v.vessel_ref:v for v in after.vessels};baseline={v.vessel_ref:v for v in model.state.vessels}
        amount=_exact(new[request.consumer_ref].quantity)
        if amount is None or not request.required_consumer_quantity.lower<=amount<=request.required_consumer_quantity.upper:continue
        if after.cumulative_loss-model.state.cumulative_loss>request.maximum_new_loss:
            rejected.append((edge_index,"loss_preservation"));continue
        if any(_exact(old[ref].quantity)<old[ref].relay_threshold or _exact(new[ref].quantity)<new[ref].relay_threshold for ref in request.funded_relay_refs):
            rejected.append((edge_index,"funded_relay_preservation"));continue
        if any(_exact(new[ref].quantity)<_exact(baseline[ref].quantity) for ref in request.preserved_terminal_refs):
            rejected.append((edge_index,"terminal_progress_preservation"));continue
        reverse=_walk(before,model.flow_law,before.source_ref,reverse=True,maximum_evaluations=request.maximum_evaluations-count)
        count+=reverse.examined_count
        forward=_walk(before,model.flow_law,before.source_ref,maximum_evaluations=request.maximum_evaluations-count)
        count+=forward.examined_count;missing.extend(forward.prerequisite_refs+reverse.prerequisite_refs)
        if reverse.frontier or forward.frontier:
            pending.append({"next_edge_index":edge_index,"reverse_frontier":reverse.frontier,"forward_frontier":forward.frontier});break
        if forward.prerequisite_refs or reverse.prerequisite_refs:continue
        word,work=_flow_predecessor_word_d(parents,edge['from_state'],request.maximum_evaluations-count)
        if word is None:pending.append({'next_edge_index':edge_index,'phase':'allocation_word_reconstruction'});break
        count+=work;cost=sum(command.cost for command in word)
        preparations.append({"model_ref":model.model_ref,"consumer_ref":request.consumer_ref,
            "remaining_terminal_deficit":max(0,request.required_consumer_quantity.lower-_exact(baseline[request.consumer_ref].quantity)),
            "preparation_state":before,"preparation_word":word,"preparation_cost":cost,
            "consumer_command":edge["command"],"consumer_successor":after,"consumer_packet":edge["primitive_packet"],
            "valve_isolation_states":before.valves,"source_sink_refs":forward.sink_refs,"prime_conditions":forward.conditions,
            "reservoir_charge_constraints":tuple((v.vessel_ref,v.release_threshold,v.quantity) for v in before.vessels if v.role=="RESERVOIR"),
            "reverse_access_refs":reverse.sink_refs,"reverse_access_conditions":reverse.conditions,
            "drain_refs":tuple(v.vessel_ref for v in before.vessels if v.role=="DRAIN"),
            "funded_relay_refs":request.funded_relay_refs,"preserved_terminal_refs":request.preserved_terminal_refs,
            "unresolved_access_refs":forward.prerequisite_refs+reverse.prerequisite_refs})
    return family_result(request,values={"alternative_preparations":tuple(preparations),"rejected_preparations":tuple(rejected),
        "already_satisfied_model_refs":tuple(already),"whole_composition_domain":domain,
        "robust_preparation_proved":False,"minimum_cost_proved":False},examined_count=count,
        prerequisite_refs=tuple(dict.fromkeys(missing)),domain_complete=domain.domain_complete and not pending and not missing,
        computation_bound_reached=domain.computation_bound_reached or bool(pending),
        frontier={"pending_preimages":tuple(pending),"composition_frontier":domain.frontier} if pending or domain.frontier else {})


def _service_certificate(request):
    if request.service_kind!="RESERVOIR_RELEASE":
        return family_result(request,prerequisite_refs=("certificate_scoped_to_reservoir_release",),domain_complete=False)
    if request.law.reservoir_distribution not in ("CYCLIC_SKIP_FULL","FIRST_CAPABLE"):
        return family_result(request,prerequisite_refs=("skip_full_distribution_law",),domain_complete=False)
    if request.reservoir_ref is None:
        return family_result(request,prerequisite_refs=('current_release_reservoir_and_grounded_sink_domain',),domain_complete=False)
    reservoir=next((v for v in request.state.vessels if v.vessel_ref==request.reservoir_ref),None)
    if reservoir is None or reservoir.role!='RESERVOIR':
        return family_result(request,prerequisite_refs=('current_release_reservoir_identity',),domain_complete=False)
    traversal=_walk(request.state,request.law,request.reservoir_ref,maximum_evaluations=request.maximum_evaluations)
    if traversal.prerequisite_refs or traversal.frontier:
        return family_result(request,prerequisite_refs=traversal.prerequisite_refs,examined_count=traversal.examined_count,
            domain_complete=False,computation_bound_reached=bool(traversal.frontier),frontier=traversal.frontier)
    if set(request.fixed_sink_refs)!=set(traversal.sink_refs):
        return family_result(request,prerequisite_refs=('fixed_receivers_equal_current_reachable_sink_domain',),
            examined_count=traversal.examined_count,domain_complete=False)
    by_ref={v.vessel_ref:v for v in request.state.vessels}
    if not set(request.fixed_sink_refs)<=set(by_ref):return family_result(request,prerequisite_refs=("fixed_receiver_identities",),domain_complete=False)
    receivers=tuple(by_ref[ref] for ref in request.fixed_sink_refs)
    if traversal.examined_count+len(receivers)+len(request.state.vessels)>request.maximum_evaluations:
        return family_result(request,domain_complete=False,computation_bound_reached=True,
            frontier={"next_receiver_index":0,"next_material_account_vessel_index":0,"receiver_refs":request.fixed_sink_refs})
    free=sum(max(0,v.capacity.lower-v.quantity.upper) for v in receivers)
    drain=any(v.role=="DRAIN" for v in receivers)
    lower=request.state.source_reserve.lower+sum(v.quantity.lower for v in request.state.vessels)+request.state.cumulative_loss
    upper=request.state.source_reserve.upper+sum(v.quantity.upper for v in request.state.vessels)+request.state.cumulative_loss
    expected_lower=request.initial_total_material.lower+request.account_incoming_total-request.account_outgoing_total
    expected_upper=request.initial_total_material.upper+request.account_incoming_total-request.account_outgoing_total
    account_compatible=max(lower,expected_lower)<=min(upper,expected_upper)
    account_proved=account_compatible and lower==upper==expected_lower==expected_upper
    return family_result(request,values={"concurrent_stock":request.held_stock,
        "successive_reuse_count":request.reuse_count,"receiving_capacity_lower":free,
        "no_loss_under_any_supported_order":bool(receivers) and not drain and free>=request.held_stock.upper,
        "stock_plus_loss_interval":(lower,upper),"expected_material_account_interval":(expected_lower,expected_upper),
        "material_conservation_compatible":account_compatible,"material_conservation_proved":account_proved,
        "specific_final_allocation_proved":False,"direct_dose_certificate":False},examined_count=traversal.examined_count+len(receivers)+len(request.state.vessels))


def measure_finite_flow_network(request: FlowRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:
        return family_result(request,signature_supported=False,domain_complete=False)
    required={"flow_graph_measurement":("state","trace_pixels","tracing_models"),"quantity_calibration":("quantity_accounts","quantity_observations"),
        "relay_reachability":("state","law","start_ref"),"source_dose":("state","law","recipient_orders"),
        "reservoir_release":("state","law","reservoir_ref","recipient_orders"),"reverse_recovery":("state","law"),
        "material_service_certificate":("state","law","fixed_sink_refs","held_stock","reuse_count","service_kind",
            "initial_total_material","account_incoming_total","account_outgoing_total"),
        "flow_action":("state","law","command","transition_law","recipient_orders","step_identity","parent_identity","active_model_ref","clock_ref","temporal_scope_ref"),
        "flow_compare":("comparison_models",),
        "flow_composition_domain":("world_models","commands","step_identity","parent_identity","clock_ref","temporal_scope_ref"),
        "allocation_preimages":("world_models","commands","step_identity","parent_identity","clock_ref","temporal_scope_ref",
            "consumer_ref","required_consumer_quantity","funded_relay_refs","preserved_terminal_refs","maximum_new_loss","maximum_domain_evaluations")}
    missing=missing_supplied_fields(request,required.get(request.operation_ref,()))
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    op=request.operation_ref
    if op=="flow_graph_measurement":
        return _flow_graph_measurement(request)
    if op=="quantity_calibration":return _quantity_fit(request)
    if op=="relay_reachability":
        traversal=_walk(request.state,request.law,request.start_ref,maximum_evaluations=request.maximum_evaluations)
        return family_result(request,values={"current_sink_refs":traversal.sink_refs,"missing_prime_conditions":traversal.conditions},
            prerequisite_refs=traversal.prerequisite_refs,examined_count=traversal.examined_count,
            domain_complete=not traversal.prerequisite_refs and not traversal.frontier,
            computation_bound_reached=bool(traversal.frontier),frontier=traversal.frontier)
    if op=="source_dose":return _dose(request)
    if op=="reservoir_release":return _release(request)
    if op=="reverse_recovery":return _recovery(request)
    if op=="flow_action":return _flow_action(request)
    if op=="flow_compare":return _flow_compare(request)
    if op=="flow_composition_domain":return _flow_domain(request)
    if op=="allocation_preimages":return _allocation_preimages(request)
    return _service_certificate(request)
