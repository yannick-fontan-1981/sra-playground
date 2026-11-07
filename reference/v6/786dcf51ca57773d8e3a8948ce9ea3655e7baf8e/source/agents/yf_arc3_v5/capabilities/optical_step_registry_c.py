"""Exact optical native DTOs, no coercion to the B mechanical ABI."""
from .optical_step_contracts_c import (OpticalStepInputC, OpticalStepFactsC, OpticalStepMeasurementC,
    OpticalStepDecodeInputC, OpticalStepResponseInputC, OpticalStepFinishInputC, OpticalStepDispatchC)
from .optical_step_c import (measure_optical_step_signature, unsupported_optical_step,
    decode_optical_step, assemble_optical_step_response, finish_optical_step)
from .mechanical_request_contracts import MechanicalResponseInput

OPTICAL_STEP_C_ENTRIES = (
    ("capability.optical_step_signature_c", measure_optical_step_signature, OpticalStepInputC, OpticalStepFactsC),
    ("capability.optical_step_unsupported_c", unsupported_optical_step, OpticalStepInputC, OpticalStepMeasurementC),
    ("capability.optical_step_decode_c", decode_optical_step, OpticalStepDecodeInputC, OpticalStepMeasurementC),
    ("capability.optical_step_response_c", assemble_optical_step_response, OpticalStepResponseInputC, MechanicalResponseInput),
    ("capability.optical_step_finish_c", finish_optical_step, OpticalStepFinishInputC, OpticalStepDispatchC))
OPTICAL_STEP_C_TYPES = ("OpticalPhaseBindingC", "OpticalStepInputC", "OpticalStepFactsC", "OpticalStepMeasurementC",
    "OpticalStepDecodeInputC", "OpticalStepResponseInputC", "OpticalStepFinishInputC", "OpticalStepDispatchC",
    "DiscreteOpticsRequest", "DMechanicalResult")


def optical_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="optical_step_c.py", applicability=("source_bound_native_optical_primitive",),
        invariants=("one_native_step", "internal_hops_not_commands", "native_debit_once", "no_second_ray_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "uncertain_first_hit"))
        for ref, method, inputs, outputs in OPTICAL_STEP_C_ENTRIES)


def optical_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in OPTICAL_STEP_C_ENTRIES}
    signatures["capability.discrete_relay_optics_calculation"] = (
        (parameter("request", "DiscreteOpticsRequest"),), "DMechanicalResult")
    signatures["capability.optical_step_decode_c"] = ((parameter("request", "OpticalStepInputC"),
        parameter("native", "DMechanicalResult")), "OpticalStepMeasurementC")
    signatures["capability.optical_step_response_c"] = ((parameter("measured", "OpticalStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.optical_step_finish_c"] = ((parameter("measured", "OpticalStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "OpticalStepDispatchC")
    return signatures
