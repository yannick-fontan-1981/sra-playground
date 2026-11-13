"""Pure bounded measurements for joint directed-flow ticks and recovery packets."""

from __future__ import annotations

from typing import Literal
import hashlib
import json
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields

from agents.yf_arc3_v5.capabilities.contracts import (
    DirectedFlowColliderUnionInput,
    DirectedFlowColliderMask,
    DirectedFlowColliderUnionMeasurements,
    DirectedFlowJointTickInput,
    DirectedFlowFront,
    DirectedFlowTickSchedule,
    DirectedFlowJointTickMeasurements,
    DirectedFlowJointTickSuccessor,
    DirectedFlowProjectedFront,
    DirectedFlowQuantityDelta,
    DirectedFlowRecoveryInput,
    DirectedFlowRecoveryMeasurements,
    DirectedFlowTraceCell,
)


Position = tuple[int, int]


def measure_directed_flow_collider_union(
    value: DirectedFlowColliderUnionInput,
) -> DirectedFlowColliderUnionMeasurements:
    """Union supplied masks while preserving every owner/control/attachment."""

    owners: dict[Position, set[str]] = {}
    for mask in value.collider_masks:
        for position in mask.positions:
            owners.setdefault(position, set()).add(mask.collider_ref)
    owner_rows = tuple(
        (position, tuple(sorted(owner_refs)))
        for position, owner_refs in sorted(owners.items())
    )
    return DirectedFlowColliderUnionMeasurements(
        union_positions=tuple(sorted(owners)),
        owner_refs_by_position=owner_rows,
        overlap_positions=tuple(
            position for position, owner_refs in owner_rows if len(owner_refs) > 1
        ),
        control_refs=tuple(
            sorted(
                {
                    control_ref
                    for mask in value.collider_masks
                    for control_ref in mask.control_refs
                }
            )
        ),
        attachment_refs=tuple(
            sorted(
                {
                    attachment_ref
                    for mask in value.collider_masks
                    for attachment_ref in mask.attachment_refs
                }
            )
        ),
    )


def measure_directed_flow_joint_tick(
    value: DirectedFlowJointTickInput,
) -> DirectedFlowJointTickMeasurements:
    """Project every supplied joint schedule without selecting one."""

    front_by_ref = {front.front_ref: front for front in value.fronts}
    initial_trace = {
        cell.position: set(cell.lineage_refs) for cell in value.existing_trace
    }
    destinations: dict[Position, list[str]] = {}
    for front in value.fronts:
        destination = (
            front.position[0] + front.delta_row,
            front.position[1] + front.delta_column,
        )
        destinations.setdefault(destination, []).append(front.front_ref)
    simultaneous = tuple(
        position
        for position, front_refs in sorted(destinations.items())
        if len(front_refs) > 1
    )

    successors: list[DirectedFlowJointTickSuccessor] = []
    bound_reached = False
    for schedule in value.schedules:
        trace = {
            position: set(refs) for position, refs in sorted(initial_trace.items())
        }
        projected: list[DirectedFlowProjectedFront] = []
        preexisting_contacts: set[Position] = set()
        same_tick_contacts: set[Position] = set()
        written_this_tick: set[Position] = set()
        for front_ref in schedule.ordered_front_refs:
            front = front_by_ref[front_ref]
            destination = (
                front.position[0] + front.delta_row,
                front.position[1] + front.delta_column,
            )
            contacted_preexisting = destination in initial_trace
            contacted_same_tick = destination in written_this_tick
            if contacted_preexisting:
                preexisting_contacts.add(destination)
            if contacted_same_tick:
                same_tick_contacts.add(destination)
            trace.setdefault(destination, set()).add(front.source_ref)
            written_this_tick.add(destination)
            projected.append(
                DirectedFlowProjectedFront(
                    front_ref=front.front_ref,
                    source_ref=front.source_ref,
                    before_position=front.position,
                    after_position=destination,
                    contacted_preexisting_trace=contacted_preexisting,
                    contacted_same_tick_trace=contacted_same_tick,
                )
            )
        if len(trace) > value.maximum_resulting_trace_positions:
            bound_reached = True
            continue
        successors.append(
            DirectedFlowJointTickSuccessor(
                schedule_ref=schedule.schedule_ref,
                projected_fronts=tuple(projected),
                resulting_trace=tuple(
                    DirectedFlowTraceCell(
                        position=position,
                        lineage_refs=tuple(sorted(lineage_refs)),
                    )
                    for position, lineage_refs in sorted(trace.items())
                ),
                simultaneous_arrival_positions=simultaneous,
                preexisting_trace_contact_positions=tuple(
                    sorted(preexisting_contacts)
                ),
                same_tick_trace_contact_positions=tuple(sorted(same_tick_contacts)),
            )
        )

    return DirectedFlowJointTickMeasurements(
        successors=tuple(successors),
        source_ref_count=len({front.source_ref for front in value.fronts}),
        front_count=len(value.fronts),
        schedule_count=len(value.schedules),
        alternative_schedule_count=max(0, len(successors) - 1),
        resulting_trace_bound_reached=bound_reached,
    )


def measure_directed_flow_recovery(
    value: DirectedFlowRecoveryInput,
) -> DirectedFlowRecoveryMeasurements:
    """Compare configuration, transient trace, receptacle and quantities exactly."""

    configuration_before = set(value.configuration_before_release)
    configuration_after = set(value.configuration_after_recovery)
    trace_failed = set(value.trace_after_failed_release)
    trace_after = set(value.trace_after_recovery)
    receptacle_before = set(value.receptacle_before_release)
    receptacle_failed = set(value.receptacle_after_failed_release)
    receptacle_after = set(value.receptacle_after_recovery)
    after_quantities = {
        item.quantity_ref: item.value for item in value.quantities_after_recovery
    }
    return DirectedFlowRecoveryMeasurements(
        retained_configuration_positions=tuple(
            sorted(configuration_before & configuration_after)
        ),
        removed_configuration_positions=tuple(
            sorted(configuration_before - configuration_after)
        ),
        added_configuration_positions=tuple(
            sorted(configuration_after - configuration_before)
        ),
        configuration_exactly_preserved=configuration_before == configuration_after,
        cleared_trace_positions=tuple(sorted(trace_failed - trace_after)),
        retained_trace_positions=tuple(sorted(trace_failed & trace_after)),
        added_trace_positions=tuple(sorted(trace_after - trace_failed)),
        receptacle_exactly_restored=(
            receptacle_after == receptacle_before
            and receptacle_failed != receptacle_before
        ),
        restored_receptacle_positions=tuple(
            sorted((receptacle_before - receptacle_failed) & receptacle_after)
        ),
        quantity_deltas=tuple(
            DirectedFlowQuantityDelta(
                quantity_ref=item.quantity_ref,
                before_value=item.value,
                after_value=after_quantities[item.quantity_ref],
                signed_delta=after_quantities[item.quantity_ref] - item.value,
            )
            for item in value.quantities_before_release
        ),
    )

class FlowObject(FrozenModel):
    object_ref: Ref
    type_ref: Ref
    positions: tuple[Position,...] = Field(min_length=1,max_length=4096)
    control_refs: tuple[Ref,...] = Field(max_length=128)
    attachment_refs: tuple[Ref,...] = Field(max_length=128)
    collider: bool
    evidence_ref: Ref | None
    parent_object_ref: Ref | None = None
    pose_origin: Position | None = None
    pose_basis: tuple[Position,Position] | None = None


class FlowSource(FrozenModel):
    source_ref: Ref
    position: Position
    heading: Position
    parent_object_ref: Ref | None
    active: bool
    activation_evidence_ref: Ref | None
    activation_assumption_ref: Ref | None = None


