"""Finite weighted actuator deltas and nonwrapping population assignments.

Source supplies occurrences, enabled controls, target translations and laws.
No color patch is promoted to an identity or an invisible actuator. Unfinished
operation cases return MISSING_IMPLEMENTATION rather than another calculation.
"""

from __future__ import annotations

from itertools import product
from math import prod
from typing import ClassVar
from pydantic import Field

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .joystick_observation_contracts_a import (
    JoystickSceneInputA, JoystickIdentityInputA, JoystickControlInputA, JoystickRecoveryInputA,
)
from .modular_control_certificate_d import measured_setting_gain_delta
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier,
    d_map,
)


class JoystickOccurrence(FrozenModel):
    occurrence_ref: Ref
    color_ref: Ref
    row: int
    column: int


class JoystickPad(FrozenModel):
    pad_ref: Ref
    occurrence_ref: Ref
    enabled: bool | None
    # None is unknown; absence/disabled is represented explicitly by enabled.
    row_setting: int | None
    column_setting: int | None
    row_domain: tuple[int, ...] = Field(default=(), max_length=32)
    column_domain: tuple[int, ...] = Field(default=(), max_length=32)


class JoystickState(FrozenModel):
    occurrences: tuple[JoystickOccurrence, ...] = Field(min_length=1, max_length=64)
    pads: tuple[JoystickPad, ...] = Field(default=(), max_length=128)
    active_occurrence_ref: Ref | None = None
    active_pad_ref: Ref | None = None
    draw_order: tuple[Ref, ...] = Field(default=(), max_length=64)


class JoystickModel(FrozenModel):
    model_ref: Ref
    height: int = Field(ge=1, le=256)
    width: int = Field(ge=1, le=256)
    displacement_law: Ref | None
    crossing_count_law: Ref | None
    stacking_allowed: bool | None
    draw_order_law: Ref | None
    nudge_bound_law: Ref | None
    nudge_cost: int | None = Field(default=None, ge=0)
    wrap_cost: int | None = Field(default=None, ge=0)
    reset_state: JoystickState | None = None
    reset_cost: int | None = Field(default=None, ge=0)
    reset_lifecycle_ref: Ref | None = None
    selection_cost: int | None = Field(default=None, ge=0)
    selection_pad_law: Ref | None = None
    same_cell_cycle_order: tuple[Ref, ...] = Field(default=(), max_length=64)
    acceptance_law: Ref | None = None
    acceptance_check_scope: Ref | None = None
    # Laws belong to each retained model, not to the physical knob snapshot.
    # row gain from row/column delta, then column gain from row/column delta.
    pad_gains: tuple[tuple[Ref, tuple[int | None, int | None, int | None, int | None]], ...] = Field(default=(), max_length=128)
    pad_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=128)
    legal_nudge_vectors: tuple[tuple[int, int], ...] = Field(default=(), max_length=32)


class JoystickSetting(FrozenModel):
    pad_ref: Ref
    row: int
    column: int


class JoystickSlot(FrozenModel):
    slot_ref: Ref
    color_ref: Ref
    row: int
    column: int


class JoystickTarget(FrozenModel):
    target_ref: Ref
    slots: tuple[JoystickSlot, ...] = Field(min_length=1, max_length=64)
    # Already expanded by the Source-selected nonwrapping translation.
    translation: tuple[int, int]
    full_population_required: bool


class JoystickPrimitive(FrozenModel):
    primitive_ref: Ref
    action_kind: Ref
    occurrence_ref: Ref | None = None
    pad_ref: Ref | None = None
    settings: tuple[JoystickSetting, ...] = Field(default=(), max_length=1)
    nudge: tuple[int, int] | None = None
    selectable_occurrence_refs: tuple[Ref, ...] = Field(default=(), max_length=64)


class JoystickWord(FrozenModel):
    word_ref: Ref
    primitives: tuple[JoystickPrimitive, ...] = Field(default=(), max_length=4096)


class JoystickControlGeometry(FrozenModel):
    pad_ref: Ref
    evidence_ref: Ref
    scope_revision_ref: Ref
    geometry_status: Ref
    row_origin: int
    column_origin: int
    row_pitch: int = Field(ge=1)
    column_pitch: int = Field(ge=1)
    marker_row_inset: int = Field(ge=0)
    marker_column_inset: int = Field(ge=0)
    row_values: tuple[int, ...] = Field(min_length=1, max_length=32)
    column_values: tuple[int, ...] = Field(min_length=1, max_length=32)
    action_ref: Ref
    row_payload_key: Ref
    column_payload_key: Ref
    payload_template: FrozenMap


_CASES = (
    ('grid_roles', ('MEASURE',)), ('identity_and_occlusion', ('CORRESPOND',)),
    ('control_state', ('MEASURE',)), ('delta_model', ('FIT', 'PREDICT')),
    ('reachable_preimages', ('INVERSE_DOMAIN',)), ('feasible_assignment', ('DOMAIN',)),
    ('prepare_order', ('DOMAIN',)), ('command_binding', ('COMPILE',)),
    ('reconcile_packet', ('COMPARE',)), ('recovery_and_focus', ('RETAIN', 'PROBE')),
    ('external_primitive', ('STEP',)),
)


class BoundedJoystickRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.bounded_joystick_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.bounded_joystick.{operation}', mode) for operation, modes in _CASES for mode in modes)
    models: tuple[JoystickModel, ...] = Field(default=(), max_length=32)
    state: JoystickState | None = None
    settings: tuple[JoystickSetting, ...] = Field(default=(), max_length=128)
    targets: tuple[JoystickTarget, ...] = Field(default=(), max_length=128)
    action_kind: Ref | None = None
    occurrence_ref: Ref | None = None
    pad_ref: Ref | None = None
    nudge: tuple[int, int] | None = None
    selectable_occurrence_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    preparation_words: tuple[JoystickWord, ...] = Field(default=(), max_length=3)
    control_geometries: tuple[JoystickControlGeometry, ...] = Field(default=(), max_length=128)
    bound_action_ref: Ref | None = None
    bound_payload: FrozenMap = Field(default_factory=FrozenMap)
    control_geometry_status_refs: tuple[Ref, ...] = Field(default=(), max_length=2)
    preservation_positions: tuple[tuple[Ref, int, int], ...] = Field(default=(), max_length=64)
    source_identity_ref: Ref | None = None
    scene_input: JoystickSceneInputA | None = None
    identity_input: JoystickIdentityInputA | None = None
    control_input: JoystickControlInputA | None = None
    recovery_input: JoystickRecoveryInputA | None = None


class JoystickPrerequisite(Exception):
    pass


def _validate_state(model, state):
    if len(set(body.occurrence_ref for body in state.occurrences)) != len(state.occurrences):
        raise JoystickPrerequisite('OCCURRENCE_IDENTITIES_NOT_UNIQUE')
    if len(set(pad.pad_ref for pad in state.pads)) != len(state.pads):
        raise JoystickPrerequisite('PAD_IDENTITIES_NOT_UNIQUE')
    bodies = {body.occurrence_ref: body for body in state.occurrences}
    if any(not 0 <= body.row < model.height or not 0 <= body.column < model.width for body in state.occurrences):
        raise JoystickPrerequisite('CURRENT_POSITION_OUTSIDE_MODULAR_DOMAIN')
    if any(pad.occurrence_ref not in bodies for pad in state.pads):
        raise JoystickPrerequisite('ACTUATOR_OCCURRENCE_NOT_BOUND')
    if set(state.draw_order) != set(bodies) or len(state.draw_order) != len(bodies):
        raise JoystickPrerequisite('COMPLETE_DRAW_ORDER_MISSING')
    if state.active_occurrence_ref is not None and state.active_occurrence_ref not in bodies:
        raise JoystickPrerequisite('ACTIVE_OCCURRENCE_OUTSIDE_POPULATION')
    if state.active_pad_ref is not None and state.active_pad_ref not in tuple(pad.pad_ref for pad in state.pads):
        raise JoystickPrerequisite('ACTIVE_PAD_OUTSIDE_CONTROL_DOMAIN')


def _delta(model, state, settings, budget, *, require_cost=True):
    _validate_state(model, state)
    if model.displacement_law != 'weighted_setting_difference_modulo':
        raise JoystickPrerequisite('WEIGHTED_DIFFERENCE_LAW_MISSING')
    requested = {setting.pad_ref: setting for setting in settings}
    if len(requested) != len(settings) or any(ref not in {pad.pad_ref for pad in state.pads} for ref in requested):
        raise JoystickPrerequisite('PAD_SETTING_BINDING_NOT_UNIQUE')
    deltas = {body.occurrence_ref: [0, 0] for body in state.occurrences}
    pads = []
    changed = []
    base_cost = 0
    cost_known = True
    for pad in state.pads:
        setting = requested.get(pad.pad_ref)
        if setting is None:
            pads.append(pad)
            continue
        budget.visit({'pad_ref': pad.pad_ref})
        if pad.enabled is not True or pad.row_setting is None or pad.column_setting is None:
            raise JoystickPrerequisite('ENABLED_PAD_OR_CURRENT_VECTOR_MISSING')
        if setting.row not in pad.row_domain or setting.column not in pad.column_domain:
            raise JoystickPrerequisite('REQUESTED_VECTOR_OUTSIDE_ENABLED_PAD_DOMAIN')
        dr, dc = setting.row - pad.row_setting, setting.column - pad.column_setting
        gains = tuple(gain for ref, gain in model.pad_gains if ref == pad.pad_ref)
        if len(gains) != 1 and (dr or dc):
            raise JoystickPrerequisite('SCOPED_PAD_GAIN_NOT_UNIQUE')
        measured_delta = measured_setting_gain_delta(gains[0] if len(gains) == 1 else None, (dr, dc))
        if measured_delta is None:
            raise JoystickPrerequisite('REQUESTED_AXIS_GAIN_NOT_OBSERVED')
        displacement = deltas[pad.occurrence_ref]
        displacement[0] += measured_delta[0]
        displacement[1] += measured_delta[1]
        if dr or dc:
            costs = tuple(cost for ref, cost in model.pad_costs if ref == pad.pad_ref)
            if len(costs) != 1 or costs[0] < 0:
                if require_cost:
                    raise JoystickPrerequisite('CHANGED_PAD_COST_MISSING')
                cost_known = False
            changed.append(pad.pad_ref)
            base_cost += costs[0] if len(costs) == 1 and costs[0] >= 0 else 0
        pads.append(pad.model_copy(update={'row_setting': setting.row, 'column_setting': setting.column}))
    rows = []
    bodies = []
    for body in state.occurrences:
        budget.visit({'occurrence_ref': body.occurrence_ref})
        dr, dc = deltas[body.occurrence_ref]
        unwrapped = body.row + dr, body.column + dc
        signed_crossings = unwrapped[0] // model.height, unwrapped[1] // model.width
        bodies.append(body.model_copy(update={'row': unwrapped[0] % model.height, 'column': unwrapped[1] % model.width}))
        rows.append(d_map({'occurrence_ref': body.occurrence_ref, 'delta': (dr, dc),
            'unwrapped_endpoint': unwrapped, 'endpoint': (bodies[-1].row, bodies[-1].column),
            'aggregate_endpoint_axis_quotients': signed_crossings,
            'initial_offset': (body.row, body.column)}))
    return state.model_copy(update={'occurrences': tuple(bodies), 'pads': tuple(pads)}), tuple(rows), tuple(changed), base_cost if cost_known else None


