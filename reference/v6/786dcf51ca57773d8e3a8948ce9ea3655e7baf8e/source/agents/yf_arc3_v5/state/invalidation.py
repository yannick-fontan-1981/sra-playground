"""Read explicit Source withdrawals for the references frozen into an action.

Provenance is not inferred to be a necessary world condition. Historical
acquisition evidence and unrelated branches are not traversed or withdrawn.
"""


def declared_action_invalidation_sources(store, intent, permit=None):
    refs = (
        intent.id, *intent.expectation_refs, *intent.premise_claim_refs,
        *intent.canonical_premise_claim_refs,
    )
    # A reusable goal TERM is not the immutable proof of its current means.
    # Inspect canonical proof links without permanently withdrawing the goal.
    refs = (*refs, *(ref for ref in (
        *intent.goal_dependency_chain_refs, *intent.declared_dependency_chain_refs,
        *intent.goal_graph_edge_refs,
    ) if store.snapshot.claim(ref) is not None))
    if permit is not None:
        refs = (*refs, permit.id)
    return store.source_invalidation_sources(refs)
