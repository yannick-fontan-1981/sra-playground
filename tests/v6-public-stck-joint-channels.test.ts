import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROTOCOL_VERSION,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import {
  JOINT_CHANNEL_OWNER_ID,
  JointChannelOwner,
} from '../src/logos-engine/v6-joint-channel-owner.ts';
import {
  PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID,
  PublicStckActionAvailabilityJointChannel,
  PublicStckVisibleTargetJointChannel,
  createPublicStckAddressedJointChannels,
  producePublicStckTargetCandidate,
  publicStckAddressedJointContext,
} from '../src/logos-engine/v6-public-stck-joint-channels.ts';
import { V6CommonCampaignDecisionPort } from '../src/runtime/v6-common-campaign-decision-port.ts';

function pixels(fill = 5): Uint8Array {
  return new Uint8Array(64 * 64).fill(fill);
}

function setPixel(frame: Uint8Array, x: number, y: number, value: number): void {
  frame[y * 64 + x] = value;
}

function stckFrame(options: {
  shop?: boolean;
  card?: boolean;
  cardColor?: number;
} = {}): Uint8Array {
  const {
    shop = true,
    card = true,
    cardColor = 9,
  } = options;
  const frame = pixels();
  if (shop) {
    for (let x = 4; x <= 10; x += 1) {
      setPixel(frame, x, 55, 3);
      setPixel(frame, x, 56, 3);
    }
  }
  if (card) {
    for (let x = 2; x < 8; x += 1) setPixel(frame, x, 52, cardColor);
  }
  return frame;
}

function observation(
  sequence = 0,
  frame = stckFrame(),
  availableActionIds: AgentObservation['availableActionIds'] = [6],
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'lot9c3-stck-public-session',
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: Uint8Array.from(frame),
    },
    availableActionIds: [...availableActionIds],
    state: 'NOT_FINISHED',
    level: 1,
    levelsCompleted: 0,
  };
}

const signal = new AbortController().signal;

test('public STCK producer selects the lowest visible card while the shop is active', () => {
  const candidate = producePublicStckTargetCandidate(observation());
  assert.ok(candidate);
  assert.equal(candidate.targetKind, 'stack_card');
  assert.deepEqual(candidate.action, { id: 6, data: { x: 4, y: 52 } });
  assert.match(candidate.targetRef, /^public-stck-target:public-observation:/);
  assert.match(candidate.shopRef, /^public-stck-shop:public-observation:/);
  assert.deepEqual(Object.keys(publicStckAddressedJointContext(observation())).sort(), [
    PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID,
  ]);
});

test('public STCK producer falls back to the first visible shop segment only when no card remains', () => {
  const candidate = producePublicStckTargetCandidate(observation(0, stckFrame({ card: false })));
  assert.ok(candidate);
  assert.equal(candidate.targetKind, 'shop_button');
  assert.deepEqual(candidate.action, { id: 6, data: { x: 7, y: 56 } });

  assert.equal(
    producePublicStckTargetCandidate(observation(0, stckFrame({ shop: false, card: true }))),
    undefined,
  );
});

test('STCK availability and visible-target channels contribute distinct evidence to one release contract', () => {
  const current = observation();
  const context = publicStckAddressedJointContext(current);
  const availability = new PublicStckActionAvailabilityJointChannel();
  const target = new PublicStckVisibleTargetJointChannel();
  const availabilityContribution = availability.contribute({
    observation: current,
    context: context[PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID],
  });
  const targetContribution = target.contribute({
    observation: current,
    context: context[PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID],
  });

  assert.ok(availabilityContribution);
  assert.ok(targetContribution);
  assert.notEqual(
    availabilityContribution.contributionRef,
    targetContribution.contributionRef,
  );
  assert.equal(availabilityContribution.jointRef, targetContribution.jointRef);
  assert.equal(availabilityContribution.actionRef, targetContribution.actionRef);
  assert.deepEqual(availabilityContribution.payload, targetContribution.payload);
});

test('decision port releases STCK ACTION6 only when both public producer contexts are present', () => {
  const makePort = (enabled: 'both' | 'availability' | 'target') => new V6CommonCampaignDecisionPort({
    jointChannels: createPublicStckAddressedJointChannels(),
    jointContextByChannel(current) {
      const context = publicStckAddressedJointContext(current.agent);
      if (enabled === 'both') return context;
      if (enabled === 'availability') {
        return {
          [PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID]: context[PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID],
        };
      }
      return {
        [PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID]: context[PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID],
      };
    },
  });

  const both = makePort('both');
  both.initialize('lot9c3-stck-public-session', 0);
  assert.deepEqual(both.decide(observation(), 50, signal), {
    id: 6,
    data: { x: 4, y: 52 },
  });
  assert.equal(both.lastPrepare?.status, 'action');
  if (both.lastPrepare?.status === 'action') {
    assert.equal(both.lastPrepare.ownerId, JOINT_CHANNEL_OWNER_ID);
  }

  const availabilityOnly = makePort('availability');
  availabilityOnly.initialize('lot9c3-stck-public-session', 0);
  assert.equal(availabilityOnly.decide(observation(), 50, signal), undefined);
  assert.equal(availabilityOnly.jointOwner?.lastAssessment.status, 'incomplete');

  const targetOnly = makePort('target');
  targetOnly.initialize('lot9c3-stck-public-session', 0);
  assert.equal(targetOnly.decide(observation(), 50, signal), undefined);
  assert.equal(targetOnly.jointOwner?.lastAssessment.status, 'incomplete');
});

test('visible STCK target contribution disappears when current pixels choose another target', () => {
  const before = observation();
  const context = publicStckAddressedJointContext(before);
  const changed = observation(0, stckFrame({ card: false }));
  const owner = new JointChannelOwner(createPublicStckAddressedJointChannels());

  assert.equal(owner.propose({
    observation: changed,
    contextByChannel: context,
  }), undefined);
  assert.equal(owner.lastAssessment.status, 'incomplete');
  if (owner.lastAssessment.status === 'incomplete') {
    assert.deepEqual(owner.lastAssessment.contributions.map(item => item.channelId), [
      PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID,
    ]);
  }
});

test('STCK joint channels produce nothing when ACTION6 is unavailable', () => {
  const withAction = observation();
  const context = publicStckAddressedJointContext(withAction);
  const withoutAction = observation(0, stckFrame(), [1, 2, 3, 4]);
  const owner = new JointChannelOwner(createPublicStckAddressedJointChannels());

  assert.equal(owner.propose({
    observation: withoutAction,
    contextByChannel: context,
  }), undefined);
  assert.deepEqual(owner.lastAssessment, {
    status: 'none',
    contributions: [],
  });
});

test('selected STCK return is routed once to both concrete public channels', () => {
  const port = new V6CommonCampaignDecisionPort({
    jointChannels: createPublicStckAddressedJointChannels(),
    jointContextByChannel(current) {
      return publicStckAddressedJointContext(current.agent);
    },
  });
  port.initialize('lot9c3-stck-public-session', 0);

  assert.deepEqual(port.decide(observation(), 50, signal), {
    id: 6,
    data: { x: 4, y: 52 },
  });
  port.observe(observation(1, stckFrame({ card: false })));
  assert.equal(port.lastAcquisition?.routed, true);
  const result = port.lastAcquisition?.result as {
    channels: Array<{ channelId: string; result: { acquired: boolean } }>;
  };
  assert.deepEqual(result.channels.map(item => item.channelId), [
    PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID,
  ]);
  assert.ok(result.channels.every(item => item.result.acquired));
});
