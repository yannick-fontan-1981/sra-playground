"""Declared absolute reemission, analytic first impacts and synchronous shots.

Wires bind controls, not ray travel. Unknown numerical ties stay unresolved;
only the explicit source body is excluded and no preparation fires implicitly.
"""
from __future__ import annotations

from fractions import Fraction
from math import isqrt
from typing import ClassVar
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .optical_scene_a import OpticalSceneInputA, measure_optical_scene_a
from .optical_route_contracts_a import OpticalRouteInputA
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)

Ratio = tuple[int, int]
Vector = tuple[Ratio, Ratio]


class OpticalDirection(FrozenModel):
    direction_ref: Ref
    vector: Vector
    evidence_ref: Ref


class OpticalReceiver(FrozenModel):
    body_ref: Ref
    kind_ref: Ref
    center: Vector
    shape_ref: Ref
    radius: Ratio | None = None
    box_bounds: tuple[Ratio, Ratio, Ratio, Ratio] | None = None
    geometry_evidence_ref: Ref


class OpticalControl(FrozenModel):
    control_ref: Ref
    relay_ref: Ref
    drawing_cycle: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    codebook: tuple[tuple[Ref, Ref], ...] = Field(min_length=1, max_length=128)
    input_phase_steps: tuple[tuple[Ref, int], ...] = Field(min_length=1, max_length=2)
    wire_evidence_ref: Ref


class OpticalSetting(FrozenModel):
    control_ref: Ref
    drawing_ref: Ref


class OpticalState(FrozenModel):
    scope_ref: Ref
    settings: tuple[OpticalSetting, ...] = Field(min_length=1, max_length=128)
    active_control_ref: Ref | None
    shot_count: int = Field(ge=0)
    reserve: int = Field(ge=0)
    acquired_terminal_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    terminated: bool


class OpticalModel(FrozenModel):
    model_ref: Ref
    scope_ref: Ref
    emitter_ref: Ref
    emitter_origin: Vector
    emitter_direction_ref: Ref
    receivers: tuple[OpticalReceiver, ...] = Field(min_length=1, max_length=128)
    directions: tuple[OpticalDirection, ...] = Field(min_length=1, max_length=128)
    controls: tuple[OpticalControl, ...] = Field(min_length=1, max_length=128)
    boundary_bounds: tuple[Ratio, Ratio, Ratio, Ratio]
    intersection_law_ref: Ref | None = None
    source_inside_receiver_law_ref: Ref | None = None
    square_root_bits: int = Field(ge=1, le=256)
    hit_tie_law_ref: Ref | None = None
    receiver_tie_order: tuple[Ref, ...] = Field(default=(), max_length=128)
    reemission_law_ref: Ref | None = None
    loop_law_ref: Ref | None = None
    physical_hop_cap: int | None = Field(default=None, ge=1, le=4096)
    terminal_ref: Ref | None = None
    required_activation_refs: tuple[Ref, ...] | None = Field(default=None, max_length=128)
    source_unselected_rotation_ref: Ref | None = None
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=8)
    debit_order_ref: Ref | None = None
    terminal_order_ref: Ref | None = None
    failure_effect_ref: Ref | None = None
    failure_restore_settings: tuple[OpticalSetting, ...] | None = Field(default=None, max_length=128)
    failure_preserve_active: bool | None = None
    failure_restore_state: OpticalState | None = None
    success_effect_ref: Ref | None = None
    success_entry_state: OpticalState | None = None
    independent_preparation_law_ref: Ref | None = None
    reset_state: OpticalState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class OpticalInput(FrozenModel):
    kind_ref: Ref
    control_ref: Ref | None = None
    step_ref: Ref | None = None


class OpticalBinding(FrozenModel):
    primitive: OpticalInput
    action_ref: Ref
    payload: FrozenMap
    native_support_ref: Ref
    evidence_revision_ref: Ref


class OpticalRay(FrozenModel):
    origin: Vector
    direction_ref: Ref
    excluded_source_body_ref: Ref | None


class OpticalProbe(FrozenModel):
    probe_ref: Ref
    prepared_state: OpticalState
    evidence_ref: Ref
    preparation_cost: int = Field(ge=0)


_CASES = (
    ('scene_measure', ('MEASURE',)), ('direction_decode', ('FIT', 'DECODE')),
    ('control_binding', ('CORRESPOND',)), ('first_hit', ('FIRST_HIT',)),
    ('route_domain', ('SEARCH',)), ('cyclic_adjustments', ('DOMAIN',)),
    ('actuator_compile', ('COMPILE',)), ('shot_projection_compare', ('PREDICT', 'COMPARE')),
    ('resetting_probe_contract', ('PROBE',)), ('attempt_reconcile', ('RECONCILE',)),
    ('external_primitive', ('STEP',)),
)


class DiscreteOpticsRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.discrete_optics_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.discrete_relay_optics.{operation}', mode)
        for operation, modes in _CASES for mode in modes)
    models: tuple[OpticalModel, ...] = Field(default=(), max_length=32)
    state: OpticalState | None = None
    primitive: OpticalInput | None = None
    ray: OpticalRay | None = None
    target_outputs: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=128)
    words: tuple[tuple[OpticalInput, ...], ...] = Field(default=(), max_length=3)
    bindings: tuple[OpticalBinding, ...] = Field(default=(), max_length=4096)
    probes: tuple[OpticalProbe, ...] = Field(default=(), max_length=4096)
    source_identity_ref: Ref | None = None
    scene_input: OpticalSceneInputA | None = None
    route_input: OpticalRouteInputA | None = None