def _preimages(model, state, occurrence_ref, request, budget):
    body = tuple(body for body in state.occurrences if body.occurrence_ref == occurrence_ref)
    if len(body) != 1:
        raise JoystickPrerequisite('CURRENT_OCCURRENCE_NOT_UNIQUE')
    pads = tuple(pad for pad in state.pads if pad.occurrence_ref == occurrence_ref)
    if any(pad.enabled is None for pad in pads):
        raise JoystickPrerequisite('ACTUATOR_AVAILABILITY_UNOBSERVED')
    enabled = tuple(pad for pad in pads if pad.enabled is True)
    if any(not pad.row_domain or not pad.column_domain or len(set(pad.row_domain)) != len(pad.row_domain)
        or len(set(pad.column_domain)) != len(pad.column_domain) for pad in enabled):
        raise JoystickPrerequisite('ENABLED_SETTING_DOMAIN_NOT_BIJECTIVE')
    count = prod(len(pad.row_domain) * len(pad.column_domain) for pad in enabled)
    if len(enabled) > request.depth_bound:
        raise DComputationInterrupted('ACTUATOR_DIMENSION_DEPTH_BOUND', d_map({
            'occurrence_ref': occurrence_ref, 'actuator_count': len(enabled)}))
    if count > request.domain_bound:
        raise DComputationInterrupted('ACTUATOR_PRODUCT_DOMAIN_BOUND', d_map({
            'occurrence_ref': occurrence_ref, 'domain_size': count}))
    domains = tuple(tuple(product(pad.row_domain, pad.column_domain)) for pad in enabled)
    result = []
    for values in product(*domains):
        settings = tuple(JoystickSetting(pad_ref=pad.pad_ref, row=value[0], column=value[1])
                         for pad, value in zip(enabled, values))
        following, trace, changed, cost = _delta(model, state, settings, budget, require_cost=False)
        end = tuple(item for item in following.occurrences if item.occurrence_ref == occurrence_ref)[0]
        from .modular_control_certificate_d import modular_control_certificate_d
        certificate=modular_control_certificate_d(model,body[0],enabled,settings,trace,budget)
        result.append(d_map({'position': (end.row, end.column), 'settings': settings,
            'changed_pad_refs': changed, 'changed_pad_cost': cost,'changed_pad_cost_known':cost is not None,
            'changed_settings':tuple(setting for setting in settings if setting.pad_ref in changed),
            'modular_control_certificate':certificate,'delta_trace': trace}))
    return tuple(result)


