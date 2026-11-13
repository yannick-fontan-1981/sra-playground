"""Exact K28 temporal trial domain projection and declared-result transport."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from agents.yf_arc3_v5.drm.meaning import DeclaredMeaningInstantiation
from .device_solving_contracts_c import DeviceEvidenceRowsC
from .device_checkpoint_c import read_exact_checkpoint_calculation
from .articulated_dependency_measurement_c import _nodes
from .finite_instruction_device import DeviceRequest
from .mechanical_request_contracts import MechanicalNormalizedReturn


def measure_device_temporal_windows(value):
    returned=value.returned;request=returned.frozen_measurement.frozen_input;native=request.native_request
    if (native.model is None or native.model.hazard_schedule is None or native.operation_ref!='mechanics.finite_instruction_device.stage_domains'):
        return DeviceEvidenceRowsC()
    packet=returned.returned
    if returned.parent_return.get('temporal_query') is not None:
        try:
            native=DeviceRequest.model_validate(returned.parent_return['temporal_query'])
            packet=MechanicalNormalizedReturn.model_validate(returned.parent_return['temporal_return'])
        except (ValidationError,TypeError,ValueError):return DeviceEvidenceRowsC(missing_refs=('device.temporal_exact_derived_query_return_transport',))
    result,missing=read_exact_checkpoint_calculation(packet,native)
    if missing:return DeviceEvidenceRowsC(missing_refs=missing)
    available=request.parent_maximum_evaluations-returned.parent_return.get('accounted_evaluations',0)
    work=_nodes(result.values,max(0,available))
    if work is None:return DeviceEvidenceRowsC(missing_refs=('device.temporal_complete_trial_projection_work',))
    rows=[]
    for fragment in result.values.get('stage_fragments',()):
        complete=(not fragment.get('missing_refs') and fragment.get('program_validation_boundary_reached') is True)
        matched=fragment.get('typed_target_compatible') is True
        failed_phases=tuple(FrozenMap({'slot_ref':event.get('slot_ref'),'phase':event.get('phase'),
            'clock':event.get('clock'),'actor':event.get('actor'),'status':event.get('status')})
            for event in fragment['events'] if event.get('status')=='FAILED')
        rows.append(FrozenMap({'projection_ref':stable_digest((native.scope,fragment['trial_ref'])),
            'parent_goal_ref':request.why.parent_goal_ref,'frozen_why':immutable_json_data(request.why),
            'trial_ref':fragment['trial_ref'],'candidate_ref':fragment['candidate_ref'],
            'start_position':fragment['trial_start_position'],'start_clock':fragment['trial_start_clock'],
            'program':fragment['program_before'],'full_program_events':fragment['events'],
            'complete_safe_target_trial':complete and matched,
            'typed_target_compatible':matched,'full_program_status':fragment.get('full_program_status'),
            'first_failed_phase':failed_phases[0] if failed_phases else None,
            'failure_phase_population':failed_phases,
            'start_requires_reachability_or_wait':fragment['trial_start_requires_existing_reachability_and_waiting_guard'],
            'schedule_ref':native.model.hazard_schedule.schedule_ref,'schedule_digest':stable_digest(native.model.hazard_schedule),
            'evidence_refs':(native.scope.request_ref,native.model.hazard_schedule.evidence_ref),
            'existing_term_refs':(request.why.parent_goal_ref,),'execution_authority':False}))
    if len(rows)>128:return DeviceEvidenceRowsC(missing_refs=('device.temporal_complete_trial_meaning_population_bound',),accounted_evaluations=work)
    return DeviceEvidenceRowsC(rows=tuple(rows),accounted_evaluations=work)


def seal_device_temporal_windows(value):
    returned=value.returned;missing=list((*returned.missing_refs,*value.measured.missing_refs));expected={row['projection_ref']:row for row in value.measured.rows};seen=set()
    native=returned.frozen_measurement.frozen_input.native_request
    if (native.model is None or native.model.hazard_schedule is None or native.operation_ref!='mechanics.finite_instruction_device.stage_domains'):
        return returned
    if len(expected)!=len(value.measured.rows):missing.append('device.temporal_unique_trial_projection_identity')
    for receipt in value.meanings:
        try:meaning=DeclaredMeaningInstantiation.model_validate(receipt)
        except (ValidationError,TypeError,ValueError):missing.append('device.temporal_typed_window_meaning');continue
        row=expected.get(meaning.facts.get('projection_ref'))
        if (row is None or row['projection_ref'] in seen or meaning.rule_ref!='rule.device_temporal_windows_c'
                or not meaning.template_iteration_complete or any(meaning.facts.get(key)!=item for key,item in sorted(row.items()))):
            missing.append('device.temporal_exact_trial_meaning');continue
        seen.add(row['projection_ref'])
    if seen!=set(expected):missing.append('device.temporal_complete_trial_meaning_population')
    work=returned.parent_return.get('accounted_evaluations',0)+value.measured.accounted_evaluations
    if work>returned.frozen_measurement.frozen_input.parent_maximum_evaluations:missing.append('device.temporal_global_parent_work_bound')
    parent=FrozenMap({**dict(returned.parent_return),'temporal_window_meanings':value.meanings,
        'temporal_compatible_continuation_present':not bool(missing) and any(row['complete_safe_target_trial'] for row in value.measured.rows),
        'temporal_trial_domain_complete':not bool(missing),'missing_refs':tuple(sorted(set(missing))),
        'accounted_evaluations':work,'execution_authority':False})
    return returned.model_copy(update={'parent_return':parent,'missing_refs':tuple(sorted(set(missing)))})
