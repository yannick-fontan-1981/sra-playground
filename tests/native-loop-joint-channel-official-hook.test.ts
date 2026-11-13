import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PROTOCOL_VERSION,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import {
  PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  producePublicSmlpGateCandidate,
} from '../src/logos-engine/v6-public-addressed-joint-channels.ts';
import {
  PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID,
  producePublicStckTargetCandidate,
} from '../src/logos-engine/v6-public-stck-joint-channels.ts';
import {
  createOfficialJointChannelSession,
  createOfficialJointChannelStats,
} from '../scripts/native-loop-joint-channel-official-hook.mjs';

function observation(
  sessionId: string,
  sequence: number,
  pixels: Uint8Array,
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

function setPixel(pixels: Uint8Array, x: number, y: number, value: number): void {
  pixels[y * 64 + x] = value;
}

function smlpFrame(open = false): Uint8Array {
  const pixels = new Uint8Array(64 * 64).fill(2);
  const x = 32;
  const y = 26;
  if (open) {
    setPixel(pixels, x, y - 1, 12);
    setPixel(pixels, x, y, 3);
    setPixel(pixels, x, y + 1, 12);
  } else {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) setPixel(pixels, x + dx, y + dy, 12);
    }
    setPixel(pixels, x, y - 1, 5);
    setPixel(pixels, x, y, 5);
    setPixel(pixels, x, y + 1, 5);
  }
  return pixels;
}

function uniqueStckCardFrame(withCard = true): Uint8Array {
  const pixels = new Uint8Array(64 * 64).fill(5);
  if (withCard) {
    for (let y = 48; y <= 52; y += 1) {
      for (let x = 2; x <= 7; x += 1) setPixel(pixels, x, y, 14);
    }
  }
  return pixels;
}

test('Lot 9C4 standalone SMLP seam releases OP28 and routes both channel returns', () => {
  const stats = createOfficialJointChannelStats();
  const sessionId = 'lot9c4-hook-smlp';
  const before = observation(sessionId, 0, smlpFrame(false));
  const candidate = producePublicSmlpGateCandidate(before);
  assert.ok(candidate);
  const seam = createOfficialJointChannelSession({ game: 'SMLP', sessionId, stats: stats.SMLP });

  const prepared = seam.prepare(before, candidate.action);
  assert.deepEqual(prepared.action, candidate.action);
  const acquired = seam.acquire(observation(sessionId, 1, smlpFrame(true)));
  assert.deepEqual(acquired.channels, [
    PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  ]);
  assert.equal(seam.pending, false);
  assert.equal(stats.SMLP.decisions, 1);
  assert.equal(stats.SMLP.acquisitions, 1);
});

test('Lot 9C4 standalone STCK seam preserves the strict unique-card contract', () => {
  const stats = createOfficialJointChannelStats();
  const sessionId = 'lot9c4-hook-stck';
  const before = observation(sessionId, 3, uniqueStckCardFrame(true));
  const candidate = producePublicStckTargetCandidate(before);
  assert.ok(candidate);
  assert.deepEqual(candidate.action, { id: 6, data: { x: 4, y: 50 } });
  const seam = createOfficialJointChannelSession({ game: 'STCK', sessionId, stats: stats.STCK });

  const prepared = seam.prepare(before, candidate.action);
  assert.deepEqual(prepared.action, candidate.action);
  const acquired = seam.acquire(observation(sessionId, 4, uniqueStckCardFrame(false)));
  assert.deepEqual(acquired.channels, [
    PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID,
  ]);
  assert.equal(producePublicStckTargetCandidate(observation(sessionId, 4, uniqueStckCardFrame(false))), undefined);
  assert.equal(stats.STCK.decisions, 1);
  assert.equal(stats.STCK.acquisitions, 1);
});
