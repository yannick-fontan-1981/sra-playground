import test from 'node:test';
import assert from 'node:assert/strict';
import type { NativeCommand, NativeObservation, NativeEntity } from '../src/logos-engine/v6-native-types.ts';
import {
  initialMemory,
  selectExperiment,
  recordExperiment,
  measureEffect,
  type Experiment,
} from '../src/sic/preparation-experiments.ts';
import { proposeDerivation, carryStep, type Mark } from '../src/sic/derive-at-site.ts';
const cmd = (i: number): NativeCommand => ({ action_ref: 'ACTION' + i, data: {} });
const controls = [cmd(1), cmd(2), cmd(3)];
const rows = [[0, 0, 0, 0]];
function board(s: string, x: number, rev: number): NativeObservation {
  const actor: NativeEntity = {
    id: 'part',
    signature: 'part',
    position: [x, 0],
    bbox: [x, 0, x, 0],
    mask: [[0, 0]],
    area: 1,
    scale: 1,
    palette_value: 4,
    rectangular: true,
    identity_ambiguous: false,
    identity_scope: 'observed',
  };
  return {
    revision: rev,
    level_epoch: 1,
    frame_hash: s,
    observation_ref: 'level:revision:' + rev + ':frame:' + s,
    entities: [actor],
    available_action_refs: controls.map((c) => c.action_ref),
    coordinate_basis: 'screen',
    state: 'NOT_FINISHED',
    levels_completed: 0,
    unknowns: [],
    provenance: 'public',
  };
}
test('predicts both matched arms, then reuses the verified effect to try a new continuation', () => {
  const mem = initialMemory(1);
  let rev = 0;
  let scene = board('base', 0, rev);
  const act = (i: number, s: string, x: number, trial?: Experiment) => {
    const next = board(s, x, ++rev);
    const outcome = recordExperiment(mem, scene, next, cmd(i), rows, rows, trial);
    scene = next;
    return outcome;
  };
  const pick = () => {
    const trial = selectExperiment(mem, scene, controls, true);
    assert.ok(trial);
    return trial;
  };
  act(2, 'base', 0);
  act(1, 'ready', 0);
  act(2, 'remote', 3);
  act(3, 'base', 0);
  const control = pick();
  assert.equal(control.phase, 'confirmControl');
  assert.equal(act(2, 'base', 0, control)?.result, 'control_replicated');
  const prepare = pick();
  assert.equal(prepare.phase, 'confirmA');
  act(1, 'ready', 0, prepare);
  const probe = pick();
  assert.equal(probe.phase, 'confirmB');
  assert.equal(act(2, 'remote', 3, probe)?.result, 'prediction_confirmed');
  act(3, 'base', 0);
  const use = pick();
  assert.equal(use.phase, 'reuseA');
  act(1, 'ready', 0, use);
  assert.equal(act(2, 'remote', 3, pick())?.result, 'reused_as_predicted');
  assert.equal(pick().phase, 'explore');
});
test('a preparatory edit does not make two identical stationary B effects different', () => {
  const base = board('base', 0, 1),
    prepared = board('prepared', 0, 2);
  assert.equal(measureEffect(base, base, rows, rows).key, measureEffect(prepared, prepared, rows, rows).key);
});
test('derives an acquired movement at a different place with its own B-only control', () => {
  const memory = initialMemory(1);
  const grid = [Array<number>(12).fill(0)];
  const start = board('start', 0, 1),
    ready = board('ready', 1, 2),
    reached = board('reached', 3, 3);
  const site = board('site', 5, 4),
    placed = board('placed', 6, 5),
    end = board('new-access', 8, 6);
  const step = (before: NativeObservation, after: NativeObservation, op: number, trial?: Experiment) =>
    recordExperiment(memory, before, after, cmd(op), grid, grid, trial);
  step(start, start, 2);
  step(start, ready, 1);
  step(ready, reached, 2);
  step(site, site, 2);
  const [bare, prep, conditioned, independent] = memory.edges;
  const pair = {
    id: 'rule',
    origin: prep!.s,
    prepared: prep!.t,
    prep: 'ACTION1',
    probe: 'ACTION2',
    first: prep!,
    direct: bare!,
    after: conditioned!,
  };
  memory.rules.rule = { id: 'rule', evaluations: 1, refutations: 0, uses: 1, last: 0, verifiedAt: 3 };
  const trial = proposeDerivation(
    memory,
    site,
    grid,
    independent!.s,
    new Set(controls.map((c) => c.action_ref)),
    pair
  )!;
  assert.equal(trial.phase, 'deriveA');
  assert.equal(step(site, placed, 1, trial)?.result, 'change_recreated');
  const outcome = step(placed, end, 2, memory.pending!);
  assert.equal(outcome?.result, 'derived_prediction_verified');
  assert.equal(outcome?.enabledMotion, true);
  assert.notEqual(outcome?.trainedSite, outcome?.testSite);
});
test('a contradictory return invalidates the shared edge', () => {
  const m = initialMemory(1),
    s = board('s', 0, 1);
  recordExperiment(m, s, board('a', 1, 2), cmd(1), rows, rows);
  recordExperiment(m, s, board('b', 3, 3), cmd(1), rows, rows);
  assert.equal(m.edges[0]?.stable, false);
});
test('an inverse suggested by source traces must restore the exact new control scene', () => {
  const m = initialMemory(1),
    s = board('origin', 0, 1),
    moved = board('outward', 1, 2);
  recordExperiment(m, s, moved, cmd(1), rows, rows);
  const edge = m.edges[0]!;
  m.derivationOrigin = {
    phase: 'deriveA',
    origin: edge.s,
    a: 'ACTION3',
    b: 'ACTION1',
    rule: 'rule',
    refs: [edge.ref],
    derive: {
      kind: 'relocate',
      actor: 'part',
      site: '0,0',
      trained: '2,0',
      exterior: '',
      bareEffect: edge.effect.key,
      traveled: 0,
    },
  };
  const result = selectExperiment(m, moved, controls, true);
  assert.equal(result?.phase, 'inverse');
  assert.equal(
    recordExperiment(m, moved, board('different', 0, 3), cmd(Number(result!.a.slice(6))), rows, rows, result!)
      ?.result,
    'inverse_refuted'
  );
});

