import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { ReceptionServiceMemory, freshReceptionServiceMemory, receptionServiceBefore,
  receptionServiceAfter } from '../src/logos-engine/v6-reception-service-access.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-reception-service-reference.json.gz', import.meta.url))).toString());
const copy = <T>(value: T): T => structuredClone(value);
const own = new Set(['propose', 'record', 'apply_events']);
const caseOf = (id: string): R => {
  const result = fixture.cases.find((item: R) => item.id === id); assert.ok(result, 'Missing source case ' + id); return result;
};
const seeded = (events: R[] = [], native = false): ReceptionServiceMemory => {
  const memory = new ReceptionServiceMemory({ currentEpochAcquisition: native });
  for (const event of events) memory.applyEvent(copy(event)); return memory;
};
const assertState = (memory: ReceptionServiceMemory, expected: R): void => {
  assert.deepEqual(memory.currentState(), expected.projection);
  assert.equal(memory.retainedDigest(expected.parentDigest), expected.digest);
};
for (const item of fixture.cases.filter((item: R) => own.has(item.operation)) as R[]) test('original reception service ' + item.id, () => {
  const a = copy(item.arguments), memory = seeded(item.seedEvents);
  if (item.beforeState) assertState(memory, item.beforeState);
  let actual: unknown;
  if (item.operation === 'propose') actual = memory.propose(a.observation, a.rows, a.inputs, a.limit, a.config);
  else if (item.operation === 'record') actual = memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index);
  else actual = a.events.map((event: R) => { memory.applyEvent(event); return null; });
  assert.deepEqual(actual, item.expected, item.id);
  if (item.afterState) assertState(memory, item.afterState);
  assert.deepEqual(a, item.arguments, 'source API leaves caller inputs unchanged');
});

for (const item of fixture.guards as R[]) test('original reception guard ' + item.id, () => {
  const value = copy(item);
  const actual = value.phase === 'before' ? receptionServiceBefore(value.proposal, value.index, value.rows, value.meta)
    : receptionServiceAfter(value.proposal, value.index, value.rows, value.later, value.meta);
  assert.deepEqual(actual, value.expected); assert.deepEqual(value, item);
});

for (const item of fixture.sourceExceptions as R[]) test('original reception contract rejection ' + item.id, () => {
  const a = copy(item.arguments), memory = seeded(item.seedEvents);
  assertState(memory, item.beforeState);
  assert.throws(() => memory.propose(a.observation, a.rows, a.inputs, a.limit, a.config), RangeError);
  assertState(memory, item.afterState);
});

test('reception disabled or unmeasured delegates without an event or mutation', () => {
  const a = caseOf('propose:initial_control').arguments, memory = new ReceptionServiceMemory();
  assert.equal(memory.propose(a.observation, a.rows, a.inputs, a.limit, {}), null);
  assert.equal(memory.propose(a.observation, a.rows, a.inputs, a.limit, { reception_service_question: {} }), null);
  assert.equal(memory.propose(a.observation, Array.from({ length: 64 }, () => Array(64).fill(0)), a.inputs, a.limit, a.config), null);
  assert.deepEqual(memory.currentState(), { reception_memory: freshReceptionServiceMemory(), reception_events: [] });
  assert.deepEqual(memory.record({}, {}, {}, [], [], {}, 0), []);
  assert.throws(() => memory.applyEvent({ kind: 'observed_exposed_reception' }), /Outside reception-service/);
  assert.throws(() => memory.applyEvent({ kind: 'observed_reception_service' }), /lacks its memory/);
  assert.equal(memory.nativeRevision, 0); assert.equal(memory.eventCount, 0);
});

