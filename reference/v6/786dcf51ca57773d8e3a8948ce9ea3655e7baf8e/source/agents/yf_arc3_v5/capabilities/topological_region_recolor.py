"""Bounded supported topology, current-color floods and overwrite protocols.

Persistent supports and class alternatives are supplied evidence, never creator
region ids or palette roles. SRC/DRM supplies rules and the actual paint word.
"""

from __future__ import annotations

from collections import deque
from typing import ClassVar, Literal
from pydantic import Field

from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .digital_topology import _neighbors
from .indexed_panel_measurement_d import DPanelLayout, measure_panel_regions_d
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows,
    d_resumable_frontier, d_map,
)

Point = tuple[int, int]


class RecolorRegion(FrozenModel):
    region_ref: Ref
    support: tuple[Point, ...] = Field(min_length=1, max_length=65536)
    evidence_ref: Ref
    clipped: bool
    boundary_complete: bool
    predecessor_refs: tuple[Ref, ...] = Field(default=(), max_length=128)


class RecolorTopologyRule(FrozenModel):
    rule_ref: Ref
    evidence_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    pocket_count: int = Field(ge=0, le=4096)
    shell_value: int = Field(ge=0, le=255)
    pocket_value: int | None = Field(default=None, ge=0, le=255)


class RecolorLegendSample(FrozenModel):
    sample_ref: Ref
    body: RecolorRegion
    raster: FrameGrid
    evidence_revision_ref: Ref


class RecolorState(FrozenModel):
    field: FrameGrid
    active_pigment: int | None = Field(default=None, ge=0, le=255)
    reserve: int = Field(ge=0)
    terminated: bool = False
    accepted: bool = False


class RecolorModel(FrozenModel):
    model_ref: Ref
    connectivity: Literal[4, 8]
    pocket_connectivity: Literal[4, 8]
    editable_mask: tuple[Point, ...] = Field(min_length=1, max_length=65536)
    regions: tuple[RecolorRegion, ...] = Field(default=(), max_length=4096)
    class_masks: tuple[tuple[Ref, tuple[Point, ...]], ...] = Field(default=(), max_length=4096)
    class_evidence_refs: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=4096)
    write_scope_law_ref: Ref | None = None
    rules: tuple[RecolorTopologyRule, ...] = Field(default=(), max_length=256)
    background_requirement: int | None = Field(default=None, ge=0, le=255)
    palette_values: tuple[int, ...] = Field(default=(), max_length=256)
    selection_cost: int | None = Field(default=None, ge=0)
    paint_cost: int | None = Field(default=None, ge=0)
    hold_law_ref: Ref | None = None
    hold_cost: int | None = Field(default=None, ge=0)
    terminal_order_ref: Ref | None = None
    acceptance_event_law_ref: Ref | None = None
    reset_state: RecolorState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class RecolorInput(FrozenModel):
    kind_ref: Ref
    pigment: int | None = Field(default=None, ge=0, le=255)
    seed: Point | None = None
    required_write_mask: tuple[Point, ...] | None = Field(default=None, max_length=65536)
    preserve_mask: tuple[Point, ...] = Field(default=(), max_length=65536)


class RecolorBinding(FrozenModel):
    kind_ref: Ref
    pigment: int | None = Field(default=None, ge=0, le=255)
    seed: Point | None = None
    action_ref: Ref
    payload: FrozenMap
    evidence_revision_ref: Ref


class RecolorWord(FrozenModel):
    word_ref: Ref
    comparison_kind_ref: Ref
    paints: tuple[RecolorInput, ...] = Field(min_length=1, max_length=4096)
    require_target_at_end: bool


class RecolorClassCandidate(FrozenModel):
    class_ref: Ref
    evidence_ref: Ref
    local_mask: tuple[Point, ...] = Field(min_length=1, max_length=4096)


class RecolorPigmentWell(FrozenModel):
    region_ref: Ref
    pigment: int = Field(ge=0, le=255)
    sample_positions: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    evidence_ref: Ref


class RecolorPanelPartition(FrozenModel):
    partition_ref: Ref
    panels: DPanelLayout
    field_region_ref: Ref
    legend_region_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    pigment_wells: tuple[RecolorPigmentWell, ...] = Field(min_length=1, max_length=128)
    selection_decoration_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    hud_region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    editable_local_mask: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    class_candidates: tuple[RecolorClassCandidate, ...] = Field(default=(), max_length=256)


_CASES = (
    ('field_control_partition', 'MEASURE'), ('persistent_region_inventory', 'MEASURE'),
    ('enclosed_pockets', 'MEASURE'), ('legend_rule_fit', 'FIT'),
    ('target_surface_derive', 'DOMAIN'), ('repaint_scope_fit', 'FIT'),
    ('component_recolor_step', 'STEP'), ('palette_plan', 'COMPILE'),
    ('current_state_repair', 'DOMAIN'), ('painting_compare', 'COMPARE'),
    ('external_primitive', 'STEP'),
)


class TopologicalRecolorRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.topological_recolor_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.topological_region_recolor.{operation}', mode) for operation, mode in _CASES)
    models: tuple[RecolorModel, ...] = Field(default=(), max_length=32)
    state: RecolorState | None = None
    primitive: RecolorInput | None = None
    legend_samples: tuple[RecolorLegendSample, ...] = Field(default=(), max_length=256)
    target_surface: FrameGrid | None = None
    target_evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    words: tuple[RecolorWord, ...] = Field(default=(), max_length=3)
    bindings: tuple[RecolorBinding, ...] = Field(default=(), max_length=4096)
    observed_frame: FrameGrid | None = None
    frame_ref: Ref | None = None
    frame_epoch: int | None = Field(default=None, ge=0)
    frame_evidence_revision_ref: Ref | None = None
    observed_scene_ref: Ref | None = None
    panel_partitions: tuple[RecolorPanelPartition, ...] = Field(default=(), max_length=32)


class RecolorPrerequisite(Exception):
    pass


def _mask(points, *, height, width, budget, label):
    if len(points) > budget.request.domain_bound:
        raise DComputationInterrupted('RECOLOR_SUPPORT_DOMAIN_BOUND', d_map({'support_ref': label}))
    result = set()
    for point in points:
        budget.visit({'support_ref': label, 'point': point})
        row, column = point
        if not 0 <= row < height or not 0 <= column < width or point in result:
            raise RecolorPrerequisite('SUPPORT_REPEATED_OR_OUTSIDE_BOUND_FIELD')
        result.add(point)
    return result


def _components(points, connectivity, budget):
    """Use the established digital adjacency with interruptible flood work."""
    remaining, components = set(points), []
    while remaining:
        start = min(remaining)
        queue, component = deque((start,)), {start}
        remaining.remove(start)
        while queue:
            point = queue.popleft()
            budget.visit({'flood_point': point})
            for adjacent in _neighbors(point, connectivity):
                if adjacent in remaining:
                    remaining.remove(adjacent)
                    component.add(adjacent)
                    queue.append(adjacent)
        components.append(frozenset(component))
    return tuple(components)


def _field_masks(model, state, budget):
    if state.field.height * state.field.width > budget.request.domain_bound:
        raise DComputationInterrupted('RECOLOR_FIELD_PIXEL_DOMAIN_BOUND', d_map())
    return _mask(model.editable_mask, height=state.field.height, width=state.field.width,
                 budget=budget, label='editable_mask')


def _color_components(field, editable, connectivity, budget):
    colors = {}
    for row, column in sorted(editable):
        budget.visit()
        colors.setdefault(field.rows[row][column], set()).add((row, column))
    return tuple((color, component) for color in sorted(colors)
                 for component in _components(colors[color], connectivity, budget))


def _pockets(region, connectivity, budget):
    if region.clipped or not region.boundary_complete:
        raise RecolorPrerequisite('REGION_CLIPPED_OR_BOUNDARY_NOT_COMPLETE')
    support = set(region.support)
    if len(support) != len(region.support):
        raise RecolorPrerequisite('STRUCTURAL_SUPPORT_NOT_UNIQUE')
    rows, columns = zip(*support)
    top, bottom = min(rows) - 1, max(rows) + 1
    left, right = min(columns) - 1, max(columns) + 1
    if (bottom - top + 1) * (right - left + 1) > budget.request.domain_bound:
        raise DComputationInterrupted('EXPANDED_COMPLEMENT_DOMAIN_BOUND', d_map({'region_ref': region.region_ref}))
    complement = set()
    for row in range(top, bottom + 1):
        for column in range(left, right + 1):
            budget.visit({'region_ref': region.region_ref})
            if (row, column) not in support:
                complement.add((row, column))
    exterior, pockets = [], []
    for component in _components(complement, connectivity, budget):
        boundary = any(row in (top, bottom) or column in (left, right) for row, column in component)
        (exterior if boundary else pockets).append(tuple(sorted(component)))
    return {'region_ref': region.region_ref, 'evidence_ref': region.evidence_ref,
        'connectivity': connectivity, 'pocket_masks': tuple(pockets),
        'pocket_areas': tuple(len(pocket) for pocket in pockets), 'pocket_count': len(pockets),
        'exterior_component_count': len(exterior)}


def _inventory(model, state, budget):
    editable = _field_masks(model, state, budget)
    if len(set(region.region_ref for region in model.regions)) != len(model.regions):
        raise RecolorPrerequisite('PERSISTENT_REGION_IDENTITIES_NOT_UNIQUE')
    components = _color_components(state.field, editable, model.connectivity, budget)
    entries = []
    for region in model.regions:
        support = _mask(region.support, height=state.field.height, width=state.field.width,
                        budget=budget, label=region.region_ref)
        if not support <= editable:
            raise RecolorPrerequisite('STRUCTURAL_SUPPORT_OUTSIDE_EDITABLE_FIELD')
        entries.append(d_map({'region_ref': region.region_ref, 'support': tuple(sorted(support)),
            'evidence_ref': region.evidence_ref, 'predecessor_refs': region.predecessor_refs,
            'clipped': region.clipped, 'boundary_complete': region.boundary_complete,
            'current_component_overlaps': tuple((color, tuple(sorted(support & component)))
                for color, component in components if support & component)}))
    return {'persistent_regions': tuple(entries), 'current_monochrome_components': tuple(
        d_map({'color': color, 'support': tuple(sorted(component))}) for color, component in components),
        'visual_merge_does_not_remove_persistent_region': True}


