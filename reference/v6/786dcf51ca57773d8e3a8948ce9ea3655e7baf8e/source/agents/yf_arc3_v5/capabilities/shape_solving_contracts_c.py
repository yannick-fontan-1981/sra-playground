"""Source complete contour goals and exact K26 reasoning support."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .contact_shape_repair import ShapeRequest,ShapeTarget
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_agenda_projection import FamilyAgendaSnapshot,FamilyAgendaDemand
from .family_result_join import FamilyJoinGroup,FamilyJoinRequest,FamilyJoinResult
from agents.yf_arc3_v5.state.parent_measurement_template_b import ParentMeasurementSlotB
from agents.yf_arc3_v5.state.observed_canonical_field_reader_b import ObservedCanonicalFieldBindingB,ObservedCanonicalFieldScopeB
from agents.yf_arc3_v5.state.actual_observation_dispatch_reader_b import ObservedDispatchPairInputB
from .shape_observation_contracts_c import (ShapeObservedCellC, ShapeObservedSegmentC, ShapeObservedObjectC,
    ShapeObservedGeometryPlanC, ShapeObservedPopulationC, ShapeObservedPlanSourceC,
    ShapeAssociationDestinationC, ShapeAssociationAcquisitionC, ShapeGeometryAcquisitionC,ShapeGeometryRetentionC,ShapeCoreRoleBindingC)

class ShapeGoalContractC(FrozenModel):
    targets: tuple[ShapeTarget,...] = Field(min_length=1,max_length=128)
    quantifier: Literal["ALL_DECLARED_COMPLETE_CONTOUR_MARKER_AND_ASPECT_TARGETS"]
    marker_ensemble_evidence_refs: tuple[Ref,...]
    contour_family_evidence_refs: tuple[Ref,...]
    aspect_evidence_refs: tuple[Ref,...]
    cross_intersection_only: bool
    cross_model_evidence_refs: tuple[Ref,...] = ()
    restoration_target_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    restoration_evidence_refs: tuple[Ref,...] = ()
    evidence_revision_ref: Ref

class ShapeCanonicalBindingC(FrozenModel):
    term_ref: Ref
    claim_ref: Ref
    native_field_ref: Ref
    value: FrozenMap
    source_slot: ParentMeasurementSlotB
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    model_revision_ref: Ref

class ShapeReasonGroundC(FrozenModel):
    evidence_ref: Ref
    support_claim_ref: Ref
    expected_predicate_ref: Ref

class ShapeReasonReceiptC(FrozenModel):
    native_request: ShapeRequest
    native_result: MechanicalFamilyResult
    candidate_ref: Ref
    evidence_refs: tuple[Ref,...]

class ShapeContactReasonC(FrozenModel):
    body_ref: Ref
    target_ref: Ref
    kind: Literal["RELATIVE_STOP","ASPECT_CONTACT"]
    receipt: ShapeReasonReceiptC
    law_ref: Ref
    expected_after_body_digest: Ref
    contact_evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)
    enabling_dependency_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)

class ShapeInvariantReasonC(FrozenModel):
    body_ref: Ref
    receipt: ShapeReasonReceiptC
    invariant_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    expected_holds: bool
    contextual_evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)
    retained_alternative_mechanism_refs: tuple[Ref,...] = Field(default=(),max_length=128)

class ShapeTransitSupportC(FrozenModel):
    body_ref: Ref
    transit_receipt: ShapeReasonReceiptC
    restoration_receipt: ShapeReasonReceiptC
    temporary_contour_evidence_refs: tuple[Ref,...]
    gap_clearance_evidence_refs: tuple[Ref,...]
    restoration_target_ref: Ref
    enabling_dependency_refs: tuple[Ref,...]

class ShapeReassignmentSupportC(FrozenModel):
    previous_assignment_ref: Ref
    replacement_assignment_ref: Ref
    receipt: ShapeReasonReceiptC
    blocked_previous_evidence_refs: tuple[Ref,...]
    replacement_evidence_refs: tuple[Ref,...]
    restoration_target_refs: tuple[Ref,...]

class ShapeLoopSupportC(FrozenModel):
    body_ref: Ref
    receipt: ShapeReasonReceiptC
    focus_before: tuple[int,int]
    focus_after: tuple[int,int]
    focus_evidence_refs: tuple[Ref,...]
    enabling_dependency_refs: tuple[Ref,...]

class ShapeObservabilityC(FrozenModel):
    body_ref: Ref
    clipped_or_covered_segment_refs: tuple[Ref,...]
    retained_geometry_evidence_refs: tuple[Ref,...]
    status: Literal["OBSERVED","SUPPORTED_HYPOTHESIS","MISSING"]
    falsifier_ref: Ref

class ShapeJoinSupportC(FrozenModel):
    candidate_ref: Ref
    native_row_path: tuple[Ref|int,...] = Field(min_length=1,max_length=12)
    assignment_paths: FrozenMap
    resource_paths: FrozenMap = Field(default_factory=FrozenMap)
    evidence_refs: tuple[Ref,...]

class ShapeSolvingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shape_solving_input_c.v1"
    why: CoupledParentWhyC
    native_request: ShapeRequest
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    goal_contract: ShapeGoalContractC
    canonical_bindings: tuple[ShapeCanonicalBindingC,...] = Field(default=(),max_length=256)
    reason_groundings: tuple[ShapeReasonGroundC,...] = Field(default=(),max_length=1024)
    geometry_acquisition: ShapeGeometryAcquisitionC | None = None
    geometry_retention: tuple[ShapeGeometryRetentionC,...] = Field(default=(),max_length=32)
    contact_reasons: tuple[ShapeContactReasonC,...] = Field(default=(),max_length=32)
    invariant_reasons: tuple[ShapeInvariantReasonC,...] = Field(default=(),max_length=32)
    transit_supports: tuple[ShapeTransitSupportC,...] = Field(default=(),max_length=3)
    reassignment_supports: tuple[ShapeReassignmentSupportC,...] = Field(default=(),max_length=3)
    loop_supports: tuple[ShapeLoopSupportC,...] = Field(default=(),max_length=3)
    observability: tuple[ShapeObservabilityC,...] = Field(default=(),max_length=32)
    peer_groups: tuple[FamilyJoinGroup,...] = Field(default=(),max_length=127)
    join_supports: tuple[ShapeJoinSupportC,...] = Field(default=(),max_length=128)
    join_request_ref: Ref | None = None
    maximum_join_pairs: int = Field(default=0,ge=0,le=65536)
    maximum_join_candidates: int = Field(default=0,ge=0,le=4096)

class ShapeSolvingFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shape_solving_facts_c.v1"
    frozen_input: ShapeSolvingInputC
    facts: FrozenMap
    support_reasons: tuple[FrozenMap,...]
    missing_refs: tuple[Ref,...]

class ShapeSolvingBindInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shape_solving_bind_input_c.v1"
    measured: ShapeSolvingFactsC

class ShapeSolvingFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shape_solving_finish_input_c.v1"
    measured: ShapeSolvingFactsC
    returned: MechanicalNormalizedReturn | None

class ShapeSolvingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shape_solving_return_c.v1"
    frozen_measurement: ShapeSolvingFactsC
    returned: MechanicalNormalizedReturn | None
    receipt: FrozenMap
    next_item_ref: Ref
    support_reasons: tuple[FrozenMap,...]
    family_join_request: FamilyJoinRequest | None = None
    family_join_result: FamilyJoinResult | None = None
    composition_missing_refs: tuple[Ref,...] = ()
    proposed_action: None = None
    retained_geometry_reasons: tuple[FrozenMap,...] = ()
    retained_geometry_missing_refs: tuple[Ref,...] = ()
    conditional_return: MechanicalNormalizedReturn | None = None
    conditional_assumption_refs: tuple[Ref,...] = ()
    conditional_missing_refs: tuple[Ref,...] = ()

class ShapeBindingPublicationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shape_binding_publication_c.v1"
    request: ShapeSolvingInputC
    rows: tuple[FrozenMap,...]
    facts: FrozenMap
    missing_refs: tuple[Ref,...]

class ShapeBindingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shape_binding_return_c.v1"
    request: ShapeSolvingInputC
    facts: FrozenMap
    missing_refs: tuple[Ref,...]

class ShapeBindingBlockedInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shape_binding_blocked_input_c.v1"
    returned: ShapeBindingReturnC

class ShapeJoinInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shape_join_input_c.v1"
    returned: ShapeSolvingReturnC

class ShapeJoinFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shape_join_facts_c.v1"
    returned: ShapeSolvingReturnC
    facts: FrozenMap

class ShapeJoinReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shape_join_return_input_c.v1"
    returned: ShapeSolvingReturnC
    joined: FamilyJoinResult

class ShapeRetainedGeometryInputC(FrozenModel):
    request: ShapeSolvingInputC
    body_ref: Ref
    prior_body_binding: ObservedCanonicalFieldBindingB
    prior_scope: ObservedCanonicalFieldScopeB
    method_term_ref: Ref
    method_claim_ref: Ref
    method_predicate_ref: Ref
    transition_pair: ObservedDispatchPairInputB | None = None

class ShapeRetainedGeometryFactsC(FrozenModel):
    request: ShapeRetainedGeometryInputC
    facts: FrozenMap
    retained_body: FrozenMap | None
    unknown_cells: tuple[tuple[int,int],...]
    clipped_or_covered_segment_refs: tuple[Ref,...]
    evidence_refs: tuple[Ref,...]
    missing_refs: tuple[Ref,...]
    confirmed_control_or_pose: None = None
    proposed_action: None = None

class ShapeRetentionParentFactsC(FrozenModel):
    request: ShapeSolvingInputC
    frame_ref: Ref
    rows: tuple[FrozenMap,...]
    missing_refs: tuple[Ref,...]

class ShapeRetentionAttachInputC(FrozenModel):
    returned: ShapeSolvingReturnC
    retention: ShapeRetentionParentFactsC

class ShapeConditionalInputC(FrozenModel):
    request: ShapeSolvingInputC
    retention: ShapeRetentionParentFactsC

class ShapeConditionalFactsC(FrozenModel):
    input: ShapeConditionalInputC
    facts: FrozenMap
    assumption_refs: tuple[Ref,...]
    missing_refs: tuple[Ref,...]

class ShapeConditionalReturnC(FrozenModel):
    measured: ShapeConditionalFactsC
    returned: MechanicalNormalizedReturn | None
    actual_state_or_action_authority: None = None
