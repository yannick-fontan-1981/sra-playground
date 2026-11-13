"""Declared axial pair law, simultaneous subset dynamics and normal closure.

No selected-body priority, hidden exponent, sequential mover update, mandatory
winner, route search, semantic publication or action release.
"""
from __future__ import annotations

from fractions import Fraction
from itertools import product
from typing import ClassVar
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .axial_scene_a import AxialSceneInputA, measure_axial_scene_a
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)

Point = tuple[int, int]
_CARDINAL = ((-1, 0), (1, 0), (0, -1), (0, 1))


class AxialBody(FrozenModel):
    body_ref: Ref
    cell: Point
    positive_axis: Point
    positive_pole_ref: Ref
    negative_pole_ref: Ref


class AxialState(FrozenModel):
    bodies: tuple[AxialBody, ...] = Field(min_length=1, max_length=16)
    active_body_ref: Ref | None
    reserve: int = Field(ge=0)
    terminated: bool


class AxialDistanceLaw(FrozenModel):
    distance: int = Field(ge=1)
    force_numerator: int = Field(ge=0)
    force_denominator: int = Field(ge=1)
    potential_numerator: int
    potential_denominator: int = Field(ge=1)


class AxialModel(FrozenModel):
    model_ref: Ref
    floor_cells: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    wall_cells: tuple[Point, ...] = Field(default=(), max_length=4096)
    alignment_law_ref: Ref | None = None
    axis_law_ref: Ref | None = None
    transmission_law_ref: Ref | None = None
    polarity_effects: tuple[tuple[Ref, Ref, int], ...] = Field(default=(), max_length=128)
    numeric_law_ref: Ref | None = None
    force_order_ref: Ref | None = None
    pair_order: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=120)
    distance_laws: tuple[AxialDistanceLaw, ...] = Field(default=(), max_length=4096)
    force_threshold: tuple[int, int] | None = None
    potential_margin: tuple[int, int] | None = None
    potential_gate_ref: Ref | None = None
    collision_law_ref: Ref | None = None
    exchange_law_ref: Ref | None = None
    subset_rank_ref: Ref | None = None
    body_tie_order: tuple[Ref, ...] = Field(default=(), max_length=16)
    tick_cap: int | None = Field(default=None, ge=1, le=4096)
    cap_outcome_ref: Ref | None = None
    orientation_cycle: tuple[Point, ...] = Field(default=(), max_length=4)
    selection_cycle: tuple[Ref, ...] = Field(default=(), max_length=16)
    empty_point_law_ref: Ref | None = None
    no_selection_pivot_law_ref: Ref | None = None
    target_cell: Point | None = None
    admissible_body_refs: tuple[Ref, ...] | None = Field(default=None, max_length=16)
    goal_law_ref: Ref | None = None
    acceptance_trigger_ref: Ref | None = None
    terminal_order_ref: Ref | None = None
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=8)
    reset_state: AxialState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class AxialInput(FrozenModel):
    kind_ref: Ref
    cell: Point | None = None
    turn: int | None = None


class AxialBinding(FrozenModel):
    primitive: AxialInput
    action_ref: Ref
    payload: FrozenMap
    current_body_ref: Ref | None = None
    support_ref: Ref | None = None
    evidence_revision_ref: Ref


class AxialServiceVariable(FrozenModel):
    body_ref: Ref
    cells: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    axes: tuple[Point, ...] = Field(min_length=1, max_length=4)
    evidence_ref: Ref


class AxialObservedBody(FrozenModel):
    cell: Point
    positive_axis: Point | None = None
    positive_pole_ref: Ref | None = None
    negative_pole_ref: Ref | None = None


_CASES = (
    ('measure', ('MEASURE',)), ('identity_control', ('CORRESPOND',)),
    ('pair_domain', ('DOMAIN',)), ('force_potential', ('EVALUATE',)),
    ('simultaneous_tick', ('STEP',)), ('settle_closure', ('CLOSURE',)),
    ('service_preimages', ('INVERSE_DOMAIN',)), ('costed_route', ('SEARCH',)),
    ('compile', ('COMPILE',)), ('sealed_compare', ('COMPARE',)), ('external_primitive', ('STEP',)),
)


class AxialFieldRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.axial_field_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.axial_field_configuration.{operation}', mode)
        for operation, modes in _CASES for mode in modes)
    models: tuple[AxialModel, ...] = Field(default=(), max_length=32)
    state: AxialState | None = None
    primitive: AxialInput | None = None
    event_scope_ref: Ref | None = None
    internal_tick_producer_ref: Ref | None = None
    consumer_body_ref: Ref | None = None
    service_variables: tuple[AxialServiceVariable, ...] = Field(default=(), max_length=16)
    preserved_body_refs: tuple[Ref, ...] = Field(default=(), max_length=16)
    words: tuple[tuple[AxialInput, ...], ...] = Field(default=(), max_length=3)
    bindings: tuple[AxialBinding, ...] = Field(default=(), max_length=4096)
    source_identity_ref: Ref | None = None
    scene_input: AxialSceneInputA | None = None
    route_input: FrozenMap | None = None


class AxialPrerequisite(Exception):
    pass


def _ratio(value):
    return value.numerator, value.denominator


def _fraction(pair, cause):
    if pair is None or pair[1] <= 0:
        raise AxialPrerequisite(cause)
    return Fraction(pair[0], pair[1])


