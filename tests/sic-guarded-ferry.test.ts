import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeBox, NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { planGuardedFerry, type GuardedFerry } from '../src/sic/guarded-ferry.ts';

test('a passenger already on the receiving bank can be required for the return trip', () => {
  const model = { actor: 'carrier', crossing: { from: 17, to: 37, forward: 'R', back: 'L' },
    motion: { U: [0, -4], D: [0, 4], L: [-4, 0], R: [4, 0] } as Record<string, NativePoint>,
    interaction: 'S', evidence: ['observed-crossing'], completed: 4 };
  const graph: GuardedFerry['ferry']['graph'] = {};
  for (const x of [12, 16, 20, 40, 44, 48, 52]) {
    for (let y = 12; y <= 44; y += 4) graph[[x, y].join(',')] = {};
  }
  for (const [id, neighbors] of Object.entries(graph)) {
    const [x, y] = id.split(',').map(Number) as [number, number];
    for (const [input, [dx, dy]] of Object.entries(model.motion)) {
      const next: NativePoint = [input === 'R' && x === 20 ? 40 : input === 'L' && x === 40 ? 20 : x + dx, y + dy];
      if (graph[next.join(',')]) neighbors[input] = next;
    }
  }
  const cargo = [12, 44, 28].map((y, index) => ({
    ink: index + 1, area: 1, shape: [12, y, 12, y] as NativeBox,
    berths: [[12, y, 12, y], [52, y, 52, y]] as const, centers: [[12, y], [52, y]] as const,
  }));
  const at: GuardedFerry['at'] = { actor: [20, 20], bank: 0, banks: [0, 0, 1], held: null };
  const start: GuardedFerry = { epoch: 5, ferry: { model, graph, cargo, radius: 12, pickup: 6, initial: at, firstFrame: 'start' },
    at, frame: 'start', hazards: [[0, 2], [1, 2]], radius: 12, rejected: [], refs: [], plan: [], stopped: false };
  const plan = planGuardedFerry(start, 40);
  assert.ok(plan);
  assert.ok(plan.some(leg => leg.role === 'take' && leg.expect.bank === 1 && leg.expect.held === 2));
  assert.ok(plan.some(leg => leg.role === 'release' && leg.expect.bank === 0 && leg.expect.banks[2] === 0
    && leg.expect.banks[0] === 1));
  assert.deepEqual(plan.at(-1)?.expect.banks, [1, 1, 1]);
});
