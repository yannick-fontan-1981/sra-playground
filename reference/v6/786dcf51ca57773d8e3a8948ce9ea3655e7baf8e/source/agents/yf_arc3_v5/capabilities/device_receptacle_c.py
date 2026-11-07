"""Join current receptor target acquisition into the frozen parent scope."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def join_device_receptacle(value):
    measured=value.measured;receptacle=value.receptacle
    missing=list((*measured.missing_refs,*receptacle.missing_refs))
    if receptacle.request!=measured.frozen_input:missing.append('device.target_exact_receptacle_parent_return')
    work=measured.acquisition_work+receptacle.accounted_evaluations
    if work+measured.frozen_input.native_request.maximum_evaluations>measured.frozen_input.parent_maximum_evaluations:
        missing.append('device.target_receptacle_reserves_native_work')
    return measured.model_copy(update={'acquisition_work':work,'missing_refs':tuple(sorted(set(missing))),
        'facts':FrozenMap({**dict(measured.facts),'current_device_question':not bool(missing)}),
        'reasons':(*measured.reasons,FrozenMap({'derived_receptacle_target':receptacle.facts,'receptacle_missing_refs':receptacle.missing_refs}))})


def join_device_hazard_source(value):
    measured=value.measured;hazard=value.receptacle
    missing=list((*measured.missing_refs,*hazard.missing_refs))
    if hazard.request!=measured.frozen_input:missing.append('device.hazard_exact_acquisition_parent_return')
    work=measured.acquisition_work+hazard.accounted_evaluations
    if work+measured.frozen_input.native_request.maximum_evaluations>measured.frozen_input.parent_maximum_evaluations:
        missing.append('device.hazard_acquisition_reserves_native_work')
    return measured.model_copy(update={'acquisition_work':work,'missing_refs':tuple(sorted(set(missing))),
        'facts':FrozenMap({**dict(measured.facts),'current_device_question':not bool(missing)}),
        'reasons':(*measured.reasons,FrozenMap({'derived_hazard_schedule':hazard.facts,'hazard_missing_refs':hazard.missing_refs}))})
