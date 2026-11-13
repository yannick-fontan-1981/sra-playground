"""Pure bounded measurements for caller-declared reconfigurable supports."""

from __future__ import annotations

from collections import deque

from agents.yf_arc3_v5.capabilities.contracts import (
    Position,
    ReconfigurableConnectionDomainInput,
    ReconfigurableConnectionDomainMeasurements,
    ReconfigurableConnectionWitness,
    ReconfigurableRigidFit,
    ReconfigurableRigidGeometryInput,
    ReconfigurableRigidGeometryMeasurements,
    ReconfigurableSupportLayer,
    ReconfigurableSupportPacketInput,
    ReconfigurableSupportPacketMeasurements,
    ReconfigurableSupportSnapshot,
    ReconfigurableSupportSnapshotReport,
    ReconfigurableSupportStep,
)


def _support_union(layers: tuple[ReconfigurableSupportLayer, ...]) -> frozenset[Position]:
    return frozenset(position for layer in layers for position in layer.positions)


def _shift_pose(
    pose: tuple[Position, ...],
    step: ReconfigurableSupportStep,
) -> tuple[Position, ...]:
    return tuple(
        sorted(
            (row + step.delta_row, column + step.delta_column)
            for row, column in pose
        )
    )


def _first_shortest_supported_route(
    *, actor_positions, terminal_positions, support_positions, steps,
    maximum_tested_actor_poses, resume=None, continuation_out=None,
):
    """Same bounded BFS, optionally retaining its exact queue and next edge."""
    start=tuple(sorted(actor_positions));terminal=tuple(sorted(terminal_positions))
    if resume:
        pending=deque((tuple(tuple(p) for p in row[0]),tuple(row[1]),tuple(tuple(tuple(p) for p in pose) for pose in row[2])) for row in resume['pending'])
        visited={tuple(tuple(p) for p in pose) for pose in resume['visited']}
        tested=resume['tested'];active=resume.get('active')
        active=(tuple(tuple(p) for p in active[0]),tuple(active[1]),tuple(tuple(tuple(p) for p in pose) for pose in active[2])) if active else None
        next_edge=resume.get('next_edge',0)
    else:
        pending=deque(((start,(),(start,)),));visited={start};tested=1;active=None;next_edge=0
    ordered_steps=tuple(sorted(steps,key=lambda item:item.action_ref))
    while active is not None or pending:
        pose,actions,poses=active if active is not None else pending.popleft()
        if pose==terminal:return actions,poses,tested,False
        for index in range(next_edge,len(ordered_steps)):
            step=ordered_steps[index];successor=_shift_pose(pose,step)
            if successor in visited or not set(successor)<=support_positions:continue
            if tested>=maximum_tested_actor_poses:
                if continuation_out is not None:
                    continuation_out.update({'pending':tuple(pending),'visited':tuple(sorted(visited)),
                        'tested':tested,'active':(pose,actions,poses),'next_edge':index})
                return (),(),tested,True
            visited.add(successor);tested+=1;pending.append((successor,(*actions,step.action_ref),(*poses,successor)))
        active=None;next_edge=0
    return (),(),tested,False


