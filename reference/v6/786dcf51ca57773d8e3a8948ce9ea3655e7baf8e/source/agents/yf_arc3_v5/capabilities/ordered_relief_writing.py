"""Pure bounded measurements for source-declared regional writing."""

from __future__ import annotations

from collections import deque

from agents.yf_arc3_v5.capabilities.contracts import (
    OrderedReliefPoseInput,
    OrderedReliefPoseMeasurements,
    OrderedReliefTransitionInput,
    OrderedReliefTransitionMeasurements,
    OrderedReliefWriteInput,
    OrderedReliefWriteMeasurements,
)


def measure_ordered_relief_transition(
    value: OrderedReliefTransitionInput,
) -> OrderedReliefTransitionMeasurements:
    """Measure a sealed packet without assigning meaning to its partitions."""

    before_shape = (len(value.before_rows), len(value.before_rows[0]))
    after_shape = (len(value.after_rows), len(value.after_rows[0]))
    compared_height = min(before_shape[0], after_shape[0])
    compared_width = min(before_shape[1], after_shape[1])
    changed = tuple(
        (row, column)
        for row in range(compared_height)
        for column in range(compared_width)
        if value.before_rows[row][column] != value.after_rows[row][column]
    )
    changed_set = set(changed)
    partition_positions = {
        partition.partition_ref: set(partition.positions)
        for partition in value.partitions
    }
    assigned = set().union(*partition_positions.values())
    application_positions = tuple(
        position
        for position in value.application_positions
        if 0 <= position[0] < compared_height and 0 <= position[1] < compared_width
    )
    changed_application_positions = tuple(
        position for position in application_positions if position in changed_set
    )
    same_value_positions = ()
    if value.supplied_write_value is not None:
        same_value_positions = tuple(
            position
            for position in application_positions
            if position not in changed_set
            and value.before_rows[position[0]][position[1]]
            == value.supplied_write_value
            and value.after_rows[position[0]][position[1]]
            == value.supplied_write_value
        )
    return OrderedReliefTransitionMeasurements(
        before_shape=before_shape,
        after_shape=after_shape,
        extent_changed=before_shape != after_shape,
        changed_positions=changed,
        changed_count_by_partition=tuple(
            (partition.partition_ref, len(changed_set & partition_positions[partition.partition_ref]))
            for partition in value.partitions
        ),
        unpartitioned_changed_count=len(changed_set - assigned),
        application_position_count=len(application_positions),
        changed_application_positions=changed_application_positions,
        known_same_value_application_positions=same_value_positions,
        compared_cell_count=compared_height * compared_width,
    )


def apply_ordered_relief_write(
    value: OrderedReliefWriteInput,
) -> OrderedReliefWriteMeasurements:
    """Apply one supplied last-writer replacement and preserve every other cell."""

    rows = [list(row) for row in value.canvas_rows]
    changed: list[tuple[int, int]] = []
    same_value: list[tuple[int, int]] = []
    for row, column in value.application_positions:
        if rows[row][column] == value.write_value:
            same_value.append((row, column))
        else:
            rows[row][column] = value.write_value
            changed.append((row, column))
    resulting_rows = tuple(tuple(row) for row in rows)
    application_set = set(value.application_positions)
    preserved = all(
        resulting_rows[row][column] == value.canvas_rows[row][column]
        for row in range(len(value.canvas_rows))
        for column in range(len(value.canvas_rows[0]))
        if (row, column) not in application_set
    )
    return OrderedReliefWriteMeasurements(
        resulting_rows=resulting_rows,
        affected_positions=value.application_positions,
        changed_positions=tuple(changed),
        same_value_positions=tuple(same_value),
        non_application_cells_preserved=preserved,
    )


