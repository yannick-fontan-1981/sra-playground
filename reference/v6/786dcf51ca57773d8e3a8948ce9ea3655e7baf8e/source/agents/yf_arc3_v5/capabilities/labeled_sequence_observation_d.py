"""Measured lanes into existing ordered-feature and labeled-predicate services.

The declared finite grammar and conditional interpretation come from DRM. Both
physical response loci remain candidates; no semantic label is chosen here.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap,stable_digest
from .ordered_lane_frame_observation_d import measure_ordered_lane_groups,box,overlap
from .ordered_predicate_features_d import (
    OrderedTokenD,OrderedSequenceAssignmentD,OrderedFeatureQueryD,OrderedPredicateFeaturesRequestD,
    measure_ordered_predicate_features_d)
from .labeled_predicate_induction_d import (
    PredicateNodeD,LabeledSequenceExampleD,PredicateFeatureAssignmentD,LabeledPredicateInductionRequestD,
    measure_labeled_predicate_induction_d)
from .mechanical_family_contracts_d import DMechanicalScope


def _scope(value,token,contract,suffix):
    return DMechanicalScope(**dict(contract['scope']),request_ref='measurement.lane_partition.'+token+suffix,
        evidence_revision_ref=value.current_observation_frame_ref,model_revision_ref=token,
        epoch=value.current_context_epoch or 0,input_domain_complete=True)


def _receipt_strip(scene,components):
    groups=scene['frame_groups'];isolated=scene['isolated_lane'];extent=min(g['quantum'] for g in groups)
    boxes=[g['box'] for g in groups]+[isolated['box']]
    rows={}
    for component in components:
        t,l,b,r=box(component);q=component.bbox.width
        if q!=component.bbox.height or not 1<q<extent or component.area!=q*q:continue
        if any(not(b<y or v<t or r<x or z<l) for y,x,v,z in boxes):continue
        rows.setdefault((t,q),[]).append(component)
    strips=[]
    frame_values={g['frame_value'] for g in groups}
    for (_,q),parts in sorted(rows.items()):
        if len(parts)<2:continue
        parts.sort(key=lambda p:p.bbox.left)
        gaps={b.bbox.left-a.bbox.left for a,b in zip(parts,parts[1:])}
        if len(gaps)!=1 or next(iter(gaps))<=q:continue
        prefix=[];remaining=[]
        for p in parts:
            (prefix if not remaining and p.value in frame_values else remaining).append(p.value)
        if len(set(remaining))>1 or any(v in frame_values for v in remaining):continue
        strips.append((tuple(prefix),tuple(box(p) for p in parts)))
    return strips[0] if len(strips)==1 else None


def measure_labeled_sequence_loci(value,frame,components,contract):
    if not contract or not value.current_observation_frame_ref:return ()
    scene=measure_ordered_lane_groups(frame,components,contract)
    if scene is None:return ()
    groups=scene['frame_groups'];isolated=scene['isolated_lane'];strip=_receipt_strip(scene,components)
    if strip is None:return ()
    prefix,strip_boxes=strip
    rows=tuple((i,row) for i,g in enumerate(groups) for row in g['rows'])
    words=tuple(row['values'] for _,row in rows)+(isolated['row']['values'],)
    types=tuple(sorted({v for word in words[:-1] for v in word}))
    if (len(rows)>contract['maximum_examples'] or len(types)>contract['maximum_types']
            or any(not word or len(word)>contract['maximum_occurrences'] for word in words)):return ()
    token=stable_digest((groups,scene['matched_rectangles'],isolated['box'],isolated['quantum'],strip_boxes,contract))
    carried=value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context') or {}
    prior=bool(carried.get('sequence_collection_geometry_token'));matches=None
    if prior:
        matches=(carried['sequence_collection_geometry_token']==token
            and carried.get('sequence_collection_context_epoch')==value.current_context_epoch
            and value.previous_action_observed_frame is not None
            and carried.get('sequence_collection_source_frame_digest')==stable_digest(value.previous_action_observed_frame.rows)
            and prefix==tuple(carried.get('sequence_collection_expected_receipt_prefix',())))
        if not matches:return ()
    queries=[]
    for template in contract['feature_queries']:
        for typ in types if template['type_bound'] else (None,):
            ref=template['feature_ref']+(('.'+str(typ)) if typ is not None else '')
            queries.append(OrderedFeatureQueryD(feature_ref=ref,kind=template['kind'],
                type_ref=('measurement.symbol.'+str(typ)) if typ is not None else None))
    assignments=tuple(OrderedSequenceAssignmentD(model_ref='measurement.lane.'+str(i),
        tokens=tuple(OrderedTokenD(occurrence_ref=f'measurement.occurrence.{i}.{j}',
            type_ref='measurement.symbol.'+str(typ),visible=True) for j,typ in enumerate(word)),
        order_and_segmentation_complete=True) for i,word in enumerate(words))
    features=measure_ordered_predicate_features_d(OrderedPredicateFeaturesRequestD(
        scope=_scope(value,token,contract,'.features'),operation_ref=contract['feature_operation_ref'],
        mode_ref='EVALUATE',phase_ref='FINITE_ORDERED_FEATURES',requested_result_type='DMechanicalResult',
        **dict(contract['calculation_bounds']),models=assignments,queries=tuple(queries)))
    if not features.domain_complete:return ()
    measured=features.values['model_feature_rows'];grammar=[]
    for query in queries:
        boolean=query.kind in contract['boolean_feature_kinds']
        thresholds=(True,) if boolean else tuple(range(max(map(len,words[:-1]))+1))
        for comparator in contract['atomic_comparators']:
            for threshold in thresholds:
                ref='measurement.predicate.'+stable_digest((query.feature_ref,comparator,threshold))
                grammar.append(PredicateNodeD(node_ref=ref,kind='ATOM',feature_ref=query.feature_ref,
                    comparator=comparator,value=threshold))
    if len(grammar)>contract['maximum_predicate_roots']:return ()
    all_roots=tuple(n.node_ref for n in grammar)
    roots=tuple(carried.get('sequence_collection_compatible_roots',())) if prior else all_roots
    if not roots or not set(roots)<=set(all_roots):return ()
    labels=tuple(contract['label_refs'])
    examples=tuple(LabeledSequenceExampleD(example_ref=assignments[i].model_ref,
        receipt_ref=value.current_observation_frame_ref,label_ref=labels[label],sealed=True,
        epoch=value.current_context_epoch) for i,(label,_) in enumerate(rows))
    feature_values=tuple((row['model_ref'],f['feature_ref'],f['value']) for row in measured for f in row['features'])
    result=measure_labeled_predicate_induction_d(LabeledPredicateInductionRequestD(
        scope=_scope(value,token,contract,'.predict'),operation_ref=contract['predicate_operation_ref'],mode_ref='PREDICT',
        requested_result_type='DMechanicalResult',phase_ref='FINITE_LABELED_GRAMMAR',**dict(contract['calculation_bounds']),
        grammar=tuple(grammar),predicate_root_refs=roots,positive_label_ref=labels[0],negative_label_ref=labels[1],
        examples=examples,models=(PredicateFeatureAssignmentD(model_ref='measurement.lane_assignment.'+token,
            feature_values=feature_values,submission_preconditions=tuple((label,True) for label in labels),measurement_complete=True),),
        query_example_ref=assignments[-1].model_ref,grammar_domain_complete=True,assignment_domain_complete=True))
    if not result.domain_complete:return ()
    compatible=tuple(r['predicate_ref'] for r in result.values['observation_compatible_version_space'])
    predictions=tuple(r['predicted_label_ref'] for r in result.values['label_predictions'])
    descriptors=tuple({'feature_ref':n.feature_ref,'comparator':n.comparator,'value':n.value,'node_ref':n.node_ref}
        for n in grammar if n.node_ref in compatible)
    out=[]
    for index,rectangle in enumerate(scene['matched_rectangles']):
        t,l,b,r=rectangle['box'];point=((t+b)//2,(l+r)//2)
        row={'point':point,'action_ref':contract['point_action_ref'],
            'component_ref':next(c.component_id for c in components if box(c)==tuple(rectangle['box']) and c.value==rectangle['value']),
            'sequence_collection_geometry_token':token,'sequence_collection_context_epoch':value.current_context_epoch,
            'sequence_collection_source_frame_ref':value.current_observation_frame_ref,
            'sequence_collection_source_frame_digest':stable_digest(frame.rows),
            'sequence_collection_current_query':isolated['row']['values'],
            'sequence_collection_current_receipt_prefix':prefix,
            'sequence_collection_expected_receipt_prefix':prefix+(rectangle['value'],),
            'sequence_collection_receipt_capacity':len(strip_boxes),'sequence_collection_frame_value':rectangle['value'],
            'sequence_collection_examples_count':len(rows),'sequence_collection_example_quantum':groups[0]['quantum'],
            'sequence_collection_query_quantum':isolated['quantum'],
            'sequence_collection_grammar_root_count':len(all_roots),'sequence_collection_requested_root_count':len(roots),
            'sequence_collection_compatible_roots':compatible,'sequence_collection_compatible_atomic_predicates':descriptors,
            'sequence_collection_prediction_agreement':result.values['robust_answer_and_submission_agreement'],
            'sequence_collection_kernel_submission_authorized':result.values['classification_submission_authorized'],
            'sequence_collection_unique_law_proved':result.values['unique_law_proved'],
            'sequence_collection_label_is_predicted':labels[index] in predictions,
            'sequence_collection_current_geometry_complete':True,'sequence_collection_conditional_model':True,
            'sequence_collection_previous_receipt_matches':matches,'sequence_collection_fit_reused':prior,
            'sequence_collection_feature_examined':features.examined_count,'sequence_collection_predicate_examined':result.examined_count,
            'sequence_collection_prior_intent_ref':value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_intent_ref'),
            'sequence_collection_prior_active_goal_ref':value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_active_goal_ref')}
        out.append(FrozenMap(row))
    return tuple(out)
