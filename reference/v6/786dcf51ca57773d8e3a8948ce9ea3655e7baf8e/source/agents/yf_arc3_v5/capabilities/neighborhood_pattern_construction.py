"""Full-occupancy neighborhood colors, masks and finite construction domains.

Comparison holes never remove physical providers. SRC chooses the site,
assignment and schedule; this module only checks exact supplied constraints.
"""

from __future__ import annotations

from itertools import product
from typing import ClassVar
from pydantic import Field

from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)
from .scene_layer_measurement_d import DSceneCalibration,DSceneLayerQuestion,DSceneOcclusion
from .neighborhood_completion_a import (NeighborhoodLayerBindingA,NeighborhoodRecoveryPremiseA,
    measure_neighborhood_scene_a,measure_neighborhood_transport_domain_a,measure_neighborhood_recovery_a)

Point = tuple[int, int]
_CARDINAL = ((-1, 0), (1, 0), (0, -1), (0, 1))


class NeighborhoodOccurrence(FrozenModel):
    occurrence_ref: Ref
    cell: Point


class NeighborhoodState(FrozenModel):
    occurrences: tuple[NeighborhoodOccurrence, ...] = Field(min_length=1, max_length=128)
    active_occurrence_ref: Ref | None
    reserve: int | None = Field(ge=0)
    terminated: bool


class NeighborhoodSite(FrozenModel):
    site_ref: Ref
    origin: Point
    height: int = Field(ge=1, le=256)
    width: int = Field(ge=1, le=256)
    comparison_mask: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    crop_law_ref: Ref
    evidence_ref: Ref


class NeighborhoodModel(FrozenModel):
    model_ref: Ref
    movement_cells: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    neighborhood_offsets: tuple[Point, ...] = Field(min_length=1, max_length=16)
    neighborhood_evidence_ref: Ref
    color_key_law_ref: Ref
    color_map: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=256)
    empty_value: int = Field(ge=0, le=255)
    sites: tuple[NeighborhoodSite, ...] = Field(default=(), max_length=128)
    reference: FrameGrid | None = None
    reference_evidence_ref: Ref | None = None
    motion_law_ref: Ref | None = None
    point_law_ref: Ref | None = None
    empty_point_law_ref: Ref | None = None
    ignored_point_law_ref: Ref | None = None
    cycle_order: tuple[Ref, ...] = Field(default=(), max_length=128)
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=16)
    site_quantifier_ref: Ref | None = None
    terminal_order_ref: Ref | None = None
    reset_state: NeighborhoodState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class NeighborhoodInput(FrozenModel):
    kind_ref: Ref
    cell: Point | None = None
    delta: Point | None = None


class NeighborhoodRequirement(FrozenModel):
    requirement_ref: Ref
    cell: Point
    color: int = Field(ge=0, le=255)
    evidence_ref: Ref


class NeighborhoodLayout(FrozenModel):
    layout_ref: Ref
    occupied_cells: tuple[Point, ...] = Field(min_length=1, max_length=128)


class NeighborhoodSlot(FrozenModel):
    slot_ref: Ref
    cell: Point
    kind_ref: Ref


class NeighborhoodPath(FrozenModel):
    occurrence_ref: Ref
    slot_ref: Ref
    cells: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    evidence_revision_ref: Ref
    shortestness_proof_ref: Ref | None = None


class NeighborhoodBinding(FrozenModel):
    kind_ref: Ref
    cell: Point | None = None
    delta: Point | None = None
    action_ref: Ref
    payload: FrozenMap
    evidence_revision_ref: Ref


_CASES = (
    ('scene_layers', ('MEASURE',)), ('identity_correspondence', ('CORRESPOND',)),
    ('neighborhood_colors', ('EVALUATE',)), ('color_preimages', ('INVERSE_DOMAIN',)),
    ('masked_comparison', ('MATCH',)), ('site_domain', ('DOMAIN',)),
    ('occurrence_assignment', ('DOMAIN',)), ('transport_schedule', ('SEARCH', 'DOMAIN')),
    ('command_protocol', ('COMPILE', 'COMPARE')), ('reasoning_recovery', ('RETAIN', 'PROBE')),
    ('external_primitive', ('STEP',)),
)


class NeighborhoodPatternRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.neighborhood_pattern_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.neighborhood_pattern_construction.{operation}', mode) for operation, modes in _CASES for mode in modes)
    models: tuple[NeighborhoodModel, ...] = Field(default=(), max_length=32)
    state: NeighborhoodState | None = None
    primitive: NeighborhoodInput | None = None
    requirements: tuple[NeighborhoodRequirement, ...] = Field(default=(), max_length=128)
    required_empty_cells: tuple[Point, ...] = Field(default=(), max_length=4096)
    site_ref: Ref | None = None
    layouts: tuple[NeighborhoodLayout, ...] = Field(default=(), max_length=4096)
    slots: tuple[NeighborhoodSlot, ...] = Field(default=(), max_length=128)
    paths: tuple[NeighborhoodPath, ...] = Field(default=(), max_length=4096)
    words: tuple[tuple[NeighborhoodInput, ...], ...] = Field(default=(), max_length=3)
    bindings: tuple[NeighborhoodBinding, ...] = Field(default=(), max_length=4096)
    source_identity_ref: Ref|None=None
    scene_frame: FrameGrid|None=None
    scene_calibrations: tuple[DSceneCalibration,...]=Field(default=(),max_length=32)
    scene_questions: tuple[DSceneLayerQuestion,...]=Field(default=(),max_length=128)
    scene_occlusions: tuple[DSceneOcclusion,...]=Field(default=(),max_length=128)
    scene_bindings: tuple[NeighborhoodLayerBindingA,...]=Field(default=(),max_length=128)
    recovery_premises: tuple[NeighborhoodRecoveryPremiseA,...]=Field(default=(),max_length=128)
    transport_route_request: FrozenMap|None=None


class NeighborhoodPrerequisite(Exception):
    pass


def _occupancy(model, state, budget):
    floor = frozenset(model.movement_cells)
    if len(floor) != len(model.movement_cells) or len(floor) > budget.request.domain_bound:
        raise NeighborhoodPrerequisite('FINITE_MOVEMENT_DOMAIN_NOT_UNIQUE_OR_WITHIN_BOUND')
    refs, cells = {}, {}
    for occurrence in state.occurrences:
        budget.visit({'occurrence_ref': occurrence.occurrence_ref})
        if occurrence.occurrence_ref in refs or occurrence.cell in cells or occurrence.cell not in floor:
            raise NeighborhoodPrerequisite('FULL_CURRENT_OCCUPANCY_OR_IDENTITY_NOT_VALID')
        refs[occurrence.occurrence_ref], cells[occurrence.cell] = occurrence, occurrence.occurrence_ref
    if state.active_occurrence_ref is not None and state.active_occurrence_ref not in refs:
        raise NeighborhoodPrerequisite('ACTIVE_IDENTITY_NOT_IN_CURRENT_POPULATION')
    return refs, cells, floor


def _colors(model, occupied, budget):
    if len(set(model.neighborhood_offsets)) != len(model.neighborhood_offsets) or (0, 0) in model.neighborhood_offsets:
        raise NeighborhoodPrerequisite('LOCAL_NEIGHBORHOOD_OFFSETS_NOT_DISTINCT_NONZERO')
    mapping = dict(model.color_map)
    if len(mapping) != len(model.color_map) or any(not 0 <= mapping[key] <= 255 for key in sorted(mapping)):
        raise NeighborhoodPrerequisite('COLOR_RELATION_NOT_FUNCTIONAL')
    if model.color_key_law_ref not in ('neighbor_degree', 'ordered_direction_mask'):
        raise NeighborhoodPrerequisite('SUPPORTED_LOCAL_COLOR_KEY_MISSING')
    rows = []
    for cell in sorted(occupied):
        neighbors, bits = [], 0
        for index, delta in enumerate(model.neighborhood_offsets):
            budget.visit({'physical_cell': cell, 'neighbor_index': index})
            neighbor = cell[0] + delta[0], cell[1] + delta[1]
            if neighbor in occupied:
                neighbors.append(neighbor)
                bits |= 1 << index
        key = len(neighbors) if model.color_key_law_ref == 'neighbor_degree' else bits
        if key not in mapping:
            raise NeighborhoodPrerequisite('CURRENT_NEIGHBOR_CONFIGURATION_COLOR_UNKNOWN')
        rows.append(d_map({'cell': cell, 'color': mapping[key], 'neighbor_cells': tuple(neighbors),
            'color_key': key, 'rule_evidence_ref': model.neighborhood_evidence_ref}))
    return tuple(rows)


def _outer_crop(rows, empty):
    nonempty = tuple((row, column) for row, line in enumerate(rows) for column, value in enumerate(line) if value != empty)
    if not nonempty:
        return (), (0, 0)
    top, bottom = min(row for row, _ in nonempty), max(row for row, _ in nonempty)
    left, right = min(column for _, column in nonempty), max(column for _, column in nonempty)
    return tuple(tuple(row[left:right + 1]) for row in rows[top:bottom + 1]), (top, left)


