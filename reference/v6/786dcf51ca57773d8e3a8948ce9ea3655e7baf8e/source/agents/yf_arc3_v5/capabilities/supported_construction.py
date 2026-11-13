"""Declared first landing, geometric ancestry and exact beam load projection.

No decorative color physics, contributor pooling, build-order selection,
implicit reset, global search or action release.
"""
from __future__ import annotations

from fractions import Fraction
from typing import ClassVar
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .construction_observation_contracts_a import ConstructionSceneInputA
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)

Point = tuple[int, int]


class ConstructionBeam(FrozenModel):
    beam_ref: Ref
    row: int
    column: int
    width: int = Field(ge=1, le=128)


class ConstructionPad(FrozenModel):
    pad_ref: Ref
    row: int
    column: int
    width: int = Field(ge=1, le=128)
    foundation_refs: tuple[Ref, ...] = Field(default=(), max_length=32)


class ConstructionBlocker(FrozenModel):
    blocker_ref: Ref
    row: int
    column: int
    width: int = Field(ge=1, le=128)


class ConstructionMaterial(FrozenModel):
    width: int = Field(ge=1, le=128)
    weight: tuple[int, int]
    bending_capacity: tuple[int, int]
    bearing_capacity_per_cell: tuple[int, int]


class ConstructionState(FrozenModel):
    beams: tuple[ConstructionBeam, ...] = Field(default=(), max_length=64)
    stock: tuple[tuple[int, int], ...] = Field(max_length=32)
    active_width: int | None = Field(default=None, ge=1, le=128)
    ghost: Point | None
    reserve: int = Field(ge=0)
    ready: bool
    terminated: bool


class ConstructionModel(FrozenModel):
    model_ref: Ref
    world_cells: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    allowed_beam_rows: tuple[int, ...] = Field(min_length=1, max_length=128)
    pads: tuple[ConstructionPad, ...] = Field(default=(), max_length=64)
    blockers: tuple[ConstructionBlocker, ...] = Field(default=(), max_length=64)
    materials: tuple[ConstructionMaterial, ...] = Field(default=(), max_length=32)
    contact_gap: int | None = Field(default=None, ge=1, le=128)
    contact_law_ref: Ref | None = None
    drop_law_ref: Ref | None = None
    reaction_law_ref: Ref | None = None
    reaction_position_law_ref: Ref | None = None
    pad_shunt_law_ref: Ref | None = None
    tipping_tolerance: tuple[int, int] | None = None
    utilization_tolerance: tuple[int, int] | None = None
    tipped_reaction_law_ref: Ref | None = None
    bending_law_ref: Ref | None = None
    bearing_law_ref: Ref | None = None
    target_cells: tuple[Point, ...] = Field(default=(), max_length=4096)
    required_foundation_refs: tuple[Ref, ...] | None = Field(default=None, max_length=32)
    goal_law_ref: Ref | None = None
    width_control_order: tuple[int, ...] = Field(default=(), max_length=32)
    exhausted_width_selection_ref: Ref | None = None
    width_change_ghost_law_ref: Ref | None = None
    point_origin: Point | None = None
    point_pitch: Point | None = None
    ghost_law_ref: Ref | None = None
    ghost_column_limits: tuple[int, int] | None = None
    ghost_row_limits: tuple[int, int] | None = None
    removal_law_ref: Ref | None = None
    unstable_placement_outcome_ref: Ref | None = None
    unstable_removal_outcome_ref: Ref | None = None
    collapse_restore_state: ConstructionState | None = None
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=8)
    terminal_order_ref: Ref | None = None
    debit_order_ref: Ref | None = None
    reset_state: ConstructionState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class ConstructionInput(FrozenModel):
    kind_ref: Ref
    width: int | None = Field(default=None, ge=1, le=128)
    point: Point | None = None
    beam_ref: Ref | None = None


class ConstructionBinding(FrozenModel):
    primitive: ConstructionInput
    action_ref: Ref
    payload: FrozenMap
    support_ref: Ref | None = None
    evidence_revision_ref: Ref


class ConstructionReservation(FrozenModel):
    reservation_ref: Ref
    required_stock: tuple[tuple[int, int], ...] = Field(max_length=32)
    prefixes: tuple[ConstructionState, ...] = Field(min_length=1, max_length=64)
    includes_common_continuation: bool
    required_utilization_margin: tuple[int, int]
    action_cost_lower_bound: int = Field(ge=0)
    evidence_ref: Ref


_CASES = (
    ('layout_measure', ('MEASURE',)), ('landing_domain', ('DOMAIN', 'INVERSE_DOMAIN')),
    ('contact_ancestry', ('PROPAGATE',)), ('load_projection', ('EVALUATE',)),
    ('resource_reservation', ('DOMAIN',)), ('prefix_plan', ('SEARCH', 'DOMAIN')),
    ('control_compile', ('COMPILE',)), ('recovery_projection', ('DOMAIN',)),
    ('transaction_reconcile', ('COMPARE',)), ('evidence_discrimination', ('FIT', 'PROBE')),
    ('external_primitive', ('STEP',)),
)


class SupportedConstructionRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.supported_construction_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.supported_construction.{operation}', mode)
        for operation, modes in _CASES for mode in modes)
    models: tuple[ConstructionModel, ...] = Field(default=(), max_length=32)
    state: ConstructionState | None = None
    primitive: ConstructionInput | None = None
    placements: tuple[ConstructionBeam, ...] = Field(default=(), max_length=4096)
    required_support_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    reservations: tuple[ConstructionReservation, ...] = Field(default=(), max_length=4096)
    words: tuple[tuple[ConstructionInput, ...], ...] = Field(default=(), max_length=3)
    bindings: tuple[ConstructionBinding, ...] = Field(default=(), max_length=4096)
    question_inputs: tuple[ConstructionInput, ...] = Field(default=(), max_length=4096)
    question_domain_complete: bool = False
    source_identity_ref: Ref | None = None
    scene_input: ConstructionSceneInputA | None = None
    route_input: FrozenMap | None = None


