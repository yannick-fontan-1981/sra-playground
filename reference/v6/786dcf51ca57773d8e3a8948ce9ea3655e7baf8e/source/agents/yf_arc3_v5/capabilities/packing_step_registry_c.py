"""Exact packing native DTOs, no coercion to the B mechanical ABI."""
from .packing_step_contracts_c import (PackingStepInputC, PackingStepFactsC, PackingStepMeasurementC,
    PackingStepDecodeInputC, PackingStepResponseInputC, PackingStepFinishInputC, PackingStepDispatchC)
from .packing_step_c import (measure_packing_step_signature, unsupported_packing_step,
    decode_packing_step, assemble_packing_step_response, finish_packing_step)
from .mechanical_request_contracts import MechanicalResponseInput

PACKING_STEP_C_ENTRIES = (
    ("capability.packing_step_signature_c", measure_packing_step_signature, PackingStepInputC, PackingStepFactsC),
    ("capability.packing_step_unsupported_c", unsupported_packing_step, PackingStepInputC, PackingStepMeasurementC),
    ("capability.packing_step_decode_c", decode_packing_step, PackingStepDecodeInputC, PackingStepMeasurementC),
    ("capability.packing_step_response_c", assemble_packing_step_response, PackingStepResponseInputC, MechanicalResponseInput),
    ("capability.packing_step_finish_c", finish_packing_step, PackingStepFinishInputC, PackingStepDispatchC))
PACKING_STEP_C_TYPES = ("PackingPhaseBindingC", "PackingStepInputC", "PackingStepFactsC", "PackingStepMeasurementC",
    "PackingStepDecodeInputC", "PackingStepResponseInputC", "PackingStepFinishInputC", "PackingStepDispatchC",
    "PreviewPackingRequest", "DMechanicalResult")


def packing_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="packing_step_c.py", applicability=("source_bound_native_packing_primitive",),
        invariants=("one_native_step", "native_full_partition_not_commands", "native_debit_once", "no_second_partition_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_partition_checkpoint"))
        for ref, method, inputs, outputs in PACKING_STEP_C_ENTRIES)


def packing_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in PACKING_STEP_C_ENTRIES}
    signatures["capability.preview_piece_packing_calculation"] = (
        (parameter("request", "PreviewPackingRequest"),), "DMechanicalResult")
    signatures["capability.packing_step_decode_c"] = ((parameter("request", "PackingStepInputC"),
        parameter("native", "DMechanicalResult")), "PackingStepMeasurementC")
    signatures["capability.packing_step_response_c"] = ((parameter("measured", "PackingStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.packing_step_finish_c"] = ((parameter("measured", "PackingStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "PackingStepDispatchC")
    return signatures
