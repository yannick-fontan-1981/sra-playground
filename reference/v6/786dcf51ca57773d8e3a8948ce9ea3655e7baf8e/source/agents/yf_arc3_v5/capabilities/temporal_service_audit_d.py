"""Bounded command tapes and current-world replay, separate from animation frames."""
from __future__ import annotations
from itertools import product
from time import monotonic
from typing import ClassVar,Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref
from .mechanical_family_contracts_d import DMechanicalRequest,DMechanicalResult,DWorkBudget,DComputationInterrupted,d_validate_request,d_result,d_map


class RecordedTapeD(FrozenModel):
    tape_ref: Ref
    input_refs: tuple[Ref,...]=Field(default=(),max_length=4096)
    capacity: int=Field(ge=0,le=4096)
    acknowledgment_rule: Literal['ACKNOWLEDGED_ONLY','ALL_ATTEMPTS']


class ReplayInstanceD(FrozenModel):
    instance_ref: Ref
    position: tuple[int,int]
    tape_ref: Ref|None
    read_index: int=Field(ge=0)
    input_displacements: tuple[tuple[Ref,tuple[int,int]],...]=Field(default=(),max_length=128)
    consumed_blocked_input: bool
    exhausted_tape_law: Literal['HOLD','LOOP','DISAPPEAR','UNKNOWN']
    active: bool


class CommandClockLawD(FrozenModel):
    input_ref: Ref
    accepted_ticks: int=Field(ge=0)
    blocked_ticks: int=Field(ge=0)
    evidence_ref: Ref|None


class RecordedServicePredicateD(FrozenModel):
    predicate_ref: Ref
    consumer_ref: Ref
    instance_ref: Ref
    position: tuple[int,int]
    first_tick: int=Field(ge=0)
    last_tick: int=Field(ge=0)
    effect: Literal['HOLD','LATCH','TRANSFER']


class ReplayGateD(FrozenModel):
    position: tuple[int,int]
    required_latch_predicate_refs: tuple[Ref,...]


class TemporalRecordingKernelRequestD(DMechanicalRequest):
    schema_version: Ref='yf_arc3_v5.temporal_recording_kernel_request_d.v1'
    phase_ref: Literal['BOUNDED_RECORD_COMMIT_OR_REPLAY']
    tapes: tuple[RecordedTapeD,...]=Field(default=(),max_length=128)
    instances: tuple[ReplayInstanceD,...]=Field(default=(),max_length=128)
    native_instance_order: tuple[Ref,...]=Field(default=(),max_length=128)
    admitted_positions: tuple[tuple[int,int],...]=Field(default=(),max_length=4096)
    blocked_positions: tuple[tuple[int,int],...]=Field(default=(),max_length=4096)
    gates: tuple[ReplayGateD,...]=Field(default=(),max_length=128)
    world_tick: int=Field(ge=0)
    clock_laws: tuple[CommandClockLawD,...]=Field(default=(),max_length=128)
    bound_input_ref: Ref|None
    bound_input_acknowledged: bool|None
    bound_input_accepted: bool|None
    bound_tape_ref: Ref|None
    replay_opportunities: int=Field(ge=0,le=4096)
    replay_ticks_per_opportunity: int=Field(ge=0)
    replay_on_zero_clock_supported: bool
    commit_retained_tape_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    commit_reset_positions: tuple[tuple[Ref,tuple[int,int]],...]=Field(default=(),max_length=128)
    commit_reset_read_indices: tuple[tuple[Ref,int],...]=Field(default=(),max_length=128)
    commit_reset_tick: int|None=Field(default=None,ge=0)
    latched_predicate_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    service_predicates: tuple[RecordedServicePredicateD,...]=Field(default=(),max_length=128)
    autonomous_displacements_by_tick: tuple[tuple[Ref,int,tuple[int,int]],...]=Field(default=(),max_length=4096)
    preparation_command_cost: int=Field(ge=0)
    commit_command_cost: int=Field(ge=0)
    replay_player_command_cost: int=Field(ge=0)
    recovery_command_cost: int=Field(ge=0)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(
        ('mechanics.temporal_recording_replay','RECORD'),('mechanics.temporal_recording_replay','COMMIT'),('mechanics.temporal_recording_replay','REPLAY'))

    @model_validator(mode='after')
    def exact_tape_instance_scope(self):
        tapes={t.tape_ref:t for t in self.tapes};ids={a.instance_ref for a in self.instances}
        if len(tapes)!=len(self.tapes) or len(ids)!=len(self.instances) or set(self.native_instance_order)!=ids or len(self.native_instance_order)!=len(ids):
            raise ValueError('tape/instance identity or native ordering duplicated')
        if any(a.tape_ref is not None and a.tape_ref not in tapes for a in self.instances) or any(len(t.input_refs)>t.capacity for t in self.tapes):
            raise ValueError('instance tape/capacity scope invalid')
        if any(len(dict(a.input_displacements))!=len(a.input_displacements) for a in self.instances):raise ValueError('per-instance input mapping duplicated')
        if len({c.input_ref for c in self.clock_laws})!=len(self.clock_laws):raise ValueError('command clock law duplicated')
        return self


