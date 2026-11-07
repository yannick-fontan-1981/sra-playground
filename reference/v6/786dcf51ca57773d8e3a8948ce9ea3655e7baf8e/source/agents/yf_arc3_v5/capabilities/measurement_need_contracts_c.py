"""Consumer-bound questions reuse the existing dependency agenda and measured geometry."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC
from .mechanical_common_contracts_c import MechanicalPredicateC, SearchResultC
from .measurement_extension_contracts_c import MeasurementExtensionInputC, MeasurementExtensionDecisionC
from .mechanical_request_contracts import MechanicalRequestIdentity


class MorphologicalBottleneckInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.morphological_bottleneck_input_c.v1"
    scope: StructuralScopeC
    candidate_ref: Ref
    kind: Literal["SPAN", "INACCESSIBLE_REGION", "CONTAINER", "INSTRUCTION_STRIP"]
    enabling_condition_ref: Ref
    mechanism_question_ref: Ref
    required_for_current_consumer: bool
    dependency_evidence_refs: tuple[Ref, ...]
    measurement_semantics_ref: Ref
    semantic_support_refs: tuple[Ref, ...]
    condition: MechanicalPredicateC | None
    measured_values: FrozenMap
    unknown_field_refs: tuple[Ref, ...]
    closed_route: SearchResultC | None
    route_goal_contract_ref: Ref | None
    route_goal_binding_evidence_refs: tuple[Ref, ...]
    # Supplied by the selected consumer which actually issued the route query.
    # An absent binding remains unqualified; caller_ref is not a consumer role.
    route_expected_request: MechanicalRequestIdentity | None = None


class MorphologicalBottleneckFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.morphological_bottleneck_facts_c.v1"
    facts: FrozenMap
    measured_condition_value: bool | None
    retained_model_assignments: FrozenMap


class MorphologicalBottleneckDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.morphological_bottleneck_decision_input_c.v1"
    request: MorphologicalBottleneckInputC
    measured: MorphologicalBottleneckFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class MorphologicalBottleneckDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.morphological_bottleneck_decision_c.v1"
    frozen_request: MorphologicalBottleneckInputC
    frozen_measurement: MorphologicalBottleneckFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    unseen_solution_proof_or_action: None = None


class MeasurementAlternativePredictionC(FrozenModel):
    alternative_ref: Ref
    scope_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    predicted_values: FrozenMap
    evidence_refs: tuple[Ref, ...]


class RevalidatedGeometryMemoryC(FrozenModel):
    memory_ref: Ref
    episode_ref: Ref
    acquired_epoch: int = Field(ge=0)
    acquisition_evidence_refs: tuple[Ref, ...]
    measured_values: FrozenMap
    binding_signature: FrozenMap
    revalidation_epoch: int = Field(ge=0)
    revalidation_revision_ref: Ref
    revalidation_scope_ref: Ref
    revalidation_evidence_refs: tuple[Ref, ...]
    premise_refs: tuple[Ref, ...]
    falsifier_refs: tuple[Ref, ...]


class ConsumerMeasurementNeedInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.consumer_measurement_need_input_c.v1"
    scope: StructuralScopeC
    extension: MeasurementExtensionInputC
    measurement_kind: Literal["STRUCTURAL", "TEMPORAL", "TYPE"]
    dimension_refs: tuple[Ref, ...] = Field(max_length=64)
    goal_required_dimension_refs: tuple[Ref, ...] = Field(max_length=64)
    required_effect_dependency_ref: Ref | None
    goal_dependency_evidence_refs: tuple[Ref, ...]
    alternative_decision_dependency_ref: Ref | None
    alternative_dependency_evidence_refs: tuple[Ref, ...]
    live_alternative_refs: tuple[Ref, ...] = Field(max_length=256)
    predictions: tuple[MeasurementAlternativePredictionC, ...] = Field(max_length=256)
    geometry_memories: tuple[RevalidatedGeometryMemoryC, ...] = Field(max_length=256)
    current_geometry_binding: FrozenMap
    validated_continuation_current: bool
    next_effect_and_preservation_supported: bool
    next_action_payload_bound: bool
    continuation_contradicted: bool
    continuation_evidence_refs: tuple[Ref, ...]
    max_dimension_comparisons: int = Field(ge=0)


class ConsumerMeasurementNeedFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.consumer_measurement_need_facts_c.v1"
    facts: FrozenMap
    discriminating_dimension_refs: tuple[Ref, ...]
    supported_goal_dimension_refs: tuple[Ref, ...]
    qualified_geometry_memory_refs: tuple[Ref, ...]
    conflicting_geometry_memory_refs: tuple[Ref, ...]
    reusable_geometry_values: FrozenMap | None
    unqualified_prediction_refs: tuple[Ref, ...]
    actual_dimension_comparisons: int = Field(ge=0)


class ConsumerMeasurementNeedDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.consumer_measurement_need_decision_input_c.v1"
    request: ConsumerMeasurementNeedInputC
    measured: ConsumerMeasurementNeedFactsC
    agenda_decision: MeasurementExtensionDecisionC | None
    source_disposition_ref: Ref
    source_policy_ref: Ref


class ConsumerMeasurementNeedDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.consumer_measurement_need_decision_c.v1"
    frozen_request: ConsumerMeasurementNeedInputC
    frozen_measurement: ConsumerMeasurementNeedFactsC
    agenda_decision: MeasurementExtensionDecisionC | None
    source_disposition_ref: Ref
    source_policy_ref: Ref
    canonical_write_or_action: None = None
