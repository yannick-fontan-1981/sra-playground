"""Native-policy destination macros checked at every declared physical substep."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .policy_constrained_routing_d import PolicyConstrainedRoutingRequestD, _policy_route_domain
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class MacroPatrolD(FrozenModel):
    identity_ref: Ref
    cyclic_origins: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    body_offsets: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    substeps_per_pose: int = Field(ge=1)
    clock_substep: int = Field(ge=0)


class MacroEmitterD(FrozenModel):
    emitter_ref: Ref
    origin: tuple[int, int]
    exposed_offsets: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    period: int = Field(ge=1)
    active_phases: tuple[int, ...] = Field(default=(), max_length=4096)
    clock_phase: int = Field(ge=0)
    geometry_revision_ref: Ref


class DestinationMacroRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.destination_macro_request_d.v1'
    phase_ref: Literal['ONE_COMPLETE_DESTINATION_OR_WAIT_MACRO']
    channel: Literal['DESTINATION', 'WAIT']
    native_route_request: PolicyConstrainedRoutingRequestD | None
    node_positions: tuple[tuple[Ref, tuple[int, int]], ...] = Field(default=(), max_length=4096)
    actor_origin: tuple[int, int]
    actor_offsets: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    known_pixels: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    terrain_blocked_pixels: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    patrols: tuple[MacroPatrolD, ...] = Field(default=(), max_length=128)
    emitters: tuple[MacroEmitterD, ...] = Field(default=(), max_length=128)
    travel_substeps_per_edge: int = Field(ge=1)
    wait_substeps: int = Field(ge=0)
    refused_macro_substeps: int = Field(ge=0)
    native_input_debit: int = Field(ge=0)
    refused_input_debit: int = Field(ge=0)
    remaining_resource: int
    goal_origin: tuple[int, int] | None
    goal_requires_arrival: bool
    terminal_priority: tuple[Literal['CONTACT', 'EXPOSURE', 'GOAL', 'DEPLETION'], ...]
    depletion_at_zero: bool
    restoration_on: tuple[Literal['CONTACT', 'EXPOSURE', 'DEPLETION'], ...]
    restored_actor_origin: tuple[int, int]
    restored_patrols: tuple[MacroPatrolD, ...] = Field(default=(), max_length=128)
    restored_emitters: tuple[MacroEmitterD, ...] = Field(default=(), max_length=128)
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.reactive_graph_navigation.destination_macro_external_primitive', 'STEP'),)

    @model_validator(mode='after')
    def complete_timing_contract(self):
        if set(self.terminal_priority) != {'CONTACT', 'EXPOSURE', 'GOAL', 'DEPLETION'} or len(self.terminal_priority) != 4:
            raise ValueError('exact contact/exposure/goal/depletion checkpoint priority required')
        if any(e.clock_phase >= e.period or any(p < 0 or p >= e.period for p in e.active_phases) for e in self.emitters):
            raise ValueError('emitter phase outside period')
        if len({p.identity_ref for p in self.patrols}) != len(self.patrols) or len({e.emitter_ref for e in self.emitters}) != len(self.emitters):
            raise ValueError('patrol/emitter identities duplicated')
        return self


def measure_destination_macro_d(request: DestinationMacroRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        paths, accepted = [None], True
        positions = dict(request.node_positions)
        if request.channel == 'DESTINATION':
            route = request.native_route_request
            if route is None or route.scope != request.scope or route.graph_role != 'PHYSICAL_PASSAGE' or route.destination_ref is None:
                return d_result(request, 'NEEDS_EVIDENCE', 'CURRENT_NATIVE_PHYSICAL_ROUTE_REQUIRED')
            if len(route.policies) != 1 or route.policies[0].neighbor_order is None:
                return d_result(request, 'NEEDS_EVIDENCE', 'NATIVE_ROUTE_TIE_ORDER_REQUIRED')
            paths = _policy_route_domain(route, route.policies[0], route.origin_ref, route.destination_ref, budget)
            if not paths: paths, accepted = [None], False
            elif positions.get(route.origin_ref) != request.actor_origin or any(n not in positions for n in paths[0]):
                return d_result(request, 'NEEDS_EVIDENCE', 'ROUTE_EMBEDDING_MISMATCH')
        outcomes = []
        for path in paths:
            # Materialize only one native deterministic route, never route permutations.
            trace, origin, boundary, unknown = [], request.actor_origin, None, ()
            if request.channel == 'WAIT': count = request.wait_substeps
            elif not accepted: count = request.refused_macro_substeps
            else: count = (len(path)-1)*request.travel_substeps_per_edge
            if count > request.depth_bound:
                raise DComputationInterrupted('MACRO_PHYSICS_SUBSTEP_BOUND', {'required_substeps': count})
            debit = request.native_input_debit if accepted else request.refused_input_debit
            resource = request.remaining_resource-debit
            for elapsed in range(count+1):
                budget.visit({'stage': 'complete_macro_substep', 'elapsed': elapsed})
                if elapsed and request.channel == 'DESTINATION' and accepted:
                    edge, step = divmod(elapsed-1, request.travel_substeps_per_edge)
                    a, b = positions[path[edge]], positions[path[edge+1]]
                    numerator = step+1
                    offsets = tuple((b[i]-a[i])*numerator for i in (0, 1))
                    if any(v % request.travel_substeps_per_edge for v in offsets):
                        return d_result(request, 'NEEDS_EVIDENCE', 'TRAVEL_QUANTUM_NOT_EXACTLY_EMBEDDED')
                    origin = tuple(a[i]+offsets[i]//request.travel_substeps_per_edge for i in (0, 1))
                body = {(origin[0]+dx, origin[1]+dy) for dx, dy in request.actor_offsets}
                unknown = tuple(sorted(body-set(request.known_pixels)))
                if unknown: boundary = 'UNKNOWN'; break
                terrain = tuple(sorted(body & set(request.terrain_blocked_pixels)))
                contacts, exposure, patrol_positions = [], [], []
                for patrol in request.patrols:
                    budget.visit({'stage': 'shared_patrol_clock', 'identity_ref': patrol.identity_ref})
                    index = ((patrol.clock_substep+elapsed)//patrol.substeps_per_pose) % len(patrol.cyclic_origins)
                    pose = patrol.cyclic_origins[index]
                    patrol_positions.append((patrol.identity_ref, pose))
                    pixels = {(pose[0]+dx, pose[1]+dy) for dx, dy in patrol.body_offsets}
                    if body & pixels: contacts.append(patrol.identity_ref)
                for emitter in request.emitters:
                    budget.visit({'stage': 'full_footprint_emitter', 'emitter_ref': emitter.emitter_ref})
                    phase = (emitter.clock_phase+elapsed) % emitter.period
                    if phase in emitter.active_phases and any((emitter.origin[0]+dx, emitter.origin[1]+dy) in body for dx, dy in emitter.exposed_offsets):
                        exposure.append(emitter.emitter_ref)
                arrived = request.channel == 'DESTINATION' and accepted and elapsed == count
                goal = request.goal_origin is not None and origin == request.goal_origin and (arrived or not request.goal_requires_arrival)
                depleted = resource <= 0 if request.depletion_at_zero else resource < 0
                for check in request.terminal_priority:
                    if check == 'CONTACT' and (contacts or terrain) or check == 'EXPOSURE' and exposure or check == 'GOAL' and goal or check == 'DEPLETION' and depleted:
                        boundary = check; break
                trace.append({'elapsed_substeps': elapsed, 'actor_origin': origin, 'patrol_positions': tuple(patrol_positions),
                    'contact_refs': tuple(contacts), 'exposure_refs': tuple(exposure), 'terrain_contact_pixels': terrain,
                    'arrival_checkpoint': arrived, 'boundary': boundary})
                if boundary is not None: break
            final_elapsed = trace[-1]['elapsed_substeps'] if trace else 0
            restored = boundary in request.restoration_on
            outcomes.append({'actor_origin': request.restored_actor_origin if restored else origin, 'pre_restore_origin': origin,
                'patrols': request.restored_patrols if restored else tuple(p.model_copy(update={'clock_substep': p.clock_substep+final_elapsed}) for p in request.patrols),
                'emitters': request.restored_emitters if restored else tuple(e.model_copy(update={'clock_phase': (e.clock_phase+final_elapsed)%e.period}) for e in request.emitters),
                'executed_timed_prefix': tuple(trace), 'elapsed_model_substeps': final_elapsed, 'boundary': boundary,
                'unknown_actor_pixels': unknown, 'accepted': accepted, 'remaining_resource': resource,
                'primitive_debit': debit, 'restoration_applied': restored})
        budget.finish()
        complete = all(o['boundary'] != 'UNKNOWN' for o in outcomes)
        return d_result(request, 'COMPLETE' if complete else 'NEEDS_EVIDENCE', 'FULL_TIMED_MACRO_DOMAIN',
            complete=complete, examined=budget.examined, values={'outcome_domain': tuple(outcomes),
            'external_inputs': 1, 'displayed_samples_used_as_safety_proof': False})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            frontier={'restart_atomic_macro': True, 'work': error.frontier, 'additional_actual_command_debit': False})
