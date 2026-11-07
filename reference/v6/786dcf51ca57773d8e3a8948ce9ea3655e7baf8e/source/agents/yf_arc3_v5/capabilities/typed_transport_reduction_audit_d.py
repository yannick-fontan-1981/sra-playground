"""Separate force/walk/landing channels and ordered typed jump continuations."""
from __future__ import annotations
from typing import ClassVar,Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref,stable_digest
from .ray_capture_domain_d import CaptureBodyD
from .mechanical_family_contracts_d import DMechanicalRequest,DWorkBudget,DComputationInterrupted,d_validate_request,d_result


class LoadPropagationCaseD(FrozenModel):
    case_ref: Ref
    provider_ref: Ref
    provider_origin: tuple[int,int]
    load_ref: Ref
    direction: tuple[int,int]
    emitter_phase: int
    permitted_emitter_phases: tuple[int,...]
    contact_points: tuple[tuple[int,int],...]
    force_passage_points: tuple[tuple[int,int],...]
    final_landing_points: tuple[tuple[int,int],...]
    ordinary_walk_admitted: bool|None
    continuation_rule: Literal['UNTIL_FIRST_BLOCK','BOUNDED_RANGE']
    maximum_distance: int|None=Field(default=None,ge=1)
    stop_at_supported_landing: bool
    ignore_provider_collision_supported: bool
    law_evidence_ref: Ref|None


class ForceTransportBaseD(DMechanicalRequest):
    phase_ref: Literal['PROJECTED_LOAD_TRANSIT_AND_STOPS']
    bodies: tuple[CaptureBodyD,...]=Field(min_length=1,max_length=128)
    cases: tuple[LoadPropagationCaseD,...]=Field(min_length=1,max_length=128)
    board_points: tuple[tuple[int,int],...]=Field(min_length=1,max_length=4096)
    fixed_blocked_points: tuple[tuple[int,int],...]=Field(default=(),max_length=4096)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=()

    @model_validator(mode='after')
    def fixed_provider_load_scope(self):
        ids={b.member_ref for b in self.bodies}
        if len(ids)!=len(self.bodies) or any(c.provider_ref not in ids or c.load_ref not in ids or c.direction==(0,0) for c in self.cases):
            raise ValueError('transport provider/load/direction unbound')
        return self


class ForceVsMotionDomainRequestD(ForceTransportBaseD):
    schema_version: Ref='yf_arc3_v5.force_vs_motion_domain_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.transport_service_chain.force_vs_motion_domain','AUDIT'),)


class VariableTransportStopRequestD(ForceTransportBaseD):
    schema_version: Ref='yf_arc3_v5.variable_transport_stop_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.transport_service_chain.variable_stop','AUDIT'),)


def _transport_body_points(body,origin=None):
    position=body.origin if origin is None else origin
    return {(position[0]+x,position[1]+y) for x,y in body.occupied_offsets}


