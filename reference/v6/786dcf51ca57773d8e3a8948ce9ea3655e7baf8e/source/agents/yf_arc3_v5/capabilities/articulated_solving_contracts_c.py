"""Parent-owned K24 questions; graph meanings remain explicit Source/DRM inputs."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .articulated_channel_kinematics import ArtiRequest
from .contracts import ArticulatedKinematicsInput, ArticulatedKinematicsMeasurements
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_agenda_projection import FamilyAgendaSnapshot, FamilyAgendaDemand
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .family_result_join import FamilyJoinRequest, FamilyJoinResult
from ..state.observed_canonical_field_reader_b import (
    ObservedCanonicalFieldBindingB, ObservedCanonicalFieldScopeB)
from ..state.observed_scene_reader import ObservedSceneReadRequest
from .mechanical_family_contracts_d import DMechanicalRequest
from .shape_observation_contracts_c import ShapeObservedCellC
from .articulated_route_contracts_c import ArticulatedRouteBridgeInputC,ArticulatedRouteReturnC
from ..drm.meaning import DeclaredMeaningInstantiation
from .articulated_transition_domain_c import ArticulatedTransitionDomainInputC,ArticulatedTransitionSessionC
from ..state.actual_observation_dispatch_reader_b import ObservedDispatchPairInputB
from .observed_field_owner_contracts_d import ObservedFieldOwnerScopeProofD,ObservedFieldOwnerRequestD,ObservedFieldOwnerFactsD
from ..state.observed_scene_reader import ObservedInputReadRequest
from ..state.cargo_scalar_acquisition_b import CargoScalarAcquisitionInputB
from .mechanical_common_contracts_c import SearchDomainInputC


class ArticulatedAcquiredFieldC(FrozenModel):
    binding: ObservedCanonicalFieldBindingB
    scope: ObservedCanonicalFieldScopeB
    observation: ObservedInputReadRequest | None = None
    owner_scope_proof: ObservedFieldOwnerScopeProofD | None = None


class ArticulatedFieldAcquisitionC(FrozenModel):
    field: ArticulatedAcquiredFieldC
    decoder: CargoScalarAcquisitionInputB
    owner: ObservedFieldOwnerRequestD


class ArticulatedFieldBindingC(FrozenModel):
    """Exact acquired field; QUESTION_FACT is refused by the current reader."""
    native_field_ref: Ref
    acquisition: ArticulatedAcquiredFieldC
    value: FrozenMap


class ArticulatedComponentFieldC(FrozenModel):
    body_ref: Ref
    component_kind: Literal["BODY", "MASK"]
    field_ref: Ref
    acquisition: ArticulatedAcquiredFieldC


class ArticulatedStateAssemblyC(FrozenModel):
    body_population: ArticulatedAcquiredFieldC
    fields: tuple[ArticulatedComponentFieldC, ...] = Field(min_length=1,max_length=512)


class ArticulatedObservedBodyC(FrozenModel):
    body_ref: Ref
    layer_ref: Ref
    calibration_ref: Ref
    component_indices: tuple[int,...] = Field(min_length=1,max_length=128)
    root_cell: ShapeObservedCellC
    end_cell: ShapeObservedCellC
    marker_cells: tuple[ShapeObservedCellC,...] = Field(max_length=64)
    identity_support_claim_ref: Ref
    identity_predicate_ref: Ref
    association_acquisition: ArticulatedAcquiredFieldC


class ArticulatedGeometryAcquisitionC(FrozenModel):
    scene_request: ObservedSceneReadRequest
    measurement_request: DMechanicalRequest
    bodies: tuple[ArticulatedObservedBodyC,...] = Field(min_length=1,max_length=32)
    complete_population: ArticulatedAcquiredFieldC
    coordinate_basis: Literal["PIXEL_CONTENT_ORIGIN"]
    output_term_ref: Ref
    output_claim_ref: Ref


class ArticulatedRouteControlC(FrozenModel):
    primitive_ref: Ref
    input_ref: Ref
    channel_ref: Ref
    root_body_ref: Ref | None
    kind: Literal["SHARED_CHANNEL", "ROOTED_SUBCHAIN"]
    support_claim_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)


class ArticulatedRouteControlDomainC(FrozenModel):
    controls: tuple[ArticulatedRouteControlC,...] = Field(max_length=256)
    complete_population: ArticulatedAcquiredFieldC


class ArticulatedRelationC(FrozenModel):
    """Never merge a channel edge, attachment, contact or goal dependency."""
    relation_ref: Ref
    kind: Literal["CONTROL_CHANNEL", "DIRECTED_ATTACHMENT", "TEMPORARY_CONTACT", "DESIRED_DEPENDENCY"]
    origin_ref: Ref
    destination_ref: Ref
    support_claim_ref: Ref
    expected_predicate_ref: Ref
    expected_arguments: tuple[Ref, ...] = Field(min_length=1, max_length=8)
    observation_record_ref: Ref


class ArticulatedLawBindingC(FrozenModel):
    law_kind: Literal["COLLISION_TRANSACTION", "ATTACHMENT_TRANSPORT"]
    support_claim_ref: Ref
    expected_predicate_ref: Ref
    expected_arguments: tuple[Ref, ...] = Field(min_length=1,max_length=8)
    expected_value: FrozenMap
    attribute_path: tuple[str | int, ...] = Field(min_length=1,max_length=16)
    observation_record_ref: Ref


class ArticulatedMarkerTargetC(FrozenModel):
    body_ref: Ref
    marker_ref: Ref
    world_position: tuple[tuple[int, int], tuple[int, int]]
    acquisition: ArticulatedAcquiredFieldC


class ArticulatedRestorationC(FrozenModel):
    body_ref: Ref
    enabling_dependency_ref: Ref
    restoration_target_ref: Ref
    reference_body: FrozenMap
    reference_acquisition: ArticulatedAcquiredFieldC
    restoration_candidate_ref: Ref | None = None


class ArticulatedDependencyEffectC(FrozenModel):
    dependency_ref: Ref
    input_ref: Ref
    before_state_digest: Ref
    after_state_digest: Ref
    support_claim_ref: Ref
    expected_predicate_ref: Ref
    interpretation_ref: Ref


class ArticulatedDependencyQuestionC(FrozenModel):
    dependency_ref: Ref
    input_ref: Ref
    support_claim_ref: Ref
    expected_predicate_ref: Ref
    before_predicate: FrozenMap
    after_predicate: FrozenMap


class ArticulatedObservedAngleC(FrozenModel):
    body_ref: Ref
    transition_record_ref: Ref
    measured_linear_delta: tuple[tuple[tuple[int, int], tuple[int, int]], tuple[tuple[int, int], tuple[int, int]]] | None = None
    acquisition: ArticulatedAcquiredFieldC | None = None
    retained_cause_alternative_refs: tuple[Ref, ...] = Field(max_length=128)
    observation_pair: ObservedDispatchPairInputB | None = None
    before_geometry: ArticulatedGeometryAcquisitionC | None = None
    after_geometry: ArticulatedGeometryAcquisitionC | None = None
    coordinate_basis: Literal["WORLD_ROOT_RELATIVE"] | None = None


class ArticulatedOperatorScopeC(FrozenModel):
    input_ref: Ref
    kind: Literal["SHARED_CHANNEL", "ROOTED_SUBCHAIN"]
    root_body_ref: Ref | None = None
    direct_receiver_refs: tuple[Ref, ...] = Field(min_length=1,max_length=32)
    propagated_body_refs: tuple[Ref, ...] = Field(max_length=32)
    support_claim_refs: tuple[Ref, ...] = Field(min_length=1,max_length=64)


class ArticulatedClearanceWitnessC(FrozenModel):
    witness_ref: Ref
    candidate_ref: Ref
    enabling_dependency_ref: Ref
    clearance_request: ArtiRequest


class ArticulatedBlockedEditC(FrozenModel):
    dependency_ref: Ref
    native_request: ArtiRequest
    native_return: MechanicalNormalizedReturn


class ArticulatedSolvingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_solving_input_c.v1"
    why: CoupledParentWhyC
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    native_request: ArtiRequest
    parent_maximum_evaluations: int = Field(ge=1,le=65536)
    field_bindings: tuple[ArticulatedFieldBindingC, ...] = Field(max_length=32)
    state_assembly: ArticulatedStateAssemblyC | None = None
    geometry_acquisition: ArticulatedGeometryAcquisitionC | None = None
    relations: tuple[ArticulatedRelationC, ...] = Field(max_length=256)
    law_bindings: tuple[ArticulatedLawBindingC, ...] = Field(default=(),max_length=33)
    marker_targets: tuple[ArticulatedMarkerTargetC, ...] = Field(min_length=1, max_length=128)
    complete_marker_population: ArticulatedAcquiredFieldC
    restorations: tuple[ArticulatedRestorationC, ...] = Field(max_length=32)
    dependency_effects: tuple[ArticulatedDependencyEffectC,...] = Field(default=(),max_length=128)
    dependency_questions: tuple[ArticulatedDependencyQuestionC,...] = Field(default=(),max_length=128)
    observed_angles: tuple[ArticulatedObservedAngleC, ...] = Field(max_length=32)
    operator_scopes: tuple[ArticulatedOperatorScopeC, ...] = Field(default=(),max_length=4096)
    clearance_witnesses: tuple[ArticulatedClearanceWitnessC, ...] = Field(default=(),max_length=128)
    blocked_edits: tuple[ArticulatedBlockedEditC,...] = Field(default=(),max_length=32)
    prerequisite_clearance_refs: tuple[Ref, ...] = Field(max_length=128)
    retained_unknown_refs: tuple[Ref, ...] = Field(max_length=128)
    join_request: FamilyJoinRequest | None = None
    route_question: ArticulatedRouteBridgeInputC | None = None
    route_control_domain: ArticulatedRouteControlDomainC | None = None
    transition_domain: ArticulatedTransitionDomainInputC | None = None
    acquisition_requests: tuple[ArticulatedFieldAcquisitionC,...] = Field(default=(),max_length=512)


class ArticulatedSolvingFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_solving_facts_c.v1"
    frozen_input: ArticulatedSolvingInputC
    facts: FrozenMap
    reasons: tuple[FrozenMap, ...]
    missing_refs: tuple[Ref, ...]
    pose_question_receipts: tuple[FrozenMap,...] = Field(default=(),max_length=32)
    pose_question_work: int = Field(default=0,ge=0)
    restoration_target_receipts: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    restoration_target_work: int = Field(default=0,ge=0)


class ArticulatedSolvingBindInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_solving_bind_input_c.v1"
    measured: ArticulatedSolvingFactsC


class ArticulatedSolvingFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_solving_finish_input_c.v1"
    measured: ArticulatedSolvingFactsC
    returned: MechanicalNormalizedReturn | None


class ArticulatedSolvingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_solving_return_c.v1"
    frozen_measurement: ArticulatedSolvingFactsC
    returned: MechanicalNormalizedReturn | None
    native_result: MechanicalFamilyResult | None
    receipt: FrozenMap
    reasons: tuple[FrozenMap, ...]
    next_item_ref: Ref
    missing_refs: tuple[Ref, ...]
    family_join_request: FamilyJoinRequest | None = None
    family_join_result: FamilyJoinResult | None = None
    proposed_action: None = None
    accounted_evaluations: int = Field(default=0,ge=0)
    parent_return: FrozenMap = Field(default_factory=FrozenMap)
    route_return: ArticulatedRouteReturnC | None = None
    transition_session: ArticulatedTransitionSessionC | None = None
    conditional_dependency_receipts: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    useful_prefix_receipts: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    derived_route_query: SearchDomainInputC | None = None


class ArticulatedDependencyInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_dependency_input_c.v1"
    returned: ArticulatedSolvingReturnC


class ArticulatedAcquisitionReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_acquisition_return_c.v1"
    requests: tuple[ArticulatedFieldAcquisitionC,...] = Field(default=(),max_length=512)
    request_digest: Ref
    acquisition_bound: bool
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)
    receipts: tuple[FrozenMap,...] = Field(default=(),max_length=512)


class ArticulatedAcquisitionAppendC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_acquisition_append_c.v1"
    prior: ArticulatedAcquisitionReturnC
    item: ArticulatedFieldAcquisitionC
    decoded: FrozenMap
    owner: ObservedFieldOwnerFactsD | None


class ArticulatedDependencyRowsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_dependency_rows_c.v1"
    rows: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)
    projection_complete: bool = True
    frontier: FrozenMap = Field(default_factory=FrozenMap)


class ArticulatedDependencyAppendC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_dependency_append_c.v1"
    prior: ArticulatedDependencyRowsC
    row: FrozenMap
    meaning: DeclaredMeaningInstantiation


class ArticulatedDependencySealC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_dependency_seal_c.v1"
    returned: ArticulatedSolvingReturnC
    measured: ArticulatedDependencyRowsC
    interpreted: ArticulatedDependencyRowsC


class ArticulatedJoinInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_join_input_c.v1"
    returned: ArticulatedSolvingReturnC


class ArticulatedJoinFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_join_facts_c.v1"
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]


class ArticulatedJoinReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_join_return_input_c.v1"
    returned: ArticulatedSolvingReturnC
    joined: FamilyJoinResult


class ArticulatedJoinBlockedInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_join_blocked_input_c.v1"
    returned: ArticulatedSolvingReturnC
    measured: ArticulatedJoinFactsC


class ArticulatedTerminalPreparedC(FrozenModel):
    candidate_ref: Ref
    geometry_input: ArticulatedKinematicsInput
    complete_word_succeeded: bool
    after_bodies: tuple[FrozenMap, ...]


class ArticulatedTerminalRowsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_terminal_rows_c.v1"
    preparations: tuple[ArticulatedTerminalPreparedC, ...] = Field(max_length=128)
    rows: tuple[FrozenMap, ...] = Field(max_length=128)
    missing_refs: tuple[Ref, ...]
    accounted_evaluations: int = Field(default=0,ge=0)


class ArticulatedTerminalStartInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_terminal_start_input_c.v1"
    returned: ArticulatedSolvingReturnC


class ArticulatedTerminalAppendInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_terminal_append_input_c.v1"
    returned: ArticulatedSolvingReturnC
    prepared: ArticulatedTerminalPreparedC
    measured: ArticulatedKinematicsMeasurements
    prior: ArticulatedTerminalRowsC


class ArticulatedTerminalSealInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_terminal_seal_input_c.v1"
    returned: ArticulatedSolvingReturnC
    terminal: ArticulatedTerminalRowsC


class ArticulatedClearancePreparedC(FrozenModel):
    witness_ref: Ref
    candidate_ref: Ref
    enabling_dependency_ref: Ref
    native_request: ArtiRequest


class ArticulatedClearanceRowsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_clearance_rows_c.v1"
    preparations: tuple[ArticulatedClearancePreparedC, ...] = Field(max_length=128)
    rows: tuple[FrozenMap, ...] = Field(max_length=128)
    missing_refs: tuple[Ref, ...]
    accounted_evaluations: int = Field(default=0,ge=0)


class ArticulatedClearanceStartInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_clearance_start_input_c.v1"
    returned: ArticulatedSolvingReturnC


class ArticulatedClearanceAppendInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_clearance_append_input_c.v1"
    prepared: ArticulatedClearancePreparedC
    returned: MechanicalNormalizedReturn
    prior: ArticulatedClearanceRowsC


class ArticulatedClearanceSealInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_clearance_seal_input_c.v1"
    returned: ArticulatedSolvingReturnC
    clearance: ArticulatedClearanceRowsC


class ArticulatedParentReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_parent_return_input_c.v1"
    returned: ArticulatedSolvingReturnC


class ArticulatedGeometryPublicationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_geometry_publication_c.v1"
    request: ArticulatedSolvingInputC
    row: FrozenMap
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]


class ArticulatedGeometryPublicationReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_geometry_publication_return_c.v1"
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    evidence_refs: tuple[Ref, ...]
    request_digest: Ref
    accounted_evaluations: int = Field(ge=0)
    field_acquisition_receipts: tuple[FrozenMap,...] = Field(default=(),max_length=512)


class ArticulatedAcquisitionJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_acquisition_join_c.v1"
    publication: ArticulatedGeometryPublicationReturnC
    acquisition: ArticulatedAcquisitionReturnC


class ArticulatedPassiveGoalInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_passive_goal_input_c.v1"
    measured: ArticulatedSolvingFactsC


class ArticulatedPassiveGoalRowsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_passive_goal_rows_c.v1"
    rows: tuple[FrozenMap,...] = Field(max_length=128)
    remaining_count: int = Field(default=0,ge=0)
    accounted_evaluations: int = Field(default=0,ge=0)
    missing_refs: tuple[Ref,...] = ()


class ArticulatedPassiveMeaningInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_passive_meaning_input_c.v1"
    measured: ArticulatedSolvingFactsC
    meanings: tuple[FrozenMap,...] = Field(max_length=32)


class ArticulatedPoseMeaningInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_pose_meaning_input_c.v1"
    measured: ArticulatedSolvingFactsC
    rows: ArticulatedPassiveGoalRowsC
    meanings: tuple[FrozenMap,...] = Field(max_length=128)


class ArticulatedPassiveMeaningAppendC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_passive_meaning_append_c.v1"
    prior: tuple[FrozenMap,...] = Field(max_length=128)
    meaning: DeclaredMeaningInstantiation


class ArticulatedPassiveMeaningRowsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_passive_meaning_rows_c.v1"
    rows: tuple[FrozenMap,...] = Field(max_length=128)


class ArticulatedTransitionParentInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_transition_parent_input_c.v1"
    returned: ArticulatedSolvingReturnC


class ArticulatedTransitionParentFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_transition_parent_facts_c.v1"
    facts: FrozenMap
    missing_refs: tuple[Ref,...]


class ArticulatedTransitionParentSealInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_transition_parent_seal_input_c.v1"
    returned: ArticulatedSolvingReturnC
    measured: ArticulatedTransitionParentFactsC
    session: ArticulatedTransitionSessionC | None


class ArticulatedParentMeasureInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_parent_measure_input_c.v1"
    request: ArticulatedSolvingInputC
    publication: ArticulatedGeometryPublicationReturnC


class ArticulatedRouteParentInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_route_parent_input_c.v1"
    returned: ArticulatedSolvingReturnC


class ArticulatedRouteParentFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_route_parent_facts_c.v1"
    facts: FrozenMap
    missing_refs: tuple[Ref,...]


class ArticulatedRouteParentSealInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_route_parent_seal_input_c.v1"
    returned: ArticulatedSolvingReturnC
    measured: ArticulatedRouteParentFactsC
    route: ArticulatedRouteReturnC | None
