"""Exact fragment native DTOs, no coercion to the B mechanical ABI."""
from .fragment_step_contracts_c import (FragmentStepInputC, FragmentStepFactsC, FragmentStepMeasurementC,
    FragmentStepDecodeInputC, FragmentStepResponseInputC, FragmentStepFinishInputC, FragmentStepDispatchC)
from .fragment_step_c import (measure_fragment_step_signature, unsupported_fragment_step,
    decode_fragment_step, assemble_fragment_step_response, finish_fragment_step)
from .mechanical_request_contracts import MechanicalResponseInput

FRAGMENT_STEP_C_ENTRIES = (
    ("capability.fragment_step_signature_c", measure_fragment_step_signature, FragmentStepInputC, FragmentStepFactsC),
    ("capability.fragment_step_unsupported_c", unsupported_fragment_step, FragmentStepInputC, FragmentStepMeasurementC),
    ("capability.fragment_step_decode_c", decode_fragment_step, FragmentStepDecodeInputC, FragmentStepMeasurementC),
    ("capability.fragment_step_response_c", assemble_fragment_step_response, FragmentStepResponseInputC, MechanicalResponseInput),
    ("capability.fragment_step_finish_c", finish_fragment_step, FragmentStepFinishInputC, FragmentStepDispatchC))
FRAGMENT_STEP_C_TYPES = ("FragmentPhaseBindingC", "FragmentStepInputC", "FragmentStepFactsC", "FragmentStepMeasurementC",
    "FragmentStepDecodeInputC", "FragmentStepResponseInputC", "FragmentStepFinishInputC", "FragmentStepDispatchC",
    "TemporalFragmentRequest", "DMechanicalResult")


def fragment_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="fragment_step_c.py", applicability=("source_bound_native_fragment_primitive",),
        invariants=("one_native_step", "native_photo_transaction_not_commands", "native_debit_once", "no_second_photo_transition_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_photo_context"))
        for ref, method, inputs, outputs in FRAGMENT_STEP_C_ENTRIES)


def fragment_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in FRAGMENT_STEP_C_ENTRIES}
    signatures["capability.temporal_fragment_match_calculation"] = (
        (parameter("request", "TemporalFragmentRequest"),), "DMechanicalResult")
    signatures["capability.fragment_step_decode_c"] = ((parameter("request", "FragmentStepInputC"),
        parameter("native", "DMechanicalResult")), "FragmentStepMeasurementC")
    signatures["capability.fragment_step_response_c"] = ((parameter("measured", "FragmentStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.fragment_step_finish_c"] = ((parameter("measured", "FragmentStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "FragmentStepDispatchC")
    return signatures
