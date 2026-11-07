"""Project every native reply branch; never select a favorable deterministic reply."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_family_contracts_d import d_map
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_common_contracts_c import MechanicalEventC, ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_transport_c import packet_payload
from .alignment_step_contracts_c import (AlignmentStepInputC, AlignmentStepFactsC, AlignmentStepMeasurementC,
    AlignmentStepDecodeInputC, AlignmentStepResponseInputC, AlignmentStepFinishInputC, AlignmentStepDispatchC)


def measure_alignment_step_signature(value: AlignmentStepInputC) -> AlignmentStepFactsC:
    identity, native = value.request, value.native_request
    scope = native.scope
    primitive = native.primitive
    all_phases = tuple(phase for branch in value.branches for phase in branch.phases)
    expected = ("RESET",) if primitive is not None and primitive.kind_ref == "reset" else ("PLAYER", "OPPONENT", "ACCESS", "COST_QUOTA")
    branch_phases_equal = all(tuple(phase.phase for phase in branch.phases) == expected for branch in value.branches)
    goal = value.source_goal_acceptance_contract_ref
    return AlignmentStepFactsC(facts=FrozenMap({
        "exact_native_signature": native.operation_ref == identity.operation_ref == "mechanics.finite_alignment_game.external_primitive"
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
            and identity.immutable_inputs.get("native_context_digest") == stable_digest(d_map(native)),
        "exact_native_bounds": identity.actual_bounds == FrozenMap({"node_bound": native.node_bound,
            "depth_bound": native.depth_bound, "domain_bound": native.domain_bound, "time_bound_ms": native.time_bound_ms}),
        "parent_provenance_equal": packet_context_equal(value.parent_request, identity, value.model_ref),
        "current_ownership_and_phase_contract": bool(value.ownership_evidence_refs) and bool(value.phase_clock_evidence_refs)
            and scope.input_domain_complete and not native.resume_frontier and branch_phases_equal
            and len({branch.response_ref for branch in value.branches}) == len(value.branches)
            and identity.immutable_inputs.get("response_bindings_digest") == stable_digest(tuple(d_map(branch) for branch in value.branches))
            and len({row.occurrence_ref for row in all_phases}) == len(all_phases)
            and len({row.snapshot_ref for row in all_phases}) == len(all_phases)
            and all(first.clock_ref != second.clock_ref or first.tick <= second.tick
                for branch in value.branches for index, first in enumerate(branch.phases)
                for second in branch.phases[index+1:]),
        "complete_adapter_prebound": identity.immutable_inputs.get("event_owner_ref") == scope.event_owner_ref
            and identity.immutable_inputs.get("complete_external_adapter_operation_ref") == native.operation_ref
            and identity.immutable_inputs.get("inherited_phase_refs") == value.inherited_phase_refs
            and len(set(value.inherited_phase_refs)) == len(value.inherited_phase_refs)
            and not value.other_adapter_case_refs and identity.immutable_inputs.get("other_adapter_case_refs") == (),
        "goal_contract_bound_or_absent": goal is None or bool(value.source_goal_evidence_refs)
            and value.parent_request.immutable_inputs.get("packet_acceptance_contract_ref") == goal
            and identity.immutable_inputs.get("packet_acceptance_contract_ref") == goal}))


def unsupported_alignment_step(value: AlignmentStepInputC) -> AlignmentStepMeasurementC:
    return AlignmentStepMeasurementC(frozen_request=value, native=None, packets=(), response_metadata=(),
        missing_refs=("unsupported_native_alignment_step_scope",), facts=FrozenMap({
            "packet_complete": False, "native_bound_reached": False, "missing_evidence": True}))


def decode_alignment_step(value: AlignmentStepDecodeInputC) -> AlignmentStepMeasurementC:
    request, native = value.request, value.native
    missing = []
    exact = (native.scope == request.native_request.scope and native.operation_ref == request.native_request.operation_ref
        and native.mode_ref == request.native_request.mode_ref)
    rows = native.values.get("model_correlated_results", ())
    valid_row = (isinstance(rows, tuple) and len(rows) == 1 and isinstance(rows[0], FrozenMap)
        and rows[0].get("model_ref") == request.model_ref and isinstance(rows[0].get("result"), FrozenMap))
    row = rows[0]["result"] if valid_row else FrozenMap()
    responses = row.get("responses")
    if (not exact or native.status != "OK" or not native.domain_complete or not valid_row
            or row.get("reply_domain_complete") is not True or not isinstance(responses, tuple) or not responses
            or not all(isinstance(response, FrozenMap) for response in responses)):
        missing.append("exact_complete_native_alignment_reply_domain")
    transport_bound = isinstance(responses, tuple) and len(responses) > len(request.branches)
    if transport_bound:
        missing.append("source_response_binding_capacity")
    packets, metadata = [], []
    if not missing:
        before = d_map(request.native_request.state)
        model, primitive = request.native_request.models[0], request.native_request.primitive
        if len(responses) > 1 and row.get("uncertain_reply_not_selected_as_favorable_deterministic") is not True:
            missing.append("complete_uncertain_reply_domain_not_selected")
        for index, response in enumerate(responses):
            binding = request.branches[index]
            snapshots, ledger, closure = response.get("phase_snapshots"), response.get("event_ledger"), response.get("closure_facts")
            after, probability = response.get("state"), response.get("probability")
            if (not all(isinstance(item, FrozenMap) for item in (snapshots, ledger, closure, after))
                    or response.get("primitive_complete") is not True or snapshots.get("before") != before):
                missing.append("native_alignment_branch_snapshots")
                continue
            cost, accepted = ledger.get("debit"), ledger.get("accepted")
            if (ledger.get("event_owner_ref") != request.native_request.scope.event_owner_ref
                    or type(cost) is not int or cost < 0 or type(accepted) is not bool
                    or probability is not None and not (isinstance(probability, tuple) and len(probability) == 2
                        and type(probability[0]) is int and type(probability[1]) is int and probability[0] >= 0 and probability[1] > 0)):
                missing.append("native_alignment_branch_owner_cost_probability")
                continue
            if primitive.kind_ref == "reset":
                if (closure.get("actual_reset_effect_complete") is not True
                        or snapshots.get("actual_reset_protocol") != after or cost != model.reset_cost
                        or ledger.get("reset_law_ref") != model.reset_law_ref
                        or ledger.get("automatic_pass_count") != 0 or accepted is not False or probability != (1, 1)):
                    missing.append("actual_native_reset_protocol")
                    continue
                if (model.reset_law_ref == "declared_exact_restoration"
                        and (model.reset_state is None or after != d_map(model.reset_state))):
                    missing.append("independent_alignment_reset_state")
                    continue
                phase_rows = [(binding.phases[0], before, after, FrozenMap({"native_debit": cost}))]
            else:
                player, opponent = snapshots.get("after_player"), snapshots.get("after_opponent")
                access, final = snapshots.get("after_access_effects"), snapshots.get("after_cost_and_quota")
                reply = response.get("opponent_cell")
                if (not all(isinstance(item, FrozenMap) for item in (player, opponent, access, final))
                        or final != after or cost != model.input_cost
                        or not all(closure.get(key) is True for key in ("player_placement_complete", "immediate_terminal_checked",
                            "one_reply_or_immediate_terminal_complete", "access_reset_effect_complete", "cost_and_quota_complete"))
                        or ledger.get("player_cell") != primitive.cell or ledger.get("opponent_cell") != reply
                        or ledger.get("automatic_pass_count") != (0 if reply is None else 1)
                        or ledger.get("second_reply_forbidden") is not True or ledger.get("second_debit_forbidden") is not True
                        or model.debit_order_ref not in ("before_transaction", "after_access_effects")
                        or not isinstance(ledger.get("access_effect"), FrozenMap)):
                    missing.append("complete_player_reply_access_quota_transaction")
                    continue
                if reply is None and player != opponent:
                    missing.append("immediate_terminal_has_no_extra_reply")
                    continue
                first_cost = FrozenMap({"native_debit": cost}) if model.debit_order_ref == "before_transaction" else FrozenMap()
                last_cost = FrozenMap({"native_debit": cost}) if model.debit_order_ref == "after_access_effects" else FrozenMap()
                states = (before, player, opponent, access, after)
                phase_rows = [(phase, states[ordinal], states[ordinal+1],
                    first_cost if ordinal == 0 else last_cost if ordinal == 3 else FrozenMap())
                    for ordinal, phase in enumerate(binding.phases)]
            events, packet_snapshots = [], {}
            for phase, phase_before, phase_after, costs in phase_rows:
                packet_snapshots[phase.snapshot_ref] = phase_before
                writes = FrozenMap({key: phase_after[key] for key in sorted(phase_after)
                    if key not in phase_before or phase_after[key] != phase_before[key]})
                events.append(MechanicalEventC(occurrence_ref=phase.occurrence_ref,
                    producer_ref=request.native_request.scope.event_owner_ref, kind_ref=phase.kind_ref,
                    clock_ref=phase.clock_ref, tick=phase.tick, temporal_scope_ref=phase.temporal_scope_ref,
                    snapshot_ref=phase.snapshot_ref, snapshot_kind=phase.snapshot_kind,
                    reads=phase_before, writes=writes,
                    deleted_state_refs=tuple(key for key in sorted(phase_before) if key not in phase_after),
                    costs=costs, predecessor_refs=(events[-1].occurrence_ref,) if events else (),
                    predicate_values=FrozenMap.overlay({"native_alignment_transaction": response,
                        "native_branch_final_accepted": accepted,
                        "native_verdict_phase": phase.phase in ("COST_QUOTA", "RESET")}, phase_after),
                    interruption_ref=request.interruption_ref if phase.phase in ("COST_QUOTA", "RESET")
                        and phase_after.get("terminated") is True else None))
            packets.append(ExternalPrimitivePacketC(request=request.request, parent_request=request.parent_request,
                model_ref=request.model_ref, action_ref=request.action_ref, primitive_ref=request.primitive_ref,
                before=before, after=after, events=tuple(events), snapshots=FrozenMap(packet_snapshots),
                closure_domain_ref=request.closure_domain_ref, closure_stop_ref=request.closure_stop_ref,
                complete=True, missing_refs=(), cost=cost, terminal=after.get("terminated") is True,
                acceptance=accepted, source_goal_acceptance_contract_ref=request.source_goal_acceptance_contract_ref,
                response_ref=binding.response_ref))
            metadata.append(FrozenMap({"response_ref": binding.response_ref, "native_response_ordinal": index,
                "native_response_digest": stable_digest(response), "probability": probability,
                "opponent_cell": response.get("opponent_cell"), "reply_policy_ref": model.reply_policy_ref,
                "response_quantifier_ref": request.native_request.response_quantifier_ref}))
    if missing:
        packets, metadata = [], []
    return AlignmentStepMeasurementC(frozen_request=request, native=native,
        packets=tuple(packets), response_metadata=tuple(metadata), missing_refs=tuple(sorted(set(missing))),
        facts=FrozenMap({"packet_complete": bool(packets), "native_bound_reached": native.status == "BOUND_REACHED",
            "packet_transport_bound_reached": transport_bound, "missing_evidence": bool(missing),
            "native_status": native.status, "native_cause": native.cause}))


def assemble_alignment_step_response(value: AlignmentStepResponseInputC) -> MechanicalResponseInput:
    measured = value.measured
    return MechanicalResponseInput(request=measured.frozen_request.request, returned_identity=measured.frozen_request.request,
        source_status=value.source_status, returned_type="DMechanicalResult", missing_cause=value.missing_cause,
        descriptive_values=FrozenMap({"exact_packets": tuple(packet_payload(packet) for packet in measured.packets),
            "response_metadata": measured.response_metadata,
            "reply_domain_complete": bool(measured.packets), "branch_packets_are_alternatives": True,
            "missing_refs": measured.missing_refs, "native_return": d_map(measured.native) if measured.native else None}))


def finish_alignment_step(value: AlignmentStepFinishInputC) -> AlignmentStepDispatchC:
    return AlignmentStepDispatchC(frozen_measurement=value.measured, packets=value.measured.packets, response_metadata=value.measured.response_metadata,
        normalized=value.normalized, native=value.measured.native,
        discharged_inherited_phase_refs=value.measured.frozen_request.inherited_phase_refs
            if bool(value.measured.packets) else ())
