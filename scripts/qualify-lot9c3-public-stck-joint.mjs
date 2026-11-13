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
  createPublicStckAddressedJointChannels,
  producePublicStckTargetCandidate,
  publicStckAddressedJointContext,
} from '../src/logos-engine/v6-public-addressed-joint-channels.ts';
import {
  V6CommonCampaignDecisionPort,
} from '../src/runtime/v6-common-campaign-decision-port.ts';
import {
  selectRegionPublicAction6Probe,
} from './native-loop-region-public-action6-probe.mjs';

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
  if (values.length !== 64 * 64) throw new Error('native STCK frame is not 64x64');
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'lot9c3-real-stck-session',
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
}

const signal = new AbortController().signal;
const report = {
  corpus: 'real-public-stck-level-1-seed-0-ten-actions',
  archive: 'public/python/custom-games.zip',
  game: 'STCK',
  gameId: null,
  seed: 0,
  requestedActions: 10,
  channels: [
    PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  ],
  actions: [],
  targetKinds: [],
  changedPixelCounts: [],
  jointAssessments: [],
  acquisitionChannels: [],
  causalRemoval: [],
};

try {
  let publicCurrent = await request({ type: 'load', code: 'STCK' });
  report.gameId = publicCurrent.gameId;
  const full = port('both');
  full.initialize('lot9c3-real-stck-session', 0);

  for (let index = 0; index < report.requestedActions; index += 1) {
    const before = agentObservation(publicCurrent, index);
    const candidate = producePublicStckTargetCandidate(before);
    assert.ok(candidate, `missing STCK target candidate at step ${index}`);
    report.targetKinds.push(candidate.targetKind);

    const expected = selectRegionPublicAction6Probe('STCK', publicCurrent);
    assert.ok(expected, `existing public corpus has no STCK action at step ${index}`);

    const action = full.decide(before, 50, signal);
    assert.deepEqual(action, {
      id: expected.id,
      data: { x: expected.x, y: expected.y },
    });
    assert.equal(full.lastPrepare?.status, 'action');
    if (full.lastPrepare?.status === 'action') {
      assert.equal(full.lastPrepare.ownerId, JOINT_CHANNEL_OWNER_ID);
    }
    report.actions.push(structuredClone(action));
    report.jointAssessments.push(full.jointOwner?.lastAssessment ?? null);

    const availabilityOnly = port('availability');
    availabilityOnly.initialize(before.sessionId, 0);
    const withoutTarget = availabilityOnly.decide(before, 50, signal) ?? null;
    assert.equal(withoutTarget, null);
    assert.equal(availabilityOnly.jointOwner?.lastAssessment.status, 'incomplete');

    const targetOnly = port('target');
    targetOnly.initialize(before.sessionId, 0);
    const withoutAvailability = targetOnly.decide(before, 50, signal) ?? null;
    assert.equal(withoutAvailability, null);
    assert.equal(targetOnly.jointOwner?.lastAssessment.status, 'incomplete');
    report.causalRemoval.push({
      index,
      targetMissingAction: withoutTarget,
      availabilityMissingAction: withoutAvailability,
    });

    const publicAfter = await request({
      type: 'action',
      actionId: action.id,
      data: action.data,
    });
    const after = agentObservation(publicAfter, index + 1);
    const changed = changedPixels(before, after);
    assert.ok(changed > 0, `STCK step ${index} produced no public effect`);
    report.changedPixelCounts.push(changed);

    full.observe(after);
    assert.equal(full.lastAcquisition?.routed, true);
    const acquisition = full.lastAcquisition?.result;
    assert.ok(acquisition && Array.isArray(acquisition.channels));
    const channelIds = acquisition.channels.map(item => item.channelId);
    assert.deepEqual(channelIds, [
      PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
      PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
    ]);
    report.acquisitionChannels.push(channelIds);
    publicCurrent = publicAfter;
  }

  assert.ok(report.targetKinds.includes('stack_card_remove'));
  assert.ok(report.targetKinds.includes('shop_button_add'));
  assert.equal(report.actions.length, report.requestedActions);
  assert.equal(report.changedPixelCounts.length, report.requestedActions);
  assert.ok(report.changedPixelCounts.every(count => count > 0));
  assert.equal(report.causalRemoval.length, report.requestedActions);

  const output = process.env.LOT9C3_STCK_REPORT || 'lot9c3-public-stck-joint-report.json';
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    corpus: report.corpus,
    gameId: report.gameId,
    actions: report.actions,
    targetKinds: report.targetKinds,
    minChangedPixels: Math.min(...report.changedPixelCounts),
    maxChangedPixels: Math.max(...report.changedPixelCounts),
    causalRemovals: report.causalRemoval.length,
    acquisitions: report.acquisitionChannels.length,
  }, null, 2));
} finally {
  child.stdin.end();
  await once(child, 'close');
}
