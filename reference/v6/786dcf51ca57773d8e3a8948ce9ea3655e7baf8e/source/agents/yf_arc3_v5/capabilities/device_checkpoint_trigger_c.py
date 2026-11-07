"""Current one-program result to conditional preparatory query; Source selects it."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .device_checkpoint_c import read_exact_checkpoint_calculation
from .device_solving_contracts_c import DeviceCheckpointTriggerC
from .articulated_dependency_measurement_c import _nodes


def measure_device_checkpoint_trigger(value):
    returned=value.returned;request=returned.frozen_measurement.frozen_input;native=request.native_request
    facts=FrozenMap({'checkpoint_trigger_bound':False})
    if returned.parent_return.get('temporal_compatible_continuation_present') is True:
        return DeviceCheckpointTriggerC(returned=returned,facts=facts)
    if (native.operation_ref!='mechanics.finite_instruction_device.stage_domains' or native.preparatory_domain
            or not native.generate_programs):return DeviceCheckpointTriggerC(returned=returned,facts=facts)
    missing=list(returned.missing_refs)
    result,absent=read_exact_checkpoint_calculation(returned.returned,native);missing.extend(absent)
    if result is None or result.values.get('generated_domain_complete') is not True:
        missing.append('device.trigger_complete_current_known_program_domain')
    elif result.values.get('target_compatible_trial_refs'):
        return DeviceCheckpointTriggerC(returned=returned,facts=facts)
    law=native.model.checkpoint if native.model is not None else None
    if (law is None or law.evidence_ref is None or not law.at_program_end or law.edited_code_retained is not True
            or native.checkpoint_applies is not True or native.rollback_requested is not False):
        missing.append('device.trigger_current_supported_checkpoint_means')
    remaining=request.parent_maximum_evaluations-returned.parent_return.get('accounted_evaluations',0)
    work=_nodes(immutable_json_data(result),max(0,remaining)) if result is not None else 0
    if work is None:missing.append('device.trigger_complete_current_result_projection_bound');work=0
    share=max(0,remaining-work)//2;query=None
    if share<1:missing.append('device.trigger_preparatory_query_parent_work_reservation')
    if not missing:
        scope=native.scope.model_copy(update={'request_ref':'request.device.preparatory.'+stable_digest((native.scope,request.why))})
        query=native.model_copy(update={'scope':scope,'preparatory_domain':True,'resume':None,'maximum_evaluations':min(65536,share)})
    facts=FrozenMap({'checkpoint_trigger_bound':query is not None,'parent_goal_ref':request.why.parent_goal_ref,
        'frozen_why':immutable_json_data(request.why),'known_domain_no_compatible_program':not bool(missing),
        'all_encodings_impossible':False,'query':immutable_json_data(query),'execution_authority':False})
    return DeviceCheckpointTriggerC(returned=returned,query=query,facts=facts,missing_refs=tuple(sorted(set(missing))),accounted_evaluations=work)


def bind_device_checkpoint_trigger(value):return value.measured.query


def finish_device_checkpoint_trigger(value):
    measured=value.measured;returned=measured.returned;missing=list((*returned.missing_refs,*measured.missing_refs))
    if measured.query is None:
        if not measured.missing_refs:return returned
        parent=FrozenMap({**dict(returned.parent_return),'missing_refs':tuple(sorted(set(missing))),
            'checkpoint_trigger_reason':measured.facts,'accounted_evaluations':returned.parent_return.get('accounted_evaluations',0)+measured.accounted_evaluations})
        return returned.model_copy(update={'parent_return':parent,'missing_refs':tuple(sorted(set(missing)))})
    result,absent=read_exact_checkpoint_calculation(value.child_return,measured.query);missing.extend(absent)
    work=returned.parent_return.get('accounted_evaluations',0)+measured.accounted_evaluations+(result.examined_count if result is not None else 0)
    if result is not None and result.examined_count>measured.query.maximum_evaluations:
        missing.append('device.trigger_exact_preparatory_child_work_bound')
    if work>returned.frozen_measurement.frozen_input.parent_maximum_evaluations:
        missing.append('device.trigger_global_parent_work_bound')
    parent=FrozenMap({**dict(returned.parent_return),'preparatory_query':immutable_json_data(measured.query),
        'preparatory_return':immutable_json_data(value.child_return),'checkpoint_trigger_reason':measured.facts,
        'missing_refs':tuple(sorted(set(missing))),'accounted_evaluations':work,'execution_authority':False})
    return returned.model_copy(update={'parent_return':parent,'missing_refs':tuple(sorted(set(missing)))})
