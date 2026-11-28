import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const commitment = '3a78401f0e67b0440028a939be4e06a8bc3baa37e1afc5c687b6235e688523a4';

export function readSelection(path) {
  const bytes = readFileSync(path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), commitment);
  const { seed } = JSON.parse(bytes);
  assert.match(seed, /^[0-9a-f]{64}$/);
  return Buffer.from(seed, 'hex').readUInt32BE(0);
}

export function runsOfFrames(frames) {
  const runs = [];
  for (const [index, frame] of frames.entries()) {
    if (index === 0 || !isDeepStrictEqual(frame, frames[index - 1])) {
      runs.push({ first: index, length: 1 });
    } else {
      runs.at(-1).length++;
    }
  }
  return runs;
}

export function animation(frames, variant, selection) {
  assert.ok(Array.isArray(frames) && frames.length >= 2);
  if (variant === 'complet') return frames.slice();
  if (variant === 'bornes') {
    const result = Array(frames.length).fill(frames[0]);
    result[result.length - 1] = frames.at(-1);
    return result;
  }
  assert.equal(variant, 'palier');
  assert.ok(Number.isInteger(selection) && selection >= 0 && selection <= 0xffffffff);
  const interior = runsOfFrames(frames).slice(1, -1);
  assert.ok(interior.length > 0, 'aucun palier intérieur à masquer');
  const { first, length } = interior[selection % interior.length];
  return frames.slice().fill(frames[first - 1], first, first + length);
}
