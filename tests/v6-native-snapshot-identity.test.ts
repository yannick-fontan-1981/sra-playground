import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type {
  NativeAuthorizationIdentity, NativeFamily, NativeInitialize, NativeOutcome,
  NativePublicObservation, NativeRuntimeSnapshot, NativeRuntimeYield, NativeV6Backend,
} from '../src/logos-engine/v6-native-types.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { emptyV6Snapshot, V6_REFERENCE_COMMIT } from '../src/runtime/v6-agent-protocol.ts';

const graph = 'a'.repeat(64), program = 'b'.repeat(64);
const frame = Array.from({ length: 64 }, () => Array<number>(64).fill(0));
const packet = (stepIndex = 0) => ({ frame, frames: [frame], availableActionIds: [1],
  state: 'NOT_FINISHED' as const, level: 1, levelsCompleted: 0, stepIndex });
const initialize = () => ({ type: 'init' as const, sessionId: 'identity-test', sequence: 0 as const,
  observation: packet(), budgets: { targetLevels: 3, levelActionCaps: [20, 20, 20] } });

class IdentityBackend implements NativeV6Backend {
  readonly sourceCommit = V6_REFERENCE_COMMIT;
  readonly sourceDigest = 'identity-test';
  graphChain = graph;
  nativeExecutionDigest = program;
  snapshotCalls = 0;
  identityCalls = 0;
  advances = 0;
  malformedSnapshot = false;
  malformedIdentity: unknown = undefined;
  current: NativePublicObservation | null = null;
  closed: string[] = [];
  authorizationIdentity?: () => NativeAuthorizationIdentity;
  constructor(optIn: boolean) {
    if (optIn) this.authorizationIdentity = () => {
      this.identityCalls++;
      return this.malformedIdentity !== undefined ? this.malformedIdentity as NativeAuthorizationIdentity
        : { graphChain: this.graphChain, nativeExecutionDigest: this.nativeExecutionDigest };
    };
  }
  snapshot(): NativeRuntimeSnapshot {
    this.snapshotCalls++;
    return { ...emptyV6Snapshot(), sourceDigest: this.sourceDigest, actions: this.malformedSnapshot ? 99 : this.advances,
      level: this.current?.level ?? 1, levelsCompleted: this.current?.levels_completed ?? 0,
      graphChain: this.graphChain, graphRevision: 1, nativeExecutionDigest: this.nativeExecutionDigest };
  }
  output(kind: NativeRuntimeYield['kind']): NativeRuntimeYield {
    return { kind, reason: null, command: kind === 'action' ? { action_ref: 'ACTION1', data: {} } : null,
      authorization: kind === 'action' ? { observation_ref: 'current-observation', decision_revision: 1, action_index: 0 } : null,
      snapshot: this.snapshot() };
  }
  async initialize(input: NativeInitialize): Promise<NativeRuntimeYield> { this.current = input.observation; return this.output('action'); }
  async advance(outcome: NativeOutcome): Promise<NativeRuntimeYield> { this.current = outcome.observation; this.advances++; return this.output('boundary'); }
  async resume(): Promise<NativeRuntimeYield> { return this.output('action'); }
  close(reason: string): void { this.closed.push(reason); }
}

for (const optIn of [false, true]) {
  test(`service checks live authority with ${optIn ? 'identity opt-in' : 'snapshot fallback'} and still validates outgoing snapshots`, async () => {
    const backend = new IdentityBackend(optIn), service = new V6AgentService(() => backend);
    const first = await service.handle(initialize());
    const next = await service.handle({ type: 'advance', sessionId: first.sessionId, sequence: 1,
      ticketId: first.ticket!.id, observation: packet(1), executionMs: 0 });
    assert.equal(next.snapshot.actions, 1);
    assert.equal(backend.snapshotCalls, optIn ? 2 : 3);
    assert.equal(backend.identityCalls, optIn ? 1 : 0);
    assert.equal(backend.advances, 1);
    assert.ok(Object.isFrozen(next.snapshot));
  });

  for (const key of ['graphChain', 'nativeExecutionDigest'] as const) {
    test(`${optIn ? 'identity opt-in' : 'snapshot fallback'} rejects a live ${key} change before acquisition without burning the pending ticket`, async () => {
      const backend = new IdentityBackend(optIn), service = new V6AgentService(() => backend);
      const first = await service.handle(initialize()), previous = backend[key];
      const operation = { type: 'advance' as const, sessionId: first.sessionId, sequence: 1,
        ticketId: first.ticket!.id, observation: packet(1), executionMs: 0 };
      backend[key] = 'c'.repeat(64);
      await assert.rejects(service.handle(operation), /earlier knowledge graph/);
      assert.equal(backend.advances, 0); assert.deepEqual(backend.closed, []);
      backend[key] = previous;
      assert.equal((await service.handle(operation)).snapshot.actions, 1);
      await assert.rejects(service.handle(operation), /pending authorization/);
      assert.equal(backend.advances, 1);
    });
  }
}

