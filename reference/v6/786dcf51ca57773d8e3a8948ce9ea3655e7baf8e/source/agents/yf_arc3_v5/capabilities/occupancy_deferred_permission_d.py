"""Distinct edge-pending and maintained-level passage latches."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class OccupancyDeferredPermissionRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.occupancy_deferred_permission_request_d.v1'
    phase_ref: Literal['INTERNAL_PERMISSION_REFRESH']
    latch_law: Literal['EDGE_TRIGGERED_PENDING','MAINTAINED_LEVEL']
    permission_open: bool
    occupied_identity_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    permitted_blocker_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    source_request: Literal['OPEN','CLOSE','NONE']
    request_event_ref: Ref | None
    request_epoch: int | None = Field(default=None,ge=0)
    last_applied_event_ref: Ref | None
    last_applied_epoch: int | None = Field(default=None,ge=0)
    pending_close_event_ref: Ref | None
    pending_close_epoch: int | None = Field(default=None,ge=0)
    later_open_pulse_rule: Literal['CANCEL_PENDING','KEEP_PENDING']
    later_close_pulse_rule: Literal['REPLACE_PENDING','KEEP_FIRST_PENDING']
    desired_level_open: bool | None
    latch_already_open_while_occupied: bool
    release_event_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.reconfigurable_support.occupancy_deferred_permission','STEP_INTERNAL'),
    )

    @model_validator(mode='after')
    def tagged_state(self):
        if (self.pending_close_event_ref is None)!=(self.pending_close_epoch is None) or (
                self.request_event_ref is None)!=(self.request_epoch is None):
            raise ValueError('event identity and epoch must be jointly bound')
        if self.latch_law=='MAINTAINED_LEVEL' and (self.desired_level_open is None or self.pending_close_event_ref is not None):
            raise ValueError('maintained-level latch needs its level, not an edge-pending state')
        if self.latch_law=='EDGE_TRIGGERED_PENDING' and self.source_request!='NONE' and self.request_event_ref is None:
            raise ValueError('edge request requires its current event identity')
        return self


def measure_occupancy_deferred_permission_d(request: OccupancyDeferredPermissionRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.occupied_identity_refs),len(request.permitted_blocker_refs))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    budget=DWorkBudget(request)
    try:
        allowed=set(request.permitted_blocker_refs)
        rows=[]
        for ref in request.occupied_identity_refs:
            budget.visit({'stage':'permitted_occupancy','identity_ref':ref})
            if ref in allowed:rows.append(ref)
        blockers=tuple(rows)
        budget.finish()
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,
            frontier={'restart_permission_measurement':True,'work':error.frontier})
    occupied=bool(blockers)
    permission=request.permission_open
    pending,pending_epoch=request.pending_close_event_ref,request.pending_close_epoch
    applied,applied_epoch=request.last_applied_event_ref,request.last_applied_epoch
    cause='UNCHANGED'
    owner=None
    if request.latch_law=='MAINTAINED_LEVEL':
        permission=bool(request.desired_level_open or request.latch_already_open_while_occupied and permission and occupied)
        cause='MAINTAINED_LEVEL_OLD_STATE_LATCH' if permission and not request.desired_level_open else 'MAINTAINED_LEVEL_PERMISSION'
    else:
        current=request.request_event_ref is not None and request.request_epoch==request.scope.epoch
        new=current and (request.request_event_ref,request.request_epoch)!=(applied,applied_epoch)
        if new:
            applied,applied_epoch=request.request_event_ref,request.request_epoch
            owner=applied
            if request.source_request=='OPEN':
                permission=True
                if request.later_open_pulse_rule=='CANCEL_PENDING':pending,pending_epoch=None,None
                cause='OPEN_PULSE'
            elif request.source_request=='CLOSE':
                if occupied:
                    if pending is None or request.later_close_pulse_rule=='REPLACE_PENDING':pending,pending_epoch=applied,applied_epoch
                    cause='EDGE_CLOSE_DEFERRED_BY_PERMITTED_OCCUPANCY'
                else:
                    permission=False
                    pending,pending_epoch=None,None
                    cause='EDGE_CLOSE_APPLIED'
        if pending is not None and not occupied:
            permission=False
            owner=pending
            pending,pending_epoch=None,None
            cause='PENDING_CLOSE_RELEASED'
    return d_result(request,'COMPLETE',cause,complete=True,examined=budget.examined,values={
        'permission_open':permission,'pending_close_event_ref':pending,'pending_close_epoch':pending_epoch,
        'last_applied_event_ref':applied,'last_applied_epoch':applied_epoch,'permitted_occupancy_refs':blockers,
        'permission_event_owner_ref':owner,'release_event_ref':request.release_event_ref if cause=='PENDING_CLOSE_RELEASED' else None,
        'latch_law':request.latch_law,'occupied_universally_means_open':False,'crushing_rule_introduced':False,'new_external_inputs':0})