def measure_reconfigurable_support_packet(
    value: ReconfigurableSupportPacketInput,
) -> ReconfigurableSupportPacketMeasurements:
    """Compare exact support unions and test one supplied terminal footprint."""

    reports: list[ReconfigurableSupportSnapshotReport] = []
    unions: list[frozenset[Position]] = []
    for snapshot in value.snapshots:
        support_union = _support_union(snapshot.active_layers)
        unions.append(support_union)
        unsupported = tuple(
            sorted(set(snapshot.actor_positions) - support_union)
        )
        owners_by_position = tuple(
            (
                position,
                tuple(
                    sorted(
                        layer.owner_ref
                        for layer in snapshot.active_layers
                        if position in layer.positions
                    )
                ),
            )
            for position in sorted(snapshot.actor_positions)
        )
        reports.append(
            ReconfigurableSupportSnapshotReport(
                snapshot_ref=snapshot.snapshot_ref,
                support_union_positions=tuple(sorted(support_union)),
                unsupported_actor_positions=unsupported,
                supporting_owner_refs_by_actor_position=owners_by_position,
            )
        )

    restoration_positions = tuple(
        sorted(
            position
            for position in set().union(*unions)
            if any(
                position in unions[earlier]
                and position not in unions[middle]
                and position in unions[later]
                for earlier in range(len(unions) - 2)
                for middle in range(earlier + 1, len(unions) - 1)
                for later in range(middle + 1, len(unions))
            )
        )
    )
    final_snapshot = value.snapshots[-1]
    final_union = unions[-1]
    route, _poses, tested, bound_reached = _first_shortest_supported_route(
        actor_positions=final_snapshot.actor_positions,
        terminal_positions=value.requested_terminal_actor_positions,
        support_positions=final_union,
        steps=value.movement_steps,
        maximum_tested_actor_poses=value.maximum_tested_actor_poses,
    )
    final_multi_owner_actor_position_count = sum(
        1
        for _position, owner_refs in reports[-1].supporting_owner_refs_by_actor_position
        if len(owner_refs) > 1
    )
    return ReconfigurableSupportPacketMeasurements(
        snapshot_reports=tuple(reports),
        support_union_changed=any(
            before != after for before, after in zip(unions, unions[1:])
        ),
        restoration_positions=restoration_positions,
        initial_final_support_union_equal=unions[0] == unions[-1],
        final_actor_fully_supported=set(final_snapshot.actor_positions) <= final_union,
        final_connection_present=bool(route)
        or tuple(sorted(final_snapshot.actor_positions))
        == tuple(sorted(value.requested_terminal_actor_positions)),
        final_route_action_refs=route,
        tested_actor_pose_count=tested,
        actor_pose_bound_reached=bound_reached,
        final_active_layer_count=len(final_snapshot.active_layers),
        final_multi_owner_actor_position_count=final_multi_owner_actor_position_count,
    )


def measure_reconfigurable_rigid_geometry(
    value: ReconfigurableRigidGeometryInput,
) -> ReconfigurableRigidGeometryMeasurements:
    """Fit translations and quarter turns for every supplied pivot candidate."""

    before = frozenset(value.before_positions)
    after = frozenset(value.after_positions)
    translations: set[Position] = set()
    before_anchor = min(before)
    for after_anchor in sorted(after):
        delta = (
            after_anchor[0] - before_anchor[0],
            after_anchor[1] - before_anchor[1],
        )
        if frozenset(
            (row + delta[0], column + delta[1]) for row, column in before
        ) == after:
            translations.add(delta)

    before_support = _support_union(value.before_support_layers)
    after_support = _support_union(value.after_support_layers)
    fits: list[ReconfigurableRigidFit] = []
    for candidate in sorted(
        value.pivot_candidates, key=lambda item: item.candidate_ref
    ):
        pivot_row, pivot_column = candidate.position
        for quarter_turns in (1, 2, 3):
            transformed: set[Position] = set()
            for row, column in before:
                relative_row = row - pivot_row
                relative_column = column - pivot_column
                for _ in range(quarter_turns):
                    relative_row, relative_column = (
                        relative_column,
                        -relative_row,
                    )
                transformed.add(
                    (pivot_row + relative_row, pivot_column + relative_column)
                )
            if transformed != after:
                continue
            fits.append(
                ReconfigurableRigidFit(
                    candidate_ref=candidate.candidate_ref,
                    quarter_turns_clockwise=quarter_turns,
                    pivot_outside_transformed_masks=(
                        candidate.position not in before
                        and candidate.position not in after
                    ),
                    staging_supported_before=(
                        set(candidate.staging_actor_positions) <= before_support
                    ),
                    staging_supported_after=(
                        set(candidate.staging_actor_positions) <= after_support
                    ),
                )
            )
    return ReconfigurableRigidGeometryMeasurements(
        exact_translation_deltas=tuple(sorted(translations)),
        exact_quarter_turn_fits=tuple(fits),
        tested_pivot_turn_count=len(value.pivot_candidates) * 3,
    )


