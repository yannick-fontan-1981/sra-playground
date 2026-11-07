"""Mode-conditioned rigid attachment, not a broadcast to independent members."""
from __future__ import annotations
from collections import deque
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class AttachedBodyD(FrozenModel):
    identity_ref: Ref
    origin: tuple[int,int]
    mode_ref: Ref
    physical_offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    admitted_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)


class AttachmentContactD(FrozenModel):
    contact_ref: Ref
    left_ref: Ref
    right_ref: Ref
    eligible_left_modes: tuple[Ref,...] = Field(default=(),max_length=128)
    eligible_right_modes: tuple[Ref,...] = Field(default=(),max_length=128)
    contact_evidence_ref: Ref
    eligibility_evidence_ref: Ref


class StateConditionedAttachmentRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.state_conditioned_attachment_request_d.v1'
    phase_ref: Literal['ATTACHMENT_REFRESH','RIGID_ATTACHED_MOTION']
    bodies: tuple[AttachedBodyD,...] = Field(min_length=1,max_length=4096)
    carrier_ref: Ref
    contacts: tuple[AttachmentContactD,...] = Field(default=(),max_length=4096)
    contact_graph_revision_ref: Ref
    closure_rule: Literal['DIRECT_ONLY','TRANSITIVE']
    contact_direction_rule: Literal['UNDIRECTED','LEFT_TO_RIGHT']
    refresh_boundary_supported: bool
    frozen_attached_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    frozen_attachment_evidence_ref: Ref | None
    displacement: tuple[int,int] | None
    fixed_blocking_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.oriented_cargo_handoffs.state_conditioned_attachment','DOMAIN'),
        ('mechanics.oriented_cargo_handoffs.state_conditioned_attachment','STEP_INTERNAL'),
    )

    @model_validator(mode='after')
    def identities(self):
        ids={b.identity_ref for b in self.bodies}
        if len(ids)!=len(self.bodies) or self.carrier_ref not in ids or not set(self.frozen_attached_refs)<=ids:
            raise ValueError('carrier/attached identity domain invalid')
        if len({c.contact_ref for c in self.contacts})!=len(self.contacts) or any(c.left_ref not in ids or c.right_ref not in ids or
                c.left_ref==c.right_ref for c in self.contacts):
            raise ValueError('contact graph identity domain invalid')
        if self.mode_ref=='DOMAIN' and self.phase_ref!='ATTACHMENT_REFRESH' or self.mode_ref=='STEP_INTERNAL' and self.phase_ref!='RIGID_ATTACHED_MOTION':
            raise ValueError('attachment mode and physical refresh/motion phase differ')
        return self


def measure_state_conditioned_attachment_d(request: StateConditionedAttachmentRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.contacts),sum(len(b.physical_offsets)+len(b.admitted_cells) for b in request.bodies),len(request.fixed_blocking_cells))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request,'NEEDS_EVIDENCE','RESTART_ATTACHMENT_FROM_BOUND_STATE')
    if request.mode_ref=='STEP_INTERNAL' and request.displacement is None:
        return d_result(request,'NEEDS_EVIDENCE','GROUP_DISPLACEMENT_NOT_BOUND')
    budget=DWorkBudget(request)
    try:
        bodies={b.identity_ref:b for b in request.bodies}
        causes=[]
        if request.refresh_boundary_supported:
            graph={ref:[] for ref in sorted(bodies)}
            for contact in request.contacts:
                budget.visit({'stage':'current_mode_eligibility','contact_ref':contact.contact_ref})
                if bodies[contact.left_ref].mode_ref in contact.eligible_left_modes and bodies[contact.right_ref].mode_ref in contact.eligible_right_modes:
                    graph[contact.left_ref].append((contact.right_ref,contact))
                    if request.contact_direction_rule=='UNDIRECTED':
                        graph[contact.right_ref].append((contact.left_ref,contact))
            attached={request.carrier_ref}
            queue=deque([(request.carrier_ref,0)])
            while queue:
                ref,depth=queue.popleft()
                budget.visit({'stage':'attachment_closure','identity_ref':ref})
                if depth>request.depth_bound:
                    raise DComputationInterrupted('ATTACHMENT_DEPTH_BOUND',{'identity_ref':ref})
                if request.closure_rule=='DIRECT_ONLY' and depth>0:
                    continue
                for peer,contact in graph[ref]:
                    if peer not in attached:
                        attached.add(peer)
                        causes.append({'identity_ref':peer,'parent_identity_ref':ref,'contact_ref':contact.contact_ref,
                            'contact_evidence_ref':contact.contact_evidence_ref,'eligibility_evidence_ref':contact.eligibility_evidence_ref})
                        queue.append((peer,depth+1))
        else:
            if not request.frozen_attachment_evidence_ref or request.carrier_ref not in request.frozen_attached_refs:
                return d_result(request,'NEEDS_EVIDENCE','FROZEN_ATTACHMENT_NOT_QUALIFIED',examined=budget.examined)
            attached=set(request.frozen_attached_refs)
        blocked=set(request.fixed_blocking_cells)
        for body in request.bodies:
            if body.identity_ref not in attached:
                for x,y in body.physical_offsets:
                    budget.visit({'stage':'unattached_occupancy','identity_ref':body.identity_ref})
                    blocked.add((body.origin[0]+x,body.origin[1]+y))
        witnesses=[]
        delta=request.displacement
        if delta is not None:
            for ref in sorted(attached):
                body=bodies[ref]
                admitted=set(body.admitted_cells)
                for x,y in body.physical_offsets:
                    budget.visit({'stage':'indivisible_group_admission','identity_ref':ref})
                    point=(body.origin[0]+x+delta[0],body.origin[1]+y+delta[1])
                    if point not in admitted or point in blocked:
                        witnesses.append({'identity_ref':ref,'blocked_cell':point,'outside_admission':point not in admitted,
                            'blocking_occupancy':point in blocked})
        poses={b.identity_ref:b.origin for b in request.bodies}
        if request.mode_ref=='STEP_INTERNAL' and not witnesses:
            for ref in sorted(attached):
                poses[ref]=(poses[ref][0]+delta[0],poses[ref][1]+delta[1])
        budget.finish()
        return d_result(request,'COMPLETE','STATE_CONDITIONED_RIGID_GROUP',complete=True,examined=budget.examined,
            values={'attached_identity_refs':tuple(ref for ref in (b.identity_ref for b in request.bodies) if ref in attached),
                'attachment_causes':tuple(causes),'world_origins':poses,'displacement_admitted':None if delta is None else not witnesses,
                'indivisible_blocking_witnesses':tuple(witnesses),'refresh_performed':request.refresh_boundary_supported,
                'blocked_member_discarded':False,'independent_broadcast_used':False,'new_external_inputs':0})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_attachment':True,'work':error.frontier})
