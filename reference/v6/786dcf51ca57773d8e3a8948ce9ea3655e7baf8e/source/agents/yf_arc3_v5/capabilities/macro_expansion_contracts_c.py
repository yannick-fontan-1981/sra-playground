"""Finite Source-declared quotient and exact primitive expansion witnesses."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_common_contracts_c import SearchStateC, SearchWitnessC, SimulationPathInputC, MechanicalPredicateC


class MacroMemberC(FrozenModel):
    member_ref: Ref
    abstract_state_ref: Ref
    underlying: SearchStateC
    observation_ref: Ref | None = None


class MacroEdgeC(FrozenModel):
    member_ref: Ref
    macro_ref: Ref
    response_ref: Ref
    successor_member_ref: Ref
    cost: int = Field(ge=0)
    primitive_path: SimulationPathInputC


class MacroDefinitionC(FrozenModel):
    cost_metric_ref: Ref
    members: tuple[MacroMemberC, ...] = Field(min_length=1, max_length=4096)
    macro_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    edges: tuple[MacroEdgeC, ...] = Field(max_length=65536)
    response_domains: FrozenMap
    primitive_payload_input_ref: Ref
    relevant_predicates: tuple[MechanicalPredicateC, ...] = Field(min_length=1, max_length=128)
    acceptance_predicates: tuple[MechanicalPredicateC, ...] = Field(min_length=1, max_length=128)
    trace_predicates: tuple[MechanicalPredicateC, ...] = Field(max_length=128)
    predicate_domain_complete: bool
    member_domain_complete: bool
    transition_domain_complete: bool
    event_free_walk: bool
    motion_paths: tuple[tuple[str | int, ...], ...] = Field(default=(), max_length=128)
    evidence_refs: tuple[Ref, ...]


class MacroExpansionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.macro_expansion_input_c.v1"
    request: MechanicalRequestIdentity
    definition: MacroDefinitionC
    retained_model_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    initial_member_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    witness: SearchWitnessC


class MacroExpansionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.macro_expansion_facts_c.v1"
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    expansions: tuple[FrozenMap, ...]
    checked_edge_refs: tuple[tuple[Ref, Ref, Ref], ...]


class MacroExpansionReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.macro_expansion_return_input_c.v1"
    request: MacroExpansionInputC
    measured: MacroExpansionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_reason_ref: Ref
    source_word_admissible: bool


class MacroExpansionReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.macro_expansion_return_c.v1"
    frozen_request: MacroExpansionInputC
    frozen_measurement: MacroExpansionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_reason_ref: Ref
    admissible_expansions: tuple[FrozenMap, ...]
    physical_action_release: None = None
