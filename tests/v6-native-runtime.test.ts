import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { BrowserV6Agent } from '../src/runtime/v6-agent.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { emptyV6Snapshot, toV6PublicObservation, V6_REFERENCE_COMMIT } from '../src/runtime/v6-agent-protocol.ts';
import type { V6AgentOperation, V6AgentTransport } from '../src/runtime/v6-agent-protocol.ts';
import type {
  NativeCommand, NativeExecution, NativeFamily, NativeInitialize, NativeOutcome, NativePublicObservation,
  NativeRuntimeSnapshot, NativeRuntimeYield, NativeV6Backend,
} from '../src/logos-engine/v6-native-types.ts';

const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const ordered = JSON.parse(await readFile(new URL('./fixtures/v6-ordered-support-reference.json', import.meta.url), 'utf8'));
const fields = JSON.parse(await readFile(new URL('./fixtures/v6-field-reference.json', import.meta.url), 'utf8'));

function board(pixel = 0): GameObservation {
  const frame = Array.from({ length: 64 }, () => Array<number>(64).fill(pixel));
  return { gameCode: 'PUBLIC', frame, frames: [frame], state: 'NOT_FINISHED', availableActionIds: [1, 6],
    level: 1, levelCount: 3, levelsCompleted: 0, canUndo: false, canSelectLevel: true, defaultFps: 10 };
}
function gamePacket(packet: NativePublicObservation, code: string): GameObservation {
  return { gameCode: code, frame: packet.frame_rows.map(row => [...row]), frames: packet.frame_packet.map(frame => frame.map(row => [...row])),
    state: packet.state, availableActionIds: packet.available_action_refs.map(action => Number(action.slice(6))),
    level: packet.level, levelCount: 3, levelsCompleted: packet.levels_completed, canUndo: false, canSelectLevel: true, defaultFps: 10 };
}

for (const fixture of [ordered.session, ...fields.cases]) {
  test(`native SRC/service/controller replays public ${fixture.game} transitions without a Python solver`, async () => {
    const service = new V6AgentService(() => createNativeV6Runtime(declarations));
    const operations: V6AgentOperation[] = [];
    const transport: V6AgentTransport = {
      request(operation) { operations.push(operation); return service.handle(operation); },
      reset() { assert.fail('No automatic memory reset is allowed'); }, dispose() {},
    };
    const stream = fixture.transitions.flatMap((prefix: any) => prefix.steps.map((step: any, index: number) => ({
      command: prefix.proposal.actions[index] as NativeCommand, after: step.afterPublic as NativePublicObservation,
    })));
    let index = 0, current = gamePacket(fixture.initial.public, fixture.game);
    const agent = new BrowserV6Agent({ transport, getObservation: () => current, canDispatch: () => true, onState: () => {},
      dispatch: async action => {
        const expected = stream[index];
        assert.ok(expected, 'No unobserved fixture action may be fabricated');
        assert.deepEqual({ action_ref: `ACTION${action.id}`, data: action.id === 6 ? { ...action.data } : {} }, expected.command);
        current = gamePacket(expected.after, fixture.game); index += 1;
        return { observation: current, executionMs: 0.25 };
      },
    });
    let sessionId: string | null = null;
    for (let level = 1; level <= Math.max(1, fixture.levelsCompleted); level += 1) {
      await agent.run(600);
      assert.notEqual(agent.snapshot.status, 'error', agent.snapshot.message);
      if (sessionId !== null) assert.equal(agent.snapshot.sessionId, sessionId);
      sessionId = agent.snapshot.sessionId;
      if (fixture.levelsCompleted) assert.ok(current.levelsCompleted >= level, agent.snapshot.message);
    }
    assert.equal(index, fixture.actions);
    assert.equal(agent.snapshot.actionCount, fixture.actions);
    assert.equal(agent.snapshot.actions, fixture.actions);
    assert.equal(operations.filter(operation => operation.type === 'advance').length, fixture.actions);
    assert.equal(current.levelsCompleted, fixture.levelsCompleted);
    assert.equal(agent.snapshot.sourceCommit, V6_REFERENCE_COMMIT);
    assert.match(agent.snapshot.sourceDigest, /^[a-f0-9]{64}$/);
    const snapshot = agent.snapshot as unknown as Record<string, any>;
    assert.equal(snapshot.coverage.fullV6Parity, false);
    assert.equal(snapshot.srcDecision.workflow, 'v6.composition_strategy.choose');
    assert.ok(snapshot.srcDecision.executed_statements.length > 0);
    if (!fixture.actions) assert.equal(agent.snapshot.reason, 'no_applicable_transferred_family');
  });
}

class RecordingBackend implements NativeV6Backend {
  readonly sourceCommit = V6_REFERENCE_COMMIT;
  readonly sourceDigest = 'native-service-test';
  observation: NativePublicObservation | null = null;
  actions = 0;
  closes: string[] = [];
  malformed = false;
  command: NativeCommand = { action_ref: 'ACTION6', data: { x: 2, y: 3 } };
  initializeCalls = 0;
  advances: NativeOutcome[] = [];
  resumes = 0;
  snapshot(): NativeRuntimeSnapshot {
    return { ...emptyV6Snapshot(), sourceDigest: this.sourceDigest, actions: this.malformed ? 99 : this.actions,
      level: this.observation?.level ?? 1, levelsCompleted: this.observation?.levels_completed ?? 0 };
  }
  private output(kind: NativeRuntimeYield['kind']): NativeRuntimeYield {
    return { kind, reason: null, command: kind === 'action' ? this.command : null,
      authorization: kind === 'action' ? { observation_ref: 'native-current-observation', decision_revision: 1, action_index: this.actions } : null,
      snapshot: this.snapshot() };
  }
  async initialize(input: NativeInitialize): Promise<NativeRuntimeYield> {
    this.initializeCalls += 1; this.observation = input.observation; return this.output('action');
  }
  async advance(outcome: NativeOutcome): Promise<NativeRuntimeYield> {
    this.advances.push(outcome); this.observation = outcome.observation; this.actions += 1; return this.output('boundary');
  }
  async resume(): Promise<NativeRuntimeYield> { this.resumes += 1; return this.output('action'); }
  close(reason: string): void { this.closes.push(reason); }
}
function init(sessionId = 'native-test') {
  return { type: 'init' as const, sessionId, sequence: 0 as const, observation: toV6PublicObservation(board(), 0), budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600] } };
}

