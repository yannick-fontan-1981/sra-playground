"""Finite simultaneous vacancy, direct adhesion and physical gravity images.

No freely chosen member move, indirect glue relay or route search is introduced.
Exact scoped operations and all laws come from SRC/DRM; complete external input
uses the existing one-word debit/verdict transaction, never a second settle.
"""

from __future__ import annotations

from typing import ClassVar, Literal
from pydantic import Field

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows,
    d_resumable_frontier, d_map,
)

Point = tuple[int, int]


class GravityBody(FrozenModel):
    member_ref: Ref
    type_ref: Ref
    offsets: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    evidence_ref: Ref


class GravityPose(FrozenModel):
    member_ref: Ref
    anchor: Point
    latched: bool


class GravityMarkerLayer(FrozenModel):
    """Source-bound marker sample in the body's declared physical coordinates."""
    marker_ref: Ref
    member_ref: Ref
    model_ref: Ref | None = None
    cells: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    evidence_ref: Ref
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    status: Literal['OBSERVED', 'SUPPORTED_HYPOTHESIS']
    falsifier_ref: Ref | None = None


class GravityWall(FrozenModel):
    wall_ref: Ref
    type_ref: Ref
    cells: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    evidence_ref: Ref


class GravityState(FrozenModel):
    poses: tuple[GravityPose, ...] = Field(min_length=1, max_length=128)
    gravity: Point
    adhesion_on: bool
    reserve: int = Field(ge=0)
    terminated: bool
    memory: FrozenMap = Field(default_factory=FrozenMap)


class GravityModel(FrozenModel):
    model_ref: Ref
    height: int = Field(ge=1, le=256)
    width: int = Field(ge=1, le=256)
    bodies: tuple[GravityBody, ...] = Field(min_length=1, max_length=128)
    walls: tuple[GravityWall, ...] = Field(default=(), max_length=128)
    obstacles: tuple[Point, ...] = Field(default=(), max_length=4096)
    compatible_types: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=256)
    boundary_law_ref: Ref | None = None
    vacancy_law_ref: Ref | None = None
    contact_law_ref: Ref | None = None
    contact_phase_ref: Ref | None = None
    toggle_law_ref: Ref | None = None
    direction_law_ref: Ref | None = None
    micro_step_bound: int = Field(ge=1, le=4096)
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=16)
    stationary_direction_cost_law_ref: Ref | None = None
    terminal_order_ref: Ref | None = None
    reset_state: GravityState | None = None
    reset_cost: int | None = Field(default=None, ge=0)
    reset_lifecycle_ref: Literal['active', 'accepted', 'exhausted'] | None = None
    reset_contract_ref: Ref | None = None
    reset_evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=64)


class GravityControl(FrozenModel):
    control_ref: Ref
    kind_ref: Ref
    direction: Point | None = None
    action_ref: Ref | None = None
    payload: FrozenMap = Field(default_factory=FrozenMap)
    evidence_revision_ref: Ref | None = None


class GravityConstraint(FrozenModel):
    constraint_ref: Ref
    kind_ref: Ref
    member_ref: Ref | None = None
    member_type_ref: Ref | None = None
    quantifier_ref: Literal['ALL', 'ANY']
    wall_ref: Ref | None = None
    required_anchor: Point | None = None
    required_value: bool | None = None
    cells: tuple[Point, ...] = Field(default=(), max_length=4096)


class GravityStartControl(FrozenModel):
    candidate_ref: Ref
    state: GravityState
    control: GravityControl


class GravityWord(FrozenModel):
    word_ref: Ref
    controls: tuple[GravityControl, ...] = Field(min_length=1, max_length=4096)


_CASES = (
    ('boundary_crate_scene', 'MEASURE'), ('direct_wall_contacts', 'MEASURE'),
    ('directional_vacancy_dependencies', 'STEP_INTERNAL'), ('gravity_settlement', 'STEP_INTERNAL'),
    ('global_glue_transaction', 'STEP_INTERNAL'), ('gravity_adhesion_successor', 'STEP'),
    ('adhesion_staging_preimages', 'INVERSE_DOMAIN'), ('adhesion_viability_domain', 'DOMAIN'),
    ('gravity_input_budget_compile', 'COMPILE'), ('adhesion_path_compare', 'COMPARE'),
)


class CoupledMemberRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.coupled_member_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.coupled_member_control.{operation}', mode) for operation, mode in _CASES) + (
        ('mechanics.gravity_adhesion.external_primitive', 'STEP'),)
    models: tuple[GravityModel, ...] = Field(default=(), max_length=32)
    state: GravityState | None = None
    control: GravityControl | None = None
    candidates: tuple[GravityStartControl, ...] = Field(default=(), max_length=4096)
    available_controls: tuple[GravityControl, ...] = Field(default=(), max_length=16)
    comparison_constraints: tuple[GravityConstraint, ...] = Field(default=(), max_length=256)
    preservation_constraints: tuple[GravityConstraint, ...] = Field(default=(), max_length=256)
    service_consumer_ref: Ref | None = None
    words: tuple[GravityWord, ...] = Field(default=(), max_length=3)
    # None is an unknown marker layer, not evidence that no marker exists.
    scene_markers: tuple[GravityMarkerLayer, ...] | None = Field(default=None, max_length=4096)


