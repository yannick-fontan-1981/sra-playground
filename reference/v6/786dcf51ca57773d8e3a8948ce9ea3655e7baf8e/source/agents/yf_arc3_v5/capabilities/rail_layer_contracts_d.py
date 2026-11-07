"""Source-bound visible rail layers; annotations are not learned schema laws."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref

Cell = tuple[int, int]


class RailRasterPart(FrozenModel):
    part_ref: Ref
    evidence_ref: Ref
    cells: tuple[Cell, ...] = Field(min_length=1, max_length=4096)
    occluded_cells: tuple[Cell, ...] = Field(default=(), max_length=4096)


class RailLayerBay(FrozenModel):
    bay_ref: Ref
    offset: Cell
    evidence_ref: Ref
    positive_motif: RailRasterPart | None = None
    negative_motif: RailRasterPart | None = None
    content: RailRasterPart | None = None


class RailLayerTrain(FrozenModel):
    train_ref: Ref
    origin: Cell
    axis: Cell
    body: RailRasterPart
    noses: tuple[RailRasterPart, RailRasterPart]
    nose_offsets: tuple[Cell, Cell]
    bays: tuple[RailLayerBay, ...] = Field(default=(), max_length=4096)


class RailLayerArm(FrozenModel):
    arm_ref: Ref
    body: RailRasterPart
    donor_endpoint: Cell
    receiver_endpoint: Cell
    held_content: RailRasterPart | None = None
    phase_evidence_ref: Ref | None = None


class RailLayerLayout(FrozenModel):
    layout_ref: Ref
    evidence_ref: Ref
    rail: RailRasterPart
    trains: tuple[RailLayerTrain, ...] = Field(min_length=1, max_length=128)
    arms: tuple[RailLayerArm, ...] = Field(default=(), max_length=128)
    unattached_content: tuple[RailRasterPart, ...] = Field(default=(), max_length=4096)
