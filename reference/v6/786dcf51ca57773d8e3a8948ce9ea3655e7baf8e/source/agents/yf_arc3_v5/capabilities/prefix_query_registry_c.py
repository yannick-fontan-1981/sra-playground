"""K79 Source ports; native physics and generic C search remain existing services."""
from .prefix_query_bridge_contracts_c import (PrefixQuerySourceInputC, PrefixQuerySourceFactsC,
    PrefixQuerySourceFinishInputC, PrefixQuerySourceReturnC)
from .prefix_query_bridge_c import measure_prefix_query_source, get_prefix_schedule_query, finish_prefix_query_source
from .mechanical_common_contracts_c import SearchDomainInputC

PREFIX_QUERY_C_TYPES = ["PrefixLayoutElementC","PrefixScheduleThreadC","PrefixFocusQuestionC","PrefixQueryCheckpointC","PrefixQuerySourceInputC","PrefixQuerySourceFactsC","PrefixQuerySourceFinishInputC","PrefixQuerySourceReturnC"]
PREFIX_QUERY_C_ENTRIES = (
    ("capability.prefix_query_source_signature_c", measure_prefix_query_source, PrefixQuerySourceInputC, PrefixQuerySourceFactsC),
    ("capability.prefix_query_search_input_c", get_prefix_schedule_query, PrefixQuerySourceInputC, SearchDomainInputC),
    ("capability.prefix_query_source_return_c", finish_prefix_query_source, PrefixQuerySourceFinishInputC, PrefixQuerySourceReturnC))


def prefix_query_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="prefix_query_bridge_c.py", applicability=("current_layered_prefix_query",),
        invariants=("same_native_physics", "same_scoped_search", "source_role_and_relevance", "no_act_or_counter_change"),
        falsifiers=("stale_query", "unbound_layout_role", "second_physics_or_debit", "recursive_search_from_successor"))
        for ref, method, inputs, outputs in PREFIX_QUERY_C_ENTRIES)


def prefix_query_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in PREFIX_QUERY_C_ENTRIES}
    signatures["capability.prefix_query_source_return_c"] = ((parameter("request", "PrefixQuerySourceInputC"),
        parameter("native", "DMechanicalResult", True), parameter("search", "MechanicalNormalizedReturn", True),
        parameter("source_disposition_ref", "String"), parameter("source_policy_ref", "String"),
        parameter("source_reason_ref", "String")), "PrefixQuerySourceReturnC")
    return signatures