def measure_ordered_relief_pose(
    value: OrderedReliefPoseInput,
) -> OrderedReliefPoseMeasurements:
    """Find one deterministic shortest route using observed edges only."""

    records = {record.pose_ref: record for record in value.pose_records}
    requested = records.get(value.requested_pose_ref)
    requested_pose_observed = requested is not None
    aspect_matches = bool(
        requested is not None and requested.aspect_ref == value.required_aspect_ref
    )
    size_matches = bool(
        requested is not None
        and requested.applicator_size == value.required_applicator_size
    )
    eligible_target = requested_pose_observed and aspect_matches and size_matches
    adjacency: dict[str, list[tuple[str, str]]] = {}
    for edge in value.observed_edges:
        adjacency.setdefault(edge.source_pose_ref, []).append(
            (edge.action_ref, edge.target_pose_ref)
        )
    for pose_ref in sorted(adjacency):
        adjacency[pose_ref].sort()

    queue = deque([(value.current_pose_ref, (), (value.current_pose_ref,))])
    visited = {value.current_pose_ref}
    route_actions: tuple[str, ...] = ()
    route_poses: tuple[str, ...] = ()
    tested_edge_count = 0
    depth_bound_reached = False
    while queue and eligible_target:
        pose_ref, actions, poses = queue.popleft()
        if pose_ref == value.requested_pose_ref:
            route_actions = actions
            route_poses = poses
            break
        if len(actions) >= value.maximum_route_depth:
            if adjacency.get(pose_ref):
                depth_bound_reached = True
            continue
        for action_ref, target_ref in adjacency.get(pose_ref, ()):
            tested_edge_count += 1
            if target_ref in visited:
                continue
            visited.add(target_ref)
            queue.append((target_ref, (*actions, action_ref), (*poses, target_ref)))
    route_available = bool(route_poses) or (
        eligible_target and value.current_pose_ref == value.requested_pose_ref
    )
    if route_available and not route_poses:
        route_poses = (value.current_pose_ref,)
    return OrderedReliefPoseMeasurements(
        requested_pose_observed=requested_pose_observed,
        aspect_matches=aspect_matches,
        applicator_size_matches=size_matches,
        route_available=route_available,
        route_action_refs=route_actions,
        route_pose_refs=route_poses,
        tested_edge_count=tested_edge_count,
        route_depth_bound_reached=depth_bound_reached,
    )

# Generic K21 envelopes keep composition separate from semantic reference choice.
from typing import Literal
from pydantic import Field,model_validator
import hashlib,json
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields

Cell=tuple[int,int]


class ReliefSurface(FrozenModel):
    rows: tuple[tuple[int,...],...]=Field(min_length=1,max_length=64)
    pose_ref: Ref|None=None
    active_write_value: int|None=None
    other_state: FrozenMap=Field(default_factory=FrozenMap)
    @model_validator(mode='after')
    def validate_grid(self):
        width=len(self.rows[0])
        if not 1<=width<=64 or any(len(r)!=width for r in self.rows):raise ValueError('canvas must be a bounded rectangle')
        return self


class ReliefWrite(FrozenModel):
    write_ref: Ref
    full_positions: tuple[Cell,...]=Field(min_length=1,max_length=4096)
    value: int
    pose_ref: Ref|None=None
    required_aspect_ref: Ref|None=None
    required_size: int|None=Field(default=None,ge=1,le=4096)
    evidence_refs: tuple[Ref,...]=Field(min_length=1,max_length=64)
    @model_validator(mode='after')
    def validate_mask(self):
        if len(set(self.full_positions))!=len(self.full_positions):raise ValueError('write mask repeats a cell')
        return self


class ReliefLayer(FrozenModel):
    layer_ref: Ref
    full_positions: tuple[Cell,...]=Field(max_length=4096)
    observed_visible_positions: tuple[Cell,...]|None=Field(default=None,max_length=4096)
    value: int
    evidence_refs: tuple[Ref,...]=Field(min_length=1,max_length=64)


class ReliefMaskEvidence(FrozenModel):
    observation_ref: Ref
    owner_ref: Ref
    epoch: int=Field(ge=0)
    sealed: bool
    required_positive_positions: tuple[Cell,...]=Field(default=(),max_length=4096)
    forbidden_negative_positions: tuple[Cell,...]=Field(default=(),max_length=4096)
    contour_required_positions: tuple[Cell,...]=Field(default=(),max_length=4096)
    evidence_refs: tuple[Ref,...]=Field(min_length=1,max_length=64)
    transition: OrderedReliefTransitionInput|None=None


class ReliefStep(FrozenModel):
    kind: Literal['SELECT','MOVE','WRITE','RESET']
    action_ref: Ref
    cost: int|None=Field(default=None,ge=0)
    value: int|None=None
    target_pose_ref: Ref|None=None
    write_ref: Ref|None=None


class ReliefCandidate(FrozenModel):
    candidate_ref: Ref
    steps: tuple[ReliefStep,...]=Field(max_length=4096)


