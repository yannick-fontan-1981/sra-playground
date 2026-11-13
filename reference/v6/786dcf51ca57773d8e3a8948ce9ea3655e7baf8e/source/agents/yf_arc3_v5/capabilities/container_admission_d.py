"""Subtree volume admission, independent of porous passage connectivity."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result, d_input_digest


class ContainerVolumeD(FrozenModel):
    identity_ref: Ref
    parent_ref: Ref | None
    world_origin: tuple[int,int]
    volume_offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    interior_offsets: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    passage_wall_offsets: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)


class ContainerAdmissionRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.container_admission_request_d.v1'
    phase_ref: Literal['SUBTREE_GEOMETRY']
    containers: tuple[ContainerVolumeD,...] = Field(min_length=1,max_length=128)
    moving_root_ref: Ref
    candidate_displacements: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    world_admission_cells: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    fixed_partition_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    partition_domain: Literal['VOLUME','PASSAGE_WALL']
    transition_policy: Literal['ENDPOINT_ONLY','SUPPLIED_SWEEP']
    supplied_sweeps: tuple[tuple[tuple[int,int],tuple[tuple[int,int],...]],...] = Field(default=(),max_length=4096)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.articulated_channel_kinematics.container_admission','PRECONDITION'),
        ('mechanics.articulated_channel_kinematics.container_admission','DOMAIN'),
    )

    @model_validator(mode='after')
    def forest(self):
        nodes={c.identity_ref:c for c in self.containers}
        if len(nodes)!=len(self.containers) or self.moving_root_ref not in nodes:
            raise ValueError('container identity/root domain invalid')
        closed=set()
        for node in self.containers:
            trail,ref=set(),node.identity_ref
            while ref is not None and ref not in closed:
                if ref not in nodes or ref in trail:
                    raise ValueError('containment forest contains a missing parent or cycle')
                trail.add(ref)
                ref=nodes[ref].parent_ref
            closed.update(trail)
        if len(set(self.candidate_displacements))!=len(self.candidate_displacements):
            raise ValueError('candidate pose domain duplicated')
        sweeps={delta:steps for delta,steps in self.supplied_sweeps}
        if len(sweeps)!=len(self.supplied_sweeps) or any(not steps or steps[-1]!=delta for delta,steps in self.supplied_sweeps):
            raise ValueError('supplied mutation sweep must end at its exact displacement')
        if self.mode_ref=='PRECONDITION' and len(self.candidate_displacements)!=1:
            raise ValueError('precondition requests exactly one proposed subtree mutation')
        return self


def measure_container_admission_d(request: ContainerAdmissionRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.candidate_displacements),len(request.world_admission_cells),sum(len(c.volume_offsets)+len(c.interior_offsets)+
            len(c.passage_wall_offsets) for c in request.containers))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    budget,rows=DWorkBudget(request),[]
    if request.resume_frontier:
        f=request.resume_frontier
        if f.get('input_digest')!=d_input_digest(request):
            return d_result(request,'NEEDS_EVIDENCE','RESUME_INPUT_OR_REVISION_MISMATCH')
        rows=list(f.get('completed_pose_rows',()))
        if len(rows)>len(request.candidate_displacements) or any(tuple(r['displacement'])!=delta for r,delta in zip(rows,request.candidate_displacements)):
            return d_result(request,'NEEDS_EVIDENCE','RESUME_POSE_PREFIX_MISMATCH')
    try:
        moving={request.moving_root_ref}
        for _ in range(len(request.containers)):
            before=len(moving)
            for container in request.containers:
                budget.visit({'stage':'carried_closure','identity_ref':container.identity_ref})
                if container.parent_ref in moving:
                    moving.add(container.identity_ref)
            if len(moving)==before:
                break
        world,partitions=set(request.world_admission_cells),set(request.fixed_partition_cells)
        sweeps=dict(request.supplied_sweeps)
        for delta in request.candidate_displacements[len(rows):]:
            steps=(delta,) if request.transition_policy=='ENDPOINT_ONLY' else sweeps.get(delta)
            if steps is None:
                return d_result(request,'NEEDS_EVIDENCE','MUTATION_SWEEP_NOT_SUPPLIED',examined=budget.examined,
                    values={'completed_pose_rows':tuple(rows)})
            if len(steps)>request.depth_bound:
                raise DComputationInterrupted('SWEEP_DEPTH_BOUND',{'displacement':delta})
            rejections=[]
            final_poses={}
            for step in steps:
                volumes,interiors,walls={}, {}, {}
                for container in request.containers:
                    shift=step if container.identity_ref in moving else (0,0)
                    origin=(container.world_origin[0]+shift[0],container.world_origin[1]+shift[1])
                    final_poses[container.identity_ref]=origin
                    for offsets,table in ((container.volume_offsets,volumes),(container.interior_offsets,interiors),
                            (container.passage_wall_offsets,walls)):
                        cells=set()
                        for x,y in offsets:
                            budget.visit({'stage':'full_container_mask','identity_ref':container.identity_ref})
                            cells.add((origin[0]+x,origin[1]+y))
                        table[container.identity_ref]=cells
                for container in request.containers:
                    ref=container.identity_ref
                    if ref not in moving:
                        continue
                    admitting=world if container.parent_ref is None else interiors[container.parent_ref]
                    outside=volumes[ref]-admitting
                    if outside:
                        rejections.append({'code':'PARENT_VOLUME_ADMISSION','identity_ref':ref,'parent_ref':container.parent_ref,
                            'sweep_displacement':step,'outside_cells':tuple(sorted(outside))})
                    crossing=(volumes[ref] if request.partition_domain=='VOLUME' else walls[ref])&partitions
                    if crossing:
                        rejections.append({'code':'FIXED_PARTITION','identity_ref':ref,'constraint_domain':request.partition_domain,
                            'sweep_displacement':step,'overlap_cells':tuple(sorted(crossing))})
                    for sibling in request.containers:
                        if sibling.identity_ref==ref or sibling.parent_ref!=container.parent_ref:
                            continue
                        overlap=volumes[ref]&volumes[sibling.identity_ref]
                        if overlap:
                            rejections.append({'code':'SIBLING_VOLUME_OVERLAP','identity_ref':ref,'sibling_ref':sibling.identity_ref,
                                'sweep_displacement':step,'overlap_cells':tuple(sorted(overlap))})
            rows.append({'displacement':delta,'world_origins':final_poses,'carried_identity_refs':tuple(sorted(moving)),
                'geometrically_admissible':not rejections,'rejection_incidences':tuple(rejections),
                'reachability_status':'NOT_ESTABLISHED','control_word_certificate_present':False})
        budget.finish()
        return d_result(request,'COMPLETE','CONTAINER_GEOMETRY_RESULT',complete=True,examined=budget.examined,
            values={'pose_rows':tuple(rows),'admissible_displacements':tuple(r['displacement'] for r in rows if r['geometrically_admissible']),
                'reachability_status':'NOT_ESTABLISHED','porous_walls_used_as_volume':False,'extra_descendant_translation':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'input_digest':d_input_digest(request),'completed_pose_rows':tuple(rows),'restart_unfinished_pose':True,'work':error.frontier})
