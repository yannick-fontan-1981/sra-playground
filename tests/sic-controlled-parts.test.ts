import test from 'node:test';
import { spatialControls, cellMatches } from '../src/sic/calibrate-spatial-controls.ts';
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
import { offerMechanism } from '../src/sic/reconfigure-local-mechanism.ts';
import { newLocalProgress } from '../src/sic/local-progress.ts';
import { newOccupancyMemory } from '../src/sic/occupancy-programs.ts';
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
  m.localProgress = newLocalProgress();
  m.occupancy = newOccupancyMemory();
  const early = offerMechanism(m, 0, a.o, a.rows, new Set(controls), null)?.mechanism;
  assert.equal(early?.cause.tag, 'projected_access_limit');
  assert.ok(early?.plan.arrival);
  let actor: XY = [4, 5],
    piece: XY = [5, 6];
  const terrain = (v: XY) =>
    v[1] >= 3 &&
    v[1] <= 9 &&
    ((v[0] >= 2 && v[0] <= 8) || (v[0] >= 12 && v[0] <= 18)) &&
    v.join() !== peer.join();
  const ds: Record<string, XY> = { MOVE_A: [1, 0], MOVE_B: [-1, 0], MOVE_C: [0, 1], MOVE_D: [0, -1] };
  for (const step of early!.plan.steps) {
    const d = ds[step.op];
    const dest: XY = d
      ? [actor[0] + d[0], actor[1] + d[1]]
      : [piece[0] * 2 - actor[0], piece[1] * 2 - actor[1]];
    if (terrain(dest)) {
      if (dest.join() === piece.join() && d) {
        const next: XY = [piece[0] + d[0], piece[1] + d[1]];
        if (terrain(next)) {
          piece = next;
          actor = dest;
        }
      } else actor = dest;
    }
    assert.deepEqual(
      actor.map((x) => x * 2),
      step.to
    );
    assert.deepEqual(
      piece.map((x) => x * 2),
      step.placed
    );
  }
  assert.ok(actor[0] >= 12);
  const other = await frame(2, ++revision, [4, 5], c, null, [15, 8]);
  delete learner.lastActor[binding.actor];
  assert.equal(plansForWitnessedSubjects(m, other.o, other.rows, new Set(controls)).length, 0);
});

test('common pitch calibrates varying sprite centres and keeps an untested inverse explicit', () => {
  const m = {
    axes: {},
    sites: {},
    substrate: {},
    displacements: {
      slide: { long: { d: [8, 0] as XY, count: 5, first: 'a', last: 'f' } },
      climb: {
        near: { d: [0, -7] as XY, count: 2, first: 'b', last: 'c' },
        far: { d: [0, -9] as XY, count: 2, first: 'd', last: 'e' },
      },
    },
  };
  const actions = new Set(['slide', 'climb', 'other', 'last', 'pulse']);
  const trial = spatialControls(m, actions, 'pulse', {}, 'scene', 'actor')!;
  assert.deepEqual(trial.pitch, [8, 8]);
  assert.deepEqual(trial.motors.find((m) => m.op === 'climb')?.d, [0, -8]);
  assert.equal(trial.motors.find((m) => m.op === 'climb')?.basis, 'pooled');
  const guessed = trial.motors.find((m) => m.basis === 'untested')!;
  assert.ok(guessed);
  const key = JSON.stringify(['direction', 'scene', 'actor', guessed.op, guessed.d]);
  const next = spatialControls(m, actions, 'pulse', { [key]: 3 }, 'scene', 'actor')!;
  assert.ok(!next.motors.some((m) => m.op === guessed.op && m.d.join() === guessed.d.join()));
  assert.ok(cellMatches([21, 23], [20, 24], trial.pitch));
  assert.equal(cellMatches([24, 24], [20, 24], trial.pitch), false);
});
