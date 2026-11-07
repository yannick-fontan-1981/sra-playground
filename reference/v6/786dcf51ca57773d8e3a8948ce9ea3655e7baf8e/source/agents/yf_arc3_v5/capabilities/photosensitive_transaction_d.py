"""Joint photosensitive packet versus one owned, resumable repulsion phase."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .stateful_photo_contact_d import PhotoBodyD, PhotoContactD, PhotoPairRuleD, ProtectedPhotoWriteD, StatefulPhotoContactRequestD, _refresh_photo_contact
from .seeded_partial_push_d import PushBodyD, SeededPartialPushRequestD, _expand_push_chain
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result, d_input_digest


class PhotoPhysicalBodyD(FrozenModel):
    body: PhotoBodyD
    origin: tuple[int,int]
    offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    admitted_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    pushable: bool


class PhotoExposureAtPoseD(FrozenModel):
    body_ref: Ref
    origin: tuple[int,int]
    exposed: bool | None


class PhotosensitiveTransactionRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.photosensitive_transaction_request_d.v1'
    phase_ref: Literal['COMPLETE_JOINT_INPUT','repulsion']
    bodies: tuple[PhotoPhysicalBodyD,...] = Field(min_length=1,max_length=128)
    actor_ref: Ref
    input_displacement: tuple[int,int]
    input_kind: Literal['MOVE','ORIENT','WAIT']
    orientation_ref: Ref
    requested_orientation_ref: Ref
    phase_order: tuple[Literal['REFRESH_BEFORE','INPUT','CARRY','PUSH','repulsion','REFRESH_AFTER','TERMINAL'],...] = Field(min_length=1,max_length=16)
    exposure_by_pose: tuple[PhotoExposureAtPoseD,...] = Field(min_length=1,max_length=4096)
    contacts_by_pair: tuple[tuple[Ref,Ref],...] = Field(default=(),max_length=4096)
    pair_rules: tuple[PhotoPairRuleD,...] = Field(default=(),max_length=4096)
    refresh_precedence: tuple[Literal['EXPOSURE','CONTACT'],Literal['EXPOSURE','CONTACT']]
    protected_writes: tuple[ProtectedPhotoWriteD,...] = Field(default=(),max_length=4096)
    rigid_carried_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    repulsion_order: tuple[Ref,...] = Field(default=(),max_length=128)
    repulsion_mode_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    repulsion_displacements: tuple[tuple[Ref,tuple[int,int]],...] = Field(default=(),max_length=128)
    repulsion_event_ref: Ref
    command_ref: Ref
    command_event_ref: Ref
    already_carried_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    already_moved_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    already_activated_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    internal_frozen_eligibility_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    activation_on_blocked_attempt: bool
    blocked_input_advances_world: bool
    fixed_blocking_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    remaining_resource: int
    accepted_input_debit: int = Field(ge=0)
    refused_input_debit: int = Field(ge=0)
    goal_actor_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    required_goal_modes: tuple[tuple[Ref,Ref],...] = Field(default=(),max_length=128)
    goal_predicate_bound: bool
    goal_boundary_ref: Ref
    depletion_boundary_ref: Ref
    read_revision: int = Field(ge=0)
    write_revision: int = Field(ge=0)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.local_field_type_production.photosensitive_transaction','STEP'),
        ('mechanics.local_field_type_production.photosensitive_transaction','STEP_INTERNAL'),
    )

    @model_validator(mode='after')
    def owned_phase(self):
        ids={b.body.body_ref for b in self.bodies}
        if len(ids)!=len(self.bodies) or self.actor_ref not in ids:
            raise ValueError('joint actor/body identity domain invalid')
        if self.mode_ref=='STEP_INTERNAL' and (self.phase_ref!='repulsion' or self.phase_order!=('repulsion',)):
            raise ValueError('internal repulsion cannot request the complete input, refresh or terminal phases')
        if self.mode_ref=='STEP' and self.phase_ref!='COMPLETE_JOINT_INPUT':
            raise ValueError('complete input requires its disjoint owner phase')
        if len(set(self.phase_order))!=len(self.phase_order):
            raise ValueError('an owned phase cannot be replayed inside one input')
        if self.mode_ref=='STEP' and ('INPUT' not in self.phase_order or 'TERMINAL' not in self.phase_order):
            raise ValueError('complete external input requires input and terminal ownership')
        if 'PUSH' in self.phase_order and 'CARRY' in self.phase_order and self.phase_order.index('PUSH')>self.phase_order.index('CARRY'):
            raise ValueError('joint seeded motion precedes carried-ledger acknowledgement')
        if not set(self.rigid_carried_refs+self.repulsion_order+self.internal_frozen_eligibility_refs)<=ids:
            raise ValueError('carried/repulsion identity outside immutable joint state')
        if len({(e.body_ref,e.origin) for e in self.exposure_by_pose})!=len(self.exposure_by_pose):
            raise ValueError('pose-conditioned field alternatives require separate model requests')
        return self


def measure_photosensitive_transaction_d(request: PhotosensitiveTransactionRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(sum(len(b.offsets)+len(b.admitted_cells) for b in request.bodies),len(request.exposure_by_pose),len(request.fixed_blocking_cells))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    bodies={b.body.body_ref:b for b in request.bodies}
    carried=set(request.already_carried_refs)
    moved=set(request.already_moved_refs)
    activated=set(request.already_activated_refs)
    events=[]
    protections=list(request.protected_writes)
    phase_cursor,repulsion_cursor=0,0
    eligibility=list(request.internal_frozen_eligibility_refs) if request.mode_ref=='STEP_INTERNAL' else None
    resource=request.remaining_resource
    revision=request.write_revision
    orientation=request.orientation_ref
    input_accepted=False
    input_debit=0
    boundary=None
    if request.resume_frontier:
        f=request.resume_frontier
        if f.get('input_digest')!=d_input_digest(request) or f.get('command_ref')!=request.command_ref:
            return d_result(request,'NEEDS_EVIDENCE','RESUME_COMMAND_OR_READ_REVISION_MISMATCH')
        bodies={b.body.body_ref:b for b in (PhotoPhysicalBodyD.model_validate(row) for row in f['bodies'])}
        carried=set(f['already_carried_refs']);moved=set(f['already_moved_refs']);activated=set(f['already_activated_refs'])
        events=list(f['events']);protections=[ProtectedPhotoWriteD.model_validate(p) for p in f['protected_writes']]
        phase_cursor=int(f['phase_cursor']);repulsion_cursor=int(f['repulsion_cursor'])
        eligibility=list(f['frozen_eligibility_refs']) if f['frozen_eligibility_refs'] is not None else None
        resource=f['remaining_resource'];revision=f['write_revision'];orientation=f['orientation_ref']
        input_accepted=f['input_accepted'];input_debit=f['input_debit']
    budget=DWorkBudget(request)
    try:
        for index in range(phase_cursor,len(request.phase_order)):
            phase_cursor=index
            phase=request.phase_order[index]
            budget.visit({'stage':'owned_photosensitive_phase','phase':phase,'phase_cursor':index})
            if phase in ('REFRESH_BEFORE','REFRESH_AFTER'):
                exposure={(e.body_ref,e.origin):e.exposed for e in request.exposure_by_pose}
                if any((ref,b.origin) not in exposure for ref,b in sorted(bodies.items())):
                    raise DComputationInterrupted('POSE_CONDITIONED_EXPOSURE_NOT_BOUND',{})
                contacts=tuple(PhotoContactD(left_ref=a,right_ref=b,contact_evidence_ref=request.command_event_ref)
                    for a,b in request.contacts_by_pair if a in bodies and b in bodies and any(
                        abs(bodies[a].origin[0]+x-bodies[b].origin[0]-sx)+abs(bodies[a].origin[1]+y-bodies[b].origin[1]-sy)==1
                        for x,y in bodies[a].offsets for sx,sy in bodies[b].offsets))
                refresh=StatefulPhotoContactRequestD(scope=request.scope,operation_ref='mechanics.local_field_type_production.stateful_photo_contact',
                    mode_ref='STEP_INTERNAL',requested_result_type='DMechanicalResult',node_bound=request.node_bound,depth_bound=request.depth_bound,
                    domain_bound=request.domain_bound,time_bound_ms=request.time_bound_ms,phase_ref='INTERNAL_EXPOSURE_CONTACT_REFRESH',
                    bodies=tuple(b.body for _ref,b in sorted(bodies.items())),exposure_values=tuple((ref,exposure[(ref,b.origin)]) for ref,b in sorted(bodies.items())),
                    contacts=contacts,pair_rules=request.pair_rules,supported_phase_orders=(request.refresh_precedence,),protected_writes=tuple(protections),
                    command_ref=request.command_ref,phase_event_ref=request.command_event_ref,read_revision=request.read_revision,write_revision=revision)
                result=_refresh_photo_contact(refresh,budget)[0]
                if result['unresolved_writes']:raise DComputationInterrupted('REFRESH_MODE_PRECEDENCE_OR_EXPOSURE_UNRESOLVED',{})
                for body in result['bodies']:bodies[body.body_ref]=bodies[body.body_ref].model_copy(update={'body':body})
                protections=list(result['protected_write_ledger']);revision=result['write_revision']
                events.extend(result['mode_causes'])
            elif phase=='INPUT':
                if request.input_kind in ('ORIENT','WAIT'):
                    input_accepted=True
                    if request.input_kind=='ORIENT':orientation=request.requested_orientation_ref
                else:
                    actor=bodies[request.actor_ref]
                    target=(actor.origin[0]+request.input_displacement[0],actor.origin[1]+request.input_displacement[1])
                    permitted=set(actor.admitted_cells)
                    fixed=set(request.fixed_blocking_cells)
                    input_accepted=all((target[0]+x,target[1]+y) in permitted and (target[0]+x,target[1]+y) not in fixed for x,y in actor.offsets)
                    if input_accepted and 'PUSH' not in request.phase_order and 'CARRY' not in request.phase_order:
                        peer_pixels={(b.origin[0]+x,b.origin[1]+y) for ref,b in sorted(bodies.items()) if ref!=request.actor_ref for x,y in b.offsets}
                        input_accepted=not any((target[0]+x,target[1]+y) in peer_pixels for x,y in actor.offsets)
                        if input_accepted:
                            bodies[request.actor_ref]=actor.model_copy(update={'origin':target});revision+=1
                            moved.add(request.actor_ref)
                input_debit=request.accepted_input_debit if input_accepted else request.refused_input_debit
                resource-=input_debit
                events.append({'kind':'ONE_OWNED_INPUT','command_ref':request.command_ref,'accepted':input_accepted,'debit':input_debit,
                    'admission_provisional':request.input_kind=='MOVE' and 'PUSH' in request.phase_order})
                if not input_accepted and not request.blocked_input_advances_world:
                    phase_cursor=len(request.phase_order);break
            elif phase=='CARRY' and input_accepted and request.input_kind=='MOVE':
                candidates=[]
                group={request.actor_ref,*request.rigid_carried_refs}
                peer_pixels={(b.origin[0]+x,b.origin[1]+y) for ref,b in sorted(bodies.items()) if ref not in group for x,y in b.offsets}
                for ref in (request.actor_ref,)+request.rigid_carried_refs:
                    if ref in carried or ref in moved:continue
                    body=bodies[ref]
                    target=(body.origin[0]+request.input_displacement[0],body.origin[1]+request.input_displacement[1])
                    if any((target[0]+x,target[1]+y) not in set(body.admitted_cells) or
                            (target[0]+x,target[1]+y) in request.fixed_blocking_cells or
                            (target[0]+x,target[1]+y) in peer_pixels for x,y in body.offsets):
                        raise DComputationInterrupted('RIGID_CARRIED_GROUP_ADMISSION_CONTRADICTION',{'body_ref':ref})
                    candidates.append((ref,target))
                for ref,target in candidates:
                    bodies[ref]=bodies[ref].model_copy(update={'origin':target});carried.add(ref);moved.add(ref);revision+=1
                    events.append({'kind':'RIGID_CARRY_ONCE','body_ref':ref,'command_ref':request.command_ref})
            elif phase in ('PUSH','repulsion'):
                if phase=='repulsion' and eligibility is None:
                    eligibility=[ref for ref in request.repulsion_order if bodies[ref].body.mode_ref in request.repulsion_mode_refs and ref not in carried and ref not in moved]
                roots=(eligibility or []) if phase=='repulsion' else [request.actor_ref] if request.input_kind=='MOVE' and input_accepted else []
                deltas=dict(request.repulsion_displacements)
                for offset in range(repulsion_cursor if phase=='repulsion' else 0,len(roots)):
                    repulsion_cursor=offset if phase=='repulsion' else repulsion_cursor
                    ref=roots[offset]
                    if phase=='repulsion' and ref in activated:continue
                    delta=deltas.get(ref) if phase=='repulsion' else request.input_displacement
                    if delta is None:raise DComputationInterrupted('REPULSION_DISPLACEMENT_NOT_BOUND',{'body_ref':ref})
                    push=SeededPartialPushRequestD(scope=request.scope,operation_ref='mechanics.coupled_member_control.seeded_partial_push',mode_ref='STEP_INTERNAL',
                        requested_result_type='DMechanicalResult',node_bound=request.node_bound,depth_bound=request.depth_bound,domain_bound=request.domain_bound,
                        time_bound_ms=request.time_bound_ms,phase_ref='INTERNAL_SEEDED_BROADCAST',bodies=tuple(PushBodyD(body_ref=r,type_ref=b.body.intrinsic_type_ref,
                            origin=b.origin,offsets=b.offsets,admitted_cells=b.admitted_cells,
                            pushable=b.pushable or phase=='PUSH' and r in {request.actor_ref,*request.rigid_carried_refs}) for r,b in sorted(bodies.items())),
                        seed_ref=ref,displacement=delta,broadcast_eligible_refs=(),broadcast_order=(),broadcast_snapshot_revision_ref=request.scope.model_revision_ref,
                        partial_remote_commit_supported=True,fixed_blocking_cells=request.fixed_blocking_cells,command_ref=request.command_ref,
                        phase_event_ref=request.repulsion_event_ref,cause_ref=request.repulsion_event_ref)
                    poses={r:b.origin for r,b in sorted(bodies.items())}
                    # The actor's INPUT records the nominal move; PUSH applies
                    # that same physical cause once, not a second translation.
                    chain,blocked=_expand_push_chain(push,ref,poses,carried|moved,budget)
                    if phase=='PUSH':
                        for carried_ref in request.rigid_carried_refs:
                            extra,failures=_expand_push_chain(push,carried_ref,poses,carried|moved,budget)
                            chain.update(extra);blocked.extend(failures)
                    if not blocked:
                        for body_ref in sorted(chain):
                            body=bodies[body_ref]
                            bodies[body_ref]=body.model_copy(update={'origin':(body.origin[0]+delta[0],body.origin[1]+delta[1])})
                            moved.add(body_ref);revision+=1
                        if phase=='PUSH':carried.update(request.rigid_carried_refs)
                    if phase=='repulsion' and (not blocked or request.activation_on_blocked_attempt):activated.add(ref)
                    if phase=='PUSH' and blocked:
                        input_accepted=False
                        resource+=input_debit-request.refused_input_debit
                        input_debit=request.refused_input_debit
                        events.append({'kind':'FINAL_INPUT_REFUSAL','command_ref':request.command_ref,
                            'accepted':False,'final_debit':input_debit})
                    events.append({'kind':'REPULSION_PHASE_ATTEMPT' if phase=='repulsion' else 'LOCAL_PUSH_ATTEMPT','body_ref':ref,
                        'blocked_witnesses':tuple(blocked),'moved_refs':tuple(sorted(chain)) if not blocked else (), 'command_ref':request.command_ref})
                    if phase=='repulsion':repulsion_cursor=offset+1
                if phase=='PUSH' and not input_accepted and not request.blocked_input_advances_world:
                    phase_cursor=len(request.phase_order);break
            elif phase=='TERMINAL' and request.mode_ref=='STEP':
                exact=request.goal_predicate_bound and bodies[request.actor_ref].origin in request.goal_actor_cells and all(
                    bodies[ref].body.mode_ref==mode for ref,mode in request.required_goal_modes)
                if exact:boundary=request.goal_boundary_ref
                elif resource<0:boundary=request.depletion_boundary_ref
                if boundary is not None:
                    phase_cursor=len(request.phase_order);break
            phase_cursor=index+1
        budget.finish()
        return d_result(request,'COMPLETE','OWNED_REPULSION_PHASE_RESULT' if request.mode_ref=='STEP_INTERNAL' else 'COMPLETE_PHOTOSENSITIVE_INPUT',
            complete=True,examined=budget.examined,values={'bodies':tuple(bodies[ref] for ref in sorted(bodies)),'orientation_ref':orientation,
                'protected_writes':tuple(protections),'already_carried_refs':tuple(sorted(carried)),'already_moved_refs':tuple(sorted(moved)),
                'already_activated_refs':tuple(sorted(activated)),'frozen_repulsion_eligibility_refs':tuple(eligibility or []),
                'event_delta':tuple(events),'remaining_resource':resource,'input_debit':input_debit,'input_accepted':input_accepted,'boundary_ref':boundary,
                'phase_cursor':phase_cursor,'repulsion_cursor':repulsion_cursor,'read_revision':request.read_revision,'write_revision':revision,
                'new_external_input_count':int(request.mode_ref=='STEP'),'complete_response_boundary_count':int(request.mode_ref=='STEP')})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,frontier={
            'input_digest':d_input_digest(request),'command_ref':request.command_ref,'bodies':tuple(bodies[ref] for ref in sorted(bodies)),
            'protected_writes':tuple(protections),'already_carried_refs':tuple(sorted(carried)),'already_moved_refs':tuple(sorted(moved)),
            'already_activated_refs':tuple(sorted(activated)),'frozen_eligibility_refs':eligibility,'events':tuple(events),
            'remaining_resource':resource,'input_accepted':input_accepted,'input_debit':input_debit,'orientation_ref':orientation,
            'phase_cursor':phase_cursor,'repulsion_cursor':repulsion_cursor,'read_revision':request.read_revision,'write_revision':revision,
            'replay_complete_input_on_resume':False,'new_actual_command_debit':False,'work':error.frontier})