def _compare_site(model, occupied, colors, site, budget):
    if model.reference is None or model.reference_evidence_ref is None:
        raise NeighborhoodPrerequisite('MEASURED_REFERENCE_AND_PROVENANCE_MISSING')
    if site.height * site.width > budget.request.domain_bound:
        raise DComputationInterrupted('COMPARISON_RASTER_DOMAIN_BOUND', d_map({'site_ref': site.site_ref}))
    mask = set(site.comparison_mask)
    if len(mask) != len(site.comparison_mask) or any(not 0 <= row < site.height or not 0 <= column < site.width for row, column in mask):
        raise NeighborhoodPrerequisite('COMPARISON_MASK_NOT_VALID_WITH_INTERNAL_HOLES')
    values = {tuple(row['cell']): row['color'] for row in colors}
    projection = []
    masked_providers = []
    for row in range(site.height):
        line = []
        for column in range(site.width):
            budget.visit({'site_ref': site.site_ref, 'projection_cell': (row, column)})
            cell = site.origin[0] + row, site.origin[1] + column
            if (row, column) in mask:
                line.append(values.get(cell, model.empty_value))
            else:
                line.append(model.empty_value)
                if cell in occupied:
                    masked_providers.append(cell)
        projection.append(tuple(line))
    rows, offset = tuple(projection), (0, 0)
    if site.crop_law_ref == 'trim_outer_empty_margins':
        rows, offset = _outer_crop(rows, model.empty_value)
    elif site.crop_law_ref != 'fixed_full_window':
        raise NeighborhoodPrerequisite('SUPPORTED_FIXED_OR_OUTER_CROP_MODEL_MISSING')
    expected = model.reference.rows
    shape_matches = len(rows) == len(expected) and (not rows or len(rows[0]) == len(expected[0]))
    mismatches = []
    if shape_matches:
        for row, line in enumerate(rows):
            for column, value in enumerate(line):
                budget.visit()
                if value != expected[row][column]:
                    mismatches.append((row, column, value, expected[row][column]))
    return {'site_ref': site.site_ref, 'compared_raster': rows, 'outer_crop_offset': offset,
        'shape_matches': shape_matches, 'mismatch_coordinates': tuple(mismatches),
        'exact_match': shape_matches and not mismatches, 'masked_out_physical_providers': tuple(masked_providers),
        'internal_holes_rows_columns_preserved': True}


def _comparisons(model, occupied, budget):
    if not model.sites or len(set(site.site_ref for site in model.sites)) != len(model.sites):
        raise NeighborhoodPrerequisite('PERMITTED_COMPARISON_SITES_NOT_BOUND_UNIQUELY')
    colors = _colors(model, occupied, budget)
    return colors, tuple(d_map(_compare_site(model, occupied, colors, site, budget)) for site in model.sites)


def _physical(model, state, primitive, budget):
    refs, occupied, floor = _occupancy(model, state, budget)
    if state.terminated:
        raise NeighborhoodPrerequisite('OFFICIAL_TERMINATION_REVOKES_PATTERN_INPUT')
    moved = None
    if primitive.kind_ref == 'point':
        if model.point_law_ref != 'point_binds_current_occupied_identity' or primitive.cell is None:
            raise NeighborhoodPrerequisite('CURRENT_POINT_SELECTION_MODEL_MISSING')
        if primitive.cell not in floor:
            if model.ignored_point_law_ref != 'outside_domain_point_has_no_transaction':
                raise NeighborhoodPrerequisite('OUT_OF_DOMAIN_POINT_EFFECT_MISSING')
            return {'state': state, 'changed_identity_ref': None, 'ignored_out_of_domain_point': True}
        active = occupied.get(primitive.cell)
        if active is None:
            if model.empty_point_law_ref == 'empty_cell_deselects':
                pass
            elif model.empty_point_law_ref == 'empty_cell_ignored':
                active = state.active_occurrence_ref
            else:
                raise NeighborhoodPrerequisite('EMPTY_CELL_SELECTION_EFFECT_MISSING')
        following = state.model_copy(update={'active_occurrence_ref': active})
    elif primitive.kind_ref == 'cycle':
        if len(set(model.cycle_order)) != len(model.cycle_order) or set(model.cycle_order) != set(refs):
            raise NeighborhoodPrerequisite('COMPLETE_CURRENT_SELECTION_CYCLE_MISSING')
        if state.active_occurrence_ref is None:
            active = model.cycle_order[0]
        else:
            active = model.cycle_order[(model.cycle_order.index(state.active_occurrence_ref) + 1) % len(model.cycle_order)]
        following = state.model_copy(update={'active_occurrence_ref': active})
    elif primitive.kind_ref == 'move':
        if model.motion_law_ref != 'collision_checked_cardinal_step' or primitive.delta not in _CARDINAL:
            raise NeighborhoodPrerequisite('SUPPORTED_CARDINAL_SINGLE_BODY_MOTION_MISSING')
        if state.active_occurrence_ref is None:
            raise NeighborhoodPrerequisite('CURRENT_ACTIVE_IDENTITY_MISSING')
        occurrence = refs[state.active_occurrence_ref]
        destination = occurrence.cell[0] + primitive.delta[0], occurrence.cell[1] + primitive.delta[1]
        if destination not in floor or destination in occupied:
            following = state
        else:
            moved = occurrence.occurrence_ref
            following = state.model_copy(update={'occurrences': tuple(item.model_copy(update={'cell': destination})
                if item.occurrence_ref == moved else item for item in state.occurrences)})
    else:
        raise NeighborhoodPrerequisite('PATTERN_EXTERNAL_INPUT_KIND_UNSUPPORTED')
    return {'state': following, 'changed_identity_ref': moved, 'ignored_out_of_domain_point': False}


