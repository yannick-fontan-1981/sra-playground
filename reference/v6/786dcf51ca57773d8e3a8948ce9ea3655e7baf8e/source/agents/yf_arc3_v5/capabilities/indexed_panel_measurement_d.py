"""Exact Source-bound panel/slot rasters, sampling and marker comparisons.

No decorative texture becomes a movement grid. Unknown pixels preserve index
alternatives; remembering a picture does not select its control slot.
"""
from __future__ import annotations
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DResumeMismatch, DComputationInterrupted, d_map

Bounds = tuple[int, int, int, int]


class DPanelRegion(FrozenModel):
    region_ref: Ref
    purpose_ref: Literal['PHOTO', 'REFERENCE', 'STRIP', 'CONTROL', 'BORDER', 'QUESTION_CARD', 'PROPOSAL', 'BOARD_CELL']
    bounds: Bounds
    content_bounds: Bounds
    row_scale: int = Field(ge=1, le=256)
    column_scale: int = Field(ge=1, le=256)
    sampling_law_ref: Ref
    evidence_ref: Ref


class DIndexedPanelSlot(FrozenModel):
    slot_ref: Ref
    index: int = Field(ge=0, le=4095)
    region_ref: Ref
    content_status_ref: Literal['VISIBLE', 'UNKNOWN', 'MISSING']
    marker_samples: tuple[tuple[int, int, int], ...] = Field(default=(), max_length=4096)
    marker_evidence_ref: Ref | None = None


class DPanelLayout(FrozenModel):
    layout_ref: Ref
    scene_ref: Ref
    evidence_ref: Ref
    regions: tuple[DPanelRegion, ...] = Field(min_length=1, max_length=128)
    slots: tuple[DIndexedPanelSlot, ...] = Field(default=(), max_length=256)
    native_click_supports: tuple[tuple[Ref, tuple[int, int]], ...] = Field(default=(), max_length=4096)
    active_marker_law_ref: Ref | None = None
    slot_order_axis_ref: Literal['ROW', 'COLUMN']
    slot_order_direction: Literal[-1, 1]


def _contains(outer, inner):
    return outer[0] <= inner[0] <= inner[2] <= outer[2] and outer[1] <= inner[1] <= inner[3] <= outer[3]


def _sample(frame, bounds, budget, label):
    rows, unknown = [], []
    area = (bounds[2] - bounds[0] + 1) * (bounds[3] - bounds[1] + 1)
    if area > budget.request.domain_bound:
        raise DComputationInterrupted('PANEL_PIXEL_DOMAIN_BOUND', d_map({'region_ref': label}))
    for row in range(bounds[0], bounds[2] + 1):
        values = []
        for column in range(bounds[1], bounds[3] + 1):
            budget.visit({'panel_region_ref': label, 'native_pixel': (row, column)})
            value = frame.rows[row][column] if 0 <= row < frame.height and 0 <= column < frame.width else None
            if value is None:
                unknown.append((row, column))
            values.append(value)
        rows.append(tuple(values))
    return tuple(rows), tuple(unknown)


def _validate_layout(layout, budget):
    regions = {row.region_ref: row for row in layout.regions}
    if (not layout.evidence_ref or len(regions) != len(layout.regions)
            or len({slot.slot_ref for slot in layout.slots}) != len(layout.slots)
            or len({slot.index for slot in layout.slots}) != len(layout.slots)):
        raise DResumeMismatch('UNIQUE_CURRENT_PANEL_REGION_AND_SLOT_IDENTITIES_REQUIRED')
    if max(len(layout.regions), len(layout.slots), len(layout.native_click_supports)) > budget.request.domain_bound:
        raise DComputationInterrupted('PANEL_LAYOUT_DOMAIN_BOUND', d_map())
    for region in layout.regions:
        if not region.evidence_ref or not _contains(region.bounds, region.content_bounds):
            raise DResumeMismatch('CONTENT_REGION_NOT_INSIDE_ITS_DECLARED_PANEL')
        if region.sampling_law_ref not in ('native_pixels', 'uniform_integer_blocks'):
            raise DResumeMismatch('EXPLICIT_NATIVE_OR_UNIFORM_BLOCK_SAMPLING_LAW_REQUIRED')
        if region.sampling_law_ref == 'native_pixels' and (region.row_scale != 1 or region.column_scale != 1):
            raise DResumeMismatch('NATIVE_PIXEL_SAMPLING_CANNOT_INVENT_SCALE')
    for slot in layout.slots:
        if slot.region_ref not in regions:
            raise DResumeMismatch('INDEXED_SLOT_PANEL_NOT_CURRENT')
    for ref, point in layout.native_click_supports:
        if ref not in regions or not _contains(regions[ref].bounds, (point[0], point[1], point[0], point[1])):
            raise DResumeMismatch('NATIVE_CLICK_SUPPORT_NOT_INSIDE_ITS_DECLARED_PANEL')
    return regions


def _ordered_slots(layout, regions):
    axis = 0 if layout.slot_order_axis_ref == 'ROW' else 1
    positions = tuple((regions[slot.region_ref].bounds[axis] + regions[slot.region_ref].bounds[axis + 2], slot) for slot in layout.slots)
    if len({coordinate for coordinate, _ in positions}) != len(positions):
        raise DResumeMismatch('SLOT_ORDER_NOT_UNAMBIGUOUS_UNDER_DECLARED_AXIS')
    return tuple(slot for _, slot in sorted(positions, key=lambda row: row[0] * layout.slot_order_direction))


