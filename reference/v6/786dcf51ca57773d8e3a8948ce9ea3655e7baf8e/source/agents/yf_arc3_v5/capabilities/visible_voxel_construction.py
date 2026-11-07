"""Declared logical voxels, ray/depth face stamps and genuinely visible ports.

Projection templates are supplied measured/calibrated laws, not a creator
occupancy. Equal views preserve distinct occupancies and future hit domains.
"""
from __future__ import annotations

from fractions import Fraction
from typing import ClassVar
from pydantic import Field
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .voxel_projection_contracts_d import VoxelUnitCalibration
from .voxel_projection_measurement_d import measure_voxel_projection_d
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)

Point = tuple[int, int]
Cell = tuple[int, int, int]
_NORMALS = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))


class VoxelOccurrence(FrozenModel):
    voxel_ref: Ref
    cell: Cell
    material_ref: Ref


class VoxelState(FrozenModel):
    occurrences: tuple[VoxelOccurrence, ...] = Field(default=(), max_length=128)
    tool_ref: Ref
    reserve: int = Field(ge=0)
    terminated: bool


class VoxelFacePixel(FrozenModel):
    offset: Point
    value: int = Field(ge=0, le=255)
    depth_offset: tuple[int, int]
    interior: bool


class VoxelFaceTemplate(FrozenModel):
    material_ref: Ref
    normal: Cell
    pixels: tuple[VoxelFacePixel, ...] = Field(min_length=1, max_length=4096)
    evidence_ref: Ref


class VoxelProjection(FrozenModel):
    projection_ref: Ref
    origin: Point
    axis_vectors: tuple[Point, Point, Point]
    depth_vector: Cell
    face_templates: tuple[VoxelFaceTemplate, ...] = Field(min_length=1, max_length=128)
    face_order: tuple[Cell, ...] = Field(min_length=1, max_length=6)
    depth_law_ref: Ref
    internal_face_law_ref: Ref
    height: int = Field(ge=1, le=256)
    width: int = Field(ge=1, le=256)
    background_value: int = Field(ge=0, le=255)
    calibration_evidence_ref: Ref


class VoxelReference(FrozenModel):
    reference_ref: Ref
    image: FrameGrid
    evidence_ref: Ref


class VoxelBasePort(FrozenModel):
    port_ref: Ref
    destination: Cell
    interior_pixels: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    evidence_ref: Ref


class VoxelModel(FrozenModel):
    model_ref: Ref
    logical_cells: tuple[Cell, ...] = Field(min_length=1, max_length=4096)
    game_boundary_law_ref: Ref | None = None
    view_projection: VoxelProjection
    reference_projection: VoxelProjection | None = None
    sampling_law_ref: Ref | None = None
    references: tuple[VoxelReference, ...] = Field(default=(), max_length=128)
    comparison_law_ref: Ref | None = None
    terminal_equivalence_ref: Ref | None = None
    base_ports: tuple[VoxelBasePort, ...] = Field(default=(), max_length=4096)
    unowned_opaque_pixels: tuple[Point, ...] = Field(default=(), max_length=4096)
    conflicting_control_pixels: tuple[Point, ...] = Field(default=(), max_length=4096)
    create_effect_ref: Ref | None = None
    erase_effect_ref: Ref | None = None
    refusal_law_ref: Ref | None = None
    material_cycle: tuple[Ref, ...] = Field(default=(), max_length=128)
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=8)
    terminal_order_ref: Ref | None = None
    reset_state: VoxelState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class VoxelInput(FrozenModel):
    kind_ref: Ref
    point: Point | None = None
    tool_ref: Ref | None = None
    new_voxel_ref: Ref | None = None
    material_ref: Ref | None = None


class VoxelBinding(FrozenModel):
    primitive: VoxelInput
    action_ref: Ref
    payload: FrozenMap
    evidence_revision_ref: Ref
    native_support_ref: Ref
    projection_ref: Ref


_CASES = (
    ('projected_unit_measure', ('MEASURE',)), ('legend_reconstruction_domain', ('INVERSE_DOMAIN',)),
    ('visible_face_ownership', ('DOMAIN',)), ('face_edit_law_fit', ('FIT',)),
    ('voxel_edit_successor', ('STEP',)), ('cropped_view_equivalence', ('COMPARE',)),
    ('construction_port_dependencies', ('PRECONDITION',)), ('visible_face_click_compile', ('COMPILE',)),
    ('bounded_view_repair_paths', ('DOMAIN',)), ('sealed_construction_compare', ('COMPARE',)),
    ('external_primitive', ('STEP',)),
)


class VisibleVoxelRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.visible_voxel_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.visible_voxel_construction.{operation}', mode)
        for operation, modes in _CASES for mode in modes)
    models: tuple[VoxelModel, ...] = Field(default=(), max_length=32)
    state: VoxelState | None = None
    primitive: VoxelInput | None = None
    assemblies: tuple[VoxelState, ...] = Field(default=(), max_length=4096)
    desired_additions: tuple[VoxelOccurrence, ...] = Field(default=(), max_length=128)
    intended_owner_ref: Ref | None = None
    intended_normal: Cell | None = None
    bindings: tuple[VoxelBinding, ...] = Field(default=(), max_length=4096)
    native_inputs: tuple[VoxelInput, ...] = Field(default=(), max_length=4096)
    native_input_domain_complete: bool = False
    observed_frame: FrameGrid | None = None
    frame_ref: Ref | None = None
    frame_epoch: int | None = Field(default=None, ge=0)
    calibration_candidates: tuple[VoxelUnitCalibration, ...] = Field(default=(), max_length=32)


class VoxelPrerequisite(Exception):
    pass


def _add(cell, normal):
    return tuple(cell[index] + normal[index] for index in range(3))


def _state(model, state, budget):
    domain = frozenset(model.logical_cells)
    if len(domain) != len(model.logical_cells) or len(domain) > budget.request.domain_bound:
        raise VoxelPrerequisite('UNIQUE_DECLARED_LOGICAL_QUERY_DOMAIN_REQUIRED')
    if len(state.occurrences) > budget.request.domain_bound:
        raise DComputationInterrupted('LOGICAL_POPULATION_COMPUTATION_BOUND', d_map())
    if len(state.occurrences) > 128:
        raise DComputationInterrupted('LOGICAL_OCCUPANCY_DTO_CAPACITY_BOUND', d_map())
    refs, occupied = {}, {}
    for item in state.occurrences:
        budget.visit({'voxel_ref': item.voxel_ref})
        if item.voxel_ref in refs or item.cell in occupied or not item.material_ref:
            raise VoxelPrerequisite('FULL_LOGICAL_IDENTITIES_AND_MATERIALS_NOT_VALID')
        if item.cell not in domain:
            raise DComputationInterrupted('LOGICAL_QUERY_BOX_DOES_NOT_COVER_CURRENT_OCCUPANCY', d_map())
        refs[item.voxel_ref], occupied[item.cell] = item, item
    if state.tool_ref not in ('CREATE', 'ERASE'):
        raise VoxelPrerequisite('ACTUAL_CURRENT_CREATE_ERASE_MODE_REQUIRED')
    return refs, occupied, domain


