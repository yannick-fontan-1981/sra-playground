import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import readline from 'node:readline';

import {
  PROTOCOL_VERSION,
} from '../src/runtime/contracts.ts';
import {
  JOINT_CHANNEL_OWNER_ID,
} from '../src/logos-engine/v6-joint-channel-owner.ts';
import {
  PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  createPublicSmlpAddressedJointChannels,
  publicSmlpAddressedJointContext,
} from '../src/logos-engine/v6-public-addressed-joint-channels.ts';
import {
  V6CommonCampaignDecisionPort,
} from '../src/runtime/v6-common-campaign-decision-port.ts';

const child = spawn('python3', ['scripts/native-python-archive-session.py'], {
  stdio: ['pipe', 'pipe', 'inherit'],
});
const lines = readline.createInterface({ input: child.stdout });
const waiting = [];
lines.on('line', line => {
  const pending = waiting.shift();
  if (!pending) throw new Error('unexpected native archive response');
  try {
    const payload = JSON.parse(line);
    if (!payload.ok) pending.reject(new Error(payload.error));
    else pending.resolve(payload.result);
  } catch (error) {
    pending.reject(error);
  }
});

function request(payload) {
  return new Promise((resolve, reject) => {
    waiting.push({ resolve, reject });
    child.stdin.write(`${JSON.stringify(payload)}\n`);
  });
}

function agentObservation(publicObservation, sequence) {
  const values = publicObservation.frame.flat();
  if (values.length !== 64 * 64) throw new Error('native SMLP frame is not 64x64');
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'lot9c2-real-smlp-session',
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: Uint8Array.from(values),
    },
    availableActionIds: [...publicObservation.availableActionIds],
    state: publicObservation.state,
    level: publicObservation.level,
    levelsCompleted: publicObservation.levelsCompleted,
  };
}

function changedPixels(before, after) {
  let count = 0;
  for (let index = 0; index < before.image.pixels.length; index += 1) {
    if (before.image.pixels[index] !== after.image.pixels[index]) count += 1;
  }
  return count;
}

function port(mode = 'both') {
  return new V6CommonCampaignDecisionPort({
    jointChannels: createPublicSmlpAddressedJointChannels(),
    jointContextByChannel(current) {
      const context = publicSmlpAddressedJointContext(current.agent);
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
}

const signal = new AbortController().signal;
const report = {
  corpus: 'real-public-smlp-level-1-seed-0',
  archive: 'public/python/custom-games.zip',
  game: 'SMLP',
  gameId: null,
  seed: 0,
  channels: [
    PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  ],
  selectedAction: null,
  changedPixelCount: null,
  jointAssessment: null,
  acquisitionChannels: [],
  causalRemoval: {
    availabilityMissingAction: null,
    targetMissingAction: null,
  },
};

try {
  const publicBefore = await request({ type: 'load', code: 'SMLP' });
  const before = agentObservation(publicBefore, 0);
  report.gameId = publicBefore.gameId;

  const full = port('both');
  full.initialize(before.sessionId, 0);
  const action = full.decide(before, 50, signal);
  assert.deepEqual(action, { id: 6, data: { x: 32, y: 26 } });
  assert.equal(full.lastPrepare?.status, 'action');
  if (full.lastPrepare?.status === 'action') {
    assert.equal(full.lastPrepare.ownerId, JOINT_CHANNEL_OWNER_ID);
  }
  report.selectedAction = structuredClone(action);
  report.jointAssessment = full.jointOwner?.lastAssessment ?? null;

  const availabilityOnly = port('availability');
  availabilityOnly.initialize(before.sessionId, 0);
  report.causalRemoval.targetMissingAction = availabilityOnly.decide(before, 50, signal) ?? null;
  assert.equal(report.causalRemoval.targetMissingAction, null);
  assert.equal(availabilityOnly.jointOwner?.lastAssessment.status, 'incomplete');

  const targetOnly = port('target');
  targetOnly.initialize(before.sessionId, 0);
  report.causalRemoval.availabilityMissingAction = targetOnly.decide(before, 50, signal) ?? null;
  assert.equal(report.causalRemoval.availabilityMissingAction, null);
  assert.equal(targetOnly.jointOwner?.lastAssessment.status, 'incomplete');

  const publicAfter = await request({
    type: 'action',
    actionId: action.id,
    data: action.data,
  });
  const after = agentObservation(publicAfter, 1);
  report.changedPixelCount = changedPixels(before, after);
  assert.ok(report.changedPixelCount > 0);

  full.observe(after);
  assert.equal(full.lastAcquisition?.routed, true);
  const acquisition = full.lastAcquisition?.result;
  assert.ok(acquisition && Array.isArray(acquisition.channels));
  report.acquisitionChannels = acquisition.channels.map(item => item.channelId);
  assert.deepEqual(report.acquisitionChannels, [
    PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  ]);

  const output = process.env.LOT9C2_REPORT || 'lot9c2-public-addressed-joint-report.json';
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  child.stdin.end();
  await once(child, 'close');
}