def _assignments(model, state, request, budget):
    domains = {body.occurrence_ref: _preimages(model, state, body.occurrence_ref, request, budget)
               for body in state.occurrences}
    assignments = []
    examined_targets = []
    for target in request.targets:
        if target.full_population_required is not True:
            raise JoystickPrerequisite('FULL_POPULATION_PREDICATE_NOT_BOUND')
        if len(target.slots) != len(state.occurrences) or len(set(slot.slot_ref for slot in target.slots)) != len(target.slots):
            examined_targets.append((target.target_ref, 'POPULATION_OR_SLOT_CARDINALITY_MISMATCH'))
            continue
        if any(not 0 <= slot.row < model.height or not 0 <= slot.column < model.width for slot in target.slots):
            examined_targets.append((target.target_ref, 'TARGET_TRANSLATION_WRAPS_OR_LEAVES_BOARD'))
            continue
        before = len(assignments)
        stack = [(0, (), frozenset())]
        while stack:
            index, members, used = stack.pop()
            if index > request.depth_bound:
                raise DComputationInterrupted('ASSIGNMENT_DEPTH_BOUND', d_map({
                    'target_ref': target.target_ref, 'next_occurrence_index': index, 'partial_members': members}))
            budget.visit({'target_ref': target.target_ref, 'next_occurrence_index': index,
                          'pending_assignment_frontier': tuple((item[0], item[1], tuple(sorted(item[2]))) for item in stack),
                          'partial_members': members})
            if index == len(state.occurrences):
                costs=tuple(member['preimage']['changed_pad_cost'] for member in members)
                assignments.append(d_map({'target_ref': target.target_ref, 'translation': target.translation,
                    'members': members,'changed_pad_cost_known':all(cost is not None for cost in costs),
                    'changed_pad_cost':sum(costs) if all(cost is not None for cost in costs) else None,
                    'complete_population_count':len(members),'target_image_modulo_applied':False}))
                if len(assignments) > request.domain_bound:
                    raise DComputationInterrupted('ASSIGNMENT_DOMAIN_BOUND', d_map({'returned_assignments': tuple(assignments)}))
                continue
            body = state.occurrences[index]
            following = []
            for slot in target.slots:
                if slot.slot_ref in used or slot.color_ref != body.color_ref:
                    continue
                for preimage in domains[body.occurrence_ref]:
                    budget.visit({'target_ref': target.target_ref, 'occurrence_ref': body.occurrence_ref,
                                  'slot_ref': slot.slot_ref})
                    if preimage['position'] == (slot.row, slot.column):
                        if len(stack) + len(following) >= request.domain_bound:
                            raise DComputationInterrupted('ASSIGNMENT_FRONTIER_BOUND', d_map({
                                'target_ref': target.target_ref, 'occurrence_index': index,
                                'partial_members': members, 'pending_count': len(stack) + len(following)}))
                        member = d_map({'occurrence_ref': body.occurrence_ref, 'slot_ref': slot.slot_ref, 'preimage': preimage})
                        following.append((index + 1, (*members, member), used | {slot.slot_ref}))
            stack.extend(reversed(following))
        examined_targets.append((target.target_ref, 'HAS_ASSIGNMENT' if len(assignments) > before else 'EMPTY_EXAMINED_ASSIGNMENT_DOMAIN'))
    return {'assignments': tuple(assignments), 'examined_targets': tuple(examined_targets),
            'equal_positions_with_distinct_settings_preserved': True, 'target_wrap_not_licensed_by_motion_wrap': True}


def _population_match(model, state, targets, budget):
    if not targets:
        raise JoystickPrerequisite('NONWRAPPING_ACCEPTANCE_TRANSLATIONS_MISSING')
    accepted = []
    for target in targets:
        budget.visit({'acceptance_target_ref': target.target_ref})
        if not target.full_population_required:
            raise JoystickPrerequisite('FULL_POPULATION_ACCEPTANCE_QUANTIFIER_MISSING')
        if len(set(slot.slot_ref for slot in target.slots)) != len(target.slots):
            raise JoystickPrerequisite('ACCEPTANCE_SLOT_IDENTITY_NOT_UNIQUE')
        if len(target.slots) != len(state.occurrences):
            continue
        if any(not 0 <= slot.row < model.height or not 0 <= slot.column < model.width for slot in target.slots):
            continue
        actual = tuple(sorted((body.color_ref, body.row, body.column) for body in state.occurrences))
        required = tuple(sorted((slot.color_ref, slot.row, slot.column) for slot in target.slots))
        if actual == required:
            accepted.append(target.target_ref)
    return tuple(accepted)


