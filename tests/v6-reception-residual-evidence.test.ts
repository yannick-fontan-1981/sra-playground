import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { ReceptionResidualEvidence } from '../src/logos-engine/v6-reception-residual-evidence.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-reception-service-reference.json.gz', import.meta.url))).toString());
const copy = <T>(value: T): T => structuredClone(value);
const seeded = (events: R[]): ReceptionResidualEvidence => {
  const memory = new ReceptionResidualEvidence(); for (const event of events) memory.applyEvent(event); return memory;
};
const assertState = (memory: ReceptionResidualEvidence, state: R): void => {
  assert.deepEqual(memory.currentState(), state.projection); assert.equal(memory.retainedDigest(), state.digest);
};
assert.ok(fixture.residualCases.length >= 12, 'source consumed residual cases must be present');
for (const item of fixture.residualCases as R[]) test('original consumed ResidualAccess ' + item.id, () => {
  const seed = copy(item.seedEvents), a = copy(item.arguments), memory = seeded(seed);
  assertState(memory, item.beforeState);
  assert.deepEqual(memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index), item.expected);
  assertState(memory, item.afterState);
  assert.deepEqual(a, item.arguments); assert.deepEqual(seed, item.seedEvents);
});

test('consumed residual restoration retains ambiguous arrivals and detached evidence', () => {
  for (const item of fixture.residualCases as R[]) {
    const events = copy([...item.seedEvents, ...item.expected]), memory = seeded(events);
    assertState(memory, item.afterState);
    const exported = memory.currentState(); exported.roles = {}; exported.controls = {}; exported.failed = [];
    for (const event of events) { if (event.role) event.role.value = 999; if (event.arrivals) event.arrivals.length = 0; }
    assertState(memory, item.afterState);
  }
});
