"""Shared configuration edits versus complete policy-derived timed runs."""
from __future__ import annotations
from itertools import product
from time import monotonic
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .single_visit_residual_d import ResidualEdgeD
from .policy_constrained_routing_d import InternalRoutePolicyD, PolicyConstrainedRoutingRequestD, _policy_route_domain
from .prescribed_transit_coincidence_d import EntryGateD, FixedTransitActorD, PrescribedTransitCoincidenceRequestD, measure_prescribed_transit_coincidence_d
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class TransitSwitchIncidenceD(FrozenModel):
    switch_ref: Ref
    edge_ref: Ref
    open_when_value: bool


class ConfiguredTransitActorD(FrozenModel):
    actor_ref: Ref
    start_ref: Ref
    destination_ref: Ref
    current_node_ref: Ref
    policy_ref: Ref
    departure_tick: int = Field(ge=0)
    edge_travel_ticks: int = Field(ge=0)


class ConfiguredTransitRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.configured_transit_request_d.v1'
    phase_ref: Literal['EXTERNAL_CONFIGURATION_OR_TRANSIT']
    channel: Literal['TOGGLE','LAUNCH']
    bound_switch_ref: Ref | None
    switch_values: tuple[tuple[Ref,bool],...] = Field(default=(),max_length=4096)
    incidences: tuple[TransitSwitchIncidenceD,...] = Field(default=(),max_length=4096)
    node_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    edges: tuple[ResidualEdgeD,...] = Field(default=(),max_length=4096)
    blocked_node_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    directed: bool
    actors: tuple[ConfiguredTransitActorD,...] = Field(min_length=1,max_length=128)
    policies: tuple[InternalRoutePolicyD,...] = Field(min_length=1,max_length=128)
    gates: tuple[EntryGateD,...] = Field(default=(),max_length=4096)
    dwell_ticks: tuple[tuple[Ref,int],...] = Field(default=(),max_length=4096)
    timing_rule: Literal['CHECK_DEPARTURE_THEN_TRAVEL','CHECK_ARRIVAL_BEFORE_ENTRY']
    required_actor_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    elapsed_tick_limit: int = Field(ge=0)
    remaining_resource: int
    edit_debit: int = Field(ge=0)
    launch_debit: int = Field(ge=0)
    edit_has_world_clock: Literal[False]
    restore_actors_after_failure: bool
    preserve_configuration_after_failure: bool
    restored_switch_values: tuple[tuple[Ref,bool],...] = Field(default=(),max_length=4096)
    goal_boundary_ref: Ref
    failed_trial_event_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.autonomous_route_intervention.configured_transit_external_primitive','STEP'),
    )

    @model_validator(mode='after')
    def shared_configuration(self):
        switches=dict(self.switch_values)
        edge_ids={e.edge_ref for e in self.edges}
        if len(switches)!=len(self.switch_values) or any(i.switch_ref not in switches or i.edge_ref not in edge_ids for i in self.incidences):
            raise ValueError('shared switch incidence domain invalid')
        if len({i.edge_ref for i in self.incidences})!=len(self.incidences):
            raise ValueError('multi-switch edge composition needs a separate evidenced boolean law')
        if len({a.actor_ref for a in self.actors})!=len(self.actors) or any(a.policy_ref not in {p.policy_ref for p in self.policies} for a in self.actors):
            raise ValueError('actor policy identity domain invalid')
        return self


