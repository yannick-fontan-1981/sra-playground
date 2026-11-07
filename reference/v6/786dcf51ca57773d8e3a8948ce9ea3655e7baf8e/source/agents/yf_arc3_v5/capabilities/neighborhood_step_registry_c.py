"""Native D provider registrations; dispatch and result classification are Source-owned."""
from .neighborhood_step_contracts_c import (NeighborhoodStepInputC, NeighborhoodStepFactsC,
    NeighborhoodStepMeasurementC, NeighborhoodStepDecodeInputC, NeighborhoodStepResponseInputC,
    NeighborhoodStepFinishInputC, NeighborhoodStepDispatchC)
from .neighborhood_step_c import (measure_neighborhood_step_signature, unsupported_neighborhood_step,
    decode_neighborhood_step, assemble_neighborhood_step_response, finish_neighborhood_step)
from .neighborhood_pattern_construction import NeighborhoodPatternRequest, measure_neighborhood_pattern_construction
from .mechanical_family_contracts_d import DMechanicalResult
from .mechanical_request_contracts import MechanicalResponseInput

NEIGHBORHOOD_STEP_C_ENTRIES = (
    ("capability.neighborhood_step_signature_c", measure_neighborhood_step_signature,
        NeighborhoodStepInputC, NeighborhoodStepFactsC, "neighborhood_step_c.py"),
    ("capability.neighborhood_step_unsupported_c", unsupported_neighborhood_step,
        NeighborhoodStepInputC, NeighborhoodStepMeasurementC, "neighborhood_step_c.py"),
    ("capability.neighborhood_step_decode_c", decode_neighborhood_step,
        NeighborhoodStepDecodeInputC, NeighborhoodStepMeasurementC, "neighborhood_step_c.py"),
    ("capability.neighborhood_step_response_c", assemble_neighborhood_step_response,
        NeighborhoodStepResponseInputC, MechanicalResponseInput, "neighborhood_step_c.py"),
    ("capability.neighborhood_step_finish_c", finish_neighborhood_step,
        NeighborhoodStepFinishInputC, NeighborhoodStepDispatchC, "neighborhood_step_c.py"),
    ("capability.neighborhood_pattern_construction_calculation", measure_neighborhood_pattern_construction,
        NeighborhoodPatternRequest, DMechanicalResult, "neighborhood_pattern_construction.py"),
)
NEIGHBORHOOD_STEP_C_TYPES = tuple(sorted({model.__name__ for _, _, before, after, _ in NEIGHBORHOOD_STEP_C_ENTRIES
    for model in (before, after)} | {"NeighborhoodPhaseBindingC"}))


def neighborhood_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=implementation, input_model=before,
        output_model=after, source_file=source, applicability=("exact_source_bound_native_d_step",),
        invariants=("native_d_dto_not_b_coercion", "one_step_call", "full_forward_phase_ledger_only",
            "no_endpoint_closure_invention", "no_search_inside_step", "no_action_release"),
        falsifiers=("native_identity_or_phase_mismatch", "missing_clock_contract", "incomplete_native_return"))
        for ref, implementation, before, after, source in NEIGHBORHOOD_STEP_C_ENTRIES)


def neighborhood_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(kind, optional=optional))
    signatures = {ref: ((parameter("request", before.__name__),), after.__name__)
        for ref, _, before, after, _ in NEIGHBORHOOD_STEP_C_ENTRIES}
    signatures["capability.neighborhood_pattern_construction_calculation"] = (
        (parameter("request", "Any"),), "DMechanicalResult")
    signatures["capability.neighborhood_step_decode_c"] = ((parameter("request", "NeighborhoodStepInputC"),
        parameter("native", "DMechanicalResult")), "NeighborhoodStepMeasurementC")
    signatures["capability.neighborhood_step_response_c"] = ((parameter("measured", "NeighborhoodStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    signatures["capability.neighborhood_step_finish_c"] = ((parameter("measured", "NeighborhoodStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "NeighborhoodStepDispatchC")
    return signatures