class OpticalPrerequisite(Exception):
    pass


def _fraction(pair):
    if pair is None or pair[1] <= 0:
        raise OpticalPrerequisite('EXACT_RATIONAL_GEOMETRY_OR_DIRECTION_REQUIRED')
    return Fraction(pair[0], pair[1])


def _ratio(value):
    return value.numerator, value.denominator


def _state(model, state, budget):
    if state.scope_ref != model.scope_ref:
        raise OpticalPrerequisite('CURRENT_OPTICAL_EXECUTION_SCOPE_NOT_MODEL_SCOPE')
    receivers = {receiver.body_ref: receiver for receiver in model.receivers}
    directions = {direction.direction_ref: direction for direction in model.directions}
    controls = {control.control_ref: control for control in model.controls}
    settings = {setting.control_ref: setting for setting in state.settings}
    if (len(receivers) != len(model.receivers) or len(directions) != len(model.directions)
            or len(controls) != len(model.controls) or len(settings) != len(state.settings)
            or set(controls) != set(settings) or model.emitter_direction_ref not in directions):
        raise OpticalPrerequisite('COMPLETE_UNIQUE_RECEIVER_DIRECTION_CONTROL_DOMAINS_REQUIRED')
    if len(receivers) > budget.request.domain_bound:
        raise DComputationInterrupted('RECEIVER_DOMAIN_BOUND', d_map())
    for control in model.controls:
        budget.visit({'control_ref': control.control_ref})
        codebook = dict(control.codebook)
        if (control.relay_ref not in receivers or receivers[control.relay_ref].kind_ref != 'RELAY'
                or len(set(control.drawing_cycle)) != len(control.drawing_cycle)
                or len(codebook) != len(control.codebook) or set(codebook) != set(control.drawing_cycle)
                or any(codebook[drawing] not in directions for drawing in control.drawing_cycle)
                or settings[control.control_ref].drawing_ref not in control.drawing_cycle):
            raise OpticalPrerequisite('CALIBRATED_CYCLIC_DRAWING_TO_ABSOLUTE_DIRECTION_BINDING_REQUIRED')
        if len(set(ref for ref, _ in control.input_phase_steps)) != len(control.input_phase_steps) or any(delta not in (-1, 1) for _, delta in control.input_phase_steps):
            raise OpticalPrerequisite('DECLARED_UNIT_CYCLIC_INPUT_STEPS_REQUIRED')
    if state.active_control_ref is not None and state.active_control_ref not in controls:
        raise OpticalPrerequisite('ACTIVE_REMOTE_CONTROL_IDENTITY_NOT_CURRENT')
    if model.required_activation_refs is not None and (len(set(model.required_activation_refs)) != len(model.required_activation_refs)
            or any(ref not in receivers or receivers[ref].kind_ref != 'RELAY' for ref in model.required_activation_refs)):
        raise OpticalPrerequisite('CURRENT_UNIQUE_REQUIRED_ACTIVATION_RELAYS_REQUIRED')
    return receivers, directions, controls, settings


def _decoded(model, state, budget):
    _, _, controls, settings = _state(model, state, budget)
    return tuple(d_map({'control_ref': ref, 'relay_ref': controls[ref].relay_ref,
        'drawing_ref': settings[ref].drawing_ref, 'absolute_direction_ref': dict(controls[ref].codebook)[settings[ref].drawing_ref],
        'drawing_phase_not_automatically_spatial_angle': True}) for ref in sorted(controls))


