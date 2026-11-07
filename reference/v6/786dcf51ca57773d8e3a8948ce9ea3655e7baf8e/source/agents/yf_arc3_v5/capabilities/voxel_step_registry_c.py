"""Exact voxel native DTOs, no coercion to the B mechanical ABI."""
from .voxel_step_contracts_c import (VoxelStepInputC, VoxelStepFactsC, VoxelStepMeasurementC,
    VoxelStepDecodeInputC, VoxelStepResponseInputC, VoxelStepFinishInputC, VoxelStepDispatchC)
from .voxel_step_c import (measure_voxel_step_signature, unsupported_voxel_step,
    decode_voxel_step, assemble_voxel_step_response, finish_voxel_step)
from .mechanical_request_contracts import MechanicalResponseInput

VOXEL_STEP_C_ENTRIES = (
    ("capability.voxel_step_signature_c", measure_voxel_step_signature, VoxelStepInputC, VoxelStepFactsC),
    ("capability.voxel_step_unsupported_c", unsupported_voxel_step, VoxelStepInputC, VoxelStepMeasurementC),
    ("capability.voxel_step_decode_c", decode_voxel_step, VoxelStepDecodeInputC, VoxelStepMeasurementC),
    ("capability.voxel_step_response_c", assemble_voxel_step_response, VoxelStepResponseInputC, MechanicalResponseInput),
    ("capability.voxel_step_finish_c", finish_voxel_step, VoxelStepFinishInputC, VoxelStepDispatchC))
VOXEL_STEP_C_TYPES = ("VoxelPhaseBindingC", "VoxelStepInputC", "VoxelStepFactsC", "VoxelStepMeasurementC",
    "VoxelStepDecodeInputC", "VoxelStepResponseInputC", "VoxelStepFinishInputC", "VoxelStepDispatchC",
    "VisibleVoxelRequest", "DMechanicalResult")


def voxel_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="voxel_step_c.py", applicability=("source_bound_native_voxel_primitive",),
        invariants=("one_native_step", "native_view_not_commands", "native_debit_once", "no_second_render_or_act"),
        falsifiers=("wrong_owner_or_model", "missing_native_phase", "missing_view_checkpoint"))
        for ref, method, inputs, outputs in VOXEL_STEP_C_ENTRIES)


def voxel_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in VOXEL_STEP_C_ENTRIES}
    signatures["capability.visible_voxel_construction_calculation"] = (
        (parameter("request", "VisibleVoxelRequest"),), "DMechanicalResult")
    signatures["capability.voxel_step_decode_c"] = ((parameter("request", "VoxelStepInputC"),
        parameter("native", "DMechanicalResult")), "VoxelStepMeasurementC")
    signatures["capability.voxel_step_response_c"] = ((parameter("measured", "VoxelStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.voxel_step_finish_c"] = ((parameter("measured", "VoxelStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "VoxelStepDispatchC")
    return signatures