class ConstructionPrerequisite(Exception):
    pass


def _fraction(pair, cause, positive=False):
    if pair is None or pair[1] <= 0:
        raise ConstructionPrerequisite(cause)
    value = Fraction(pair[0], pair[1])
    if positive and value <= 0:
        raise ConstructionPrerequisite(cause)
    return value


def _ratio(value):
    return value.numerator, value.denominator


def _cells(item):
    return frozenset((item.row, column) for column in range(item.column, item.column + item.width))


def _state(model, state, budget):
    world = frozenset(model.world_cells)
    if len(world) != len(model.world_cells) or len(world) > budget.request.domain_bound:
        raise ConstructionPrerequisite('UNIQUE_BOUNDED_CONSTRUCTION_WORLD_REQUIRED')
    if len(set(model.allowed_beam_rows)) != len(model.allowed_beam_rows):
        raise ConstructionPrerequisite('UNIQUE_DECLARED_PLACEMENT_ROWS_REQUIRED')
    refs, occupied, beams = set(), set(), {}
    for item in (*model.pads, *model.blockers, *state.beams):
        ref = item.pad_ref if isinstance(item, ConstructionPad) else item.blocker_ref if isinstance(item, ConstructionBlocker) else item.beam_ref
        budget.visit({'construction_item_ref': ref})
        support = _cells(item)
        if ref in refs or not support <= world or occupied & support:
            raise ConstructionPrerequisite('FULL_CONSTRUCTION_IDENTITIES_OR_OCCUPANCY_NOT_VALID')
        refs.add(ref)
        occupied.update(support)
        if isinstance(item, ConstructionBeam):
            if item.row not in model.allowed_beam_rows:
                raise ConstructionPrerequisite('BEAM_OUTSIDE_DECLARED_PLACEMENT_ROWS')
            beams[ref] = item
    stock = dict(state.stock)
    if len(stock) != len(state.stock) or any(width <= 0 or stock[width] < 0 for width in sorted(stock)):
        raise ConstructionPrerequisite('EXACT_NONNEGATIVE_STOCK_DOMAIN_REQUIRED')
    if state.active_width is not None and state.active_width not in stock:
        raise ConstructionPrerequisite('ACTIVE_WIDTH_NOT_IN_CONTROL_STOCK_DOMAIN')
    return world, beams, stock


def _contacts(model, state, budget):
    _, beams, _ = _state(model, state, budget)
    if model.contact_law_ref != 'overlapping_cells_at_declared_vertical_gap' or model.contact_gap is None:
        raise ConstructionPrerequisite('EXACT_GEOMETRIC_CONTACT_LAW_AND_GAP_MISSING')
    graph = {}
    for ref in sorted(beams):
        beam, contacts = beams[ref], []
        for lower in (*model.pads, *state.beams):
            lower_ref = lower.pad_ref if isinstance(lower, ConstructionPad) else lower.beam_ref
            budget.visit({'beam_ref': ref, 'candidate_support_ref': lower_ref})
            if lower.row != beam.row + model.contact_gap:
                continue
            left, right = max(beam.column, lower.column), min(beam.column + beam.width, lower.column + lower.width)
            if left < right:
                contacts.append(d_map({'support_ref': lower_ref, 'kind_ref': 'pad' if isinstance(lower, ConstructionPad) else 'beam',
                    'left_center': _ratio(Fraction(2 * left + 1, 2)), 'right_center': _ratio(Fraction(2 * right - 1, 2)),
                    'overlap_cells': right - left, 'geometric_contact': True}))
        graph[ref] = tuple(contacts)
    return beams, graph


def _ancestry(model, state, budget):
    beams, graph = _contacts(model, state, budget)
    pad_roots = {pad.pad_ref: frozenset(pad.foundation_refs) for pad in model.pads}
    roots = {}
    for ref in sorted(beams, key=lambda item: (-beams[item].row, item)):
        inherited = set()
        for contact in graph[ref]:
            inherited.update(pad_roots[contact['support_ref']] if contact['kind_ref'] == 'pad' else roots[contact['support_ref']])
        roots[ref] = frozenset(inherited)
    contributors = tuple(ref for ref in sorted(beams) if _cells(beams[ref]) & set(model.target_cells))
    common = None
    if (model.goal_law_ref == 'one_target_beam_all_required_foundations_and_global_stability'
            and model.required_foundation_refs is not None and model.target_cells):
        common = tuple(ref for ref in contributors if set(model.required_foundation_refs) <= roots[ref])
    return beams, graph, roots, {'contact_graph': tuple(d_map({'beam_ref': ref, 'contacts': graph[ref]}) for ref in sorted(graph)),
        'foundation_ancestry': tuple((ref, tuple(sorted(roots[ref]))) for ref in sorted(roots)),
        'target_contributor_refs': contributors, 'common_ancestry_contributor_refs': common,
        'geometric_ancestry_is_not_positive_reaction': True, 'unrelated_contributors_not_pooled': True}


