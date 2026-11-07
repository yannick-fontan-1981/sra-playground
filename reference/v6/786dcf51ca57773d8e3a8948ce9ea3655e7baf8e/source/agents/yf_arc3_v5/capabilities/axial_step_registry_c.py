"""Exact axial native DTOs, no coercion to the B mechanical ABI."""
from .axial_step_contracts_c import (AxialStepInputC, AxialStepFactsC, AxialStepMeasurementC,
    AxialStepDecodeInputC, AxialStepResponseInputC, AxialStepFinishInputC, AxialStepDispatchC)
from .axial_step_c import (measure_axial_step_signature, unsupported_axial_step,
    decode_axial_step, assemble_axial_step_response, finish_axial_step)
from .mechanical_request_contracts import MechanicalResponseInput

AXIAL_STEP_C_ENTRIES = (
    ("capability.axial_step_signature_c", measure_axial_step_signature, AxialStepInputC, AxialStepFactsC),
    ("capability.axial_step_unsupported_c", unsupported_axial_step, AxialStepInputC, AxialStepMeasurementC),
    ("capability.axial_step_decode_c", decode_axial_step, AxialStepDecodeInputC, AxialStepMeasurementC),
    ("capability.axial_step_response_c", assemble_axial_step_response, AxialStepResponseInputC, MechanicalResponseInput),
    ("capability.axial_step_finish_c", finish_axial_step, AxialStepFinishInputC, AxialStepDispatchC))
AXIAL_STEP_C_TYPES = ("AxialPhaseBindingC", "AxialTickBindingC", "AxialStepInputC", "AxialStepFactsC", "AxialStepMeasurementC",
    "AxialStepDecodeInputC", "AxialStepResponseInputC", "AxialStepFinishInputC", "AxialStepDispatchC",
    "AxialFieldRequest", "DMechanicalResult")


def axial_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="axial_step_c.py", applicability=("source_bound_native_axial_primitive",),
        invariants=("one_native_step", "native_mechanics_not_commands", "native_debit_once", "no_second_load_projection_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_ticks_checkpointpoint"))
        for ref, method, inputs, outputs in AXIAL_STEP_C_ENTRIES)


def axial_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in AXIAL_STEP_C_ENTRIES}
    signatures["capability.axial_field_configuration_calculation"] = (
        (parameter("request", "AxialFieldRequest"),), "DMechanicalResult")
    signatures["capability.axial_step_decode_c"] = ((parameter("request", "AxialStepInputC"),
        parameter("native", "DMechanicalResult")), "AxialStepMeasurementC")
    signatures["capability.axial_step_response_c"] = ((parameter("measured", "AxialStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.axial_step_finish_c"] = ((parameter("measured", "AxialStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "AxialStepDispatchC")
    return signatures
