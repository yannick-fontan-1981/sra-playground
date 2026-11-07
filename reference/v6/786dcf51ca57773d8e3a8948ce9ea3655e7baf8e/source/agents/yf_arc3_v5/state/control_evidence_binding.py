"""Exact scope/proof comparisons; DRM decides their admissibility.

This local binding is discarded at a scene boundary. A portable method may
still propose a new experiment; an old binding cannot authorize its release.
"""
from pydantic import ValidationError

from agents.yf_arc3_v5.logos.operations import ControlEvidenceSignature
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from agents.yf_arc3_v5.state.reference_bindings import canonical_reference_bindings_current


def freeze_control_evidence_binding(facts, snapshot):
    value = facts.get("control_evidence_signature")
    signature = ControlEvidenceSignature.model_validate(value) if value is not None else None
    ref = facts.get("control_evidence_claim_ref")
    proof = snapshot.claim(ref) if ref else None
    return {
        "control_evidence_binding_required": facts.get("control_evidence_binding_required") is True,
        "control_evidence_signature": signature,
        "control_evidence_claim_ref": ref,
        "control_evidence_claim_digest": stable_digest(proof) if proof is not None else None,
    }


def _retain_typed_control_claim_refs(prepared, store, frame_ref):
    """Keep Terms/provenance in WHY and their typed channels, not as Claims."""
    context = prepared.context
    if (context.get('control_evidence_support_partition_frame_ref') != frame_ref
            or prepared.intent.frame_id != frame_ref):
        return prepared
    typed_nonclaims = {
        row['term_ref'] for row in context.get('control_evidence_support_term_bindings', ())
    } | {
        row['record_ref'] for row in context.get('control_evidence_provenance_records', ())
    }
    intent = prepared.intent
    claims = tuple(ref for ref in intent.canonical_premise_claim_refs
        if ref == intent.control_evidence_claim_ref or ref not in typed_nonclaims
        or store.snapshot.claim(ref) is not None)
    if claims == intent.canonical_premise_claim_refs:
        return prepared
    return prepared.model_copy(update={'intent': intent.model_copy(update={
        'canonical_premise_claim_refs': claims})})


def partition_prepared_control_support(prepared, store, frame_ref):
    """Bind the frozen WHY's typed references to a current support partition.

    Recalled receiver bindings need the same partition as measured receivers.
    Preserve existing constraints and expected versions; this adds missing
    measurements, never a Claim, intent, permit or semantic interpretation.
    """
    context = prepared.context
    if context.get('control_evidence_support_partition_frame_ref') == frame_ref:
        return _retain_typed_control_claim_refs(prepared, store, frame_ref)
    from agents.yf_arc3_v5.state.control_support_partition import partition_control_support_rows
    intent = prepared.intent
    claim_refs = tuple(ref for ref in intent.canonical_premise_claim_refs
                       if ref != intent.control_evidence_claim_ref)
    existing_terms = tuple(context.get('control_evidence_support_term_bindings', ()))
    existing_provenance = tuple(context.get('control_evidence_provenance_records', ()))
    term_refs = {row['term_ref'] for row in existing_terms}
    # Include the actual canonical argument terms of the supporting Claims.
    # Signature receiver names may also be perceptual addresses; do not relabel
    # those addresses as canonical Terms or proof merely because they are named.
    for ref in claim_refs:
        claim = store.snapshot.claim(ref)
        if claim is not None:
            term_refs.update(ref for ref in claim.arguments if store.snapshot.term(ref) is not None)
    provenance_refs = tuple(row['record_ref'] for row in existing_provenance)
    kinds = {ref: 'CLAIM' for ref in claim_refs}
    kinds.update({ref: 'TERM' for ref in term_refs})
    kinds.update({ref: 'PROVENANCE' for ref in provenance_refs})
    rows = partition_control_support_rows((FrozenMap({
        'role_premise_claim_refs': (*claim_refs, *provenance_refs),
        'source_term_rows': tuple(FrozenMap({'term_ref': ref}) for ref in sorted(term_refs)),
        'control_support_reference_kinds': FrozenMap(kinds),
    }),), store, frame_ref)
    partition = rows[0]
    terms = {row['term_ref']: row for row in partition['control_support_term_bindings']}
    terms.update({row['term_ref']: row for row in existing_terms})
    provenance = {row['record_ref']: row for row in partition['control_support_provenance_records']}
    provenance.update({row['record_ref']: row for row in existing_provenance})
    measured = {
        'control_evidence_support_term_bindings': tuple(terms[ref] for ref in sorted(terms)),
        'control_evidence_provenance_records': tuple(provenance[ref] for ref in sorted(provenance)),
        'control_evidence_unresolved_support_refs': tuple(sorted(set(
            context.get('control_evidence_unresolved_support_refs', ()))
            | set(partition['control_support_unresolved_refs']))),
        'control_evidence_stale_support_term_refs': tuple(sorted(set(
            context.get('control_evidence_stale_support_term_refs', ()))
            | set(partition['control_support_stale_term_refs']))),
        'control_evidence_support_partition_frame_ref': partition['control_support_partition_frame_ref'],
    }
    partitioned = prepared.model_copy(update={'context': FrozenMap.overlay(measured, context)})
    return _retain_typed_control_claim_refs(partitioned, store, frame_ref)


