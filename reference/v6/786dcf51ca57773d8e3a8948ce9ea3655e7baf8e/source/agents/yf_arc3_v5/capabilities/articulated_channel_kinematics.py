"""Exact bounded measurements for articulated local frames and joint deltas."""

from __future__ import annotations

from fractions import Fraction
from typing import Literal
import hashlib
import json
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields

from agents.yf_arc3_v5.capabilities.contracts import (
    ArticulatedBodyGeometry,
    ArticulatedBodyState,
    ArticulatedKinematicsInput,
    ArticulatedKinematicsMeasurements,
    ArticulatedLocalOperation,
    ArticulatedSharedSnapshotInput,
    ArticulatedSharedSnapshotMeasurements,
    ArticulatedSuccessorInput,
    ArticulatedSuccessorMeasurements,
    Rational,
    RationalMatrix2,
    RationalPoint,
)


FractionPoint = tuple[Fraction, Fraction]
FractionMatrix2 = tuple[tuple[Fraction, Fraction], tuple[Fraction, Fraction]]


def _fraction(value: Rational) -> Fraction:
    return Fraction(value[0], value[1])


def _rational(value: Fraction) -> Rational:
    return (value.numerator, value.denominator)


def _point(value: RationalPoint) -> FractionPoint:
    return (_fraction(value[0]), _fraction(value[1]))


def _matrix(value: RationalMatrix2) -> FractionMatrix2:
    return (
        (_fraction(value[0][0]), _fraction(value[0][1])),
        (_fraction(value[1][0]), _fraction(value[1][1])),
    )


def _rational_point(value: FractionPoint) -> RationalPoint:
    return (_rational(value[0]), _rational(value[1]))


def _rational_matrix(value: FractionMatrix2) -> RationalMatrix2:
    return (
        (_rational(value[0][0]), _rational(value[0][1])),
        (_rational(value[1][0]), _rational(value[1][1])),
    )


def _matrix_product(left: FractionMatrix2, right: FractionMatrix2) -> FractionMatrix2:
    return (
        (
            left[0][0] * right[0][0] + left[0][1] * right[1][0],
            left[0][0] * right[0][1] + left[0][1] * right[1][1],
        ),
        (
            left[1][0] * right[0][0] + left[1][1] * right[1][0],
            left[1][0] * right[0][1] + left[1][1] * right[1][1],
        ),
    )


def _matrix_point(matrix: FractionMatrix2, point: FractionPoint) -> FractionPoint:
    return (
        matrix[0][0] * point[0] + matrix[0][1] * point[1],
        matrix[1][0] * point[0] + matrix[1][1] * point[1],
    )


def _point_add(left: FractionPoint, right: FractionPoint) -> FractionPoint:
    return (left[0] + right[0], left[1] + right[1])


def _compose(
    outer: tuple[FractionMatrix2, FractionPoint],
    inner: tuple[FractionMatrix2, FractionPoint],
) -> tuple[FractionMatrix2, FractionPoint]:
    outer_matrix, outer_translation = outer
    inner_matrix, inner_translation = inner
    return (
        _matrix_product(outer_matrix, inner_matrix),
        _point_add(_matrix_point(outer_matrix, inner_translation), outer_translation),
    )


def _world_frames(
    bodies: tuple[ArticulatedBodyState, ...],
) -> dict[str, tuple[FractionMatrix2, FractionPoint]]:
    by_ref = {body.body_ref: body for body in bodies}
    frames: dict[str, tuple[FractionMatrix2, FractionPoint]] = {}

    def resolve(body_ref: str) -> tuple[FractionMatrix2, FractionPoint]:
        cached = frames.get(body_ref)
        if cached is not None:
            return cached
        body = by_ref[body_ref]
        local = (_matrix(body.local_linear), _point(body.local_translation))
        frame = local if body.parent_ref is None else _compose(resolve(body.parent_ref), local)
        frames[body_ref] = frame
        return frame

    for body in bodies:
        resolve(body.body_ref)
    return frames


