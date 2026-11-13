"""Canonical Source associations used to project acquired geometry, never pixels."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .contact_shape_repair import ShapeBody, ShapeTarget
from .mechanical_family_contracts_d import DMechanicalRequest
from agents.yf_arc3_v5.state.observed_scene_reader import ObservedSceneReadRequest
from agents.yf_arc3_v5.state.observed_canonical_field_reader_b import ObservedCanonicalFieldBindingB,ObservedCanonicalFieldScopeB
from agents.yf_arc3_v5.state.actual_observation_dispatch_reader_b import ObservedDispatchPairInputB


class ShapeObservedCellC(FrozenModel):
    identity_ref: Ref
    cell_index: tuple[int,int]
    component_index: int = Field(ge=0,le=4095)


class ShapeObservedSegmentC(FrozenModel):
    segment_ref: Ref
    component_indices: tuple[int,...] = Field(min_length=1,max_length=128)


class ShapeObservedObjectC(FrozenModel):
    role: Literal["BODY","TARGET"]
    layer_ref: Ref
    calibration_ref: Ref
    coordinate_basis: Literal["CELL_INDEX","PIXEL_CONTENT_ORIGIN"]
    component_indices: tuple[int,...] = Field(min_length=1,max_length=128)
    body_template: ShapeBody | None = None
    target_template: ShapeTarget | None = None
    target_display_kind: Literal["FULL_CONTOUR","MARKER_ENSEMBLE"] | None = None
    node_cells: tuple[ShapeObservedCellC,...] = Field(default=(),max_length=128)
    marker_cells: tuple[ShapeObservedCellC,...] = Field(default=(),max_length=128)
    segment_components: tuple[ShapeObservedSegmentC,...] = Field(default=(),max_length=128)


class ShapeObservedGeometryPlanC(FrozenModel):
    scene_request: ObservedSceneReadRequest
    objects: tuple[ShapeObservedObjectC,...] = Field(min_length=1,max_length=160)
    bodies_term_ref: Ref
    bodies_claim_ref: Ref
    targets_term_ref: Ref
    targets_claim_ref: Ref


class ShapeObservedPopulationC(FrozenModel):
    body_refs: tuple[Ref,...] = Field(max_length=32)
    target_refs: tuple[Ref,...] = Field(max_length=128)
    body_population_complete: bool
    target_population_complete: bool


class ShapeObservedPlanSourceC(FrozenModel):
    observation_record_ref: Ref
    raw_input_ref: Ref
    frame_ref: Ref
    timeline_ref: Ref
    scene_field: ObservedCanonicalFieldBindingB
    population_field: ObservedCanonicalFieldBindingB
    object_fields: tuple[ObservedCanonicalFieldBindingB,...] = Field(min_length=1,max_length=160)
    bodies_term_ref: Ref
    bodies_claim_ref: Ref
    targets_term_ref: Ref
    targets_claim_ref: Ref


class ShapeCoreRoleBindingC(FrozenModel):
    source_claim_ref: Ref
    source_predicate_ref: Ref
    source_entity_ref: Ref
    role_ref: Ref
    identity_claim_ref: Ref
    identity_predicate_ref: Ref


class ShapeAssociationDestinationC(FrozenModel):
    object_ref: Ref
    role_claim_ref: Ref
    role_predicate_ref: Ref
    core_role_binding: ShapeCoreRoleBindingC | None = None


class ShapeAssociationAcquisitionC(FrozenModel):
    method_term_ref: Ref
    method_claim_ref: Ref
    method_predicate_ref: Ref
    population_claim_ref: Ref
    population_predicate_ref: Ref
    objects: tuple[ShapeAssociationDestinationC,...] = Field(min_length=1,max_length=160)


class ShapeGeometryRetentionC(FrozenModel):
    body_ref: Ref
    prior_body_binding: ObservedCanonicalFieldBindingB
    prior_scope: ObservedCanonicalFieldScopeB
    method_term_ref: Ref
    method_claim_ref: Ref
    method_predicate_ref: Ref
    transition_pair: ObservedDispatchPairInputB | None = None
    geometry_assumption_term_ref: Ref | None = None
    geometry_assumption_claim_ref: Ref | None = None


class ShapeGeometryAcquisitionC(FrozenModel):
    plan_term_ref: Ref
    plan_claim_ref: Ref
    expected_predicate_ref: Ref
    measurement_request: DMechanicalRequest
    plan_sources: ShapeObservedPlanSourceC | None = None
    association_sources: ShapeAssociationAcquisitionC | None = None
