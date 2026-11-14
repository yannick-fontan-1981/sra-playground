/** Existing common-path capability, exercised through the real browser
 * controller, service, runtime and point guard. The family and public frames are
 * a declared synthetic contract, not a game policy or a WEAV continuation. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeFamily, NativeRecord } from '../src/logos-engine/v6-native-types.ts';
import { BrowserV6Agent } from '../src/runtime/v6-agent.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import type { AgentAction } from '../src/runtime/contracts.ts';
import type { V6AgentOperation, V6AgentResult, V6AgentTransport } from '../src/runtime/v6-agent-protocol.ts';

type Change = 'none' | 'point' | 'availability' | 'guard' | 'mismatch' | 'boundary';
type Recorded = { index: number; command: NativeCommand; before: number; after: number };
const POINT = [9, 8] as const;

class Deferred {
  readonly promise: Promise<void>;
  resolve!: () => void;
  constructor() { this.promise = new Promise<void>(resolve => { this.resolve = resolve; }); }
}

function publicFrame(marker: number, change: Change = 'none'): GameObservation {
  const frame = Array.from({ length: 64 }, () => Array<number>(64).fill(0));
  frame[0]![0] = marker;
  frame[POINT[1]]![POINT[0]] = change === 'point' ? 9 : 7;
  return { gameCode: 'SYNTHETIC_PUBLIC_PATH', frame, frames: [frame], state: 'NOT_FINISHED',
    availableActionIds: change === 'availability' ? [1, 2] : [1, 2, 6],
    level: change === 'boundary' ? 2 : 1, levelsCompleted: change === 'boundary' ? 1 : 0,
    levelCount: 3, canUndo: false, canSelectLevel: false, defaultFps: 10 };
}

function harness(change: Change = 'none', pauseFirst = false) {
  let current = publicFrame(0), clock = 0, proposals = 0;
  const records: Recorded[] = [], beforeGuards: number[] = [], afterGuards: number[] = [];
  const commands: NativeCommand[] = [{ action_ref: 'ACTION1', data: {} },
    { action_ref: 'ACTION6', data: { x: POINT[0], y: POINT[1] } }, { action_ref: 'ACTION2', data: {} }];
  const family: NativeFamily = {
    id: 'synthetic_measured_mixed_path',
    async propose(observation, rows) {
      if (records.length) return null;
      proposals++;
      const locus = await ObservedInputDomain.makeLocusWitness(observation, rows, POINT,
        { reason: 'Synthetic contract retains this measured public pixel between its first two commands.',
          evidence: [observation.observation_ref] });
      return { status: 'proposed', kind: 'synthetic_guarded_mixed_path', actions: structuredClone(commands),
        steps: [{}, { locus_witness: locus }, {}] };
    },
    before(_proposal, index, packet, observation) {
      beforeGuards.push(index);
      const admitted = packet.frame_rows[0]![0] === index && observation.level_epoch === 1
        && !(change === 'guard' && index === 2);
      return { admitted, reason: admitted ? 'synthetic_current_step_witness' : 'synthetic_step_witness_refuted' };
    },
    after(_proposal, index, _before, _after, _first, second) {
      afterGuards.push(index);
      const matched = second[0]![0] === index + 1;
      return { matched, seal_prefix: !matched || index === 2,
        reason: matched ? 'synthetic_public_return_matched' : 'synthetic_public_return_refuted' };
    },
    record(_before, _after, command, first, second, _proposal, index) {
      const event = { index, command: structuredClone(command), before: first[0]![0]!, after: second[0]![0]! };
      records.push(event);
      return { events: [event] };
    },
    state: () => ({ recorded: structuredClone(records) }),
    restore(state) { records.splice(0, records.length, ...structuredClone(state.recorded as Recorded[])); },
  };
  const runtime = new NativeV6Runtime({ families: [family], maxPointOccurrences: 250,
    sourceDigest: 'synthetic-existing-mixed-path-contract', now: () => clock });
  const service = new V6AgentService(() => runtime);
  const operations: V6AgentOperation[] = [], results: V6AgentResult[] = [], dispatched: AgentAction[] = [];
  const transport: V6AgentTransport = {
    async request(operation) {
      operations.push(structuredClone(operation));
      const result = await service.handle(operation);
      results.push(result); return result;
    },
    reset() { assert.fail('A guarded path must never reset its acquired state automatically'); },
    dispose() {},
  };
  const entered = new Deferred(), release = new Deferred();
  const agent = new BrowserV6Agent({ transport, getObservation: () => current, canDispatch: () => true,
    onState() {}, dispatch: async action => {
      dispatched.push(structuredClone(action));
      if (pauseFirst && dispatched.length === 1) { entered.resolve(); await release.promise; }
      const mark = change === 'mismatch' && dispatched.length === 2 ? 9 : dispatched.length;
      const appliedChange = dispatched.length === 1 && ['point', 'availability', 'boundary'].includes(change) ? change : 'none';
      current = publicFrame(mark, appliedChange);
      return { observation: current, executionMs: 0.5 };
    } });
  return { agent, runtime, operations, results, dispatched, records, beforeGuards, afterGuards, commands,
    entered, release, proposalCount: () => proposals, elapsePausedTime: () => { clock += 3_600_000; } };
}

function trace(state: ReturnType<typeof harness>): NativeRecord[] {
  return state.runtime.snapshot().trace as NativeRecord[];
}
function assertAcquiredOnce(state: ReturnType<typeof harness>, count: number): void {
  assert.equal(state.dispatched.length, count);
  assert.deepEqual(state.records.map(record => record.index), Array.from({ length: count }, (_, i) => i));
  assert.deepEqual(state.records.map(record => record.command), state.commands.slice(0, count));
  assert.equal(state.operations.filter(operation => operation.type === 'advance').length, count);
  assert.equal(state.runtime.snapshot().actions, count);
  assert.deepEqual(state.agent.snapshot.sicActionCoverage, { contactRecovery: 0, configurableFrontier: 0, fixedFrontier: 0, viewAccess: 0, native: count });
  assert.equal(state.runtime.snapshot().cycles, 1);
  assert.equal(trace(state).filter(event => event.kind === 'actual_outcome').length, count);
  const released = trace(state).filter(event => event.kind === 'sic_native_plan');
  assert.equal(released.length, 1);
  assert.deepEqual(released[0]!.commands, state.commands);
  assert.ok(trace(state).filter(event => event.kind === 'actual_outcome').every(event => event.sic_plan === released[0]!.id));
  const graph = state.runtime.inspectKnowledge();
  const evidence = Object.values(graph.nodes).filter(node => node.kind === 'prefix_evidence');
  assert.equal(evidence.length, 1);
  const persisted = hydrateNativeState(evidence[0]!.value, id => graph.nodes[id]?.value) as NativeRecord;
  const { kind, command, commands, ...receipt } = released[0]!;
  assert.equal(kind, 'sic_native_plan');
  assert.deepEqual(persisted.sic_plan, receipt);
  assert.deepEqual(persisted.proposal.actions, commands);
  assert.deepEqual(persisted.proposal.actions[persisted.sic_plan.index], command);
  assert.equal(trace(state).filter(event => event.kind === 'sealed_prefix').length, 1);
  assert.notEqual(state.agent.snapshot.status, 'error', state.agent.snapshot.message);
}

test('a mixed key/click/key prefix survives Pause and resumes its current ticket without replanning', async () => {
  const state = harness('none', true), running = state.agent.run(3);
  await state.entered.promise;
  state.agent.pause(); state.release.resolve(); await running;
  assert.equal(state.dispatched.length, 1);
  assert.equal(state.agent.snapshot.paused, true);
  assert.deepEqual(state.agent.snapshot.pendingAction, { id: 6, data: { x: POINT[0], y: POINT[1] } });
  assert.deepEqual(state.beforeGuards, [0, 1]);
  assert.deepEqual(state.afterGuards, [0]);
  assert.deepEqual(state.records, [], 'The observed return is retained in the open prefix; family reduction happens once at sealing');
  const clickTicket = state.results.at(-1)!.ticket!;
  assert.equal(clickTicket.actionIndex, 1);
  assert.equal(state.runtime.snapshot().activeSeconds, 0.0005);
  state.elapsePausedTime();
  await state.agent.run(2);
  assertAcquiredOnce(state, 3);
  assert.deepEqual(state.dispatched, [{ id: 1 }, { id: 6, data: { x: POINT[0], y: POINT[1] } }, { id: 2 }]);
  assert.deepEqual(state.beforeGuards, [0, 1, 2]);
  assert.deepEqual(state.afterGuards, [0, 1, 2]);
  assert.equal(state.proposalCount(), 1);
  assert.equal(state.operations.filter(operation => operation.type === 'init').length, 1);
  assert.equal(state.operations.filter(operation => operation.type === 'resume').length, 0);
  const advances = state.operations.filter(operation => operation.type === 'advance');
  assert.equal(advances[1]!.ticketId, clickTicket.id, 'Pause preserves the authorized click ticket');
  assert.equal(new Set(advances.map(operation => operation.ticketId)).size, 3);
  assert.equal(state.runtime.snapshot().activeSeconds, 0.0015);
  assert.equal(trace(state).find(event => event.kind === 'before_guard' && event.index === 1)!.point_bound, true);
});

test('the current point guard refuses a changed click target before any click is dispatched', async () => {
  const state = harness('point');
  await state.agent.run(1);
  assertAcquiredOnce(state, 1);
  assert.equal(state.agent.snapshot.pendingAction, null);
  const guard = trace(state).find(event => event.kind === 'before_guard' && event.index === 1)!;
  assert.equal(guard.admitted, true, 'The synthetic family cannot override the separate current-pixel binding');
  assert.equal(guard.point_bound, false);
});

test('loss of the next public action stops a mixed prefix after acquiring the engaged action', async () => {
  const state = harness('availability');
  await state.agent.run(1);
  assertAcquiredOnce(state, 1);
  assert.deepEqual(state.beforeGuards, [0]);
  assert.equal(state.agent.snapshot.pendingAction, null);
});

test('a later family before-guard is required even after a successful key and click', async () => {
  const state = harness('guard');
  await state.agent.run(2);
  assertAcquiredOnce(state, 2);
  assert.deepEqual(state.beforeGuards, [0, 1, 2]);
  assert.equal(state.agent.snapshot.pendingAction, null);
  assert.equal(trace(state).find(event => event.kind === 'before_guard' && event.index === 2)!.admitted, false);
});

test('a mismatched public click return acquires the actual result and seals before the next key', async () => {
  const state = harness('mismatch');
  await state.agent.run(2);
  assertAcquiredOnce(state, 2);
  assert.deepEqual(state.beforeGuards, [0, 1]);
  assert.deepEqual(state.afterGuards, [0, 1]);
  assert.equal(state.records[1]!.after, 9);
  assert.equal(state.agent.snapshot.pendingAction, null);
  assert.equal(trace(state).find(event => event.kind === 'actual_outcome' && event.index === 1)!.matched, false);
});

test('a natural level boundary seals and acquires the executed prefix without sending its remaining click or key', async () => {
  const state = harness('boundary');
  await state.agent.run(3);
  assertAcquiredOnce(state, 1);
  assert.deepEqual(state.beforeGuards, [0]);
  assert.deepEqual(state.afterGuards, [0]);
  assert.equal(state.agent.snapshot.levelsCompleted, 1);
  assert.equal(state.agent.snapshot.level, 2);
  assert.equal(state.agent.snapshot.pendingAction, null);
  assert.equal(state.agent.snapshot.paused, true);
  assert.equal(state.operations.filter(operation => operation.type === 'resume').length, 0);
});
