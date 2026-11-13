"""Readonly ordered-feature and labeled-predicate methods, with explicit grammar."""
import time
from agents.yf_arc3_v5.capabilities.ordered_predicate_features_d import OrderedPredicateFeaturesRequestD,measure_ordered_predicate_features_d
from agents.yf_arc3_v5.capabilities.labeled_predicate_induction_d import LabeledPredicateInductionRequestD,measure_labeled_predicate_induction_d
from rooted_quota_methods import plain
from terminal_composition import identity

def scope(obs,scene,operation):
    return {'request_ref':operation+':'+identity([obs['observation_ref'],scene['context_ref']]),'caller_ref':'public_labeled_sequence_question','parent_consumer_ref':'SRC_composition','parent_goal_ref':'G_official_completion','parent_contribution_ref':'classify_current_measured_sequence','caller_next_item_ref':obs['observation_ref'],'epoch':obs['level_epoch'],'evidence_revision_ref':obs['observation_ref'],'model_revision_ref':scene['context_ref'],'model_status_ref':'conditional_geometric_labels_and_finite_declared_grammar','event_owner_ref':'SRC','input_domain_complete':True,'assumption_refs':['paired_panels_as_labeled_examples','uniform_squares_as_ordered_tokens_nonuniform_anchor_excluded','same_palette_buttons_as_label_controls','finite_grammar_complete_only_as_declared_not_universal','agreement_does_not_prove_unique_law']}

def features(words,queries,scene,obs,deadline):
    models=[{'model_ref':ref,'tokens':[{'occurrence_ref':ref+':'+str(i),'type_ref':str(v),'visible':True}for i,v in enumerate(values)],'order_and_segmentation_complete':True}for ref,values in words]
    request=OrderedPredicateFeaturesRequestD(scope=scope(obs,scene,'features'),operation_ref='mechanics.visual_sequence.ordered_predicate_features',mode_ref='EVALUATE',phase_ref='FINITE_ORDERED_FEATURES',requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=128,domain_bound=4096,time_bound_ms=max(1,min(300000,int((deadline-time.perf_counter())*1000))),models=models,queries=queries)
    return plain(measure_ordered_predicate_features_d(request).model_dump())

def infer(scene,obs,deadline,cfg,prior=None):
    queries=[{'feature_ref':k,'kind':k,'type_ref':None}for k in cfg['features']]
    queries += [{'feature_ref':'COUNT:'+str(v),'kind':'TYPE_COUNT','type_ref':str(v)}for v in scene['palette']]
    labels=[str(p['label'])for p in scene['panels']];examples=[];words=[]
    for panel in scene['panels']:
        for i,word in enumerate(panel['words']):
            ref='example:'+str(panel['label'])+':'+str(i);words.append([ref,word['values']]);examples.append({'example_ref':ref,'receipt_ref':obs['observation_ref']+'/'+ref,'label_ref':str(panel['label']),'sealed':True,'epoch':obs['level_epoch']})
    reused=bool(prior and prior.get('epoch')==obs['level_epoch']and prior.get('context_ref')==scene['context_ref']and prior.get('queries')==queries)
    training=prior['training_features']if reused else features(words,queries,scene,obs,deadline)
    if training['status']!='COMPLETE':return None
    query_ref='current_query';query=features([[query_ref,scene['query']['words'][0]['values']]],queries,scene,obs,deadline)
    if query['status']!='COMPLETE':return None
    rows=training['values']['model_feature_rows']+query['values']['model_feature_rows'];assignments=[];values={}
    for row in rows:
        for f in row['features']:
            assignments.append([row['model_ref'],f['feature_ref'],f['value']])
            if row['model_ref']!=query_ref:values.setdefault(f['feature_ref'],set()).add(f['value'])
    grammar=[];roots=[]
    for ref,seen in sorted(values.items()):
        for value in sorted(seen):
            comparisons=['EQ']if type(value)is bool else cfg['comparisons']
            for comparison in comparisons:
                ident='P:'+identity([ref,comparison,value]);node={'node_ref':ident,'kind':'ATOM','feature_ref':ref,'comparator':comparison,'value':value,'child_refs':[]};grammar.append(node);roots.append(ident)
                inv=ident+':NOT';grammar.append({'node_ref':inv,'kind':'NOT','feature_ref':None,'comparator':None,'value':None,'child_refs':[ident]});roots.append(inv)
    if len(roots)>cfg['root_bound']:return None
    request=LabeledPredicateInductionRequestD(scope=scope(obs,scene,'induction'),operation_ref='mechanics.visual_sequence.labeled_predicate_induction',mode_ref='PREDICT',phase_ref='FINITE_LABELED_GRAMMAR',requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=128,domain_bound=4096,time_bound_ms=max(1,min(300000,int((deadline-time.perf_counter())*1000))),grammar=grammar,predicate_root_refs=roots,positive_label_ref=labels[0],negative_label_ref=labels[1],examples=examples,models=[{'model_ref':scene['context_ref'],'feature_values':assignments,'submission_preconditions':[[v,True]for v in labels],'measurement_complete':True}],query_example_ref=query_ref,grammar_domain_complete=True,assignment_domain_complete=True)
    result=plain(measure_labeled_predicate_induction_d(request).model_dump())
    cache={'epoch':obs['level_epoch'],'context_ref':scene['context_ref'],'queries':queries,'training_features':training,'controls':scene['buttons']}
    return {'training_cache':cache,'training_reused':reused,'query_features':query,'induction':result,'grammar':grammar,'scope':'Finite atomic/complement grammar, constants from measured training feature values; no universal uniqueness or invented future query.'}
