"""Joint propagation, collision ownership and release-risk measurements for SRC."""
from __future__ import annotations
from typing import ClassVar,Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import Ref
from .directed_accretive_flow import DirectedRequest,measure_directed_accretive_flow
from .mechanical_family_contracts_d import DMechanicalRequest,DWorkBudget,DComputationInterrupted,d_validate_request,d_result
from .program_recipe_goal_audit_d import _goal_child_current


class FlowGoalAuditBaseD(DMechanicalRequest):
    phase_ref: Literal['JOINT_CONFIGURED_FLOW_CONTRIBUTION']
    child_request: DirectedRequest
    required_receiver_refs: tuple[Ref,...]=Field(min_length=1,max_length=128)
    receiving_branch_evidence_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    grounded_release_model_evidence_ref: Ref|None
    bounded_discovery_risk_evidence_ref: Ref|None
    remaining_failed_release_allowance: int=Field(ge=0)
    remaining_configuration_actions: int=Field(ge=0)
    configuration_cost: int=Field(ge=0)
    allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.directed_accretive_flow.inverse_routing','INVERSE_DOMAIN'),)


class FlowGoalRequestD(FlowGoalAuditBaseD):
    schema_version: Ref='yf_arc3_v5.flow_goal_d_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.directed_accretive_flow','AUDIT'),)

class FlowWhyRequestD(FlowGoalAuditBaseD):
    schema_version: Ref='yf_arc3_v5.flow_why_d_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.directed_accretive_flow.why','AUDIT'),)

class FlowColliderRequestD(FlowGoalAuditBaseD):
    schema_version: Ref='yf_arc3_v5.flow_collider_d_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.directed_accretive_flow.whole_collider','AUDIT'),)
    allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.directed_accretive_flow.composite_relief','MEASURE'),)

class FlowCascadeRequestD(FlowGoalAuditBaseD):
    schema_version: Ref='yf_arc3_v5.flow_cascade_d_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.directed_accretive_flow.cascade','AUDIT'),)

class FlowTraceRequestD(FlowGoalAuditBaseD):
    schema_version: Ref='yf_arc3_v5.flow_trace_d_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.directed_accretive_flow.trace_interaction','AUDIT'),)

class FlowTimingRequestD(FlowGoalAuditBaseD):
    schema_version: Ref='yf_arc3_v5.flow_timing_d_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.directed_accretive_flow.timing','AUDIT'),)

class FlowRiskRequestD(FlowGoalAuditBaseD):
    schema_version: Ref='yf_arc3_v5.flow_risk_d_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.directed_accretive_flow.commit_risk','AUDIT'),)


def measure_flow_goal_audit_d(request: FlowGoalAuditBaseD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        child=request.child_request
        if not _goal_child_current(request,child) or (child.operation_ref,child.mode) not in request.allowed_pairs:
            return d_result(request,'NEEDS_EVIDENCE','CURRENT_EXACT_FLOW_MEANS_REQUEST_REQUIRED')
        if child.state is None or child.model is None or len(child.candidates)>3:
            return d_result(request,'NEEDS_EVIDENCE','CURRENT_JOINT_FLOW_MODEL_AND_AT_MOST_THREE_ROOT_CONFIGURATIONS')
        if child.candidates and (set(child.required_capture_refs)!=set(request.required_receiver_refs) or child.forbidden_leak is not True):
            return d_result(request,'NEEDS_EVIDENCE','COMPLETE_RECEIVER_SET_AND_NO_FORBIDDEN_LEAK_REQUIRED')
        if request.node_bound<=1:return d_result(request,'BUDGET_REACHED','FLOW_CHILD_WORK_REQUIRED',frontier={'restart_scoped_flow':True})
        budget.visit({'stage':'native_joint_flow_domain'})
        native=measure_directed_accretive_flow(child.model_copy(update={'maximum_evaluations':min(child.maximum_evaluations,request.node_bound-budget.examined),
            'maximum_states':min(child.maximum_states,request.domain_bound)}))
        budget.examined+=native.examined_count
        summaries=[]
        for row in native.values.get('routing_candidate_results',()):
            captures=[];events=[];surplus=[]
            for response in row.get('response_domain',()):
                after=response.get('after_state',{})
                # Native immutable result has already projected models to JSON data.
                budget.visit({'stage':'complete_joint_response','candidate_ref':row['candidate_ref']})
                captures.append(tuple(after.get('captured_receiver_refs',())))
                events.append(tuple(response.get('events',())))
                surplus.append({'front_count':len(after.get('fronts',())),'leak_count':len(after.get('leaks',())),
                    'terminal_phase':after.get('phase')})
            summaries.append({'candidate_ref':row['candidate_ref'],'port_connections':row.get('port_connections',()),
                'all_responses_accepted':row.get('all_retained_responses_satisfy_supplied_predicates') is True,
                'capture_sets':tuple(captures),'ordered_joint_events':tuple(events),'remaining_branches':tuple(surplus)})
        union=native.values.get('union',{})
        collision_current=False
        if child.collider_input is not None:
            masks=child.collider_input.collider_masks
            actual={p for obj in child.state.objects if obj.collider for p in obj.positions}
            supplied={p for mask in masks for p in mask.positions}
            collision_current=bool(masks) and actual==supplied and bool(union)
        affordable=request.configuration_cost<=request.remaining_configuration_actions
        grounded=request.grounded_release_model_evidence_ref is not None
        risk=request.bounded_discovery_risk_evidence_ref is not None and request.remaining_failed_release_allowance>0
        accepted=any(r['all_responses_accepted'] for r in summaries)
        budget.finish()
        return d_result(request,'COMPLETE' if native.domain_complete else 'BUDGET_REACHED' if native.computation_bound_reached else 'NEEDS_EVIDENCE',
            'JOINT_FLOW_GOAL_COLLISION_AND_RELEASE_MEASUREMENTS',complete=native.domain_complete,examined=budget.examined,
            values={'native_flow_values':native.values,'missing_refs':native.prerequisite_refs,'configuration_summaries':tuple(summaries),
                'receiving_branch_evidence_refs':request.receiving_branch_evidence_refs,'collision_union':union,
                'failed_release_allowance':request.remaining_failed_release_allowance,'configuration_actions_available':request.remaining_configuration_actions,
                'simultaneous_capture_required':False,'sources_simulated_independently':False,'minimum_cost_claimed':False},frontier=native.frontier,
            descriptive_delta={'has_joint_complete_capture_configuration':accepted,
                'has_grounded_receiving_branch_configuration':accepted and bool(request.receiving_branch_evidence_refs),
                'has_current_whole_collider_union':collision_current,
                'has_accounted_terminal_surplus_branches':accepted and all(all(s['front_count']==0 and s['leak_count']==0 and s['terminal_phase']=='STOPPED' for s in r['remaining_branches']) for r in summaries if r['all_responses_accepted']),
                'has_joint_trace_checked_configuration':accepted,'has_asynchronous_complete_capture_configuration':accepted,
                'has_grounded_or_bounded_affordable_release':affordable and (grounded or risk)})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_scoped_flow_audit':True,'work':error.frontier})
