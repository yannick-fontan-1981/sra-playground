"""Identity-preserving pickup/release under evidenced context and velocity laws."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class InventoryBodyD(FrozenModel):
    identity_ref: Ref
    ownership: Literal['ATTACHED','FREE']
    origin: tuple[int,int]
    velocity: tuple[int,int]
    rigid_offset: tuple[int,int] | None
    physical_offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    admitted_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)


class InventoryTransitionLawD(FrozenModel):
    law_ref: Ref
    event_ref: Ref
    kind: Literal['PICKUP','RELEASE']
    admitted_input_context_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    carrier_displacement: tuple[int,int]
    velocity_rule: Literal['PRESERVE_BODY','COPY_CARRIER','SUPPLIED']
    supplied_velocity: tuple[int,int] | None
    requires_carrier_support: bool
    requires_body_support: bool
    law_evidence_ref: Ref


class InventorySiteD(FrozenModel):
    site_ref: Ref
    identity_ref: Ref
    law_ref: Ref
    source_body_origin: tuple[int,int]
    source_carrier_origin: tuple[int,int]
    destination_body_origin: tuple[int,int]
    admitted_body_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    body_supported: bool | None


class InventoryReleaseDomainRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.inventory_release_domain_request_d.v1'
    phase_ref: Literal['CURRENT_INVENTORY_INCIDENCES','INTERNAL_OWNERSHIP_TRANSFER']
    carrier_ref: Ref
    carrier_origin: tuple[int,int]
    carrier_velocity: tuple[int,int]
    carrier_supported: bool | None
    carrier_physical_offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    admitted_carrier_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    bodies: tuple[InventoryBodyD,...] = Field(min_length=1,max_length=4096)
    laws: tuple[InventoryTransitionLawD,...] = Field(min_length=1,max_length=128)
    sites: tuple[InventorySiteD,...] = Field(default=(),max_length=4096)
    current_input_context_ref: Ref
    bound_site_ref: Ref | None
    fixed_occupancy_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.oriented_cargo_handoffs.inventory_release_domain','DOMAIN'),
        ('mechanics.oriented_cargo_handoffs.inventory_release_domain','STEP_INTERNAL'),
    )

    @model_validator(mode='after')
    def single_ownership(self):
        bodies={b.identity_ref:b for b in self.bodies}
        laws={l.law_ref:l for l in self.laws}
        if len(bodies)!=len(self.bodies) or len(laws)!=len(self.laws) or self.carrier_ref in bodies:
            raise ValueError('inventory/resource identities or law identities duplicated')
        for body in self.bodies:
            if body.ownership=='ATTACHED' and (body.rigid_offset is None or body.origin!=(self.carrier_origin[0]+body.rigid_offset[0],
                    self.carrier_origin[1]+body.rigid_offset[1])) or body.ownership=='FREE' and body.rigid_offset is not None:
                raise ValueError('attached and free states must represent one consistent physical identity')
        if len({s.site_ref for s in self.sites})!=len(self.sites) or any(s.identity_ref not in bodies or s.law_ref not in laws for s in self.sites):
            raise ValueError('pickup/release incidence domain invalid')
        if any(l.velocity_rule=='SUPPLIED' and l.supplied_velocity is None for l in self.laws):
            raise ValueError('supplied velocity transition law is incomplete')
        if self.mode_ref=='DOMAIN' and self.phase_ref!='CURRENT_INVENTORY_INCIDENCES' or self.mode_ref=='STEP_INTERNAL' and self.phase_ref!='INTERNAL_OWNERSHIP_TRANSFER':
            raise ValueError('inventory operation phase mismatch')
        return self


def measure_inventory_release_domain_d(request: InventoryReleaseDomainRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.sites),sum(len(b.physical_offsets) for b in request.bodies),sum(len(s.admitted_body_cells) for s in request.sites),
            len(request.admitted_carrier_cells),len(request.fixed_occupancy_cells))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request,'NEEDS_EVIDENCE','RESTART_INVENTORY_FROM_BOUND_STATE')
    if request.mode_ref=='STEP_INTERNAL' and request.bound_site_ref is None:
        return d_result(request,'NEEDS_EVIDENCE','OWNERSHIP_INCIDENCE_NOT_BOUND')
    budget=DWorkBudget(request)
    try:
        bodies={b.identity_ref:b for b in request.bodies}
        laws={l.law_ref:l for l in request.laws}
        rows=[]
        for site in request.sites:
            budget.visit({'stage':'current_release_or_pickup','site_ref':site.site_ref})
            body,law=bodies[site.identity_ref],laws[site.law_ref]
            blockers=[]
            unknown=False
            expected='ATTACHED' if law.kind=='RELEASE' else 'FREE'
            if body.ownership!=expected or body.origin!=site.source_body_origin or request.carrier_origin!=site.source_carrier_origin:
                blockers.append({'code':'OWNERSHIP_OR_SOURCE_POSE_MISMATCH'})
            if request.current_input_context_ref not in law.admitted_input_context_refs:
                blockers.append({'code':'INPUT_CONTEXT_NOT_ADMITTED'})
            for required,supported,label in ((law.requires_carrier_support,request.carrier_supported,'CARRIER'),
                    (law.requires_body_support,site.body_supported,'BODY')):
                if required and supported is None:
                    unknown=True
                elif required and not supported:
                    blockers.append({'code':'REQUIRED_SUPPORT_ABSENT','support_domain':label})
            carrier=(request.carrier_origin[0]+law.carrier_displacement[0],request.carrier_origin[1]+law.carrier_displacement[1])
            occupied=set(request.fixed_occupancy_cells)
            for other in request.bodies:
                if other.identity_ref!=body.identity_ref and other.ownership=='FREE':
                    for x,y in other.physical_offsets:
                        budget.visit({'stage':'free_body_occupancy','identity_ref':other.identity_ref})
                        occupied.add((other.origin[0]+x,other.origin[1]+y))
            permitted=set(site.admitted_body_cells)
            for x,y in body.physical_offsets:
                budget.visit({'stage':'body_transition_admission','site_ref':site.site_ref})
                cell=(site.destination_body_origin[0]+x,site.destination_body_origin[1]+y)
                if cell not in permitted or cell in occupied:
                    blockers.append({'code':'BODY_ADMISSION_OR_COLLISION','cell':cell})
            allowed_carrier=set(request.admitted_carrier_cells)
            for x,y in request.carrier_physical_offsets:
                budget.visit({'stage':'carrier_lift_admission','site_ref':site.site_ref})
                cell=(carrier[0]+x,carrier[1]+y)
                if cell not in allowed_carrier or cell in occupied:
                    blockers.append({'code':'CARRIER_ADMISSION_OR_COLLISION','cell':cell})
            for other in request.bodies:
                if other.identity_ref==body.identity_ref or other.ownership!='ATTACHED':
                    continue
                allowed=set(other.admitted_cells)
                origin=(carrier[0]+other.rigid_offset[0],carrier[1]+other.rigid_offset[1])
                for x,y in other.physical_offsets:
                    budget.visit({'stage':'carried_closure_admission','identity_ref':other.identity_ref})
                    cell=(origin[0]+x,origin[1]+y)
                    if cell not in allowed or cell in occupied:
                        blockers.append({'code':'OTHER_CARRIED_BODY_ADMISSION_OR_COLLISION','identity_ref':other.identity_ref,'cell':cell})
            admissible=False if blockers else None if unknown else True
            rows.append({'site_ref':site.site_ref,'admissible':admissible,'blocking_witnesses':tuple(blockers),
                'destination_carrier_origin':carrier,'destination_body_origin':site.destination_body_origin})
        population=list(request.bodies)
        carrier=request.carrier_origin
        event=None
        if request.mode_ref=='STEP_INTERNAL':
            row=next((r for r in rows if r['site_ref']==request.bound_site_ref),None)
            if row is None or row['admissible'] is None:
                return d_result(request,'NEEDS_EVIDENCE','BOUND_INCIDENCE_OR_SUPPORT_NOT_KNOWN',examined=budget.examined,values={'incidences':tuple(rows)})
            if row['admissible']:
                site=next(s for s in request.sites if s.site_ref==request.bound_site_ref)
                law=laws[site.law_ref]
                carrier=row['destination_carrier_origin']
                updated=[]
                for body in population:
                    if body.identity_ref==site.identity_ref:
                        ownership='FREE' if law.kind=='RELEASE' else 'ATTACHED'
                        origin=site.destination_body_origin
                        velocity=(body.velocity if law.velocity_rule=='PRESERVE_BODY' else request.carrier_velocity
                            if law.velocity_rule=='COPY_CARRIER' else law.supplied_velocity)
                        offset=None if ownership=='FREE' else (origin[0]-carrier[0],origin[1]-carrier[1])
                        updated.append(body.model_copy(update={'ownership':ownership,'origin':origin,'velocity':velocity,'rigid_offset':offset}))
                    elif body.ownership=='ATTACHED':
                        updated.append(body.model_copy(update={'origin':(carrier[0]+body.rigid_offset[0],carrier[1]+body.rigid_offset[1])}))
                    else:
                        updated.append(body)
                population=updated
                event=law.event_ref
        budget.finish()
        unknown=any(r['admissible'] is None for r in rows) if request.mode_ref=='DOMAIN' else False
        return d_result(request,'NEEDS_EVIDENCE' if unknown else 'COMPLETE','SUPPORT_EVIDENCE_MISSING' if unknown else 'INVENTORY_TRANSITION_RESULT',
            complete=not unknown,examined=budget.examined,values={'incidences':tuple(rows),'population':tuple(population),
                'carrier_origin':carrier,'carrier_velocity':request.carrier_velocity,'transfer_event_ref':event,
                'resource_identity_count':len(population),'free_body_destroyed':False,'portal_immunity_introduced':False,
                'new_external_inputs':0})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_inventory_transition':True,'work':error.frontier})
