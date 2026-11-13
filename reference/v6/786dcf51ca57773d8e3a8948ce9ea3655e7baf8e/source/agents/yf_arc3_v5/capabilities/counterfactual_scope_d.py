"""Readonly arithmetic/projections over two independently folded PATH ledgers."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data


def measure_counterfactual_scope_d(request,original,edited):
    from .articulated_dependency_measurement_c import _nodes
    from .frontier_composition_d import _projection
    scope=request.edit_scope
    if scope is None:
        return FrozenMap({'explicit_edit_scope_present':False,
            'scoped_group_comparison_complete':False,'missing_refs':()})
    missing=[];rows=[]
    work=_nodes(immutable_json_data(request),scope.maximum_evaluations)
    if work is None:
        return FrozenMap({'explicit_edit_scope_present':True,
            'scoped_group_comparison_complete':False,
            'missing_refs':('counterfactual.full_two_path_projection_bound',),
            'accounted_evaluations':0})
    first=request.original;second=request.edited
    start=scope.group_start;stop=scope.group_stop
    ordered=0<=start<stop<=len(first.word)
    prefix=first.word[:start];suffix=first.word[stop:]
    expected=(*prefix,*scope.replacement_word,*suffix)
    if not ordered or second.word!=expected:
        missing.append('counterfactual.exact_declared_group_edit_and_unchanged_suffix')
    if (first.request.model_assignments.get('counterfactual_model_scope_ref')!=scope.model_scope_ref
            or first.request.immutable_inputs.get('counterfactual_model_evidence_refs')!=scope.model_evidence_refs):
        missing.append('counterfactual.independently_bound_model_and_evidence')
    dimensions={row.dimension for row in scope.projections}
    identities=tuple(row.quantity_ref for row in scope.projections)
    if dimensions!={'TIMING','KNOWLEDGE','RESOURCE'} or len(set(identities))!=len(identities):
        missing.append('counterfactual.distinct_complete_timing_knowledge_resource_projection')
    # Names may repeat in the unchanged word. Original suffix packets may not
    # masquerade as independently recomputed consequences after the edit.
    original_suffix_refs={event.occurrence_ref for packet in first.packets[start:]
        for event in packet.events}
    edited_suffix_refs={event.occurrence_ref for packet in second.packets[start:]
        for event in packet.events}
    if original_suffix_refs & edited_suffix_refs:
        missing.append('counterfactual.independently_produced_post_edit_event_packets')
    common_predicates=tuple(row.predicate_ref for row in first.predicates if row in second.predicates)
    if scope.discovery_scope=='EXCLUDED':
        if scope.discovery_predicate_refs:
            missing.append('counterfactual.excluded_discovery_has_no_credited_predicates')
    elif (not scope.discovery_predicate_refs or len(set(scope.discovery_predicate_refs))!=len(scope.discovery_predicate_refs)
            or any(ref not in common_predicates for ref in scope.discovery_predicate_refs)):
        missing.append('counterfactual.explicit_discovery_predicates_recomputed_in_both_paths')
    for projection in scope.projections:
        trajectories=[]
        for result in (original,edited):
            values=[]
            # Full independently folded states, not position/key matching or
            # copying the old suffix. Event and primitive counts may differ.
            for state in result.states:
                value,bound=_projection(state,projection.field_path)
                size=_nodes(value,scope.maximum_evaluations-work)
                charge=2*(size or 0)+len(projection.field_path)
                if size is None or work+charge>scope.maximum_evaluations:
                    missing.append('counterfactual.complete_recomputed_trajectory_bound');break
                work+=charge
                if not bound:missing.append('counterfactual.explicit_recomputed_dimension_field')
                values.append(value if bound else None)
            trajectories.append(tuple(values))
        rows.append(FrozenMap({'quantity_ref':projection.quantity_ref,'dimension':projection.dimension,
            'field_path':projection.field_path,'original_values':trajectories[0],
            'edited_values':trajectories[1],'trajectory_equal':trajectories[0]==trajectories[1]}))
    if not original.states or not edited.states:
        missing.append('counterfactual.recomputed_state_trajectories')
    needs=tuple(sorted(set(missing)))
    return FrozenMap({'explicit_edit_scope_present':True,
        'scoped_group_comparison_complete':not needs,
        'missing_refs':needs,'audit_ref':scope.audit_ref,'recorded_group_ref':scope.recorded_group_ref,
        'model_scope_ref':scope.model_scope_ref,'model_evidence_refs':scope.model_evidence_refs,
        'unchanged_suffix':suffix,'removed_word':first.word[start:stop],
        'replacement_word':scope.replacement_word,'recomputed_dimension_rows':tuple(rows),
        'original_primitive_count':original.primitive_count,'edited_primitive_count':edited.primitive_count,
        'original_cost':original.cost,'edited_cost':edited.cost,
        'discovery_scope':scope.discovery_scope,'discovery_predicate_refs':scope.discovery_predicate_refs,
        'accounted_evaluations':work,'globally_necessary_order_proved':False,
        'global_minimum_proved':False,'new_official_victory_proved':False,
        'pre_action_intent_reconstructed':False,'action_authority':None})
