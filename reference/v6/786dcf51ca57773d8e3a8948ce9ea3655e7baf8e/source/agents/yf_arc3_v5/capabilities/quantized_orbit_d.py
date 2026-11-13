"""Exact table-driven tangencies and autonomous runs under caller-bound laws."""
from __future__ import annotations
from itertools import product
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request,
    d_result, d_input_digest, d_map)


class OrbitPoseD(FrozenModel):
    position: tuple[int, int]
    heading: Ref


class OrbitSampleD(FrozenModel):
    offset: tuple[int, int]
    heading: Ref


class OrbitTableD(FrozenModel):
    table_ref: Ref
    post_type_ref: Ref
    sign: Literal[-1, 1]
    samples: tuple[OrbitSampleD, ...] = Field(min_length=2, max_length=4096)
    quantization_evidence_ref: Ref


class OrbitPostD(FrozenModel):
    identity_ref: Ref
    type_ref: Ref
    center: tuple[int, int]
    collision_offsets: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)


class OrbitArcD(FrozenModel):
    post_ref: Ref
    table_ref: Ref
    sample_index: int = Field(ge=0)


class OrbitExitD(FrozenModel):
    heading: Ref
    axis: Literal[0, 1]
    direction: Literal[-1, 1]
    threshold: int
    cross_interval: tuple[int, int]


class OrbitHeadingMaskD(FrozenModel):
    heading: Ref
    offsets: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    evidence_ref: Ref


class OrbitRasterContactD(FrozenModel):
    """V2 internal contact profile; legacy world-coordinate mode is separate."""
    schema_version: Literal['yf_arc3_v5.orbit_raster_contact_d.v2'] = 'yf_arc3_v5.orbit_raster_contact_d.v2'
    coordinate_scale: int = Field(ge=1, le=4096)
    position_rounding: Literal['EXACT', 'FLOOR', 'CEIL', 'NEAREST_TIES_EVEN', 'NEAREST_TIES_POSITIVE']
    declared_heading_domain: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    heading_masks: tuple[OrbitHeadingMaskD, ...] = Field(min_length=1, max_length=128)
    mask_units: Literal['RASTER_PIXELS']
    terrain_units: Literal['RASTER_PIXELS']
    post_center_units: Literal['MODEL_COORDINATES']
    scale_evidence_ref: Ref
    quantization_evidence_ref: Ref

    @model_validator(mode='after')
    def declared_mask_coverage(self):
        refs=tuple(m.heading for m in self.heading_masks)
        if (len(set(self.declared_heading_domain))!=len(self.declared_heading_domain)
                or len(set(refs))!=len(refs) or set(refs)!=set(self.declared_heading_domain)):
            raise ValueError('exact unique mask coverage of the declared heading domain required')
        if any(len(set(m.offsets))!=len(m.offsets) for m in self.heading_masks):
            raise ValueError('unique occupied offsets per heading required')
        return self


class OrbitWorldD(FrozenModel):
    posts: tuple[OrbitPostD, ...] = Field(default=(), max_length=128)
    tables: tuple[OrbitTableD, ...] = Field(min_length=1, max_length=128)
    straight_increments: tuple[tuple[Ref, tuple[int, int]], ...] = Field(min_length=1, max_length=128)
    body_offsets: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    blocked_pixels: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    known_pixels: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    exits: tuple[OrbitExitD, ...] = Field(default=(), max_length=128)
    event_priority: tuple[Literal['COLLISION', 'EXIT', 'ENGAGEMENT'], ...]
    post_order_known: bool
    cooldown_release_law: Literal['NOT_LATERAL', 'DISTANCE_SQUARED_GT']
    cooldown_distance_squared: int = Field(ge=0)
    opposite_tolerance_squared: int = Field(ge=0)
    opposite_conflict_supported: bool
    # Optional V2 raster contact law. None preserves legacy contact semantics,
    # not the old serialized ABI or old-source qualification.
    raster_contact: OrbitRasterContactD | None = None

    @model_validator(mode='after')
    def finite_exact_world(self):
        if len({p.identity_ref for p in self.posts}) != len(self.posts):
            raise ValueError('post identities must be unique')
        if len({t.table_ref for t in self.tables}) != len(self.tables):
            raise ValueError('table identities must be unique')
        if len({(t.post_type_ref,t.samples[0].offset,t.samples[0].heading) for t in self.tables})!=len(self.tables):
            raise ValueError('one exact arc law per typed tangency required')
        increments = dict(self.straight_increments)
        if len(increments) != len(self.straight_increments) or any(v == (0, 0) for v in sorted(increments.values())):
            raise ValueError('one nonzero exact increment per heading')
        if set(self.event_priority) != {'COLLISION', 'EXIT', 'ENGAGEMENT'} or len(self.event_priority) != 3:
            raise ValueError('collision/exit/engagement priority must be a permutation')
        if any(s.heading not in increments for t in self.tables for s in t.samples):
            raise ValueError('table headings require exact straight increments')
        if self.raster_contact is not None and not set(self.raster_contact.declared_heading_domain)<=set(increments):
            raise ValueError('declared raster headings must belong to the motion heading domain')
        return self