def _render(model, state, projection, budget, native=False):
    _, occupied, _ = _state(model, state, budget)
    if projection.internal_face_law_ref != 'logical_normal_neighbor_removes_face':
        raise VoxelPrerequisite('ESTABLISHED_LOGICAL_NEIGHBOR_FACE_REMOVAL_LAW_REQUIRED')
    if projection.depth_law_ref != 'max_depth_then_occurrence_order_then_source_face_order':
        raise VoxelPrerequisite('EXACT_SUPPLIED_RAY_DEPTH_AND_TIE_POLICY_REQUIRED')
    if len(set(projection.face_order)) != len(projection.face_order) or any(normal not in _NORMALS for normal in projection.face_order):
        raise VoxelPrerequisite('UNIQUE_DECLARED_PROJECTED_FACE_ORDER_REQUIRED')
    templates = {(template.material_ref, template.normal): template for template in projection.face_templates}
    if len(templates) != len(projection.face_templates) or any(template.normal not in projection.face_order for template in projection.face_templates):
        raise VoxelPrerequisite('FUNCTIONAL_CALIBRATED_MATERIAL_FACE_TEMPLATE_DOMAIN_REQUIRED')
    if projection.height * projection.width > budget.request.domain_bound:
        raise DComputationInterrupted('PROJECTED_CANVAS_PIXEL_DOMAIN_BOUND', d_map())
    winners, faces = {}, []
    for ordinal, item in enumerate(state.occurrences):
        origin = tuple(projection.origin[index] + sum(item.cell[axis] * projection.axis_vectors[axis][index] for axis in range(3)) for index in range(2))
        cell_depth = sum(item.cell[axis] * projection.depth_vector[axis] for axis in range(3))
        for face_index, normal in enumerate(projection.face_order):
            budget.visit({'voxel_ref': item.voxel_ref, 'face_normal': normal})
            if _add(item.cell, normal) in occupied:
                faces.append(d_map({'voxel_ref': item.voxel_ref, 'normal': normal, 'internal': True, 'pixel_support': ()}))
                continue
            if (item.material_ref, normal) not in templates:
                raise VoxelPrerequisite('CURRENT_MATERIAL_PROJECTED_FACE_TEMPLATE_MISSING')
            template = templates[(item.material_ref, normal)]
            if len(set(pixel.offset for pixel in template.pixels)) != len(template.pixels):
                raise VoxelPrerequisite('FACE_PIXEL_DEPTH_INTERIOR_TEMPLATE_NOT_FUNCTIONAL')
            points = []
            for pixel in template.pixels:
                budget.visit({'voxel_ref': item.voxel_ref, 'face_pixel': pixel.offset})
                if pixel.depth_offset[1] <= 0:
                    raise VoxelPrerequisite('EXACT_FACE_PIXEL_RAY_DEPTH_OFFSET_REQUIRED')
                point = origin[0] + pixel.offset[0], origin[1] + pixel.offset[1]
                if not (0 <= point[0] < projection.height and 0 <= point[1] < projection.width):
                    continue
                points.append(point)
                rank = Fraction(cell_depth) + Fraction(*pixel.depth_offset), ordinal, face_index
                if point not in winners or rank > winners[point]['rank']:
                    winners[point] = {'rank': rank, 'voxel_ref': item.voxel_ref, 'normal': normal,
                        'value': pixel.value, 'interior': pixel.interior}
            faces.append(d_map({'voxel_ref': item.voxel_ref, 'normal': normal, 'internal': False, 'pixel_support': tuple(points)}))
    opaque = frozenset(model.unowned_opaque_pixels) if native else frozenset()
    owners, image = [], []
    for point in sorted(winners):
        winner = winners[point]
        if point not in opaque:
            image.append((point, winner['value']))
        owners.append(d_map({'point': point, 'voxel_ref': winner['voxel_ref'] if point not in opaque else None,
            'normal': winner['normal'] if point not in opaque else None,
            'clickable_interior': winner['interior'] and point not in opaque and point not in model.conflicting_control_pixels,
            'depth': (winner['rank'][0].numerator, winner['rank'][0].denominator),
            'edge_or_unowned_opaque': not winner['interior'] or point in opaque}))
    face_rows = []
    for face in faces:
        visible = tuple(row['point'] for row in owners if row['voxel_ref'] == face['voxel_ref'] and row['normal'] == face['normal'])
        clickable = tuple(row['point'] for row in owners if row['voxel_ref'] == face['voxel_ref'] and row['normal'] == face['normal'] and row['clickable_interior'])
        blockers = tuple(sorted({winners[point]['voxel_ref'] for point in face['pixel_support']
            if winners[point]['voxel_ref'] != face['voxel_ref']}))
        face_rows.append(FrozenMap.overlay(face, {'visible_pixels': visible, 'clickable_pixels': clickable,
            'occluding_voxel_refs': blockers, 'logical_occurrence_retained': True}))
    return {'projection_ref': projection.projection_ref,
        'logical_occurrence_refs': tuple(item.voxel_ref for item in state.occurrences),
        'logical_population_size': len(state.occurrences), 'pixel_values': tuple(image),
        'unobserved_overlay_pixel_refs': tuple(sorted(opaque)),
        'pixel_ownership': tuple(owners), 'face_domains': tuple(face_rows),
        'background_value': projection.background_value, 'height': projection.height, 'width': projection.width,
        'view_is_not_a_unique_logical_volume': True}


def _signature(rendered, law):
    mapping = {tuple(point): value for point, value in rendered['pixel_values']}
    height, width, background = rendered['height'], rendered['width'], rendered['background_value']
    if law == 'fixed_canvas_exact':
        top, left, bottom, right = 0, 0, height - 1, width - 1
    elif law == 'outer_nonbackground_crop_exact':
        scored = tuple(point for point in sorted(mapping) if mapping[point] != background)
        if not scored:
            return ()
        top, left = min(point[0] for point in scored), min(point[1] for point in scored)
        bottom, right = max(point[0] for point in scored), max(point[1] for point in scored)
    else:
        raise VoxelPrerequisite('DECLARED_VIEW_CROP_TRANSLATION_EQUIVALENCE_REQUIRED')
    return tuple(tuple(mapping.get((row, column), background) for column in range(left, right + 1)) for row in range(top, bottom + 1))


