import type { AgentAction, AgentObservation } from '../runtime/contracts.ts';
import type { PublicFrameLike, PublicObservationLike } from './linked-preparation.ts';
import type {
  CollectedProposal,
  CommonCallerOwner,
} from './v6-neutral-common-caller.ts';

export interface CommonCampaignObservation {
  agent: AgentObservation;
  observation: PublicObservationLike;
  publicFrame: PublicFrameLike;
  rows: readonly (readonly number[])[];
}

export type CommonCampaignProposalKind = 'public_single_action' | 'field_stock';

/** Proposal that has passed its owner-specific Logos release contract. */
export interface CommonCampaignProposalPayload {
  version: 1;
  kind: CommonCampaignProposalKind;
  action: AgentAction;
  needId: string;
  bundleId: string;
  ownerData: unknown;
}

export interface CommonCampaignFeedbackPayload {
  version: 1;
  kind: 'action_return' | 'observation_advance';
  needId?: string;
  action?: AgentAction;
  selected?: CollectedProposal;
  before: CommonCampaignObservation;
  after: CommonCampaignObservation;
}

/**
 * Campaign owners remain neutral-caller owners, but authorization is delayed
 * until the caller has proved that exactly one proposal exists.
 */
export interface CommonCampaignOwner extends CommonCallerOwner {
  authorize(
    proposal: CollectedProposal,
    context: CommonCampaignObservation,
  ): CommonCampaignProposalPayload | undefined;
  reset?(): void;
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

export function isCommonCampaignObservation(value: unknown): value is CommonCampaignObservation {
  if (!object(value) || !object(value.agent) || !object(value.observation) || !object(value.publicFrame)) {
    return false;
  }
  return Array.isArray(value.rows)
    && typeof value.observation.observation_ref === 'string'
    && typeof value.agent.sessionId === 'string';
}

export function commonCampaignProposalPayload(value: unknown): CommonCampaignProposalPayload | null {
  if (!object(value) || value.version !== 1) return null;
  if (value.kind !== 'public_single_action' && value.kind !== 'field_stock') return null;
  if (!object(value.action) || typeof value.needId !== 'string' || typeof value.bundleId !== 'string') return null;
  return value as unknown as CommonCampaignProposalPayload;
}

export function commonCampaignFeedbackPayload(value: unknown): CommonCampaignFeedbackPayload | null {
  if (!object(value) || value.version !== 1) return null;
  if (value.kind !== 'action_return' && value.kind !== 'observation_advance') return null;
  if (!isCommonCampaignObservation(value.before) || !isCommonCampaignObservation(value.after)) return null;
  return value as unknown as CommonCampaignFeedbackPayload;
}