def _external(model, state, primitive, request, budget):
    if primitive.kind_ref == 'reset':
        if model.reset_state is None or model.reset_cost is None:
            raise NeighborhoodPrerequisite('INDEPENDENT_PATTERN_RESET_CONTRACT_MISSING')
        _occupancy(model, model.reset_state, budget)
        return {'before_state': state, 'state': model.reset_state,
            'phase_snapshots': d_map({'before': state, 'after_reset': model.reset_state}),
            'event_ledger': d_map({'owner_ref': request.scope.event_owner_ref,
            'direct_kind': 'reset', 'debit': model.reset_cost, 'automatic_pass_count': 0,
            'reset_owned_complete': True}), 'primitive_complete': True}
    image = _physical(model, state, primitive, budget)
    following = image['state']
    if image['ignored_out_of_domain_point']:
        return {'before_state': state, 'state': state,
            'phase_snapshots': d_map({'before': state, 'after_ignored_point': state}),
            'closure_facts': d_map({'point_outside_bound_domain': True, 'ignored_without_transaction': True}),
            'event_ledger': d_map({'owner_ref': request.scope.event_owner_ref, 'direct_kind': primitive.kind_ref,
                'automatic_pass_count': 0, 'debit': 0, 'acceptance_checked': False}), 'primitive_complete': True}
    _, before_occupied, _ = _occupancy(model, state, budget)
    before_colors = _colors(model, before_occupied, budget)
    _, occupied, _ = _occupancy(model, following, budget)
    colors, comparisons = _comparisons(model, occupied, budget)
    if model.site_quantifier_ref != 'any_permitted_site_match':
        raise NeighborhoodPrerequisite('SUPPORTED_PERMITTED_SITE_DISJUNCTION_MISSING')
    if model.terminal_order_ref not in ('acceptance_before_exhaustion', 'exhaustion_before_acceptance'):
        raise NeighborhoodPrerequisite('PATTERN_TERMINAL_BUDGET_PRIORITY_MISSING')
    costs = tuple(cost for kind, cost in model.input_costs if kind == primitive.kind_ref)
    if state.reserve is None or len(costs) != 1 or costs[0] < 0 or costs[0] > state.reserve:
        raise NeighborhoodPrerequisite('EXACT_PATTERN_INPUT_COST_OR_RESERVE_MISSING')
    reserve = state.reserve - costs[0]
    accepted = any(row['exact_match'] for row in comparisons)
    exhausted = reserve == 0
    if exhausted and model.terminal_order_ref == 'exhaustion_before_acceptance':
        accepted = False
    after_direct = following
    following = following.model_copy(update={'reserve': reserve, 'terminated': accepted or exhausted})
    before_values = {tuple(row['cell']): row['color'] for row in before_colors}
    color_deltas = tuple((tuple(row['cell']), before_values.get(tuple(row['cell'])), row['color'])
        for row in colors if before_values.get(tuple(row['cell'])) != row['color'])
    return {'before_state': state, 'state': following, 'colors': colors, 'site_comparisons': comparisons,
        'phase_snapshots': d_map({'before': state, 'after_direct': after_direct,
            'after_recolor': d_map({'state': after_direct, 'colors': colors}), 'after_acceptance_and_cost': following}),
        'closure_facts': d_map({'direct_complete': True, 'full_neighborhood_recolor_complete': True,
            'site_comparison_complete': True, 'cost_complete': True, 'acceptance_complete': True}),
        'direct_event': d_map({'owner_ref': request.scope.event_owner_ref, 'kind_ref': primitive.kind_ref,
            'moved_occurrence_ref': image['changed_identity_ref'],
            'active_before_ref': state.active_occurrence_ref, 'active_after_ref': following.active_occurrence_ref}),
        'automatic_color_deltas': color_deltas,
        'changed_identity_ref': image['changed_identity_ref'],
        'event_ledger': d_map({'owner_ref': request.scope.event_owner_ref, 'direct_kind': primitive.kind_ref,
            'automatic_pass_count': 1, 'debit': costs[0], 'accepted': accepted, 'exhausted': exhausted,
            'ignored_out_of_domain_point': image['ignored_out_of_domain_point']}),
        'primitive_complete': True, 'second_recolor_or_debit_forbidden': True}


