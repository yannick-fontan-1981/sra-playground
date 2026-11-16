import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { createSicObservedRailTransfers } from '../src/sic/observed-rail-transfers.ts';

test('a receiver can require moving a relay train before a matching load is available', async () => {
  const pitch = 5, grid = { x: 0, y: 0, pitch };
  const frame = Array.from({ length: 30 }, () => Array<number>(40).fill(0));
  const rail = ['00000', '11111', '10001', '11111', '00000'];
  const rear = ['00110', '01110', '11112', '01110', '00110'];
  const front = rear.map(line => [...line].reverse().join(''));
  const arm = ['00100', '00100', '11111', '10101', '10001'];
  const emptyBay = ['44444', '40004', '40004', '40004', '44444'];
  const load = ['44444', '40004', '40444', '40004', '44444'];
  const receiver = ['33333', '37773', '37333', '37773', '33333'];
  function paint(col: number, row: number, pattern: string[]) {
    for (const [y, line] of pattern.entries()) for (const [x, color] of [...line].entries()) {
      frame[row * pitch + y]![col * pitch + x] = Number(color);
    }
  }
  for (const row of [2, 4]) {
    for (let col = 0; col < 7; col++) paint(col, row, rail);
    paint(0, row, rear);
    paint(1, row, row === 2 ? emptyBay : receiver);
    paint(2, row, front);
  }
  paint(3, 0, load);
  paint(3, 1, arm);
  paint(4, 3, arm);
  const observation = await measureNativeObservation({
    frame_rows: frame, frame_hash: await publicFrameHash(frame), level: 3, levels_completed: 2,
    state: 'NOT_FINISHED', available_action_refs: ['ACTION6'],
  }, 1, 'rail-fixture');
  const family = createSicObservedRailTransfers();
  family.restore({ witness: { epoch: observation.level_epoch, grid, wins: 2, evidence: ['observed-arm-transfer'] } });
  const proposal = await family.propose(observation, frame, [], 10);
  assert.ok(proposal?.continuation);
  assert.equal(proposal.continuation.purpose, 'fill');
  assert.equal(proposal.continuation.moves.length, 2);
  assert.equal(proposal.projection.filled, 0);
  assert.equal(proposal.actions.length, 1);
});
