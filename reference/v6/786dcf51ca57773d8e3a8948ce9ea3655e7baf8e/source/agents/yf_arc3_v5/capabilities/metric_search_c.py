"""Only request binding and packet reinjection; the existing K09 computes routes."""
from .metric_search_contracts_c import (MetricSearchInputC, MetricSearchSessionC,
    MetricSearchNextInputC, MetricSearchAppendInputC, MetricSearchAcceptInputC,
    MetricSearchResponseInputC)
from .metric_stack_contracts import MetricStackState
from .metric_step_c import metric_model_payload_c, metric_goal_descriptor_c
from .mechanical_common_contracts_c import SearchStateC, CommonSignatureFactsC, CommonNativeResponseInputC
from .mechanical_common_projection_c import empty_search_result, assemble_common_native_response
from .mechanical_search_c import search_complete_step_domain, full_search_state_key, search_context_digest
from .mechanical_transport_c import packet_payload, normalized_return_payload
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _goal_descriptor(provider):
    return metric_goal_descriptor_c(provider.native_request)


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
        "native_provider_inputs_present": all(provider.native_request.external_ownership is not None
            and provider.native_request.state is not None and provider.native_request.law is not None
            and provider.native_request.target is not None for provider in request.providers),
        "primitive_payload_refs_exact": all(primitive.primitive_ref == primitive.native_primitive.primitive_ref
            and (primitive.occurrence_binding == "EXACT"
                or (primitive.occurrence_binding == "CURRENT_CELL_TOP" and primitive.native_primitive.kind == "SELECT"
                    and primitive.native_primitive.occurrence_ref is None)
                or (primitive.occurrence_binding == "CURRENT_SELECTED_TOP" and primitive.native_primitive.kind == "TRANSFER"
                    and primitive.native_primitive.occurrence_ref is None)) for primitive in request.primitives),
        "initial_joint_state_qualified": all(isinstance(state.state.get("state"), FrozenMap)
            and set(state.state) == {"state", "budget_remaining", "termination"}
            and type(state.state.get("budget_remaining")) is int and state.state["budget_remaining"] >= 0
            and "termination" in state.state and state.state["termination"] is None for state in query.initial_states),
        "source_goal_contract_exact": goal_equal, "deterministic_response_bound": query.deterministic_response_ref is not None,
        "initial_predicates_external": not query.acceptance_predicates and not query.terminal_predicates,
        "resume_qualified": query.continuation.get("invalid_schedule_resume") is not True
            and (not query.continuation or query.continuation.get("context_digest") == search_context_digest(query))
            and (query.route_checkpoint is None or query.route_checkpoint.context_digest == search_context_digest(query)),
        "pending_steps_present": bool(result.requested_steps),
        "step_budget_remaining": count < query.request.actual_bounds.get("max_candidates", 0)})


def initialize_metric_search(value: MetricSearchInputC) -> MetricSearchSessionC:
    result = empty_search_result(value.query).model_copy(update={"missing_refs": ("unmeasured_native_route",),
        "facts": FrozenMap({"measurement_not_started": True})})
    return MetricSearchSessionC(request=value, result=result, actual_step_call_count=value.prior_step_call_count,
        pending_steps_present=False, step_budget_remaining=value.prior_step_call_count < value.query.request.actual_bounds.get("max_candidates", 0),
        facts=_session_facts(value, result, value.prior_step_call_count))


def recalculate_metric_search(value: MetricSearchSessionC) -> MetricSearchSessionC:
    result = search_complete_step_domain(value.request.query)
    return value.model_copy(update={"result": result, "pending_steps_present": bool(result.requested_steps),
        "facts": _session_facts(value.request, result, value.actual_step_call_count)})


def license_metric_goal_contract(value: MetricSearchSessionC) -> MetricSearchSessionC:
    query = value.request.query.model_copy(update={
        "packet_acceptance_contract_ref": value.request.source_goal_contract_ref,
        "packet_acceptance_model_refs": tuple(provider.model_ref for provider in value.request.providers)})
    return value.model_copy(update={"request": value.request.model_copy(update={"query": query})})


