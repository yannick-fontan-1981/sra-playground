"""Source-bound cell cores and occurrence identity; no creator packing or raster roles."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .indexed_panel_measurement_d import DPanelLayout

Cell = tuple[int, int]


class PackingCellCore(FrozenModel):
    cell: Cell
    bounds: tuple[int, int, int, int]
    evidence_ref: Ref


class PackingFilledSample(FrozenModel):
    local_cell: Cell
    native_samples: tuple[tuple[int, int, int], ...] = Field(min_length=1, max_length=4096)
    evidence_ref: Ref


class PackingInventoryDrawing(FrozenModel):
    drawing_ref: Ref
    source_partition_ref: Literal['BOARD', 'RESERVE', 'HELD_PREVIEW']
    anchor: Cell
    full_mask: tuple[Cell, ...] = Field(min_length=1, max_length=128)
    full_mask_claim_ref: Ref
    filled_samples: tuple[PackingFilledSample, ...] = Field(default=(), max_length=128)
    occluded_local_cells: tuple[Cell, ...] = Field(default=(), max_length=128)


class PackingInventoryOccurrence(FrozenModel):
    piece_ref: Ref
    identity_claim_ref: Ref
    drawings: tuple[PackingInventoryDrawing, ...] = Field(min_length=1, max_length=3)


class PackingInventoryLayout(FrozenModel):
    layout_ref: Ref
    evidence_ref: Ref
    lattice_evidence_ref: Ref
    panel: DPanelLayout
    cell_cores: tuple[PackingCellCore, ...] = Field(min_length=1, max_length=4096)
    board_cells: tuple[Cell, ...] = Field(min_length=1, max_length=4096)
    occurrences: tuple[PackingInventoryOccurrence, ...] = Field(min_length=1, max_length=32)
    grid_texture_region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    fixed_decoration_region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    pin_decoration_region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    control_region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    hud_region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    reserve_region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
