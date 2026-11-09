import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { ReactionPolicy, ORDERED_REACTION_POLICY_SUBSET } from '../src/logos-engine/v6-ordered-reaction-policy.ts';
import * as geometry from '../src/logos-engine/v6-ordered-reaction-measurements.ts';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-ordered-reaction-reference.json.gz', import.meta.url))).toString());
const policy = ReactionPolicy.create();

test('ordered reaction subset preserves exactly three original V5 projections and source bytes', () => {
  const root = new URL('../reference/v6/' + fixture.referenceCommit + '/source/', import.meta.url);
  for (const [path, hash] of Object.entries(fixture.sourceHashes)) assert.equal(createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex'), hash);
  const original = JSON.parse(readFileSync(new URL('agents/yf_arc3_v5/drm/interaction.drm', root), 'utf8'));
  const expected = Object.fromEntries(original.declarations.flatMap((d: any) => d.fact_projections ?? []).filter((p: any) => Object.hasOwn(ORDERED_REACTION_POLICY_SUBSET.projections, p.id)).map((p: any) => [p.id, p]));
  assert.equal(Object.keys(expected).length, 3);
  assert.deepEqual(ORDERED_REACTION_POLICY_SUBSET.projections, expected);
});

for (const row of fixture.cases) test('ordered reaction unchanged Python ' + row.id, async () => {
  const args = structuredClone(row.arguments);
  const execute = async () => {
    if (row.operation === 'choose') return (await policy).choose(args);
    if (row.operation === 'digest') return geometry.digest(args);
    if (row.operation === 'measure_square_field') return geometry.measureSquareField(args);
    if (row.operation === 'observe') return geometry.observe(args.first, args.frames, args.action);
    if (row.operation === 'measure') return geometry.measure(args.rows, args.packets, args.directions);
    if (row.operation === 'packet_restore') return geometry.packetRestore(args);
    if (row.operation === 'retain_distinct') return geometry.retainDistinctOrderedSquarePacket(args.packets, args.packet, args.limit);
    if (row.operation === 'measure_cell_deltas') return geometry.measureCellDeltas(args.before, args.frames, args.row_phase, args.col_phase, args.stride, args.size, args.max_cells, args.max_frames);
    throw new Error('Unmapped original operation: ' + row.operation);
  };
  if (row.error) await assert.rejects(execute, (error: Error) => error.name === row.error.name);
  else assert.deepEqual(await execute(), row.value);
});

test('ordered reaction policy retains four-field original receipts and does not share mutable output', async () => {
  const p = await policy, sample = fixture.cases.find((c: any) => c.id === 'choose:cover:valid');
  const input = structuredClone(sample.arguments), [result, receipt] = await p.choose(input);
  assert.deepEqual(Object.keys(receipt).sort(), ['workflow', 'src_hash', 'src_status', 'executed_statements'].sort());
  assert.throws(() => { result.projected.premise_claim_refs[0] = 'changed'; }, TypeError);
  assert.throws(() => { p.config.priority.reverse(); }, TypeError);
  assert.deepEqual(input, sample.arguments);
  assert.deepEqual(await p.choose(input), sample.value);
});

test('ordered packet restoration detaches retained nested fields', () => {
  const sample = fixture.cases.find((c: any) => c.id === 'restore:complete');
  const input = structuredClone(sample.arguments), restored = geometry.packetRestore(input);
  restored.field.squares[0]!.offsets[0]![0] = 999;
  assert.deepEqual(input, sample.arguments);
});