def _bending(beam, weight, incoming, reactions, budget):
    left, right = Fraction(beam.column), Fraction(beam.column + beam.width)
    density = weight / beam.width
    breakpoints = sorted({left, right, *(x for _, x in incoming), *(x for _, x, _, _ in reactions)})
    positions = set(breakpoints)
    for first, second in zip(breakpoints, breakpoints[1:]):
        budget.visit({'beam_ref': beam.beam_ref, 'moment_interval': (_ratio(first), _ratio(second))})
        midpoint = (first + second) / 2
        intercept = sum((force for force, x, _, _ in reactions if x < midpoint), Fraction(0)) - sum((force for force, x in incoming if x < midpoint), Fraction(0))
        critical = left + intercept / density
        if first < critical < second:
            positions.add(critical)
    values = []
    for x in sorted(positions):
        budget.visit({'beam_ref': beam.beam_ref, 'moment_position': _ratio(x)})
        moment = sum((force * max(Fraction(0), x - location) for force, location, _, _ in reactions), Fraction(0))
        moment -= sum((force * max(Fraction(0), x - location) for force, location in incoming), Fraction(0))
        moment -= density * (x - left) ** 2 / 2
        values.append((abs(moment), x))
    return max(values)


def _loads(model, state, budget):
    beams, graph, roots, ancestry = _ancestry(model, state, budget)
    if (model.reaction_law_ref != 'outermost_contact_barycentric_reactions'
            or model.reaction_position_law_ref != 'clamp_resultant_to_support_hull'
            or model.pad_shunt_law_ref not in ('disabled', 'resultant_inside_pad_contact_shunts_all')
            or model.tipped_reaction_law_ref not in ('clamp_resultant_to_support_hull', 'no_reactions_when_tipped')
            or model.bending_law_ref != 'uniform_self_weight_and_point_load_moments'
            or model.bearing_law_ref != 'reaction_per_contact_cell_over_capacity'):
        raise ConstructionPrerequisite('DECLARED_REACTION_TIPPING_BENDING_AND_BEARING_LAWS_MISSING')
    tip_tol = _fraction(model.tipping_tolerance, 'EXACT_TIPPING_TOLERANCE_MISSING')
    util_tol = _fraction(model.utilization_tolerance, 'EXACT_UTILIZATION_TOLERANCE_MISSING')
    if tip_tol < 0 or util_tol < 0:
        raise ConstructionPrerequisite('NONNEGATIVE_DECLARED_NUMERICAL_TOLERANCES_REQUIRED')
    materials = {material.width: material for material in model.materials}
    if len(materials) != len(model.materials):
        raise ConstructionPrerequisite('WIDTH_MATERIAL_TABLE_NOT_FUNCTIONAL')
    incoming = {ref: [] for ref in beams}
    rows, all_stable, peak_util = [], True, Fraction(0)
    for ref in sorted(beams, key=lambda item: (beams[item].row, item)):
        budget.visit({'load_projection_beam_ref': ref})
        beam = beams[ref]
        if beam.width not in materials:
            raise ConstructionPrerequisite('CURRENT_WIDTH_MATERIAL_PARAMETERS_MISSING')
        material = materials[beam.width]
        own = _fraction(material.weight, 'POSITIVE_DECLARED_UNIFORM_BEAM_WEIGHT_MISSING', True)
        bending_capacity = _fraction(material.bending_capacity, 'POSITIVE_BENDING_CAPACITY_MISSING', True)
        bearing_capacity = _fraction(material.bearing_capacity_per_cell, 'POSITIVE_BEARING_CAPACITY_MISSING', True)
        center = Fraction(2 * beam.column + beam.width, 2)
        external = sum((force for force, _ in incoming[ref]), Fraction(0))
        total = own + external
        moment = own * center + sum((force * x for force, x in incoming[ref]), Fraction(0))
        resultant = moment / total
        contacts = graph[ref]
        reactions, tipped, hull = [], not bool(contacts), None
        if contacts:
            endpoints = tuple((Fraction(*contact[key]), contact['support_ref'], contact['kind_ref'], contact['overlap_cells'])
                for contact in contacts for key in ('left_center', 'right_center'))
            low, high = min(endpoints), max(endpoints)
            hull = low[0], high[0]
            tipped = resultant < low[0] - tip_tol or resultant > high[0] + tip_tol
            x = min(high[0], max(low[0], resultant))
            shunts = tuple(contact for contact in contacts if contact['kind_ref'] == 'pad'
                and Fraction(*contact['left_center']) <= x <= Fraction(*contact['right_center']))
            if not tipped or model.tipped_reaction_law_ref == 'clamp_resultant_to_support_hull':
                if shunts and model.pad_shunt_law_ref == 'resultant_inside_pad_contact_shunts_all':
                    if len(shunts) != 1:
                        raise ConstructionPrerequisite('PAD_SHUNT_OWNER_NOT_UNIQUE')
                    contact = shunts[0]
                    reactions.append((total, x, contact['support_ref'], contact['overlap_cells']))
                elif low[0] == high[0]:
                    if low[1] != high[1]:
                        raise ConstructionPrerequisite('COINCIDENT_REACTION_SUPPORT_REQUIRES_SEPARATE_LAW')
                    reactions.append((total, low[0], low[1], low[3]))
                else:
                    first_force = total * (high[0] - x) / (high[0] - low[0])
                    reactions.extend(((first_force, low[0], low[1], low[3]), (total - first_force, high[0], high[1], high[3])))
        bearing = max((force / (count * bearing_capacity) for force, _, _, count in reactions), default=Fraction(0))
        maximum_moment, moment_x = _bending(beam, own, incoming[ref], reactions, budget)
        bending = maximum_moment / bending_capacity
        stable = bool(contacts) and not tipped and bending <= 1 + util_tol and bearing <= 1 + util_tol
        all_stable = all_stable and stable
        peak_util = max(peak_util, bending, bearing)
        for force, x, support_ref, _ in reactions:
            if support_ref in incoming:
                incoming[support_ref].append((force, x))
        reaction_refs = {support_ref for _, _, support_ref, _ in reactions}
        rows.append(d_map({'beam_ref': ref, 'self_weight': _ratio(own), 'external_load': _ratio(external),
            'total_load': _ratio(total), 'resultant_x': _ratio(resultant),
            'support_hull': tuple(_ratio(x) for x in hull) if hull is not None else None,
            'tipped': tipped, 'maximum_bending_moment': _ratio(maximum_moment), 'moment_location_x': _ratio(moment_x),
            'bending_utilization': _ratio(bending), 'bearing_utilization': _ratio(bearing), 'stable': stable,
            'geometric_ancestry': tuple(sorted(roots[ref])),
            'active_reactions': tuple(d_map({'force': _ratio(force), 'x': _ratio(x), 'support_ref': lower, 'contact_cells': count}) for force, x, lower, count in reactions),
            'zero_reaction_geometric_support_refs': tuple(contact['support_ref'] for contact in contacts
                if contact['support_ref'] not in reaction_refs or all(force == 0 for force, _, lower, _ in reactions if lower == contact['support_ref']))}))
    candidates = ancestry['common_ancestry_contributor_refs']
    return {'beam_loads': tuple(rows), 'ancestry': d_map(ancestry), 'globally_stable': all_stable,
        'peak_utilization': _ratio(peak_util), 'accepted_construction': all_stable and bool(candidates) if candidates is not None else None,
        'display_color_is_not_the_stability_predicate': True}


