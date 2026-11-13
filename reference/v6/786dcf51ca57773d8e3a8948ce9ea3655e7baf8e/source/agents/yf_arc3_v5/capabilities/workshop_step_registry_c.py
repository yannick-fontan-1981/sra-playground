"""Exact workshop native DTOs, no coercion to the B mechanical ABI."""
from .workshop_step_contracts_c import (WorkshopStepInputC, WorkshopStepFactsC, WorkshopStepMeasurementC,
    WorkshopStepDecodeInputC, WorkshopStepResponseInputC, WorkshopStepFinishInputC, WorkshopStepDispatchC)
from .workshop_step_c import (measure_workshop_step_signature, unsupported_workshop_step,
    decode_workshop_step, assemble_workshop_step_response, finish_workshop_step)
from .mechanical_request_contracts import MechanicalResponseInput

WORKSHOP_STEP_C_ENTRIES = (
    ("capability.workshop_step_signature_c", measure_workshop_step_signature, WorkshopStepInputC, WorkshopStepFactsC),
    ("capability.workshop_step_unsupported_c", unsupported_workshop_step, WorkshopStepInputC, WorkshopStepMeasurementC),
    ("capability.workshop_step_decode_c", decode_workshop_step, WorkshopStepDecodeInputC, WorkshopStepMeasurementC),
    ("capability.workshop_step_response_c", assemble_workshop_step_response, WorkshopStepResponseInputC, MechanicalResponseInput),
    ("capability.workshop_step_finish_c", finish_workshop_step, WorkshopStepFinishInputC, WorkshopStepDispatchC))
WORKSHOP_STEP_C_TYPES = ("WorkshopPhaseBindingC", "WorkshopStepInputC", "WorkshopStepFactsC", "WorkshopStepMeasurementC",
    "WorkshopStepDecodeInputC", "WorkshopStepResponseInputC", "WorkshopStepFinishInputC", "WorkshopStepDispatchC",
    "StationWorkbenchRequest", "DMechanicalResult")


def workshop_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="workshop_step_c.py", applicability=("source_bound_native_workshop_primitive",),
        invariants=("one_native_step", "native_receipts_not_commands", "native_debit_once", "no_second_authentication_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_receipt_checkpoint"))
        for ref, method, inputs, outputs in WORKSHOP_STEP_C_ENTRIES)


def workshop_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in WORKSHOP_STEP_C_ENTRIES}
    signatures["capability.station_profile_workbench_calculation"] = (
        (parameter("request", "StationWorkbenchRequest"),), "DMechanicalResult")
    signatures["capability.workshop_step_decode_c"] = ((parameter("request", "WorkshopStepInputC"),
        parameter("native", "DMechanicalResult")), "WorkshopStepMeasurementC")
    signatures["capability.workshop_step_response_c"] = ((parameter("measured", "WorkshopStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.workshop_step_finish_c"] = ((parameter("measured", "WorkshopStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "WorkshopStepDispatchC")
    return signatures