def measure_force_transport_audit_d(request: ForceTransportBaseD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        bodies={b.member_ref:b for b in request.bodies}
        rows=[];unresolved=False
        for case in request.cases:
            load=bodies[case.load_ref]
            if bodies[case.provider_ref].origin!=case.provider_origin or case.law_evidence_ref is None:
                unresolved=True;rows.append({'case_ref':case.case_ref,'unknown':'PROVIDER_POSE_OR_FORCE_LAW'});continue
            triggered=case.emitter_phase in case.permitted_emitter_phases and bool(_transport_body_points(load)&set(case.contact_points))
            blocked=set(request.fixed_blocked_points)
            for ref,body in sorted(bodies.items()):
                if ref==case.load_ref or ref==case.provider_ref and case.ignore_provider_collision_supported:continue
                blocked.update(_transport_body_points(body))
            stops=[];prefix=[];closed=False
            if triggered:
                for distance in range(1,request.depth_bound+1):
                    if case.maximum_distance is not None and distance>case.maximum_distance:closed=True;break
                    origin=tuple(load.origin[i]+distance*case.direction[i] for i in (0,1))
                    footprint=_transport_body_points(load,origin)
                    for point in sorted(footprint):budget.visit({'stage':'complete_force_footprint','case_ref':case.case_ref,'distance':distance,'point':point})
                    passage=footprint<=set(request.board_points) and footprint<=set(case.force_passage_points) and not footprint&blocked
                    if not passage:closed=True;break
                    prefix.append(origin)
                    landing=footprint<=set(case.final_landing_points)
                    if landing:
                        if len(stops)>=request.domain_bound:raise DComputationInterrupted('SUPPORTED_STOP_DOMAIN_BOUND',{})
                        stops.append({'origin':origin,'distance':distance,'full_landing_footprint':tuple(sorted(footprint))})
                        if case.stop_at_supported_landing:closed=True;break
                if not closed and not (case.maximum_distance is not None and request.depth_bound>=case.maximum_distance):
                    raise DComputationInterrupted('FORCE_CONTINUATION_DEPTH_BOUND',{'case_ref':case.case_ref,'transit_prefix':tuple(prefix)})
            rows.append({'case_ref':case.case_ref,'provider_ref':case.provider_ref,'provider_origin_unchanged':case.provider_origin,
                'load_ref':case.load_ref,'ordinary_walk_admitted':case.ordinary_walk_admitted,'force_contact_triggered':triggered,
                'emitter_phase':case.emitter_phase,'transit_prefix':tuple(prefix),'supported_stop_domain':tuple(stops),
                'fixed_launch_distance_assumed':False})
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if unresolved else 'COMPLETE','SEPARATE_LOAD_CHANNELS_AND_VARIABLE_STOPS',complete=not unresolved,
            examined=budget.examined,values={'case_rows':tuple(rows),'provider_displaced_by_load_only_force':False},
            descriptive_delta={'has_supported_load_stop':any(r.get('supported_stop_domain') for r in rows),
                'has_force_transit_distinct_from_walk':any(r.get('force_contact_triggered') and r.get('ordinary_walk_admitted') is False for r in rows)})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_scoped_force_cases':True,'work':error.frontier})


class OrderedJumpRuleD(FrozenModel):
    rule_ref: Ref
    source_type_ref: Ref
    intermediate_type_ref: Ref
    landing_type_ref: Ref
    intermediate_delta: tuple[int,int]
    landing_delta: tuple[int,int]
    remove_intermediate: bool
    resulting_source_type_ref: Ref
    law_evidence_ref: Ref


class TypedJumpInputD(FrozenModel):
    actor_ref: Ref
    rule_ref: Ref


class TypedReductionWitnessD(FrozenModel):
    witness_ref: Ref
    initial_population_digest: Ref
    epoch: int=Field(ge=0)
    model_revision_ref: Ref
    steps: tuple[TypedJumpInputD,...]=Field(min_length=1,max_length=4096)
    witness_evidence_ref: Ref|None


class IndependentSelectionRetentionD(FrozenModel):
    receipt_ref: Ref
    jumper_ref: Ref
    independently_controlled_ref: Ref
    focus_before_ref: Ref
    focus_after_ref: Ref
    sealed: bool
    epoch: int=Field(ge=0)
    model_revision_ref: Ref
    actual_control_evidence_ref: Ref|None


class PersistentHelperClearanceD(FrozenModel):
    helper_ref: Ref
    requested_landing_footprint: tuple[tuple[int,int],...]
    admitted_withdrawal_origins: tuple[tuple[int,int],...]
    persistent_helper_evidence_ref: Ref|None
    withdrawal_effect_evidence_ref: Ref|None