def _landing(model, state, placement, budget):
    world, beams, _ = _state(model, state, budget)
    if model.drop_law_ref != 'first_overlap_support_below_spawn_at_declared_gap' or model.contact_gap is None:
        raise ConstructionPrerequisite('SUPPLIED_FIRST_INTERCEPT_DROP_LAW_MISSING')
    if placement.beam_ref in beams or any(placement.beam_ref == item.pad_ref for item in model.pads) or any(placement.beam_ref == item.blocker_ref for item in model.blockers):
        raise ConstructionPrerequisite('NEW_PLACEMENT_IDENTITY_ALREADY_PRESENT')
    candidates = []
    for item in (*model.pads, *model.blockers, *state.beams):
        budget.visit({'landing_candidate_row': item.row})
        if item.row >= placement.row + model.contact_gap and max(placement.column, item.column) < min(placement.column + placement.width, item.column + item.width):
            candidates.append(item)
    if not candidates:
        return {'placement': placement, 'valid_landing': False, 'cause': 'NO_DECLARED_INTERCEPT', 'first_intercept_refs': ()}
    intercept = min(item.row for item in candidates)
    first = tuple(item for item in candidates if item.row == intercept)
    landed = placement.model_copy(update={'row': intercept - model.contact_gap})
    first_refs = tuple(item.pad_ref if isinstance(item, ConstructionPad) else item.blocker_ref if isinstance(item, ConstructionBlocker) else item.beam_ref for item in first)
    occupied = frozenset(cell for item in (*model.pads, *model.blockers, *state.beams) for cell in _cells(item))
    valid = landed.row in model.allowed_beam_rows and _cells(landed) <= world and not _cells(landed) & occupied and not any(isinstance(item, ConstructionBlocker) for item in first)
    return {'placement': landed, 'valid_landing': valid, 'cause': 'FIRST_INTERCEPT_VALID' if valid else 'FIRST_INTERCEPT_INVALID',
        'first_intercept_refs': first_refs, 'lower_valid_intercept_not_substituted': True}


def _landing_domain(model, request, budget):
    if not request.placements or len(request.placements) > request.domain_bound:
        raise ConstructionPrerequisite('BOUNDED_SOURCE_PLACEMENT_DOMAIN_MISSING')
    rows = []
    for placement in request.placements:
        image = _landing(model, request.state, placement, budget)
        contacts = ()
        if image['valid_landing']:
            contextual = request.state.model_copy(update={'beams': request.state.beams + (image['placement'],)})
            contacts = _contacts(model, contextual, budget)[1][placement.beam_ref]
        relation = set(request.required_support_refs) <= {contact['support_ref'] for contact in contacts}
        rows.append(d_map({'source_placement': placement, 'landing': d_map(image), 'contacts': contacts,
            'requested_support_relation_holds': relation, 'inverse_domain_member': bool(image['valid_landing']) and relation}))
    return {'landing_domain': tuple(rows), 'complete_in_source_placement_domain': True}