def measure_control_evidence_binding(intent, snapshot, observation_ref):
    signature = intent.control_evidence_signature
    ref = intent.control_evidence_claim_ref
    proof = snapshot.claim(ref) if ref else None
    current = None
    if proof is not None:
        value = proof.attributes.get("control_evidence_signature")
        if value is not None:
            try:
                current = ControlEvidenceSignature.model_validate(value)
            except ValidationError:
                pass
    return FrozenMap({
        "binding_required": intent.control_evidence_binding_required,
        "binding_payload_present": signature is not None or ref is not None
            or intent.control_evidence_claim_digest is not None,
        "signature_complete": signature is not None and current is not None,
        "signature_matches": signature is not None and current is not None
            and signature.scope_key() == current.scope_key(),
        "observation_matches": signature is not None and current is not None
            and signature.local_frame_ref == current.local_frame_ref == observation_ref == intent.frame_id,
        "action_kind_matches": signature is not None
            and signature.action_kind_ref == intent.available_action_ref,
        "action_payload_matches": proof is not None
            and intent.action_data == (proof.attributes.get("control_evidence_action_data") or FrozenMap()),
        "proof_version_matches": proof is not None
            and stable_digest(proof) == intent.control_evidence_claim_digest,
        "proof_in_frozen_why": ref is not None
            and ref in intent.premise_claim_refs and ref in intent.canonical_premise_claim_refs,
        "proof_is_current": proof is not None
            and any(row.id == ref for row in snapshot.claims_for_predicate(proof.predicate)),
        "proof_disposition": proof.disposition.value if proof is not None else "missing",
        "proof_polarity": proof.polarity.value if proof is not None else "missing",
        "proof_status": proof.epistemic_status.value if proof is not None else "missing",
        "proof_predicate": proof.predicate if proof is not None else "missing",
        "proof_contradiction_count": len(proof.active_contradictions) if proof is not None else 0,
        "proof_defeat_count": len(proof.defeated_by) if proof is not None else 0,
    })