test('native service binds one immutable ticket, preserves it on resume and burns it after the witnessed action', async () => {
  const backend = new RecordingBackend(); const service = new V6AgentService(() => backend);
  const first = await service.handle(init());
  assert.equal(first.kind, 'action'); assert.ok(first.ticket);
  assert.ok(Object.isFrozen(first.ticket)); assert.ok(Object.isFrozen(first.ticket.data));
  const resumed = await service.handle({ type: 'resume', sessionId: 'native-test', sequence: 0 });
  assert.equal(resumed.ticket, first.ticket); assert.equal(backend.resumes, 0);
  const operation = { type: 'advance' as const, sessionId: 'native-test', sequence: 1, ticketId: first.ticket.id,
    observation: toV6PublicObservation(board(1), 1), executionMs: 2.5 };
  const acquired = await service.handle(operation);
  assert.equal(acquired.kind, 'boundary'); assert.equal(acquired.snapshot.actions, 1);
  assert.deepEqual(backend.advances[0]!.command, { action_ref: 'ACTION6', data: { x: 2, y: 3 } });
  assert.equal(backend.advances[0]!.executionMs, 2.5);
  await assert.rejects(service.handle(operation), /pending authorization/);
  assert.equal(backend.advances.length, 1);
  const next = await service.handle({ type: 'resume', sessionId: 'native-test', sequence: 1 });
  assert.notEqual(next.ticket?.id, first.ticket.id); assert.equal(backend.resumes, 1);
});

test('bad outcome identity, timing and animation packets do not consume a native service authorization', async () => {
  const backend = new RecordingBackend(); const service = new V6AgentService(() => backend);
  const first = await service.handle(init());
  const base = { type: 'advance' as const, sessionId: 'native-test', sequence: 1, ticketId: first.ticket!.id,
    observation: toV6PublicObservation(board(1), 1), executionMs: 1 };
  for (const invalid of [
    { ...base, ticketId: 'old' }, { ...base, sessionId: 'other' }, { ...base, sequence: 2 }, { ...base, executionMs: NaN },
    { ...base, observation: { ...base.observation, stepIndex: 4 } },
    { ...base, observation: { ...base.observation, frames: [board(2).frame] } },
    { ...base, observation: { ...base.observation, hiddenEngine: true } },
  ]) await assert.rejects(service.handle(invalid));
  assert.equal(backend.advances.length, 0); assert.equal(backend.closes.length, 0);
  assert.equal((await service.handle(base)).snapshot.actions, 1);
});

test('a native backend state failure closes its authority and never resumes from partial evidence', async () => {
  const backend = new RecordingBackend(); const service = new V6AgentService(() => backend);
  const first = await service.handle(init()); backend.malformed = true;
  await assert.rejects(service.handle({ type: 'advance', sessionId: 'native-test', sequence: 1, ticketId: first.ticket!.id,
    observation: toV6PublicObservation(board(1), 1), executionMs: 0 }), /state does not bind/);
  assert.equal(backend.advances.length, 1); assert.deepEqual(backend.closes, ['native_runtime_error']);
  await assert.rejects(service.handle({ type: 'resume', sessionId: 'native-test', sequence: 1 }), /no longer current/);
});

test('native runtime defers family recording until a sealed prefix and ignores paused wall time', async () => {
  let clock = 0; const records: number[] = [];
  const family: NativeFamily = {
    id: 'bounded-native-test',
    propose: () => ({ status: 'proposed', kind: 'public_test', actions: [{ action_ref: 'ACTION1', data: {} }, { action_ref: 'ACTION1', data: {} }], steps: [{}, {}] }),
    before: () => ({ admitted: true, reason: 'current' }),
    after: (_proposal, index) => ({ matched: true, seal_prefix: index === 1, reason: 'witnessed' }),
    record: (_before, _after, _command, _first, _second, _proposal, index) => { records.push(index); return { events: [] }; },
    state: () => ({ recorded: [...records] }),
    restore: state => { records.splice(0, records.length, ...(state.recorded as number[])); },
  };
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [family], maxPointOccurrences: 250, sourceDigest: 'native-clock-test', now: () => clock }));
  let result = await service.handle(init());
  clock = 3_600_000;
  result = await service.handle({ type: 'advance', sessionId: 'native-test', sequence: 1, ticketId: result.ticket!.id, observation: toV6PublicObservation(board(1), 1), executionMs: 5 });
  assert.equal(result.kind, 'action'); assert.deepEqual(records, []); assert.equal(result.snapshot.activeSeconds, 0.005);
  clock += 3_600_000;
  result = await service.handle({ type: 'advance', sessionId: 'native-test', sequence: 2, ticketId: result.ticket!.id, observation: toV6PublicObservation(board(2), 2), executionMs: 7 });
  assert.equal(result.kind, 'boundary'); assert.deepEqual(records, [0, 1]); assert.equal(result.snapshot.activeSeconds, 0.012);
});
