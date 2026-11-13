"""Exact goal declaration/reference transport, independent of world geometry."""
from agents.yf_arc3_v5.logos.operational_goal_intent import (
    OPERATIONAL_GOAL_INTENT_FIELDS, OPERATIONAL_GOAL_REFERENCE_FIELDS,
    OperationalConsciousnessGoalIntent,
)
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from agents.yf_arc3_v5.logos.operational_goal_hypothesis import read_goal_hypotheses


def measure_operational_goal_intent(*, goal_ref, facts, snapshot, store=None, timeline_ref=None, frame_ref=None):
    declarations = FrozenMap({field: facts[field] for field in OPERATIONAL_GOAL_INTENT_FIELDS if field in facts})
    refs = set()
    evidence_definitions = {}
    observation_origins = {}
    for hypothesis in read_goal_hypotheses(declarations.get('operational_goal_hypotheses') or (), goal_ref=goal_ref):
        if hypothesis.origin_claim_ref is not None:
            refs.add(hypothesis.origin_claim_ref)
            for ref in hypothesis.support_evidence_refs:
                observation_origins.setdefault(ref, set()).add(hypothesis.origin_claim_ref)
        for definition in hypothesis.expected_goal_evidence:
            evidence_definitions.setdefault(definition.evidence_ref, {})[stable_digest(definition)] = definition
        # References of the goal and of its experiment retain separate roles
        # in the declaration; versioning either only requests reevaluation.
        refs.update((*hypothesis.support_claim_refs, *hypothesis.support_evidence_refs, *hypothesis.goal_falsifier_refs,
            *hypothesis.expected_goal_evidence_refs, *hypothesis.experiment_expected_effect_refs,
            *hypothesis.experiment_falsifier_refs))
    for field in OPERATIONAL_GOAL_REFERENCE_FIELDS:
        value = declarations.get(field)
        values = value if isinstance(value, (tuple, list)) else (value,)
        refs.update(ref for ref in values if isinstance(ref, str) and ref)
    versions, unresolved, expired = {}, [], []
    for ref in sorted(refs):
        acquired_support = False
        term, claim = snapshot.term(ref), snapshot.claim(ref)
        is_expired = bool(claim is not None and claim.valid_through_state_revision is not None
            and claim.valid_through_state_revision < snapshot.revision)
        versions[ref] = FrozenMap({'term_digest': stable_digest(term) if term is not None else None,
            'claim_digest': stable_digest(claim) if claim is not None else None,
            'claim_expired': is_expired})
        if ref in evidence_definitions:
            from agents.yf_arc3_v5.state.conscious_goal_evidence import measure_declared_goal_evidence
            variants = evidence_definitions[ref]
            versions[ref] = FrozenMap({**versions[ref], 'declared_evidence_measurements': tuple(
                measure_declared_goal_evidence(expectation=variants[key], goal_ref=goal_ref, snapshot=snapshot,
                    store=store, timeline_ref=timeline_ref, frame_ref=frame_ref) for key in sorted(variants))})
        if ref in observation_origins:
            from agents.yf_arc3_v5.state.conscious_goal_evidence import measure_goal_observation_support
            receipts = tuple(measure_goal_observation_support(evidence_ref=ref, origin_claim_ref=origin,
                goal_ref=goal_ref, snapshot=snapshot, store=store, timeline_ref=timeline_ref)
                for origin in sorted(observation_origins[ref]))
            versions[ref] = FrozenMap({**versions[ref], 'observation_support_measurements': receipts})
            acquired_support = bool(receipts) and all(row['acquisition_support_bound'] for row in receipts)
        if term is None and claim is None and ref not in evidence_definitions and not acquired_support:
            unresolved.append(ref)
        if is_expired:
            expired.append(ref)
    return OperationalConsciousnessGoalIntent(goal_ref=goal_ref, declarations=declarations,
        reference_versions=FrozenMap(versions), unresolved_refs=tuple(unresolved),
        expired_claim_refs=tuple(expired))
