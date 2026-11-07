"""Exact workshop profile, control and authentication laws supplied by Source.

Abstract profile closure is not station access, focus is not grasp and current
equality is not an acquired receipt. No semantic choice or action release.
"""
from __future__ import annotations

from typing import ClassVar
from pydantic import Field
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid, ComponentDescription
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .stem_reliefs import measure_stem_reliefs, measure_ranked_cuts
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)


class WorkshopKey(FrozenModel):
    key_ref: Ref
    profile: tuple[int, ...] = Field(min_length=1, max_length=32)


class WorkshopReceipt(FrozenModel):
    lock_ref: Ref
    key_ref: Ref
    authenticated_profile: tuple[int, ...] = Field(min_length=1, max_length=32)
    event_owner_ref: Ref
    trial_ref: Ref


class WorkshopTrial(FrozenModel):
    trial_ref: Ref
    lock_ref: Ref
    key_ref: Ref
    trial_profile: tuple[int, ...] = Field(min_length=1, max_length=32)
    signed_differences: tuple[int, ...] = Field(min_length=1, max_length=32)
    accepted: bool
    event_owner_ref: Ref


class WorkshopState(FrozenModel):
    keys: tuple[WorkshopKey, ...] = Field(min_length=1, max_length=32)
    slot_key_refs: tuple[Ref, ...] = Field(min_length=1, max_length=32)
    focus_slot_ref: Ref | None
    held_key_ref: Ref | None
    receipts: tuple[WorkshopReceipt, ...] = Field(default=(), max_length=128)
    trial: WorkshopTrial | None = None
    reserve: int = Field(ge=0)
    terminated: bool


class WorkshopOperator(FrozenModel):
    operator_ref: Ref
    rank_permutation: tuple[int, ...] = Field(min_length=1, max_length=32)
    value_delta: int | None = None
    value_relation: tuple[tuple[int, int], ...] = Field(default=(), max_length=128)


class WorkshopStation(FrozenModel):
    slot_ref: Ref
    operator_ref: Ref
    evidence_ref: Ref


class WorkshopLock(FrozenModel):
    lock_ref: Ref
    slot_ref: Ref
    real: bool
    profile: tuple[int, ...] = Field(default=(), max_length=32)
    observed_support: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    evidence_ref: Ref


class WorkshopModel(FrozenModel):
    model_ref: Ref
    slot_refs: tuple[Ref, ...] = Field(min_length=1, max_length=32)
    key_refs: tuple[Ref, ...] = Field(min_length=1, max_length=32)
    operators: tuple[WorkshopOperator, ...] = Field(default=(), max_length=32)
    operator_domain_complete: bool = False
    stations: tuple[WorkshopStation, ...] = Field(default=(), max_length=32)
    locks: tuple[WorkshopLock, ...] = Field(default=(), max_length=128)
    required_lock_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    minimum_value: int
    maximum_value: int
    point_unheld_law_ref: Ref | None = None
    point_held_law_ref: Ref | None = None
    directional_law_ref: Ref | None = None
    grasp_law_ref: Ref | None = None
    display_law_ref: Ref | None = None
    comparison_law_ref: Ref | None = None
    feedback_sign: int | None = None
    receipt_retention_ref: Ref | None = None
    reusability_ref: Ref | None = None
    acceptance_law_ref: Ref | None = None
    terminal_order_ref: Ref | None = None
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=16)
    reset_state: WorkshopState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class WorkshopInput(FrozenModel):
    kind_ref: Ref
    slot_ref: Ref | None = None
    direction: int | None = None
    operator_ref: Ref | None = None
    lock_ref: Ref | None = None
    trial_ref: Ref | None = None


class WorkshopBinding(FrozenModel):
    primitive: WorkshopInput
    action_ref: Ref
    payload: FrozenMap
    support_ref: Ref | None = None
    evidence_revision_ref: Ref


class WorkshopMarkerSupport(FrozenModel):
    measurement_ref: Ref
    pixels: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    evidence_revision_ref: Ref


_CASES = (
    ('row_profile_measure', ('MEASURE',)), ('trial_feedback_fit', ('FIT',)),
    ('profile_operator_domain', ('DOMAIN',)), ('provider_preimage_domain', ('INVERSE_DOMAIN',)),
    ('slot_control_step', ('STEP',)), ('profile_tool_step', ('STEP',)),
    ('profile_authentication_step', ('STEP',)), ('costed_workshop_domain', ('DOMAIN',)),
    ('workshop_input_compile', ('COMPILE',)), ('sealed_workshop_compare', ('COMPARE',)),
    ('external_primitive', ('STEP',)),
)


class StationWorkbenchRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.station_workbench_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.station_profile_workbench.{operation}', mode)
        for operation, modes in _CASES for mode in modes)
    models: tuple[WorkshopModel, ...] = Field(default=(), max_length=32)
    state: WorkshopState | None = None
    primitive: WorkshopInput | None = None
    native_inputs: tuple[WorkshopInput, ...] = Field(default=(), max_length=4096)
    native_input_domain_complete: bool = False
    bindings: tuple[WorkshopBinding, ...] = Field(default=(), max_length=4096)
    words: tuple[tuple[WorkshopInput, ...], ...] = Field(default=(), max_length=3)
    frame: FrameGrid | None = None
    components: tuple[ComponentDescription, ...] = Field(default=(), max_length=128)
    stem_configuration: FrozenMap = Field(default_factory=FrozenMap)
    ranked_cut_requests: tuple[FrozenMap, ...] = Field(default=(), max_length=128)
    marker_supports: tuple[WorkshopMarkerSupport, ...] = Field(default=(), max_length=128)


class WorkshopPrerequisite(Exception):
    pass