def measure_temporal_recording_kernel_d(request: TemporalRecordingKernelRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        tapes={t.tape_ref:t for t in request.tapes};instances={a.instance_ref:a for a in request.instances}
        tick=request.world_tick;events=[];latched=set(request.latched_predicate_refs);accepted=True
        if request.mode_ref=='RECORD':
            tape=tapes.get(request.bound_tape_ref)
            if tape is None or request.bound_input_ref is None or request.bound_input_acknowledged is None or request.bound_input_accepted is None:
                return d_result(request,'NEEDS_EVIDENCE','ACTUAL_RECORDING_INPUT_AND_ACKNOWLEDGMENT_REQUIRED')
            law=next((c for c in request.clock_laws if c.input_ref==request.bound_input_ref),None)
            if law is None or law.evidence_ref is None:return d_result(request,'NEEDS_EVIDENCE','DEMONSTRATED_COMMAND_CLOCK_REQUIRED')
            budget.visit({'stage':'native_buffer_record'})
            records=tape.acknowledgment_rule=='ALL_ATTEMPTS' or request.bound_input_acknowledged
            if records:
                accepted=len(tape.input_refs)<tape.capacity
                if accepted:tapes[tape.tape_ref]=tape.model_copy(update={'input_refs':tape.input_refs+(request.bound_input_ref,)})
            tick+=law.accepted_ticks if request.bound_input_accepted else law.blocked_ticks
            events.append({'cause':'IN_WORLD_INPUT_BUFFER','input_ref':request.bound_input_ref,'recorded':records and accepted,
                'acknowledged':request.bound_input_acknowledged,'native_accepted':request.bound_input_accepted,'tick':tick})
        elif request.mode_ref=='COMMIT':
            for ref in tuple(tapes):
                budget.visit({'stage':'phase_specific_tape_retention','tape_ref':ref})
                if ref not in request.commit_retained_tape_refs:tapes[ref]=tapes[ref].model_copy(update={'input_refs':()})
            for ref,position in request.commit_reset_positions:
                if ref not in instances:return d_result(request,'NEEDS_EVIDENCE','COMMIT_RESET_INSTANCE_UNKNOWN')
                instances[ref]=instances[ref].model_copy(update={'position':position})
            for ref,index in request.commit_reset_read_indices:
                if ref not in instances or index<0:return d_result(request,'NEEDS_EVIDENCE','COMMIT_READ_INDEX_UNKNOWN')
                instances[ref]=instances[ref].model_copy(update={'read_index':index})
            if request.commit_reset_tick is not None:tick=request.commit_reset_tick
            events.append({'cause':'EXPLICIT_RETENTION_AND_GEOMETRY_RESET_MASK','retained_tape_refs':request.commit_retained_tape_refs})
        else:
            if request.replay_opportunities>request.depth_bound:raise DComputationInterrupted('REPLAY_OPPORTUNITY_BOUND',{})
            if request.replay_ticks_per_opportunity==0 and not request.replay_on_zero_clock_supported:
                return d_result(request,'NEEDS_EVIDENCE','ZERO_CLOCK_REPLAY_NOT_SUPPORTED')
            for opportunity in range(request.replay_opportunities):
                tick+=request.replay_ticks_per_opportunity
                for ref in request.native_instance_order:
                    budget.visit({'stage':'identity_owned_replay_opportunity','instance_ref':ref,'opportunity':opportunity})
                    actor=instances[ref]
                    if not actor.active:continue
                    if actor.tape_ref is None:
                        delta=next((d for a,t,d in request.autonomous_displacements_by_tick if (a,t)==(ref,tick)),None)
                        if delta is None:continue
                        input_ref=None;next_index=actor.read_index
                    else:
                        tape=tapes[actor.tape_ref]
                        index=actor.read_index
                        if index>=len(tape.input_refs):
                            if actor.exhausted_tape_law=='UNKNOWN':return d_result(request,'NEEDS_EVIDENCE','EXHAUSTED_TAPE_BEHAVIOR_UNKNOWN')
                            if actor.exhausted_tape_law=='DISAPPEAR':instances[ref]=actor.model_copy(update={'active':False});continue
                            if actor.exhausted_tape_law=='HOLD' or not tape.input_refs:continue
                            index=0
                        input_ref=tape.input_refs[index]
                        delta=dict(actor.input_displacements).get(input_ref)
                        if delta is None:return d_result(request,'NEEDS_EVIDENCE','INSTANCE_SPECIFIC_REPLAY_INPUT_MAP_UNKNOWN')
                        next_index=index+1
                    destination=tuple(actor.position[i]+delta[i] for i in (0,1))
                    gates=[g for g in request.gates if g.position==destination]
                    admitted=destination in request.admitted_positions and destination not in request.blocked_positions and all(
                        set(g.required_latch_predicate_refs)<=latched for g in gates)
                    instances[ref]=actor.model_copy(update={'position':destination if admitted else actor.position,
                        'read_index':next_index if admitted or actor.consumed_blocked_input else actor.read_index})
                    events.append({'cause':'CURRENT_WORLD_COMMAND_REPLAY','instance_ref':ref,'input_ref':input_ref,'tick':tick,
                        'accepted':admitted,'from_position':actor.position,'to_position':instances[ref].position,'tape_read_index':instances[ref].read_index})
                    for predicate in request.service_predicates:
                        if predicate.instance_ref==ref and predicate.first_tick<=tick<=predicate.last_tick and instances[ref].position==predicate.position:
                            events.append({'cause':'INTERNAL_SERVICE_PREDICATE','predicate_ref':predicate.predicate_ref,'consumer_ref':predicate.consumer_ref,
                                'instance_ref':ref,'effect':predicate.effect,'tick':tick})
                            if predicate.effect=='LATCH':latched.add(predicate.predicate_ref)
                # Endpoint-holding instances still serve predicates without inventing input/tape motion.
                for predicate in request.service_predicates:
                    actor=instances.get(predicate.instance_ref)
                    if actor and actor.active and actor.position==predicate.position and predicate.first_tick<=tick<=predicate.last_tick and not any(
                            e.get('predicate_ref')==predicate.predicate_ref and e.get('tick')==tick for e in events):
                        events.append({'cause':'INTERNAL_SERVICE_PREDICATE','predicate_ref':predicate.predicate_ref,'consumer_ref':predicate.consumer_ref,
                            'instance_ref':predicate.instance_ref,'effect':predicate.effect,'tick':tick})
                        if predicate.effect=='LATCH':latched.add(predicate.predicate_ref)
        budget.finish()
        return d_result(request,'COMPLETE','BOUNDED_TAPE_AND_CURRENT_WORLD_TIMELINE',complete=True,examined=budget.examined,values={
            'tapes':tuple(t for _,t in sorted(tapes.items())),'instances':tuple(instances[r] for r in request.native_instance_order),
            'world_tick':tick,'events':tuple(events),'latched_predicate_refs':tuple(sorted(latched)),'accepted':accepted,
            'external_command_cost':request.preparation_command_cost+request.commit_command_cost+request.replay_player_command_cost+request.recovery_command_cost,
            'replay_motion_counted_as_extra_player_input':False,'absolute_historical_positions_replayed':False,'animation_frames_used_as_clock':False})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_bounded_tape_simulation':True,'work':error.frontier})


class TemporalProviderEvidenceD(FrozenModel):
    provider_ref: Ref
    kind: Literal['LIVE_CONTROL','STORED_ROUTE','LATCHED_STATE','AUTONOMOUS_COOPERATION']
    capability_evidence_ref: Ref|None
    timing_evidence_ref: Ref|None
    service_predicate_refs: tuple[Ref,...]
    supported_intervals: tuple[tuple[Ref,int,int],...]
    endpoint_only: bool


class TemporalServiceBaseD(DMechanicalRequest):
    phase_ref: Literal['CURRENT_TEMPORAL_SERVICE_AND_RECORDING_GUARD']
    actual_provider_ref: Ref|None
    providers: tuple[TemporalProviderEvidenceD,...]=Field(min_length=1,max_length=128)
    required_services: tuple[RecordedServicePredicateD,...]=Field(min_length=1,max_length=128)
    command_clock_laws: tuple[CommandClockLawD,...]=Field(min_length=1,max_length=128)
    current_input_ref: Ref|None
    current_input_accepted: bool|None
    recording_guard_evidence_ref: Ref|None
    bounded_recording_request: TemporalRecordingKernelRequestD|None
    reset_scope_evidence_ref: Ref|None


class RecordingObligationRequestD(TemporalServiceBaseD):
    schema_version: Ref='yf_arc3_v5.recording_obligation_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.temporal_service_program.recording_obligation','AUDIT'),)


