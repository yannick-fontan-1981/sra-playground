import {
  isAgentAction,
  type AgentAction,
  type AgentObservation,
} from '../runtime/contracts.ts';
import type { CompositionBundle } from './v6-composition-engine.ts';
import type { CampaignLogosActionPayload } from './v6-common-campaign-owner.ts';
import type { AuthorityObservationIdentity } from './v6-native-authority.ts';
import type { SymbolicRecord } from './v6-operations.ts';

const payloadCache = new WeakMap<AgentObservation, Map<string, CampaignLogosActionPayload>>();

function nonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function payloadCacheKey(action: AgentAction, jointRef: string): string {
  return `${jointRef}\u0000${JSON.stringify(action)}`;
}

/**
 * Build one canonical OP28 payload for an action that has already been selected
 * by explicit joint-channel contributors.
 *
 * This helper performs no perception, ranking or tie-breaking. It merely binds
 * an agreed action to the current public observation so independently produced
 * contributions can prove exact release-contract equality.
 *
 * Multiple channels contributing to the same in-memory observation receive the
 * same immutable-by-contract payload identity. This avoids constructing and
 * fingerprinting an identical symbolic bundle once per channel. The cache is
 * observation-scoped and disappears when that public observation is collected.
 */
export function prepareJointChannelActionPayload(
  observation: AgentObservation,
  action: AgentAction,
  jointRef: string,
): CampaignLogosActionPayload | undefined {
  nonEmpty(jointRef, 'joint channel reference');
  if (observation.state !== 'NOT_FINISHED') return undefined;
  if (!isAgentAction(action)) return undefined;
  if (!observation.availableActionIds.includes(action.id)) return undefined;

  const key = payloadCacheKey(action, jointRef);
  const cached = payloadCache.get(observation)?.get(key);
  if (cached) return cached;

  const selectedAction = structuredClone(action);
  const actionRef = `ACTION${selectedAction.id}`;
  const scope = `${observation.sessionId}:level:${observation.level}`;
  const observationRef = `public-observation:${observation.sessionId}:${observation.sequence}`;
  const compositionRef = `joint-action:${scope}:${jointRef}:${actionRef}`;
  const objectiveRef = `joint-objective:${scope}:${jointRef}:advance`;
  const bundleId = `joint-bundle:${scope}:${observation.sequence}:${jointRef}:${actionRef}`;
  const facts = {
    joint_channels_compatible: true,
    joint_ref: jointRef,
    selected_action: actionRef,
    public_action_available: true,
  };

  const bundle: CompositionBundle = {
    id: bundleId,
    operation_key: 'OP28',
    composition_ref: compositionRef,
    objective_ref: objectiveRef,
    preserve_refs: [observationRef],
    observation_revision: observation.sequence,
    kind: 'realize',
    actions: [selectedAction],
    purpose: 'realize an action supported by compatible explicit joint channels',
    preconditions: facts,
    evidence: [
      observationRef,
      `joint-channel-agreement:${jointRef}`,
      `public-available-action:${actionRef}`,
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
      actions: [selectedAction],
      evidence: `joint-channel-agreement:${jointRef}`,
    }],
  };

  const identity: AuthorityObservationIdentity = {
    episodeId: observation.sessionId,
    levelEpoch: scope,
    observationId: observationRef,
    observationRevision: observation.sequence,
  };

  const payload: CampaignLogosActionPayload = {
    action: selectedAction,
    bundle,
    state,
    identity,
  };
  let byKey = payloadCache.get(observation);
  if (!byKey) {
    byKey = new Map<string, CampaignLogosActionPayload>();
    payloadCache.set(observation, byKey);
  }
  byKey.set(key, payload);
  return payload;
}
