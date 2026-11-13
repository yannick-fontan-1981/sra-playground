import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';

type R = Record<string, any>;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;

test('the real common runtime retains shared state through the opt-in immutable path', async () => {
  const oracle = JSON.parse(await readFile(new URL('./fixtures/v6-native-caller/memo-first-prefix.json', import.meta.url), 'utf8'));
  const from = (ref: R): R => oracle.objects[ref.$object];
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  // Test-only instrumentation of the actual registered provider, never a
  // replacement family or an injected game action.
  const family = (runtime as unknown as { families: NativeFamily[] }).families.find(item => item.id === 'public_occurrence_recall')!;
  assert.ok(family.nativeState); assert.ok(family.restoreNative);
  const state = family.state.bind(family), nativeState = family.nativeState.bind(family), restoreNative = family.restoreNative.bind(family);
  let publicReads = 0, nativeReads = 0;
  const restorations: Readonly<R>[] = [];
  family.state = () => { publicReads++; return state(); };
  family.nativeState = () => { nativeReads++; return nativeState(); };
  family.restoreNative = value => { restorations.push(value); restoreNative(value); };
  const service = new V6AgentService(() => runtime), sessionId = from(oracle.snapshots[0].observation).observation_ref.split(':epoch:')[0];
  let result = await service.handle({ type: 'init', sessionId, sequence: 0, observation: oracle.publicProtocol.events[0].observation, budgets: oracle.budgets });
  assert.equal(result.kind, 'action');
  for (const [index, step] of oracle.publicProtocol.events.slice(1).entries()) {
    assert.deepEqual(result.command, step.command);
    result = await service.handle({ type: 'advance', sessionId, sequence: index + 1, ticketId: result.ticket!.id,
      observation: step.observation, executionMs: 0 });
  }
  assert.equal(result.kind, 'boundary');
  assert.equal(publicReads, 0, 'Initialization, retention and checkpointing must use the opt-in path');
  assert.ok(nativeReads >= 4); assert.ok(restorations.length >= 3);
  for (const value of restorations) {
    assert.equal(Object.isFrozen(value), true);
    assert.equal(Object.isFrozen(value.events), true);
  }
  const graph = runtime.inspectKnowledge(), read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  const stored = read('family_state:public_occurrence_recall');
  assert.deepEqual(stored, state());
  const facts = (read('reasoning:memory').facts as string[]).map(read);
  const retained = facts.find(fact => fact.key === 'repeated_series_state')!;
  assert.deepEqual(retained.value, stored, 'The exact source fact is still written at acquisition');
  const expected = from(oracle.snapshots.find((snapshot: R) => snapshot.stage === 'prefix_analyzed').memory).facts
    .find((fact: R) => fact.key === 'repeated_series_state');
  assert.equal(retained.evidence, expected.evidence); assert.equal(retained.revision, expected.revision);
  assert.deepEqual(retained.value.events, expected.value.events);
});