def _state(model, state, budget):
    floor, walls = frozenset(model.floor_cells), frozenset(model.wall_cells)
    if len(floor) != len(model.floor_cells) or len(walls) != len(model.wall_cells) or floor & walls:
        raise AxialPrerequisite('UNIQUE_DISJOINT_TRAVERSAL_AND_WALL_DOMAINS_REQUIRED')
    if len(floor | walls) > budget.request.domain_bound:
        raise DComputationInterrupted('DECLARED_CELL_DOMAIN_BOUND', d_map())
    bodies, occupants = {}, {}
    for body in state.bodies:
        budget.visit({'body_ref': body.body_ref})
        if body.body_ref in bodies or body.cell in occupants or body.cell not in floor or body.positive_axis not in _CARDINAL:
            raise AxialPrerequisite('CURRENT_FULL_BODY_IDENTITY_POSITION_OR_AXIS_NOT_VALID')
        if not body.positive_pole_ref or not body.negative_pole_ref or body.positive_pole_ref == body.negative_pole_ref:
            raise AxialPrerequisite('DISTINCT_SUPPLIED_OPPOSITE_POLE_LABELS_REQUIRED')
        bodies[body.body_ref], occupants[body.cell] = body, body.body_ref
    if state.active_body_ref is not None and state.active_body_ref not in bodies:
        raise AxialPrerequisite('SELECTED_IDENTITY_NOT_CURRENT_OCCUPANT')
    return bodies, occupants, floor, walls


def _pairs(model, state, budget):
    bodies, occupants, floor, walls = _state(model, state, budget)
    if model.alignment_law_ref != 'same_row_or_column' or model.axis_law_ref != 'both_axes_collinear_with_pair':
        raise AxialPrerequisite('SUPPLIED_ALIGNMENT_AND_AXIAL_ELIGIBILITY_LAWS_MISSING')
    if model.transmission_law_ref not in ('through_everything', 'walls_block', 'walls_and_bodies_block'):
        raise AxialPrerequisite('INFLUENCE_TRANSMISSION_LAW_MISSING')
    effects = {(first, second): effect for first, second, effect in model.polarity_effects}
    if len(effects) != len(model.polarity_effects) or any(effect not in (-1, 0, 1) for _, _, effect in model.polarity_effects):
        raise AxialPrerequisite('FUNCTIONAL_SUPPLIED_POLARITY_EFFECT_RELATION_REQUIRED')
    refs, eligible, excluded = tuple(sorted(bodies)), [], []
    for index, first_ref in enumerate(refs):
        first = bodies[first_ref]
        for second_ref in refs[index + 1:]:
            budget.visit({'pair_refs': (first_ref, second_ref)})
            second = bodies[second_ref]
            dr, dc = second.cell[0] - first.cell[0], second.cell[1] - first.cell[1]
            if dr and dc:
                excluded.append((first_ref, second_ref, 'NOT_ROW_OR_COLUMN_ALIGNED'))
                continue
            distance = abs(dr) + abs(dc)
            direction = (0 if not dr else (1 if dr > 0 else -1), 0 if not dc else (1 if dc > 0 else -1))
            opposite = -direction[0], -direction[1]
            if first.positive_axis not in (direction, opposite) or second.positive_axis not in (direction, opposite):
                excluded.append((first_ref, second_ref, 'AXES_NOT_COLLINEAR_WITH_PAIR'))
                continue
            obstructed = False
            if model.transmission_law_ref != 'through_everything':
                for step in range(1, distance):
                    budget.visit({'pair_refs': (first_ref, second_ref), 'transmission_step': step})
                    cell = first.cell[0] + step * direction[0], first.cell[1] + step * direction[1]
                    if cell not in floor and cell not in walls:
                        raise AxialPrerequisite('INTERMEDIATE_TRANSMISSION_TERRAIN_UNOBSERVED')
                    if cell in walls or (model.transmission_law_ref == 'walls_and_bodies_block' and cell in occupants):
                        obstructed = True
                        break
            if obstructed:
                excluded.append((first_ref, second_ref, 'SUPPLIED_TRANSMISSION_OBSTRUCTION'))
                continue
            first_pole = first.positive_pole_ref if first.positive_axis == direction else first.negative_pole_ref
            second_pole = second.positive_pole_ref if second.positive_axis == opposite else second.negative_pole_ref
            if (first_pole, second_pole) not in effects:
                raise AxialPrerequisite('CURRENT_FACING_POLE_EFFECT_NOT_SUPPLIED')
            eligible.append(d_map({'body_refs': (first_ref, second_ref), 'distance': distance,
                'direction_first_to_second': direction, 'facing_pole_refs': (first_pole, second_pole),
                'attraction_sign': effects[(first_pole, second_pole)]}))
    return tuple(eligible), tuple(excluded)


