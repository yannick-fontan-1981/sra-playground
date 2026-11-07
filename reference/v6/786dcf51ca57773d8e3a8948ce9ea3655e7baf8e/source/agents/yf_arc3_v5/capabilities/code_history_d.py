"""Bounded exact joins of declared evidence; no forecast is assimilated as fact."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data


def bind_code_history_and_exacts_d(request):
    from .articulated_dependency_measurement_c import _nodes
    if not request.prior_history and not request.preserved_exacts and not request.history_support:return request,(),0
    if request.state is None or request.active_model_epoch is None:
        return request,('code.current_state_and_model_epoch_for_retained_evidence',),0
    work=_nodes(immutable_json_data((request.prior_history,request.history_support,request.preserved_exacts)),request.maximum_evaluations)
    if work is None:return request,('code.complete_retained_evidence_projection_bound',),0
    checks=(len(request.history_support)+len(request.preserved_exacts))*len(request.scope.assumption_refs)
    checks+=4*(len(request.prior_history)+len(request.state.history))+12*len(request.preserved_exacts)
    if work+checks>=request.maximum_evaluations:return request,('code.complete_retained_evidence_comparison_bound',),work
    work+=checks;missing=[]
    supports={row.evidence_ref:row.support_claim_ref for row in request.history_support}
    if (len(supports)!=len(request.history_support) or set(supports)!={row.evidence_ref for row in request.prior_history}
            or any(supports[ref] not in request.scope.assumption_refs for ref in sorted(supports))):
        missing.append('code.current_supported_complete_prior_history_inventory')
    rows={};ordered=[]
    for row in (*request.prior_history,*request.state.history):
        if (row.model_epoch!=request.active_model_epoch or row.evidence_status!='OBSERVED'
                or len(row.trial)>len(request.state.proposal)
                or any(value is not None and value not in request.alphabet for value in row.trial)):
            missing.append('code.current_observed_rank_domain_history')
        if row.evidence_ref in rows and rows[row.evidence_ref]!=row:
            missing.append('code.conflicting_feedback_reading_or_model')
        elif row.evidence_ref not in rows:rows[row.evidence_ref]=row;ordered.append(row)
    if len(ordered)>256:missing.append('code.complete_history_retention_bound')
    exact={}
    for constraint in request.preserved_exacts:
        if (constraint.model_epoch!=request.active_model_epoch or constraint.support_claim_ref not in request.scope.assumption_refs
                or constraint.rank>=len(request.state.proposal) or constraint.value_ref not in request.alphabet):
            missing.append('code.current_exact_rank_scope_and_support')
        if constraint.rank in exact and exact[constraint.rank]!=constraint.value_ref:
            missing.append('code.conflicting_exact_rank_constraints')
        exact[constraint.rank]=constraint.value_ref
        if constraint.rank<len(request.state.revealed) and request.state.revealed[constraint.rank] not in (None,constraint.value_ref):
            missing.append('code.current_revelation_contradicts_preserved_exact')
    if missing:return request,tuple(sorted(set(missing))),work
    state=request.state.model_copy(update={'history':tuple(ordered)})
    return request.model_copy(update={'state':state,'maximum_evaluations':request.maximum_evaluations-work}),(),work


def code_trial_preservation_d(request,trial):
    return FrozenMap({'trial_ref':trial.trial_ref,
        'preserved_exact_ranks_satisfied':all(trial.values[row.rank]==row.value_ref for row in request.preserved_exacts),
        'exact_rank_constraint_refs':tuple(row.support_claim_ref for row in request.preserved_exacts),
        'proposal_preparation_is_secret_knowledge':False})
