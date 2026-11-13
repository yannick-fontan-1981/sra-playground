import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  NativeInitialize, NativeOutcome, NativePublicObservation, NativeRuntimeSnapshot, NativeRuntimeYield, NativeV6Backend,
} from '../src/logos-engine/v6-native-types.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { emptyV6Snapshot, V6_REFERENCE_COMMIT } from '../src/runtime/v6-agent-protocol.ts';

function frozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}
const frame = Array.from({ length: 64 }, () => Array<number>(64).fill(0));
const packet = (stepIndex = 0) => ({ frame, frames: [frame], availableActionIds: [1],
  state: 'NOT_FINISHED', level: 1, levelsCompleted: 0, stepIndex });
const initial = (sessionId = 'snapshot-copies') => ({ type: 'init' as const, sessionId, sequence: 0 as const,
  observation: packet(), budgets: { targetLevels: 3, levelActionCaps: [20, 20, 20] } });

class SnapshotBackend implements NativeV6Backend {
  readonly sourceCommit = V6_REFERENCE_COMMIT;
  readonly sourceDigest = 'snapshot-copies-test';
  graphChain = 'a'.repeat(64);
  nativeExecutionDigest = 'b'.repeat(64);
  graphRevision = 1;
  trace: unknown[] = [];
  proposal: unknown = null;
  activeSeconds = 0;
  current: NativePublicObservation | null = null;
  advances = 0;
  snapshot(): NativeRuntimeSnapshot {
    return { ...emptyV6Snapshot(), sourceDigest: this.sourceDigest, actions: this.advances,
      level: this.current?.level ?? 1, levelsCompleted: this.current?.levels_completed ?? 0,
      graphChain: this.graphChain, nativeExecutionDigest: this.nativeExecutionDigest, graphRevision: this.graphRevision,
      activeSeconds: this.activeSeconds, trace: this.trace, proposal: this.proposal };
  }
  output(kind: NativeRuntimeYield['kind']): NativeRuntimeYield {
    return { kind, reason: null, command: kind === 'action' ? { action_ref: 'ACTION1', data: {} } : null,
      authorization: kind === 'action' ? { observation_ref: `observation:${this.advances}`, decision_revision: 1, action_index: 0 } : null,
      snapshot: this.snapshot() };
  }
  async initialize(input: NativeInitialize): Promise<NativeRuntimeYield> { this.current = input.observation; this.advances = 0; return this.output('action'); }
  async advance(outcome: NativeOutcome): Promise<NativeRuntimeYield> { this.current = outcome.observation; this.advances++; return this.output('boundary'); }
  async resume(): Promise<NativeRuntimeYield> { return this.output('action'); }
  authorizationIdentity() { return { graphChain: this.graphChain, nativeExecutionDigest: this.nativeExecutionDigest }; }
  close(): void {}
}

test('service reuses detached immutable branches while snapshots and trace lists stay fresh', async () => {
  const backend = new SnapshotBackend();
  backend.trace = [frozen({ kind: 'observed', detail: { rows: [[1, 2]] } })];
  backend.proposal = frozen({ actions: [{ action_ref: 'ACTION1', data: {} }], witness: { values: [1, 2] } });
  const service = new V6AgentService(() => backend), first = await service.handle(initial());
  backend.activeSeconds = 2;
  const second = await service.handle({ type: 'snapshot', sessionId: first.sessionId, sequence: 0 });
  assert.notEqual(first, second);
  assert.notEqual(first.snapshot, second.snapshot);
  assert.notEqual(first.snapshot.trace, second.snapshot.trace);
  assert.notEqual(first.snapshot.trace[0], backend.trace[0]);
  assert.notEqual(first.snapshot.proposal, backend.proposal);
  assert.equal(first.snapshot.trace[0], second.snapshot.trace[0]);
  assert.equal(first.snapshot.proposal, second.snapshot.proposal);
  assert.equal(first.snapshot.activeSeconds, 0);
  assert.equal(second.snapshot.activeSeconds, 2);
  assert.throws(() => (first.snapshot.trace as unknown[]).push({}), TypeError);
  assert.throws(() => { (first.snapshot.trace[0] as any).detail.rows[0][0] = 99; }, TypeError);
  assert.throws(() => { (first.snapshot.proposal as any).witness.values.push(99); }, TypeError);
  assert.deepEqual(first.snapshot.proposal, backend.proposal);
  // Worker transport remains a separate copy, whose consumer cannot mutate the
  // retained public snapshot or a subsequent response in the service.
  const transported = structuredClone(second);
  (transported.snapshot.proposal as any).witness.values[0] = 99;
  assert.equal((first.snapshot.proposal as any).witness.values[0], 1);
});

