"""Exact K09 stage-cost request/return transport, without release authority."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data


def bind_device_stage_cost_query(value):
    if not value.measured.facts.get("stage_cost_bound"):
        raise ValueError("Source must select the missing-cost branch before binding K09")
    return value.measured.returned.frozen_measurement.frozen_input.stage_cost_source.query


def finish_device_stage_cost(value):
    measured=value.measured
    returned=measured.returned
    request=returned.frozen_measurement.frozen_input
    source=request.stage_cost_source
    missing=list((*returned.missing_refs,*measured.missing_refs))
    result=value.result
    if result is not None:
        if source is None or result.request!=source.query:
            missing.append("device.exact_requested_K09_stage_cost_return");result=None
        elif result.bounded or not result.complete or result.missing_refs:
            missing.extend(result.missing_refs)
            missing.append("device.K09_stage_cost_domain_remains_unfinished")
    elif measured.facts.get("stage_cost_bound"):
        missing.append("device.requested_K09_stage_cost_result_absent")
    work=returned.parent_return.get("accounted_evaluations",0)+measured.accounted_evaluations
    if result is not None:work+=result.examined_count
    if work>request.parent_maximum_evaluations:missing.append("device.stage_cost_global_parent_work_bound")
    parent=FrozenMap({**dict(returned.parent_return),"stage_cost_rows":measured.rows,
        "stage_cost_result":immutable_json_data(result) if result is not None else None,
        "stage_cost_metric":"external_primitive_count","staged_cost_measured":result is not None and result.complete and not result.bounded,
        "missing_refs":tuple(sorted(set(missing))),"accounted_evaluations":work,
        "checkpoint_next_program_feasibility_not_inferred":returned.parent_return.get("checkpoint_next_program_feasibility_not_inferred",True),
        "execution_authority":False})
    return returned.model_copy(update={"stage_cost_result":result,"parent_return":parent,"missing_refs":tuple(sorted(set(missing)))})
