import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCodeMask } from '../src/logos-engine/v6-code-program.ts';
import { measureOccurrenceScene } from '../src/logos-engine/v6-occurrence-scene.ts';

test('exact integer scaling keeps separated parts and holes in one occurrence', () => {
  const mask = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 2], [2, 3], [3, 4], [4, 4]] as const;
  const rows = Array.from({ length: 32 }, () => Array<number>(32).fill(0));
  const paint = (left: number, top: number, scale: number) => {
    for (const [x, y] of mask) for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      rows[top + y * scale + dy]![left + x * scale + dx] = 7;
    }
  };
  paint(3, 2, 2);
  paint(20, 18, 1);
  const scene = measureOccurrenceScene(rows, { observation_ref: 'rendered-mask', level_epoch: 1 },
    { max_width: 5, max_height: 5, indicator_boxes: [] }, { allowNarrowerForeground: true, inferIntegerScale: true });
  assert.equal(scene?.calibration.foreground_scale, 2);
  assert.deepEqual(scene?.occurrences.map(part => part.scale), [2, 1]);
  assert.deepEqual(scene?.occurrences.map(part => normalizeCodeMask(part.mask, part.scale)), [mask, mask]);
});

test('an observed foreground can cover the edge of a calibrated indicator', () => {
  const rows = Array.from({ length: 16 }, () => Array<number>(16).fill(0));
  for (let y = 1; y <= 4; y++) rows[y]!.fill(6, 2, 7);
  for (let y = 4; y <= 7; y++) rows[y]!.fill(9, 5, 8);
  const box = [2, 1, 6, 4];
  const calibration = { max_width: 3, max_height: 4, indicator_boxes: [box] };
  const observation = { observation_ref: 'visible-indicator', level_epoch: 1 };
  assert.equal(measureOccurrenceScene(rows, observation, calibration), null);
  const read = () => measureOccurrenceScene(rows, observation, calibration, { readOccludedIndicators: true });
  const scene = read();
  assert.deepEqual(scene?.indicators, [{ bbox: box, value: 6 }]);
  assert.deepEqual(scene?.occurrences.map(part => part.color), [9]);
  rows[3]![3] = 10;
  assert.equal(read(), null);
});
