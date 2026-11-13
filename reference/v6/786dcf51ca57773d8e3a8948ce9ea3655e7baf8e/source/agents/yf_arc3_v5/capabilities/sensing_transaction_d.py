"""One paid sensing transaction or one disjoint already-paid physical phase."""
from __future__ import annotations
from time import monotonic
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .relay_wave_arrivals_d import RelayWaveArrivalsRequestD, measure_relay_wave_arrivals_d
from .occupancy_deferred_permission_d import OccupancyDeferredPermissionRequestD, measure_occupancy_deferred_permission_d
from .source_locked_pursuit_d import SourceLockedPursuitRequestD, HeardSourceReceiptD, measure_source_locked_pursuit_d
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class SensingDelegateIncomplete(Exception):
    def __init__(self,result):
        self.status,self.cause,self.frontier=result.status,result.cause,result.frontier
        super().__init__(result.cause)


class SensingTerrainCellD(FrozenModel):
    position: tuple[int, int]
    admitted: bool | None
    belief_evidence_ref: Ref


class MovingWallD(FrozenModel):
    identity_ref: Ref
    origin: tuple[int, int]
    offsets: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    cycle_displacements: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=128)
    displacement_cursor: int = Field(ge=0)
    period: int = Field(ge=1)
    clock_phase: int = Field(ge=0)
    move_phase: int = Field(ge=0)
    jam_retains_phase: bool
    jam_retains_displacement: bool
    actor_contact_law: Literal['PUSH', 'CRUSH', 'JAM']


class ForcedPadD(FrozenModel):
    identity_ref: Ref
    position: tuple[int, int]
    displacement: tuple[int, int]


class SensingGateD(FrozenModel):
    identity_ref: Ref
    blocked_pixels: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    permission_open: bool
    permission_request: OccupancyDeferredPermissionRequestD
    close_receipt_ref: Ref | None
    open_receipt_ref: Ref | None


class SensingListenerD(FrozenModel):
    identity_ref: Ref
    position: tuple[int, int]
    offsets: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    pursuit_request: SourceLockedPursuitRequestD
    node_positions: tuple[tuple[Ref, tuple[int, int]], ...] = Field(min_length=1, max_length=4096)
    wave_receipt_ref: Ref | None
    heard_source_nodes: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=128)


class SensingStateD(FrozenModel):
    actor_ref: Ref
    actor_origin: tuple[int, int]
    actor_offsets: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    world_turn: int = Field(ge=0)
    movement_reserve: int
    sensing_reserve: int = Field(ge=0)
    terrain_assignment: tuple[SensingTerrainCellD, ...] = Field(min_length=1, max_length=4096)
    visited_pixels: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    echo_ages: tuple[tuple[tuple[int, int], int], ...] = Field(default=(), max_length=4096)
    walls: tuple[MovingWallD, ...] = Field(default=(), max_length=128)
    pads: tuple[ForcedPadD, ...] = Field(default=(), max_length=128)
    gates: tuple[SensingGateD, ...] = Field(default=(), max_length=128)
    listeners: tuple[SensingListenerD, ...] = Field(default=(), max_length=128)
    fired_pad_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    command_ref: Ref
    command_events: tuple[FrozenMap, ...] = Field(default=(), max_length=4096)
    completed_internal_phases: tuple[Literal['moving_walls', 'forced_pads'], ...] = Field(default=(), max_length=2)


class SensingTransactionRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.sensing_transaction_request_d.v1'
    phase_ref: Literal['EXTERNAL_SENSING_TRANSACTION', 'moving_walls', 'forced_pads']
    state: SensingStateD
    input_kind: Literal['MOVE', 'SENSE_OR_WAIT']
    input_displacement: tuple[int, int]
    new_command_ref: Ref
    movement_attempt_debit: int = Field(ge=0)
    echo_age_per_move_attempt: int = Field(ge=0)
    sense_charge_debit: int = Field(ge=1)
    sense_moves_world_clock: bool
    silent_wait_when_empty_supported: bool
    silent_wait_moves_world_clock: bool
    wait_echo_age: int = Field(ge=0)
    external_phase_order: tuple[Literal['INPUT', 'RECEIPTS', 'moving_walls', 'forced_pads', 'ENEMIES', 'TERMINAL'], ...]
    wave_request: RelayWaveArrivalsRequestD | None
    pad_blocked_attempt_fires: bool
    echo_retention_age: int = Field(ge=0)
    goal_actor_cells: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    goal_predicate_bound: bool
    terminal_priority: tuple[Literal['CONTACT', 'GOAL', 'DEPLETION'], ...]
    depletion_at_zero: bool
    restored_state: SensingStateD | None
    restore_on: tuple[Literal['CONTACT', 'DEPLETION'], ...]
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.reactive_graph_navigation.sensing_transaction', 'STEP'),
        ('mechanics.reactive_graph_navigation.sensing_transaction', 'STEP_INTERNAL'))

    @model_validator(mode='after')
    def disjoint_owner_phases(self):
        if self.mode_ref == 'STEP_INTERNAL' and self.phase_ref not in ('moving_walls', 'forced_pads'):
            raise ValueError('internal phase cannot enter external ownership')
        if self.mode_ref == 'STEP' and (self.phase_ref != 'EXTERNAL_SENSING_TRANSACTION' or set(self.external_phase_order) != {
                'INPUT', 'RECEIPTS', 'moving_walls', 'forced_pads', 'ENEMIES', 'TERMINAL'} or len(self.external_phase_order) != 6 or
                self.external_phase_order[0] != 'INPUT' or self.external_phase_order[-1] != 'TERMINAL'):
            raise ValueError('complete input requires exact owned phase order')
        if any(w.clock_phase >= w.period or w.move_phase >= w.period or w.displacement_cursor >= len(w.cycle_displacements) for w in self.state.walls):
            raise ValueError('moving-wall clocks/cursors outside model')
        if len({c.position for c in self.state.terrain_assignment}) != len(self.state.terrain_assignment):
            raise ValueError('one correlated belief assignment per pixel')
        return self


def _sensing_actor_pixels(state, origin=None):
    p = state.actor_origin if origin is None else origin
    return {(p[0]+dx, p[1]+dy) for dx, dy in state.actor_offsets}


def _sensing_contact(state):
    actor = _sensing_actor_pixels(state)
    return tuple(listener.identity_ref for listener in state.listeners if actor & {
        (listener.position[0]+dx, listener.position[1]+dy) for dx, dy in listener.offsets})


def _sensing_admission(state, destination, budget, omit_wall=None):
    terrain = {c.position: c.admitted for c in state.terrain_assignment}
    blocked = {(w.origin[0]+dx, w.origin[1]+dy) for w in state.walls if w.identity_ref != omit_wall for dx, dy in w.offsets}
    blocked.update(p for gate in state.gates if not gate.permission_open for p in gate.blocked_pixels)
    uncertain, refused = [], []
    for point in sorted(_sensing_actor_pixels(state, destination)):
        budget.visit({'stage': 'actor_whole_footprint_admission', 'point': point})
        if point not in terrain or terrain[point] is None: uncertain.append(point)
        elif not terrain[point] or point in blocked: refused.append(point)
    return not uncertain and not refused, tuple(uncertain), tuple(refused)


def _sensing_pad_closure(state, request, budget):
    fired = set(state.fired_pad_refs)
    events, failure = [], None
    for index in range(request.depth_bound):
        active = [p for p in state.pads if p.position in _sensing_actor_pixels(state) and p.identity_ref not in fired]
        if not active: return state.model_copy(update={'fired_pad_refs': tuple(sorted(fired))}), tuple(events), failure
        if len(active) != 1: return state, tuple(events), 'AMBIGUOUS_PAD_OVERLAP'
        pad = active[0]
        destination = tuple(state.actor_origin[i]+pad.displacement[i] for i in (0, 1))
        admitted, unknown, blocked = _sensing_admission(state, destination, budget)
        if unknown: return state, tuple(events), 'PAD_DESTINATION_UNKNOWN'
        if admitted or request.pad_blocked_attempt_fires: fired.add(pad.identity_ref)
        events.append({'cause': 'ONE_PAD_PER_EXISTING_COMMAND', 'pad_ref': pad.identity_ref,
            'command_ref': state.command_ref, 'accepted': admitted, 'blocked_pixels': blocked})
        if not admitted:
            return state.model_copy(update={'fired_pad_refs': tuple(sorted(fired))}), tuple(events), None
        state = state.model_copy(update={'actor_origin': destination})
        if _sensing_contact(state): return state.model_copy(update={'fired_pad_refs': tuple(sorted(fired))}), tuple(events), 'CONTACT'
    if any(p.position in _sensing_actor_pixels(state) and p.identity_ref not in fired for p in state.pads):
        raise DComputationInterrupted('FORCED_PAD_CHAIN_DEPTH_BOUND', {})
    return state.model_copy(update={'fired_pad_refs': tuple(sorted(fired))}), tuple(events), failure