def _reservations(model, request, budget):
    _, _, stock = _state(model, request.state, budget)
    if not request.reservations or len(request.reservations) > request.domain_bound:
        raise ConstructionPrerequisite('BOUNDED_SOURCE_PROVIDER_RESERVATIONS_MISSING')
    rows = []
    for reservation in request.reservations:
        budget.visit({'reservation_ref': reservation.reservation_ref})
        if not reservation.includes_common_continuation:
            raise ConstructionPrerequisite('RESERVATION_PREFIXES_DO_NOT_COVER_COMMON_CONTINUATION')
        demands = dict(reservation.required_stock)
        if len(demands) != len(reservation.required_stock) or any(width not in stock or demands[width] < 0 for width in sorted(demands)):
            raise ConstructionPrerequisite('EXACT_CURRENT_STOCK_RESERVATION_DEMANDS_REQUIRED')
        margin = _fraction(reservation.required_utilization_margin, 'EXPLICIT_REQUIRED_RESERVATION_MARGIN_MISSING')
        if margin < 0 or margin > 1:
            raise ConstructionPrerequisite('RESERVATION_MARGIN_OUTSIDE_DECLARED_UTILIZATION_SCALE')
        prefix_loads = tuple(d_map(_loads(model, state, budget)) for state in reservation.prefixes)
        safe = all(row['globally_stable'] and Fraction(*row['peak_utilization']) <= 1 - margin for row in prefix_loads)
        rows.append(d_map({'reservation_ref': reservation.reservation_ref,
            'stock_feasible': all(demands.get(width, 0) <= stock[width] for width in sorted(stock)),
            'residual_stock': tuple((width, stock[width] - demands.get(width, 0)) for width in sorted(stock)),
            'prefix_mechanical_margin_satisfied': safe, 'prefix_loads': prefix_loads,
            'action_cost_lower_bound': reservation.action_cost_lower_bound,
            'action_cost_distinct_from_stock': True, 'build_route_proved': False}))
    return {'reservation_alternatives': tuple(rows), 'complete_in_supplied_reservation_domain': True}


def _rounded(value):
    lower = value.numerator // value.denominator
    return lower + (1 if value - lower > Fraction(1, 2) else 0)


def _point(model, state, point):
    if model.point_origin is None or model.point_pitch is None or any(pitch <= 0 for pitch in model.point_pitch):
        raise ConstructionPrerequisite('CURRENT_NATIVE_POINT_GEOMETRY_MISSING')
    row = Fraction(point[0] - model.point_origin[0], model.point_pitch[0])
    column = Fraction(point[1] - model.point_origin[1], model.point_pitch[1])
    return row, column


def _failure(model, state, outcome):
    if outcome == 'keep_ready_unstable':
        return state.model_copy(update={'ready': True}), 'READY_UNSTABLE'
    if outcome == 'game_over':
        return state.model_copy(update={'ready': False, 'terminated': True}), 'COLLAPSE_GAME_OVER'
    if outcome == 'restore_declared_collapse_entry':
        if model.collapse_restore_state is None:
            raise ConstructionPrerequisite('EXACT_COLLAPSE_RESTORATION_STATE_MISSING')
        return model.collapse_restore_state, 'COLLAPSE_ADAPTER_RESTORATION'
    raise ConstructionPrerequisite('ACTUAL_UNSTABLE_ADAPTER_LIFECYCLE_RULE_MISSING')


