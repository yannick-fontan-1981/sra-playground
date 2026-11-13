"""One caller-declared modular input; phases are not display sums or clocks."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class PhaseMemberD(FrozenModel):
    member_ref: Ref
    period: int = Field(ge=1)
    phase: int = Field(ge=0)
    collective_gain: int

    @model_validator(mode='after')
    def canonical_phase(self):
        if self.phase>=self.period:
            raise ValueError('phase must belong to its own period')
        return self


class PhaseInputD(FrozenModel):
    input_ref: Ref
    event_ref: Ref
    kind: Literal['FOCUS','INDIVIDUAL','COLLECTIVE','DISPLAY']
    delta: int
    focus_member_ref: Ref | None


class ModularPhaseChannelsRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.modular_phase_channels_request_d.v1'
    phase_ref: Literal['INTERNAL_PHASE_INPUT']
    members: tuple[PhaseMemberD,...] = Field(min_length=1,max_length=4096)
    inputs: tuple[PhaseInputD,...] = Field(min_length=1,max_length=128)
    native_focus_ref: Ref | None
    bound_input_ref: Ref
    display_index: int = Field(ge=0)
    display_period: int = Field(ge=1)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.coupled_member_control.modular_phase_channels','STEP_INTERNAL'),
    )

    @model_validator(mode='after')
    def bindings(self):
        ids = {m.member_ref for m in self.members}
        if len(ids)!=len(self.members) or len({i.input_ref for i in self.inputs})!=len(self.inputs):
            raise ValueError('persistent member/input identity duplicated')
        if self.native_focus_ref is not None and self.native_focus_ref not in ids or self.display_index>=self.display_period:
            raise ValueError('native focus/display outside current domain')
        if any(i.focus_member_ref is not None and i.focus_member_ref not in ids for i in self.inputs):
            raise ValueError('focus input refers to an absent member')
        if any(i.kind=='FOCUS' and i.focus_member_ref is None for i in self.inputs):
            raise ValueError('focus channel requires its bound member')
        return self


def measure_modular_phase_channels_d(request: ModularPhaseChannelsRequestD):
    refusal = d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.members),len(request.inputs))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request,'NEEDS_EVIDENCE','RESTART_INTERNAL_INPUT_FROM_BOUND_STATE')
    budget = DWorkBudget(request)
    try:
        bound = None
        for entry in request.inputs:
            budget.visit({'stage':'bound_channel','input_ref':entry.input_ref})
            if entry.input_ref==request.bound_input_ref:
                bound=entry
        if bound is None:
            return d_result(request,'NEEDS_EVIDENCE','INPUT_CHANNEL_NOT_BOUND',examined=budget.examined)
        phases,affected = [],[]
        focus,display = request.native_focus_ref,request.display_index
        if bound.kind=='FOCUS':
            focus=bound.focus_member_ref
        if bound.kind=='INDIVIDUAL' and focus is None:
            return d_result(request,'COMPLETE','NO_FOCUSED_MEMBER',complete=True,examined=budget.examined,
                values={'member_refs':tuple(m.member_ref for m in request.members),'phase_vector':tuple(m.phase for m in request.members),
                    'native_focus_ref':focus,'display_index':display,'caller_cost_and_acceptance_unchanged':True})
        for member in request.members:
            budget.visit({'stage':'member_phase','member_ref':member.member_ref})
            increment = (bound.delta*member.collective_gain if bound.kind=='COLLECTIVE' else
                bound.delta if bound.kind=='INDIVIDUAL' and member.member_ref==focus else 0)
            value = (member.phase+increment)%member.period
            phases.append(value)
            if value!=member.phase:
                affected.append(member.member_ref)
        if bound.kind=='DISPLAY':
            display=(display+bound.delta)%request.display_period
        budget.finish()
        return d_result(request,'COMPLETE','MODULAR_INPUT_SUCCESSOR',complete=True,examined=budget.examined,
            values={'member_refs':tuple(m.member_ref for m in request.members),'phase_vector':tuple(phases),
                'native_focus_ref':focus,'display_index':display,'affected_member_refs':tuple(affected),
                'input_ref':bound.input_ref,'event_ref':bound.event_ref,'channel_kind':bound.kind,
                'profile_evaluation_performed':False,'autonomous_tick_added':False,'caller_cost_and_acceptance_unchanged':True})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_internal_input':True,'work':error.frontier})