def measure_articulated_kinematics(
    value: ArticulatedKinematicsInput,
) -> ArticulatedKinematicsMeasurements:
    """Compose exact local frames and expose roots, free ends and markers."""

    frames = _world_frames(value.bodies)
    geometries: list[ArticulatedBodyGeometry] = []
    for body in value.bodies:
        linear, translation = frames[body.body_ref]
        world_axis = _matrix_point(linear, _point(body.local_axis))
        extent = _fraction(body.local_extent)
        free_end = _point_add(
            translation, (world_axis[0] * extent, world_axis[1] * extent)
        )
        markers = tuple(
            (
                marker_ref,
                _rational_point(
                    _point_add(translation, _matrix_point(linear, _point(offset)))
                ),
            )
            for marker_ref, offset in body.marker_offsets
        )
        geometries.append(
            ArticulatedBodyGeometry(
                body_ref=body.body_ref,
                root_position=_rational_point(translation),
                free_end_position=_rational_point(free_end),
                world_axis=_rational_point(world_axis),
                local_extent=body.local_extent,
                marker_positions=markers,
            )
        )
    return ArticulatedKinematicsMeasurements(
        body_geometries=tuple(geometries), body_count=len(geometries)
    )


def _apply_local_operation(
    body: ArticulatedBodyState, operation: ArticulatedLocalOperation
) -> ArticulatedBodyState:
    current = (_matrix(body.local_linear), _point(body.local_translation))
    delta = (_matrix(operation.linear_delta), _point(operation.translation_delta))
    updated = (
        _compose(delta, current)
        if operation.composition_side == "before_local"
        else _compose(current, delta)
    )
    extent = _fraction(body.local_extent) + _fraction(operation.extent_delta)
    return body.model_copy(
        update={
            "local_linear": _rational_matrix(updated[0]),
            "local_translation": _rational_point(updated[1]),
            "local_extent": _rational(extent),
        }
    )


def measure_articulated_shared_snapshot(
    value: ArticulatedSharedSnapshotInput,
) -> ArticulatedSharedSnapshotMeasurements:
    """Compose distinct supplied causes once, without selecting their scope or order."""

    unique: list[ArticulatedLocalOperation] = []
    duplicate_refs: list[str] = []
    seen: set[tuple[str, str]] = set()
    for operation in value.operations:
        key = (operation.cause_ref, operation.receiver_ref)
        if key in seen:
            duplicate_refs.append(operation.operation_ref)
            continue
        seen.add(key)
        unique.append(operation)

    repeated_orders={item.order_index for item in unique if item.order_index is not None and sum(other.order_index==item.order_index for other in unique)>1}
    if len(unique) > 1 and (any(item.order_index is None for item in unique) or repeated_orders):
        return ArticulatedSharedSnapshotMeasurements(
            status="ambiguous_order",
            resulting_bodies=value.bodies,
            deduplicated_operation_refs=tuple(duplicate_refs),
            unresolved_order_refs=tuple(
                item.operation_ref for item in unique if item.order_index is None or item.order_index in repeated_orders
            ),
            applied_operation_count=0,
        )

    ordered = sorted(
        unique,
        key=lambda item: (
            item.order_index if item.order_index is not None else 0,
            item.operation_ref,
        ),
    )
    body_by_ref = {body.body_ref: body for body in value.bodies}
    for operation in ordered:
        body_by_ref[operation.receiver_ref] = _apply_local_operation(
            body_by_ref[operation.receiver_ref], operation
        )
    resulting = tuple(body_by_ref[item.body_ref] for item in value.bodies)
    return ArticulatedSharedSnapshotMeasurements(
        status="applied",
        resulting_bodies=resulting,
        deduplicated_operation_refs=tuple(duplicate_refs),
        unresolved_order_refs=(),
        applied_operation_count=len(ordered),
    )


