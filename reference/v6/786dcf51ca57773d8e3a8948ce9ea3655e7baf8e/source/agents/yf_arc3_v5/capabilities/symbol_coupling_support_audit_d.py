"""Current scoped event words preserve latch identity and joint support obligations."""
from __future__ import annotations
from typing import ClassVar,Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref
from .mechanical_family_contracts_d import DMechanicalRequest,DWorkBudget,DComputationInterrupted,d_validate_request,d_result


class SymbolAspectD(FrozenModel):
    aspect_ref: Ref
    value_ref: Ref


class ObservedMapCellD(FrozenModel):
    position: tuple[int,int]
    observed_revision_ref: Ref
    first_visible_evidence_ref: Ref
    traversable: bool|None
    partly_visible: bool
    revalidation_evidence_ref: Ref|None
    provider_refs: tuple[Ref,...]


class LatchedConsumerD(FrozenModel):
    consumer_ref: Ref
    required_aspects: tuple[SymbolAspectD,...]
    acquisition_evidence_ref: Ref|None
    acquired: bool
    restore_preserves_acquisition: bool|None
    persistence_evidence_ref: Ref|None


class MovingStationD(FrozenModel):
    station_ref: Ref
    cyclic_positions: tuple[tuple[int,int],...]=Field(min_length=1,max_length=4096)
    current_index: int=Field(ge=0)
    advance_period: int=Field(ge=1)
    clock_phase: int=Field(ge=0)
    consumer_ref: Ref
    rearm_law: Literal['LEAVE_CONTACT','SIGNATURE_CHANGE','NEVER']
    initially_armed: bool
    movement_evidence_ref: Ref|None


class SymbolWordStepD(FrozenModel):
    step_ref: Ref
    epoch: int=Field(ge=0)
    model_revision_ref: Ref
    before_position: tuple[int,int]
    after_position: tuple[int,int]
    before_aspects: tuple[SymbolAspectD,...]
    after_aspects: tuple[SymbolAspectD,...]
    native_input_ref: Ref
    clock_ticks: int=Field(ge=0)
    command_cost: int=Field(ge=0)
    movement_debit: int=Field(ge=0)
    refill_amount: int=Field(ge=0)
    refill_evidence_ref: Ref|None
    contacted_consumer_refs: tuple[Ref,...]
    contact_evidence_refs: tuple[Ref,...]
    actual_restoration: bool
    complete_response_evidence_ref: Ref|None
    preservation_satisfied: bool|None


class SymbolRouteWordD(FrozenModel):
    word_ref: Ref
    steps: tuple[SymbolWordStepD,...]=Field(default=(),max_length=4096)


class SymbolRouteBaseD(DMechanicalRequest):
    phase_ref: Literal['CURRENT_SYMBOL_CONSUMER_ROUTE_WORDS']
    current_position: tuple[int,int]
    current_aspects: tuple[SymbolAspectD,...]
    remaining_movement_reserve: int
    active_consumer_ref: Ref
    consumers: tuple[LatchedConsumerD,...]=Field(min_length=1,max_length=128)
    stations: tuple[MovingStationD,...]=Field(default=(),max_length=128)
    retained_map: tuple[ObservedMapCellD,...]=Field(default=(),max_length=4096)
    words: tuple[SymbolRouteWordD,...]=Field(default=(),max_length=3)
    observed_frontier_positions: tuple[tuple[int,int],...]=Field(default=(),max_length=4096)
    map_evidence_revision_ref: Ref

    @model_validator(mode='after')
    def exact_latched_consumers(self):
        refs={c.consumer_ref for c in self.consumers}
        if len(refs)!=len(self.consumers) or self.active_consumer_ref not in refs:raise ValueError('active remembered consumer identity unbound')
        if any(s.consumer_ref not in refs or s.current_index>=len(s.cyclic_positions) or s.clock_phase>=s.advance_period for s in self.stations):
            raise ValueError('station consumer/clock/pose unbound')
        if len({c.position for c in self.retained_map})!=len(self.retained_map):raise ValueError('retained map evidence must preserve unique cell identity')
        return self


class LatchedTargetSequenceRequestD(SymbolRouteBaseD):
    schema_version: Ref='yf_arc3_v5.latched_target_sequence_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.symbol_conditioned_route.latched_target_sequence','AUDIT'),)