class FlowState(FrozenModel):
    objects: tuple[FlowObject,...] = Field(max_length=128)
    sources: tuple[FlowSource,...] = Field(max_length=128)
    focus_object_ref: Ref | None
    fronts: tuple[DirectedFlowFront,...] = Field(max_length=4096)
    trace: tuple[DirectedFlowTraceCell,...] = Field(max_length=8192)
    captured_receiver_refs: tuple[Ref,...] = Field(max_length=4096)
    leaks: tuple[tuple[Ref,Position,Ref],...] = Field(max_length=4096)
    remaining_budget: int = Field(ge=0,le=65536)
    input_tick: int = Field(ge=0)
    simulation_tick: int = Field(ge=0)
    restore_epoch: int = Field(ge=0)
    level_scope_ref: Ref
    phase: Literal['QUIESCENT','RUNNING','STOPPED']
    @model_validator(mode='after')
    def distinct_identity(self):
        for refs in (tuple(o.object_ref for o in self.objects),tuple(s.source_ref for s in self.sources),tuple(f.front_ref for f in self.fronts)):
            if len(set(refs))!=len(refs):raise ValueError('each actual flow owner occurs once')
        if len({t.position for t in self.trace})!=len(self.trace):raise ValueError('one immutable trace row per position')
        if any(f.source_ref not in {s.source_ref for s in self.sources} for f in self.fronts):raise ValueError('front lineage belongs to a supplied current source')
        if any(s.parent_object_ref is not None and s.parent_object_ref not in {o.object_ref for o in self.objects} for s in self.sources):raise ValueError('carried sources retain their actual parent object')
        by_ref={o.object_ref:o for o in self.objects}
        for obj in self.objects:
            seen={obj.object_ref};parent=obj.parent_object_ref
            while parent is not None:
                if parent in seen or parent not in by_ref:raise ValueError('current acyclic cap/object attachment ownership')
                seen.add(parent);parent=by_ref[parent].parent_object_ref
        return self


class FlowCommand(FrozenModel):
    input_ref: Ref
    operation_kind: Literal['CONFIGURE','RELEASE']
    configuration_kind: Literal['SELECT','MOVE','POSE'] | None
    object_ref: Ref | None
    control_ref: Ref | None
    delta: Position
    action_ref: Ref
    payload: FrozenMap
    cost: int = Field(ge=0,le=65536)
    cost_evidence_ref: Ref | None


class FlowControlEdge(FrozenModel):
    input_ref: Ref
    object_ref: Ref
    control_ref: Ref
    kind: Literal['SELECT','MOVE','POSE']
    delta: Position
    requires_selected: bool
    evidence_ref: Ref | None
    permitted_anchor_positions: tuple[Position,...] = Field(default=(),max_length=8192)
    before_objects: tuple[FlowObject,...] = Field(default=(),max_length=128)
    after_objects: tuple[FlowObject,...] = Field(default=(),max_length=128)
    before_sources: tuple[FlowSource,...] = Field(default=(),max_length=128)
    after_sources: tuple[FlowSource,...] = Field(default=(),max_length=128)


class FlowAnchor(FrozenModel):
    object_ref: Ref
    origin: Position
    basis: tuple[Position,Position]


class FlowMedium(FrozenModel):
    position: Position
    admissible: bool | None
    evidence_ref: Ref | None


class FlowReceiver(FrozenModel):
    receiver_ref: Ref
    cavity_positions: tuple[Position,...] = Field(min_length=1,max_length=4096)
    base_positions: tuple[Position,...] = Field(min_length=1,max_length=4096)
    flank_positions: tuple[Position,...] = Field(min_length=1,max_length=4096)
    source_owner_refs: tuple[Ref,...] = Field(max_length=128)
    ownership_evidence_ref: Ref | None
    ownership_assumption_ref: Ref | None = None
    anchor: FlowAnchor | None = None


class FlowRule(FrozenModel):
    rule_ref: Ref
    contact_position: Position
    incoming_heading: Position
    source_ref: Ref | None
    collider_ref: Ref | None
    contact_kind: Literal['EMPTY','COLLIDER','TRACE','CLIPPING','HAZARD','CAVITY']
    effect_kind: Literal['ADVANCE','SPLIT','TURN','CAPTURE','NONCAPTURE_COLLISION','SAFE_EXTINCTION','LEAK','UNKNOWN']
    # Each exact child has (location delta row/column, heading row/column).
    successor_offsets: tuple[tuple[int,int,int,int],...] = Field(max_length=16)
    receiver_ref: Ref | None
    evidence_ref: Ref | None
    assumption_ref: Ref | None = None
    receiver_fill_count: int | None = Field(default=None,ge=0,le=4096)
    successor_collider_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    same_source_trace_reentry_allowed: bool | None = None
    anchor: FlowAnchor | None = None


class FlowSchedule(FrozenModel):
    schedule_ref: Ref
    source_order: tuple[Ref,...] = Field(max_length=128)
    within_source_order: Literal['FIFO','LIFO','UNKNOWN']
    evidence_ref: Ref | None
    assumption_ref: Ref | None = None


class FlowModel(FrozenModel):
    model_ref: Ref
    medium: tuple[FlowMedium,...] = Field(max_length=8192)
    receivers: tuple[FlowReceiver,...] = Field(max_length=128)
    rules: tuple[FlowRule,...] = Field(max_length=8192)
    schedules: tuple[FlowSchedule,...] = Field(max_length=128)
    control_edges: tuple[FlowControlEdge,...] = Field(max_length=256)
    configuration_overlap_allowed: bool | None
    configuration_collision_evidence_ref: Ref | None
    configuration_carry_evidence_ref: Ref | None = None
    trace_policy: Literal['ORDERED_WRITES','SIMULTANEOUS_OLD_TRACE','UNKNOWN']
    trace_evidence_ref: Ref | None
    trace_assumption_ref: Ref | None = None
    trigger_input_ref: Ref
    trigger_evidence_ref: Ref | None
    trigger_assumption_ref: Ref | None = None
    release_clears_trace: bool | None = None
    release_trace_evidence_ref: Ref | None = None
    blocked_front_without_rule: Literal['UNKNOWN','SAFE_EXTINCTION']
    blocked_front_evidence_ref: Ref | None
    stop_on_leak: bool | None
    leak_evidence_ref: Ref | None
    hazard_positions: tuple[Position,...] = Field(max_length=8192)
    clipping_positions: tuple[Position,...] = Field(max_length=8192)
    contact_precedence: tuple[Literal['HAZARD','CLIPPING','TRACE','CAVITY','COLLIDER'],...] = Field(default=(),max_length=5)
    @model_validator(mode='after')
    def distinct_geometry(self):
        if len({c.position for c in self.medium})!=len(self.medium):raise ValueError('one medium law per measured position')
        if len({r.receiver_ref for r in self.receivers})!=len(self.receivers):raise ValueError('distinct supplied receivers')
        if len({s.schedule_ref for s in self.schedules})!=len(self.schedules):raise ValueError('distinct retained schedules')
        if len(set(self.contact_precedence))!=len(self.contact_precedence):raise ValueError('explicit contact precedence contains each category once')
        for schedule in self.schedules:
            if len(set(schedule.source_order))!=len(schedule.source_order):raise ValueError('each source is scheduled once')
        return self


class FlowRoutingCandidate(FrozenModel):
    candidate_ref: Ref
    configuration: FlowState
    port_connections: tuple[tuple[Ref,Ref],...] = Field(max_length=256)
    port_evidence_ref: Ref | None


class FlowObservation(FrozenModel):
    observation_ref: Ref
    before: FlowState
    after: FlowState
    command: FlowCommand
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool


class FlowResumeBranch(FrozenModel):
    state: FlowState
    events: tuple[FrozenMap,...] = Field(max_length=65536)


