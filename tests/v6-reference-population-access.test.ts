import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { ReferencePopulationMemory, freshReferencePopulationMemory, referencePopulationBefore,
  referencePopulationAfter } from '../src/logos-engine/v6-reference-population-access.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-reference-population-reference.json.gz', import.meta.url))).toString());
const copy = <T>(value: T): T => structuredClone(value);
const own = new Set(['propose', 'record', 'apply_events']);
const seeded = (events: R[] = []): ReferencePopulationMemory => {
  const memory = new ReferencePopulationMemory();
  for (const event of events) memory.applyEvent(copy(event));
  return memory;
};
const assertState = (memory: ReferencePopulationMemory, expected: R): void => {
  assert.deepEqual(memory.currentState(), expected.projection);
  assert.equal(memory.retainedDigest(expected.parentDigest), expected.digest);
};
function execute(memory: ReferencePopulationMemory, operation: string, a: R): unknown {
  if (operation === 'propose') return memory.propose(a.observation, a.rows, a.inputs, a.limit, a.config);
  if (operation === 'record') return memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index);
  return a.events.map((event: R) => { memory.applyEvent(event); return null; });
}
const proposalCase = (): R => {
  const result = fixture.cases.find((item: R) => item.operation === 'propose' && item.expected?.status === 'proposed');
  assert.ok(result, 'The independent source fixture must include an admitted proposal'); return result;
};

for (const item of fixture.cases.filter((item: R) => own.has(item.operation)) as R[]) test('original reference population ' + item.id, () => {
  const a = copy(item.arguments), memory = seeded(item.seedEvents);
  if (item.beforeState) assertState(memory, item.beforeState);
  assert.deepEqual(execute(memory, item.operation, a), item.expected, item.id);
  if (item.afterState) assertState(memory, item.afterState);
  assert.deepEqual(a, item.arguments, 'caller arguments remain unchanged');
});

for (const item of fixture.guards as R[]) test('original reference population guard ' + item.id, () => {
  const value = copy(item);
  const actual = value.phase === 'before' ? referencePopulationBefore(value.proposal, value.index, value.rows, value.meta)
    : referencePopulationAfter(value.proposal, value.index, value.rows, value.later, value.meta);
  assert.deepEqual(actual, value.expected); assert.deepEqual(value, item);
});

for (const item of fixture.sourceExceptions.filter((item: R) => own.has(item.operation)) as R[]) test('original reference population rejection ' + item.id, () => {
  const a = copy(item.arguments), memory = seeded(item.seedEvents);
  if (item.beforeState) assertState(memory, item.beforeState);
  assert.throws(() => execute(memory, item.operation, a));
  if (item.afterState) assertState(memory, item.afterState);
  assert.deepEqual(a, item.arguments);
});

test('reference population empty owner and foreign event failures are detached and atomic', () => {
  const first = freshReferencePopulationMemory(), second = freshReferencePopulationMemory(), owner = new ReferencePopulationMemory();
  assert.deepEqual(owner.currentState(), first);
  first.population_controls.foreign = {}; first.population_events.push({ kind: 'foreign' });
  assert.deepEqual(owner.currentState(), second);
  assert.throws(() => owner.applyEvent({ kind: 'observed_reception_service' }), /Outside reference-population/);
  assert.throws(() => owner.applyEvent({ kind: 'observed_reference_population' }), /lacks its controls or state/);
  assert.deepEqual(owner.record({}, {}, {}, [], [], {}, 0), []);
  assert.deepEqual(owner.currentState(), second); assert.equal(owner.nativeRevision, 0); assert.equal(owner.eventCount, 0);
});

test('reference population disabled and unmeasured fresh input delegates without acquiring knowledge', () => {
  const a = proposalCase().arguments, owner = new ReferencePopulationMemory(), original = owner.currentState();
  assert.equal(owner.propose(a.observation, a.rows, a.inputs, a.limit, {}), null);
  assert.equal(owner.propose(a.observation, a.rows, a.inputs, a.limit, { reference_population_question: {} }), null);
  const blank = Array.from({ length: 64 }, () => Array(64).fill(0));
  assert.equal(owner.propose(a.observation, blank, a.inputs, a.limit, a.config), null);
  assert.deepEqual(owner.currentState(), original); assert.equal(owner.nativeRevision, 0);
});

test('reference population proposals and exported state cannot mutate the acquired owner', () => {
  const item = proposalCase(), a = copy(item.arguments), owner = seeded(item.seedEvents), original = owner.currentState(), revision = owner.nativeRevision;
  const proposal = owner.propose(a.observation, a.rows, a.inputs, a.limit, a.config)!;
  proposal.reference_population_plan.state.evidence.push('foreign');
  proposal.reference_population_plan.scene.bodies[0].cell[0] += 100;
  proposal.reference_population_plan.controls.foreign = { delta: [99, 99] };
  const exported = owner.currentState(); exported.population_controls.foreign = {}; exported.population_events.length = 0;
  if (exported.population_state) exported.population_state.evidence.length = 0;
  assert.deepEqual(owner.currentState(), original); assert.equal(owner.nativeRevision, revision);
});

