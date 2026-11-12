import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('main routes product actions through the shared dispatch contract', () => {
  assert.match(main, /from '\.\/agent-product-dispatch'/);
  assert.match(main, /return productReady\(productReadinessState\(\)\)/);
  assert.match(main, /dispatchProductAction\(state, action, data/);
  assert.doesNotMatch(main, /void run\(\(\) => runtime\.action\(action, data\)\)/);
});

test('dispatch presentation keeps busy held until the dispatch releases it', () => {
  assert.match(main, /async function present\(next: GameObservation, selectedGeneration: number, releaseBusy = true\)/);
  assert.match(main, /if \(releaseBusy\) \{\s*busy = false;\s*updateInterface\(\);\s*\}/s);
  assert.match(main, /present: \(next, generation\) => present\(next, generation, false\)/);
});


test('main product dispatch preserves GameObservation typing without an assertion cast', () => {
  assert.match(main, /present: \(next, generation\) => present\(next, generation, false\)/);
  assert.doesNotMatch(main, /next as GameObservation/);
});
