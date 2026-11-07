"""Mask geometry does not confer collision, selection, aperture or score laws."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref

MaskKindC = Literal["RECOGNITION", "OCCUPIED_BODY", "COLLISION", "HIT_SELECTION",
    "BACKGROUND_HOLE", "RECEIVING_APERTURE", "SCORED_WINDOW"]


class MaskPointC(FrozenModel):
    row: int
    column: int
    depth: int | None


class TypedMaskC(FrozenModel):
    mask_ref: Ref
    owner_ref: Ref
    kind: MaskKindC
    scene_ref: Ref
    native_frame_ref: Ref
    coordinate_basis_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    support: tuple[MaskPointC, ...] = Field(max_length=65536)
    support_complete: bool
    origin: Literal["OBSERVED", "MODEL_PREDICTED"]
    evidence_refs: tuple[Ref, ...]
    model_ref: Ref | None
    model_assignment_ref: Ref | None = None
    premise_refs: tuple[Ref, ...]
    falsifier_refs: tuple[Ref, ...]
    semantic_support_refs: tuple[Ref, ...]
    semantic_premises_current: bool


class TypedMaskRelationInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.typed_mask_relation_input_c.v1"
    parent_goal_ref: Ref
    consumer_ref: Ref
    relation_ref: Ref
    operator: Literal["EQUAL", "SUBSET", "INTERSECTS", "DISJOINT"]
    required_left_kind: MaskKindC
    required_right_kind: MaskKindC
    left: TypedMaskC
    right: TypedMaskC
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scene_ref: Ref
    native_frame_ref: Ref
    coordinate_basis_ref: Ref
    coordinate_basis_kind: Literal["RASTER_2D", "LOGICAL_CELL_2D", "LOGICAL_CELL_3D"]
    current_model_assignment_ref: Ref | None
    max_input_support_points: int = Field(ge=0)


class TypedMaskRelationFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.typed_mask_relation_facts_c.v1"
    facts: FrozenMap
    geometric_relation_value: bool | None
    common_known_support: tuple[MaskPointC, ...]
    left_only_known_support: tuple[MaskPointC, ...]
    right_only_known_support: tuple[MaskPointC, ...]
    actual_input_support_point_visits: int


class TypedMaskDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.typed_mask_decision_input_c.v1"
    request: TypedMaskRelationInputC
    measured: TypedMaskRelationFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class TypedMaskDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.typed_mask_decision_c.v1"
    source_disposition_ref: Ref
    source_policy_ref: Ref
    frozen_request: TypedMaskRelationInputC
    frozen_measurement: TypedMaskRelationFactsC
    licensed_geometric_relation_value: bool | None
    physical_legality_or_terminal_acceptance: None = None
    proposed_action: None = None
