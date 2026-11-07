"""Bounded, palette-neutral morphology under Source-supplied calibrations.

Connected visible pixels are not collision masks or roles. Occluded positions
remain unknown; clipped cells and multiple calibration alternatives survive.
"""
from __future__ import annotations
from collections import deque
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .digital_topology import _neighbors
from .mechanical_family_contracts_d import DComputationInterrupted, DResumeMismatch, d_map

Cell = tuple[int, int]
Bounds = tuple[int, int, int, int]


class DSceneCalibration(FrozenModel):
    calibration_ref: Ref
    origin: Cell
    pitch: Cell
    content_extent: Cell
    row_indices: tuple[int, ...] = Field(min_length=1, max_length=128)
    column_indices: tuple[int, ...] = Field(min_length=1, max_length=128)
    evidence_ref: Ref


class DSceneLayerQuestion(FrozenModel):
    layer_ref: Ref
    bounds: Bounds
    palette_values: tuple[int, ...] = Field(min_length=1, max_length=256)
    connectivity: Literal[4, 8]
    grouping: Literal['same_value', 'palette_union']
    calibration_refs: tuple[Ref, ...] = Field(min_length=1, max_length=32)
    evidence_ref: Ref


class DSceneOcclusion(FrozenModel):
    occlusion_ref: Ref
    bounds: Bounds
    evidence_ref: Ref


def _in_bounds(point, bounds):
    return bounds[0] <= point[0] <= bounds[2] and bounds[1] <= point[1] <= bounds[3]


def _validate(frame, calibrations, questions, occlusions, budget):
    if frame is None or not calibrations or not questions:
        raise DResumeMismatch('CURRENT_FRAME_CALIBRATION_AND_LAYER_QUESTIONS_REQUIRED')
    if max(len(calibrations), len(questions), len(occlusions)) > budget.request.domain_bound:
        raise DComputationInterrupted('SCENE_LAYER_INPUT_DOMAIN_BOUND', d_map())
    if len({row.calibration_ref for row in calibrations}) != len(calibrations) or len({row.layer_ref for row in questions}) != len(questions):
        raise DResumeMismatch('UNIQUE_CALIBRATION_AND_LAYER_IDENTITIES_REQUIRED')
    calibration_refs = {row.calibration_ref for row in calibrations}
    for row in calibrations:
        if (not row.evidence_ref or min(row.pitch) <= 0 or min(row.content_extent) <= 0
                or any(extent > pitch for extent, pitch in zip(row.content_extent, row.pitch))
                or len(set(row.row_indices)) != len(row.row_indices) or len(set(row.column_indices)) != len(row.column_indices)):
            raise DResumeMismatch('CURRENT_POSITIVE_LATTICE_CONTENT_PITCH_AND_INDEX_DOMAIN_REQUIRED')
        if len(row.row_indices) * len(row.column_indices) > budget.request.domain_bound:
            raise DComputationInterrupted('CALIBRATION_CELL_DOMAIN_BOUND', d_map())
    for row in (*questions, *occlusions):
        if not row.evidence_ref or row.bounds[0] > row.bounds[2] or row.bounds[1] > row.bounds[3]:
            raise DResumeMismatch('CURRENT_ORDERED_LAYER_OR_OCCLUSION_BOUNDS_REQUIRED')
    for row in questions:
        if not set(row.calibration_refs) <= calibration_refs or len(set(row.palette_values)) != len(row.palette_values):
            raise DResumeMismatch('EXACT_LAYER_CALIBRATION_AND_PALETTE_DOMAIN_REQUIRED')