def _field(model, state, budget):
    pairs, excluded = _pairs(model, state, budget)
    if model.numeric_law_ref != 'exact_rational_equal_opposite_force_effect_times_potential':
        raise AxialPrerequisite('DECLARED_NUMERIC_FORCE_AND_POTENTIAL_LAW_MISSING')
    mapping = {tuple(pair['body_refs']): pair for pair in pairs}
    if model.force_order_ref == 'lexicographic_body_refs':
        order = tuple(sorted(mapping))
    elif model.force_order_ref == 'source_pair_order':
        if len(set(model.pair_order)) != len(model.pair_order) or set(model.pair_order) != set(mapping):
            raise AxialPrerequisite('COMPLETE_CURRENT_NUMERICAL_PAIR_ORDER_MISSING')
        order = model.pair_order
    else:
        raise AxialPrerequisite('EXPLICIT_NUMERICAL_SUM_ORDER_REQUIRED')
    laws = {law.distance: law for law in model.distance_laws}
    if len(laws) != len(model.distance_laws):
        raise AxialPrerequisite('DISTANCE_FORCE_POTENTIAL_TABLE_NOT_FUNCTIONAL')
    forces = {body.body_ref: (Fraction(0), Fraction(0)) for body in state.bodies}
    potential, contributions = Fraction(0), []
    for refs in order:
        budget.visit({'numerical_pair_refs': refs})
        pair = mapping[refs]
        if pair['distance'] not in laws:
            raise AxialPrerequisite('CURRENT_DISTANCE_FORCE_POTENTIAL_ENTRY_MISSING')
        law, effect = laws[pair['distance']], pair['attraction_sign']
        force = effect * Fraction(law.force_numerator, law.force_denominator)
        energy = effect * Fraction(law.potential_numerator, law.potential_denominator)
        dr, dc = pair['direction_first_to_second']
        fr, fc = force * dr, force * dc
        old = forces[refs[0]]
        forces[refs[0]] = old[0] + fr, old[1] + fc
        old = forces[refs[1]]
        forces[refs[1]] = old[0] - fr, old[1] - fc
        potential += energy
        contributions.append(d_map({'body_refs': refs, 'force_first': (_ratio(fr), _ratio(fc)),
            'potential_contribution': _ratio(energy), 'distance': pair['distance']}))
    return forces, potential, {'pair_contributions': tuple(contributions), 'excluded_pairs': excluded,
        'resultants': tuple(d_map({'body_ref': ref, 'row_force': _ratio(forces[ref][0]),
            'column_force': _ratio(forces[ref][1])}) for ref in sorted(forces)),
        'total_potential': _ratio(potential), 'nonzero_force_is_not_movement': True,
        'numerical_law_ref': model.numeric_law_ref}


def _tick(model, state, request, budget):
    bodies, _, floor, _ = _state(model, state, budget)
    if not request.internal_tick_producer_ref:
        raise AxialPrerequisite('ENCLOSING_SINGLE_INTERNAL_TICK_PRODUCER_MISSING')
    if model.collision_law_ref != 'injective_endpoints_vacating_allowed':
        raise AxialPrerequisite('SIMULTANEOUS_ENDPOINT_COLLISION_LAW_MISSING')
    if model.exchange_law_ref not in ('allow_direct_swaps', 'forbid_direct_swaps'):
        raise AxialPrerequisite('SIMULTANEOUS_EXCHANGE_LAW_MISSING')
    if model.subset_rank_ref not in ('greatest_cardinality_then_potential_then_source_bits', 'lowest_potential_then_cardinality_then_source_bits'):
        raise AxialPrerequisite('EXPLICIT_PHYSICAL_SUBSET_RANKING_REQUIRED')
    if len(set(model.body_tie_order)) != len(model.body_tie_order) or set(model.body_tie_order) != set(bodies):
        raise AxialPrerequisite('COMPLETE_PHYSICAL_BODY_TIE_ORDER_REQUIRED')
    threshold = _fraction(model.force_threshold, 'EXPLICIT_FORCE_THRESHOLD_MISSING')
    margin = _fraction(model.potential_margin, 'EXPLICIT_POTENTIAL_MARGIN_MISSING')
    if threshold < 0 or margin < 0 or model.potential_gate_ref not in ('strict_decrease', 'nonincrease', 'disabled'):
        raise AxialPrerequisite('SUPPORTED_POTENTIAL_GATE_AND_NONNEGATIVE_THRESHOLDS_REQUIRED')
    forces, initial_energy, field = _field(model, state, budget)
    proposals = {}
    for ref in model.body_tie_order:
        fr, fc = forces[ref]
        dr = 0 if abs(fr) <= threshold else (1 if fr > 0 else -1)
        dc = 0 if abs(fc) <= threshold else (1 if fc > 0 else -1)
        if dr and dc:
            raise AxialPrerequisite('TWO_AXIS_PROPOSAL_REQUIRES_A_SEPARATE_DECLARED_LAW')
        if dr or dc:
            proposals[ref] = bodies[ref].cell[0] + dr, bodies[ref].cell[1] + dc
    refs = tuple(ref for ref in model.body_tie_order if ref in proposals)
    best, examined, rejection_counts = None, 0, {}
    for bits in range(1 << len(refs)):
        if examined >= request.domain_bound:
            raise DComputationInterrupted('SIMULTANEOUS_SUBSET_DOMAIN_BOUND', d_map({'next_subset_bits': bits}))
        budget.visit({'simultaneous_subset_bits': bits})
        examined += 1
        moved = tuple(ref for index, ref in enumerate(refs) if bits & (1 << index))
        moved_set = frozenset(moved)
        destinations = {ref: proposals[ref] if ref in moved_set else bodies[ref].cell for ref in sorted(bodies)}
        cause = None
        if any(destinations[ref] not in floor for ref in sorted(destinations)):
            cause = 'OUTSIDE_DECLARED_TRAVERSAL'
        elif len(set(destinations[ref] for ref in sorted(destinations))) != len(destinations):
            cause = 'NONINJECTIVE_SIMULTANEOUS_ENDPOINTS'
        elif model.exchange_law_ref == 'forbid_direct_swaps' and any(destinations[first] == bodies[second].cell
                and destinations[second] == bodies[first].cell for index, first in enumerate(moved) for second in moved[index + 1:]):
            cause = 'FORBIDDEN_DIRECT_EXCHANGE'
        if cause is not None:
            rejection_counts[cause] = rejection_counts.get(cause, 0) + 1
            continue
        after = state.model_copy(update={'bodies': tuple(body.model_copy(update={'cell': destinations[body.body_ref]}) for body in state.bodies)})
        energy = initial_energy if not moved else _field(model, after, budget)[1]
        if moved and ((model.potential_gate_ref == 'strict_decrease' and not energy < initial_energy - margin)
                or (model.potential_gate_ref == 'nonincrease' and energy > initial_energy - margin)):
            rejection_counts['POTENTIAL_GATE_REFUSAL'] = rejection_counts.get('POTENTIAL_GATE_REFUSAL', 0) + 1
            continue
        rank = (-len(moved), energy, bits) if model.subset_rank_ref.startswith('greatest_cardinality') else (energy, -len(moved), bits)
        if best is None or rank < best[0]:
            best = rank, after, moved, energy
    if best is None:
        raise AxialPrerequisite('EMPTY_SUBSET_NOT_ADMISSIBLE_UNDER_SUPPLIED_LAWS')
    return {'state': best[1], 'moved_body_refs': best[2], 'total_potential_before': _ratio(initial_energy),
        'total_potential_after': _ratio(best[3]), 'snapshot_field': d_map(field),
        'proposals': tuple((ref, proposals[ref]) for ref in refs), 'examined_subsets': examined,
        'rejection_counts': tuple(sorted(rejection_counts.items())),
        'decisive_rank': d_map({'law_ref': model.subset_rank_ref, 'mover_count': len(best[2]),
            'potential': _ratio(best[3]), 'source_subset_bits': best[0][2]}),
        'internal_tick_producer_ref': request.internal_tick_producer_ref, 'external_input_emitted': False,
        'all_proposals_share_one_snapshot': True}


