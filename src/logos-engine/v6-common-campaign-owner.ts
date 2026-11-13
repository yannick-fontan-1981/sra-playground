import {
  isAgentAction,
  type AgentAction,
  type AgentObservation,
} from '../runtime/contracts.ts';
import type { CompositionBundle } from './v6-composition-engine.ts';
import {
  releaseBundle,
  type AuthorityObservationIdentity,
  type ReleaseNeed,
} from './v6-native-authority.ts';
import type { OperationResultCache } from './v6-operation-cache.ts';
import type { OperationTraceSink } from './v6-operation-trace.ts';
import type { SymbolicRecord } from './v6-operations.ts';
import {
  NeutralCommonCaller,
  type CallerRouteReceipt,
  type CallerSelection,
  type CollectedProposal,
  type CommonCallerOwner,
} from './v6-neutral-common-caller.ts';

/**
 * Payload contract for an owner that wants the common campaign to authorize a
 * physical action through the native Logos authority.
 *
 * The owner creates a fresh payload and transfers it to the campaign. The
 * campaign keeps it private until the matching public return is routed.
 * `correlation` must not contain functions, DOM objects or hidden engine state.
 */
export interface CampaignLogosActionPayload {
  action: AgentAction;
  bundle: CompositionBundle;
  state: SymbolicRecord;
  identity: AuthorityObservationIdentity;
  correlation?: unknown;
}

export interface CampaignProposalIdentity {
  ownerId: string;
  proposalRef: string;
  actionRef: string;
}

/** Exact identity and correlation routed back to the selected owner. */
export interface CampaignSelectedReturnEnvelope {
  version: 1;
  needId: string;
  proposal: CampaignProposalIdentity;
  action: AgentAction;
  correlation?: unknown;
  returnPayload: unknown;
}

export interface CampaignReturnInput {
  sessionId: string;
  needId: string;
  eventRef: string;
  payload: unknown;
}

export interface CampaignReturnReceipt extends CallerRouteReceipt {
  needId: string;
  proposalRef: string;
}

export type CampaignPrepareResult =
  | { status: 'none'; proposals: CampaignProposalIdentity[] }
  | { status: 'ambiguous'; proposals: CampaignProposalIdentity[] }
  | {
      status: 'pending';
      needId: string;
      ownerId: string;
      proposalRef: string;
      action: AgentAction;
    }
  | {
      status: 'blocked';
      ownerId: string;
      proposalRef: string;
      need: ReleaseNeed;
      proposals: CampaignProposalIdentity[];
    }
  | {
      status: 'action';
      ownerId: string;
      proposalRef: string;
      bundleId: string;
      observationId: string;
      needId: string;
      action: AgentAction;
      proposals: CampaignProposalIdentity[];
    };

export interface CommonCampaignOwnerOptions {
  trace?: OperationTraceSink;
  cache?: OperationResultCache;
}

interface PendingCampaignDecision {
  sessionId: string;
  needId: string;
  selection: CallerSelection;
  selected: CollectedProposal;
  payload: CampaignLogosActionPayload;
  action: AgentAction;
}

interface SettledCampaignDecision {
  sessionId: string;
  needId: string;
  ownerId: string;
  proposalRef: string;
  eventRef: string;
}