def measure_articulated_successor(
    value: ArticulatedSuccessorInput,
) -> ArticulatedSuccessorMeasurements:
    """Return one complete joint delta for the source-declared transaction result."""

    resulting = (
        value.before_bodies
        if value.committed_packet == "before"
        else value.supplied_after_bodies
    )
    before_geometry = measure_articulated_kinematics(
        ArticulatedKinematicsInput(bodies=value.before_bodies)
    )
    after_geometry = measure_articulated_kinematics(
        ArticulatedKinematicsInput(bodies=resulting)
    )
    before_by_ref = {item.body_ref: item for item in value.before_bodies}
    before_geometry_by_ref = {
        item.body_ref: item for item in before_geometry.body_geometries
    }
    changed_extents: list[str] = []
    changed_poses: list[str] = []
    changed_markers: list[str] = []
    for body, geometry in zip(resulting, after_geometry.body_geometries, strict=True):
        before_body = before_by_ref[body.body_ref]
        before_shape = before_geometry_by_ref[body.body_ref]
        if body.local_extent != before_body.local_extent:
            changed_extents.append(body.body_ref)
        if (
            geometry.root_position != before_shape.root_position
            or geometry.world_axis != before_shape.world_axis
        ):
            changed_poses.append(body.body_ref)
        before_markers = dict(before_shape.marker_positions)
        changed_markers.extend(
            marker_ref
            for marker_ref, position in geometry.marker_positions
            if before_markers.get(marker_ref) != position
        )
    return ArticulatedSuccessorMeasurements(
        resulting_bodies=resulting,
        changed_extent_refs=tuple(changed_extents),
        changed_pose_refs=tuple(changed_poses),
        changed_marker_refs=tuple(changed_markers),
        transaction_outcome=value.transaction_outcome,
        atomic_model=value.atomic_model,
    )

class ArtiMask(FrozenModel):
    body_ref: Ref
    local_points: tuple[RationalPoint,...] = Field(min_length=1,max_length=4096)
    extent_ref: Rational | None
    extent_independent: bool
    passive: bool
    evidence_ref: Ref | None


class ArtiState(FrozenModel):
    bodies: tuple[ArticulatedBodyState,...] = Field(min_length=1,max_length=32)
    masks: tuple[ArtiMask,...] = Field(max_length=128)
    @model_validator(mode='after')
    def forest(self):
        ArticulatedKinematicsInput(bodies=self.bodies)
        if any(m.body_ref not in {b.body_ref for b in self.bodies} for m in self.masks):raise ValueError('each passive or active mask retains its actual owner')
        return self


class ArtiAttachment(FrozenModel):
    child_ref: Ref
    parent_ref: Ref
    follows_free_end: bool
    evidence_ref: Ref | None


class ArtiExtentBound(FrozenModel):
    body_ref: Ref
    minimum: Rational
    maximum: Rational


class ArtiStep(FrozenModel):
    input_ref: Ref
    channel_ref: Ref
    operations: tuple[ArticulatedLocalOperation,...] = Field(min_length=1,max_length=64)
    before_bodies: tuple[ArticulatedBodyState,...] = Field(min_length=1,max_length=32)
    after_masks: tuple[ArtiMask,...] = Field(max_length=128)
    swept_world_masks: tuple[tuple[Ref,tuple[RationalPoint,...]],...] = Field(default=(),max_length=32)
    sweep_complete_evidence_ref: Ref | None
    same_snapshot_simultaneous: bool
    evidence_ref: Ref | None
    partial_after_bodies: tuple[ArticulatedBodyState,...] = Field(default=(),max_length=32)
    partial_commit_evidence_ref: Ref | None = None


class ArtiCandidate(FrozenModel):
    candidate_ref: Ref
    operator_word: tuple[ArtiStep,...] = Field(max_length=256)
    declared_after_bodies: tuple[ArticulatedBodyState,...] = Field(min_length=1,max_length=32)
    amplitude: Rational
    @model_validator(mode='after')
    def finite_endpoint(self):
        ArticulatedKinematicsInput(bodies=self.declared_after_bodies)
        return self


