import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { measurePortableSlotLayout, type SlotValue } from '../src/sic/portable-slot-call.ts';

function scene(word: number[], stock: SlotValue[], main: (number | null)[], secondary: (number | null)[],
  third?: (number | null)[]) {
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(5));
  const fill = (x: number, y: number, w: number, h: number, ink: number) => {
    for (let yy = y; yy < y + h; yy++) rows[yy]!.fill(ink, x, x + w);
  };
  const outline = (x: number, y: number, w: number, h: number, ink: number) => {
    fill(x, y, w, 1, ink);
    fill(x, y + h - 1, w, 1, ink);
    fill(x, y + 1, 1, h - 2, ink);
    fill(x + w - 1, y + 1, 1, h - 2, ink);
  };
  for (const [i, value] of word.entries()) outline(2 + i * 7, 3, 5, 5, value);
  for (const [i, value] of stock.entries()) {
    if (typeof value === 'number') fill(4 + i * 6, 55, 3, 3, value);
    else outline(4 + i * 6, 55, 3, 3, Number(value.slice(5)));
  }
  for (const [cells, label, y] of [[main, 7, 15], [secondary, 9, 30], [third, 14, 43]] as const) {
    if (!cells) continue;
    outline(2, y, 6 * cells.length + 5, 9, label);
    for (const [i, value] of cells.entries()) {
      if (value === null) fill(6 + i * 6, y + 4, 1, 1, 4);
      else fill(5 + i * 6, y + 3, 3, 3, value);
    }
  }
  return rows;
}

async function read(rows: number[][]) {
  const observation = await measureNativeObservation({ frame_rows: rows, frame_hash: 'fixture', level: 1, levels_completed: 0,
    available_action_refs: ['ACTION5', 'ACTION6'], state: 'NOT_FINISHED' }, 1);
  return measurePortableSlotLayout(observation, rows);
}

test('multiple calls expand shared physical slots without spending their literal tokens twice', async () => {
  const rows = scene([6, 14, 8, 8, 14, 8, 8, 11, 15], [15, 6, 8, 8, 11, 14, 'call:9', 'call:9'],
    [null, null, null, null, null], [null, null, null]);
  const layout = await read(rows);
  assert.ok(layout);
  const assigned = layout.slots.map((box, i) => ({ x: box[0], y: box[1], value: layout.targets[i] }));
  const valuesAt = (y: number) => assigned.filter(item => item.y === y).sort((a, b) => a.x - b.x).map(item => item.value);
  assert.deepEqual(valuesAt(18), [6, 'call:9', 'call:9', 11, 15]);
  assert.deepEqual(valuesAt(33), [14, 8, 8]);
});

test('rejects a token assignment that can only consume every call through a recursive definition', async () => {
  const rows = scene([14, 8, 14, 8], ['call:9', 'call:9', 'call:9', 8], [null, null], [14, null, null]);
  assert.equal(await read(rows), null);
});

test('prefers the matching frame labels among valid nested expansions', async () => {
  const rows = scene([7, 9, 14, 11, 14, 9, 7], [7, 9, 7, 14, 9, 14, 'call:14', 'call:9'],
    [null, null, null], [null, null, null], [null, 11, null]);
  const layout = await read(rows);
  assert.ok(layout);
  const valuesAt = (y: number) => layout.slots.map((box, i) => ({ box, value: layout.targets[i] }))
    .filter(({ box }) => box[1] === y).sort((a, b) => a.box[0] - b.box[0]).map(item => item.value);
  assert.deepEqual(valuesAt(18), [7, 'call:9', 7]);
  assert.deepEqual(valuesAt(33), [9, 'call:14', 9]);
  assert.deepEqual(valuesAt(46), [14, 11, 14]);
});