def _sqrt_interval(value, bits):
    numerator_root, denominator_root = isqrt(value.numerator), isqrt(value.denominator)
    if numerator_root ** 2 == value.numerator and denominator_root ** 2 == value.denominator:
        exact = Fraction(numerator_root, denominator_root)
        return exact, exact
    scale = 1 << bits
    lower = isqrt((value.numerator * scale * scale) // value.denominator)
    return Fraction(lower, scale), Fraction(lower + 1, scale)


def _receiver_interval(model, receiver, origin, direction):
    if receiver.shape_ref == 'closed_disk':
        if receiver.radius is None:
            raise OpticalPrerequisite('ANALYTIC_RADIUS_EVIDENCE_REQUIRED_NOT_RASTER_DIAMETER')
        center = tuple(_fraction(pair) for pair in receiver.center)
        radius = _fraction(receiver.radius)
        if radius <= 0:
            raise OpticalPrerequisite('POSITIVE_DECLARED_RECEIVER_RADIUS_REQUIRED')
        offset = origin[0] - center[0], origin[1] - center[1]
        a = direction[0] ** 2 + direction[1] ** 2
        b = 2 * (offset[0] * direction[0] + offset[1] * direction[1])
        c = offset[0] ** 2 + offset[1] ** 2 - radius ** 2
        discriminant = b ** 2 - 4 * a * c
        if discriminant < 0:
            return None
        low_root, high_root = _sqrt_interval(discriminant, model.square_root_bits)
        entry = (-b - high_root) / (2 * a), (-b - low_root) / (2 * a)
        exit_interval = (-b + low_root) / (2 * a), (-b + high_root) / (2 * a)
        if entry[0] > 0:
            return entry
        if entry[1] > 0:
            return None, 'NUMERICAL_ENTRY_STRADDLES_ZERO'
        if exit_interval[1] <= 0:
            return None
        if model.source_inside_receiver_law_ref != 'first_positive_exit':
            raise OpticalPrerequisite('DECLARED_ORIGIN_INSIDE_NON_SOURCE_RECEIVER_LAW_REQUIRED')
        if exit_interval[0] > 0:
            return exit_interval
        if exit_interval[1] > 0:
            return None, 'NUMERICAL_EXIT_STRADDLES_ZERO'
        return None
    if receiver.shape_ref != 'axis_aligned_closed_box' or receiver.box_bounds is None:
        raise OpticalPrerequisite('SUPPORTED_ANALYTIC_RECEIVER_SHAPE_REQUIRED')
    top, left, bottom, right = tuple(_fraction(pair) for pair in receiver.box_bounds)
    if top > bottom or left > right:
        raise OpticalPrerequisite('VALID_ANALYTIC_RECEIVER_BOX_REQUIRED')
    entries, exits = [], []
    for coordinate, velocity, minimum, maximum in ((origin[0], direction[0], top, bottom), (origin[1], direction[1], left, right)):
        if velocity == 0:
            if not minimum <= coordinate <= maximum:
                return None
            continue
        first, second = (minimum - coordinate) / velocity, (maximum - coordinate) / velocity
        entries.append(min(first, second))
        exits.append(max(first, second))
    entry, exit_value = max(entries), min(exits)
    if exit_value < entry or exit_value <= 0:
        return None
    if entry > 0:
        return entry, entry
    if model.source_inside_receiver_law_ref != 'first_positive_exit':
        raise OpticalPrerequisite('DECLARED_ORIGIN_INSIDE_NON_SOURCE_RECEIVER_LAW_REQUIRED')
    return exit_value, exit_value


def _first_hit(model, ray, budget):
    if model.intersection_law_ref != 'positive_analytic_ray_intersections_before_box_exit':
        raise OpticalPrerequisite('DECLARED_FIRST_IMPACT_LAW_REQUIRED')
    directions = {direction.direction_ref: direction for direction in model.directions}
    if ray.direction_ref not in directions:
        raise OpticalPrerequisite('CURRENT_FINITE_ABSOLUTE_DIRECTION_REQUIRED')
    origin = tuple(_fraction(pair) for pair in ray.origin)
    direction = tuple(_fraction(pair) for pair in directions[ray.direction_ref].vector)
    if direction == (0, 0):
        raise OpticalPrerequisite('NONZERO_FINITE_RAY_DIRECTION_REQUIRED')
    top, left, bottom, right = tuple(_fraction(pair) for pair in model.boundary_bounds)
    if top > bottom or left > right or not (top <= origin[0] <= bottom and left <= origin[1] <= right):
        raise OpticalPrerequisite('SOURCE_ORIGIN_WITHIN_DECLARED_BOUNDARY_REQUIRED')
    exits = []
    for coordinate, velocity, minimum, maximum in ((origin[0], direction[0], top, bottom), (origin[1], direction[1], left, right)):
        if velocity:
            exits.append(((maximum if velocity > 0 else minimum) - coordinate) / velocity)
    boundary = min(exits)
    candidates, uncertainty = [], []
    for receiver in model.receivers:
        budget.visit({'first_hit_receiver_ref': receiver.body_ref})
        if receiver.body_ref == ray.excluded_source_body_ref:
            continue
        interval = _receiver_interval(model, receiver, origin, direction)
        if interval is None:
            continue
        if interval[0] is None:
            uncertainty.append((receiver.body_ref, interval[1]))
            continue
        if interval[0] > boundary:
            continue
        candidates.append((receiver.body_ref, interval[0], interval[1]))
    if uncertainty:
        return {'first_receiver_ref': None, 'boundary_exit_parameter': _ratio(boundary),
            'numeric_uncertainty': tuple(uncertainty), 'complete_first_hit': False}
    if not candidates:
        return {'first_receiver_ref': None, 'boundary_exit_parameter': _ratio(boundary),
            'numeric_uncertainty': (), 'complete_first_hit': True, 'boundary_exit': True}
    minimum_upper = min(high for _, _, high in candidates)
    earliest = tuple(row for row in candidates if row[1] <= minimum_upper)
    if len(earliest) > 1:
        exact_tie = all(low == high == earliest[0][1] for _, low, high in earliest)
        if not exact_tie:
            return {'first_receiver_ref': None, 'boundary_exit_parameter': _ratio(boundary), 'complete_first_hit': False,
                'numeric_uncertainty': tuple((ref, _ratio(low), _ratio(high)) for ref, low, high in earliest)}
        if model.hit_tie_law_ref != 'declared_receiver_order' or len(set(model.receiver_tie_order)) != len(model.receiver_tie_order) or not set(ref for ref, _, _ in earliest) <= set(model.receiver_tie_order):
            raise OpticalPrerequisite('DECLARED_EXACT_IMPACT_TIE_GUARD_REQUIRED')
        unique_tie_receiver_ref = next(ref for ref in model.receiver_tie_order if any(ref == row[0] for row in earliest))
        unique = next(row for row in earliest if row[0] == unique_tie_receiver_ref)
    else:
        unique = earliest[0]
    if unique[2] > boundary:
        return {'first_receiver_ref': None, 'complete_first_hit': False,
            'numeric_uncertainty': ((unique[0], 'IMPACT_STRADDLES_BOUNDARY_EXIT'),), 'boundary_exit_parameter': _ratio(boundary)}
    return {'first_receiver_ref': unique[0], 'impact_parameter_interval': (_ratio(unique[1]), _ratio(unique[2])),
        'boundary_exit_parameter': _ratio(boundary), 'complete_first_hit': True, 'numeric_uncertainty': (),
        'nearer_receiver_not_skipped': True, 'wire_or_ray_crossing_not_a_receiver': True}


def _shot(model, state, request, budget):
    receivers, _, controls, settings = _state(model, state, budget)
    if model.reemission_law_ref != 'receiver_center_absolute_control_direction' or model.physical_hop_cap is None:
        raise OpticalPrerequisite('DECLARED_ABSOLUTE_REEMISSION_OR_PHYSICAL_HOP_CAP_REQUIRED')
    if model.loop_law_ref not in ('revisited_relay_stops', 'repeated_source_direction_stops'):
        raise OpticalPrerequisite('DECLARED_SHOT_LOOP_RULE_REQUIRED')
    if model.terminal_ref not in receivers or receivers[model.terminal_ref].kind_ref != 'TERMINAL' or model.required_activation_refs is None:
        raise OpticalPrerequisite('BOUND_TERMINAL_AND_EXPLICIT_ACTIVATION_REQUIREMENT_SCOPE_REQUIRED')
    relay_controls = {}
    for ref in sorted(controls):
        relay_controls.setdefault(controls[ref].relay_ref, []).append(ref)
    origin, direction, source = model.emitter_origin, model.emitter_direction_ref, model.emitter_ref
    events, activated, seen = [], [], set()
    outcome = 'PHYSICAL_HOP_CAP'
    for index in range(model.physical_hop_cap):
        if index >= request.depth_bound or len(events) >= request.domain_bound:
            raise DComputationInterrupted('SHOT_COMPUTATION_DEPTH_OR_EVENT_BOUND', d_map({'next_hop_index': index}))
        budget.visit({'shot_hop_index': index})
        key = source if model.loop_law_ref == 'revisited_relay_stops' else (source, direction)
        if key in seen:
            outcome = 'LOOP'
            break
        seen.add(key)
        hit = _first_hit(model, OpticalRay(origin=origin, direction_ref=direction, excluded_source_body_ref=source), budget)
        if not hit['complete_first_hit']:
            raise OpticalPrerequisite('NUMERICAL_FIRST_HIT_UNCERTAINTY_PREVENTS_COMPLETE_SHOT')
        receiver_ref = hit['first_receiver_ref']
        events.append(d_map({'hop_index': index, 'source_body_ref': source, 'direction_ref': direction,
            'receiver_ref': receiver_ref, 'first_impact': d_map(hit), 'external_command': False}))
        if receiver_ref is None:
            outcome = 'EXIT'
            break
        receiver = receivers[receiver_ref]
        if receiver.kind_ref == 'TERMINAL':
            outcome = 'TERMINAL_REACHED' if receiver_ref == model.terminal_ref and set(model.required_activation_refs) <= set(activated) else 'TERMINAL_OR_ACTIVATION_REQUIREMENT_MISMATCH'
            break
        if receiver.kind_ref == 'BLOCKER':
            outcome = 'BLOCKED'
            break
        if receiver.kind_ref != 'RELAY' or len(relay_controls.get(receiver_ref, ())) != 1:
            raise OpticalPrerequisite('UNIQUE_REEMISSION_CONTROLLER_FOR_CURRENT_RELAY_REQUIRED')
        control = controls[relay_controls[receiver_ref][0]]
        activated.append(receiver_ref)
        source, origin = receiver_ref, receiver.center
        direction = dict(control.codebook)[settings[control.control_ref].drawing_ref]
    return {'shot_settings': state.settings, 'shot_scope_ref': state.scope_ref,
        'ordered_shot_events': tuple(events), 'activated_relay_refs': tuple(activated),
        'outcome_ref': outcome, 'accepted_terminal': outcome == 'TERMINAL_REACHED',
        'all_relays_required_only_when_explicit': True, 'synchronous_external_input_count': 1}


def _control(model, state, primitive, budget):
    _, _, controls, settings = _state(model, state, budget)
    if primitive.kind_ref == 'select':
        if primitive.control_ref not in controls or primitive.step_ref is not None:
            raise OpticalPrerequisite('CURRENT_REMOTE_SELECTION_SUPPORT_REQUIRED')
        return state.model_copy(update={'active_control_ref': primitive.control_ref}), 'REMOTE_SELECTION'
    if primitive.kind_ref != 'rotate' or primitive.control_ref is not None or not primitive.step_ref:
        raise OpticalPrerequisite('ACTUAL_SELECTION_OR_CYCLIC_ROTATION_CHANNEL_REQUIRED')
    if state.active_control_ref is None:
        if model.source_unselected_rotation_ref != 'no_setting_change':
            raise OpticalPrerequisite('UNSELECTED_ROTATION_EFFECT_REQUIRED')
        return state, 'UNSELECTED_ROTATION_REFUSAL'
    control = controls[state.active_control_ref]
    steps = dict(control.input_phase_steps)
    if primitive.step_ref not in steps:
        raise OpticalPrerequisite('SUPPORTED_CURRENT_CONTROL_CYCLIC_STEP_REQUIRED')
    index = control.drawing_cycle.index(settings[control.control_ref].drawing_ref)
    drawing = control.drawing_cycle[(index + steps[primitive.step_ref]) % len(control.drawing_cycle)]
    after = state.model_copy(update={'settings': tuple(setting.model_copy(update={'drawing_ref': drawing}) if setting.control_ref == control.control_ref else setting for setting in state.settings)})
    return after, 'CYCLIC_DRAWING_CHANGE'


def _transition(model, state, shot):
    if shot['accepted_terminal']:
        if model.success_effect_ref == 'current_scope_win':
            acquired = state.acquired_terminal_refs if model.terminal_ref in state.acquired_terminal_refs else state.acquired_terminal_refs + (model.terminal_ref,)
            return state.model_copy(update={'acquired_terminal_refs': acquired}), 'SUCCESS_CURRENT_SCOPE'
        if model.success_effect_ref == 'enter_declared_next_scope':
            if model.success_entry_state is None or model.success_entry_state.scope_ref == state.scope_ref:
                raise OpticalPrerequisite('QUALIFIED_DISTINCT_NEXT_SCOPE_ENTRY_REQUIRED')
            return model.success_entry_state, 'SUCCESS_NEXT_SCOPE_ENTRY'
        raise OpticalPrerequisite('ACTUAL_SUCCESS_LEVEL_PROGRESSION_CONTRACT_REQUIRED')
    if model.failure_effect_ref == 'keep_current_settings':
        return state, 'FAILURE_SETTINGS_RETAINED'
    if model.failure_effect_ref == 'game_over':
        return state.model_copy(update={'terminated': True}), 'FAILURE_GAME_OVER'
    if model.failure_effect_ref == 'restore_declared_controls':
        if model.failure_restore_settings is None or model.failure_preserve_active is None:
            raise OpticalPrerequisite('EXACT_FAILURE_ORIENTATION_AND_SELECTION_RESTORATION_REQUIRED')
        return state.model_copy(update={'settings': model.failure_restore_settings,
            'active_control_ref': state.active_control_ref if model.failure_preserve_active else None}), 'FAILURE_CONTROL_RESET'
    if model.failure_effect_ref == 'restore_exact_state':
        if model.failure_restore_state is None:
            raise OpticalPrerequisite('EXACT_FAILURE_PHYSICAL_RESTORATION_STATE_REQUIRED')
        return model.failure_restore_state, 'FAILURE_EXACT_RESET'
    raise OpticalPrerequisite('ACTUAL_FAILURE_RESET_SCOPE_CONTRACT_REQUIRED')


def _external(model, state, primitive, request, budget):
    _state(model, state, budget)
    if primitive.kind_ref == 'reset':
        if primitive.control_ref is not None or primitive.step_ref is not None or model.reset_state is None or model.reset_cost is None:
            raise OpticalPrerequisite('INDEPENDENT_RESET_STATE_COST_SCOPE_REQUIRED')
        _state(model, model.reset_state, budget)
        return {'before_state': state, 'optical_input': primitive,
            'state': model.reset_state, 'primitive_complete': True,
            'phase_snapshots': d_map({'before': state, 'independent_reset': model.reset_state}),
            'closure_facts': d_map({'independent_reset_complete': True}),
            'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'debit': model.reset_cost, 'accepted': False, 'automatic_pass_count': 0})}
    if state.terminated:
        raise OpticalPrerequisite('OFFICIAL_TERMINATION_REVOKES_OLD_OPTICAL_INPUTS')
    costs = dict(model.input_costs)
    if len(costs) != len(model.input_costs) or primitive.kind_ref not in costs or any(costs[key] < 0 for key in sorted(costs)):
        raise OpticalPrerequisite('CURRENT_NATIVE_SELECTION_ROTATION_LAUNCH_COSTS_REQUIRED')
    if model.debit_order_ref not in ('before_direct', 'after_transition') or model.terminal_order_ref not in ('acceptance_before_exhaustion', 'exhaustion_before_acceptance'):
        raise OpticalPrerequisite('DECLARED_DEBIT_RESET_AND_ACCEPTANCE_EXHAUSTION_ORDER_REQUIRED')
    cost = costs[primitive.kind_ref]
    charged = state.model_copy(update={'reserve': max(0, state.reserve - cost)}) if model.debit_order_ref == 'before_direct' else state
    shot = None
    if primitive.kind_ref in ('select', 'rotate'):
        direct, effect = _control(model, charged, primitive, budget)
        transitioned = direct
    elif primitive.kind_ref == 'launch' and primitive.control_ref is None and primitive.step_ref is None:
        direct = charged.model_copy(update={'shot_count': charged.shot_count + 1})
        shot = _shot(model, direct, request, budget)
        acceptance_reserve = direct.reserve if model.debit_order_ref == 'before_direct' else max(0, direct.reserve - cost)
        if shot['accepted_terminal'] and model.terminal_order_ref == 'exhaustion_before_acceptance' and acceptance_reserve == 0:
            raise OpticalPrerequisite('EXHAUSTED_SUCCESS_REQUIRES_EXPLICIT_NO_ACCEPTANCE_TRANSITION_LAW')
        transitioned, effect = _transition(model, direct, shot)
    else:
        raise OpticalPrerequisite('ACTUAL_NATIVE_OPTICAL_GESTURE_NOT_DECLARED')
    new_scope = transitioned.scope_ref != model.scope_ref
    if not new_scope:
        _state(model, transitioned, budget)
    reserve = transitioned.reserve if model.debit_order_ref == 'before_direct' else max(0, transitioned.reserve - cost)
    exhausted = reserve == 0
    candidate = shot is not None and shot['accepted_terminal']
    accepted = candidate and (model.terminal_order_ref == 'acceptance_before_exhaustion' or not exhausted)
    terminal = transitioned.terminated or exhausted or (accepted and not new_scope)
    after = transitioned.model_copy(update={'reserve': reserve, 'terminated': terminal})
    before_map = {setting.control_ref: setting.drawing_ref for setting in state.settings}
    after_map = {setting.control_ref: setting.drawing_ref for setting in after.settings}
    invalidated = tuple(ref for ref in sorted(before_map) if after_map.get(ref) != before_map[ref])
    return {'before_state': state, 'optical_input': primitive,
        'state': after, 'shot_projection': d_map(shot) if shot is not None else None,
        'effect_ref': effect, 'changed_physical_setting_refs': invalidated, 'primitive_complete': True,
        'phase_snapshots': d_map({'before': state, 'after_direct': direct, 'after_shot_transition': transitioned, 'after_cost_and_verdict': after}),
        'closure_facts': d_map({'direct_complete': True, 'shot_complete': shot is not None,
            'actual_failure_or_progression_applied': shot is not None, 'cost_and_verdict_complete': True,
            'new_execution_scope_requires_qualification': new_scope}),
        'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'debit': cost,
            'native_input_count': 1, 'automatic_pass_count': 1 if shot is not None else 0,
            'accepted': accepted, 'exhausted': exhausted, 'scope_boundary': new_scope,
            'second_shot_forbidden': True, 'second_debit_forbidden': True})}