def _measure(request, budget):
    required = ('minimum_rank_count', 'maximum_rank_count', 'maximum_component_count',
        'maximum_alternatives_per_component', 'axis_directions')
    if not request.components or any(key not in request.stem_configuration for key in required):
        raise WorkshopPrerequisite('CURRENT_COMPONENTS_AND_DECLARED_RELIEF_MEASUREMENT_SCOPE_MISSING')
    if request.frame is None:
        raise WorkshopPrerequisite('CURRENT_NATIVE_FRAME_FOR_COMPONENT_PROVENANCE_MISSING')
    if request.frame.height * request.frame.width > request.domain_bound:
        raise DComputationInterrupted('NATIVE_FRAME_PIXEL_DOMAIN_BOUND', d_map())
    if any(not isinstance(request.stem_configuration[key], int) or isinstance(request.stem_configuration[key], bool)
            or not 1 <= request.stem_configuration[key] <= request.domain_bound for key in required[:-1]):
        raise WorkshopPrerequisite('EXACT_BOUNDED_INTEGER_RELIEF_CONFIGURATION_REQUIRED')
    if len(request.components) > request.stem_configuration['maximum_component_count']:
        raise DComputationInterrupted('COMPONENT_MEASUREMENT_DOMAIN_BOUND', d_map())
    profiles, cuts, unresolved_components, alternative_count = [], [], [], 0
    pixels = sum(component.area for component in request.components)
    if pixels > request.domain_bound:
        raise DComputationInterrupted('MEASURED_COMPONENT_PIXEL_DOMAIN_BOUND', d_map())
    for component in request.components:
        budget.visit({'component_ref': component.component_id})
        for row, column in component.pixels:
            budget.visit({'component_pixel': (row, column)})
            if not (0 <= row < request.frame.height and 0 <= column < request.frame.width) or request.frame.rows[row][column] != component.value:
                raise WorkshopPrerequisite('COMPONENT_MASK_NOT_SUPPORTED_BY_CURRENT_NATIVE_FRAME')
        facts = measure_stem_reliefs((component,), request.stem_configuration)
        budget.visit({'completed_relief_component_ref': component.component_id})
        row = facts.get(component.component_id)
        if row is not None:
            if row['stem_relief_domain_truncated']:
                raise DComputationInterrupted('STEM_ALTERNATIVE_DOMAIN_BOUND', d_map({'component_ref': component.component_id}))
            alternative_count += row['stem_relief_alternative_count']
            if alternative_count > request.domain_bound:
                raise DComputationInterrupted('TOTAL_RELIEF_ALTERNATIVE_DOMAIN_BOUND', d_map())
            profiles.append(d_map(row))
        else:
            unresolved_components.append(component.component_id)
    if request.ranked_cut_requests:
        if request.frame is None or request.frame.height * request.frame.width > request.domain_bound:
            raise WorkshopPrerequisite('CURRENT_BOUNDED_FRAME_FOR_REFERENCE_CUTS_MISSING')
        fields = ('rank_columns', 'rank_width', 'reference_row', 'reference_columns', 'reference_value',
            'band_top', 'band_bottom', 'upper_value', 'lower_value')
        for index, row in enumerate(request.ranked_cut_requests):
            budget.visit({'ranked_cut_request_index': index})
            if any(key not in row for key in fields) or not row.get('measurement_ref'):
                raise WorkshopPrerequisite('DECLARED_REFERENCE_BASELINE_AND_RANK_SUPPORTS_MISSING')
            measured = measure_ranked_cuts(request.frame.rows, **{key: row[key] for key in fields})
            cuts.append(d_map({'measurement_ref': row['measurement_ref'], 'measurement': d_map(measured)}))
            budget.visit({'completed_cut_request_index': index})
    if sum(len(marker.pixels) for marker in request.marker_supports) > request.domain_bound:
        raise DComputationInterrupted('MARKER_PIXEL_DOMAIN_BOUND', d_map())
    if any(marker.evidence_revision_ref != request.scope.evidence_revision_ref or len(set(marker.pixels)) != len(marker.pixels)
            for marker in request.marker_supports):
        raise WorkshopPrerequisite('CURRENT_UNIQUE_MARKER_SUPPORT_PROVENANCE_REQUIRED')
    return {'stem_relief_measurements': tuple(profiles), 'reference_cut_measurements': tuple(cuts),
        'components_without_retained_rank_measurement': tuple(unresolved_components),
        'source_bound_marker_supports': request.marker_supports,
        'pixel_measurements_are_not_calibrated_lock_requirements': True,
        'focus_and_grasp_not_inferred_from_profile_equality': True}


