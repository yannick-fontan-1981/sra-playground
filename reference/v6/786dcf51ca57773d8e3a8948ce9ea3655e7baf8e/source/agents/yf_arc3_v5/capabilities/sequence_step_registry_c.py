"""Exact sequence native DTOs, no coercion to the B mechanical ABI."""
from .sequence_step_contracts_c import (SequenceStepInputC, SequenceStepFactsC, SequenceStepMeasurementC,
    SequenceStepDecodeInputC, SequenceStepResponseInputC, SequenceStepFinishInputC, SequenceStepDispatchC)
from .sequence_step_c import (measure_sequence_step_signature, unsupported_sequence_step,
    decode_sequence_step, assemble_sequence_step_response, finish_sequence_step)
from .mechanical_request_contracts import MechanicalResponseInput

SEQUENCE_STEP_C_ENTRIES = (
    ("capability.sequence_step_signature_c", measure_sequence_step_signature, SequenceStepInputC, SequenceStepFactsC),
    ("capability.sequence_step_unsupported_c", unsupported_sequence_step, SequenceStepInputC, SequenceStepMeasurementC),
    ("capability.sequence_step_decode_c", decode_sequence_step, SequenceStepDecodeInputC, SequenceStepMeasurementC),
    ("capability.sequence_step_response_c", assemble_sequence_step_response, SequenceStepResponseInputC, MechanicalResponseInput),
    ("capability.sequence_step_finish_c", finish_sequence_step, SequenceStepFinishInputC, SequenceStepDispatchC))
SEQUENCE_STEP_C_TYPES = ("SequencePhaseBindingC", "SequenceStepInputC", "SequenceStepFactsC", "SequenceStepMeasurementC",
    "SequenceStepDecodeInputC", "SequenceStepResponseInputC", "SequenceStepFinishInputC", "SequenceStepDispatchC",
    "VisualSequenceRequest", "DMechanicalResult")


def sequence_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="sequence_step_c.py", applicability=("source_bound_native_sequence_primitive",),
        invariants=("one_native_step", "native_answer_transaction_not_commands", "native_debit_once", "no_second_answer_transition_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_answer_context"))
        for ref, method, inputs, outputs in SEQUENCE_STEP_C_ENTRIES)


def sequence_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in SEQUENCE_STEP_C_ENTRIES}
    signatures["capability.visual_sequence_calculation"] = (
        (parameter("request", "VisualSequenceRequest"),), "DMechanicalResult")
    signatures["capability.sequence_step_decode_c"] = ((parameter("request", "SequenceStepInputC"),
        parameter("native", "DMechanicalResult")), "SequenceStepMeasurementC")
    signatures["capability.sequence_step_response_c"] = ((parameter("measured", "SequenceStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.sequence_step_finish_c"] = ((parameter("measured", "SequenceStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "SequenceStepDispatchC")
    return signatures
