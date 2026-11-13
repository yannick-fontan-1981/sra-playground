import {
  isAgentAction,
  type AgentAction,
  type AgentObservation,
} from '../runtime/contracts.ts';
import type {
  CampaignLogosActionPayload,
  CampaignSelectedReturnEnvelope,
} from './v6-common-campaign-owner.ts';
import type {
  CommonCallerAcquisition,
  CommonCallerOwner,
  CommonCallerProposal,
} from './v6-neutral-common-caller.ts';

export const JOINT_CHANNEL_OWNER_ID = 'joint_channels_v1';

export interface JointChannelContributionRequest {
  observation: AgentObservation;
  context: unknown;
}

export interface JointChannelContribution {
  channelId: string;
  contributionRef: string;
  jointRef: string;
  actionRef: string;
  payload: CampaignLogosActionPayload;
}

export interface JointChannelAcquisition {
  eventRef: string;
  needId: string;
  proposalRef: string;
  jointRef: string;
  channelId: string;
  contributionRef: string;
  action: AgentAction;
  returnPayload: unknown;
}

export interface JointChannel {
  readonly id: string;
  contribute(request: JointChannelContributionRequest): JointChannelContribution | undefined;
  acquire(event: JointChannelAcquisition): unknown;
}

export interface JointChannelOwnerContext {
  observation: AgentObservation;
  contextByChannel?: Readonly<Record<string, unknown>>;
}

export interface JointChannelContributionIdentity {
  channelId: string;
  contributionRef: string;
  jointRef: string;
  actionRef: string;
}

export type JointChannelAssessment =
  | { status: 'none'; contributions: JointChannelContributionIdentity[] }
  | {
      status: 'incomplete';
      contributions: JointChannelContributionIdentity[];
      requiredChannels: number;
    }
  | {
      status: 'incompatible';
      contributions: JointChannelContributionIdentity[];
      reasons: string[];
    }
  | {
      status: 'joint';
      jointRef: string;
      actionRef: string;
      proposalRef: string;
      channelIds: string[];
      contributions: JointChannelContributionIdentity[];
    };

export interface JointChannelAcquisitionReceipt {
  acquired: true;
  needId: string;
  eventRef: string;
  proposalRef: string;
  jointRef: string;
  channels: Array<{
    channelId: string;
    contributionRef: string;
    result: unknown;
  }>;
}

interface JointChannelCorrelation {
  version: 1;
  kind: 'joint_channels';
  jointRef: string;
  channels: Array<{
    channelId: string;
    contributionRef: string;
  }>;
}

interface CollectedJointContribution {
  channel: JointChannel;
  contribution: JointChannelContribution;
  identity: JointChannelContributionIdentity;
  releaseFingerprint: string;
}

const MIN_JOINT_CHANNELS = 2;
const MAX_JOINT_CHANNELS = 32;

function nonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stableValue(value: unknown, seen = new Set<object>()): unknown {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('joint channel values must contain finite numbers');
    return Object.is(value, -0) ? { $number: '-0' } : value;
  }
  if (typeof value === 'undefined') return { $undefined: true };
  if (typeof value === 'bigint') return { $bigint: value.toString() };
  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new TypeError('joint channel release contracts must be structured-clone data');
  }
  if (value instanceof Uint8Array) {
    return { $uint8: Array.from(value) };
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError('joint channel release contracts must be acyclic');
    seen.add(value);
    const encoded = value.map(item => stableValue(item, seen));
    seen.delete(value);
    return encoded;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) throw new TypeError('joint channel release contracts must be acyclic');
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('joint channel release contracts must use plain structured data');
    }
    seen.add(value);
    const source = value as Record<string, unknown>;
    const encoded: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      encoded[key] = stableValue(source[key], seen);
    }
    seen.delete(value);
    return encoded;
  }
  throw new TypeError('unsupported joint channel release value');
}

