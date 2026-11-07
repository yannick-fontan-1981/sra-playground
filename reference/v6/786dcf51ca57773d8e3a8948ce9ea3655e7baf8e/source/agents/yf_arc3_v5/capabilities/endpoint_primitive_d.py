"""One endpoint input with caller-owned debit, ordered effects and boundaries."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class EndpointStateD(FrozenModel):
    active_node_ref: Ref
    native_focus_ref: Ref | None
    permission_phase_ref: Ref
    acquired_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    used_support_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    disarmed_portal_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    remaining_resource: int


class EndpointAdmissionD(FrozenModel):
    source_ref: Ref
    destination_ref: Ref
    phase_ref: Ref
    admitted: bool | None
    required_acquired_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    required_unspent_support_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    checked_intermediate_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    intermediate_checks_passed: bool | None
    admission_evidence_ref: Ref


class EndpointPortalD(FrozenModel):
    portal_ref: Ref
    source_ref: Ref
    destination_ref: Ref
    one_use_until_rearmed: bool
    event_ref: Ref


class EndpointAcquisitionD(FrozenModel):
    node_ref: Ref
    acquired_ref: Ref
    event_ref: Ref


class EndpointPrimitiveRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.endpoint_primitive_request_d.v1'
    phase_ref: Literal['EXTERNAL_ENDPOINT_INPUT']
    node_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    state: EndpointStateD
    channel: Literal['SELECT','MOVE','RESET']
    bound_node_ref: Ref | None
    admissions: tuple[EndpointAdmissionD,...] = Field(default=(),max_length=4096)
    acquisitions: tuple[EndpointAcquisitionD,...] = Field(default=(),max_length=4096)
    phase_changes: tuple[tuple[Ref,Ref],...] = Field(default=(),max_length=4096)
    consumed_support_by_departure: tuple[tuple[Ref,Ref],...] = Field(default=(),max_length=4096)
    support_consumption_rule: Literal['ACCEPTED_DEPARTURE_ONLY','NO_CONSUMPTION']
    phase_order: tuple[Literal['DEPARTURE','SUPPORT','LANDING','ACQUISITION','PHASE','TRANSFER'],...] = Field(min_length=6,max_length=6)
    terminal_checkpoints: tuple[Literal['DEPARTURE','SUPPORT','LANDING','ACQUISITION','PHASE','TRANSFER'],...]
    forced_landing_effects: tuple[Literal['ACQUISITION','PHASE'],...]
    portals: tuple[EndpointPortalD,...] = Field(default=(),max_length=4096)
    portal_rearm_rule: Literal['LEAVE_ALL_PORTALS','NEVER','EVERY_ACCEPTED_DEPARTURE']
    forced_transfer_requires_admission: bool
    native_focus_follows_active_endpoint: bool
    selection_debit: int = Field(ge=0)
    accepted_move_debit: int = Field(ge=0)
    refused_move_debit: int = Field(ge=0)
    goal_node_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    goal_acquired_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    goal_predicate_bound: bool
    terminal_order: Literal['GOAL_THEN_DEPLETION','DEPLETION_THEN_GOAL']
    depletion_rule: Literal['NEGATIVE','NONPOSITIVE']
    restored_state: EndpointStateD | None
    goal_boundary_ref: Ref
    depletion_boundary_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.endpoint_navigation.external_primitive','STEP'),
    )

    @model_validator(mode='after')
    def endpoint_domains(self):
        nodes=set(self.node_refs)
        if len(nodes)!=len(self.node_refs) or self.state.active_node_ref not in nodes or self.bound_node_ref is not None and self.bound_node_ref not in nodes:
            raise ValueError('active/bound endpoint outside immutable graph')
        if set(self.phase_order)!={'DEPARTURE','SUPPORT','LANDING','ACQUISITION','PHASE','TRANSFER'} or self.phase_order.index('DEPARTURE')>self.phase_order.index('LANDING'):
            raise ValueError('complete endpoint phase order must be explicitly bound')
        if any(a.source_ref not in nodes or a.destination_ref not in nodes for a in self.admissions) or any(p.source_ref not in nodes or p.destination_ref not in nodes for p in self.portals):
            raise ValueError('admission/portal graph domain invalid')
        if len({(a.source_ref,a.destination_ref,a.phase_ref) for a in self.admissions})!=len(self.admissions) or len({p.source_ref for p in self.portals})!=len(self.portals):
            raise ValueError('ambiguous endpoint/portal laws require model-indexed separate requests')
        return self


def _endpoint_acceptance(request,state):
    exact=request.goal_predicate_bound and state.active_node_ref in request.goal_node_refs and set(request.goal_acquired_refs)<=set(state.acquired_refs)
    depleted=state.remaining_resource<0 if request.depletion_rule=='NEGATIVE' else state.remaining_resource<=0
    for check in (('GOAL','DEPLETION') if request.terminal_order=='GOAL_THEN_DEPLETION' else ('DEPLETION','GOAL')):
        if check=='GOAL' and exact:return request.goal_boundary_ref
        if check=='DEPLETION' and depleted:return request.depletion_boundary_ref
    return None


def measure_endpoint_primitive_d(request: EndpointPrimitiveRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.node_refs),len(request.admissions),len(request.portals))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_PURE_ENDPOINT_PACKET')
    budget=DWorkBudget(request)
    try:
        state=request.state
        events=[]
        boundary=None
        accepted=False
        debit=0
        if request.channel=='RESET':
            if request.restored_state is None:return d_result(request,'NEEDS_EVIDENCE','RESTORE_STATE_NOT_BOUND')
            state=request.restored_state
        elif request.channel=='SELECT':
            if request.bound_node_ref is None:return d_result(request,'NEEDS_EVIDENCE','SELECTION_ENDPOINT_NOT_BOUND')
            debit=request.selection_debit
            state=state.model_copy(update={'native_focus_ref':request.bound_node_ref,'remaining_resource':state.remaining_resource-debit})
        else:
            if request.bound_node_ref is None:return d_result(request,'NEEDS_EVIDENCE','MOVEMENT_ENDPOINT_NOT_BOUND')
            admission=next((a for a in request.admissions if (a.source_ref,a.destination_ref,a.phase_ref)==
                (state.active_node_ref,request.bound_node_ref,state.permission_phase_ref)),None)
            if admission is None or admission.admitted is None or admission.checked_intermediate_refs and admission.intermediate_checks_passed is None:
                return d_result(request,'NEEDS_EVIDENCE','CURRENT_ENDPOINT_ADMISSION_NOT_KNOWN')
            accepted=(admission.admitted and set(admission.required_acquired_refs)<=set(state.acquired_refs) and
                not set(admission.required_unspent_support_refs)&set(state.used_support_refs) and
                (not admission.checked_intermediate_refs or admission.intermediate_checks_passed is True))
            debit=request.accepted_move_debit if accepted else request.refused_move_debit
            state=state.model_copy(update={'remaining_resource':state.remaining_resource-debit})
            if accepted:
                source=state.active_node_ref
                for phase in request.phase_order:
                    budget.visit({'stage':'owned_endpoint_phase','phase':phase})
                    if phase=='DEPARTURE':
                        disarmed=(() if request.portal_rearm_rule=='EVERY_ACCEPTED_DEPARTURE' or request.portal_rearm_rule=='LEAVE_ALL_PORTALS' and
                            source not in {p.source_ref for p in request.portals} else state.disarmed_portal_refs)
                        state=state.model_copy(update={'disarmed_portal_refs':disarmed})
                        events.append({'phase':phase,'source_ref':source,'destination_ref':request.bound_node_ref})
                    elif phase=='SUPPORT' and request.support_consumption_rule=='ACCEPTED_DEPARTURE_ONLY':
                        consumed=tuple(ref for node,ref in request.consumed_support_by_departure if node==source)
                        state=state.model_copy(update={'used_support_refs':tuple(sorted(set(state.used_support_refs)|set(consumed)))})
                    elif phase=='LANDING':state=state.model_copy(update={'active_node_ref':request.bound_node_ref})
                    elif phase=='ACQUISITION':
                        additions=[a for a in request.acquisitions if a.node_ref==state.active_node_ref]
                        state=state.model_copy(update={'acquired_refs':tuple(sorted(set(state.acquired_refs)|{a.acquired_ref for a in additions}))})
                        events.extend({'phase':phase,'event_ref':a.event_ref,'acquired_ref':a.acquired_ref} for a in additions)
                    elif phase=='PHASE':
                        new=dict(request.phase_changes).get(state.active_node_ref)
                        if new is not None:state=state.model_copy(update={'permission_phase_ref':new})
                    elif phase=='TRANSFER':
                        for transfer_index in range(request.depth_bound):
                            portal=next((p for p in request.portals if p.source_ref==state.active_node_ref and
                                (not p.one_use_until_rearmed or p.portal_ref not in state.disarmed_portal_refs)),None)
                            if portal is None:break
                            budget.visit({'stage':'bounded_forced_endpoint_transfer','portal_ref':portal.portal_ref})
                            if request.forced_transfer_requires_admission:
                                permission=next((a for a in request.admissions if (a.source_ref,a.destination_ref,a.phase_ref)==
                                    (portal.source_ref,portal.destination_ref,state.permission_phase_ref)),None)
                                if permission is None or permission.admitted is None:return d_result(request,'NEEDS_EVIDENCE','FORCED_TRANSFER_PERMISSION_UNKNOWN',examined=budget.examined)
                                if permission.checked_intermediate_refs and permission.intermediate_checks_passed is None:
                                    return d_result(request,'NEEDS_EVIDENCE','FORCED_TRANSFER_INTERMEDIATE_UNKNOWN',examined=budget.examined)
                                if (not permission.admitted or not set(permission.required_acquired_refs)<=set(state.acquired_refs) or
                                        set(permission.required_unspent_support_refs)&set(state.used_support_refs) or
                                        permission.checked_intermediate_refs and permission.intermediate_checks_passed is not True):break
                            disarmed=set(state.disarmed_portal_refs)
                            if portal.one_use_until_rearmed:disarmed.add(portal.portal_ref)
                            state=state.model_copy(update={'active_node_ref':portal.destination_ref,'disarmed_portal_refs':tuple(sorted(disarmed))})
                            events.append({'phase':phase,'portal_ref':portal.portal_ref,'event_ref':portal.event_ref,'destination_ref':portal.destination_ref})
                            for effect in request.forced_landing_effects:
                                if effect=='ACQUISITION':
                                    additions=[a for a in request.acquisitions if a.node_ref==state.active_node_ref]
                                    state=state.model_copy(update={'acquired_refs':tuple(sorted(set(state.acquired_refs)|{a.acquired_ref for a in additions}))})
                                    events.extend({'phase':'FORCED_LANDING_ACQUISITION','event_ref':a.event_ref,'acquired_ref':a.acquired_ref} for a in additions)
                                else:
                                    new=dict(request.phase_changes).get(state.active_node_ref)
                                    if new is not None:state=state.model_copy(update={'permission_phase_ref':new})
                        else:
                            pending=any(p.source_ref==state.active_node_ref and (not p.one_use_until_rearmed or
                                p.portal_ref not in state.disarmed_portal_refs) for p in request.portals)
                            if pending:raise DComputationInterrupted('FORCED_TRANSFER_DEPTH_BOUND',{})
                    boundary=_endpoint_acceptance(request,state) if phase in request.terminal_checkpoints else None
                    if boundary is not None:break
                if request.native_focus_follows_active_endpoint:state=state.model_copy(update={'native_focus_ref':state.active_node_ref})
        if boundary is None:boundary=_endpoint_acceptance(request,state)
        before_restore=state
        if boundary==request.depletion_boundary_ref and request.restored_state is not None:state=request.restored_state
        budget.finish()
        return d_result(request,'COMPLETE','ENDPOINT_INPUT_SUCCESSOR',complete=True,examined=budget.examined,
            values={'state':state,'pre_restore_state':before_restore,'accepted_departure':accepted,'primitive_debit':debit,
                'ordered_event_ledger':tuple(events),'boundary_ref':boundary,'refused_departure_consumed_support':False,
                'intermediate_walk_safety_inferred':False,'complete_response_boundary_count':1})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_counterfactual_endpoint_packet':True,'parent_actual_ledger_redebited':False,'work':error.frontier})