def _color_preimages(model, request, budget):
    if request.state is None or not request.requirements:
        raise NeighborhoodPrerequisite('CURRENT_INVENTORY_AND_REQUIRED_COLORS_MISSING')
    _, occupied, floor = _occupancy(model, request.state, budget)
    count = len(occupied)
    offsets = model.neighborhood_offsets
    if len(set(offsets)) != len(offsets) or (0, 0) in offsets:
        raise NeighborhoodPrerequisite('PREIMAGE_NEIGHBOR_DOMAIN_NOT_DISTINCT_NONZERO')
    if (1 << len(offsets)) > request.domain_bound:
        raise DComputationInterrupted('NEIGHBOR_BIT_PATTERN_DOMAIN_BOUND', d_map({'offset_count': len(offsets)}))
    mapping = dict(model.color_map)
    if len(mapping) != len(model.color_map) or model.color_key_law_ref not in ('neighbor_degree', 'ordered_direction_mask'):
        raise NeighborhoodPrerequisite('PREIMAGE_LOCAL_COLOR_LAW_MISSING')
    domains = []
    for requirement in request.requirements:
        if requirement.cell not in floor:
            raise NeighborhoodPrerequisite('REQUIRED_COLOR_CELL_OUTSIDE_SUPPORTED_FLOOR')
        options = []
        if requirement.color == model.empty_value:
            options.append((frozenset(), frozenset((requirement.cell,))))
        for bits in range(1 << len(offsets)):
            budget.visit({'requirement_ref': requirement.requirement_ref, 'neighbor_bits': bits})
            key = bits.bit_count() if model.color_key_law_ref == 'neighbor_degree' else bits
            if key not in mapping:
                raise NeighborhoodPrerequisite('PREIMAGE_COLOR_DOMAIN_HAS_UNDEFINED_CASES')
            if mapping[key] != requirement.color:
                continue
            required, excluded = {requirement.cell}, set()
            for index, delta in enumerate(offsets):
                neighbor = requirement.cell[0] + delta[0], requirement.cell[1] + delta[1]
                if bits & (1 << index):
                    required.add(neighbor)
                else:
                    excluded.add(neighbor)
            if required <= floor:
                options.append((frozenset(required), frozenset(excluded & floor)))
        domains.append(tuple(options))
    results = []
    for options in product(*domains):
        budget.visit({'joint_constraint_index': len(results)})
        required = frozenset(point for points, _ in options for point in points)
        excluded = frozenset((*request.required_empty_cells, *(point for _, points in options for point in points)))
        if required & excluded or len(required) > count:
            continue
        parking = floor - required - excluded
        if len(parking) < count - len(required):
            continue
        if len(results) >= request.domain_bound:
            raise DComputationInterrupted('JOINT_OCCUPANCY_CONSTRAINT_DOMAIN_BOUND', d_map({'returned_count': len(results)}))
        results.append(d_map({'required_occupied_cells': tuple(sorted(required)),
            'excluded_occupied_cells': tuple(sorted(excluded)), 'parking_domain': tuple(sorted(parking)),
            'additional_inventory': count - len(required), 'unique_required_provider_count': len(required),
            'shared_providers_counted_once': True}))
    return {'occupancy_constraint_domains': tuple(results), 'inventory_count': count,
        'domains_do_not_assert_a_transport_route': True}


