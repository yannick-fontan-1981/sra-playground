"""Finite exact geometry joins; masks, control and attachment remain distinct."""
from __future__ import annotations
from itertools import product
from typing import ClassVar,Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref
from .mechanical_family_contracts_d import DMechanicalRequest,DWorkBudget,DComputationInterrupted,d_validate_request,d_result


class GeometryPixelD(FrozenModel):
    point: tuple[int,int]
    value_ref: Ref


class GeometryMarkerD(FrozenModel):
    marker_ref: Ref
    owner_ref: Ref
    point: tuple[int,int]


class GeometryPoseD(FrozenModel):
    pose_ref: Ref
    body_ref: Ref
    occurrence_ref: Ref
    pixels: tuple[GeometryPixelD,...]=Field(default=(),max_length=4096)
    occupied_points: tuple[tuple[int,int],...]=Field(default=(),max_length=4096)
    markers: tuple[GeometryMarkerD,...]=Field(default=(),max_length=128)
    orientation: tuple[tuple[int,int],tuple[int,int]]
    scale: int=Field(ge=1)
    pose_kind: Literal['RIGID','LOCAL_CONFIGURATION']
    local_control_ref: Ref|None
    local_control_effect_evidence_ref: Ref|None
    reflection_parameter_ref: Ref|None
    reflection_axis: Literal['NONE','X','Y']
    complete: bool
    evidence_ref: Ref|None


class GeometryBodyDomainD(FrozenModel):
    body_ref: Ref
    current_pose_ref: Ref
    poses: tuple[GeometryPoseD,...]=Field(min_length=1,max_length=128)
    scored: bool
    can_influence_scored: bool
    blocks_motion: bool
    occludes_control: bool
    must_physically_exist: bool
    physically_present: bool|None
    control_context_ref: Ref|None
    closed_cursor_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    placed_completion_evidence_ref: Ref|None


class MarkerPairObligationD(FrozenModel):
    obligation_ref: Ref
    left_marker_ref: Ref
    right_marker_ref: Ref|None
    allowed_vectors: tuple[tuple[int,int],...]=Field(min_length=1,max_length=128)
    single_marker_target: tuple[int,int]|None


class BodyOverlapObligationD(FrozenModel):
    left_body_ref: Ref
    right_body_ref: Ref
    minimum_overlap: int=Field(ge=0)
    maximum_overlap: int|None=Field(default=None,ge=0)


class GeometryAcceptanceClauseD(FrozenModel):
    clause_ref: Ref
    kind: Literal['HIDDEN_COVERAGE','PHYSICAL_INSERTION','AUTHENTICATION']
    actual_fulfilled: bool|None
    evidence_ref: Ref|None


