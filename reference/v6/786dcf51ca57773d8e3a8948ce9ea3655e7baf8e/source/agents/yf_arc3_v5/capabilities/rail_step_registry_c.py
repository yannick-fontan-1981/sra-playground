"""Exact rail native DTOs, no coercion to the B mechanical ABI."""
from .rail_step_contracts_c import (RailStepInputC, RailStepFactsC, RailStepMeasurementC,
    RailStepDecodeInputC, RailStepResponseInputC, RailStepFinishInputC, RailStepDispatchC)
from .rail_step_c import (measure_rail_step_signature, unsupported_rail_step,
    decode_rail_step, assemble_rail_step_response, finish_rail_step)
from .mechanical_request_contracts import MechanicalResponseInput

RAIL_STEP_C_ENTRIES = (
    ("capability.rail_step_signature_c", measure_rail_step_signature, RailStepInputC, RailStepFactsC),
    ("capability.rail_step_unsupported_c", unsupported_rail_step, RailStepInputC, RailStepMeasurementC),
    ("capability.rail_step_decode_c", decode_rail_step, RailStepDecodeInputC, RailStepMeasurementC),
    ("capability.rail_step_response_c", assemble_rail_step_response, RailStepResponseInputC, MechanicalResponseInput),
    ("capability.rail_step_finish_c", finish_rail_step, RailStepFinishInputC, RailStepDispatchC))
RAIL_STEP_C_TYPES = ("RailPhaseBindingC", "RailStepInputC", "RailStepFactsC", "RailStepMeasurementC",
    "RailStepDecodeInputC", "RailStepResponseInputC", "RailStepFinishInputC", "RailStepDispatchC",
    "CadencedRailRequest", "DMechanicalResult")


def rail_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="rail_step_c.py", applicability=("source_bound_native_rail_primitive",),
        invariants=("one_native_step", "internal_waves_not_commands", "native_debit_once", "no_second_arm_closure_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_native_wave"))
        for ref, method, inputs, outputs in RAIL_STEP_C_ENTRIES)


def rail_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in RAIL_STEP_C_ENTRIES}
    signatures["capability.cadenced_rail_transfer_calculation"] = (
        (parameter("request", "CadencedRailRequest"),), "DMechanicalResult")
    signatures["capability.rail_step_decode_c"] = ((parameter("request", "RailStepInputC"),
        parameter("native", "DMechanicalResult")), "RailStepMeasurementC")
    signatures["capability.rail_step_response_c"] = ((parameter("measured", "RailStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.rail_step_finish_c"] = ((parameter("measured", "RailStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "RailStepDispatchC")
    return signatures
