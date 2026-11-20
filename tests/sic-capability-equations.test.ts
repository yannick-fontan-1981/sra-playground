import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOperator,
  compose,
  inverse,
  inferCapability,
  translation,
} from '../src/sic/capability-equations.ts';
import { proposeCapability } from '../src/sic/derive-capabilities.ts';
import { initialMemory, recordExperiment, type Experiment } from '../src/sic/preparation-experiments.ts';
import type { NativeObservation, NativeEntity } from '../src/logos-engine/v6-native-types.ts';
import type { XY } from '../src/sic/access-terrain.ts';
test('solves for the missing effect, including noncommuting substitutions on three roles', () => {
  const p = {
    source: [1, 2, 0],
    offset: [
      [1, 0],
      [0, 2],
      [-1, -2],
    ] as XY[],
  };
  const u = translation([
    [3, 1],
    [0, 0],
    [0, 0],
  ]);
  const x = inferCapability(p, u);
  assert.deepEqual(compose(x, p), compose(p, u));
  assert.deepEqual(x.offset, [
    [0, 0],
    [3, 1],
    [0, 0],
  ]);
  assert.deepEqual(
    compose(p, inverse(p)),
    translation([
      [0, 0],
      [0, 0],
      [0, 0],
    ])
  );
  assert.throws(() =>
    inverse({
      source: [0, 0],
      offset: [
        [0, 0],
        [0, 0],
      ],
    })
  );
});
const rows = Array.from({ length: 12 }, () => Array(15).fill(0) as number[]);
function sample(ops: string[], positions: XY[]) {
  const m = initialMemory(1);
  const obs = (ps: XY[], rev: number): NativeObservation => ({
    revision: rev,
    level_epoch: 1,
    frame_hash: JSON.stringify(ps),
    observation_ref: 'rev:' + rev,
    coordinate_basis: 'screen',
    available_action_refs: ops,
    state: 'PLAY',
    levels_completed: 0,
    unknowns: [],
    provenance: 'test',
    entities: ps.map(
      ([x, y], i): NativeEntity => ({
        id: 'role' + i,
        signature: 'role' + i,
        position: [x, y],
        bbox: [x, y, x, y],
        area: 1,
        scale: 1,
        mask: [[0, 0]],
        palette_value: i + 1,
        rectangular: true,
        identity_ambiguous: false,
        identity_scope: 'visual',
      })
    ),
  });
  let o = obs(positions, 0);
  function run(op: string, next: XY[], exp?: Experiment) {
    const a = obs(next, o.revision + 1);
    const out = recordExperiment(m, o, a, { action_ref: op, data: {} }, rows, rows, exp);
    o = a;
    return out;
  }
  const pick = () => proposeCapability(m, o, rows, new Set(ops), m.revisionScene[o.revision]!)!;
  return { m, run, pick, observe: () => o };
}
test('proposes moving the previously fixed role, predicts what stays put, and verifies the complete program', () => {
  const { m, run, pick } = sample(
    ['exchange', 'right', 'left'],
    [
      [2, 3],
      [8, 3],
    ]
  );
  run('right', [
    [2, 3],
    [9, 3],
  ]);
  run('left', [
    [2, 3],
    [8, 3],
  ]);
  run('exchange', [
    [8, 3],
    [2, 3],
  ]);
  run('exchange', [
    [2, 3],
    [8, 3],
  ]);
  let x = pick();
  assert.ok(x.equation!.claim.newPrimitive);
  const c = x.equation!.claim;
  assert.equal(c.kind, 'remote');
  assert.deepEqual(c.effect.offset[1], [0, 0]);
  assert.deepEqual(c.goal, applyOperator(c.effect, c.initial));
  for (let j = 0; j < c.program.length; j++) {
    const step = c.program[j]!;
    assert.equal(x.b, step.op);
    const out = run(step.op, step.after, x);
    if (j === c.program.length - 1) assert.equal(out!.result, 'derived_capability_verified');
    else x = pick();
  }
  assert.ok(m.equations.learned[c.basis]);
});
test('an actually blocked motion licenses a detour prediction, cancelled on its first wrong premise', () => {
  const { m, run, pick } = sample(['north', 'south', 'east', 'west'], [[2, 4]]);
  run('east', [[2, 4]]);
  run('north', [[2, 3]]);
  run('east', [[3, 3]]);
  run('west', [[2, 3]]);
  run('south', [[2, 4]]);
  const x = pick(),
    c = x.equation!.claim;
  assert.deepEqual(x, JSON.parse(JSON.stringify(x)));
  assert.equal(c.kind, 'bypass');
  assert.equal(c.control, 'east');
  assert.deepEqual(c.goal, [[3, 4]]);
  assert.deepEqual(
    c.program.map((s) => s.op),
    ['north', 'east', 'south']
  );
  assert.equal(run('north', [[2, 4]], x)?.result, 'capability_prediction_refuted');
  assert.deepEqual(m.equations.learned, {});
  assert.equal(m.equations.active, null);
});
