"""C packet projection entries; A owns the exact native producers."""
from .a_packet_step_contracts_c import (APacketStepInputC, OrientedPacketStepInputC, ChartedPacketStepInputC, StationPacketStepInputC, WrapPacketStepInputC,
    APacketStepFactsC, APacketStepMeasurementC, APacketStepDecodeInputC,
    APacketStepResponseInputC, APacketStepFinishInputC, APacketStepDispatchC)
from .a_packet_step_c import (measure_a_packet_step_signature, unsupported_a_packet_step,
    decode_a_packet_step, assemble_a_packet_step_response, finish_a_packet_step)
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .rewritable_endpoint_transport import OrientedPassageRequest, measure_endpoint_transport
from .inventory_gated_navigation import ChartedNavigationRequest, measure_inventory_navigation
from .station_gated_cargo import StationCargoRequest, measure_station_gated_cargo
from .wrap_slide import WrapRequest, measure_wrap_slide

A_PACKET_STEP_C_ENTRIES = (
    ("capability.a_packet_step_signature_c", measure_a_packet_step_signature, APacketStepInputC, APacketStepFactsC),
    ("capability.a_packet_step_unsupported_c", unsupported_a_packet_step, APacketStepInputC, APacketStepMeasurementC),
    ("capability.a_packet_step_decode_c", decode_a_packet_step, APacketStepDecodeInputC, APacketStepMeasurementC),
    ("capability.a_packet_step_response_c", assemble_a_packet_step_response, APacketStepResponseInputC, MechanicalResponseInput),
    ("capability.a_packet_step_finish_c", finish_a_packet_step, APacketStepFinishInputC, APacketStepDispatchC))
A_PACKET_STEP_C_TYPES = ("APacketStepInputC", "OrientedPacketStepInputC", "ChartedPacketStepInputC",
    "StationPacketStepInputC", "StationCargoRequest",
    "WrapPacketStepInputC", "WrapRequest",
    "APacketStepFactsC", "APacketStepMeasurementC", "APacketStepDecodeInputC",
    "APacketStepResponseInputC", "APacketStepFinishInputC", "APacketStepDispatchC",
    "OrientedPassageRequest", "ChartedNavigationRequest", "MechanicalFamilyResult")


def a_packet_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="a_packet_step_c.py",
        applicability=("source_prebound_complete_a_packet",),
        invariants=("one_native_call", "one_packet_owner", "no_second_native_physics_or_debit", "no_physical_release"),
        falsifiers=("stale_or_unowned_identity", "wrong_native_model_or_bounds", "partial_native_packet"))
        for ref, method, inputs, outputs in A_PACKET_STEP_C_ENTRIES)


def a_packet_step_native_entries_c(entry_factory):
    # Private compiler dependencies only; production already owns these A entries.
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=MechanicalFamilyResult, source_file=source,
        applicability=("supplied_native_family_request",), invariants=("bounded_native_calculation",),
        falsifiers=("missing_native_context",)) for ref, method, inputs, source in (
            ("capability.oriented_passage_calculation", measure_endpoint_transport, OrientedPassageRequest,
                "rewritable_endpoint_transport.py"),
            ("capability.charted_room_navigation_calculation", measure_inventory_navigation, ChartedNavigationRequest,
                "inventory_gated_navigation.py"),
            ("capability.station_gated_cargo_calculation", measure_station_gated_cargo, StationCargoRequest,
                "station_gated_cargo.py"),
            ("capability.wrap_slide_calculation", measure_wrap_slide, WrapRequest, "wrap_slide.py")))


def a_packet_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(kind, optional=optional))
    signatures = {ref: ((parameter("request", "Any" if inputs is APacketStepInputC else inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in A_PACKET_STEP_C_ENTRIES}
    signatures["capability.a_packet_step_decode_c"] = ((parameter("request", "Any"),
        parameter("native", "MechanicalFamilyResult")), "APacketStepMeasurementC")
    signatures["capability.a_packet_step_response_c"] = ((parameter("measured", "APacketStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.a_packet_step_finish_c"] = ((parameter("measured", "APacketStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn"), parameter("source_return_packet_allowed", "Boolean")), "APacketStepDispatchC")
    signatures["capability.oriented_passage_calculation"] = ((parameter("request", "OrientedPassageRequest"),), "MechanicalFamilyResult")
    signatures["capability.charted_room_navigation_calculation"] = ((parameter("request", "ChartedNavigationRequest"),), "MechanicalFamilyResult")
    signatures["capability.station_gated_cargo_calculation"] = ((parameter("request", "StationCargoRequest"),), "MechanicalFamilyResult")
    signatures["capability.wrap_slide_calculation"] = ((parameter("request", "WrapRequest"),), "MechanicalFamilyResult")
    return signatures
