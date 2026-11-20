import test from 'node:test';
import assert from 'node:assert/strict';
import type { NativeEntity, NativeObservation } from '../src/logos-engine/v6-native-types.ts';
import { initialMemory, recordExperiment } from '../src/sic/preparation-experiments.ts';
import { proposeAccess } from '../src/sic/spatial-access.ts';
import { accessLaws, landing } from '../src/sic/spatial-access-laws.ts';

const ops = new Set(['right', 'left', 'transfer']);
const rows = [Array(16).fill(0) as number[]];
function scene(a: number, b: number, revision: number, ambiguous = false): NativeObservation {
  const entity = (id: string, x: number): NativeEntity => ({
    id,
    signature: id,
    position: [x, 0],
    bbox: [x, 0, x, 0],
    mask: [[0, 0]],
    area: 1,
    scale: 1,
    palette_value: 1,
    rectangular: true,
    identity_ambiguous: ambiguous && id === 'marker',
    identity_scope: 'test',
  });
  return {
    revision,
    level_epoch: 1,
    frame_hash: a + '/' + b,
    observation_ref: 'r' + revision,
    coordinate_basis: 'screen',
    entities: [entity('traveler', a), entity('marker', b)],
    available_action_refs: [...ops],
    state: 'PLAY',
    levels_completed: 0,
    unknowns: [],
    provenance: 'observed',
  };
}
function sample() {
  const m = initialMemory(1);
  let o = scene(2, 7, 0);
  function act(op: string, a: number, b: number, x?: ReturnType<typeof proposeAccess>) {
    const next = scene(a, b, o.revision + 1);
    const outcome = recordExperiment(m, o, next, { action_ref: op, data: {} }, rows, rows, x ?? undefined);
    o = next;
    return outcome;
  }
  act('right', 2, 8);
  act('left', 2, 7);
  act('transfer', 7, 2);
  act('transfer', 2, 7);
  return { m, act, current: () => o };
}
test('inverts a witnessed exchange and ranks unseen destination configurations before execution', () => {
  const { m, act, current } = sample();
  const l = accessLaws(m, new Set(['traveler', 'marker']), ops).find(
    (x) => x.kind === 'anchor' && x.actor === 'traveler'
  )!;
  assert.ok(l.reciprocal);
  assert.deepEqual(landing(l, [2, 0], [11, 0]), [11, 0]);
  const pick = () => proposeAccess(m, current(), rows, ops, m.revisionScene[current().revision]!)!;
  const first = pick();
  assert.equal(first.phase, 'accessSetup');
  const choice = first.access!.card;
  assert.ok(first.access!.alternatives.length);
  assert.ok(first.access!.alternatives.every((c) => Number(c.score) <= choice.score));
  assert.ok(choice.interest);
  assert.deepEqual(Object.keys(m.space.confirmed), []);
  let x = first;
  while (x.phase === 'accessSetup') {
    const leg = x.access!.card.legs[x.access!.step]!;
    const a = leg.p[0],
      b = leg.q[0];
    assert.equal(x.access!.card.law.actor, 'traveler');
    assert.equal(act(leg.op, a, b, x)?.result, 'layout_step_verified');
    x = pick();
  }
  const src = current().entities[0]!.position[0];
  assert.equal(act(x.b, choice.destination[0], src, x)?.result, 'predicted_landing_verified');
  assert.equal(Object.values(m.space.confirmed).length, 1);
  assert.equal(pick().phase, 'accessContinue');
});
test('a refuted imagined placement is never registered as access', () => {
  const { m, act, current } = sample();
  const x = proposeAccess(m, current(), rows, ops, m.revisionScene[current().revision]!)!;
  assert.equal(act(x.b, 2, 7, x)?.result, 'layout_step_refuted');
  assert.equal(Object.keys(m.space.confirmed).length, 0);
  assert.equal(m.space.active, null);
  assert.ok(Object.keys(m.space.blocked).length);
});
test('a missing or ambiguous landmark cannot license a landmark-relative plan', () => {
  const { m, current } = sample(),
    o = scene(2, 7, current().revision, true);
  assert.notEqual(
    proposeAccess(m, o, rows, ops, m.revisionScene[o.revision]!)?.access?.card.law.kind,
    'anchor'
  );
});
