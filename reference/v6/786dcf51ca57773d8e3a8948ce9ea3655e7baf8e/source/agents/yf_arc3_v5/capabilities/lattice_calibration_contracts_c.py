"""Current native calibration is independent of glyph size and texture period."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .contracts import BoundingBox, ClippedPeriodicCell


class RasterSupportPointC(FrozenModel):
    row: int
    column: int
    value: int


class LatticeCalibrationCandidateC(FrozenModel):
    lattice_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scene_ref: Ref
    descriptive_domain_ref: Ref
    native_frame_ref: Ref
    core_height: int = Field(ge=1)
    core_width: int = Field(ge=1)
    row_pitch: int = Field(ge=1)
    column_pitch: int = Field(ge=1)
    row_gap: int = Field(ge=0)
    column_gap: int = Field(ge=0)
    row_origin: int
    column_origin: int
    morphology_evidence_refs: tuple[Ref, ...]
    clipped_cells: tuple[ClippedPeriodicCell, ...] = ()


class WholeBodyCalibrationEvidenceC(FrozenModel):
    evidence_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scene_ref: Ref
    descriptive_domain_ref: Ref
    after_frame_ref: Ref
    before_support: tuple[RasterSupportPointC, ...] = Field(max_length=65536)
    after_support: tuple[RasterSupportPointC, ...] = Field(max_length=65536)
    complete_whole_support: bool
    same_body_evidence_refs: tuple[Ref, ...]
    camera_delta: tuple[int, int] | None
    camera_evidence_refs: tuple[Ref, ...]
    logical_delta: tuple[int, int] | None
    logical_quantum_evidence_refs: tuple[Ref, ...]


class LatticeSpacingEvidenceC(FrozenModel):
    evidence_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scene_ref: Ref
    descriptive_domain_ref: Ref
    native_frame_ref: Ref
    kind: Literal["CONTACT_PITCH", "REPEATED_SUPPORT_ENVELOPES"]
    axis: Literal["ROW", "COLUMN"]
    boundary_positions: tuple[int, ...] = Field(max_length=4096)
    same_boundary_kind_evidence_refs: tuple[Ref, ...]
    cells_per_interval: int | None = Field(default=None, ge=1)
    logical_quantum_evidence_refs: tuple[Ref, ...] = ()


class NativeLatticePointQueryC(FrozenModel):
    point_ref: Ref
    row: int
    column: int


class LatticeCalibrationInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.lattice_calibration_input_c.v1"
    parent_goal_ref: Ref
    consumer_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scene_ref: Ref
    descriptive_domain_ref: Ref
    native_frame_ref: Ref
    observation_evidence_refs: tuple[Ref, ...]
    candidates: tuple[LatticeCalibrationCandidateC, ...] = Field(max_length=256)
    motion_evidence: tuple[WholeBodyCalibrationEvidenceC, ...] = Field(max_length=128)
    spacing_evidence: tuple[LatticeSpacingEvidenceC, ...] = Field(max_length=256)
    queries: tuple[NativeLatticePointQueryC, ...] = Field(max_length=4096)
    glyph_bounding_boxes: tuple[BoundingBox, ...] = ()
    border_measurements: FrozenMap
    decorative_texture_periods: FrozenMap
    metric_row_boundaries: FrozenMap
    metric_column_boundaries: FrozenMap
    projection_depths: FrozenMap
    enumeration_complete: bool
    retained_lattice_ref: Ref | None
    retained_current_revalidation_refs: tuple[Ref, ...]
    max_input_support_points: int = Field(ge=0)
    max_candidate_comparisons: int = Field(ge=0)


class NativeCellAddressC(FrozenModel):
    point_ref: Ref
    row: int
    column: int
    core_row_offset: int
    core_column_offset: int
    in_core: bool


class LatticeCandidateMeasurementC(FrozenModel):
    lattice_ref: Ref
    scope_current: bool
    structure_consistent: bool
    contradicted_by_evidence_refs: tuple[Ref, ...]
    supported_quantum_evidence_refs: tuple[Ref, ...]
    compatible_motion_refs: tuple[Ref, ...]
    addresses: tuple[NativeCellAddressC, ...]


class LatticeCalibrationFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.lattice_calibration_facts_c.v1"
    facts: FrozenMap
    candidate_measurements: tuple[LatticeCandidateMeasurementC, ...]
    admissible_lattice_refs: tuple[Ref, ...]
    unqualified_evidence_refs: tuple[Ref, ...]
    actual_input_support_point_visits: int
    actual_candidate_comparisons: int


class LatticeCalibrationDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.lattice_calibration_decision_input_c.v1"
    request: LatticeCalibrationInputC
    measured: LatticeCalibrationFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class LatticeCalibrationDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.lattice_calibration_decision_c.v1"
    source_disposition_ref: Ref
    source_policy_ref: Ref
    frozen_request: LatticeCalibrationInputC
    frozen_measurement: LatticeCalibrationFactsC
    operational_lattice_ref: Ref | None
    operational_addresses: tuple[NativeCellAddressC, ...]
    cell_roles_or_route: None = None
    proposed_action: None = None