class ArtiModel(FrozenModel):
    model_ref: Ref
    known_operation_refs: tuple[Ref,...] = Field(max_length=4096)
    attachments: tuple[ArtiAttachment,...] = Field(max_length=32)
    extent_bounds: tuple[ArtiExtentBound,...] = Field(max_length=32)
    collision_mode: Literal['DISCRETE_POSE','SWEPT_MOTION','UNKNOWN']
    collision_evidence_ref: Ref | None
    atomic_rejection: bool | None
    allowed_overlap_pairs: tuple[tuple[Ref,Ref],...] = Field(max_length=128)


class ArtiContinuation(FrozenModel):
    input_digest: Ref
    phase: Literal['CANDIDATES','UNSTARTED']
    candidate_index: int = Field(default=0,ge=0,le=4096)
    step_index: int = Field(default=0,ge=0,le=256)
    current_state: ArtiState | None = None
    completed_rows: tuple[FrozenMap,...] = Field(default=(),max_length=4096)
    word_trace: tuple[FrozenMap,...] = Field(default=(),max_length=4096)
    prerequisite_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    accounted_evaluations: int = Field(default=0,ge=0)


class ArtiRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.articulated_channel_kinematics_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    source_identity_ref: Ref
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_primitives: int = Field(ge=0,le=256)
    state: ArtiState | None = None
    model: ArtiModel | None = None
    step: ArtiStep | None = None
    candidates: tuple[ArtiCandidate,...] = Field(default=(),max_length=4096)
    endpoint_body_ref: Ref | None = None
    endpoint_target: RationalPoint | None = None
    history_masks: tuple[ArtiMask,...] = Field(default=(),max_length=128)
    ownership_alternatives: tuple[tuple[Ref,...],...] = Field(default=(),max_length=128)
    resume: ArtiContinuation | None = None


ARTI_OPERATION_MODES={
    'kinematics':('MEASURE',),'shared_snapshot':('STEP_INTERNAL',),
    'rotation_domain':('INVERSE_DOMAIN',),'collision_policy':('PRECONDITION',),
    'prefix_domains':('INVERSE_DOMAIN',),'successor':('STEP',),
    'inverse_pose':('INVERSE_DOMAIN',),'layers':('MEASURE',),
}


def _arti_digest(request):
    data=request.model_dump(mode='json',exclude={'resume','maximum_evaluations','maximum_states','maximum_primitives'})
    return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()


def _arti_resume(request,phase,**fields):
    for key in ('completed_rows','word_trace'):
        if key in fields:fields[key]=tuple(immutable_json_data(row) for row in fields[key])
    return ArtiContinuation(input_digest=_arti_digest(request),phase=phase,**fields)


def _arti_work(state,step=None):
    return 1+len(state.bodies)**2+sum(len(b.marker_offsets) for b in state.bodies)+len(state.bodies)*sum(len(m.local_points) for m in state.masks)+(
        0 if step is None else len(step.operations)**2+len(state.bodies)*sum(len(m.local_points) for m in step.after_masks)+sum(len(points) for owner,points in step.swept_world_masks))


def _arti_world_masks(state):
    frames=_world_frames(state.bodies);by_ref={b.body_ref:b for b in state.bodies};rows=[];missing=[]
    if {m.body_ref for m in state.masks}!={b.body_ref for b in state.bodies}:missing.append('complete_owned_active_and_passive_mask_domain')
    for mask in state.masks:
        body=by_ref[mask.body_ref]
        if mask.evidence_ref is None or not mask.extent_independent and mask.extent_ref!=body.local_extent:
            missing.append('current_complete_mask_for_extent:'+mask.body_ref);continue
        linear,translation=frames[mask.body_ref]
        rows.append((mask.body_ref,frozenset(_point_add(translation,_matrix_point(linear,_point(point))) for point in mask.local_points)))
    return tuple(rows),tuple(missing)


