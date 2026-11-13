"""Prepare the finite action domain and project already-calculated transport witnesses."""
from .metric_stack_contracts import MetricStackRequest, MetricStackCalculation, StackPrimitive
from .metric_schedule_contracts_c import MetricScheduleAssemblyInputC
from .metric_search_contracts_c import MetricSearchInputC, MetricSearchPrimitiveC
from .metric_step_contracts_c import MetricStepInputC, MetricPhaseBindingC
from .metric_step_c import (metric_model_payload_c, metric_current_state_c,
    metric_goal_descriptor_c, metric_model_descriptor_c)
from .metric_stack_image import metric_packet_fingerprint
from .mechanical_common_contracts_c import SearchDomainInputC, SearchStateC, RouteCheckpointC, ExternalPrimitivePacketC
from .mechanical_transport_c import request_identity_payload, normalized_return_payload
from .mechanical_search_c import search_context_digest
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _query_identity(request):
    scope = request.schedule_scope
    return scope.search_identity.model_copy(update={"immutable_inputs": FrozenMap.overlay({
        "native_goal_contracts": FrozenMap({scope.model_ref: metric_goal_descriptor_c(request)}),
        "source_goal_contract_ref": scope.goal_contract_ref,
        "packet_acceptance_contract_ref": scope.goal_contract_ref,
        "metric_schedule_domain": FrozenMap({"execution_scope_ref": request.execution_scope_ref,
            "kinds": request.execution_primitive_kinds,
            "allowed_destinations": request.schedule_allowed_destination_refs,
            "restriction_evidence_ref": request.schedule_restriction_evidence_ref})}, scope.search_identity.immutable_inputs)})


def metric_schedule_resume_is_qualified(request: MetricStackRequest) -> bool:
    retained = request.resume_frontier
    if not retained:
        return True
    if request.schedule_scope is None or retained.get("packet_fingerprint") != metric_packet_fingerprint(request):
        return False
    expected = _query_identity(request)
    measured = retained.get("k09_measurement")
    payloads = retained.get("exact_step_packets")
    count = retained.get("actual_step_call_count")
    if (not isinstance(measured, FrozenMap) or measured.get("request") != request_identity_payload(expected)
            or not isinstance(payloads, tuple) or type(count) is not int
            or not 0 <= count <= expected.actual_bounds.get("max_candidates", 0)):
        return False
    continuation = measured.get("continuation")
    checkpoint = measured.get("route_checkpoint")
    if not isinstance(continuation, FrozenMap):
        return False
    if checkpoint is None or not isinstance(continuation.get("context_digest"), str):
        return False
    try:
        packets = tuple(ExternalPrimitivePacketC.model_validate(packet) for packet in payloads)
        if any(packet.parent_request != expected or packet.model_ref != request.schedule_scope.model_ref for packet in packets):
            return False
        if count < len(packets):
            return False
        if checkpoint is not None:
            decoded = RouteCheckpointC.model_validate(checkpoint)
            if decoded.context_digest != continuation.get("context_digest"):
                return False
            digests = {packet.request.request_ref: stable_digest(packet) for packet in packets}
            if any(ref not in digests or decoded.packet_digests[ref] != digests[ref] for ref in sorted(decoded.packet_digests)):
                return False
        prepared = prepare_metric_transport_domain(request)
        if continuation["context_digest"] != search_context_digest(prepared.query):
            return False
    except (ValueError, TypeError, KeyError, AttributeError):
        return False
    return True


