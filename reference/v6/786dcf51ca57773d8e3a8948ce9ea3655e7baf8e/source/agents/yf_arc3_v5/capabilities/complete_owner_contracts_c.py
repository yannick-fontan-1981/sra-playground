"""One Source-bound full primitive owner; calculation discharge is not physical sealing."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_common_contracts_c import ExternalPrimitivePacketC, EventCompositionResultC, MechanicalPredicateC


class CompleteOwnerInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.complete_owner_input_c.v1"
    request: MechanicalRequestIdentity
    parent_request: MechanicalRequestIdentity
    model_ref: Ref
    initial_state: FrozenMap
    delegation_requested: bool | None
    adapter_operation_ref: Ref | None
    registered_adapter_operation_refs: tuple[Ref, ...] = Field(max_length=128)
    registration_evidence_refs: tuple[Ref, ...]
    current_contract_evidence_refs: tuple[Ref, ...]
    event_owner_ref: Ref
    prebound_event_producers: FrozenMap
    inherited_phase_refs: tuple[Ref, ...] = Field(min_length=1, max_length=64)
    trace_predicates: tuple[MechanicalPredicateC, ...] = Field(max_length=128)
    unknown_boundary_refs: tuple[Ref, ...] = Field(max_length=128)
    preservation_constraint_refs: tuple[Ref, ...] = Field(max_length=128)


class CompleteOwnerFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.complete_owner_facts_c.v1"
    facts: FrozenMap


class CompleteOwnerBindingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.complete_owner_binding_input_c.v1"
    request: CompleteOwnerInputC
    measured: CompleteOwnerFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_reason_ref: Ref
    source_inherited_execution_allowed: bool
    source_inherited_execution_suppressed: bool


class CompleteOwnerBindingC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.complete_owner_binding_c.v1"
    frozen_request: CompleteOwnerInputC
    frozen_measurement: CompleteOwnerFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_reason_ref: Ref
    active_inherited_phase_refs: tuple[Ref, ...]
    suppressed_inherited_phase_refs: tuple[Ref, ...]
    proposed_action: None = None


class CompleteOwnerReconciliationInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.complete_owner_reconciliation_input_c.v1"
    binding: CompleteOwnerBindingC
    packet: ExternalPrimitivePacketC | None
    composition: EventCompositionResultC | None
    consumed_binding_refs: tuple[Ref, ...] = ()


class CompleteOwnerReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.complete_owner_return_input_c.v1"
    request: CompleteOwnerReconciliationInputC
    measured: CompleteOwnerFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_reason_ref: Ref
    source_calculation_discharge_allowed: bool


class CompleteOwnerReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.complete_owner_return_c.v1"
    frozen_request: CompleteOwnerReconciliationInputC
    frozen_measurement: CompleteOwnerFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_reason_ref: Ref
    discharged_calculation_phase_refs: tuple[Ref, ...]
    consumed_binding_delta: tuple[Ref, ...]
    physical_sealed_or_action_release: None = None