def _external(model, state, request, budget):
    _validate_state(model, state)
    if request.action_kind == 'reset':
        if model.reset_state is None or model.reset_cost is None or model.reset_lifecycle_ref is None:
            raise JoystickPrerequisite('INDEPENDENT_RESET_RESTORATION_LAW_MISSING')
        _validate_state(model, model.reset_state)
        return {'state': model.reset_state, 'debit': model.reset_cost, 'motion_trace': (),
                'lifecycle_ref': model.reset_lifecycle_ref, 'restoration_contract_ref': model.model_ref}
    if request.action_kind in ('select', 'cycle'):
        occurrence_ref = request.occurrence_ref
        if request.action_kind == 'cycle':
            active = tuple(body for body in state.occurrences if body.occurrence_ref == state.active_occurrence_ref)
            if len(active) != 1 or len(set(model.same_cell_cycle_order)) != len(model.same_cell_cycle_order):
                raise JoystickPrerequisite('ACTIVE_IDENTITY_OR_CYCLE_ORDER_NOT_BOUND')
            co_located = tuple(body.occurrence_ref for body in state.occurrences
                if (body.row, body.column) == (active[0].row, active[0].column))
            if any(ref not in model.same_cell_cycle_order for ref in co_located):
                raise JoystickPrerequisite('SAME_CELL_CYCLING_LAW_INCOMPLETE')
            cycle = tuple(ref for ref in model.same_cell_cycle_order if ref in co_located)
            if not cycle or state.active_occurrence_ref not in cycle:
                raise JoystickPrerequisite('SAME_CELL_CYCLE_OWNER_NOT_BOUND')
            occurrence_ref = cycle[(cycle.index(state.active_occurrence_ref) + 1) % len(cycle)]
        if occurrence_ref not in request.selectable_occurrence_refs:
            raise JoystickPrerequisite('CURRENT_SELECTION_HIT_NOT_BOUND')
        if occurrence_ref not in tuple(body.occurrence_ref for body in state.occurrences):
            raise JoystickPrerequisite('SELECTED_OCCURRENCE_OUTSIDE_POPULATION')
        if model.selection_cost is None or model.selection_pad_law not in ('clear_active_pad', 'preserve_active_pad'):
            raise JoystickPrerequisite('SELECTION_PROTOCOL_AND_COST_MISSING')
        return {'state': state.model_copy(update={'active_occurrence_ref': occurrence_ref,
            'active_pad_ref': None if model.selection_pad_law == 'clear_active_pad' else state.active_pad_ref}),
            'debit': model.selection_cost, 'motion_trace': (), 'wrap_count': 0}
    if request.action_kind not in ('set', 'nudge'):
        raise JoystickPrerequisite('EXTERNAL_INPUT_KIND_NOT_BOUND')
    pads = tuple(pad for pad in state.pads if pad.pad_ref == request.pad_ref)
    if len(pads) != 1 or pads[0].enabled is not True or pads[0].occurrence_ref != state.active_occurrence_ref:
        raise JoystickPrerequisite('ACTIVE_OCCURRENCE_ENABLED_PAD_BINDING_MISSING')
    pad = pads[0]
    if request.action_kind == 'nudge':
        if state.active_pad_ref != request.pad_ref:
            raise JoystickPrerequisite('NUDGE_PAD_IS_NOT_CURRENT_ACTIVE_CONTROL')
        if request.nudge is None or pad.row_setting is None or pad.column_setting is None:
            raise JoystickPrerequisite('NUDGE_OR_CURRENT_MARKER_MISSING')
        if not model.legal_nudge_vectors or request.nudge not in model.legal_nudge_vectors:
            raise JoystickPrerequisite('LEGAL_NUDGE_QUANTUM_NOT_BOUND')
        row, column = pad.row_setting + request.nudge[0], pad.column_setting + request.nudge[1]
        if model.nudge_bound_law != 'saturating' or not pad.row_domain or not pad.column_domain:
            raise JoystickPrerequisite('NUDGE_BOUND_LAW_MISSING')
        if len(set(pad.row_domain)) != max(pad.row_domain) - min(pad.row_domain) + 1 or len(set(pad.column_domain)) != max(pad.column_domain) - min(pad.column_domain) + 1:
            raise JoystickPrerequisite('NUDGE_INTEGER_INTERVAL_DOMAIN_NOT_BOUND')
        row = min(max(row, min(pad.row_domain)), max(pad.row_domain))
        column = min(max(column, min(pad.column_domain)), max(pad.column_domain))
        settings = (JoystickSetting(pad_ref=pad.pad_ref, row=row, column=column),)
        cost = model.nudge_cost
    else:
        settings = tuple(setting for setting in request.settings if setting.pad_ref == request.pad_ref)
        if len(settings) != 1 or len(request.settings) != 1:
            raise JoystickPrerequisite('ONE_EXTERNAL_SETTING_NOT_BOUND')
        costs = tuple(cost for ref, cost in model.pad_costs if ref == pad.pad_ref)
        cost = costs[0] if len(costs) == 1 and costs[0] >= 0 else None
    if cost is None or model.wrap_cost is None or model.stacking_allowed is not True:
        raise JoystickPrerequisite('INPUT_WRAP_COST_OR_STACKING_LAW_MISSING')
    following, trace, _, _ = _delta(model, state, settings, budget, require_cost=False)
    if model.crossing_count_law == 'sum_absolute_axis_crossings':
        crossings = sum(sum(abs(value) for value in row['aggregate_endpoint_axis_quotients']) for row in trace)
    elif model.crossing_count_law == 'one_per_external_input_with_any_wrap':
        crossings = int(any(any(row['aggregate_endpoint_axis_quotients']) for row in trace))
    else:
        raise JoystickPrerequisite('ACTUAL_WRAP_COUNT_LAW_MISSING')
    if model.draw_order_law == 'raise_moved_to_top_last':
        moved = tuple(row['occurrence_ref'] for row in trace if any(row['delta']))
        order = tuple(ref for ref in state.draw_order if ref not in moved) + moved
    elif model.draw_order_law == 'preserve':
        order = state.draw_order
    else:
        raise JoystickPrerequisite('DRAW_ORDER_CHANGE_LAW_MISSING')
    following = following.model_copy(update={'active_pad_ref': pad.pad_ref, 'draw_order': order})
    return {'state': following, 'motion_trace': trace, 'wrap_count': crossings,
        'debit': cost + crossings * model.wrap_cost}