def _views(model, state, budget):
    if model.reference_projection is None or model.sampling_law_ref != 'independently_calibrated_sampled_face_projection':
        raise VoxelPrerequisite('SUPPORTED_REFERENCE_PROJECTION_AND_SAMPLING_LAW_REQUIRED')
    if not model.references:
        raise VoxelPrerequisite('CURRENT_OBSERVED_REFERENCE_SIGNATURE_DOMAIN_REQUIRED')
    rendered = _render(model, state, model.reference_projection, budget)
    signature = _signature(rendered, model.comparison_law_ref)
    rows = []
    for reference in model.references:
        budget.visit({'reference_ref': reference.reference_ref})
        if reference.image.height * reference.image.width > budget.request.domain_bound:
            raise DComputationInterrupted('REFERENCE_PIXEL_DOMAIN_BOUND', d_map())
        data = {'pixel_values': tuple(((row, column), value) for row, values in enumerate(reference.image.rows) for column, value in enumerate(values)),
            'height': reference.image.height, 'width': reference.image.width, 'background_value': model.reference_projection.background_value}
        target = _signature(data, model.comparison_law_ref)
        rows.append(d_map({'reference_ref': reference.reference_ref, 'exact_visible_match': signature == target,
            'shape_matches': len(signature) == len(target) and (not signature or not target or len(signature[0]) == len(target[0])),
            'internal_voids_and_edges_retained': True, 'target_volume_or_count_not_assumed': True}))
    return {'sampled_construction_signature': signature, 'reference_comparisons': tuple(rows),
        'some_supported_reference_matches': any(row['exact_visible_match'] for row in rows),
        'pixel_duplication_inverse_not_used': True}


def _hit(model, state, point, budget):
    rendered = _render(model, state, model.view_projection, budget, native=True)
    if not (0 <= point[0] < model.view_projection.height and 0 <= point[1] < model.view_projection.width):
        return {'kind_ref': 'OUTSIDE_CURRENT_PROJECTED_VIEWPORT', 'rendered': d_map(rendered)}
    owner = next((row for row in rendered['pixel_ownership'] if row['point'] == point), None)
    if point in model.conflicting_control_pixels or point in model.unowned_opaque_pixels:
        return {'kind_ref': 'BLOCKED_UNOWNED_OR_CONTROL', 'rendered': d_map(rendered)}
    if owner is not None:
        return {'kind_ref': 'FACE_INTERIOR' if owner['clickable_interior'] else 'OPAQUE_EDGE',
            'owner': owner, 'rendered': d_map(rendered)}
    bases = tuple(port for port in model.base_ports if point in port.interior_pixels)
    if len(bases) > 1:
        raise VoxelPrerequisite('BASE_PORT_PIXEL_OWNER_NOT_UNIQUE')
    if bases:
        return {'kind_ref': 'BASE_INTERIOR', 'base_port': bases[0], 'rendered': d_map(rendered)}
    return {'kind_ref': 'NO_VISIBLE_PORT', 'rendered': d_map(rendered)}