def _state(model, state, budget):
    if model.minimum_value > model.maximum_value:
        raise WorkshopPrerequisite('BOUNDED_PROFILE_VALUE_INTERVAL_INVALID')
    if len(set(model.slot_refs)) != len(model.slot_refs) or len(set(model.key_refs)) != len(model.key_refs):
        raise WorkshopPrerequisite('UNIQUE_SLOT_AND_KEY_IDENTITIES_REQUIRED')
    if len(model.slot_refs) != len(model.key_refs) or len(model.slot_refs) > budget.request.domain_bound:
        raise WorkshopPrerequisite('COMPLETE_WORKSHOP_POPULATION_SLOT_DOMAIN_INVALID')
    keys = {}
    for key in state.keys:
        budget.visit({'key_ref': key.key_ref})
        if key.key_ref in keys or key.key_ref not in model.key_refs or any(not model.minimum_value <= value <= model.maximum_value for value in key.profile):
            raise WorkshopPrerequisite('CURRENT_KEY_IDENTITY_OR_PROFILE_NOT_VALID')
        keys[key.key_ref] = key
    if set(keys) != set(model.key_refs) or len(state.slot_key_refs) != len(model.slot_refs) or set(state.slot_key_refs) != set(keys):
        raise WorkshopPrerequisite('COMPLETE_BIJECTIVE_SLOT_PERMUTATION_MISSING')
    if state.focus_slot_ref is not None and state.focus_slot_ref not in model.slot_refs:
        raise WorkshopPrerequisite('CURRENT_FOCUS_SLOT_NOT_IN_WORKSHOP')
    if state.held_key_ref is not None and state.held_key_ref not in keys:
        raise WorkshopPrerequisite('HELD_KEY_IDENTITY_NOT_IN_POPULATION')
    operators = {operator.operator_ref: operator for operator in model.operators}
    stations = {station.slot_ref: station for station in model.stations}
    locks = {lock.lock_ref: lock for lock in model.locks}
    if len(operators) != len(model.operators) or len(stations) != len(model.stations) or len(locks) != len(model.locks):
        raise WorkshopPrerequisite('OPERATORS_STATIONS_AND_LOCK_IDENTITIES_NOT_UNIQUE')
    if any(ref not in model.slot_refs for ref in sorted(stations)):
        raise WorkshopPrerequisite('FIXED_STATION_NOT_BOUND_TO_CURRENT_SLOT')
    if any(lock.slot_ref not in model.slot_refs or (lock.real and not lock.observed_support) for lock in model.locks):
        raise WorkshopPrerequisite('REAL_LOCK_OBSERVED_SUPPORT_MISSING')
    if len(set(model.required_lock_refs)) != len(model.required_lock_refs) or any(ref not in locks or not locks[ref].real for ref in model.required_lock_refs):
        raise WorkshopPrerequisite('REQUIRED_REAL_LOCK_SET_NOT_VALID')
    acquired = set()
    for receipt in state.receipts:
        if receipt.lock_ref in acquired or receipt.lock_ref not in locks or not locks[receipt.lock_ref].real or receipt.key_ref not in keys:
            raise WorkshopPrerequisite('PERSISTENT_ACQUISITION_RECEIPT_IDENTITY_NOT_VALID')
        if not receipt.event_owner_ref or not receipt.trial_ref or (locks[receipt.lock_ref].profile and receipt.authenticated_profile != locks[receipt.lock_ref].profile):
            raise WorkshopPrerequisite('ACQUIRED_RECEIPT_PROFILE_OR_PROVENANCE_NOT_VALID')
        if model.receipt_retention_ref == 'invalidate_changed_provider_profile' and keys[receipt.key_ref].profile != receipt.authenticated_profile:
            raise WorkshopPrerequisite('PROFILE_DEPENDENT_RECEIPT_STALE')
        acquired.add(receipt.lock_ref)
    if state.trial is not None and (state.trial.key_ref not in keys or state.trial.lock_ref not in locks
            or len(state.trial.trial_profile) != len(state.trial.signed_differences)
            or state.trial.accepted != (not any(state.trial.signed_differences))
            or not state.trial.event_owner_ref or not state.trial.trial_ref):
        raise WorkshopPrerequisite('RETAINED_TRIAL_IDENTITY_LENGTH_OR_PROVENANCE_NOT_VALID')
    return keys, operators, stations, locks, frozenset(acquired)


def _operator(model, operator, profile, budget):
    budget.visit({'operator_ref': operator.operator_ref, 'input_profile': profile})
    if set(operator.rank_permutation) != set(range(len(operator.rank_permutation))):
        raise WorkshopPrerequisite('DECLARED_RANK_PERMUTATION_NOT_BIJECTIVE')
    if len(operator.rank_permutation) != len(profile):
        return profile, 'GLOBAL_RANK_LENGTH_DOMAIN_REFUSAL'
    if (operator.value_delta is None) == (not operator.value_relation):
        raise WorkshopPrerequisite('EXACTLY_ONE_VALUE_TRANSFORM_REQUIRED')
    relation = dict(operator.value_relation)
    if len(relation) != len(operator.value_relation):
        raise WorkshopPrerequisite('VALUE_TRANSFORM_RELATION_NOT_FUNCTIONAL')
    reordered = tuple(profile[index] for index in operator.rank_permutation)
    if operator.value_delta is None and any(value not in relation for value in reordered):
        return profile, 'GLOBAL_VALUE_DOMAIN_REFUSAL'
    transformed = tuple(value + operator.value_delta if operator.value_delta is not None else relation[value] for value in reordered)
    if any(not model.minimum_value <= value <= model.maximum_value for value in transformed):
        return profile, 'GLOBAL_BOUNDED_VALUE_REFUSAL'
    return transformed, None


def _profile_closure(model, profile, request, budget):
    if not model.operator_domain_complete:
        raise WorkshopPrerequisite('COMPLETE_ABSTRACT_OPERATOR_DOMAIN_NOT_SUPPLIED')
    if not model.operators:
        return {'profiles': (profile,), 'operator_edges': (), 'complete_abstract_orbit': True,
            'station_access_proved': False, 'minimum_workshop_cost_claimed': False}
    pending, seen, edges, cursor = [(profile, 0)], {profile}, [], 0
    while cursor < len(pending):
        source, depth = pending[cursor]
        cursor += 1
        for operator in model.operators:
            after, refusal = _operator(model, operator, source, budget)
            edges.append(d_map({'before_profile': source, 'operator_ref': operator.operator_ref,
                'after_profile': after, 'refusal_cause': refusal,
                'station_access_slot_refs': tuple(station.slot_ref for station in model.stations if station.operator_ref == operator.operator_ref)}))
            if len(edges) > request.domain_bound:
                raise DComputationInterrupted('ABSTRACT_PROFILE_EDGE_DOMAIN_BOUND', d_map({'next_profile_index': cursor}))
            if refusal is None and after not in seen:
                if depth >= request.depth_bound:
                    raise DComputationInterrupted('ABSTRACT_PROFILE_COMPOSITION_DEPTH_BOUND', d_map())
                if len(seen) >= request.domain_bound:
                    raise DComputationInterrupted('ABSTRACT_PROFILE_ORBIT_DOMAIN_BOUND', d_map())
                seen.add(after)
                pending.append((after, depth + 1))
    return {'profiles': tuple(sorted(seen)), 'operator_edges': tuple(edges), 'complete_abstract_orbit': True,
        'station_access_proved': False, 'minimum_workshop_cost_claimed': False,
        'no_executable_route_words_materialized': True}


