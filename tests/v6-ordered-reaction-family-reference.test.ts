import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { OrderedReaction } from '../src/logos-engine/v6-ordered-reaction.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-ordered-reaction-family-reference.json.gz', import.meta.url))).toString()) as R;
const copy = <T>(value: T): T => structuredClone(value);
const SOURCE_RECEIPT = ['workflow', 'src_hash', 'src_status', 'executed_statements'];
function sourceView(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sourceView);
  if (SOURCE_RECEIPT.every(k => Object.hasOwn(value, k)) && typeof value.workflow === 'string') {
    assert.deepEqual(Object.keys(value).sort(), [...SOURCE_RECEIPT].sort(), 'Original receipts keep their exact source contract');
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sourceView(v)]));
}

for (const row of fixture.cases) test(`ordered reaction original family: ${row.id}`, async () => {
  const family = await OrderedReaction.create(); family.restore(copy(row.seedState));
  const run = async () => {
    const result = await (family as unknown as R)[row.operation](...copy(row.arguments));
    return result === undefined ? null : sourceView(result);
  };
  if (row.error) await assert.rejects(run);
  else assert.deepEqual(await run(), row.value);
  assert.deepEqual(sourceView(family.state()), row.afterState);
});

test('ordered reaction family fixture is bound to unchanged original source bytes', () => {
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.match(fixture.qualification, /synthetic/); assert.match(fixture.qualification, /No game dispatch/);
  for (const [name, expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = readFileSync(new URL(`../reference/v6/${fixture.referenceCommit}/source/${name}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, name);
  }
});

test('ordered reaction entry keeps its original material annotation and rejects unrelated source entries', async () => {
  const row = fixture.cases.find((item: R) => item.id === 'observed_incidence_cover_proposal'), family = await OrderedReaction.create();
  family.restore(copy(row.seedState));
  const [obs, rows, inputs, remaining] = copy(row.arguments);
  const result = await family.proposeInSubquestion('factored_material_return', 'ordered_reaction', obs, rows, inputs, remaining) as R;
  assert.deepEqual(result, { ...row.value, material_access_subquestion: 'ordered_reaction' });
  await assert.rejects(family.proposeInSubquestion('surface', 'ordered_reaction', obs, rows, inputs, remaining), /Unknown ordered-reaction/);
  await assert.rejects(family.proposeInSubquestion('factored_material_return', 'reactive_contact', obs, rows, inputs, remaining), /Unknown ordered-reaction/);
});

test('ordered reaction checkpoints detach six source fields and atomically restore authoritative state', async () => {
  const row = fixture.cases.find((item: R) => item.id === 'observed_incidence_cover_proposal'), family = await OrderedReaction.create(), seed = copy(row.seedState);
  family.restore(seed); const expected = family.state(); seed.control.length = 0; seed.packets.length = 0;
  assert.deepEqual(family.state(), expected);
  const view = family.state(); view.packets[0].packet.frame_count = 999; view.history.push({ wrong: true });
  assert.deepEqual(family.state(), expected);
  const checkpoint = family.nativeState() as R, revision = family.nativeRevision;
  assert.equal(Object.keys(checkpoint.source_state).length, 6); assert.deepEqual(checkpoint.source_state, expected);
  assert.ok(Object.isFrozen(checkpoint)); assert.ok(Object.isFrozen(checkpoint.source_state.packets[0].packet));
  assert.equal(family.nativeState(), checkpoint);
  for (const bad of [{ ...copy(checkpoint), format: 'wrong' }, { ...copy(checkpoint), unexpected: true },
    { ...copy(checkpoint), source_state: { ...copy(expected), epoch: NaN } },
    { ...copy(checkpoint), source_state: { ...copy(expected), packets: {} } },
    { ...copy(checkpoint), source_state: { ...copy(expected), attempts: [] } },
    { ...copy(checkpoint), source_state: { ...copy(expected), history: [1] } }]) {
    assert.throws(() => family.restoreNative(bad)); assert.deepEqual(family.state(), expected);
    assert.equal(family.nativeRevision, revision); assert.equal(family.nativeState(), checkpoint);
  }
  family.restore({ packets: [], progress: null }); family.restoreNative(checkpoint);
  assert.deepEqual(family.state(), expected, 'Reusing an immutable checkpoint still restores a changed mutable owner');
});
