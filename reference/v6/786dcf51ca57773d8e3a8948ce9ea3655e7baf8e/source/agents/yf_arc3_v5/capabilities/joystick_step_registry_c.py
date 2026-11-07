"""Exact joystick native DTOs, no coercion to the B mechanical ABI."""
from .joystick_step_contracts_c import (JoystickStepInputC, JoystickStepFactsC, JoystickStepMeasurementC,
    JoystickStepDecodeInputC, JoystickStepResponseInputC, JoystickStepFinishInputC, JoystickStepDispatchC)
from .joystick_step_c import (measure_joystick_step_signature, unsupported_joystick_step,
    decode_joystick_step, assemble_joystick_step_response, finish_joystick_step)
from .mechanical_request_contracts import MechanicalResponseInput

JOYSTICK_STEP_C_ENTRIES = (
    ("capability.joystick_step_signature_c", measure_joystick_step_signature, JoystickStepInputC, JoystickStepFactsC),
    ("capability.joystick_step_unsupported_c", unsupported_joystick_step, JoystickStepInputC, JoystickStepMeasurementC),
    ("capability.joystick_step_decode_c", decode_joystick_step, JoystickStepDecodeInputC, JoystickStepMeasurementC),
    ("capability.joystick_step_response_c", assemble_joystick_step_response, JoystickStepResponseInputC, MechanicalResponseInput),
    ("capability.joystick_step_finish_c", finish_joystick_step, JoystickStepFinishInputC, JoystickStepDispatchC))
JOYSTICK_STEP_C_TYPES = ("JoystickPhaseBindingC", "JoystickStepInputC", "JoystickStepFactsC", "JoystickStepMeasurementC",
    "JoystickStepDecodeInputC", "JoystickStepResponseInputC", "JoystickStepFinishInputC", "JoystickStepDispatchC",
    "BoundedJoystickRequest", "DMechanicalResult")


def joystick_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="joystick_step_c.py", applicability=("source_bound_native_joystick_primitive",),
        invariants=("one_native_step", "native_joystick_transaction_not_commands", "native_debit_once", "no_second_joystick_transition_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_joystick_context"))
        for ref, method, inputs, outputs in JOYSTICK_STEP_C_ENTRIES)


def joystick_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in JOYSTICK_STEP_C_ENTRIES}
    signatures["capability.bounded_joystick_calculation"] = (
        (parameter("request", "BoundedJoystickRequest"),), "DMechanicalResult")
    signatures["capability.joystick_step_decode_c"] = ((parameter("request", "JoystickStepInputC"),
        parameter("native", "DMechanicalResult")), "JoystickStepMeasurementC")
    signatures["capability.joystick_step_response_c"] = ((parameter("measured", "JoystickStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.joystick_step_finish_c"] = ((parameter("measured", "JoystickStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "JoystickStepDispatchC")
    return signatures
