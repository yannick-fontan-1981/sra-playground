"""Current versions of an engagement's named premises, without route selection."""
from agents.yf_arc3_v5.capabilities.goal_frontier_review import measure_declared_goal_dependencies
from agents.yf_arc3_v5.logos.operational_engagement import OperationalConsciousnessEngagementDependencies
from agents.yf_arc3_v5.logos.types import Disposition, FrozenMap, stable_digest


def measure_engagement_dependencies(store, incoming, identity, maximum):
    responsibility = incoming.operational_consciousness.responsibility
    goal_ref = responsibility.problem.local_goal_ref
    contribution = responsibility.contribution
    premises = tuple(contribution.premise_claim_refs)
    preservation = tuple(dict.fromkeys((*contribution.preserve_constraint_refs, *contribution.overshoot_constraint_refs)))
    refs = tuple(sorted(set((*premises, *preservation))))
    complete = len(refs) <= maximum
    examined = refs if complete else ()
    snapshot = measure_declared_goal_dependencies(goal_ref=goal_ref, facts={}, goal_facts={},
        snapshot=store.snapshot, store=store, timeline_ref=identity['timeline_ref'],
        frame_ref=identity['frame_ref'], additional_dependency_refs=examined)
    missing, expired, inactive, contested, evidence = [], [], [], [], {}
    if complete:
        for ref in premises:
            claim = store.snapshot.claim(ref)
            if claim is None:
                missing.append(ref)
                continue
            if claim.valid_through_state_revision is not None and claim.valid_through_state_revision < store.snapshot.revision:
                expired.append(ref)
            if claim.disposition is not Disposition.ACTIVE:
                inactive.append(ref)
            contests = tuple(dict.fromkeys((*claim.active_contradictions, *claim.defeated_by)))
            if contests:
                contested.append(ref)
            if len(contests) > maximum:
                complete = False
                continue
            evidence[ref] = FrozenMap({item: stable_digest(store.snapshot.claim(item))
                if store.snapshot.claim(item) is not None else None for item in sorted(contests)})
    return OperationalConsciousnessEngagementDependencies(goal_ref=goal_ref,
        declared_premise_refs=premises, preservation_refs=preservation, snapshot=snapshot,
        missing_premise_refs=tuple(missing), expired_premise_refs=tuple(expired),
        inactive_premise_refs=tuple(inactive), contested_premise_refs=tuple(contested),
        contest_evidence_versions=FrozenMap(evidence), reference_domain_complete=complete)