function stableFingerprint(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function releaseFingerprint(payload: CampaignLogosActionPayload): string {
  return stableFingerprint({
    action: payload.action,
    bundle: payload.bundle,
    state: payload.state,
    identity: payload.identity,
  });
}

function contributionIdentity(
  contribution: JointChannelContribution,
): JointChannelContributionIdentity {
  return {
    channelId: contribution.channelId,
    contributionRef: contribution.contributionRef,
    jointRef: contribution.jointRef,
    actionRef: contribution.actionRef,
  };
}

function bindingReasons(
  observation: AgentObservation,
  contribution: JointChannelContribution,
): string[] {
  const reasons: string[] = [];
  const { payload } = contribution;
  if (!isAgentAction(payload.action)) {
    reasons.push(`${contribution.channelId}:invalid_action`);
    return reasons;
  }
  if (contribution.actionRef !== `ACTION${payload.action.id}`) {
    reasons.push(`${contribution.channelId}:action_ref_mismatch`);
  }
  if (payload.identity.episodeId !== observation.sessionId) {
    reasons.push(`${contribution.channelId}:session_mismatch`);
  }
  if (payload.identity.observationRevision !== observation.sequence) {
    reasons.push(`${contribution.channelId}:revision_mismatch`);
  }
  if (payload.bundle.observation_revision !== observation.sequence) {
    reasons.push(`${contribution.channelId}:bundle_revision_mismatch`);
  }
  if (!observation.availableActionIds.includes(payload.action.id)) {
    reasons.push(`${contribution.channelId}:unavailable_action`);
  }
  return reasons;
}

function contextValue(value: unknown): JointChannelOwnerContext | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Partial<JointChannelOwnerContext>;
  if (!candidate.observation || typeof candidate.observation !== 'object') return undefined;
  if (
    candidate.contextByChannel !== undefined
    && (!candidate.contextByChannel
      || typeof candidate.contextByChannel !== 'object'
      || Array.isArray(candidate.contextByChannel))
  ) {
    throw new TypeError('joint channel contextByChannel must be an object');
  }
  return candidate as JointChannelOwnerContext;
}

function selectedEnvelope(value: unknown): CampaignSelectedReturnEnvelope {
  const envelope = record(value, 'joint channel campaign return envelope') as unknown as CampaignSelectedReturnEnvelope;
  if (envelope.version !== 1 || typeof envelope.needId !== 'string' || !envelope.needId) {
    throw new TypeError('invalid joint channel campaign return envelope');
  }
  if (envelope.proposal.ownerId !== JOINT_CHANNEL_OWNER_ID) {
    throw new Error('joint channel return was routed to the wrong owner');
  }
  return envelope;
}

function correlationValue(value: unknown): JointChannelCorrelation {
  const correlation = record(value, 'joint channel correlation');
  if (correlation.version !== 1 || correlation.kind !== 'joint_channels') {
    throw new TypeError('invalid joint channel correlation');
  }
  nonEmpty(correlation.jointRef, 'joint channel correlation jointRef');
  if (!Array.isArray(correlation.channels) || correlation.channels.length < MIN_JOINT_CHANNELS) {
    throw new TypeError('joint channel correlation requires at least two channels');
  }
  const channels: JointChannelCorrelation['channels'] = [];
  const ids = new Set<string>();
  for (const item of correlation.channels) {
    const entry = record(item, 'joint channel correlation entry');
    nonEmpty(entry.channelId, 'joint channel correlation channelId');
    nonEmpty(entry.contributionRef, 'joint channel correlation contributionRef');
    if (ids.has(entry.channelId)) throw new Error(`duplicate joint channel ${entry.channelId}`);
    ids.add(entry.channelId);
    channels.push({
      channelId: entry.channelId,
      contributionRef: entry.contributionRef,
    });
  }
  return {
    version: 1,
    kind: 'joint_channels',
    jointRef: correlation.jointRef,
    channels,
  };
}

/**
 * Bounded first joint-channel experiment.
 *
 * The owner does not rank channels and never chooses between incompatible
 * payloads. At least two explicit channels must transfer contributions bound to
 * the same public observation and the exact same native release contract. Only
 * then are they represented as one common-caller proposal. A selected physical
 * return is routed once to every contributing channel.
 */
export class JointChannelOwner implements CommonCallerOwner {
  readonly id = JOINT_CHANNEL_OWNER_ID;
  readonly #channels = new Map<string, JointChannel>();
  #lastAssessment: JointChannelAssessment = { status: 'none', contributions: [] };

  constructor(channels: readonly JointChannel[]) {
    if (!Array.isArray(channels)) throw new TypeError('joint channels must be an array');
    if (channels.length > MAX_JOINT_CHANNELS) {
      throw new RangeError(`joint channel count exceeds ${MAX_JOINT_CHANNELS}`);
    }
    for (const channel of channels) {
      nonEmpty(channel.id, 'joint channel id');
      if (this.#channels.has(channel.id)) {
        throw new Error(`duplicate joint channel ${channel.id}`);
      }
      this.#channels.set(channel.id, channel);
    }
  }

