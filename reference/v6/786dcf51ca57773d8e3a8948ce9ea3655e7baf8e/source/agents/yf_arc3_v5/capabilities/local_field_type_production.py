"""Pure bounded measurements for conditional local-field type production."""

from __future__ import annotations

from fractions import Fraction
import hashlib
import json
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields

from agents.yf_arc3_v5.capabilities.contracts import (
    LocalFieldClickCandidate,
    LocalFieldTypedBody,
    LocalFieldTypedSnapshot,
    LocalFieldAutonomousOccurrence,
    LocalFieldAutonomousSchedule,
    LocalFieldAcceptanceWindow,
    LocalFieldAcceptanceWindowInput,
    LocalFieldAcceptanceWindowMeasurements,
    LocalFieldAutonomousScheduleMeasurement,
    LocalFieldAutonomousSuccessorInput,
    LocalFieldAutonomousSuccessorMeasurements,
    LocalFieldCandidateMeasurement,
    LocalFieldSelectiveDomainInput,
    LocalFieldSelectiveDomainMeasurements,
    LocalFieldTransactionInput,
    LocalFieldTransactionMeasurements,
    LocalFieldTransactionQuantityDelta,
    LocalFieldTypeTransition,
)


def measure_local_field_selective_domains(
    value: LocalFieldSelectiveDomainInput,
) -> LocalFieldSelectiveDomainMeasurements:
    """Classify supplied finite click candidates by exact set relations."""

    required = set(value.required_body_refs)
    excluded = set(value.excluded_body_refs)
    exact_refs: list[str] = []
    uncertain_refs: list[str] = []
    rejected_refs: list[str] = []
    rows: list[LocalFieldCandidateMeasurement] = []
    for candidate in value.candidates:
        strict = set(candidate.strictly_influenced_body_refs)
        boundary = set(candidate.boundary_body_refs)
        missing = tuple(sorted(required - strict - boundary))
        strict_excluded = tuple(sorted(excluded & strict))
        boundary_required = tuple(sorted(required & boundary))
        boundary_excluded = tuple(sorted(excluded & boundary))
        rows.append(
            LocalFieldCandidateMeasurement(
                candidate_ref=candidate.candidate_ref,
                position=candidate.position,
                missing_required_body_refs=missing,
                strictly_included_excluded_body_refs=strict_excluded,
                boundary_required_body_refs=boundary_required,
                boundary_excluded_body_refs=boundary_excluded,
            )
        )
        if missing or strict_excluded:
            rejected_refs.append(candidate.candidate_ref)
        elif boundary_required or boundary_excluded:
            uncertain_refs.append(candidate.candidate_ref)
        else:
            exact_refs.append(candidate.candidate_ref)
    return LocalFieldSelectiveDomainMeasurements(
        exact_candidate_refs=tuple(exact_refs),
        boundary_uncertain_candidate_refs=tuple(uncertain_refs),
        rejected_candidate_refs=tuple(rejected_refs),
        candidate_measurements=tuple(rows),
    )


def measure_local_field_autonomous_successors(
    value: LocalFieldAutonomousSuccessorInput,
) -> LocalFieldAutonomousSuccessorMeasurements:
    """Project each supplied complete schedule once without choosing an order."""

    occurrence_by_ref = {item.occurrence_ref: item for item in value.occurrences}
    duplicate_refs = tuple(sorted(value.already_advanced_occurrence_refs))
    schedules: list[LocalFieldAutonomousScheduleMeasurement] = []
    if not duplicate_refs:
        for schedule in value.schedules:
            positions: dict[str, tuple[int, int]] = {}
            for occurrence_ref in schedule.ordered_occurrence_refs:
                occurrence = occurrence_by_ref[occurrence_ref]
                positions[occurrence.body_ref] = occurrence.after_position
            schedules.append(
                LocalFieldAutonomousScheduleMeasurement(
                    schedule_ref=schedule.schedule_ref,
                    ordered_occurrence_refs=schedule.ordered_occurrence_refs,
                    resulting_body_positions=tuple(sorted(positions.items())),
                )
            )
    return LocalFieldAutonomousSuccessorMeasurements(
        schedule_measurements=tuple(schedules),
        event_refs=tuple(sorted({item.event_ref for item in value.occurrences})),
        duplicate_advancement_refs=duplicate_refs,
        alternative_schedule_count=max(0, len(schedules) - 1),
    )