for (const shallow of [false, true]) {
  test(`${shallow ? 'shallow-frozen' : 'mutable'} backend branches are recopied and never treated as immutable`, async () => {
    const backend = new SnapshotBackend(), nested = { values: [1] };
    const branch = { nested };
    if (shallow) Object.freeze(branch);
    backend.proposal = branch; backend.trace = [branch];
    const service = new V6AgentService(() => backend), first = await service.handle(initial());
    nested.values.push(2);
    const second = await service.handle({ type: 'snapshot', sessionId: first.sessionId, sequence: 0 });
    assert.deepEqual((first.snapshot.proposal as any).nested.values, [1]);
    assert.deepEqual((second.snapshot.proposal as any).nested.values, [1, 2]);
    assert.notEqual(first.snapshot.proposal, second.snapshot.proposal);
    assert.notEqual(first.snapshot.trace[0], second.snapshot.trace[0]);
    assert.equal(Object.isFrozen(nested), false);
    assert.equal(Object.isFrozen(nested.values), false);
  });
}

test('frozen accessor branches keep their current value and their ordinary copy boundary', async () => {
  const backend = new SnapshotBackend(); let current = 1, reads = 0;
  const branch = Object.freeze({ get current() { reads++; return current; } });
  backend.proposal = branch;
  const service = new V6AgentService(() => backend), first = await service.handle(initial());
  assert.equal(reads, 1);
  current = 2;
  const second = await service.handle({ type: 'snapshot', sessionId: first.sessionId, sequence: 0 });
  assert.equal(reads, 2, 'Immutability checks do not invoke getters');
  assert.deepEqual(first.snapshot.proposal, { current: 1 });
  assert.deepEqual(second.snapshot.proposal, { current: 2 });
  assert.notEqual(first.snapshot.proposal, second.snapshot.proposal);
});

test('the public projection reads a root proposal accessor only once per snapshot', async () => {
  const backend = new SnapshotBackend(), originalSnapshot = backend.snapshot.bind(backend); let reads = 0;
  backend.snapshot = () => {
    const snapshot = originalSnapshot();
    Object.defineProperty(snapshot, 'proposal', { enumerable: true, get: () => frozen({ revision: ++reads }) });
    return snapshot;
  };
  const service = new V6AgentService(() => backend), first = await service.handle(initial());
  assert.equal(reads, 1);
  assert.deepEqual(first.snapshot.proposal, { revision: 1 });
  const second = await service.handle({ type: 'snapshot', sessionId: first.sessionId, sequence: 0 });
  assert.equal(reads, 2);
  assert.deepEqual(second.snapshot.proposal, { revision: 2 });
});

test('the complete fallback copy preserves aliases of mutable backend values', async () => {
  const backend = new SnapshotBackend(), shared = { values: [1] };
  backend.proposal = shared; backend.trace = [shared, shared];
  const service = new V6AgentService(() => backend), first = await service.handle(initial());
  assert.equal(first.snapshot.proposal, first.snapshot.trace[0]);
  assert.equal(first.snapshot.trace[0], first.snapshot.trace[1]);
  assert.notEqual(first.snapshot.proposal, shared);
  shared.values.push(2);
  const second = await service.handle({ type: 'snapshot', sessionId: first.sessionId, sequence: 0 });
  assert.equal(second.snapshot.proposal, second.snapshot.trace[0]);
  assert.deepEqual((first.snapshot.proposal as any).values, [1]);
  assert.deepEqual((second.snapshot.proposal as any).values, [1, 2]);
});

