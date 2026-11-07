"""Finite full-mask support, collision and terminal-containment certificates."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier


class IdentitySupportModelD(FrozenModel):
    model_ref: Ref
    identity_ref: Ref
    identity_evidence_ref: Ref
    support_evidence_ref: Ref
    full_offsets: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    admitted_support_cells: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    permitted_quarter_turns: tuple[int, ...] = Field(min_length=1, max_length=4)
    boundary_aperture_cells: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    terminal_target_cells: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    fixed_occupancy_cells: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    other_moving_occupancy_cells: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)

    @model_validator(mode='after')
    def rigid_mask(self):
        if len(set(self.full_offsets)) != len(self.full_offsets):
            raise ValueError('rigid mask pixels must be distinct')
        if len(set(self.permitted_quarter_turns)) != len(self.permitted_quarter_turns) or any(t not in (0,1,2,3) for t in self.permitted_quarter_turns):
            raise ValueError('supported quarter-turn domain is invalid')
        return self


class SupportPoseD(FrozenModel):
    pose_ref: Ref
    origin: tuple[int, int]
    quarter_turns: int = Field(ge=0, le=3)


class IdentityScopedSupportRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.identity_scoped_support_request_d.v1'
    phase_ref: Literal['CONFIGURATION_SPACE']
    models: tuple[IdentitySupportModelD, ...] = Field(min_length=1, max_length=128)
    poses: tuple[SupportPoseD, ...] = Field(min_length=1, max_length=4096)
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.transform_pose_candidates.identity_scoped_support','DOMAIN'),
        ('mechanics.transform_pose_candidates.identity_scoped_support','PRECONDITION'),
    )

    @model_validator(mode='after')
    def pose_domain(self):
        if len({p.pose_ref for p in self.poses}) != len(self.poses):
            raise ValueError('pose identities must be distinct')
        return self


def _rotated(offset, turns):
    x,y = offset
    for _ in range(turns):
        x,y = -y,x
    return x,y


def measure_identity_scoped_support_d(request: IdentityScopedSupportRequestD):
    rejection = d_validate_request(request)
    if rejection is not None:
        return rejection
    if request.mode_ref == 'PRECONDITION' and len(request.poses) != 1:
        return d_result(request,'NEEDS_EVIDENCE','ONE_PRECONDITION_POSE_REQUIRED')
    sizes = [len(request.models),len(request.poses)]
    sizes.extend(len(m.full_offsets)+len(m.admitted_support_cells)+len(m.fixed_occupancy_cells)+
        len(m.other_moving_occupancy_cells)+len(m.terminal_target_cells)+len(m.boundary_aperture_cells) for m in request.models)
    if max(sizes) > request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    budget, rows, current = DWorkBudget(request), [], None
    try:
        rows = d_resume_rows(request,tuple(m.model_ref for m in request.models))
        for model in request.models[len(rows):]:
            current = model.model_ref
            support, aperture = set(model.admitted_support_cells), set(model.boundary_aperture_cells)
            occupied = set(model.fixed_occupancy_cells) | set(model.other_moving_occupancy_cells)
            target = set(model.terminal_target_cells)
            results = []
            for pose in request.poses:
                budget.visit({'stage':'requested_pose','model_ref':current,'pose_ref':pose.pose_ref})
                if pose.quarter_turns not in model.permitted_quarter_turns:
                    results.append({'pose_ref':pose.pose_ref,'transform_supported':False,'admissible':False,
                        'terminal_containment':False,'identity_ref':model.identity_ref})
                    continue
                cells = set()
                for offset in model.full_offsets:
                    budget.visit({'stage':'full_mask','model_ref':current,'pose_ref':pose.pose_ref})
                    x,y = _rotated(offset,pose.quarter_turns)
                    cells.add((pose.origin[0]+x,pose.origin[1]+y))
                rejected, collisions = cells-support, cells&occupied
                admissible = not rejected and not collisions
                results.append({'pose_ref':pose.pose_ref,'identity_ref':model.identity_ref,
                    'identity_evidence_ref':model.identity_evidence_ref,'support_evidence_ref':model.support_evidence_ref,
                    'transform_supported':True,'admissible':admissible,
                    'rejected_support_cells':tuple(sorted(rejected)), 'collision_cells':tuple(sorted(collisions)),
                    'aperture_contact_cells':tuple(sorted(cells&aperture)),
                    'identity_rejected_aperture_cells':tuple(sorted(rejected&aperture)),
                    'full_mask_inside_target':bool(target) and cells <= target,
                    'terminal_containment':admissible and bool(target) and cells <= target})
            rows.append({'model_ref':current,'identity_ref':model.identity_ref,'pose_results':tuple(results),
                'admissible_pose_refs':tuple(r['pose_ref'] for r in results if r['admissible']),
                'terminal_fit_pose_refs':tuple(r['pose_ref'] for r in results if r['terminal_containment'])})
        budget.finish()
        return d_result(request,'COMPLETE','IDENTITY_SCOPED_POSE_DOMAIN',complete=True,examined=budget.examined,
            values={'model_correlated_results':tuple(rows)})
    except DResumeMismatch as error:
        return d_result(request,'NEEDS_EVIDENCE',str(error),examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            values={'model_correlated_results':tuple(rows)},
            frontier=d_resumable_frontier(request,rows,current,error.frontier))
