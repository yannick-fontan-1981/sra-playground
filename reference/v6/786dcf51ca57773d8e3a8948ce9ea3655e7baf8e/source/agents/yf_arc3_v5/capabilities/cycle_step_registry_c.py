"""Exact cycle native DTOs, no coercion to the B mechanical ABI."""
from .cycle_step_contracts_c import (CycleStepInputC, CycleStepFactsC, CycleStepMeasurementC,
    CycleStepDecodeInputC, CycleStepResponseInputC, CycleStepFinishInputC, CycleStepDispatchC)
from .cycle_step_c import (measure_cycle_step_signature, unsupported_cycle_step,
    decode_cycle_step, assemble_cycle_step_response, finish_cycle_step)
from .mechanical_request_contracts import MechanicalResponseInput

CYCLE_STEP_C_ENTRIES = (
    ("capability.cycle_step_signature_c", measure_cycle_step_signature, CycleStepInputC, CycleStepFactsC),
    ("capability.cycle_step_unsupported_c", unsupported_cycle_step, CycleStepInputC, CycleStepMeasurementC),
    ("capability.cycle_step_decode_c", decode_cycle_step, CycleStepDecodeInputC, CycleStepMeasurementC),
    ("capability.cycle_step_response_c", assemble_cycle_step_response, CycleStepResponseInputC, MechanicalResponseInput),
    ("capability.cycle_step_finish_c", finish_cycle_step, CycleStepFinishInputC, CycleStepDispatchC))
CYCLE_STEP_C_TYPES = ("CyclePhaseBindingC", "CycleStepInputC", "CycleStepFactsC", "CycleStepMeasurementC",
    "CycleStepDecodeInputC", "CycleStepResponseInputC", "CycleStepFinishInputC", "CycleStepDispatchC",
    "CyclicCoverageRequest", "DMechanicalResult")


def cycle_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="cycle_step_c.py", applicability=("source_bound_native_cycle_primitive",),
        invariants=("one_native_step", "native_coverage_transaction_not_commands", "native_debit_once", "no_second_coverage_transition_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_coverage_context"))
        for ref, method, inputs, outputs in CYCLE_STEP_C_ENTRIES)


def cycle_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in CYCLE_STEP_C_ENTRIES}
    signatures["capability.cyclic_configuration_coverage_calculation"] = (
        (parameter("request", "CyclicCoverageRequest"),), "DMechanicalResult")
    signatures["capability.cycle_step_decode_c"] = ((parameter("request", "CycleStepInputC"),
        parameter("native", "DMechanicalResult")), "CycleStepMeasurementC")
    signatures["capability.cycle_step_response_c"] = ((parameter("measured", "CycleStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.cycle_step_finish_c"] = ((parameter("measured", "CycleStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "CycleStepDispatchC")
    return signatures