def _sites(model, request, budget):
    if request.state is None or not request.layouts:
        raise NeighborhoodPrerequisite('FULL_INVENTORY_AND_SOURCE_LAYOUT_DOMAIN_MISSING')
    _, current, floor = _occupancy(model, request.state, budget)
    if len(request.layouts) > request.domain_bound or len(set(layout.layout_ref for layout in request.layouts)) != len(request.layouts):
        raise NeighborhoodPrerequisite('SITE_LAYOUT_DOMAIN_NOT_UNIQUE_AND_BOUNDED')
    rows = []
    for layout in request.layouts:
        budget.visit({'layout_ref': layout.layout_ref})
        cells = frozenset(layout.occupied_cells)
        if len(cells) != len(layout.occupied_cells) or len(cells) != len(current) or not cells <= floor:
            rows.append(d_map({'layout_ref': layout.layout_ref, 'inventory_and_cells_admissible': False,
                'matching_site_refs': ()}))
            continue
        _, comparisons = _comparisons(model, cells, budget)
        rows.append(d_map({'layout_ref': layout.layout_ref, 'inventory_and_cells_admissible': True,
            'comparisons': comparisons, 'matching_site_refs': tuple(row['site_ref'] for row in comparisons if row['exact_match'])}))
    return {'site_layout_results': tuple(rows), 'examined_source_layout_domain': True,
        'fixed_and_crop_models_not_chosen_by_witness_success': True}


def _assignments(model, request, budget):
    if request.state is None or len(request.slots) != len(request.state.occurrences):
        raise NeighborhoodPrerequisite('FULL_POPULATION_AND_EQUAL_SLOT_DOMAIN_MISSING')
    refs, occupied, floor = _occupancy(model, request.state, budget)
    if len(set(slot.slot_ref for slot in request.slots)) != len(request.slots) or len(set(slot.cell for slot in request.slots)) != len(request.slots):
        raise NeighborhoodPrerequisite('DESIRED_SLOTS_NOT_UNIQUE')
    if any(slot.cell not in floor for slot in request.slots):
        raise NeighborhoodPrerequisite('DESIRED_SLOT_OUTSIDE_MOVEMENT_DOMAIN')
    pair_rows = {}
    for ref in sorted(refs):
        for slot in request.slots:
            budget.visit({'occurrence_ref': ref, 'slot_ref': slot.slot_ref})
            records = tuple(path for path in request.paths if path.occurrence_ref == ref and path.slot_ref == slot.slot_ref)
            if len(records) > 1:
                raise NeighborhoodPrerequisite('CURRENT_REACHABILITY_RECORD_NOT_UNIQUE')
            valid, distance, proof = None, None, None
            if records:
                path = records[0]
                if path.evidence_revision_ref != request.scope.evidence_revision_ref:
                    raise NeighborhoodPrerequisite('REACHABILITY_RECORD_REVISION_STALE')
                valid = path.cells[0] == refs[ref].cell and path.cells[-1] == slot.cell
                for index, point in enumerate(path.cells):
                    budget.visit()
                    if point not in floor or point in occupied and occupied[point] != ref:
                        valid = False
                    if index and (point[0] - path.cells[index - 1][0], point[1] - path.cells[index - 1][1]) not in _CARDINAL:
                        valid = False
                distance = len(path.cells) - 1 if valid else None
                proof = path.shortestness_proof_ref if valid else None
            pair_rows[ref, slot.slot_ref] = d_map({'occurrence_ref': ref, 'slot_ref': slot.slot_ref,
                'slot_kind_ref': slot.kind_ref, 'current_path_valid': valid, 'path_move_cost': distance,
                'shortestness_proof_ref': proof,
                'geometric_move_lower_bound': abs(refs[ref].cell[0] - slot.cell[0]) + abs(refs[ref].cell[1] - slot.cell[1])})
    population = tuple(sorted(refs))
    results = []
    def visit(index, used, rows):
        budget.visit({'assignment_depth': index})
        if index == len(population):
            if len(results) >= request.domain_bound:
                raise DComputationInterrupted('INJECTIVE_ASSIGNMENT_DOMAIN_BOUND', d_map({'returned_count': len(results)}))
            results.append(d_map({'pairs': rows,
                'move_lower_bound': sum(row['geometric_move_lower_bound'] for row in rows),
                'all_current_paths_verified': all(row['current_path_valid'] is True for row in rows),
                'assignment_is_not_a_schedule': True}))
            return
        for slot in request.slots:
            if slot.slot_ref not in used:
                visit(index + 1, used | {slot.slot_ref}, (*rows, pair_rows[population[index], slot.slot_ref]))
    if len(population) > request.depth_bound:
        raise DComputationInterrupted('ASSIGNMENT_DEPTH_BOUND', d_map({'population_count': len(population)}))
    visit(0, set(), ())
    return {'injective_full_population_assignments': tuple(results),
        'unprovided_current_paths_remain_unknown': True, 'independent_paths_not_global_optimality': True}


