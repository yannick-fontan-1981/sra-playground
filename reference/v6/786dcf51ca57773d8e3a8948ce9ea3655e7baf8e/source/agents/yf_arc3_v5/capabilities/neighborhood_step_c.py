"""Decode only forward states/phases actually returned by native D K78."""
from .neighborhood_step_contracts_c import (NeighborhoodStepInputC, NeighborhoodStepFactsC,
    NeighborhoodStepDecodeInputC, NeighborhoodStepMeasurementC, NeighborhoodStepResponseInputC,
    NeighborhoodStepFinishInputC, NeighborhoodStepDispatchC)
from .mechanical_common_contracts_c import MechanicalEventC, ExternalPrimitivePacketC
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_transport_c import packet_payload
from .mechanical_family_contracts_d import d_map
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_neighborhood_step_signature(value: NeighborhoodStepInputC) -> NeighborhoodStepFactsC:
    identity, native = value.request, value.native_request
    scope = native.scope
    phases = tuple(row.phase for row in value.phases)
    phase_by_name = {row.phase: row for row in value.phases}
    ordered_phases = tuple(phase_by_name[name] for name in ("DIRECT", "RECOLOR", "ACCEPTANCE")
        if name in phase_by_name)
    bounds = FrozenMap({"node_bound": native.node_bound, "depth_bound": native.depth_bound,
        "domain_bound": native.domain_bound, "time_bound_ms": native.time_bound_ms})
    aligned = (scope.request_ref == identity.request_ref and scope.caller_ref == identity.caller_ref
        and scope.parent_contribution_ref == identity.parent_contribution_ref and scope.epoch == identity.epoch
        and scope.evidence_revision_ref == identity.input_revision_ref
        and scope.parent_goal_ref == value.source_parent_goal_ref
        and scope.parent_consumer_ref == identity.immutable_inputs.get("source_parent_consumer_ref")
        and scope.caller_next_item_ref == identity.immutable_inputs.get("source_next_item_ref")
        and scope.model_revision_ref == value.native_model_revision_ref
        and scope.model_status_ref == value.native_model_status_ref
        and native.operation_ref == identity.operation_ref and native.mode_ref == identity.mode
        and native.requested_result_type == identity.expected_return_type
        and scope.input_domain_complete and not native.resume_frontier
        and identity.immutable_inputs.get("native_context_digest") == stable_digest(d_map(native))
        and (value.source_goal_acceptance_contract_ref is None or bool(value.source_goal_evidence_refs)
            and identity.immutable_inputs.get("packet_acceptance_contract_ref") == value.source_goal_acceptance_contract_ref
            and value.parent_request.immutable_inputs.get("packet_acceptance_contract_ref") == value.source_goal_acceptance_contract_ref))
    return NeighborhoodStepFactsC(facts=FrozenMap({"operation_ref": identity.operation_ref,
        "kernel_ref": identity.kernel_ref, "mode": identity.mode,
        "expected_return_type": identity.expected_return_type,
        "native_identity_aligned": aligned,
        "native_initial_state_equal": native.state is not None and d_map(native.state) == identity.immutable_inputs.get("state"),
        "native_model_exact": len(native.models) == 1 and native.models[0].model_ref == value.model_ref
            and stable_digest(d_map(native.models[0])) == value.native_model_digest
            and identity.immutable_inputs.get("native_model_digest") == value.native_model_digest,
        "native_bounds_exact": bounds == value.native_bounds
            and identity.immutable_inputs.get("native_bounds") == value.native_bounds
            and identity.actual_bounds == bounds,
        "parent_binding_equal": packet_context_equal(value.parent_request, identity, value.model_ref),
        "native_primitive_present": native.primitive is not None
            and identity.immutable_inputs.get("native_primitive") == d_map(native.primitive)
            and identity.immutable_inputs.get("action_ref") == value.action_ref
            and identity.immutable_inputs.get("primitive_ref") == value.primitive_ref
            and type(identity.immutable_inputs.get("native_expected_cost")) is int
            and identity.immutable_inputs.get("native_expected_cost") == value.cost
            and identity.immutable_inputs.get("event_owner_ref") == scope.event_owner_ref
            and identity.immutable_inputs.get("complete_external_adapter_operation_ref") == native.operation_ref
            and isinstance(identity.immutable_inputs.get("inherited_phase_refs"), tuple)
            and bool(identity.immutable_inputs.get("inherited_phase_refs"))
            and all(isinstance(ref, str) and bool(ref) for ref in identity.immutable_inputs["inherited_phase_refs"])
            and len(set(identity.immutable_inputs["inherited_phase_refs"])) == len(identity.immutable_inputs["inherited_phase_refs"])
            and identity.immutable_inputs.get("other_adapter_case_refs") == (),
        "phase_contract_complete": set(phases) == {"DIRECT", "RECOLOR", "ACCEPTANCE", "RESET", "IGNORED"}
            and len(set(phases)) == len(phases)
            and len({row.occurrence_ref for row in value.phases}) == len(value.phases)
            and len({row.snapshot_ref for row in value.phases}) == len(value.phases),
        "phase_clock_scoped": len({row.clock_ref for row in value.phases}) == 1
            and len({row.temporal_scope_ref for row in value.phases}) == 1
            and tuple(row.tick for row in ordered_phases) == tuple(sorted(row.tick for row in ordered_phases))}))


