import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findSmlpVisibleGateCenter,
  findStckVisibleShopButtonCenter,
  selectRegionPublicAction6Probe,
} from '../scripts/native-loop-region-public-action6-probe.mjs';

function blank(fill = 5) {
  return Array.from({ length: 64 }, () => Array(64).fill(fill));
}

function observation(frame) {
  return { frame, availableActionIds: [5, 6, 7] };
}

test('SMLP probe selects the center of the first visible closed-gate glyph', () => {
  const f = blank(2);
  const x = 20;
  const y = 30;
  for (let yy = y - 1; yy <= y + 1; yy += 1) {
    for (let xx = x - 1; xx <= x + 1; xx += 1) f[yy][xx] = 12;
  }
  f[y - 1][x] = 5;
  f[y][x] = 5;
  f[y + 1][x] = 5;
  assert.deepEqual(findSmlpVisibleGateCenter(observation(f)), { id: 6, x, y });
  assert.deepEqual(selectRegionPublicAction6Probe('SMLP', observation(f)), { id: 6, x, y });
});

test('STCK probe selects the center of the first visible bottom button run', () => {
  const f = blank(5);
  for (let y = 54; y <= 58; y += 1) {
    for (let x = 2; x <= 10; x += 1) f[y][x] = 10;
  }
  assert.deepEqual(findStckVisibleShopButtonCenter(observation(f)), { id: 6, x: 6, y: 56 });
  assert.deepEqual(selectRegionPublicAction6Probe('STCK', observation(f)), { id: 6, x: 6, y: 56 });
});

test('public ACTION6 probe fails closed when ACTION6 is unavailable', () => {
  const f = blank(2);
  assert.throws(
    () => findSmlpVisibleGateCenter({ frame: f, availableActionIds: [5, 7] }),
    /requires ACTION6/,
  );
});

test('public ACTION6 probe returns undefined when no public target glyph is visible', () => {
  const f = blank(2);
  assert.equal(findSmlpVisibleGateCenter(observation(f)), undefined);
  const stck = blank(5);
  assert.equal(findStckVisibleShopButtonCenter(observation(stck)), undefined);
});
