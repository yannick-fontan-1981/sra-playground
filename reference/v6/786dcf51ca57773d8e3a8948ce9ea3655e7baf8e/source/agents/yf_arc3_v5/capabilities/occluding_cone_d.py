"""Finite cone alternatives and exact, explicitly licensed raster occlusion."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class ConeViewD(FrozenModel):
    view_ref: Ref
    emitter_origin: tuple[int,int]
    emitter_direction: tuple[int,int]
    sample_to_field: tuple[tuple[int,int,int],tuple[int,int,int]]
    opaque_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    unknown_opacity_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)


class ConeModelD(FrozenModel):
    model_ref: Ref
    views: tuple[ConeViewD,...] = Field(min_length=1,max_length=128)
    cosine_sign: Literal[-1,0,1]
    cosine_squared_numerator: int = Field(ge=0)
    cosine_squared_denominator: int = Field(ge=1)
    range_squared: int = Field(ge=0)
    range_inclusive: bool
    angular_inclusive: bool
    discretization: Literal['BRESENHAM','SUPERCOVER']
    corner_rule: Literal['EITHER_OPAQUE_BLOCKS','BOTH_OPAQUE_BLOCK','UNOBSERVED']
    emitter_self_lit: bool | None
    ignore_emitter_opacity: bool
    ignore_endpoint_opacity: bool

    @model_validator(mode='after')
    def law(self):
        if self.cosine_squared_numerator>self.cosine_squared_denominator or len({v.view_ref for v in self.views})!=len(self.views):
            raise ValueError('cone threshold or registered view identity invalid')
        if (self.cosine_sign==0)!=(self.cosine_squared_numerator==0):
            raise ValueError('cosine sign and exact squared magnitude must agree')
        if any(v.sample_to_field[0][0]*v.sample_to_field[1][1]-v.sample_to_field[0][1]*v.sample_to_field[1][0]==0 for v in self.views):
            raise ValueError('sample-to-field coordinate transform must be nondegenerate')
        if any(v.emitter_direction==(0,0) for v in self.views):
            raise ValueError('directional cone requires a nonzero emitter direction')
        return self


class ConeReceiptD(FrozenModel):
    receipt_ref: Ref
    view_ref: Ref
    sample_point: tuple[int,int]
    exposed: bool
    sealed: bool
    epoch: int = Field(ge=0)


class ConeTargetD(FrozenModel):
    target_ref: Ref
    sample_points: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    predicate: Literal['CENTER','ANY','ALL']


class OccludingConeRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.occluding_cone_request_d.v1'
    phase_ref: Literal['SEALED_CONE_FIT','CURRENT_EXPOSURE_FIELD']
    models: tuple[ConeModelD,...] = Field(min_length=1,max_length=128)
    receipts: tuple[ConeReceiptD,...] = Field(default=(),max_length=4096)
    current_view_ref: Ref | None
    sample_domain: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    targets: tuple[ConeTargetD,...] = Field(default=(),max_length=128)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.resource_visibility_feasibility.occluding_cone','FIT'),
        ('mechanics.resource_visibility_feasibility.occluding_cone','EVALUATE'),
    )

    @model_validator(mode='after')
    def observation_phase(self):
        if self.mode_ref=='FIT' and self.phase_ref!='SEALED_CONE_FIT' or self.mode_ref=='EVALUATE' and self.phase_ref!='CURRENT_EXPOSURE_FIELD':
            raise ValueError('cone fit and predicted exposure phases differ')
        if len({r.receipt_ref for r in self.receipts})!=len(self.receipts) or len({t.target_ref for t in self.targets})!=len(self.targets):
            raise ValueError('exposure receipt/target identities duplicated')
        if any(t.predicate=='CENTER' and len(t.sample_points)!=1 for t in self.targets):
            raise ValueError('center policy requires its actual single center, not a footprint substitution')
        return self


def _ray_groups(start,end,model,budget,depth_bound):
    x,y=start
    dx,dy=end[0]-x,end[1]-y
    nx,ny=abs(dx),abs(dy)
    sx,sy=(1 if dx>0 else -1),(1 if dy>0 else -1)
    if max(nx,ny)>depth_bound:
        raise DComputationInterrupted('OCCLUSION_RAY_DEPTH_BOUND',{'endpoint':end})
    groups=[((start,),False)]
    if model.discretization=='BRESENHAM':
        error=nx-ny
        while (x,y)!=end:
            budget.visit({'stage':'bresenham_ray','point':(x,y)})
            doubled=2*error
            if doubled>=-ny:
                error-=ny
                x+=sx
            if doubled<=nx:
                error+=nx
                y+=sy
            groups.append((((x,y),),False))
    else:
        ix=iy=0
        while ix<nx or iy<ny:
            budget.visit({'stage':'supercover_ray','point':(x,y)})
            left=(1+2*ix)*ny
            right=(1+2*iy)*nx
            if left==right:
                groups.append((((x+sx,y),(x,y+sy)),True))
                x+=sx;y+=sy;ix+=1;iy+=1
            elif left<right:
                x+=sx;ix+=1
            else:
                y+=sy;iy+=1
            groups.append((((x,y),),False))
    return groups


def _cone_exposure(model,view,sample,budget,depth_bound):
    point=tuple(a*sample[0]+b*sample[1]+offset for a,b,offset in view.sample_to_field)
    vector=(point[0]-view.emitter_origin[0],point[1]-view.emitter_origin[1])
    distance=vector[0]**2+vector[1]**2
    if not distance:
        return model.emitter_self_lit,{'code':'EMITTER_POINT_CONVENTION','field_point':point}
    if distance>model.range_squared or distance==model.range_squared and not model.range_inclusive:
        return False,{'code':'OUTSIDE_RANGE','field_point':point}
    direction=view.emitter_direction
    dot=vector[0]*direction[0]+vector[1]*direction[1]
    left=dot*dot*model.cosine_squared_denominator
    right=model.cosine_squared_numerator*distance*(direction[0]**2+direction[1]**2)
    if model.cosine_sign>0:
        angular=dot>=0 and (left>=right if model.angular_inclusive else left>right)
    elif model.cosine_sign<0:
        angular=dot>=0 or (left<=right if model.angular_inclusive else left<right)
    else:
        angular=dot>=0 if model.angular_inclusive else dot>0
    if not angular:
        return False,{'code':'OUTSIDE_ANGULAR_CONE','field_point':point}
    opaque,unknown=set(view.opaque_cells),set(view.unknown_opacity_cells)
    unresolved=[]
    for group,corner in _ray_groups(view.emitter_origin,point,model,budget,depth_bound):
        cells=[p for p in group if not (model.ignore_emitter_opacity and p==view.emitter_origin) and
            not (model.ignore_endpoint_opacity and p==point)]
        if not cells:
            continue
        budget.visit({'stage':'opacity_group','cells':tuple(cells)})
        blocked=[p in opaque for p in cells]
        uncertain=[p in unknown for p in cells]
        if corner and model.corner_rule=='BOTH_OPAQUE_BLOCK':
            certain_block=all(blocked)
            possible_block=all(a or b for a,b in zip(blocked,uncertain))
        elif corner and model.corner_rule=='UNOBSERVED':
            certain_block=all(blocked)
            possible_block=any(blocked) or any(uncertain)
        else:
            certain_block=any(blocked)
            possible_block=certain_block or any(uncertain)
        if certain_block:
            return False,{'code':'OPAQUE_RAY_BLOCK','field_point':point,'blocking_cells':tuple(cells),'corner':corner}
        if possible_block:
            unresolved.extend(cells)
    return (None if unresolved else True),{'code':'UNRESOLVED_RAY_BOUNDARY' if unresolved else 'EXPOSED',
        'field_point':point,'unresolved_cells':tuple(sorted(set(unresolved)))}


def measure_occluding_cone_d(request: OccludingConeRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.receipts),len(request.sample_domain),sum(len(t.sample_points) for t in request.targets),
            *(len(v.opaque_cells)+len(v.unknown_opacity_cells) for m in request.models for v in m.views))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request,'NEEDS_EVIDENCE','RESTART_CONE_FROM_REGISTERED_VIEWS')
    budget=DWorkBudget(request)
    try:
        actual=[r for r in request.receipts if r.sealed and r.epoch==request.scope.epoch]
        if request.mode_ref=='FIT' and not actual:
            return d_result(request,'NEEDS_EVIDENCE','SEALED_VISUAL_OBSERVATIONS_REQUIRED')
        rows=[]
        unresolved_any=False
        for model in request.models:
            views={v.view_ref:v for v in model.views}
            if request.mode_ref=='FIT':
                contradictions,unresolved=[],[]
                for receipt in actual:
                    budget.visit({'stage':'sealed_visual_fit','model_ref':model.model_ref,'receipt_ref':receipt.receipt_ref})
                    view=views.get(receipt.view_ref)
                    if view is None:
                        unresolved.append(receipt.receipt_ref)
                        continue
                    exposed,witness=_cone_exposure(model,view,receipt.sample_point,budget,request.depth_bound)
                    if exposed is None:
                        unresolved.append(receipt.receipt_ref)
                    elif exposed!=receipt.exposed:
                        contradictions.append({'receipt_ref':receipt.receipt_ref,'prediction':exposed,'witness':witness})
                rows.append({'model_ref':model.model_ref,'contradiction_certificates':tuple(contradictions),'unresolved_receipt_refs':tuple(unresolved)})
                unresolved_any=unresolved_any or bool(unresolved)
            else:
                view=views.get(request.current_view_ref)
                if view is None:
                    return d_result(request,'NEEDS_EVIDENCE','CURRENT_EMITTER_VIEW_NOT_BOUND',examined=budget.examined)
                samples=list(dict.fromkeys(request.sample_domain+tuple(p for t in request.targets for p in t.sample_points)))
                exposures={}
                witnesses=[]
                for sample in samples:
                    budget.visit({'stage':'bounded_exposure','model_ref':model.model_ref,'sample':sample})
                    value,witness=_cone_exposure(model,view,sample,budget,request.depth_bound)
                    exposures[sample]=value
                    witnesses.append({'sample_point':sample,'exposed':value,'witness':witness})
                    unresolved_any=unresolved_any or value is None
                targets=[]
                for target in request.targets:
                    values=[exposures[p] for p in target.sample_points]
                    if target.predicate=='ANY':
                        result=True if True in values else None if None in values else False
                    else:
                        result=False if False in values else None if None in values else True
                    targets.append({'target_ref':target.target_ref,'predicate':target.predicate,'exposure_result':result,'sample_points':target.sample_points})
                rows.append({'model_ref':model.model_ref,'exposure_samples':tuple(witnesses),'target_results':tuple(targets)})
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if unresolved_any else 'COMPLETE','UNRESOLVED_VISUAL_BOUNDARIES' if unresolved_any else 'OCCLUDING_CONE_RESULT',
            complete=not unresolved_any,examined=budget.examined,values={'model_correlated_results':tuple(rows),
                'consistent_model_refs':tuple(r['model_ref'] for r in rows if not r.get('contradiction_certificates')),
                'center_substituted_for_full_footprint':False,'relay_propagation_introduced':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_cone':True,'work':error.frontier})
