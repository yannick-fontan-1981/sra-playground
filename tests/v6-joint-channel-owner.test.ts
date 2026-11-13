import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROTOCOL_VERSION,
  type AgentAction,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import {
  CommonCampaignOwner,
} from '../src/logos-engine/v6-common-campaign-owner.ts';
import {
  prepareJointChannelActionPayload,
} from '../src/logos-engine/v6-joint-channel-action.ts';
import {
  JOINT_CHANNEL_OWNER_ID,
  JointChannelOwner,
  type JointChannel,
  type JointChannelAcquisition,
  type JointChannelContribution,
  type JointChannelContributionRequest,
} from '../src/logos-engine/v6-joint-channel-owner.ts';
import type {
  CommonCallerAcquisition,
  CommonCallerOwner,
  CommonCallerProposal,
} from '../src/logos-engine/v6-neutral-common-caller.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';
import { V6CommonCampaignDecisionPort } from '../src/runtime/v6-common-campaign-decision-port.ts';

function observation(
  sequence = 0,
  availableActionIds: AgentObservation['availableActionIds'] = [1, 2],
  sessionId = 'joint-channel-session',
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: new Uint8Array(64 * 64),
    },
    availableActionIds: [...availableActionIds],
    state: 'NOT_FINISHED',
    level: 2,
    levelsCompleted: 1,
  };
}

class SignalChannel implements JointChannel {
  readonly acquisitions: JointChannelAcquisition[] = [];

  constructor(
    readonly id: string,
    readonly action: AgentAction = { id: 1 },
    readonly jointRef = 'joint:advance',
    readonly mutate?: (
      contribution: JointChannelContribution,
      request: JointChannelContributionRequest,
    ) => void,
  ) {}

  contribute(request: JointChannelContributionRequest): JointChannelContribution | undefined {
    if (request.context !== 'enabled') return undefined;
    const payload = prepareJointChannelActionPayload(
      request.observation,
      this.action,
      this.jointRef,
    );
    assert.ok(payload);
    const contribution: JointChannelContribution = {
      channelId: this.id,
      contributionRef: `${this.id}:contribution:${request.observation.sequence}`,
      jointRef: this.jointRef,
      actionRef: `ACTION${this.action.id}`,
      payload,
    };
    this.mutate?.(contribution, request);
    return contribution;
  }

  acquire(event: JointChannelAcquisition): unknown {
    this.acquisitions.push(structuredClone(event));
    return {
      channelId: this.id,
      contributionRef: event.contributionRef,
      needId: event.needId,
    };
  }
}

class RivalOwner implements CommonCallerOwner {
  readonly id = 'independent-rival';

  propose(_context: unknown): CommonCallerProposal {
    return {
      ownerId: this.id,
      proposalRef: 'independent-rival:proposal',
      actionRef: 'ACTION2',
      payload: {},
    };
  }

  acquire(_event: CommonCallerAcquisition): unknown {
    return null;
  }
}

function jointContext(current: AgentObservation, first = true, second = true) {
  return {
    [JOINT_CHANNEL_OWNER_ID]: {
      observation: current,
      contextByChannel: {
        availability: first ? 'enabled' : undefined,
        objective: second ? 'enabled' : undefined,
      },
    },
  };
}

const signal = new AbortController().signal;

test('joint owner requires at least two explicit contributions before proposing', () => {
  const availability = new SignalChannel('availability');
  const objective = new SignalChannel('objective');
  const owner = new JointChannelOwner([availability, objective]);
  const current = observation();

  assert.equal(owner.propose(jointContext(current, true, false)[JOINT_CHANNEL_OWNER_ID]), undefined);
  assert.deepEqual(owner.lastAssessment, {
    status: 'incomplete',
    requiredChannels: 2,
    contributions: [{
      channelId: 'availability',
      contributionRef: 'availability:contribution:0',
      jointRef: 'joint:advance',
      actionRef: 'ACTION1',
    }],
  });

  const proposal = owner.propose(jointContext(current)[JOINT_CHANNEL_OWNER_ID]);
  assert.ok(proposal);
  assert.equal(proposal.ownerId, JOINT_CHANNEL_OWNER_ID);
  assert.equal(proposal.actionRef, 'ACTION1');
  const jointAssessment = owner.lastAssessment;
  assert.equal(jointAssessment.status, 'joint');
  if (jointAssessment.status === 'joint') {
    assert.deepEqual(jointAssessment.channelIds, ['availability', 'objective']);
  }
});

