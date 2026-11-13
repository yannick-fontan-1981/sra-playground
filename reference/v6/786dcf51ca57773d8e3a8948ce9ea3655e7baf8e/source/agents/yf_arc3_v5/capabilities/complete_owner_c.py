"""Compare ownership contracts and K03 receipts; Source grants all execution dispositions."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_family_contracts_d import d_map
from .mechanical_event_composition_c import packet_context_equal
from .complete_owner_contracts_c import (
    CompleteOwnerInputC, CompleteOwnerFactsC, CompleteOwnerBindingInputC, CompleteOwnerBindingC,
    CompleteOwnerReconciliationInputC, CompleteOwnerReturnInputC, CompleteOwnerReturnC)


def measure_complete_owner(value: CompleteOwnerInputC) -> CompleteOwnerFactsC:
    identity = value.request
    inherited = value.inherited_phase_refs
    current = (identity.mode == "STEP" and bool(value.current_contract_evidence_refs)
        and packet_context_equal(value.parent_request, identity, value.model_ref)
        and identity.immutable_inputs.get("state") == value.initial_state
        and identity.immutable_inputs.get("inherited_phase_refs") == inherited
        and len(set(inherited)) == len(inherited)
        and identity.immutable_inputs.get("preservation_constraint_refs") == value.preservation_constraint_refs
        and identity.immutable_inputs.get("unknown_boundary_refs") == value.unknown_boundary_refs
        and identity.immutable_inputs.get("trace_predicates_digest") == stable_digest(tuple(d_map(item) for item in value.trace_predicates)))
    delegated = (current and value.delegation_requested is True and value.adapter_operation_ref is not None
        and bool(value.registration_evidence_refs) and value.adapter_operation_ref in value.registered_adapter_operation_refs
        and identity.operation_ref == value.adapter_operation_ref
        and identity.immutable_inputs.get("complete_external_adapter_operation_ref") == value.adapter_operation_ref
        and identity.immutable_inputs.get("event_owner_ref") == value.event_owner_ref
        and bool(value.prebound_event_producers)
        and all(isinstance(value.prebound_event_producers[key], str) and bool(value.prebound_event_producers[key])
            for key in sorted(value.prebound_event_producers))
        and identity.immutable_inputs.get("event_producer_bindings") == value.prebound_event_producers
        and identity.immutable_inputs.get("other_adapter_case_refs") == ())
    inherited_mode = (current and value.delegation_requested is False and value.adapter_operation_ref is None
        and identity.immutable_inputs.get("complete_external_adapter_operation_ref") is None
        and identity.immutable_inputs.get("other_adapter_case_refs") == ())
    return CompleteOwnerFactsC(facts=FrozenMap({"current_contract": current,
        "inherited_licensed": inherited_mode, "delegated_licensed": delegated,
        "binding_qualified": inherited_mode or delegated}))


def assemble_complete_owner_binding(value: CompleteOwnerBindingInputC) -> CompleteOwnerBindingC:
    return CompleteOwnerBindingC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref,
        source_reason_ref=value.source_reason_ref,
        active_inherited_phase_refs=value.request.inherited_phase_refs if value.source_inherited_execution_allowed else (),
        suppressed_inherited_phase_refs=value.request.inherited_phase_refs if value.source_inherited_execution_suppressed else ())


def measure_complete_owner_return(value: CompleteOwnerReconciliationInputC) -> CompleteOwnerFactsC:
    binding, packet, composition = value.binding, value.packet, value.composition
    contract = binding.frozen_request
    current = measure_complete_owner(contract).facts["delegated_licensed"]
    pending = (binding.source_disposition_ref == "complete_owner.delegated_pending"
        and not binding.active_inherited_phase_refs and binding.suppressed_inherited_phase_refs == contract.inherited_phase_refs)
    unused = contract.request.request_ref not in value.consumed_binding_refs
    exact_packet = (packet is not None and packet.request == contract.request
        and packet.parent_request == contract.parent_request and packet.model_ref == contract.model_ref
        and packet.before == contract.initial_state and packet.complete and not packet.missing_refs and bool(packet.events))
    owners = (exact_packet and all(contract.prebound_event_producers.get(event.occurrence_ref) == event.producer_ref
        for event in packet.events))
    unique_events, seen = [], set()
    if exact_packet:
        for event in packet.events:
            if event.occurrence_ref not in seen:
                seen.add(event.occurrence_ref)
                unique_events.append(event)
    composed = (owners and composition is not None and composition.request == contract.parent_request
        and composition.complete and not composition.bounded and not composition.contradictory
        and not composition.missing_refs and not composition.failed_predicate_refs
        and composition.state == packet.after and composition.primitive_count == composition.packet_cursor == 1
        and composition.cost == packet.cost and composition.events == tuple(unique_events)
        and composition.facts.get("trace_predicates_digest") == stable_digest(tuple(d_map(item) for item in contract.trace_predicates))
        and composition.consumed_request_delta == (contract.request.request_ref,))
    return CompleteOwnerFactsC(facts=FrozenMap({"delegated_binding_current": current, "delegated_pending": pending,
        "binding_not_consumed": unused, "exact_owned_packet": owners, "collector_consumed_once": composed,
        "calculation_discharge_qualified": current and pending and unused and composed}))


def assemble_complete_owner_return(value: CompleteOwnerReturnInputC) -> CompleteOwnerReturnC:
    contract = value.request.binding.frozen_request
    return CompleteOwnerReturnC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref,
        source_reason_ref=value.source_reason_ref,
        discharged_calculation_phase_refs=contract.inherited_phase_refs if value.source_calculation_discharge_allowed else (),
        consumed_binding_delta=(contract.request.request_ref,) if value.source_calculation_discharge_allowed else ())