def _providers(model, request, budget):
    keys, _, _, locks, acquired = _state(model, request.state, budget)
    if model.reusability_ref not in ('reusable', 'single_acceptance_per_key'):
        raise WorkshopPrerequisite('PROVIDER_REUSE_CAPACITY_LAW_MISSING')
    orbits = {ref: _profile_closure(model, keys[ref].profile, request, budget) for ref in sorted(keys)}
    used = frozenset(receipt.key_ref for receipt in request.state.receipts)
    requirements = tuple(ref for ref in model.required_lock_refs if ref not in acquired)
    compatibility = []
    for lock_ref in requirements:
        lock = locks[lock_ref]
        if not lock.profile:
            raise WorkshopPrerequisite('CURRENT_CALIBRATED_REQUIRED_PROFILE_MISSING')
        providers = []
        for key_ref in sorted(keys):
            budget.visit({'lock_ref': lock_ref, 'key_ref': key_ref})
            if model.reusability_ref == 'single_acceptance_per_key' and key_ref in used:
                continue
            if lock.profile in orbits[key_ref]['profiles']:
                providers.append(key_ref)
        compatibility.append(d_map({'lock_ref': lock_ref, 'provider_refs': tuple(providers),
            'required_profile': lock.profile, 'station_transport_not_proved': True}))
    assignments = []
    if len(requirements) > request.depth_bound:
        raise DComputationInterrupted('PROVIDER_ASSIGNMENT_DEPTH_BOUND', d_map())

    def compose(index, prefix, unavailable):
        budget.visit({'provider_requirement_index': index})
        if index == len(compatibility):
            if len(assignments) >= request.domain_bound:
                raise DComputationInterrupted('PROVIDER_ASSIGNMENT_DOMAIN_BOUND', d_map())
            assignments.append(prefix)
            return
        row = compatibility[index]
        for ref in row['provider_refs']:
            if ref not in unavailable:
                compose(index + 1, prefix + ((row['lock_ref'], ref),),
                    unavailable | {ref} if model.reusability_ref == 'single_acceptance_per_key' else unavailable)

    compose(0, (), used if model.reusability_ref == 'single_acceptance_per_key' else frozenset())
    return {'conditional_provider_matrix': tuple(compatibility), 'provider_assignments': tuple(assignments),
        'abstract_key_orbits': tuple(d_map({'key_ref': ref, 'orbit': d_map(orbits[ref])}) for ref in sorted(orbits)),
        'complete_in_abstract_transform_domain': True, 'workshop_transport_not_proved': True}


def _display(model, state, changed):
    if not changed:
        return state
    if model.display_law_ref not in ('persistent_until_trial', 'clear_on_committed_change'):
        raise WorkshopPrerequisite('TRIAL_DISPLAY_RETENTION_OR_RESET_LAW_MISSING')
    return state.model_copy(update={'trial': None}) if changed and model.display_law_ref == 'clear_on_committed_change' else state


def _control(model, state, primitive, budget):
    _input_shape(primitive)
    _state(model, state, budget)
    held, slots = state.held_key_ref, model.slot_refs
    current_index = state.slot_key_refs.index(held) if held is not None else None
    if primitive.kind_ref == 'grasp_toggle':
        if model.grasp_law_ref != 'release_current_else_grasp_focus':
            raise WorkshopPrerequisite('FOCUS_VERSUS_GRASP_TOGGLE_LAW_MISSING')
        if held is not None:
            after, effect = state.model_copy(update={'held_key_ref': None}), 'RELEASE_GRASP'
        elif state.focus_slot_ref is None:
            return {'state': state, 'effect_ref': 'NO_FOCUS_GRASP_REFUSAL'}
        else:
            after = state.model_copy(update={'held_key_ref': state.slot_key_refs[slots.index(state.focus_slot_ref)]})
            effect = 'GRASP_FOCUSED_OWNER'
        return {'state': _display(model, after, True), 'effect_ref': effect}
    if primitive.kind_ref == 'point_slot':
        if primitive.slot_ref not in slots:
            raise WorkshopPrerequisite('CURRENT_NATIVE_SLOT_SUPPORT_NOT_BOUND')
        target_index = slots.index(primitive.slot_ref)
        if held is None:
            if model.point_unheld_law_ref != 'focus_only':
                raise WorkshopPrerequisite('UNHELD_SLOT_POINT_LAW_MISSING')
        elif model.point_held_law_ref == 'adjacent_exchange_else_refuse':
            if abs(target_index - current_index) != 1:
                return {'state': state, 'effect_ref': 'NONADJACENT_HELD_POINT_REFUSAL'}
            permutation = list(state.slot_key_refs)
            permutation[current_index], permutation[target_index] = permutation[target_index], permutation[current_index]
            after = state.model_copy(update={'slot_key_refs': tuple(permutation), 'focus_slot_ref': slots[target_index]})
            return {'state': _display(model, after, True), 'effect_ref': 'ADJACENT_EXCHANGE',
                'exchanged_key_refs': (held, state.slot_key_refs[target_index]), 'stations_remain_fixed': True}
        elif model.point_held_law_ref != 'focus_only_keep_held':
            raise WorkshopPrerequisite('HELD_SLOT_POINT_ORDER_LAW_MISSING')
        after = state.model_copy(update={'focus_slot_ref': primitive.slot_ref})
        return {'state': _display(model, after, state.focus_slot_ref != primitive.slot_ref),
            'effect_ref': 'FOCUS_ONLY', 'held_identity_not_transported': True}
    if primitive.kind_ref == 'direction':
        if primitive.direction not in (-1, 1) or model.directional_law_ref != 'held_exchange_unheld_focus_step':
            raise WorkshopPrerequisite('BOUNDED_SLOT_DIRECTION_LAW_MISSING')
        if held is None and state.focus_slot_ref is None:
            return {'state': state, 'effect_ref': 'NO_FOCUS_DIRECTION_REFUSAL'}
        origin = current_index if held is not None else slots.index(state.focus_slot_ref)
        target_index = origin + primitive.direction
        if not 0 <= target_index < len(slots):
            return {'state': state, 'effect_ref': 'SLOT_BOUNDARY_REFUSAL'}
        if held is None:
            after = state.model_copy(update={'focus_slot_ref': slots[target_index]})
            return {'state': _display(model, after, True), 'effect_ref': 'FOCUS_STEP'}
        permutation = list(state.slot_key_refs)
        permutation[origin], permutation[target_index] = permutation[target_index], permutation[origin]
        after = state.model_copy(update={'slot_key_refs': tuple(permutation), 'focus_slot_ref': slots[target_index]})
        return {'state': _display(model, after, True), 'effect_ref': 'ADJACENT_EXCHANGE',
            'exchanged_key_refs': (held, state.slot_key_refs[target_index]), 'stations_remain_fixed': True}
    raise WorkshopPrerequisite('CONTROL_INPUT_KIND_NOT_DECLARED')