def _atomic(model, state, request, budget):
    row = _external(model, state, request, budget)
    if request.action_kind != 'reset':
        if model.acceptance_law != 'complete_population_nonwrapping_color_arrangement' or model.acceptance_check_scope not in ('every_external_input', 'setting_inputs_only'):
            raise JoystickPrerequisite('FULL_POPULATION_ACCEPTANCE_LAW_OR_EVENT_SCOPE_MISSING')
        should_check = model.acceptance_check_scope == 'every_external_input' or request.action_kind in ('set', 'nudge')
        matches = _population_match(model, row['state'], request.targets, budget) if should_check else ()
        row.update({'accepted_target_refs': matches, 'accepted': bool(matches),
                    'acceptance_checked': should_check, 'lifecycle_ref': 'accepted' if matches else 'active'})
    row.update({'event_owner_ref': request.scope.event_owner_ref,
                'automatic_pass_already_owned': True, 'cost_already_owned': True})
    row['event_ledger'] = (d_map({'owner_ref': request.scope.event_owner_ref,
        'input_kind': request.action_kind, 'debit': row['debit'], 'wrap_count': row.get('wrap_count', 0),
        'direct_motion': row['motion_trace'], 'accepted': row.get('accepted', False),
        'lifecycle_ref': row['lifecycle_ref'], 'direct_automatic_cost_acceptance_owned': True}),)
    return row


def _fit_delta(model, request, budget):
    if not request.observations:
        raise JoystickPrerequisite('SEALED_ACTUATOR_TRANSITIONS_MISSING')
    result = []
    for index, observation in enumerate(request.observations):
        if observation.get('sealed') is not True or observation.get('before_state') is None or observation.get('after_state') is None or observation.get('settings') is None:
            raise JoystickPrerequisite('SEALED_BEFORE_AFTER_SETTING_SCOPE_MISSING')
        before = JoystickState.model_validate(observation['before_state'])
        after = JoystickState.model_validate(observation['after_state'])
        settings = tuple(JoystickSetting.model_validate(value) for value in observation['settings'])
        predicted, trace, _, _ = _delta(model, before, settings, budget, require_cost=False)
        predicted_positions = tuple(sorted((body.occurrence_ref, body.row, body.column) for body in predicted.occurrences))
        observed_positions = tuple(sorted((body.occurrence_ref, body.row, body.column) for body in after.occurrences))
        predicted_settings = tuple(sorted((pad.pad_ref, pad.row_setting, pad.column_setting) for pad in predicted.pads))
        observed_settings = tuple(sorted((pad.pad_ref, pad.row_setting, pad.column_setting) for pad in after.pads))
        result.append(d_map({'sample_index': index, 'positions_match': predicted_positions == observed_positions,
            'settings_match': predicted_settings == observed_settings, 'predicted_trace': trace,
            'crossing_observation': observation.get('wrap_counter_delta'),
            'endpoint_equality_is_not_crossing_evidence': True}))
    return {'coefficients': model.pad_gains,
            'observed_domain_fit': tuple(result)}


def _prepare_order(model, request, budget):
    if not request.preparation_words:
        raise JoystickPrerequisite('SOURCE_REQUESTED_PREPARATION_ORDERS_MISSING')
    results = []
    for word in request.preparation_words:
        if len(set(primitive.primitive_ref for primitive in word.primitives)) != len(word.primitives):
            raise JoystickPrerequisite('PREPARATION_EVENT_OWNER_REUSED')
        state, events, prefix = request.state, [], []
        for index, primitive in enumerate(word.primitives):
            if index >= request.depth_bound:
                raise DComputationInterrupted('PREPARATION_DEPTH_BOUND', d_map({'word_ref': word.word_ref,
                    'next_primitive_index': index, 'state': state, 'prefix': tuple(prefix), 'event_trace': tuple(events)}))
            scope = request.scope.model_copy(update={'event_owner_ref': primitive.primitive_ref})
            child = request.model_copy(update={'scope': scope, 'state': state,
                'action_kind': primitive.action_kind, 'occurrence_ref': primitive.occurrence_ref,
                'pad_ref': primitive.pad_ref, 'settings': primitive.settings, 'nudge': primitive.nudge,
                'selectable_occurrence_refs': primitive.selectable_occurrence_refs})
            row = _atomic(model, state, child, budget)
            state = row['state']
            events.extend(row['event_ledger'])
            prefix.append(primitive)
            if any(not any(body.occurrence_ref == ref and (body.row, body.column) == (r, c)
                for body in state.occurrences) for ref, r, c in request.preservation_positions):
                results.append(d_map({'word_ref': word.word_ref, 'primitive_index': index,
                    'preservation_violated': True, 'prefix': tuple(prefix), 'state': state, 'trace': tuple(events)}))
                break
            if row.get('accepted'):
                results.append(d_map({'word_ref': word.word_ref, 'state': state, 'accepted': True,
                    'word_complete': index + 1 == len(word.primitives), 'prefix': tuple(prefix), 'trace': tuple(events)}))
                break
        else:
            results.append(d_map({'word_ref': word.word_ref, 'state': state, 'word_complete': True,
                'prefix': tuple(prefix), 'trace': tuple(events), 'debit': sum(event['debit'] for event in events),
                'actual_wrap_count': sum(event['wrap_count'] for event in events)}))
    return {'word_results': tuple(results), 'endpoint_commutation_does_not_prove_path_equivalence': True}


