"""Project one already-owned K63 ledger, preserving its state and budget."""
from .metric_step_contracts_c import (MetricStepInputC, MetricStepFactsC, MetricStepDecodeInputC,
    MetricStepMeasurementC, MetricStepResponseInputC, MetricStepFinishInputC, MetricStepDispatchC)
from .mechanical_common_contracts_c import MechanicalEventC, ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_transport_c import packet_payload
from agents.yf_arc3_v5.logos.types import FrozenMap, freeze_json, stable_digest


def metric_model_payload_c(model):
    return freeze_json(model.model_dump(mode="json")) if model is not None else None


def metric_goal_descriptor_c(request):
    return FrozenMap({"target": metric_model_payload_c(request.target),
        "demands": tuple(metric_model_payload_c(row) for row in request.demands),
        "boundaries": tuple(metric_model_payload_c(row) for row in request.boundaries),
        "target_domain_complete_evidence_ref": request.target_domain_complete_evidence_ref})


def metric_model_descriptor_c(request):
    ownership = request.external_ownership
    return FrozenMap({"law": metric_model_payload_c(request.law),
        "goal": metric_goal_descriptor_c(request),
        "declared_restoration": metric_model_payload_c(request.declared_restoration),
        "restoration_contract_ref": request.restoration_contract_ref,
        "evidence_refs": request.evidence_refs,
        "ownership_law": FrozenMap({"contract_ref": ownership.contract_ref,
            "event_owner_ref": ownership.event_owner_ref,
            "automatic_identity_evidence_ref": ownership.automatic_identity_evidence_ref,
            "budget_zero_terminates": ownership.budget_zero_terminates,
            "cost_acceptance_order": ownership.cost_acceptance_order,
            "acceptance_precedes_budget_terminal": ownership.acceptance_precedes_budget_terminal})
            if ownership is not None else None})


def metric_current_state_c(request):
    ownership = request.external_ownership
    if request.state is None or ownership is None:
        return None
    return FrozenMap({"state": metric_model_payload_c(request.state),
        "budget_remaining": ownership.budget_remaining,
        "termination": "preexisting_model_terminal" if ownership.pre_terminal else None})


def measure_metric_step_signature(value: MetricStepInputC) -> MetricStepFactsC:
    identity, native = value.request, value.native_request
    ownership = native.external_ownership
    phase_by_name = {row.phase: row for row in value.phases}
    names = ("DIRECT", "AUTOMATIC", "COST", "ACCEPTANCE") if ownership is not None and (
        ownership.cost_acceptance_order == "COST_THEN_ACCEPTANCE") else ("DIRECT", "AUTOMATIC", "ACCEPTANCE", "COST")
    ordered = tuple(phase_by_name[name] for name in names if name in phase_by_name)
    immutable = identity.immutable_inputs
    return MetricStepFactsC(facts=FrozenMap({"operation_ref": identity.operation_ref,
        "kernel_ref": identity.kernel_ref, "mode": identity.mode,
        "expected_return_type": identity.expected_return_type,
        "native_identity_aligned": native.identity == identity and native.evidence_revision_ref == identity.input_revision_ref,
        "native_initial_state_equal": metric_current_state_c(native) is not None
            and metric_current_state_c(native) == immutable.get("state"),
        "native_model_exact": stable_digest(metric_model_descriptor_c(native)) == value.native_model_digest
            and immutable.get("native_model_digest") == value.native_model_digest,
        "native_bounds_exact": immutable.get("native_bounds") == identity.actual_bounds,
        "parent_binding_equal": packet_context_equal(value.parent_request, identity, value.model_ref)
            and immutable.get("source_parent_goal_ref") == value.source_parent_goal_ref,
        "native_primitive_present": native.primitive is not None
            and immutable.get("native_primitive") == metric_model_payload_c(native.primitive)
            and immutable.get("action_ref") == value.action_ref
            and native.primitive.primitive_ref == value.primitive_ref,
        "ownership_exact": ownership is not None and native.law is not None
            and immutable.get("native_external_ownership") == metric_model_payload_c(ownership)
            and ownership.contract_ref in native.evidence_refs
            and ownership.automatic_identity_evidence_ref in native.evidence_refs
            and ownership.event_owner_ref == native.law.event_owner_ref
            and ownership.primitive_ref == value.primitive_ref,
        "phase_contract_complete": set(phase_by_name) == {"DIRECT", "AUTOMATIC", "COST", "ACCEPTANCE"}
            and len(phase_by_name) == len(value.phases)
            and len({row.occurrence_ref for row in value.phases}) == len(value.phases)
            and len({row.snapshot_ref for row in value.phases}) == len(value.phases),
        "phase_clock_scoped": len({row.clock_ref for row in value.phases}) == 1
            and len({row.temporal_scope_ref for row in value.phases}) == 1
            and tuple(row.tick for row in ordered) == tuple(sorted(row.tick for row in ordered)),
        "atomic_step_has_no_resume": not native.resume_frontier}))


