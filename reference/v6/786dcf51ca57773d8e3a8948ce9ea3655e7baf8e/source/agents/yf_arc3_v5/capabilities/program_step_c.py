"""Project full poses captured by native program execution, never run instructions twice."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_family_contracts_d import d_map
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_common_contracts_c import MechanicalEventC, ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_transport_c import packet_payload
from .program_step_contracts_c import (ProgramStepInputC, ProgramStepFactsC, ProgramStepMeasurementC,
    ProgramStepDecodeInputC, ProgramStepResponseInputC, ProgramStepFinishInputC, ProgramStepDispatchC)


def measure_program_step_signature(value: ProgramStepInputC) -> ProgramStepFactsC:
    identity, native = value.request, value.native_request
    scope = native.scope
    kind = native.action_kind
    phases = tuple(row.phase for row in value.phases)
    expected = ("COMPLETE_PRIMITIVE",)
    goal = value.source_goal_acceptance_contract_ref
    return ProgramStepFactsC(facts=FrozenMap({
        "exact_native_signature": native.operation_ref == identity.operation_ref == "mechanics.fixed_program_origin.external_primitive"
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
        "native_inputs_bound": native.state is not None and kind in ("placement", "launch", "reset")
            and identity.immutable_inputs.get("state") == d_map(native.state)
            and identity.immutable_inputs.get("action_kind") == kind
            and identity.immutable_inputs.get("action_ref") == value.action_ref
            and identity.immutable_inputs.get("primitive_ref") == value.primitive_ref
            and (kind != "launch" or len(native.models) == 1 and native.observed_word == native.models[0].word)
            and identity.immutable_inputs.get("native_context_digest") == stable_digest(d_map(native)),
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


def unsupported_program_step(value: ProgramStepInputC) -> ProgramStepMeasurementC:
    return ProgramStepMeasurementC(frozen_request=value, native=None, packet=None,
        missing_refs=("unsupported_native_program_step_scope",), facts=FrozenMap({
            "packet_complete": False, "native_bound_reached": False, "missing_evidence": True}))


def decode_program_step(value: ProgramStepDecodeInputC) -> ProgramStepMeasurementC:
    request, native = value.request, value.native
    missing = []
    exact = (native.scope == request.native_request.scope and native.operation_ref == request.native_request.operation_ref
        and native.mode_ref == request.native_request.mode_ref)
    rows = native.values.get("model_correlated_results", ())
    valid_row = (isinstance(rows, tuple) and len(rows) == 1 and isinstance(rows[0], FrozenMap)
        and rows[0].get("model_ref") == request.model_ref and isinstance(rows[0].get("result"), FrozenMap))
    if not exact or native.status != "COMPLETE" or not native.domain_complete or not valid_row:
        missing.append("exact_complete_native_program_result")
    row = rows[0]["result"] if valid_row else FrozenMap()
    before, after = row.get("before_state"), row.get("pose")
    snapshots, poses, ledger = row.get("phase_snapshots"), row.get("pose_snapshots"), row.get("event_ledger")
    valid_ledger = isinstance(ledger, tuple) and len(ledger) == 1 and isinstance(ledger[0], FrozenMap)
    if (not all(isinstance(item, FrozenMap) for item in (before, after, snapshots)) or not isinstance(poses, tuple)
            or before != d_map(request.native_request.state) or snapshots.get("before") != before
            or snapshots.get("after_cost_and_verdict") != after or not valid_ledger):
        missing.append("full_native_program_before_pose_snapshots")
    events, packet_snapshots, packet, phase_rows = [], {}, None, []
    transport_bound = False
    if not missing:
        model = request.native_request.models[0]
        kind, root_owner = request.native_request.action_kind, request.native_request.scope.event_owner_ref
        entry, cost = ledger[0], row.get("debit")
        accepted = entry.get("accepted")
        if (row.get("fixed_word") != model.word or row.get("event_owner_ref") != root_owner
                or row.get("internal_effects_not_external_inputs") is not True
                or row.get("automatic_pass_already_owned") is not True or row.get("cost_already_owned") is not True
                or entry.get("owner_ref") != root_owner or entry.get("external_input_kind") != kind
                or type(cost) is not int or cost < 0 or entry.get("debit") != cost or type(accepted) is not bool
                or entry.get("direct_and_automatic_effects_owned") is not True):
            missing.append("unchanged_fixed_word_and_native_owner_debit")
        if kind == "launch":
            initialized = snapshots.get("after_launch_initialization")
            if (not isinstance(initialized, FrozenMap) or snapshots.get("after_program") != after
                    or request.native_request.observed_word != model.word or cost != model.launch_cost
                    or type(row.get("word_complete")) is not bool or row.get("accepted") != accepted
                    or entry.get("internal_event_trace") != row.get("trace") or not isinstance(row.get("trace"), tuple)):
                missing.append("native_whole_fixed_word_launch_scope")
            current = before
            phases = frozenset(("launch_initialization", "nominal_instruction", "forced_transition",
                "closure_sealing", "closure_already_consumed"))
            for ordinal, pose in enumerate(poses):
                valid_pose = (isinstance(pose, FrozenMap) and pose.get("phase_ref") in phases
                    and pose.get("before_pose") == current and isinstance(pose.get("after_pose"), FrozenMap))
                if not valid_pose:
                    missing.append("native_pose_chain_complete_correspondence")
                    break
                phase, index, owner = pose["phase_ref"], pose.get("instruction_index"), pose.get("owner_ref")
                if phase == "launch_initialization":
                    licensed = ordinal == 0 and index is None and owner == root_owner and pose["after_pose"] == initialized
                else:
                    licensed = (type(index) is int and 0 <= index < len(model.word)
                        and owner == f"{root_owner}:instruction:{index}")
                if not licensed:
                    missing.append("native_instruction_pose_owner_scope")
                    break
                following = pose["after_pose"]
                phase_rows.append((f".pose.{ordinal}", phase, owner, current, following,
                    FrozenMap.overlay({"native_pose_snapshot": pose}, following)))
                current = following
            if current != after or (before.get("alive") is True and (not poses or row.get("launch_initialization_performed") is not True)):
                missing.append("native_program_chain_end_and_initialization")
            if accepted and (row.get("word_complete") is not True or after.get("alive") is not True):
                missing.append("native_acceptance_requires_complete_alive_word")
        elif kind == "placement":
            if poses or snapshots.get("after_direct") != after or cost != model.placement_cost or accepted:
                missing.append("native_direct_placement_without_program")
            else:
                phase_rows.append((".placement", "placement", root_owner, before, after, FrozenMap()))
        elif kind == "reset":
            if (poses or model.reset_pose is None or after != d_map(model.reset_pose)
                    or snapshots.get("independent_reset") != after or cost != model.reset_cost
                    or row.get("restoration_contract_ref") != model.model_ref or accepted):
                missing.append("independent_native_program_reset")
            else:
                phase_rows.append((".reset", "reset", root_owner, before, after, FrozenMap()))
        else:
            missing.append("declared_native_program_input_kind")
        if not missing:
            phase_rows.append((".cost_verdict", "cost_verdict", root_owner, after, after,
                FrozenMap({"accepted": accepted, "word_complete": row.get("word_complete"),
                    "closure_stop": row.get("closure_stop"), "native_program_result": row})))
        transport_bound = len(phase_rows) > 4096
        if transport_bound:
            missing.append("complete_event_packet_transport_bound")
        binding = request.phases[0]
        for suffix, phase, owner, phase_before, phase_after, predicates in (() if missing else phase_rows):
            occurrence, snapshot_ref = binding.occurrence_ref + suffix, binding.snapshot_ref + suffix
            packet_snapshots[snapshot_ref] = phase_before
            writes = FrozenMap({key: phase_after[key] for key in sorted(phase_after)
                if key not in phase_before or phase_after[key] != phase_before[key]})
            final = phase == "cost_verdict"
            events.append(MechanicalEventC(occurrence_ref=occurrence, producer_ref=owner,
                kind_ref=binding.kind_ref + "." + phase, clock_ref=binding.clock_ref, tick=binding.tick,
                temporal_scope_ref=binding.temporal_scope_ref, snapshot_ref=snapshot_ref, snapshot_kind=binding.snapshot_kind,
                reads=phase_before, writes=writes, deleted_state_refs=tuple(key for key in sorted(phase_before) if key not in phase_after),
                costs=FrozenMap({"native_debit": cost}) if final else FrozenMap(),
                predecessor_refs=(events[-1].occurrence_ref,) if events else (), predicate_values=predicates,
                interruption_ref=request.interruption_ref if final and (accepted or after.get("alive") is False) else None))
        if not missing:
            terminal = accepted or after.get("alive") is False
            packet = ExternalPrimitivePacketC(request=request.request, parent_request=request.parent_request,
                model_ref=request.model_ref, action_ref=request.action_ref, primitive_ref=request.primitive_ref,
                before=before, after=after, events=tuple(events), snapshots=FrozenMap(packet_snapshots),
                closure_domain_ref=request.closure_domain_ref, closure_stop_ref=request.closure_stop_ref,
                complete=True, missing_refs=(), cost=cost, terminal=terminal, acceptance=accepted,
                source_goal_acceptance_contract_ref=request.source_goal_acceptance_contract_ref, response_ref=request.response_ref)
    return ProgramStepMeasurementC(frozen_request=request, native=native, packet=packet,
        missing_refs=tuple(sorted(set(missing))), facts=FrozenMap({"packet_complete": packet is not None,
            "native_bound_reached": native.status == "BOUND_REACHED", "packet_transport_bound_reached": transport_bound,
            "missing_evidence": bool(missing), "native_status": native.status, "native_cause": native.cause}))


def assemble_program_step_response(value: ProgramStepResponseInputC) -> MechanicalResponseInput:
    measured = value.measured
    return MechanicalResponseInput(request=measured.frozen_request.request, returned_identity=measured.frozen_request.request,
        source_status=value.source_status, returned_type="DMechanicalResult", missing_cause=value.missing_cause,
        descriptive_values=FrozenMap({"exact_packet": packet_payload(measured.packet),
            "missing_refs": measured.missing_refs, "native_return": d_map(measured.native) if measured.native else None}))


def finish_program_step(value: ProgramStepFinishInputC) -> ProgramStepDispatchC:
    return ProgramStepDispatchC(frozen_measurement=value.measured, packet=value.measured.packet,
        normalized=value.normalized, native=value.measured.native,
        discharged_inherited_phase_refs=value.measured.frozen_request.inherited_phase_refs
            if value.measured.packet is not None else ())
