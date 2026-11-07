"""Autonomous PATH conductor signatures; no runtime registry is edited here."""
from .mechanical_path_driver_contracts_c import (
    PathDriverInputC, PathDriverSessionC, PathNextStepInputC, PathStepFoldInputC,
    SourceReferenceEqualityInputC, SourceReferenceEqualityResultC, PathDriverNativeInputC,
)
from .mechanical_path_driver_c import (initialize_path_driver, measure_licensed_path_prefix, prepare_next_path_step,
    append_path_step, finish_path_measurement, source_reference_equal, assemble_path_driver_response)
from .mechanical_step_contracts_c import ExternalStepInputC
from .mechanical_common_contracts_c import EventCompositionResultC
from .mechanical_request_contracts import MechanicalResponseInput

PATH_DRIVER_C_ENTRIES = (
    ("capability.path_driver_initialize_c", initialize_path_driver,
        PathDriverInputC, PathDriverSessionC),
    ("capability.path_driver_measure_prefix_c", measure_licensed_path_prefix,
        PathDriverSessionC, PathDriverSessionC),
    ("capability.path_driver_next_step_c", prepare_next_path_step,
        PathNextStepInputC, ExternalStepInputC),
    ("capability.path_driver_append_c", append_path_step,
        PathStepFoldInputC, PathDriverSessionC),
    ("capability.path_driver_finish_c", finish_path_measurement,
        PathDriverSessionC, EventCompositionResultC),
    ("capability.source_reference_equal_c", source_reference_equal,
        SourceReferenceEqualityInputC, SourceReferenceEqualityResultC),
    ("capability.path_driver_response_c", assemble_path_driver_response,
        PathDriverNativeInputC, MechanicalResponseInput),
)
PATH_DRIVER_C_TYPES = tuple(sorted({model.__name__ for _, _, before, after in PATH_DRIVER_C_ENTRIES
    for model in (before, after)}))


def mechanical_path_driver_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=implementation,
        input_model=before, output_model=after, source_file="mechanical_path_driver_c.py",
        applicability=("src_supplied_word_and_exact_provider_template",),
        invariants=("no_action_release", "one_step_call_per_primitive", "no_inferred_mode_or_kernel",
            "unknown_boundary_stops_the_word", "immutable_prefix"),
        falsifiers=("provider_or_word_mismatch", "incomplete_step", "actual_bound_reached"))
        for ref, implementation, before, after in PATH_DRIVER_C_ENTRIES)


def mechanical_path_driver_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(kind, optional=optional))
    signatures = {ref: ((parameter("request", before.__name__),), after.__name__)
        for ref, _, before, after in PATH_DRIVER_C_ENTRIES}
    signatures["capability.path_driver_next_step_c"] = ((parameter("session", "PathDriverSessionC"),
        parameter("primitive", "Any")), "ExternalStepInputC")
    signatures["capability.path_driver_append_c"] = ((parameter("session", "PathDriverSessionC"),
        parameter("dispatched", "ExternalStepDispatchResultC")), "PathDriverSessionC")
    signatures["capability.source_reference_equal_c"] = ((parameter("left", "Any", True),
        parameter("right", "String")), "SourceReferenceEqualityResultC")
    signatures["capability.path_driver_response_c"] = ((parameter("session", "PathDriverSessionC"),
        parameter("source_status", "Any"), parameter("missing_cause", "Any", True)), "MechanicalResponseInput")
    return signatures
