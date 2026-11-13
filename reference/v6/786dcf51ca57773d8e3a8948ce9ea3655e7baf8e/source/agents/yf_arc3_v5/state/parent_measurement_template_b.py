"""Bind Source-declared request slots from named current canonical records."""
from collections.abc import Mapping
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import (
    FrozenModel,FrozenMap,Ref,Disposition,EpistemicStatus,stable_digest,
)


class TemplateScopeEqualityB(FrozenModel):
    source_path: tuple[str|int,...] = Field(min_length=1,max_length=16)
    fact_path: tuple[str|int,...] = Field(min_length=1,max_length=16)


class ParentMeasurementSlotB(FrozenModel):
    binding_ref: Ref
    source_kind: Literal['QUESTION_FACT','TERM_ATTRIBUTE','CLAIM_ATTRIBUTE','CLAIM_SCOPE']
    source_ref: Ref | None = None
    field_path: tuple[str|int,...] = Field(min_length=1,max_length=16)
    support_claim_ref: Ref | None = None
    expected_predicate_ref: Ref | None = None
    expected_polarity: Literal['positive','negative'] = 'positive'
    accepted_evidence_status_refs: tuple[Literal['proposed','supported','established'], ...] = Field(
        default=('proposed','supported','established'),min_length=1,max_length=3)
    scope_equalities: tuple[TemplateScopeEqualityB,...] = Field(default=(),max_length=16)


def _at(value,path):
    for key in path:
        if isinstance(value,Mapping) and key in value:value=value[key]
        elif isinstance(value,(tuple,list)) and isinstance(key,int) and not isinstance(key,bool) and 0<=key<len(value):value=value[key]
        else:raise KeyError(tuple(path))
    return value


