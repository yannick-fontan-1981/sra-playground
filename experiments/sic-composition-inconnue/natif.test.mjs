import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { playNative } from './natif.mjs';
import { fixedWorkflow, onlineComposition } from './policies.mjs';
import { play } from './rejouer.mjs';

const { cases } = JSON.parse(readFileSync(new URL('./developpement.json', import.meta.url)));
const { cases: measurement } = JSON.parse(readFileSync(new URL('./mesure-armement.json', import.meta.url)));
const { cases: markerCases } = JSON.parse(readFileSync(new URL('./transfert-reperes.json', import.meta.url)));

for (const spec of [...cases, ...measurement]) {
  test('issued V6 tickets reproduce the public terrain decisions and returns: ' + spec.id, async () => {
    for (const policy of [fixedWorkflow, onlineComposition]) {
      const native = await playNative(spec, policy);
      const reference = play(spec, policy);
      assert.deepEqual(native.moves.map(({ action, returned }) => ({ action, returned })),
        reference.steps.map(({ decision, returned }) => ({ action: decision.action, returned })));
      assert.deepEqual(native.observed, reference.stop.observed);
      assert.equal(native.nativeActions, reference.gestures);
      assert.equal(new Set(native.moves.map(move => move.ticket)).size, reference.gestures);
      assert.equal(new Set(native.moves.map(move => move.observationRef)).size, reference.gestures);
      assert.equal(native.stop?.missing, reference.stop.missing);
    }
  });
}

test('a measured native return can be reused through a newly bound public marker', async () => {
  const [source, target, ambiguous] = markerCases;
  const original = await playNative(source, onlineComposition);
  assert.equal(original.observed.outcome, 'win');
  assert.ok(original.moves.some(move => move.observationRef === original.learned.evidence.before));
  const unassisted = await playNative(target, onlineComposition);
  const assisted = await playNative(target, onlineComposition, original.learned);
  assert.equal(assisted.moves[0].action, 'z');
  assert.equal(assisted.prior.control, 'z');
  assert.equal(assisted.observed.outcome, 'win');
  assert.ok(assisted.nativeActions < unassisted.nativeActions);
  const unresolved = await playNative(ambiguous, onlineComposition, original.learned);
  assert.equal(unresolved.prior, undefined);
  assert.deepEqual(unresolved.moves.map(move => move.action), unassisted.moves.map(move => move.action));
});