def measure_panel_regions_d(frame, layouts, budget):
    if frame is None or not layouts:
        raise DResumeMismatch('CURRENT_FRAME_AND_PANEL_LAYOUT_ALTERNATIVES_REQUIRED')
    if len(layouts) > budget.request.domain_bound or len({row.layout_ref for row in layouts}) != len(layouts):
        raise DResumeMismatch('BOUNDED_UNIQUE_PANEL_LAYOUT_ALTERNATIVES_REQUIRED')
    results = []
    for layout in layouts:
        region_map = _validate_layout(layout, budget)
        regions = []
        for region in layout.regions:
            budget.visit({'layout_ref': layout.layout_ref, 'region_ref': region.region_ref})
            raster, unknown = _sample(frame, region.content_bounds, budget, region.region_ref)
            height, width = len(raster), len(raster[0])
            rs, cs = region.row_scale, region.column_scale
            exact_scale = height % rs == 0 and width % cs == 0 and not unknown
            local = []
            if exact_scale:
                for row in range(0, height, rs):
                    local_row = []
                    for column in range(0, width, cs):
                        value = raster[row][column]
                        for dr in range(rs):
                            for dc in range(cs):
                                budget.visit({'sampling_native_pixel': (row + dr, column + dc)})
                                exact_scale = exact_scale and raster[row + dr][column + dc] == value
                        local_row.append(value)
                    local.append(tuple(local_row))
            regions.append(d_map({'region_ref': region.region_ref, 'source_purpose_ref': region.purpose_ref,
                'panel_bounds': region.bounds, 'content_bounds': region.content_bounds,
                'native_content_raster': raster, 'unknown_native_pixels': unknown,
                'sampling_compatible': exact_scale, 'local_raster': tuple(local) if exact_scale else None,
                'local_content_dimensions': (height // rs, width // cs) if exact_scale else None,
                'local_to_native': d_map({'row_origin': region.content_bounds[0], 'column_origin': region.content_bounds[1], 'row_scale': rs, 'column_scale': cs}),
                'search_domain_allowed_by_source_partition': region.purpose_ref == 'PHOTO',
                'reference_is_search_domain': False, 'texture_is_movement_grid': False}))
        results.append(d_map({'layout_ref': layout.layout_ref, 'scene_ref': layout.scene_ref,
            'regions': tuple(regions), 'native_click_supports': layout.native_click_supports,
            'ordered_slots': tuple(d_map(slot) for slot in _ordered_slots(layout, region_map)),
            'missing_slots_not_compacted': True, 'source_partition_not_new_role_assignment': True}))
    budget.finish()
    return tuple(results)


def measure_indexed_control_d(frame, layouts, budget):
    if frame is None or not layouts:
        raise DResumeMismatch('CURRENT_FRAME_AND_INDEXED_CONTROL_LAYOUTS_REQUIRED')
    results = []
    for layout in layouts:
        regions = _validate_layout(layout, budget)
        if not layout.slots or layout.active_marker_law_ref != 'exact_declared_samples_one_current_slot':
            raise DResumeMismatch('EXPLICIT_CURRENT_SLOT_ORDER_AND_ACTIVE_MARKER_LAW_REQUIRED')
        rows, matches, unknown_indices = [], [], []
        for slot in _ordered_slots(layout, regions):
            region = regions[slot.region_ref]
            if region.purpose_ref not in ('STRIP', 'CONTROL', 'QUESTION_CARD', 'PROPOSAL'):
                raise DResumeMismatch('SLOT_ACTIVE_MARKING_CANNOT_USE_UNRELATED_SCENE_PATCH')
            if not slot.marker_samples or not slot.marker_evidence_ref:
                raise DResumeMismatch('CURRENT_SLOT_MARKER_SUPPORT_AND_SIGNATURE_REQUIRED')
            actual, known, compatible = [], True, True
            for dr, dc, expected in slot.marker_samples:
                budget.visit({'slot_ref': slot.slot_ref, 'marker_local_pixel': (dr, dc)})
                point = region.bounds[0] + dr, region.bounds[1] + dc
                if not _contains(region.bounds, (*point, *point)):
                    raise DResumeMismatch('MARKER_SAMPLE_OUTSIDE_ITS_CURRENT_CONTROL')
                value = frame.rows[point[0]][point[1]] if 0 <= point[0] < frame.height and 0 <= point[1] < frame.width else None
                actual.append((point, value, expected))
                if value is None:
                    known = False
                elif value != expected:
                    compatible = False
            if compatible:
                (matches if known else unknown_indices).append(slot.index)
            rows.append(d_map({'slot_ref': slot.slot_ref, 'index': slot.index, 'native_support': region.bounds,
                'marker_samples': tuple(actual), 'marker_compatible': compatible, 'marker_fully_observed': known,
                'content_status_ref': slot.content_status_ref}))
        possible = tuple(matches + unknown_indices)
        unique = matches[0] if len(matches) == 1 and not unknown_indices else None
        results.append(d_map({'layout_ref': layout.layout_ref, 'scene_ref': layout.scene_ref,
            'ordered_slot_supports': tuple(rows), 'current_active_index': unique,
            'possible_active_indices': possible, 'unknown_marker_indices': tuple(unknown_indices),
            'active_marking_ambiguous_or_missing': unique is None, 'remembered_match_is_not_current_selection': True}))
    budget.finish()
    return tuple(results)
