"""One configuration/launch packet, carrying the exact beat policy throughout."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .window_processing_d import WindowBeatStateD, WindowReceiverD, TrainRankD, _process_one_beat
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class WindowSettingDomainD(FrozenModel):
    receiver_ref: Ref
    field: Literal['POSITION','WINDOW','FILTER']
    values: tuple[int|str|None,...] = Field(min_length=1,max_length=128)
    fixed: bool


class WindowNativeInputD(FrozenModel):
    input_ref: Ref
    kind: Literal['SELECT','CYCLE','SET','LAUNCH']
    receiver_ref: Ref | None
    field: Literal['POSITION','WINDOW','FILTER'] | None
    cycle_delta: int
    supplied_value: int|str|None
    debit: int = Field(ge=0)


class WindowProcessingPrimitiveRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.window_processing_primitive_request_d.v1'
    phase_ref: Literal['EXTERNAL_WINDOW_SETTING_OR_LAUNCH']
    state: WindowBeatStateD
    domains: tuple[WindowSettingDomainD,...] = Field(default=(),max_length=4096)
    inputs: tuple[WindowNativeInputD,...] = Field(min_length=1,max_length=128)
    native_focus_ref: Ref | None
    bound_input_ref: Ref
    trial_first_beat: int = Field(ge=0)
    trial_last_beat: int = Field(ge=0)
    goal_check_phase: Literal['AFTER_EACH_BEAT','END_TRAVERSAL']
    reset_train_on_failure: bool
    reset_spent_on_failure: bool
    preserve_settings_on_failure: bool
    restored_train: tuple[TrainRankD,...] = Field(default=(),max_length=4096)
    restored_receivers: tuple[WindowReceiverD,...] = Field(default=(),max_length=128)
    remaining_resource: int = Field(ge=0)
    debit_per_beat: int = Field(ge=0)
    goal_boundary_ref: Ref
    failed_trial_event_ref: Ref
    depletion_boundary_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.cadenced_rail_transfer.window_processing_external_primitive','STEP'),
    )

    @model_validator(mode='after')
    def control_domains(self):
        receivers={r.receiver_ref for r in self.state.receivers}
        if self.native_focus_ref is not None and self.native_focus_ref not in receivers or self.trial_last_beat<self.trial_first_beat:
            raise ValueError('selection/trial bounds invalid')
        if len({(d.receiver_ref,d.field) for d in self.domains})!=len(self.domains) or any(d.receiver_ref not in receivers for d in self.domains):
            raise ValueError('native setting domain duplicated or receiver absent')
        for domain in self.domains:
            if len(set(domain.values))!=len(domain.values):raise ValueError('setting value domain duplicated')
            if domain.field in ('POSITION','WINDOW') and any(type(v) is not int or domain.field=='WINDOW' and v<1 for v in domain.values):
                raise ValueError('position/window setting must use its explicit integer domain')
        if self.restored_train and {(u.unit_ref,u.rank) for u in self.restored_train}!={(u.unit_ref,u.rank) for u in self.state.train}:
            raise ValueError('trial reset cannot compact or replace persistent rank identities')
        return self


def measure_window_processing_primitive_d(request: WindowProcessingPrimitiveRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.state.train),len(request.domains),sum(r.window_size for r in request.state.receivers))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_COUNTERFACTUAL_WINDOW_PACKET')
    budget=DWorkBudget(request)
    try:
        bound=next((i for i in request.inputs if i.input_ref==request.bound_input_ref),None)
        if bound is None:return d_result(request,'NEEDS_EVIDENCE','NATIVE_WINDOW_INPUT_NOT_BOUND')
        state=request.state
        focus=request.native_focus_ref
        resource=request.remaining_resource-bound.debit
        ledger=[]
        cause='CONFIGURATION_UNCHANGED'
        boundary=None
        failed=None
        beats=0
        if bound.kind=='SELECT':
            if bound.receiver_ref not in {r.receiver_ref for r in state.receivers}:
                return d_result(request,'NEEDS_EVIDENCE','NATIVE_SELECTION_PAYLOAD_NOT_BOUND')
            focus=bound.receiver_ref
            cause='RECEIVER_SELECTED_WITHOUT_EDIT'
        elif bound.kind in ('CYCLE','SET'):
            ref=bound.receiver_ref if bound.receiver_ref is not None else focus
            domain=next((d for d in request.domains if d.receiver_ref==ref and d.field==bound.field),None)
            receiver=next((r for r in state.receivers if r.receiver_ref==ref),None)
            if domain is None or receiver is None:return d_result(request,'NEEDS_EVIDENCE','NATIVE_SETTING_FIELD_NOT_BOUND')
            if domain.fixed:
                cause='FIXED_FIELD_PRESERVED'
            else:
                current=(receiver.first_rank_at_beat_zero if bound.field=='POSITION' else receiver.window_size if bound.field=='WINDOW'
                    else receiver.admitted_color_refs[0] if receiver.admitted_color_refs is not None and len(receiver.admitted_color_refs)==1 else None)
                if current not in domain.values:return d_result(request,'NEEDS_EVIDENCE','CURRENT_FIELD_NOT_IN_EVIDENCED_CYCLE')
                value=(domain.values[(domain.values.index(current)+bound.cycle_delta)%len(domain.values)] if bound.kind=='CYCLE' else bound.supplied_value)
                if value not in domain.values:return d_result(request,'NEEDS_EVIDENCE','SETTING_VALUE_NOT_ADMITTED')
                update=({'first_rank_at_beat_zero':value} if bound.field=='POSITION' else {'window_size':value} if bound.field=='WINDOW'
                    else {'admitted_color_refs':None if value is None else (value,)})
                receiver=receiver.model_copy(update=update)
                state=state.model_copy(update={'receivers':tuple(receiver if r.receiver_ref==ref else r for r in state.receivers)})
                cause='ONE_NATIVE_FIELD_EDIT'
        else:
            for beat in range(request.trial_first_beat,request.trial_last_beat+1):
                if beats>=request.depth_bound:raise DComputationInterrupted('TRAVERSAL_BEAT_BOUND',{'next_beat':beat})
                budget.visit({'stage':'owned_fixed_rank_transport_beat','beat':beat})
                state=state.model_copy(update={'beat':beat,'current_pulses':()})
                state,events=_process_one_beat(state,budget,request.depth_bound)
                ledger.append({'beat':beat,'visitation_policy':state.visitation_policy,'ledger':events})
                resource-=request.debit_per_beat
                beats+=1
                exact=bool(state.train) and all(u.captured for u in state.train)
                if request.goal_check_phase=='AFTER_EACH_BEAT' and exact:
                    boundary=request.goal_boundary_ref
                    break
                if resource<0:
                    boundary=request.depletion_boundary_ref
                    break
            exact=bool(state.train) and all(u.captured for u in state.train)
            if boundary is None and exact:boundary=request.goal_boundary_ref
            if boundary is None:
                failed=request.failed_trial_event_ref
                update={}
                if request.reset_train_on_failure:
                    if not request.restored_train:return d_result(request,'NEEDS_EVIDENCE','TRIAL_TRAIN_RESET_NOT_BOUND',examined=budget.examined)
                    update['train']=request.restored_train
                if request.reset_spent_on_failure:update['spent_for_run_refs']=()
                if not request.preserve_settings_on_failure:
                    if not request.restored_receivers:return d_result(request,'NEEDS_EVIDENCE','TRIAL_SETTINGS_RESET_NOT_BOUND',examined=budget.examined)
                    update['receivers']=request.restored_receivers
                update['current_pulses']=()
                state=state.model_copy(update=update)
            cause='ONE_COMPLETE_LAUNCH_TRAVERSAL'
        budget.finish()
        return d_result(request,'COMPLETE',cause,complete=True,examined=budget.examined,values={
            'state':state,'native_focus_ref':focus,'beat_ledger':tuple(ledger),'boundary_ref':boundary,
            'failed_trial_event_ref':failed,'remaining_resource':resource,'command_debit':bound.debit,'beat_debit_total':beats*request.debit_per_beat,
            'beat_count':beats,'external_input_count':1,'complete_response_boundary_count':1,'additional_world_beat_added':False,
            'captured_ranks_compacted':False,'earlier_skipped_receiver_rescanned_in_single_pass':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_counterfactual_packet':True,'actual_parent_command_redebited':False,'work':error.frontier})
