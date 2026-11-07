"""Exact program native DTOs, no coercion to the B mechanical ABI."""
from .program_step_contracts_c import (ProgramStepInputC, ProgramStepFactsC, ProgramStepMeasurementC,
    ProgramStepDecodeInputC, ProgramStepResponseInputC, ProgramStepFinishInputC, ProgramStepDispatchC)
from .program_step_c import (measure_program_step_signature, unsupported_program_step,
    decode_program_step, assemble_program_step_response, finish_program_step)
from .mechanical_request_contracts import MechanicalResponseInput

PROGRAM_STEP_C_ENTRIES = (
    ("capability.program_step_signature_c", measure_program_step_signature, ProgramStepInputC, ProgramStepFactsC),
    ("capability.program_step_unsupported_c", unsupported_program_step, ProgramStepInputC, ProgramStepMeasurementC),
    ("capability.program_step_decode_c", decode_program_step, ProgramStepDecodeInputC, ProgramStepMeasurementC),
    ("capability.program_step_response_c", assemble_program_step_response, ProgramStepResponseInputC, MechanicalResponseInput),
    ("capability.program_step_finish_c", finish_program_step, ProgramStepFinishInputC, ProgramStepDispatchC))
PROGRAM_STEP_C_TYPES = ("ProgramPhaseBindingC", "ProgramStepInputC", "ProgramStepFactsC", "ProgramStepMeasurementC",
    "ProgramStepDecodeInputC", "ProgramStepResponseInputC", "ProgramStepFinishInputC", "ProgramStepDispatchC",
    "FixedProgramRequest", "DMechanicalResult")


def program_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="program_step_c.py", applicability=("source_bound_native_program_primitive",),
        invariants=("one_native_step", "native_fixed_word_pose_chain_not_commands", "native_debit_once", "no_second_program_transition_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_program_context"))
        for ref, method, inputs, outputs in PROGRAM_STEP_C_ENTRIES)


def program_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in PROGRAM_STEP_C_ENTRIES}
    signatures["capability.fixed_program_origin_calculation"] = (
        (parameter("request", "FixedProgramRequest"),), "DMechanicalResult")
    signatures["capability.program_step_decode_c"] = ((parameter("request", "ProgramStepInputC"),
        parameter("native", "DMechanicalResult")), "ProgramStepMeasurementC")
    signatures["capability.program_step_response_c"] = ((parameter("measured", "ProgramStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.program_step_finish_c"] = ((parameter("measured", "ProgramStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "ProgramStepDispatchC")
    return signatures