def _legend_fit(model, request, budget):
    if not request.legend_samples or not model.rules:
        raise RecolorPrerequisite('SCOPED_LEGEND_OBSERVATIONS_OR_RULES_MISSING')
    rows = []
    for sample in request.legend_samples:
        if sample.evidence_revision_ref != request.scope.evidence_revision_ref:
            raise RecolorPrerequisite('LEGEND_EVIDENCE_REVISION_STALE')
        if sample.raster.height * sample.raster.width > request.domain_bound:
            raise DComputationInterrupted('LEGEND_PIXEL_DOMAIN_BOUND', d_map({'sample_ref': sample.sample_ref}))
        support = _mask(sample.body.support, height=sample.raster.height, width=sample.raster.width,
                        budget=budget, label=sample.sample_ref)
        pockets = _pockets(sample.body, model.pocket_connectivity, budget)
        candidates = tuple(rule for rule in model.rules if rule.pocket_count == pockets['pocket_count'])
        fits = []
        for rule in candidates:
            wrong_shell = tuple(point for point in sorted(support)
                if sample.raster.rows[point[0]][point[1]] != rule.shell_value)
            pocket_support = tuple(point for pocket in pockets['pocket_masks'] for point in pocket)
            wrong_pocket = None if rule.pocket_value is None else tuple(point for point in pocket_support
                if sample.raster.rows[point[0]][point[1]] != rule.pocket_value)
            for _ in support:
                budget.visit()
            for _ in pocket_support:
                budget.visit()
            fits.append(d_map({'rule_ref': rule.rule_ref, 'wrong_shell_pixels': wrong_shell,
                'wrong_pocket_pixels': wrong_pocket,
                'consistent_on_observed_sample': not wrong_shell and not wrong_pocket,
                'evidence_refs': rule.evidence_refs}))
        rows.append(d_map({'sample_ref': sample.sample_ref, 'pocket_count': pockets['pocket_count'],
            'rule_constraints': tuple(fits), 'missing_rule_case': not candidates}))
    return {'legend_constraints': tuple(rows), 'absent_topology_classes_not_invented': True,
            'background_requirement_not_a_body_rule': model.background_requirement}


def _target(model, state, budget):
    editable = _field_masks(model, state, budget)
    if model.background_requirement is None:
        raise RecolorPrerequisite('WHOLE_FIELD_BACKGROUND_REQUIREMENT_MISSING')
    requirements, owners, conflicts, missing, reasons = {}, {}, [], [], []
    for region in model.regions:
        support = _mask(region.support, height=state.field.height, width=state.field.width,
                        budget=budget, label=region.region_ref)
        pockets = _pockets(region, model.pocket_connectivity, budget)
        rules = tuple(rule for rule in model.rules if rule.pocket_count == pockets['pocket_count'])
        if len(rules) != 1:
            missing.append((region.region_ref, 'TOPOLOGY_RULE_NOT_UNIQUE_IN_THIS_MODEL'))
            continue
        rule = rules[0]
        pocket_points = set(point for pocket in pockets['pocket_masks'] for point in pocket)
        if pocket_points and rule.pocket_value is None:
            missing.append((region.region_ref, 'POCKET_REQUIREMENT_MISSING'))
        for points, value in ((support, rule.shell_value), (pocket_points, rule.pocket_value)):
            if value is None:
                continue
            for point in sorted(points):
                budget.visit({'region_ref': region.region_ref, 'point': point})
                if point not in editable:
                    missing.append((region.region_ref, 'REQUIREMENT_OUTSIDE_EDITABLE_DOMAIN'))
                    continue
                if point in requirements and requirements[point] != value:
                    conflicts.append((point, owners[point], region.region_ref, requirements[point], value))
                requirements[point], owners[point] = value, region.region_ref
        reasons.append(d_map({'region_ref': region.region_ref, 'rule_ref': rule.rule_ref,
            'region_evidence_ref': region.evidence_ref, 'rule_evidence_refs': rule.evidence_refs,
            'pocket_count': pockets['pocket_count'], 'pocket_masks': pockets['pocket_masks']}))
    output = [list(row) for row in state.field.rows]
    for row, column in sorted(editable):
        budget.visit()
        output[row][column] = requirements.get((row, column), model.background_requirement)
    return {'target_surface': None if conflicts or missing else tuple(tuple(row) for row in output),
        'conflicting_requirements': tuple(conflicts), 'missing_requirements': tuple(missing),
        'per_region_evidence': tuple(reasons), 'rule_confirmation_authorized': False}


