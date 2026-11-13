import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const contracts = readFileSync(new URL('../src/runtime/contracts.ts', import.meta.url), 'utf8');

test('main selects exactly one explicit browser Agent seam', () => {
  assert.match(main, /createPublicSingleActionBrowserCampaignHost/);
  assert.match(main, /new V6AgentModeController\(\{/);
  assert.match(main, /seam: 'browser-common-campaign'/);
  assert.match(main, /host: createPublicSingleActionBrowserCampaignHost\(\)/);
  assert.doesNotMatch(main, /V6CommonCampaignDecisionPort|v6-agent-worker/);
});

test('Agent campaign starts only from the explicit Agent control', () => {
  assert.match(main, /id=\"run-agent\"/);
  assert.match(main, /#run-agent'\)\.addEventListener\('click', \(\) => \{ void runAgent\(\); \}\)/);
  assert.match(main, /if \(mode !== 'agent' \|\| !observation \|\| !ready\(\)\) return/);
  assert.match(main, /agentModeController\.runUntilStop\(\{/);
  const setMode = main.slice(main.indexOf('function setMode'), main.indexOf('async function selectGame'));
  assert.doesNotMatch(setMode, /runAgent\(/);
});

test('Manual and game-selection ownership cancel the Agent without sharing a loop', () => {
  assert.match(main, /agentModeController\.stop\('manual'\)/);
  assert.match(main, /agentModeController\.stop\('game-change'\)/);
  assert.match(main, /if \(!ready\(\) \|\| mode !== 'manual'\) return/);
  assert.match(main, /dispatchProductAction\(state, action, data/);
});

test('Agent availability is honest about the bounded OP28 preview', () => {
  assert.match(contracts, /available: true/);
  assert.match(contracts, /browser-common-campaign-op28-preview/);
  assert.match(main, /stops instead of guessing/);
  assert.match(main, /no symbolic owner proposed an action/);
});