class ReliefContinuation(FrozenModel):
    phase: Literal['ROWS','FORWARD','UNSTARTED']
    input_digest: Ref
    next_item: int=Field(default=0,ge=0)
    next_step: int=Field(default=0,ge=0)
    surface: ReliefSurface|None=None
    events: tuple[FrozenMap,...]=()
    cost_components: FrozenMap=Field(default_factory=FrozenMap)
    completed_rows: tuple[FrozenMap,...]=()
    prerequisite_refs: tuple[Ref,...]=()
    accounted_evaluations: int=Field(default=0,ge=0)


class ReliefRequest(FrozenModel):
    schema_version: Ref='yf_arc3_v5.ordered_relief_request.v1'
    scope: MechanicalFamilyScope
    source_identity_ref: Ref
    operation_ref: Ref
    mode: Ref|None=None
    surface: ReliefSurface|None=None
    reset_surface: ReliefSurface|None=None
    reset_evidence_refs: tuple[Ref,...]=Field(default=(),max_length=64)
    layers: tuple[ReliefLayer,...]=Field(default=(),max_length=32)
    layer_orders: tuple[tuple[Ref,...],...]=Field(default=(),max_length=3)
    writes: tuple[ReliefWrite,...]=Field(default=(),max_length=4096)
    write: ReliefWrite|None=None
    mask_evidence: tuple[ReliefMaskEvidence,...]=Field(default=(),max_length=128)
    application_domain: tuple[Cell,...]|None=Field(default=None,max_length=4096)
    pose: OrderedReliefPoseInput|None=None
    reference_cells: tuple[tuple[Cell,int],...]=Field(default=(),max_length=4096)
    preserved_cells: tuple[Cell,...]=Field(default=(),max_length=4096)
    exposed_residual: tuple[tuple[Cell,int],...]=Field(default=(),max_length=4096)
    upper_positions: tuple[Cell,...]=Field(default=(),max_length=4096)
    candidates: tuple[ReliefCandidate,...]=Field(default=(),max_length=4096)
    clipping_policy: Literal['CLIP','REJECT','UNKNOWN']='UNKNOWN'
    maximum_evaluations: int=Field(default=65536,ge=1,le=65536)
    maximum_states: int=Field(default=4096,ge=1,le=4096)
    resume: ReliefContinuation|None=None
    @model_validator(mode='after')
    def validate_identities(self):
        for refs in ([l.layer_ref for l in self.layers],[w.write_ref for w in self.writes],[c.candidate_ref for c in self.candidates]):
            if len(set(refs))!=len(refs):raise ValueError('layer/write/candidate refs must be unique')
        if len({p for p,v in self.reference_cells})!=len(self.reference_cells):raise ValueError('reference cells must be unique')
        return self


RELIEF_OPERATION_MODES={'visible_support':('MEASURE',),'application_support':('FIT',),'successor':('STEP_INTERNAL',),
    'pose_precondition':('PRECONDITION',),'backward_domains':('INVERSE_DOMAIN',),'forward_certificate':('COMPARE',),'cost':('MEASURE',)}


def _relief_digest(request):
    return hashlib.sha256(json.dumps(request.model_dump(mode='json',exclude={'resume','maximum_evaluations','maximum_states'}),
        sort_keys=True,separators=(',',':')).encode()).hexdigest()


def _relief_resume(request,phase,**fields):
    for key in ('events','completed_rows'):fields[key]=tuple(immutable_json_data(r) for r in fields.get(key,()))
    if 'cost_components' in fields:fields['cost_components']=immutable_json_data(fields['cost_components'])
    return ReliefContinuation(phase=phase,input_digest=_relief_digest(request),**fields)


def _relief_apply(surface,write,request):
    if request.clipping_policy=='UNKNOWN':return surface,{},('current_application_clipping_policy',)
    height,width=len(surface.rows),len(surface.rows[0])
    inside=tuple(p for p in write.full_positions if 0<=p[0]<height and 0<=p[1]<width)
    outside=tuple(p for p in write.full_positions if p not in set(inside))
    if outside and request.clipping_policy=='REJECT':return surface,{'write_rejected':True,'outside_positions':outside},()
    if not inside:return surface,{'full_positions':write.full_positions,'applied_positions':(),'clipped_positions':outside},()
    result=apply_ordered_relief_write(OrderedReliefWriteInput(canvas_rows=surface.rows,application_positions=inside,write_value=write.value))
    return surface.model_copy(update={'rows':result.resulting_rows}),{'write_ref':write.write_ref,'full_positions':write.full_positions,
        'applied_positions':inside,'changed_positions':result.changed_positions,'same_value_positions':result.same_value_positions,
        'clipped_positions':outside,'non_writing_state_preserved':True},()


