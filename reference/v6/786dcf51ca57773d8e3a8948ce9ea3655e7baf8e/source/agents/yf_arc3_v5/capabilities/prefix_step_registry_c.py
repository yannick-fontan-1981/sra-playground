"""Exact prefix native DTOs, no coercion to the B mechanical ABI."""
from .prefix_step_contracts_c import (PrefixStepInputC, PrefixStepFactsC, PrefixStepMeasurementC,
    PrefixStepDecodeInputC, PrefixStepResponseInputC, PrefixStepFinishInputC, PrefixStepDispatchC)
from .prefix_step_c import (measure_prefix_step_signature, unsupported_prefix_step,
    decode_prefix_step, assemble_prefix_step_response, finish_prefix_step)
from .mechanical_request_contracts import MechanicalResponseInput

PREFIX_STEP_C_ENTRIES = (
    ("capability.prefix_step_signature_c", measure_prefix_step_signature, PrefixStepInputC, PrefixStepFactsC),
    ("capability.prefix_step_unsupported_c", unsupported_prefix_step, PrefixStepInputC, PrefixStepMeasurementC),
    ("capability.prefix_step_decode_c", decode_prefix_step, PrefixStepDecodeInputC, PrefixStepMeasurementC),
    ("capability.prefix_step_response_c", assemble_prefix_step_response, PrefixStepResponseInputC, MechanicalResponseInput),
    ("capability.prefix_step_finish_c", finish_prefix_step, PrefixStepFinishInputC, PrefixStepDispatchC))
PREFIX_STEP_C_TYPES = ("PrefixPhaseBindingC", "PrefixStepInputC", "PrefixStepFactsC", "PrefixStepMeasurementC",
    "PrefixStepDecodeInputC", "PrefixStepResponseInputC", "PrefixStepFinishInputC", "PrefixStepDispatchC",
    "LayeredPrefixRequest", "DMechanicalResult")


def prefix_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="prefix_step_c.py", applicability=("source_bound_native_prefix_primitive",),
        invariants=("one_native_step", "native_mechanics_not_commands", "native_debit_once", "no_second_load_projection_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_coverage_checkpointpoint"))
        for ref, method, inputs, outputs in PREFIX_STEP_C_ENTRIES)


def prefix_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in PREFIX_STEP_C_ENTRIES}
    signatures["capability.layered_prefix_construction_calculation"] = (
        (parameter("request", "LayeredPrefixRequest"),), "DMechanicalResult")
    signatures["capability.prefix_step_decode_c"] = ((parameter("request", "PrefixStepInputC"),
        parameter("native", "DMechanicalResult")), "PrefixStepMeasurementC")
    signatures["capability.prefix_step_response_c"] = ((parameter("measured", "PrefixStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.prefix_step_finish_c"] = ((parameter("measured", "PrefixStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "PrefixStepDispatchC")
    return signatures