def _goal(model, state, normal):
    if model.target_cell is None or model.admissible_body_refs is None or model.goal_law_ref != 'any_admissible_body_at_target_after_normal_closure':
        return {'normal_global_closure': normal, 'target_occupant_refs': (), 'accepted_stable_arrival': None}
    body_refs = frozenset(body.body_ref for body in state.bodies)
    if len(set(model.admissible_body_refs)) != len(model.admissible_body_refs) or not set(model.admissible_body_refs) <= body_refs:
        raise AxialPrerequisite('CURRENT_ADMISSIBLE_BODY_DOMAIN_NOT_VALID')
    occupants = tuple(body.body_ref for body in state.bodies if body.cell == model.target_cell and body.body_ref in model.admissible_body_refs)
    return {'normal_global_closure': normal, 'target_occupant_refs': occupants,
        'accepted_stable_arrival': normal and bool(occupants)}


def _closure(model, state, request, budget):
    if model.tick_cap is None:
        raise AxialPrerequisite('DECLARED_PHYSICAL_RELAXATION_TICK_CAP_MISSING')
    current, trajectory, transient = state, [], set()
    for index in range(model.tick_cap):
        if index >= request.depth_bound or len(trajectory) >= request.domain_bound:
            raise DComputationInterrupted('RELAXATION_COMPUTATION_DEPTH_OR_TRACE_BOUND', d_map({
                'next_tick_index': index, 'before_state': state, 'last_completed_state': current,
                'completed_tick_trajectory': tuple(trajectory),
                'internal_tick_producer_ref': request.internal_tick_producer_ref,
                'event_scope_ref': request.event_scope_ref}))
        try:
            budget.visit({'internal_tick_index': index})
            image = _tick(model, current, request, budget)
        except (AxialPrerequisite, DComputationInterrupted) as error:
            error.frontier = d_map({'next_tick_index': index, 'before_state': state,
                'last_completed_state': current, 'completed_tick_trajectory': tuple(trajectory),
                'internal_tick_producer_ref': request.internal_tick_producer_ref,
                'event_scope_ref': request.event_scope_ref,
                'interrupted_tick_frontier': getattr(error, 'frontier', d_map()),
                'interrupted_tick_not_committed': True})
            raise
        after = image['state']
        before_cells = {body.body_ref: body.cell for body in current.bodies}
        deltas = tuple((body.body_ref, before_cells[body.body_ref], body.cell) for body in after.bodies if body.cell != before_cells[body.body_ref])
        target = _goal(model, after, False)
        transient.update(target['target_occupant_refs'])
        trajectory.append(d_map({'tick_index': index, 'position_deltas': deltas,
            'before_state': current, 'after_state': after,
            'internal_tick_producer_ref': request.internal_tick_producer_ref,
            'event_scope_ref': request.event_scope_ref,
            'moved_body_refs': image['moved_body_refs'], 'potential_after': image['total_potential_after'],
            'examined_subsets': image['examined_subsets'], 'rejection_counts': image['rejection_counts']}))
        current = after
        if not image['moved_body_refs']:
            return {'state': current, 'trajectory': tuple(trajectory), 'termination_ref': 'normal_no_admissible_move',
                'tick_count': index + 1, 'transient_target_body_refs': tuple(sorted(transient)),
                'goal': d_map(_goal(model, current, True)), 'physical_stability_proved': True,
                'extra_external_commands': 0}
    return {'state': current, 'trajectory': tuple(trajectory), 'termination_ref': 'physical_tick_cap',
        'tick_count': model.tick_cap, 'transient_target_body_refs': tuple(sorted(transient)),
        'goal': d_map(_goal(model, current, False)), 'physical_stability_proved': False,
        'guard_cap_is_not_victory': True, 'extra_external_commands': 0}


