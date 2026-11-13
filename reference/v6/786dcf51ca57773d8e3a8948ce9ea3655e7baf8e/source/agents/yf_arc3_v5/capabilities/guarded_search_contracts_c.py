"""Source algorithm choice and immutable calculation return; no physical release."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_common_contracts_c import SearchDomainInputC, SearchResultC
from .finite_search_contracts_c import FiniteSearchInputC, FiniteSearchFactsC


class GuardedSearchInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.guarded_search_input_c.v1"
    request: MechanicalRequestIdentity
    requested_algorithm_ref: Ref | None
    query: SearchDomainInputC | None
    finite_query: FiniteSearchInputC | None
    evidence_refs: tuple[Ref, ...] = Field(max_length=128)


class GuardedSearchFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.guarded_search_facts_c.v1"
    facts: FrozenMap


class GuardedSearchReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.guarded_search_return_input_c.v1"
    request: GuardedSearchInputC
    measured: GuardedSearchFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_reason_ref: Ref
    search_result: SearchResultC | None = None
    finite_result: FiniteSearchFactsC | None = None


class GuardedSearchReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.guarded_search_return_c.v1"
    frozen_request: GuardedSearchInputC
    frozen_measurement: GuardedSearchFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_reason_ref: Ref
    search_result: SearchResultC | None
    finite_result: FiniteSearchFactsC | None
    physical_action_release: None = None
