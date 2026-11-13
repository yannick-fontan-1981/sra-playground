"""Join native checkpoint and next-program results without another simulator."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .finite_instruction_device import DeviceState
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .mechanical_return_a import mechanical_request_identity_a
from .device_solving_contracts_c import DeviceCheckpointNextFactsC


def read_exact_checkpoint_calculation(packet,request):
    identity=mechanical_request_identity_a(request,"mechanics.finite_instruction_device",request.scope,request.operation_ref,request.mode)
    if packet is None or packet.request!=identity:return None,("device.checkpoint_exact_requested_native_return",)
    try:result=MechanicalFamilyResult.model_validate(packet.descriptive_values.get("calculation"))
    except (ValidationError,TypeError,ValueError):return None,("device.checkpoint_typed_native_calculation",)
    if (packet.status!="FOUND" or result.scope!=request.scope or result.operation_ref!=request.operation_ref or result.mode!=request.mode
            or not result.signature_supported or not result.domain_complete or result.computation_bound_reached
            or result.prerequisite_refs or result.implementation_debt_refs):
        return result,tuple(sorted(set((*result.prerequisite_refs,*result.implementation_debt_refs,"device.checkpoint_complete_supported_child_domain"))))
    return result,()


def bind_device_checkpoint_request(value):
    if not value.measured.facts.get("checkpoint_bound"):raise ValueError("Source must return current checkpoint Needs before binding")
    return value.measured.plan.checkpoint_request


def measure_device_next_program(value):
    measured=value.measured;plan=measured.plan
    missing=list(measured.missing_refs)
    if plan is None or value.checkpoint_return is None:
        raise ValueError("Source must bind a current checkpoint request before reading its return")
    result,absent=read_exact_checkpoint_calculation(value.checkpoint_return,plan.checkpoint_request)
    missing.extend(absent)
    state=None
    if not absent:
        try:state=DeviceState.model_validate(result.values.get("after_state"))
        except (ValidationError,TypeError,ValueError):missing.append("device.checkpoint_complete_saved_restored_state")
    if state is not None:
        if state.saved_actor is None and not state.saved_properties:missing.append("device.checkpoint_not_a_transient_arrival")
        if plan.next_program_request.state is None:
            missing.append("device.checkpoint_exact_next_start_state")
        else:
            # Program edits have their separately acquired preservation law.
            # Every other state axis, including budget/clock/save, stays exact.
            differences=tuple(name for name in sorted(type(state).model_fields) if name!="program"
                and getattr(state,name)!=getattr(plan.next_program_request.state,name))
            if differences:missing.append("device.checkpoint_next_start_after_partial_restore_and_code_preservation")
    return DeviceCheckpointNextFactsC(measured=measured,checkpoint_return=value.checkpoint_return,
        facts=FrozenMap({"next_program_bound":not bool(missing),"checkpoint_state":immutable_json_data(state)}),
        missing_refs=tuple(sorted(set(missing))))


def bind_device_next_program(value):
    if not value.measured.facts.get("next_program_bound"):raise ValueError("Source must preserve missing next-start constraints")
    return value.measured.measured.plan.next_program_request


def finish_device_checkpoint(value):
    next_measured=value.measured
    measured=next_measured.measured;returned=measured.returned;plan=measured.plan
    request=returned.frozen_measurement.frozen_input
    missing=list((*returned.missing_refs,*next_measured.missing_refs))
    result=None;feasible=False;work=returned.parent_return.get("accounted_evaluations",0)+measured.accounted_evaluations
    checkpoint,absent=read_exact_checkpoint_calculation(next_measured.checkpoint_return,plan.checkpoint_request)
    missing.extend(absent)
    if checkpoint is not None:work+=checkpoint.examined_count
    if value.next_return is not None:
        result,absent=read_exact_checkpoint_calculation(value.next_return,plan.next_program_request)
        missing.extend(absent)
        if result is not None:work+=result.examined_count
        if not absent:
            try:after=DeviceState.model_validate(result.values.get("after_state"))
            except (ValidationError,TypeError,ValueError):after=None
            target=plan.next_program_request.model.target
            if after is None or target is None:missing.append("device.checkpoint_typed_next_program_endpoint_and_target")
            else:
                feasible=(result.values.get("program_validation_boundary_reached") is True and all(
                    getattr(after.actor,name)==getattr(target,name) for name in target.required_properties))
    elif next_measured.facts.get("next_program_bound"):
        missing.append("device.checkpoint_requested_next_program_result_absent")
    if work>request.parent_maximum_evaluations:missing.append("device.checkpoint_global_parent_work_bound")
    parent=FrozenMap({**dict(returned.parent_return),"checkpoint_continuation":FrozenMap({"candidate_ref":plan.candidate_ref,
        "preparatory_trial_ref":plan.preparatory_trial_ref,
        "checkpoint_state":next_measured.facts.get("checkpoint_state"),"next_program_return":immutable_json_data(value.next_return),
        "next_program_feasible":feasible if not missing else None,"official_success_inferred":False,
        "observed_slot_refs":measured.facts.get("observed_slot_refs",()),"frozen_why":immutable_json_data(request.why)}),
        "checkpoint_next_program_feasibility_not_inferred":bool(missing),"missing_refs":tuple(sorted(set(missing))),
        "accounted_evaluations":work,"execution_authority":False})
    return returned.model_copy(update={"parent_return":parent,"missing_refs":tuple(sorted(set(missing)))})


def missing_device_checkpoint(value):
    measured=value.measured;returned=measured.returned
    missing=tuple(sorted(set((*returned.missing_refs,*measured.missing_refs))))
    parent=FrozenMap({**dict(returned.parent_return),"checkpoint_continuation":None,
        "checkpoint_next_program_feasibility_not_inferred":True,"missing_refs":missing,
        "accounted_evaluations":returned.parent_return.get("accounted_evaluations",0)+measured.accounted_evaluations,
        "execution_authority":False})
    return returned.model_copy(update={"parent_return":parent,"missing_refs":missing})
