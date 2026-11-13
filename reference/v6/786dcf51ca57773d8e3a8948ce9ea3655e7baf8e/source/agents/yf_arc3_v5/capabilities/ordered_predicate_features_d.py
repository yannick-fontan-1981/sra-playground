"""Requested ordered-sequence descriptors; no class label or hidden rule list."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class OrderedTokenD(FrozenModel):
    occurrence_ref: Ref
    type_ref: Ref | None
    visible: bool


class OrderedSequenceAssignmentD(FrozenModel):
    model_ref: Ref
    tokens: tuple[OrderedTokenD,...] = Field(default=(),max_length=4096)
    order_and_segmentation_complete: bool

    @model_validator(mode='after')
    def occurrences(self):
        if len({t.occurrence_ref for t in self.tokens})!=len(self.tokens):
            raise ValueError('ordered token occurrence identity duplicated')
        return self


class OrderedFeatureQueryD(FrozenModel):
    feature_ref: Ref
    kind: Literal['LENGTH','TYPE_COUNT','ENDPOINT_EQUAL','ADJACENT_EQUAL_PAIRS','ALL_ADJACENT_DIFFERENT',
        'MAXIMAL_RUNS','TYPE_RUN_COUNT','ONE_CONTIGUOUS_RUN_PER_TYPE']
    type_ref: Ref | None


class OrderedPredicateFeaturesRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.ordered_predicate_features_request_d.v1'
    phase_ref: Literal['FINITE_ORDERED_FEATURES']
    models: tuple[OrderedSequenceAssignmentD,...] = Field(min_length=1,max_length=128)
    queries: tuple[OrderedFeatureQueryD,...] = Field(min_length=1,max_length=128)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.visual_sequence.ordered_predicate_features','EVALUATE'),
    )

    @model_validator(mode='after')
    def grammar_scope(self):
        if len({q.feature_ref for q in self.queries})!=len(self.queries) or any(
                q.kind in ('TYPE_COUNT','TYPE_RUN_COUNT') and q.type_ref is None for q in self.queries):
            raise ValueError('requested finite feature grammar has duplicate or unbound scope')
        return self


def _ordered_feature_values(model,queries,budget):
    tokens=model.tokens
    complete=model.order_and_segmentation_complete
    known=[t.visible and t.type_ref is not None for t in tokens]
    fully_read=complete and all(known)
    counts={}
    for index,token in enumerate(tokens):
        budget.visit({'stage':'requested_ordered_token','model_ref':model.model_ref,'index':index})
        if known[index]:counts[token.type_ref]=counts.get(token.type_ref,0)+1
    adjacent=[]
    for i in range(max(0,len(tokens)-1)):
        equal=tokens[i].type_ref==tokens[i+1].type_ref if known[i] and known[i+1] and complete else None
        adjacent.append({'positions':(i,i+1),'equal':equal})
    runs=[]
    if fully_read:
        for index,token in enumerate(tokens):
            if not runs or runs[-1]['type_ref']!=token.type_ref:
                runs.append({'type_ref':token.type_ref,'first_position':index,'last_position':index,'length':1})
            else:
                runs[-1]['last_position']=index
                runs[-1]['length']+=1
    run_counts={}
    for run in runs:run_counts[run['type_ref']]=run_counts.get(run['type_ref'],0)+1
    rows=[]
    for query in queries:
        budget.visit({'stage':'requested_feature','feature_ref':query.feature_ref})
        value=None
        witnesses=[]
        lower=None
        upper=None
        if query.kind=='LENGTH':
            value=len(tokens) if complete else None
            lower=len(tokens)
            upper=len(tokens) if complete else None
        elif query.kind=='TYPE_COUNT':
            lower=counts.get(query.type_ref,0)
            upper=lower+sum(not v for v in known) if complete else None
            value=lower if fully_read else None
        elif query.kind=='ENDPOINT_EQUAL':
            if complete and tokens and known[0] and known[-1]:
                value=tokens[0].type_ref==tokens[-1].type_ref
                if not value:witnesses.append((0,len(tokens)-1))
        elif query.kind=='ADJACENT_EQUAL_PAIRS':
            value=tuple(adjacent) if complete else None
        elif query.kind=='ALL_ADJACENT_DIFFERENT':
            witnesses=[r['positions'] for r in adjacent if r['equal'] is True]
            value=False if witnesses else True if fully_read else None
        elif query.kind=='MAXIMAL_RUNS':
            value=tuple(runs) if fully_read else None
        elif query.kind=='TYPE_RUN_COUNT':
            value=run_counts.get(query.type_ref,0) if fully_read else None
        else:
            if fully_read:
                repeated={ref for ref,count in sorted(run_counts.items()) if count>1}
                value=not repeated
                witnesses=[(run['first_position'],run['last_position']) for run in runs if run['type_ref'] in repeated]
        rows.append({'feature_ref':query.feature_ref,'kind':query.kind,'value':value,'lower_bound':lower,
            'upper_bound':upper,'counterexample_positions':tuple(witnesses),'requested_type_ref':query.type_ref})
    return rows


def measure_ordered_predicate_features_d(request: OrderedPredicateFeaturesRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.models),sum(len(m.tokens) for m in request.models),len(request.queries))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_ORDERED_FEATURES_FROM_ASSIGNMENTS')
    budget=DWorkBudget(request)
    try:
        rows=[]
        unknown=False
        for model in request.models:
            features=_ordered_feature_values(model,request.queries,budget)
            unknown=unknown or any(f['value'] is None for f in features)
            rows.append({'model_ref':model.model_ref,'features':tuple(features)})
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if unknown else 'COMPLETE','UNREAD_OR_UNSEGMENTED_SEQUENCE' if unknown else 'ORDERED_FEATURE_RESULT',
            complete=not unknown,examined=budget.examined,values={'model_feature_rows':tuple(rows),
                'assigned_class_label':None,'sequence_order_replaced_by_histogram':False,'sequence_is_world_time_series':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_ordered_features':True,'work':error.frontier})