def _sensing_moving_walls(state, request, budget, clock_advanced):
    events, walls = [], list(state.walls)
    for index, wall in enumerate(walls):
        budget.visit({'stage': 'due_moving_wall', 'wall_ref': wall.identity_ref})
        phase = (wall.clock_phase+int(clock_advanced)) % wall.period
        if not clock_advanced or phase != wall.move_phase:
            walls[index] = wall.model_copy(update={'clock_phase': phase}); continue
        delta = wall.cycle_displacements[wall.displacement_cursor]
        destination = tuple(wall.origin[i]+delta[i] for i in (0, 1))
        pixels = {(destination[0]+dx, destination[1]+dy) for dx, dy in wall.offsets}
        terrain = {c.position: c.admitted for c in state.terrain_assignment}
        if any(terrain.get(p) is None for p in pixels): return state, tuple(events), 'MOVING_WALL_DESTINATION_UNKNOWN'
        other = {(w.origin[0]+dx, w.origin[1]+dy) for j,w in enumerate(walls) if j != index for dx,dy in w.offsets}
        other.update(p for g in state.gates if not g.permission_open for p in g.blocked_pixels)
        jam = any(not terrain[p] or p in other for p in pixels)
        touches = bool(pixels & _sensing_actor_pixels(state))
        if touches and not jam:
            if wall.actor_contact_law == 'CRUSH': return state, tuple(events), 'CONTACT'
            if wall.actor_contact_law == 'JAM': jam = True
            else:
                actor_target = tuple(state.actor_origin[i]+delta[i] for i in (0, 1))
                accepted, unknown, _ = _sensing_admission(state.model_copy(update={'walls': tuple(walls)}), actor_target, budget, wall.identity_ref)
                if unknown: return state, tuple(events), 'WALL_PUSH_DESTINATION_UNKNOWN'
                if not accepted: return state, tuple(events), 'CONTACT'
                state = state.model_copy(update={'actor_origin': actor_target})
                state, pad_events, failure = _sensing_pad_closure(state, request, budget)
                events.extend(pad_events)
                if failure: return state, tuple(events), failure
        walls[index] = wall.model_copy(update={'origin': wall.origin if jam else destination,
            'clock_phase': wall.clock_phase if jam and wall.jam_retains_phase else phase,
            'displacement_cursor': wall.displacement_cursor if jam and wall.jam_retains_displacement else
                (wall.displacement_cursor+1)%len(wall.cycle_displacements)})
        state = state.model_copy(update={'walls': tuple(walls)})
        if pixels&_sensing_actor_pixels(state):return state, tuple(events), 'CONTACT'
        events.append({'cause': 'OWNED_MOVING_WALL_PHASE', 'wall_ref': wall.identity_ref, 'jammed': jam,
            'command_ref': state.command_ref, 'world_turn': state.world_turn})
        if _sensing_contact(state): return state, tuple(events), 'CONTACT'
    return state.model_copy(update={'walls': tuple(walls)}), tuple(events), None


def _sensing_delegate(request, child, budget, function):
    if any(getattr(child.scope, field)!=getattr(request.scope, field) for field in (
            'epoch','evidence_revision_ref','model_revision_ref','parent_goal_ref')):
        raise ValueError('foreign delegated consumer scene/model/parent scope')
    remaining = request.node_bound-budget.examined
    ms = int(request.time_bound_ms-(monotonic()-budget.started)*1000)
    if min(remaining, ms) < 1: raise DComputationInterrupted('AGGREGATE_SENSING_BUDGET', {})
    result = function(child.model_copy(update={'node_bound': remaining, 'time_bound_ms': ms}))
    budget.examined += result.examined_count
    if not result.domain_complete: raise SensingDelegateIncomplete(result)
    return result.values