def _command_binding(model, request, budget):
    if request.state is None:
        raise JoystickPrerequisite('CURRENT_CONTROL_SCOPE_MISSING')
    # Validate the proposed local operation before compiling its actual input.
    # Compiling a measured input does not require an already-known terminal
    # contract. Atomic simulation owns that separate acceptance obligation.
    row = _external(model, request.state, request, budget)
    if request.action_kind == 'set':
        geometry = tuple(item for item in request.control_geometries if item.pad_ref == request.pad_ref)
        settings = tuple(item for item in request.settings if item.pad_ref == request.pad_ref)
        if len(geometry) != 1 or len(settings) != 1:
            raise JoystickPrerequisite('CURRENT_PAD_GEOMETRY_OR_SETTING_NOT_UNIQUE')
        item, setting = geometry[0], settings[0]
        if item.scope_revision_ref != request.scope.evidence_revision_ref or item.geometry_status not in request.control_geometry_status_refs:
            raise JoystickPrerequisite('CURRENT_OR_CERTIFIED_CONTROL_GEOMETRY_NOT_BOUND')
        if len(set(item.row_values)) != len(item.row_values) or len(set(item.column_values)) != len(item.column_values):
            raise JoystickPrerequisite('CONTROL_GEOMETRY_INDEX_NOT_BIJECTIVE')
        if setting.row not in item.row_values or setting.column not in item.column_values:
            raise JoystickPrerequisite('SETTING_OUTSIDE_CURRENT_CALIBRATED_SUPPORT')
        if item.marker_row_inset >= item.row_pitch or item.marker_column_inset >= item.column_pitch or item.row_payload_key == item.column_payload_key:
            raise JoystickPrerequisite('INTERIOR_HIT_OR_NATIVE_COORDINATE_KEYS_INVALID')
        native_row = item.row_origin + item.row_values.index(setting.row) * item.row_pitch + item.marker_row_inset
        native_column = item.column_origin + item.column_values.index(setting.column) * item.column_pitch + item.marker_column_inset
        payload = FrozenMap.overlay(item.payload_template,
            {item.row_payload_key: native_row, item.column_payload_key: native_column})
        action_ref, geometry_ref = item.action_ref, item.evidence_ref
    else:
        if request.bound_action_ref is None:
            raise JoystickPrerequisite('CURRENT_DISCRETE_OR_SELECTION_INPUT_NOT_BOUND')
        action_ref, payload, geometry_ref = request.bound_action_ref, request.bound_payload, None
    return {'primitive_prefix': (d_map({'action_ref': action_ref, 'payload': payload}),),
        'control_geometry_evidence_ref': geometry_ref, 'expected_control_motion_successor': d_map(row),
        'frozen_prerequisites': request.scope.assumption_refs, 'release_authorized': False}


def _compare_packet(model, request, budget):
    if not request.observations:
        raise JoystickPrerequisite('SEALED_CONTROL_PACKET_MISSING')
    events, previous_index, first_divergence = [], -1, None
    input_owners = {}
    owner_indices = {}
    packet_states = []
    owner_images = {}
    for index, sample in enumerate(request.observations):
        budget.visit({'packet_sample_index': index})
        if sample.get('sealed') is not True or not sample.get('event_owner_ref') or sample.get('primitive_index') is None:
            raise JoystickPrerequisite('SEALED_INTERVAL_AND_INPUT_OWNER_MISSING')
        primitive_index = sample['primitive_index']
        if type(primitive_index) is not int or primitive_index < 0 or primitive_index < previous_index:
            raise JoystickPrerequisite('ORDERED_INPUT_INTERVALS_MISSING')
        previous_index = primitive_index
        owner = sample['event_owner_ref']
        if primitive_index in input_owners and input_owners[primitive_index] != owner:
            raise JoystickPrerequisite('ONE_PRIMITIVE_HAS_INCOMPATIBLE_OWNERS')
        if owner in owner_indices and owner_indices[owner] != primitive_index:
            raise JoystickPrerequisite('ONE_OWNER_IS_REUSED_FOR_DIFFERENT_INPUTS')
        input_owners[primitive_index] = owner
        owner_indices[owner] = primitive_index
        raw_state = sample.get('state')
        if raw_state is None:
            raise JoystickPrerequisite('OBSERVED_CONTROL_STATE_MISSING')
        observed = JoystickState.model_validate(raw_state)
        _validate_state(model, observed)
        signature = stable_digest(observed)
        repeated = signature in owner_images.setdefault(sample['event_owner_ref'], set())
        owner_images[sample['event_owner_ref']].add(signature)
        expected_raw = sample.get('expected_state')
        mismatches = []
        if expected_raw is not None and sample.get('stable') is True:
            expected = JoystickState.model_validate(expected_raw)
            for field in ('occurrences', 'pads', 'active_occurrence_ref', 'active_pad_ref', 'draw_order'):
                actual_value, expected_value = getattr(observed, field), getattr(expected, field)
                if field == 'occurrences':
                    actual_value = tuple(sorted(actual_value, key=lambda body: body.occurrence_ref))
                    expected_value = tuple(sorted(expected_value, key=lambda body: body.occurrence_ref))
                elif field == 'pads':
                    actual_value = tuple(sorted(actual_value, key=lambda pad: pad.pad_ref))
                    expected_value = tuple(sorted(expected_value, key=lambda pad: pad.pad_ref))
                if actual_value != expected_value:
                    mismatches.append(field)
            if mismatches and first_divergence is None:
                first_divergence = d_map({'packet_sample_index': index, 'primitive_index': primitive_index,
                    'event_owner_ref': sample['event_owner_ref'], 'fields': tuple(mismatches)})
        events.append(d_map({'sample_index': index, 'primitive_index': primitive_index,
            'event_owner_ref': sample['event_owner_ref'], 'state': observed,
            'stable': sample.get('stable'), 'repeated_same_owner_image': repeated,
            'wrap_counter_delta': sample.get('wrap_counter_delta'),
            'official_completion_receipt_ref': sample.get('official_completion_receipt_ref'),
            'expected_state_mismatches': tuple(mismatches)}))
        if sample.get('stable') is True:
            packet_states.append(observed)
    return {'ordered_samples': tuple(events), 'stable_states': tuple(packet_states),
        'first_divergence': first_divergence, 'animation_frames_not_added_to_input_or_crossing_counts': True,
        'current_knob_state_not_reconstructed_from_body_position': True}