def _direct(model, state, primitive, budget):
    bodies, occupants, _, _ = _state(model, state, budget)
    if primitive.kind_ref == 'select_point':
        if primitive.cell is None or primitive.turn is not None:
            raise AxialPrerequisite('CURRENT_BODY_POINT_INPUT_MISSING')
        owner = occupants.get(primitive.cell)
        if owner is None:
            if model.empty_point_law_ref == 'keep_selection':
                owner = state.active_body_ref
            elif model.empty_point_law_ref != 'clear_selection':
                raise AxialPrerequisite('EMPTY_POINT_SELECTION_EFFECT_MISSING')
        return {'state': state.model_copy(update={'active_body_ref': owner}), 'pivoted_body_ref': None,
            'point_current_occupant_ref': occupants.get(primitive.cell), 'relaxation_due': False}
    if primitive.kind_ref == 'cycle':
        if primitive.cell is not None or primitive.turn is not None or set(model.selection_cycle) != set(bodies) or len(model.selection_cycle) != len(bodies):
            raise AxialPrerequisite('EXPLICIT_COMPLETE_SELECTION_CYCLE_MISSING')
        index = -1 if state.active_body_ref is None else model.selection_cycle.index(state.active_body_ref)
        owner = model.selection_cycle[(index + 1) % len(model.selection_cycle)]
        return {'state': state.model_copy(update={'active_body_ref': owner}), 'pivoted_body_ref': None, 'relaxation_due': False}
    if primitive.kind_ref != 'pivot' or primitive.turn not in (-1, 1) or primitive.cell is not None:
        raise AxialPrerequisite('SOURCE_BOUND_SUPPORTED_AXIAL_PIVOT_MISSING')
    if state.active_body_ref is None:
        if model.no_selection_pivot_law_ref != 'no_change_no_relaxation':
            raise AxialPrerequisite('NO_SELECTION_PIVOT_EFFECT_MISSING')
        return {'state': state, 'pivoted_body_ref': None, 'relaxation_due': False, 'refusal_ref': 'NO_SELECTED_BODY'}
    if not model.orientation_cycle or len(set(model.orientation_cycle)) != len(model.orientation_cycle) or any(axis not in _CARDINAL for axis in model.orientation_cycle):
        raise AxialPrerequisite('SUPPORTED_ORIENTATION_CYCLE_MISSING')
    body = bodies[state.active_body_ref]
    if body.positive_axis not in model.orientation_cycle:
        raise AxialPrerequisite('CURRENT_ORIENTATION_NOT_IN_PIVOT_DOMAIN')
    axis = model.orientation_cycle[(model.orientation_cycle.index(body.positive_axis) + primitive.turn) % len(model.orientation_cycle)]
    after = state.model_copy(update={'bodies': tuple(item.model_copy(update={'positive_axis': axis}) if item.body_ref == body.body_ref else item for item in state.bodies)})
    return {'state': after, 'pivoted_body_ref': body.body_ref, 'orientation_before': body.positive_axis,
        'orientation_after': axis, 'relaxation_due': True}