def measure_configured_transit_d(request: ConfiguredTransitRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.edges),len(request.node_refs),len(request.incidences))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_PURE_CONFIGURED_TRANSIT_PACKET')
    budget=DWorkBudget(request)
    try:
        values=dict(request.switch_values)
        positions={a.actor_ref:a.current_node_ref for a in request.actors}
        if request.channel=='TOGGLE':
            if request.bound_switch_ref not in values:return d_result(request,'NEEDS_EVIDENCE','EDITABLE_SWITCH_NOT_BOUND')
            if request.edit_has_world_clock:return d_result(request,'NEEDS_EVIDENCE','EDIT_CLOCK_TRANSITION_LAW_NOT_BOUND')
            values[request.bound_switch_ref]=not values[request.bound_switch_ref]
            affected=tuple(i.edge_ref for i in request.incidences if i.switch_ref==request.bound_switch_ref)
            return d_result(request,'COMPLETE','SHARED_SWITCH_EDIT_WITH_FROZEN_WORLD',complete=True,examined=1,
                values={'switch_values':values,'actor_positions':positions,'changed_edge_refs':affected,'primitive_debit':request.edit_debit,
                    'remaining_resource':request.remaining_resource-request.edit_debit,'world_ticks_added':0,'complete_response_boundary_count':1})
        incidence={i.edge_ref:i for i in request.incidences}
        edges=tuple(e for e in request.edges if e.edge_ref not in incidence or
            values[incidence[e.edge_ref].switch_ref]==incidence[e.edge_ref].open_when_value)
        policies={p.policy_ref:p for p in request.policies}
        route_request=PolicyConstrainedRoutingRequestD(scope=request.scope,operation_ref='mechanics.autonomous_route_intervention.policy_constrained_routing',
            mode_ref='DOMAIN',requested_result_type='DMechanicalResult',node_bound=request.node_bound,depth_bound=request.depth_bound,domain_bound=request.domain_bound,
            time_bound_ms=request.time_bound_ms,phase_ref='ROLE_TAGGED_INTERNAL_ROUTE',graph_role='PHYSICAL_PASSAGE',node_refs=request.node_refs,edges=edges,
            blocked_node_refs=request.blocked_node_refs,directed=request.directed,origin_ref=request.actors[0].start_ref,destination_ref=request.actors[0].destination_ref,
            requested_property='REALIZED_ROUTE',policies=request.policies)
        domains=[]
        for actor in request.actors:
            paths=_policy_route_domain(route_request,policies[actor.policy_ref],actor.start_ref,actor.destination_ref,budget)
            domains.append(tuple(paths) if paths else (None,))
        cardinality=1
        for domain in domains:cardinality*=len(domain)
        if cardinality>request.domain_bound:raise DComputationInterrupted('CORRELATED_TRANSIT_ROUTE_DOMAIN_BOUND',{})
        outcomes=[]
        for index,combination in enumerate(product(*domains)):
            budget.visit({'stage':'internal_policy_route_combination','index':index})
            timed=[]
            missing=[]
            for actor,path in zip(request.actors,combination):
                if path is None:
                    missing.append(actor.actor_ref)
                    path=(actor.start_ref,)
                timed.append(FixedTransitActorD(actor_ref=actor.actor_ref,route=path,departure_tick=actor.departure_tick,
                    transition_ticks=(actor.edge_travel_ticks,)*(len(path)-1),exit_ref=actor.destination_ref))
            remaining_nodes=request.node_bound-budget.examined
            remaining_ms=int(request.time_bound_ms-(monotonic()-budget.started)*1000)
            if min(remaining_nodes,remaining_ms)<1:raise DComputationInterrupted('AGGREGATE_TRANSIT_COMPUTATION_BOUND',{})
            request_timing=PrescribedTransitCoincidenceRequestD(scope=request.scope,operation_ref='mechanics.clock_event_model.prescribed_transit_coincidence',
                mode_ref='EVALUATE',requested_result_type='DMechanicalResult',node_bound=remaining_nodes,time_bound_ms=remaining_ms,depth_bound=request.depth_bound,
                domain_bound=request.domain_bound,phase_ref='PRESCRIBED_TIMED_ROUTES',actors=tuple(timed),gates=request.gates,dwell_ticks=request.dwell_ticks,
                timing_rule=request.timing_rule,required_actor_refs=request.required_actor_refs,stop_actor_at_first_arrival=True,commanded_edit_count=0,
                elapsed_tick_limit=request.elapsed_tick_limit)
            result=measure_prescribed_transit_coincidence_d(request_timing)
            budget.examined+=result.examined_count
            if result.status!='COMPLETE':raise DComputationInterrupted(result.cause,{'unfinished_route_combination':index})
            success=not missing and result.values.get('required_first_arrivals_coincide') is True
            itinerary_by_actor={row['actor_ref']:row['dated_itinerary'] for row in result.values['actor_rows']}
            final_positions={actor.actor_ref:(actor.start_ref if not success and request.restore_actors_after_failure else
                itinerary_by_actor[actor.actor_ref][-1]['to_ref'] if itinerary_by_actor[actor.actor_ref] else actor.start_ref)
                for actor in request.actors}
            final_configuration=values if success or request.preserve_configuration_after_failure else dict(request.restored_switch_values)
            outcomes.append({'route_combination_index':index,'policy_realized_routes':combination,'timed_result':result.values,
                'missing_route_actor_refs':tuple(missing),'coincidence_goal':success,'actor_positions':final_positions,'switch_values':final_configuration,
                'boundary_ref':request.goal_boundary_ref if success else None,'failed_trial_event_ref':None if success else request.failed_trial_event_ref})
        budget.finish()
        return d_result(request,'COMPLETE','COMPLETE_POLICY_DERIVED_TRANSIT_DOMAIN',complete=True,examined=budget.examined,
            values={'outcome_domain':tuple(outcomes),'primitive_debit':request.launch_debit,'remaining_resource':request.remaining_resource-request.launch_debit,
                'player_route_substituted':False,'extra_world_pass_added':False,'external_input_count':1,'complete_response_boundary_count':1})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_counterfactual_transit_packet':True,'actual_parent_command_redebited':False,'work':error.frontier})
