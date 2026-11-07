"""Exact alignment native DTOs, no coercion to the B mechanical ABI."""
from .alignment_step_contracts_c import (AlignmentStepInputC, AlignmentStepFactsC, AlignmentStepMeasurementC,
    AlignmentStepDecodeInputC, AlignmentStepResponseInputC, AlignmentStepFinishInputC, AlignmentStepDispatchC)
from .alignment_step_c import (measure_alignment_step_signature, unsupported_alignment_step,
    decode_alignment_step, assemble_alignment_step_response, finish_alignment_step)
from .mechanical_request_contracts import MechanicalResponseInput

ALIGNMENT_STEP_C_ENTRIES = (
    ("capability.alignment_step_signature_c", measure_alignment_step_signature, AlignmentStepInputC, AlignmentStepFactsC),
    ("capability.alignment_step_unsupported_c", unsupported_alignment_step, AlignmentStepInputC, AlignmentStepMeasurementC),
    ("capability.alignment_step_decode_c", decode_alignment_step, AlignmentStepDecodeInputC, AlignmentStepMeasurementC),
    ("capability.alignment_step_response_c", assemble_alignment_step_response, AlignmentStepResponseInputC, MechanicalResponseInput),
    ("capability.alignment_step_finish_c", finish_alignment_step, AlignmentStepFinishInputC, AlignmentStepDispatchC))
ALIGNMENT_STEP_C_TYPES = ("AlignmentPhaseBindingC", "AlignmentBranchBindingC", "AlignmentStepInputC", "AlignmentStepFactsC", "AlignmentStepMeasurementC",
    "AlignmentStepDecodeInputC", "AlignmentStepResponseInputC", "AlignmentStepFinishInputC", "AlignmentStepDispatchC",
    "FiniteAlignmentRequest", "DMechanicalResult")


def alignment_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="alignment_step_c.py", applicability=("source_bound_native_alignment_primitive",),
        invariants=("one_native_step_with_complete_reply_domain", "native_mechanics_not_commands", "native_debit_once", "no_second_load_projection_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_reply_domain", "missing_replies_checkpointpoint"))
        for ref, method, inputs, outputs in ALIGNMENT_STEP_C_ENTRIES)


def alignment_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in ALIGNMENT_STEP_C_ENTRIES}
    signatures["capability.finite_alignment_calculation"] = (
        (parameter("request", "FiniteAlignmentRequest"),), "DMechanicalResult")
    signatures["capability.alignment_step_decode_c"] = ((parameter("request", "AlignmentStepInputC"),
        parameter("native", "DMechanicalResult")), "AlignmentStepMeasurementC")
    signatures["capability.alignment_step_response_c"] = ((parameter("measured", "AlignmentStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.alignment_step_finish_c"] = ((parameter("measured", "AlignmentStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "AlignmentStepDispatchC")
    return signatures