def _direct(model, state, primitive, budget):
    _, beams, stock = _state(model, state, budget)
    if primitive.kind_ref == 'select_width':
        if primitive.width not in stock or primitive.point is not None or primitive.beam_ref is not None:
            raise ConstructionPrerequisite('CURRENT_WIDTH_CONTROL_NOT_BOUND')
        if model.exhausted_width_selection_ref not in ('selectable_when_empty', 'refuse_when_empty'):
            raise ConstructionPrerequisite('EXHAUSTED_WIDTH_CONTROL_LAW_MISSING')
        if stock[primitive.width] == 0 and model.exhausted_width_selection_ref == 'refuse_when_empty':
            return {'state': state, 'effect_ref': 'EMPTY_WIDTH_SELECTION_REFUSAL', 'loads': None, 'unstable': False}
        if model.width_change_ghost_law_ref not in ('keep_ghost_anchor', 'reclamp_existing_ghost'):
            raise ConstructionPrerequisite('WIDTH_CHANGE_GHOST_EFFECT_MISSING')
        ghost = state.ghost
        if ghost is not None and model.width_change_ghost_law_ref == 'reclamp_existing_ghost':
            if model.ghost_column_limits is None or model.ghost_row_limits is None:
                raise ConstructionPrerequisite('DECLARED_WIDTH_CHANGE_GHOST_CLAMP_BOUNDS_MISSING')
            low, high = model.ghost_column_limits
            if high - primitive.width < low:
                raise ConstructionPrerequisite('SELECTED_WIDTH_OUTSIDE_GHOST_CLAMP_DOMAIN')
            ghost = ghost[0], max(low, min(high - primitive.width, ghost[1]))
        return {'state': state.model_copy(update={'active_width': primitive.width, 'ghost': ghost}), 'effect_ref': 'WIDTH_SELECTION', 'loads': None, 'unstable': False}
    if primitive.kind_ref == 'point':
        if primitive.point is None or primitive.width is not None or primitive.beam_ref is not None:
            raise ConstructionPrerequisite('CURRENT_NATIVE_CONSTRUCTION_POINT_MISSING')
        row, column = _point(model, state, primitive.point)
        hit_row, hit_column = row.numerator // row.denominator, column.numerator // column.denominator
        hits = tuple(beam for beam in state.beams if beam.row == hit_row and beam.column <= hit_column < beam.column + beam.width)
        if len(hits) > 1:
            raise ConstructionPrerequisite('BEAM_HIT_OWNER_NOT_UNIQUE')
        if hits:
            beam = hits[0]
            before_loads = _loads(model, state, budget)
            _, graph = _contacts(model, state, budget)
            if model.removal_law_ref == 'no_geometric_upper_beam':
                removable = not any(contact['support_ref'] == beam.beam_ref for ref in graph for contact in graph[ref])
            elif model.removal_law_ref == 'no_positive_upper_reaction':
                removable = not any(reaction['support_ref'] == beam.beam_ref and Fraction(*reaction['force']) > 0 for entry in before_loads['beam_loads'] for reaction in entry['active_reactions'])
            else:
                raise ConstructionPrerequisite('PERMITTED_REMOVAL_TOP_LOAD_RULE_MISSING')
            if not removable:
                return {'state': state, 'effect_ref': 'TOP_LOAD_REMOVAL_REFUSAL', 'loads': d_map(before_loads), 'unstable': False}
            if beam.width not in stock:
                raise ConstructionPrerequisite('REMOVAL_STOCK_RETURN_WIDTH_MISSING')
            updated = dict(stock)
            updated[beam.width] += 1
            after = state.model_copy(update={'beams': tuple(item for item in state.beams if item.beam_ref != beam.beam_ref), 'stock': tuple(sorted(updated.items()))})
            loads = _loads(model, after, budget)
            unstable = not loads['globally_stable']
            effect = 'REMOVAL_STOCK_RETURN'
            if unstable:
                after, effect = _failure(model, after, model.unstable_removal_outcome_ref)
            return {'state': after, 'effect_ref': effect, 'loads': d_map(loads), 'unstable': unstable, 'removed_beam_ref': beam.beam_ref}
        if state.active_width is None or model.ghost_law_ref != 'nearest_ties_floor_center_then_clamp':
            raise ConstructionPrerequisite('ACTIVE_WIDTH_AND_EXACT_POINT_GHOST_LAW_MISSING')
        if model.ghost_column_limits is None or model.ghost_row_limits is None:
            raise ConstructionPrerequisite('DECLARED_GHOST_CLAMP_BOUNDS_MISSING')
        left = _rounded(column - Fraction(state.active_width, 2))
        top = _rounded(row)
        low, high = model.ghost_column_limits
        if high - state.active_width < low or model.ghost_row_limits[0] > model.ghost_row_limits[1]:
            raise ConstructionPrerequisite('SELECTED_WIDTH_OUTSIDE_GHOST_CLAMP_DOMAIN')
        ghost = max(model.ghost_row_limits[0], min(model.ghost_row_limits[1], top)), max(low, min(high - state.active_width, left))
        return {'state': state.model_copy(update={'ghost': ghost}), 'effect_ref': 'GHOST_POSITION_ONLY', 'loads': None, 'unstable': False,
            'outline_does_not_certify_mechanics': True}
    if primitive.kind_ref != 'place' or primitive.point is not None or primitive.width is not None or not primitive.beam_ref:
        raise ConstructionPrerequisite('BOUND_NEW_BEAM_PLACEMENT_INPUT_MISSING')
    if state.active_width is None or state.ghost is None or not state.ready:
        return {'state': state, 'effect_ref': 'NO_READY_WIDTH_GHOST_PLACEMENT_REFUSAL', 'loads': None, 'unstable': False}
    if stock[state.active_width] == 0:
        return {'state': state, 'effect_ref': 'EMPTY_STOCK_PLACEMENT_REFUSAL', 'loads': None, 'unstable': False}
    placement = ConstructionBeam(beam_ref=primitive.beam_ref, row=state.ghost[0], column=state.ghost[1], width=state.active_width)
    landing = _landing(model, state, placement, budget)
    if not landing['valid_landing']:
        return {'state': state, 'effect_ref': 'FIRST_INTERCEPT_PLACEMENT_REFUSAL', 'loads': None, 'unstable': False, 'landing': d_map(landing)}
    updated = dict(stock)
    updated[state.active_width] -= 1
    after = state.model_copy(update={'beams': state.beams + (landing['placement'],), 'stock': tuple(sorted(updated.items()))})
    loads = _loads(model, after, budget)
    unstable, effect = not loads['globally_stable'], 'BEAM_PLACEMENT'
    if unstable:
        after, effect = _failure(model, after, model.unstable_placement_outcome_ref)
    return {'state': after, 'effect_ref': effect, 'loads': d_map(loads), 'unstable': unstable, 'landing': d_map(landing)}


def _external(model, state, primitive, request, budget):
    _state(model, state, budget)
    if primitive.kind_ref == 'reset':
        if primitive.point is not None or primitive.width is not None or primitive.beam_ref is not None or model.reset_state is None or model.reset_cost is None:
            raise ConstructionPrerequisite('INDEPENDENT_BOUND_RESET_RESTORATION_MISSING')
        _state(model, model.reset_state, budget)
        return {'before_state': state, 'state': model.reset_state, 'primitive_complete': True,
            'phase_snapshots': d_map({'before': state, 'independent_reset': model.reset_state}),
            'closure_facts': d_map({'independent_restoration_complete': True}),
            'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'debit': model.reset_cost, 'accepted': False, 'automatic_pass_count': 0})}
    if state.terminated:
        raise ConstructionPrerequisite('OFFICIAL_TERMINATION_REVOKES_OLD_CONSTRUCTION_INPUTS')
    costs = dict(model.input_costs)
    if len(costs) != len(model.input_costs) or primitive.kind_ref not in costs or any(costs[key] < 0 for key in sorted(costs)):
        raise ConstructionPrerequisite('CURRENT_CONSTRUCTION_INPUT_COST_LAW_MISSING')
    if model.terminal_order_ref not in ('acceptance_before_exhaustion', 'exhaustion_before_acceptance'):
        raise ConstructionPrerequisite('ACCEPTANCE_EXHAUSTION_ORDER_MISSING')
    if model.debit_order_ref not in ('before_direct', 'after_direct'):
        raise ConstructionPrerequisite('INPUT_DEBIT_VERSUS_ADAPTER_RESTORATION_ORDER_MISSING')
    cost = costs[primitive.kind_ref]
    initial = state.model_copy(update={'reserve': max(0, state.reserve - cost)}) if model.debit_order_ref == 'before_direct' else state
    direct = _direct(model, initial, primitive, budget)
    after_direct = direct['state']
    _state(model, after_direct, budget)
    candidate = False
    if direct['loads'] is not None and not direct['unstable']:
        candidate = direct['loads']['accepted_construction']
        if candidate is None:
            raise ConstructionPrerequisite('REQUIRED_SINGLE_CONTRIBUTOR_TARGET_ANCESTRY_CONTRACT_MISSING')
    reserve = after_direct.reserve if model.debit_order_ref == 'before_direct' else max(0, after_direct.reserve - cost)
    exhausted = reserve == 0
    accepted = bool(candidate) and (model.terminal_order_ref == 'acceptance_before_exhaustion' or not exhausted)
    after = after_direct.model_copy(update={'reserve': reserve, 'terminated': after_direct.terminated or accepted or exhausted})
    return {'before_state': state, 'state': after, 'direct_effect': d_map(direct), 'primitive_complete': True,
        'phase_snapshots': d_map({'before': state, 'after_direct_and_mechanics': after_direct, 'after_cost_and_verdict': after}),
        'closure_facts': d_map({'direct_complete': True, 'global_mechanics_projected': direct['loads'] is not None,
            'actual_failure_adapter_applied': direct['unstable'], 'cost_complete': True, 'official_verdict_complete': True}),
        'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'debit': costs[primitive.kind_ref],
            'debit_order_ref': model.debit_order_ref,
            'accepted': accepted, 'exhausted': exhausted, 'effect_ref': direct['effect_ref'],
            'automatic_pass_count': 1 if direct['loads'] is not None else 0,
            'second_mechanics_pass_forbidden': True, 'second_debit_forbidden': True})}


