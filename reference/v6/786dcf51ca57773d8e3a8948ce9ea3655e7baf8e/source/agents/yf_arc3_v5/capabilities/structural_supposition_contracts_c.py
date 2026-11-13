"""Explicit geometry, retained layers and visible endpoints for revisable hypotheses."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .typed_mask_contracts_c import TypedMaskC, TypedMaskRelationInputC, MaskPointC


class StructuralScopeC(FrozenModel):
    parent_goal_ref: Ref
    consumer_ref: Ref
    episode_ref: Ref
    scope_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    support_epoch: int = Field(ge=0)
    support_revision_ref: Ref
    support_scope_ref: Ref
    current_evidence_refs: tuple[Ref, ...]
    premise_refs: tuple[Ref, ...]
    falsifier_refs: tuple[Ref, ...]


class TransitShapeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.transit_shape_input_c.v1"
    scope: StructuralScopeC
    model_assignment_ref: Ref | None
    candidate_ref: Ref
    parent_terminal_contract_ref: Ref
    current_shape_ref: Ref
    transit_shape_ref: Ref
    terminal_shape_ref: Ref
    opening_ref: Ref
    current_opening_relation: TypedMaskRelationInputC
    transit_opening_relation: TypedMaskRelationInputC
    transit_terminal_relation: TypedMaskRelationInputC
    restoration_dependency_ref: Ref | None
    restoration_method_ref: Ref | None
    restoration_premise_refs: tuple[Ref, ...]
    restoration_falsifier_refs: tuple[Ref, ...]


class OriginalLayerMemoryC(FrozenModel):
    memory_ref: Ref
    owner_ref: Ref
    episode_ref: Ref
    scope_ref: Ref
    acquired_epoch: int = Field(ge=0)
    original_masks: tuple[TypedMaskC, ...] = Field(min_length=1, max_length=16)
    original_attributes: FrozenMap
    acquisition_evidence_refs: tuple[Ref, ...]


class LayerProjectionC(FrozenModel):
    projection_ref: Ref
    memory_ref: Ref
    original_mask_ref: Ref
    projected_mask: TypedMaskC
    translation: tuple[int, int, int | None]
    pose_premise_refs: tuple[Ref, ...]
    pose_falsifier_refs: tuple[Ref, ...]
    visible_relation: TypedMaskRelationInputC | None
    visible_pixel_ownership_evidence_refs: tuple[Ref, ...]
    occlusion_evidence_refs: tuple[Ref, ...]
    selection_rendering_evidence_refs: tuple[Ref, ...]
    disappearance_evidence_refs: tuple[Ref, ...]


class MotionCouplingExampleC(FrozenModel):
    example_ref: Ref
    episode_ref: Ref
    scope_ref: Ref
    epoch: int = Field(ge=0)
    first_owner_ref: Ref
    second_owner_ref: Ref
    first_delta: tuple[int, int]
    second_delta: tuple[int, int]
    sealed_observation: bool
    evidence_refs: tuple[Ref, ...]
    direct_input_owner_refs: tuple[Ref, ...]
    direct_input_inventory_complete: bool
    excluded_competing_cause_refs: tuple[Ref, ...]
    attachment_relation_ref: Ref | None
    attachment_relation_value: bool | None
    attachment_evidence_refs: tuple[Ref, ...]


class LayerContactInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.layer_contact_input_c.v1"
    scope: StructuralScopeC
    memories: tuple[OriginalLayerMemoryC, ...] = Field(max_length=256)
    projections: tuple[LayerProjectionC, ...] = Field(max_length=1024)
    motion_examples: tuple[MotionCouplingExampleC, ...] = Field(max_length=1024)
    max_support_points: int = Field(ge=0)


class VisibleGraphPortC(FrozenModel):
    port_ref: Ref
    node_ref: Ref
    domain_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    native_frame_ref: Ref
    coordinate_basis_ref: Ref
    support: tuple[MaskPointC, ...] = Field(max_length=4096)
    endpoint_evidence_refs: tuple[Ref, ...]
    direction: Literal["IN", "OUT", "UNDIRECTED", "UNKNOWN"]
    direction_evidence_refs: tuple[Ref, ...]
    root_evidence_refs: tuple[Ref, ...]


class VisibleGraphStrokeC(FrozenModel):
    stroke_ref: Ref
    domain_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    native_frame_ref: Ref
    coordinate_basis_ref: Ref
    ordered_trace: tuple[MaskPointC, ...] = Field(max_length=4096)
    trace_evidence_refs: tuple[Ref, ...]
    crossed_separator_refs: tuple[Ref, ...]
    licensed_separator_crossing_refs: tuple[Ref, ...]
    unresolved_junction_refs: tuple[Ref, ...]


class HomologousControlEvidenceC(FrozenModel):
    evidence_ref: Ref
    first_port_ref: Ref
    second_port_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    shared_channel_ref: Ref | None
    shared_channel_evidence_refs: tuple[Ref, ...]
    cross_domain_contract_ref: Ref | None = None
    cross_domain_evidence_refs: tuple[Ref, ...] = ()


class VisibleGraphInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.visible_graph_input_c.v1"
    scope: StructuralScopeC
    native_frame_ref: Ref
    coordinate_basis_ref: Ref
    coordinate_basis_kind: Literal["RASTER_2D", "LOGICAL_CELL_2D", "LOGICAL_CELL_3D"]
    ports: tuple[VisibleGraphPortC, ...] = Field(max_length=256)
    strokes: tuple[VisibleGraphStrokeC, ...] = Field(max_length=256)
    homologous_controls: tuple[HomologousControlEvidenceC, ...] = Field(max_length=256)
    adjacency_offsets: tuple[tuple[int, int, int], ...] = Field(min_length=1, max_length=26)
    connection_convention_evidence_refs: tuple[Ref, ...]
    max_support_points: int = Field(ge=0)
    max_endpoint_comparisons: int = Field(ge=0)
    max_endpoint_pairs: int = Field(ge=0)


class StructuralSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.structural_supposition_facts_c.v1"
    facts: FrozenMap
    measurements: tuple[FrozenMap, ...]
    actual_support_point_visits: int = Field(ge=0)
    actual_comparisons: int = Field(ge=0)


class StructuralSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.structural_supposition_decision_input_c.v1"
    request: TransitShapeInputC | LayerContactInputC | VisibleGraphInputC
    measured: StructuralSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class StructuralSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.structural_supposition_decision_c.v1"
    frozen_request: TransitShapeInputC | LayerContactInputC | VisibleGraphInputC
    frozen_measurement: StructuralSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    causal_law_identity_edge_or_action: None = None
