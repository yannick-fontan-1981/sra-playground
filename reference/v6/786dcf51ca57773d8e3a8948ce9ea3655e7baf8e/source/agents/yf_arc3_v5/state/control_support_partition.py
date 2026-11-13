"""Snapshot-backed types for current control support and historical provenance.

No absent reference is silently discarded or promoted to a Claim. SRC/DRM must
interpret the returned counters and preserve the exact declared dependencies.
"""
from agents.yf_arc3_v5.logos.operations import (
    CompiledTemporalTrackingRecord, OperatorInvocation, OperatorResult,
    WorkflowInstanceRecord, WorkflowStatus,
)
from agents.yf_arc3_v5.logos.types import FrozenMap,stable_digest
from agents.yf_arc3_v5.state.reference_bindings import canonical_reference_bindings_current


def partition_control_support_rows(rows, store, frame_ref):
    snapshot=store.snapshot;output=[]
    if len(rows)>128:raise ValueError('current control support row bound exceeded')
    for row in rows:
        refs=tuple(row.get('role_premise_claim_refs',()))
        terms=tuple(source['term_ref'] for source in row.get('source_term_rows',()))
        if row.get('term_ref'):terms=(*terms,row['term_ref'])
        if len(refs)>128 or len(terms)>128:raise ValueError('current control support reference bound exceeded')
        declared_kinds=dict(row.get('control_support_reference_kinds',{}))
        for ref in terms:declared_kinds.setdefault(ref,'TERM')
        claim_refs=[];claim_bindings=[];term_bindings=[];provenance=[];unresolved=[];stale=[]
        for ref in sorted(set(refs)|set(terms)):
            claim=snapshot.claim(ref)
            term=snapshot.term(ref)
            declared_kind=declared_kinds.get(ref)
            if declared_kind not in {None,'CLAIM','TERM','PROVENANCE'}:
                unresolved.append(ref);continue
            if declared_kind=='CLAIM' and claim is None:
                unresolved.append(ref);continue
            if declared_kind=='TERM' and term is None:
                unresolved.append(ref);continue
            if claim is not None and declared_kind not in {'TERM','PROVENANCE'}:
                # Preserve the Claim even when inactive: its actual epistemic
                # status and contradictions remain for the existing SRC guard.
                claim_refs.append(ref)
                claim_bindings.append(FrozenMap({'claim_ref':ref,'content_digest':stable_digest(claim),
                    'reference_bindings_current':all(
                        canonical_reference_bindings_current(snapshot, argument, frame_ref=frame_ref,
                            observation_ref=frame_ref, require_projectable=False)
                        for argument_ref in claim.arguments
                        if (argument := snapshot.term(argument_ref)) is not None)}))
            elif term is not None and declared_kind!='PROVENANCE':
                current=canonical_reference_bindings_current(snapshot,term,
                    frame_ref=frame_ref,observation_ref=frame_ref,require_projectable=False)
                # Current role rows were already projection-qualified by the
                # producer. A referenced acquisition TERM need not itself be
                # projected as a new percept; ACT applies this same distinction.
                term_bindings.append(FrozenMap({'term_ref':ref,'revision':term.last_changed_state_revision,
                    'content_digest':stable_digest(term),'scope_frame_ref':frame_ref,
                    'reference_bindings_current':current,
                    'own_term_dependencies':term.attributes.get('canonical_term_dependency_revisions',()),
                    'own_claim_dependencies':term.attributes.get('canonical_claim_dependency_digests',())}))
                if not current:stale.append(ref)
            else:
                artifact=store.artifact(ref)
                if isinstance(artifact,OperatorInvocation):
                    provenance.append(FrozenMap({'record_ref':ref,'record_kind':artifact.record_kind,
                        'content_digest':stable_digest(artifact),'frame_ref':artifact.frame_id,
                        'timeline_ref':artifact.timeline_id,'historical_provenance':True}))
                elif isinstance(artifact,OperatorResult):
                    invocation=store.artifact(artifact.invocation_id)
                    if (not isinstance(invocation,OperatorInvocation)
                        or any(getattr(invocation,field)!=getattr(artifact,field) for field in
                            ('workflow_instance_id','workflow_step_id','frame_id','timeline_id','operator'))):
                        unresolved.append(ref);continue
                    provenance.append(FrozenMap({'record_ref':ref,'record_kind':artifact.record_kind,
                        'content_digest':stable_digest(artifact),'invocation_ref':artifact.invocation_id,
                        'frame_ref':artifact.frame_id,'timeline_ref':artifact.timeline_id,
                        'historical_provenance':True}))
                elif isinstance(artifact, CompiledTemporalTrackingRecord):
                    # Compiled tracking has its own source-qualified witness;
                    # it does not manufacture an OperatorInvocation.
                    provenance.append(FrozenMap({'record_ref':ref,'record_kind':artifact.record_kind,
                        'content_digest':stable_digest(artifact),'frame_ref':artifact.frame_id,
                        'timeline_ref':artifact.timeline_id,'source_hash':artifact.source_hash,
                        'module_source_hash':artifact.module_source_hash,
                        'historical_provenance':True}))
                elif isinstance(artifact, WorkflowInstanceRecord) and artifact.status is WorkflowStatus.COMPLETED:
                    # Interpreted SRC leaves a completed checkpoint instead of
                    # a compiled measurement record. It remains provenance,
                    # never a substitute canonical Claim or current binding.
                    provenance.append(FrozenMap({'record_ref':ref,'record_kind':artifact.record_kind,
                        'content_digest':stable_digest(artifact),'frame_ref':artifact.frame_id,
                        'timeline_ref':artifact.timeline_id,'source_hash':artifact.source_hash,
                        'workflow_definition_ref':artifact.workflow_definition_id,
                        'historical_provenance':True}))
                else:unresolved.append(ref)
        output.append(FrozenMap({**row,
            **({'control_geometry_identity_projection': FrozenMap({
                field: row[field] for field in row['control_geometry_identity_fields'] if field in row
            })} if row.get('control_geometry_identity_fields') else {}),
            'control_support_claim_refs':tuple(claim_refs),
            'control_support_claim_bindings':tuple(claim_bindings),
            'control_support_term_bindings':tuple(term_bindings),
            'control_support_provenance_records':tuple(provenance),
            'control_support_unresolved_refs':tuple(unresolved),
            'control_support_stale_term_refs':tuple(stale),
            'control_support_partition_frame_ref':frame_ref}))
    return tuple(output)


def declared_local_reference_revision_floor(store, reference_family):
    """Read the revision fence of Source's canonical scene-handoff contract.

    Historical role/effect evidence remains canonical. A scene-local reference
    predating the declared handoff requires a new binding before operational use.
    The fence is reconstructed from canonical proof artifacts, not runtime history.
    """
    claims = store.snapshot.current_claims_by_predicate.get(
        'declares_level_boundary_handoff', ())
    revisions = []
    for claim in claims:
        if reference_family not in claim.attributes.get('drop_local_reference_families', ()):
            continue
        if claim.attributes.get('requires_scene_rebinding') is not True:
            continue
        for ref in claim.source_operator_results:
            result = store.artifact(ref)
            if isinstance(result, OperatorResult):
                revisions.append(result.state_revision)
    return max(revisions, default=None)