test('compatible channels release one action and acquire one selected return each', () => {
  const availability = new SignalChannel('availability');
  const objective = new SignalChannel('objective');
  const joint = new JointChannelOwner([availability, objective]);
  const trace = new OperationTraceSink();
  const campaign = new CommonCampaignOwner([joint], { trace });
  const current = observation();

  const prepared = campaign.prepare(current, jointContext(current));
  assert.equal(prepared.status, 'action');
  if (prepared.status !== 'action') return;
  assert.equal(prepared.ownerId, JOINT_CHANNEL_OWNER_ID);
  assert.deepEqual(prepared.action, { id: 1 });
  assert.deepEqual(trace.snapshot().events.map(event => event.kind), [
    'need', 'operation', 'consumption',
  ]);

  const returned = campaign.acquire({
    sessionId: current.sessionId,
    needId: prepared.needId,
    eventRef: 'joint-public-return:1',
    payload: { sequence: 1 },
  });
  assert.equal(returned.routed, true);
  assert.equal(availability.acquisitions.length, 1);
  assert.equal(objective.acquisitions.length, 1);
  assert.equal(availability.acquisitions[0]?.needId, prepared.needId);
  assert.equal(objective.acquisitions[0]?.needId, prepared.needId);

  const receipt = returned.result as {
    channels: Array<{ channelId: string; contributionRef: string }>;
  };
  assert.deepEqual(receipt.channels.map(item => item.channelId), ['availability', 'objective']);

  const duplicate = campaign.acquire({
    sessionId: current.sessionId,
    needId: prepared.needId,
    eventRef: 'joint-public-return:1',
    payload: { sequence: 1 },
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(availability.acquisitions.length, 1);
  assert.equal(objective.acquisitions.length, 1);
});

test('different actions remain explicitly incompatible and produce no proposal', () => {
  const availability = new SignalChannel('availability', { id: 1 });
  const objective = new SignalChannel('objective', { id: 2 });
  const owner = new JointChannelOwner([availability, objective]);
  const current = observation();

  assert.equal(owner.propose(jointContext(current)[JOINT_CHANNEL_OWNER_ID]), undefined);
  const assessment = owner.lastAssessment;
  assert.equal(assessment.status, 'incompatible');
  if (assessment.status === 'incompatible') {
    assert.ok(assessment.reasons.includes('action_ref_mismatch'));
    assert.ok(assessment.reasons.includes('release_contract_mismatch'));
  }
});

test('a stale channel contribution cannot join the current public revision', () => {
  const availability = new SignalChannel('availability');
  const objective = new SignalChannel('objective', { id: 1 }, 'joint:advance', contribution => {
    contribution.payload.identity.observationRevision += 1;
  });
  const owner = new JointChannelOwner([availability, objective]);
  const current = observation(4);

  assert.equal(owner.propose(jointContext(current)[JOINT_CHANNEL_OWNER_ID]), undefined);
  const assessment = owner.lastAssessment;
  assert.equal(assessment.status, 'incompatible');
  if (assessment.status === 'incompatible') {
    assert.ok(assessment.reasons.includes('objective:revision_mismatch'));
    assert.ok(assessment.reasons.includes('release_contract_mismatch'));
  }
});

test('a joint proposal remains ambiguous beside an independent owner proposal', () => {
  const current = observation();
  const joint = new JointChannelOwner([
    new SignalChannel('availability'),
    new SignalChannel('objective'),
  ]);
  const trace = new OperationTraceSink();
  const campaign = new CommonCampaignOwner([joint, new RivalOwner()], { trace });

  const result = campaign.prepare(current, jointContext(current));
  assert.equal(result.status, 'ambiguous');
  if (result.status === 'ambiguous') {
    assert.deepEqual(result.proposals.map(proposal => proposal.ownerId), [
      JOINT_CHANNEL_OWNER_ID,
      'independent-rival',
    ]);
  }
  assert.deepEqual(trace.snapshot().events, []);
});

test('decision port exposes a causal joint action only when both channel contexts are present', () => {
  const availability = new SignalChannel('availability');
  const objective = new SignalChannel('objective');
  const port = new V6CommonCampaignDecisionPort({
    jointChannels: [availability, objective],
    jointContextByChannel() {
      return { availability: 'enabled', objective: 'enabled' };
    },
  });
  port.initialize('joint-channel-session', 31);

  const first = observation(0);
  assert.deepEqual(port.decide(first, 50, signal), { id: 1 });
  assert.equal(port.lastPrepare?.status, 'action');
  if (port.lastPrepare?.status === 'action') {
    assert.equal(port.lastPrepare.ownerId, JOINT_CHANNEL_OWNER_ID);
  }

  const second = observation(1);
  assert.deepEqual(port.decide(second, 50, signal), { id: 1 });
  assert.equal(availability.acquisitions.length, 1);
  assert.equal(objective.acquisitions.length, 1);
  assert.equal(port.lastAcquisition?.routed, true);

  const incompletePort = new V6CommonCampaignDecisionPort({
    jointChannels: [
      new SignalChannel('availability'),
      new SignalChannel('objective'),
    ],
    jointContextByChannel() {
      return { availability: 'enabled' };
    },
  });
  incompletePort.initialize('joint-channel-session', 37);
  assert.equal(incompletePort.decide(first, 50, signal), undefined);
  assert.deepEqual(incompletePort.lastPrepare, { status: 'none', proposals: [] });
  assert.equal(incompletePort.jointOwner?.lastAssessment.status, 'incomplete');
});

test('decision port preserves common-caller ambiguity outside the compatible joint', () => {
  const port = new V6CommonCampaignDecisionPort({
    jointChannels: [
      new SignalChannel('availability'),
      new SignalChannel('objective'),
    ],
    jointContextByChannel() {
      return { availability: 'enabled', objective: 'enabled' };
    },
    additionalOwners: [new RivalOwner()],
  });
  port.initialize('joint-channel-session', 41);
  assert.equal(port.decide(observation(), 50, signal), undefined);
  assert.equal(port.lastPrepare?.status, 'ambiguous');
  assert.equal(port.pendingDecision, undefined);
});

test('joint owner rejects duplicate channel identities', () => {
  assert.throws(
    () => new JointChannelOwner([
      new SignalChannel('duplicate'),
      new SignalChannel('duplicate'),
    ]),
    /duplicate joint channel/,
  );
});