def _words(model, request, budget):
    if not request.words:
        raise ConstructionPrerequisite('SOURCE_BOUND_CONTROL_OR_RECOVERY_WORDS_MISSING')
    rows = []
    for word in request.words:
        if len(word) > request.depth_bound:
            raise DComputationInterrupted('CONSTRUCTION_WORD_PRIMITIVE_BOUND', d_map())
        current, native, effects, cost = request.state, [], [], 0
        for primitive in word:
            budget.visit({'word_primitive_index': len(native)})
            if current.terminated:
                break
            matches = tuple(binding for binding in request.bindings if binding.primitive == primitive
                and binding.evidence_revision_ref == request.scope.evidence_revision_ref)
            if len(matches) != 1 or (primitive.kind_ref in ('point', 'select_width') and not matches[0].support_ref):
                raise ConstructionPrerequisite('CURRENT_NATIVE_CONTROL_OR_BODY_SUPPORT_BINDING_NOT_UNIQUE')
            image = _external(model, current, primitive, request, budget)
            current = image['state']
            native.append(d_map({'action_ref': matches[0].action_ref, 'payload': matches[0].payload, 'support_ref': matches[0].support_ref}))
            effects.append(d_map(image))
            cost += image['event_ledger']['debit']
        rows.append(d_map({'native_word': tuple(native), 'sealed_effects': tuple(effects), 'state': current,
            'expanded_input_cost': cost, 'archive_only_suffix_count': len(word) - len(native),
            'native_word_is_not_build_order_optimality': True, 'primitive_release_authorized': False,
            'no_intermediate_reconciliation': True}))
    return {'checked_native_construction_words': tuple(rows)}


