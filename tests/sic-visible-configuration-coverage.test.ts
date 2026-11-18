import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicVisibleConfigurationCoverage } from '../src/sic/visible-configuration-coverage.ts';

const values = [[2, 3], [11, 12]];
const combinations = values[0]!.flatMap(first => values[1]!.map(second => [first, second]));
const signature = (tuple: number[]) => tuple.join(',');

function board(current: number[], visited: number[][]) {
  const rows = Array.from({ length: 32 }, () => Array<number>(40).fill(5));
  function rectangle(x: number, y: number, width: number, height: number, ink: number) {
    for (let row = y; row < y + height; row++) rows[row]!.fill(ink, x, x + width);
  }
  for (const [index, palette] of values.entries()) {
    const x = 4 + 14 * index;
    rectangle(x, 3, 9, 9, 1);
    rectangle(x + 1, 4, 7, 7, current[index]!);
    for (const [slot, ink] of palette.entries()) rectangle(x + 1 + 4 * slot, 14, 2, 2, ink);
  }
  for (const [index, tuple] of combinations.entries()) {
    const x = 2 + 9 * index, isCurrent = signature(tuple) === signature(current);
    const wasVisited = visited.some(value => signature(value) === signature(tuple));
    rectangle(x, 23, 6, 3, isCurrent ? 7 : wasVisited ? 8 : 9);
    rows[24]!.splice(x + 1, 4, 6, tuple[0]!, 6, tuple[1]!);
  }
  return rows;
}

const observe = (rows: number[][], revision: number) => measureNativeObservation({
  frame_rows: rows, frame_hash: String(revision), level: 2, levels_completed: 1,
  state: 'NOT_FINISHED', available_action_refs: ['ACTION6'],
}, revision);

test('recalibrate the ordered values of a complete catalogue after its palette changes', async () => {
  const coverage = createSicVisibleConfigurationCoverage();
  const initial = [2, 11], first = board(initial, []);
  const before = await observe(first, 1);
  coverage.restore({
    witness: { epoch: before.level_epoch, visitedBorder: 8, boundary: 'previous-victory',
      factors: [
        { values: [13, 14], input: 'ACTION6', ref: 'previous-left-control' },
        { values: [0, 15], input: 'ACTION6', ref: 'previous-right-control' },
      ] },
  });
  const probe = await coverage.propose(before, first, [], 20);
  assert.ok(probe);
  assert.equal(probe.sicSituationCard?.strategy, 'test_visible_factor_cycle');
  assert.deepEqual(probe.choice.expected, [3, 11]);

  const second = board(probe.choice.expected, [initial]);
  const after = await observe(second, 2);
  assert.equal((await coverage.after(probe, 0, before, after, first, second)).matched, true);
  await coverage.record(before, after, probe.actions[0]!, first, second, probe, 0, []);
  const next = await coverage.propose(after, second, [], 19);
  assert.ok(next);
  assert.deepEqual(next.choice.expected, [3, 12]);
});
