"""Bind the existing search question to the unchanged articulated parent goal."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .articulated_solving_contracts_c import ArticulatedRouteParentFactsC
from .articulated_route_goal_c import derive_articulated_route_terminal_states
from .articulated_indirect_domain_c import derive_articulated_indirect_domains
from .articulated_session_edges_c import project_articulated_session_edges
from .articulated_route_restoration_c import measure_articulated_route_restoration


def measure_articulated_route_parent(value,require_measured_indirect_edges=True):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    route,edge_missing=project_articulated_session_edges(returned)
    missing=list(edge_missing)
    goal_work=0
    indirect_rows=()
    if route is not None:
        query,why,native=route.query,request.why,request.native_request
        if (returned.missing_refs or native.state is None or native.model is None
                or query.request.caller_ref!=native.scope.caller_ref
                or query.request.parent_contribution_ref!=native.scope.parent_contribution_ref
                or query.request.epoch!=native.scope.epoch
                or query.request.input_revision_ref!=native.scope.evidence_revision_ref
                or len(query.initial_states)!=1
                or query.initial_states[0].state!=immutable_json_data(native.state)
                or query.initial_states[0].model_ref!=native.model.model_ref
                or query.request.immutable_inputs.get("parent_goal_ref")!=why.parent_goal_ref
                or query.request.immutable_inputs.get("frozen_why")!=immutable_json_data(why)):
            missing.append("articulated.route_exact_parent_initial_state_and_why")
        goals=query.request.immutable_inputs.get("articulated_marker_targets")
        expected=tuple(FrozenMap({"body_ref":t.body_ref,"marker_ref":t.marker_ref,"world_position":t.world_position})
            for t in request.marker_targets)
        restorations=query.request.immutable_inputs.get("articulated_restoration_targets")
        expected_restorations=tuple(FrozenMap({"body_ref":r.body_ref,"restoration_target_ref":r.restoration_target_ref,
            "reference_body":r.reference_body}) for r in request.restorations)
        if goals!=expected or restorations!=expected_restorations:
            missing.append("articulated.route_complete_marker_and_restoration_contract")
        domain=request.route_control_domain
        if domain is None:
            missing.append("articulated.route_complete_available_control_domain")
        else:
            controls={control.primitive_ref:control for control in domain.controls}
            if len(controls)!=len(domain.controls) or set(controls)!=set(query.action_refs):
                missing.append("articulated.route_exact_available_command_population")
            if query.state_action_domains:
                for state_ref in sorted(query.state_action_domains):
                    state_domain=query.state_action_domains[state_ref]
                    if (not isinstance(state_domain,FrozenMap)
                            or set(state_domain.get("action_refs",()))!=set(controls)
                            or domain.complete_population.binding.support_claim_ref not in state_domain.get("evidence_refs",())):
                        missing.append("articulated.route_state_domain_preserves_all_available_controls")
            if query.deterministic_response_ref is not None and any(
                    edge.response_ref!=query.deterministic_response_ref for edge in route.edges):
                missing.append("articulated.route_exact_deterministic_response_contract")
            for edge in route.edges:
                control=controls.get(edge.primitive_ref)
                step=edge.native_request.step
                if (control is None or step is None or control.input_ref!=step.input_ref
                        or control.channel_ref!=step.channel_ref):
                    missing.append("articulated.route_edge_matches_available_control");continue
                if control.kind=="ROOTED_SUBCHAIN" and {o.receiver_ref for o in step.operations}!={control.root_body_ref}:
                    missing.append("articulated.route_subchain_only_edits_its_root")
                if control.kind=="SHARED_CHANNEL" and {o.receiver_ref for o in step.operations}!={
                        b.body_ref for b in step.before_bodies if step.channel_ref in b.channel_refs}:
                    missing.append("articulated.route_channel_covers_all_receivers")
                actual_receivers={o.receiver_ref for o in step.operations}
                support={relation.support_claim_ref for relation in request.relations
                    if relation.kind=="CONTROL_CHANNEL" and relation.origin_ref==control.channel_ref
                    and relation.destination_ref in actual_receivers}
                covered={relation.destination_ref for relation in request.relations
                    if relation.kind=="CONTROL_CHANNEL" and relation.origin_ref==control.channel_ref
                    and relation.support_claim_ref in control.support_claim_refs}
                if not support<=set(control.support_claim_refs) or not actual_receivers<=covered:
                    missing.append("articulated.route_control_uses_exact_grounded_receiver_relations")
            indirect_rows,indirect_missing=derive_articulated_indirect_domains(request,returned.reasons)
            missing.extend(indirect_missing)
            for row in indirect_rows:
                primitives={option["primitive_ref"] for option in row["admissible_intervention_domain"]}
                if require_measured_indirect_edges and not any(edge.primitive_ref in primitives for edge in route.edges):
                    missing.append("articulated.indirect_domain_requires_native_transition_measurements")
        accepting,goal_missing,goal_work=derive_articulated_route_terminal_states(request,route,
            max(0,request.parent_maximum_evaluations-returned.accounted_evaluations),returned.frozen_measurement.pose_question_receipts,
            returned.frozen_measurement.restoration_target_receipts)
        missing.extend(goal_missing)
        if (query.acceptance_predicates or query.terminal_predicates
                or query.accepting_states!=accepting or query.terminal_states!=accepting
                or query.packet_acceptance_contract_ref is not None or query.packet_acceptance_model_refs):
            missing.append("articulated.route_actual_complete_terminal_state_domain")
        maxwork=query.request.actual_bounds.get("max_candidates")
        if type(maxwork) is not int or returned.accounted_evaluations+goal_work+maxwork>request.parent_maximum_evaluations:
            missing.append("articulated.route_parent_search_budget_reserved")
    return ArticulatedRouteParentFactsC(facts=FrozenMap({"route_bound":route is not None and not bool(missing),
        "goal_measurement_work":goal_work,"indirect_preparation_domains":indirect_rows}),
        missing_refs=tuple(missing))


def get_articulated_parent_route(value):
    return project_articulated_session_edges(value.returned)[0]


def seal_articulated_parent_route(value):
    returned=value.returned
    missing=list((*returned.missing_refs,*value.measured.missing_refs))
    route=value.route
    work=returned.accounted_evaluations+value.measured.facts.get("goal_measurement_work",0)
    if route is not None:
        question=returned.frozen_measurement.frozen_input.route_question
        if route.bridge.query.request!=question.query.request:
            missing.append("articulated.exact_parent_route_return")
            route=None
        else:
            missing.extend(route.missing_refs)
            # Consume K09 actual candidate work, not its response packet count.
            packet=route.returned.descriptive_values.get("measurement",{}) if route.returned is not None else {}
            facts=packet.get("facts",FrozenMap()) if isinstance(packet,FrozenMap) else FrozenMap()
            examined=facts.get("candidate_evaluation_count") if isinstance(facts,FrozenMap) else None
            if type(examined) is int and examined>=0:work+=examined
            elif route.returned is not None:missing.append("articulated.route_exact_search_work_counter")
    restoration_rows,restoration_missing,restoration_work=measure_articulated_route_restoration(
        returned.frozen_measurement.frozen_input,route,returned.conditional_dependency_receipts,
        returned.frozen_measurement.restoration_target_receipts,
        max(0,returned.frozen_measurement.frozen_input.parent_maximum_evaluations-work))
    missing.extend(restoration_missing)
    work+=restoration_work
    if work>returned.frozen_measurement.frozen_input.parent_maximum_evaluations:
        missing.append("articulated.restoration_reconciliation_global_budget")
    return returned.model_copy(update={"route_return":route,"accounted_evaluations":work,
        "reasons":(*returned.reasons,*value.measured.facts.get("indirect_preparation_domains",()),*restoration_rows),
        "missing_refs":tuple(sorted(set(missing)))})
