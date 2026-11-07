"""K23 current carrier correspondences, coupled transitions and certificate scope."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult
from .finite_search_contracts_c import FiniteSearchInputC


class CoupledCarrierC(FrozenModel):
    carrier_ref: Ref
    allowed_domain: tuple[Ref, ...] = Field(max_length=256)
    value_ref: Ref | None
    exists: bool | None
    mutable: bool
    protected: bool
    structure_refs: tuple[Ref, ...]
    instruction_mark_refs: tuple[Ref, ...]


class CoupledCorrespondenceC(FrozenModel):
    anchor_ref: Ref
    offset: tuple[int, int]
    carrier_ref: Ref
    geometry_evidence_refs: tuple[Ref, ...]


class CoupledDemandC(FrozenModel):
    constraint_ref: Ref
    anchor_ref: Ref
    offset: tuple[int, int]
    predicate_kind: Literal["VALUE", "EXISTS", "ABSENT", "PROTECTED"]
    allowed_values: tuple[Ref, ...] = Field(max_length=256)
    support_refs: tuple[Ref, ...]
    correlation_ref: Ref | None


class CoupledCorrelationC(FrozenModel):
    correlation_ref: Ref
    carrier_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    allowed_rows: tuple[tuple[Ref, ...], ...] = Field(max_length=65536)
    domain_complete: bool
    evidence_refs: tuple[Ref, ...]


class CoupledPermutationCycleC(FrozenModel):
    cycle_ref: Ref
    carrier_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    measured_phase: int
    phase_evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)


class CoupledActionC(FrozenModel):
    action_ref: Ref
    centre_anchor_ref: Ref
    supported_offsets: tuple[tuple[int, int], ...] = Field(max_length=4096)
    support_evidence_refs: tuple[Ref, ...]
    weight: int = Field(ge=0)
    # Full pre-state to post-state relation, never sequential per-column mutation.
    transition_rows: tuple[tuple[FrozenMap, FrozenMap], ...] = Field(max_length=65536)
    domain_complete: bool
    involution_law_ref: Ref | None
    permutation_cycles: tuple[CoupledPermutationCycleC,...] = Field(default=(),max_length=128)


class CoupledAffineCertificateC(FrozenModel):
    certificate_ref: Ref
    kind: Literal["FIXED_MASK_INVOLUTION", "EXHAUSTIVE_DOMAIN", "SAMPLES_ONLY"]
    variable_refs: tuple[Ref, ...] = Field(max_length=128)
    action_refs: tuple[Ref, ...] = Field(max_length=128)
    model_revision_ref: Ref
    operator_support_digest: str
    constraint_digest: str
    output_projection_digest: str
    evidence_refs: tuple[Ref, ...]
    relevant_states: tuple[FrozenMap, ...] = Field(max_length=65536)
    relevant_state_domain_complete: bool
    fixed_effect_columns: FrozenMap


class CoupledValueCheckpointC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_value_checkpoint_c.v1"
    context_digest: str
    operation_ref: Ref
    item_index: int = Field(ge=0)
    inner_index: int = Field(ge=0)
    rows: tuple[FrozenMap, ...] = Field(max_length=65536)
    current_values: FrozenMap
    algorithm_state: FrozenMap
    examined_count: int = Field(ge=0)


class CoupledValueObservationC(FrozenModel):
    before_values: FrozenMap
    action_ref: Ref
    after_values: FrozenMap
    evidence_refs: tuple[Ref, ...]
    current_revalidation_ref: Ref | None


class CoupledParkingWitnessD(FrozenModel):
    witness_ref: Ref
    parking_carrier_ref: Ref
    transfer_action_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    restoration_action_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)


class CoupledParkingQueryD(FrozenModel):
    origin_carrier_ref: Ref
    next_action_ref: Ref
    restore_required_values: FrozenMap
    restoration_request_ref: Ref
    preservation_values: FrozenMap
    witnesses: tuple[CoupledParkingWitnessD,...] = Field(min_length=1,max_length=3)


class CoupledValueRequestC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_value_request_c.v1"
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref
    carriers: tuple[CoupledCarrierC, ...] = Field(max_length=4096)
    correspondences: tuple[CoupledCorrespondenceC, ...] = Field(max_length=65536)
    correspondence_domain_complete: bool
    demands: tuple[CoupledDemandC, ...] = Field(max_length=65536)
    correlations: tuple[CoupledCorrelationC, ...] = Field(max_length=128)
    actions: tuple[CoupledActionC, ...] = Field(max_length=256)
    action_domain_complete: bool
    action_ref: Ref | None
    current_values: FrozenMap
    target_values: FrozenMap
    binary_value_domains: FrozenMap
    affine_certificate: CoupledAffineCertificateC | None
    output_projection_rows: tuple[tuple[FrozenMap, FrozenMap], ...] = Field(max_length=65536)
    output_projection_domain_complete: bool
    influence_order: tuple[Ref, ...] = Field(max_length=4096)
    directional_action_refs: tuple[Ref, ...] = Field(max_length=4096)
    supplied_word: tuple[Ref, ...] = Field(max_length=4096)
    observations: tuple[CoupledValueObservationC, ...] = Field(default=(), max_length=4096)
    inverse_candidates: tuple[FrozenMap, ...] = Field(default=(), max_length=65536)
    inverse_domain_complete: bool = False
    inverse_form_ref: Literal['ENUMERATED_DOMAIN','PERMUTATION_IMAGE'] = 'ENUMERATED_DOMAIN'
    parking_query: CoupledParkingQueryD | None = None
    serving_k03: bool
    finite_query: FiniteSearchInputC | None = None
    finite_query_evidence_refs: tuple[Ref, ...] = ()
    path_state_values: FrozenMap = Field(default_factory=FrozenMap)
    path_state_variable_refs: tuple[Ref, ...] = ()
    path_action_variable_refs: tuple[Ref, ...] = ()
    path_stop_ref: Ref | None = None
    maximum_evaluations: int = Field(ge=1, le=65536)
    maximum_states: int = Field(ge=1, le=65536)
    maximum_depth: int = Field(ge=0, le=4096)
    resume: CoupledValueCheckpointC | None = None


class CoupledValueResultC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_value_result_c.v1"
    native: MechanicalFamilyResult
    rows: tuple[FrozenMap, ...]
    current_values: FrozenMap
    checkpoint: CoupledValueCheckpointC | None

class CoupledValueSourceReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_value_source_return_input_c.v1"
    request: CoupledValueRequestC
    calculation: CoupledValueResultC
    source_policy_ref: Ref
    source_disposition_ref: Ref
    source_reason_ref: Ref


class CoupledValueSourceReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_value_source_return_c.v1"
    frozen_request: CoupledValueRequestC
    calculation: CoupledValueResultC
    source_policy_ref: Ref
    source_disposition_ref: Ref
    source_reason_ref: Ref
    proposed_action: None = None
