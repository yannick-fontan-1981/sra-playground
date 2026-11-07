import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { nativeProgramDescriptions } from '../src/logos-engine/v6-src-program.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';

const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-ordered-support-reference.json', import.meta.url), 'utf8')).session;
function packet(value: NativePublicObservation, stepIndex: number) {
  return { frame: value.frame_rows, frames: value.frame_packet, state: value.state, level: value.level, levelsCompleted: value.levels_completed,
    availableActionIds: value.available_action_refs.map(action => Number(action.slice(6))), stepIndex };
}

test('real WHY/ACT, transition acquisition and post-analysis are retained in the same executable graph', async () => {
  const runtime = await createNativeV6Runtime(declarations), service = new V6AgentService(() => runtime);
  let result = await service.handle({ type: 'init', sessionId: 'actual-authority', sequence: 0,
    observation: packet(fixture.initial.public, 0), budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600] } });
  const initial = runtime.inspectKnowledge(), initialSnapshot = result.snapshot as Record<string, any>;
  assert.equal(result.kind, 'action');
  assert.equal(initialSnapshot.whyAct.decision.decision.status, 'action_set_released');
  assert.equal(initialSnapshot.whyAct.decision.decision.model_calls.length, 0);
  assert.equal(initialSnapshot.proposal.material_access_subquestion, 'ordered_support_transfer');
  assert.equal(initialSnapshot.srcDecision.workflow, 'v6.composition_strategy.choose');
  assert.ok(initial.nodes['program:prototype.laya_router.route']);
  assert.ok(initial.nodes['reasoning:prediction:1']);
  let sequence = 0;
  for (const step of fixture.transitions[0].steps) {
    sequence += 1;
    result = await service.handle({ type: 'advance', sessionId: 'actual-authority', sequence, ticketId: result.ticket!.id,
      observation: packet(step.afterPublic, sequence), executionMs: 0 });
  }
  assert.equal(result.kind, 'boundary');
  const acquired = runtime.inspectKnowledge();
  assert.equal(acquired.nodes['reasoning:catalog'], initial.nodes['reasoning:catalog'], 'The unchanged normative catalog is structurally shared');
  for (let revision = 1; revision <= sequence; revision += 1) assert.ok(acquired.nodes[`reasoning:transition:${revision}`]);
  const read = (id: string) => hydrateNativeState(acquired.nodes[id]!.value!, ref => acquired.nodes[ref]!.value) as Record<string, any>;
  const index = read('reasoning:memory'), memory = { facts: index.facts.map(read), traces: index.traces.map(read) }, prefix = read('prefix_evidence:1');
  assert.ok(memory.facts.some((fact: any) => fact.key === 'empirical_registry' && fact.value.length > 0));
  assert.ok(memory.traces.length > 1, 'The actual post-prefix WHY/ACT reports are retained');
  assert.equal(prefix.composed_reconciliation.executed_prefix_count, sequence);
  assert.equal(prefix.composed_reconciliation.evidence_storage, 'versioned_kernel_nodes');
  assert.ok(prefix.composed_reconciliation.transition_refs.every((ref: any) => acquired.nodes[ref.node]));
  assert.equal((result.snapshot as Record<string, any>).coverage.fullV6Parity, false);

  // Change the actual WHY/ACT program at a sealed boundary. The same runtime
  // must read the new node and withhold the next command despite a valid plan.
  const workflow = 'prototype.laya_router.route';
  const module = structuredClone(nativeProgramDescriptions().find(program => program.id === workflow)!.module);
  let replaced = 0;
  function edit(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(edit); return; }
    const record = value as Record<string, unknown>;
    if (record.kind === 'call' && record.value === 'prototype.unique') { record.value = 'prototype.abstain'; replaced += 1; }
    Object.values(record).forEach(edit);
  }
  edit(module); assert.equal(replaced, 1);
  const changed = await service.handle({ type: 'edit', sessionId: 'actual-authority', sequence,
    edit: { expectedGraphChain: result.snapshot.graphChain!, reason: 'Require explicit abstention at WHY/ACT', changes: [{ type: 'replace_program', programId: workflow, module }] } });
  assert.notEqual(changed.snapshot.graphChain, acquired.chain);
  const next = await service.handle({ type: 'resume', sessionId: 'actual-authority', sequence });
  assert.equal(next.kind, 'stopped'); assert.equal(next.command, null); assert.equal(next.ticket, null);
  assert.equal(next.snapshot.actions, sequence);
  assert.equal((next.snapshot as Record<string, any>).whyAct.decision.decision.status, 'abstained');
  assert.equal(runtime.inspectKnowledge().nodes[`program:${workflow}`]!.revision, 2);
});
