"""Finite V5 accounting, with observed feedback and explicit model alternatives."""
from itertools import permutations,product
from agents.yf_arc3_v5.capabilities.feedback_code_identification import (
    FeedbackAccountingLaw,CodeFeedbackRow,CodeInterfaceState,CodeTrial,
    FeedbackCodeRequest,measure_feedback_code_identification)
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_a import MechanicalFamilyScope
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain

def choose(alphabet,length,prefix,history,revealed,repeatable,observation,budget,configuration):
    """Never receives a secret; returns no recommendation for an incomplete domain."""
    refs=tuple('value:'+str(v) for v in alphabet);prefix=tuple('value:'+str(v) for v in prefix)
    n=length;codes_count=len(refs)**n
    if codes_count>configuration['maximum_candidates']:return {'status':'candidate_bound','count_lower_bound':codes_count}
    marks=sorted({m for row in history for m in row['marks']})
    if len(marks)>3:return {'status':'unsupported_feedback_classes'}
    while len(marks)<3:marks.append('unseen_style:'+str(len(marks)))
    laws=[]
    # Label permutations remain hypotheses. Exact rank revelations constrain
    # their fit through complete candidates; no mark/color is intrinsically E.
    for e,d,a in permutations(marks):
        for order in configuration['allocation_orders']:
            laws.append(FeedbackAccountingLaw(law_ref='law:'+str(len(laws)),exact_ref=e,elsewhere_ref=d,absent_ref=a,allocation_order=order))
    if not history:
        # Renaming unobserved marks cannot alter a partition's sizes. Quotient
        # this symmetry only before any response has given the marks identities.
        laws=laws[:1]
    rows=tuple(CodeFeedbackRow(evidence_ref=h['ref'],model_epoch=observation['level_epoch'],trial=tuple('value:'+str(v) for v in h['values']),feedback=tuple(h['marks'])) for h in history)
    state=CodeInterfaceState(proposal=prefix+(None,)*(n-len(prefix)),revealed=tuple(None if v is None else 'value:'+str(v) for v in revealed),attempts_remaining=max(0,budget//(n+1)),history=rows,recovery_epoch=0)
    scope=MechanicalFamilyScope(request_ref='feedback:'+observation['observation_ref'],caller_ref='information_goal',parent_goal_ref='G_official_completion',parent_contribution_ref='ordered_proposal',epoch=observation['level_epoch'],evidence_revision_ref=observation['observation_ref'],model_revision_ref='observed_rows:'+str(len(history)),model_status_ref='hypothesis',event_owner_ref='feedback_sequences',input_domain_complete=True)
    kwargs=dict(scope=scope,alphabet=refs,secret_length=n,duplicates_allowed=True,candidate_domain_complete=True,candidate_source='ENUMERATE',active_model_epoch=observation['level_epoch'],laws=tuple(laws),state=state,
                maximum_candidates=configuration['maximum_candidates'],maximum_states=32,maximum_evaluations=configuration['maximum_evaluations'],maximum_attempt_depth=0)
    filtered=measure_feedback_code_identification(FeedbackCodeRequest(operation_ref='constraint_filter',mode='PROPAGATE',**kwargs))
    values=plain(filtered.values)
    if not filtered.domain_complete:return {'status':'feedback_contradiction_or_bound','prerequisites':list(filtered.prerequisite_refs),'bound':filtered.computation_bound_reached}
    candidates=values['candidate_residual'];legal=[tuple(c) for c in candidates if tuple(c[:len(prefix)])==prefix and (repeatable is not False or len(set(c))==len(c))]
    if not legal:return {'status':'preserved_prefix_has_no_admissible_trial','candidates':len(candidates)}
    if len(legal)>configuration['maximum_trials']:return {'status':'trial_bound','candidates':len(candidates),'trials':len(legal)}
    trials=tuple(CodeTrial(trial_ref='trial:'+str(i),values=c) for i,c in enumerate(legal))
    parts=measure_feedback_code_identification(FeedbackCodeRequest(operation_ref='trial_partitions',mode='DOMAIN',trials=trials,declared_measures=tuple(configuration['measures']),**kwargs))
    if not parts.domain_complete:return {'status':'partition_bound','bound':parts.computation_bound_reached}
    table=plain(parts.values)['partitions'];order={t.trial_ref:t.values for t in trials}
    scored=[]
    for p in table:
        counts=dict(p['declared_measures']);score=tuple(counts[k] for k in configuration['measures']);trial=order[p['trial_ref']]
        scored.append((score,trial,p))
    score,trial,partition=min(scored,key=lambda x:(x[0],x[1]))
    needed=n-len(prefix)+1
    if needed>budget:return {'status':'input_budget','needed':needed,'remaining':budget}
    return {'status':'proposed','trial':[int(v.split(':')[1]) for v in trial], 'candidate_count':len(candidates),
            'law_alternatives':len(values['compatible_law_refs']),'trial_count':len(legal),'minimax':dict(zip(configuration['measures'],score)),
            'partition_count':len(partition['branches']),'information_cost':needed,'scope':'minimum worst residual among complete plausible codes preserving the active prefix; no multi-attempt success guarantee',
            'assumptions':['positionwise_exact_elsewhere_absent_feedback','unrevealed_values_remain_possible','secret_repetitions_not_excluded_by_palette_removal'],
            'evidence':[h['ref'] for h in history]}
