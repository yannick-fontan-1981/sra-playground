import type { CompositionBundle } from './v6-composition-engine.ts';
import { releaseBundle, type AuthorityObservationIdentity } from './v6-native-authority.ts';
import type { OperationResultCache } from './v6-operation-cache.ts';
import type { OperationTraceSink } from './v6-operation-trace.ts';
import type { SymbolicRecord } from './v6-operations.ts';
import { KnowledgeStore, postAnalysis, type PostAnalysisReceipt } from './v6-target-binding.ts';

export interface OperationCycleOptions {
  trace?: OperationTraceSink;
  cache?: OperationResultCache;
  knowledge?: KnowledgeStore;
}

export interface OperationCycleResult {
  released: boolean;
  needStatus: 'needed' | 'not_required' | 'blocked';
  needId: string;
  postAnalysis: PostAnalysisReceipt[];
  knowledge: KnowledgeStore;
}

/**
 * Join an already-selected physical bundle to the analysis of its observed return.
 * This function does not choose a bundle and does not alter priorities.
 */
export function runOperationCycle(
  bundle: CompositionBundle,
  beforeState: SymbolicRecord,
  identity: AuthorityObservationIdentity,
  afterState: SymbolicRecord | undefined,
  options: OperationCycleOptions = {},
): OperationCycleResult {
  const knowledge = options.knowledge ?? new KnowledgeStore();
  const release = releaseBundle(bundle, beforeState, identity, options.trace, options.cache);
  if (!release.releaseAllowed || !afterState) {
    return {
      released: release.releaseAllowed,
      needStatus: release.need.status,
      needId: release.need.needId,
      postAnalysis: [],
      knowledge,
    };
  }

  const receipts = postAnalysis(afterState, bundle.composition_ref, {
    needId: release.need.needId,
    observationRevision: Number(afterState.observation_revision ?? identity.observationRevision + 1),
    decisionRef: `postAnalysis:${bundle.id}:${String(afterState.observation_ref ?? identity.observationId)}`,
    trace: options.trace,
    knowledge,
  });
  return {
    released: true,
    needStatus: release.need.status,
    needId: release.need.needId,
    postAnalysis: receipts,
    knowledge,
  };
}