def _external(model, state, primitive, request, budget):
    _state(model, state, budget)
    if primitive.kind_ref == 'reset':
        if primitive.cell is not None or primitive.turn is not None or model.reset_state is None or model.reset_cost is None:
            raise AxialPrerequisite('INDEPENDENT_BOUND_RESET_RESTORATION_MISSING')
        _state(model, model.reset_state, budget)
        return {'before_state': state, 'state': model.reset_state, 'primitive_complete': True,
            'phase_snapshots': d_map({'before': state, 'independent_reset': model.reset_state}),
            'closure_facts': d_map({'independent_restoration_complete': True}),
            'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'debit': model.reset_cost,
                'automatic_pass_count': 0, 'accepted': False, 'acceptance_checked': False})}
    if state.terminated:
        raise AxialPrerequisite('OFFICIAL_TERMINATION_REVOKES_OLD_INPUTS')
    costs = dict(model.input_costs)
    if len(costs) != len(model.input_costs) or primitive.kind_ref not in costs or any(costs[key] < 0 for key in sorted(costs)):
        raise AxialPrerequisite('CURRENT_NATIVE_INPUT_COST_LAW_MISSING')
    if model.acceptance_trigger_ref != 'only_pivot_after_normal_closure' or model.terminal_order_ref not in ('acceptance_before_exhaustion', 'exhaustion_before_acceptance'):
        raise AxialPrerequisite('ACCEPTANCE_TRIGGER_AND_EXHAUSTION_ORDER_MISSING')
    direct = _direct(model, state, primitive, budget)
    after_direct, relaxation = direct['state'], None
    normal, cap_reject, cap_terminal, candidate = False, False, False, False
    current = after_direct
    if direct['relaxation_due']:
        relaxation = _closure(model, after_direct, request, budget)
        current = relaxation['state']
        normal = relaxation['termination_ref'] == 'normal_no_admissible_move'
        cap_reject = not normal
        if cap_reject:
            if model.cap_outcome_ref not in ('reject_acceptance_keep_gameplay', 'game_over'):
                raise AxialPrerequisite('PHYSICAL_TICK_CAP_LIFECYCLE_EFFECT_MISSING')
            cap_terminal = model.cap_outcome_ref == 'game_over'
        goal = relaxation['goal']
        if goal['accepted_stable_arrival'] is None:
            raise AxialPrerequisite('BOUND_STABLE_ARRIVAL_GOAL_CONTRACT_MISSING')
        candidate = goal['accepted_stable_arrival']
    reserve = max(0, state.reserve - costs[primitive.kind_ref])
    exhausted = reserve == 0
    accepted = candidate and not cap_reject and (model.terminal_order_ref == 'acceptance_before_exhaustion' or not exhausted)
    after = current.model_copy(update={'reserve': reserve, 'terminated': accepted or exhausted or cap_terminal})
    return {'before_state': state, 'state': after, 'direct_effect': d_map(direct),
        'relaxation': d_map(relaxation) if relaxation is not None else None, 'primitive_complete': True,
        'phase_snapshots': d_map({'before': state, 'after_direct': after_direct, 'after_relaxation': current, 'after_cost_and_verdict': after}),
        'closure_facts': d_map({'direct_complete': True, 'relaxation_complete': relaxation is not None,
            'normal_global_closure': normal, 'physical_cap_rejects_acceptance': cap_reject,
            'cost_complete': True, 'official_verdict_complete': True}),
        'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'kind_ref': primitive.kind_ref,
            'internal_tick_producer_ref': request.internal_tick_producer_ref, 'debit': costs[primitive.kind_ref],
            'automatic_pass_count': 1 if relaxation is not None else 0, 'accepted': accepted,
            'exhausted': exhausted, 'acceptance_checked': relaxation is not None,
            'second_relaxation_forbidden': True, 'second_debit_forbidden': True})}


def _services(model, request, budget):
    bodies, _, floor, _ = _state(model, request.state, budget)
    if request.consumer_body_ref not in bodies or not request.service_variables:
        raise AxialPrerequisite('SOURCE_STABLE_ARRIVAL_CONSUMER_AND_SERVICE_DOMAINS_MISSING')
    if model.target_cell is None or model.admissible_body_refs is None or model.goal_law_ref != 'any_admissible_body_at_target_after_normal_closure':
        raise AxialPrerequisite('STABLE_ARRIVAL_SERVICE_GOAL_NOT_BOUND')
    if request.consumer_body_ref not in model.admissible_body_refs or any(ref not in bodies for ref in request.preserved_body_refs):
        raise AxialPrerequisite('SERVICE_CONSUMER_OR_PRESERVATION_REF_OUTSIDE_CURRENT_DOMAIN')
    refs = tuple(variable.body_ref for variable in request.service_variables)
    if len(set(refs)) != len(refs) or any(ref not in bodies for ref in refs) or set(refs) & set(request.preserved_body_refs):
        raise AxialPrerequisite('UNIQUE_SERVICE_VARIABLES_CONTRADICT_PRESERVATION')
    if len(refs) > request.depth_bound:
        raise DComputationInterrupted('SERVICE_ASSIGNMENT_DEPTH_BOUND', d_map())
    options = []
    for variable in request.service_variables:
        if len(set(variable.cells)) != len(variable.cells) or len(set(variable.axes)) != len(variable.axes) or any(cell not in floor for cell in variable.cells) or any(axis not in _CARDINAL for axis in variable.axes):
            raise AxialPrerequisite('FINITE_SERVICE_CELL_AND_ORIENTATION_DOMAINS_INVALID')
        if len(variable.cells) * len(variable.axes) > request.domain_bound:
            raise DComputationInterrupted('SERVICE_VARIABLE_DOMAIN_BOUND', d_map())
        options.append(tuple((cell, axis) for cell in variable.cells for axis in variable.axes))
    rows, rejected, examined = [], 0, 0
    for values in product(*options):
        if examined >= request.domain_bound:
            raise DComputationInterrupted('JOINT_SERVICE_CONTEXT_DOMAIN_BOUND', d_map())
        budget.visit({'service_assignment_index': examined})
        examined += 1
        assignments = dict(zip(refs, values))
        proposed = tuple(body.model_copy(update={'cell': assignments[body.body_ref][0], 'positive_axis': assignments[body.body_ref][1]}) if body.body_ref in assignments else body for body in request.state.bodies)
        if len(set(body.cell for body in proposed)) != len(proposed):
            rejected += 1
            continue
        contextual = request.state.model_copy(update={'bodies': proposed})
        closure = _closure(model, contextual, request, budget)
        final_bodies = {body.body_ref: body for body in closure['state'].bodies}
        normal = closure['termination_ref'] == 'normal_no_admissible_move'
        preserved = (all(ref in final_bodies and final_bodies[ref] == bodies[ref] for ref in request.preserved_body_refs)
            and not any(set(tick['moved_body_refs']) & set(request.preserved_body_refs) for tick in closure['trajectory']))
        arrival = normal and model.target_cell is not None and final_bodies[request.consumer_body_ref].cell == model.target_cell
        rows.append(d_map({'conditional_service_assignments': tuple((ref, assignments[ref]) for ref in refs),
            'context_state': contextual, 'closure': d_map(closure), 'consumer_body_ref': request.consumer_body_ref,
            'consumer_stable_arrival': arrival, 'preserved_body_constraints_hold': preserved,
            'preparation_route_proved': False, 'mandatory_winner_selected': False}))
    return {'joint_conditional_service_domain': tuple(rows), 'examined_joint_contexts': examined,
        'coexistence_collision_rejections': rejected, 'exhaustive_in_supplied_service_domains': True,
        'universal_service_necessity_claimed': False}


