"""One immutable material snapshot: joint opportunities and native arbitration."""
from __future__ import annotations
from itertools import product
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class StockOccurrenceD(FrozenModel):
    unit_ref: Ref
    type_ref: Ref
    room_ref: Ref
    slot_ref: Ref
    lineage_refs: tuple[Ref,...] = Field(default=(),max_length=128)


class SharedWorkerD(FrozenModel):
    worker_ref: Ref
    room_ref: Ref
    capability_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    native_setting_ref: Ref | None
    voluntarily_paused: bool


class RoomSlotsD(FrozenModel):
    room_ref: Ref
    ordered_slot_refs: tuple[Ref,...] = Field(default=(),max_length=4096)


class WorkOutputD(FrozenModel):
    unit_ref: Ref
    type_ref: Ref
    room_ref: Ref
    lineage_refs: tuple[Ref,...] = Field(default=(),max_length=128)


class SharedJobD(FrozenModel):
    job_ref: Ref
    activity_ref: Ref
    worker_ref: Ref
    kind: Literal['TRANSPORT','TRANSFORM']
    required_capability_ref: Ref
    source_room_ref: Ref
    destination_room_ref: Ref
    input_unit_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    required_input_types: tuple[tuple[Ref,int],...] = Field(min_length=1,max_length=128)
    outputs: tuple[WorkOutputD,...] = Field(min_length=1,max_length=128)
    machine_ref: Ref | None
    service_route_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    service_distance: int = Field(ge=0)
    identity_tie_order: int = Field(ge=0)
    post_job_cooldown: int = Field(ge=0)
    job_event_ref: Ref


class SharedWorkSnapshotD(FrozenModel):
    stock: tuple[StockOccurrenceD,...] = Field(default=(),max_length=4096)
    workers: tuple[SharedWorkerD,...] = Field(min_length=1,max_length=128)
    rooms: tuple[RoomSlotsD,...] = Field(min_length=1,max_length=128)
    jobs: tuple[SharedJobD,...] = Field(default=(),max_length=4096)
    machine_cooldowns: tuple[tuple[Ref,int],...] = Field(default=(),max_length=128)
    worker_priority: tuple[Ref,...] = Field(min_length=1,max_length=128)
    subset_priority: tuple[tuple[Ref,...],...] = Field(min_length=1,max_length=4096)

    @model_validator(mode='after')
    def identities(self):
        units={u.unit_ref:u for u in self.stock}
        workers={w.worker_ref:w for w in self.workers}
        rooms={r.room_ref:set(r.ordered_slot_refs) for r in self.rooms}
        if len(units)!=len(self.stock) or len(workers)!=len(self.workers) or len(rooms)!=len(self.rooms):
            raise ValueError('snapshot unit/worker/room identities duplicated')
        occupied=[(u.room_ref,u.slot_ref) for u in self.stock]
        if len(set(occupied))!=len(occupied) or any(u.room_ref not in rooms or u.slot_ref not in rooms[u.room_ref] for u in self.stock):
            raise ValueError('stock has duplicate or unbound room slots')
        if set(self.worker_priority)!=set(workers) or len(self.worker_priority)!=len(workers) or any(w.room_ref not in rooms for w in self.workers):
            raise ValueError('worker native priority or current room invalid')
        if len({j.job_ref for j in self.jobs})!=len(self.jobs) or any(j.worker_ref not in workers or
                j.source_room_ref not in rooms or j.destination_room_ref not in rooms or len(set(j.input_unit_refs))!=len(j.input_unit_refs)
                or any(o.room_ref not in rooms for o in j.outputs) for j in self.jobs):
            raise ValueError('configured job identity/binding domain invalid')
        if any(not set(s)<=set(workers) or len(set(s))!=len(s) for s in self.subset_priority):
            raise ValueError('native subset order contains unknown/duplicate workers')
        if len(dict(self.machine_cooldowns))!=len(self.machine_cooldowns) or any(n<0 for _,n in self.machine_cooldowns):
            raise ValueError('machine cooldown map invalid')
        if any(len(dict(j.required_input_types))!=len(j.required_input_types) or any(n<1 for _,n in j.required_input_types) or
                len({o.unit_ref for o in j.outputs})!=len(j.outputs) for j in self.jobs):
            raise ValueError('job type counts/output identities duplicated or nonpositive')
        if any(len(set(r.ordered_slot_refs))!=len(r.ordered_slot_refs) for r in self.rooms):
            raise ValueError('room slot identity duplicated')
        return self


