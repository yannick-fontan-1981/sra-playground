"""Readonly exact acquisition-backed canonical field binding; no role inference."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, TermKind, Polarity, Disposition
from agents.yf_arc3_v5.logos.observed_value_comparison import observed_content_at_path


class ObservedCanonicalFieldBindingB(FrozenModel):
    term_ref: Ref
    attribute_path: tuple[str | int, ...] = Field(min_length=1,max_length=16)
    support_claim_ref: Ref


class ObservedCanonicalFieldScopeB(FrozenModel):
    observation_record_ref: Ref
    frame_ref: Ref
    expected_claim_scope: FrozenMap
    support_predicate: Ref
    acquired_source_kind_ref: Ref
    accepted_evidence_status_refs: tuple[Ref, ...] = Field(min_length=1,max_length=16)


def read_observed_canonical_field(store, binding, scope):
    binding = ObservedCanonicalFieldBindingB.model_validate(binding)
    scope = ObservedCanonicalFieldScopeB.model_validate(scope)
    snapshot = store.snapshot
    term = snapshot.term(binding.term_ref)
    claim = snapshot.claim(binding.support_claim_ref)
    valid = (claim is not None and claim.predicate == scope.support_predicate
        and claim.arguments == (binding.term_ref,scope.observation_record_ref)
        and claim.polarity is Polarity.POSITIVE and claim.disposition is Disposition.ACTIVE
        and claim.epistemic_status.value in scope.accepted_evidence_status_refs
        and not claim.active_contradictions and not claim.defeated_by
        and scope.observation_record_ref in claim.grounds
        and all(claim.scope.get(key) == value for key,value in sorted(scope.expected_claim_scope.items()))
        and (claim.valid_through_state_revision is None or claim.valid_through_state_revision >= snapshot.revision)
        and term is not None and term.kind is TermKind.VALUE
        and term.attributes.get('frame_ref') == scope.frame_ref
        and term.attributes.get('observation_record_ref') == scope.observation_record_ref
        and term.attributes.get('source_kind_ref') == scope.acquired_source_kind_ref)
    if not valid:
        return FrozenMap({'field_binding_current':False,'value':None,
            'missing_refs':('observed_field.current_acquisition_backed_canonical_support',),
            'evidence_refs':(),'state_revision':snapshot.revision})
    present, current = observed_content_at_path(term.attributes, binding.attribute_path)
    if not present:
        return FrozenMap({'field_binding_current':False,'value':None,
            'missing_refs':('observed_field.exact_attribute_path',),'evidence_refs':(),
            'state_revision':snapshot.revision})
    return FrozenMap({'field_binding_current':True,'value':current,'missing_refs':(),
        'evidence_refs':(binding.term_ref,binding.support_claim_ref,scope.observation_record_ref),
        'state_revision':snapshot.revision})