class OrbitStateD(FrozenModel):
    pose: OrbitPoseD
    active_arc: OrbitArcD | None
    cooldown_ref: Ref | None
    command_ref: Ref
    substep_index: int = Field(ge=0)
    event_prefix: tuple[FrozenMap, ...] = Field(default=(), max_length=100000)


class LateralOrbitEngagementRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.lateral_orbit_engagement_request_d.v1'
    phase_ref: Literal['READ_ONLY_PRE_ENGAGEMENT']
    query_scope: Literal['current_pose', 'first_straight_event']
    state: OrbitStateD
    world: OrbitWorldD
    straight_interval_substeps: int | None = Field(default=None, ge=0, le=4096)
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (('mechanics.autonomous_route_intervention.lateral_orbit_engagement', 'PRECONDITION'),)


class QuantizedOrbitStepRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.quantized_orbit_step_request_d.v1'
    phase_ref: Literal['ONE_QUANTIZED_SUBSTEP']
    state: OrbitStateD
    world: OrbitWorldD
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (('mechanics.autonomous_route_intervention.quantized_orbit_step', 'STEP_INTERNAL'),)


class OrbitExternalPrimitiveRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.orbit_external_primitive_request_d.v1'
    phase_ref: Literal['COMPLETE_AUTONOMOUS_LAUNCH']
    state: OrbitStateD
    world: OrbitWorldD
    model_run_limit: int = Field(ge=1, le=100000)
    loop_signature_fields: tuple[Literal['POSE', 'ARC', 'COOLDOWN'], ...]
    failure_restores_pose: bool
    failure_restores_editing: bool
    saved_editing_posts: tuple[OrbitPostD, ...] = Field(default=(), max_length=128)
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (('mechanics.autonomous_route_intervention.orbit_external_primitive', 'STEP'),)


class OrbitPlacementDomainD(FrozenModel):
    identity_ref: Ref
    type_domain: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    center_domain: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    collision_offsets: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    editable: bool


class StaticOrbitPreimagesRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.static_orbit_preimages_request_d.v1'
    phase_ref: Literal['STATIC_COUNTERFACTUAL_ARRANGEMENTS']
    launch: OrbitExternalPrimitiveRequestD
    placement_domains: tuple[OrbitPlacementDomainD, ...] = Field(min_length=1, max_length=128)
    type_inventory: tuple[tuple[Ref, int], ...]
    candidate_context_refs: tuple[Ref, ...] = Field(min_length=1, max_length=4096)
    requested_terminal_poses: tuple[OrbitPoseD, ...] = Field(min_length=1, max_length=128)
    relaxed_domain: bool
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (('mechanics.autonomous_route_intervention.static_orbit_preimages', 'INVERSE_DOMAIN'),)