def _tool(model, state, primitive, budget):
    _input_shape(primitive)
    keys, operators, stations, _, _ = _state(model, state, budget)
    if primitive.kind_ref != 'tool':
        raise WorkshopPrerequisite('EXPLICIT_TOOL_TRIGGER_MISSING')
    if state.held_key_ref is None:
        return {'state': state, 'effect_ref': 'UNHELD_TOOL_REFUSAL'}
    slot = model.slot_refs[state.slot_key_refs.index(state.held_key_ref)]
    if slot not in stations:
        return {'state': state, 'effect_ref': 'NO_STATION_TOOL_REFUSAL'}
    if stations[slot].operator_ref not in operators:
        raise WorkshopPrerequisite('CURRENT_STATION_OPERATOR_LAW_MISSING')
    operator = operators[stations[slot].operator_ref]
    if primitive.operator_ref is not None and primitive.operator_ref != operator.operator_ref:
        raise WorkshopPrerequisite('REQUESTED_OPERATOR_NOT_CURRENT_FIXED_STATION')
    profile, refusal = _operator(model, operator, keys[state.held_key_ref].profile, budget)
    if refusal is not None:
        return {'state': state, 'effect_ref': refusal, 'operator_ref': operator.operator_ref}
    if model.receipt_retention_ref not in ('persistent', 'invalidate_changed_provider_profile'):
        raise WorkshopPrerequisite('ACQUIRED_RECEIPT_RETENTION_LAW_MISSING')
    changed = tuple(key.model_copy(update={'profile': profile}) if key.key_ref == state.held_key_ref else key for key in state.keys)
    receipts = state.receipts if model.receipt_retention_ref == 'persistent' else tuple(receipt for receipt in state.receipts
        if receipt.key_ref != state.held_key_ref or receipt.authenticated_profile == profile)
    after = state.model_copy(update={'keys': changed, 'receipts': receipts})
    return {'state': _display(model, after, True), 'effect_ref': 'EXPLICIT_STATION_TRANSFORM',
        'operator_ref': operator.operator_ref, 'profile_before': keys[state.held_key_ref].profile,
        'profile_after': profile, 'symmetric_transform_still_an_input': profile == keys[state.held_key_ref].profile}


