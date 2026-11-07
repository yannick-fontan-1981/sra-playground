"""Measure an actual acquired scalar field through the shared Source codebook."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, TermKind, stable_digest
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget
from .observed_scene_reader import ObservedInputReadRequest, read_observed_input, current_positive_claim
from .observed_scalar_pixel_reader_b import ScalarPixelQuestionB, ScalarPixelMethodScopeB, measure_scalar_pixel_alternatives
from .observed_canonical_field_reader_b import (
    ObservedCanonicalFieldBindingB, ObservedCanonicalFieldScopeB, read_observed_canonical_field,
)


class CargoScalarAcquisitionInputB(FrozenModel):
    request_ref: Ref
    observation: ObservedInputReadRequest
    question: ScalarPixelQuestionB
    method_scope: ScalarPixelMethodScopeB
    budget: DMechanicalRequest
    scope_ref: Ref
    level_scope_ref: Ref
    output_term_ref: Ref
    output_support_claim_ref: Ref
    output_owner_scope: FrozenMap | None = None
    output_owner_scope_term_ref: Ref | None = None
    output_owner_scope_support_claim_ref: Ref | None = None
    principal_goal_support_claim_ref: Ref | None = None


_OWNER_EXTRA_FIELDS = ('caller_ref','parent_consumer_ref','parent_contribution_ref',
    'caller_next_item_ref','evidence_revision_ref','model_revision_ref','model_status_ref',
    'event_owner_ref','input_domain_complete','assumption_refs','episode_ref')


def _owner_scope_missing(store, value):
    """Exact Source provenance check; an unbacked caller map is insufficient."""
    owner = value.output_owner_scope
    if owner is None:
        return () if all(ref is None for ref in (value.output_owner_scope_term_ref,
            value.output_owner_scope_support_claim_ref,value.principal_goal_support_claim_ref)) else ('cargo.scalar.partial_owner_binding',)
    base = _field_scope(value, include_owner=False).expected_claim_scope
    expected = {**base, **{key:getattr(value.budget.scope,key) for key in _OWNER_EXTRA_FIELDS if key != 'episode_ref'}}
    term = store.snapshot.term(value.output_owner_scope_term_ref)
    proof = store.snapshot.claim(value.output_owner_scope_support_claim_ref)
    goal = store.snapshot.claim(value.principal_goal_support_claim_ref)
    principal = store.snapshot.term(value.method_scope.parent_goal_ref)
    if (any(owner.get(key) != item for key,item in sorted(expected.items()))
            or set(owner) != set(expected) | {'episode_ref'} or not owner.get('episode_ref')
            or term is None or term.kind is not TermKind.VALUE or term.attributes.get('value') != owner
            or not current_positive_claim(proof,store.snapshot.revision)
            or proof.arguments != (value.output_owner_scope_term_ref,value.method_scope.parent_goal_ref)
            or proof.predicate != 'current_source_observation_owner_scope_bound'
            or principal is None or principal.kind is not TermKind.GOAL
            or proof.scope != owner or not current_positive_claim(goal,store.snapshot.revision)
            or value.method_scope.parent_goal_ref not in goal.arguments
            or any(goal.scope.get(key) != owner[key] for key in ('parent_goal_ref','scope_ref','epoch','input_revision_ref','level_scope_ref','episode_ref'))):
        return ('cargo.scalar.current_source_bound_output_owner_scope',)
    return ()


def _field_scope(value, include_owner=True):
    scope = value.method_scope
    return ObservedCanonicalFieldScopeB(observation_record_ref=value.observation.observation_record_ref,
        frame_ref=value.observation.expected_frame_ref,
        expected_claim_scope=value.output_owner_scope if include_owner and value.output_owner_scope is not None else FrozenMap({'parent_goal_ref':scope.parent_goal_ref,'scope_ref':value.scope_ref,
            'epoch':scope.epoch,'input_revision_ref':scope.evidence_revision_ref,
            'level_scope_ref':value.level_scope_ref,'current_frame_ref':value.observation.expected_frame_ref}),
        support_predicate='observed_native_state_field_supported',acquired_source_kind_ref='acquired_observation',
        accepted_evidence_status_refs=('supported','established'))


def measure_cargo_scalar_acquisition(store, repository, value, current_frame_ref):
    value = CargoScalarAcquisitionInputB.model_validate(value)
    observed = read_observed_input(store,repository,value.observation)
    missing = list(observed.missing_refs)
    missing.extend(_owner_scope_missing(store,value))
    scope = value.method_scope
    if (value.observation.expected_frame_ref is None or value.observation.expected_frame_ref != current_frame_ref
            or scope.epoch < 0 or store.snapshot.term(scope.parent_goal_ref) is None
            or value.budget.scope.parent_goal_ref != scope.parent_goal_ref
            or value.budget.scope.parent_contribution_ref != value.scope_ref
            or value.budget.scope.epoch != scope.epoch
            or value.budget.scope.evidence_revision_ref != scope.evidence_revision_ref
            or value.budget.scope.model_revision_ref != scope.model_revision_ref):
        missing.append('cargo.scalar_actual_current_acquisition_and_method_budget_scope')
    result = None
    if not missing:
        result = measure_scalar_pixel_alternatives(store,value.question,observed.world_input,scope,DWorkBudget(value.budget))
        missing.extend(result.missing_refs)
    unique = result is not None and result.status == 'UNIQUE' and result.domain_complete and not missing
    decoded = result.matching_values[0] if unique else None
    existing = store.snapshot.term(value.output_term_ref)
    if unique and existing is not None and (existing.kind is not TermKind.VALUE
            or existing.attributes.get('source_kind_ref') != 'acquired_observation'
            or existing.attributes.get('observation_record_ref') != value.observation.observation_record_ref
            or existing.attributes.get('frame_ref') != current_frame_ref
            or existing.attributes.get('field_ref') != value.question.field_ref
            or 'value' not in existing.attributes or stable_digest(existing.attributes['value']) != stable_digest(decoded)
            or existing.attributes.get('method_claim_digest') != result.method_claim_digest):
        missing.append('cargo.scalar_destination_collision')
        unique = False
    owner = value.output_owner_scope
    extra = {key:owner[key] if owner is not None and key in owner else None for key in _OWNER_EXTRA_FIELDS}
    return FrozenMap({**extra,'scalar_owner_scope_bound':owner is not None,
        'owner_term_digest':stable_digest(store.snapshot.term(value.output_owner_scope_term_ref)) if owner is not None else None,
        'owner_claim_digest':stable_digest(store.snapshot.claim(value.output_owner_scope_support_claim_ref)) if owner is not None else None,
        'principal_goal_claim_digest':stable_digest(store.snapshot.claim(value.principal_goal_support_claim_ref)) if owner is not None else None,
        'owner_scope_term_ref':value.output_owner_scope_term_ref,
        'owner_scope_support_claim_ref':value.output_owner_scope_support_claim_ref,
        'principal_goal_support_claim_ref':value.principal_goal_support_claim_ref,
        'owner_scope_digest':stable_digest(owner) if owner is not None else None,
        'scalar_unique_current':unique,'scalar_domain_complete':result.domain_complete if result is not None else False,
        'scalar_match_status':result.status if result is not None else 'MISSING_EVIDENCE',
        'matching_values':result.matching_values if result is not None else (),
        'matching_case_indices':result.matching_case_indices if result is not None else (),
        'examined_case_count':result.examined_case_count if result is not None else 0,
        'raster_digest':result.raster_digest if result is not None else None,
        'method_claim_digest':result.method_claim_digest if result is not None else None,
        'decoded_value':decoded,'missing_refs':tuple(dict.fromkeys(missing)),
        'request_ref':value.request_ref,'field_ref':value.question.field_ref,
        'output_term_ref':value.output_term_ref,'output_support_claim_ref':value.output_support_claim_ref,
        'method_claim_ref':value.question.method_claim_ref,'parent_goal_ref':scope.parent_goal_ref,
        'scope_ref':value.scope_ref,'epoch':scope.epoch,'input_revision_ref':scope.evidence_revision_ref,
        'model_revision_ref':scope.model_revision_ref,'level_scope_ref':value.level_scope_ref,
        'frame_ref':current_frame_ref,'observation_record_ref':value.observation.observation_record_ref,
        'raw_input_ref':value.observation.raw_input_ref,'timeline_ref':value.observation.timeline_ref,
        'evidence_refs':(value.observation.observation_record_ref,value.question.method_claim_ref) + tuple(ref for ref in
            (value.output_owner_scope_support_claim_ref,value.principal_goal_support_claim_ref) if ref is not None),
        'existing_term_refs':(scope.parent_goal_ref,), 'no_dispatch_or_action_authority':True})


def cargo_scalar_acquisition_result(store, value, measured, disposition_ref, selected_facts):
    value = CargoScalarAcquisitionInputB.model_validate(value)
    field = read_observed_canonical_field(store,ObservedCanonicalFieldBindingB(term_ref=value.output_term_ref,
        attribute_path=('value',),support_claim_ref=value.output_support_claim_ref),_field_scope(value))
    method = store.snapshot.claim(value.question.method_claim_ref)
    current = (measured['scalar_unique_current'] and field['field_binding_current']
        and not _owner_scope_missing(store,value)
        and measured['owner_scope_digest'] == (stable_digest(value.output_owner_scope) if value.output_owner_scope is not None else None)
        and (value.output_owner_scope is None or all(measured[key] == stable_digest(record) for key,record in (
            ('owner_term_digest',store.snapshot.term(value.output_owner_scope_term_ref)),
            ('owner_claim_digest',store.snapshot.claim(value.output_owner_scope_support_claim_ref)),
            ('principal_goal_claim_digest',store.snapshot.claim(value.principal_goal_support_claim_ref)))))
        and stable_digest(field['value']) == stable_digest(measured['decoded_value'])
        and current_positive_claim(method,store.snapshot.revision)
        and stable_digest(method) == measured['method_claim_digest'])
    return FrozenMap({'request_ref':value.request_ref,'source_disposition_ref':disposition_ref,
        'source_facts':selected_facts[disposition_ref],'canonical_scalar_field_current':current,
        'field_term_ref':value.output_term_ref,'field_support_claim_ref':value.output_support_claim_ref,
        'field_ref':value.question.field_ref,'matching_values':measured['matching_values'],
        'matching_case_indices':measured['matching_case_indices'],'measurement':measured,
        'state_revision':store.snapshot.revision,'no_dispatch_or_action_authority':True})
