"""Current known-domain failure to conditional timing query, no action release."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .device_checkpoint_c import read_exact_checkpoint_calculation
from .device_solving_contracts_c import DeviceCheckpointTriggerC
from .articulated_dependency_measurement_c import _nodes


def measure_device_temporal_trigger(value):
    returned=value.returned;request=returned.frozen_measurement.frozen_input;native=request.native_request
    facts=FrozenMap({'temporal_trigger_bound':False})
    if (native.operation_ref!='mechanics.finite_instruction_device.stage_domains' or native.derive_temporal_starts
            or native.model is None or native.model.hazard_schedule is None or not native.generate_programs):
        return DeviceCheckpointTriggerC(returned=returned,facts=facts)
    result,absent=read_exact_checkpoint_calculation(returned.returned,native)
    missing=list((*returned.missing_refs,*absent))
    if result is None or result.values.get('generated_domain_complete') is not True:
        missing.append('device.temporal_trigger_complete_current_known_domain')
    elif result.values.get('target_compatible_trial_refs'):
        return DeviceCheckpointTriggerC(returned=returned,facts=facts)
    remaining=request.parent_maximum_evaluations-returned.parent_return.get('accounted_evaluations',0)
    work=_nodes(result.values,max(0,remaining)) if result is not None else 0
    if work is None:missing.append('device.temporal_trigger_complete_projection_bound');work=0
    query=None;share=max(0,remaining-work)//2
    if share<1:missing.append('device.temporal_trigger_reserved_parent_work')
    if not missing:
        scope=native.scope.model_copy(update={'request_ref':'request.device.temporal.'+stable_digest((native.scope,request.why,native.model.hazard_schedule))})
        query=native.model_copy(update={'scope':scope,'derive_temporal_starts':True,'trial_start_clocks':(),
            'resume':None,'maximum_evaluations':min(65536,share)})
    return DeviceCheckpointTriggerC(returned=returned,query=query,
        facts=FrozenMap({'temporal_trigger_bound':query is not None,'known_domain_without_target':not bool(missing),
            'parent_goal_ref':request.why.parent_goal_ref,'frozen_why':immutable_json_data(request.why),
            'all_encodings_impossible':False,'execution_authority':False}),
        missing_refs=tuple(sorted(set(missing))),accounted_evaluations=work)


def finish_device_temporal_trigger(value):
    measured=value.measured;returned=measured.returned
    if measured.query is None and not measured.missing_refs:return returned
    missing=list((*returned.missing_refs,*measured.missing_refs));result=None
    if measured.query is not None:
        result,absent=read_exact_checkpoint_calculation(value.child_return,measured.query);missing.extend(absent)
    work=returned.parent_return.get('accounted_evaluations',0)+measured.accounted_evaluations+(result.examined_count if result is not None else 0)
    if result is not None and result.examined_count>measured.query.maximum_evaluations:
        missing.append('device.temporal_trigger_exact_child_work_bound')
    if work>returned.frozen_measurement.frozen_input.parent_maximum_evaluations:missing.append('device.temporal_trigger_global_work_bound')
    parent=FrozenMap({**dict(returned.parent_return),'temporal_query':immutable_json_data(measured.query),
        'temporal_return':immutable_json_data(value.child_return),'temporal_trigger_reason':measured.facts,
        'missing_refs':tuple(sorted(set(missing))),'accounted_evaluations':work,'execution_authority':False})
    return returned.model_copy(update={'parent_return':parent,'missing_refs':tuple(sorted(set(missing)))})
