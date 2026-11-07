"""Exact Source-frozen scope comparisons; no new constraint or narrowed safety."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest


def constraint_scope_binding_needs_d(request,predicates):
    scoped=tuple(predicate for predicate in predicates if predicate.constraint_scope is not None)
    if not scoped:return ()
    needs=[]
    if request.immutable_inputs.get('constraint_scopes_digest')!=stable_digest(immutable_json_data(scoped)):
        needs.append('current_source_frozen_constraint_event_scopes')
    baselines=request.immutable_inputs.get('constraint_scope_baselines')
    if not isinstance(baselines,FrozenMap):needs.append('declared_inherited_constraint_scope_baselines');baselines=FrozenMap()
    for predicate in scoped:
        scope=predicate.constraint_scope
        if scope.epoch!=request.epoch or scope.evidence_revision_ref!=request.input_revision_ref:
            needs.append('constraint_current_epoch_and_evidence_revision:'+predicate.predicate_ref)
        if predicate.predicate_ref not in baselines:
            needs.append('constraint_explicit_inherited_scope_or_new_requirement:'+predicate.predicate_ref);continue
        baseline=baselines[predicate.predicate_ref]
        # Explicit null means a newly evidenced constraint, not a legacy safety alias.
        if baseline is None:continue
        if not isinstance(baseline,FrozenMap):needs.append('constraint_typed_inherited_scope:'+predicate.predicate_ref);continue
        if (baseline.get('field_ref')!=predicate.field_ref or baseline.get('field_path',())!=predicate.field_path
                or baseline.get('comparison')!=predicate.comparison or baseline.get('expected')!=predicate.expected):
            needs.append('constraint_inherited_predicate_not_replaced:'+predicate.predicate_ref)
        original=baseline.get('constraint_scope')
        if original is not None:
            if original!=immutable_json_data(scope):needs.append('constraint_inherited_scope_cannot_change:'+predicate.predicate_ref)
        elif (not baseline.get('event_kind_refs',())
                or baseline.get('include_initial',True) and not predicate.include_initial
                or baseline.get('event_kind_refs',()) and baseline['event_kind_refs']!=predicate.event_kind_refs):
            needs.append('constraint_inherited_intermediate_safety_cannot_narrow:'+predicate.predicate_ref)
    return tuple(dict.fromkeys(needs))


def constraint_event_applies_d(predicate,event):
    scope=predicate.constraint_scope
    if scope is None:return True
    if event is None:return scope.event_domain=='ALL_INTERMEDIATE'
    if (event.temporal_scope_ref!=scope.temporal_scope_ref or event.clock_ref!=scope.clock_ref
            or not scope.valid_from_tick<=event.tick<=scope.valid_through_tick):return False
    return (scope.event_domain=='ALL_INTERMEDIATE'
        or (not scope.event_kind_refs or event.kind_ref in scope.event_kind_refs)
        and (not scope.event_occurrence_refs or event.occurrence_ref in scope.event_occurrence_refs))