def unsupported_metric_step(value: MetricStepInputC) -> MetricStepMeasurementC:
    return MetricStepMeasurementC(request=value, native=None, packet=None,
        missing_refs=("unsupported_native_metric_step_signature",),
        facts=FrozenMap({"complete": False, "identity_exact": False, "native_model_contradiction": False,
            "native_bound_reached": False, "missing_evidence": True}))


def decode_metric_step(value: MetricStepDecodeInputC) -> MetricStepMeasurementC:
    request, native = value.request, value.native
    original, output = request.native_request, native.values
    ownership = original.external_ownership
    exact = native.request_identity == request.request
    missing = []
    if not exact:
        missing.append("native_return_identity")
    if (output.get("closure_complete") is not True or native.pending_count != 0
            or native.facts.get("has_missing_observation") is not False
            or native.facts.get("model_contradiction") is not False
            or native.facts.get("bound_reached") is not False):
        missing.append("native_atomic_closure")
    before = metric_current_state_c(original)
    successor, budget, termination = output.get("successor"), output.get("budget_remaining"), output.get("termination")
    if (ownership is None or before is None or not isinstance(successor, FrozenMap)
            or type(budget) is not int or budget < 0
            or termination not in (None, "accepted_target", "budget_terminal", "preexisting_model_terminal")):
        missing.append("native_successor_or_ownership")
    after = FrozenMap({"state": successor, "budget_remaining": budget, "termination": termination})
    ledger = output.get("external_event_ledger")
    cost = output.get("cost")
    if type(cost) is not int or cost < 0:
        missing.append("native_cost")
    events, snapshots = [], {}
    acceptance = False
    if not missing and ownership.pre_terminal:
        if ledger != () or before != after or cost != 0 or output.get("command_applied") is not False:
            missing.append("native_preterminal_identity")
    elif not missing:
        names = ("DIRECT", "AUTOMATIC", "COST", "ACCEPTANCE") if (
            ownership.cost_acceptance_order == "COST_THEN_ACCEPTANCE") else ("DIRECT", "AUTOMATIC", "ACCEPTANCE", "COST")
        if (not isinstance(ledger, tuple) or len(ledger) != 4 or not all(isinstance(row, FrozenMap) for row in ledger)
                or tuple(row.get("phase") for row in ledger) != names
                or cost != ownership.charged_cost or budget != ownership.budget_remaining - cost
                or output.get("additional_k03_phase_or_debit_allowed") is not False
                or output.get("direct_automatic_cost_acceptance_owner_ref") != ownership.event_owner_ref):
            missing.append("native_owned_phase_order_and_cost")
        else:
            bindings = {row.phase: row for row in request.phases}
            previous = FrozenMap({"state": before["state"], "budget_remaining": before["budget_remaining"]})
            for index, row in enumerate(ledger):
                phase = row["phase"]
                start, end = row.get("before"), row.get("after")
                if (not isinstance(start, FrozenMap) or not isinstance(end, FrozenMap) or start != previous
                        or row.get("owner_ref") != ownership.event_owner_ref
                        or row.get("event_ref") != request.primitive_ref + ":" + phase.lower()
                        or set(start) != {"state", "budget_remaining"} or set(end) != {"state", "budget_remaining"}):
                    missing.append("native_phase_continuity")
                    break
                if (phase == "AUTOMATIC" and (start != end
                        or row.get("identity_law_evidence_ref") != ownership.automatic_identity_evidence_ref)):
                    missing.append("native_automatic_identity")
                    break
                if phase == "DIRECT" and (start["budget_remaining"] != end["budget_remaining"]
                        or end["state"] != successor):
                    missing.append("native_direct_without_debit")
                    break
                if phase == "COST" and (row.get("debit") != cost or start["state"] != end["state"]
                        or end["budget_remaining"] != start["budget_remaining"] - cost):
                    missing.append("native_single_cost_phase")
                    break
                if phase == "ACCEPTANCE":
                    comparison = row.get("comparison")
                    if start != end or not isinstance(comparison, FrozenMap) or comparison != output.get("acceptance"):
                        missing.append("native_acceptance_phase")
                        break
                    acceptance = termination == "accepted_target" and comparison.get("terminal") is True
                binding = bindings[phase]
                phase_before = FrozenMap.overlay({"termination": None}, start)
                phase_after = FrozenMap.overlay({"termination": termination if index == 3 else None}, end)
                snapshots[binding.snapshot_ref] = phase_before
                writes = FrozenMap({key: phase_after[key] for key in sorted(phase_after)
                    if phase_after[key] != phase_before[key]})
                events.append(MechanicalEventC(occurrence_ref=binding.occurrence_ref,
                    producer_ref=ownership.event_owner_ref, kind_ref=binding.kind_ref,
                    clock_ref=binding.clock_ref, tick=binding.tick, temporal_scope_ref=binding.temporal_scope_ref,
                    snapshot_ref=binding.snapshot_ref, snapshot_kind=binding.snapshot_kind,
                    reads=phase_before, writes=writes, costs=FrozenMap({"debit": cost}) if phase == "COST" else FrozenMap(),
                    predecessor_refs=(events[-1].occurrence_ref,) if events else (), predicate_values=row,
                    interruption_ref=request.model_interruption_ref if index == 3 and termination is not None else None))
                previous = end
            if previous != FrozenMap({"state": successor, "budget_remaining": budget}):
                missing.append("native_final_state_exact")
    packet = None
    if not missing:
        packet = ExternalPrimitivePacketC(request=request.request, parent_request=request.parent_request,
            model_ref=request.model_ref, action_ref=request.action_ref, primitive_ref=request.primitive_ref,
            before=before, after=after, events=tuple(events), snapshots=FrozenMap(snapshots),
            closure_domain_ref=request.closure_domain_ref, closure_stop_ref=request.closure_stop_ref,
            complete=True, missing_refs=(), cost=cost, terminal=termination is not None,
            acceptance=acceptance, response_ref=request.response_ref)
    return MetricStepMeasurementC(request=request, native=native, packet=packet, missing_refs=tuple(sorted(set(missing))),
        facts=FrozenMap({"complete": packet is not None, "identity_exact": exact,
            "native_model_contradiction": native.facts.get("model_contradiction") is True,
            "native_bound_reached": native.facts.get("bound_reached") is True,
            "missing_evidence": bool(missing)}))


def assemble_metric_step_response(value: MetricStepResponseInputC) -> MechanicalResponseInput:
    measured = value.measured
    return MechanicalResponseInput(request=measured.request.request,
        returned_identity=measured.native.request_identity if measured.native is not None else measured.request.request,
        source_status=value.source_status, returned_type="metric_stack_image.result.v1", missing_cause=value.missing_cause,
        descriptive_values=FrozenMap({"exact_packet": packet_payload(measured.packet),
            "missing_refs": measured.missing_refs, "native_return": metric_model_payload_c(measured.native)}))


def finish_metric_step(value: MetricStepFinishInputC) -> MetricStepDispatchC:
    return MetricStepDispatchC(packet=value.measured.packet, normalized=value.normalized, native=value.measured.native)