def _orbit_bindings(state, world):
    posts = {p.identity_ref: p for p in world.posts}
    tables = {t.table_ref: t for t in world.tables}
    if state.pose.heading not in dict(world.straight_increments) or state.cooldown_ref is not None and state.cooldown_ref not in posts:
        raise ValueError('state references an unavailable heading/post')
    if state.active_arc is not None:
        arc = state.active_arc
        if arc.post_ref not in posts or arc.table_ref not in tables:
            raise ValueError('active arc references an unavailable binding')
        table, post = tables[arc.table_ref], posts[arc.post_ref]
        if table.post_type_ref != post.type_ref or arc.sample_index >= len(table.samples) - 1:
            raise ValueError('active arc type/progress mismatch')
        sample = table.samples[arc.sample_index]
        if state.pose.position != tuple(post.center[i] + sample.offset[i] for i in (0, 1)) or state.pose.heading != sample.heading:
            raise ValueError('active pose must equal the exact current sample')
    return posts, tables


def _tangencies(pose, world, budget):
    rows = []
    for p in world.posts:
        for t in world.tables:
            budget.visit({'stage': 'exact_table_tangency', 'post_ref': p.identity_ref, 'table_ref': t.table_ref})
            if t.post_type_ref == p.type_ref and t.samples[0].heading == pose.heading and pose.position == tuple(
                    p.center[i] + t.samples[0].offset[i] for i in (0, 1)):
                rows.append((p.identity_ref, t.table_ref, t.sign))
    return tuple(rows)


def _orbit_probe(state, world, budget):
    posts, _ = _orbit_bindings(state, world)
    tangencies = _tangencies(state.pose, world, budget)
    cooldown = state.cooldown_ref
    if cooldown is not None:
        p = posts[cooldown]
        distance = sum((p.center[i] - state.pose.position[i]) ** 2 for i in (0, 1))
        release = (not any(x[0] == cooldown for x in tangencies) if world.cooldown_release_law == 'NOT_LATERAL'
            else distance > world.cooldown_distance_squared)
        if release: cooldown = None
    conflicts = []
    anchors = (state.active_arc.post_ref,) if state.active_arc else tuple(x[0] for x in tangencies)
    if world.opposite_conflict_supported:
        for anchor in anchors:
            for p in world.posts:
                budget.visit({'stage': 'opposite_flank', 'anchor_ref': anchor, 'other_ref': p.identity_ref})
                if p.identity_ref == anchor: continue
                opposite = tuple(2 * state.pose.position[i] - posts[anchor].center[i] for i in (0, 1))
                if sum((p.center[i] - opposite[i]) ** 2 for i in (0, 1)) <= world.opposite_tolerance_squared:
                    conflicts.append((anchor, p.identity_ref))
    eligible = () if state.active_arc else tuple(x for x in tangencies if x[0] != cooldown)
    return {'eligible': eligible, 'conflicts': tuple(conflicts), 'proposed_cooldown_ref': cooldown,
        'conditional_release': state.cooldown_ref is not None and cooldown is None}


def _raster_coordinate(value, contact):
    q,r=divmod(value,contact.coordinate_scale)
    if contact.position_rounding=='EXACT':return q if r==0 else None
    if contact.position_rounding=='FLOOR':return q
    if contact.position_rounding=='CEIL':return q+int(r!=0)
    doubled=2*r
    if contact.position_rounding=='NEAREST_TIES_POSITIVE':return q+int(doubled>=contact.coordinate_scale)
    return q+int(doubled>contact.coordinate_scale or doubled==contact.coordinate_scale and q%2!=0)


def _raster_point(point,contact):
    result=tuple(_raster_coordinate(v,contact) for v in point)
    return None if any(v is None for v in result) else result


def _orbit_contact_projection(pose,world):
    contact=world.raster_contact
    if contact is None:
        return (tuple((pose.position[0]+dx,pose.position[1]+dy) for dx,dy in world.body_offsets),
            tuple(p.center for p in world.posts),None)
    masks={m.heading:m.offsets for m in contact.heading_masks}
    if pose.heading not in masks:
        return (),(),{'unresolved_heading_ref':pose.heading,'contact_contract_version':contact.schema_version}
    center=_raster_point(pose.position,contact)
    post_centers=tuple(_raster_point(p.center,contact) for p in world.posts)
    if center is None or any(c is None for c in post_centers):
        return (),(),{'unresolved_position_quantization':True,'contact_contract_version':contact.schema_version}
    return (tuple((center[0]+dx,center[1]+dy) for dx,dy in masks[pose.heading]),
        post_centers,None)