class TypedReductionBaseD(DMechanicalRequest):
    phase_ref: Literal['ORDERED_CURRENT_JUMP_AND_CONTINUATION_AUDIT']
    population: tuple[CaptureBodyD,...]=Field(min_length=1,max_length=128)
    rules: tuple[OrderedJumpRuleD,...]=Field(min_length=1,max_length=128)
    landing_surface_types: tuple[tuple[tuple[int,int],Ref],...]=Field(min_length=1,max_length=4096)
    current_jump: TypedJumpInputD
    native_focus_ref: Ref
    continuations: tuple[TypedReductionWitnessD,...]=Field(default=(),max_length=3)
    retention_observations: tuple[IndependentSelectionRetentionD,...]=Field(default=(),max_length=128)
    helper_clearances: tuple[PersistentHelperClearanceD,...]=Field(default=(),max_length=128)
    declared_remaining_count: int=Field(ge=1)
    required_survivor_type_refs: tuple[Ref,...]|None
    required_survivor_origins: tuple[tuple[int,int],...]|None

    @model_validator(mode='after')
    def exact_ordered_domain(self):
        ids={b.member_ref for b in self.population}
        if len(ids)!=len(self.population) or self.native_focus_ref not in ids or len({r.rule_ref for r in self.rules})!=len(self.rules):
            raise ValueError('persistent population/focus/rule identity invalid')
        if len(dict(self.landing_surface_types))!=len(self.landing_surface_types):raise ValueError('landing surface type duplicated')
        return self


class OrderedReductionTypesRequestD(TypedReductionBaseD):
    schema_version: Ref='yf_arc3_v5.ordered_reduction_types_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.typed_reduction_logistics.ordered_types','AUDIT'),)


class SelectedJumpReconfigurationRequestD(TypedReductionBaseD):
    schema_version: Ref='yf_arc3_v5.selected_jump_reconfiguration_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.typed_reduction_logistics.selected_jump_reconfiguration','AUDIT'),)


class PersistentHelperClearanceRequestD(TypedReductionBaseD):
    schema_version: Ref='yf_arc3_v5.persistent_helper_clearance_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.typed_reduction_logistics.persistent_helper_clearance','AUDIT'),)


class ContinuedSolvabilityRequestD(TypedReductionBaseD):
    schema_version: Ref='yf_arc3_v5.continued_solvability_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.typed_reduction_logistics.continued_solvability','AUDIT'),)


def _typed_jump_successor(population,step,request,budget):
    bodies={b.member_ref:b for b in population}
    actor=bodies.get(step.actor_ref)
    rule=next((r for r in request.rules if r.rule_ref==step.rule_ref),None)
    if actor is None or rule is None:return None,{'cause':'SOURCE_OR_RULE_MISSING'}
    middle=tuple(actor.origin[i]+rule.intermediate_delta[i] for i in (0,1))
    landing=tuple(actor.origin[i]+rule.landing_delta[i] for i in (0,1))
    intermediates=[b for b in population if b.member_ref!=actor.member_ref and middle in _transport_body_points(b)]
    if len(intermediates)!=1:return None,{'cause':'INTERMEDIATE_OCCURRENCE_NOT_UNIQUE'}
    intermediate=intermediates[0]
    surface=dict(request.landing_surface_types)
    footprint=_transport_body_points(actor,landing)
    for point in sorted(footprint):budget.visit({'stage':'ordered_jump_landing','point':point})
    if actor.type_ref!=rule.source_type_ref or intermediate.type_ref!=rule.intermediate_type_ref or any(surface.get(p)!=rule.landing_type_ref for p in footprint):
        return None,{'cause':'ORDERED_SOURCE_INTERMEDIATE_LANDING_TYPE'}
    blockers={p for b in population if b.member_ref!=actor.member_ref and not (rule.remove_intermediate and b.member_ref==intermediate.member_ref) for p in _transport_body_points(b)}
    if footprint&blockers:return None,{'cause':'FULL_LANDING_OCCUPANCY','blocking_points':tuple(sorted(footprint&blockers))}
    moved=actor.model_copy(update={'origin':landing,'type_ref':rule.resulting_source_type_ref})
    after=tuple(moved if b.member_ref==actor.member_ref else b for b in population if not (rule.remove_intermediate and b.member_ref==intermediate.member_ref))
    return after,{'actor_ref':actor.member_ref,'intermediate_ref':intermediate.member_ref,'rule_ref':rule.rule_ref,
        'law_evidence_ref':rule.law_evidence_ref,'landing':landing,'intermediate_removed':rule.remove_intermediate}