def _edit(model, state, primitive, budget):
    refs, occupied, domain = _state(model, state, budget)
    if primitive.kind_ref == 'set_tool':
        if primitive.tool_ref not in ('CREATE', 'ERASE') or primitive.point is not None or primitive.new_voxel_ref is not None or primitive.material_ref is not None:
            raise VoxelPrerequisite('ACTUAL_TOOL_CONTROL_CHANNEL_NOT_BOUND')
        return {'state': state.model_copy(update={'tool_ref': primitive.tool_ref}), 'effect_ref': 'TOOL_MODE_CHANGE', 'edit_count': 0}
    if primitive.kind_ref != 'point' or primitive.point is None or primitive.tool_ref is not None:
        raise VoxelPrerequisite('BOUND_NATIVE_VISIBLE_PORT_POINT_REQUIRED')
    hit = _hit(model, state, primitive.point, budget)
    if hit['kind_ref'] not in ('FACE_INTERIOR', 'BASE_INTERIOR'):
        if model.refusal_law_ref != 'no_change_same_input_cost':
            raise VoxelPrerequisite('BLOCKED_EDGE_EMPTY_OR_UNOWNED_POINT_EFFECT_REQUIRED')
        return {'state': state, 'effect_ref': 'POINT_WITHOUT_CLICKABLE_PORT', 'edit_count': 0, 'hit': d_map(hit)}
    if state.tool_ref == 'ERASE':
        if model.erase_effect_ref != 'erase_visible_face_owner_without_settling':
            raise VoxelPrerequisite('DECLARED_VISIBLE_OWNER_ERASURE_LAW_REQUIRED')
        if hit['kind_ref'] != 'FACE_INTERIOR':
            return {'state': state, 'effect_ref': 'BASE_HAS_NO_ERASABLE_OWNER', 'edit_count': 0, 'hit': d_map(hit)}
        owner = hit['owner']['voxel_ref']
        after = state.model_copy(update={'occurrences': tuple(item for item in state.occurrences if item.voxel_ref != owner)})
        return {'state': after, 'effect_ref': 'VISIBLE_OWNER_ERASURE', 'edit_count': 1,
            'hit': d_map(hit), 'erased_voxel_ref': owner, 'surviving_cubes_not_settled': True}
    if model.create_effect_ref not in ('add_adjacent', 'move_face_owner_to_adjacent', 'recolor_visible_owner'):
        raise VoxelPrerequisite('CONTEXTUAL_SOURCE_CREATE_EFFECT_LAW_REQUIRED')
    owner = refs[hit['owner']['voxel_ref']] if hit['kind_ref'] == 'FACE_INTERIOR' else None
    destination = _add(owner.cell, tuple(hit['owner']['normal'])) if owner is not None else hit['base_port'].destination
    if model.create_effect_ref == 'recolor_visible_owner':
        if owner is None:
            return {'state': state, 'effect_ref': 'NO_RECOLORABLE_BASE_OWNER', 'edit_count': 0, 'hit': d_map(hit)}
        if not model.material_cycle or len(set(model.material_cycle)) != len(model.material_cycle) or owner.material_ref not in model.material_cycle:
            raise VoxelPrerequisite('EXPLICIT_MATERIAL_CYCLE_REQUIRED')
        material = model.material_cycle[(model.material_cycle.index(owner.material_ref) + 1) % len(model.material_cycle)]
        after = state.model_copy(update={'occurrences': tuple(item.model_copy(update={'material_ref': material}) if item.voxel_ref == owner.voxel_ref else item for item in state.occurrences)})
        return {'state': after, 'effect_ref': 'VISIBLE_OWNER_RECOLOR', 'edit_count': 1, 'hit': d_map(hit)}
    if destination not in domain:
        if model.game_boundary_law_ref == 'refuse_outside_confirmed_logical_domain':
            return {'state': state, 'effect_ref': 'CONFIRMED_LOGICAL_BOUNDARY_REFUSAL', 'edit_count': 0, 'hit': d_map(hit)}
        raise DComputationInterrupted('LOGICAL_QUERY_BOX_DOES_NOT_COVER_PORT_DESTINATION', d_map({'destination': destination}))
    if destination in occupied:
        return {'state': state, 'effect_ref': 'OCCUPIED_DESTINATION_REFUSAL', 'edit_count': 0, 'hit': d_map(hit)}
    if model.create_effect_ref == 'move_face_owner_to_adjacent':
        if owner is None:
            raise VoxelPrerequisite('BASE_MOVE_WITHOUT_VISIBLE_OWNER_REQUIRES_SEPARATE_LAW')
        after = state.model_copy(update={'occurrences': tuple(item.model_copy(update={'cell': destination}) if item.voxel_ref == owner.voxel_ref else item for item in state.occurrences)})
        return {'state': after, 'effect_ref': 'VISIBLE_OWNER_LOGICAL_TRANSLATION', 'edit_count': 1, 'hit': d_map(hit)}
    if not primitive.new_voxel_ref or primitive.new_voxel_ref in refs or not primitive.material_ref:
        raise VoxelPrerequisite('SOURCE_NEW_OCCURRENCE_IDENTITY_AND_MATERIAL_REQUIRED')
    if len(state.occurrences) >= min(128, budget.request.domain_bound):
        raise DComputationInterrupted('NEW_LOGICAL_OCCURRENCE_COMPUTATION_CAPACITY_BOUND', d_map())
    occurrence = VoxelOccurrence(voxel_ref=primitive.new_voxel_ref, cell=destination, material_ref=primitive.material_ref)
    after = state.model_copy(update={'occurrences': state.occurrences + (occurrence,)})
    return {'state': after, 'effect_ref': 'ADJACENT_OR_BASE_CREATION', 'edit_count': 1, 'hit': d_map(hit),
        'created_occurrence': occurrence, 'adjacency_is_not_gravity_support': True}


