"""Physical observation contracts shared by conscious producers and consumers.

These immutable records retain their exact fields and geometry helpers. They
carry observations, never meaning, priority, a goal or an execution permit.
Keeping them independent of measurement algorithms allows consumers to validate
the same nominal structures after Source serialization.
"""
from __future__ import annotations

from pydantic_core import core_schema
from agents.yf_arc3_v5.logos.types import FrozenMap, restore_nominal_dataclass_input
from dataclasses import dataclass
from .cell_deltas import CellDeltaPacket


@dataclass(frozen=True)
class UniformLattice:
    rows: tuple[int, ...]
    columns: tuple[int, ...]
    extent: int
    values: tuple[tuple[int, ...], ...]

    def point(self, row, column):
        return (self.rows[row] + (self.extent - 1)//2,
                self.columns[column] + (self.extent - 1)//2)

    def contains(self, box):
        return (box.top >= self.rows[0] and box.bottom < self.rows[-1] + self.extent
                and box.left >= self.columns[0] and box.right < self.columns[-1] + self.extent)


@dataclass(frozen=True)
class PeriodicDelta:
    field: UniformLattice
    mapped_values: tuple[tuple[int, ...], ...]
    after_frame_hash: str
    point: tuple[int, int]
    before_value: int
    after_value: int
    mapped_value: int
    other_cell_changes: int
    residual_delta: int
    peripheral_quantity_delta: int


@dataclass(frozen=True)
class ReflectionDelta:
    field: UniformLattice
    projected_values: tuple[tuple[int, ...], ...] | None
    after_frame_hash: str
    point: tuple[int, int]
    before_value: int
    after_value: int
    other_cell_changes: int
    residual_delta: int
    exact_description_count: int
    distinct_projection_count: int
    minimum_concordance: int
    minimum_count_difference: int
    transform_refs: tuple[str, ...]
    boundary_rectangular_decreasing_value_count: int
    boundary_rectangular_quantity_decrease_magnitude: int
    boundary_rectangular_decreasing_values: tuple[int, ...]
    pair_projected_values: tuple[tuple[int, ...], ...] | None = None
    pair_omitted_values: tuple[int, ...] = ()
    pair_inventory_complete: bool = False
    pair_exact_description_count: int = 0
    pair_distinct_projection_count: int = 0
    pair_minimum_concordance: int = 0
    pair_minimum_count_difference: int = 0
    pair_residual_delta: int = 0
    pair_transform_refs: tuple[str, ...] = ()


@dataclass(frozen=True)
class ContourDelta:
    two_removed_one_added_boxes: tuple[tuple[int, int, int, int], ...] = ()
    one_removed_many_added_boxes: tuple[tuple[int, int, int, int], ...] = ()
    two_removed_one_added_count: int = 0
    one_removed_many_added_count: int = 0
    added_closed_contour_identities: tuple[tuple[int, int, int, int, int], ...] = ()


@dataclass(frozen=True)
class AxialPacketMeasure:
    action_ref: str
    field_top: int
    field_left: int
    column: int
    value: int
    prior_value: int | None
    distinct_row_positions: tuple[int, ...]
    final_cell_row: int
    retained: bool
    restored: bool
    other_final_changed_pixels: int
    other_peak_changed_pixels: int
    before_field_hash: str
    after_field_hash: str
    score_delta: int
    final_inserted_cell_line_lengths: tuple[int, ...] = ()
    additional_inserted_cell_values: tuple[int, ...] = ()
    field_geometry: tuple[int, ...] = ()


@dataclass(frozen=True)
class RasterBox:
    top: int
    left: int
    height: int
    width: int
    value: int
    visible_sides: int

    @property
    def interior(self) -> tuple[int, int, int, int]:
        return self.top + 1, self.left + 1, self.height - 2, self.width - 2


@dataclass(frozen=True)
class MaskPose:
    clockwise_quarters: int
    window_row: int
    window_col: int
    observed_cell_count: int
    row_delta: int
    col_delta: int


@dataclass(frozen=True)
class LayerCorrespondence:
    value: int
    extra_value: int
    external_cell_count: int
    poses: tuple[MaskPose, ...]
    maximal_observed_match_count: int
    current_patch_difference_count: int


@dataclass(frozen=True)
class LayerField:
    first_box: RasterBox
    second_box: RasterBox
    background_value: int
    extra_value: int
    layers: tuple[LayerCorrespondence, ...]
    exact_current_pattern_difference_count: int


@dataclass(frozen=True)
class LayerRasterSample:
    fields: tuple[LayerField, ...]
    patch_hashes: tuple[tuple[RasterBox, str], ...]


@dataclass(frozen=True)
class LayerTransitionMeasure:
    action_ref: str
    before: LayerRasterSample
    after: LayerRasterSample
    point_value: int | None
    added_marker_value: int | None
    changed_pixel_count: int
    # (value, clockwise turn, row translation, column translation)
    motions: tuple[tuple[int, int, int, int], ...]
    intersection_observed_count: int
    intersection_mismatch_count: int


@dataclass(frozen=True)
class SparseRasterTransition:
    """Observed small-component translations beside other raster changes.

    A translated component is not automatically a controlled material body.
    Coordinates and palette values come exclusively from the observation pair.
    """
    action_ref: str
    before_digest: str
    after_digest: str
    point: tuple[int, int] | None
    # value, old top/left/height/width, row/column displacement, exact area
    small_component_translations: tuple[tuple[int, int, int, int, int, int, int, int], ...]
    # row, column, before value, after value; complete, never a truncated prefix
    changed_cells: tuple[tuple[int, int, int, int], ...]
    other_changed_cells: tuple[tuple[int, int, int, int], ...]
    changed_cell_count: int | None = None
    changed_cells_complete: bool = True
    small_component_translation_count: int | None = None
    small_component_translations_complete: bool = True
    # top, left, extent, contour value, uniform interior value, contour area.
    # None is unmeasured; an empty tuple is measured absence.
    before_square_contours: tuple[tuple[int, int, int, int, int, int], ...] | None = None
    after_square_contours: tuple[tuple[int, int, int, int, int, int], ...] | None = None
    before_singleton_positions: tuple[tuple[int, int, int], ...] | None = None
    after_singleton_positions: tuple[tuple[int, int, int], ...] | None = None
    # top, left, extent, uniform value, optional distinct center pixel.
    before_uniform_square_patches: tuple[tuple[int, int, int, int, int | None], ...] | None = None
    before_outline_diagram_measurement: FrozenMap | None = None
    after_outline_diagram_measurement: FrozenMap | None = None


@dataclass(frozen=True)
class MarkedSquare:
    top: int
    left: int
    size: int
    value: int
    marker_value: int
    offsets: tuple[tuple[int, int], ...]

    @property
    def position(self) -> tuple[int, int]:
        return self.top, self.left


@dataclass(frozen=True)
class SquareField:
    squares: tuple[MarkedSquare, ...]
    stride: int
    size: int
    row_phase: int
    col_phase: int


@dataclass(frozen=True)
class OrderedSquareChange:
    square: MarkedSquare
    first_marker_loss: int | None
    first_marker_preserving_recolor: int | None
    final_matches_initial: bool


@dataclass(frozen=True)
class OrderedSquarePacket:
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        return core_schema.no_info_before_validator_function(
            restore_nominal_dataclass_input, handler(source_type)
        )

    action_ref: str
    field: SquareField
    changes: tuple[OrderedSquareChange, ...]
    frame_count: int
    distinct_loss_step_count: int
    equal_cardinality_external_component_group_count: int
    cell_changes: CellDeltaPacket
