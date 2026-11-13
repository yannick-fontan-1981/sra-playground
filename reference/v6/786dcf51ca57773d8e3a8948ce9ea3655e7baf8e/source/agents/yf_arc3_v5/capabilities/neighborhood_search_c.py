"""Only request binding and packet reinjection; the existing K09 computes routes."""
from .neighborhood_search_contracts_c import (NeighborhoodSearchInputC, NeighborhoodSearchSessionC,
    NeighborhoodSearchNextInputC, NeighborhoodSearchAppendInputC, NeighborhoodSearchAcceptInputC,
    NeighborhoodSearchResponseInputC)
from .neighborhood_pattern_construction import NeighborhoodState
from .mechanical_common_contracts_c import SearchStateC, CommonSignatureFactsC, CommonNativeResponseInputC
from .mechanical_common_projection_c import empty_search_result, assemble_common_native_response
from .mechanical_search_c import search_complete_step_domain, full_search_state_key
from .mechanical_transport_c import packet_payload, normalized_return_payload
from .mechanical_family_contracts_d import d_map
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _goal_descriptor(provider):
    model = provider.native_request.models[0] if len(provider.native_request.models) == 1 else None
    if model is None:
        return None
    return FrozenMap({"reference": d_map(model.reference) if model.reference is not None else None,
        "sites": tuple(d_map(site) for site in model.sites), "site_quantifier_ref": model.site_quantifier_ref,
        "terminal_order_ref": model.terminal_order_ref})


def _session_facts(request, result, count):
    query = request.query
    ids = tuple(primitive.primitive_ref for primitive in request.primitives)
    models = tuple(provider.model_ref for provider in request.providers)
    goals = query.request.immutable_inputs.get("native_goal_contracts")
    goal_equal = (isinstance(goals, FrozenMap)
        and query.request.immutable_inputs.get("source_goal_contract_ref") == request.source_goal_contract_ref
        and query.request.immutable_inputs.get("packet_acceptance_contract_ref") == request.source_goal_contract_ref
        and all(provider.model_ref in goals and goals[provider.model_ref] == _goal_descriptor(provider)
            and _goal_descriptor(provider) is not None for provider in request.providers))
    return FrozenMap({"operation_ref": query.request.operation_ref, "kernel_ref": query.request.kernel_ref,
        "mode": query.request.mode, "expected_return_type": query.request.expected_return_type,
        "primitive_domain_exact": ids == query.action_refs and len(set(ids)) == len(ids),
        "provider_domain_exact": set(models) == set(query.retained_model_refs) and len(set(models)) == len(models),
        "single_route_model": len(models) == 1 and len(query.initial_states) == 1
            and query.initial_states[0].model_ref == models[0],
        "provider_parent_exact": all(provider.parent_request == query.request for provider in request.providers),
        "source_goal_contract_exact": goal_equal, "deterministic_response_bound": query.deterministic_response_ref is not None,
        "initial_predicates_external": not query.acceptance_predicates and not query.terminal_predicates,
        "pending_steps_present": bool(result.requested_steps),
        "step_budget_remaining": count < query.request.actual_bounds.get("max_candidates", 0)})


def initialize_neighborhood_search(value: NeighborhoodSearchInputC) -> NeighborhoodSearchSessionC:
    result = empty_search_result(value.query).model_copy(update={"missing_refs": ("unmeasured_native_route",),
        "facts": FrozenMap({"measurement_not_started": True})})
    return NeighborhoodSearchSessionC(request=value, result=result, actual_step_call_count=0,
        pending_steps_present=False, step_budget_remaining=value.query.request.actual_bounds.get("max_candidates", 0) > 0,
        facts=_session_facts(value, result, 0))


def recalculate_neighborhood_search(value: NeighborhoodSearchSessionC) -> NeighborhoodSearchSessionC:
    result = search_complete_step_domain(value.request.query)
    return value.model_copy(update={"result": result, "pending_steps_present": bool(result.requested_steps),
        "facts": _session_facts(value.request, result, value.actual_step_call_count)})


def license_neighborhood_goal_contract(value: NeighborhoodSearchSessionC) -> NeighborhoodSearchSessionC:
    query = value.request.query.model_copy(update={
        "packet_acceptance_contract_ref": value.request.source_goal_contract_ref,
        "packet_acceptance_model_refs": tuple(provider.model_ref for provider in value.request.providers)})
    return value.model_copy(update={"request": value.request.model_copy(update={"query": query})})