class GeometryObligationBaseD(DMechanicalRequest):
    phase_ref: Literal['FINITE_CURRENT_GEOMETRY_OBLIGATIONS']
    bodies: tuple[GeometryBodyDomainD,...]=Field(min_length=1,max_length=128)
    native_body_order: tuple[Ref,...]=Field(min_length=1,max_length=128)
    target_pixels: tuple[GeometryPixelD,...]=Field(default=(),max_length=4096)
    target_field_points: tuple[tuple[int,int],...]=Field(default=(),max_length=4096)
    background_value_ref: Ref
    scored_mask_points: tuple[tuple[int,int],...]=Field(default=(),max_length=4096)
    crop_origin: tuple[int,int]
    crop_extent: tuple[int,int]
    projection_order: Literal['MASK_THEN_CROP','CROP_THEN_MASK']
    comparison: Literal['EXACT_FULL_FIELD','EXACT_SUPPORT','MARKER_OBLIGATIONS_ONLY']
    marker_pairs: tuple[MarkerPairObligationD,...]=Field(default=(),max_length=128)
    marker_degrees: tuple[tuple[Ref,int],...]=Field(default=(),max_length=128)
    body_overlap_obligations: tuple[BodyOverlapObligationD,...]=Field(default=(),max_length=128)
    allow_occurrence_reuse: bool
    parameter_positions: tuple[tuple[Ref,tuple[int,int]],...]=Field(default=(),max_length=128)
    accepted_parameter_positions: tuple[tuple[Ref,tuple[int,int]],...]=Field(default=(),max_length=128)
    parameter_alignment_evidence_ref: Ref|None
    residual_target_points: tuple[tuple[int,int],...]=Field(default=(),max_length=4096)
    native_focus_ref: Ref|None
    requested_edit_pose_ref: Ref|None
    required_orientation: tuple[tuple[int,int],tuple[int,int]]|None
    require_orientation: bool
    require_color_layout: bool
    scale_factorization_licensed: bool
    decoration_factorization_licensed: bool
    factorization_evidence_ref: Ref|None
    ignored_decoration_value_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    complete_pose_domain: bool
    additional_acceptance: tuple[GeometryAcceptanceClauseD,...]=Field(default=(),max_length=128)
    attachment_evidence_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    current_reference_pixels: tuple[GeometryPixelD,...]=Field(default=(),max_length=4096)
    scale_representation: Literal['RASTER_BLOCKS','LATTICE_POINTS']
    reference_scale: int=Field(ge=1)
    reopened_body_evidence: tuple[tuple[Ref,Ref],...]=Field(default=(),max_length=128)

    @model_validator(mode='after')
    def exact_geometry_domain(self):
        ids={b.body_ref for b in self.bodies}
        if len(ids)!=len(self.bodies) or set(self.native_body_order)!=ids or len(self.native_body_order)!=len(ids):
            raise ValueError('explicit physical/layer order must bind every persistent body')
        if any(len({p.pose_ref for p in b.poses})!=len(b.poses) or b.current_pose_ref not in {p.pose_ref for p in b.poses} or
                any(p.body_ref!=b.body_ref for p in b.poses) for b in self.bodies):
            raise ValueError('pose domain lost stable body ownership')
        if len(dict(self.parameter_positions))!=len(self.parameter_positions):raise ValueError('shared parameter duplicated')
        if self.native_focus_ref is not None and self.native_focus_ref not in ids:raise ValueError('control identity outside the body domain')
        if self.require_orientation and self.required_orientation is None:raise ValueError('semantic orientation requires its explicit desired matrix')
        if (self.scale_factorization_licensed or self.decoration_factorization_licensed) and self.factorization_evidence_ref is None:
            raise ValueError('scale/decoration normalization needs its licensed evidence, not shape-family similarity')
        if min(self.crop_extent)<0:raise ValueError('crop extent cannot be negative')
        if any(len({p.point for p in pose.pixels})!=len(pose.pixels) for body in self.bodies for pose in body.poses) or len({p.point for p in self.target_pixels})!=len(self.target_pixels):
            raise ValueError('one value per geometric pixel is required')
        return self


class ProjectionHiddenObligationsRequestD(GeometryObligationBaseD):
    schema_version: Ref='yf_arc3_v5.projection_hidden_obligations_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.constraints.projection_scope_and_hidden_obligations','AUDIT'),)


class ReflectionParameterFirstRequestD(GeometryObligationBaseD):
    schema_version: Ref='yf_arc3_v5.reflection_parameter_first_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.coverage.reflection_parameter_first','AUDIT'),)


class DiscriminatingPieceRequestD(GeometryObligationBaseD):
    schema_version: Ref='yf_arc3_v5.discriminating_piece_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.coverage.discriminating_piece','AUDIT'),)


class CoveredIdentityContextRequestD(GeometryObligationBaseD):
    schema_version: Ref='yf_arc3_v5.covered_identity_context_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.coverage.covered_identity_context','AUDIT'),)


class MarkerVectorsDegreeRequestD(GeometryObligationBaseD):
    schema_version: Ref='yf_arc3_v5.marker_vectors_degree_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.marker_assembly.vectors_and_degree','AUDIT'),)


class MarkerBodyExclusionRequestD(GeometryObligationBaseD):
    schema_version: Ref='yf_arc3_v5.marker_body_exclusion_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.marker_assembly.body_exclusion','AUDIT'),)


class EditableLocalTopologyRequestD(GeometryObligationBaseD):
    schema_version: Ref='yf_arc3_v5.editable_local_topology_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.marker_assembly.editable_local_topology','AUDIT'),)


class JointNotAttachedRequestD(GeometryObligationBaseD):
    schema_version: Ref='yf_arc3_v5.joint_not_attached_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.marker_assembly.joint_not_attached','AUDIT'),)


class OrientedIdentityRequestD(GeometryObligationBaseD):
    schema_version: Ref='yf_arc3_v5.oriented_identity_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.symbol_conditioned_route.oriented_identity','AUDIT'),)


def _geometry_point(point,pose,parameters):
    if pose.reflection_axis=='NONE':return point
    if pose.reflection_parameter_ref not in parameters:return None
    parameter=parameters[pose.reflection_parameter_ref]
    return (2*parameter[0]-point[0],point[1]) if pose.reflection_axis=='X' else (point[0],2*parameter[1]-point[1])