def _write_mask(model, state, seed, budget):
    editable = _field_masks(model, state, budget)
    if seed not in editable:
        raise RecolorPrerequisite('PAINT_SEED_OUTSIDE_CURRENT_EDITABLE_FIELD')
    if model.write_scope_law_ref not in ('ordinary_flood', 'flood_then_class_filter', 'class_constrained_flood'):
        raise RecolorPrerequisite('SUPPORTED_FLOOD_FILTER_ORDER_MISSING')
    color = state.field.rows[seed[0]][seed[1]]
    same = {point for point in editable if state.field.rows[point[0]][point[1]] == color}
    for _ in editable:
        budget.visit()
    class_support = None
    if model.write_scope_law_ref != 'ordinary_flood':
        if len(set(ref for ref, _ in model.class_masks)) != len(model.class_masks):
            raise RecolorPrerequisite('SUPPORTED_CLASS_IDENTITIES_NOT_UNIQUE')
        classes = []
        for ref, points in model.class_masks:
            proofs = tuple(evidence for class_ref, evidence in model.class_evidence_refs if class_ref == ref)
            if len(proofs) != 1:
                raise RecolorPrerequisite('CLASS_SUPPORT_ACQUISITION_EVIDENCE_NOT_UNIQUE')
            support = _mask(points, height=state.field.height, width=state.field.width,
                            budget=budget, label=ref)
            if not support <= editable:
                raise RecolorPrerequisite('SUPPORTED_CLASS_OUTSIDE_FIELD')
            if seed in support:
                classes.append(support)
        if len(classes) != 1:
            raise RecolorPrerequisite('SEED_CLASS_NOT_UNIQUE_IN_SUPPORTED_MODEL')
        class_support = classes[0]
    domain = same & class_support if model.write_scope_law_ref == 'class_constrained_flood' else same
    component = next(component for component in _components(domain, model.connectivity, budget) if seed in component)
    write = component & class_support if model.write_scope_law_ref == 'flood_then_class_filter' else component
    return component, frozenset(write)


def _surface_equal(field, target, editable, budget):
    if field.height != target.height or field.width != target.width:
        raise RecolorPrerequisite('TARGET_FIELD_SHAPES_INCOMPATIBLE')
    differences = []
    for row, column in sorted(editable):
        budget.visit()
        if field.rows[row][column] != target.rows[row][column]:
            differences.append((row, column, field.rows[row][column], target.rows[row][column]))
    return {'exact_match': not differences, 'counterexample_pixels': tuple(differences)}


def _external(model, state, primitive, request, budget):
    if state.terminated:
        raise RecolorPrerequisite('OFFICIAL_TERMINATION_REVOKES_FURTHER_INPUT')
    editable = _field_masks(model, state, budget)
    kind, changed, flood, write = primitive.kind_ref, (), (), ()
    if kind == 'reset':
        if model.reset_state is None or model.reset_cost is None:
            raise RecolorPrerequisite('INDEPENDENT_RESET_RESTORATION_MISSING')
        return {'before_state': state, 'recolor_input': primitive,
            'state': model.reset_state, 'event_ledger': d_map({'owner_ref': request.scope.event_owner_ref,
            'direct_kind': kind, 'debit': model.reset_cost, 'automatic_events': (),
            'acceptance_checked_by_reset_contract': True}), 'changed_support': None,
            'reset_not_a_second_paint_debit': True}
    if kind == 'pigment_selection':
        if primitive.pigment not in model.palette_values or model.selection_cost is None:
            raise RecolorPrerequisite('PIGMENT_UNAVAILABLE_OR_SELECTION_COST_MISSING')
        following = state.model_copy(update={'active_pigment': primitive.pigment})
        debit = model.selection_cost
    elif kind in ('canvas_click', 'canvas_hold'):
        if state.active_pigment not in model.palette_values or primitive.seed is None or model.paint_cost is None:
            raise RecolorPrerequisite('CURRENT_PIGMENT_SEED_OR_PAINT_COST_MISSING')
        if primitive.pigment is not None and primitive.pigment != state.active_pigment:
            raise RecolorPrerequisite('PAINT_PIGMENT_DOES_NOT_MATCH_CURRENT_SELECTION')
        if kind == 'canvas_hold' and model.hold_law_ref == 'hold_is_not_a_new_paint':
            if model.hold_cost is None:
                raise RecolorPrerequisite('HOLD_COST_MISSING')
            following, debit = state, model.hold_cost
        else:
            if kind == 'canvas_hold' and model.hold_law_ref != 'hold_repeats_current_component_paint':
                raise RecolorPrerequisite('SEALED_HOLD_LAW_MISSING')
            flood, write = _write_mask(model, state, primitive.seed, budget)
            if primitive.required_write_mask is not None and set(primitive.required_write_mask) != set(write):
                raise RecolorPrerequisite('CURRENT_FLOOD_MASK_DIFFERS_FROM_FROZEN_WRITE_MASK')
            preserve = _mask(primitive.preserve_mask, height=state.field.height, width=state.field.width,
                             budget=budget, label='preserve_mask')
            changed = tuple(point for point in sorted(write)
                if state.field.rows[point[0]][point[1]] != state.active_pigment)
            if set(changed) & preserve:
                raise RecolorPrerequisite('PAINT_OVERWRITES_PRESERVED_PIXEL')
            output = [list(row) for row in state.field.rows]
            for row, column in write:
                budget.visit()
                output[row][column] = state.active_pigment
            following = state.model_copy(update={'field': FrameGrid(rows=tuple(tuple(row) for row in output))})
            debit = model.paint_cost if kind == 'canvas_click' else model.hold_cost
            if debit is None:
                raise RecolorPrerequisite('REPEATED_HOLD_COST_MISSING')
    else:
        raise RecolorPrerequisite('EXTERNAL_RECOLOR_INPUT_KIND_UNSUPPORTED')
    if debit > state.reserve:
        raise RecolorPrerequisite('INSUFFICIENT_CURRENT_PAINT_RESERVE')
    if model.terminal_order_ref not in ('acceptance_before_exhaustion', 'exhaustion_before_acceptance'):
        raise RecolorPrerequisite('ACCEPTANCE_BUDGET_ORDER_MISSING')
    if model.acceptance_event_law_ref not in ('after_canvas_write', 'after_every_input'):
        raise RecolorPrerequisite('ACCEPTANCE_EVENT_SCOPE_MISSING')
    checks = model.acceptance_event_law_ref == 'after_every_input' or kind == 'canvas_click' or (
        kind == 'canvas_hold' and model.hold_law_ref == 'hold_repeats_current_component_paint')
    comparison = None
    if checks:
        if request.target_surface is None or not request.target_evidence_refs:
            raise RecolorPrerequisite('SUPPORTED_WHOLE_FIELD_TARGET_MISSING')
        comparison = _surface_equal(following.field, request.target_surface, editable, budget)
    reserve = state.reserve - debit
    exhausted = reserve == 0
    accepted = bool(comparison and comparison['exact_match'])
    if model.terminal_order_ref == 'exhaustion_before_acceptance' and exhausted:
        accepted = False
    following = following.model_copy(update={'reserve': reserve, 'accepted': accepted,
        'terminated': accepted or exhausted})
    return {'before_state': state, 'recolor_input': primitive,
        'state': following, 'changed_support': changed,
        'flood_support': tuple(sorted(flood)), 'write_support': tuple(sorted(write)),
        'comparison': comparison, 'event_ledger': d_map({'owner_ref': request.scope.event_owner_ref,
            'direct_kind': kind, 'automatic_events': (), 'debit': debit,
            'acceptance_checked': checks, 'accepted': accepted, 'exhausted': exhausted,
            'terminal_order_ref': model.terminal_order_ref}), 'primitive_complete': True}