def measure_typed_reduction_audit_d(request: TypedReductionBaseD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        after,event=_typed_jump_successor(request.population,request.current_jump,request,budget)
        continued=[]
        if after is not None:
            digest=stable_digest(after)
            for witness in request.continuations:
                if witness.initial_population_digest!=digest or witness.epoch!=request.scope.epoch or witness.model_revision_ref!=request.scope.model_revision_ref or witness.witness_evidence_ref is None:continue
                if len(witness.steps)>request.depth_bound:raise DComputationInterrupted('REDUCTION_WITNESS_DEPTH_BOUND',{})
                current=after;events=[]
                for step in witness.steps:
                    current,delta=_typed_jump_successor(current,step,request,budget)
                    events.append(delta)
                    if current is None:break
                valid=current is not None and len(current)==request.declared_remaining_count
                if valid and request.required_survivor_type_refs is not None:valid=sorted(b.type_ref for b in current)==sorted(request.required_survivor_type_refs)
                if valid and request.required_survivor_origins is not None:valid=sorted(b.origin for b in current)==sorted(request.required_survivor_origins)
                continued.append({'witness_ref':witness.witness_ref,'supported_declared_continuation':valid,'events':tuple(events),
                    'terminal_population':current,'same_parent_scope_preserved':True})
        retention=tuple(r.receipt_ref for r in request.retention_observations if r.sealed and r.epoch==request.scope.epoch and
            r.model_revision_ref==request.scope.model_revision_ref and r.actual_control_evidence_ref and r.jumper_ref==request.current_jump.actor_ref and
            r.independently_controlled_ref!=r.jumper_ref and r.focus_before_ref==r.focus_after_ref==r.jumper_ref)
        bodies={b.member_ref:b for b in request.population}
        withdrawals=[]
        for case in request.helper_clearances:
            helper=bodies.get(case.helper_ref)
            if helper is None or case.persistent_helper_evidence_ref is None or not _transport_body_points(helper)&set(case.requested_landing_footprint):continue
            blocked={p for b in request.population if b.member_ref!=helper.member_ref for p in _transport_body_points(b)}
            for origin in case.admitted_withdrawal_origins:
                footprint=_transport_body_points(helper,origin)
                budget.visit({'stage':'persistent_helper_withdrawal','helper_ref':helper.member_ref,'origin':origin})
                if case.withdrawal_effect_evidence_ref and not footprint&blocked and not footprint&set(case.requested_landing_footprint):
                    withdrawals.append({'helper_ref':helper.member_ref,'withdrawal_origin':origin,'helper_eliminated':False,
                        'persistent_evidence_ref':case.persistent_helper_evidence_ref,'withdrawal_evidence_ref':case.withdrawal_effect_evidence_ref})
        budget.finish()
        return d_result(request,'COMPLETE','ORDERED_TYPED_REDUCTION_AND_SCOPE',complete=True,examined=budget.examined,values={
            'current_jump_admitted':after is not None,'current_jump_event_or_refusal':event,'successor_population':after,
            'continuation_rows':tuple(continued),'selection_retention_receipt_refs':retention,'persistent_helper_withdrawals':tuple(withdrawals),
            'reversed_participants_assumed_legal':False,'isolated_removal_implies_solvability':False},descriptive_delta={
                'has_ordered_admitted_jump':after is not None,'has_evidenced_selection_retention':bool(retention),
                'has_persistent_helper_withdrawal':bool(withdrawals),'has_supported_remaining_population_continuation':any(r['supported_declared_continuation'] for r in continued)})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_typed_reduction_audit':True,'work':error.frontier})
