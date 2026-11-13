"""Registry proposal for the SRC K09 conductor, not a family route engine."""
from .mechanical_search_driver_contracts_c import (SearchDriverInputC, SearchDriverSessionC,
    SearchNextStepInputC, SearchStepAppendInputC, SearchDriverResponseInputC)
from .mechanical_search_driver_c import (initialize_search_driver, prepare_requested_search_step,
    append_search_step, recalculate_search_frontier, measure_search_closure_candidate,
    seal_source_qualified_reachable_domain, seal_source_qualified_first_shortest, assemble_search_driver_response)
from .mechanical_step_contracts_c import ExternalStepInputC
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_common_contracts_c import CommonSignatureFactsC

SEARCH_DRIVER_C_ENTRIES = (
    ("capability.search_driver_initialize_c", initialize_search_driver,
        SearchDriverInputC, SearchDriverSessionC),
    ("capability.search_driver_next_step_c", prepare_requested_search_step,
        SearchNextStepInputC, ExternalStepInputC),
    ("capability.search_driver_append_c", append_search_step,
        SearchStepAppendInputC, SearchDriverSessionC),
    ("capability.search_driver_recalculate_c", recalculate_search_frontier,
        SearchDriverSessionC, SearchDriverSessionC),
    ("capability.search_driver_closure_facts_c", measure_search_closure_candidate,
        SearchDriverSessionC, CommonSignatureFactsC),
    ("capability.search_driver_seal_c", seal_source_qualified_reachable_domain,
        SearchDriverSessionC, SearchDriverSessionC),
    ("capability.search_driver_seal_first_shortest_c", seal_source_qualified_first_shortest,
        SearchDriverSessionC, SearchDriverSessionC),
    ("capability.search_driver_response_c", assemble_search_driver_response,
        SearchDriverResponseInputC, MechanicalResponseInput),
)
SEARCH_DRIVER_C_TYPES = tuple(sorted({model.__name__ for _, _, before, after in SEARCH_DRIVER_C_ENTRIES
    for model in (before, after)}))


def mechanical_search_driver_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=implementation,
        input_model=before, output_model=after, source_file="mechanical_search_driver_c.py",
        applicability=("explicit_finite_primitive_domain", "src_bound_current_step_providers"),
        invariants=("no_family_bfs", "step_only_for_each_missing_edge", "no_action_release",
            "full_state_and_model_key", "actual_step_bound", "unknown_not_impossibility"),
        falsifiers=("signature_or_domain_mismatch", "unclosed_step", "explicit_bound_reached"))
        for ref, implementation, before, after in SEARCH_DRIVER_C_ENTRIES)


def mechanical_search_driver_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(kind, optional=optional))
    signatures = {ref: ((parameter("request", before.__name__),), after.__name__)
        for ref, _, before, after in SEARCH_DRIVER_C_ENTRIES}
    signatures["capability.search_driver_next_step_c"] = ((parameter("session", "SearchDriverSessionC"),
        parameter("needed", "Any")), "ExternalStepInputC")
    signatures["capability.search_driver_append_c"] = ((parameter("session", "SearchDriverSessionC"),
        parameter("dispatched", "ExternalStepDispatchResultC")), "SearchDriverSessionC")
    signatures["capability.search_driver_response_c"] = ((parameter("session", "SearchDriverSessionC"),
        parameter("source_status", "Any"), parameter("missing_cause", "Any", True)), "MechanicalResponseInput")
    return signatures
