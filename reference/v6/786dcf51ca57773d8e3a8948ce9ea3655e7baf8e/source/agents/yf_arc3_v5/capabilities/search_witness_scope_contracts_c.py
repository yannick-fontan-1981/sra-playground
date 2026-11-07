"""Current Source authorization is separate from a calculated search witness."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_common_contracts_c import SearchDomainInputC, SearchResultC


class AdditionalSearchBoundReceiptC(FrozenModel):
    bound_ref: Ref
    request_ref: Ref
    epoch: int = Field(ge=0)
    input_revision_ref: Ref
    measured_count: int | None = Field(default=None, ge=0)
    measurement_evidence_refs: tuple[Ref, ...]


class SearchWitnessScopeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.search_witness_scope_input_c.v1"
    domain: SearchDomainInputC
    result: SearchResultC
    current_request: MechanicalRequestIdentity
    authorized_witness_ref: Ref | None
    authorized_prefix: tuple[Ref, ...] = Field(max_length=1024)
    authorization_evidence_refs: tuple[Ref, ...]
    additional_bound_receipts: tuple[AdditionalSearchBoundReceiptC, ...] = Field(max_length=16)


class SearchWitnessScopeFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.search_witness_scope_facts_c.v1"
    facts: FrozenMap
    root_witness_rows: tuple[FrozenMap, ...]
    bound_rows: tuple[FrozenMap, ...]


class SearchWitnessScopeDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.search_witness_scope_decision_input_c.v1"
    request: SearchWitnessScopeInputC
    measured: SearchWitnessScopeFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class SearchWitnessScopeDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.search_witness_scope_decision_c.v1"
    frozen_request: SearchWitnessScopeInputC
    frozen_measurement: SearchWitnessScopeFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    engagement_prefix: tuple[Ref, ...]
    proposed_action: None = None
    optimality_or_impossibility_claim: None = None