test('reception proposal remains tentative and returned events cannot mutate acquired memory', () => {
  const sample = caseOf('record:observed_control_and_residual'), a = copy(sample.arguments), memory = seeded(sample.seedEvents);
  const original = memory.currentState(), revision = memory.nativeRevision;
  const p = caseOf('propose:initial_control').arguments;
  const proposal = memory.propose(p.observation, p.rows, p.inputs, p.limit, p.config)!;
  proposal.reception_service_plan.memory.controls.changed = { delta: [99, 99] };
  assert.deepEqual(memory.currentState(), original); assert.equal(memory.nativeRevision, revision);
  const events = memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index);
  assert.equal(memory.nativeRevision, revision + 1); assert.equal(memory.eventCount, (sample.seedEvents ?? []).length + 1);
  assertState(memory, sample.afterState);
  events[0].memory.controls.changed = { delta: [99, 99] }; events[0].detail.command.action_ref = 'mutated';
  const exported = memory.currentState(); exported.reception_memory.evidence.length = 0; exported.reception_events.length = 0;
  assertState(memory, sample.afterState);
});

test('reception replay retains acquired controls, refutations, residual events and cumulative waits exactly', () => {
  for (const item of fixture.cases.filter((value: R) => value.operation === 'record') as R[]) {
    const events = copy([...(item.seedEvents ?? []), ...item.expected]), memory = seeded(events);
    assertState(memory, item.afterState); assert.equal(memory.eventCount, events.length);
    assert.equal(memory.nativeRevision, events.length);
    const digest = memory.retainedDigest('ancestor'); events.at(-1).memory.evidence.push('foreign');
    assert.equal(memory.retainedDigest('ancestor'), digest);
  }
});

test('native wait budget keeps the source ceiling under a larger whole-level budget', () => {
  for (const id of ['propose:first_stationary_witness', 'propose:confirmed_wait_batch', 'propose:wait_cumulative_limit']) {
    const item = caseOf(id), a = copy(item.arguments), memory = seeded(item.seedEvents, true);
    assert.throws(() => memory.propose(a.observation, a.rows, a.inputs, a.limit, { ...a.config, level_action_cap: 600 }), /outside portable source domain/);
    const proposal = memory.propose(a.observation, a.rows, a.inputs, a.limit,
      { ...a.config, level_action_cap: 600, native_reception_wait_budget: true })!;
    assert.equal(proposal.status, 'proposed');
    assert.ok(proposal.actions.length <= 128 - proposal.reception_service_plan.memory.wait_spent);
    if (id.includes('first_stationary')) assert.equal(proposal.actions.length, 1);
    else assert.ok(proposal.actions.length <= 8);
  }
});

test('native wait exhaustion blocks both source fallback probes and further wait acquisition', () => {
  const item = caseOf('propose:source_wait_exhaustion_unrelated_probe'), a = copy(item.arguments), memory = seeded(item.seedEvents, true);
  const before = memory.currentState(), revision = memory.nativeRevision;
  assert.equal(item.expected.reception_service_plan.kind, 'reception_observation');
  assert.equal(item.expected.actions.length, 1, 'the source exhaustion fallback is preserved separately');
  assert.deepEqual(memory.propose(a.observation, a.rows, a.inputs, a.limit, { ...a.config, native_reception_wait_budget: true }), {
    status: 'unknown', reason: 'reception_wait_budget_exhausted', block_unrelated_probe: true,
  });
  assert.deepEqual(memory.currentState(), before); assert.equal(memory.nativeRevision, revision);
});

