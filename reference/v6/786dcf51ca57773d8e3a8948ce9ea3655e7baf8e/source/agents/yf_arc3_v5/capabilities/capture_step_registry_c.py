"""Exact capture native DTOs, no coercion to the B mechanical ABI."""
from .capture_step_contracts_c import (CaptureStepInputC, CaptureStepFactsC, CaptureStepMeasurementC,
    CaptureStepDecodeInputC, CaptureStepResponseInputC, CaptureStepFinishInputC, CaptureStepDispatchC)
from .capture_step_c import (measure_capture_step_signature, unsupported_capture_step,
    decode_capture_step, assemble_capture_step_response, finish_capture_step)
from .mechanical_request_contracts import MechanicalResponseInput

CAPTURE_STEP_C_ENTRIES = (
    ("capability.capture_step_signature_c", measure_capture_step_signature, CaptureStepInputC, CaptureStepFactsC),
    ("capability.capture_step_unsupported_c", unsupported_capture_step, CaptureStepInputC, CaptureStepMeasurementC),
    ("capability.capture_step_decode_c", decode_capture_step, CaptureStepDecodeInputC, CaptureStepMeasurementC),
    ("capability.capture_step_response_c", assemble_capture_step_response, CaptureStepResponseInputC, MechanicalResponseInput),
    ("capability.capture_step_finish_c", finish_capture_step, CaptureStepFinishInputC, CaptureStepDispatchC))
CAPTURE_STEP_C_TYPES = ("CapturePhaseBindingC", "CaptureActorBindingC", "CaptureStepInputC", "CaptureStepFactsC", "CaptureStepMeasurementC",
    "CaptureStepDecodeInputC", "CaptureStepResponseInputC", "CaptureStepFinishInputC", "CaptureStepDispatchC",
    "ReactiveCaptureRequest", "DMechanicalResult")


def capture_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="capture_step_c.py", applicability=("source_bound_native_capture_primitive",),
        invariants=("one_native_step", "native_mechanics_not_commands", "native_debit_once", "no_second_load_projection_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_actors_checkpointpoint"))
        for ref, method, inputs, outputs in CAPTURE_STEP_C_ENTRIES)


def capture_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in CAPTURE_STEP_C_ENTRIES}
    signatures["capability.reactive_capture_calculation"] = (
        (parameter("request", "ReactiveCaptureRequest"),), "DMechanicalResult")
    signatures["capability.capture_step_decode_c"] = ((parameter("request", "CaptureStepInputC"),
        parameter("native", "DMechanicalResult")), "CaptureStepMeasurementC")
    signatures["capability.capture_step_response_c"] = ((parameter("measured", "CaptureStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.capture_step_finish_c"] = ((parameter("measured", "CaptureStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "CaptureStepDispatchC")
    return signatures