def bind_parent_requirement(store,facts,row,current_frame_ref):
    if 'request_template' not in row:
        return row
    missing=list(row.get('canonical_source_missing_refs',()));slots={};used=set();snapshot=store.snapshot
    if row.get('canonical_binding_ref') is not None:
        from agents.yf_arc3_v5.logos.types import stable_digest
        method=snapshot.term(row.get('canonical_method_ref'));binding=snapshot.term(row['canonical_binding_ref'])
        if method is None or binding is None or stable_digest((method,binding))!=row.get('canonical_source_digest'):
            missing.append('template.canonical_sources_changed_before_binding')
    env=FrozenMap({**facts,'binding_current_frame_ref':current_frame_ref,
        'binding_current_state_revision':snapshot.revision,
        'canonical_binding_scope':row.get('canonical_binding_scope',FrozenMap())})
    if 'request' in row:missing.append('template.ambiguous_final_request_and_template')
    raw_slots=row.get('request_template_bindings',())
    if not isinstance(raw_slots,(tuple,list)) or len(raw_slots)>128:
        raw_slots=();missing.append('template.bounded_binding_set')
    evidence=[];provenance=[]
    for raw in raw_slots:
        try:slot=ParentMeasurementSlotB.model_validate(raw)
        except (ValueError,TypeError):missing.append('template.typed_binding');continue
        if slot.binding_ref in slots:
            missing.append('template.duplicate_binding.'+slot.binding_ref);continue
        try:
            if slot.source_kind=='QUESTION_FACT':
                if slot.source_ref is not None or slot.support_claim_ref is not None or slot.expected_predicate_ref is not None or slot.scope_equalities:
                    raise ValueError('question_fact_has_no_external_record')
                source=env
            else:
                if slot.source_ref is None or not slot.scope_equalities:
                    raise ValueError('named_scoped_canonical_source_required')
                claim_ref=slot.support_claim_ref if slot.source_kind=='TERM_ATTRIBUTE' else slot.source_ref
                claim=snapshot.claim(claim_ref) if claim_ref is not None else None
                if claim is None or slot.expected_predicate_ref is None or claim.predicate!=slot.expected_predicate_ref:
                    raise ValueError('exact_supporting_claim_required')
                if claim.polarity.value!=slot.expected_polarity:
                    raise ValueError('exact_supporting_claim_polarity_required')
                if claim.epistemic_status.value not in slot.accepted_evidence_status_refs:
                    raise ValueError('supporting_claim_status_not_declared_for_slot')
                if claim.disposition is not Disposition.ACTIVE or claim.epistemic_status is EpistemicStatus.DEFEATED or claim.active_contradictions or claim.defeated_by or (claim.valid_through_state_revision is not None and claim.valid_through_state_revision<snapshot.revision):
                    raise ValueError('supporting_claim_not_current')
                canonical=FrozenMap({'scope':claim.scope,'attributes':claim.attributes})
                for equality in slot.scope_equalities:
                    if _at(canonical,equality.source_path)!=_at(env,equality.fact_path):
                        raise ValueError('support_scope_not_equal')
                if slot.source_kind=='TERM_ATTRIBUTE':
                    term=snapshot.term(slot.source_ref)
                    if term is None or slot.source_ref not in claim.arguments:
                        raise ValueError('supported_named_term_required')
                    source=term.attributes
                else:source=claim.scope if slot.source_kind=='CLAIM_SCOPE' else claim.attributes
                evidence.append(claim_ref)
                provenance.append(FrozenMap({'binding_ref':slot.binding_ref,'source_kind':slot.source_kind,
                    'source_ref':slot.source_ref,'support_claim_ref':claim_ref,
                    'epistemic_status_ref':claim.epistemic_status.value,'polarity_ref':claim.polarity.value,
                    'claim_scope':claim.scope,'claim_digest':stable_digest(claim),
                    'source_term_digest':stable_digest(term) if slot.source_kind=='TERM_ATTRIBUTE' else None,
                    'accepted_evidence_status_refs':slot.accepted_evidence_status_refs}))
            slots[slot.binding_ref]=_at(source,slot.field_path)
        except (KeyError,ValueError,TypeError):
            missing.append('template.current_binding.'+slot.binding_ref)
    count=0
    def render(value):
        nonlocal count
        count+=1
        if count>4096:raise ValueError('template.bounded_payload')
        if isinstance(value,Mapping):
            if set(value)=={'request_binding_ref'}:
                ref=value['request_binding_ref'];used.add(ref)
                if ref not in slots:raise KeyError('template.unresolved_slot.'+str(ref))
                return slots[ref]
            return FrozenMap({key:render(child) for key,child in sorted(value.items())})
        if isinstance(value,(tuple,list)):return tuple(render(child) for child in value)
        return value
    rendered={}
    try:
        declared={key:value for key,value in sorted(row.items())
            if key not in ('request_template','request_template_bindings','request')}
        rendered=render({**declared,'request':row['request_template']})
    except (KeyError,ValueError,TypeError,RecursionError):missing.append('template.incomplete_request_payload')
    if set(slots)!=used:missing.append('template.exact_binding_use')
    return FrozenMap({**row,**rendered,'request':rendered.get('request'),
        'template_binding_missing_refs':tuple(missing),
        'template_binding_evidence_refs':tuple(dict.fromkeys(evidence)),
        'template_binding_provenance':tuple(provenance)})


def revalidate_parent_template_sources(store,row):
    """Exact source identity revalidation; no new claim eligibility authority."""
    missing=[]
    if row.get('canonical_binding_ref') is not None:
        method=store.snapshot.term(row.get('canonical_method_ref'))
        binding=store.snapshot.term(row['canonical_binding_ref'])
        if method is None or binding is None or stable_digest((method,binding))!=row.get('canonical_source_digest'):
            missing.append('template.canonical_sources_changed_after_binding')
    for source in row.get('template_binding_provenance',()):
        claim=store.snapshot.claim(source['support_claim_ref'])
        term=store.snapshot.term(source['source_ref']) if source['source_kind']=='TERM_ATTRIBUTE' else None
        if (claim is None or stable_digest(claim)!=source['claim_digest']
                or claim.epistemic_status.value!=source['epistemic_status_ref']
                or claim.scope!=source['claim_scope']
                or claim.disposition is not Disposition.ACTIVE or claim.active_contradictions or claim.defeated_by
                or claim.valid_through_state_revision is not None and claim.valid_through_state_revision<store.snapshot.revision
                or source['source_kind']=='TERM_ATTRIBUTE' and stable_digest(term)!=source['source_term_digest']):
            missing.append('template.source_changed_before_publication.'+source['binding_ref'])
    return tuple(missing)
