import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseCascade, type Cascade, type CascadeReading } from '../src/sic/logic-cascade.ts';

test('terminal gates share one assignment of switch values', () => {
  const feeds = [[0, 1], [1, 2], [0, 2]] as const;
  const layout: Cascade = { controls: [[3, 9, 3, 9], [7, 9, 7, 9], [11, 9, 11, 9]], initial: 0, off: 0,
    gates: feeds.map((_, i) => ({ box: [i * 5, 1, i * 5 + 4, 3], cell: [i * 5 + 2, 2],
      ports: [[i * 5 + 1, 4], [i * 5 + 3, 4]], output: [i * 5 + 2, 0] })), lamp: [2, 0, 2, 0], terminal: 0,
    terminals: feeds.map((_, i) => ({ gate: i, lamp: [i * 5 + 2, 0, i * 5 + 2, 0] })) };
  const readings: CascadeReading[] = [0, 1, 2, 4, 5, 6].map(setting => {
    const controlInks = [0, 1, 2].map(i => (setting >> i) & 1);
    const [a, b, c] = controlInks;
    const active = [Boolean(a && b), Boolean(b || c), a !== c];
    return { setting, controlInks, active, ports: feeds.map(pair => pair.map(i => controlInks[i]!)),
      lamp: Number(active[0]), lamps: active.map(Number) };
  });
  const rows = Array.from({ length: 12 }, () => Array<number>(15).fill(0));
  const current = readings.find(reading => reading.setting === 5)!;
  const firstLampOnly = chooseCascade(rows, { ...layout, terminals: undefined }, readings, current, [], 5);
  const allLamps = chooseCascade(rows, layout, readings, current, [], 5);
  assert.equal(firstLampOnly?.distance, 1);
  assert.equal(allLamps?.distance, 2);
});
