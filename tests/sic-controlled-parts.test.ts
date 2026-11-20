import test from 'node:test';
import assert from 'node:assert/strict';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import {
  carryPreviewBindings,
  acceptPreviewCarry,
  newPreviewLearning,
  observePreviewBindings,
  visualLayout,
} from '../src/sic/witnessed-preview-transfer.ts';
import { controlledStrokes, exposedUnderParts } from '../src/sic/controlled-parts.ts';
import { plansForWitnessedSubjects } from '../src/sic/plan-witnessed-mechanism.ts';
import { initialMemory } from '../src/sic/preparation-experiments.ts';
import type { XY } from '../src/sic/access-terrain.ts';

const controls = ['MOVE_A', 'MOVE_B', 'MOVE_C', 'MOVE_D', 'FIRE'];
async function frame(level: number, n: number, p: XY, c: XY, r: XY | null, peer: XY) {
  const rows = Array.from({ length: 14 }, () => Array<number>(22).fill(2));
  for (let y = 3; y <= 9; y++) for (let x = 2; x <= 18; x++) if (x <= 8 || x >= 12) rows[y]![x] = 7;
  for (const u of [p, peer]) rows[u[1]]![u[0]] = 9;
  rows[c[1]]![c[0]] = 4;
  if (r) rows[r[1]]![r[0]] = 6;
  const o = await measureNativeObservation(
    {
      frame_rows: rows,
      level,
      levels_completed: level - 1,
      state: 'LIVE',
      available_action_refs: controls,
      frame_hash: await publicFrameHash(rows),
    },
    n,
    'unseen'
  );
  return { o, rows, v: visualLayout(o, rows) };
}
test('a moving individual keeps its measured controls and reference across a new board with a stationary peer', async () => {
  const knowledge = newPreviewLearning(),
    peer: XY = [17, 9],
    c: XY = [5, 6];
  let revision = 0;
  async function step(p: XY, to: XY, q: string, marker: XY | null = null) {
    const b = await frame(1, ++revision, p, c, marker, peer),
      a = await frame(1, ++revision, to, c, null, peer);
    observePreviewBindings(knowledge, b.o, a.o, b.v, a.v, q);
    exposedUnderParts(knowledge, b.o, a.o, b.rows, a.rows, b.v, a.v);
    return a;
  }
  await step([3, 6], [4, 6], controls[0]!);
  await step([4, 6], [3, 6], controls[1]!);
  await step([4, 5], [4, 6], controls[2]!);
  await step([4, 6], [4, 5], controls[3]!);
  await step([4, 6], [6, 6], 'FIRE', [6, 6]);
  const old = await step([3, 6], [7, 6], 'FIRE', [7, 6]);
  const b = await frame(2, ++revision, [3, 5], c, null, peer),
    a = await frame(2, ++revision, [4, 5], c, null, peer);
  const carry = carryPreviewBindings(knowledge, old.o, b.o),
    learner = acceptPreviewCarry(carry, b.o);
  const binding = Object.values(learner.bindings).find((x) => x.gesture.op === 'FIRE')!;
  assert.ok(binding.witnesses.every((w) => w.geometry?.pivots.length));
  assert.deepEqual(learner.partMotion![binding.actor]!.sites, {});
  assert.equal(controlledStrokes(learner.partMotion![binding.actor]!, new Set(controls), 'FIRE').length, 4);
  observePreviewBindings(learner, b.o, a.o, b.v, a.v, controls[0]!);
  exposedUnderParts(learner, b.o, a.o, b.rows, a.rows, b.v, a.v);
  const m = initialMemory(2);
  m.previewLearning = learner;
  const candidates = plansForWitnessedSubjects(m, a.o, a.rows, new Set(controls));
  assert.ok(
    candidates.some(
      ({ plan }) =>
        plan.basis === 'move_to_change_access' &&
        plan.arrival![0] >= 24 &&
        plan.p === binding.actor &&
        plan.actorPeers?.[0]?.join() === '34,18' &&
        plan.initialC.join() === '10,12'
    )
  );
  const other = await frame(2, ++revision, [4, 5], c, null, [15, 8]);
  delete learner.lastActor[binding.actor];
  assert.equal(plansForWitnessedSubjects(m, other.o, other.rows, new Set(controls)).length, 0);
});