def _protocol(model, request, budget):
    if request.state is None:
        raise NeighborhoodPrerequisite('CURRENT_COMMAND_CONTEXT_MISSING')
    if request.mode_ref == 'COMPARE':
        if not request.observations:
            raise NeighborhoodPrerequisite('SEALED_PATTERN_REPLY_MISSING')
        rows, first = [], None
        for index, sample in enumerate(request.observations):
            budget.visit()
            if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
                raise NeighborhoodPrerequisite('PATTERN_REPLY_NOT_SEALED_FOR_BOUND_OWNER')
            if sample.get('scene_replaced') is True:
                rows.append(d_map({'sample_index': index, 'scene_replaced': True,
                    'old_bindings_invalidated': True, 'new_scene_identity_not_inferred': True}))
                continue
            actual = NeighborhoodState.model_validate(sample['actual_state'])
            expected = NeighborhoodState.model_validate(sample['expected_state'])
            _, cells, _ = _occupancy(model, actual, budget)
            actual_map = {item.occurrence_ref: item.cell for item in actual.occurrences}
            expected_map = {item.occurrence_ref: item.cell for item in expected.occurrences}
            colors = _colors(model, cells, budget)
            if sample.get('observed_cell_colors') is None:
                raise NeighborhoodPrerequisite('OBSERVED_RECOLOR_EVIDENCE_MISSING')
            observed_values = {tuple(cell): value for cell, value in sample['observed_cell_colors']}
            if len(observed_values) != len(sample['observed_cell_colors']):
                raise NeighborhoodPrerequisite('OBSERVED_COLOR_CELLS_NOT_UNIQUE')
            expected_values = {tuple(row['cell']): row['color'] for row in colors}
            color_mismatches = tuple(cell for cell in sorted(set(expected_values) | set(observed_values))
                if expected_values.get(cell) != observed_values.get(cell))
            fields = tuple(name for name in ('active_occurrence_ref', 'reserve', 'terminated')
                if getattr(actual, name) != getattr(expected, name))
            differing = tuple(ref for ref in sorted(set(actual_map) | set(expected_map)) if actual_map.get(ref) != expected_map.get(ref))
            if first is None and (fields or differing or color_mismatches):
                first = index
            rows.append(d_map({'sample_index': index, 'position_difference_refs': differing,
                'control_difference_fields': fields, 'derived_colors': colors,
                'observed_color_mismatch_cells': color_mismatches,
                'repeated_frame_is_not_an_input': True}))
        return {'sealed_comparisons': tuple(rows), 'first_divergence_index': first}
    if not request.words:
        raise NeighborhoodPrerequisite('SOURCE_REQUESTED_COMMITTED_WORDS_MISSING')
    results = []
    for word in request.words:
        if len(word) > request.depth_bound:
            raise DComputationInterrupted('PATTERN_WORD_PRIMITIVE_BOUND', d_map())
        current, inputs, effects = request.state, [], []
        for primitive in word:
            matches = tuple(binding for binding in request.bindings if binding.kind_ref == primitive.kind_ref
                and binding.cell == primitive.cell and binding.delta == primitive.delta
                and binding.evidence_revision_ref == request.scope.evidence_revision_ref)
            if len(matches) != 1:
                raise NeighborhoodPrerequisite('CURRENT_NATIVE_PATTERN_COMMAND_NOT_UNIQUE')
            image = _external(model, current, primitive, request, budget)
            current = image['state']
            inputs.append(d_map({'action_ref': matches[0].action_ref, 'payload': matches[0].payload}))
            effects.append(d_map(image))
            if current.terminated:
                break
        results.append(d_map({'native_word': tuple(inputs), 'sealed_effects': tuple(effects),
            'state': current, 'terminal_prefix': current.terminated,
            'no_intermediate_reconciliation': True, 'primitive_release_authorized': False}))
    return {'compiled_words': tuple(results)}


