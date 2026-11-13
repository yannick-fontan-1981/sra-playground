"""Persistent body velocities, oriented endpoints and inventory in one input."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class PersistentBodyD(FrozenModel):
    identity_ref: Ref
    origin: tuple[int, int]
    velocity: tuple[int, int]
    offsets: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    gravity_delta: tuple[int, int]
    drag_numerator: int = Field(ge=0)
    drag_denominator: int = Field(ge=1)
    drag_rounding: Literal['FLOOR', 'TRUNCATE']
    admitted_pixels: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)


class OrientedEndpointD(FrozenModel):
    endpoint_ref: Ref
    origin: tuple[int, int]
    activation_offsets: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    paired_endpoint_ref: Ref
    outgoing_offset: tuple[int, int]
    velocity_matrix: tuple[tuple[int, int], tuple[int, int]]


class BodyPlateD(FrozenModel):
    plate_ref: Ref
    pixels: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    admitted_body_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    minimum_touching_bodies: int = Field(ge=1)


class BodyDoorD(FrozenModel):
    door_ref: Ref
    pixels: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    required_plate_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    plate_join: Literal['AND', 'OR']
    open: bool
    occupied_old_open_latch_supported: bool


class PersistentBodyPrimitiveRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.persistent_body_primitive_request_d.v1'
    phase_ref: Literal['ONE_PERSISTENT_BODY_INPUT']
    actor_ref: Ref
    bodies: tuple[PersistentBodyD, ...] = Field(min_length=1, max_length=128)
    carried_ref: Ref | None
    carry_offset: tuple[int, int]
    native_focus_ref: Ref | None
    endpoints: tuple[OrientedEndpointD, ...] = Field(default=(), max_length=128)
    disarmed_endpoint_by_body: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=128)
    plates: tuple[BodyPlateD, ...] = Field(default=(), max_length=128)
    doors: tuple[BodyDoorD, ...] = Field(default=(), max_length=128)
    terrain_blocked_pixels: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    hazard_pixels: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    hazard_body_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    hazards_during_motion: bool
    input_kind: Literal['MOVE', 'JUMP', 'SHOT', 'SELECT', 'PICKUP', 'DROP']
    input_velocity_delta: tuple[int, int]
    input_velocity_rule: Literal['ADD', 'SET']
    bound_body_ref: Ref | None
    bound_endpoint_ref: Ref | None
    shot_target: tuple[int, int] | None
    shot_admitted_pixels: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    shot_blocking_pixels: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    pickup_maximum_l1_distance: int = Field(ge=0)
    pickup_admitted_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    drop_inherits_actor_velocity: bool
    jump_support_delta: tuple[int, int]
    microstep_count: int = Field(ge=0, le=4096)
    refused_microstep_count: int = Field(ge=0, le=4096)
    zero_time_phase_order: tuple[Literal['TRANSPORT','PLATES_DOORS','HAZARDS'], ...]
    phase_order: tuple[Literal['ACTOR', 'FREE_BODIES', 'TRANSPORT', 'PLATES_DOORS', 'HAZARDS'], ...]
    axis_order: tuple[Literal[0, 1], Literal[0, 1]]
    endpoint_rearm_on_departure: bool
    input_debit: int = Field(ge=0)
    refused_debit: int = Field(ge=0)
    remaining_resource: int
    target_body_origins: tuple[tuple[Ref, tuple[int, int]], ...] = Field(default=(), max_length=128)
    required_carried_ref: Ref | None
    terminal_priority: tuple[Literal['HAZARD', 'GOAL', 'DEPLETION'], ...]
    goal_predicate_bound: bool
    depletion_at_zero: bool
    restored_bodies: tuple[PersistentBodyD, ...] | None
    restored_carried_ref: Ref | None
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.ballistic_targeting.persistent_body_external_primitive', 'STEP'),)

    @model_validator(mode='after')
    def persistent_domains(self):
        ids = {b.identity_ref for b in self.bodies}
        endpoints = {e.endpoint_ref for e in self.endpoints}
        if len(ids) != len(self.bodies) or self.actor_ref not in ids or self.carried_ref is not None and self.carried_ref not in ids:
            raise ValueError('actor/inventory identities outside persistent population')
        if len(endpoints) != len(self.endpoints) or any(e.paired_endpoint_ref not in endpoints for e in self.endpoints):
            raise ValueError('oriented endpoint pair unbound')
        if set(self.phase_order) != {'ACTOR', 'FREE_BODIES', 'TRANSPORT', 'PLATES_DOORS', 'HAZARDS'} or len(self.phase_order) != 5:
            raise ValueError('complete supported microstep order required')
        if set(self.axis_order) != {0, 1}: raise ValueError('exact collision-axis order required')
        if set(self.terminal_priority) != {'HAZARD', 'GOAL', 'DEPLETION'} or len(self.terminal_priority) != 3:
            raise ValueError('complete terminal priority required')
        return self


def _persistent_pixels(body, origin=None):
    p = body.origin if origin is None else origin
    return {(p[0]+dx, p[1]+dy) for dx, dy in body.offsets}


def _body_drag(value, body):
    numerator = value*body.drag_numerator
    if body.drag_rounding == 'FLOOR': return numerator//body.drag_denominator
    return (-1 if numerator < 0 else 1)*(abs(numerator)//body.drag_denominator)


def _body_shot_ray(origin, destination, budget, depth_bound):
    x, y = origin; tx, ty = destination
    dx, dy = abs(tx-x), -abs(ty-y)
    sx, sy = (1 if x < tx else -1), (1 if y < ty else -1)
    error, points = dx+dy, []
    for index in range(depth_bound+1):
        budget.visit({'stage': 'shot_channel_ray', 'point': (x,y)})
        points.append((x,y))
        if (x,y) == destination: return tuple(points)
        twice = 2*error
        if twice >= dy: error += dy; x += sx
        if twice <= dx: error += dx; y += sy
    raise DComputationInterrupted('SHOT_RAY_DEPTH_BOUND', {})


def measure_persistent_body_primitive_d(request: PersistentBodyPrimitiveRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        bodies = {b.identity_ref: b for b in request.bodies}
        endpoints = {e.endpoint_ref: e for e in request.endpoints}
        disarmed = dict(request.disarmed_endpoint_by_body)
        doors = request.doors
        carried, focus, accepted = request.carried_ref, request.native_focus_ref, True
        events, boundary = [], None
        actor = bodies[request.actor_ref]
        if request.input_kind in ('MOVE', 'JUMP'):
            if request.input_kind == 'JUMP':
                support = set(request.terrain_blocked_pixels)|{p for d in doors if not d.open for p in d.pixels}
                accepted = any((p[0]+request.jump_support_delta[0],p[1]+request.jump_support_delta[1]) in support for p in _persistent_pixels(actor))
            if accepted:
                velocity = request.input_velocity_delta if request.input_velocity_rule == 'SET' else tuple(actor.velocity[i]+request.input_velocity_delta[i] for i in (0,1))
                bodies[request.actor_ref] = actor.model_copy(update={'velocity': velocity})
        elif request.input_kind == 'SELECT':
            accepted = request.bound_endpoint_ref in endpoints or request.bound_body_ref in bodies
            if accepted: focus = request.bound_endpoint_ref or request.bound_body_ref
        elif request.input_kind == 'SHOT':
            accepted = request.bound_endpoint_ref in endpoints and request.shot_target is not None
            if accepted:
                ray = _body_shot_ray(actor.origin, request.shot_target, budget, request.depth_bound)
                accepted = request.shot_target in request.shot_admitted_pixels and not set(ray[1:])&set(request.shot_blocking_pixels)
                if accepted:
                    endpoint = endpoints[request.bound_endpoint_ref]
                    endpoints[endpoint.endpoint_ref] = endpoint.model_copy(update={'origin': request.shot_target})
                    events.append({'cause': 'ENDPOINT_REASSIGNED_BEFORE_PHYSICS', 'endpoint_ref': endpoint.endpoint_ref, 'ray': ray})
        elif request.input_kind == 'PICKUP':
            body = bodies.get(request.bound_body_ref)
            accepted = carried is None and body is not None and body.identity_ref != request.actor_ref and body.identity_ref in request.pickup_admitted_refs and sum(
                abs(body.origin[i]-actor.origin[i]) for i in (0,1)) <= request.pickup_maximum_l1_distance
            if accepted: carried = body.identity_ref
        else:
            accepted = carried is not None
            if accepted:
                body = bodies[carried]
                velocity = tuple(actor.velocity[i]+request.input_velocity_delta[i] for i in (0,1)) if request.drop_inherits_actor_velocity else request.input_velocity_delta
                bodies[carried] = body.model_copy(update={'origin': tuple(actor.origin[i]+request.carry_offset[i] for i in (0,1)), 'velocity': velocity})
                events.append({'cause': 'INVENTORY_RELEASE_INTO_FREE_DYNAMICS', 'body_ref': carried})
                carried = None
        resource = request.remaining_resource-(request.input_debit if accepted else request.refused_debit)
        elapsed_microsteps=request.microstep_count if accepted else request.refused_microstep_count
        if elapsed_microsteps > request.depth_bound: raise DComputationInterrupted('PERSISTENT_MICROSTEP_BOUND', {})
        begun_microsteps,completed_microsteps=0,0
        for tick in range(max(1,elapsed_microsteps)):
            if elapsed_microsteps:begun_microsteps+=1
            for phase in (request.phase_order if elapsed_microsteps else request.zero_time_phase_order):
                budget.visit({'stage': 'persistent_body_phase', 'tick': tick, 'phase': phase})
                if phase in ('ACTOR', 'FREE_BODIES'):
                    refs = (request.actor_ref,) if phase == 'ACTOR' else tuple(r for r in sorted(bodies) if r not in (request.actor_ref, carried))
                    for ref in refs:
                        body = bodies[ref]
                        velocity = [_body_drag(body.velocity[i]+body.gravity_delta[i],body) for i in (0,1)]
                        origin = list(body.origin)
                        for axis in request.axis_order:
                            if abs(velocity[axis]) > request.depth_bound: raise DComputationInterrupted('BODY_AXIS_DISPLACEMENT_BOUND', {'body_ref':ref})
                            sign = 1 if velocity[axis] >= 0 else -1
                            for distance in range(abs(velocity[axis])):
                                budget.visit({'stage':'full_body_collision_microquantum','body_ref':ref,'axis':axis})
                                target = list(origin); target[axis] += sign
                                pixels = _persistent_pixels(body, tuple(target))
                                if ref == request.actor_ref and carried is not None:
                                    pixels |= _persistent_pixels(bodies[carried],tuple(target[i]+request.carry_offset[i] for i in (0,1)))
                                blockers = set(request.terrain_blocked_pixels)|{p for d in doors if not d.open for p in d.pixels}
                                blockers.update(p for other,b in sorted(bodies.items()) if other not in (ref,carried) for p in _persistent_pixels(b))
                                if not pixels<=set(body.admitted_pixels) or pixels&blockers:
                                    velocity[axis]=0; break
                                origin=target
                                if request.hazards_during_motion and ref in request.hazard_body_refs and pixels&set(request.hazard_pixels):
                                    boundary='HAZARD'; break
                            if boundary: break
                        bodies[ref]=body.model_copy(update={'origin':tuple(origin),'velocity':tuple(velocity)})
                        if ref == request.actor_ref and carried is not None:
                            bodies[carried]=bodies[carried].model_copy(update={'origin':tuple(origin[i]+request.carry_offset[i] for i in (0,1))})
                        events.append({'cause':'PERSISTENT_BODY_MICROSTEP','body_ref':ref,'origin':tuple(origin),'velocity':tuple(velocity),'tick':tick})
                        if boundary: break
                elif phase == 'TRANSPORT':
                    for ref in sorted(bodies):
                        if ref == carried: continue
                        body = bodies[ref]
                        matches=[e for _,e in sorted(endpoints.items()) if body.origin in {(e.origin[0]+x,e.origin[1]+y) for x,y in e.activation_offsets}]
                        if len(matches)>1:return d_result(request,'NEEDS_EVIDENCE','OVERLAPPING_ENDPOINT_ADMISSION')
                        if not matches:
                            if request.endpoint_rearm_on_departure:disarmed.pop(ref,None)
                            continue
                        entry=matches[0]
                        if disarmed.get(ref)==entry.endpoint_ref:continue
                        exit_endpoint=endpoints[entry.paired_endpoint_ref]
                        destination=tuple(exit_endpoint.origin[i]+exit_endpoint.outgoing_offset[i] for i in (0,1))
                        footprint=_persistent_pixels(body,destination)
                        if ref==request.actor_ref and carried is not None:
                            footprint|=_persistent_pixels(bodies[carried],tuple(destination[i]+request.carry_offset[i] for i in (0,1)))
                        blocked=set(request.terrain_blocked_pixels)|{p for d in doors if not d.open for p in d.pixels}
                        blocked.update(p for other,b in sorted(bodies.items()) if other not in (ref,carried) for p in _persistent_pixels(b))
                        if not footprint<=set(body.admitted_pixels) or footprint&blocked:continue
                        matrix=entry.velocity_matrix
                        velocity=tuple(sum(matrix[i][j]*body.velocity[j] for j in (0,1)) for i in (0,1))
                        bodies[ref]=body.model_copy(update={'origin':destination,'velocity':velocity})
                        disarmed[ref]=exit_endpoint.endpoint_ref
                        if ref==request.actor_ref and carried is not None:
                            bodies[carried]=bodies[carried].model_copy(update={'origin':tuple(destination[i]+request.carry_offset[i] for i in (0,1))})
                        events.append({'cause':'ORIENTED_BODY_TRANSPORT','body_ref':ref,'entry_ref':entry.endpoint_ref,'exit_ref':exit_endpoint.endpoint_ref,'tick':tick})
                elif phase == 'PLATES_DOORS':
                    active={plate.plate_ref:sum(bool(_persistent_pixels(bodies[r])&set(plate.pixels)) for r in plate.admitted_body_refs if r in bodies)>=plate.minimum_touching_bodies for plate in request.plates}
                    changed=[]
                    for door in doors:
                        if any(r not in active for r in door.required_plate_refs):return d_result(request,'NEEDS_EVIDENCE','DOOR_PLATE_CHANNEL_UNBOUND')
                        signal=all(active[r] for r in door.required_plate_refs) if door.plate_join=='AND' else any(active[r] for r in door.required_plate_refs)
                        occupied=any(_persistent_pixels(b)&set(door.pixels) for _,b in sorted(bodies.items()))
                        opened=signal or door.open and occupied and door.occupied_old_open_latch_supported
                        changed.append(door.model_copy(update={'open':opened}))
                    doors=tuple(changed)
                else:
                    if any(_persistent_pixels(bodies[r])&set(request.hazard_pixels) for r in request.hazard_body_refs if r in bodies):boundary='HAZARD'
                if boundary: break
            if boundary: break
            if elapsed_microsteps:completed_microsteps+=1
        exact=request.goal_predicate_bound and all(ref in bodies and bodies[ref].origin==origin for ref,origin in request.target_body_origins) and (
            request.required_carried_ref is None or carried==request.required_carried_ref)
        depleted=resource<=0 if request.depletion_at_zero else resource<0
        hazard=boundary=='HAZARD'
        boundary=None
        for condition in request.terminal_priority:
            if condition=='HAZARD' and hazard or condition=='GOAL' and exact or condition=='DEPLETION' and depleted:boundary=condition;break
        budget.finish()
        failed=boundary in ('HAZARD','DEPLETION')
        return d_result(request,'COMPLETE','PERSISTENT_BODY_SUCCESSOR',complete=True,examined=budget.examined,values={
            'bodies':tuple(bodies[b.identity_ref] for b in request.bodies),'carried_ref':carried,'native_focus_ref':focus,
            'endpoints':tuple(e for _,e in sorted(endpoints.items())),'doors':doors,'disarmed_endpoint_by_body':tuple(sorted(disarmed.items())),
            'ordered_event_delta':tuple(events),'accepted':accepted,'remaining_resource':resource,'boundary':boundary,
            'restored_bodies':request.restored_bodies if failed else None,'restored_carried_ref':request.restored_carried_ref if failed else None,
            'external_inputs':1,'begun_microsteps':begun_microsteps,'completed_microsteps':completed_microsteps,
            'requested_microsteps':elapsed_microsteps,'residual_velocity_discarded':False,'carried_body_simulated_as_free':False})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,
            frontier={'restart_atomic_persistent_packet':True,'work':error.frontier,'actual_parent_input_replayed':False})
