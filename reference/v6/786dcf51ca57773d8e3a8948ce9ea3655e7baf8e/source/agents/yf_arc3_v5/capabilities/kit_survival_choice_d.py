"""Cost/life facts and exact Source-choice transport; never Python ranking."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .kit_survival_choice_contracts_d import KitSurvivalFactsD,KitSurvivalChoiceReturnD


def bind_kit_survival_choice_d(value):return value


def measure_kit_survival_choices_d(value):
    from .articulated_dependency_measurement_c import _nodes
    from .mechanical_return_a import mechanical_request_identity_a
    choice=value.choice;request=choice.calculation;reply=value.reply;missing=[];rows={}
    size=_nodes(immutable_json_data(value),choice.maximum_projection_nodes)
    if size is None:missing.append('survival.complete_current_witness_projection_bound')
    if (request.operation_ref!='survival_viability' or request.state is None or not request.scope.input_domain_complete
            or reply.request!=mechanical_request_identity_a(request,'mechanics.mutable_kit_survival',request.scope,request.operation_ref,request.mode)):
        missing.append('survival.current_native_scope_and_horizon')
    body=reply.descriptive_values.get('calculation',FrozenMap())
    values=body.get('values',FrozenMap()) if isinstance(body,FrozenMap) else FrozenMap()
    witnesses=values.get('continuation_witnesses',())
    if (len(witnesses)!=len(choice.witness_refs) or len(set(choice.witness_refs))!=len(choice.witness_refs)
            or choice.unresolved_ref in choice.witness_refs or len(witnesses)>3):
        missing.append('survival.exact_current_three_witness_identity_bank')
    if not missing:
        for ref,witness in zip(choice.witness_refs,witnesses):
            state=witness['after_state'];entities=state['entities']
            actor=next((row for row in entities if row['entity_ref']==state['controlled_ref']),None)
            valid=(actor is not None and actor['alive'] and state['status']=='WIN'
                and state['round_clock']>=state['horizon_round']
                and state['level_scope_ref']==request.state.level_scope_ref and state['restore_epoch']==request.state.restore_epoch)
            rows[ref]=FrozenMap({'alternative_ref':ref,'need_row':False,'whole_witness_survives':valid,
                'command_cost':witness['command_cost'],'external_command_count':witness['external_command_count'],
                'final_life':witness['final_life'],'elapsed_rounds':witness['elapsed_rounds'],
                'robust_policy_or_global_minimum_proved':False})
    rows[choice.unresolved_ref]=FrozenMap({'alternative_ref':choice.unresolved_ref,'need_row':True,
        'command_cost':0,'external_command_count':0,'final_life':0,'elapsed_rounds':0})
    return KitSurvivalFactsD(request=value,alternative_refs=tuple(sorted(rows)),alternative_facts=FrozenMap(rows),
        missing_refs=tuple(sorted(set(missing))))


def finish_kit_survival_choice_d(value):
    measured=value.measured;ref=value.source_alternative_ref
    if ref not in measured.alternative_refs:raise ValueError('Source choice must be in the current measured bank')
    witness=None
    if ref!=measured.request.choice.unresolved_ref:
        index=measured.request.choice.witness_refs.index(ref)
        witness=measured.request.reply.descriptive_values['calculation']['values']['continuation_witnesses'][index]
    return KitSurvivalChoiceReturnD(request=measured.request.choice,alternative_facts=measured.alternative_facts,
        missing_refs=measured.missing_refs,source_alternative_ref=ref,witness=witness)