def _external(model, state, primitive, request, budget):
    _state(model, state, budget)
    if primitive.kind_ref == 'reset':
        if primitive.point is not None or primitive.tool_ref is not None or primitive.new_voxel_ref is not None or primitive.material_ref is not None or model.reset_state is None or model.reset_cost is None:
            raise VoxelPrerequisite('INDEPENDENT_BOUND_RESET_RESTORATION_REQUIRED')
        _state(model, model.reset_state, budget)
        return {'before_state': state, 'voxel_input': primitive,
            'state': model.reset_state, 'primitive_complete': True,
            'phase_snapshots': d_map({'before': state, 'independent_reset': model.reset_state}),
            'closure_facts': d_map({'independent_reset_complete': True}),
            'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'debit': model.reset_cost, 'accepted': False, 'automatic_pass_count': 0})}
    if state.terminated:
        raise VoxelPrerequisite('OFFICIAL_TERMINATION_REVOKES_OLD_EDIT_SCOPE')
    costs = dict(model.input_costs)
    if len(costs) != len(model.input_costs) or primitive.kind_ref not in costs or any(costs[key] < 0 for key in sorted(costs)):
        raise VoxelPrerequisite('ACTUAL_NATIVE_TOOL_POINT_COST_RELATION_REQUIRED')
    if model.terminal_equivalence_ref != 'supported_sampled_reference_match_is_terminal' or model.terminal_order_ref not in ('acceptance_before_exhaustion', 'exhaustion_before_acceptance'):
        raise VoxelPrerequisite('TERMINAL_VIEW_EQUIVALENCE_AND_COST_ORDER_REQUIRED')
    direct = _edit(model, state, primitive, budget)
    after_direct = direct['state']
    rendered = _render(model, after_direct, model.view_projection, budget, native=True)
    comparison = _views(model, after_direct, budget)
    reserve = max(0, state.reserve - costs[primitive.kind_ref])
    exhausted = reserve == 0
    accepted = comparison['some_supported_reference_matches'] and (model.terminal_order_ref == 'acceptance_before_exhaustion' or not exhausted)
    after = after_direct.model_copy(update={'reserve': reserve, 'terminated': accepted or exhausted})
    return {'before_state': state, 'voxel_input': primitive,
        'state': after, 'direct_effect': d_map(direct), 'native_render': d_map(rendered),
        'view_comparison': d_map(comparison), 'primitive_complete': True,
        'phase_snapshots': d_map({'before': state, 'after_edit': after_direct, 'after_view_check': after_direct, 'after_cost_and_verdict': after}),
        'closure_facts': d_map({'edit_complete': True, 'logical_population_accounted_for': True,
            'native_render_complete': True, 'view_equivalence_complete': True, 'cost_and_verdict_complete': True}),
        'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'debit': costs[primitive.kind_ref],
            'edit_count': direct['edit_count'], 'input_count': 1, 'automatic_pass_count': 1,
            'accepted': accepted, 'exhausted': exhausted, 'second_edit_or_render_pass_forbidden': True,
            'second_debit_forbidden': True})}


def _successor(model, state, primitive, budget):
    direct = _edit(model, state, primitive, budget)
    rendered = _render(model, direct['state'], model.view_projection, budget, native=True)
    return {'before_state': state, 'voxel_input': primitive,
        'state': direct['state'], 'direct_effect': d_map(direct), 'visible_faces_after': d_map(rendered),
        'edit_count': direct['edit_count'], 'input_count': 1, 'gravity_or_settling_applied': False,
        'physical_transport_executed': False}


def _inverse(model, request, budget):
    if not request.assemblies or len(request.assemblies) > request.domain_bound:
        raise VoxelPrerequisite('BOUNDED_SOURCE_ASSEMBLY_DOMAIN_REQUIRED')
    rows = []
    for index, assembly in enumerate(request.assemblies):
        budget.visit({'assembly_index': index})
        comparison = _views(model, assembly, budget)
        rows.append(d_map({'assembly_index': index, 'logical_assembly': assembly, 'view_comparison': d_map(comparison),
            'compatible': comparison['some_supported_reference_matches'], 'hidden_volume_retained': True}))
    return {'assembly_view_domains': tuple(rows), 'supplied_assembly_count': len(request.assemblies),
        'complete_in_supplied_assembly_domain': True,
        'query_volume_cap_not_game_law': True, 'authored_occupancy_not_required': True}


def _dependencies(model, request, budget):
    refs, occupied, domain = _state(model, request.state, budget)
    if model.create_effect_ref != 'add_adjacent' or not request.desired_additions:
        raise VoxelPrerequisite('SOURCE_ADDITION_CONSUMERS_AND_ADJACENT_CREATE_LAW_REQUIRED')
    rendered = _render(model, request.state, model.view_projection, budget, native=True)
    rows = []
    for addition in request.desired_additions:
        budget.visit({'addition_ref': addition.voxel_ref})
        if addition.cell not in domain:
            raise DComputationInterrupted('LOGICAL_QUERY_BOX_DOES_NOT_COVER_ADDITION', d_map())
        if addition.cell in occupied:
            rows.append(d_map({'addition_ref': addition.voxel_ref, 'already_occupied': True, 'supplier_alternatives': ()}))
            continue
        suppliers = []
        for port in model.base_ports:
            if port.destination == addition.cell:
                visible = tuple(point for point in port.interior_pixels if _hit(model, request.state, point, budget)['kind_ref'] == 'BASE_INTERIOR')
                suppliers.append(d_map({'base_port_ref': port.port_ref, 'visible_native_pixels': visible,
                    'required_occupancy': None, 'exposure_needed': not bool(visible)}))
        for normal in model.view_projection.face_order:
            cell = tuple(addition.cell[index] - normal[index] for index in range(3))
            if cell not in domain:
                continue
            owner = occupied.get(cell)
            face = next((face for face in rendered['face_domains'] if owner is not None and face['voxel_ref'] == owner.voxel_ref and face['normal'] == normal), None)
            suppliers.append(d_map({'supplier_cell': cell, 'supplier_normal': normal,
                'supplier_voxel_ref': owner.voxel_ref if owner is not None else None,
                'required_occupancy': cell if owner is None else None,
                'visible_native_pixels': face['clickable_pixels'] if face is not None else (),
                'occluding_voxel_refs': face['occluding_voxel_refs'] if face is not None else (),
                'exposure_needed': face is None or not face['clickable_pixels'], 'physical_support_not_inferred': True}))
        if addition.voxel_ref in refs:
            raise VoxelPrerequisite('ADDITION_IDENTITY_ALREADY_IN_CURRENT_OCCUPANCY')
        after = request.state.model_copy(update={'occurrences': request.state.occurrences + (addition,)})
        new_render = _render(model, after, model.view_projection, budget, native=True)
        new_ports = {(face['voxel_ref'], tuple(face['normal'])) for face in new_render['face_domains'] if face['clickable_pixels']}
        lost = tuple((face['voxel_ref'], face['normal']) for face in rendered['face_domains'] if face['clickable_pixels'] and (face['voxel_ref'], tuple(face['normal'])) not in new_ports)
        rows.append(d_map({'addition_ref': addition.voxel_ref, 'already_occupied': False,
            'supplier_alternatives': tuple(suppliers), 'currently_usable_ports_lost_after_addition': lost,
            'supplier_may_be_hidden_after_service': True, 'restoration_selected': False}))
    return {'conditional_addition_port_graph': tuple(rows), 'preparation_route_proved': False}