def measure_scene_layers_d(frame: FrameGrid | None, calibrations, questions, occlusions, budget):
    _validate(frame, calibrations, questions, occlusions, budget)
    calibration_by_ref = {row.calibration_ref: row for row in calibrations}
    layers = []
    for question in questions:
        bounds = question.bounds
        top, left, bottom, right = max(0, bounds[0]), max(0, bounds[1]), min(frame.height - 1, bounds[2]), min(frame.width - 1, bounds[3])
        visible, obscured, pixels_by_value = set(), set(), {}
        for row in range(top, bottom + 1):
            for column in range(left, right + 1):
                budget.visit({'layer_ref': question.layer_ref, 'pixel': (row, column)})
                point = row, column
                blocked = False
                for item in occlusions:
                    budget.visit({'occlusion_ref': item.occlusion_ref, 'pixel': point})
                    if _in_bounds(point, item.bounds):
                        blocked = True
                        break
                if blocked:
                    obscured.add(point)
                    continue
                visible.add(point)
                value = frame.rows[row][column]
                if value in question.palette_values:
                    pixels_by_value.setdefault(value, set()).add(point)
        groups = tuple(pixels_by_value[value] for value in sorted(pixels_by_value)) if question.grouping == 'same_value' else (set().union(*(pixels_by_value[value] for value in sorted(pixels_by_value))),)
        components = []
        for group in groups:
            remaining = set(group)
            while remaining:
                if len(components) >= budget.request.domain_bound:
                    raise DComputationInterrupted('SCENE_COMPONENT_RETURN_DOMAIN_BOUND', d_map())
                start = min(remaining)
                remaining.remove(start)
                queue, component = deque((start,)), {start}
                while queue:
                    point = queue.popleft()
                    budget.visit({'component_pixel': point})
                    for neighbor in _neighbors(point, question.connectivity):
                        if neighbor in remaining:
                            remaining.remove(neighbor)
                            component.add(neighbor)
                            queue.append(neighbor)
                minimum_row, maximum_row = min(point[0] for point in component), max(point[0] for point in component)
                minimum_column, maximum_column = min(point[1] for point in component), max(point[1] for point in component)
                histogram = {}
                for row, column in sorted(component):
                    budget.visit({'signature_pixel': (row, column)})
                    value = frame.rows[row][column]
                    histogram[value] = histogram.get(value, 0) + 1
                components.append(d_map({'pixel_support': tuple(sorted(component)),
                    'bounds': (minimum_row, minimum_column, maximum_row, maximum_column),
                    'relative_pixel_signature': tuple((row - minimum_row, column - minimum_column, frame.rows[row][column]) for row, column in sorted(component)),
                    'area': len(component), 'palette_counts': tuple((value, histogram[value]) for value in sorted(histogram)),
                    'touches_declared_region_edge': any(row in (bounds[0], bounds[2]) or column in (bounds[1], bounds[3]) for row, column in component),
                    'touches_unknown_or_viewport_edge': any(any(neighbor in obscured or neighbor[0] < 0 or neighbor[1] < 0 or neighbor[0] >= frame.height or neighbor[1] >= frame.width for neighbor in _neighbors(point, question.connectivity)) for point in component),
                    'full_collision_support_established': False, 'color_assigns_role': False}))
        correlated = []
        for ref in question.calibration_refs:
            calibration = calibration_by_ref[ref]
            cells = []
            for row_index in calibration.row_indices:
                for column_index in calibration.column_indices:
                    budget.visit({'calibration_ref': ref, 'cell': (row_index, column_index)})
                    cell_top = calibration.origin[0] + row_index * calibration.pitch[0]
                    cell_left = calibration.origin[1] + column_index * calibration.pitch[1]
                    cell_bounds = (cell_top, cell_left, cell_top + calibration.content_extent[0] - 1, cell_left + calibration.content_extent[1] - 1)
                    if cell_bounds[2] < top or cell_bounds[0] > bottom or cell_bounds[3] < left or cell_bounds[1] > right:
                        continue
                    component_hits = []
                    for index, component in enumerate(components):
                        hit_points = []
                        for point in component['pixel_support']:
                            budget.visit({'cell_component_pixel': point})
                            if _in_bounds(point, cell_bounds):
                                hit_points.append(point)
                        hits = tuple(hit_points)
                        if hits:
                            component_hits.append(d_map({'component_index': index, 'intersecting_pixels': hits}))
                    known_points, unknown_points = [], []
                    for points, output in ((visible, known_points), (obscured, unknown_points)):
                        for point in sorted(points):
                            budget.visit({'cell_visibility_pixel': point})
                            if _in_bounds(point, cell_bounds):
                                output.append(point)
                    known, unknown = tuple(known_points), tuple(unknown_points)
                    cells.append(d_map({'cell_index': (row_index, column_index), 'content_bounds': cell_bounds,
                        'visible_pixels': known, 'occluded_pixels': unknown, 'component_intersections': tuple(component_hits),
                        'clipped_by_viewport_or_question': cell_bounds[0] < top or cell_bounds[1] < left or cell_bounds[2] > bottom or cell_bounds[3] > right,
                        'terrain_behind_occlusion_unobserved': bool(unknown),
                        'empty_visible_component_set_not_free_terrain_proof': True}))
            correlated.append(d_map({'calibration_ref': ref, 'cell_contents': tuple(cells),
                'gap_extent': tuple(pitch - extent for pitch, extent in zip(calibration.pitch, calibration.content_extent)),
                'calibration_or_cell_roles_selected': False}))
        layers.append(d_map({'layer_ref': question.layer_ref, 'requested_bounds': bounds,
            'visible_components': tuple(components), 'occluded_pixel_support': tuple(sorted(obscured)),
            'calibration_correlated_layers': tuple(correlated), 'body_marker_terrain_semantics_unresolved': True}))
    budget.finish()
    return tuple(layers)
