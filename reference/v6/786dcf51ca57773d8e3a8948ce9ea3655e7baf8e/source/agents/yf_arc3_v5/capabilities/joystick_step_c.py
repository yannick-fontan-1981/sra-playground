"""Project native joystick motion, complete populations and Source-bound lifecycle."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_family_contracts_d import d_map
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_common_contracts_c import MechanicalEventC, ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_transport_c import packet_payload
from .joystick_step_contracts_c import (JoystickStepInputC, JoystickStepFactsC, JoystickStepMeasurementC,
    JoystickStepDecodeInputC, JoystickStepResponseInputC, JoystickStepFinishInputC, JoystickStepDispatchC)


def measure_joystick_step_signature(value: JoystickStepInputC) -> JoystickStepFactsC:
    identity, native = value.request, value.native_request
    scope = native.scope
    primitive = native.action_kind
    phases = tuple(row.phase for row in value.phases)
    expected = ("COMPLETE_PRIMITIVE",)
    goal = value.source_goal_acceptance_contract_ref
    return JoystickStepFactsC(facts=FrozenMap({
        "exact_native_signature": native.operation_ref == identity.operation_ref == "mechanics.bounded_joystick.external_primitive"
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
            and identity.immutable_inputs.get("primitive") == FrozenMap({"action_kind": primitive,
                "occurrence_ref": native.occurrence_ref, "pad_ref": native.pad_ref, "settings": tuple(d_map(item) for item in native.settings),
                "nudge": native.nudge, "selectable_occurrence_refs": native.selectable_occurrence_refs})
            and identity.immutable_inputs.get("action_ref") == value.action_ref
            and identity.immutable_inputs.get("primitive_ref") == value.primitive_ref
            and identity.immutable_inputs.get("native_context_digest") == stable_digest(d_map(native)),
        "source_lifecycle_contract_bound": bool(value.lifecycle_terminal_bindings) and bool(value.lifecycle_evidence_refs)
            and all(type(value.lifecycle_terminal_bindings[key]) is bool for key in sorted(value.lifecycle_terminal_bindings))
            and identity.immutable_inputs.get("lifecycle_terminal_bindings") == value.lifecycle_terminal_bindings
            and identity.immutable_inputs.get("lifecycle_evidence_refs") == value.lifecycle_evidence_refs,
        "exact_native_bounds": identity.actual_bounds == FrozenMap({"node_bound": native.node_bound,
            "depth_bound": native.depth_bound, "domain_bound": native.domain_bound, "time_bound_ms": native.time_bound_ms}),
        "parent_provenance_equal": packet_context_equal(value.parent_request, identity, value.model_ref),
        "current_ownership_and_phase_contract": bool(value.ownership_evidence_refs) and bool(value.phase_clock_evidence_refs)
            and scope.input_domain_complete and not native.resume_frontier and phases == expected
            and len({row.occurrence_ref for row in value.phases}) == len(value.phases)
            and len({row.snapshot_ref for row in value.phases}) == len(value.phases)
            and all(first.clock_ref != second.clock_ref or first.tick <= second.tick
                for index, first in enumerate(value.phases) for second in value.phases[index+1:]),
        "complete_adapter_prebound": identity.immutable_inputs.get("event_owner_ref") == scope.event_owner_ref
            and identity.immutable_inputs.get("complete_external_adapter_operation_ref") == native.operation_ref
            and identity.immutable_inputs.get("inherited_phase_refs") == value.inherited_phase_refs
            and len(set(value.inherited_phase_refs)) == len(value.inherited_phase_refs)
            and not value.other_adapter_case_refs and identity.immutable_inputs.get("other_adapter_case_refs") == (),
        "goal_contract_bound_or_absent": goal is None or bool(value.source_goal_evidence_refs)
            and value.parent_request.immutable_inputs.get("packet_acceptance_contract_ref") == goal
            and identity.immutable_inputs.get("packet_acceptance_contract_ref") == goal}))


def unsupported_joystick_step(value: JoystickStepInputC) -> JoystickStepMeasurementC:
    return JoystickStepMeasurementC(frozen_request=value, native=None, packet=None,
        missing_refs=("unsupported_native_joystick_step_scope",), facts=FrozenMap({
            "packet_complete": False, "native_bound_reached": False, "missing_evidence": True}))


def decode_joystick_step(value: JoystickStepDecodeInputC) -> JoystickStepMeasurementC:
    request, native = value.request, value.native
    missing = []
    exact = (native.scope == request.native_request.scope and native.operation_ref == request.native_request.operation_ref
        and native.mode_ref == request.native_request.mode_ref)
    rows = native.values.get("model_correlated_results", ())
    valid_row = (isinstance(rows, tuple) and len(rows) == 1 and isinstance(rows[0], FrozenMap)
        and rows[0].get("model_ref") == request.model_ref and isinstance(rows[0].get("result"), FrozenMap))
    if not exact or native.status != "COMPLETE" or not native.domain_complete or not valid_row:
        missing.append("exact_complete_native_joystick_result")
    row = rows[0]["result"] if valid_row else FrozenMap()
    before, after = d_map(request.native_request.state), row.get("state")
    ledger = row.get("event_ledger")
    valid_ledger = isinstance(ledger, tuple) and len(ledger) == 1 and isinstance(ledger[0], FrozenMap)
    kind = request.native_request.action_kind
    cost, accepted, terminal = None, None, None
    if (not isinstance(before, FrozenMap) or not isinstance(after, FrozenMap) or not valid_ledger
            or row.get("event_owner_ref") != request.native_request.scope.event_owner_ref
            or row.get("automatic_pass_already_owned") is not True or row.get("cost_already_owned") is not True):
        missing.append("native_single_compound_joystick_transaction")
    if not missing:
        entry, model = ledger[0], request.native_request.models[0]
        cost, accepted = entry.get("debit"), entry.get("accepted")
        lifecycle = row.get("lifecycle_ref")
        terminal = request.lifecycle_terminal_bindings.get(lifecycle)
        if (entry.get("owner_ref") != request.native_request.scope.event_owner_ref
                or entry.get("input_kind") != kind or entry.get("direct_automatic_cost_acceptance_owned") is not True
                or type(cost) is not int or cost < 0 or type(accepted) is not bool or row.get("debit") != cost
                or entry.get("lifecycle_ref") != lifecycle or type(terminal) is not bool
                or not isinstance(row.get("motion_trace"), tuple) or entry.get("direct_motion") != row.get("motion_trace")
                or type(entry.get("wrap_count")) is not int or entry.get("wrap_count") < 0
                or entry.get("wrap_count") != row.get("wrap_count", 0)):
            missing.append("native_owner_motion_wrap_cost_and_source_lifecycle")
        if kind == "reset":
            if (model.reset_state is None or after != d_map(model.reset_state) or cost != model.reset_cost
                    or lifecycle != model.reset_lifecycle_ref or row.get("restoration_contract_ref") != model.model_ref
                    or row.get("motion_trace") != () or entry.get("wrap_count") != 0 or accepted is not False):
                missing.append("independent_native_joystick_reset")
        else:
            if (type(row.get("acceptance_checked")) is not bool or row.get("accepted") != accepted
                    or not isinstance(row.get("accepted_target_refs"), tuple)
                    or accepted != bool(row.get("accepted_target_refs"))
                    or not row.get("acceptance_checked") and accepted):
                missing.append("actual_native_full_population_acceptance")
            if kind in ("select", "cycle"):
                if row.get("motion_trace") != () or entry.get("wrap_count") != 0 or cost != model.selection_cost:
                    missing.append("identity_selection_is_not_population_motion")
            elif kind in ("set", "nudge"):
                if row.get("acceptance_checked") is not True:
                    missing.append("native_setting_population_check_missing")
            else:
                missing.append("unsupported_native_joystick_input_kind")
    packet = None
    if not missing:
        binding = request.phases[0]
        writes = FrozenMap({key: after[key] for key in sorted(after) if key not in before or after[key] != before[key]})
        event = MechanicalEventC(occurrence_ref=binding.occurrence_ref,
            producer_ref=request.native_request.scope.event_owner_ref, kind_ref=binding.kind_ref,
            clock_ref=binding.clock_ref, tick=binding.tick, temporal_scope_ref=binding.temporal_scope_ref,
            snapshot_ref=binding.snapshot_ref, snapshot_kind=binding.snapshot_kind,
            reads=before, writes=writes, deleted_state_refs=tuple(key for key in sorted(before) if key not in after),
            costs=FrozenMap({"native_debit": cost}), predicate_values=FrozenMap.overlay({
                "native_joystick_transaction": row, "accepted": accepted, "terminal": terminal,
                "lifecycle_ref": row["lifecycle_ref"], "lifecycle_evidence_refs": request.lifecycle_evidence_refs}, after),
            interruption_ref=request.interruption_ref if terminal else None)
        packet = ExternalPrimitivePacketC(request=request.request, parent_request=request.parent_request,
            model_ref=request.model_ref, action_ref=request.action_ref, primitive_ref=request.primitive_ref,
            before=before, after=after, events=(event,), snapshots=FrozenMap({binding.snapshot_ref: before}),
            closure_domain_ref=request.closure_domain_ref, closure_stop_ref=request.closure_stop_ref,
            complete=True, missing_refs=(), cost=cost, terminal=terminal, acceptance=accepted,
            source_goal_acceptance_contract_ref=request.source_goal_acceptance_contract_ref, response_ref=request.response_ref)
    return JoystickStepMeasurementC(frozen_request=request, native=native, packet=packet,
        missing_refs=tuple(sorted(set(missing))), facts=FrozenMap({"packet_complete": packet is not None,
            "native_bound_reached": native.status == "NEEDS_EVIDENCE" and native.cause in (
                "NODE_BOUND", "TIME_BOUND", "ACTUATOR_DIMENSION_DEPTH_BOUND", "ACTUATOR_PRODUCT_DOMAIN_BOUND",
                "ASSIGNMENT_DEPTH_BOUND", "ASSIGNMENT_DOMAIN_BOUND", "ASSIGNMENT_FRONTIER_BOUND", "PREPARATION_DEPTH_BOUND"),
            "packet_transport_bound_reached": False, "missing_evidence": bool(missing),
            "native_status": native.status, "native_cause": native.cause}))


def assemble_joystick_step_response(value: JoystickStepResponseInputC) -> MechanicalResponseInput:
    measured = value.measured
    return MechanicalResponseInput(request=measured.frozen_request.request, returned_identity=measured.frozen_request.request,
        source_status=value.source_status, returned_type="DMechanicalResult", missing_cause=value.missing_cause,
        descriptive_values=FrozenMap({"exact_packet": packet_payload(measured.packet),
            "missing_refs": measured.missing_refs, "native_return": d_map(measured.native) if measured.native else None}))


def finish_joystick_step(value: JoystickStepFinishInputC) -> JoystickStepDispatchC:
    return JoystickStepDispatchC(frozen_measurement=value.measured, packet=value.measured.packet,
        normalized=value.normalized, native=value.measured.native,
        discharged_inherited_phase_refs=value.measured.frozen_request.inherited_phase_refs
            if value.measured.packet is not None else ())