def bind_neighborhood_search_step(value: NeighborhoodSearchNextInputC):
    query, needed = value.session.request.query, value.needed
    provider = next(item for item in value.session.request.providers if item.model_ref == needed["model_ref"])
    primitive = next(item for item in value.session.request.primitives if item.primitive_ref == needed["action_ref"])
    child = "mechanical.neighborhood_step."+stable_digest((query.request, needed, d_map(primitive.native_primitive)))
    scope = provider.native_request.scope.model_copy(update={"request_ref": child,
        "caller_ref": query.request.caller_ref, "parent_contribution_ref": query.request.parent_contribution_ref,
        "epoch": query.request.epoch, "evidence_revision_ref": query.request.input_revision_ref})
    native = provider.native_request.model_copy(update={"scope": scope,
        "state": NeighborhoodState.model_validate(needed["state"]), "primitive": primitive.native_primitive})
    identity = provider.request.model_copy(update={"request_ref": child,
        "caller_ref": query.request.caller_ref, "parent_contribution_ref": query.request.parent_contribution_ref,
        "epoch": query.request.epoch, "input_revision_ref": query.request.input_revision_ref,
        "immutable_inputs": FrozenMap.overlay({"state": needed["state"], "native_primitive": d_map(primitive.native_primitive),
            "action_ref": primitive.action_ref}, provider.request.immutable_inputs)})
    phases = tuple(binding.model_copy(update={
        "occurrence_ref": binding.occurrence_ref+"."+stable_digest(child),
        "snapshot_ref": binding.snapshot_ref+"."+stable_digest(child)}) for binding in provider.phases)
    return provider.model_copy(update={"request": identity, "parent_request": query.request,
        "native_request": native, "action_ref": primitive.action_ref, "primitive_ref": primitive.primitive_ref,
        "response_ref": query.deterministic_response_ref, "cost": primitive.cost, "phases": phases})


def measure_neighborhood_goal_acceptance(value: NeighborhoodSearchAcceptInputC) -> CommonSignatureFactsC:
    packet = value.dispatched.packet
    return CommonSignatureFactsC(facts=FrozenMap({"source_goal_contract_exact": value.session.facts["source_goal_contract_exact"],
        "complete_native_acceptance": packet is not None and packet.complete and packet.acceptance,
        "complete_native_return": value.dispatched.normalized.status == "FOUND",
        "accepted_state_terminal": packet is not None and packet.terminal}))


def append_neighborhood_search_step(value: NeighborhoodSearchAppendInputC) -> NeighborhoodSearchSessionC:
    session = value.session
    count = session.actual_step_call_count+1
    packet = value.dispatched.packet
    query = session.request.query
    if packet is not None:
        # Source licenses the native acceptance flag under the fixed parent
        # contract. The declared goal/terminal input sets remain unchanged.
        packet = packet.model_copy(update={"source_goal_acceptance_contract_ref":
            query.packet_acceptance_contract_ref if value.source_accept_goal else None})
        query = query.model_copy(update={"packets": (*query.packets, packet),
            "route_checkpoint": session.result.route_checkpoint})
    request = session.request.model_copy(update={"query": query})
    return session.model_copy(update={"request": request, "actual_step_call_count": count,
        "last_return": value.dispatched.normalized, "pending_steps_present": False,
        "step_budget_remaining": count < query.request.actual_bounds.get("max_candidates", 0),
        "facts": _session_facts(request, session.result, count)})


def measure_neighborhood_domain_closure(value: NeighborhoodSearchSessionC) -> CommonSignatureFactsC:
    result = value.result
    return CommonSignatureFactsC(facts=FrozenMap({
        "metadata_only_missing": set(result.missing_refs).issubset({"named_finite_domain_size", "declared_domain_not_closed"}),
        "pending_steps_absent": not result.requested_steps, "computation_unbounded": not result.bounded,
        "model_consistent": not result.contradictory,
        "deterministic_response_bound": value.request.query.deterministic_response_ref is not None}))


def seal_neighborhood_domain(value: NeighborhoodSearchSessionC) -> NeighborhoodSearchSessionC:
    query, result = value.request.query, value.result
    domains = {}
    for packet in query.packets:
        key = full_search_state_key(SearchStateC(state=packet.before, model_ref=packet.model_ref))
        primitive = packet.primitive_ref if packet.primitive_ref is not None else packet.action_ref
        domains[key+"|"+primitive] = FrozenMap({"complete": True, "response_refs": (packet.response_ref,)})
    query = query.model_copy(update={"closed_domain": True, "declared_domain_size": len(domains),
        "response_domains": FrozenMap(domains), "route_checkpoint": None, "continuation": FrozenMap()})
    result = result.model_copy(update={"complete": True, "declared_domain_size": len(domains), "missing_refs": (),
        "route_checkpoint": None, "continuation": FrozenMap({"completed_domain_ref": query.request.requested_domain_ref,
            "source_goal_contract_ref": value.request.source_goal_contract_ref, "no_resume_frontier": True}),
        "current_prefix": result.witnesses[0].word if result.witnesses else (),
        "facts": FrozenMap.overlay({"complete": True, "missing_measurement": False,
            "named_domain_exhausted": not result.witnesses}, result.facts)})
    request = value.request.model_copy(update={"query": query})
    return value.model_copy(update={"request": request, "result": result,
        "facts": _session_facts(request, result, value.actual_step_call_count)})


def assemble_neighborhood_search_response(value: NeighborhoodSearchResponseInputC):
    session = value.session
    response = assemble_common_native_response(CommonNativeResponseInputC(result=session.result,
        source_status=value.source_status, returned_type="SearchResultC", missing_cause=value.missing_cause))
    return response.model_copy(update={"retained_frontier": FrozenMap.overlay({
        "actual_step_call_count": session.actual_step_call_count,
        "last_native_return": normalized_return_payload(session.last_return),
        "exact_step_packets": tuple(packet_payload(packet) for packet in session.request.query.packets)
    }, response.retained_frontier)})