def enumerate_reconfigurable_connection_domain(
    value: ReconfigurableConnectionDomainInput,
) -> ReconfigurableConnectionDomainMeasurements:
    """Return at most three first-shortest witnesses, without choosing one."""

    witnesses: list[ReconfigurableConnectionWitness] = []
    tested_pose_count = 0
    pose_bound_reached = False
    witness_bound_reached = False
    ordered_configurations = tuple(
        sorted(value.configurations, key=lambda item: item.configuration_ref)
    )
    tested_configuration_count = 0
    for index, configuration in enumerate(ordered_configurations):
        if len(witnesses) >= value.maximum_witnesses:
            witness_bound_reached = index < len(ordered_configurations)
            break
        remaining_bound = value.maximum_tested_actor_poses - tested_pose_count
        if remaining_bound <= 0:
            pose_bound_reached = True
            break
        tested_configuration_count += 1
        actions, poses, tested, reached = _first_shortest_supported_route(
            actor_positions=value.actor_positions,
            terminal_positions=value.requested_terminal_actor_positions,
            support_positions=_support_union(configuration.active_layers),
            steps=value.movement_steps,
            maximum_tested_actor_poses=remaining_bound,
        )
        tested_pose_count += tested
        pose_bound_reached = pose_bound_reached or reached
        if poses:
            witnesses.append(
                ReconfigurableConnectionWitness(
                    configuration_ref=configuration.configuration_ref,
                    action_refs=actions,
                    actor_pose_positions=poses,
                )
            )
        if pose_bound_reached:
            break
    return ReconfigurableConnectionDomainMeasurements(
        witnesses=tuple(witnesses),
        tested_configuration_count=tested_configuration_count,
        tested_actor_pose_count=max(1, tested_pose_count),
        actor_pose_bound_reached=pose_bound_reached,
        witness_bound_reached=witness_bound_reached,
    )

# Common K22 operations are separate from the legacy packet's route question.
from typing import Literal
from pydantic import Field,model_validator
import hashlib,json
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields


class SupportTool(FrozenModel):
    tool_ref: Ref
    positions: tuple[Position,...]=Field(min_length=1,max_length=4096)
    loaded_ref: Ref|None=None
    loaded_positions: tuple[Position,...]=Field(default=(),max_length=4096)
    support_owner_ref: Ref|None=None


class SupportState(FrozenModel):
    actor_ref: Ref
    actor_positions: tuple[Position,...]=Field(min_length=1,max_length=4096)
    tools: tuple[SupportTool,...]=Field(default=(),max_length=32)
    platforms: tuple[ReconfigurableSupportLayer,...]=Field(default=(),max_length=32)
    acquired_grant_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    resources: int=Field(ge=0)
    code_ref: Ref|None=None
    orientation_ref: Ref|None=None
    destination_frame_ref: Ref|None=None
    @model_validator(mode='after')
    def validate_unique(self):
        if len({t.tool_ref for t in self.tools})!=len(self.tools) or len({p.owner_ref for p in self.platforms})!=len(self.platforms):raise ValueError('tool/platform owners must be unique')
        return self


class SupportGrant(FrozenModel):
    grant_ref: Ref
    command_ref: Ref
    kind: Literal['ACQUIRED','MAINTAINED']
    scope_ref: Ref
    actor_allowed_positions: tuple[Position,...]|None=Field(default=None,max_length=4096)
    evidence_refs: tuple[Ref,...]=Field(min_length=1,max_length=64)


class SupportMoveLaw(FrozenModel):
    law_ref: Ref
    command_ref: Ref
    mode: Literal['EMPTY','LOADED']
    collision_policy: Literal['REJECT_ATOMIC','ALLOW_DECLARED','UNKNOWN']
    path_policy: Literal['ENDPOINT','SUPPLIED_SWEEP','UNKNOWN']
    carry_loaded: bool|None=None
    require_actor_support_after: bool|None=None
    evidence_refs: tuple[Ref,...]=Field(default=(),max_length=64)
    assumption_ref: Ref|None=None