def _compile(model, request, budget):
    if not request.words:
        raise AxialPrerequisite('SOURCE_SELECTED_PIVOT_AND_SELECTION_WORDS_MISSING')
    rows = []
    for word in request.words:
        if len(word) > request.depth_bound:
            raise DComputationInterrupted('AXIAL_WORD_PRIMITIVE_BOUND', d_map())
        current, native, effects, cost = request.state, [], [], 0
        for primitive in word:
            budget.visit({'word_primitive_index': len(native)})
            if current.terminated:
                break
            _, occupants, _, _ = _state(model, current, budget)
            matches = tuple(binding for binding in request.bindings if binding.primitive == primitive
                and binding.evidence_revision_ref == request.scope.evidence_revision_ref)
            if len(matches) != 1:
                raise AxialPrerequisite('CURRENT_OR_CERTIFIED_PREDICTED_NATIVE_BINDING_NOT_UNIQUE')
            binding = matches[0]
            if primitive.kind_ref == 'select_point' and (not binding.support_ref or binding.current_body_ref != occupants.get(primitive.cell)):
                raise AxialPrerequisite('BODY_POINT_BOUND_TO_STALE_OCCUPANT_OR_SUPPORT')
            image = _external(model, current, primitive, request, budget)
            current = image['state']
            native.append(d_map({'action_ref': binding.action_ref, 'payload': binding.payload,
                'current_body_ref': binding.current_body_ref, 'support_ref': binding.support_ref}))
            effects.append(d_map(image))
            cost += image['event_ledger']['debit']
        rows.append(d_map({'native_word': tuple(native), 'sealed_effects': tuple(effects), 'state': current,
            'expanded_input_cost': cost, 'archive_only_suffix_count': len(word) - len(native),
            'no_intermediate_reconciliation': True, 'primitive_release_authorized': False,
            'selected_identity_survives_its_motion': True}))
    return {'compiled_axial_words': tuple(rows)}


def _observations_match(bodies, observed):
    cells = {body.cell: body for body in bodies}
    if len(set(body.cell for body in observed)) != len(observed) or set(cells) != set(body.cell for body in observed):
        return False
    return all(all(getattr(item, field) is None or getattr(item, field) == getattr(cells[item.cell], field)
        for field in ('positive_axis', 'positive_pole_ref', 'negative_pole_ref')) for item in observed)