def _correlated_snapshot_options(snapshot,budget,domain_bound):
    options,rejections=_eligible_jobs(snapshot,budget)
    domains=[(None,)+tuple(options[w.worker_ref]) for w in snapshot.workers]
    cardinality=1
    for domain in domains:cardinality*=len(domain)
    if cardinality>domain_bound:
        raise DComputationInterrupted('PRESENT_TUPLE_DOMAIN_BOUND',{})
    tuples,projection=[],{w.worker_ref:{} for w in snapshot.workers}
    for index,combination in enumerate(product(*domains)):
        reservation=_reserve_job_tuple(snapshot,tuple(j for j in combination if j is not None),budget)
        if reservation['feasible']:
            tuples.append({'tuple_index':index,'reservation':reservation})
            for job in combination:
                if job is not None:
                    projection[job.worker_ref].setdefault(job.activity_ref,[]).append(index)
    return tuples,projection,rejections


def _eligible_jobs(snapshot,budget):
    stock={u.unit_ref:u for u in snapshot.stock}
    workers={w.worker_ref:w for w in snapshot.workers}
    cooldowns=dict(snapshot.machine_cooldowns)
    options={w.worker_ref:[] for w in snapshot.workers}
    rejections=[]
    for job in snapshot.jobs:
        budget.visit({'stage':'snapshot_job_eligibility','job_ref':job.job_ref})
        worker=workers[job.worker_ref]
        reasons=[]
        inputs=[stock.get(ref) for ref in job.input_unit_refs]
        if worker.room_ref!=job.source_room_ref or job.required_capability_ref not in worker.capability_refs:
            reasons.append('WORKER_LOCATION_OR_CAPABILITY')
        if any(u is None or u.room_ref!=job.source_room_ref for u in inputs):
            reasons.append('STARTING_STOCK_NOT_PRESENT')
        else:
            counts={}
            for unit in inputs:
                counts[unit.type_ref]=counts.get(unit.type_ref,0)+1
            if counts!=dict(job.required_input_types):
                reasons.append('TYPED_RECIPE_INPUT_MISMATCH')
        if job.machine_ref is not None and (job.machine_ref not in cooldowns or cooldowns[job.machine_ref]!=0):
            reasons.append('MACHINE_NOT_READY')
        if job.kind=='TRANSPORT':
            if (len(inputs)!=1 or inputs[0] is None or len(job.outputs)!=1 or
                    job.outputs[0].unit_ref!=job.input_unit_refs[0] or job.outputs[0].type_ref!=inputs[0].type_ref or
                    job.outputs[0].room_ref!=job.destination_room_ref):
                reasons.append('TRANSPORT_MUST_PRESERVE_ONE_STOCK_IDENTITY')
        if job.kind=='TRANSFORM' and (job.destination_room_ref!=worker.room_ref or any(o.room_ref!=worker.room_ref for o in job.outputs)):
            reasons.append('TRANSFORMATION_CHANGED_STOCK_OWNERSHIP')
        if reasons:
            rejections.append({'job_ref':job.job_ref,'reasons':tuple(reasons)})
        else:
            options[job.worker_ref].append(job)
    return options,rejections


def _reserve_job_tuple(snapshot,jobs,budget):
    stock={u.unit_ref:u for u in snapshot.stock}
    reservations=set()
    machines=set()
    failures=[]
    for job in jobs:
        budget.visit({'stage':'simultaneous_input_reservation','job_ref':job.job_ref})
        reused=set(job.input_unit_refs)&reservations
        if reused:
            failures.append({'code':'SAME_STARTING_UNIT_RESERVED_TWICE','unit_refs':tuple(sorted(reused))})
        reservations.update(job.input_unit_refs)
        if job.machine_ref is not None:
            if job.machine_ref in machines:
                failures.append({'code':'EXCLUSIVE_MACHINE_CONFLICT','machine_ref':job.machine_ref})
            machines.add(job.machine_ref)
    departing=reservations
    occupied={(u.room_ref,u.slot_ref) for u in snapshot.stock if u.unit_ref not in departing}
    live_ids={u.unit_ref for u in snapshot.stock if u.unit_ref not in departing}
    slots={r.room_ref:r.ordered_slot_refs for r in snapshot.rooms}
    priority={ref:i for i,ref in enumerate(snapshot.worker_priority)}
    outputs=[]
    for job in sorted(jobs,key=lambda j:priority[j.worker_ref]):
        for output in job.outputs:
            budget.visit({'stage':'post_departure_slot_allocation','job_ref':job.job_ref,'unit_ref':output.unit_ref})
            free=next((slot for slot in slots[output.room_ref] if (output.room_ref,slot) not in occupied),None)
            if output.unit_ref in live_ids:
                failures.append({'code':'OUTPUT_RESOURCE_IDENTITY_CONFLICT','unit_ref':output.unit_ref})
            if free is None:
                failures.append({'code':'DESTINATION_CAPACITY','room_ref':output.room_ref,'job_ref':job.job_ref})
            else:
                occupied.add((output.room_ref,free))
                live_ids.add(output.unit_ref)
                outputs.append(StockOccurrenceD(unit_ref=output.unit_ref,type_ref=output.type_ref,room_ref=output.room_ref,
                    slot_ref=free,lineage_refs=output.lineage_refs))
    return {'job_refs':tuple(j.job_ref for j in jobs),'input_unit_refs':tuple(sorted(reservations)),
        'output_occurrences':tuple(outputs),'machine_refs':tuple(sorted(machines)),'failures':tuple(failures),
        'feasible':not failures,'same_turn_output_used_as_input':False}


class SharedSnapshotOpportunitiesRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.shared_snapshot_opportunities_request_d.v1'
    phase_ref: Literal['PRESENT_TURN_OPPORTUNITIES']
    snapshot: SharedWorkSnapshotD
    requested_projection: Literal['FULL_TUPLES','WORKER_OPTIONS','BOTH']
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.typed_material_workbench.shared_snapshot_opportunities','DOMAIN'),
    )


def measure_shared_snapshot_opportunities_d(request: SharedSnapshotOpportunitiesRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.snapshot.stock),len(request.snapshot.jobs),sum(len(r.ordered_slot_refs) for r in request.snapshot.rooms))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_PRESENT_TUPLE_DOMAIN_FROM_SNAPSHOT')
    budget=DWorkBudget(request)
    try:
        options,rejections=_eligible_jobs(request.snapshot,budget)
        domains=[(None,)+tuple(options[w.worker_ref]) for w in request.snapshot.workers]
        cardinality=1
        for domain in domains:cardinality*=len(domain)
        if cardinality>request.domain_bound:
            return d_result(request,'NEEDS_EVIDENCE','PRESENT_TUPLE_DOMAIN_BOUND',examined=budget.examined)
        tuples,projection=[],{w.worker_ref:{} for w in request.snapshot.workers}
        for index,combination in enumerate(product(*domains)):
            jobs=tuple(j for j in combination if j is not None)
            reservation=_reserve_job_tuple(request.snapshot,jobs,budget)
            if reservation['feasible']:
                tuples.append({'tuple_index':index,'reservation':reservation})
                for job in jobs:
                    projection[job.worker_ref].setdefault(job.activity_ref,[]).append(index)
        budget.finish()
        return d_result(request,'COMPLETE','CORRELATED_PRESENT_TURN_OPPORTUNITIES',complete=True,examined=budget.examined,
            values={'feasible_tuples':tuple(tuples) if request.requested_projection!='WORKER_OPTIONS' else (),
                'worker_options':projection if request.requested_projection!='FULL_TUPLES' else {},
                'eligibility_rejections':tuple(rejections),'projection_is_existential_from_feasible_tuples':True,
                'future_schedule_chosen':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_snapshot_tuple_domain':True,'work':error.frontier})


class PrioritySnapshotReservationRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.priority_snapshot_reservation_request_d.v1'
    phase_ref: Literal['CURRENT_NATIVE_ARBITRATION']
    snapshot: SharedWorkSnapshotD
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.typed_material_workbench.priority_snapshot_reservation','STEP_INTERNAL'),
    )


def _priority_snapshot_reservation(snapshot,budget):
    options,rejections=_eligible_jobs(snapshot,budget)
    workers={w.worker_ref:w for w in snapshot.workers}
    tried=[]
    for subset_index,subset in enumerate(snapshot.subset_priority):
        budget.visit({'stage':'supplied_subset_priority','subset_index':subset_index})
        domains=[]
        for ref in subset:
            worker=workers[ref]
            compatible=[] if worker.voluntarily_paused else [j for j in options[ref] if j.activity_ref==worker.native_setting_ref]
            domains.append(tuple(sorted(compatible,key=lambda j:(j.service_distance,j.identity_tie_order,j.job_ref))))
        if any(not d for d in domains):
            tried.append({'subset_index':subset_index,'reason':'CURRENT_SETTING_NOT_EXECUTABLE'})
            continue
        for combination in product(*domains):
            reservation=_reserve_job_tuple(snapshot,combination,budget)
            if reservation['feasible']:
                return reservation,rejections,tried
            tried.append({'subset_index':subset_index,'job_refs':reservation['job_refs'],'failures':reservation['failures']})
    return None,rejections,tried


def measure_priority_snapshot_reservation_d(request: PrioritySnapshotReservationRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.snapshot.stock),len(request.snapshot.jobs),len(request.snapshot.subset_priority))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_CURRENT_ARBITRATION_FROM_SNAPSHOT')
    budget=DWorkBudget(request)
    try:
        reservation,rejections,tried=_priority_snapshot_reservation(request.snapshot,budget)
        budget.finish()
        return d_result(request,'COMPLETE','NATIVE_SUBSET_PRIORITY_RESULT',complete=True,examined=budget.examined,
            values={'reservation':reservation,'eligibility_rejections':tuple(rejections),'discarded_subset_reservations':tuple(tried),
                'invented_maximum_cardinality_objective':False,'semantic_job_policy_selected':False,'new_external_inputs':0})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_native_arbitration':True,'work':error.frontier})