class BoundedCommandClockRequestD(TemporalServiceBaseD):
    schema_version: Ref='yf_arc3_v5.bounded_command_clock_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.temporal_service_program.bounded_clock','AUDIT'),)


class TemporalProviderSelectionRequestD(TemporalServiceBaseD):
    schema_version: Ref='yf_arc3_v5.temporal_provider_selection_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.temporal_service_program.provider_selection','AUDIT'),)


class GuardedRecordingCallRequestD(TemporalServiceBaseD):
    schema_version: Ref='yf_arc3_v5.guarded_recording_call_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.temporal_service_program.recording_call','AUDIT'),)


def measure_temporal_service_audit_d(request: TemporalServiceBaseD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        rows=[]
        for provider in request.providers:
            budget.visit({'stage':'capability_and_full_service_interval','provider_ref':provider.provider_ref})
            missing=[]
            for service in request.required_services:
                covered=any(ref==service.predicate_ref and first<=service.first_tick and last>=service.last_tick for ref,first,last in provider.supported_intervals)
                if service.predicate_ref not in provider.service_predicate_refs or not covered or provider.endpoint_only and service.effect!='TRANSFER':missing.append(service.predicate_ref)
            qualified=provider.capability_evidence_ref is not None and provider.timing_evidence_ref is not None and not missing
            rows.append({'provider_ref':provider.provider_ref,'kind':provider.kind,'full_service_supported':qualified,
                'missing_predicate_refs':tuple(missing),'endpoint_only':provider.endpoint_only})
        service_domains=[]
        for service in request.required_services:
            candidates=tuple(p.provider_ref for p in request.providers if p.capability_evidence_ref and p.timing_evidence_ref and
                service.predicate_ref in p.service_predicate_refs and not (p.endpoint_only and service.effect!='TRANSFER') and any(
                    ref==service.predicate_ref and first<=service.first_tick and last>=service.last_tick for ref,first,last in p.supported_intervals))
            service_domains.append(candidates)
        cardinality=1
        for domain in service_domains:cardinality*=len(domain)
        if cardinality>request.domain_bound:raise DComputationInterrupted('TEMPORAL_PROVIDER_ASSIGNMENT_BOUND',{})
        allocations=[]
        for assignment in product(*service_domains):
            budget.visit({'stage':'joint_temporal_provider_allocation'})
            if len(allocations)<3:allocations.append(tuple((s.predicate_ref,p) for s,p in zip(request.required_services,assignment)))
        actual=next((p for p in request.providers if p.provider_ref==request.actual_provider_ref),None)
        recorded=actual is not None and actual.kind=='STORED_ROUTE'
        clock=next((c for c in request.command_clock_laws if c.input_ref==request.current_input_ref),None)
        ticks=None if clock is None or clock.evidence_ref is None or request.current_input_accepted is None else (
            clock.accepted_ticks if request.current_input_accepted else clock.blocked_ticks)
        # K14 answers the remaining replay/service question; requiring its whole
        # result before invoking it would create a circular prerequisite.
        guard=recorded and actual.capability_evidence_ref is not None and actual.timing_evidence_ref is not None and request.recording_guard_evidence_ref is not None and request.bounded_recording_request is not None
        if guard and request.bounded_recording_request.scope!=request.scope:guard=False
        if guard and (budget.examined>=request.node_bound or request.time_bound_ms-(monotonic()-budget.started)*1000<1):
            return d_result(request,'BUDGET_REACHED','RECORDING_CALL_SHARED_BUDGET_EXHAUSTED',examined=budget.examined,
                frontier={'restart_temporal_service_audit':True,'recording_guard_remains_supported':True})
        budget.finish()
        return d_result(request,'COMPLETE','DECLARED_TEMPORAL_PROVIDER_AND_CLOCK_EVIDENCE',complete=True,examined=budget.examined,values={
            'provider_rows':tuple(rows),'service_allocation_witnesses':tuple(allocations),'actual_provider_ref':request.actual_provider_ref,
            'recorded_provider_service_obligations':request.required_services if recorded else (),
            'demonstrated_input_clock_ticks':ticks,'reset_scope_evidence_ref':request.reset_scope_evidence_ref,
            'audit_calculation_ms':(monotonic()-budget.started)*1000,
            'animation_frame_clock_assumed':False,'recording_imposed_on_other_provider_kinds':False},descriptive_delta={
                'actual_provider_is_recorded':recorded,'has_full_service_provider':any(r['full_service_supported'] for r in rows),
                'has_qualified_service_allocation':bool(allocations),
                'demonstrated_clock_and_reset_scope_bound':ticks is not None and request.reset_scope_evidence_ref is not None,
                'recording_call_guard_satisfied':guard})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_temporal_service_audit':True,'work':error.frontier})


class TemporalBoundRecordingInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.temporal_bound_recording_input_d.v1'
    request: GuardedRecordingCallRequestD
    audit: DMechanicalResult


def temporal_recording_bound_request(value: TemporalBoundRecordingInputD):
    request=value.request
    if request.bounded_recording_request is None:raise ValueError('SRC recording guard must precede exact K14 request binding')
    if value.audit.scope!=request.scope:raise ValueError('recording budget cannot bind a foreign audit')
    nodes=request.node_bound-value.audit.examined_count
    milliseconds=int(request.time_bound_ms-value.audit.values.get('audit_calculation_ms',0))
    if min(nodes,milliseconds)<1:raise ValueError('SRC recording operation requires a remaining shared computation budget')
    return request.bounded_recording_request.model_copy(update={'node_bound':min(nodes,request.bounded_recording_request.node_bound),
        'time_bound_ms':min(milliseconds,request.bounded_recording_request.time_bound_ms)})


class TemporalRecordingJoinInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.temporal_recording_join_input_d.v1'
    audit: DMechanicalResult
    kernel: DMechanicalResult


def temporal_recording_join_d(request: TemporalRecordingJoinInputD):
    if request.audit.scope!=request.kernel.scope:raise ValueError('recording result cannot replace another service parent')
    receipt=d_result(request.audit,request.kernel.status,request.kernel.cause,
        complete=request.kernel.domain_complete,examined=request.audit.examined_count+request.kernel.examined_count,
        values={'service_audit':request.audit.values,'recording_kernel':request.kernel.values},frontier=request.kernel.frontier)
    return receipt.model_copy(update={'source_disposition_ref':request.audit.source_disposition_ref,'source_policy_ref':request.audit.source_policy_ref})
