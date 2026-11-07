"""Finite supplied grammar, joint observation assignments and nonvacuous agreement."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result

ScalarD=bool|int|str|None


class PredicateNodeD(FrozenModel):
    node_ref: Ref
    kind: Literal['ATOM','AND','OR','NOT']
    feature_ref: Ref | None
    comparator: Literal['EQ','NE','LT','LE','GT','GE'] | None
    value: ScalarD
    child_refs: tuple[Ref,...] = Field(default=(),max_length=128)


class LabeledSequenceExampleD(FrozenModel):
    example_ref: Ref
    receipt_ref: Ref
    label_ref: Ref
    sealed: bool
    epoch: int = Field(ge=0)


class PredicateFeatureAssignmentD(FrozenModel):
    model_ref: Ref
    feature_values: tuple[tuple[Ref,Ref,ScalarD],...] = Field(default=(),max_length=4096)
    submission_preconditions: tuple[tuple[Ref,bool|None],...] = Field(default=(),max_length=128)
    measurement_complete: bool


class PredicateContrastD(FrozenModel):
    example_ref: Ref
    actual_observation_channel_ref: Ref | None
    descriptive_only: bool


class LabeledPredicateInductionRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.labeled_predicate_induction_request_d.v1'
    phase_ref: Literal['FINITE_LABELED_GRAMMAR']
    grammar: tuple[PredicateNodeD,...] = Field(min_length=1,max_length=4096)
    predicate_root_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    positive_label_ref: Ref
    negative_label_ref: Ref
    examples: tuple[LabeledSequenceExampleD,...] = Field(default=(),max_length=4096)
    models: tuple[PredicateFeatureAssignmentD,...] = Field(min_length=1,max_length=128)
    query_example_ref: Ref | None
    contrasts: tuple[PredicateContrastD,...] = Field(default=(),max_length=4096)
    grammar_domain_complete: bool
    assignment_domain_complete: bool
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = tuple(
        ('mechanics.visual_sequence.labeled_predicate_induction',mode) for mode in ('FIT','PREDICT','PARTITION'))

    @model_validator(mode='after')
    def explicit_grammar(self):
        nodes={n.node_ref:n for n in self.grammar}
        if len(nodes)!=len(self.grammar) or not set(self.predicate_root_refs)<=set(nodes) or self.positive_label_ref==self.negative_label_ref:
            raise ValueError('finite grammar/root/label identity invalid')
        closed=set()
        for node in self.grammar:
            if node.kind=='ATOM' and (node.feature_ref is None or node.comparator is None or node.child_refs):
                raise ValueError('atomic predicate needs only its declared feature/comparator')
            if node.kind=='NOT' and len(node.child_refs)!=1 or node.kind in ('AND','OR') and not node.child_refs:
                raise ValueError('licensed logical predicate arity invalid')
            pending=[(node.node_ref,False)]
            active=set()
            while pending:
                ref,leaving=pending.pop()
                if leaving:
                    active.discard(ref);closed.add(ref);continue
                if ref in closed:continue
                if ref not in nodes or ref in active:raise ValueError('grammar is not an acyclic supplied expression graph')
                active.add(ref);pending.append((ref,True))
                pending.extend((child,False) for child in nodes[ref].child_refs)
        for model in self.models:
            identities=[(e,f) for e,f,_ in model.feature_values]
            if len(set(identities))!=len(identities) or len(dict(model.submission_preconditions))!=len(model.submission_preconditions):
                raise ValueError('joint feature assignment/precondition duplicated')
        if any(e.label_ref not in (self.positive_label_ref,self.negative_label_ref) for e in self.examples):
            raise ValueError('actual label outside the supplied binary class domain')
        return self


def _predicate_value(root,nodes,features,example,budget,depth_bound):
    memo={}
    pending=[(root,False,0)]
    while pending:
        ref,leaving,depth=pending.pop()
        if ref in memo:continue
        if depth>depth_bound:raise DComputationInterrupted('PREDICATE_DEPTH_BOUND',{'node_ref':ref})
        node=nodes[ref]
        budget.visit({'stage':'licensed_predicate','node_ref':ref,'example_ref':example})
        if node.kind=='ATOM':
            current=features.get((example,node.feature_ref))
            if current is None or node.value is None:
                memo[ref]=None
            elif node.comparator=='EQ':memo[ref]=type(current) is type(node.value) and current==node.value
            elif node.comparator=='NE':memo[ref]=type(current) is not type(node.value) or current!=node.value
            elif type(current) is not type(node.value) or not isinstance(current,(int,float)) or isinstance(current,bool):
                memo[ref]=None
            else:
                memo[ref]={'LT':current<node.value,'LE':current<=node.value,'GT':current>node.value,'GE':current>=node.value}[node.comparator]
        elif not leaving:
            pending.append((ref,True,depth))
            pending.extend((child,False,depth+1) for child in node.child_refs)
        else:
            values=[memo[c] for c in node.child_refs]
            if node.kind=='NOT':memo[ref]=None if values[0] is None else not values[0]
            elif node.kind=='AND':memo[ref]=False if False in values else None if None in values else True
            else:memo[ref]=True if True in values else None if None in values else False
    return memo[root]


def measure_labeled_predicate_induction_d(request: LabeledPredicateInductionRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.grammar),sum(len(m.feature_values) for m in request.models),len(request.examples),len(request.contrasts))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_FINITE_VERSION_SPACE_FROM_ASSIGNMENTS')
    budget=DWorkBudget(request)
    try:
        actual=[e for e in request.examples if e.sealed and e.epoch==request.scope.epoch]
        if not actual:return d_result(request,'NEEDS_EVIDENCE','SEALED_LABELED_EXAMPLES_REQUIRED')
        if request.mode_ref=='PREDICT' and request.query_example_ref is None:
            return d_result(request,'NEEDS_EVIDENCE','MEASURED_QUERY_NOT_BOUND')
        nodes={n.node_ref:n for n in request.grammar}
        version,eliminations,predictions=[],[],[]
        incomplete=not request.grammar_domain_complete or not request.assignment_domain_complete
        for model in request.models:
            features={(e,f):v for e,f,v in model.feature_values}
            prerequisites=dict(model.submission_preconditions)
            for root in request.predicate_root_refs:
                counterexamples=[]
                unknown=not model.measurement_complete
                for example in actual:
                    value=_predicate_value(root,nodes,features,example.example_ref,budget,request.depth_bound)
                    if value is None:unknown=True
                    elif (request.positive_label_ref if value else request.negative_label_ref)!=example.label_ref:
                        counterexamples.append(example.receipt_ref)
                if counterexamples:
                    eliminations.append({'model_ref':model.model_ref,'predicate_ref':root,'actual_counterexample_receipt_refs':tuple(counterexamples)})
                    continue
                version.append({'model_ref':model.model_ref,'predicate_ref':root,'observation_check_complete':not unknown})
                incomplete=incomplete or unknown
                query_refs=([request.query_example_ref] if request.mode_ref=='PREDICT' else [c.example_ref for c in request.contrasts])
                for query in query_refs:
                    value=_predicate_value(root,nodes,features,query,budget,request.depth_bound)
                    label=None if value is None else request.positive_label_ref if value else request.negative_label_ref
                    ready=prerequisites.get(label) if label is not None else None
                    predictions.append({'model_ref':model.model_ref,'predicate_ref':root,'query_ref':query,
                        'predicted_label_ref':label,'submission_precondition':ready,'actual_training_receipt':False})
                    incomplete=incomplete or value is None or ready is None
        disagreement=[]
        if request.mode_ref=='PARTITION':
            for contrast in request.contrasts:
                rows=[p for p in predictions if p['query_ref']==contrast.example_ref]
                outcomes={(p['predicted_label_ref'],p['submission_precondition']) for p in rows if p['predicted_label_ref'] is not None}
                if len(outcomes)>1:
                    disagreement.append({'query_ref':contrast.example_ref,'assignment_predictions':tuple(rows),
                        'actual_observation_channel_ref':contrast.actual_observation_channel_ref,
                        'descriptive_counterexample_only':contrast.descriptive_only or contrast.actual_observation_channel_ref is None})
        labels={(p['predicted_label_ref'],p['submission_precondition']) for p in predictions}
        robust=request.mode_ref=='PREDICT' and bool(version) and not incomplete and len(labels)==1
        contradiction=not version and request.grammar_domain_complete and request.assignment_domain_complete
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if incomplete else 'COMPLETE','MODEL_CONTRADICTION' if contradiction else
            'INCOMPLETE_GRAMMAR_OR_MEASUREMENTS' if incomplete else 'FINITE_LABELED_PREDICATE_RESULT',complete=not incomplete,examined=budget.examined,
            values={'observation_compatible_version_space':tuple(version),'elimination_certificates':tuple(eliminations),
                'label_predictions':tuple(predictions),'robust_answer_and_submission_agreement':robust,
                'distinguishing_queries':tuple(disagreement),'unique_law_proved':False,'rule_adoption_authorized':False,
                'classification_submission_authorized':False,'predicted_training_example_created':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_finite_version_space':True,'unexamined_assignments_remain':True,'work':error.frontier})
