"""Exact acquired K25 frontier questions; no action authority or new mechanics."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .inverse_anchor_signature import AnchorRequest
from .articulated_solving_contracts_c import ArticulatedAcquiredFieldC
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_agenda_projection import FamilyAgendaSnapshot,FamilyAgendaDemand
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .latent_solving_contracts_c import LatentOwnerPublicationBindingC
from ..drm.meaning import DeclaredMeaningInstantiation
from .family_effect_publication_contracts import FamilyEffectPublicationRequest,FamilyEffectPublicationResult
from .agenda_receipt_contracts_root import AgendaReceiptInputRoot


class AnchorFrontierFieldC(FrozenModel):
    native_field_ref: Ref
    acquisition: ArticulatedAcquiredFieldC


class AnchorObservedFacetC(FrozenModel):
    packet_term_ref: Ref
    packet_projection_contract_ref: Ref
    state_projection_contract_ref: Ref
    expected_packet_fields: FrozenMap
    transactions: tuple[FrozenMap,...] = Field(min_length=1,max_length=64)
    transaction_index: int = Field(ge=0,le=63)
    before_field: ArticulatedAcquiredFieldC
    after_field: ArticulatedAcquiredFieldC
    control_field: ArticulatedAcquiredFieldC
    inventory_before_field: ArticulatedAcquiredFieldC | None = None
    inventory_after_field: ArticulatedAcquiredFieldC | None = None
    pickup_field: ArticulatedAcquiredFieldC | None = None
    geometry_before_field: ArticulatedAcquiredFieldC | None = None
    geometry_after_field: ArticulatedAcquiredFieldC | None = None
    placement_field: ArticulatedAcquiredFieldC | None = None


class AnchorFrontierInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_frontier_input_c.v1"
    why: CoupledParentWhyC
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    native_request: AnchorRequest
    facet: AnchorObservedFacetC
    native_fields: tuple[AnchorFrontierFieldC,...] = Field(min_length=1,max_length=32)
    publication_binding: LatentOwnerPublicationBindingC | None = None
    receipt_claim_ref: Ref
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)


class AnchorFrontierFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_frontier_facts_c.v1"
    request: AnchorFrontierInputC
    facts: FrozenMap
    evidence_refs: tuple[Ref,...] = ()
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class AnchorFrontierCalculationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_frontier_calculation_c.v1"
    measured: AnchorFrontierFactsC
    returned: MechanicalNormalizedReturn | None = None


class AnchorFrontierReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_frontier_return_c.v1"
    measured: AnchorFrontierFactsC
    returned: MechanicalNormalizedReturn | None = None
    parent_return: FrozenMap
    missing_refs: tuple[Ref,...] = ()
    action_authority: None = None


class AnchorFrontierInterpretationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_frontier_interpretation_c.v1"
    calculated: AnchorFrontierReturnC
    meaning: DeclaredMeaningInstantiation | None = None


class AnchorFrontierPublicationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_frontier_publication_c.v1"
    returned: AnchorFrontierReturnC
    publication_request: FamilyEffectPublicationRequest | None = None
    facts: FrozenMap
    missing_refs: tuple[Ref,...] = ()


class AnchorFrontierPublicationJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_frontier_publication_join_c.v1"
    publication: AnchorFrontierPublicationC
    published: FamilyEffectPublicationResult | None = None


class AnchorFrontierAgendaInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_frontier_agenda_input_c.v1"
    returned: AnchorFrontierReturnC
    published: FrozenMap | None = None


class AnchorFrontierAgendaRequestC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_frontier_agenda_request_c.v1"
    request: AgendaReceiptInputRoot