test('reference population actual records and replay preserve full source states with detached ownership', () => {
  for (const item of fixture.cases.filter((value: R) => value.operation === 'record') as R[]) {
    const a = copy(item.arguments), owner = seeded(item.seedEvents), previous = owner.eventCount;
    const events = owner.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index);
    assert.equal(owner.eventCount, previous + item.expected.length); assert.equal(owner.nativeRevision, owner.eventCount);
    assertState(owner, item.afterState);
    const replay = seeded([...(item.seedEvents ?? []), ...events]);
    assertState(replay, item.afterState); assert.equal(replay.retainedDigest('parent'), owner.retainedDigest('parent'));
    for (const event of events) {
      event.state.evidence.push('external'); event.controls.foreign = {}; event.detail.command.action_ref = 'external';
    }
    assertState(owner, item.afterState); assertState(replay, item.afterState);
  }
});

test('reference population level boundary acquires no own event or guessed new state', () => {
  const item = proposalCase(), a = copy(item.arguments), owner = seeded(item.seedEvents), original = owner.currentState(), revision = owner.nativeRevision;
  const proposal = owner.propose(a.observation, a.rows, a.inputs, a.limit, a.config)!;
  const after = { ...a.observation, level_epoch: a.observation.level_epoch + 1, observation_ref: 'synthetic:boundary' };
  assert.deepEqual(owner.record(a.observation, proposal.actions[0], after, a.rows, [], proposal, 0), []);
  assert.deepEqual(owner.currentState(), original); assert.equal(owner.nativeRevision, revision);
});

test('reference population native deadline is an explicit refusal with no proposed action or acquisition', () => {
  const item = proposalCase(), a = copy(item.arguments), owner = seeded(item.seedEvents), original = owner.currentState(), revision = owner.nativeRevision;
  const native = { ...a.config, native_reference_population_bounds: true, native_reference_population_now: () => 10, level_deadline: 10 };
  assert.deepEqual(owner.propose(a.observation, a.rows, a.inputs, a.limit, native), {
    status: 'unknown', block_unrelated_probe: true, reason: 'reference_population_level_deadline',
  });
  assert.deepEqual(owner.currentState(), original); assert.equal(owner.nativeRevision, revision);
  assert.deepEqual(owner.propose(a.observation, a.rows, a.inputs, a.limit, { ...native, native_reference_population_bounds: false }), item.expected);
});

for (const [label, limits, cause] of [
  ['node', { node_bound: 0 }, 'NODE_BOUND'], ['time', { time_bound_ms: 0 }, 'TIME_BOUND'],
  ['interruption', { shouldStop: () => true }, 'NATIVE_INTERRUPTION'],
] as const) test('reference population native ' + label + ' exhaustion leaves the question open and state unchanged', () => {
  const item = proposalCase(), a = copy(item.arguments), owner = seeded(item.seedEvents), original = owner.currentState(), revision = owner.nativeRevision;
  const result = owner.propose(a.observation, a.rows, a.inputs, a.limit, { ...a.config,
    native_reference_population_bounds: true, native_reference_population_now: () => 0, native_reference_population_work_budget: limits })!;
  assert.equal(result.status, 'unknown'); assert.equal(result.block_unrelated_probe, true);
  assert.equal(result.reason, 'reference_population_work_bound'); assert.equal(result.exhausted_bound, cause);
  assert.equal(result.actions, undefined); assert.equal(result.reference_population_plan, undefined);
  assert.deepEqual(owner.currentState(), original); assert.equal(owner.nativeRevision, revision);
});

test('reference population finite native movement domain cannot silently truncate the measured population', () => {
  const item = proposalCase(), a = copy(item.arguments), owner = seeded(item.seedEvents), original = owner.currentState();
  assert.deepEqual(owner.propose(a.observation, a.rows, a.inputs, a.limit, { ...a.config,
    native_reference_population_bounds: true, native_reference_population_work_budget: { domain_bound: 0 } }), {
    status: 'unknown', block_unrelated_probe: true, reason: 'reference_population_native_domain_bound',
  });
  assert.deepEqual(owner.currentState(), original);
});

test('reference population native nonexhausted bounds preserve the source proposal exactly', () => {
  for (const item of fixture.cases.filter((value: R) => value.operation === 'propose') as R[]) {
    const a = copy(item.arguments), owner = seeded(item.seedEvents);
    const result = owner.propose(a.observation, a.rows, a.inputs, a.limit, { ...a.config,
      native_reference_population_bounds: true, native_reference_population_now: () => 0, level_deadline: 1000 });
    assert.deepEqual(result, item.expected, item.id);
    if (item.afterState) assertState(owner, item.afterState);
  }
});
