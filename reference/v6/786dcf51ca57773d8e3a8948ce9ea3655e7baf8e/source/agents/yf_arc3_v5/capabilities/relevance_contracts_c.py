"""Exact reconciliation and finite-wait data, with no restart threshold."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref


class WaitContractC(FrozenModel):
    wait_ref: Ref
    epoch: int = Field(ge=0)
    scope_ref: Ref
    expected_event_ref: Ref
    clock_effect_evidence_ref: Ref
    protected_condition_refs: tuple[Ref, ...]
    initial_input_budget: int = Field(ge=0, le=65536)
    initial_time_budget: int = Field(ge=0, le=65536)


class InputAcknowledgementC(FrozenModel):
    occurrence_ref: Ref
    acknowledgement_ref: Ref
    epoch: int = Field(ge=0)
    scope_ref: Ref
    elapsed_ticks: int = Field(ge=0, le=65536)


class RelevanceStateC(FrozenModel):
    epoch: int = Field(ge=0)
    scope_ref: Ref
    evidence_revision: int = Field(ge=0)
    irrelevant_count: int = Field(default=0, ge=0)
    consumed_occurrence_refs: tuple[Ref, ...] = ()
    pending_occurrence_refs: tuple[Ref, ...] = ()
    wait_contract: WaitContractC | None = None
    wait_acknowledgements: tuple[InputAcknowledgementC, ...] = ()


class RelevanceInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relevance_input_c.v1"
    state: RelevanceStateC
    packet_epoch: int = Field(ge=0)
    packet_scope_ref: Ref
    packet_revision: int = Field(ge=0)
    external_occurrence_refs: tuple[Ref, ...] = Field(default=(), max_length=1024)
    endpoint_sealed: bool
    explanation_processed: bool
    lease_current: bool
    successor_before: FrozenMap
    successor_after: FrozenMap
    useful_contribution: bool | None
    named_information_gain: bool | None
    justified_temporal_progress: bool | None
    justified_service_progress: bool | None
    acknowledgements: tuple[InputAcknowledgementC, ...] = Field(default=(), max_length=1024)


class RelevanceFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relevance_facts_c.v1"
    facts: FrozenMap
    new_occurrence_refs: tuple[Ref, ...]
    acknowledgements: tuple[InputAcknowledgementC, ...]
    wait_remaining_inputs: int | None
    wait_remaining_time: int | None


class RelevanceDeltaInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relevance_delta_input_c.v1"
    request: RelevanceInputC
    measured: RelevanceFactsC
    disposition_ref: Ref
    wait_status_ref: Ref


class RelevanceDeltaC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relevance_delta_c.v1"
    state: RelevanceStateC
    disposition_ref: Ref
    wait_status_ref: Ref
    successor_after: FrozenMap | None
    archived_packet_epoch: int | None
    wait_remaining_inputs: int | None
    wait_remaining_time: int | None
    proposed_action: None = None
    proposed_reset: None = None