def _geometry_project(field,request,budget):
    mask=set(request.scored_mask_points)
    x,y=request.crop_origin;w,h=request.crop_extent
    def crop(current):
        result={}
        for point,value in sorted(current.items()):
            budget.visit({'stage':'declared_crop','point':point})
            if x<=point[0]<x+w and y<=point[1]<y+h:result[(point[0]-x,point[1]-y)]=value
        return result
    if request.projection_order=='MASK_THEN_CROP':return crop({p:v for p,v in sorted(field.items()) if p in mask})
    return {p:v for p,v in sorted(crop(field).items()) if p in mask}


def _geometry_assignment(assignment,request,budget):
    parameters=dict(request.parameter_positions)
    domains={b.body_ref:b for b in request.bodies}
    poses={p.body_ref:p for p in assignment}
    field,markers,occupied={}, {},{}
    failures,unresolved=[],[]
    for body_ref in request.native_body_order:
        body,pose=domains[body_ref],poses[body_ref]
        budget.visit({'stage':'complete_body_pose','body_ref':body_ref,'pose_ref':pose.pose_ref})
        if not pose.complete or pose.evidence_ref is None:unresolved.append(pose.pose_ref)
        if pose.reflection_axis!='NONE' and pose.reflection_parameter_ref not in parameters:unresolved.append((pose.pose_ref,'PARAMETER_MISSING'))
        if body.must_physically_exist and body.physically_present is not True:
            (unresolved if body.physically_present is None else failures).append((body_ref,'PHYSICAL_EXISTENCE'))
        if pose.pose_kind=='LOCAL_CONFIGURATION' and (pose.local_control_ref is None or pose.local_control_effect_evidence_ref is None):
            unresolved.append((pose.pose_ref,'UNGROUNDED_LOCAL_CONTROL'))
        pixels=[]
        for pixel in pose.pixels:
            budget.visit({'stage':'shared_parameter_image','body_ref':body_ref})
            point=_geometry_point(pixel.point,pose,parameters)
            if point is None:unresolved.append((pose.pose_ref,'PARAMETER_MISSING'));continue
            pixels.append((point,pixel.value_ref))
        if body.scored:
            for point,value in pixels:field[point]=value
        occupied[body_ref]={point for p in pose.occupied_points if (point:=_geometry_point(p,pose,parameters)) is not None}
        for marker in pose.markers:
            if marker.owner_ref!=body_ref or marker.marker_ref in markers:
                failures.append((marker.marker_ref,'MARKER_OWNERSHIP_OR_REUSE'));continue
            point=_geometry_point(marker.point,pose,parameters)
            if point is None:unresolved.append(marker.marker_ref);continue
            markers[marker.marker_ref]=(body_ref,point)
    occurrence_refs=[p.occurrence_ref for p in assignment]
    if not request.allow_occurrence_reuse and len(set(occurrence_refs))!=len(occurrence_refs):failures.append(('OCCURRENCE','REUSED'))
    degree={ref:0 for ref in markers}
    vectors=[]
    for pair in request.marker_pairs:
        budget.visit({'stage':'joint_marker_obligation','obligation_ref':pair.obligation_ref})
        left=markers.get(pair.left_marker_ref)
        right=markers.get(pair.right_marker_ref) if pair.right_marker_ref is not None else None
        if left is None or pair.right_marker_ref is not None and right is None:
            failures.append((pair.obligation_ref,'ENDPOINT_MISSING'));continue
        destination=right[1] if right is not None else pair.single_marker_target
        if destination is None:unresolved.append(pair.obligation_ref);continue
        vector=(destination[0]-left[1][0],destination[1]-left[1][1])
        degree[pair.left_marker_ref]+=1
        if right is not None:degree[pair.right_marker_ref]+=1
        vectors.append({'obligation_ref':pair.obligation_ref,'left_owner_ref':left[0],'right_owner_ref':None if right is None else right[0],'vector':vector})
        if vector not in pair.allowed_vectors:failures.append((pair.obligation_ref,'VECTOR'))
    for ref,required_degree in request.marker_degrees:
        if degree.get(ref)!=required_degree:failures.append((ref,'DECLARED_DEGREE'))
    for restriction in request.body_overlap_obligations:
        if restriction.left_body_ref not in occupied or restriction.right_body_ref not in occupied:
            unresolved.append(('BODY_OVERLAP','OWNER_MISSING'));continue
        overlap=len(occupied[restriction.left_body_ref]&occupied[restriction.right_body_ref])
        if overlap<restriction.minimum_overlap or restriction.maximum_overlap is not None and overlap>restriction.maximum_overlap:
            failures.append(((restriction.left_body_ref,restriction.right_body_ref),'DECLARED_BODY_OVERLAP'))
    projected=_geometry_project(field,request,budget)
    target={p.point:p.value_ref for p in request.target_pixels}
    if request.comparison=='EXACT_SUPPORT':
        if set(projected)!=set(target):failures.append(('PROJECTION','SUPPORT'))
    elif request.comparison=='EXACT_FULL_FIELD':
        field_points=set(request.target_field_points)
        if not set(projected)<=field_points or not set(target)<=field_points:failures.append(('PROJECTION','OUTSIDE_FULL_FIELD'))
        for point in sorted(field_points):
            budget.visit({'stage':'full_field_with_internal_holes','point':point})
            if projected.get(point,request.background_value_ref)!=target.get(point,request.background_value_ref):
                failures.append((point,'FULL_FIELD_VALUE'))
    acceptance=[]
    for clause in request.additional_acceptance:
        fulfilled=clause.actual_fulfilled if clause.evidence_ref is not None else None
        acceptance.append((clause.clause_ref,clause.kind,fulfilled))
        if fulfilled is None:unresolved.append(clause.clause_ref)
        elif not fulfilled:failures.append((clause.clause_ref,'ADDITIONAL_ACCEPTANCE'))
    return {'valid':not failures and not unresolved,'failures':tuple(failures),'unresolved':tuple(unresolved),'marker_vectors':tuple(vectors),
        'degree_values':tuple(sorted(degree.items())),'acceptance_clauses':tuple(acceptance),'projected_field':projected}