class FlowContinuation(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.directed_flow_continuation.v1'
    input_digest: Ref
    phase: Literal['RELEASE','INVERSE','FIT','UNSTARTED']
    branches: tuple[FlowResumeBranch,...] = Field(default=(),max_length=4096)
    expanded: tuple[FlowResumeBranch,...] = Field(default=(),max_length=4096)
    tick_index: int = Field(default=0,ge=0,le=4096)
    branch_index: int = Field(default=0,ge=0,le=4096)
    accounted_evaluations: int = Field(default=0,ge=0)
    candidate_index: int = Field(default=0,ge=0,le=4096)
    model_index: int = Field(default=0,ge=0,le=128)
    observation_index: int = Field(default=0,ge=0,le=256)
    compared_observations: int = Field(default=0,ge=0,le=256)
    completed_rows: tuple[FrozenMap,...] = Field(default=(),max_length=4096)
    pending_release: FlowContinuation | None = None
    retained_prerequisite_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    current_model_prerequisite_refs: tuple[Ref,...] = Field(default=(),max_length=256)
    @model_validator(mode='after')
    def pending_atomic_release(self):
        if self.pending_release is not None and (self.phase not in ('INVERSE','FIT') or self.pending_release.phase not in ('RELEASE','UNSTARTED') or self.pending_release.pending_release is not None):
            raise ValueError('one atomic pending release under its actual domain caller')
        if self.branch_index>len(self.branches):raise ValueError('resume branch index lies in retained pending domain')
        return self


class DirectedRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.directed_accretive_flow_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_ticks: int = Field(ge=0,le=4096)
    maximum_trace_positions: int = Field(ge=1,le=8192)
    state: FlowState | None = None
    model: FlowModel | None = None
    command: FlowCommand | None = None
    front_ref: Ref | None = None
    collider_input: DirectedFlowColliderUnionInput | None = None
    recovery_input: DirectedFlowRecoveryInput | None = None
    recovery_evidence_ref: Ref | None = None
    recovery_budget_before: int | None = Field(default=None,ge=0)
    recovery_budget_after: int | None = Field(default=None,ge=0)
    recovery_before_state: FlowState | None = None
    recovery_after_state: FlowState | None = None
    candidates: tuple[FlowRoutingCandidate,...] = Field(default=(),max_length=4096)
    models: tuple[FlowModel,...] = Field(default=(),max_length=128)
    observations: tuple[FlowObservation,...] = Field(default=(),max_length=256)
    required_capture_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    forbidden_leak: bool | None = None
    source_identity_ref: Ref | None = None
    resume: FlowContinuation | None = None


DIRECTED_OPERATION_MODES={
    'configure_successor':('STEP_INTERNAL',),'advance':('STEP_INTERNAL',),
    'split':('STEP_INTERNAL',),'composite_relief':('MEASURE',),
    'turn':('STEP_INTERNAL',),'capture':('PRECONDITION',),
    'multi_source_tick':('STEP_INTERNAL',),'successor':('STEP',),
    'inverse_routing':('INVERSE_DOMAIN',),'recovery':('COMPARE',),'flow_fit':('FIT',),
}


def _flow_input_digest(request):
    data=request.model_dump(mode='json',exclude={'resume','maximum_evaluations','maximum_states','maximum_ticks','maximum_trace_positions'})
    return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()


def _flow_continuation(request,phase,**fields):
    if 'completed_rows' in fields:fields['completed_rows']=tuple(immutable_json_data(row) for row in fields['completed_rows'])
    return FlowContinuation(input_digest=_flow_input_digest(request),phase=phase,**fields)


def _resume_branches(branches):
    return tuple(FlowResumeBranch(state=state,events=tuple(immutable_json_data(event) for event in events)) for state,events in branches)


def _resume_frontier(request,cut,continuation):
    return {**cut,'continuation':continuation,'resumption_source_identity_ref':request.source_identity_ref,
            'source_identity_required_on_resume':True,'atomic_unsealed_tick_recomputed':True,'completed_ticks_replayed':False}


def _flow_geometry_work(state,model):
    geometry=sum(len(o.positions) for o in state.objects)+len(model.medium)+len(model.rules)+sum(
        len(r.cavity_positions)+len(r.base_positions)+len(r.flank_positions) for r in model.receivers)
    capture_refs=frozenset(rule.receiver_ref for rule in model.rules if rule.effect_kind=='CAPTURE')
    capture_sections=4*sum(len(r.cavity_positions)+len(r.base_positions)+len(r.flank_positions)
        for r in model.receivers if r.receiver_ref in capture_refs)
    return 1+geometry+max(1,len(model.schedules))*(3*len(state.trace)+len(state.fronts)*(4+geometry+capture_sections))


def _flow_masks(state):
    return tuple(DirectedFlowColliderMask(collider_ref=o.object_ref,positions=o.positions,control_refs=o.control_refs,attachment_refs=o.attachment_refs) for o in state.objects if o.collider)


def _declared_flow_support(evidence,assumption,permitted):
    return evidence is not None or assumption is not None and assumption in permitted


def _configure(state,model,command,maximum):
    work=1+len(model.control_edges)+sum(len(o.positions) for o in state.objects)+len(state.sources)+len(state.objects)**2
    if work>maximum:return state,(),(),0,{'phase':'configuration_geometry'}
    if state.phase=='RUNNING':return state,(),('current_configuration_phase_without_running_fronts',),work,{}
    edges=tuple(e for e in model.control_edges if (e.input_ref,e.object_ref,e.control_ref,e.kind,e.delta)==
                (command.input_ref,command.object_ref,command.control_ref,command.configuration_kind,command.delta))
    obj=next((o for o in state.objects if o.object_ref==command.object_ref),None)
    if obj is None or command.control_ref not in obj.control_refs or len(edges)!=1 or edges[0].evidence_ref is None:
        return state,(),('exact_current_configuration_control_edge',),work,{}
    if edges[0].requires_selected and state.focus_object_ref!=obj.object_ref:return state,(),('actual_selected_configuration_object',),work,{}
    if command.configuration_kind=='SELECT':
        return state.model_copy(update={'focus_object_ref':obj.object_ref}),({'kind':'SELECTION_CHANGE','object_ref':obj.object_ref},),(),work,{}
    if command.configuration_kind=='POSE':
        edge=edges[0]
        extra_work=len(state.objects)*sum(len(o.positions) for o in edge.after_objects)+sum(len(o.positions) for o in edge.before_objects)+len(edge.before_sources)+len(edge.after_sources)
        if work+extra_work>maximum:return state,(),(),0,{'phase':'complete_configuration_pose_geometry','required_work':work+extra_work}
        work+=extra_work
        if not edge.before_objects or not edge.after_objects:return state,(),('complete_supplied_configuration_pose_edge',),work,{}
        before={o.object_ref:o for o in edge.before_objects};after={o.object_ref:o for o in edge.after_objects}
        old_sources={s.source_ref:s for s in edge.before_sources};new_sources={s.source_ref:s for s in edge.after_sources}
        if set(before)!=set(after) or set(old_sources)!=set(new_sources) or any(next((o for o in state.objects if o.object_ref==ref),None)!=part for ref,part in sorted(before.items())) or any(next((s for s in state.sources if s.source_ref==ref),None)!=part for ref,part in sorted(old_sources.items())):
            return state,(),('exact_current_pose_edge_before_and_identity_domain',),work,{}
        if any((before[ref].type_ref,before[ref].control_refs,before[ref].attachment_refs,before[ref].parent_object_ref)!=(part.type_ref,part.control_refs,part.attachment_refs,part.parent_object_ref) for ref,part in sorted(after.items())):
            return state,(),('pose_change_preserves_type_and_attachment_ownership',),work,{}
        objects=tuple(after.get(o.object_ref,o) for o in state.objects);sources=tuple(new_sources.get(s.source_ref,s) for s in state.sources)
        required={o.object_ref for o in state.objects if o.parent_object_ref in before}|{s.source_ref for s in state.sources if s.parent_object_ref in before}
        if not required.issubset(set(after)|set(new_sources)):return state,(),('whole_pose_edge_includes_carried_caps_and_sources',),work,{}
        overlap=any(set(a.positions)&set(b.positions) for i,a in enumerate(objects) for b in objects[i+1:] if a.object_ref in after or b.object_ref in after)
        if model.configuration_collision_evidence_ref is None or model.configuration_overlap_allowed is None:return state,(),('current_configuration_collision_model',),work,{}
        if overlap and not model.configuration_overlap_allowed:return state,({'kind':'POSE_REFUSAL'},),(),work,{}
        return state.model_copy(update={'objects':objects,'sources':sources}),({'kind':'CONFIGURATION_POSE_EDGE','object_ref':obj.object_ref,'propagation_started':False},),(),work,{}
    if model.configuration_overlap_allowed is None or model.configuration_collision_evidence_ref is None:
        return state,(),('current_configuration_collision_model',),work,{}
    positions=_translated_flow(obj.positions,command.delta)
    if min(positions) not in edges[0].permitted_anchor_positions:return state,(),('requested_pose_in_supplied_finite_control_graph',),work,{}
    moved={obj.object_ref}
    for _ in state.objects:
        children={o.object_ref for o in state.objects if o.parent_object_ref in moved}
        if children.issubset(moved):break
        moved.update(children)
    if (len(moved)>1 or any(s.parent_object_ref in moved for s in state.sources)) and model.configuration_carry_evidence_ref is None:
        return state,(),('current_parent_cap_and_source_co_motion_law',),work,{}
    translated={point for o in state.objects if o.object_ref in moved for point in _translated_flow(o.positions,command.delta)}
    overlaps=tuple(o.object_ref for o in state.objects if o.object_ref not in moved and translated&set(o.positions))
    if overlaps and not model.configuration_overlap_allowed:return state,({'kind':'POSE_REFUSAL','blocking_object_refs':overlaps},),(),work,{}
    objects=tuple(o.model_copy(update={'positions':_translated_flow(o.positions,command.delta),
        'pose_origin':None if o.pose_origin is None else (o.pose_origin[0]+command.delta[0],o.pose_origin[1]+command.delta[1])}) if o.object_ref in moved else o for o in state.objects)
    sources=tuple(s.model_copy(update={'position':(s.position[0]+command.delta[0],s.position[1]+command.delta[1])}) if s.parent_object_ref in moved else s for s in state.sources)
    return state.model_copy(update={'objects':objects,'sources':sources}),({'kind':'CONFIGURATION_TRANSLATION','object_ref':obj.object_ref,
        'carried_source_refs':tuple(s.source_ref for s in sources if s.parent_object_ref in moved),'carried_object_refs':tuple(sorted(moved)),
        'attachment_refs':obj.attachment_refs,'propagation_started':False},),(),work,{}


def _translated_flow(positions,delta):return tuple((r+delta[0],c+delta[1]) for r,c in positions)


def _anchor_matrix(state,anchor):
    if anchor is None:return ((1,0),(0,1)),(0,0),(0,0)
    obj=next((o for o in state.objects if o.object_ref==anchor.object_ref),None)
    if obj is None or obj.pose_origin is None or obj.pose_basis is None:return None
    a,b=anchor.basis;c,d=obj.pose_basis;det=a[0]*b[1]-a[1]*b[0]
    if abs(det)!=1 or abs(c[0]*d[1]-c[1]*d[0])!=1 or any(sum(x*x for x in row)!=1 for basis in (anchor.basis,obj.pose_basis) for row in basis):return None
    inverse=((b[1]//det,-a[1]//det),(-b[0]//det,a[0]//det))
    matrix=tuple(tuple(row[0]*inverse[0][i]+row[1]*inverse[1][i] for i in range(2)) for row in (c,d))
    return matrix,anchor.origin,obj.pose_origin


def _anchor_vector(matrix,point):return tuple(row[0]*point[0]+row[1]*point[1] for row in matrix)


def _anchor_point(frame,point):
    matrix,old,new=frame;delta=_anchor_vector(matrix,(point[0]-old[0],point[1]-old[1]))
    return (new[0]+delta[0],new[1]+delta[1])


def _flow_context(state,model,permitted=()):
    colliders=measure_directed_flow_collider_union(DirectedFlowColliderUnionInput(collider_masks=_flow_masks(state)))
    rules={};unresolved=[]
    for rule in model.rules:
        frame=_anchor_matrix(state,rule.anchor)
        if frame is None:unresolved.append(rule.rule_ref);continue
        transformed=rule.model_copy(update={'contact_position':_anchor_point(frame,rule.contact_position),'incoming_heading':_anchor_vector(frame[0],rule.incoming_heading),
            'successor_offsets':tuple(_anchor_vector(frame[0],(dr,dc))+_anchor_vector(frame[0],(hr,hc)) for dr,dc,hr,hc in rule.successor_offsets)}) if rule.anchor is not None else rule
        rules.setdefault((transformed.contact_position,transformed.incoming_heading,transformed.contact_kind),[]).append(transformed)
    receivers={}
    for receiver in model.receivers:
        frame=_anchor_matrix(state,receiver.anchor)
        if frame is None:unresolved.append(receiver.receiver_ref);continue
        receivers[receiver.receiver_ref]=receiver.model_copy(update={field:tuple(_anchor_point(frame,point) for point in getattr(receiver,field)) for field in ('cavity_positions','base_positions','flank_positions')}) if receiver.anchor is not None else receiver
    return (colliders,{c.position:c for c in model.medium},dict(colliders.owner_refs_by_position),rules,
            receivers,{point for ref in sorted(receivers) for point in receivers[ref].cavity_positions},frozenset(permitted),
            frozenset(model.hazard_positions),frozenset(model.clipping_positions),tuple(unresolved))


def _receiver_incidence_geometry(receiver, destination, heading, collider_positions):
    """Exact cardinal aperture section; it does not infer a capture law."""
    cavity=frozenset(receiver.cavity_positions);base=frozenset(receiver.base_positions);flanks=frozenset(receiver.flank_positions)
    dr,dc=heading
    if abs(dr)+abs(dc)!=1 or destination not in cavity:
        return FrozenMap({'aperture_section_matches':False,'unit_incidence_and_cavity':False})
    # Finite membership walks retain arbitrary cavity width/depth and pose.
    def boundary(direction):
        point=destination;visited=0
        while point in cavity:
            point=(point[0]+direction[0],point[1]+direction[1]);visited+=1
            if visited>len(cavity):
                raise ValueError('finite cavity membership ray exceeded supplied domain')
        return point,visited
    forward,forward_steps=boundary((dr,dc))
    backward,backward_steps=boundary((-dr,-dc))
    left,left_steps=boundary((-dc,dr))
    right,right_steps=boundary((dc,-dr))
    base_ahead=forward in base
    open_behind=backward not in collider_positions
    two_flanks=left in flanks and right in flanks
    disjoint=cavity.isdisjoint(base|flanks)
    return FrozenMap({'aperture_section_matches':base_ahead and open_behind and two_flanks and disjoint,
        'unit_incidence_and_cavity':True,'base_boundary_ahead':forward,'aperture_boundary_behind':backward,
        'left_flank_boundary':left,'right_flank_boundary':right,'base_ahead':base_ahead,
        'open_aperture_behind':open_behind,'both_lateral_boundaries_are_flanks':two_flanks,
        'cavity_disjoint_from_boundary':disjoint,
        'membership_visits':forward_steps+backward_steps+left_steps+right_steps})


def _flow_front_effect(state,model,front,destination,visible_trace,context,captured=None):
    colliders,medium,owners,rule_index,receivers,cavity_positions,permitted,hazards,clipping,unresolved=context
    if unresolved:return (),(),tuple('current_incidence_or_receiver_pose:'+ref for ref in unresolved)
    captured=state.captured_receiver_refs if captured is None else captured
    contacts=tuple(kind for kind,present in (('HAZARD',destination in hazards),('CLIPPING',destination in clipping),('TRACE',destination in visible_trace),('CAVITY',destination in cavity_positions),('COLLIDER',destination in owners)) if present)
    if len(contacts)>1:
        if not set(contacts).issubset(set(model.contact_precedence)):return (),(),('explicit_policy_for_overlapping_contact_categories',)
        contact=next(kind for kind in model.contact_precedence if kind in contacts)
    elif contacts:contact=contacts[0]
    elif destination in medium and medium[destination].admissible is True and medium[destination].evidence_ref is not None:contact='EMPTY'
    else:return (),(),('current_admissible_medium_or_explicit_boundary',)
    rows=tuple(r for r in rule_index.get((destination,(front.delta_row,front.delta_column),contact),()) if (r.source_ref is None or r.source_ref==front.source_ref) and
        (r.collider_ref is None or r.collider_ref in owners.get(destination,())) and
        (r.receiver_fill_count is None or r.receiver_ref is not None and captured.count(r.receiver_ref)==r.receiver_fill_count))
    if not rows:
        if contact=='EMPTY':return ((1,0,0,front.delta_row,front.delta_column),),({'kind':'ADVANCE','front_ref':front.front_ref,'destination':destination},),()
        if contact=='COLLIDER' and model.blocked_front_without_rule=='SAFE_EXTINCTION' and model.blocked_front_evidence_ref is not None:
            return (),({'kind':'SAFE_EXTINCTION','front_ref':front.front_ref,'destination':destination},),()
        return (),(),('current_'+contact.lower()+'_incidence_rule',)
    if len(rows)!=1:return (),(),('unique_supplied_incidence_rule_or_retained_model_alternatives',)
    rule=rows[0]
    if rule.effect_kind=='UNKNOWN' or not _declared_flow_support(rule.evidence_ref,rule.assumption_ref,permitted):return (),(),('current_supported_or_caller_owned_conditional_flow_rule',)
    capture_geometry=None
    if rule.effect_kind=='CAPTURE':
        receiver=receivers.get(rule.receiver_ref)
        if rule.receiver_ref in captured and rule.receiver_fill_count is None:return (),(),('explicit_incidence_for_already_captured_receiver',)
        if receiver is None or destination not in receiver.cavity_positions or front.source_ref not in receiver.source_owner_refs or (
            not _declared_flow_support(receiver.ownership_evidence_ref,receiver.ownership_assumption_ref,permitted)) or not set(receiver.base_positions+receiver.flank_positions).issubset(set(colliders.union_positions)):
            return (),(),('incoming_frame_cavity_base_flank_and_source_ownership',)
        capture_geometry=_receiver_incidence_geometry(receiver,destination,(front.delta_row,front.delta_column),owners)
        if not capture_geometry['aperture_section_matches']:
            return (),(),('oriented_receiver_aperture_base_and_flank_geometry',)
    children=[]
    if rule.effect_kind in ('ADVANCE','SPLIT','TURN'):
        if not rule.successor_offsets:return (),(),('supplied_incidence_successor_locations_and_headings',)
        for dr,dc,hr,hc in rule.successor_offsets:
            point=(front.position[0]+dr,front.position[1]+dc)
            if abs(hr)+abs(hc)!=1:return (),(),('unit_declared_successor_heading',)
            if rule.effect_kind=='SPLIT' and (contact!='COLLIDER' or abs(dr)+abs(dc)!=1 or dr*front.delta_row+dc*front.delta_column!=0):
                return (),(),('blocked_front_same_frame_lateral_split',)
            cell=medium.get(point)
            permitted_collider_entry=point in owners and set(owners[point]).issubset(set(rule.successor_collider_refs))
            permitted_trace_reentry=point in visible_trace and rule.same_source_trace_reentry_allowed is True and front.source_ref in visible_trace.get(point,())
            if (point in owners and not permitted_collider_entry or point in visible_trace and not permitted_trace_reentry or
                cell is None or cell.evidence_ref is None or cell.admissible is not True and not permitted_collider_entry):
                return (),(),('current_admissible_child_location',)
            children.append((0,dr,dc,hr,hc))
    return tuple(children),({'kind':rule.effect_kind,'front_ref':front.front_ref,'source_ref':front.source_ref,'destination':destination,
        'receiver_ref':rule.receiver_ref,'rule_ref':rule.rule_ref,'contact_kind':contact,
        'capture_incidence_geometry':capture_geometry},),()


def _flow_tick(state,model,request,remaining,context=None):
    if not state.fronts:return ((state,({'kind':'EMPTY_CURRENT_FRONT_DOMAIN'},),'NONE'),),(),0,{}
    permitted=request.scope.assumption_refs+request.scope.retained_alternative_refs
    work=_flow_geometry_work(state,model)
    if work>remaining:return (),(),0,{'phase':'joint_flow_geometry'}
    if model.trace_policy=='UNKNOWN' or not _declared_flow_support(model.trace_evidence_ref,model.trace_assumption_ref,permitted):
        return (),('current_joint_trace_update_policy',),work,{}
    schedules=[]
    active_sources={f.source_ref for f in state.fronts}
    for row in model.schedules:
        if row.within_source_order=='UNKNOWN' or not _declared_flow_support(row.evidence_ref,row.assumption_ref,permitted) or not active_sources.issubset(set(row.source_order)):
            return (),('complete_supported_joint_source_and_front_schedule',),work,{}
        refs=tuple(f.front_ref for source in row.source_order for f in (state.fronts if row.within_source_order=='FIFO' else tuple(reversed(state.fronts))) if f.source_ref==source)
        schedules.append(DirectedFlowTickSchedule(schedule_ref=row.schedule_ref,ordered_front_refs=refs))
    if not schedules:return (),('retained_joint_event_schedules',),work,{}
    projection=measure_directed_flow_joint_tick(DirectedFlowJointTickInput(fronts=state.fronts,existing_trace=state.trace,schedules=tuple(schedules),
        maximum_resulting_trace_positions=request.maximum_trace_positions))
    if projection.resulting_trace_bound_reached:return (),(),work,{'phase':'native_geometric_projection_trace_bound'}
    context=_flow_context(state,model,permitted) if context is None else context
    responses=[];debt=[];cut={}
    for response_index,projected in enumerate(projection.successors):
        if len(responses)>=request.maximum_states:cut={'phase':'joint_flow_responses','next_schedule_index':response_index};break
        trace={c.position:set(c.lineage_refs) for c in state.trace};initial_trace={c.position:frozenset(c.lineage_refs) for c in state.trace} if model.trace_policy=='SIMULTANEOUS_OLD_TRACE' else None;fronts=[];events=[];captures=list(state.captured_receiver_refs);leaks=list(state.leaks);missing=[]
        original_lineage={c.position:c.lineage_refs for c in state.trace};actual_tick_writes={}
        by_ref={f.front_ref:f for f in state.fronts}
        for effect in projected.projected_fronts:
            front=by_ref[effect.front_ref];visible=trace if model.trace_policy=='ORDERED_WRITES' else initial_trace
            children,emitted,unknown=_flow_front_effect(state,model,front,effect.after_position,visible,context,captures)
            if unknown:missing.extend(unknown);break
            for event in emitted:
                # Actual surviving child writes, not gross projected destinations.
                event_facts=dict(event)
                event_facts['preexisting_trace_lineage_at_destination']=original_lineage.get(effect.after_position,())
                event_facts['same_tick_written_lineage_at_destination']=tuple(sorted(actual_tick_writes.get(effect.after_position,())))
                event_facts['declared_trace_policy']=model.trace_policy
                event_facts['front_before_position']=front.position
                event_facts['source_ref']=front.source_ref
                event_facts['incoming_heading_rc']=(front.delta_row,front.delta_column)
                event_facts['actual_child_fronts']=()
                events.append(event_facts)
            for event in emitted:
                if event['kind']=='CAPTURE':captures.append(event['receiver_ref'])
                elif event['kind']=='LEAK':leaks.append((front.source_ref,effect.after_position,event['rule_ref']))
            actual_children=[]
            for child_index,(direct,dr,dc,hr,hc) in enumerate(children):
                point=effect.after_position if direct else (front.position[0]+dr,front.position[1]+dc)
                child=DirectedFlowFront(front_ref=front.front_ref if len(children)==1 else front.front_ref+':'+str(state.simulation_tick+1)+':'+str(child_index),
                    source_ref=front.source_ref,position=point,delta_row=hr,delta_column=hc)
                fronts.append(child)
                actual_children.append(FrozenMap({'front_ref':child.front_ref,'source_ref':child.source_ref,
                    'position':child.position,'heading_rc':(child.delta_row,child.delta_column)}))
                trace.setdefault(point,set()).add(front.source_ref)
                actual_tick_writes.setdefault(point,set()).add(front.source_ref)
            for event_facts in events[-len(emitted):] if emitted else ():
                event_facts['actual_child_fronts']=tuple(actual_children)
            if len(trace)>request.maximum_trace_positions or len(fronts)>request.maximum_states:
                cut={'phase':'joint_flow_trace_or_front_domain','schedule_index':response_index,'front_ref':front.front_ref};break
        if missing:debt.extend(missing);continue
        if cut:break
        if len(leaks)>len(state.leaks):
            if model.stop_on_leak is None or model.leak_evidence_ref is None:debt.append('current_leak_termination_law');continue
            if model.stop_on_leak:
                for cancelled in fronts:
                    events.append({'kind':'STOP_ON_LEAK_FRONT_CLEARED','front_ref':cancelled.front_ref,
                        'source_ref':cancelled.source_ref,'front_before_position':cancelled.position,
                        'incoming_heading_rc':(cancelled.delta_row,cancelled.delta_column),'actual_child_fronts':()})
                fronts=[]
        after=state.model_copy(update={'fronts':tuple(fronts),'trace':tuple(DirectedFlowTraceCell(position=p,lineage_refs=tuple(sorted(refs))) for p,refs in sorted(trace.items())),
            'captured_receiver_refs':tuple(captures),'leaks':tuple(leaks),'simulation_tick':state.simulation_tick+1,'phase':'RUNNING' if fronts else 'STOPPED'})
        responses.append((after,tuple(events),projected.schedule_ref))
    return tuple(responses),tuple(dict.fromkeys(debt)),work,cut


def _seed_release(state,model,command,permitted):
    if command.input_ref!=model.trigger_input_ref or not _declared_flow_support(model.trigger_evidence_ref,model.trigger_assumption_ref,permitted):
        return state,('current_evidenced_or_explicit_hypothetical_release_trigger',)
    if state.phase=='RUNNING':return state,('release_not_duplicated_into_current_running_flow',)
    if state.trace and (model.release_clears_trace is None or model.release_trace_evidence_ref is None):return state,('current_release_policy_for_existing_dynamic_trace',)
    if model.release_clears_trace:state=state.model_copy(update={'trace':()})
    fronts=[]
    for source in state.sources:
        if not source.active:continue
        if not _declared_flow_support(source.activation_evidence_ref,source.activation_assumption_ref,permitted) or abs(source.heading[0])+abs(source.heading[1])!=1:
            return state,('sources_initialized_from_current_evidence_or_explicit_hypotheses',)
        fronts.append(DirectedFlowFront(front_ref=source.source_ref+':release:'+str(state.input_tick),source_ref=source.source_ref,position=source.position,
            delta_row=source.heading[0],delta_column=source.heading[1]))
    return state.model_copy(update={'fronts':tuple(fronts),'phase':'RUNNING' if fronts else 'STOPPED'}),()


def _external_flow(state,model,command,request,remaining,continuation=None):
    digest=_flow_input_digest(request)
    if continuation is not None and continuation.phase=='UNSTARTED':continuation=None
    if continuation is not None:
        if continuation.phase!='RELEASE' or continuation.input_digest!=digest:
            return (),('current_identity_and_revision_qualified_release_continuation',),0,{}
        branches=[(b.state,tuple(b.events)) for b in continuation.branches]
        expanded=[(b.state,tuple(b.events)) for b in continuation.expanded]
        count=continuation.accounted_evaluations;start_tick=continuation.tick_index;start_branch=continuation.branch_index
        if count>remaining:return tuple(branches),(),count,_resume_frontier(request,{'phase':'resumed_release_budget'},continuation)
    else:
        if command.cost_evidence_ref is None or command.cost>state.remaining_budget:return (),('current_funded_external_input_cost',),0,{}
        state=state.model_copy(update={'remaining_budget':state.remaining_budget-command.cost,'input_tick':state.input_tick+1})
        debit=({'kind':'EXTERNAL_INPUT_DEBIT','input_ref':command.input_ref,'cost':command.cost},)
        if command.operation_kind=='CONFIGURE':
            after,events,debt,count,cut=_configure(state,model,command,remaining)
            token=_flow_continuation(request,'UNSTARTED') if cut else None
            return ((after,debit+events),) if not debt and not cut else (),debt,count,_resume_frontier(request,cut,token) if cut else {}
        seed_work=1+len(state.sources)+len(state.fronts)+len(state.trace)
        if seed_work>remaining or sum(1 for source in state.sources if source.active)>request.maximum_states:
            return (),(),0,_resume_frontier(request,{'phase':'release_source_initialization','required_work':seed_work},_flow_continuation(request,'UNSTARTED'))
        permitted=request.scope.assumption_refs+request.scope.retained_alternative_refs
        state,debt=_seed_release(state,model,command,permitted)
        if debt:return (),debt,seed_work,{}
        if state.phase!='RUNNING':return ((state,debit+({'kind':'NO_ACTIVE_PROPAGATION_SOURCES'},)),),(),seed_work,{}
        branches=[(state,debit)];expanded=[];count=seed_work;start_tick=0;start_branch=0
    permitted=request.scope.assumption_refs+request.scope.retained_alternative_refs
    context=None;missing=[]
    for tick in range(start_tick,request.maximum_ticks):
        if tick!=start_tick:expanded=[];start_branch=0
        for branch_index in range(start_branch,len(branches)):
            current,events=branches[branch_index]
            if current.phase!='RUNNING':expanded.append((current,events));continue
            work=_flow_geometry_work(current,model)
            if work>remaining-count:
                token=_flow_continuation(request,'RELEASE',branches=_resume_branches(branches),expanded=_resume_branches(expanded),
                    tick_index=tick,branch_index=branch_index,accounted_evaluations=count)
                return tuple(branches),(),count,_resume_frontier(request,{'phase':'release_geometry_context','release_tick':tick},token)
            if context is None:context=_flow_context(current,model,permitted)
            responses,debt,charged,bound=_flow_tick(current,model,request,remaining-count,context)
            if debt:missing.extend(debt);break
            # This unsealed tick is atomic. Its completed sibling branches remain frozen.
            if bound or len(expanded)+len(responses)>request.maximum_states:
                count+=charged
                token=_flow_continuation(request,'RELEASE',branches=_resume_branches(branches),expanded=_resume_branches(expanded),
                    tick_index=tick,branch_index=branch_index,accounted_evaluations=count)
                return tuple(branches),(),count,_resume_frontier(request,{'release_tick':tick,**bound,'phase':bound.get('phase','retained_release_response_domain')},token)
            count+=charged
            expanded.extend((after,events+({'kind':'FLOW_TICK','schedule_ref':schedule_ref,'simulation_tick':after.simulation_tick},)+trace) for after,trace,schedule_ref in responses)
        if missing:return tuple(branches),tuple(dict.fromkeys(missing)),count,{}
        branches=expanded;expanded=[]
        if not any(s.phase=='RUNNING' for s,_ in branches):return tuple(branches),(),count,{}
    if any(s.phase=='RUNNING' for s,_ in branches):
        token=_flow_continuation(request,'RELEASE',branches=_resume_branches(branches),tick_index=request.maximum_ticks,accounted_evaluations=count)
        return tuple(branches),(),count,_resume_frontier(request,{'phase':'release_tick_bound','maximum_ticks':request.maximum_ticks},token)
    return tuple(branches),(),count,{}


def _relief(request):
    work=9*sum(len(m.positions) for m in request.collider_input.collider_masks)+len(request.model.medium)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'union_collider_relief','required_work':work})
    union=measure_directed_flow_collider_union(request.collider_input);positions=set(union.union_positions)
    medium={c.position:c for c in request.model.medium}
    exterior=tuple(sorted({(r+dr,c+dc) for r,c in positions for dr,dc in ((-1,0),(1,0),(0,-1),(0,1)) if (r+dr,c+dc) not in positions and
        (r+dr,c+dc) in medium and medium[(r+dr,c+dc)].admissible is True and medium[(r+dr,c+dc)].evidence_ref is not None}))
    endpoints=()
    if positions and (len({r for r,c in positions})==1 or len({c for r,c in positions})==1):
        first,last=min(positions),max(positions);axis=(0,1) if first[0]==last[0] else (1,0)
        if len(positions)==abs(last[0]-first[0])+abs(last[1]-first[1])+1:endpoints=((first[0]-axis[0],first[1]-axis[1]),(last[0]+axis[0],last[1]+axis[1]))
    isolated=(len(request.collider_input.collider_masks)==1 and len(tuple(s for s in request.state.sources if s.active))<=1 and
              bool(endpoints) and all(p in exterior for p in endpoints) and not request.state.trace and not union.overlap_positions)
    return family_result(request,values={'union':union,'exterior_admissible_positions':exterior,'bar_endpoints':endpoints,
        'isolated_bar_geometry_conditions':isolated,'complete_escape_route_proven':False},examined_count=work)


def _directed_inverse(request):
    resume=request.resume if request.resume is not None and request.resume.phase=='INVERSE' else None
    rows=list(resume.completed_rows) if resume is not None else []
    count=resume.accounted_evaluations if resume is not None else 0
    start=resume.candidate_index if resume is not None else 0;debt=list(resume.retained_prerequisite_refs) if resume is not None else [];cut={}
    for index in range(start,len(request.candidates)):
        candidate=request.candidates[index]
        if len(rows)>=request.maximum_states:
            token=_flow_continuation(request,'INVERSE',candidate_index=index,completed_rows=tuple(rows),accounted_evaluations=count,retained_prerequisite_refs=tuple(dict.fromkeys(debt)))
            cut=_resume_frontier(request,{'phase':'supplied_routing_candidates','next_candidate_index':index},token);break
        if candidate.port_evidence_ref is None:debt.append('current_candidate_port_connection_evidence');continue
        if candidate.configuration.level_scope_ref!=request.state.level_scope_ref or candidate.configuration.restore_epoch!=request.state.restore_epoch:
            debt.append('same_scope_configuration_candidate');continue
        if candidate.configuration.remaining_budget!=request.state.remaining_budget:debt.append('configuration_candidate_cannot_create_resources');continue
        if any(source not in {s.source_ref for s in candidate.configuration.sources} or receiver not in {r.receiver_ref for r in request.model.receivers} for source,receiver in candidate.port_connections):
            debt.append('current_source_and_receiver_port_identity');continue
        pending=resume.pending_release if resume is not None and index==start else None
        previous=pending.accounted_evaluations if pending is not None else 0
        branches,missing,work,bound=_external_flow(candidate.configuration,request.model,request.command,request,request.maximum_evaluations-count+previous,pending)
        count+=work-previous
        if missing:debt.extend(missing)
        if bound:
            token=_flow_continuation(request,'INVERSE',candidate_index=index,completed_rows=tuple(rows),accounted_evaluations=count,
                pending_release=bound.get('continuation'),retained_prerequisite_refs=tuple(dict.fromkeys(debt)))
            cut=_resume_frontier(request,{'phase':'routing_candidate_release','next_candidate_index':index},token);break
        rows.append({'candidate_ref':candidate.candidate_ref,'port_connections':candidate.port_connections,'response_domain':tuple({'after_state':s,'events':e} for s,e in branches),
            'all_retained_responses_satisfy_supplied_predicates':bool(branches) and not missing and all(set(request.required_capture_refs).issubset(set(s.captured_receiver_refs)) and
                (not request.forbidden_leak or not s.leaks) and s.phase=='STOPPED' and all(any(event.get('kind')=='CAPTURE' and event.get('source_ref')==source and event.get('receiver_ref')==receiver for event in events) for source,receiver in candidate.port_connections)
                for s,events in branches),'missing_refs':missing,'complete_route_search_called':False})
    return family_result(request,values={'routing_candidate_results':tuple(rows),'minimum_cost_proven':False,'supplied_configuration_domain_only':True},
        prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)


def _directed_fit(request):
    resume=request.resume if request.resume is not None and request.resume.phase=='FIT' else None
    rows=list(resume.completed_rows) if resume is not None else [];count=resume.accounted_evaluations if resume is not None else 0
    start_model=resume.model_index if resume is not None else 0;debt=list(resume.retained_prerequisite_refs) if resume is not None else [];cut={}
    for model_index in range(start_model,len(request.models)):
        model=request.models[model_index];compared=resume.compared_observations if resume is not None and model_index==start_model else 0
        observation_start=resume.observation_index if resume is not None and model_index==start_model else 0;contradiction=False;missing=list(resume.current_model_prerequisite_refs) if resume is not None and model_index==start_model else []
        for observation_index in range(observation_start,len(request.observations)):
            observation=request.observations[observation_index]
            if not observation.sealed or observation.event_owner_ref!=request.scope.event_owner_ref or observation.epoch!=request.scope.epoch or observation.before.level_scope_ref!=observation.after.level_scope_ref:
                missing.append('sealed_owned_current_scope_flow_observation');continue
            pending=resume.pending_release if resume is not None and model_index==start_model and observation_index==observation_start else None
            previous=pending.accounted_evaluations if pending is not None else 0
            responses,unknown,work,bound=_external_flow(observation.before,model,observation.command,request,request.maximum_evaluations-count+previous,pending)
            count+=work-previous
            if unknown:missing.extend(unknown);continue
            if bound:
                token=_flow_continuation(request,'FIT',model_index=model_index,observation_index=observation_index,compared_observations=compared,
                    completed_rows=tuple(rows),accounted_evaluations=count,pending_release=bound.get('continuation'),
                    retained_prerequisite_refs=tuple(dict.fromkeys(debt)),current_model_prerequisite_refs=tuple(dict.fromkeys(missing)))
                cut=_resume_frontier(request,{'phase':'flow_fit','model_index':model_index,'observation_index':observation_index},token);break
            compared+=1
            if not any(_physical_flow_state(s)==_physical_flow_state(observation.after) for s,e in responses):contradiction=True;break
        if missing:debt.extend(missing)
        if cut:break
        rows.append({'model_ref':model.model_ref,'observations_compared':compared,'matches':False if contradiction else None if missing or compared==0 else True,'missing_refs':tuple(dict.fromkeys(missing))})
    return family_result(request,values={'model_results':tuple(rows),'real_world_hydraulics_assumed':False},prerequisite_refs=tuple(dict.fromkeys(debt)),
        examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)


def _physical_flow_state(state):
    # Observation provenance may change without a physical contradiction.
    return (tuple((o.object_ref,o.type_ref,o.positions,o.control_refs,o.attachment_refs,o.collider,o.parent_object_ref,o.pose_origin,o.pose_basis) for o in state.objects),
        tuple((s.source_ref,s.position,s.heading,s.parent_object_ref,s.active) for s in state.sources),state.focus_object_ref,
        state.fronts,state.trace,state.captured_receiver_refs,state.leaks,state.remaining_budget,state.input_tick,state.simulation_tick,
        state.restore_epoch,state.level_scope_ref,state.phase)


def _measure_directed_accretive_flow(request: DirectedRequest) -> MechanicalFamilyResult:
    prefix='mechanics.directed_accretive_flow.'
    operation=request.operation_ref[len(prefix):] if request.operation_ref.startswith(prefix) else ''
    if operation not in DIRECTED_OPERATION_MODES or request.mode not in DIRECTED_OPERATION_MODES[operation]:return family_result(request,signature_supported=False,domain_complete=False)
    if request.source_identity_ref is None:return family_result(request,prerequisite_refs=('current_source_identity_for_revision_qualified_resumption',),domain_complete=False)
    if request.resume is not None and request.resume.input_digest!=_flow_input_digest(request):
        return family_result(request,prerequisite_refs=('unchanged_source_scope_model_evidence_and_immutable_inputs_for_resume',),domain_complete=False)
    fields={'configure_successor':('state','model','command'),'successor':('state','model','command'),
        'advance':('state','model','front_ref'),'split':('state','model','front_ref'),'turn':('state','model','front_ref'),'capture':('state','model','front_ref'),
        'multi_source_tick':('state','model'),'composite_relief':('state','model','collider_input'),
        'inverse_routing':('state','model','command','candidates','required_capture_refs','forbidden_leak'),
        'flow_fit':('models','observations'),'recovery':('recovery_input','recovery_evidence_ref','recovery_budget_before','recovery_budget_after','recovery_before_state','recovery_after_state')}[operation]
    missing=missing_supplied_fields(request,fields)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if operation=='composite_relief':return _relief(request)
    if operation=='inverse_routing':
        if request.command.operation_kind!='RELEASE':return family_result(request,prerequisite_refs=('release_forward_check_for_supplied_routing_candidate',),domain_complete=False)
        return _directed_inverse(request)
    if operation=='flow_fit':return _directed_fit(request)
    if operation=='recovery':
        v=request.recovery_input;work=sum(len(getattr(v,k)) for k in ('configuration_before_release','configuration_after_recovery','trace_after_failed_release','trace_after_recovery','receptacle_before_release','receptacle_after_failed_release','receptacle_after_recovery','quantities_before_release','quantities_after_recovery'))+sum(len(o.positions)+len(o.control_refs)+len(o.attachment_refs) for state in (request.recovery_before_state,request.recovery_after_state) for o in state.objects)+len(request.recovery_before_state.sources)+len(request.recovery_after_state.sources)
        if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'recovery_geometry','required_work':work})
        measured=measure_directed_flow_recovery(v);before=request.recovery_before_state;after=request.recovery_after_state
        budget_ok=request.recovery_budget_before==before.remaining_budget and request.recovery_budget_after==after.remaining_budget and after.remaining_budget<=before.remaining_budget
        objects=lambda state:tuple((o.object_ref,o.type_ref,o.positions,o.control_refs,o.attachment_refs,o.collider,o.parent_object_ref,o.pose_origin,o.pose_basis) for o in state.objects)
        sources=lambda state:tuple((s.source_ref,s.position,s.heading,s.parent_object_ref,s.active) for s in state.sources)
        identities_ok=objects(before)==objects(after) and sources(before)==sources(after) and before.focus_object_ref==after.focus_object_ref and before.level_scope_ref==after.level_scope_ref
        dynamic_reset=not after.fronts and not after.trace and not after.leaks and after.phase!='RUNNING'
        projection_ok=set(v.configuration_before_release)=={p for o in before.objects for p in o.positions} and set(v.configuration_after_recovery)=={p for o in after.objects for p in o.positions}
        debt=tuple(ref for ref,ok in (('preserved_already_spent_release_budget',budget_ok),('retained_configuration_identity_and_bindings',identities_ok),('supported_dynamic_flow_reset',dynamic_reset),('recovery_geometry_corresponds_to_actual_identity_states',projection_ok)) if not ok)
        return family_result(request,values={'recovery':measured,'spent_budget_preserved':budget_ok,'configuration_identity_preserved':identities_ok,
            'dynamic_state_cleared':dynamic_reset,'new_player_input_dispatched':False},examined_count=work,prerequisite_refs=debt,domain_complete=not debt)
    if operation in ('configure_successor','successor'):
        if operation=='configure_successor' and request.command.operation_kind!='CONFIGURE':return family_result(request,signature_supported=False,domain_complete=False)
        branches,debt,count,cut=_external_flow(request.state,request.model,request.command,request,request.maximum_evaluations,
            request.resume if request.resume is not None and request.resume.phase=='RELEASE' else None)
        return family_result(request,values={'response_domain':tuple({'after_state':s,'events':e} for s,e in branches),'partial_prefix_only':bool(cut),'extra_player_inputs':0},
            prerequisite_refs=debt,examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)
    if operation=='multi_source_tick':
        branches,debt,count,cut=_flow_tick(request.state,request.model,request,request.maximum_evaluations)
        return family_result(request,values={'tick_responses':tuple({'after_state':s,'events':e,'schedule_ref':r} for s,e,r in branches)},prerequisite_refs=debt,
            examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)
    front=next((f for f in request.state.fronts if f.front_ref==request.front_ref),None)
    if front is None:return family_result(request,prerequisite_refs=('actual_current_flow_front',),domain_complete=False)
    work=_flow_geometry_work(request.state,request.model)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'local_flow_geometry','required_work':work})
    context=_flow_context(request.state,request.model,request.scope.assumption_refs+request.scope.retained_alternative_refs)
    destination=(front.position[0]+front.delta_row,front.position[1]+front.delta_column)
    children,events,debt=_flow_front_effect(request.state,request.model,front,destination,{c.position:frozenset(c.lineage_refs) for c in request.state.trace},context)
    return family_result(request,values={'child_offsets_and_headings':children,'events':events,'internal_single_front_projection_only':True,
        'requested_effect_present':any(e['kind']==operation.upper() for e in events)},
        prerequisite_refs=debt,examined_count=work,domain_complete=not debt)


def measure_directed_accretive_flow(request: DirectedRequest) -> MechanicalFamilyResult:
    if request.source_identity_ref is None or request.resume is not None and request.resume.input_digest!=_flow_input_digest(request):
        return family_result(request,prerequisite_refs=('unchanged_source_scope_model_evidence_and_immutable_inputs_for_resume',),domain_complete=False)
    offset=request.resume.accounted_evaluations if request.resume is not None and request.resume.phase=='UNSTARTED' else 0
    if offset>=request.maximum_evaluations:
        return family_result(request,examined_count=offset,domain_complete=False,computation_bound_reached=True,
            frontier=_resume_frontier(request,{'phase':'resumed_atomic_work_budget'},request.resume))
    bounded=request.model_copy(update={'maximum_evaluations':request.maximum_evaluations-offset}) if offset else request
    result=_measure_directed_accretive_flow(bounded)
    if offset:result=result.model_copy(update={'examined_count':result.examined_count+offset})
    if result.computation_bound_reached and 'continuation' not in result.frontier:
        token=_flow_continuation(request,'UNSTARTED',accounted_evaluations=result.examined_count)
        result=result.model_copy(update={'frontier':immutable_json_data(_resume_frontier(request,dict(result.frontier),token))})
    return result
