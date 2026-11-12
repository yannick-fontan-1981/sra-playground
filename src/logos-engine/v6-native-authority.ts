import { executeBundleOperation, type CompositionBundle } from './v6-composition-engine.ts';
import type { SymbolicRecord } from './v6-operations.ts';
import type { OperationCompleteness, OperationTraceSink } from './v6-operation-trace.ts';
import type { OperationResultCache } from './v6-operation-cache.ts';

export interface AuthorityObservationIdentity {
  episodeId: string;
  levelEpoch: string | number;
  observationId: string;
  observationRevision: number;
}

export interface ReleaseNeed {
  status: 'needed' | 'not_required' | 'blocked';
  needId: string;
  reason: string;
  completeness: OperationCompleteness;
}

function needId(bundle: CompositionBundle, identity: AuthorityObservationIdentity): string {
  return `need:${identity.episodeId}:${identity.levelEpoch}:${identity.observationId}:${bundle.operation_key}:${bundle.id}`;
}

export function assessReleaseNeed(
  bundle: CompositionBundle,
  state: SymbolicRecord,
  identity: AuthorityObservationIdentity,
  trace?: OperationTraceSink,
): ReleaseNeed {
  const id = needId(bundle, identity);
  const compositions = (state.compositions ?? []) as SymbolicRecord[];
  const focus = compositions.find(composition => composition.id === bundle.composition_ref);

  if (bundle.operation_key === 'OP18') {
    if (!focus) {
      trace?.record({
        kind: 'need', needId: id, needKind: 'exploration-question', reason: 'focus composition is unavailable',
        producer: 'nativeAuthority.release', episodeId: identity.episodeId, levelEpoch: identity.levelEpoch,
        observationId: identity.observationId, observationRevision: identity.observationRevision,
        focusRef: bundle.composition_ref, objectiveRef: bundle.objective_ref,
        dependencyRefs: [bundle.composition_ref], completeness: 'unknown',
      });
      return { status: 'blocked', needId: id, reason: 'focus composition unavailable', completeness: 'unknown' };
    }
    if (focus.observed || !focus.open_question) {
      return { status: 'not_required', needId: id, reason: 'no unresolved open question for this composition', completeness: 'not_produced' };
    }
    trace?.record({
      kind: 'need', needId: id, needKind: 'exploration-question', reason: String(focus.open_question),
      producer: 'nativeAuthority.release', episodeId: identity.episodeId, levelEpoch: identity.levelEpoch,
      observationId: identity.observationId, observationRevision: identity.observationRevision,
      focusRef: bundle.composition_ref, objectiveRef: bundle.objective_ref,
      dependencyRefs: [bundle.composition_ref, identity.observationId], completeness: 'complete',
    });
    return { status: 'needed', needId: id, reason: String(focus.open_question), completeness: 'complete' };
  }

  if (bundle.operation_key === 'OP28') {
    const runtimeBundle = ((state.bundles ?? []) as SymbolicRecord[]).find(candidate => candidate.id === bundle.id);
    const reason = 'realize the currently selected admitted bundle';
    trace?.record({
      kind: 'need', needId: id, needKind: 'realize-bundle', reason,
      producer: 'nativeAuthority.release', episodeId: identity.episodeId, levelEpoch: identity.levelEpoch,
      observationId: identity.observationId, observationRevision: identity.observationRevision,
      focusRef: bundle.composition_ref, objectiveRef: bundle.objective_ref,
      dependencyRefs: [bundle.id, bundle.composition_ref, identity.observationId],
      completeness: runtimeBundle ? 'complete' : 'unknown',
    });
    if (!runtimeBundle) return { status: 'blocked', needId: id, reason: 'runtime bundle unavailable', completeness: 'unknown' };
    if (runtimeBundle.admitted !== true) return { status: 'blocked', needId: id, reason: 'runtime bundle is not admitted', completeness: 'partial' };
    if (!Array.isArray(runtimeBundle.actions) || runtimeBundle.actions.length === 0) {
      return { status: 'blocked', needId: id, reason: 'runtime bundle has no actions', completeness: 'partial' };
    }
    return { status: 'needed', needId: id, reason, completeness: 'complete' };
  }

  return { status: 'not_required', needId: id, reason: 'operation has no physical release contract', completeness: 'not_produced' };
}

export function releaseBundle(
  bundle: CompositionBundle,
  state: SymbolicRecord,
  identity: AuthorityObservationIdentity,
  trace?: OperationTraceSink,
  cache?: OperationResultCache,
): { need: ReleaseNeed; releaseAllowed: boolean; result?: ReturnType<typeof executeBundleOperation> } {
  const need = assessReleaseNeed(bundle, state, identity, trace);
  if (need.status !== 'needed') {
    trace?.record({
      kind: 'operation', needId: need.needId, op: bundle.operation_key, caller: 'nativeAuthority.release',
      mode: need.status === 'blocked' ? 'blocked' : 'not_required', reason: need.reason,
      inputRefs: [bundle.id, bundle.composition_ref], dependencyRevisions: { observation: identity.observationRevision },
      resultStatus: need.completeness,
    });
    return { need, releaseAllowed: false };
  }

  const result = executeBundleOperation(bundle, state, identity.observationRevision, {
    needId: need.needId, caller: 'nativeAuthority.release', decisionRef: `release:${bundle.id}:${identity.observationId}`, trace, cache,
    cacheIdentity: {
      op: bundle.operation_key, focusRef: bundle.composition_ref, levelEpoch: identity.levelEpoch,
      observationId: identity.observationId, observationRevision: identity.observationRevision,
      inputRefs: [bundle.id, bundle.composition_ref],
      dependencyRevisions: { observation: identity.observationRevision, bundle: bundle.observation_revision },
      objectiveRef: bundle.objective_ref,
    },
  });
  return { need, releaseAllowed: result.releaseAllowed, result };
}