def measure_sensing_transaction_d(request: SensingTransactionRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        state, events = request.state, []
        failure, boundary, wave = None, None, None
        clock_advanced, sensed, accepted = False, False, False
        if request.mode_ref == 'STEP_INTERNAL':
            # Internal calls are already at their caller's paid turn boundary.
            if request.phase_ref in state.completed_internal_phases:
                return d_result(request,'COMPLETE','OWNED_PHASE_ALREADY_COMPLETED',complete=True,
                    values={'state':state,'event_delta':(),'external_inputs_added':0,'extra_world_turns':0})
            if request.phase_ref == 'moving_walls': state, delta, failure = _sensing_moving_walls(state, request, budget, True)
            else: state, delta, failure = _sensing_pad_closure(state, request, budget)
            if failure is None:state=state.model_copy(update={'completed_internal_phases':state.completed_internal_phases+(request.phase_ref,)})
            budget.finish()
            return d_result(request, 'NEEDS_EVIDENCE' if failure and failure != 'CONTACT' else 'COMPLETE',
                failure or 'OWNED_INTERNAL_SENSING_PHASE', complete=failure is None or failure == 'CONTACT', examined=budget.examined,
                values={'state': state, 'event_delta': delta, 'physical_contact_failure': failure == 'CONTACT',
                'external_inputs_added': 0, 'extra_world_turns': 0, 'terminal_checkpoint_owned': False})
        state = state.model_copy(update={'command_ref': request.new_command_ref, 'fired_pad_refs': (), 'command_events': (), 'completed_internal_phases':()})
        for phase in request.external_phase_order:
            budget.visit({'stage': 'owned_external_sensing_phase', 'phase': phase})
            if phase == 'INPUT':
                if request.input_kind == 'MOVE':
                    destination = tuple(state.actor_origin[i]+request.input_displacement[i] for i in (0, 1))
                    accepted, unknown, blocked = _sensing_admission(state, destination, budget)
                    state = state.model_copy(update={'movement_reserve': state.movement_reserve-request.movement_attempt_debit,
                        'actor_origin': destination if accepted else state.actor_origin})
                    age, clock_advanced = request.echo_age_per_move_attempt, True
                    events.append({'cause': 'PAID_MOVE_ATTEMPT', 'accepted': accepted, 'blocked_pixels': blocked})
                    if unknown: failure = 'DIRECT_MOVE_UNKNOWN'
                elif state.sensing_reserve >= request.sense_charge_debit:
                    sensed, accepted, clock_advanced = True, True, request.sense_moves_world_clock
                    state = state.model_copy(update={'sensing_reserve': state.sensing_reserve-request.sense_charge_debit})
                    age = request.wait_echo_age
                elif state.sensing_reserve == 0 and request.silent_wait_when_empty_supported:
                    accepted, clock_advanced, age = True, request.silent_wait_moves_world_clock, request.wait_echo_age
                else: failure, age = 'SENSING_RESERVE_CONTEXT_UNRESOLVED', 0
                state = state.model_copy(update={'world_turn': state.world_turn+int(clock_advanced),
                    'echo_ages': tuple((p,a+age) for p,a in state.echo_ages if a+age <= request.echo_retention_age),
                    'visited_pixels': tuple(sorted(set(state.visited_pixels)|_sensing_actor_pixels(state)))})
            elif phase == 'RECEIPTS':
                if sensed:
                    if request.wave_request is None: failure = 'CURRENT_WAVE_REQUEST_REQUIRED'; break
                    if request.wave_request.command_ref != state.command_ref: failure = 'WAVE_COMMAND_SCOPE_MISMATCH'; break
                    wave = _sensing_delegate(request, request.wave_request, budget, measure_relay_wave_arrivals_d)
                tokens = {t['receipt_ref']: t for t in wave['reception_tokens']} if wave else {}
                gates = []
                for gate in state.gates:
                    close, opened = tokens.get(gate.close_receipt_ref), tokens.get(gate.open_receipt_ref)
                    if close and opened: failure = 'GATE_PULSE_ORDER_UNKNOWN'; break
                    token = opened or close
                    child = gate.permission_request
                    if token and token['consumer_ref'] != child.scope.parent_consumer_ref: failure = 'GATE_TOKEN_CONSUMER_MISMATCH'; break
                    occupancy = (state.actor_ref,) if set(gate.blocked_pixels)&_sensing_actor_pixels(state) else ()
                    child = child.model_copy(update={'permission_open': gate.permission_open, 'occupied_identity_refs': occupancy,
                        'source_request': 'OPEN' if opened else 'CLOSE' if close else 'NONE',
                        'request_event_ref': token['receipt_ref'] if token else None, 'request_epoch': request.scope.epoch if token else None})
                    permission = _sensing_delegate(request, child, budget, measure_occupancy_deferred_permission_d)
                    child = child.model_copy(update={key: permission[key] for key in (
                        'pending_close_event_ref', 'pending_close_epoch', 'last_applied_event_ref', 'last_applied_epoch')})
                    gates.append(gate.model_copy(update={'permission_open': permission['permission_open'], 'permission_request': child}))
                if failure: break
                echoes = dict(state.echo_ages)
                for _,token in sorted(tokens.items()):
                    if token['channel'] == 'VISIBILITY':
                        receipt = next(r for r in request.wave_request.receipts if r.receipt_ref == token['receipt_ref'])
                        echoes[receipt.position] = 0
                state = state.model_copy(update={'gates': tuple(gates), 'echo_ages': tuple(sorted(echoes.items()))})
            elif phase == 'moving_walls':
                state, delta, failure = _sensing_moving_walls(state, request, budget, clock_advanced); events.extend(delta)
                if failure is None:state=state.model_copy(update={'completed_internal_phases':state.completed_internal_phases+('moving_walls',)})
            elif phase == 'forced_pads':
                state, delta, failure = _sensing_pad_closure(state, request, budget); events.extend(delta)
                if failure is None:state=state.model_copy(update={'completed_internal_phases':state.completed_internal_phases+('forced_pads',)})
            elif phase == 'ENEMIES':
                tokens = {t['receipt_ref']: t for t in wave['reception_tokens']} if wave else {}
                listeners = []
                for listener in state.listeners:
                    child, heard = listener.pursuit_request, []
                    token = tokens.get(listener.wave_receipt_ref)
                    if token:
                        if token['consumer_ref'] != child.scope.parent_consumer_ref: failure = 'LISTENER_TOKEN_CONSUMER_MISMATCH'; break
                        nodes = dict(listener.heard_source_nodes)
                        for index, ref in enumerate(token['source_alternatives']):
                            if ref not in nodes: failure = 'HEARD_SOURCE_NODE_UNBOUND'; break
                            heard.append(HeardSourceReceiptD(receipt_ref=token['receipt_ref'], source_node_ref=nodes[ref], tick=state.world_turn,
                                epoch=request.scope.epoch, order_index=index, qualifying=True))
                    if failure: break
                    result = _sensing_delegate(request, child.model_copy(update={'clock_advanced': clock_advanced,
                        'opportunity_tick': state.world_turn, 'receipts': tuple(heard)}), budget, measure_source_locked_pursuit_d)
                    rows = result['listener_alternative_successors']
                    if len(rows) != 1: failure = 'LISTENER_SUCCESSOR_ALTERNATIVES_UNRESOLVED'; break
                    row = rows[0]
                    pose = dict(listener.node_positions).get(row['listener_node_ref'])
                    if pose is None: failure = 'LISTENER_POSE_BINDING_UNKNOWN'; break
                    child = child.model_copy(update={key: row[key] for key in ('listener_node_ref', 'remembered_source_node_ref',
                        'remembered_receipt_ref', 'remaining_alert_opportunities', 'clock_phase')})
                    listeners.append(listener.model_copy(update={'position': pose, 'pursuit_request': child}))
                    interim = state.model_copy(update={'listeners': tuple(listeners)+state.listeners[len(listeners):]})
                    if _sensing_contact(interim): failure = 'CONTACT'; state = interim; break
                if not failure: state = state.model_copy(update={'listeners': tuple(listeners)})
            elif phase == 'TERMINAL':
                contact = bool(_sensing_contact(state))
                goal = request.goal_predicate_bound and state.actor_origin in request.goal_actor_cells
                depleted = state.movement_reserve <= 0 if request.depletion_at_zero else state.movement_reserve < 0
                for check in request.terminal_priority:
                    if check == 'CONTACT' and contact or check == 'GOAL' and goal or check == 'DEPLETION' and depleted: boundary = check; break
            if failure: break
            if _sensing_contact(state): failure = 'CONTACT'; break
        if failure == 'CONTACT': boundary = 'CONTACT'
        complete = failure is None or failure == 'CONTACT'
        before_restore = state
        if boundary in request.restore_on and request.restored_state is not None: state = request.restored_state
        budget.finish()
        return d_result(request, 'COMPLETE' if complete else 'NEEDS_EVIDENCE', failure or 'ONE_COMPLETE_SENSING_INPUT',
            complete=complete, examined=budget.examined, values={'state': state, 'pre_restore_state': before_restore,
            'event_delta': tuple(events), 'wave_receipts': wave, 'boundary': boundary,
            'accepted': accepted, 'world_clock_advanced': clock_advanced, 'external_inputs': 1,
            'private_fixed_map_exposed': False, 'receipt_consumers_replayed': False})
    except ValueError as error:
        return d_result(request, 'NEEDS_EVIDENCE', 'INVALID_SENSING_DELEGATION', values={'error': str(error)})
    except SensingDelegateIncomplete as error:
        return d_result(request,error.status,error.cause,examined=budget.examined,
            frontier={'restart_atomic_owned_sensing_phase':True,'delegated_frontier':error.frontier,
                'existing_command_ref':request.state.command_ref,'new_external_debit_on_resume':False})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            frontier={'restart_atomic_owned_sensing_phase': True, 'work': error.frontier,
            'new_external_debit_on_resume': False, 'existing_command_ref': request.state.command_ref})