def _relief_pose_at(surface,write,request):
    if request.pose is None or surface.pose_ref is None or write.pose_ref is None or write.required_aspect_ref is None or write.required_size is None:
        return None,('current_grounded_pose_graph_and_applicator_properties',)
    value=request.pose.model_copy(update={'current_pose_ref':surface.pose_ref,'requested_pose_ref':write.pose_ref,
        'required_aspect_ref':write.required_aspect_ref,'required_applicator_size':write.required_size})
    result=measure_ordered_relief_pose(value)
    return result,()


def _relief_forward(request):
    resume=request.resume if request.resume is not None and request.resume.phase=='FORWARD' else None
    rows=list(resume.completed_rows) if resume is not None else [];debt=list(resume.prerequisite_refs) if resume is not None else []
    count=resume.accounted_evaluations if resume is not None else 0;writes={w.write_ref:w for w in request.writes}
    for index in range(resume.next_item if resume is not None else 0,len(request.candidates)):
        candidate=request.candidates[index];continuing=resume is not None and index==resume.next_item
        surface=resume.surface if continuing and resume.surface is not None else request.surface
        events=list(resume.events) if continuing else [];costs=dict(resume.cost_components) if continuing else {'SELECT':0,'MOVE':0,'WRITE':0,'RESET':0}
        local=[]
        for part in range(resume.next_step if continuing else 0,len(candidate.steps)+1):
            step=candidate.steps[part] if part<len(candidate.steps) else None
            work=len(surface.rows)*len(surface.rows[0])+1+len(request.reference_cells)+len(request.preserved_cells)
            if step is not None and step.write_ref in writes:work+=len(writes[step.write_ref].full_positions)*2
            if request.pose is not None:work+=len(request.pose.pose_records)+len(request.pose.observed_edges)*2
            if count+work>request.maximum_evaluations or len(rows)>=request.maximum_states:
                token=_relief_resume(request,'FORWARD',next_item=index,next_step=part,surface=surface,events=tuple(events),
                    cost_components=costs,completed_rows=tuple(rows),prerequisite_refs=tuple(dict.fromkeys(debt)),accounted_evaluations=count)
                return family_result(request,values={'forward_certificates':tuple(rows)},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,
                    domain_complete=False,computation_bound_reached=True,frontier={'continuation':token})
            count+=work
            if step is None:break
            if step.cost is None:local.append('exact_current_primitive_cost');break
            before=surface
            if step.kind=='SELECT':
                if step.value is None:local.append('supported_selection_value');break
                surface=surface.model_copy(update={'active_write_value':step.value})
            elif step.kind=='MOVE':
                if request.pose is None or surface.pose_ref is None or step.target_pose_ref is None:
                    local.append('current_observed_control_edge');break
                edges=tuple(e for e in request.pose.observed_edges if e.source_pose_ref==surface.pose_ref and e.action_ref==step.action_ref and e.target_pose_ref==step.target_pose_ref)
                if len(edges)!=1:local.append('unique_observed_control_edge');break
                surface=surface.model_copy(update={'pose_ref':step.target_pose_ref})
            elif step.kind=='RESET':
                if request.reset_surface is None or not request.reset_evidence_refs:local.append('evidenced_reset_surface_and_scope');break
                surface=request.reset_surface
            else:
                write=writes.get(step.write_ref)
                if write is None or surface.active_write_value!=write.value:local.append('current_selected_write_operator');break
                pose,missing=_relief_pose_at(surface,write,request)
                if missing:local.extend(missing);break
                if surface.pose_ref!=write.pose_ref or not pose.requested_pose_observed or not pose.aspect_matches or not pose.applicator_size_matches:
                    local.append('currently_realized_applicator_pose_not_only_reachable');break
                surface,event,missing=_relief_apply(surface,write,request)
                if missing:local.extend(missing);break
                events.append(immutable_json_data({'step_index':part,'kind':step.kind,'event':event}))
            costs[step.kind]+=step.cost
            if step.kind!='WRITE':events.append(immutable_json_data({'step_index':part,'kind':step.kind,'pose_before':before.pose_ref,'pose_after':surface.pose_ref,'active_write_value':surface.active_write_value}))
        residual=[]
        for (r,c),value in request.reference_cells:
            if not 0<=r<len(surface.rows) or not 0<=c<len(surface.rows[0]):local.append('current_reference_cell_inside_canvas');continue
            if surface.rows[r][c]!=value:residual.append(((r,c),surface.rows[r][c],value))
        preserved=[]
        for r,c in request.preserved_cells:
            if not(0<=r<len(surface.rows) and 0<=c<len(surface.rows[0]) and 0<=r<len(request.surface.rows) and 0<=c<len(request.surface.rows[0])):
                local.append('preservation_domain_inside_before_and_after_canvas');continue
            if surface.rows[r][c]!=request.surface.rows[r][c]:preserved.append((r,c))
        debt.extend(local);rows.append({'candidate_ref':candidate.candidate_ref,'after_surface':surface,'events':tuple(events),'cost_components':costs,
            'total_cost':sum(costs.values()),'final_reference_residuals':tuple(residual),'incidental_preservation_violations':tuple(preserved),
            'fully_executed':not local,'final_compatible':not local and not residual and not preserved,'missing_refs':tuple(dict.fromkeys(local))})
        resume=None
    return family_result(request,values={'forward_certificates':tuple(rows)},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,
        domain_complete=not debt and request.scope.input_domain_complete)