def measure_prepared_control_binding(prepared, snapshot, observation_ref, artifact_lookup=None):
    """Expose exact transport/support comparisons for a Source-requested derivation."""
    intent = prepared.intent
    signature = intent.control_evidence_signature
    control_ref = intent.control_evidence_claim_ref
    refs = tuple(row for row in intent.canonical_premise_claim_refs if row != control_ref)
    claims = tuple(snapshot.claim(row) for row in refs)
    context = prepared.context
    term_bindings = tuple(context.get('control_evidence_support_term_bindings', ()))
    provenance = tuple(context.get('control_evidence_provenance_records', ()))
    if len(term_bindings) > 128 or len(provenance) > 128:
        raise ValueError('control support partition exceeds its declared bound')
    term_dependencies = {}
    claim_dependencies = {claim.id: stable_digest(claim) for claim in claims if claim is not None}
    stale_terms = set(context.get('control_evidence_stale_support_term_refs', ()))
    for binding in term_bindings:
        ref = binding['term_ref']
        term = snapshot.term(ref)
        if (term is None or term.last_changed_state_revision != binding['revision']
                or stable_digest(term) != binding['content_digest']
                or binding['scope_frame_ref'] != observation_ref
                or not canonical_reference_bindings_current(snapshot, term,
                    frame_ref=observation_ref, observation_ref=observation_ref,
                    require_projectable=False)):
            stale_terms.add(ref)
            continue
        term_dependencies[ref] = binding['revision']
        for dependency in term.attributes.get('canonical_term_dependency_revisions', ()):
            term_dependencies[dependency['term_ref']] = dependency['revision']
        for dependency in term.attributes.get('canonical_claim_dependency_digests', ()):
            claim_dependencies[dependency['claim_ref']] = dependency['content_digest']
    stale_provenance = sum(
        artifact_lookup is None or artifact_lookup(record['record_ref']) is None
        or stable_digest(artifact_lookup(record['record_ref'])) != record['content_digest']
        for record in provenance
    )
    return FrozenMap({
        'binding_required': intent.control_evidence_binding_required,
        'proof_already_frozen': intent.control_evidence_claim_digest is not None,
        'signature_complete': signature is not None,
        'signature_frame_matches': signature is not None
            and signature.local_frame_ref == intent.frame_id == observation_ref,
        'signature_action_matches': signature is not None
            and signature.action_kind_ref == intent.available_action_ref,
        'proof_in_frozen_why': control_ref is not None
            and control_ref in intent.premise_claim_refs and control_ref in intent.canonical_premise_claim_refs,
        'support_claim_count': len(refs),
        'support_missing_count': sum(c is None for c in claims),
        'support_inactive_count': sum(c is not None and c.disposition.value != 'active' for c in claims),
        'support_negative_count': sum(c is not None and c.polarity.value != 'positive' for c in claims),
        'support_contested_count': sum(c is not None and bool(c.active_contradictions or c.defeated_by) for c in claims),
        'support_unindexed_count': sum(c is not None and not any(row.id == c.id
            for row in snapshot.claims_for_predicate(c.predicate)) for c in claims),
        'support_partition_frame_matches': context.get('control_evidence_support_partition_frame_ref')
            == intent.frame_id == observation_ref,
        'support_unresolved_count': len(context.get('control_evidence_unresolved_support_refs', ())),
        'support_stale_term_count': len(stale_terms),
        'support_stale_provenance_count': stale_provenance,
        'control_binding_support_claim_refs': refs,
        'control_binding_evidence_refs': tuple(dict.fromkeys((
            *refs, *(binding['term_ref'] for binding in term_bindings),
            *(record['record_ref'] for record in provenance)))),
        'control_binding_term_dependencies': tuple(FrozenMap({'term_ref': ref, 'revision': revision})
            for ref, revision in sorted(term_dependencies.items())),
        'control_binding_claim_dependencies': tuple(FrozenMap({'claim_ref': ref, 'content_digest': digest})
            for ref, digest in sorted(claim_dependencies.items())),
        'control_binding_provenance_records': provenance,
        'control_binding_scope_frame_ref': intent.frame_id,
        'control_evidence_signature': signature.model_dump(mode='json') if signature is not None else None,
        'control_evidence_claim_ref': control_ref,
        'control_evidence_action_data': intent.action_data,
        'control_binding_producer_ref': prepared.selection_policy_ref,
    })


def freeze_prepared_control_binding(prepared, snapshot):
    """Transport the newly committed proof; selection remains in DRM/SRC."""
    intent = prepared.intent
    facts = {'control_evidence_binding_required': intent.control_evidence_binding_required,
        'control_evidence_signature': intent.control_evidence_signature,
        'control_evidence_claim_ref': intent.control_evidence_claim_ref}
    frozen = freeze_control_evidence_binding(facts, snapshot)
    return prepared.model_copy(update={
        'intent': intent.model_copy(update={**frozen, 'state_revision': snapshot.revision}),
        'context': FrozenMap.overlay({'snapshot_digest': snapshot.state_hash}, prepared.context),
    })
