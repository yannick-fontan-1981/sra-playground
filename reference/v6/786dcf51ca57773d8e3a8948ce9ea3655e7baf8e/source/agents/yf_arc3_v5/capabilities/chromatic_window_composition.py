"""Finite full-support pane transforms and exact scored-window composition.

Supports outside the scoring window are retained. Algebra, pivots, hit order,
selection effects and cost/checkpoint laws belong to the supplied model.
"""
from __future__ import annotations

from collections import deque
from itertools import product
from fractions import Fraction
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as measure_translated_layers
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields

Point=tuple[int,int]


class PaneBody(FrozenModel):
    body_ref: Ref
    channel_refs: tuple[Ref,...] = Field(min_length=1,max_length=16)
    support: tuple[Point,...] = Field(max_length=4096)
    unknown_support: tuple[Point,...] = Field(default=(),max_length=4096)
    exposed_hit_support: tuple[Point,...] = Field(default=(),max_length=4096)
    @model_validator(mode="after")
    def unique(self):
        if len(set(self.support))!=len(self.support) or len(set(self.channel_refs))!=len(self.channel_refs):
            raise ValueError("pane support and channel identities must be unique")
        if set(self.support)&set(self.unknown_support) or not set(self.exposed_hit_support)<=set(self.support):
            raise ValueError("certain, unknown and measured exposed supports must remain consistent")
        return self


class PaneOperator(FrozenModel):
    operator_ref: Ref
    action_ref: Ref
    matrix: tuple[int,int,int,int]
    pivot_twice: Point
    translation: Point
    cost: int = Field(ge=0)
    @model_validator(mode="after")
    def rigid(self):
        a,b,c,d=self.matrix
        if a*a+c*c!=1 or b*b+d*d!=1 or a*b+c*d!=0:
            raise ValueError("pane operator must be an exact lattice isometry")
        return self


class PaneProjection(FrozenModel):
    body_ref: Ref
    full_support: tuple[Point,...] = Field(max_length=4096)
    action_word: tuple[Ref,...] = Field(max_length=64)
    cost: int = Field(ge=0)


class ColorRule(FrozenModel):
    left_ref: Ref
    right_ref: Ref
    output_ref: Ref


class ColorAlgebra(FrozenModel):
    algebra_ref: Ref
    rules: tuple[ColorRule,...] = Field(max_length=4096)


class ColorObservation(FrozenModel):
    evidence_ref: Ref
    left_ref: Ref
    right_ref: Ref
    output_ref: Ref
    conditioned_action_ref: Ref


class PaneTransformObservation(FrozenModel):
    evidence_ref: Ref
    before: tuple[Point,...] = Field(max_length=4096)
    positive_after: tuple[Point,...] = Field(max_length=4096)
    negative_after: tuple[Point,...] = Field(default=(),max_length=4096)
    observed_domain: tuple[Point,...] = Field(max_length=4096)
    @model_validator(mode="after")
    def observed_masks(self):
        if not set(self.positive_after)<=set(self.observed_domain) or set(self.positive_after)&set(self.negative_after):
            raise ValueError("positive and negative observations must define consistent pixel constraints")
        return self


class PaneRawState(FrozenModel):
    panes: tuple[PaneBody,...] = Field(max_length=16)
    control_receiver_ref: Ref | None
    hit_order: tuple[Ref,...] = Field(max_length=16)
    remaining_budget: int = Field(ge=0)
    frame_support: tuple[Point,...] = Field(max_length=4096)
    overlay_support: tuple[Point,...] = Field(max_length=4096)
    evaluated_channel_supports: tuple[tuple[Ref,tuple[Point,...]],...] = Field(max_length=16)
    authoritative_status: Literal["ACTIVE","WIN","GAME_OVER"]
    @model_validator(mode="after")
    def ownership(self):
        refs=tuple(p.body_ref for p in self.panes)
        if len(set(refs))!=len(refs) or len(set(self.hit_order))!=len(self.hit_order):
            raise ValueError("raw state retains unique body and hit identities")
        if not set(self.hit_order)<=set(refs):
            raise ValueError("raw hit order names supplied bodies")
        if self.control_receiver_ref is not None and self.control_receiver_ref not in refs:
            raise ValueError("raw receiver names a supplied body")
        channels=tuple(c for c,_ in self.evaluated_channel_supports)
        if len(set(channels))!=len(channels):
            raise ValueError("raw evaluated channels are unique")
        if any(len(points)>4096 for _,points in self.evaluated_channel_supports):
            raise ValueError("raw evaluated channel supports exceed the declared pixel bound")
        return self


class PanePathObservation(FrozenModel):
    # Index zero is the qualified path origin; every subsequent index is one primitive.
    primitive_index: int = Field(ge=0)
    event_ref: Ref | None
    event_owner_ref: Ref
    evidence_revision_ref: Ref
    model_revision_ref: Ref
    epoch: int = Field(ge=0)
    expected: PaneRawState
    observed: PaneRawState


class PaneControlLaw(FrozenModel):
    law_ref: Ref
    extent_mode: Literal["RETAIN_FULL","CLIP","REJECT"]
    extent_bounds: tuple[int,int,int,int] | None
    receiver_after_transform: Literal["KEEP","DESELECT"]
    receiver_after_rejected: Literal["KEEP","DESELECT"]
    rejected_cost: int = Field(ge=0)
    checkpoint_policy: Literal["EACH_PRIMITIVE","TRANSFORM_ONLY","DISABLED"]
    check_after_rejected: bool
    budget_exhaustion_status: Literal["ACTIVE","LOCAL_STOP","GAME_OVER"]
    checkpoint_priority: Literal["ACCEPTANCE_FIRST","EXHAUSTION_FIRST"]
    @model_validator(mode="after")
    def bounds(self):
        if self.extent_mode!="RETAIN_FULL" and self.extent_bounds is None:
            raise ValueError("clipping/rejection needs caller-supplied physical bounds")
        if self.extent_bounds is not None:
            xmin,ymin,xmax,ymax=self.extent_bounds
            if xmin>xmax or ymin>ymax:
                raise ValueError("invalid physical extent bounds")
        return self


class PaneInterior(FrozenModel):
    interior_ref: Ref
    kind: Literal["REFERENCE","MUTABLE"]
    frame_template_ref: Ref
    relative_bounds: tuple[int,int,int,int]
    positive_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=4096)
    negative_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=4096)
    @model_validator(mode="after")
    def bounds(self):
        x0,y0,x1,y1=self.relative_bounds
        if x0>x1 or y0>y1:raise ValueError("interior bounds are ordered")
        return self


class PaneNormalizationModel(FrozenModel):
    model_ref: Ref
    matrix: tuple[int,int,int,int]
    @model_validator(mode="after")
    def isometry(self):
        a,b,c,d=self.matrix
        if a*a+c*c!=1 or b*b+d*d!=1 or a*b+c*d!=0:raise ValueError("normalized correspondence is an exact orientation model")
        return self


class PaneBodyDomain(FrozenModel):
    body_ref: Ref
    alternatives: tuple[PaneBody,...] = Field(min_length=1,max_length=64)
    @model_validator(mode="after")
    def identity(self):
        if any(p.body_ref!=self.body_ref for p in self.alternatives):raise ValueError("body alternatives retain their exact identity")
        return self