const MAX_PENDING_SESSIONS = 64;
const MAX_SETTLED_NEEDS = 4096;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function integer(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer`);
  }
}

function sameAction(left: unknown, right: AgentAction): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function proposalIdentity(proposal: CollectedProposal): CampaignProposalIdentity {
  return {
    ownerId: proposal.ownerId,
    proposalRef: proposal.proposalRef,
    actionRef: proposal.actionRef,
  };
}

function proposalIdentities(proposals: readonly CollectedProposal[]): CampaignProposalIdentity[] {
  return proposals.map(proposalIdentity);
}

function campaignPayload(value: unknown): CampaignLogosActionPayload {
  const payload = record(value, 'campaign proposal payload');
  if (!isAgentAction(payload.action)) {
    throw new TypeError('campaign proposal payload contains an invalid action');
  }

  const bundleRecord = record(payload.bundle, 'campaign bundle');
  nonEmpty(bundleRecord.id, 'campaign bundle id');
  nonEmpty(bundleRecord.operation_key, 'campaign bundle operation');
  nonEmpty(bundleRecord.composition_ref, 'campaign composition reference');
  nonEmpty(bundleRecord.objective_ref, 'campaign objective reference');
  if (!Array.isArray(bundleRecord.actions)) {
    throw new TypeError('campaign bundle actions must be an array');
  }

  const identityRecord = record(payload.identity, 'campaign observation identity');
  nonEmpty(identityRecord.episodeId, 'campaign episode id');
  nonEmpty(identityRecord.observationId, 'campaign observation id');
  integer(identityRecord.observationRevision, 'campaign observation revision');
  if (typeof identityRecord.levelEpoch !== 'string' && typeof identityRecord.levelEpoch !== 'number') {
    throw new TypeError('campaign level epoch must be a string or number');
  }

  record(payload.state, 'campaign symbolic state');
  return payload as unknown as CampaignLogosActionPayload;
}

function validatePublicBinding(
  observation: AgentObservation,
  payload: CampaignLogosActionPayload,
): void {
  if (payload.identity.episodeId !== observation.sessionId) {
    throw new Error('campaign proposal episode does not match the public observation session');
  }
  if (payload.identity.observationRevision !== observation.sequence) {
    throw new Error('campaign proposal revision does not match the public observation sequence');
  }
  if (payload.bundle.observation_revision !== observation.sequence) {
    throw new Error('campaign bundle revision does not match the public observation sequence');
  }
  if (!observation.availableActionIds.includes(payload.action.id)) {
    throw new Error('campaign proposal selected an unavailable public action');
  }
  if (!payload.bundle.actions.some(candidate => sameAction(candidate, payload.action))) {
    throw new Error('campaign action is not contained in the supplied Logos bundle');
  }
}

/**
 * Neutral owner of one action/return campaign at a time per public session.
 *
 * It never ranks proposals. Zero proposals produce no decision, one proposal may
 * be passed to Logos, and more than one proposal remains explicitly ambiguous.
 * A released action stays pending until the caller routes the corresponding
 * public return with the same `needId`.
 */
export class CommonCampaignOwner {
  readonly #caller = new NeutralCommonCaller();
  readonly #pendingBySession = new Map<string, PendingCampaignDecision>();
  readonly #settledByNeed = new Map<string, SettledCampaignDecision>();
  readonly #options: CommonCampaignOwnerOptions;

  constructor(
    owners: readonly CommonCallerOwner[] = [],
    options: CommonCampaignOwnerOptions = {},
  ) {
    this.#options = options;
    for (const owner of owners) this.register(owner);
  }

  register(owner: CommonCallerOwner): void {
    this.#caller.register(owner);
  }

  prepare(
    observation: AgentObservation,
    contextByOwner: Readonly<Record<string, unknown>> = {},
  ): CampaignPrepareResult {
    const pending = this.#pendingBySession.get(observation.sessionId);
    if (pending) {
      return {
        status: 'pending',
        needId: pending.needId,
        ownerId: pending.selected.ownerId,
        proposalRef: pending.selected.proposalRef,
        action: structuredClone(pending.action),
      };
    }

    if (observation.state !== 'NOT_FINISHED') {
      return { status: 'none', proposals: [] };
    }

    const proposals = this.#caller.collectOwned(contextByOwner);
    const selection = this.#caller.selectOwned(proposals);
    const publicProposals = proposalIdentities(selection.proposals);
    if (selection.status === 'none') {
      return { status: 'none', proposals: publicProposals };
    }
    if (selection.status === 'ambiguous' || !selection.selected) {
      return { status: 'ambiguous', proposals: publicProposals };
    }

    const selected = selection.selected;
    const payload = campaignPayload(selected.payload);
    validatePublicBinding(observation, payload);

    const release = releaseBundle(
      payload.bundle,
      payload.state,
      payload.identity,
      this.#options.trace,
      this.#options.cache,
    );
    if (!release.releaseAllowed) {
      return {
        status: 'blocked',
        ownerId: selected.ownerId,
        proposalRef: selected.proposalRef,
        need: release.need,
        proposals: publicProposals,
      };
    }

    if (this.#pendingBySession.size >= MAX_PENDING_SESSIONS) {
      throw new RangeError(`campaign pending session count exceeds ${MAX_PENDING_SESSIONS}`);
    }

    const action = structuredClone(payload.action);
    const pendingDecision: PendingCampaignDecision = {
      sessionId: observation.sessionId,
      needId: release.need.needId,
      selection,
      selected,
      payload,
      action,
    };
    this.#pendingBySession.set(observation.sessionId, pendingDecision);

    return {
      status: 'action',
      ownerId: selected.ownerId,
      proposalRef: selected.proposalRef,
      bundleId: payload.bundle.id,
      observationId: payload.identity.observationId,
      needId: release.need.needId,
      action: structuredClone(action),
      proposals: publicProposals,
    };
  }

  acquire(input: CampaignReturnInput): CampaignReturnReceipt {
    nonEmpty(input.sessionId, 'campaign return sessionId');
    nonEmpty(input.needId, 'campaign return needId');
    nonEmpty(input.eventRef, 'campaign return eventRef');

    const settled = this.#settledByNeed.get(input.needId);
    if (settled) {
      if (settled.sessionId !== input.sessionId || settled.eventRef !== input.eventRef) {
        throw new Error('campaign return does not match the already-settled need');
      }
      return {
        needId: settled.needId,
        proposalRef: settled.proposalRef,
        ownerId: settled.ownerId,
        eventRef: settled.eventRef,
        source: 'selected',
        routed: false,
        duplicate: true,
      };
    }

    const pending = this.#pendingBySession.get(input.sessionId);
    if (!pending) throw new Error('campaign return has no pending decision for this session');
    if (pending.needId !== input.needId) {
      throw new Error('campaign return needId does not match the pending decision');
    }

    const envelope: CampaignSelectedReturnEnvelope = {
      version: 1,
      needId: pending.needId,
      proposal: proposalIdentity(pending.selected),
      action: pending.action,
      correlation: pending.payload.correlation,
      returnPayload: input.payload,
    };
    const receipt = this.#caller.routeSelected(
      pending.selection,
      input.eventRef,
      envelope,
    );

    this.#pendingBySession.delete(input.sessionId);
    this.#rememberSettled({
      sessionId: input.sessionId,
      needId: input.needId,
      ownerId: pending.selected.ownerId,
      proposalRef: pending.selected.proposalRef,
      eventRef: input.eventRef,
    });

    return {
      ...receipt,
      needId: input.needId,
      proposalRef: pending.selected.proposalRef,
    };
  }

  cancel(sessionId: string): boolean {
    nonEmpty(sessionId, 'campaign session id');
    return this.#pendingBySession.delete(sessionId);
  }

  pending(sessionId: string): {
    needId: string;
    ownerId: string;
    proposalRef: string;
    action: AgentAction;
  } | undefined {
    const pending = this.#pendingBySession.get(sessionId);
    if (!pending) return undefined;
    return {
      needId: pending.needId,
      ownerId: pending.selected.ownerId,
      proposalRef: pending.selected.proposalRef,
      action: structuredClone(pending.action),
    };
  }

  get ownerIds(): string[] {
    return this.#caller.ownerIds;
  }

  #rememberSettled(settled: SettledCampaignDecision): void {
    if (this.#settledByNeed.size >= MAX_SETTLED_NEEDS) {
      const oldest = this.#settledByNeed.keys().next().value as string | undefined;
      if (oldest !== undefined) this.#settledByNeed.delete(oldest);
    }
    this.#settledByNeed.set(settled.needId, settled);
  }
}

export const COMMON_CAMPAIGN_OWNER_LIMITS = Object.freeze({
  maxPendingSessions: MAX_PENDING_SESSIONS,
  maxSettledNeeds: MAX_SETTLED_NEEDS,
});
