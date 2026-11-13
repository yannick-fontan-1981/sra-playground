"""Exact Source-bound D-kernel questions with scoped result/goal measurements."""
from .mechanical_family_contracts_d import DWorkBudget,DComputationInterrupted,d_validate_request,d_result
from .program_recipe_goal_audit_d import _goal_child_current
from .native_goal_domain_audit_d import _native_value_at_path,_native_condition_matches


def measure_bound_d_native_goal_domain_d(request,calculation):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        child=request.native_request
        if not _goal_child_current(request,child) or (child.operation_ref,child.mode_ref) not in request.native_allowed_pairs:
            return d_result(request,'NEEDS_EVIDENCE','CURRENT_EXACT_D_NATIVE_QUESTION_AND_PARENT_REQUIRED')
        if len({c.condition_ref for c in request.result_conditions})!=len(request.result_conditions):
            return d_result(request,'NEEDS_EVIDENCE','DISTINCT_SOURCE_RESULT_CONDITIONS_REQUIRED')
        for condition in request.result_conditions:
            if (condition.goal_contribution_ref!=request.scope.parent_contribution_ref or condition.epoch!=request.scope.epoch or
                    condition.evidence_revision_ref!=request.scope.evidence_revision_ref or condition.model_revision_ref!=request.scope.model_revision_ref):
                return d_result(request,'NEEDS_EVIDENCE','CURRENT_D_NATIVE_GOAL_PREDICATE_SCOPE_REQUIRED')
        reserve=1+sum(len(c.field_path)+1 for c in request.result_conditions)
        if request.node_bound<=reserve:
            return d_result(request,'BUDGET_REACHED','D_NATIVE_QUESTION_AND_CHECK_WORK_REQUIRED',frontier={'restart_same_d_native_question':True})
        budget.visit({'stage':'source_bound_d_native_question','question_ref':request.source_question_ref})
        native=calculation(child.model_copy(update={'node_bound':min(child.node_bound,request.node_bound-reserve),
            'depth_bound':min(child.depth_bound,request.depth_bound),'domain_bound':min(child.domain_bound,request.domain_bound),
            'time_bound_ms':min(child.time_bound_ms,request.time_bound_ms)}))
        budget.examined+=native.examined_count
        rows=[];missing=[]
        for condition in request.result_conditions:
            for index in range(len(condition.field_path)+1):budget.visit({'stage':'native_result_field_path','condition_ref':condition.condition_ref,'path_index':index})
            present,actual=_native_value_at_path(native.values,condition.field_path)
            if not present:missing.append(condition.condition_ref)
            rows.append({'condition_ref':condition.condition_ref,'present':present,'matched':present and _native_condition_matches(actual,condition),
                'actual':actual,'field_path':condition.field_path,'evidence_ref':condition.evidence_ref})
        complete=native.domain_complete and native.status=='COMPLETE' and not missing
        matches=complete and all(row['matched'] for row in rows)
        budget.finish()
        return d_result(request,'COMPLETE' if complete else 'BUDGET_REACHED' if native.status=='BUDGET_REACHED' else 'NEEDS_EVIDENCE',
            'EXACT_D_NATIVE_DOMAIN_AND_GOAL_CONTRIBUTION_MEASUREMENTS',complete=complete,examined=budget.examined,
            values={'native_scope':native.scope,'native_operation_ref':native.operation_ref,'native_mode':native.mode_ref,
                'native_status':native.status,'native_cause':native.cause,'native_values':native.values,
                'condition_measurements':tuple(rows),'missing_condition_refs':tuple(missing),'source_question_ref':request.source_question_ref,
                'source_question_evidence_refs':request.source_question_evidence_refs,'actual_use_attested':False,'action_released':False},frontier=native.frontier,
            descriptive_delta={'has_complete_current_native_domain':complete,'has_measured_current_goal_contribution':matches,
                'native_domain_exhausted_without_goal_match':complete and not matches})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_same_d_native_question':True,'work':error.frontier})
