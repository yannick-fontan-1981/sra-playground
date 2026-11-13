"""Scoped interface questions preserve unknown laws and independent terminal goals."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC
from .typed_mask_contracts_c import TypedMaskRelationInputC
from .contracts import DirectedFlowColliderUnionInput, DirectedFlowColliderUnionMeasurements, LocalFieldTransactionInput, LocalFieldTransactionMeasurements


class WordCarrierC(FrozenModel):
    carrier_ref: Ref
    region_ref: Ref
    role: Literal["RULE", "OUTPUT", "EXAMPLE", "UNKNOWN"]
    canonical_symbols: tuple[Ref | None, ...] = Field(max_length=1024)
    alphabet_basis_ref: Ref
    complete: bool
    identity_evidence_refs: tuple[Ref, ...]
    role_evidence_refs: tuple[Ref, ...]


class WordConnectorC(FrozenModel):
    connector_ref: Ref
    endpoint_carrier_refs: tuple[Ref, Ref]
    visible_join_evidence_refs: tuple[Ref, ...]


class WordEditC(FrozenModel):
    example_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    primitive_ref: Ref
    carrier_ref: Ref
    before_symbols: tuple[Ref | None, ...] = Field(max_length=1024)
    after_symbols: tuple[Ref | None, ...] = Field(max_length=1024)
    focused_carrier_ref: Ref | None
    observation_sealed: bool
    whole_unit_complete: bool
    canonical_identity_evidence_refs: tuple[Ref, ...]
    focus_evidence_refs: tuple[Ref, ...]
    evidence_refs: tuple[Ref, ...]


class WordTransductionSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_transduction_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    carriers: tuple[WordCarrierC, ...] = Field(max_length=128)
    connectors: tuple[WordConnectorC, ...] = Field(max_length=128)
    edits: tuple[WordEditC, ...] = Field(max_length=256)
    same_alphabet_basis_evidence_refs: tuple[Ref, ...]
    max_pair_checks: int = Field(ge=0)


class DirectedFlowSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.directed_flow_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    source_ref: Ref
    source_cap_seed_evidence_refs: tuple[Ref, ...]
    configurable_collider_evidence_refs: tuple[Ref, ...]
    colliders: DirectedFlowColliderUnionInput
    collider_scope_evidence_refs: tuple[Ref, ...]
    receptacle_ref: Ref
    oriented_concavity_evidence_refs: tuple[Ref, ...]
    aperture_relation: TypedMaskRelationInputC
    release_actuator_ref: Ref | None
    release_actuator_evidence_refs: tuple[Ref, ...]


class FieldSampleC(FrozenModel):
    sample_ref: Ref
    role: Literal["MOVABLE", "TARGET"]
    type_ref: Ref
    # Coordinates are in an explicitly normalized intrinsic basis, not a screen pose.
    morphology: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    intrinsic_basis_ref: Ref
    morphology_basis_evidence_refs: tuple[Ref, ...]
    type_evidence_refs: tuple[Ref, ...]
    role_evidence_refs: tuple[Ref, ...]


class FieldCompatibilityC(FrozenModel):
    movable_ref: Ref
    target_ref: Ref
    compatible: bool | None
    independent_relation_evidence_refs: tuple[Ref, ...]


class LocalFieldSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.local_field_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    click_centered_transient_field_evidence_refs: tuple[Ref, ...]
    samples: tuple[FieldSampleC, ...] = Field(max_length=128)
    compatibility: tuple[FieldCompatibilityC, ...] = Field(max_length=256)
    transaction: LocalFieldTransactionInput | None = None
    body_inventory_complete: bool
    # Every retained snapshot has its own current scope/evidence attestation.
    snapshot_support: FrozenMap = Field(default_factory=FrozenMap)
    transaction_sealed_evidence_refs: tuple[Ref, ...] = ()
    max_pair_checks: int = Field(ge=0)


class MaterialSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.material_supposition_facts_c.v1"
    facts: FrozenMap
    measurements: tuple[FrozenMap, ...]
    collider_union: DirectedFlowColliderUnionMeasurements | None = None
    field_transaction: LocalFieldTransactionMeasurements | None = None
    actual_pair_checks: int = Field(default=0, ge=0)


class MaterialSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.material_supposition_decision_input_c.v1"
    request: WordTransductionSuppositionInputC | DirectedFlowSuppositionInputC | LocalFieldSuppositionInputC
    measured: MaterialSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class MaterialSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.material_supposition_decision_c.v1"
    frozen_request: WordTransductionSuppositionInputC | DirectedFlowSuppositionInputC | LocalFieldSuppositionInputC
    frozen_measurement: MaterialSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_law_goal_or_action: None = None