class SupportCommand(FrozenModel):
    command_ref: Ref
    tool_ref: Ref
    kind: Literal['TRANSLATE','QUARTER_TURN','ATTACH','DETACH']
    delta: Position|None=None
    pivot: Position|None=None
    quarter_turns: int|None=Field(default=None,ge=0,le=3)
    swept_tool_masks: tuple[tuple[Position,...],...]=Field(default=(),max_length=128)
    swept_loaded_masks: tuple[tuple[Position,...],...]=Field(default=(),max_length=128)
    attachment_ref: Ref|None=None
    attachment_positions: tuple[Position,...]|None=Field(default=None,max_length=4096)
    attachment_evidence_refs: tuple[Ref,...]=Field(default=(),max_length=64)


class SupportCodeTransition(FrozenModel):
    transition_ref: Ref
    code_before_ref: Ref
    code_after_ref: Ref
    orientation_after_ref: Ref
    destination_frame_ref: Ref
    actor_after_positions: tuple[Position,...]=Field(min_length=1,max_length=4096)
    platforms_after: tuple[ReconfigurableSupportLayer,...]=Field(max_length=32)
    grants_after: tuple[Ref,...]=Field(max_length=128)
    resource_delta: int
    phase_order: tuple[Literal['CODE','ORIENTATION','TRANSPORT','GRANTS','RESOURCES'],...]=Field(min_length=5,max_length=5)
    evidence_refs: tuple[Ref,...]=Field(min_length=1,max_length=64)
    @model_validator(mode='after')
    def validate_order(self):
        if len(set(self.phase_order))!=5:raise ValueError('every coded facet must have one ordered phase')
        return self


class SupportContinuation(FrozenModel):
    phase: Literal['SNAPSHOTS','CONNECTION','UNSTARTED']
    input_digest: Ref
    next_item: int=Field(default=0,ge=0)
    completed_rows: tuple[FrozenMap,...]=()
    witnesses: tuple[FrozenMap,...]=Field(default=(),max_length=3)
    route_frontier: FrozenMap=Field(default_factory=FrozenMap)
    completed_pose_count: int=Field(default=0,ge=0)
    accounted_evaluations: int=Field(default=0,ge=0)


class SupportRequest(FrozenModel):
    schema_version: Ref='yf_arc3_v5.reconfigurable_support_request.v1'
    scope: MechanicalFamilyScope
    source_identity_ref: Ref
    operation_ref: Ref
    mode: Ref|None=None
    state: SupportState|None=None
    snapshots: tuple[ReconfigurableSupportSnapshot,...]=Field(default=(),max_length=128)
    geometry: ReconfigurableRigidGeometryInput|None=None
    command: SupportCommand|None=None
    move_laws: tuple[SupportMoveLaw,...]=Field(default=(),max_length=32)
    grants: tuple[SupportGrant,...]=Field(default=(),max_length=128)
    grant_scope_ref: Ref|None=None
    obstacles: tuple[Position,...]|None=Field(default=None,max_length=4096)
    code_transition: SupportCodeTransition|None=None
    saved_state: SupportState|None=None
    restoration_fields: tuple[Literal['ACTOR','TOOLS','PLATFORMS','GRANTS','RESOURCES','CODE','ORIENTATION','FRAME'],...]=Field(default=(),max_length=8)
    restoration_evidence_refs: tuple[Ref,...]=Field(default=(),max_length=64)
    connection: ReconfigurableConnectionDomainInput|None=None
    maximum_evaluations: int=Field(default=65536,ge=1,le=65536)
    maximum_states: int=Field(default=4096,ge=1,le=4096)
    resume: SupportContinuation|None=None