class StationRendezvousRequestD(SymbolRouteBaseD):
    schema_version: Ref='yf_arc3_v5.station_rendezvous_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.symbol_conditioned_route.station_rendezvous','AUDIT'),)


class VisibilityResourceContractRequestD(SymbolRouteBaseD):
    schema_version: Ref='yf_arc3_v5.visibility_resource_contract_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.symbol_conditioned_route.visibility_resource_contract','AUDIT'),)


class JointSymbolOrderRequestD(SymbolRouteBaseD):
    schema_version: Ref='yf_arc3_v5.joint_symbol_order_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.symbol_conditioned_route.joint_order_not_fixed','AUDIT'),)


class ConsumerSpecificSignatureRequestD(SymbolRouteBaseD):
    schema_version: Ref='yf_arc3_v5.consumer_specific_signature_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.symbol_conditioned_route.consumer_specific_signature','AUDIT'),)


class UnseenProviderFrontierRequestD(SymbolRouteBaseD):
    schema_version: Ref='yf_arc3_v5.unseen_provider_frontier_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.symbol_conditioned_route.unseen_provider_frontier','AUDIT'),)


def _symbol_signature(aspects):return {a.aspect_ref:a.value_ref for a in aspects}


def measure_symbol_route_audit_d(request: SymbolRouteBaseD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        consumers={c.consumer_ref:c for c in request.consumers}
        rows=[];unknown=False
        for word in request.words:
            if len(word.steps)>request.depth_bound:raise DComputationInterrupted('SYMBOL_ROUTE_WORD_DEPTH_BOUND',{})
            position,aspects,reserve=request.current_position,request.current_aspects,request.remaining_movement_reserve
            acquired={c.consumer_ref for c in request.consumers if c.acquired and c.acquisition_evidence_ref is not None}
            initial_acquired=set(acquired)
            station_clock={s.station_ref:(s.current_index,s.clock_phase,s.initially_armed) for s in request.stations}
            events,failures=[],[];cost=0
            for step in word.steps:
                budget.visit({'stage':'whole_symbol_route_packet','step_ref':step.step_ref})
                if step.epoch!=request.scope.epoch or step.model_revision_ref!=request.scope.model_revision_ref or step.complete_response_evidence_ref is None or step.preservation_satisfied is None:
                    unknown=True;failures.append((step.step_ref,'SCOPED_RESPONSE_OR_PRESERVATION_UNKNOWN'));break
                if position!=step.before_position or _symbol_signature(aspects)!=_symbol_signature(step.before_aspects):failures.append((step.step_ref,'CONTINUATION_PRECONDITION'));break
                reserve-=step.movement_debit;cost+=step.command_cost
                if reserve<0:failures.append((step.step_ref,'RESOURCE_BEFORE_REFILL'));break
                if step.refill_amount:
                    if step.refill_evidence_ref is None:unknown=True;failures.append((step.step_ref,'REFILL_EFFECT_UNKNOWN'));break
                    reserve+=step.refill_amount
                if step.preservation_satisfied is False:failures.append((step.step_ref,'PRESERVATION'));break
                position,aspects=step.after_position,step.after_aspects
                if step.actual_restoration:
                    for ref in tuple(acquired):
                        consumer=consumers[ref]
                        if consumer.restore_preserves_acquisition is None or consumer.persistence_evidence_ref is None:
                            unknown=True;failures.append((ref,'RESTORE_LATCH_PERSISTENCE_UNKNOWN'))
                        elif not consumer.restore_preserves_acquisition:acquired.remove(ref)
                for station in request.stations:
                    index,phase,armed=station_clock[station.station_ref]
                    if station.movement_evidence_ref is None:unknown=True;continue
                    advance,new_phase=divmod(phase+step.clock_ticks,station.advance_period)
                    index=(index+advance)%len(station.cyclic_positions)
                    actual_contact=position==station.cyclic_positions[index]
                    signature=_symbol_signature(aspects)
                    signature_ok=all(signature.get(a.aspect_ref)==a.value_ref for a in consumers[station.consumer_ref].required_aspects)
                    if station.rearm_law=='LEAVE_CONTACT' and not actual_contact:armed=True
                    if station.rearm_law=='SIGNATURE_CHANGE' and _symbol_signature(step.before_aspects)!=signature:armed=True
                    if actual_contact and signature_ok and armed and station.consumer_ref in step.contacted_consumer_refs and step.contact_evidence_refs:
                        acquired.add(station.consumer_ref);armed=False
                        events.append({'step_ref':step.step_ref,'consumer_ref':station.consumer_ref,'station_ref':station.station_ref,
                            'actual_station_position':station.cyclic_positions[index],'clock_phase':new_phase,'acquired_identity_latched':True})
                    station_clock[station.station_ref]=(index,new_phase,armed)
                for ref in step.contacted_consumer_refs:
                    if ref not in consumers or any(s.consumer_ref==ref for s in request.stations):continue
                    signature=_symbol_signature(aspects)
                    if step.contact_evidence_refs and all(signature.get(a.aspect_ref)==a.value_ref for a in consumers[ref].required_aspects):
                        acquired.add(ref);events.append({'step_ref':step.step_ref,'consumer_ref':ref,'acquired_identity_latched':True})
            rows.append({'word_ref':word.word_ref,'whole_command_cost':cost,'remaining_reserve':reserve,'final_position':position,
                'final_aspects':aspects,'acquired_consumer_refs':tuple(sorted(acquired)),'previous_latches_preserved':initial_acquired<=acquired,
                'active_consumer_acquired':request.active_consumer_ref in acquired,'events':tuple(events),'failures':tuple(failures),
                'resource_and_preservation_feasible':not failures})
        certain=tuple(c.position for c in request.retained_map if c.traversable is True and not c.partly_visible and
            (c.observed_revision_ref==request.map_evidence_revision_ref or c.revalidation_evidence_ref is not None))
        frontier=[]
        for position in request.observed_frontier_positions:
            budget.visit({'stage':'observed_frontier_only','position':position})
            if any(abs(position[0]-p[0])+abs(position[1]-p[1])==1 for p in certain):frontier.append(position)
        providers=tuple((ref,c.position,c.first_visible_evidence_ref) for c in request.retained_map for ref in c.provider_refs)
        feasible=[r for r in rows if r['resource_and_preservation_feasible']]
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if unknown else 'COMPLETE','LATCHED_IDENTITY_STATION_RESOURCE_WORDS',complete=not unknown,
            examined=budget.examined,values={'route_word_rows':tuple(rows),'retained_map_evidence':request.retained_map,
                'certain_current_map_positions':certain,'bounded_observed_frontier':tuple(frontier),'first_visible_provider_bindings':providers,
                'active_remembered_consumer_ref':request.active_consumer_ref,'fixed_aspect_or_contact_order_imposed':False,
                'incompatible_target_signatures_required_simultaneously':False,'private_hidden_map_imported':False},descriptive_delta={
                'has_feasible_consumer_word':any(r['active_consumer_acquired'] for r in feasible),
                'has_preserved_acquisition_word':any(r['previous_latches_preserved'] for r in feasible),
                'has_resource_feasible_known_word':bool(feasible),'has_observed_provider_frontier':bool(frontier or providers),
                'has_checked_moving_station_acquisition':any(e.get('station_ref') for r in feasible for e in r['events'])})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_scoped_symbol_route_words':True,'work':error.frontier})