def measure_local_field_acceptance_windows(
    value: LocalFieldAcceptanceWindowInput,
) -> LocalFieldAcceptanceWindowMeasurements:
    """Measure joint predicate intervals under caller-supplied acceptance rules."""

    required = set(value.required_predicate_refs)
    satisfied_refs: list[str] = []
    transient_refs: list[str] = []
    retained_refs: list[str] = []
    eligible_flags: list[bool] = []
    first_interruption: str | None = None
    interrupted = False
    for sample in value.samples:
        if sample.internal_interruption_observed and first_interruption is None:
            first_interruption = sample.sample_ref
            interrupted = True
        complete = required <= set(sample.satisfied_predicate_refs)
        surplus_ok = value.surplus_admissible or sample.surplus_body_count == 0
        shared_ok = (
            value.shared_zone_occupancy_admissible
            or sample.shared_zone_occupancy_count == 0
        )
        eligible = complete and surplus_ok and shared_ok and not interrupted
        eligible_flags.append(eligible)
        if not eligible:
            continue
        satisfied_refs.append(sample.sample_ref)
        retained = required <= set(sample.retained_predicate_refs)
        if retained:
            retained_refs.append(sample.sample_ref)
        else:
            transient_refs.append(sample.sample_ref)

    windows: list[LocalFieldAcceptanceWindow] = []
    start_index: int | None = None
    for index, eligible in enumerate((*eligible_flags, False)):
        if eligible and start_index is None:
            start_index = index
        if eligible or start_index is None:
            continue
        end_index = index - 1
        window_samples = value.samples[start_index:index]
        windows.append(
            LocalFieldAcceptanceWindow(
                start_sample_ref=value.samples[start_index].sample_ref,
                end_sample_ref=value.samples[end_index].sample_ref,
                sample_count=len(window_samples),
                retained_through_window=all(
                    required <= set(sample.retained_predicate_refs)
                    for sample in window_samples
                ),
            )
        )
        start_index = None
    return LocalFieldAcceptanceWindowMeasurements(
        windows=tuple(windows),
        jointly_satisfied_sample_refs=tuple(satisfied_refs),
        transient_only_sample_refs=tuple(transient_refs),
        retained_completion_sample_refs=tuple(retained_refs),
        first_interruption_sample_ref=first_interruption,
    )


def measure_local_field_transaction(
    value: LocalFieldTransactionInput,
) -> LocalFieldTransactionMeasurements:
    """Compare exact body, type, persistence and quantity deltas."""

    before = {item.body_ref: item for item in value.before.bodies}
    transient = {item.body_ref: item for item in value.transient.bodies}
    after_maps = tuple(
        {item.body_ref: item for item in snapshot.bodies}
        for snapshot in value.after_packet
    )
    final = after_maps[-1]
    before_refs = set(before)
    transient_refs = set(transient)
    final_refs = set(final)
    all_after_refs = set.intersection(*(set(items) for items in after_maps))
    stable_type_refs = {
        body_ref
        for body_ref in all_after_refs
        if len({items[body_ref].type_ref for items in after_maps}) == 1
    }
    restored_refs = {
        body_ref
        for body_ref in before_refs & final_refs
        if before[body_ref] == final[body_ref]
        and transient.get(body_ref) != before[body_ref]
    }
    after_quantities = {
        item.quantity_ref: item.value for item in value.quantities_after
    }
    return LocalFieldTransactionMeasurements(
        final_added_body_refs=tuple(sorted(final_refs - before_refs)),
        final_removed_body_refs=tuple(sorted(before_refs - final_refs)),
        final_type_transitions=tuple(
            LocalFieldTypeTransition(
                body_ref=body_ref,
                before_type_ref=before[body_ref].type_ref,
                after_type_ref=final[body_ref].type_ref,
            )
            for body_ref in sorted(before_refs & final_refs)
            if before[body_ref].type_ref != final[body_ref].type_ref
        ),
        transient_only_body_refs=tuple(
            sorted(transient_refs - before_refs - set.union(*(set(items) for items in after_maps)))
        ),
        restored_body_refs=tuple(sorted(restored_refs)),
        bodies_surviving_entire_after_packet=tuple(sorted(all_after_refs)),
        stable_type_body_refs=tuple(sorted(stable_type_refs)),
        quantity_deltas=tuple(
            LocalFieldTransactionQuantityDelta(
                quantity_ref=item.quantity_ref,
                before_value=item.value,
                after_value=after_quantities[item.quantity_ref],
                signed_delta=after_quantities[item.quantity_ref] - item.value,
            )
            for item in value.quantities_before
        ),
    )

Position=tuple[int,int]


class FieldFootprint(FrozenModel):
    body_ref: Ref
    type_ref: Ref
    anchor: Position
    logical_offsets: tuple[Position,...] = Field(min_length=1,max_length=4096)


class FieldDistanceLaw(FrozenModel):
    metric: Literal['L1','LINF','SQUARED_L2','UNKNOWN']
    point_origin: Position
    quantum: Position
    rounding: Literal['EXACT','FLOOR','CEIL','NEAREST','UNKNOWN']
    nearest_tie: Literal['LOWER','UPPER','UNKNOWN']
    evidence_ref: Ref | None
    assumption_ref: Ref | None = None


class FieldInfluenceLaw(FrozenModel):
    rule_ref: Ref
    type_ref: Ref
    mode_ref: Ref
    response: Literal['ATTRACTION','IMPULSE','UNKNOWN']
    strict_limit_numerator: int = Field(ge=0)
    strict_limit_denominator: int = Field(ge=1)
    boundary_limit_numerator: int = Field(ge=0)
    boundary_limit_denominator: int = Field(ge=1)
    lifetime_ticks: int = Field(ge=0,le=4096)
    distance_law: FieldDistanceLaw
    evidence_ref: Ref | None
    assumption_ref: Ref | None = None
    response_step: int | None = Field(default=None,ge=0,le=4096)
    direction_policy: Literal['DIAGONAL','ROW_FIRST','COLUMN_FIRST','UNKNOWN'] = 'UNKNOWN'
    impulse_polarity: Literal['TOWARD','AWAY','UNKNOWN'] = 'UNKNOWN'