def _clicks(model, request, budget):
    if request.intended_owner_ref is None or not request.bindings:
        raise VoxelPrerequisite('SOURCE_OWNER_FACE_AND_NATIVE_POINT_BINDINGS_REQUIRED')
    if request.intended_normal is None and request.state.tool_ref == 'CREATE':
        raise VoxelPrerequisite('CREATE_CLICK_REQUIRES_SOURCE_REQUESTED_FACE_NORMAL')
    rendered = _render(model, request.state, model.view_projection, budget, native=True)
    interior = frozenset(row['point'] for row in rendered['pixel_ownership'] if row['voxel_ref'] == request.intended_owner_ref
        and (request.intended_normal is None or row['normal'] == request.intended_normal) and row['clickable_interior'])
    boundary = frozenset(point for point in interior if any((point[0] + dr, point[1] + dc) not in interior for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1))))
    rows = []
    for binding in request.bindings:
        budget.visit({'native_support_ref': binding.native_support_ref})
        if binding.evidence_revision_ref != request.scope.evidence_revision_ref or binding.projection_ref != model.view_projection.projection_ref:
            raise VoxelPrerequisite('CURRENT_OR_CERTIFIED_PREDICTED_PROJECTION_BINDING_REQUIRED')
        primitive = binding.primitive
        if primitive.kind_ref != 'point' or primitive.point not in interior:
            continue
        margin = min(abs(primitive.point[0] - point[0]) + abs(primitive.point[1] - point[1]) for point in boundary)
        normal = next(row['normal'] for row in rendered['pixel_ownership'] if row['point'] == primitive.point)
        rows.append(d_map({'native_point': primitive.point, 'action_ref': binding.action_ref, 'payload': binding.payload,
            'owner_ref': request.intended_owner_ref, 'normal': normal,
            'native_support_ref': binding.native_support_ref, 'hit_margin_pixels': margin,
            'weak_margin': margin == 0, 'primitive_release_authorized': False}))
    return {'visible_owned_interior_binding_domain': tuple(rows),
        'native_ownership': rendered['pixel_ownership'], 'hidden_owner_not_clickable': True}


def _domain(model, request, budget):
    if not request.native_input_domain_complete or not request.native_inputs or len(request.native_inputs) > request.domain_bound:
        raise VoxelPrerequisite('SOURCE_COMPLETE_BOUNDED_NATIVE_EDIT_INPUT_DOMAIN_REQUIRED')
    rows = []
    for primitive in request.native_inputs:
        budget.visit({'native_input_index': len(rows)})
        image = _external(model, request.state, primitive, request, budget)
        rows.append(d_map({'primitive': primitive, 'complete_native_successor': d_map(image)}))
    return {'joint_native_edit_domain': tuple(rows), 'complete_in_source_input_domain': True,
        'hidden_depth_not_bounded_by_screen_pixels': True, 'global_k09_search_executed': False,
        'occupancy_depth_material_and_tool_retained': True}


