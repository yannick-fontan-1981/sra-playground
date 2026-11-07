"""Exact recolor native DTOs, no coercion to the B mechanical ABI."""
from .recolor_step_contracts_c import (RecolorStepInputC, RecolorStepFactsC, RecolorStepMeasurementC,
    RecolorStepDecodeInputC, RecolorStepResponseInputC, RecolorStepFinishInputC, RecolorStepDispatchC)
from .recolor_step_c import (measure_recolor_step_signature, unsupported_recolor_step,
    decode_recolor_step, assemble_recolor_step_response, finish_recolor_step)
from .mechanical_request_contracts import MechanicalResponseInput

RECOLOR_STEP_C_ENTRIES = (
    ("capability.recolor_step_signature_c", measure_recolor_step_signature, RecolorStepInputC, RecolorStepFactsC),
    ("capability.recolor_step_unsupported_c", unsupported_recolor_step, RecolorStepInputC, RecolorStepMeasurementC),
    ("capability.recolor_step_decode_c", decode_recolor_step, RecolorStepDecodeInputC, RecolorStepMeasurementC),
    ("capability.recolor_step_response_c", assemble_recolor_step_response, RecolorStepResponseInputC, MechanicalResponseInput),
    ("capability.recolor_step_finish_c", finish_recolor_step, RecolorStepFinishInputC, RecolorStepDispatchC))
RECOLOR_STEP_C_TYPES = ("RecolorPhaseBindingC", "RecolorStepInputC", "RecolorStepFactsC", "RecolorStepMeasurementC",
    "RecolorStepDecodeInputC", "RecolorStepResponseInputC", "RecolorStepFinishInputC", "RecolorStepDispatchC",
    "TopologicalRecolorRequest", "DMechanicalResult")


def recolor_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="recolor_step_c.py", applicability=("source_bound_native_recolor_primitive",),
        invariants=("one_native_step", "native_whole_field_paint_not_commands", "native_debit_once", "no_second_field_transition_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_field_context"))
        for ref, method, inputs, outputs in RECOLOR_STEP_C_ENTRIES)


def recolor_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in RECOLOR_STEP_C_ENTRIES}
    signatures["capability.topological_region_recolor_calculation"] = (
        (parameter("request", "TopologicalRecolorRequest"),), "DMechanicalResult")
    signatures["capability.recolor_step_decode_c"] = ((parameter("request", "RecolorStepInputC"),
        parameter("native", "DMechanicalResult")), "RecolorStepMeasurementC")
    signatures["capability.recolor_step_response_c"] = ((parameter("measured", "RecolorStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.recolor_step_finish_c"] = ((parameter("measured", "RecolorStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "RecolorStepDispatchC")
    return signatures