class FieldRewriteRule(FrozenModel):
    rule_ref: Ref
    parent_types: tuple[Ref,...] = Field(min_length=1,max_length=16)
    consumed_parent_indexes: tuple[int,...] = Field(max_length=16)
    result_type_ref: Ref
    permitted_result_parent_index: int | None = Field(default=None,ge=0,le=15)
    evidence_ref: Ref | None
    assumption_ref: Ref | None = None
    invariant_refs: tuple[Ref,...] = Field(default=(),max_length=64)
    @model_validator(mode='after')
    def parent_domain(self):
        if any(i<0 or i>=len(self.parent_types) for i in self.consumed_parent_indexes):raise ValueError('consumption addresses declared typed parents')
        if len(set(self.consumed_parent_indexes))!=len(self.consumed_parent_indexes):raise ValueError('each parent is consumed once')
        if self.permitted_result_parent_index is not None and self.permitted_result_parent_index>=len(self.parent_types):raise ValueError('result identity addresses its actual parent')
        return self


class FieldRewriteApplication(FrozenModel):
    rule_ref: Ref
    parent_refs: tuple[Ref,...] = Field(min_length=1,max_length=16)
    product: LocalFieldTypedBody
    recoil_bodies: tuple[LocalFieldTypedBody,...] = Field(default=(),max_length=16)
    contact_evidence_ref: Ref | None
    contact_assumption_ref: Ref | None = None


class FieldMicroEvent(FrozenModel):
    occurrence_ref: Ref
    event_ref: Ref
    kind: Literal['FIELD','AUTONOMOUS','REWRITE','CHECK','INTERRUPTION']
    tick: int = Field(ge=0,le=4096)
    before_body: LocalFieldTypedBody | None = None
    after_body: LocalFieldTypedBody | None = None
    footprint: FieldFootprint | None = None
    influence_rule_ref: Ref | None = None
    rewrite: FieldRewriteApplication | None = None
    evidence_ref: Ref | None
    assumption_ref: Ref | None = None
    realization_evidence_ref: Ref | None = None
    realization_assumption_ref: Ref | None = None


class FieldJointSchedule(FrozenModel):
    schedule_ref: Ref
    ordered_occurrence_refs: tuple[Ref,...] = Field(max_length=256)
    evidence_ref: Ref | None
    assumption_ref: Ref | None = None
    @model_validator(mode='after')
    def once(self):
        if len(set(self.ordered_occurrence_refs))!=len(self.ordered_occurrence_refs):raise ValueError('each joint occurrence is scheduled once')
        return self


class FieldStockTree(FrozenModel):
    tree_ref: Ref
    leaf_body_refs: tuple[Ref,...] = Field(max_length=128)
    postorder_applications: tuple[FieldRewriteApplication,...] = Field(max_length=128)
    reserved_body_refs: tuple[Ref,...] = Field(max_length=128)
    invariant_refs: tuple[Ref,...] = Field(max_length=64)


class FieldModel(FrozenModel):
    model_ref: Ref
    influences: tuple[FieldInfluenceLaw,...] = Field(max_length=128)
    rewrites: tuple[FieldRewriteRule,...] = Field(max_length=256)
    joint_schedules: tuple[FieldJointSchedule,...] = Field(max_length=3)
    @model_validator(mode='after')
    def distinct_rules(self):
        if len({r.rule_ref for r in self.influences})!=len(self.influences) or len({r.rule_ref for r in self.rewrites})!=len(self.rewrites):raise ValueError('distinct actual influence and rewrite laws')
        return self


class LocalContinuation(FrozenModel):
    input_digest: Ref
    phase: Literal['DOMAINS','JOINT','STOCK','UNSTARTED']
    accounted_evaluations: int = Field(default=0,ge=0)
    next_index: int = Field(default=0,ge=0,le=4096)
    inner_index: int = Field(default=0,ge=0,le=256)
    bodies: tuple[LocalFieldTypedBody,...] = Field(default=(),max_length=128)
    events: tuple[FrozenMap,...] = Field(default=(),max_length=4096)
    applied_occurrence_refs: tuple[Ref,...] = Field(default=(),max_length=256)
    completed_rows: tuple[FrozenMap,...] = Field(default=(),max_length=4096)
    completed_candidates: tuple[LocalFieldClickCandidate,...] = Field(default=(),max_length=256)
    prerequisite_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    preserved_invariant_refs: tuple[Ref,...] | None = Field(default=None,max_length=64)


class LocalRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.local_field_type_production_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_events: int = Field(ge=0,le=256)
    maximum_ticks: int = Field(ge=0,le=4096)
    state: LocalFieldTypedSnapshot | None = None
    model: FieldModel | None = None
    click_point: Position | None = None
    influence_mode_ref: Ref | None = None
    footprints: tuple[FieldFootprint,...] = Field(default=(),max_length=128)
    candidate_clicks: tuple[Position,...] = Field(default=(),max_length=256)
    required_body_refs: tuple[Ref,...] = Field(default=(),max_length=64)
    excluded_body_refs: tuple[Ref,...] = Field(default=(),max_length=64)
    micro_events: tuple[FieldMicroEvent,...] = Field(default=(),max_length=256)
    already_advanced_occurrence_refs: tuple[Ref,...] = Field(default=(),max_length=256)
    rewrite_application: FieldRewriteApplication | None = None
    stock_trees: tuple[FieldStockTree,...] = Field(default=(),max_length=4096)
    required_type_multiset: tuple[Ref,...] = Field(default=(),max_length=128)
    autonomous_input: LocalFieldAutonomousSuccessorInput | None = None
    acceptance_input: LocalFieldAcceptanceWindowInput | None = None
    transaction_input: LocalFieldTransactionInput | None = None
    transaction_kind: Literal['COMMITTED','INTERRUPTED','RESTORED'] | None = None
    transaction_evidence_ref: Ref | None = None
    resolved_removed_body_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    source_identity_ref: Ref | None = None
    resume: LocalContinuation | None = None


