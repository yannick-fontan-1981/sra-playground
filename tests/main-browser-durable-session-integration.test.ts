import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('main binds durable mirrors to the browser runtime and Agent controller', () => {
  assert.match(main, /BrowserDurableSessionStore/);
  assert.match(main, /new BrowserDurableSessionStore\(window\.localStorage\)/);
  assert.match(main, /BrowserIndexedDbDurableSessionPersistence/);
  assert.match(main, /new BrowserIndexedDbDurableSessionStore\(window\.indexedDB\)/);
  assert.match(main, /createBrowserDurableSessionCheckpoint\(\{/);
  assert.match(main, /runtime: runtime\.snapshot\(\)/);
  assert.match(main, /const agent = agentController\.captureCheckpoint\(\)/);
  assert.match(main, /agentController\.clearCheckpoint\(\)/);
});

test('pagehide persists before destructive disposal', () => {
  const handler = main.match(/window\.addEventListener\('pagehide',[\s\S]*?\n\}\);/)?.[0];
  assert.ok(handler, 'pagehide handler must be present');
  const persist = handler.indexOf('persistDurableSession();');
  const controllerDispose = handler.indexOf('agentController.dispose();');
  const runtimeDispose = handler.indexOf('runtime.dispose();');
  assert.ok(persist >= 0);
  assert.ok(controllerDispose > persist);
  assert.ok(runtimeDispose > controllerDispose);
});

test('startup restores the deterministic runtime before the Agent checkpoint', () => {
  const durableBranch = main.match(/if \(durable\) \{[\s\S]*?\n    \} else \{/)?.[0];
  assert.ok(durableBranch, 'durable selectGame branch must be present');
  const runtimeRestore = durableBranch.indexOf('await runtime.restore(durable.runtime)');
  const controllerRestore = durableBranch.indexOf('agentController.restoreCheckpoint(durable.agent)');
  const presentation = durableBranch.indexOf('await present(restored.observation, generation)');
  const agentActivation = durableBranch.indexOf("setMode('agent')");
  assert.ok(runtimeRestore >= 0);
  assert.ok(controllerRestore > runtimeRestore);
  assert.ok(presentation > controllerRestore);
  assert.ok(agentActivation > presentation);
});

test('manual mutation and game replacement invalidate both durable mirrors', () => {
  assert.match(main, /async function run[\s\S]*?invalidateDurableResume\(\);/);
  assert.match(main, /function perform[\s\S]*?if \(mode === 'manual' && productReady\(state\)\) invalidateDurableResume\(\);/);
  assert.match(main, /async function selectGame[\s\S]*?else \{\s*invalidateDurableResume\(\);\s*\}/);
  assert.match(main, /durableSessionStore\?\.clear\(\);[\s\S]*?indexedDbDurableSession\?\.clear\(\)/);
});

test('a rejected durable replay falls back to a fresh game and never reuses the Agent checkpoint', () => {
  assert.match(main, /Durable browser session restore was rejected/);
  assert.match(main, /invalidateDurableResume\(\);/);
  assert.match(main, /await present\(await runtime\.load\(game\.code, level\), generation\)/);
});

test('startup chooses the newest valid checkpoint from localStorage and IndexedDB', () => {
  assert.match(main, /async function initialDurableSession/);
  assert.match(main, /durableSessionStore\?\.load\(nowMs, selectedGame\.code\)/);
  assert.match(main, /indexedDbDurableSession\?\.load\(nowMs, selectedGame\.code\)/);
  assert.match(main, /candidates\.sort\(\(left, right\) => right\.savedAtMs - left\.savedAtMs\)/);
  assert.match(main, /initialDurable\.agent\.host\.session\?\.gameObservation\.level !== initialLevel/);
  assert.match(main, /invalidateDurableResume\(\);\s*initialDurable = undefined;/);
});