test('a transported change must survive the move and match the unprepared exterior at the new destination', () => {
  const m = initialMemory(1),
    actions = new Set(controls.map((c) => c.action_ref));
  const scene = (form: string, x: number, rev: number) => {
    const base = board(form + x, x, rev);
    const cells = [Array<number>(7).fill(0), Array<number>(7).fill(0), Array<number>(7).fill(0)];
    cells[0]![x] = form === 'bare' ? 1 : 2;
    return {
      o: { ...base, entities: base.entities.map((e) => ({ ...e, signature: form, id: form })) },
      rows: cells,
    };
  };
  const A = scene('bare', 0, 1),
    P = scene('marked', 0, 2),
    Q = scene('marked', 1, 3),
    D = scene('bare', 2, 4),
    T = scene('marked', 2, 5),
    U = scene('marked', 3, 6);
  const rec = (from: typeof A, to: typeof A, action: number, x?: Experiment) =>
    recordExperiment(m, from.o, to.o, cmd(action), from.rows, to.rows, x);
  rec(A, A, 2);
  rec(A, P, 1);
  rec(P, Q, 2);
  rec(D, D, 2);
  rec(A, D, 3);
  const [direct, first, after] = m.edges;
  const pair = {
    origin: first!.s,
    prepared: first!.t,
    prep: 'ACTION1',
    probe: 'ACTION2',
    first: first!,
    after: after!,
    direct: direct!,
    id: 'example',
  };
  const mark: Mark = { bare: 'bare', prepared: 'marked', origin: '0,0' };
  assert.deepEqual(first!.mark, mark);
  m.rules.example = { id: 'example', evaluations: 1, uses: 0, refutations: 0, last: 0, verifiedAt: 3 };
  rec(A, P, 1);
  const step = proposeDerivation(m, P.o, P.rows, first!.t, actions, pair)!;
  assert.equal(step.phase, 'carry');
  assert.equal(rec(P, T, 3, step)?.result, 'change_preserved_in_motion');
  const pending = m.pending!;
  const different = T.rows.map((r) => [...r]);
  different[2]![6] = 9;
  assert.equal(carryStep(m, T.o, different, actions, pending), null);
  const testAtDestination = carryStep(m, T.o, T.rows, actions, pending)!;
  assert.equal(testAtDestination.phase, 'carryB');
  const result = rec(T, U, 2, testAtDestination);
  assert.equal(result?.result, 'transport_prediction_verified');
  assert.equal(result?.enabledMotion, true);
  assert.equal(result?.trainedSite, '0,0');
  assert.equal(result?.testSite, '2,0');
});
