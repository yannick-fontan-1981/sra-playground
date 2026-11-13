import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PROTOCOL_VERSION,
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
import {
  PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  PublicActionAvailabilityJointChannel,
  PublicVisibleTargetJointChannel,
  createPublicSmlpAddressedJointChannels,
  publicSmlpAddressedJointContext,
} from '../src/logos-engine/v6-public-addressed-joint-channels.ts';
import {
  PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID,
  PublicStckActionAvailabilityJointChannel,
  PublicStckVisibleTargetJointChannel,
  publicStckAddressedJointContext,
} from '../src/logos-engine/v6-public-stck-joint-channels.ts';

function setPixel(pixels: Uint8Array, x: number, y: number, value: number): void {
  pixels[y * 64 + x] = value;
}

function observation(
  sessionId: string,
  pixels: Uint8Array,
  sequence = 0,
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels,
    },
    availableActionIds: [5, 6, 7],
    state: 'NOT_FINISHED',
    level: 1,
    levelsCompleted: 0,
  };
}

function smlpFrame(): Uint8Array {
  const pixels = new Uint8Array(64 * 64).fill(2);
  const x = 32;
  const y = 26;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) setPixel(pixels, x + dx, y + dy, 12);
  }
  setPixel(pixels, x, y - 1, 5);
  setPixel(pixels, x, y, 5);
  setPixel(pixels, x, y + 1, 5);
  return pixels;
}

function stckFrame(): Uint8Array {
  const pixels = new Uint8Array(64 * 64).fill(5);
  for (let y = 48; y <= 52; y += 1) {
    for (let x = 2; x <= 7; x += 1) setPixel(pixels, x, y, 14);
  }
  return pixels;
}

test('qualified SMLP contexts share one frozen candidate and one sealed payload', () => {
  const current = observation('zero-copy-smlp', smlpFrame());
  const context = publicSmlpAddressedJointContext(current);
  assert.strictEqual(
    context[PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID],
    context[PUBLIC_VISIBLE_TARGET_CHANNEL_ID],
  );
  assert.equal(Object.isFrozen(context[PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID]), true);

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
  assert.strictEqual(availabilityContribution.payload, targetContribution.payload);
  assert.equal(Object.isFrozen(availabilityContribution.payload), true);
});

test('qualified STCK contexts share one frozen candidate and one sealed payload', () => {
  const current = observation('zero-copy-stck', stckFrame(), 3);
  const context = publicStckAddressedJointContext(current);
  assert.strictEqual(
    context[PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID],
    context[PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID],
  );
  assert.equal(Object.isFrozen(context[PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID]), true);

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
  assert.strictEqual(availabilityContribution.payload, targetContribution.payload);
  assert.equal(Object.isFrozen(availabilityContribution.payload), true);
});

test('cloned or stale public context remains fully revalidated', () => {
  const before = observation('zero-copy-revalidate', smlpFrame());
  const trusted = publicSmlpAddressedJointContext(before);
  const cloned = structuredClone(trusted[PUBLIC_VISIBLE_TARGET_CHANNEL_ID]);
  const changedPixels = smlpFrame();
  setPixel(changedPixels, 32, 25, 2);
  const changed = observation('zero-copy-revalidate', changedPixels);
  const owner = new JointChannelOwner(createPublicSmlpAddressedJointChannels());

  assert.equal(owner.propose({
    observation: changed,
    contextByChannel: {
      [PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID]: cloned,
      [PUBLIC_VISIBLE_TARGET_CHANNEL_ID]: cloned,
    },
  }), undefined);
  assert.equal(owner.lastAssessment.status, 'incomplete');
});

test('qualified readonly channels share the selected public return without copying it', () => {
  const current = observation('zero-copy-return', smlpFrame());
  const joint = new JointChannelOwner(createPublicSmlpAddressedJointChannels());
  const campaign = new CommonCampaignOwner([joint]);
  const prepared = campaign.prepare(current, {
    [JOINT_CHANNEL_OWNER_ID]: {
      observation: current,
      contextByChannel: publicSmlpAddressedJointContext(current),
    },
  });
  assert.equal(prepared.status, 'action');
  if (prepared.status !== 'action') return;

  const returnPayload = {
    observation: observation('zero-copy-return', smlpFrame(), 1),
  };
  const acquired = campaign.acquire({
    sessionId: current.sessionId,
    needId: prepared.needId,
    eventRef: 'zero-copy-return:1',
    payload: returnPayload,
  });
  const receipt = acquired.result as {
    channels: Array<{
      result: {
        action: unknown;
        returnPayload: unknown;
      };
    }>;
  };
  assert.strictEqual(receipt.channels[0]?.result.returnPayload, returnPayload);
  assert.strictEqual(receipt.channels[1]?.result.returnPayload, returnPayload);
  assert.strictEqual(receipt.channels[0]?.result.action, receipt.channels[1]?.result.action);
});

class DetachedChannel implements JointChannel {
  readonly acquisitions: JointChannelAcquisition[] = [];

  constructor(
    readonly id: string,
    readonly payload: NonNullable<ReturnType<typeof prepareJointChannelActionPayload>>,
  ) {}

  contribute(_request: JointChannelContributionRequest): JointChannelContribution {
    return {
      channelId: this.id,
      contributionRef: `${this.id}:contribution`,
      jointRef: 'detached-joint',
      actionRef: 'ACTION1',
      payload: this.payload,
    };
  }

  acquire(event: JointChannelAcquisition): unknown {
    this.acquisitions.push(event);
    return { acquired: true };
  }
}

test('generic channels retain detached action and return copies by default', () => {
  const current = observation('detached-return', new Uint8Array(64 * 64).fill(2));
  const payload = prepareJointChannelActionPayload(current, { id: 1 }, 'detached-joint');
  assert.ok(payload);
  const first = new DetachedChannel('detached-a', payload);
  const second = new DetachedChannel('detached-b', payload);
  const campaign = new CommonCampaignOwner([new JointChannelOwner([first, second])]);
  const prepared = campaign.prepare(current, {
    [JOINT_CHANNEL_OWNER_ID]: { observation: current },
  });
  assert.equal(prepared.status, 'action');
  if (prepared.status !== 'action') return;

  const returnPayload = { pixels: new Uint8Array([1, 2, 3]) };
  campaign.acquire({
    sessionId: current.sessionId,
    needId: prepared.needId,
    eventRef: 'detached-return:1',
    payload: returnPayload,
  });
  assert.equal(first.acquisitions.length, 1);
  assert.equal(second.acquisitions.length, 1);
  assert.notStrictEqual(first.acquisitions[0]?.returnPayload, returnPayload);
  assert.notStrictEqual(second.acquisitions[0]?.returnPayload, returnPayload);
  assert.notStrictEqual(
    first.acquisitions[0]?.returnPayload,
    second.acquisitions[0]?.returnPayload,
  );
  assert.notStrictEqual(first.acquisitions[0]?.action, second.acquisitions[0]?.action);
});
