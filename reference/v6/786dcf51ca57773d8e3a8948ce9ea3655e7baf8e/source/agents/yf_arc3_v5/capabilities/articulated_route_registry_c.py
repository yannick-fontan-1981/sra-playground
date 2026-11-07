"""Typed native-receipt transport into the existing K09 search workflow."""
from .articulated_route_contracts_c import (ArticulatedRouteBridgeInputC,ArticulatedRouteBridgeFactsC,
    ArticulatedRouteQueryInputC,ArticulatedRouteReturnInputC,ArticulatedRouteReturnC)
from .articulated_route_bridge_c import measure_articulated_route_bridge,get_articulated_route_query,return_articulated_route
from .mechanical_common_contracts_c import SearchDomainInputC

ARTICULATED_ROUTE_C_TYPES=("ArticulatedRouteEdgeC","ArticulatedRouteBridgeInputC","ArticulatedRouteBridgeFactsC",
    "ArticulatedRouteQueryInputC","ArticulatedRouteReturnInputC","ArticulatedRouteReturnC")


def articulated_route_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref,implementation=method,input_model=inputs,output_model=outputs,
        source_file="articulated_route_bridge_c.py",applicability=("current_K24_transition_domain",),
        invariants=("same_K09","full_state","joint_events","no_ACT"),falsifiers=("stale_receipt","wrong_model_scope"))
        for ref,method,inputs,outputs in (
            ("capability.articulated_route_measure_c",measure_articulated_route_bridge,ArticulatedRouteBridgeInputC,ArticulatedRouteBridgeFactsC),
            ("capability.articulated_route_query_c",get_articulated_route_query,ArticulatedRouteQueryInputC,SearchDomainInputC),
            ("capability.articulated_route_return_c",return_articulated_route,ArticulatedRouteReturnInputC,ArticulatedRouteReturnC)))


def articulated_route_signatures_c(type_spec,parameter_spec):
    def p(name,kind):return parameter_spec(name=name,type_spec=type_spec(kind))
    return {"capability.articulated_route_measure_c":((p("query","SearchDomainInputC"),p("edges","List<ArticulatedRouteEdgeC>")),"ArticulatedRouteBridgeFactsC"),
        "capability.articulated_route_query_c":((p("measured","ArticulatedRouteBridgeFactsC"),),"SearchDomainInputC"),
        "capability.articulated_route_return_c":((p("measured","ArticulatedRouteBridgeFactsC"),p("returned","Any")),"ArticulatedRouteReturnC")}
