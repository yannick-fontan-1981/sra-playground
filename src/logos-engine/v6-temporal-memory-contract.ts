/**
 * Reconstructed current-observation memory reuse contract for Lot 10D.
 *
 * Derived from the durable V5 memory_reuse_contract.py semantics. This module
 * does not reconstruct the lost TemporalSelection state machine and does not
 * infer usefulness, priority, a candidate, or ACT authority.
 */

export interface TemporalMemoryProof {
  ref: string;
  digest: string;
  disposition: 'active' | 'inactive';
  polarity: 'positive' | 'negative';
  epistemicStatus: 'supported' | 'established' | 'unknown' | 'hypothesis';
  activeContradictions: readonly string[];
  defeatedBy: readonly string[];
  memoryRevalidationObservationRef?: string;
}

export interface TemporalMemoryReuseFacts {
  memoryReuseRequired: boolean;
  memoryReuseContractRef?: string;
  recalledClaimRefs: readonly string[];
  currentSupportClaimRefs: readonly string[];
}

export interface TemporalMemoryReuseContract {
  contractRef?: string;
  recalledClaimRefs: readonly string[];
  currentSupportClaimRefs: readonly string[];
  observationRef: string;
  claimDigests: Readonly<Record<string, string>>;
}

export interface TemporalMemoryIntent {
  frameId: string;
  memoryReuseRequired: boolean;
  canonicalPremiseClaimRefs: readonly string[];
  premiseClaimRefs: readonly string[];
  memoryReuseContract: TemporalMemoryReuseContract | null;
}

function uniqueBoundedRefs(refs: readonly string[], name: string): string[] {
  if (refs.length < 1 || refs.length > 32) {
    throw new Error(`${name} must contain between 1 and 32 refs`);
  }
  if (new Set(refs).size !== refs.length) {
    throw new Error(`${name} contains duplicate refs`);
  }
  return [...refs];
}

export function freezeTemporalMemoryReuse(
  facts: TemporalMemoryReuseFacts,
  proofs: Readonly<Record<string, TemporalMemoryProof>>,
  observationRef: string,
): TemporalMemoryReuseContract | null {
  if (!facts.memoryReuseRequired) return null;

  const recalled = uniqueBoundedRefs(facts.recalledClaimRefs, 'recalledClaimRefs');
  const current = uniqueBoundedRefs(facts.currentSupportClaimRefs, 'currentSupportClaimRefs');
  const claimDigests: Record<string, string> = {};

  for (const ref of [...recalled, ...current]) {
    const proof = proofs[ref];
    if (!proof) throw new Error(`declared memory proof is absent: ${ref}`);
    claimDigests[ref] = proof.digest;
  }

  return {
    contractRef: facts.memoryReuseContractRef,
    recalledClaimRefs: recalled,
    currentSupportClaimRefs: current,
    observationRef,
    claimDigests,
  };
}

function validActiveProof(proof: TemporalMemoryProof): boolean {
  return proof.disposition === 'active'
    && proof.polarity === 'positive'
    && proof.activeContradictions.length === 0
    && proof.defeatedBy.length === 0
    && (proof.epistemicStatus === 'supported' || proof.epistemicStatus === 'established');
}

export function validateTemporalMemoryReuse(
  intent: TemporalMemoryIntent,
  proofs: Readonly<Record<string, TemporalMemoryProof>>,
  observationRef: string,
): void {
  const contract = intent.memoryReuseContract;

  if (intent.memoryReuseRequired && contract === null) {
    throw new Error('required memory reuse contract was lost in transport');
  }
  if (contract === null) return;

  if (contract.observationRef !== observationRef || contract.observationRef !== intent.frameId) {
    throw new Error('memory revalidation does not belong to the current observation');
  }

  const refs = [...contract.recalledClaimRefs, ...contract.currentSupportClaimRefs];
  const canonical = new Set(intent.canonicalPremiseClaimRefs);
  const premises = new Set(intent.premiseClaimRefs);

  for (const ref of refs) {
    if (!canonical.has(ref) || !premises.has(ref)) {
      throw new Error(`memory proof is absent from the frozen action why: ${ref}`);
    }

    const proof = proofs[ref];
    if (!proof || !validActiveProof(proof) || proof.digest !== contract.claimDigests[ref]) {
      throw new Error(`memory proof is absent, changed or inactive: ${ref}`);
    }

    if (
      contract.currentSupportClaimRefs.includes(ref)
      && proof.memoryRevalidationObservationRef !== observationRef
    ) {
      throw new Error(`current memory support has no current observation binding: ${ref}`);
    }
  }
}
