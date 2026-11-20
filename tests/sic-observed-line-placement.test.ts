import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicObservedLinePlacement } from '../src/sic/observed-line-placement.ts';

function board(cells: readonly string[], size: number, vacancy = 4) {
  const rows = Array.from({ length: 32 }, () => Array<number>(32).fill(0));
  for (const [y, row] of cells.entries()) for (const [x, mark] of [...row].entries()) {
    const left = 2 + x * (size + 1), top = 2 + y * (size + 1);
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      rows[top + dy]![left + dx] = dx === 1 && dy === 1 && mark !== '.' ? Number(mark) : vacancy;
    }
  }
  return rows;
}

const observe = (rows: number[][], levels: number, revision: number) => measureNativeObservation({
  frame_rows: rows, frame_hash: String(revision), level: levels + 1, levels_completed: levels,
  available_action_refs: ['ACTION6'],
}, revision);

test('a measured line transfers to a resized vacant field and verifies the first two marks', async () => {
  const family = createSicObservedLinePlacement();
  const prior = [
    board(['...', '...', '...'], 4),
    board(['56.', '...', '...'], 4),
    board(['56.', '65.', '...'], 4),
  ];
  const next = board(['...', '...', '...'], 5);
  for (const [i, x, y] of [[0, 3, 3], [1, 8, 8], [2, 13, 13]] as const) {
    const before = prior[i], after = prior[i + 1] ?? next;
    await family.observePublicOutcome!(await observe(before, 0, i + 1), await observe(after, i === 2 ? 1 : 0, i + 2),
      { action_ref: 'ACTION6', data: { x, y } }, before, after);
  }

  const unknown = board(['...', '...', '...'], 5, 7);
  const clock = { now: () => 0, deadlineMs: 100, yieldControl: async () => {} };
  assert.equal(await family.propose(await observe(unknown, 1, 4), unknown, [], 10, clock), null);
  const before = await observe(next, 1, 4);
  const proposal = await family.propose(before, next, [], 10, clock);
  assert.ok(proposal);
  assert.equal(proposal.sicSituationCard?.strategy, 'verify_resized_marks');
  const [x, y] = proposal.point;
  const marks = Array.from({ length: 3 }, () => ['.', '.', '.']);
  marks[y]![x] = '5';
  marks[y]![(x + 1) % 3] = '6';
  const reply = board(marks.map(row => row.join('')), 5);
  const after = await observe(reply, 1, 5);
  assert.equal((await family.after(proposal, 0, before, after, next, reply)).matched, true);
  marks[y]![(x + 1) % 3] = '7';
  const unexpected = board(marks.map(row => row.join('')), 5);
  assert.equal((await family.after(proposal, 0, before, await observe(unexpected, 1, 5), next, unexpected)).matched, false);
});