def _arti_collision(request,state,step=None):
    world,debt=_arti_world_masks(state)
    if debt:return (),debt
    if request.model.collision_mode=='UNKNOWN' or request.model.collision_evidence_ref is None:return (),('current_discrete_or_swept_collision_model',)
    if request.model.collision_mode=='SWEPT_MOTION':
        if step is None or step.sweep_complete_evidence_ref is None:return (),('complete_supplied_swept_geometry_not_endpoint_inference',)
        required={b.body_ref for b in state.bodies}
        if {ref for ref,points in step.swept_world_masks}!=required:return (),('whole_owned_swept_motion_domain',)
        world=tuple((ref,frozenset(_point(p) for p in points)) for ref,points in step.swept_world_masks)
    allowed={frozenset(pair) for pair in request.model.allowed_overlap_pairs}
    contacts=tuple((a,b,tuple(_rational_point(point) for point in sorted(points&other))) for i,(a,points) in enumerate(world) for b,other in world[i+1:]
        if a!=b and points&other and frozenset((a,b)) not in allowed)
    return contacts,()


def _arti_apply(request,state,step):
    if step.evidence_ref is None or state.bodies!=step.before_bodies:return state,(),('actual_state_conditioned_control_transition',)
    bodies={b.body_ref:b for b in state.bodies};unique=[];seen={}
    if {link.child_ref for link in request.model.attachments}!={b.body_ref for b in state.bodies if b.parent_ref is not None}:
        return state,(),('declared_predecessor_anchor_law_for_every_attachment',)
    for op in step.operations:
        if op.operation_ref not in request.model.known_operation_refs or op.receiver_ref not in bodies or step.channel_ref not in bodies[op.receiver_ref].channel_refs:
            return state,(),('available_actual_channel_and_receiver_control',)
        key=(op.cause_ref,op.receiver_ref)
        if key in seen and seen[key].model_copy(update={'operation_ref':op.operation_ref})!=op:
            return state,(),('consistent_repeated_cause_report_payload',)
        if key not in seen:seen[key]=op;unique.append(op)
    if step.same_snapshot_simultaneous and len({o.receiver_ref for o in unique})==len(unique):
        operations=tuple(op.model_copy(update={'order_index':i}) for i,op in enumerate(unique))
    else:operations=step.operations
    measured=measure_articulated_shared_snapshot(ArticulatedSharedSnapshotInput(bodies=state.bodies,operations=operations))
    if measured.status!='applied':return state,(),('declared_compound_cause_order_or_supported_simultaneous_local_edits',)
    after={b.body_ref:b for b in measured.resulting_bodies}
    for link in request.model.attachments:
        if link.child_ref not in after or link.parent_ref not in after or after[link.child_ref].parent_ref!=link.parent_ref:
            return state,(),('actual_directed_attachment_relation',)
        if link.evidence_ref is None:return state,(),('current_predecessor_attachment_transport',)
        if link.follows_free_end:
            parent=after[link.parent_ref];old=bodies[link.parent_ref];delta=_fraction(parent.local_extent)-_fraction(old.local_extent)
            axis=_point(parent.local_axis);child=after[link.child_ref];point=_point(child.local_translation)
            after[link.child_ref]=child.model_copy(update={'local_translation':_rational_point((point[0]+axis[0]*delta,point[1]+axis[1]*delta))})
    for bound in request.model.extent_bounds:
        if bound.body_ref not in after or not _fraction(bound.minimum)<=_fraction(after[bound.body_ref].local_extent)<=_fraction(bound.maximum):
            return state,({'kind':'EXTENT_BOUND_REFUSAL','body_ref':bound.body_ref},),()
    resulting=tuple(after[b.body_ref] for b in state.bodies)
    predicted=ArtiState(bodies=resulting,masks=step.after_masks)
    contacts,debt=_arti_collision(request,predicted,step)
    if debt:return state,(),debt
    if request.model.atomic_rejection is None:return state,(),('current_atomic_or_partial_transaction_policy',)
    partial=False
    if contacts and not request.model.atomic_rejection:
        if step.partial_commit_evidence_ref is None or tuple(b.body_ref for b in step.partial_after_bodies)!=tuple(b.body_ref for b in state.bodies):
            return state,({'kind':'CONTACT','contacts':contacts},),('supported_partial_receiver_commit_not_universal_rejection',)
        if any(body not in (bodies[body.body_ref],after[body.body_ref]) for body in step.partial_after_bodies):
            return state,(),('partial_local_receiver_changes_belong_to_supplied_joint_edit',)
        resulting=step.partial_after_bodies;predicted=ArtiState(bodies=resulting,masks=step.after_masks)
        mask_debt=_arti_world_masks(predicted)[1]
        if mask_debt:return state,(),mask_debt
        partial=True
    committed=not contacts
    packet=measure_articulated_successor(ArticulatedSuccessorInput(before_bodies=state.bodies,supplied_after_bodies=resulting,
        transaction_outcome='partial_prefix' if partial else 'committed' if committed else 'rejected',atomic_model=request.model.atomic_rejection,
        committed_packet='supplied_after' if committed or partial else 'before'))
    final=predicted if committed or partial else state
    return final,({'kind':'JOINT_ARTICULATED_EDIT','input_ref':step.input_ref,'joint_delta':packet,'contacts':contacts,
        'deduplicated_report_refs':measured.deduplicated_operation_refs,'genuine_transform_count':measured.applied_operation_count,'committed':committed,'partial_prefix':partial},),()


