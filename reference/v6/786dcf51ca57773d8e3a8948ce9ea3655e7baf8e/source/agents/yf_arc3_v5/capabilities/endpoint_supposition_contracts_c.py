"""Endpoints, joint anchors and contact contours retain distinct goal/control roles."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC
from .typed_mask_contracts_c import TypedMaskRelationInputC
from .contracts import (ArticulatedKinematicsInput, ArticulatedKinematicsMeasurements,
    RationalAnchorDependenceInput, RationalAnchorDependenceMeasurements)


class ArticulatedChannelSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_channel_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    geometry: ArticulatedKinematicsInput
    body_support_by_ref: FrozenMap
    capped_variable_extent_evidence_refs: tuple[Ref, ...]
    endpoint_marker_evidence_refs: tuple[Ref, ...]
    passive_attachment_evidence_by_ref: FrozenMap
    remote_same_channel_evidence_by_pair: FrozenMap


class InverseAnchorSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.inverse_anchor_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    anchor_refs: tuple[Ref, ...] = Field(min_length=2, max_length=16)
    beacon_ref: Ref
    wire_endpoint_pairs: tuple[tuple[Ref, Ref], ...] = Field(max_length=32)
    redrawn_wire_evidence_refs: tuple[Ref, ...]
    joint_dependence: RationalAnchorDependenceInput
    joint_dependence_evidence_refs: tuple[Ref, ...]
    hollow_multicolour_ensemble_evidence_refs: tuple[Ref, ...]
    signature_receiver_candidate_refs: tuple[Ref, ...]
    destination_receiver_candidate_refs: tuple[Ref, ...]


class ContactShapeSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.contact_shape_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    body_ref: Ref
    marker_constellation_evidence_refs: tuple[Ref, ...]
    contour_relation: TypedMaskRelationInputC
    normalized_shape_change_relation: TypedMaskRelationInputC
    shared_local_pose_basis_evidence_refs: tuple[Ref, ...]
    contact_evidence_refs: tuple[Ref, ...]
    stop_or_palette_evidence_refs: tuple[Ref, ...]
    body_identity_evidence_refs: tuple[Ref, ...]
    current_independent_identity_relation: bool | None
    before_aspect_signature: FrozenMap
    after_aspect_signature: FrozenMap
    aspect_observation_evidence_refs: tuple[Ref, ...]


class EndpointSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.endpoint_supposition_facts_c.v1"
    facts: FrozenMap
    measurements: tuple[FrozenMap, ...]
    articulated_geometry: ArticulatedKinematicsMeasurements | None = None
    anchor_prediction: RationalAnchorDependenceMeasurements | None = None


class EndpointSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.endpoint_supposition_decision_input_c.v1"
    request: ArticulatedChannelSuppositionInputC | InverseAnchorSuppositionInputC | ContactShapeSuppositionInputC
    measured: EndpointSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class EndpointSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.endpoint_supposition_decision_c.v1"
    frozen_request: ArticulatedChannelSuppositionInputC | InverseAnchorSuppositionInputC | ContactShapeSuppositionInputC
    frozen_measurement: EndpointSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_control_goal_or_action: None = None