class PaneOwnershipModel(FrozenModel):
    model_ref: Ref
    algebra: ColorAlgebra
    background_token_ref: Ref
    channel_token_refs: tuple[tuple[Ref,Ref],...] = Field(max_length=32)
    body_order: tuple[Ref,...] = Field(max_length=16)
    body_domains: tuple[PaneBodyDomain,...] = Field(max_length=16)
    extent_mode: Literal["RETAIN_FULL","CLIP","REJECT"]
    extent_bounds: tuple[int,int,int,int] | None = None
    @model_validator(mode="after")
    def whole_model(self):
        refs=tuple(d.body_ref for d in self.body_domains)
        if len(set(refs))!=len(refs) or set(refs)!=set(self.body_order) or len(set(self.body_order))!=len(self.body_order):raise ValueError("ownership model orders each whole body once")
        if len({c for c,_ in self.channel_token_refs})!=len(self.channel_token_refs):raise ValueError("one rendered token per declared channel")
        if self.extent_mode!="RETAIN_FULL" and self.extent_bounds is None:raise ValueError("physical clipping or rejection needs its own bounds")
        return self


class PaneOwnershipFrame(FrozenModel):
    frame_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    sequence_index: int = Field(ge=0)
    raw_pixels: tuple[ContactPixel,...] = Field(max_length=65536)
    frame_support: tuple[Point,...] = Field(max_length=4096)
    overlay_support: tuple[Point,...] = Field(max_length=4096)
    operator: PaneOperator | None = None
    transformed_body_ref: Ref | None = None
    action_evidence_ref: Ref | None = None
    @model_validator(mode="after")
    def observed_pixels(self):
        if len({p.point for p in self.raw_pixels})!=len(self.raw_pixels):raise ValueError("one observation per retained pixel")
        return self


class PanePoseLandmark(FrozenModel):
    landmark_ref: Ref
    body_ref: Ref
    kind: Literal["CLOSED_HOLE","OPEN_NOTCH","FILLED_CORNER","WINDOW_CLIP","SCREEN_CLIP","OCCLUSION"]
    source_points: tuple[Point,...] = Field(min_length=1,max_length=128)
    observed_points: tuple[Point,...] = Field(min_length=1,max_length=128)


class ChromaticWindowRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.chromatic_window_request.v1"
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    panes: tuple[PaneBody,...] = Field(default=(),max_length=16)
    window: tuple[Point,...] = Field(default=(),max_length=4096)
    reference_support: tuple[Point,...] = Field(default=(),max_length=4096)
    normalized_maps: tuple[tuple[tuple[Point,Point],...],...] = Field(default=(),max_length=16)
    frame_support: tuple[Point,...] = Field(default=(),max_length=4096)
    overlay_support: tuple[Point,...] = Field(default=(),max_length=4096)
    required_channel_supports: tuple[tuple[Ref,tuple[Point,...]],...] = Field(default=(),max_length=16)
    operators: tuple[PaneOperator,...] = Field(default=(),max_length=32)
    transform_observations: tuple[PaneTransformObservation,...] = Field(default=(),max_length=64)
    algebra_alternatives: tuple[ColorAlgebra,...] = Field(default=(),max_length=16)
    color_observations: tuple[ColorObservation,...] = Field(default=(),max_length=64)
    supplied_channel_union_contract: bool | None = None
    control_receiver_ref: Ref | None = None
    hit_order: tuple[Ref,...] = Field(default=(),max_length=16)
    hit_policy: Literal["EXPOSED", "ORDERED_SUPPORT"] | None = None
    empty_click_effect: Literal["KEEP", "DESELECT"] | None = None
    command_kind: Literal["CLICK", "TRANSFORM"] | None = None
    click_point: Point | None = None
    operator_ref: Ref | None = None
    selection_cost: int | None = Field(default=None,ge=0)
    click_action_ref: Ref | None = None
    remaining_budget: int | None = Field(default=None,ge=0)
    projections: tuple[PaneProjection,...] = Field(default=(),max_length=4096)
    bound_assignment: tuple[PaneProjection,...] = Field(default=(),max_length=16)
    declared_body_order: tuple[Ref,...] = Field(default=(),max_length=16)
    # Bounds apply to the pose domain, not to the scored-window clipping.
    support_bounds: tuple[int,int,int,int] | None = None
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=64)
    maximum_witnesses: int = Field(ge=1,le=3)
    actual_channel_supports: tuple[tuple[Ref,tuple[Point,...]],...] | None = None
    authoritative_failure: bool | None = None
    authoritative_failure_seen_on_path: bool | None = None
    acceptance_checkpoint_reached: bool | None = None
    path_observations: tuple[PanePathObservation,...] | None = Field(default=None,max_length=4097)
    path_primitive_count: int | None = Field(default=None,ge=0,le=4096)
    path_domain_complete: bool | None = None
    control_law: PaneControlLaw | None = None
    execution_status: Literal["ACTIVE","WIN","LOCAL_STOP","GAME_OVER"] | None = None
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[ContactLayerTemplate,...] = Field(default=(),max_length=512)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=512)
    interiors: tuple[PaneInterior,...] = Field(default=(),max_length=32)
    normalization_models: tuple[PaneNormalizationModel,...] = Field(default=(),max_length=16)
    ownership_models: tuple[PaneOwnershipModel,...] = Field(default=(),max_length=64)
    ownership_frames: tuple[PaneOwnershipFrame,...] = Field(default=(),max_length=256)
    pose_landmarks: tuple[PanePoseLandmark,...] = Field(default=(),max_length=512)
    pose_orientations: tuple[tuple[int,int,int,int],...] = Field(default=(),max_length=8)
    pose_body_ref: Ref | None = None
    screen_bounds: tuple[int,int,int,int] | None = None
    @model_validator(mode="after")
    def references(self):
        refs=tuple(p.body_ref for p in self.panes)
        if len(set(refs))!=len(refs) or len(set(self.hit_order))!=len(self.hit_order):
            raise ValueError("pane identities and hit order must be unique")
        if not set(self.hit_order)<=set(refs) or not set(self.declared_body_order)<=set(refs):
            raise ValueError("hit/compilation order outside supplied bodies")
        if len(set(self.declared_body_order))!=len(self.declared_body_order):
            raise ValueError("duplicate body in compilation order")
        if self.control_receiver_ref is not None and self.control_receiver_ref not in refs:
            raise ValueError("selection must name a supplied body")
        if len(set(self.window))!=len(self.window):
            raise ValueError("scored window must be unique")
        if len({p.operator_ref for p in self.operators})!=len(self.operators):
            raise ValueError("operator references must be unique")
        channels=tuple(c for c,_ in self.required_channel_supports)
        if len(set(channels))!=len(channels):
            raise ValueError("channel requirements must be unique")
        if len(set(self.hit_order))!=len(self.hit_order) or not set(self.hit_order)<=set(refs):
            raise ValueError("hit order must contain bound unique bodies")
        assignment_refs=tuple(x.body_ref for x in self.bound_assignment)
        if len(set(assignment_refs))!=len(assignment_refs) or not set(assignment_refs)<=set(refs):
            raise ValueError("assignment must retain bound unique body identities")
        if len(set(self.declared_body_order))!=len(self.declared_body_order) or not set(self.declared_body_order)<=set(refs):
            raise ValueError("declared compilation order must contain bound unique bodies")
        if self.operation_ref=="compile_assignment" and not set(assignment_refs)<=set(self.declared_body_order):
            raise ValueError("compilation order must cover the supplied assignment")
        if self.support_bounds is not None:
            xmin,ymin,xmax,ymax=self.support_bounds
            if xmin>xmax or ymin>ymax:
                raise ValueError("invalid supplied pose bounds")
        if len({p.point for p in self.raw_layer_pixels})!=len(self.raw_layer_pixels):raise ValueError("one raw color observation per pixel")
        if len({t.template_ref for t in self.layer_templates})!=len(self.layer_templates):raise ValueError("raw layer templates have unique identities")
        if len({i.interior_ref for i in self.interiors})!=len(self.interiors):raise ValueError("interiors have unique identities")
        if len({m.model_ref for m in self.normalization_models})!=len(self.normalization_models) or len({m.model_ref for m in self.ownership_models})!=len(self.ownership_models):raise ValueError("each retained model has a unique identity")
        if len({f.sequence_index for f in self.ownership_frames})!=len(self.ownership_frames):raise ValueError("temporal ownership frames have an exact ordered position")
        if self.screen_bounds is not None:
            x0,y0,x1,y1=self.screen_bounds
            if x0>x1 or y0>y1:raise ValueError("physical screen bounds are ordered")
        return self