def _orbit_contacts(pose, world, budget, projection=None):
    if (world.raster_contact is None and not world.body_offsets) or not world.known_pixels:
        raise ValueError('physical propagation requires full body and known terrain domains')
    occupied,post_centers,unresolved=projection if projection is not None else _orbit_contact_projection(pose,world)
    if unresolved is not None:raise ValueError('unresolved raster contact domain')
    blocked = set(world.blocked_pixels)
    for center,post in zip(post_centers,world.posts):
        for dx,dy in post.collision_offsets:
            budget.visit({'stage': 'post_collision_mask', 'post_ref': post.identity_ref})
            blocked.add((center[0]+dx,center[1]+dy))
    known = set(world.known_pixels)
    budget.visit({'stage': 'full_body_contact', 'pose': pose.position})
    return tuple(p for p in occupied if p in blocked), tuple(p for p in occupied if p not in known)


def _orbit_exit(pose, world):
    return any(pose.heading == e.heading and pose.position[e.axis] * e.direction >= e.threshold * e.direction
        and e.cross_interval[0] <= pose.position[1-e.axis] <= e.cross_interval[1] for e in world.exits)


def _orbit_first_event(state, world, budget):
    projection=_orbit_contact_projection(state.pose,world)
    if projection[2] is not None:return 'UNKNOWN',projection[2]
    collision, unknown = _orbit_contacts(state.pose, world, budget,projection)
    probe = _orbit_probe(state, world, budget)
    if unknown: return 'UNKNOWN', {'unknown_pixels': unknown, 'probe': probe}
    for kind in world.event_priority:
        if kind == 'COLLISION' and collision: return kind, {'collision_pixels': collision, 'probe': probe}
        if kind == 'EXIT' and _orbit_exit(state.pose, world): return kind, {'probe': probe}
        if kind == 'ENGAGEMENT':
            if probe['conflicts']: return 'CONFLICT', {'probe': probe}
            if probe['eligible']: return 'ENGAGEMENT', {'probe': probe}
    return 'NONE', {'probe': probe}


def _orbit_substep(state, world, budget):
    posts, tables = _orbit_bindings(state, world)
    kind, detail = _orbit_first_event(state, world, budget)
    if kind in ('COLLISION', 'EXIT', 'CONFLICT', 'UNKNOWN'): return state, kind, detail
    probe = detail['probe']
    events = list(state.event_prefix)
    cooldown = probe['proposed_cooldown_ref']
    if probe['conditional_release']:
        events.append(d_map({'cause': 'PRE_ENGAGEMENT_RELEASE', 'post_ref': state.cooldown_ref, 'substep': state.substep_index}))
    arc = state.active_arc
    if arc is None and probe['eligible']:
        if len(probe['eligible']) > 1 and not world.post_order_known:
            return state, 'AMBIGUOUS_ENGAGEMENT', detail
        post_ref, table_ref, sign = probe['eligible'][0]
        arc = OrbitArcD(post_ref=post_ref, table_ref=table_ref, sample_index=0)
        events.append(d_map({'cause': 'ARC_ENGAGEMENT', 'post_ref': post_ref, 'table_ref': table_ref, 'sign': sign, 'substep': state.substep_index}))
    if arc is None:
        increment = dict(world.straight_increments)[state.pose.heading]
        pose = state.pose.model_copy(update={'position': tuple(state.pose.position[i] + increment[i] for i in (0, 1))})
    else:
        table, post = tables[arc.table_ref], posts[arc.post_ref]
        index = arc.sample_index + 1
        sample = table.samples[index]
        pose = OrbitPoseD(position=tuple(post.center[i] + sample.offset[i] for i in (0, 1)), heading=sample.heading)
        if index == len(table.samples)-1:
            cooldown = arc.post_ref
            events.append(d_map({'cause': 'ARC_COMPLETION_COOLDOWN', 'post_ref': arc.post_ref, 'substep': state.substep_index + 1}))
            arc = None
        else: arc = arc.model_copy(update={'sample_index': index})
    events.append(d_map({'cause': 'PHYSICAL_SUBSTEP', 'pose': pose.model_dump(), 'substep': state.substep_index + 1}))
    after = state.model_copy(update={'pose': pose, 'active_arc': arc, 'cooldown_ref': cooldown,
        'substep_index': state.substep_index+1, 'event_prefix': tuple(events)})
    # Post-motion contact belongs to this substep; next engagement remains read-only.
    end_kind, end_detail = _orbit_first_event(after, world, budget)
    if end_kind == 'ENGAGEMENT': end_kind = 'NONE'
    return after, end_kind, end_detail


