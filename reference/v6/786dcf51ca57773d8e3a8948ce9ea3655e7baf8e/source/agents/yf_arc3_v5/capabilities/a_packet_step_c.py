"""Compare and transport the already produced A packet, without world recomputation."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data
from .inventory_gated_navigation import _identity_missing
from .complete_owner_c import measure_complete_owner
from .mechanical_common_contracts_c import ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_transport_c import packet_payload
from .a_packet_step_contracts_c import (APacketStepInputC, APacketStepFactsC, APacketStepMeasurementC,
    APacketStepDecodeInputC, APacketStepResponseInputC, APacketStepFinishInputC, APacketStepDispatchC)


def measure_a_packet_step_signature(value: APacketStepInputC) -> APacketStepFactsC:
    native, identity, binding = value.native_request, value.request, value.owner_binding
    scope = native.scope
    models = tuple(item for item in native.models if item.model_ref == native.bound_model_ref)
    commands = tuple(command for model in models for command in model.commands if command.input_ref == native.input_ref)
    native_bounds = FrozenMap({"maximum_evaluations": native.maximum_evaluations,
        "maximum_states": native.maximum_states, "maximum_depth": native.maximum_depth})
    native_goal = getattr(native, "source_goal_acceptance_contract_ref", None)
    goal = value.source_goal_acceptance_contract_ref
    exact = (not _identity_missing(native, value.model_assignment_ref)
        and native.step_identity == identity and native.parent_identity == value.parent_request
        and native.kernel_ref == identity.kernel_ref == value.native_kernel_ref
        and native.operation_ref == identity.operation_ref and native.mode == identity.mode == "STEP"
        and identity.expected_return_type == "MechanicalFamilyResult"
        and scope.parent_goal_ref == value.source_parent_goal_ref
        and identity.immutable_inputs.get("next_item_ref") == value.source_next_item_ref
        and scope.model_revision_ref == value.model_revision_ref and scope.model_status_ref == value.model_status_ref
        and scope.input_domain_complete and identity.request_ref not in scope.consumed_request_refs
        and len(models) == len(commands) == 1 and len({item.model_ref for item in native.models}) == len(native.models)
        and identity.immutable_inputs.get("native_models") == immutable_json_data(native.models)
        and identity.immutable_inputs.get("native_bound_descriptor") == native_bounds
        and native_goal == goal and (goal is None or (
            identity.immutable_inputs.get("packet_acceptance_contract_ref") == goal
            and value.parent_request.immutable_inputs.get("packet_acceptance_contract_ref") == goal))
        and binding.frozen_request.request == identity
        and binding.frozen_request.parent_request == value.parent_request
        and binding.frozen_request.model_ref == native.bound_model_ref
        and binding.frozen_request.initial_state == immutable_json_data(native.state)
        and binding.frozen_request.event_owner_ref == scope.event_owner_ref
        and binding.frozen_request.inherited_phase_refs == value.inherited_phase_refs
        and binding.source_disposition_ref == "complete_owner.delegated_pending"
        and not binding.active_inherited_phase_refs
        and binding.suppressed_inherited_phase_refs == value.inherited_phase_refs
        and measure_complete_owner(binding.frozen_request).facts["delegated_licensed"])
    return APacketStepFactsC(facts=FrozenMap({"operation_ref": identity.operation_ref,
        "kernel_ref": identity.kernel_ref, "model_assignment_ref": value.model_assignment_ref,
        "native_packet_field_ref": value.native_packet_field_ref, "native_cost_field_ref": value.native_cost_field_ref,
        "native_status_ref": native.state.status if native.state is not None else None,
        "exact_prebound_native_signature": exact}))


def unsupported_a_packet_step(value: APacketStepInputC) -> APacketStepMeasurementC:
    return APacketStepMeasurementC(frozen_request=value, native=None, packet=None,
        missing_refs=("exact_prebound_a_packet_signature",),
        facts=FrozenMap({"packet_complete": False, "native_bound": False}))


def decode_a_packet_step(value: APacketStepDecodeInputC) -> APacketStepMeasurementC:
    request, native = value.request, value.native
    missing = set(native.prerequisite_refs) | set(native.implementation_debt_refs)
    if not measure_a_packet_step_signature(request).facts["exact_prebound_native_signature"]:
        missing.add("current_prebound_a_packet_signature")
    if (native.scope != request.native_request.scope or native.operation_ref != request.request.operation_ref
            or native.mode != "STEP" or not native.signature_supported):
        missing.add("exact_native_return_scope_signature")
    packet = None
    raw = native.values.get(request.native_packet_field_ref)
    if raw is not None:
        try:
            packet = ExternalPrimitivePacketC.model_validate(raw)
        except ValidationError:
            missing.add("malformed_native_primitive_packet")
    else:
        missing.add("native_primitive_packet")
    if packet is not None:
        owner = request.owner_binding.frozen_request
        debit = native.values.get(request.native_cost_field_ref)
        command = request.request.immutable_inputs.get("command")
        if (packet.request != request.request or packet.parent_request != request.parent_request
                or packet.model_ref != request.native_request.bound_model_ref
                or not isinstance(command, FrozenMap) or packet.action_ref != command.get("action_ref")
                or packet.primitive_ref != request.native_request.input_ref
                or packet.source_goal_acceptance_contract_ref != request.source_goal_acceptance_contract_ref
                or packet.before != owner.initial_state
                or packet.after != native.values.get("after_state")
                or type(debit) is not int or packet.cost != debit
                or any(owner.prebound_event_producers.get(event.occurrence_ref) != event.producer_ref
                    or event.producer_ref != owner.event_owner_ref for event in packet.events)):
            missing.add("exact_owned_a_packet_state_cost_identity")
        if any(tuple(event.costs) not in ((), ("primitive_cost",))
                or any(type(event.costs[key]) is not int or event.costs[key] < 0 for key in sorted(event.costs))
                for event in packet.events):
            missing.add("native_primitive_debit_domain")
        elif sum(event.costs.get("primitive_cost", 0) for event in packet.events) != packet.cost:
            missing.add("native_primitive_debit_once")
        if len(packet.events) > request.request.actual_bounds.get("max_events", 0):
            missing.add("native_event_transport_bound")
        missing.update(packet.missing_refs)
        if not packet.complete:
            missing.add("incomplete_native_primitive_closure")
    if not native.domain_complete:
        missing.add("incomplete_native_domain")
    complete = packet is not None and not missing and not native.computation_bound_reached
    return APacketStepMeasurementC(frozen_request=request, native=native, packet=packet,
        missing_refs=tuple(sorted(missing)), facts=FrozenMap({"packet_complete": complete,
            "native_bound": native.computation_bound_reached,
            "native_signature_supported": native.signature_supported,
            "native_domain_complete": native.domain_complete}))


def assemble_a_packet_step_response(value: APacketStepResponseInputC) -> MechanicalResponseInput:
    measured = value.measured
    return MechanicalResponseInput(request=measured.frozen_request.request,
        returned_identity=measured.frozen_request.request, source_status=value.source_status,
        returned_type="MechanicalFamilyResult", missing_cause=value.missing_cause,
        descriptive_values=FrozenMap({"packet": packet_payload(measured.packet),
            "facts": measured.facts, "missing_refs": measured.missing_refs,
            "native_result": immutable_json_data(measured.native)}),
        retained_alternative_refs=measured.frozen_request.native_request.scope.retained_alternative_refs,
        eligible_sibling_refs=measured.frozen_request.native_request.scope.eligible_sibling_refs,
        consumed_request_refs=measured.frozen_request.native_request.scope.consumed_request_refs,
        retained_frontier=measured.native.frontier if measured.native is not None else FrozenMap())


def finish_a_packet_step(value: APacketStepFinishInputC) -> APacketStepDispatchC:
    measured = value.measured
    return APacketStepDispatchC(frozen_measurement=measured, normalized=value.normalized,
        packet=measured.packet if value.source_return_packet_allowed and measured.facts["packet_complete"] else None,
        ready_inherited_phase_refs=measured.frozen_request.inherited_phase_refs
            if value.source_return_packet_allowed and measured.facts["packet_complete"] else ())