OPERATION_MODES={"window_correspondence":"MEASURE","composition_table":"FIT",
    "layer_ownership":"MEASURE","hole_relief_poses":"INVERSE_DOMAIN","pose_operator":"FIT",
    "window_projections":"DOMAIN","same_channel_union":"INVERSE_DOMAIN",
    "selected_transform":"STEP","compile_assignment":"DOMAIN","field_certificate":"COMPARE"}


def _transform(support, operator):
    a,b,c,d=operator.matrix
    px,py=operator.pivot_twice
    tx,ty=operator.translation
    result=[]
    for x,y in support:
        xx=a*(2*x-px)+b*(2*y-py)+px+2*tx
        yy=c*(2*x-px)+d*(2*y-py)+py+2*ty
        if xx%2 or yy%2:
            return None
        result.append((xx//2,yy//2))
    return tuple(sorted(result))


def _field(panes, window):
    allowed=set(window)
    result={}
    for pane in panes:
        for point in pane.support:
            if point in allowed:
                for channel in pane.channel_refs:
                    result.setdefault(channel,set()).add(point)
    return tuple((channel,tuple(sorted(points))) for channel,points in sorted(result.items()))


def _correspondence(request):
    measured=measure_translated_layers(request)
    if measured.computation_bound_reached:return measured
    frame_refs={row["template_ref"] for row in measured.values.get("measured_layer_alternatives",())}
    templates={t.template_ref:t for t in request.layer_templates};pixels={p.point:p.token_ref for p in request.raw_layer_pixels}
    interiors=[];unresolved=[];refuted=[];count=measured.examined_count
    for interior_index,interior in enumerate(request.interiors):
        template=templates.get(interior.frame_template_ref)
        if template is None or interior.frame_template_ref not in frame_refs:
            unresolved.append((interior.interior_ref,"currently_measured_frame_template"));continue
        ox,oy=template.origin;x0,y0,x1,y1=interior.relative_bounds;bounds=(ox+x0,oy+y0,ox+x1,oy+y1)
        if (x1-x0+1)*(y1-y0+1)>4096:
            unresolved.append((interior.interior_ref,"interior_pixel_bound"));continue
        constraints=[];first=None
        for polarity,rows in (("positive",interior.positive_pixels),("negative",interior.negative_pixels)):
            for pixel_index,pixel in enumerate(rows):
                if count>=request.maximum_evaluations:
                    return family_result(request,values={"measured_interiors":tuple(interiors),"refutations":tuple(refuted)},
                        examined_count=count,domain_complete=False,computation_bound_reached=True,
                        frontier={"phase":"interior_constraints","interior_index":interior_index,"polarity":polarity,"pixel_index":pixel_index})
                count+=1;point=(pixel.point[0]+ox,pixel.point[1]+oy)
                if point not in pixels:constraints.append((point,polarity,pixel.token_ref));continue
                if (pixels[point]==pixel.token_ref)!=(polarity=="positive"):
                    first=(interior.interior_ref,point,polarity,pixel.token_ref,pixels[point]);break
            if first:break
        if first:refuted.append(first);continue
        support=tuple((x,y) for y in range(bounds[1],bounds[3]+1) for x in range(bounds[0],bounds[2]+1))
        interiors.append({"interior_ref":interior.interior_ref,"kind":interior.kind,"bounds":bounds,
            "support":support,"unobserved_pixel_constraints":tuple(constraints),"frame_template_ref":interior.frame_template_ref})
        if constraints:unresolved.append((interior.interior_ref,"interior_one_pixel_evidence"))
    references=tuple(i for i in interiors if i["kind"]=="REFERENCE");mutable=tuple(i for i in interiors if i["kind"]=="MUTABLE");maps=[]
    if not references or not mutable or not request.normalization_models:unresolved.append(("reference_mutable_pair","measured_interiors_and_normalization_domain"))
    for reference_index,reference in enumerate(references):
        rx0,ry0,rx1,ry1=reference["bounds"];rw=rx1-rx0+1;rh=ry1-ry0+1
        for mutable_index,target in enumerate(mutable):
            mx0,my0,mx1,my1=target["bounds"];mw=mx1-mx0+1;mh=my1-my0+1
            for model_index,model in enumerate(request.normalization_models):
                a,b,c,d=model.matrix;points=[];fractional=[]
                for point_index,(x,y) in enumerate(reference["support"]):
                    if count>=request.maximum_evaluations:
                        return family_result(request,values={"measured_interiors":tuple(interiors),"normalized_map_alternatives":tuple(maps)},
                            examined_count=count,domain_complete=False,computation_bound_reached=True,
                            frontier={"phase":"normalized_map","reference_index":reference_index,"mutable_index":mutable_index,
                                "model_index":model_index,"point_index":point_index,"retained_pairs":tuple(points),"fractional_pixels":tuple(fractional)})
                    count+=1;u=Fraction(2*(x-rx0)+1,2*rw)-Fraction(1,2);v=Fraction(2*(y-ry0)+1,2*rh)-Fraction(1,2)
                    xx=Fraction(mx0)-Fraction(1,2)+(a*u+b*v+Fraction(1,2))*mw
                    yy=Fraction(my0)-Fraction(1,2)+(c*u+d*v+Fraction(1,2))*mh
                    pair=((x,y),(xx.numerator,xx.denominator,yy.numerator,yy.denominator));points.append(pair)
                    if xx.denominator!=1 or yy.denominator!=1:fractional.append(pair)
                maps.append({"model_ref":model.model_ref,"reference_ref":reference["interior_ref"],"mutable_ref":target["interior_ref"],
                    "normalized_pixel_pairs":tuple(points),"fractional_pixel_correspondences":tuple(fractional),
                    "scale_x":(mw,rw),"scale_y":(mh,rh),"integer_pixel_map_complete":not fractional,
                    "movement_quantum_used_as_pixel_cell":False})
    return family_result(request,values={"measured_interiors":tuple(interiors),"normalized_map_alternatives":tuple(maps),
        "frame_layer_measurements":measured.values.get("measured_layer_alternatives",()),
        "unresolved_interior_evidence":tuple(unresolved),"one_pixel_refutations":tuple(refuted),
        "frame_support":request.frame_support,"overlay_support":request.overlay_support},examined_count=count,
        prerequisite_refs=("current_interior_or_fractional_sampling_evidence",) if unresolved or any(m["fractional_pixel_correspondences"] for m in maps) else ())


def _ownership(request):
    frames=tuple(sorted(request.ownership_frames,key=lambda f:f.sequence_index));outcomes=[];count=0;unresolved=[];refutations=[]
    if not frames or not request.ownership_models:
        return family_result(request,prerequisite_refs=("owned_temporal_frames_and_whole_algebra_models",),domain_complete=False)
    for model_index,model in enumerate(request.ownership_models):
        table={(r.left_ref,r.right_ref):r.output_ref for r in model.algebra.rules};tokens=dict(model.channel_token_refs)
        if len(table)!=len(model.algebra.rules):
            unresolved.append((model.model_ref,"single_output_per_algebra_entry"));continue
        for assignment_index,assignment in enumerate(product(*(domain.alternatives for domain in model.body_domains))):
            if count>=request.maximum_evaluations or len(outcomes)>=request.maximum_states:
                return family_result(request,values={"ownership_alternatives":tuple(outcomes)},examined_count=count,
                    domain_complete=False,computation_bound_reached=True,
                    frontier={"model_index":model_index,"assignment_index":assignment_index,"current_assignment":assignment})
            count+=1
            current={p.body_ref:p for p in assignment};first=None;unknown=[];observed_frames=[]
            for frame_index,frame in enumerate(frames):
                if count>=request.maximum_evaluations:
                    return family_result(request,values={"ownership_alternatives":tuple(outcomes)},examined_count=count,
                        domain_complete=False,computation_bound_reached=True,
                        frontier={"model_index":model_index,"assignment_index":assignment_index,"frame_index":frame_index})
                count+=1
                if not frame.sealed or frame.epoch!=request.scope.epoch or frame.event_owner_ref!=request.scope.event_owner_ref:
                    unknown.append((frame.frame_ref,"sealed_current_owner_epoch"));continue
                if frame_index>0 and ("operator" not in frame.model_fields_set or "transformed_body_ref" not in frame.model_fields_set):
                    unknown.append((frame.frame_ref,"explicit_intervening_body_transition_or_noop"));break
                if frame.operator is not None:
                    if frame.transformed_body_ref not in current or frame.action_evidence_ref is None:
                        unknown.append((frame.frame_ref,"action_bound_single_body_transform"));continue
                    old=current[frame.transformed_body_ref];support=_transform(old.support,frame.operator);masked=_transform(old.unknown_support,frame.operator)
                    if support is None or masked is None:first=(frame.frame_ref,"nonintegral_owned_pose");break
                    if model.extent_mode!="RETAIN_FULL":
                        xmin,ymin,xmax,ymax=model.extent_bounds
                        inside=lambda point:xmin<=point[0]<=xmax and ymin<=point[1]<=ymax
                        exceeds=any(not inside(point) for point in support+masked)
                        if model.extent_mode=="REJECT" and exceeds:support=old.support;masked=old.unknown_support
                        elif model.extent_mode=="CLIP":support=tuple(p for p in support if inside(p));masked=tuple(p for p in masked if inside(p))
                    current[old.body_ref]=old.model_copy(update={"support":support,"unknown_support":masked,"exposed_hit_support":()})
                hidden=set(frame.frame_support)|set(frame.overlay_support);supports={ref:set(p.support) for ref,p in sorted(current.items())};masked={ref:set(p.unknown_support) for ref,p in sorted(current.items())}
                for pixel_index,pixel in enumerate(frame.raw_pixels):
                    if pixel.point in hidden:continue
                    if count>=request.maximum_evaluations:
                        return family_result(request,values={"ownership_alternatives":tuple(outcomes)},examined_count=count,
                            domain_complete=False,computation_bound_reached=True,
                            frontier={"model_index":model_index,"assignment_index":assignment_index,"frame_index":frame_index,
                                "pixel_index":pixel_index,"current_bodies":tuple(current[ref] for ref in model.body_order),"unresolved":tuple(unknown)})
                    count+=1;token=model.background_token_ref;uncertain=False
                    for ref in model.body_order:
                        if pixel.point in masked[ref]:uncertain=True;break
                        if pixel.point not in supports[ref]:continue
                        for channel in current[ref].channel_refs:
                            layer=tokens.get(channel)
                            if layer is None or (token,layer) not in table:uncertain=True;unknown.append((frame.frame_ref,pixel.point,"channel_composition_entry"));break
                            token=table[(token,layer)]
                        if uncertain:break
                    if uncertain:unknown.append((frame.frame_ref,pixel.point,"unknown_owned_layer_support"));continue
                    if token!=pixel.token_ref:first=(frame.frame_ref,pixel.point,token,pixel.token_ref);break
                if first:break
                observed_frames.append(frame.frame_ref)
            if first:
                refutations.append((model.model_ref,assignment_index,first));continue
            bodies=tuple(current[ref] for ref in model.body_order)
            outcomes.append({"model_ref":model.model_ref,"algebra_ref":model.algebra.algebra_ref,"initial_bodies":assignment,
                "current_bodies":bodies,"channel_supports":_field(bodies,request.window),"evidence_frame_refs":tuple(observed_frames),
                "possible_channel_supports":_field(tuple(p.model_copy(update={"support":p.support+p.unknown_support,"unknown_support":()}) for p in bodies),request.window),
                "unresolved_layer_evidence":tuple(unknown),"body_identities_merged":False})
            unresolved.extend(unknown)
    channels=tuple(sorted({channel for row in outcomes for channel,_ in row["possible_channel_supports"]}));certain=[];possible=[]
    for channel in channels:
        sets=[set(dict(row["channel_supports"]).get(channel,())) for row in outcomes]
        common=set.intersection(*sets) if sets else set()
        possible_sets=[set(dict(row["possible_channel_supports"]).get(channel,())) for row in outcomes]
        union=set.union(*possible_sets) if possible_sets else set()
        certain.append((channel,tuple(sorted(common))));possible.append((channel,tuple(sorted(union))))
    return family_result(request,values={"ownership_alternatives":tuple(outcomes),"certain_channel_supports":tuple(certain),
        "possible_channel_supports":tuple(possible),"selection_overlay_is_channel_evidence":False,
        "frame_layer_is_channel_evidence":False,"unresolved_layer_evidence":tuple(unresolved),"first_assignment_refutations":tuple(refutations)},examined_count=count,
        prerequisite_refs=("current_temporal_ownership_or_algebra_entries",) if unresolved else ())


def _relief_components(support,observed_domain,window,occluded):
    filled=set(support);known=set(observed_domain);window=set(window);hidden=set(occluded)
    if not filled:return (),(),("full_body_support",)
    xmin=min(x for x,_ in filled);xmax=max(x for x,_ in filled);ymin=min(y for _,y in filled);ymax=max(y for _,y in filled)
    if (xmax-xmin+1)*(ymax-ymin+1)>4096:return (),(),("relief_rectangle_bound",)
    empty={(x,y) for y in range(ymin,ymax+1) for x in range(xmin,xmax+1) if (x,y) not in filled};components=[]
    while empty:
        seed=min(empty);empty.remove(seed);queue=deque([seed]);points=[];border=False;unobserved=False
        while queue:
            point=queue.popleft();points.append(point);x,y=point
            border=border or x in (xmin,xmax) or y in (ymin,ymax)
            unobserved=unobserved or point not in known or point in hidden
            for nxt in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if nxt in empty:empty.remove(nxt);queue.append(nxt)
        kind="UNKNOWN" if unobserved else "OPEN_NOTCH" if border else "CLOSED_HOLE"
        components.append((kind,tuple(sorted(points))))
    clipping=("window_exterior",tuple(sorted(filled-window))), ("screen_unobserved",tuple(sorted(filled-known))), ("occluded",tuple(sorted(filled&hidden)))
    return tuple(components),clipping,()


def _hole_poses(request):
    body=next((p for p in request.panes if p.body_ref==request.pose_body_ref),None)
    if body is None:return family_result(request,prerequisite_refs=("current_full_body_identity",),domain_complete=False)
    if not body.support:return family_result(request,prerequisite_refs=("nonempty_full_material_support",),domain_complete=False)
    if body.unknown_support:return family_result(request,prerequisite_refs=("complete_body_support_for_relief_pose_generation",),domain_complete=False)
    landmarks=tuple(l for l in request.pose_landmarks if l.body_ref==body.body_ref and l.kind in ("CLOSED_HOLE","OPEN_NOTCH","FILLED_CORNER"))
    if not landmarks:return family_result(request,prerequisite_refs=("intrinsic_hole_notch_or_corner_landmark",),domain_complete=False)
    candidates=[];seen=set();count=0;refutations=[];compatible=[];reliefs=[];missing=[]
    for observation in request.transform_observations:
        if observation.positive_after:
            xmin=min(x for x,_ in observation.positive_after);xmax=max(x for x,_ in observation.positive_after)
            ymin=min(y for _,y in observation.positive_after);ymax=max(y for _,y in observation.positive_after)
            work=(xmax-xmin+1)*(ymax-ymin+1)
            if work<=4096 and count+work>request.maximum_evaluations:
                return family_result(request,values={"measured_relief_layers":tuple(reliefs)},examined_count=count,
                    domain_complete=False,computation_bound_reached=True,frontier={"phase":"relief_components","observation_ref":observation.evidence_ref})
            if work<=4096:count+=work
        components,clipping,unknown=_relief_components(observation.positive_after,observation.observed_domain,request.window,request.overlay_support)
        reliefs.append((observation.evidence_ref,components,clipping));missing.extend(unknown)
    for orientation_index,matrix in enumerate(request.pose_orientations):
        a,b,c,d=matrix
        if a*a+c*c!=1 or b*b+d*d!=1 or a*b+c*d!=0:
            missing.append("declared_rigid_pose_orientation");continue
        for landmark_index,landmark in enumerate(landmarks):
            sx,sy=landmark.source_points[0];anchor=(a*sx+b*sy,c*sx+d*sy)
            for point_index,(x,y) in enumerate(landmark.observed_points):
                key=(matrix,(x-anchor[0],y-anchor[1]))
                if key in seen:continue
                if count>=request.maximum_evaluations:
                    return family_result(request,values={"compatible_full_poses":tuple(compatible),"refutations":tuple(refutations),"measured_relief_layers":tuple(reliefs)},
                        examined_count=count,domain_complete=False,computation_bound_reached=True,
                        frontier={"orientation_index":orientation_index,"landmark_index":landmark_index,"point_index":point_index,"generated_pose_keys":tuple(sorted(seen))})
                count+=1;seen.add(key)
                operator=PaneOperator(operator_ref=landmark.landmark_ref+".pose."+str(len(candidates)),action_ref="pose.observation_only",
                    matrix=matrix,pivot_twice=(0,0),translation=key[1],cost=0);candidates.append(operator)
                full=_transform(body.support,operator);transformed_landmarks=_transform(landmark.source_points,operator)
                if set(transformed_landmarks)!=set(landmark.observed_points):
                    refutations.append((operator.operator_ref,landmark.landmark_ref,"whole_landmark_vector_set"));continue
                first=None;masked=[]
                for observation_index,observation in enumerate(request.transform_observations):
                    if count>=request.maximum_evaluations:
                        return family_result(request,values={"compatible_full_poses":tuple(compatible),"refutations":tuple(refutations),"measured_relief_layers":tuple(reliefs)},
                            examined_count=count,domain_complete=False,computation_bound_reached=True,
                            frontier={"phase":"full_mask_verification","pose":operator,"observation_index":observation_index})
                    count+=1;domain=set(observation.observed_domain)-set(request.overlay_support);actual=set(observation.positive_after)&domain
                    if set(full)&domain!=actual or (set(full)&set(observation.negative_after))-set(request.overlay_support):
                        first=(operator.operator_ref,observation.evidence_ref,"full_positive_negative_mask");break
                    masked.append((observation.evidence_ref,tuple(sorted(set(full)-domain))))
                if first:refutations.append(first);continue
                xmin,ymin,xmax,ymax=request.screen_bounds
                screen=lambda p:xmin<=p[0]<=xmax and ymin<=p[1]<=ymax
                compatible.append({"body_ref":body.body_ref,"pose":operator,"full_support":full,"intrinsic_landmark_ref":landmark.landmark_ref,
                    "unknown_masked_pixels":tuple(masked),"window_projection":tuple(sorted(set(full)&set(request.window))),
                    "window_exterior_support":tuple(sorted(set(full)-set(request.window))),
                    "screen_clipped_support":tuple(p for p in full if not screen(p)),
                    "occluded_support":tuple(sorted(set(full)&set(request.overlay_support))),
                    "hole_match_used_as_whole_mask_equality":False,"executable_action_inferred":False})
    return family_result(request,values={"compatible_full_poses":tuple(compatible),"generated_candidate_count":len(candidates),
        "refutations":tuple(refutations),"measured_relief_layers":tuple(reliefs),
        "clipping_landmarks_not_used_as_intrinsic_holes":tuple(l.landmark_ref for l in request.pose_landmarks if l.kind in ("WINDOW_CLIP","SCREEN_CLIP","OCCLUSION"))},
        prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count)


def _algebra_fit(request):
    if not request.color_observations or not request.algebra_alternatives:
        return family_result(request,prerequisite_refs=("action_conditioned_overlap_and_algebra_alternatives",),domain_complete=False)
    retained=[]
    for algebra in request.algebra_alternatives:
        table={(r.left_ref,r.right_ref):r.output_ref for r in algebra.rules}
        if len(table)!=len(algebra.rules):
            continue
        if all(table.get((x.left_ref,x.right_ref))==x.output_ref for x in request.color_observations):
            entries=tuple(table.items())
            retained.append({"algebra":algebra,
                "idempotent_entries":tuple((l,value==l) for (l,r),value in entries if l==r),
                "order_comparisons":tuple((l,r,value==table[(r,l)]) for (l,r),value in entries if (r,l) in table),
                "unobserved_entries":tuple((l,r) for (l,r),_ in entries
                    if not any(x.left_ref==l and x.right_ref==r for x in request.color_observations))})
    return family_result(request,values={"retained_algebras":tuple(retained),
        "channel_union_contract_supplied":request.supplied_channel_union_contract},examined_count=len(request.algebra_alternatives))


def _fit_poses(request):
    if not request.transform_observations or not request.operators:
        return family_result(request,prerequisite_refs=("full_mask_observations_and_operator_domain",),domain_complete=False)
    compatible=[]
    for operator in request.operators:
        fits=True
        for observation in request.transform_observations:
            predicted=_transform(observation.before,operator)
            if predicted is None:
                fits=False;break
            domain=set(observation.observed_domain)
            observed=set(observation.positive_after)
            visible=set(predicted)&domain
            if visible!=observed or set(predicted)&set(observation.negative_after):
                fits=False;break
        if fits:
            compatible.append(operator)
    return family_result(request,values={"compatible_operators":tuple(compatible),
        "masked_support_unconstrained":True},examined_count=len(request.operators)*len(request.transform_observations))


def _projections(request):
    if not request.supplied_channel_union_contract:
        return family_result(request,prerequisite_refs=("supported_channel_composition_contract",),domain_complete=False)
    if any(p.unknown_support for p in request.panes):
        return family_result(request,prerequisite_refs=("complete_body_support_for_pose_domain",),domain_complete=False)
    required={c:set(points) for c,points in request.required_channel_supports}
    window=set(request.window)
    projections=[];frontier=[];count=0;limited=False
    xmin,ymin,xmax,ymax=request.support_bounds
    for pane in request.panes:
        queue=deque(((tuple(sorted(pane.support)),(),0),))
        seen={tuple(sorted(pane.support))}
        while queue:
            if count>=request.maximum_states:
                limited=True;break
            support,word,cost=queue.popleft();count+=1
            contribution=set(support)&window
            excess=tuple((c,tuple(sorted(contribution-required.get(c,set())))) for c in pane.channel_refs)
            if not any(points for _,points in excess):
                projections.append(PaneProjection(body_ref=pane.body_ref,full_support=support,action_word=word,cost=cost))
            if len(word)>=request.maximum_depth:
                continue
            for operator in request.operators:
                transformed=_transform(support,operator)
                if transformed is None or transformed in seen:
                    continue
                if any(not (xmin<=x<=xmax and ymin<=y<=ymax) for x,y in transformed):
                    continue
                if len(seen)+count>=request.maximum_states:
                    limited=True;continue
                seen.add(transformed);queue.append((transformed,word+(operator.operator_ref,),cost+operator.cost))
        if queue or limited:
            frontier.append((pane.body_ref,tuple(queue),tuple(sorted(seen))))
    return family_result(request,values={"projections":tuple(projections),
        "window":request.window,"required_channel_supports":request.required_channel_supports,
        "projection_residuals":tuple((p.body_ref,p.full_support,tuple(
            (c,tuple(sorted(required.get(c,set())-(set(p.full_support)&window))))
            for c in next(pane.channel_refs for pane in request.panes if pane.body_ref==p.body_ref)))
            for p in projections),"minimum_cost_proved":False},
        examined_count=count,domain_complete=not limited,computation_bound_reached=limited,
        frontier={"pose_fronts":tuple(frontier)} if limited else {})


def _joint(request):
    if not request.supplied_channel_union_contract:
        return family_result(request,prerequisite_refs=("idempotent_channel_union_contract",),domain_complete=False)
    alternatives=tuple(tuple(x for x in request.projections if x.body_ref==pane.body_ref) for pane in request.panes)
    assignments=[];conditional=[];receipts=[];refutations=[];count=0;rejected=0
    total=1
    for choices in alternatives:
        total*=len(choices)
    expected={c:set(points) for c,points in request.required_channel_supports}
    for combination in product(*alternatives):
        if count>=request.maximum_states:
            break
        count+=1
        panes=tuple(pane.model_copy(update={"support":projection.full_support}) for pane,projection in zip(request.panes,combination))
        actual={c:set(points) for c,points in _field(panes,request.window)}
        channels=set(expected)|set(actual)
        if all(actual.get(c,set())==expected.get(c,set()) for c in channels):
            scoped=request.model_copy(update={"bound_assignment":combination})
            receipt=_compile(scoped,emit_word=False)
            if receipt.prerequisite_refs:
                conditional.append(combination)
            elif receipt.values.get("budget_sufficient"):
                assignments.append(combination)
                receipt=_compile(scoped,emit_word=True)
            else:
                rejected+=1
                if len(refutations)<request.maximum_witnesses:
                    refutations.append((count-1,"shared_budget_exceeded",receipt.values.get("cost")))
                continue
            receipts.append({"combination_index":count-1,"assignment":combination,
                "compilation":receipt,
                "channel_intersections":tuple((left.body_ref,right.body_ref,
                    tuple(c for c in left.channel_refs if c in right.channel_refs),
                    tuple(sorted(set(left.support)&set(right.support)&set(request.window))))
                    for i,left in enumerate(panes) for right in panes[i+1:])})
            if len(receipts)>=request.maximum_witnesses:
                break
    limited=count<total
    return family_result(request,values={"joint_assignments":tuple(assignments),
        "conditional_joint_assignments":tuple(conditional),"compilation_receipts":tuple(receipts),
        "shared_budget_refutation_count":rejected,"refutation_samples":tuple(refutations),
        "object_identities":tuple(p.body_ref for p in request.panes),"minimum_cost_proved":False},
        prerequisite_refs=("joint_compilation_observation_boundaries",) if conditional else (),
        examined_count=count,domain_complete=not limited and not conditional,
        computation_bound_reached=limited,
        frontier={"combination_cursor":count,"combination_domain_size":total} if limited else {})


def _selected(request):
    law=request.control_law
    if not request.supplied_channel_union_contract:
        return family_result(request,prerequisite_refs=("idempotent_channel_union_contract",),domain_complete=False)
    panes=request.panes;selected=request.control_receiver_ref;cost=0;rejected=False
    if request.execution_status!="ACTIVE":
        return family_result(request,values={"panes":panes,"control_receiver_ref":selected,
            "remaining_budget":request.remaining_budget,"execution_status":request.execution_status,
            "channel_supports":_field(panes,request.window),"primitive_applied":False,
            "terminal_state_preserved":True},examined_count=0)
    if request.command_kind=="CLICK":
        if request.click_point is None:
            return family_result(request,prerequisite_refs=("measured_click_payload",),domain_complete=False)
        by_ref={p.body_ref:p for p in panes}
        candidates=[]
        for ref in request.hit_order:
            body=by_ref[ref]
            hit=request.click_point in (body.exposed_hit_support if request.hit_policy=="EXPOSED" else body.support)
            if hit:
                candidates.append(ref);break
            if request.click_point in body.unknown_support:
                return family_result(request,prerequisite_refs=("unknown_hit_support_at_click",ref),domain_complete=False)
        selected=candidates[0] if candidates else (None if request.empty_click_effect=="DESELECT" else selected)
        cost=request.selection_cost
    elif request.command_kind=="TRANSFORM":
        operator=next((x for x in request.operators if x.operator_ref==request.operator_ref),None)
        if selected is None or operator is None:
            return family_result(request,prerequisite_refs=("current_selection_and_bound_operator",),domain_complete=False)
        changed=[]
        for pane in panes:
            if pane.body_ref!=selected:
                changed.append(pane);continue
            support=_transform(pane.support,operator)
            unknown=_transform(pane.unknown_support,operator)
            if support is None or unknown is None:
                return family_result(request,prerequisite_refs=("operator_preserves_pixel_lattice",),domain_complete=False)
            if law.extent_mode!="RETAIN_FULL":
                xmin,ymin,xmax,ymax=law.extent_bounds
                inside=lambda point:xmin<=point[0]<=xmax and ymin<=point[1]<=ymax
                if law.extent_mode=="CLIP":
                    support=tuple(point for point in support if inside(point))
                    unknown=tuple(point for point in unknown if inside(point))
                elif any(not inside(point) for point in support):
                    rejected=True;changed.append(pane);continue
                elif any(not inside(point) for point in unknown):
                    return family_result(request,prerequisite_refs=("unknown_support_at_physical_extent",),domain_complete=False)
            # Exposed hit support must be remeasured after an overlap change.
            changed.append(pane.model_copy(update={"support":support,"unknown_support":unknown,"exposed_hit_support":()}))
        panes=tuple(changed);cost=law.rejected_cost if rejected else operator.cost
        receiver_law=law.receiver_after_rejected if rejected else law.receiver_after_transform
        if receiver_law=="DESELECT":
            selected=None
    else:
        return family_result(request,prerequisite_refs=("bound_primitive_kind",),domain_complete=False)
    if cost>request.remaining_budget:
        return family_result(request,values={"budget_sufficient":False,"required_cost":cost,
            "panes":request.panes,"control_receiver_ref":request.control_receiver_ref,
            "remaining_budget":request.remaining_budget,"execution_status":request.execution_status,
            "primitive_applied":False})
    remaining=request.remaining_budget-cost
    field=_field(panes,request.window)
    checkpoint=(law.checkpoint_policy=="EACH_PRIMITIVE" or
                law.checkpoint_policy=="TRANSFORM_ONLY" and request.command_kind=="TRANSFORM")
    checkpoint=checkpoint and (not rejected or law.check_after_rejected)
    expected={c:set(points) for c,points in request.required_channel_supports}
    actual={c:set(points) for c,points in field}
    unknown_in_window=any(set(p.unknown_support)&set(request.window) for p in panes)
    matches=all(expected.get(c,set())==actual.get(c,set()) for c in set(expected)|set(actual))
    acceptance=checkpoint and matches and not unknown_in_window
    exhausted=remaining==0 and law.budget_exhaustion_status!="ACTIVE"
    status="ACTIVE"
    if exhausted and law.checkpoint_priority=="EXHAUSTION_FIRST":
        status=law.budget_exhaustion_status
    elif acceptance:
        status="WIN"
    elif exhausted:
        status=law.budget_exhaustion_status
    status_alternatives=(status,)
    if checkpoint and unknown_in_window and not (exhausted and law.checkpoint_priority=="EXHAUSTION_FIRST"):
        status_alternatives=tuple(dict.fromkeys(("WIN",status)))
        status=None
    return family_result(request,values={"panes":panes,"control_receiver_ref":selected,
        "channel_supports":field,"remaining_budget":remaining,"execution_status":status,
        "execution_status_alternatives":status_alternatives,
        "primitive_applied":True,"transform_rejected":rejected,"actual_cost":cost,
        "checkpoint_evaluated":checkpoint,"field_matches":matches,
        "acceptance_checkpoint_reached":status=="WIN" if status is not None else None,
        "control_law_ref":law.law_ref},
        prerequisite_refs=("unknown_scored_support_at_checkpoint",) if checkpoint and unknown_in_window else (),
        examined_count=1,domain_complete=not (checkpoint and unknown_in_window))


def _compile(request,emit_word=True):
    if not request.supplied_channel_union_contract:
        return family_result(request,prerequisite_refs=("supported_composition_contract",),domain_complete=False)
    assignments={p.body_ref:p for p in request.bound_assignment}
    panes={p.body_ref:p for p in request.panes};operators={x.operator_ref:x for x in request.operators}
    word=[];cost=0;selected=request.control_receiver_ref;mutated=False
    clicks=0;mutations=0;transform_cost=0;click_cost=0
    def boundary(refs):
        return family_result(request,values={"executable_prefix":tuple(word),"cost":cost,
            "click_cost":click_cost,"transform_cost":transform_cost,
            "click_count":clicks,"mutation_count":mutations},
            prerequisite_refs=refs,domain_complete=False)
    if not set(assignments)<=set(request.declared_body_order):
        return boundary(("declared_order_covers_joint_assignment",))
    for ref in request.declared_body_order:
        if ref not in assignments:
            continue
        body=panes[ref];assignment=assignments[ref]
        if body.unknown_support:
            return boundary((ref,))
        # Verify the supplied word and its cost before binding any control.
        support=tuple(sorted(body.support));body_cost=0
        for operator_ref in assignment.action_word:
            if operator_ref not in operators:
                return boundary((operator_ref,))
            support=_transform(support,operators[operator_ref])
            if support is None:
                return boundary(("pixel_lattice_compatible_operator",))
            body_cost+=operators[operator_ref].cost
        if set(support)!=set(assignment.full_support):
            return boundary(("assignment_word_matches_full_support",))
        if body_cost!=assignment.cost:
            return boundary(("assignment_word_matches_transform_cost",))
        if not assignment.action_word:
            continue
        if selected!=ref:
            if mutated and request.hit_policy=="EXPOSED":
                return boundary(("fresh_exposed_hit_support",))
            above=tuple(panes[x] for x in request.hit_order[:request.hit_order.index(ref)]) if ref in request.hit_order else ()
            visible=set(body.exposed_hit_support)
            if request.hit_policy=="ORDERED_SUPPORT":
                visible=set(body.support)-set(point for p in above for point in p.support)
            if not visible or ref not in request.hit_order:
                return boundary((ref,))
            click=sorted(visible)[0]
            if emit_word:word.append((request.click_action_ref,click))
            cost+=request.selection_cost;selected=ref
            clicks+=1;click_cost+=request.selection_cost
        for operator_ref in assignment.action_word:
            if emit_word:word.append((operators[operator_ref].action_ref,None))
            cost+=operators[operator_ref].cost
            mutations+=1;transform_cost+=operators[operator_ref].cost;mutated=True
        panes[ref]=body.model_copy(update={"support":support,"exposed_hit_support":()})
    return family_result(request,values={"executable_prefix":tuple(word),"cost":cost,
        "click_cost":click_cost,"transform_cost":transform_cost,
        "click_count":clicks,"mutation_count":mutations,
        "budget_sufficient":cost<=request.remaining_budget,
        'external_word_materialized':emit_word,
        "projected_field":_field(tuple(panes.values()),request.window)},examined_count=clicks+mutations)


def _raw_key(state):
    return (tuple(sorted((p.body_ref,tuple(sorted(p.channel_refs)),tuple(sorted(p.support)),
                         tuple(sorted(p.unknown_support)),tuple(sorted(p.exposed_hit_support)))
                        for p in state.panes)),state.control_receiver_ref,state.hit_order,
            state.remaining_budget,tuple(sorted(state.frame_support)),tuple(sorted(state.overlay_support)),
            tuple(sorted((c,tuple(sorted(points))) for c,points in state.evaluated_channel_supports)),
            state.authoritative_status)


def _certificate(request):
    expected={c:set(points) for c,points in request.required_channel_supports}
    actual={c:set(points)&set(request.window) for c,points in request.actual_channel_supports}
    differences=tuple((c,tuple(sorted(expected.get(c,set())-actual.get(c,set()))),
                         tuple(sorted(actual.get(c,set())-expected.get(c,set()))))
                      for c in sorted(set(expected)|set(actual)) if expected.get(c,set())!=actual.get(c,set()))
    observations=request.path_observations
    issues=[];missing=[];checked=0;first_failure=None;event_refs=set()
    if not request.path_domain_complete:
        missing.append("complete_owned_path_observations")
    if len(observations)!=request.path_primitive_count+1:
        issues.append((0,"path_primitive_count_mismatch"))
    raw_names=("body_supports_and_identities","control_receiver","hit_order","remaining_budget",
               "frame_layer","overlay_layer","evaluated_channels","authoritative_status")
    for index,observation in enumerate(observations):
        if checked>=request.maximum_states:
            break
        checked+=1
        if observation.primitive_index!=index:
            issues.append((index,"missing_or_reordered_primitive_observation"))
        if (observation.event_owner_ref!=request.scope.event_owner_ref
                or observation.epoch!=request.scope.epoch
                or observation.model_revision_ref!=request.scope.model_revision_ref):
            issues.append((index,"path_scope_or_model_revision_mismatch"))
        if index==0 and observation.event_ref is not None:
            issues.append((index,"origin_is_not_a_primitive_event"))
        if index>0:
            if observation.event_ref is None or observation.event_ref in event_refs:
                issues.append((index,"primitive_event_missing_or_reused"))
            event_refs.add(observation.event_ref)
        if first_failure is not None:
            issues.append((index,"primitive_after_authoritative_game_over"))
        if observation.observed.authoritative_status=="GAME_OVER" and first_failure is None:
            first_failure=index
        left=_raw_key(observation.expected);right=_raw_key(observation.observed)
        issues.extend((index,name) for name,a,b in zip(raw_names,left,right) if a!=b)
        if any(p.unknown_support for p in observation.expected.panes+observation.observed.panes):
            missing.append("raw_layer_support_incomplete")
        reconstructed={c:set(points) for c,points in _field(observation.observed.panes,request.window)}
        evaluated={c:set(points)&set(request.window) for c,points in observation.observed.evaluated_channel_supports}
        if any(reconstructed.get(c,set())!=evaluated.get(c,set()) for c in set(reconstructed)|set(evaluated)):
            issues.append((index,"raw_body_layers_disagree_with_evaluated_field"))
    limited=checked<len(observations)
    end=observations[-1].observed if observations and not limited else None
    if end is not None:
        end_field={c:set(points)&set(request.window) for c,points in end.evaluated_channel_supports}
        if any(end_field.get(c,set())!=actual.get(c,set()) for c in set(end_field)|set(actual)):
            issues.append((len(observations)-1,"final_field_receipt_mismatch"))
        if observations[-1].evidence_revision_ref!=request.scope.evidence_revision_ref:
            issues.append((len(observations)-1,"final_evidence_revision_mismatch"))
        if request.acceptance_checkpoint_reached!=(end.authoritative_status=="WIN"):
            issues.append((len(observations)-1,"acceptance_receipt_mismatch"))
        if request.authoritative_failure!=(end.authoritative_status=="GAME_OVER"):
            issues.append((len(observations)-1,"failure_receipt_mismatch"))
    else:
        missing.append("qualified_final_path_state")
    if not limited and request.authoritative_failure_seen_on_path!=(first_failure is not None):
        issues.append((0,"failure_history_receipt_mismatch"))
    issues.sort(key=lambda issue:issue[0])
    full=not limited and not missing
    return family_result(request,values={"field_matches":not differences,"differences":differences,
        "raw_path_matches":not issues,"path_issue_count":len(issues),"path_issue_samples":tuple(issues[:8]),
        "first_divergence":issues[0] if issues else (differences[0] if differences else None),
        "first_authoritative_failure_index":first_failure,"entire_path_checked":full,
        "authoritative_failure":request.authoritative_failure,
        "acceptance_checkpoint_reached":request.acceptance_checkpoint_reached,
        "certificate_admissible":full and not issues and not differences
            and request.acceptance_checkpoint_reached and first_failure is None
            and not request.authoritative_failure and request.scope.input_domain_complete},
        prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=checked,
        domain_complete=full,computation_bound_reached=limited,
        frontier={"next_path_observation_index":checked} if limited else {})


def _calculate_chromatic_window_composition(request: ChromaticWindowRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:
        return family_result(request,signature_supported=False,domain_complete=False)
    required_fields={
        "window_correspondence":("raw_layer_pixels","layer_templates","interiors","normalization_models","frame_support","overlay_support"),
        "composition_table":("color_observations","algebra_alternatives"),
        "layer_ownership":("ownership_models","ownership_frames","window"),
        "hole_relief_poses":("panes","pose_body_ref","pose_landmarks","pose_orientations","transform_observations","window","overlay_support","screen_bounds"),
        "pose_operator":("transform_observations","operators"),
        "window_projections":("panes","window","required_channel_supports","operators","support_bounds"),
        "same_channel_union":("panes","window","required_channel_supports","projections","operators",
            "hit_order","declared_body_order","supplied_channel_union_contract","hit_policy",
            "selection_cost","click_action_ref","remaining_budget"),
        "compile_assignment":("panes","window","bound_assignment","declared_body_order","operators",
            "hit_order","supplied_channel_union_contract","hit_policy","selection_cost",
            "click_action_ref","remaining_budget"),
        "selected_transform":("panes","window","command_kind","remaining_budget","control_law",
            "execution_status","required_channel_supports","supplied_channel_union_contract"),
        "field_certificate":("window","actual_channel_supports","required_channel_supports",
            "authoritative_failure","authoritative_failure_seen_on_path","acceptance_checkpoint_reached",
            "path_observations","path_primitive_count","path_domain_complete","supplied_channel_union_contract"),
    }
    needed=required_fields.get(request.operation_ref,())
    if request.operation_ref=="selected_transform":
        needed+=(("hit_order","hit_policy","empty_click_effect","selection_cost","click_point")
                 if request.command_kind=="CLICK" else ("operators","operator_ref"))
    missing=missing_supplied_fields(request,needed)
    if request.operation_ref in ("selected_transform","compile_assignment","same_channel_union"):
        # Explicit None is evidence of no selected body; an omitted receiver is unknown.
        if "control_receiver_ref" not in request.model_fields_set:
            missing+=("control_receiver_ref",)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    op=request.operation_ref
    if op=="window_correspondence":return _correspondence(request)
    if op=="composition_table":return _algebra_fit(request)
    if op=="layer_ownership":
        return _ownership(request)
    if op=="hole_relief_poses":return _hole_poses(request)
    if op=="pose_operator":return _fit_poses(request)
    if op=="window_projections":return _projections(request)
    if op=="same_channel_union":return _joint(request)
    if op=="selected_transform":return _selected(request)
    if op=="compile_assignment":return _compile(request)
    if not request.supplied_channel_union_contract:
        return family_result(request,prerequisite_refs=("idempotent_channel_union_contract",),domain_complete=False)
    return _certificate(request)


def measure_chromatic_window_composition(request: ChromaticWindowRequest) -> MechanicalFamilyResult:
    return _calculate_chromatic_window_composition(request)
