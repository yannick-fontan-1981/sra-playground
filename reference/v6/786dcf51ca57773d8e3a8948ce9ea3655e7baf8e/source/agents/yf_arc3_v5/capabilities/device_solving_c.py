"""K28 parent request/return transport. Computation and ACT stay with their owners."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .finite_instruction_device import DEVICE_OPERATION_MODES
from .device_solving_contracts_c import DeviceSolvingFactsC,DeviceSolvingReturnC,DeviceJoinFactsC
from .mechanical_return_a import mechanical_request_identity_a
from .family_agenda_projection import project_family_agenda,demand_signature,FamilyAgendaReceipt
from .mechanical_family_contracts_a import MechanicalFamilyResult


def measure_device_solving(request,agenda_rows,reasons,missing_refs):
    native,why,demand=request.native_request,request.why,request.demand
    missing=list(missing_refs)
    identity=mechanical_request_identity_a(native,"mechanics.finite_instruction_device",native.scope,native.operation_ref,native.mode)
    if (demand.request!=identity or demand not in request.agenda.demands or native.scope.parent_goal_ref!=why.parent_goal_ref
            or demand.parent_goal_ref!=why.parent_goal_ref or demand.consumer_ref!=why.consumer_ref
            or demand.episode_ref!=why.episode_ref or demand.level_scope_ref!=why.level_scope_ref
            or not why.desired_future or not why.usefulness_premise_refs or not why.morphology_premise_refs
            or not why.falsifier_ref):missing.append("device.exact_goal_owned_question_and_why")
    if (len(agenda_rows)!=1 or agenda_rows[0].get("family_agenda")!=immutable_json_data(request.agenda)
            or not agenda_rows[0].get("supported_agenda_claim_refs")):missing.append("device.current_canonical_agenda")
    rows=tuple(row for row in project_family_agenda(request.agenda)["rows"]
        if row["signature_ref"]==demand_signature(demand) and row["demand"]["request"]["request_ref"]==identity.request_ref)
    if (len(rows)!=1 or not rows[0]["owner_current"] or not rows[0]["current_inputs_bound"]
            or not rows[0]["prerequisites_current"] or rows[0]["conflicting_current_returns"]
            or rows[0]["consumed_current_signature"]):missing.append("device.next_prerequisite_satisfied_unconsumed_question")
    operation=native.operation_ref.removeprefix("mechanics.finite_instruction_device.")
    if native.mode not in DEVICE_OPERATION_MODES.get(operation,()):missing.append("device.exact_registered_K28_operation_and_mode")
    if native.maximum_evaluations>request.parent_maximum_evaluations:
        missing.append("device.parent_reserves_requested_native_bound")
    if native.generate_programs and operation!='stage_domains':
        missing.append("device.program_generation_only_declared_inverse_domain")
    if native.preparatory_domain and (operation!='stage_domains' or native.model is None or native.model.checkpoint is None):
        missing.append("device.preparatory_domain_requires_current_checkpoint_inverse_question")
    if native.derive_temporal_starts and (operation!='stage_domains' or native.model is None or native.model.hazard_schedule is None):
        missing.append("device.temporal_start_derivation_requires_current_hazard_inverse_question")
    if native.model is not None:
        if native.state is not None and native.state.region_ref!=native.model.real_region_ref:
            missing.append("device.real_state_region_is_not_demonstration_region")
        if operation in ("typed_match","program_successor","stage_domains"):
            if native.model.target is None or why.desired_future.get("device_target")!=immutable_json_data(native.model.target):
                missing.append("device.target_requirements_equal_parent_desired_future")
    return DeviceSolvingFactsC(frozen_input=request,facts=FrozenMap({"current_device_question":not bool(missing),
        "program_generation_requested":native.generate_programs,"requested_operation_ref":native.operation_ref,
        "preparatory_domain_requested":native.preparatory_domain,
        "temporal_start_derivation_requested":native.derive_temporal_starts,
        "isolation_rows":tuple(row for row in reasons if row.get("isolation_candidate") is True)}),
        reasons=(*reasons,FrozenMap({"frozen_why":immutable_json_data(why),"exact_demand":immutable_json_data(demand),
            "demo_world_is_real_progress":False,"whole_word_semantics":True,"physical_action_release":False})),
        missing_refs=tuple(sorted(set(missing))))


def bind_device_solving(value):
    if value.measured.missing_refs:raise ValueError("Source must select the information branch before binding K28")
    return value.measured.frozen_input.native_request


def finish_device_solving(value):
    measured=value.measured
    request=measured.frozen_input
    missing=list(measured.missing_refs)
    result=None
    receipt=FrozenMap()
    if value.returned is not None:
        if value.returned.request!=request.demand.request:missing.append("device.exact_native_return_identity")
        else:
            try:result=MechanicalFamilyResult.model_validate(value.returned.descriptive_values.get("calculation"))
            except (ValidationError,TypeError,ValueError):missing.append("device.actual_typed_K28_calculation")
            if result is not None and (result.scope!=request.native_request.scope or result.operation_ref!=request.native_request.operation_ref
                    or result.mode!=request.native_request.mode):
                missing.append("device.actual_native_scope_operation_mode");result=None
            if result is not None and not missing:
                receipt=immutable_json_data(FamilyAgendaReceipt(receipt_ref="receipt.device_solving."+stable_digest((request.demand,value.returned)),
                    demand=request.demand,result=value.returned))
                missing.extend(result.prerequisite_refs)
                missing.extend(result.implementation_debt_refs)
                if not result.signature_supported:missing.append("device.unsupported_native_signature")
    elif not missing:missing.append("device.requested_K28_result_absent")
    parent=FrozenMap({"parent_goal_ref":request.why.parent_goal_ref,"consumer_ref":request.why.consumer_ref,
        "next_item_ref":request.why.next_item_ref,"frozen_why":immutable_json_data(request.why),
        "exact_demand":immutable_json_data(request.demand),"receipt":receipt,
        "calculation":immutable_json_data(result) if result is not None else None,
        "acquisition_work":measured.acquisition_work,
        "accounted_evaluations":measured.acquisition_work+(result.examined_count if result is not None else 0),
        "missing_refs":tuple(sorted(set(missing))),"preservation_refs":request.why.preservation_refs,
        "principal_goal_changed":False,"physical_satisfaction":False,"execution_authority":False})
    return DeviceSolvingReturnC(frozen_measurement=measured,returned=value.returned,missing_refs=tuple(sorted(set(missing))),
        receipt=receipt,parent_return=parent)


def measure_device_join(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    join=request.join_request
    missing=list(returned.missing_refs)
    packet=returned.parent_return.get("calculation")
    if returned.parent_return.get("current_device_reconciliation_needs"):
        missing.append("device.current_parent_reconciliation_need_before_composition")
    if join is not None:
        if (not isinstance(packet,FrozenMap) or packet.get("domain_complete") is not True
                or packet.get("signature_supported") is not True or packet.get("computation_bound_reached") is True):
            missing.append("device.complete_supported_native_domain_for_composition")
        own=tuple(candidate for group in join.groups for candidate in group.candidates
            if candidate.result.request==request.demand.request)
        if (returned.returned is None or returned.returned.status!="FOUND" or join.parent_goal_ref!=request.why.parent_goal_ref
                or join.epoch!=request.native_request.scope.epoch or join.episode_ref!=request.why.episode_ref
                or join.level_scope_ref!=request.why.level_scope_ref or len(own)!=1 or own[0].result!=returned.returned
                or not set(request.why.preservation_refs)<=set(own[0].preservation_refs)
                or own[0].rationale.get("desired_predicate")!=request.why.desired_future
                or own[0].rationale.get("consumer_ref")!=request.why.consumer_ref
                or own[0].rationale.get("and_dependency_refs")!=request.why.and_dependency_refs
                or own[0].rationale.get("or_dependency_refs")!=request.why.or_dependency_refs
                or own[0].rationale.get("falsifier_ref")!=request.why.falsifier_ref):
            missing.append("device.exact_current_complete_composition_question")
    return DeviceJoinFactsC(facts=FrozenMap({"join_bound":join is not None and not bool(missing)}),missing_refs=tuple(sorted(set(missing))))


def get_device_join(value):return value.returned.frozen_measurement.frozen_input.join_request


def finish_device_join(value):
    missing=list((*value.returned.missing_refs,*value.measured.missing_refs))
    joined=value.joined
    if joined is not None and joined.request!=value.returned.frozen_measurement.frozen_input.join_request:
        missing.append("device.exact_current_join_return");joined=None
    parent=FrozenMap({**dict(value.returned.parent_return),"joined":immutable_json_data(joined) if joined is not None else None,
        "missing_refs":tuple(sorted(set(missing))),"execution_authority":False})
    return value.returned.model_copy(update={"joined":joined,"missing_refs":tuple(sorted(set(missing))),"parent_return":parent})


def join_device_execution(value):
    measured,execution=value.measured,value.execution
    request=measured.frozen_input
    missing=list((*measured.missing_refs,*execution.missing_refs))
    if execution.request!=request:missing.append("device.execution_exact_parent_publication_return")
    work=measured.acquisition_work+execution.accounted_evaluations
    if work+request.native_request.maximum_evaluations>request.parent_maximum_evaluations:
        missing.append("device.execution_publication_reserves_native_budget")
    return measured.model_copy(update={"acquisition_work":work,"missing_refs":tuple(sorted(set(missing))),
        "facts":FrozenMap({**dict(measured.facts),"current_device_question":not bool(missing)}),
        "reasons":(*measured.reasons,FrozenMap({"actual_execution_rows":execution.rows,
            "execution_missing_refs":execution.missing_refs,"execution_acquisition_work":execution.accounted_evaluations}))})
