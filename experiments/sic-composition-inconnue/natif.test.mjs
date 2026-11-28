import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { playNative } from './natif.mjs';
import { fixedWorkflow, onlineComposition } from './policies.mjs';
import { play } from './rejouer.mjs';

const { cases } = JSON.parse(readFileSync(new URL('./developpement.json', import.meta.url)));
const { cases: measurement } = JSON.parse(readFileSync(new URL('./mesure-armement.json', import.meta.url)));

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