def _authenticate(model, state, primitive, owner, budget):
    _input_shape(primitive)
    keys, _, _, locks, acquired = _state(model, state, budget)
    if primitive.kind_ref != 'trial' or not primitive.trial_ref or primitive.lock_ref not in locks:
        raise WorkshopPrerequisite('CURRENT_REAL_TRIAL_TRANSACTION_NOT_BOUND')
    lock = locks[primitive.lock_ref]
    if not lock.real:
        return {'state': state, 'effect_ref': 'EMPTY_LOCK_SUPPORT_REFUSAL', 'fresh_trial': False}
    if lock.lock_ref in acquired:
        return {'state': state, 'effect_ref': 'ALREADY_ACQUIRED_LOCK_REFUSAL', 'fresh_trial': False}
    if state.held_key_ref is None:
        return {'state': state, 'effect_ref': 'UNHELD_TRIAL_REFUSAL', 'fresh_trial': False}
    held_slot = model.slot_refs[state.slot_key_refs.index(state.held_key_ref)]
    if held_slot != lock.slot_ref:
        return {'state': state, 'effect_ref': 'TRIAL_SLOT_ACCESS_REFUSAL', 'fresh_trial': False}
    if model.comparison_law_ref != 'equal_rank_length_exact' or model.feedback_sign not in (-1, 1):
        raise WorkshopPrerequisite('SIGNED_COMMON_LENGTH_PROFILE_COMPARISON_LAW_MISSING')
    key = keys[state.held_key_ref]
    if not lock.profile:
        raise WorkshopPrerequisite('CALIBRATED_REAL_LOCK_PROFILE_MISSING')
    if len(key.profile) != len(lock.profile):
        raise WorkshopPrerequisite('UNEQUAL_LENGTH_COMPARISON_CONTRACT_MISSING')
    if model.reusability_ref not in ('reusable', 'single_acceptance_per_key'):
        raise WorkshopPrerequisite('AUTHENTICATION_REUSE_LAW_MISSING')
    if model.reusability_ref == 'single_acceptance_per_key' and any(receipt.key_ref == key.key_ref for receipt in state.receipts):
        return {'state': state, 'effect_ref': 'USED_PROVIDER_TRIAL_REFUSAL', 'fresh_trial': False}
    if (state.trial is not None and state.trial.trial_ref == primitive.trial_ref) or any(receipt.trial_ref == primitive.trial_ref for receipt in state.receipts):
        raise WorkshopPrerequisite('ACTUAL_NEW_TRIAL_IDENTITY_REUSED')
    differences = tuple(model.feedback_sign * (actual - target) for actual, target in zip(key.profile, lock.profile))
    accepted = not any(differences)
    trial = WorkshopTrial(trial_ref=primitive.trial_ref, lock_ref=lock.lock_ref, key_ref=key.key_ref,
        trial_profile=key.profile, signed_differences=differences, accepted=accepted, event_owner_ref=owner)
    receipts = state.receipts
    if accepted:
        receipts += (WorkshopReceipt(lock_ref=lock.lock_ref, key_ref=key.key_ref,
            authenticated_profile=key.profile, event_owner_ref=owner, trial_ref=primitive.trial_ref),)
    after = state.model_copy(update={'trial': trial, 'receipts': receipts})
    return {'state': after, 'effect_ref': 'ACCEPTED_AUTHENTICATION' if accepted else 'NEGATIVE_PROFILE_TRIAL',
        'fresh_trial': True, 'trial': trial,
        'required_receipts_complete': set(model.required_lock_refs) <= {receipt.lock_ref for receipt in receipts} if model.required_lock_refs else None}


def _input_shape(primitive):
    fields = {'point_slot': ('slot_ref',), 'direction': ('direction',),
        'grasp_toggle': (), 'tool': ('operator_ref',), 'trial': ('lock_ref', 'trial_ref'), 'reset': ()}
    if primitive.kind_ref not in fields:
        raise WorkshopPrerequisite('ACTUAL_WORKSHOP_PRIMITIVE_KIND_NOT_DECLARED')
    allowed = fields[primitive.kind_ref]
    if any(getattr(primitive, name) is not None for name in ('slot_ref', 'direction', 'operator_ref', 'lock_ref', 'trial_ref') if name not in allowed):
        raise WorkshopPrerequisite('WORKSHOP_PRIMITIVE_HAS_UNBOUND_EXTRA_FIELDS')


def _external(model, state, primitive, request, budget):
    _input_shape(primitive)
    _state(model, state, budget)
    if primitive.kind_ref == 'reset':
        if model.reset_state is None or model.reset_cost is None:
            raise WorkshopPrerequisite('INDEPENDENT_RESET_RESTORATION_CONTRACT_MISSING')
        _state(model, model.reset_state, budget)
        return {'before_state': state, 'workshop_input': primitive,
            'state': model.reset_state, 'primitive_complete': True,
            'phase_snapshots': d_map({'before': state, 'independent_reset': model.reset_state}),
            'closure_facts': d_map({'independent_restoration_complete': True}),
            'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'debit': model.reset_cost,
                'automatic_pass_count': 0, 'accepted': False, 'acceptance_checked': False})}
    if state.terminated:
        raise WorkshopPrerequisite('OFFICIAL_TERMINATION_REVOKES_OLD_WORKSHOP_INPUTS')
    if primitive.kind_ref in ('point_slot', 'direction', 'grasp_toggle'):
        direct = _control(model, state, primitive, budget)
    elif primitive.kind_ref == 'tool':
        direct = _tool(model, state, primitive, budget)
    elif primitive.kind_ref == 'trial':
        direct = _authenticate(model, state, primitive, request.scope.event_owner_ref, budget)
    else:
        raise WorkshopPrerequisite('ACTUAL_WORKSHOP_PRIMITIVE_KIND_NOT_DECLARED')
    if model.acceptance_law_ref != 'all_required_real_locks_have_receipts' or not model.required_lock_refs:
        raise WorkshopPrerequisite('NONEMPTY_REQUIRED_LOCK_RECEIPT_ACCEPTANCE_CONTRACT_MISSING')
    if model.receipt_retention_ref not in ('persistent', 'invalidate_changed_provider_profile'):
        raise WorkshopPrerequisite('COMPLETE_EXTERNAL_REQUIRES_ACQUISITION_RETENTION_LAW')
    if model.terminal_order_ref not in ('acceptance_before_exhaustion', 'exhaustion_before_acceptance'):
        raise WorkshopPrerequisite('OFFICIAL_ACCEPTANCE_EXHAUSTION_ORDER_MISSING')
    costs = dict(model.input_costs)
    if len(costs) != len(model.input_costs) or primitive.kind_ref not in costs or any(costs[key] < 0 for key in sorted(costs)):
        raise WorkshopPrerequisite('CURRENT_INPUT_COST_RELATION_MISSING')
    after_direct, cost = direct['state'], costs[primitive.kind_ref]
    complete = set(model.required_lock_refs) <= {receipt.lock_ref for receipt in after_direct.receipts}
    reserve = max(0, state.reserve - cost)
    exhausted = reserve == 0
    accepted = complete and (model.terminal_order_ref == 'acceptance_before_exhaustion' or not exhausted)
    after = after_direct.model_copy(update={'reserve': reserve, 'terminated': accepted or exhausted})
    return {'before_state': state, 'workshop_input': primitive,
        'state': after, 'direct_effect': d_map(direct), 'primitive_complete': True,
        'phase_snapshots': d_map({'before': state, 'after_direct': after_direct,
            'after_receipt_check': d_map({'state': after_direct, 'required_receipts_complete': complete}), 'after_cost_and_verdict': after}),
        'closure_facts': d_map({'direct_complete': True, 'persistent_acquisition_checked': True,
            'input_cost_complete': True, 'official_verdict_complete': True}),
        'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'debit': cost,
            'kind_ref': primitive.kind_ref, 'automatic_pass_count': 1, 'accepted': accepted,
            'exhausted': exhausted, 'acceptance_checked': True,
            'second_automatic_pass_forbidden': True, 'second_debit_forbidden': True})}