def _geometry_layout(pixels,pose,request):
    points=[p for p in pixels if not (request.decoration_factorization_licensed and p.value_ref in request.ignored_decoration_value_refs)]
    if not points:return ()
    origin=(min(p.point[0] for p in points),min(p.point[1] for p in points))
    divisor=pose.scale if request.scale_factorization_licensed else 1
    if request.scale_representation=='LATTICE_POINTS':
        if any((p.point[i]-origin[i])%divisor for p in points for i in (0,1)):return None
        return tuple(sorted(((p.point[0]-origin[0])//divisor,(p.point[1]-origin[1])//divisor,
            p.value_ref if request.require_color_layout else None) for p in points))
    blocks={}
    for pixel in points:
        key=((pixel.point[0]-origin[0])//divisor,(pixel.point[1]-origin[1])//divisor)
        blocks.setdefault(key,[]).append(pixel.value_ref)
    if any(len(values)!=divisor*divisor or len(set(values))!=1 for _,values in sorted(blocks.items())):return None
    return tuple((key[0],key[1],values[0] if request.require_color_layout else None) for key,values in sorted(blocks.items()))


def measure_geometry_obligation_audit_d(request: GeometryObligationBaseD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        domains=[]
        reopened=dict(request.reopened_body_evidence)
        for body in request.bodies:
            domain=body.poses
            if body.closed_cursor_refs and body.body_ref not in reopened:
                if body.placed_completion_evidence_ref is None:return d_result(request,'NEEDS_EVIDENCE','CLOSED_BODY_COMPLETION_EVIDENCE_REQUIRED')
                domain=tuple(p for p in body.poses if p.pose_ref==body.current_pose_ref)
            domains.append(domain)
        size=1
        for domain in domains:size*=len(domain)
        if size>request.domain_bound:raise DComputationInterrupted('JOINT_GEOMETRY_DOMAIN_BOUND',{'cardinality':size})
        rows,witnesses=[],[]
        valid_domains={b.body_ref:set() for b in request.bodies}
        rigid_valid=False;unresolved=False
        for assignment in product(*domains):
            measured=_geometry_assignment(assignment,request,budget)
            unresolved=unresolved or bool(measured['unresolved'])
            refs=tuple(p.pose_ref for p in assignment)
            rows.append({'pose_refs':refs,'valid':measured['valid'],'failures':measured['failures'],'unresolved':measured['unresolved'],
                'marker_vectors':measured['marker_vectors'],'degrees':measured['degree_values'],'acceptance_clauses':measured['acceptance_clauses']})
            if measured['valid']:
                rigid_valid=rigid_valid or all(p.pose_kind=='RIGID' for p in assignment)
                for pose in assignment:valid_domains[pose.body_ref].add(pose.pose_ref)
                if len(witnesses)<3:witnesses.append({'pose_refs':refs,'projected_field':tuple(sorted(measured['projected_field'].items()))})
        unique=[]
        if request.complete_pose_domain and not unresolved:
            for body in request.bodies:
                refs=valid_domains[body.body_ref]
                if len(refs)!=1:continue
                pose=next(p for p in body.poses if p.pose_ref==next(iter(refs)))
                if set(p.point for p in pose.pixels)&set(request.residual_target_points):
                    unique.append((body.body_ref,pose.pose_ref))
        parameter_dependencies=[]
        for ref,position in request.accepted_parameter_positions:
            dependent=tuple(p.pose_ref for body in request.bodies for p in body.poses if p.reflection_parameter_ref==ref and p.reflection_axis!='NONE')
            if dependent and dict(request.parameter_positions).get(ref)!=position and request.parameter_alignment_evidence_ref:
                parameter_dependencies.append({'parameter_ref':ref,'required_position':position,'dependent_pose_refs':dependent})
        edit_requests=[]
        for body in request.bodies:
            for pose in body.poses:
                if pose.pose_kind=='LOCAL_CONFIGURATION' and pose.local_control_ref and pose.local_control_effect_evidence_ref:
                    edit_requests.append((body.body_ref,pose.pose_ref,pose.local_control_ref,pose.local_control_effect_evidence_ref))
        links_after_edit=()
        if request.requested_edit_pose_ref is not None and request.native_focus_ref is not None:
            assignment=[]
            for body in request.bodies:
                ref=request.requested_edit_pose_ref if body.body_ref==request.native_focus_ref else body.current_pose_ref
                pose=next((p for p in body.poses if p.pose_ref==ref),None)
                if pose is None:unresolved=True;break
                assignment.append(pose)
            if len(assignment)==len(request.bodies):links_after_edit=_geometry_assignment(tuple(assignment),request,budget)['marker_vectors']
        orientation_rows=[]
        if request.current_reference_pixels:
            for body in request.bodies:
                for pose in body.poses:
                    budget.visit({'stage':'goal_specific_oriented_layout','pose_ref':pose.pose_ref})
                    layout=_geometry_layout(pose.pixels,pose,request)
                    reference=_geometry_layout(request.current_reference_pixels,pose.model_copy(update={'scale':request.reference_scale}),request)
                    orientation_ok=not request.require_orientation or pose.orientation==request.required_orientation
                    orientation_rows.append({'body_ref':body.body_ref,'pose_ref':pose.pose_ref,'layout_matches':layout is not None and layout==reference,
                        'requested_orientation_matches':orientation_ok,'scale_factorization_licensed':request.scale_factorization_licensed,
                        'decoration_factorization_licensed':request.decoration_factorization_licensed})
        closed=tuple((b.body_ref,b.current_pose_ref,b.closed_cursor_refs,b.placed_completion_evidence_ref) for b in request.bodies if b.closed_cursor_refs)
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if unresolved else 'COMPLETE','EXACT_GEOMETRY_AND_IDENTITY_OBLIGATIONS',complete=not unresolved,
            examined=budget.examined,values={'assignment_rows':tuple(rows),'geometry_witnesses':tuple(witnesses),
                'unique_complete_residual_placements':tuple(unique),'parameter_dependencies':tuple(parameter_dependencies),
                'grounded_local_configuration_controls':tuple(edit_requests),'closed_body_evidence_contexts':closed,
                'excluded_executable_cursor_refs':tuple(ref for b in request.bodies for ref in b.closed_cursor_refs),
                'native_focus_ref':request.native_focus_ref,'links_remeasured_after_single_body_edit':links_after_edit,
                'attachment_evidence_refs':request.attachment_evidence_refs,'joint_geometry_implies_rigid_attachment':False,
                'oriented_layout_rows':tuple(orientation_rows)},descriptive_delta={
                'has_exact_geometry_witness':bool(witnesses),'has_unique_complete_piece':bool(unique),
                'has_parameter_specific_dependency':bool(parameter_dependencies),'has_closed_control_context':bool(closed),
                'rigid_domain_exhausted_without_witness':request.complete_pose_domain and not unresolved and not rigid_valid,
                'has_grounded_local_topology_control':bool(edit_requests),
                'has_declared_attachment_evidence':bool(request.attachment_evidence_refs),
                'has_goal_specific_oriented_match':any(r['layout_matches'] and r['requested_orientation_matches'] for r in orientation_rows)})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,
            frontier={'restart_finite_geometry_domain':True,'work':error.frontier,'impossibility_or_uniqueness_claimed':False})