class GravityPrerequisite(Exception):
    def __init__(self, cause, frontier=None):
        super().__init__(cause)
        self.frontier = frontier if frontier is not None else d_map()


_DIRECTIONS = ((-1, 0), (1, 0), (0, -1), (0, 1))


def _geometry(model, state, budget):
    if model.height * model.width > budget.request.domain_bound:
        raise DComputationInterrupted('GRAVITY_CELL_DOMAIN_BOUND', d_map())
    if model.boundary_law_ref != 'bounded_nonwrapping_solid':
        raise GravityPrerequisite('BOUNDED_NONWRAPPING_PHYSICAL_DOMAIN_NOT_SUPPORTED')
    if state.gravity not in _DIRECTIONS:
        raise GravityPrerequisite('CURRENT_GRAVITY_NOT_A_SUPPORTED_CARDINAL_STEP')
    bodies = {body.member_ref: body for body in model.bodies}
    poses = {pose.member_ref: pose for pose in state.poses}
    if len(bodies) != len(model.bodies) or len(poses) != len(state.poses) or set(bodies) != set(poses):
        raise GravityPrerequisite('FULL_STABLE_MEMBER_POPULATION_NOT_BOUND')
    obstacles = set(model.obstacles)
    if len(obstacles) != len(model.obstacles):
        raise GravityPrerequisite('OBSTACLE_SUPPORT_NOT_UNIQUE')
    for row, column in obstacles:
        budget.visit()
        if not 0 <= row < model.height or not 0 <= column < model.width:
            raise GravityPrerequisite('OBSTACLE_OUTSIDE_CURRENT_PHYSICAL_DOMAIN')
    walls, wall_points = {}, set()
    for wall in model.walls:
        if wall.wall_ref in walls or len(set(wall.cells)) != len(wall.cells):
            raise GravityPrerequisite('PHYSICAL_WALL_IDENTITY_OR_SUPPORT_NOT_UNIQUE')
        for row, column in wall.cells:
            budget.visit()
            if not -1 <= row <= model.height or not -1 <= column <= model.width:
                raise GravityPrerequisite('PHYSICAL_WALL_NOT_IN_DECLARED_BOUNDARY_SUPPORT')
        walls[wall.wall_ref] = wall
        wall_points.update(wall.cells)
    occupied, supports = {}, {}
    for ref, body in sorted(bodies.items()):
        if len(set(body.offsets)) != len(body.offsets):
            raise GravityPrerequisite('FULL_LOGICAL_BODY_OFFSETS_NOT_UNIQUE')
        if poses[ref].latched and not state.adhesion_on:
            raise GravityPrerequisite('LATCHED_BODY_IN_UNSUPPORTED_OFF_MODE')
        ar, ac = poses[ref].anchor
        support = set()
        for dr, dc in body.offsets:
            budget.visit({'member_ref': ref})
            point = ar + dr, ac + dc
            if not 0 <= point[0] < model.height or not 0 <= point[1] < model.width:
                raise GravityPrerequisite('FULL_BODY_OCCUPANCY_OUTSIDE_WORLD')
            if point in occupied or point in obstacles or point in wall_points:
                raise GravityPrerequisite('CURRENT_MEMBER_OCCUPANCY_COLLISION')
            occupied[point] = ref
            support.add(point)
        supports[ref] = frozenset(support)
    return bodies, poses, occupied, supports, frozenset(obstacles | wall_points), walls