def _binding(request, primitive):
    matches = tuple(binding for binding in request.bindings if binding.kind_ref == primitive.kind_ref
        and binding.seed == primitive.seed and binding.pigment == primitive.pigment
        and binding.evidence_revision_ref == request.scope.evidence_revision_ref)
    if len(matches) != 1:
        raise RecolorPrerequisite('CURRENT_NATIVE_PAINT_BINDING_NOT_UNIQUE')
    return d_map({'action_ref': matches[0].action_ref, 'payload': matches[0].payload})


def _word(model, state, word, request, budget, compile_native):
    if len(word.paints) > request.depth_bound:
        raise DComputationInterrupted('PAINT_WORD_DEPTH_BOUND', d_map({'word_ref': word.word_ref}))
    inputs, events, current, cost, primitive_count = [], [], state, 0, 0
    for index, paint in enumerate(word.paints):
        budget.visit({'word_ref': word.word_ref, 'paint_index': index})
        if paint.kind_ref != 'canvas_click' or paint.pigment is None:
            raise RecolorPrerequisite('ROOT_PAINT_WORD_NOT_BOUND_TO_CANVAS_SEEDS_AND_PIGMENTS')
        primitives = []
        if current.active_pigment != paint.pigment:
            primitives.append(RecolorInput(kind_ref='pigment_selection', pigment=paint.pigment))
        primitives.append(paint)
        for primitive in primitives:
            if primitive_count >= request.depth_bound:
                raise DComputationInterrupted('PAINT_PRIMITIVE_DEPTH_BOUND', d_map({'word_ref': word.word_ref,
                    'paint_index': index, 'primitive_count': primitive_count}))
            primitive_count += 1
            if compile_native:
                inputs.append(_binding(request, primitive))
            result = _external(model, current, primitive, request, budget)
            current = result['state']
            cost += result['event_ledger']['debit']
            events.append(d_map(result))
            if current.terminated:
                if word.require_target_at_end and not current.accepted:
                    raise RecolorPrerequisite('TERMINAL_INTERRUPTION_BEFORE_REQUIRED_SURFACE_ACCEPTANCE')
                all_paints_processed = index == len(word.paints) - 1 and primitive.kind_ref == 'canvas_click'
                return {'word_ref': word.word_ref, 'state': current, 'native_word': tuple(inputs),
                    'event_results': tuple(events), 'cost': cost, 'word_complete': all_paints_processed,
                    'terminal_interruption': not all_paints_processed,
                    'target_at_end': current.accepted, 'primitive_release_authorized': False}
    comparison = None if request.target_surface is None else _surface_equal(
        current.field, request.target_surface, _field_masks(model, current, budget), budget)
    if word.require_target_at_end and (comparison is None or not comparison['exact_match']):
        raise RecolorPrerequisite('SUPPLIED_WORD_DOES_NOT_PRODUCE_REQUIRED_WHOLE_SURFACE')
    return {'word_ref': word.word_ref, 'state': current, 'native_word': tuple(inputs),
        'event_results': tuple(events), 'cost': cost, 'word_complete': True,
        'terminal_interruption': False, 'target_at_end': None if comparison is None else comparison['exact_match'],
        'primitive_release_authorized': False}


