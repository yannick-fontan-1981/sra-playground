import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { ReactiveContact } from '../src/logos-engine/v6-reactive-contact.ts';
import * as escape from '../src/logos-engine/v6-reactive-contact-escape.ts';
import * as parent from '../src/logos-engine/v6-reactive-contact-parent.ts';
import * as stationary from '../src/logos-engine/v6-reactive-contact-stationary.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-reactive-contact-family-reference.json.gz', import.meta.url))).toString()) as R;
const copy = <T>(value: T): T => structuredClone(value);
const SOURCE_RECEIPT = ['workflow', 'src_hash', 'src_status', 'executed_statements'];
/** Only Set serialization changes. Every source state/proposal field and every
 * four-field source SRC receipt is compared literally, including identities. */
function sourceView(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Set) return [...value].sort().map(sourceView);
  if (Array.isArray(value)) return value.map(sourceView);
  if (SOURCE_RECEIPT.every(k => Object.hasOwn(value, k)) && typeof value.workflow === 'string' && typeof value.src_hash === 'string') {
    assert.deepEqual(Object.keys(value).sort(), [...SOURCE_RECEIPT].sort(), 'Source-facing receipts retain their exact original contract');
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sourceView(v)]));
}

for (const row of fixture.cases) test(`reactive original family and returns: ${row.id}`, async () => {
  const args = copy(row.arguments);
  const family = await ReactiveContact.create(fixture.continuationPolicy);
  if (row.seedState) family.restore(copy(row.seedState));
  const run = async () => {
    const [namespace, method] = row.operation.split('.');
    if (namespace === 'stationary') return (stationary as unknown as R)[method](...args);
    if (namespace === 'parent') return (parent as unknown as R)[method](...args);
    if (namespace === 'escape') return escape.project(...args as [R, R, string, number]);
    if (namespace === 'topology') {
      const budget = { count: 0, visit(_value: unknown) { this.count++; } };
      const measurement = escape.measure_escape_topology(args[0], budget); return { measurement, evaluations: budget.count };
    }
    const result = await (family as unknown as R)[row.operation](...args);
    return result === undefined ? null : result;
  };
  if (row.error) await assert.rejects(run);
  else assert.deepEqual(sourceView(await run()), row.value);
  if (row.afterState) assert.deepEqual(sourceView(family.state()), row.afterState);
});

test('reactive component fixture records verified original bytes and no campaign claim', () => {
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.match(fixture.qualification, /synthetic/); assert.match(fixture.qualification, /No game dispatch/);
  for (const [name, expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = readFileSync(new URL(`../reference/v6/${fixture.referenceCommit}/source/${name}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, name);
  }
});

test('reactive early source entry is inert without a retained dependency and validates each continuation gate', async () => {
  const reference = fixture.cases.find((row: R) => row.id === 'pending_nonpushing_proposal'), family = await ReactiveContact.create(fixture.continuationPolicy);
  const [observation, rows, inputs, remaining] = reference.arguments, initial = family.state();
  let calls = 0; const propose = family.propose.bind(family);
  family.propose = async (...args) => { calls++; return propose(...args); };
  assert.equal(await family.proposeInSubquestion('factored_material_return', 'reactive_contact_continuation', observation, rows, inputs, remaining), null);
  assert.equal(calls, 0, 'The original pre-call gate must not scope an empty owner'); assert.deepEqual(family.state(), initial);
  family.restore(reference.seedState);
  const proposal = await family.proposeInSubquestion('factored_material_return', 'reactive_contact_continuation', observation, rows, inputs, remaining) as R;
  assert.ok(proposal); assert.equal(calls, 1); assert.equal(proposal.material_access_subquestion, 'reactive_contact_continuation');
  assert.deepEqual(proposal.retained_dependency_continuation, { reason: fixture.continuationPolicy.meaning,
    parent: proposal.reactive_plan.offer.parent.id, evidence: proposal.reactive_plan.offer.evidence, scope: observation.level_epoch });
  const general = await family.proposeInSubquestion('factored_material_return', 'reactive_contact', observation, rows, inputs, remaining) as R;
  assert.equal(general.material_access_subquestion, 'reactive_contact'); assert.equal(general.retained_dependency_continuation, undefined);
  for (const field of fixture.continuationPolicy.conditions.map((condition: R) => condition.field)) {
    family.propose = async () => { const p = copy(reference.value); p.reactive_plan.offer.facts[field] = false; return p; };
    assert.equal(await family.proposeInSubquestion('factored_material_return', 'reactive_contact_continuation', observation, rows, inputs, remaining), null, field);
  }
  family.propose = async () => { const p = copy(reference.value); p.reactive_plan.offer.kind = 'contact_probe'; return p; };
  assert.equal(await family.proposeInSubquestion('factored_material_return', 'reactive_contact_continuation', observation, rows, inputs, remaining), null);
  await assert.rejects(family.proposeInSubquestion('goal_access', 'reactive_contact', observation, rows, inputs, remaining), /Unknown reactive-contact source entry/);
});

test('reactive public views detach, immutable checkpoints preserve all thirteen fields, and invalid restores are atomic', async () => {
  const row = fixture.cases.find((candidate: R) => candidate.id === 'pending_nonpushing_proposal'), family = await ReactiveContact.create(fixture.continuationPolicy);
  const seed = copy(row.seedState); family.restore(seed); const expected = family.state();
  seed.control.signature = 'forged'; seed.input_trials = {}; assert.deepEqual(family.state(), expected);
  const view = family.state(); view.control.commands = {}; view.observations.length = 0; assert.deepEqual(family.state(), expected);
  const checkpoint = family.nativeState() as R, revision = family.nativeRevision;
  assert.equal(Object.keys(checkpoint.source_state).length, 13); assert.deepEqual(checkpoint.source_state, expected);
  assert.ok(Object.isFrozen(checkpoint)); assert.ok(Object.isFrozen(checkpoint.source_state.control.evidence));
  assert.equal(family.nativeState(), checkpoint);
  for (const bad of [{ ...copy(checkpoint), format: 'wrong' }, { ...copy(checkpoint), unexpected: true },
    { ...copy(checkpoint), source_state: { ...copy(expected), floor: NaN } },
    { ...copy(checkpoint), source_state: { ...copy(expected), observations: {} } },
    { ...copy(checkpoint), source_state: { ...copy(expected), input_trials: [] } }]) {
    assert.throws(() => family.restoreNative(bad)); assert.deepEqual(family.state(), expected);
    assert.equal(family.nativeRevision, revision); assert.equal(family.nativeState(), checkpoint);
  }
  family.restore({ question: null }); family.restoreNative(checkpoint);
  assert.deepEqual(family.state(), expected, 'The immutable authoritative checkpoint restores a changed mutable owner');
});