def _arti_candidates(request,operation):
    resume=request.resume if request.resume is not None and request.resume.phase=='CANDIDATES' else None
    rows=list(resume.completed_rows) if resume is not None else [];debt=list(resume.prerequisite_refs) if resume is not None else []
    count=resume.accounted_evaluations if resume is not None else 0;cut={}
    for index in range(resume.candidate_index if resume is not None else 0,len(request.candidates)):
        candidate=request.candidates[index]
        current=resume.current_state if resume is not None and index==resume.candidate_index and resume.current_state is not None else request.state
        trace=list(resume.word_trace) if resume is not None and index==resume.candidate_index else []
        start=resume.step_index if resume is not None and index==resume.candidate_index else 0
        missing=[];blocked_index=None
        if len(rows)>=request.maximum_states:
            cut={'phase':'articulated_candidate_rows','continuation':_arti_resume(request,'CANDIDATES',candidate_index=index,current_state=current,
                completed_rows=tuple(rows),word_trace=tuple(trace),step_index=start,accounted_evaluations=count,prerequisite_refs=tuple(dict.fromkeys(debt)))};break
        for step_index in range(start,len(candidate.operator_word)):
            step=candidate.operator_word[step_index];work=_arti_work(current,step)
            if step_index>=request.maximum_primitives or count+work>request.maximum_evaluations:
                cut={'phase':'articulated_word_prefix','candidate_index':index,'step_index':step_index,
                    'continuation':_arti_resume(request,'CANDIDATES',candidate_index=index,step_index=step_index,current_state=current,word_trace=tuple(trace),
                        completed_rows=tuple(rows),accounted_evaluations=count,prerequisite_refs=tuple(dict.fromkeys(debt)))};break
            count+=work;after,events,unknown=_arti_apply(request,current,step)
            if unknown:missing.extend(unknown);break
            trace.extend(events)
            current=after
            if any(event.get('committed') is False or event.get('kind')=='EXTENT_BOUND_REFUSAL' for event in events):blocked_index=step_index;break
        if cut:break
        geometry=measure_articulated_kinematics(ArticulatedKinematicsInput(bodies=current.bodies))
        endpoint=next((g.free_end_position for g in geometry.body_geometries if g.body_ref==request.endpoint_body_ref),None)
        complete=not missing and blocked_index is None and current.bodies==candidate.declared_after_bodies
        if not missing and blocked_index is None and current.bodies!=candidate.declared_after_bodies:missing.append('declared_pose_reached_by_actual_executable_operator_word');complete=False
        endpoint_match=endpoint==request.endpoint_target if request.endpoint_target is not None else None
        rows.append({'candidate_ref':candidate.candidate_ref,'amplitude':candidate.amplitude,'after_state':current,'joint_word_trace':tuple(trace),
            'complete_intended_word_succeeded':complete,'first_blocked_step':blocked_index,'retained_useful_prefix':blocked_index is not None and bool(trace),
            'endpoint_predicate_satisfied':endpoint_match,'executable_inverse_pose':complete and endpoint_match is not False,'missing_refs':tuple(missing)})
        debt.extend(missing)
    return family_result(request,values={'articulated_candidate_domain':tuple(rows),'requested_domain_kind':operation,'mathematical_pose_alone_used_as_executability':False,
        'minimum_or_complete_route_search_proven':False},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,
        domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)