def _scope_fit(model, request, budget):
    if not request.observations:
        raise RecolorPrerequisite('SEALED_CANVAS_CHANGE_OBSERVATIONS_MISSING')
    constraints = []
    for index, sample in enumerate(request.observations):
        if sample.get('sealed') is not True or not sample.get('event_owner_ref'):
            raise RecolorPrerequisite('SEALED_REPAINT_OWNER_MISSING')
        if sample.get('before_state') is None or sample.get('after_field') is None or sample.get('seed') is None:
            raise RecolorPrerequisite('BEFORE_AFTER_CANVAS_AND_SEED_MISSING')
        before = RecolorState.model_validate(sample['before_state'])
        after = FrameGrid.model_validate(sample['after_field'])
        pigment = sample.get('pigment')
        if type(pigment) is not int or not 0 <= pigment <= 255:
            raise RecolorPrerequisite('OBSERVED_OVERWRITE_PIGMENT_MISSING')
        seed = tuple(sample['seed'])
        flood, write = _write_mask(model, before, seed, budget)
        editable = _field_masks(model, before, budget)
        wrong, outside = [], []
        if after.height != before.field.height or after.width != before.field.width:
            raise RecolorPrerequisite('REPAINT_FIT_LEVEL_REPLACEMENT_NOT_SEPARATED')
        for row in range(after.height):
            for column in range(after.width):
                budget.visit()
                point = (row, column)
                expected = pigment if point in write else before.field.rows[row][column]
                if point in editable and after.rows[row][column] != expected:
                    wrong.append((point, expected, after.rows[row][column]))
                if point not in editable and after.rows[row][column] != before.field.rows[row][column]:
                    outside.append(point)
        constraints.append(d_map({'sample_index': index, 'event_owner_ref': sample['event_owner_ref'],
            'flood_support': tuple(sorted(flood)), 'write_support': tuple(sorted(write)),
            'consistent_on_observed_change': not wrong, 'counterexamples': tuple(wrong),
            'outside_field_changes': tuple(outside), 'isolated_body_does_not_discriminate_laws': True}))
    return {'write_law_ref': model.write_scope_law_ref, 'constraints': tuple(constraints),
        'unique_scope_law_not_claimed': True}


