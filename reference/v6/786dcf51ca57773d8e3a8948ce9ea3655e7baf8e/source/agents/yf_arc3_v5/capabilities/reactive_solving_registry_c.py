"""K33 Source strategy ports; K33 and K09 calculations stay shared."""
from .reactive_solving_contracts_c import ReactiveSolvingBindInputC, ReactiveSolvingFinishInputC, ReactiveSolvingReturnC
from .reactive_graph_contracts_c import ReactiveGraphRequestC
from .mechanical_common_contracts_c import SearchDomainInputC
from .reactive_solving_c import bind_reactive_solving_native, bind_reactive_solving_search, finish_reactive_solving

REACTIVE_SOLVING_C_TYPES = ("ReactiveExitContractC", "ReactiveRouteSupportC", "ReactiveSolvingInputC",
    "ReactiveSolvingFactsC", "ReactiveSolvingBindInputC", "ReactiveSolvingFinishInputC", "ReactiveSolvingReturnC",
    "ReactivePhaseBindingC", "ReactivePacketReceiptC", "ReactivePacketMeasurementC")
REACTIVE_SOLVING_C_ENTRIES = (
    ("capability.reactive_solving_native_c", bind_reactive_solving_native, ReactiveSolvingBindInputC, ReactiveGraphRequestC),
    ("capability.reactive_solving_query_c", bind_reactive_solving_search, ReactiveSolvingBindInputC, SearchDomainInputC),
    ("capability.reactive_solving_return_c", finish_reactive_solving, ReactiveSolvingFinishInputC, ReactiveSolvingReturnC))

def reactive_solving_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="reactive_solving_c.py", applicability=("current_surviving_exit_goal",),
        invariants=("whole_joint_state", "real_transit_links", "follower_history", "clock_and_contact_order",
            "route_useful_capture", "same_K33_K09", "no_act"),
        falsifiers=("stale_receipt", "implicit_all_guard_removal", "unbound_recovery", "fictitious_wait"))
        for ref, method, inputs, outputs in REACTIVE_SOLVING_C_ENTRIES)

def reactive_solving_signatures_c(type_spec, parameter_spec):
    def parameter(name, model):
        return parameter_spec(name=name, type_spec=type_spec(model))
    return {
        "capability.reactive_solving_native_c": ((parameter("measured", "ReactiveSolvingFactsC"),), "ReactiveGraphRequestC"),
        "capability.reactive_solving_query_c": ((parameter("measured", "ReactiveSolvingFactsC"),), "SearchDomainInputC"),
        "capability.reactive_solving_return_c": ((parameter("measured", "ReactiveSolvingFactsC"),
            parameter("native_return", "Any"), parameter("search_return", "Any")), "ReactiveSolvingReturnC")}
