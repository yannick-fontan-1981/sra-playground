"""Source-bound observed contour candidates; no creator occupancy or array identities."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref

Point = tuple[int, int]


class ProjectedVoxelVertex(FrozenModel):
    vertex_ref: Ref
    point: Point
    evidence_ref: Ref
    support_pixels: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    source_observed: bool


class ProjectedVoxelEdge(FrozenModel):
    edge_ref: Ref
    first_vertex_ref: Ref
    second_vertex_ref: Ref
    axis_family_ref: Ref
    evidence_ref: Ref
    support_pixels: tuple[Point, ...] = Field(default=(), max_length=4096)


class ProjectedVoxelFace(FrozenModel):
    face_ref: Ref
    edge_refs: tuple[Ref, ...] = Field(min_length=1, max_length=32)
    contour_complete: bool
    evidence_ref: Ref


class ProjectedVoxelSpan(FrozenModel):
    span_ref: Ref
    axis_family_ref: Ref
    metric_ref: Literal['BASE_PITCH', 'COMPLETE_CUBE_EXTENT', 'EXTRUSION_INCREMENT']
    first_vertex_ref: Ref
    second_vertex_ref: Ref
    repeated_units: int = Field(ge=1, le=4096)
    evidence_ref: Ref


class VoxelUnitCalibration(FrozenModel):
    calibration_ref: Ref
    evidence_ref: Ref
    vertices: tuple[ProjectedVoxelVertex, ...] = Field(min_length=1, max_length=256)
    edges: tuple[ProjectedVoxelEdge, ...] = Field(min_length=1, max_length=512)
    faces: tuple[ProjectedVoxelFace, ...] = Field(default=(), max_length=128)
    spans: tuple[ProjectedVoxelSpan, ...] = Field(min_length=1, max_length=512)