LOCAL_OPERATION_MODES={
    'footprint_distance':('MEASURE',),'selective_domains':('INVERSE_DOMAIN',),
    'field_successor':('STEP_INTERNAL',),'rewrite_successor':('STEP_INTERNAL',),
    'autonomous_successor':('STEP_INTERNAL',),'production_balance':('INVERSE_DOMAIN',),
    'acceptance_windows':('MEASURE',),'transaction':('COMPARE',),'occlusion':('MEASURE',),
}


def _local_digest(request):
    data=request.model_dump(mode='json',exclude={'resume','maximum_evaluations','maximum_states','maximum_events','maximum_ticks'})
    return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()


def _local_resume(request,phase,**fields):
    for name in ('events','completed_rows'):
        if name in fields:fields[name]=tuple(immutable_json_data(item) for item in fields[name])
    return LocalContinuation(input_digest=_local_digest(request),phase=phase,**fields)


def _field_supported(request,evidence,assumption=None):
    return evidence is not None or assumption is not None and assumption in request.scope.assumption_refs+request.scope.retained_alternative_refs


def _quantized_point(point,law):
    if law.metric=='UNKNOWN' or law.rounding=='UNKNOWN' or any(q<=0 for q in law.quantum):return None
    coordinates=[]
    for value,origin,quantum in zip(point,law.point_origin,law.quantum):
        number=Fraction(value-origin,quantum)
        if law.rounding=='EXACT':coordinates.append(number);continue
        lower=number.numerator//number.denominator;remainder=number-lower
        if law.rounding=='FLOOR':coordinates.append(Fraction(lower))
        elif law.rounding=='CEIL':coordinates.append(Fraction(lower+(remainder>0)))
        elif remainder==Fraction(1,2) and law.nearest_tie=='UNKNOWN':return None
        else:coordinates.append(Fraction(lower+(remainder>Fraction(1,2) or remainder==Fraction(1,2) and law.nearest_tie=='UPPER')))
    return tuple(coordinates)


def _distance(request,point,footprint,law):
    if not _field_supported(request,law.evidence_ref,law.assumption_ref):return None
    click=_quantized_point(point,law)
    if click is None:return None
    distances=[]
    for dr,dc in footprint.logical_offsets:
        position=_quantized_point((footprint.anchor[0]+dr,footprint.anchor[1]+dc),law)
        if position is None:return None
        differences=tuple(abs(a-b) for a,b in zip(click,position))
        distances.append(sum(differences) if law.metric=='L1' else max(differences) if law.metric=='LINF' else sum(d*d for d in differences))
    return min(distances)


def _influence(request,point,footprint,law):
    distance=_distance(request,point,footprint,law.distance_law)
    if distance is None or not _field_supported(request,law.evidence_ref,law.assumption_ref):return 'UNKNOWN',distance
    strict=Fraction(law.strict_limit_numerator,law.strict_limit_denominator);boundary=Fraction(law.boundary_limit_numerator,law.boundary_limit_denominator)
    if boundary<strict:return 'UNKNOWN',distance
    return 'STRICT' if distance<strict else 'BOUNDARY' if distance<=boundary else 'EXCLUDED',distance


def _requested_field_delta(point,footprint,law):
    if law.response_step is None or law.direction_policy=='UNKNOWN':return None
    if law.response=='IMPULSE' and law.impulse_polarity=='UNKNOWN':return None
    differences=(point[0]-footprint.anchor[0],point[1]-footprint.anchor[1])
    delta=tuple((1 if value>0 else -1 if value<0 else 0)*min(abs(value),law.response_step) if law.response=='ATTRACTION' else
        (1 if value>0 else -1 if value<0 else 0)*law.response_step for value in differences)
    if law.response=='IMPULSE' and law.impulse_polarity=='AWAY':delta=tuple(-d for d in delta)
    if law.direction_policy=='ROW_FIRST' and delta[0]:return (delta[0],0)
    if law.direction_policy=='COLUMN_FIRST' and delta[1]:return (0,delta[1])
    return delta