class CoupledWordStepD(FrozenModel):
    step_ref: Ref
    input_ref: Ref
    context_ref: Ref
    before_positions: tuple[tuple[Ref,tuple[int,int]],...]
    after_positions: tuple[tuple[Ref,tuple[int,int]],...]
    independent_member_maps: tuple[tuple[Ref,tuple[int,int]],...]
    effect_evidence_ref: Ref|None
    keeper_holds: bool|None
    traveller_opening_aligned: bool|None
    passage_admitted: bool|None
    keeper_retention_evidence_ref: Ref|None
    passage_evidence_ref: Ref|None


class HelperControlObservationD(FrozenModel):
    receipt_ref: Ref
    context_ref: Ref
    helper_ref: Ref
    paused_peer_refs: tuple[Ref,...]
    destroyed_peer_refs: tuple[Ref,...]
    completed_peer_refs: tuple[Ref,...]
    return_group_input_ref: Ref|None
    actual_return_group_evidence_ref: Ref|None
    sealed: bool


class CoupledSupportBaseD(DMechanicalRequest):
    phase_ref: Literal['IDENTITY_SCOPED_COUPLED_WORD']
    current_context_ref: Ref
    keeper_ref: Ref
    traveller_ref: Ref
    current_positions: tuple[tuple[Ref,tuple[int,int]],...]
    word: tuple[CoupledWordStepD,...]=Field(default=(),max_length=4096)
    helper_observations: tuple[HelperControlObservationD,...]=Field(default=(),max_length=128)