SUPPORT_OPERATION_MODES={'support_report':('MEASURE',),'rigid_geometry':('FIT',),'mode_successor':('STEP_INTERNAL',),
    'permission_precondition':('PRECONDITION',),'coded_transfer':('STEP_INTERNAL',),'restoration_mask':('STEP_INTERNAL',),'inverse_connection':('INVERSE_DOMAIN',)}


def _support_digest(request):
    data=request.model_dump(mode='json',exclude={'resume','maximum_evaluations','maximum_states'})
    if data.get('connection') is not None:
        data['connection'].pop('maximum_tested_actor_poses',None);data['connection'].pop('maximum_witnesses',None)
    return hashlib.sha256(json.dumps(data,
        sort_keys=True,separators=(',',':')).encode()).hexdigest()


def _support_resume(request,phase,**fields):
    for key in ('completed_rows','witnesses'):fields[key]=tuple(immutable_json_data(r) for r in fields.get(key,()))
    if 'route_frontier' in fields:fields['route_frontier']=immutable_json_data(fields['route_frontier'])
    return SupportContinuation(phase=phase,input_digest=_support_digest(request),**fields)


def _support_report_rows(request):
    resume=request.resume if request.resume is not None and request.resume.phase=='SNAPSHOTS' else None
    rows=list(resume.completed_rows) if resume is not None else [];count=resume.accounted_evaluations if resume is not None else 0
    for index in range(resume.next_item if resume is not None else 0,len(request.snapshots)):
        snapshot=request.snapshots[index];work=1+len(snapshot.actor_positions)*(1+sum(len(l.positions) for l in snapshot.active_layers))
        if count+work>request.maximum_evaluations or len(rows)>=request.maximum_states:
            token=_support_resume(request,'SNAPSHOTS',next_item=index,completed_rows=tuple(rows),accounted_evaluations=count)
            return family_result(request,values={'support_snapshots':tuple(rows)},examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'continuation':token})
        count+=work;union=_support_union(snapshot.active_layers)
        owners=tuple((p,tuple(sorted(l.owner_ref for l in snapshot.active_layers if p in l.positions))) for p in sorted(snapshot.actor_positions))
        rows.append({'snapshot_ref':snapshot.snapshot_ref,'unsupported_actor_positions':tuple(sorted(set(snapshot.actor_positions)-union)),
            'supporting_owners':owners,'full_actor_mask_checked':True,'route_search_called':False})
    return family_result(request,values={'support_snapshots':tuple(rows)},examined_count=count)


def _support_permissions(request):
    rows=[]
    for grant in request.grants:
        command_match=grant.command_ref==request.command.command_ref
        scope_match=grant.scope_ref==request.grant_scope_ref
        holds=(grant.grant_ref in request.state.acquired_grant_refs) if grant.kind=='ACQUIRED' else (
            None if grant.actor_allowed_positions is None else set(request.state.actor_positions)<=set(grant.actor_allowed_positions))
        rows.append({'grant_ref':grant.grant_ref,'command_matches':command_match,'scope_matches':scope_match,
            'holds_in_pre_action_state':holds,'applicable':command_match and scope_match and holds,'post_command_position_used':False})
    return tuple(rows),any(row['applicable'] for row in rows)


def _support_transform(points,command):
    if command.kind=='TRANSLATE':
        if command.delta is None:return None
        return tuple(sorted((r+command.delta[0],c+command.delta[1]) for r,c in points))
    if command.pivot is None or command.quarter_turns is None:return None
    # Same exact quarter-turn convention as measure_reconfigurable_rigid_geometry.
    result=[]
    for r,c in points:
        dr,dc=r-command.pivot[0],c-command.pivot[1]
        for _ in range(command.quarter_turns):dr,dc=dc,-dr
        result.append((command.pivot[0]+dr,command.pivot[1]+dc))
    return tuple(sorted(result))