def _boundary_scene(model, request, budget):
    """Measure supplied layered geometry; do not classify pixels or infer identity."""
    if request.state is None:
        raise GravityPrerequisite('FULL_CURRENT_MEMBER_STATE_MISSING')
    bodies, poses, occupied, supports, _, walls = _geometry(model, request.state, budget)
    markers_by_member = {ref: [] for ref in bodies}
    known_layers = request.scene_markers is not None
    marker_keys = set()
    model_refs = set()
    for item in request.models:
        budget.visit({'model_ref': item.model_ref})
        model_refs.add(item.model_ref)
    for marker in request.scene_markers or ():
        budget.visit({'marker_ref': marker.marker_ref})
        for _ in marker.cells:
            budget.visit({'marker_ref': marker.marker_ref})
        key = marker.model_ref, marker.marker_ref
        if key in marker_keys or len(set(marker.cells)) != len(marker.cells):
            raise GravityPrerequisite('SCENE_MARKER_IDENTITY_OR_CELLS_NOT_UNIQUE')
        marker_keys.add(key)
        if marker.model_ref is not None and marker.model_ref not in model_refs:
            raise GravityPrerequisite('SCENE_MARKER_MODEL_NOT_RETAINED')
        if marker.status == 'SUPPORTED_HYPOTHESIS' and (marker.model_ref is None or not marker.falsifier_ref):
            raise GravityPrerequisite('SCENE_MARKER_HYPOTHESIS_MODEL_OR_FALSIFIER_MISSING')
        if marker.model_ref is not None and marker.model_ref != model.model_ref:
            continue
        if (marker.epoch != request.scope.epoch
                or marker.evidence_revision_ref != request.scope.evidence_revision_ref):
            raise GravityPrerequisite('SCENE_MARKER_EVIDENCE_SCOPE_MISMATCH')
        if marker.member_ref not in bodies:
            raise GravityPrerequisite('SCENE_MARKER_MEMBER_NOT_IN_FULL_POPULATION')
        membership = []
        for cell in marker.cells:
            budget.visit({'marker_ref': marker.marker_ref})
            membership.append((cell, cell in supports[marker.member_ref]))
        markers_by_member[marker.member_ref].append(d_map({
            'source_marker': marker, 'cell_membership': tuple(membership),
            'all_marker_cells_inside_full_body': all(inside for _, inside in membership),
            'historical_identity_proved': False}))
    candidates = []
    for ref, body in sorted(bodies.items()):
        budget.visit({'member_ref': ref})
        candidates.append(d_map({'member_ref': ref, 'source_type_ref': body.type_ref,
            'source_body_evidence_ref': body.evidence_ref, 'pose': poses[ref],
            'full_cells': tuple(sorted(supports[ref])),
            'marker_layers_known': known_layers,
            'marker_layers': tuple(markers_by_member[ref]),
            'marker_does_not_remove_occupancy': True,
            'observed_marker_does_not_confirm_historical_identity': True}))
    controls = tuple(request.available_controls)
    control_domain_known = 'available_controls' in request.model_fields_set
    for control in controls:
        budget.visit({'control_ref': control.control_ref})
        if control.evidence_revision_ref != request.scope.evidence_revision_ref:
            raise GravityPrerequisite('SCENE_CONTROL_EVIDENCE_REVISION_MISMATCH')
    return {'layered_member_candidates': tuple(candidates),
        'full_occupancy': tuple((point, ref) for point, ref in sorted(occupied.items())),
        'obstacle_cells': tuple(sorted(model.obstacles)),
        'physical_boundary_candidates': tuple(walls[ref] for ref in sorted(walls)),
        'reserve': request.state.reserve, 'gravity': request.state.gravity,
        'global_adhesion_mode': request.state.adhesion_on,
        'control_candidates': controls,
        'control_domain_known': control_domain_known,
        'scene_marker_layer_known': known_layers,
        'calibration_unknown_refs': (
            *(( 'SCENE_MARKER_LAYER_NOT_OBSERVED',) if not known_layers else ()),
            *(( 'CONTROL_DOMAIN_NOT_OBSERVED',) if not control_domain_known else ())),
        'physical_role_or_historical_identity_confirmed': False}


def _contacts(model, state, budget):
    bodies, _, _, supports, _, walls = _geometry(model, state, budget)
    if model.contact_law_ref not in ('any_exposed_face_cell', 'entire_exposed_face'):
        raise GravityPrerequisite('DIRECT_WALL_CONTACT_CRITERION_MISSING')
    rows = []
    for ref in sorted(bodies):
        body, support = bodies[ref], supports[ref]
        for direction in _DIRECTIONS:
            face = tuple(sorted(point for point in support
                if (point[0] + direction[0], point[1] + direction[1]) not in support))
            hits, covered = [], set()
            for wall_ref in sorted(walls):
                wall = walls[wall_ref]
                wall_support = frozenset(wall.cells)
                touched = []
                for point in face:
                    budget.visit({'member_ref': ref, 'wall_ref': wall.wall_ref})
                    if (point[0] + direction[0], point[1] + direction[1]) in wall_support:
                        touched.append(point)
                compatible = (body.type_ref, wall.type_ref) in model.compatible_types
                if touched:
                    hits.append(d_map({'wall_ref': wall.wall_ref, 'wall_type_ref': wall.type_ref,
                        'face_points': tuple(touched), 'type_compatible': compatible,
                        'wall_evidence_ref': wall.evidence_ref}))
                if compatible:
                    covered.update(touched)
            admissible = bool(covered) if model.contact_law_ref == 'any_exposed_face_cell' else bool(face) and set(face) <= covered
            rows.append(d_map({'member_ref': ref, 'direction': direction, 'face_support': face,
                'direct_wall_hits': tuple(hits), 'admissible': admissible,
                'member_evidence_ref': body.evidence_ref}))
    return tuple(rows)


def _acquire(model, state, budget):
    if not state.adhesion_on:
        return state, ()
    contacts = _contacts(model, state, budget)
    touching = {row['member_ref'] for row in contacts if row['admissible']}
    acquired = tuple(pose.member_ref for pose in state.poses if not pose.latched and pose.member_ref in touching)
    following = state.model_copy(update={'poses': tuple(pose.model_copy(update={'latched': True})
        if pose.member_ref in touching else pose for pose in state.poses)})
    return following, acquired


