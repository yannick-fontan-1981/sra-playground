"""Layer-correlated catalogue projection; hidden pixels never become negatives."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


def iter_integer_mask_projection_d(points, scale, translation):
    """Exact full projection; clipping and interpretation belong to the caller.

    Keep the original pixel/subpixel order, including points outside a viewport,
    so callers retain their existing work accounting and occlusion semantics.
    """
    for row, col in points:
        for sr in range(scale):
            for sc in range(scale):
                yield translation[0] + row*scale + sr, translation[1] + col*scale + sc


class CatalogueMaskPixelD(FrozenModel):
    point: tuple[int,int]
    value_ref: Ref


class CatalogueMaskD(FrozenModel):
    candidate_ref: Ref
    pixels: tuple[CatalogueMaskPixelD,...] = Field(min_length=1,max_length=4096)
    supported_integer_scales: tuple[int,...] = Field(min_length=1,max_length=128)
    mask_provenance_ref: Ref


class CataloguePoseD(FrozenModel):
    object_ref: Ref
    candidate_ref: Ref
    scale: int = Field(ge=1)
    translation: tuple[int,int]
    opaque: bool
    pose_provenance_ref: Ref


class CatalogueViewAssignmentD(FrozenModel):
    view_ref: Ref
    poses: tuple[CataloguePoseD,...] = Field(min_length=1,max_length=128)
    top_to_bottom_object_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    occluder_provenance_ref: Ref


class CatalogueProjectionAssignmentD(FrozenModel):
    model_ref: Ref
    views: tuple[CatalogueViewAssignmentD,...] = Field(min_length=1,max_length=128)


class SealedCatalogueViewD(FrozenModel):
    view_ref: Ref
    evidence_revision_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    viewport_cells: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    queried_object_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    visible_present: tuple[CatalogueMaskPixelD,...] = Field(default=(),max_length=4096)
    visible_absent: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    unobserved_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)


class OccludedCatalogueProjectionRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.occluded_catalogue_projection_request_d.v1'
    phase_ref: Literal['REGISTERED_LAYERED_VIEWS']
    masks: tuple[CatalogueMaskD,...] = Field(min_length=1,max_length=128)
    models: tuple[CatalogueProjectionAssignmentD,...] = Field(min_length=1,max_length=128)
    registered_views: tuple[SealedCatalogueViewD,...] = Field(min_length=1,max_length=128)
    requested_view_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.transform_pose_candidates.occluded_catalogue_projection','DOMAIN'),
        ('mechanics.transform_pose_candidates.occluded_catalogue_projection','COMPARE'),
    )

    @model_validator(mode='after')
    def assignments(self):
        masks={m.candidate_ref:m for m in self.masks}
        view_ids={v.view_ref for v in self.registered_views}
        if len(masks)!=len(self.masks) or len(view_ids)!=len(self.registered_views) or not set(self.requested_view_refs)<=view_ids:
            raise ValueError('catalogue/view identity domain invalid')
        for mask in self.masks:
            if len({p.point for p in mask.pixels})!=len(mask.pixels) or any(s<1 for s in mask.supported_integer_scales):
                raise ValueError('candidate mask/scale grammar invalid')
        for model in self.models:
            if len({v.view_ref for v in model.views})!=len(model.views):raise ValueError('model view assignment duplicated')
            for view in model.views:
                ids={p.object_ref for p in view.poses}
                if len(ids)!=len(view.poses) or set(view.top_to_bottom_object_refs)!=ids or len(view.top_to_bottom_object_refs)!=len(ids):
                    raise ValueError('layer order must bind each persistent object exactly once')
                if any(p.candidate_ref not in masks or p.scale not in masks[p.candidate_ref].supported_integer_scales for p in view.poses):
                    raise ValueError('unavailable catalogue transform is outside the assignment domain')
        if self.mode_ref=='COMPARE' and set(self.requested_view_refs)!=view_ids:
            raise ValueError('compare must preserve every registered view, not only the repeated final view')
        return self


def measure_occluded_catalogue_projection_d(request: OccludedCatalogueProjectionRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(sum(len(m.pixels) for m in request.masks),sum(len(v.viewport_cells) for v in request.registered_views))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_CORRELATED_LAYER_ASSIGNMENTS')
    budget=DWorkBudget(request)
    try:
        masks={m.candidate_ref:m for m in request.masks}
        views={v.view_ref:v for v in request.registered_views}
        rows=[]
        unresolved_any=False
        for model in request.models:
            assigned={v.view_ref:v for v in model.views}
            contradictions,unresolved,checks=[],[],[]
            for ref in request.requested_view_refs:
                view=views[ref]
                layout=assigned.get(ref)
                if not view.sealed or view.epoch!=request.scope.epoch or layout is None:
                    unresolved.append(ref);continue
                viewport=set(view.viewport_cells)
                unknown=set(view.unobserved_cells)
                query=set(view.queried_object_refs)
                if not query<=set(layout.top_to_bottom_object_refs):
                    unresolved.append(ref);continue
                rendered={}
                pose_map={p.object_ref:p for p in layout.poses}
                for object_ref in reversed(layout.top_to_bottom_object_refs):
                    pose=pose_map[object_ref]
                    mask=masks[pose.candidate_ref]
                    for pixel in mask.pixels:
                        for point in iter_integer_mask_projection_d((pixel.point,), pose.scale, pose.translation):
                            budget.visit({'stage':'licensed_full_mask_projection','model_ref':model.model_ref,'view_ref':ref,'object_ref':object_ref})
                            if point in viewport:
                                if pose.opaque or point not in rendered:rendered[point]=(pixel.value_ref,object_ref,mask.mask_provenance_ref,pose.pose_provenance_ref)
                present={p.point:p.value_ref for p in view.visible_present}
                for point in sorted(set(present)|set(view.visible_absent)):
                    budget.visit({'stage':'truly_visible_observation','view_ref':ref,'point':point})
                    if point not in viewport or point in unknown:continue
                    prediction=rendered.get(point)
                    if prediction is not None and prediction[1] not in query:
                        continue  # Occluder coverage is not queried-object absence.
                    positive=point in present
                    mismatch=(prediction is None or prediction[0]!=present[point]) if positive else prediction is not None
                    row={'view_ref':ref,'evidence_revision_ref':view.evidence_revision_ref,'point':point,
                        'observed_present':positive,'expected_value_ref':present.get(point),'projected_pixel':prediction,
                        'occluder_provenance_ref':layout.occluder_provenance_ref}
                    checks.append(row)
                    if mismatch:contradictions.append(row)
            unresolved_any=unresolved_any or bool(unresolved)
            rows.append({'model_ref':model.model_ref,'contradicting_visible_pixels':tuple(contradictions),
                'checked_view_pixels':tuple(checks),'unresolved_view_refs':tuple(unresolved),'consistent':not contradictions})
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if unresolved_any else 'COMPLETE','UNREGISTERED_OR_UNSEALED_VIEW' if unresolved_any else 'LAYER_CORRELATED_CATALOGUE_DOMAIN',
            complete=not unresolved_any,examined=budget.examined,values={'assignment_rows':tuple(rows),
                'consistent_model_refs':tuple(r['model_ref'] for r in rows if r['consistent']),
                'occluded_or_clipped_pixel_used_as_negative':False,'intermediate_registered_view_discarded':False,
                'reference_restoration_target_created':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_layered_projection':True,'work':error.frontier})