def _support_move(request):
    state,command=request.state,request.command;tool=next((t for t in state.tools if t.tool_ref==command.tool_ref),None)
    if tool is None:return state,(),('current_tool_identity',)
    mode='EMPTY' if tool.loaded_ref is None else 'LOADED'
    laws=tuple(l for l in request.move_laws if l.command_ref==command.command_ref and l.mode==mode)
    if len(laws)!=1:return state,(),('unique_scoped_empty_or_loaded_tool_law',)
    law=laws[0]
    if not law.evidence_refs and law.assumption_ref not in request.scope.assumption_refs:return state,(),('evidenced_or_retained_tool_mode_law',)
    grants,allowed=_support_permissions(request)
    if any(row['holds_in_pre_action_state'] is None and row['command_matches'] and row['scope_matches'] for row in grants):
        return state,(),('current_maintained_grant_predicate',)
    if not allowed:return state,({'permission_denied_before_command':True,'grants':grants},),()
    if command.kind in ('ATTACH','DETACH'):
        if not command.attachment_evidence_refs:return state,(),('evidenced_attachment_or_removal_event',)
        if command.kind=='ATTACH':
            if command.attachment_ref is None or command.attachment_positions is None or tool.loaded_ref is not None:return state,(),('current_empty_tool_and_known_attachment_payload',)
            after=tool.model_copy(update={'loaded_ref':command.attachment_ref,'loaded_positions':command.attachment_positions})
        else:
            if tool.loaded_ref is None:return state,(),('current_loaded_tool_for_removal',)
            after=tool.model_copy(update={'loaded_ref':None,'loaded_positions':()})
        return state.model_copy(update={'tools':tuple(after if t.tool_ref==after.tool_ref else t for t in state.tools)}),({'attachment_event':command.kind},),()
    if law.collision_policy=='UNKNOWN' or law.path_policy=='UNKNOWN' or law.carry_loaded is None or law.require_actor_support_after is None:
        return state,(),('separate_current_mode_collision_carry_path_and_support_rules',)
    positions=_support_transform(tool.positions,command)
    if positions is None:return state,(),('complete_tool_translation_or_pivot_parameters',)
    loaded=tool.loaded_positions
    if mode=='LOADED' and not loaded:return state,(),('complete_loaded_body_mask',)
    if mode=='LOADED' and law.carry_loaded:loaded=_support_transform(loaded,command)
    actor=loaded if tool.loaded_ref==state.actor_ref and law.carry_loaded else state.actor_positions
    tool_masks=(positions,);load_masks=(loaded,) if loaded else ()
    if law.path_policy=='SUPPLIED_SWEEP':
        tool_masks=command.swept_tool_masks;load_masks=command.swept_loaded_masks
        if not tool_masks or set(tool_masks[0])!=set(tool.positions) or set(tool_masks[-1])!=set(positions):return state,(),('complete_tool_swept_masks',)
        if loaded and (not load_masks or set(load_masks[0])!=set(tool.loaded_positions) or set(load_masks[-1])!=set(loaded)):
            return state,(),('complete_loaded_body_swept_masks',)
    blocked=frozenset(request.obstacles)&frozenset(p for mask in (*tool_masks,*load_masks) for p in mask)
    if blocked and law.collision_policy=='REJECT_ATOMIC':return state,({'atomic_rejection':True,'blocked_positions':tuple(sorted(blocked))},),()
    after=tool.model_copy(update={'positions':positions,'loaded_positions':loaded})
    platforms=tuple(layer.model_copy(update={'positions':positions}) if layer.owner_ref==tool.support_owner_ref else layer for layer in state.platforms)
    unsupported=tuple(sorted(set(actor)-_support_union(platforms)))
    if unsupported and law.require_actor_support_after:return state,({'unsupported_after_transform':unsupported,'atomic_rejection':True},),()
    return state.model_copy(update={'actor_positions':actor,'tools':tuple(after if t.tool_ref==after.tool_ref else t for t in state.tools),'platforms':platforms}),(
        {'tool_mode':mode,'loaded_identity_preserved':after.loaded_ref==tool.loaded_ref,'unsupported_actor_positions':unsupported,'grants_from_pre_state':grants},),()