def _micro_step(model, state, budget):
    if model.vacancy_law_ref != 'simultaneous_uniform_translation_vacancy':
        raise GravityPrerequisite('SIMULTANEOUS_VACANCY_POLICY_MISSING')
    if model.contact_phase_ref not in ('after_simultaneous_micro_step', 'before_and_after_simultaneous_micro_step'):
        raise GravityPrerequisite('CONTACT_MICRO_STEP_PRIORITY_MISSING')
    current, pre_latches = state, ()
    if model.contact_phase_ref == 'before_and_after_simultaneous_micro_step':
        current, pre_latches = _acquire(model, state, budget)
    _, poses, occupied, supports, barriers, _ = _geometry(model, current, budget)
    dependencies, blockers = {}, {}
    direction = current.gravity
    for ref in sorted(poses):
        dependent, blocked = set(), []
        if poses[ref].latched:
            blocked.append('latched')
        for point in sorted(supports[ref]):
            budget.visit({'member_ref': ref, 'source_point': point})
            destination = point[0] + direction[0], point[1] + direction[1]
            if not 0 <= destination[0] < model.height or not 0 <= destination[1] < model.width:
                blocked.append(('physical_boundary', destination))
            elif destination in barriers:
                blocked.append(('obstacle_or_wall', destination))
            elif destination in occupied and occupied[destination] != ref:
                dependent.add(occupied[destination])
        dependencies[ref], blockers[ref] = dependent, blocked
    # Greatest vacancy closure: peers vacate in the same tick. Removing a
    # statically blocked peer propagates blocking, never sequential motion.
    movable = {ref for ref in poses if not blockers[ref]}
    while True:
        removed = set()
        for ref in sorted(movable):
            budget.visit({'vacancy_member_ref': ref})
            if not dependencies[ref] <= movable:
                removed.add(ref)
        if not removed:
            break
        movable.difference_update(removed)
    following = current.model_copy(update={'poses': tuple(pose.model_copy(update={
        'anchor': (pose.anchor[0] + direction[0], pose.anchor[1] + direction[1])})
        if pose.member_ref in movable else pose for pose in current.poses)})
    following, post_latches = _acquire(model, following, budget)
    _geometry(model, following, budget)
    return {'before_state': state, 'state': following, 'moved_member_refs': tuple(sorted(movable)),
        'dependencies': tuple((ref, tuple(sorted(dependencies[ref]))) for ref in sorted(poses)),
        'local_blockers': tuple((ref, tuple(blockers[ref])) for ref in sorted(poses)),
        'dependency_blocked_member_refs': tuple(ref for ref in sorted(poses) if ref not in movable and not blockers[ref]),
        'pre_latch_acquisitions': pre_latches, 'post_latch_acquisitions': post_latches,
        'movement_is_one_simultaneous_tick': True}


def _settle(model, state, request, budget):
    current, trace = state, []
    _geometry(model, current, budget)
    bound = min(model.micro_step_bound, request.depth_bound)
    for index in range(bound):
        budget.visit({'micro_step_index': index})
        result = _micro_step(model, current, budget)
        trace.append(d_map(result))
        following = result['state']
        if following.poses == current.poses:
            return {'state': following, 'micro_trace': tuple(trace), 'stationary': True,
                'micro_steps': len(trace), 'external_input_count': 0}
        current = following
    raise DComputationInterrupted('GRAVITY_MICRO_STEP_LIMIT', d_map({'last_state': current,
        'completed_micro_steps': len(trace), 'unfinished_physical_image_not_released': True}))


def _toggle(model, state, budget):
    _geometry(model, state, budget)
    if model.toggle_law_ref != 'off_releases_all_on_captures_direct_contacts':
        raise GravityPrerequisite('SUPPORTED_GLOBAL_TOGGLE_PREPHASE_MISSING')
    if state.adhesion_on:
        released = tuple(pose.member_ref for pose in state.poses if pose.latched)
        following = state.model_copy(update={'adhesion_on': False,
            'poses': tuple(pose.model_copy(update={'latched': False}) for pose in state.poses)})
        acquired = ()
    else:
        released = ()
        following, acquired = _acquire(model, state.model_copy(update={'adhesion_on': True}), budget)
    return {'state': following, 'latch_acquisitions': acquired, 'latch_releases': released,
        'gravity_preserved': following.gravity == state.gravity, 'settlement_not_yet_performed': True,
        'external_input_count': 0}


def _physical_successor(model, state, control, request, budget):
    if state.terminated:
        raise GravityPrerequisite('OFFICIAL_TERMINATION_REVOKES_GRAVITY_INPUT')
    _geometry(model, state, budget)
    direct = None
    if control.kind_ref == 'direction':
        if model.direction_law_ref != 'direction_sets_persistent_gravity' or control.direction not in _DIRECTIONS:
            raise GravityPrerequisite('SUPPORTED_DIRECTION_CONTROL_LAW_MISSING')
        current = state.model_copy(update={'gravity': control.direction})
    elif control.kind_ref == 'adhesion_toggle':
        direct = _toggle(model, state, budget)
        current = direct['state']
    else:
        raise GravityPrerequisite('PHYSICAL_CONTROL_KIND_UNSUPPORTED_NO_FREE_MEMBER_MOVE')
    settled = _settle(model, current, request, budget)
    return {'state': settled['state'], 'direct_prephase': None if direct is None else d_map(direct),
        'settlement': d_map(settled), 'physical_image_complete': True,
        'external_debit_applied': False, 'reset_applied': False,
        'adapter_must_not_append_second_settlement': True}


