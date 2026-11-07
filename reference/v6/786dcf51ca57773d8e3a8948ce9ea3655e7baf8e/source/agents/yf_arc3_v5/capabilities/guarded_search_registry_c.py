"""One Source-bound selection of K09/CSP/DP, with typed immutable results."""
from .guarded_search_contracts_c import (GuardedSearchInputC, GuardedSearchFactsC,
    GuardedSearchReturnInputC, GuardedSearchReturnC)
from .guarded_search_c import (measure_guarded_search, bound_guarded_query,
    bound_guarded_finite_query, assemble_guarded_search_return)
from .mechanical_common_contracts_c import SearchDomainInputC, SearchResultC
from .finite_search_contracts_c import FiniteSearchInputC, FiniteSearchFactsC

GUARDED_SEARCH_C_TYPES = ("GuardedSearchInputC", "GuardedSearchFactsC", "GuardedSearchReturnInputC", "GuardedSearchReturnC")
GUARDED_SEARCH_C_ENTRIES = (
    ("capability.guarded_search_measure_c", measure_guarded_search, GuardedSearchInputC, GuardedSearchFactsC),
    ("capability.guarded_search_query_c", bound_guarded_query, GuardedSearchInputC, SearchDomainInputC),
    ("capability.guarded_search_finite_query_c", bound_guarded_finite_query, GuardedSearchInputC, FiniteSearchInputC),
    ("capability.guarded_search_return_c", assemble_guarded_search_return, GuardedSearchReturnInputC, GuardedSearchReturnC))


def guarded_search_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file="guarded_search_c.py", applicability=("current_explicit_algorithm_request",),
        invariants=("source_algorithm_choice", "exact_query_and_bounds", "frozen_why", "no_physical_release"),
        falsifiers=("stale_query", "wrong_algorithm_contract", "unverified_lower_bound"))
        for ref, method, before, after in GUARDED_SEARCH_C_ENTRIES)


def guarded_search_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(kind, optional=optional))
    result = {ref: ((parameter("request", before.__name__),), after.__name__)
        for ref, _, before, after in GUARDED_SEARCH_C_ENTRIES}
    result["capability.guarded_search_return_c"] = ((parameter("request", "GuardedSearchInputC"),
        parameter("measured", "GuardedSearchFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String"), parameter("source_reason_ref", "String"),
        parameter("search_result", "SearchResultC", True), parameter("finite_result", "FiniteSearchFactsC", True)), "GuardedSearchReturnC")
    return result
