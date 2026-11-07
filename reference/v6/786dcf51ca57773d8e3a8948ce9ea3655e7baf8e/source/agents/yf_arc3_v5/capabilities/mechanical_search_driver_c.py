"""K09 work/session reducers. The registered STEP is called only from SRC."""
from .mechanical_search_driver_contracts_c import (SearchDriverInputC, SearchDriverSessionC,
    SearchNextStepInputC, SearchStepAppendInputC, SearchDriverResponseInputC)
from .mechanical_search_c import search_complete_step_domain, full_search_state_key
from .mechanical_common_contracts_c import SearchStateC
from .mechanical_step_contracts_c import ExternalStepInputC
from .mechanical_common_contracts_c import CommonNativeResponseInputC
from .mechanical_common_projection_c import assemble_common_native_response
from .mechanical_common_projection_c import empty_search_result
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_response_transport_b import request_identity
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_transport_c import packet_payload
from .rigid_edit_search_contracts_c import RigidEditSearchTemplateC
from .rigid_edit_search_transport_c import bind_rigid_search_step


def _provider_identity(provider):
    if isinstance(provider.template, RigidEditSearchTemplateC):
        return provider.template.profile.common_identity
    return request_identity(provider.template, provider.kernel_ref)


def _provider_model_ref(provider):
    if isinstance(provider.template, RigidEditSearchTemplateC):
        return provider.template.packet_contract.model_ref
    return provider.template.model_ref


def _session_facts(request, result, count):
    query = request.query
    primitive_refs = tuple(item.primitive_ref for item in request.primitives)
    provider_refs = tuple(provider.model_ref for provider in request.providers)
    provenance_equal = all(packet_context_equal(query.request,
        _provider_identity(provider), provider.model_ref)
        for provider in request.providers)
    return FrozenMap({"operation_ref": query.request.operation_ref, "kernel_ref": query.request.kernel_ref,
        "mode": query.request.mode, "expected_return_type": query.request.expected_return_type,
        "primitive_domain_equal": primitive_refs == query.action_refs,
        "primitive_refs_unique": len(set(primitive_refs)) == len(primitive_refs),
        "provider_refs_unique": len(set(provider_refs)) == len(provider_refs),
        "provider_domain_equal": set(provider_refs) == set(query.retained_model_refs),
        "provider_model_binding_equal": all(provider.model_ref == _provider_model_ref(provider)
            and provider.kernel_ref == _provider_identity(provider).kernel_ref
            for provider in request.providers),
        "provider_provenance_equal": provenance_equal,
        "deterministic_response_bound": query.deterministic_response_ref is not None,
        "pending_steps_present": bool(result.requested_steps),
        "step_budget_remaining": count < query.request.actual_bounds.get("max_candidates", 0),
        "result_contradictory": result.contradictory, "result_bounded": result.bounded,
        "actual_step_call_count": count})


def initialize_search_driver(value: SearchDriverInputC) -> SearchDriverSessionC:
    result = empty_search_result(value.query).model_copy(update={
        "missing_refs": ("unmeasured_search",), "facts": FrozenMap({"measurement_not_started": True})})
    return SearchDriverSessionC(request=value, result=result, actual_step_call_count=0,
        pending_steps_present=bool(result.requested_steps),
        step_budget_remaining=value.query.request.actual_bounds.get("max_candidates", 0) > 0,
        facts=_session_facts(value, result, 0))


def prepare_requested_search_step(value: SearchNextStepInputC) -> ExternalStepInputC:
    session, needed = value.session, value.needed
    query = session.request.query
    primitive = next(item for item in session.request.primitives if item.primitive_ref == needed["action_ref"])
    provider = next(item for item in session.request.providers if item.model_ref == needed["model_ref"])
    child_ref = "mechanical.search_step." + stable_digest((query.request, needed, primitive.data))
    template = provider.template
    if isinstance(template, RigidEditSearchTemplateC):
        return bind_rigid_search_step(template, child_ref=child_ref, state=needed['state'],
            primitive=primitive, parent=query.request, response_ref=query.deterministic_response_ref)
    bound = template.model_copy(update={"request_ref": child_ref, "state": needed["state"],
        "data": FrozenMap.overlay({"action_ref": primitive.action_ref},
            FrozenMap.overlay(primitive.data, template.data))})
    identity = request_identity(bound, provider.kernel_ref)
    return ExternalStepInputC(request=identity, parent_request=query.request,
        provider_request=bound, response_ref=query.deterministic_response_ref,
        primitive_ref=primitive.primitive_ref, cost=primitive.cost)


def append_search_step(value: SearchStepAppendInputC) -> SearchDriverSessionC:
    session = value.session
    query = session.request.query
    count = session.actual_step_call_count+1
    packet = value.dispatched.packet
    if packet is None:
        return session.model_copy(update={"actual_step_call_count": count,
            "failed_return": value.dispatched.normalized.status,
            "pending_steps_present": False,
            "facts": FrozenMap.overlay({"pending_steps_present": False,
                "actual_step_call_count": count}, session.facts)})
    packets = (*query.packets, packet)
    updated = query.model_copy(update={"packets": packets, "route_checkpoint": session.result.route_checkpoint,
        "continuation": session.result.continuation})
    request = session.request.model_copy(update={"query": updated})
    return session.model_copy(update={"request": request, "actual_step_call_count": count,
        "step_budget_remaining": count < query.request.actual_bounds.get("max_candidates", 0),
        "failed_return": None, "facts": FrozenMap.overlay({"step_budget_remaining":
            count < query.request.actual_bounds.get("max_candidates", 0)}, session.facts)})