class MemberMapsNotSidesRequestD(CoupledSupportBaseD):
    schema_version: Ref='yf_arc3_v5.member_maps_not_sides_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.coupled_meeting_support.member_maps_not_sides','AUDIT'),)


class KeeperTravellerRequestD(CoupledSupportBaseD):
    schema_version: Ref='yf_arc3_v5.keeper_traveller_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.coupled_meeting_support.keeper_and_traveller','AUDIT'),)


class HelperPauseScopeRequestD(CoupledSupportBaseD):
    schema_version: Ref='yf_arc3_v5.helper_pause_scope_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.coupled_meeting_support.helper_pause_scope','AUDIT'),)


def measure_coupled_support_audit_d(request: CoupledSupportBaseD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        if len(request.word)>request.depth_bound:raise DComputationInterrupted('COUPLED_WORD_DEPTH_BOUND',{})
        positions=dict(request.current_positions);maps=[];failures=[];unknown=False;keeper=True;passage=False
        if request.word and (request.keeper_ref not in positions or request.traveller_ref not in positions or request.keeper_ref==request.traveller_ref):
            return d_result(request,'NEEDS_EVIDENCE','DISTINCT_CURRENT_KEEPER_AND_TRAVELLER_IDENTITIES_REQUIRED')
        for step in request.word:
            budget.visit({'stage':'whole_keeper_traveller_word','step_ref':step.step_ref})
            if step.context_ref!=request.current_context_ref or step.effect_evidence_ref is None:unknown=True;failures.append((step.step_ref,'CURRENT_CONTEXT_EFFECT_UNKNOWN'));break
            before=dict(step.before_positions);after=dict(step.after_positions);mapping=dict(step.independent_member_maps)
            if before!=positions or set(after)!=set(positions) or set(mapping)!=set(positions):failures.append((step.step_ref,'IDENTITY_MAP_OR_CONTINUATION'));break
            actual={ref:(after[ref][0]-before[ref][0],after[ref][1]-before[ref][1]) for ref in sorted(positions)}
            if actual!=mapping:failures.append((step.step_ref,'OBSERVED_MEMBER_MAP_CONTRADICTION'));break
            maps.append({'step_ref':step.step_ref,'input_ref':step.input_ref,'context_ref':step.context_ref,'identity_displacements':tuple(sorted(actual.items()))})
            if step.keeper_holds is None or step.keeper_retention_evidence_ref is None:unknown=True
            keeper=keeper and step.keeper_holds is True
            if step.traveller_opening_aligned is True and step.passage_admitted is True and step.passage_evidence_ref:passage=True
            elif step.passage_admitted is None:unknown=True
            positions=after
        pause_rows=[]
        for observation in request.helper_observations:
            budget.visit({'stage':'helper_control_context','receipt_ref':observation.receipt_ref})
            if observation.context_ref!=request.current_context_ref or not observation.sealed:continue
            pause_rows.append({'receipt_ref':observation.receipt_ref,'helper_ref':observation.helper_ref,
                'paused_peer_refs':observation.paused_peer_refs,'destroyed_peer_refs':observation.destroyed_peer_refs,
                'completed_peer_refs':observation.completed_peer_refs,'return_group_input_ref':observation.return_group_input_ref,
                'return_group_evidenced':bool(observation.return_group_input_ref and observation.actual_return_group_evidence_ref)})
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if unknown else 'COMPLETE','IDENTITY_COUPLED_WORD_AND_HELPER_SCOPE',complete=not unknown,
            examined=budget.examined,values={'identity_map_rows':tuple(maps),'word_failures':tuple(failures),'final_positions':tuple(sorted(positions.items())),
                'helper_control_rows':tuple(pause_rows),'screen_side_used_as_controller_identity':False},descriptive_delta={
                'has_current_identity_maps':bool(maps) and not failures,'keeper_retained_through_entire_word':keeper and bool(request.word) and not failures,
                'has_supported_keeper_traveller_passage':keeper and passage and not failures,
                'has_evidenced_return_group_control':any(r['return_group_evidenced'] for r in pause_rows)})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_current_coupled_word':True,'work':error.frontier})