def _field_domains(request,distance_only=False):
    if set(request.required_body_refs)&set(request.excluded_body_refs):
        return family_result(request,prerequisite_refs=('consistent_required_and_protected_field_contributors',),domain_complete=False)
    resume=request.resume if request.resume is not None and request.resume.phase=='DOMAINS' else None
    count=resume.accounted_evaluations if resume is not None else 0;rows=list(resume.completed_rows) if resume is not None else []
    debt=list(resume.prerequisite_refs) if resume is not None else [];cut={};candidates=list(resume.completed_candidates) if resume is not None else []
    if not set(request.required_body_refs+request.excluded_body_refs).issubset({f.body_ref for f in request.footprints}):
        return family_result(request,prerequisite_refs=('all_required_and_excluded_logical_footprints',),domain_complete=False)
    clicks=(request.click_point,) if distance_only else request.candidate_clicks
    for index in range(resume.next_index if resume is not None else 0,len(clicks)):
        point=clicks[index]
        if len(rows)>=request.maximum_states:cut={'phase':'click_candidate_domain','next_candidate_index':index};break
        strict=[];boundary=[];measurements=[]
        for footprint in request.footprints:
            laws=tuple(r for r in request.model.influences if r.type_ref==footprint.type_ref and r.mode_ref==request.influence_mode_ref)
            work=1+len(request.model.influences)+2*len(footprint.logical_offsets)
            if count+work>request.maximum_evaluations:cut={'phase':'footprint_distance','candidate_index':index,'body_ref':footprint.body_ref};break
            count+=work
            if len(laws)!=1:debt.append('unique_or_separately_retained_class_mode_influence');continue
            status,distance=_influence(request,point,footprint,laws[0])
            if status=='STRICT':strict.append(footprint.body_ref)
            elif status in ('BOUNDARY','UNKNOWN'):boundary.append(footprint.body_ref)
            if status=='UNKNOWN':debt.append('current_footprint_anchor_quantization_and_influence_law')
            measurements.append({'body_ref':footprint.body_ref,'status':status,'distance':None if distance is None else (distance.numerator,distance.denominator)})
        if cut:break
        rows.append({'point':point,'distance_measurements':tuple(measurements)})
        candidates.append(LocalFieldClickCandidate(candidate_ref='field_click:'+str(index),position=point,strictly_influenced_body_refs=tuple(strict),boundary_body_refs=tuple(boundary)))
    if cut:cut['continuation']=_local_resume(request,'DOMAINS',accounted_evaluations=count,next_index=index,completed_rows=tuple(rows),completed_candidates=tuple(candidates),prerequisite_refs=tuple(dict.fromkeys(debt)))
    selection=None
    if not distance_only and candidates and request.required_body_refs:
        selection=measure_local_field_selective_domains(LocalFieldSelectiveDomainInput(required_body_refs=request.required_body_refs,
            excluded_body_refs=request.excluded_body_refs,candidates=tuple(candidates)))
    return family_result(request,values={'logical_footprint_measurements':tuple(rows),'selective_domain':selection,'raster_appearance_used_as_eligibility':False},
        prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)


def _rewrite(request,bodies,application,geometry_required=True):
    rules=tuple(r for r in request.model.rewrites if r.rule_ref==application.rule_ref);current={b.body_ref:b for b in bodies}
    if len(rules)!=1 or not _field_supported(request,rules[0].evidence_ref,rules[0].assumption_ref):return bodies,(),('current_declared_typed_rewrite_edge',)
    rule=rules[0];parents=tuple(current.get(ref) for ref in application.parent_refs)
    if len(set(application.parent_refs))!=len(application.parent_refs) or len(parents)!=len(rule.parent_types) or any(p is None for p in parents) or tuple(p.type_ref for p in parents)!=rule.parent_types or application.product.type_ref!=rule.result_type_ref:
        return bodies,(),('actual_typed_parents_and_declared_product',)
    if geometry_required and not _field_supported(request,application.contact_evidence_ref,application.contact_assumption_ref):return bodies,(),('current_supported_typed_contact',)
    allowed_parent=None if rule.permitted_result_parent_index is None else application.parent_refs[rule.permitted_result_parent_index]
    if application.product.body_ref in current and application.product.body_ref!=allowed_parent:return bodies,(),('supported_product_identity_and_persistence',)
    consumed={application.parent_refs[i] for i in rule.consumed_parent_indexes}
    recoil={b.body_ref:b for b in application.recoil_bodies}
    if len(recoil)!=len(application.recoil_bodies):return bodies,(),('unique_current_recoil_object_identity',)
    if any(ref not in current or ref in consumed or current[ref].type_ref!=body.type_ref for ref,body in sorted(recoil.items())):return bodies,(),('current_persistent_recoil_objects',)
    resulting=tuple(recoil.get(b.body_ref,b) for b in bodies if b.body_ref not in consumed and b.body_ref!=application.product.body_ref)+(application.product,)
    return resulting,({'kind':'TYPED_REWRITE','rule_ref':rule.rule_ref,'parent_refs':application.parent_refs,'consumed_body_refs':tuple(sorted(consumed)),
        'persistent_parent_refs':tuple(ref for ref in application.parent_refs if ref not in consumed),'product':application.product,'recoil_bodies':application.recoil_bodies},),()


