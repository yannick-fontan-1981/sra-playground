"""K79 Source bridge to native facts and the existing C search interface."""
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .layered_prefix_construction import LayeredPrefixRequest
from .mechanical_family_contracts_d import DMechanicalResult
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .prefix_step_contracts_c import PrefixStepMeasurementC


class PrefixQuerySourceInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.prefix_query_source_input_c.v1"
    request: LayeredPrefixRequest
    serving_k03: bool
    current_binding_evidence_refs: tuple[Ref, ...]
    schedule_step_receipts: tuple[PrefixStepMeasurementC, ...] = ()


class PrefixQuerySourceFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.prefix_query_source_facts_c.v1"
    facts: FrozenMap


class PrefixQuerySourceFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.prefix_query_source_finish_input_c.v1"
    request: PrefixQuerySourceInputC
    native: DMechanicalResult | None
    search: MechanicalNormalizedReturn | None
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_reason_ref: Ref


class PrefixQuerySourceReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.prefix_query_source_return_c.v1"
    frozen_request: PrefixQuerySourceInputC
    native: DMechanicalResult | None
    search: MechanicalNormalizedReturn | None
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_reason_ref: Ref
    proposed_action: None = None
