"""Project full native joint tick states without rerunning field dynamics."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_family_contracts_d import d_map
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_common_contracts_c import MechanicalEventC, ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_transport_c import packet_payload
from .axial_step_contracts_c import (AxialStepInputC, AxialStepFactsC, AxialStepMeasurementC,
    AxialStepDecodeInputC, AxialStepResponseInputC, AxialStepFinishInputC, AxialStepDispatchC)


def measure_axial_step_signature(value: AxialStepInputC) -> AxialStepFactsC:
    identity, native = value.request, value.native_request
    scope = native.scope
    primitive = native.primitive
    phases = tuple(row.phase for row in value.phases)
    expected = ("RESET",) if primitive is not None and primitive.kind_ref == "reset" else ("DIRECT", "COST_VERDICT")
    all_bindings = (*value.phases, *(row.phase for row in value.tick_bindings))
    goal = value.source_goal_acceptance_contract_ref
    return AxialStepFactsC(facts=FrozenMap({
        "exact_native_signature": native.operation_ref == identity.operation_ref == "mechanics.axial_field_configuration.external_primitive"
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
            and identity.immutable_inputs.get("tick_bindings_digest") == stable_digest(tuple(d_map(row) for row in value.tick_bindings))
            and identity.immutable_inputs.get("native_event_scope_ref") == value.native_event_scope_ref == native.event_scope_ref
            and identity.immutable_inputs.get("internal_tick_producer_ref") == value.internal_tick_producer_ref == native.internal_tick_producer_ref,
        "exact_native_bounds": identity.actual_bounds == FrozenMap({"node_bound": native.node_bound,
            "depth_bound": native.depth_bound, "domain_bound": native.domain_bound, "time_bound_ms": native.time_bound_ms}),
        "parent_provenance_equal": packet_context_equal(value.parent_request, identity, value.model_ref),
        "current_ownership_and_phase_contract": bool(value.ownership_evidence_refs) and bool(value.phase_clock_evidence_refs)
            and scope.input_domain_complete and not native.resume_frontier and phases == expected
            and len({row.occurrence_ref for row in all_bindings}) == len(all_bindings)
            and len({row.snapshot_ref for row in all_bindings}) == len(all_bindings)
            and tuple(row.tick_index for row in value.tick_bindings) == tuple(range(len(value.tick_bindings)))
            and all(row.phase.phase == "INTERNAL_TICK" and row.phase.snapshot_kind == "SIMULTANEOUS"
                and row.phase.temporal_scope_ref == value.native_event_scope_ref for row in value.tick_bindings),
        "complete_adapter_prebound": identity.immutable_inputs.get("event_owner_ref") == scope.event_owner_ref
            and identity.immutable_inputs.get("complete_external_adapter_operation_ref") == native.operation_ref
            and identity.immutable_inputs.get("inherited_phase_refs") == value.inherited_phase_refs
            and len(set(value.inherited_phase_refs)) == len(value.inherited_phase_refs)
            and not value.other_adapter_case_refs and identity.immutable_inputs.get("other_adapter_case_refs") == (),
        "goal_contract_bound_or_absent": goal is None or bool(value.source_goal_evidence_refs)
            and value.parent_request.immutable_inputs.get("packet_acceptance_contract_ref") == goal
            and identity.immutable_inputs.get("packet_acceptance_contract_ref") == goal}))


def unsupported_axial_step(value: AxialStepInputC) -> AxialStepMeasurementC:
    return AxialStepMeasurementC(frozen_request=value, native=None, packet=None,
        missing_refs=("unsupported_native_axial_step_scope",), facts=FrozenMap({
            "packet_complete": False, "native_bound_reached": False, "missing_evidence": True}))


def decode_axial_step(value: AxialStepDecodeInputC) -> AxialStepMeasurementC:
    request, native = value.request, value.native
    missing = []
    exact = (native.scope == request.native_request.scope and native.operation_ref == request.native_request.operation_ref
        and native.mode_ref == request.native_request.mode_ref)
    rows = native.values.get("model_correlated_results", ())
    valid_row = (isinstance(rows, tuple) and len(rows) == 1 and isinstance(rows[0], FrozenMap)
        and rows[0].get("model_ref") == request.model_ref and isinstance(rows[0].get("result"), FrozenMap))
    if not exact or native.status != "OK" or not native.domain_complete or not valid_row:
        missing.append("exact_complete_native_axial_result")
    row = rows[0]["result"] if valid_row else FrozenMap()
    before, after = row.get("before_state"), row.get("state")
    snapshots, ledger, closure = row.get("phase_snapshots"), row.get("event_ledger"), row.get("closure_facts")
    if (not all(isinstance(item, FrozenMap) for item in (before, after, snapshots, ledger, closure))
            or before != d_map(request.native_request.state) or row.get("primitive_complete") is not True):
        missing.append("native_axial_full_snapshots")
    phase_rows, packet, debit, accepted, transport_bound = [], None, None, None, False
    if not missing:
        model, primitive = request.native_request.models[0], request.native_request.primitive
        phases = {binding.phase: binding for binding in request.phases}
        debit, accepted = ledger.get("debit"), ledger.get("accepted")
        if (ledger.get("event_owner_ref") != request.native_request.scope.event_owner_ref
                or type(debit) is not int or debit < 0 or type(accepted) is not bool or snapshots.get("before") != before):
            missing.append("native_axial_owner_cost_verdict")
        if primitive.kind_ref == "reset":
            if (model.reset_state is None or after != d_map(model.reset_state)
                    or snapshots.get("independent_reset") != after or debit != model.reset_cost
                    or closure.get("independent_restoration_complete") is not True
                    or ledger.get("automatic_pass_count") != 0 or ledger.get("acceptance_checked") is not False
                    or accepted is not False):
                missing.append("independent_native_axial_reset")
            else:
                phase_rows = [(phases["RESET"], before, after, FrozenMap(), FrozenMap({"native_debit": debit}),
                    request.native_request.scope.event_owner_ref)]
        else:
            direct, relaxation = row.get("direct_effect"), row.get("relaxation")
            direct_state, relaxed_state = snapshots.get("after_direct"), snapshots.get("after_relaxation")
            input_costs = tuple(cost for kind, cost in model.input_costs if kind == primitive.kind_ref)
            if (not isinstance(direct, FrozenMap) or not isinstance(direct_state, FrozenMap)
                    or direct.get("state") != direct_state or type(direct.get("relaxation_due")) is not bool
                    or not isinstance(relaxed_state, FrozenMap) or snapshots.get("after_cost_and_verdict") != after
                    or not all(closure.get(key) is True for key in ("direct_complete", "cost_complete", "official_verdict_complete"))
                    or ledger.get("kind_ref") != primitive.kind_ref or len(input_costs) != 1 or debit != input_costs[0]
                    or ledger.get("internal_tick_producer_ref") != request.internal_tick_producer_ref
                    or ledger.get("second_relaxation_forbidden") is not True or ledger.get("second_debit_forbidden") is not True):
                missing.append("native_direct_relaxation_cost_contract")
            else:
                current = direct_state
                phase_rows.append((phases["DIRECT"], before, current,
                    FrozenMap.overlay({"native_direct_effect": direct}, current), FrozenMap(), request.native_request.scope.event_owner_ref))
                if direct["relaxation_due"]:
                    trace = relaxation.get("trajectory") if isinstance(relaxation, FrozenMap) else None
                    if (not isinstance(relaxation, FrozenMap) or not isinstance(trace, tuple)
                            or relaxation.get("extra_external_commands") != 0 or closure.get("relaxation_complete") is not True
                            or ledger.get("automatic_pass_count") != 1 or ledger.get("acceptance_checked") is not True):
                        missing.append("native_completed_relaxation_trace")
                    elif len(trace) > len(request.tick_bindings) or len(trace)+2 > 4096:
                        transport_bound = True
                        missing.append("axial_tick_binding_or_packet_transport_bound")
                    else:
                        for index, event in enumerate(trace):
                            binding = request.tick_bindings[index].phase
                            if (not isinstance(event, FrozenMap) or event.get("tick_index") != index
                                    or event.get("before_state") != current or not isinstance(event.get("after_state"), FrozenMap)
                                    or event.get("internal_tick_producer_ref") != request.internal_tick_producer_ref
                                    or event.get("event_scope_ref") != request.native_event_scope_ref):
                                missing.append("exact_native_tick_state_owner_scope")
                                break
                            following = event["after_state"]
                            phase_rows.append((binding, current, following, FrozenMap.overlay({"native_axial_tick": event}, following),
                                FrozenMap(), request.internal_tick_producer_ref))
                            current = following
                        normal = relaxation.get("termination_ref") == "normal_no_admissible_move"
                        cap = relaxation.get("termination_ref") == "physical_tick_cap"
                        if (current != relaxation.get("state") or relaxation.get("tick_count") != len(trace)
                                or not (normal or cap) or closure.get("normal_global_closure") != normal
                                or relaxation.get("physical_stability_proved") != normal
                                or closure.get("physical_cap_rejects_acceptance") != cap
                                or cap and (relaxation.get("guard_cap_is_not_victory") is not True or accepted is not False)):
                            missing.append("normal_stability_distinct_from_physical_cap")
                elif (relaxation is not None or closure.get("relaxation_complete") is not False
                        or ledger.get("automatic_pass_count") != 0 or ledger.get("acceptance_checked") is not False):
                    missing.append("nonpivot_has_no_extra_relaxation")
                if current != relaxed_state:
                    missing.append("native_relaxation_final_snapshot")
                phase_rows.append((phases["COST_VERDICT"], current, after, FrozenMap({
                    "accepted": accepted, "exhausted": ledger.get("exhausted"), "native_relaxation": relaxation}),
                    FrozenMap({"native_debit": debit}), request.native_request.scope.event_owner_ref))
    events, packet_snapshots = [], {}
    if not missing:
        for binding, phase_before, phase_after, predicates, costs, producer in phase_rows:
            packet_snapshots[binding.snapshot_ref] = phase_before
            writes = FrozenMap({key: phase_after[key] for key in sorted(phase_after)
                if key not in phase_before or phase_after[key] != phase_before[key]})
            events.append(MechanicalEventC(occurrence_ref=binding.occurrence_ref, producer_ref=producer, kind_ref=binding.kind_ref,
                clock_ref=binding.clock_ref, tick=binding.tick, temporal_scope_ref=binding.temporal_scope_ref,
                snapshot_ref=binding.snapshot_ref, snapshot_kind=binding.snapshot_kind,
                reads=phase_before, writes=writes, deleted_state_refs=tuple(key for key in sorted(phase_before) if key not in phase_after),
                costs=costs, predecessor_refs=(events[-1].occurrence_ref,) if events else (), predicate_values=predicates,
                interruption_ref=request.interruption_ref if binding.phase in ("COST_VERDICT", "RESET")
                    and phase_after.get("terminated") is True else None))
        if not all(first.clock_ref != second.clock_ref or first.tick <= second.tick
                for index, first in enumerate(events) for second in events[index+1:]):
            missing.append("current_tick_phase_clock_order")
        else:
            packet = ExternalPrimitivePacketC(request=request.request, parent_request=request.parent_request,
                model_ref=request.model_ref, action_ref=request.action_ref, primitive_ref=request.primitive_ref,
                before=before, after=after, events=tuple(events), snapshots=FrozenMap(packet_snapshots),
                closure_domain_ref=request.closure_domain_ref, closure_stop_ref=request.closure_stop_ref,
                complete=True, missing_refs=(), cost=debit, terminal=after.get("terminated") is True,
                acceptance=accepted, source_goal_acceptance_contract_ref=request.source_goal_acceptance_contract_ref,
                response_ref=request.response_ref)
    return AxialStepMeasurementC(frozen_request=request, native=native, packet=packet,
        missing_refs=tuple(sorted(set(missing))), facts=FrozenMap({"packet_complete": packet is not None,
            "native_bound_reached": native.status == "BOUND_REACHED", "packet_transport_bound_reached": transport_bound,
            "missing_evidence": bool(missing), "native_status": native.status, "native_cause": native.cause}))


def assemble_axial_step_response(value: AxialStepResponseInputC) -> MechanicalResponseInput:
    measured = value.measured
    return MechanicalResponseInput(request=measured.frozen_request.request, returned_identity=measured.frozen_request.request,
        source_status=value.source_status, returned_type="DMechanicalResult", missing_cause=value.missing_cause,
        descriptive_values=FrozenMap({"exact_packet": packet_payload(measured.packet),
            "missing_refs": measured.missing_refs, "native_return": d_map(measured.native) if measured.native else None}))


def finish_axial_step(value: AxialStepFinishInputC) -> AxialStepDispatchC:
    return AxialStepDispatchC(frozen_measurement=value.measured, packet=value.measured.packet,
        normalized=value.normalized, native=value.measured.native,
        discharged_inherited_phase_refs=value.measured.frozen_request.inherited_phase_refs
            if value.measured.packet is not None else ())