def bind_metric_search_step(value: MetricSearchNextInputC):
    query, needed = value.session.request.query, value.needed
    provider = next(item for item in value.session.request.providers if item.model_ref == needed["model_ref"])
    primitive = next(item for item in value.session.request.primitives if item.primitive_ref == needed["action_ref"])
    full_state = needed["state"]
    state = MetricStackState.model_validate(full_state["state"])
    native_primitive = primitive.native_primitive
    # These binding operators are part of the Source-licensed action schema.
    # No object is chosen by rank: a cell has exactly one current top, and the
    # state's physical selection is retained independently of its rendering.
    if primitive.occurrence_binding == "CURRENT_CELL_TOP":
        stack = next((stack for cell, stack in zip(state.cells, state.stacks)
            if cell.cell_ref == native_primitive.cell_ref), ())
        native_primitive = native_primitive.model_copy(update={"occurrence_ref": stack[-1].occurrence_ref if stack else None})
    elif primitive.occurrence_binding == "CURRENT_SELECTED_TOP":
        native_primitive = native_primitive.model_copy(update={"occurrence_ref": state.physical_selection_ref})
    child = "mechanical.metric_step."+stable_digest((query.request, needed, metric_model_payload_c(native_primitive)))
    ownership = provider.native_request.external_ownership.model_copy(update={
        "primitive_ref": native_primitive.primitive_ref,
        "charged_cost": primitive.cost, "budget_remaining": full_state["budget_remaining"],
        "pre_terminal": full_state["termination"] is not None})
    identity = provider.request.model_copy(update={"request_ref": child,
        "caller_ref": query.request.caller_ref, "parent_contribution_ref": query.request.parent_contribution_ref,
        "epoch": query.request.epoch, "input_revision_ref": query.request.input_revision_ref,
        "immutable_inputs": FrozenMap.overlay({"state": full_state,
            "native_primitive": metric_model_payload_c(native_primitive),
            "native_external_ownership": metric_model_payload_c(ownership),
            "action_ref": primitive.action_ref}, provider.request.immutable_inputs)})
    native = provider.native_request.model_copy(update={"identity": identity,
        "evidence_revision_ref": query.request.input_revision_ref,
        "state": state, "primitive": native_primitive,
        "external_ownership": ownership, "resume_frontier": FrozenMap()})
    phases = tuple(binding.model_copy(update={
        "occurrence_ref": binding.occurrence_ref+"."+stable_digest(child),
        "snapshot_ref": binding.snapshot_ref+"."+stable_digest(child)}) for binding in provider.phases)
    return provider.model_copy(update={"request": identity, "parent_request": query.request,
        "native_request": native, "action_ref": primitive.action_ref, "primitive_ref": primitive.primitive_ref,
        "response_ref": query.deterministic_response_ref, "phases": phases})


def measure_metric_goal_acceptance(value: MetricSearchAcceptInputC) -> CommonSignatureFactsC:
    packet = value.dispatched.packet
    return CommonSignatureFactsC(facts=FrozenMap({"source_goal_contract_exact": value.session.facts["source_goal_contract_exact"],
        "complete_native_acceptance": packet is not None and packet.complete and packet.acceptance,
        "complete_native_return": value.dispatched.normalized.status == "FOUND",
        "accepted_state_terminal": packet is not None and packet.terminal}))


def append_metric_search_step(value: MetricSearchAppendInputC) -> MetricSearchSessionC:
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


def measure_metric_domain_closure(value: MetricSearchSessionC) -> CommonSignatureFactsC:
    result = value.result
    return CommonSignatureFactsC(facts=FrozenMap({
        "metadata_only_missing": set(result.missing_refs).issubset({"named_finite_domain_size", "declared_domain_not_closed"}),
        "pending_steps_absent": not result.requested_steps, "computation_unbounded": not result.bounded,
        "model_consistent": not result.contradictory,
        "deterministic_response_bound": value.request.query.deterministic_response_ref is not None}))


def seal_metric_domain(value: MetricSearchSessionC) -> MetricSearchSessionC:
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


def assemble_metric_search_response(value: MetricSearchResponseInputC):
    session = value.session
    response = assemble_common_native_response(CommonNativeResponseInputC(result=session.result,
        source_status=value.source_status, returned_type="SearchResultC", missing_cause=value.missing_cause))
    return response.model_copy(update={"retained_frontier": FrozenMap.overlay({
        "actual_step_call_count": session.actual_step_call_count,
        "last_native_return": normalized_return_payload(session.last_return),
        "exact_step_packets": tuple(packet_payload(packet) for packet in session.request.query.packets)
    }, response.retained_frontier)})
