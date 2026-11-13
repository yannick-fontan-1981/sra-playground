"""Private explicit Source witness engagement bindings."""
from .search_witness_scope_contracts_c import (SearchWitnessScopeInputC, SearchWitnessScopeFactsC,
    SearchWitnessScopeDecisionInputC, SearchWitnessScopeDecisionC)
from .search_witness_scope_c import measure_search_witness_scope, assemble_search_witness_scope

SEARCH_WITNESS_SCOPE_C_TYPES = ("AdditionalSearchBoundReceiptC", "SearchWitnessScopeInputC",
    "SearchWitnessScopeFactsC", "SearchWitnessScopeDecisionInputC", "SearchWitnessScopeDecisionC")


def search_witness_scope_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="search_witness_scope_c.py",
        applicability=("current_source_authorized_search_witness",),
        invariants=("retain_all_policy_proof_branches", "root_cap_not_domain_cap", "no_search_or_act"),
        falsifiers=("stale_certificate_inputs", "unsupported_bound", "unauthorized_prefix"))
        for ref, method, inputs, outputs in (
            ("capability.search_witness_scope_facts_c", measure_search_witness_scope,
                SearchWitnessScopeInputC, SearchWitnessScopeFactsC),
            ("capability.search_witness_scope_assembly_c", assemble_search_witness_scope,
                SearchWitnessScopeDecisionInputC, SearchWitnessScopeDecisionC)))


def search_witness_scope_signatures_c(type_spec, parameter_spec):
    parameter = lambda name, model: parameter_spec(name=name, type_spec=type_spec(model))
    return {"capability.search_witness_scope_facts_c": (
        (parameter("request", "SearchWitnessScopeInputC"),), "SearchWitnessScopeFactsC"),
        "capability.search_witness_scope_assembly_c": ((parameter("request", "SearchWitnessScopeInputC"),
            parameter("measured", "SearchWitnessScopeFactsC"), parameter("source_disposition_ref", "Any"),
            parameter("source_policy_ref", "Any")), "SearchWitnessScopeDecisionC")}
