"""Exact algorithm contracts; DRM chooses and SRC invokes one existing calculator."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_search_c import search_context_digest,full_search_state_key
from .guarded_search_contracts_c import (GuardedSearchInputC, GuardedSearchFactsC,
    GuardedSearchReturnInputC, GuardedSearchReturnC)


def measure_guarded_search(value: GuardedSearchInputC) -> GuardedSearchFactsC:
    root, query, finite = value.request, value.query, value.finite_query
    current = (root.kernel_ref == "mechanics.bounded_route_search"
        and root.operation_ref == "mechanics.bounded_route_search.guarded_algorithm"
        and root.mode == "REQUEST" and root.expected_return_type == "GuardedSearchReturnC"
        and bool(value.evidence_refs)
        and root.immutable_inputs.get("requested_algorithm_ref") == value.requested_algorithm_ref)
    graph = (current and query is not None and finite is None
        and packet_context_equal(root, query.request)
        and query.request.actual_bounds == root.actual_bounds
        and query.request.kernel_ref == "mechanics.bounded_route_search"
        and query.request.operation_ref == "mechanics.bounded_route_search"
        and query.request.expected_return_type == "SearchResultC"
        and root.immutable_inputs.get("search_query_digest") == search_context_digest(query))
    relation = (current and finite is not None and query is None
        and packet_context_equal(root, finite.request)
        and finite.request.actual_bounds == root.actual_bounds
        and finite.request.kernel_ref == "mechanics.bounded_route_search"
        and finite.request.operation_ref == "mechanics.bounded_route_search.finite_relations"
        and finite.request.expected_return_type == "FiniteSearchFactsC"
        and root.immutable_inputs.get("finite_query_digest") == stable_digest(immutable_json_data(finite)))
    uniform = graph and query.request.mode == "ROUTE" and query.route_algorithm_ref == "UNIFORM_COST"
    astar = graph and query.request.mode == "ROUTE" and query.route_algorithm_ref == "ASTAR"
    reply_scope_bound=(graph and {state.model_ref for state in query.initial_states}==set(query.retained_model_refs)
        and bool(query.initial_states)
        and all(query.state_observations.get(full_search_state_key(state)) is not None for state in query.initial_states)
        and len({query.state_observations[full_search_state_key(state)] for state in query.initial_states})==1)
    universal = (reply_scope_bound and query.request.mode in ("POLICY", "BELIEF")
        and query.controllable_quantifier == "EXISTS" and query.response_quantifier == "FORALL"
        and query.route_algorithm_ref == "UNIFORM_COST")
    csp = relation and finite.request.mode == "CSP"
    dp = relation and finite.request.mode == "DP"
    requested = value.requested_algorithm_ref
    qualified = ((requested is None or requested == "UNIFORM_COST") and uniform
        or requested == "ASTAR" and astar or requested in ("AND_OR", "MINIMAX") and universal
        or requested == "CSP" and csp or requested == "DP" and dp)
    return GuardedSearchFactsC(facts=FrozenMap({"requested_algorithm_ref": requested,
        "uniform_contract": uniform, "astar_contract": astar, "universal_contract": universal,
        "csp_contract": csp, "dp_contract": dp, "algorithm_contract_qualified": bool(qualified)}))


def bound_guarded_query(value: GuardedSearchInputC):
    return value.query


def bound_guarded_finite_query(value: GuardedSearchInputC):
    return value.finite_query


def assemble_guarded_search_return(value: GuardedSearchReturnInputC) -> GuardedSearchReturnC:
    return GuardedSearchReturnC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref,
        source_reason_ref=value.source_reason_ref, search_result=value.search_result, finite_result=value.finite_result)