def prepare_metric_transport_domain(request: MetricStackRequest) -> MetricSearchInputC:
    scope, law = request.schedule_scope, request.law
    query_identity = _query_identity(request)
    primitives = []
    cells = tuple(sorted(request.state.cells, key=lambda cell: cell.cell_ref))
    kinds = request.execution_primitive_kinds
    if "SELECT" in kinds:
        for cell in cells:
            ref = "metric.select_top."+cell.cell_ref
            primitives.append(MetricSearchPrimitiveC(primitive_ref=ref, action_ref=ref,
                native_primitive=StackPrimitive(primitive_ref=ref, kind="SELECT", cell_ref=cell.cell_ref),
                cost=law.select_cost, occurrence_binding="CURRENT_CELL_TOP"))
    if "CYCLE" in kinds:
        ref = "metric.cycle_selected_top"
        primitives.append(MetricSearchPrimitiveC(primitive_ref=ref, action_ref=ref,
            native_primitive=StackPrimitive(primitive_ref=ref, kind="CYCLE"), cost=law.cycle_cost))
    if "TRANSFER" in kinds:
        destinations = set(request.schedule_allowed_destination_refs) if request.schedule_allowed_destination_refs is not None else {
            cell.cell_ref for cell in cells}
        for cell in cells:
            if cell.cell_ref not in destinations:
                continue
            ref = "metric.transfer_selected_top."+cell.cell_ref
            primitives.append(MetricSearchPrimitiveC(primitive_ref=ref, action_ref=ref,
                native_primitive=StackPrimitive(primitive_ref=ref, kind="TRANSFER", destination_ref=cell.cell_ref),
                cost=law.transfer_cost, occurrence_binding="CURRENT_SELECTED_TOP"))
    if "RESET" in kinds:
        ref = "metric.independent_reset"
        primitives.append(MetricSearchPrimitiveC(primitive_ref=ref, action_ref=ref,
            native_primitive=StackPrimitive(primitive_ref=ref, kind="RESET"), cost=request.external_ownership.charged_cost))
    placeholder = primitives[0].native_primitive if primitives else StackPrimitive(primitive_ref="metric.empty_domain", kind="CYCLE")
    ownership = request.external_ownership.model_copy(update={"primitive_ref": placeholder.primitive_ref})
    native = request.model_copy(update={"identity": scope.child_identity,
        "primitive": placeholder, "external_ownership": ownership, "schedule_scope": None,
        "resume_frontier": FrozenMap()})
    state = metric_current_state_c(native)
    model_digest = stable_digest(metric_model_descriptor_c(native))
    child_identity = scope.child_identity.model_copy(update={"immutable_inputs": FrozenMap.overlay({
        "state": state, "source_parent_goal_ref": scope.parent_goal_ref,
        "native_model_digest": model_digest, "native_bounds": scope.child_identity.actual_bounds,
        "native_primitive": metric_model_payload_c(placeholder),
        "native_external_ownership": metric_model_payload_c(ownership),
        "action_ref": placeholder.primitive_ref}, scope.child_identity.immutable_inputs)})
    native = native.model_copy(update={"identity": child_identity})
    provider = MetricStepInputC(request=child_identity, parent_request=query_identity, native_request=native,
        source_parent_goal_ref=scope.parent_goal_ref, source_identity_contract_ref=scope.identity_contract_ref,
        source_phase_clock_contract_ref=scope.phase_clock_contract_ref, model_ref=scope.model_ref,
        native_model_digest=model_digest, action_ref=placeholder.primitive_ref, primitive_ref=placeholder.primitive_ref,
        response_ref=scope.response_ref, closure_domain_ref=scope.closure_domain_ref,
        closure_stop_ref=scope.closure_stop_ref, model_interruption_ref=scope.model_interruption_ref,
        phases=tuple(MetricPhaseBindingC.model_validate(metric_model_payload_c(phase)) for phase in scope.phases))
    packets, checkpoint, continuation, prior_count = (), None, FrozenMap(), 0
    retained = request.resume_frontier
    if retained:
        if retained.get("packet_fingerprint") != metric_packet_fingerprint(request):
            # SRC owns the resulting contradiction; no retained state is applied.
            continuation = FrozenMap({"invalid_schedule_resume": True})
        else:
            previous = retained.get("k09_measurement")
            payloads = retained.get("exact_step_packets", ())
            if isinstance(previous, FrozenMap) and previous.get("request") == request_identity_payload(query_identity):
                try:
                    packets = tuple(ExternalPrimitivePacketC.model_validate(packet) for packet in payloads)
                    checkpoint_payload = previous.get("route_checkpoint")
                    checkpoint = RouteCheckpointC.model_validate(checkpoint_payload) if checkpoint_payload is not None else None
                    continuation = previous.get("continuation", FrozenMap())
                    prior_count = retained.get("actual_step_call_count", 0)
                    if type(prior_count) is not int or not 0 <= prior_count <= query_identity.actual_bounds["max_candidates"]:
                        raise ValueError("invalid cumulative STEP count")
                except (ValueError, TypeError, KeyError):
                    packets, checkpoint, prior_count = (), None, 0
                    continuation = FrozenMap({"invalid_schedule_resume": True})
            else:
                continuation = FrozenMap({"invalid_schedule_resume": True})
    query = SearchDomainInputC(request=query_identity, initial_states=(SearchStateC(state=state, model_ref=scope.model_ref),),
        retained_model_refs=(scope.model_ref,), action_refs=tuple(primitive.primitive_ref for primitive in primitives),
        packets=packets, closed_domain=False, deterministic_response_ref=scope.response_ref,
        packet_acceptance_contract_ref=scope.goal_contract_ref, packet_acceptance_model_refs=(scope.model_ref,),
        continuation=continuation, route_checkpoint=checkpoint)
    return MetricSearchInputC(query=query, primitives=tuple(primitives), providers=(provider,),
        source_goal_contract_ref=scope.goal_contract_ref, prior_step_call_count=prior_count)


