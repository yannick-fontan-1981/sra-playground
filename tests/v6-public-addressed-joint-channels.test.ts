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
  PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  PublicActionAvailabilityJointChannel,
  PublicVisibleTargetJointChannel,
  createPublicSmlpAddressedJointChannels,
  producePublicSmlpGateCandidate,
  publicSmlpAddressedJointContext,
} from '../src/logos-engine/v6-public-addressed-joint-channels.ts';
import { V6CommonCampaignDecisionPort } from '../src/runtime/v6-common-campaign-decision-port.ts';

function pixels(fill = 2): Uint8Array {
  return new Uint8Array(64 * 64).fill(fill);
}

function setPixel(frame: Uint8Array, x: number, y: number, value: number): void {
  frame[y * 64 + x] = value;
}

function closedVerticalGate(
  x = 32,
  y = 26,
  gateColor = 12,
): Uint8Array {
  const frame = pixels(2);
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      setPixel(frame, x + dx, y + dy, gateColor);
    }
  }
  setPixel(frame, x, y - 1, 5);
  setPixel(frame, x, y, 5);
  setPixel(frame, x, y + 1, 5);
  return frame;
}

function openHorizontalGate(
  x = 32,
  y = 26,
  gateColor = 12,
): Uint8Array {
  const frame = pixels(2);
  setPixel(frame, x, y - 1, gateColor);
  setPixel(frame, x, y, 3);
  setPixel(frame, x, y + 1, gateColor);
  return frame;
}

function observation(
  sequence = 0,
  frame = closedVerticalGate(),
  availableActionIds: AgentObservation['availableActionIds'] = [5, 6, 7],
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'lot9c2-smlp-public-session',
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

test('public SMLP gate producer derives one addressed action from visible pixels only', () => {
  const candidate = producePublicSmlpGateCandidate(observation());
  assert.ok(candidate);
  assert.deepEqual(candidate.action, { id: 6, data: { x: 32, y: 26 } });
  assert.equal(candidate.orientation, 'closed_vertical');
  assert.match(candidate.targetRef, /^public-smlp-gate:public-observation:/);
  assert.match(candidate.jointRef, /ACTION6$/);
  assert.deepEqual(Object.keys(publicSmlpAddressedJointContext(observation())).sort(), [
    PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  ]);
});

test('availability and visible-target producers contribute distinct evidence to one exact release contract', () => {
  const current = observation();
  const context = publicSmlpAddressedJointContext(current);
  const availability = new PublicActionAvailabilityJointChannel();
  const target = new PublicVisibleTargetJointChannel();
  const availabilityContribution = availability.contribute({
    observation: current,
    context: context[PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID],
  });
  const targetContribution = target.contribute({
    observation: current,
    context: context[PUBLIC_VISIBLE_TARGET_CHANNEL_ID],
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

test('decision port releases ACTION6 only when both real producer contexts are present', () => {
  const makePort = (enabled: 'both' | 'availability' | 'target') => new V6CommonCampaignDecisionPort({
    jointChannels: createPublicSmlpAddressedJointChannels(),
    jointContextByChannel(current) {
      const context = publicSmlpAddressedJointContext(current.agent);
      if (enabled === 'both') return context;
      if (enabled === 'availability') {
        return {
          [PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID]: context[PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID],
        };
      }
      return {
        [PUBLIC_VISIBLE_TARGET_CHANNEL_ID]: context[PUBLIC_VISIBLE_TARGET_CHANNEL_ID],
      };
    },
  });

  const both = makePort('both');
  both.initialize('lot9c2-smlp-public-session', 0);
  assert.deepEqual(both.decide(observation(), 50, signal), {
    id: 6,
    data: { x: 32, y: 26 },
  });
  assert.equal(both.lastPrepare?.status, 'action');
  if (both.lastPrepare?.status === 'action') {
    assert.equal(both.lastPrepare.ownerId, JOINT_CHANNEL_OWNER_ID);
  }

  const availabilityOnly = makePort('availability');
  availabilityOnly.initialize('lot9c2-smlp-public-session', 0);
  assert.equal(availabilityOnly.decide(observation(), 50, signal), undefined);
  assert.equal(availabilityOnly.jointOwner?.lastAssessment.status, 'incomplete');

  const targetOnly = makePort('target');
  targetOnly.initialize('lot9c2-smlp-public-session', 0);
  assert.equal(targetOnly.decide(observation(), 50, signal), undefined);
  assert.equal(targetOnly.jointOwner?.lastAssessment.status, 'incomplete');
});

test('visible-target contribution disappears when its public pixels no longer match', () => {
  const before = observation();
  const context = publicSmlpAddressedJointContext(before);
  const changedFrame = closedVerticalGate();
  setPixel(changedFrame, 32, 25, 2);
  const changed = observation(0, changedFrame);
  const owner = new JointChannelOwner(createPublicSmlpAddressedJointChannels());

  assert.equal(owner.propose({
    observation: changed,
    contextByChannel: context,
  }), undefined);
  assert.equal(owner.lastAssessment.status, 'incomplete');
  if (owner.lastAssessment.status === 'incomplete') {
    assert.deepEqual(owner.lastAssessment.contributions.map(item => item.channelId), [
      PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    ]);
  }
});

test('availability contribution disappears when ACTION6 is not currently public', () => {
  const withAction = observation();
  const context = publicSmlpAddressedJointContext(withAction);
  const withoutAction = observation(0, closedVerticalGate(), [5, 7]);
  const owner = new JointChannelOwner(createPublicSmlpAddressedJointChannels());

  assert.equal(owner.propose({
    observation: withoutAction,
    contextByChannel: context,
  }), undefined);
  assert.equal(owner.lastAssessment.status, 'incomplete');
  if (owner.lastAssessment.status === 'incomplete') {
    assert.deepEqual(owner.lastAssessment.contributions.map(item => item.channelId), [
      PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
    ]);
  }
});

test('selected public return is routed once to both concrete producer channels', () => {
  const port = new V6CommonCampaignDecisionPort({
    jointChannels: createPublicSmlpAddressedJointChannels(),
    jointContextByChannel(current) {
      return publicSmlpAddressedJointContext(current.agent);
    },
  });
  port.initialize('lot9c2-smlp-public-session', 0);

  assert.deepEqual(port.decide(observation(), 50, signal), {
    id: 6,
    data: { x: 32, y: 26 },
  });
  port.observe(observation(1, openHorizontalGate()));
  assert.equal(port.lastAcquisition?.routed, true);
  const result = port.lastAcquisition?.result as {
    channels: Array<{ channelId: string; result: { acquired: boolean } }>;
  };
  assert.deepEqual(result.channels.map(item => item.channelId), [
    PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  ]);
  assert.ok(result.channels.every(item => item.result.acquired));

  port.observe(observation(1, openHorizontalGate()));
  assert.equal(port.lastAcquisition?.routed, true);
});

test('producer supports the source-qualified open-gate glyph and rejects an empty scene', () => {
  const open = producePublicSmlpGateCandidate(observation(0, openHorizontalGate()));
  assert.ok(open);
  assert.equal(open.orientation, 'open_horizontal');
  assert.deepEqual(open.action, { id: 6, data: { x: 32, y: 26 } });

  assert.equal(producePublicSmlpGateCandidate(observation(0, pixels(2))), undefined);
  assert.deepEqual(publicSmlpAddressedJointContext(observation(0, pixels(2))), {});
});
