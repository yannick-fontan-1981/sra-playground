"""Exact two-stage calculation return transport; no release or second simulator."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from agents.yf_arc3_v5.drm.meaning import DeclaredMeaningInstantiation
from .device_solving_contracts_c import DeviceEvidenceRowsC
from .device_checkpoint_c import read_exact_checkpoint_calculation
from .articulated_dependency_measurement_c import _nodes


def bind_device_strategy_query(value):return value.measured.next_queries[value.index]


def start_device_strategy_meanings(value):return DeviceEvidenceRowsC()


def append_device_strategy_result(value):
    measured=value.measured;query=measured.next_queries[value.index]
    result,missing=read_exact_checkpoint_calculation(value.next_return,query)
    missing=list(missing)
    request=measured.returned.frozen_measurement.frozen_input
    remaining=request.parent_maximum_evaluations-measured.returned.parent_return.get('accounted_evaluations',0)-measured.accounted_evaluations
    if result is not None and result.examined_count>query.maximum_evaluations:missing.append('device.strategy_child_return_work_bound')
    rows=result.values.get('stage_fragments',()) if result is not None else ()
    projection=_nodes(rows,max(0,remaining-(result.examined_count if result is not None else 0)))
    if projection is None:
        missing.append('device.strategy_complete_next_return_projection_bound');rows=();projection=0
    if result is not None and result.values.get('generated_domain_complete') is not True:
        missing.append('device.strategy_complete_generated_next_program_domain')
    viable=tuple(row for row in rows if row.get('typed_target_compatible') is True
        and row.get('program_validation_boundary_reached') is True and not row.get('missing_refs')) if not missing else ()
    row=FrozenMap({'preparatory_trial_ref':measured.preparatory_rows[value.index]['trial_ref'],
        'projection_ref':stable_digest((query,measured.preparatory_rows[value.index]['trial_ref'])),
        'parent_goal_ref':measured.returned.frozen_measurement.frozen_input.why.parent_goal_ref,
        'frozen_why':immutable_json_data(measured.returned.frozen_measurement.frozen_input.why),
        'evidence_refs':tuple(sorted(set((query.scope.request_ref,*measured.facts.get('strategy_acquisition_evidence_refs',()))))),
        'existing_term_refs':(query.scope.parent_goal_ref,),
        'preparatory_state':measured.preparatory_rows[value.index]['after_state'],
        'next_query':immutable_json_data(query),'next_return':immutable_json_data(value.next_return),
        'next_programs':viable,'next_domain_complete':not bool(missing),'target_compatible_next_program_exists':bool(viable) if not missing else None,
        'missing_refs':tuple(sorted(set(missing))),'execution_authority':False})
    work=measured.accounted_evaluations+(result.examined_count if result is not None else 0)+projection
    return measured.model_copy(update={'result_rows':(*measured.result_rows,row),'accounted_evaluations':work,
        'missing_refs':tuple(sorted(set((*measured.missing_refs,*missing))))})


def finish_device_strategy(value):
    measured=value.measured;returned=measured.returned;missing=list((*returned.missing_refs,*measured.missing_refs))
    if (returned.frozen_measurement.frozen_input.checkpoint_strategy_source is None
            and returned.parent_return.get('preparatory_query') is None):return returned
    if len(measured.result_rows)!=len(measured.next_queries):missing.append('device.strategy_complete_next_domain_return_population')
    expected={row['projection_ref']:row for row in measured.result_rows};seen=set()
    for receipt in value.meanings:
        try:meaning=DeclaredMeaningInstantiation.model_validate(receipt)
        except (ValidationError,TypeError,ValueError):missing.append('device.strategy_typed_declared_meaning');continue
        row=expected.get(meaning.facts.get('projection_ref'))
        if (row is None or row['projection_ref'] in seen or meaning.rule_ref!='rule.device_checkpoint_strategy_c'
                or not meaning.template_iteration_complete
                or any(meaning.facts.get(key)!=item for key,item in sorted(row.items()))):
            missing.append('device.strategy_exact_declared_meaning');continue
        seen.add(row['projection_ref'])
    if seen!=set(expected):missing.append('device.strategy_complete_meaning_population')
    work=returned.parent_return.get('accounted_evaluations',0)+measured.accounted_evaluations
    if work>returned.frozen_measurement.frozen_input.parent_maximum_evaluations:missing.append('device.strategy_global_parent_work_bound')
    parent=FrozenMap({**dict(returned.parent_return),'generated_checkpoint_strategies':measured.result_rows,
        'checkpoint_strategy_meanings':value.meanings,
        'checkpoint_strategy_complete':not bool(missing),'checkpoint_strategy_is_conditional':True,
        'missing_refs':tuple(sorted(set(missing))),'accounted_evaluations':work,'execution_authority':False})
    return returned.model_copy(update={'parent_return':parent,'missing_refs':tuple(sorted(set(missing)))})
