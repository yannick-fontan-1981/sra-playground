import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';

type R = Record<string, any>;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-morphology-measurements-reference.json.gz', import.meta.url))).toString());

/** A finite synthetic public protocol, not an ARC game or a scored campaign.
 * Its only response moves the square drawn by the morphology fixture builder.
 * The agent receives pixels and public inputs, with no roles, history, decision,
 * route, expected direction, method or solver state supplied to it.
 */
function publicProtocol() {
  const seed: number[][] = fixture.scenes[fixture.family.current].rows;
  let rows: number[][] = Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, x) => seed[y]?.[x] ?? 0)), stepIndex = 0;
  const packet = () => ({ frame: structuredClone(rows), frames: [structuredClone(rows)],
    availableActionIds: [1, 2, 3, 4, 5], state: 'NOT_FINISHED', level: 1, levelsCompleted: 0, stepIndex });
  return {
    observe: packet,
    step(command: R) {
      assert.ok([1, 2, 3, 4, 5].includes(Number(command.actionRef.slice(6))));
      assert.deepEqual(command.data ?? {}, {});
      const square: [number, number][] = [];
      for (const [y, row] of rows.entries()) for (const [x, value] of row.entries()) if (value === 9) square.push([x, y]);
      assert.equal(square.length, 4, 'The public fixture contains one two-by-two square');
      const next = rows.map(row => [...row]);
      for (const [x, y] of square) next[y]![x] = 0;
      for (const [x, y] of square) { assert.equal(next[y]![x + 2], 0); next[y]![x + 2] = 9; }
      rows = next; stepIndex += 1;
      return packet();
    },
  };
}

test('real morphology, common strategy and WHY/ACT acquire unused control then release a witnessed replication from pixels alone', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const service = new V6AgentService(() => runtime), protocol = publicProtocol(), sessionId = 'synthetic-control-attention-kernel';
  let result = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: protocol.observe(), budgets: { targetLevels: 3, levelActionCaps: [20, 20, 20] } });
  const read = (id: string): R => {
    const graph = runtime.inspectKnowledge();
    return hydrateNativeState(graph.nodes[id]!.value!, key => graph.nodes[key]!.value) as R;
  };
  assert.equal(result.kind, 'action');
  let proposal = result.snapshot.proposal as R;
  assert.equal(proposal.strategy_receipt.selected, 'acquire_control_for_target');
  assert.equal(proposal.morphology.status, 'retained');
  assert.equal(proposal.morphology.reason, 'control_not_currently_attested');
  assert.equal(proposal.morphology.route_key, null);
  assert.equal(proposal.question.control_acquisition.experiment, 'sample_unused_control');
  const released = (result.snapshot.trace as R[]).find(event => event.kind === 'sic_native_plan');
  assert.equal(released?.missingControl?.id, 'test_missing_control');
  assert.equal(released?.missingControl?.action, proposal.actions[0].action_ref);
  assert.equal(released?.missingControl?.agenda?.applicability, 'applicable');
  assert.equal(released?.missingControl?.agenda?.result, 'selected');
  assert.ok(released?.missingControl?.evidence.includes(proposal.binding.observation_ref));
  assert.equal(proposal.question.control_acquisition.pair_ref, proposal.morphology.measured_facts.pair_ref);
  assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
  assert.deepEqual((result.snapshot.whyAct as R).decision.decision.model_calls, []);
  assert.equal(read('caller:goal').episode.length, 0, 'No synthetic history is injected into the runtime');
  assert.equal(proposal.actions.length, 1);
  const initialDecision = structuredClone(proposal.morphology);
  const command = structuredClone(result.command);

  result = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: result.ticket!.id,
    observation: protocol.step(command!), executionMs: 0 });
  assert.equal(result.kind, 'boundary');
  assert.equal(result.snapshot.actions, 1);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 1);
  const first = read('reasoning:transition:1');
  assert.equal(first.command.action_ref, command!.actionRef);
  assert.ok(first.caller_acquisition);
  assert.equal(read('caller:goal').episode.length, 1);
  assert.equal(Object.keys(read('caller:frontier').edges).length, 1);
  assert.deepEqual((result.snapshot.whyAct as R).analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);

  result = await service.handle({ type: 'resume', sessionId, sequence: 1 });
  assert.equal(result.kind, 'action');
  proposal = result.snapshot.proposal as R;
  assert.equal(proposal.strategy_receipt.selected, 'acquire_control_for_target');
  assert.equal(proposal.question.control_acquisition.experiment, 'replicate_translation');
  assert.equal(proposal.question.control_acquisition.action_ref, command!.actionRef);
  assert.ok(Object.values(proposal.question.control_acquisition.expected_motion).some(value => JSON.stringify(value) === '[2,0]'));
  assert.notEqual(proposal.morphology.measured_facts.observation_ref, initialDecision.measured_facts.observation_ref,
    'The retained result is measured for the new choice, rather than restored as a historical decision');
  assert.equal(proposal.question.control_acquisition.pair_ref, initialDecision.measured_facts.pair_ref);
  assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
  assert.equal(proposal.actions.length, 1, 'The replication is one guarded experiment');
  result = await service.handle({ type: 'advance', sessionId, sequence: 2, ticketId: result.ticket!.id,
    observation: protocol.step(result.command!), executionMs: 0 });
  assert.equal(result.kind, 'boundary');
  assert.equal(read('caller:goal').episode.length, 2);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 2);
  assert.equal(result.snapshot.actions, 2);
  assert.equal(result.snapshot.levelsCompleted, 0, 'Synthetic integration is not reported as an ARC level success');
});
