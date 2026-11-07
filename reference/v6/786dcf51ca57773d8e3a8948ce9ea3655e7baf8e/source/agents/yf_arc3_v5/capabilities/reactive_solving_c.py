"""Source reasoning over K33 full-state receipts, never a second navigator."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .reactive_graph_c import graph_input_missing
from .family_agenda_projection import project_family_agenda, demand_signature
from .reactive_solving_contracts_c import ReactiveSolvingFactsC, ReactiveSolvingBindInputC, ReactiveSolvingFinishInputC, ReactiveSolvingReturnC
from .reactive_packet_c import measure_reactive_packet

def measure_reactive_solving(request, canonical_rows):
    native, why, agenda, demand = request.native_request, request.why, request.agenda, request.demand
    missing, reasons = list(graph_input_missing(native)), []
    model, initial = native.model, native.state
    if (demand.request.operation_ref != native.operation_ref or demand.request.mode != native.mode
            or demand.request.request_ref != native.scope.request_ref
            or demand.request.kernel_ref != "mechanics.reactive_graph_navigation"
            or demand.request.caller_ref != native.scope.caller_ref
            or demand.request.parent_contribution_ref != native.scope.parent_contribution_ref
            or demand.request.epoch != native.scope.epoch or demand.request.input_revision_ref != native.scope.evidence_revision_ref
            or demand.parent_goal_ref != why.parent_goal_ref or native.scope.parent_goal_ref != why.parent_goal_ref
            or demand.consumer_ref != why.consumer_ref or demand.episode_ref != why.episode_ref
            or demand.level_scope_ref != why.level_scope_ref or demand not in agenda.demands
            or demand.request.immutable_inputs.get("reactive_native_request_digest") != stable_digest(immutable_json_data(native))):
        missing.append("exact_current_reactive_parent_question")
    if demand.request.actual_bounds != FrozenMap({"maximum_evaluations": native.maximum_evaluations,
            "maximum_states": native.maximum_states, "horizon": native.horizon}):
        missing.append("exact_current_reactive_work_bounds")
    if (len(canonical_rows) != 1 or canonical_rows[0].get("family_agenda") != immutable_json_data(agenda)
            or not canonical_rows[0].get("supported_agenda_claim_refs")):
        missing.append("canonical_reactive_parent_agenda")
    rows = tuple(row for row in project_family_agenda(agenda)["rows"]
        if row["signature_ref"] == demand_signature(demand)
        and row["demand"]["request"]["request_ref"] == demand.request.request_ref)
    if (len(rows) != 1 or not rows[0]["owner_current"] or not rows[0]["current_inputs_bound"]
            or not rows[0]["prerequisites_current"] or rows[0]["conflicting_current_returns"]
            or rows[0]["consumed_current_signature"]):
        missing.append("prerequisite_satisfied_unconsumed_reactive_question")
    contract = request.terminal_contract
    if (model is None or initial is None or not contract.exit_evidence_refs
            or contract.evidence_revision_ref != native.scope.evidence_revision_ref
            or model.completion_node_refs != contract.exit_node_refs
            or model.completion_requires_guard_refs_absent != contract.required_absent_guard_refs
            or contract.required_absent_guard_refs and not contract.removal_requirement_evidence_refs
            or why.desired_future.get("reactive_exit_contract_digest") != stable_digest(contract)):
        missing.append("grounded_surviving_exit_without_implicit_all_adversaries_removal")
    if model is None or initial is None:
        return ReactiveSolvingFactsC(frozen_input=request, facts=FrozenMap({"current_reactive_question": False,
            "search_question": request.search_query is not None}), route_reasons=(), missing_refs=tuple(sorted(set(missing))))
    work = sum(len(route.joint_returns) for route in request.route_supports)
    if work > native.maximum_evaluations:
        return ReactiveSolvingFactsC(frozen_input=request, facts=FrozenMap({"current_reactive_question": False,
            "search_question": request.search_query is not None}), route_reasons=(),
            missing_refs=tuple(sorted(set((*missing, "reactive_reason_preparation_bound")))))
    links = {link.link_ref: link for link in model.links}
    for support in request.route_supports:
        if support.needed_connection_ref not in links or not support.usefulness_evidence_refs or not support.joint_returns:
            missing.append("identified_connection_and_usefulness_for_route_subgoal")
            continue
        current, changed_links, states, live_sets = initial, [], [initial], [initial.live_guard_refs]
        valid = True
        for returned in support.joint_returns:
            frozen, result = returned.frozen_request, returned.calculation
            if (frozen.operation_ref != "mechanics.reactive_graph_navigation.joint_successor" or frozen.mode != "STEP"
                    or frozen.model != model or frozen.state != current or frozen.control is None
                    or result.native.scope != frozen.scope or result.native.operation_ref != frozen.operation_ref
                    or result.native.mode != frozen.mode or not result.native.domain_complete
                    or result.native.prerequisite_refs or result.native.computation_bound_reached
                    or result.state is None or result.state.dead
                    or frozen.scope.epoch != native.scope.epoch
                    or frozen.scope.evidence_revision_ref != native.scope.evidence_revision_ref
                    or frozen.scope.model_revision_ref != native.scope.model_revision_ref):
                missing.append("complete_current_K33_joint_survival_receipt_chain")
                valid = False
                break
            if frozen.control.link_ref is None and not model.blocked_command_advances_clock and result.state.phase_tick != current.phase_tick:
                missing.append("blocked_input_cannot_invent_wait_clock")
                valid = False
                break
            changed_links.append(frozen.control.link_ref)
            current = result.state
            states.append(current)
            live_sets.append(current.live_guard_refs)
        if not valid:
            continue
        removed = tuple(ref for ref in initial.live_guard_refs if ref not in current.live_guard_refs)
        if support.purpose == "FLANK_CAPTURE" and (not removed or not set(support.affected_guard_refs).issubset(removed)):
            missing.append("actual_capture_serving_identified_connection_or_safety")
            continue
        if support.purpose == "FLANK_CAPTURE" and (support.needed_connection_ref not in changed_links
                and not support.cost_reduction_evidence_refs):
            missing.append("capture_makes_identified_connection_safe_or_reduces_supported_cost")
            continue
        if support.purpose == "LURE_AND_ESCAPE":
            baseline = support.blocking_return
            if (baseline is None or baseline.frozen_request.model != model or baseline.frozen_request.state != initial
                    or baseline.frozen_request.operation_ref != "mechanics.reactive_graph_navigation.joint_successor"
                    or baseline.frozen_request.mode != "STEP"
                    or baseline.calculation.native.scope != baseline.frozen_request.scope
                    or baseline.calculation.native.operation_ref != baseline.frozen_request.operation_ref
                    or baseline.calculation.native.mode != baseline.frozen_request.mode
                    or baseline.calculation.native.prerequisite_refs
                    or baseline.calculation.native.computation_bound_reached
                    or baseline.calculation.checkpoint is not None
                    or baseline.frozen_request.scope.epoch != native.scope.epoch
                    or baseline.frozen_request.scope.evidence_revision_ref != native.scope.evidence_revision_ref
                    or baseline.frozen_request.scope.model_revision_ref != native.scope.model_revision_ref
                    or baseline.frozen_request.control is None
                    or baseline.frozen_request.control.link_ref != support.needed_connection_ref
                    or not baseline.calculation.native.domain_complete or baseline.calculation.state is None
                    or not baseline.calculation.state.dead):
                missing.append("actual_K33_blocked_or_unsafe_indispensable_connection_before_lure")
                continue
        if support.purpose == "LURE_AND_ESCAPE" and (not support.route_extraction_evidence_refs
                or support.needed_connection_ref not in changed_links
                or not support.affected_guard_refs
                or not all(any(after.follower_ref == ref and before.follower_ref == ref
                    and after.node_ref != before.node_ref for state in states[1:]
                    for before in initial.followers for after in state.followers) for ref in support.affected_guard_refs)):
            missing.append("lure_extracts_follower_and_verified_escape_crosses_needed_connection")
            continue
        if support.purpose == "TEMPORAL_DETOUR" and (current.player_node_ref != initial.player_node_ref
                or current == initial):
            missing.append("spatial_loop_changes_actual_joint_phase_or_follower_state")
            continue
        if support.purpose == "EXIT_ROUTE" and (current.player_node_ref not in contract.exit_node_refs
                or not current.completed or any(ref in current.live_guard_refs for ref in contract.required_absent_guard_refs)):
            missing.append("verified_route_reaches_declared_surviving_exit")
            continue
        reasons.append(FrozenMap({"purpose": support.purpose, "needed_connection_ref": support.needed_connection_ref,
            "full_before_state": immutable_json_data(initial), "full_after_state": immutable_json_data(current),
            "ordered_joint_receipts": tuple(immutable_json_data(value) for value in support.joint_returns),
            "crossed_link_refs": tuple(changed_links), "removed_guard_refs": removed,
            "live_guard_sets": tuple(live_sets), "usefulness_evidence_refs": support.usefulness_evidence_refs,
            "cost_reduction_evidence_refs": support.cost_reduction_evidence_refs,
            "transit_and_front_contact_not_reduced_to_node_occupancy": True,
            "follower_history_and_activation_retained": True, "patroller_identity_and_clock_retained": True,
            "global_lure_or_capture_necessity_not_claimed": True}))
    if initial.dead and (request.recovery_control_ref is None or not request.recovery_scope_evidence_refs or not request.recovery_scope):
        missing.append("exposed_grounded_recovery_control_and_measured_reset_scope")
    query = request.search_query
    if query is not None:
        if (request.serving_k03 or not request.search_evidence_refs
                or query.request.caller_ref != native.scope.caller_ref
                or query.request.parent_contribution_ref != native.scope.parent_contribution_ref
                or query.request.epoch != native.scope.epoch or query.request.input_revision_ref != native.scope.evidence_revision_ref
                or query.request.immutable_inputs.get("reactive_exit_contract_digest") != stable_digest(contract)
                or query.request.immutable_inputs.get("parent_goal_ref") != why.parent_goal_ref
                or query.request.immutable_inputs.get("model_revision_ref") != native.scope.model_revision_ref
                or tuple(query.retained_model_refs) != native.scope.retained_alternative_refs):
            missing.append("current_parent_reactive_K09_query_without_recursive_planning")
        converted = tuple(measure_reactive_packet(receipt) for receipt in request.packet_receipts)
        if (any(value.missing_refs or value.packet is None for value in converted)
                or tuple(value.packet for value in converted) != query.packets
                or any(receipt.parent_request != query.request for receipt in request.packet_receipts)
                or query.request.immutable_inputs.get("reactive_packet_receipts_digest") != stable_digest(request.packet_receipts)
                or query.request.immutable_inputs.get("reactive_model_digest") != stable_digest(immutable_json_data(model))
                or not query.initial_states or any(state.state != immutable_json_data(initial) for state in query.initial_states)):
            missing.append("exact_complete_K33_native_packet_projection_for_search")
    return ReactiveSolvingFactsC(frozen_input=request,
        facts=FrozenMap({"current_reactive_question": not bool(missing), "search_question": query is not None}),
        route_reasons=tuple(reasons), missing_refs=tuple(sorted(set(missing))))

def bind_reactive_solving_native(value: ReactiveSolvingBindInputC):
    return value.measured.frozen_input.native_request

def bind_reactive_solving_search(value: ReactiveSolvingBindInputC):
    return value.measured.frozen_input.search_query

def finish_reactive_solving(value: ReactiveSolvingFinishInputC) -> ReactiveSolvingReturnC:
    request = value.measured.frozen_input
    recovery = FrozenMap({"exposed_control_ref": request.recovery_control_ref,
        "measured_reset_scope": request.recovery_scope, "evidence_refs": request.recovery_scope_evidence_refs,
        "failed_approach_kept_as_contextual_evidence": True, "no_required_discovery_script": True})
    return ReactiveSolvingReturnC(frozen_measurement=value.measured, native_return=value.native_return,
        search_return=value.search_return, next_item_ref=request.why.next_item_ref, recovery_facts=recovery)