def _compare(model, request, budget):
    if not request.observations:
        raise ConstructionPrerequisite('SEALED_GEOMETRY_STOCK_FAILURE_AND_SCENE_PACKETS_MISSING')
    rows, first = [], None
    for index, sample in enumerate(request.observations):
        budget.visit({'packet_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise ConstructionPrerequisite('CONSTRUCTION_PACKET_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('actual_state', 'expected_state', 'failure_events', 'expected_failure_events', 'scene_transition_ref', 'expected_scene_transition_ref')):
            raise ConstructionPrerequisite('WHOLE_FAILURE_INTERVAL_AND_SCENE_PREDICTION_MISSING')
        actual = ConstructionState.model_validate(sample['actual_state'])
        expected = ConstructionState.model_validate(sample['expected_state'])
        _state(model, actual, budget)
        _state(model, expected, budget)
        actual_beams = {beam.beam_ref: d_map(beam) for beam in actual.beams}
        expected_beams = {beam.beam_ref: d_map(beam) for beam in expected.beams}
        differences = tuple(ref for ref in sorted(set(actual_beams) | set(expected_beams)) if actual_beams.get(ref) != expected_beams.get(ref))
        fields = tuple(field for field in ('stock', 'active_width', 'ghost', 'reserve', 'ready', 'terminated') if getattr(actual, field) != getattr(expected, field))
        failure_matches = sample['failure_events'] == sample['expected_failure_events']
        scene_matches = sample['scene_transition_ref'] == sample['expected_scene_transition_ref']
        if sample['scene_transition_ref'] != 'no_scene_transition' and sample.get('next_scene_observation') is None:
            raise ConstructionPrerequisite('NEXT_SCENE_OBSERVATION_AFTER_BOUNDARY_MISSING')
        loads = _loads(model, actual, budget)
        if first is None and (differences or fields or not failure_matches or not scene_matches):
            first = index
        rows.append(d_map({'packet_index': index, 'beam_difference_refs': differences, 'control_or_stock_difference_fields': fields,
            'failure_interval_matches': failure_matches, 'scene_matches': scene_matches, 'actual_recomputed_mechanics': d_map(loads),
            'next_scene_observation': sample.get('next_scene_observation'), 'last_event_not_substituted_for_packet': True}))
    return {'sealed_construction_comparisons': tuple(rows), 'first_divergence_index': first}


def _discrimination(request, budget):
    if request.mode_ref == 'FIT':
        if not request.observations:
            raise ConstructionPrerequisite('SEALED_CURRENT_MODEL_DISCRIMINATION_EVIDENCE_MISSING')
        rows = []
        for model in request.models:
            constraints = []
            for index, sample in enumerate(request.observations):
                budget.visit({'model_ref': model.model_ref, 'evidence_index': index})
                if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
                    raise ConstructionPrerequisite('MODEL_FIT_PACKET_OWNER_OR_SEAL_MISMATCH')
                if any(sample.get(key) is None for key in ('before_state', 'primitive', 'actual_state', 'observed_unstable')):
                    raise ConstructionPrerequisite('ACTUAL_MODEL_FIT_INPUT_STATE_AND_FAILURE_EVIDENCE_MISSING')
                before = ConstructionState.model_validate(sample['before_state'])
                actual = ConstructionState.model_validate(sample['actual_state'])
                primitive = ConstructionInput.model_validate(sample['primitive'])
                _state(model, actual, budget)
                image = _external(model, before, primitive, request, budget)
                expected = image['state']
                actual_geometry = {beam.beam_ref: d_map(beam) for beam in actual.beams}
                expected_geometry = {beam.beam_ref: d_map(beam) for beam in expected.beams}
                fields = tuple(field for field in ('active_width', 'ghost', 'reserve', 'ready', 'terminated')
                    if getattr(actual, field) != getattr(expected, field))
                direct = image.get('direct_effect')
                unstable = bool(direct['unstable']) if direct is not None else False
                matches = (actual_geometry == expected_geometry and dict(actual.stock) == dict(expected.stock)
                    and not fields and unstable == sample['observed_unstable'])
                constraints.append(d_map({'evidence_index': index, 'matches_observed_consequences': matches,
                    'control_difference_fields': fields, 'predicted_unstable': unstable,
                    'observed_unstable': sample['observed_unstable'], 'predicted_response': d_map(image)}))
            rows.append(d_map({'model_ref': model.model_ref, 'evidence_constraints': tuple(constraints)}))
        return {'model_evidence_constraints': tuple(rows), 'unobserved_thresholds_not_confirmed': True}
    if not request.question_domain_complete or not request.question_inputs or len(request.question_inputs) > request.domain_bound:
        raise ConstructionPrerequisite('SOURCE_COMPLETE_BOUNDED_QUESTION_INPUT_DOMAIN_MISSING')
    rows = []
    for index, primitive in enumerate(request.question_inputs):
        results = []
        for model in request.models:
            budget.visit({'question_index': index, 'model_ref': model.model_ref})
            try:
                image = _external(model, request.state, primitive, request, budget)
                results.append(d_map({'model_ref': model.model_ref, 'predicted_response': d_map(image), 'missing_prerequisite': None}))
            except ConstructionPrerequisite as error:
                results.append(d_map({'model_ref': model.model_ref, 'predicted_response': None, 'missing_prerequisite': str(error)}))
        responses = tuple(row['predicted_response'] for row in results if row['predicted_response'] is not None)
        visible = tuple(response['state'] for response in responses)
        rows.append(d_map({'source_question_index': index, 'primitive': primitive, 'model_response_domain': tuple(results),
            'physical_predictions_differ': bool(responses) and any(response != responses[0] for response in responses[1:]),
            'predicted_state_consequences_differ': bool(visible) and any(state != visible[0] for state in visible[1:]),
            'unmodeled_display_quantities_not_declared_observable': True,
            'question_selected_or_executed': False, 'missing_implementation_not_a_gameplay_probe': True}))
    return {'source_question_discrimination_facts': tuple(rows), 'successful_case_not_universal_threshold_proof': True}


def measure_supported_construction(request: SupportedConstructionRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget, rows, current_model_ref = DWorkBudget(request), [], None
    operation = request.operation_ref.rsplit('.', 1)[-1]
    try:
        if operation == 'layout_measure' or operation == 'prefix_plan' and request.mode_ref == 'DOMAIN':
            from .construction_observation_a import measure_construction_extension_a
            return measure_construction_extension_a(request)
        if operation == 'prefix_plan':
            return d_result(request, 'NEEDS_EVIDENCE', 'SOURCE_K09_AND_COMPLETE_CONSTRUCTION_C_STEPPER_REQUIRED')
        if not request.models or request.state is None:
            raise ConstructionPrerequisite('SCOPED_CONSTRUCTION_MODELS_AND_CURRENT_INVENTORY_MISSING')
        if operation == 'evidence_discrimination':
            values = _discrimination(request, budget)
            budget.finish()
            return d_result(request, 'OK', 'EXACT_MODEL_DISCRIMINATION_DOMAIN', values=values, complete=True, examined=budget.examined)
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            if operation == 'landing_domain':
                row = _landing_domain(model, request, budget)
            elif operation == 'contact_ancestry':
                row = _ancestry(model, request.state, budget)[3]
            elif operation == 'load_projection':
                row = _loads(model, request.state, budget)
            elif operation == 'resource_reservation':
                row = _reservations(model, request, budget)
            elif operation in ('control_compile', 'recovery_projection'):
                row = _words(model, request, budget)
            elif operation == 'transaction_reconcile':
                row = _compare(model, request, budget)
            elif operation == 'external_primitive':
                if request.primitive is None:
                    raise ConstructionPrerequisite('BOUND_ACTUAL_CONSTRUCTION_INPUT_MISSING')
                row = _external(model, request.state, request.primitive, request, budget)
            else:
                return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'OK', 'EXACT_SCOPED_SUPPORTED_CONSTRUCTION', values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except ConstructionPrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
