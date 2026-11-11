import assert from 'node:assert/strict';
import test from 'node:test';
import { TraceCreatedAttribution, commonNode } from '../../qualify-cost-owner-graphs.mjs';
const DIGESTS = ['a'.repeat(64), 'b'.repeat(64)], SESSION = 'cost-trace-comparator-fixture';
const WINDOWS = { baseline: { startedAt: '2026-11-11T00:00:00.000Z', finishedAt: '2026-11-11T00:01:00.000Z' },
  candidate: { startedAt: '2026-11-11T00:02:00.000Z', finishedAt: '2026-11-11T00:03:00.000Z' } };
const copy = value => structuredClone(value);
const bits = seconds => { const value = Buffer.alloc(8); value.writeDoubleBE(seconds); return value.toString('hex'); };
const at = iso => bits(Date.parse(iso) / 1000);
function pair() {
  return ['baseline', 'candidate'].map((role, index) => ({ id: 'reasoning:trace:1', kind: 'component_state',
    component: 'native_reasoning_trace', scope: SESSION, revision: 1, status: 'retained', evidence: [], relations: [],
    origin: { source_digest: DIGESTS[index], workflow: 'prototype.laya_router.route', step: 'native_memory', statement: 'after.persist', store_profile: 'v6.native-state.v2/fragmented-float64-be' },
    value: { component: 'reasoning:trace:1', profile: 'logos-engine.v6.state-graph.v1', root: { kind: 'object', members: {
      id: 1, episode: 'common-observation-frontier', kind: 'src_decision',
      body: { kind: 'object', members: { decision: 'same-decision', created: { kind: 'float64', bits: at('2026-11-11T00:00:30.000Z') } } },
      created: { kind: 'float64', bits: at(index ? '2026-11-11T00:02:30.000Z' : '2026-11-11T00:00:30.000Z') },
    } } } }));
}
function setup() { const attribution = new TraceCreatedAttribution(copy(WINDOWS)); return { attribution, sessionId: SESSION }; }
const compare = (nodes, temporal) => commonNode(...nodes, ...DIGESTS, temporal);

test('distinct real capture times are admitted while both original nodes remain unchanged', () => {
  const nodes = pair(), before = copy(nodes), temporal = setup();
  compare(nodes, temporal); compare(nodes, temporal);
  assert.deepEqual(nodes, before); assert.equal(temporal.attribution.records.length, 2);
  assert.deepEqual(temporal.attribution.records.map(row => row.role), ['baseline', 'candidate']);
});
test('capture endpoints are inclusive and separate sessions have separate stability identities', () => {
  const nodes = pair(), temporal = setup();
  nodes[0].value.root.members.created.bits = at(WINDOWS.baseline.startedAt);
  nodes[1].value.root.members.created.bits = at(WINDOWS.candidate.finishedAt); compare(nodes, temporal);
  const later = pair(); for (const n of later) n.scope = 'another-session';
  compare(later, { ...temporal, sessionId: 'another-session' }); assert.equal(temporal.attribution.records.length, 4);
});
for (const [name, index, change] of [
  ['before its own window', 0, c => { c.bits = at('2026-11-10T23:59:59.999Z'); }],
  ['after its own window', 1, c => { c.bits = at('2026-11-11T00:03:00.001Z'); }],
  ['another role window', 0, c => { c.bits = at('2026-11-11T00:02:30.000Z'); }],
  ['nonfinite NaN', 0, c => { c.bits = bits(NaN); }],
  ['nonfinite infinity', 1, c => { c.bits = bits(Infinity); }],
  ['submillisecond clock', 0, c => { c.bits = bits(Date.parse('2026-11-11T00:00:30.000Z') / 1000 + 0.0001); }],
  ['wrong encoded type', 0, c => { c.kind = 'float32'; }],
  ['malformed bits', 1, c => { c.bits = 'not-a-float64'; }],
  ['extra encoded field', 0, c => { c.unexpected = true; }],
]) test('rejects created ' + name, () => { const nodes = pair(), temporal = setup(); change(nodes[index].value.root.members.created);
  assert.throws(() => compare(nodes, temporal)); assert.equal(temporal.attribution.records.length, 0); });
for (const index of [0, 1]) test('rejects unstable timestamp in role ' + index, () => {
  const nodes = pair(), temporal = setup(); compare(nodes, temporal); const later = copy(nodes);
  later[index].value.root.members.created.bits = at(index ? '2026-11-11T00:02:31.000Z' : '2026-11-11T00:00:31.000Z');
  assert.throws(() => compare(later, temporal), /changed within/); assert.equal(temporal.attribution.records.length, 2);
});
for (const [name, change] of [
  ['other node field', n => { n.revision = 2; }],
  ['other envelope field', n => { n.value.root.members.kind = 'different-decision'; }],
  ['trace body value', n => { n.value.root.members.body.members.decision = 'changed-action'; }],
  ['nested created field', n => { n.value.root.members.body.members.created.bits = at('2026-11-11T00:00:31.000Z'); }],
  ['incorrect origin', n => { n.origin.source_digest = DIGESTS[0]; }],
  ['incorrect real trace ID', n => { n.value.root.members.id = 2; }],
  ['wrong session', n => { n.scope = 'wrong-session'; }],
  ['extra root member', n => { n.value.root.members.extra = true; }],
]) test('rejects ' + name + ' without retaining partial attribution', () => { const nodes = pair(), temporal = setup(); change(nodes[1]);
  assert.throws(() => compare(nodes, temporal)); assert.equal(temporal.attribution.records.length, 0); });
test('nontrace created differences cannot receive the temporal exception', () => {
  const nodes = pair(); for (const n of nodes) { n.id = 'component:not-a-trace'; n.component = 'other_component'; n.value.component = n.id; }
  assert.throws(() => compare(nodes, setup()), /Unattributed common node value/);
});
test('a falsely labelled trace identifier and a missing temporal context are rejected', () => {
  const nodes = pair(); for (const n of nodes) n.id = 'reasoning:trace:01';
  assert.throws(() => compare(nodes, setup()), /real reasoning trace/);
  assert.throws(() => commonNode(...pair(), ...DIGESTS), /capture-bound/);
});
test('invalid capture windows cannot create an attribution context', () => {
  const reversed = copy(WINDOWS); reversed.baseline.finishedAt = '2026-11-10T00:00:00.000Z';
  assert.throws(() => new TraceCreatedAttribution(reversed), /interval/);
  const malformed = copy(WINDOWS); malformed.candidate.startedAt = 'not-a-date';
  assert.throws(() => new TraceCreatedAttribution(malformed), /interval/);
});