def unsupported_neighborhood_step(value: NeighborhoodStepInputC) -> NeighborhoodStepMeasurementC:
    return NeighborhoodStepMeasurementC(request=value, native=None, packet=None,
        missing_refs=("unsupported_native_step_signature",),
        facts=FrozenMap({"complete": False, "identity_exact": False, "native_status_ref": None,
            "native_cause_ref": None, "missing_evidence": True}))


def decode_neighborhood_step(value: NeighborhoodStepDecodeInputC) -> NeighborhoodStepMeasurementC:
    request, native = value.request, value.native
    returned_exact = (native.scope == request.native_request.scope
        and native.operation_ref == request.native_request.operation_ref
        and native.mode_ref == request.native_request.mode_ref)
    rows = native.values.get("model_correlated_results", ())
    valid_row = (isinstance(rows, tuple) and len(rows) == 1 and isinstance(rows[0], FrozenMap)
        and rows[0].get("model_ref") == request.model_ref and isinstance(rows[0].get("result"), FrozenMap))
    missing = []
    if not returned_exact:
        missing.append("native_return_identity")
    if native.status != "COMPLETE" or not native.domain_complete:
        missing.append("native_step_incomplete")
    if not valid_row:
        missing.append("single_exact_model_return")
    row = rows[0]["result"] if valid_row else FrozenMap()
    before, after = row.get("before_state"), row.get("state")
    snapshots, ledger = row.get("phase_snapshots"), row.get("event_ledger")
    closure = row.get("closure_facts")
    if not isinstance(before, FrozenMap) or before != request.request.immutable_inputs.get("state"):
        missing.append("native_before_state")
    if not isinstance(after, FrozenMap) or not isinstance(snapshots, FrozenMap) or not isinstance(ledger, FrozenMap):
        missing.append("native_after_phase_or_ledger")
    if row.get("primitive_complete") is not True:
        missing.append("native_primitive_closure")
    if not isinstance(ledger, FrozenMap) or ledger.get("owner_ref") != request.native_request.scope.event_owner_ref:
        missing.append("native_event_owner")
    if (not isinstance(ledger, FrozenMap) or type(ledger.get("debit")) is not int
            or ledger.get("debit") < 0 or ledger.get("debit") != request.cost):
        missing.append("native_debit_differs_from_frozen_expected_cost")
    if request.native_request.primitive is None or (isinstance(ledger, FrozenMap)
            and ledger.get("direct_kind") != request.native_request.primitive.kind_ref):
        missing.append("native_primitive_kind")
    phases = {phase.phase: phase for phase in request.phases}
    phase_rows = []
    acceptance = False
    if not missing:
        kind = ledger.get("direct_kind")
        if kind == "reset":
            model = request.native_request.models[0]
            if (ledger.get("reset_owned_complete") is not True or snapshots.get("before") != before
                    or snapshots.get("after_reset") != after or model.reset_state is None
                    or after != d_map(model.reset_state) or ledger.get("debit") != model.reset_cost
                    or ledger.get("automatic_pass_count") != 0):
                missing.append("native_reset_closure")
            else:
                phase_rows = [("RESET", before, after, FrozenMap(), ledger)]
        elif isinstance(closure, FrozenMap) and closure.get("ignored_without_transaction") is True:
            if (closure.get("point_outside_bound_domain") is not True or snapshots.get("before") != before
                    or snapshots.get("after_ignored_point") != after or before != after
                    or ledger.get("automatic_pass_count") != 0 or ledger.get("debit") != 0):
                missing.append("native_ignored_point_closure")
            else:
                phase_rows = [("IGNORED", before, after, FrozenMap(), ledger)]
        else:
            direct, recolor, final = snapshots.get("after_direct"), snapshots.get("after_recolor"), snapshots.get("after_acceptance_and_cost")
            closed = isinstance(closure, FrozenMap) and all(closure.get(field) is True for field in (
                "direct_complete", "full_neighborhood_recolor_complete", "site_comparison_complete", "cost_complete", "acceptance_complete"))
            if (not closed or snapshots.get("before") != before or not isinstance(direct, FrozenMap)
                    or not isinstance(recolor, FrozenMap) or recolor.get("state") != direct or final != after
                    or recolor.get("colors") != row.get("colors") or ledger.get("automatic_pass_count") != 1
                    or row.get("second_recolor_or_debit_forbidden") is not True
                    or not isinstance(row.get("direct_event"), FrozenMap)
                    or row["direct_event"].get("owner_ref") != ledger.get("owner_ref")
                    or not isinstance(row.get("automatic_color_deltas"), tuple)
                    or not isinstance(row.get("site_comparisons"), tuple)
                    or type(ledger.get("accepted")) is not bool or type(ledger.get("exhausted")) is not bool):
                missing.append("native_full_phase_closure")
            else:
                acceptance = ledger["accepted"]
                phase_rows = [("DIRECT", before, direct, row["direct_event"], FrozenMap()),
                    ("RECOLOR", direct, direct, FrozenMap({"colors": row["colors"],
                        "automatic_color_deltas": row["automatic_color_deltas"]}), FrozenMap()),
                    ("ACCEPTANCE", direct, after, FrozenMap({"site_comparisons": row["site_comparisons"],
                        "accepted": acceptance, "exhausted": ledger["exhausted"]}), ledger)]
    events, packet_snapshots = [], {}
    for phase_name, phase_before, phase_after, predicates, costs in phase_rows:
        binding = phases[phase_name]
        packet_snapshots[binding.snapshot_ref] = phase_before
        writes = FrozenMap({key: phase_after[key] for key in sorted(phase_after)
            if key not in phase_before or phase_after[key] != phase_before[key]})
        deleted = tuple(key for key in sorted(phase_before) if key not in phase_after)
        events.append(MechanicalEventC(occurrence_ref=binding.occurrence_ref,
            producer_ref=request.native_request.scope.event_owner_ref, kind_ref=binding.kind_ref,
            clock_ref=binding.clock_ref, tick=binding.tick, temporal_scope_ref=binding.temporal_scope_ref,
            snapshot_ref=binding.snapshot_ref, snapshot_kind=binding.snapshot_kind,
            reads=phase_before, writes=writes, deleted_state_refs=deleted,
            costs=FrozenMap({"native_debit": costs["debit"]}) if costs else FrozenMap(),
            predecessor_refs=(events[-1].occurrence_ref,) if events else (),
            predicate_values=FrozenMap.overlay({"native_event_ledger": ledger}, predicates),
            interruption_ref=request.model_interruption_ref if phase_after.get("terminated") is True else None))
    packet = None
    if not missing:
        packet = ExternalPrimitivePacketC(request=request.request, parent_request=request.parent_request,
            model_ref=request.model_ref, action_ref=request.action_ref, primitive_ref=request.primitive_ref,
            before=before, after=after, events=tuple(events), snapshots=FrozenMap(packet_snapshots),
            closure_domain_ref=request.closure_domain_ref, closure_stop_ref=request.closure_stop_ref,
            complete=True, missing_refs=(), cost=ledger["debit"], terminal=after.get("terminated") is True,
            acceptance=acceptance, response_ref=request.response_ref,
            source_goal_acceptance_contract_ref=request.source_goal_acceptance_contract_ref)
    return NeighborhoodStepMeasurementC(request=request, native=native, packet=packet,
        missing_refs=tuple(sorted(set(missing))), facts=FrozenMap({"complete": packet is not None,
            "identity_exact": returned_exact, "native_status_ref": native.status, "native_cause_ref": native.cause,
            "native_returned_incomplete": native.status != "COMPLETE", "missing_evidence": bool(missing)}))


def assemble_neighborhood_step_response(value: NeighborhoodStepResponseInputC) -> MechanicalResponseInput:
    measured = value.measured
    return MechanicalResponseInput(request=measured.request.request, returned_identity=measured.request.request,
        source_status=value.source_status, returned_type="DMechanicalResult", missing_cause=value.missing_cause,
        descriptive_values=FrozenMap({"exact_packet": packet_payload(measured.packet),
            "missing_refs": measured.missing_refs, "native_return": d_map(measured.native) if measured.native else None}))


def finish_neighborhood_step(value: NeighborhoodStepFinishInputC) -> NeighborhoodStepDispatchC:
    return NeighborhoodStepDispatchC(frozen_measurement=value.measured,
        ready_inherited_phase_refs=value.measured.request.request.immutable_inputs["inherited_phase_refs"]
            if value.measured.packet is not None else (),
        packet=value.measured.packet, normalized=value.normalized, native=value.measured.native)
