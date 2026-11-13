"""Optical Source strategy ports; current D and K09 remain the only calculations."""
from .optical_solving_contracts_c import OpticalSolvingBindInputC, OpticalSolvingFinishInputC, OpticalSolvingReturnC
from .mechanical_profile_d import DNativeProfileRequest
from .mechanical_common_contracts_c import SearchDomainInputC
from .optical_solving_c import bind_optical_solving_profile, bind_optical_solving_query, finish_optical_solving

OPTICAL_SOLVING_C_TYPES = ("OpticalTerminalContractC", "OpticalRouteSelectionC", "OpticalSolvingInputC",
    "OpticalSolvingFactsC", "OpticalSolvingBindInputC", "OpticalSolvingFinishInputC", "OpticalSolvingReturnC")
OPTICAL_SOLVING_C_ENTRIES = (
    ("capability.optical_solving_profile_c", bind_optical_solving_profile, OpticalSolvingBindInputC, DNativeProfileRequest),
    ("capability.optical_solving_query_c", bind_optical_solving_query, OpticalSolvingBindInputC, SearchDomainInputC),
    ("capability.optical_solving_return_c", finish_optical_solving, OpticalSolvingFinishInputC, OpticalSolvingReturnC))

def optical_solving_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="optical_solving_c.py", applicability=("goal_owned_optical_chain",),
        invariants=("first_hit_chain", "explicit_terminal_quantifier", "preserved_prepared_service",
            "same_native_physics", "same_K09", "all_models", "no_act"),
        falsifiers=("stale_agenda", "unbound_ray", "drawing_index_as_angle", "reset_angles_assumed"))
        for ref, method, inputs, outputs in OPTICAL_SOLVING_C_ENTRIES)

def optical_solving_signatures_c(type_spec, parameter_spec):
    def parameter(name, model):
        return parameter_spec(name=name, type_spec=type_spec(model))
    return {
        "capability.optical_solving_profile_c": ((parameter("measured", "OpticalSolvingFactsC"),), "DNativeProfileRequest"),
        "capability.optical_solving_query_c": ((parameter("measured", "OpticalSolvingFactsC"),), "SearchDomainInputC"),
        "capability.optical_solving_return_c": ((parameter("measured", "OpticalSolvingFactsC"),
            parameter("profile_return", "Any"), parameter("search_return", "Any")), "OpticalSolvingReturnC")}
