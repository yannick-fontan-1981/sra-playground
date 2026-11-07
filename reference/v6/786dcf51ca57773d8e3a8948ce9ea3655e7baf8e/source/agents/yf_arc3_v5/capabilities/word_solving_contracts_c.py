"""Source-owned word relation, partitions and current edit evidence."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .typed_word_transduction import TypedWordRequest, TypedWordExample
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_agenda_projection import FamilyAgendaSnapshot, FamilyAgendaDemand
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .family_result_join import FamilyJoinGroup, FamilyJoinRequest, FamilyJoinResult
from agents.yf_arc3_v5.logos.operations import PropagationReport

class WordRelationContractC(FrozenModel):
    input_word: tuple[Ref, ...] = Field(max_length=4096)
    desired_output_word: tuple[Ref, ...] = Field(max_length=4096)
    input_type_ref: Ref
    output_type_ref: Ref
    type_pipeline: tuple[Ref, ...] = Field(min_length=2, max_length=17)
    fixed_examples: tuple[TypedWordExample, ...] = Field(max_length=128)
    connector_evidence_refs: tuple[Ref, ...]
    relation_evidence_refs: tuple[Ref, ...]
    fixed_example_evidence_refs: tuple[Ref, ...]
    evidence_revision_ref: Ref

class WordSideBindingC(FrozenModel):
    side_ref: Ref
    rule_ref: Ref
    side: Literal["LEFT", "RIGHT"]
    type_ref: Ref
    glyph_refs: tuple[Ref, ...] = Field(max_length=64)
    edit_unit_ref: Ref | None
    partition_evidence_refs: tuple[Ref, ...]
    tile_frame_evidence_refs: tuple[Ref, ...]

class WordEditEvidenceC(FrozenModel):
    unit_ref: Ref
    observed_phase_ref: Ref
    focus_evidence_refs: tuple[Ref, ...]
    effect_evidence_refs: tuple[Ref, ...]
    fixed_example_preservation_refs: tuple[Ref, ...]
    sealed: bool
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    # Difference constraints are supplied and checked against every whole-side phase.
    cyclic_modulus: int | None = Field(default=None, ge=1)
    symbol_values: FrozenMap = Field(default_factory=FrozenMap)
    shared_side_evidence_refs: tuple[Ref, ...] = ()

class WordDerivationUseC(FrozenModel):
    derivation_ref: Ref
    rule_refs: tuple[Ref, ...] = Field(max_length=512)
    rule_revision_by_ref: FrozenMap
    evidence_refs: tuple[Ref, ...]

class WordJoinSupportC(FrozenModel):
    candidate_ref: Ref
    native_row_path: tuple[Ref | int, ...] = Field(min_length=1, max_length=12)
    assignment_paths: FrozenMap = Field(default_factory=FrozenMap)
    resource_paths: FrozenMap = Field(default_factory=FrozenMap)
    evidence_refs: tuple[Ref, ...]

class WordPreservedUnitC(FrozenModel):
    unit_ref: Ref
    preservation_ref: Ref
    supporting_derivation_refs: tuple[Ref, ...]
    evidence_refs: tuple[Ref, ...]

class WordSolvingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_solving_input_c.v1"
    why: CoupledParentWhyC
    native_request: TypedWordRequest
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    relation_contract: WordRelationContractC
    side_bindings: tuple[WordSideBindingC, ...] = Field(default=(), max_length=1024)
    edit_evidence: tuple[WordEditEvidenceC, ...] = Field(default=(), max_length=128)
    transform_evidence_by_ref: FrozenMap = Field(default_factory=FrozenMap)
    current_rule_revisions: FrozenMap = Field(default_factory=FrozenMap)
    derivation_uses: tuple[WordDerivationUseC, ...] = Field(default=(), max_length=512)
    preserved_units: tuple[WordPreservedUnitC, ...] = Field(default=(), max_length=128)
    peer_groups: tuple[FamilyJoinGroup, ...] = Field(default=(), max_length=127)
    join_supports: tuple[WordJoinSupportC, ...] = Field(default=(), max_length=128)
    join_request_ref: Ref | None = None
    maximum_join_pairs: int = Field(default=0, ge=0, le=65536)
    maximum_join_candidates: int = Field(default=0, ge=0, le=4096)

class WordSolvingFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_solving_facts_c.v1"
    frozen_input: WordSolvingInputC
    facts: FrozenMap
    partition_rows: tuple[FrozenMap, ...]
    invalidated_derivation_refs: tuple[Ref, ...]
    preserved_derivation_refs: tuple[Ref, ...]
    missing_refs: tuple[Ref, ...]

class WordSolvingBindInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_solving_bind_input_c.v1"
    measured: WordSolvingFactsC

class WordSolvingFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_solving_finish_input_c.v1"
    measured: WordSolvingFactsC
    returned: MechanicalNormalizedReturn | None

class WordSolvingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_solving_return_c.v1"
    frozen_measurement: WordSolvingFactsC
    returned: MechanicalNormalizedReturn | None
    receipt: FrozenMap
    next_item_ref: Ref
    sibling_item_refs: tuple[Ref, ...]
    result_reasons: FrozenMap = Field(default_factory=FrozenMap)
    family_join_request: FamilyJoinRequest | None = None
    family_join_result: FamilyJoinResult | None = None
    composition_missing_refs: tuple[Ref, ...] = ()
    proposed_action: None = None

class WordJoinFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_join_facts_c.v1"
    returned: WordSolvingReturnC
    facts: FrozenMap

class WordJoinInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_join_input_c.v1"
    returned: WordSolvingReturnC

class WordJoinReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_join_return_input_c.v1"
    returned: WordSolvingReturnC
    joined: FamilyJoinResult

class WordDependencyPublicationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_dependency_publication_c.v1"
    measured: WordSolvingFactsC
    rows: tuple[FrozenMap, ...]
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]

class WordDependencyReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_dependency_return_c.v1"
    measured: WordSolvingFactsC
    propagation: PropagationReport | None = None
    missing_refs: tuple[Ref, ...] = ()

class WordDependencyBindInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.word_dependency_bind_input_c.v1"
    returned: WordDependencyReturnC
