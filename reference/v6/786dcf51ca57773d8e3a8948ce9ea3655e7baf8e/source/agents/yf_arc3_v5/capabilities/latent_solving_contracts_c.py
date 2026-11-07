"""Current parent-owned requests for the existing K41 computation family."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .latent_reference_restoration import RestorationRequest
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_agenda_projection import FamilyAgendaSnapshot,FamilyAgendaDemand
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .family_result_join import FamilyJoinRequest,FamilyJoinResult
from .articulated_solving_contracts_c import ArticulatedAcquiredFieldC
from ..drm.meaning import DeclaredMeaningInstantiation
from .latent_reference_restoration import ReferenceState
from .family_effect_publication_contracts import FamilyEffectPublicationRequest,FamilyEffectPublicationResult
from .native_memory_owner_contracts_d import DNativeMemoryReadRequest,DNativeMemoryContext,DNativeMemoryOwnerRequest,DNativeMemoryOwnerReturn


class LatentFieldBindingC(FrozenModel):
    native_field_ref: Ref
    acquisition: ArticulatedAcquiredFieldC


class LatentCausalBindingC(FrozenModel):
    native_value_ref: Ref
    support_claim_ref: Ref
    expected_predicate_ref: Ref
    expected_arguments: tuple[Ref,...] = Field(min_length=1,max_length=8)
    attribute_path: tuple[str | int,...] = Field(min_length=1,max_length=16)
    observation_record_ref: Ref


class LatentAppearanceCellC(FrozenModel):
    point: tuple[int, int]
    outline_value_ref: Ref | None
    flash_value_ref: Ref | None


class LatentAppearanceSnapshotC(FrozenModel):
    lattice_ref: Ref
    level_scope_ref: Ref
    cells: tuple[LatentAppearanceCellC, ...] = Field(min_length=1, max_length=4096)


class LatentIntervalSourceC(FrozenModel):
    packet_term_ref: Ref
    packet_projection_contract_ref: Ref
    state_projection_contract_ref: Ref
    expected_packet_fields: FrozenMap
    transactions: tuple[FrozenMap,...] = Field(min_length=1,max_length=64)
    before_fields: tuple[ArticulatedAcquiredFieldC,...] = Field(min_length=1,max_length=64)
    after_fields: tuple[ArticulatedAcquiredFieldC,...] = Field(min_length=1,max_length=64)
    reference_ref: Ref | None = None
    appearance_before_fields: tuple[ArticulatedAcquiredFieldC, ...] = Field(default=(), max_length=64)
    appearance_after_fields: tuple[ArticulatedAcquiredFieldC, ...] = Field(default=(), max_length=64)


class LatentOwnerPublicationBindingC(FrozenModel):
    publication_ref: Ref
    packet_term_ref: Ref
    packet_projection_contract_ref: Ref
    qualification_claim_ref: Ref
    scope_ref: Ref
    affected_dependency_refs: tuple[Ref,...] = Field(default=(),max_length=128)


class LatentReferenceRecallC(FrozenModel):
    memory: DNativeMemoryReadRequest
    expected_content_digest: Ref
    reference_field: str = "references"


class LatentReferenceCaptureC(FrozenModel):
    context: DNativeMemoryContext
    memory_term_ref: Ref
    memory_claim_ref: Ref
    content_path: tuple[str | int,...] = Field(min_length=1,max_length=12)


class LatentSolvingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_solving_input_c.v1"
    why: CoupledParentWhyC
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    native_request: RestorationRequest
    field_bindings: tuple[LatentFieldBindingC,...] = Field(max_length=32)
    causal_bindings: tuple[LatentCausalBindingC,...] = Field(default=(),max_length=128)
    join_request: FamilyJoinRequest | None = None
    parent_maximum_evaluations: int = Field(default=65536,ge=1,le=65536)
    interval_sources: tuple[LatentIntervalSourceC,...] = Field(default=(),max_length=16)
    owner_publication_binding: LatentOwnerPublicationBindingC | None = None
    reference_recalls: tuple[LatentReferenceRecallC,...] = Field(default=(),max_length=16)
    reference_capture: LatentReferenceCaptureC | None = None


class LatentSolvingFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_solving_facts_c.v1"
    frozen_input: LatentSolvingInputC
    facts: FrozenMap
    reasons: tuple[FrozenMap,...]
    missing_refs: tuple[Ref,...]
    acquisition_work: int = Field(default=0,ge=0)


class LatentSolvingBindC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_solving_bind_c.v1"
    measured: LatentSolvingFactsC


class LatentSolvingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_solving_return_c.v1"
    frozen_measurement: LatentSolvingFactsC
    returned: MechanicalNormalizedReturn | None
    missing_refs: tuple[Ref,...]
    receipt: FrozenMap = Field(default_factory=FrozenMap)
    parent_return: FrozenMap = Field(default_factory=FrozenMap)
    proposed_action: None = None
    joined: FamilyJoinResult | None = None
    evidence_meanings: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    accounted_evaluations: int = Field(default=0,ge=0)
    observed_effect_meanings: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    restoration_questions: tuple[RestorationRequest,...] = Field(default=(),max_length=3)


class LatentSolvingFinishC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_solving_finish_c.v1"
    measured: LatentSolvingFactsC
    returned: MechanicalNormalizedReturn | None


class LatentJoinInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_join_input_c.v1"
    returned: LatentSolvingReturnC


class LatentJoinFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_join_facts_c.v1"
    facts: FrozenMap
    missing_refs: tuple[Ref,...]


class LatentJoinFinishC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_join_finish_c.v1"
    returned: LatentSolvingReturnC
    measured: LatentJoinFactsC
    joined: FamilyJoinResult | None


class LatentEvidenceInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_evidence_input_c.v1"
    returned: LatentSolvingReturnC


class LatentEvidenceRowsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_evidence_rows_c.v1"
    rows: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)
    remaining_count: int = Field(default=0,ge=0)


class LatentEvidenceAppendC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_evidence_append_c.v1"
    prior: tuple[FrozenMap,...] = Field(max_length=128)
    meaning: DeclaredMeaningInstantiation


class LatentEvidenceSealC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_evidence_seal_c.v1"
    returned: LatentSolvingReturnC
    measured: LatentEvidenceRowsC
    meanings: tuple[FrozenMap,...] = Field(max_length=128)


class LatentIntervalFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_interval_facts_c.v1"
    request: LatentSolvingInputC
    rows: tuple[FrozenMap,...] = Field(default=(),max_length=32)
    facts: FrozenMap
    missing_refs: tuple[Ref,...]
    accounted_evaluations: int = Field(default=0,ge=0)
    terminal_state: ReferenceState | None = None
    appearance_rows: tuple[FrozenMap, ...] = Field(default=(), max_length=1024)


class LatentIntervalJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_interval_join_c.v1"
    measured: LatentSolvingFactsC
    interval: LatentIntervalFactsC


class LatentOwnerPublicationFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_owner_publication_facts_c.v1"
    publication_request: FamilyEffectPublicationRequest | None = None
    facts: FrozenMap
    missing_refs: tuple[Ref,...]


class LatentOwnerPublicationJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_owner_publication_join_c.v1"
    returned: LatentSolvingReturnC
    publication: LatentOwnerPublicationFactsC
    published: FamilyEffectPublicationResult | None = None


class LatentMemoryCaptureFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_memory_capture_facts_c.v1"
    memory_request: DNativeMemoryOwnerRequest | None = None
    facts: FrozenMap
    missing_refs: tuple[Ref,...]


class LatentMemoryRequestC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_memory_request_c.v1"
    request: DNativeMemoryOwnerRequest


class LatentMemoryCaptureJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_memory_capture_join_c.v1"
    returned: LatentSolvingReturnC
    measured: LatentMemoryCaptureFactsC
    captured: DNativeMemoryOwnerReturn | None
