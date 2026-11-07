"""Copy K33 complete phase ledger exactly; no native calculation or automatic pass."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_common_contracts_c import MechanicalEventC, ExternalPrimitivePacketC
from .reactive_packet_contracts_c import ReactivePacketMeasurementC

def measure_reactive_packet(receipt):
    returned = receipt.returned
    native, result = returned.frozen_request, returned.calculation
    scope, identity = native.scope, receipt.request
    events = result.native.values.get("phase_events", ())
    missing = []
    if (native.operation_ref != "mechanics.reactive_graph_navigation.joint_successor" or native.mode != "STEP"
            or identity.operation_ref != native.operation_ref or identity.mode != "STEP"
            or identity.kernel_ref != "mechanics.reactive_graph_navigation"
            or result.native.scope != scope or result.native.operation_ref != native.operation_ref
            or result.native.mode != native.mode or not result.native.domain_complete
            or result.native.prerequisite_refs or result.native.computation_bound_reached
            or result.checkpoint is not None or native.model is None or native.state is None or native.control is None
            or result.state is None):
        missing.append("complete_exact_current_K33_joint_successor")
    if (identity.request_ref != scope.request_ref or identity.caller_ref != scope.caller_ref
            or identity.parent_contribution_ref != scope.parent_contribution_ref or identity.epoch != scope.epoch
            or identity.input_revision_ref != scope.evidence_revision_ref
            or identity.immutable_inputs.get("reactive_native_request_digest") != stable_digest(immutable_json_data(native))
            or identity.immutable_inputs.get("state") != immutable_json_data(native.state)
            or identity.immutable_inputs.get("action_ref") != receipt.action_ref
            or identity.immutable_inputs.get("primitive_ref") != receipt.primitive_ref
            or identity.immutable_inputs.get("packet_acceptance_contract_ref") != receipt.source_goal_acceptance_contract_ref
            or receipt.parent_request.immutable_inputs.get("packet_acceptance_contract_ref") != receipt.source_goal_acceptance_contract_ref
            or identity.actual_bounds != FrozenMap({"maximum_evaluations": native.maximum_evaluations,
                "maximum_states": native.maximum_states, "horizon": native.horizon})
            or not packet_context_equal(receipt.parent_request, identity, receipt.model_ref)):
        missing.append("exact_K33_common_identity_and_bounds")
    if (native.model is None or receipt.model_ref != native.model.model_ref
            or native.control is None or receipt.action_ref != native.control.action_ref
            or not receipt.ownership_evidence_refs or not receipt.phase_clock_evidence_refs
            or identity.immutable_inputs.get("reactive_phase_bindings_digest") != stable_digest(receipt.phase_bindings)
            or len(events) != len(receipt.phase_bindings)
            or len({binding.occurrence_ref for binding in receipt.phase_bindings}) != len(receipt.phase_bindings)
            or len({binding.snapshot_ref for binding in receipt.phase_bindings}) != len(receipt.phase_bindings)):
        missing.append("current_single_adapter_phase_ownership_and_binding")
    previous = immutable_json_data(native.state) if native.state is not None else FrozenMap()
    if missing:
        return ReactivePacketMeasurementC(frozen_receipt=receipt, packet=None, missing_refs=tuple(sorted(set(missing))))
    projected, snapshots = [], {}
    cost = 0
    for event, binding in zip(events, receipt.phase_bindings):
        if (event.get("before") != previous or not isinstance(event.get("after"), FrozenMap)
                or event.get("phase") != binding.kind_ref
                or binding.producer_ref != scope.event_owner_ref):
            missing.append("whole_state_phase_continuity_and_event_owner")
            break
        debit = event.get("cost", 0)
        if type(debit) is not int or debit < 0:
            missing.append("exact_native_primitive_cost")
            break
        cost += debit
        snapshots[binding.snapshot_ref] = previous
        projected.append(MechanicalEventC(occurrence_ref=binding.occurrence_ref,
            kind_ref=binding.kind_ref, producer_ref=binding.producer_ref, clock_ref=binding.clock_ref,
            tick=binding.tick, temporal_scope_ref=binding.temporal_scope_ref, snapshot_ref=binding.snapshot_ref,
            snapshot_kind=binding.snapshot_kind, reads=previous,
            writes=event["after"], costs=FrozenMap({"native_debit": debit}),
            predicate_values=FrozenMap({"native_phase_ledger": event}),
            predecessor_refs=() if not projected else (projected[-1].occurrence_ref,)))
        previous = event["after"]
    if (result.state is None or previous != immutable_json_data(result.state)
            or cost != result.native.values.get("cost") or not events):
        missing.append("complete_K33_phase_frontier_and_single_cost_ledger")
    if any(first.clock_ref == second.clock_ref and first.tick > second.tick
            for i, first in enumerate(receipt.phase_bindings) for second in receipt.phase_bindings[i+1:]):
        missing.append("declared_phase_clock_order")
    packet = None
    if not missing:
        packet = ExternalPrimitivePacketC(request=identity, parent_request=receipt.parent_request,
            model_ref=receipt.model_ref, action_ref=receipt.action_ref, primitive_ref=receipt.primitive_ref,
            before=immutable_json_data(native.state), after=immutable_json_data(result.state),
            events=tuple(projected), snapshots=FrozenMap(snapshots), closure_domain_ref=receipt.closure_domain_ref,
            closure_stop_ref=receipt.closure_stop_ref, complete=True, cost=cost,
            terminal=result.state.dead or result.state.completed, acceptance=result.state.completed,
            source_goal_acceptance_contract_ref=receipt.source_goal_acceptance_contract_ref, response_ref=receipt.response_ref)
    return ReactivePacketMeasurementC(frozen_receipt=receipt, packet=packet, missing_refs=tuple(sorted(set(missing))))