def _relief_rows(request,operation):
    resume=request.resume if request.resume is not None and request.resume.phase=='ROWS' else None
    rows=list(resume.completed_rows) if resume is not None else [];count=resume.accounted_evaluations if resume is not None else 0
    debt=list(resume.prerequisite_refs) if resume is not None else []
    items=request.layer_orders if operation=='visible_support' else request.candidates if operation=='cost' else request.writes
    for index in range(resume.next_item if resume is not None else 0,len(items)):
        item=items[index]
        work=1+sum(len(l.full_positions) for l in request.layers)*max(1,len(request.layers)) if operation=='visible_support' else (
            1+len(item.steps) if operation=='cost' else 1+len(item.full_positions)+sum(len(e.required_positive_positions)+len(e.forbidden_negative_positions)+len(e.contour_required_positions) for e in request.mask_evidence)+len(request.exposed_residual)+len(request.upper_positions))
        if operation=='application_support':work+=sum(len(e.transition.before_rows)*len(e.transition.before_rows[0])+len(e.transition.application_positions) for e in request.mask_evidence if e.transition is not None)
        if count+work>request.maximum_evaluations or len(rows)>=request.maximum_states:
            token=_relief_resume(request,'ROWS',next_item=index,completed_rows=tuple(rows),prerequisite_refs=tuple(dict.fromkeys(debt)),accounted_evaluations=count)
            return family_result(request,values={'measured_rows':tuple(rows)},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,
                domain_complete=False,computation_bound_reached=True,frontier={'continuation':token})
        count+=work
        if operation=='visible_support':
            layers={l.layer_ref:l for l in request.layers}
            if len(item)!=len(layers) or set(item)!=set(layers):debt.append('complete_supplied_layer_order');rows.append({'order':item,'unsupported':True});continue
            upper=set();measured=[]
            for ref in item:
                layer=layers[ref];visible=set(layer.full_positions)-upper
                residual=None if layer.observed_visible_positions is None else tuple(sorted(visible^set(layer.observed_visible_positions)))
                measured.append({'layer_ref':ref,'visible_mask':tuple(sorted(visible)),'ownership_residual':residual})
                upper.update(layer.full_positions)
            rows.append({'front_to_back_order':item,'layers':tuple(measured),'semantic_reference_selected':False})
        elif operation=='cost':
            parts={'SELECT':0,'MOVE':0,'WRITE':0,'RESET':0};missing=[]
            for step in item.steps:
                if step.cost is None:missing.append(step.action_ref)
                else:parts[step.kind]+=step.cost
            if missing:debt.append('exact_current_primitive_cost')
            rows.append({'candidate_ref':item.candidate_ref,'cost_components':parts,'total_cost':None if missing else sum(parts.values()),'unknown_cost_action_refs':tuple(missing),'minimum_cost_proven':False})
        elif operation=='backward_domains':
            exposed=set(item.full_positions)-set(request.upper_positions)
            mismatches=tuple((p,value) for p,value in request.exposed_residual if p in exposed and value!=item.value)
            earlier=tuple((p,value) for p,value in request.exposed_residual if p not in exposed)
            rows.append({'write_ref':item.write_ref,'exposed_mask':tuple(sorted(exposed)),'last_layer_compatible':not mismatches,
                'unoccluded_mismatches':mismatches,'earlier_substrate_requirements':earlier})
        else:
            mask=set(item.full_positions);fits=[];required=set();forbidden=set()
            for evidence in request.mask_evidence:
                if not evidence.sealed or evidence.owner_ref!=request.scope.event_owner_ref or evidence.epoch!=request.scope.epoch:
                    debt.append('sealed_same_owner_epoch_application_evidence');continue
                positive=set(evidence.required_positive_positions)|set(evidence.contour_required_positions);negative=set(evidence.forbidden_negative_positions)
                required.update(positive);forbidden.update(negative)
                result=measure_ordered_relief_transition(evidence.transition) if evidence.transition is not None else None
                fits.append({'observation_ref':evidence.observation_ref,'positive_missing':tuple(sorted(positive-mask)),
                    'negative_overlap':tuple(sorted(negative&mask)),'transition_measurement':result})
            upper=None if request.application_domain is None else tuple(sorted(set(request.application_domain)-forbidden))
            rows.append({'write_ref':item.write_ref,'complete_candidate_mask':item.full_positions,'application_lower_bound':tuple(sorted(required)),
                'application_upper_bound':upper,'evidence_fits':tuple(fits),'candidate_compatible':bool(fits) and required<=mask and not forbidden&mask
                    and (request.application_domain is None or mask<=set(request.application_domain)),'pixel_difference_equated_to_full_application':False})
    return family_result(request,values={'measured_rows':tuple(rows)},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,domain_complete=not debt and request.scope.input_domain_complete)


