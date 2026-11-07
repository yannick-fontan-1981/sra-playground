"""Bounded native question/answer transport with exact caller-declared predicates.

DRM supplies the question and its usefulness conditions. This module measures
those conditions on the native answer; it never substitutes a goal or releases
a candidate. An exhausted computation is not an empty feasible world domain.
"""
from __future__ import annotations
from collections.abc import Mapping
from time import monotonic
from typing import ClassVar,Literal
from pydantic import Field,field_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref,freeze_json
from .mechanical_family_contracts_d import DMechanicalRequest,DWorkBudget,DComputationInterrupted,d_result,d_validate_request
from .program_recipe_goal_audit_d import _goal_child_current


class NativeResultConditionD(FrozenModel):
    condition_ref: Ref
    field_path: tuple[str|int,...]=Field(min_length=1,max_length=16)
    comparison: Literal['EQ','NE','GE','LE','SET_EQ','CONTAINS']
    expected: object
    goal_contribution_ref: Ref
    evidence_ref: Ref
    epoch: int=Field(ge=0)
    evidence_revision_ref: Ref
    model_revision_ref: Ref

    @field_validator('expected')
    @classmethod
    def immutable_expected(cls,value):return freeze_json(value)


class NativeGoalDomainBaseD(DMechanicalRequest):
    source_question_ref: Ref
    source_question_evidence_refs: tuple[Ref,...]=Field(min_length=1,max_length=64)
    result_conditions: tuple[NativeResultConditionD,...]=Field(min_length=1,max_length=64)
    protocol_clock_evidence_ref: Ref|None=None
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=()


def _native_value_at_path(values,path):
    value=values
    for key in path:
        if isinstance(value,Mapping) and isinstance(key,str) and key in value:value=value[key]
        elif isinstance(value,(tuple,list)) and isinstance(key,int) and 0<=key<len(value):value=value[key]
        else:return False,None
    return True,value


def _native_condition_matches(actual,condition):
    expected=condition.expected
    if condition.comparison=='EQ':return type(actual) is type(expected) and actual==expected
    if condition.comparison=='NE':return type(actual) is type(expected) and actual!=expected
    if condition.comparison in ('LE','GE'):
        if not isinstance(actual,(int,float)) or isinstance(actual,bool) or not isinstance(expected,(int,float)) or isinstance(expected,bool):return False
        return actual<=expected if condition.comparison=='LE' else actual>=expected
    if not isinstance(actual,(tuple,list,frozenset)):return False
    if condition.comparison=='CONTAINS':return expected in actual
    if not isinstance(expected,(tuple,list,frozenset)):return False
    # Exact membership also supports structured immutable JSON values.
    return all(item in expected for item in actual) and all(item in actual for item in expected)


def measure_bound_native_goal_domain_d(request,calculation):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        child=request.native_request
        if not _goal_child_current(request,child) or (child.operation_ref,child.mode) not in request.native_allowed_pairs:
            return d_result(request,'NEEDS_EVIDENCE','EXACT_CURRENT_NATIVE_QUESTION_AND_PARENT_REQUIRED')
        if len({c.condition_ref for c in request.result_conditions})!=len(request.result_conditions):
            return d_result(request,'NEEDS_EVIDENCE','UNIQUE_SOURCE_CONDITION_IDENTITIES_REQUIRED')
        for condition in request.result_conditions:
            if (condition.goal_contribution_ref!=request.scope.parent_contribution_ref or condition.epoch!=request.scope.epoch or
                    condition.evidence_revision_ref!=request.scope.evidence_revision_ref or condition.model_revision_ref!=request.scope.model_revision_ref):
                return d_result(request,'NEEDS_EVIDENCE','CURRENT_PARENT_GOAL_PREDICATE_PROVENANCE_REQUIRED')
        if getattr(request,'clock_required',False) and request.protocol_clock_evidence_ref is None:
            return d_result(request,'NEEDS_EVIDENCE','SUPPORTED_COMMAND_CLOCK_REQUIRED_NOT_A_NOOP_WAIT')
        reserve=1+len(request.result_conditions)
        if request.node_bound<=reserve:
            return d_result(request,'BUDGET_REACHED','NATIVE_COMPUTATION_AND_RESULT_CHECK_BUDGET_REQUIRED',frontier={'restart_same_question':True})
        budget.visit({'stage':'source_bound_native_question','question_ref':request.source_question_ref})
        updates={'maximum_evaluations':min(child.maximum_evaluations,request.node_bound-reserve)}
        for field,bound in (('maximum_states',request.domain_bound),('maximum_witnesses',3),('maximum_depth',request.depth_bound)):
            if field in type(child).model_fields:updates[field]=min(getattr(child,field),bound)
        native=calculation(child.model_copy(update=updates))
        budget.examined+=native.examined_count
        rows=[];missing=[]
        for condition in request.result_conditions:
            budget.visit({'stage':'native_result_goal_condition','condition_ref':condition.condition_ref})
            present,actual=_native_value_at_path(native.values,condition.field_path)
            if not present:missing.append(condition.condition_ref)
            rows.append({'condition_ref':condition.condition_ref,'field_path':condition.field_path,'present':present,
                'matched':present and _native_condition_matches(actual,condition),'actual':actual,'evidence_ref':condition.evidence_ref})
        complete=native.domain_complete and native.signature_supported and not missing and not native.implementation_debt_refs
        matched=complete and all(row['matched'] for row in rows)
        budget.finish()
        return d_result(request,'COMPLETE' if complete else 'BUDGET_REACHED' if native.computation_bound_reached else 'NEEDS_EVIDENCE',
            'NATIVE_CONTRIBUTION_DOMAIN_AND_SOURCE_PREDICATE_RETURN',complete=complete,examined=budget.examined,
            values={'native_scope':native.scope,'native_operation_ref':native.operation_ref,'native_mode':native.mode,
                'native_values':native.values,'source_question_ref':request.source_question_ref,'condition_measurements':tuple(rows),
                'missing_condition_refs':tuple(missing),'missing_native_refs':native.prerequisite_refs,'implementation_debt_refs':native.implementation_debt_refs,
                'source_question_evidence_refs':request.source_question_evidence_refs,'native_domain_complete':native.domain_complete,
                'native_use_attested':False,'action_released':False},frontier=native.frontier,
            descriptive_delta={'has_complete_current_native_domain':complete,'has_measured_current_goal_contribution':matched,
                'native_domain_exhausted_without_goal_match':complete and not matched})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_same_native_question':True,'work':error.frontier})


def annotate_native_goal_result_d(request,result,values,facts,work,started_at):
    """Compose only bounded calculation outputs at the existing delta boundary."""
    examined=result.examined_count+work
    if (monotonic()-started_at)*1000>request.time_bound_ms:
        return d_result(request,'BUDGET_REACHED','NATIVE_POSTCONDITION_TIME_BOUND',examined=examined,
            frontier={'restart_same_native_question_with_result_checks':True})
    if examined>request.node_bound:
        return d_result(request,'BUDGET_REACHED','NATIVE_POSTCONDITION_WORK_BOUND',examined=examined,
            frontier={'restart_same_native_question_with_result_checks':True})
    descriptive={key:result.descriptive_facts.get(key,False) for key in (
        'has_complete_current_native_domain','has_measured_current_goal_contribution','native_domain_exhausted_without_goal_match')}
    descriptive.update(facts)
    return d_result(request,result.status,result.cause,complete=result.domain_complete,examined=examined,
        values={**dict(result.values),**values},frontier=result.frontier,descriptive_delta=descriptive)