def _binding(request, primitive):
    matches = tuple(binding for binding in request.bindings if binding.primitive == primitive
        and binding.evidence_revision_ref == request.scope.evidence_revision_ref)
    if len(matches) != 1:
        raise WorkshopPrerequisite('CURRENT_NATIVE_CHANNEL_AND_ROW_SUPPORT_BINDING_NOT_UNIQUE')
    if primitive.kind_ref in ('point_slot', 'trial') and not matches[0].support_ref:
        raise WorkshopPrerequisite('GUARDED_NATIVE_ROW_OR_LOCK_SUPPORT_MISSING')
    return matches[0]


def _workshop_domain(model, request, budget):
    if not request.native_input_domain_complete or not request.native_inputs:
        raise WorkshopPrerequisite('SOURCE_COMPLETE_CURRENT_NATIVE_INPUT_DOMAIN_MISSING')
    if len(request.native_inputs) > request.domain_bound:
        raise DComputationInterrupted('NATIVE_WORKSHOP_INPUT_DOMAIN_BOUND', d_map())
    if len(set(request.native_inputs)) != len(request.native_inputs):
        raise WorkshopPrerequisite('NATIVE_WORKSHOP_INPUT_DOMAIN_NOT_UNIQUE')
    rows = []
    for primitive in request.native_inputs:
        budget.visit({'native_input_index': len(rows)})
        binding = _binding(request, primitive)
        image = _external(model, request.state, primitive, request, budget)
        rows.append(d_map({'primitive': primitive, 'action_ref': binding.action_ref, 'payload': binding.payload,
            'complete_external_successor': d_map(image)}))
    return {'joint_native_step_domain': tuple(rows), 'complete_in_source_native_input_domain': True,
        'key_profiles_permutation_focus_held_receipts_preserved': True,
        'minimum_workshop_cost_claimed': False, 'k09_search_not_executed_here': True}


def _compile(model, request, budget):
    if not request.words:
        raise WorkshopPrerequisite('SOURCE_COMMITTED_WORKSHOP_WORDS_MISSING')
    rows = []
    for word in request.words:
        if len(word) > request.depth_bound:
            raise DComputationInterrupted('WORKSHOP_WORD_PRIMITIVE_BOUND', d_map())
        current, native, effects, cost = request.state, [], [], 0
        for primitive in word:
            budget.visit({'word_primitive_index': len(native)})
            if current.terminated:
                break
            binding = _binding(request, primitive)
            image = _external(model, current, primitive, request, budget)
            current = image['state']
            native.append(d_map({'action_ref': binding.action_ref, 'payload': binding.payload, 'support_ref': binding.support_ref}))
            effects.append(d_map(image))
            cost += image['event_ledger']['debit']
        rows.append(d_map({'native_word': tuple(native), 'sealed_effects': tuple(effects),
            'state': current, 'expanded_input_cost': cost, 'official_interruption': current.terminated,
            'archive_only_suffix_count': len(word) - len(native), 'primitive_release_authorized': False,
            'implicit_release_or_transport_inserted': False, 'no_intermediate_reconciliation': True}))
    return {'compiled_workshop_words': tuple(rows)}


