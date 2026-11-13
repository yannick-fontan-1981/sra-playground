"""Persistent train ranks, exact windows and explicitly licensed beat visitation."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class TrainRankD(FrozenModel):
    unit_ref: Ref
    rank: int
    current_color_ref: Ref
    captured: bool


class WindowReceiverD(FrozenModel):
    receiver_ref: Ref
    first_rank_at_beat_zero: int
    window_size: int = Field(ge=1,le=4096)
    admitted_color_refs: tuple[Ref,...] | None
    maximal_group_required: bool
    required_parent_events: tuple[tuple[Ref,Ref],...] = Field(default=(),max_length=128)
    action: Literal['CAPTURE','PAINT','PULSE']
    paint_color_ref: Ref | None
    event_ref: Ref
    one_use_for_run: bool


class BeatPulseD(FrozenModel):
    receiver_ref: Ref
    event_ref: Ref
    beat: int = Field(ge=0)


class WindowBeatStateD(FrozenModel):
    train: tuple[TrainRankD,...] = Field(default=(),max_length=4096)
    receivers: tuple[WindowReceiverD,...] = Field(min_length=1,max_length=128)
    receiver_order: tuple[Ref,...] = Field(min_length=1,max_length=128)
    spent_for_run_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    current_pulses: tuple[BeatPulseD,...] = Field(default=(),max_length=4096)
    beat: int = Field(ge=0)
    rank_shift_per_beat: int
    visitation_policy: Literal['single_ordered_pass','revisit_to_quiescence']
    revisit_receiver_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    firing_bounds: tuple[tuple[Ref,int],...] = Field(default=(),max_length=128)
    revisit_termination_evidence_ref: Ref | None

    @model_validator(mode='after')
    def persistent_ranks(self):
        ids={r.receiver_ref for r in self.receivers}
        if len({u.unit_ref for u in self.train})!=len(self.train) or len({u.rank for u in self.train})!=len(self.train):
            raise ValueError('train identities/ranks must persist without compaction')
        if len(ids)!=len(self.receivers) or set(self.receiver_order)!=ids or len(self.receiver_order)!=len(ids):
            raise ValueError('receiver visitation order must be supplied exactly')
        if not set(self.spent_for_run_refs+self.revisit_receiver_refs)<=ids:
            raise ValueError('spent/reentry receiver identity absent')
        order={ref:i for i,ref in enumerate(self.receiver_order)}
        for receiver in self.receivers:
            if receiver.action=='PAINT' and receiver.paint_color_ref is None:
                raise ValueError('paint receiver needs its actual output color')
            if any(parent not in ids or order[parent]>=order[receiver.receiver_ref] for parent,_ in receiver.required_parent_events):
                raise ValueError('declared parent dependencies must precede their allowed visits')
        if len(dict(self.firing_bounds))!=len(self.firing_bounds) or any(ref not in ids or bound<1 for ref,bound in self.firing_bounds):
            raise ValueError('revisit firing certificate invalid')
        return self


def _window_eligibility(state,receiver,train,spent,pulses,budget):
    budget.visit({'stage':'exact_rank_window','receiver_ref':receiver.receiver_ref,'beat':state.beat})
    first=receiver.first_rank_at_beat_zero+state.rank_shift_per_beat*state.beat
    ranks=tuple(range(first,first+receiver.window_size))
    by_rank={u.rank:u for u in train}
    reasons=[]
    if receiver.receiver_ref in spent and receiver.one_use_for_run:reasons.append('SINGLE_OPPORTUNITY_ALREADY_SPENT')
    window=[by_rank.get(rank) for rank in ranks]
    if any(u is None or u.captured for u in window):reasons.append('MISSING_OR_CAPTURED_FIXED_RANK')
    else:
        colors={u.current_color_ref for u in window}
        if len(colors)!=1:reasons.append('WINDOW_NOT_HOMOGENEOUS')
        else:
            color=window[0].current_color_ref
            if receiver.admitted_color_refs is not None and color not in receiver.admitted_color_refs:reasons.append('FILTER_COLOR_MISMATCH')
            if receiver.maximal_group_required and any(by_rank.get(rank) is not None and not by_rank[rank].captured and
                    by_rank[rank].current_color_ref==color for rank in (first-1,first+receiver.window_size)):
                reasons.append('MATCHING_WINDOW_IS_NOT_MAXIMAL_GROUP')
    missing=tuple((parent,event) for parent,event in receiver.required_parent_events if not any(
        p.receiver_ref==parent and p.event_ref==event and p.beat==state.beat for p in pulses))
    if missing:reasons.append('REQUIRED_PARENT_PULSE_NOT_AT_THIS_BEAT')
    return {'receiver_ref':receiver.receiver_ref,'beat':state.beat,'input_ranks':ranks,'eligible':not reasons,
        'rejection_causes':tuple(reasons),'missing_same_beat_parent_events':missing}


class HomogeneousWindowEligibilityRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.homogeneous_window_eligibility_request_d.v1'
    phase_ref: Literal['CURRENT_BEAT_ELIGIBILITY']
    state: WindowBeatStateD
    receiver_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.cadenced_rail_transfer.homogeneous_window_eligibility','EVALUATE'),
    )


def measure_homogeneous_window_eligibility_d(request: HomogeneousWindowEligibilityRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    receiver=next((r for r in request.state.receivers if r.receiver_ref==request.receiver_ref),None)
    if receiver is None:return d_result(request,'NEEDS_EVIDENCE','RECEIVER_NOT_BOUND')
    if max(len(request.state.train),receiver.window_size)>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    budget=DWorkBudget(request)
    try:
        result=_window_eligibility(request.state,receiver,request.state.train,set(request.state.spent_for_run_refs),request.state.current_pulses,budget)
        budget.finish()
        return d_result(request,'COMPLETE','HOMOGENEOUS_FIXED_RANK_WINDOW',complete=True,examined=budget.examined,values=result)
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,frontier={'restart_window':True,'work':error.frontier})


def _process_one_beat(state,budget,depth_bound):
    train=list(state.train)
    spent=set(state.spent_for_run_refs)
    pulses=[p for p in state.current_pulses if p.beat==state.beat]
    receivers={r.receiver_ref:r for r in state.receivers}
    counts={ref:0 for ref in state.receiver_order}
    fired,examined,skipped,events=set(),[],[],[]
    bounds=dict(state.firing_bounds)
    if state.visitation_policy=='revisit_to_quiescence' and (not state.revisit_termination_evidence_ref or
            any(ref not in bounds for ref in state.revisit_receiver_refs)):
        raise DComputationInterrupted('REVISIT_POLICY_TERMINATION_OR_RIGHTS_NOT_BOUND',{})
    for iteration in range(depth_bound):
        changed=False
        for ref in state.receiver_order:
            if iteration and (ref not in state.revisit_receiver_refs or counts[ref]>=bounds[ref]):continue
            receiver=receivers[ref]
            result=_window_eligibility(state,receiver,train,spent,pulses,budget)
            examined.append({'receiver_ref':ref,'pass_index':iteration})
            if not result['eligible']:
                skipped.append({'receiver_ref':ref,'pass_index':iteration,'rejection_causes':result['rejection_causes']})
                continue
            if receiver.one_use_for_run and ref in fired:continue
            ranks=set(result['input_ranks'])
            train=[u.model_copy(update={'captured':True}) if receiver.action=='CAPTURE' and u.rank in ranks else
                u.model_copy(update={'current_color_ref':receiver.paint_color_ref}) if receiver.action=='PAINT' and u.rank in ranks else u for u in train]
            pulses.append(BeatPulseD(receiver_ref=ref,event_ref=receiver.event_ref,beat=state.beat))
            if receiver.one_use_for_run:spent.add(ref)
            fired.add(ref);counts[ref]+=1;changed=True
            events.append({'receiver_ref':ref,'event_ref':receiver.event_ref,'beat':state.beat,'firing_index':counts[ref],
                'action':receiver.action,'input_ranks':result['input_ranks']})
        if state.visitation_policy=='single_ordered_pass' or not changed:
            return state.model_copy(update={'train':tuple(train),'spent_for_run_refs':tuple(sorted(spent)),'current_pulses':tuple(pulses)}),{
                'examined_this_pass':tuple(examined),'skipped_occurrences':tuple(skipped),'fired_this_beat':tuple(sorted(fired)),
                'spent_for_run_refs':tuple(sorted(spent)),'ordered_events':tuple(events)}
    raise DComputationInterrupted('BEAT_VISITATION_BOUND',{'beat':state.beat})


class SameBeatActivationClosureRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.same_beat_activation_closure_request_d.v1'
    phase_ref: Literal['INTERNAL_BEAT_VISITATION']
    state: WindowBeatStateD
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.cadenced_rail_transfer.same_beat_activation_closure','STEP_INTERNAL'),
    )


def measure_same_beat_activation_closure_d(request: SameBeatActivationClosureRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.state.train),sum(r.window_size for r in request.state.receivers))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_PURE_BEAT_FROM_BOUND_STATE')
    budget=DWorkBudget(request)
    try:
        state,ledger=_process_one_beat(request.state,budget,request.depth_bound)
        budget.finish()
        return d_result(request,'COMPLETE','EXACT_BEAT_VISITATION_RESULT',complete=True,examined=budget.examined,
            values={'state':state,'ledger':ledger,'visitation_policy':state.visitation_policy,'captured_holes_compacted':False,
                'parent_permissions_persist_to_next_beat':False,'new_external_inputs':0})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,frontier={'restart_pure_beat':True,'work':error.frontier})
