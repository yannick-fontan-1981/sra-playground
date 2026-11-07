"""Goal strategy for K79 over the established D profile and canonical agenda."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .family_agenda_projection import FamilyAgendaSnapshot, FamilyAgendaDemand
from .mechanical_profile_d import DNativeProfileRequest, DNativeProfileContribution
from .prefix_query_bridge_contracts_c import PrefixQuerySourceInputC, PrefixQuerySourceReturnC

class PrefixTerminalContractC(FrozenModel):
    quantifier: Literal["ALL_REQUIRED_PREFIXES_AND_TARGET_PROJECTION"]
    hidden_decomposition_required: Literal[False] = False
    persistence_scope_ref: Ref
    event_scope_ref: Ref
    evidence_revision_ref: Ref
    quantifier_evidence_refs: tuple[Ref, ...]
    persistence_evidence_refs: tuple[Ref, ...]
    event_evidence_refs: tuple[Ref, ...]
    model_target_digests: FrozenMap
    required_prefix_lengths: FrozenMap

class PrefixConstructionWitnessC(FrozenModel):
    model_ref: Ref
    global_thread_colors: tuple[tuple[Ref, int], ...] = Field(max_length=32)
    crossing_owners: tuple[tuple[tuple[int, int], Ref], ...] = Field(max_length=4096)
    current_selection_evidence_refs: tuple[Ref, ...]

class PrefixSolvingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.prefix_solving_input_c.v1"
    profile: DNativeProfileRequest
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    terminal_contract: PrefixTerminalContractC
    inverse_returns: tuple[DNativeProfileContribution, ...] = Field(default=(), max_length=32)
    construction_witnesses: tuple[PrefixConstructionWitnessC, ...] = Field(default=(), max_length=32)
    query_bridge: PrefixQuerySourceInputC | None = None

class PrefixSolvingFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.prefix_solving_facts_c.v1"
    frozen_input: PrefixSolvingInputC
    facts: FrozenMap
    construction_reasons: tuple[FrozenMap, ...]
    missing_refs: tuple[Ref, ...]

class PrefixSolvingBindInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.prefix_solving_bind_input_c.v1"
    measured: PrefixSolvingFactsC

class PrefixSolvingFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.prefix_solving_finish_input_c.v1"
    measured: PrefixSolvingFactsC
    profile_return: DNativeProfileContribution | None
    query_return: PrefixQuerySourceReturnC | None

class PrefixSolvingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.prefix_solving_return_c.v1"
    frozen_measurement: PrefixSolvingFactsC
    profile_return: DNativeProfileContribution | None
    query_return: PrefixQuerySourceReturnC | None
    next_item_ref: Ref
    sibling_item_refs: tuple[Ref, ...]
    root_witnesses: tuple[FrozenMap, ...] = Field(max_length=3)
    proposed_action: None = None