def _field_joint(request):
    current=request.state;by_ref={event.occurrence_ref:event for event in request.micro_events}
    if len(by_ref)!=len(request.micro_events):return family_result(request,prerequisite_refs=('distinct_joint_micro_occurrence_identity',),domain_complete=False)
    resume=request.resume if request.resume is not None and request.resume.phase=='JOINT' else None
    responses=list(resume.completed_rows) if resume is not None else [];debt=list(resume.prerequisite_refs) if resume is not None else []
    count=resume.accounted_evaluations if resume is not None else 0;cut={}
    for schedule_index in range(resume.next_index if resume is not None else 0,len(request.model.joint_schedules)):
        schedule=request.model.joint_schedules[schedule_index]
        if len(responses)>=request.maximum_states:
            cut={'phase':'joint_field_schedules','next_schedule_index':schedule_index,'continuation':_local_resume(request,'JOINT',next_index=schedule_index,
                bodies=current.bodies,completed_rows=tuple(responses),accounted_evaluations=count,prerequisite_refs=tuple(dict.fromkeys(debt)))};break
        if not _field_supported(request,schedule.evidence_ref,schedule.assumption_ref) or set(schedule.ordered_occurrence_refs)!=set(by_ref):
            debt.append('current_complete_joint_field_and_autonomous_order');continue
        continuing=resume is not None and schedule_index==resume.next_index
        bodies=resume.bodies if continuing else current.bodies;trace=list(resume.events) if continuing else []
        applied=list(resume.applied_occurrence_refs) if continuing else [];interrupted=False;missing=[]
        for event_index in range(resume.inner_index if continuing else 0,len(schedule.ordered_occurrence_refs)):
            ref=schedule.ordered_occurrence_refs[event_index]
            event=by_ref[ref]
            if ref in request.already_advanced_occurrence_refs:trace.append({'kind':'SKIP_ALREADY_ADVANCED_OCCURRENCE','occurrence_ref':ref});continue
            if event_index>=request.maximum_events or event.tick>request.maximum_ticks:cut={'phase':'joint_micro_bound','schedule_index':schedule_index,'next_event_index':event_index};break
            work=1+sum(len(b.positions) for b in bodies)+len(request.model.influences)+len(request.model.rewrites)
            if event.footprint is not None:work+=2*len(event.footprint.logical_offsets)
            if count+work>request.maximum_evaluations:cut={'phase':'joint_micro_geometry','schedule_index':schedule_index,'next_event_index':event_index};break
            count+=work
            if not _field_supported(request,event.evidence_ref,event.assumption_ref):missing.append('current_supported_micro_event');break
            if event.kind=='INTERRUPTION':trace.append({'kind':'COMMON_INTERRUPTION','occurrence_ref':ref,'tick':event.tick});interrupted=True;applied.append(ref);break
            if event.kind=='REWRITE':
                if event.rewrite is None:missing.append('actual_typed_rewrite_application');break
                bodies,events,unknown=_rewrite(request,bodies,event.rewrite)
                if unknown:missing.extend(unknown);break
                trace.extend(events)
            elif event.kind in ('FIELD','AUTONOMOUS'):
                if event.before_body is None or event.after_body is None and event.kind=='AUTONOMOUS' or event.after_body is not None and (event.before_body.body_ref!=event.after_body.body_ref or event.before_body.type_ref!=event.after_body.type_ref) or next((b for b in bodies if b.body_ref==event.before_body.body_ref),None)!=event.before_body:
                    missing.append('current_before_and_same_identity_micro_effect');break
                if event.kind=='FIELD':
                    law=next((r for r in request.model.influences if r.rule_ref==event.influence_rule_ref),None)
                    if law is None or event.footprint is None or law.type_ref!=event.before_body.type_ref or law.mode_ref!=request.influence_mode_ref or law.response=='UNKNOWN':
                        missing.append('class_mode_field_response_and_lifetime');break
                    if event.footprint.body_ref!=event.before_body.body_ref or event.footprint.type_ref!=event.before_body.type_ref:
                        missing.append('actual_micro_body_logical_footprint');break
                    status,distance=_influence(request,request.click_point,event.footprint,law)
                    if status in ('UNKNOWN','BOUNDARY'):missing.append('discriminated_field_influence_boundary');break
                    expired=event.tick>law.lifetime_ticks
                    delta=(0,0) if status=='EXCLUDED' or expired else _requested_field_delta(request.click_point,event.footprint,law)
                    if delta is None:missing.append('calibrated_class_response_step_and_direction_policy');break
                    predicted=event.before_body.model_copy(update={'positions':tuple((r+delta[0],c+delta[1]) for r,c in event.before_body.positions)})
                    after_body=predicted if event.after_body is None else event.after_body
                    if after_body!=predicted and not _field_supported(request,event.realization_evidence_ref,event.realization_assumption_ref):
                        missing.append('supported_realization_or_blocking_of_requested_field_micro_effect');break
                    trace.append({'kind':'FIELD_LIFETIME_EXPIRED' if expired else law.response,'occurrence_ref':ref,'tick':event.tick,'body_ref':event.before_body.body_ref,'requested_delta':delta})
                else:trace.append({'kind':'AUTONOMOUS_MICRO_EFFECT','occurrence_ref':ref,'event_ref':event.event_ref,'tick':event.tick})
                after_body=event.after_body if event.kind=='AUTONOMOUS' else after_body
                bodies=tuple(after_body if b.body_ref==event.before_body.body_ref else b for b in bodies)
            else:trace.append({'kind':'JOINT_CHECK_POINT','occurrence_ref':ref,'tick':event.tick})
            applied.append(ref)
            if event.kind in ('FIELD','AUTONOMOUS'):trace.append({'kind':'INTERMEDIATE_BODY_MASK_DELTA','occurrence_ref':ref,'changed_body':after_body})
        if missing:debt.extend(missing)
        if cut:
            cut['continuation']=_local_resume(request,'JOINT',accounted_evaluations=count,next_index=schedule_index,inner_index=event_index,
                bodies=bodies,events=tuple(trace),applied_occurrence_refs=tuple(applied),completed_rows=tuple(responses),prerequisite_refs=tuple(dict.fromkeys(debt)))
            break
        responses.append({'schedule_ref':schedule.schedule_ref,'initial_snapshot':current,'after_bodies':bodies,'micro_trace':tuple(trace),'applied_occurrence_refs':tuple(applied),
            'interrupted':interrupted,'domain_complete_packet':not missing and not cut,'pending_occurrence_refs':tuple(ref for ref in schedule.ordered_occurrence_refs if ref not in applied and ref not in request.already_advanced_occurrence_refs)})
        if cut:break
    if not request.model.joint_schedules:debt.append('declared_joint_micro_schedule')
    return family_result(request,values={'joint_response_domain':tuple(responses),'extra_player_inputs':0,'whole_field_before_unrelated_reaction_used':False},
        prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)


