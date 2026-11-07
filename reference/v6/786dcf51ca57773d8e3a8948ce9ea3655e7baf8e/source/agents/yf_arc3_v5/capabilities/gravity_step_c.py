"""Project actual D040 gravity phases; never recompute movement or debit."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_family_contracts_d import d_map
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_common_contracts_c import MechanicalEventC, ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_transport_c import packet_payload
from .gravity_step_contracts_c import (GravityStepInputC, GravityStepFactsC, GravityStepMeasurementC,
    GravityStepDecodeInputC, GravityStepResponseInputC, GravityStepFinishInputC, GravityStepDispatchC)


def measure_gravity_step_signature(value: GravityStepInputC) -> GravityStepFactsC:
    identity, native, scope = value.request, value.native_request, value.native_request.scope
    control = native.control
    last_ticks, ordered = {}, True
    for binding in value.phases:
        if binding.clock_ref in last_ticks and binding.tick < last_ticks[binding.clock_ref]:
            ordered = False
        last_ticks[binding.clock_ref] = binding.tick
    current = (native.operation_ref == identity.operation_ref == "mechanics.gravity_adhesion.external_primitive"
        and native.mode_ref == identity.mode == "STEP"
        and identity.kernel_ref == value.native_kernel_ref == "mechanics.coupled_member_control"
        and native.requested_result_type == identity.expected_return_type == "DMechanicalResult"
        and scope.request_ref == identity.request_ref and scope.caller_ref == identity.caller_ref
        and scope.parent_contribution_ref == identity.parent_contribution_ref and scope.epoch == identity.epoch
        and scope.evidence_revision_ref == identity.input_revision_ref
        and scope.parent_goal_ref == value.source_parent_goal_ref and scope.parent_consumer_ref == value.source_parent_consumer_ref
        and scope.caller_next_item_ref == value.source_next_item_ref
        and scope.model_revision_ref == value.model_revision_ref and scope.model_status_ref == value.model_status_ref
        and len(native.models) == 1 and native.models[0].model_ref == value.model_ref
        and stable_digest(d_map(native.models[0])) == value.native_model_digest
        and identity.model_assignments == value.bound_model_assignments
        and identity.model_assignments.get("native_model_digest") == value.native_model_digest
        and native.state is not None and control is not None
        and identity.immutable_inputs.get("state") == d_map(native.state)
        and identity.immutable_inputs.get("primitive") == d_map(control)
        and control.action_ref == value.action_ref and control.evidence_revision_ref == identity.input_revision_ref
        and identity.immutable_inputs.get("action_ref") == value.action_ref
        and identity.immutable_inputs.get("primitive_ref") == value.primitive_ref
        and identity.immutable_inputs.get("native_context_digest") == stable_digest(d_map(native))
        and identity.actual_bounds == FrozenMap({"node_bound": native.node_bound,
            "depth_bound": native.depth_bound, "domain_bound": native.domain_bound, "time_bound_ms": native.time_bound_ms})
        and packet_context_equal(value.parent_request, identity, value.model_ref)
        and bool(value.ownership_evidence_refs) and bool(value.phase_clock_evidence_refs)
        and scope.input_domain_complete and not native.resume_frontier
        and len({row.occurrence_ref for row in value.phases}) == len(value.phases)
        and len({row.snapshot_ref for row in value.phases}) == len(value.phases)
        and ordered
        and identity.immutable_inputs.get("phase_bindings_digest") == stable_digest(tuple(d_map(row) for row in value.phases))
        and identity.immutable_inputs.get("event_owner_ref") == scope.event_owner_ref
        and identity.immutable_inputs.get("complete_external_adapter_operation_ref") == native.operation_ref
        and identity.immutable_inputs.get("inherited_phase_refs") == value.inherited_phase_refs
        and len(set(value.inherited_phase_refs)) == len(value.inherited_phase_refs)
        and not value.other_adapter_case_refs and identity.immutable_inputs.get("other_adapter_case_refs") == ()
        and (value.source_goal_acceptance_contract_ref is None or bool(value.source_goal_evidence_refs)
            and value.parent_request.immutable_inputs.get("packet_acceptance_contract_ref") == value.source_goal_acceptance_contract_ref
            and identity.immutable_inputs.get("packet_acceptance_contract_ref") == value.source_goal_acceptance_contract_ref))
    return GravityStepFactsC(facts=FrozenMap({"exact_gravity_step_contract": current}))


def unsupported_gravity_step(value: GravityStepInputC) -> GravityStepMeasurementC:
    return GravityStepMeasurementC(frozen_request=value, native=None, packet=None,
        missing_refs=("exact_gravity_step_contract",), facts=FrozenMap({"packet_complete": False,
            "native_bound_reached": False, "packet_transport_bound_reached": False, "missing_evidence": True}))


def decode_gravity_step(value: GravityStepDecodeInputC) -> GravityStepMeasurementC:
    request, native = value.request, value.native
    missing = set()
    rows = native.values.get("model_correlated_results", ())
    valid = (isinstance(rows, tuple) and len(rows) == 1 and isinstance(rows[0], FrozenMap)
        and rows[0].get("model_ref") == request.model_ref and isinstance(rows[0].get("result"), FrozenMap))
    if (not measure_gravity_step_signature(request).facts["exact_gravity_step_contract"]
            or native.scope != request.native_request.scope or native.operation_ref != request.request.operation_ref
            or native.mode_ref != "STEP" or native.status != "COMPLETE" or not native.domain_complete or not valid):
        missing.add("exact_complete_native_gravity_result")
    row = rows[0]["result"] if valid else FrozenMap()
    before, after = row.get("before_state"), row.get("state")
    snapshots, ledger = row.get("phase_snapshots"), row.get("event_ledger")
    if (not all(isinstance(x, FrozenMap) for x in (before, after, snapshots, ledger))
            or before != d_map(request.native_request.state) or snapshots.get("before") != before
            or snapshots.get("after_cost_and_verdict") != after or row.get("primitive_complete") is not True):
        missing.add("full_native_gravity_state_and_owned_ledger")
    phase_rows, cost, accepted, terminal = [], None, None, None
    if not missing:
        model, control = request.native_request.models[0], request.native_request.control
        cost, accepted, terminal = ledger.get("debit"), ledger.get("accepted"), after.get("terminated")
        if (type(cost) is not int or cost < 0 or type(accepted) is not bool or type(terminal) is not bool
                or ledger.get("event_owner_ref") != native.scope.event_owner_ref
                or ledger.get("action_ref") != request.action_ref or ledger.get("second_settlement_or_debit_forbidden") is not True):
            missing.add("native_gravity_debit_verdict_owner")
        elif control.kind_ref == "reset":
            lifecycle = ledger.get("lifecycle_ref")
            if (lifecycle not in ("active", "accepted", "exhausted")
                    or model.reset_state is None or after != d_map(model.reset_state) or cost != model.reset_cost
                    or accepted != (lifecycle == "accepted") or terminal != (lifecycle != "active")
                    or ledger.get("restoration_contract_ref") != model.reset_contract_ref
                    or ledger.get("restoration_evidence_refs") != model.reset_evidence_refs
                    or ledger.get("final_reserve_owned_by_reset_contract") is not True
                    or snapshots.get("independent_reset") != after):
                missing.add("independent_gravity_reset_lifecycle_cost")
            phase_rows = [("INDEPENDENT_RESET", before, after, row)]
        else:
            physical = row.get("physical_image")
            settlement = physical.get("settlement") if isinstance(physical, FrozenMap) else None
            micros = settlement.get("micro_trace") if isinstance(settlement, FrozenMap) else None
            if (not isinstance(micros, tuple) or not micros or settlement.get("stationary") is not True
                    or ledger.get("micro_steps_are_not_inputs") is not True
                    or ledger.get("terminal_order_ref") != model.terminal_order_ref
                    or type(ledger.get("exhausted")) is not bool
                    or terminal != (accepted or ledger["exhausted"])):
                missing.add("complete_native_gravity_micro_closure")
            else:
                if after.get("reserve") != before.get("reserve") - cost or ledger["exhausted"] != (after.get("reserve") == 0):
                    missing.add("native_gravity_reserve_and_exhaustion")
                direct = micros[0].get("before_state") if isinstance(micros[0], FrozenMap) else None
                direct_phase = physical.get("direct_prephase")
                if isinstance(direct_phase, FrozenMap) and direct_phase.get("state") != direct:
                    missing.add("native_gravity_direct_prephase_endpoint")
                prior = direct
                phase_rows.append(("DIRECT_PREPHASE", before, direct, physical.get("direct_prephase")))
                for micro in micros:
                    if (not isinstance(micro, FrozenMap) or micro.get("before_state") != prior
                            or not isinstance(micro.get("state"), FrozenMap)):
                        missing.add("native_gravity_micro_state_chain")
                        break
                    following = micro["state"]
                    phase_rows.append(("MICRO_TICK", prior, following, micro))
                    prior = following
                if prior != snapshots.get("after_physical_and_settlement") or not isinstance(direct, FrozenMap):
                    missing.add("native_gravity_settled_endpoint")
                phase_rows.append(("COST_VERDICT", prior, after, ledger))
    transport_bound = len(phase_rows) > 4096
    if transport_bound or len(request.phases) < len(phase_rows):
        missing.add("gravity_phase_transport_or_bank_bound")
    packet, events, event_snapshots = None, [], {}
    if not missing:
        for index, (phase, first, following, detail) in enumerate(phase_rows):
            binding = request.phases[index]
            verdict = phase in ("COST_VERDICT", "INDEPENDENT_RESET")
            if (binding.phase != phase or binding.snapshot_kind != ("PRE_COMMAND" if index == 0 else "SIMULTANEOUS")
                    or not isinstance(first, FrozenMap) or not isinstance(following, FrozenMap)):
                missing.add("current_gravity_phase_snapshot_binding")
                break
            event_snapshots[binding.snapshot_ref] = first
            events.append(MechanicalEventC(occurrence_ref=binding.occurrence_ref,
                producer_ref=native.scope.event_owner_ref, kind_ref=binding.kind_ref,
                clock_ref=binding.clock_ref, tick=binding.tick, temporal_scope_ref=binding.temporal_scope_ref,
                snapshot_ref=binding.snapshot_ref, snapshot_kind=binding.snapshot_kind, reads=first,
                writes=FrozenMap({key: following[key] for key in sorted(following) if key not in first or following[key] != first[key]}),
                deleted_state_refs=tuple(key for key in sorted(first) if key not in following),
                predecessor_refs=(events[-1].occurrence_ref,) if events else (),
                costs=FrozenMap({"native_debit": cost}) if verdict else FrozenMap(),
                predicate_values=FrozenMap.overlay(FrozenMap({"native_phase_detail": detail,
                    "accepted": accepted, "terminal": terminal}) if verdict else FrozenMap({"native_phase_detail": detail}), following),
                interruption_ref=request.interruption_ref if verdict and terminal else None))
        if not missing:
            packet = ExternalPrimitivePacketC(request=request.request, parent_request=request.parent_request,
                model_ref=request.model_ref, action_ref=request.action_ref, primitive_ref=request.primitive_ref,
                before=before, after=after, events=tuple(events), snapshots=FrozenMap(event_snapshots),
                closure_domain_ref=request.closure_domain_ref, closure_stop_ref=request.closure_stop_ref,
                complete=True, missing_refs=(), cost=cost, terminal=terminal, acceptance=accepted,
                source_goal_acceptance_contract_ref=request.source_goal_acceptance_contract_ref, response_ref=request.response_ref)
    return GravityStepMeasurementC(frozen_request=request, native=native, packet=packet,
        missing_refs=tuple(sorted(missing)), facts=FrozenMap({"packet_complete": packet is not None,
            "native_bound_reached": native.status == "NEEDS_EVIDENCE" and native.cause in ("NODE_BOUND", "TIME_BOUND", "GRAVITY_WORD_PRIMITIVE_BOUND"),
            "packet_transport_bound_reached": transport_bound,
            "physical_micro_bound_unfinished": native.cause == "GRAVITY_MICRO_STEP_LIMIT",
            "missing_evidence": bool(missing),
            "native_status": native.status, "native_cause": native.cause}))


def assemble_gravity_step_response(value: GravityStepResponseInputC) -> MechanicalResponseInput:
    measured = value.measured
    return MechanicalResponseInput(request=measured.frozen_request.request, returned_identity=measured.frozen_request.request,
        source_status=value.source_status, returned_type="DMechanicalResult", missing_cause=value.missing_cause,
        descriptive_values=FrozenMap({"exact_packet": packet_payload(measured.packet),
            "missing_refs": measured.missing_refs, "native_return": d_map(measured.native) if measured.native else None}))


def finish_gravity_step(value: GravityStepFinishInputC) -> GravityStepDispatchC:
    return GravityStepDispatchC(frozen_measurement=value.measured,
        packet=value.measured.packet if value.source_packet_allowed else None,
        normalized=value.normalized, native=value.measured.native,
        ready_inherited_phase_refs=value.measured.frozen_request.inherited_phase_refs
            if value.source_packet_allowed and value.measured.packet is not None else ())
