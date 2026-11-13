"""Separate Source-requested finite CSP and frontier dynamic programming."""
from .finite_search_contracts_c import FiniteSearchInputC, FiniteSearchFactsC
from .finite_search_c import enumerate_finite_relations, dynamic_program_finite_relations

FINITE_SEARCH_C_TYPES = ("FiniteVariableC", "FiniteRelationC", "FiniteSearchCheckpointC", "FiniteSearchInputC", "FiniteSearchFactsC")
FINITE_SEARCH_C_ENTRIES = (
    ("capability.finite_csp_c", enumerate_finite_relations),
    ("capability.finite_dp_c", dynamic_program_finite_relations))


def finite_search_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=FiniteSearchInputC,
        output_model=FiniteSearchFactsC, source_file="finite_search_c.py",
        applicability=("supplied_complete_finite_relations",),
        invariants=("exact_additive_cost", "full_assignment_witness", "current_variable_order", "bounds_no_empty_proof"),
        falsifiers=("unknown_row_domain", "missing_value_cost", "bound_reached")) for ref, method in FINITE_SEARCH_C_ENTRIES)


def finite_search_signatures_c(type_spec, parameter_spec):
    return {ref: ((parameter_spec(name="request", type_spec=type_spec("FiniteSearchInputC")),), "FiniteSearchFactsC")
        for ref, _ in FINITE_SEARCH_C_ENTRIES}