  propose(context: unknown): CommonCallerProposal | undefined {
    const input = contextValue(context);
    if (!input) {
      this.#lastAssessment = { status: 'none', contributions: [] };
      return undefined;
    }

    const collected: CollectedJointContribution[] = [];
    const bindingFailures: string[] = [];
    const contextByChannel = input.contextByChannel ?? {};

    for (const [channelId, channel] of this.#channels) {
      const contribution = channel.contribute({
        observation: input.observation,
        context: contextByChannel[channelId],
      });
      if (!contribution) continue;
      if (contribution.channelId !== channelId) {
        throw new Error(`joint channel ${channelId} returned contribution for ${contribution.channelId}`);
      }
      nonEmpty(contribution.contributionRef, 'joint contributionRef');
      nonEmpty(contribution.jointRef, 'joint jointRef');
      nonEmpty(contribution.actionRef, 'joint actionRef');
      const reasons = bindingReasons(input.observation, contribution);
      bindingFailures.push(...reasons);
      collected.push({
        channel,
        contribution,
        identity: contributionIdentity(contribution),
        releaseFingerprint: releaseFingerprint(contribution.payload),
      });
    }

    const ordered = collected.sort((left, right) => left.channel.id.localeCompare(right.channel.id));
    const identities = ordered.map(item => item.identity);
    if (ordered.length === 0) {
      this.#lastAssessment = { status: 'none', contributions: [] };
      return undefined;
    }
    if (ordered.length < MIN_JOINT_CHANNELS) {
      this.#lastAssessment = {
        status: 'incomplete',
        contributions: identities,
        requiredChannels: MIN_JOINT_CHANNELS,
      };
      return undefined;
    }

    const first = ordered[0]!;
    const reasons = [...bindingFailures];
    if (ordered.some(item => item.contribution.jointRef !== first.contribution.jointRef)) {
      reasons.push('joint_ref_mismatch');
    }
    if (ordered.some(item => item.contribution.actionRef !== first.contribution.actionRef)) {
      reasons.push('action_ref_mismatch');
    }
    if (ordered.some(item => item.releaseFingerprint !== first.releaseFingerprint)) {
      reasons.push('release_contract_mismatch');
    }

    const uniqueReasons = [...new Set(reasons)].sort();
    if (uniqueReasons.length > 0) {
      this.#lastAssessment = {
        status: 'incompatible',
        contributions: identities,
        reasons: uniqueReasons,
      };
      return undefined;
    }

    const channelIds = ordered.map(item => item.channel.id);
    const jointRef = first.contribution.jointRef;
    const proposalRef = [
      'joint',
      jointRef,
      input.observation.sessionId,
      input.observation.sequence,
      channelIds.join('+'),
    ].join(':');
    const correlation: JointChannelCorrelation = {
      version: 1,
      kind: 'joint_channels',
      jointRef,
      channels: ordered.map(item => ({
        channelId: item.channel.id,
        contributionRef: item.contribution.contributionRef,
      })),
    };
    const payload: CampaignLogosActionPayload = {
      ...structuredClone(first.contribution.payload),
      correlation,
    };

    this.#lastAssessment = {
      status: 'joint',
      jointRef,
      actionRef: first.contribution.actionRef,
      proposalRef,
      channelIds,
      contributions: identities,
    };
    return {
      ownerId: this.id,
      proposalRef,
      actionRef: first.contribution.actionRef,
      payload,
    };
  }

  acquire(event: CommonCallerAcquisition): JointChannelAcquisitionReceipt {
    if (event.source !== 'selected') {
      throw new Error('joint channel owner accepts only selected returns');
    }
    const envelope = selectedEnvelope(event.payload);
    const correlation = correlationValue(envelope.correlation);
    const routed = correlation.channels.map(entry => {
      const channel = this.#channels.get(entry.channelId);
      if (!channel) throw new Error(`unknown selected joint channel ${entry.channelId}`);
      const result = channel.acquire({
        eventRef: event.eventRef,
        needId: envelope.needId,
        proposalRef: envelope.proposal.proposalRef,
        jointRef: correlation.jointRef,
        channelId: entry.channelId,
        contributionRef: entry.contributionRef,
        action: structuredClone(envelope.action),
        returnPayload: structuredClone(envelope.returnPayload),
      });
      return {
        channelId: entry.channelId,
        contributionRef: entry.contributionRef,
        result,
      };
    });
    return {
      acquired: true,
      needId: envelope.needId,
      eventRef: event.eventRef,
      proposalRef: envelope.proposal.proposalRef,
      jointRef: correlation.jointRef,
      channels: routed,
    };
  }

  get channelIds(): string[] {
    return [...this.#channels.keys()];
  }

  get lastAssessment(): JointChannelAssessment {
    return structuredClone(this.#lastAssessment);
  }
}

export const JOINT_CHANNEL_LIMITS = Object.freeze({
  minChannels: MIN_JOINT_CHANNELS,
  maxChannels: MAX_JOINT_CHANNELS,
});