def _support_connection(request):
    domain=request.connection;resume=request.resume if request.resume is not None and request.resume.phase=='CONNECTION' else None
    witnesses=list(resume.witnesses) if resume is not None else [];rows=list(resume.completed_rows) if resume is not None else []
    count=resume.accounted_evaluations if resume is not None else 0;completed=resume.completed_pose_count if resume is not None else 0
    configs=tuple(sorted(domain.configurations,key=lambda c:c.configuration_ref))
    for index in range(resume.next_item if resume is not None else 0,len(configs)):
        if len(witnesses)>=domain.maximum_witnesses:
            token=_support_resume(request,'CONNECTION',next_item=index,completed_rows=tuple(rows),witnesses=tuple(witnesses),
                completed_pose_count=completed,accounted_evaluations=count)
            return family_result(request,values={'connection_witnesses':tuple(witnesses),'configuration_rows':tuple(rows),'witness_limit_reached':True},
                examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'continuation':token})
        config=configs[index];frontier=resume.route_frontier if resume is not None and index==resume.next_item else None
        work_per_pose=max(1,len(domain.actor_positions))*max(1,len(domain.movement_steps))
        overhead=sum(len(l.positions) for l in config.active_layers)
        old_tested=frontier.get('tested',0) if frontier else 0
        affordable=max(0,(request.maximum_evaluations-count-overhead)//work_per_pose)
        limit=min(domain.maximum_tested_actor_poses-completed,old_tested+affordable,request.maximum_states)
        if limit<max(1,old_tested):
            token=_support_resume(request,'CONNECTION',next_item=index,completed_rows=tuple(rows),witnesses=tuple(witnesses),
                route_frontier=frontier or {},completed_pose_count=completed,accounted_evaluations=count)
            return family_result(request,values={'connection_witnesses':tuple(witnesses),'configuration_rows':tuple(rows)},examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'continuation':token})
        out={};actions,poses,tested,bounded=_first_shortest_supported_route(actor_positions=domain.actor_positions,
            terminal_positions=domain.requested_terminal_actor_positions,support_positions=_support_union(config.active_layers),
            steps=domain.movement_steps,maximum_tested_actor_poses=limit,resume=frontier,continuation_out=out)
        count+=overhead+max(0,tested-old_tested)*work_per_pose
        if bounded:
            token=_support_resume(request,'CONNECTION',next_item=index,completed_rows=tuple(rows),witnesses=tuple(witnesses),route_frontier=out,
                completed_pose_count=completed,accounted_evaluations=count)
            return family_result(request,values={'connection_witnesses':tuple(witnesses),'configuration_rows':tuple(rows)},examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'continuation':token})
        completed+=tested;rows.append({'configuration_ref':config.configuration_ref,'tested_actor_poses':tested,'connected':bool(poses)})
        if poses:witnesses.append({'configuration_ref':config.configuration_ref,'action_refs':actions,'actor_pose_positions':poses})
    return family_result(request,values={'connection_witnesses':tuple(witnesses),'configuration_rows':tuple(rows)},examined_count=count,domain_complete=request.scope.input_domain_complete)