def _constraints(model, state, constraints, budget):
    bodies, poses, occupied, _, _, _ = _geometry(model, state, budget)
    results = []
    contacts = None
    for constraint in constraints:
        budget.visit({'constraint_ref': constraint.constraint_ref})
        if constraint.kind_ref == 'corridor_clear':
            if not constraint.cells:
                raise GravityPrerequisite('REQUIRED_CORRIDOR_SUPPORT_MISSING')
            for row, column in constraint.cells:
                budget.visit()
                if not 0 <= row < model.height or not 0 <= column < model.width:
                    raise GravityPrerequisite('REQUIRED_CORRIDOR_OUTSIDE_SUPPORTED_WORLD')
            values = tuple(((row, column), (row, column) not in occupied)
                for row, column in constraint.cells)
        elif constraint.kind_ref == 'adhesion_mode':
            if constraint.required_value is None:
                raise GravityPrerequisite('REQUIRED_MODE_VALUE_MISSING')
            values = (('global_mode', state.adhesion_on == constraint.required_value),)
        else:
            if constraint.member_ref is not None and constraint.member_type_ref is not None:
                raise GravityPrerequisite('MEMBER_SELECTOR_AMBIGUOUS')
            refs = tuple(ref for ref in sorted(bodies) if constraint.member_ref == ref or (
                constraint.member_ref is None and constraint.member_type_ref == bodies[ref].type_ref))
            if not refs:
                raise GravityPrerequisite('REQUIRED_MEMBER_POPULATION_NOT_BOUND')
            values = []
            for ref in refs:
                if constraint.kind_ref == 'anchor_equals':
                    if constraint.required_anchor is None:
                        raise GravityPrerequisite('REQUIRED_ANCHOR_MISSING')
                    value = poses[ref].anchor == constraint.required_anchor
                elif constraint.kind_ref == 'latch_equals':
                    if constraint.required_value is None:
                        raise GravityPrerequisite('REQUIRED_LATCH_VALUE_MISSING')
                    value = poses[ref].latched == constraint.required_value
                elif constraint.kind_ref == 'direct_admissible_wall_contact':
                    if contacts is None:
                        contacts = _contacts(model, state, budget)
                    value = any(row['member_ref'] == ref and row['admissible'] and (
                        constraint.wall_ref is None or any(hit['wall_ref'] == constraint.wall_ref and hit['type_compatible']
                            for hit in row['direct_wall_hits'])) for row in contacts)
                else:
                    raise GravityPrerequisite('DECLARED_COMPARISON_RELATION_UNSUPPORTED')
                values.append((ref, value))
        truth = all(value for _, value in values) if constraint.quantifier_ref == 'ALL' else any(value for _, value in values)
        results.append(d_map({'constraint_ref': constraint.constraint_ref, 'member_values': tuple(values),
            'quantifier_ref': constraint.quantifier_ref, 'value': truth}))
    return tuple(results)


def _cost(model, before, after, control):
    costs = tuple(cost for kind, cost in model.input_costs if kind == control.kind_ref)
    if len(costs) != 1 or costs[0] < 0:
        raise GravityPrerequisite('EXACT_EXTERNAL_INPUT_COST_MISSING')
    cost = costs[0]
    if control.kind_ref == 'direction':
        if model.stationary_direction_cost_law_ref == 'accepted_input_even_when_stationary':
            pass
        elif model.stationary_direction_cost_law_ref == 'charge_only_if_member_pose_changes':
            if tuple(pose.anchor for pose in before.poses) == tuple(pose.anchor for pose in after.poses):
                cost = 0
        else:
            raise GravityPrerequisite('STATIONARY_DIRECTION_DEBIT_CONTRACT_MISSING')
    return cost


def _preservation_image(model, physical, constraints, budget):
    states = []
    if physical.get('direct_prephase') is not None:
        states.append(('direct_prephase', physical['direct_prephase']['state']))
    settlement = physical.get('settlement')
    if settlement is not None:
        states.extend((index, row['state']) for index, row in enumerate(settlement['micro_trace']))
    if not states:
        states.append(('returned_state', physical['state']))
    return tuple(d_map({'phase': phase, 'constraints': _constraints(model,
        state if isinstance(state, GravityState) else GravityState.model_validate(state), constraints, budget)})
        for phase, state in states)