def measure_lateral_orbit_engagement_d(request: LateralOrbitEngagementRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        state = request.state
        if request.query_scope == 'current_pose':
            probe = _orbit_probe(state, request.world, budget)
            budget.finish()
            return d_result(request, 'COMPLETE', 'READ_ONLY_TANGENCY', complete=True, examined=budget.examined,
                values={'verdict': probe, 'input_state_unchanged': True})
        if request.query_scope == 'first_straight_event' and (request.straight_interval_substeps is None or state.active_arc is not None):
            return d_result(request, 'NEEDS_EVIDENCE', 'STRAIGHT_INTERVAL_REQUIRED')
        count = request.straight_interval_substeps if request.query_scope == 'first_straight_event' else 0
        if count > request.depth_bound:
            return d_result(request, 'BUDGET_REACHED', 'STRAIGHT_APPROACH_DEPTH_BOUND',
                frontier={'restart_read_only_query': True})
        prefix = []
        for distance in range(count+1):
            budget.visit({'stage': 'read_only_straight_approach', 'distance': distance})
            kind, detail = _orbit_first_event(state, request.world, budget)
            prefix.append(state.pose.model_dump())
            if kind != 'NONE' or distance == count:
                budget.finish()
                return d_result(request, 'NEEDS_EVIDENCE' if kind == 'UNKNOWN' else 'COMPLETE', kind,
                    complete=kind != 'UNKNOWN', examined=budget.examined, values={'event_distance': distance,
                    'first_event_pose': state.pose, 'approach_prefix': tuple(prefix), 'verdict': detail, 'input_state_unchanged': True})
            increment = dict(request.world.straight_increments)[state.pose.heading]
            state = state.model_copy(update={'pose': state.pose.model_copy(update={
                'position': tuple(state.pose.position[i]+increment[i] for i in (0, 1))}),
                'cooldown_ref': detail['probe']['proposed_cooldown_ref']})
    except (ValueError, KeyError) as error:
        return d_result(request, 'NEEDS_EVIDENCE', 'INVALID_ORBIT_BINDING', values={'error': str(error)})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined, frontier={'restart_read_only_query': True, 'work': error.frontier})


def measure_quantized_orbit_step_d(request: QuantizedOrbitStepRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        if request.resume_frontier:
            return d_result(request, 'NEEDS_EVIDENCE', 'ATOMIC_SUBSTEP_RESTART_REQUIRED')
        after, kind, detail = _orbit_substep(request.state, request.world, budget)
        budget.finish()
        uncertain = kind in ('UNKNOWN', 'AMBIGUOUS_ENGAGEMENT')
        return d_result(request, 'NEEDS_EVIDENCE' if uncertain else 'COMPLETE', kind, complete=not uncertain,
            examined=budget.examined, values={'state': after, 'event': detail, 'external_inputs_added': 0})
    except (ValueError, KeyError) as error:
        return d_result(request, 'NEEDS_EVIDENCE', 'INVALID_ORBIT_BINDING', values={'error': str(error)})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            frontier={'restart_atomic_substep': True, 'work': error.frontier})