def _direction_fit(model, request, budget):
    if request.mode_ref == 'DECODE':
        return {'absolute_direction_domain': _decoded(model, request.state, budget), 'codebook_is_supplied_not_autonomous_discovery': True}
    if not request.observations:
        raise OpticalPrerequisite('SEALED_FULL_DRAWING_AND_OUTPUT_EVIDENCE_REQUIRED')
    rows = []
    for index, sample in enumerate(request.observations):
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise OpticalPrerequisite('DIRECTION_FIT_PACKET_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('control_state', 'observed_outputs')):
            raise OpticalPrerequisite('ACTUAL_CYCLIC_DRAWING_AND_ABSOLUTE_OUTPUT_DOMAIN_REQUIRED')
        state = OpticalState.model_validate(sample['control_state'])
        decoded = _decoded(model, state, budget)
        predicted = {row['relay_ref']: row['absolute_direction_ref'] for row in decoded}
        observed = dict(sample['observed_outputs'])
        rows.append(d_map({'sample_index': index, 'output_constraints_match': all(predicted.get(ref) == observed[ref] for ref in sorted(observed)),
            'full_direction_assignment': decoded, 'missing_marker_code_not_discarded': True}))
    return {'cyclic_code_evidence_constraints': tuple(rows)}


def _binding_constraints(model, request, budget):
    _, _, controls, _ = _state(model, request.state, budget)
    if not request.observations:
        raise OpticalPrerequisite('WIRE_ENDPOINT_OR_JOINT_SELECTION_EVIDENCE_REQUIRED')
    rows = []
    for index, sample in enumerate(request.observations):
        budget.visit({'binding_sample_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise OpticalPrerequisite('CONTROL_BINDING_PACKET_OWNER_OR_SEAL_MISMATCH')
        candidates = tuple(tuple(pair) for pair in sample.get('supported_wire_bindings', ()))
        requested = sample.get('pointed_control_ref')
        selection = None
        if requested is not None:
            if requested not in controls or sample.get('observed_marked_controller_refs') is None or sample.get('observed_marked_relay_refs') is None:
                raise OpticalPrerequisite('MEASURED_JOINT_CONTROL_RELAY_SELECTION_MARKERS_REQUIRED')
            selection = (tuple(sample['observed_marked_controller_refs']) == (requested,)
                and tuple(sample['observed_marked_relay_refs']) == (controls[requested].relay_ref,))
        if not candidates and selection is None:
            raise OpticalPrerequisite('ACTUAL_ENDPOINT_OR_SELECTION_BINDING_OBSERVATION_MISSING')
        constrained_controls = {ref for ref, _ in candidates}
        if not constrained_controls <= set(controls):
            raise OpticalPrerequisite('OBSERVED_WIRE_ENDPOINT_NOT_CURRENT_CONTROL')
        rows.append(d_map({'sample_index': index, 'joint_selection_matches': selection,
            'supported_wire_binding_constraints': candidates,
            'supplied_binding_compatible': not candidates or all((ref, controls[ref].relay_ref) in candidates for ref in sorted(constrained_controls)),
            'nearest_spatial_order_not_used': True, 'selected_not_same_as_activated': True}))
    return {'controller_relay_correspondence_constraints': tuple(rows)}


def _adjustments(model, request, budget):
    _, _, controls, settings = _state(model, request.state, budget)
    if not request.target_outputs or len(set(ref for ref, _ in request.target_outputs)) != len(request.target_outputs):
        raise OpticalPrerequisite('UNIQUE_SOURCE_TARGET_ACTUATOR_OUTPUTS_REQUIRED')
    rows = []
    for ref, target in request.target_outputs:
        if ref not in controls:
            raise OpticalPrerequisite('TARGET_ACTUATOR_NOT_CURRENT')
        control = controls[ref]
        current = control.drawing_cycle.index(settings[ref].drawing_ref)
        targets = tuple(index for index, drawing in enumerate(control.drawing_cycle) if dict(control.codebook)[drawing] == target)
        alternatives = []
        for index in targets:
            for step_ref, delta in control.input_phase_steps:
                budget.visit({'control_ref': ref, 'target_drawing_index': index, 'step_ref': step_ref})
                count = ((index - current) * delta) % len(control.drawing_cycle)
                alternatives.append((count, step_ref, index))
        if not alternatives:
            rows.append(d_map({'control_ref': ref, 'target_direction_ref': target, 'reachable_in_code_cycle': False}))
            continue
        minimum = min(count for count, _, _ in alternatives)
        witnesses = tuple(d_map({'step_ref': step, 'step_count': count, 'target_drawing_index': index})
            for count, step, index in alternatives if count == minimum)
        rows.append(d_map({'control_ref': ref, 'target_direction_ref': target, 'reachable_in_code_cycle': True,
            'minimum_unit_steps': minimum, 'tied_cyclic_adjustments': witnesses,
            'selection_needed_for_nonzero_adjustment': minimum > 0 and request.state.active_control_ref != ref,
            'zero_steps_do_not_require_decorative_selection': True}))
    return {'per_actuator_adjustment_domains': tuple(rows),
        'independent_preparation_grouping_declared': model.independent_preparation_law_ref == 'control_only_no_geometry_or_trigger_changes',
        'global_preparation_order_or_launch_selected': False}


def _compile(model, request, budget):
    if not request.words:
        raise OpticalPrerequisite('SOURCE_CHOSEN_PREPARATION_AND_LAUNCH_WORDS_REQUIRED')
    rows = []
    for word in request.words:
        if len(word) > request.depth_bound:
            raise DComputationInterrupted('OPTICAL_WORD_PRIMITIVE_BOUND', d_map())
        current, native, effects, cost = request.state, [], [], 0
        for primitive in word:
            if current.terminated or current.scope_ref != model.scope_ref:
                break
            budget.visit({'native_prefix_index': len(native)})
            matches = tuple(binding for binding in request.bindings if binding.primitive == primitive and binding.evidence_revision_ref == request.scope.evidence_revision_ref)
            if len(matches) != 1 or not matches[0].native_support_ref:
                raise OpticalPrerequisite('CURRENT_NATIVE_REMOTE_ACTUATOR_LAUNCH_BINDING_NOT_UNIQUE')
            if primitive.kind_ref == 'launch':
                decoded = {row['control_ref']: row['absolute_direction_ref'] for row in _decoded(model, current, budget)}
                if any(decoded.get(ref) != direction for ref, direction in request.target_outputs):
                    raise OpticalPrerequisite('DECLARED_LAUNCH_PREPARATION_CONTINUATIONS_NOT_MET')
            image = _external(model, current, primitive, request, budget)
            current = image['state']
            native.append(d_map({'action_ref': matches[0].action_ref, 'payload': matches[0].payload, 'native_support_ref': matches[0].native_support_ref}))
            effects.append(d_map(image))
            cost += image['event_ledger']['debit']
            if primitive.kind_ref == 'launch':
                break
        rows.append(d_map({'frozen_native_prefix': tuple(native), 'sealed_effects': tuple(effects), 'state': current,
            'expanded_input_cost': cost, 'uncompiled_postshot_or_boundary_suffix_count': len(word) - len(native),
            'primitive_release_authorized': False, 'no_intervention_inside_synchronous_shot': True}))
    return {'compiled_optical_prefixes': tuple(rows)}


def _compare(model, request, budget):
    if not request.observations:
        raise OpticalPrerequisite('WHOLE_SEALED_SHOT_RESET_AND_SCENE_PACKETS_REQUIRED')
    rows, first = [], None
    for index, sample in enumerate(request.observations):
        budget.visit({'attempt_packet_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise OpticalPrerequisite('SHOT_PACKET_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('before_state', 'primitive', 'actual_state', 'observed_receiver_sequence')) or 'observed_outcome_ref' not in sample:
            raise OpticalPrerequisite('ACTUAL_ATTEMPT_INPUT_STATE_ACTIVATION_OUTCOME_REQUIRED')
        before = OpticalState.model_validate(sample['before_state'])
        actual = OpticalState.model_validate(sample['actual_state'])
        primitive = OpticalInput.model_validate(sample['primitive'])
        predicted = _external(model, before, primitive, request, budget)
        expected = predicted['state']
        actual_settings, expected_settings = {setting.control_ref: setting.drawing_ref for setting in actual.settings}, {setting.control_ref: setting.drawing_ref for setting in expected.settings}
        if len(actual_settings) != len(actual.settings):
            raise OpticalPrerequisite('ACTUAL_OBSERVED_CONTROL_IDENTITIES_NOT_UNIQUE')
        differences = tuple(ref for ref in sorted(set(actual_settings) | set(expected_settings)) if actual_settings.get(ref) != expected_settings.get(ref))
        fields = tuple(field for field in ('scope_ref', 'active_control_ref', 'shot_count', 'reserve', 'acquired_terminal_refs', 'terminated') if getattr(actual, field) != getattr(expected, field))
        shot = predicted.get('shot_projection')
        sequence = tuple(event['receiver_ref'] for event in shot['ordered_shot_events']) if shot is not None else ()
        outcome = shot['outcome_ref'] if shot is not None else None
        path_matches = tuple(sample['observed_receiver_sequence']) == sequence and sample['observed_outcome_ref'] == outcome
        if actual.scope_ref != before.scope_ref and sample.get('next_scene_observation') is None:
            raise OpticalPrerequisite('NEW_SCOPE_ENTRY_REQUIRES_NEXT_SCENE_OBSERVATION')
        if first is None and (differences or fields or not path_matches):
            first = index
        rows.append(d_map({'packet_index': index, 'physical_setting_difference_refs': differences,
            'counter_selection_or_scope_difference_fields': fields, 'ordered_shot_projection_matches': path_matches,
            'invalidated_prepared_setting_refs': predicted.get('changed_physical_setting_refs', ()),
            'next_scene_observation': sample.get('next_scene_observation'),
            'repeated_animation_stride_not_extra_commands': True, 'semantic_knowledge_not_reset_physical_angles': True}))
    return {'sealed_optical_attempt_constraints': tuple(rows), 'first_divergence_index': first}


def _probes(request, budget):
    if not request.probes or len(request.probes) > request.domain_bound:
        raise OpticalPrerequisite('BOUNDED_SOURCE_DISCRIMINATING_SHOT_CANDIDATES_REQUIRED')
    rows = []
    for probe in request.probes:
        results = []
        before_settings = {setting.control_ref: setting.drawing_ref for setting in request.state.settings}
        prepared_settings = {setting.control_ref: setting.drawing_ref for setting in probe.prepared_state.settings}
        preparation_changes = tuple(ref for ref in sorted(set(before_settings) | set(prepared_settings))
            if before_settings.get(ref) != prepared_settings.get(ref))
        for model in request.models:
            budget.visit({'probe_ref': probe.probe_ref, 'model_ref': model.model_ref})
            try:
                image = _external(model, probe.prepared_state, OpticalInput(kind_ref='launch'), request, budget)
                results.append(d_map({'model_ref': model.model_ref, 'predicted_attempt': d_map(image),
                    'total_declared_cost': probe.preparation_cost + image['event_ledger']['debit'],
                    'physical_preparation_changed_refs': preparation_changes,
                    'postshot_changed_setting_refs': image.get('changed_physical_setting_refs', ()), 'missing_prerequisite': None}))
            except OpticalPrerequisite as error:
                results.append(d_map({'model_ref': model.model_ref, 'predicted_attempt': None, 'missing_prerequisite': str(error)}))
        attempts = tuple(row['predicted_attempt'] for row in results if row['predicted_attempt'] is not None)
        signatures = tuple((tuple(event['receiver_ref'] for event in attempt['shot_projection']['ordered_shot_events']),
            attempt['shot_projection']['outcome_ref'], attempt['state']) for attempt in attempts)
        rows.append(d_map({'source_probe_ref': probe.probe_ref, 'model_attempt_domains': tuple(results),
            'observable_attempt_consequences_differ': bool(signatures) and any(signature != signatures[0] for signature in signatures[1:]),
            'probe_selected_or_launched': False, 'missing_kernel_not_reason_to_repeat_destructive_shot': True}))
    return {'source_experiment_discrimination_domains': tuple(rows)}


def measure_discrete_relay_optics(request: DiscreteOpticsRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget, rows, current_model_ref = DWorkBudget(request), [], None
    operation = request.operation_ref.rsplit('.', 1)[-1]
    try:
        if operation == 'scene_measure':
            return measure_optical_scene_a(request)
        if operation == 'route_domain':
            return d_result(request, 'NEEDS_EVIDENCE', 'SOURCE_OPTICAL_GRAPH_AND_K09_WORKFLOW_REQUIRED')
        if not request.models or request.state is None:
            raise OpticalPrerequisite('SCOPED_ANALYTIC_OPTICAL_MODELS_AND_CURRENT_SETTINGS_REQUIRED')
        if operation == 'resetting_probe_contract':
            values = _probes(request, budget)
            budget.finish()
            return d_result(request, 'OK', 'EXACT_CONDITIONAL_PROBE_DOMAIN', values=values, complete=True, examined=budget.examined)
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            _state(model, request.state, budget)
            if operation == 'direction_decode':
                row = _direction_fit(model, request, budget)
            elif operation == 'control_binding':
                row = _binding_constraints(model, request, budget)
            elif operation == 'first_hit':
                if request.ray is None:
                    raise OpticalPrerequisite('SOURCE_RAY_ORIGIN_DIRECTION_AND_EXCLUSION_SCOPE_REQUIRED')
                row = _first_hit(model, request.ray, budget)
            elif operation == 'cyclic_adjustments':
                row = _adjustments(model, request, budget)
            elif operation == 'actuator_compile':
                row = _compile(model, request, budget)
            elif operation == 'shot_projection_compare':
                row = _shot(model, request.state, request, budget) if request.mode_ref == 'PREDICT' else _compare(model, request, budget)
            elif operation == 'attempt_reconcile':
                row = _compare(model, request, budget)
            elif operation == 'external_primitive':
                if request.primitive is None:
                    raise OpticalPrerequisite('BOUND_ACTUAL_OPTICAL_PRIMITIVE_REQUIRED')
                row = _external(model, request.state, request.primitive, request, budget)
            else:
                return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'OK', 'EXACT_SCOPED_DISCRETE_RELAY_OPTICS', values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except OpticalPrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
