import {
  CommonCampaignOwner,
  type CommonCampaignSnapshotV1,
} from './v6-common-campaign-owner.ts';

export interface CommonCampaignCheckpointParticipant {
  readonly checkpointId: string;
  snapshot(): unknown;
  restore(snapshot: unknown): void;
}

export interface CommonCampaignCheckpointV1 {
  version: 1;
  campaign: CommonCampaignSnapshotV1;
  participants: Array<{
    checkpointId: string;
    state: unknown;
  }>;
}

function nonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

/**
 * Atomically capture and restore a common campaign together with the explicit
 * state owners that feed it. The coordinator owns no policy and never creates a
 * proposal: it only preserves already-established state and identities.
 */
export class CommonCampaignCheckpointCoordinator {
  readonly #campaign: CommonCampaignOwner;
  readonly #participants: CommonCampaignCheckpointParticipant[];

  constructor(
    campaign: CommonCampaignOwner,
    participants: readonly CommonCampaignCheckpointParticipant[] = [],
  ) {
    this.#campaign = campaign;
    const ids = new Set<string>();
    this.#participants = participants.map(participant => {
      nonEmpty(participant.checkpointId, 'campaign checkpoint participant id');
      if (ids.has(participant.checkpointId)) {
        throw new Error(`duplicate campaign checkpoint participant ${participant.checkpointId}`);
      }
      ids.add(participant.checkpointId);
      return participant;
    });
  }

  snapshot(): CommonCampaignCheckpointV1 {
    return {
      version: 1,
      campaign: this.#campaign.snapshot(),
      participants: this.#participants.map(participant => ({
        checkpointId: participant.checkpointId,
        state: structuredClone(participant.snapshot()),
      })),
    };
  }

  restore(value: unknown): void {
    const snapshot = object(value, 'common campaign checkpoint');
    if (snapshot.version !== 1) {
      throw new TypeError('unsupported common campaign checkpoint version');
    }
    if (!Array.isArray(snapshot.participants)) {
      throw new TypeError('common campaign checkpoint participants must be an array');
    }
    if (snapshot.participants.length !== this.#participants.length) {
      throw new Error('campaign checkpoint participant count mismatch');
    }

    const participantStates = snapshot.participants.map((raw, index) => {
      const entry = object(raw, `campaign checkpoint participant[${index}]`);
      nonEmpty(entry.checkpointId, `campaign checkpoint participant[${index}].checkpointId`);
      if (entry.checkpointId !== this.#participants[index]?.checkpointId) {
        throw new Error('campaign checkpoint participant set/order mismatch');
      }
      if (!Object.hasOwn(entry, 'state')) {
        throw new TypeError(`campaign checkpoint participant[${index}] has no state`);
      }
      return structuredClone(entry.state);
    });

    const before = this.snapshot();
    try {
      this.#campaign.restore(snapshot.campaign);
      this.#participants.forEach((participant, index) => {
        participant.restore(participantStates[index]);
      });
    } catch (error) {
      this.#campaign.restore(before.campaign);
      this.#participants.forEach((participant, index) => {
        participant.restore(before.participants[index]!.state);
      });
      throw error;
    }
  }
}