class SupportTransformCaseD(FrozenModel):
    case_ref: Ref
    staging_support_ref: Ref
    before_support_points: tuple[tuple[int,int],...]
    after_support_points: tuple[tuple[int,int],...]
    actor_footprint: tuple[tuple[int,int],...]
    onward_route_evidence_ref: Ref|None
    transform_evidence_ref: Ref|None
    tool_ref: Ref|None
    load_ref: Ref|None
    tool_command_ref: Ref|None
    actual_grip_contact: bool|None
    grip_evidence_ref: Ref|None
    code_before_ref: Ref|None
    code_after_ref: Ref|None
    displayed_relation_evidence_ref: Ref|None
    rotation_delta: int
    tool_translation: tuple[int,int]
    load_translation: tuple[int,int]
    unsafe_restoration: bool
    restoration_evidence_ref: Ref|None
    budget_loss: int=Field(ge=0)
    previous_failed_staging_support_ref: Ref|None


class ReconfigurableSupportBaseD(DMechanicalRequest):
    phase_ref: Literal['GROUNDED_SUPPORT_TRANSFORM_CONTRIBUTIONS']
    cases: tuple[SupportTransformCaseD,...]=Field(min_length=1,max_length=128)


class SupportPivotRequestD(ReconfigurableSupportBaseD):
    schema_version: Ref='yf_arc3_v5.support_pivot_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.reconfigurable_support.pivot','AUDIT'),)


class SupportGripRequestD(ReconfigurableSupportBaseD):
    schema_version: Ref='yf_arc3_v5.support_grip_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.reconfigurable_support.grip','AUDIT'),)


class SupportCodeRequestD(ReconfigurableSupportBaseD):
    schema_version: Ref='yf_arc3_v5.support_code_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.reconfigurable_support.code','AUDIT'),)


class SupportRecoveryRequestD(ReconfigurableSupportBaseD):
    schema_version: Ref='yf_arc3_v5.support_recovery_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.reconfigurable_support.recovery','AUDIT'),)


def measure_reconfigurable_support_audit_d(request: ReconfigurableSupportBaseD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        rows=[]
        for case in request.cases:
            budget.visit({'stage':'full_support_and_tool_effect','case_ref':case.case_ref})
            footprint=set(case.actor_footprint)
            stable=bool(footprint and case.transform_evidence_ref and case.onward_route_evidence_ref and footprint<=set(case.before_support_points)&set(case.after_support_points))
            grip=bool(case.tool_ref and case.load_ref and case.tool_command_ref and case.actual_grip_contact is True and case.grip_evidence_ref)
            compound=bool(case.transform_evidence_ref and case.displayed_relation_evidence_ref and case.code_before_ref!=case.code_after_ref and
                (case.rotation_delta!=0 or case.load_translation!=(0,0)))
            retry=bool(case.unsafe_restoration and case.restoration_evidence_ref and case.transform_evidence_ref and
                case.previous_failed_staging_support_ref is not None and case.staging_support_ref!=case.previous_failed_staging_support_ref)
            rows.append({'case_ref':case.case_ref,'stable_common_support_for_onward_route':stable,'grounded_loaded_tool_transport':grip,
                'tool_translation':case.tool_translation,'load_translation':case.load_translation,'load_moves_with_tool':grip and case.load_translation==case.tool_translation,
                'code_rotation_transport_compound_effect':compound,'grounded_retry_after_staging_change':retry,
                'retained_unsafe_transform_evidence_ref':case.transform_evidence_ref if case.unsafe_restoration else None,'observed_budget_loss':case.budget_loss})
        budget.finish()
        return d_result(request,'COMPLETE','GROUNDED_SUPPORT_PIVOT_GRIP_CODE_RECOVERY',complete=True,examined=budget.examined,values={'case_rows':tuple(rows),
            'every_pivot_required_by_convention':False,'empty_tool_motion_implies_load_motion':False},descriptive_delta={
                'has_stable_onward_support':any(r['stable_common_support_for_onward_route'] for r in rows),
                'has_grounded_loaded_tool':any(r['load_moves_with_tool'] for r in rows),'has_compound_supported_code_effect':any(r['code_rotation_transport_compound_effect'] for r in rows),
                'has_changed_staging_grounded_retry':any(r['grounded_retry_after_staging_change'] for r in rows)})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_support_transform_cases':True,'work':error.frontier})
