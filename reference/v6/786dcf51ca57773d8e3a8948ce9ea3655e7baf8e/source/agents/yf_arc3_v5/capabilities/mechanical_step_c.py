"""Exact STEP identity and ledger conversion; SRC dispatches the producer."""
from .mechanical_step_contracts_c import (
    ExternalStepInputC, ExternalStepFactsC, ExternalStepDecodeInputC, ExternalStepMeasurementC,
    ExternalStepNativeInputC, ExternalStepFinishInputC, ExternalStepDispatchResultC,
)
from .mechanical_common_contracts_c import MechanicalEventC, ExternalPrimitivePacketC
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_response_transport_b import request_identity
from .mechanical_request_contracts import MechanicalResponseInput
from agents.yf_arc3_v5.logos.types import FrozenMap
from .mechanical_transport_c import packet_payload, provider_result_payload
from .mechanical_profile_d import DNativeProfileContribution
from .rigid_edit_search_transport_c import rigid_step_context_equal


def measure_external_step_signature(value: ExternalStepInputC) -> ExternalStepFactsC:
    provider = value.provider_request
    profile = value.d_profile
    identity = (profile.common_identity if profile is not None else
        request_identity(provider, value.request.kernel_ref) if provider is not None else None)
    model_ref = (value.d_rigid_context.contract.model_ref if value.d_rigid_context is not None else
        provider.model_ref if provider is not None else None)
    return ExternalStepFactsC(facts=FrozenMap({"operation_ref": value.request.operation_ref,
        "kernel_ref": value.request.kernel_ref, "mode": value.request.mode,
        "expected_return_type": value.request.expected_return_type,
        "provider_present": provider is not None, "provider_identity_equal": identity == value.request,
        "d_profile_present": profile is not None,
        "d_rigid_projection_bound": rigid_step_context_equal(value),
        "parent_provenance_equal": identity is not None and packet_context_equal(
            value.parent_request, value.request, model_ref)}))


def get_bound_external_step_request(value: ExternalStepInputC):
    # Called only from the SRC branch licensed by provider_present and exact
    # request identity. No request, operation, mode, model or bounds are invented.
    return value.provider_request


def empty_external_step(value: ExternalStepInputC) -> ExternalStepMeasurementC:
    return ExternalStepMeasurementC(request=value, native=None, packet=None,
        missing_refs=("unbound_external_step_signature",),
        facts=FrozenMap({"unsupported_signature": True}))


def decode_external_step(value: ExternalStepDecodeInputC) -> ExternalStepMeasurementC:
    request, native = value.request, value.native
    data = native.values
    missing = set(native.missing_refs)
    fields = ("mechanical_before", "mechanical_after", "mechanical_events", "mechanical_snapshots",
        "mechanical_closure_domain_ref", "mechanical_closure_stop_ref", "mechanical_closure_complete")
    missing.update(field for field in fields if field not in data or data[field] is None)
    missing.update(data.get("mechanical_missing_refs", ()))
    if "state" in data and data.get("mechanical_after") != data["state"]:
        missing.add("native_endpoint_and_event_ledger_disagree")
    same_identity = native.request == request.provider_request
    packet = None
    provider = request.provider_request
    if not missing and same_identity and provider is not None and provider.model_ref is not None:
        events = tuple(MechanicalEventC.model_validate({key: event[key] for key in sorted(event)})
            for event in data["mechanical_events"])
        packet = ExternalPrimitivePacketC(request=request.request, parent_request=request.parent_request,
            model_ref=provider.model_ref, action_ref=provider.data["action_ref"],
            primitive_ref=request.primitive_ref,
            before=data["mechanical_before"], after=data["mechanical_after"], events=events,
            snapshots=data["mechanical_snapshots"], closure_domain_ref=data["mechanical_closure_domain_ref"],
            closure_stop_ref=data["mechanical_closure_stop_ref"],
            complete=data["mechanical_closure_complete"], missing_refs=tuple(sorted(missing)), cost=request.cost,
            terminal=any(event.interruption_ref is not None for event in events),
            acceptance=any(event.predicate_values.get("accepted") is True for event in events),
            response_ref=request.response_ref)
    if data.get("mechanical_closure_complete") is not True:
        missing.add("incomplete_external_closure")
    return ExternalStepMeasurementC(request=request, native=native, packet=packet,
        missing_refs=tuple(sorted(missing)), facts=FrozenMap({
            "identity_equal": same_identity, "closure_complete": data.get("mechanical_closure_complete") is True,
            "packet_present": packet is not None, "native_status": native.source_status,
            "missing_measurement": bool(missing)}))


def assemble_external_step_native(value: ExternalStepNativeInputC) -> MechanicalResponseInput:
    measured = value.measured
    identity = measured.request.request
    d_native = measured.native if isinstance(measured.native, DNativeProfileContribution) else None
    returned = (d_native.result.request if d_native is not None and d_native.result is not None else
        d_native.request.common_identity if d_native is not None else
        request_identity(measured.native.request, identity.kernel_ref) if measured.native else identity)
    native_payload = (FrozenMap({'blockers': d_native.blockers,
        'normalized_values': d_native.result.descriptive_values if d_native.result is not None else FrozenMap(),
        'retained_frontier': d_native.retained_binding_frontier}) if d_native is not None else
        provider_result_payload(measured.native))
    return MechanicalResponseInput(request=identity, returned_identity=returned,
        source_status=value.source_status, returned_type=identity.expected_return_type if d_native is not None else "MechanicalResultB",
        descriptive_values=FrozenMap({"packet": packet_payload(measured.packet), "missing_refs": measured.missing_refs}),
        missing_cause=value.missing_cause,
        distinguishing_question_ref="question.complete_the_bound_external_step"
            if measured.missing_refs else None,
        retained_frontier=FrozenMap({"native": native_payload,
            "packet": packet_payload(measured.packet)}))


def finish_external_step(value: ExternalStepFinishInputC) -> ExternalStepDispatchResultC:
    return ExternalStepDispatchResultC(request=value.measured.request.request,
        normalized=value.normalized, packet=value.measured.packet)
