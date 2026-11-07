"""Actual sealed typed-word frontier inputs; source meanings remain separate."""
from __future__ import annotations
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .typed_word_transduction import TypedWordRequest,TypedWordRule,TypedWordExample,WordTile
from .articulated_solving_contracts_c import ArticulatedAcquiredFieldC
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_agenda_projection import FamilyAgendaSnapshot,FamilyAgendaDemand
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .latent_solving_contracts_c import LatentOwnerPublicationBindingC
from ..drm.meaning import DeclaredMeaningInstantiation
from .family_effect_publication_contracts import FamilyEffectPublicationRequest,FamilyEffectPublicationResult
from .agenda_receipt_contracts_root import AgendaReceiptInputRoot


class WordObservedSceneC(FrozenModel):
    scene_ref: Ref
    rules: tuple[TypedWordRule,...] = Field(max_length=512)
    examples: tuple[TypedWordExample,...] = Field(max_length=128)
    tiles: tuple[WordTile,...] = Field(max_length=256)
    focus_unit_ref: Ref | None = None
    phase_by_unit_ref: FrozenMap
    display_orientation_by_glyph_ref: FrozenMap
    feedback_colour_by_glyph_ref: FrozenMap
    glyph_positions: FrozenMap
    highlighted_spans: tuple[tuple[int,int,Ref],...] = Field(max_length=512)

    @model_validator(mode='after')
    def unique_scene_references(self):
        for rows,key in ((self.rules,'rule_ref'),(self.tiles,'glyph_ref')):
            if len({getattr(row,key) for row in rows})!=len(rows):
                raise ValueError('observed word scene references must be unique')
        if any(start<0 or end<start for start,end,_ in self.highlighted_spans):
            raise ValueError('observed highlighted spans require ordered nonnegative endpoints')
        return self


class WordFrontierFieldC(FrozenModel):
    native_field_ref: Ref
    acquisition: ArticulatedAcquiredFieldC


class WordObservedFacetC(FrozenModel):
    packet_term_ref: Ref
    packet_projection_contract_ref: Ref
    state_projection_contract_ref: Ref
    expected_packet_fields: FrozenMap
    transactions: tuple[FrozenMap,...] = Field(min_length=1,max_length=64)
    transaction_index: int = Field(ge=0,le=63)
    before_field: ArticulatedAcquiredFieldC
    after_field: ArticulatedAcquiredFieldC
    control_field: ArticulatedAcquiredFieldC
    acceptance_field: ArticulatedAcquiredFieldC | None = None


class WordFrontierInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_frontier_input_c.v1"
    why: CoupledParentWhyC
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    native_request: TypedWordRequest
    facet: WordObservedFacetC
    native_fields: tuple[WordFrontierFieldC,...] = Field(min_length=1,max_length=32)
    derivation_request: TypedWordRequest | None = None
    derivation_fields: tuple[WordFrontierFieldC,...] = Field(default=(),max_length=4)
    native_scene_ref: Ref
    publication_binding: LatentOwnerPublicationBindingC | None = None
    receipt_claim_ref: Ref
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)


class WordFrontierFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_frontier_facts_c.v1"
    request: WordFrontierInputC
    facts: FrozenMap
    evidence_refs: tuple[Ref,...] = ()
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)
    canonical_before_request: TypedWordRequest | None = None
    canonical_after_request: TypedWordRequest | None = None
    derivation_request: TypedWordRequest | None = None


class WordFrontierCalculationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_frontier_calculation_c.v1"
    measured: WordFrontierFactsC
    returned: MechanicalNormalizedReturn | None = None


class WordFrontierCanonicalInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_frontier_canonical_input_c.v1"
    returned: WordFrontierReturnC
    before_return: MechanicalNormalizedReturn | None = None
    after_return: MechanicalNormalizedReturn | None = None
    derivation_return: MechanicalNormalizedReturn | None = None


class WordFrontierReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_frontier_return_c.v1"
    measured: WordFrontierFactsC
    returned: MechanicalNormalizedReturn | None = None
    parent_return: FrozenMap
    missing_refs: tuple[Ref,...] = ()
    action_authority: None = None


WordFrontierCanonicalInputC.model_rebuild()


class WordFrontierInterpretationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_frontier_interpretation_c.v1"
    calculated: WordFrontierReturnC
    meaning: DeclaredMeaningInstantiation | None = None


class WordFrontierPublicationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_frontier_publication_c.v1"
    returned: WordFrontierReturnC
    publication_request: FamilyEffectPublicationRequest | None = None
    facts: FrozenMap
    missing_refs: tuple[Ref,...] = ()


class WordFrontierPublicationJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_frontier_publication_join_c.v1"
    publication: WordFrontierPublicationC
    published: FamilyEffectPublicationResult | None = None


class WordFrontierAgendaInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_frontier_agenda_input_c.v1"
    returned: WordFrontierReturnC
    published: FrozenMap | None = None


class WordFrontierAgendaRequestC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_frontier_agenda_request_c.v1"
    request: AgendaReceiptInputRoot