for (const kind of ['date', 'map', 'set'] as const) {
  test(`a frozen ${kind} with mutable internal state is never reused`, async () => {
    const backend = new SnapshotBackend();
    const value = kind === 'date' ? new Date(1000) : kind === 'map' ? new Map([['value', 1]]) : new Set([1]);
    backend.proposal = Object.freeze(value);
    const service = new V6AgentService(() => backend), first = await service.handle(initial());
    if (value instanceof Date) value.setTime(2000);
    else if (value instanceof Map) value.set('value', 2);
    else value.add(2);
    const second = await service.handle({ type: 'snapshot', sessionId: first.sessionId, sequence: 0 });
    assert.notEqual(first.snapshot.proposal, second.snapshot.proposal);
    assert.deepEqual(second.snapshot.proposal, structuredClone(value));
    assert.notDeepEqual(first.snapshot.proposal, second.snapshot.proposal);
  });
}

test('trace truncation and newly observed branches preserve earlier returned snapshots', async () => {
  const backend = new SnapshotBackend(); backend.trace = Array.from({ length: 130 }, (_, sequence) => frozen({ sequence }));
  backend.proposal = frozen({ revision: 1 });
  const service = new V6AgentService(() => backend), first = await service.handle(initial());
  assert.deepEqual(first.snapshot.trace.map((row: any) => row.sequence), Array.from({ length: 128 }, (_, i) => i + 2));
  backend.trace.push(frozen({ sequence: 130 })); backend.proposal = frozen({ revision: 2 });
  const second = await service.handle({ type: 'snapshot', sessionId: first.sessionId, sequence: 0 });
  assert.deepEqual(second.snapshot.trace.map((row: any) => row.sequence), Array.from({ length: 128 }, (_, i) => i + 3));
  assert.equal(first.snapshot.trace[1], second.snapshot.trace[0]);
  assert.deepEqual(first.snapshot.proposal, { revision: 1 });
  assert.deepEqual(second.snapshot.proposal, { revision: 2 });
  assert.equal((first.snapshot.trace.at(-1) as any).sequence, 129);
});

test('retained diagnostic branches cannot reuse old graph identity or authorize an old ticket', async () => {
  const backend = new SnapshotBackend(); backend.proposal = frozen({ witness: [1] });
  backend.trace = [frozen({ kind: 'acquired' })];
  const service = new V6AgentService(() => backend), first = await service.handle(initial());
  backend.graphChain = 'c'.repeat(64); backend.graphRevision++;
  const second = await service.handle({ type: 'snapshot', sessionId: first.sessionId, sequence: 0 });
  assert.equal(first.snapshot.proposal, second.snapshot.proposal);
  assert.notEqual(first.snapshot.graphChain, second.snapshot.graphChain);
  assert.equal(second.snapshot.graphChain, backend.graphChain);
  assert.equal(second.snapshot.graphRevision, 2);
  await assert.rejects(service.handle({ type: 'advance', sessionId: first.sessionId, sequence: 1,
    ticketId: first.ticket!.id, observation: packet(1), executionMs: 0 }), /earlier knowledge graph/);
  assert.equal(backend.advances, 0);
});

test('a new session owns fresh detached copies even if an injected backend reuses an immutable branch', async () => {
  const backend = new SnapshotBackend(); backend.proposal = frozen({ witness: [1] });
  backend.trace = [frozen({ kind: 'acquired' })];
  const service = new V6AgentService(() => backend), first = await service.handle(initial());
  await service.handle({ type: 'close', sessionId: first.sessionId, sequence: 0 });
  const second = await service.handle(initial('snapshot-copies-next'));
  assert.deepEqual(first.snapshot.proposal, second.snapshot.proposal);
  assert.notEqual(first.snapshot.proposal, second.snapshot.proposal);
  assert.notEqual(first.snapshot.trace[0], second.snapshot.trace[0]);
  assert.notEqual(first.ticket!.id, second.ticket!.id);
});
