"""Bounded transport and exact validation of Source-declared memory dependencies.

No role, usefulness, priority or fallback is decided here. DRM declares the
recall and current proofs; SRC owns the rejection/reconciliation boundary.
"""
from agents.yf_arc3_v5.logos.operations import MemoryReuseContract
from agents.yf_arc3_v5.logos.types import stable_digest


def freeze_declared_memory_reuse(facts, snapshot, observation_ref):
    if facts.get("memory_reuse_required") is not True:
        return None
    recalled = tuple(facts.get("memory_recalled_claim_refs") or ())
    current = tuple(facts.get("memory_current_support_claim_refs") or ())
    if not recalled or not current or len(recalled) > 32 or len(current) > 32:
        raise ValueError("declared memory reuse is missing bounded recall/current proofs")
    versions = {}
    for ref in (*recalled, *current):
        claim = snapshot.claim(ref)
        if claim is None:
            raise ValueError("declared memory proof is absent: " + ref)
        versions[ref] = stable_digest(claim)
    return MemoryReuseContract(
        contract_ref=facts.get("memory_reuse_contract_ref"),
        recalled_claim_refs=recalled, current_support_claim_refs=current,
        observation_ref=observation_ref, claim_digests=versions,
    )


def validate_memory_reuse_contract(intent, snapshot, observation_ref):
    contract = intent.memory_reuse_contract
    if intent.memory_reuse_required and contract is None:
        raise ValueError("required memory reuse contract was lost in transport")
    if contract is None:
        return
    if contract.observation_ref != observation_ref or contract.observation_ref != intent.frame_id:
        raise ValueError("memory revalidation does not belong to the current observation")
    refs = (*contract.recalled_claim_refs, *contract.current_support_claim_refs)
    if not set(refs).issubset(intent.canonical_premise_claim_refs) or not set(refs).issubset(intent.premise_claim_refs):
        raise ValueError("memory proof is absent from the frozen action why")
    for ref in refs:
        claim = snapshot.claim(ref)
        if (claim is None or claim.disposition.value != "active"
                or claim.polarity.value != "positive" or claim.active_contradictions
                or claim.defeated_by or claim.epistemic_status.value not in ("supported", "established")
                or stable_digest(claim) != contract.claim_digests[ref]
                or not any(row.id == ref for row in snapshot.claims_for_predicate(claim.predicate))):
            raise ValueError("memory proof is absent, changed or inactive: " + ref)
        if ref in contract.current_support_claim_refs and claim.attributes.get(
                "memory_revalidation_observation_ref") != observation_ref:
            raise ValueError("current memory support has no current observation binding: " + ref)