def _packet_semantics(packet):
    return (packet.get("after"), packet.get("cost"), packet.get("terminal"), packet.get("acceptance"),
        packet.get("source_goal_acceptance_contract_ref"),
        packet.get("request", FrozenMap()).get("immutable_inputs", FrozenMap()).get("native_primitive"))


def assemble_metric_transport_schedules(value: MetricScheduleAssemblyInputC) -> MetricStackCalculation:
    request, returned = value.request, value.search_return
    scope = request.schedule_scope
    expected_query = _query_identity(request)
    measurement = returned.descriptive_values.get("measurement")
    payloads = returned.retained_frontier.get("exact_step_packets", ())
    missing = []
    exact = returned.request == expected_query
    if not exact:
        missing.append("foreign_schedule_search_return")
    if not isinstance(measurement, FrozenMap) or measurement.get("request") != request_identity_payload(expected_query):
        missing.append("missing_exact_k09_measurement")
        measurement = FrozenMap()
    if not isinstance(payloads, tuple) or not all(isinstance(packet, FrozenMap) for packet in payloads):
        missing.append("missing_native_step_packets")
        payloads = ()
    packet_index = {}
    for packet in payloads:
        key = (stable_digest(packet.get("before")), packet.get("primitive_ref"))
        packet_index.setdefault(key, []).append(packet)
    schedules = []
    projection_visits = 0
    limit = request.identity.actual_bounds["nodes"]
    bounded_projection = False
    for witness in measurement.get("witnesses", ()):
        if len(schedules) >= min(3, request.identity.actual_bounds["outputs"]):
            bounded_projection = True
            break
        if not isinstance(witness, FrozenMap) or not isinstance(witness.get("word"), tuple):
            missing.append("invalid_k09_witness")
            continue
        current = metric_current_state_c(request)
        expansion, moves, trace_refs, cost, valid, final_packet = [], [], [], 0, True, None
        for ref in witness["word"]:
            if projection_visits >= limit:
                bounded_projection, valid = True, False
                break
            projection_visits += 1
            candidates = packet_index.get((stable_digest(current), ref), ())
            if not candidates or not all(_packet_semantics(packet) == _packet_semantics(candidates[0]) for packet in candidates):
                missing.append("missing_or_conflicting_witness_edge")
                valid = False
                break
            packet = candidates[0]
            if (packet.get("complete") is not True or packet.get("model_ref") != scope.model_ref
                    or packet.get("parent_request") != request_identity_payload(expected_query)):
                missing.append("unqualified_witness_packet")
                valid = False
                break
            primitive = packet["request"]["immutable_inputs"].get("native_primitive")
            if not isinstance(primitive, FrozenMap):
                missing.append("missing_bound_native_primitive")
                valid = False
                break
            expansion.append(primitive)
            cost += packet["cost"]
            trace_refs.append(tuple(candidate["request"]["request_ref"] for candidate in candidates))
            for event in packet.get("events", ()):
                predicates = event.get("predicate_values", FrozenMap())
                if predicates.get("phase") == "DIRECT":
                    moves.append(FrozenMap({"primitive_index": len(expansion)-1,
                        "effects": predicates.get("effects", ()), "refusal": predicates.get("refusal")}))
            current = packet["after"]
            final_packet = packet
            if packet.get("terminal") is True and len(expansion) != len(witness["word"]):
                missing.append("witness_crosses_early_terminal_boundary")
                valid = False
                break
        accepted_for_parent = (final_packet is not None and final_packet.get("terminal") is True
            and final_packet.get("acceptance") is True
            and final_packet.get("source_goal_acceptance_contract_ref") == scope.goal_contract_ref)
        if valid and not accepted_for_parent:
            missing.append("witness_does_not_end_at_licensed_parent_acceptance")
            valid = False
        if valid and cost == witness.get("cost"):
            schedules.append(FrozenMap({"word": witness["word"], "primitive_expansion": tuple(expansion),
                "transport_order": tuple(moves), "cost": cost, "successor": current,
                "packet_request_refs": tuple(trace_refs), "root_action_ref": witness.get("root_action_ref")}))
        elif valid:
            missing.append("witness_cost_mismatch")
    native_missing = measurement.get("missing_refs", ())
    missing.extend(native_missing if isinstance(native_missing, tuple) else ("missing_k09_frontier",))
    contradiction = not exact or measurement.get("contradictory") is True or returned.status == "MODEL_CONTRADICTION"
    bounded = bounded_projection or measurement.get("bounded") is True or returned.status == "BUDGET_REACHED"
    unresolved = bool(missing) or returned.status in ("NEEDS_EVIDENCE", "NOT_APPLICABLE")
    complete = measurement.get("complete") is True and not contradiction and not bounded and not unresolved
    retained = FrozenMap({"packet_fingerprint": metric_packet_fingerprint(request), "k09_measurement": measurement,
        "exact_step_packets": payloads, "actual_step_call_count": returned.retained_frontier.get("actual_step_call_count", 0),
        "last_native_return": returned.retained_frontier.get("last_native_return"),
        "normalized_search_return": normalized_return_payload(returned)})
    return MetricStackCalculation(request_identity=request.identity,
        values=FrozenMap({"candidate_schedules": tuple(schedules), "schedules_are_root_witnesses_only": True,
            "searched_action_domain": request.execution_primitive_kinds,
            "allowed_destination_refs": request.schedule_allowed_destination_refs,
            "restricted_domain": request.schedule_allowed_destination_refs is not None,
            "domain_exhausted": complete and not schedules, "global_impossibility_proved": False,
            "actual_k09_expansions": measurement.get("continuation", FrozenMap()).get("explored_state_count"),
            "actual_k09_response_count": measurement.get("examined_count"),
            "actual_step_call_count": returned.retained_frontier.get("actual_step_call_count", 0),
            "actual_projection_visits": projection_visits,
            "retained_model_assignments": expected_query.model_assignments,
            "missing_refs": tuple(sorted(set(missing))), "official_win_attested": False}),
        facts=FrozenMap({"has_missing_observation": unresolved, "model_contradiction": contradiction,
            "bound_reached": bounded, "empty_complete_domain": complete and not schedules}),
        examined_count=measurement.get("examined_count", 0), declared_domain_size=measurement.get("declared_domain_size"),
        pending_count=0 if complete else max(1, len(measurement.get("requested_steps", ()))), retained_frontier=retained)