def _orbit_signature(state, fields):
    return tuple((state.pose.position, state.pose.heading) if f == 'POSE' else
        ((state.active_arc.post_ref, state.active_arc.table_ref, state.active_arc.sample_index) if state.active_arc else None)
        if f == 'ARC' else state.cooldown_ref for f in fields)


def _orbit_run(request, budget, state, seen):
    if set(request.loop_signature_fields) != {'POSE', 'ARC', 'COOLDOWN'} or len(request.loop_signature_fields) != 3:
        raise ValueError('loop proof requires the complete physical state signature')
    while True:
        # Check the model boundary before applying an additional substep.
        kind, detail = _orbit_first_event(state, request.world, budget)
        if kind in ('COLLISION', 'EXIT', 'CONFLICT', 'UNKNOWN'): return state, seen, kind, detail
        signature = _orbit_signature(state, request.loop_signature_fields)
        if signature in seen: return state, seen, 'MODEL_LOOP', {}
        if state.substep_index >= request.model_run_limit: return state, seen, 'MODEL_RUN_LIMIT', {}
        # Atomic substep: on compute exhaustion the same state is retried, not its prefix.
        after, kind, detail = _orbit_substep(state, request.world, budget)
        if kind in ('AMBIGUOUS_ENGAGEMENT', 'UNKNOWN'): return state, seen, kind, detail
        seen.add(signature)
        state = after
        if kind != 'NONE': return state, seen, kind, detail


def measure_orbit_external_primitive_d(request: OrbitExternalPrimitiveRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    state, seen = request.state, set()
    try:
        digest = d_input_digest(request)
        if request.resume_frontier:
            frontier = request.resume_frontier
            if frontier.get('input_digest') != digest:
                return d_result(request, 'NEEDS_EVIDENCE', 'STALE_ORBIT_RESUME')
            state = OrbitStateD.model_validate(frontier['state'])
            # Frozen JSON converts tuples to lists; stable digest retains exact signatures.
            seen = set(frontier['seen_signature_digests'])
        # Digest signatures permit immutable JSON continuation without tuple rebuilding.
        from agents.yf_arc3_v5.logos.types import stable_digest
        while True:
            kind, detail = _orbit_first_event(state, request.world, budget)
            if kind in ('COLLISION', 'EXIT', 'CONFLICT', 'UNKNOWN'): break
            signature = stable_digest(_orbit_signature(state, request.loop_signature_fields))
            if set(request.loop_signature_fields) != {'POSE', 'ARC', 'COOLDOWN'} or len(request.loop_signature_fields) != 3:
                raise ValueError('complete loop signature required')
            if signature in seen: kind, detail = 'MODEL_LOOP', {}; break
            if state.substep_index >= request.model_run_limit: kind, detail = 'MODEL_RUN_LIMIT', {}; break
            after, kind, detail = _orbit_substep(state, request.world, budget)
            if kind in ('UNKNOWN', 'AMBIGUOUS_ENGAGEMENT'): break
            seen.add(signature)
            state = after
            if kind != 'NONE': break
        uncertain = kind in ('UNKNOWN', 'AMBIGUOUS_ENGAGEMENT')
        failed = kind in ('COLLISION', 'CONFLICT', 'MODEL_LOOP', 'MODEL_RUN_LIMIT')
        budget.finish()
        return d_result(request, 'NEEDS_EVIDENCE' if uncertain else 'COMPLETE', kind, complete=not uncertain,
            examined=budget.examined, values={'run_state': state, 'boundary': detail, 'trial_failed': failed,
            'restored_pose': request.state.pose if failed and request.failure_restores_pose else None,
            'restored_editing_posts': request.saved_editing_posts if failed and request.failure_restores_editing else None,
            'external_inputs': 1, 'model_time_substeps': state.substep_index-request.state.substep_index})
    except (ValueError, KeyError) as error:
        return d_result(request, 'NEEDS_EVIDENCE', 'INVALID_ORBIT_BINDING', values={'error': str(error)})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            values={'partial_state': state, 'trial_failed': False, 'restoration_applied': False},
            frontier={'input_digest': d_input_digest(request), 'state': state,
                'seen_signature_digests': tuple(sorted(seen)), 'work': error.frontier})


