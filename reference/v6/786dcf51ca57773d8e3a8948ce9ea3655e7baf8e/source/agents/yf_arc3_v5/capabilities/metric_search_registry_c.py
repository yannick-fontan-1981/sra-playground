"""Native K63 orchestration calls the existing K09 without a family BFS."""
from .metric_search_contracts_c import (MetricSearchInputC, MetricSearchSessionC,
    MetricSearchNextInputC, MetricSearchAppendInputC, MetricSearchAcceptInputC,
    MetricSearchResponseInputC)
from .metric_search_c import (initialize_metric_search, license_metric_goal_contract,
    recalculate_metric_search, bind_metric_search_step, measure_metric_goal_acceptance,
    append_metric_search_step, measure_metric_domain_closure, seal_metric_domain,
    assemble_metric_search_response)
from .metric_step_contracts_c import MetricStepInputC
from .mechanical_common_contracts_c import CommonSignatureFactsC
from .mechanical_request_contracts import MechanicalResponseInput

METRIC_SEARCH_C_ENTRIES = (
    ("capability.metric_search_initialize_c", initialize_metric_search, MetricSearchInputC, MetricSearchSessionC),
    ("capability.metric_search_license_goal_c", license_metric_goal_contract, MetricSearchSessionC, MetricSearchSessionC),
    ("capability.metric_search_recalculate_c", recalculate_metric_search, MetricSearchSessionC, MetricSearchSessionC),
    ("capability.metric_search_next_step_c", bind_metric_search_step, MetricSearchNextInputC, MetricStepInputC),
    ("capability.metric_search_acceptance_facts_c", measure_metric_goal_acceptance, MetricSearchAcceptInputC, CommonSignatureFactsC),
    ("capability.metric_search_append_c", append_metric_search_step, MetricSearchAppendInputC, MetricSearchSessionC),
    ("capability.metric_search_closure_facts_c", measure_metric_domain_closure, MetricSearchSessionC, CommonSignatureFactsC),
    ("capability.metric_search_seal_domain_c", seal_metric_domain, MetricSearchSessionC, MetricSearchSessionC),
    ("capability.metric_search_response_c", assemble_metric_search_response, MetricSearchResponseInputC, MechanicalResponseInput),
)
METRIC_SEARCH_C_TYPES = tuple(sorted({model.__name__ for _, _, before, after in METRIC_SEARCH_C_ENTRIES
    for model in (before, after)} | {"MetricSearchPrimitiveC"}))


def metric_search_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=implementation,
        input_model=before, output_model=after, source_file="metric_search_c.py",
        applicability=("source_bound_native_k63_route_and_goal_contract",),
        invariants=("existing_k09_only", "native_k63_dto_not_b", "stable_goal_contract_and_resume",
            "source_licenses_goal_from_native_acceptance", "no_implicit_empty_domain_or_victory", "no_act"),
        falsifiers=("goal_contract_mismatch", "missing_native_step_phase", "actual_bound_reached"))
        for ref, implementation, before, after in METRIC_SEARCH_C_ENTRIES)


def metric_search_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(kind, optional=optional))
    signatures = {ref: ((parameter("request", before.__name__),), after.__name__)
        for ref, _, before, after in METRIC_SEARCH_C_ENTRIES}
    signatures["capability.metric_search_next_step_c"] = ((parameter("session", "MetricSearchSessionC"),
        parameter("needed", "Any")), "MetricStepInputC")
    signatures["capability.metric_search_acceptance_facts_c"] = ((parameter("session", "MetricSearchSessionC"),
        parameter("dispatched", "MetricStepDispatchC")), "CommonSignatureFactsC")
    signatures["capability.metric_search_append_c"] = ((parameter("session", "MetricSearchSessionC"),
        parameter("dispatched", "MetricStepDispatchC"), parameter("source_accept_goal", "Boolean")), "MetricSearchSessionC")
    signatures["capability.metric_search_response_c"] = ((parameter("session", "MetricSearchSessionC"),
        parameter("source_status", "Any"), parameter("missing_cause", "Any", True)), "MechanicalResponseInput")
    return signatures