test('native epoch acquisition commits the guarded current reset once and retains observation history', () => {
  const item = caseOf('record:source_new_epoch_record_keeps_old_memory'), a = copy(item.arguments), memory = seeded(item.seedEvents, true);
  const prior = memory.currentState().reception_memory;
  assert.notEqual(prior.epoch, a.before.level_epoch);
  const result = memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index);
  const current = result[0].memory;
  assert.equal(current.epoch, a.before.level_epoch);
  assert.equal(current.wait_spent, a.proposal.reception_service_plan.memory.wait_spent);
  assert.ok(prior.evidence.every((ref: string) => current.evidence.includes(ref)));
  assert.ok(current.residual_events.length >= prior.residual_events.length);
  const next = memory.propose(a.after, a.later, [{ action_ref: a.command.action_ref }], 16, fixture.config)!;
  assert.equal(next.reception_service_plan.memory.epoch, a.after.level_epoch);
  assert.deepEqual(next.reception_service_plan.memory.controls, current.controls);
  const count = memory.eventCount, digest = memory.retainedDigest('parent');
  const invalid = copy(a.proposal); invalid.reception_service_plan.memory.epoch = -1;
  assert.throws(() => memory.record({ ...a.before, level_epoch: a.before.level_epoch + 1 }, a.command, a.after, a.rows, a.later, invalid, 0), /current bound proposal memory/);
  assert.equal(memory.eventCount, count); assert.equal(memory.retainedDigest('parent'), digest);
});

test('native new epoch renews stationary confirmation even at the same target and command', () => {
  const item = caseOf('propose:confirmed_wait_batch'), a = copy(item.arguments), memory = seeded(item.seedEvents, true);
  const retained = memory.currentState().reception_memory;
  assert.ok(Object.keys(retained.stationary).length);
  const nextObservation = { ...a.observation, level_epoch: retained.epoch + 1, observation_ref: 'synthetic:new-epoch' };
  const initial = memory.propose(nextObservation, a.rows, a.inputs, a.limit, { ...a.config, native_reception_wait_budget: true })!;
  assert.equal(initial.reception_service_plan.memory.stationary, undefined);
  assert.equal(initial.reception_service_plan.memory.wait_spent, 0);
  assert.deepEqual(initial.reception_service_plan.memory.controls, {});
  const acquired = copy(initial.reception_service_plan.memory);
  acquired.controls = copy(retained.controls);
  memory.applyEvent({ kind: 'observed_reception_service', memory: acquired, detail: { source: 'synthetic newly acquired controls' } });
  const first = memory.propose(nextObservation, a.rows, a.inputs, a.limit, { ...a.config, native_reception_wait_budget: true })!;
  assert.equal(first.reception_service_plan.kind, 'reception_observation');
  assert.equal(first.actions.length, 1); assert.equal(first.reception_service_plan.steps[0].stationary_confirmed, false);
  const later = { ...nextObservation, observation_ref: 'synthetic:stationary-return', revision: nextObservation.revision + 1 };
  memory.record(nextObservation, first.actions[0], later, a.rows, a.rows, first, 0);
  const confirmed = memory.propose(later, a.rows, a.inputs, a.limit, { ...a.config, native_reception_wait_budget: true })!;
  assert.equal(confirmed.reception_service_plan.steps[0].stationary_confirmed, true);
  assert.ok(confirmed.actions.length > 1); assert.equal(confirmed.reception_service_plan.memory.wait_spent, 1);
});

test('native resumed wait ledger cannot be reset by another prefix or restoration', () => {
  const item = caseOf('propose:wait_cumulative_limit'), a = copy(item.arguments), memory = seeded(item.seedEvents, true);
  const config = { ...a.config, native_reception_wait_budget: true };
  const proposal = memory.propose(a.observation, a.rows, a.inputs, a.limit, config)!;
  const initial = proposal.reception_service_plan.memory.wait_spent;
  const after = { ...a.observation, observation_ref: 'synthetic:one-more-wait', revision: a.observation.revision + 1 };
  memory.record(a.observation, proposal.actions[0], after, a.rows, a.rows, proposal, 0);
  const restored = seeded(memory.currentState().reception_events, true);
  assert.equal(restored.currentState().reception_memory.wait_spent, initial + 1);
  assert.deepEqual(restored.currentState(), memory.currentState());
  const next = restored.propose(after, a.rows, a.inputs, a.limit, config)!;
  if (initial + 1 >= a.config.level_action_cap) assert.equal(next.reason, 'reception_wait_budget_exhausted');
  else assert.ok(next.actions.length <= a.config.level_action_cap - initial - 1);
});
