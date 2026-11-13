import type { AgentAction, AgentObservation } from '../runtime/contracts.ts';
import type { AgentDecisionPort } from '../runtime/v6-agent-worker-core.ts';
import type { CompositionBundle } from './v6-composition-engine.ts';
import { releaseBundle, type AuthorityObservationIdentity } from './v6-native-authority.ts';
import type { OperationResultCache } from './v6-operation-cache.ts';
import type { OperationTraceSink } from './v6-operation-trace.ts';
import type { SymbolicRecord } from './v6-operations.ts';

type SimplePublicActionId = 1 | 2 | 3 | 4 | 5 | 7;

export interface PublicSingleActionPreparation {
  action: AgentAction;
  bundle: CompositionBundle;
  state: SymbolicRecord;
  identity: AuthorityObservationIdentity;
}

export interface PublicSingleActionLogosDecisionOptions {
  trace?: OperationTraceSink;
  cache?: OperationResultCache;
}

function simplePublicActionId(value: number): value is SimplePublicActionId {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 7;
}

/**
 * Produce an OP28 decision only when the public protocol leaves one distinct
 * non-reset action and that action needs no missing coordinates.
 *
 * This is deliberately not a general perception or planning system. Multiple
 * available actions, ACTION6 without coordinates and terminal observations do
 * not produce a bundle or invoke Logos.
 */
export function preparePublicSingleActionDecision(
  observation: AgentObservation,
): PublicSingleActionPreparation | undefined {
  if (observation.state !== 'NOT_FINISHED') return undefined;

  const distinct = [...new Set(observation.availableActionIds.filter(id => id !== 0))];
  if (distinct.length !== 1) return undefined;
  const actionId = distinct[0];
  if (actionId === undefined || !simplePublicActionId(actionId)) return undefined;

  const action: AgentAction = { id: actionId };
  const scope = `${observation.sessionId}:level:${observation.level}`;
  const observationRef = `public-observation:${observation.sessionId}:${observation.sequence}`;
  const compositionRef = `public-action:${scope}:ACTION${actionId}`;
  const objectiveRef = `public-objective:${scope}:advance`;
  const bundleId = `public-bundle:${scope}:${observation.sequence}:ACTION${actionId}`;
  const facts = {
    public_action_available: true,
    sole_non_reset_action: `ACTION${actionId}`,
  };

  const bundle: CompositionBundle = {
    id: bundleId,
    operation_key: 'OP28',
    composition_ref: compositionRef,
    objective_ref: objectiveRef,
    preserve_refs: [observationRef],
    observation_revision: observation.sequence,
    kind: 'realize',
    actions: [action],
    purpose: 'realize the sole public non-reset action that needs no missing coordinates',
    preconditions: facts,
    evidence: [
      observationRef,
      `public-available-actions:ACTION${actionId}`,
    ],
    preservation_evidence: {
      [observationRef]: 'public-observation-contract-v1',
    },
    outcome_guard: { path: ['value'], contains: bundleId },
  };

  const state: SymbolicRecord = {
    compositions: [
      { id: observationRef, observed: true },
      { id: compositionRef, observed: true },
      { id: objectiveRef, observed: true },
    ],
    facts,
    bundles: [{
      id: bundleId,
      composition_ref: compositionRef,
      admitted: true,
      actions: [action],
      evidence: observationRef,
    }],
  };

  return {
    action,
    bundle,
    state,
    identity: {
      episodeId: observation.sessionId,
      levelEpoch: scope,
      observationId: observationRef,
      observationRevision: observation.sequence,
    },
  };
}

/** First bounded product-capable Logos decision port for the reconstructed worker. */
export class PublicSingleActionLogosDecisionPort implements AgentDecisionPort {
  readonly options: PublicSingleActionLogosDecisionOptions;

  constructor(options: PublicSingleActionLogosDecisionOptions = {}) {
    this.options = options;
  }

  decide(
    observation: AgentObservation,
    _budgetMs: number,
    signal: AbortSignal,
  ): AgentAction | undefined {
    if (signal.aborted) return undefined;
    const prepared = preparePublicSingleActionDecision(observation);
    if (!prepared) return undefined;

    const release = releaseBundle(
      prepared.bundle,
      prepared.state,
      prepared.identity,
      this.options.trace,
      this.options.cache,
    );
    if (signal.aborted || !release.releaseAllowed) return undefined;
    return structuredClone(prepared.action);
  }
}