def _painting_compare(model, request, budget):
    if not request.observations:
        raise RecolorPrerequisite('SEALED_PAINTING_PACKET_MISSING')
    results, first = [], None
    for index, sample in enumerate(request.observations):
        budget.visit({'sample_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise RecolorPrerequisite('PAINTING_REPLY_NOT_SEALED_FOR_BOUND_OWNER')
        kind = sample.get('observed_event_kind_ref')
        if kind not in ('pigment_selection', 'canvas_write', 'repeated_hold', 'transient_feedback', 'level_replacement'):
            raise RecolorPrerequisite('PAINTING_REPLY_EVENT_PARTITION_NOT_QUALIFIED')
        comparison, field_delta = None, None
        if kind not in ('transient_feedback', 'level_replacement'):
            if sample.get('actual_state') is None or sample.get('expected_state') is None:
                raise RecolorPrerequisite('CURRENT_EXPECTED_PAINTING_STATES_MISSING')
            actual = RecolorState.model_validate(sample['actual_state'])
            expected = RecolorState.model_validate(sample['expected_state'])
            pixels = _surface_equal(actual.field, expected.field, _field_masks(model, actual, budget), budget)
            differences = tuple(name for name in ('active_pigment', 'reserve', 'terminated', 'accepted')
                if getattr(actual, name) != getattr(expected, name))
            comparison = d_map({'field_comparison': d_map(pixels), 'control_difference_fields': differences})
            if first is None and (not pixels['exact_match'] or differences):
                first = index
            if kind in ('canvas_write', 'repeated_hold'):
                if sample.get('before_state') is None or sample.get('seed') is None:
                    raise RecolorPrerequisite('PAINTING_BEFORE_STATE_AND_COMPONENT_SEED_MISSING')
                before = RecolorState.model_validate(sample['before_state'])
                editable = _field_masks(model, before, budget)
                if (before.field.height, before.field.width) != (actual.field.height, actual.field.width):
                    raise RecolorPrerequisite('PAINTING_SCENE_REPLACEMENT_NOT_SEPARATED')
                changed = set()
                for point in sorted(editable):
                    budget.visit()
                    if before.field.rows[point[0]][point[1]] != actual.field.rows[point[0]][point[1]]:
                        changed.add(point)
                flood, write = _write_mask(model, before, tuple(sample['seed']), budget)
                field_delta = d_map({'changed_support': tuple(sorted(changed)),
                    'prior_color_component': tuple(sorted(flood)), 'predicted_write_support': tuple(sorted(write)),
                    'structural_intersections': tuple((region.region_ref, tuple(sorted(changed & set(region.support))))
                        for region in model.regions if changed & set(region.support))})
        results.append(d_map({'sample_index': index, 'event_owner_ref': sample['event_owner_ref'],
            'observed_event_kind_ref': kind, 'comparison': comparison, 'field_delta': field_delta,
            'scene_replacement_invalidates_region_authority': kind == 'level_replacement',
            'observed_frame_is_not_an_extra_input': True}))
    return {'packet_comparisons': tuple(results), 'first_divergence_index': first,
        'canonical_region_identity_created': False}


def _field_control_partition(request, budget):
    if (request.observed_frame is None or not request.frame_ref or not request.observed_scene_ref
            or request.frame_epoch != request.scope.epoch
            or request.frame_evidence_revision_ref != request.scope.evidence_revision_ref
            or not request.panel_partitions):
        raise RecolorPrerequisite('CURRENT_RECOLOR_FRAME_SCENE_AND_SOURCE_PARTITIONS_REQUIRED')
    if len(request.panel_partitions) > request.domain_bound:
        raise DComputationInterrupted('RECOLOR_PARTITION_DOMAIN_BOUND', d_map())
    if len({row.partition_ref for row in request.panel_partitions}) != len(request.panel_partitions):
        raise RecolorPrerequisite('UNIQUE_SOURCE_PARTITION_IDENTITIES_REQUIRED')
    results = []
    for partition in request.panel_partitions:
        if partition.panels.scene_ref != request.observed_scene_ref or partition.panels.slots:
            raise RecolorPrerequisite('CURRENT_RECOLOR_REGIONS_NOT_INDEXED_SLOT_CONTROLS_REQUIRED')
        regions = {row.region_ref: row for row in partition.panels.regions}
        nonfield_refs = (*partition.legend_region_refs,
            *(well.region_ref for well in partition.pigment_wells),
            *partition.selection_decoration_refs, *partition.hud_region_refs)
        role_refs = (partition.field_region_ref, *nonfield_refs)
        if len(set(role_refs)) != len(role_refs) or any(ref not in regions for ref in role_refs):
            raise RecolorPrerequisite('SEPARATE_SOURCE_FIELD_LEGEND_WELL_DECORATION_HUD_REGION_IDENTITIES_REQUIRED')
        if (len(set(partition.editable_local_mask)) != len(partition.editable_local_mask)
                or len({row.class_ref for row in partition.class_candidates}) != len(partition.class_candidates)):
            raise RecolorPrerequisite('UNIQUE_EDITABLE_PIXEL_AND_CLASS_CANDIDATE_IDENTITIES_REQUIRED')
        if max(len(role_refs), len(partition.editable_local_mask), len(partition.class_candidates)) > request.domain_bound:
            raise DComputationInterrupted('RECOLOR_PARTITION_MASK_DOMAIN_BOUND', d_map())
        measured = measure_panel_regions_d(request.observed_frame, (partition.panels,), budget)[0]
        by_region = {row['region_ref']: row for row in measured['regions']}
        field = by_region[partition.field_region_ref]
        domain, ambiguous, unknown = [], [], []
        transform = field['local_to_native']
        source_core = regions[partition.field_region_ref].content_bounds
        for row, column in partition.editable_local_mask:
            top = transform['row_origin'] + row * transform['row_scale']
            left = transform['column_origin'] + column * transform['column_scale']
            block = (top, left, top + transform['row_scale'] - 1, left + transform['column_scale'] - 1)
            if row < 0 or column < 0 or block[2] > source_core[2] or block[3] > source_core[3]:
                raise RecolorPrerequisite('EDITABLE_LOCAL_MASK_OUTSIDE_DECLARED_FIELD_CONTENT')
            conflicts = []
            for ref in nonfield_refs:
                budget.visit({'editable_local_pixel': (row, column), 'other_partition_region_ref': ref})
                bounds = regions[ref].content_bounds
                if max(block[0], bounds[0]) <= min(block[2], bounds[2]) and max(block[1], bounds[1]) <= min(block[3], bounds[3]):
                    conflicts.append(ref)
            if conflicts:
                ambiguous.append(d_map({'local_pixel': (row, column), 'native_block': block,
                    'conflicting_region_refs': tuple(conflicts)}))
            elif not field['sampling_compatible']:
                unknown.append((row, column))
            else:
                domain.append((row, column))
        domain_set = set(domain)
        classes = []
        for candidate in partition.class_candidates:
            if len(candidate.local_mask) > request.domain_bound:
                raise DComputationInterrupted('RECOLOR_CLASS_MASK_PIXEL_DOMAIN_BOUND', d_map())
            if (not candidate.evidence_ref
                    or len(set(candidate.local_mask)) != len(candidate.local_mask)
                    or not set(candidate.local_mask) <= set(partition.editable_local_mask)):
                raise RecolorPrerequisite('BOUNDED_SOURCE_CLASS_MASK_WITH_FIELD_PROVENANCE_REQUIRED')
            pixels = []
            for point in candidate.local_mask:
                budget.visit({'class_ref': candidate.class_ref, 'local_mask_pixel': point})
                if point in domain_set:
                    pixels.append((*point, field['local_raster'][point[0]][point[1]]))
            classes.append(d_map({'class_ref': candidate.class_ref, 'evidence_ref': candidate.evidence_ref,
                'source_candidate_mask': candidate.local_mask, 'measured_mask_pixels': tuple(pixels),
                'unresolved_mask_pixels': tuple(point for point in candidate.local_mask if point not in domain_set),
                'class_identity_or_topology_not_confirmed': True}))
        wells = []
        for well in partition.pigment_wells:
            if len(well.sample_positions) > request.domain_bound:
                raise DComputationInterrupted('RECOLOR_WELL_SAMPLE_DOMAIN_BOUND', d_map())
            if not well.evidence_ref or len(set(well.sample_positions)) != len(well.sample_positions):
                raise RecolorPrerequisite('CURRENT_BOUNDED_WELL_CUE_SAMPLES_REQUIRED')
            content = by_region[well.region_ref]
            samples = []
            for row, column in well.sample_positions:
                budget.visit({'well_region_ref': well.region_ref, 'local_sample': (row, column)})
                local = content['local_raster']
                mapping = content['local_to_native']
                bounds = regions[well.region_ref].content_bounds
                bottom = mapping['row_origin'] + (row + 1) * mapping['row_scale'] - 1
                right = mapping['column_origin'] + (column + 1) * mapping['column_scale'] - 1
                if row < 0 or column < 0 or bottom > bounds[2] or right > bounds[3]:
                    raise RecolorPrerequisite('PIGMENT_CUE_SAMPLE_OUTSIDE_MEASURED_WELL')
                samples.append((row, column, local[row][column] if local is not None else None, well.pigment))
            wells.append(d_map({'source_well': well, 'measured_panel': content, 'cue_samples': tuple(samples),
                'pigment_cue_consistent': all(value == expected for _, _, value, expected in samples)
                    if all(value is not None for _, _, value, _ in samples) else None,
                'selection_not_inferred_from_pigment_color': True}))
        results.append(d_map({'partition_ref': partition.partition_ref, 'layout_ref': partition.panels.layout_ref,
            'field_panel': field, 'editable_comparison_local_mask': tuple(domain),
            'legend_panels': tuple(by_region[ref] for ref in partition.legend_region_refs),
            'pigment_well_cues': tuple(wells),
            'selection_decorations': tuple(by_region[ref] for ref in partition.selection_decoration_refs),
            'hud_panels': tuple(by_region[ref] for ref in partition.hud_region_refs),
            'ambiguous_editable_pixels': tuple(ambiguous), 'unknown_editable_pixels': tuple(unknown),
            'class_candidates': tuple(classes), 'native_click_supports': measured['native_click_supports'],
            'source_partition_not_universal_geometry_or_palette': True}))
    budget.finish()
    return {'frame_ref': request.frame_ref, 'partition_alternatives': tuple(results),
        'hud_legend_wells_and_selection_excluded_from_editable_comparison': True,
        'role_class_selection_paint_and_goal_authority_source_owned': True}


def measure_topological_region_recolor(request: TopologicalRecolorRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget = DWorkBudget(request)
    operation = request.operation_ref.rsplit('.', 1)[-1]
    rows, current_model_ref = [], None
    try:
        if operation == 'field_control_partition':
            return d_result(request, 'OK', 'EXACT_CURRENT_SOURCE_FIELD_CONTROL_PARTITIONS',
                values=_field_control_partition(request, budget), complete=True, examined=budget.examined)
        if not request.models:
            raise RecolorPrerequisite('SCOPED_TOPOLOGY_AND_WRITE_MODELS_MISSING')
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            if operation == 'enclosed_pockets':
                if not model.regions:
                    raise RecolorPrerequisite('SUPPORTED_BODY_MASKS_MISSING')
                row = {'region_pockets': tuple(d_map(_pockets(region, model.pocket_connectivity, budget))
                    for region in model.regions)}
            elif operation == 'legend_rule_fit':
                row = _legend_fit(model, request, budget)
            elif operation in ('repaint_scope_fit', 'painting_compare'):
                row = _scope_fit(model, request, budget) if operation == 'repaint_scope_fit' else _painting_compare(model, request, budget)
            else:
                if request.state is None:
                    raise RecolorPrerequisite('CURRENT_FIELD_AND_CONTROL_STATE_MISSING')
                if operation == 'persistent_region_inventory':
                    row = _inventory(model, request.state, budget)
                elif operation == 'target_surface_derive':
                    row = _target(model, request.state, budget)
                elif operation in ('component_recolor_step', 'external_primitive'):
                    if request.primitive is None:
                        raise RecolorPrerequisite('SOURCE_BOUND_RECOLOR_PRIMITIVE_MISSING')
                    if operation == 'component_recolor_step' and request.primitive.kind_ref != 'canvas_click':
                        raise RecolorPrerequisite('COMPONENT_STEP_REQUIRES_CANVAS_CLICK')
                    row = _external(model, request.state, request.primitive, request, budget)
                elif operation in ('palette_plan', 'current_state_repair'):
                    if not request.words:
                        raise RecolorPrerequisite('SOURCE_REQUESTED_PAINT_WORDS_MISSING')
                    if request.target_surface is None or not request.target_evidence_refs:
                        raise RecolorPrerequisite('SUPPORTED_REPAIR_COMPARISON_TARGET_MISSING')
                    if (request.target_surface.height, request.target_surface.width) != (
                        request.state.field.height, request.state.field.width):
                        raise RecolorPrerequisite('REPAIR_TARGET_SHAPE_INCOMPATIBLE')
                    results = []
                    for word in request.words:
                        try:
                            image = _word(model, request.state, word, request, budget, operation == 'palette_plan')
                            results.append(d_map({'comparison_kind_ref': word.comparison_kind_ref, 'image': d_map(image)}))
                        except RecolorPrerequisite as error:
                            results.append(d_map({'word_ref': word.word_ref, 'obstruction': str(error)}))
                    editable = _field_masks(model, request.state, budget)
                    unwritable = () if request.target_surface is None else tuple(point for point in sorted(editable)
                        if request.state.field.rows[point[0]][point[1]] != request.target_surface.rows[point[0]][point[1]]
                        and request.target_surface.rows[point[0]][point[1]] not in model.palette_values)
                    row = {'word_results': tuple(results), 'unavailable_target_pixels': unwritable,
                        'failure_of_one_word_is_not_global_impossibility': True,
                        'route_search_not_launched': True}
                else:
                    return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'COMPLETE', 'REQUESTED_FINITE_CALCULATION_RETURNED',
            values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except RecolorPrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DComputationInterrupted as error:
        return d_result(request, 'NEEDS_EVIDENCE', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
