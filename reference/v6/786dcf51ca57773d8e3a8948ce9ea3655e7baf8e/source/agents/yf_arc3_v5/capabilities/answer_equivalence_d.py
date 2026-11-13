"""Bounded complete proposal equality, not hidden-law or action selection."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .answer_equivalence_contracts_d import AnswerEquivalenceResultD


def measure_answer_equivalence_d(request):
    from .articulated_dependency_measurement_c import _nodes
    missing=[];classes=[];work=0
    size=_nodes(immutable_json_data(request),request.maximum_evaluations)
    if size is None:
        return AnswerEquivalenceResultD(request=request,classes=(),facts=FrozenMap({'answer_scoped_agreement':False}),
            missing_refs=('answer.complete_input_projection_bound',),accounted_evaluations=0)
    work=size
    refs=tuple(row.model_ref for row in request.model_rows)
    if (len(set(request.retained_model_refs))!=len(request.retained_model_refs)
            or len(set(refs))!=len(refs) or set(refs)!=set(request.retained_model_refs)):
        missing.append('answer.exact_complete_unrejected_model_inventory')
    for row in sorted(request.model_rows,key=lambda row:row.model_ref):
        if row.evidence_scope_ref!=request.evidence_scope_ref or row.observation_compatible is not True:
            missing.append('answer.current_observation_compatible_model')
        missing.extend(row.missing_refs)
        if not row.proposal or not row.action_preconditions:
            missing.append('answer.complete_proposal_and_explicit_action_preconditions')
        projection_count=_nodes(immutable_json_data((row.proposal,row.action_preconditions)),request.maximum_evaluations-work)
        if projection_count is None or work+2*projection_count>request.maximum_evaluations:
            missing.append('answer.complete_proposal_hashing_bound');break
        work+=2*projection_count
        digest=stable_digest((row.proposal,row.action_preconditions))
        found=False
        for index,existing in enumerate(classes):
            if work+1>request.maximum_evaluations:
                missing.append('answer.complete_class_inventory_comparison_bound');break
            work+=1
            if existing['digest']!=digest:continue
            count=_nodes(immutable_json_data((row.proposal,row.action_preconditions)),request.maximum_evaluations-work)
            if count is None or work+count>request.maximum_evaluations:
                missing.append('answer.complete_equality_comparison_bound');break
            work+=count
            if existing['proposal']==row.proposal and existing['action_preconditions']==row.action_preconditions:
                classes[index]=FrozenMap.overlay({'model_refs':(*existing['model_refs'],row.model_ref)},existing)
                found=True;break
        if not found:
            classes.append(FrozenMap({'digest':digest,'model_refs':(row.model_ref,),
                'proposal':row.proposal,'action_preconditions':row.action_preconditions}))
    needs=tuple(sorted(set(missing)))
    agreement=not needs and len(classes)==1
    return AnswerEquivalenceResultD(request=request,classes=tuple(classes),missing_refs=needs,
        accounted_evaluations=work,facts=FrozenMap({'answer_scoped_agreement':agreement,
            'retained_model_refs':request.retained_model_refs,'law_ambiguity_retained':len(refs)>1,
            'unique_hidden_law_inferred':False,'action_preconditions_included_in_equality':True,
            'actor_input_or_model_commitment_authorized':False}))
