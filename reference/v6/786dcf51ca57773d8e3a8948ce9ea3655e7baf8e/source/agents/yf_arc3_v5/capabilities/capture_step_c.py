"""Project every ordered native reactive actor state without running reactions twice."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_family_contracts_d import d_map
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_common_contracts_c import MechanicalEventC, ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_transport_c import packet_payload
from .capture_step_contracts_c import (CaptureStepInputC, CaptureStepFactsC, CaptureStepMeasurementC,
    CaptureStepDecodeInputC, CaptureStepResponseInputC, CaptureStepFinishInputC, CaptureStepDispatchC)


def measure_capture_step_signature(value: CaptureStepInputC) -> CaptureStepFactsC:
    identity, native = value.request, value.native_request
    scope = native.scope
    primitive = native.primitive
    phases = tuple(row.phase for row in value.phases)
    expected = ("RESET",) if primitive is not None and primitive.kind_ref == "reset" else ("DIRECT", "COST_VERDICT")
    all_bindings = (*value.phases, *(row.phase for row in value.actor_bindings))
    actor_order = tuple(row.target_ref for row in value.actor_bindings)
    goal = value.source_goal_acceptance_contract_ref
    return CaptureStepFactsC(facts=FrozenMap({
        "exact_native_signature": native.operation_ref == identity.operation_ref == "mechanics.reactive_capture.external_primitive"
            and native.mode_ref == identity.mode == "STEP" and identity.kernel_ref == value.native_kernel_ref
            and native.requested_result_type == identity.expected_return_type == "DMechanicalResult",
        "current_native_scope_equal": scope.request_ref == identity.request_ref and scope.caller_ref == identity.caller_ref
            and scope.parent_contribution_ref == identity.parent_contribution_ref and scope.epoch == identity.epoch
            and scope.evidence_revision_ref == identity.input_revision_ref and scope.parent_goal_ref == value.source_parent_goal_ref
            and scope.parent_consumer_ref == value.source_parent_consumer_ref and scope.caller_next_item_ref == value.source_next_item_ref
            and scope.model_revision_ref == value.model_revision_ref and scope.model_status_ref == value.model_status_ref,
        "exact_single_model_bound": len(native.models) == 1 and native.models[0].model_ref == value.model_ref
            and stable_digest(d_map(native.models[0])) == value.native_model_digest
            and identity.model_assignments == value.bound_model_assignments
            and identity.model_assignments.get("native_model_digest") == value.native_model_digest,
        "native_inputs_bound": native.state is not None and primitive is not None
            and identity.immutable_inputs.get("state") == d_map(native.state)
            and identity.immutable_inputs.get("primitive") == d_map(primitive)
            and identity.immutable_inputs.get("action_ref") == value.action_ref
            and identity.immutable_inputs.get("primitive_ref") == value.primitive_ref
            and identity.immutable_inputs.get("native_context_digest") == stable_digest(d_map(native))
            and identity.immutable_inputs.get("reaction_bindings_digest") == stable_digest(tuple(d_map(row) for row in value.actor_bindings)),
        "exact_native_bounds": identity.actual_bounds == FrozenMap({"node_bound": native.node_bound,
            "depth_bound": native.depth_bound, "domain_bound": native.domain_bound, "time_bound_ms": native.time_bound_ms}),
        "parent_provenance_equal": packet_context_equal(value.parent_request, identity, value.model_ref),
        "current_ownership_and_phase_contract": bool(value.ownership_evidence_refs) and bool(value.phase_clock_evidence_refs)
            and scope.input_domain_complete and not native.resume_frontier and phases == expected
            and len({row.occurrence_ref for row in all_bindings}) == len(all_bindings)
            and len({row.snapshot_ref for row in all_bindings}) == len(all_bindings)
            and len(set(actor_order)) == len(actor_order)
            and all(row.phase.phase == "ACTOR" and row.phase.snapshot_kind == "ACTOR_TURN" for row in value.actor_bindings)
            and len(native.models) == 1 and actor_order == native.models[0].response_order,
        "reset_contract_bound_or_unneeded": primitive is not None and (primitive.kind_ref != "reset"
            or type(value.reset_acceptance) is bool and value.reset_acceptance_contract_ref is not None
            and bool(value.reset_acceptance_evidence_refs)
            and identity.immutable_inputs.get("reset_acceptance") == value.reset_acceptance
            and identity.immutable_inputs.get("reset_acceptance_contract_ref") == value.reset_acceptance_contract_ref
            and identity.immutable_inputs.get("reset_acceptance_evidence_refs") == value.reset_acceptance_evidence_refs),
        "complete_adapter_prebound": identity.immutable_inputs.get("event_owner_ref") == scope.event_owner_ref
            and identity.immutable_inputs.get("complete_external_adapter_operation_ref") == native.operation_ref
            and identity.immutable_inputs.get("inherited_phase_refs") == value.inherited_phase_refs
            and len(set(value.inherited_phase_refs)) == len(value.inherited_phase_refs)
            and not value.other_adapter_case_refs and identity.immutable_inputs.get("other_adapter_case_refs") == (),
        "goal_contract_bound_or_absent": goal is None or bool(value.source_goal_evidence_refs)
            and value.parent_request.immutable_inputs.get("packet_acceptance_contract_ref") == goal
            and identity.immutable_inputs.get("packet_acceptance_contract_ref") == goal}))


def unsupported_capture_step(value: CaptureStepInputC) -> CaptureStepMeasurementC:
    return CaptureStepMeasurementC(frozen_request=value, native=None, packet=None,
        missing_refs=("unsupported_native_capture_step_scope",), facts=FrozenMap({
            "packet_complete": False, "native_bound_reached": False, "missing_evidence": True}))


def decode_capture_step(value: CaptureStepDecodeInputC) -> CaptureStepMeasurementC:
    request, native = value.request, value.native
    missing = []
    exact = (native.scope == request.native_request.scope and native.operation_ref == request.native_request.operation_ref
        and native.mode_ref == request.native_request.mode_ref)
    rows = native.values.get("model_correlated_results", ())
    valid_row = (isinstance(rows, tuple) and len(rows) == 1 and isinstance(rows[0], FrozenMap)
        and rows[0].get("model_ref") == request.model_ref and isinstance(rows[0].get("result"), FrozenMap))
    if not exact or native.status != "COMPLETE" or not native.domain_complete or not valid_row:
        missing.append("exact_complete_native_capture_result")
    row = rows[0]["result"] if valid_row else FrozenMap()
    before, after, ledger = d_map(request.native_request.state), row.get("state"), row.get("event_ledger")
    if (not all(isinstance(item, FrozenMap) for item in (before, after, ledger))
            or request.native_request.state is None or row.get("primitive_complete") is not True):
        missing.append("native_complete_capture_states")
    phase_rows, packet, debit, accepted = [], None, None, None
    if not missing:
        model, primitive = request.native_request.models[0], request.native_request.primitive
        phases = {binding.phase: binding for binding in request.phases}
        debit = ledger.get("debit")
        if (ledger.get("owner_ref") != request.native_request.scope.event_owner_ref
                or ledger.get("direct_kind") != primitive.kind_ref or type(debit) is not int or debit < 0):
            missing.append("native_capture_owner_input_cost")
        if primitive.kind_ref == "reset":
            accepted = request.reset_acceptance
            if (model.reset_state is None or after != d_map(model.reset_state) or debit != model.reset_cost
                    or ledger.get("reaction_pass_count") != 0 or ledger.get("acceptance_owned_by_reset_contract") is not True
                    or type(accepted) is not bool or request.reset_acceptance_contract_ref is None
                    or not request.reset_acceptance_evidence_refs):
                missing.append("independent_capture_reset_and_current_acceptance_contract")
            else:
                phase_rows = [(phases["RESET"], before, after, FrozenMap({"accepted": accepted,
                    "reset_acceptance_contract_ref": request.reset_acceptance_contract_ref}), FrozenMap({"native_debit": debit}))]
        else:
            direct, reaction = row.get("direct"), row.get("reaction")
            accepted = ledger.get("accepted")
            if (not isinstance(direct, FrozenMap) or not isinstance(reaction, FrozenMap)
                    or not isinstance(direct.get("state"), FrozenMap) or not isinstance(reaction.get("state"), FrozenMap)
                    or not isinstance(reaction.get("reaction_trace"), tuple) or type(direct.get("acted")) is not bool
                    or ledger.get("direct_acted") != direct.get("acted") or type(ledger.get("clock_advanced")) is not bool
                    or type(accepted) is not bool or type(ledger.get("exhausted")) is not bool
                    or type(ledger.get("reaction_pass_count")) is not int
                    or reaction.get("reaction_pass_count") != ledger.get("reaction_pass_count")
                    or ledger.get("reaction_pass_count") != int(ledger.get("clock_advanced"))
                    or ledger.get("terminal_order_ref") != model.terminal_order_ref
                    or row.get("second_reaction_or_debit_forbidden") is not True):
                missing.append("native_direct_clock_and_single_reaction_closure")
            else:
                costs = tuple(cost for kind, cost in model.input_costs if kind == primitive.kind_ref)
                if len(costs) != 1 or costs[0] != debit:
                    missing.append("exact_native_capture_input_cost")
                current, trace = direct["state"], reaction["reaction_trace"]
                bindings = {item.target_ref: item.phase for item in request.actor_bindings}
                phase_rows.append((phases["DIRECT"], before, current, FrozenMap.overlay({"native_direct_effect": direct,
                    "clock_advanced": ledger["clock_advanced"]}, current), FrozenMap()))
                seen, actual_order = set(), []
                for event in trace:
                    if (not isinstance(event, FrozenMap) or not isinstance(event.get("target_ref"), str)
                            or event.get("target_ref") not in bindings
                            or event.get("target_ref") in seen or not isinstance(event.get("post_actor_state"), FrozenMap)
                            or event.get("reads_state_after_previous_actor") is not True):
                        missing.append("native_ordered_actor_full_state")
                        break
                    ref = event["target_ref"]
                    prior = tuple(pose for pose in current.get("targets", ()) if pose.get("occurrence_ref") == ref)
                    if len(prior) != 1 or prior[0].get("anchor") != event.get("before_anchor"):
                        missing.append("native_actor_reads_exact_previous_state")
                        break
                    following = event["post_actor_state"]
                    phase_rows.append((bindings[ref], current, following, FrozenMap.overlay({
                        "native_actor_response": event, "native_reaction_target_ref": ref}, following), FrozenMap()))
                    current = following
                    seen.add(ref)
                    actual_order.append(ref)
                if (current != reaction["state"] or tuple(actual_order) != tuple(ref for ref in model.response_order if ref in seen)
                        or not ledger["clock_advanced"] and trace):
                    missing.append("native_reaction_order_and_final_state")
                phase_rows.append((phases["COST_VERDICT"], current, after,
                    FrozenMap({"accepted": accepted, "exhausted": ledger["exhausted"],
                        "native_reaction": reaction}), FrozenMap({"native_debit": debit})))
    events, packet_snapshots = [], {}
    if not missing:
        for binding, phase_before, phase_after, predicates, costs in phase_rows:
            packet_snapshots[binding.snapshot_ref] = phase_before
            writes = FrozenMap({key: phase_after[key] for key in sorted(phase_after)
                if key not in phase_before or phase_after[key] != phase_before[key]})
            events.append(MechanicalEventC(occurrence_ref=binding.occurrence_ref,
                producer_ref=request.native_request.scope.event_owner_ref, kind_ref=binding.kind_ref,
                clock_ref=binding.clock_ref, tick=binding.tick, temporal_scope_ref=binding.temporal_scope_ref,
                snapshot_ref=binding.snapshot_ref, snapshot_kind=binding.snapshot_kind,
                reads=phase_before, writes=writes, deleted_state_refs=tuple(key for key in sorted(phase_before) if key not in phase_after),
                costs=costs, predecessor_refs=(events[-1].occurrence_ref,) if events else (), predicate_values=predicates,
                interruption_ref=request.interruption_ref if binding.phase in ("COST_VERDICT", "RESET")
                    and phase_after.get("terminated") is True else None))
        if not all(first.clock_ref != second.clock_ref or first.tick <= second.tick
                for index, first in enumerate(events) for second in events[index+1:]):
            missing.append("current_actor_phase_clock_order")
        else:
            packet = ExternalPrimitivePacketC(request=request.request, parent_request=request.parent_request,
                model_ref=request.model_ref, action_ref=request.action_ref, primitive_ref=request.primitive_ref,
                before=before, after=after, events=tuple(events), snapshots=FrozenMap(packet_snapshots),
                closure_domain_ref=request.closure_domain_ref, closure_stop_ref=request.closure_stop_ref,
                complete=True, missing_refs=(), cost=debit, terminal=after.get("terminated") is True,
                acceptance=accepted, source_goal_acceptance_contract_ref=request.source_goal_acceptance_contract_ref,
                response_ref=request.response_ref)
    return CaptureStepMeasurementC(frozen_request=request, native=native, packet=packet,
        missing_refs=tuple(sorted(set(missing))), facts=FrozenMap({"packet_complete": packet is not None,
            "native_bound_reached": native.status == "NEEDS_EVIDENCE" and native.cause in ("NODE_BOUND", "TIME_BOUND", "CAPTURE_CELL_DOMAIN_BOUND"),
            "packet_transport_bound_reached": False, "missing_evidence": bool(missing),
            "native_status": native.status, "native_cause": native.cause}))


def assemble_capture_step_response(value: CaptureStepResponseInputC) -> MechanicalResponseInput:
    measured = value.measured
    return MechanicalResponseInput(request=measured.frozen_request.request, returned_identity=measured.frozen_request.request,
        source_status=value.source_status, returned_type="DMechanicalResult", missing_cause=value.missing_cause,
        descriptive_values=FrozenMap({"exact_packet": packet_payload(measured.packet),
            "missing_refs": measured.missing_refs, "native_return": d_map(measured.native) if measured.native else None}))


def finish_capture_step(value: CaptureStepFinishInputC) -> CaptureStepDispatchC:
    return CaptureStepDispatchC(frozen_measurement=value.measured, packet=value.measured.packet,
        normalized=value.normalized, native=value.measured.native,
        discharged_inherited_phase_refs=value.measured.frozen_request.inherited_phase_refs
            if value.measured.packet is not None else ())
