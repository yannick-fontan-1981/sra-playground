"""Native configuration versus one immutable shared paid work transaction."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .shared_work_snapshot_d import SharedWorkSnapshotD, _correlated_snapshot_options, _priority_snapshot_reservation
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class WorkMaterialTargetD(FrozenModel):
    room_ref: Ref
    type_ref: Ref
    quantity: int = Field(ge=0)
    comparator: Literal['EQ','GE']


class SharedWorkPrimitiveRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.shared_work_primitive_request_d.v1'
    phase_ref: Literal['EXTERNAL_CONFIGURATION_OR_WORK']
    snapshot: SharedWorkSnapshotD
    channel: Literal['CONFIGURE','WORK']
    bound_worker_ref: Ref | None
    bound_activity_ref: Ref | None
    reselect_active_rule: Literal['PAUSE','UNPAUSE','TOGGLE']
    new_activity_clears_pause: bool
    cooldown_phase: Literal['BEFORE_RESERVATION','AFTER_JOBS']
    configuration_advances_cooldown: bool
    cooldown_tick: int = Field(ge=0)
    post_work_separation_supported: bool
    separation_room_domains: tuple[tuple[Ref,tuple[Ref,...]],...] = Field(default=(),max_length=128)
    remaining_resource: int = Field(ge=0)
    configuration_debit: int = Field(ge=0)
    work_debit: int = Field(ge=0)
    refusal_debit: int = Field(ge=0)
    material_targets: tuple[WorkMaterialTargetD,...] = Field(default=(),max_length=128)
    worker_targets: tuple[tuple[Ref,Ref],...] = Field(default=(),max_length=128)
    goal_predicate_bound: bool
    terminal_order: Literal['GOAL_THEN_DEPLETION','DEPLETION_THEN_GOAL']
    depletion_rule: Literal['NEGATIVE','NONPOSITIVE']
    goal_boundary_ref: Ref
    depletion_boundary_ref: Ref
    restored_snapshot: SharedWorkSnapshotD | None
    restored_resource: int = Field(ge=0)
    restore_event_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.typed_material_workbench.shared_work_external_primitive','STEP'),
    )

    @model_validator(mode='after')
    def native_context(self):
        workers={w.worker_ref for w in self.snapshot.workers}
        rooms={r.room_ref for r in self.snapshot.rooms}
        if self.bound_worker_ref is not None and self.bound_worker_ref not in workers or any(
                w not in workers or not set(domain)<=rooms for w,domain in self.separation_room_domains):
            raise ValueError('configuration/separation identity outside snapshot')
        if len(dict(self.separation_room_domains))!=len(self.separation_room_domains) or any(t.room_ref not in rooms for t in self.material_targets) or any(
                w not in workers or r not in rooms for w,r in self.worker_targets):
            raise ValueError('separation or terminal predicate domain invalid')
        return self


def _refresh_native_settings(snapshot,budget,domain_bound):
    _tuples,options,_rejections=_correlated_snapshot_options(snapshot,budget,domain_bound)
    workers=[]
    for worker in snapshot.workers:
        budget.visit({'stage':'native_option_refresh','worker_ref':worker.worker_ref})
        available=options[worker.worker_ref]
        setting=worker.native_setting_ref if worker.native_setting_ref in available else None
        if setting is None and len(available)==1 and not worker.voluntarily_paused:
            setting=next(iter(available))
        workers.append(worker.model_copy(update={'native_setting_ref':setting}))
    return snapshot.model_copy(update={'workers':tuple(workers)}),options


def measure_shared_work_primitive_d(request: SharedWorkPrimitiveRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.snapshot.stock),len(request.snapshot.jobs),sum(len(r.ordered_slot_refs) for r in request.snapshot.rooms))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_ATOMIC_SHARED_INPUT_FROM_SNAPSHOT')
    budget=DWorkBudget(request)
    try:
        snapshot,options=_refresh_native_settings(request.snapshot,budget,request.domain_bound)
        events=[]
        accepted_jobs=()
        cause='CONFIGURATION_UNCHANGED'
        debit=request.configuration_debit if request.channel=='CONFIGURE' else request.work_debit
        cooldowns=dict(snapshot.machine_cooldowns)
        if request.channel=='CONFIGURE':
            worker=next((w for w in snapshot.workers if w.worker_ref==request.bound_worker_ref),None)
            if worker is None or request.bound_activity_ref not in options.get(request.bound_worker_ref,{}):
                debit+=request.refusal_debit
                cause='CONFIGURATION_FIELD_NOT_AVAILABLE'
            else:
                paused=worker.voluntarily_paused
                if worker.native_setting_ref==request.bound_activity_ref:
                    paused=(True if request.reselect_active_rule=='PAUSE' else False if request.reselect_active_rule=='UNPAUSE' else not paused)
                    cause='ACTIVE_ACTIVITY_RESELECTED'
                else:
                    paused=False if request.new_activity_clears_pause else paused
                    cause='DIFFERENT_ACTIVITY_CONFIGURED'
                workers=tuple(w.model_copy(update={'native_setting_ref':request.bound_activity_ref,'voluntarily_paused':paused})
                    if w.worker_ref==worker.worker_ref else w for w in snapshot.workers)
                snapshot=snapshot.model_copy(update={'workers':workers})
            if request.configuration_advances_cooldown:
                cooldowns={ref:max(0,value-request.cooldown_tick) for ref,value in sorted(cooldowns.items())}
        else:
            if request.cooldown_phase=='BEFORE_RESERVATION':
                cooldowns={ref:max(0,value-request.cooldown_tick) for ref,value in sorted(cooldowns.items())}
                snapshot=snapshot.model_copy(update={'machine_cooldowns':tuple(sorted(cooldowns.items()))})
            reservation,rejections,discarded=_priority_snapshot_reservation(snapshot,budget)
            if reservation is not None:
                jobs={j.job_ref:j for j in snapshot.jobs}
                accepted_jobs=reservation['job_refs']
                stock=tuple(u for u in snapshot.stock if u.unit_ref not in reservation['input_unit_refs'])+reservation['output_occurrences']
                workers=list(snapshot.workers)
                for ref in accepted_jobs:
                    job=jobs[ref]
                    budget.visit({'stage':'apply_reserved_job_once','job_ref':ref})
                    if job.kind=='TRANSPORT':
                        workers=[w.model_copy(update={'room_ref':job.destination_room_ref}) if w.worker_ref==job.worker_ref else w for w in workers]
                    if job.machine_ref is not None:
                        cooldowns[job.machine_ref]=job.post_job_cooldown
                    events.append({'event_ref':job.job_event_ref,'job_ref':ref,'input_unit_refs':job.input_unit_refs,
                        'output_unit_refs':tuple(o.unit_ref for o in job.outputs),'kind':job.kind})
                snapshot=snapshot.model_copy(update={'stock':stock,'workers':tuple(workers)})
            if request.cooldown_phase=='AFTER_JOBS':
                cooldowns={ref:max(0,value-request.cooldown_tick) for ref,value in sorted(cooldowns.items())}
            if request.post_work_separation_supported:
                used=set()
                domains=dict(request.separation_room_domains)
                workers={w.worker_ref:w for w in snapshot.workers}
                separated=[]
                for ref in snapshot.worker_priority:
                    worker=workers[ref]
                    room=worker.room_ref
                    if room in used:
                        room=next((r for r in domains.get(ref,()) if r not in used),None)
                        if room is None:
                            return d_result(request,'NEEDS_EVIDENCE','WORKER_SEPARATION_LAW_INCOMPLETE',examined=budget.examined)
                    used.add(room)
                    separated.append(worker.model_copy(update={'room_ref':room}))
                snapshot=snapshot.model_copy(update={'workers':tuple(separated)})
            cause='ONE_SHARED_PAID_TURN'
        snapshot=snapshot.model_copy(update={'machine_cooldowns':tuple(sorted(cooldowns.items()))})
        snapshot,final_options=_refresh_native_settings(snapshot,budget,request.domain_bound)
        resource=request.remaining_resource-debit
        counts={}
        for unit in snapshot.stock:
            counts[(unit.room_ref,unit.type_ref)]=counts.get((unit.room_ref,unit.type_ref),0)+1
        worker_rooms={w.worker_ref:w.room_ref for w in snapshot.workers}
        exact=(all(counts.get((t.room_ref,t.type_ref),0)==t.quantity if t.comparator=='EQ' else
            counts.get((t.room_ref,t.type_ref),0)>=t.quantity for t in request.material_targets) and
            all(worker_rooms[w]==r for w,r in request.worker_targets)) if request.goal_predicate_bound else None
        depleted=resource<0 if request.depletion_rule=='NEGATIVE' else resource<=0
        boundary,event=None,None
        pre_restore=snapshot
        checks=('GOAL','DEPLETION') if request.terminal_order=='GOAL_THEN_DEPLETION' else ('DEPLETION','GOAL')
        for check in checks:
            if check=='GOAL' and exact:
                boundary=request.goal_boundary_ref
                break
            if check=='DEPLETION' and depleted:
                boundary=request.depletion_boundary_ref
                if request.restored_snapshot is not None:
                    snapshot=request.restored_snapshot
                    resource=request.restored_resource
                    event=request.restore_event_ref
                    snapshot,final_options=_refresh_native_settings(snapshot,budget,request.domain_bound)
                break
        budget.finish()
        return d_result(request,'COMPLETE',cause,complete=True,examined=budget.examined,values={
            'snapshot':snapshot,'pre_restore_snapshot':pre_restore,'option_projection':final_options,
            'accepted_job_refs':accepted_jobs,'job_event_ledger':tuple(events),'primitive_debit':debit,'remaining_resource':resource,
            'boundary_ref':boundary,'restore_event_ref':event,'terminal_predicate_result':exact,
            'shared_work_turn_count':int(request.channel=='WORK'),'unladen_manual_relocation_introduced':False,
            'same_turn_output_used_as_input':False,'complete_response_boundary_count':1})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_atomic_shared_input':True,'work':error.frontier})