def _fit_compare(model, request, budget, fit):
    if not request.observations:
        raise VoxelPrerequisite('SEALED_POPULATION_FACE_MODE_AND_VIEW_PACKETS_REQUIRED')
    rows, first = [], None
    for index, sample in enumerate(request.observations):
        budget.visit({'packet_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise VoxelPrerequisite('CONSTRUCTION_PACKET_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('before_state', 'primitive', 'actual_state', 'observed_native_pixels')):
            raise VoxelPrerequisite('ACTUAL_EDIT_INPUT_STATE_AND_VISIBLE_PIXEL_EVIDENCE_REQUIRED')
        before = VoxelState.model_validate(sample['before_state'])
        actual = VoxelState.model_validate(sample['actual_state'])
        primitive = VoxelInput.model_validate(sample['primitive'])
        _state(model, actual, budget)
        image = _external(model, before, primitive, request, budget)
        expected = image['state']
        actual_refs = {item.voxel_ref: d_map(item) for item in actual.occurrences}
        expected_refs = {item.voxel_ref: d_map(item) for item in expected.occurrences}
        different = tuple(ref for ref in sorted(set(actual_refs) | set(expected_refs)) if actual_refs.get(ref) != expected_refs.get(ref))
        fields = tuple(field for field in ('tool_ref', 'reserve', 'terminated') if getattr(actual, field) != getattr(expected, field))
        unknown = frozenset(model.unowned_opaque_pixels)
        observed = {tuple(point): value for point, value in sample['observed_native_pixels'] if tuple(point) not in unknown}
        native_render = image.get('native_render')
        if native_render is None:
            native_render = _render(model, expected, model.view_projection, budget, native=True)
        predicted = {tuple(point): value for point, value in native_render['pixel_values']}
        view_matches = observed == predicted
        scene_matches = True
        if not fit:
            if sample.get('scene_transition_ref') is None or sample.get('expected_scene_transition_ref') is None:
                raise VoxelPrerequisite('ACTUAL_EXPECTED_SCENE_BOUNDARY_REQUIRED')
            scene_matches = sample['scene_transition_ref'] == sample['expected_scene_transition_ref']
            if sample['scene_transition_ref'] != 'no_scene_transition' and sample.get('next_scene_observation') is None:
                raise VoxelPrerequisite('NEXT_SCENE_OBSERVATION_AFTER_OFFICIAL_BOUNDARY_REQUIRED')
        if first is None and (different or fields or not view_matches or not scene_matches):
            first = index
        rows.append(d_map({'packet_index': index, 'logical_population_difference_refs': different,
            'control_difference_fields': fields, 'observed_native_view_matches': view_matches,
            'scene_matches': scene_matches, 'predicted_reference_comparison': image.get('view_comparison'),
            'next_scene_observation': sample.get('next_scene_observation'), 'repeated_last_event_not_a_new_edit': True,
            'unobserved_boundary_laws_not_confirmed': True, 'green_frame_not_an_official_victory_proof': True}))
    return {'sealed_voxel_constraints': tuple(rows), 'first_divergence_index': first}


def measure_visible_voxel_construction(request: VisibleVoxelRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget, rows, current_model_ref = DWorkBudget(request), [], None
    operation = request.operation_ref.rsplit('.', 1)[-1]
    try:
        if operation == 'projected_unit_measure':
            d_resume_rows(request, ())
            calibrated = measure_voxel_projection_d(request, budget)
            budget.finish()
            return d_result(request, 'OK', 'EXACT_CURRENT_PROJECTED_GEOMETRY_MEASUREMENTS',
                values={'frame_ref': request.frame_ref, 'projection_calibration_alternatives': calibrated},
                complete=True, examined=budget.examined)
        if not request.models or request.state is None:
            raise VoxelPrerequisite('SCOPED_PROJECTION_DEPTH_EDIT_MODELS_AND_OCCUPANCY_REQUIRED')
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            if operation == 'legend_reconstruction_domain':
                row = _inverse(model, request, budget)
            elif operation == 'visible_face_ownership':
                row = _render(model, request.state, model.view_projection, budget, native=True)
            elif operation == 'cropped_view_equivalence':
                row = _views(model, request.state, budget)
            elif operation == 'construction_port_dependencies':
                row = _dependencies(model, request, budget)
            elif operation == 'visible_face_click_compile':
                row = _clicks(model, request, budget)
            elif operation == 'bounded_view_repair_paths':
                row = _domain(model, request, budget)
            elif operation in ('face_edit_law_fit', 'sealed_construction_compare'):
                row = _fit_compare(model, request, budget, operation == 'face_edit_law_fit')
            elif operation in ('voxel_edit_successor', 'external_primitive'):
                if request.primitive is None:
                    raise VoxelPrerequisite('BOUND_ACTUAL_VISIBLE_FACE_EDIT_INPUT_REQUIRED')
                row = _successor(model, request.state, request.primitive, budget) if operation == 'voxel_edit_successor' else _external(model, request.state, request.primitive, request, budget)
            else:
                return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'OK', 'EXACT_SCOPED_VISIBLE_VOXEL_COMPUTATION', values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except VoxelPrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