def _identity(model, request, budget):
    if not request.observations:
        raise AxialPrerequisite('ORDERED_SEALED_OBSERVED_BODY_PACKETS_MISSING')
    rows = []
    for index, sample in enumerate(request.observations):
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise AxialPrerequisite('AXIAL_IDENTITY_PACKET_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('before_state', 'primitive', 'observed_body_frames', 'observed_selection_known')):
            raise AxialPrerequisite('PRIOR_SELECTION_INPUT_AND_UNLABELLED_ORDERED_BODY_FRAMES_MISSING')
        before = AxialState.model_validate(sample['before_state'])
        primitive = AxialInput.model_validate(sample['primitive'])
        observed = tuple(tuple(AxialObservedBody.model_validate(item) for item in frame) for frame in sample['observed_body_frames'])
        if not observed or len(observed) > request.domain_bound:
            raise AxialPrerequisite('BOUNDED_NONEMPTY_OBSERVED_FRAME_DOMAIN_REQUIRED')
        image = _external(model, before, primitive, request, budget)
        endpoint = image['state']
        def expected_timeline():
            yield before.bodies
            direct = image.get('direct_effect')
            current = (AxialState.model_validate(direct['state']) if direct is not None else endpoint).bodies
            yield current
            closure = image.get('relaxation')
            if closure is not None:
                for tick in closure['trajectory']:
                    deltas = {ref: after for ref, _, after in tick['position_deltas']}
                    current = tuple(body.model_copy(update={'cell': deltas[body.body_ref]}) if body.body_ref in deltas else body for body in current)
                    yield current
        matched = 0
        for predicted in expected_timeline():
            budget.visit({'identity_packet_index': index, 'next_observed_frame': matched})
            while matched < len(observed) and _observations_match(predicted, observed[matched]):
                matched += 1
        endpoint_matches = _observations_match(endpoint.bodies, observed[-1])
        mapping = {body.cell: body.body_ref for body in endpoint.bodies}
        active = next((body for body in endpoint.bodies if body.body_ref == endpoint.active_body_ref), None)
        selection_matches = None
        if sample['observed_selection_known'] is True:
            if 'observed_selected_cell' not in sample:
                raise AxialPrerequisite('KNOWN_SELECTION_WITHOUT_OBSERVED_MARKER_CELL')
            observed_cell = tuple(sample['observed_selected_cell']) if sample['observed_selected_cell'] is not None else None
            selection_matches = observed_cell == (active.cell if active is not None else None)
        rows.append(d_map({'packet_index': index, 'ordered_sparse_frames_match_model': matched == len(observed),
            'endpoint_matches': endpoint_matches, 'selection_matches': selection_matches,
            'conditional_identity_assignment': tuple((ordinal, mapping.get(item.cell)) for ordinal, item in enumerate(observed[-1])) if endpoint_matches else (),
            'candidate_active_owner_ref': endpoint.active_body_ref if selection_matches else None,
            'assignments_conditioned_on_supplied_dynamics': True,
            'unobserved_appearance_fields_retained': tuple((ordinal, tuple(field for field in ('positive_axis', 'positive_pole_ref', 'negative_pole_ref') if getattr(item, field) is None))
                for ordinal, item in enumerate(observed[-1]))}))
    return {'model_correlated_identity_constraints': tuple(rows)}


def _compare(model, request, budget):
    if not request.observations:
        raise AxialPrerequisite('ORDERED_SEALED_PIVOT_MOTION_PACKETS_MISSING')
    rows, first = [], None
    for index, sample in enumerate(request.observations):
        budget.visit({'packet_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise AxialPrerequisite('AXIAL_PACKET_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('actual_state', 'expected_state', 'actual_stop_ref', 'expected_stop_ref', 'scene_transition_ref', 'expected_scene_transition_ref')):
            raise AxialPrerequisite('FULL_STATE_RELAXATION_STOP_AND_SCENE_EVIDENCE_MISSING')
        actual = AxialState.model_validate(sample['actual_state'])
        expected = AxialState.model_validate(sample['expected_state'])
        actual_bodies, _, _, _ = _state(model, actual, budget)
        expected_bodies, _, _, _ = _state(model, expected, budget)
        differing = tuple(ref for ref in sorted(set(actual_bodies) | set(expected_bodies)) if actual_bodies.get(ref) != expected_bodies.get(ref))
        fields = tuple(name for name in ('active_body_ref', 'reserve', 'terminated') if getattr(actual, name) != getattr(expected, name))
        stop_matches = sample['actual_stop_ref'] == sample['expected_stop_ref']
        scene_matches = sample['scene_transition_ref'] == sample['expected_scene_transition_ref']
        if sample['scene_transition_ref'] != 'no_scene_transition' and sample.get('next_scene_observation') is None:
            raise AxialPrerequisite('NEXT_SCENE_EVIDENCE_MISSING_AFTER_BOUNDARY')
        if first is None and (differing or fields or not stop_matches or not scene_matches):
            first = index
        rows.append(d_map({'packet_index': index, 'body_identity_or_pose_difference_refs': differing,
            'control_difference_fields': fields, 'stop_matches': stop_matches, 'scene_matches': scene_matches,
            'persistent_identity_positions': tuple((ref, expected_bodies[ref].cell, actual_bodies[ref].cell) for ref in sorted(set(actual_bodies) & set(expected_bodies))),
            'active_body_ref': actual.active_body_ref, 'next_scene_observation': sample.get('next_scene_observation'),
            'repeated_animation_or_motion_metadata_not_new_inputs': True, 'repair_search_executed': False}))
    return {'sealed_axial_constraints': tuple(rows), 'first_divergence_index': first}


def measure_axial_field_configuration(request: AxialFieldRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget, rows, current_model_ref = DWorkBudget(request), [], None
    operation = request.operation_ref.rsplit('.', 1)[-1]
    try:
        if operation == 'measure':
            return measure_axial_scene_a(request)
        if operation == 'costed_route':
            return d_result(request, 'NEEDS_EVIDENCE', 'SOURCE_K09_AND_COMPLETE_AXIAL_STEPPER_REQUIRED')
        if not request.models or request.state is None:
            raise AxialPrerequisite('SCOPED_AXIAL_MODELS_AND_CURRENT_FULL_STATE_MISSING')
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            if operation == 'pair_domain':
                pairs, excluded = _pairs(model, request.state, budget)
                row = {'eligible_pairs': pairs, 'excluded_pairs': excluded, 'collision_graph_is_separate': True}
            elif operation == 'force_potential':
                row = _field(model, request.state, budget)[2]
            elif operation == 'simultaneous_tick':
                if request.event_scope_ref != 'internal_tick':
                    raise AxialPrerequisite('SIMULTANEOUS_STEP_REQUIRES_INTERNAL_TICK_SCOPE')
                row = _tick(model, request.state, request, budget)
            elif operation == 'settle_closure':
                row = _closure(model, request.state, request, budget)
            elif operation == 'service_preimages':
                row = _services(model, request, budget)
            elif operation == 'compile':
                row = _compile(model, request, budget)
            elif operation == 'identity_control':
                row = _identity(model, request, budget)
            elif operation == 'sealed_compare':
                row = _compare(model, request, budget)
            elif operation == 'external_primitive':
                if request.primitive is None:
                    raise AxialPrerequisite('BOUND_CURRENT_AXIAL_PRIMITIVE_MISSING')
                row = _external(model, request.state, request.primitive, request, budget)
            else:
                return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'OK', 'EXACT_SCOPED_AXIAL_COMPUTATION', values={'model_correlated_results': tuple(rows)},
            complete=True, examined=budget.examined)
    except AxialPrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, getattr(error, 'frontier', d_map())))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