def _compile_word(model, state, word, request, budget):
    if len(word.controls) > request.depth_bound:
        raise DComputationInterrupted('GRAVITY_WORD_PRIMITIVE_BOUND', d_map({'word_ref': word.word_ref}))
    if not request.comparison_constraints:
        raise GravityPrerequisite('SUPPORTED_TERMINAL_COMPARISON_CONTRACT_MISSING')
    if model.terminal_order_ref not in ('acceptance_before_exhaustion', 'exhaustion_before_acceptance'):
        raise GravityPrerequisite('GRAVITY_TERMINAL_BUDGET_PRIORITY_MISSING')
    current, prefix, rows, cost = state, [], [], 0
    for index, control in enumerate(word.controls):
        before_input = current
        budget.visit({'word_ref': word.word_ref, 'primitive_index': index})
        if current.terminated:
            return {'word_ref': word.word_ref, 'native_prefix': tuple(prefix), 'prefix_results': tuple(rows),
                'cost': cost, 'word_complete': False, 'terminal_interruption_index': index}
        if control.action_ref is None or control.evidence_revision_ref != request.scope.evidence_revision_ref:
            raise GravityPrerequisite('CURRENT_NATIVE_GRAVITY_INPUT_BINDING_MISSING')
        if control.kind_ref == 'reset':
            if model.reset_state is None or model.reset_cost is None:
                raise GravityPrerequisite('INDEPENDENT_RESET_IMAGE_AND_COST_MISSING')
            after, debit = model.reset_state, model.reset_cost
            _geometry(model, after, budget)
            physical = {'state': after, 'reset_image_only': True, 'reset_executed': False}
        else:
            physical = _physical_successor(model, current, control, request, budget)
            after = physical['state']
            debit = _cost(model, current, after, control)
        if debit > current.reserve and control.kind_ref != 'reset':
            return {'word_ref': word.word_ref, 'native_prefix': tuple(prefix), 'prefix_results': tuple(rows),
                'cost': cost, 'word_complete': False, 'over_budget_index': index,
                'first_unreleased_control_ref': control.control_ref}
        preserved = _preservation_image(model, physical, request.preservation_constraints, budget)
        if any(not row['value'] for phase in preserved for row in phase['constraints']):
            return {'word_ref': word.word_ref, 'native_prefix': tuple(prefix), 'prefix_results': tuple(rows),
                'cost': cost, 'word_complete': False, 'preservation_failure_index': index,
                'preservation_constraints': preserved}
        comparisons = _constraints(model, after, request.comparison_constraints, budget)
        reserve = after.reserve if control.kind_ref == 'reset' else current.reserve - debit
        accepted = all(row['value'] for row in comparisons)
        exhausted = reserve == 0
        if model.terminal_order_ref == 'exhaustion_before_acceptance' and exhausted:
            accepted = False
        current = after.model_copy(update={'reserve': reserve, 'terminated': accepted or exhausted})
        cost += debit
        prefix.append(d_map({'action_ref': control.action_ref, 'payload': control.payload}))
        rows.append(d_map({'control_ref': control.control_ref, 'physical_image': d_map(physical),
            'before_state': before_input, 'physical_after_state': after, 'state': current,
            'debit': debit, 'reserve': reserve, 'comparisons': comparisons,
            'preservation': preserved, 'accepted': accepted, 'exhausted': exhausted,
            'micro_steps_are_not_inputs': True}))
    return {'word_ref': word.word_ref, 'state': current, 'native_prefix': tuple(prefix),
        'prefix_results': tuple(rows), 'cost': cost, 'word_complete': True,
        'primitive_release_authorized': False}


def _external_primitive(model, state, control, request, budget):
    if control.action_ref is None or control.evidence_revision_ref != request.scope.evidence_revision_ref:
        raise GravityPrerequisite('CURRENT_NATIVE_GRAVITY_INPUT_BINDING_MISSING')
    if control.kind_ref == 'reset':
        if (model.reset_state is None or model.reset_cost is None or model.reset_lifecycle_ref is None
                or not model.reset_contract_ref or not model.reset_evidence_refs):
            raise GravityPrerequisite('INDEPENDENT_RESET_STATE_COST_LIFECYCLE_AND_EVIDENCE_MISSING')
        _geometry(model, model.reset_state, budget)
        return {'state': model.reset_state, 'before_state': state, 'primitive_complete': True,
            'phase_snapshots': d_map({'before': state, 'independent_reset': model.reset_state,
                'after_cost_and_verdict': model.reset_state}),
            'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref,
                'action_ref': control.action_ref, 'debit': model.reset_cost,
                'lifecycle_ref': model.reset_lifecycle_ref, 'accepted': model.reset_lifecycle_ref == 'accepted',
                'restoration_contract_ref': model.reset_contract_ref,
                'restoration_evidence_refs': model.reset_evidence_refs,
                'final_reserve_owned_by_reset_contract': True, 'automatic_pass_count': 0,
                'second_settlement_or_debit_forbidden': True})}
    word = GravityWord(word_ref=control.control_ref, controls=(control,))
    result = _compile_word(model, state, word, request, budget)
    if result.get('word_complete') is not True or len(result.get('prefix_results', ())) != 1:
        raise GravityPrerequisite('GRAVITY_PRIMITIVE_NOT_COMPLETED_WITHIN_CURRENT_CONTRACT',
            d_map({'single_control_partial_result': result, 'primitive_not_committed': True}))
    event = result['prefix_results'][0]
    physical = event['physical_image']
    return {'state': result['state'], 'before_state': state, 'primitive_complete': True,
        'physical_image': physical,
        'phase_snapshots': d_map({'before': state, 'after_physical_and_settlement': event['physical_after_state'],
            'after_cost_and_verdict': result['state']}),
        'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref,
            'action_ref': control.action_ref, 'debit': event['debit'],
            'accepted': event['accepted'], 'exhausted': event['exhausted'],
            'terminal_order_ref': model.terminal_order_ref,
            'micro_steps_are_not_inputs': True, 'second_settlement_or_debit_forbidden': True}),
        'comparisons': event['comparisons'], 'preservation': event['preservation']}