for (const invalid of [null, {}, { graphChain: graph }, { graphChain: 'invalid', nativeExecutionDigest: program }]) {
  test(`malformed opted-in authority closes the session before acquisition: ${JSON.stringify(invalid)}`, async () => {
    const backend = new IdentityBackend(true), service = new V6AgentService(() => backend);
    const first = await service.handle(initialize()); backend.malformedIdentity = invalid;
    await assert.rejects(service.handle({ type: 'advance', sessionId: first.sessionId, sequence: 1,
      ticketId: first.ticket!.id, observation: packet(1), executionMs: 0 }), /Invalid native authorization identity/);
    assert.equal(backend.advances, 0); assert.deepEqual(backend.closed, ['native_runtime_error']);
    await assert.rejects(service.handle({ type: 'resume', sessionId: first.sessionId, sequence: 0 }), /no longer current/);
  });
}

test('the lightweight identity check never replaces validation of a returned backend snapshot', async () => {
  const backend = new IdentityBackend(true), service = new V6AgentService(() => backend);
  const first = await service.handle(initialize()); backend.malformedSnapshot = true;
  await assert.rejects(service.handle({ type: 'advance', sessionId: first.sessionId, sequence: 1,
    ticketId: first.ticket!.id, observation: packet(1), executionMs: 0 }), /state does not bind/);
  assert.equal(backend.advances, 1); assert.equal(backend.identityCalls, 1);
  assert.deepEqual(backend.closed, ['native_runtime_error']);
});

test('real runtime identity tracks graph edits and snapshots safely share only owned frozen trace entries', async () => {
  const records: number[] = [];
  const family: NativeFamily = {
    id: 'identity-family',
    propose: () => ({ status: 'proposed', kind: 'bounded-public-test',
      actions: [{ action_ref: 'ACTION1', data: {} }, { action_ref: 'ACTION1', data: {} }], steps: [{}, {}] }),
    before: () => ({ admitted: true, reason: 'current' }),
    after: (_p, i) => ({ matched: true, seal_prefix: i === 1, reason: 'witnessed' }),
    record: (_b, _a, _c, _f, _s, _p, i) => { records.push(i); return { events: [] }; },
    state: () => ({ records: [...records] }),
    restore: state => { records.splice(0, records.length, ...(state.records as number[])); },
  };
  const runtime = new NativeV6Runtime({ families: [family], maxPointOccurrences: 250, sourceDigest: 'identity-runtime', now: () => 0 });
  assert.throws(() => runtime.authorizationIdentity(), /not initialized/);
  const service = new V6AgentService(() => runtime);
  let result = await service.handle(initialize());
  const first = runtime.snapshot(), original = structuredClone(first), identity = runtime.authorizationIdentity();
  assert.deepEqual(identity, { graphChain: first.graphChain, nativeExecutionDigest: first.nativeExecutionDigest });
  assert.ok(Object.isFrozen(identity)); assert.ok(Object.isFrozen(first.trace));
  assert.ok(first.trace.length > 0 && Object.isFrozen(first.trace[0]));
  assert.notEqual(first.trace, runtime.snapshot().trace);
  assert.equal(first.trace[0], runtime.snapshot().trace[0]);
  assert.notEqual(first.trace[0], result.snapshot.trace[0], 'The public service keeps its independent copy boundary');
  assert.throws(() => (first.trace as unknown[]).push({}), TypeError);
  assert.throws(() => { (first.trace[0] as Record<string, unknown>).kind = 'tampered'; }, TypeError);
  for (let sequence = 1; sequence <= 2; sequence++) result = await service.handle({ type: 'advance',
    sessionId: result.sessionId, sequence, ticketId: result.ticket!.id, observation: packet(sequence), executionMs: 0 });
  assert.equal(result.kind, 'boundary'); assert.deepEqual(records, [0, 1]);
  assert.deepEqual(first, original, 'Later notes and acquisition leave previous snapshots intact');
  const after = runtime.authorizationIdentity();
  assert.notEqual(after.graphChain, identity.graphChain);
  assert.equal(after.graphChain, runtime.inspectKnowledge().chain);
  await service.handle({ type: 'edit', sessionId: result.sessionId, sequence: 2,
    edit: { expectedGraphChain: after.graphChain, reason: 'verify identity invalidation',
      changes: [{ type: 'set_family_enabled', familyId: family.id, enabled: false }] } });
  const edited = runtime.authorizationIdentity(), snapshot = runtime.snapshot();
  assert.notEqual(edited.graphChain, after.graphChain); assert.notEqual(edited.nativeExecutionDigest, after.nativeExecutionDigest);
  assert.deepEqual(edited, { graphChain: snapshot.graphChain, nativeExecutionDigest: snapshot.nativeExecutionDigest });
  assert.equal(edited.graphChain, runtime.inspectKnowledge().chain);
  assert.deepEqual(first, original);
});
