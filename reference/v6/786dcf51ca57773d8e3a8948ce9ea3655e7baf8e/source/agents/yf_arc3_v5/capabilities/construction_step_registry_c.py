"""Exact construction native DTOs, no coercion to the B mechanical ABI."""
from .construction_step_contracts_c import (ConstructionStepInputC, ConstructionStepFactsC, ConstructionStepMeasurementC,
    ConstructionStepDecodeInputC, ConstructionStepResponseInputC, ConstructionStepFinishInputC, ConstructionStepDispatchC)
from .construction_step_c import (measure_construction_step_signature, unsupported_construction_step,
    decode_construction_step, assemble_construction_step_response, finish_construction_step)
from .mechanical_request_contracts import MechanicalResponseInput

CONSTRUCTION_STEP_C_ENTRIES = (
    ("capability.construction_step_signature_c", measure_construction_step_signature, ConstructionStepInputC, ConstructionStepFactsC),
    ("capability.construction_step_unsupported_c", unsupported_construction_step, ConstructionStepInputC, ConstructionStepMeasurementC),
    ("capability.construction_step_decode_c", decode_construction_step, ConstructionStepDecodeInputC, ConstructionStepMeasurementC),
    ("capability.construction_step_response_c", assemble_construction_step_response, ConstructionStepResponseInputC, MechanicalResponseInput),
    ("capability.construction_step_finish_c", finish_construction_step, ConstructionStepFinishInputC, ConstructionStepDispatchC))
CONSTRUCTION_STEP_C_TYPES = ("ConstructionPhaseBindingC", "ConstructionStepInputC", "ConstructionStepFactsC", "ConstructionStepMeasurementC",
    "ConstructionStepDecodeInputC", "ConstructionStepResponseInputC", "ConstructionStepFinishInputC", "ConstructionStepDispatchC",
    "SupportedConstructionRequest", "DMechanicalResult")


def construction_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="construction_step_c.py", applicability=("source_bound_native_construction_primitive",),
        invariants=("one_native_step", "native_mechanics_not_commands", "native_debit_once", "no_second_load_projection_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_loads_checkpointpoint"))
        for ref, method, inputs, outputs in CONSTRUCTION_STEP_C_ENTRIES)


def construction_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in CONSTRUCTION_STEP_C_ENTRIES}
    signatures["capability.supported_construction_calculation"] = (
        (parameter("request", "SupportedConstructionRequest"),), "DMechanicalResult")
    signatures["capability.construction_step_decode_c"] = ((parameter("request", "ConstructionStepInputC"),
        parameter("native", "DMechanicalResult")), "ConstructionStepMeasurementC")
    signatures["capability.construction_step_response_c"] = ((parameter("measured", "ConstructionStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.construction_step_finish_c"] = ((parameter("measured", "ConstructionStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "ConstructionStepDispatchC")
    return signatures
