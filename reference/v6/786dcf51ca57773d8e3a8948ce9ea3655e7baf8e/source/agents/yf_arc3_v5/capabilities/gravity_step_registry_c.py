"""Exact gravity native DTOs, no coercion to the B mechanical ABI."""
from .gravity_step_contracts_c import (GravityStepInputC, GravityStepFactsC, GravityStepMeasurementC,
    GravityStepDecodeInputC, GravityStepResponseInputC, GravityStepFinishInputC, GravityStepDispatchC)
from .gravity_step_c import (measure_gravity_step_signature, unsupported_gravity_step,
    decode_gravity_step, assemble_gravity_step_response, finish_gravity_step)
from .mechanical_request_contracts import MechanicalResponseInput

GRAVITY_STEP_C_ENTRIES = (
    ("capability.gravity_step_signature_c", measure_gravity_step_signature, GravityStepInputC, GravityStepFactsC),
    ("capability.gravity_step_unsupported_c", unsupported_gravity_step, GravityStepInputC, GravityStepMeasurementC),
    ("capability.gravity_step_decode_c", decode_gravity_step, GravityStepDecodeInputC, GravityStepMeasurementC),
    ("capability.gravity_step_response_c", assemble_gravity_step_response, GravityStepResponseInputC, MechanicalResponseInput),
    ("capability.gravity_step_finish_c", finish_gravity_step, GravityStepFinishInputC, GravityStepDispatchC))
GRAVITY_STEP_C_TYPES = ("GravityPhaseBindingC", "GravityStepInputC", "GravityStepFactsC", "GravityStepMeasurementC",
    "GravityStepDecodeInputC", "GravityStepResponseInputC", "GravityStepFinishInputC", "GravityStepDispatchC",
    "CoupledMemberRequest", "DMechanicalResult")


def gravity_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="gravity_step_c.py", applicability=("source_bound_native_gravity_primitive",),
        invariants=("one_native_step", "native_coverage_transaction_not_commands", "native_debit_once", "no_second_coverage_transition_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_coverage_context"))
        for ref, method, inputs, outputs in GRAVITY_STEP_C_ENTRIES)


def gravity_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in GRAVITY_STEP_C_ENTRIES}
    signatures["capability.coupled_member_control_calculation"] = (
        (parameter("request", "CoupledMemberRequest"),), "DMechanicalResult")
    signatures["capability.gravity_step_decode_c"] = ((parameter("request", "GravityStepInputC"),
        parameter("native", "DMechanicalResult")), "GravityStepMeasurementC")
    signatures["capability.gravity_step_response_c"] = ((parameter("measured", "GravityStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.gravity_step_finish_c"] = ((parameter("measured", "GravityStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn"), parameter("source_packet_allowed", "Boolean")), "GravityStepDispatchC")
    return signatures
