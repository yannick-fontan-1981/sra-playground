"""Pure measurements under Source-qualified premises, never memory publication."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data


def measure_navigation_storage_need_d(request):
    need=request.storage_need
    if need is None:return FrozenMap({'capacity_reason_supplied':False,'missing_refs':('navigation.current_missing_capacity_reason',)})
    state=request.state;keys={key.key_ref:key for key in state.keys};missing=[]
    consumer=next((row for row in request.remaining_services if row.consumer_ref==need.consumer_ref),None)
    exact=(need.parent_goal_ref==request.scope.parent_goal_ref and need.consumer_ref==request.storage_service_consumer_ref
        and need.missing_capacity_claim_ref in request.scope.assumption_refs and consumer is not None
        and len(set(need.blocked_acquisition_key_refs))==len(need.blocked_acquisition_key_refs)
        and need.required_free_slots==len(need.blocked_acquisition_key_refs)
        and all(ref in keys and keys[ref].owner in ('GROUND','STORED') for ref in need.blocked_acquisition_key_refs))
    free=state.capacity-len(state.inventory_order)
    if not exact:missing.append('navigation.current_named_capacity_consumer_and_acquisition_occurrences')
    if need.required_free_slots<=free:missing.append('navigation.actual_missing_capacity_condition')
    stored=keys.get(request.storage_key_ref)
    if stored is None or stored.owner!='INVENTORY':missing.append('navigation.current_held_storage_occurrence')
    elif consumer is not None and stored.type_ref!=consumer.key_type_ref:
        missing.append('navigation.stored_occurrence_has_named_future_consumer')
    return FrozenMap({'capacity_reason_supplied':True,'capacity_condition_missing':need.required_free_slots>free,
        'consumer_ref':need.consumer_ref,'missing_capacity_claim_ref':need.missing_capacity_claim_ref,
        'blocked_acquisition_key_refs':need.blocked_acquisition_key_refs,'actual_free_slots':free,
        'required_free_slots':need.required_free_slots,'missing_refs':tuple(missing),
        'drop_or_goal_authorized':False})


def measure_navigation_mask_retention_d(request,previous,remaining):
    from .articulated_dependency_measurement_c import _nodes
    proof=request.mask_retention;state=request.actual_state
    if proof is None or previous is None:
        return FrozenMap({'missing_refs':('navigation.current_supported_masked_possession_contract',),
            'proposed_keys':None,'proposed_inventory_order':None,'accounted_evaluations':0})
    work=_nodes(immutable_json_data((proof,previous.keys,state.keys)),remaining)
    if work is None:
        return FrozenMap({'missing_refs':('navigation.complete_masked_ownership_projection_bound',),
            'proposed_keys':None,'proposed_inventory_order':None,'accounted_evaluations':0})
    missing=[];old={key.key_ref:key for key in previous.keys};current={key.key_ref:key for key in state.keys}
    held=tuple(row.key_ref for row in proof.previous_held_claims)
    updates=tuple(row.key_ref for row in proof.current_ownership_claims)
    claims=(*tuple(row.claim_ref for row in proof.previous_held_claims),
        *tuple(row.claim_ref for row in proof.current_ownership_claims),
        proof.retention_law_claim_ref,proof.inventory_order_claim_ref)
    checks=2*(len(claims)*len(request.scope.assumption_refs)+len(previous.keys)+len(state.keys)+len(proof.logical_inventory_order))+16
    if work+checks>remaining:
        return FrozenMap({'missing_refs':('navigation.complete_masked_support_and_order_comparison_bound',),
            'proposed_keys':None,'proposed_inventory_order':None,'accounted_evaluations':work})
    work+=checks
    if (proof.parent_goal_ref!=request.scope.parent_goal_ref or proof.parent_contribution_ref!=request.scope.parent_contribution_ref
            or proof.event_owner_ref!=request.scope.event_owner_ref or proof.epoch!=request.scope.epoch
            or proof.evidence_revision_ref!=request.scope.evidence_revision_ref
            or proof.level_scope_ref!=state.level_scope_ref or proof.restore_epoch!=state.restore_epoch
            or previous.level_scope_ref!=state.level_scope_ref or previous.restore_epoch!=state.restore_epoch
            or len(set(held))!=len(held) or set(held)!=set(previous.inventory_order)
            or len(set(updates))!=len(updates) or any(ref not in current for ref in updates)
            or any(ref not in request.scope.assumption_refs for ref in claims)):
        missing.append('navigation.current_episode_scope_owned_retention_and_update_premises')
    # Incomplete visibility is not an ownership event. Keep the prior ledger;
    # only independently Source-qualified positive current rows replace it.
    merged=dict(old)
    for ref in sorted(updates):
        if ref in current:merged[ref]=current[ref]
    for ref in sorted(current):
        if ref not in old and ref not in updates:missing.append('navigation.new_occurrence_requires_current_positive_ownership')
    order=proof.logical_inventory_order
    if (len(set(order))!=len(order) or set(order)!={ref for ref,key in sorted(merged.items()) if key.owner=='INVENTORY'}
            or len(order)>state.capacity):
        missing.append('navigation.supported_current_inventory_order_and_capacity')
    contradictions=tuple(ref for ref in sorted(set(old)&set(current))
        if old[ref]!=current[ref] and ref not in updates)
    if contradictions:missing.append('navigation.resolve_current_masked_ownership_conflicts')
    needs=tuple(sorted(set(missing)))
    return FrozenMap({'missing_refs':needs,'proposed_keys':None if needs else tuple(merged[ref] for ref in sorted(merged)),
        'proposed_inventory_order':None if needs else order,'unqualified_observation_conflict_refs':contradictions,
        'conditional_on_retained_claim_refs':claims,'accounted_evaluations':work,
        'logical_inventory_complete_under_declared_premises':not needs,
        'negative_possession_from_masking_qualified':False,'canonical_memory_published':False})
