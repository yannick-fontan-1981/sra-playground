"""Revision-keyed finite integer domains with exact incomplete-prefix continuation."""
from __future__ import annotations
from time import monotonic
from typing import ClassVar, Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref
from .mechanical_family_contracts_d import DMechanicalRequest,DWorkBudget,DComputationInterrupted,d_validate_request,d_result,d_input_digest


class IncrementalVariableD(FrozenModel):
    variable_ref: Ref
    values: tuple[int,...]=Field(min_length=1,max_length=4096)


class IncrementalLinearRelationD(FrozenModel):
    relation_ref: Ref
    coefficients: tuple[tuple[Ref,int],...]=Field(min_length=1,max_length=128)
    comparator: Literal['EQ','LE','GE']
    bound: int


class IncrementalDomainBudgetRequestD(DMechanicalRequest):
    schema_version: Ref='yf_arc3_v5.incremental_domain_budget_request_d.v1'
    phase_ref: Literal['EXTEND_REVISION_KEYED_FINITE_DOMAIN']
    variables: tuple[IncrementalVariableD,...]=Field(min_length=1,max_length=128)
    relations: tuple[IncrementalLinearRelationD,...]=Field(default=(),max_length=4096)
    retained_target_ms: int=Field(ge=1)
    retained_ceiling_ms: int=Field(ge=1)
    initialization_scope_ref: Ref
    action_cycle_measurement_scope_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.performance.incremental_domain_budget','EXTEND'),)

    @model_validator(mode='after')
    def exact_finite_domain(self):
        ids={v.variable_ref for v in self.variables}
        if len(ids)!=len(self.variables) or any(len(set(v.values))!=len(v.values) for v in self.variables):
            raise ValueError('finite variable identities/values duplicated')
        if any(not {ref for ref,_ in r.coefficients}<=ids or len(dict(r.coefficients))!=len(r.coefficients) for r in self.relations):
            raise ValueError('linear relation outside the exact finite variable domain')
        if self.retained_target_ms>self.retained_ceiling_ms or self.time_bound_ms>self.retained_ceiling_ms:
            raise ValueError('keep the inherited target and ceiling without silently enlarging either')
        return self


def measure_incremental_domain_budget_d(request: IncrementalDomainBudgetRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    digest=d_input_digest(request)
    cursor,accepted,old_nodes=0,[],0
    initialized=monotonic()
    size=1
    for variable in request.variables:size*=len(variable.values)
    initialization_ms=(monotonic()-initialized)*1000
    if request.resume_frontier:
        frontier=request.resume_frontier
        if frontier.get('input_digest')!=digest:
            return d_result(request,'NEEDS_EVIDENCE','REVISION_KEYED_DOMAIN_RESUME_MISMATCH')
        cursor=int(frontier['next_linear_index'])
        accepted=list(frontier['accepted_rows'])
        old_nodes=int(frontier['cumulative_expansion_count'])
        if not 0<=cursor<=size or len(accepted)>request.domain_bound:
            return d_result(request,'NEEDS_EVIDENCE','DOMAIN_CURSOR_OR_RESULT_BOUND_MISMATCH')
    try:
        while cursor<size:
            budget.visit({'stage':'mixed_radix_candidate','linear_index':cursor})
            index=cursor
            values=[]
            for variable in reversed(request.variables):
                index,rank=divmod(index,len(variable.values));values.append(variable.values[rank])
            values.reverse()
            vector={v.variable_ref:value for v,value in zip(request.variables,values)}
            admitted=True
            for relation in request.relations:
                budget.visit({'stage':'exact_linear_relation','linear_index':cursor,'relation_ref':relation.relation_ref})
                total=sum(vector[ref]*coefficient for ref,coefficient in relation.coefficients)
                satisfies=total==relation.bound if relation.comparator=='EQ' else total<=relation.bound if relation.comparator=='LE' else total>=relation.bound
                if not satisfies:admitted=False;break
            if admitted:
                if len(accepted)>=request.domain_bound:raise DComputationInterrupted('RETURNED_DOMAIN_BOUND',{})
                accepted.append(tuple((v.variable_ref,value) for v,value in zip(request.variables,values)))
            cursor+=1
        budget.finish()
        return d_result(request,'COMPLETE','EXHAUSTED_REVISION_KEYED_INTEGER_DOMAIN',complete=True,examined=budget.examined,
            values={'admitted_value_rows':tuple(accepted),'finite_cardinality':size,'next_linear_index':cursor,
                'cumulative_expansion_count':old_nodes+budget.examined,'initialization_ms':initialization_ms,
                'calculation_elapsed_ms':(monotonic()-budget.started)*1000,'action_cycle_measurement_performed':False,
                'retained_target_ms':request.retained_target_ms,'retained_ceiling_ms':request.retained_ceiling_ms,
                'initialization_scope_ref':request.initialization_scope_ref,'action_cycle_measurement_scope_ref':request.action_cycle_measurement_scope_ref})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,
            values={'finite_cardinality':size,'completed_candidate_count':cursor,'initialization_ms':initialization_ms,
                'calculation_elapsed_ms':(monotonic()-budget.started)*1000,'domain_exhausted':False,'meaning_weakened_for_latency':False},
            frontier={'input_digest':digest,'next_linear_index':cursor,'accepted_rows':tuple(accepted),
                'cumulative_expansion_count':old_nodes+budget.examined,'finite_cardinality':size,'work':error.frontier})