def measure_static_orbit_preimages_d(request: StaticOrbitPreimagesRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        domains = request.placement_domains
        if len({d.identity_ref for d in domains}) != len(domains): raise ValueError('duplicate static post identity')
        fixed = {p.identity_ref: p for p in request.launch.world.posts}
        if set(fixed) != {d.identity_ref for d in domains}: raise ValueError('all posts must remain in the static assignment')
        inventory = dict(request.type_inventory)
        if len(inventory) != len(request.type_inventory): raise ValueError('duplicate type inventory')
        choices = [tuple((t, c) for t in d.type_domain for c in d.center_domain) for d in domains]
        domain_size = 1
        for c in choices: domain_size *= len(c)
        if domain_size > request.domain_bound or len(request.candidate_context_refs) < domain_size:
            return d_result(request, 'NEEDS_EVIDENCE', 'FINITE_ASSIGNMENT_OR_CONTEXT_DOMAIN_INCOMPLETE')
        if len(set(request.candidate_context_refs)) != len(request.candidate_context_refs):
            raise ValueError('counterfactual event namespaces must be distinct')
        rows, witnesses = [], []
        for index, assignment in enumerate(product(*choices)):
            budget.visit({'stage': 'static_assignment', 'index': index})
            counts = {t: sum(pair[0] == t for pair in assignment) for t in inventory}
            if counts != inventory or any(t not in inventory for t, _ in assignment): continue
            posts = tuple(OrbitPostD(identity_ref=d.identity_ref, type_ref=t, center=c, collision_offsets=d.collision_offsets)
                for d, (t, c) in zip(domains, assignment))
            if any(not d.editable and (p.type_ref != fixed[d.identity_ref].type_ref or p.center != fixed[d.identity_ref].center)
                    for d, p in zip(domains, posts)): continue
            if len({p.center for p in posts}) != len(posts): continue
            candidate = request.launch.model_copy(update={'world': request.launch.world.model_copy(update={'posts': posts}),
                'state': request.launch.state.model_copy(update={'command_ref': request.candidate_context_refs[index],
                    'substep_index': 0, 'event_prefix': (), 'active_arc': None, 'cooldown_ref': None})})
            state, _, kind, detail = _orbit_run(candidate, budget, candidate.state, set())
            if kind in ('UNKNOWN', 'AMBIGUOUS_ENGAGEMENT'):
                return d_result(request, 'NEEDS_EVIDENCE', kind, examined=budget.examined,
                    values={'completed_assignment_rows': tuple(rows), 'unresolved_assignment': posts})
            feasible = kind == 'EXIT' and state.pose in request.requested_terminal_poses
            rows.append({'posts': posts, 'terminal_pose': state.pose, 'event': kind, 'feasible': feasible,
                'context_ref': candidate.state.command_ref, 'boundary': detail})
            if feasible and len(witnesses) < 3:
                witnesses.append({'posts': posts, 'trajectory_events': state.event_prefix,
                    'ordered_tangent_interfaces': tuple(e for e in state.event_prefix if e.get('cause') == 'ARC_ENGAGEMENT'),
                    'counterfactual_context_ref': candidate.state.command_ref})
        budget.finish()
        return d_result(request, 'COMPLETE', 'FINITE_STATIC_ORBIT_DOMAIN', complete=True, examined=budget.examined,
            values={'assignment_rows': tuple(rows), 'trajectory_witnesses': tuple(witnesses),
                'relaxed_domain': request.relaxed_domain, 'parent_actual_ledger_modified': False,
                'lower_bound_claimed': False, 'witness_limit': 3})
    except (ValueError, KeyError) as error:
        return d_result(request, 'NEEDS_EVIDENCE', 'INVALID_STATIC_DOMAIN', values={'error': str(error)})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            frontier={'restart_static_candidates': True, 'work': error.frontier, 'parent_actual_ledger_modified': False})
