"""Native D orchestration calls the existing K09 without a family BFS."""
from .neighborhood_search_contracts_c import (NeighborhoodSearchInputC, NeighborhoodSearchSessionC,
    NeighborhoodSearchNextInputC, NeighborhoodSearchAppendInputC, NeighborhoodSearchAcceptInputC,
    NeighborhoodSearchResponseInputC)
from .neighborhood_search_c import (initialize_neighborhood_search, license_neighborhood_goal_contract,
    recalculate_neighborhood_search, bind_neighborhood_search_step, measure_neighborhood_goal_acceptance,
    append_neighborhood_search_step, measure_neighborhood_domain_closure, seal_neighborhood_domain,
    assemble_neighborhood_search_response)
from .neighborhood_step_contracts_c import NeighborhoodStepInputC
from .mechanical_common_contracts_c import CommonSignatureFactsC
from .mechanical_request_contracts import MechanicalResponseInput

NEIGHBORHOOD_SEARCH_C_ENTRIES = (
    ("capability.neighborhood_search_initialize_c", initialize_neighborhood_search, NeighborhoodSearchInputC, NeighborhoodSearchSessionC),
    ("capability.neighborhood_search_license_goal_c", license_neighborhood_goal_contract, NeighborhoodSearchSessionC, NeighborhoodSearchSessionC),
    ("capability.neighborhood_search_recalculate_c", recalculate_neighborhood_search, NeighborhoodSearchSessionC, NeighborhoodSearchSessionC),
    ("capability.neighborhood_search_next_step_c", bind_neighborhood_search_step, NeighborhoodSearchNextInputC, NeighborhoodStepInputC),
    ("capability.neighborhood_search_acceptance_facts_c", measure_neighborhood_goal_acceptance, NeighborhoodSearchAcceptInputC, CommonSignatureFactsC),
    ("capability.neighborhood_search_append_c", append_neighborhood_search_step, NeighborhoodSearchAppendInputC, NeighborhoodSearchSessionC),
    ("capability.neighborhood_search_closure_facts_c", measure_neighborhood_domain_closure, NeighborhoodSearchSessionC, CommonSignatureFactsC),
    ("capability.neighborhood_search_seal_domain_c", seal_neighborhood_domain, NeighborhoodSearchSessionC, NeighborhoodSearchSessionC),
    ("capability.neighborhood_search_response_c", assemble_neighborhood_search_response, NeighborhoodSearchResponseInputC, MechanicalResponseInput),
)
NEIGHBORHOOD_SEARCH_C_TYPES = tuple(sorted({model.__name__ for _, _, before, after in NEIGHBORHOOD_SEARCH_C_ENTRIES
    for model in (before, after)} | {"NeighborhoodSearchPrimitiveC"}))


def neighborhood_search_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=implementation,
        input_model=before, output_model=after, source_file="neighborhood_search_c.py",
        applicability=("source_bound_native_d_route_and_goal_contract",),
        invariants=("existing_k09_only", "native_d_dto_not_b", "stable_goal_contract_and_resume",
            "source_licenses_goal_from_native_acceptance", "no_implicit_empty_domain_or_victory", "no_act"),
        falsifiers=("goal_contract_mismatch", "missing_native_step_phase", "actual_bound_reached"))
        for ref, implementation, before, after in NEIGHBORHOOD_SEARCH_C_ENTRIES)


def neighborhood_search_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(kind, optional=optional))
    signatures = {ref: ((parameter("request", before.__name__),), after.__name__)
        for ref, _, before, after in NEIGHBORHOOD_SEARCH_C_ENTRIES}
    signatures["capability.neighborhood_search_next_step_c"] = ((parameter("session", "NeighborhoodSearchSessionC"),
        parameter("needed", "Any")), "NeighborhoodStepInputC")
    signatures["capability.neighborhood_search_acceptance_facts_c"] = ((parameter("session", "NeighborhoodSearchSessionC"),
        parameter("dispatched", "NeighborhoodStepDispatchC")), "CommonSignatureFactsC")
    signatures["capability.neighborhood_search_append_c"] = ((parameter("session", "NeighborhoodSearchSessionC"),
        parameter("dispatched", "NeighborhoodStepDispatchC"), parameter("source_accept_goal", "Boolean")), "NeighborhoodSearchSessionC")
    signatures["capability.neighborhood_search_response_c"] = ((parameter("session", "NeighborhoodSearchSessionC"),
        parameter("source_status", "Any"), parameter("missing_cause", "Any", True)), "MechanicalResponseInput")
    return signatures