def _measure_ordered_relief_writing(request):
    prefix='mechanics.ordered_relief_writing.'
    op=request.operation_ref[len(prefix):] if request.operation_ref.startswith(prefix) else ''
    if op not in RELIEF_OPERATION_MODES or request.mode not in RELIEF_OPERATION_MODES[op]:return family_result(request,signature_supported=False,domain_complete=False)
    fields={'visible_support':('layers','layer_orders'),'application_support':('writes','mask_evidence'),'successor':('surface','write'),
        'pose_precondition':('pose',),'backward_domains':('writes','exposed_residual','upper_positions'),'forward_certificate':('surface','writes','candidates','reference_cells','preserved_cells'),'cost':('candidates',)}[op]
    missing=missing_supplied_fields(request,fields)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op=='forward_certificate':return _relief_forward(request)
    if op in ('visible_support','application_support','backward_domains','cost'):return _relief_rows(request,op)
    work=1+len(request.pose.pose_records)+len(request.pose.observed_edges)*2 if op=='pose_precondition' else 1+len(request.surface.rows)*len(request.surface.rows[0])+len(request.write.full_positions)*2
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'required_work':work})
    if op=='pose_precondition':return family_result(request,values={'pose_precondition':measure_ordered_relief_pose(request.pose),'unobserved_rotation_licensed':False},examined_count=work)
    after,event,debt=_relief_apply(request.surface,request.write,request)
    affected=tuple(layer.layer_ref for layer in request.layers if set(layer.full_positions)&set(event.get('applied_positions',())))
    return family_result(request,values={'after_surface':after,'write_event':event,'affected_layer_refs':affected},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)


def measure_ordered_relief_writing(request: ReliefRequest) -> MechanicalFamilyResult:
    if request.resume is not None and request.resume.input_digest!=_relief_digest(request):return family_result(request,prerequisite_refs=('same_source_scope_revision_and_relief_inputs',),domain_complete=False)
    result=_measure_ordered_relief_writing(request)
    if result.computation_bound_reached and 'continuation' not in result.frontier:
        result=result.model_copy(update={'frontier':immutable_json_data({**dict(result.frontier),'continuation':_relief_resume(request,'UNSTARTED')})})
    return result