def _feedback_fit(model, request, budget):
    if not request.observations:
        raise WorkshopPrerequisite('ACTUAL_SEALED_TRIAL_PACKETS_MISSING')
    rows, seen = [], {}
    for index, sample in enumerate(request.observations):
        budget.visit({'trial_sample_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise WorkshopPrerequisite('TRIAL_PACKET_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('before_state', 'primitive', 'after_direct_state')):
            raise WorkshopPrerequisite('TRIAL_STATE_AND_REAL_INPUT_PROVENANCE_MISSING')
        before = WorkshopState.model_validate(sample['before_state'])
        primitive = WorkshopInput.model_validate(sample['primitive'])
        actual = WorkshopState.model_validate(sample['after_direct_state'])
        if primitive.kind_ref != 'trial':
            raise WorkshopPrerequisite('TRIAL_FIT_REQUIRES_ACTUAL_TRIAL_INPUT')
        image = _authenticate(model, before, primitive, request.scope.event_owner_ref, budget)
        _state(model, actual, budget)
        if primitive.trial_ref in seen and seen[primitive.trial_ref] != sample:
            raise WorkshopPrerequisite('REPEATED_TRIAL_IDENTITY_CONTRADICTORY')
        repeated = primitive.trial_ref in seen
        seen[primitive.trial_ref] = sample
        informative = image['fresh_trial'] and not repeated
        nonzero = informative and any(image['trial'].signed_differences)
        rows.append(d_map({'sample_index': index, 'trial_ref': primitive.trial_ref,
            'predicted_transaction': d_map({'before_state': before, 'workshop_input': primitive,
                'event_owner_ref': request.scope.event_owner_ref, **image}),
            'observed_direct_state_matches': d_map(actual) == d_map(image['state']),
            'fresh_measurement_candidate': informative, 'sign_discriminating_nonzero_difference': bool(nonzero),
            'zero_difference_does_not_establish_sign': True, 'unchanged_refusal_not_a_second_sample': True}))
    return {'trial_feedback_constraints': tuple(rows)}


def _compare(model, request, budget):
    if not request.observations:
        raise WorkshopPrerequisite('SEALED_WORKSHOP_ACTUAL_EXPECTED_PACKETS_MISSING')
    rows, first = [], None
    for index, sample in enumerate(request.observations):
        budget.visit({'packet_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise WorkshopPrerequisite('WORKSHOP_PACKET_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('actual_state', 'expected_state', 'scene_transition_ref', 'expected_scene_transition_ref')):
            raise WorkshopPrerequisite('FULL_STATE_RECEIPTS_AND_SCENE_EVIDENCE_MISSING')
        actual = WorkshopState.model_validate(sample['actual_state'])
        expected = WorkshopState.model_validate(sample['expected_state'])
        _state(model, actual, budget)
        _state(model, expected, budget)
        actual_keys, expected_keys = {key.key_ref: key.profile for key in actual.keys}, {key.key_ref: key.profile for key in expected.keys}
        changed_keys = tuple(ref for ref in sorted(actual_keys) if actual_keys[ref] != expected_keys[ref])
        fields = tuple(key for key in ('slot_key_refs', 'focus_slot_ref', 'held_key_ref', 'trial', 'reserve', 'terminated')
            if getattr(actual, key) != getattr(expected, key))
        actual_receipts = {receipt.lock_ref: d_map(receipt) for receipt in actual.receipts}
        expected_receipts = {receipt.lock_ref: d_map(receipt) for receipt in expected.receipts}
        mismatches = tuple(ref for ref in sorted(set(actual_receipts) | set(expected_receipts)) if actual_receipts.get(ref) != expected_receipts.get(ref))
        unaffected = tuple(ref for ref in sorted(set(actual_receipts) & set(expected_receipts)) if ref not in mismatches)
        scene_matches = sample['scene_transition_ref'] == sample['expected_scene_transition_ref']
        if sample['scene_transition_ref'] != 'no_scene_transition' and sample.get('next_scene_observation') is None:
            raise WorkshopPrerequisite('NEXT_SCENE_OBSERVATION_MISSING_AT_OFFICIAL_BOUNDARY')
        if first is None and (changed_keys or fields or mismatches or not scene_matches):
            first = index
        rows.append(d_map({'packet_index': index, 'profile_difference_key_refs': changed_keys,
            'control_or_trial_difference_fields': fields, 'receipt_difference_lock_refs': mismatches,
            'unaffected_receipt_refs': unaffected, 'changed_dependency_refs': changed_keys + mismatches,
            'scene_matches_prediction': scene_matches, 'expected_scene_transition_ref': sample['expected_scene_transition_ref'],
            'scene_transition_ref': sample['scene_transition_ref'], 'next_scene_observation': sample.get('next_scene_observation'),
            'familiar_slot_does_not_attest_restored_profile': True}))
    return {'sealed_workshop_comparisons': tuple(rows), 'first_divergence_index': first}


def measure_station_profile_workbench(request: StationWorkbenchRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget, rows, current_model_ref = DWorkBudget(request), [], None
    operation = request.operation_ref.rsplit('.', 1)[-1]
    try:
        if operation == 'row_profile_measure':
            values = _measure(request, budget)
            budget.finish()
            return d_result(request, 'OK', 'EXACT_DECLARED_PROFILE_GEOMETRY', values=values, complete=True, examined=budget.examined)
        if not request.models or request.state is None:
            raise WorkshopPrerequisite('SCOPED_WORKSHOP_MODELS_AND_CURRENT_POPULATION_MISSING')
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            keys, _, _, _, _ = _state(model, request.state, budget)
            if operation == 'trial_feedback_fit':
                row = _feedback_fit(model, request, budget)
            elif operation == 'profile_operator_domain':
                row = {'key_profile_domains': tuple(d_map({'key_ref': ref, 'orbit': d_map(_profile_closure(model, keys[ref].profile, request, budget))}) for ref in sorted(keys))}
            elif operation == 'provider_preimage_domain':
                row = _providers(model, request, budget)
            elif operation == 'costed_workshop_domain':
                row = _workshop_domain(model, request, budget)
            elif operation == 'workshop_input_compile':
                row = _compile(model, request, budget)
            elif operation == 'sealed_workshop_compare':
                row = _compare(model, request, budget)
            else:
                if request.primitive is None:
                    raise WorkshopPrerequisite('BOUND_CURRENT_WORKSHOP_PRIMITIVE_MISSING')
                if operation == 'slot_control_step':
                    row = _control(model, request.state, request.primitive, budget)
                elif operation == 'profile_tool_step':
                    row = _tool(model, request.state, request.primitive, budget)
                elif operation == 'profile_authentication_step':
                    row = _authenticate(model, request.state, request.primitive, request.scope.event_owner_ref, budget)
                elif operation == 'external_primitive':
                    row = _external(model, request.state, request.primitive, request, budget)
                else:
                    return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
                if operation != 'external_primitive':
                    row = {'before_state': request.state, 'workshop_input': request.primitive,
                        'event_owner_ref': request.scope.event_owner_ref, **row}
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'OK', 'EXACT_SCOPED_WORKSHOP_COMPUTATION',
            values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except WorkshopPrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
    except (ValueError, TypeError, KeyError) as error:
        return d_result(request, 'NEEDS_EVIDENCE', 'INVALID_DECLARED_MEASUREMENT_OR_STATE', examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, {'error_type': type(error).__name__}))
