import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('main activates exactly the bounded browser campaign controller, not the Worker seam', () => {
  assert.match(main, /from '\.\/runtime\/v6-browser-agent-controller'/);
  assert.match(main, /new BrowserAgentController\(/);
  assert.match(main, /BROWSER_AGENT_CONTROLLER_STATUS\.status/);
  assert.doesNotMatch(main, /from '\.\/runtime\/v6-agent-worker'/);
  assert.doesNotMatch(main, /from '\.\/runtime\/v6-common-campaign-decision-port'/);
  assert.doesNotMatch(main, /import \{ AGENT_STATUS \}/);
});

test('Agent mode owns the controller while Manual requests a graceful handoff', () => {
  assert.match(main, /if \(next === 'manual' && agentController\.running\) agentController\.deactivate\('manual'\);/);
  assert.match(main, /if \(!manual\) startAgent\(\);/);
  assert.match(main, /agentController\.activate\(current, agentPorts\(\)\)/);
  assert.match(main, /if \(agentController\.running\) agentController\.deactivate\('replaced'\);/);
  assert.match(main, /agentController\.dispose\(\);\s*runtime\.dispose\(\);/s);
});

test('Agent ports reuse the product runtime, presentation and generation contracts', () => {
  const ports = main.match(/function agentPorts\(\): BrowserAgentControllerPorts \{[\s\S]*?\n\}/)?.[0];
  assert.ok(ports, 'agentPorts() must remain a distinct product boundary');
  assert.match(ports, /readState: productReadinessState/);
  assert.match(ports, /action: \(action, data\) => runtime\.action\(action, data\)/);
  assert.match(ports, /present: \(next, generation\) => present\(next, generation, false\)/);
  assert.match(ports, /generation: \(\) => selectionGeneration/);
  assert.match(ports, /setBusy: value => \{/);
});

test('the Agent interface states its bound and never promises or inserts a fallback action', () => {
  assert.match(main, /Bounded SRA runtime/);
  assert.match(main, /No fallback action is invented\./);
  assert.match(main, /no single complete symbolic proposal/);
  assert.doesNotMatch(main, /first non-reset available action/);
  assert.doesNotMatch(main, /planner_missing/);
});