def _measure_articulated_channel_kinematics(request):
    operation=request.operation_ref[len('mechanics.articulated_channel_kinematics.'):] if request.operation_ref.startswith('mechanics.articulated_channel_kinematics.') else ''
    if operation not in ARTI_OPERATION_MODES or request.mode not in ARTI_OPERATION_MODES[operation]:return family_result(request,signature_supported=False,domain_complete=False)
    fields={'kinematics':('state',),'shared_snapshot':('state','model','step'),'collision_policy':('state','model'),
        'rotation_domain':('state','model','candidates'),'prefix_domains':('state','model','candidates'),'inverse_pose':('state','model','candidates','endpoint_body_ref','endpoint_target'),
        'successor':('state','model','step'),'layers':('state','history_masks','ownership_alternatives')}[operation]
    missing=missing_supplied_fields(request,fields)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if operation in ('rotation_domain','prefix_domains','inverse_pose'):return _arti_candidates(request,operation)
    work=_arti_work(request.state,request.step if operation in ('shared_snapshot','successor') else None)
    if operation=='layers':work+=len(request.state.bodies)*sum(len(mask.local_points) for mask in request.history_masks)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':operation,'required_work':work})
    if operation=='kinematics':return family_result(request,values={'kinematics':measure_articulated_kinematics(ArticulatedKinematicsInput(bodies=request.state.bodies))},examined_count=work)
    if operation in ('shared_snapshot','successor'):
        after,events,debt=_arti_apply(request,request.state,request.step)
        return family_result(request,values={'after_state':after,'joint_events':events,'partial_receivers_independently_committed':False},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
    if operation=='collision_policy':
        contacts,debt=_arti_collision(request,request.state,request.step)
        return family_result(request,values={'contacts':contacts,'collision_mode':request.model.collision_mode,'clearance':None if debt else not contacts,
            'endpoint_implies_sweep_rejection':False},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
    predicted=ArtiState(bodies=request.state.bodies,masks=request.history_masks)
    world,debt=_arti_world_masks(predicted)
    return family_result(request,values={'owned_hidden_world_masks':tuple({'body_ref':owner,'points':tuple(_rational_point(p) for p in sorted(points))} for owner,points in world),
        'ownership_alternatives':request.ownership_alternatives,'visible_gaps_remove_structure':False},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)


def measure_articulated_channel_kinematics(request: ArtiRequest) -> MechanicalFamilyResult:
    if request.resume is not None and request.resume.input_digest!=_arti_digest(request):
        return family_result(request,prerequisite_refs=('same_source_scope_revision_and_articulated_inputs_for_resume',),domain_complete=False)
    offset=request.resume.accounted_evaluations if request.resume is not None and request.resume.phase=='UNSTARTED' else 0
    if offset>=request.maximum_evaluations:return family_result(request,examined_count=offset,domain_complete=False,computation_bound_reached=True,frontier={'phase':'resumed_atomic_budget','continuation':request.resume})
    bounded=request.model_copy(update={'maximum_evaluations':request.maximum_evaluations-offset}) if offset else request
    result=_measure_articulated_channel_kinematics(bounded)
    if offset:result=result.model_copy(update={'examined_count':result.examined_count+offset})
    if result.computation_bound_reached and 'continuation' not in result.frontier:
        result=result.model_copy(update={'frontier':immutable_json_data({**dict(result.frontier),'continuation':_arti_resume(request,'UNSTARTED',accounted_evaluations=result.examined_count)})})
    return result