def _stock_balance(request):
    resume=request.resume if request.resume is not None and request.resume.phase=='STOCK' else None
    rows=list(resume.completed_rows) if resume is not None else [];count=resume.accounted_evaluations if resume is not None else 0
    debt=list(resume.prerequisite_refs) if resume is not None else [];cut={};initial={b.body_ref:b for b in request.state.bodies}
    for index in range(resume.next_index if resume is not None else 0,len(request.stock_trees)):
        tree=request.stock_trees[index]
        if len(rows)>=request.maximum_states:
            cut={'phase':'supplied_stock_trees','next_tree_index':index,'continuation':_local_resume(request,'STOCK',next_index=index,
                bodies=tuple(initial[ref] for ref in tree.leaf_body_refs if ref in initial),completed_rows=tuple(rows),accounted_evaluations=count,prerequisite_refs=tuple(dict.fromkeys(debt)))};break
        if len(set(tree.leaf_body_refs))!=len(tree.leaf_body_refs) or any(ref not in initial for ref in tree.leaf_body_refs+tree.reserved_body_refs):
            debt.append('current_stock_leaf_and_reservation_identity');continue
        continuing=resume is not None and index==resume.next_index
        bodies=resume.bodies if continuing else tuple(initial[ref] for ref in tree.leaf_body_refs)
        events=list(resume.events) if continuing else [];missing=[]
        preserved_invariants=None if not continuing or resume.preserved_invariant_refs is None else set(resume.preserved_invariant_refs)
        for application_index in range(resume.inner_index if continuing else 0,len(tree.postorder_applications)):
            application=tree.postorder_applications[application_index]
            if application.product.body_ref in initial and application.product.body_ref not in tree.leaf_body_refs:
                missing.append('product_identity_not_aliasing_unconsumed_initial_stock');break
            work=1+len(bodies)+len(request.model.rewrites)
            if count+work>request.maximum_evaluations:cut={'phase':'stock_rewrite_tree','tree_index':index,'next_application_index':application_index};break
            count+=work;bodies,trace,unknown=_rewrite(request,bodies,application,False)
            if unknown:missing.extend(unknown);break
            rule=next(r for r in request.model.rewrites if r.rule_ref==application.rule_ref)
            preserved_invariants=set(rule.invariant_refs) if preserved_invariants is None else preserved_invariants&set(rule.invariant_refs)
            events.extend(trace)
        if cut:
            cut['continuation']=_local_resume(request,'STOCK',accounted_evaluations=count,next_index=index,inner_index=application_index,
                bodies=bodies,events=tuple(events),completed_rows=tuple(rows),prerequisite_refs=tuple(dict.fromkeys(debt)),
                preserved_invariant_refs=None if preserved_invariants is None else tuple(sorted(preserved_invariants)))
            break
        if preserved_invariants is not None and not set(tree.invariant_refs).issubset(preserved_invariants):missing.append('invariants_preserved_by_every_actual_chosen_rule')
        if any(next((b.type_ref for b in bodies if b.body_ref==ref),None)!=initial[ref].type_ref for ref in tree.reserved_body_refs if ref in tree.leaf_body_refs):missing.append('reserved_components_remain_available_with_their_type')
        types=tuple(sorted(b.type_ref for b in bodies))
        rows.append({'tree_ref':tree.tree_ref,'stock_feasible':not missing,'produced_multiset':types,'requested_multiset_satisfied':not missing and all(types.count(ref)>=request.required_type_multiset.count(ref) for ref in sorted(set(request.required_type_multiset))),
            'reserved_body_refs':tree.reserved_body_refs,'rewrite_witness':tuple(events),'missing_refs':tuple(missing),'route_or_contact_plan_proven':False,'area_used_as_quantity':False})
        debt.extend(missing)
    return family_result(request,values={'stock_tree_results':tuple(rows),'generic_search_csp_dp_called':False},prerequisite_refs=tuple(dict.fromkeys(debt)),
        examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)


