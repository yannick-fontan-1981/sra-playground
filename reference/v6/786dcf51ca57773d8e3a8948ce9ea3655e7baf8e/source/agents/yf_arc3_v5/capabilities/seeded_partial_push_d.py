"""Mandatory local push plus explicitly partial-committing remote broadcasts."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class PushBodyD(FrozenModel):
    body_ref: Ref
    type_ref: Ref
    origin: tuple[int,int]
    offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    admitted_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    pushable: bool


class MovedIncidenceD(FrozenModel):
    body_ref: Ref
    command_ref: Ref
    phase_event_ref: Ref
    cause_ref: Ref


class SeededPartialPushRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.seeded_partial_push_request_d.v1'
    phase_ref: Literal['LOCAL_SEED_PREDICATE','INTERNAL_SEEDED_BROADCAST']
    bodies: tuple[PushBodyD,...] = Field(min_length=1,max_length=128)
    seed_ref: Ref
    displacement: tuple[int,int]
    broadcast_eligible_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    broadcast_order: tuple[Ref,...] = Field(default=(),max_length=128)
    broadcast_snapshot_revision_ref: Ref
    partial_remote_commit_supported: bool
    fixed_blocking_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    command_ref: Ref
    phase_event_ref: Ref
    cause_ref: Ref
    already_moved: tuple[MovedIncidenceD,...] = Field(default=(),max_length=4096)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.coupled_member_control.seeded_partial_push','STEP_INTERNAL'),
        ('mechanics.coupled_member_control.seeded_partial_push','PRECONDITION'),
    )

    @model_validator(mode='after')
    def seed_scope(self):
        ids={b.body_ref for b in self.bodies}
        if len(ids)!=len(self.bodies) or self.seed_ref not in ids or not set(self.broadcast_eligible_refs)<=ids:
            raise ValueError('seed/broadcast body domain invalid')
        if set(self.broadcast_order)!=set(self.broadcast_eligible_refs) or len(self.broadcast_order)!=len(set(self.broadcast_order)):
            raise ValueError('broadcast requires its exact supplied native order')
        if self.displacement==(0,0):raise ValueError('push requires its nonzero nominal displacement')
        if self.mode_ref=='PRECONDITION' and self.phase_ref!='LOCAL_SEED_PREDICATE' or self.mode_ref=='STEP_INTERNAL' and self.phase_ref!='INTERNAL_SEEDED_BROADCAST':
            raise ValueError('read-only local predicate and applied internal push phases differ')
        return self


def _expand_push_chain(request,root,poses,moved,budget):
    bodies={b.body_ref:b for b in request.bodies}
    if root in moved:return set(),[]
    occupied={}
    for body in request.bodies:
        for x,y in body.offsets:
            budget.visit({'stage':'current_push_occupancy','body_ref':body.body_ref})
            occupied.setdefault((poses[body.body_ref][0]+x,poses[body.body_ref][1]+y),set()).add(body.body_ref)
    pending=[root]
    chain={root}
    witnesses=[]
    fixed=set(request.fixed_blocking_cells)
    while pending:
        if len(chain)>request.depth_bound:raise DComputationInterrupted('PUSH_CHAIN_DEPTH_BOUND',{})
        ref=pending.pop()
        body=bodies[ref]
        if not body.pushable:witnesses.append({'body_ref':ref,'code':'BODY_NOT_PUSHABLE'})
        allowed=set(body.admitted_cells)
        for x,y in body.offsets:
            budget.visit({'stage':'seeded_chain_admission','body_ref':ref})
            point=(poses[ref][0]+x+request.displacement[0],poses[ref][1]+y+request.displacement[1])
            if point not in allowed or point in fixed:witnesses.append({'body_ref':ref,'code':'SUPPORT_OR_FIXED_BLOCK','cell':point})
            for peer in sorted(occupied.get(point,())):
                if peer==ref or peer in chain:continue
                if peer in moved:
                    witnesses.append({'body_ref':ref,'code':'ALREADY_MOVED_SAME_CAUSE_OCCUPANT_BLOCKS','blocking_ref':peer,'cell':point})
                else:
                    chain.add(peer);pending.append(peer)
    return chain,witnesses


def measure_seeded_partial_push_d(request: SeededPartialPushRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(sum(len(b.offsets)+len(b.admitted_cells) for b in request.bodies),len(request.fixed_blocking_cells),len(request.already_moved))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_PURE_PUSH_FROM_BOUND_OCCUPANCY')
    budget=DWorkBudget(request)
    try:
        poses={b.body_ref:b.origin for b in request.bodies}
        original=dict(poses)
        moved={i.body_ref for i in request.already_moved if (i.command_ref,i.phase_event_ref,i.cause_ref)==
            (request.command_ref,request.phase_event_ref,request.cause_ref)}
        seed,witnesses=_expand_push_chain(request,request.seed_ref,poses,moved,budget)
        local_ok=not witnesses
        admitted=set(seed) if local_ok else set()
        blocked=[]
        ledger=list(request.already_moved)
        if request.mode_ref=='STEP_INTERNAL' and local_ok:
            for ref in sorted(seed):
                poses[ref]=(poses[ref][0]+request.displacement[0],poses[ref][1]+request.displacement[1])
                moved.add(ref)
                ledger.append(MovedIncidenceD(body_ref=ref,command_ref=request.command_ref,phase_event_ref=request.phase_event_ref,cause_ref=request.cause_ref))
            for root in request.broadcast_order:
                chain,failures=_expand_push_chain(request,root,poses,moved,budget)
                if failures:
                    blocked.append({'broadcast_seed_ref':root,'blocking_witnesses':tuple(failures)})
                    if not request.partial_remote_commit_supported:
                        poses=original
                        admitted=set()
                        ledger=list(request.already_moved)
                        break
                    continue
                for ref in sorted(chain):
                    poses[ref]=(poses[ref][0]+request.displacement[0],poses[ref][1]+request.displacement[1])
                    moved.add(ref);admitted.add(ref)
                    ledger.append(MovedIncidenceD(body_ref=ref,command_ref=request.command_ref,phase_event_ref=request.phase_event_ref,cause_ref=request.cause_ref))
        budget.finish()
        return d_result(request,'COMPLETE','LOCAL_SEED_BLOCKED' if not local_ok else 'SEEDED_PUSH_RESULT',complete=True,examined=budget.examined,
            values={'local_seed_admitted':local_ok,'conditional_seed_displacement_refs':tuple(sorted(seed)) if local_ok else (),
                'local_blocking_witnesses':tuple(witnesses),'blocked_remote_branches':tuple(blocked),
                'world_origins':original if request.mode_ref=='PRECONDITION' else poses,
                'applied_displacement_refs':() if request.mode_ref=='PRECONDITION' else tuple(sorted(admitted)),
                'already_moved_ledger':request.already_moved if request.mode_ref=='PRECONDITION' else tuple(ledger),
                'caller_ledger_mutated':False,'new_external_debit':0,'deduplicated_by_body_identity_alone':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_owning_simulation_event':True,'caller_ledger_mutated':False,'work':error.frontier})
