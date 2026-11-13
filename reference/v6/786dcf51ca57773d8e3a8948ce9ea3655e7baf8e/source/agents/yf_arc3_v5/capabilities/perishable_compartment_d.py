"""One compartment input with sealed storage, aging, birth and fatal interruption."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class PerishableUnitD(FrozenModel):
    unit_ref: Ref
    type_ref: Ref
    compartment_ref: Ref
    storage_mode: Literal['STABLE_SOURCE','SEALED_INPUT','SEALED_SPARE','EXPOSED_OUTPUT']
    age: int = Field(ge=0)
    shelf_life: int = Field(ge=0)
    lineage_refs: tuple[Ref,...] = Field(default=(),max_length=128)


class CompartmentD(FrozenModel):
    compartment_ref: Ref
    capacity: int = Field(ge=0,le=4096)


class PerishableJobLawD(FrozenModel):
    job_ref: Ref
    device_ref: Ref
    required_ports: tuple[tuple[Ref,Ref],...] = Field(min_length=1,max_length=128)
    output_compartment_ref: Ref
    output_types: tuple[Ref,...] = Field(min_length=1,max_length=128)
    duration_ticks: int = Field(ge=1)
    output_shelf_life: int = Field(ge=0)


class RunningPerishableJobD(FrozenModel):
    job_ref: Ref
    remaining_ticks: int = Field(ge=0)
    reserved_output_unit_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    consumed_lineage_refs: tuple[Ref,...] = Field(default=(),max_length=128)


class PerishableInputBindingD(FrozenModel):
    input_ref: Ref
    kind: Literal['INJECT','START','RELOAD','WAIT']
    device_ref: Ref | None
    unit_ref: Ref | None
    destination_compartment_ref: Ref | None
    job_ref: Ref | None
    output_unit_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    paid_debit: int = Field(ge=0)
    paid_clock_ticks: int = Field(ge=0)
    rejected_debit: int = Field(ge=0)
    rejected_clock_ticks: int = Field(ge=0)
    is_delivery_input: bool
    maximum_delivery_age: int | None = Field(default=None,ge=0)


class PerishableCompartmentRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.perishable_compartment_request_d.v1'
    phase_ref: Literal['EXTERNAL_COMPARTMENT_INPUT']
    compartments: tuple[CompartmentD,...] = Field(min_length=1,max_length=128)
    units: tuple[PerishableUnitD,...] = Field(default=(),max_length=4096)
    jobs: tuple[PerishableJobLawD,...] = Field(default=(),max_length=128)
    running_jobs: tuple[RunningPerishableJobD,...] = Field(default=(),max_length=128)
    input_bindings: tuple[PerishableInputBindingD,...] = Field(min_length=1,max_length=128)
    bound_input_ref: Ref
    remaining_resource: int = Field(ge=0)
    phase_order: tuple[Literal['AGE','JOBS','BIRTH'],...] = Field(min_length=3,max_length=3)
    expiry_rule: Literal['AGE_GT_LIFE','AGE_GE_LIFE']
    fatal_expiry_compartment_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    recycle_destination_ref: Ref | None
    rejected_output_recycles: bool
    delivery_before_aging: bool
    clicking_working_device_advances: bool
    goal_delivery_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    already_delivered_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    goal_boundary_ref: Ref
    fatal_boundary_ref: Ref
    depletion_boundary_ref: Ref
    terminal_order: Literal['GOAL_THEN_DEPLETION','DEPLETION_THEN_GOAL']
    depletion_rule: Literal['NEGATIVE','NONPOSITIVE']
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.typed_material_workbench.perishable_compartment_external_primitive','STEP'),
    )

    @model_validator(mode='after')
    def compartments_and_ports(self):
        rooms={c.compartment_ref:c for c in self.compartments}
        jobs={j.job_ref:j for j in self.jobs}
        if len(rooms)!=len(self.compartments) or len(jobs)!=len(self.jobs) or len({u.unit_ref for u in self.units})!=len(self.units):
            raise ValueError('compartment/job/unit identities duplicated')
        if any(u.compartment_ref not in rooms for u in self.units) or any(sum(u.compartment_ref==ref for u in self.units)>c.capacity
                for ref,c in sorted(rooms.items())):
            raise ValueError('initial storage exceeds actual compartment capacity')
        if set(self.phase_order)!={'AGE','JOBS','BIRTH'} or self.phase_order.index('BIRTH')<self.phase_order.index('JOBS'):
            raise ValueError('phase transaction needs one aging, job and post-job birth boundary')
        if any(j.output_compartment_ref not in rooms or len({p for p,_ in j.required_ports})!=len(j.required_ports) or
                any(p not in rooms for p,_ in j.required_ports) for j in self.jobs):
            raise ValueError('job input ports/output ownership invalid')
        if any(r.job_ref not in jobs or len(r.reserved_output_unit_refs)!=len(jobs[r.job_ref].output_types) for r in self.running_jobs):
            raise ValueError('running job yield/identity reservation mismatch')
        reserved=[ref for job in self.running_jobs for ref in job.reserved_output_unit_refs]
        if len({jobs[r.job_ref].device_ref for r in self.running_jobs})!=len(self.running_jobs) or len(set(reserved))!=len(reserved) or set(reserved)&{u.unit_ref for u in self.units}:
            raise ValueError('running device or future output identity reserved twice')
        if len({i.input_ref for i in self.input_bindings})!=len(self.input_bindings) or self.recycle_destination_ref is not None and self.recycle_destination_ref not in rooms:
            raise ValueError('input or recycling binding invalid')
        return self


def measure_perishable_compartment_d(request: PerishableCompartmentRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.units),sum(c.capacity for c in request.compartments))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_ATOMIC_COMPARTMENT_INPUT')
    budget=DWorkBudget(request)
    try:
        capacities={c.compartment_ref:c.capacity for c in request.compartments}
        units={u.unit_ref:u for u in request.units}
        laws={j.job_ref:j for j in request.jobs}
        running=list(request.running_jobs)
        input_binding=next((i for i in request.input_bindings if i.input_ref==request.bound_input_ref),None)
        if input_binding is None:return d_result(request,'NEEDS_EVIDENCE','NATIVE_COMPARTMENT_INPUT_NOT_BOUND')
        events=[]
        delivered=set(request.already_delivered_refs)
        pending_delivery=None
        births=[]
        expired_refs=set()
        accepted=True
        cause='WAIT_INPUT'
        if input_binding.kind in ('INJECT','RELOAD'):
            unit=units.get(input_binding.unit_ref)
            destination=input_binding.destination_compartment_ref
            capacity=capacities.get(destination)
            reserved_count=sum(len(r.reserved_output_unit_refs) for r in running if laws[r.job_ref].output_compartment_ref==destination)
            if unit is None or capacity is None or sum(u.compartment_ref==destination and u.unit_ref!=input_binding.unit_ref for u in sorted(units.values(),key=lambda value:value.unit_ref))+reserved_count>=capacity:
                accepted=False
                cause='INPUT_OR_RECIPIENT_CAPACITY_REFUSAL'
            elif input_binding.kind=='RELOAD' and unit.storage_mode!='SEALED_SPARE':
                accepted=False
                cause='RELOAD_REQUIRES_ACTUAL_SEALED_SPARE'
            else:
                if input_binding.is_delivery_input:
                    if input_binding.maximum_delivery_age is None:return d_result(request,'NEEDS_EVIDENCE','DELIVERY_FRESHNESS_THRESHOLD_NOT_BOUND')
                    if request.delivery_before_aging:
                        if unit.age<=input_binding.maximum_delivery_age:
                            delivered.add(destination)
                        else:
                            accepted=False
                            cause='DELIVERY_AGE_REFUSAL'
                    else:
                        pending_delivery=(unit.unit_ref,destination,input_binding.maximum_delivery_age)
                if accepted and pending_delivery is None:
                    units[unit.unit_ref]=unit.model_copy(update={'compartment_ref':destination,'storage_mode':'SEALED_INPUT'})
                    events.append({'kind':'INJECT_OR_RELOAD','unit_ref':unit.unit_ref,'destination_ref':destination,'age_at_injection':unit.age})
                    cause='INPUT_PORT_FILLED'
        elif input_binding.kind=='START':
            law=laws.get(input_binding.job_ref)
            active=next((r for r in running if laws[r.job_ref].device_ref==input_binding.device_ref),None)
            if active is not None:
                accepted=request.clicking_working_device_advances
                cause='ALREADY_WORKING_ADVANCE' if accepted else 'WORKING_DEVICE_INPUT_IGNORED'
            elif law is None or law.device_ref!=input_binding.device_ref or len(input_binding.output_unit_refs)!=len(law.output_types):
                accepted=False
                cause='JOB_BINDING_REFUSAL'
            else:
                consumed=[]
                for port,type_ref in law.required_ports:
                    budget.visit({'stage':'distinct_input_port_reservation','port_ref':port})
                    unit=next((u for ref,u in sorted(units.items()) if ref not in consumed and u.compartment_ref==port and
                        u.type_ref==type_ref and u.storage_mode=='SEALED_INPUT'),None)
                    if unit is None:
                        accepted=False
                        break
                    consumed.append(unit.unit_ref)
                output_count=sum(u.compartment_ref==law.output_compartment_ref and u.unit_ref not in consumed for u in sorted(units.values(),key=lambda value:value.unit_ref))
                reserved_count=sum(len(r.reserved_output_unit_refs) for r in running if laws[r.job_ref].output_compartment_ref==law.output_compartment_ref)
                reserved_refs={ref for r in running for ref in r.reserved_output_unit_refs}
                if (output_count+reserved_count+len(law.output_types)>capacities[law.output_compartment_ref] or
                        len(set(input_binding.output_unit_refs))!=len(input_binding.output_unit_refs) or
                        any(ref in units or ref in reserved_refs for ref in input_binding.output_unit_refs)):
                    accepted=False
                if accepted:
                    for ref in consumed:units.pop(ref)
                    running.append(RunningPerishableJobD(job_ref=law.job_ref,remaining_ticks=law.duration_ticks,
                        reserved_output_unit_refs=input_binding.output_unit_refs,consumed_lineage_refs=tuple(consumed)))
                    events.append({'kind':'JOB_STARTED_ONCE','job_ref':law.job_ref,'consumed_unit_refs':tuple(consumed)})
                    cause='JOB_STARTED'
                else:
                    cause='JOB_INPUT_OR_OUTPUT_RESERVATION_REFUSAL'
        debit=input_binding.paid_debit if accepted else input_binding.rejected_debit
        ticks=input_binding.paid_clock_ticks if accepted else input_binding.rejected_clock_ticks
        resource=request.remaining_resource-debit
        fatal=False
        for phase in request.phase_order:
            budget.visit({'stage':'owned_paid_phase','phase':phase})
            if phase=='AGE':
                for ref,unit in sorted(tuple(units.items())):
                    if unit.storage_mode!='EXPOSED_OUTPUT':continue
                    aged=unit.model_copy(update={'age':unit.age+ticks})
                    expired=aged.age>aged.shelf_life if request.expiry_rule=='AGE_GT_LIFE' else aged.age>=aged.shelf_life
                    if not expired:
                        units[ref]=aged
                        continue
                    events.append({'kind':'EXPOSED_OUTPUT_EXPIRED','unit_ref':ref,'age':aged.age})
                    expired_refs.add(ref)
                    units.pop(ref)
                    if unit.compartment_ref in request.fatal_expiry_compartment_refs:
                        fatal=True
                        break
                    destination=request.recycle_destination_ref
                    if destination is not None and sum(u.compartment_ref==destination for u in sorted(units.values(),key=lambda value:value.unit_ref))<capacities[destination]:
                        units[ref]=aged.model_copy(update={'compartment_ref':destination,'storage_mode':'STABLE_SOURCE','age':0})
                        events.append({'kind':'ORDINARY_RECYCLE','unit_ref':ref,'destination_ref':destination})
                if fatal:break
            elif phase=='JOBS':
                continuing=[]
                for job in running:
                    budget.visit({'stage':'running_job_clock','job_ref':job.job_ref})
                    remaining=max(0,job.remaining_ticks-ticks)
                    if remaining:
                        continuing.append(job.model_copy(update={'remaining_ticks':remaining}))
                    else:
                        births.append(job)
                running=continuing
            else:
                for job in births:
                    law=laws[job.job_ref]
                    for ref,type_ref in zip(job.reserved_output_unit_refs,law.output_types):
                        budget.visit({'stage':'supported_output_birth','unit_ref':ref})
                        if ref in units or sum(u.compartment_ref==law.output_compartment_ref for u in sorted(units.values(),key=lambda value:value.unit_ref))>=capacities[law.output_compartment_ref]:
                            return d_result(request,'NEEDS_EVIDENCE','RESERVED_OUTPUT_IDENTITY_OR_CAPACITY_CONTRADICTION',examined=budget.examined)
                        units[ref]=PerishableUnitD(unit_ref=ref,type_ref=type_ref,compartment_ref=law.output_compartment_ref,
                            storage_mode='EXPOSED_OUTPUT',age=0,shelf_life=law.output_shelf_life,lineage_refs=job.consumed_lineage_refs)
                        events.append({'kind':'PRODUCED_NOT_DELIVERED','unit_ref':ref,'job_ref':job.job_ref,'birth_age':0})
                births=[]
        if pending_delivery is not None and not fatal:
            ref,destination,maximum=pending_delivery
            unit=units.get(ref)
            if unit is not None and ref not in expired_refs and unit.storage_mode=='EXPOSED_OUTPUT' and unit.age<=maximum:
                delivered.add(destination)
                units[ref]=unit.model_copy(update={'compartment_ref':destination,'storage_mode':'SEALED_INPUT'})
                events.append({'kind':'DELIVERY_CONFIRMED_AFTER_SUPPORTED_AGING','unit_ref':ref,'age':unit.age})
            elif unit is not None and request.rejected_output_recycles and request.recycle_destination_ref is not None:
                recycled=request.recycle_destination_ref
                if sum(u.compartment_ref==recycled for u in sorted(units.values(),key=lambda value:value.unit_ref))<capacities[recycled]:
                    units[ref]=unit.model_copy(update={'compartment_ref':recycled,'storage_mode':'STABLE_SOURCE','age':0})
                    events.append({'kind':'REJECTED_DELIVERY_RECYCLED','unit_ref':ref,'destination_ref':recycled})
        exact=bool(request.goal_delivery_refs) and set(request.goal_delivery_refs)<=delivered
        depleted=resource<0 if request.depletion_rule=='NEGATIVE' else resource<=0
        boundary=request.fatal_boundary_ref if fatal else None
        if not fatal:
            for check in (('GOAL','DEPLETION') if request.terminal_order=='GOAL_THEN_DEPLETION' else ('DEPLETION','GOAL')):
                if check=='GOAL' and exact:
                    boundary=request.goal_boundary_ref;break
                if check=='DEPLETION' and depleted:
                    boundary=request.depletion_boundary_ref;break
        budget.finish()
        return d_result(request,'COMPLETE','FATAL_EXPIRY_INTERRUPTED_PACKET' if fatal else cause,complete=True,examined=budget.examined,
            values={'units':tuple(units[ref] for ref in sorted(units)),'running_jobs':tuple(running),'uncommitted_births':tuple(births),
                'delivery_refs':tuple(sorted(delivered)),'event_ledger':tuple(events),'primitive_debit':debit,'paid_clock_ticks':ticks,
                'remaining_resource':resource,'boundary_ref':boundary,'fatal_phase_interrupt':fatal,
                'sealed_or_source_stock_aged':False,'running_device_restarted':False,'complete_response_boundary_count':1})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_atomic_compartment_input':True,'work':error.frontier})
