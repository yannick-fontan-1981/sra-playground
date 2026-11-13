"""K79 strategy ports; the D collector and C query bridge remain authoritative."""
from .prefix_solving_contracts_c import (PrefixSolvingBindInputC, PrefixSolvingFinishInputC, PrefixSolvingReturnC)
from .prefix_solving_c import bind_prefix_solving_profile, bind_prefix_solving_query, finish_prefix_solving
from .mechanical_profile_d import DNativeProfileRequest
from .prefix_query_bridge_contracts_c import PrefixQuerySourceInputC

PREFIX_SOLVING_C_TYPES = ("PrefixTerminalContractC", "PrefixConstructionWitnessC", "PrefixSolvingInputC",
    "PrefixSolvingFactsC", "PrefixSolvingBindInputC", "PrefixSolvingFinishInputC", "PrefixSolvingReturnC")
PREFIX_SOLVING_C_ENTRIES = (
    ("capability.prefix_solving_profile_c", bind_prefix_solving_profile, PrefixSolvingBindInputC, DNativeProfileRequest),
    ("capability.prefix_solving_query_c", bind_prefix_solving_query, PrefixSolvingBindInputC, PrefixQuerySourceInputC),
    ("capability.prefix_solving_return_c", finish_prefix_solving, PrefixSolvingFinishInputC, PrefixSolvingReturnC))

def prefix_solving_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="prefix_solving_c.py", applicability=("goal_owned_prefix_construction",),
        invariants=("coverage_AND_projection", "partner_reservations", "irreversible_prefix",
            "current_palette", "same_native_collector", "all_models_retained", "no_act"),
        falsifiers=("unbound_terminal_quantifier", "stale_agenda", "wrong_inverse_row", "changed_inserted_prefix"))
        for ref, method, inputs, outputs in PREFIX_SOLVING_C_ENTRIES)

def prefix_solving_signatures_c(type_spec, parameter_spec):
    def parameter(name, model):
        return parameter_spec(name=name, type_spec=type_spec(model))
    return {
        "capability.prefix_solving_profile_c": ((parameter("measured", "PrefixSolvingFactsC"),), "DNativeProfileRequest"),
        "capability.prefix_solving_query_c": ((parameter("measured", "PrefixSolvingFactsC"),), "PrefixQuerySourceInputC"),
        "capability.prefix_solving_return_c": ((parameter("measured", "PrefixSolvingFactsC"),
            parameter("profile_return", "Any"), parameter("query_return", "Any")), "PrefixSolvingReturnC")}
