"""Current evidence keeps permissions, lineage and revealed knowledge distinct."""
from typing import Any
from pydantic import Field, field_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, freeze_json
from .structural_supposition_contracts_c import StructuralScopeC, VisibleGraphInputC, StructuralSuppositionFactsC
from .typed_mask_contracts_c import TypedMaskRelationInputC, TypedMaskRelationFactsC
from .entry_memory_contracts_c import EntryMemoryInputC, EntryMemorySessionC
from .indexed_sequence_contracts_c import IndexedSequenceMeasurementC
from .production_supposition_contracts_c import NativeMeasureBindingC, NormalizedPatternUnitC
from .transport_supposition_contracts_c import ScopedTransportObservationC
from .finite_relation_network import FiniteRelationRequest
from .feedback_code_identification import FeedbackCodeRequest
from .mechanical_family_contracts_a import MechanicalFamilyResult


class InventoryIdentityBindingC(FrozenModel):
    slot_ref: Ref
    field_ref: Ref
    field_owner_ref: Ref
    key_identity_ref: Ref
    possession_value: Any
    independent_binding_evidence_refs: tuple[Ref, ...]

    @field_validator("possession_value", mode="before")
    @classmethod
    def freeze_value(cls, value):
        return freeze_json(value)


class InventoryNavigationSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.inventory_navigation_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    map_object_cutout_evidence_refs: tuple[Ref, ...]
    separate_finite_inventory_evidence_refs: tuple[Ref, ...]
    inventory: EntryMemoryInputC
    inventory_next_contribution_ref: Ref
    inventory_consumer_binding_evidence_refs: tuple[Ref, ...]
    identity_bindings: tuple[InventoryIdentityBindingC, ...] = Field(max_length=1024)


class InternalMarkRelationC(FrozenModel):
    first: NormalizedPatternUnitC
    second: NormalizedPatternUnitC
    stable_mark_order_evidence_refs: tuple[Ref, ...]
    compatibility_role_evidence_refs: tuple[Ref, ...]


class LineageSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.lineage_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    first_parent_ref: Ref
    second_parent_ref: Ref
    composite_ref: Ref
    union_projection_ref: Ref
    parent_contour_relation: TypedMaskRelationInputC
    union_composite_equal: TypedMaskRelationInputC
    descendant_seed_evidence_refs: tuple[Ref, ...]
    matching_receptacle_evidence_refs: tuple[Ref, ...]
    marks: tuple[InternalMarkRelationC, ...] = Field(max_length=64)
    max_total_mark_slots: int = Field(ge=0)
    max_union_input_points: int = Field(ge=0)


class NetworkOutputRequirementC(FrozenModel):
    output_ref: Ref
    desired_value: bool | None
    independent_goal_evidence_refs: tuple[Ref, ...]


class FiniteNetworkSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.finite_network_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    repeated_switch_input_evidence_refs: tuple[Ref, ...]
    differentiated_component_evidence_refs: tuple[Ref, ...]
    terminal_lamp_evidence_refs: tuple[Ref, ...]
    graph: VisibleGraphInputC
    requested_outputs: tuple[NetworkOutputRequirementC, ...] = Field(max_length=256)
    native_ports: FiniteRelationRequest | None = None
    native_binding: NativeMeasureBindingC | None = None


class RecalledPopulationC(FrozenModel):
    scene_ref: Ref
    episode_ref: Ref
    observed_epoch: int = Field(ge=0)
    chronological_ordinal: int = Field(ge=0)
    actual_sealed_observation: bool
    acquisition_evidence_refs: tuple[Ref, ...]
    recall_epoch: int = Field(ge=0)
    recall_revision_ref: Ref
    recall_scope_ref: Ref
    current_recall_evidence_refs: tuple[Ref, ...]
    comparison_schema_ref: Ref
    normalization_evidence_refs: tuple[Ref, ...]
    population: FrozenMap
    inventory_complete: bool


class TemporalReferenceSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.temporal_reference_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    previous: RecalledPopulationC
    current: RecalledPopulationC
    invitation_designated_scene_ref: Ref
    invitation_content_refs: tuple[Ref, ...] = Field(max_length=1024)
    invitation_content_evidence_refs: tuple[Ref, ...]
    temporary_enclosing_invitation_evidence_refs: tuple[Ref, ...]
    accumulating_progress_indicator_evidence_refs: tuple[Ref, ...]
    max_population_items: int = Field(ge=0)


class FeedbackPositionC(FrozenModel):
    ordinal: int = Field(ge=0)
    observed_value_ref: Ref | None
    feedback_identity_evidence_refs: tuple[Ref, ...]


class FeedbackTrialObservationC(ScopedTransportObservationC):
    trial_ref: Ref
    submitted_ordinals: tuple[int, ...] = Field(max_length=1024)
    submitted_values: tuple[Ref, ...] = Field(max_length=1024)
    complete_submission: bool
    submission_evidence_refs: tuple[Ref, ...]
    feedback: tuple[FeedbackPositionC, ...] = Field(max_length=1024)
    actual_feedback_inventory_complete: bool
    feedback_response_evidence_refs: tuple[Ref, ...]


class FeedbackIdentificationSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.feedback_identification_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    selectable_sample_evidence_refs: tuple[Ref, ...]
    ordered_proposal_slot_evidence_refs: tuple[Ref, ...]
    submit_control_evidence_refs: tuple[Ref, ...]
    separate_revealed_row_evidence_refs: tuple[Ref, ...]
    per_position_feedback_evidence_refs: tuple[Ref, ...]
    proposal: NormalizedPatternUnitC
    revealed: NormalizedPatternUnitC
    proposal_reveal_role_evidence_refs: tuple[Ref, ...]
    trials: tuple[FeedbackTrialObservationC, ...] = Field(max_length=128)
    max_total_projected_slots: int = Field(ge=0)
    native_layers: FeedbackCodeRequest | None = None
    native_binding: NativeMeasureBindingC | None = None


class KnowledgeSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.knowledge_supposition_facts_c.v1"
    facts: FrozenMap
    measurements: tuple[FrozenMap, ...]
    entry_measurement: EntryMemorySessionC | None = None
    mask_measurements: tuple[TypedMaskRelationFactsC, ...] = ()
    indexed_measurements: tuple[IndexedSequenceMeasurementC, ...] = ()
    graph_measurement: StructuralSuppositionFactsC | None = None
    native_measurement: MechanicalFamilyResult | None = None
    actual_projected_slot_count: int = Field(default=0, ge=0)


class KnowledgeSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.knowledge_supposition_decision_input_c.v1"
    request: InventoryNavigationSuppositionInputC | LineageSuppositionInputC | FiniteNetworkSuppositionInputC | TemporalReferenceSuppositionInputC | FeedbackIdentificationSuppositionInputC
    measured: KnowledgeSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class KnowledgeSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.knowledge_supposition_decision_c.v1"
    frozen_request: InventoryNavigationSuppositionInputC | LineageSuppositionInputC | FiniteNetworkSuppositionInputC | TemporalReferenceSuppositionInputC | FeedbackIdentificationSuppositionInputC
    frozen_measurement: KnowledgeSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_law_permission_goal_or_action: None = None