def recalculate_search_frontier(value: SearchDriverSessionC) -> SearchDriverSessionC:
    result = search_complete_step_domain(value.request.query)
    return value.model_copy(update={"result": result,
        "pending_steps_present": bool(result.requested_steps),
        "facts": _session_facts(value.request, result, value.actual_step_call_count)})


def measure_search_closure_candidate(value: SearchDriverSessionC):
    from .mechanical_common_contracts_c import CommonSignatureFactsC
    metadata_refs = {"named_finite_domain_size", "declared_domain_not_closed"}
    return CommonSignatureFactsC(facts=FrozenMap({
        "metadata_only_missing": set(value.result.missing_refs).issubset(metadata_refs),
        "pending_steps_absent": not value.result.requested_steps,
        "computation_unbounded": not value.result.bounded,
        "model_consistent": not value.result.contradictory,
        "deterministic_response_bound": value.request.query.deterministic_response_ref is not None,
        "first_shortest_witness_settled": value.result.facts.get('first_shortest_witness_settled') is True,
        "single_witness_present": len(value.result.witnesses) == 1,
        "source_first_shortest_bound": value.request.query.route_witness_policy_ref == 'FIRST_SHORTEST',
        "uniform_unit_primitive_costs": all(p.cost == 1 for p in value.request.primitives)}))


def seal_source_qualified_first_shortest(value: SearchDriverSessionC) -> SearchDriverSessionC:
    """Source-selected witness certificate; never close the unexplored domain."""
    query, result = value.request.query, value.result
    if (query.route_witness_policy_ref != 'FIRST_SHORTEST'
            or result.facts.get('first_shortest_witness_settled') is not True
            or query.request != result.request or result.bounded or result.contradictory
            or result.requested_steps or len(result.witnesses) != 1
            or not all(p.cost == 1 for p in value.request.primitives)
            or set(result.missing_refs) - {'named_finite_domain_size','declared_domain_not_closed'}):
        raise ValueError('Source first-shortest certificate requires the exact settled witness')
    continuation = FrozenMap.overlay({'route_checkpoint':None,'unexpanded_state_refs':(),
        'pending_steps':(), 'unexamined_higher_cost_state_count':len(result.continuation.get('unexpanded_state_refs',()))},
        result.continuation)
    updated = result.model_copy(update={'complete':True,'missing_refs':(),
        'current_prefix':result.witnesses[0].word,'route_checkpoint':None,'continuation':continuation,
        'facts':FrozenMap.overlay({'complete':True,'missing_measurement':False,
            'named_domain_exhausted':False,'first_shortest_certificate_only':True},result.facts)})
    return value.model_copy(update={'result':updated,'facts':_session_facts(value.request,updated,value.actual_step_call_count)})


def seal_source_qualified_reachable_domain(value: SearchDriverSessionC) -> SearchDriverSessionC:
    query, result = value.request.query, value.result
    # SRC licenses this reducer only after all requested reachable successors
    # and goal/preservation predicates are complete, without hitting a bound.
    domains = {}
    for packet in query.packets:
        key = full_search_state_key(SearchStateC(state=packet.before, model_ref=packet.model_ref))
        primitive = packet.primitive_ref if packet.primitive_ref is not None else packet.action_ref
        domains[key+"|"+primitive] = FrozenMap({"complete": True, "response_refs": (packet.response_ref,)})
    size = len(domains)
    updated_query = query.model_copy(update={"closed_domain": True, "declared_domain_size": size,
        "response_domains": FrozenMap(domains)})
    updated_result = result.model_copy(update={"complete": True, "declared_domain_size": size,
        "missing_refs": (), "current_prefix": result.witnesses[0].word if result.witnesses else (),
        "facts": FrozenMap.overlay({"complete": True, "missing_measurement": False,
            "named_domain_exhausted": not result.witnesses}, result.facts)})
    request = value.request.model_copy(update={"query": updated_query})
    return value.model_copy(update={"request": request, "result": updated_result,
        "facts": _session_facts(request, updated_result, value.actual_step_call_count)})


def assemble_search_driver_response(value: SearchDriverResponseInputC):
    response = assemble_common_native_response(CommonNativeResponseInputC(result=value.session.result,
        source_status=value.source_status, returned_type="SearchResultC", missing_cause=value.missing_cause))
    return response.model_copy(update={"retained_frontier": FrozenMap.overlay({
        "actual_step_call_count": value.session.actual_step_call_count,
        "failed_return": value.session.failed_return,
        "pure_rigid_kernel_call_count": value.session.pure_rigid_kernel_call_count,
        "pure_rigid_native_node_count": value.session.pure_rigid_native_node_count,
        "pure_rigid_batch_count": value.session.pure_rigid_batch_count,
        "rigid_batch_frontier": value.session.rigid_batch_frontier,
        "exact_step_packets": tuple(packet_payload(packet) for packet in value.session.request.query.packets)
    }, response.retained_frontier)})