def _measure_reconfigurable_support(request):
    prefix='mechanics.reconfigurable_support.'
    operation=request.operation_ref[len(prefix):] if request.operation_ref.startswith(prefix) else ''
    if operation not in SUPPORT_OPERATION_MODES or request.mode not in SUPPORT_OPERATION_MODES[operation]:return family_result(request,signature_supported=False,domain_complete=False)
    fields={'support_report':('snapshots',),'rigid_geometry':('geometry',),'mode_successor':('state','command','move_laws','grants','grant_scope_ref','obstacles'),
        'permission_precondition':('state','command','grants','grant_scope_ref'),'coded_transfer':('state','code_transition'),
        'restoration_mask':('state','saved_state','restoration_fields','restoration_evidence_refs'),'inverse_connection':('connection',)}[operation]
    missing=missing_supplied_fields(request,fields)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if operation=='support_report':return _support_report_rows(request)
    if operation=='inverse_connection':return _support_connection(request)
    work=1+sum(len(t.positions)+len(t.loaded_positions) for t in request.state.tools) if request.state is not None else 1
    if request.state is not None:work+=len(request.state.actor_positions)+sum(len(p.positions) for p in request.state.platforms)
    if request.geometry is not None:work+=(len(request.geometry.before_positions)+len(request.geometry.after_positions))*(4+len(request.geometry.pivot_candidates)*3)
    if request.command is not None:work+=sum(len(m) for m in (*request.command.swept_tool_masks,*request.command.swept_loaded_masks))
    work+=sum(len(g.actor_allowed_positions or ()) for g in request.grants)+len(request.obstacles or ())
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'required_work':work})
    debt=()
    if operation=='rigid_geometry':values={'rigid_fits':measure_reconfigurable_rigid_geometry(request.geometry)}
    elif operation=='permission_precondition':
        rows,allowed=_support_permissions(request);values={'grant_rows':rows,'command_permitted_in_pre_state':allowed}
        if any(row['holds_in_pre_action_state'] is None and row['command_matches'] and row['scope_matches'] for row in rows):debt=('current_maintained_grant_predicate',)
    elif operation=='mode_successor':
        after,events,debt=_support_move(request);values={'after_state':after,'events':events}
    elif operation=='restoration_mask':
        field_map={'ACTOR':('actor_ref','actor_positions'),'TOOLS':('tools',),'PLATFORMS':('platforms',),'GRANTS':('acquired_grant_refs',),
            'RESOURCES':('resources',),'CODE':('code_ref',),'ORIENTATION':('orientation_ref',),'FRAME':('destination_frame_ref',)}
        update={name:getattr(request.saved_state,name) for tag in request.restoration_fields for name in field_map[tag]}
        values={'after_state':request.state.model_copy(update=update),'restored_fields':request.restoration_fields,'resource_refund_inferred':False}
    else:
        transition=request.code_transition;state=request.state;events=[]
        if state.code_ref!=transition.code_before_ref:return family_result(request,prerequisite_refs=('current_code_matches_bound_transition',),domain_complete=False,examined_count=work)
        for phase in transition.phase_order:
            if phase=='CODE':state=state.model_copy(update={'code_ref':transition.code_after_ref})
            elif phase=='ORIENTATION':state=state.model_copy(update={'orientation_ref':transition.orientation_after_ref})
            elif phase=='TRANSPORT':state=state.model_copy(update={'actor_positions':transition.actor_after_positions,'platforms':transition.platforms_after,'destination_frame_ref':transition.destination_frame_ref})
            elif phase=='GRANTS':state=state.model_copy(update={'acquired_grant_refs':transition.grants_after})
            else:
                if state.resources+transition.resource_delta<0:return family_result(request,prerequisite_refs=('sufficient_resources_at_declared_phase',),domain_complete=False,examined_count=work)
                state=state.model_copy(update={'resources':state.resources+transition.resource_delta})
            events.append({'phase':phase,'state':state,'unsupported_actor_positions':tuple(sorted(set(state.actor_positions)-_support_union(state.platforms)))})
        values={'after_state':state,'ordered_phase_snapshots':tuple(events)}
    return family_result(request,values=values,prerequisite_refs=debt,examined_count=work,domain_complete=not debt)


def measure_reconfigurable_support(request: SupportRequest) -> MechanicalFamilyResult:
    if request.resume is not None and request.resume.input_digest!=_support_digest(request):return family_result(request,prerequisite_refs=('same_source_scope_revision_and_support_inputs',),domain_complete=False)
    result=_measure_reconfigurable_support(request)
    if result.computation_bound_reached and 'continuation' not in result.frontier:
        result=result.model_copy(update={'frontier':immutable_json_data({**dict(result.frontier),'continuation':_support_resume(request,'UNSTARTED')})})
    return result