def _identity(model, request, budget):
    if not request.observations:
        raise NeighborhoodPrerequisite('SEALED_IDENTITY_TRANSITIONS_MISSING')
    rows = []
    for index, sample in enumerate(request.observations):
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise NeighborhoodPrerequisite('IDENTITY_PACKET_OWNER_OR_SEAL_MISMATCH')
        if sample.get('before_state') is None or sample.get('primitive') is None or sample.get('after_occupied_cells') is None:
            raise NeighborhoodPrerequisite('BEFORE_INPUT_AFTER_OCCUPANCY_EVIDENCE_MISSING')
        before = NeighborhoodState.model_validate(sample['before_state'])
        primitive = NeighborhoodInput.model_validate(sample['primitive'])
        predicted = _physical(model, before, primitive, budget)
        after = predicted['state']
        _, occupied, _ = _occupancy(model, after, budget)
        observed = tuple(tuple(point) for point in sample['after_occupied_cells'])
        if len(set(observed)) != len(observed):
            raise NeighborhoodPrerequisite('OBSERVED_AFTER_OCCUPANCY_NOT_UNIQUE')
        expected_cells = frozenset(occupied)
        colors = _colors(model, expected_cells, budget)
        if sample.get('after_cell_colors') is None:
            raise NeighborhoodPrerequisite('OBSERVED_APPEARANCE_CHANGE_EVIDENCE_MISSING')
        observed_colors = {tuple(cell): value for cell, value in sample['after_cell_colors']}
        if len(observed_colors) != len(sample['after_cell_colors']):
            raise NeighborhoodPrerequisite('OBSERVED_APPEARANCE_CELLS_NOT_UNIQUE')
        expected_colors = {tuple(row['cell']): row['color'] for row in colors}
        before_map = {item.occurrence_ref: item.cell for item in before.occurrences}
        rows.append(d_map({'sample_index': index, 'full_occupancy_matches': set(observed) == expected_cells,
            'persistent_identity_map': tuple((item.occurrence_ref, before_map[item.occurrence_ref], item.cell) for item in after.occurrences),
            'moved_occurrence_ref': predicted['changed_identity_ref'],
            'local_color_dependencies': colors, 'palette_assignment_is_not_an_identity_map': True}))
        rows[-1] = FrozenMap.overlay(rows[-1], {'color_effects_match_observation': observed_colors == expected_colors})
    return {'identity_transition_constraints': tuple(rows)}


def measure_neighborhood_pattern_construction(request: NeighborhoodPatternRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget = DWorkBudget(request)
    operation = request.operation_ref.rsplit('.', 1)[-1]
    rows, current_model_ref = [], None
    try:
        if operation in ('scene_layers', 'transport_schedule', 'reasoning_recovery') and request.source_identity_ref is None:
            raise NeighborhoodPrerequisite('CURRENT_SOURCE_IDENTITY_MISSING')
        if operation=='transport_schedule' and request.mode_ref=='SEARCH':
            raise NeighborhoodPrerequisite('SOURCE_OWNED_K09_ROUTE_CALL_REQUIRED')
        if not request.models:
            raise NeighborhoodPrerequisite('SCOPED_NEIGHBORHOOD_AND_COMPARISON_MODELS_MISSING')
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            if operation == 'scene_layers':
                row = measure_neighborhood_scene_a(model,request,budget)
            elif operation == 'transport_schedule':
                row = measure_neighborhood_transport_domain_a(model,request,budget)
            elif operation == 'reasoning_recovery':
                row = measure_neighborhood_recovery_a(model,request,budget)
            elif operation == 'identity_correspondence':
                row = _identity(model, request, budget)
            elif operation == 'color_preimages':
                row = _color_preimages(model, request, budget)
            elif operation == 'site_domain':
                row = _sites(model, request, budget)
            elif operation == 'occurrence_assignment':
                row = _assignments(model, request, budget)
            elif operation == 'command_protocol':
                row = _protocol(model, request, budget)
            else:
                if request.state is None:
                    raise NeighborhoodPrerequisite('CURRENT_PHYSICAL_OCCUPANCY_MISSING')
                _, occupied, _ = _occupancy(model, request.state, budget)
                if operation == 'neighborhood_colors':
                    row = {'full_physical_colors': _colors(model, occupied, budget)}
                elif operation == 'masked_comparison':
                    colors, comparisons = _comparisons(model, occupied, budget)
                    row = {'colors_before_any_mask': colors, 'site_comparisons': comparisons}
                elif operation == 'external_primitive':
                    if request.primitive is None:
                        raise NeighborhoodPrerequisite('SOURCE_BOUND_PATTERN_PRIMITIVE_MISSING')
                    row = _external(model, request.state, request.primitive, request, budget)
                else:
                    return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'COMPLETE', 'REQUESTED_FINITE_CALCULATION_RETURNED',
            values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except NeighborhoodPrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DComputationInterrupted as error:
        return d_result(request, 'NEEDS_EVIDENCE', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
