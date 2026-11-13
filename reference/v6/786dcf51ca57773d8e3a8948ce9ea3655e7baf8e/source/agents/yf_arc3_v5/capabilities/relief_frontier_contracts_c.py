"""Current sealed relief facets; existing native computation remains authoritative."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .ordered_relief_writing import ReliefRequest
from .articulated_solving_contracts_c import ArticulatedAcquiredFieldC
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_agenda_projection import FamilyAgendaSnapshot,FamilyAgendaDemand
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .family_effect_publication_contracts import FamilyEffectPublicationRequest,FamilyEffectPublicationResult
from ..drm.meaning import DeclaredMeaningInstantiation
from .latent_solving_contracts_c import LatentOwnerPublicationBindingC
from .agenda_receipt_contracts_root import AgendaReceiptInputRoot


class ReliefFrontierFieldC(FrozenModel):
    native_field_ref: Ref
    acquisition: ArticulatedAcquiredFieldC


class ReliefObservedFacetC(FrozenModel):
    packet_term_ref: Ref
    packet_projection_contract_ref: Ref
    state_projection_contract_ref: Ref
    expected_packet_fields: FrozenMap
    transactions: tuple[FrozenMap,...] = Field(min_length=1,max_length=64)
    transaction_index: int = Field(ge=0,le=63)
    before_field: ArticulatedAcquiredFieldC
    after_field: ArticulatedAcquiredFieldC
    control_field: ArticulatedAcquiredFieldC
    application_field: ArticulatedAcquiredFieldC | None = None
    footprint_before_field: ArticulatedAcquiredFieldC | None = None
    footprint_after_field: ArticulatedAcquiredFieldC | None = None
    contribution_field: ArticulatedAcquiredFieldC | None = None


class ReliefFrontierInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_frontier_input_c.v1"
    why: CoupledParentWhyC
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    native_request: ReliefRequest
    facet: ReliefObservedFacetC
    native_fields: tuple[ReliefFrontierFieldC,...] = Field(min_length=1,max_length=24)
    publication_binding: LatentOwnerPublicationBindingC | None = None
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)
    receipt_claim_ref: Ref


class ReliefFrontierFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_frontier_facts_c.v1"
    request: ReliefFrontierInputC
    facts: FrozenMap
    evidence_refs: tuple[Ref,...] = ()
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class ReliefFrontierCalculationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_frontier_calculation_c.v1"
    measured: ReliefFrontierFactsC
    returned: MechanicalNormalizedReturn | None = None


class ReliefFrontierReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_frontier_return_c.v1"
    measured: ReliefFrontierFactsC
    returned: MechanicalNormalizedReturn | None = None
    parent_return: FrozenMap
    missing_refs: tuple[Ref,...] = ()
    publication_receipt: FamilyEffectPublicationResult | None = None
    action_authority: None = None


class ReliefFrontierInterpretationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_frontier_interpretation_c.v1"
    calculated: ReliefFrontierReturnC
    meaning: DeclaredMeaningInstantiation | None = None


class ReliefFrontierPublicationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_frontier_publication_c.v1"
    returned: ReliefFrontierReturnC
    publication_request: FamilyEffectPublicationRequest | None = None
    facts: FrozenMap
    missing_refs: tuple[Ref,...] = ()


class ReliefFrontierPublicationJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_frontier_publication_join_c.v1"
    publication: ReliefFrontierPublicationC
    published: FamilyEffectPublicationResult | None = None


class ReliefFrontierAgendaInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_frontier_agenda_input_c.v1"
    returned: ReliefFrontierReturnC
    published: FrozenMap | None = None


class ReliefFrontierAgendaRequestC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_frontier_agenda_request_c.v1"
    request: AgendaReceiptInputRoot
