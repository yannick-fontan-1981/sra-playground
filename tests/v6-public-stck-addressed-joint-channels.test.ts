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
  createPublicStckAddressedJointChannels,
  producePublicStckTargetCandidate,
  publicStckAddressedJointContext,
} from '../src/logos-engine/v6-public-addressed-joint-channels.ts';
import { V6CommonCampaignDecisionPort } from '../src/runtime/v6-common-campaign-decision-port.ts';

function frame(fill = 5): Uint8Array {
  return new Uint8Array(64 * 64).fill(fill);
}

function setPixel(pixels: Uint8Array, x: number, y: number, value: number): void {
  pixels[y * 64 + x] = value;
}

function stckShopFrame(withStackCard = true): Uint8Array {
  const pixels = frame(5);
  for (let y = 0; y < 54; y += 1) {
    for (let x = 0; x < 11; x += 1) setPixel(pixels, x, y, 4);
  }
  for (let y = 54; y <= 58; y += 1) {
    for (let x = 2; x <= 10; x += 1) setPixel(pixels, x, y, 10);
  }
  if (withStackCard) {
    for (let y = 49; y <= 52; y += 1) {
      for (let x = 1; x <= 8; x += 1) setPixel(pixels, x, y, 10);
    }
  }
  return pixels;
}

function observation(
  sequence = 0,
  pixels = stckShopFrame(),
  availableActionIds: AgentObservation['availableActionIds'] = [5, 6, 7],
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'lot9c3-stck-public-session',
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: Uint8Array.from(pixels),
    },
    availableActionIds: [...availableActionIds],
    state: 'NOT_FINISHED',
    level: 1,
    levelsCompleted: 0,
  };
}

const signal = new AbortController().signal;

test('public STCK producer removes the lowest visible stack card while shop state is visible', () => {
  const candidate = producePublicStckTargetCandidate(observation());
  assert.ok(candidate);
  assert.equal(candidate.targetKind, 'stack_card_remove');
  assert.deepEqual(candidate.action, { id: 6, data: { x: 4, y: 52 } });
  assert.match(candidate.targetRef, /^public-stck-target:public-observation:/);
  assert.match(candidate.jointRef, /ACTION6$/);
  assert.deepEqual(Object.keys(publicStckAddressedJointContext(observation())).sort(), [
    PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  ]);
});

test('public STCK producer selects the first active shop button when the stack is empty', () => {
  const candidate = producePublicStckTargetCandidate(observation(0, stckShopFrame(false)));
  assert.ok(candidate);
  assert.equal(candidate.targetKind, 'shop_button_add');
  assert.deepEqual(candidate.action, { id: 6, data: { x: 6, y: 56 } });
});

test('STCK target producer refuses a stack card when no active public shop bar is visible', () => {
  const pixels = stckShopFrame(true);
  for (let y = 54; y <= 58; y += 1) {
    for (let x = 0; x < 64; x += 1) setPixel(pixels, x, y, 5);
  }
  assert.equal(producePublicStckTargetCandidate(observation(0, pixels)), undefined);
  assert.deepEqual(publicStckAddressedJointContext(observation(0, pixels)), {});
});

test('decision port releases the STCK ACTION6 only when both channels are present', () => {
  const makePort = (mode: 'both' | 'availability' | 'target') => new V6CommonCampaignDecisionPort({
    jointChannels: createPublicStckAddressedJointChannels(),
    jointContextByChannel(current) {
      const context = publicStckAddressedJointContext(current.agent);
      if (mode === 'both') return context;
      if (mode === 'availability') {
        return {
          [PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID]: context[PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID],
        };
      }
      return {
        [PUBLIC_VISIBLE_TARGET_CHANNEL_ID]: context[PUBLIC_VISIBLE_TARGET_CHANNEL_ID],
      };
    },
  });

  const current = observation();
  const both = makePort('both');
  both.initialize(current.sessionId, 0);
  assert.deepEqual(both.decide(current, 50, signal), {
    id: 6,
    data: { x: 4, y: 52 },
  });
  assert.equal(both.lastPrepare?.status, 'action');
  if (both.lastPrepare?.status === 'action') {
    assert.equal(both.lastPrepare.ownerId, JOINT_CHANNEL_OWNER_ID);
  }

  const availabilityOnly = makePort('availability');
  availabilityOnly.initialize(current.sessionId, 0);
  assert.equal(availabilityOnly.decide(current, 50, signal), undefined);
  assert.equal(availabilityOnly.jointOwner?.lastAssessment.status, 'incomplete');

  const targetOnly = makePort('target');
  targetOnly.initialize(current.sessionId, 0);
  assert.equal(targetOnly.decide(current, 50, signal), undefined);
  assert.equal(targetOnly.jointOwner?.lastAssessment.status, 'incomplete');
});

test('stale STCK target pixels remove the visible-target contribution', () => {
  const before = observation();
  const context = publicStckAddressedJointContext(before);
  const changedPixels = stckShopFrame(true);
  setPixel(changedPixels, 4, 52, 4);
  const changed = observation(0, changedPixels);
  const owner = new JointChannelOwner(createPublicStckAddressedJointChannels());

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

test('native release safety blocks STCK joint contributions when ACTION6 is unavailable', () => {
  const withAction = observation();
  const context = publicStckAddressedJointContext(withAction);
  const withoutAction = observation(0, stckShopFrame(true), [5, 7]);
  const owner = new JointChannelOwner(createPublicStckAddressedJointChannels());

  assert.equal(owner.propose({
    observation: withoutAction,
    contextByChannel: context,
  }), undefined);
  assert.equal(owner.lastAssessment.status, 'none');
});

test('selected STCK return is routed to both concrete public channels', () => {
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
  port.observe(observation(1, stckShopFrame(false)));
  assert.equal(port.lastAcquisition?.routed, true);
  const result = port.lastAcquisition?.result as {
    channels: Array<{ channelId: string; result: { acquired: boolean } }>;
  };
  assert.deepEqual(result.channels.map(item => item.channelId), [
    PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  ]);
  assert.ok(result.channels.every(item => item.result.acquired));
});