def _measure_local_field_type_production(request: LocalRequest) -> MechanicalFamilyResult:
    prefix='mechanics.local_field_type_production.'
    operation=request.operation_ref[len(prefix):] if request.operation_ref.startswith(prefix) else ''
    if operation not in LOCAL_OPERATION_MODES or request.mode not in LOCAL_OPERATION_MODES[operation]:return family_result(request,signature_supported=False,domain_complete=False)
    required={'footprint_distance':('model','click_point','influence_mode_ref','footprints'),'selective_domains':('model','influence_mode_ref','footprints','candidate_clicks','required_body_refs'),
        'field_successor':('state','model','click_point','influence_mode_ref','micro_events'),'rewrite_successor':('state','model','rewrite_application'),
        'autonomous_successor':('autonomous_input',),'production_balance':('state','model','stock_trees','required_type_multiset'),
        'acceptance_windows':('acceptance_input',),'transaction':('transaction_input','transaction_kind','transaction_evidence_ref'),'occlusion':('state',)}[operation]
    missing=missing_supplied_fields(request,required)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if operation in ('footprint_distance','selective_domains'):return _field_domains(request,operation=='footprint_distance')
    if operation=='field_successor':return _field_joint(request)
    if operation=='production_balance':return _stock_balance(request)
    if operation=='rewrite_successor':
        work=1+len(request.model.rewrites)+sum(len(b.positions) for b in request.state.bodies)+len(request.rewrite_application.product.positions)+sum(len(b.positions) for b in request.rewrite_application.recoil_bodies)
        if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'typed_rewrite_geometry','required_work':work})
        bodies,events,debt=_rewrite(request,request.state.bodies,request.rewrite_application)
        return family_result(request,values={'after_bodies':bodies,'events':events,'unobserved_tier_edges_synthesized':False},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
    if operation=='autonomous_successor':
        value=request.autonomous_input;done=set(value.already_advanced_occurrence_refs+request.already_advanced_occurrence_refs);remaining=tuple(o for o in value.occurrences if o.occurrence_ref not in done)
        work=1+len(value.occurrences)+sum(len(s.ordered_occurrence_refs) for s in value.schedules)
        if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'autonomous_occurrence_projection','required_work':work})
        if not remaining:return family_result(request,values={'autonomous':None,'already_included_occurrence_refs':tuple(sorted(done)),'second_advancement_used':False},examined_count=work)
        filtered=tuple(LocalFieldAutonomousSchedule(schedule_ref=s.schedule_ref,ordered_occurrence_refs=tuple(ref for ref in s.ordered_occurrence_refs if ref not in done)) for s in value.schedules)
        projected=measure_local_field_autonomous_successors(LocalFieldAutonomousSuccessorInput(occurrences=remaining,schedules=filtered,already_advanced_occurrence_refs=()))
        return family_result(request,values={'autonomous':projected,'already_included_occurrence_refs':tuple(sorted(done)),'second_advancement_used':False},examined_count=work)
    if operation=='acceptance_windows':
        value=request.acceptance_input;work=1+len(value.required_predicate_refs)*len(value.samples)+sum(len(s.satisfied_predicate_refs)+len(s.retained_predicate_refs) for s in value.samples)
        if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'joint_acceptance_window','required_work':work})
        return family_result(request,values={'acceptance_windows':measure_local_field_acceptance_windows(value),'transient_occupancy_is_not_retained_completion':True},examined_count=work)
    if operation=='transaction':
        value=request.transaction_input;work=1+sum(len(b.positions) for snapshot in (value.before,value.transient)+value.after_packet for b in snapshot.bodies)+len(value.quantities_before)+len(value.quantities_after)
        if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'transaction_population_and_resources','required_work':work})
        measured=measure_local_field_transaction(value);final=value.after_packet[-1];restored=final.bodies==value.before.bodies
        debt=('actual_restored_population_without_transient_product',) if request.transaction_kind=='RESTORED' and not restored else ()
        return family_result(request,values={'transaction_kind':request.transaction_kind,'population_and_resource_deltas':measured,'final_snapshot':final,
            'rollback_population_restored':restored,'transient_products_not_kept_on_restore':not debt},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
    work=1+sum(len(b.positions) for b in request.state.bodies)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'overlapping_body_identity','required_work':work})
    groups={}
    for body in request.state.bodies:
        for point in body.positions:groups.setdefault(point,[]).append(body.body_ref)
    overlaps=tuple((point,tuple(refs)) for point,refs in sorted(groups.items()) if len(refs)>1)
    return family_result(request,values={'overlapping_identity_groups':overlaps,'retained_body_refs':tuple(b.body_ref for b in request.state.bodies),
        'unqualified_removal_request_refs':request.resolved_removed_body_refs,
        'removal_requires_causal_evidence':True,'hidden_layers_removed_by_visibility':False},examined_count=work,
        prerequisite_refs=('actual_rewrite_or_removal_evidence_for_hidden_identity',) if request.resolved_removed_body_refs else (),domain_complete=not request.resolved_removed_body_refs)


def measure_local_field_type_production(request: LocalRequest) -> MechanicalFamilyResult:
    if request.source_identity_ref is None or request.resume is not None and request.resume.input_digest!=_local_digest(request):
        return family_result(request,prerequisite_refs=('same_source_scope_revisions_and_immutable_local_field_inputs',),domain_complete=False)
    offset=request.resume.accounted_evaluations if request.resume is not None and request.resume.phase=='UNSTARTED' else 0
    if offset>=request.maximum_evaluations:return family_result(request,examined_count=offset,domain_complete=False,computation_bound_reached=True,frontier={'phase':'resumed_atomic_budget','continuation':request.resume})
    bounded=request.model_copy(update={'maximum_evaluations':request.maximum_evaluations-offset}) if offset else request
    result=_measure_local_field_type_production(bounded)
    if offset:result=result.model_copy(update={'examined_count':result.examined_count+offset})
    if result.computation_bound_reached and 'continuation' not in result.frontier:
        result=result.model_copy(update={'frontier':immutable_json_data({**dict(result.frontier),'continuation':_local_resume(request,'UNSTARTED',accounted_evaluations=result.examined_count)})})
    return result