def _recovery_facts(model, request, budget):
    if not request.observations:
        raise JoystickPrerequisite('SCOPED_RECOVERY_DEPENDENCIES_MISSING')
    rows = []
    for item in request.observations:
        budget.visit()
        if not item.get('dependency_ref') or item.get('evidence_revision_ref') is None or item.get('model_revision_ref') is None:
            raise JoystickPrerequisite('NAMED_RECOVERY_DEPENDENCY_OR_REVISIONS_MISSING')
        evidence_same = item['evidence_revision_ref'] == request.scope.evidence_revision_ref
        model_same = item['model_revision_ref'] == request.scope.model_revision_ref
        rows.append(d_map({'dependency_ref': item['dependency_ref'], 'evidence_revision_same': evidence_same,
            'model_revision_same': model_same, 'portable_evidence_ref': item.get('portable_evidence_ref'),
            'current_revalidation_ref': item.get('current_revalidation_ref'),
            'restoration_obligation_ref': item.get('restoration_obligation_ref'),
            'information_experiment_ref': item.get('information_experiment_ref'),
            'advisory_only': item.get('advisory_only'), 'dirty_dimensions': item.get('dirty_dimensions', ())}))
    return {'dependency_comparisons': tuple(rows), 'reset_state_law_available': model.reset_state is not None,
        'reset_restoration_contract_ref': model.model_ref if model.reset_state is not None else None,
        'relevance_and_focus_counter_are_source_owned': True}


def measure_bounded_joystick(request: BoundedJoystickRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget = DWorkBudget(request)
    operation = request.operation_ref.rsplit('.', 1)[-1]
    rows = []
    current_model_ref = None
    try:
        if operation in ('grid_roles', 'identity_and_occlusion', 'control_state', 'recovery_and_focus'):
            from .joystick_observation_a import measure_joystick_observation_a
            return measure_joystick_observation_a(request)
        if request.state is None:
            raise JoystickPrerequisite('CURRENT_POPULATION_AND_KNOB_STATE_MISSING')
        if not request.models:
            raise JoystickPrerequisite('SCOPED_ACTUATOR_MODELS_MISSING')
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit()
            if operation == 'delta_model' and request.mode_ref == 'PREDICT':
                following, trace, changed, cost = _delta(model, request.state, request.settings, budget, require_cost=False)
                row = {'state': following, 'motion_trace': trace, 'changed_pad_refs': changed, 'changed_pad_cost': cost}
            elif operation == 'delta_model' and request.mode_ref == 'FIT':
                row = _fit_delta(model, request, budget)
            elif operation == 'reachable_preimages':
                if request.occurrence_ref is None:
                    raise JoystickPrerequisite('REQUESTED_OCCURRENCE_MISSING')
                row = {'preimages': _preimages(model, request.state, request.occurrence_ref, request, budget)}
            elif operation == 'feasible_assignment':
                if not request.targets:
                    raise JoystickPrerequisite('NONWRAPPING_TARGET_TRANSLATIONS_MISSING')
                row = _assignments(model, request.state, request, budget)
            elif operation == 'external_primitive':
                row = _atomic(model, request.state, request, budget)
            elif operation == 'prepare_order':
                row = _prepare_order(model, request, budget)
            elif operation == 'command_binding':
                row = _command_binding(model, request, budget)
            elif operation == 'reconcile_packet':
                row = _compare_packet(model, request, budget)
            elif operation == 'recovery_and_focus':
                row = _recovery_facts(model, request, budget)
                return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION',
                    values={'model_ref': model.model_ref, 'dependency_comparisons': d_map(row)},
                    examined=budget.examined, frontier=d_resumable_frontier(request, rows, model.model_ref))
            else:
                return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION',
                    examined=budget.examined, frontier=d_resumable_frontier(request, rows, model.model_ref))
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'COMPLETE', 'REQUESTED_FINITE_CALCULATION_RETURNED',
            values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except (JoystickPrerequisite, DResumeMismatch) as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DComputationInterrupted as error:
        return d_result(request, 'NEEDS_EVIDENCE', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
