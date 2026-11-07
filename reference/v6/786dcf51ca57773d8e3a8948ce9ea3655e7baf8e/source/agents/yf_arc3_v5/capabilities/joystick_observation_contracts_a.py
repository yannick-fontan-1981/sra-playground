"""Source-scoped observation questions, not inferred joystick roles or laws."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .contracts import FrameGrid
from .scene_layer_measurement_d import DSceneCalibration, DSceneLayerQuestion, DSceneOcclusion


class JoystickSceneFacetA(FrozenModel):
    facet_ref: Ref
    layer_ref: Ref
    coordinate_space_ref: Literal['BOARD', 'PAD', 'MINIATURE', 'SELECTION_MARKER', 'ADVISORY_GUIDE', 'TARGET', 'HUD']
    calibration_refs: tuple[Ref, ...] = Field(min_length=1, max_length=32)
    evidence_ref: Ref
    independent_target_requirement_ref: Ref | None = None


class JoystickSceneInputA(FrozenModel):
    frame: FrameGrid
    calibrations: tuple[DSceneCalibration, ...] = Field(min_length=1, max_length=32)
    questions: tuple[DSceneLayerQuestion, ...] = Field(min_length=1, max_length=128)
    occlusions: tuple[DSceneOcclusion, ...] = Field(default=(), max_length=128)
    facets: tuple[JoystickSceneFacetA, ...] = Field(min_length=1, max_length=128)
    missing_support_refs: tuple[Ref, ...]


class JoystickVisiblePatchA(FrozenModel):
    patch_ref: Ref
    row: int
    column: int
    possible_top_color_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    evidence_ref: Ref


class JoystickIdentityCandidateA(FrozenModel):
    candidate_ref: Ref
    model_ref: Ref
    state: FrozenMap
    persistent_occurrence_evidence_ref: Ref
    position_evidence_ref: Ref
    complete_draw_order_evidence_ref: Ref | None = None
    selection_observed: bool
    selection_evidence_ref: Ref | None = None
    cycle_evidence_ref: Ref | None = None
    cycle_start_occurrence_ref: Ref | None = None
    cycle_input_count: int | None = Field(default=None, ge=0, le=4096)


class JoystickIdentityInputA(FrozenModel):
    candidates: tuple[JoystickIdentityCandidateA, ...] = Field(min_length=1, max_length=4096)
    visible_patches: tuple[JoystickVisiblePatchA, ...] = Field(default=(), max_length=4096)
    complete_visible_cell_domain: bool
    visibility_domain_evidence_ref: Ref


class JoystickMarkerReadA(FrozenModel):
    pad_ref: Ref
    occurrence_ref: Ref | None = None
    presence_ref: Literal['PRESENT', 'ABSENT', 'UNKNOWN']
    enabled: bool | None
    marker_row_pixel: int | None = None
    marker_column_pixel: int | None = None
    marker_evidence_ref: Ref | None = None
    geometry_evidence_ref: Ref | None = None
    evidence_revision_ref: Ref


class JoystickControlInputA(FrozenModel):
    pad_reads: tuple[JoystickMarkerReadA, ...] = Field(default=(), max_length=128)
    complete_pad_ref_domain: tuple[Ref, ...] = Field(max_length=128)
    active_occurrence_observed: bool
    active_occurrence_evidence_ref: Ref | None = None
    active_pad_observed: bool
    active_pad_evidence_ref: Ref | None = None


class JoystickRecoveryDependencyA(FrozenModel):
    dependency_ref: Ref
    dimension_ref: Literal['GAIN', 'GEOMETRY', 'SELECTION', 'GUIDE', 'KNOB', 'POSITION']
    evidence_revision_ref: Ref
    model_revision_ref: Ref
    portable_evidence_ref: Ref | None = None
    current_revalidation_ref: Ref | None = None
    restoration_obligation_ref: Ref | None = None
    information_experiment_ref: Ref | None = None
    contradictory: bool
    advisory_only: bool


class JoystickRecoveryInputA(FrozenModel):
    cause_ref: Literal['MISSING_EVIDENCE', 'CAUSAL_CONTRADICTION', 'COMPUTATION_BOUND', 'RESTORATION_REQUEST']
    dependencies: tuple[JoystickRecoveryDependencyA, ...] = Field(min_length=1, max_length=4096)
    before_restoration_state: FrozenMap | None = None
    after_restoration_state: FrozenMap | None = None
    restoration_evidence_ref: Ref | None = None