def _compare_path(model, request, budget):
    if not request.observations:
        raise GravityPrerequisite('SEALED_MEMBER_RESPONSE_PACKET_MISSING')
    rows, first = [], None
    for index, sample in enumerate(request.observations):
        budget.visit({'sample_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise GravityPrerequisite('GRAVITY_REPLY_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(name) is None for name in ('before_state', 'actual_state', 'expected_state')):
            raise GravityPrerequisite('BEFORE_ACTUAL_EXPECTED_GRAVITY_STATES_MISSING')
        before = GravityState.model_validate(sample['before_state'])
        actual = GravityState.model_validate(sample['actual_state'])
        expected = GravityState.model_validate(sample['expected_state'])
        _, before_poses, _, _, _, _ = _geometry(model, before, budget)
        actual_refs = tuple(pose.member_ref for pose in actual.poses)
        expected_refs = tuple(pose.member_ref for pose in expected.poses)
        if len(set(actual_refs)) != len(actual_refs) or len(set(expected_refs)) != len(expected_refs):
            raise GravityPrerequisite('REPLY_MEMBER_IDENTITIES_NOT_UNIQUE')
        if set(actual_refs) != set(before_poses) or set(expected_refs) != set(before_poses):
            if first is None:
                first = index
            rows.append(d_map({'sample_index': index,
                'actual_missing_member_refs': tuple(sorted(set(before_poses) - set(actual_refs))),
                'actual_added_member_refs': tuple(sorted(set(actual_refs) - set(before_poses))),
                'expected_population_difference_refs': tuple(sorted(set(expected_refs) ^ set(before_poses))),
                'unqualified_new_population_geometry': True,
                'sealed_frame_does_not_add_an_input': True}))
            continue
        _, actual_poses, _, _, _, _ = _geometry(model, actual, budget)
        _, expected_poses, _, _, _, _ = _geometry(model, expected, budget)
        acquired = tuple(ref for ref in sorted(actual_poses) if actual_poses[ref].latched and not before_poses[ref].latched)
        released = tuple(ref for ref in sorted(actual_poses) if before_poses[ref].latched and not actual_poses[ref].latched)
        moved = tuple(ref for ref in sorted(actual_poses) if actual_poses[ref].anchor != before_poses[ref].anchor)
        mismatches = tuple(ref for ref in sorted(actual_poses) if actual_poses[ref] != expected_poses[ref])
        fields = tuple(name for name in ('gravity', 'adhesion_on', 'reserve', 'terminated', 'memory')
            if getattr(actual, name) != getattr(expected, name))
        gross_events = sample.get('latch_events')
        distinct_events = {}
        if gross_events is not None:
            for event in gross_events:
                budget.visit({'latch_event_ref': event.get('event_ref')})
                if (not event.get('event_ref') or not event.get('evidence_ref') or
                    event.get('event_owner_ref') != request.scope.event_owner_ref or
                    event.get('member_ref') not in before_poses or
                    event.get('kind_ref') not in ('latch_acquired', 'latch_released')):
                    raise GravityPrerequisite('OBSERVED_LATCH_EVENT_PROVENANCE_NOT_QUALIFIED')
                ref = event['event_ref']
                if ref in distinct_events and distinct_events[ref] != event:
                    raise GravityPrerequisite('DUPLICATE_LATCH_EVENT_HAS_CONTRARY_CONTENT')
                distinct_events[ref] = event
        if first is None and (mismatches or fields):
            first = index
        before_relations = _constraints(model, before, request.comparison_constraints, budget)
        after_relations = _constraints(model, actual, request.comparison_constraints, budget)
        rows.append(d_map({'sample_index': index, 'moved_member_refs': moved,
            'latch_acquisitions': acquired, 'latch_releases': released,
            'endpoint_latch_change_count': len(acquired) + len(released),
            'gross_latch_change_count': None if gross_events is None else len(distinct_events),
            'gross_latch_acquisition_count': None if gross_events is None else sum(
                distinct_events[ref]['kind_ref'] == 'latch_acquired' for ref in sorted(distinct_events)),
            'gross_latch_release_count': None if gross_events is None else sum(
                distinct_events[ref]['kind_ref'] == 'latch_released' for ref in sorted(distinct_events)),
            'gross_events_unknown': gross_events is None,
            'net_latch_count_delta': len(acquired) - len(released),
            'mismatching_member_refs': mismatches, 'mismatching_state_fields': fields,
            'lost_relation_refs': tuple(row['constraint_ref'] for old, row in zip(before_relations, after_relations)
                if old['value'] and not row['value']),
            'restored_relation_refs': tuple(row['constraint_ref'] for old, row in zip(before_relations, after_relations)
                if not old['value'] and row['value']),
            'sealed_frame_does_not_add_an_input': True}))
    return {'packet_deltas': tuple(rows), 'first_divergence_index': first,
        'relation_quantifiers_preserved_not_replaced_by_historical_occupant': True}


def measure_coupled_member_control(request: CoupledMemberRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget = DWorkBudget(request)
    operation = request.operation_ref.rsplit('.', 1)[-1]
    rows, current_model_ref = [], None
    try:
        if not request.models:
            raise GravityPrerequisite('SCOPED_GRAVITY_CONTACT_MODELS_MISSING')
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            if operation == 'boundary_crate_scene':
                row = _boundary_scene(model, request, budget)
            elif operation == 'adhesion_path_compare':
                row = _compare_path(model, request, budget)
            elif operation == 'adhesion_staging_preimages':
                if not request.candidates or not request.comparison_constraints or request.service_consumer_ref != request.scope.parent_consumer_ref:
                    raise GravityPrerequisite('STAGING_DOMAIN_RELATIONS_AND_ACTUAL_CONSUMER_MISSING')
                if len(request.candidates) > request.domain_bound or len(set(item.candidate_ref for item in request.candidates)) != len(request.candidates):
                    raise GravityPrerequisite('STAGING_DOMAIN_BOUND_OR_CANDIDATE_IDENTITY_MISMATCH')
                candidates = []
                for candidate in request.candidates:
                    budget.visit({'candidate_ref': candidate.candidate_ref})
                    image = _physical_successor(model, candidate.state, candidate.control, request, budget)
                    relations = _constraints(model, image['state'], request.comparison_constraints, budget)
                    preservation = _preservation_image(model, image, request.preservation_constraints, budget)
                    candidates.append(d_map({'candidate_ref': candidate.candidate_ref, 'start': candidate.state,
                        'control': candidate.control, 'end': image['state'], 'relations': relations,
                        'preservation': preservation, 'matches_requested_relations': all(result['value'] for result in relations)
                            and all(result['value'] for phase in preservation for result in phase['constraints'])}))
                row = {'candidate_triples': tuple(candidates), 'service_consumer_ref': request.service_consumer_ref,
                    'empty_sample_is_not_global_impossibility': True}
            else:
                if request.state is None:
                    raise GravityPrerequisite('FULL_CURRENT_MEMBER_STATE_MISSING')
                if operation == 'direct_wall_contacts':
                    row = {'direct_contact_rows': _contacts(model, request.state, budget), 'peer_contacts_are_not_wall_contacts': True}
                elif operation == 'directional_vacancy_dependencies':
                    row = _micro_step(model, request.state, budget)
                elif operation == 'gravity_settlement':
                    row = _settle(model, request.state, request, budget)
                elif operation == 'global_glue_transaction':
                    row = _toggle(model, request.state, budget)
                elif operation == 'gravity_adhesion_successor':
                    if request.control is None:
                        raise GravityPrerequisite('SOURCE_BOUND_PHYSICAL_CONTROL_MISSING')
                    row = _physical_successor(model, request.state, request.control, request, budget)
                elif operation == 'external_primitive':
                    if request.control is None:
                        raise GravityPrerequisite('SOURCE_BOUND_PHYSICAL_CONTROL_MISSING')
                    row = _external_primitive(model, request.state, request.control, request, budget)
                elif operation == 'adhesion_viability_domain':
                    _geometry(model, request.state, budget)
                    if not request.available_controls or not request.comparison_constraints:
                        raise GravityPrerequisite('SEARCH_CONTROL_AND_COMPARISON_DOMAIN_MISSING')
                    row = {'joint_state': request.state, 'supported_model': model,
                        'available_controls': request.available_controls,
                        'comparison_constraints': request.comparison_constraints,
                        'preservation_constraints': request.preservation_constraints,
                        'domain_bound': request.domain_bound, 'witness_limit': 3,
                        'successor_operation_ref': 'mechanics.coupled_member_control.gravity_adhesion_successor',
                        'type_quotient_applied': False, 'recursive_search_launched': False}
                elif operation == 'gravity_input_budget_compile':
                    if not request.words:
                        raise GravityPrerequisite('SOURCE_REQUESTED_GRAVITY_WORDS_MISSING')
                    words = []
                    for word in request.words:
                        try:
                            image = _compile_word(model, request.state, word, request, budget)
                            words.append(d_map(image))
                        except GravityPrerequisite as error:
                            words.append(d_map({'word_ref': word.word_ref, 'unresolved_prerequisite': str(error)}))
                    row = {'word_results': tuple(words), 'word_selection_authorized': False}
                else:
                    return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'COMPLETE', 'REQUESTED_FINITE_CALCULATION_RETURNED',
            values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except GravityPrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
    except DComputationInterrupted as error:
        return d_result(request, 'NEEDS_EVIDENCE', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
